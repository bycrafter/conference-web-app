<script setup lang="ts">
import { useConferencesStore } from '@/features/conferences/stores/conferences.store';
import { useProvidersStore } from '@/features/providers/stores/providers.store';
import ConferenceMiniMap from '@/features/conferences/components/ConferenceMiniMap.vue';
import { useAuthStore } from '@/stores/authStore';
import { accountsService } from '@/features/accounts/services/accounts.service';
import { AccountRole, PermissionCode } from '@/types/auth.types';
import type { AccountSummaryDto } from '@/types/account.types';
import { extractErrorMessage } from '@/utils/httpError';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const props = defineProps<{
    visible: boolean;
    /** Pre-fills Start/End when the user drags a slot on the FullCalendar grid. */
    initialRange?: { start: Date; end: Date } | null;
}>();

const emit = defineEmits<{
    'update:visible': [value: boolean];
    created: [];
}>();

const conferencesStore = useConferencesStore();
const providersStore = useProvidersStore();
const authStore = useAuthStore();
const toast = useToast();

/** Only organizers/admins (`CONFERENCE_CREATE_ALL`) may see the Special Info field or create on behalf of another account. */
const canActOnBehalf = computed(() => authStore.hasPermission(PermissionCode.CONFERENCE_CREATE_ALL));

const form = reactive({
    title: '',
    description: '',
    location: '',
    privateInfo: '',
    providerId: null as string | null,
    ownerUsername: authStore.username ?? '',
    startTime: null as Date | null,
    endTime: null as Date | null
});

const attendeesAutoComplete = ref<ComponentPublicInstance | null>(null);
const attendeeSuggestions = ref<AccountSummaryDto[]>([]);
const selectedAttendees = ref<AccountSummaryDto[]>([]);

const onBehalfAutoComplete = ref<ComponentPublicInstance | null>(null);
const onBehalfSuggestions = ref<AccountSummaryDto[]>([]);
const onBehalfSelected = ref<AccountSummaryDto | null>(null);
const onBehalfError = ref<string | null>(null);

const submitting = ref(false);
const error = ref<string | null>(null);

const providerOptions = computed(() => providersStore.activeProviders);

async function searchAttendees(event: { query: string }): Promise<void> {
    try {
        attendeeSuggestions.value = await accountsService.search({ q: event.query });
    } catch {
        attendeeSuggestions.value = [];
    }
}

/** Enter-key shortcut: turn any freshly-typed, valid email into an attendee chip, even if it never matched an OBSS user. Reads the AutoComplete's native input directly since PrimeVue doesn't expose the query text as a bindable prop. */
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

/**
 * Single-selection typeahead search over ALL system accounts (not just ORGANIZER/ADMIN) -
 * mirrors `searchAttendees`, but ONLY a real, matched system-user account may be selected
 * (no free-text/custom entries, unlike Attendees) since "On Behalf Of" must always resolve
 * to an internal `ownerUsername`.
 */
async function searchOnBehalf(event: { query: string }): Promise<void> {
    if (!canActOnBehalf.value) {
        return;
    }
    onBehalfError.value = null;
    try {
        onBehalfSuggestions.value = await accountsService.search({ q: event.query });
    } catch (err) {
        onBehalfSuggestions.value = [];
        // Surfaced so a failed search (permission mismatch, endpoint down, etc.) isn't a silent,
        // unexplained unresponsive field - see the "On Behalf Of" bug report.
        const detail = extractErrorMessage(err, 'Failed to search the account list.');
        onBehalfError.value = detail;
        toast.add({ severity: 'error', summary: 'Could not search accounts', detail, life: 5000 });
    }
}

function resetForm(): void {
    form.title = '';
    form.description = '';
    form.location = '';
    form.privateInfo = '';
    form.providerId = null;
    form.ownerUsername = authStore.username ?? '';
    form.startTime = props.initialRange?.start ?? null;
    form.endTime = props.initialRange?.end ?? null;
    selectedAttendees.value = [];
    // Defaults "On Behalf Of" back to the current user - `role` is unused by the payload,
    // only `username` matters, mirroring `form.ownerUsername`'s own default.
    onBehalfSelected.value = { username: authStore.username ?? '', email: authStore.email ?? '', role: authStore.role ?? AccountRole.UNKNOWN };
    onBehalfSuggestions.value = [];
    onBehalfError.value = null;
    error.value = null;
}

/** Keeps `form.ownerUsername` (the actual payload field) in sync with the single selected account object bound to the "On Behalf Of" `AutoComplete`. */
watch(onBehalfSelected, (selected) => {
    form.ownerUsername = selected?.username ?? authStore.username ?? '';
});

watch(
    () => props.visible,
    (visible) => {
        if (visible) {
            resetForm();
        }
    }
);

function close(): void {
    emit('update:visible', false);
}

async function submit(): Promise<void> {
    if (!form.title.trim() || !form.startTime || !form.endTime || !form.providerId || selectedAttendees.value.length === 0) {
        error.value = 'Please fill in the title, start/end time, provider and at least one attendee.';
        toast.add({ severity: 'error', summary: 'Missing information', detail: error.value, life: 4000 });
        return;
    }

    submitting.value = true;
    error.value = null;
    try {
        await conferencesStore.createEvent({
            title: form.title.trim(),
            description: form.description.trim(),
            startTime: form.startTime.getTime(),
            endTime: form.endTime.getTime(),
            providerId: form.providerId,
            location: form.location.trim(),
            privateInfo: form.privateInfo.trim(),
            ownerUsername: form.ownerUsername,
            participants: selectedAttendees.value.map((account) => account.email)
        });
        toast.add({ severity: 'success', summary: 'Event created', detail: `"${form.title.trim()}" was scheduled successfully.`, life: 3000 });
        emit('created');
        close();
    } catch (err) {
        const detail = extractErrorMessage(err, 'Failed to create the conference.');
        error.value = detail;
        toast.add({ severity: 'error', summary: 'Creation failed', detail, life: 5000 });
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Dialog :visible="visible" modal header="New Event" class="w-full md:w-[40rem]" @update:visible="emit('update:visible', $event)">
        <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
                <label for="event-title">Title</label>
                <InputText id="event-title" v-model="form.title" placeholder="Conference title" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="event-description">Description</label>
                <Textarea id="event-description" v-model="form.description" rows="2" auto-resize />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="event-start">Start</label>
                    <Calendar id="event-start" v-model="form.startTime" show-time hour-format="24" placeholder="Start date/time" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="event-end">End</label>
                    <Calendar id="event-end" v-model="form.endTime" show-time hour-format="24" placeholder="End date/time" />
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <label for="event-provider">Provider</label>
                <Select id="event-provider" v-model="form.providerId" :options="providerOptions" option-label="name" option-value="id" placeholder="Select a provider" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="event-location">Location</label>
                <InputText id="event-location" v-model="form.location" placeholder="Room / link / address" />
                <ConferenceMiniMap :location="form.location" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="event-attendees">Attendees</label>
                <AutoComplete
                    id="event-attendees"
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

            <div v-if="canActOnBehalf" class="flex flex-col gap-2">
                <label for="event-private-info">Special Info</label>
                <Textarea id="event-private-info" v-model="form.privateInfo" rows="2" auto-resize placeholder="Host password / sensitive join details" />
            </div>

            <div v-if="canActOnBehalf" class="flex flex-col gap-2">
                <label for="event-on-behalf">On Behalf Of</label>
                <AutoComplete
                    id="event-on-behalf"
                    ref="onBehalfAutoComplete"
                    v-model="onBehalfSelected"
                    force-selection
                    option-label="username"
                    :suggestions="onBehalfSuggestions"
                    :delay="300"
                    placeholder="Search a system user"
                    @complete="searchOnBehalf"
                >
                    <template #option="{ option }">{{ option.firstName }} {{ option.lastName }} ({{ option.username }}) - {{ option.email }}</template>
                </AutoComplete>
                <Message v-if="onBehalfError" severity="error" :closable="false">{{ onBehalfError }}</Message>
            </div>

            <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        </div>

        <template #footer>
            <Button label="Cancel" severity="secondary" text :disabled="submitting" @click="close" />
            <Button label="Create Event" :loading="submitting" @click="submit" />
        </template>
    </Dialog>
</template>
