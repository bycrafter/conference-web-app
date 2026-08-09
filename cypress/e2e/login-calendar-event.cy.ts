/**
 * End-to-end stub for the critical Login -> Calendar -> Event Creation ->
 * Slot Request flow. All BFF calls are stubbed via `cy.intercept` so the
 * spec exercises frontend routing/rendering/state only, independent of a
 * live `conference-web-api`/Redis session.
 */
describe('Login -> Calendar -> Event Creation -> Slot Request', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/v1/providers/active', {
            statusCode: 200,
            body: { items: [{ id: 'provider-1', name: 'Zoom Pool A', vendor: 'ZOOM', type: 'POOL', status: 'ACTIVE', accounts: [] }] }
        }).as('activeProviders');

        cy.intercept('GET', '**/v1/conferences*', {
            statusCode: 200,
            body: { items: [], totalElements: 0, totalPages: 0, page: 0, size: 500 }
        }).as('conferencesSearch');

        cy.intercept('GET', '**/v1/conferences/stream', { statusCode: 200, body: '' }).as('conferencesStream');
    });

    it('givenOrganizerCredentials_whenLoggingIn_thenLandsOnAnAuthorizedRoute', () => {
        cy.login('organizer1', 'ORGANIZER');

        cy.location('pathname').should('not.eq', '/auth/login');
    });

    it('givenAuthenticatedOrganizer_whenVisitingCalendar_thenCalendarGridRenders', () => {
        cy.login('organizer1', 'ORGANIZER');

        cy.visit('/calendar');
        cy.wait('@activeProviders');
        cy.contains('Calendar').should('be.visible');
        cy.contains('button', 'New Event').should('be.visible');
    });

    it('givenAuthenticatedOrganizer_whenOpeningNewEventDialog_thenCreationFormIsPresented', () => {
        cy.login('organizer1', 'ORGANIZER');

        cy.visit('/calendar');
        cy.wait('@activeProviders');
        cy.contains('button', 'New Event').click();

        cy.contains('New Event').should('be.visible');
        cy.get('#event-title').should('be.visible');
        cy.get('#event-provider').should('be.visible');
    });

    it('givenAuthenticatedOrganizer_whenVisitingSlotRequests_thenTokenLookupScreenRenders', () => {
        // The real BFF contract has no list/search endpoint - requests are looked up
        // one at a time by their one-time action token (delivered via email link).
        cy.login('organizer1', 'ORGANIZER');

        cy.visit('/slot-requests');
        cy.contains('Slot Requests').should('be.visible');
        cy.get('#slot-request-token').should('be.visible');
    });

    it('givenAuthenticatedOrganizer_whenVisitingSlotRequestWithToken_thenDetailsAreLookedUpByToken', () => {
        cy.intercept('GET', '**/v1/slot-requests/*', {
            statusCode: 200,
            body: {
                id: 'sr-1',
                conferenceId: 'conf-1',
                requesterUsername: 'organizer1',
                requestedStartTime: Date.now(),
                requestedEndTime: Date.now() + 3600000,
                justification: 'Need to shift 30 minutes later due to a conflict',
                status: 'PENDING'
            }
        }).as('slotRequestByToken');

        cy.login('organizer1', 'ORGANIZER');

        cy.visit('/slot-requests/sample-action-token');
        cy.wait('@slotRequestByToken');
        cy.contains('Approve').should('be.visible');
        cy.contains('Reject').should('be.visible');
    });
});
