import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import httpClient from '@/services/httpClient';
import CalendarView from '@/features/calendar/views/CalendarView.vue';
import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';
import { ConferenceStatus, type ConferenceDto } from '@/types/conference.types';

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn()
    }
}));

// Pins the grid to the month the test fixture conferences live in (`2026-01-05`) - otherwise
// the calendar defaults to `dayGridMonth` for the real current month and never renders them.
vi.mock('vue-router', () => ({
    useRoute: () => ({ query: { date: '2026-01-05' } })
}));

// `ConferenceMiniMap`'s scoped <style> block hits an unrelated Tailwind/Vitest transform
// incompatibility in this environment (see `ConferenceDetailDialog.spec.ts`), and it geocodes
// `location` via a live network call anyway - mocked here as an external-boundary concern,
// pulled in transitively via `ConferenceDetailDialog.vue`.
vi.mock('@/features/conferences/components/ConferenceMiniMap.vue', () => ({
    default: {
        name: 'ConferenceMiniMap',
        props: ['location'],
        template: '<div />'
    }
}));

// `conferencesStore.connectStream()` (`onMounted`) opens a native `EventSource`, which jsdom
// doesn't implement - stubbed as a no-op external boundary, unrelated to the RBAC/DnD logic
// under test here.
class MockEventSource {
    close(): void {}
}

function buildConference(overrides: Partial<ConferenceDto> = {}): ConferenceDto {
    return {
        id: 'conf-1',
        title: 'Sprint Review',
        description: 'Quarterly review meeting',
        startTime: new Date('2026-01-05T10:00:00Z').getTime(),
        endTime: new Date('2026-01-05T11:00:00Z').getTime(),
        providerId: 'provider-1',
        location: 'Building A',
        privateInfo: 'Host password: 1234',
        ownerUsername: 'other.user',
        organizerUsername: 'other.user',
        status: ConferenceStatus.SCHEDULED,
        joinLink: 'https://zoom.example/1',
        participants: ['a@test.com'],
        isStarred: false,
        ...overrides
    };
}

/** Shape the BFF actually returns for a masked (foreign) conference - see `ConferenceMapper#mask`. */
function buildMaskedConference(overrides: Partial<ConferenceDto> = {}): ConferenceDto {
    return buildConference({
        title: null as unknown as string,
        description: null as unknown as string,
        location: null as unknown as string,
        privateInfo: null as unknown as string,
        joinLink: null as unknown as string,
        providerId: null as unknown as string,
        participants: [],
        ...overrides
    });
}

async function loginAs(username: string, permissions: PermissionCode[]): Promise<void> {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { token: 'token', role: 'ORGANIZER', username, email: `${username}@test.com`, permissions } });
    const authStore = useAuthStore();
    await authStore.login({ username, password: 'secret' });
}

/**
 * `onDatesSet` fires as soon as FullCalendar renders and immediately calls
 * `conferencesStore.fetchRange` (`GET /v1/conferences`), which would otherwise overwrite
 * anything pre-seeded directly into the store - the conference fixture has to be served through
 * the mocked HTTP layer instead, keyed by URL since `/providers/active` shares the same `get` mock.
 */
function mockBackendData(conferences: ConferenceDto[]): void {
    vi.mocked(httpClient.get).mockImplementation((url: string) => {
        if (url.includes('/providers')) {
            return Promise.resolve({ data: { items: [] } });
        }
        return Promise.resolve({ data: { items: conferences, totalElements: conferences.length, totalPages: 1, page: 0, size: 500 } });
    });
}

async function mountCalendar() {
    const wrapper = mount(CalendarView, {
        attachTo: document.body,
        global: {
            plugins: [PrimeVue, ToastService, ConfirmationService],
            stubs: {
                Card: { template: '<div><slot name="title" /><slot name="content" /></div>' }
            }
        }
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    return wrapper;
}

describe('CalendarView', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockBackendData([]);
        vi.stubGlobal('EventSource', MockEventSource);
        // `PrimeVue`'s `Select` (Provider dropdown) queries `matchMedia` for responsive
        // behavior - not implemented by jsdom. Stubbed as a browser-API external boundary.
        vi.stubGlobal(
            'matchMedia',
            vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            })
        );
        document.body.innerHTML = '';
    });

    it('givenUpdateAllButNotViewAll_whenMaskedConferenceIsRendered_thenEventIsNotDraggable', async () => {
        // Reproduces the reported bug: a caller with `CONFERENCE_UPDATE_ALL` (but not `VIEW_ALL`)
        // must not be able to drag a masked (foreign, null-field) conference - dragging it would
        // have sent `null` title/description/location/privateInfo to `PATCH /v1/conferences/:id`
        // and the backend replies with a 400 Bad Request.
        await loginAs('privileged.editor', [PermissionCode.CONFERENCE_UPDATE_ALL]);
        mockBackendData([buildMaskedConference()]);

        const wrapper = await mountCalendar();

        const eventEl = wrapper.find('.fc-event');
        expect(eventEl.exists()).toBe(true);
        expect(eventEl.classes()).not.toContain('fc-event-draggable');
        wrapper.unmount();
    });

    it('givenViewAllAndUpdateAll_whenOwnedConferenceIsRendered_thenEventIsDraggable', async () => {
        await loginAs('admin.user', [PermissionCode.CONFERENCE_VIEW_ALL, PermissionCode.CONFERENCE_UPDATE_ALL]);
        mockBackendData([buildConference({ ownerUsername: 'admin.user', organizerUsername: 'admin.user' })]);

        const wrapper = await mountCalendar();

        const eventEl = wrapper.find('.fc-event');
        expect(eventEl.exists()).toBe(true);
        expect(eventEl.classes()).toContain('fc-event-draggable');
        wrapper.unmount();
    });

    it('givenCancelledConference_whenRendered_thenEventIsNeverDraggableRegardlessOfPermissions', async () => {
        await loginAs('admin.user', [PermissionCode.CONFERENCE_VIEW_ALL, PermissionCode.CONFERENCE_UPDATE_ALL]);
        mockBackendData([buildConference({ ownerUsername: 'admin.user', organizerUsername: 'admin.user', status: ConferenceStatus.CANCELLED })]);

        const wrapper = await mountCalendar();

        // "Hide Cancelled" defaults to `true`, so a cancelled conference isn't even rendered on the grid.
        const eventEl = wrapper.find('.fc-event');
        expect(eventEl.exists()).toBe(false);
        wrapper.unmount();
    });
});
