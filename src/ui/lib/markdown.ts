/**
 * Safe Markdown → HTML renderer for the Skill preview.
 *
 * Skills are untrusted data, so this renderer never emits raw HTML from the
 * source and escapes everything by default. It supports the subset of Markdown
 * that matters for review: headings, lists, tables, blockquotes, fenced code,
 * inline code, emphasis, links and horizontal rules. Raw HTML in the source is
 * shown verbatim as text, never executed.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Re-encode quotes that survived one escaping pass (used for URL attributes). */
function escapeAttribute(value: string): string {
  return value.replace(/&(amp;)?quot;/g, '&quot;').replace(/&(amp;)?#0?39;/g, '&#39;');
}

function inline(text: string): string {
  let out = escapeHtml(text);
  // Inline code first so its content is not further transformed.
  const codeSpans: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `\u0000CODE${codeSpans.length - 1}\u0000`;
  });
  out = out
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt: string, src: string) => {
      const safe = safeUrl(src);
      return safe ? `<img src="${safe}" alt="${alt}" loading="lazy" />` : alt;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, label: string, href: string) => {
      const safe = safeUrl(href);
      if (!safe) return label;
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])__([^_]+)__(?=[\s).,;:!?]|$)/g, '$1<strong>$2</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, index: string) => `<code>${codeSpans[Number(index)] ?? ''}</code>`);
  return out;
}

/** Only allow http(s), mailto and relative links; block javascript:/data:. */
export function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  // Never allow a quote to terminate the attribute it will be placed in.
  const cleaned = escapeAttribute(trimmed);
  if (/^(https?:|mailto:)/i.test(cleaned)) return escapeHtml(cleaned);
  if (/^[./#]/.test(cleaned)) return escapeHtml(cleaned);
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return null;
  return escapeHtml(cleaned);
}

interface CodeBlock {
  lang: string;
  lines: string[];
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let index = 0;

  const flushParagraph = (paragraph: string[]) => {
    if (paragraph.length === 0) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  };

  let paragraph: string[] = [];

  while (index < lines.length) {
    const line = lines[index]!;

    // Fenced code block
    const fence = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      flushParagraph(paragraph);
      paragraph = [];
      const indent = fence[1]!.length;
      const marker = fence[2]!;
      const lang = fence[3]!.trim().split(/\s+/)[0] ?? '';
      const block: CodeBlock = { lang, lines: [] };
      index++;
      while (index < lines.length) {
        const current = lines[index]!;
        const closing = new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`);
        if (closing.test(current)) {
          index++;
          break;
        }
        block.lines.push(indent > 0 ? current.slice(Math.min(indent, current.length)) : current);
        index++;
      }
      out.push(
        `<pre class="md-code"><code${block.lang ? ` data-lang="${escapeHtml(block.lang)}"` : ''}>${escapeHtml(
          block.lines.join('\n'),
        )}</code></pre>`,
      );
      continue;
    }

    // Blank line: paragraph boundary
    if (line.trim() === '') {
      flushParagraph(paragraph);
      paragraph = [];
      index++;
      continue;
    }

    // Horizontal rule
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushParagraph(paragraph);
      paragraph = [];
      out.push('<hr />');
      index++;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading && heading[1]!.length <= 6) {
      flushParagraph(paragraph);
      paragraph = [];
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!.replace(/\s+#+\s*$/, ''))}</h${level}>`);
      index++;
      continue;
    }

    // Table (header row followed by a separator row)
    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[index + 1]!)
    ) {
      flushParagraph(paragraph);
      paragraph = [];
      const parseRow = (row: string): string[] =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split(/(?<!\\)\|/)
          .map((cell) => cell.trim().replace(/\\\|/g, '|'));
      const headers = parseRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index]!.includes('|') && lines[index]!.trim() !== '') {
        rows.push(parseRow(lines[index]!));
        index++;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((row) => `<tr>${headers.map((_, i) => `<td>${inline(row[i] ?? '')}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      out.push(`<div class="md-table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    // Blockquote
    if (/^\s{0,3}>/.test(line)) {
      flushParagraph(paragraph);
      paragraph = [];
      const quote: string[] = [];
      while (index < lines.length && /^\s{0,3}>/.test(lines[index]!)) {
        quote.push(lines[index]!.replace(/^\s{0,3}>\s?/, ''));
        index++;
      }
      out.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
      continue;
    }

    // Lists (ul / ol), supporting one level of nesting via indentation
    const listMatch = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (listMatch) {
      flushParagraph(paragraph);
      paragraph = [];
      const ordered = /\d/.test(listMatch[2]!);
      const items: { content: string; nested: boolean }[] = [];
      const baseIndent = listMatch[1]!.length;
      while (index < lines.length) {
        const current = lines[index]!;
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(current);
        if (m) {
          items.push({ content: m[3]!, nested: m[1]!.length > baseIndent });
          index++;
          continue;
        }
        // Continuation line: belongs to the previous item.
        if (current.trim() !== '' && /^\s{2,}/.test(current) && items.length > 0) {
          const last = items[items.length - 1]!;
          last.content += ` ${current.trim()}`;
          index++;
          continue;
        }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      const html: string[] = [];
      let nestedOpen = false;
      for (const item of items) {
        if (item.nested && !nestedOpen) {
          html.push(`<ul class="md-nested">`);
          nestedOpen = true;
        } else if (!item.nested && nestedOpen) {
          html.push('</ul>');
          nestedOpen = false;
        }
        html.push(`<li>${inline(item.content)}</li>`);
      }
      if (nestedOpen) html.push('</ul>');
      out.push(`<${tag}>${html.join('')}</${tag}>`);
      continue;
    }

    paragraph.push(line.trim());
    index++;
  }

  flushParagraph(paragraph);
  return out.join('\n');
}

/** Plain-text statistics for the preview header. */
export function markdownStats(markdown: string): { lines: number; chars: number; words: number } {
  const chars = markdown.length;
  const lines = markdown === '' ? 0 : markdown.split('\n').length - (markdown.endsWith('\n') ? 1 : 0);
  const words = markdown.trim() === '' ? 0 : markdown.trim().split(/\s+/).length;
  return { lines, chars, words };
}
