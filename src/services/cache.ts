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
import type { CacheScope, RepoSnapshot } from '../shared/types';
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
  /** Repository that produced this content (informational; the key is authoritative). */
  owner?: string;
  repo?: string;
  /** Revision (commit SHA, or branch as fallback) the content was read at. */
  revision?: string;
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

/**
 * Normalise a scope so equivalent spellings share entries (GitHub owners and
 * repositories are case-insensitive) while distinct repositories never do.
 */
function normalizeScope(scope: CacheScope): CacheScope {
  return {
    owner: scope.owner.trim().toLowerCase(),
    repo: scope.repo.trim().toLowerCase(),
    revision: scope.revision.trim(),
  };
}

/**
 * Cache key for one skill file inside one repository revision.
 *
 * The path alone is *not* enough: `android/kotlin.md` exists in many
 * repositories, and the same path can legitimately hold different content
 * after a commit or a branch switch. Including owner, repo and revision makes
 * cross-repository and stale-content reuse impossible by construction.
 */
export function skillCacheKey(scope: CacheScope, path: string): string {
  const s = normalizeScope(scope);
  const digest = sha256([s.owner, s.repo, s.revision, path].join('::')).slice(0, 40);
  return `${STORAGE_KEYS.skillCachePrefix}${digest}`;
}

/**
 * True when a stored entry belongs to the requested scope and path *and* its
 * content still matches the hash recorded next to it. The hash check makes the
 * "cached content is trustworthy" assumption verifiable: a record corrupted at
 * rest (truncated write, manual edit, storage bug) is treated as a miss and
 * re-downloaded instead of being compiled into a package.
 */
function entryMatches(entry: CachedSkill | undefined, scope: CacheScope, path: string): entry is CachedSkill {
  if (!entry || entry.path !== path) return false;
  if (typeof entry.content !== 'string' || typeof entry.hash !== 'string') return false;
  const s = normalizeScope(scope);
  // Entries written before scoping (or by a foreign writer) carry no identity:
  // they cannot be attributed to a repository, so they are never served.
  if (entry.owner === undefined || entry.repo === undefined || entry.revision === undefined) return false;
  if (entry.owner.trim().toLowerCase() !== s.owner || entry.repo.trim().toLowerCase() !== s.repo) return false;
  if (entry.revision !== s.revision) return false;
  return sha256(entry.content) === entry.hash;
}

export class RepoCache {
  constructor(private readonly store: KeyValueStore) {}

  /**
   * Best-effort write. The cache is an optimisation: a quota error (or any
   * other storage failure) must never abort the operation that produced the
   * value. Returns true when the entry was stored.
   */
  private async safeSet(key: string, value: unknown): Promise<boolean> {
    try {
      await this.store.set(key, value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Best-effort read. A storage failure is indistinguishable from a miss as
   * far as correctness is concerned: both mean "the caller must fetch".
   */
  private async safeGet<T>(key: string): Promise<T | undefined> {
    try {
      return await this.store.get<T>(key);
    } catch {
      return undefined;
    }
  }

  /** Best-effort key listing: a broken store simply has no cacheable entries. */
  private async safeKeys(): Promise<string[]> {
    try {
      return await this.store.keys();
    } catch {
      return [];
    }
  }

  async readSnapshot(maxAgeMs: number): Promise<CachedSnapshot | null> {
    const cached = await this.safeGet<CachedSnapshot>(STORAGE_KEYS.repoCache);
    if (!cached?.snapshot) return null;
    if (Date.now() - cached.cachedAt > maxAgeMs) return null;
    return cached;
  }

  /** Read a snapshot regardless of age (used to render instantly, then refresh). */
  async readSnapshotAny(): Promise<CachedSnapshot | null> {
    return (await this.safeGet<CachedSnapshot>(STORAGE_KEYS.repoCache)) ?? null;
  }

  async writeSnapshot(snapshot: RepoSnapshot): Promise<void> {
    await this.safeSet(STORAGE_KEYS.repoCache, {
      key: repoCacheKey(snapshot),
      snapshot,
      cachedAt: Date.now(),
    } satisfies CachedSnapshot);
  }

  async readSkill(
    scope: CacheScope,
    path: string,
    maxAgeMs = SKILL_CACHE_TTL_MS,
  ): Promise<CachedSkill | null> {
    const cached = await this.safeGet<CachedSkill>(skillCacheKey(scope, path));
    if (!entryMatches(cached, scope, path)) return null;
    if (Date.now() - cached.fetchedAt > maxAgeMs) return null;
    return cached;
  }

  async readSkillAny(scope: CacheScope, path: string): Promise<CachedSkill | null> {
    const cached = await this.safeGet<CachedSkill>(skillCacheKey(scope, path));
    return entryMatches(cached, scope, path) ? cached : null;
  }

  async writeSkill(
    scope: CacheScope,
    skill: Omit<CachedSkill, 'fetchedAt' | 'owner' | 'repo' | 'revision'> & { fetchedAt?: number },
  ): Promise<void> {
    if (skill.bytes > SKILL_CACHE_MAX_BYTES) return; // do not cache huge files
    const s = normalizeScope(scope);
    const stored = await this.safeSet(skillCacheKey(scope, skill.path), {
      ...skill,
      owner: s.owner,
      repo: s.repo,
      revision: s.revision,
      fetchedAt: skill.fetchedAt ?? Date.now(),
    } satisfies CachedSkill);
    if (!stored) {
      // Storage is full or unavailable. Drop the oldest entries and try once
      // more so a single oversized backlog cannot permanently disable caching.
      await this.evictOldest(Math.max(1, Math.floor(SKILL_CACHE_MAX_ENTRIES / 4)));
      await this.safeSet(skillCacheKey(scope, skill.path), {
        ...skill,
        owner: s.owner,
        repo: s.repo,
        revision: s.revision,
        fetchedAt: skill.fetchedAt ?? Date.now(),
      } satisfies CachedSkill);
      return;
    }
    await this.evictIfNeeded();
  }

  /** Remove the N oldest cached skills (best effort). */
  private async evictOldest(count: number): Promise<void> {
    const keys = (await this.safeKeys()).filter((key) =>
      key.startsWith(STORAGE_KEYS.skillCachePrefix),
    );
    const entries: { key: string; fetchedAt: number }[] = [];
    for (const key of keys) {
      const value = await this.safeGet<CachedSkill>(key);
      entries.push({ key, fetchedAt: value?.fetchedAt ?? 0 });
    }
    entries.sort((a, b) => a.fetchedAt - b.fetchedAt);
    for (const entry of entries.slice(0, count)) {
      try {
        await this.store.remove(entry.key);
      } catch {
        /* best effort */
      }
    }
  }

  private async evictIfNeeded(): Promise<void> {
    const keys = (await this.safeKeys()).filter((key) =>
      key.startsWith(STORAGE_KEYS.skillCachePrefix),
    );
    if (keys.length <= SKILL_CACHE_MAX_ENTRIES) return;
    const entries: { key: string; fetchedAt: number }[] = [];
    for (const key of keys) {
      const value = await this.safeGet<CachedSkill>(key);
      entries.push({ key, fetchedAt: value?.fetchedAt ?? 0 });
    }
    entries.sort((a, b) => a.fetchedAt - b.fetchedAt);
    const excess = entries.slice(0, entries.length - SKILL_CACHE_MAX_ENTRIES);
    for (const entry of excess) await this.store.remove(entry.key);
  }

  /** Remove entries of the retired path-only cache. */
  async purgeLegacy(): Promise<number> {
    const keys = (await this.safeKeys()).filter((key) =>
      key.startsWith(STORAGE_KEYS.legacySkillCachePrefix),
    );
    for (const key of keys) {
      try {
        await this.store.remove(key);
      } catch {
        /* best effort */
      }
    }
    return keys.length;
  }

  async clearSkills(): Promise<void> {
    const prefixes = [STORAGE_KEYS.skillCachePrefix, STORAGE_KEYS.legacySkillCachePrefix];
    const keys = (await this.safeKeys()).filter((key) =>
      prefixes.some((prefix) => key.startsWith(prefix)),
    );
    for (const key of keys) {
      try {
        await this.store.remove(key);
      } catch {
        /* best effort */
      }
    }
  }

  async clearAll(): Promise<void> {
    await this.clearSkills();
    try {
      await this.store.remove(STORAGE_KEYS.repoCache);
    } catch {
      /* best effort: the caller only cares that the cache is not used */
    }
  }

  async stats(): Promise<{ cachedSkills: number; cachedBytes: number; repoCache: boolean }> {
    const prefixes = [STORAGE_KEYS.skillCachePrefix, STORAGE_KEYS.legacySkillCachePrefix];
    const keys = (await this.safeKeys()).filter((key) =>
      prefixes.some((prefix) => key.startsWith(prefix)),
    );
    let bytes = 0;
    for (const key of keys) {
      const value = await this.safeGet<CachedSkill>(key);
      bytes += value?.bytes ?? 0;
    }
    const snapshot = await this.safeGet(STORAGE_KEYS.repoCache);
    return { cachedSkills: keys.length, cachedBytes: bytes, repoCache: Boolean(snapshot) };
  }
}
