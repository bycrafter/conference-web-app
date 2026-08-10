import httpClient from '@/services/httpClient';
import {
    normalizeSlotRequestActionResponse,
    normalizeSlotRequestDto,
    normalizeSlotRequestList,
    type CreateSlotRequestPayload,
    type RawSlotRequestActionResponse,
    type RawSlotRequestDto,
    type RawSlotRequestListResponse,
    type SlotRequestActionResponse,
    type SlotRequestDto,
    type SlotRequestStatus
} from '@/types/slot-request.types';

/**
 * Wraps the REAL `SlotRequestsController` (`conference-web-api`) - verified against
 * the backend `slot_request.proto`/controller source, not assumed. `getByToken`
 * remains a single-record, token-scoped lookup (delivered via the actionable
 * email link); `list` backs the admin queue (`SLOT_REQUEST_MANAGE_ALL`).
 */
export const slotRequestsService = {
    /** `GET /v1/slot-requests/:token` - public, used to display details from the email link. */
    async getByToken(token: string): Promise<SlotRequestDto | null> {
        const { data } = await httpClient.get<RawSlotRequestDto | null>(`/slot-requests/${token}`);
        return data ? normalizeSlotRequestDto(data) : null;
    },
    /** `GET /v1/slot-requests?status=` - requires `SLOT_REQUEST_MANAGE_ALL`. Omitted status returns every request. */
    async list(status?: SlotRequestStatus): Promise<SlotRequestDto[]> {
        const { data } = await httpClient.get<RawSlotRequestListResponse | null>('/slot-requests', { params: { status } });
        return normalizeSlotRequestList(data);
    },
    /** `POST /v1/slot-requests` - requires `SLOT_REQUEST_CREATE`. */
    async create(payload: CreateSlotRequestPayload): Promise<SlotRequestDto> {
        const { data } = await httpClient.post<RawSlotRequestDto>('/slot-requests', payload);
        return normalizeSlotRequestDto(data);
    },
    /** `POST /v1/slot-requests/:token/approve` - requires `SLOT_REQUEST_MANAGE_ALL`/`SLOT_REQUEST_MANAGE_SELF`. */
    async approve(token: string): Promise<SlotRequestActionResponse> {
        const { data } = await httpClient.post<RawSlotRequestActionResponse | null>(`/slot-requests/${token}/approve`);
        return normalizeSlotRequestActionResponse(data);
    },
    /** `POST /v1/slot-requests/:token/reject` - requires `SLOT_REQUEST_MANAGE_ALL`/`SLOT_REQUEST_MANAGE_SELF`. */
    async reject(token: string): Promise<SlotRequestActionResponse> {
        const { data } = await httpClient.post<RawSlotRequestActionResponse | null>(`/slot-requests/${token}/reject`);
        return normalizeSlotRequestActionResponse(data);
    },
    /** `POST /v1/slot-requests/id/:id/approve` - admin queue inline action, requires `SLOT_REQUEST_MANAGE_ALL`. Bypasses token validation. */
    async approveById(id: string): Promise<SlotRequestActionResponse> {
        const { data } = await httpClient.post<RawSlotRequestActionResponse | null>(`/slot-requests/id/${id}/approve`);
        return normalizeSlotRequestActionResponse(data);
    },
    /** `POST /v1/slot-requests/id/:id/reject` - admin queue inline action, requires `SLOT_REQUEST_MANAGE_ALL`. Bypasses token validation. */
    async rejectById(id: string): Promise<SlotRequestActionResponse> {
        const { data } = await httpClient.post<RawSlotRequestActionResponse | null>(`/slot-requests/id/${id}/reject`);
        return normalizeSlotRequestActionResponse(data);
    }
};
