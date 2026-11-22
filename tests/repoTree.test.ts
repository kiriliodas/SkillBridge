import { describe, expect, it } from 'vitest';
import {
  buildCategoryTree,
  collectSkillIds,
  countCategories,
  deriveSkillName,
  findNodeById,
  isMarkdownPath,
  parseRepositoryTree,
  prettifyName,
  sortSkillsForCompilation,
  validateRepoConfig,
  type TreeFile,
} from '../src/core/repoTree';
import { DEFAULT_EXCLUDED_PATTERNS } from '../src/shared/config';
import type { RepoConfig } from '../src/shared/types';

const config: RepoConfig = {
  owner: 'LM-Arena',
  repo: 'LM-Arena-Skills',
  branch: 'main',
  rootDir: '',
  excludes: [],
};

const file = (path: string, size = 100): TreeFile => ({ path, type: 'blob', size });
const dir = (path: string): TreeFile => ({ path, type: 'tree' });

const SAMPLE_TREE: TreeFile[] = [
  dir('Android'),
  dir('Android/Kotlin'),
  file('Android/Kotlin/kotlin-standards.md'),
  file('Android/Kotlin/coroutines.md'),
  dir('Android/Jetpack Compose'),
  file('Android/Jetpack Compose/architecture.md'),
  file('Android/Jetpack Compose/material-design.md'),
  dir('Web Development'),
  dir('Web Development/Frontend'),
  file('Web Development/Frontend/react-best-practices.md'),
  file('Web Development/Frontend/accessibility.md'),
  dir('Web Development/Backend'),
  file('Web Development/Backend/api-design.md'),
  dir('Database'),
  dir('Database/SQL'),
  file('Database/SQL/sql-best-practices.md'),
  dir('Database/Design'),
  file('Database/Design/database-design.md'),
  dir('General'),
  file('General/project-management.md'),
  file('README.md'),
  file('package.json'),
  file('.gitignore'),
];

describe('parseRepositoryTree', () => {
  it('discovers every markdown file and ignores unrelated files', () => {
    const result = parseRepositoryTree(SAMPLE_TREE, { config });
    expect(result.skills).toHaveLength(11); // 10 skills + README.md (not excluded by default)
    expect(result.skills.map((s) => s.name).sort()).toEqual(
      [
        'Accessibility',
        'API Design',
        'Architecture',
        'Coroutines',
        'Database Design',
        'Kotlin Standards',
        'Material Design',
        'Project Management',
        'React Best Practices',
        'README',
        'SQL Best Practices',
      ].sort(),
    );
    expect(result.skills.some((s) => s.fileName === 'package.json')).toBe(false);
    expect(result.ignoredCount).toBeGreaterThan(0);
  });

  it('builds nested categories with arbitrary depth', () => {
    const result = parseRepositoryTree(
      [...SAMPLE_TREE, file('A/B/C/D/deep.md')],
      { config },
    );
    const deep = result.skills.find((s) => s.fileName === 'deep.md');
    expect(deep?.categories).toEqual(['A', 'B', 'C', 'D']);
    expect(deep?.categoryLabel).toBe('A / B / C / D');
  });

  it('supports spaces in directory and file names', () => {
    const result = parseRepositoryTree(SAMPLE_TREE, { config });
    const compose = result.skills.find((s) => s.fileName === 'material-design.md');
    expect(compose?.categories).toEqual(['Android', 'Jetpack Compose']);
    expect(compose?.path).toBe('Android/Jetpack Compose/material-design.md');
  });

  it('supports unicode and accents in names', () => {
    const files: TreeFile[] = [
      file('Développement Web/Sécurité/réseau-avancé.md'),
      file('データ/日本語スキル.md'),
      file('General/emoji 🚀 launch.md'),
    ];
    const result = parseRepositoryTree(files, { config });
    expect(result.skills).toHaveLength(3);
    const unicode = result.skills.find((s) => s.fileName === 'réseau-avancé.md');
    expect(unicode?.categories).toEqual(['Développement Web', 'Sécurité']);
    expect(unicode?.name).toBe('Réseau Avancé');
    expect(result.skills.some((s) => s.fileName === '日本語スキル.md')).toBe(true);
    expect(result.skills.some((s) => s.name.includes('🚀'))).toBe(true);
  });

  it('keeps empty directories out of the skill list but reports no skills', () => {
    const result = parseRepositoryTree([dir('Empty'), dir('Empty/Nested'), file('Empty/note.txt')], {
      config,
    });
    expect(result.skills).toHaveLength(0);
    expect(result.tree.children).toHaveLength(0);
    expect(result.warnings.join(' ')).toMatch(/No Markdown skills/);
  });

  it('applies the root directory filter', () => {
    const result = parseRepositoryTree(SAMPLE_TREE, {
      config: { ...config, rootDir: 'Android' },
    });
    expect(result.skills).toHaveLength(4);
    expect(result.skills.every((s) => s.path.startsWith('Android/'))).toBe(true);
    expect(result.skills.find((s) => s.fileName === 'coroutines.md')?.relPath).toBe(
      'Kotlin/coroutines.md',
    );
    expect(result.skills.find((s) => s.fileName === 'coroutines.md')?.categories).toEqual(['Kotlin']);
  });

  it('applies default and user excludes', () => {
    const result = parseRepositoryTree(SAMPLE_TREE, {
      config: { ...config, excludes: ['**/accessibility.md'] },
      defaultExcludes: DEFAULT_EXCLUDED_PATTERNS,
    });
    expect(result.skills.some((s) => s.fileName === 'accessibility.md')).toBe(false);
    expect(result.skills.some((s) => s.fileName === 'README.md')).toBe(false);
  });

  it('excluded directories remove their whole subtree', () => {
    const result = parseRepositoryTree(SAMPLE_TREE, {
      config: { ...config, excludes: ['Android/**'] },
    });
    expect(result.skills.every((s) => !s.path.startsWith('Android/'))).toBe(true);
  });

  it('ignores hidden directories by default', () => {
    const result = parseRepositoryTree([file('.hidden/secret.md'), file('ok.md')], { config });
    expect(result.skills.map((s) => s.relPath)).toEqual(['ok.md']);
  });

  it('is case-insensitive for the .md extension', () => {
    expect(isMarkdownPath('a.MD')).toBe(true);
    expect(isMarkdownPath('a.md')).toBe(true);
    expect(isMarkdownPath('a.markdown')).toBe(false);
  });

  it('produces deterministic ordering', () => {
    const a = parseRepositoryTree(SAMPLE_TREE, { config });
    const reversed = [...SAMPLE_TREE].reverse();
    const b = parseRepositoryTree(reversed, { config });
    expect(a.skills.map((s) => s.path)).toEqual(b.skills.map((s) => s.path));
  });

  it('produces stable ids based on the path', () => {
    const result = parseRepositoryTree(SAMPLE_TREE, { config });
    const skill = result.skills[0]!;
    expect(decodeURIComponent(skill.id)).toBe(skill.path);
  });

  it('warns when the configured root has no markdown', () => {
    const result = parseRepositoryTree(SAMPLE_TREE, {
      config: { ...config, rootDir: 'Missing' },
    });
    expect(result.skills).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/No Markdown skills found under "Missing"/);
  });
});

describe('deriveSkillName', () => {
  it('prettifies file names', () => {
    expect(deriveSkillName('Android/Kotlin/kotlin-standards.md')).toBe('Kotlin Standards');
    expect(deriveSkillName('api_design.md')).toBe('API Design');
    expect(deriveSkillName('Material Design.md')).toBe('Material Design');
    expect(deriveSkillName('Réseau & Sécurité.md')).toBe('Réseau & Sécurité');
    expect(deriveSkillName('SQL.md')).toBe('SQL');
    expect(deriveSkillName('iOS-guidelines.md')).toBe('IOS Guidelines');
    expect(deriveSkillName('README.md')).toBe('README');
  });

  it('restores common technical acronyms instead of sentence-casing them', () => {
    expect(deriveSkillName('api-design.md')).toBe('API Design');
    expect(deriveSkillName('sql-schema.md')).toBe('SQL Schema');
    expect(deriveSkillName('ui-review.md')).toBe('UI Review');
    expect(deriveSkillName('rag-context.md')).toBe('RAG Context');
    expect(deriveSkillName('llm-output.md')).toBe('LLM Output');
    expect(deriveSkillName('wcag-2-2.md')).toBe('WCAG 2 2');
    // Ordinary words are not treated as acronyms.
    expect(deriveSkillName('machine-learning.md')).toBe('Machine Learning');
    expect(deriveSkillName('product-discovery.md')).toBe('Product Discovery');
  });

  it('uses the folder name for generic file names', () => {
    expect(deriveSkillName('canvas-design/SKILL.md')).toBe('Canvas Design');
    expect(deriveSkillName('docs/index.md')).toBe('Docs');
  });

  it('handles single-word names', () => {
    expect(prettifyName('compose')).toBe('Compose');
    expect(prettifyName('a-b-c')).toBe('A B C');
  });
});

describe('category tree', () => {
  const { tree, skills } = parseRepositoryTree(SAMPLE_TREE, { config, rootName: 'Skills' });

  it('builds the root with children sorted', () => {
    expect(tree.name).toBe('Skills');
    expect(tree.children.map((c) => c.name)).toEqual([
      'Android',
      'Database',
      'General',
      'Web Development',
    ]);
    expect(tree.totalSkills).toBe(skills.length);
  });

  it('aggregates totals per node', () => {
    const android = tree.children.find((c) => c.name === 'Android')!;
    expect(android.totalSkills).toBe(4);
    const compose = android.children.find((c) => c.name === 'Jetpack Compose')!;
    expect(compose.totalSkills).toBe(2);
    expect(collectSkillIds(compose)).toHaveLength(2);
  });

  it('finds nodes by id', () => {
    expect(findNodeById(tree, 'Web Development/Frontend')?.name).toBe('Frontend');
    expect(findNodeById(tree, 'nope')).toBeNull();
  });

  it('counts distinct categories', () => {
    expect(countCategories(skills)).toBe(8);
  });

  it('collects every skill id from the root', () => {
    expect(collectSkillIds(tree).sort()).toEqual(skills.map((s) => s.id).sort());
  });
});

describe('sortSkillsForCompilation', () => {
  it('orders by category, then name, then path', () => {
    const items = [
      { categories: ['B'], name: 'Zeta', path: 'B/zeta.md' },
      { categories: ['A'], name: 'Beta', path: 'A/beta.md' },
      { categories: ['A'], name: 'Alpha', path: 'A/alpha.md' },
      { categories: ['A'], name: 'Alpha', path: 'A/alpha-2.md' },
    ];
    expect(sortSkillsForCompilation(items).map((i) => i.path)).toEqual([
      'A/alpha-2.md',
      'A/alpha.md',
      'A/beta.md',
      'B/zeta.md',
    ]);
  });

  it('is stable for the same input', () => {
    const { skills } = parseRepositoryTree(SAMPLE_TREE, { config });
    expect(sortSkillsForCompilation(skills)).toEqual(sortSkillsForCompilation([...skills].reverse()));
  });
});

describe('validateRepoConfig', () => {
  it('accepts a sane repository', () => {
    expect(validateRepoConfig(config)).toEqual([]);
    expect(validateRepoConfig({ ...config, owner: 'some-user', repo: 'my_skills.v2' })).toEqual([]);
  });

  it('rejects invalid values', () => {
    expect(validateRepoConfig({ ...config, owner: '' })).not.toEqual([]);
    expect(validateRepoConfig({ ...config, repo: 'has space' })).not.toEqual([]);
    expect(validateRepoConfig({ ...config, rootDir: '../escape' })).not.toEqual([]);
    expect(validateRepoConfig({ ...config, branch: 'two words' })).not.toEqual([]);
  });
});

describe('buildCategoryTree', () => {
  it('handles an empty catalogue', () => {
    const tree = buildCategoryTree([], 'Empty');
    expect(tree.totalSkills).toBe(0);
    expect(tree.children).toEqual([]);
  });
});
