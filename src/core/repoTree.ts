/**
 * Repository tree parsing: turns a github git-tree listing into SkillEntry[]
 * and a CategoryNode tree. Pure functions, no network access, fully tested.
 */
import { SKILL_EXTENSION } from '../shared/config';
import type { CategoryNode, RepoConfig, SkillEntry } from '../shared/types';
import { compilePatterns, isExcluded, normalizePath } from './glob';

export interface TreeFile {
  path: string;
  type: 'blob' | 'tree' | string;
  size?: number;
  sha?: string;
}

export interface ParseOptions {
  config: RepoConfig;
  /** Extra exclude patterns, e.g. the built-in defaults. */
  defaultExcludes?: string[];
  /** Include hidden files / dot-directories (default false). */
  includeHidden?: boolean;
}

export interface ParseResult {
  skills: SkillEntry[];
  tree: CategoryNode;
  warnings: string[];
  ignoredCount: number;
}

const GENERIC_FILE_NAMES = new Set(['skill', 'index', 'readme', 'main']);

export function normalizeRepoConfig(config: RepoConfig): RepoConfig {
  return {
    owner: config.owner.trim(),
    repo: config.repo.trim().replace(/\.git$/i, ''),
    branch: config.branch.trim() || 'main',
    rootDir: normalizePath(config.rootDir.trim()),
    excludes: config.excludes.map((e) => e.trim()).filter(Boolean),
  };
}

export function validateRepoConfig(config: RepoConfig): string[] {
  const errors: string[] = [];
  const c = normalizeRepoConfig(config);
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(c.owner)) {
    errors.push('Repository owner looks invalid (GitHub user or organisation).');
  }
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(c.repo)) {
    errors.push('Repository name looks invalid.');
  }
  if (!c.branch || /\s/.test(c.branch)) {
    errors.push('Branch must be a single name without spaces.');
  }
  if (c.rootDir.startsWith('/') || c.rootDir.includes('..')) {
    errors.push('Root directory must be a repository-relative path.');
  }
  return errors;
}

/** True when the path points at a Markdown file (case-insensitive extension). */
export function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(SKILL_EXTENSION);
}

/**
 * Derive a display name from a file name.
 *  - "kotlin-standards.md"       -> "Kotlin Standards"
 *  - "api_design.md"             -> "Api Design"
 *  - "Réseau & Sécurité.md"      -> "Réseau & Sécurité"
 *  - "SKILL.md" in ".../canvas/" -> "Canvas" (generic file name: use folder)
 */
export function deriveSkillName(filePath: string): string {
  const segments = normalizePath(filePath).split('/');
  const fileName = segments[segments.length - 1] ?? '';
  const base = fileName.replace(/\.md$/i, '');
  const looksGeneric = GENERIC_FILE_NAMES.has(base.toLowerCase().replace(/[\s_-]+/g, ''));
  const parent = segments.length > 1 ? segments[segments.length - 2]! : '';
  const raw = looksGeneric && parent ? parent : base;
  return prettifyName(raw);
}

export function prettifyName(raw: string): string {
  const words = raw
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  if (words.length === 1 && words[0] === '') return raw.trim() || 'Untitled';
  return words
    .map((word) => {
      if (!word) return word;
      // Keep words that are already mixed/upper case (API, iOS, SQL, README).
      if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
      if (/^[A-Z][a-z]+[A-Z]/.test(word)) return word; // iPhone, macOS-style
      return word[0]!.toLocaleUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function makeSkillId(path: string): string {
  return encodeURIComponent(normalizePath(path));
}

export function categoryLabel(categories: string[]): string {
  return categories.join(' / ');
}

/** Deterministic comparison used everywhere (locale-aware, numeric). */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export interface ParseTreeOptions extends ParseOptions {
  /** Name shown on the root node (usually the repository name). */
  rootName?: string;
}

export function parseRepositoryTree(
  files: TreeFile[],
  options: ParseTreeOptions,
): ParseResult {
  const config = normalizeRepoConfig(options.config);
  const rootPrefix = config.rootDir ? `${config.rootDir}/` : '';
  const excludePatterns = compilePatterns([...config.excludes, ...(options.defaultExcludes ?? [])]);
  const warnings: string[] = [];
  const skills: SkillEntry[] = [];
  let ignoredCount = 0;
  const includeHidden = options.includeHidden ?? false;

  for (const file of files) {
    if (file.type !== 'blob') continue;
    const fullPath = normalizePath(file.path);
    if (rootPrefix && !fullPath.startsWith(rootPrefix)) {
      ignoredCount++;
      continue;
    }
    const relPath = rootPrefix ? fullPath.slice(rootPrefix.length) : fullPath;
    if (!relPath) {
      ignoredCount++;
      continue;
    }
    if (!isMarkdownPath(relPath)) {
      ignoredCount++;
      continue;
    }
    if (!includeHidden && relPath.split('/').some((seg) => seg.startsWith('.'))) {
      ignoredCount++;
      continue;
    }
    if (isExcluded(relPath, excludePatterns)) {
      ignoredCount++;
      continue;
    }

    const segments = relPath.split('/');
    const categories = segments.slice(0, -1);
    if (segments.some((s) => s.length === 0)) {
      warnings.push(`Skipped malformed path: ${fullPath}`);
      continue;
    }
    skills.push({
      id: makeSkillId(fullPath),
      name: deriveSkillName(relPath),
      fileName: segments[segments.length - 1]!,
      path: fullPath,
      relPath,
      categories,
      categoryLabel: categoryLabel(categories),
      size: typeof file.size === 'number' ? file.size : 0,
    });
  }

  skills.sort(compareSkills);
  const tree = buildCategoryTree(skills, options.rootName ?? config.repo);

  if (skills.length === 0) {
    warnings.push(
      config.rootDir
        ? `No Markdown skills found under "${config.rootDir}" on branch "${config.branch}".`
        : `No Markdown skills found in the repository on branch "${config.branch}".`,
    );
  }

  return { skills, tree, warnings, ignoredCount };
}

/** Canonical ordering: category hierarchy, then name, then file path. */
export function compareSkills(a: SkillEntry, b: SkillEntry): number {
  const byCategory = compareText(categoryLabel(a.categories), categoryLabel(b.categories));
  if (byCategory !== 0) return byCategory;
  const byName = compareText(a.name, b.name);
  if (byName !== 0) return byName;
  return compareText(a.path, b.path);
}

export function buildCategoryTree(skills: SkillEntry[], rootName = ''): CategoryNode {
  const root: CategoryNode = {
    name: rootName,
    path: [],
    id: '',
    children: [],
    skills: [],
    totalSkills: 0,
  };
  const childMap = new Map<string, CategoryNode>();
  childMap.set('', root);

  const ensureNode = (segments: string[]): CategoryNode => {
    const key = segments.join('/');
    const existing = childMap.get(key);
    if (existing) return existing;
    const parent = ensureNode(segments.slice(0, -1));
    const node: CategoryNode = {
      name: segments[segments.length - 1]!,
      path: segments,
      id: key,
      children: [],
      skills: [],
      totalSkills: 0,
    };
    parent.children.push(node);
    childMap.set(key, node);
    return node;
  };

  for (const skill of skills) {
    ensureNode(skill.categories).skills.push(skill);
  }

  const finalize = (node: CategoryNode): number => {
    node.skills.sort(compareSkills);
    node.children.sort((a, b) => compareText(a.name, b.name));
    node.totalSkills =
      node.skills.length + node.children.reduce((sum, child) => sum + finalize(child), 0);
    return node.totalSkills;
  };
  finalize(root);
  return root;
}

/** All skill ids beneath a node (inclusive). */
export function collectSkillIds(node: CategoryNode): string[] {
  const ids = node.skills.map((s) => s.id);
  for (const child of node.children) ids.push(...collectSkillIds(child));
  return ids;
}

export function findNodeById(root: CategoryNode, id: string): CategoryNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/** Distinct non-empty category labels represented by the given skills. */
export function countCategories(skills: SkillEntry[]): number {
  const set = new Set<string>();
  for (const skill of skills) {
    if (skill.categories.length) set.add(skill.categoryLabel);
    else set.add('(root)');
  }
  return set.size;
}

/** Order skills the same way the compiler does. */
export function sortSkillsForCompilation<T extends { categories: string[]; name: string; path: string }>(
  skills: T[],
): T[] {
  return [...skills].sort((a, b) => {
    const byCategory = compareText(categoryLabel(a.categories), categoryLabel(b.categories));
    if (byCategory !== 0) return byCategory;
    const byName = compareText(a.name, b.name);
    if (byName !== 0) return byName;
    return compareText(a.path, b.path);
  });
}
