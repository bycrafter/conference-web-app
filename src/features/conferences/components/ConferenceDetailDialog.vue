<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore';
import { useProvidersStore } from '@/features/providers/stores/providers.store';
import { useConferencesStore } from '@/features/conferences/stores/conferences.store';
import { useConferencePermissions } from '@/features/conferences/composables/useConferencePermissions';
import { accountsService } from '@/features/accounts/services/accounts.service';
import SlotRequestDialog from '@/features/slot-requests/components/SlotRequestDialog.vue';
import ConferenceMiniMap from '@/features/conferences/components/ConferenceMiniMap.vue';
import { ConferenceStatus, type ConferenceDto } from '@/types/conference.types';
import { AccountRole, PermissionCode } from '@/types/auth.types';
import type { AccountSummaryDto } from '@/types/account.types';
import { extractErrorMessage } from '@/utils/httpError';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { computed, reactive, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useParticipantResolver } from '@/composables/useParticipantResolver';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const props = defineProps<{
    visible: boolean;
    conference: ConferenceDto | null;
}>();

const emit = defineEmits<{
    'update:visible': [value: boolean];
    /** Fired after a successful edit save so the parent can refetch the calendar's visible range. */
    updated: [];
}>();

const authStore = useAuthStore();
const providersStore = useProvidersStore();
const conferencesStore = useConferencesStore();
const conferencePermissions = useConferencePermissions();
const toast = useToast();
const confirm = useConfirm();
const { displayNameFor, resolve: resolveParticipants } = useParticipantResolver();

const slotRequestDialogVisible = ref(false);
const slotRequestSubmitted = ref(false);
const editMode = ref(false);
const submitting = ref(false);
const cancelling = ref(false);

/**
 * Resolves the conference to display from the store instead of trusting the raw `conference` prop
 * reference. Parent views (`CalendarView`, `SearchView`, `TopbarSearch`) pass in a snapshot captured
 * at click time; without this lookup, in-place store mutations (e.g. `toggleStar`) would never reach
 * this dialog since Vue only re-renders on the actual reactive object that changed. Deliberately named
 * `conference` so it shadows the prop in the template (script-setup bindings take priority over props
 * in the render context) - every read below/in the template stays wired to the store's single source
 * of truth.
 */
const conference = computed<ConferenceDto | null>(() => {
    const snapshot = props.conference;
    if (!snapshot) {
        return null;
    }
    return conferencesStore.events.find((event) => event.id === snapshot.id) ?? conferencesStore.starredEvents.find((event) => event.id === snapshot.id) ?? snapshot;
});

const providerName = computed(() => providersStore.activeProviders.find((provider) => provider.id === conference.value?.providerId)?.name ?? conference.value?.providerId ?? '');

const statusSeverity = computed(() => (conference.value?.status === ConferenceStatus.CANCELLED ? 'danger' : 'success'));

/**
 * Requesting a slot change ONLY makes sense for a plain participant who has NO direct edit
 * rights over the conference. Owners, organizers, and admins can already edit the conference
 * directly (see `canEdit`), so showing them a "Request Slot Change" button would be redundant
 * and misleading. Attendance is determined by email (participants are stored as raw emails),
 * not username.
 */
const canRequestSlotChange = computed(() => {
    const current = conference.value;
    if (!current || !authStore.hasPermission(PermissionCode.SLOT_REQUEST_CREATE)) {
        return false;
    }
    const username = authStore.username;
    const email = authStore.email;
    const participants = current.participants ?? [];
    const isParticipant = participants.includes(email ?? '');
    const isOwner = current.ownerUsername === username;
    const isOrganizer = current.organizerUsername === username;
    const hasEditAllPermission = authStore.hasPermission(PermissionCode.CONFERENCE_UPDATE_ALL);
    return isParticipant && !isOwner && !isOrganizer && !hasEditAllPermission;
});

/**
 * Mirrors the backend's own masking condition (`ConferenceServiceImpl#applyMasking`): anyone
 * without `CONFERENCE_VIEW_ALL` who isn't the conference owner only ever receives a masked DTO
 * (title/description/location/private info/join link/participants nulled out server-side). The
 * dialog still opens - it just renders a stripped-down Time + Organizer summary instead of
 * crashing or pretending the full details are available. Delegated to `useConferencePermissions`,
 * shared with `CalendarView.vue`, so drag-and-drop eligibility never disagrees with this view.
 */
const isRestrictedView = computed(() => (conference.value ? conferencePermissions.isRestrictedView(conference.value) : false));

/** Creator, ORGANIZER or ADMIN may edit - see `useConferencePermissions`. */
const canEdit = computed(() => (conference.value ? conferencePermissions.canEdit(conference.value) : false));

/** Creator, ORGANIZER or ADMIN may cancel - see `useConferencePermissions`. Already-cancelled conferences hide the button - nothing left to cancel. */
const canDelete = computed(() => (conference.value && conference.value.status !== ConferenceStatus.CANCELLED ? conferencePermissions.canDelete(conference.value) : false));

/** Only organizers/admins (`CONFERENCE_CREATE_ALL`) may see/edit the Special Info field - mirrors `CreateEventDialog.vue`'s RBAC gate. */
const canSeePrivateInfo = computed(() => authStore.hasPermission(PermissionCode.CONFERENCE_CREATE_ALL));

const providerOptions = computed(() => providersStore.activeProviders);

const form = reactive({
    title: '',
    description: '',
    location: '',
    privateInfo: '',
    providerId: null as string | null,
    startTime: null as Date | null,
    endTime: null as Date | null
});

const attendeesAutoComplete = ref<ComponentPublicInstance | null>(null);
const attendeeSuggestions = ref<AccountSummaryDto[]>([]);
const selectedAttendees = ref<AccountSummaryDto[]>([]);

async function searchAttendees(event: { query: string }): Promise<void> {
    try {
        attendeeSuggestions.value = await accountsService.search({ q: event.query });
    } catch {
        attendeeSuggestions.value = [];
    }
}

/** Enter-key shortcut: turn any freshly-typed, valid email into an attendee chip. See `CreateEventDialog.vue` for the same pattern. */
function addCustomAttendee(): void {
    const inputEl = attendeesAutoComplete.value?.$el?.querySelector('input') as HTMLInputElement | null | undefined;
    const candidate = inputEl?.value.trim() ?? '';
    if (!candidate || !EMAIL_PATTERN.test(candidate)) {
        return;
    }
    const alreadyAdded = selectedAttendees.value.some((attendee) => attendee.email.toLowerCase() === candidate.toLowerCase());
    if (!alreadyAdded) {
        selectedAttendees.value.push({ username: candidate, email: candidate, role: AccountRole.UNKNOWN });
    }
    if (inputEl) {
        inputEl.value = '';
    }
    attendeeSuggestions.value = [];
}

function enterEditMode(): void {
    const current = conference.value;
    if (!current) {
        return;
    }
    form.title = current.title ?? '';
    form.description = current.description ?? '';
    form.location = current.location ?? '';
    form.privateInfo = current.privateInfo ?? '';
    form.providerId = current.providerId;
    form.startTime = new Date(current.startTime);
    form.endTime = new Date(current.endTime);
    selectedAttendees.value = (current.participants ?? []).map((email) => ({ username: email, email, role: AccountRole.UNKNOWN }));
    editMode.value = true;
}

function cancelEdit(): void {
    editMode.value = false;
}

function close(): void {
    editMode.value = false;
    emit('update:visible', false);
}

async function toggleStar(): Promise<void> {
    const current = conference.value;
    if (!current) {
        return;
    }
    // Dispatch to the store ONLY - no local mutation. The store optimistically flips `isStarred`
    // and every view reading from it (including the `conference` computed above) updates instantly.
    try {
        await conferencesStore.toggleStar(current);
    } catch {
        toast.add({ severity: 'error', summary: 'Action failed', detail: 'Failed to update favorite status.', life: 5000 });
    }
}

function onSlotRequestSubmitted(): void {
    slotRequestSubmitted.value = true;
}

async function cancelConference(): Promise<void> {
    const current = conference.value;
    if (!current) {
        return;
    }
    confirm.require({
        header: 'Cancel Conference',
        message: `Are you sure you want to cancel "${current.title}"? This action cannot be undone.`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Cancel Conference',
        rejectLabel: 'Keep it',
        acceptClass: 'p-button-danger',
        accept: async () => {
            cancelling.value = true;
            try {
                await conferencesStore.cancelEvent(current.id);
                toast.add({ severity: 'success', summary: 'Conference cancelled', detail: `"${current.title}" was cancelled successfully.`, life: 3000 });
                emit('updated');
                close();
            } catch (err) {
                const detail = extractErrorMessage(err, 'Failed to cancel the conference.');
                toast.add({ severity: 'error', summary: 'Cancellation failed', detail, life: 5000 });
            } finally {
                cancelling.value = false;
            }
        }
    });
}

async function saveEdit(): Promise<void> {
    const current = conference.value;
    if (!current) {
        return;
    }
    if (!form.title.trim() || !form.startTime || !form.endTime || !form.providerId || selectedAttendees.value.length === 0) {
        toast.add({ severity: 'error', summary: 'Missing information', detail: 'Please fill in the title, start/end time, provider and at least one attendee.', life: 4000 });
        return;
    }

    submitting.value = true;
    try {
        const participants = selectedAttendees.value.map((account) => (typeof account === 'string' ? account : account.email)).filter((email): email is string => Boolean(email));

        await conferencesStore.updateEvent(current.id, {
            title: form.title.trim(),
            description: (form.description ?? '').trim(),
            startTime: form.startTime.getTime(),
            endTime: form.endTime.getTime(),
            providerId: form.providerId,
            location: (form.location ?? '').trim(),
            privateInfo: (form.privateInfo ?? '').trim(),
            participants
        });
        toast.add({ severity: 'success', summary: 'Event updated', detail: `"${form.title.trim()}" was updated successfully.`, life: 3000 });
        emit('updated');
        close();
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to update conference:', err);
        const detail = extractErrorMessage(err, 'Failed to update the conference.');
        toast.add({ severity: 'error', summary: 'Update failed', detail, life: 5000 });
    } finally {
        submitting.value = false;
    }
}

watch(
    () => props.visible,
    (visible) => {
        if (!visible) {
            editMode.value = false;
        }
    }
);

watch(
    () => conference.value,
    (current) => {
        void resolveParticipants(current?.participants ?? []);
    },
    { immediate: true }
);
</script>

<template>
    <Dialog :visible="visible" modal :header="editMode ? 'Edit Conference' : 'Conference Details'" class="w-full md:w-[36rem]" @update:visible="emit('update:visible', $event)">
        <div v-if="conference && !editMode" class="flex flex-col gap-4">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <div class="font-semibold text-xl">{{ isRestrictedView ? conference.title || 'Busy' : conference.title }}</div>
                    <p v-if="!isRestrictedView" class="text-muted-color">{{ conference.description }}</p>
                </div>
                <Button :icon="conference.isStarred ? 'pi pi-star-fill' : 'pi pi-star'" text rounded severity="warn" :aria-label="conference.isStarred ? 'Unstar' : 'Star'" @click="toggleStar" />
            </div>

            <Message v-if="isRestrictedView" severity="info" :closable="false">You have limited access to this event - only the time and organizer are shown.</Message>

            <div v-if="!isRestrictedView" class="flex flex-wrap gap-2">
                <Tag :value="conference.status" :severity="statusSeverity" />
                <Tag :value="providerName" severity="info" />
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-muted-color text-sm">Starts</div>
                    <div>{{ new Date(conference.startTime).toLocaleString() }}</div>
                </div>
                <div>
                    <div class="text-muted-color text-sm">Ends</div>
                    <div>{{ new Date(conference.endTime).toLocaleString() }}</div>
                </div>
                <div>
                    <div class="text-muted-color text-sm">Organizer</div>
                    <div>{{ conference.organizerUsername }}</div>
                </div>
                <div v-if="!isRestrictedView">
                    <div class="text-muted-color text-sm">Owner</div>
                    <div>{{ conference.ownerUsername }}</div>
                </div>
            </div>

            <template v-if="!isRestrictedView">
                <div v-if="(conference.participants ?? []).length > 0">
                    <div class="text-muted-color text-sm mb-2">Attendees</div>
                    <div class="flex flex-wrap gap-2">
                        <Chip v-for="participant in conference.participants ?? []" :key="participant" :label="displayNameFor(participant)" />
                    </div>
                </div>

                <div v-if="conference.joinLink">
                    <a :href="conference.joinLink" target="_blank" rel="noopener" class="text-primary no-underline"><i class="pi pi-video mr-2"></i>Join Conference</a>
                </div>

                <ConferenceMiniMap :location="conference.location" />
            </template>

            <Message v-if="slotRequestSubmitted" severity="success" :closable="false">Slot change request submitted.</Message>
        </div>

        <div v-else-if="conference && editMode" class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
                <label for="edit-title">Title</label>
                <InputText id="edit-title" v-model="form.title" placeholder="Conference title" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="edit-description">Description</label>
                <Textarea id="edit-description" v-model="form.description" rows="2" auto-resize />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="edit-start">Start</label>
                    <Calendar id="edit-start" v-model="form.startTime" show-time hour-format="24" placeholder="Start date/time" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="edit-end">End</label>
                    <Calendar id="edit-end" v-model="form.endTime" show-time hour-format="24" placeholder="End date/time" />
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <label for="edit-provider">Provider</label>
                <Select id="edit-provider" v-model="form.providerId" :options="providerOptions" option-label="name" option-value="id" placeholder="Select provider" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="edit-location">Location</label>
                <InputText id="edit-location" v-model="form.location" placeholder="Physical room / location" />
                <ConferenceMiniMap :location="form.location" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="edit-attendees">Attendees</label>
                <AutoComplete
                    id="edit-attendees"
                    ref="attendeesAutoComplete"
                    v-model="selectedAttendees"
                    multiple
                    option-label="email"
                    :suggestions="attendeeSuggestions"
                    :delay="300"
                    placeholder="Search OBSS users or type an email and press Enter"
                    @complete="searchAttendees"
                    @keyup.enter.prevent="addCustomAttendee"
                >
                    <template #option="{ option }">{{ option.firstName }} {{ option.lastName }} ({{ option.username }}) - {{ option.email }}</template>
                </AutoComplete>
            </div>

            <div v-if="canSeePrivateInfo" class="flex flex-col gap-2">
                <label for="edit-private-info">Special Info</label>
                <Textarea id="edit-private-info" v-model="form.privateInfo" rows="2" auto-resize placeholder="Host password / sensitive join details" />
            </div>
        </div>

        <template #footer>
            <template v-if="editMode">
                <Button label="Cancel" severity="secondary" :disabled="submitting" @click="cancelEdit" />
                <Button label="Save" icon="pi pi-check" :loading="submitting" @click="saveEdit" />
            </template>
            <template v-else>
                <Button v-if="canDelete" label="Cancel Conference" icon="pi pi-trash" severity="danger" outlined :loading="cancelling" @click="cancelConference" />
                <Button v-if="canRequestSlotChange" label="Request Slot Change" severity="secondary" icon="pi pi-clock" @click="slotRequestDialogVisible = true" />
                <Button v-if="canEdit" label="Edit" icon="pi pi-pencil" severity="secondary" @click="enterEditMode" />
                <Button label="Close" @click="close" />
            </template>
        </template>
    </Dialog>

    <SlotRequestDialog
        v-if="conference"
        v-model:visible="slotRequestDialogVisible"
        :conference-id="conference.id"
        :conference-title="conference.title"
        :conference-start-time="conference.startTime"
        :conference-end-time="conference.endTime"
        @submitted="onSlotRequestSubmitted"
    />
</template>
