<script setup lang="ts">
import { useAccountManagementStore } from '@/features/account-management/stores/account-management.store';
import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';
import { AccountRole, type AccountDto, type CreateAccountPayload, type UpdateAccountPayload } from '@/types/account.types';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { computed, onMounted, reactive, ref } from 'vue';

const accountManagementStore = useAccountManagementStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

/** Defense-in-depth alongside the `/account-management` route guard - hides the whole screen for anyone without `ACCOUNT_MANAGE_ALL`. */
const canManage = computed(() => authStore.hasPermission(PermissionCode.ACCOUNT_MANAGE_ALL));

const roleOptions = [AccountRole.STANDARD_ACCOUNT, AccountRole.ORGANIZER, AccountRole.ADMIN];

const filters = reactive({
    username: '',
    email: '',
    firstName: '',
    lastName: ''
});

const dialogVisible = ref(false);
const editingAccount = ref<AccountDto | null>(null);
const submitting = ref(false);
const removingId = ref<string | null>(null);

const form = reactive<CreateAccountPayload>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: AccountRole.STANDARD_ACCOUNT
});

function roleSeverity(role: AccountRole): 'danger' | 'info' | 'secondary' {
    if (role === AccountRole.ADMIN) {
        return 'danger';
    }
    if (role === AccountRole.ORGANIZER) {
        return 'info';
    }
    return 'secondary';
}

function currentFilters() {
    return {
        username: filters.username.trim() || undefined,
        email: filters.email.trim() || undefined,
        firstName: filters.firstName.trim() || undefined,
        lastName: filters.lastName.trim() || undefined
    };
}

async function applyFilters(): Promise<void> {
    await accountManagementStore.search(currentFilters());
}

function onPage(event: { page: number }): void {
    void accountManagementStore.search({ page: event.page, ...currentFilters() });
}

function resetForm(): void {
    form.username = '';
    form.email = '';
    form.firstName = '';
    form.lastName = '';
    form.role = AccountRole.STANDARD_ACCOUNT;
}

function openCreate(): void {
    editingAccount.value = null;
    resetForm();
    dialogVisible.value = true;
}

function openEdit(account: AccountDto): void {
    editingAccount.value = account;
    form.username = account.username;
    form.email = account.email;
    form.firstName = account.firstName;
    form.lastName = account.lastName;
    form.role = account.role;
    dialogVisible.value = true;
}

async function submit(): Promise<void> {
    if (!canManage.value || !form.username.trim() || !form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
        toast.add({ severity: 'error', summary: 'Missing information', detail: 'Please fill in all fields.', life: 4000 });
        return;
    }

    submitting.value = true;
    try {
        if (editingAccount.value) {
            const payload: UpdateAccountPayload = {
                email: form.email.trim(),
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                role: form.role
            };
            await accountManagementStore.update(editingAccount.value.id, payload);
            toast.add({ severity: 'success', summary: 'Account updated', detail: `"${form.username.trim()}" was updated successfully.`, life: 3000 });
        } else {
            await accountManagementStore.create({
                username: form.username.trim(),
                email: form.email.trim(),
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                role: form.role
            });
            toast.add({ severity: 'success', summary: 'Account created', detail: `A temporary password has been emailed to "${form.email.trim()}".`, life: 4000 });
        }
        dialogVisible.value = false;
    } catch (err: any) {
        const detail = err?.response?.data?.message ?? 'Failed to save the account.';
        toast.add({ severity: 'error', summary: 'Save failed', detail, life: 5000 });
    } finally {
        submitting.value = false;
    }
}

function confirmRemove(account: AccountDto): void {
    confirm.require({
        header: 'Delete Account',
        message: `Are you sure you want to delete "${account.username}"? This action cannot be undone.`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Delete',
        rejectLabel: 'Cancel',
        acceptClass: 'p-button-danger',
        accept: async () => {
            removingId.value = account.id;
            try {
                await accountManagementStore.remove(account.id);
                toast.add({ severity: 'success', summary: 'Account deleted', detail: `"${account.username}" was deleted successfully.`, life: 3000 });
            } catch (err: any) {
                const detail = err?.response?.data?.message ?? 'Failed to delete the account.';
                toast.add({ severity: 'error', summary: 'Deletion failed', detail, life: 5000 });
            } finally {
                removingId.value = null;
            }
        }
    });
}

onMounted(() => {
    if (canManage.value) {
        void accountManagementStore.search();
    }
});
</script>

<template>
    <Card v-if="!canManage">
        <template #content>
            <Message severity="warn" :closable="false">You do not have permission to view Account Management.</Message>
        </template>
    </Card>

    <Card v-else>
        <template #title>
            <div class="flex flex-wrap items-center justify-between gap-4">
                <span>Account Management</span>
                <Button label="New Account" icon="pi pi-plus" @click="openCreate" />
            </div>
        </template>
        <template #content>
            <div class="flex flex-wrap gap-4 mb-4">
                <InputText v-model="filters.username" placeholder="Username" @keyup.enter="applyFilters" />
                <InputText v-model="filters.email" placeholder="Email" @keyup.enter="applyFilters" />
                <InputText v-model="filters.firstName" placeholder="First Name" @keyup.enter="applyFilters" />
                <InputText v-model="filters.lastName" placeholder="Last Name" @keyup.enter="applyFilters" />
                <Button label="Search" icon="pi pi-search" outlined @click="applyFilters" />
            </div>

            <Message v-if="accountManagementStore.error" severity="error" :closable="false" class="mb-4">{{ accountManagementStore.error }}</Message>

            <DataTable
                :value="accountManagementStore.items"
                :loading="accountManagementStore.loading"
                data-key="id"
                paginator
                lazy
                :rows="accountManagementStore.size"
                :total-records="accountManagementStore.totalElements"
                :first="accountManagementStore.page * accountManagementStore.size"
                responsive-layout="scroll"
                @page="onPage"
            >
                <template #empty>No accounts found</template>
                <Column field="username" header="Username" />
                <Column field="email" header="Email" />
                <Column field="firstName" header="First Name" />
                <Column field="lastName" header="Last Name" />
                <Column header="Role" style="width: 12rem">
                    <template #body="{ data }">
                        <Tag :value="data.role" :severity="roleSeverity(data.role)" />
                    </template>
                </Column>
                <Column header="Actions" style="width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" text rounded aria-label="Edit" @click="openEdit(data)" />
                            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Delete" :loading="removingId === data.id" @click="confirmRemove(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </template>
    </Card>

    <Dialog v-model:visible="dialogVisible" modal :header="editingAccount ? 'Edit Account' : 'New Account'" class="w-full md:w-[32rem]">
        <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
                <label for="account-username">Username</label>
                <InputText id="account-username" v-model="form.username" :disabled="!!editingAccount" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="account-email">Email</label>
                <InputText id="account-email" v-model="form.email" type="email" />
            </div>

            <div class="flex gap-4">
                <div class="flex flex-col gap-2 flex-1">
                    <label for="account-first-name">First Name</label>
                    <InputText id="account-first-name" v-model="form.firstName" />
                </div>
                <div class="flex flex-col gap-2 flex-1">
                    <label for="account-last-name">Last Name</label>
                    <InputText id="account-last-name" v-model="form.lastName" />
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <label for="account-role">Role</label>
                <Select id="account-role" v-model="form.role" :options="roleOptions" />
            </div>
        </div>

        <template #footer>
            <Button label="Cancel" severity="secondary" text :disabled="submitting" @click="dialogVisible = false" />
            <Button label="Save" :loading="submitting" @click="submit" />
        </template>
    </Dialog>
</template>
