/**
 * Skill preview panel. Shows the original Markdown rendered safely, plus a raw
 * view. The content is fetched by id and never modified.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SelectionState, SkillEntry } from '../../shared/types';
import { isSkillSelected } from '../../core/selection';
import { renderMarkdown, markdownStats } from '../lib/markdown';
import { copyText } from '../lib/files';
import { Button, IconButton } from './Button';
import { Checkbox } from './Checkbox';
import { IconCopy, IconX, IconCheck } from './Icons';
import { formatBytes } from '../../shared/format';

export interface SkillPreviewProps {
  skill: SkillEntry;
  selection: SelectionState;
  onToggleSelected: (skill: SkillEntry, selected: boolean) => void;
  onClose: () => void;
  loadContent: (id: string) => Promise<string>;
  copy: (text: string) => Promise<boolean>;
  onCopied: (ok: boolean) => void;
}

type ViewMode = 'rendered' | 'raw';

export function SkillPreview({
  skill,
  selection,
  onToggleSelected,
  onClose,
  loadContent,
  copy,
  onCopied,
}: SkillPreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('rendered');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    setMode('rendered');
    setCopied(false);
    loadContent(skill.id)
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [skill.id, loadContent]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node && typeof node.scrollTo === 'function') node.scrollTo({ top: 0 });
  }, [skill.id, mode]);

  const html = useMemo(() => (content !== null ? renderMarkdown(content) : ''), [content]);
  const stats = useMemo(() => (content !== null ? markdownStats(content) : null), [content]);
  const bytes = content !== null ? new TextEncoder().encode(content).length : 0;
  const selected = isSkillSelected(selection, skill.id);

  const handleCopy = async () => {
    if (content === null) return;
    const ok = await copy(content);
    onCopied(ok);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <aside className="preview" aria-label={`Preview of ${skill.name}`}>
      <div className="preview__head">
        <div className="preview__titles">
          <h2 className="preview__title">{skill.name}</h2>
          <p className="preview__path" title={skill.path}>
            {skill.path}
          </p>
          <p className="preview__category">{skill.categoryLabel || 'Root'}</p>
        </div>
        <IconButton label="Close preview" onClick={onClose}>
          <IconX size={15} />
        </IconButton>
      </div>

      <div className="preview__toolbar">
        <div className="segmented" role="tablist" aria-label="Preview mode">
          <button
            role="tab"
            aria-selected={mode === 'rendered'}
            className={mode === 'rendered' ? 'is-active' : undefined}
            onClick={() => setMode('rendered')}
          >
            Rendered
          </button>
          <button
            role="tab"
            aria-selected={mode === 'raw'}
            className={mode === 'raw' ? 'is-active' : undefined}
            onClick={() => setMode('raw')}
          >
            Source
          </button>
        </div>
        <div className="preview__stats" aria-live="off">
          {stats && (
            <>{(bytes || skill.size)} bytes · {stats.lines} lines</>
          )}
          {!stats && skill.size > 0 && <>{formatBytes(skill.size)}</>}
        </div>
        <IconButton label={copied ? 'Copied' : 'Copy original Markdown'} onClick={handleCopy} disabled={content === null}>
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </IconButton>
      </div>

      <div className="preview__body" ref={scrollRef}>
        {error && (
          <div className="preview__error" role="alert">
            <strong>Could not load this skill.</strong>
            <p>{error}</p>
            <p className="muted">Check your connection, then refresh the repository and try again.</p>
          </div>
        )}
        {!error && content === null && (
          <div className="preview__loading">
            <span className="spinner" aria-hidden="true" />
            <span>Loading original Markdown…</span>
          </div>
        )}
        {!error && content !== null && mode === 'rendered' && (
          // Rendered by a renderer that escapes all source HTML (see markdown.ts).
          <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
        )}
        {!error && content !== null && mode === 'raw' && (
          <pre className="preview__raw">
            <code>{content}</code>
          </pre>
        )}
      </div>

      <div className="preview__foot">
        <label className="preview__select">
          <Checkbox
            state={selected ? 'checked' : 'unchecked'}
            onChange={(next) => onToggleSelected(skill, next)}
            label={`Select ${skill.name}`}
          />
          <span>{selected ? 'Selected' : 'Select this skill'}</span>
        </label>
        <Button
          variant={selected ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => onToggleSelected(skill, !selected)}
        >
          {selected ? 'Remove from selection' : 'Add to selection'}
        </Button>
      </div>
    </aside>
  );
}
