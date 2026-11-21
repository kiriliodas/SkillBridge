/**
 * Settings + selection persistence. Settings are merged deeply with defaults so
 * forward-compatible additions never break stored values.
 */
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/config';
import type { SelectionState, Settings } from '../shared/types';
import { normalizeSelection } from '../core/selection';
import { normalizeRepoConfig } from '../core/repoTree';
import type { KeyValueStore } from './cache';
import { createDefaultStore } from './cache';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function mergeSettings(base: Settings, patch: DeepPartial<Settings>): Settings {
  return {
    repository: {
      ...base.repository,
      ...(patch.repository ?? {}),
      excludes: (patch.repository?.excludes ?? base.repository.excludes) as string[],
    },
    behavior: { ...base.behavior, ...(patch.behavior ?? {}) },
    interface: { ...base.interface, ...(patch.interface ?? {}) },
    maxPackageSizeMb:
      typeof patch.maxPackageSizeMb === 'number' && patch.maxPackageSizeMb > 0
        ? patch.maxPackageSizeMb
        : base.maxPackageSizeMb,
  };
}

/** Validate and coerce a persisted settings object. Never throws. */
export function sanitizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS);
  const input = raw as DeepPartial<Settings>;
  let merged = mergeSettings(structuredClone(DEFAULT_SETTINGS), input);
  merged = {
    ...merged,
    repository: {
      ...merged.repository,
      owner: String(merged.repository.owner ?? '').trim(),
      repo: String(merged.repository.repo ?? '').trim(),
      branch: String(merged.repository.branch ?? 'main').trim() || 'main',
      rootDir: String(merged.repository.rootDir ?? '').trim(),
      excludes: Array.isArray(merged.repository.excludes)
        ? merged.repository.excludes.map(String).filter(Boolean)
        : [],
    },
    behavior: {
      autoSend: Boolean(merged.behavior.autoSend),
      autoAttach: merged.behavior.autoAttach !== false,
      copyPrompt: Boolean(merged.behavior.copyPrompt),
      rememberSelection: merged.behavior.rememberSelection !== false,
    },
    interface: {
      theme:
        merged.interface.theme === 'light' || merged.interface.theme === 'system'
          ? merged.interface.theme
          : 'dark',
      compact: Boolean(merged.interface.compact),
    },
  };
  merged.repository = normalizeRepoConfig(merged.repository);
  return merged;
}

export class SettingsService {
  private readonly store: KeyValueStore;

  constructor(store: KeyValueStore = createDefaultStore()) {
    this.store = store;
  }

  async getSettings(): Promise<Settings> {
    const raw = await this.store.get<unknown>(STORAGE_KEYS.settings);
    return sanitizeSettings(raw);
  }

  async saveSettings(settings: Settings): Promise<Settings> {
    const sanitized = sanitizeSettings(settings);
    await this.store.set(STORAGE_KEYS.settings, sanitized);
    return sanitized;
  }

  async updateSettings(patch: DeepPartial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    return this.saveSettings(mergeSettings(current, patch));
  }

  async getSelection(): Promise<SelectionState> {
    const raw = await this.store.get<SelectionState>(STORAGE_KEYS.selection);
    if (!raw || !Array.isArray(raw.ids)) return { ids: [], allSelected: false };
    return normalizeSelection(raw);
  }

  async saveSelection(selection: SelectionState): Promise<void> {
    await this.store.set(STORAGE_KEYS.selection, normalizeSelection(selection));
  }

  async clearSelection(): Promise<void> {
    await this.store.set(STORAGE_KEYS.selection, { ids: [], allSelected: false });
  }
}
