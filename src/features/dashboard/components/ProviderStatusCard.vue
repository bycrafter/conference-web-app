<script setup lang="ts">
import { ProviderStatus, type ProviderDto } from '@/types/provider.types';

defineProps<{
    providers: ProviderDto[];
    loading: boolean;
}>();

function statusSeverity(status: ProviderStatus): 'success' | 'warn' {
    return status === ProviderStatus.ACTIVE ? 'success' : 'warn';
}
</script>

<template>
    <Card>
        <template #title>
            <div class="flex items-center justify-between gap-2">
                <span>Provider Status</span>
                <i class="pi pi-arrows-alt cursor-move text-muted-color drag-handle" title="Drag to reorder"></i>
            </div>
        </template>
        <template #subtitle>Active/passive conferencing providers</template>
        <template #content>
            <ProgressSpinner v-if="loading" style="width: 40px; height: 40px" />
            <p v-else-if="providers.length === 0" class="text-muted-color">No providers configured.</p>
            <ul v-else class="flex flex-col gap-3 list-none p-0 m-0">
                <li v-for="provider in providers" :key="provider.id" class="flex items-center justify-between gap-3 pb-3" style="border-bottom: 1px solid var(--surface-border)">
                    <span class="font-medium">{{ provider.name }}</span>
                    <Tag :value="provider.status" :severity="statusSeverity(provider.status)" />
                </li>
            </ul>
        </template>
    </Card>
</template>
