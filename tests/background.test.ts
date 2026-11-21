/**
 * Background orchestration + tab bridge tests. `chrome` is stubbed so the real
 * BackgroundState, SettingsService and GitHub integration run end-to-end
 * against an in-memory extension storage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepoConfig } from '../src/shared/types';

// ---------------------------------------------------------------------------
// Minimal chrome.storage.local + runtime stub
// ---------------------------------------------------------------------------
const memory: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (key: string | null) => {
        if (key === null) return { ...memory };
        return key in memory ? { [key]: memory[key] } : {};
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(memory, items);
      },
      remove: async (key: string) => {
        delete memory[key];
      },
    },
  },
  runtime: {
    sendMessage: async () => undefined,
    onMessage: { addListener: () => undefined },
  },
  tabs: { query: async () => [], sendMessage: async () => undefined, create: async () => ({}) },
  scripting: { executeScript: async () => [] },
});

const { BackgroundState } = await import('../src/background/state');
const { SettingsService, sanitizeSettings } = await import('../src/services/settings');
const { isLmArenaUrl, pickLmArenaTab, pingContentScript, sendInsertPayload } = await import(
  '../src/background/tabs'
);
const { RepoCache, MemoryStore } = await import('../src/services/cache');
const { STORAGE_KEYS } = await import('../src/shared/config');

const CONFIG: RepoConfig = {
  owner: 'LM-Arena',
  repo: 'LM-Arena-Skills',
  branch: 'main',
  rootDir: 'skills',
  excludes: [],
};

const TREE_RESPONSE = {
  sha: 'deadbeefcafe1234',
  truncated: false,
  tree: [
    { path: 'skills', type: 'tree' },
    { path: 'skills/Android/kotlin.md', type: 'blob', size: 10 },
    { path: 'skills/Web/react.md', type: 'blob', size: 20 },
  ],
};

function githubStub(tree = TREE_RESPONSE) {
  return {
    fetchImpl: vi.fn(async () => ({
      ok: true,
      status: 200,
      url: 'https://api.github.com/x',
      json: async () => tree,
      text: async () => JSON.stringify(tree),
    })) as unknown as typeof fetch,
  };
}

beforeEach(() => {
  for (const key of Object.keys(memory)) delete memory[key];
});

describe('SettingsService', () => {
  it('falls back to defaults when storage cannot be read', async () => {
    const broken = new MemoryStore();
    broken.get = async () => {
      throw new Error('storage unavailable');
    };
    const service = new SettingsService(broken);
    const settings = await service.getSettings();
    expect(settings.behavior.autoSend).toBe(false);
    expect(settings.repository.owner).toBe('anthropics');
    // The selection read is protected the same way.
    expect(await service.getSelection()).toEqual({ ids: [], allSelected: false });
  });

  it('returns defaults when nothing is stored', async () => {
    const service = new SettingsService(new MemoryStore());
    const settings = await service.getSettings();
    expect(settings.behavior.autoSend).toBe(false);
    expect(settings.behavior.autoAttach).toBe(true);
    expect(settings.behavior.copyPrompt).toBe(false);
    expect(settings.behavior.rememberSelection).toBe(true);
    expect(settings.interface.theme).toBe('dark');
  });

  it('merges partial updates and persists them', async () => {
    const service = new SettingsService(new MemoryStore());
    await service.updateSettings({ behavior: { autoSend: true } });
    const settings = await service.getSettings();
    expect(settings.behavior.autoSend).toBe(true);
    expect(settings.behavior.autoAttach).toBe(true);
  });

  it('sanitizes corrupt stored values without throwing', () => {
    expect(sanitizeSettings(null).repository.branch).toBe('main');
    expect(sanitizeSettings({ interface: { theme: 'neon' as never } }).interface.theme).toBe('dark');
    expect(sanitizeSettings({ repository: { excludes: 'nope' as never } }).repository.excludes).toEqual([]);
    expect(sanitizeSettings({ behavior: { autoAttach: false } }).behavior.autoAttach).toBe(false);
  });

  it('persists and restores the selection', async () => {
    const service = new SettingsService(new MemoryStore());
    await service.saveSelection({ ids: ['b', 'a'], allSelected: false });
    expect(await service.getSelection()).toEqual({ ids: ['a', 'b'], allSelected: false });
    await service.clearSelection();
    expect(await service.getSelection()).toEqual({ ids: [], allSelected: false });
  });
});

describe('BackgroundState', () => {
  it('loads settings, refreshes the repository and caches the snapshot', async () => {
    const state = new BackgroundState({ github: githubStub() });
    await state.ensureLoaded();
    await state.setSettings({ repository: CONFIG } as never);
    await state.refresh({ force: true });
    expect(state.getState().repo?.skills).toHaveLength(2);
    expect(state.getState().status).toBe('ready');

    // A second instance reuses the cached snapshot without any fetch.
    const fetchImpl = vi.fn(async () => {
      throw new Error('should not fetch');
    });
    const second = new BackgroundState({ github: { fetchImpl: fetchImpl as unknown as typeof fetch } });
    await second.ensureLoaded();
    expect(second.getState().repo?.skills).toHaveLength(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('exposes an error state with an actionable message', async () => {
    const state = new BackgroundState({
      github: {
        fetchImpl: vi.fn(async () => ({
          ok: false,
          status: 404,
          url: 'x',
          json: async () => ({}),
          text: async () => '',
        })) as unknown as typeof fetch,
      },
    });
    await state.ensureLoaded();
    await state.setSettings({ repository: CONFIG } as never);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const current = state.getState();
    expect(current.status).toBe('error');
    expect(current.error?.code).toBe('NOT_FOUND');
  });

  it('validates the configuration before fetching', async () => {
    const fetchImpl = vi.fn();
    const state = new BackgroundState({ github: { fetchImpl: fetchImpl as unknown as typeof fetch } });
    await state.ensureLoaded();
    await state.setSettings({ repository: { ...CONFIG, owner: '' } } as never);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(state.getState().error?.code).toBe('INVALID_CONFIG');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('prunes selections that no longer exist after a refresh', async () => {
    const state = new BackgroundState({ github: githubStub() });
    await state.ensureLoaded();
    await state.setSettings({ repository: CONFIG } as never);
    await state.refresh({ force: true });
    const validId = encodeURIComponent('skills/Android/kotlin.md');
    await state.setSelection({ ids: [validId, 'gone'], allSelected: false });
    expect(state.getState().selection.ids).toHaveLength(2);
    await state.refresh({ force: true });
    expect(state.getState().selection.ids).toEqual([validId]);
  });

  it('forgets a persisted selection when "remember selection" is off', async () => {
    const state = new BackgroundState({ github: githubStub() });
    await state.ensureLoaded();
    await state.setSettings({ repository: CONFIG } as never);
    await state.refresh({ force: true });
    const id = encodeURIComponent('skills/Android/kotlin.md');
    await state.setSelection({ ids: [id], allSelected: false });

    // Turning the option off must erase what was already persisted.
    await state.setSettings({ behavior: { rememberSelection: false } } as never);
    expect(memory[STORAGE_KEYS.selection]).toEqual({ ids: [], allSelected: false });

    // ...and a restarted worker must not resurrect a stale selection.
    await state.setSelection({ ids: [id], allSelected: false });
    expect(memory[STORAGE_KEYS.selection]).toEqual({ ids: [], allSelected: false });
    const restarted = new BackgroundState({ github: githubStub() });
    await restarted.ensureLoaded();
    expect(restarted.getState().selection).toEqual({ ids: [], allSelected: false });
  });

  it('restores a persisted selection while "remember selection" is on', async () => {
    const state = new BackgroundState({ github: githubStub() });
    await state.ensureLoaded();
    await state.setSettings({ repository: CONFIG } as never);
    await state.refresh({ force: true });
    const id = encodeURIComponent('skills/Android/kotlin.md');
    await state.setSelection({ ids: [id], allSelected: false });

    const restarted = new BackgroundState({ github: githubStub() });
    await restarted.ensureLoaded();
    expect(restarted.getState().selection.ids).toEqual([id]);
  });

  it('resets the selection when the repository changes', async () => {
    const state = new BackgroundState({ github: githubStub() });
    await state.ensureLoaded();
    await state.setSettings({ repository: CONFIG } as never);
    await state.refresh({ force: true });
    const id = encodeURIComponent('skills/Android/kotlin.md');
    await state.setSelection({ ids: [id], allSelected: false });
    expect(state.getState().selection.ids).toHaveLength(1);

    // Another repository can legitimately contain a file at the same path, so
    // a path-derived id must never survive the switch.
    await state.setSettings({ repository: { ...CONFIG, owner: 'someone-else' } } as never);
    expect(state.getState().selection).toEqual({ ids: [], allSelected: false });
    expect(memory[STORAGE_KEYS.selection]).toEqual({ ids: [], allSelected: false });
  });

  it('keeps the selection when only non-repository settings change', async () => {
    const state = new BackgroundState({ github: githubStub() });
    await state.ensureLoaded();
    await state.setSettings({ repository: CONFIG } as never);
    await state.refresh({ force: true });
    const id = encodeURIComponent('skills/Android/kotlin.md');
    await state.setSelection({ ids: [id], allSelected: false });

    await state.setSettings({ behavior: { autoSend: true } } as never);
    expect(state.getState().selection.ids).toEqual([id]);
  });

  it('clears the selection and reports stats', async () => {
    const state = new BackgroundState({ github: githubStub() });
    await state.ensureLoaded();
    await state.setSettings({ repository: CONFIG } as never);
    await state.refresh({ force: true });
    const stats = await state.storageStats();
    expect(stats.snapshotSkills).toBe(2);
    await state.clearSelection();
    expect(state.getState().selection.ids).toEqual([]);
  });
});

describe('LM Arena tab bridge', () => {
  it('recognises LM Arena URLs only', () => {
    expect(isLmArenaUrl('https://lmarena.ai/')).toBe(true);
    expect(isLmArenaUrl('https://www.lmarena.ai/chat/abc')).toBe(true);
    expect(isLmArenaUrl('https://lmarena.ai.evil.com/')).toBe(false);
    expect(isLmArenaUrl('https://evil.com/?next=lmarena.ai')).toBe(false);
    expect(isLmArenaUrl('chrome://extensions')).toBe(false);
    expect(isLmArenaUrl(undefined)).toBe(false);
  });

  it('prefers the active LM Arena tab', () => {
    const tabs = [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://lmarena.ai/chat/1', active: false },
      { id: 3, url: 'https://lmarena.ai/chat/2', active: true },
    ];
    expect(pickLmArenaTab(tabs)?.id).toBe(3);
    expect(pickLmArenaTab([{ id: 9, url: 'https://example.com' }])).toBeNull();
    expect(pickLmArenaTab([{ id: 4, url: 'https://lmarena.ai/' }])?.id).toBe(4);
  });

  it('reports an unreachable content script', async () => {
    const send = vi.fn(async () => {
      throw new Error('Receiving end does not exist.');
    });
    const result = await pingContentScript(1, send as never);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Receiving end/);
  });

  it('normalises a failed insert into a structured report', async () => {
    const report = await sendInsertPayload(1, {} as never, (async () => {
      throw new Error('tab closed');
    }) as never);
    expect(report.outcome).toBe('failed');
    expect(report.failedStep).toBe('content-script');
    expect(report.steps[0]!.message).toMatch(/tab closed/);
  });

  it('passes through a successful report', async () => {
    const expected = {
      outcome: 'sent' as const,
      steps: [{ step: 'send' as const, status: 'ok' as const, message: 'ok' }],
    };
    const report = await sendInsertPayload(1, {} as never, (async () => ({ ok: true, report: expected })) as never);
    expect(report).toEqual(expected);
  });

  it('handles a missing response body', async () => {
    const report = await sendInsertPayload(1, {} as never, (async () => undefined) as never);
    expect(report.outcome).toBe('failed');
    expect(report.steps[0]!.message).toMatch(/did not respond/);
  });
});

describe('RepoCache with chrome storage', () => {
  it('survives a new store instance (persistence)', async () => {
    const { ChromeLocalStore } = await import('../src/services/cache');
    const first = new RepoCache(new ChromeLocalStore());
    const scope = { owner: 'lm-arena', repo: 'lm-arena-skills', revision: 'deadbeefcafe' };
    const { sha256 } = await import('../src/core/hash');
    await first.writeSkill(scope, { path: 'a.md', content: '# a', hash: sha256('# a'), bytes: 3 });
    const second = new RepoCache(new ChromeLocalStore());
    expect((await second.readSkillAny(scope, 'a.md'))?.content).toBe('# a');
  });
});
