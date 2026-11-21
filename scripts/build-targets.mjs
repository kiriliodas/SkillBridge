#!/usr/bin/env node
/**
 * Builds the non-HTML extension targets:
 *   dist/background.js  — MV3 service worker (classic script, no imports)
 *   dist/content.js     — content script (classic script, no imports)
 *
 * Both are bundled with esbuild (shipped with Vite) as single, self-contained
 * IIFEs so the manifest needs no `type: module` and the content script can be
 * injected programmatically at runtime.
 */
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

const targets = [
  { entry: 'src/background/index.ts', out: 'background.js', label: 'service worker' },
  { entry: 'src/content/index.ts', out: 'content.js', label: 'content script' },
];

async function main() {
  await mkdir(dist, { recursive: true });

  for (const target of targets) {
    const outfile = resolve(dist, target.out);
    const result = await build({
      entryPoints: [resolve(root, target.entry)],
      outfile,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['chrome116'],
      minify: true,
      sourcemap: false,
      legalComments: 'none',
      logLevel: 'warning',
      define: { 'process.env.NODE_ENV': '"production"' },
      metafile: true,
    });
    const bytes = (await stat(outfile)).size;
    const inputs = Object.keys(result.metafile.outputs[outfile]?.inputs ?? {});
    console.log(
      `  ✓ dist/${target.out.padEnd(14)} ${(bytes / 1024).toFixed(1)} KB  (${target.label}, ${inputs.length} modules)`,
    );
  }

  // Manifest, HTML pages (already emitted by Vite) and icons.
  await copyFile(resolve(root, 'public/manifest.json'), resolve(dist, 'manifest.json'));
  console.log('  ✓ dist/manifest.json');

  if (!existsSync(resolve(dist, 'popup.html')) || !existsSync(resolve(dist, 'manager.html'))) {
    throw new Error('popup.html / manager.html missing — run `vite build` before build-targets.');
  }

  // public/ is copied by Vite, but re-copy icons so `build:targets` works
  // standalone after a partial build.
  await mkdir(resolve(dist, 'icons'), { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const source = resolve(root, `public/icons/icon${size}.png`);
    if (existsSync(source)) {
      await copyFile(source, resolve(dist, `icons/icon${size}.png`));
    }
  }
  console.log('  ✓ dist/icons/*');

  // Sanity check: the manifest must not reference files that do not exist.
  const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'));
  const referenced = [
    manifest.background?.service_worker,
    ...(manifest.content_scripts ?? []).flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])]),
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ].filter(Boolean);
  const missing = referenced.filter((file) => !existsSync(resolve(dist, file)));
  if (missing.length > 0) {
    throw new Error(`manifest references missing files: ${missing.join(', ')}`);
  }
  console.log(`  ✓ manifest references verified (${referenced.length} files)`);

  await writeFile(
    resolve(dist, '.build-info.json'),
    JSON.stringify(
      {
        name: manifest.name,
        version: manifest.version,
        builtAt: new Date().toISOString(),
        targets: targets.map((t) => t.out),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
