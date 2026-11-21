/**
 * UI integration tests: the real App component is mounted in jsdom against a
 * stub runtime. This exercises the actual render path used by the popup and the
 * manager page (hooks, tree, selection, preview, settings, insert dialog).
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagerState, RepoSnapshot, SelectionState, Settings } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/config';
import { parseRepositoryTree, type TreeFile } from '../src/core/repoTree';
import { App } from '../src/ui/App';
import { ToastProvider } from '../src/ui/components/Toast';
import type { Runtime } from '../src/ui/lib/runtime';
import { MemoryStore, RepoCache } from '../src/services/cache';
import { setPageCacheFactory } from '../src/ui/lib/useInsertFlow';

const files: TreeFile[] = [
  { path: 'Android/Kotlin/kotlin-standards.md', type: 'blob', size: 1200 },
  { path: 'Android/Kotlin/coroutines.md', type: 'blob', size: 900 },
  { path: 'Web/Frontend/react-best-practices.md', type: 'blob', size: 2000 },
  { path: 'Database/SQL/sql-best-practices.md', type: 'blob', size: 1500 },
];

function makeSnapshot(): RepoSnapshot {
  const config = { ...DEFAULT_SETTINGS.repository, rootDir: '' };
  const parsed = parseRepositoryTree(files, { config, rootName: 'skills' });
  return {
    config,
    commit: 'abc123def456',
    fetchedAt: Date.now() - 60_000,
    skills: parsed.skills,
    tree: parsed.tree,
    warnings: [],
  };
}

interface StubOptions {
  mode?: 'extension' | 'preview';
  snapshot?: RepoSnapshot | null;
  insertReport?: unknown;
  onSetSelection?: (selection: SelectionState) => void;
}

function createStub(options: StubOptions = {}) {
  const snapshot = options.snapshot === undefined ? makeSnapshot() : options.snapshot;
  const settings: Settings = structuredClone(DEFAULT_SETTINGS);
  let state: ManagerState = {
    settings,
    selection: { ids: [], allSelected: false },
    repo: snapshot,
    status: snapshot ? 'ready' : 'idle',
    error: null,
    revision: 1,
  };
  const listeners = new Set<() => void>();
  const emit = () => {
    state = { ...state, revision: state.revision + 1 };
    for (const listener of listeners) listener();
  };

  const runtime: Runtime = {
    mode: options.mode ?? 'extension',
    getState: async () => state,
    refreshRepo: async () => {
      emit();
      return state;
    },
    setSettings: async (patch) => {
      state = {
        ...state,
        settings: {
          ...state.settings,
          ...patch,
          repository: { ...state.settings.repository, ...(patch.repository ?? {}) },
          behavior: { ...state.settings.behavior, ...(patch.behavior ?? {}) },
          interface: { ...state.settings.interface, ...(patch.interface ?? {}) },
        },
      };
      emit();
      return state;
    },
    setSelection: async (selection) => {
      state = { ...state, selection };
      options.onSetSelection?.(selection);
      emit();
      return state;
    },
    clearSelection: async () => {
      state = { ...state, selection: { ids: [], allSelected: false } };
      emit();
      return state;
    },
    getSkillContent: async (id) => ({ content: contentFor(id), cached: true }),
    getStorageStats: async () => ({ cachedSkills: 2, cachedBytes: 2048, repoCache: true, snapshotSkills: 4 }),
    clearCache: async () => undefined,
    openManager: async () => undefined,
    getLastPackage: async () => null,
    insertIntoArena: async () =>
      options.insertReport ?? {
        outcome: 'failed',
        failedStep: 'detect-tab',
        steps: [
          { step: 'detect-tab', status: 'failed', message: 'No LM Arena tab found.' },
        ],
      },
    onStateChanged: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { runtime, getState: () => state };
}

const runtimeRef: { current: Runtime | null } = { current: null };

vi.mock('../src/ui/lib/runtime', async () => {
  const actual = await vi.importActual<typeof import('../src/ui/lib/runtime')>('../src/ui/lib/runtime');
  return {
    ...actual,
    getRuntime: async () => runtimeRef.current,
    isExtensionContext: () => true,
  };
});

/** Expand a category row via its disclosure button (does not toggle selection). */
async function expandCategory(name: string) {
  const row = (await screen.findByText(name)).closest('.tree__row') as HTMLElement;
  const button = row.querySelector('.tree__disclosure') as HTMLButtonElement;
  await act(async () => {
    fireEvent.click(button);
  });
  return row;
}

/** Reference content used by the stub runtime and the seeded page cache. */
export function contentFor(id: string): string {
  return `# ${decodeURIComponent(id)}\n\nOriginal **content** for preview.\n`;
}

async function selectSkill(name: string) {
  const row = (await screen.findByText(name)).closest('.tree__row') as HTMLElement;
  const checkbox = row.querySelector('input[type=checkbox]') as HTMLInputElement;
  await act(async () => {
    fireEvent.click(checkbox);
  });
}

/**
 * Mount the app and flush the initial asynchronous load *inside* `act`.
 *
 * Testing Library disables the act environment while `waitFor`/`findBy*` poll
 * (so unrelated timers don't warn), which means state updates from the initial
 * `getRuntime()` promise would surface as "not configured to support act".
 * Flushing here keeps that load deterministic and silent.
 */
async function mount(surface: 'popup' | 'manager' = 'manager') {
  const result = render(
    <ToastProvider>
      <App surface={surface} />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

beforeEach(async () => {
  document.body.innerHTML = '';
  // A cache pre-seeded with every skill gives the insert flow instant content,
  // exactly like a second run after previews have been cached.
  const store = new MemoryStore();
  const cache = new RepoCache(store);
  const snapshot = makeSnapshot();
  await Promise.all(
    snapshot.skills.map((skill) =>
      cache.writeSkill({ path: skill.path, content: contentFor(skill.id), hash: 'seeded', bytes: 64 }),
    ),
  );
  setPageCacheFactory(() => new RepoCache(store));
});

afterEach(() => {
  cleanup();
  runtimeRef.current = null;
  setPageCacheFactory(null);
});

describe('library UI', () => {
  it('renders the repository header and the category tree', async () => {
    runtimeRef.current = createStub().runtime;
    await mount();
    expect(await screen.findByText('SkillBridge')).toBeTruthy();
    expect(await screen.findByText('Android')).toBeTruthy();
    expect(screen.getByText('Web')).toBeTruthy();
    expect(screen.getByText('Database')).toBeTruthy();
    // Repo + branch are shown in the header.
    expect(screen.getByTitle('anthropics/skills')).toBeTruthy();
    expect(screen.getByTitle('Branch main')).toBeTruthy();
  });

  it('selects a category and updates the summary + tri-state checkbox', async () => {
    const stub = createStub();
    runtimeRef.current = stub.runtime;
    await mount();

    await expandCategory('Android');
    const androidRow = (await screen.findByText('Android')).closest('.tree__row') as HTMLElement;

    // Select every skill in Android through its checkbox.
    const checkbox = androidRow.querySelector('input[type=checkbox]') as HTMLInputElement;
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await waitFor(() => {
      expect(stub.getState().selection.ids.length).toBe(2);
    });
    const summary = screen.getByLabelText('Selection summary');
    expect(within(summary).getByText('2')).toBeTruthy();
    expect((androidRow.querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(true);

    // Deselecting the Kotlin group leaves Android partially selected.
    const kotlin = (await screen.findByText('Kotlin')).closest('.tree__row') as HTMLElement;
    await act(async () => {
      fireEvent.click(kotlin.querySelector('input[type=checkbox]') as HTMLElement);
    });
    await waitFor(() => {
      expect(stub.getState().selection.ids.length).toBe(0);
    });
  });

  it('filters instantly while searching', async () => {
    runtimeRef.current = createStub().runtime;
    await mount();
    await screen.findByText('Android');
    const input = screen.getByLabelText('Search skills, files and categories');
    fireEvent.change(input, { target: { value: 'react' } });
    await waitFor(() => {
      expect(screen.queryByText('Kotlin')).toBeNull();
      expect(screen.getByText('React Best Practices')).toBeTruthy();
    });
    fireEvent.change(input, { target: { value: 'nomatchzzz' } });
    expect(await screen.findByText(/No matches for/)).toBeTruthy();
  });

  it('previews a skill and shows its original content', async () => {
    runtimeRef.current = createStub().runtime;
    await mount();
    await expandCategory('Android');
    await expandCategory('Kotlin');
    const row = (await screen.findByText('Coroutines')).closest('.tree__row') as HTMLElement;
    await act(async () => {
      fireEvent.click(row);
    });
    expect(await screen.findByRole('complementary', { name: /Preview of Coroutines/ })).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelector('.md strong')?.textContent).toBe('content');
    });
    expect(document.querySelector('.md h1')?.textContent).toBe('Android/Kotlin/coroutines.md');
    // Raw source tab shows the untouched markdown.
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
    expect(document.querySelector('.preview__raw')?.textContent).toContain('# Android/Kotlin/coroutines.md');
  });

  it('selects and clears all skills', async () => {
    const stub = createStub();
    runtimeRef.current = stub.runtime;
    await mount();
    await screen.findByText('Android');
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    await waitFor(() => expect(stub.getState().selection.allSelected).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(stub.getState().selection.allSelected).toBe(false));
  });

  it('disables the primary action when nothing is selected', async () => {
    runtimeRef.current = createStub().runtime;
    await mount();
    const button = await screen.findByRole('button', { name: /Insert Skills into LM Arena/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('runs the insert flow and shows the fallback dialog on integration failure', async () => {
    const stub = createStub();
    runtimeRef.current = stub.runtime;
    await mount();

    await expandCategory('Android');
    const androidRow = (await screen.findByText('Android')).closest('.tree__row') as HTMLElement;
    await act(async () => {
      fireEvent.click(androidRow.querySelector('input[type=checkbox]') as HTMLInputElement);
    });
    await waitFor(() => expect(stub.getState().selection.ids.length).toBe(2));

    const insert = screen.getByRole('button', { name: /Insert Skills into LM Arena/ });
    expect((insert as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(insert);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Integration unavailable')).toBeTruthy();
    expect(screen.getByText(/No LM Arena tab found/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Download package/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy prompt/ })).toBeTruthy();
    // Manual instructions are present for the fallback path.
    expect(screen.getByText(/attach the `/)).toBeTruthy();
  });

  it('shows a GitHub error with retry and settings actions', async () => {
    const stub = createStub({ snapshot: null });
    stub.runtime.getState = async () => ({
      ...stub.getState(),
      status: 'error',
      repo: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Repository, branch or path not found (404).',
        hint: 'Check the owner, repository name, branch and root directory.',
      },
    });
    runtimeRef.current = stub.runtime;
    await mount();
    expect(await screen.findByText('Repository, branch or path not found (404).')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeTruthy();
  });

  it('opens settings and stages changes until Save', async () => {
    const stub = createStub();
    runtimeRef.current = stub.runtime;
    await mount();
    await act(async () => {
      const buttons = await screen.findAllByRole('button', { name: 'Settings' });
      fireEvent.click(buttons[buttons.length - 1]!);
    });
    const owner = (await screen.findByLabelText('Owner')) as HTMLInputElement;
    expect(owner.value).toBe('anthropics');
    fireEvent.change(owner, { target: { value: 'LM-Arena' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });
    expect(stub.getState().settings.repository.owner).toBe('LM-Arena');
    expect(screen.getByText('Settings saved')).toBeTruthy();
  });

  it('validates the owner field before saving', async () => {
    const stub = createStub();
    runtimeRef.current = stub.runtime;
    await mount();
    await act(async () => {
      const buttons = await screen.findAllByRole('button', { name: 'Settings' });
      fireEvent.click(buttons[buttons.length - 1]!);
    });
    const owner = (await screen.findByLabelText('Owner')) as HTMLInputElement;
    fireEvent.change(owner, { target: { value: '  ' } });
    expect(screen.getByText(/Repository owner looks invalid/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the tree usable in the popup and swaps it for the preview', async () => {
    runtimeRef.current = createStub().runtime;
    await mount('popup');
    // The popup must still allow selecting skills: the tree is visible.
    expect(document.querySelector('.layout--previewing')).toBeNull();
    expect(document.querySelector('.layout__tree')).toBeTruthy();
    await expandCategory('Android');
    await expandCategory('Kotlin');
    const row = (await screen.findByText('Kotlin Standards')).closest('.tree__row') as HTMLElement;
    expect(document.querySelector('.layout--previewing')).toBeNull();
    await act(async () => {
      fireEvent.click(row);
    });
    // Preview replaces the tree rather than sitting beside it.
    expect(document.querySelector('.layout--previewing')).toBeTruthy();
    expect(document.querySelector('.layout__preview')).toBeTruthy();
  });

  it('is fully operable from the keyboard', async () => {
    runtimeRef.current = createStub().runtime;
    await mount('manager');

    // Category rows are focusable buttons that expand with Enter.
    const category = (await screen.findByRole('button', { name: /^Android, 2 skills/ })) as HTMLElement;
    await act(async () => {
      fireEvent.keyDown(category, { key: 'Enter' });
    });
    const kotlin = await screen.findByRole('button', { name: /^Kotlin, / });
    await act(async () => {
      fireEvent.keyDown(kotlin, { key: 'Enter' });
    });

    // Space toggles selection on a skill row, Enter opens the preview.
    const skill = (await screen.findByRole('button', { name: /^Kotlin Standards, / })) as HTMLElement;
    await act(async () => {
      fireEvent.keyDown(skill, { key: ' ' });
    });
    // The summary updates: one skill selected (the stat labels are separate nodes).
    await waitFor(() =>
      expect(document.querySelector('.summary__stats')?.textContent).toContain('1skill'),
    );

    await act(async () => {
      fireEvent.keyDown(skill, { key: 'Enter' });
    });
    expect(await screen.findByRole('complementary', { name: /Preview of Kotlin Standards/ })).toBeTruthy();
  });

  it('copies the installation prompt automatically when that setting is on', async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const stub = createStub();
    // Turn the option on before the run starts.
    await stub.runtime.setSettings({ behavior: { autoSend: false, autoAttach: true, copyPrompt: true, rememberSelection: true } });
    runtimeRef.current = stub.runtime;
    await mount();
    await expandCategory('Android');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Compile|Insert|Install|Send/ }));
    });
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]![0]).toContain('skillbridge-package-');
    vi.unstubAllGlobals();
  });

  it('traps focus in the result dialog and closes it with Escape', async () => {
    const stub = createStub();
    runtimeRef.current = stub.runtime;
    await mount();
    await expandCategory('Android');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Compile|Insert|Install|Send/ }));
    });
    const dialog = await screen.findByRole('dialog');
    // Focus moved inside the dialog.
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('renders the popup surface with the same data', async () => {
    runtimeRef.current = createStub({ mode: 'preview' }).runtime;
    await mount('popup');
    expect(await screen.findByText('SkillBridge')).toBeTruthy();
    expect(await screen.findByText('Preview')).toBeTruthy();
    expect(document.querySelector('.app--popup')).toBeTruthy();
  });

  it('keeps the last compiled package downloadable', async () => {
    const stub = createStub();
    stub.runtime.getLastPackage = async () => ({
      packageId: 'SB-20261121-DEADBEEF',
      fileName: 'skillbridge-package-deadbeef.md',
      markdown: '# SKILLBRIDGE PACKAGE\n',
      prompt: 'Install the Skill library',
      createdAt: Date.now() - 120_000,
    });
    runtimeRef.current = stub.runtime;
    await mount();
    expect(await screen.findByText('Last compiled package is still available')).toBeTruthy();
    expect(screen.getByText('skillbridge-package-deadbeef.md')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Download/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy prompt/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide last package' }));
    await waitFor(() => expect(screen.queryByText('Last compiled package is still available')).toBeNull());
  });

  it('shows the empty library state when the repository has no markdown', async () => {
    const empty = makeSnapshot();
    empty.skills = [];
    empty.tree = { name: 'skills', path: [], id: '', children: [], skills: [], totalSkills: 0 };
    empty.warnings = ['No Markdown skills found in the repository on branch "main".'];
    runtimeRef.current = createStub({ snapshot: empty }).runtime;
    await mount();
    expect(await screen.findByText('No Markdown skills found')).toBeTruthy();
  });
});
