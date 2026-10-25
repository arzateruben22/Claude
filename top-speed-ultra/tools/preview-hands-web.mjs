// The first web space as the driver's eye sees it (no meshing): rays from the eye through a band across the web
// (the index MCP -> thumb MCP line, +-8 mm either side) must meet skin before the rim's leather (no slit of rim
// through the web), and the thumb's MCP must keep its abduction off the index's metacarpal (the web a saddle between
// two digits, not the thumb lying flat on the side of the palm). Across the thumb's first phalanx (at 25, 50 and 75%
// from the MCP to the IP), rays from the eye measure how far the thumb's crest stands proud of the skin beside it
// toward the index (the valley that makes it read as a digit of its own along its length, not only past the IP).
// Prints the skin's height toward the eye along the line, the valleys, the thumb solver's terms (flexions, hinge
// twist, nail cosine, sink, clash, cover, web) and PASS/FAIL against the acceptance used for the owner's "fix the
// thumbs" (2026-10-21).
//   node tools/preview-hands-web.mjs [m|f]
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(ROOT, 'tests/out/preview/build/hands-pose/sdf-web.mjs');
await build({ stdin: { contents: `export * from './src/preview/hands-sdf.ts'; export * from './src/preview/spec.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href + '?t=' + Date.now());
const pres = process.argv[2] ?? 'm';
const t0 = performance.now();
const A = M.buildAnatomy(pres), f = A.field, t = A.digits[4];
const anatomyMs = performance.now() - t0;
const E = M.EYE, eyeG = M.wToG(M.carToW([E.x, E.y, E.z]));
const a = A.mcp[0], b = t.joints[1], ab = M.sub(b, a);
const toEye0 = M.norm(M.sub(eyeG, M.lerp3(a, b, 0.5)));
const side = M.norm(M.cross(toEye0, M.norm(ab)));
// march from the eye toward each sample until skin or rim
const first = (p) => {
  const dir = M.norm(M.sub(p, eyeG)), L = M.len(M.sub(p, eyeG));
  let tt = Math.max(0, L - 120);
  for (let i = 0; i < 4000 && tt < L + 60; i++) {
    const q = M.madd(eyeG, dir, tt);
    const ds = f.eval(q[0], q[1], q[2], null, 0), dr = M.rimSdfG(q[0], q[1], q[2]);
    const d = Math.min(ds, dr);
    if (d < 0.05) return { what: ds <= dr ? 'skin' : 'rim', t: tt, depth: tt - L };
    tt += Math.max(0.1, d * 0.8);
  }
  return { what: 'none', t: Infinity, depth: Infinity };
};
let rimHits = 0, n = 0;
const profile = [];
for (let i = 0; i <= 20; i++) {
  const s = i / 20;
  let rowRim = 0, nearest = Infinity;
  for (const off of [-8, -4, 0, 4, 8]) {
    const p = M.madd(M.lerp3(a, b, s), side, off), r = first(p);
    n++; if (r.what === 'rim') { rimHits++; rowRim++; }
    nearest = Math.min(nearest, r.depth);
  }
  profile.push({ s: +s.toFixed(2), rimHits: rowRim, skinTowardEye: +(-nearest).toFixed(1) });
}
const h = profile.map((r) => r.skinTowardEye);
console.log(`[${pres}] anatomy ${anatomyMs.toFixed(0)} ms (pinned q: ${M.POSE.thumb.q[pres] ? 'yes' : 'no, searched'})`);
console.log(`eye rays across the web (21 stations x 5): ${rimHits} of ${n} meet the rim's leather before skin`);
console.log(`skin height toward the eye along the index MCP -> thumb MCP line (mm from the line): index end ${h[0]}, between ${Math.min(...h.slice(4, 17))}..${Math.max(...h.slice(4, 17))}, thumb end ${h[20]}`);
console.log(profile.map((r) => `${r.s}:${r.skinTowardEye}${r.rimHits ? 'R' + r.rimHits : ''}`).join(' '));
// the valley beside the thumb's first phalanx: rays across it (perpendicular to it as the eye sees it), the crest's
// height toward the eye (offsets -4..6 mm) less the lowest skin beside it toward the index (offsets 8..20 mm)
const valley = (u) => {
  const Q = M.lerp3(t.joints[1], t.joints[2], u), ax = M.norm(M.sub(t.joints[2], t.joints[1]));
  const s0 = M.norm(M.cross(M.norm(M.sub(Q, eyeG)), ax)), sd = M.dot(M.sub(A.mcp[0], Q), s0) > 0 ? s0 : M.mul(s0, -1);
  let crest = -Infinity, low = Infinity;
  for (let o = -4; o <= 20; o += 2) {
    const r = first(M.madd(Q, sd, o));
    if (r.what !== 'skin') continue;
    if (o <= 6) crest = Math.max(crest, -r.depth); else low = Math.min(low, -r.depth);
  }
  return crest - low;
};
const vals = [0.25, 0.5, 0.75].map(valley);
console.log(`the thumb's first phalanx stands proud of the skin beside it (mm, at 25/50/75% from the MCP): ${vals.map((v) => v.toFixed(1)).join(' / ')}`);
// the thumb as solved: joints, section angles, distance off the leather, and the solver's terms
const fmt = (v) => v.map((x) => x.toFixed(0)).join(',');
console.log('thumb joints (G mm)', t.joints.map(fmt).join(' | '), ' section', t.joints.map((p) => M.sectionAngle(p).toFixed(0)).join('/'), ' off the leather', t.joints.map((p) => M.rimSdfG(...p).toFixed(1)).join('/'));
const T = M.thumbTerms;
console.log('terms', JSON.stringify(T, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
// off the wheel (the abilities' poses) the thumb bone turns the thumb about its MCP POSE.thumb.offCurl of the way
// toward the index finger's middle phalanx (hands.ts): the curled thumb must point at the curled fingers (not stand up
// from them as a thumbs-up) and clear them (axis to axis, less 0.8 of both half widths)
const segD = (p, a, b) => { const ab = M.sub(b, a), s = Math.max(0, Math.min(1, M.dot(M.sub(p, a), ab) / M.dot(ab, ab))); return M.len(M.sub(p, M.madd(a, ab, s))); };
const segSeg = (a, b, c, e) => { let m = 1e9; for (let i = 0; i <= 10; i++) { const s = i / 10; m = Math.min(m, segD(M.lerp3(a, b, s), c, e), segD(M.lerp3(c, e, s), a, b)); } return m; };
const Mj = t.joints[1], goal = M.lerp3(A.digits[0].joints[1], A.digits[0].joints[2], 0.5);
const ca = M.norm(M.sub(t.joints[3], Mj)), cb = M.norm(M.sub(goal, Mj)), cAxis = M.norm(M.cross(ca, cb));
const cFull = Math.acos(Math.max(-1, Math.min(1, M.dot(ca, cb)))), cAng = cFull * M.POSE.thumb.offCurl;
const CJ = t.joints.map((p, i) => (i < 2 ? p : M.add(Mj, M.rot(M.sub(p, Mj), cAxis, cAng))));
let curlGap = 1e9;
A.digits.slice(0, 4).forEach((g) => { for (let k = 0; k < 3; k++) for (let j = 1; j < 3; j++) curlGap = Math.min(curlGap, segSeg(CJ[j], CJ[j + 1], g.joints[k], g.joints[k + 1]) - 0.8 * (t.halfW[j] + g.halfW[k])); });
const curlLeft = ((cFull - cAng) * 180) / Math.PI;
console.log(`off the wheel: the thumb turns ${((cAng * 180) / Math.PI).toFixed(1)} deg about its MCP (of ${((cFull * 180) / Math.PI).toFixed(1)} to the index's middle phalanx), ${curlLeft.toFixed(1)} deg short of it; ${curlGap.toFixed(1)} mm clear of the fingers`);
// acceptance: no slit, hinges within 30 deg, the nail to the eye, nothing sunk into the rim or the index, the
// fingertips in view, the MCP off the index metacarpal (the open web)
const checks = [
  ['no rim through the web', rimHits === 0],
  ['hinge twist <= 30 deg', T.twist <= 30],
  ['nail cosine >= 0.9', T.nail >= 0.9],
  ['no sink', T.sink < 0.01],
  ['no clash with the index', T.clash < 0.01],
  ['fingertips in view (cover 0)', T.cover < 0.01],
  ['web >= 20 mm', T.webD >= 20],
  ['IP flexion 12..60 deg (the thumb reads in two segments)', T.fI >= 12 && T.fI <= 60],
  ['the first phalanx >= 5 mm proud of the web beside it at 25, 50 and 75%', vals.every((v) => v >= 5)],
  ['off the wheel the thumb rests on the curled fingers: within 20 deg of the index middle phalanx, 2-8 mm clear', curlLeft <= 20 && curlGap >= 2 && curlGap <= 8],
];
for (const [name, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
