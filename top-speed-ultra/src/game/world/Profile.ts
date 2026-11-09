// What the network may do to a road's vertical profile when it changes the map's heights at load (levelOverlaps,
// bridgeSags): no crest a car leaves the ground on, no dip, and no grade the map doesn't have. Following another road
// and then easing back to a junction's level put humps into the road: the CA-55 North rose 4.2 m in 80 m to the CA-91
// East's height and fell 2.9 m back to its end (a car left the ground over it at 56 m/s; the map's crest there, 229
// m/s), ramp 970 a 2.5 m hump, the CA-241 North a 12% drop and a dip into the 91 West. limitProfile() takes the heights
// the levelling wants and returns the nearest profile within these limits (or null when they already are), so where
// following the other road would break them, the road follows it less.
//
// Measured over 10 m (B samples either way), and against the map's own sharpest crest and dip and steepest grade
// within ±20 m (WIN), so the map's own profile always passes. tests/regression.mjs checks the same numbers on every road.

import { STEP } from './Path';

export const PROFILE = {
  B: 5,                             // samples either way: the 10 m baseline for curvature and grade
  WIN: 10,                          // samples either way: how far the map's own profile counts
  floor: { main: 90, ramp: 50 },    // m/s: the slowest a car may leave the ground over a crest (or double its weight in a dip)
  grade: { main: 0.08, ramp: 0.10 },// the steepest grade, where the map's own was no steeper
  tol: 0.95,                        // or 95% of the map's own crest or dip speed there, if that is lower
};
// a weight at or above this holds a sample where it is (a junction: the roads there have to stay level)
export const PIN = 1e10;

const G = 9.81;
// the rows: a second difference over 2 m (smoothing), over L (a crest or dip), and a rise over L (a grade)
const D2 = [1, -2, 1], O3 = [-1, 0, 1], CK = [1, -2, 1], OK = [-PROFILE.B, 0, PROFILE.B], CG = [-1, 1], OG = [0, PROFILE.B];
// the solver works to a margin inside the test's limits
const MARGIN_V = 1.03, MARGIN_TOL = 0.97, MARGIN_GRADE = 0.002;
// smoothing on the change from what's wanted (so a correction spreads over tens of metres, not one sample), and the
// stiffness of an active limit
const BETA = 1e4, MU = 1e8, PAD = 150, ITER = 60;

// base: the map's heights; want: the heights asked for; weight: how much each sample's height matters (1 where the road
// follows another, about 0.02 elsewhere, PIN at junctions). Returns the heights to use, or null if want is within limits.
export function limitProfile(base: Float32Array, want: Float32Array, weight: Float32Array, main: boolean,
  stats?: { iters: number; worst: number; active: number; window: number }): Float32Array | null {
  const n = want.length, B = PROFILE.B, W = PROFILE.WIN, L = B * STEP;
  if (n < 2 * B + 2) return null;
  const F = (main ? PROFILE.floor.main : PROFILE.floor.ramp) * MARGIN_V, K = (G / (F * F)) * L * L;   // in metres over L
  const GL = ((main ? PROFILE.grade.main : PROFILE.grade.ramp) - MARGIN_GRADE) * L;
  const T2 = MARGIN_TOL * MARGIN_TOL;
  // a row is a second difference over L (kind 0, rows B .. n-B-1) or a rise over L (kind 1, rows 0 .. n-B-1)
  const val = (y: ArrayLike<number>, i: number, kind: number) => (kind ? y[i + B] - y[i] : y[i + B] - 2 * y[i] + y[i - B]);
  // a row's limits [lo, hi]: the floor's, or the map's own sharpest crest and dip (steepest grade) within ±WIN
  const lim = [0, 0];
  const limits = (i: number, kind: number) => {
    let a = 0, b = 0;
    for (let j = Math.max(kind ? 0 : B, i - W), j1 = Math.min(n - B - 1, i + W); j <= j1; j++) {
      const v = val(base, j, kind);
      if (kind) { a = Math.max(a, Math.abs(v)); } else { a = Math.min(a, v); b = Math.max(b, v); }
    }
    if (kind) { lim[0] = -Math.max(GL, a); lim[1] = Math.max(GL, a); } else { lim[0] = Math.min(-K, a / T2); lim[1] = Math.max(K, b / T2); }
    return lim;
  };
  // where does what's wanted break a limit? (a row within the floor's limits is within its own: they're never tighter)
  let c0 = 0, c1 = n - 1;
  while (c0 < n && Math.abs(want[c0] - base[c0]) < 1e-6) c0++;
  if (c0 === n) return null;
  while (Math.abs(want[c1] - base[c1]) < 1e-6) c1--;
  let v0 = -1, v1 = -1;
  for (let kind = 0; kind < 2; kind++) for (let i = Math.max(kind ? 0 : B, c0 - B), i1 = Math.min(n - B - 1, c1); i <= i1; i++) {
    const v = kind ? want[i + B] - want[i] : want[i + B] - 2 * want[i] + want[i - B];
    if (kind ? v >= -GL && v <= GL : v >= -K && v <= K) continue;
    if (Math.abs(v - val(base, i, kind)) < 1e-6) continue;
    limits(i, kind);
    if (v < lim[0] - 1e-4 || v > lim[1] + 1e-4) { if (v0 < 0 || i < v0) v0 = i; v1 = Math.max(v1, i); }
  }
  if (v0 < 0) return null;
  // solve on a window around them; the samples at its ends (and pinned ones) stay as wanted
  const a0 = Math.max(0, v0 - B - PAD), a1 = Math.min(n - 1, v1 + B + PAD), m = a1 - a0 + 1, HB = 2 * B, S = HB + 1;
  const fixed = (i: number) => i < a0 + B || i > a1 - B || weight[i] >= PIN;
  // the rows in the window, with their limits
  const rows: number[] = [], lo: number[] = [], hi: number[] = [];
  for (let kind = 0; kind < 2; kind++) for (let i = kind ? a0 : Math.max(a0 + B, B); i <= Math.min(a1 - B, n - B - 1); i++) {
    limits(i, kind); rows.push(i * 2 + kind); lo.push(lim[0]); hi.push(lim[1]);
  }
  const wk = new Float64Array(m), wt = new Float64Array(m);
  for (let k = 0; k < m; k++) { wk[k] = fixed(a0 + k) ? PIN : weight[a0 + k]; wt[k] = want[a0 + k]; }
  const A = new Float64Array(m * S), rhs = new Float64Array(m);
  // A is symmetric banded: the lower band, A(i, j) for i - HB <= j <= i at i * S + (i - j)
  const add = (i: number, j: number, v: number) => { if (i >= j) A[i * S + i - j] += v; else A[j * S + j - i] += v; };
  // a row (coefficients co at samples k + off) held at b with stiffness mu: mu * (row . y - b)^2
  const put = (k: number, off: readonly number[], co: readonly number[], b: number, mu: number) => {
    for (let p = 0; p < off.length; p++) {
      rhs[k + off[p]] += mu * co[p] * b;
      for (let q = 0; q <= p; q++) add(k + off[p], k + off[q], mu * co[p] * co[q]);
    }
  };
  // the part that doesn't change: closeness to what's wanted and smoothness of the change
  for (let k = 0; k < m; k++) { A[k * S] += wk[k]; rhs[k] += wk[k] * wt[k]; }
  for (let k = 1; k < m - 1; k++) put(k, O3, D2, wt[k - 1] - 2 * wt[k] + wt[k + 1], BETA);
  const A0 = Float64Array.from(A), rhs0 = Float64Array.from(rhs);
  const rv = (y: Float64Array, c: number) => { const k = (c >> 1) - a0; return c & 1 ? y[k + B] - y[k] : y[k + B] - 2 * y[k] + y[k - B]; };
  // the penalised objective: closeness to what's wanted, smoothness of the change, and each limit broken, squared
  const f = (y: Float64Array) => {
    let e = 0;
    for (let k = 0; k < m; k++) e += wk[k] * (y[k] - wt[k]) ** 2;
    for (let k = 1; k < m - 1; k++) e += BETA * (y[k - 1] - 2 * y[k] + y[k + 1] - wt[k - 1] + 2 * wt[k] - wt[k + 1]) ** 2;
    for (let r = 0; r < rows.length; r++) { const v = rv(y, rows[r]); if (v < lo[r]) e += MU * (lo[r] - v) ** 2; else if (v > hi[r]) e += MU * (v - hi[r]) ** 2; }
    return e;
  };
  // generalised Newton: hold the limits the current profile breaks, solve, and step as far toward that as lowers the
  // objective (a plain active set cycled on 17 roads)
  let y = Float64Array.from(wt), fy = f(y);
  const yn = new Float64Array(m), yt = new Float64Array(m);
  for (let it = 0; it < ITER; it++) {
    A.set(A0); rhs.set(rhs0);
    let held = 0;
    for (let r = 0; r < rows.length; r++) {
      const c = rows[r], v = rv(y, c), b = v < lo[r] ? lo[r] : v > hi[r] ? hi[r] : NaN;
      if (isNaN(b)) continue;
      const k = (c >> 1) - a0; held++;
      if (c & 1) put(k, OG, CG, b, MU); else put(k, OK, CK, b, MU);
    }
    if (stats) { stats.iters = it + 1; stats.active = held; }
    if (!cholSolve(A, rhs, yn, m, HB)) return null;
    let t = 1, ft = 0, step = 0;
    for (; t > 1e-4; t /= 2) {
      for (let k = 0; k < m; k++) yt[k] = y[k] + t * (yn[k] - y[k]);
      ft = f(yt);
      if (ft <= fy) break;
    }
    if (!(ft <= fy)) break;
    for (let k = 0; k < m; k++) { step = Math.max(step, Math.abs(yt[k] - y[k])); y[k] = yt[k]; }
    const done = fy - ft <= 1e-9 * fy + 1e-12 || step < 1e-6;
    fy = ft;
    if (done) break;
  }
  const out = new Float32Array(want);
  for (let k = 0; k < m; k++) out[a0 + k] = y[k];
  if (stats) { let e = 0; for (let r = 0; r < rows.length; r++) { const v = rv(y, rows[r]); e = Math.max(e, lo[r] - v, v - hi[r]); } stats.worst = e; stats.window = m; }
  return out;
}

// solves A y = b for a symmetric positive definite banded A (lower band of half-width hb, row i at i * (hb + 1));
// A is overwritten with its Cholesky factor
function cholSolve(A: Float64Array, b: Float64Array, y: Float64Array, m: number, hb: number) {
  const S = hb + 1;
  for (let i = 0; i < m; i++) {
    for (let j = Math.max(0, i - hb); j <= i; j++) {
      let sum = A[i * S + i - j];
      for (let k = Math.max(0, i - hb); k < j; k++) sum -= A[i * S + i - k] * A[j * S + j - k];
      if (i === j) { if (!(sum > 0)) return false; A[i * S] = Math.sqrt(sum); }
      else A[i * S + i - j] = sum / A[j * S];
    }
  }
  for (let i = 0; i < m; i++) { let s = b[i]; for (let k = Math.max(0, i - hb); k < i; k++) s -= A[i * S + i - k] * y[k]; y[i] = s / A[i * S]; }
  for (let i = m - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k <= Math.min(m - 1, i + hb); k++) s -= A[k * S + k - i] * y[k]; y[i] = s / A[i * S]; }
  return true;
}
