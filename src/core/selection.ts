/**
 * Selection logic. All functions are pure: the caller owns the state object.
 *
 * Two representations are supported:
 *  - "all selected" (allSelected = true) — selecting the whole repository
 *    keeps working when the library gains new skills.
 *  - "explicit ids" — the normal case.
 */
import type { CategoryNode, RepoSnapshot, SelectionState, SkillEntry } from '../shared/types';
import { collectSkillIds } from './repoTree';

export const EMPTY_SELECTION: SelectionState = { ids: [], allSelected: false };

export type CheckboxState = 'unchecked' | 'checked' | 'indeterminate';

export function normalizeSelection(selection: SelectionState): SelectionState {
  if (selection.allSelected) return { ids: [], allSelected: true };
  const ids = Array.from(new Set(selection.ids)).sort();
  return { ids, allSelected: false };
}

export function isSkillSelected(selection: SelectionState, skillId: string): boolean {
  return selection.allSelected || selection.ids.includes(skillId);
}

export function selectedIdSet(selection: SelectionState): Set<string> {
  return new Set(selection.ids);
}

export function toggleSkill(selection: SelectionState, skillId: string): SelectionState {
  if (selection.allSelected) {
    // Turning "all" into explicit selection minus this skill is handled by the
    // caller through setSkillSelection with the full catalog. Here we simply
    // flip the flag off and select everything except this skill is impossible
    // without the catalog, so the UI always resolves "all" to explicit ids
    // before toggling. See toggleSkillWithCatalog.
    return { ids: [], allSelected: true };
  }
  const has = selection.ids.includes(skillId);
  const ids = has ? selection.ids.filter((id) => id !== skillId) : [...selection.ids, skillId];
  return { ids: ids.sort(), allSelected: false };
}

/** Toggle a skill, resolving the "all selected" state against the catalog. */
export function toggleSkillWithCatalog(
  selection: SelectionState,
  skillId: string,
  allSkillIds: string[],
): SelectionState {
  if (selection.allSelected) {
    const ids = allSkillIds.filter((id) => id !== skillId);
    return { ids: ids.sort(), allSelected: false };
  }
  return toggleSkill(selection, skillId);
}

export function setSkillSelected(
  selection: SelectionState,
  skillId: string,
  selected: boolean,
  allSkillIds: string[] = [],
): SelectionState {
  const resolved = selection.allSelected
    ? { ids: [...allSkillIds], allSelected: false }
    : selection;
  const has = resolved.ids.includes(skillId);
  if (selected === has) return normalizeSelection(resolved);
  const ids = selected
    ? [...resolved.ids, skillId]
    : resolved.ids.filter((id) => id !== skillId);
  return { ids: Array.from(new Set(ids)).sort(), allSelected: false };
}

/**
 * Set a group of skills (category node) selected or unselected.
 * When every skill in the repository ends up selected we collapse into the
 * "allSelected" flag unless the catalog is empty.
 */
export function setGroupSelected(
  selection: SelectionState,
  groupIds: string[],
  selected: boolean,
  allSkillIds: string[],
): SelectionState {
  const base = selection.allSelected ? new Set(allSkillIds) : new Set(selection.ids);
  for (const id of groupIds) {
    if (selected) base.add(id);
    else base.delete(id);
  }
  const ids = Array.from(base).sort();
  if (allSkillIds.length > 0 && ids.length === allSkillIds.length) {
    return { ids: [], allSelected: true };
  }
  return { ids, allSelected: false };
}

export function selectAll(allSkillIds: string[]): SelectionState {
  if (allSkillIds.length === 0) return { ids: [], allSelected: false };
  return { ids: [], allSelected: true };
}

export function clearSelection(): SelectionState {
  return { ids: [], allSelected: false };
}

export function countSelected(selection: SelectionState, allSkillIds: string[]): number {
  return selection.allSelected ? allSkillIds.length : selection.ids.length;
}

/** Checkbox state for a skill. */
export function skillCheckboxState(selection: SelectionState, skillId: string): CheckboxState {
  return isSkillSelected(selection, skillId) ? 'checked' : 'unchecked';
}

/** Checkbox state for a category node (checks the subtree). */
export function nodeCheckboxState(
  selection: SelectionState,
  node: CategoryNode,
  allSkillIds?: string[],
): CheckboxState {
  const ids = collectSkillIds(node);
  if (ids.length === 0) return 'unchecked';
  if (selection.allSelected) {
    // Only "checked" when the node covers the entire catalog (root node).
    if (allSkillIds && ids.length === allSkillIds.length) return 'checked';
    return 'checked';
  }
  const selected = new Set(selection.ids);
  let count = 0;
  for (const id of ids) if (selected.has(id)) count++;
  if (count === 0) return 'unchecked';
  if (count === ids.length) return 'checked';
  return 'indeterminate';
}

/** Resolve the selected SkillEntry objects, in catalog order. */
export function resolveSelectedSkills(
  snapshot: RepoSnapshot,
  selection: SelectionState,
): SkillEntry[] {
  if (selection.allSelected) return [...snapshot.skills];
  const set = new Set(selection.ids);
  return snapshot.skills.filter((skill) => set.has(skill.id));
}

/** Drop ids that no longer exist in the catalog (repo changed). */
export function pruneSelection(
  selection: SelectionState,
  snapshot: RepoSnapshot,
): SelectionState {
  if (selection.allSelected) return selection;
  const valid = new Set(snapshot.skills.map((s) => s.id));
  const ids = selection.ids.filter((id) => valid.has(id));
  return ids.length === selection.ids.length ? selection : { ids, allSelected: false };
}

export interface SelectionSummary {
  count: number;
  categories: number;
  estimatedBytes: number;
  estimatedLines: number;
}

const APPROX_BYTES_PER_SKILL = 1200;

/**
 * Summary of the current selection. Bytes/lines are estimated from the tree
 * sizes recorded by GitHub (no content downloads needed while browsing).
 */
export function summarizeSelection(skills: SkillEntry[]): SelectionSummary {
  let bytes = 0;
  const categories = new Set<string>();
  for (const skill of skills) {
    bytes += skill.size || APPROX_BYTES_PER_SKILL;
    categories.add(skill.categories.length ? skill.categoryLabel : '(root)');
  }
  return {
    count: skills.length,
    categories: categories.size,
    estimatedBytes: bytes,
    // ~45 characters per line is a reasonable markdown average.
    estimatedLines: Math.round(bytes / 45),
  };
}
