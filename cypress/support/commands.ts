/**
 * Custom Cypress commands. `login` intercepts `POST /v1/auth/login` so the
 * E2E stubs never depend on a real BFF/Redis session during CI - only the
 * frontend routing/rendering/state wiring is exercised end-to-end.
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            login(username?: string, role?: 'ADMIN' | 'ORGANIZER' | 'STANDARD_ACCOUNT'): Chainable<void>;
        }
    }
}

Cypress.Commands.add('login', (username = 'organizer1', role = 'ORGANIZER') => {
    cy.intercept('POST', '**/v1/auth/login', {
        statusCode: 200,
        body: { token: 'e2e-fake-token', role, username }
    }).as('login');

    cy.visit('/auth/login');
    cy.get('#username1').type(username);
    cy.get('#password1').type('password123');
    cy.contains('button', 'Sign In').click();
    cy.wait('@login');
});

export {};
