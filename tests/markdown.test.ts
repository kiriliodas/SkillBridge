import { describe, expect, it } from 'vitest';
import { escapeHtml, markdownStats, renderMarkdown, safeUrl } from '../src/ui/lib/markdown';

describe('renderMarkdown — structure', () => {
  it('renders headings, paragraphs and rules', () => {
    const html = renderMarkdown('# Title\n\nText here.\n\n---\n\n## Sub\n');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Text here.</p>');
    expect(html).toContain('<hr />');
    expect(html).toContain('<h2>Sub</h2>');
  });

  it('renders unordered and ordered lists with nesting', () => {
    const html = renderMarkdown('- one\n- two\n  - nested\n\n1. first\n2. second\n');
    expect(html).toContain('<ul><li>one</li><li>two</li><ul class="md-nested"><li>nested</li></ul></ul>');
    expect(html).toContain('<ol><li>first</li><li>second</li></ol>');
  });

  it('renders tables', () => {
    const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>2</td>');
  });

  it('renders fenced code blocks verbatim, without interpreting markup', () => {
    const html = renderMarkdown('```ts\nconst x = "<div>";\n```\n');
    expect(html).toContain('data-lang="ts"');
    expect(html).toContain('const x = &quot;&lt;div&gt;&quot;;');
    expect(html).not.toContain('<div>');
  });

  it('renders blockquotes recursively', () => {
    const html = renderMarkdown('> quoted **bold**\n');
    expect(html).toContain('<blockquote><p>quoted <strong>bold</strong></p></blockquote>');
  });

  it('renders inline formatting and code spans', () => {
    const html = renderMarkdown('a **bold** and *em* and `code <b>`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>em</em>');
    expect(html).toContain('<code>code &lt;b&gt;</code>');
  });

  it('handles empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});

describe('renderMarkdown — security', () => {
  it('escapes raw HTML instead of executing it', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>');
    // No executable element or attribute survives: the tag text is escaped and
    // the handler can only ever appear as literal text inside a <p>.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<[a-z]+[^>]*\son[a-z]+\s*=/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(2)&gt;');
  });

  it('blocks javascript: and data: link targets', () => {
    const html = renderMarkdown('[click](javascript:alert(1)) [data](data:text/html;base64,PHN2Zz4=)');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
    expect(html).toContain('click');
  });

  it('allows http(s), mailto, relative and anchor links with rel=noopener', () => {
    const html = renderMarkdown('[a](https://example.com) [b](mailto:x@y.z) [c](./docs/a.md) [d](#top)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="mailto:x@y.z"');
    expect(html).toContain('href="./docs/a.md"');
    expect(html).toContain('href="#top"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('never lets a URL terminate its attribute', () => {
    const html = renderMarkdown('[x](https://a.com/"onmouseover="alert(1))');
    // The quote is encoded (possibly as &amp;quot;), so it cannot close href=".
    expect(html).toMatch(/href="https:\/\/a\.com\/(&amp;|&)quot;onmouseover/);
    expect(html).not.toMatch(/href="[^"]*"\s*onmouseover/i);
    // No standalone event handler attribute can be introduced.
    expect(html).not.toMatch(/<a[^>]*\sonmouseover=/i);
    // Parsing the output confirms the anchor has exactly the expected attributes.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anchor = doc.querySelector('a')!;
    expect(anchor.getAttributeNames().sort()).toEqual(['href', 'rel', 'target']);
    expect(anchor.getAttribute('href')).not.toContain('"');
  });

  it('safeUrl rejects unknown schemes', () => {
    expect(safeUrl('vbscript:msgbox')).toBeNull();
    expect(safeUrl('  ')).toBeNull();
    expect(safeUrl('https://ok.dev')).toBe('https://ok.dev');
  });

  it('escapeHtml covers all critical characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('markdownStats', () => {
  it('counts lines, characters and words', () => {
    expect(markdownStats('a b\nc\n')).toEqual({ lines: 2, chars: 6, words: 3 });
    expect(markdownStats('')).toEqual({ lines: 0, chars: 0, words: 0 });
  });
});
