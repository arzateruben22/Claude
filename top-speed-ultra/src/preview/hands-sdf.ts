// The driver's hand as a signed distance field: anatomically proportioned bones and soft tissue (metacarpals, three
// phalanges per finger, two for the thumb, knuckle heads, thenar and hypothenar pads, the extensor tendons, the wrist
// and the forearm to the elbow) joined with smooth-min, closed round the steering wheel's rim the way a real grip
// closes: each joint flexes until its bone's pad meets the rim, and the pads flatten where they press on it.
//
// Units here are MILLIMETRES. The hand is built as the RIGHT hand in the grip frame G:
//   origin on the rim's centreline at GRIP.right.deg, x along the rim toward twelve o'clock, y out from the hub,
//   z toward the driver (the wheel's own z). The left hand is its mirror image (x -> -x in the wheel's plane).
// Helpers convert G to the wheel's plane W (mm, spec.ts rimAt() frame) and to the car's frame (metres).
import { RIM_R, rimA, rimB, GRIP, WHEEL_AT, WHEEL_TILT, EYE } from './spec';

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
const S = 21;
export const G_PALM = 0, G_THUMB = 1, G_FINGER = 2;
export class Field {
  n = 0;
  type: number[] = []; group: number[] = []; k: number[] = []; tag: number[] = [];
  F: number[] = [];
  kThumb = 3; kWeb = 4.5; kFF = 1.6;
  clear = -0.3;           // how far the skin stays off the rim (mm): a hair into the leather, so no slit of light shows between them (the mesh wanders ~0.5 mm)
  contactK = 2.2;         // how round the edge of the skin pressed on the rim is (mm)
  bulge = 0.7;            // flesh displaced where it presses on the rim (mm)
  rim = true;
  private Fa: Float64Array = new Float64Array(0);
  private T: Uint8Array = new Uint8Array(0); private Gp: Uint8Array = new Uint8Array(0); private K: Float64Array = new Float64Array(0);

  // a round cone from a (radius r1) to b (radius r2); its section is scaled by su along `up` and sl across
  // (sl2: the lateral scale at b, if it changes along the cone)
  cone(a: V3, b: V3, r1: number, r2: number, up: V3, su: number, sl: number, group: number, k: number, tag = 0, sl2 = sl) {
    const ax = norm(sub(b, a)), L = len(sub(b, a));
    const u = perp(up, ax), l = cross(ax, u);
    const bb = Math.max(-0.95, Math.min(0.95, (r1 - r2) / Math.max(L, 1e-6))), aa = Math.sqrt(1 - bb * bb);
    this.F.push(a[0], a[1], a[2], ax[0], ax[1], ax[2], u[0], u[1], u[2], l[0], l[1], l[2], L, r1, r2, su, sl, Math.min(1, su, sl, sl2), bb, aa, sl2);
    this.type.push(0); this.group.push(group); this.k.push(k); this.tag.push(tag); this.n++;
    return this.n - 1;
  }
  // an ellipsoid at c with semi-axes rx along ax, ry along up (made perpendicular), rz across
  ell(c: V3, ax: V3, up: V3, rx: number, ry: number, rz: number, group: number, k: number, tag = 0) {
    const x = norm(ax), u = perp(up, x), l = cross(x, u);
    this.F.push(c[0], c[1], c[2], x[0], x[1], x[2], u[0], u[1], u[2], l[0], l[1], l[2], rx, ry, rz, 0, 0, 0, 0, 0, 0);
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
      const L = F[b + 12], r1 = F[b + 13], r2 = F[b + 14], tl = lx <= 0 ? 0 : lx >= L ? 1 : lx / L;
      const su = ly / F[b + 15], sl = lz / (F[b + 16] + (F[b + 20] - F[b + 16]) * tl), qx = Math.sqrt(su * su + sl * sl), qy = lx;
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
    // the four fingers among themselves: a small smooth-min, so where they press together the crease is rounded
    // (a hard min left a sharp groove the mesher cut into steps); then the whole set webbed onto the palm. (smin is
    // monotonic, so smin(palm, smin(fingers)) is the per-finger web of before, plus the rounded finger creases.)
    let fs = 1e9;
    for (let f = 2; f < 6; f++) {
      const d = acc[f]; if (d > 1e8) continue;
      const k = this.kFF, h = Math.max(k - Math.abs(fs - d), 0) / k;
      fs = Math.min(fs, d) - h * h * k * 0.25;
    }
    if (fs > 1e8) return pt;
    const k = this.kWeb, h = Math.max(k - Math.abs(pt - fs), 0) / k;
    return Math.min(pt, fs) - h * h * k * 0.25;
  }
  // one group on its own (a finger, for measuring)
  groupDist(g: number, x: number, y: number, z: number) {
    let a = 1e9;
    for (let i = 0; i < this.n; i++) {
      if (this.Gp[i] !== g) continue;
      const d = this.prim(i, x, y, z), k = this.K[i], h = Math.max(k - Math.abs(a - d), 0) / k;
      a = Math.min(a, d) - h * h * k * 0.25;
    }
    return a;
  }
  // the arm ends in a flat cap past the elbow, inside the sleeve
  cap: number[] | null = null;
  bounds(): { c: V3; r: number }[] {
    const out: { c: V3; r: number }[] = [];
    for (let i = 0; i < this.n; i++) {
      const b = i * S, F = this.F, c: V3 = [F[b], F[b + 1], F[b + 2]];
      if (this.type[i] === 0) {
        const L = F[b + 12], s = Math.max(F[b + 15], F[b + 16], F[b + 20], 1), r = Math.max(F[b + 13], F[b + 14]) * s;
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
    // a smooth max: where the skin turns to lie on the leather the edge is rounded, like flesh pressed on a rim,
    // not a crease that the mesh would cut into steps
    const a = s - this.bulge * t * t, b = -dr, k = this.contactK, h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.max(a, b) + h * h * k * 0.25;
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
  veins: number[];                    // segments for the shader, G mm: x0 y0 z0 x1 y1 z1 r upx upy upz ...
  holes: number[];                    // glove: knuckle holes x y z r, and the open back x y z r
  scale: number;
}

interface Dims {
  len: number[][]; halfW: number[][]; dors: number[][]; palm: number[][];
  mc: number[]; spread: number[]; prox: number[]; arch: number[]; knuckle: number[]; fan: number[];
  thumb: { len: number[]; halfW: number[]; dors: number[]; palm: number[] };
  wrist: [number, number]; carpus: number; foreLen: number; upperLen: number; tendon: number;
  nail: number[]; nailFree: number;  // nail plate length as a share of the last segment (index..little, thumb); free edge (mm)
  forearm: [number, number][];       // half width, half depth at 0, 25, 50, 75, 100% from wrist to elbow
}

// Proportions (male; the female hand is scaled from it):
//  - hand length, wrist crease to the middle fingertip, 185 mm: carpus + third metacarpal 63 + middle finger 97
//    (the palm, to the finger's base crease ~18 mm past the knuckle, is ~56%; the finger from that crease ~44%)
//  - phalanges joint to joint, proximal : middle : distal bone about 1 : 0.62 : 0.45; the distal entry runs on to
//    the fingertip (~3 mm of pulp past the bone), so it measures ~0.49
//  - widths at the finger's base 2.1 / 2.15 / 1.9 / 1.6 cm, about 20% narrower at the nail; nails ~1/3 of the last
//    segment (the plate; the female look's painted nails are longer, with a free edge)
//  - the thumb's two phalanges about 2/3 of the middle finger
function dims(pres: Pres): Dims {
  const m: Dims = {
    len: [[41, 25.4, 20.1], [46, 28.5, 22.5], [43, 26.7, 21.1], [34, 21.1, 16.7]],
    halfW: [[10.3, 9.2, 8.3], [10.5, 9.4, 8.5], [9.6, 8.6, 7.8], [8.2, 7.3, 6.6]],
    dors: [[6.4, 5.4, 4.3], [6.6, 5.6, 4.5], [6.3, 5.3, 4.3], [5.6, 4.8, 3.9]],
    palm: [[10.0, 8.2, 7.0], [10.4, 8.5, 7.2], [9.9, 8.1, 6.9], [8.8, 7.2, 6.1]],
    mc: [66, 63, 57.5, 52.5],
    spread: [30, 9.8, -10, -25],        // along the knuckle line, + toward the thumb
    prox: [1.5, 0, 4, 10],              // MCP heads step back toward the little finger
    arch: [-3.5, 0, -3.5, -9.5],        // the transverse arch (deeper in a grip)
    knuckle: [7.5, 9.0, 8.4, 7.2],
    fan: [5, 1.5, -2.5, -6.5],          // metacarpals converge toward the wrist (deg)
    thumb: { len: [44, 34, 29], halfW: [12.0, 9.8, 9.4], dors: [7.2, 6.3, 5.2], palm: [11.0, 9.2, 8.0] },
    wrist: [29, 19.5], carpus: 17, foreLen: 262, upperLen: 300, tendon: 2.2,
    nail: [0.37, 0.37, 0.37, 0.37, 0.45], nailFree: 0.2,
    forearm: [[28.5, 19.5], [32, 22.5], [37, 28], [41.5, 32.5], [43, 36]],
  };
  if (pres === 'm') return m;
  // adult female: 0.92 the length (170 mm), ~0.86 the breadth, slimmer fingers, longer (painted) nails
  const L = 0.92, W = 0.86, D = 0.88;
  return {
    len: m.len.map((a) => a.map((x) => x * L)), halfW: m.halfW.map((a) => a.map((x) => x * W * 0.98)),
    dors: m.dors.map((a) => a.map((x) => x * D)), palm: m.palm.map((a) => a.map((x) => x * D)),
    mc: m.mc.map((x) => x * L), spread: m.spread.map((x) => x * W), prox: m.prox.map((x) => x * L), arch: m.arch.map((x) => x * W),
    knuckle: m.knuckle.map((x) => x * W * 0.95), fan: m.fan,
    thumb: { len: m.thumb.len.map((x) => x * L), halfW: m.thumb.halfW.map((x) => x * W), dors: m.thumb.dors.map((x) => x * D), palm: m.thumb.palm.map((x) => x * D) },
    wrist: [m.wrist[0] * W, m.wrist[1] * D], carpus: m.carpus * L, foreLen: m.foreLen * L, upperLen: m.upperLen * L, tendon: 1.6,
    nail: m.nail.map((x) => x * 1.12), nailFree: 2.5,
    forearm: m.forearm.map(([a, b]) => [a * W * 0.97, b * D * 0.95] as [number, number]),
  };
}

// The grip, as a real hand holds a rim at ten and two: the palm wraps the OUTSIDE of the rim (its distal part on the
// rim's outer front, the back of the hand toward the driver and out), the knuckles stand on the rim's outer face, the
// four fingers wrap round the far side (toward the dash) and come back round the inner edge, and the thumb lies
// along the rim's front face pointing up toward twelve (the pad on the leather, the nail to the driver), the first
// web space open between it and the index knuckle.
export const POSE = {
  alpha: 28 * DEG,         // where the palm meets the rim: the section's normal there, from straight out toward the driver
  palmT: 13,             // the metacarpal heads' axis above the palm's skin there (mm)
  mcpDist: 22,           // from that contact on round to the middle knuckle (mm)
  ulnar: 50 * DEG,       // the rim crosses the palm on a slant (the heel of the hand toward three o'clock), so the
                         // wrist and forearm stay outside the rim and clear of the fingertips as the driver sees them
  pitch: 0,              // the palm's pitch about the knuckle line (deg; + brings the heel of the hand down onto the rim)
  roll: -10 * DEG,        // the palm rolls about its own axis (index side up)
  cup: [8, 4, 10, 18],     // each knuckle turned on round the rim (deg): the hand cups as it closes (4th/5th CMC flex)
  squeeze: 7,            // how far the finger pads press into the padded leather (mm); the skin flattens on it
  squeezeK: [1.3, 1.1, 0.75], // ... per phalanx (the fingertips press less, so they stand proud round the inner edge)
  // the thumb: its base in the heel of the hand [along R, N, P from the index metacarpal's base (mm)]; where its tip
  // rests (section angle range, deg: 90 is the crest of the front face; mm along the rim past the index knuckle);
  // how far the IP stands off the leather; MCP and IP flexion [min, max, preferred] and the IP preference's weight;
  // how much the two joints' hinges may disagree (deg); the nail toward the driver (min cosine); how high the MCP
  // knuckle may stand (mm off the leather); how far (mm, as the eye sees it) it keeps off the middle, ring and little
  // fingertips; pad squeeze; weights [tip place, nail]; the open first web space: the MCP's least distance from the
  // index metacarpal (mm) and its weight; the coarse search's grid, and the pinned result per presentation (q: null
  // searches again, ~1-2 s; tools/preview-hands-thumb.mjs prints the q to pin)
  thumb: { cmc: [14, -14, 17], tipPhi: [95, 115], tipDx: 12, ipGap: 0, ipPhi: [85, 140], mcpFlex: [10, 55, 45], ipFlex: [5, 60, 15], ipW: 0.1,
    roll: 15, twistW: 1.0, twistMax: 45, across: 0.6, acrossW: 0, mxGap: -4, cmcW: 0.15, cmcBox: [[-12, 24], [-10, 12], [-16, 0], [0, 15]], nail: 0.35, mcpHigh: 16, sep: 12, squeeze: 3.5, w: [0.5, 8], web: 22, webW: 1.0,
    grid: { dx: [-6, 12, 6], pt: 5, psi: [40, 90, 10], incl: [0, 40, 8] },
    q: { m: [18.5, 100, 77, 11, 9, -10, -16, 12], f: [18.75, 96.5, 77.5, 11.5, 9, -2.5, -16, 15] } as Record<Pres, number[] | null> },
  conv: [2, 0, -3, -5],     // the fingers converge toward the thenar as they close (deg, about the back of the hand)
  twist: [0, 0, 0, 0],     // each finger's flexion axis turned about the finger (deg): the tips drift along the rim
  align: 1,                // how far each finger's flexion axis turns from square to its metacarpal to the rim's axis
  kline: 0.7,              // how far the knuckle line turns from square to the palm toward the rim's axis
  limits: [[0, 95], [0, 110], [22, 100]],  // flexion range per joint (deg); a gripping fingertip is never straight
  kFF: 0.8,               // the fingers' blend among themselves (mm): the rounded crease where they press together
  kWeb: 3.0,               // the fingers' blend onto the palm (mm): the webs and the knuckle valleys
  dipCap: 30,              // the DIP flexes at most this much more than the PIP (deg)
  fingerSearch: false,     // search the knuckle's flexion for the deepest wrap (else: each phalanx closes onto the rim)
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
// the rim's centreline point and tangent (toward twelve o'clock) at offset gx along it
function rimCentre(gx: number): { c: V3; t: V3 } {
  const k = Math.asin(Math.max(-1, Math.min(1, gx / RMM)));
  return { c: [RMM * Math.sin(k), RMM * Math.cos(k) - RMM, 0], t: [Math.cos(k), -Math.sin(k), 0] };
}
/** the section angle (deg) of a point in G, measured like rimPoint's phi (0 out, 90 toward the driver) */
export function sectionAngle(p: V3): number {
  const k = Math.atan2(p[0], p[1] + RMM), a = GRIP_A + k;
  const r = Math.hypot(p[0], p[1] + RMM) - RMM;
  return (Math.atan2(p[2] / (rimB(a) * 1000), r / (rimA(a) * 1000)) * 180) / Math.PI;
}

// A joint flexes until its bone's palmar pad meets the rim (or the joint's limit). The pad is full in the middle of
// the bone and thinner at the creases over the joints, and it gives (squeeze) under the grip.
function close(J: V3, d: V3, axis: V3, L: number, Dmid: number, Dend: number, lo: number, hi: number, s0 = 0.12, s1 = 1) {
  for (let a = lo; a <= hi + 1e-9; a += 0.5 * DEG) {
    const dd = rot(d, axis, a);
    for (let i = 0; i <= 12; i++) {
      const t = s0 + ((s1 - s0) * i) / 12, p = madd(J, dd, L * t);
      const D = Dend + (Dmid - Dend) * Math.sin(Math.PI * Math.min(1, t));
      if (rimSdfG(p[0], p[1], p[2]) <= D) return a;
    }
  }
  return hi;
}

// A finger closing round the rim. Flexing the knuckle as far as it goes first leaves the finger's next joints no
// room, so try the knuckle at a range of angles, let the two finger joints close on the rim after it, and keep the
// one that carries the fingertip farthest round the rim (a firm grip), with a small preference for natural ratios.
function closeFinger(M: V3, d0: V3, n0: V3, axis: V3, L: number[], pal: number[]) {
  const lim = POSE.limits;
  const D = (k: number) => { const sq = POSE.squeeze * POSE.squeezeK[k]; return [pal[k] - sq, pal[k] * 0.72 - sq * 0.5]; };
  const run = (aM: number) => {
    const joints: V3[] = [M], dirs: V3[] = [], dorsal: V3[] = [], flex: number[] = [];
    let J = M, dir = d0, n = n0;
    for (let k = 0; k < 3; k++) {
      let a: number;
      if (k === 0) a = aM;
      else {
        const [dm, de] = D(k);
        a = close(J, dir, axis, L[k], dm, de, lim[k][0] * DEG, lim[k][1] * DEG, 0.12, k === 2 ? 0.8 : 1);
        if (k === 2) a = Math.min(a, flex[1] * DEG + POSE.dipCap * DEG);
      }
      dir = rot(dir, axis, a); n = rot(n, axis, a);
      J = madd(J, dir, L[k]);
      joints.push(J); dirs.push(dir); dorsal.push(n); flex.push(a / DEG);
    }
    // how far round the rim the tip got (unwrapped section angle, going the way the fingers wrap)
    let w = 0;
    for (let k = 0; k < 3; k++) { const a = sectionAngle(joints[k]), b = sectionAngle(joints[k + 1]); w += ((a - b + 540) % 360) - 180; }
    return { joints, dirs, dorsal, flex, wrap: w };
  };
  const [dm0, de0] = D(0);
  const aMax = close(M, d0, axis, L[0], dm0, de0, lim[0][0] * DEG, lim[0][1] * DEG);
  let best = run(aMax), score = -1e9;
  if (POSE.fingerSearch) for (let a = Math.min(aMax, 30 * DEG); a <= aMax + 1e-9; a += 2 * DEG) {
    const r = run(a);
    const s = r.wrap - 0.15 * Math.max(0, r.flex[2] - r.flex[1]) - 0.1 * Math.max(0, r.flex[0] - r.flex[1] - 10);
    if (s > score) { score = s; best = r; }
  }
  return best;
}

// two-bone reach from the shoulder to the wrist, elbows down and out; the shoulder comes forward (protraction)
// when the wheel is out of reach, so the arms stay a little bent
// (scalar math, written into `out` when given: hands.ts runs this every frame for both arms)
export function reach(shoulder: V3, wrist: V3, L1: number, L2: number, pole: V3, bend = 0.94, out?: { shoulder: V3; elbow: V3 }) {
  const o = out ?? { shoulder: [0, 0, 0] as V3, elbow: [0, 0, 0] as V3 }, S = o.shoulder, E = o.elbow;
  S[0] = shoulder[0]; S[1] = shoulder[1]; S[2] = shoulder[2];
  let dx = wrist[0] - S[0], dy = wrist[1] - S[1], dz = wrist[2] - S[2];
  const dist = Math.hypot(dx, dy, dz), want = (L1 + L2) * bend;
  if (dist > want) {
    const k = want / dist;
    S[0] = wrist[0] - dx * k; S[1] = wrist[1] - dy * k; S[2] = wrist[2] - dz * k;
    dx = wrist[0] - S[0]; dy = wrist[1] - S[1]; dz = wrist[2] - S[2];
  }
  const l = Math.hypot(dx, dy, dz), d = Math.min(l, L1 + L2 - 1e-3), il = l || 1, ux = dx / il, uy = dy / il, uz = dz / il;
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  // the pole's part perpendicular to the shoulder-wrist line: the elbow goes that way
  const pd = pole[0] * ux + pole[1] * uy + pole[2] * uz;
  let px = pole[0] - ux * pd, py = pole[1] - uy * pd, pz = pole[2] - uz * pd;
  const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
  E[0] = S[0] + ux * a + px * hh; E[1] = S[1] + uy * a + py * hh; E[2] = S[2] + uz * a + pz * hh;
  return o;
}

/** how well the last thumb solve met its targets (0 = all of them), for the pose tools */
export let thumbScore = 0, thumbQ: number[] = [], thumbTerms: Record<string, number> = {};
export const thumbRej = { ip: 0, reach: 0, mx: 0, hM: 0, flex: 0 };
export function buildAnatomy(pres: Pres): Anatomy {
  const d = dims(pres), f = new Field();
  f.kFF = POSE.kFF; f.kWeb = POSE.kWeb;
  const female = pres === 'f';
  const fem = female ? 0.88 : 1;

  // ---- the palm's frame: where the palm meets the rim, its normal at alpha
  const tMid = d.spread[1];
  const aMid = GRIP_A + Math.asin(tMid / RMM);
  const A = rimA(aMid) * 1000, B = rimB(aMid) * 1000;
  const tt = Math.atan((B / A) * Math.tan(POSE.alpha));
  const contact = rimPoint(tMid, tt, 0);
  let N: V3 = contact.n;
  let P: V3 = norm(cross([1, 0, 0], N));            // proximal: round the section toward the driver
  if (P[2] < 0) P = mul(P, -1);
  // slant the palm on the rim: the wrist toward three o'clock
  P = rot(P, N, POSE.ulnar);
  if (P[0] > 0) P = rot(P, N, -2 * POSE.ulnar);
  let R = perp([1, 0, 0], P);
  N = norm(cross(P, R));
  if (dot(N, contact.n) < 0) N = mul(N, -1);
  R = rot(R, P, POSE.roll); N = rot(N, P, POSE.roll);
  const O = madd(madd(contact.p, N, POSE.palmT), P, -POSE.mcpDist);
  // the palm pitches about the knuckle line: the heel of the hand comes down onto the rim (a real grip presses the
  // rim diagonally across the palm, from the index knuckle to the heel, rather than holding it in the fingers alone)
  P = rot(P, R, POSE.pitch * DEG); N = rot(N, R, POSE.pitch * DEG);
  // the knuckle line runs nearly along the rim (the fingers deviate toward the little finger at the knuckles in a
  // power grip, so the palm can slant while the fingers wrap square round the rim)
  const Kx = perp([1, 0, 0], N);
  const K = norm(lerp3(R, dot(Kx, R) < 0 ? mul(Kx, -1) : Kx, POSE.kline));

  // ---- metacarpals and fingers
  const names = ['index', 'middle', 'ring', 'little'];
  const digits: Digit[] = [];
  const mcp: V3[] = [], base: V3[] = [], Nk: V3[] = [];
  for (let i = 0; i < 4; i++) {
    const M0 = madd(madd(madd(O, K, d.spread[i] - tMid), P, d.prox[i]), N, d.arch[i]);
    const B0 = madd(M0, rot(P, N, -d.fan[i] * DEG), d.mc[i]);
    // the hand cups as it closes: the knuckle turns on round the rim, about the rim's own axis there
    const rc = rimCentre(M0[0]), cu = -POSE.cup[i] * DEG;
    const M1 = add(rc.c, rot(sub(M0, rc.c), rc.t, cu));
    const M = madd(B0, norm(sub(M1, B0)), d.mc[i]);
    const Ni = perp(rot(N, rc.t, cu), norm(sub(B0, M)));
    mcp.push(M); base.push(B0); Nk.push(Ni);
    const m = norm(sub(B0, M));
    const conv = POSE.conv[i] * DEG;
    // each finger's flexion plane leans a little (the axis turns about the finger), so the fingers spiral round the
    // rim and their tips gather toward the thumb, as a gripping hand's do
    const dm = rot(mul(m, -1), Ni, conv), tw = POSE.twist[i] * DEG;
    // the fingers flex about the rim's own axis (they deviate at the knuckle so they wrap square round the rim, not
    // in a spiral along it, as the palm's slant would otherwise make them), with a little convergence left in
    let axis = rot(norm(cross(dm, mul(Ni, -1))), dm, tw);
    const tr = dot(axis, rc.t) < 0 ? mul(rc.t, -1) : rc.t;
    axis = norm(lerp3(axis, tr, POSE.align));
    const d0 = perp(dm, axis);
    let n0 = norm(cross(axis, d0));
    if (dot(n0, Ni) < 0) n0 = mul(n0, -1);
    const { joints, dirs, dorsal, flex } = closeFinger(M, d0, n0, axis, d.len[i], d.palm[i]);
    const nl = d.len[i][2] * d.nail[i], nw = [11.0, 11.6, 10.8, 9.2][i] * (female ? 0.86 : 1);
    digits.push({ name: names[i], joints, dirs, dorsal, flexAxis: axis, halfW: d.halfW[i], dors: d.dors[i], palm: d.palm[i], flex, nail: { len: nl, width: nw, free: d.nailFree } });
  }

  // ---- the thumb: short and bent. Its base (the CMC joint, in the heel of the hand on the thumb side) is where the
  // anatomy puts it; its last phalanx rests on the leather of the rim's inner front edge with the nail toward the
  // driver and the tip level with the index finger's first segment along the rim (not out toward twelve o'clock);
  // the MCP and IP joints bend between the two, the MCP knuckle standing up off the rim the way a gripping thumb's
  // does. Solved directly: for each tip place and heading, the IP sits a phalanx back from the tip, and the MCP lies on
  // the circle where the metacarpal's and the first phalanx's reaches meet; the point on that circle is chosen for
  // natural bends, hinge-like joints (no twist between them), nothing sinking into the rim or the index finger, the
  // nail facing the eye and the fingertips left in view.
  const tc = POSE.thumb.cmc, T = POSE.thumb, tl = d.thumb.len, tpal = d.thumb.palm, sq = T.squeeze;
  const cmc0 = madd(madd(madd(base[0], R, tc[0] * fem), N, tc[1] * fem), P, tc[2] * fem);   // where anatomy puts its base
  const eyeG = wToG(carToW([EYE.x, EYE.y, EYE.z]));
  const xi = mcp[0][0];
  const segDist = (p: V3, a: V3, b: V3) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, madd(a, ab, t))); };
  const segSeg = (a: V3, b: V3, c: V3, e: V3) => { let m = 1e9; for (let i = 0; i <= 6; i++) { const t = i / 6; m = Math.min(m, segDist(lerp3(a, b, t), c, e), segDist(lerp3(c, e, t), a, b)); } return m; };
  const projE = (p: V3, e: V3) => madd(p, e, -dot(p, e));
  const tips = digits.map((g) => g.joints[3]);
  const angD = (a: V3, b: V3) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / DEG;
  const rimN = (p: V3): V3 => { const e = 0.05, c = rimSdfG(p[0], p[1], p[2]); return norm([rimSdfG(p[0] + e, p[1], p[2]) - c, rimSdfG(p[0], p[1] + e, p[2]) - c, rimSdfG(p[0], p[1], p[2] + e) - c]); };
  const ix = digits[0];
  type Sol = { j: V3[]; d: V3[]; u: V3[]; k: V3; f: number[]; s: number; q: number[]; terms: Record<string, number> };
  let best: Sol | null = null;
  const L1 = tl[1], L2 = tl[2];
  const tryTip = (dx: number, pt: number, psi: number, incl: number, co: number[]) => {
    // the metacarpal's reach from the CMC (co[3]: how much shorter than the bone it lands, the base sitting deeper in
    // the heel of the hand)
    const L0 = tl[0] - (co[3] ?? 0) * fem;
    const xt = xi + dx * fem;
    const ti = rimPoint(xt, pt * DEG, tpal[2] - sq * 0.6), tip = ti.p;
    const sA = rimPoint(xt, (pt + 1) * DEG, 0).p, sB = rimPoint(xt, (pt - 1) * DEG, 0).p;
    const st = norm(sub(sA, sB)), xt0 = perp([1, 0, 0], ti.n);
    // the last phalanx's heading on the rim: psi 0 runs it across the section toward the inner edge, 90 along the rim
    const d2a = norm(add(mul(st, Math.cos(psi * DEG)), mul(xt0, Math.sin(psi * DEG))));
    // the IP a phalanx back from the tip: the last phalanx stands on its pad at incl to the leather, and is lifted
    // clear of it if the rim curves up under it
    let ip = madd(tip, norm(madd(mul(d2a, Math.cos(incl * DEG)), ti.n, -Math.sin(incl * DEG))), -L2);
    for (let it = 0; it < 6; it++) {
      const want = tpal[1] - sq * 0.3 + T.ipGap, c = rimSdfG(ip[0], ip[1], ip[2]);
      if (c >= want - 0.2) break;
      ip = madd(tip, norm(sub(madd(ip, rimN(ip), want - c), tip)), L2);
    }
    const ipPhi = sectionAngle(ip);
    if (ipPhi < T.ipPhi[0] || ipPhi > T.ipPhi[1] || ip[0] > tip[0] + 2) { thumbRej.ip++; return; }
    const d2 = norm(sub(tip, ip));
    const C = madd(madd(madd(cmc0, P, co[0]), R, co[1]), N, co[2]);
    const toIp = sub(ip, C), D = len(toIp);
    if (D > L0 + L1 - 1 || D < Math.abs(L0 - L1) + 1) { thumbRej.reach++; return; }
    const u = mul(toIp, 1 / D), a = (L0 * L0 - L1 * L1 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, L0 * L0 - a * a));
    const cen = madd(C, u, a), e1 = perp(norm(sub(eyeG, cen)), u), e2 = cross(u, e1);
    for (let th = 0; th < 360; th += 10) {
      const m = madd(madd(cen, e1, h * Math.cos(th * DEG)), e2, h * Math.sin(th * DEG));
      if (m[0] > ip[0] + T.mxGap) { thumbRej.mx++; continue; }
      const hM = rimSdfG(m[0], m[1], m[2]);
      if (hM > T.mcpHigh || hM < tpal[0] - sq) { thumbRej.hM++; continue; }
      const d0 = norm(sub(m, C)), d1 = norm(sub(ip, m));
      const fM = angD(d0, d1), fI = angD(d1, d2);
      if (fI < T.ipFlex[0] || fM > T.mcpFlex[1] + 10 || fI > T.ipFlex[1]) { thumbRej.flex++; continue; }
      // the nail faces away from the leather; the phalanges' backs follow it round the bends (the thumb's CMC and MCP
      // let it roll, so its bends need not share one hinge)
      const kI = norm(cross(d1, d2)), u2 = perp(ti.n, d2);
      const kM = fM > 4 ? norm(cross(d0, d1)) : kI;
      const twist = angD(kM, kI);
      if (twist > T.twistMax) { thumbRej.flex++; continue; }
      const u1 = perp(lerp3(u2, rimN(m), 0.3), d1), u0 = perp(lerp3(u1, N, 0.5), d0);
      if (dot(sub(d1, d2), u2) < -0.05) { thumbRej.flex++; continue; }   // the IP bends the pad toward the leather, never back
      let sc = T.cmcW * Math.hypot(co[0], co[1], co[2]) + T.cmcW * 0.6 * (co[3] ?? 0);
      sc += 0.05 * Math.abs(fM - T.mcpFlex[2]) + 0.4 * Math.max(0, fM - T.mcpFlex[1]) + 0.4 * Math.max(0, T.mcpFlex[0] - fM);
      sc += T.ipW * Math.abs(fI - T.ipFlex[2]);
      // the first phalanx crosses the front face (toward the hub), it does not run along the rim toward twelve
      sc += T.acrossW * Math.max(0, Math.abs(d1[0]) - T.across);
      sc += T.twistW * Math.max(0, twist - T.roll);
      // the pad on the leather: the nail side faces away from the rim
      const padOn = dot(u2, ti.n);
      sc += 8 * Math.max(0, 0.35 - padOn);
      // the metacarpal's back faces out of the palm, not into it
      sc += 4 * Math.max(0, -dot(u0, N) - 0.2);
      const nail = dot(u2, norm(sub(eyeG, tip)));
      sc += T.w[1] * Math.max(0, T.nail - nail);
      // nothing sinks into the rim
      let sink = 0;
      for (const t of [0.4, 0.7]) { const q = lerp3(ip, tip, t); sink += Math.max(0, tpal[2] - sq - 1 - rimSdfG(q[0], q[1], q[2])); }
      for (const t of [0, 0.35, 0.7, 1]) { const q = lerp3(m, ip, t); sink += Math.max(0, tpal[1] - sq * 0.5 - rimSdfG(q[0], q[1], q[2])); }
      for (const t of [0.6, 1]) { const q = lerp3(C, m, t); sink += Math.max(0, tpal[0] - sq * 0.5 - rimSdfG(q[0], q[1], q[2])); }
      sc += 3 * sink;
      // ... or into the index finger
      const clash = Math.max(0, d.thumb.halfW[1] + ix.halfW[0] - 4 - Math.min(segSeg(m, ip, ix.joints[0], ix.joints[1]), segSeg(m, ip, ix.joints[1], ix.joints[2]), segSeg(ip, tip, ix.joints[1], ix.joints[2]), segSeg(ip, tip, ix.joints[2], ix.joints[3])));
      sc += 2 * clash;
      // the fingertips in view: as the eye sees them, the thumb stays off the middle, ring and little fingertips
      let cover = 0;
      for (let i = 1; i < 4; i++) {
        const e3 = norm(sub(eyeG, tips[i]));
        const dd = Math.min(segDist(projE(tips[i], e3), projE(ip, e3), projE(tip, e3)), segDist(projE(tips[i], e3), projE(m, e3), projE(ip, e3)));
        cover += Math.max(0, T.sep - dd);
      }
      sc += 0.6 * cover;
      // the first web space stays open: the thumb's MCP keeps off the index's metacarpal (abduction), so the web is
      // a saddle between two digits and not the thumb lying flat against the side of the palm
      const webD = segDist(m, base[0], mcp[0]);
      sc += T.webW * Math.max(0, T.web - webD);
      sc += T.w[0] * Math.abs(dx - T.tipDx);
      if (!best || sc < best.s) {
        best = { j: [C, m, ip, tip], d: [d0, d1, d2], u: [u0, u1, u2], k: kI, f: [0, fM, fI], s: sc, q: [dx, pt, psi, incl, ...co],
          terms: { fM, fI, twist, padOn, nail, sink, clash, hM, cover, webD, ipPhi, tipPhi: pt, dx, cx: cmc0[0], cy: cmc0[1], cz: cmc0[2], cphi: sectionAngle(cmc0), cD: rimSdfG(cmc0[0], cmc0[1], cmc0[2]) } };
      }
    }
  };
  const clampB = (v: number, i: number) => Math.max(T.cmcBox[i][0], Math.min(T.cmcBox[i][1], v));
  const fixedT = T.q[pres];
  if (fixedT) tryTip(fixedT[0], fixedT[1], fixedT[2], fixedT[3], fixedT.slice(4));
  if (!best) {
    // the coarse search (POSE.thumb.grid: [from, to, step] per axis; the CMC box is stepped in thirds), then three
    // passes of refinement round the best. It costs ~1-2 s, so the result is pinned in POSE.thumb.q per presentation
    const span = (r: number[]) => { const o: number[] = []; for (let v = r[0]; v <= r[1] + 1e-9; v += r[2]) o.push(v); return o; };
    const thirds = (b: number[]) => [b[0], (b[0] + b[1]) / 2, b[1]];
    const G = T.grid;
    for (const c0 of thirds(T.cmcBox[0])) for (const c1 of thirds(T.cmcBox[1])) for (const c2 of thirds(T.cmcBox[2])) for (const c3 of thirds(T.cmcBox[3]))
      for (const dx of span([T.tipDx + G.dx[0], T.tipDx + G.dx[1], G.dx[2]])) for (const pt of span([T.tipPhi[0], T.tipPhi[1], G.pt])) for (const psi of span(G.psi))
        for (const incl of span(G.incl)) tryTip(dx, pt, psi, incl, [c0, c1, c2, c3]);
    if (!best) throw new Error('hands: no thumb pose');
    for (let pass = 0; pass < 3; pass++) {
      const q = (best as Sol).q, hh = [3, 1.5, 0.75][pass];
      for (let a = -hh; a <= hh; a += hh) for (let b = -2 * hh; b <= 2 * hh; b += 2 * hh) for (let c = -2 * hh; c <= 2 * hh; c += 2 * hh) for (let i2 = -2 * hh; i2 <= 2 * hh; i2 += 2 * hh)
        for (let e = -2 * hh; e <= 2 * hh; e += 2 * hh) for (let g = -2 * hh; g <= 2 * hh; g += 2 * hh) for (let k = -2 * hh; k <= 2 * hh; k += 2 * hh) for (let l = -2 * hh; l <= 2 * hh; l += 2 * hh)
          tryTip(q[0] + a, Math.max(T.tipPhi[0], Math.min(T.tipPhi[1], q[1] + b)), q[2] + c, q[3] + i2, [clampB(q[4] + e, 0), clampB(q[5] + g, 1), clampB(q[6] + k, 2), clampB(q[7] + l, 3)]);
    }
  }
  if (!best) throw new Error('hands: no thumb pose');
  const bt = best as Sol;
  const tj = bt.j, td = bt.d, tdn = bt.u, t0 = td[0], cmc = tj[0];
  digits.push({ name: 'thumb', joints: tj, dirs: td, dorsal: tdn, flexAxis: bt.k, halfW: d.thumb.halfW, dors: d.thumb.dors, palm: d.thumb.palm, flex: bt.f, nail: { len: tl[2] * d.nail[4], width: female ? 11.8 : 13.6, free: d.nailFree } });
  thumbScore = bt.s; thumbQ = bt.q; thumbTerms = bt.terms;
  const tn = tdn[0];

  // ---- the wrist and the arm
  const baseMid = lerp3(base[1], base[2], 0.5);
  const wrist = madd(madd(baseMid, P, d.carpus), N, -7.5);
  const sh = GRIP.right.shoulder;
  const shG = wToG(carToW([sh.x, sh.y, sh.z]));
  const poleG = dirWToG(carDirToW([0.45, -1, -0.15]));
  const ik = reach(shG, wrist, d.upperLen, d.foreLen, poleG);
  const fd = norm(sub(ik.elbow, wrist));
  const fu = perp(N, fd), fl = perp(R, fd);      // the back of the forearm, and its thumb side

  // ---- palm and arm group
  const kp = 6;
  for (let i = 0; i < 4; i++) {
    // metacarpal with the palm's soft tissue under it (the bone lies near the back of the hand); each follows the
    // arch, so the back of the hand is curved across
    const up = lerp3(N, Nk[i], 0.6), sh2 = 6.2 * fem;
    const a = madd(base[i], N, -sh2 * 0.9), b = madd(mcp[i], up, -sh2);
    f.cone(a, b, 11.0 * fem, 11.8 * fem, up, 1, i === 0 || i === 3 ? 0.78 : 0.8, G_PALM, kp, 10 + i);
    // the knuckle: the metacarpal's head, proud of the back of the hand in a fist
    f.ell(madd(madd(mcp[i], Nk[i], 1.3), digits[i].dirs[0], 1.0), digits[i].dirs[0], Nk[i], d.knuckle[i] * 1.0, d.knuckle[i] * (i === 0 ? 0.8 : 0.9), d.knuckle[i] * 0.8, G_PALM, 5.5, 20 + i);
  }
  // the palm's core, the pads under the knuckles, the heel of the hand
  f.ell(madd(lerp3(O, baseMid, 0.45), N, -10 * fem), P, N, 34 * fem, 10 * fem, 32 * fem, G_PALM, 12, 30);
  f.ell(madd(madd(O, P, 9), N, -12.5 * fem), R, N, 36 * fem, 7 * fem, 8.5 * fem, G_PALM, 8, 31);
  f.ell(madd(madd(baseMid, P, 6), N, -8 * fem), R, N, 25 * fem, 14 * fem, 17 * fem, G_PALM, 12, 32);
  // the back of the hand: arched across (a low dome over the metacarpals, lower toward the little finger)
  // (its thumb-side edge stops short of the thumb, so the thumb's own crest stands clear of the back of the hand)
  f.ell(madd(madd(lerp3(O, baseMid, 0.5), N, -15 * fem), R, -2), P, N, 34 * fem, 13 * fem, 33 * fem, G_PALM, 5, 36);
  // hypothenar: the fleshy edge under the little finger
  const hyC = madd(madd(lerp3(base[3], mcp[3], 0.45), N, -9 * fem), R, -6 * fem);
  f.ell(hyC, sub(mcp[3], base[3]), N, 30 * fem, 11 * fem, 10.5 * fem, G_PALM, 9, 33);
  // thenar: the ball of the thumb, over its metacarpal
  const thC = madd(madd(lerp3(cmc, tj[1], 0.45), R, -4 * fem), tn, -6 * fem);
  f.ell(thC, t0, tn, 24 * fem, 12.5 * fem, 14.5 * fem, G_PALM, 10, 34);
  // first dorsal interosseous: the muscle between thumb and index on the back of the hand
  // (full when the thumb is drawn in to grip: it fills the hollow between the index knuckle and the thumb)
  // (kept below the thumb's own crest: the thumb lies along the rim as a digit of its own, the web a saddle beside it)
  const fdiA = lerp3(base[0], mcp[0], 0.7), fdiC = madd(lerp3(fdiA, tj[1], 0.3), N, 2.0);
  f.ell(fdiC, sub(tj[1], fdiA), N, len(sub(tj[1], fdiA)) * 0.6, 7 * fem, 12 * fem, G_PALM, 12, 35);
  // ... and the dorsal web over it, from the index knuckle to the thumb's MCP: a thin membrane, so the first web
  // space reads as a saddle between the index knuckle and the thumb (the rim's leather under it, never through it)
  {
    const wa = madd(mcp[0], N, -2), wb = madd(tj[1], tn, -2), wc = lerp3(wa, wb, 0.5);
    f.ell(madd(wc, N, -4), sub(wb, wa), N, len(sub(wb, wa)) * 0.5, 5 * fem, 7 * fem, G_PALM, 10, 38);
  }
  // ... and the groove along the thumb's metacarpal on the back of the hand filled to a shallow valley: left deep and
  // narrow, the rim showed through it as a line of dark pixels from the seat
  {
    const a0 = lerp3(cmc, tj[1], 0.3), a1 = lerp3(cmc, tj[1], 0.92), ix = lerp3(base[0], mcp[0], 0.55);
    const c0 = madd(lerp3(lerp3(a0, a1, 0.5), ix, 0.42), N, 1.5);
    f.ell(c0, sub(a1, a0), N, len(sub(a1, a0)) * 0.55, 5 * fem, 9 * fem, G_PALM, 10, 39);
  }
  // the web of the thumb, and the adductor under it
  f.ell(madd(lerp3(lerp3(mcp[0], base[0], 0.3), lerp3(tj[1], tj[2], 0.2), 0.5), N, -8 * fem), sub(tj[1], mcp[0]), N, len(sub(tj[1], mcp[0])) * 0.5, 7 * fem, 9 * fem, G_PALM, 9, 37);
  // the wrist and the forearm, a flattened section that rounds out toward the elbow, with its muscle bellies
  const segs = d.forearm, Lf = d.foreLen;
  // one tube from the wrist to the elbow whose section rounds out as it goes (a chain of tubes made rings where they
  // met); the muscle bellies below give it its shape
  f.cone(madd(wrist, fd, -6), madd(wrist, fd, Lf), segs[0][1], segs[4][1], fu, 1, segs[0][0] / segs[0][1], G_PALM, 8, 40, segs[4][0] / segs[4][1]);
  f.cone(madd(wrist, fd, Lf * 0.2), madd(wrist, fd, Lf * 0.75), segs[1][1], segs[3][1], fu, 1, segs[1][0] / segs[1][1], G_PALM, 16, 41, segs[3][0] / segs[3][1]);
  f.ell(madd(wrist, fd, Lf + 4), fd, fu, 30 * fem, 34 * fem, 40 * fem, G_PALM, 14, 44);
  f.cone(madd(wrist, fd, Lf), madd(wrist, fd, Lf + 70), 36 * fem, 40 * fem, fu, 1, 1.15, G_PALM, 12, 45);
  // brachioradialis (the thumb side, toward the elbow) and the flexor mass (inner forearm)
  f.ell(madd(madd(madd(wrist, fd, Lf * 0.7), fl, 16 * fem), fu, 4 * fem), fd, fu, 80 * fem, 20 * fem, 19 * fem, G_PALM, 22, 46);
  f.ell(madd(madd(madd(wrist, fd, Lf * 0.64), fu, -12 * fem), fl, -6 * fem), fd, fu, 75 * fem, 17 * fem, 23 * fem, G_PALM, 22, 47);
  // the carpus bridging hand and wrist, and the ulna's head on the little-finger side
  f.cone(madd(baseMid, N, -6 * fem), madd(wrist, fd, 8), 16 * fem, d.wrist[1], N, 1, 1.45, G_PALM, 12, 48);
  f.ell(madd(madd(madd(wrist, fd, 14), fl, -d.wrist[0] * 0.78), fu, d.wrist[1] * 0.55), fd, fu, 7.5 * fem, 6.5 * fem, 6.5 * fem, G_PALM, 7, 49);
  // extensor tendons fanning from the wrist to each knuckle, standing on the back of the hand
  const tw = madd(madd(wrist, fd, 18), fu, d.wrist[1] - 1.2);
  for (let i = 0; i < 4; i++) {
    const up = Nk[i];
    const mid = madd(lerp3(base[i], mcp[i], 0.55), lerp3(N, up, 0.5), 5.6 * fem + 0.3);
    const top = madd(mcp[i], up, d.knuckle[i] * 0.5 + 0.8);
    f.cone(madd(madd(tw, fl, (1.5 - i) * 5 * fem), fu, -1.2), mid, d.tendon, d.tendon * 0.95, N, 1, 1.3, G_PALM, 2.8, 50 + i);
    f.cone(mid, top, d.tendon * 0.95, d.tendon * 0.9, up, 1, 1.35, G_PALM, 2.8, 54 + i);
  }

  // ---- fingers
  for (let i = 0; i < 4; i++) addDigit(f, digits[i], G_FINGER + i, 3.2, 1);
  addDigit(f, digits[4], G_THUMB, 2.4, 1);
  // the thumb's metacarpal, padded
  f.cone(madd(cmc, tn, -2), madd(tj[1], tn, -1), 10.5 * fem, 9.8 * fem, tn, 1, 1.06, G_THUMB, 6, 60);

  const capP = madd(ik.elbow, fd, 40);
  f.cap = [capP[0], capP[1], capP[2], fd[0], fd[1], fd[2]];
  f.finalize();

  // ---- veins on the back of the hand (the dorsal venous network), and up the forearm
  const veins: number[] = [];
  const onBack = (p: V3) => madd(p, N, 6.2 * fem);
  // each segment carries the direction it is seen along (the skin's 'up' there): the shader measures the distance
  // across that direction, so a vein is a band that follows the skin, not a tube that the skin only grazes in spots
  const vseg = (a: V3, b: V3, r: number, up: V3 = N) => veins.push(a[0], a[1], a[2], b[0], b[1], b[2], r, up[0], up[1], up[2]);
  const arch = [0, 1, 2, 3].map((i) => onBack(lerp3(mcp[i], base[i], 0.38 + i * 0.03)));
  const between = [0, 1, 2].map((i) => onBack(lerp3(lerp3(mcp[i], mcp[i + 1], 0.5), lerp3(base[i], base[i + 1], 0.5), 0.15)));
  between.forEach((p, i) => vseg(p, lerp3(arch[i], arch[i + 1], 0.5), 1.2));
  vseg(arch[0], arch[1], 1.3); vseg(arch[1], arch[2], 1.3); vseg(arch[2], arch[3], 1.2);
  const wr = madd(madd(wrist, fd, 30), fu, d.wrist[1] - 0.5);
  const upW = norm(lerp3(N, fu, 0.5));
  vseg(arch[0], madd(madd(wr, fl, 14 * fem), fd, -6), 1.5, upW);             // toward the cephalic vein (thumb side)
  vseg(arch[3], madd(madd(wr, fl, -16 * fem), fd, 4), 1.4, upW);              // toward the basilic vein (little-finger side)
  vseg(madd(madd(wr, fl, 14 * fem), fd, -6), madd(madd(madd(wrist, fd, 120), fl, 24 * fem), fu, 22 * fem), 1.6, fu);
  vseg(madd(madd(wr, fl, -16 * fem), fd, 4), madd(madd(madd(wrist, fd, 140), fl, -14 * fem), fu, 24 * fem), 1.4, fu);

  // ---- glove openings: round holes over the knuckles and an open back
  const holes: number[] = [];
  for (let i = 0; i < 4; i++) { const c = madd(mcp[i], Nk[i], d.knuckle[i] + 0.5); holes.push(c[0], c[1], c[2], 6.2 * (female ? 0.88 : 1)); }
  const back = madd(madd(lerp3(baseMid, O, 0.18), N, 9 * fem), R, -3);
  holes.push(back[0], back[1], back[2], 15 * fem);

  return {
    pres, field: f, digits, palm: { O, P, R, N }, mcp, wrist, wristDorsal: fu, elbow: ik.elbow, shoulder: ik.shoulder,
    foreDir: fd, foreUp: fu, wristHalf: d.wrist, upper: d.upperLen, fore: Lf, veins, holes, scale: female ? 0.92 : 1,
  };
}

function carDirToW(c: V3): V3 { return [c[0], c[1] * CT + c[2] * ST, -c[1] * ST + c[2] * CT]; }

// One finger (or the thumb) as a tapering tube with real joints. Each phalanx is two round cones with an elliptical
// section (wider than deep, the bone nearer the back), from the joint to a slightly narrower waist and on to the next
// joint, so the joints read a little wider than the shafts (the condyles) and the finger narrows ~20% to the tip. At a
// bent joint the two phalanges meet in a corner: on the back the head of the bone before it stands out as a bony
// knuckle, on the palm side the skin creases. The fingertip ends in a rounded pulp under a flatter nail bed.
function addDigit(f: Field, g: Digit, group: number, k: number, slim: number, kc = 1.2) {
  const J = g.joints, thumb = g.name === 'thumb', b0 = thumb ? 1 : 0;
  const hw = g.halfW.map((w) => w * slim);
  const r = (b: number) => (g.dors[b] + g.palm[b]) / 2, sh = (b: number) => (g.palm[b] - g.dors[b]) / 2;
  // half width at a joint: the condyles a little proud of both shafts
  const jointW = (b: number) => Math.max(hw[b - 1] * 0.96, hw[b]) * (thumb ? 1.05 : 1.015);   // the thumb's IP condyles show
  for (let b = b0; b < 3; b++) {
    const a = J[b], e = J[b + 1], dir = g.dirs[b], up = g.dorsal[b], L = len(sub(e, a)), last = b === 2;
    const rA = r(b), shA = sh(b), wA = b === b0 ? hw[b] : jointW(b);
    const rE = last ? (g.dors[2] * 0.82 + g.palm[2] * 0.86) / 2 : r(b + 1), shE = last ? sh(2) * 0.8 : sh(b + 1);
    const wE = last ? hw[2] * 0.8 : jointW(b + 1);
    // the shaft: on the line from joint to joint, only a touch slimmer (no beads), the finger tapering as it goes
    const rM = (rA + rE) * 0.5 * 0.985, shM = (shA + shE) * 0.5, wM = (wA + wE) * 0.5 * (last ? 0.92 : 0.97);
    // the end of the shaft: at the next joint (on the next phalanx's own axis offset), or short of the fingertip so
    // the cone's round end makes the tip
    const pA = madd(a, up, -shA), pM = madd(madd(a, dir, L * (last ? 0.45 : 0.5)), up, -shM);
    const pE = last ? madd(madd(e, up, -shE), dir, -rE * 0.97) : madd(e, g.dorsal[b + 1], -shE);
    // the shaft cones join almost hard: a smooth-min between collinear pieces adds k/4 of flesh at every junction,
    // which strung the fingers into beads (sausages); only the bent joints' palmar creases are rounded a little
    f.cone(pA, pM, rA, rM, up, 1, wA / rA, group, b === b0 ? k : kc, 100 + b, wM / rM);
    f.cone(pM, pE, rM, rE, up, 1, wM / rM, group, kc * 0.5, 103 + b, wE / rE);
    if (b > 0) {
      // the bent joint (the thumb's MCP too): the head of the bone before it, under the skin of the knuckle
      const pu = g.dorsal[b - 1], pd = g.dirs[b - 1];
      const flex = Math.acos(Math.max(-1, Math.min(1, dot(pd, dir))));
      const s = Math.min(1, flex / (75 * DEG));
      // (the thumb's MCP head is the knuckle the driver sees at the root of the thumb: bigger, and a little prouder)
      const kb = thumb && b === 1 ? 1.4 : 1;
      if (s > 0.1) f.ell(madd(madd(a, pu, g.dors[b - 1] * (thumb && b === 1 ? 0.62 : 0.55)), pd, -2.2), pd, pu, 4.5 * kb, (1.2 + 0.5 * s) * kb, hw[b - 1] * 0.6 * kb, group, 2.6, 120 + b);
    }
  }
  // the fingertip's pulp, fuller than the nail bed
  const a2 = J[2], d2 = g.dirs[2], u2 = g.dorsal[2], L2 = len(sub(J[3], a2));
  f.ell(madd(madd(a2, d2, L2 * 0.56), u2, -g.palm[2] * 0.42), d2, u2, L2 * 0.40, g.palm[2] * 0.38, hw[2] * 0.74, group, k * 1.2, 110);
}

// ------------------------------------------------------------------------------------------------ measurements
// The proportions as built, for checking against the brief: lengths from the skeleton (they don't change with the
// grip) and widths measured across the actual surface of the field.
export interface HandMeasure {
  handLen: number; palmLen: number; palmShare: number; middleShare: number;
  phalanx: { name: string; mm: number[]; ratio: number[] }[];
  width: { name: string; base: number; tip: number; taper: number }[];
  thumbShare: number; nailShare: number[];
}
export function measureHand(A: Anatomy): HandMeasure {
  const mid = A.digits[1];
  const fingerLen = (g: Digit) => len(sub(g.joints[1], g.joints[0])) + len(sub(g.joints[2], g.joints[1])) + len(sub(g.joints[3], g.joints[2]));
  const toMcp = len(sub(mid.joints[0], A.wrist));
  const handLen = toMcp + fingerLen(mid);
  const crease = 18 * A.scale;                 // the finger's base crease, past the knuckle's centre
  const width = (g: Digit, gi: number, b: number, t: number) => {
    const p = lerp3(g.joints[b], g.joints[b + 1], t), lat = norm(cross(g.dirs[b], g.dorsal[b]));
    const pal = (g.palm[b] - g.dors[b]) / 2, c = madd(p, g.dorsal[b], -pal * 0.5);
    const edge = (s: number) => { let x = 0; for (; x < 20; x += 0.05) { const q = madd(c, lat, s * x); if (A.field.groupDist(gi, q[0], q[1], q[2]) > 0) break; } return x; };
    return edge(1) + edge(-1);
  };
  return {
    handLen, palmLen: toMcp + crease, palmShare: (toMcp + crease) / handLen, middleShare: (fingerLen(mid) - crease) / handLen,
    phalanx: A.digits.map((g) => {
      const mm = [0, 1, 2].map((b) => len(sub(g.joints[b + 1], g.joints[b])));
      return { name: g.name, mm, ratio: mm.map((x) => x / mm[0]) };
    }),
    width: A.digits.slice(0, 4).map((g, i) => { const b = width(g, G_FINGER + i, 0, 0.2), t = width(g, G_FINGER + i, 2, 0.45); return { name: g.name, base: b, tip: t, taper: 1 - t / b }; }),
    thumbShare: (len(sub(A.digits[4].joints[2], A.digits[4].joints[1])) + len(sub(A.digits[4].joints[3], A.digits[4].joints[2]))) / fingerLen(mid),
    nailShare: A.digits.map((g) => g.nail.len / len(sub(g.joints[3], g.joints[2]))),
  };
}
