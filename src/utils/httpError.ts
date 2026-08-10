import { isAxiosError } from 'axios';

/**
 * Extracts a user-facing error message from a BFF (`conference-web-api`) error response.
 * Nest's default exception filter replies with `{ statusCode, message, error }`, where
 * `message` is either a plain string or a `string[]` (class-validator errors) - normalize
 * both shapes to a single displayable string, falling back to `fallback` when the BFF gave
 * us nothing usable (network failure, unexpected shape, empty message, etc.).
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
    if (isAxiosError(error)) {
        const message = error.response?.data?.message;
        if (Array.isArray(message) && message.length > 0) {
            return message.join(' ');
        }
        if (typeof message === 'string' && message.trim().length > 0) {
            return message;
        }
    }
    return fallback;
}
