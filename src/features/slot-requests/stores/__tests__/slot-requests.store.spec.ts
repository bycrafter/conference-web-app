import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSlotRequestsStore } from '@/features/slot-requests/stores/slot-requests.store';
import { slotRequestsService } from '@/features/slot-requests/services/slot-requests.service';
import { SlotRequestStatus, type SlotRequestDto } from '@/types/slot-request.types';

vi.mock('@/features/slot-requests/services/slot-requests.service', () => ({
    slotRequestsService: {
        getByToken: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        approve: vi.fn(),
        reject: vi.fn(),
        approveById: vi.fn(),
        rejectById: vi.fn()
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

    it('givenFreshStore_whenInitialized_thenStatusFilterDefaultsToPending', () => {
        const store = useSlotRequestsStore();

        expect(store.statusFilter).toBe(SlotRequestStatus.PENDING);
    });

    it('givenNoArgs_whenFetchList_thenUsesCurrentStatusFilter', async () => {
        vi.mocked(slotRequestsService.list).mockResolvedValueOnce([buildDto()]);
        const store = useSlotRequestsStore();

        await store.fetchList();

        expect(slotRequestsService.list).toHaveBeenCalledWith(SlotRequestStatus.PENDING);
        expect(store.items).toEqual([buildDto()]);
        expect(store.error).toBeNull();
    });

    it('givenExplicitStatus_whenFetchList_thenUpdatesStatusFilterAndFetches', async () => {
        vi.mocked(slotRequestsService.list).mockResolvedValueOnce([buildDto({ status: SlotRequestStatus.APPROVED })]);
        const store = useSlotRequestsStore();

        await store.fetchList(SlotRequestStatus.APPROVED);

        expect(store.statusFilter).toBe(SlotRequestStatus.APPROVED);
        expect(slotRequestsService.list).toHaveBeenCalledWith(SlotRequestStatus.APPROVED);
        expect(store.items).toEqual([buildDto({ status: SlotRequestStatus.APPROVED })]);
    });

    it('givenUnspecifiedStatus_whenFetchList_thenOmitsStatusFromServiceCall', async () => {
        vi.mocked(slotRequestsService.list).mockResolvedValueOnce([buildDto()]);
        const store = useSlotRequestsStore();

        await store.fetchList(SlotRequestStatus.SLOT_REQUEST_STATUS_UNSPECIFIED);

        expect(slotRequestsService.list).toHaveBeenCalledWith(undefined);
    });

    it('givenServiceFailure_whenFetchList_thenSetsErrorInsteadOfThrowing', async () => {
        vi.mocked(slotRequestsService.list).mockRejectedValueOnce(new Error('network error'));
        const store = useSlotRequestsStore();

        await store.fetchList();

        expect(store.items).toEqual([]);
        expect(store.error).toBe('Failed to load slot requests.');
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

    it('givenPendingRowInList_whenApproveById_thenSyncsThatRowInPlace', async () => {
        vi.mocked(slotRequestsService.approveById).mockResolvedValueOnce({
            success: true,
            message: 'Approved',
            slotRequest: buildDto({ id: 'sr-2', status: SlotRequestStatus.APPROVED })
        });
        const store = useSlotRequestsStore();
        store.items = [buildDto({ id: 'sr-1' }), buildDto({ id: 'sr-2' })];

        const success = await store.approveById('sr-2');

        expect(success).toBe(true);
        expect(slotRequestsService.approveById).toHaveBeenCalledWith('sr-2');
        expect(store.items).toEqual([buildDto({ id: 'sr-1' }), buildDto({ id: 'sr-2', status: SlotRequestStatus.APPROVED })]);
    });

    it('givenBffRejectsAction_whenApproveById_thenSurfacesResponseMessageAsErrorWithoutMutatingList', async () => {
        vi.mocked(slotRequestsService.approveById).mockResolvedValueOnce({ success: false, message: 'Already resolved', slotRequest: null });
        const store = useSlotRequestsStore();
        store.items = [buildDto({ id: 'sr-2' })];

        const success = await store.approveById('sr-2');

        expect(success).toBe(false);
        expect(store.error).toBe('Already resolved');
        expect(store.items).toEqual([buildDto({ id: 'sr-2' })]);
    });

    it('givenPendingRowInList_whenRejectById_thenSyncsThatRowInPlace', async () => {
        vi.mocked(slotRequestsService.rejectById).mockResolvedValueOnce({
            success: true,
            message: 'Rejected',
            slotRequest: buildDto({ id: 'sr-2', status: SlotRequestStatus.REJECTED })
        });
        const store = useSlotRequestsStore();
        store.items = [buildDto({ id: 'sr-2' })];

        const success = await store.rejectById('sr-2');

        expect(success).toBe(true);
        expect(slotRequestsService.rejectById).toHaveBeenCalledWith('sr-2');
        expect(store.items).toEqual([buildDto({ id: 'sr-2', status: SlotRequestStatus.REJECTED })]);
    });

    it('givenServiceFailure_whenApproveById_thenSetsErrorInsteadOfThrowing', async () => {
        vi.mocked(slotRequestsService.approveById).mockRejectedValueOnce(new Error('network error'));
        const store = useSlotRequestsStore();

        const success = await store.approveById('sr-2');

        expect(success).toBe(false);
        expect(store.error).toBe('Failed to approve the slot request.');
    });
});
