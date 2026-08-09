import { ref } from 'vue';
import { accountsService } from '@/features/accounts/services/accounts.service';

/**
 * Resolves a conference's raw participant email array against known internal
 * accounts (`POST /v1/accounts/resolve-emails`). Internal users are displayed
 * as `firstName lastName`; emails with no matching account (external guests)
 * simply fall back to the raw email.
 */
export function useParticipantResolver() {
    const resolving = ref(false);
    const namesByEmail = ref<Record<string, string>>({});

    async function resolve(emails: string[]): Promise<void> {
        namesByEmail.value = {};
        if (emails.length === 0) {
            return;
        }
        resolving.value = true;
        try {
            const accounts = await accountsService.resolveByEmails(emails);
            const resolved: Record<string, string> = {};
            for (const account of accounts) {
                const displayName = `${account.firstName ?? ''} ${account.lastName ?? ''}`.trim();
                resolved[account.email.toLowerCase()] = displayName || account.email;
            }
            namesByEmail.value = resolved;
        } catch {
            // Best-effort enrichment - fall back to raw emails on failure.
            namesByEmail.value = {};
        } finally {
            resolving.value = false;
        }
    }

    /** Display name for a participant email: resolved `firstName lastName`, or the raw email if unmatched. */
    function displayNameFor(email: string): string {
        return namesByEmail.value[email.toLowerCase()] ?? email;
    }

    return { resolving, namesByEmail, resolve, displayNameFor };
}
