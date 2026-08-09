<script setup lang="ts">
import ConferenceDetailDialog from '@/features/conferences/components/ConferenceDetailDialog.vue';
import { useConferenceSearch } from '@/features/search/composables/useConferenceSearch';
import type { ConferenceDto } from '@/types/conference.types';
import { ref } from 'vue';

const SUGGESTION_LIMIT = 5;

const { suggest } = useConferenceSearch();

const query = ref('');
const suggestions = ref<ConferenceDto[]>([]);

const selectedConference = ref<ConferenceDto | null>(null);
const detailDialogVisible = ref(false);

async function onComplete(event: { query: string }): Promise<void> {
    suggestions.value = await suggest(event.query, SUGGESTION_LIMIT);
}

function onSelect(event: { value: ConferenceDto }): void {
    selectedConference.value = event.value;
    detailDialogVisible.value = true;
    query.value = '';
    suggestions.value = [];
}
</script>

<template>
    <AutoComplete
        v-model="query"
        option-label="title"
        :suggestions="suggestions"
        :delay="300"
        placeholder="Search conferences..."
        input-class="w-full"
        @complete="onComplete"
        @item-select="onSelect"
    >
        <template #option="{ option }">
            <div class="flex flex-col">
                <span class="font-medium">{{ option.title }}</span>
                <span class="text-muted-color text-sm">{{ new Date(option.startTime).toLocaleString() }}</span>
            </div>
        </template>
    </AutoComplete>

    <ConferenceDetailDialog v-model:visible="detailDialogVisible" :conference="selectedConference" />
</template>
