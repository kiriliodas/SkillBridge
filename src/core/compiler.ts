/**
 * Skill compilation engine.
 *
 * Contract: the compiler is a pure concatenation operation. Every character of
 * every selected Markdown file is preserved verbatim inside its own content
 * block. The only additions are the package header, the manifest and the
 * per-skill separators, all of which live *outside* the content delimiters.
 *
 * Boundaries are collision-proof: each skill gets a unique, per-package
 * delimiter token that is derived from a hash of the content and then
 * verified not to occur anywhere in any selected file. The token is encoded in
 * a comment so Markdown renders it invisibly:
 *
 *   <!-- SKILLBRIDGE:BEGIN:SB-20261121-4F2A9C1B:0001:a1b2c3d4 -->
 *   ...original content, byte-for-byte...
 *   <!-- SKILLBRIDGE:END:SB-20261121-4F2A9C1B:0001:a1b2c3d4 -->
 */
import type {
  CompileOptions,
  ManifestEntry,
  SkillPackage,
  SkillSource,
} from '../shared/types';
import { createPackageIdentity } from './identity';
import { sha256, sha256Bytes, utf8Bytes, utf8ByteLength } from './hash';
import { categoryLabel, sortSkillsForCompilation } from './repoTree';

export const BOUNDARY_PREFIX = 'SKILLBRIDGE';

export interface CompileInput {
  skills: SkillSource[];
  options: CompileOptions;
  /** Optional map of expected content hashes from the discovery phase. */
  expectedHashes?: Record<string, string>;
}

export interface CompileVerification {
  /** Ids of skills whose content hash did not match the expected hash. */
  changed: string[];
  /** Ids of skills that could not be verified (no expected hash available). */
  unverified: string[];
  ok: boolean;
}

export interface CompiledPackageResult {
  pkg: SkillPackage;
  verification: CompileVerification;
}

export class CompileError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'CompileError';
  }
}

/** Deterministic, locale-independent ISO timestamp with second precision. */
export function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function resolveCompileDate(now?: Date | string): Date {
  if (now instanceof Date) return Number.isNaN(now.getTime()) ? new Date(0) : now;
  if (typeof now === 'string' && now) {
    const parsed = new Date(now);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
  return new Date();
}

// ---------------------------------------------------------------------------
// Boundary tokens
// ---------------------------------------------------------------------------

/**
 * Choose delimiter tokens that cannot collide with any content.
 *
 * The base token is a hash of the package id + every content hash, so it is
 * both deterministic and unique per package. If (in the astronomically
 * unlikely event) the token appears in the content, a counter is appended
 * until no source contains the token in any of its forms.
 */
export function createBoundaryToken(packageId: string, contents: string[]): string {
  const seed = `${packageId}:${contents.map((c) => sha256(c)).join('')}`;
  let salt = 0;
  for (;;) {
    const token = sha256(`${seed}:${salt}`).slice(0, 16).toUpperCase();
    const probe = `${BOUNDARY_PREFIX}:BEGIN:${token}`;
    const collides = contents.some((content) => content.includes(probe) || content.includes(token));
    if (!collides) return token;
    salt += 1;
  }
}

function padIndex(index: number): string {
  return String(index).padStart(4, '0');
}

export function beginMarker(packageId: string, index: number, token: string, skillId: string): string {
  return `<!-- ${BOUNDARY_PREFIX}:BEGIN:${packageId}:${padIndex(index)}:${token}:${skillId} -->`;
}

export function endMarker(packageId: string, index: number, token: string, skillId: string): string {
  return `<!-- ${BOUNDARY_PREFIX}:END:${packageId}:${padIndex(index)}:${token}:${skillId} -->`;
}

/** Per-skill separator used for readability in rendered Markdown. */
export const SKILL_SEPARATOR = '---';

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

export function compileSkills(input: CompileInput): CompiledPackageResult {
  return compileSkillSources(input.skills, input.options, input.expectedHashes);
}

/** Compile skill sources into a single SkillPackage (content is never modified). */
export function compileSkillSources(
  sources: SkillSource[],
  options: CompileOptions,
  expectedHashes: Record<string, string> = {},
): CompiledPackageResult {
  if (sources.length === 0) {
    throw new CompileError('EMPTY_SELECTION', 'Select at least one skill before compiling a package.');
  }
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.id)) {
      throw new CompileError('DUPLICATE_SKILL', `Duplicate skill in selection: ${source.path}`);
    }
    seen.add(source.id);
    if (typeof source.content !== 'string') {
      throw new CompileError('INVALID_CONTENT', `Skill content is missing: ${source.path}`);
    }
  }

  const ordered = sortSkillsForCompilation(
    sources.map((s) => ({
      ...s,
      categories: [...s.categories],
    })),
  );

  const date = resolveCompileDate(options.now);
  const identity = createPackageIdentity(
    ordered.map((s) => ({ path: s.path, content: s.content })),
    date,
  );
  const packageId = options.packageId ?? identity.packageId;
  const compiledAt = formatTimestamp(date);
  const token = createBoundaryToken(packageId, ordered.map((s) => s.content));
  const repository = `${options.owner}/${options.repo}`;

  // --- manifest -----------------------------------------------------------
  const manifest: ManifestEntry[] = ordered.map((skill, i) => {
    const contentHash = sha256(skill.content);
    const changed =
      expectedHashes[skill.id] !== undefined && expectedHashes[skill.id] !== contentHash;
    return {
      index: i + 1,
      id: skill.id,
      name: skill.name,
      path: skill.path,
      categoryLabel: skill.categories.length ? categoryLabel(skill.categories) : '(root)',
      categories: skill.categories,
      chars: skill.content.length,
      bytes: utf8ByteLength(skill.content),
      lines: countLines(skill.content),
      sha256: contentHash,
      ...(changed ? { changed: true } : {}),
    };
  });

  const changed = manifest.filter((m) => m.changed).map((m) => m.id);
  const unverified = manifest
    .filter((m) => expectedHashes[m.id] === undefined)
    .map((m) => m.id);

  const totals = {
    skills: manifest.length,
    categories: countDistinctCategories(manifest),
    chars: manifest.reduce((sum, m) => sum + m.chars, 0),
    bytes: manifest.reduce((sum, m) => sum + m.bytes, 0),
    lines: manifest.reduce((sum, m) => sum + m.lines, 0),
  };

  // --- document -----------------------------------------------------------
  const out: string[] = [];
  out.push('# SKILLBRIDGE PACKAGE');
  out.push('');
  out.push(`Package ID: ${packageId}`);
  out.push(`Package Name: ${identity.packageName}`);
  out.push(`Repository: ${repository}`);
  out.push(`Branch: ${options.branch}`);
  out.push(`Root Directory: ${options.rootDir ? options.rootDir : '/'}`);
  out.push(`Compilation Date: ${compiledAt}`);
  out.push(`Total Skills: ${manifest.length}`);
  out.push(`Total Categories: ${totals.categories}`);
  out.push(`Original Content: ${totals.bytes} bytes, ${totals.lines} lines`);
  out.push(`Boundary Token: ${token}`);
  out.push('');
  out.push('<!-- This file is a SkillBridge package: a lossless concatenation of the');
  out.push('     selected Skill files. Content between each BEGIN/END boundary is the');
  out.push('     original file, preserved byte-for-byte. Do not edit inside boundaries. -->');
  out.push('');
  out.push(SKILL_SEPARATOR);
  out.push('');

  // --- manifest section ----------------------------------------------------
  out.push('## SKILL MANIFEST');
  out.push('');
  out.push(`- Package ID: ${packageId}`);
  out.push(`- Generated by: SkillBridge`);
  out.push(`- Skills: ${totals.skills}`);
  out.push(`- Categories: ${totals.categories}`);
  out.push(`- Total original bytes: ${totals.bytes}`);
  out.push(`- Total original lines: ${totals.lines}`);
  out.push(`- Integrity: SHA-256 of every original file is recorded below.`);
  out.push('');
  out.push('| # | Skill | Category | Source file | Bytes | Lines | SHA-256 |');
  out.push('|---|-------|----------|-------------|-------|-------|---------|');
  for (const m of manifest) {
    out.push(
      `| ${m.index} | ${escapeTableCell(m.name)} | ${escapeTableCell(m.categoryLabel)} | \`${escapeTableCell(m.path)}\` | ${m.bytes} | ${m.lines} | \`${m.sha256.slice(0, 16)}\` |`,
    );
  }
  out.push('');
  out.push(SKILL_SEPARATOR);
  out.push('');

  // --- skill blocks --------------------------------------------------------
  ordered.forEach((skill, i) => {
    const m = manifest[i]!;
    const begin = beginMarker(packageId, m.index, token, skill.id);
    const end = endMarker(packageId, m.index, token, skill.id);
    out.push('## SKILL METADATA');
    out.push('');
    out.push(`Name: ${skill.name}`);
    out.push(`Category: ${m.categoryLabel}`);
    out.push(`Source File: ${skill.path}`);
    out.push(`Index: ${m.index} of ${manifest.length}`);
    out.push(`Original Size: ${m.bytes} bytes, ${m.lines} lines`);
    out.push(`SHA-256: ${m.sha256}`);
    if (m.changed) out.push('Integrity: CHANGED SINCE DISCOVERY');
    out.push('');
    out.push(begin);
    out.push(skill.content);
    out.push(end);
    out.push('');
    out.push('<!-- END OF SKILL -->');
    out.push('');
    out.push(SKILL_SEPARATOR);
    out.push('');
  });

  out.push('<!-- SKILLBRIDGE PACKAGE END -->');
  out.push('');

  const markdown = out.join('\n');

  // Post-condition: every original file must be recoverable verbatim.
  verifyRoundTrip(markdown, ordered, packageId, token);

  return {
    pkg: {
      packageId,
      packageName: identity.packageName,
      fileName: identity.fileName,
      repository,
      owner: options.owner,
      repo: options.repo,
      branch: options.branch,
      compiledAt,
      markdown,
      skills: manifest,
      totals,
    },
    verification: {
      changed,
      unverified,
      ok: changed.length === 0,
    },
  };
}

/** Count lines without inventing or dropping trailing-newline semantics. */
export function countLines(content: string): number {
  if (content === '') return 0;
  let lines = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lines++;
  }
  return content.endsWith('\n') ? lines - 1 : lines;
}

function countDistinctCategories(manifest: ManifestEntry[]): number {
  const set = new Set<string>();
  for (const m of manifest) set.add(m.categoryLabel);
  return set.size;
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * Extract the verbatim contents from a package. Used by tests, the content
 * script and future tooling (e.g. re-importing a package).
 */
export interface ExtractedSkill {
  index: number;
  packageId: string;
  token: string;
  skillId: string;
  content: string;
}

export function extractSkills(packageMarkdown: string): ExtractedSkill[] {
  const results: ExtractedSkill[] = [];
  const lines = packageMarkdown.split('\n');
  let current: { index: number; packageId: string; token: string; skillId: string; body: string[] } | null =
    null;

  const beginRe =
    /^<!-- SKILLBRIDGE:BEGIN:(SB-[A-Z0-9-]+):(\d{4}):([A-Z0-9]+):(.+) -->$/;
  const endRe = /^<!-- SKILLBRIDGE:END:(SB-[A-Z0-9-]+):(\d{4}):([A-Z0-9]+):(.+) -->$/;

  for (const line of lines) {
    if (!current) {
      const m = beginRe.exec(line);
      if (m) {
        current = {
          packageId: m[1]!,
          index: Number(m[2]),
          token: m[3]!,
          skillId: m[4]!,
          body: [],
        };
      }
      continue;
    }
    const e = endRe.exec(line);
    if (
      e &&
      e[1] === current.packageId &&
      Number(e[2]) === current.index &&
      e[3] === current.token &&
      e[4] === current.skillId
    ) {
      results.push({
        packageId: current.packageId,
        index: current.index,
        token: current.token,
        skillId: current.skillId,
        content: current.body.join('\n'),
      });
      current = null;
      continue;
    }
    current.body.push(line);
  }
  return results;
}

/**
 * Internal invariant check: re-extract every skill from the produced Markdown
 * and compare it against the original source byte-for-byte (UTF-8).
 */
export function verifyRoundTrip(
  markdown: string,
  sources: SkillSource[],
  packageId: string,
  token: string,
): void {
  const extracted = extractSkills(markdown);
  if (extracted.length !== sources.length) {
    throw new CompileError(
      'ROUNDTRIP_FAILED',
      `Package integrity check failed: expected ${sources.length} skills, recovered ${extracted.length}.`,
    );
  }
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!;
    const found = extracted[i]!;
    if (found.packageId !== packageId || found.token !== token || found.skillId !== source.id) {
      throw new CompileError(
        'ROUNDTRIP_FAILED',
        `Package integrity check failed: boundary mismatch for ${source.path}.`,
      );
    }
    if (sha256Bytes(utf8Bytes(found.content)) !== sha256Bytes(utf8Bytes(source.content))) {
      throw new CompileError(
        'ROUNDTRIP_FAILED',
        `Package integrity check failed: content altered for ${source.path}.`,
      );
    }
  }
}

/**
 * Verify that the content retrieved at compile time matches the hashes captured
 * during discovery. Returns the ids that changed so the UI can block or warn.
 */
export function verifySources(
  sources: SkillSource[],
  expectedHashes: Record<string, string>,
): CompileVerification {
  const changed: string[] = [];
  const unverified: string[] = [];
  for (const source of sources) {
    const expected = expectedHashes[source.id];
    if (expected === undefined) {
      unverified.push(source.id);
      continue;
    }
    if (sha256(source.content) !== expected) changed.push(source.id);
  }
  return { changed, unverified, ok: changed.length === 0 };
}
