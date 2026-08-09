import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ProviderUsageChartCard from '@/features/dashboard/components/ProviderUsageChartCard.vue';
import type { ProviderUsageDto } from '@/types/dashboard.types';
import { ProviderStatus, ProviderType, ProviderVendor, type ProviderDto } from '@/types/provider.types';

/** `Chart` (primevue/chart) wraps chart.js, which needs a real canvas context unavailable in jsdom - stubbed here as an external-boundary/rendering concern, capturing only the `data` prop it receives. */
const ChartStub = {
    name: 'Chart',
    props: ['type', 'data', 'options'],
    template: '<div class="chart-stub" />'
};

function buildProvider(overrides: Partial<ProviderDto> = {}): ProviderDto {
    return {
        id: 'provider-1',
        name: 'Zoom Primary',
        vendor: ProviderVendor.ZOOM,
        type: ProviderType.POOL,
        status: ProviderStatus.ACTIVE,
        accounts: [],
        ...overrides
    };
}

function mountCard(usage: ProviderUsageDto[], providers: ProviderDto[]) {
    return mount(ProviderUsageChartCard, {
        props: { usage, providers, loading: false, error: null },
        global: {
            plugins: [PrimeVue],
            stubs: { Chart: ChartStub }
        }
    });
}

describe('ProviderUsageChartCard', () => {
    it('givenProviderIdMatchingAKnownProvider_whenRendered_thenChartLabelShowsProviderNameNotId', async () => {
        const usage: ProviderUsageDto[] = [{ providerId: 'provider-1', usageCount: 5 }];
        const providers = [buildProvider({ id: 'provider-1', name: 'Zoom Primary' })];

        const wrapper = mountCard(usage, providers);
        await wrapper.vm.$nextTick();

        const chart = wrapper.findComponent(ChartStub);
        expect(chart.props('data').labels).toEqual(['Zoom Primary']);
        expect(chart.props('data').labels).not.toContain('provider-1');
    });

    it('givenProviderIdWithNoMatchingProvider_whenRendered_thenChartLabelFallsBackToRawId', async () => {
        const usage: ProviderUsageDto[] = [{ providerId: 'deleted-provider', usageCount: 2 }];

        const wrapper = mountCard(usage, []);
        await wrapper.vm.$nextTick();

        const chart = wrapper.findComponent(ChartStub);
        expect(chart.props('data').labels).toEqual(['deleted-provider']);
    });
});
