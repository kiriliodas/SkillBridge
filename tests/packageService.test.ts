import { describe, expect, it, vi } from 'vitest';
import { MemoryStore, RepoCache } from '../src/services/cache';
import { buildPackage, PackageBuildError, prefetchSkillContents, resolveSkillSources } from '../src/services/packageService';
import { parseRepositoryTree } from '../src/core/repoTree';
import { extractSkills } from '../src/core/compiler';
import type { RepoConfig, RepoSnapshot } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/config';

const config: RepoConfig = {
  owner: 'LM-Arena',
  repo: 'skills',
  branch: 'main',
  rootDir: '',
  excludes: [],
};

const CONTENTS: Record<string, string> = {
  'Android/Kotlin/kotlin-standards.md': '# Kotlin Standards\n\nUse 4 spaces.\n',
  'Android/Kotlin/coroutines.md': '# Coroutines\n\n```kotlin\nsuspend fun x()\n```\n',
  'Web/react.md': '# React\n\n| a | b |\n|---|---|\n| 1 | 2 |\n',
  'Réseau/sécurité.md': '# Sécurité réseau\n\nContenu accentué 🚀\n',
};

function makeSnapshot(): RepoSnapshot {
  const files = Object.keys(CONTENTS).map((path) => ({ path, type: 'blob' as const, size: CONTENTS[path]!.length }));
  const parsed = parseRepositoryTree(files, { config, rootName: 'skills' });
  return {
    config,
    commit: 'abc123',
    fetchedAt: Date.now(),
    skills: parsed.skills,
    tree: parsed.tree,
    warnings: [],
  };
}

function makeFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.keys(CONTENTS).find((path) =>
      url.endsWith(path.split('/').map(encodeURIComponent).join('/')),
    );
    if (!match) return { ok: false, status: 404, text: async () => 'not found' } as unknown as Response;
    return { ok: true, status: 200, text: async () => CONTENTS[match] } as unknown as Response;
  }) as unknown as typeof fetch;
}

const allIds = (snapshot: RepoSnapshot) => snapshot.skills.map((s) => s.id);

describe('buildPackage', () => {
  it('downloads every selected skill and compiles a lossless package', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    const progress: number[] = [];
    const built = await buildPackage(snapshot, { ids: [], allSelected: true }, {
      cache,
      github: { fetchImpl: makeFetch() },
      onProgress: (done) => progress.push(done),
    });

    expect(built.pkg.totals.skills).toBe(4);
    expect(built.downloaded).toBe(4);
    expect(built.cached).toBe(0);
    expect(progress).toEqual([1, 2, 3, 4]);

    const extracted = extractSkills(built.pkg.markdown);
    const bySkillId = new Map(extracted.map((e) => [decodeURIComponent(e.skillId), e.content]));
    for (const [path, content] of Object.entries(CONTENTS)) {
      expect(bySkillId.get(path)).toBe(content);
    }
    expect(built.prompt).toContain(built.pkg.fileName);
  });

  it('uses the cache on a second run and avoids redundant downloads', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    const fetchImpl = makeFetch();
    await buildPackage(snapshot, { ids: [], allSelected: true }, { cache, github: { fetchImpl } });
    const second = await buildPackage(snapshot, { ids: [], allSelected: true }, { cache, github: { fetchImpl } });
    expect(second.cached).toBe(4);
    expect(second.downloaded).toBe(0);
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(4);
  });

  it('compiles a subset in canonical order', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    const react = snapshot.skills.find((s) => s.fileName === 'react.md')!;
    const kotlin = snapshot.skills.find((s) => s.fileName === 'kotlin-standards.md')!;
    const built = await buildPackage(snapshot, { ids: [react.id, kotlin.id], allSelected: false }, {
      cache,
      github: { fetchImpl: makeFetch() },
    });
    expect(built.pkg.skills.map((s) => s.path)).toEqual([
      'Android/Kotlin/kotlin-standards.md',
      'Web/react.md',
    ]);
  });

  it('rejects an empty selection', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    await expect(
      buildPackage(snapshot, { ids: [], allSelected: false }, { cache, github: { fetchImpl: makeFetch() } }),
    ).rejects.toBeInstanceOf(PackageBuildError);
  });

  it('reports download failures with the affected paths', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, text: async () => '' }) as unknown as Response);
    await expect(
      buildPackage(snapshot, { ids: [], allSelected: true }, {
        cache,
        github: { fetchImpl: fetchImpl as unknown as typeof fetch },
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_UNAVAILABLE', failedPaths: expect.any(Array) });
  });

  it('enforces the package size limit', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    await expect(
      buildPackage(snapshot, { ids: [], allSelected: true }, {
        cache,
        github: { fetchImpl: makeFetch() },
        maxPackageBytes: 10,
      }),
    ).rejects.toMatchObject({ code: 'PACKAGE_TOO_LARGE' });
  });

  it('records verified hashes so integrity checks pass', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    const built = await buildPackage(snapshot, { ids: [], allSelected: true }, {
      cache,
      github: { fetchImpl: makeFetch() },
    });
    expect(built.pkg.markdown).not.toContain('CHANGED SINCE DISCOVERY');
    expect(built.pkg.skills.every((s) => s.sha256.length === 64)).toBe(true);
  });
});

describe('resolveSkillSources', () => {
  it('keeps going after failures and reports them', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('react.md')) {
        return { ok: false, status: 500, text: async () => '' } as unknown as Response;
      }
      return { ok: true, status: 200, text: async () => '# ok\n' } as unknown as Response;
    });
    const result = await resolveSkillSources({
      snapshot,
      skills: snapshot.skills,
      deps: { cache, github: { fetchImpl: fetchImpl as unknown as typeof fetch } },
    });
    expect(result.sources).toHaveLength(3);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.path).toBe('Web/react.md');
  });

  it('bypasses the cache when asked', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    const fetchImpl = makeFetch();
    await resolveSkillSources({ snapshot, skills: snapshot.skills, deps: { cache, github: { fetchImpl } } });
    const result = await resolveSkillSources({
      snapshot,
      skills: snapshot.skills,
      deps: { cache, github: { fetchImpl } },
      bypassCache: true,
    });
    expect(result.downloaded).toBe(4);
  });

  it('prefetch reports ok/failed counts', async () => {
    const snapshot = makeSnapshot();
    const cache = new RepoCache(new MemoryStore());
    const result = await prefetchSkillContents(snapshot, allIds(snapshot).slice(0, 2), {
      cache,
      github: { fetchImpl: makeFetch() },
    });
    expect(result.ok).toBe(2);
    expect(result.failed).toEqual([]);
  });
});

describe('RepoCache', () => {
  it('round-trips snapshots with TTL', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    const snapshot = makeSnapshot();
    await cache.writeSnapshot(snapshot);
    expect((await cache.readSnapshot(1000))?.snapshot.commit).toBe('abc123');
    expect(await cache.readSnapshot(-1)).toBeNull();
    expect((await cache.readSnapshotAny())?.key).toContain('lm-arena::skills');
  });

  it('round-trips skill content', async () => {
    const cache = new RepoCache(new MemoryStore());
    await cache.writeSkill({ path: 'A/a.md', content: '# a', hash: 'h', bytes: 3 });
    const read = await cache.readSkill('A/a.md');
    expect(read?.content).toBe('# a');
    expect(await cache.readSkill('A/other.md')).toBeNull();
  });

  it('does not cache oversized files', async () => {
    const cache = new RepoCache(new MemoryStore());
    await cache.writeSkill({ path: 'big.md', content: 'x', hash: 'h', bytes: 10 * 1024 * 1024 });
    expect(await cache.readSkillAny('big.md')).toBeNull();
  });

  it('evicts the oldest entries beyond the limit', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    for (let i = 0; i < 405; i++) {
      await cache.writeSkill({ path: `f${i}.md`, content: 'x', hash: 'h', bytes: 1, fetchedAt: i });
    }
    const stats = await cache.stats();
    expect(stats.cachedSkills).toBeLessThanOrEqual(400);
    expect(await cache.readSkillAny('f0.md')).toBeNull();
    expect(await cache.readSkillAny('f404.md')).not.toBeNull();
  });

  it('clears everything', async () => {
    const cache = new RepoCache(new MemoryStore());
    await cache.writeSkill({ path: 'a.md', content: 'x', hash: 'h', bytes: 1 });
    await cache.writeSnapshot(makeSnapshot());
    await cache.clearAll();
    expect(await cache.stats()).toMatchObject({ cachedSkills: 0, repoCache: false });
  });

  it('is isolated per repository configuration', async () => {
    const store = new MemoryStore();
    const cache = new RepoCache(store);
    await cache.writeSnapshot(makeSnapshot());
    const other = { ...makeSnapshot(), config: { ...DEFAULT_SETTINGS.repository, owner: 'other' } };
    await cache.writeSnapshot(other);
    const read = await cache.readSnapshotAny();
    expect(read?.key).toContain('other');
  });
});
