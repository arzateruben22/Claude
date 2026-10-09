import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative paths so the build runs from any folder (or a file:// double-click via scripts/single-file.mjs).
export default defineConfig({
  base: './',
  plugins: [react()],
  json: { stringify: true },      // the network data is ~2 MB: JSON.parse beats a JS object literal
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: undefined, inlineDynamicImports: true } },
  },
  server: { host: '127.0.0.1' },
});
