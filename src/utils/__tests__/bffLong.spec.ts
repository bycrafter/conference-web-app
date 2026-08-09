import { describe, expect, it } from 'vitest';
import { parseBffLong } from '@/utils/bffLong';

describe('parseBffLong', () => {
    it('givenPlainNumber_whenParseBffLong_thenReturnsSameNumber', () => {
        expect(parseBffLong(13)).toBe(13);
    });

    it('givenNumericString_whenParseBffLong_thenReturnsParsedNumber', () => {
        expect(parseBffLong('13')).toBe(13);
    });

    it('givenProtobufLongObject_whenParseBffLong_thenReturnsCombinedValue', () => {
        // 1722924554000 = (high * 4294967296) + (low >>> 0)
        const high = Math.floor(1722924554000 / 4294967296);
        const low = 1722924554000 - high * 4294967296;
        expect(parseBffLong({ low, high })).toBe(1722924554000);
    });

    it('givenSmallProtobufLongObject_whenParseBffLong_thenReturnsCombinedValue', () => {
        // Reproduces the reported bug: `{ low: 13, high: 0, unsigned: false }` for a small
        // paginated result count (e.g. `totalElements`) rather than an epoch-millis timestamp.
        expect(parseBffLong({ low: 13, high: 0, unsigned: false })).toBe(13);
    });

    it('givenUnparsableValue_whenParseBffLong_thenReturnsZero', () => {
        expect(parseBffLong(null)).toBe(0);
        expect(parseBffLong(undefined)).toBe(0);
        expect(parseBffLong('not-a-number')).toBe(0);
    });
});
