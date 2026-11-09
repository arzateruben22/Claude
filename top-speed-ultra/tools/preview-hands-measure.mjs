// The hands' proportions as built (hands-sdf.ts measureHand) and the build cost per presentation and quality.
//   node tools/preview-hands-measure.mjs
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
// this checkout's top-speed-ultra (was the main checkout's, so a worktree measured the main checkout's code)
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(ROOT, 'tests/out/preview/build/hands-prof/measure.mjs');
await build({ stdin: { contents: `export * from './src/preview/hands-geo.ts'; export * from './src/preview/hands-sdf.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href + '?t=' + Date.now());
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
for (const pres of ['m', 'f']) {
  const A = M.buildAnatomy(pres), m = M.measureHand(A);
  console.log(`[${pres}] hand ${f1(m.handLen)} mm, palm ${f1(m.palmLen)} (${f2(m.palmShare)}), middle finger share ${f2(m.middleShare)}, thumb/middle ${f2(m.thumbShare)}`);
  for (const p of m.phalanx) console.log(`   ${p.name.padEnd(7)} phalanges ${p.mm.map(f1).join(' / ')} mm  ratio ${p.ratio.map(f2).join(' : ')}`);
  for (const w of m.width) console.log(`   ${w.name.padEnd(7)} width base ${f1(w.base)} tip ${f1(w.tip)} taper ${(w.taper * 100).toFixed(0)}%`);
  console.log(`   nails / last segment ${m.nailShare.map(f2).join(' ')}`);
  const tips = A.digits.slice(0, 4).map((d) => M.sectionAngle(d.joints[3]).toFixed(0)).join('/');
  const t = A.digits[4];
  console.log(`   fingertips round the rim (section angle) ${tips}; thumb tip ${t.joints[3].map((x) => x.toFixed(0)).join(',')} vs index knuckle ${A.mcp[0].map((x) => x.toFixed(0)).join(',')}; thumb flex MCP ${t.flex[1].toFixed(0)} IP ${t.flex[2].toFixed(0)}`);
}
for (const [pres, h] of [['m', 2.25], ['m', 3], ['f', 2.25]]) {
  const t0 = performance.now(); const g = M.buildArmGeometry(pres, h); const t1 = performance.now();
  console.log(`geometry ${pres} ${h} mm: ${(t1 - t0).toFixed(0)} ms (mesh ${g.mesh.stats.ms.toFixed(0)}), ${g.mesh.stats.verts} verts, ${g.mesh.stats.tris} tris per arm`);
}
