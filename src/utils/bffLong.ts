/**
 * The gRPC contract serializes 64-bit `int64`/Long fields (e.g. epoch millis timestamps,
 * paginated result counts) as `{ low, high, unsigned }` protobuf Long objects over JSON
 * rather than a plain number, since a JS `number` can't safely hold the full 64-bit range.
 * Plain numbers/numeric-strings (e.g. from mocks/tests) are passed through unchanged;
 * unparsable input falls back to `0` rather than `NaN`, which callers (Vue prop type
 * checks, `toIsoStringOrNull`, etc.) can defensively rely on.
 */
export function parseBffLong(raw: unknown): number {
    if (typeof raw === 'number') {
        return raw;
    }
    if (typeof raw === 'string') {
        const parsed = Number(raw);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (raw && typeof raw === 'object' && 'low' in raw && 'high' in raw) {
        const { low, high } = raw as { low: number; high: number };
        return high * 4294967296 + (low >>> 0);
    }
    return 0;
}
