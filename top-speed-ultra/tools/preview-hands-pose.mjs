// Quick numbers for the hands grip pose (no meshing): per digit the flexion, where each joint sits round the rim section,
// and whether the nail faces the driver eye.  node tools/preview-hands-pose.mjs [poseJSON] [m|f]
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(ROOT, 'tests/out/preview/build/hands-pose/sdf.mjs');
await build({ stdin: { contents: `export * from './src/preview/hands-sdf.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href + '?t=' + Date.now());
const po = JSON.parse(process.argv[2] ?? '{}');
for (const [k, v] of Object.entries(po)) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(M.POSE[k], v); else M.POSE[k] = v; }
const pres = process.argv[3] ?? 'm';
const t0 = performance.now();
const A = M.buildAnatomy(pres);
console.log('anatomy ms', (performance.now() - t0).toFixed(1), 'thumbScore', M.thumbScore?.toFixed?.(2), 'q', JSON.stringify(M.thumbQ), JSON.stringify(M.thumbTerms, (k, v) => typeof v === 'number' ? +v.toFixed(1) : v), 'iMCP', A.mcp[0].map(Math.round).join(','));
const eyeW = M.carToW([-0.37, 1.16, 0.1]);
const eyeG = M.wToG(eyeW);
const ph = (p) => M.sectionAngle(p).toFixed(0);
for (const d of A.digits) {
  const tip = d.joints[3];
  const e = M.norm(M.sub(eyeG, tip));
  const nailDot = M.dot(d.dorsal[2], e);
  console.log(d.name.padEnd(7), 'flex', d.flex.map((x) => x.toFixed(0)).join('/').padEnd(10), 'phi', d.joints.map(ph).join(' > ').padEnd(22), 'tip', tip.map((x) => x.toFixed(0)).join(','), 'nail.eye', nailDot.toFixed(2), 'dorsal', d.dorsal[2].map((x) => x.toFixed(2)).join(','));
}
for (const d of A.digits) console.log('  ', d.name.padEnd(7), d.joints.map((j) => j.map((x) => x.toFixed(0)).join(',')).join(' | '));
const N = A.palm.N, P = A.palm.P;
const eC = M.norm(M.sub(eyeG, A.mcp[1]));
console.log('N', N.map((x) => x.toFixed(2)).join(','), 'N.eye', M.dot(N, eC).toFixed(2), 'P', P.map((x) => x.toFixed(2)).join(','));
console.log('wrist', A.wrist.map((x) => x.toFixed(0)).join(','), 'elbow', A.elbow.map((x) => x.toFixed(0)).join(','));
const me = M.measureHand(A);
console.log('hand length', me.handLen.toFixed(1), 'palm', me.palmLen.toFixed(1), `(${(me.palmShare * 100).toFixed(0)}%)`, 'middle finger', `${(me.middleShare * 100).toFixed(0)}%`, 'thumb/middle', me.thumbShare.toFixed(2));
for (const p of me.phalanx) console.log(' ', p.name.padEnd(7), p.mm.map((x) => x.toFixed(1)).join(' : '), ' ratio', p.ratio.map((x) => x.toFixed(2)).join(' : '));
for (const w of me.width) console.log(' ', w.name.padEnd(7), 'base', w.base.toFixed(1), 'tip', w.tip.toFixed(1), 'taper', (w.taper * 100).toFixed(0) + '%');
console.log('  nail / last segment', me.nailShare.map((x) => x.toFixed(2)).join(' '));
// what the driver's eye can see of each fingertip: sphere-trace from points on the nail and the tip toward the eye,
// through the hand's field and the rim
{
  const f = A.field;
  const vis = (p) => {
    const dir = M.norm(M.sub(eyeG, p));
    let t = 0;
    for (let i = 0; i < 300 && t < 260; i++) {
      const q = M.madd(p, dir, t);
      const d = Math.min(f.eval(q[0], q[1], q[2], null, 0), M.rimSdfG(q[0], q[1], q[2]));
      if (d < 0.05 && t > 0.3) return false;
      t += Math.max(0.25, d);
    }
    return true;
  };
  const rows = [];
  for (const d of A.digits) {
    const J2 = d.joints[2], J3 = d.joints[3], dir = d.dirs[2], up = d.dorsal[2], lat = M.norm(M.cross(dir, up));
    const L = M.len(M.sub(J3, J2));
    let nv = 0, nt = 0, tv = 0, tt = 0;
    for (const s of [0.45, 0.55, 0.65, 0.75]) for (const w of [-0.5, 0, 0.5]) {
      const c = M.madd(J2, dir, L * s);
      // march out from the bone axis along the dorsal to the skin, then lift a little
      let r = 0; for (; r < 15; r += 0.2) { const q = M.madd(M.madd(c, up, r), lat, w * d.halfW[2] * 0.7); if (f.eval(q[0], q[1], q[2], null, 0) > 0) break; }
      const p = M.madd(M.madd(M.madd(c, up, r + 0.6), lat, w * d.halfW[2] * 0.7), [0, 0, 0], 0);
      nt++; if (vis(p)) nv++;
    }
    for (const a of [-60, -30, 0, 30, 60]) {
      const th = a * Math.PI / 180, n = M.norm(M.madd(M.mul(dir, Math.cos(th)), up, Math.sin(th)));
      let r = 0; for (; r < 15; r += 0.2) { const q = M.madd(M.madd(J2, dir, L * 0.75), n, r); if (f.eval(q[0], q[1], q[2], null, 0) > 0) break; }
      const p = M.madd(M.madd(J2, dir, L * 0.75), n, r + 0.6);
      tt++; if (vis(p)) tv++;
    }
    rows.push(`${d.name} nail ${nv}/${nt} tip ${tv}/${tt}`);
  }
  console.log('visible from the eye:', rows.join(' | '));
}
