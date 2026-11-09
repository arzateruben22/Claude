import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { trimSlice as lot57Slice } from './src/onfoot/vite.config';
import { trimSlice as barSlice } from './src/onfoot/vite.sportsbar.config';

// Relative paths so the build runs from any folder (or a file:// double-click via scripts/single-file.mjs).
// The on-foot venues (Lot 57, Stoppage Time) are dynamic imports: their own chunks, loaded only when you get out of
// the car (src/game/onfoot.ts), so the game boots as before; scripts/single-file.mjs folds every chunk into the page.
// Their map slices are trimmed at build time by the venues' own plugins, as on their standalone pages.
export default defineConfig({
  base: './',
  plugins: [react(), lot57Slice(), barSlice()],
  json: { stringify: true },      // the network data is ~2 MB: JSON.parse beats a JS object literal
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 0,
    modulePreload: false,
    rollupOptions: { output: { manualChunks: undefined } },
  },
  server: { host: '127.0.0.1' },
});
