import { fileURLToPath, URL } from 'node:url';

import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    optimizeDeps: {
        noDiscovery: true
    },
    plugins: [
        vue(),
        // Skipped under Vitest: `@tailwindcss/vite`'s CSS transform is incompatible with Vitest's
        // bundled Vite/Rollup version in this environment (`createIdResolver is not a function`),
        // breaking every component test for an SFC that has its own `<style>` block. Component
        // tests don't assert on compiled Tailwind output anyway, so skipping it here is safe.
        ...(process.env.VITEST ? [] : [tailwindcss()]),
        Components({
            resolvers: [PrimeVueResolver()]
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        port: 8080
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        exclude: ['**/node_modules/**', '**/cypress/**']
    }
});
