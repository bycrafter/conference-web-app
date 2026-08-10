<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';
import { computed } from 'vue';
import AppMenuItem from './AppMenuItem.vue';

interface MenuItem {
    label: string;
    icon?: string;
    to?: string;
    permissions?: PermissionCode[];
}

interface MenuSection {
    label: string;
    items: MenuItem[];
}

const authStore = useAuthStore();

/**
 * Bycrafter navigation, gated by `authStore.hasPermission` (OR semantics,
 * mirrors the BFF's `PermissionsGuard`) rather than raw role strings, so
 * items react instantly to any auth state change (login/logout/session
 * expiry) without a page reload.
 */
const sections: MenuSection[] = [
    {
        label: 'Bycrafter',
        items: [
            { label: 'Dashboard', icon: 'pi pi-fw pi-chart-line', to: '/', permissions: [PermissionCode.REPORT_VIEW_ALL, PermissionCode.REPORT_VIEW_LIMITED] },
            { label: 'Calendar', icon: 'pi pi-fw pi-calendar', to: '/calendar', permissions: [PermissionCode.CONFERENCE_VIEW_ALL, PermissionCode.CONFERENCE_VIEW_LIMITED, PermissionCode.CONFERENCE_VIEW_SELF] },
            { label: 'Providers', icon: 'pi pi-fw pi-server', to: '/providers', permissions: [PermissionCode.PROVIDER_VIEW_ALL, PermissionCode.PROVIDER_MANAGE_ALL] },
            { label: 'Search', icon: 'pi pi-fw pi-search', to: '/search', permissions: [PermissionCode.CONFERENCE_VIEW_ALL, PermissionCode.CONFERENCE_VIEW_LIMITED, PermissionCode.CONFERENCE_VIEW_SELF] },
            { label: 'Slot Requests', icon: 'pi pi-fw pi-inbox', to: '/slot-requests', permissions: [PermissionCode.SLOT_REQUEST_MANAGE_ALL] },
            { label: 'Account Management', icon: 'pi pi-fw pi-users', to: '/account-management', permissions: [PermissionCode.ACCOUNT_MANAGE_ALL] }
        ]
    }
];

const model = computed(() =>
    sections
        .map((section) => ({
            label: section.label,
            items: section.items.filter((item) => !item.permissions || authStore.hasPermission(...item.permissions))
        }))
        .filter((section) => section.items.length > 0)
);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
