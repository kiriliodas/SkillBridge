/**
 * LM Arena DOM adapter selectors.
 *
 * LM Arena (arena.ai / lmarena.ai) is a React app; its class names are hashed
 * and change frequently. The strategy is therefore accessibility- and
 * behaviour-first:
 *
 *   composer  : the visible textarea / contenteditable inside the composer area
 *   file input: input[type=file] attached to the composer (often visually hidden
 *               behind an "attach" button, which is why we set files directly)
 *   send      : a submit button or a button labelled Send
 *
 * Every selector is ordered from most stable (roles, labels, aria attributes)
 * to least stable (data-sentry hooks, then generic structural fallbacks).
 * The list is data, not code: add new candidates here when LM Arena changes.
 */
export interface SelectorList {
  composer: string[];
  fileInput: string[];
  attachButton: string[];
  sendButton: string[];
}

export const SELECTORS: SelectorList = {
  composer: [
    'textarea[data-sentry-element="AutoResizeTextarea"]',
    'textarea[placeholder]',
    'textarea[aria-label]',
    'textarea',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-placeholder]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ],
  fileInput: [
    'input[type="file"]',
    'form input[type="file"]',
    'input[type="file"][accept*="md"]',
    'input[type="file"][multiple]',
  ],
  attachButton: [
    'button[aria-label*="Attach" i]',
    'button[aria-label*="Upload" i]',
    'button[aria-label*="file" i]',
    'button[title*="Attach" i]',
    'button[title*="Upload" i]',
    'label[for][aria-label*="attach" i]',
    'button:has(svg[data-testid*="paperclip" i])',
    'button[data-testid*="attach" i]',
    'button[data-testid*="upload" i]',
  ],
  sendButton: [
    'form button[type="submit"]',
    'button[type="submit"]',
    'button[aria-label="Send message"]',
    'button[aria-label*="Send" i]',
    'button[data-testid*="send" i]',
    'button:has(svg[data-testid*="send" i])',
    'button[aria-label*="submit" i]',
  ],
};

/** Attributes that make an element visible enough to be the real composer. */
export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style) {
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && element.tagName.toLowerCase() !== 'textarea') {
    // jsdom and hidden file inputs both report zero-size rects; only reject
    // clearly detached elements here.
    return element.isConnected;
  }
  return true;
}
