// swarm.js — seeded instanced particles for the science films (kits/cinema/sci). Brand-neutral.
// Each particle has a home, wanders around it as a sum of sines, and can ease over to a target:
//     p_i(t) = lerp(home_i, target_i, mix_i(t)) + Σ_w A_w · sin(ω_w,i · t + φ_w,i)       (per axis)
// with every phase and frequency drawn once from a seeded generator, so any frame can be sought alone.
// Body: O₂ and CO₂ diffusing out of a capillary, vesicles, a crowd of cells drifting in an artery.
// Physics: a lattice (waves only), a liquid (bigger waves), a gas (a box fold). Space: ejecta, tally sprites.
//
//   import { swarm } from "cinema/sci/swarm.js";
//   const S = swarm({ n: 120, seed: 7, home: { sphere: { c: [0, 0, 0], r: 2 } }, waves: [{ amp: 0.3, omega: 1.4 }],
//                     target: (i, r) => [r() * 40 - 20, 30 + r() * 10, -5], move: { t0: 56.3, d: 1.6, stagger: 1.2 } });
//   const mesh = S.mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshStandardMaterial());
//   window.seek = (t) => { ...; S.write(mesh, t, { scale: (i, t) => (t > 56 ? 1 : 0) }); ... };
//   hud.label("o2", { text: "oxygen", glyph: "O₂", at: (t) => S.at(7, t) });
//
// swarm(o) → S
//   o.n           how many particles
//   o.seed        an integer: the same seed gives the same swarm on every machine
//   o.home        (i, r) => [x, y, z] (r() is particle i's own generator), or { box: [[x0, y0, z0], [x1, y1, z1]] },
//                 or { sphere: { c: [x, y, z], r } } (uniform in the volume), or { shell: { c, r0, r1 } }
//   o.waves       [{ amp: a | [ax, ay, az], omega: rad per second, jitter: 0.25 (± fraction of omega per particle) }]
//   o.target      optional (i, r) => [x, y, z], or the same shapes as home: where each particle eases to
//   o.move        optional: { t0, d = 1, stagger = 0, ease = "inout" } (particle i starts at t0 + stagger·u_i, u_i
//                 seeded in [0, 1), and takes d seconds), or a function (i, t) => 0..1
//   o.fold        optional { lo: [x, y, z], hi: [x, y, z] }: positions are folded back into the box with a
//                 triangle wave (a gas bouncing between walls, still a closed form)
//   o.time        optional (t) => scene time for the waves (a clock.js tau); default t
//   S.n, S.home(i), S.target(i), S.mix(i, t), S.at(i, t) → [x, y, z], S.rand(i, k) (particle i's k-th draw)
//   S.centroid(t)          the mean position (a HUD anchor for "these")
//   S.mesh(geometry, material, count = n) → a THREE.InstancedMesh (frustumCulled off: instances move)
//   S.write(mesh, t, o)    o: { scale: number | (i, t) => s, offset: 0 (first instance slot), spin: 0 (rad per
//                          second of tumble), quat: (i, t) => THREE.Quaternion } — writes instance matrices
//                          (and sets needsUpdate). Particles at scale 0 are left at their own position (never
//                          parked far away), so a motion probe that reads instance origins sees no jump.
//   S.speed(i, t, dt)      screen-independent travel per dt (world units), for a probe's sampling decisions
import * as THREE from "three";
import { rng, E } from "../film/runtime.js";

const easeOf = (e) => (typeof e === "function" ? e : E[e] || { inout: E.inout3, out: E.out3, in: E.in3 }[e] || E.inout3);
const tri = (x, lo, hi) => { const w = hi - lo; if (!(w > 0)) return lo; const u = (((x - lo) % (2 * w)) + 2 * w) % (2 * w); return lo + (u <= w ? u : 2 * w - u); };

const shape = (spec) => {
  if (typeof spec === "function") return spec;
  if (!spec) return () => [0, 0, 0];
  if (spec.box) { const [a, b] = spec.box; return (i, r) => [a[0] + (b[0] - a[0]) * r(), a[1] + (b[1] - a[1]) * r(), a[2] + (b[2] - a[2]) * r()]; }
  const ball = (c, r0, r1) => (i, r) => {
    const z = 2 * r() - 1, a = 2 * Math.PI * r(), q = Math.sqrt(1 - z * z);
    const rr = Math.cbrt(r0 ** 3 + (r1 ** 3 - r0 ** 3) * r());
    return [c[0] + q * Math.cos(a) * rr, c[1] + q * Math.sin(a) * rr, c[2] + z * rr];
  };
  if (spec.sphere) return ball(spec.sphere.c || [0, 0, 0], 0, spec.sphere.r);
  if (spec.shell) return ball(spec.shell.c || [0, 0, 0], spec.shell.r0, spec.shell.r1);
  throw new Error("swarm: home/target is a function, { box }, { sphere } or { shell }");
};

export const swarm = (o = {}) => {
  const n = o.n ?? 64, seed = (o.seed ?? 1) >>> 0;
  const gen = (i, salt) => rng((seed * 2654435761) ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b));
  const homeF = shape(o.home), targetF = o.target ? shape(o.target) : null;
  const waves = (o.waves || []).map((w) => ({ a: Array.isArray(w.amp) ? w.amp : [w.amp, w.amp, w.amp], om: w.omega ?? 1, jit: w.jitter ?? 0.25 }));
  const HOME = [], TARGET = [], PH = [], OM = [], U = [];
  for (let i = 0; i < n; i++) {
    HOME.push(homeF(i, gen(i, 1)));
    TARGET.push(targetF ? targetF(i, gen(i, 2)) : null);
    const r = gen(i, 3), ph = [], om = [];
    for (const w of waves) { ph.push([r() * 2 * Math.PI, r() * 2 * Math.PI, r() * 2 * Math.PI]); om.push(w.om * (1 + w.jit * (2 * r() - 1))); }
    PH.push(ph); OM.push(om); U.push(gen(i, 4)());
  }
  const mv = o.move, ez = mv && typeof mv !== "function" ? easeOf(mv.ease || "inout") : null;
  const mix = (i, t) => {
    if (!targetF || !mv) return 0;
    if (typeof mv === "function") return mv(i, t);
    const a = mv.t0 + (mv.stagger ?? 0) * U[i], d = mv.d ?? 1;
    return ez(Math.min(1, Math.max(0, (t - a) / d)));
  };
  const time = o.time || ((t) => t);
  const at = (i, t) => {
    const h = HOME[i], g = TARGET[i], m = mix(i, t), tt = time(t);
    const p = g ? [h[0] + (g[0] - h[0]) * m, h[1] + (g[1] - h[1]) * m, h[2] + (g[2] - h[2]) * m] : [h[0], h[1], h[2]];
    for (let w = 0; w < waves.length; w++) {
      const A = waves[w].a, om = OM[i][w], ph = PH[i][w];
      p[0] += A[0] * Math.sin(om * tt + ph[0]); p[1] += A[1] * Math.sin(om * tt + ph[1]); p[2] += A[2] * Math.sin(om * tt + ph[2]);
    }
    if (o.fold) { const { lo, hi } = o.fold; for (let k = 0; k < 3; k++) p[k] = tri(p[k], lo[k], hi[k]); }
    return p;
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
  const S = {
    n, home: (i) => HOME[i].slice(), target: (i) => (TARGET[i] ? TARGET[i].slice() : null), mix, at,
    rand: (i, k) => { const r = gen(i, 10 + k); return r(); },
    centroid: (t) => { const c = [0, 0, 0]; for (let i = 0; i < n; i++) { const p = at(i, t); c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return c.map((x) => x / n); },
    speed: (i, t, dt = 1 / 60) => { const a = at(i, t - dt / 2), b = at(i, t + dt / 2); return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); },
    mesh: (geometry, material, count = n) => { const m = new THREE.InstancedMesh(geometry, material, count); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m; },
    write: (mesh, t, w = {}) => {
      const off = w.offset ?? 0, spin = w.spin ?? 0;
      for (let i = 0; i < n; i++) {
        const p = at(i, t), s = typeof w.scale === "function" ? w.scale(i, t) : w.scale ?? 1;
        if (w.quat) q.copy(w.quat(i, t));
        else if (spin) { const tt = time(t); e.set(PH[i][0] ? PH[i][0][0] + spin * tt : 0, PH[i][0] ? PH[i][0][1] + spin * 0.7 * tt : 0, 0); q.setFromEuler(e); }
        else q.identity();
        m4.compose(pv.set(p[0], p[1], p[2]), q, sv.setScalar(Math.max(0, s)));
        mesh.setMatrixAt(off + i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
  return S;
};
