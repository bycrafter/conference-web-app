<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus';
import { useDashboardLayout } from '@/composables/useDashboardLayout';
import { useDashboardStore } from '@/features/dashboard/stores/dashboard.store';
import { useConferencesStore } from '@/features/conferences/stores/conferences.store';
import { useProvidersStore } from '@/features/providers/stores/providers.store';
import ProviderUsageChartCard from '@/features/dashboard/components/ProviderUsageChartCard.vue';
import TopOrganizersCard from '@/features/dashboard/components/TopOrganizersCard.vue';
import MiniCalendarCard from '@/features/dashboard/components/MiniCalendarCard.vue';
import StarredEventsCard from '@/features/dashboard/components/StarredEventsCard.vue';
import ProviderStatusCard from '@/features/dashboard/components/ProviderStatusCard.vue';
import type { ConferenceDto } from '@/types/conference.types';
import { useToast } from 'primevue/usetoast';
import { onMounted } from 'vue';

const dashboardStore = useDashboardStore();
const conferencesStore = useConferencesStore();
const providersStore = useProvidersStore();
const toast = useToast();

/** Stable card ids - `useDashboardLayout` persists only this order, matched to a component in the template below. */
const DEFAULT_CARD_ORDER = ['providerUsage', 'topOrganizers', 'miniCalendar', 'starredEvents', 'providerStatus'];

const { order } = useDashboardLayout(DEFAULT_CARD_ORDER);

async function onUnstar(conference: ConferenceDto): Promise<void> {
    try {
        await conferencesStore.toggleStar(conference);
    } catch {
        toast.add({ severity: 'error', summary: 'Action failed', detail: 'Failed to update favorite status.', life: 5000 });
    }
}

onMounted(async () => {
    await Promise.all([dashboardStore.fetchStats(), conferencesStore.fetchStarred(), providersStore.fetchActive()]);
});
</script>

<template>
    <VueDraggable v-model="order" tag="div" class="grid grid-cols-12 gap-8" handle=".drag-handle" :animation="200">
        <div v-for="cardId in order" :key="cardId" class="col-span-12 xl:col-span-6">
            <ProviderUsageChartCard v-if="cardId === 'providerUsage'" :usage="dashboardStore.providerUsage" :providers="providersStore.activeProviders" :loading="dashboardStore.loading" :error="dashboardStore.error" :restricted="dashboardStore.isRestricted" />
            <TopOrganizersCard v-else-if="cardId === 'topOrganizers'" :organizers="dashboardStore.topOrganizers" :loading="dashboardStore.loading" :restricted="dashboardStore.isRestricted" />
            <MiniCalendarCard v-else-if="cardId === 'miniCalendar'" />
            <StarredEventsCard v-else-if="cardId === 'starredEvents'" :events="conferencesStore.starredEvents" :loading="conferencesStore.starredLoading" @unstar="onUnstar" />
            <ProviderStatusCard v-else-if="cardId === 'providerStatus'" :providers="providersStore.activeProviders" :loading="providersStore.loading" />
        </div>
    </VueDraggable>
</template>
