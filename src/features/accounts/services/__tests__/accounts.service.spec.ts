import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { accountsService } from '@/features/accounts/services/accounts.service';
import { AccountRole } from '@/types/auth.types';

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

describe('accountsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('givenNoFilters_whenSearch_thenRequestsAllAccountsAndNormalizesRoles', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({
            data: [
                { username: 'jdoe', email: 'jdoe@test.com', role: 'STANDARD_ACCOUNT' },
                { username: 'admin', email: 'admin@test.com', role: 'ADMIN' }
            ]
        });

        const result = await accountsService.search({});

        expect(httpClient.get).toHaveBeenCalledWith('/accounts/search', { params: {} });
        expect(result).toEqual([
            { username: 'jdoe', email: 'jdoe@test.com', role: AccountRole.STANDARD_ACCOUNT },
            { username: 'admin', email: 'admin@test.com', role: AccountRole.ADMIN }
        ]);
    });

    it('givenTextQuery_whenSearch_thenForwardsItAsQueryParam', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: [] });

        await accountsService.search({ q: 'jdoe', size: 50 });

        expect(httpClient.get).toHaveBeenCalledWith('/accounts/search', {
            params: { q: 'jdoe', size: 50 }
        });
    });

    it('givenNoEmails_whenResolveByEmails_thenSkipsTheRequestAndReturnsEmptyArray', async () => {
        const result = await accountsService.resolveByEmails([]);

        expect(result).toEqual([]);
        expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('givenParticipantEmails_whenResolveByEmails_thenReturnsOnlyMatchingAccountsNormalized', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: [{ username: 'jdoe', email: 'jdoe@test.com', role: 'STANDARD_ACCOUNT', firstName: 'Jane', lastName: 'Doe' }]
        });

        const result = await accountsService.resolveByEmails(['jdoe@test.com', 'guest@external.com']);

        expect(httpClient.post).toHaveBeenCalledWith('/accounts/resolve-emails', { emails: ['jdoe@test.com', 'guest@external.com'] });
        expect(result).toEqual([{ username: 'jdoe', email: 'jdoe@test.com', role: AccountRole.STANDARD_ACCOUNT, firstName: 'Jane', lastName: 'Doe' }]);
    });
});
