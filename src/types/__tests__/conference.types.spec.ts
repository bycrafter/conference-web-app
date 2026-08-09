import { describe, expect, it } from 'vitest';
import { ConferenceStatus, normalizeConferenceDto, parseBffDate, type RawConferenceDto } from '@/types/conference.types';

function buildRaw(overrides: Partial<RawConferenceDto> = {}): RawConferenceDto {
    return {
        id: 'conf-1',
        title: 'Sprint Review',
        description: '',
        startTime: 1722924554000,
        endTime: 1722928154000,
        providerId: 'provider-1',
        location: '',
        privateInfo: '',
        ownerUsername: 'owner',
        organizerUsername: 'owner',
        status: 'SCHEDULED',
        joinLink: '',
        participants: [],
        isStarred: false,
        ...overrides
    };
}

describe('parseBffDate', () => {
    it('givenPlainNumber_whenParseBffDate_thenReturnsSameNumber', () => {
        expect(parseBffDate(1722924554000)).toBe(1722924554000);
    });

    it('givenNumericString_whenParseBffDate_thenReturnsParsedNumber', () => {
        expect(parseBffDate('1722924554000')).toBe(1722924554000);
    });

    it('givenProtobufLongObject_whenParseBffDate_thenReturnsCombinedEpochMillis', () => {
        // 1722924554000 = (high * 4294967296) + (low >>> 0)
        const high = Math.floor(1722924554000 / 4294967296);
        const low = 1722924554000 - high * 4294967296;
        expect(parseBffDate({ low, high })).toBe(1722924554000);
    });

    it('givenUnparsableValue_whenParseBffDate_thenReturnsZero', () => {
        expect(parseBffDate(null)).toBe(0);
        expect(parseBffDate(undefined)).toBe(0);
        expect(parseBffDate('not-a-number')).toBe(0);
    });
});

describe('normalizeConferenceDto', () => {
    it('givenLongObjectDates_whenNormalizeConferenceDto_thenStartAndEndAreParsedEpochMillis', () => {
        const high = Math.floor(1722924554000 / 4294967296);
        const low = 1722924554000 - high * 4294967296;
        const raw = buildRaw({ startTime: { low, high } as unknown as number, endTime: 1722928154000 });

        const dto = normalizeConferenceDto(raw);

        expect(dto.startTime).toBe(1722924554000);
        expect(dto.endTime).toBe(1722928154000);
        expect(dto.status).toBe(ConferenceStatus.SCHEDULED);
    });
});
