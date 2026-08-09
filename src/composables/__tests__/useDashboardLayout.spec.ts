import { beforeEach, describe, expect, it } from 'vitest';
import { useDashboardLayout } from '@/composables/useDashboardLayout';

describe('useDashboardLayout', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('givenNoStoredLayout_whenInitialized_thenReturnsDefaultOrder', () => {
        const { order } = useDashboardLayout(['a', 'b', 'c']);

        expect(order.value).toEqual(['a', 'b', 'c']);
    });

    it('givenReorderedLayout_whenOrderMutated_thenPersistsToLocalStorage', async () => {
        const { order } = useDashboardLayout(['a', 'b', 'c']);

        order.value = ['c', 'a', 'b'];
        await Promise.resolve();

        expect(JSON.parse(localStorage.getItem('bycrafter.dashboard.layout') ?? '[]')).toEqual(['c', 'a', 'b']);
    });

    it('givenPreviouslyStoredOrder_whenReinitialized_thenRestoresPersistedOrder', () => {
        localStorage.setItem('bycrafter.dashboard.layout', JSON.stringify(['b', 'c', 'a']));

        const { order } = useDashboardLayout(['a', 'b', 'c']);

        expect(order.value).toEqual(['b', 'c', 'a']);
    });

    it('givenStoredOrderMissingANewCard_whenReinitialized_thenAppendsMissingCardAtTheEnd', () => {
        localStorage.setItem('bycrafter.dashboard.layout', JSON.stringify(['b', 'a']));

        const { order } = useDashboardLayout(['a', 'b', 'c']);

        expect(order.value).toEqual(['b', 'a', 'c']);
    });

    it('givenCorruptedStoredValue_whenReinitialized_thenFallsBackToDefaultOrder', () => {
        localStorage.setItem('bycrafter.dashboard.layout', 'not-json');

        const { order } = useDashboardLayout(['a', 'b', 'c']);

        expect(order.value).toEqual(['a', 'b', 'c']);
    });
});
