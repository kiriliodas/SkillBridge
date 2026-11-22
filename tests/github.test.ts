import { describe, expect, it, vi } from 'vitest';
import {
  buildRawUrl,
  buildTreeUrl,
  decodeBase64Utf8,
  describeRepoError,
  fetchRepoTree,
  fetchSkillContent,
  fetchSkillContentViaApi,
  loadRepositorySnapshot,
  probeRepository,
} from '../src/services/github';
import type { RepoConfig } from '../src/shared/types';

const config: RepoConfig = {
  owner: 'LM-Arena',
  repo: 'LM-Arena-Skills',
  branch: 'main',
  rootDir: 'skills',
  excludes: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: 'https://api.github.com/test',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: 'https://raw.githubusercontent.com/test',
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

const tree = {
  sha: 'abcdef1234567890',
  truncated: false,
  tree: [
    { path: 'skills', type: 'tree' },
    { path: 'skills/Android', type: 'tree' },
    { path: 'skills/Android/kotlin.md', type: 'blob', size: 100 },
    { path: 'skills/Web/react.md', type: 'blob', size: 200 },
    { path: 'README.md', type: 'blob', size: 50 },
  ],
};

describe('URL building', () => {
  it('builds an encoded tree URL', () => {
    expect(buildTreeUrl(config)).toBe(
      'https://api.github.com/repos/LM-Arena/LM-Arena-Skills/git/trees/main?recursive=1',
    );
    expect(buildTreeUrl({ ...config, branch: 'feat/x y' })).toContain('feat%2Fx%20y');
  });

  it('builds a raw URL with the root prefix and per-segment encoding', () => {
    expect(buildRawUrl(config, 'Android/Kotlin/réseau avancé.md', 'abc123')).toBe(
      'https://raw.githubusercontent.com/LM-Arena/LM-Arena-Skills/abc123/skills/Android/Kotlin/r%C3%A9seau%20avanc%C3%A9.md',
    );
  });

  it('omits the root prefix when there is none', () => {
    expect(buildRawUrl({ ...config, rootDir: '' }, 'a.md')).toBe(
      'https://raw.githubusercontent.com/LM-Arena/LM-Arena-Skills/main/a.md',
    );
  });
});

describe('fetchRepoTree', () => {
  it('returns the tree and commit', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(tree));
    const result = await fetchRepoTree(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sha).toBe('abcdef1234567890');
      expect(result.data.tree).toHaveLength(5);
    }
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toContain('/git/trees/main');
    expect((call[1].headers as Record<string, string>).Accept).toContain('github');
  });

  it('maps 404 to a helpful NOT_FOUND error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'Not Found' }, 404));
    const result = await fetchRepoTree(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.hint).toContain('Private repositories require a token');
    }
  });

  it('maps 403 to a rate-limit error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'rate limit' }, 403));
    const result = await fetchRepoTree(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED');
      expect(result.error.hint).toMatch(/60 unauthenticated/);
    }
  });

  it('maps 401, 409, 451 and 5xx', async () => {
    for (const [status, code] of [
      [401, 'RATE_LIMITED'],
      [409, 'INVALID_CONFIG'],
      [451, 'UNAUTHORIZED'],
      [503, 'NETWORK'],
      [418, 'UNKNOWN'],
    ] as const) {
      const fetchImpl = vi.fn(async () => jsonResponse({}, status));
      const result = await fetchRepoTree(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(!result.ok && result.error.code).toBe(code);
    }
  });

  it('handles network failures', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    const result = await fetchRepoTree(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(!result.ok && result.error.code).toBe('NETWORK');
  });

  it('handles malformed responses', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'ok' }));
    const result = await fetchRepoTree(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(!result.ok && result.error.message).toMatch(/no tree/i);
  });

  it('sends the token when provided (never in the URL)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(tree));
    await fetchRepoTree(config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      token: 'ghp_secret',
    });
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((call[1].headers as Record<string, string>).Authorization).toBe('Bearer ghp_secret');
    expect(call[0]).not.toContain('ghp_secret');
  });
});

describe('loadRepositorySnapshot', () => {
  it('discovers only markdown files under the root', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(tree));
    const result = await loadRepositorySnapshot(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.skills.map((s) => s.fileName)).toEqual(['kotlin.md', 'react.md']);
      expect(result.data.commit).toBe('abcdef123456');
      expect(result.data.tree.children.map((c) => c.name)).toEqual(['Android', 'Web']);
    }
  });

  it('warns when the tree is truncated', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ...tree, truncated: true }));
    const result = await loadRepositorySnapshot(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok && result.data.warnings[0]).toMatch(/truncated/);
  });

  it('explains when the root directory has no skills but others exist', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        sha: 'abc',
        truncated: false,
        tree: [{ path: 'other/x.md', type: 'blob' }],
      }),
    );
    const result = await loadRepositorySnapshot(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok && result.data.warnings.join(' ')).toMatch(/No Markdown files under "skills"/);
  });
});

describe('fetchSkillContent', () => {
  it('returns the raw content verbatim', async () => {
    const body = '# Réseau\n\ncontent with trailing newline\n';
    const fetchImpl = vi.fn(async () => textResponse(body));
    const result = await fetchSkillContent(config, 'r/r.md', 'sha', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok && result.data).toBe(body);
  });

  it('reports missing files', async () => {
    const fetchImpl = vi.fn(async () => textResponse('404: Not Found', 404));
    const result = await fetchSkillContent(config, 'gone.md', undefined, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(!result.ok && result.error.code).toBe('NOT_FOUND');
    expect(!result.ok && result.error.hint).toMatch(/Refresh/);
  });

  it('reports server errors', async () => {
    const fetchImpl = vi.fn(async () => textResponse('', 500));
    const result = await fetchSkillContent(config, 'a.md', undefined, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(!result.ok && result.error.code).toBe('NETWORK');
  });
});

describe('fetchSkillContentViaApi (raw-host fallback)', () => {
  const content = '# Réseau 🚀\n\nline two\n';
  const base64 = Buffer.from(content, 'utf8').toString('base64');

  it('decodes base64 content exactly, including Unicode', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ content: base64, encoding: 'base64', size: Buffer.byteLength(content) }),
    );
    const result = await fetchSkillContentViaApi(config, 'Android/Kotlin/réseau.md', 'sha', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok && result.data).toBe(content);
    // The path is repository-relative and must NOT be prefixed with rootDir again.
    const url = (fetchImpl.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain('/contents/Android/Kotlin/r%C3%A9seau.md');
    expect(url).not.toContain('skills/Android');
    expect(url).toContain('ref=sha');
  });

  it('rejects a size mismatch instead of returning corrupt text', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ content: base64, encoding: 'base64', size: 999 }),
    );
    const result = await fetchSkillContentViaApi(config, 'a.md', undefined, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(!result.ok && result.error.message).toMatch(/size mismatch/i);
  });

  it('rejects an unexpected encoding', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ content: 'abc', encoding: 'utf-8' }));
    const result = await fetchSkillContentViaApi(config, 'a.md', undefined, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
  });

  it('maps 404 to NOT_FOUND', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'Not Found' }, 404));
    const result = await fetchSkillContentViaApi(config, 'gone.md', undefined, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(!result.ok && result.error.code).toBe('NOT_FOUND');
  });

  it('decodeBase64Utf8 strips newlines and preserves multi-byte characters', () => {
    const wrapped = Buffer.from('日本語 — ok', 'utf8').toString('base64').replace(/(.{4})/g, '$1\n');
    expect(decodeBase64Utf8(wrapped)).toBe('日本語 — ok');
  });

  it('fetchSkillContent falls back to the API when the raw host is unreachable', async () => {
    const encoded = Buffer.from(content, 'utf8').toString('base64');
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('raw.githubusercontent.com')) throw new Error('getaddrinfo ENOTFOUND');
      return jsonResponse({ content: encoded, encoding: 'base64', size: Buffer.byteLength(content) });
    });
    const result = await fetchSkillContent(config, 'A/b.md', 'sha', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok && result.data).toBe(content);
    expect((fetchImpl.mock.calls as unknown as [string][]).length).toBe(2);
  });

  it('fetchSkillContent falls back to the API on a raw 5xx response', async () => {
    const encoded = Buffer.from(content, 'utf8').toString('base64');
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('raw.githubusercontent.com')) return textResponse('', 502);
      return jsonResponse({ content: encoded, encoding: 'base64', size: Buffer.byteLength(content) });
    });
    const result = await fetchSkillContent(config, 'A/b.md', 'sha', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok && result.data).toBe(content);
  });

  it('tries the Contents API before declaring a file missing', async () => {
    // A 404 from the raw host is not proof of absence: it is also what a malformed ref
    // or a stale path produces. The API is the authority, so it must be consulted.
    const fetchImpl = vi.fn(async (url: string) =>
      String(url).includes('raw.githubusercontent.com')
        ? textResponse('404: Not Found', 404)
        : textResponse('404: Not Found', 404),
    );
    const result = await fetchSkillContent(config, 'A/b.md', 'sha', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(!result.ok && result.error.code).toBe('NOT_FOUND');
    const urls = (fetchImpl.mock.calls as unknown as [string][]).map((c) => c[0]);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('raw.githubusercontent.com');
    expect(urls[1]).toContain('/contents/A/b.md');
  });

  it('recovers a file that the raw host 404s but the API can serve', async () => {
    const body = '# nested\n\ncontent\n';
    const fetchImpl = vi.fn(async (url: string) =>
      String(url).includes('raw.githubusercontent.com')
        ? textResponse('404: Not Found', 404)
        : jsonResponse({
            content: Buffer.from(body, 'utf8').toString('base64'),
            encoding: 'base64',
            size: body.length,
          }),
    );
    const result = await fetchSkillContent(config, 'A/B/C/deep.md', 'sha', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok && result.data).toBe(body);
  });
});

describe('probeRepository', () => {
  it('returns the default branch', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ default_branch: 'trunk', private: false, description: 'Skills' }),
    );
    const result = await probeRepository(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok && result.data.defaultBranch).toBe('trunk');
  });
});

describe('describeRepoError', () => {
  it('produces short labels', () => {
    expect(describeRepoError({ code: 'NOT_FOUND', message: 'x' })).toBe('Repository not found');
    expect(describeRepoError({ code: 'RATE_LIMITED', message: 'x' })).toBe('GitHub rate limit reached');
    expect(describeRepoError({ code: 'NETWORK', message: 'x' })).toBe('Network error');
    expect(describeRepoError({ code: 'UNKNOWN', message: 'x' })).toBe('GitHub error');
  });
});
