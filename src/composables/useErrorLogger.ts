import httpClient from '@/services/httpClient';
import { useAuthStore } from '@/stores/authStore';

/** Payload for the ASSUMED `POST /v1/client-logs` endpoint (no BFF controller exists for it yet - see notes on `useErrorLogger`). */
interface ClientLogPayload {
    message: string;
    stack?: string;
    componentInfo?: string;
    username: string | null;
    url: string;
    userAgent: string;
    timestamp: string;
}

/**
 * ASSUMED - `conference-web-api` has no client-side error/log ingestion
 * endpoint today. Posts best-effort to `POST /v1/client-logs`; failures are
 * swallowed so a broken logging pipeline never masks the original error or
 * throws a secondary one from `app.config.errorHandler`.
 */
export function useErrorLogger() {
    function logError(error: unknown, componentInfo?: string): void {
        const authStore = useAuthStore();
        const normalized = error instanceof Error ? error : new Error(String(error));

        const payload: ClientLogPayload = {
            message: normalized.message,
            stack: normalized.stack,
            componentInfo,
            username: authStore.username,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };

        // eslint-disable-next-line no-console
        console.error('[Bycrafter]', normalized, componentInfo);

        httpClient.post('/client-logs', payload).catch(() => {
            // Best-effort; never let logging itself throw.
        });
    }

    return { logError };
}
