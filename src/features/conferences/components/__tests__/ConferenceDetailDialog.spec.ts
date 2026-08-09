import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import httpClient from '@/services/httpClient';
import ConferenceDetailDialog from '@/features/conferences/components/ConferenceDetailDialog.vue';
import { useAuthStore } from '@/stores/authStore';
import { useConferencesStore } from '@/features/conferences/stores/conferences.store';
import { PermissionCode } from '@/types/auth.types';
import { ConferenceStatus, type ConferenceDto } from '@/types/conference.types';

/** DB-seeded role -> permissions fixture, mirrors `V2__insert_default_rbac_data.sql` (`account-manager`). */
const ROLE_PERMISSIONS_FIXTURE: Record<'ADMIN' | 'ORGANIZER' | 'STANDARD_ACCOUNT', PermissionCode[]> = {
    ADMIN: (Object.values(PermissionCode) as PermissionCode[]).filter(
        (code) => code !== PermissionCode.CONFERENCE_VIEW_LIMITED && code !== PermissionCode.REPORT_VIEW_LIMITED
    ),
    ORGANIZER: [
        PermissionCode.ACCOUNT_MANAGE_SELF,
        PermissionCode.PROVIDER_VIEW_ALL,
        PermissionCode.CONFERENCE_CREATE_ALL,
        PermissionCode.CONFERENCE_CREATE_SELF,
        PermissionCode.CONFERENCE_VIEW_ALL,
        PermissionCode.CONFERENCE_VIEW_SELF,
        PermissionCode.CONFERENCE_UPDATE_ALL,
        PermissionCode.CONFERENCE_UPDATE_SELF,
        PermissionCode.CONFERENCE_DELETE_ALL,
        PermissionCode.CONFERENCE_DELETE_SELF,
        PermissionCode.SLOT_REQUEST_CREATE,
        PermissionCode.SLOT_REQUEST_MANAGE_ALL,
        PermissionCode.SLOT_REQUEST_MANAGE_SELF,
        PermissionCode.REPORT_VIEW_LIMITED
    ],
    STANDARD_ACCOUNT: [
        PermissionCode.ACCOUNT_MANAGE_SELF,
        PermissionCode.PROVIDER_VIEW_ALL,
        PermissionCode.CONFERENCE_CREATE_SELF,
        PermissionCode.CONFERENCE_VIEW_LIMITED,
        PermissionCode.CONFERENCE_VIEW_SELF,
        PermissionCode.CONFERENCE_UPDATE_SELF,
        PermissionCode.CONFERENCE_DELETE_SELF,
        PermissionCode.SLOT_REQUEST_CREATE,
        PermissionCode.SLOT_REQUEST_MANAGE_SELF,
        PermissionCode.REPORT_VIEW_LIMITED
    ]
};

vi.mock('@/services/httpClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn()
    }
}));

// `ConferenceMiniMap`'s scoped <style> block hits an unrelated Tailwind/Vitest transform
// incompatibility in this environment, and it geocodes `location` via a live network call
// anyway - mocked here as an external-boundary concern, not to shallow-render the RBAC
// content under test (Dialog, stores and permission logic all stay real).
vi.mock('@/features/conferences/components/ConferenceMiniMap.vue', () => ({
    default: {
        name: 'ConferenceMiniMap',
        props: ['location'],
        template: '<div />'
    }
}));

function buildConference(overrides: Partial<ConferenceDto> = {}): ConferenceDto {
    return {
        id: 'conf-1',
        title: 'Sprint Review',
        description: 'Quarterly review meeting',
        startTime: new Date('2026-01-01T10:00:00Z').getTime(),
        endTime: new Date('2026-01-01T11:00:00Z').getTime(),
        providerId: 'provider-1',
        location: 'Building A',
        privateInfo: 'Host password: 1234',
        ownerUsername: 'other.user',
        organizerUsername: 'other.user',
        status: ConferenceStatus.SCHEDULED,
        joinLink: 'https://zoom.example/1',
        participants: ['a@test.com', 'b@test.com'],
        isStarred: false,
        ...overrides
    };
}

/** Shape the BFF actually returns for a masked conference - see `ConferenceMapper#mask`. */
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

async function loginAs(role: 'ADMIN' | 'ORGANIZER' | 'STANDARD_ACCOUNT', username: string, email = `${username}@test.com`): Promise<void> {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { token: 'token', role, username, email, permissions: ROLE_PERMISSIONS_FIXTURE[role] } });
    const authStore = useAuthStore();
    await authStore.login({ username, password: 'secret' });
}

async function mountDialog(conference: ConferenceDto) {
    const wrapper = mount(ConferenceDetailDialog, {
        attachTo: document.body,
        props: { visible: true, conference },
        global: {
            plugins: [PrimeVue, ConfirmationService, ToastService]
        }
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    return wrapper;
}

describe('ConferenceDetailDialog', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('givenViewAllPermission_whenViewingOthersEvent_thenShowsFullDetails', async () => {
        await loginAs('ADMIN', 'admin.user');
        const conference = buildConference();

        const wrapper = await mountDialog(conference);

        expect(document.body.textContent).toContain('Sprint Review');
        expect(document.body.textContent).toContain('Quarterly review meeting');
        expect(document.body.textContent).toContain('a@test.com');
        expect(document.body.textContent).toContain('other.user');
        wrapper.unmount();
    });

    it('givenStandardAccountViewingOthersEvent_thenRendersRestrictedViewWithoutCrashing', async () => {
        await loginAs('STANDARD_ACCOUNT', 'jdoe');
        const maskedConference = buildMaskedConference();

        const wrapper = await mountDialog(maskedConference);

        expect(document.body.textContent).toContain('limited access');
        expect(document.body.textContent).toContain('other.user');
        expect(document.body.textContent).not.toContain('Quarterly review meeting');
        expect(document.body.textContent).not.toContain('Host password');
        wrapper.unmount();
    });

    it('givenOwnEvent_whenStandardAccountViews_thenShowsFullDetailsNotRestricted', async () => {
        await loginAs('STANDARD_ACCOUNT', 'jdoe');
        const conference = buildConference({ ownerUsername: 'jdoe', organizerUsername: 'jdoe' });

        const wrapper = await mountDialog(conference);

        expect(document.body.textContent).toContain('Quarterly review meeting');
        expect(document.body.textContent).not.toContain('limited access');
        wrapper.unmount();
    });

    it('givenParticipantEmailMatchesSession_whenViewingOthersEvent_thenRequestSlotChangeButtonIsShown', async () => {
        await loginAs('STANDARD_ACCOUNT', 'jdoe', 'jdoe@test.com');
        const conference = buildConference({ participants: ['jdoe@test.com'] });

        const wrapper = await mountDialog(conference);

        expect(document.body.textContent).toContain('Request Slot Change');
        wrapper.unmount();
    });

    it('givenNoRelationToEvent_whenStandardAccountViews_thenRequestSlotChangeButtonIsHidden', async () => {
        await loginAs('STANDARD_ACCOUNT', 'jdoe', 'jdoe@test.com');
        const conference = buildMaskedConference();

        const wrapper = await mountDialog(conference);

        expect(document.body.textContent).not.toContain('Request Slot Change');
        wrapper.unmount();
    });

    it('givenParticipantEmailResolvesToAnInternalAccount_whenViewingEvent_thenDisplaysTheirNameInsteadOfRawEmail', async () => {
        await loginAs('ADMIN', 'admin.user');
        vi.mocked(httpClient.post).mockResolvedValueOnce({
            data: [{ username: 'asmith', email: 'a@test.com', role: 'STANDARD_ACCOUNT', firstName: 'Alice', lastName: 'Smith' }]
        });
        const conference = buildConference();

        const wrapper = await mountDialog(conference);
        await wrapper.vm.$nextTick();

        expect(document.body.textContent).toContain('Alice Smith');
        expect(document.body.textContent).toContain('b@test.com');
        wrapper.unmount();
    });

    it('givenUserClicksStar_whenStoreOptimisticallyUpdates_thenIconReflectsStarredStateInstantly', async () => {
        await loginAs('ADMIN', 'admin.user');
        const conference = buildConference({ isStarred: false, participants: [] });
        let resolveStarCall: (value: { data: ConferenceDto }) => void = () => undefined;
        vi.mocked(httpClient.post).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveStarCall = resolve;
                })
        );
        // Same reference the dialog's `conference` computed will find via `conferencesStore.events` -
        // proves the icon reacts to the STORE, not to the static `conference` prop.
        const conferencesStore = useConferencesStore();
        conferencesStore.events = [conference];

        const wrapper = await mountDialog(conference);
        // `Dialog` renders via `Teleport`, so its content lives directly under `document.body`
        // rather than inside the wrapper's own DOM subtree - queried/clicked through the DOM
        // directly, mirroring the other assertions in this file that read `document.body`.
        const starButton = document.body.querySelector<HTMLButtonElement>('[aria-label="Star"]');
        expect(starButton).not.toBeNull();

        starButton!.click();
        await wrapper.vm.$nextTick();
        await wrapper.vm.$nextTick();

        // Optimistic update: the icon flips before the (still-pending) API call resolves.
        expect(document.body.querySelector('[aria-label="Unstar"]')).not.toBeNull();
        expect(document.body.querySelector('[aria-label="Star"]')).toBeNull();

        resolveStarCall({ data: { ...conference, isStarred: true } });
        await flushPromises();

        expect(document.body.querySelector('[aria-label="Unstar"]')).not.toBeNull();
        wrapper.unmount();
    });
});
