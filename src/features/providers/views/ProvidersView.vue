<script setup lang="ts">
import { useProvidersStore } from '@/features/providers/stores/providers.store';
import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';
import { ProviderStatus, ProviderType, ProviderVendor, type ProviderAccountDto, type ProviderDto, type ProviderUpsertPayload } from '@/types/provider.types';
import { computed, onMounted, reactive, ref, watch } from 'vue';

const providersStore = useProvidersStore();
const authStore = useAuthStore();

/** Only `PROVIDER_MANAGE_ALL` may create/edit/delete providers or flip their status - view-only otherwise. */
const canManage = computed(() => authStore.hasPermission(PermissionCode.PROVIDER_MANAGE_ALL));

const filters = reactive({
    keyword: '',
    typeFilter: null as ProviderType | null,
    statusFilter: null as ProviderStatus | null
});

const typeOptions = [ProviderType.SINGLE, ProviderType.POOL];
const statusOptions = [ProviderStatus.ACTIVE, ProviderStatus.PASSIVE];
const vendorOptions = [ProviderVendor.ZOOM, ProviderVendor.MEET, ProviderVendor.TEAMS, ProviderVendor.WEBEX];

const dialogVisible = ref(false);
const editingProvider = ref<ProviderDto | null>(null);
const submitting = ref(false);
const removingId = ref<string | null>(null);

const form = reactive<{
    name: string;
    vendor: ProviderVendor;
    type: ProviderType;
    status: ProviderStatus;
    accounts: ProviderAccountDto[];
}>({
    name: '',
    vendor: ProviderVendor.ZOOM,
    type: ProviderType.SINGLE,
    status: ProviderStatus.ACTIVE,
    accounts: []
});

function statusSeverity(status: ProviderStatus): 'success' | 'warn' {
    return status === ProviderStatus.ACTIVE ? 'success' : 'warn';
}

async function applyFilters(): Promise<void> {
    await providersStore.search({
        keyword: filters.keyword.trim() || undefined,
        typeFilter: filters.typeFilter ?? undefined,
        statusFilter: filters.statusFilter ?? undefined
    });
}

function onPage(event: { page: number }): void {
    void providersStore.search({
        page: event.page,
        keyword: filters.keyword.trim() || undefined,
        typeFilter: filters.typeFilter ?? undefined,
        statusFilter: filters.statusFilter ?? undefined
    });
}

function resetForm(): void {
    form.name = '';
    form.vendor = ProviderVendor.ZOOM;
    form.type = ProviderType.SINGLE;
    form.status = ProviderStatus.ACTIVE;
    form.accounts = [];
}

function openCreate(): void {
    editingProvider.value = null;
    resetForm();
    dialogVisible.value = true;
}

function openEdit(provider: ProviderDto): void {
    editingProvider.value = provider;
    form.name = provider.name;
    form.vendor = provider.vendor;
    form.type = provider.type;
    form.status = provider.status;
    // Do NOT populate password in the form to ensure we only send it if the user types a new one
    form.accounts = provider.accounts.map((account) => ({ accountUsername: account.accountUsername, accountPassword: '' }));
    dialogVisible.value = true;
}

function addCredential(): void {
    if (form.type === ProviderType.SINGLE && form.accounts.length >= 1) {
        return;
    }
    form.accounts.push({ accountUsername: '', accountPassword: '' });
}

function removeCredential(index: number): void {
    form.accounts.splice(index, 1);
}

async function submit(): Promise<void> {
    if (!canManage.value) {
        return;
    }
    const payload: ProviderUpsertPayload = {
        name: form.name.trim(),
        vendor: form.vendor,
        type: form.type,
        status: form.status,
        accounts: form.accounts
            .filter((account) => account.accountUsername.trim() !== '')
            .map((account) => ({
                accountUsername: account.accountUsername,
                // Blank password means "keep the current password" on update; always sent explicitly
                // (never omitted) so the payload shape stays consistent between create and edit.
                accountPassword: account.accountPassword ?? ''
            }))
    };

    submitting.value = true;
    try {
        if (editingProvider.value) {
            await providersStore.update(editingProvider.value.id, payload);
        } else {
            await providersStore.create(payload);
        }
        dialogVisible.value = false;
    } finally {
        submitting.value = false;
    }
}

async function remove(provider: ProviderDto): Promise<void> {
    if (!canManage.value) {
        return;
    }
    removingId.value = provider.id;
    try {
        await providersStore.remove(provider.id);
    } finally {
        removingId.value = null;
    }
}

watch(
    () => form.type,
    (newType) => {
        if (newType === ProviderType.SINGLE && form.accounts.length > 1) {
            form.accounts = form.accounts.slice(0, 1);
        }
    }
);

onMounted(() => {
    void providersStore.search();
});
</script>

<template>
    <Card>
        <template #title>
            <div class="flex flex-wrap items-center justify-between gap-4">
                <span>Providers</span>
                <Button v-if="canManage" label="New Provider" icon="pi pi-plus" @click="openCreate" />
            </div>
        </template>
        <template #content>
            <div class="flex flex-wrap gap-4 mb-4">
                <InputText v-model="filters.keyword" placeholder="Search by name" @keyup.enter="applyFilters" />
                <Select v-model="filters.typeFilter" :options="typeOptions" placeholder="System Type" show-clear class="w-48" @change="applyFilters" />
                <Select v-model="filters.statusFilter" :options="statusOptions" placeholder="Status" show-clear class="w-48" @change="applyFilters" />
                <Button label="Search" icon="pi pi-search" outlined @click="applyFilters" />
            </div>

            <Message v-if="providersStore.adminError" severity="error" :closable="false" class="mb-4">{{ providersStore.adminError }}</Message>

            <DataTable
                :value="providersStore.items"
                :loading="providersStore.adminLoading"
                data-key="id"
                paginator
                lazy
                :rows="providersStore.size"
                :total-records="providersStore.totalElements"
                :first="providersStore.page * providersStore.size"
                responsive-layout="scroll"
                @page="onPage"
            >
                <template #empty>Veri bulunamadı / No data found</template>
                <Column field="name" header="Name" />
                <Column field="vendor" header="Provider Type" />
                <Column field="type" header="System Type" />
                <Column header="Status" style="width: 10rem">
                    <template #body="{ data }">
                        <Tag :value="data.status" :severity="statusSeverity(data.status)" />
                    </template>
                </Column>
                <Column v-if="canManage" header="Actions" style="width: 12rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" text rounded aria-label="Edit" @click="openEdit(data)" />
                            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Delete" :loading="removingId === data.id" @click="remove(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </template>
    </Card>

    <Dialog v-model:visible="dialogVisible" modal :header="editingProvider ? 'Edit Provider' : 'New Provider'" class="w-full md:w-[36rem]">
        <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
                <label for="provider-name">Name</label>
                <InputText id="provider-name" v-model="form.name" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="provider-vendor">Provider Type</label>
                <Select id="provider-vendor" v-model="form.vendor" :options="vendorOptions" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="provider-type">System Type</label>
                <SelectButton id="provider-type" v-model="form.type" :options="typeOptions" />
            </div>

            <div v-if="canManage" class="flex flex-col gap-2">
                <label for="provider-status">Status</label>
                <Select id="provider-status" v-model="form.status" :options="statusOptions" />
            </div>

            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <label>Credentials</label>
                    <Button
                        v-if="form.type === ProviderType.POOL || form.accounts.length === 0"
                        label="Add"
                        icon="pi pi-plus"
                        text
                        size="small"
                        @click="addCredential"
                    />
                </div>
                <div v-for="(account, index) in form.accounts" :key="index" class="flex gap-2">
                    <InputText v-model="account.accountUsername" placeholder="Username" class="flex-1" />
                    <Password
                        v-model="account.accountPassword"
                        :placeholder="editingProvider ? 'Leave blank to keep current password' : 'Password'"
                        toggle-mask
                        :feedback="false"
                        class="flex-1"
                    />
                    <Button icon="pi pi-times" text rounded severity="danger" aria-label="Remove credential" @click="removeCredential(index)" />
                </div>
            </div>
        </div>

        <template #footer>
            <Button label="Cancel" severity="secondary" text :disabled="submitting" @click="dialogVisible = false" />
            <Button v-if="canManage" label="Save" :loading="submitting" @click="submit" />
        </template>
    </Dialog>
</template>
