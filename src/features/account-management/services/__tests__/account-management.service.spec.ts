import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { accountManagementService } from '@/features/account-management/services/account-management.service';
import { AccountRole, AccountStatus, type CreateAccountPayload, type UpdateAccountPayload } from '@/types/account.types';

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn()
    }
}));

function buildCreatePayload(overrides: Partial<CreateAccountPayload> = {}): CreateAccountPayload {
    return {
        username: 'jdoe',
        email: 'jdoe@bycrafter.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: AccountRole.STANDARD_ACCOUNT,
        ...overrides
    };
}

describe('accountManagementService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('givenFilters_whenList_thenForwardsThemAsQueryParamsAndNormalizesResult', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({
            data: {
                items: [{ id: '1', username: 'jdoe', email: 'jdoe@bycrafter.com', role: 'ADMIN', firstName: 'Jane', lastName: 'Doe' }],
                totalElements: 1,
                totalPages: 1,
                page: 0,
                size: 10
            }
        });

        const result = await accountManagementService.list({ username: 'jdoe', page: 0, pageSize: 10 });

        expect(httpClient.get).toHaveBeenCalledWith('/accounts/list', { params: { username: 'jdoe', page: 0, pageSize: 10 } });
        expect(result.items[0].role).toBe(AccountRole.ADMIN);
        expect(result.totalElements).toBe(1);
    });

    it('givenEmptyBffResponse_whenList_thenResolvesToEmptyPageInsteadOfThrowing', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: null });

        const result = await accountManagementService.list({});

        expect(result).toEqual({ items: [], totalElements: 0, totalPages: 0, page: 0, size: 0 });
    });

    it('givenProtobufLongObjectTotalElements_whenList_thenNormalizesToPlainNumber', async () => {
        // Regression test: the BFF/gRPC hop can serialize `totalElements` (and the other
        // pagination counters) as a protobuf `{ low, high, unsigned }` Long object instead
        // of a plain number, which fails Vue's `Number` prop type check on `<Paginator>`.
        vi.mocked(httpClient.get).mockResolvedValueOnce({
            data: { items: [], totalElements: { low: 1, high: 0, unsigned: false }, totalPages: { low: 1, high: 0, unsigned: false }, page: 0, size: 10 }
        });

        const result = await accountManagementService.list({});

        expect(result.totalElements).toBe(1);
        expect(result.totalPages).toBe(1);
        expect(typeof result.totalElements).toBe('number');
    });

    it('givenCreatedAccountResponse_whenCreate_thenNormalizesReturnedDto', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { id: '1', username: 'jdoe', email: 'jdoe@bycrafter.com', role: 'ORGANIZER', firstName: 'Jane', lastName: 'Doe', status: 'PENDING' }
        });

        const result = await accountManagementService.create(buildCreatePayload());

        expect(result.role).toBe(AccountRole.ORGANIZER);
        expect(result.status).toBe(AccountStatus.PENDING);
    });

    it('givenEmptyBffResponse_whenCreate_thenFallsBackToClientSideDtoBuiltFromPayload', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({ data: null });
        const payload = buildCreatePayload();

        const result = await accountManagementService.create(payload);

        expect(result).toEqual(expect.objectContaining({ username: payload.username, email: payload.email, role: payload.role }));
    });

    it('givenEmptyBffResponse_whenUpdate_thenFallsBackToClientSideDtoWithoutLosingRole', async () => {
        // Reproduces the same "204 No Content on PATCH" class of bug fixed for providers:
        // an empty body must NOT be treated as an error, and must NOT wipe out the fields
        // (e.g. `role`) that were actually just saved.
        vi.mocked(httpClient.patch).mockResolvedValueOnce({ data: null });
        const payload: UpdateAccountPayload = { email: 'jdoe@bycrafter.com', firstName: 'Jane', lastName: 'Doe', role: AccountRole.ADMIN };

        const result = await accountManagementService.update('1', payload);

        expect(result.role).toBe(AccountRole.ADMIN);
    });

    it('givenNormalUpdateResponse_whenUpdate_thenNormalizesReturnedDto', async () => {
        vi.mocked(httpClient.patch).mockResolvedValueOnce({
            data: { id: '1', username: 'jdoe', email: 'jdoe@bycrafter.com', role: 'ADMIN', firstName: 'Jane', lastName: 'Doe' }
        });
        const payload: UpdateAccountPayload = { email: 'jdoe@bycrafter.com', firstName: 'Jane', lastName: 'Doe', role: AccountRole.ADMIN };

        const result = await accountManagementService.update('1', payload);

        expect(result.role).toBe(AccountRole.ADMIN);
        expect(httpClient.patch).toHaveBeenCalledWith('/accounts/1', payload);
    });

    it('givenAccountId_whenRemove_thenCallsDelete', async () => {
        vi.mocked(httpClient.delete).mockResolvedValueOnce({ data: null });

        await accountManagementService.remove('1');

        expect(httpClient.delete).toHaveBeenCalledWith('/accounts/1');
    });

    it('givenPendingAccountId_whenResendPassword_thenPostsToResendPasswordRoute', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({ data: null });

        await accountManagementService.resendPassword('1');

        expect(httpClient.post).toHaveBeenCalledWith('/accounts/1/resend-password');
    });

    it('givenPendingAccountId_whenResetPassword_thenPostsToResetPasswordRoute', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({ data: null });

        await accountManagementService.resetPassword('1');

        expect(httpClient.post).toHaveBeenCalledWith('/accounts/1/reset-password');
    });
});
