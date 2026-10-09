// One real carriageway or ramp, as a smooth centreline sampled every 2 m: position, heading, curvature, grade.
// Built from the network's control points with a centripetal Catmull-Rom spline. Every path is one-way: you
// drive it with s increasing, and d is the offset to the right of the centreline.

import { clamp } from '../util';

export const STEP = 2;
export const LANE_W = 3.66;               // 12 ft lanes

export interface RoadPoint { x: number; y: number; z: number; h: number; k: number; slope: number }
export interface Junction { s: number; to: Path; toS: number; kind: 'diverge' | 'merge' | 'continue' }

export class Path {
  readonly n: number;
  readonly len: number;
  readonly xs: Float32Array; readonly zs: Float32Array; readonly ys: Float32Array;
  readonly hs: Float32Array; readonly ks: Float32Array; readonly ss: Float32Array;
  readonly ctrlS: Float32Array;            // arc length at each control point
  // cross-section (d, right positive)
  readonly edgeL: number; readonly edgeR: number;     // outer edges of the travel lanes
  readonly paveL: number; readonly paveR: number;     // outer edges of the paved shoulders
  readonly wallL: number; readonly wallR: number;     // barrier faces
  out: Junction[] = [];                    // where you can leave this path, sorted by s
  inc: Junction[] = [];                    // where other paths join it
  next: Path | null = null;                // where the travel lanes carry on past the end, if anywhere
  prev: Path | null = null;
  label = '';
  // filled in by the network
  minX = 0; maxX = 0; minZ = 0; maxZ = 0;

  constructor(readonly id: number, readonly kind: 'm' | 'l', readonly lanes: number, ctrl: Float64Array,
    readonly route: string | null = null, readonly dir: string | null = null, readonly name: string | null = null, readonly conn = false) {
    const half = lanes * LANE_W / 2;
    this.edgeL = -half; this.edgeR = half;
    const shL = kind === 'm' ? (lanes >= 4 ? 2.4 : 1.5) : 1.2, shR = kind === 'm' ? 3.0 : 2.4;
    this.paveL = -half - shL; this.paveR = half + shR;
    this.wallL = this.paveL - 0.35; this.wallR = this.paveR + 0.35;

    // densify the spline at ~0.5 m, then resample by arc length every STEP
    const nc = ctrl.length / 3;
    const P = (i: number, c: number) => ctrl[clamp(i, 0, nc - 1) * 3 + c];
    const dense: number[] = [];
    const ctrlDense: number[] = [0];
    const pt = (i: number): [number, number, number] => {
      if (i < 0) return [2 * P(0, 0) - P(1, 0), 2 * P(0, 1) - P(1, 1), 2 * P(0, 2) - P(1, 2)];
      if (i > nc - 1) return [2 * P(nc - 1, 0) - P(nc - 2, 0), 2 * P(nc - 1, 1) - P(nc - 2, 1), 2 * P(nc - 1, 2) - P(nc - 2, 2)];
      return [P(i, 0), P(i, 1), P(i, 2)];
    };
    dense.push(P(0, 0), P(0, 1), P(0, 2));
    for (let i = 0; i < nc - 1; i++) {
      const p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2);
      const dt = (a: number[], b: number[]) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
      const t0 = 0, t1 = t0 + dt(p0, p1), t2 = t1 + dt(p1, p2), t3 = t2 + dt(p2, p3);
      const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const m = Math.max(1, Math.ceil(segLen / 0.5));
      for (let j = 1; j <= m; j++) {
        const t = t1 + (t2 - t1) * (j / m);
        for (let c = 0; c < 3; c++) {
          const a1 = ((t1 - t) * p0[c] + (t - t0) * p1[c]) / (t1 - t0);
          const a2 = ((t2 - t) * p1[c] + (t - t1) * p2[c]) / (t2 - t1);
          const a3 = ((t3 - t) * p2[c] + (t - t2) * p3[c]) / (t3 - t2);
          const b1 = ((t2 - t) * a1 + (t - t0) * a2) / (t2 - t0);
          const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
          dense.push(((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1));
        }
      }
      ctrlDense.push(dense.length / 3 - 1);
    }
    const nd = dense.length / 3;
    const cum = new Float64Array(nd);
    for (let i = 1; i < nd; i++) cum[i] = cum[i - 1] + Math.hypot(dense[i * 3] - dense[i * 3 - 3], dense[i * 3 + 1] - dense[i * 3 - 2]);
    this.len = cum[nd - 1];
    this.ctrlS = new Float32Array(ctrlDense.map((i) => cum[i]));
    const n = Math.max(2, Math.floor(this.len / STEP) + 2);
    this.n = n;
    this.xs = new Float32Array(n); this.zs = new Float32Array(n); this.ys = new Float32Array(n);
    this.hs = new Float32Array(n); this.ks = new Float32Array(n); this.ss = new Float32Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = Math.min(i * STEP, this.len);
      while (j < nd - 2 && cum[j + 1] < s) j++;
      const L = cum[j + 1] - cum[j], f = L > 0 ? (s - cum[j]) / L : 0;
      this.xs[i] = dense[j * 3] + (dense[j * 3 + 3] - dense[j * 3]) * f;
      this.zs[i] = dense[j * 3 + 1] + (dense[j * 3 + 4] - dense[j * 3 + 1]) * f;
      this.ys[i] = dense[j * 3 + 2] + (dense[j * 3 + 5] - dense[j * 3 + 2]) * f;
    }
    // heading (unwrapped so it interpolates), curvature and grade
    let prevH = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let h = Math.atan2(this.xs[b] - this.xs[a], this.zs[b] - this.zs[a]);
      if (i > 0) { while (h - prevH > Math.PI) h -= 2 * Math.PI; while (h - prevH < -Math.PI) h += 2 * Math.PI; }
      this.hs[i] = h; prevH = h;
      const ds = Math.max(1e-3, (b - a) * STEP);
      this.ss[i] = (this.ys[b] - this.ys[a]) / ds;
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
      this.ks[i] = (this.hs[b] - this.hs[a]) / Math.max(1e-3, (b - a) * STEP);
    }
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) { const x = this.xs[i], z = this.zs[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    this.minX = x0; this.maxX = x1; this.minZ = z0; this.maxZ = z1;
  }

  get main() { return this.kind === 'm'; }
  laneCenter(i: number) { return this.edgeL + LANE_W * (i + 0.5); }
  laneOf(d: number) { return clamp(Math.floor((d - this.edgeL) / LANE_W), 0, this.lanes - 1); }
  // the rightmost lanes: where trucks keep to
  truckLane(i: number) { return i >= this.lanes - 2; }

  sample(s: number, out: RoadPoint = { x: 0, y: 0, z: 0, h: 0, k: 0, slope: 0 }): RoadPoint {
    const f = s / STEP, n = this.n;
    let i = Math.floor(f);
    if (i < 0) i = 0; else if (i > n - 2) i = n - 2;
    const t = clamp(f - i, -2, 3);
    out.x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * t;
    out.y = this.ys[i] + (this.ys[i + 1] - this.ys[i]) * clamp(t, 0, 1);
    out.z = this.zs[i] + (this.zs[i + 1] - this.zs[i]) * t;
    out.h = this.hs[i] + (this.hs[i + 1] - this.hs[i]) * clamp(t, 0, 1);
    out.k = this.ks[i] + (this.ks[i + 1] - this.ks[i]) * clamp(t, 0, 1);
    out.slope = this.ss[i] + (this.ss[i + 1] - this.ss[i]) * clamp(t, 0, 1);
    return out;
  }
  heading(s: number) { return this.sample(s, tmpP).h; }
  height(s: number) { return this.sample(s, tmpP).y; }

  // nearest point on the centreline to (x, z), starting from a guess: s (unclamped, so you can tell you've
  // run off either end) and the signed offset d (right +)
  project(x: number, z: number, guess: number, out = { s: 0, d: 0 }) {
    let s = clamp(guess, 0, this.len);
    const p = tmpP;
    for (let it = 0; it < 6; it++) {
      this.sample(clamp(s, 0, this.len), p);
      const ds = (x - p.x) * Math.sin(p.h) + (z - p.z) * Math.cos(p.h);
      const ns = clamp(s + ds, -50, this.len + 50);
      if (Math.abs(ns - s) < 1e-4) { s = ns; break; }
      s = ns;
    }
    this.sample(clamp(s, 0, this.len), p);
    const along = (x - p.x) * Math.sin(p.h) + (z - p.z) * Math.cos(p.h);
    out.s = clamp(s, 0, this.len) + (s < 0 || s > this.len ? along : 0);
    out.d = (x - p.x) * -Math.cos(p.h) + (z - p.z) * Math.sin(p.h);
    return out;
  }

  // world position of a point at (s, d), and the road's heading there
  at(s: number, d: number, out = { x: 0, y: 0, z: 0, h: 0 }) {
    const p = this.sample(s, tmpA);
    out.x = p.x - Math.cos(p.h) * d;
    out.z = p.z + Math.sin(p.h) * d;
    out.y = p.y;
    out.h = p.h;
    return out;
  }

  // the next way off this path after s (a diverge or the end), if any
  nextExit(s: number) { for (const j of this.out) if (j.s > s) return j; return null; }
}
const tmpP: RoadPoint = { x: 0, y: 0, z: 0, h: 0, k: 0, slope: 0 };
const tmpA: RoadPoint = { x: 0, y: 0, z: 0, h: 0, k: 0, slope: 0 };

// floating origin shared by everything that renders
export const ORIGIN = { x: 0, z: 0 };
