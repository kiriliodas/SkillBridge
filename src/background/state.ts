/**
 * Background orchestration: owns repository state, selection and settings, and
 * answers all UI requests. Keeping it here means the popup and the manager page
 * always share one source of truth, even when both are open.
 */
import { REPO_CACHE_TTL_MS } from '../shared/config';
import type {
  ManagerState,
  RepoErrorInfo,
  RepoSnapshot,
  SelectionState,
  Settings,
} from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/config';
import { pruneSelection, normalizeSelection } from '../core/selection';
import { validateRepoConfig, normalizeRepoConfig } from '../core/repoTree';
import { loadRepositorySnapshot, type GithubDeps } from '../services/github';
import { repoCacheKey } from '../services/cache';
import { store, repoCache, settingsService } from './storage';

export interface StateDeps {
  github?: GithubDeps;
  now?: () => number;
}

export class BackgroundState {
  private settings: Settings = structuredClone(DEFAULT_SETTINGS);
  private selection: SelectionState = { ids: [], allSelected: false };
  private repo: RepoSnapshot | null = null;
  private status: ManagerState['status'] = 'idle';
  private error: RepoErrorInfo | null = null;
  private revision = 0;
  private loaded = false;
  private readonly deps: StateDeps;
  private listeners = new Set<() => void>();

  constructor(deps: StateDeps = {}) {
    this.deps = deps;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    this.settings = await settingsService.getSettings();
    // A persisted selection is only meaningful while "remember selection" is on.
    // Otherwise an old value would resurrect after a service-worker restart even
    // though the user explicitly asked SkillBridge not to remember it.
    this.selection = this.settings.behavior.rememberSelection
      ? await settingsService.getSelection()
      : { ids: [], allSelected: false };

    // Render the cached snapshot immediately, then revalidate in background.
    const cached = await repoCache.readSnapshotAny();
    if (cached?.snapshot && repoCacheKey(cached.snapshot) === repoCacheKey({ config: this.settings.repository })) {
      this.repo = cached.snapshot;
      this.status = 'ready';
      this.selection = pruneSelection(this.selection, cached.snapshot);
      this.emit();
      if (cached.cachedAt < Date.now() - REPO_CACHE_TTL_MS) {
        void this.refresh({ silent: true });
      }
    } else {
      this.emit();
    }
  }

  getState(): ManagerState {
    return {
      settings: this.settings,
      selection: this.selection,
      repo: this.repo,
      status: this.status,
      error: this.error,
      revision: this.revision,
    };
  }

  async setSettings(patch: Partial<Settings>): Promise<ManagerState> {
    const previousRepo = normalizeRepoConfig(this.settings.repository);
    this.settings = await settingsService.updateSettings(patch);
    const nextRepo = normalizeRepoConfig(this.settings.repository);
    const repoChanged =
      previousRepo.owner !== nextRepo.owner ||
      previousRepo.repo !== nextRepo.repo ||
      previousRepo.branch !== nextRepo.branch ||
      previousRepo.rootDir !== nextRepo.rootDir ||
      previousRepo.excludes.join('|') !== nextRepo.excludes.join('|');

    if (!this.settings.behavior.rememberSelection) {
      // Forget anything persisted while the option was previously enabled.
      await settingsService.clearSelection();
    }

    if (repoChanged) {
      this.repo = null;
      this.error = null;
      this.status = 'idle';
    }
    this.emit();
    if (repoChanged) {
      const cached = await repoCache.readSnapshotAny();
      if (cached?.snapshot && repoCacheKey(cached.snapshot) === repoCacheKey({ config: nextRepo })) {
        this.repo = cached.snapshot;
        this.status = 'ready';
        this.selection = pruneSelection(this.selection, cached.snapshot);
        this.emit();
      } else {
        void this.refresh();
      }
    }
    return this.getState();
  }

  async setSelection(selection: SelectionState): Promise<ManagerState> {
    this.selection = normalizeSelection(selection);
    if (this.settings.behavior.rememberSelection) {
      await settingsService.saveSelection(this.selection);
    }
    this.emit();
    return this.getState();
  }

  async clearSelection(): Promise<ManagerState> {
    this.selection = { ids: [], allSelected: false };
    if (this.settings.behavior.rememberSelection) {
      await settingsService.saveSelection(this.selection);
    }
    this.emit();
    return this.getState();
  }

  async refresh(options: { force?: boolean; silent?: boolean } = {}): Promise<ManagerState> {
    if (this.status === 'loading') return this.getState();
    const errors = validateRepoConfig(this.settings.repository);
    if (errors.length > 0) {
      this.status = 'error';
      this.error = {
        code: 'INVALID_CONFIG',
        message: errors.join(' '),
        hint: 'Open Settings and check the repository owner, name, branch and root directory.',
      };
      this.emit();
      return this.getState();
    }

    if (!options.force) {
      const cached = await repoCache.readSnapshot(REPO_CACHE_TTL_MS);
      const config = normalizeRepoConfig(this.settings.repository);
      if (cached?.snapshot && repoCacheKey(cached.snapshot) === repoCacheKey({ config })) {
        this.repo = cached.snapshot;
        this.status = 'ready';
        this.error = null;
        this.selection = pruneSelection(this.selection, cached.snapshot);
        this.emit();
        return this.getState();
      }
    }

    if (!options.silent) {
      this.status = 'loading';
      this.error = null;
      this.emit();
    }

    const result = await loadRepositorySnapshot(this.settings.repository, this.deps.github);
    if (result.ok) {
      const snapshot = result.data;
      this.repo = snapshot;
      this.status = 'ready';
      this.error = null;
      this.selection = pruneSelection(this.selection, snapshot);
      await repoCache.writeSnapshot(snapshot);
    } else {
      this.status = this.repo ? 'ready' : 'error';
      this.error = result.error;
    }
    this.emit();
    return this.getState();
  }

  /** Selection ids resolved against the catalogue (for package building). */
  getSelectedIds(): string[] {
    if (!this.repo) return [];
    return this.selection.allSelected ? this.repo.skills.map((s) => s.id) : this.selection.ids;
  }

  getSnapshot(): RepoSnapshot | null {
    return this.repo;
  }

  getSettings(): Settings {
    return this.settings;
  }

  getSelection(): SelectionState {
    return this.selection;
  }

  async storageStats(): Promise<{ cachedSkills: number; cachedBytes: number; repoCache: boolean; snapshotSkills: number | null }> {
    const stats = await repoCache.stats();
    return { ...stats, snapshotSkills: this.repo?.skills.length ?? null };
  }

  async clearCache(): Promise<void> {
    await repoCache.clearAll();
    await store.remove('skillbridge.repoCache.v1');
  }
}

let singleton: BackgroundState | null = null;

export function getBackgroundState(): BackgroundState {
  if (!singleton) singleton = new BackgroundState();
  return singleton;
}
