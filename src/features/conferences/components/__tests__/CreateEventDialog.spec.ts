import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import httpClient from '@/services/httpClient';
import CreateEventDialog from '@/features/conferences/components/CreateEventDialog.vue';
import { useAuthStore } from '@/stores/authStore';
import { PermissionCode } from '@/types/auth.types';

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
        post: vi.fn()
    }
}));

// `Textarea`'s auto-resize feature observes its own element - not under test here, and
// jsdom doesn't implement `ResizeObserver`.
class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// `Calendar`'s (`DatePicker`) responsive breakpoint logic queries `matchMedia` - not under
// test here, and jsdom doesn't implement it.
vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
    }))
);

vi.mock('@/features/conferences/components/ConferenceMiniMap.vue', () => ({
    default: {
        name: 'ConferenceMiniMap',
        props: ['location'],
        template: '<div />'
    }
}));

vi.mock('@/features/providers/stores/providers.store', () => ({
    useProvidersStore: () => ({ activeProviders: [] })
}));

vi.mock('@/features/conferences/stores/conferences.store', () => ({
    useConferencesStore: () => ({ createEvent: vi.fn() })
}));

async function loginAs(role: 'ADMIN' | 'ORGANIZER' | 'STANDARD_ACCOUNT', username: string, email = `${username}@test.com`): Promise<void> {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { token: 'token', role, username, email, permissions: ROLE_PERMISSIONS_FIXTURE[role] } });
    const authStore = useAuthStore();
    await authStore.login({ username, password: 'secret' });
}

async function mountDialog() {
    const wrapper = mount(CreateEventDialog, {
        attachTo: document.body,
        props: { visible: false },
        global: {
            plugins: [PrimeVue, ToastService]
        }
    });
    // Mirrors production usage (`CalendarView.vue`'s `v-model:visible`): the dialog is
    // mounted hidden and toggled open afterwards, so `watch(() => props.visible, ...)` fires.
    await wrapper.setProps({ visible: true });
    await flushPromises();
    return wrapper;
}

function findOnBehalfAutoComplete(wrapper: Awaited<ReturnType<typeof mountDialog>>) {
    return wrapper.findAllComponents({ name: 'AutoComplete' }).find((autoComplete) => autoComplete.props('optionLabel') === 'username');
}

describe('CreateEventDialog - On Behalf Of', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('givenOrganizerTypesAQuery_whenComplete_thenSearchesAccountsAndPopulatesSuggestions', async () => {
        await loginAs('ORGANIZER', 'organizer.user');
        const wrapper = await mountDialog();
        vi.mocked(httpClient.get).mockResolvedValueOnce({
            data: [
                { username: 'jdoe', email: 'jdoe@test.com', role: 'STANDARD_ACCOUNT' },
                { username: 'asmith', email: 'asmith@test.com', role: 'STANDARD_ACCOUNT' }
            ]
        });
        const onBehalfAutoComplete = findOnBehalfAutoComplete(wrapper);
        expect(onBehalfAutoComplete).toBeDefined();

        await onBehalfAutoComplete!.vm.$emit('complete', { query: 'jd' });
        await flushPromises();

        expect(httpClient.get).toHaveBeenCalledWith('/accounts/search', { params: { q: 'jd' } });
        expect(onBehalfAutoComplete!.props('suggestions')).toEqual([
            { username: 'jdoe', email: 'jdoe@test.com', role: 'STANDARD_ACCOUNT' },
            { username: 'asmith', email: 'asmith@test.com', role: 'STANDARD_ACCOUNT' }
        ]);
        wrapper.unmount();
    });

    it('givenOrganizerSelectsASystemUser_whenModelValueChanges_thenOnlyThatSingleAccountMapsToOwnerUsername', async () => {
        await loginAs('ORGANIZER', 'organizer.user');
        const wrapper = await mountDialog();
        const onBehalfAutoComplete = findOnBehalfAutoComplete(wrapper);
        const selectedAccount = { username: 'jdoe', email: 'jdoe@test.com', role: 'STANDARD_ACCOUNT' };

        // A single account object is bound (not an array), proving only one can be selected at a time.
        await onBehalfAutoComplete!.vm.$emit('update:modelValue', selectedAccount);
        await flushPromises();

        expect(onBehalfAutoComplete!.props('modelValue')).toEqual(selectedAccount);

        // Selecting a second account REPLACES the first rather than accumulating a list/chips.
        const anotherAccount = { username: 'asmith', email: 'asmith@test.com', role: 'STANDARD_ACCOUNT' };
        await onBehalfAutoComplete!.vm.$emit('update:modelValue', anotherAccount);
        await flushPromises();

        expect(onBehalfAutoComplete!.props('modelValue')).toEqual(anotherAccount);
        wrapper.unmount();
    });

    it('givenStandardAccountOpensDialog_thenOnBehalfOfFieldIsHiddenAndAccountsAreNotSearched', async () => {
        await loginAs('STANDARD_ACCOUNT', 'jdoe');

        const wrapper = await mountDialog();

        expect(httpClient.get).not.toHaveBeenCalled();
        expect(document.body.textContent).not.toContain('On Behalf Of');
        wrapper.unmount();
    });

    it('givenAccountSearchFails_whenOrganizerTypesAQuery_thenSurfacesTheBffErrorInsteadOfSilentlyEmptySuggestions', async () => {
        await loginAs('ORGANIZER', 'organizer.user');
        const wrapper = await mountDialog();
        vi.mocked(httpClient.get).mockRejectedValueOnce({
            isAxiosError: true,
            response: { data: { message: 'Insufficient permissions to list accounts.' } }
        });
        const onBehalfAutoComplete = findOnBehalfAutoComplete(wrapper);

        await onBehalfAutoComplete!.vm.$emit('complete', { query: 'jd' });
        await flushPromises();

        expect(onBehalfAutoComplete!.props('suggestions')).toEqual([]);
        // The failure must be visible to the user, not a silent empty/unresponsive field.
        expect(document.body.textContent).toContain('Insufficient permissions to list accounts.');
        wrapper.unmount();
    });
});
