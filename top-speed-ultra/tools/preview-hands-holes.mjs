// Mesh check for the hands: open (boundary) edges and non-manifold edges of the meshed arm.
//   node tools/preview-hands-holes.mjs [m|f] [cell mm]
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
const out = '/home/user/Claude/top-speed-ultra/tests/out/preview/build/hands-prof/geo2.mjs';
await build({ stdin: { contents: `export * from './src/preview/hands-geo.ts'; export * from './src/preview/hands-sdf.ts';`, resolveDir: '/home/user/Claude/top-speed-ultra', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const M = await import(pathToFileURL(out).href + '?t=' + Date.now());
const g = M.buildArmGeometry(process.argv[2] ?? 'm', Number(process.argv[3] ?? 2));
const idx = g.mesh.idx, E = new Map();
for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
  const a = idx[t + e], b = idx[t + (e + 1) % 3], k = a < b ? a * 1e7 + b : b * 1e7 + a;
  E.set(k, (E.get(k) ?? 0) + 1);
}
let open = 0, nonman = 0; const pts = [];
for (const [k, c] of E) { if (c === 1) { open++; const a = Math.floor(k / 1e7); pts.push([...g.mesh.pos.slice(a * 3, a * 3 + 3)].map((x) => x.toFixed(0)).join(',') + ' along ' + g.arm[a * 2].toFixed(0)); } else if (c > 2) nonman++; }
console.log('tris', idx.length / 3, 'open edges', open, 'non-manifold', nonman);
console.log("hand-region open edges", pts.filter((s) => Number(s.split("along ")[1]) < 150).length, pts.filter((s) => Number(s.split("along ")[1]) < 150).slice(0, 20).join(" | ")); void (pts.slice(0, 40).join(' | '));
