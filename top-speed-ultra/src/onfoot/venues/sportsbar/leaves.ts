// Vega & Vinnie's greenery at HD and Ultra (the vv-look art review, 2026-11-23: the lot's hedges, the strip corner's
// island and the pylon's hedge read as faceted red-capped baubles, the pines as stacked cones, the pot by the door as a
// cactus, the patio's planter shrubs as lime blobs). One leaf atlas and one HD-and-Ultra-only batch
// ('venue-leaves@hi', hidden at Low, which keeps its clumps):
//   - a clipped hedge: a rounded extruded box (flat top, rounded shoulders, slightly lumpy), its sides the atlas's dense
//     glossy dark-green leaves, its top and shoulders the same with red new growth, and small red tufts (alpha cards)
//     along the top, as the owner's lot photos show the photinia hedges;
//   - a pine: needle-spray cards in whorls round the trunk, longer below, drooping a little;
//   - a photinia: a fountain of feathery red-pink leaf sprays (the terracotta pot by the front door);
//   - an olive leafy shrub: crossed sprays of small olive leaves (the patio's planter walls), lit warm from below by the
//     baked uplights.
// The atlas is drawn once on a canvas (our own art; nothing copied).
import * as THREE from 'three';
import { Batch, canvasTex } from '../../engine/geom';

export interface UVR { u0: number; v0: number; u1: number; v1: number }
const S = 512;
/** a region of the atlas from canvas pixels (x, y from the top-left), inset a little against mip bleed */
const reg = (x0: number, y0: number, x1: number, y1: number, inset = 3): UVR => ({ u0: (x0 + inset) / S, u1: (x1 - inset) / S, v0: 1 - (y1 - inset) / S, v1: 1 - (y0 + inset) / S });
export const LEAF = {
  hedge: reg(0, 0, 256, 256),
  hedgeTop: reg(256, 0, 512, 256),
  needles: reg(0, 256, 256, 384, 2),
  needlesTip: reg(0, 384, 256, 512, 2),
  photinia: reg(256, 256, 384, 512, 2),
  olive: reg(384, 256, 512, 512, 2),
};

function rnd(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** one leaf: a pointed ellipse from (x, y) along angle a, length l, width w */
function leaf(g: CanvasRenderingContext2D, x: number, y: number, a: number, l: number, w: number, fill: string, hi?: string) {
  const c = Math.cos(a), s = Math.sin(a), px = -s * w / 2, py = c * w / 2, tx = x + c * l, ty = y + s * l, mx = x + c * l * 0.5, my = y + s * l * 0.5;
  g.beginPath(); g.moveTo(x, y);
  g.quadraticCurveTo(mx + px * 2, my + py * 2, tx, ty);
  g.quadraticCurveTo(mx - px * 2, my - py * 2, x, y);
  g.fillStyle = fill; g.fill();
  if (hi) { g.beginPath(); g.moveTo(x + c * l * 0.15, y + s * l * 0.15); g.quadraticCurveTo(mx + px, my + py, x + c * l * 0.85, y + s * l * 0.85); g.strokeStyle = hi; g.lineWidth = 1; g.stroke(); }
}

/** the leaf atlas (512 x 512): two opaque tiling hedge faces, a needle spray, its tip, a photinia spray, an olive spray */
export function leafAtlasTex() {
  return canvasTex(S, S, (g) => {
    g.clearRect(0, 0, S, S);
    // the hedge faces: dense glossy leaves over a dark ground, tiling within their 256 px square
    const face = (ox: number, red: number, seed: number) => {
      const r = rnd(seed);
      g.save(); g.beginPath(); g.rect(ox, 0, 256, 256); g.clip();
      g.fillStyle = '#10240a'; g.fillRect(ox, 0, 256, 256);
      const GREEN = ['#1d4612', '#255418', '#2d601e', '#376c26', '#214c16', '#43782e'], RED = ['#8a2212', '#a02e16', '#b03a1a', '#7a1c0e'];
      for (let i = 0; i < 1500; i++) {
        const x = r() * 256, y = r() * 256, a = r() * Math.PI * 2, l = 9 + r() * 9, w = 4 + r() * 3;
        // the red new growth sits on the face's upper part (the top and shoulders), denser toward the top edge
        const isRed = r() < red * (0.4 + 0.9 * (1 - y / 256));
        const fill = isRed ? RED[(r() * RED.length) | 0] : GREEN[(r() * GREEN.length) | 0];
        const hi = isRed ? 'rgba(255,150,110,0.22)' : 'rgba(180,225,140,0.22)';
        for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) leaf(g, ox + x + dx, y + dy, a, l, w, fill, hi);
      }
      g.restore();
    };
    face(0, 0, 11); face(256, 0.22, 23);
    // a needle spray along u (the trunk at its left, the tip at its right), and a denser shorter tip spray
    const spray = (oy: number, h: number, seed: number, density: number) => {
      const r = rnd(seed);
      g.save(); g.beginPath(); g.rect(0, oy, 256, h); g.clip();
      const cy = oy + h / 2;
      g.strokeStyle = '#4a3626'; g.lineWidth = 3; g.beginPath(); g.moveTo(2, cy); g.quadraticCurveTo(128, cy - 4, 250, cy + 2); g.stroke();
      const COL = ['#20381c', '#2a4622', '#33522a', '#3c5e30', '#1c3218'];
      for (let i = 0; i < density; i++) {
        const t = r(), x = 6 + t * 240, taper = 1 - 0.55 * t, side = r() < 0.5 ? -1 : 1;
        // twigs off the branch, each a fan of needles
        const tx = x + (r() - 0.3) * 18, ty = cy + side * (6 + r() * (h / 2 - 12) * taper);
        g.strokeStyle = '#3a2c20'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, cy); g.lineTo(tx, ty); g.stroke();
        for (let k = 0; k < 9; k++) {
          const a = Math.atan2(ty - cy, tx - x) + (r() - 0.5) * 1.9, l = (7 + r() * 9) * taper;
          g.strokeStyle = COL[(r() * COL.length) | 0]; g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(a) * l, ty + Math.sin(a) * l); g.stroke();
        }
      }
      g.restore();
    };
    spray(256, 128, 37, 260); spray(384, 128, 41, 340);
    // a photinia spray (v up): a red-stemmed shoot, green leaves below, red and coral new leaves above
    {
      const r = rnd(53), ox = 256, oy = 256, w = 128, h = 256;
      g.save(); g.beginPath(); g.rect(ox, oy, w, h); g.clip();
      for (let s = 0; s < 5; s++) {
        const bx = ox + w / 2 + (s - 2) * 12, by = oy + h - 2, tx = ox + w / 2 + (s - 2) * 22 + (r() - 0.5) * 10, ty = oy + 18 + r() * 30;
        g.strokeStyle = '#5a2a1c'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo((bx + tx) / 2 + (r() - 0.5) * 20, (by + ty) / 2, tx, ty); g.stroke();
        for (let k = 0; k < 26; k++) {
          const t = k / 26, x = bx + (tx - bx) * t + (r() - 0.5) * 6, y = by + (ty - by) * t, a = -Math.PI / 2 + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), l = 14 + r() * 10 - t * 5;
          const red = t > 0.45 || r() < 0.15;
          leaf(g, x, y, a, l, 6 + r() * 3, red ? ['#b8341f', '#cf4a35', '#e0705e', '#a02a1c', '#d65a48'][(r() * 5) | 0] : ['#2c4a22', '#35562a', '#294420'][(r() * 3) | 0], red ? 'rgba(255,190,170,0.4)' : 'rgba(170,200,140,0.3)');
        }
      }
      g.restore();
    }
    // an olive leafy spray (v up): a rounded bush of small olive leaves on dark twigs
    {
      const r = rnd(71), ox = 384, oy = 256, w = 128, h = 256;
      g.save(); g.beginPath(); g.rect(ox, oy, w, h); g.clip();
      for (let i = 0; i < 520; i++) {
        // inside a rounded silhouette: a dome over a waist
        const t = r(), y = oy + 14 + t * (h - 20), half = (w / 2 - 6) * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.42) / 0.62, 2))), x = ox + w / 2 + (r() * 2 - 1) * half;
        const col = ['#3e4d22', '#4a5a28', '#55682e', '#36441e', '#62763a', '#2e3a18'][(r() * 6) | 0];
        leaf(g, x, y, r() * Math.PI * 2, 8 + r() * 6, 4 + r() * 3, col, 'rgba(210,220,150,0.3)');
      }
      g.restore();
    }
  }, { repeat: false });
}

const _c = new THREE.Color();
type V3 = [number, number, number];
/** a quad of the atlas: corners a (u0, v0), b (u1, v0), c (u1, v1), d (u0, v1), one normal, colours at the bottom (a, b)
 *  and top (c, d) */
function card(b: Batch, a: V3, bb: V3, c: V3, d: V3, n: V3, r: UVR, lo: number, hi: number, kLo = 1, kHi = 1) {
  _c.setHex(lo); const lr = _c.r * kLo, lg = _c.g * kLo, lb = _c.b * kLo;
  _c.setHex(hi); const hr = _c.r * kHi, hg = _c.g * kHi, hb = _c.b * kHi;
  b.vert(a[0], a[1], a[2], n[0], n[1], n[2], lr, lg, lb, r.u0, r.v0);
  b.vert(bb[0], bb[1], bb[2], n[0], n[1], n[2], lr, lg, lb, r.u1, r.v0);
  b.vert(c[0], c[1], c[2], n[0], n[1], n[2], hr, hg, hb, r.u1, r.v1);
  b.vert(a[0], a[1], a[2], n[0], n[1], n[2], lr, lg, lb, r.u0, r.v0);
  b.vert(c[0], c[1], c[2], n[0], n[1], n[2], hr, hg, hb, r.u1, r.v1);
  b.vert(d[0], d[1], d[2], n[0], n[1], n[2], hr, hg, hb, r.u0, r.v1);
}
const hash = (seed: number, k: number) => { const q = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); };

/**
 * A clipped hedge from local (ax, az) to (bx, bz): w wide, h tall, its base at y0. A rounded box extruded along the run:
 * vertical sides to h - r, rounded shoulders, a flat top; the stations every 0.45 m, each surface point pushed in or out
 * a few centimetres (a clipped hedge is never quite flat); smooth normals; the sides the atlas's green face, the shoulders
 * and top its red-tipped face; flat clipped ends; small red-tipped tufts (alpha cards) poking up along the top.
 */
export function hedgeRun(b: Batch, ax: number, az: number, bx: number, bz: number, w: number, h: number, seed: number, y0 = 0, tufts = true) {
  const len = Math.hypot(bx - ax, bz - az); if (len < 0.05) return;
  const ux = (bx - ax) / len, uz = (bz - az) / len, sx = -uz, sz = ux;            // along the run, and across it
  const rr = Math.min(0.24, w * 0.38, h * 0.4), half = w / 2;
  // the profile: (across, up, normal across, normal up, which face) from the left foot round to the right foot
  const P: [number, number, number, number, 0 | 1][] = [];
  P.push([-half, 0, -1, 0, 0], [-half, (h - rr) * 0.5, -1, 0, 0], [-half, h - rr, -1, 0, 1]);
  for (let k = 1; k < 4; k++) { const t = (k / 4) * (Math.PI / 2), nx = -Math.cos(t), ny = Math.sin(t); P.push([-half + rr + nx * rr, h - rr + ny * rr, nx, ny, 1]); }
  P.push([-half + rr, h, 0, 1, 1], [half - rr, h, 0, 1, 1]);
  for (let k = 1; k < 4; k++) { const t = (k / 4) * (Math.PI / 2), nx = Math.sin(t), ny = Math.cos(t); P.push([half - rr + nx * rr, h - rr + ny * rr, nx, ny, 1]); }
  P.push([half, h - rr, 1, 0, 1], [half, (h - rr) * 0.5, 1, 0, 0], [half, 0, 1, 0, 0]);
  const n = Math.max(1, Math.round(len / 0.45)), dl = len / n;
  const lump = (i: number, k: number) => (hash(seed + i * 0.37, k) - 0.5) * 0.07;
  const at = (i: number, k: number): [V3, V3] => {
    const t = i * dl, [d, y, nd, ny] = P[k], e = (i === 0 || i === n) && Math.abs(nd) < 0.5 && ny < 0.5 ? 0 : lump(i, k) * (y > 0.05 ? 1 : 0.3);
    return [[ax + ux * t + sx * (d + nd * e), y0 + y + ny * e, az + uz * t + sz * (d + nd * e)], [sx * nd, ny, sz * nd]];
  };
  const shade = (y: number, k: number, i: number) => (0.5 + 0.5 * Math.min(1, y / h)) * (0.88 + 0.24 * hash(seed + i, k + 50));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < P.length - 1; k++) {
      const face = P[k][4] || P[k + 1][4] ? LEAF.hedgeTop : LEAF.hedge;
      const [p0, n0] = at(i, k), [p1, n1] = at(i + 1, k), [p2, n2] = at(i + 1, k + 1), [p3, n3] = at(i, k + 1);
      // each strip spans its share of the face's square (a strip is short across the profile, so its leaves keep their size)
      const segL = Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]), vs = Math.min(1, segL / 0.45), vOff = hash(seed + i, k) * (1 - vs);
      const V0 = face.v0 + (face.v1 - face.v0) * vOff, V1 = face.v0 + (face.v1 - face.v0) * (vOff + vs);
      const s0 = shade(P[k][1], k, i), s1 = shade(P[k][1], k, i + 1), s2 = shade(P[k + 1][1], k + 1, i + 1), s3 = shade(P[k + 1][1], k + 1, i);
      const V: [V3, V3, number, number, number][] = [[p0, n0, s0, face.u0, V0], [p1, n1, s1, face.u1, V0], [p2, n2, s2, face.u1, V1], [p3, n3, s3, face.u0, V1]];
      for (const j of [0, 1, 2, 0, 2, 3]) { const [p, nn, s, u, v] = V[j]; b.vert(p[0], p[1], p[2], nn[0], nn[1], nn[2], s, s, s, u, v); }
    }
  }
  // the clipped ends: the profile as a fan from its centre, facing out along the run
  for (const [i, f] of [[0, -1], [n, 1]] as [number, number][]) {
    const cx = ax + ux * i * dl, cz = az + uz * i * dl, c: V3 = [cx, y0 + h * 0.45, cz], nn: V3 = [ux * f, 0, uz * f];
    for (let k = 0; k < P.length - 1; k++) {
      const [p0] = at(i, k), [p1] = at(i, k + 1), uvA = (p: V3) => { const d = (p[0] - cx) * sx + (p[2] - cz) * sz; return [LEAF.hedge.u0 + (LEAF.hedge.u1 - LEAF.hedge.u0) * (0.5 + d / w), LEAF.hedge.v0 + (LEAF.hedge.v1 - LEAF.hedge.v0) * ((p[1] - y0) / h)]; };
      const tri = f > 0 ? [c, p0, p1] : [c, p1, p0];
      for (const p of tri) { const [u, v] = uvA(p), s = 0.5 + 0.45 * ((p[1] - y0) / h); b.vert(p[0], p[1], p[2], nn[0], nn[1], nn[2], s, s, s, u, v); }
    }
  }
  if (!tufts) return;
  // the red new growth standing proud of the clipped top: small crossed photinia cards every 0.4 m, two rows
  for (let t = 0.2, j = 0; t < len - 0.1; t += 0.3, j++) {
    for (const side of [j % 2 ? -0.2 : 0.2]) {
      const q = hash(seed + t * 3.1, side > 0 ? 7 : 9), x = ax + ux * (t + (q - 0.5) * 0.2) + sx * side * w, z = az + uz * (t + (q - 0.5) * 0.2) + sz * side * w, y = y0 + h - 0.08;
      const ww = 0.16 + 0.08 * q, hh = 0.2 + 0.12 * q, a = q * Math.PI, cx = Math.cos(a) * ww, cz = Math.sin(a) * ww;
      card(b, [x - cx, y, z - cz], [x + cx, y, z + cz], [x + cx, y + hh, z + cz], [x - cx, y + hh, z - cz], [0, 1, 0], LEAF.photinia, 0x6a7058, 0xd8d0c8, 0.8, 1);
    }
  }
}

/** a pine at local (x, z): needle-spray cards in whorls round the trunk from 30% of its height up, longer below and
 *  drooping a little, a crossed pair of tip sprays at the top (the trunk is drawn by the caller) */
export function pineCards(b: Batch, x: number, z: number, h: number, seed: number) {
  const levels = 9;
  for (let i = 0; i < levels; i++) {
    const t = i / (levels - 1), y = h * (0.28 + 0.66 * t), len = 2.4 * (1 - 0.78 * t) + 0.35, nB = 6 - Math.floor(t * 2), w = 0.55 + 0.35 * (1 - t);
    for (let k = 0; k < nB; k++) {
      const a = (k / nB) * Math.PI * 2 + hash(seed, i * 7 + k) * 0.9 + i * 0.6, dx = Math.cos(a), dz = Math.sin(a), droop = 0.25 + 0.35 * (1 - t);
      // the card lies nearly flat, its width across the branch, tilted up at its edges' mean: a branch seen from below or above
      const px = -dz * w / 2, pz = dx * w / 2, x0 = x + dx * 0.1, z0 = z + dz * 0.1, x1 = x + dx * len, z1 = z + dz * len, y1 = y - droop * len * 0.35;
      const tilt = 0.12;
      card(b, [x0 - px, y + tilt, z0 - pz], [x1 - px, y1 + tilt, z1 - pz], [x1 + px, y1 - tilt, z1 + pz], [x0 + px, y - tilt, z0 + pz], [dx * 0.3, 1, dz * 0.3], t > 0.7 ? LEAF.needlesTip : LEAF.needles, 0xc8d0c0, 0xe8f0e0, 0.75, 0.95);
      // and a second, steeper card under it so the whorl reads from the side as well
      card(b, [x0, y - 0.05, z0], [x1, y1 - 0.12, z1], [x1, y1 + 0.32 * w, z1], [x0, y + 0.32 * w, z0], [-dz, 0.4, dx], LEAF.needles, 0xa8b0a0, 0xd8e0d0, 0.7, 0.9);
    }
  }
  for (const a of [0, Math.PI / 2]) {
    const cx = Math.cos(a) * 0.35, cz = Math.sin(a) * 0.35;
    // the leader: the tip spray stood up (its u runs up the card here)
    b.vert(x - cx, h * 0.9, z - cz, 0, 0, 1, 0.75, 0.8, 0.75, LEAF.needlesTip.u0, LEAF.needlesTip.v0);
    b.vert(x + cx, h * 0.9, z + cz, 0, 0, 1, 0.75, 0.8, 0.75, LEAF.needlesTip.u0, LEAF.needlesTip.v1);
    b.vert(x, h * 1.04, z, 0, 0, 1, 0.9, 0.95, 0.9, LEAF.needlesTip.u1, (LEAF.needlesTip.v0 + LEAF.needlesTip.v1) / 2);
  }
}

/** a fountain of feathery leaf sprays at local (x, z), base y: n cards round the centre, leaning out, r wide and h tall
 *  (the photinia in the terracotta pot by the door: red-pink new growth over green) */
export function sprayFountain(b: Batch, x: number, y: number, z: number, r: number, h: number, n: number, seed: number, region: UVR = LEAF.photinia, lo = 0x8a8a80, hi = 0xffffff) {
  for (let k = 0; k < n; k++) {
    const q = hash(seed, k), a = (k / n) * Math.PI * 2 + q * 1.3, lean = 0.25 + 0.55 * hash(seed, k + 31), dx = Math.cos(a), dz = Math.sin(a);
    const hh = h * (0.6 + 0.4 * hash(seed, k + 17)), ww = r * (0.55 + 0.3 * q), px = -dz * ww / 2, pz = dx * ww / 2;
    const bx = x + dx * r * 0.15, bz = z + dz * r * 0.15, tx = x + dx * (r * 0.2 + lean * r), tz = z + dz * (r * 0.2 + lean * r), ty = y + hh;
    card(b, [bx - px, y, bz - pz], [bx + px, y, bz + pz], [tx + px, ty, tz + pz], [tx - px, ty, tz - pz], [dx * 0.6, 0.8, dz * 0.6], region, lo, hi, 0.7, 1);
  }
}

/** an olive leafy shrub at local (x, z), base y, about r wide and h tall: three crossed sprays and a ring of leaning
 *  ones (the patio's planter walls); the baked uplights light it warm from below after dark */
export function oliveShrub(b: Batch, x: number, y: number, z: number, r: number, h: number, seed: number) {
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI + hash(seed, k) * 0.5, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    card(b, [x - cx, y, z - cz], [x + cx, y, z + cz], [x + cx, y + h, z + cz], [x - cx, y + h, z - cz], [0, 1, 0], LEAF.olive, 0x8a8478, 0xe0dcc8, 0.75, 1);
  }
  sprayFountain(b, x, y, z, r * 1.1, h * 0.8, 5, seed + 3, LEAF.olive, 0x8a8478, 0xd8d4c0);
}
