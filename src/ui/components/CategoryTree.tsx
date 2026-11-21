/**
 * Hierarchical category browser with tri-state checkboxes, keyboard support and
 * search filtering. Rendering is iterative-friendly (recursive components) and
 * only expanded nodes mount their children, which keeps large libraries fast.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CategoryNode, SelectionState, SkillEntry } from '../../shared/types';
import { collectSkillIds } from '../../core/repoTree';
import { setGroupSelected, setSkillSelected, skillCheckboxState, nodeCheckboxState, toggleSkillWithCatalog } from '../../core/selection';
import { Checkbox } from './Checkbox';
import { IconChevron, IconFile, IconFolder } from './Icons';
import { formatNumber } from '../../shared/format';

export interface CategoryTreeProps {
  tree: CategoryNode;
  selection: SelectionState;
  allSkillIds: string[];
  onSelectionChange: (selection: SelectionState) => void;
  onPreview: (skill: SkillEntry) => void;
  onPrefetch?: (skillId: string) => void;
  /** Node ids to force-open while searching. */
  forceOpenIds?: Set<string>;
  /** Skills to keep visible while searching (others are hidden). */
  visibleSkillIds?: Set<string>;
  compact?: boolean;
}

export function CategoryTree(props: CategoryTreeProps) {
  const { tree, compact } = props;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']));

  const searching = Boolean(props.visibleSkillIds);

  useEffect(() => {
    if (!searching) return;
    // Expand every branch that contains a match while a query is active.
    setExpanded((current) => {
      const next = new Set(current);
      for (const id of props.forceOpenIds ?? []) next.add(id);
      next.add('');
      return next;
    });
  }, [searching, props.forceOpenIds]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Compact mode tightens row density only (see `.tree--compact`); it must not
  // collapse or re-open branches, which would discard the user's place.

  return (
    <div className={['tree', compact ? 'tree--compact' : ''].filter(Boolean).join(' ')} role="tree" aria-label="Skill categories">
      {tree.skills.length > 0 && (
        <SkillGroup
          {...props}
          skills={tree.skills}
          depth={0}
        />
      )}
      {tree.children.map((child) => (
        <CategoryBranch
          key={child.id}
          {...props}
          node={child}
          depth={0}
          expanded={expanded}
          onToggle={toggleExpanded}
        />
      ))}
    </div>
  );
}

interface BranchProps extends CategoryTreeProps {
  node: CategoryNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

function CategoryBranch({
  node,
  depth,
  expanded,
  onToggle,
  selection,
  allSkillIds,
  onSelectionChange,
  onPreview,
  onPrefetch,
  visibleSkillIds,
}: BranchProps): React.ReactElement {
  const isOpen = expanded.has(node.id);
  const state = nodeCheckboxState(selection, node, allSkillIds);
  const ids = useMemo(() => collectSkillIds(node), [node]);

  const visibleChildren = visibleSkillIds
    ? node.children.filter((child) => hasVisibleSkill(child, visibleSkillIds))
    : node.children;
  const visibleSkills = visibleSkillIds
    ? node.skills.filter((skill) => visibleSkillIds.has(skill.id))
    : node.skills;

  const handleToggleSelection = (next: boolean) => {
    onSelectionChange(setGroupSelected(selection, ids, next, allSkillIds));
  };

  return (
    <div className="tree__branch" role="treeitem" aria-expanded={isOpen} aria-selected={state === 'checked'}>
      <div
        className="tree__row tree__row--category"
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onToggle(node.id)}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        aria-label={`${node.name}, ${formatNumber(node.totalSkills)} skills`}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle(node.id);
          } else if (event.key === 'ArrowRight' && !isOpen) {
            event.preventDefault();
            onToggle(node.id);
          } else if (event.key === 'ArrowLeft' && isOpen) {
            event.preventDefault();
            onToggle(node.id);
          }
        }}
      >
        <button
          className="tree__disclosure"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.id);
          }}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
          tabIndex={-1}
        >
          <IconChevron size={13} className={isOpen ? 'chevron--open' : undefined} />
        </button>
        <Checkbox
          state={state}
          onChange={handleToggleSelection}
          label={`Select all skills in ${node.name}`}
          size="sm"
        />
        <span className="tree__icon" aria-hidden="true">
          <IconFolder size={14} />
        </span>
        <span className="tree__name">{node.name}</span>
        <span className="tree__count">{formatNumber(node.totalSkills)}</span>
      </div>

      {isOpen && (
        <div role="group">
          {visibleSkills.length > 0 && (
            <SkillGroup
              skills={visibleSkills}
              depth={depth + 1}
              selection={selection}
              allSkillIds={allSkillIds}
              onSelectionChange={onSelectionChange}
              onPreview={onPreview}
              {...(onPrefetch ? { onPrefetch } : {})}
            />
          )}
          {visibleChildren.map((child) => (
            <CategoryBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              tree={node}
              selection={selection}
              allSkillIds={allSkillIds}
              onSelectionChange={onSelectionChange}
              onPreview={onPreview}
              {...(onPrefetch ? { onPrefetch } : {})}
              {...(visibleSkillIds ? { visibleSkillIds } : {})}
            />
          ))}
          {visibleSkills.length === 0 && visibleChildren.length === 0 && (
            <p className="tree__empty" style={{ paddingLeft: 24 + depth * 16 }}>
              No skills here
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface SkillGroupProps {
  skills: SkillEntry[];
  depth: number;
  selection: SelectionState;
  allSkillIds: string[];
  onSelectionChange: (selection: SelectionState) => void;
  onPreview: (skill: SkillEntry) => void;
  onPrefetch?: (skillId: string) => void;
}

function SkillGroup({
  skills,
  depth,
  selection,
  allSkillIds,
  onSelectionChange,
  onPreview,
  onPrefetch,
}: SkillGroupProps): React.ReactElement {
  return (
    <div role="group">
      {skills.map((skill) => {
        const state = skillCheckboxState(selection, skill.id);
        return (
          <div
            key={skill.id}
            className="tree__row tree__row--skill"
            style={{ paddingLeft: 8 + depth * 16 }}
            data-selected={state === 'checked' || undefined}
            onClick={() => onPreview(skill)}
            onMouseEnter={() => onPrefetch?.(skill.id)}
            tabIndex={0}
            role="button"
            aria-label={`${skill.name}, ${skill.categoryLabel}`}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter') {
                event.preventDefault();
                onPreview(skill);
              } else if (event.key === ' ') {
                event.preventDefault();
                onSelectionChange(
                  state === 'checked'
                    ? toggleSkillWithCatalog(selection, skill.id, allSkillIds)
                    : setSkillSelected(selection, skill.id, true, allSkillIds),
                );
              }
            }}
          >
            <span className="tree__spacer" aria-hidden="true" />
            <Checkbox
              state={state}
              onChange={(next) => {
                if (next) onSelectionChange(setSkillSelected(selection, skill.id, true, allSkillIds));
                else onSelectionChange(toggleSkillWithCatalog(selection, skill.id, allSkillIds));
              }}
              label={`Select ${skill.name}`}
              size="sm"
            />
            <span className="tree__icon tree__icon--file" aria-hidden="true">
              <IconFile size={14} />
            </span>
            <span className="tree__name" title={skill.relPath}>
              {skill.name}
            </span>
            <span className="tree__path" title={skill.relPath}>
              {skill.fileName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function hasVisibleSkill(node: CategoryNode, visible: Set<string>): boolean {
  if (node.skills.some((skill) => visible.has(skill.id))) return true;
  return node.children.some((child) => hasVisibleSkill(child, visible));
}
