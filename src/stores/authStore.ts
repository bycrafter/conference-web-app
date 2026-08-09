import { defineStore } from 'pinia';
import httpClient from '@/services/httpClient';
import {
    normalizeAccountRole,
    AccountRole,
    USER_PERMISSIONS_STORAGE_KEY,
    readStoredPermissions,
    type PermissionCode,
    type LoginPayload,
    type LoginResponse,
    type LogoutResponse,
    type ChangePasswordPayload,
    type ChangePasswordResponse
} from '@/types/auth.types';

interface AuthState {
    token: string | null;
    role: AccountRole | null;
    username: string | null;
    email: string | null;
    permissions: PermissionCode[];
    /** Restricted, short-lived token issued by `Login` when the account status is `PENDING`. Only valid for `POST /v1/auth/change-password`. */
    changePasswordToken: string | null;
}

/**
 * Session store backed by `POST /v1/auth/login` and `POST /v1/auth/logout`
 * (`AuthController`, `conference-web-api`). Persisted to storage so a page
 * refresh keeps the session until the JWT itself expires or a 401 is hit.
 */
export const useAuthStore = defineStore('auth', {
    state: (): AuthState => ({
        token: null,
        role: null,
        username: null,
        email: null,
        permissions: readStoredPermissions(),
        changePasswordToken: null
    }),
    getters: {
        isAuthenticated: (state): boolean => Boolean(state.token),
        hasRole:
            (state) =>
            (...roles: AccountRole[]): boolean =>
                state.role !== null && roles.includes(state.role),
        /** OR semantics, mirrors `PermissionsGuard#hasAnyPermission` on the BFF. */
        hasPermission(state): (...permissions: PermissionCode[]) => boolean {
            return (...permissions: PermissionCode[]): boolean => permissions.some((permission) => state.permissions.includes(permission));
        }
    },
    actions: {
        /**
         * Returns `true` when the account's status is `PENDING`: no session is
         * established in that case (the restricted `changePasswordToken` is stored
         * instead) and the caller (`Login.vue`) must redirect to `/auth/change-password`.
         */
        async login(payload: LoginPayload): Promise<boolean> {
            const { data } = await httpClient.post<LoginResponse>('/auth/login', payload);
            if (data.requirePasswordChange) {
                this.changePasswordToken = data.changePasswordToken ?? null;
                return true;
            }
            this.token = data.token;
            this.role = normalizeAccountRole(data.role);
            this.username = data.username;
            this.email = data.email;
            this.permissions = (data.permissions ?? []) as PermissionCode[];
            localStorage.setItem(USER_PERMISSIONS_STORAGE_KEY, JSON.stringify(this.permissions));
            return false;
        },
        /** First-login password change (`POST /v1/auth/change-password`), authorized via `changePasswordToken` (see `httpClient`'s request interceptor). Clears the restricted token only on success, so a failed attempt (e.g. expired token, weak password) can still be retried. */
        async changePassword(payload: ChangePasswordPayload): Promise<void> {
            await httpClient.post<ChangePasswordResponse>('/auth/change-password', payload);
            this.changePasswordToken = null;
        },
        async logout(): Promise<void> {
            if (this.token) {
                try {
                    await httpClient.post<LogoutResponse>('/auth/logout', { token: this.token });
                } catch {
                    // Best-effort server-side invalidation; local session is cleared regardless.
                }
            }
            this.clearSession();
        },
        /** Invoked by the Axios response interceptor on a `401`. */
        handleUnauthorized(): void {
            this.clearSession();
        },
        clearSession(): void {
            this.token = null;
            this.role = null;
            this.username = null;
            this.email = null;
            this.permissions = [];
            this.changePasswordToken = null;
            localStorage.removeItem(USER_PERMISSIONS_STORAGE_KEY);
        }
    },
    persist: true
});

export { AccountRole };
