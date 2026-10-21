// The on-foot page's own build (Phase 1 of PROJECT_OC_ON_FOOT.md: a standalone page, so the game's vite config and
// package.json stay as they are). From the game folder:
//   npx vite --config src/onfoot/vite.config.ts                 dev server (src/onfoot/index.html)
//   npx vite build --config src/onfoot/vite.config.ts           dist/onfoot/index.html, one self-contained file
// The build folds the script into the page, so it opens straight from disk and can be published as one file.
import { defineConfig, Plugin } from 'vite';

// (URLs rather than node:path, so this file typechecks with the page's DOM-only settings)
const here = decodeURIComponent(new URL('./', import.meta.url).pathname).replace(/\/$/, '');
const out = decodeURIComponent(new URL('../../dist/onfoot/', import.meta.url).pathname);
const game = decodeURIComponent(new URL('../../', import.meta.url).pathname);

/** inline the bundled script into index.html (a module script can't load from file://) */
function singleFile(): Plugin {
  return {
    name: 'lot57-single-file',
    enforce: 'post',
    generateBundle(_o, bundle) {
      const html = Object.values(bundle).find((b) => b.type === 'asset' && b.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let src = String(html.source);
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const tag = new RegExp(`<script[^>]*src="[^"]*${chunk.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></script>`);
        const code = chunk.code.replace(/<\/script/gi, '<\\/script');
        src = src.replace(tag, () => `<script type="module">${code}</script>`);
        delete bundle[name];
      }
      html.source = src;
    },
  };
}

export default defineConfig({
  root: here,
  base: './',
  json: { stringify: true },
  plugins: [singleFile()],
  build: {
    outDir: out,
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 100000000,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true, manualChunks: undefined } },
  },
  server: { host: '127.0.0.1', port: 5757, fs: { allow: [game] } },
});
