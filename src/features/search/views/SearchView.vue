<script setup lang="ts">
import ConferenceDetailDialog from '@/features/conferences/components/ConferenceDetailDialog.vue';
import { useConferenceSearch } from '@/features/search/composables/useConferenceSearch';
import { ConferenceStatus, type ConferenceDto } from '@/types/conference.types';
import { ref } from 'vue';

const PAGE_SIZE = 10;

const { keyword, items, totalElements, page, loading, error, hasSearched, canSearchAllEvents, groups, search } = useConferenceSearch(PAGE_SIZE);

const selectedConference = ref<ConferenceDto | null>(null);
const detailDialogVisible = ref(false);

function onPage(event: { page: number }): void {
    void search(event.page);
}

function openDetails(conference: ConferenceDto): void {
    selectedConference.value = conference;
    detailDialogVisible.value = true;
}

function statusSeverity(status: ConferenceStatus): 'danger' | 'success' {
    return status === ConferenceStatus.CANCELLED ? 'danger' : 'success';
}
</script>

<template>
    <Card>
        <template #title>Search</template>
        <template #subtitle>
            {{ canSearchAllEvents ? 'Global conference search, grouped by day' : 'Search your own and attended conferences, grouped by day' }}
        </template>
        <template #content>
            <div class="flex gap-2 mb-4">
                <InputText v-model="keyword" placeholder="Search by title, description, attendee..." class="flex-1" @keyup.enter="search(0)" />
                <Button label="Search" icon="pi pi-search" @click="search(0)" />
            </div>

            <Message v-if="error" severity="error" :closable="false" class="mb-4">{{ error }}</Message>
            <ProgressSpinner v-if="loading" style="width: 40px; height: 40px" />

            <template v-else-if="hasSearched">
                <p v-if="items.length === 0" class="text-muted-color">Veri bulunamadı / No data found</p>

                <div v-else class="flex flex-col gap-6">
                    <div v-for="group in groups" :key="group.label">
                        <div class="font-semibold text-lg mb-2">{{ group.label }}</div>
                        <ul class="flex flex-col gap-2 list-none p-0 m-0">
                            <li
                                v-for="event in group.events"
                                :key="event.id"
                                class="flex items-center justify-between gap-3 p-3 rounded-border cursor-pointer hover:surface-hover"
                                style="border: 1px solid var(--surface-border)"
                                @click="openDetails(event)"
                            >
                                <div class="flex flex-col">
                                    <span class="font-medium">{{ event.title }}</span>
                                    <span class="text-muted-color text-sm">{{ new Date(event.startTime).toLocaleTimeString() }} - {{ new Date(event.endTime).toLocaleTimeString() }}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <i v-if="event.isStarred" class="pi pi-star-fill text-yellow-500"></i>
                                    <Tag :value="event.status" :severity="statusSeverity(event.status)" />
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <Paginator :rows="PAGE_SIZE" :total-records="totalElements" :first="page * PAGE_SIZE" class="mt-4" @page="onPage" />
            </template>

            <p v-else class="text-muted-color">Search conferences by title, description, or attendee.</p>
        </template>
    </Card>

    <ConferenceDetailDialog v-model:visible="detailDialogVisible" :conference="selectedConference" />
</template>
