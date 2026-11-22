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

/** Normalise a repository path: no leading/trailing slashes, no empty segments. */
function cleanPath(path: string): string {
  return path
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');
}

/**
 * Build the raw.githubusercontent.com URL for a skill file.
 *
 * `path` may be either repository-relative (as carried by `SkillEntry.path`, which already
 * includes the configured root directory) or relative to the root directory. Both are
 * accepted so that `rootDir` is applied exactly once: passing `skills/ai/x.md` with
 * `rootDir: "skills"` must NOT produce `skills/skills/ai/x.md`, which is a 404 on every
 * file and used to make the whole compilation fail on nested folders.
 */
export function buildRawUrl(config: RepoConfig, path: string, ref?: string): string {
  const c = normalizeRepoConfig(config);
  const rel = cleanPath(path);
  const prefixed = c.rootDir && rel !== c.rootDir && !rel.startsWith(`${c.rootDir}/`);
  const encoded = (prefixed ? `${c.rootDir}/${rel}` : rel)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${GITHUB_RAW_BASE}/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${encodeURIComponent(
    ref ?? c.branch,
  )}/${encoded}`;
}

export interface RepoRevision {
  /** Value to pass as `ref` to the raw host and to the Contents API. */
  ref: string;
  /** SHA of the tree the listing came from (may equal `ref` when GitHub returns it). */
  treeSha: string;
  /** True when `ref` is a real commit SHA rather than a branch name. */
  pinned: boolean;
}

/**
 * Resolve the revision used to download file contents.
 *
 * `GET /git/trees/{ref}` is ambiguous about what it returns in `sha`: for a branch name
 * GitHub resolves the ref and echoes back the *commit* SHA, while requesting a tree by its
 * own SHA echoes the tree SHA. Only a commit SHA is guaranteed to be a valid `ref` for
 * both raw.githubusercontent.com and the Contents API, so the commit is verified before
 * it is used. When verification is impossible (rate limit, offline), the branch name is
 * used: it still resolves on every host, it is simply not pinned.
 *
 * Never fall back to a *tree* SHA as a download ref — that is precisely the mistake that
 * turns a truncated or synthetic listing into 404s on every file.
 */
export async function resolveRevision(
  config: RepoConfig,
  ref: string | undefined,
  deps: GithubDeps = {},
  treeSha = '',
): Promise<RepoRevision> {
  const c = normalizeRepoConfig(config);
  const target = ref ?? c.branch;
  const looksLikeSha = /^[0-9a-f]{7,40}$/i.test(target);
  if (!looksLikeSha) return { ref: target, treeSha: treeSha || target, pinned: false };
  try {
    const response = await safeFetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/git/commits/${encodeURIComponent(target)}`,
      { headers: headers(deps.token) },
      deps.fetchImpl ?? fetch,
    );
    if (!response.ok) {
      // A 404 is proof that the value is not a commit (a tree sha, for instance): use the
      // branch, which always resolves. Any other status (rate limit, 5xx) means we cannot
      // tell, so the value is kept — it is most likely a commit and the branch is the net.
      if (response.status === 404) return { ref: c.branch, treeSha: treeSha || '', pinned: false };
      return { ref: target, treeSha: treeSha || target, pinned: false };
    }
    const json = (await response.json()) as { sha?: string; tree?: { sha?: string } };
    if (!json.sha || json.sha.toLowerCase() !== target.toLowerCase()) {
      // Not a commit: use the branch, which always resolves.
      return { ref: c.branch, treeSha: json.tree?.sha ?? treeSha ?? '', pinned: false };
    }
    return { ref: json.sha, treeSha: json.tree?.sha ?? treeSha ?? json.sha, pinned: true };
  } catch {
    return { ref: target, treeSha: treeSha || target, pinned: false };
  }
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

  // The listing's `sha` may be a commit or a tree depending on how the ref was resolved.
  // Verify it before letting it become both the cache revision and the download ref.
  const revision = await resolveRevision(
    normalized,
    treeResult.data.sha || normalized.branch,
    deps,
    treeResult.data.sha,
  );

  const snapshot: RepoSnapshot = {
    config: normalized,
    commit: revision.ref ? revision.ref.slice(0, 12) : normalized.branch,
    fetchedAt: Date.now(),
    skills: parsed.skills,
    tree: parsed.tree,
    warnings,
    revision: revision.pinned ? revision.ref : undefined,
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
    if (response.ok) {
      const text = await response.text();
      return { ok: true, data: text };
    }
    // Any failure on the raw host triggers the API fallback, including 404.
    //
    // A 404 here does NOT prove the file is missing: the raw host answers 404 for a
    // malformed reference, for a CDN hiccup and for a path built from a stale root
    // directory. Returning NOT_FOUND on the first 404 is what turned a path bug into a
    // hard compilation failure with no second chance. The Contents API resolves the same
    // file against the commit, so it is the authoritative answer.
    if (response.status !== 404) {
      const fallback = await fetchSkillContentViaApi(config, path, ref, deps);
      return fallback;
    }
    const fallback = await fetchSkillContentViaApi(config, path, ref, deps);
    if (fallback.ok) return fallback;
    // Both hosts agree: report the raw host's 404 message, which names the path.
    if (fallback.error.code === 'NOT_FOUND') {
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
    return fallback;
  } catch {
    // Raw host unreachable (proxy, firewall, DNS): retry through the REST API.
    return fetchSkillContentViaApi(config, path, ref, deps);
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
