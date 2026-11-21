/**
 * Result dialog for the LM Arena insertion flow. It is deliberately explicit
 * about what happened and always offers the fallback actions (download +
 * copy prompt) so a partial failure is never a dead end.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { CompiledPackageLite, IntegrationOutcome, IntegrationReport, StepResult } from '../lib/insertTypes';
import { Button } from './Button';
import { IconCheck, IconCheckCircle, IconAlert, IconDownload, IconCopy, IconX, IconInfo } from './Icons';
import { formatBytes } from '../../shared/format';

export interface InsertResultProps {
  report: IntegrationReport;
  pkg: CompiledPackageLite;
  prompt: string;
  onClose: () => void;
  onDownload: () => void;
  onCopyPrompt: () => void;
  copied: boolean;
}

const OUTCOME_COPY: Record<IntegrationOutcome, { title: string; tone: 'success' | 'warning' | 'error'; body: string }> = {
  sent: {
    title: 'Skills installed',
    tone: 'success',
    body: 'The package was attached, the installation prompt was verified and the message was sent.',
  },
  'attached-and-filled': {
    title: 'Ready to send',
    tone: 'success',
    body: 'The package is attached and the installation prompt is in the message input. Review it and press Send in LM Arena.',
  },
  'attached-only': {
    title: 'Package attached, prompt not inserted',
    tone: 'warning',
    body: 'The package was attached but the prompt could not be written into the message input. Copy it below and paste it manually.',
  },
  'prompt-only': {
    title: 'Prompt ready, package not attached',
    tone: 'warning',
    body: 'The prompt is in the message input, but the package could not be verified as attached. Download the package and attach it manually before sending.',
  },
  failed: {
    title: 'Integration unavailable',
    tone: 'error',
    body: 'SkillBridge could not reach the LM Arena interface. Nothing was sent. Use the fallback below to install the skills manually.',
  },
};

function StepIcon({ step }: { step: StepResult }) {
  if (step.status === 'ok') return <IconCheck size={13} />;
  if (step.status === 'failed') return <IconX size={13} />;
  if (step.status === 'warning') return <IconAlert size={13} />;
  return <span className="dot" aria-hidden="true" />;
}

export function InsertResult({ report, pkg, onClose, onDownload, onCopyPrompt, copied }: InsertResultProps) {
  const copy = OUTCOME_COPY[report.outcome];
  const fallbackNeeded = report.outcome !== 'sent' && report.outcome !== 'attached-and-filled';
  const diagnostics = useMemo(() => report.diagnostics, [report.diagnostics]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  // Move focus into the dialog, keep Tab inside it, restore it on close. The
  // dialog already claims aria-modal, so it must behave like one.
  useEffect(() => {
    previousFocus.current = document.activeElement;
    const node = dialogRef.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

    const first = focusables()[0];
    (first ?? node)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;
      if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      } else if (event.shiftKey && (active === firstItem || active === node)) {
        event.preventDefault();
        lastItem.focus();
      }
    };

    node?.addEventListener('keydown', onKeyDown);
    return () => {
      node?.removeEventListener('keydown', onKeyDown);
      const previous = previousFocus.current;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [onClose]);

  return (
    <div
      className="result"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className={`result__banner result__banner--${copy.tone}`} role={copy.tone === 'error' ? 'alert' : 'status'}>
        <span className="result__banner-icon">
          {copy.tone === 'success' ? <IconCheckCircle size={18} /> : <IconAlert size={18} />}
        </span>
        <div>
          <h2 className="result__title" id="result-title">
            {copy.title}
          </h2>
          <p className="result__subtitle">{copy.body}</p>
        </div>
      </div>

      <div className="result__body">
        <section className="result__section" aria-labelledby="result-package">
          <h3 id="result-package" className="result__heading">
            Package
          </h3>
          <dl className="kv">
            <div>
              <dt>File</dt>
              <dd>
                <code>{pkg.fileName}</code>
              </dd>
            </div>
            <div>
              <dt>Package ID</dt>
              <dd>
                <code>{pkg.packageId}</code>
              </dd>
            </div>
            <div>
              <dt>Skills</dt>
              <dd>
                {pkg.totals.skills} · {pkg.totals.categories} categories
              </dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(pkg.totals.bytes)}</dd>
            </div>
          </dl>
        </section>

        <section className="result__section" aria-labelledby="result-steps">
          <h3 id="result-steps" className="result__heading">
            Steps
          </h3>
          <ol className="steps">
            {report.steps.map((step, i) => (
              <li key={`${step.step}-${i}`} className={`step step--${step.status}`}>
                <span className="step__icon" aria-hidden="true">
                  <StepIcon step={step} />
                </span>
                <span className="step__label">{step.step.replace(/-/g, ' ')}</span>
                <span className="step__message">{step.message}</span>
              </li>
            ))}
          </ol>
        </section>

        {report.notes && report.notes.length > 0 && (
          <section className="result__section" aria-labelledby="result-notes">
            <h3 id="result-notes" className="result__heading">
              Notes
            </h3>
            <ul className="notes">
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        )}

        {fallbackNeeded && (
          <section className="result__section result__fallback" aria-labelledby="result-fallback">
            <h3 id="result-fallback" className="result__heading">
              Manual fallback
            </h3>
            <ol className="fallback-steps">
              <li>Download the compiled package below.</li>
              <li>Open LM Arena and attach the `.md` file with the attach / upload button.</li>
              <li>Copy the installation prompt and paste it into the message input.</li>
              <li>Send the message. LM Arena will rebuild the `skills/` library from the package.</li>
            </ol>
          </section>
        )}

        {diagnostics && fallbackNeeded && (
          <details className="result__diagnostics">
            <summary>
              <IconInfo size={13} /> Interface diagnostics
            </summary>
            <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
            <p className="muted">
              Share this with the SkillBridge maintainer if LM Arena changed its upload interface.
            </p>
          </details>
        )}
      </div>

      <div className="result__actions">
        <Button variant="secondary" icon={<IconDownload size={14} />} onClick={onDownload}>
          Download package
        </Button>
        <Button
          variant="secondary"
          icon={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          onClick={onCopyPrompt}
        >
          {copied ? 'Prompt copied' : 'Copy prompt'}
        </Button>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
