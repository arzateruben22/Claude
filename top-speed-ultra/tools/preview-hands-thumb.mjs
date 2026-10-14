// Thumb solve sweep (no meshing): node tools/preview-hands-thumb.mjs '[{"thumb":{"cmc":[14,-22,17]}}, ...]' [m|f]
// Prints, per pose, the thumb's joints (G, mm), its section angles, flexions and the solver's terms.
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(ROOT, 'tests/out/preview/build/hands-pose/sdf3.mjs');
await build({ stdin: { contents: `export * from './src/preview/hands-sdf.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href + '?t=' + Date.now());
const base = JSON.parse(JSON.stringify(M.POSE));
const pres = process.argv[3] ?? 'm';
for (const po of JSON.parse(process.argv[2])) {
  const P = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(po)) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(P[k], v); else P[k] = v; }
  for (const k of Object.keys(P)) M.POSE[k] = P[k];
  for (const k of ["alpha", "ulnar", "roll"]) if (Math.abs(P[k]) > 1.6) M.POSE[k] = P[k] * Math.PI / 180;
  let A;
  for (const k in M.thumbRej) M.thumbRej[k] = 0;
  try { A = M.buildAnatomy(pres); } catch (e) { console.log(JSON.stringify(po), 'ERR', e.message, JSON.stringify(M.thumbRej)); continue; }
  const t = A.digits[4];
  const f = (v) => v.map((x) => x.toFixed(0)).join(',');
  console.log(JSON.stringify(po));
  console.log('  joints', t.joints.map(f).join(' | '), ' phi', t.joints.map((p) => M.sectionAngle(p).toFixed(0)).join('/'), ' rimD', t.joints.map((p) => M.rimSdfG(...p).toFixed(0)).join('/'));
  console.log('  cmc0', A.digits[4].joints[0].map(x=>x.toFixed(0)).join(','), 'wrist', A.wrist.map(x=>x.toFixed(0)).join(','), 'N', A.palm.N.map(x=>x.toFixed(2)).join(','), 'tips', A.digits.slice(0,4).map(d=>M.sectionAngle(d.joints[3]).toFixed(0)).join('/'));
  console.log('  score', M.thumbScore.toFixed(2), JSON.stringify(M.thumbTerms, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v), 'q', M.thumbQ.map((x) => x.toFixed(1)).join(','), ' indexMCP', f(A.mcp[0]), 'indexTip', f(A.digits[0].joints[3]));
}
