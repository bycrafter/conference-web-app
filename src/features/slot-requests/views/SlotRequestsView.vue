<script setup lang="ts">
/**
 * ARCHITECTURAL GAP: the real `SlotRequestGrpcService` contract has no
 * list/search RPC - every operation (`GetSlotRequestByToken`,
 * `ApproveSlotRequest`, `RejectSlotRequest`) is scoped by the one-time
 * action token delivered via the actionable email link. There is no
 * queryable "pending requests" queue to page through, so this view looks
 * up a single request by its token (from the route, or pasted/typed in)
 * instead of rendering a `DataTable`.
 */
import { useSlotRequestsStore } from '@/features/slot-requests/stores/slot-requests.store';
import { SlotRequestStatus } from '@/types/slot-request.types';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const slotRequestsStore = useSlotRequestsStore();

const tokenInput = ref('');

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
    }
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

const statusSeverity = computed(() => {
    switch (slotRequestsStore.current?.status) {
        case SlotRequestStatus.APPROVED:
            return 'success';
        case SlotRequestStatus.REJECTED:
            return 'danger';
        default:
            return 'warn';
    }
});

const isPending = computed(() => slotRequestsStore.current?.status === SlotRequestStatus.PENDING);

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
        <template #subtitle>Look up a slot change request by its action link/token to approve or reject it</template>
        <template #content>
            <div class="flex flex-col gap-4">
                <div class="flex flex-wrap items-end gap-2">
                    <div class="flex flex-col gap-2 flex-1 min-w-[16rem]">
                        <label for="slot-request-token">Action token / link</label>
                        <InputText id="slot-request-token" v-model="tokenInput" placeholder="Paste the token or the full link from the email" @keyup.enter="lookup" />
                    </div>
                    <Button label="Look Up" icon="pi pi-search" @click="lookup" />
                </div>

                <Message v-if="slotRequestsStore.error" severity="error" :closable="false">{{ slotRequestsStore.error }}</Message>

                <ProgressSpinner v-if="slotRequestsStore.loading" style="width: 32px; height: 32px" />

                <div v-else-if="slotRequestsStore.current" class="flex flex-col gap-4 p-4 border-round" style="border: 1px solid var(--surface-border); background: var(--surface-card)">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="font-semibold">Conference: {{ slotRequestsStore.current.conferenceId }}</div>
                        <Tag :value="slotRequestsStore.current.status" :severity="statusSeverity" />
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
            </div>
        </template>
    </Card>
</template>
