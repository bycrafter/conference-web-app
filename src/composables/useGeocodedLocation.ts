import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

export interface GeocodedCoordinates {
    lat: number;
    lon: number;
}

/** `"38.4237, 27.1428"` / `"38.4237,-27.1428"` - direct lat/lon pairs, bypassing the geocoder entirely. */
const COORDINATE_PATTERN = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

const DEBOUNCE_MS = 800;
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

interface NominatimResult {
    lat: string;
    lon: string;
}

/**
 * Nominatim frequently fails on Turkish addresses that include a specific door/building number
 * (e.g. "No:33/2", "1/4A") even though the street itself is well known. Expanding the common
 * abbreviations and stripping door numbers - while carefully keeping street numbers like
 * "8788/9. Sk." intact - gives the geocoder a much cleaner query to work with (used as Tier 2
 * of the cascading fallback below).
 */
export function parseTurkishAddress(address: string): string {
    if (!address) {
        return '';
    }
    return address
        // 1. Expand Turkish abbreviations (absorb dots)
        .replace(/\.?\s*\b(?:Sk|Sok)\.?/gi, ' Sokak')
        .replace(/\.?\s*\bCd\.?/gi, ' Caddesi')
        .replace(/\.?\s*\b(?:Mh|Mah)\.?/gi, ' Mahallesi')
        .replace(/\.?\s*\b(?:Blv|Bul)\.?/gi, ' Bulvarı')

        // 2. Remove E-Devlet specific official jargon ("İÇ/DIŞ KAPI NO: 28", "A NO: 4A")
        .replace(/\bİÇ KAPI NO:?\s*\d+[a-zA-Z]?/gi, '')
        .replace(/\bDIŞ KAPI NO:?\s*\d+[a-zA-Z]?/gi, '')
        .replace(/\b[A-Z]\s+NO:?\s*\d+[a-zA-Z]?/gi, '')

        // 3. Remove standard building/door numbers
        .replace(/\bNo:?\s*\d+(\/[a-zA-Z0-9]+)?/gi, '')

        // 4. Remove standalone fractional door numbers (e.g., "1/4A")
        .replace(/(?<!\d)\b\d+\/[a-zA-Z0-9]+\b(?!\s*Sokak|\s*Caddesi)/gi, '')

        // 5. Remove postal codes (5 digits)
        .replace(/\b\d{5}\b/g, '')

        // 6. Clean up slashes used as separators (e.g., "ÇİĞLİ / İZMİR" -> "ÇİĞLİ İZMİR")
        .replace(/\s*\/\s*(?=[a-zA-Z])/g, ' ')

        // 7. Clean up duplicate commas, spaces, and trailing commas
        .replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .replace(/,\s*$/, '')
        .trim();
}

/**
 * Resolves a free-text `location` (`ConferenceDto.location`) into map coordinates:
 * direct "lat, lon" pairs are parsed via regex; anything else is debounced (~800ms)
 * and geocoded against the free OpenStreetMap Nominatim API. No backend involvement -
 * `location` has no structured lat/lng contract on the BFF side (see `ConferenceMiniMap.vue`).
 */
export function useGeocodedLocation(locationText: Ref<string | null | undefined>) {
    const resolvedCoordinates = ref<GeocodedCoordinates | null>(null);
    const resolving = ref(false);
    /** True once a lookup has finished without result - lets the UI tell "still typing" apart from "that address doesn't exist". */
    const notFound = ref(false);

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let abortController: AbortController | undefined;

    function clear(): void {
        clearTimeout(debounceTimer);
        abortController?.abort();
        resolving.value = false;
        notFound.value = false;
        resolvedCoordinates.value = null;
    }

    async function fetchNominatim(query: string, bustCache = false): Promise<NominatimResult[]> {
        const cacheBuster = bustCache ? `&_=${Date.now()}` : '';
        const url = `${NOMINATIM_ENDPOINT}?format=json&q=${encodeURIComponent(query)}&limit=1${cacheBuster}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8' },
            signal: abortController?.signal
        });
        if (!response.ok) {
            throw new Error(`Nominatim error: ${response.status}`);
        }
        return (await response.json()) as NominatimResult[];
    }

    /**
     * Nominatim sits behind a CDN (Varnish) that, for already-cached queries (i.e. any popular address),
     * can serve a response stripped of the `Access-Control-Allow-Origin` header, which the browser then
     * rejects as a CORS failure even though the request itself succeeded. A single retry with a
     * cache-busting param forces a fresh, non-cached (CORS-enabled) response and recovers from it.
     */
    async function fetchNominatimWithRetry(query: string): Promise<NominatimResult[]> {
        try {
            return await fetchNominatim(query);
        } catch (error) {
            if ((error as { name?: string }).name === 'AbortError') {
                throw error;
            }
            return await fetchNominatim(query, true);
        }
    }

    /**
     * 3-tier cascading geocode: exact text first, then a cleaned-up Turkish address
     * (abbreviations expanded, door/building numbers stripped), then a city/district-only
     * fallback built from the last two comma-separated segments of the original text.
     */
    async function geocode(locationText: string): Promise<void> {
        abortController?.abort();
        abortController = new AbortController();
        resolving.value = true;
        notFound.value = false;
        try {
            // Tier 1: Exact Match
            let data = await fetchNominatimWithRetry(locationText);

            // Tier 2: Cleaned Address Match
            if (!data || data.length === 0) {
                const cleanedAddress = parseTurkishAddress(locationText);
                if (cleanedAddress && cleanedAddress !== locationText) {
                    console.log('Tier 2 Fallback: Nominatim using cleaned address:', cleanedAddress);
                    data = await fetchNominatimWithRetry(cleanedAddress);
                }
            }

            // Tier 3: City/District Fallback
            if (!data || data.length === 0) {
                let cityDistrictFallback = '';

                if (locationText.includes(',')) {
                    // Standard comma-separated (e.g., "..., Çiğli, İzmir")
                    const parts = locationText.split(',');
                    if (parts.length >= 2) {
                        cityDistrictFallback = parts.slice(-2).join(',').trim();
                    }
                } else {
                    // E-Devlet / Space-separated (e.g., "... ÇİĞLİ / İZMİR" or "... ÇİĞLİ İZMİR")
                    // Split by space or slash, filter empty, take last 2 words
                    const words = locationText.split(/[\s/]+/).filter((word) => word.length > 0);
                    if (words.length >= 2) {
                        cityDistrictFallback = words.slice(-2).join(' ').trim();
                    }
                }

                if (cityDistrictFallback) {
                    console.log('Tier 3 Fallback: Nominatim using district/city:', cityDistrictFallback);
                    data = await fetchNominatimWithRetry(cityDistrictFallback);
                }
            }

            if (data && data.length > 0) {
                resolvedCoordinates.value = { lat: Number.parseFloat(data[0].lat), lon: Number.parseFloat(data[0].lon) };
                notFound.value = false;
            } else {
                console.warn('Nominatim returned no results for address (all tiers exhausted):', locationText);
                resolvedCoordinates.value = null;
                notFound.value = true;
            }
        } catch (error) {
            if ((error as { name?: string }).name === 'AbortError') {
                return;
            }
            console.error('Geocoding Error:', error);
            resolvedCoordinates.value = null;
            notFound.value = true;
        } finally {
            resolving.value = false;
        }
    }

    watch(
        locationText,
        (value) => {
            clearTimeout(debounceTimer);
            abortController?.abort();

            const trimmed = (value ?? '').trim();
            if (!trimmed) {
                resolvedCoordinates.value = null;
                resolving.value = false;
                notFound.value = false;
                return;
            }

            const coordinateMatch = COORDINATE_PATTERN.exec(trimmed);
            if (coordinateMatch) {
                resolvedCoordinates.value = { lat: Number.parseFloat(coordinateMatch[1]), lon: Number.parseFloat(coordinateMatch[2]) };
                resolving.value = false;
                notFound.value = false;
                return;
            }

            debounceTimer = setTimeout(() => void geocode(trimmed), DEBOUNCE_MS);
        },
        { immediate: true }
    );

    onBeforeUnmount(clear);

    return { resolvedCoordinates, resolving, notFound };
}
