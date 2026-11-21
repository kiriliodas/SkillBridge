/**
 * Shared Vitest setup.
 *
 * React 19 + Testing Library need `IS_REACT_ACT_ENVIRONMENT` to be explicit;
 * without it every state update logs an "not configured to support act(...)"
 * warning that masks real problems.
 */
import { beforeAll, afterAll } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

// jsdom does not implement these, and both are used by the UI.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
}
