/**
 * Documentation guards: the README must stay truthful about the build output,
 * permissions and defaults. These tests fail if the code drifts from the docs.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, LM_ARENA_CONTENT_SCRIPT_MATCHES } from '../src/shared/config';

const root = resolve(__dirname, '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('README', () => {
  const readme = read('README.md');

  it('exists and covers the required sections', () => {
    for (const heading of [
      'Features',
      'Architecture',
      'Installation',
      'Build',
      'Troubleshooting',
      'Known limitations',
      'Compilation',
      'Prompt',
      'Settings',
      'Fallback',
      'Testing',
    ]) {
      expect(readme.toLowerCase()).toContain(heading.toLowerCase());
    }
  });

  it('documents the exact manifest permissions', () => {
    const manifest = JSON.parse(read('public/manifest.json'));
    for (const permission of manifest.permissions) {
      expect(readme).toContain(permission);
    }
    expect(manifest.permissions.sort()).toEqual(['activeTab', 'scripting', 'storage']);
  });

  it('documents the default repository and settings', () => {
    expect(readme).toContain(`${DEFAULT_SETTINGS.repository.owner}/${DEFAULT_SETTINGS.repository.repo}`);
    expect(readme).toContain('Auto-send installation prompt');
    expect(readme).toContain('OFF by default');
  });

  it('lists every file the packaged build contains', () => {
    for (const file of ['manifest.json', 'background.js', 'content.js', 'popup.html', 'manager.html']) {
      expect(readme).toContain(file);
    }
  });
});

describe('manifest', () => {
  it('is valid MV3 with minimal permissions', () => {
    const manifest = JSON.parse(read('public/manifest.json'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.action.default_popup).toBe('popup.html');
    // No host_permissions granted up front: GitHub access is requested on demand.
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.optional_host_permissions).toEqual([
      'https://api.github.com/*',
      'https://raw.githubusercontent.com/*',
    ]);
    // No secrets anywhere in the manifest.
    expect(JSON.stringify(manifest)).not.toMatch(/token|secret|ghp_/i);
  });

  it('exposes no web-accessible resources', () => {
    // The manager page is opened with chrome.tabs.create, never embedded by a
    // web page, so nothing in the extension needs to be reachable from pages.
    const manifest = JSON.parse(read('public/manifest.json'));
    expect(manifest.web_accessible_resources).toBeUndefined();
  });

  it('restricts the content script to LM Arena hosts only', () => {
    const manifest = JSON.parse(read('public/manifest.json'));
    const matches = manifest.content_scripts.flatMap((entry: { matches: string[] }) => entry.matches);
    for (const match of matches) {
      expect(match).toMatch(/^https:\/\/(www\.)?(lmarena\.ai|arena\.ai)\/\*$/);
    }
    expect(matches).toEqual([
      'https://lmarena.ai/*',
      'https://www.lmarena.ai/*',
      'https://arena.ai/*',
      'https://www.arena.ai/*',
    ]);
  });

  it('keeps the extension CSP locked to self', () => {
    const manifest = JSON.parse(read('public/manifest.json'));
    expect(manifest.content_security_policy.extension_pages).toBe("script-src 'self'; object-src 'self'");
  });

  it('declares icons that exist', () => {
    const manifest = JSON.parse(read('public/manifest.json'));
    for (const size of ['16', '32', '48', '128']) {
      expect(manifest.icons[size]).toBe(`icons/icon${size}.png`);
      expect(existsSync(resolve(root, 'public', manifest.icons[size]))).toBe(true);
    }
  });
});

describe('content script matches', () => {
  it('the config constant matches the manifest', () => {
    expect(LM_ARENA_CONTENT_SCRIPT_MATCHES).toHaveLength(4);
    const manifest = JSON.parse(read('public/manifest.json'));
    expect(manifest.content_scripts[0].matches).toEqual(LM_ARENA_CONTENT_SCRIPT_MATCHES);
  });
});

describe('no hardcoded skills', () => {
  it('source code contains no skill or category names from the example repository', () => {
    const files = ['src/core', 'src/services', 'src/integration', 'src/background', 'src/ui'];
    // Names from the example library must only ever appear in doc comments.
    const forbidden = ['kotlin-standards', 'react-best-practices', 'material-design', 'Jetpack Compose'];
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = resolve(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
    const all = files.flatMap((file) => walk(resolve(root, file)));
    for (const file of all) {
      // Only the dev-preview fixture may contain sample library names; it is
      // excluded from the production build and clearly not used at runtime.
      if (file.includes(`${sep}previewRuntime.ts`)) continue;
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
        .replace(/^\s*\/\/.*$/gm, ''); // line comments
      for (const name of forbidden) {
        expect(code, `${file} must not hardcode ${name} in executable code`).not.toContain(name);
      }
    }
  });
});
