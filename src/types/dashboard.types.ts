/**
 * Mirrors `DashboardResponse` (`@bycrafter/conference-manager-grpc-contract`,
 * `dashboard.ts`), returned verbatim by `GET /v1/dashboard/stats`
 * (`DashboardController`, `conference-web-api`).
 *
 * ARCHITECTURAL GAP: the contract has no time-series field - only a
 * point-in-time `organizerStats` (all-time count per organizer) and
 * `providerUsage` (all-time count per provider). "Usage graphs over time"
 * is therefore rendered as a provider-usage distribution chart, not a
 * timeline. Recommend the BFF eventually expose a time-bucketed series
 * (e.g. `dailyUsage: { date, count }[]`) if a real trend chart is required.
 */
export interface OrganizerStatsDto {
    username: string;
    count: number;
}

export interface ProviderUsageDto {
    providerId: string;
    usageCount: number;
}

export interface DashboardResponse {
    organizerStats: OrganizerStatsDto[];
    providerUsage: ProviderUsageDto[];
}
