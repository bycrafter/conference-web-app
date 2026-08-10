import { beforeEach, describe, expect, it, vi } from 'vitest';
import httpClient from '@/services/httpClient';
import { slotRequestsService } from '@/features/slot-requests/services/slot-requests.service';
import { SlotRequestStatus, type CreateSlotRequestPayload } from '@/types/slot-request.types';

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

function buildRawDto(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sr-1',
        conferenceId: 'conf-1',
        requesterUsername: 'jdoe',
        requestedStartTime: 1000,
        requestedEndTime: 2000,
        justification: 'Need to shift 30 minutes later due to a conflict',
        status: 'PENDING',
        ...overrides
    };
}

describe('slotRequestsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('givenActionToken_whenGetByToken_thenCallsExactBffRouteAndNormalizesStatus', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: buildRawDto() });

        const result = await slotRequestsService.getByToken('abc123');

        expect(httpClient.get).toHaveBeenCalledWith('/slot-requests/abc123');
        expect(result?.status).toBe(SlotRequestStatus.PENDING);
    });

    it('givenTokenNotFound_whenGetByToken_thenResolvesNullInsteadOfThrowing', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: null });

        const result = await slotRequestsService.getByToken('missing-token');

        expect(result).toBeNull();
    });

    it('givenStatusFilter_whenList_thenCallsExactBffRouteWithStatusParam', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [buildRawDto()] } });

        const result = await slotRequestsService.list(SlotRequestStatus.PENDING);

        expect(httpClient.get).toHaveBeenCalledWith('/slot-requests', { params: { status: SlotRequestStatus.PENDING } });
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe(SlotRequestStatus.PENDING);
    });

    it('givenNoStatusFilter_whenList_thenOmitsStatusParam', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [] } });

        await slotRequestsService.list();

        expect(httpClient.get).toHaveBeenCalledWith('/slot-requests', { params: { status: undefined } });
    });

    it('givenEmptyBffResponse_whenList_thenReturnsEmptyArrayInsteadOfThrowing', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: null });

        const result = await slotRequestsService.list();

        expect(result).toEqual([]);
    });

    it('givenCreatePayload_whenCreate_thenPostsExactBffRouteAndPayloadShape', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({ data: buildRawDto() });
        const payload: CreateSlotRequestPayload = {
            conferenceId: 'conf-1',
            requestedStartTime: 1000,
            requestedEndTime: 2000,
            justification: 'Need to shift 30 minutes later due to a conflict'
        };

        await slotRequestsService.create(payload);

        // Must match `CreateSlotRequestDto` exactly: conferenceId/requestedStartTime/requestedEndTime/justification.
        expect(httpClient.post).toHaveBeenCalledWith('/slot-requests', payload);
    });

    it('givenActionToken_whenApprove_thenPostsExactBffRouteAndNormalizesResponse', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { success: true, message: 'Approved', slotRequest: buildRawDto({ status: 'APPROVED' }) }
        });

        const result = await slotRequestsService.approve('abc123');

        expect(httpClient.post).toHaveBeenCalledWith('/slot-requests/abc123/approve');
        expect(result.success).toBe(true);
        expect(result.slotRequest?.status).toBe(SlotRequestStatus.APPROVED);
    });

    it('givenActionToken_whenReject_thenPostsExactBffRoute', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { success: true, message: 'Rejected', slotRequest: buildRawDto({ status: 'REJECTED' }) }
        });

        const result = await slotRequestsService.reject('abc123');

        expect(httpClient.post).toHaveBeenCalledWith('/slot-requests/abc123/reject');
        expect(result.slotRequest?.status).toBe(SlotRequestStatus.REJECTED);
    });

    it('givenEmptyBffResponse_whenApprove_thenResolvesGracefullyInsteadOfThrowing', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({ data: null });

        const result = await slotRequestsService.approve('abc123');

        expect(result).toEqual({ success: false, message: '', slotRequest: null });
    });

    it('givenRequestId_whenApproveById_thenPostsExactIdBasedBffRoute', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { success: true, message: 'Approved', slotRequest: buildRawDto({ id: 'sr-2', status: 'APPROVED' }) }
        });

        const result = await slotRequestsService.approveById('sr-2');

        expect(httpClient.post).toHaveBeenCalledWith('/slot-requests/id/sr-2/approve');
        expect(result.success).toBe(true);
        expect(result.slotRequest?.status).toBe(SlotRequestStatus.APPROVED);
    });

    it('givenRequestId_whenRejectById_thenPostsExactIdBasedBffRoute', async () => {
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { success: true, message: 'Rejected', slotRequest: buildRawDto({ id: 'sr-2', status: 'REJECTED' }) }
        });

        const result = await slotRequestsService.rejectById('sr-2');

        expect(httpClient.post).toHaveBeenCalledWith('/slot-requests/id/sr-2/reject');
        expect(result.slotRequest?.status).toBe(SlotRequestStatus.REJECTED);
    });
});
