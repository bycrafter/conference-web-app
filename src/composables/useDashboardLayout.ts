import { ref, watch, type Ref } from 'vue';

const STORAGE_KEY = 'bycrafter.dashboard.layout';

/**
 * Persists the Dashboard's draggable card order to `localStorage` so a
 * reload keeps the user's preferred layout. Purely a UI-presentation
 * concern (no BFF endpoint backs card ordering), so it lives in a
 * composable rather than a Pinia store.
 */
export function useDashboardLayout(defaultOrder: string[]): { order: Ref<string[]> } {
    const stored = readStoredOrder(defaultOrder);
    const order = ref<string[]>(stored);

    watch(
        order,
        (value) => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
            } catch {
                // Best-effort persistence; a full/blocked storage must never break the dashboard.
            }
        },
        { deep: true }
    );

    return { order };
}

function readStoredOrder(defaultOrder: string[]): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [...defaultOrder];
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
            return [...defaultOrder];
        }
        // Reconcile with `defaultOrder` so newly-added/removed cards are never lost/dangling.
        const known = parsed.filter((id) => defaultOrder.includes(id));
        const missing = defaultOrder.filter((id) => !known.includes(id));
        return [...known, ...missing];
    } catch {
        return [...defaultOrder];
    }
}
