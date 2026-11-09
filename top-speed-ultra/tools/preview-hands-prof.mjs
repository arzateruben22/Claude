// Times the hands build in node: the anatomy (hands-sdf) and the meshed arm with its per-vertex data (hands-geo).
//   node tools/preview-hands-prof.mjs
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
// this checkout's top-speed-ultra (was the main checkout's, so a worktree measured the main checkout's code)
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(ROOT, 'tests/out/preview/build/hands-prof/geo.mjs');
await build({ stdin: { contents: `export * from './src/preview/hands-geo.ts'; export * from './src/preview/hands-sdf.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href);
for (const [pres, h] of [['m', 2], ['m', 3], ['f', 2]]) {
  const t0 = performance.now();
  const A = M.buildAnatomy(pres);
  const t1 = performance.now();
  const g = M.buildArmGeometry(pres, h);
  const t2 = performance.now();
  console.log(pres, h, 'anatomy', (t1 - t0).toFixed(0), 'geo total', (t2 - t1).toFixed(0), 'mesh', g.mesh.stats.ms.toFixed(0), 'verts', g.mesh.stats.verts, 'tris', g.mesh.stats.tris);
}
