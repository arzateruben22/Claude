// Clothes as shells generated from the body: each garment is the body's distance field (only the parts it covers)
// offset outward by the garment's ease, smooth-unioned with a hanging "drape" profile (cloth falls from the widest
// point above instead of following every hollow: under the bust, under a belly, the small of the back, between the
// legs for a skirt), then clipped by a region (hems, sleeves, necklines, straps, an open front). Because the shell is
// made from the same body, it is sized to it: a heavy body's shirt is a heavy body's shirt, nothing clips or floats.
// Shoes are the foot offset plus a sole (and a heel block for heels). A collar is a band added after the clip.
// Frame: the rest pose of body.ts (metres, y up, +z forward, +x the person's left).
import { Field, Sdf, smin } from './field';
import { Rig, B } from './body';
import { Garment, GarmentKind, BodyShape } from './params';
import { V3, clamp, lerp, mirror, norm, smooth, DEG } from './math';

export type Region = (x: number, y: number, z: number) => number;   // < 0 inside (kept)

const SHOES: GarmentKind[] = ['sneakers', 'boots', 'heels', 'loafers', 'flats'];
const BOTTOMS: GarmentKind[] = ['jeans', 'trousers', 'skirt', 'shorts'];
const OUTER: GarmentKind[] = ['jacket', 'leather', 'blazer', 'cardigan'];
export const isShoe = (k: GarmentKind) => SHOES.includes(k);

/** a hanging profile: superellipse slices (centre z, half depth, half width) stacked in y */
export class Drape {
  constructor(public yLo: number, public dy: number, public zc: Float64Array, public rd: Float64Array, public rw: Float64Array, public p: number) {}
  get yHi() { return this.yLo + this.dy * (this.zc.length - 1); }
  d(x: number, y: number, z: number) {
    const n = this.zc.length, f = clamp((y - this.yLo) / this.dy, 0, n - 1.0001), i = Math.floor(f), t = f - i;
    const zc = this.zc[i] + (this.zc[i + 1] - this.zc[i]) * t, rd = this.rd[i] + (this.rd[i + 1] - this.rd[i]) * t, rw = this.rw[i] + (this.rw[i + 1] - this.rw[i]) * t;
    const ax = Math.abs(x) / rw, az = Math.abs(z - zc) / rd, p = this.p;
    const r = p === 2.5 ? Math.pow(ax * ax * Math.sqrt(ax) + az * az * Math.sqrt(az), 0.4) : Math.pow(Math.pow(ax, p) + Math.pow(az, p), 1 / p);
    return Math.max((r - 1) * Math.min(rw, rd), this.yLo - y, y - this.yHi);
  }
}

/** a garment's field: max(smin(body - t, drape), region), then a band (collar, sole) unioned on */
export class GarmentSdf implements Sdf {
  n: number; maxK: number;
  private bufA: Int32Array; private bufX: Int32Array;
  constructor(public A: Field, public t: number, public drape: Drape | null, public k: number, public region: Region, public X: Field | null = null, public kx = 0.004, public extra: Region | null = null) {
    this.n = A.n + (X ? X.n : 0) + 1;
    this.maxK = Math.max(A.maxK, X ? X.maxK : 0, k);
    this.bufA = new Int32Array(A.n); this.bufX = new Int32Array(X ? X.n : 0);
  }
  /** the extra prim (index n-1) stands for the drape, region and extra functions */
  prim(i: number, x: number, y: number, z: number) {
    if (i < this.A.n) return this.A.prim(i, x, y, z) - this.t;
    if (this.X && i < this.A.n + this.X.n) return this.X.prim(i - this.A.n, x, y, z);
    let d = this.drape ? this.drape.d(x, y, z) : 1e9;
    if (this.extra) d = Math.min(d, this.extra(x, y, z));
    return d;
  }
  shell(x: number, y: number, z: number, act: Int32Array | null, nAct: number) {
    let a: number;
    if (!act) a = this.A.eval(x, y, z, null, 0) - this.t;
    else {
      let na = 0;
      for (let j = 0; j < nAct; j++) if (act[j] < this.A.n) this.bufA[na++] = act[j];
      a = na ? this.A.eval(x, y, z, this.bufA, na) - this.t : 1e9;
    }
    if (this.drape) a = smin(a, this.drape.d(x, y, z), this.k);
    return a;
  }
  /** the surface that is meshed: the shell (and soles, heels); the region clips it afterwards */
  eval(x: number, y: number, z: number, act: Int32Array | null, nAct: number) {
    let d = this.shell(x, y, z, act, nAct);
    if (this.extra) d = smin(d, this.extra(x, y, z), this.kx);
    if (this.X) {
      let nx = 0;
      if (act) { for (let j = 0; j < nAct; j++) { const i = act[j] - this.A.n; if (i >= 0 && i < this.X.n) this.bufX[nx++] = i; } }
      const xd = act ? (nx ? this.X.eval(x, y, z, this.bufX, nx) : 1e9) : this.X.eval(x, y, z, null, 0);
      d = smin(d, xd, this.kx);
    }
    return d;
  }
}

export interface GarmentBuild {
  g: Garment;
  layer: number;
  sdf: GarmentSdf;
  keep: Region;
  /** body bones it hides when the body is inside its region */
  bones: Set<number>;
  box: [V3, V3];
  sigma: number;
  /** 0..1: the second colour (soles, a collar's trim) */
  accent: Region | null;
  /** creases: joint points, the limb axis there, radius, strength */
  folds: { c: V3; ax: V3; r: number; w: number }[];
  /** 0..1 lighter wear (denim on the thighs and knees) */
  wear: ((p: V3) => number) | null;
  h: number;   // meshing step on 'high'
  /** a lofted collar (rows of points round the neck), weighted between the chest and the neck */
  collar?: { pos: Float32Array; idx: number[]; neckW: Float32Array; edge: Float32Array };
}

/** a shirt or polo collar: a standing band from the neckline and a leaf folded down over it, as a lofted strip,
 *  pushed out of the shirt wherever it would sink in */
function collarLoft(rig: Rig, shirt: GarmentSdf, open: boolean, polo: boolean) {
  const s = rig.s, ws = rig.ws, L = rig.limb, jug = rig.joints[B.neck][1];
  const nb = L.neckBase, nR = L.neckR;
  const zc = nb[2] + 0.004 * s, rx = nR + 0.012 * ws, rz = nR + 0.012 * s - 0.002;
  const front = jug - 0.002 * s, back = jug + 0.034 * s;
  const gap = open ? 0.62 : 0.2, N = 28;
  const rows: V3[][] = [[], [], [], []];
  for (let i = 0; i <= N; i++) {
    const a = lerp(gap, 2 * Math.PI - gap, i / N), sx = Math.sin(a), cz = Math.cos(a);
    const fr = (cz + 1) / 2;                       // 1 at the front, 0 at the back
    const yb = lerp(back, front, fr);
    const hb = lerp(0.03, polo ? 0.024 : 0.026, fr) * s;
    const leaf = lerp(0.036, polo ? 0.042 : 0.052, fr * fr) * s, out = lerp(0.02, open ? 0.04 : 0.03, fr * fr) * s;
    const R = (dr: number, y: number): V3 => [sx * (rx + dr), y, zc + cz * (rz + dr)];
    rows[0].push(R(-0.001, yb - 0.004 * s));
    rows[1].push(R(0.002, yb + hb));
    rows[2].push(R(0.008 * s, yb + hb + 0.003 * s));
    // the leaf's edge: down and out; at the front the points spread toward the shoulders
    const pt = fr > 0.75 ? (fr - 0.75) / 0.25 : 0;
    const e = R(out, yb + hb - leaf);
    e[0] += Math.sign(sx) * pt * 0.012 * s;
    rows[3].push(e);
  }
  // push the leaf (rows 2, 3) out of the shirt
  for (const r of [2, 3]) for (const p of rows[r]) {
    for (let it = 0; it < 3; it++) {
      const d = shirt.shell(p[0], p[1], p[2], null, 0);
      if (d > 0.004) break;
      const e = 0.001, gx = shirt.shell(p[0] + e, p[1], p[2], null, 0) - d, gy = shirt.shell(p[0], p[1] + e, p[2], null, 0) - d, gz = shirt.shell(p[0], p[1], p[2] + e, null, 0) - d;
      const n = norm([gx, gy, gz]), k = 0.0045 - d;
      p[0] += n[0] * k; p[1] += n[1] * k; p[2] += n[2] * k;
    }
  }
  const pos = new Float32Array(4 * (N + 1) * 3), neckW = new Float32Array(4 * (N + 1)), edge = new Float32Array(4 * (N + 1));
  for (let r = 0; r < 4; r++) for (let i = 0; i <= N; i++) {
    const v = r * (N + 1) + i;
    pos.set(rows[r][i], v * 3);
    neckW[v] = [0.35, 0.7, 0.7, 0.45][r];
    edge[v] = r === 3 || r === 0 || i === 0 || i === N ? 0.004 : 0.012;
  }
  const idx: number[] = [];
  for (let r = 0; r < 3; r++) for (let i = 0; i < N; i++) { const a = r * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, d, a, d, b); }
  return { pos, idx, neckW, edge };
}

const inter = (...rs: Region[]): Region => (x, y, z) => { let d = -1e9; for (const r of rs) { const v = r(x, y, z); if (v > d) d = v; } return d; };
export const union = (...rs: Region[]): Region => (x, y, z) => { let d = 1e9; for (const r of rs) { const v = r(x, y, z); if (v < d) d = v; } return d; };
const not = (r: Region): Region => (x, y, z) => -r(x, y, z);
const below = (y0: number): Region => (_x, y) => y - y0;
const above = (y0: number): Region => (_x, y) => y0 - y;

/** trace from outside along a direction until the surface (sphere tracing; the fields underestimate, so it is safe) */
function trace(f: Field, o: V3, d: V3, maxT: number) {
  let t = 0;
  for (let i = 0; i < 48; i++) {
    const v = f.eval(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t, null, 0);
    if (v < 0.0008) return t;
    t += Math.max(v, 0.001);
    if (t > maxT) return -1;
  }
  return t;
}

/** body extents at a level: front z, back z, half width */
function extents(f: Field, y: number, ws: number) {
  let front = -1, back = 1, side = 0;
  for (const x of [0, 0.03 * ws, 0.06 * ws, 0.09 * ws, -0.03 * ws, -0.06 * ws, -0.09 * ws]) {
    const tf = trace(f, [x, y, 0.5], [0, 0, -1], 0.9); if (tf >= 0) front = Math.max(front, 0.5 - tf);
    const tb = trace(f, [x, y, -0.5], [0, 0, 1], 0.9); if (tb >= 0) back = Math.min(back, -0.5 + tb);
  }
  if (front < back) return null;
  const zc = (front + back) / 2;
  for (const dz of [0, 0.25, -0.25]) {
    const z = zc + dz * (front - back);
    const ts = trace(f, [0.5, y, z], [-1, 0, 0], 0.5); if (ts >= 0) side = Math.max(side, 0.5 - ts);
  }
  return { front, back, side };
}

/** a drape that hangs from what is above it: drape(y) 0 follows the body, 1 falls straight from the widest point */
function makeDrape(f: Field, yLo: number, yHi: number, ws: number, ease: number, drapeAt: (y: number) => number, flare = 0, flareFrom = yHi, p = 2.5) {
  const dy = 0.015, n = Math.max(2, Math.ceil((yHi - yLo) / dy) + 1);
  const zc = new Float64Array(n), rd = new Float64Array(n), rw = new Float64Array(n);
  let mf = -1, mb = 1, ms = 0;
  let last = { front: 0.05, back: -0.05, side: 0.1 };
  for (let i = n - 1; i >= 0; i--) {
    const y = yLo + i * dy;
    const e = extents(f, y, ws) ?? last;
    last = e;
    mf = Math.max(mf, e.front); mb = Math.min(mb, e.back); ms = Math.max(ms, e.side);
    const dr = drapeAt(y), fl = flare * Math.max(0, flareFrom - y);
    const front = lerp(e.front, mf, dr) + ease + fl * 0.7, back = lerp(e.back, mb, dr) - ease - fl * 0.7;
    const side = lerp(e.side, ms, dr * 0.75) + ease + fl;
    zc[i] = (front + back) / 2; rd[i] = Math.max(0.02, (front - back) / 2); rw[i] = Math.max(0.03, side);
  }
  return new Drape(yLo, dy, zc, rd, rw, p);
}

/** the garments for an outfit, inner layers first */
export function buildGarments(rig: Rig, body: BodyShape, outfit: Garment[]): GarmentBuild[] {
  const s = rig.s, ws = rig.ws, D = rig.dims, L = rig.limb, J = rig.joints, F = rig.field;
  const fatT = rig.fat.T;
  const jug = J[B.neck][1];
  const out: GarmentBuild[] = [];
  const bonesOf = (names: (keyof typeof B)[]) => new Set(names.map((n) => B[n]));
  const TORSO = ['hips', 'spine', 'chest', 'neck', 'clavL', 'clavR'] as (keyof typeof B)[];
  const ARMS = ['armL', 'foreL', 'armR', 'foreR'] as (keyof typeof B)[];
  const LEGS = ['thighL', 'shinL', 'thighR', 'shinR'] as (keyof typeof B)[];
  const sub_ = (bones: Set<number>) => F.subset((i) => bones.has(F.bone[i]));
  const torsoOnly = sub_(bonesOf(['hips', 'spine', 'chest', 'neck', 'clavL', 'clavR', 'thighL', 'thighR']));
  const lr = (fn: (sg: number) => Region): Region => (x, y, z) => (x >= 0 ? fn(1)(x, y, z) : fn(-1)(x, y, z));

  // ---- arm geometry (left; mirrored)
  const Larm = D.upperArm + D.foreArm;
  // the armpit plane moves out with the fat: a heavy flank bulges past it and a short sleeve's cut opened a hole there
const armpitL: V3 = [D.chestHalf + 0.004 + 0.8 * rig.fat.T, D.shoulderY - 0.1 * s, -0.025 * s];
  const nPit: V3 = [Math.cos(21 * DEG), Math.sin(21 * DEG), 0];
  /** keep everything but the arm past `dist` (m along the arm from the shoulder joint; may be negative) */
  const sleeveKeep = (dist: number): Region => {
    const mk = (sg: number): Region => {
      const A = sg > 0 ? armpitL : mirror(armpitL), n: V3 = sg > 0 ? nPit : [-nPit[0], nPit[1], 0];
      let c: V3, ax: V3;
      if (dist <= D.upperArm) { ax = sg > 0 ? L.dU : mirror(L.dU); const sh = sg > 0 ? L.sh : mirror(L.sh); c = [sh[0] + ax[0] * dist, sh[1] + ax[1] * dist, sh[2] + ax[2] * dist]; }
      else { ax = sg > 0 ? L.dFore : mirror(L.dFore); const el = sg > 0 ? L.el : mirror(L.el); const d2 = dist - D.upperArm; c = [el[0] + ax[0] * d2, el[1] + ax[1] * d2, el[2] + ax[2] * d2]; }
      const [a0, a1, a2] = A, [n0, n1, n2] = n, [c0, c1, c2] = c, [x0, x1, x2] = ax;
      return (x, y, z) => Math.min((x - a0) * n0 + (y - a1) * n1 + (z - a2) * n2, (x - c0) * x0 + (y - c1) * x1 + (z - c2) * x2);
    };
    return lr(mk);
  };
  // ---- necklines: the part to remove (< 0 inside it)
  const nb = L.neckBase, nR = L.neckR;
  const neckHole = (frontY: number, backY: number, widen = 0): Region => {
    const zc = nb[2] + 0.004 * s, rx = nR + (0.016 + widen) * ws, rz = nR + 0.012 * s + widen * 0.5;
    const zF = zc + rz, zB = zc - rz;
    return (x, y, z) => {
      const cyl = (Math.hypot(x / rx, (z - zc) / rz) - 1) * Math.min(rx, rz);
      const yc = lerp(backY, frontY, clamp((z - zB) / (zF - zB)));
      // and nothing up the back of the neck: the neck leans forward and its back is wider than the cylinder, so a
      // shell offset from it would rise behind the neck like a brace
      const back = Math.max(Math.abs(x) - rx * 1.3, backY + 0.012 * s - y, z - zc);
      return Math.min(Math.max(cyl, yc - y), back);
    };
  };
  const neckRemoval = (neck: Garment['neck'], deep = 1): Region => {
    const crew = neckHole(jug - 0.016 * s, jug + 0.026 * s, -0.007);
    switch (neck) {
      case 'v': {
        const yV = jug - 0.105 * s * deep, th = 21 * DEG, c = Math.cos(th), sn = Math.sin(th);
        return union(crew, (x, y, z) => Math.max(Math.abs(x) * c - (y - yV) * sn, nb[2] - z));
      }
      case 'scoop': return union(neckHole(jug - 0.01 * s, jug + 0.03 * s, 0.025), (x, y, z) => (Math.hypot(x / (0.085 * ws), (y - jug - 0.01) / (0.075 * s * deep), (z - nb[2] - 0.13) / 0.15) - 1) * 0.07);
      case 'square': return union(neckHole(jug, jug + 0.03 * s, 0.02), (x, y, z) => Math.max(Math.abs(x) - 0.072 * ws, jug - 0.085 * s * deep - y, nb[2] - z));
      case 'collar': return neckHole(jug - 0.002 * s, jug + 0.034 * s, -0.004);
      default: return crew;
    }
  };
  /** straps: a top edge just over the bust plus two bands over the shoulders */
  const strapKeep = (yTop: number, w: number): Region => {
    const xs = 0.088 * ws;
    return union(below(yTop), (x) => Math.abs(Math.abs(x) - xs) - w);
  };
  const openFront = (gapLo: number, gapHi: number, yLo: number, yHi: number): Region => (x, y, z) => {
    const g = lerp(gapLo, gapHi, clamp((y - yLo) / (yHi - yLo))) / 2;
    return -Math.max(Math.abs(x) - g, -z);
  };

  const kinds = outfit.map((g) => g.kind);
  const hasBottom = kinds.some((k) => BOTTOMS.includes(k));
  const order = (g: Garment) => (isShoe(g.kind) ? 0 : BOTTOMS.includes(g.kind) ? 1 : g.kind === 'dress' ? 1 : OUTER.includes(g.kind) ? 3 : 2);
  const sorted = outfit.slice().sort((a, b) => order(a) - order(b));
  const knees = (w: number) => [1, -1].map((sg) => ({ c: (sg > 0 ? L.knee : mirror(L.knee)), ax: sg > 0 ? L.dL : mirror(L.dL), r: 0.07 * s, w }));
  const elbows = (w: number) => [1, -1].map((sg) => ({ c: (sg > 0 ? L.el : mirror(L.el)), ax: sg > 0 ? L.dU : mirror(L.dU), r: 0.06 * s, w }));
  const hipCrease = (w: number) => [1, -1].map((sg) => ({ c: [sg * 0.07 * ws, D.hipY - 0.02 * s, 0.07 * s] as V3, ax: norm([sg * 0.3, 1, 0.6]), r: 0.06 * s, w }));
  const waistFold = (w: number) => [{ c: [0, D.waistY - 0.02 * s, D.bellyZ * 0.5] as V3, ax: [0, 1, 0] as V3, r: 0.09 * s, w }];

  for (const g of sorted) {
    const k = g.kind;
    if (isShoe(k)) { out.push(shoe(rig, g)); continue; }
    if (BOTTOMS.includes(k)) {
      const top = k === 'skirt' ? D.waistY + 0.01 * s : D.hipY + (body.sex === 'm' ? 0.05 : 0.06) * s;
      const t = k === 'jeans' ? 0.003 : k === 'trousers' ? 0.0045 : 0.0035;
      const bones = bonesOf(['hips', 'spine', 'thighL', 'thighR', 'shinL', 'shinR']);
      const A = sub_(bonesOf(['hips', 'spine', 'thighL', 'thighR', 'shinL', 'shinR']));
      let keep: Region, drape: Drape | null = null, yLo: number;
      const legFrac = g.length ?? 1;
      if (k === 'skirt') {
        const hem = D.hipY - legFrac * (D.hipY - D.ankleY);
        keep = inter(below(top), above(hem));
        drape = makeDrape(torsoOnly, hem - 0.03, D.hipY + 0.02 * s, ws, t, (y) => smooth(D.hipY + 0.02, D.crotchY, y), g.fabric === 'leather' ? 0.04 : 0.12, D.crotchY - 0.04 * s);
        yLo = hem - 0.03;
      } else {
        const legCut = (sg: number): Region => {
          const ax = sg > 0 ? L.dL : mirror(L.dL);
          const c = k === 'shorts' ? (sg > 0 ? L.hip : mirror(L.hip)).map((v, i) => v + ax[i] * (D.thigh * 0.62)) as V3
            : (sg > 0 ? L.ankle : mirror(L.ankle)).map((v, i) => v - ax[i] * (k === 'jeans' ? 0.03 : 0.022) * s) as V3;
          const [c0, c1, c2] = c, [x0, x1, x2] = ax;
          return (x, y, z) => (x - c0) * x0 + (y - c1) * x1 + (z - c2) * x2;
        };
        keep = inter(below(top), lr(legCut));
        yLo = k === 'shorts' ? D.kneeY : D.ankleY - 0.02;
      }
      const folds = [...knees(k === 'jeans' ? 0.8 : 0.6), ...hipCrease(0.6)];
      if (k === 'jeans' || k === 'trousers') for (const sg of [1, -1]) folds.push({ c: (sg > 0 ? L.ankle : mirror(L.ankle)).map((v, i) => v - (sg > 0 ? L.dL : mirror(L.dL))[i] * 0.06 * s) as V3, ax: sg > 0 ? L.dL : mirror(L.dL), r: 0.05 * s, w: k === 'jeans' ? 0.9 : 0.5 });
      const wear = k === 'jeans' ? (p: V3) => {
        const sg = p[0] >= 0 ? 1 : -1, hp = sg > 0 ? L.hip : mirror(L.hip), kn = sg > 0 ? L.knee : mirror(L.knee);
        const front = smooth(0.0, 0.05, p[2] - lerp(hp[2], kn[2], 0.5));
        const thigh = smooth(D.kneeY - 0.02, D.kneeY + 0.08, p[1]) * smooth(D.hipY, D.crotchY - 0.05, p[1]);
        const knee = Math.exp(-(((p[1] - D.kneeY) / 0.05) ** 2));
        return clamp(front * (0.8 * thigh + 0.6 * knee));
      } : null;
      out.push({ g, layer: 1, sdf: new GarmentSdf(A, t, drape, 0.03 * s, keep), keep, bones, box: [[-0.6, yLo, -0.5], [0.6, top + 0.02, 0.5]], sigma: k === 'skirt' ? 2.2 : 1.3, accent: null, folds, wear, h: 0.013 });
      continue;
    }
    // ---- tops, dresses, outer layers
    const outer = OUTER.includes(k);
    const dress = k === 'dress';
    const sleeve = g.sleeve ?? (outer ? 1 : 0.25);
    const neck = g.neck ?? (k === 'shirt' || k === 'polo' ? 'collar' : 'crew');
    const strap = neck === 'strap';
    const t = outer ? (k === 'cardigan' ? 0.011 : k === 'leather' ? 0.013 : 0.015) : dress ? (g.fabric === 'satin' ? 0.003 : 0.004) : k === 'fitted' || k === 'tank' ? 0.0055 : 0.0065;
    const drapeAmt = outer ? 0.9 : dress ? (g.fabric === 'satin' ? 0.3 : 0.45) : k === 'fitted' || k === 'tank' ? 0.22 : k === 'blouse' ? 0.6 : k === 'shirt' ? 0.75 : 0.7;
    let hem: number;
    if (dress) hem = D.hipY - (g.length ?? 0.4) * (D.hipY - D.ankleY);
    else if (outer) hem = k === 'leather' ? D.hipY + 0.005 * s : k === 'blazer' ? D.crotchY + 0.01 * s : D.hipY - 0.05 * s;
    else hem = k === 'fitted' || k === 'tank' || k === 'blouse' ? D.hipY - 0.005 * s : k === 'shirt' ? D.hipY - 0.055 * s : D.hipY - 0.035 * s;
    if (!dress && !hasBottom) hem = Math.min(hem, D.crotchY - 0.05);
    const armDist = strap || k === 'tank' ? -0.035 * s : sleeve <= 0 ? -0.012 * s : sleeve * Larm - (sleeve >= 0.95 ? 0.022 * s : 0);
    const armBones = (strap || k === 'tank' || sleeve <= 0 ? [] : sleeve < 0.4 ? ['armL', 'armR'] : ARMS) as (keyof typeof B)[];
    const bones = bonesOf([...TORSO, ...armBones, 'thighL', 'thighR', ...(dress ? LEGS : [])]);
    const A = sub_(bonesOf([...TORSO, ...armBones, 'thighL', 'thighR', ...(dress ? LEGS : [])]));
    let keep: Region = inter(above(hem), sleeveKeep(armDist));
    if (strap) keep = inter(keep, strapKeep(D.chestY + (body.sex === 'f' ? 0.06 : 0.065) * s, 0.0075 * s));
    else keep = inter(keep, not(neckRemoval(neck, outer ? 1.6 : k === 'blouse' ? 1.15 : 1)));
    if (g.open) keep = inter(keep, openFront(outer ? 0.07 * ws : 0.03 * ws, outer ? 0.2 * ws : 0.12 * ws, hem, jug));
    const dTop = D.chestY + 0.06 * s;
    const drapeLo = dress ? hem - 0.03 : hem - 0.03;
    const drape = makeDrape(torsoOnly, drapeLo, dTop, ws, t * 0.6, (y) => (dress ? lerp(drapeAmt, 1, smooth(D.hipY + 0.02, D.crotchY - 0.02, y)) : drapeAmt) * smooth(dTop, dTop - 0.06 * s, y),
      dress ? (g.fabric === 'satin' ? 0.05 : 0.08) : outer ? 0.03 : 0.02, dress ? D.crotchY : D.waistY);
    const collarOn = neck === 'collar' && !strap;
    const folds = [...elbows(sleeve > 0.45 ? 0.8 : 0), ...waistFold(0.35 + 1.4 * fatT / 0.057), ...(dress ? hipCrease(0.5) : [])];
    const sdf = new GarmentSdf(A, t, drape, 0.035 * s, keep);
    const gb: GarmentBuild = { g, layer: outer ? 3 : 2, sdf, keep, bones, box: [[-0.75, drapeLo, -0.5], [0.75, jug + 0.1 * s, 0.5]], sigma: dress ? 1.8 : outer ? 1.6 : 1.4, accent: null, folds, wear: null, h: dress || strap ? 0.008 : 0.0105 };
    if (collarOn) gb.collar = collarLoft(rig, sdf, !!g.open, k === 'polo');
    out.push(gb);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ shoes
function shoe(rig: Rig, g: Garment): GarmentBuild {
  const s = rig.s, L = rig.limb, F = rig.field, k = g.kind;
  const A = F.subset((i) => [B.footL, B.toeL, B.footR, B.toeR, B.shinL, B.shinR].includes(F.bone[i]));
  const t = k === 'boots' ? 0.0045 : 0.0035;
  const soleT = (k === 'sneakers' ? 0.024 : k === 'boots' ? 0.014 : k === 'loafers' ? 0.011 : 0.006) * s;
  // body point -> the foot's own frame (unpitched, in units of s); the right foot mirrored onto the left
  const an = L.ankle, cp = Math.cos(-rig.pitch), spn = Math.sin(-rig.pitch), Q: V3 = [0, 0, 0];
  const local = (x: number, y: number, z: number): V3 => {
    const dx = Math.abs(x) - an[0], dy = y - an[1], dz = z - an[2];
    Q[0] = dx / s; Q[1] = (dy * cp - dz * spn) / s; Q[2] = (dy * spn + dz * cp) / s;
    return Q;
  };
  // the sole: a rounded slab under the foot's outline, in the foot's own (unpitched) frame
  const sole: Region = (x, y, z) => {
    const q = local(x, y, z);
    const zz = clamp(q[2], -0.055, 0.2), w = 0.038 + 0.012 * smooth(-0.04, 0.12, zz) - 0.012 * smooth(0.17, 0.215, q[2]);
    const lx = Math.abs(q[0] - 0.004) - w, lz = Math.max(-0.062 - q[2], q[2] - 0.205);
    const yb = -0.079 - soleT / s, yt = -0.07;
    const ly = Math.max(yb - q[1], q[1] - yt);
    const e = Math.max(lx, lz, ly);
    return e * s - 0.004;
  };
  // heels: a block (or a slim heel) from under the heel to the ground
  const extra: Region | null = k === 'heels' || k === 'boots' ? (() => {
    const heelTop = (sg: number): V3 => {
      // the heel's bottom in body coords: the foot frame point (footX, -0.079 - sole, -0.04) pitched back
      const pL: V3 = [L.ankle[0], 0, 0];
      const c = Math.cos(rig.pitch), sn = Math.sin(rig.pitch), y0 = (-0.079) * s - soleT, z0 = -0.038 * s;
      const p: V3 = [pL[0], L.ankle[1] + y0 * c - z0 * sn, L.ankle[2] + y0 * sn + z0 * c];
      return sg > 0 ? p : mirror(p);
    };
    const ground = -rig.heel * 0.92 + 0.002;
    const rTop = (k === 'boots' ? 0.022 : 0.011) * s, rBot = (k === 'boots' ? 0.02 : 0.0055) * s;
    return (x: number, y: number, z: number) => {
      const top = heelTop(x >= 0 ? 1 : -1), bot: V3 = [top[0], ground, top[2] - (k === 'heels' ? 0.006 : 0)];
      if (y > top[1] + 0.01) return y - top[1];
      const t2 = clamp((top[1] - y) / Math.max(0.005, top[1] - bot[1]));
      const c: V3 = [lerp(top[0], bot[0], t2), y, lerp(top[2], bot[2], t2)], r = lerp(rTop, rBot, t2);
      const d = Math.hypot(x - c[0], (z - c[2]) * (k === 'heels' ? 1 : 0.8)) - r;
      return Math.max(d, bot[1] - y);
    };
  })() : null;
  // the upper's cut, in the foot frame
  const keepUpper: Region = (() => {
    if (k === 'boots') return (_x: number, y: number) => y - (rig.dims.kneeY - 0.13 * s);
    if (k === 'heels' || k === 'flats') return (x: number, y: number, z: number) => {
      const q = local(x, y, z);
      const cup = Math.max(q[1] - lerp(-0.038, -0.058, smooth(-0.05, 0.08, q[2])), q[2] - 0.11);
      const toe = Math.max(0.098 - q[2], q[1] + 0.035);
      return Math.min(cup, toe) * s;
    };
    const collarY = k === 'loafers' ? -0.03 : -0.016;
    return (x: number, y: number, z: number) => { const q = local(x, y, z); return (q[1] - (collarY + 0.026 * smooth(-0.01, 0.06, q[2]) * (k === 'sneakers' ? 1 : 0.4))) * s; };
  })();
  const keep: Region = keepUpper;
  const sdf = new GarmentSdf(A, t, null, 0.004, keep, null, 0.006 * s, extra ? (x, y, z) => Math.min(sole(x, y, z), extra(x, y, z)) : sole);
  const accent: Region = (x, y, z) => {
    const a = sole(x, y, z), b = extra ? extra(x, y, z) : 1e9;
    return Math.min(a, b) < 0.0015 ? 1 : 0;
  };
  return {
    g, layer: 0, sdf, keep: (x, y, z) => Math.min(keep(x, y, z), sole(x, y, z)), bones: new Set([B.footL, B.toeL, B.footR, B.toeR]),
    box: [[-0.4, -rig.heel - 0.03, -0.3], [0.4, k === 'boots' ? rig.dims.kneeY : rig.dims.ankleY + 0.06, 0.45]], sigma: 1, accent, folds: [], wear: null, h: 0.0075,
  };
}
