/**
 * Thin client for the background service worker.
 *
 * Inside the extension every call goes through chrome.runtime.sendMessage.
 * Outside it (vite dev preview in a normal browser tab) the same API is backed
 * by an in-page mock so the entire UI can be developed and inspected without
 * loading the extension — clearly labelled in the header.
 */
import type {
  LastPackage,
  ManagerState,
  RepoErrorInfo,
  RequestResponse,
  RuntimeRequest,
  Settings,
  StorageStats,
} from '../../shared/types';

export interface Runtime {
  mode: 'extension' | 'preview';
  getState(): Promise<ManagerState>;
  refreshRepo(force?: boolean): Promise<ManagerState>;
  setSettings(settings: Partial<Settings>): Promise<ManagerState>;
  setSelection(selection: ManagerState['selection']): Promise<ManagerState>;
  clearSelection(): Promise<ManagerState>;
  getSkillContent(id: string): Promise<{ content: string; cached: boolean }>;
  getStorageStats(): Promise<StorageStats>;
  clearCache(): Promise<void>;
  openManager(): Promise<void>;
  getLastPackage(): Promise<LastPackage | null>;
  insertIntoArena(): Promise<unknown>;
  onStateChanged(listener: () => void): () => void;
}

export class RuntimeError extends Error {
  readonly info: RepoErrorInfo | { code: string; message: string };
  constructor(info: RepoErrorInfo | { code: string; message: string }) {
    super(info.message);
    this.info = info;
    this.name = 'RuntimeError';
  }
}

export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id) && Boolean(chrome.runtime?.sendMessage);
}

async function send<T>(request: RuntimeRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(request)) as RequestResponse<T> | undefined;
  if (!response) throw new RuntimeError({ code: 'NO_RESPONSE', message: 'The extension background did not respond. Reopen the extension.' });
  if (!response.ok) throw new RuntimeError(response.error);
  return response.data;
}

export function createExtensionRuntime(): Runtime {
  return {
    mode: 'extension',
    getState: () => send<ManagerState>({ type: 'GET_STATE' }),
    refreshRepo: (force = true) => send<ManagerState>({ type: 'REFRESH_REPO', force }),
    setSettings: (settings) => send<ManagerState>({ type: 'SET_SETTINGS', settings }),
    setSelection: (selection) => send<ManagerState>({ type: 'SET_SELECTION', selection }),
    clearSelection: () => send<ManagerState>({ type: 'CLEAR_SELECTION' }),
    getSkillContent: (id) => send<{ content: string; cached: boolean }>({ type: 'GET_SKILL_CONTENT', id }),
    getStorageStats: () => send<StorageStats>({ type: 'GET_STORAGE_STATS' }),
    clearCache: async () => {
      await send<{ ok: boolean }>({ type: 'CLEAR_CACHE' });
    },
    openManager: async () => {
      await send<{ ok: boolean }>({ type: 'OPEN_MANAGER' });
    },
    getLastPackage: () => send<LastPackage | null>({ type: 'GET_LAST_PACKAGE' }),
    insertIntoArena: () => send<unknown>({ type: 'INSERT_INTO_LM_ARENA' }),
    onStateChanged: (listener) => {
      const handler = (message: { type?: string }) => {
        if (message?.type === 'STATE_CHANGED') listener();
      };
      chrome.runtime.onMessage.addListener(handler);
      return () => chrome.runtime.onMessage.removeListener(handler);
    },
  };
}

let mockRuntime: Runtime | null = null;

/**
 * Lazily created preview runtime (only ever used outside the extension).
 *
 * The fixture module is loaded through a static-import map that is removed from
 * production builds by `scripts/build-targets.mjs` (it replaces
 * `import.meta.env.DEV` with a literal), so no fixture data ships in the
 * extension archive.
 */
export async function getRuntime(): Promise<Runtime> {
  if (isExtensionContext()) return createExtensionRuntime();
  // `import.meta.env.DEV` is statically false in the production build, so this
  // branch (and the fixture module it imports) is removed from the extension.
  if (import.meta.env.DEV) {
    if (!mockRuntime) {
      const { createPreviewRuntime } = await import('./previewRuntime');
      mockRuntime = createPreviewRuntime();
    }
    return mockRuntime;
  }
  throw new RuntimeError({
    code: 'PREVIEW_COMPILED_OUT',
    message:
      'SkillBridge could not reach the extension background. Open the extension from the toolbar, not as a file.',
  });
}
