/**
 * Service-worker smoke test.
 *
 * Loads the real `background/index.ts` with a Chrome-like global environment and
 * a fake LM Arena tab, then drives the actual message protocol:
 *   GET_STATE → REFRESH_REPO → SET_SELECTION → INSERT_INTO_LM_ARENA
 *
 * This exercises the wiring that the unit tests can only cover piecewise
 * (listener registration, response envelope, insert orchestration, last-package
 * persistence).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationReport } from '../src/shared/types';

const listeners: ((message: unknown, sender: unknown, respond: (r: unknown) => void) => boolean)[] = [];
const storage: Record<string, unknown> = {};
let sentMessages: unknown[] = [];
let tabMessageHandler: ((message: unknown) => unknown) | null = null;
let injectedFiles: string[] = [];

const TREE = {
  sha: 'feedfacecafe0001',
  truncated: false,
  tree: [
    { path: 'skills/Android/kotlin.md', type: 'blob', size: 20 },
    { path: 'skills/Android/coroutines.md', type: 'blob', size: 30 },
    { path: 'skills/Web/react.md', type: 'blob', size: 40 },
  ],
};

const FILES: Record<string, string> = {
  'skills/Android/kotlin.md': '# Kotlin\n\ncontent\n',
  'skills/Android/coroutines.md': '# Coroutines\n\ncontent\n',
  'skills/Web/react.md': '# React\n\ncontent\n',
};

function installChromeStub(): void {
  const chromeStub = {
    storage: {
      local: {
        get: async (key: string | null) => {
          if (key === null) return { ...storage };
          return key in storage ? { [key]: storage[key] } : {};
        },
        set: async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        },
        remove: async (key: string) => {
          delete storage[key];
        },
      },
    },
    runtime: {
      id: 'test-extension',
      sendMessage: async (message: unknown) => {
        sentMessages.push(message);
        return undefined;
      },
      onMessage: {
        addListener: (fn: (typeof listeners)[number]) => listeners.push(fn),
      },
      onInstalled: { addListener: () => undefined },
      onStartup: { addListener: () => undefined },
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    tabs: {
      query: async () => [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://lmarena.ai/chat/abc', active: true },
      ],
      sendMessage: async (_tabId: number, message: { type?: string }) => {
        if (message.type === 'SKILLBRIDGE_PING') return { ok: true };
        if (message.type === 'SKILLBRIDGE_INSERT') {
          return tabMessageHandler ? await tabMessageHandler(message) : undefined;
        }
        return undefined;
      },
      create: async () => ({}),
    },
    scripting: {
      executeScript: async ({ files }: { files: string[] }) => {
        injectedFiles.push(...files);
        return [];
      },
    },
  };
  vi.stubGlobal('chrome', chromeStub);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/git/trees/')) {
        return {
          ok: true,
          status: 200,
          url,
          json: async () => TREE,
          text: async () => JSON.stringify(TREE),
        };
      }
      const path = Object.keys(FILES).find((key) =>
        url.endsWith(key.split('/').map(encodeURIComponent).join('/')),
      );
      if (path) {
        return { ok: true, status: 200, url, text: async () => FILES[path]!, json: async () => ({}) };
      }
      return { ok: false, status: 404, url, text: async () => 'not found', json: async () => ({}) };
    }),
  );
}

/** Send a message through the registered runtime listener and await the reply. */
async function call(message: { type: string } & Record<string, unknown>): Promise<any> {
  const listener = listeners[listeners.length - 1];
  if (!listener) throw new Error('no runtime listener registered');
  return await new Promise((resolve) => {
    listener(message, {}, resolve);
  });
}

beforeEach(() => {
  listeners.length = 0;
  sentMessages = [];
  injectedFiles = [];
  tabMessageHandler = null;
  for (const key of Object.keys(storage)) delete storage[key];
  vi.resetModules();
  installChromeStub();
});

describe('service worker protocol', () => {
  it('registers a runtime message listener on load', async () => {
    await import('../src/background/index');
    expect(listeners.length).toBe(1);
  });

  it('answers GET_STATE with the manager state envelope', async () => {
    await import('../src/background/index');
    const response = await call({ type: 'GET_STATE' });
    expect(response.ok).toBe(true);
    expect(response.data.settings.repository.owner).toBe('anthropics');
    expect(response.data.selection).toEqual({ ids: [], allSelected: false });
  });

  it('refreshes the repository and exposes discovered skills', async () => {
    await import('../src/background/index');
    await call({ type: 'GET_STATE' });
    const response = await call({ type: 'REFRESH_REPO', force: true });
    expect(response.ok).toBe(true);
    expect(response.data.repo.skills).toHaveLength(3);
    expect(response.data.status).toBe('ready');
    expect(response.data.error).toBeNull();
  });

  it('persists selection changes', async () => {
    await import('../src/background/index');
    await call({ type: 'GET_STATE' });
    await call({ type: 'REFRESH_REPO', force: true });
    const id = encodeURIComponent('skills/Android/kotlin.md');
    const response = await call({ type: 'SET_SELECTION', selection: { ids: [id], allSelected: false } });
    expect(response.ok).toBe(true);
    expect(response.data.selection.ids).toEqual([id]);
    const cleared = await call({ type: 'CLEAR_SELECTION' });
    expect(cleared.data.selection.ids).toEqual([]);
  });

  it('serves skill content through GET_SKILL_CONTENT and caches it', async () => {
    await import('../src/background/index');
    await call({ type: 'GET_STATE' });
    await call({ type: 'REFRESH_REPO', force: true });
    const id = encodeURIComponent('skills/Web/react.md');
    const first = await call({ type: 'GET_SKILL_CONTENT', id });
    expect(first.ok).toBe(true);
    expect(first.data.content).toBe(FILES['skills/Web/react.md']);
    const second = await call({ type: 'GET_SKILL_CONTENT', id });
    expect(second.data.cached).toBe(true);
  });

  it('returns a structured error for an unknown skill id', async () => {
    await import('../src/background/index');
    await call({ type: 'GET_STATE' });
    await call({ type: 'REFRESH_REPO', force: true });
    const response = await call({ type: 'GET_SKILL_CONTENT', id: 'nope' });
    expect(response.ok).toBe(false);
    expect(response.error.message).toMatch(/not found/i);
  });

  it('rejects unknown request types without crashing', async () => {
    await import('../src/background/index');
    const response = await call({ type: 'DOES_NOT_EXIST' });
    expect(response.ok).toBe(false);
    expect(response.error.message).toMatch(/Unknown request type/);
  });

  it('runs the full insert flow against a fake LM Arena tab and stores the package', async () => {
    await import('../src/background/index');
    await call({ type: 'GET_STATE' });
    await call({ type: 'REFRESH_REPO', force: true });
    await call({ type: 'SET_SELECTION', selection: { ids: [], allSelected: true } });

    let received: { package?: { content: string; fileName: string }; prompt?: string } = {};
    tabMessageHandler = async (message: unknown) => {
      received = (message as { payload: typeof received }).payload;
      const report: IntegrationReport = {
        outcome: 'attached-and-filled',
        steps: [
          { step: 'attach-package', status: 'ok', message: 'attached' },
          { step: 'verify-attachment', status: 'ok', message: 'chip' },
          { step: 'verify-prompt', status: 'ok', message: 'prompt' },
          { step: 'send', status: 'skipped', message: 'auto-send off' },
        ],
      };
      return { ok: true, report };
    };

    const response = await call({ type: 'INSERT_INTO_LM_ARENA' });
    expect(response.ok).toBe(true);
    expect(response.data.outcome).toBe('attached-and-filled');

    // The page received a real, complete package and the matching prompt.
    expect(received.package?.fileName).toMatch(/^skillbridge-package-[a-f0-9]{8}\.md$/);
    expect(received.package?.content.startsWith('# SKILLBRIDGE PACKAGE')).toBe(true);
    for (const content of Object.values(FILES)) {
      expect(received.package?.content).toContain(content.trim());
    }
    expect(received.prompt).toContain(received.package!.fileName);

    // The package survives for the fallback path.
    const last = await call({ type: 'GET_LAST_PACKAGE' });
    expect(last.ok).toBe(true);
    expect(last.data.fileName).toBe(received.package!.fileName);
    expect(last.data.markdown).toBe(received.package!.content);
  });

  it('reports a missing LM Arena tab instead of guessing', async () => {
    installChromeStub();
    // Only non-LM-Arena tabs.
    (chrome.tabs.query as unknown as () => Promise<unknown>) = async () => [
      { id: 5, url: 'https://example.com', active: true },
    ];
    await import('../src/background/index');
    await call({ type: 'GET_STATE' });
    await call({ type: 'REFRESH_REPO', force: true });
    await call({ type: 'SET_SELECTION', selection: { ids: [], allSelected: true } });
    const response = await call({ type: 'INSERT_INTO_LM_ARENA' });
    expect(response.ok).toBe(true);
    expect(response.data.outcome).toBe('failed');
    expect(response.data.failedStep).toBe('detect-tab');
    expect(response.data.steps[0].message).toMatch(/No LM Arena tab/);
  });

  it('reports a package build failure when content cannot be downloaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/git/trees/')) {
          return { ok: true, status: 200, url, json: async () => TREE, text: async () => '' };
        }
        return { ok: false, status: 500, url, text: async () => '', json: async () => ({}) };
      }),
    );
    await import('../src/background/index');
    await call({ type: 'GET_STATE' });
    await call({ type: 'REFRESH_REPO', force: true });
    await call({ type: 'SET_SELECTION', selection: { ids: [], allSelected: true } });
    const response = await call({ type: 'INSERT_INTO_LM_ARENA' });
    expect(response.ok).toBe(true);
    expect(response.data.outcome).toBe('failed');
    expect(response.data.steps.some((s: { message: string }) => /Could not download/.test(s.message))).toBe(true);
  });
});
