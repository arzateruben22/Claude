// path.js — a curve with an arc-length table, flow along it, and tubes (kits/cinema/sci). Brand-neutral.
// Body uses it for vessels and the red-cell stream, space for orbits and trails, physics for trajectories.
//
//   import { path, flow, stream, tube, wrapScale } from "cinema/sci/path.js";
//   const P = path([[0, -60, 0], [4, 0, 0], [-2, 80, 0]]);           // CatmullRom (centripetal) through the points
//   const F = flow(P, { speed: (s) => 500 * (2.5 / P.radius(s)) ** 2 });   // v(s): units of length per second of scene time
//   F.s(F.tau(40) + 0.1)                                               // where a cell that passed s = 40 is 0.1 s later
//   const S = stream(F, { n: 24, gap: 0.024, fade: 6 });               // a looping file of 24 things, 0.024 s apart
//   const c = S.at(5, tau);  // { s, p: [x, y, z], scale, lap } (scale eases to 0 at both ends, so the wrap never jumps)
//   const g = tube(P, { radius: (s) => 2.5, arc: [Math.PI / 2, 3 * Math.PI / 2] });   // a half tube (a cut-away)
//
// Everything is a pure function of its inputs: the tables are built once, every lookup is a binary search
// plus a lerp, and no state is carried between calls (so any frame can be sought on its own).
//
// path(points | curve, o) → P
//   points: [[x, y, z], ...] (a THREE.CatmullRomCurve3 is built through them; o.type "centripetal" by default,
//   o.closed false, o.tension 0.5 for "catmullrom"), or any THREE.Curve as `curve` (an ellipse, a parabola)
//   o.samples: 2048 (the arc-length table: s at evenly spaced curve parameters, inverted by search)
//   o.radius: a number or (s) => r, kept on the path (P.radius) for tubes, flows and anchors
//   o.up: [0, 0, 1] the starting normal for the frames (a vector not along the first tangent)
//   P.length                total arc length
//   P.at(s)                 [x, y, z] at arc length s (clamped; wrapped when closed)
//   P.tangent(s)            unit tangent [x, y, z]
//   P.frame(s)              { p, t, n, b }: a rotation-minimising frame (parallel transport along the table),
//                           so a tube or a ribbon never twists by itself
//   P.offset(s, a, d)       the point d off the axis at angle a around it (a = 0 along n, π/2 along b)
//   P.u(s) / P.s(u)         curve parameter ↔ arc length
//   P.nearest([x, y, z])    the arc length of the table point nearest a point
//   P.radius(s)             o.radius at s (0 when none was given)
//   P.points(step)          the axis sampled every `step` units (for probes, ghosts and trails)
//
// flow(P, { speed, samples = 2048 }) → F           τ = ∫ ds / v(s), tabulated and inverted
//   speed: a number or (s) => v > 0 (length per second of scene time). A narrowing tube that carries a
//   constant flow has v ∝ 1/r², so a cell speeds up where its vessel narrows and its gaps grow.
//   F.T          the time to travel the whole path · F.tau(s) the time to reach s · F.s(τ) the reverse
//                (clamped to [0, length]) · F.speed(s) · F.path
//   F.wrapS(τ)   s on a loop: s(τ mod T), and F.lap(τ) which loop it is on
//
// stream(F, { n, gap, phase0 = 0, fade, skip }) → S       a looping file of n things on one flow
//   thing i sits at scene time τ + phase0 − i·gap along the flow (the first leads). gap is in scene seconds,
//   so things keep their time spacing and their distance spacing follows the speed (B2 in the body bible).
//   fade: the length over which scale goes 0 → 1 at the path's start and 1 → 0 at its end (default
//   length/40): a thing that wraps from the end back to the start is at scale 0 there, so it never
//   streaks across the frame. skip: [i, ...] slots to leave empty (scale 0), e.g. where a hero mesh rides.
//   S.at(i, τ) → { s, p, scale, lap, wrap }: wrap is true inside the fade zones (a motion probe should
//   skip it: the instance may sit at the other end of the path one shutter later).
//   S.n, S.gap, S.flow
//
// wrapScale(s, L, fade) → the 0..1 scale for a thing at s on a path of length L (smoothstep at both ends)
//
// tube(P, o) → THREE.BufferGeometry                a tube (or part of one) along the path
//   o: { radius: number | (s) => r (default P.radius), s0 = 0, s1 = length, segments (along; default one per
//   unit of length, at least 8), radial = 32, arc: [a0, a1] (the angles kept, measured around the axis from
//   the frame's n toward b; default the whole circle), inside = false (normals point in: the lining of a
//   vessel seen from within or through a cut), ends = false }
//   uv: u = arc length s (in path units, so a texture keeps its size along the tube), v = angle / 2π.
//   A second attribute `arcLen` holds s again (float) for shaders. Normals follow the radius slope.
//   A part of the circle (arc) makes a cut-away: real geometry, not a clipping plane, so a depth pass that
//   overrides materials (the cinema finish's depth of field) sees the same cut the colour pass does.
//
// instance(mesh, i, p, q, s)  write instance i of an InstancedMesh: position [x,y,z], quaternion
//   (THREE.Quaternion or [x,y,z,w]) and scale (a number or [sx, sy, sz]); call mesh.instanceMatrix.needsUpdate
//   = true once after writing.
import * as THREE from "three";

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
// index of the last table entry <= x (the table is non-decreasing)
const search = (arr, x) => {
  let lo = 0, hi = arr.length - 1;
  if (x <= arr[0]) return 0;
  if (x >= arr[hi]) return hi - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= x) lo = m; else hi = m; }
  return lo;
};
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const wrapScale = (s, L, fade) => (fade > 0 ? smooth(0, fade, s) * smooth(L, L - fade, s) : 1);

export const path = (points, o = {}) => {
  const curve = points && points.isCurve ? points : o.curve ||
    new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, o.type || "centripetal", o.tension ?? 0.5);
  const closed = !!(o.closed || curve.closed);
  const N = o.samples ?? 2048, U = new Float64Array(N + 1), S = new Float64Array(N + 1), PT = [];
  const v = new THREE.Vector3();
  let acc = 0, prev = null;
  for (let k = 0; k <= N; k++) {
    U[k] = k / N; curve.getPoint(U[k], v);
    const p = [v.x, v.y, v.z];
    if (prev) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    S[k] = acc; PT.push(p); prev = p;
  }
  const L = acc;
  // tangents by central differences on the table, then frames by parallel transport (no twist)
  const T = PT.map((p, k) => {
    const a = PT[Math.max(0, k - 1)], b = PT[Math.min(N, k + 1)];
    return norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  });
  const NR = [], BN = [];
  let n0 = o.up || [0, 0, 1];
  if (Math.abs(dot3(n0, T[0])) > 0.95) n0 = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let n = norm3(cross3(cross3(T[0], n0), T[0]));
  for (let k = 0; k <= N; k++) {
    if (k) { const t = T[k], d = dot3(n, t); n = norm3([n[0] - d * t[0], n[1] - d * t[1], n[2] - d * t[2]]); }
    NR.push(n); BN.push(cross3(T[k], n));
  }
  const wrap = (s) => (closed ? ((s % L) + L) % L : clamp(s, 0, L));
  const idx = (s) => { const x = wrap(s), k = search(S, x), d = S[k + 1] - S[k]; return [k, d > 0 ? (x - S[k]) / d : 0]; };
  const lerpT = (A, k, f) => [A[k][0] + (A[k + 1][0] - A[k][0]) * f, A[k][1] + (A[k + 1][1] - A[k][1]) * f, A[k][2] + (A[k + 1][2] - A[k][2]) * f];
  const rad = o.radius == null ? () => 0 : typeof o.radius === "function" ? o.radius : () => o.radius;
  const P = {
    curve, closed, length: L,
    at: (s) => { const [k, f] = idx(s); return lerpT(PT, k, f); },
    tangent: (s) => { const [k, f] = idx(s); return norm3(lerpT(T, k, f)); },
    frame: (s) => {
      const [k, f] = idx(s), t = norm3(lerpT(T, k, f));
      let nn = lerpT(NR, k, f); const d = dot3(nn, t); nn = norm3([nn[0] - d * t[0], nn[1] - d * t[1], nn[2] - d * t[2]]);
      return { p: lerpT(PT, k, f), t, n: nn, b: cross3(t, nn) };
    },
    offset: (s, a, d) => {
      const F = P.frame(s), c = Math.cos(a) * d, sn = Math.sin(a) * d;
      return [F.p[0] + F.n[0] * c + F.b[0] * sn, F.p[1] + F.n[1] * c + F.b[1] * sn, F.p[2] + F.n[2] * c + F.b[2] * sn];
    },
    u: (s) => { const [k, f] = idx(s); return U[k] + (U[k + 1] - U[k]) * f; },
    s: (u) => { const x = clamp(u, 0, 1) * N, k = Math.min(N - 1, Math.floor(x)); return S[k] + (S[k + 1] - S[k]) * (x - k); },
    nearest: (p) => {
      let best = 0, bd = Infinity;
      for (let k = 0; k <= N; k++) { const q = PT[k], d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (d < bd) { bd = d; best = k; } }
      return S[best];
    },
    radius: (s) => rad(wrap(s)),
    points: (step) => { const out = []; for (let s = 0; s <= L + 1e-9; s += step) out.push(P.at(s)); return out; },
  };
  return P;
};

export const flow = (P, o = {}) => {
  const sp = typeof o.speed === "function" ? o.speed : () => o.speed ?? 1;
  const N = o.samples ?? 2048, L = P.length, S = new Float64Array(N + 1), TAU = new Float64Array(N + 1);
  // trapezoid rule on 1/v: exact to the table's resolution for a smooth speed profile
  let acc = 0;
  for (let k = 0; k <= N; k++) {
    S[k] = (k / N) * L;
    if (k) acc += ((S[k] - S[k - 1]) * (1 / Math.max(1e-9, sp(S[k - 1])) + 1 / Math.max(1e-9, sp(S[k])))) / 2;
    TAU[k] = acc;
  }
  const T = acc;
  const tau = (s) => { const x = clamp(s, 0, L), k = Math.min(N - 1, Math.floor((x / L) * N)), f = (x - S[k]) / (S[k + 1] - S[k] || 1); return TAU[k] + (TAU[k + 1] - TAU[k]) * f; };
  const s = (t) => { const x = clamp(t, 0, T), k = search(TAU, x), d = TAU[k + 1] - TAU[k]; return S[k] + (S[k + 1] - S[k]) * (d > 0 ? (x - TAU[k]) / d : 0); };
  const lap = (t) => Math.floor(t / T);
  return { path: P, T, tau, s, speed: (x) => sp(clamp(x, 0, L)), wrapS: (t) => s(t - lap(t) * T), lap };
};

export const stream = (F, o = {}) => {
  const n = o.n ?? 16, gap = o.gap ?? F.T / n, phase0 = o.phase0 ?? 0, L = F.path.length, fade = o.fade ?? L / 40;
  const skip = new Set(o.skip || []);
  return {
    n, gap, flow: F,
    at: (i, tau) => {
      const t = tau + phase0 - i * gap, s = F.wrapS(t), lap = F.lap(t);
      const sc = skip.has(i) ? 0 : wrapScale(s, L, fade);
      return { s, p: F.path.at(s), scale: sc, lap, wrap: s < fade || s > L - fade };
    },
  };
};

export const tube = (P, o = {}) => {
  const L = P.length, s0 = o.s0 ?? 0, s1 = o.s1 ?? L;
  const R = o.radius == null ? P.radius : typeof o.radius === "function" ? o.radius : () => o.radius;
  const segs = o.segments ?? Math.max(8, Math.ceil(s1 - s0)), rad = o.radial ?? 32;
  const [a0, a1] = o.arc || [0, Math.PI * 2];
  const inside = !!o.inside, cols = rad + 1;        // the seam column is doubled, so the texture never wraps backwards
  const pos = [], nor = [], uv = [], arcLen = [], index = [];
  for (let j = 0; j <= segs; j++) {
    const s = s0 + ((s1 - s0) * j) / segs, F = P.frame(s), r = R(s);
    const h = Math.max(1e-3, (s1 - s0) / segs / 2), dr = (R(Math.min(L, s + h)) - R(Math.max(0, s - h))) / (2 * h);
    for (let i = 0; i < cols; i++) {
      const a = a0 + ((a1 - a0) * i) / rad, c = Math.cos(a), sn = Math.sin(a);
      const d = [F.n[0] * c + F.b[0] * sn, F.n[1] * c + F.b[1] * sn, F.n[2] * c + F.b[2] * sn];
      pos.push(F.p[0] + d[0] * r, F.p[1] + d[1] * r, F.p[2] + d[2] * r);
      // the outward normal of a cone of slope dr/ds: d − (dr/ds)·t, normalised
      let nn = norm3([d[0] - dr * F.t[0], d[1] - dr * F.t[1], d[2] - dr * F.t[2]]);
      if (inside) nn = [-nn[0], -nn[1], -nn[2]];
      nor.push(nn[0], nn[1], nn[2]);
      uv.push(s, (a - a0) / (Math.PI * 2));
      arcLen.push(s);
    }
  }
  // (B − A) runs around the axis and (C − A) along it; their cross product is the outward normal
  for (let j = 0; j < segs; j++) for (let i = 0; i < rad; i++) {
    const A = j * cols + i, B = A + 1, C = A + cols, D = C + 1;
    if (inside) index.push(A, C, B, B, C, D); else index.push(A, B, C, B, D, C);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("arcLen", new THREE.Float32BufferAttribute(arcLen, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export const instance = (mesh, i, p, q, s) => {
  _p.set(p[0], p[1], p[2]);
  if (q && q.isQuaternion) _q.copy(q); else if (q) _q.set(q[0], q[1], q[2], q[3]); else _q.identity();
  if (Array.isArray(s)) _s.set(s[0], s[1], s[2]); else _s.setScalar(s ?? 1);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
};
