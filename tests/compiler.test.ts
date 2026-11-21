import { describe, expect, it } from 'vitest';
import {
  CompileError,
  compileSkillSources,
  countLines,
  createBoundaryToken,
  extractSkills,
  formatTimestamp,
  verifySources,
} from '../src/core/compiler';
import { sha256 } from '../src/core/hash';
import type { CompileOptions, SkillSource } from '../src/shared/types';

const OPTIONS: CompileOptions = {
  owner: 'LM-Arena',
  repo: 'LM-Arena-Skills',
  branch: 'main',
  rootDir: 'skills',
  now: new Date('2026-11-21T10:00:00Z'),
};

const skill = (
  path: string,
  content: string,
  categories?: string[],
): SkillSource => {
  const segs = categories ?? path.split('/').slice(0, -1);
  const file = path.split('/').pop() ?? path;
  return {
    id: encodeURIComponent(path),
    name: file.replace(/\.md$/, '').replace(/[-_]/g, ' '),
    path,
    categories: segs,
    content,
  };
};

describe('compileSkillSources — content preservation', () => {
  it('preserves a single skill exactly', () => {
    const content = '# Kotlin Standards\n\nUse 4 spaces.\n\n```kotlin\nfun main() { println("hi") }\n```\n';
    const { pkg } = compileSkillSources([skill('Android/Kotlin/kotlin-standards.md', content)], OPTIONS);
    const extracted = extractSkills(pkg.markdown);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]!.content).toBe(content);
  });

  it('preserves multiple skills from different categories exactly', () => {
    const sources = [
      skill('Android/Kotlin/coroutines.md', '# Coroutines\n\n- suspend\n- flow\n'),
      skill('Web/Frontend/react.md', '## React\n\n| a | b |\n|---|---|\n| 1 | 2 |\n'),
      skill('General/pm.md', 'Plain text, no trailing newline'),
    ];
    const { pkg } = compileSkillSources(sources, OPTIONS);
    const extracted = extractSkills(pkg.markdown);
    const byId = new Map(extracted.map((e) => [e.skillId, e.content]));
    for (const source of sources) expect(byId.get(source.id)).toBe(source.content);
    expect(pkg.totals.skills).toBe(3);
  });

  it('preserves unicode content byte-for-byte', () => {
    const content = '# Réseau & Sécurité 🚀\n\n日本語のテキスト — em-dash — emoji 🧩\n\nΟΔΟΣ\n';
    const { pkg } = compileSkillSources([skill('Réseau/réseau.md', content)], OPTIONS);
    expect(extractSkills(pkg.markdown)[0]!.content).toBe(content);
    expect(sha256(pkg.skills[0]!.sha256)).toBeDefined();
    expect(pkg.skills[0]!.bytes).toBe(new TextEncoder().encode(content).length);
  });

  it('preserves code blocks, tables and HTML comments', () => {
    const content = [
      '# Code',
      '',
      '````md',
      '```js',
      'const x = `template ${"x"}`;',
      '```',
      '````',
      '',
      '| left | right |',
      '|:-----|------:|',
      '| `a|b` | **bold** |',
      '',
      '<!-- an ordinary html comment -->',
      '',
      '<div align="center">centered</div>',
      '',
    ].join('\n');
    const { pkg } = compileSkillSources([skill('Code/code.md', content)], OPTIONS);
    expect(extractSkills(pkg.markdown)[0]!.content).toBe(content);
  });

  it('preserves empty files', () => {
    const { pkg } = compileSkillSources([skill('Empty/empty.md', '')], OPTIONS);
    const extracted = extractSkills(pkg.markdown);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]!.content).toBe('');
    expect(pkg.skills[0]!.lines).toBe(0);
  });

  it('preserves files containing SkillBridge-looking text and previous boundaries', () => {
    const content = [
      '<!-- SKILLBRIDGE:BEGIN:SB-20200101-DEADBEEF:0001:ABCDEF0123456789:foo -->',
      'not a real block',
      '<!-- SKILLBRIDGE:END:SB-20200101-DEADBEEF:0001:ABCDEF0123456789:foo -->',
      'SKILLBRIDGE PACKAGE',
      '## SKILL METADATA',
    ].join('\n');
    const { pkg } = compileSkillSources([skill('Meta/meta.md', content)], OPTIONS);
    const extracted = extractSkills(pkg.markdown);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]!.content).toBe(content);
  });

  it('preserves a UTF-8 BOM and CRLF line endings exactly (byte level)', () => {
    const cases = [
      '\uFEFF# Title\r\n\r\nline\r\n', // BOM + CRLF
      'no trailing newline',
      '\n\n\nleading blanks\n\n',
      '\uFEFF\uFEFFdouble bom',
      'tab\there\r\n',
      '', // empty file
    ];
    const size = (text: string) => new TextEncoder().encode(text).length;
    const sources = cases.map((content, i) => ({
      id: encodeURIComponent(`skills/S${i}.md`),
      name: `S${i}`,
      path: `skills/S${i}.md`,
      categories: ['skills'],
      content,
    }));
    const { pkg } = compileSkillSources(sources, OPTIONS);
    const extracted = extractSkills(pkg.markdown);
    expect(extracted).toHaveLength(cases.length);
    for (const entry of extracted) {
      const source = sources.find((s) => s.id === entry.skillId)!;
      // Same UTF-8 byte sequence, not merely the same visible text.
      expect(Array.from(new TextEncoder().encode(entry.content))).toEqual(
        Array.from(new TextEncoder().encode(source.content)),
      );
      expect(size(entry.content)).toBe(size(source.content));
    }
    // The BOM of the first file is still the first character after the marker line.
    expect(extracted[0]!.content.startsWith('\uFEFF# Title\r\n')).toBe(true);
  });

  it('preserves CRLF line endings and trailing blank lines', () => {
    const content = 'line one\r\nline two\r\n\r\n\r\n';
    const { pkg } = compileSkillSources([skill('Win/crlf.md', content)], OPTIONS);
    expect(extractSkills(pkg.markdown)[0]!.content).toBe(content);
  });

  it('preserves a very large markdown file (1.5 MB)', () => {
    const block = '## Section\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n```js\nconsole.log("block");\n```\n\n';
    const content = block.repeat(Math.ceil(1_500_000 / block.length));
    const t0 = performance.now();
    const { pkg } = compileSkillSources([skill('Large/huge.md', content)], OPTIONS);
    const elapsed = performance.now() - t0;
    expect(extractSkills(pkg.markdown)[0]!.content).toBe(content);
    expect(pkg.totals.bytes).toBe(new TextEncoder().encode(content).length);
    expect(elapsed).toBeLessThan(5000);
  });

  it('preserves many skills at once (120 files)', () => {
    const sources = Array.from({ length: 120 }, (_, i) =>
      skill(`Cat${i % 6}/Sub${i % 3}/file-${i}.md`, `# Skill ${i}\n\ncontent ${i}\n`),
    );
    const { pkg } = compileSkillSources(sources, OPTIONS);
    const extracted = extractSkills(pkg.markdown);
    expect(extracted).toHaveLength(120);
    const byId = new Map(extracted.map((e) => [e.skillId, e.content]));
    for (const source of sources) {
      expect(byId.get(source.id)).toBe(source.content);
    }
  });

  it('keeps blank lines inside original content', () => {
    const content = 'a\n\n\n\nb\n\n\n';
    const { pkg } = compileSkillSources([skill('Blank/blank.md', content)], OPTIONS);
    expect(extractSkills(pkg.markdown)[0]!.content).toBe(content);
    expect(extractSkills(pkg.markdown)[0]!.content.split('\n')).toHaveLength(8);
  });
});

describe('compileSkillSources — package structure', () => {
  const sources = [
    skill('Web/Frontend/react.md', '# React\n'),
    skill('Android/Kotlin/kotlin.md', '# Kotlin\n'),
    skill('Android/Kotlin/coroutines.md', '# Coroutines\n'),
  ];

  it('emits the required header metadata', () => {
    const { pkg } = compileSkillSources(sources, OPTIONS);
    expect(pkg.markdown.startsWith('# SKILLBRIDGE PACKAGE\n')).toBe(true);
    expect(pkg.markdown).toContain(`Package ID: ${pkg.packageId}`);
    expect(pkg.markdown).toContain('Repository: LM-Arena/LM-Arena-Skills');
    expect(pkg.markdown).toContain('Branch: main');
    expect(pkg.markdown).toContain('Compilation Date: 2026-11-21T10:00:00Z');
    expect(pkg.markdown).toContain('Total Skills: 3');
    expect(pkg.markdown).toContain('## SKILL METADATA');
    expect(pkg.markdown.trimEnd().endsWith('<!-- SKILLBRIDGE PACKAGE END -->')).toBe(true);
  });

  it('records metadata for each skill', () => {
    const { pkg } = compileSkillSources(sources, OPTIONS);
    expect(pkg.markdown).toContain('Source File: Android/Kotlin/coroutines.md');
    expect(pkg.markdown).toContain('Category: Android / Kotlin');
    expect(pkg.markdown).toContain('Category: Web / Frontend');
  });

  it('sorts deterministically by category, then name, then path', () => {
    const { pkg } = compileSkillSources(sources, OPTIONS);
    expect(pkg.skills.map((s) => s.path)).toEqual([
      'Android/Kotlin/coroutines.md',
      'Android/Kotlin/kotlin.md',
      'Web/Frontend/react.md',
    ]);
    const shuffled = [sources[2]!, sources[0]!, sources[1]!];
    expect(compileSkillSources(shuffled, OPTIONS).pkg.markdown).toBe(pkg.markdown);
  });

  it('uses distinctive BEGIN/END boundaries with a unique token', () => {
    const { pkg } = compileSkillSources(sources, OPTIONS);
    const token = /Boundary Token: ([A-F0-9]+)/.exec(pkg.markdown)?.[1];
    expect(token).toMatch(/^[A-F0-9]{16}$/);
    for (let i = 1; i <= 3; i++) {
      expect(pkg.markdown).toContain(`<!-- SKILLBRIDGE:BEGIN:${pkg.packageId}:000${i}:${token}:`);
      expect(pkg.markdown).toContain(`<!-- SKILLBRIDGE:END:${pkg.packageId}:000${i}:${token}:`);
    }
  });

  it('uses identical tokens across identical packages and different ones otherwise', () => {
    const a = createBoundaryToken('SB-1', ['x', 'y']);
    const b = createBoundaryToken('SB-1', ['x', 'y']);
    const c = createBoundaryToken('SB-1', ['x', 'z']);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('avoids boundary collisions with crafted content', () => {
    // Force a token that the content already contains by searching for one.
    const base = compileSkillSources([skill('A/a.md', 'x')], OPTIONS).pkg;
    const token = /Boundary Token: ([A-F0-9]+)/.exec(base.markdown)![1]!;
    const hostile = `content\nSKILLBRIDGE:BEGIN:${token}\nmore`;
    const { pkg } = compileSkillSources(
      [skill('Evil/evil.md', hostile)],
      { ...OPTIONS, packageId: 'SB-20261121-AAAAAAAA' },
    );
    const extracted = extractSkills(pkg.markdown);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]!.content).toBe(hostile);
  });

  it('survives a fuzz sweep of hostile content without losing or mangling a byte', () => {
    // Every one of these tries to impersonate a boundary, a heading, or a
    // separator. None may leak into the extracted content or break parsing.
    const pieces = [
      '<!-- SKILLBRIDGE:BEGIN:SB-1:0000:DEADBEEF:skills%2FA%2Fa.md -->',
      '<!-- SKILLBRIDGE:END:SB-1:0000:DEADBEEF:skills%2FA%2Fa.md -->',
      '## SKILL METADATA',
      '## SKILL MANIFEST',
      '- Hash (sha256): ' + '0'.repeat(64),
      '# SKILLBRIDGE PACKAGE',
      '---',
      '```',
      '\u0000\u0001 control bytes',
      '\r\nCRLF\r\n',
      '   ',
      '',
      '\u{1F680} emoji \u2014 en/em dashes \u00e9\u00e8\u00ea',
    ];
    const hostile = pieces.join('\n');
    const sources = pieces.map((piece, i) =>
      skill(`Evil/s${String(i).padStart(2, '0')}.md`, piece === '' ? ' ' : piece),
    );
    const { pkg } = compileSkillSources(sources, { ...OPTIONS, packageId: 'SB-20261121-FUZZFUZZ' });
    const extracted = extractSkills(pkg.markdown);
    expect(extracted).toHaveLength(sources.length);
    const byId = new Map(extracted.map((entry) => [entry.skillId, entry.content]));
    for (const source of sources) {
      expect(byId.get(source.id)).toBe(source.content);
    }
    // The joined blob is also preserved inside its own single skill.
    const blobSource = skill('Evil/blob.md', hostile);
    const single = compileSkillSources([blobSource], { ...OPTIONS, packageId: 'SB-20261121-FUZZFUZZ' });
    expect(extractSkills(single.pkg.markdown)[0]!.content).toBe(hostile);
  });

  it('contains an integrity manifest with hashes and sizes', () => {
    const { pkg } = compileSkillSources(sources, OPTIONS);
    expect(pkg.markdown).toContain('## SKILL MANIFEST');
    expect(pkg.markdown).toContain('| # | Skill | Category | Source file | Bytes | Lines | SHA-256 |');
    for (const entry of pkg.skills) {
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(pkg.markdown).toContain(entry.sha256.slice(0, 16));
      expect(entry.chars).toBeGreaterThan(0);
      expect(entry.bytes).toBeGreaterThan(0);
    }
  });

  it('computes the manifest totals from the original content', () => {
    const { pkg } = compileSkillSources(sources, OPTIONS);
    expect(pkg.totals.skills).toBe(3);
    expect(pkg.totals.bytes).toBe(
      sources.reduce((sum, s) => sum + new TextEncoder().encode(s.content).length, 0),
    );
    expect(pkg.totals.lines).toBe(3);
    expect(pkg.totals.categories).toBe(2);
  });

  it('assigns deterministic package ids for identical input', () => {
    const a = compileSkillSources(sources, OPTIONS).pkg.packageId;
    const b = compileSkillSources([...sources].reverse(), OPTIONS).pkg.packageId;
    expect(a).toBe(b);
    expect(a).toMatch(/^SB-20261121-[A-F0-9]{8}$/);
    const other = compileSkillSources([skill('X/x.md', 'different')], OPTIONS).pkg.packageId;
    expect(other).not.toBe(a);
  });

  it('produces a markdown file name derived from the package id', () => {
    const { pkg } = compileSkillSources(sources, OPTIONS);
    expect(pkg.fileName).toMatch(/^skillbridge-package-[a-f0-9]{8}\.md$/);
    expect(pkg.fileName).toContain(pkg.packageId.split('-')[2]!.toLowerCase());
  });

  it('flags integrity mismatches when content changed after discovery', () => {
    const expected = { [sources[0]!.id]: sha256('different content') };
    const result = compileSkillSources(sources, OPTIONS, expected);
    expect(result.verification.ok).toBe(false);
    expect(result.verification.changed).toContain(sources[0]!.id);
    expect(result.pkg.markdown).toContain('Integrity: CHANGED SINCE DISCOVERY');
  });

  it('marks skills without expected hashes as unverified', () => {
    const result = compileSkillSources(sources, OPTIONS, {});
    expect(result.verification.ok).toBe(true);
    expect(result.verification.unverified).toHaveLength(3);
  });

  it('verifySources reports matches and mismatches', () => {
    const [a] = sources;
    const ok = verifySources([a!], { [a!.id]: sha256(a!.content) });
    expect(ok.ok).toBe(true);
    const bad = verifySources([a!], { [a!.id]: sha256('nope') });
    expect(bad.changed).toEqual([a!.id]);
  });

  it('rejects an empty selection', () => {
    expect(() => compileSkillSources([], OPTIONS)).toThrow(CompileError);
    expect(() => compileSkillSources([], OPTIONS)).toThrow(/Select at least one skill/);
  });

  it('rejects duplicate skills', () => {
    const a = skill('A/a.md', 'x');
    expect(() => compileSkillSources([a, a], OPTIONS)).toThrow(/Duplicate skill/);
  });

  it('records the root directory', () => {
    const { pkg } = compileSkillSources(sources, OPTIONS);
    expect(pkg.markdown).toContain('Root Directory: skills');
    const rootless = compileSkillSources(sources, { ...OPTIONS, rootDir: '' }).pkg;
    expect(rootless.markdown).toContain('Root Directory: /');
  });
});

describe('helpers', () => {
  it('countLines matches intuitive semantics', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('\n')).toBe(1);
    expect(countLines('\n\n')).toBe(2);
  });

  it('formats timestamps deterministically', () => {
    expect(formatTimestamp(new Date('2026-11-21T10:00:00.123Z'))).toBe('2026-11-21T10:00:00Z');
  });

  it('falls back to a safe date for invalid input', () => {
    const { pkg } = compileSkillSources([skill('A/a.md', 'x')], { ...OPTIONS, now: 'not-a-date' });
    expect(pkg.compiledAt).toBe('1970-01-01T00:00:00Z');
  });
});
