/**
 * Runtime storage facade. Chooses chrome.storage.local inside the extension and
 * an in-memory store everywhere else (tests, dev preview).
 */
import { createDefaultStore, RepoCache, type KeyValueStore } from '../services/cache';
import { SettingsService } from '../services/settings';

export const store: KeyValueStore = createDefaultStore();
export const repoCache = new RepoCache(store);
export const settingsService = new SettingsService(store);

/** Lightweight in-memory copy of the last snapshot to avoid storage churn. */
let lastSnapshotKey: string | null = null;

export function rememberSnapshotKey(key: string | null): void {
  lastSnapshotKey = key;
}

export function getRememberedSnapshotKey(): string | null {
  return lastSnapshotKey;
}
