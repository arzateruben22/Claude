// Speck hunt for the hands mesh: vertices whose normal disagrees with their neighbours, triangles facing against
// their vertex normals, and dorsal vertices much darker (baked AO) than their neighbours.
//   node tools/preview-hands-specks.mjs [m|f] [cell mm]
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
// this checkout's top-speed-ultra (was the main checkout's, so a worktree measured the main checkout's code)
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(ROOT, 'tests/out/preview/build/hands-prof/geo3.mjs');
await build({ stdin: { contents: `export * from './src/preview/hands-geo.ts'; export * from './src/preview/hands-sdf.ts';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href + '?t=' + Date.now());
const g = M.buildArmGeometry(process.argv[2] ?? 'm', Number(process.argv[3] ?? 2.25));
const { idx, pos: P, nrm: N } = g.mesh, nv = P.length / 3, S = g.skin;
const nb = Array.from({ length: nv }, () => new Set());
let flipped = 0, degen = 0; const fl = [];
for (let t = 0; t < idx.length; t += 3) {
  const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
  nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  const e1 = [0, 1, 2].map((i) => P[b * 3 + i] - P[a * 3 + i]), e2 = [0, 1, 2].map((i) => P[c * 3 + i] - P[a * 3 + i]);
  const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(...fn); if (l < 1e-6) { degen++; continue; }
  const vn = [0, 1, 2].map((i) => N[a * 3 + i] + N[b * 3 + i] + N[c * 3 + i]);
  const d = (fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2]) / l / Math.hypot(...vn);
  if (d < 0.2) { flipped++; if (fl.length < 12) fl.push([a, d.toFixed(2)]); }
}
let bentN = 0, darkAo = 0; const bn = [], da = [];
for (let v = 0; v < nv; v++) {
  const s = [0, 0, 0]; let ao = 0;
  for (const u of nb[v]) { for (let i = 0; i < 3; i++) s[i] += N[u * 3 + i]; ao += S[u * 4 + 2]; }
  const k = nb[v].size; if (!k) continue;
  const c = (s[0] * N[v * 3] + s[1] * N[v * 3 + 1] + s[2] * N[v * 3 + 2]) / Math.hypot(...s);
  if (c < 0.8) { bentN++; if (bn.length < 12) bn.push(v); }
  if (S[v * 4 + 1] < 0.3 && S[v * 4 + 2] < ao / k - 0.08) { darkAo++; if (da.length < 12) da.push(v); }
}
const where = (v) => `${[0, 1, 2].map((i) => P[v * 3 + i].toFixed(0)).join(',')} ao ${S[v * 4 + 2].toFixed(2)} pal ${S[v * 4 + 1].toFixed(2)} along ${g.arm[v * 2].toFixed(0)}`;
console.log('verts', nv, 'tris', idx.length / 3, 'degenerate', degen, 'flipped tris', flipped, 'bent normals', bentN, 'dark-ao dorsal', darkAo);
console.log('flipped:', fl.map(([v, d]) => where(v) + ' d ' + d).join(' | '));
console.log('bent:', bn.map(where).join(' | '));
console.log('darkAo:', da.map(where).join(' | '));
// open-surface outliers: normal off from the neighbours by > 25 deg where the skin is open (ao > .6)
const open = [];
for (let v = 0; v < nv; v++) {
  const s = [0, 0, 0]; for (const u of nb[v]) for (let i = 0; i < 3; i++) s[i] += N[u * 3 + i];
  if (!nb[v].size) continue;
  const c = (s[0] * N[v * 3] + s[1] * N[v * 3 + 1] + s[2] * N[v * 3 + 2]) / Math.hypot(...s);
  // and the vertex off the plane of its ring (a pit or a spike), in mm
  const m = [0, 0, 0]; for (const u of nb[v]) for (let i = 0; i < 3; i++) m[i] += P[u * 3 + i] / nb[v].size;
  const h = (P[v * 3] - m[0]) * N[v * 3] + (P[v * 3 + 1] - m[1]) * N[v * 3 + 1] + (P[v * 3 + 2] - m[2]) * N[v * 3 + 2];
  if (S[v * 4 + 2] > 0.6 && (c < 0.9 || h < -0.6)) open.push(where(v) + ` cos ${c.toFixed(2)} h ${h.toFixed(2)}`);
}
console.log('open-surface outliers', open.length); console.log(open.slice(0, 30).join('\n'));
