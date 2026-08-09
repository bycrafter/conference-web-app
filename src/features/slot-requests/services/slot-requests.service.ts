import httpClient from '@/services/httpClient';
import {
    normalizeSlotRequestActionResponse,
    normalizeSlotRequestDto,
    type CreateSlotRequestPayload,
    type RawSlotRequestActionResponse,
    type RawSlotRequestDto,
    type SlotRequestActionResponse,
    type SlotRequestDto
} from '@/types/slot-request.types';

/**
 * Wraps the REAL `SlotRequestsController` (`conference-web-api`) - verified against
 * the backend `slot_request.proto`/controller source, not assumed. There is no
 * list/search endpoint on this contract - every operation is scoped by a single
 * one-time action `token` (delivered via the actionable email link), except
 * `create` which is scoped by the authenticated caller.
 */
export const slotRequestsService = {
    /** `GET /v1/slot-requests/:token` - public, used to display details from the email link. */
    async getByToken(token: string): Promise<SlotRequestDto | null> {
        const { data } = await httpClient.get<RawSlotRequestDto | null>(`/slot-requests/${token}`);
        return data ? normalizeSlotRequestDto(data) : null;
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
    }
};
