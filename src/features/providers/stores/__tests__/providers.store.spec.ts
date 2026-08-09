import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProvidersStore } from '@/features/providers/stores/providers.store';
import { providersService } from '@/features/providers/services/providers.service';
import { ProviderStatus, ProviderType, ProviderVendor, type ProviderDto } from '@/types/provider.types';

vi.mock('@/features/providers/services/providers.service', () => ({
    providersService: {
        getActive: vi.fn(),
        search: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn()
    }
}));

function buildProvider(overrides: Partial<ProviderDto> = {}): ProviderDto {
    return {
        id: 'provider-1',
        name: 'Zoom Pool A',
        vendor: ProviderVendor.ZOOM,
        type: ProviderType.POOL,
        status: ProviderStatus.ACTIVE,
        accounts: [],
        ...overrides
    };
}

describe('providersStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('givenActiveProviders_whenFetchActive_thenPopulatesActiveProviders', async () => {
        const provider = buildProvider();
        vi.mocked(providersService.getActive).mockResolvedValueOnce([provider]);
        const store = useProvidersStore();

        await store.fetchActive();

        expect(store.activeProviders).toEqual([provider]);
        expect(store.error).toBeNull();
    });

    it('givenAdminSearchResults_whenSearch_thenPopulatesAdminGridState', async () => {
        const provider = buildProvider();
        vi.mocked(providersService.search).mockResolvedValueOnce({ items: [provider], totalElements: 1, totalPages: 1, page: 0, size: 10 });
        const store = useProvidersStore();

        await store.search({ keyword: 'zoom' });

        expect(store.items).toEqual([provider]);
        expect(store.totalElements).toBe(1);
        expect(providersService.search).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'zoom' }));
    });

    it('givenNewProviderPayload_whenCreate_thenPrependsToItemsAndIncrementsTotal', async () => {
        const provider = buildProvider({ id: 'provider-2' });
        vi.mocked(providersService.create).mockResolvedValueOnce(provider);
        const store = useProvidersStore();
        store.items = [buildProvider()];
        store.totalElements = 1;

        await store.create({ name: provider.name, vendor: provider.vendor, type: provider.type, status: provider.status, accounts: [] });

        expect(store.items[0]).toEqual(provider);
        expect(store.totalElements).toBe(2);
    });

    it('givenExistingProvider_whenRemove_thenFiltersItOutAndDecrementsTotal', async () => {
        const provider = buildProvider();
        vi.mocked(providersService.remove).mockResolvedValueOnce(undefined);
        const store = useProvidersStore();
        store.items = [provider];
        store.totalElements = 1;

        await store.remove(provider.id);

        expect(store.items).toHaveLength(0);
        expect(store.totalElements).toBe(0);
    });
});
