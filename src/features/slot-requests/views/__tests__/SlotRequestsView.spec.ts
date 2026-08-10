import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import httpClient from '@/services/httpClient';
import SlotRequestsView from '@/features/slot-requests/views/SlotRequestsView.vue';
import { SlotRequestStatus } from '@/types/slot-request.types';

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

const routeParams: { token?: string } = {};

vi.mock('vue-router', () => ({
    useRoute: () => ({ params: routeParams }),
    useRouter: () => ({
        push: vi.fn(async (to: { params?: { token?: string } }) => {
            routeParams.token = to.params?.token;
        })
    })
}));

function buildRawDto(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sr-1',
        conferenceId: 'conf-1',
        conferenceTitle: 'Sprint Review',
        requesterUsername: 'jdoe',
        requestedStartTime: 1735689600000,
        requestedEndTime: 1735693200000,
        justification: 'Conflict with another meeting',
        status: 'PENDING',
        ...overrides
    };
}

async function mountView() {
    const wrapper = mount(SlotRequestsView, {
        global: {
            plugins: [PrimeVue],
            stubs: {
                Card: { template: '<div><slot name="title" /><slot name="subtitle" /><slot name="content" /></div>' }
            }
        }
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    return wrapper;
}

describe('SlotRequestsView', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        delete routeParams.token;
        vi.stubGlobal(
            'matchMedia',
            vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            })
        );
    });

    it('givenNoTokenSearch_whenMounted_thenListsRequestsFilteredByDefaultPendingStatus', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [buildRawDto()] } });

        const wrapper = await mountView();

        expect(httpClient.get).toHaveBeenCalledWith('/slot-requests', { params: { status: SlotRequestStatus.PENDING } });
        expect(wrapper.text()).toContain('Sprint Review');
        expect(wrapper.text()).toContain('jdoe');
    });

    it('givenTokenInUrl_whenMounted_thenFetchesAndDisplaysOnlyThatSingleRequest', async () => {
        routeParams.token = 'action-token';
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: buildRawDto() });

        const wrapper = await mountView();

        expect(httpClient.get).toHaveBeenCalledWith('/slot-requests/action-token');
        expect(wrapper.text()).toContain('Sprint Review');
        expect(wrapper.findComponent({ name: 'DataTable' }).exists()).toBe(false);
    });

    it('givenActiveTokenSearch_whenClearButtonClicked_thenRevertsToStatusFilteredList', async () => {
        routeParams.token = 'action-token';
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: buildRawDto() });
        const wrapper = await mountView();

        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [buildRawDto({ id: 'sr-2' })] } });
        await wrapper.find('button[aria-label], button').exists();
        const clearButton = wrapper.findAll('button').find((button) => button.text().includes('Clear'));
        await clearButton?.trigger('click');
        await wrapper.vm.$nextTick();
        await wrapper.vm.$nextTick();

        expect(httpClient.get).toHaveBeenLastCalledWith('/slot-requests', { params: { status: SlotRequestStatus.PENDING } });
    });

    it('givenListedRequest_whenMounted_thenShowsReasonAndStackedStartEndTimes', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [buildRawDto()] } });

        const wrapper = await mountView();

        expect(wrapper.text()).toContain('Conflict with another meeting');
        expect(wrapper.text()).toContain(new Date(1735689600000).toLocaleString());
        expect(wrapper.text()).toContain(new Date(1735693200000).toLocaleString());
    });

    it('givenPendingRow_whenMounted_thenShowsApproveAndRejectButtons', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [buildRawDto({ status: 'PENDING' })] } });

        const wrapper = await mountView();

        const approveButton = wrapper.findAll('button').find((button) => button.text().includes('Approve'));
        const rejectButton = wrapper.findAll('button').find((button) => button.text().includes('Reject'));
        expect(approveButton).toBeTruthy();
        expect(rejectButton).toBeTruthy();
    });

    it('givenResolvedRow_whenMounted_thenHidesApproveAndRejectButtons', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [buildRawDto({ status: 'APPROVED' })] } });

        const wrapper = await mountView();

        const approveButton = wrapper.findAll('button').find((button) => button.text().includes('Approve'));
        const rejectButton = wrapper.findAll('button').find((button) => button.text().includes('Reject'));
        expect(approveButton).toBeFalsy();
        expect(rejectButton).toBeFalsy();
    });

    it('givenPendingRow_whenApproveButtonClicked_thenCallsIdBasedApproveRoute', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [buildRawDto({ id: 'sr-9', status: 'PENDING' })] } });
        const wrapper = await mountView();
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { success: true, message: 'Approved', slotRequest: buildRawDto({ id: 'sr-9', status: 'APPROVED' }) }
        });

        const approveButton = wrapper.findAll('button').find((button) => button.text().includes('Approve'));
        await approveButton?.trigger('click');
        await wrapper.vm.$nextTick();
        await wrapper.vm.$nextTick();

        expect(httpClient.post).toHaveBeenCalledWith('/slot-requests/id/sr-9/approve');
    });

    it('givenPendingRow_whenRejectButtonClicked_thenCallsIdBasedRejectRoute', async () => {
        vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { slotRequests: [buildRawDto({ id: 'sr-9', status: 'PENDING' })] } });
        const wrapper = await mountView();
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: { success: true, message: 'Rejected', slotRequest: buildRawDto({ id: 'sr-9', status: 'REJECTED' }) }
        });

        const rejectButton = wrapper.findAll('button').find((button) => button.text().includes('Reject'));
        await rejectButton?.trigger('click');
        await wrapper.vm.$nextTick();
        await wrapper.vm.$nextTick();

        expect(httpClient.post).toHaveBeenCalledWith('/slot-requests/id/sr-9/reject');
    });
});
