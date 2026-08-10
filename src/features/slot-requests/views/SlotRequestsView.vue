<script setup lang="ts">
/**
 * Admin queue (`ListSlotRequests`, `SLOT_REQUEST_MANAGE_ALL`) filterable by
 * status (defaults to `PENDING` - unresolved requests first), plus the
 * existing token search: pasting/loading a token fetches that single
 * request via `GetSlotRequestByToken` and shows only it; clearing the
 * search box reverts to the status-filtered list.
 */
import { useConferencesStore } from '@/features/conferences/stores/conferences.store';
import { useSlotRequestsStore } from '@/features/slot-requests/stores/slot-requests.store';
import { SlotRequestStatus, type SlotRequestDto } from '@/types/slot-request.types';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const slotRequestsStore = useSlotRequestsStore();
const conferencesStore = useConferencesStore();

const tokenInput = ref('');

const statusOptions = [SlotRequestStatus.PENDING, SlotRequestStatus.APPROVED, SlotRequestStatus.REJECTED];

function extractToken(value: string): string {
    const trimmed = value.trim();
    const lastSegment = trimmed.split('/').filter(Boolean).pop();
    return lastSegment ?? trimmed;
}

async function lookup(): Promise<void> {
    const token = extractToken(tokenInput.value);
    if (!token) {
        return;
    }
    await router.push({ name: 'slotRequests', params: { token } });
}

async function fetchFromRoute(): Promise<void> {
    const token = typeof route.params.token === 'string' ? route.params.token : '';
    if (token) {
        tokenInput.value = token;
        await slotRequestsStore.fetchByToken(token);
    } else {
        await slotRequestsStore.fetchList();
    }
}

async function clearSearch(): Promise<void> {
    tokenInput.value = '';
    if (route.params.token) {
        await router.push({ name: 'slotRequests' });
    }
    await slotRequestsStore.fetchList();
}

async function onStatusFilterChange(): Promise<void> {
    await slotRequestsStore.fetchList(slotRequestsStore.statusFilter);
}

async function approve(): Promise<void> {
    const token = typeof route.params.token === 'string' ? route.params.token : '';
    if (token) {
        await slotRequestsStore.approve(token);
    }
}

async function reject(): Promise<void> {
    const token = typeof route.params.token === 'string' ? route.params.token : '';
    if (token) {
        await slotRequestsStore.reject(token);
    }
}

function statusSeverity(status: SlotRequestStatus | undefined): 'success' | 'danger' | 'warn' {
    switch (status) {
        case SlotRequestStatus.APPROVED:
            return 'success';
        case SlotRequestStatus.REJECTED:
            return 'danger';
        default:
            return 'warn';
    }
}

/** Prefers the denormalized `conferenceTitle` carried on the DTO; falls back to whatever's already loaded in the Calendar store, then finally the raw ID. */
function conferenceTitleOf(slotRequest: SlotRequestDto): string {
    if (slotRequest.conferenceTitle) {
        return slotRequest.conferenceTitle;
    }
    const cached = conferencesStore.events.find((event) => event.id === slotRequest.conferenceId);
    return cached?.title ?? slotRequest.conferenceId;
}

async function approveRow(slotRequest: SlotRequestDto): Promise<void> {
    await slotRequestsStore.approveById(slotRequest.id);
}

async function rejectRow(slotRequest: SlotRequestDto): Promise<void> {
    await slotRequestsStore.rejectById(slotRequest.id);
}

const currentStatusSeverity = computed(() => statusSeverity(slotRequestsStore.current?.status));
const isPending = computed(() => slotRequestsStore.current?.status === SlotRequestStatus.PENDING);
const isTokenSearchActive = computed(() => typeof route.params.token === 'string' && route.params.token.length > 0);

onMounted(() => {
    void fetchFromRoute();
});

watch(
    () => route.params.token,
    () => {
        void fetchFromRoute();
    }
);
</script>

<template>
    <Card>
        <template #title>Slot Requests</template>
        <template #subtitle>Browse pending/approved/rejected requests, or look up one directly by its action link/token</template>
        <template #content>
            <div class="flex flex-col gap-4">
                <div class="flex flex-wrap items-end gap-2">
                    <div class="flex flex-col gap-2 flex-1 min-w-[16rem]">
                        <label for="slot-request-token">Action token / link</label>
                        <InputText
                            id="slot-request-token"
                            v-model="tokenInput"
                            placeholder="Paste the token or the full link from the email"
                            @keyup.enter="lookup"
                        />
                    </div>
                    <Button label="Look Up" icon="pi pi-search" @click="lookup" />
                    <Button v-if="isTokenSearchActive" label="Clear" icon="pi pi-times" severity="secondary" outlined @click="clearSearch" />

                    <div v-if="!isTokenSearchActive" class="flex flex-col gap-2 min-w-[12rem]">
                        <label for="slot-request-status-filter">Status</label>
                        <Select
                            id="slot-request-status-filter"
                            v-model="slotRequestsStore.statusFilter"
                            :options="statusOptions"
                            class="w-full"
                            @change="onStatusFilterChange"
                        />
                    </div>
                </div>

                <Message v-if="slotRequestsStore.error" severity="error" :closable="false">{{ slotRequestsStore.error }}</Message>

                <template v-if="isTokenSearchActive">
                    <ProgressSpinner v-if="slotRequestsStore.loading" style="width: 32px; height: 32px" />

                    <div v-else-if="slotRequestsStore.current" class="flex flex-col gap-4 p-4 border-round" style="border: 1px solid var(--surface-border); background: var(--surface-card)">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="font-semibold">Conference: {{ slotRequestsStore.current.conferenceTitle || slotRequestsStore.current.conferenceId }}</div>
                            <Tag :value="slotRequestsStore.current.status" :severity="currentStatusSeverity" />
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <div class="text-muted-color text-sm">Requested By</div>
                                <div>{{ slotRequestsStore.current.requesterUsername }}</div>
                            </div>
                            <div>
                                <div class="text-muted-color text-sm">Justification</div>
                                <div>{{ slotRequestsStore.current.justification }}</div>
                            </div>
                            <div>
                                <div class="text-muted-color text-sm">New Start</div>
                                <div>{{ new Date(slotRequestsStore.current.requestedStartTime).toLocaleString() }}</div>
                            </div>
                            <div>
                                <div class="text-muted-color text-sm">New End</div>
                                <div>{{ new Date(slotRequestsStore.current.requestedEndTime).toLocaleString() }}</div>
                            </div>
                        </div>
                        <div v-if="isPending" class="flex gap-2">
                            <Button label="Approve" severity="success" :loading="slotRequestsStore.processing" @click="approve" />
                            <Button label="Reject" severity="danger" outlined :loading="slotRequestsStore.processing" @click="reject" />
                        </div>
                    </div>

                    <p v-else class="text-muted-color">Veri bulunamadı / No data found</p>
                </template>

                <DataTable v-else :value="slotRequestsStore.items" :loading="slotRequestsStore.loading" data-key="id" responsive-layout="scroll">
                    <template #empty>Veri bulunamadı / No data found</template>
                    <Column field="requesterUsername" header="Requester" />
                    <Column header="Conference Title">
                        <template #body="{ data }">{{ conferenceTitleOf(data) }}</template>
                    </Column>
                    <Column header="Reason" style="max-width: 18rem">
                        <template #body="{ data }">
                            <span class="line-clamp-2" :title="data.justification">{{ data.justification }}</span>
                        </template>
                    </Column>
                    <Column header="Suggested Time" style="width: 12rem">
                        <template #body="{ data }">
                            <div class="flex flex-col">
                                <span>{{ new Date(data.requestedStartTime).toLocaleString() }}</span>
                                <span>{{ new Date(data.requestedEndTime).toLocaleString() }}</span>
                            </div>
                        </template>
                    </Column>
                    <Column header="Status" style="width: 10rem">
                        <template #body="{ data }">
                            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
                        </template>
                    </Column>
                    <Column header="Actions" style="width: 12rem">
                        <template #body="{ data }">
                            <div v-if="data.status === SlotRequestStatus.PENDING" class="flex gap-2">
                                <Button
                                    icon="pi pi-check"
                                    label="Approve"
                                    severity="success"
                                    size="small"
                                    :loading="slotRequestsStore.processing"
                                    @click="approveRow(data)"
                                />
                                <Button
                                    icon="pi pi-times"
                                    label="Reject"
                                    severity="danger"
                                    outlined
                                    size="small"
                                    :loading="slotRequestsStore.processing"
                                    @click="rejectRow(data)"
                                />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </template>
    </Card>
</template>
