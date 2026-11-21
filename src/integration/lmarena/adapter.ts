/**
 * LM Arena adapter — isolated from the rest of the extension so it can be
 * updated independently when the site changes.
 *
 * The adapter is a pure state machine over a document: all steps operate on a
 * `Document` and return structured step results, which makes the behaviour
 * fully testable against a simulated DOM.
 */
import type {
  DomDiagnostics,
  IntegrationReport,
  IntegrationStep,
  StepResult,
} from '../../shared/types';
import { SELECTORS } from './selectors';
import {
  clickElement,
  collectAttachmentEvidence,
  composerContainsPrompt,
  fillComposer,
  findAttachButton,
  findComposer,
  findFileInputs,
  findSendButton,
  normalizeText,
} from './domActions';

export interface AdapterInput {
  fileName: string;
  /** Package Markdown. */
  content: string;
  prompt: string;
  autoSend: boolean;
  autoAttach: boolean;
}

export interface AdapterOptions {
  /** Wait between UI state changes (ms). Set to 0 in tests. */
  settleMs?: number;
  /** Max time to wait for an attachment chip to appear (ms). */
  attachTimeoutMs?: number;
  /** Poll interval while waiting (ms). */
  pollMs?: number;
  /** Injectable sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function makeFile(content: string, fileName: string, mimeType = 'text/markdown'): File {
  return new File([content], fileName, { type: mimeType, lastModified: Date.now() });
}

/**
 * Assign files to an `<input type=file>` the way a native picker would.
 *
 * Browsers expose a `files` setter that accepts a `DataTransfer` FileList.
 * Engines without `DataTransfer` (older WebViews, jsdom) get a compatible
 * FileList-shaped object instead, so the upload handler still receives data.
 */
export function assignFileToInput(input: HTMLInputElement, file: File): boolean {
  const win = (input.ownerDocument?.defaultView ?? globalThis) as Window & typeof globalThis;
  let assigned = false;

  const DataTransferCtor = (win as unknown as { DataTransfer?: typeof DataTransfer }).DataTransfer;
  if (typeof DataTransferCtor === 'function') {
    try {
      const dt = new DataTransferCtor();
      dt.items.add(file);
      input.files = dt.files;
      assigned = true;
    } catch {
      assigned = false;
    }
  }

  if (!assigned) {
    try {
      const list = [file] as unknown as FileList;
      Object.defineProperty(input, 'files', { value: list, configurable: true, writable: true });
      assigned = true;
    } catch {
      return false;
    }
  }

  input.dispatchEvent(new win.Event('input', { bubbles: true, cancelable: true }));
  input.dispatchEvent(new win.Event('change', { bubbles: true, cancelable: true }));
  return true;
}

export function inspectDom(doc: Document): DomDiagnostics {
  const composer = findComposer(doc);
  const inputs = findFileInputs(doc);
  const attach = findAttachButton(doc, SELECTORS.attachButton);
  const send = findSendButton(doc, SELECTORS.sendButton);
  return {
    url: doc.location?.href ?? '',
    host: doc.location?.host ?? '',
    composerFound: Boolean(composer),
    ...(composer ? { composerKind: composer.handle.kind } : {}),
    fileInputs: inputs.length,
    fileInputSelectors: inputs.map((i) => (i.id ? `#${i.id}` : `input[type=file][name="${i.name}"]`)),
    attachButtons: attach ? [{ label: attach.element.getAttribute('aria-label') ?? attach.element.textContent?.trim() ?? '', selector: attach.selector }] : [],
    sendButtons: send ? [{ label: send.element.getAttribute('aria-label') ?? send.element.textContent?.trim() ?? '', selector: send.selector }] : [],
    candidateForms: doc.querySelectorAll('form').length,
  };
}

export class LmArenaAdapter {
  private readonly opts: Required<AdapterOptions>;

  constructor(options: AdapterOptions = {}) {
    this.opts = {
      settleMs: options.settleMs ?? 150,
      attachTimeoutMs: options.attachTimeoutMs ?? 8000,
      pollMs: options.pollMs ?? 250,
      sleep: options.sleep ?? defaultSleep,
      now: options.now ?? (() => Date.now()),
    };
  }

  private async settle(): Promise<void> {
    if (this.opts.settleMs > 0) await this.opts.sleep(this.opts.settleMs);
  }

  /** Locate the composer, failing with a clear step result. */
  locateComposer(doc: Document): { handle: ReturnType<typeof findComposer> } {
    return { handle: findComposer(doc) };
  }

  async attachPackage(doc: Document, input: AdapterInput): Promise<StepResult> {
    if (!input.autoAttach) {
      return { step: 'attach-package', status: 'skipped', message: 'Attachment disabled in settings.' };
    }
    let fileInputs = findFileInputs(doc);
    if (fileInputs.length === 0) {
      // Many chat UIs mount the upload input only once the attach control is
      // opened. Click it once and re-scan before giving up.
      const attachButton = findAttachButton(doc, SELECTORS.attachButton);
      if (attachButton) {
        clickElement(attachButton.element);
        await this.settle();
        fileInputs = findFileInputs(doc);
      }
    }
    if (fileInputs.length === 0) {
      return {
        step: 'attach-package',
        status: 'failed',
        message:
          'No file input found on the page, even after trying the attach button. LM Arena may use a different upload mechanism.',
      };
    }
    // Prefer a markdown-compatible input if several exist.
    const inputEl =
      fileInputs.find((i) => (i.getAttribute('accept') ?? '').toLowerCase().includes('.md')) ??
      fileInputs[fileInputs.length - 1]!;
    const file = makeFile(input.content, input.fileName);
    const assigned = assignFileToInput(inputEl, file);
    if (!assigned) {
      return {
        step: 'attach-package',
        status: 'failed',
        message: 'The browser prevented assigning the file to the upload input.',
      };
    }
    await this.settle();
    return {
      step: 'attach-package',
      status: 'ok',
      message: `Assigned ${input.fileName} to the LM Arena upload input.`,
    };
  }

  async verifyAttachment(doc: Document, fileName: string): Promise<StepResult> {
    const deadline = this.opts.now() + this.opts.attachTimeoutMs;
    let lastEvidence = 'no attachment chip found';
    let fallbackEvidence: string | null = null;

    const inputHasFile = (): boolean => {
      for (const el of findFileInputs(doc)) {
        const files = el.files as ArrayLike<File> | null;
        if (!files || files.length === 0) continue;
        for (let i = 0; i < files.length; i++) {
          // `FileList#item` exists in browsers; array-indexing also works for
          // the FileList-shaped polyfill used by sandboxed/test environments.
          const f = files[i];
          if (f && f.name === fileName) return true;
        }
      }
      return false;
    };

    for (;;) {
      const evidence = collectAttachmentEvidence(doc, fileName);
      if (evidence.found) {
        return { step: 'verify-attachment', status: 'ok', message: evidence.evidence };
      }
      lastEvidence = evidence.evidence;
      if (inputHasFile()) {
        // The DOM shows the pending file in the input but the page has not
        // rendered a chip yet. Record it and keep polling for a chip.
        fallbackEvidence = 'file present in upload input';
      } else {
        fallbackEvidence = null;
      }
      if (this.opts.now() >= deadline) break;
      await this.opts.sleep(Math.min(this.opts.pollMs, Math.max(1, deadline - this.opts.now())));
    }

    if (fallbackEvidence) {
      return {
        step: 'verify-attachment',
        status: 'warning',
        message: `${fallbackEvidence}, but no visible attachment chip appeared. Confirm the file is attached before sending.`,
      };
    }
    return {
      step: 'verify-attachment',
      status: 'failed',
      message: `The package was not attached (${lastEvidence}).`,
    };
  }

  async insertPrompt(doc: Document, prompt: string): Promise<StepResult> {
    const composer = findComposer(doc);
    if (!composer) {
      return { step: 'insert-prompt', status: 'failed', message: 'Message input not found.' };
    }
    const ok = fillComposer(composer.handle, prompt);
    if (!ok) {
      return {
        step: 'insert-prompt',
        status: 'failed',
        message: 'The prompt could not be written into the message input.',
      };
    }
    return {
      step: 'verify-prompt',
      status: 'ok',
      message: `Prompt inserted (${prompt.length} characters).`,
    };
  }

  async verifyPrompt(doc: Document, prompt: string): Promise<StepResult> {
    const composer = findComposer(doc);
    if (!composer) {
      return { step: 'verify-prompt', status: 'failed', message: 'Message input not found.' };
    }
    if (!composerContainsPrompt(composer.handle, prompt)) {
      const actual = normalizeText(composer.handle.kind === 'textarea' ? (composer.handle.element as HTMLTextAreaElement).value : composer.handle.element.textContent ?? '');
      return {
        step: 'verify-prompt',
        status: 'failed',
        message: `Message input content does not match the generated prompt (found ${actual.length} characters).`,
      };
    }
    return { step: 'verify-prompt', status: 'ok', message: 'Prompt verified in the message input.' };
  }

  async send(doc: Document, prompt: string, attachmentOk: boolean): Promise<StepResult> {
    // Safety: never send when the composer content changed or the attachment
    // was not verified.
    const composer = findComposer(doc);
    if (!composer || !composerContainsPrompt(composer.handle, prompt)) {
      return {
        step: 'send',
        status: 'failed',
        message: 'Send aborted: the message input no longer contains the generated prompt.',
      };
    }
    if (!attachmentOk) {
      return {
        step: 'send',
        status: 'failed',
        message: 'Send aborted: the package attachment could not be verified.',
      };
    }
    const button = findSendButton(doc, SELECTORS.sendButton);
    const win = doc.defaultView ?? window;
    if (!button) {
      // Fallback: submit the form if one wraps the composer.
      const form = composer.handle.element.closest('form');
      if (form) {
        form.requestSubmit?.();
        await this.settle();
        return { step: 'send', status: 'ok', message: 'Submitted the composer form.' };
      }
      // Last resort: Enter key.
      const event = new win.KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      composer.handle.element.dispatchEvent(event);
      return { step: 'send', status: 'warning', message: 'Pressed Enter in the composer (no send button found).' };
    }
    button.element.click();
    await this.settle();
    return { step: 'send', status: 'ok', message: 'Send button clicked.' };
  }

  /**
   * Full integration flow. It is honest about outcomes: a failure in a later
   * step never hides what did succeed, and the package/prompt are always
   * preserved by the caller for the fallback path.
   */
  async run(input: AdapterInput, doc: Document): Promise<IntegrationReport> {
    const steps: StepResult[] = [];
    const notes: string[] = [];
    const diagnostics = inspectDom(doc);
    steps.push({
      step: 'detect-tab',
      status: 'ok',
      message: `Active tab: ${diagnostics.host || 'unknown host'}`,
    });

    const composer = findComposer(doc);
    if (!composer) {
      steps.push({
        step: 'locate-composer',
        status: 'failed',
        message: 'Could not find the LM Arena message input on this page.',
      });
      return {
        outcome: 'failed',
        steps,
        failedStep: 'locate-composer',
        notes,
        diagnostics,
      };
    }
    steps.push({
      step: 'locate-composer',
      status: 'ok',
      message: `Message input found (${composer.handle.kind}, ${composer.selector}).`,
    });

    // 1. Attach
    let attachmentOk = false;
    if (!input.autoAttach) {
      const skipped = await this.attachPackage(doc, input);
      steps.push(skipped);
      notes.push('Attachment is disabled in settings; upload the package manually.');
    } else {
      const attach = await this.attachPackage(doc, input);
      steps.push(attach);
      if (attach.status === 'failed') {
        const promptStep = await this.insertPrompt(doc, input.prompt);
        steps.push(promptStep);
        if (promptStep.status === 'ok') steps.push(await this.verifyPrompt(doc, input.prompt));
        notes.push('The package was not attached. Download it and attach it manually, then send the prompt.');
        return {
          outcome: 'prompt-only',
          steps,
          failedStep: 'attach-package',
          notes,
          diagnostics,
        };
      }
      const verify = await this.verifyAttachment(doc, input.fileName);
      steps.push(verify);
      attachmentOk = verify.status === 'ok';
      if (verify.status === 'warning') {
        // Present but unverified: still fill the prompt, never auto-send.
        notes.push(verify.message);
      }
    }

    // 2. Prompt
    const fill = await this.insertPrompt(doc, input.prompt);
    steps.push(fill);
    if (fill.status === 'failed') {
      notes.push('Copy the prompt manually into the LM Arena message input.');
      return {
        outcome: attachmentOk ? 'attached-only' : 'failed',
        steps,
        failedStep: 'insert-prompt',
        notes,
        diagnostics,
      };
    }
    const verifyPrompt = await this.verifyPrompt(doc, input.prompt);
    steps.push(verifyPrompt);
    if (verifyPrompt.status === 'failed') {
      return {
        outcome: attachmentOk ? 'attached-only' : 'failed',
        steps,
        failedStep: 'verify-prompt',
        notes,
        diagnostics,
      };
    }

    // 3. Send (only when explicitly enabled AND everything verified)
    if (!input.autoSend) {
      steps.push({
        step: 'send',
        status: 'skipped',
        message: 'Auto-send is off — review the prompt and send it yourself.',
      });
      return {
        outcome: attachmentOk ? 'attached-and-filled' : 'prompt-only',
        steps,
        notes,
        diagnostics,
      };
    }

    const attachmentStatus = steps.find((s) => s.step === 'verify-attachment')?.status;
    const canAutoSend = attachmentOk && attachmentStatus === 'ok';
    if (!canAutoSend) {
      steps.push({
        step: 'send',
        status: 'skipped',
        message: 'Auto-send skipped because the package attachment was not verified.',
      });
      notes.push('Auto-send was skipped for safety: verify the attachment, then send manually.');
      return {
        outcome: attachmentOk ? 'attached-and-filled' : 'prompt-only',
        steps,
        notes,
        diagnostics,
      };
    }

    const send = await this.send(doc, input.prompt, attachmentOk);
    steps.push(send as StepResult);
    if (send.status === 'failed') {
      return { outcome: attachmentOk ? 'attached-only' : 'prompt-only', steps, failedStep: 'send', notes, diagnostics };
    }
    return { outcome: 'sent', steps, notes, diagnostics };
  }
}

/** Human-readable failure helpers shared with the UI. */
export function stepLabel(step: IntegrationStep): string {
  switch (step) {
    case 'detect-tab':
      return 'Detect LM Arena tab';
    case 'content-script':
      return 'Reach page';
    case 'locate-composer':
      return 'Locate message input';
    case 'attach-package':
      return 'Attach package';
    case 'verify-attachment':
      return 'Verify attachment';
    case 'insert-prompt':
      return 'Insert prompt';
    case 'verify-prompt':
      return 'Verify prompt';
    case 'send':
      return 'Send message';
  }
}
