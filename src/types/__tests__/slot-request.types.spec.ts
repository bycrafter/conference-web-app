import { describe, expect, it } from 'vitest';
import {
    SlotRequestStatus,
    normalizeSlotRequestActionResponse,
    normalizeSlotRequestDto,
    normalizeSlotRequestList,
    type RawSlotRequestDto
} from '@/types/slot-request.types';

function buildRaw(overrides: Partial<RawSlotRequestDto> = {}): RawSlotRequestDto {
    return {
        id: 'slot-request-1',
        conferenceId: 'conf-1',
        requesterUsername: 'requester',
        requestedStartTime: 1722924554000,
        requestedEndTime: 1722928154000,
        justification: 'Need a later slot',
        status: 'PENDING',
        conferenceTitle: 'Q3 Roadmap Review',
        ...overrides
    };
}

describe('normalizeSlotRequestDto', () => {
    it('givenPlainNumberDates_whenNormalizeSlotRequestDto_thenDatesArePassedThrough', () => {
        const dto = normalizeSlotRequestDto(buildRaw());

        expect(dto.requestedStartTime).toBe(1722924554000);
        expect(dto.requestedEndTime).toBe(1722928154000);
        expect(dto.status).toBe(SlotRequestStatus.PENDING);
    });

    it('givenProtobufLongObjectDates_whenNormalizeSlotRequestDto_thenStartAndEndAreParsedEpochMillis', () => {
        // 1722924554000 = (high * 4294967296) + (low >>> 0)
        const high = Math.floor(1722924554000 / 4294967296);
        const low = 1722924554000 - high * 4294967296;
        const raw = buildRaw({
            requestedStartTime: { low, high },
            requestedEndTime: 1722928154000
        });

        const dto = normalizeSlotRequestDto(raw);

        expect(dto.requestedStartTime).toBe(1722924554000);
        expect(dto.requestedEndTime).toBe(1722928154000);
        expect(Number.isNaN(dto.requestedStartTime)).toBe(false);
        expect(Number.isNaN(dto.requestedEndTime)).toBe(false);
    });

    it('givenUnparsableDates_whenNormalizeSlotRequestDto_thenFallsBackToZeroInsteadOfInvalidDate', () => {
        const raw = buildRaw({ requestedStartTime: null, requestedEndTime: undefined });

        const dto = normalizeSlotRequestDto(raw);

        expect(dto.requestedStartTime).toBe(0);
        expect(dto.requestedEndTime).toBe(0);
    });
});

describe('normalizeSlotRequestList', () => {
    it('givenSlotRequests_whenNormalizeSlotRequestList_thenNormalizesEachEntry', () => {
        const result = normalizeSlotRequestList({ slotRequests: [buildRaw(), buildRaw({ id: 'slot-request-2', status: 'APPROVED' })] });

        expect(result).toHaveLength(2);
        expect(result[0].status).toBe(SlotRequestStatus.PENDING);
        expect(result[1].status).toBe(SlotRequestStatus.APPROVED);
    });

    it('givenNullOrMissingResponse_whenNormalizeSlotRequestList_thenReturnsEmptyArray', () => {
        expect(normalizeSlotRequestList(null)).toEqual([]);
        expect(normalizeSlotRequestList({})).toEqual([]);
    });
});

describe('normalizeSlotRequestActionResponse', () => {
    it('givenLongObjectDatesInNestedSlotRequest_whenNormalizeSlotRequestActionResponse_thenNestedDatesAreParsed', () => {
        const high = Math.floor(1722924554000 / 4294967296);
        const low = 1722924554000 - high * 4294967296;
        const raw = {
            success: true,
            message: 'Approved',
            slotRequest: buildRaw({ requestedStartTime: { low, high } })
        };

        const response = normalizeSlotRequestActionResponse(raw);

        expect(response.slotRequest?.requestedStartTime).toBe(1722924554000);
    });

    it('givenNullResponse_whenNormalizeSlotRequestActionResponse_thenReturnsSafeDefaults', () => {
        expect(normalizeSlotRequestActionResponse(null)).toEqual({ success: false, message: '', slotRequest: null });
    });
});
