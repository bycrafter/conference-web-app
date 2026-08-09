<script setup lang="ts">
import { useSlotRequestsStore } from '@/features/slot-requests/stores/slot-requests.store';
import { ref, watch } from 'vue';

const props = defineProps<{
    visible: boolean;
    conferenceId: string;
    conferenceTitle: string;
    /** Epoch millis - defaults the pickers to the conference's current slot. */
    conferenceStartTime: number;
    conferenceEndTime: number;
}>();

const emit = defineEmits<{
    'update:visible': [value: boolean];
    submitted: [];
}>();

const slotRequestsStore = useSlotRequestsStore();
const requestedStart = ref<Date | null>(null);
const requestedEnd = ref<Date | null>(null);
const justification = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

watch(
    () => props.visible,
    (visible) => {
        if (visible) {
            requestedStart.value = new Date(props.conferenceStartTime);
            requestedEnd.value = new Date(props.conferenceEndTime);
            justification.value = '';
            error.value = null;
        }
    }
);

function close(): void {
    emit('update:visible', false);
}

async function submit(): Promise<void> {
    if (!requestedStart.value || !requestedEnd.value) {
        error.value = 'Please select both the new start and end time.';
        return;
    }
    if (requestedEnd.value.getTime() <= requestedStart.value.getTime()) {
        error.value = 'The end time must be after the start time.';
        return;
    }
    if (!justification.value.trim()) {
        error.value = 'Please explain why this slot needs to change.';
        return;
    }
    submitting.value = true;
    error.value = null;
    try {
        await slotRequestsStore.create({
            conferenceId: props.conferenceId,
            requestedStartTime: requestedStart.value.getTime(),
            requestedEndTime: requestedEnd.value.getTime(),
            justification: justification.value.trim()
        });
        emit('submitted');
        close();
    } catch {
        error.value = 'Failed to submit the slot change request.';
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Dialog :visible="visible" modal header="Request Slot Change" class="w-full md:w-[32rem]" @update:visible="emit('update:visible', $event)">
        <div class="flex flex-col gap-4">
            <p class="text-muted-color">Requesting a slot change for <span class="font-semibold">{{ conferenceTitle }}</span>.</p>
            <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="slot-request-start">New Start</label>
                    <DatePicker id="slot-request-start" v-model="requestedStart" show-time hour-format="24" date-format="dd/mm/yy" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="slot-request-end">New End</label>
                    <DatePicker id="slot-request-end" v-model="requestedEnd" show-time hour-format="24" date-format="dd/mm/yy" />
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <label for="slot-request-justification">Justification</label>
                <Textarea id="slot-request-justification" v-model="justification" rows="4" auto-resize placeholder="Explain why this slot needs to change" />
            </div>
            <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        </div>
        <template #footer>
            <Button label="Cancel" severity="secondary" text :disabled="submitting" @click="close" />
            <Button label="Submit Request" :loading="submitting" @click="submit" />
        </template>
    </Dialog>
</template>
