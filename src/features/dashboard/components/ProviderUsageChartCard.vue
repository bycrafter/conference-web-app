<script setup lang="ts">
import { useLayout } from '@/layout/composables/layout';
import type { ProviderUsageDto } from '@/types/dashboard.types';
import type { ProviderDto } from '@/types/provider.types';
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
    usage: ProviderUsageDto[];
    loading: boolean;
    error: string | null;
    /** ORGANIZER/STANDARD_ACCOUNT only hold `REPORT_VIEW_LIMITED` - all-time usage chart is admin-only (`REPORT_VIEW_ALL`) and must stay hidden. */
    restricted?: boolean;
    /** Used to resolve `providerId` to a human-readable name for chart labels; falls back to the raw id when not found (e.g. a deleted provider). */
    providers?: ProviderDto[];
}>();

function resolveProviderName(providerId: string): string {
    return props.providers?.find((provider) => provider.id === providerId)?.name ?? providerId;
}

const { isDarkTheme } = useLayout();

const chartData = ref();
const chartOptions = ref();

/**
 * Provider Usage distribution (all-time count per provider). `DashboardResponse`
 * has no time-series field - see the ARCHITECTURAL GAP note in
 * `dashboard.types.ts` - so this is the closest available "usage graph".
 */
function setChartData() {
    const documentStyle = getComputedStyle(document.documentElement);

    return {
        labels: props.usage.map((usage) => resolveProviderName(usage.providerId)),
        datasets: [
            {
                type: 'bar',
                label: 'Conferences hosted',
                backgroundColor: documentStyle.getPropertyValue('--p-primary-400'),
                data: props.usage.map((usage) => usage.usageCount),
                borderRadius: {
                    topLeft: 8,
                    topRight: 8
                },
                borderSkipped: true,
                barThickness: 32
            }
        ]
    };
}

function setChartOptions() {
    const documentStyle = getComputedStyle(document.documentElement);
    const borderColor = documentStyle.getPropertyValue('--surface-border');
    const textMutedColor = documentStyle.getPropertyValue('--text-color-secondary');

    return {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
            legend: {
                labels: { color: textMutedColor }
            }
        },
        scales: {
            x: {
                ticks: { color: textMutedColor },
                grid: { color: 'transparent', borderColor: 'transparent' }
            },
            y: {
                beginAtZero: true,
                ticks: { color: textMutedColor },
                grid: { color: borderColor, borderColor: 'transparent', drawTicks: false }
            }
        }
    };
}

function refreshChart() {
    chartData.value = setChartData();
    chartOptions.value = setChartOptions();
}

watch(isDarkTheme, refreshChart);
watch(() => props.usage, refreshChart);
watch(() => props.providers, refreshChart);

onMounted(refreshChart);
</script>

<template>
    <Card>
        <template #title>
            <div class="flex items-center justify-between gap-2">
                <span>Provider Usage</span>
                <i class="pi pi-arrows-alt cursor-move text-muted-color drag-handle" title="Drag to reorder"></i>
            </div>
        </template>
        <template #subtitle>Conferences hosted per provider</template>
        <template #content>
            <div v-if="restricted" class="flex flex-col items-center gap-2 py-6 text-muted-color">
                <i class="pi pi-lock text-2xl"></i>
                <span>You don't have permission to view provider usage statistics.</span>
            </div>
            <ProgressSpinner v-else-if="loading" style="width: 40px; height: 40px" />
            <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>
            <p v-else-if="usage.length === 0" class="text-muted-color">No provider usage data yet.</p>
            <Chart v-else type="bar" :data="chartData" :options="chartOptions" class="h-80" />
        </template>
    </Card>
</template>
