/**
 * Mirrors enums from `@bycrafter/conference-manager-grpc-contract`
 * (`enums.ts`). Same numeric-vs-string ambiguity as `AccountRole` applies
 * here (see `auth.types.ts`), so every enum ships a defensive normalizer.
 */
export enum ProviderVendor {
    PROVIDER_VENDOR_UNSPECIFIED = 'PROVIDER_VENDOR_UNSPECIFIED',
    ZOOM = 'ZOOM',
    MEET = 'MEET',
    TEAMS = 'TEAMS',
    WEBEX = 'WEBEX'
}

const NUMERIC_PROVIDER_VENDOR: Record<number, ProviderVendor> = {
    0: ProviderVendor.PROVIDER_VENDOR_UNSPECIFIED,
    1: ProviderVendor.ZOOM,
    2: ProviderVendor.MEET,
    3: ProviderVendor.TEAMS,
    4: ProviderVendor.WEBEX
};

export function normalizeProviderVendor(raw: unknown): ProviderVendor {
    if (typeof raw === 'number') {
        return NUMERIC_PROVIDER_VENDOR[raw] ?? ProviderVendor.PROVIDER_VENDOR_UNSPECIFIED;
    }
    if (typeof raw === 'string' && raw in ProviderVendor) {
        return ProviderVendor[raw as keyof typeof ProviderVendor];
    }
    return ProviderVendor.PROVIDER_VENDOR_UNSPECIFIED;
}

/** Whether a provider account is dedicated to a single conference (SINGLE) or shared across a pool (POOL). */
export enum ProviderType {
    PROVIDER_TYPE_UNSPECIFIED = 'PROVIDER_TYPE_UNSPECIFIED',
    SINGLE = 'SINGLE',
    POOL = 'POOL'
}

const NUMERIC_PROVIDER_TYPE: Record<number, ProviderType> = {
    0: ProviderType.PROVIDER_TYPE_UNSPECIFIED,
    1: ProviderType.SINGLE,
    2: ProviderType.POOL
};

export function normalizeProviderType(raw: unknown): ProviderType {
    if (typeof raw === 'number') {
        return NUMERIC_PROVIDER_TYPE[raw] ?? ProviderType.PROVIDER_TYPE_UNSPECIFIED;
    }
    if (typeof raw === 'string' && raw in ProviderType) {
        return ProviderType[raw as keyof typeof ProviderType];
    }
    return ProviderType.PROVIDER_TYPE_UNSPECIFIED;
}

/** Lifecycle status of a provider (Active/Passive). */
export enum ProviderStatus {
    PROVIDER_STATUS_UNSPECIFIED = 'PROVIDER_STATUS_UNSPECIFIED',
    ACTIVE = 'ACTIVE',
    PASSIVE = 'PASSIVE'
}

const NUMERIC_PROVIDER_STATUS: Record<number, ProviderStatus> = {
    0: ProviderStatus.PROVIDER_STATUS_UNSPECIFIED,
    1: ProviderStatus.ACTIVE,
    2: ProviderStatus.PASSIVE
};

export function normalizeProviderStatus(raw: unknown): ProviderStatus {
    if (typeof raw === 'number') {
        return NUMERIC_PROVIDER_STATUS[raw] ?? ProviderStatus.PROVIDER_STATUS_UNSPECIFIED;
    }
    if (typeof raw === 'string' && raw in ProviderStatus) {
        return ProviderStatus[raw as keyof typeof ProviderStatus];
    }
    return ProviderStatus.PROVIDER_STATUS_UNSPECIFIED;
}

/** Mirrors `ProviderAccountDto` (`provider.ts`). */
export interface ProviderAccountDto {
    accountUsername: string;
    accountPassword: string;
}

/** Raw `ProviderDto` shape as received over HTTP, pre-enum-normalization. */
export interface RawProviderDto {
    id: string;
    name: string;
    vendor: unknown;
    type: unknown;
    status: unknown;
    accounts: ProviderAccountDto[];
}

/** Frontend-normalized `ProviderDto` (`provider.ts`), used everywhere in the UI. */
export interface ProviderDto {
    id: string;
    name: string;
    vendor: ProviderVendor;
    type: ProviderType;
    status: ProviderStatus;
    accounts: ProviderAccountDto[];
}

export function normalizeProviderDto(raw: RawProviderDto): ProviderDto {
    return {
        ...raw,
        vendor: normalizeProviderVendor(raw.vendor),
        type: normalizeProviderType(raw.type),
        status: normalizeProviderStatus(raw.status)
    };
}

/** `GET /v1/providers/active` response (`ProviderListResponse`) - public dropdown source. */
export interface RawProviderListResponse {
    items: RawProviderDto[];
}

/**
 * `GET /v1/providers` response (`PaginatedProviderResponse`) - admin grid. `totalElements`/
 * `totalPages`/`page`/`size` may arrive as a plain number OR a protobuf `{ low, high }` Long
 * object; see `parseBffLong` (`@/utils/bffLong`).
 */
export interface RawPaginatedProviderResponse {
    items: RawProviderDto[];
    totalElements: unknown;
    totalPages: unknown;
    page: unknown;
    size: unknown;
}

export interface PaginatedProviderResponse {
    items: ProviderDto[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

/** Query params for `GET /v1/providers` (`SearchProvidersDto`). */
export interface SearchProvidersParams {
    keyword?: string;
    typeFilter?: ProviderType;
    statusFilter?: ProviderStatus;
    page?: number;
    size?: number;
}

/** Payload for `POST /v1/providers` and `PATCH /v1/providers/:id` (`CreateProviderDto`/`UpdateProviderDto`). */
export interface ProviderUpsertPayload {
    name: string;
    vendor: ProviderVendor;
    type: ProviderType;
    status: ProviderStatus;
    accounts: ProviderAccountDto[];
}
