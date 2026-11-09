// The sports bar's own build (PROJECT_OC_SPORTS_BAR.md, the module map's index.html and vite.config.ts row): a
// standalone page, so the game's vite config and Lot 57's stay as they are. From the game folder:
//   npx vite --config src/onfoot/vite.sportsbar.config.ts              dev server (port 5758; Lot 57's is 5757)
//   npx vite build --config src/onfoot/vite.sportsbar.config.ts        dist/sportsbar/sportsbar.html, one file
// Its root is src/onfoot/, like Lot 57's, so the input is set to sportsbar.html (the default would be Lot 57's
// index.html), and it writes its own folder, so neither build empties the other's.
import { defineConfig, Plugin } from 'vite';

const here = decodeURIComponent(new URL('./', import.meta.url).pathname).replace(/\/$/, '');
const out = decodeURIComponent(new URL('../../dist/sportsbar/', import.meta.url).pathname);
const game = decodeURIComponent(new URL('../../', import.meta.url).pathname);

/** COPY of lot57's vite.config.ts single-file plugin (E0 moves it to engine/): the bundled script folded into the
 *  page, so it opens straight from disk and can be published as one file */
function singleFile(): Plugin {
  return {
    name: 'sportsbar-single-file',
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

/** the bar's slice (OpenStreetMap via Overture, ODbL) as the page reads it: the connectors' positions, the building
 *  parts, the land cover and the key notes stay out (the page reads the segments' connector ids, not their points);
 *  the attribution, the licences and the slice's own description stay in. The source file isn't changed. */
export function trimSlice(): Plugin {
  return {
    name: 'sportsbar-trim-slice',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]data[\\/]anaheim[\\/]sportsbar-slice\.json$/.test(id.split('?')[0])) return null;
      const S = JSON.parse(code) as Record<string, unknown> & { venue: Record<string, unknown> & { site: Record<string, unknown> } };
      const venue = { x: S.venue.x, z: S.venue.z, bld: S.venue.bld, note: S.venue.note, site: { lot_p: S.venue.site.lot_p } };
      const keep = ['v', 'what', 'attribution', 'licences', 'origin', 'units', 'box', 'dict', 'seg', 'bld', 'landuse', 'water', 'infra', 'infra_pts'];
      const outJ: Record<string, unknown> = { trimmed: 'Trimmed at build time to the fields the page reads (src/onfoot/vite.sportsbar.config.ts).', venue };
      for (const k of keep) outJ[k] = S[k];
      return { code: JSON.stringify(outJ), map: null };
    },
  };
}

export default defineConfig({
  root: here,
  base: './',
  json: { stringify: true },
  plugins: [trimSlice(), singleFile()],
  build: {
    outDir: out,
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 100000000,
    modulePreload: false,
    rollupOptions: { input: `${here}/sportsbar.html`, output: { inlineDynamicImports: true, manualChunks: undefined } },
  },
  server: { host: '127.0.0.1', port: 5758, fs: { allow: [game] } },
});
