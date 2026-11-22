import { describe, expect, it } from 'vitest';
import { filterTreeForSearch, searchSkills } from '../src/core/search';
import { parseRepositoryTree, type TreeFile } from '../src/core/repoTree';
import type { RepoConfig } from '../src/shared/types';

const config: RepoConfig = { owner: 'o', repo: 'r', branch: 'main', rootDir: '', excludes: [] };
const files: TreeFile[] = [
  { path: 'Android/Kotlin/kotlin-standards.md', type: 'blob', size: 10 },
  { path: 'Android/Kotlin/coroutines.md', type: 'blob', size: 10 },
  { path: 'Android/Compose/material-design.md', type: 'blob', size: 10 },
  { path: 'Web/Frontend/react-best-practices.md', type: 'blob', size: 10 },
  { path: 'Web/Frontend/accessibility.md', type: 'blob', size: 10 },
  { path: 'Database/SQL/sql-best-practices.md', type: 'blob', size: 10 },
  { path: 'Développement/Sécurité/réseau.md', type: 'blob', size: 10 },
];
const { skills, tree } = parseRepositoryTree(files, { config });

const names = (query: string) => searchSkills(skills, query).matches.map((m) => m.skill.name);

describe('searchSkills', () => {
  it('returns nothing for an empty query', () => {
    expect(searchSkills(skills, '   ').matches).toEqual([]);
  });

  it('finds by skill name, ranked with name prefix first', () => {
    const results = names('kotlin');
    expect(results[0]).toBe('Kotlin Standards');
    expect(results).toContain('Kotlin Standards');
    // Coroutines matches through its "Android / Kotlin" category.
    expect(results).toContain('Coroutines');
  });

  it('finds by file name fragments', () => {
    expect(names('best-practices')).toEqual(
      expect.arrayContaining(['React Best Practices', 'SQL Best Practices']),
    );
  });

  it('finds by category name', () => {
    const results = searchSkills(skills, 'compose');
    expect(results.matches.map((m) => m.skill.fileName)).toEqual(['material-design.md']);
  });

  it('finds by nested category', () => {
    expect(names('frontend').sort()).toEqual(['Accessibility', 'React Best Practices']);
  });

  it('requires every token to match (AND semantics)', () => {
    expect(names('kotlin standards')).toEqual(['Kotlin Standards']);
    expect(names('kotlin accessibility')).toEqual([]);
  });

  it('is case-insensitive and accent-sensitive (accents are preserved, not folded)', () => {
    expect(names('KOTLIN')).toContain('Kotlin Standards');
    expect(names('sécurité')).toEqual(['Réseau']);
    expect(names('securite')).toEqual([]);
  });

  it('matches unicode names', () => {
    expect(names('réseau')).toEqual(['Réseau']);
    expect(searchSkills(skills, 'sécurité').visibleNodeIds.has('Développement')).toBe(true);
  });

  it('returns visible ancestors for context', () => {
    const result = searchSkills(skills, 'material');
    expect(result.visibleNodeIds.has('Android')).toBe(true);
    expect(result.visibleNodeIds.has('Android/Compose')).toBe(true);
  });

  it('ranks name matches above path matches', () => {
    const result = searchSkills(skills, 'react');
    expect(result.matches[0]!.matchedIn).toBe('name');
  });

  it('handles no matches gracefully', () => {
    expect(names('zzzznothing')).toEqual([]);
  });
});

describe('filterTreeForSearch', () => {
  it('keeps all nodes for an empty query', () => {
    const { keepNodeIds, matchedSkillIds } = filterTreeForSearch(tree, '');
    expect(keepNodeIds).toEqual(new Set(['']));
    expect(matchedSkillIds.size).toBe(0);
  });

  it('keeps ancestors of matched skills', () => {
    const { keepNodeIds, matchedSkillIds } = filterTreeForSearch(tree, 'react');
    expect(keepNodeIds.has('Web')).toBe(true);
    expect(keepNodeIds.has('Web/Frontend')).toBe(true);
    expect(matchedSkillIds.size).toBe(1);
  });

  it('keeps a category and its whole subtree when the category name matches', () => {
    const { keepNodeIds } = filterTreeForSearch(tree, 'kotlin');
    expect(keepNodeIds.has('Android/Kotlin')).toBe(true);
    expect(keepNodeIds.has('Android')).toBe(true);
  });

  it('does not keep unrelated branches', () => {
    const { keepNodeIds } = filterTreeForSearch(tree, 'kotlin');
    expect(keepNodeIds.has('Web')).toBe(false);
    expect(keepNodeIds.has('Database')).toBe(false);
  });
});
