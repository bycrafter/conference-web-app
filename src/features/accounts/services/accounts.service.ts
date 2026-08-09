import httpClient from '@/services/httpClient';
import { normalizeAccountSummaryDto, type AccountSummaryDto, type RawAccountSummaryDto, type SearchAccountsParams } from '@/types/account.types';

/**
 * Wraps `GET /v1/accounts/search` (`AccountController#search`, `conference-web-api`).
 * Backs both the Attendees `<AutoComplete>` (email suggestions) and the
 * "On Behalf Of" organizer/admin picker in `CreateEventDialog.vue`.
 */
export const accountsService = {
    async search(params: SearchAccountsParams): Promise<AccountSummaryDto[]> {
        const { data } = await httpClient.get<RawAccountSummaryDto[]>('/accounts/search', { params });
        return data.map(normalizeAccountSummaryDto);
    },
    /**
     * Wraps `POST /v1/accounts/resolve-emails` (`AccountController#resolveEmails`).
     * Batch-resolves raw participant emails into internal account profiles - emails
     * with no matching account (external guests) are simply absent from the result.
     */
    async resolveByEmails(emails: string[]): Promise<AccountSummaryDto[]> {
        if (emails.length === 0) {
            return [];
        }
        const { data } = await httpClient.post<RawAccountSummaryDto[]>('/accounts/resolve-emails', { emails });
        return data.map(normalizeAccountSummaryDto);
    }
};
