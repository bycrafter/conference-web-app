import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { conferencesService } from '@/features/conferences/services/conferences.service';

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

describe('conferencesService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('givenEmptyBffResponse_whenSearch_thenResolvesToEmptyPageInsteadOfThrowing', async () => {
        // The `httpClient` interceptor normalizes a `204 No Content`/empty-string reply
        // to `null`. An empty search result (e.g. Search view / Calendar range with no
        // conferences) is a valid state, not an error.
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: null });

        const result = await conferencesService.search({});

        expect(result).toEqual({ items: [], totalElements: 0, totalPages: 0, page: 0, size: 0 });
    });

    it('givenNullItemsInBffResponse_whenSearch_thenTreatsItemsAsEmptyArray', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: null, totalElements: 0, totalPages: 0, page: 0, size: 10 } });

        const result = await conferencesService.search({});

        expect(result.items).toEqual([]);
    });

    it('givenProtobufLongObjectTotalElements_whenSearch_thenNormalizesToPlainNumber', async () => {
        // Regression test: the BFF/gRPC hop can serialize `totalElements` (and the other
        // pagination counters) as a protobuf `{ low, high, unsigned }` Long object instead
        // of a plain number, which fails Vue's `Number` prop type check on `<Paginator>`.
        vi.mocked(httpClient.get).mockResolvedValueOnce({
            data: { items: [], totalElements: { low: 13, high: 0, unsigned: false }, totalPages: { low: 2, high: 0, unsigned: false }, page: 0, size: 10 }
        });

        const result = await conferencesService.search({});

        expect(result.totalElements).toBe(13);
        expect(result.totalPages).toBe(2);
        expect(typeof result.totalElements).toBe('number');
    });
});
