#!/usr/bin/env node
/**
 * Produces the release artifacts:
 *   release/skillbridge-extension-<version>.zip   → Chrome "Load unpacked" / Web Store
 *   release/skillbridge-source-<version>.zip      → complete source tree
 *   release/CHECKSUMS.txt                          → SHA-256 of both archives
 *
 * The extension archive contains only the runtime files (no sources, tests or
 * dev tooling) and is verified to include every manifest reference.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const release = resolve(root, 'release');

const SOURCE_INCLUDE = [
  'src',
  'skills',
  'skill-library',
  'tests',
  'scripts',
  'public',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'popup.html',
  'manager.html',
  'index.html',
  'README.md',
  'DEVELOPMENT.md',
  'LICENSE',
  '.gitignore',
];

async function sha256File(path) {
  const buffer = await readFile(path);
  return createHash('sha256').update(buffer).digest('hex');
}

async function listFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(full, base)));
    else if (entry.isFile()) files.push(relative(base, full));
  }
  return files;
}

async function main() {
  if (!existsSync(dist)) {
    throw new Error('dist/ is missing — run `npm run build` first.');
  }
  const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'));
  const version = manifest.version;

  await rm(release, { recursive: true, force: true });
  await mkdir(release, { recursive: true });

  // Verify that every manifest-referenced file exists before zipping.
  const referenced = [
    manifest.background?.service_worker,
    ...(manifest.content_scripts ?? []).flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])]),
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ].filter(Boolean);
  const missing = referenced.filter((file) => !existsSync(join(dist, file)));
  if (missing.length) throw new Error(`dist/manifest.json references missing files: ${missing.join(', ')}`);

  const extZip = join(release, `skillbridge-extension-${version}.zip`);
  // Never ship build metadata or the source SVG inside the loadable extension.
  await rm(join(dist, '.build-info.json'), { force: true });
  await rm(join(dist, 'icons/icon.svg'), { force: true });
  const distFiles = (await listFiles(dist)).filter((file) => !file.startsWith('.'));
  await exec('zip', ['-r', '-9', '-X', extZip, ...distFiles], { cwd: dist });

  // Source archive: copy the whitelist into a staging tree then zip it.
  const staging = join(release, '.source');
  await mkdir(staging, { recursive: true });
  for (const item of SOURCE_INCLUDE) {
    const from = join(root, item);
    if (!existsSync(from)) continue;
    const info = await stat(from);
    if (info.isDirectory()) {
      const files = await listFiles(from, root);
      for (const file of files) {
        const target = join(staging, file);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(join(root, file), target);
      }
    } else {
      await copyFile(from, join(staging, item));
    }
  }
  const sourceZip = join(release, `skillbridge-source-${version}.zip`);
  const sourceFiles = await listFiles(staging);
  await exec('zip', ['-r', '-9', '-X', sourceZip, ...sourceFiles], { cwd: staging });
  await rm(staging, { recursive: true, force: true });

  const extensionHash = await sha256File(extZip);
  const sourceHash = await sha256File(sourceZip);
  await writeFile(
    join(release, 'CHECKSUMS.txt'),
    [
      `SkillBridge ${version} release artifacts`,
      `built: ${new Date().toISOString()}`,
      '',
      `${extensionHash}  skillbridge-extension-${version}.zip`,
      `${sourceHash}  skillbridge-source-${version}.zip`,
      '',
      'Extension size (KB):',
      ...(await Promise.all(
        distFiles
          .filter((file) => !file.startsWith('.'))
          .map(async (file) => {
            const info = await stat(join(dist, file));
            return `  ${String((info.size / 1024).toFixed(1)).padStart(7)}  ${file.split(sep).join('/')}`;
          }),
      )),
      '',
    ].join('\n'),
  );

  const extSize = (await stat(extZip)).size;
  const srcSize = (await stat(sourceZip)).size;
  console.log('Release artifacts');
  console.log(`  ✓ release/skillbridge-extension-${version}.zip  ${(extSize / 1024).toFixed(0)} KB  (${distFiles.length} files)`);
  console.log(`  ✓ release/skillbridge-source-${version}.zip     ${(srcSize / 1024).toFixed(0)} KB  (${sourceFiles.length} files)`);
  console.log(`  ✓ release/CHECKSUMS.txt`);
  console.log(`\nLoad unpacked: chrome://extensions → Developer mode → Load unpacked → select dist/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
