import { defineStore } from 'pinia';
import { providersService } from '@/features/providers/services/providers.service';
import { extractErrorMessage } from '@/utils/httpError';
import type { ProviderDto, ProviderUpsertPayload, SearchProvidersParams } from '@/types/provider.types';

interface ProvidersState {
    activeProviders: ProviderDto[];
    loading: boolean;
    error: string | null;
    /** Admin CRUD grid (`ProviderManagementView`/`ProvidersView`) state - independent from the public `activeProviders` dropdown source. */
    items: ProviderDto[];
    totalElements: number;
    page: number;
    size: number;
    adminLoading: boolean;
    adminError: string | null;
}

/** Active provider list, backed by public `GET /v1/providers/active` - drives the Calendar filter dropdown, plus the admin CRUD grid. */
export const useProvidersStore = defineStore('providers', {
    state: (): ProvidersState => ({
        activeProviders: [],
        loading: false,
        error: null,
        items: [],
        totalElements: 0,
        page: 0,
        size: 10,
        adminLoading: false,
        adminError: null
    }),
    actions: {
        async fetchActive(): Promise<void> {
            this.loading = true;
            this.error = null;
            try {
                this.activeProviders = await providersService.getActive();
            } catch (err) {
                this.error = extractErrorMessage(err, 'Failed to load providers.');
            } finally {
                this.loading = false;
            }
        },
        async search(params: SearchProvidersParams = {}): Promise<void> {
            this.adminLoading = true;
            this.adminError = null;
            try {
                const response = await providersService.search({ page: 0, size: this.size, ...params });
                this.items = response.items;
                this.totalElements = response.totalElements;
                this.page = response.page;
            } catch (err) {
                this.adminError = extractErrorMessage(err, 'Failed to load providers.');
            } finally {
                this.adminLoading = false;
            }
        },
        async create(payload: ProviderUpsertPayload): Promise<ProviderDto> {
            const provider = await providersService.create(payload);
            this.items.unshift(provider);
            this.totalElements += 1;
            return provider;
        },
        async update(id: string, payload: ProviderUpsertPayload): Promise<ProviderDto> {
            const provider = await providersService.update(id, payload);
            const index = this.items.findIndex((item) => item.id === id);
            if (index !== -1) {
                this.items.splice(index, 1, provider);
            }
            return provider;
        },
        async remove(id: string): Promise<void> {
            await providersService.remove(id);
            this.items = this.items.filter((item) => item.id !== id);
            this.totalElements = Math.max(0, this.totalElements - 1);
        }
    }
});
