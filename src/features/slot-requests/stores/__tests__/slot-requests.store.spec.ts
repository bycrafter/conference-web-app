import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSlotRequestsStore } from '@/features/slot-requests/stores/slot-requests.store';
import { slotRequestsService } from '@/features/slot-requests/services/slot-requests.service';
import { SlotRequestStatus, type SlotRequestDto } from '@/types/slot-request.types';

vi.mock('@/features/slot-requests/services/slot-requests.service', () => ({
    slotRequestsService: {
        getByToken: vi.fn(),
        create: vi.fn(),
        approve: vi.fn(),
        reject: vi.fn()
    }
}));

function buildDto(overrides: Partial<SlotRequestDto> = {}): SlotRequestDto {
    return {
        id: 'sr-1',
        conferenceId: 'conf-1',
        requesterUsername: 'jdoe',
        requestedStartTime: 1000,
        requestedEndTime: 2000,
        justification: 'Need to shift 30 minutes later due to a conflict',
        status: SlotRequestStatus.PENDING,
        ...overrides
    };
}

describe('slotRequestsStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('givenExistingToken_whenFetchByToken_thenPopulatesCurrent', async () => {
        vi.mocked(slotRequestsService.getByToken).mockResolvedValueOnce(buildDto());
        const store = useSlotRequestsStore();

        await store.fetchByToken('abc123');

        expect(store.current).toEqual(buildDto());
        expect(store.error).toBeNull();
        expect(slotRequestsService.getByToken).toHaveBeenCalledWith('abc123');
    });

    it('givenUnknownToken_whenFetchByToken_thenSetsNotFoundErrorInsteadOfThrowing', async () => {
        vi.mocked(slotRequestsService.getByToken).mockResolvedValueOnce(null);
        const store = useSlotRequestsStore();

        await store.fetchByToken('missing-token');

        expect(store.current).toBeNull();
        expect(store.error).toContain('could not be found');
    });

    it('givenPendingRequest_whenApprove_thenUpdatesCurrentFromResponse', async () => {
        vi.mocked(slotRequestsService.approve).mockResolvedValueOnce({
            success: true,
            message: 'Approved',
            slotRequest: buildDto({ status: SlotRequestStatus.APPROVED })
        });
        const store = useSlotRequestsStore();
        store.current = buildDto();

        const success = await store.approve('abc123');

        expect(success).toBe(true);
        expect(store.current?.status).toBe(SlotRequestStatus.APPROVED);
        expect(slotRequestsService.approve).toHaveBeenCalledWith('abc123');
    });

    it('givenBffRejectsAction_whenApprove_thenSurfacesResponseMessageAsError', async () => {
        vi.mocked(slotRequestsService.approve).mockResolvedValueOnce({ success: false, message: 'Already processed', slotRequest: null });
        const store = useSlotRequestsStore();

        const success = await store.approve('abc123');

        expect(success).toBe(false);
        expect(store.error).toBe('Already processed');
    });

    it('givenPendingRequest_whenReject_thenUpdatesCurrentFromResponse', async () => {
        vi.mocked(slotRequestsService.reject).mockResolvedValueOnce({
            success: true,
            message: 'Rejected',
            slotRequest: buildDto({ status: SlotRequestStatus.REJECTED })
        });
        const store = useSlotRequestsStore();

        const success = await store.reject('abc123');

        expect(success).toBe(true);
        expect(store.current?.status).toBe(SlotRequestStatus.REJECTED);
    });
});
