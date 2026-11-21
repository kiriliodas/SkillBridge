/**
 * Tab discovery + content-script messaging for the LM Arena integration.
 */
import { LM_ARENA_HOSTS } from '../shared/config';
import type { IntegrationReport, InsertPayload } from '../shared/types';

export interface TabLike {
  id?: number;
  url?: string;
  active?: boolean;
  windowId?: number;
}

export function isLmArenaUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return LM_ARENA_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * Pick the tab to integrate with: the active LM Arena tab in the last focused
 * window, else any active LM Arena tab, else the most recently accessed one.
 */
export function pickLmArenaTab(tabs: TabLike[]): TabLike | null {
  const candidates = tabs.filter((tab) => isLmArenaUrl(tab.url));
  if (candidates.length === 0) return null;
  const active = candidates.filter((tab) => tab.active);
  if (active.length > 0) return active[active.length - 1]!;
  return candidates[candidates.length - 1]!;
}

export type SendMessage = (tabId: number, message: unknown) => Promise<unknown>;

async function defaultSendMessage(tabId: number, message: unknown): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}

/** Ask the content script to check whether the page looks integrable. */
export async function pingContentScript(
  tabId: number,
  send: SendMessage = defaultSendMessage,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = (await send(tabId, { type: 'SKILLBRIDGE_PING' })) as
      | { ok?: boolean; error?: string }
      | undefined;
    return { ok: Boolean(response?.ok) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'The LM Arena content script is not available on this tab. Reload the LM Arena page and try again.',
    };
  }
}

/** Send the insert payload to the tab and normalise failures. */
export async function sendInsertPayload(
  tabId: number,
  payload: InsertPayload,
  send: SendMessage = defaultSendMessage,
): Promise<IntegrationReport> {
  try {
    const response = (await send(tabId, { type: 'SKILLBRIDGE_INSERT', payload })) as
      | { ok: boolean; report?: IntegrationReport; error?: string }
      | undefined;
    if (!response) {
      return {
        outcome: 'failed',
        failedStep: 'content-script',
        steps: [
          {
            step: 'content-script',
            status: 'failed',
            message: 'The LM Arena page did not respond. Reload the tab and try again.',
          },
        ],
      };
    }
    if (response.ok && response.report) return response.report;
    return {
      outcome: 'failed',
      failedStep: 'content-script',
      steps: [
        {
          step: 'content-script',
          status: 'failed',
          message: response.error ?? 'The integration failed inside the page.',
        },
      ],
    };
  } catch (error) {
    return {
      outcome: 'failed',
      failedStep: 'content-script',
      steps: [
        {
          step: 'content-script',
          status: 'failed',
          message:
            error instanceof Error
              ? `Could not reach the LM Arena tab: ${error.message}`
              : 'Could not reach the LM Arena tab.',
        },
      ],
    };
  }
}
