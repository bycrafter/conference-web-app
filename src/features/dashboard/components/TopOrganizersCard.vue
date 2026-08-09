<script setup lang="ts">
import type { OrganizerStatsDto } from '@/types/dashboard.types';

defineProps<{
    organizers: OrganizerStatsDto[];
    loading: boolean;
    /** ORGANIZER/STANDARD_ACCOUNT only hold `REPORT_VIEW_LIMITED` - org-wide activity ranking is admin-only (`REPORT_VIEW_ALL`) and must stay hidden. */
    restricted?: boolean;
}>();
</script>

<template>
    <Card>
        <template #title>
            <div class="flex items-center justify-between gap-2">
                <span>Top 10 Organizers</span>
                <i class="pi pi-arrows-alt cursor-move text-muted-color drag-handle" title="Drag to reorder"></i>
            </div>
        </template>
        <template #subtitle>Ranked by conference activity</template>
        <template #content>
            <div v-if="restricted" class="flex flex-col items-center gap-2 py-6 text-muted-color">
                <i class="pi pi-lock text-2xl"></i>
                <span>You don't have permission to view organizer-wide statistics.</span>
            </div>
            <DataTable v-else :value="organizers" :loading="loading" data-key="username" striped-rows responsive-layout="scroll">
                <template #empty>Veri bulunamadı / No data found</template>
                <Column header="#" style="width: 3rem">
                    <template #body="{ index }">{{ index + 1 }}</template>
                </Column>
                <Column field="username" header="Organizer" />
                <Column field="count" header="Conferences" style="width: 10rem" />
            </DataTable>
        </template>
    </Card>
</template>
