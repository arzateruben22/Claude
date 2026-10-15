// Pose sweep for the hands (no meshing): node tools/preview-hands-tune.mjs '[{"alpha":36},{...}]' [m|f]. Prints, per pose, how the back
// of the hand faces the eye, the knuckles' and fingertips' section angles, the nails toward the eye, the flexions, the thumb.
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(ROOT, 'tests/out/preview/build/hands-pose/sdf2.mjs');
await build({ stdin: { contents: `export * from './src/preview/hands-sdf.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href + '?t=' + Date.now());
const base = JSON.parse(JSON.stringify(M.POSE));
const eyeG = M.wToG(M.carToW([-0.37, 1.16, 0.1]));
const combos = JSON.parse(process.argv[2]);
const pres = process.argv[3] ?? 'm';
for (const po of combos) {
  const P = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(po)) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(P[k], v); else P[k] = v; }
  for (const k of Object.keys(P)) M.POSE[k] = P[k];
  if (P.alpha > 1) M.POSE.alpha = P.alpha * Math.PI / 180;
  if (P.ulnar > 1.6) M.POSE.ulnar = P.ulnar * Math.PI / 180;
  let A;
  try { A = M.buildAnatomy(pres); } catch (e) { console.log(JSON.stringify(po), 'ERR', e.message); continue; }
  const eC = M.norm(M.sub(eyeG, A.mcp[1]));
  const tips = A.digits.slice(0, 4).map((d) => M.sectionAngle(d.joints[3]).toFixed(0)).join('/');
  const mcps = A.digits.slice(0, 4).map((d) => M.sectionAngle(d.joints[0]).toFixed(0)).join('/');
  const nails = A.digits.map((d) => M.dot(d.dorsal[2], M.norm(M.sub(eyeG, d.joints[3]))).toFixed(2)).join('/');
  const flex = A.digits.slice(0, 4).map((d) => d.flex.map((x) => x.toFixed(0)).join(',')).join(' ');
  const rimd = A.digits.slice(0, 4).map((d) => d.joints.slice(1).map((j) => M.rimSdfG(j[0], j[1], j[2]).toFixed(0)).join(",")).join(" ");
  if (process.env.SHORT) { console.log(JSON.stringify(po).padEnd(70), "N.eye", M.dot(A.palm.N, eC).toFixed(2), "mcp", mcps, "tips", tips, "nail", nails, "flex", flex, "rimd", rimd); continue; }
  console.log(JSON.stringify(po).padEnd(60), 'N.eye', M.dot(A.palm.N, eC).toFixed(2), 'mcp', mcps, 'tips', tips, 'nail', nails, 'flex', flex, 'thumb', M.thumbScore.toFixed(1), JSON.stringify(M.thumbTerms, (k, v) => typeof v === 'number' ? +v.toFixed(0) : v));
}
