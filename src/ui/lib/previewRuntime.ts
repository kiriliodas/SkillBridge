/**
 * In-page runtime used only by the Vite dev preview (never shipped in the
 * extension). It uses the real discovery, compilation and prompt engines over a
 * bundled fixture repository so the UI behaves exactly like production.
 */
import { parseRepositoryTree, type TreeFile } from '../../core/repoTree';
import type {
  ManagerState,
  RepoSnapshot,
  SelectionState,
  Settings,
  StorageStats,
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/config';
import type { Runtime } from './runtime';

const FIXTURE_TREE: TreeFile[] = [
  { path: 'Android/Kotlin/kotlin-standards.md', type: 'blob', size: 1400 },
  { path: 'Android/Kotlin/coroutines.md', type: 'blob', size: 2900 },
  { path: 'Android/Jetpack Compose/architecture.md', type: 'blob', size: 3200 },
  { path: 'Android/Jetpack Compose/material-design.md', type: 'blob', size: 2400 },
  { path: 'Web Development/Frontend/react-best-practices.md', type: 'blob', size: 4100 },
  { path: 'Web Development/Frontend/accessibility.md', type: 'blob', size: 3600 },
  { path: 'Web Development/Backend/api-design.md', type: 'blob', size: 3800 },
  { path: 'Database/SQL/sql-best-practices.md', type: 'blob', size: 3300 },
  { path: 'Database/Design/database-design.md', type: 'blob', size: 2700 },
  { path: 'General/project-management.md', type: 'blob', size: 1900 },
  { path: 'Développement Web/Sécurité/réseau-avancé.md', type: 'blob', size: 2100 },
  { path: 'Design/UI/design-tokens.md', type: 'blob', size: 1600 },
  { path: 'Design/UI/typography.md', type: 'blob', size: 1200 },
];

function fixtureContent(path: string): string {
  return [
    `# ${path.split('/').pop()!.replace(/\.md$/, '').replace(/[-_]/g, ' ')}`,
    '',
    `> Preview content for \`${path}\`. In the extension this is the original file.`,
    '',
    '## Guidelines',
    '',
    '- Keep changes focused and reviewable.',
    '- Prefer clarity over cleverness.',
    '',
    '```ts',
    'export function example(value: string): string {',
    '  return value.trim();',
    '}',
    '```',
    '',
    '| Rule | Rationale |',
    '|------|-----------|',
    '| Small diffs | Faster review |',
    '',
  ].join('\n');
}

export function createPreviewRuntime(): Runtime {
  const settings: Settings = structuredClone(DEFAULT_SETTINGS);
  let selection: SelectionState = { ids: [], allSelected: false };
  let snapshot: RepoSnapshot | null = null;
  let status: ManagerState['status'] = 'idle';
  let revision = 0;
  const listeners = new Set<() => void>();
  const contents = new Map<string, string>();

  const build = (): RepoSnapshot => {
    // The fixture paths are relative to the library root, so the preview always
    // parses with an empty root directory (the real repository default is
    // `skills`, which would otherwise filter everything out).
    const parsed = parseRepositoryTree(FIXTURE_TREE, {
      config: { ...settings.repository, rootDir: '' },
      rootName: settings.repository.repo,
    });
    for (const skill of parsed.skills) contents.set(skill.id, fixtureContent(skill.relPath));
    return {
      config: settings.repository,
      commit: 'preview00000',
      fetchedAt: Date.now(),
      skills: parsed.skills,
      tree: parsed.tree,
      warnings: parsed.warnings,
    };
  };

  const state = (): ManagerState => ({
    settings,
    selection,
    repo: snapshot,
    status,
    error: null,
    revision,
  });

  const emit = () => {
    revision += 1;
    for (const listener of listeners) listener();
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    mode: 'preview',
    async getState() {
      if (!snapshot) {
        status = 'loading';
        emit();
        await delay(350);
        snapshot = build();
        status = 'ready';
        emit();
      }
      return state();
    },
    async refreshRepo() {
      status = 'loading';
      emit();
      await delay(450);
      snapshot = build();
      status = 'ready';
      emit();
      return state();
    },
    async setSettings(patch) {
      Object.assign(settings.repository, patch.repository ?? {});
      Object.assign(settings.behavior, patch.behavior ?? {});
      Object.assign(settings.interface, patch.interface ?? {});
      snapshot = build();
      emit();
      return state();
    },
    async setSelection(next) {
      selection = next;
      emit();
      return state();
    },
    async clearSelection() {
      selection = { ids: [], allSelected: false };
      emit();
      return state();
    },
    async getSkillContent(id) {
      await delay(120);
      return { content: contents.get(id) ?? '', cached: true };
    },
    async getStorageStats(): Promise<StorageStats> {
      return {
        cachedSkills: contents.size,
        cachedBytes: [...contents.values()].reduce((sum, c) => sum + c.length, 0),
        repoCache: true,
        snapshotSkills: snapshot?.skills.length ?? null,
      };
    },
    async clearCache() {
      contents.clear();
    },
    async openManager() {
      /* already on the manager page */
    },
    async getLastPackage() {
      return null;
    },
    async insertIntoArena() {
      await delay(600);
      return {
        outcome: 'failed',
        failedStep: 'detect-tab',
        steps: [
          {
            step: 'detect-tab',
            status: 'failed',
            message: 'Preview mode: LM Arena integration is only available in the installed extension.',
          },
        ],
        notes: ['Use the fallback: download the package and copy the prompt.'],
      };
    },
    onStateChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
