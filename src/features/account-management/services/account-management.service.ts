import httpClient from '@/services/httpClient';
import { parseBffLong } from '@/utils/bffLong';
import {
    AccountStatus,
    normalizeAccountDto,
    type AccountDto,
    type CreateAccountPayload,
    type ListAccountsParams,
    type PaginatedAccountResponse,
    type RawAccountDto,
    type RawPaginatedAccountResponse,
    type UpdateAccountPayload
} from '@/types/account.types';

/** Empty page fallback - the BFF may reply with `null`/`204` when there's simply nothing to return; that's not an error. */
const EMPTY_PAGE: PaginatedAccountResponse = { items: [], totalElements: 0, totalPages: 0, page: 0, size: 0 };

function normalizePaginated(raw: RawPaginatedAccountResponse | null | undefined): PaginatedAccountResponse {
    if (!raw) {
        return EMPTY_PAGE;
    }
    return {
        items: (raw.items ?? []).map(normalizeAccountDto),
        // `totalElements`/`totalPages`/`page`/`size` may arrive as protobuf `{ low, high }` Long
        // objects instead of plain numbers - see `parseBffLong`.
        totalElements: parseBffLong(raw.totalElements),
        totalPages: parseBffLong(raw.totalPages),
        page: parseBffLong(raw.page),
        size: parseBffLong(raw.size)
    };
}

/**
 * Wraps `AccountController` (`conference-web-api`). `list` backs the paged,
 * filterable Account Management grid (`ACCOUNT_VIEW_ALL`/`ACCOUNT_MANAGE_ALL`);
 * `create`/`update`/`remove` back its CRUD actions (`ACCOUNT_MANAGE_ALL`).
 */
export const accountManagementService = {
    async list(params: ListAccountsParams): Promise<PaginatedAccountResponse> {
        const { data } = await httpClient.get<RawPaginatedAccountResponse | null>('/accounts/list', { params });
        return normalizePaginated(data);
    },
    async create(payload: CreateAccountPayload): Promise<AccountDto> {
        const { data } = await httpClient.post<RawAccountDto | null>('/accounts', payload);
        // A `201 Created` with an empty body must NOT be treated as an error - fall back to a
        // client-side DTO built from the payload we already know was accepted (mirrors `providersService.create`).
        return data
            ? normalizeAccountDto(data)
            : { id: crypto.randomUUID(), username: payload.username, email: payload.email, role: payload.role, firstName: payload.firstName, lastName: payload.lastName, status: AccountStatus.PENDING };
    },
    async update(id: string, payload: UpdateAccountPayload): Promise<AccountDto> {
        const { data } = await httpClient.patch<RawAccountDto | null>(`/accounts/${id}`, payload);
        // A `204 No Content`/empty-body reply on a successful PATCH must NOT be treated
        // as an error, and must NOT wipe out the fields we just saved - reconstruct the
        // DTO from the payload that was actually persisted instead (mirrors `providersService.update`).
        // `status` isn't part of `UpdateAccountPayload` (it's not editable here) - the store
        // overwrites this placeholder with the account's actual pre-update status regardless.
        return data
            ? normalizeAccountDto(data)
            : { id, username: '', email: payload.email, role: payload.role, firstName: payload.firstName, lastName: payload.lastName, status: AccountStatus.VERIFIED };
    },
    async remove(id: string): Promise<void> {
        await httpClient.delete(`/accounts/${id}`);
    },
    /** Re-sends the existing temp password email for a `PENDING` account (mail may not have arrived) - `POST /v1/accounts/:id/resend-password`. */
    async resendPassword(id: string): Promise<void> {
        await httpClient.post(`/accounts/${id}/resend-password`);
    },
    /** Generates a brand-new random temp password for a `PENDING` account and emails it - `POST /v1/accounts/:id/reset-password`. */
    async resetPassword(id: string): Promise<void> {
        await httpClient.post(`/accounts/${id}/reset-password`);
    }
};
