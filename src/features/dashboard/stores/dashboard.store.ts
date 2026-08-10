import { defineStore } from 'pinia';
import { dashboardService } from '@/features/dashboard/services/dashboard.service';
import { extractErrorMessage } from '@/utils/httpError';
import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';
import type { OrganizerStatsDto, ProviderUsageDto } from '@/types/dashboard.types';

interface DashboardState {
    organizerStats: OrganizerStatsDto[];
    providerUsage: ProviderUsageDto[];
    loading: boolean;
    error: string | null;
}

/** Backed by `GET /v1/dashboard/stats`. Holds the raw stats; view derives Top 10 / chart data. */
export const useDashboardStore = defineStore('dashboard', {
    state: (): DashboardState => ({
        organizerStats: [],
        providerUsage: [],
        loading: false,
        error: null
    }),
    getters: {
        /** Top 10 Organizer list, sorted by activity count desc. */
        topOrganizers: (state): OrganizerStatsDto[] => [...state.organizerStats].sort((a, b) => b.count - a.count).slice(0, 10),
        /** Full stats (Top Organizers / Provider Usage) are admin-only; `REPORT_VIEW_LIMITED` holders (ORGANIZER, STANDARD_ACCOUNT) get a masked view. */
        isRestricted: (): boolean => !useAuthStore().hasPermission(PermissionCode.REPORT_VIEW_ALL)
    },
    actions: {
        async fetchStats(): Promise<void> {
            if (this.isRestricted) {
                // Server masks the response for non-admins anyway (`REPORT_VIEW_LIMITED`
                // grants endpoint access but returns empty stats) - skip the call entirely.
                return;
            }
            this.loading = true;
            this.error = null;
            try {
                const data = await dashboardService.getStats();
                this.organizerStats = data.organizerStats;
                this.providerUsage = data.providerUsage;
            } catch (err) {
                this.error = extractErrorMessage(err, 'Failed to load dashboard statistics.');
            } finally {
                this.loading = false;
            }
        }
    }
});
