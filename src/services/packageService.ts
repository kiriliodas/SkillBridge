/**
 * High-level package building: resolve the selected skills' contents (cache
 * first, network second), verify integrity against the tree snapshot, compile
 * the package and generate the prompt.
 */
import { compileSkillSources } from '../core/compiler';
import { sha256, utf8ByteLength } from '../core/hash';
import { generateInstallPrompt } from '../core/prompt';
import type {
  RepoConfig,
  RepoSnapshot,
  SelectionState,
  SkillPackage,
  SkillSource,
} from '../shared/types';
import { resolveSelectedSkills } from '../core/selection';
import { fetchSkillContent, type GithubDeps } from './github';
import type { RepoCache } from './cache';

export interface PackageServiceDeps {
  cache: RepoCache;
  github?: GithubDeps;
  /** Called as each skill resolves so the UI can show progress. */
  onProgress?: (done: number, total: number, path: string) => void;
  /** Maximum total package bytes allowed (soft guard). */
  maxPackageBytes?: number;
}

export interface BuiltPackage {
  pkg: SkillPackage;
  prompt: string;
  /** True when at least one skill had to be downloaded. */
  downloaded: number;
  /** True when at least one skill came from cache. */
  cached: number;
}

export class PackageBuildError extends Error {
  readonly code: string;
  readonly failedPaths: string[];
  constructor(code: string, message: string, failedPaths: string[] = []) {
    super(message);
    this.code = code;
    this.failedPaths = failedPaths;
    this.name = 'PackageBuildError';
  }
}

export interface ResolveContentOptions {
  snapshot: RepoSnapshot;
  skills: RepoSnapshot['skills'];
  deps: PackageServiceDeps;
  /** Force network fetch, ignoring a cached copy. */
  bypassCache?: boolean;
}

/** Resolve content for the given skills, preserving order. */
export async function resolveSkillSources(options: ResolveContentOptions): Promise<{
  sources: SkillSource[];
  expectedHashes: Record<string, string>;
  downloaded: number;
  cached: number;
  failed: { path: string; message: string }[];
}> {
  const { snapshot, skills, deps } = options;
  const sources: SkillSource[] = [];
  const expectedHashes: Record<string, string> = {};
  const failed: { path: string; message: string }[] = [];
  let downloaded = 0;
  let cached = 0;
  const config: RepoConfig = snapshot.config;
  const total = skills.length;
  let done = 0;

  for (const skill of skills) {
    const cachedHit = options.bypassCache ? null : await deps.cache.readSkillAny(skill.path);
    if (cachedHit) {
      cached++;
      sources.push({
        id: skill.id,
        name: skill.name,
        path: skill.path,
        categories: skill.categories,
        content: cachedHit.content,
      });
      expectedHashes[skill.id] = cachedHit.hash;
      done++;
      deps.onProgress?.(done, total, skill.path);
      continue;
    }

    const result = await fetchSkillContent(config, skill.path, snapshot.commit, deps.github);
    if (!result.ok) {
      failed.push({ path: skill.path, message: result.error.message });
      done++;
      deps.onProgress?.(done, total, skill.path);
      continue;
    }
    const content = result.data;
    const hash = sha256(content);
    downloaded++;
    await deps.cache.writeSkill({
      path: skill.path,
      content,
      hash,
      bytes: utf8ByteLength(content),
    });
    sources.push({
      id: skill.id,
      name: skill.name,
      path: skill.path,
      categories: skill.categories,
      content,
    });
    expectedHashes[skill.id] = hash;
    done++;
    deps.onProgress?.(done, total, skill.path);
  }

  return { sources, expectedHashes, downloaded, cached, failed };
}

export async function buildPackage(
  snapshot: RepoSnapshot,
  selection: SelectionState,
  deps: PackageServiceDeps,
): Promise<BuiltPackage> {
  const selected = resolveSelectedSkills(snapshot, selection);
  if (selected.length === 0) {
    throw new PackageBuildError('EMPTY_SELECTION', 'Select at least one skill first.');
  }

  const resolved = await resolveSkillSources({ snapshot, skills: selected, deps });

  if (resolved.failed.length > 0) {
    throw new PackageBuildError(
      'CONTENT_UNAVAILABLE',
      `Could not download ${resolved.failed.length} skill file${
        resolved.failed.length === 1 ? '' : 's'
      }: ${resolved.failed.map((f) => f.path).join(', ')}`,
      resolved.failed.map((f) => f.path),
    );
  }

  const { pkg } = compileSkillSources(resolved.sources, {
    owner: snapshot.config.owner,
    repo: snapshot.config.repo,
    branch: snapshot.config.branch,
    rootDir: snapshot.config.rootDir,
  }, resolved.expectedHashes);

  if (deps.maxPackageBytes && pkg.totals.bytes > deps.maxPackageBytes) {
    throw new PackageBuildError(
      'PACKAGE_TOO_LARGE',
      `The compiled package is ${(pkg.totals.bytes / 1024 / 1024).toFixed(1)} MB, above the configured limit.`,
    );
  }

  const prompt = generateInstallPrompt(pkg);
  return { pkg, prompt, downloaded: resolved.downloaded, cached: resolved.cached };
}

/**
 * Verify that the content of every skill in the selected set is already
 * available offline (used to decide whether preview needs the network).
 */
export async function prefetchSkillContents(
  snapshot: RepoSnapshot,
  ids: string[],
  deps: PackageServiceDeps,
): Promise<{ ok: number; failed: string[] }> {
  const set = new Set(ids);
  const skills = snapshot.skills.filter((skill) => set.has(skill.id));
  const resolved = await resolveSkillSources({ snapshot, skills, deps });
  return { ok: resolved.sources.length, failed: resolved.failed.map((f) => f.path) };
}
