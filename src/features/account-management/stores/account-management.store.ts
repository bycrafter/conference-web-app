import { defineStore } from 'pinia';
import { accountManagementService } from '@/features/account-management/services/account-management.service';
import { extractErrorMessage } from '@/utils/httpError';
import type { AccountDto, CreateAccountPayload, ListAccountsParams, UpdateAccountPayload } from '@/types/account.types';

interface AccountManagementState {
    items: AccountDto[];
    totalElements: number;
    page: number;
    size: number;
    loading: boolean;
    error: string | null;
}

/** Account Management admin grid state, backed by `AccountController` (`ACCOUNT_VIEW_ALL`/`ACCOUNT_MANAGE_ALL`). */
export const useAccountManagementStore = defineStore('accountManagement', {
    state: (): AccountManagementState => ({
        items: [],
        totalElements: 0,
        page: 0,
        size: 10,
        loading: false,
        error: null
    }),
    actions: {
        async search(params: ListAccountsParams = {}): Promise<void> {
            this.loading = true;
            this.error = null;
            try {
                const response = await accountManagementService.list({ page: 0, pageSize: this.size, ...params });
                this.items = response.items;
                this.totalElements = response.totalElements;
                this.page = response.page;
                this.size = response.size || this.size;
            } catch (err) {
                this.error = extractErrorMessage(err, 'Failed to load accounts.');
            } finally {
                this.loading = false;
            }
        },
        async create(payload: CreateAccountPayload): Promise<AccountDto> {
            const account = await accountManagementService.create(payload);
            this.items.unshift(account);
            this.totalElements += 1;
            return account;
        },
        async update(id: string, payload: UpdateAccountPayload): Promise<AccountDto> {
            const account = await accountManagementService.update(id, payload);
            const index = this.items.findIndex((item) => item.id === id);
            if (index !== -1) {
                // `UpdateAccountPayload` carries no `username` - preserve the existing one instead of trusting a blank fallback.
                this.items.splice(index, 1, { ...account, username: this.items[index].username });
            }
            return account;
        },
        async remove(id: string): Promise<void> {
            await accountManagementService.remove(id);
            this.items = this.items.filter((item) => item.id !== id);
            this.totalElements = Math.max(0, this.totalElements - 1);
        }
    }
});
