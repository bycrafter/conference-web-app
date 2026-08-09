<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ref } from 'vue';

const router = useRouter();
const selectedDate = ref<Date>(new Date());

/** Jumps straight to the full Calendar view, scoped to the picked day. */
function goToDate(date: Date): void {
    router.push({ name: 'calendar', query: { date: date.toISOString() } });
}
</script>

<template>
    <Card>
        <template #title>
            <div class="flex items-center justify-between gap-2">
                <span>Mini Calendar</span>
                <i class="pi pi-arrows-alt cursor-move text-muted-color drag-handle" title="Drag to reorder"></i>
            </div>
        </template>
        <template #subtitle>Quick jump to a day</template>
        <template #content>
            <DatePicker v-model="selectedDate" inline class="w-full bycrafter-mini-calendar" @date-select="goToDate" />
        </template>
    </Card>
</template>

<style scoped>
.bycrafter-mini-calendar :deep(.p-datepicker-panel) {
    border: none;
    background: transparent;
}
</style>
