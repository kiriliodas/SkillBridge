/**
 * Optional host permissions.
 *
 * The manifest declares GitHub origins as *optional*, so the extension asks for
 * them the first time the user refreshes a repository. Requesting must happen
 * inside a user gesture, which is why this is called directly from click
 * handlers in the UI (never from the service worker).
 *
 * If the grant is declined the extension still works: GitHub's API and raw
 * endpoints send permissive CORS headers, so fetches succeed without the
 * permission — the grant only removes those CORS restrictions.
 */
import { GITHUB_API_BASE, GITHUB_RAW_BASE } from '../../shared/config';

export const GITHUB_ORIGINS = [`${GITHUB_API_BASE}/*`, `${GITHUB_RAW_BASE}/*`];

function hasPermissionsApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.permissions?.request) &&
    Boolean(chrome.permissions?.contains)
  );
}

export async function hasGithubAccess(): Promise<boolean> {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.contains({ origins: GITHUB_ORIGINS });
  } catch {
    return false;
  }
}

/**
 * Ask for GitHub host access. Returns true when access is available afterwards.
 * Must be invoked from a user gesture; safe to call repeatedly.
 */
export async function ensureGithubAccess(): Promise<boolean> {
  if (!hasPermissionsApi()) return false;
  try {
    if (await chrome.permissions.contains({ origins: GITHUB_ORIGINS })) return true;
    return await chrome.permissions.request({ origins: GITHUB_ORIGINS });
  } catch {
    return false;
  }
}
