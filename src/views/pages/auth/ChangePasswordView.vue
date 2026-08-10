<script setup lang="ts">
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { useAuthStore } from '@/stores/authStore';
import { extractErrorMessage } from '@/utils/httpError';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
const toast = useToast();

const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const errorMessage = ref('');

async function handleChangePassword(): Promise<void> {
    errorMessage.value = '';

    if (!newPassword.value || newPassword.value.length < 6) {
        errorMessage.value = 'Password must be at least 6 characters long.';
        return;
    }
    if (newPassword.value !== confirmPassword.value) {
        errorMessage.value = 'Passwords do not match.';
        return;
    }

    loading.value = true;
    try {
        await authStore.changePassword({ newPassword: newPassword.value });
        toast.add({ severity: 'success', summary: 'Password changed', detail: 'Please sign in with your new password.', life: 3000 });
        await router.push({ name: 'login' });
    } catch (err) {
        errorMessage.value = extractErrorMessage(err, 'Failed to change password. Please try logging in again.');
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <FloatingConfigurator />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Set a New Password</div>
                        <span class="text-muted-color font-medium">This is your first login - please choose a new password to continue.</span>
                    </div>

                    <div>
                        <Message v-if="errorMessage" severity="error" class="mb-6" :closable="false">{{ errorMessage }}</Message>

                        <label for="new-password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">New Password</label>
                        <Password id="new-password" v-model="newPassword" placeholder="New Password" :toggleMask="true" class="mb-4" fluid :feedback="false" @keyup.enter="handleChangePassword"></Password>

                        <label for="confirm-password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Confirm New Password</label>
                        <Password id="confirm-password" v-model="confirmPassword" placeholder="Confirm New Password" :toggleMask="true" class="mb-8" fluid :feedback="false" @keyup.enter="handleChangePassword"></Password>

                        <Button label="Change Password" class="w-full" :loading="loading" @click="handleChangePassword"></Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
