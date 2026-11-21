/**
 * Cache abstraction over chrome.storage.local with an in-memory fallback so the
 * services are testable (and usable) outside the extension context.
 */
import {
  SKILL_CACHE_MAX_BYTES,
  SKILL_CACHE_MAX_ENTRIES,
  SKILL_CACHE_TTL_MS,
  STORAGE_KEYS,
} from '../shared/config';
import type { RepoSnapshot } from '../shared/types';
import { sha256 } from '../core/hash';

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }
}

export class ChromeLocalStore implements KeyValueStore {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }
  async set(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
  async keys(): Promise<string[]> {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all);
  }
}

export function createDefaultStore(): KeyValueStore {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new ChromeLocalStore();
  }
  return new MemoryStore();
}

export interface CachedSkill {
  path: string;
  content: string;
  hash: string;
  bytes: number;
  fetchedAt: number;
  etag?: string;
}

export interface CachedSnapshot {
  key: string;
  snapshot: RepoSnapshot;
  cachedAt: number;
}

/** Stable cache key for a repository configuration. */
export function repoCacheKey(snapshot: Pick<RepoSnapshot, 'config'> | { config: RepoSnapshot['config'] }): string {
  const c = snapshot.config;
  return [c.owner.toLowerCase(), c.repo.toLowerCase(), c.branch, c.rootDir, c.excludes.join('|')].join('::');
}

export class RepoCache {
  constructor(private readonly store: KeyValueStore) {}

  async readSnapshot(maxAgeMs: number): Promise<CachedSnapshot | null> {
    const cached = await this.store.get<CachedSnapshot>(STORAGE_KEYS.repoCache);
    if (!cached?.snapshot) return null;
    if (Date.now() - cached.cachedAt > maxAgeMs) return null;
    return cached;
  }

  /** Read a snapshot regardless of age (used to render instantly, then refresh). */
  async readSnapshotAny(): Promise<CachedSnapshot | null> {
    return (await this.store.get<CachedSnapshot>(STORAGE_KEYS.repoCache)) ?? null;
  }

  async writeSnapshot(snapshot: RepoSnapshot): Promise<void> {
    await this.store.set(STORAGE_KEYS.repoCache, {
      key: repoCacheKey(snapshot),
      snapshot,
      cachedAt: Date.now(),
    } satisfies CachedSnapshot);
  }

  async readSkill(path: string, maxAgeMs = SKILL_CACHE_TTL_MS): Promise<CachedSkill | null> {
    const key = `${STORAGE_KEYS.skillCachePrefix}${sha256(path).slice(0, 24)}`;
    const cached = await this.store.get<CachedSkill>(key);
    if (!cached) return null;
    if (cached.path !== path) return null;
    if (Date.now() - cached.fetchedAt > maxAgeMs) return null;
    return cached;
  }

  async readSkillAny(path: string): Promise<CachedSkill | null> {
    const key = `${STORAGE_KEYS.skillCachePrefix}${sha256(path).slice(0, 24)}`;
    const cached = await this.store.get<CachedSkill>(key);
    return cached && cached.path === path ? cached : null;
  }

  async writeSkill(skill: Omit<CachedSkill, 'fetchedAt'> & { fetchedAt?: number }): Promise<void> {
    if (skill.bytes > SKILL_CACHE_MAX_BYTES) return; // do not cache huge files
    const key = `${STORAGE_KEYS.skillCachePrefix}${sha256(skill.path).slice(0, 24)}`;
    await this.store.set(key, { ...skill, fetchedAt: skill.fetchedAt ?? Date.now() } satisfies CachedSkill);
    await this.evictIfNeeded();
  }

  private async evictIfNeeded(): Promise<void> {
    const keys = (await this.store.keys()).filter((key) =>
      key.startsWith(STORAGE_KEYS.skillCachePrefix),
    );
    if (keys.length <= SKILL_CACHE_MAX_ENTRIES) return;
    const entries: { key: string; fetchedAt: number }[] = [];
    for (const key of keys) {
      const value = await this.store.get<CachedSkill>(key);
      entries.push({ key, fetchedAt: value?.fetchedAt ?? 0 });
    }
    entries.sort((a, b) => a.fetchedAt - b.fetchedAt);
    const excess = entries.slice(0, entries.length - SKILL_CACHE_MAX_ENTRIES);
    for (const entry of excess) await this.store.remove(entry.key);
  }

  async clearSkills(): Promise<void> {
    const keys = (await this.store.keys()).filter((key) =>
      key.startsWith(STORAGE_KEYS.skillCachePrefix),
    );
    for (const key of keys) await this.store.remove(key);
  }

  async clearAll(): Promise<void> {
    await this.clearSkills();
    await this.store.remove(STORAGE_KEYS.repoCache);
  }

  async stats(): Promise<{ cachedSkills: number; cachedBytes: number; repoCache: boolean }> {
    const keys = (await this.store.keys()).filter((key) =>
      key.startsWith(STORAGE_KEYS.skillCachePrefix),
    );
    let bytes = 0;
    for (const key of keys) {
      const value = await this.store.get<CachedSkill>(key);
      bytes += value?.bytes ?? 0;
    }
    const snapshot = await this.store.get(STORAGE_KEYS.repoCache);
    return { cachedSkills: keys.length, cachedBytes: bytes, repoCache: Boolean(snapshot) };
  }
}
