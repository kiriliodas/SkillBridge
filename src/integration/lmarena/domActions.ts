/**
 * Low-level DOM actions used by the LM Arena adapter.
 *
 * All functions are framework-agnostic and defensive: LM Arena is a React app,
 * so controlled inputs require using the native value setter plus an `input`
 * event, exactly like a human typing would produce.
 */

export type ComposerKind = 'textarea' | 'contenteditable';

export interface ComposerHandle {
  element: HTMLElement;
  kind: ComposerKind;
}

function queryAll<T extends Element>(root: ParentNode, selector: string): T[] {
  try {
    return Array.from(root.querySelectorAll<T>(selector));
  } catch {
    // Selectors with :has() may be unsupported in older engines.
    return [];
  }
}

export function findVisible(
  root: ParentNode,
  selectors: string[],
  predicate: (el: Element) => boolean = () => true,
): { element: HTMLElement; selector: string } | null {
  for (const selector of selectors) {
    const candidates = queryAll<HTMLElement>(root, selector);
    for (const element of candidates) {
      if (predicate(element)) return { element, selector };
    }
  }
  return null;
}

/** Find the most plausible message composer. */
export function findComposer(root: ParentNode): { handle: ComposerHandle; selector: string } | null {
  const isUsable = (el: Element): boolean => {
    const html = el as HTMLElement;
    if (html.closest('[aria-hidden="true"]')) return false;
    if (html.hasAttribute('disabled') || html.hasAttribute('hidden')) return false;
    if ((html as HTMLTextAreaElement).readOnly) return false;
    const style = html.ownerDocument.defaultView?.getComputedStyle(html);
    if (style?.display === 'none' || style?.visibility === 'hidden') return false;
    return html.isConnected;
  };
  const isActuallyVisible = (el: HTMLElement): boolean => {
    const rect = el.getBoundingClientRect();
    return rect.width >= 80 && rect.height > 0;
  };

  const selectors = [
    'textarea[data-sentry-element="AutoResizeTextarea"]',
    'textarea[placeholder]',
    'textarea[aria-label]',
    'textarea',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-placeholder]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const candidates: Array<{ element: HTMLElement; selector: string; kind: ComposerKind }> = [];
  const seen = new Set<HTMLElement>();
  for (const selector of selectors) {
    for (const element of queryAll<HTMLElement>(root, selector)) {
      if (seen.has(element) || !isUsable(element)) continue;
      seen.add(element);
      const kind: ComposerKind = element.tagName.toLowerCase() === 'textarea' ? 'textarea' : 'contenteditable';
      if (kind === 'contenteditable' && element.getAttribute('contenteditable') !== 'true') continue;
      candidates.push({ element, selector, kind });
    }
  }

  // Prefer a genuinely visible composer. React pages can keep hidden or stale
  // textareas mounted; selecting one would make a DOM-value check pass while
  // the user-facing message box remains empty.
  const selected = candidates.find(({ element }) => isActuallyVisible(element)) ?? candidates[0];
  return selected
    ? { handle: { element: selected.element, kind: selected.kind }, selector: selected.selector }
    : null;
}

export function findFileInputs(root: ParentNode): HTMLInputElement[] {
  return queryAll<HTMLInputElement>(root, 'input[type="file"]').filter(
    (input) => input.type === 'file',
  );
}

export function findSendButton(
  root: ParentNode,
  selectors: string[],
): { element: HTMLElement; selector: string } | null {
  return findVisible(root, selectors, (el) => {
    const html = el as HTMLElement;
    if (html.hasAttribute('disabled')) return false;
    return !html.closest('[aria-hidden="true"]');
  });
}

export function findAttachButton(
  root: ParentNode,
  selectors: string[],
): { element: HTMLElement; selector: string } | null {
  return findVisible(root, selectors);
}

// ---------------------------------------------------------------------------
// Setting values the React way
// ---------------------------------------------------------------------------

/**
 * Click an element the way a user would, including the pointer events some
 * React handlers listen for. Used for the attach control, which may lazily
 * mount the upload input.
 */
export function clickElement(element: Element): void {
  const view = element.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const MouseEventCtor = view?.MouseEvent ?? MouseEvent;

  // Never let the probe submit a form: an attach control that happens to be a
  // submit button must only open the upload UI, not send the message.
  const isSubmit =
    element instanceof HTMLElement &&
    element.tagName === 'BUTTON' &&
    (element.getAttribute('type') ?? 'submit').toLowerCase() === 'submit' &&
    Boolean(element.closest('form'));
  const blockDefault = (event: Event) => event.preventDefault();
  if (isSubmit) element.addEventListener('click', blockDefault, { capture: true, once: true });

  try {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      // No `view`: jsdom (and some sandboxes) reject a window from another realm,
      // and React's synthetic handlers do not need it.
      element.dispatchEvent(new MouseEventCtor(type, { bubbles: true, cancelable: true }));
    }
    // Element#click also works for non-HTMLElement nodes in practice; guard for
    // environments where it is missing.
    const clickable = element as Element & { click?: () => void };
    if (typeof clickable.click === 'function') clickable.click();
  } finally {
    if (isSubmit) element.removeEventListener('click', blockDefault, { capture: true });
  }
}

export function setNativeValue(
  element: HTMLTextAreaElement | HTMLInputElement,
  value: string,
): void {
  const proto = Object.getPrototypeOf(element) as object;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

export function dispatchInputEvents(element: HTMLElement, value: string): void {
  const win = element.ownerDocument.defaultView ?? window;
  element.dispatchEvent(new win.InputEvent('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new win.Event('change', { bubbles: true }));
  // Some frameworks listen to React's synthetic input via a keyup as well.
  void value;
}

/** Type the prompt into a textarea or contenteditable composer. */
export function fillComposer(handle: ComposerHandle, text: string): boolean {
  const { element, kind } = handle;
  element.focus();
  if (kind === 'textarea') {
    const textarea = element as HTMLTextAreaElement;
    setNativeValue(textarea, text);
    dispatchInputEvents(textarea, text);
    return readComposer(handle) === text;
  }
  // contenteditable: prefer execCommand (fires beforeinput/input natively),
  // fall back to setting textContent + input event.
  const doc = element.ownerDocument;
  element.textContent = '';
  const selection = doc.getSelection?.();
  selection?.removeAllRanges();
  const range = doc.createRange();
  range.selectNodeContents(element);
  selection?.addRange(range);
  let inserted = false;
  try {
    inserted = doc.execCommand('insertText', false, text);
  } catch {
    inserted = false;
  }
  if (!inserted) {
    element.textContent = text;
    dispatchInputEvents(element, text);
  }
  return readComposer(handle) === text;
}

export function readComposer(handle: ComposerHandle): string {
  if (handle.kind === 'textarea') return (handle.element as HTMLTextAreaElement).value;
  const el = handle.element;
  // Prefer innerText for line breaks; fall back to textContent.
  const inner = (el as HTMLElement).innerText;
  return typeof inner === 'string' && inner.length > 0 ? inner : (el.textContent ?? '');
}

export function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim();
}

export function composerContainsPrompt(handle: ComposerHandle, prompt: string): boolean {
  return normalizeText(readComposer(handle)) === normalizeText(prompt);
}

// ---------------------------------------------------------------------------
// File attachment
// ---------------------------------------------------------------------------

export interface AttachedFileEvidence {
  found: boolean;
  evidence: string;
  chips: string[];
}

/** Names that indicate an attachment chip/pill rendered by the UI. */
export function collectAttachmentEvidence(root: ParentNode, fileName: string): AttachedFileEvidence {
  const base = fileName.replace(/\.md$/i, '');
  const chips: string[] = [];
  const scope = root instanceof Document ? root.body : (root as ParentNode);
  if (!scope) return { found: false, evidence: 'no documents', chips };
  const elements = queryAll<HTMLElement>(scope, '*');
  for (const el of elements) {
    if (el.children.length > 0) continue; // leaf text nodes only
    const text = normalizeText(el.textContent ?? '');
    if (!text || text.length > 200) continue;
    if (text.includes(fileName) || text.includes(base)) {
      chips.push(text);
      if (chips.length > 10) break;
    }
  }
  return {
    found: chips.length > 0,
    evidence: chips.length > 0 ? `attachment chip: ${chips[0]}` : 'no attachment chip found',
    chips,
  };
}
