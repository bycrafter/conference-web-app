<script setup lang="ts">
import { useGeocodedLocation } from '@/composables/useGeocodedLocation';
import { computed, toRef } from 'vue';

const props = defineProps<{
    location: string | null;
}>();

const { resolvedCoordinates, resolving, notFound } = useGeocodedLocation(toRef(props, 'location'));

/**
 * Leaflet's `dist/leaflet-src.js` is a UMD-only bundle with no real ESM export contract - every import
 * shape (`default`, `* as`, with/without `.default` normalization) ends up bundler/interop-dependent and
 * broke differently in dev vs. the production build across several attempts. Rendering the resolved
 * coordinates through OpenStreetMap's own `embed.html` iframe sidesteps the JS map library entirely: no
 * bundling, no marker icon paths, no "Map container already initialized" lifecycle to manage.
 */
const BBOX_DELTA = 0.006;

const embedUrl = computed(() => {
    const coordinates = resolvedCoordinates.value;
    if (!coordinates) {
        return null;
    }
    const { lat, lon } = coordinates;
    const bbox = [lon - BBOX_DELTA, lat - BBOX_DELTA, lon + BBOX_DELTA, lat + BBOX_DELTA].join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lon}`;
});

const externalMapUrl = computed(() => {
    const coordinates = resolvedCoordinates.value;
    return coordinates ? `https://www.openstreetmap.org/?mlat=${coordinates.lat}&mlon=${coordinates.lon}#map=16/${coordinates.lat}/${coordinates.lon}` : null;
});
</script>

<template>
    <div v-if="embedUrl" class="flex flex-col gap-1">
        <iframe class="bycrafter-minimap-canvas" style="height: 200px; width: 100%; border: none; border-radius: 6px; z-index: 1" :src="embedUrl" loading="lazy" title="Location preview" />
        <a :href="externalMapUrl!" target="_blank" rel="noopener" class="text-primary text-sm no-underline">View larger map</a>
    </div>
    <div v-else class="bycrafter-minimap flex flex-col items-center justify-center gap-2 rounded-border">
        <i class="pi" :class="resolving ? 'pi-spin pi-spinner' : 'pi-map-marker'" style="font-size: 1.5rem" />
        <span class="text-muted-color text-sm">{{ resolving ? 'Locating…' : notFound ? 'Location not found - try an exact address or "lat, lon" coordinates' : location || 'No location provided' }}</span>
    </div>
</template>

<style scoped>
.bycrafter-minimap {
    height: 12rem;
    background: var(--surface-ground);
    border: 1px dashed var(--surface-border);
}
</style>
