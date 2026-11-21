import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * UI build: popup.html + manager.html.
 * The service worker and content script are built separately by
 * scripts/build-targets.mjs so they can be emitted as stable,
 * self-contained files (see package.json "build:targets").
 */
export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    sourcemap: false,
    // The preview fixture is development-only; it is never shipped in dist/.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        manager: resolve(__dirname, 'manager.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    // `npm run package:zip` writes a staging copy of the sources here; watching
    // it would restart the dev server and reload the page mid-edit.
    watch: { ignored: ['**/release/**', '**/dist/**'] },
  },
});
