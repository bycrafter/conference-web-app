<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarOptions, DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { useConferencesStore } from '@/features/conferences/stores/conferences.store';
import { useProvidersStore } from '@/features/providers/stores/providers.store';
import { useAuthStore } from '@/stores/authStore';
import { useConferencePermissions } from '@/features/conferences/composables/useConferencePermissions';
import ConferenceDetailDialog from '@/features/conferences/components/ConferenceDetailDialog.vue';
import CreateEventDialog from '@/features/conferences/components/CreateEventDialog.vue';
import { ConferenceStatus, type ConferenceDto } from '@/types/conference.types';
import { PermissionCode } from '@/types/auth.types';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const conferencesStore = useConferencesStore();
const providersStore = useProvidersStore();
const authStore = useAuthStore();
const { isRestrictedView, canEdit: canEditConference } = useConferencePermissions();
const toast = useToast();

/** `undefined` = "All Providers". */
const selectedProviderId = ref<string | undefined>(undefined);
const providerOptions = computed(() => [{ id: undefined, name: 'All Providers' }, ...providersStore.activeProviders]);

/** "Hide Cancelled" toggle - excludes CANCELLED/deleted events from the grid when enabled. Defaults to `true` per business requirement: cancelled events are hidden on initial load. */
const hideCancelled = ref(true);

const visibleRange = ref<{ start: number; end: number } | null>(null);
const selectedConference = ref<ConferenceDto | null>(null);
const detailDialogVisible = ref(false);
const createDialogVisible = ref(false);
/** Pre-fills the Create Event dialog's Start/End when the user drags a slot on the grid; `null` for the plain "New Event" button. */
const createDialogInitialRange = ref<{ start: Date; end: Date } | null>(null);

const canCreateEvent = computed(() => authStore.hasPermission(PermissionCode.CONFERENCE_CREATE_ALL, PermissionCode.CONFERENCE_CREATE_SELF));

const filteredEvents = computed<ConferenceDto[]>(() => {
    const byProvider = selectedProviderId.value ? conferencesStore.events.filter((event) => event.providerId === selectedProviderId.value) : conferencesStore.events;
    return hideCancelled.value ? byProvider.filter((event) => event.status !== ConferenceStatus.CANCELLED && !(event as ConferenceDto & { isDeleted?: boolean }).isDeleted) : byProvider;
});

/** Defensive against malformed/missing `startTime`/`endTime` (e.g. `0`, `null`, unparsable strings) - `Date#toISOString` throws `RangeError` on an invalid `Date`, which would otherwise crash this computed (and the whole calendar) on every reactive re-run. */
function toIsoStringOrNull(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * FullCalendar's `EventInput` shape. `extendedProps` carries the full original `ConferenceDto` so
 * `onEventClick` doesn't need to re-look it up in the store.
 *
 * Deliberately a `ref` + `watch` (deep, immediate) instead of a plain `computed`: FullCalendar's
 * Vue wrapper compares its `:events` prop by reference, and in some edge cases (nested mutations
 * from `upsertEvent`'s `splice`, provider-filter toggling, etc.) a `computed` re-run wasn't
 * reliably propagating to the calendar. Explicitly reassigning a `ref` on every relevant change
 * guarantees a fresh array reference is always passed down.
 */
const mappedEvents = ref<EventInput[]>([]);

/** Backend-masked (foreign) events arrive with `title: null` - never render that as the literal "undefined"/"null" string; fall back to a generic "Busy" label with the organizer instead. */
function resolveEventTitle(conference: ConferenceDto): string {
    const baseTitle = conference.title || `Busy - ${conference.organizerUsername}`;
    const starredTitle = conference.isStarred ? `★ ${baseTitle}` : baseTitle;
    return conference.status === ConferenceStatus.CANCELLED ? `[CANCELED] ${starredTitle}` : starredTitle;
}

/** Cancelled/deleted conferences MUST NOT render as normal active events - flag them so they get the danger palette + `event-cancelled` class below instead of being silently dropped from the grid. */
function isCancelledConference(conference: ConferenceDto): boolean {
    return conference.status === ConferenceStatus.CANCELLED;
}

function recomputeMappedEvents(): void {
    const next = filteredEvents.value
        .map((conference) => {
            const cancelled = isCancelledConference(conference);
            // A masked/restricted-view conference (`isRestrictedView`) never carries the full data
            // (`title`/`description`/`location`/`privateInfo` arrive `null`) required by the full-replace
            // `PATCH /v1/conferences/:id` - it must NEVER be draggable, even for a caller holding
            // `CONFERENCE_UPDATE_ALL`, or the drop handler would submit `null` fields and the backend
            // would reject the request with a 400.
            return {
                id: conference.id,
                title: resolveEventTitle(conference),
                start: toIsoStringOrNull(conference.startTime),
                end: toIsoStringOrNull(conference.endTime),
                editable: !cancelled && !isRestrictedView(conference) && canEditConference(conference),
                extendedProps: { ...conference },
                ...(cancelled && {
                    backgroundColor: '#ef4444',
                    borderColor: '#dc2626',
                    textColor: '#ffffff',
                    classNames: ['event-cancelled']
                })
            };
        })
        .filter((event): event is { id: string; title: string; start: string; end: string; editable: boolean; extendedProps: ConferenceDto } => event.start !== null && event.end !== null);

    mappedEvents.value = next;
}

watch(() => conferencesStore.events, recomputeMappedEvents, { deep: true, immediate: true });
watch(selectedProviderId, recomputeMappedEvents);
watch(hideCancelled, recomputeMappedEvents);

async function refetchRange(): Promise<void> {
    if (!visibleRange.value) {
        return;
    }
    await conferencesStore.fetchRange({
        startTime: visibleRange.value.start,
        endTime: visibleRange.value.end,
        providerId: selectedProviderId.value
    });
}

function onDatesSet(arg: DatesSetArg): void {
    visibleRange.value = { start: arg.start.getTime(), end: arg.end.getTime() };
    void refetchRange();
}

function onEventClick(arg: EventClickArg): void {
    const conference = (arg.event.extendedProps as ConferenceDto | undefined) ?? conferencesStore.events.find((event) => event.id === arg.event.id);
    if (!conference) {
        return;
    }
    selectedConference.value = conference;
    detailDialogVisible.value = true;
}

function onSelect(arg: DateSelectArg): void {
    if (!canCreateEvent.value) {
        return;
    }
    createDialogInitialRange.value = { start: arg.start, end: arg.end };
    createDialogVisible.value = true;
    arg.view.calendar.unselect();
}

/**
 * Drag-and-drop rescheduling. `editable` (set per-event in `recomputeMappedEvents`) already
 * gates WHICH events can be dragged, so this handler only has to persist the new time. The
 * backend's `PATCH /v1/conferences/:id` is a full replace (`UpdateConferencePayload`), so the
 * original `ConferenceDto` (carried in `extendedProps`) is reused for every field except the
 * new `start`/`end` supplied by FullCalendar. On failure `info.revert()` snaps the event back
 * to its pre-drag position - optimistic UI with a hard rollback on error.
 */
function onEventDrop(info: EventDropArg): void {
    try {
        const conference = info.event?.extendedProps as ConferenceDto | undefined;
        const start = info.event?.start;
        // Defensive guard: bail out (with a rollback) on anything malformed/incomplete - a masked
        // conference (null title/description/location), a missing id, or a drop that FullCalendar
        // didn't resolve a proper start date for. Sending any of this straight to the backend's
        // full-replace `PATCH /v1/conferences/:id` is exactly what produces the 400.
        if (!conference?.id || !start || conference.title == null || conference.description == null || conference.location == null || !conference.providerId) {
            info.revert();
            toast.add({ severity: 'error', summary: 'Reschedule failed', detail: 'This event cannot be rescheduled from the calendar.', life: 5000 });
            return;
        }

        // `info.event.end` is NOT reliable here - FullCalendar leaves it `null` whenever the event
        // was rendered without an explicit duration being re-derived (e.g. a plain move with no
        // resize), so deriving the new end straight from `info.event.end` silently breaks every
        // drag. Instead, preserve the conference's original duration and re-anchor it to the new
        // start using `info.delta`, which FullCalendar always provides on a drop.
        const durationMs = conference.endTime - conference.startTime;
        const newStartTime = start.getTime();
        const newEndTime = newStartTime + durationMs;

        void (async () => {
            try {
                await conferencesStore.updateEvent(conference.id, {
                    title: conference.title,
                    description: conference.description,
                    startTime: newStartTime,
                    endTime: newEndTime,
                    providerId: conference.providerId,
                    location: conference.location,
                    privateInfo: conference.privateInfo ?? '',
                    participants: conference.participants ?? []
                });
                toast.add({ severity: 'success', summary: 'Event rescheduled', detail: `"${conference.title}" was moved successfully.`, life: 3000 });
            } catch (err: any) {
                info.revert();
                const detail = err?.response?.data?.message ?? 'Failed to reschedule the conference.';
                toast.add({ severity: 'error', summary: 'Reschedule failed', detail, life: 5000 });
            }
        })();
    } catch {
        info.revert();
        toast.add({ severity: 'error', summary: 'Reschedule failed', detail: 'An unexpected error occurred while rescheduling the event.', life: 5000 });
    }
}

function openCreateDialog(): void {
    createDialogInitialRange.value = null;
    createDialogVisible.value = true;
}

/** Deep-links from `MiniCalendarCard` (Dashboard) land here with `?date=` - jump the grid straight to that day. */
const initialDate = typeof route.query.date === 'string' ? new Date(route.query.date) : undefined;

/**
 * The `@fullcalendar/vue3` wrapper only recognizes a single `options` prop (see its source:
 * `props: { options: Object }`) - there is no separate `events` prop it reacts to, so `events`
 * MUST live inside this object. It also deep-watches `options` and calls `calendar.resetOptions(...)`
 * on change, so including `mappedEvents.value` here (a plain `ref`, reassigned on every relevant
 * store change) is the most robust way to keep the calendar in sync with Vue 3 reactivity.
 */
const calendarOptions = computed<CalendarOptions>(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    initialDate,
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    height: 'auto',
    selectable: canCreateEvent.value,
    events: mappedEvents.value,
    datesSet: onDatesSet,
    eventClick: onEventClick,
    eventDrop: onEventDrop,
    select: onSelect
}));

function onEventCreated(): void {
    void refetchRange();
}

watch(selectedProviderId, refetchRange);

onMounted(async () => {
    await providersStore.fetchActive();
    conferencesStore.connectStream();
});

onUnmounted(() => {
    conferencesStore.disconnectStream();
});
</script>

<template>
    <Card>
        <template #title>
            <div class="flex flex-wrap items-center justify-between gap-4">
                <span>Calendar</span>
                <div class="flex flex-wrap items-center gap-4">
                    <Select v-model="selectedProviderId" :options="providerOptions" option-label="name" option-value="id" placeholder="All Providers" class="w-60" />
                    <div class="flex items-center gap-2">
                        <Checkbox v-model="hideCancelled" input-id="hide-cancelled" :binary="true" />
                        <label for="hide-cancelled" class="cursor-pointer select-none">Hide Cancelled</label>
                    </div>
                    <Button v-if="canCreateEvent" label="New Event" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>
        </template>
        <template #content>
            <Message v-if="conferencesStore.error" severity="error" :closable="false" class="mb-4">{{ conferencesStore.error }}</Message>
            <div class="bycrafter-calendar">
                <FullCalendar :options="calendarOptions" />
            </div>
        </template>
    </Card>

    <ConferenceDetailDialog v-model:visible="detailDialogVisible" :conference="selectedConference" @updated="onEventCreated" />
    <CreateEventDialog v-model:visible="createDialogVisible" :initial-range="createDialogInitialRange" @created="onEventCreated" />
</template>

<style scoped>
/*
 * Forces FullCalendar's CSS variables onto Sakai's native theme tokens so it
 * inherits Light/Dark mode automatically instead of shipping its own palette.
 */
.bycrafter-calendar :deep(.fc) {
    --fc-border-color: var(--surface-border);
    --fc-page-bg-color: transparent;
    --fc-neutral-bg-color: var(--surface-card);
    --fc-list-event-hover-bg-color: var(--surface-hover);
    --fc-today-bg-color: color-mix(in srgb, var(--primary-color) 8%, transparent);
    --fc-event-bg-color: var(--primary-color);
    --fc-event-border-color: var(--primary-color);
    --fc-event-text-color: var(--primary-contrast-color);
    color: var(--text-color);
}

.bycrafter-calendar :deep(.fc .fc-button) {
    background: var(--surface-card);
    border-color: var(--surface-border);
    color: var(--text-color);
}

.bycrafter-calendar :deep(.fc .fc-button-primary:not(:disabled).fc-button-active),
.bycrafter-calendar :deep(.fc .fc-button-primary:not(:disabled):active) {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--primary-contrast-color);
}

/* Cancelled/deleted conferences: forced red/danger palette (set inline on the event) + strikethrough so they can never be mistaken for a normal active event. */
.bycrafter-calendar :deep(.fc .event-cancelled .fc-event-title),
.bycrafter-calendar :deep(.fc .event-cancelled .fc-list-event-title) {
    text-decoration: line-through;
    font-weight: bold;
}
</style>
