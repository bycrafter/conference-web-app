import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { useParticipantResolver } from '@/composables/useParticipantResolver';

vi.mock('@/services/httpClient', () => ({
    default: {
        post: vi.fn()
    }
}));

describe('useParticipantResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('givenNoParticipants_whenResolve_thenSkipsTheRequestAndLeavesNamesEmpty', async () => {
        const { resolve, displayNameFor } = useParticipantResolver();

        await resolve([]);

        expect(httpClient.post).not.toHaveBeenCalled();
        expect(displayNameFor('nobody@test.com')).toBe('nobody@test.com');
    });

    it('givenInternalAndExternalParticipants_whenResolve_thenInternalUsersShowNamesAndGuestsFallBackToEmail', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: [{ username: 'jdoe', email: 'jdoe@bycrafter.com', role: 'STANDARD_ACCOUNT', firstName: 'Jane', lastName: 'Doe' }]
        });
        const { resolve, displayNameFor } = useParticipantResolver();

        await resolve(['jdoe@bycrafter.com', 'guest@external.com']);

        expect(httpClient.post).toHaveBeenCalledWith('/accounts/resolve-emails', { emails: ['jdoe@bycrafter.com', 'guest@external.com'] });
        expect(displayNameFor('jdoe@bycrafter.com')).toBe('Jane Doe');
        expect(displayNameFor('guest@external.com')).toBe('guest@external.com');
    });

    it('givenResolveFailure_whenResolve_thenFallsBackToRawEmailsWithoutThrowing', async () => {
        vi.mocked(httpClient.post).mockRejectedValueOnce(new Error('network down'));
        const { resolve, displayNameFor } = useParticipantResolver();

        await expect(resolve(['jdoe@bycrafter.com'])).resolves.toBeUndefined();

        expect(displayNameFor('jdoe@bycrafter.com')).toBe('jdoe@bycrafter.com');
    });
});
