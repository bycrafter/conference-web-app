import httpClient from '@/services/httpClient';
import { normalizeConferenceDto, parseBffLong, type ConferenceDto, type CreateConferencePayload, type UpdateConferencePayload, type RawConferenceDto, type RawPaginatedConferenceResponse, type PaginatedConferenceResponse, type SearchConferenceParams } from '@/types/conference.types';

/** Empty page fallback - the BFF may reply with `null`/`204` when there's simply nothing to return; that's not an error. */
const EMPTY_PAGE: PaginatedConferenceResponse = { items: [], totalElements: 0, totalPages: 0, page: 0, size: 0 };

function normalizePaginated(raw: RawPaginatedConferenceResponse | null | undefined): PaginatedConferenceResponse {
    if (!raw) {
        return EMPTY_PAGE;
    }
    return {
        items: (raw.items ?? []).map(normalizeConferenceDto),
        // `totalElements`/`totalPages`/`page`/`size` may arrive as protobuf `{ low, high }` Long
        // objects instead of plain numbers - see `parseBffLong`.
        totalElements: parseBffLong(raw.totalElements),
        totalPages: parseBffLong(raw.totalPages),
        page: parseBffLong(raw.page),
        size: parseBffLong(raw.size)
    };
}

/**
 * Wraps `ConferencesController` (`conference-web-api`). `search` powers both
 * the Calendar grid (range-filtered by `startTime`/`endTime`) and the global
 * Search view (keyword-filtered, day-grouped client-side).
 */
export const conferencesService = {
    async search(params: SearchConferenceParams): Promise<PaginatedConferenceResponse> {
        const { data } = await httpClient.get<RawPaginatedConferenceResponse>('/conferences', {
            params: {
                ...params,
                filterByStarred: params.filterByStarred !== undefined ? String(params.filterByStarred) : undefined,
                restrictToOwn: params.restrictToOwn !== undefined ? String(params.restrictToOwn) : undefined
            }
        });
        return normalizePaginated(data);
    },
    async getById(id: string): Promise<ConferenceDto> {
        const { data } = await httpClient.get<RawConferenceDto>(`/conferences/${id}`);
        return normalizeConferenceDto(data);
    },
    async create(payload: CreateConferencePayload): Promise<ConferenceDto> {
        const { data } = await httpClient.post<RawConferenceDto>('/conferences', payload);
        return normalizeConferenceDto(data);
    },
    async update(id: string, payload: UpdateConferencePayload): Promise<ConferenceDto> {
        const { data } = await httpClient.patch<RawConferenceDto>(`/conferences/${id}`, payload);
        return normalizeConferenceDto(data);
    },
    async star(id: string): Promise<ConferenceDto> {
        const { data } = await httpClient.post<RawConferenceDto>(`/conferences/${id}/star`);
        return normalizeConferenceDto(data);
    },
    async unstar(id: string): Promise<ConferenceDto> {
        const { data } = await httpClient.post<RawConferenceDto>(`/conferences/${id}/unstar`);
        return normalizeConferenceDto(data);
    },
    async cancel(id: string): Promise<ConferenceDto> {
        const { data } = await httpClient.post<RawConferenceDto>(`/conferences/${id}/cancel`);
        return normalizeConferenceDto(data);
    }
};

/**
 * Absolute URL for the SSE endpoint (`GET /v1/conferences/stream`, public -
 * no `RequirePermissions` on the BFF). Native `EventSource` cannot use
 * `httpClient`'s baseURL/interceptors (no custom headers support), so the
 * base is resolved the same way `httpClient` does.
 */
export function buildConferenceStreamUrl(): string {
    const base = (import.meta.env.VITE_API_BASE_URL ?? '/v1').replace(/\/$/, '');
    return `${base}/conferences/stream`;
}
