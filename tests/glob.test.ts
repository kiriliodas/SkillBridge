import { describe, expect, it } from 'vitest';
import { compilePatterns, globToRegExp, isExcluded, normalizePath } from '../src/core/glob';

const excluded = (path: string, patterns: string[]) => isExcluded(path, compilePatterns(patterns));

describe('globToRegExp', () => {
  it('translates * without crossing folders', () => {
    expect(globToRegExp('*.md').test('a.md')).toBe(true);
    expect(globToRegExp('*.md').test('a/b.md')).toBe(false);
    expect(globToRegExp('docs/*.md').test('docs/a.md')).toBe(true);
  });

  it('translates ** across folders', () => {
    expect(globToRegExp('**/*.md').test('a/b/c.md')).toBe(true);
    expect(globToRegExp('**/*.md').test('c.md')).toBe(true);
    expect(globToRegExp('**/README.md').test('README.md')).toBe(true);
    expect(globToRegExp('a/**/z.md').test('a/z.md')).toBe(true);
    expect(globToRegExp('a/**/z.md').test('a/b/c/z.md')).toBe(true);
  });

  it('escapes regex characters', () => {
    expect(globToRegExp('a+b.md').test('a+b.md')).toBe(true);
    expect(globToRegExp('a+b.md').test('aab.md')).toBe(false);
  });
});

describe('isExcluded', () => {
  it('returns false without patterns', () => {
    expect(excluded('a/b.md', [])).toBe(false);
  });

  it('matches full paths', () => {
    expect(excluded('Android/Kotlin/draft.md', ['Android/Kotlin/draft.md'])).toBe(true);
    expect(excluded('Android/Kotlin/other.md', ['Android/Kotlin/draft.md'])).toBe(false);
  });

  it('matches name-style patterns against any segment', () => {
    expect(excluded('README.md', ['README.md'])).toBe(true);
    expect(excluded('Android/README.md', ['**/README.md'])).toBe(true);
    expect(excluded('Android/Kotlin/LICENSE.txt', ['LICENSE*'])).toBe(true);
    expect(excluded('a/b/node_modules/x/y.md', ['node_modules'])).toBe(true);
  });

  it('excludes an entire directory subtree', () => {
    expect(excluded('drafts/x/y.md', ['drafts/**'])).toBe(true);
    expect(excluded('drafts/x/y.md', ['drafts'])).toBe(true);
    expect(excluded('notdrafts/x.md', ['drafts'])).toBe(false);
  });

  it('supports unicode and spaces in patterns', () => {
    expect(excluded('Web Développement/Brouillon.md', ['Web Développement/Brouillon.md'])).toBe(true);
    expect(excluded('réseau/secrets.md', ['réseau/**'])).toBe(true);
  });

  it('supports ? single-character wildcards', () => {
    expect(excluded('v1.md', ['v?.md'])).toBe(true);
    expect(excluded('v10.md', ['v?.md'])).toBe(false);
  });

  it('normalises separators and leading slashes', () => {
    expect(normalizePath('/a//b/')).toBe('a/b');
    expect(normalizePath('./a/b')).toBe('a/b');
    expect(normalizePath('a\\b')).toBe('a/b');
    expect(excluded('a/b.md', ['/a/b.md'])).toBe(true);
  });
});
