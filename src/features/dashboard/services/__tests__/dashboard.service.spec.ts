import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { dashboardService } from '@/features/dashboard/services/dashboard.service';

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn()
    }
}));

describe('dashboardService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('givenEmptyBffResponse_whenGetStats_thenResolvesToEmptyStatsInsteadOfThrowing', async () => {
        // The `httpClient` interceptor normalizes a `204 No Content` reply to `null`.
        // Empty stats is a valid "nothing to report yet" state, not an error.
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: null });

        const result = await dashboardService.getStats();

        expect(result).toEqual({ organizerStats: [], providerUsage: [] });
    });

    it('givenPopulatedBffResponse_whenGetStats_thenReturnsStatsVerbatim', async () => {
        const data = { organizerStats: [{ username: 'jdoe', count: 3 }], providerUsage: [{ providerId: 'p1', usageCount: 5 }] };
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data });

        const result = await dashboardService.getStats();

        expect(result).toEqual(data);
    });

    it('givenNeo4jIntegerLikeCounts_whenGetStats_thenNormalizesToPlainNumbers', async () => {
        // Regression: `conference-web-api` occasionally forwards raw Neo4j driver
        // `Integer` objects instead of calling `.toNumber()`, breaking the UI (renders
        // `[object Object]` for the organizer's conference count).
        const data = {
            organizerStats: [{ username: 'jdoe', count: { low: 9, high: 0, unsigned: false } }],
            providerUsage: [{ providerId: 'p1', usageCount: { low: 5, high: 0, unsigned: false } }]
        };
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data });

        const result = await dashboardService.getStats();

        expect(result).toEqual({ organizerStats: [{ username: 'jdoe', count: 9 }], providerUsage: [{ providerId: 'p1', usageCount: 5 }] });
    });
});
