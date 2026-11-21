/**
 * Content script — runs on LM Arena pages only (see manifest matches).
 *
 * It is deliberately thin: it rebuilds the File from the data URL, hands the
 * work to the adapter and answers pings. All DOM knowledge lives in the
 * adapter module so future selector updates stay isolated.
 */
import { LmArenaAdapter } from '../integration/lmarena/adapter';
import { inspectDom } from '../integration/lmarena/adapter';
import type { InsertPayload, IntegrationReport } from '../shared/types';

interface InsertMessage {
  type: 'SKILLBRIDGE_INSERT';
  payload: InsertPayload;
}

interface PingMessage {
  type: 'SKILLBRIDGE_PING';
}

interface DiagnosticsMessage {
  type: 'SKILLBRIDGE_DIAGNOSTICS';
}

type ExtensionMessage = InsertMessage | PingMessage | DiagnosticsMessage;

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const binary = meta.includes('base64') ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function rebuildFile(payload: InsertPayload): File {
  const { fileName, mimeType, content } = payload.package;
  if (payload.packageDataUrl) {
    try {
      const bytes = dataUrlToBytes(payload.packageDataUrl);
      // Prefer the reconstructed bytes; fall back to the inline text if any
      // encoding hiccup occurred.
      if (bytes.length === new TextEncoder().encode(content).length) {
        return new File([bytes as BlobPart], fileName, { type: mimeType, lastModified: Date.now() });
      }
    } catch {
      /* fall through */
    }
  }
  return new File([content], fileName, { type: mimeType, lastModified: Date.now() });
}

export async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'SKILLBRIDGE_PING':
      return { ok: true, host: location.host, diagnostics: inspectDom(document) };
    case 'SKILLBRIDGE_DIAGNOSTICS':
      return { ok: true, diagnostics: inspectDom(document) };
    case 'SKILLBRIDGE_INSERT': {
      const { payload } = message;
      const adapter = new LmArenaAdapter();
      const file = rebuildFile(payload);
      const report: IntegrationReport = await adapter.run(
        {
          fileName: file.name,
          content: payload.package.content,
          prompt: payload.prompt,
          autoSend: payload.autoSend,
          autoAttach: payload.autoAttach,
        },
        document,
      );
      return { ok: true, report };
    }
    default:
      return { ok: false, error: 'Unknown SkillBridge message.' };
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return false;
    if (!String(message.type).startsWith('SKILLBRIDGE_')) return false;
    handleMessage(message)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  });
  // Announce availability so the popup can show the integration as ready.
  void chrome.runtime.sendMessage({ type: 'SKILLBRIDGE_CONTENT_READY' }).catch(() => undefined);
}
