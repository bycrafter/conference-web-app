import { describe, expect, it } from 'vitest';
import { AccountStatus, normalizeAccountDto, normalizeAccountStatus, type RawAccountDto } from '@/types/account.types';

function buildRaw(overrides: Partial<RawAccountDto> = {}): RawAccountDto {
    return {
        id: '1',
        username: 'jdoe',
        email: 'jdoe@bycrafter.com',
        role: 'STANDARD_ACCOUNT',
        firstName: 'Jane',
        lastName: 'Doe',
        status: 'VERIFIED',
        ...overrides
    };
}

describe('normalizeAccountStatus', () => {
    // Regression test: the BFF/gRPC hop can serialize `AccountStatus` as its numeric
    // wire value (0-3) instead of the string name, which previously fell through to the
    // `PENDING` fallback for every account regardless of its real status.
    it('givenNumericWireValues_whenNormalizeAccountStatus_thenMapsToMatchingEnumMember', () => {
        expect(normalizeAccountStatus(0)).toBe(AccountStatus.UNKNOWN_STATUS);
        expect(normalizeAccountStatus(1)).toBe(AccountStatus.PENDING);
        expect(normalizeAccountStatus(2)).toBe(AccountStatus.VERIFIED);
        expect(normalizeAccountStatus(3)).toBe(AccountStatus.PASSIVE);
    });

    it('givenStringWireValues_whenNormalizeAccountStatus_thenMapsToMatchingEnumMember', () => {
        expect(normalizeAccountStatus('PENDING')).toBe(AccountStatus.PENDING);
        expect(normalizeAccountStatus('VERIFIED')).toBe(AccountStatus.VERIFIED);
        expect(normalizeAccountStatus('PASSIVE')).toBe(AccountStatus.PASSIVE);
    });

    it('givenUnknownOrMissingValue_whenNormalizeAccountStatus_thenFallsBackToPending', () => {
        expect(normalizeAccountStatus(undefined)).toBe(AccountStatus.PENDING);
        expect(normalizeAccountStatus(null)).toBe(AccountStatus.PENDING);
        expect(normalizeAccountStatus('SOMETHING_ELSE')).toBe(AccountStatus.PENDING);
        expect(normalizeAccountStatus(99)).toBe(AccountStatus.PENDING);
    });
});

describe('normalizeAccountDto', () => {
    it('givenNumericStatusFromBff_whenNormalizeAccountDto_thenStatusIsCorrectlyMapped', () => {
        const dto = normalizeAccountDto(buildRaw({ status: 2 }));

        expect(dto.status).toBe(AccountStatus.VERIFIED);
    });
});
