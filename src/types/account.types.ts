import { AccountRole, normalizeAccountRole } from '@/types/auth.types';

export { AccountRole };

/**
 * Mirrors the account status surfaced by `account-manager` via `AccountController`
 * (`conference-web-api`). `PENDING` accounts have not completed their first-login
 * password change yet (see `LoginResponse.requirePasswordChange`).
 *
 * Mirrors the REAL `AccountStatus` gRPC enum (`account.proto`,
 * `@bycrafter/account-manager-grpc-contract`) - the BFF forwards the raw gRPC
 * enum as-is, which `@grpc/proto-loader` may serialize as either the numeric
 * wire value (0-3) or the string name depending on loader options, so
 * `normalizeAccountStatus` below handles both shapes defensively.
 */
export enum AccountStatus {
    UNKNOWN_STATUS = 'UNKNOWN_STATUS',
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    PASSIVE = 'PASSIVE'
}

const NUMERIC_ACCOUNT_STATUS: Record<number, AccountStatus> = {
    0: AccountStatus.UNKNOWN_STATUS,
    1: AccountStatus.PENDING,
    2: AccountStatus.VERIFIED,
    3: AccountStatus.PASSIVE
};

/** Normalizes a raw `status` value coming from `GET /v1/accounts/list` (`PENDING`/`VERIFIED`/`PASSIVE`, or their `0`-`3` gRPC wire values), defaulting unknown/missing values to `PENDING` (safest, least-privileged assumption). */
export function normalizeAccountStatus(rawStatus: unknown): AccountStatus {
    if (typeof rawStatus === 'number') {
        return NUMERIC_ACCOUNT_STATUS[rawStatus] ?? AccountStatus.PENDING;
    }
    if (typeof rawStatus === 'string' && rawStatus in AccountStatus) {
        return AccountStatus[rawStatus as keyof typeof AccountStatus];
    }
    return AccountStatus.PENDING;
}

/** Raw `AccountResponse` shape as received over HTTP (`GET /v1/accounts/search`, `POST /v1/accounts/resolve-emails`), pre-enum-normalization. */
export interface RawAccountSummaryDto {
    username: string;
    email: string;
    role: unknown;
    firstName?: string;
    lastName?: string;
}

/** Frontend-normalized account summary - backs the Attendees `<AutoComplete>` and "On Behalf Of" picker in `CreateEventDialog.vue`/`ConferenceDetailDialog.vue`. */
export interface AccountSummaryDto {
    username: string;
    email: string;
    role: AccountRole;
    firstName?: string;
    lastName?: string;
}

export function normalizeAccountSummaryDto(raw: RawAccountSummaryDto): AccountSummaryDto {
    return {
        ...raw,
        role: normalizeAccountRole(raw.role)
    };
}

/** Query params for `GET /v1/accounts/search` (`SearchAccountsDto`). */
export interface SearchAccountsParams {
    q?: string;
    size?: number;
}

/** Raw `AccountResponse` shape as received over HTTP (`GET /v1/accounts/list`), pre-enum-normalization. */
export interface RawAccountDto {
    id: string;
    username: string;
    email: string;
    role: unknown;
    firstName: string;
    lastName: string;
    status?: unknown;
}

/** Frontend-normalized account, used everywhere in the Account Management UI. */
export interface AccountDto {
    id: string;
    username: string;
    email: string;
    role: AccountRole;
    firstName: string;
    lastName: string;
    status: AccountStatus;
}

export function normalizeAccountDto(raw: RawAccountDto): AccountDto {
    return {
        ...raw,
        role: normalizeAccountRole(raw.role),
        status: normalizeAccountStatus(raw.status)
    };
}

/**
 * `GET /v1/accounts/list` response (`PaginatedAccountResponse`) - Account Management grid.
 * `totalElements`/`totalPages`/`page`/`size` may arrive as a plain number OR a protobuf
 * `{ low, high }` Long object; see `parseBffLong` (`@/utils/bffLong`).
 */
export interface RawPaginatedAccountResponse {
    items: RawAccountDto[];
    totalElements: unknown;
    totalPages: unknown;
    page: unknown;
    size: unknown;
}

export interface PaginatedAccountResponse {
    items: AccountDto[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

/** Query params for `GET /v1/accounts/list` (`ListAccountsDto`). */
export interface ListAccountsParams {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: AccountRole;
    page?: number;
    pageSize?: number;
}

/**
 * Payload for `POST /v1/accounts` (`CreateAccountDto`) - `firstName`/`lastName` are required by the BFF's `class-validator` rules.
 * No `password` field - the backend generates a secure random password and emails it to the user.
 */
export interface CreateAccountPayload {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: AccountRole;
}

/**
 * Payload for `PATCH /v1/accounts/:id` (`UpdateAccountDto`).
 * No `password` field - passwords can only be changed via the first-login `POST /v1/auth/change-password` flow.
 */
export interface UpdateAccountPayload {
    email: string;
    firstName: string;
    lastName: string;
    role: AccountRole;
}
