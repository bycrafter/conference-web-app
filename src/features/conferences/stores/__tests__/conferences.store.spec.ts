import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConferencesStore } from '@/features/conferences/stores/conferences.store';
import { conferencesService } from '@/features/conferences/services/conferences.service';
import { ConferenceStatus, type ConferenceDto } from '@/types/conference.types';

vi.mock('@/features/conferences/services/conferences.service', () => ({
    conferencesService: {
        search: vi.fn(),
        star: vi.fn(),
        unstar: vi.fn(),
        update: vi.fn()
    },
    buildConferenceStreamUrl: vi.fn(() => 'http://localhost/v1/conferences/stream')
}));

function buildConference(overrides: Partial<ConferenceDto> = {}): ConferenceDto {
    return {
        id: 'conf-1',
        title: 'Sprint Review',
        description: '',
        startTime: Date.now(),
        endTime: Date.now() + 3_600_000,
        providerId: 'provider-1',
        location: '',
        privateInfo: '',
        ownerUsername: 'jdoe',
        organizerUsername: 'jdoe',
        status: ConferenceStatus.SCHEDULED,
        joinLink: '',
        participants: [],
        isStarred: false,
        ...overrides
    };
}

describe('conferencesStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('givenSearchResults_whenFetchRange_thenPopulatesEvents', async () => {
        const conference = buildConference();
        vi.mocked(conferencesService.search).mockResolvedValueOnce({ items: [conference], totalElements: 1, totalPages: 1, page: 0, size: 500 });
        const store = useConferencesStore();

        await store.fetchRange({ startTime: 0, endTime: 1 });

        expect(store.events).toEqual([conference]);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
    });

    it('givenSearchFails_whenFetchRange_thenSetsErrorAndClearsLoading', async () => {
        vi.mocked(conferencesService.search).mockRejectedValueOnce(new Error('network error'));
        const store = useConferencesStore();

        await store.fetchRange({ startTime: 0, endTime: 1 });

        expect(store.error).toBe('Failed to load conferences.');
        expect(store.loading).toBe(false);
    });

    it('givenUnstarredConference_whenToggleStar_thenCallsStarAndUpdatesEventsAndStarredList', async () => {
        const conference = buildConference({ isStarred: false });
        const starred = { ...conference, isStarred: true };
        vi.mocked(conferencesService.star).mockResolvedValueOnce(starred);
        const store = useConferencesStore();
        store.events = [conference];

        await store.toggleStar(conference);

        expect(conferencesService.star).toHaveBeenCalledWith('conf-1');
        expect(store.events[0].isStarred).toBe(true);
        expect(store.starredEvents).toEqual([starred]);
    });

    it('givenStarredConference_whenToggleStar_thenCallsUnstarAndRemovesFromStarredList', async () => {
        const conference = buildConference({ isStarred: true });
        const unstarred = { ...conference, isStarred: false };
        vi.mocked(conferencesService.unstar).mockResolvedValueOnce(unstarred);
        const store = useConferencesStore();
        store.events = [conference];
        store.starredEvents = [conference];

        await store.toggleStar(conference);

        expect(conferencesService.unstar).toHaveBeenCalledWith('conf-1');
        expect(store.starredEvents).toHaveLength(0);
    });

    it('givenUnstarredConference_whenToggleStarCalled_thenFlipsIsStarredOptimisticallyBeforeApiResolves', async () => {
        const conference = buildConference({ isStarred: false });
        let resolveStar: (value: ConferenceDto) => void = () => undefined;
        vi.mocked(conferencesService.star).mockReturnValueOnce(
            new Promise((resolve) => {
                resolveStar = resolve;
            })
        );
        const store = useConferencesStore();
        store.events = [conference];

        const pending = store.toggleStar(conference);

        // Before the API call resolves, the store's own copy must already reflect the click.
        expect(store.events[0].isStarred).toBe(true);
        expect(store.starredEvents[0]?.isStarred).toBe(true);

        resolveStar({ ...conference, isStarred: true });
        await pending;
    });

    it('givenApiCallFails_whenToggleStar_thenRevertsOptimisticUpdateAndRethrows', async () => {
        const conference = buildConference({ isStarred: false });
        vi.mocked(conferencesService.star).mockRejectedValueOnce(new Error('network error'));
        const store = useConferencesStore();
        store.events = [conference];

        await expect(store.toggleStar(conference)).rejects.toThrow('network error');

        expect(store.events[0].isStarred).toBe(false);
        expect(store.starredEvents).toHaveLength(0);
    });

    it('givenCancelledEvent_whenRemoveEvent_thenFiltersItOutOfEvents', () => {
        const conference = buildConference();
        const store = useConferencesStore();
        store.events = [conference];

        store.removeEvent(conference.id);

        expect(store.events).toHaveLength(0);
    });

    it('givenExistingConference_whenUpdateEvent_thenCallsServiceAndUpsertsIntoEvents', async () => {
        const conference = buildConference();
        const updated = { ...conference, title: 'Renamed Sprint Review' };
        vi.mocked(conferencesService.update).mockResolvedValueOnce(updated);
        const store = useConferencesStore();
        store.events = [conference];

        const result = await store.updateEvent(conference.id, {
            title: 'Renamed Sprint Review',
            description: '',
            startTime: conference.startTime,
            endTime: conference.endTime,
            providerId: conference.providerId,
            location: '',
            privateInfo: '',
            participants: []
        });

        expect(conferencesService.update).toHaveBeenCalledWith('conf-1', expect.objectContaining({ title: 'Renamed Sprint Review' }));
        expect(result).toEqual(updated);
        expect(store.events[0].title).toBe('Renamed Sprint Review');
    });
});
