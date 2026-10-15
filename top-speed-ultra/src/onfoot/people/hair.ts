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
import { scalpCover } from './masks';
import { NOISE } from './skin';
import { hairLights } from './cards';

export interface HairSpec {
  top: number; side: number; back: number;   // shell thickness (m)
  hang: number | null;                        // head-local y the hanging hair ends at
  bun: boolean; tail: boolean; curl: number;  // curl 0..1
  part: number;                               // x of the parting (head-local)
  cards: number; cardW: number; tex: 'straight' | 'wavy' | 'curl';
  framing: boolean;                           // loose strands framing the face
}

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
  }
}

/** where the hair goes (head-local): a tangent direction field the strands follow */
// a loose bun high on the back of the crown: it shows over the head's outline from the front (at 0.078/-0.16 it hid)
const BUN_C: V3 = [0, 0.094, -0.142];
function flowAt(sp: HairSpec, l: V3): V3 {
  const [x, y, z] = l;
  if (sp.bun || sp.tail) {
    // pulled back and up to the bun / the tie
    const c: V3 = sp.bun ? BUN_C : [0, 0.02, -0.165];
    const d = norm([c[0] - x, c[1] - y, c[2] - z]);
    return d;
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
  // short styles: front to back on top, down and back at the sides
  const side = smooth(0.035, 0.07, Math.abs(x));
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
  thick(l: V3) {
    const sp = this.sp, top = smooth(-0.005, 0.07, l[1]), back = smooth(-0.04, -0.1, l[2]);
    let t = lerp(lerp(sp.side, sp.back, back), sp.top, top);
    // thinning to nothing at the hairline, so the hair grows out of the scalp instead of sitting on it like a cap
    t *= (sp.bun || sp.tail ? 0.04 : 0.2) + (sp.bun || sp.tail ? 0.96 : 0.8) * smooth(0.45, 0.98, scalpCover(this.style, l, 35 + 40 * this.hf.old, this.hf.male));   // pulled back: no ledge at the hairline
    // pulled-back styles: combed sections (soft ridges running back to the bun or the tie) and a lifted crown
    if (sp.bun || sp.tail) {
      const phi = Math.atan2(l[0], l[1] + 0.02), ridge = Math.sin(phi * 11 + 1.7 * Math.sin(l[2] * 40)) * Math.sin(phi * 5 + 0.6);
      t += (0.0018 * ridge + 0.0035 * smooth(0.0, 0.06, l[1]) * smooth(0.03, -0.04, l[2])) * smooth(0.6, 0.95, scalpCover(this.style, l, 35 + 40 * this.hf.old, this.hf.male));
    }
    else {
      const lump = Math.sin(l[0] * 95 + 2.1 * Math.sin(l[2] * 60)) * Math.sin(l[2] * 70 + 1.3 * Math.sin(l[0] * 80)) + 0.5 * Math.sin(l[0] * 210 + l[2] * 50);
      t += 0.0016 * lump * smooth(0.02, 0.07, l[1]) * smooth(0.6, 0.95, scalpCover(this.style, l, 35 + 40 * this.hf.old, this.hf.male));
    }
    if (sp.curl > 0) t += sp.curl * 0.009 * (clumps(l[0] * 70, l[1] * 70, l[2] * 70) - 0.45);
    return t;
  }
  extra(l: V3) {
    const sp = this.sp, s = this.hf.sx;
    let d = 1e9;
    if (sp.bun) { const q = [(l[0]) / 0.05, (l[1] - BUN_C[1]) / 0.042, (l[2] - BUN_C[2]) / 0.043]; d = Math.min(d, (Math.hypot(q[0], q[1], q[2]) - 1) * 0.038 * s); }
    if (sp.tail) {
      // a tie at the back of the head, then a tapered tail falling down and a little out
      const a: V3 = [0, 0.02, -0.168], b: V3 = [0, -0.2, -0.2];
      const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = clamp(dot([l[0] - a[0], l[1] - a[1], l[2] - a[2]], ab) / dot(ab, ab));
      const r = lerp(0.02, 0.009, t) * (1 + 0.25 * Math.sin(t * 3.1));
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
    if (this.hang) d = smin(d, this.hang(x, y, z), 0.025);
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
    return (0.5 - scalpCover(this.style, l, 35 + 40 * hf.old, hf.male)) * 0.03;
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
    const c = scalpCover(this.style, l, 35 + 40 * hf.old, male);
    let k = (0.5 - c) * 0.03;
    if (sp.bun || sp.tail) k = Math.min(k, this.extra(l) - 0.002);
    if (sp.hang !== null) {
      // the face: an oval column in front (hair frames it round its edge, never crosses it)
      const zc = 0.03, fx = Math.abs(l[0]) / 0.074;
      const face = Math.max((l[2] > zc ? fx - 1 : Math.hypot(fx, (l[2] - zc) / 0.068) - 1) * 0.07, l[1] - 0.074);
      const end = sp.hang - 0.025 * smooth(0.04, -0.08, l[2]) - l[1];       // longer at the back
      k = Math.min(k, Math.max(-face, end));
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
    const c = hf.toBody([0, -0.01, -0.045]), rx0 = 0.08 * hf.sx + sp.side + 0.004, rz0 = 0.098 * hf.sz + sp.back + 0.004;
    const yTop = hf.toBody([0, 0.04, 0])[1], yEnd = hf.toBody([0, sp.hang, 0])[1], span = Math.max(0.05, yTop - yEnd);
    const curl = sp.tex === 'curl';
    hang = (x, y, z) => {
      const t = clamp((yTop - y) / span, 0, 1.2);
      const swell = curl ? 1 + 0.14 * Math.sin(Math.PI * Math.min(1, t * 0.9)) : 1 + 0.06 * t;
      const under = curl ? 1 - 0.55 * smooth(0.45, 1.1, t) ** 1.5 : 1 - 0.12 * smooth(0.82, 1.05, t);   // the ends turn under; curls round off into a mass
      const fx = rx0 * swell * under, fz = rz0 * swell * under;
      const r = Math.hypot(x / fx, (z - c[2]) / fz);
      return Math.max((r - 1) * Math.min(fx, fz), y - yTop - 0.03);
    };
  }
  const sdf = new HairSdf(hf, sp, H, C, hang, look.hair);
  const lo = hf.toBody([-0.13, sp.hang !== null ? sp.hang - 0.08 : sp.tail ? -0.24 : -0.14, -0.24]), hi = hf.toBody([0.13, 0.15, 0.1]);
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
  const step = 0.011;
  for (let c = 0; c < n; c++) {
    let p = roots[Math.floor(r.next() * roots.length)].slice() as V3;
    const off = -0.0015 + r.next() * (sp.bun || sp.tail ? 0.0022 : 0.0035);   // some under the surface, some proud (pulled-back hair lies flatter)
    const maxLen = sp.hang !== null ? 0.6 : sp.tail ? 0.05 + r.next() * 0.04 : sp.bun ? 0.08 + r.next() * 0.08 : sp.curl ? 0.035 + r.next() * 0.03 : 0.05 + r.next() * 0.04;
    const w = sp.cardW * (0.7 + 0.6 * r.next());
    const pts: { p: V3; s: V3; n: V3 }[] = [];
    let len = 0;
    for (let k = 0; k < 64 && len < maxLen; k++) {
      const nn = grad(p);
      let d = hb.flow(p);
      if (sp.curl) { const a = r.next() * 6.28; d = norm([d[0] + Math.cos(a) * 0.6, d[1] + Math.sin(a) * 0.6, d[2] + Math.sin(a * 2) * 0.4]); }
      d = norm([d[0] - nn[0] * dot(d, nn), d[1] - nn[1] * dot(d, nn), d[2] - nn[2] * dot(d, nn)]);
      const sd = norm(cross(nn, d));
      pts.push({ p: p.slice() as V3, s: sd, n: nn });
      if (sdf.keep(p[0], p[1], p[2]) > 0.004 && k > 0) break;
      p = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step];
      // back onto the surface (at the card's own depth)
      for (let it = 0; it < 2; it++) { const f = sdf.eval(p[0], p[1], p[2], null, 0) - off, g = grad(p); p = [p[0] - g[0] * f, p[1] - g[1] * f, p[2] - g[2] * f]; }
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
  const u = { uCol: { value: new THREE.Color(look.hairColor) }, uGrey: { value: look.grey }, uGreyCol: { value: new THREE.Color(0xc4c0b8) }, uCurl: { value: look.hair === 'curly' ? 1 : 0 } };
  m.customProgramCacheKey = () => 'haircap-' + quality;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute vec3 aFlow; attribute float aAo; attribute float aEdge;\nvarying vec3 vRest; varying vec3 vFlowR; varying vec3 vFlowV; varying float vAo; varying float vEdge;')
      .replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
vec3 flowO = aFlow;
#ifdef USE_SKINNING
flowO = ( skinMatrix * vec4( aFlow, 0.0 ) ).xyz;
#endif
vFlowV = normalize( normalMatrix * flowO ); vFlowR = aFlow; vRest = aRest; vAo = aAo; vEdge = aEdge;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRest; varying vec3 vFlowR; varying vec3 vFlowV; varying float vAo; varying float vEdge;\nuniform vec3 uCol; uniform float uGrey; uniform vec3 uGreyCol; uniform float uCurl;\nfloat gS1 = 0.5, gS3 = 0.5;\n${NOISE}`)
      .replace('#include <lights_physical_pars_fragment>', hairLights(0.7))   // 1.3 summed over a patio's many string lights into a pale sheen
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 hp = vRest * 1000.0, f = normalize(vFlowR);
vec3 q = hp - f * dot(hp, f) * 0.97;          // squash the noise along the flow: streaks
float s1 = vnoise(q * 1.1), s2 = vnoise(q * 0.35 + 4.0), s3 = vnoise(q * 3.0 + 9.0);
float strand = 0.4 + 0.45 * s1 + 0.3 * s2 + 0.2 * s3;
gS1 = s1; gS3 = s3;
vec3 c = uCol * strand;
float g = step(1.0 - uGrey, vnoise(q * 0.9 + 17.0));
c = mix(c, uGreyCol * (0.75 + 0.3 * s1), g);
c *= 0.55 + 0.45 * vAo;
diffuseColor.rgb = c;
// the hairline: thinning strands, cut on strand-shaped noise (a hard edge in streaks, not a dither) and lighter
// where the hair is thin over the skin
float thinH = smoothstep(0.0, 0.7, vEdge);
c *= mix(1.35, 1.0, thinH);
diffuseColor.rgb = c;
diffuseColor.a = vEdge * 1.5 - 0.2 + 0.6 * (s1 - 0.5) + 0.45 * (s3 - 0.5);`)
      .replace('#include <lights_fragment_begin>', `gHairT = normalize(vFlowV); gHairSpec = mix(vec3(1.0, 0.95, 0.9), diffuseColor.rgb * 3.0, 0.6) * (0.25 + 1.1 * gS1 * gS3) * (1.0 - 0.8 * uCurl); gHairShift = 0.0;
#include <lights_fragment_begin>`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= vAo; reflectedLight.indirectSpecular *= vAo * 0.6;`);
  };
  return m;
}
