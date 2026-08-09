import { computed, ref } from 'vue';
import { conferencesService } from '@/features/conferences/services/conferences.service';
import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';
import type { ConferenceDto } from '@/types/conference.types';

export interface ConferenceSearchGroup {
    label: string;
    events: ConferenceDto[];
}

const DEFAULT_PAGE_SIZE = 10;

/**
 * Shared search/pagination/day-grouping logic for the global conference
 * search (Search view + Topbar typeahead). Encapsulates the
 * Permission-based RBAC restriction from `2.3.1.3. Video Konferans Arama`:
 * only accounts holding `CONFERENCE_VIEW_ALL` may search across every
 * event - everyone else passes `restrictToOwn: true` so the BFF/conference
 * service excludes (not just masks) anything they don't own, organize, or
 * attend. This is a real server-side boundary now (see `restrictToOwn` on
 * `ConferenceSearchCriteria` in `conference-manager`), unlike the Calendar
 * grid which deliberately keeps the default masked-but-visible behavior.
 */
export function useConferenceSearch(pageSize: number = DEFAULT_PAGE_SIZE) {
    const authStore = useAuthStore();

    const keyword = ref('');
    const items = ref<ConferenceDto[]>([]);
    const totalElements = ref(0);
    const page = ref(0);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const hasSearched = ref(false);

    /** `true` when the current account may search across every event in the system. */
    const canSearchAllEvents = computed(() => authStore.hasPermission(PermissionCode.CONFERENCE_VIEW_ALL));

    /** Groups the current page's results by calendar day, labeling Today/Tomorrow explicitly. */
    const groups = computed<ConferenceSearchGroup[]>(() => {
        const byDay = new Map<string, ConferenceDto[]>();
        for (const event of items.value) {
            const key = new Date(event.startTime).toDateString();
            const bucket = byDay.get(key) ?? [];
            bucket.push(event);
            byDay.set(key, bucket);
        }

        const today = new Date().toDateString();
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();

        return Array.from(byDay.entries())
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([dateKey, events]) => ({
                label: dateKey === today ? 'Today' : dateKey === tomorrow ? 'Tomorrow' : dateKey,
                events: events.sort((a, b) => a.startTime - b.startTime)
            }));
    });

    async function search(targetPage = 0): Promise<void> {
        loading.value = true;
        error.value = null;
        hasSearched.value = true;
        try {
            const response = await conferencesService.search({
                keyword: keyword.value.trim() || undefined,
                restrictToOwn: !canSearchAllEvents.value,
                page: targetPage,
                size: pageSize
            });
            items.value = response.items;
            totalElements.value = response.totalElements;
            page.value = response.page;
        } catch {
            error.value = 'Failed to search conferences.';
            items.value = [];
        } finally {
            loading.value = false;
        }
    }

    /** Lightweight, unpaginated lookup for typeahead suggestions (e.g. Topbar `AutoComplete`). */
    async function suggest(query: string, limit = 5): Promise<ConferenceDto[]> {
        const trimmed = query.trim();
        if (!trimmed) {
            return [];
        }
        try {
            const response = await conferencesService.search({ keyword: trimmed, restrictToOwn: !canSearchAllEvents.value, page: 0, size: limit });
            return response.items;
        } catch {
            return [];
        }
    }

    return {
        keyword,
        items,
        totalElements,
        page,
        loading,
        error,
        hasSearched,
        canSearchAllEvents,
        groups,
        search,
        suggest
    };
}
