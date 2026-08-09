import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { useConferenceSearch } from '@/features/search/composables/useConferenceSearch';
import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';
import { ConferenceStatus } from '@/types/conference.types';
import type { RawConferenceDto } from '@/types/conference.types';

/** DB-seeded role -> permissions fixture, mirrors `V2__insert_default_rbac_data.sql` (`account-manager`). */
const ROLE_PERMISSIONS_FIXTURE: Record<'ADMIN' | 'ORGANIZER' | 'STANDARD_ACCOUNT', PermissionCode[]> = {
    ADMIN: (Object.values(PermissionCode) as PermissionCode[]).filter(
        (code) => code !== PermissionCode.CONFERENCE_VIEW_LIMITED && code !== PermissionCode.REPORT_VIEW_LIMITED
    ),
    ORGANIZER: [
        PermissionCode.ACCOUNT_MANAGE_SELF,
        PermissionCode.PROVIDER_VIEW_ALL,
        PermissionCode.CONFERENCE_CREATE_ALL,
        PermissionCode.CONFERENCE_CREATE_SELF,
        PermissionCode.CONFERENCE_VIEW_ALL,
        PermissionCode.CONFERENCE_VIEW_SELF,
        PermissionCode.CONFERENCE_UPDATE_ALL,
        PermissionCode.CONFERENCE_UPDATE_SELF,
        PermissionCode.CONFERENCE_DELETE_ALL,
        PermissionCode.CONFERENCE_DELETE_SELF,
        PermissionCode.SLOT_REQUEST_CREATE,
        PermissionCode.SLOT_REQUEST_MANAGE_ALL,
        PermissionCode.SLOT_REQUEST_MANAGE_SELF,
        PermissionCode.REPORT_VIEW_LIMITED
    ],
    STANDARD_ACCOUNT: [
        PermissionCode.ACCOUNT_MANAGE_SELF,
        PermissionCode.PROVIDER_VIEW_ALL,
        PermissionCode.CONFERENCE_CREATE_SELF,
        PermissionCode.CONFERENCE_VIEW_LIMITED,
        PermissionCode.CONFERENCE_VIEW_SELF,
        PermissionCode.CONFERENCE_UPDATE_SELF,
        PermissionCode.CONFERENCE_DELETE_SELF,
        PermissionCode.SLOT_REQUEST_CREATE,
        PermissionCode.SLOT_REQUEST_MANAGE_SELF,
        PermissionCode.REPORT_VIEW_LIMITED
    ]
};

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

function buildRawConference(overrides: Partial<RawConferenceDto>): RawConferenceDto {
    return {
        id: 'evt-1',
        title: 'Sprint Review',
        description: '',
        startTime: Date.now(),
        endTime: Date.now() + 60 * 60 * 1000,
        providerId: 'provider-1',
        location: '',
        privateInfo: '',
        ownerUsername: 'other.user',
        organizerUsername: 'other.user',
        status: ConferenceStatus.SCHEDULED,
        joinLink: '',
        participants: [],
        isStarred: false,
        ...overrides
    };
}

async function loginAs(role: 'ADMIN' | 'ORGANIZER' | 'STANDARD_ACCOUNT', username: string): Promise<void> {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { token: 'token', role, username, permissions: ROLE_PERMISSIONS_FIXTURE[role] } });
    const authStore = useAuthStore();
    await authStore.login({ username, password: 'secret' });
}

describe('useConferenceSearch', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('givenUserWithConferenceViewAll_whenSearch_thenDoesNotRestrictToOwnEvents', async () => {
        await loginAs('ADMIN', 'admin.user');
        const someoneElsesEvent = buildRawConference({ id: 'evt-1', ownerUsername: 'other.user', organizerUsername: 'other.user', participants: [] });
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: [someoneElsesEvent], totalElements: 1, totalPages: 1, page: 0, size: 10 } });

        const { search, items, canSearchAllEvents } = useConferenceSearch();
        await search(0);

        expect(canSearchAllEvents.value).toBe(true);
        expect(httpClient.get).toHaveBeenCalledWith('/conferences', expect.objectContaining({ params: expect.objectContaining({ restrictToOwn: 'false' }) }));
        expect(items.value).toHaveLength(1);
        expect(items.value[0].id).toBe('evt-1');
    });

    it('givenUserWithoutConferenceViewAll_whenSearch_thenRequestsServerSideRestrictToOwnScope', async () => {
        await loginAs('STANDARD_ACCOUNT', 'jdoe');
        const ownedEvent = buildRawConference({ id: 'evt-owned', ownerUsername: 'jdoe', organizerUsername: 'jdoe', participants: [] });
        // Server enforces the scope - the mock only returns what a properly-scoped BFF response would contain.
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: [ownedEvent], totalElements: 1, totalPages: 1, page: 0, size: 10 } });

        const { search, items, canSearchAllEvents } = useConferenceSearch();
        await search(0);

        expect(canSearchAllEvents.value).toBe(false);
        expect(httpClient.get).toHaveBeenCalledWith('/conferences', expect.objectContaining({ params: expect.objectContaining({ restrictToOwn: 'true' }) }));
        expect(items.value).toHaveLength(1);
        expect(items.value[0].id).toBe('evt-owned');
    });

    it('givenEventsAcrossMultipleDays_whenSearchResolves_thenGroupsByDayInChronologicalOrder', async () => {
        await loginAs('ADMIN', 'admin.user');
        const dayAfterTomorrow = Date.now() + 2 * 24 * 60 * 60 * 1000;
        const eventLater = buildRawConference({ id: 'evt-later', startTime: dayAfterTomorrow, endTime: dayAfterTomorrow + 3600000 });
        const eventToday = buildRawConference({ id: 'evt-today', startTime: Date.now(), endTime: Date.now() + 3600000 });
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: [eventLater, eventToday], totalElements: 2, totalPages: 1, page: 0, size: 10 } });

        const { search, groups } = useConferenceSearch();
        await search(0);

        expect(groups.value).toHaveLength(2);
        expect(groups.value[0].label).toBe('Today');
        expect(groups.value[0].events[0].id).toBe('evt-today');
        expect(groups.value[1].events[0].id).toBe('evt-later');
    });

    it('givenBlankQuery_whenSuggest_thenSkipsRequestAndReturnsEmpty', async () => {
        await loginAs('ADMIN', 'admin.user');
        const { suggest } = useConferenceSearch();

        const result = await suggest('   ');

        expect(result).toEqual([]);
        expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('givenUserWithoutConferenceViewAll_whenSuggest_thenAppliesSameRbacScopeAsSearch', async () => {
        await loginAs('STANDARD_ACCOUNT', 'jdoe');
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: [], totalElements: 0, totalPages: 0, page: 0, size: 5 } });

        const { suggest } = useConferenceSearch();
        const result = await suggest('sprint');

        expect(httpClient.get).toHaveBeenCalledWith('/conferences', expect.objectContaining({ params: expect.objectContaining({ restrictToOwn: 'true' }) }));
        expect(result).toEqual([]);
    });

    it('givenBffFailure_whenSearch_thenSetsErrorAndClearsItems', async () => {
        await loginAs('ADMIN', 'admin.user');
        vi.mocked(httpClient.get).mockRejectedValueOnce(new Error('network error'));

        const { search, items, error } = useConferenceSearch();
        await search(0);

        expect(error.value).toBe('Failed to search conferences.');
        expect(items.value).toEqual([]);
    });
});
