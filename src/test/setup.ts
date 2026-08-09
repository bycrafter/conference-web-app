// Global Vitest setup - runs before every test file.
import { config } from '@vue/test-utils';

// PrimeVue components used via auto-import are unregistered globally in
// unit tests unless explicitly stubbed/mounted with a real PrimeVue plugin,
// so component specs that render templates should stub unknown elements
// rather than fail on missing custom-element definitions.
config.global.config.warnHandler = () => undefined;
