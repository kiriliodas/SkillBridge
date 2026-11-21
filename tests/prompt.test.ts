import { describe, expect, it } from 'vitest';
import { compileSkillSources } from '../src/core/compiler';
import { buildCategoryLines, buildNameList, generateInstallPrompt } from '../src/core/prompt';
import type { CompileOptions, SkillSource } from '../src/shared/types';

const OPTIONS: CompileOptions = {
  owner: 'LM-Arena',
  repo: 'LM-Arena-Skills',
  branch: 'main',
  rootDir: 'skills',
  now: new Date('2026-11-21T10:00:00Z'),
};

const skill = (path: string, content = '# content\n'): SkillSource => {
  const segments = path.split('/');
  return {
    id: path,
    name: (segments.pop() ?? path).replace(/\.md$/, ''),
    path,
    categories: segments,
    content,
  };
};

const pkgFor = (paths: string[]) =>
  compileSkillSources(paths.map((p) => skill(p)), OPTIONS).pkg;

describe('generateInstallPrompt', () => {
  it('works with a single skill', () => {
    const pkg = pkgFor(['General/project-management.md']);
    const prompt = generateInstallPrompt(pkg);
    expect(prompt).toContain('File: skillbridge-package-');
    expect(prompt).toContain(pkg.fileName);
    expect(prompt).toContain('Package ID: ' + pkg.packageId);
    expect(prompt).toContain('Skills: 1');
    expect(prompt).toContain('Categories: 1');
    expect(prompt).toContain('- project-management');
  });

  it('works with multiple skills and different categories', () => {
    const pkg = pkgFor([
      'Android/Kotlin/kotlin-standards.md',
      'Android/Kotlin/coroutines.md',
      'Web/Frontend/react-best-practices.md',
      'Database/SQL/sql-best-practices.md',
    ]);
    const prompt = generateInstallPrompt(pkg);
    expect(prompt).toContain('Skills: 4');
    expect(prompt).toContain('Categories: 3');
    expect(prompt).toContain('- Android / Kotlin (2)');
    expect(prompt).toContain('- Database / SQL (1)');
    expect(prompt).toContain('- Web / Frontend (1)');
    expect(prompt).toContain('kotlin-standards');
    expect(prompt).toContain('react-best-practices');
  });

  it('contains every required installation instruction', () => {
    const prompt = generateInstallPrompt(pkgFor(['A/B/x.md']));
    expect(prompt).toMatch(/Read the entire attached package/);
    expect(prompt).toMatch(/category hierarchy/i);
    expect(prompt).toMatch(/`skills\//);
    expect(prompt).toMatch(/one Markdown file per skill/i);
    expect(prompt).toMatch(/byte-for-byte|Do not summarise/);
    expect(prompt).toMatch(/INDEX\.md/);
    expect(prompt).toMatch(/README\.md/);
    expect(prompt).toMatch(/selection mechanism|relevant/i);
    expect(prompt).toMatch(/Do not load unrelated skills/i);
    expect(prompt).toMatch(/conflicting instructions/i);
    expect(prompt).toMatch(/verifying the installation|verify/i);
  });

  it('does not hardcode any skill or category name', () => {
    const prompts = [
      generateInstallPrompt(pkgFor(['Android/Kotlin/coroutines.md'])),
      generateInstallPrompt(pkgFor(['Zeta/Omega/final-skill.md'])),
    ];
    for (const prompt of prompts) {
      expect(prompt).not.toMatch(/Kotlin Standards|react-best-practices|Android \/ Kotlin \(2\)/);
    }
    expect(prompts[1]).toContain('- Zeta / Omega (1)');
    expect(prompts[1]).toContain('- final-skill');
  });

  it('handles large packages by compacting the listings', () => {
    const paths = Array.from({ length: 120 }, (_, i) => `Cat${i}/skill-${i}.md`);
    const pkg = pkgFor(paths);
    const prompt = generateInstallPrompt(pkg, { maxListedSkills: 20, maxListedCategories: 20 });
    expect(prompt).toContain('Skills: 120');
    expect(prompt).toContain('... and 100 more');
    expect(prompt.length).toBeLessThan(8000);
  });

  it('buildNameList truncates long lists', () => {
    const list = buildNameList(Array.from({ length: 10 }, (_, i) => `S${i}`), 3);
    expect(list.split('\n')).toHaveLength(4);
    expect(list).toContain('... and 7 more');
  });

  it('buildCategoryLines counts skills per category', () => {
    const pkg = pkgFor(['A/x.md', 'A/y.md', 'B/z.md']);
    expect(buildCategoryLines(pkg.skills, 10)).toEqual(['- A (2)', '- B (1)']);
  });

  it('is stable for identical packages', () => {
    const a = generateInstallPrompt(pkgFor(['A/x.md', 'B/y.md']));
    const b = generateInstallPrompt(pkgFor(['B/y.md', 'A/x.md']));
    expect(a).toBe(b);
  });
});
