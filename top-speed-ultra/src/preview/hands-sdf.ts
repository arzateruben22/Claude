// The driver's hand as a signed distance field: anatomically proportioned bones and soft tissue (metacarpals, three
// phalanges per finger, two for the thumb, knuckle heads, thenar and hypothenar pads, the extensor tendons, the wrist
// and the forearm to the elbow) joined with smooth-min, closed round the steering wheel's rim the way a real grip
// closes: each joint flexes until its bone's pad meets the rim, and the pads flatten where they press on it.
//
// Units here are MILLIMETRES. The hand is built as the RIGHT hand in the grip frame G:
//   origin on the rim's centreline at GRIP.right.deg, x along the rim toward twelve o'clock, y out from the hub,
//   z toward the driver (the wheel's own z). The left hand is its mirror image (x -> -x in the wheel's plane).
// Helpers convert G to the wheel's plane W (mm, spec.ts rimAt() frame) and to the car's frame (metres).
import { RIM_R, rimA, rimB, GRIP, WHEEL_AT, WHEEL_TILT } from './spec';

export type V3 = [number, number, number];
export type Pres = 'm' | 'f';

// ------------------------------------------------------------------------------------------------ small vector kit
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const madd = (a: V3, b: V3, s: number): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// the part of a perpendicular to unit n
export const perp = (a: V3, n: V3): V3 => norm(madd(a, n, -dot(a, n)));
// rotate p about the unit axis k by ang (Rodrigues)
export function rot(p: V3, k: V3, ang: number): V3 {
  const c = Math.cos(ang), s = Math.sin(ang), kd = dot(k, p), kx = cross(k, p);
  return [p[0] * c + kx[0] * s + k[0] * kd * (1 - c), p[1] * c + kx[1] * s + k[1] * kd * (1 - c), p[2] * c + kx[2] * s + k[2] * kd * (1 - c)];
}
const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------------------------ frames
export const GRIP_A = (GRIP.right.deg * Math.PI) / 180;
const CA = Math.cos(GRIP_A), SA = Math.sin(GRIP_A), RMM = RIM_R * 1000;
const CT = Math.cos(WHEEL_TILT), ST = Math.sin(WHEEL_TILT);
/** grip frame (mm) to the wheel's plane (mm): x right, y up, z toward the driver, origin at the hub */
export const gToW = (g: V3): V3 => [RMM * CA - g[0] * SA + g[1] * CA, RMM * SA + g[0] * CA + g[1] * SA, g[2]];
export const dirGToW = (g: V3): V3 => [-g[0] * SA + g[1] * CA, g[0] * CA + g[1] * SA, g[2]];
export const wToG = (w: V3): V3 => { const dx = w[0] - RMM * CA, dy = w[1] - RMM * SA; return [-dx * SA + dy * CA, dx * CA + dy * SA, w[2]]; };
export const dirWToG = (w: V3): V3 => [-w[0] * SA + w[1] * CA, w[0] * CA + w[1] * SA, w[2]];
/** wheel plane (mm) to the car's frame (m), wheel straight ahead */
export const wToCar = (w: V3): V3 => {
  const x = w[0] / 1000, y = w[1] / 1000, z = w[2] / 1000;
  return [WHEEL_AT.x + x, WHEEL_AT.y + y * CT - z * ST, WHEEL_AT.z + y * ST + z * CT];
};
export const carToW = (c: V3): V3 => {
  const x = c[0] - WHEEL_AT.x, y = c[1] - WHEEL_AT.y, z = c[2] - WHEEL_AT.z;
  return [x * 1000, (y * CT + z * ST) * 1000, (-y * ST + z * CT) * 1000];
};
export const gToCar = (g: V3) => wToCar(gToW(g));

// the rim (spec.ts rimAt/rimA/rimB: round where the hands are), as a distance field in the grip frame (mm). Its
// section's half-thicknesses come from a table over the angle (they change slowly; this is the hot path)
function ellipse2(x: number, y: number, A: number, B: number) {
  const k0 = Math.sqrt((x * x) / (A * A) + (y * y) / (B * B)), k1 = Math.sqrt((x * x) / (A * A * A * A) + (y * y) / (B * B * B * B));
  return k1 < 1e-9 ? -Math.min(A, B) : (k0 * (k0 - 1)) / k1;
}
const LUT_N = 2048, LUT_A = new Float64Array(LUT_N + 1), LUT_B = new Float64Array(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) { const a = -Math.PI + (i / LUT_N) * 2 * Math.PI; LUT_A[i] = rimA(a) * 1000; LUT_B[i] = rimB(a) * 1000; }
export function rimSdfG(gx: number, gy: number, gz: number) {
  const wx = RMM * CA - gx * SA + gy * CA, wy = RMM * SA + gx * CA + gy * SA;
  const r = Math.sqrt(wx * wx + wy * wy), a = Math.atan2(wy, wx);
  const u = ((a + Math.PI) / (2 * Math.PI)) * LUT_N, i = Math.min(LUT_N - 1, u | 0), t = u - i;
  return ellipse2(r - RMM, gz, LUT_A[i] + (LUT_A[i + 1] - LUT_A[i]) * t, LUT_B[i] + (LUT_B[i + 1] - LUT_B[i]) * t);
}

// ------------------------------------------------------------------------------------------------ the field
// Primitives: 0 = round cone with an elliptical section, 1 = ellipsoid. Each belongs to a group (0 palm and arm,
// 1 thumb, 2..5 the four fingers) and blends into it with its own radius k.
const S = 20;
export const G_PALM = 0, G_THUMB = 1, G_FINGER = 2;
export class Field {
  n = 0;
  type: number[] = []; group: number[] = []; k: number[] = []; tag: number[] = [];
  F: number[] = [];
  kThumb = 9; kWeb = 4.5;
  clear = 0.5;            // how far the skin stays off the rim (mm)
  bulge = 1.1;            // flesh displaced where it presses on the rim (mm)
  rim = true;
  private Fa: Float64Array = new Float64Array(0);
  private T: Uint8Array = new Uint8Array(0); private Gp: Uint8Array = new Uint8Array(0); private K: Float64Array = new Float64Array(0);

  // a round cone from a (radius r1) to b (radius r2); its section is scaled by su along `up` and sl across
  cone(a: V3, b: V3, r1: number, r2: number, up: V3, su: number, sl: number, group: number, k: number, tag = 0) {
    const ax = norm(sub(b, a)), L = len(sub(b, a));
    const u = perp(up, ax), l = cross(ax, u);
    const bb = Math.max(-0.95, Math.min(0.95, (r1 - r2) / Math.max(L, 1e-6))), aa = Math.sqrt(1 - bb * bb);
    this.F.push(a[0], a[1], a[2], ax[0], ax[1], ax[2], u[0], u[1], u[2], l[0], l[1], l[2], L, r1, r2, su, sl, Math.min(1, su, sl), bb, aa);
    this.type.push(0); this.group.push(group); this.k.push(k); this.tag.push(tag); this.n++;
    return this.n - 1;
  }
  // an ellipsoid at c with semi-axes rx along ax, ry along up (made perpendicular), rz across
  ell(c: V3, ax: V3, up: V3, rx: number, ry: number, rz: number, group: number, k: number, tag = 0) {
    const x = norm(ax), u = perp(up, x), l = cross(x, u);
    this.F.push(c[0], c[1], c[2], x[0], x[1], x[2], u[0], u[1], u[2], l[0], l[1], l[2], rx, ry, rz, 0, 0, 0, 0, 0);
    this.type.push(1); this.group.push(group); this.k.push(k); this.tag.push(tag); this.n++;
    return this.n - 1;
  }
  finalize() {
    this.Fa = Float64Array.from(this.F);
    this.T = Uint8Array.from(this.type); this.Gp = Uint8Array.from(this.group); this.K = Float64Array.from(this.k);
  }
  prim(i: number, x: number, y: number, z: number) {
    const F = this.Fa, b = i * S;
    const dx = x - F[b], dy = y - F[b + 1], dz = z - F[b + 2];
    const lx = dx * F[b + 3] + dy * F[b + 4] + dz * F[b + 5];
    const ly = dx * F[b + 6] + dy * F[b + 7] + dz * F[b + 8];
    const lz = dx * F[b + 9] + dy * F[b + 10] + dz * F[b + 11];
    if (this.T[i] === 0) {
      const L = F[b + 12], r1 = F[b + 13], r2 = F[b + 14], su = ly / F[b + 15], sl = lz / F[b + 16], qx = Math.sqrt(su * su + sl * sl), qy = lx;
      const bb = F[b + 18], aa = F[b + 19], kk = -bb * qx + aa * qy;
      let d: number;
      if (kk < 0) d = Math.sqrt(qx * qx + qy * qy) - r1;
      else if (kk > aa * L) d = Math.sqrt(qx * qx + (qy - L) * (qy - L)) - r2;
      else d = qx * aa + qy * bb - r1;
      return d * F[b + 17];
    }
    const rx = F[b + 12], ry = F[b + 13], rz = F[b + 14];
    const ax = lx / rx, ay = ly / ry, az = lz / rz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az), k1 = Math.sqrt((ax * ax) / (rx * rx) + (ay * ay) / (ry * ry) + (az * az) / (rz * rz));
    return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  }
  // the skin without the rim's press
  private acc = new Float64Array(6);
  free(x: number, y: number, z: number, act: Int32Array | null, nAct: number) {
    const acc = this.acc; acc.fill(1e9);
    const n = act ? nAct : this.n;
    for (let j = 0; j < n; j++) {
      const i = act ? act[j] : j;
      const d = this.prim(i, x, y, z), g = this.Gp[i], a = acc[g], k = this.K[i];
      const h = Math.max(k - Math.abs(a - d), 0) / k;
      acc[g] = Math.min(a, d) - h * h * k * 0.25;
    }
    let pt = acc[0];
    { const k = this.kThumb, a = pt, d = acc[1], h = Math.max(k - Math.abs(a - d), 0) / k; pt = Math.min(a, d) - h * h * k * 0.25; }
    let res = pt;
    for (let f = 2; f < 6; f++) {
      const d = acc[f]; if (d > 1e8) continue;
      const k = this.kWeb, h = Math.max(k - Math.abs(pt - d), 0) / k;
      res = Math.min(res, Math.min(pt, d) - h * h * k * 0.25);
    }
    return res;
  }
  // the arm ends in a flat cap past the elbow, inside the sleeve
  cap: number[] | null = null;
  bounds(): { c: V3; r: number }[] {
    const out: { c: V3; r: number }[] = [];
    for (let i = 0; i < this.n; i++) {
      const b = i * S, F = this.F, c: V3 = [F[b], F[b + 1], F[b + 2]];
      if (this.type[i] === 0) {
        const L = F[b + 12], s = Math.max(F[b + 15], F[b + 16], 1), r = Math.max(F[b + 13], F[b + 14]) * s;
        out.push({ c: madd(c, [F[b + 3], F[b + 4], F[b + 5]], L / 2), r: L / 2 + r });
      } else out.push({ c, r: Math.max(F[b + 12], F[b + 13], F[b + 14]) });
    }
    return out;
  }
  // the skin as it is on the wheel: pressed flat against the rim, with the displaced flesh bulging round the contact
  eval(x: number, y: number, z: number, act: Int32Array | null, nAct: number) {
    let s = this.free(x, y, z, act, nAct);
    const c = this.cap;
    if (c) s = Math.max(s, (x - c[0]) * c[3] + (y - c[1]) * c[4] + (z - c[2]) * c[5]);
    if (!this.rim) return s;
    const dr = rimSdfG(x, y, z) - this.clear;
    const t = Math.max(0, 1 - dr / 5);
    return Math.max(s - this.bulge * t * t, -dr);
  }
}

// ------------------------------------------------------------------------------------------------ the anatomy
export interface Digit {
  name: string;
  joints: V3[];       // bone-axis points: MCP, PIP, DIP, tip (thumb: CMC, MCP, IP, tip)
  dirs: V3[];         // the three bones' directions
  dorsal: V3[];       // the three bones' dorsal (nail-side) directions
  flexAxis: V3;
  halfW: number[];    // half widths of the three bones
  dors: number[];     // axis to dorsal skin, per bone
  palm: number[];     // axis to palmar skin, per bone
  flex: number[];     // the flexion each joint took (deg)
  nail: { len: number; width: number; free: number };
}
export interface Anatomy {
  pres: Pres;
  field: Field;
  digits: Digit[];                    // index, middle, ring, little, thumb
  palm: { O: V3; P: V3; R: V3; N: V3 };
  mcp: V3[];
  wrist: V3;                          // the wrist joint centre (G, mm)
  wristDorsal: V3;                    // unit: the back of the wrist
  elbow: V3; shoulder: V3;            // where the arm comes from (G, mm), after reaching
  foreDir: V3;                        // unit, wrist -> elbow
  foreUp: V3;                         // unit, the back of the forearm
  wristHalf: [number, number];        // half width and half depth of the wrist (mm)
  upper: number; fore: number;        // bone lengths (mm)
  veins: number[];                    // segments for the shader, G mm: x0 y0 z0 x1 y1 z1 r ...
  holes: number[];                    // glove: knuckle holes x y z r, and the open back x y z r
  scale: number;
}

interface Dims {
  len: number[][]; halfW: number[][]; dors: number[][]; palm: number[][];
  mc: number[]; spread: number[]; prox: number[]; arch: number[]; knuckle: number[]; fan: number[];
  thumb: { len: number[]; halfW: number[]; dors: number[]; palm: number[] };
  wrist: [number, number]; foreLen: number; upperLen: number; tendon: number; nailFree: number;
  forearm: [number, number][];     // half width, half depth at 0, 25, 50, 75, 100% from wrist to elbow
}

function dims(pres: Pres): Dims {
  // adult male, about the 50th percentile: hand length ~189 mm, breadth ~87 mm
  const m: Dims = {
    //        proximal, middle, distal (joint centre to joint centre; distal to the fingertip)
    len: [[41, 25, 22], [45, 28.5, 23.5], [42, 27, 23], [33.5, 20, 20]],
    halfW: [[10.0, 9.2, 8.5], [10.2, 9.6, 8.8], [9.7, 9.0, 8.3], [8.6, 7.9, 7.3]],
    dors: [[5.6, 5.0, 4.0], [5.8, 5.2, 4.2], [5.5, 5.0, 4.0], [5.0, 4.5, 3.6]],
    palm: [[8.6, 7.3, 6.2], [9.0, 7.6, 6.4], [8.6, 7.3, 6.2], [7.6, 6.6, 5.6]],
    mc: [66, 63, 57.5, 52.5],
    spread: [29.5, 9.5, -10.5, -29],   // along the knuckle line, + toward the thumb
    prox: [1.5, 0, 4.5, 11],           // MCP heads step back toward the little finger
    arch: [-2, 0, -2.5, -6.5],         // the transverse arch
    knuckle: [9.2, 9.6, 8.7, 7.6],
    fan: [5, 1.5, -2.5, -6.5],         // metacarpals converge toward the wrist (deg)
    thumb: { len: [44, 29.5, 26.5], halfW: [12.5, 11.0, 10.8], dors: [7.5, 6.6, 5.6], palm: [12, 9.4, 8.6] },
    wrist: [29, 19.5], foreLen: 262, upperLen: 300, tendon: 1.35, nailFree: 1.4,
    forearm: [[28.5, 19.5], [32, 22.5], [37, 28], [41.5, 32.5], [43, 36]],
  };
  if (pres === 'm') return m;
  // adult female: ~0.92 the length, ~0.86 the breadth, slimmer fingers, longer nails
  const L = 0.92, W = 0.86, D = 0.88;
  return {
    len: m.len.map((a) => a.map((x) => x * L)), halfW: m.halfW.map((a) => a.map((x) => x * W * 0.98)),
    dors: m.dors.map((a) => a.map((x) => x * D)), palm: m.palm.map((a) => a.map((x) => x * D)),
    mc: m.mc.map((x) => x * L), spread: m.spread.map((x) => x * W), prox: m.prox.map((x) => x * L), arch: m.arch.map((x) => x * W),
    knuckle: m.knuckle.map((x) => x * W * 0.95), fan: m.fan,
    thumb: { len: m.thumb.len.map((x) => x * L), halfW: m.thumb.halfW.map((x) => x * W), dors: m.thumb.dors.map((x) => x * D), palm: m.thumb.palm.map((x) => x * D) },
    wrist: [m.wrist[0] * W, m.wrist[1] * D], foreLen: m.foreLen * L, upperLen: m.upperLen * L, tendon: 1.0, nailFree: 5.2,
    forearm: m.forearm.map(([a, b]) => [a * W * 0.97, b * D * 0.95] as [number, number]),
  };
}

// the pose: the palm lies over the rim's front face with the back of the hand toward the driver; the knuckles sit
// at the rim's outer front edge and the fingers wrap round behind it; the thumb lies along the inner face
const POSE = {
  alpha: 60 * DEG,       // the back of the hand's normal, from straight out (away from the hub) toward the driver
  palmT: 15,             // the metacarpals' axis above the palm's skin where the palm meets the rim (mm)
  mcpDist: 21,           // from that contact to the middle knuckle, toward the fingers (mm)
  ulnar: 14 * DEG,       // the wrist sits toward three o'clock: the rim crosses the palm on a slant
  roll: 6 * DEG,         // the palm rolls about its own axis (index side up)
  squeeze: 1.4,          // how hard the fingers close (mm into the pads)
  thumb: { phi: [108, 124, 146], from: 6 },   // the thumb's pad round the rim's section (deg) at MCP, IP, tip
};

// a point on the rim's section in the plane gx, at angle phi from straight out toward the driver, lifted off its
// surface along the surface normal by lift
export function rimPoint(gx: number, phi: number, lift: number): { p: V3; n: V3 } {
  const k = Math.asin(Math.max(-1, Math.min(1, gx / RMM))), a = GRIP_A + k;
  const A = rimA(a) * 1000, B = rimB(a) * 1000;
  // the section's centre on the rim at this offset, and its radial direction (the rim curves away from the grip)
  const ux = Math.sin(k), uy = Math.cos(k), cy = RMM * Math.cos(k) - RMM;
  const er = A * Math.cos(phi), ez = B * Math.sin(phi);
  const nr = Math.cos(phi) / A, nz = Math.sin(phi) / B, nl = Math.hypot(nr, nz);
  const n: V3 = [(ux * nr) / nl, (uy * nr) / nl, nz / nl];
  return { p: madd([gx + ux * er, cy + uy * er, ez], n, lift), n };
}

// a joint flexes until its bone's palmar pad meets the rim (or the joint's limit)
function close(J: V3, d: V3, axis: V3, L: number, D: number, lo: number, hi: number, s0 = 0.2, s1 = 1) {
  for (let a = lo; a <= hi + 1e-9; a += 0.5 * DEG) {
    const dd = rot(d, axis, a);
    let m = 1e9;
    for (let i = 0; i <= 10; i++) {
      const s = L * (s0 + ((s1 - s0) * i) / 10), p = madd(J, dd, s);
      m = Math.min(m, rimSdfG(p[0], p[1], p[2]));
    }
    if (m <= D) return a;
  }
  return hi;
}

// two-bone reach from the shoulder to the wrist, elbows down and out; the shoulder comes forward (protraction)
// when the wheel is out of reach, so the arms stay a little bent
export function reach(shoulder: V3, wrist: V3, L1: number, L2: number, pole: V3, bend = 0.94) {
  let S = shoulder;
  const dist = len(sub(wrist, S)), want = (L1 + L2) * bend;
  if (dist > want) S = madd(wrist, norm(sub(S, wrist)), want);
  const toW = sub(wrist, S), d = Math.min(len(toW), L1 + L2 - 1e-3), dir = norm(toW);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const p = perp(pole, dir);
  return { shoulder: S, elbow: madd(madd(S, dir, a), p, hh) };
}

export function buildAnatomy(pres: Pres): Anatomy {
  const d = dims(pres), f = new Field();
  const female = pres === 'f';

  // ---- the palm's frame: where the palm meets the rim's front face, its normal at alpha
  const tMid = d.spread[1];
  const aMid = GRIP_A + Math.asin(tMid / RMM);
  const A = rimA(aMid) * 1000, B = rimB(aMid) * 1000;
  // the point on the rim's section whose normal is at alpha
  const tt = Math.atan((B / A) * Math.tan(POSE.alpha));
  const contact = rimPoint(tMid, tt, 0);
  let N: V3 = contact.n;
  let P: V3 = norm(cross([1, 0, 0], N));            // proximal: round the section toward the driver, then inward
  if (P[2] < 0) P = mul(P, -1);
  // slant the palm on the rim: the wrist toward three o'clock
  P = rot(P, N, POSE.ulnar);
  if (P[0] > 0) P = rot(P, N, -2 * POSE.ulnar);
  let R = perp([1, 0, 0], P);
  N = norm(cross(P, R));
  if (dot(N, contact.n) < 0) N = mul(N, -1);
  R = rot(R, P, POSE.roll); N = rot(N, P, POSE.roll);
  const O = madd(madd(contact.p, N, POSE.palmT), P, -POSE.mcpDist);

  // ---- metacarpals and fingers
  const names = ['index', 'middle', 'ring', 'little'];
  const digits: Digit[] = [];
  const mcp: V3[] = [], base: V3[] = [];
  for (let i = 0; i < 4; i++) {
    const M = madd(madd(madd(O, R, d.spread[i] - tMid), P, d.prox[i]), N, d.arch[i]);
    const m = rot(P, N, -d.fan[i] * DEG);
    mcp.push(M); base.push(madd(M, m, d.mc[i]));
    const conv = [10, 3, -3, -7][i] * DEG;
    const d0 = rot(mul(m, -1), N, conv), axis = norm(cross(d0, mul(N, -1)));
    const joints: V3[] = [M], dirs: V3[] = [], dorsal: V3[] = [], flex: number[] = [];
    let J = M, dir = d0, n = N;
    const lim = [[0, 95], [0, 105], [0, 70]];
    for (let k = 0; k < 3; k++) {
      const L = d.len[i][k], D = d.palm[i][k] - POSE.squeeze;
      // the tip is rounded: its pad is short of the bone's end by about its radius
      let a = close(J, dir, axis, L, D, lim[k][0] * DEG, lim[k][1] * DEG, 0.25, k === 2 ? 0.7 : 1);
      // fingers relax a touch from index to little the other way: the little finger grips hardest
      if (k === 2) a = Math.min(a, (flex[1] ?? 60) * DEG * 0.85 + 8 * DEG);
      dir = rot(dir, axis, a); n = rot(n, axis, a);
      J = madd(J, dir, L);
      joints.push(J); dirs.push(dir); dorsal.push(n); flex.push(a / DEG);
    }
    const nl = [12.2, 13, 12.4, 10.4][i] * (female ? 0.94 : 1), nw = [11.0, 11.6, 11.0, 9.2][i] * (female ? 0.86 : 1);
    digits.push({ name: names[i], joints, dirs, dorsal, flexAxis: axis, halfW: d.halfW[i], dors: d.dors[i], palm: d.palm[i], flex, nail: { len: nl, width: nw, free: d.nailFree } });
  }

  // ---- the thumb: from its base at the heel of the hand, across the front of the rim, along its inner face,
  // pointing toward twelve o'clock with its pad pressed on the rim and its nail toward the driver
  const cmc = madd(madd(madd(base[0], R, 10), N, -16), P, -4);
  const tl = d.thumb.len, tpal = d.thumb.palm.map((x) => x - POSE.squeeze * 0.7);
  const phi = POSE.thumb.phi.map((x) => x * DEG);
  // slide the thumb's MCP along the rim until its metacarpal has the right length, then lay the two phalanges on
  const onRim = (gx: number, k: number) => rimPoint(gx, phi[k], tpal[Math.min(2, k + 1)]);
  let gxm = cmc[0];
  for (let it = 0; it < 60; it++) { const q = onRim(gxm, 0).p; const e = len(sub(q, cmc)) - tl[0]; if (Math.abs(e) < 0.05) break; gxm -= e * 0.7; }
  const tMcp = onRim(gxm, 0);
  const along = (from: V3, gx0: number, L: number, k: number) => {
    let gx = gx0 + L * 0.9;
    for (let it = 0; it < 60; it++) { const q = onRim(gx, k).p; const e = len(sub(q, from)) - L; if (Math.abs(e) < 0.05) break; gx -= e * 0.8; }
    return { gx, ...onRim(gx, k) };
  };
  const tIp = along(tMcp.p, gxm, tl[1], 1);
  const tTip = along(tIp.p, tIp.gx, tl[2], 2);
  const tj: V3[] = [cmc, tMcp.p, tIp.p, tTip.p];
  const td: V3[] = [norm(sub(tMcp.p, cmc)), norm(sub(tIp.p, tMcp.p)), norm(sub(tTip.p, tIp.p))];
  const tdn: V3[] = [perp(tMcp.n, td[0]), perp(lerp3(tMcp.n, tIp.n, 0.5), td[1]), perp(lerp3(tIp.n, tTip.n, 0.6), td[2])];
  const tflex = [0, Math.acos(Math.min(1, dot(td[0], td[1]))) / DEG, Math.acos(Math.min(1, dot(td[1], td[2]))) / DEG];
  const t0 = td[0];
  const tAxis = norm(cross(td[1], mul(tdn[1], -1)));
  digits.push({ name: 'thumb', joints: tj, dirs: td, dorsal: tdn, flexAxis: tAxis, halfW: d.thumb.halfW, dors: d.thumb.dors, palm: d.thumb.palm, flex: tflex, nail: { len: female ? 14 : 14.5, width: female ? 12.2 : 14, free: d.nailFree } });
  const tn = tdn[0];

  // ---- the wrist and the arm
  const baseMid = lerp3(base[1], base[2], 0.5);
  const wrist = madd(madd(baseMid, P, 17), N, -7.5);
  // the forearm leaves the wrist in line with the hand, bent back a little (the wrist extends in a grip) and
  // toward the elbow; the elbow comes from a two-bone reach to the shoulder
  const sh = GRIP.right.shoulder;
  const shG = wToG(carToW([sh.x, sh.y, sh.z]));
  const poleG = dirWToG(carDirToW([0.45, -1, -0.15]));
  const ik = reach(shG, wrist, d.upperLen, d.foreLen, poleG);
  const fd = norm(sub(ik.elbow, wrist));
  const fu = perp(N, fd), fl = perp(R, fd);      // the back of the forearm, and its thumb side

  // ---- palm and arm group
  const kp = 10;
  for (let i = 0; i < 4; i++) {
    // metacarpal with the palm's soft tissue under it (the bone lies near the back of the hand)
    const up = N, sh2 = 6.2 * (female ? 0.88 : 1);
    const a = madd(base[i], up, -sh2 * 0.9), b = madd(mcp[i], up, -sh2);
    f.cone(a, b, 11.6 * (female ? 0.86 : 1), 12.2 * (female ? 0.86 : 1), up, 1, i === 0 || i === 3 ? 0.86 : 0.9, G_PALM, kp, 10 + i);
    // the knuckle: the metacarpal's head, proud of the back of the hand in a fist
    f.ell(madd(madd(mcp[i], N, 2.2), digits[i].dirs[0], 1.5), digits[i].dirs[0], N, d.knuckle[i] * 0.95, d.knuckle[i] * 1.0, d.knuckle[i] * 0.92, G_PALM, 3.5, 20 + i);
  }
  const fem = female ? 0.88 : 1;
  // the palm's core, the pads under the knuckles, the heel of the hand
  f.ell(madd(lerp3(O, baseMid, 0.45), N, -9 * fem), P, N, 34 * fem, 10 * fem, 33 * fem, G_PALM, 12, 30);
  f.ell(madd(madd(O, P, 9), N, -12 * fem), R, N, 37 * fem, 7 * fem, 8.5 * fem, G_PALM, 8, 31);
  f.ell(madd(madd(baseMid, P, 6), N, -8 * fem), R, N, 25 * fem, 14 * fem, 17 * fem, G_PALM, 12, 32);
  // the back of the hand: broad and nearly flat over the metacarpals
  f.ell(madd(lerp3(O, baseMid, 0.5), N, -3.5 * fem), P, N, 36 * fem, 8.5 * fem, 37 * fem, G_PALM, 10, 36);
  // hypothenar: the fleshy edge under the little finger
  const hyC = madd(madd(lerp3(base[3], mcp[3], 0.45), N, -9 * fem), R, -6 * fem);
  f.ell(hyC, sub(mcp[3], base[3]), N, 30 * fem, 11 * fem, 10.5 * fem, G_PALM, 9, 33);
  // thenar: the ball of the thumb
  const thC = madd(madd(lerp3(cmc, tj[1], 0.45), R, -5 * fem), tn, -6 * fem);
  f.ell(thC, t0, tn, 25 * fem, 13 * fem, 15 * fem, G_PALM, 10, 34);
  // first dorsal interosseous: the muscle between thumb and index on the back of the hand
  const fdiA = lerp3(base[0], mcp[0], 0.5), fdiC = madd(lerp3(fdiA, tj[1], 0.45), N, -1);
  f.ell(fdiC, sub(tj[1], fdiA), N, len(sub(tj[1], fdiA)) * 0.55, 10 * fem, 11 * fem, G_PALM, 10, 35);
  // the web of the thumb, and the adductor under it
  f.ell(madd(lerp3(lerp3(mcp[0], base[0], 0.3), lerp3(tj[1], tj[2], 0.2), 0.5), N, -8 * fem), sub(tj[1], mcp[0]), N, len(sub(tj[1], mcp[0])) * 0.5, 7 * fem, 9 * fem, G_PALM, 9, 37);
  // the wrist and the forearm, a flattened section that rounds out toward the elbow, with its muscle bellies
  const segs = d.forearm, Lf = d.foreLen;
  for (let s = 0; s < 4; s++) {
    const a = madd(wrist, fd, (Lf * s) / 4 - (s === 0 ? 6 : 0)), b = madd(wrist, fd, (Lf * (s + 1)) / 4);
    const [w0, h0] = segs[s], [w1, h1] = segs[s + 1];
    f.cone(a, b, h0, h1, fu, 1, (w0 / h0 + w1 / h1) / 2, G_PALM, 14, 40 + s);
  }
  f.ell(madd(wrist, fd, Lf + 4), fd, fu, 30 * fem, 34 * fem, 40 * fem, G_PALM, 14, 44);
  f.cone(madd(wrist, fd, Lf), madd(wrist, fd, Lf + 70), 36 * fem, 40 * fem, fu, 1, 1.15, G_PALM, 12, 45);
  // brachioradialis (the thumb side, toward the elbow) and the flexor mass (inner forearm)
  f.ell(madd(madd(madd(wrist, fd, Lf * 0.7), fl, 16 * fem), fu, 4 * fem), fd, fu, 80 * fem, 20 * fem, 19 * fem, G_PALM, 22, 46);
  f.ell(madd(madd(madd(wrist, fd, Lf * 0.64), fu, -12 * fem), fl, -6 * fem), fd, fu, 75 * fem, 17 * fem, 23 * fem, G_PALM, 22, 47);
  // the carpus bridging hand and wrist, and the ulna's head on the little-finger side
  f.cone(madd(baseMid, N, -6 * fem), madd(wrist, fd, 8), 16 * fem, d.wrist[1], N, 1, 1.45, G_PALM, 12, 48);
  f.ell(madd(madd(madd(wrist, fd, 14), fl, -d.wrist[0] * 0.78), fu, d.wrist[1] * 0.55), fd, fu, 7.5 * fem, 6.5 * fem, 6.5 * fem, G_PALM, 7, 49);
  // extensor tendons fanning from the wrist to each knuckle
  const tw = madd(madd(wrist, fd, 18), fu, d.wrist[1] - 1.2);
  for (let i = 0; i < 4; i++) {
    const mid = madd(lerp3(base[i], mcp[i], 0.55), N, 5.2 * fem - 2.2);
    const top = madd(mcp[i], N, d.knuckle[i] * 0.45);
    f.cone(madd(madd(tw, fl, (1.5 - i) * 5 * fem), fu, -1.2), mid, d.tendon, d.tendon * 0.95, N, 1, 1.25, G_PALM, 5, 50 + i);
    f.cone(mid, top, d.tendon * 0.95, d.tendon * 0.9, N, 1, 1.3, G_PALM, 5, 54 + i);
  }

  // ---- fingers
  for (let i = 0; i < 4; i++) {
    const g = digits[i], gr = G_FINGER + i;
    addDigit(f, g, gr, 2.6, i === 3 ? 0.97 : 1);
  }
  addDigit(f, digits[4], G_THUMB, 3.2, 1);
  // the thumb's metacarpal, padded
  f.cone(madd(cmc, tn, -3), madd(tj[1], tn, -1.5), 12.5 * fem, 11 * fem, tn, 1, 1.12, G_THUMB, 6, 60);

  const capP = madd(ik.elbow, fd, 40);
  f.cap = [capP[0], capP[1], capP[2], fd[0], fd[1], fd[2]];
  f.finalize();

  // ---- veins on the back of the hand (the dorsal venous network), and up the forearm
  const veins: number[] = [];
  const onBack = (p: V3) => madd(p, N, 6.2 * fem);
  const vseg = (a: V3, b: V3, r: number) => veins.push(a[0], a[1], a[2], b[0], b[1], b[2], r);
  const arch = [0, 1, 2, 3].map((i) => onBack(lerp3(mcp[i], base[i], 0.38 + i * 0.03)));
  const between = [0, 1, 2].map((i) => onBack(lerp3(lerp3(mcp[i], mcp[i + 1], 0.5), lerp3(base[i], base[i + 1], 0.5), 0.15)));
  between.forEach((p, i) => vseg(p, lerp3(arch[i], arch[i + 1], 0.5), 1.2));
  vseg(arch[0], arch[1], 1.3); vseg(arch[1], arch[2], 1.3); vseg(arch[2], arch[3], 1.2);
  const wr = madd(madd(wrist, fd, 30), fu, d.wrist[1] - 0.5);
  vseg(arch[0], madd(madd(wr, fl, 14 * fem), fd, -6), 1.5);             // toward the cephalic vein (thumb side)
  vseg(arch[3], madd(madd(wr, fl, -16 * fem), fd, 4), 1.4);              // toward the basilic vein (little-finger side)
  vseg(madd(madd(wr, fl, 14 * fem), fd, -6), madd(madd(madd(wrist, fd, 120), fl, 24 * fem), fu, 22 * fem), 1.6);
  vseg(madd(madd(wr, fl, -16 * fem), fd, 4), madd(madd(madd(wrist, fd, 140), fl, -14 * fem), fu, 24 * fem), 1.4);

  // ---- glove openings: round holes over the knuckles and an open back
  const holes: number[] = [];
  for (let i = 0; i < 4; i++) { const c = madd(mcp[i], N, d.knuckle[i] + 0.5); holes.push(c[0], c[1], c[2], 6.2 * (female ? 0.88 : 1)); }
  const back = madd(madd(lerp3(baseMid, O, 0.18), N, 9 * fem), R, -3);
  holes.push(back[0], back[1], back[2], 15 * fem);

  return {
    pres, field: f, digits, palm: { O, P, R, N }, mcp, wrist, wristDorsal: fu, elbow: ik.elbow, shoulder: ik.shoulder,
    foreDir: fd, foreUp: fu, wristHalf: d.wrist, upper: d.upperLen, fore: Lf, veins, holes, scale: female ? 0.92 : 1,
  };
}

function carDirToW(c: V3): V3 { return [c[0], c[1] * CT + c[2] * ST, -c[1] * ST + c[2] * CT]; }

// one finger (or the thumb): its bones as round cones with the pads on the palm side, the joints' condyles,
// the fingertip's pulp, and a flatter back where the nail sits
function addDigit(f: Field, g: Digit, group: number, k: number, slim: number) {
  const J = g.joints;
  for (let b = 0; b < 3; b++) {
    if (g.name === 'thumb' && b === 0) continue;
    const a = J[b], e = J[b + 1], dir = g.dirs[b], up = g.dorsal[b];
    const hw = g.halfW[b] * slim, dor = g.dors[b], pal = g.palm[b];
    const r = (dor + pal) / 2, shift = (pal - dor) / 2;
    const nb = b + 1 < 3 ? b + 1 : b;
    const r2 = (g.dors[nb] + g.palm[nb]) / 2 * (b === 2 ? 0.86 : 1), shift2 = (g.palm[nb] - g.dors[nb]) / 2;
    const tipBack = b === 2 ? r2 : 0;
    const a2 = madd(a, up, -shift), e2 = madd(madd(e, up, -shift2), dir, -tipBack);
    f.cone(a2, e2, r, r2, up, 1, hw / r, group, k, 100 + b);
    // the pulp of each bone (fullest on the fingertip)
    const pc = madd(lerp3(a, e, b === 2 ? 0.62 : 0.5), up, -(pal * (b === 2 ? 0.42 : 0.35)));
    f.ell(pc, dir, up, (len(sub(e, a)) * (b === 2 ? 0.36 : 0.42)), pal * 0.62, hw * 0.9, group, k * 1.2, 110 + b);
    // the joint at the bone's base: condyles a little wider than the shaft
    if (b > 0 || g.name !== 'thumb') {
      const jr = b === 0 ? 0 : 1;
      if (jr) f.ell(madd(a, up, 0.4 - shift * 0.6), lerp3(g.dirs[b - 1], dir, 0.5), up, 5.6, r * (g.name === 'thumb' ? 0.97 : 1.0), hw * (g.name === 'thumb' ? 1.0 : 1.04), group, k * 1.4, 120 + b);
    }
  }
}
