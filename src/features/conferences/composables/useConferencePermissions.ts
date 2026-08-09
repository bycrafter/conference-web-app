import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';
import type { ConferenceDto } from '@/types/conference.types';

/**
 * Single source of truth for the Conference RBAC rules shared by `CalendarView.vue`
 * (drag-and-drop rescheduling eligibility) and `ConferenceDetailDialog.vue` (view/edit/delete
 * gating). Keeping this logic in one place prevents the two call sites from silently drifting
 * apart - e.g. the Calendar marking a conference `editable: true` while the Dialog would only
 * ever show it a masked, `null`-field DTO for the very same user.
 */
export function useConferencePermissions() {
    const authStore = useAuthStore();

    /**
     * Mirrors the backend's own masking condition (`ConferenceServiceImpl#applyMasking`): anyone
     * without `CONFERENCE_VIEW_ALL` who isn't the conference owner/organizer/participant only ever
     * receives a masked DTO (title/description/location/private info/join link/participants nulled
     * out server-side). Such a conference MUST NOT be treated as editable anywhere in the UI -
     * `CONFERENCE_UPDATE_ALL` alone doesn't guarantee the full (unmasked) data is present.
     */
    function isRestrictedView(conference: ConferenceDto): boolean {
        if (authStore.hasPermission(PermissionCode.CONFERENCE_VIEW_ALL)) {
            return false;
        }
        const isOwner = conference.ownerUsername === authStore.username || conference.organizerUsername === authStore.username;
        const participants = conference.participants ?? [];
        const isParticipant = participants.includes(authStore.email ?? '') || participants.includes(authStore.username ?? '');
        return !isOwner && !isParticipant;
    }

    /**
     * Creator, ORGANIZER or ADMIN may edit. `CONFERENCE_UPDATE_ALL` covers ORGANIZER/ADMIN;
     * `CONFERENCE_UPDATE_SELF` only applies to the conference's own owner/organizer. A masked
     * (restricted-view) conference is never editable regardless of permission, since the payload
     * required for a full replace (`PATCH /v1/conferences/:id`) isn't available.
     */
    function canEdit(conference: ConferenceDto): boolean {
        if (isRestrictedView(conference)) {
            return false;
        }
        if (authStore.hasPermission(PermissionCode.CONFERENCE_UPDATE_ALL)) {
            return true;
        }
        const isOwnConference = conference.ownerUsername === authStore.username || conference.organizerUsername === authStore.username;
        return isOwnConference && authStore.hasPermission(PermissionCode.CONFERENCE_UPDATE_SELF);
    }

    /** Creator, ORGANIZER or ADMIN may cancel. `CONFERENCE_DELETE_ALL` covers ORGANIZER/ADMIN; `CONFERENCE_DELETE_SELF` only applies to the conference's own owner/organizer. */
    function canDelete(conference: ConferenceDto): boolean {
        if (authStore.hasPermission(PermissionCode.CONFERENCE_DELETE_ALL)) {
            return true;
        }
        const isOwnConference = conference.ownerUsername === authStore.username || conference.organizerUsername === authStore.username;
        return isOwnConference && authStore.hasPermission(PermissionCode.CONFERENCE_DELETE_SELF);
    }

    return { isRestrictedView, canEdit, canDelete };
}
