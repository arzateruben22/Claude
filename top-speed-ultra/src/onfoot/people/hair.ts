// Hair: a volume per style (a shell over the scalp, thicker on top; a hanging curtain for long hair and bobs that
// falls from the head's widest point and lies on the shoulders and back; a bun, a ponytail, curls), clipped at the
// hairline and kept off the face. It is meshed as a "cap" with a strand shader (streaks along a flow field and
// Kajiya-Kay highlights along it), and strand cards are grown over its outer surface along the same flow, so the
// silhouette and the highlights break up like hair. Frame: body rest pose; style shapes are in the head's frame.
import * as THREE from 'three';
import { Field, Sdf, smin } from './field';
import { Rig, B } from './body';
import { HeadFrame } from './head';
import { HairStyle, Look, Quality } from './params';
import { V3, clamp, smooth, norm, cross, dot, rng, lerp } from './math';
import { scalpCover, faceMasks, hairlineDepth } from './masks';
import { NOISE } from './skin';
import { hairLights } from './cards';

export interface HairSpec {
  top: number; side: number; back: number;   // shell thickness (m)
  hang: number | null;                        // head-local y the hanging hair ends at
  bun: boolean; tail: boolean; curl: number;  // curl 0..1
  part: number;                               // x of the parting (head-local)
  cards: number; cardW: number; tex: 'straight' | 'wavy' | 'curl';
  framing: boolean;                           // loose strands framing the face
  // (cast styles, 2026-11-11; unset on every older style, which build exactly as before)
  tie?: V3; tailEnd?: V3; tailR?: [number, number];   // a tail's tie and end (head-local) and its radius there
  cut?: number;                               // clipped sides: head-local y below which the volume is cut away
  sweep?: boolean;                            // the top swept over sideways from the parting (a side part)
  cardLen?: number;                           // how far strand cards grow (m), when the style needs longer ones
  // (pack styles, 2026-11-12; unset on every other style)
  taper?: number;                             // the volume grows from nothing at the hairline to full over this far above it (m): no ledge, no gap under the edge
  fringe?: number;                            // the hairline lowered this far (m) at the front and over the ear tops, the volume hanging over it: curls on the forehead
  vol?: number;                               // a hanging curtain's swell toward its ends (0.06 when unset)
  wave?: number;                              // a hanging curtain's waves: their depth as a share of its radius
  faceW?: number;                             // the face opening's half width at the jaw (m; it is 0.074 at the eyes and, unset, all the way down)
  front?: number;                             // the curtain is cut away in front of this head-local z (beside the face it otherwise comes forward past the nose)
  meshK?: number;                             // the cap's meshing step as a multiple of the usual one (a long curtain is a large, smooth surface)
  // (graphics pass, 2026-11-15; unset on every other style, which builds exactly as before)
  flowing?: boolean;                          // hanging hair as a horseshoe round the back and sides of the head with its own rounded front ends beside the face (real surfaces, not a clipped curtain), the hairline lowered in an inverted V from the parting
  partV?: number;                             // flowing: how far the hair comes down over the forehead's corners and the temples away from the parting (m)
  ends?: number;                              // flowing: the ends' unevenness (m): locks of different lengths, no straight hem
  clumpF?: number; clumpA?: number;           // curls: the clumps' frequency (1/m) and depth (m), instead of the fine 14 mm lumps
  cardStep?: number;                          // the strand cards' segment length (m; 0.011 when unset): long hair needs fewer, longer segments
  cutLen?: number;                            // clipped sides: how far above `cut` the volume reaches its full thickness (0.044 when unset)
  quiff?: number;                             // extra height at the front of the top, swept up and over away from the parting (m)
  under?: number;                             // (a cap worn over the hair) the volume only below this head-local y at the sides and back: the crown is under the cap
}

/** (graphics pass) a fitted cap's band, head-local y by head-local z: low on the forehead, lower still at the back of the
 *  head, above the ears at the sides (acc.ts builds the cap on it; hair worn under a cap grows out below it) */
export const capBandY = (lz: number) => lerp(0.047, 0.004, clamp((0.03 - lz) / 0.2));

export function hairSpec(style: HairStyle, male: boolean): HairSpec | null {
  const S = (o: Partial<HairSpec>): HairSpec => ({ top: 0.012, side: 0.006, back: 0.006, hang: null, bun: false, tail: false, curl: 0, part: 0.018, cards: 160, cardW: 0.012, tex: 'straight', framing: false, ...o });
  switch (style) {
    case 'bald': case 'buzz': return null;
    case 'short': return S({ top: male ? 0.013 : 0.016, side: 0.006, back: 0.005, cards: 190, part: 0.02 });
    case 'receding': return S({ top: 0.007, side: 0.005, back: 0.004, cards: 130 });
    case 'long': return S({ top: 0.009, side: 0.008, back: 0.01, hang: -0.33, cards: 460, cardW: 0.016, tex: 'wavy', part: 0.012 });
    case 'bob': return S({ top: 0.01, side: 0.01, back: 0.012, hang: -0.125, cards: 340, cardW: 0.015, part: 0.016 });
    case 'updo': return S({ top: 0.016, side: 0.008, back: 0.009, bun: true, cards: 340, cardW: 0.012, tex: 'wavy', framing: true, part: 0.0 });
    case 'ponytail': return S({ top: 0.007, side: 0.005, back: 0.006, tail: true, cards: 240, cardW: 0.012, part: 0.0 });
    case 'curly': return S({ top: male ? 0.024 : 0.028, side: male ? 0.014 : 0.022, back: male ? 0.016 : 0.024, hang: male ? null : -0.15, curl: 1, cards: male ? 300 : 440, cardW: 0.014, tex: 'curl' });
    // ---- the cast's styles (src/onfoot/cast.ts)
    case 'highPonytail': return S({ top: 0.007, side: 0.005, back: 0.006, tail: true, tie: [0, 0.088, -0.128], tailEnd: [0, -0.3, -0.215], tailR: [0.024, 0.011], cards: 380, cardW: 0.013, part: 0.0, framing: false, cardLen: 0.16 });   // (framing off: the face-framing cards hung as dark slabs beside the cheeks in the renders of 2026-11-12)
    case 'lowPonytail': return S({ top: 0.01, side: 0.008, back: 0.008, tail: true, tie: [0, -0.04, -0.158], tailEnd: [0, -0.21, -0.19], tailR: [0.024, 0.013], cards: 340, cardW: 0.014, tex: 'wavy', part: 0.012, framing: false, cardLen: 0.12 });   // (framing off, 2026-11-15: the loose strands hung as detached slabs across the cheeks)
    case 'fade': return S({ top: 0.022, side: 0.004, back: 0.004, curl: 0.35, cut: 0.03, cards: 200, cardW: 0.012, tex: 'curl', part: 0, cardLen: 0.03 });
    case 'sidePart': return S({ top: 0.024, side: 0.005, back: 0.005, cut: 0.012, cutLen: 0.062, quiff: 0.016, sweep: true, part: -0.034, cards: 300, cardW: 0.013, cardLen: 0.09 });   // (2026-11-15: the sides thin gradually into the clipped scalp from the temple up, no overhanging edge, and the front stands up and over in a quiff; was a slab cut level at 3.2 cm)
    case 'waves': return S({ top: 0.012, side: 0.012, back: 0.014, hang: -0.2, curl: 0.22, cards: 480, cardW: 0.016, tex: 'wavy', part: 0.032 });
    // ---- the pack's styles (cast.ts CAST_PACK, 2026-11-12)
    // medium curls: a deep, lumpy mass on top and round the sides and back, the curl cards standing off it
    case 'curlsMedium': return S({ top: 0.036, side: 0.022, back: 0.027, curl: 1.35, cards: 620, cardW: 0.026, tex: 'curl', part: 0, cardLen: 0.05, taper: 0.02, fringe: 0.036, clumpF: 40, clumpA: 0.013 });   // (2026-11-15: curl-sized clumps 2.5 cm across with real depth, a fuller edge that hangs over the forehead; was fine 14 mm lumps, a thin ragged edge)
    // long, loosely waved hair from a centre parting, down the back to under the shoulder blades
    case 'longWaves': return S({ top: 0.017, side: 0.02, back: 0.024, hang: -0.43, cards: 300, cardW: 0.03, meshK: 1.55, tex: 'wavy', part: 0.0, vol: 0.2, wave: 0.05, taper: 0.016, flowing: true, partV: 0.042, ends: 0.03, cardLen: 0.34, cardStep: 0.024 });   // (2026-11-15: flowing; was a cap with a clipped curtain)
    // (the six, 2026-11-15) Leila's shoulder-length waves from a side parting, as flowing hair with volume at the ends
    case 'wavesFlow': return S({ top: 0.016, side: 0.018, back: 0.02, hang: -0.185, cards: 300, cardW: 0.026, meshK: 1.3, tex: 'wavy', part: 0.03, vol: 0.3, wave: 0.07, taper: 0.016, flowing: true, partV: 0.04, ends: 0.022, cardLen: 0.2, cardStep: 0.02, curl: 0.12 });
    // (01, 2026-11-15) thick curls under a cap: the curls show below the cap's band at the sides and the back
    case 'curlsUnderCap': return S({ top: 0.012, side: 0.02, back: 0.024, curl: 1.2, cards: 300, cardW: 0.024, tex: 'curl', part: 0, cardLen: 0.045, taper: 0.012, fringe: 0.012, clumpF: 46, clumpA: 0.011, under: 0.05 });
  }
}

/** where the hair goes (head-local): a tangent direction field the strands follow */
// a loose bun high on the back of the crown: it shows over the head's outline from the front (at 0.078/-0.16 it hid)
const BUN_C: V3 = [0, 0.094, -0.142];
function flowAt(sp: HairSpec, l: V3): V3 {
  const [x, y, z] = l;
  if (sp.tie && sp.tailEnd) {
    // (cast tails) on the tail itself: down along it, from the tie to the end; elsewhere pulled back to the tie
    const a = sp.tie, b = sp.tailEnd, ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const t = dot([x - a[0], y - a[1], z - a[2]], ab) / dot(ab, ab);
    const q: V3 = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
    if (t > 0.02 && Math.hypot(x - q[0], y - q[1], z - q[2]) < 0.045) return norm(ab);
    return norm([a[0] - x, a[1] - y, a[2] - z]);
  }
  if (sp.bun || sp.tail) {
    // pulled back and up to the bun / the tie
    const c: V3 = sp.bun ? BUN_C : [0, 0.02, -0.165];
    const d = norm([c[0] - x, c[1] - y, c[2] - z]);
    return d;
  }
  if (sp.flowing) {
    // (graphics pass) away from the parting over the dome, then down; loose waves swing the strands sideways as they fall
    const sgp = x >= sp.part ? 1 : -1, top = smooth(0.02, 0.085, y) * smooth(-0.13, -0.07, z);
    const rr = Math.hypot(x, z + 0.045) || 1, tx = (z + 0.045) / rr, tz = -x / rr;
    const w = sp.wave ? 0.5 * Math.sin(y * 42 + 5 * Math.atan2(x, z + 0.045) + 2.2 * Math.sin(x * 31 + z * 17)) * smooth(0.02, -0.07, y) : 0;
    return norm([sgp * 0.95 * top + 0.1 * Math.sign(x) + w * tx, -1 + 0.7 * top, -0.12 - 0.2 * top + w * tz]);
  }
  const ax = Math.abs(x - sp.part), sg = x >= sp.part ? 1 : -1;
  // the parting runs from the front hairline to the crown only (and curls hide it): behind the crown hair falls
  const onTop = smooth(0.03, 0.075, y) * smooth(-0.11, -0.05, z) * (1 - sp.curl);
  if (sp.hang !== null) {
    // away from the parting on top, then straight down
    const away: V3 = [sg * 1, -0.35, -0.25 * smooth(0.0, 0.04, -z)];
    const down: V3 = [0.12 * Math.sign(x), -1, -0.15];
    const t = onTop * smooth(0.06, 0.0, ax - 0.02);
    return norm([lerp(down[0], away[0], t), lerp(down[1], away[1], t), lerp(down[2], away[2], t)]);
  }
  if (sp.sweep) {
    // a side part: on top, up and over away from the parting (and a little back); the clipped sides comb down
    const top = smooth(0.0, 0.05, y);
    const over: V3 = [sg * 0.9, 0.15 - 0.6 * smooth(0.05, 0.09, ax), -0.45];
    const down: V3 = [0.25 * Math.sign(x), -0.9, -0.35];
    return norm([lerp(down[0], over[0], top), lerp(down[1], over[1], top), lerp(down[2], over[2], top)]);
  }
  // short styles: front to back on top, down and back at the sides
  const side = smooth(0.035, 0.07, Math.abs(x));
  // (pack) a fringe: over the front of the head the hair falls forward and down instead of back
  if (sp.fringe) { const fr = smooth(-0.07, -0.02, z); return norm([0.35 * Math.sign(x) * (side + 0.3 * fr), -0.25 - side * 0.9 - 0.45 * fr - smooth(-0.03, -0.09, z) * 0.6 * (1 - fr), lerp(-(1 - side * 0.55), 0.85, fr)]); }
  return norm([0.3 * Math.sign(x) * side, -0.2 - side * 0.9 - smooth(-0.03, -0.09, z) * 0.6, -(1 - side * 0.55)]);
}

/** irregular round clumps (curls): a billowy value noise, 0..1 */
function vn3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const h = (a: number, b: number, c: number) => { const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return n - Math.floor(n); };
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}
function clumps(x: number, y: number, z: number) {
  const a = 1 - Math.abs(vn3(x, y, z) * 2 - 1), b = 1 - Math.abs(vn3(x * 2.1 + 5, y * 2.1 + 1, z * 2.1 + 3) * 2 - 1);
  return 0.7 * a * a + 0.3 * b;
}

/** the hair volume as a field (body coordinates) */
export class HairSdf implements Sdf {
  n: number; maxK: number;
  private bufH: Int32Array; private bufC: Int32Array;
  constructor(public hf: HeadFrame, public sp: HairSpec, public H: Field, public C: Field, public hang: ((x: number, y: number, z: number) => number) | null, public style: HairStyle) {
    this.n = H.n + C.n + 1; this.maxK = Math.max(H.maxK, C.maxK, 0.02);
    this.bufH = new Int32Array(H.n); this.bufC = new Int32Array(C.n);
  }
  /** (pack) the point the scalp is tested at: with a fringe, a little higher than the point itself at the front and
   *  over the ear tops, which lowers the hairline there (unevenly: locks); without one, the point */
  fr(l: V3): V3 {
    const f = this.sp.fringe;
    // (flowing) the hairline lowered away from the parting, over the forehead's corners and the temples: an inverted V
    if (this.sp.partV) { const ax = Math.abs(l[0] - this.sp.part); return [l[0], l[1] + (this.sp.partV * smooth(0.004, 0.05, ax) + 0.022 * smooth(0.048, 0.066, ax)) * smooth(-0.1, -0.03, l[2]), l[2]]; }
    if (!f) return l;
    // (big curls: locks about 3 cm wide round the hairline, some long, some short; by the angle round the head only, so a
    // lock is one piece from the hairline down and leaves no window of skin behind it)
    const ph = Math.atan2(l[0], l[2] + 0.06);
    const lock = this.sp.clumpA ? 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(ph * 6.5 + 1.2 * Math.sin(ph * 3 + 0.5)), 0.6) : 0.5 + 0.5 * clumps(l[0] * 60 + 3, 1.7, l[2] * 60);
    return [l[0], l[1] + f * lock * Math.max(smooth(-0.075, -0.015, l[2]), 0.7 * smooth(0.05, 0.066, Math.abs(l[0])) * smooth(-0.115, -0.06, l[2])), l[2]];
  }
  thick(lIn: V3) {
    const l = lIn, lc = this.fr(lIn);
    const sp = this.sp, top = smooth(-0.005, 0.07, l[1]), back = smooth(-0.04, -0.1, l[2]);
    let t = lerp(lerp(sp.side, sp.back, back), sp.top, top);
    // thinning to nothing at the hairline, so the hair grows out of the scalp instead of sitting on it like a cap
    t *= (sp.bun || sp.tail ? 0.04 : 0.2) + (sp.bun || sp.tail ? 0.96 : 0.8) * smooth(0.45, 0.98, scalpCover(this.style, lc, 35 + 40 * this.hf.old, this.hf.male));   // pulled back: no ledge at the hairline
    // pulled-back styles: combed sections (soft ridges running back to the bun or the tie) and a lifted crown
    if (sp.bun || sp.tail) {
      const phi = Math.atan2(l[0], l[1] + 0.02), ridge = Math.sin(phi * 11 + 1.7 * Math.sin(l[2] * 40)) * Math.sin(phi * 5 + 0.6);
      t += (0.0018 * ridge + 0.0035 * smooth(0.0, 0.06, l[1]) * smooth(0.03, -0.04, l[2])) * smooth(0.6, 0.95, scalpCover(this.style, lc, 35 + 40 * this.hf.old, this.hf.male));
    }
    else {
      const lump = Math.sin(l[0] * 95 + 2.1 * Math.sin(l[2] * 60)) * Math.sin(l[2] * 70 + 1.3 * Math.sin(l[0] * 80)) + 0.5 * Math.sin(l[0] * 210 + l[2] * 50);
      t += 0.0016 * lump * smooth(0.02, 0.07, l[1]) * smooth(0.6, 0.95, scalpCover(this.style, lc, 35 + 40 * this.hf.old, this.hf.male));
    }
    if (sp.clumpA) t += (sp.clumpA * (clumps(l[0] * sp.clumpF!, l[1] * sp.clumpF!, l[2] * sp.clumpF!) - 0.42) + 0.3 * sp.clumpA * (clumps(l[0] * sp.clumpF! * 2.3 + 7, l[1] * sp.clumpF! * 2.3, l[2] * sp.clumpF! * 2.3 + 3) - 0.42)) * smooth(0.0, 0.012, hairlineDepth(this.style, lc, 35 + 40 * this.hf.old, this.hf.male) + 0.004);
    else if (sp.curl > 0) t += sp.curl * 0.009 * (clumps(l[0] * 70, l[1] * 70, l[2] * 70) - 0.45);
    if (sp.clumpA) t = Math.max(t, 0.004 * smooth(0.45, 0.98, scalpCover(this.style, lc, 35 + 40 * this.hf.old, this.hf.male)));   // (a clump's hollow never dips under the skin: no holes)
    // (a cap over the hair) nothing above the cap's band: the crown is under the cap
    if (sp.under !== undefined) t *= 0.3 + 0.7 * smooth(capBandY(l[2]) + 0.008, capBandY(l[2]) - 0.01, l[1]);
    // clipped sides (fade, side part): the volume thins to nothing toward the cut, so the top sits on a short-clipped
    // scalp (the skin shader's hair-coloured scalp) instead of ending in a ledge
    if (sp.quiff) t += sp.quiff * smooth(-0.075, -0.015, l[2]) * smooth(0.05, 0.085, l[1]) * (0.75 + 0.25 * Math.sign(l[0] - sp.part) * smooth(0.0, 0.03, Math.abs(l[0] - sp.part)));
    if (sp.cut !== undefined) t *= smooth(sp.cut - 0.004, sp.cut + (sp.cutLen ?? 0.04), l[1]);
    // (pack) a tapered edge: full only where the scalp a few centimetres further down is covered too
    if (sp.taper) t *= 0.05 + 0.95 * smooth(0.0, sp.taper, hairlineDepth(this.style, this.fr(l), 35 + 40 * this.hf.old, this.hf.male));
    return t;
  }
  /** (big curls) 0..1: how far out on a clump a point is (the curls' outer turns carry the lighter tips) */
  tipAt(x: number, y: number, z: number) {
    const sp = this.sp; if (!sp.clumpA) return 0;
    const l = this.hf.toLocal([x, y, z]);
    return smooth(0.5, 0.9, clumps(l[0] * sp.clumpF!, l[1] * sp.clumpF!, l[2] * sp.clumpF!));
  }
  extra(l: V3) {
    const sp = this.sp, s = this.hf.sx;
    let d = 1e9;
    if (sp.bun) { const q = [(l[0]) / 0.05, (l[1] - BUN_C[1]) / 0.042, (l[2] - BUN_C[2]) / 0.043]; d = Math.min(d, (Math.hypot(q[0], q[1], q[2]) - 1) * 0.038 * s); }
    if (sp.tail) {
      // a tie at the back of the head, then a tapered tail falling down and a little out
      const a: V3 = sp.tie ?? [0, 0.02, -0.168], b: V3 = sp.tailEnd ?? [0, -0.2, -0.2], tr = sp.tailR ?? [0.02, 0.009];
      const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = clamp(dot([l[0] - a[0], l[1] - a[1], l[2] - a[2]], ab) / dot(ab, ab));
      const r = lerp(tr[0], tr[1], t) * (1 + 0.25 * Math.sin(t * 3.1));
      const c: V3 = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
      d = Math.min(d, (Math.hypot(l[0] - c[0], l[1] - c[1], l[2] - c[2]) - r) * s);
    }
    return d;
  }
  prim(i: number, x: number, y: number, z: number) {
    if (i < this.H.n) return this.H.prim(i, x, y, z) - 0.075;   // thickness + the curtain's blend: a tighter bound left seams
    if (i < this.H.n + this.C.n) return 1e9;   // the body only carves; it never adds surface
    const l = this.hf.toLocal([x, y, z]);
    return Math.min(this.extra(l), this.hang ? this.hang(x, y, z) : 1e9);
  }
  eval(x: number, y: number, z: number, act: Int32Array | null, nAct: number) {
    const hf = this.hf, o = hf.o, l: V3 = [(x - o[0]) / hf.sx, (y - o[1]) / hf.sy, (z - o[2]) / hf.sz];
    let nh = 0, nc = 0;
    if (act) for (let j = 0; j < nAct; j++) { const i = act[j]; if (i < this.H.n) this.bufH[nh++] = i; else if (i < this.H.n + this.C.n) this.bufC[nc++] = i - this.H.n; }
    let d = (act ? (nh ? this.H.eval(x, y, z, this.bufH, nh) : 1e9) : this.H.eval(x, y, z, null, 0)) - this.thick(l);
    // (flowing) the shell exists on the scalp only: off it there is no film of hair over the skin for the clip to deal with
    if (this.sp.flowing && scalpCover(this.style, this.fr(l), 35 + 40 * hf.old, hf.male) < 0.3) d = 1;
    if (this.hang) d = smin(d, this.hang(x, y, z), this.sp.flowing ? 0.012 : 0.025);
    d = smin(d, this.extra(l), 0.01);
    // lie on the shoulders and back, never through them
    if (this.hang || this.sp.tail) {
      const c = act ? (nc ? this.C.eval(x, y, z, this.bufC, nc) : 1e9) : this.C.eval(x, y, z, null, 0);
      d = Math.max(d, 0.005 - c);
    }
    return d;
  }
  /** the scalp under the hairline only (< 0 where hair grows) */
  capKeep(x: number, y: number, z: number) {
    const hf = this.hf, o = hf.o, l: V3 = [(x - o[0]) / hf.sx, (y - o[1]) / hf.sy, (z - o[2]) / hf.sz];
    return (0.5 - scalpCover(this.style, this.fr(l), 35 + 40 * hf.old, hf.male)) * 0.03;
  }
  /** what is added to the shell: the curtain, a bun, a tail (body coordinates) */
  extraAt(x: number, y: number, z: number) {
    const hf = this.hf, o = hf.o, l: V3 = [(x - o[0]) / hf.sx, (y - o[1]) / hf.sy, (z - o[2]) / hf.sz];
    let d = this.extra(l);
    if (this.hang) d = Math.min(d, this.hang(x, y, z));
    return d;
  }
  /** the hair's region: the scalp under the hairline, plus (hanging styles) everything off the face above the ends */
  keep(x: number, y: number, z: number) {
    const hf = this.hf, l = hf.toLocal([x, y, z]), sp = this.sp;
    const male = hf.male;
    const c = scalpCover(this.style, this.fr(l), 35 + 40 * hf.old, male);
    let k = (0.5 - c) * 0.03;
    // (the cast's tails: a deeper margin, so the tail's own surface reads as well inside the region: the cap shader's
    // edge fade and the cards' roots both go by it)
    if (sp.bun || sp.tail) k = Math.min(k, this.extra(l) - (sp.tie ? 0.02 : 0.002));
    if (sp.cut !== undefined) k = Math.max(k, (sp.cut - 0.002 - l[1]) * 0.5);
    if (sp.flowing && this.hang) {
      // the scalp under the (lowered) hairline, and the hanging hair itself down to its uneven ends; its front ends beside
      // the face are its own surfaces, so nothing is clipped there and nothing is see-through
      const ang = Math.atan2(l[0], l[2] + 0.045);
      const end = sp.hang! + (sp.ends ?? 0) * (0.6 * Math.sin(ang * 7 + 1.3) + 0.4 * Math.sin(ang * 3 + 0.7) - 0.3) - 0.025 * smooth(0.04, -0.08, l[2]) - l[1];
      return Math.min(k, Math.max(end, this.hang(x, y, z) - 0.02));
    }
    if (sp.hang !== null) {
      // the face: an oval column in front (hair frames it round its edge, never crosses it)
      const zc = 0.03, fx = Math.abs(l[0]) / (sp.faceW ? lerp(0.074, sp.faceW, smooth(-0.005, -0.075, l[1])) : 0.074);
      const face = Math.max((l[2] > zc ? fx - 1 : Math.hypot(fx, (l[2] - zc) / 0.068) - 1) * 0.07, l[1] - 0.074);
      const end = sp.hang - 0.025 * smooth(0.04, -0.08, l[2]) - l[1];       // longer at the back
      // (front: beside the face the curtain stops there, a little further forward toward its ends)
      k = Math.min(k, sp.front !== undefined ? Math.max(-face, end, l[2] - sp.front - 0.02 * smooth(-0.05, -0.2, l[1])) : Math.max(-face, end));
    }
    return k;
  }
}

export interface HairBuild { sdf: HairSdf; sp: HairSpec; box: [V3, V3]; flow(p: V3): V3; headW(p: V3): number[] }

export function buildHairVolume(rig: Rig, look: Look): HairBuild | null {
  const hf = rig.head, sp = hairSpec(look.hair, rig.male);
  if (!sp) return null;
  const F = rig.field;
  const H = F.subset((i) => F.bone[i] === B.head);
  const C = F.subset((i) => [B.neck, B.chest, B.clavL, B.clavR, B.spine, B.armL, B.armR].includes(F.bone[i]));
  let hang: ((x: number, y: number, z: number) => number) | null = null;
  if (sp.hang !== null) {
    // the curtain: the head's own oval carried down from the ears, a little fuller as it falls, rounding and turning
    // under at the ends (a bob), or swelling into a rounded mass (curls)
    // (flowing: closer to the head, 0.092 at the ears, and starting lower, at the brow, where the shell hands over)
    const c = hf.toBody([0, -0.01, -0.045]), rx0 = sp.flowing ? 0.079 * hf.sx + sp.side * 0.9 : 0.08 * hf.sx + sp.side + 0.004, rz0 = sp.flowing ? 0.094 * hf.sz + sp.back * 0.9 : 0.098 * hf.sz + sp.back + 0.004;
    const yTop = hf.toBody([0, sp.flowing ? 0.05 : 0.04, 0])[1], yEnd = hf.toBody([0, sp.hang, 0])[1], span = Math.max(0.05, yTop - yEnd);
    const curl = sp.tex === 'curl';
    // (flowing) the front limit beside the face, head-local z by head-local y: behind the forehead's corner at the temple,
    // forward onto the cheekbone's side at the cheek, back again down the neck to lie behind the shoulder's ridge
    const ZF: [number, number][] = [[0.05, -0.024], [0.0, -0.018], [-0.045, -0.008], [-0.09, -0.012], [-0.125, -0.04], [-0.16, -0.055], [-0.22, -0.06], [-0.6, -0.07]];
    const zFront = (ly: number) => { for (let i = 0; i < ZF.length - 1; i++) if (ly >= ZF[i + 1][0]) { const u = clamp((ZF[i][0] - ly) / (ZF[i][0] - ZF[i + 1][0])); return lerp(ZF[i][1], ZF[i + 1][1], u * u * (3 - 2 * u)); } return ZF[ZF.length - 1][1]; };
    if (sp.flowing) hang = (x, y, z) => {
      const t = clamp((yTop - y) / span, 0, 1.2), ly = (y - hf.o[1]) / hf.sy, lz = (z - hf.o[2]) / hf.sz;
      const ang = Math.atan2(x, z - c[2]);
      const swell = (1 + (sp.vol ?? 0.06) * smooth(0.1, 0.75, t)) * (sp.wave ? 1 + sp.wave * smooth(0.1, 0.35, t) * Math.sin(ang * 6 + (yTop - y) * 30 + 1.3 * Math.sin((yTop - y) * 11 + ang * 2)) : 1);
      // close to the head at its top (inside the shell: no brim), filling out below the ears; the ends turn under a little
      const under = lerp(0.86, 1, smooth(0.0, 0.05, t)) * (1 - 0.14 * smooth(0.8, 1.05, t));
      const fx = rx0 * swell * under, fz = rz0 * swell * under;
      const col = (Math.hypot(x / fx, (z - c[2]) / fz) - 1) * Math.min(fx, fz);
      const fr = (lz - zFront(ly)) * hf.sz;
      // a rounded front end (a smooth maximum of the column and the front limit)
      const k = 0.014, h = clamp(0.5 - 0.5 * (fr - col) / k);
      let d = lerp(fr, col, h) + k * h * (1 - h);
      // a horseshoe, not a solid column: hollow inside (4 cm of hair round the head and the neck), so under the chin there
      // is air between the two sides, not a wall of hair in front of the throat
      const ix = fx - 0.04, iz = fz - 0.04, inner = (1 - Math.hypot(x / ix, (z - c[2]) / iz)) * Math.min(ix, iz);
      const k2 = 0.01, h2 = clamp(0.5 - 0.5 * (inner - d) / k2);
      d = lerp(inner, d, h2) + k2 * h2 * (1 - h2);
      return Math.max(d, y - yTop - 0.012);
    };
    else hang = (x, y, z) => {
      const t = clamp((yTop - y) / span, 0, 1.2);
      const swell = curl ? 1 + 0.14 * Math.sin(Math.PI * Math.min(1, t * 0.9)) : (1 + (sp.vol ?? 0.06) * t) * (sp.wave ? 1 + sp.wave * smooth(0.12, 0.4, t) * Math.sin(Math.atan2(x, z - c[2]) * 8 + (yTop - y) * 34 + 1.3 * Math.sin((yTop - y) * 11)) : 1);
      // (vol: the curtain lies close to the head at its top and fills out below the ears, so its top is no brim)
      const under = (curl ? 1 - 0.55 * smooth(0.45, 1.1, t) ** 1.5 : 1 - 0.12 * smooth(0.82, 1.05, t)) * (sp.vol ? lerp(0.84, 1, smooth(0.02, 0.3, t)) : 1);   // the ends turn under; curls round off into a mass
      const fx = rx0 * swell * under, fz = rz0 * swell * under;
      const r = Math.hypot(x / fx, (z - c[2]) / fz);
      return Math.max((r - 1) * Math.min(fx, fz), y - yTop - 0.03);
    };
  }
  const sdf = new HairSdf(hf, sp, H, C, hang, look.hair);
  const lo = hf.toBody([-0.13, sp.hang !== null ? sp.hang - 0.08 : sp.tailEnd ? sp.tailEnd[1] - 0.05 : sp.tail ? -0.24 : -0.14, sp.tailEnd ? Math.min(-0.24, sp.tailEnd[2] - 0.05) : -0.24]), hi = hf.toBody([0.13, 0.15, 0.1]);
  const flow = (p: V3): V3 => {
    const l = hf.toLocal(p), f = flowAt(sp, l);
    return norm([f[0] * hf.sx, f[1] * hf.sy, f[2] * hf.sz]);
  };
  // skinning: the head bone above the jaw, then the neck, then the chest for hair lying on the back
  const headW = (p: V3) => {
    const l = hf.toLocal(p);
    const h = smooth(-0.2, -0.1, l[1]), n = (1 - h) * smooth(-0.32, -0.2, l[1]);
    return [h, n, 1 - h - n];
  };
  return { sdf, sp, box: [lo, hi], flow, headW };
}

/** strand cards grown over the volume's outer surface along the flow */
export function growCards(hb: HairBuild, roots: V3[], quality: Quality, seed: number, edgeRoots: V3[] = []) {
  const sdf = hb.sdf, sp = hb.sp, r = rng(seed * 101 + 7);
  const n = Math.min(roots.length, Math.round(sp.cards * (quality === 'high' ? 1 : 0.55)));
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], skin: number[][] = [], flowA: number[] = [];
  const grad = (p: V3): V3 => {
    const e = 0.0008, f0 = sdf.eval(p[0], p[1], p[2], null, 0);
    return norm([sdf.eval(p[0] + e, p[1], p[2], null, 0) - f0, sdf.eval(p[0], p[1] + e, p[2], null, 0) - f0, sdf.eval(p[0], p[1], p[2] + e, null, 0) - f0]);
  };
  const step = sp.cardStep ?? 0.011;
  for (let c = 0; c < n; c++) {
    let p = roots[Math.floor(r.next() * roots.length)].slice() as V3;
    const off = -0.0015 + r.next() * (sp.bun || sp.tail ? 0.0022 : 0.0035);   // some under the surface, some proud (pulled-back hair lies flatter)
    const maxLen = sp.cardLen !== undefined ? sp.cardLen * (0.6 + 0.4 * r.next()) : sp.hang !== null ? 0.6 : sp.tail ? 0.05 + r.next() * 0.04 : sp.bun ? 0.08 + r.next() * 0.08 : sp.curl ? 0.035 + r.next() * 0.03 : 0.05 + r.next() * 0.04;
    const w = sp.cardW * (0.7 + 0.6 * r.next());
    const pts: { p: V3; s: V3; n: V3 }[] = [];
    let len = 0, over = 0;
    const overMax = sp.fringe ? 0.014 * r.next() : 0;
    for (let k = 0; k < 64 && len < maxLen; k++) {
      const nn = grad(p);
      let d = hb.flow(p);
      if (sp.curl) { const a = r.next() * 6.28; d = norm([d[0] + Math.cos(a) * 0.6, d[1] + Math.sin(a) * 0.6, d[2] + Math.sin(a * 2) * 0.4]); }
      d = norm([d[0] - nn[0] * dot(d, nn), d[1] - nn[1] * dot(d, nn), d[2] - nn[2] * dot(d, nn)]);
      const sd = norm(cross(nn, d));
      pts.push({ p: p.slice() as V3, s: sd, n: nn });
      // (a fringe carries on past the hairline for a little, standing a few millimetres off the skin)
      if (sdf.keep(p[0], p[1], p[2]) > 0.004 && k > 0) { if (over >= overMax) break; over += step; }
      p = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step];
      // back onto the surface (at the card's own depth)
      for (let it = 0; it < 2; it++) { const f = sdf.eval(p[0], p[1], p[2], null, 0) - off - (over > 0 ? 0.0035 : 0), g = grad(p); p = [p[0] - g[0] * f, p[1] - g[1] * f, p[2] - g[2] * f]; }
      len += step;
    }
    if (pts.length < 2) continue;
    const base = pos.length / 3, u0 = r.next(), m = pts.length;
    for (let k = 0; k < m; k++) {
      const t = k / (m - 1), ww = w * (1 - 0.55 * t) * 0.5, q = pts[k];
      const lift = 0.0012 * t;
      for (const sgn of [-1, 1]) {
        pos.push(q.p[0] + q.s[0] * ww * sgn + q.n[0] * lift, q.p[1] + q.s[1] * ww * sgn + q.n[1] * lift, q.p[2] + q.s[2] * ww * sgn + q.n[2] * lift);
        uv.push(u0 + (sgn > 0 ? 0.12 : 0), t * (0.85 + 0.15 * (m / 12)));
        skin.push(hb.headW(q.p));
        const f = hb.flow(q.p); flowA.push(f[0], f[1], f[2]);
      }
    }
    for (let k = 0; k < m - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  // fine short hairs along the hairline, combed the same way: they break the cap's edge up into strands
  if (edgeRoots.length) for (let c = 0; c < (quality === 'high' ? 0 : 0); c++) {
    let p = edgeRoots[Math.floor(r.next() * edgeRoots.length)].slice() as V3;
    const m = 6, base = pos.length / 3, u0 = r.next(), w = 0.003 + 0.002 * r.next(), L = 0.012 + 0.018 * r.next();
    for (let k = 0; k < m; k++) {
      const t = k / (m - 1), nn = grad(p);
      let d = hb.flow(p);
      d = norm([d[0] - nn[0] * dot(d, nn), d[1] - nn[1] * dot(d, nn), d[2] - nn[2] * dot(d, nn)]);
      const sd = norm(cross(nn, d)), lift = 0.0006 + 0.0008 * t;
      for (const sgn of [-1, 1]) {
        const ww = w * 0.5 * sgn;
        pos.push(p[0] + sd[0] * ww + nn[0] * lift, p[1] + sd[1] * ww + nn[1] * lift, p[2] + sd[2] * ww + nn[2] * lift);
        uv.push(u0 + (sgn > 0 ? 0.06 : 0), 0.1 + 0.85 * t); skin.push(hb.headW(p)); flowA.push(d[0], d[1], d[2]);
      }
      p = [p[0] + d[0] * L / (m - 1), p[1] + d[1] * L / (m - 1), p[2] + d[2] * L / (m - 1)];
      const f = sdf.eval(p[0], p[1], p[2], null, 0), g = grad(p); p = [p[0] - g[0] * f, p[1] - g[1] * f, p[2] - g[2] * f];
    }
    for (let k = 0; k < m - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  // loose strands framing the face (updos): from the temples down past the cheekbones toward the jaw
  if (sp.framing) {
    const hf = sdf.hf;
    for (const sg of [1, -1]) for (let j = 0; j < (quality === 'high' ? 4 : 2); j++) {
      const x0 = 0.054 + 0.01 * r.next(), y0 = 0.034 + 0.014 * r.next(), z0 = -0.002 - 0.02 * r.next();
      const L = 0.1 + 0.07 * r.next(), ph = r.next() * 6.28, amp = 0.004 + 0.003 * r.next();
      for (let c = 0; c < (quality === 'high' ? 3 : 2); c++) {
        const m = 12, base = pos.length / 3, u0 = r.next(), w = 0.011 + 0.005 * r.next(), dx = (c - 1) * 0.003, dz = (r.next() - 0.5) * 0.004;
        for (let k = 0; k < m; k++) {
          const t = k / (m - 1), wave = Math.sin(t * 7 + ph + c * 0.8) * amp * t;
          // falls from the temple, curving forward round the cheekbone, the ends lifting off the skin
          const l: V3 = [sg * (x0 + dx + 0.006 * t + wave), y0 - L * t, z0 + dz + 0.016 * Math.sin(t * 2.6) + 0.006 * t];
          for (const s2 of [-1, 1]) {
            const ww = w * 0.5 * (1 - 0.6 * t) * s2;
            // the card's width runs forward and out (seen from the front it reads as a lock, not an edge)
            let q = hf.toBody([l[0] + sg * ww * 0.55, l[1], l[2] + ww * 0.85]);
            const want = 0.002 + 0.006 * t;
            for (let it = 0; it < 3; it++) { const f = sdf.eval(q[0], q[1], q[2], null, 0); if (f >= want) break; const g = grad(q); q = [q[0] + g[0] * (want - f), q[1] + g[1] * (want - f), q[2] + g[2] * (want - f)]; }
            pos.push(q[0], q[1], q[2]); uv.push(u0 + (s2 > 0 ? 0.14 : 0), t * 0.9); skin.push([1, 0, 0]);
            flowA.push(0, -1, 0);
          }
        }
        for (let k = 0; k < m - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      }
    }
  }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx, skin, flow: new Float32Array(flowA) };
}

/** the cap's material: hair colour with streaks along the flow and Kajiya-Kay highlights along it */
export function hairCapMaterial(look: Look, quality: Quality) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, alphaTest: 0.5, envMapIntensity: 0.35 });
  const u = { uCol: { value: new THREE.Color(look.hairColor) }, uGrey: { value: look.grey }, uGreyCol: { value: new THREE.Color(0xc4c0b8) }, uCurl: { value: look.hair === 'curlsMedium' || look.hair === 'curlsUnderCap' ? 2 : look.hair === 'curly' ? 1 : 0 },   // (2: the pack's big curls, graphics pass 2026-11-15)
    // (pack) lighter streaks toward the ends; uTip 0 (no hairTips): one colour, exactly as before
    uTipCol: { value: new THREE.Color(look.hairTips ?? look.hairColor) }, uTip: { value: look.hairTips != null ? 1 : 0 } };
  m.customProgramCacheKey = () => 'haircap-' + quality;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute vec3 aFlow; attribute float aAo; attribute float aEdge;\nvarying vec3 vRest; varying vec3 vFlowR; varying vec3 vFlowV; varying float vAo; varying float vEdge; varying float vTip;')
      .replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
vec3 flowO = aFlow;
#ifdef USE_SKINNING
flowO = ( skinMatrix * vec4( aFlow, 0.0 ) ).xyz;
#endif
vFlowV = normalize( normalMatrix * flowO ); vFlowR = aFlow; vRest = aRest; vAo = fract(aAo * 0.5) * 2.0; vTip = floor(aAo * 0.5) / 100.0; vEdge = aEdge;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRest; varying vec3 vFlowR; varying vec3 vFlowV; varying float vAo; varying float vEdge; varying float vTip;\nuniform vec3 uCol; uniform float uGrey; uniform vec3 uGreyCol; uniform float uCurl; uniform vec3 uTipCol; uniform float uTip;\nfloat gS1 = 0.5, gS3 = 0.5;\n${NOISE}`)
      .replace('#include <lights_physical_pars_fragment>', hairLights(0.7))   // 1.3 summed over a patio's many string lights into a pale sheen
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 hp = vRest * 1000.0, f = normalize(vFlowR);
// (big curls, uCurl 2) the strands wind: the streaks' direction swirls from clump to clump instead of running straight
if (uCurl > 1.5) f = normalize(f + 3.0 * (vec3(vnoise(hp * 0.035 + 3.0), vnoise(hp * 0.035 + 11.0), vnoise(hp * 0.035 + 19.0)) - 0.5));
vec3 q = hp - f * dot(hp, f) * 0.97;          // squash the noise along the flow: streaks
float s1 = vnoise(q * 1.1), s2 = vnoise(q * 0.35 + 4.0), s3 = vnoise(q * 3.0 + 9.0);
float strand = 0.4 + 0.45 * s1 + 0.3 * s2 + 0.2 * s3;
gS1 = s1; gS3 = s3;
float big = step(1.5, uCurl);
// (big curls: the curls' outer turns, where the baked occlusion is open, carry the lighter tips)
vec3 c = mix(uCol, uTipCol, clamp(uTip * (smoothstep(0.42, 0.8, s2) * (0.35 + 0.65 * s1) + big * 0.5 * vTip * (0.3 + 0.7 * s1)), 0.0, 1.0)) * strand;
// greying (2026-11-12): fine grey strands, the noise at strand scale along the flow, softened at its threshold, and
// their mean share where they are smaller than a pixel. (A hard step on a coarse noise drew 3 mm black and white
// patches: a zebra at close range and a speckle at game distance.) With no grey it adds nothing, as before
float gn = vnoise(q * 2.6 + 17.0);
float gSel = smoothstep(1.0 - uGrey - 0.12, 1.0 - uGrey + 0.12, gn);
gSel = mix(gSel, uGrey, smoothstep(0.35, 1.2, length(fwidth(q * 2.6))));
c = mix(c, uGreyCol * (0.75 + 0.3 * s1), gSel * step(0.001, uGrey));
c *= mix(0.55 + 0.45 * vAo, 0.32 + 0.68 * smoothstep(0.3, 1.0, vAo), big);   // (big curls: deep shade between the clumps)
diffuseColor.rgb = c;
// the hairline: thinning strands, cut on strand-shaped noise (a hard edge in streaks, not a dither) and lighter
// where the hair is thin over the skin
float thinH = smoothstep(0.0, 0.7, vEdge);
c *= mix(1.35, 1.0, thinH);
diffuseColor.rgb = c;
diffuseColor.a = vEdge * 1.5 - 0.2 + mix(0.6 * (s1 - 0.5) + 0.45 * (s3 - 0.5), 0.9 * (vnoise(hp * 0.1 + 5.0) - 0.5), big);   // (big curls: the edge in locks, not in single strands)`)
      .replace('#include <lights_fragment_begin>', `gHairT = normalize(vFlowV); gHairSpec = mix(vec3(1.0, 0.95, 0.9), diffuseColor.rgb * 3.0, 0.6) * (0.25 + 1.1 * gS1 * gS3) * (1.0 - 0.8 * min(uCurl, 1.0)); gHairShift = 0.0;
#include <lights_fragment_begin>`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= vAo; reflectedLight.indirectSpecular *= vAo * 0.6;`);
  };
  return m;
}

// ------------------------------------------------------------------------------------------------ (cast) a full beard
/** (cast, 2026-11-11) FacialHair 'fullBeard': a short hair shell (the head's surface offset by `thick`) over the beard
 *  area of the face masks, clipped at its edge (the cap shader thins the edge into strands). Skinned to the head
 *  bone; it does not follow the mouth's morphs, so a wide-open mouth can show the chin through it. */
export class BeardSdf implements Sdf {
  n: number; maxK: number;
  private buf: Int32Array;
  // the beard mask sampled once on a 4 mm grid (head-local) and blurred: the face masks' sideburn and moustache edges
  // are hard steps, which as a thickness made walls; blurred, the shell tapers out over about a centimetre
  private grid: Float32Array; private lo: V3 = [-0.1, -0.2, -0.11]; private step = 0.004; private dim: [number, number, number];
  constructor(public hf: HeadFrame, public H: Field, public t: number, public look: Look) {
    this.n = H.n; this.maxK = H.maxK; this.buf = new Int32Array(H.n);
    const st = this.step, nx = Math.round(0.2 / st) + 1, ny = Math.round(0.21 / st) + 1, nz = Math.round(0.23 / st) + 1;
    this.dim = [nx, ny, nz];
    let g = new Float32Array(nx * ny * nz);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[i + nx * (j + ny * k)] = faceMasks([this.lo[0] + i * st, this.lo[1] + j * st, this.lo[2] + k * st], hf, look).beard;
    for (let pass = 0; pass < 2; pass++) for (let ax = 0; ax < 3; ax++) {
      const o = new Float32Array(g.length), d = [1, nx, nx * ny][ax], n = this.dim[ax];
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const c = [i, j, k][ax], id = i + nx * (j + ny * k);
        o[id] = (g[id] * 2 + g[c > 0 ? id - d : id] + g[c < n - 1 ? id + d : id]) / 4;
      }
      g = o;
    }
    this.grid = g;
  }
  /** the blurred beard mask at a body point (0 outside the grid) */
  mask(x: number, y: number, z: number) {
    const l = this.hf.toLocal([x, y, z]), [nx, ny, nz] = this.dim, st = this.step;
    const fx = (l[0] - this.lo[0]) / st, fy = (l[1] - this.lo[1]) / st, fz = (l[2] - this.lo[2]) / st;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return 0;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), u = fx - i, v = fy - j, w = fz - k, g = this.grid;
    const at = (a: number, b: number, c: number) => g[a + nx * (b + ny * c)];
    const L = (a: number, b: number, t: number) => a + (b - a) * t;
    return L(L(L(at(i, j, k), at(i + 1, j, k), u), L(at(i, j + 1, k), at(i + 1, j + 1, k), u), v), L(L(at(i, j, k + 1), at(i + 1, j, k + 1), u), L(at(i, j + 1, k + 1), at(i + 1, j + 1, k + 1), u), v), w);
  }
  prim(i: number, x: number, y: number, z: number) { return this.H.prim(i, x, y, z) - this.t - 0.004; }
  /** the thickness here: full inside the beard, tapering to nothing toward its edge (no ledge) */
  thickAt(x: number, y: number, z: number) {
    // (2026-11-12) thinner up the sideburns toward the ears: at full thickness there they stood off the face as flaps
    // beside the cheeks in the head renders (tests/out/cast/beard-*.png)
    const ly = this.hf.toLocal([x, y, z])[1];
    return this.t * smooth(0.15, 0.8, this.mask(x, y, z)) * (1 - 0.75 * smooth(-0.075, -0.02, ly));
  }
  eval(x: number, y: number, z: number, act: Int32Array | null, nAct: number) {
    if (!act) return this.H.eval(x, y, z, null, 0) - this.thickAt(x, y, z);
    let n = 0;
    for (let j = 0; j < nAct; j++) if (act[j] < this.H.n) this.buf[n++] = act[j];
    return n ? this.H.eval(x, y, z, this.buf, n) - this.thickAt(x, y, z) : 1e9;
  }
  /** < 0 where the beard grows */
  keep(x: number, y: number, z: number) { return (0.32 - this.mask(x, y, z)) * 0.03; }
}
export function buildBeardVolume(rig: Rig, look: Look) {
  if (look.facialHair !== 'fullBeard' || !rig.male) return null;
  const hf = rig.head, F = rig.field;
  const H = F.subset((i) => F.bone[i] === B.head);
  const sdf = new BeardSdf(hf, H, 0.004, look);   // 4 mm (5.5 mm read as a mask over the jaw)
  const box: [V3, V3] = [hf.toBody([-0.1, -0.2, -0.11]), hf.toBody([0.1, 0.01, 0.12])];
  const flow = (p: V3): V3 => {
    const l = hf.toLocal(p), must = l[1] > -0.06 && Math.abs(l[0]) < 0.03 && l[2] > 0.0;
    const f: V3 = must ? [Math.sign(l[0]) * 0.8, -0.6, 0.1] : [0.15 * Math.sign(l[0]), -1, 0.25];
    return norm([f[0] * hf.sx, f[1] * hf.sy, f[2] * hf.sz]);
  };
  const headW = (p: V3) => { const l = hf.toLocal(p), h = smooth(-0.2, -0.13, l[1]); return [h, 1 - h, 0]; };
  return { sdf, box, flow, headW };
}
