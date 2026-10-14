// The hands' grip as the driver sees it, without a GPU: bundles src/preview/hands-*.ts, meshes the right hand, and
// rasterises it (z-buffer) with the rim, each digit in its own colour (index red, middle green, ring blue, little
// yellow, thumb magenta, palm/arm skin), from the driver's eye and a few other viewpoints. Prints the pose numbers.
//   node tools/preview-hands-eye.mjs [out.png] [--pres=m|f] [--h=2.5] [--size=420] [--views=eye,eyeR,dash,top,inner,side]
//        [--pose='{"ulnar":0.3}'] [--plain]
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'tests/out/preview/hands-eye.png';
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const pres = opt('pres', 'm'), h = Number(opt('h', '2.5')), S = Number(opt('size', '420'));
const views = opt('views', 'eye,eyeR,dash,top,inner,side').split(',');
const plain = args.includes('--plain');

const dir = path.join(ROOT, 'tests', 'out', 'preview', 'build', 'hands-eye');
mkdirSync(dir, { recursive: true });
await build({
  stdin: { contents: `export * from './src/preview/hands-sdf.ts'; export * from './src/preview/hands-mesh.ts'; export { rimA, rimB, rimAt } from './src/preview/spec.ts';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: path.join(dir, 'eye.mjs'), logLevel: 'warning',
});
const M = await import(pathToFileURL(path.join(dir, 'eye.mjs')).href + '?t=' + Date.now());
{ const po = JSON.parse(opt('pose', '{}')); for (const [k, v] of Object.entries(po)) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(M.POSE[k], v); else M.POSE[k] = v; } }

const t0 = performance.now();
const A = M.buildAnatomy(pres);
const tA = performance.now() - t0;
const f = A.field;
// mesh it the way hands-geo does: a box along the forearm, only the hand end (to the mid forearm) for speed
const ax = A.foreDir, ay = A.foreUp, az = M.cross(ax, ay);
const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (const s of f.bounds()) {
  const c = [M.dot(s.c, ax), M.dot(s.c, ay), M.dot(s.c, az)];
  for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i] - s.r); hi[i] = Math.max(hi[i], c[i] + s.r); }
}
hi[0] = Math.min(hi[0], M.dot(A.wrist, ax) + 140);
for (let i = 0; i < 3; i++) { lo[i] -= 2 * h + 2; hi[i] += 2 * h + 2; }
const box = { o: M.add(M.add(M.mul(ax, lo[0]), M.mul(ay, lo[1])), M.mul(az, lo[2])), ax, ay, az, nx: Math.ceil((hi[0] - lo[0]) / h), ny: Math.ceil((hi[1] - lo[1]) / h), nz: Math.ceil((hi[2] - lo[2]) / h) };
const mesh = M.meshField(f, box, h);
console.log(JSON.stringify({ anatomyMs: Math.round(tA), meshMs: Math.round(mesh.stats.ms), verts: mesh.stats.verts, tris: mesh.stats.tris }));
for (const d of A.digits) console.log(d.name.padEnd(7), 'flex', d.flex.map((x) => x.toFixed(0)).join('/').padEnd(10), 'phi', d.joints.map((p) => M.sectionAngle(p).toFixed(0)).join(' > ').padEnd(22), 'joints', d.joints.map((j) => j.map((x) => x.toFixed(0)).join(',')).join(' | '));
console.log('wrist', A.wrist.map((x) => x.toFixed(0)).join(','), 'N', A.palm.N.map((x) => x.toFixed(2)).join(','));

// per-vertex digit colour: the group whose own field is nearest
const COLS = [[0.86, 0.64, 0.52], [0.85, 0.3, 0.75], [0.9, 0.25, 0.2], [0.25, 0.75, 0.3], [0.25, 0.4, 0.9], [0.9, 0.8, 0.2]];
const nv = mesh.stats.verts, col = new Float32Array(nv * 3), gd = new Float64Array(6);
for (let v = 0; v < nv; v++) {
  const x = mesh.pos[v * 3], y = mesh.pos[v * 3 + 1], z = mesh.pos[v * 3 + 2];
  gd.fill(1e9);
  const a = mesh.act[mesh.vblock[v]];
  const n = a ? a.length : f.n;
  for (let j = 0; j < n; j++) { const i = a ? a[j] : j; const d = f.prim(i, x, y, z), g = f.group[i]; if (d < gd[g]) gd[g] = d; }
  let g = 0; for (let k = 1; k < 6; k++) if (gd[k] < gd[g] - 0.6) g = k;
  const c = plain ? COLS[0] : COLS[g];
  // ambient occlusion from the field and the rim, so creases and gaps read
  const nx = mesh.nrm[v * 3], ny = mesh.nrm[v * 3 + 1], nz = mesh.nrm[v * 3 + 2];
  let occ = 0, w = 1;
  for (const s of [1.5, 4, 8, 14]) {
    const qx = x + nx * s, qy = y + ny * s, qz = z + nz * s;
    const d = Math.min(f.eval(qx, qy, qz, a, a ? a.length : 0), M.rimSdfG(qx, qy, qz));
    occ += w * Math.max(0, (s - d) / s); w *= 0.65;
  }
  const ao = Math.max(0.15, Math.min(1, 1 - occ * 0.8));
  col.set([c[0] * ao, c[1] * ao, c[2] * ao], v * 3);
}

// the rim near the grip (G frame directly, via the wheel plane)
const rimTris = [];
{
  const nA = 160, nB = 36, rows = [];
  for (let i = 0; i <= nA; i++) {
    const a = M.GRIP_A + ((i / nA) * 2 - 1) * 1.1, R = 178;
    const A_ = M.rimA(a) * 1000, B_ = M.rimB(a) * 1000, ux = Math.cos(a), uy = Math.sin(a), row = [];
    for (let j = 0; j < nB; j++) {
      const t = (j / nB) * Math.PI * 2;
      const w = [ux * (R + A_ * Math.cos(t)), uy * (R + A_ * Math.cos(t)), B_ * Math.sin(t)];
      const nw = M.norm([(ux * Math.cos(t)) / A_, (uy * Math.cos(t)) / A_, Math.sin(t) / B_]);
      row.push([M.wToG(w), M.dirWToG(nw)]);
    }
    rows.push(row);
  }
  for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
    const a = rows[i][j], b = rows[i + 1][j], c = rows[i + 1][(j + 1) % nB], d = rows[i][(j + 1) % nB];
    rimTris.push([a, b, c], [a, c, d]);
  }
}

// views, in G (mm). The camera's up is the car's up.
const eyeG = M.wToG(M.carToW([-0.37, 1.16, 0.1]));
const upG = M.norm(M.sub(M.wToG(M.carToW([-0.37, 2.16, 0.1])), eyeG));
const C = M.lerp3(A.mcp[1], A.digits[1].joints[3], 0.5);
const V = {
  eye: { eye: eyeG, at: M.wToG([100, 60, 0]), fov: 30, mirror: true },
  eyeR: { eye: eyeG, at: C, fov: 13 },
  eyeT: { eye: eyeG, at: M.lerp3(A.digits[1].joints[3], A.digits[2].joints[3], 0.5), fov: 7 },
  dash: { eye: M.madd(C, M.norm([0.25, -0.25, -1]), 260), at: C, fov: 40 },
  top: { eye: M.madd(C, M.norm([0, 1, 0.25]), 260), at: C, fov: 40 },
  inner: { eye: M.madd(C, M.norm([0.2, -1, 0.5]), 260), at: C, fov: 40 },
  side: { eye: M.madd(C, M.norm([1, -0.1, 0.15]), 260), at: C, fov: 40 },
  close: { eye: M.madd(C, M.norm(M.sub(eyeG, C)), 250), at: C, fov: 40 },
};
const W = S, H = Math.round(S * 0.75), cols = Math.min(3, views.length), rowsN = Math.ceil(views.length / cols);
const img = new Uint8Array(W * cols * H * rowsN * 3);
views.forEach((name, vi) => {
  const v = V[name];
  const zb = new Float32Array(W * H).fill(1e9), buf = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { buf[i * 3] = 0.1; buf[i * 3 + 1] = 0.11; buf[i * 3 + 2] = 0.13; }
  const fw = M.norm(M.sub(v.at, v.eye));
  let up = Math.abs(M.dot(upG, fw)) > 0.95 ? [0, 0, 1] : upG;
  // G is a mirror image of the wheel's frame: flip the right vector so the picture is not mirrored
  const r = M.mul(M.norm(M.cross(fw, up)), -1), u = M.mul(M.cross(r, fw), -1);
  const k = 1 / Math.tan((v.fov * Math.PI) / 360);
  const proj = (p) => { const d = M.sub(p, v.eye), zz = M.dot(d, fw); return [W / 2 + (M.dot(d, r) / zz) * k * H / 2, H / 2 - (M.dot(d, u) / zz) * k * H / 2, zz]; };
  // a low sun from the front left (car frame), sky from above, a little bounce
  const sunG = M.norm(M.sub(M.wToG(M.carToW([-0.37 - 0.5, 0.8 + 0.6, -0.42 - 0.6])), M.wToG(M.carToW([-0.37, 0.8, -0.42]))));
  const L1 = sunG, L2 = upG;
  const shade = (n, c) => { const a = Math.max(0, M.dot(n, L1)) * 0.75 + (0.5 + 0.5 * M.dot(n, L2)) * 0.3 + 0.06; return [c[0] * a, c[1] * a, c[2] * a]; };
  const tri = (P, N, c) => {
    const p = P.map(proj);
    if (p.some((q) => q[2] < 1)) return;
    const minx = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), maxx = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const miny = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), maxy = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 1e-9) return;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((p[1][0] - px) * (p[2][1] - py) - (p[2][0] - px) * (p[1][1] - py)) / area;
      const w1 = ((p[2][0] - px) * (p[0][1] - py) - (p[0][0] - px) * (p[2][1] - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const zz = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2], o = y * W + x;
      if (zz >= zb[o]) continue;
      zb[o] = zz;
      let n = M.norm([N[0][0] * w0 + N[1][0] * w1 + N[2][0] * w2, N[0][1] * w0 + N[1][1] * w1 + N[2][1] * w2, N[0][2] * w0 + N[1][2] * w1 + N[2][2] * w2]);
      const cc = Array.isArray(c[0]) ? [c[0][0] * w0 + c[1][0] * w1 + c[2][0] * w2, c[0][1] * w0 + c[1][1] * w1 + c[2][1] * w2, c[0][2] * w0 + c[1][2] * w1 + c[2][2] * w2] : c;
      const s = shade(n, cc);
      buf[o * 3] = s[0]; buf[o * 3 + 1] = s[1]; buf[o * 3 + 2] = s[2];
    }
  };
  for (const t of rimTris) tri(t.map((q) => q[0]), t.map((q) => q[1]), [0.3, 0.29, 0.32]);
  // the left hand in the eye view: the right hand mirrored in the wheel's plane
  const mir = (p) => M.wToG((([x, y, z]) => [-x, y, z])(M.gToW(p)));
  const mirD = (d) => M.dirWToG((([x, y, z]) => [-x, y, z])(M.dirGToW(d)));
  if (v.mirror) for (const t of rimTris) tri(t.map((q) => mir(q[0])), t.map((q) => mirD(q[1])), [0.3, 0.29, 0.32]);
  const pos = mesh.pos, nrm = mesh.nrm, idx = mesh.idx;
  for (let i = 0; i < idx.length; i += 3) {
    const q = [idx[i], idx[i + 1], idx[i + 2]];
    const P = q.map((a) => [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]]), N = q.map((a) => [nrm[a * 3], nrm[a * 3 + 1], nrm[a * 3 + 2]]);
    const cc = q.map((a) => [col[a * 3], col[a * 3 + 1], col[a * 3 + 2]]);
    tri(P, N, cc);
    if (v.mirror) tri(P.map(mir), N.map(mirD), cc);
  }
  const ox = (vi % cols) * W, oy = Math.floor(vi / cols) * H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    img[((oy + y) * W * cols + ox + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(Math.pow(buf[(y * W + x) * 3 + c], 1 / 2.2) * 255)));
  }
});
writePng(out, W * cols, H * rowsN, img);
console.log('wrote', out);

function writePng(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
