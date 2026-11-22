import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LmArenaAdapter, assignFileToInput, inspectDom, makeFile, stepLabel } from '../src/integration/lmarena/adapter';
import type { IntegrationReport } from '../src/shared/types';

/**
 * Simulated LM Arena composer. It mirrors the accessible structure the adapter
 * targets (textarea + hidden file input + send button), without any hashed
 * class names, so the test stays valid when LM Arena restyles its UI.
 */
interface FakePage {
  doc: Document;
  textarea: HTMLTextAreaElement;
  fileInput: HTMLInputElement;
  sendButton: HTMLButtonElement;
  sent: number;
  chips: HTMLElement;
}

function createPage(options: { withFileInput?: boolean; withSendButton?: boolean; withChips?: boolean } = {}): FakePage {
  document.body.innerHTML = '';
  document.body.innerHTML = `
    <main>
      <div id="messages" role="log"></div>
      <form id="composer-form">
        <div class="composer">
          <textarea data-sentry-element="AutoResizeTextarea" placeholder="Ask anything" aria-label="Message"></textarea>
          <div id="chips"></div>
          ${options.withFileInput === false ? '' : '<input type="file" multiple accept=".md,.txt,.pdf" />'}
          ${options.withSendButton === false ? '' : '<button type="submit" aria-label="Send message">Send</button>'}
        </div>
      </form>
    </main>`;
  const textarea = document.querySelector<HTMLTextAreaElement>('textarea')!;
  const fileInput = document.querySelector('input[type=file]') as HTMLInputElement;
  const sendButton = document.querySelector('button[type=submit]') as HTMLButtonElement;
  const chips = document.querySelector<HTMLElement>('#chips')!;
  const page: FakePage = { doc: document, textarea, fileInput, sendButton, sent: 0, chips };

  // The site normally adds an attachment chip after the change event.
  if (options.withFileInput !== false && options.withChips !== false) {
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      chip.textContent = file.name;
      chips.appendChild(chip);
    });
  }
  sendButton?.addEventListener('click', (event) => {
    event.preventDefault();
    page.sent += 1;
  });
  return page;
}

const fastAdapter = () =>
  new LmArenaAdapter({ settleMs: 0, attachTimeoutMs: 150, pollMs: 10, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });

const baseInput = (overrides: Partial<{ autoSend: boolean; autoAttach: boolean; fileName: string }> = {}) => ({
  fileName: overrides.fileName ?? 'skillbridge-package-12345678.md',
  content: '# SKILLBRIDGE PACKAGE\n\ncontent',
  prompt: 'Install the Skill library attached as `skillbridge-package-12345678.md`.',
  autoSend: overrides.autoSend ?? false,
  autoAttach: overrides.autoAttach ?? true,
});

const findStep = (report: IntegrationReport, step: string) =>
  report.steps.find((s) => s.step === step);

describe('assignFileToInput', () => {
  it('attaches a File and fires the change event', () => {
    const page = createPage();
    const file = makeFile('# hi', 'x.md');
    expect(assignFileToInput(page.fileInput, file)).toBe(true);
    expect(page.chips.textContent).toBe('x.md');
  });

  it('creates a File with markdown mime type, size and exact content', async () => {
    const file = makeFile('# Réseau 🚀\n', 'skill.md');
    expect(file.type).toBe('text/markdown');
    expect(file.name).toBe('skill.md');
    expect(file.size).toBe(new TextEncoder().encode('# Réseau 🚀\n').length);
    // jsdom's Blob lacks text(); FileReader is standards-compliant everywhere.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
    expect(text).toBe('# Réseau 🚀\n');
  });
});

describe('inspectDom', () => {
  it('reports what is available', () => {
    createPage();
    const diagnostics = inspectDom(document);
    expect(diagnostics.composerFound).toBe(true);
    expect(diagnostics.composerKind).toBe('textarea');
    expect(diagnostics.fileInputs).toBe(1);
    expect(diagnostics.candidateForms).toBe(1);
    expect(diagnostics.sendButtons.length).toBeGreaterThan(0);
  });

  it('reports missing elements honestly', () => {
    createPage({ withFileInput: false, withSendButton: false });
    const diagnostics = inspectDom(document);
    expect(diagnostics.fileInputs).toBe(0);
    expect(diagnostics.sendButtons).toHaveLength(0);
  });
});

describe('LmArenaAdapter — composer selection', () => {
  it('prefers the visible composer over a hidden stale textarea', async () => {
    const page = createPage();
    const hidden = document.createElement('textarea');
    hidden.setAttribute('data-sentry-element', 'AutoResizeTextarea');
    hidden.style.display = 'none';
    page.doc.querySelector('.composer')!.prepend(hidden);

    const report = await fastAdapter().run(baseInput(), page.doc);

    expect(report.outcome).toBe('attached-and-filled');
    expect(hidden.value).toBe('');
    expect(page.textarea.value).toContain('Install the Skill library');
  });
});

describe('LmArenaAdapter — happy paths', () => {
  it('attaches the package, fills the prompt and stops when auto-send is off', async () => {
    const page = createPage();
    const report = await fastAdapter().run(baseInput(), page.doc);
    expect(report.outcome).toBe('attached-and-filled');
    expect(findStep(report, 'attach-package')?.status).toBe('ok');
    expect(findStep(report, 'verify-attachment')?.status).toBe('ok');
    expect(findStep(report, 'verify-prompt')?.status).toBe('ok');
    expect(findStep(report, 'send')?.status).toBe('skipped');
    expect(page.textarea.value).toContain('Install the Skill library');
    expect(page.sent).toBe(0);
  });

  it('sends automatically when enabled and everything is verified', async () => {
    const page = createPage();
    const report = await fastAdapter().run(baseInput({ autoSend: true }), page.doc);
    expect(report.outcome).toBe('sent');
    expect(findStep(report, 'send')?.status).toBe('ok');
    expect(page.sent).toBe(1);
  });

  it('still fills the prompt when attachment is disabled in settings', async () => {
    const page = createPage();
    const report = await fastAdapter().run(baseInput({ autoAttach: false }), page.doc);
    expect(report.outcome).toBe('prompt-only');
    expect(findStep(report, 'attach-package')?.status).toBe('skipped');
    expect(page.textarea.value).toContain('Install the Skill library');
    expect(page.sent).toBe(0);
  });
});

describe('LmArenaAdapter — failure handling', () => {
  it('reports a missing composer and preserves a failed step', async () => {
    document.body.innerHTML = '<div>nothing here</div>';
    const report = await fastAdapter().run(baseInput(), document);
    expect(report.outcome).toBe('failed');
    expect(report.failedStep).toBe('locate-composer');
    expect(findStep(report, 'locate-composer')?.status).toBe('failed');
  });

  it('handles a missing file input by filling only the prompt', async () => {
    const page = createPage({ withFileInput: false });
    const report = await fastAdapter().run(baseInput(), page.doc);
    expect(report.outcome).toBe('prompt-only');
    expect(report.failedStep).toBe('attach-package');
    expect(findStep(report, 'attach-package')?.status).toBe('failed');
    expect(page.textarea.value).toContain('Install the Skill library');
    expect(page.sent).toBe(0);
  });

  it('opens a lazily mounted upload input through the attach button', async () => {
    // The upload input does not exist until the attach control is clicked.
    const page = createPage({ withFileInput: false });
    const attach = document.createElement('button');
    attach.setAttribute('aria-label', 'Attach files');
    const composer = document.querySelector('.composer')!;
    composer.insertBefore(attach, composer.firstChild);
    let clicks = 0;
    attach.addEventListener('click', () => {
      clicks += 1;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.txt';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const chip = document.createElement('div');
        chip.textContent = file.name;
        page.chips.appendChild(chip);
      });
      composer.appendChild(input);
    });

    const report = await fastAdapter().run(baseInput(), page.doc);
    expect(clicks).toBe(1);
    expect(findStep(report, 'attach-package')?.status).toBe('ok');
    expect(findStep(report, 'verify-attachment')?.status).toBe('ok');
    expect(report.outcome).toBe('attached-and-filled');
  });

  it('never auto-sends when no attachment can be verified', async () => {
    const page = createPage({ withChips: false });
    const report = await fastAdapter().run(baseInput({ autoSend: true }), page.doc);
    const verify = findStep(report, 'verify-attachment');
    // The file is in the input but no chip rendered: a warning, not a hard fail.
    expect(verify?.status).toBe('warning');
    expect(findStep(report, 'send')?.status).toBe('skipped');
    expect(page.sent).toBe(0);
    expect(report.outcome).toBe('prompt-only');
  });

  it('reports a failed attachment when the upload control ignores the file', async () => {
    const page = createPage({ withChips: false });
    // Simulate a page that accepts and then drops the file (upload rejected).
    page.fileInput.addEventListener('change', () => {
      Object.defineProperty(page.fileInput, 'files', {
        value: Object.assign([], { length: 0 }),
        configurable: true,
      });
    });
    const shortAdapter = new LmArenaAdapter({
      settleMs: 0,
      attachTimeoutMs: 40,
      pollMs: 10,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    const report = await shortAdapter.run(baseInput({ autoSend: true }), page.doc);
    expect(findStep(report, 'verify-attachment')?.status).toBe('failed');
    expect(findStep(report, 'send')?.status).toBe('skipped');
    expect(page.sent).toBe(0);
    expect(report.outcome).toBe('prompt-only');
  });

  it('skips auto-send when the attachment is only a warning', async () => {
    const page = createPage({ withChips: false });
    // Keep the file in the input so verification degrades to a warning.
    page.fileInput.addEventListener('change', () => {}, { once: true });
    const adapter = new LmArenaAdapter({ settleMs: 0, attachTimeoutMs: 40, pollMs: 10, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
    const report = await adapter.run(baseInput({ autoSend: true }), page.doc);
    expect(findStep(report, 'send')?.status).toBe('skipped');
    expect(page.sent).toBe(0);
    expect(report.notes?.join(' ')).toMatch(/Auto-send was skipped|visible attachment chip/);
  });

  it('does not send when the user replaced the prompt after insertion', async () => {
    const page = createPage();
    let mutated = false;
    const prompt = baseInput().prompt;
    // A user types something else right after the prompt is written.
    page.textarea.addEventListener('input', () => {
      if (page.textarea.value === prompt && !mutated) {
        mutated = true;
        page.textarea.value = 'user replaced this';
      }
    });
    const report = await fastAdapter().run(baseInput({ autoSend: true }), page.doc);
    expect(page.sent).toBe(0);
    expect(report.outcome).toBe('attached-only');
    // The safety check stops the send: either at verification or at send time.
    expect(report.steps.some((s) => s.status === 'failed')).toBe(true);
    expect(findStep(report, 'send')?.status ?? 'failed').not.toBe('ok');
  });
});

describe('LmArenaAdapter — contenteditable composers', () => {
  it('fills a contenteditable composer', async () => {
    document.body.innerHTML = `
      <main>
        <div contenteditable="true" role="textbox" aria-label="Message"></div>
        <input type="file" />
        <button type="submit" aria-label="Send message">Send</button>
      </main>`;
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    input.addEventListener('change', () => {
      const chip = document.createElement('div');
      chip.textContent = input.files?.[0]?.name ?? '';
      document.body.appendChild(chip);
    });
    document.querySelector('button')!.addEventListener('click', (e) => e.preventDefault());
    const report = await fastAdapter().run(baseInput(), document);
    expect(report.outcome).toBe('attached-and-filled');
    expect(document.querySelector('[role=textbox]')?.textContent).toContain('Install the Skill library');
  });
});

describe('stepLabel', () => {
  it('labels every step', () => {
    for (const step of [
      'detect-tab',
      'content-script',
      'locate-composer',
      'attach-package',
      'verify-attachment',
      'insert-prompt',
      'verify-prompt',
      'send',
    ] as const) {
      expect(stepLabel(step).length).toBeGreaterThan(3);
    }
  });
});
