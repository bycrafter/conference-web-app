import { parseBffLong } from '@/utils/bffLong';

export { parseBffLong };

/**
 * Mirrors `ConferenceStatus` (`enums.ts`) and `ConferenceEvent_EventType`
 * (`conference.ts`), `@bycrafter/conference-manager-grpc-contract`. Same
 * numeric-vs-string ambiguity as `AccountRole` - see `auth.types.ts`.
 */
export enum ConferenceStatus {
    CONFERENCE_STATUS_UNSPECIFIED = 'CONFERENCE_STATUS_UNSPECIFIED',
    SCHEDULED = 'SCHEDULED',
    CANCELLED = 'CANCELLED'
}

const NUMERIC_CONFERENCE_STATUS: Record<number, ConferenceStatus> = {
    0: ConferenceStatus.CONFERENCE_STATUS_UNSPECIFIED,
    1: ConferenceStatus.SCHEDULED,
    2: ConferenceStatus.CANCELLED
};

export function normalizeConferenceStatus(raw: unknown): ConferenceStatus {
    if (typeof raw === 'number') {
        return NUMERIC_CONFERENCE_STATUS[raw] ?? ConferenceStatus.CONFERENCE_STATUS_UNSPECIFIED;
    }
    if (typeof raw === 'string' && raw in ConferenceStatus) {
        return ConferenceStatus[raw as keyof typeof ConferenceStatus];
    }
    return ConferenceStatus.CONFERENCE_STATUS_UNSPECIFIED;
}

/** Real-Time Calendar Update Event type (`ConferenceEvent_EventType`). */
export enum ConferenceEventType {
    EVENT_TYPE_UNSPECIFIED = 'EVENT_TYPE_UNSPECIFIED',
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    CANCELLED = 'CANCELLED'
}

const NUMERIC_CONFERENCE_EVENT_TYPE: Record<number, ConferenceEventType> = {
    0: ConferenceEventType.EVENT_TYPE_UNSPECIFIED,
    1: ConferenceEventType.CREATED,
    2: ConferenceEventType.UPDATED,
    3: ConferenceEventType.CANCELLED
};

export function normalizeConferenceEventType(raw: unknown): ConferenceEventType {
    if (typeof raw === 'number') {
        return NUMERIC_CONFERENCE_EVENT_TYPE[raw] ?? ConferenceEventType.EVENT_TYPE_UNSPECIFIED;
    }
    if (typeof raw === 'string' && raw in ConferenceEventType) {
        return ConferenceEventType[raw as keyof typeof ConferenceEventType];
    }
    return ConferenceEventType.EVENT_TYPE_UNSPECIFIED;
}

/** Raw `ConferenceDto` shape as received over HTTP, pre-enum-normalization. */
export interface RawConferenceDto {
    id: string;
    title: string;
    description: string;
    /** Epoch millis - may arrive as a plain number OR a protobuf `{ low, high }` Long object; see `parseBffDate`. */
    startTime: unknown;
    /** Epoch millis - may arrive as a plain number OR a protobuf `{ low, high }` Long object; see `parseBffDate`. */
    endTime: unknown;
    providerId: string;
    location: string;
    privateInfo: string;
    ownerUsername: string;
    organizerUsername: string;
    status: unknown;
    joinLink: string;
    participants: string[];
    isStarred: boolean;
}

/** Frontend-normalized `ConferenceDto` (`conference.ts`), used everywhere in the UI. */
export interface ConferenceDto {
    id: string;
    title: string;
    description: string;
    startTime: number;
    endTime: number;
    providerId: string;
    location: string;
    privateInfo: string;
    ownerUsername: string;
    organizerUsername: string;
    status: ConferenceStatus;
    joinLink: string;
    participants: string[];
    isStarred: boolean;
}

/**
 * Epoch-millis-flavored alias of `parseBffLong` - see `@/utils/bffLong` for the underlying
 * protobuf Long/`{ low, high, unsigned }` handling shared with other `int64` fields (e.g.
 * paginated result counts).
 */
export const parseBffDate = parseBffLong;

export function normalizeConferenceDto(raw: RawConferenceDto): ConferenceDto {
    return {
        ...raw,
        startTime: parseBffDate(raw.startTime),
        endTime: parseBffDate(raw.endTime),
        status: normalizeConferenceStatus(raw.status),
        // Masked (foreign) conferences carry an empty `participants` repeated field, which the gRPC ->
        // BFF -> HTTP hop can serialize as `undefined`/`null` instead of `[]` - always coerce to an
        // array here so downstream `.includes(...)`/`.length` calls (dialog restricted-view guards,
        // slot-change eligibility) never throw and silently break the whole detail dialog.
        participants: raw.participants ?? []
    };
}

/**
 * `GET /v1/conferences` response (`PaginatedConferenceResponse`), pre-normalization. `totalElements`/
 * `totalPages`/`page`/`size` may arrive as a plain number OR a protobuf `{ low, high }` Long object;
 * see `parseBffLong`.
 */
export interface RawPaginatedConferenceResponse {
    items: RawConferenceDto[];
    totalElements: unknown;
    totalPages: unknown;
    page: unknown;
    size: unknown;
}

export interface PaginatedConferenceResponse {
    items: ConferenceDto[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

/** Query params for `GET /v1/conferences` (`SearchConferenceDto`). */
export interface SearchConferenceParams {
    keyword?: string;
    /** Epoch millis */
    startTime?: number;
    /** Epoch millis */
    endTime?: number;
    providerId?: string;
    filterByStarred?: boolean;
    /** Opt-in strict scope: server excludes conferences the caller neither owns, organizes, nor participates in. */
    restrictToOwn?: boolean;
    page?: number;
    size?: number;
}

/** Payload for `POST /v1/conferences` (`CreateConferenceDto`). */
export interface CreateConferencePayload {
    title: string;
    description: string;
    startTime: number;
    endTime: number;
    providerId: string;
    location: string;
    privateInfo: string;
    ownerUsername: string;
    participants: string[];
}

/** Payload for `PATCH /v1/conferences/:id` (`UpdateConferenceDto`) - full replace, no partials upstream. */
export interface UpdateConferencePayload {
    title: string;
    description: string;
    startTime: number;
    endTime: number;
    providerId: string;
    location: string;
    privateInfo: string;
    participants: string[];
}

/** Raw SSE payload on `GET /v1/conferences/stream` (`ConferenceEvent`), pre-normalization. */
export interface RawConferenceEvent {
    type: unknown;
    conference: RawConferenceDto | undefined;
}

export interface ConferenceEvent {
    type: ConferenceEventType;
    conference: ConferenceDto | undefined;
}

export function normalizeConferenceEvent(raw: RawConferenceEvent): ConferenceEvent {
    return {
        type: normalizeConferenceEventType(raw.type),
        conference: raw.conference ? normalizeConferenceDto(raw.conference) : undefined
    };
}
