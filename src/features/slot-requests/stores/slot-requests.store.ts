import { defineStore } from 'pinia';
import { slotRequestsService } from '@/features/slot-requests/services/slot-requests.service';
import type { CreateSlotRequestPayload, SlotRequestDto } from '@/types/slot-request.types';

interface SlotRequestsState {
    /** The single slot request currently looked up by its one-time action token (email link). */
    current: SlotRequestDto | null;
    loading: boolean;
    processing: boolean;
    error: string | null;
}

/**
 * Requester-side `create` plus the token-scoped Approve/Reject workflow.
 * There is NO list/search RPC on the real BFF contract - see `slot-request.types.ts`.
 */
export const useSlotRequestsStore = defineStore('slotRequests', {
    state: (): SlotRequestsState => ({
        current: null,
        loading: false,
        processing: false,
        error: null
    }),
    actions: {
        async fetchByToken(token: string): Promise<void> {
            this.loading = true;
            this.error = null;
            try {
                this.current = await slotRequestsService.getByToken(token);
                if (!this.current) {
                    this.error = 'This slot request could not be found, or the link has expired.';
                }
            } catch {
                this.current = null;
                this.error = 'Failed to load the slot request.';
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
            } catch {
                this.error = 'Failed to approve the slot request.';
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
            } catch {
                this.error = 'Failed to reject the slot request.';
                return false;
            } finally {
                this.processing = false;
            }
        }
    }
});
