/**
 * Small, dependency-free glob matcher for exclude patterns.
 *
 * Supported syntax:
 *   *      any run of characters except "/"
 *   ?      single character except "/"
 *   **     any run of characters including "/" (globstar)
 *
 * Patterns are matched against a repository-relative path (POSIX separators).
 * A pattern without a "/" is also matched against every individual path
 * segment, which makes `LICENSE*` or `.github` behave like .gitignore-style
 * name filters. Patterns ending with "/" are treated as directory prefixes.
 */

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function globToRegExp(glob: string): RegExp {
  let pattern = glob.trim();
  if (!pattern) return /$^/;

  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i]!;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // globstar: swallow an optional following slash so "**/x" also matches "x"
        if (pattern[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 3;
          continue;
        }
        out += '.*';
        i += 2;
        continue;
      }
      out += '[^/]*';
      i += 1;
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      i += 1;
      continue;
    }
    out += escapeRegExp(ch);
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

export interface CompiledPattern {
  source: string;
  regex: RegExp;
  /** Matched against every path segment instead of the full path. */
  segment: boolean;
  /** Pattern was written with a trailing slash (directory-only). */
  directoryOnly: boolean;
}

export function compilePatterns(patterns: string[]): CompiledPattern[] {
  return patterns
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((source) => {
      const directoryOnly = source.endsWith('/');
      const trimmed = directoryOnly ? source.replace(/\/+$/, '') : source;
      const cleaned = trimmed.replace(/^\.?\//, '');
      return {
        source: cleaned,
        regex: globToRegExp(cleaned),
        segment: !cleaned.includes('/'),
        directoryOnly,
      };
    });
}

/** Normalise user input: forward slashes, no leading "./" or "/", collapse "//". */
export function normalizePath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

/**
 * True when the path (or one of its ancestor directories) matches an exclude
 * pattern. Excluding a directory excludes everything beneath it.
 */
export function isExcluded(
  path: string,
  compiled: CompiledPattern[],
  kind: 'file' | 'directory' = 'file',
): boolean {
  if (!compiled.length) return false;
  const clean = normalizePath(path);
  if (!clean) return false;
  const segments = clean.split('/');

  const testPattern = (pattern: CompiledPattern, candidate: string): boolean => {
    if (pattern.directoryOnly && kind === 'file' && candidate === clean) return false;
    if (pattern.regex.test(candidate)) return true;
    // Name-style patterns (no slash) can also match with a "**/" prefix implied
    return false;
  };

  // Ancestors: a pattern matching a directory excludes its whole subtree.
  for (let depth = 1; depth < segments.length; depth++) {
    const ancestor = segments.slice(0, depth).join('/');
    const ancestorName = segments[depth - 1]!;
    for (const pattern of compiled) {
      if (pattern.segment ? pattern.regex.test(ancestorName) : pattern.regex.test(ancestor)) {
        return true;
      }
    }
  }

  const name = segments[segments.length - 1]!;
  for (const pattern of compiled) {
    if (pattern.segment) {
      if (pattern.regex.test(name)) return true;
    } else if (pattern.regex.test(clean)) {
      return true;
    }
    // Full-path patterns such as "Android/**/draft.md" should also match
    // when the user writes them without a leading "**/".
    if (!pattern.segment && !clean.startsWith('**/')) {
      if (pattern.regex.test(`**/${clean}`)) return true;
    }
    if (testPattern(pattern, clean)) return true;
  }
  return false;
}
