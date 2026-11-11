// Bakes the heights the network's load-time passes give every road (Network.bridgeSags, levelOverlaps and the profile
// limits), and where trimEnds cuts roads back, into src/data/oc-levels.json, so a browser doesn't run them on every
// boot: the offsets from the map's heights of each road that moves, in millimetres (centimetres made the 10 m crest test fail by rounding alone), as
// gzipped int16 steps along it. `npm run build` runs it first. Network uses
// the file only when it was made from the same data (`sig`) with the same version of the passes (`LEVELS`), and npm test
// checks the baked heights against the passes.
//   node scripts/levels.mjs
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'src/data/oc-levels.json');
const res = await build({
  stdin: { contents: `export { Network, LEVELS } from './src/game/world/Network';`, resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'warning',
});
const url = `data:text/javascript;base64,${Buffer.from(res.outputFiles[0].text).toString('base64')}`;
const { Network, LEVELS } = await import(url);
const t0 = Date.now();
const net = await Network.load(true);
const ms = Date.now() - t0;
// each moved road's offsets from its map heights (a fresh Path from the same control points)
const P = net.paths[0].constructor, runs = [], steps = [];
for (const p of net.paths) {
  const rp = net.data.paths[p.id], c = new Float64Array(rp.n * 3);
  let x = 0, z = 0, y = 0;
  for (let i = 0; i < rp.n; i++) { x += rp.p[i * 3]; z += rp.p[i * 3 + 1]; y += rp.p[i * 3 + 2]; c[i * 3] = x / 10; c[i * 3 + 1] = z / 10; c[i * 3 + 2] = y / 10; }
  const y0 = new P(p.id, rp.k, rp.lanes, c, rp.route ?? null, rp.dir ?? null, rp.name ?? null, !!rp.conn).ys;
  let i0 = -1, i1 = -1;
  for (let i = 0; i < p.n; i++) if (Math.round((p.ys[i] - y0[i]) * 1e3) !== 0) { if (i0 < 0) i0 = i; i1 = i; }
  if (i0 < 0) continue;
  runs.push([p.id, i0, i1 - i0 + 1]);
  let last = 0;
  for (let i = i0; i <= i1; i++) { const v = Math.round((p.ys[i] - y0[i]) * 1e3); steps.push(v - last); last = v; }
}
const bin = Buffer.from(new Int16Array(steps).buffer);
const data = gzipSync(bin, { level: 9 }).toString('base64');
// and where each road cut back off a carriageway's lanes ends (Network.trimEnds), to the millimetre
const ends = net.paths.filter((p) => p.end < p.len).map((p) => [p.id, Math.round(p.end * 1e3) / 1e3]);
writeFileSync(out, JSON.stringify({ version: LEVELS, sig: net.sig, runs, data, ends }) + '\n');
console.log(`levels: ${runs.length} roads moved, ${steps.length} samples, ${data.length} bytes, ${ends.length} roads cut back (passes ${ms} ms under Node, of them trimEnds ${net.loadMs.trim.toFixed(0)} ms)`);
