/**
 * Cache scoping — regression tests for the path-only key bug.
 *
 * A skill's content must be addressed by (repository, revision, path). Two
 * repositories that both contain `Android/Kotlin/kotlin-standards.md` must never
 * share bytes, and a new commit or branch switch must never serve the previous
 * revision's content. These tests are written against the public API only, so
 * they keep holding if the key derivation changes internally.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryStore, RepoCache, skillCacheKey, type KeyValueStore } from '../src/services/cache';
import { sha256 } from '../src/core/hash';
import { buildPackage, prefetchSkillContents, resolveSkillSources } from '../src/services/packageService';
import { parseRepositoryTree } from '../src/core/repoTree';
import { STORAGE_KEYS } from '../src/shared/config';
import { snapshotScope } from '../src/shared/types';
import type { CacheScope, RepoConfig, RepoSnapshot } from '../src/shared/types';

const SHARED_PATH = 'Android/Kotlin/kotlin-standards.md';

const repoA: RepoConfig = { owner: 'alice', repo: 'skills', branch: 'main', rootDir: '', excludes: [] };
const repoB: RepoConfig = { owner: 'bob', repo: 'skills', branch: 'main', rootDir: '', excludes: [] };

function snapshotFor(config: RepoConfig, commit: string, contents: Record<string, string>): RepoSnapshot {
  const files = Object.keys(contents).map((path) => ({
    path,
    type: 'blob' as const,
    size: contents[path]!.length,
  }));
  const parsed = parseRepositoryTree(files, { config, rootName: config.repo });
  return { config, commit, fetchedAt: Date.now(), skills: parsed.skills, tree: parsed.tree, warnings: [] };
}

/** Serve different bytes per repository so a leak is immediately visible. */
function fetchByRepo(map: Record<string, Record<string, string>>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const owner = url.includes('/alice/') ? 'alice' : url.includes('/bob/') ? 'bob' : null;
    const contents = owner ? map[owner] : undefined;
    const path = contents
      ? Object.keys(contents).find((candidate) =>
          url.endsWith(candidate.split('/').map(encodeURIComponent).join('/')),
        )
      : undefined;
    if (!contents || !path) {
      return { ok: false, status: 404, text: async () => 'not found' } as unknown as Response;
    }
    return { ok: true, status: 200, text: async () => contents[path] } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('cache key isolation', () => {
  it('derives different keys for different repositories at the same path', () => {
    const scopeA: CacheScope = { owner: 'alice', repo: 'skills', revision: 'c0ffee1' };
    const scopeB: CacheScope = { owner: 'bob', repo: 'skills', revision: 'c0ffee1' };
    expect(skillCacheKey(scopeA, SHARED_PATH)).not.toBe(skillCacheKey(scopeB, SHARED_PATH));
  });

  it('derives different keys for different revisions at the same path', () => {
    const base = { owner: 'alice', repo: 'skills' };
    expect(skillCacheKey({ ...base, revision: 'aaa111' }, SHARED_PATH)).not.toBe(
      skillCacheKey({ ...base, revision: 'bbb222' }, SHARED_PATH),
    );
  });

  it('treats owner/repo case-insensitively but keeps revisions distinct', () => {
    const lower = skillCacheKey({ owner: 'alice', repo: 'skills', revision: 'abc' }, SHARED_PATH);
    const upper = skillCacheKey({ owner: 'ALICE', repo: 'SKILLS', revision: 'abc' }, SHARED_PATH);
    const other = skillCacheKey({ owner: 'alice', repo: 'skills', revision: 'ABC' }, SHARED_PATH);
    expect(upper).toBe(lower);
    expect(other).not.toBe(lower);
  });

  it('never lets two repositories share content for the same path', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    const scopeA: CacheScope = { owner: 'alice', repo: 'skills', revision: 'c0ffee1' };
    const scopeB: CacheScope = { owner: 'bob', repo: 'skills', revision: 'c0ffee1' };

    await cache.writeSkill(scopeA, { path: SHARED_PATH, content: 'ALICE CONTENT', hash: sha256('ALICE CONTENT'), bytes: 13 });

    expect((await cache.readSkillAny(scopeA, SHARED_PATH))?.content).toBe('ALICE CONTENT');
    // The exact same path in another repository must be a miss, not a hit.
    expect(await cache.readSkillAny(scopeB, SHARED_PATH)).toBeNull();
    expect(await cache.readSkill(scopeB, SHARED_PATH)).toBeNull();

    await cache.writeSkill(scopeB, { path: SHARED_PATH, content: 'BOB CONTENT', hash: sha256('BOB CONTENT'), bytes: 11 });
    // Writing B did not overwrite A: both coexist.
    expect((await cache.readSkillAny(scopeA, SHARED_PATH))?.content).toBe('ALICE CONTENT');
    expect((await cache.readSkillAny(scopeB, SHARED_PATH))?.content).toBe('BOB CONTENT');
  });

  it('does not serve content after a commit change at the same path', async () => {
    const cache = new RepoCache(new MemoryStore());
    const older: CacheScope = { owner: 'alice', repo: 'skills', revision: 'commit-1' };
    const newer: CacheScope = { owner: 'alice', repo: 'skills', revision: 'commit-2' };

    await cache.writeSkill(older, { path: SHARED_PATH, content: 'OLD', hash: sha256('OLD'), bytes: 3 });
    expect((await cache.readSkillAny(older, SHARED_PATH))?.content).toBe('OLD');
    expect(await cache.readSkillAny(newer, SHARED_PATH)).toBeNull();
    expect(await cache.readSkill(newer, SHARED_PATH)).toBeNull();
  });

  it('does not serve content after a branch switch that changes the revision', async () => {
    const mainConfig: RepoConfig = { ...repoA, branch: 'main' };
    const devConfig: RepoConfig = { ...repoA, branch: 'dev' };
    const cache = new RepoCache(new MemoryStore());

    // Same repository, same path, different branches => different commit SHAs.
    const onMain = snapshotScope(snapshotFor(mainConfig, 'sha-main', { [SHARED_PATH]: 'x' }));
    const onDev = snapshotScope(snapshotFor(devConfig, 'sha-dev', { [SHARED_PATH]: 'x' }));

    await cache.writeSkill(onMain, { path: SHARED_PATH, content: 'MAIN', hash: sha256('MAIN'), bytes: 4 });
    expect(await cache.readSkillAny(onDev, SHARED_PATH)).toBeNull();
  });

  it('refuses to serve unscoped (legacy) entries even if they sit at the computed key', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    const scope: CacheScope = { owner: 'alice', repo: 'skills', revision: 'abc' };
    // Simulate a tampered/legacy record stored at the right key with no identity.
    await store.set(skillCacheKey(scope, SHARED_PATH), {
      path: SHARED_PATH,
      content: 'UNATTRIBUTED',
      hash: sha256('UNATTRIBUTED'),
      bytes: 13,
      fetchedAt: Date.now(),
    });
    expect(await cache.readSkillAny(scope, SHARED_PATH)).toBeNull();
  });

  it('refuses a cached entry whose content no longer matches its hash', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    const scope: CacheScope = { owner: 'alice', repo: 'skills', revision: 'abc' };
    await cache.writeSkill(scope, { path: SHARED_PATH, content: 'INTACT', hash: sha256('INTACT'), bytes: 6 });
    expect((await cache.readSkillAny(scope, SHARED_PATH))?.content).toBe('INTACT');

    // Corrupt the stored body without touching the recorded hash.
    const key = skillCacheKey(scope, SHARED_PATH);
    const stored = (await store.get<Record<string, unknown>>(key))!;
    await store.set(key, { ...stored, content: 'TAMPERED' });

    // A corrupted entry is a miss, so the caller re-downloads instead of
    // compiling bytes that its own manifest would not describe.
    expect(await cache.readSkillAny(scope, SHARED_PATH)).toBeNull();
    expect(await cache.readSkill(scope, SHARED_PATH)).toBeNull();
  });

  it('refetches corrupted cached content through resolveSkillSources', async () => {
    const store = new MemoryStore();
    const contents = { [SHARED_PATH]: 'TRUTH\n' };
    const snapshot = snapshotFor(repoA, 'sha-a', contents);
    const fetchImpl = fetchByRepo({ alice: contents });
    await resolveSkillSources({
      snapshot,
      skills: snapshot.skills,
      deps: { cache: new RepoCache(store), github: { fetchImpl } },
    });

    const key = skillCacheKey(snapshotScope(snapshot), SHARED_PATH);
    const stored = (await store.get<Record<string, unknown>>(key))!;
    await store.set(key, { ...stored, content: 'CORRUPTED\n' });

    const again = await resolveSkillSources({
      snapshot,
      skills: snapshot.skills,
      deps: { cache: new RepoCache(store), github: { fetchImpl } },
    });
    expect(again.cached).toBe(0);
    expect(again.downloaded).toBe(1);
    expect(again.sources[0]!.content).toBe('TRUTH\n');
  });

  it('purges the retired path-only cache and ignores it for stats', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    // A leftover v1 entry keyed only by path.
    await store.set(`${STORAGE_KEYS.legacySkillCachePrefix}deadbeefdeadbeefdeadbeef`, {
      path: SHARED_PATH,
      content: 'LEGACY',
      hash: sha256('LEGACY'),
      bytes: 6,
      fetchedAt: Date.now(),
    });
    expect((await cache.stats()).cachedSkills).toBe(1);
    expect(await cache.purgeLegacy()).toBe(1);
    expect((await cache.stats()).cachedSkills).toBe(0);
  });

  it('clears both the current and the legacy generations', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    const scope: CacheScope = { owner: 'alice', repo: 'skills', revision: 'abc' };
    await cache.writeSkill(scope, { path: SHARED_PATH, content: 'NEW', hash: sha256('NEW'), bytes: 3 });
    await store.set(`${STORAGE_KEYS.legacySkillCachePrefix}000000000000000000000000`, {
      path: 'old.md',
      content: 'OLD',
      hash: 'h',
      bytes: 3,
      fetchedAt: Date.now(),
    });
    expect((await cache.stats()).cachedSkills).toBe(2);
    await cache.clearAll();
    expect((await cache.stats()).cachedSkills).toBe(0);
    expect((await store.keys()).length).toBe(0);
  });

  it('evicts the oldest entry across repositories, per entry and not per path', async () => {
    const store: KeyValueStore = new MemoryStore();
    const cache = new RepoCache(store);
    const scopeA: CacheScope = { owner: 'alice', repo: 'skills', revision: 'r1' };
    const scopeB: CacheScope = { owner: 'bob', repo: 'skills', revision: 'r1' };

    // Fill the cache with entries from both repositories.
    for (let i = 0; i < 300; i++) {
      await cache.writeSkill(scopeA, {
        path: `a/f${i}.md`,
        content: String(i),
        hash: sha256(String(i)),
        bytes: 1,
        fetchedAt: i,
      });
    }
    for (let i = 0; i < 300; i++) {
      await cache.writeSkill(scopeB, {
        path: `b/f${i}.md`,
        content: String(i),
        hash: sha256(String(i)),
        bytes: 1,
        fetchedAt: 1000 + i,
      });
    }

    const stats = await cache.stats();
    expect(stats.cachedSkills).toBeLessThanOrEqual(400);
    // The oldest entries (repo A's first files) are the ones dropped.
    expect(await cache.readSkillAny(scopeA, 'a/f0.md')).toBeNull();
    // Repo B's newest entries survive, and no collision happened on `fN.md`.
    expect(await cache.readSkillAny(scopeB, 'b/f299.md')).not.toBeNull();
  });
});

describe('cache writes are best effort (reliability)', () => {
  class QuotaStore extends MemoryStore {
    failSkills = true;
    failAll = false;
    override async set(key: string, value: unknown): Promise<void> {
      if (this.failAll || (this.failSkills && key.startsWith(STORAGE_KEYS.skillCachePrefix))) {
        throw new Error('QUOTA_BYTES quota exceeded');
      }
      return super.set(key, value);
    }
  }

  class BrokenStore extends MemoryStore {
    override async get<T>(_key: string): Promise<T | undefined> {
      throw new Error('storage unavailable');
    }
    override async keys(): Promise<string[]> {
      throw new Error('storage unavailable');
    }
    override async remove(_key: string): Promise<void> {
      throw new Error('storage unavailable');
    }
  }

  it('treats an unreadable store as a cache miss instead of failing', async () => {
    const cache = new RepoCache(new BrokenStore());
    const scope: CacheScope = { owner: 'alice', repo: 'skills', revision: 'abc' };
    // Reads degrade to "no cached value"...
    expect(await cache.readSkillAny(scope, 'a.md')).toBeNull();
    expect(await cache.readSkill(scope, 'a.md')).toBeNull();
    expect(await cache.readSnapshotAny()).toBeNull();
    expect(await cache.readSnapshot(1000)).toBeNull();
    // ...and maintenance operations stay quiet.
    await expect(cache.clearAll()).resolves.toBeUndefined();
    await expect(cache.purgeLegacy()).resolves.toBe(0);
    expect(await cache.stats()).toEqual({ cachedSkills: 0, cachedBytes: 0, repoCache: false });
  });

  it('still compiles when the whole store is unavailable', async () => {
    const contents = { [SHARED_PATH]: 'RESILIENT\n' };
    const snapshot = snapshotFor(repoA, 'sha-a', contents);
    const result = await buildPackage(snapshot, { ids: [], allSelected: true }, {
      cache: new RepoCache(new BrokenStore()),
      github: { fetchImpl: fetchByRepo({ alice: contents }) },
    });
    expect(result.pkg.totals.skills).toBe(1);
    expect(result.pkg.markdown).toContain('RESILIENT');
  });

  it('still compiles when storage rejects the cache write', async () => {
    const store = new QuotaStore();
    const contents = { [SHARED_PATH]: 'PAYLOAD\n' };
    const snapshot = snapshotFor(repoA, 'sha-a', contents);
    const result = await resolveSkillSources({
      snapshot,
      skills: snapshot.skills,
      deps: { cache: new RepoCache(store), github: { fetchImpl: fetchByRepo({ alice: contents }) } },
    });
    expect(result.downloaded).toBe(1);
    expect(result.sources[0]!.content).toBe('PAYLOAD\n');
    expect(result.failed).toHaveLength(0);
  });

  it('still compiles a full package when every cache write fails', async () => {
    const store = new QuotaStore();
    store.failAll = true;
    const contents = { [SHARED_PATH]: 'PAYLOAD\n' };
    const snapshot = snapshotFor(repoA, 'sha-a', contents);
    const built = await buildPackage(snapshot, { ids: [], allSelected: true }, {
      cache: new RepoCache(store),
      github: { fetchImpl: fetchByRepo({ alice: contents }) },
    });
    expect(built.pkg.totals.skills).toBe(1);
    expect(built.pkg.markdown).toContain('PAYLOAD');
    expect(built.cached).toBe(0);
  });

  it('does not report a cached entry that was never stored', async () => {
    const store = new QuotaStore();
    const cache = new RepoCache(store);
    const scope: CacheScope = { owner: 'alice', repo: 'skills', revision: 'abc' };
    await cache.writeSkill(scope, { path: 'a.md', content: 'x', hash: sha256('x'), bytes: 1 });
    expect(await cache.readSkillAny(scope, 'a.md')).toBeNull();
  });

  it('survives a quota error while reading keys for stats', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    const scope: CacheScope = { owner: 'alice', repo: 'skills', revision: 'abc' };
    await cache.writeSkill(scope, { path: 'a.md', content: 'x', hash: sha256('x'), bytes: 1 });
    expect((await cache.stats()).cachedSkills).toBe(1);
  });
});

describe('resolveSkillSources is repository- and revision-scoped', () => {
  it('downloads per repository instead of reusing another repo’s cached file', async () => {
    // One shared store, like the extension's chrome.storage.local.
    const store = new MemoryStore();
    const contentsA = { [SHARED_PATH]: 'ALICE VERSION\n' };
    const contentsB = { [SHARED_PATH]: 'BOB VERSION\n' };
    const snapshotA = snapshotFor(repoA, 'sha-a', contentsA);
    const snapshotB = snapshotFor(repoB, 'sha-b', contentsB);

    const cacheA = new RepoCache(store);
    const first = await resolveSkillSources({
      snapshot: snapshotA,
      skills: snapshotA.skills,
      deps: { cache: cacheA, github: { fetchImpl: fetchByRepo({ alice: contentsA, bob: contentsB }) } },
    });
    expect(first.downloaded).toBe(1);
    expect(first.sources[0]!.content).toBe('ALICE VERSION\n');

    // Same store, other repository: must fetch, not read Alice's bytes.
    const cacheB = new RepoCache(store);
    const second = await resolveSkillSources({
      snapshot: snapshotB,
      skills: snapshotB.skills,
      deps: { cache: cacheB, github: { fetchImpl: fetchByRepo({ alice: contentsA, bob: contentsB }) } },
    });
    expect(second.downloaded).toBe(1);
    expect(second.cached).toBe(0);
    expect(second.sources[0]!.content).toBe('BOB VERSION\n');
    // And the integrity hash describes Bob's bytes, not Alice's.
    expect(second.expectedHashes[snapshotB.skills[0]!.id]).not.toBe(
      first.expectedHashes[snapshotA.skills[0]!.id],
    );
  });

  it('refetches instead of reusing content from a previous commit', async () => {
    const store = new MemoryStore();
    const oldContents = { [SHARED_PATH]: 'OLD COMMIT\n' };
    const newContents = { [SHARED_PATH]: 'NEW COMMIT\n' };

    const oldSnapshot = snapshotFor(repoA, 'commit-old', oldContents);
    await resolveSkillSources({
      snapshot: oldSnapshot,
      skills: oldSnapshot.skills,
      deps: { cache: new RepoCache(store), github: { fetchImpl: fetchByRepo({ alice: oldContents }) } },
    });

    const newSnapshot = snapshotFor(repoA, 'commit-new', newContents);
    const result = await resolveSkillSources({
      snapshot: newSnapshot,
      skills: newSnapshot.skills,
      deps: { cache: new RepoCache(store), github: { fetchImpl: fetchByRepo({ alice: newContents }) } },
    });

    expect(result.cached).toBe(0);
    expect(result.downloaded).toBe(1);
    expect(result.sources[0]!.content).toBe('NEW COMMIT\n');
  });

  it('still reuses the cache within one repository and one commit', async () => {
    const store = new MemoryStore();
    const contents = { [SHARED_PATH]: 'STABLE\n' };
    const snapshot = snapshotFor(repoA, 'commit-1', contents);
    const fetchImpl = fetchByRepo({ alice: contents });

    const first = await resolveSkillSources({
      snapshot,
      skills: snapshot.skills,
      deps: { cache: new RepoCache(store), github: { fetchImpl } },
    });
    const second = await resolveSkillSources({
      snapshot,
      skills: snapshot.skills,
      deps: { cache: new RepoCache(store), github: { fetchImpl } },
    });

    expect(first.downloaded).toBe(1);
    expect(second.cached).toBe(1);
    expect(second.downloaded).toBe(0);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(second.sources[0]!.content).toBe('STABLE\n');
  });

  it('keeps byte-exact content when compiling the same path from two repositories', async () => {
    const store = new MemoryStore();
    const contentsA = { [SHARED_PATH]: 'ALICE\n\n```ts\nconst a = 1;\n```\n' };
    const contentsB = { [SHARED_PATH]: 'BOB\n\ntrailing spaces  \n' };
    const snapshotA = snapshotFor(repoA, 'sha-a', contentsA);
    const snapshotB = snapshotFor(repoB, 'sha-b', contentsB);
    const github = { fetchImpl: fetchByRepo({ alice: contentsA, bob: contentsB }) };

    const a = await buildPackage(snapshotA, { ids: [], allSelected: true }, { cache: new RepoCache(store), github });
    const b = await buildPackage(snapshotB, { ids: [], allSelected: true }, { cache: new RepoCache(store), github });

    expect(a.pkg.markdown).toContain(contentsA[SHARED_PATH]!.trimEnd());
    expect(b.pkg.markdown).toContain(contentsB[SHARED_PATH]!.trimEnd());
    // Each package hashes its own bytes: identical paths, different digests.
    const hashOf = (pkg: typeof a.pkg) => pkg.skills.find((entry) => entry.path === SHARED_PATH)!.sha256;
    expect(hashOf(a.pkg)).not.toBe(hashOf(b.pkg));
    // Each package records the right repository.
    expect(a.pkg.repository).toBe('alice/skills');
    expect(b.pkg.repository).toBe('bob/skills');
  });

  it('prefetch uses the same scoping as compilation', async () => {
    const store = new MemoryStore();
    const contentsA = { [SHARED_PATH]: 'ALICE\n' };
    const contentsB = { [SHARED_PATH]: 'BOB\n' };
    const snapshotA = snapshotFor(repoA, 'sha-a', contentsA);
    const snapshotB = snapshotFor(repoB, 'sha-b', contentsB);
    const github = { fetchImpl: fetchByRepo({ alice: contentsA, bob: contentsB }) };

    await prefetchSkillContents(snapshotA, snapshotA.skills.map((s) => s.id), {
      cache: new RepoCache(store),
      github,
    });
    const fetched: string[] = [];
    const probe = {
      cache: new RepoCache(store),
      github: {
        fetchImpl: vi.fn(async (input: RequestInfo | URL) => {
          fetched.push(String(input));
          return fetchByRepo({ bob: contentsB })(input as never);
        }) as unknown as typeof fetch,
      },
    };
    const result = await prefetchSkillContents(snapshotB, snapshotB.skills.map((s) => s.id), probe);
    expect(result.ok).toBe(1);
    expect(fetched).toHaveLength(1);
  });
});
