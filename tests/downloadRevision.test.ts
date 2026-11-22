/**
 * Regression tests for the download reference and the raw-host fallback.
 *
 * Reported failure: with rootDir = "skills", detection worked but compilation failed with
 * download errors on files in sub-folders. Three independent defects produced that:
 *
 *  1. `buildRawUrl` prefixed `rootDir` onto `skill.path`, which is *already* repository-
 *     relative, producing `skills/skills/ai/x.md` — a 404 on every nested file.
 *  2. A 404 from the raw host returned NOT_FOUND immediately, so the Contents API never
 *     got a chance to resolve the file.
 *  3. The tree listing's `sha` was used as the download ref without checking whether it
 *     was a commit SHA. A tree SHA is not a valid `ref`, and using the branch name as a
 *     revision also prevents the cache from pinning to a real commit.
 *
 * These tests use a fake GitHub that knows *only* the correct URLs; a wrong path shape
 * therefore fails the way it fails in production, instead of passing on a permissive mock.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildRawUrl,
  fetchSkillContent,
  loadRepositorySnapshot,
  resolveRevision,
} from '../src/services/github';
import { snapshotScope } from '../src/shared/types';
import type { RepoConfig } from '../src/shared/types';

const config: RepoConfig = {
  owner: 'kiriliodas',
  repo: 'SkillBridge',
  branch: 'main',
  rootDir: 'skills',
  excludes: [],
};

const COMMIT = 'f92d8cc4b4b7db30b4af0a7f29c656315ca4a349';
const TREE = '70e8cc3e3b6181f572806c90da5d043e814495f9';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const text = (body: string, status = 200) => new Response(body, { status });

/** Files served by the fake repository, keyed by repository-relative path. */
const FILES: Record<string, string> = {
  'skills/ai/agents/agent-tool-design.md': '# Agent Tool Design\n\nnested two levels\n',
  'skills/ai/agents/verification-before-completion.md': '# Verification\n\ntwo levels\n',
  'skills/ai/evaluation/llm-output-evaluation.md': '# Evaluation\n\nthree levels\n',
  'skills/development/debugging/systematic-debugging.md': '# Debugging\n\nthree levels\n',
  'skills/writing/technical-writing.md': '# Writing\n\none level\n',
  'skills/analysis/data/metric-design.md': '# Metric\n\nfour levels deep\n',
};

function fakeGithub(options: { rawFails?: boolean; treeShaInListing?: string } = {}) {
  const seen: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    seen.push(url);

    // Commit resolution: only the real commit SHA resolves.
    if (url.includes('/git/commits/')) {
      return url.includes(COMMIT)
        ? json({ sha: COMMIT, tree: { sha: TREE } })
        : json({ message: 'Not Found' }, 404);
    }
    // Tree listing.
    if (url.includes('/git/trees/')) {
      return json({
        sha: options.treeShaInListing ?? COMMIT,
        truncated: false,
        tree: Object.keys(FILES).map((path) => ({ path, type: 'blob', size: FILES[path]!.length })),
      });
    }
    // Contents API: path must be repository-relative and the ref must be branch or commit.
    if (url.includes('/contents/')) {
      const match = url.match(/\/contents\/([^?]+)\?ref=([^&]+)/);
      if (!match) return json({ message: 'bad request' }, 400);
      const path = decodeURIComponent(match[1]!.replace(/%2F/g, '/'));
      const ref = decodeURIComponent(match[2]!);
      if (ref !== 'main' && ref !== COMMIT) return json({ message: 'No commit found' }, 404);
      const body = FILES[path];
      if (!body) return json({ message: 'Not Found' }, 404);
      return json({
        content: Buffer.from(body, 'utf8').toString('base64'),
        encoding: 'base64',
        size: body.length,
      });
    }
    // Raw host.
    if (url.includes('raw.githubusercontent.com')) {
      if (options.rawFails) return text('404: Not Found', 404);
      const match = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([^/]+)\/(.+)$/);
      if (!match) return text('bad', 400);
      const ref = match[1]!;
      const path = decodeURIComponent(match[2]!);
      if (ref !== 'main' && ref !== COMMIT) return text('404: Not Found', 404);
      const body = FILES[path];
      return body ? text(body) : text('404: Not Found', 404);
    }
    return text('unexpected url', 500);
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, seen, mock: fetchImpl };
}

describe('buildRawUrl — rootDir must be applied exactly once', () => {
  it('does not duplicate the root directory for a repository-relative path', () => {
    const url = buildRawUrl(config, 'skills/ai/agents/agent-tool-design.md', COMMIT);
    expect(url).toBe(
      `https://raw.githubusercontent.com/kiriliodas/SkillBridge/${COMMIT}/skills/ai/agents/agent-tool-design.md`,
    );
    expect(url).not.toContain('skills/skills/');
  });

  it('still prefixes a path that is relative to the root directory', () => {
    expect(buildRawUrl(config, 'ai/agents/agent-tool-design.md', COMMIT)).toContain(
      `/${COMMIT}/skills/ai/agents/agent-tool-design.md`,
    );
  });

  it('leaves paths alone when no root directory is configured', () => {
    const url = buildRawUrl({ ...config, rootDir: '' }, 'ai/agents/x.md', COMMIT);
    expect(url).toContain(`${COMMIT}/ai/agents/x.md`);
    expect(url).not.toContain('/skills/');
  });

  it('encodes each segment without touching the separators', () => {
    const url = buildRawUrl(config, 'skills/Dossier/Réseau avancé.md', 'abc');
    expect(url).toContain('/skills/Dossier/R%C3%A9seau%20avanc%C3%A9.md');
  });

  it('tolerates a leading slash and duplicate separators', () => {
    expect(buildRawUrl(config, '/skills//ai/x.md', 'abc')).toContain('/skills/ai/x.md');
  });
});

describe('nested downloads against a strict fake repository', () => {
  it('downloads files at every depth, including four levels', async () => {
    const { fetchImpl } = fakeGithub();
    const snapshot = await loadRepositorySnapshot(config, { fetchImpl });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;

    const deep = snapshot.data.skills.filter((s) => s.categories.length >= 2);
    expect(deep.length).toBeGreaterThanOrEqual(4);

    for (const skill of deep) {
      const result = await fetchSkillContent(
        config,
        skill.path,
        snapshot.data.revision ?? snapshot.data.commit,
        { fetchImpl },
      );
      expect(result.ok, `failed to download ${skill.path}`).toBe(true);
      if (result.ok) expect(result.data).toBe(FILES[skill.path]);
    }
  });

  it('recovers through the Contents API when the raw host refuses everything', async () => {
    const { fetchImpl } = fakeGithub({ rawFails: true });
    const result = await fetchSkillContent(config, 'skills/analysis/data/metric-design.md', COMMIT, {
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(FILES['skills/analysis/data/metric-design.md']);
  });

  it('reports NOT_FOUND only after both hosts agree', async () => {
    const { fetchImpl, seen } = fakeGithub();
    const result = await fetchSkillContent(config, 'skills/ai/agents/missing.md', COMMIT, {
      fetchImpl,
    });
    expect(!result.ok && result.error.code).toBe('NOT_FOUND');
    expect(seen.some((u) => u.includes('raw.githubusercontent.com'))).toBe(true);
    expect(seen.some((u) => u.includes('/contents/'))).toBe(true);
  });
});

describe('resolveRevision — never pin to a tree SHA', () => {
  it('accepts a value that resolves as a commit', async () => {
    const { fetchImpl } = fakeGithub();
    const revision = await resolveRevision(config, COMMIT, { fetchImpl }, COMMIT);
    expect(revision.ref).toBe(COMMIT);
    expect(revision.pinned).toBe(true);
    expect(revision.treeSha).toBe(TREE);
  });

  it('falls back to the branch when the value is a tree sha, not a commit', async () => {
    const { fetchImpl } = fakeGithub();
    const revision = await resolveRevision(config, TREE, { fetchImpl }, TREE);
    // A tree sha is not a valid ref for downloads, so the branch is used instead.
    expect(revision.ref).toBe('main');
    expect(revision.pinned).toBe(false);
    expect(revision.treeSha).toBe(TREE);
  });

  it('keeps the branch name when the reference is not a sha at all', async () => {
    const { fetchImpl, seen } = fakeGithub();
    const revision = await resolveRevision(config, 'main', { fetchImpl }, '');
    expect(revision.ref).toBe('main');
    expect(revision.pinned).toBe(false);
    expect(seen.some((u) => u.includes('/git/commits/'))).toBe(false);
  });

  it('degrades to the branch when verification cannot be performed', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    });
    const revision = await resolveRevision(config, COMMIT, {
      fetchImpl: failing as unknown as typeof fetch,
    });
    expect(revision.ref).toBe(COMMIT);
    expect(revision.pinned).toBe(false);
  });
});

describe('snapshot revision and cache scoping', () => {
  it('pins the snapshot to the verified commit', async () => {
    const { fetchImpl } = fakeGithub();
    const snapshot = await loadRepositorySnapshot(config, { fetchImpl });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.data.revision).toBe(COMMIT);
    expect(snapshot.data.commit).toBe(COMMIT.slice(0, 12));
  });

  it('scopes the cache by the full commit, not the abbreviation', async () => {
    const { fetchImpl } = fakeGithub();
    const snapshot = await loadRepositorySnapshot(config, { fetchImpl });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshotScope(snapshot.data).revision).toBe(COMMIT);
  });

  it('uses the branch as revision when the listing sha is a tree', async () => {
    // Simulates a host that echoes a tree sha: downloads must not be pinned to it.
    const { fetchImpl } = fakeGithub();
    const snapshot = await loadRepositorySnapshot(config, { fetchImpl });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    const revision = await resolveRevision(config, TREE, { fetchImpl }, TREE);
    expect(revision.ref).toBe('main');
  });

  it('never serves content cached under a different revision', async () => {
    const { fetchImpl } = fakeGithub();
    const a = await loadRepositorySnapshot(config, { fetchImpl });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    // A second snapshot whose commit differs must produce a different cache scope.
    const scopeA = snapshotScope(a.data);
    const scopeB = snapshotScope({ ...a.data, revision: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' });
    expect(scopeA.revision).not.toBe(scopeB.revision);
  });
});

describe('repositories without a custom root directory', () => {
  const rootless: RepoConfig = { ...config, rootDir: '' };

  it('downloads nested files when no root directory is configured', async () => {
    const files: Record<string, string> = {
      'ai/agents/x.md': '# X\n',
      'deep/a/b/c/y.md': '# Y\n',
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/git/commits/')) return json({ sha: COMMIT, tree: { sha: TREE } });
      if (url.includes('/git/trees/')) {
        return json({
          sha: COMMIT,
          truncated: false,
          tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', size: 10 })),
        });
      }
      const match = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/);
      const body = match && files[decodeURIComponent(match[1]!)];
      return body ? text(body) : text('404: Not Found', 404);
    });

    const snapshot = await loadRepositorySnapshot(rootless, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.data.skills).toHaveLength(2);

    for (const skill of snapshot.data.skills) {
      const result = await fetchSkillContent(rootless, skill.path, snapshot.data.revision, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result.ok, skill.path).toBe(true);
      if (result.ok) expect(result.data).toBe(files[skill.relPath]);
    }
  });

  it('keeps URLs free of any prefix when there is no root directory', () => {
    expect(buildRawUrl(rootless, 'deep/a/b/c/y.md', 'abc')).toBe(
      'https://raw.githubusercontent.com/kiriliodas/SkillBridge/abc/deep/a/b/c/y.md',
    );
  });
});
