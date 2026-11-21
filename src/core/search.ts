/**
 * Instant search over skills and categories.
 *
 * Matches are ranked: name prefix > name substring > file name > category >
 * path. Every whitespace-separated token must match somewhere (AND semantics),
 * which keeps results precise when searching "react hooks".
 */
import type { CategoryNode, SkillEntry } from '../shared/types';
import { compareText } from './repoTree';

export interface SearchMatch {
  skill: SkillEntry;
  score: number;
  /** True when the match came from the skill metadata rather than a category name. */
  matchedIn: 'name' | 'fileName' | 'category' | 'path';
}

export interface SearchResult {
  matches: SearchMatch[];
  /** Category nodes that should stay visible (ancestors of matches). */
  visibleNodeIds: Set<string>;
  /** True when any category names matched directly. */
  categoryMatched: boolean;
}

function normalizeQuery(query: string): string[] {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

function scoreToken(skill: SkillEntry, token: string): { score: number; where: SearchMatch['matchedIn'] } | null {
  const name = skill.name.toLocaleLowerCase();
  const fileName = skill.fileName.toLocaleLowerCase();
  const category = skill.categoryLabel.toLocaleLowerCase();
  const path = skill.relPath.toLocaleLowerCase();

  if (name.startsWith(token)) return { score: 100, where: 'name' };
  if (name.includes(token)) return { score: 80, where: 'name' };
  if (fileName.startsWith(token)) return { score: 70, where: 'fileName' };
  if (fileName.includes(token)) return { score: 60, where: 'fileName' };
  if (category.includes(token)) return { score: 40, where: 'category' };
  if (path.includes(token)) return { score: 20, where: 'path' };
  return null;
}

export function searchSkills(skills: SkillEntry[], query: string): SearchResult {
  const tokens = normalizeQuery(query);
  const visibleNodeIds = new Set<string>();
  if (tokens.length === 0) {
    return { matches: [], visibleNodeIds, categoryMatched: false };
  }

  const matches: SearchMatch[] = [];
  let categoryMatched = false;

  for (const skill of skills) {
    let total = 0;
    let matchedIn: SearchMatch['matchedIn'] = 'path';
    let allTokens = true;
    for (const token of tokens) {
      const result = scoreToken(skill, token);
      if (!result) {
        allTokens = false;
        break;
      }
      total += result.score;
      if (result.where === 'category') categoryMatched = true;
      matchedIn = result.where;
    }
    if (!allTokens) continue;
    matches.push({ skill, score: total, matchedIn });
    // Keep ancestors visible so the tree can show the match in context.
    for (let depth = 1; depth <= skill.categories.length; depth++) {
      visibleNodeIds.add(skill.categories.slice(0, depth).join('/'));
    }
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const byCategory = compareText(a.skill.categoryLabel, b.skill.categoryLabel);
    if (byCategory !== 0) return byCategory;
    return compareText(a.skill.name, b.skill.name);
  });

  return { matches, visibleNodeIds, categoryMatched };
}

/**
 * Return the subset of the category tree that should be rendered for a query.
 * Nodes are kept when they contain a match or their own name matches.
 */
export function filterTreeForSearch(
  root: CategoryNode,
  query: string,
): { matchedSkillIds: Set<string>; keepNodeIds: Set<string> } {
  const tokens = normalizeQuery(query);
  const matchedSkillIds = new Set<string>();
  const keepNodeIds = new Set<string>(['']);

  if (tokens.length === 0) {
    return { matchedSkillIds, keepNodeIds };
  }

  const skillMatches = (skill: SkillEntry): boolean => {
    const pathText = skill.relPath.toLocaleLowerCase();
    return tokens.every((token) => pathText.includes(token));
  };

  const nodeNameMatches = (node: CategoryNode): boolean => {
    const text = `${node.name} ${node.path.join(' ')}`.toLocaleLowerCase();
    return tokens.every((token) => text.includes(token));
  };

  // Depth-first walk: returns true when the subtree contains something to show.
  // Whenever a node is kept, all its ancestors are marked as keepers too.
  const walk = (node: CategoryNode): boolean => {
    let keep = false;
    for (const skill of node.skills) {
      if (skillMatches(skill)) {
        matchedSkillIds.add(skill.id);
        keep = true;
      }
    }
    if (node.id !== '' && nodeNameMatches(node)) keep = true;

    for (const child of node.children) {
      if (walk(child)) keep = true;
    }
    if (keep) {
      for (let depth = 0; depth <= node.path.length; depth++) {
        keepNodeIds.add(node.path.slice(0, depth).join('/'));
      }
    }
    return keep;
  };

  walk(root);
  return { matchedSkillIds, keepNodeIds };
}
