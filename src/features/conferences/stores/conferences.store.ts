import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { conferencesService, buildConferenceStreamUrl } from '@/features/conferences/services/conferences.service';
import { extractErrorMessage } from '@/utils/httpError';
import { normalizeConferenceEvent, ConferenceEventType, type ConferenceDto, type CreateConferencePayload, type UpdateConferencePayload, type RawConferenceEvent, type SearchConferenceParams } from '@/types/conference.types';

interface ConferencesState {
    events: ConferenceDto[];
    /** Backs the Dashboard's Starred Events card - independent from `events` (the Calendar's range-scoped grid). */
    starredEvents: ConferenceDto[];
    starredLoading: boolean;
    loading: boolean;
    error: string | null;
    /** Not part of Pinia's reactive state on purpose - an `EventSource` instance isn't serializable/reactive-friendly. */
    eventSource: EventSource | null;
}

/**
 * Calendar grid data + real-time updates. `fetchRange` loads the initial
 * page for the visible calendar window; `connectStream` opens a native
 * `EventSource` against `GET /v1/conferences/stream` (public SSE,
 * `ConferencesController`) and upserts/removes events in-place so
 * FullCalendar reflects changes without a refetch.
 */
export const useConferencesStore = defineStore('conferences', {
    state: (): ConferencesState => ({
        events: [],
        starredEvents: [],
        starredLoading: false,
        loading: false,
        error: null,
        eventSource: null
    }),
    actions: {
        async fetchRange(params: SearchConferenceParams): Promise<void> {
            this.loading = true;
            this.error = null;
            try {
                const response = await conferencesService.search({ ...params, size: params.size ?? 500 });
                this.events = response.items;
            } catch (err) {
                this.error = extractErrorMessage(err, 'Failed to load conferences.');
            } finally {
                this.loading = false;
            }
        },
        upsertEvent(conference: ConferenceDto): void {
            const index = this.events.findIndex((event) => event.id === conference.id);
            if (index === -1) {
                this.events.push(conference);
            } else {
                this.events.splice(index, 1, conference);
            }
        },
        removeEvent(id: string): void {
            this.events = this.events.filter((event) => event.id !== id);
        },
        async createEvent(payload: CreateConferencePayload): Promise<ConferenceDto> {
            const conference = await conferencesService.create(payload);
            this.upsertEvent(conference);
            return conference;
        },
        async updateEvent(id: string, payload: UpdateConferencePayload): Promise<ConferenceDto> {
            const conference = await conferencesService.update(id, payload);
            this.upsertEvent(conference);
            return conference;
        },
        /** Cancellation ("2.3.1.5. Video Konferans İptali"). Removes the event from `events` immediately for the acting user - mirrors what `connectStream`'s CANCELLED handler does for OTHER connected clients, so the calendar reflects the cancellation instantly without waiting on the SSE round-trip. */
        async cancelEvent(id: string): Promise<ConferenceDto> {
            const conference = await conferencesService.cancel(id);
            this.removeEvent(id);
            return conference;
        },
        /** Backs the Dashboard's Starred Events card. Independent loading/error-free from the Calendar's `fetchRange`. */
        async fetchStarred(size = 5): Promise<void> {
            this.starredLoading = true;
            try {
                const response = await conferencesService.search({ filterByStarred: true, size });
                this.starredEvents = response.items;
            } catch {
                this.starredEvents = [];
            } finally {
                this.starredLoading = false;
            }
        },
        /** Replaces a conference snapshot and keeps `starredEvents` in sync in-place - shared by `toggleStar`'s optimistic update and its rollback. */
        syncStarredList(conference: ConferenceDto): void {
            if (conference.isStarred) {
                const index = this.starredEvents.findIndex((event) => event.id === conference.id);
                if (index === -1) {
                    this.starredEvents.unshift(conference);
                } else {
                    this.starredEvents.splice(index, 1, conference);
                }
            } else {
                this.starredEvents = this.starredEvents.filter((event) => event.id !== conference.id);
            }
        },
        /**
         * Toggles star/unstar for a conference. Optimistically flips `isStarred` in both `events` and
         * `starredEvents` immediately - every store-bound view (Calendar, Search, Dashboard, detail
         * dialog) reflects the click instantly, without waiting on the API round-trip. On failure the
         * optimistic mutation is rolled back and the error is rethrown so the caller can surface a toast.
         */
        async toggleStar(conference: ConferenceDto): Promise<void> {
            const optimistic: ConferenceDto = { ...conference, isStarred: !conference.isStarred };
            this.upsertEvent(optimistic);
            this.syncStarredList(optimistic);

            try {
                const updated = optimistic.isStarred ? await conferencesService.star(conference.id) : await conferencesService.unstar(conference.id);
                this.upsertEvent(updated);
                this.syncStarredList(updated);
            } catch (err) {
                this.upsertEvent(conference);
                this.syncStarredList(conference);
                throw err;
            }
        },
        connectStream(): void {
            if (this.eventSource) {
                return;
            }
            this.eventSource = markRaw(new EventSource(buildConferenceStreamUrl()));
            this.eventSource.onmessage = (message: MessageEvent<string>) => {
                const raw = JSON.parse(message.data) as RawConferenceEvent;
                const event = normalizeConferenceEvent(raw);
                if (!event.conference) {
                    return;
                }
                if (event.type === ConferenceEventType.CANCELLED) {
                    this.removeEvent(event.conference.id);
                } else {
                    this.upsertEvent(event.conference);
                }
            };
            // Best-effort reconnection is handled natively by `EventSource`; errors are swallowed
            // so a transient network blip never surfaces as an unhandled app error.
            this.eventSource.onerror = () => undefined;
        },
        disconnectStream(): void {
            this.eventSource?.close();
            this.eventSource = null;
        }
    }
});
