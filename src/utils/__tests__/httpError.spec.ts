import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { extractErrorMessage } from '@/utils/httpError';

function buildAxiosError(data: unknown, status = 400): AxiosError {
    return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
        status,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data
    });
}

describe('extractErrorMessage', () => {
    it('givenAxiosErrorWithStringMessage_whenExtracted_thenReturnsBffMessage', () => {
        const error = buildAxiosError({ statusCode: 400, message: 'Provider name already in use.', error: 'Bad Request' });

        const result = extractErrorMessage(error, 'Failed to save the provider.');

        expect(result).toBe('Provider name already in use.');
    });

    it('givenAxiosErrorWithArrayMessage_whenExtracted_thenJoinsValidationMessages', () => {
        const error = buildAxiosError({ statusCode: 400, message: ['name should not be empty', 'email must be a valid email'], error: 'Bad Request' });

        const result = extractErrorMessage(error, 'Failed to save the account.');

        expect(result).toBe('name should not be empty email must be a valid email');
    });

    it('givenAxiosErrorWithoutMessage_whenExtracted_thenReturnsFallback', () => {
        const error = buildAxiosError({ statusCode: 500 });

        const result = extractErrorMessage(error, 'Failed to load providers.');

        expect(result).toBe('Failed to load providers.');
    });

    it('givenAxiosErrorWithBlankMessage_whenExtracted_thenReturnsFallback', () => {
        const error = buildAxiosError({ statusCode: 500, message: '   ' });

        const result = extractErrorMessage(error, 'Failed to load providers.');

        expect(result).toBe('Failed to load providers.');
    });

    it('givenAxiosErrorWithEmptyMessageArray_whenExtracted_thenReturnsFallback', () => {
        const error = buildAxiosError({ statusCode: 400, message: [] });

        const result = extractErrorMessage(error, 'Failed to save the account.');

        expect(result).toBe('Failed to save the account.');
    });

    it('givenNonAxiosError_whenExtracted_thenReturnsFallback', () => {
        const result = extractErrorMessage(new Error('network down'), 'Failed to load dashboard statistics.');

        expect(result).toBe('Failed to load dashboard statistics.');
    });

    it('givenUnknownThrownValue_whenExtracted_thenReturnsFallback', () => {
        const result = extractErrorMessage('some string thrown', 'Failed to load slot requests.');

        expect(result).toBe('Failed to load slot requests.');
    });
});
