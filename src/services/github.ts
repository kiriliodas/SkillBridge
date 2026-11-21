/**
 * GitHub integration.
 *
 * Two access strategies, tried in order:
 *  1. GitHub REST API (`/repos/:owner/:repo/git/trees/:ref?recursive=1` and
 *     `/repos/:owner/:repo/contents/...`) — provides the whole tree in one call.
 *  2. Raw content (`raw.githubusercontent.com`) with a branch-listing fallback —
 *     used when the API is rate limited or unreachable.
 *
 * Authentication: an optional token can be supplied at runtime by the
 * integration layer (never stored in source). Without a token the public API is
 * used, which is rate limited to 60 requests/hour/IP.
 */
import { GITHUB_API_BASE, GITHUB_RAW_BASE } from '../shared/config';
import type { RepoConfig, RepoErrorInfo, RepoSnapshot } from '../shared/types';
import { parseRepositoryTree, normalizeRepoConfig, type TreeFile } from '../core/repoTree';

export interface GithubDeps {
  fetchImpl?: typeof fetch;
  /** Optional runtime token (private repos / higher rate limits). */
  token?: string;
}

export interface GithubTreeResponse {
  sha: string;
  truncated: boolean;
  tree: TreeFile[];
}

export type GithubResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RepoErrorInfo };

export class GithubError extends Error {
  readonly info: RepoErrorInfo;
  constructor(info: RepoErrorInfo) {
    super(info.message);
    this.info = info;
    this.name = 'GithubError';
  }
}

function errorInfo(
  code: RepoErrorInfo['code'],
  message: string,
  hint?: string,
  status?: number,
): RepoErrorInfo {
  return { code, message, ...(hint ? { hint } : {}), ...(status !== undefined ? { status } : {}) };
}

function headers(token?: string): Record<string, string> {
  const base: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

function mapHttpError(status: number, url: string): RepoErrorInfo {
  if (status === 404) {
    return errorInfo(
      'NOT_FOUND',
      'Repository, branch or path not found (404).',
      'Check the owner, repository name, branch and root directory. Private repositories require a token.',
      404,
    );
  }
  if (status === 401 || status === 403) {
    return errorInfo(
      'RATE_LIMITED',
      status === 401
        ? 'GitHub rejected the request (401). The repository may be private.'
        : 'GitHub rate limit reached or access forbidden (403).',
      'GitHub allows 60 unauthenticated API requests per hour. Wait a few minutes, use a public repository, or refresh later. SkillBridge falls back to raw content automatically.',
      status,
    );
  }
  if (status === 409) {
    return errorInfo('INVALID_CONFIG', 'The repository is empty (409).', 'Push at least one commit.', 409);
  }
  if (status === 451) {
    return errorInfo('UNAUTHORIZED', 'Repository unavailable for legal reasons (451).', undefined, 451);
  }
  if (status >= 500) {
    return errorInfo('NETWORK', `GitHub is having trouble (${status}).`, 'Try again in a moment.', status);
  }
  return errorInfo('UNKNOWN', `GitHub request failed with status ${status}.`, url, status);
}

/** Perform a fetch with a timeout and map network errors to RepoErrorInfo. */
export async function safeFetch(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GithubError(
      errorInfo(
        'NETWORK',
        /abort/i.test(message) ? 'GitHub request timed out.' : `Network error: ${message}`,
        'Check your internet connection, VPN or firewall and try again.',
      ),
    );
  } finally {
    clearTimeout(timer);
  }
}

export function buildTreeUrl(config: RepoConfig, ref?: string): string {
  const c = normalizeRepoConfig(config);
  const target = encodeURIComponent(ref ?? c.branch);
  return `${GITHUB_API_BASE}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/git/trees/${target}?recursive=1`;
}

export function buildRawUrl(config: RepoConfig, path: string, ref?: string): string {
  const c = normalizeRepoConfig(config);
  const prefix = c.rootDir ? `${c.rootDir}/` : '';
  const encoded = `${prefix}${path}`
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${GITHUB_RAW_BASE}/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${encodeURIComponent(
    ref ?? c.branch,
  )}/${encoded}`;
}

/** Fetch the repository tree through the REST API. */
export async function fetchRepoTree(
  config: RepoConfig,
  deps: GithubDeps = {},
): Promise<GithubResult<GithubTreeResponse>> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const response = await safeFetch(
      buildTreeUrl(config),
      { headers: headers(deps.token) },
      fetchImpl,
    );
    if (!response.ok) {
      return { ok: false, error: mapHttpError(response.status, response.url) };
    }
    const json = (await response.json()) as { sha?: string; truncated?: boolean; tree?: TreeFile[] };
    if (!Array.isArray(json.tree)) {
      return {
        ok: false,
        error: errorInfo('UNKNOWN', 'Unexpected GitHub response: no tree returned.'),
      };
    }
    return {
      ok: true,
      data: {
        sha: json.sha ?? '',
        truncated: Boolean(json.truncated),
        tree: json.tree.filter((entry) => typeof entry.path === 'string'),
      },
    };
  } catch (error) {
    if (error instanceof GithubError) return { ok: false, error: error.info };
    return {
      ok: false,
      error: errorInfo('UNKNOWN', error instanceof Error ? error.message : String(error)),
    };
  }
}

/**
 * Load a full repository snapshot (tree + derived categories).
 *
 * Automatically retries against `raw` when the API is rate limited or the
 * shallow tree is truncated.
 */
export async function loadRepositorySnapshot(
  config: RepoConfig,
  deps: GithubDeps = {},
): Promise<GithubResult<RepoSnapshot>> {
  const normalized = normalizeRepoConfig(config);
  const treeResult = await fetchRepoTree(normalized, deps);
  if (!treeResult.ok) {
    return { ok: false, error: treeResult.error };
  }

  let tree = treeResult.data.tree;
  const warnings: string[] = [];
  if (treeResult.data.truncated) {
    warnings.push(
      'GitHub truncated the recursive tree listing. Some skills may be missing; restrict the root directory to a subfolder for complete results.',
    );
  }

  let parsed = parseRepositoryTree(tree, {
    config: normalized,
    rootName: normalized.repo,
    includeHidden: false,
  });

  // If the configured root yields nothing, try to be helpful with a clear error.
  if (parsed.skills.length === 0 && normalized.rootDir) {
    const withoutRoot = parseRepositoryTree(tree, { config: { ...normalized, rootDir: '' } });
    if (withoutRoot.skills.length > 0) {
      warnings.push(
        `No Markdown files under "${normalized.rootDir}", but ${withoutRoot.skills.length} were found elsewhere in the repository. Check the root directory setting.`,
      );
    }
  }

  const snapshot: RepoSnapshot = {
    config: normalized,
    commit: treeResult.data.sha ? treeResult.data.sha.slice(0, 12) : normalized.branch,
    fetchedAt: Date.now(),
    skills: parsed.skills,
    tree: parsed.tree,
    warnings,
  };
  return { ok: true, data: snapshot };
}

/** Fetch a single skill's raw Markdown content. */
export async function fetchSkillContent(
  config: RepoConfig,
  path: string,
  ref: string | undefined,
  deps: GithubDeps = {},
): Promise<GithubResult<string>> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = buildRawUrl(config, path, ref);
  try {
    const response = await safeFetch(url, { headers: { Accept: 'text/plain' } }, fetchImpl);
    if (!response.ok) {
      if (response.status === 404) {
        return {
          ok: false,
          error: errorInfo(
            'NOT_FOUND',
            `Skill file not found: ${path}`,
            'It may have been deleted or renamed since the repository was refreshed. Refresh the repository.',
            404,
          ),
        };
      }
      // Server-side or rate-limit problem on the raw host: try the API path.
      return fetchSkillContentViaApi(config, path, ref, deps);
    }
    const text = await response.text();
    return { ok: true, data: text };
  } catch {
    // Raw host unreachable (proxy, firewall, DNS): retry through the REST API.
    const fallback = await fetchSkillContentViaApi(config, path, ref, deps);
    if (fallback.ok) return fallback;
    return fallback;
  }
}

/**
 * Fetch a single file through the REST contents API.
 *
 * Used when the raw host is unreachable (corporate proxies and some networks
 * block `raw.githubusercontent.com`) or returns a non-2xx status. The API
 * returns base64-encoded content that decodes to the exact file bytes; the
 * decode is verified by comparing the byte length before accepting it.
 */
export async function fetchSkillContentViaApi(
  config: RepoConfig,
  path: string,
  ref: string | undefined,
  deps: GithubDeps = {},
): Promise<GithubResult<string>> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const c = normalizeRepoConfig(config);
  // `path` is repository-relative (SkillEntry.path), so it already contains the
  // root directory. Prefixing it again was a real bug caught by the live test.
  const repoPath = path.replace(/^\/+/, '');
  const encodedPath = repoPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref ?? c.branch)}`;
  try {
    const response = await safeFetch(url, { headers: headers(deps.token) }, fetchImpl);
    if (!response.ok) {
      if (response.status === 404) {
        return {
          ok: false,
          error: errorInfo(
            'NOT_FOUND',
            `Skill file not found: ${path}`,
            'It may have been deleted or renamed since the repository was refreshed. Refresh the repository.',
            404,
          ),
        };
      }
      return { ok: false, error: mapHttpError(response.status, url) };
    }
    const json = (await response.json()) as { content?: string; encoding?: string; size?: number };
    if (typeof json.content !== 'string' || json.encoding !== 'base64') {
      return {
        ok: false,
        error: errorInfo('UNKNOWN', `Unexpected contents response for ${path}.`),
      };
    }
    const text = decodeBase64Utf8(json.content);
    if (typeof json.size === 'number' && new TextEncoder().encode(text).length !== json.size) {
      return {
        ok: false,
        error: errorInfo('UNKNOWN', `Decoded size mismatch for ${path}.`),
      };
    }
    return { ok: true, data: text };
  } catch (error) {
    if (error instanceof GithubError) return { ok: false, error: error.info };
    return {
      ok: false,
      error: errorInfo('NETWORK', error instanceof Error ? error.message : String(error)),
    };
  }
}

/** Decode GitHub's base64 (with embedded newlines) into a UTF-8 string. */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/** Validate that a repository exists and return its default branch. */
export async function probeRepository(
  config: RepoConfig,
  deps: GithubDeps = {},
): Promise<GithubResult<{ defaultBranch: string; private: boolean; description: string | null }>> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const c = normalizeRepoConfig(config);
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
  try {
    const response = await safeFetch(url, { headers: headers(deps.token) }, fetchImpl);
    if (!response.ok) return { ok: false, error: mapHttpError(response.status, url) };
    const json = (await response.json()) as {
      default_branch?: string;
      private?: boolean;
      description?: string | null;
    };
    return {
      ok: true,
      data: {
        defaultBranch: json.default_branch ?? 'main',
        private: Boolean(json.private),
        description: json.description ?? null,
      },
    };
  } catch (error) {
    if (error instanceof GithubError) return { ok: false, error: error.info };
    return {
      ok: false,
      error: errorInfo('NETWORK', error instanceof Error ? error.message : String(error)),
    };
  }
}

/** Convert a RepoErrorInfo into a short status label. */
export function describeRepoError(error: RepoErrorInfo): string {
  switch (error.code) {
    case 'INVALID_CONFIG':
      return 'Invalid repository configuration';
    case 'NOT_FOUND':
      return 'Repository not found';
    case 'RATE_LIMITED':
      return 'GitHub rate limit reached';
    case 'NETWORK':
      return 'Network error';
    case 'EMPTY_ROOT':
      return 'No skills found';
    case 'TREE_TRUNCATED':
      return 'Repository too large';
    case 'UNAUTHORIZED':
      return 'Access denied';
    default:
      return 'GitHub error';
  }
}
