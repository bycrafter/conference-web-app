import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { useAuthStore } from '@/stores/authStore';
import { useConferencePermissions } from '@/features/conferences/composables/useConferencePermissions';
import { PermissionCode } from '@/types/auth.types';
import { ConferenceStatus, type ConferenceDto } from '@/types/conference.types';

vi.mock('@/services/httpClient', () => ({
    default: {
        post: vi.fn()
    }
}));

function buildConference(overrides: Partial<ConferenceDto> = {}): ConferenceDto {
    return {
        id: 'conf-1',
        title: 'Sprint Review',
        description: 'Quarterly review meeting',
        startTime: new Date('2026-01-01T10:00:00Z').getTime(),
        endTime: new Date('2026-01-01T11:00:00Z').getTime(),
        providerId: 'provider-1',
        location: 'Building A',
        privateInfo: 'Host password: 1234',
        ownerUsername: 'other.user',
        organizerUsername: 'other.user',
        status: ConferenceStatus.SCHEDULED,
        joinLink: 'https://zoom.example/1',
        participants: ['a@test.com', 'b@test.com'],
        isStarred: false,
        ...overrides
    };
}

/** Shape the BFF actually returns for a masked (foreign) conference - see `ConferenceMapper#mask`. */
function buildMaskedConference(overrides: Partial<ConferenceDto> = {}): ConferenceDto {
    return buildConference({
        title: null as unknown as string,
        description: null as unknown as string,
        location: null as unknown as string,
        privateInfo: null as unknown as string,
        joinLink: null as unknown as string,
        providerId: null as unknown as string,
        participants: [],
        ...overrides
    });
}

async function loginAs(username: string, permissions: PermissionCode[], email = `${username}@test.com`): Promise<void> {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { token: 'token', role: 'ORGANIZER', username, email, permissions } });
    const authStore = useAuthStore();
    await authStore.login({ username, password: 'secret' });
}

describe('useConferencePermissions', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('givenUpdateAllButNotViewAll_whenConferenceIsMasked_thenCanEditIsFalse', async () => {
        // Reproduces the exact 400 Bad Request bug: a caller holding `CONFERENCE_UPDATE_ALL`
        // without `CONFERENCE_VIEW_ALL` must NOT be allowed to edit/drag a masked (null-field)
        // conference they don't own, since the payload required for a full PATCH isn't available.
        await loginAs('privileged.editor', [PermissionCode.CONFERENCE_UPDATE_ALL]);
        const maskedConference = buildMaskedConference();

        const { canEdit, isRestrictedView } = useConferencePermissions();

        expect(isRestrictedView(maskedConference)).toBe(true);
        expect(canEdit(maskedConference)).toBe(false);
    });

    it('givenViewAllAndUpdateAll_whenConferenceIsMasked_thenCanEditIsTrue', async () => {
        // With full `VIEW_ALL` access the conference is never masked in the first place, so the
        // full data is genuinely available and editing is safe.
        await loginAs('admin.user', [PermissionCode.CONFERENCE_VIEW_ALL, PermissionCode.CONFERENCE_UPDATE_ALL]);
        const conference = buildConference();

        const { canEdit, isRestrictedView } = useConferencePermissions();

        expect(isRestrictedView(conference)).toBe(false);
        expect(canEdit(conference)).toBe(true);
    });

    it('givenOwnConferenceAndUpdateSelf_whenNotMasked_thenCanEditIsTrue', async () => {
        await loginAs('jdoe', [PermissionCode.CONFERENCE_UPDATE_SELF, PermissionCode.CONFERENCE_VIEW_SELF]);
        const conference = buildConference({ ownerUsername: 'jdoe', organizerUsername: 'jdoe' });

        const { canEdit, isRestrictedView } = useConferencePermissions();

        expect(isRestrictedView(conference)).toBe(false);
        expect(canEdit(conference)).toBe(true);
    });

    it('givenNoRelationOrPermission_whenViewingOthersConference_thenCanEditIsFalse', async () => {
        await loginAs('jdoe', [PermissionCode.CONFERENCE_VIEW_SELF]);
        const maskedConference = buildMaskedConference();

        const { canEdit } = useConferencePermissions();

        expect(canEdit(maskedConference)).toBe(false);
    });

    it('givenDeleteAllPermission_whenCheckingCanDelete_thenReturnsTrueRegardlessOfOwnership', async () => {
        await loginAs('admin.user', [PermissionCode.CONFERENCE_DELETE_ALL]);
        const conference = buildConference();

        const { canDelete } = useConferencePermissions();

        expect(canDelete(conference)).toBe(true);
    });
});
