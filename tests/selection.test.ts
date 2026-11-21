import { describe, expect, it } from 'vitest';
import {
  clearSelection,
  countSelected,
  isSkillSelected,
  nodeCheckboxState,
  normalizeSelection,
  pruneSelection,
  resolveSelectedSkills,
  selectAll,
  setGroupSelected,
  setSkillSelected,
  skillCheckboxState,
  summarizeSelection,
  toggleSkill,
  toggleSkillWithCatalog,
} from '../src/core/selection';
import { collectSkillIds, parseRepositoryTree, type TreeFile } from '../src/core/repoTree';
import type { RepoConfig } from '../src/shared/types';

const config: RepoConfig = {
  owner: 'LM-Arena',
  repo: 'skills',
  branch: 'main',
  rootDir: '',
  excludes: [],
};

const files: TreeFile[] = [
  { path: 'Android/Kotlin/kotlin-standards.md', type: 'blob', size: 1000 },
  { path: 'Android/Kotlin/coroutines.md', type: 'blob', size: 2000 },
  { path: 'Android/Compose/architecture.md', type: 'blob', size: 3000 },
  { path: 'Web/Frontend/react.md', type: 'blob', size: 4000 },
  { path: 'Web/Backend/api.md', type: 'blob', size: 5000 },
  { path: 'General/pm.md', type: 'blob', size: 600 },
];

const snapshot = parseRepositoryTree(files, { config });
const snapshotShaped = {
  config,
  commit: 'abc123',
  fetchedAt: 0,
  skills: snapshot.skills,
  tree: snapshot.tree,
  warnings: snapshot.warnings,
};
const ALL = snapshot.skills.map((s) => s.id);
const idOf = (fileName: string) => snapshot.skills.find((s) => s.fileName === fileName)!.id;
const kotlin = snapshot.tree.children.find((c) => c.name === 'Android')!.children.find((c) => c.name === 'Kotlin')!;

describe('skill selection', () => {
  it('selects and deselects individual skills', () => {
    let state = toggleSkill({ ids: [], allSelected: false }, idOf('coroutines.md'));
    expect(countSelected(state, ALL)).toBe(1);
    expect(isSkillSelected(state, idOf('coroutines.md'))).toBe(true);
    state = toggleSkill(state, idOf('coroutines.md'));
    expect(countSelected(state, ALL)).toBe(0);
  });

  it('supports explicit set operations', () => {
    let state = setSkillSelected({ ids: [], allSelected: false }, idOf('react.md'), true);
    expect(state.ids).toEqual([idOf('react.md')]);
    state = setSkillSelected(state, idOf('react.md'), false);
    expect(state.ids).toEqual([]);
  });

  it('resolves "all selected" when toggling one skill', () => {
    const state = toggleSkillWithCatalog({ ids: [], allSelected: true }, idOf('pm.md'), ALL);
    expect(state.allSelected).toBe(false);
    expect(countSelected(state, ALL)).toBe(ALL.length - 1);
    expect(isSkillSelected(state, idOf('pm.md'))).toBe(false);
  });

  it('deduplicates and sorts ids', () => {
    const state = setSkillSelected({ ids: [], allSelected: false }, idOf('pm.md'), true);
    const again = setSkillSelected(state, idOf('pm.md'), true);
    expect(again.ids).toEqual([idOf('pm.md')]);
    const normalized = normalizeSelection({ ids: ['b', 'a', 'b'], allSelected: false });
    expect(normalized.ids).toEqual(['a', 'b']);
  });
});

describe('group selection', () => {
  it('selects an entire subcategory', () => {
    const ids = collectSkillIds(kotlin);
    const state = setGroupSelected({ ids: [], allSelected: false }, ids, true, ALL);
    expect(state.ids.sort()).toEqual(ids.sort());
    const all = collectSkillIds(snapshot.tree);
    // Selecting every group yields "all selected".
    const everything = setGroupSelected({ ids: [], allSelected: false }, all, true, ALL);
    expect(everything.allSelected).toBe(true);
  });

  it('deselects a category while keeping other selections', () => {
    let state = setGroupSelected({ ids: [], allSelected: false }, ALL, true, ALL);
    state = setGroupSelected(state, collectSkillIds(kotlin), false, ALL);
    expect(state.allSelected).toBe(false);
    expect(countSelected(state, ALL)).toBe(ALL.length - 2);
  });

  it('supports select-all and clear', () => {
    const all = selectAll(ALL);
    expect(all.allSelected).toBe(true);
    expect(countSelected(all, ALL)).toBe(ALL.length);
    expect(clearSelection().ids).toEqual([]);
    expect(selectAll([]).allSelected).toBe(false);
  });
});

describe('tri-state checkboxes', () => {
  it('reports skill states', () => {
    const state = { ids: [idOf('react.md')], allSelected: false };
    expect(skillCheckboxState(state, idOf('react.md'))).toBe('checked');
    expect(skillCheckboxState(state, idOf('pm.md'))).toBe('unchecked');
    expect(skillCheckboxState({ ids: [], allSelected: true }, idOf('pm.md'))).toBe('checked');
  });

  it('reports category states', () => {
    const empty = { ids: [], allSelected: false };
    expect(nodeCheckboxState(empty, kotlin)).toBe('unchecked');
    const one = { ids: [idOf('coroutines.md')], allSelected: false };
    expect(nodeCheckboxState(one, kotlin)).toBe('indeterminate');
    const both = { ids: [idOf('coroutines.md'), idOf('kotlin-standards.md')], allSelected: false };
    expect(nodeCheckboxState(both, kotlin)).toBe('checked');
    const android = snapshot.tree.children.find((c) => c.name === 'Android')!;
    expect(nodeCheckboxState(both, android)).toBe('indeterminate');
  });

  it('handles empty categories', () => {
    const emptyNode = { name: 'X', path: ['X'], id: 'X', children: [], skills: [], totalSkills: 0 };
    expect(nodeCheckboxState({ ids: [], allSelected: false }, emptyNode)).toBe('unchecked');
  });
});

describe('resolution and resilience', () => {
  it('resolves selected skills in catalog order', () => {
    const state = { ids: [idOf('pm.md'), idOf('coroutines.md')], allSelected: false };
    const resolved = resolveSelectedSkills(snapshotShaped, state);
    expect(resolved.map((s) => s.fileName)).toEqual(['coroutines.md', 'pm.md']);
  });

  it('resolves every skill when allSelected', () => {
    expect(resolveSelectedSkills(snapshotShaped, { ids: [], allSelected: true })).toHaveLength(6);
  });

  it('prunes ids that no longer exist', () => {
    const state = { ids: [idOf('pm.md'), 'gone'], allSelected: false };
    expect(pruneSelection(state, snapshotShaped).ids).toEqual([idOf('pm.md')]);
    expect(pruneSelection({ ids: [], allSelected: true }, snapshotShaped).allSelected).toBe(true);
  });
});

describe('summary', () => {
  it('counts skills, categories, bytes and lines', () => {
    const skills = resolveSelectedSkills(snapshotShaped, { ids: ALL, allSelected: false });
    const summary = summarizeSelection(skills);
    expect(summary.count).toBe(6);
    expect(summary.categories).toBe(5);
    expect(summary.estimatedBytes).toBe(15600);
    expect(summary.estimatedLines).toBeGreaterThan(0);
  });

  it('handles an empty selection', () => {
    expect(summarizeSelection([])).toEqual({
      count: 0,
      categories: 0,
      estimatedBytes: 0,
      estimatedLines: 0,
    });
  });
});
