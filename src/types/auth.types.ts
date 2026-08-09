/**
 * Mirrors `AccountRole` from `account-manager-grpc-contract` (`account.proto`).
 * Frontend-normalized (string) form - the BFF forwards the raw gRPC enum
 * as-is, which `@grpc/proto-loader` may serialize as either the numeric
 * wire value (0-3) or the string name depending on loader options, so
 * `normalizeAccountRole` below handles both shapes defensively.
 */
export enum AccountRole {
    UNKNOWN = 'UNKNOWN',
    STANDARD_ACCOUNT = 'STANDARD_ACCOUNT',
    ORGANIZER = 'ORGANIZER',
    ADMIN = 'ADMIN'
}

const NUMERIC_ACCOUNT_ROLE: Record<number, AccountRole> = {
    0: AccountRole.UNKNOWN,
    1: AccountRole.STANDARD_ACCOUNT,
    2: AccountRole.ORGANIZER,
    3: AccountRole.ADMIN
};

/** Normalizes a raw `role` value coming from `POST /v1/auth/login` into `AccountRole`. */
export function normalizeAccountRole(rawRole: unknown): AccountRole {
    if (typeof rawRole === 'number') {
        return NUMERIC_ACCOUNT_ROLE[rawRole] ?? AccountRole.UNKNOWN;
    }
    if (typeof rawRole === 'string' && rawRole in AccountRole) {
        return AccountRole[rawRole as keyof typeof AccountRole];
    }
    return AccountRole.UNKNOWN;
}

/** Payload for `POST /v1/auth/login` (`LoginDto`). */
export interface LoginPayload {
    username: string;
    password: string;
}

/**
 * Raw response of `POST /v1/auth/login` (`LoginResponse`), pre-normalization.
 * When the account's status is `PENDING` (first login after admin-created account),
 * `requirePasswordChange` is `true`, `token` is empty, and `changePasswordToken` carries
 * the short-lived, restricted token to be used ONLY with `POST /v1/auth/change-password`.
 */
export interface LoginResponse {
    token: string;
    role: unknown;
    username: string;
    email: string;
    permissions: string[];
    requirePasswordChange: boolean;
    changePasswordToken?: string;
}

/** Response of `POST /v1/auth/logout` (`LogoutResponse`). */
export interface LogoutResponse {
    success: boolean;
    message: string;
}

/** Payload for `POST /v1/auth/change-password` (`ChangePasswordDto`) - the restricted token itself travels via the `Authorization` header, not the body. */
export interface ChangePasswordPayload {
    newPassword: string;
}

/** Response of `POST /v1/auth/change-password` (`ChangePasswordResponse`). */
export interface ChangePasswordResponse {
    success: boolean;
    message: string;
}

/**
 * Mirrors `PermissionCode` from `conference-web-api`
 * (`src/common/constants/permission-code.constants.ts`), itself a copy of
 * the `PermissionCode` constants owned by `account-manager-data` and
 * `conference-manager-data` - the only codes the BFF's `PermissionsGuard`
 * (and, ultimately, every gRPC `PermissionInterceptor`) understands.
 */
export const PermissionCode = {
    // Account Management
    ACCOUNT_VIEW_ALL: 'ACCOUNT_VIEW_ALL',
    ACCOUNT_MANAGE_ALL: 'ACCOUNT_MANAGE_ALL',
    ACCOUNT_MANAGE_SELF: 'ACCOUNT_MANAGE_SELF',

    // Provider Management
    PROVIDER_VIEW_ALL: 'PROVIDER_VIEW_ALL',
    PROVIDER_MANAGE_ALL: 'PROVIDER_MANAGE_ALL',

    // Conference Management
    CONFERENCE_CREATE_ALL: 'CONFERENCE_CREATE_ALL',
    CONFERENCE_CREATE_SELF: 'CONFERENCE_CREATE_SELF',
    CONFERENCE_VIEW_ALL: 'CONFERENCE_VIEW_ALL',
    CONFERENCE_VIEW_LIMITED: 'CONFERENCE_VIEW_LIMITED',
    CONFERENCE_VIEW_SELF: 'CONFERENCE_VIEW_SELF',
    CONFERENCE_UPDATE_ALL: 'CONFERENCE_UPDATE_ALL',
    CONFERENCE_UPDATE_SELF: 'CONFERENCE_UPDATE_SELF',
    CONFERENCE_DELETE_ALL: 'CONFERENCE_DELETE_ALL',
    CONFERENCE_DELETE_SELF: 'CONFERENCE_DELETE_SELF',

    // Slot Management
    SLOT_REQUEST_CREATE: 'SLOT_REQUEST_CREATE',
    SLOT_REQUEST_MANAGE_ALL: 'SLOT_REQUEST_MANAGE_ALL',
    SLOT_REQUEST_MANAGE_SELF: 'SLOT_REQUEST_MANAGE_SELF',

    // Reporting
    REPORT_VIEW_ALL: 'REPORT_VIEW_ALL',
    REPORT_VIEW_LIMITED: 'REPORT_VIEW_LIMITED'
} as const;

export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];

/** `localStorage` key under which the granted `permissions` array (from `LoginResponse`) is persisted. */
export const USER_PERMISSIONS_STORAGE_KEY = 'user_permissions';

/** Reads and validates the persisted permission list, defaulting to an empty array on any failure. */
export function readStoredPermissions(): PermissionCode[] {
    try {
        const raw = localStorage.getItem(USER_PERMISSIONS_STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? (parsed as PermissionCode[]) : [];
    } catch {
        return [];
    }
}
