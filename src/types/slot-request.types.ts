/**
 * Mirrors the REAL `SlotRequestGrpcService` contract (`slot_request.proto`,
 * `@bycrafter/conference-manager-grpc-contract`) and `SlotRequestsController`
 * (`conference-web-api`) - verified against the backend source, not assumed.
 *
 * `GetSlotRequestByToken` (public) remains the token-scoped single-record
 * lookup used by the actionable email link. `ListSlotRequests` backs the
 * admin queue (`GET /v1/slot-requests?status=`), optionally filtered by
 * status, and requires `SLOT_REQUEST_MANAGE_ALL`.
 */
import { parseBffDate } from '@/types/conference.types';

export enum SlotRequestStatus {
    SLOT_REQUEST_STATUS_UNSPECIFIED = 'SLOT_REQUEST_STATUS_UNSPECIFIED',
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED'
}

const NUMERIC_SLOT_REQUEST_STATUS: Record<number, SlotRequestStatus> = {
    0: SlotRequestStatus.SLOT_REQUEST_STATUS_UNSPECIFIED,
    1: SlotRequestStatus.PENDING,
    2: SlotRequestStatus.APPROVED,
    3: SlotRequestStatus.REJECTED
};

export function normalizeSlotRequestStatus(raw: unknown): SlotRequestStatus {
    if (typeof raw === 'number') {
        return NUMERIC_SLOT_REQUEST_STATUS[raw] ?? SlotRequestStatus.SLOT_REQUEST_STATUS_UNSPECIFIED;
    }
    if (typeof raw === 'string' && raw in SlotRequestStatus) {
        return SlotRequestStatus[raw as keyof typeof SlotRequestStatus];
    }
    return SlotRequestStatus.SLOT_REQUEST_STATUS_UNSPECIFIED;
}

/** Raw `SlotRequestDto` shape as received over HTTP, pre-enum-normalization. */
export interface RawSlotRequestDto {
    id: string;
    conferenceId: string;
    requesterUsername: string;
    /** Epoch millis - may arrive as a plain number OR a protobuf `{ low, high }` Long object; see `parseBffDate`. */
    requestedStartTime: unknown;
    /** Epoch millis - may arrive as a plain number OR a protobuf `{ low, high }` Long object; see `parseBffDate`. */
    requestedEndTime: unknown;
    justification: string;
    status: unknown;
    conferenceTitle?: string;
}

export interface SlotRequestDto {
    id: string;
    conferenceId: string;
    requesterUsername: string;
    requestedStartTime: number;
    requestedEndTime: number;
    justification: string;
    status: SlotRequestStatus;
    conferenceTitle: string;
}

export function normalizeSlotRequestDto(raw: RawSlotRequestDto): SlotRequestDto {
    return {
        ...raw,
        requestedStartTime: parseBffDate(raw.requestedStartTime),
        requestedEndTime: parseBffDate(raw.requestedEndTime),
        status: normalizeSlotRequestStatus(raw.status),
        conferenceTitle: raw.conferenceTitle ?? ''
    };
}

/** Raw `SlotRequestListResponse` shape as received from `GET /v1/slot-requests`. */
export interface RawSlotRequestListResponse {
    slotRequests?: RawSlotRequestDto[] | null;
}

export function normalizeSlotRequestList(raw: RawSlotRequestListResponse | null | undefined): SlotRequestDto[] {
    return (raw?.slotRequests ?? []).map(normalizeSlotRequestDto);
}

/** Payload for `POST /v1/slot-requests` (`CreateSlotRequestDto`). */
export interface CreateSlotRequestPayload {
    conferenceId: string;
    /** Epoch millis */
    requestedStartTime: number;
    /** Epoch millis */
    requestedEndTime: number;
    justification: string;
}

/** `SlotRequestResponse` returned by `approve`/`reject` (`POST /v1/slot-requests/:token/approve|reject`). */
export interface RawSlotRequestActionResponse {
    success: boolean;
    message: string;
    slotRequest: RawSlotRequestDto | null;
}

export interface SlotRequestActionResponse {
    success: boolean;
    message: string;
    slotRequest: SlotRequestDto | null;
}

export function normalizeSlotRequestActionResponse(raw: RawSlotRequestActionResponse | null | undefined): SlotRequestActionResponse {
    if (!raw) {
        return { success: false, message: '', slotRequest: null };
    }
    return { ...raw, slotRequest: raw.slotRequest ? normalizeSlotRequestDto(raw.slotRequest) : null };
}
