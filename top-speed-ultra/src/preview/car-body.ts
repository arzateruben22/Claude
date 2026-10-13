// The Rossini GT's body: a mid-engine coupe of our own design, 4.60 m long, 1.97 m wide, 2.65 m wheelbase, roof
// 1.27 m (the preview's driver eye sits at 1.16 m, so the roof has to clear a head above it).
//
// The shape is a handful of functions of z (the car's length): the plan width, the fender crests, the deck's centre,
// and a canopy (a superellipse in section) for the cabin, blended into the deck with a smooth max so the beltline
// fillets itself. Sections are sampled by arc length and lofted into one skin; the wheel arches are cut by starting
// each section's side at the arch edge. Glass is generated from outlines on the same surface, with a black frit
// border that hides where the paint was cut away beneath it. Shut lines are drawn by the paint shader (car-mats).
//
// Car frame: metres, x right, y up, the car faces -z, origin on the ground under the middle of the car.
import * as THREE from 'three';
import { Kit, V3, v3, curve, clamp, sstep, gridGeo, roundPoly, roundRect, mat, tubeGeo, latheGeo } from './car-kit';
import type { ShutLine } from './car-mats';

export const ZF = -2.3, ZR = 2.3, YSILL = 0.13;
export const AXLE = { zF: -1.33, zR: 1.32, r: 0.345, trackF: 0.835, trackR: 0.83 };
export interface Arch { z: number; yc: number; R: number; cut: number }
const mkArch = (z: number, R: number): Arch => ({ z, yc: 0.3, R, cut: Math.sqrt(R * R - (0.3 - YSILL) ** 2) });
export const ARCHES = [mkArch(AXLE.zF, 0.425), mkArch(AXLE.zR, 0.435)];

// ------------------------------------------------------------------------------------------------ the shape
const WP = curve([[-2.3, 0.86], [-2.1, 0.915], [-1.8, 0.95], [-1.33, 0.966], [-1.0, 0.952], [-0.6, 0.938], [-0.1, 0.932], [0.4, 0.948], [0.9, 0.975], [1.32, 0.985], [1.8, 0.978], [2.1, 0.96], [2.3, 0.935]]);
const FH = curve([[-2.3, 0.56], [-2.0, 0.69], [-1.65, 0.8], [-1.33, 0.835], [-1.0, 0.855], [-0.5, 0.874], [0.0, 0.888], [0.5, 0.915], [1.0, 0.955], [1.32, 0.968], [1.8, 0.962], [2.1, 0.955], [2.3, 0.95]]);
const CC = curve([[-2.3, 0.5], [-2.0, 0.585], [-1.6, 0.69], [-1.33, 0.745], [-1.12, 0.815], [-0.6, 0.855], [0.6, 0.88], [1.2, 0.9], [2.0, 0.935], [2.3, 0.945]]);
const RH = curve([[-1.12, 0.818], [-0.85, 0.975], [-0.6, 1.11], [-0.4, 1.205], [-0.2, 1.274], [0.0, 1.305], [0.2, 1.316], [0.5, 1.284], [0.9, 1.185], [1.4, 1.07], [1.85, 0.985], [2.1, 0.94]]);
const GB = curve([[-1.12, 0.82], [-0.5, 0.86], [0.1, 0.86], [0.6, 0.79], [1.2, 0.63], [1.8, 0.5], [2.1, 0.45]]);
const ZC0 = -1.12, ZC1 = 2.1, DROP = 0.075, ROLL = 0.13, P = 4, K = 0.035;

// the nose and tail are rounded in plan (Rc) and in elevation (Rv)
function ends(z: number): [number, number] {
  let dw = 0, dy = 0;
  const q = (R: number, t: number) => (t > 0 ? R - Math.sqrt(Math.max(0, R * R - Math.min(R, t) ** 2)) : 0);
  dw += q(0.3, ZF + 0.3 - z) + q(0.12, z - (ZR - 0.12));
  dy += q(0.09, ZF + 0.09 - z) + q(0.05, z - (ZR - 0.05));
  return [dw, dy];
}
// the side intake's scallop: the door's lower half sweeps inward to feed it
function scallop(z: number, y: number) {
  const ramp = sstep(-0.55, 0.5, z) * (1 - sstep(0.84, 0.95, z)), v = (y - 0.53) / 0.16;
  return 0.095 * ramp * Math.exp(-v * v * v * v);
}
function sideRaw(z: number, y: number, Ys: number) {
  const w = WP(z) - ends(z)[0];
  const tuck = 0.075 * Math.pow(1 - sstep(YSILL, 0.4, y), 1.6), tumble = 0.035 * sstep(0.55, Ys, y);
  return w * (1 - tuck - tumble) - scallop(z, y);
}
const shoulderY = (z: number) => FH(z) - DROP;
function deck(z: number, a: number, Ws: number) {
  const Fh = FH(z), Ys = Fh - DROP, xF = Ws - ROLL, C = CC(z);
  if (a <= xF) { const u = a / xF, s = 1 - (1 - u * u) ** 2; return C + (Fh - C) * s; }
  const t = Math.min(1, (a - xF) / ROLL);
  return Ys + DROP * Math.sqrt(Math.max(0, 1 - t * t));
}
function canopy(z: number, a: number) {
  if (z < ZC0 || z > ZC1) return -9;
  const gb = GB(z); if (a >= gb) return -9;
  const base = CC(z), h = RH(z) - base; if (h <= 0) return -9;
  return base + h * Math.sqrt(1 - Math.pow(a / gb, P));
}
function smax(a: number, b: number, k: number) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return a + (b - a) * h + k * h * (1 - h); }

export const body = {
  // the shoulder: where the side meets the top (half-width and height, before the end drop)
  shoulder(z: number) { const Ys = shoulderY(z); return { Ws: sideRaw(z, Ys, Ys), Ys }; },
  // the top surface's height at half-width a (|x|)
  top(z: number, a: number) {
    const { Ws } = body.shoulder(z);
    return smax(deck(z, Math.min(a, Ws), Ws), canopy(z, a), K) - ends(z)[1];
  },
  // the side surface's half-width at height y (below the shoulder)
  side(z: number, y: number) { return sideRaw(z, y, shoulderY(z)); },
  // where the body's side starts: the sill, or the arch edge over a wheel
  yStart(z: number) {
    let y = YSILL;
    for (const A of ARCHES) { const dz = Math.abs(z - A.z); if (dz < A.cut) y = Math.max(y, A.yc + Math.sqrt(A.R * A.R - dz * dz)); }
    return y;
  },
  // half-width of the canopy flank at height y (for side glass), by bisection
  canopyX(z: number, y: number) {
    let lo = 0, hi = body.shoulder(z).Ws;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (body.top(z, m) > y) lo = m; else hi = m; }
    return (lo + hi) / 2;
  },
  // the top surface's outward normal at (x, z)
  topNormal(x: number, z: number, out = new THREE.Vector3()) {
    const e = 0.002, a = Math.abs(x), s = Math.sign(x) || 1;
    const fa = (body.top(z, a + e) - body.top(z, Math.max(0, a - e))) / (a + e - Math.max(0, a - e)) * s;
    const fz = (body.top(z + e, a) - body.top(z - e, a)) / (2 * e);
    return out.set(-fa, 1, -fz).normalize();
  },
  halfWidth: (z: number) => WP(z),
};

// ------------------------------------------------------------------------------------------------ glass outlines
// windscreen, in top view: s across (-1..1), t from the base (0) to the header (1)
export const WS = { zb: -1.095, zt: -0.2, xb: 0.765, xt: 0.61 };
export function wsXZ(s: number, t: number): [number, number] {
  const zb = WS.zb + 0.03 * s * s, zt = WS.zt + 0.025 * s * s;
  return [s * (WS.xb + (WS.xt - WS.xb) * t), zb + (zt - zb) * t];
}
export function wsPoint(s: number, t: number, off = 0, out = new THREE.Vector3()) {
  const [x, z] = wsXZ(s, t), y = body.top(z, Math.abs(x));
  out.set(x, y, z);
  if (off) out.addScaledVector(body.topNormal(x, z), off);
  return out;
}
// side glass, in side view (z, y): corners front-bottom, rear-bottom, rear-top, front-top
const FTz = -0.165;
export const SG = { fb: [-0.92, 0.885], rb: [0.56, 0.94], rt: [0.42, 1.19], ft: [FTz, 0] as number[] };
SG.ft[1] = body.top(FTz, 0.66) - 0.004;
export function sgZY(u: number, v: number): [number, number] {
  const bz = SG.fb[0] + (SG.rb[0] - SG.fb[0]) * u, by = SG.fb[1] + (SG.rb[1] - SG.fb[1]) * u;
  const tz = SG.ft[0] + (SG.rt[0] - SG.ft[0]) * u, ty = SG.ft[1] + (SG.rt[1] - SG.ft[1]) * u;
  return [bz + (tz - bz) * v, by + (ty - by) * v];
}
export function sgPoint(u: number, v: number, side: 1 | -1, out = new THREE.Vector3()) {
  const [z, y] = sgZY(u, v);
  return out.set(side * body.canopyX(z, y), y, z);
}
// rear screen over the engine bay, in top view
export const RG = { x0: 0.43, x1: 0.37, z0: 0.5, z1: 0.84 };
export function rgPoint(s: number, t: number, out = new THREE.Vector3()) {
  const x = s * (RG.x0 + (RG.x1 - RG.x0) * t), z = RG.z0 + (RG.z1 - RG.z0) * t;
  return out.set(x, body.top(z, Math.abs(x)), z);
}
// point in a convex quad (2D), shrunk by m
function inQuad(p: [number, number], q: [number, number][], m: number) {
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey);
    const cross = (ex * (p[1] - a[1]) - ey * (p[0] - a[0])) / l;
    if (cross < m) return false;
  }
  return true;
}
const ccw = (q: [number, number][]) => {
  let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; }
  return s > 0 ? q : [...q].reverse();
};
const WS_Q = ccw([wsXZ(-1, 0), wsXZ(1, 0), wsXZ(1, 1), wsXZ(-1, 1)]);
const SG_Q = ccw([SG.fb, SG.rb, SG.rt, SG.ft] as [number, number][]);
const RG_Q = ccw([[-RG.x0, RG.z0], [RG.x0, RG.z0], [RG.x1, RG.z1], [-RG.x1, RG.z1]]);
// the side intake opening and the engine-cover louvres
export const INTAKE = { z0: 0.6, z1: 0.86, y0: 0.42, y1: 0.64 };
const LOUVRE = { z0: 0.92, z1: 1.86, x: 0.38 };

// ------------------------------------------------------------------------------------------------ shut lines
export function shutLines(): ShutLine[] {
  return [
    { plane: 'side', pts: [[-0.9, 0.22], [0.4, 0.22], [0.47, 0.905], [-0.86, 0.885]], r: 0.04 },                 // doors
    { plane: 'top', pts: [[-0.5, -2.13], [0.5, -2.13], [0.57, -1.2], [-0.57, -1.2]], r: 0.07 },                  // front lid
    { plane: 'side', pts: [[-1.735, 0.47], [-1.87, 0.735]], seg: true },                                          // front bumper seams
    { plane: 'side', pts: [[1.72, 0.47], [1.98, 0.84]], seg: true },                                              // rear bumper seams
    { plane: 'side', pts: [[1.0, 0.775], [1.12, 0.775], [1.12, 0.86], [1.0, 0.86]], r: 0.015, side: 1 },         // fuel filler, right
    { plane: 'front', pts: [[-0.62, 0.2], [0.62, 0.2], [0.62, 0.4], [-0.62, 0.4]], r: 0.05, side: -1 },           // front fascia split
  ];
}

// ------------------------------------------------------------------------------------------------ the skin
export interface BodyOptions {
  q: 'phone' | 'high';
  glass?: boolean;           // windows (and the frit); false leaves the openings to be filled by the cockpit
  clip?: (c: V3) => boolean; // keep only skin quads whose centroid passes (the cockpit keeps the front)
  extras?: boolean;          // lamps, grilles, splitter, diffuser, exhausts, wipers, badges (default true)
  mirrors?: boolean;         // door mirrors (default true)
}
export function buildBody(kit: Kit, o: BodyOptions) {
  const high = o.q === 'high';
  const nS = high ? 18 : 11, nT = high ? 44 : 26;
  // stations along z: a base step, finer at the ends and either side of each arch's vertical cut
  const zset = new Set<number>();
  const step = high ? 0.028 : 0.05;
  for (let z = ZF; z <= ZR + 1e-6; z += step) zset.add(+z.toFixed(4));
  for (let k = 1; k <= 12; k++) { zset.add(+(ZF + 0.3 * (k / 12) ** 2).toFixed(4)); zset.add(+(ZR - 0.12 * (k / 12) ** 2).toFixed(4)); }
  for (const A of ARCHES) for (const s of [-1, 1]) { zset.add(+(A.z + s * (A.cut - 0.0015)).toFixed(4)); zset.add(+(A.z + s * (A.cut + 0.0015)).toFixed(4)); }
  for (let z = INTAKE.z1 - 0.06; z < INTAKE.z1 + 0.12; z += 0.012) zset.add(+z.toFixed(4));
  zset.add(ZF); zset.add(ZR);
  const zs = [...zset].filter((z) => z >= ZF && z <= ZR).sort((a, b) => a - b);

  // one section: right sill up over the top to the left sill
  const sec = (z: number): V3[] => {
    const [, dy] = ends(z), { Ws, Ys } = body.shoulder(z), y0 = Math.min(body.yStart(z), Ys - 0.02);
    const pts: [number, number][] = [];
    for (let i = 0; i < nS; i++) {
      const y = y0 + (Ys - y0) * (i / (nS - 1));
      pts.push([body.side(z, y), y0 + (y - y0) * (Ys - dy - y0) / (Ys - y0)]);
    }
    // the top: dense samples (the roll-off by angle, then across), resampled by arc length
    const dense: [number, number][] = [], xF = Ws - ROLL;
    for (let k = 0; k <= 16; k++) { const a = xF + ROLL * Math.cos((k / 16) * Math.PI / 2); dense.push([a, body.top(z, a)]); }
    for (let k = 1; k <= 180; k++) { const a = xF * (1 - k / 180); dense.push([a, body.top(z, a)]); }
    const cum = [0];
    for (let k = 1; k < dense.length; k++) cum.push(cum[k - 1] + Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1]));
    const L = cum[cum.length - 1];
    let kk = 0;
    for (let i = 1; i <= nT; i++) {
      const s = (i / nT) * L;
      while (kk < cum.length - 2 && cum[kk + 1] < s) kk++;
      const f = (s - cum[kk]) / Math.max(1e-9, cum[kk + 1] - cum[kk]);
      pts.push([dense[kk][0] + (dense[kk + 1][0] - dense[kk][0]) * f, dense[kk][1] + (dense[kk + 1][1] - dense[kk][1]) * f]);
    }
    const right = pts.map(([x, y]) => v3(x, y, z));
    const left = pts.slice(0, -1).reverse().map(([x, y]) => v3(-x, y, z));
    return [...right, ...left];
  };
  const rows = zs.map(sec);
  const nj = rows[0].length, ni = rows.length;
  // the skin, minus the openings (glass, side intakes, louvres) and anything the clip drops
  const pos = new Float32Array(ni * nj * 3), uv = new Float32Array(ni * nj * 2);
  for (let i = 0; i < ni; i++) {
    let u = 0;
    for (let j = 0; j < nj; j++) {
      const p = rows[i][j], k = i * nj + j;
      if (j > 0) u += p.distanceTo(rows[i][j - 1]);
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; uv[k * 2] = u; uv[k * 2 + 1] = p.z;
    }
  }
  const idx: number[] = [], c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const glass = o.glass ?? true;
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
    const a = rows[i][j], b = rows[i][j + 1], cc = rows[i + 1][j], d = rows[i + 1][j + 1];
    c.copy(a).add(b).add(cc).add(d).multiplyScalar(0.25);
    e1.subVectors(d, a); e2.subVectors(b, cc); n.crossVectors(e2, e1).normalize();
    if (o.clip && !o.clip(c)) continue;
    // openings
    const ax = Math.abs(c.x);
    if (n.y > 0.25 && inQuad([c.x, c.z], WS_Q, 0.022)) continue;
    if (n.y > 0.25 && inQuad([c.x, c.z], RG_Q, 0.022)) continue;
    if (Math.abs(n.x) > 0.2 && ax > 0.3 && inQuad([c.z, c.y], SG_Q, 0.022)) continue;
    if (Math.abs(n.x) > 0.3 && c.z > INTAKE.z0 + 0.012 && c.z < INTAKE.z1 - 0.012 && c.y > INTAKE.y0 + 0.012 && c.y < INTAKE.y1 - 0.012) continue;
    if (n.y > 0.3 && ax < LOUVRE.x - 0.012 && c.z > LOUVRE.z0 + 0.012 && c.z < LOUVRE.z1 - 0.012) continue;
    const ia = i * nj + j, ib = ia + 1, ic = ia + nj, id = ic + 1;
    idx.push(ia, ib, ic, ib, id, ic);
  }
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  skin.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  skin.setIndex(idx); skin.computeVertexNormals();
  kit.add('paint', skin);

  const keep = (p: V3) => !o.clip || o.clip(p);
  // the nose and tail faces, with their openings
  const capShape = (z: number, notch: boolean) => {
    const r = sec(z), s = new THREE.Shape();
    s.moveTo(r[0].x, r[0].y);
    for (let j = 1; j < r.length; j++) s.lineTo(r[j].x, r[j].y);
    if (notch) { const w = 0.7; s.lineTo(-w, YSILL); s.lineTo(-w, 0.38); s.lineTo(w, 0.38); s.lineTo(w, YSILL); }
    s.closePath();
    return s;
  };
  const intakeF = roundPoly([[-0.47, 0.17], [0.47, 0.17], [0.4, 0.335], [-0.4, 0.335]], 0.045);
  const meshR = roundRect(1.46, 0.29, 0.035, 0, 0.605);
  if (keep(v3(0, 0.3, ZF))) {
    const s = capShape(ZF, false); s.holes.push(intakeF);
    const g = new THREE.ShapeGeometry(s, 6); g.rotateY(Math.PI); g.translate(0, 0, ZF);
    kit.add('paint', g, null, 1);
  }
  if (keep(v3(0, 0.3, ZR))) {
    const s = capShape(ZR, true); s.holes.push(meshR);
    const g = new THREE.ShapeGeometry(s, 6); g.translate(0, 0, ZR);
    kit.add('paint', g, null, 1);
  }

  // arch lips (the skin's edge turned in) and the wheel-well liners
  for (const A of ARCHES) {
    if (!keep(v3(0.9, 0.6, A.z))) continue;
    for (const sd of [1, -1]) {
      const lip: V3[][] = [];
      for (const z of zs) {
        const dz = Math.abs(z - A.z); if (dz > A.cut - 0.001) continue;
        const y = body.yStart(z), x = body.side(z, y) * sd, dir = v3(0, A.yc - y, A.z - z).normalize();
        lip.push([v3(x, y, z), v3(x - sd * 0.04, y, z).addScaledVector(dir, 0.006)]);
      }
      // the vertical edges either side, from the sill to the arch
      const edge = (z: number, s2: number) => {
        const rowsE: V3[][] = [];
        for (let k = 0; k <= 8; k++) { const y = YSILL + (A.yc + Math.sqrt(A.R * A.R - A.cut * A.cut) - YSILL) * (k / 8), x = body.side(z, y) * sd; rowsE.push([v3(x, y, z), v3(x - sd * 0.04, y, z + s2 * 0.006)]); }
        return rowsE;
      };
      const add = (r: V3[][], flip: boolean) => kit.add('paint', gridGeo(r, { flip }), null, 1);
      add(lip, sd < 0);
      add(edge(A.z - A.cut, 1), sd < 0);
      add(edge(A.z + A.cut, -1), sd > 0);
      // liner: a partial cylinder round the wheel, open toward it
      const phc = Math.asin((YSILL - A.yc) / A.R), rowsL: V3[][] = [];
      for (let k = 0; k <= 24; k++) {
        const ph = phc + (Math.PI - 2 * phc) * (k / 24), z = A.z + Math.cos(ph) * (A.R + 0.004), y = A.yc + Math.sin(ph) * (A.R + 0.004);
        rowsL.push([v3(sd * (body.side(z, Math.max(YSILL, Math.min(y, 0.7))) - 0.03), y, z), v3(sd * 0.47, y, z)]);
      }
      kit.add('liner', gridGeo(rowsL, { flip: sd > 0 }), null, 0.2);
      // inner wall of the well
      const wall = new THREE.CircleGeometry(A.R + 0.004, 24, phc, Math.PI - 2 * phc); wall.rotateY(sd * Math.PI / 2); wall.translate(sd * 0.47, A.yc, A.z);
      kit.add('liner', wall, null, 0.2);
    }
  }
  // underside: the floor between the wheels and the sill bottoms
  if (keep(v3(0, 0.13, 0))) {
    const floor = new THREE.PlaneGeometry(1.4, 3.75); floor.rotateX(Math.PI / 2); floor.translate(0, 0.135, -0.2);
    kit.add('dark', floor, null, 0.5);
    for (const sd of [1, -1]) {
      const r: V3[][] = [];
      for (const z of zs) { if (body.yStart(z) > YSILL + 1e-4 || z < -2.1 || z > 1.7) { if (r.length > 1) { kit.add('dark', gridGeo(r, { flip: sd < 0 }), null, 0.5); } r.length = 0; continue; } r.push([v3(sd * body.side(z, YSILL), YSILL, z), v3(sd * 0.7, 0.135, z)]); }
      if (r.length > 1) kit.add('dark', gridGeo(r, { flip: sd < 0 }), null, 0.5);
    }
  }

  if (glass) buildGlass(kit, keep);
  if (o.extras ?? true) buildExtras(kit, o, keep, intakeF, meshR);
  if (o.mirrors ?? true) for (const sd of [1, -1] as const) mirrorParts(kit, sd, true);
}

// ------------------------------------------------------------------------------------------------ glass
function offsetGeo(g: THREE.BufferGeometry, d: number) {
  const p = g.attributes.position, nn = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nn.getX(i) * d, p.getY(i) + nn.getY(i) * d, p.getZ(i) + nn.getZ(i) * d);
  p.needsUpdate = true;
  return g;
}
// a param grid split into a frit border (black) and the clear middle
function glassPanel(kit: Kit, rows: V3[][], border: number, flip: boolean, keyGlass = 'glass', keyFrit = 'frit') {
  const ni = rows.length, nj = rows[0].length;
  const g = offsetGeo(gridGeo(rows, { flip }), 0.003);
  const idx = g.index!.array, inner: number[] = [], outer: number[] = [];
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
    const k = (i * (nj - 1) + j) * 6, frit = i < border || j < border || i >= ni - 1 - border || j >= nj - 1 - border;
    (frit ? outer : inner).push(...Array.from(idx.slice(k, k + 6)));
  }
  const gi = g.clone(); gi.setIndex(inner);
  const go = g.clone(); go.setIndex(outer);
  kit.add(keyGlass, gi); kit.add(keyFrit, go);
}
export function windscreenRows(ns: number, nt: number, off = 0) {
  const rows: V3[][] = [];
  for (let i = 0; i <= nt; i++) { const r: V3[] = []; for (let j = 0; j <= ns; j++) r.push(wsPoint(-1 + 2 * (j / ns), i / nt, off)); rows.push(r); }
  return rows;
}
export function sideGlassRows(side: 1 | -1, nu: number, nv: number) {
  const rows: V3[][] = [];
  for (let i = 0; i <= nv; i++) { const r: V3[] = []; for (let j = 0; j <= nu; j++) r.push(sgPoint(j / nu, i / nv, side)); rows.push(r); }
  return rows;
}
function buildGlass(kit: Kit, keep: (p: V3) => boolean) {
  if (keep(v3(0, 1, -0.6))) glassPanel(kit, windscreenRows(30, 18), 1, false);
  for (const sd of [1, -1] as const) if (keep(v3(sd * 0.8, 1, 0))) glassPanel(kit, sideGlassRows(sd, 24, 10), 1, sd < 0);
  if (keep(v3(0, 1.2, 0.6))) {
    const rows: V3[][] = [];
    for (let i = 0; i <= 8; i++) { const r: V3[] = []; for (let j = 0; j <= 14; j++) r.push(rgPoint(-1 + 2 * (j / 14), i / 8)); rows.push(r); }
    glassPanel(kit, rows, 1, false);
  }
}

// ------------------------------------------------------------------------------------------------ door mirrors
// a wedge-nosed pod on a carbon blade from the door's top front corner; the glass faces back, flush in its rim
export const MIRROR = { at: v3(1.025, 0.975, -0.7), w: 0.205, h: 0.094, d: 0.12, glass: [0.172, 0.074] as [number, number], yaw: 0.14 };
function mirrorQ(side: 1 | -1) { return new THREE.Quaternion().setFromEuler(new THREE.Euler(0.03, -side * MIRROR.yaw, 0)); }
export function mirrorGlassPlacement(side: 1 | -1, inset = 0.006) {
  const q = mirrorQ(side);
  const p = v3(0, 0, MIRROR.d / 2 - inset).applyQuaternion(q).add(v3(side * MIRROR.at.x, MIRROR.at.y, MIRROR.at.z));
  return { p, q };
}
// superellipse section of the housing at t (0 nose .. 1 back face)
function podSection(t: number, n: number, side: 1 | -1): V3[] {
  const s = Math.sqrt(1 - (1 - t) ** 2.2), out: V3[] = [];
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / 3.2) * MIRROR.w / 2 * s, y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / 3.2) * MIRROR.h / 2 * s;
    // the outboard end tapers a little, the bottom is flatter
    out.push(v3(side * x * (1 - 0.08 * Math.max(0, c)), y * (y < 0 ? 0.85 : 1), -MIRROR.d / 2 + MIRROR.d * t));
  }
  return out;
}
export function mirrorParts(kit: Kit, side: 1 | -1, withGlass: boolean, housingKey = 'paint') {
  const q = mirrorQ(side), c = v3(side * MIRROR.at.x, MIRROR.at.y, MIRROR.at.z);
  const m = new THREE.Matrix4().compose(c, q, v3(1, 1, 1));
  const rows: V3[][] = [];
  for (let i = 0; i <= 10; i++) rows.push(podSection(i / 10, 40, side));
  kit.add(housingKey, gridGeo(rows, { closeU: true, flip: side < 0 }), m, 0.3);
  // the back: a black rim, then the glass a few mm in
  const back = podSection(1, 40, side), inner = back.map((p) => v3(p.x * 0.9, p.y * 0.86, p.z));
  kit.add('trim', gridGeo([back, inner], { closeU: true, flip: side < 0 }), m, 0.1);
  const cup = new THREE.ShapeGeometry(new THREE.Shape(inner.map((p) => new THREE.Vector2(p.x, p.y))), 1);
  if (side < 0) { const idx = cup.index!; for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); } }
  cup.translate(0, 0, MIRROR.d / 2 - 0.012);
  kit.add('dark', cup, m, 0.1);
  if (withGlass) { const g = new THREE.PlaneGeometry(MIRROR.glass[0], MIRROR.glass[1]); const gp = mirrorGlassPlacement(side); g.applyQuaternion(gp.q); g.translate(gp.p.x, gp.p.y, gp.p.z); kit.add('mirror', g, null, 0.2); }
  // the blade to the door
  const a = v3(side * 0.925, 0.9, -0.675), b = v3(side * 0.985, 0.958, -0.695);
  const blade = new THREE.BoxGeometry(0.02, 1, 0.075, 1, 3, 1); blade.applyMatrix4(new THREE.Matrix4().makeScale(1, a.distanceTo(b) + 0.02, 1));
  blade.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize()), v3(1, 1, 1)));
  kit.add('carbon', blade, null, 0.1);
}

// ------------------------------------------------------------------------------------------------ lamps, grilles, aero
function lampTex(kind: 'head' | 'tail') {
  const w = kind === 'head' ? 512 : 1024, h = kind === 'head' ? 128 : 64;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; };
  const [c, g] = mk(), [ce, ge] = mk();
  ge.fillStyle = '#000'; ge.fillRect(0, 0, w, h);
  if (kind === 'head') {
    // housing: graphite with a soft reflector sheen
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a2d31'); gr.addColorStop(0.5, '#141619'); gr.addColorStop(1, '#0a0b0c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // turn indicator (amber lens, off) at the inner end
    g.fillStyle = '#5a3a10'; g.fillRect(8, 34, 90, 26);
    // two projector modules: chrome bezel, dark lens with a blue coating
    for (const cx of [0.5, 0.74]) {
      const x = cx * w, y = h * 0.58, r = h * 0.27;
      const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r * 1.35);
      rg.addColorStop(0, '#f4f6f8'); rg.addColorStop(0.5, '#8b9096'); rg.addColorStop(1, '#2a2c2f');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r * 1.3, 0, Math.PI * 2); g.fill();
      const lg = g.createRadialGradient(x - r * 0.25, y - r * 0.3, 1, x, y, r);
      lg.addColorStop(0, '#9fb4d8'); lg.addColorStop(0.35, '#1b2533'); lg.addColorStop(1, '#05070a');
      g.fillStyle = lg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      ge.fillStyle = 'rgba(160,180,210,0.25)'; ge.beginPath(); ge.arc(x, y, r * 0.7, 0, Math.PI * 2); ge.fill();
    }
    // the daytime running light: a light guide along the front edge, hooking down at the outer end
    for (const [ctx, col] of [[g, '#e8eef6'], [ge, '#ffffff']] as const) {
      ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(110, 17); ctx.lineTo(w - 26, 17); ctx.quadraticCurveTo(w - 10, 18, w - 12, 50); ctx.lineTo(w - 14, 96); ctx.stroke();
    }
  } else {
    g.fillStyle = '#2a0204'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 6) { g.fillStyle = x % 12 ? '#5a0a0e' : '#40060a'; g.fillRect(x, 0, 3, h); }
    for (const [ctx, col, a] of [[g, '#ff3b3b', 0.9], [ge, '#ff2020', 1]] as const) {
      ctx.globalAlpha = a; ctx.fillStyle = col;
      ctx.fillRect(0, h * 0.36, w, h * 0.24);
      ctx.globalAlpha = 1;
    }
  }
  const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(ce);
  t.colorSpace = te.colorSpace = THREE.SRGBColorSpace; t.anisotropy = te.anisotropy = 8;
  return { map: t, emissiveMap: te };
}
export function lampMaterials() {
  const head = lampTex('head'), tail = lampTex('tail');
  return {
    lamp: new THREE.MeshPhysicalMaterial({ map: head.map, emissive: 0xffffff, emissiveMap: head.emissiveMap, emissiveIntensity: 2.4, metalness: 0.4, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.02 }),
    tail: new THREE.MeshPhysicalMaterial({ map: tail.map, emissive: 0xffffff, emissiveMap: tail.emissiveMap, emissiveIntensity: 1.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 }),
  };
}
const HEAD = [[0.36, -2.17], [0.79, -2.095], [0.86, -1.93], [0.5, -2.0]] as [number, number][];
function buildExtras(kit: Kit, o: BodyOptions, keep: (p: V3) => boolean, intakeF: THREE.Shape, meshR: THREE.Shape) {
  // headlamps: a param patch on the fender tops, a hair proud of the paint
  if (keep(v3(0.6, 0.6, -2.0))) for (const sd of [1, -1]) {
    const rows: V3[][] = [];
    for (let i = 0; i <= 6; i++) {
      const r: V3[] = [];
      for (let j = 0; j <= 16; j++) {
        const u = j / 16, v = i / 6;
        const ax = HEAD[0][0] + (HEAD[1][0] - HEAD[0][0]) * u, az = HEAD[0][1] + (HEAD[1][1] - HEAD[0][1]) * u;
        const bx = HEAD[3][0] + (HEAD[2][0] - HEAD[3][0]) * u, bz = HEAD[3][1] + (HEAD[2][1] - HEAD[3][1]) * u;
        let x = ax + (bx - ax) * v; const z = az + (bz - az) * v;
        x = Math.min(x, body.shoulder(z).Ws - 0.01);
        r.push(v3(sd * x, body.top(z, x) + 0.004, z));
      }
      rows.push(r);
    }
    const g = gridGeo(rows, { flip: sd < 0 });
    const uvA = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 16; j++) uvA.setXY(i * 17 + j, j / 16, 1 - i / 6);
    kit.add('lamp', g);
  }
  // front intake: frame, tunnel, honeycomb, dark back
  if (keep(v3(0, 0.25, ZF))) {
    const pts = intakeF.getPoints(6);
    const frame = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * 1.03, 0.252 + (p.y - 0.252) * 1.09)));
    frame.holes.push(new THREE.Path(pts));
    const fg = new THREE.ShapeGeometry(frame, 4); fg.rotateY(Math.PI); fg.translate(0, 0, ZF - 0.003);
    kit.add('trim', fg, null, 0.2);
    const tunnel: V3[][] = [pts.map((p) => v3(p.x, p.y, ZF)), pts.map((p) => v3(p.x, p.y, ZF + 0.09))];
    kit.add('dark', gridGeo(tunnel, { flip: false }), null, 0.2);
    const back = new THREE.ShapeGeometry(intakeF, 6); back.rotateY(Math.PI); back.translate(0, 0, ZF + 0.09);
    kit.add('dark', back, null, 0.2);
    const hc = new THREE.ShapeGeometry(intakeF, 6); hc.rotateY(Math.PI); hc.translate(0, 0, ZF + 0.025);
    kit.add('grille', hc, null, 1);
    // splitter: a carbon blade under the nose
    const sp = roundRect(1.5, 0.42, 0.22, 0, 0); const sg = new THREE.ExtrudeGeometry(sp, { depth: 0.018, bevelEnabled: false, curveSegments: 10 });
    sg.rotateX(Math.PI / 2); sg.translate(0, 0.128, ZF + 0.16);
    kit.add('carbon', sg, null, 1);
  }
  // rear: light bar, mesh panel, exhausts, diffuser, wordmark
  if (keep(v3(0, 0.5, ZR))) {
    const bar = new THREE.PlaneGeometry(1.56, 0.034); bar.translate(0, 0.815, ZR + 0.003);
    kit.add('tail', bar);
    const pts = meshR.getPoints(6);
    kit.add('dark', gridGeo([pts.map((p) => v3(p.x, p.y, ZR)), pts.map((p) => v3(p.x, p.y, ZR - 0.1))], { flip: true }), null, 0.2);
    const back = new THREE.ShapeGeometry(meshR, 6); back.translate(0, 0, ZR - 0.1); kit.add('dark', back, null, 0.2);
    const hc = new THREE.ShapeGeometry(meshR, 6); hc.translate(0, 0, ZR - 0.03); kit.add('grille', hc, null, 1);
    const frame = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * 1.012, 0.605 + (p.y - 0.605) * 1.07)));
    frame.holes.push(new THREE.Path(pts));
    const fg = new THREE.ShapeGeometry(frame, 4); fg.translate(0, 0, ZR + 0.002); kit.add('trim', fg, null, 0.2);
    for (const sd of [1, -1]) {
      const tip = latheGeo([[0.047, ZR - 0.09], [0.056, ZR - 0.02], [0.058, ZR + 0.02], [0.054, ZR + 0.025], [0.047, ZR + 0.018], [0.047, ZR - 0.09]], 32, 'z', { vScale: 0.1 });
      tip.translate(sd * 0.115, 0.5, 0);
      kit.add('exhaust', tip);
      const inner = new THREE.CircleGeometry(0.047, 24); inner.translate(sd * 0.115, 0.5, ZR - 0.05); kit.add('dark', inner, null, 0.1);
    }
    // diffuser: a ramp up from the floor with five strakes
    const ramp: V3[][] = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8, z = 1.7 + (ZR - 1.7) * t, y = 0.135 + (0.38 - 0.135) * (t * t * (3 - 2 * t)); ramp.push([v3(-0.7, y, z), v3(0.7, y, z)]); }
    kit.add('carbon', gridGeo(ramp, { flip: true }), null, 1);
    for (const x of [-0.7, -0.42, -0.14, 0.14, 0.42, 0.7]) {
      const s = new THREE.Shape(); s.moveTo(1.7, 0.135); s.lineTo(ZR + 0.02, 0.135);
      for (let k = 8; k >= 0; k--) { const t = k / 8; s.lineTo(1.7 + (ZR - 1.7) * t, 0.135 + (0.38 - 0.135) * (t * t * (3 - 2 * t))); }
      const fin = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false }); fin.rotateY(-Math.PI / 2); fin.translate(x + 0.004, 0, 0);
      kit.add('carbon', fin, null, 1);
    }
  }
  // side intakes: an opening at the end of the scallop, with a gloss frame, honeycomb and a dark plenum
  if (keep(v3(0.9, 0.5, 0.7))) for (const sd of [1, -1]) {
    const I = INTAKE, nz = 10, ny = 8;
    const conf = (z: number, y: number, d: number) => v3(sd * (body.side(z, y) + d), y, z);
    const grid = (d: number, m = 0) => { const rows: V3[][] = []; for (let i = 0; i <= ny; i++) { const r: V3[] = []; for (let j = 0; j <= nz; j++) r.push(conf(I.z0 + m + (I.z1 - I.z0 - 2 * m) * (j / nz), I.y0 + m + (I.y1 - I.y0 - 2 * m) * (i / ny), d)); rows.push(r); } return rows; };
    const hc = gridGeo(grid(-0.012), { flip: sd < 0 });
    const huv = hc.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < huv.count; k++) huv.setXY(k, hc.attributes.position.getZ(k), hc.attributes.position.getY(k));
    kit.add('grille', hc);
    kit.add('dark', gridGeo(grid(-0.09), { flip: sd < 0 }), null, 0.2);
    // tunnel walls and frame: rings round the rectangle at three depths
    const ring = (d: number, grow: number) => { const r: V3[] = []; const z0 = I.z0 - grow, z1 = I.z1 + grow, y0 = I.y0 - grow, y1 = I.y1 + grow; const k = 6;
      for (let j = 0; j < k; j++) r.push(conf(z0 + (z1 - z0) * (j / k), y0, d)); for (let j = 0; j < k; j++) r.push(conf(z1, y0 + (y1 - y0) * (j / k), d));
      for (let j = 0; j < k; j++) r.push(conf(z1 - (z1 - z0) * (j / k), y1, d)); for (let j = 0; j <= k; j++) r.push(conf(z0, y1 - (y1 - y0) * (j / k), d)); return r; };
    kit.add('dark', gridGeo([ring(0.001, 0), ring(-0.09, 0)], { flip: sd < 0 }), null, 0.2);
    kit.add('trim', gridGeo([ring(0.003, 0.016), ring(0.003, 0)], { flip: sd < 0 }), null, 0.2);
  }
  // engine-cover louvres between the haunches: dark well, nine gloss blades
  if (keep(v3(0, 1.0, 1.3))) {
    const L = LOUVRE, well: V3[][] = [];
    for (let i = 0; i <= 12; i++) { const z = L.z0 + (L.z1 - L.z0) * (i / 12), r: V3[] = []; for (let j = 0; j <= 8; j++) { const x = -L.x + 2 * L.x * (j / 8); r.push(v3(x, body.top(z, Math.abs(x)) - 0.05, z)); } well.push(r); }
    kit.add('dark', gridGeo(well, { flip: false }), null, 0.2);
    const edge: V3[] = [];
    const k = 10; for (let j = 0; j <= k; j++) edge.push(v3(-L.x + 2 * L.x * j / k, 0, L.z0)); for (let j = 1; j <= k; j++) edge.push(v3(L.x, 0, L.z0 + (L.z1 - L.z0) * j / k));
    for (let j = 1; j <= k; j++) edge.push(v3(L.x - 2 * L.x * j / k, 0, L.z1)); for (let j = 1; j <= k; j++) edge.push(v3(-L.x, 0, L.z1 - (L.z1 - L.z0) * j / k));
    const top = edge.map((p) => v3(p.x, body.top(p.z, Math.abs(p.x)) + 0.001, p.z)), bot = edge.map((p) => v3(p.x, body.top(p.z, Math.abs(p.x)) - 0.05, p.z));
    kit.add('dark', gridGeo([top, bot], { flip: false }), null, 0.2);
    for (let b = 0; b < 9; b++) {
      const z = L.z0 + 0.06 + (L.z1 - L.z0 - 0.12) * (b / 8), r0: V3[] = [], r1: V3[] = [];
      for (let j = 0; j <= 10; j++) { const x = -L.x + 0.01 + (2 * L.x - 0.02) * (j / 10), y = body.top(z, Math.abs(x)); r0.push(v3(x, y - 0.002, z - 0.03)); r1.push(v3(x, y - 0.03, z + 0.03)); }
      kit.add('trim', gridGeo([r0, r1], { flip: false }), null, 0.2);
    }
  }
  // wipers parked along the base of the windscreen
  if (keep(v3(0, 0.9, -1.05))) for (const [px, len] of [[-0.06, 0.6], [0.6, 0.5]] as [number, number][]) {
    const path: V3[] = [];
    for (let k = 0; k <= 10; k++) { const x = px - len * (k / 10), z = -1.045 + 0.012 * (k / 10); path.push(v3(x, body.top(z, Math.abs(x)) + 0.016, z)); }
    kit.add('dark', tubeGeo(path, () => 0.007, 6, { rb: () => 0.004 }), null, 0.1);
    const blade = path.map((p) => p.clone().add(v3(0, -0.008, -0.012)));
    kit.add('rubber', tubeGeo(blade, () => 0.004, 5, { rb: () => 0.006 }), null, 0.1);
  }
  // badges: the R on the nose, the wordmark on the tail
  if (keep(v3(0, 0.5, -2.2))) {
    const z = -2.2, y = body.top(z, 0), nrm = body.topNormal(0, z);
    const disc = new THREE.CircleGeometry(0.03, 32);
    const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), nrm);
    disc.applyQuaternion(q); disc.translate(0, y + 0.0025, z);
    kit.add('badge', disc);
  }
  if (keep(v3(0, 0.86, ZR))) { const w = new THREE.PlaneGeometry(0.36, 0.045); w.translate(0, 0.865, ZR + 0.002); kit.add('word', w); }
  void o;
}

// ------------------------------------------------------------------------------------------------ a cabin seen through the glass
// for outside views only: dark seats, dash and a wheel so the windows don't look onto nothing
export function cabinSilhouette(kit: Kit) {
  const add = (g: THREE.BufferGeometry, m: THREE.Matrix4) => kit.add('interior', g.applyMatrix4(m), null, 0.3);
  add(new THREE.BoxGeometry(1.7, 0.2, 0.42), mat(0, 0.76, -0.86, -0.1));
  for (const sx of [-0.37, 0.37]) {
    add(new THREE.BoxGeometry(0.5, 0.12, 0.5), mat(sx, 0.32, 0.1));
    add(new THREE.BoxGeometry(0.5, 0.72, 0.14), mat(sx, 0.72, 0.42, -0.22));
    add(new THREE.BoxGeometry(0.3, 0.2, 0.1), mat(sx, 1.12, 0.52, -0.22));
  }
  add(new THREE.TorusGeometry(0.178, 0.02, 8, 32), mat(-0.37, 0.8, -0.42, -0.38));
  add(new THREE.BoxGeometry(0.24, 0.3, 0.9), mat(0, 0.28, -0.2));
  const back = new THREE.PlaneGeometry(1.7, 0.6); back.applyMatrix4(mat(0, 0.85, 0.55, 0, Math.PI));
  kit.add('interior', back, null, 0.3);
}
