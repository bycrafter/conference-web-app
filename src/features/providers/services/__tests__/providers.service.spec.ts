import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { providersService } from '@/features/providers/services/providers.service';
import { ProviderStatus, ProviderType, ProviderVendor, type ProviderUpsertPayload } from '@/types/provider.types';

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn()
    }
}));

function buildPayload(overrides: Partial<ProviderUpsertPayload> = {}): ProviderUpsertPayload {
    return {
        name: 'Zoom Pool A',
        vendor: ProviderVendor.ZOOM,
        type: ProviderType.POOL,
        status: ProviderStatus.ACTIVE,
        accounts: [],
        ...overrides
    };
}

describe('providersService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('givenPassiveToActivePayload_whenBffRepliesWithEmptyBody_thenUpdateStillResolvesWithSavedActiveStatus', async () => {
        // Reproduces the reported bug: a `PATCH` that flips a provider PASSIVE -> ACTIVE
        // may come back as `204 No Content` (normalized to `null` by the httpClient
        // interceptor). Before the fix, `normalizeProviderDto(null)` silently produced a
        // broken `PROVIDER_STATUS_UNSPECIFIED` DTO instead of the saved ACTIVE status.
        vi.mocked(httpClient.patch).mockResolvedValueOnce({ data: null });
        const payload = buildPayload({ status: ProviderStatus.ACTIVE });

        const result = await providersService.update('provider-1', payload);

        expect(result.status).toBe(ProviderStatus.ACTIVE);
        expect(result).toEqual({ id: 'provider-1', ...payload });
    });

    it('givenNormalUpdateResponse_whenUpdate_thenNormalizesReturnedDto', async () => {
        vi.mocked(httpClient.patch).mockResolvedValueOnce({
            data: { id: 'provider-1', name: 'Zoom Pool A', vendor: 'ZOOM', type: 'POOL', status: 'ACTIVE', accounts: [] }
        });

        const result = await providersService.update('provider-1', buildPayload());

        expect(result.status).toBe(ProviderStatus.ACTIVE);
    });

    it('givenEmptyBffResponse_whenSearch_thenResolvesToEmptyPageInsteadOfThrowing', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: null });

        const result = await providersService.search({});

        expect(result).toEqual({ items: [], totalElements: 0, totalPages: 0, page: 0, size: 0 });
    });

    it('givenEmptyBffResponse_whenGetActive_thenResolvesToEmptyArrayInsteadOfThrowing', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: null });

        const result = await providersService.getActive();

        expect(result).toEqual([]);
    });

    it('givenProtobufLongObjectTotalElements_whenSearch_thenNormalizesToPlainNumber', async () => {
        // Regression test: the BFF/gRPC hop can serialize `totalElements` (and the other
        // pagination counters) as a protobuf `{ low, high, unsigned }` Long object instead
        // of a plain number, which fails Vue's `Number` prop type check on `<Paginator>`.
        vi.mocked(httpClient.get).mockResolvedValueOnce({
            data: { items: [], totalElements: { low: 1, high: 0, unsigned: false }, totalPages: { low: 1, high: 0, unsigned: false }, page: 0, size: 10 }
        });

        const result = await providersService.search({});

        expect(result.totalElements).toBe(1);
        expect(result.totalPages).toBe(1);
        expect(typeof result.totalElements).toBe('number');
    });
});
