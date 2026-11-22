/**
 * Service worker entry point (MV3). Wires the runtime message protocol to the
 * background state, GitHub integration and LM Arena tab bridge.
 */
import { getBackgroundState } from './state';
import { repoCache } from './storage';
import { fetchSkillContent } from '../services/github';
import { buildPackage, prefetchSkillContents, PackageBuildError } from '../services/packageService';
import { pickLmArenaTab, pingContentScript, sendInsertPayload, type TabLike } from './tabs';
import { sha256, utf8ByteLength } from '../core/hash';
import type {
  IntegrationReport,
  InsertPayload,
  RuntimeRequest,
  Settings,
} from '../shared/types';
import { snapshotScope } from '../shared/types';

const state = getBackgroundState();

// Warm the state on install/update so the first popup open is fast.
chrome.runtime.onInstalled.addListener(() => {
  void state.ensureLoaded();
  // Drop the retired path-only skill cache. Its entries carry no repository or
  // revision identity, so they can never be served again — keeping them would
  // only waste the storage quota.
  void repoCache.purgeLegacy().catch(() => undefined);
});
chrome.runtime.onStartup.addListener(() => {
  void state.ensureLoaded();
  void repoCache.purgeLegacy().catch(() => undefined);
});

state.subscribe(() => {
  // Broadcast state changes to any open extension page. A missing receiver is
  // expected (e.g. the popup is closed), hence the swallow.
  try {
    void chrome.runtime.sendMessage({ type: 'STATE_CHANGED' }).catch(() => undefined);
  } catch {
    /* ignore */
  }
});

/** Encode text as a base64 data URL (used to rebuild the File in the page). */
export function dataUrlFromText(text: string, mimeType: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function performInsert(): Promise<IntegrationReport> {
  await state.ensureLoaded();
  const settings = state.getSettings();
  const snapshot = state.getSnapshot();
  if (!snapshot) {
    return {
      outcome: 'failed',
      failedStep: 'detect-tab',
      steps: [
        {
          step: 'detect-tab',
          status: 'failed',
          message: 'No repository loaded. Open the library and refresh the repository first.',
        },
      ],
    };
  }

  const tabs = (await chrome.tabs.query({})) as TabLike[];
  const tab = pickLmArenaTab(tabs);
  if (!tab?.id) {
    return {
      outcome: 'failed',
      failedStep: 'detect-tab',
      steps: [
        {
          step: 'detect-tab',
          status: 'failed',
          message: 'No LM Arena tab found. Open lmarena.ai or arena.ai, then try again.',
        },
      ],
    };
  }

  const steps: IntegrationReport['steps'] = [];
  let ping = await pingContentScript(tab.id);
  if (!ping.ok) {
    // Inject on demand: covers tabs opened before the extension was installed.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      ping = await pingContentScript(tab.id);
    } catch {
      /* reported below */
    }
  }
  steps.push({
    step: 'content-script',
    status: ping.ok ? 'ok' : 'failed',
    message: ping.ok
      ? 'Connected to the LM Arena page.'
      : ping.error ??
        'The LM Arena page is not reachable. Reload the LM Arena tab so the SkillBridge content script can load.',
  });
  if (!ping.ok) return { outcome: 'failed', failedStep: 'content-script', steps };

  let built;
  try {
    built = await buildPackage(snapshot, state.getSelection(), {
      cache: repoCache,
      maxPackageBytes: settings.maxPackageSizeMb * 1024 * 1024,
    });
  } catch (error) {
    const message =
      error instanceof PackageBuildError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Compilation failed.';
    steps.push({ step: 'attach-package', status: 'failed', message });
    return { outcome: 'failed', failedStep: 'attach-package', steps };
  }

  const payload: InsertPayload = {
    package: {
      fileName: built.pkg.fileName,
      content: built.pkg.markdown,
      mimeType: 'text/markdown',
    },
    prompt: built.prompt,
    packageId: built.pkg.packageId,
    autoSend: settings.behavior.autoSend,
    autoAttach: settings.behavior.autoAttach,
    packageDataUrl: dataUrlFromText(built.pkg.markdown, 'text/markdown'),
  };

  // Persist before integrating so the package survives any failure.
  const stored = {
    packageId: built.pkg.packageId,
    fileName: built.pkg.fileName,
    markdown: built.pkg.markdown,
    prompt: built.prompt,
    createdAt: Date.now(),
  };
  try {
    await chrome.storage.local.set({ 'skillbridge.lastPackage.v1': stored });
  } catch {
    /* quota exceeded: the UI still receives the report */
  }

  const report = await sendInsertPayload(tab.id, payload);
  return {
    outcome: report.outcome,
    steps: [...steps, ...report.steps],
    ...(report.failedStep ? { failedStep: report.failedStep } : {}),
    ...(report.notes ? { notes: report.notes } : {}),
    ...(report.diagnostics ? { diagnostics: report.diagnostics } : {}),
  };
}

export async function handleRequest(message: RuntimeRequest): Promise<unknown> {
  switch (message.type) {
    case 'GET_STATE':
      await state.ensureLoaded();
      return state.getState();
    case 'REFRESH_REPO':
      await state.ensureLoaded();
      return state.refresh({ force: message.force ?? true });
    case 'SET_SETTINGS':
      await state.ensureLoaded();
      return state.setSettings(message.settings as Partial<Settings>);
    case 'SET_SELECTION':
      await state.ensureLoaded();
      return state.setSelection(message.selection);
    case 'CLEAR_SELECTION':
      await state.ensureLoaded();
      return state.clearSelection();
    case 'GET_SKILL_CONTENT': {
      await state.ensureLoaded();
      const snapshot = state.getSnapshot();
      if (!snapshot) throw new Error('No repository loaded.');
      const skill = snapshot.skills.find((s) => s.id === message.id);
      if (!skill) throw new Error('Skill not found in the current repository snapshot.');
      // Scope by repository *and* revision: previews must show the content of
      // the snapshot currently on screen, never a stale or foreign file.
      const scope = snapshotScope(snapshot);
      const cached = await repoCache.readSkillAny(scope, skill.path);
      if (cached) return { content: cached.content, cached: true };
      const result = await fetchSkillContent(snapshot.config, skill.path, snapshot.commit);
      if (!result.ok) throw new Error(result.error.message);
      await repoCache.writeSkill(scope, {
        path: skill.path,
        content: result.data,
        hash: sha256(result.data),
        bytes: utf8ByteLength(result.data),
      });
      return { content: result.data, cached: false };
    }
    case 'PREFETCH_SKILLS': {
      await state.ensureLoaded();
      const snapshot = state.getSnapshot();
      if (!snapshot) throw new Error('No repository loaded.');
      return prefetchSkillContents(snapshot, message.ids, { cache: repoCache });
    }
    case 'GET_STORAGE_STATS':
      return state.storageStats();
    case 'CLEAR_CACHE':
      await state.clearCache();
      return { ok: true };
    case 'OPEN_MANAGER':
      await chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
      return { ok: true };
    case 'GET_LAST_PACKAGE': {
      const stored = await chrome.storage.local.get('skillbridge.lastPackage.v1');
      const last = stored['skillbridge.lastPackage.v1'] as
        | { packageId: string; fileName: string; markdown: string; prompt: string; createdAt: number }
        | undefined;
      return last ?? null;
    }
    case 'INSERT_INTO_LM_ARENA':
      return performInsert();
    default:
      throw new Error(`Unknown request type: ${(message as { type?: string }).type ?? 'undefined'}`);
  }
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeRequest | { type: string }, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return false;
    if (message.type === 'STATE_CHANGED') return false;
    handleRequest(message as RuntimeRequest)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: {
            code: 'UNKNOWN',
            message: error instanceof Error ? error.message : String(error),
          },
        });
      });
    return true; // keep the channel open for the async response
  },
);

export const __testing = { performInsert, handleRequest, dataUrlFromText, state };
