// Sweep the hands' grip pose and score what the driver's eye sees: per finger, points on the nail and tip with a
// clear line of sight (sphere-traced through the hand's field and the rim), and how square-on the back of the hand is.
//   node tools/preview-hands-sweep.mjs '{"alpha":[0.5,0.6],"ulnar":[0.4,0.6]}' [m|f]
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(ROOT, 'tests/out/preview/build/hands-sweep/sdf.mjs');
await build({ stdin: { contents: `export * from './src/preview/hands-sdf.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href);
const grid = JSON.parse(process.argv[2] ?? '{}'), pres = process.argv[3] ?? 'm';
const base = JSON.parse(JSON.stringify(M.POSE));
const keys = Object.keys(grid);
const eyeG = M.wToG(M.carToW([-0.37, 1.16, 0.1]));
const combos = keys.reduce((acc, k) => acc.flatMap((c) => grid[k].map((v) => ({ ...c, [k]: v }))), [{}]);
const results = [];
for (const c of combos) {
  Object.assign(M.POSE, JSON.parse(JSON.stringify(base)));
  for (const [k, v] of Object.entries(c)) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(M.POSE[k], v); else M.POSE[k] = v; }
  const A = M.buildAnatomy(pres), f = A.field;
  const vis = (p) => {
    const dir = M.norm(M.sub(eyeG, p));
    let t = 0;
    for (let i = 0; i < 300 && t < 260; i++) {
      const q = M.madd(p, dir, t), d = Math.min(f.eval(q[0], q[1], q[2], null, 0), M.rimSdfG(q[0], q[1], q[2]));
      if (d < 0.05 && t > 0.3) return false;
      t += Math.max(0.25, d);
    }
    return true;
  };
  const surf = (c0, n) => { let r = 0; for (; r < 16; r += 0.25) { const q = M.madd(c0, n, r); if (f.eval(q[0], q[1], q[2], null, 0) > 0) break; } return M.madd(c0, n, r + 0.6); };
  const per = A.digits.map((d) => {
    const J2 = d.joints[2], J3 = d.joints[3], dir = d.dirs[2], up = d.dorsal[2], lat = M.norm(M.cross(dir, up)), L = M.len(M.sub(J3, J2));
    let nv = 0, tv = 0;
    for (const s of [0.5, 0.65, 0.8]) for (const w of [-0.45, 0, 0.45]) if (vis(surf(M.madd(M.madd(J2, dir, L * s), lat, w * d.halfW[2] * 0.7), up))) nv++;
    for (const a of [-50, -25, 0, 25, 50]) { const th = a * Math.PI / 180; if (vis(surf(M.madd(J2, dir, L * 0.72), M.norm(M.madd(M.mul(dir, Math.cos(th)), up, Math.sin(th)))))) tv++; }
    return [nv, tv];
  });
  const N = A.palm.N, eC = M.norm(M.sub(eyeG, A.mcp[1]));
  const fing = per.slice(0, 4);
  const score = fing.reduce((s, [n, t]) => s + Math.min(1, (n + t) / 4), 0);
  results.push({ c, nEye: M.dot(N, eC), per, score, flex: A.digits.map((d) => d.flex.map((x) => Math.round(x)).join('/')).join(' '), thumbTip: A.digits[4].joints[3].map((x) => Math.round(x)).join(',') });
}
results.sort((a, b) => b.score - a.score || b.nEye - a.nEye);
for (const r of results.slice(0, 14)) console.log(r.score.toFixed(2), 'Neye', r.nEye.toFixed(2), JSON.stringify(r.c), r.per.map(([n, t]) => `${n}/9,${t}/5`).join(' '), '|', r.flex, '| thumbTip', r.thumbTip);
