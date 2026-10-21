// The on-foot page's own build (Phase 1 of PROJECT_OC_ON_FOOT.md: a standalone page, so the game's vite config and
// package.json stay as they are). From the game folder:
//   npx vite --config src/onfoot/vite.config.ts                 dev server (src/onfoot/index.html)
//   npx vite build --config src/onfoot/vite.config.ts           dist/onfoot/index.html, one self-contained file
// The build folds the script into the page, so it opens straight from disk and can be published as one file.
import { defineConfig, Plugin } from 'vite';
import { ORIGIN, DATA_VIEW } from './lot57/coords';

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

/**
 * Trim src/data/anaheim/slice.json (OpenStreetMap via Overture, ODbL) to what lot57/data.ts draws: the features with a
 * point inside DATA_VIEW (plus a margin) and only the fields it reads. The connectors, building parts, water, land
 * cover, the place keys and every name but the street names of the segments kept stay out of the page. The
 * attribution and licence records stay in. The source file isn't changed.
 */
function trimSlice(): Plugin {
  return {
    name: 'lot57-trim-slice',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]data[\\/]anaheim[\\/]slice\.json$/.test(id.split('?')[0])) return null;
      type Feat = { c?: number | string; s?: number; n?: number; p?: number[]; ow?: number; hl?: number[][]; h?: number; mh?: number; l?: number[] };
      const S = JSON.parse(code) as Record<string, unknown> & { dict: Record<string, string[]>; seg: Feat[]; bld: Feat[]; landuse: Feat[]; infra: Feat[]; infra_pts: number[] };
      const pad = 60, dm = 10;   // metres of margin; the slice is in decimetres, game coordinates
      const x0 = (ORIGIN.x + DATA_VIEW.x0 - pad) * dm, x1 = (ORIGIN.x + DATA_VIEW.x1 + pad) * dm;
      const z0 = (ORIGIN.z + DATA_VIEW.z0 - pad) * dm, z1 = (ORIGIN.z + DATA_VIEW.z1 + pad) * dm;
      const near = (p?: number[]) => {
        if (!p) return false;
        let x = 0, z = 0;
        for (let i = 0; i < p.length; i += 2) { x += p[i]; z += p[i + 1]; if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true; }
        return false;
      };
      const seg = S.seg.filter((f) => near(f.p)).map((f) => ({ c: f.c, s: f.s, n: f.n, p: f.p, ow: f.ow }));
      const used = new Set(seg.map((f) => f.n).filter((n) => n !== undefined));
      const bld = S.bld.filter((f) => near(f.p)).map((f) => ({ p: f.p, hl: f.hl, h: f.h, mh: f.mh, c: f.c }));
      const landuse = S.landuse.filter((f) => near(f.p)).map((f) => ({ c: f.c, p: f.p }));
      const infra = S.infra.filter((f) => near(f.p)).map((f) => ({ c: f.c, p: f.p, hl: f.hl }));
      const pts: number[] = [];
      for (let i = 0; i < S.infra_pts.length; i += 3) { const x = S.infra_pts[i + 1], z = S.infra_pts[i + 2]; if (x >= x0 && x <= x1 && z >= z0 && z <= z1) pts.push(S.infra_pts[i], x, z); }
      const D = S.dict;
      const out = {
        v: S.v, what: S.what, attribution: S.attribution, licences: S.licences, origin: S.origin, units: S.units,
        trimmed: 'Trimmed at build time to the page\'s view box and the fields it reads (src/onfoot/vite.config.ts).',
        dict: { seg: D.seg, sub: D.sub, name: D.name.map((n, i) => (used.has(i) ? n : '')), bcls: D.bcls, lu: D.lu, infra: D.infra },
        seg, bld, landuse, infra, infra_pts: pts,
      };
      return { code: JSON.stringify(out), map: null };
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
    rollupOptions: { output: { inlineDynamicImports: true, manualChunks: undefined } },
  },
  server: { host: '127.0.0.1', port: 5757, fs: { allow: [game] } },
});
