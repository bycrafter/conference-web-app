import { defineStore } from 'pinia';
import { slotRequestsService } from '@/features/slot-requests/services/slot-requests.service';
import { extractErrorMessage } from '@/utils/httpError';
import { SlotRequestStatus, type CreateSlotRequestPayload, type SlotRequestDto } from '@/types/slot-request.types';

interface SlotRequestsState {
    /** The single slot request currently looked up by its one-time action token (email link). */
    current: SlotRequestDto | null;
    /** Admin queue (`SLOT_REQUEST_MANAGE_ALL`) backing the listing table, filtered by `statusFilter`. */
    items: SlotRequestDto[];
    /** Defaults to `PENDING` per the unresolved-requests-first business rule. */
    statusFilter: SlotRequestStatus;
    loading: boolean;
    processing: boolean;
    error: string | null;
}

/**
 * Admin queue listing (`ListSlotRequests`, filterable by status) plus the
 * token-scoped single-record lookup, create, and Approve/Reject workflow.
 */
export const useSlotRequestsStore = defineStore('slotRequests', {
    state: (): SlotRequestsState => ({
        current: null,
        items: [],
        statusFilter: SlotRequestStatus.PENDING,
        loading: false,
        processing: false,
        error: null
    }),
    actions: {
        async fetchList(status: SlotRequestStatus = this.statusFilter): Promise<void> {
            this.statusFilter = status;
            this.loading = true;
            this.error = null;
            try {
                this.items = await slotRequestsService.list(
                    status === SlotRequestStatus.SLOT_REQUEST_STATUS_UNSPECIFIED ? undefined : status
                );
            } catch (err) {
                this.items = [];
                this.error = extractErrorMessage(err, 'Failed to load slot requests.');
            } finally {
                this.loading = false;
            }
        },
        async fetchByToken(token: string): Promise<void> {
            this.loading = true;
            this.error = null;
            try {
                this.current = await slotRequestsService.getByToken(token);
                if (!this.current) {
                    this.error = 'This slot request could not be found, or the link has expired.';
                }
            } catch (err) {
                this.current = null;
                this.error = extractErrorMessage(err, 'Failed to load the slot request.');
            } finally {
                this.loading = false;
            }
        },
        async create(payload: CreateSlotRequestPayload): Promise<SlotRequestDto> {
            return slotRequestsService.create(payload);
        },
        async approve(token: string): Promise<boolean> {
            this.processing = true;
            this.error = null;
            try {
                const response = await slotRequestsService.approve(token);
                this.current = response.slotRequest;
                if (!response.success) {
                    this.error = response.message || 'Failed to approve the slot request.';
                }
                return response.success;
            } catch (err) {
                this.error = extractErrorMessage(err, 'Failed to approve the slot request.');
                return false;
            } finally {
                this.processing = false;
            }
        },
        async reject(token: string): Promise<boolean> {
            this.processing = true;
            this.error = null;
            try {
                const response = await slotRequestsService.reject(token);
                this.current = response.slotRequest;
                if (!response.success) {
                    this.error = response.message || 'Failed to reject the slot request.';
                }
                return response.success;
            } catch (err) {
                this.error = extractErrorMessage(err, 'Failed to reject the slot request.');
                return false;
            } finally {
                this.processing = false;
            }
        },
        /** Replaces a row in `items` with its freshly resolved snapshot - keeps the admin queue in sync in-place after an inline action, without a full refetch. */
        syncItem(slotRequest: SlotRequestDto): void {
            const index = this.items.findIndex((item) => item.id === slotRequest.id);
            if (index !== -1) {
                this.items.splice(index, 1, slotRequest);
            }
        },
        /** Inline row action (admin queue, `SLOT_REQUEST_MANAGE_ALL`) - approves directly by ID, bypassing token validation, and syncs the row in-place. */
        async approveById(id: string): Promise<boolean> {
            this.processing = true;
            this.error = null;
            try {
                const response = await slotRequestsService.approveById(id);
                if (response.slotRequest) {
                    this.syncItem(response.slotRequest);
                }
                if (!response.success) {
                    this.error = response.message || 'Failed to approve the slot request.';
                }
                return response.success;
            } catch (err) {
                this.error = extractErrorMessage(err, 'Failed to approve the slot request.');
                return false;
            } finally {
                this.processing = false;
            }
        },
        /** Inline row action (admin queue, `SLOT_REQUEST_MANAGE_ALL`) - rejects directly by ID, bypassing token validation, and syncs the row in-place. */
        async rejectById(id: string): Promise<boolean> {
            this.processing = true;
            this.error = null;
            try {
                const response = await slotRequestsService.rejectById(id);
                if (response.slotRequest) {
                    this.syncItem(response.slotRequest);
                }
                if (!response.success) {
                    this.error = response.message || 'Failed to reject the slot request.';
                }
                return response.success;
            } catch (err) {
                this.error = extractErrorMessage(err, 'Failed to reject the slot request.');
                return false;
            } finally {
                this.processing = false;
            }
        }
    }
});
