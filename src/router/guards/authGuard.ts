import type { NavigationGuardWithThis } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

/**
 * Protects routes flagged with `meta.requiresAuth`. Optional `meta.roles`
 * (array of `AccountRole`) and/or `meta.permissions` (array of
 * `PermissionCode`, OR semantics) additionally restrict access - either
 * mismatch redirects to the `accessDenied` page instead of `login`.
 */
export const authGuard: NavigationGuardWithThis<undefined> = (to) => {
    if (!to.meta.requiresAuth) {
        return true;
    }

    const authStore = useAuthStore();

    if (!authStore.isAuthenticated) {
        return { name: 'login', query: { redirect: to.fullPath } };
    }

    const requiredRoles = to.meta.roles;
    if (Array.isArray(requiredRoles) && requiredRoles.length > 0 && !authStore.hasRole(...requiredRoles)) {
        return { name: 'accessDenied' };
    }

    const requiredPermissions = to.meta.permissions;
    if (Array.isArray(requiredPermissions) && requiredPermissions.length > 0 && !authStore.hasPermission(...requiredPermissions)) {
        return { name: 'accessDenied' };
    }

    return true;
};
