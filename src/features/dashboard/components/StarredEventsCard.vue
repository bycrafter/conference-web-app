<script setup lang="ts">
import type { ConferenceDto } from '@/types/conference.types';

defineProps<{
    events: ConferenceDto[];
    loading: boolean;
}>();

const emit = defineEmits<{
    unstar: [conference: ConferenceDto];
}>();
</script>

<template>
    <Card>
        <template #title>
            <div class="flex items-center justify-between gap-2">
                <span>Starred Events</span>
                <i class="pi pi-arrows-alt cursor-move text-muted-color drag-handle" title="Drag to reorder"></i>
            </div>
        </template>
        <template #subtitle>Your pinned conferences</template>
        <template #content>
            <ProgressSpinner v-if="loading" style="width: 40px; height: 40px" />
            <p v-else-if="events.length === 0" class="text-muted-color">No starred events yet.</p>
            <ul v-else class="flex flex-col gap-3 list-none p-0 m-0">
                <li v-for="event in events" :key="event.id" class="flex items-center justify-between gap-3 pb-3" style="border-bottom: 1px solid var(--surface-border)">
                    <div class="flex flex-col">
                        <span class="font-medium">{{ event.title }}</span>
                        <span class="text-muted-color text-sm">{{ new Date(event.startTime).toLocaleString() }}</span>
                    </div>
                    <Button icon="pi pi-star-fill" text rounded severity="warn" aria-label="Unstar" @click="emit('unstar', event)" />
                </li>
            </ul>
        </template>
    </Card>
</template>
