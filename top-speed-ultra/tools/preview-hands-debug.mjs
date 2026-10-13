// Quick look at the hands' mesh without a GPU: bundles src/preview/hands-*.ts, meshes the hand, and rasterises it
// (z-buffer, smooth normals) together with the rim from a few viewpoints into one PNG contact sheet.
//   node tools/preview-hands-debug.mjs [out.png] [--pres=m|f] [--h=2] [--size=360]
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'tests/out/preview/hands-debug.png';
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const pres = opt('pres', 'm'), h = Number(opt('h', '2')), S = Number(opt('size', '360')), views = opt('views', 'driver,front,side,inner,back,top');

const dir = path.join(ROOT, 'tests', 'out', 'preview', 'build', 'hands-debug');
mkdirSync(dir, { recursive: true });
await build({
  stdin: { contents: `export * from './src/preview/hands-sdf.ts'; export * from './src/preview/hands-geo.ts';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: path.join(dir, 'debug.mjs'), logLevel: 'warning',
});
const M = await import(pathToFileURL(path.join(dir, 'debug.mjs')).href + '?t=' + Date.now());

const t0 = performance.now();
const arm = M.buildArmGeometry(pres, h);
console.log(JSON.stringify({ ms: Math.round(performance.now() - t0), ...arm.mesh.stats, ms2: arm.ms }));
const A = arm.anatomy;
for (const d of A.digits) console.log(d.name, d.flex.map((x) => x.toFixed(0)).join(' '), 'tip', d.joints[3].map((x) => x.toFixed(1)).join(','));
const P_ = A.palm; console.log('O', P_.O.map(x=>x.toFixed(1)).join(','), 'P', P_.P.map(x=>x.toFixed(2)).join(','), 'R', P_.R.map(x=>x.toFixed(2)).join(','), 'N', P_.N.map(x=>x.toFixed(2)).join(','));
for (const d of A.digits) console.log(' ', d.name, d.joints.map(j=>j.map(x=>x.toFixed(0)).join(',')).join(' | '));
console.log('wrist', A.wrist.map((x) => x.toFixed(1)).join(','), 'elbow', A.elbow.map((x) => x.toFixed(0)).join(','), 'shoulder', A.shoulder.map((x) => x.toFixed(0)).join(','));

// ---- the rim near the grip, in G
const rimTris = [], rimN = [];
{
  const a0 = M.GRIP_A, nA = 120, nB = 32, ring = [];
  for (let i = 0; i <= nA; i++) {
    const a = a0 + ((i / nA) * 2 - 1) * 0.9, R = 178;
    const row = [];
    const { rimA, rimB } = M;
    for (let j = 0; j < nB; j++) {
      const t = (j / nB) * Math.PI * 2, A_ = 18.5 + 6 * bulge(a), B_ = 23.5 + 6 * bulge(a);
      const ux = Math.cos(a), uy = Math.sin(a);
      const w = [ux * (R + A_ * Math.cos(t)), uy * (R + A_ * Math.cos(t)), B_ * Math.sin(t)];
      const nw = M.norm([ux * Math.cos(t) / A_, uy * Math.cos(t) / A_, Math.sin(t) / B_]);
      row.push([w, nw]);
    }
    ring.push(row);
  }
  for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
    const a = ring[i][j], b = ring[i + 1][j], c = ring[i + 1][(j + 1) % nB], d = ring[i][(j + 1) % nB];
    rimTris.push([a, b, c], [a, c, d]);
  }
}
function bulge(a) { const ang = (x, y) => Math.atan2(Math.sin(x - y), Math.cos(x - y)); return Math.exp(-(ang(a, 0) ** 2) / 0.22) + Math.exp(-(ang(a, Math.PI) ** 2) / 0.22); }

// ---- views (G frame, mm)
const eyeG = M.carToW([-0.37, 1.16, 0.1]);
const gw = (p) => M.gToW(p), dw = (p) => M.dirGToW(p);
const C = gw(M.lerp3(A.mcp[1], A.wrist, 0.3));
const Wr = gw(A.wrist), El = gw(A.elbow);
const V = {
  driver: { eye: eyeG, at: C, fov: 26 },
  front: { eye: M.madd(C, dw([0, 0.15, 1]), 320), at: C, fov: 40 },
  side: { eye: M.madd(C, dw([1, 0, 0.1]), 340), at: C, fov: 40 },
  inner: { eye: M.madd(C, dw([0, -1, 0.35]), 320), at: C, fov: 40 },
  back: { eye: M.madd(C, dw([0.1, 0.3, -1]), 320), at: C, fov: 40 },
  top: { eye: M.madd(C, dw([-0.6, 0.8, 0.4]), 320), at: C, fov: 40 },
  close: { eye: M.madd(C, M.norm(M.sub(eyeG, C)), 250), at: C, fov: 40 },
  arm: { eye: M.madd(M.lerp3(Wr, El, 0.4), [0.3, 1, 0.3], 700), at: M.lerp3(Wr, El, 0.4), fov: 50 },
};
const list = views.split(',');
const W = S, H = Math.round(S * 0.75), cols = Math.min(3, list.length), rows = Math.ceil(list.length / cols);
const img = new Uint8Array(W * cols * H * rows * 3);
const pos = arm.mesh.pos, nrm = arm.mesh.nrm, idx = arm.mesh.idx, col = arm.debugColor;
list.forEach((name, vi) => {
  const v = V[name];
  const z = new Float32Array(W * H).fill(1e9), buf = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { buf[i * 3] = 0.12; buf[i * 3 + 1] = 0.14; buf[i * 3 + 2] = 0.17; }
  const f = M.norm(M.sub(v.at, v.eye)), r = M.norm(M.cross(f, M.norm(M.carToW([-0.37, 2.16, 0.1]).map((x, i) => x - M.carToW([-0.37, 1.16, 0.1])[i])))), u = M.cross(r, f);
  const k = 1 / Math.tan((v.fov * Math.PI) / 360);
  const proj = (p) => { const d = M.sub(p, v.eye), zz = M.dot(d, f); return [W / 2 + (M.dot(d, r) / zz) * k * H / 2, H / 2 - (M.dot(d, u) / zz) * k * H / 2, zz]; };
  const L1 = M.norm([0.2, 0.75, 0.6]), L2 = M.norm([-0.5, -0.2, 0.4]);
  const shade = (n, c) => { const a = Math.max(0, M.dot(n, L1)) * 0.75 + Math.max(0, M.dot(n, L2)) * 0.25 + 0.18; return [c[0] * a, c[1] * a, c[2] * a]; };
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
      if (zz >= z[o]) continue;
      z[o] = zz;
      let n = M.norm([N[0][0] * w0 + N[1][0] * w1 + N[2][0] * w2, N[0][1] * w0 + N[1][1] * w1 + N[2][1] * w2, N[0][2] * w0 + N[1][2] * w1 + N[2][2] * w2]);
      if (M.dot(n, M.sub(v.eye, P[0])) < 0 && name !== 'x') n = M.mul(n, 0.4);
      const cc = Array.isArray(c[0]) ? [c[0][0] * w0 + c[1][0] * w1 + c[2][0] * w2, c[0][1] * w0 + c[1][1] * w1 + c[2][1] * w2, c[0][2] * w0 + c[1][2] * w1 + c[2][2] * w2] : c;
      const s = shade(n, cc);
      buf[o * 3] = s[0]; buf[o * 3 + 1] = s[1]; buf[o * 3 + 2] = s[2];
    }
  };
  for (const t of rimTris) tri(t.map((q) => q[0]), t.map((q) => q[1]), [0.35, 0.33, 0.4]);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const P = [a, b, c].map((q) => gw([pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]])), N = [a, b, c].map((q) => dw([nrm[q * 3], nrm[q * 3 + 1], nrm[q * 3 + 2]]));
    const cc = col ? [a, b, c].map((q) => [col[q * 3], col[q * 3 + 1], col[q * 3 + 2]]) : [0.85, 0.62, 0.5];
    tri(P, N, cc);
  }
  const ox = (vi % cols) * W, oy = Math.floor(vi / cols) * H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    img[((oy + y) * W * cols + ox + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(Math.pow(buf[(y * W + x) * 3 + c], 1 / 2.2) * 255)));
  }
});
writePng(out, W * cols, H * rows, img);
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
