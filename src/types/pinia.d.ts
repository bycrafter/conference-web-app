// Triggers `pinia-plugin-persistedstate`'s global `DefineStoreOptionsBase`
// augmentation (adds `persist` to `defineStore` options) for the whole
// program - no `.ts`/`.vue` file otherwise imports this package directly.
import 'pinia-plugin-persistedstate';
