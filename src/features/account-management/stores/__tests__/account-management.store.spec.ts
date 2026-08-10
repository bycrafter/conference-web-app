import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountManagementStore } from '@/features/account-management/stores/account-management.store';
import { accountManagementService } from '@/features/account-management/services/account-management.service';
import { AccountRole, AccountStatus, type AccountDto } from '@/types/account.types';

vi.mock('@/features/account-management/services/account-management.service', () => ({
    accountManagementService: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        resendPassword: vi.fn(),
        resetPassword: vi.fn()
    }
}));

function buildAccount(overrides: Partial<AccountDto> = {}): AccountDto {
    return {
        id: 'acc-1',
        username: 'jdoe',
        email: 'jdoe@test.com',
        role: AccountRole.STANDARD_ACCOUNT,
        firstName: 'Jane',
        lastName: 'Doe',
        status: AccountStatus.VERIFIED,
        ...overrides
    };
}

describe('accountManagementStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('givenSearchResults_whenSearch_thenPopulatesGridState', async () => {
        const account = buildAccount();
        vi.mocked(accountManagementService.list).mockResolvedValueOnce({ items: [account], totalElements: 1, totalPages: 1, page: 0, size: 10 });
        const store = useAccountManagementStore();

        await store.search({ username: 'jdoe' });

        expect(store.items).toEqual([account]);
        expect(store.totalElements).toBe(1);
        expect(store.error).toBeNull();
        expect(store.loading).toBe(false);
        expect(accountManagementService.list).toHaveBeenCalledWith(expect.objectContaining({ username: 'jdoe', page: 0, pageSize: 10 }));
    });

    it('givenListFails_whenSearch_thenSetsErrorAndClearsLoading', async () => {
        vi.mocked(accountManagementService.list).mockRejectedValueOnce(new Error('network error'));
        const store = useAccountManagementStore();

        await store.search();

        expect(store.error).toBe('Failed to load accounts.');
        expect(store.loading).toBe(false);
    });

    it('givenNewAccountPayload_whenCreate_thenPrependsToItemsAndIncrementsTotal', async () => {
        const account = buildAccount({ id: 'acc-2' });
        vi.mocked(accountManagementService.create).mockResolvedValueOnce(account);
        const store = useAccountManagementStore();
        store.items = [buildAccount()];
        store.totalElements = 1;

        await store.create({ username: account.username, email: account.email, firstName: account.firstName, lastName: account.lastName, role: account.role });

        expect(store.items[0]).toEqual(account);
        expect(store.items).toHaveLength(2);
        expect(store.totalElements).toBe(2);
    });

    it('givenExistingAccount_whenUpdate_thenReplacesItInItemsPreservingUsername', async () => {
        const original = buildAccount();
        const updated = { ...original, username: '', email: 'newmail@test.com', role: AccountRole.ADMIN };
        vi.mocked(accountManagementService.update).mockResolvedValueOnce(updated);
        const store = useAccountManagementStore();
        store.items = [original];

        await store.update(original.id, { email: updated.email, firstName: updated.firstName, lastName: updated.lastName, role: updated.role });

        // `UpdateAccountPayload` carries no `username`/`status`, so the store must not overwrite them with blank/default values.
        expect(store.items[0]).toEqual({ ...updated, username: original.username, status: original.status });
    });

    it('givenExistingAccount_whenRemove_thenFiltersItOutAndDecrementsTotal', async () => {
        const account = buildAccount();
        vi.mocked(accountManagementService.remove).mockResolvedValueOnce(undefined);
        const store = useAccountManagementStore();
        store.items = [account];
        store.totalElements = 1;

        await store.remove(account.id);

        expect(store.items).toHaveLength(0);
        expect(store.totalElements).toBe(0);
    });

    it('givenPendingAccountId_whenResendPassword_thenDelegatesToService', async () => {
        vi.mocked(accountManagementService.resendPassword).mockResolvedValueOnce(undefined);
        const store = useAccountManagementStore();

        await store.resendPassword('acc-1');

        expect(accountManagementService.resendPassword).toHaveBeenCalledWith('acc-1');
    });

    it('givenPendingAccountId_whenResetPassword_thenDelegatesToService', async () => {
        vi.mocked(accountManagementService.resetPassword).mockResolvedValueOnce(undefined);
        const store = useAccountManagementStore();

        await store.resetPassword('acc-1');

        expect(accountManagementService.resetPassword).toHaveBeenCalledWith('acc-1');
    });
});
