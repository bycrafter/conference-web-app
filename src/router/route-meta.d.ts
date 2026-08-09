import 'vue-router';
import type { AccountRole, PermissionCode } from '@/types/auth.types';

declare module 'vue-router' {
    interface RouteMeta {
        requiresAuth?: boolean;
        roles?: AccountRole[];
        permissions?: PermissionCode[];
    }
}
