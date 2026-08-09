import httpClient from '@/services/httpClient';
import type { DashboardResponse } from '@/types/dashboard.types';

/** Shape of a Neo4j driver `Integer` when it leaks into JSON unconverted (missing `.toNumber()` on the BFF side). */
interface Neo4jIntegerLike {
    low: number;
    high: number;
    unsigned?: boolean;
}

function isNeo4jIntegerLike(value: unknown): value is Neo4jIntegerLike {
    return typeof value === 'object' && value !== null && 'low' in value && 'high' in value;
}

/**
 * Coerces a count-like value into a plain `number`. The BFF is expected to
 * return plain numbers, but `conference-web-api` occasionally forwards raw
 * Neo4j driver `Integer` objects (`{ low, high, unsigned }`) when a `.toNumber()`
 * call is missing upstream - normalize defensively so the UI never renders
 * `[object Object]`.
 */
function toSafeNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (isNeo4jIntegerLike(value)) return value.high === 0 ? value.low : value.high * 2 ** 32 + value.low;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Wraps `GET /v1/dashboard/stats` (`DashboardController`, `conference-web-api`,
 * `REPORT_VIEW_ALL`). Counts are normalized to plain numbers - see `toSafeNumber`.
 */
export const dashboardService = {
    async getStats(): Promise<DashboardResponse> {
        const { data } = await httpClient.get<DashboardResponse | null>('/dashboard/stats');
        // Empty stats (`null`/`204`) is a valid "nothing to report yet" state, not an error.
        return {
            organizerStats: (data?.organizerStats ?? []).map((stat) => ({ ...stat, count: toSafeNumber(stat.count) })),
            providerUsage: (data?.providerUsage ?? []).map((usage) => ({ ...usage, usageCount: toSafeNumber(usage.usageCount) }))
        };
    }
};
