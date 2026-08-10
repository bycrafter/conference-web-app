import httpClient from '@/services/httpClient';
import { parseBffLong } from '@/utils/bffLong';
import {
    normalizeProviderDto,
    type ProviderDto,
    type ProviderUpsertPayload,
    type RawProviderDto,
    type RawProviderListResponse,
    type RawPaginatedProviderResponse,
    type PaginatedProviderResponse,
    type SearchProvidersParams
} from '@/types/provider.types';

/** Empty page fallback - the BFF may reply with `null`/`204` when there's simply nothing to return; that's not an error. */
const EMPTY_PAGE: PaginatedProviderResponse = { items: [], totalElements: 0, totalPages: 0, page: 0, size: 0 };

function normalizePaginated(raw: RawPaginatedProviderResponse | null | undefined): PaginatedProviderResponse {
    if (!raw) {
        return EMPTY_PAGE;
    }
    return {
        items: (raw.items ?? []).map(normalizeProviderDto),
        // `totalElements`/`totalPages`/`page`/`size` may arrive as protobuf `{ low, high }` Long
        // objects instead of plain numbers - see `parseBffLong`.
        totalElements: parseBffLong(raw.totalElements),
        totalPages: parseBffLong(raw.totalPages),
        page: parseBffLong(raw.page),
        size: parseBffLong(raw.size)
    };
}

/**
 * Wraps `ProvidersController` (`conference-web-api`). `getActive` is the
 * public dropdown source (Calendar filter, "New Event" provider picker);
 * `search`/`create`/`update`/`remove` back the admin CRUD grid
 * (`PROVIDER_MANAGE_ALL`).
 */
export const providersService = {
    async getActive(): Promise<ProviderDto[]> {
        const { data } = await httpClient.get<RawProviderListResponse | null>('/providers/active');
        return (data?.items ?? []).map(normalizeProviderDto);
    },
    async search(params: SearchProvidersParams): Promise<PaginatedProviderResponse> {
        const { data } = await httpClient.get<RawPaginatedProviderResponse | null>('/providers', { params });
        return normalizePaginated(data);
    },
    async create(payload: ProviderUpsertPayload): Promise<ProviderDto> {
        const { data } = await httpClient.post<RawProviderDto | null>('/providers', payload);
        return data ? normalizeProviderDto(data) : { id: crypto.randomUUID(), ...payload };
    },
    async update(id: string, payload: ProviderUpsertPayload): Promise<ProviderDto> {
        const { data } = await httpClient.patch<RawProviderDto | null>(`/providers/${id}`, payload);
        return data ? normalizeProviderDto(data) : { id, ...payload };
    },
    async remove(id: string): Promise<void> {
        await httpClient.delete(`/providers/${id}`);
    }
};
