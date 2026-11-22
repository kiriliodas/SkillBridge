/**
 * Guards for the bundled Skill library under `skills/`.
 *
 * The library is content, not code, but it can still break the product: a file that
 * the scanner cannot attribute, an empty skill, a duplicate name, or an INDEX that
 * drifts from reality all degrade the package LM Arena receives. These checks run the
 * real parser over the real files, so the guarantees are verified rather than assumed.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, posix } from 'node:path';
import { parseRepositoryTree, type TreeFile } from '../src/core/repoTree';
import { DEFAULT_REPO } from '../src/shared/config';

const ROOT = join(__dirname, '..');
const SKILLS_DIR = join(ROOT, 'skills');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(SKILLS_DIR);
const treeFiles: TreeFile[] = files.map((f) => ({
  path: relative(ROOT, f).split('\\').join('/'),
  type: 'blob' as const,
  size: statSync(f).size,
}));

const parsed = parseRepositoryTree(treeFiles, {
  config: { ...DEFAULT_REPO, rootDir: 'skills' },
  rootName: 'skillbridge',
});

describe('bundled skill library', () => {
  it('is detected by the real scanner, one entry per Markdown file', () => {
    const mdCount = treeFiles.filter((f) => f.path.endsWith('.md')).length;
    expect(parsed.skills.length).toBe(mdCount);
    expect(parsed.skills.length).toBeGreaterThanOrEqual(30);
    expect(parsed.warnings).toEqual([]);
  });

  it('ignores every non-Markdown file (metadata lives outside skills/)', () => {
    // Only .md files may live under skills/: anything else would be silent clutter.
    const nonMd = treeFiles.filter((f) => !f.path.endsWith('.md'));
    expect(nonMd).toEqual([]);
    // Documentation must sit outside the scanned root so it is never shipped as a skill.
    for (const doc of ['INDEX.md', 'CATALOG.md', 'SOURCES.md', 'CANDIDATES.md', 'LM-ARENA-CONSTRAINTS.md']) {
      expect(existsSync(join(ROOT, 'skill-library', doc)), `missing skill-library/${doc}`).toBe(true);
      expect(treeFiles.some((f) => f.path === `skills/${doc}`), `${doc} must not sit under skills/`).toBe(false);
    }
  });

  it('gives every skill a display name and a category', () => {
    for (const skill of parsed.skills) {
      expect(skill.name.trim().length, skill.path).toBeGreaterThan(2);
      expect(skill.categories.length, skill.path).toBeGreaterThanOrEqual(1);
      expect(skill.categoryLabel.trim().length, skill.path).toBeGreaterThan(2);
    }
  });

  it('has no duplicate skill names', () => {
    const seen = new Map<string, string>();
    for (const skill of parsed.skills) {
      const key = skill.name.toLowerCase();
      expect(seen.has(key), `${skill.name} in ${skill.path} and ${seen.get(key)}`).toBe(false);
      seen.set(key, skill.path);
    }
  });

  it('has no duplicate file names, so ids stay unambiguous', () => {
    const seen = new Map<string, string>();
    for (const skill of parsed.skills) {
      const key = skill.fileName.toLowerCase();
      expect(seen.has(key), `${skill.fileName} appears twice`).toBe(false);
      seen.set(key, skill.path);
    }
  });

  it('keeps every skill a real document, not a stub', () => {
    for (const skill of parsed.skills) {
      const text = readFileSync(join(ROOT, skill.path), 'utf8');
      expect(text.length, `${skill.path} is too short to be useful`).toBeGreaterThan(1500);
      // A single H1 title, no YAML frontmatter (the parser takes the file verbatim).
      expect(text.startsWith('# '), `${skill.path} must start with an H1 title`).toBe(true);
      expect(text.startsWith('---'), `${skill.path} must not use YAML frontmatter`).toBe(false);
      // No unclosed or misuse of the packages's own boundary marker.
      expect(text.includes('SKILLBRIDGE:'), `${skill.path} must not embed package markers`).toBe(false);
    }
  });

  it('never leaks secrets or credentials', () => {
    const patterns = [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /\bAKIA[0-9A-Z]{16}\b/,
      /\bghp_[A-Za-z0-9]{36}\b/,
      /\bsk-[A-Za-z0-9]{32,}\b/,
      /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    ];
    for (const skill of parsed.skills) {
      const text = readFileSync(join(ROOT, skill.path), 'utf8');
      for (const re of patterns) {
        expect(re.test(text), `${skill.path} matches ${re}`).toBe(false);
      }
    }
  });

  it('organises skills in a shallow, non-empty hierarchy', () => {
    const byCategory = new Map<string, number>();
    for (const skill of parsed.skills) {
      const top = skill.categories[0]!;
      byCategory.set(top, (byCategory.get(top) ?? 0) + 1);
      expect(skill.categories.length, `${skill.path} is nested too deeply`).toBeLessThanOrEqual(3);
    }
    // No category may contain a single orphan skill: it means the taxonomy is wrong.
    for (const [category, count] of byCategory) {
      expect(count, `category "${category}" holds only ${count} skill(s)`).toBeGreaterThanOrEqual(2);
    }
  });

  it('documents every skill in the catalogue, and nothing else', () => {
    const catalog = readFileSync(join(ROOT, 'skill-library', 'CATALOG.md'), 'utf8');
    for (const skill of parsed.skills) {
      const relPath = skill.path.replace(/^skills\//, '');
      expect(catalog.includes(skill.name), `${skill.name} missing from CATALOG.md`).toBe(true);
      expect(catalog.includes(relPath), `${relPath} missing from CATALOG.md`).toBe(true);
    }
    // Every catalogued path must exist. Only table cells count: prose may legitimately
    // mention a file name as an example without it being a catalogue entry.
    for (const match of catalog.matchAll(/\| `([a-z0-9-]+(?:\/[a-z0-9-]+)*\.md)` \|/g)) {
      const rel = match[1]!;
      expect(
        treeFiles.some((f) => f.path === posix.join('skills', rel)),
        `CATALOG.md references a missing file: ${rel}`,
      ).toBe(true);
    }
  });
});
