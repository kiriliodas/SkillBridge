/**
 * Built-bundle smoke test.
 *
 * Loads the *actual* `dist/content.js` (what Chrome injects) inside jsdom and
 * drives the message bridge. This catches bundling regressions that unit tests
 * importing the TypeScript source cannot: missing globals, tree-shaken code,
 * top-level crashes, or a listener that never registers.
 *
 * Requires `npm run build:targets` (or `npm run build`); the test is skipped
 * with a clear message when the bundle is absent.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const BUNDLE = resolve('dist/content.js');

type Listener = (message: unknown, sender: unknown, respond: (response: unknown) => void) => boolean;

function loadBundle(): { listener: Listener; responses: unknown[] } {
  const captured: { fn: Listener | null } = { fn: null };
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test-extension',
      onMessage: {
        addListener: (fn: Listener) => {
          captured.fn = fn;
        },
      },
      sendMessage: async () => undefined,
    },
  });
  document.body.innerHTML = '<main><textarea aria-label="Message"></textarea></main>';
  // eslint-disable-next-line no-new-func
  new Function(readFileSync(BUNDLE, 'utf8'))();
  if (!captured.fn) throw new Error('content bundle did not register a listener');
  return { listener: captured.fn, responses: [] };
}

/** Send a message and await the asynchronous `sendResponse` callback. */
function ask(listener: Listener, message: unknown): Promise<any> {
  return new Promise((resolveResponse) => {
    const keepChannelOpen = listener(message, {}, resolveResponse);
    expect(keepChannelOpen).toBe(true);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe.skipIf(!existsSync(BUNDLE))('dist/content.js', () => {
  it('registers a message listener and answers SKILLBRIDGE_PING', async () => {
    const { listener } = loadBundle();
    const response = await ask(listener, { type: 'SKILLBRIDGE_PING' });
    expect(response.ok).toBe(true);
    expect(response.host).toBe(location.host);
    expect(response.diagnostics).toBeTypeOf('object');
  });

  it('answers SKILLBRIDGE_DIAGNOSTICS with the detector output shape', async () => {
    const { listener } = loadBundle();
    const response = await ask(listener, { type: 'SKILLBRIDGE_DIAGNOSTICS' });
    expect(response.ok).toBe(true);
    const diagnostics = response.diagnostics;
    expect(diagnostics).toMatchObject({
      url: expect.any(String),
      host: expect.any(String),
      composerFound: true,
      composerKind: expect.any(String),
      fileInputs: expect.any(Number),
      fileInputSelectors: expect.any(Array),
      attachButtons: expect.any(Array),
      sendButtons: expect.any(Array),
      candidateForms: expect.any(Number),
    });
  });

  it('ignores messages from other extensions', async () => {
    const { listener } = loadBundle();
    expect(listener({ type: 'SOMETHING_ELSE' }, {}, () => undefined)).toBe(false);
    expect(listener(null, {}, () => undefined)).toBe(false);
  });

  it('inserts the prompt but reports the attachment as failed when there is no uploader', async () => {
    const { listener } = loadBundle();
    const response = await ask(listener, {
      type: 'SKILLBRIDGE_INSERT',
      payload: {
        package: {
          fileName: 'skillbridge-package-deadbeef.md',
          mimeType: 'text/markdown',
          content: '# SKILLBRIDGE PACKAGE\n\n## CONTENT\nbody\n',
        },
        prompt: 'Install this package: skillbridge-package-deadbeef.md',
        autoSend: false,
        autoAttach: true,
      },
    });
    expect(response.ok).toBe(true);
    // No upload affordance in this fixture page. The adapter must degrade to the
    // documented fallback — prompt inserted, attachment explicitly reported as
    // NOT attached — and never claim the package was delivered.
    const report = response.report;
    expect(report.outcome).toBe('prompt-only');
    expect(report.failedStep).toBe('attach-package');
    expect(report.steps.some((s: { step: string; status: string }) =>
      s.step === 'attach-package' && s.status === 'failed',
    )).toBe(true);
    expect(report.notes.join(' ')).toMatch(/attach it manually/i);
    // The prompt really is in the composer.
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toContain(
      'skillbridge-package-deadbeef.md',
    );
  });
});
