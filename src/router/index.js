import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { authGuard } from '@/router/guards/authGuard';
import { AccountRole, PermissionCode } from '@/types/auth.types';
import { useAuthStore } from '@/stores/authStore';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            meta: { requiresAuth: true },
            children: [
                {
                    path: '/',
                    name: 'dashboard',
                    // Accessible to every authenticated role - STANDARD_ACCOUNT renders a
                    // restricted view (masked stats/charts) inside DashboardView itself.
                    component: () => import('@/features/dashboard/views/DashboardView.vue')
                },
                {
                    path: '/calendar',
                    name: 'calendar',
                    meta: { permissions: [PermissionCode.CONFERENCE_VIEW_ALL, PermissionCode.CONFERENCE_VIEW_LIMITED, PermissionCode.CONFERENCE_VIEW_SELF] },
                    component: () => import('@/features/calendar/views/CalendarView.vue')
                },
                {
                    path: '/providers',
                    name: 'providers',
                    // Explicit role check (in addition to permissions) so this page stays
                    // locked down for STANDARD_ACCOUNT even if the permission mirror drifts.
                    meta: { permissions: [PermissionCode.PROVIDER_VIEW_ALL, PermissionCode.PROVIDER_MANAGE_ALL] },
                    component: () => import('@/features/providers/views/ProvidersView.vue')
                },
                {
                    path: '/search',
                    name: 'search',
                    meta: { permissions: [PermissionCode.CONFERENCE_VIEW_ALL, PermissionCode.CONFERENCE_VIEW_LIMITED, PermissionCode.CONFERENCE_VIEW_SELF] },
                    component: () => import('@/features/search/views/SearchView.vue')
                },
                {
                    path: '/slot-requests/:token?',
                    name: 'slotRequests',
                    meta: { permissions: [PermissionCode.SLOT_REQUEST_MANAGE_ALL, PermissionCode.SLOT_REQUEST_MANAGE_SELF] },
                    component: () => import('@/features/slot-requests/views/SlotRequestsView.vue')
                },
                {
                    path: '/account-management',
                    name: 'accountManagement',
                    // ADMIN-only screen - `authGuard` checks `meta.permissions` against the
                    // logged-in account's permissions and redirects to `accessDenied` otherwise.
                    meta: { permissions: [PermissionCode.ACCOUNT_MANAGE_ALL] },
                    component: () => import('@/features/account-management/views/AccountManagementView.vue')
                },
            ]
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },

        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/change-password',
            name: 'changePassword',
            // Only reachable right after `Login` issued a restricted `changePasswordToken`
            // (account status `PENDING`) - otherwise there is nothing to authorize the
            // `POST /v1/auth/change-password` call with, so bounce back to `login`.
            beforeEnter: () => {
                const authStore = useAuthStore();
                if (!authStore.changePasswordToken) {
                    return { name: 'login' };
                }
                return true;
            },
            component: () => import('@/views/pages/auth/ChangePasswordView.vue')
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        }
    ]
});

router.beforeEach(authGuard);

export default router;
