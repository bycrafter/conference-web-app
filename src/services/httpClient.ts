import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

/**
 * BFF base URL. `conference-web-api` exposes URI-versioned routes
 * (`/v1/...`, no global `/api` prefix) - see `main.ts` (`enableVersioning`).
 */
const httpClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ?? '/v1',
    timeout: 10000
});

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore();
    // Falls back to the restricted `changePasswordToken` (issued by `Login` for a
    // `PENDING` account) when there is no normal session token yet - this is what lets
    // `ChangePasswordView`/`authStore.changePassword` reuse the same client unchanged.
    const bearerToken = authStore.token ?? authStore.changePasswordToken;
    if (bearerToken) {
        config.headers.set('Authorization', `Bearer ${bearerToken}`);
    }
    return config;
});

httpClient.interceptors.response.use(
    (response) => {
        // The BFF may reply with `204 No Content` (or an empty string body) for
        // "nothing to return" cases (e.g. an empty list, or some PATCH/DELETE
        // endpoints). Empty data is NOT an error - normalize it to `null` here so
        // every service/store can rely on a single, predictable falsy check
        // instead of each one crashing on `data.items`/`data.foo`.
        if (response.status === 204 || response.data === '') {
            response.data = null;
        }
        return response;
    },
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            const authStore = useAuthStore();
            authStore.handleUnauthorized();
        }
        return Promise.reject(error);
    }
);

export default httpClient;
