import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useGeocodedLocation } from '@/composables/useGeocodedLocation';

describe('useGeocodedLocation', () => {
    it('givenNullLocation_whenInitialized_thenDoesNotThrowAndResolvesToNoCoordinates', () => {
        // Regression test: masked conferences (`ConferenceMapper#mask`, backend) return
        // `location: null` for accounts without CONFERENCE_VIEW_ALL viewing someone else's
        // event. `ConferenceMiniMap` still binds it as a plain `string` prop, so the
        // `immediate: true` watcher used to call `null.trim()` and crash the whole
        // `ConferenceDetailDialog` on mount.
        const locationRef = ref<string | null>(null);

        expect(() => useGeocodedLocation(locationRef)).not.toThrow();

        const { resolvedCoordinates, resolving, notFound } = useGeocodedLocation(locationRef);
        expect(resolvedCoordinates.value).toBeNull();
        expect(resolving.value).toBe(false);
        expect(notFound.value).toBe(false);
    });

    it('givenDirectCoordinatePair_whenLocationSet_thenResolvesWithoutGeocoding', () => {
        const locationRef = ref<string | null>('38.4237, 27.1428');

        const { resolvedCoordinates, resolving } = useGeocodedLocation(locationRef);

        expect(resolving.value).toBe(false);
        expect(resolvedCoordinates.value).toEqual({ lat: 38.4237, lon: 27.1428 });
    });
});
