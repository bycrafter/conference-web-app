import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { useAuthStore, AccountRole } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';

vi.mock('@/services/httpClient', () => ({
    default: {
        post: vi.fn()
    }
}));

describe('authStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('givenValidCredentials_whenLogin_thenPersistsSessionAndPermissions', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { token: 'token-123', role: 'ORGANIZER', username: 'jdoe', email: 'jdoe@bycrafter.com', permissions: [PermissionCode.CONFERENCE_CREATE_ALL] }
        });
        const authStore = useAuthStore();

        await authStore.login({ username: 'jdoe', password: 'secret' });

        expect(authStore.isAuthenticated).toBe(true);
        expect(authStore.role).toBe(AccountRole.ORGANIZER);
        expect(authStore.email).toBe('jdoe@bycrafter.com');
        expect(authStore.hasPermission(PermissionCode.CONFERENCE_CREATE_ALL)).toBe(true);
        expect(authStore.hasPermission(PermissionCode.PROVIDER_MANAGE_ALL)).toBe(false);
        expect(JSON.parse(localStorage.getItem('user_permissions') ?? '[]')).toEqual([PermissionCode.CONFERENCE_CREATE_ALL]);
    });

    it('givenNumericRoleWireFormat_whenLogin_thenNormalizesToAccountRoleEnum', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { token: 'token-456', role: 3, username: 'admin', permissions: [] } });
        const authStore = useAuthStore();

        await authStore.login({ username: 'admin', password: 'secret' });

        expect(authStore.role).toBe(AccountRole.ADMIN);
    });

    it('givenAuthenticatedSession_whenHandleUnauthorized_thenClearsSessionAndPermissions', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { token: 'token-789', role: 'ADMIN', username: 'admin', email: 'admin@bycrafter.com', permissions: [PermissionCode.ACCOUNT_MANAGE_ALL] }
        });
        const authStore = useAuthStore();
        await authStore.login({ username: 'admin', password: 'secret' });

        authStore.handleUnauthorized();

        expect(authStore.isAuthenticated).toBe(false);
        expect(authStore.role).toBeNull();
        expect(authStore.username).toBeNull();
        expect(authStore.email).toBeNull();
        expect(authStore.permissions).toEqual([]);
        expect(localStorage.getItem('user_permissions')).toBeNull();
    });

    it('givenAnyPermissionMatches_whenHasPermission_thenReturnsTrueOnOrSemantics', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { token: 'token-abc', role: 'STANDARD_ACCOUNT', username: 'jsmith', permissions: [PermissionCode.CONFERENCE_VIEW_LIMITED] }
        });
        const authStore = useAuthStore();
        await authStore.login({ username: 'jsmith', password: 'secret' });

        expect(authStore.hasPermission(PermissionCode.PROVIDER_MANAGE_ALL, PermissionCode.CONFERENCE_VIEW_LIMITED)).toBe(true);
    });

    it('givenStoredPermissionsInLocalStorage_whenStoreInitialized_thenHydratesFromStorage', () => {
        localStorage.setItem('user_permissions', JSON.stringify([PermissionCode.REPORT_VIEW_ALL]));

        const authStore = useAuthStore();

        expect(authStore.permissions).toEqual([PermissionCode.REPORT_VIEW_ALL]);
        expect(authStore.hasPermission(PermissionCode.REPORT_VIEW_ALL)).toBe(true);
    });

    it('givenPendingAccount_whenLogin_thenStoresChangePasswordTokenWithoutEstablishingSession', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { token: '', role: 'STANDARD_ACCOUNT', username: 'newhire', email: 'newhire@bycrafter.com', permissions: [], requirePasswordChange: true, changePasswordToken: 'reset-token' }
        });
        const authStore = useAuthStore();

        const requirePasswordChange = await authStore.login({ username: 'newhire', password: 'Temp0rary!Pw' });

        expect(requirePasswordChange).toBe(true);
        expect(authStore.changePasswordToken).toBe('reset-token');
        expect(authStore.isAuthenticated).toBe(false);
    });

    it('givenVerifiedAccount_whenLogin_thenReturnsFalseAndDoesNotSetChangePasswordToken', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { token: 'token-123', role: 'ORGANIZER', username: 'jdoe', email: 'jdoe@bycrafter.com', permissions: [], requirePasswordChange: false }
        });
        const authStore = useAuthStore();

        const requirePasswordChange = await authStore.login({ username: 'jdoe', password: 'secret' });

        expect(requirePasswordChange).toBe(false);
        expect(authStore.changePasswordToken).toBeNull();
        expect(authStore.isAuthenticated).toBe(true);
    });

    it('givenValidChangePasswordToken_whenChangePassword_thenCallsEndpointAndClearsToken', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { success: true, message: 'Password changed successfully' } });
        const authStore = useAuthStore();
        authStore.changePasswordToken = 'reset-token';

        await authStore.changePassword({ newPassword: 'N3wS3cur3P@ss' });

        expect(httpClient.post).toHaveBeenCalledWith('/auth/change-password', { newPassword: 'N3wS3cur3P@ss' });
        expect(authStore.changePasswordToken).toBeNull();
    });

    it('givenFailedChangePassword_whenChangePassword_thenPropagatesErrorAndKeepsTokenForRetry', async () => {
        vi.mocked(httpClient.post).mockRejectedValueOnce(new Error('invalid token'));
        const authStore = useAuthStore();
        authStore.changePasswordToken = 'reset-token';

        await expect(authStore.changePassword({ newPassword: 'N3wS3cur3P@ss' })).rejects.toThrow('invalid token');

        expect(authStore.changePasswordToken).toBe('reset-token');
    });
});
