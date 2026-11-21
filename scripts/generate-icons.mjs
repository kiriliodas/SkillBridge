#!/usr/bin/env node
/**
 * Renders public/icons/icon{16,32,48,128}.png from icon.svg.
 *
 * Requires either ImageMagick (`convert`, needs an SVG delegate) or the
 * `sharp` package. The PNGs are committed, so this is only needed when the
 * SVG changes.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const icons = resolve(root, 'public/icons');
const sizes = [16, 32, 48, 128];

async function withSharp() {
  const sharp = (await import('sharp')).default;
  for (const size of sizes) {
    await sharp(resolve(icons, 'icon.svg'), { density: 384 })
      .resize(size, size, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toFile(resolve(icons, `icon${size}.png`));
  }
}

async function withImageMagick() {
  for (const size of sizes) {
    await exec('convert', [
      '-background',
      'none',
      resolve(icons, 'icon.svg'),
      '-resize',
      `${size}x${size}`,
      resolve(icons, `icon${size}.png`),
    ]);
  }
}

try {
  await withSharp();
  console.log('icons written with sharp');
} catch {
  try {
    await withImageMagick();
    console.log('icons written with ImageMagick');
  } catch (error) {
    console.error('Could not render icons. Install sharp (`npm i -D sharp`) or ImageMagick with SVG support.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
