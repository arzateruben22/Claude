// strobe.js — the strobe ladder (kits/cinema/sci): ghost stamps of a moving thing at equal steps of its own
// clock, τk = τ0 + kΔ, drawn as ONE opaque InstancedMesh, plus optional rungs that join the ghosts with the
// same k across two ladders. Brand-neutral: colours come from the caller (linear, as three.js wants them).
// Physics stamps a falling ball every 1/20 s; space can show Kepler's equal areas with it; body, cell
// positions along a vessel.
//
//   import { strobe } from "cinema/sci/strobe.js";
//   const S = strobe({ geometry: new THREE.SphereGeometry(1, 24, 16), radius: 3.35, max: 48, rungs: { max: 24, radius: 0.25 } });
//   scene.add(S.group);
//   S.ladder("drop", { at: (tau) => [x, y(tau), z], dt: 0.05, n: 10, when: (tau) => clk.tOf(tauR + tau), t0, t1, slot: 0, color });
//   S.rung("r", { a: "drop", b: "throw", k: [0, 9], at: (k) => tStart(k), grow: 0.3, t1, slot: 0, color });
//   window.seek = (t) => { ...; S.update(t); ...; renderer.render(scene, camera); };
//   hud.label("g5", { text: "1/20 s apart", at: () => S.ghost("drop", 5) });
//
// Everything is a pure function of t. A ghost is a copy of the subject at its own time τk (the ladder's
// `at(τ)`), so the gaps you measure are the real ones; `when(τ)` says at which film time the subject
// reaches τ (a clock.js clock's tOf, offset by the take's release), and the ghost pops in then (scale
// 0 → 1 over `pop` film seconds with a small overshoot) and stays until the ladder's window ends at t1.
//
// Instances and the finish's motion probe (cinema3d.js samples instance positions, never scale):
//   - every ghost slot of a ladder sits at its ghost's own position for the whole window [t0, t1), scale
//     0 until it pops, so popping in reads as no motion (K stays low);
//   - a slot outside every window is parked (scale 0) at one fixed spot, `park`. The probe reads parked
//     instances too, so park inside the set (the default is the world origin): a far-off point such as
//     y = −10⁴ swings across the screen with every camera move and pins K at kMax;
//   - ladders in different takes can share slots (`slot`: the first instance index; default: the next
//     free range, in creation order). Two ladders that are on screen at once must not overlap. Put a
//     take's window edges on cuts (half a frame before a frame) and slots only change between frames.
//   - rungs are a second InstancedMesh: a unit bar along +x from its origin, so the instance origin stays
//     on ghost (a, k) while the bar grows toward ghost (b, k).
//
// strobe(o) → S
//   o: { geometry (default unit sphere 24×16), material (default MeshLambertMaterial, white: instance colours
//        tint it), radius: 1 (the ghost's uniform scale; a ladder's `scale` multiplies it), max: 48, pop: 0.18,
//        park: [0, 0, 0] (a point inside the set), rim: null | { color: [r, g, b] linear, width: 0.35, strength: 0.75 } (darkens
//        the ghost's silhouette so a pale stamp still reads on a pale ground),
//        rungs: null | { max: 24, radius: 0.25, material, segments: 10 } }
//   S.ladder(id, { at, tau0 = 0, dt, n, when = (τ) => τ, t0 = -Infinity, t1 = Infinity, color, scale = 1 |
//        [sx, sy, sz], slot, pop }) → ghosts k = 0 … n−1 at τk = tau0 + k·dt
//   S.rung(id, { a, b, k: [k0, k1] (inclusive; default every k both ladders have), at: (k) => film t the
//        bar starts to grow (default: when ghost k of the later ladder pops), grow: 0.3, t0, t1 (default the
//        ladders' window), slot, color, radius }) → one bar per k
//   S.update(t)            write every instance for film time t
//   S.ghost(id, k)         [x, y, z] of ghost k (its centre; for HUD anchors and rungs)
//   S.stampAt(id, k)       the film time ghost k pops in (for the cue sheet: a "strobe" event)
//   S.stamps(id)           [{ k, t, tau }] for every ghost of the ladder
//   S.shown(id, k, t)      true once ghost k is fully there at t (inside the ladder's window)
//   S.mesh, S.rungMesh, S.group
import * as THREE from "three";
import { seg, E } from "../film/runtime.js";

const v3 = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

export const strobe = (o = {}) => {
  const max = o.max ?? 48, R = o.radius ?? 1, POP = o.pop ?? 0.18, PARK = o.park ?? [0, 0, 0];
  const geometry = o.geometry || new THREE.SphereGeometry(1, 24, 16);
  const material = o.material || new THREE.MeshLambertMaterial({ color: 0xffffff });
  if (o.rim) {
    const rc = o.rim.color || [0.08, 0.08, 0.09], rw = o.rim.width ?? 0.35, rs = o.rim.strength ?? 0.75;
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      // the silhouette darkens toward the rim colour: 1 − |n·v| is 0 facing the camera and 1 at the edge
      sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>",
        `{ float edge = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
           outgoingLight = mix(outgoingLight, vec3(${rc.map((c) => c.toFixed(5)).join(", ")}), ${rs.toFixed(3)} * smoothstep(${(1 - rw).toFixed(3)}, 1.0, edge)); }
         #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => "strobe-rim:" + rc.join(",") + ":" + rw + ":" + rs;
  }
  const mesh = new THREE.InstancedMesh(geometry, material, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < max; i++) mesh.setColorAt(i, white);
  const group = new THREE.Group();
  group.add(mesh);

  let rungMesh = null, RR = 0.25, RMAX = 0;
  if (o.rungs) {
    RMAX = o.rungs.max ?? 24; RR = o.rungs.radius ?? 0.25;
    const bar = new THREE.CylinderGeometry(1, 1, 1, o.rungs.segments ?? 10, 1, false);
    bar.rotateZ(-Math.PI / 2); bar.translate(0.5, 0, 0);       // a unit bar along +x from the origin
    rungMesh = new THREE.InstancedMesh(bar, o.rungs.material || new THREE.MeshBasicMaterial({ color: 0xffffff }), RMAX);
    rungMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rungMesh.frustumCulled = false;
    for (let i = 0; i < RMAX; i++) rungMesh.setColorAt(i, white);
    group.add(rungMesh);
  }

  const L = new Map(), RG = new Map();
  let nextSlot = 0, nextRung = 0;
  const colorOf = (c) => (c == null ? white : c.isColor ? c : Array.isArray(c) ? new THREE.Color().setRGB(c[0], c[1], c[2]) : new THREE.Color(c));

  const ladder = (id, d) => {
    const n = d.n | 0, slot = d.slot ?? nextSlot;
    if (slot + n > max) throw new Error(`strobe: ladder "${id}" needs slots ${slot}–${slot + n - 1}, but max is ${max}`);
    nextSlot = Math.max(nextSlot, slot + n);
    const tau0 = d.tau0 ?? 0, dt = d.dt, when = d.when || ((x) => x);
    const pos = [], at = [];
    for (let k = 0; k < n; k++) { const tau = tau0 + k * dt; pos.push(v3(d.at(tau))); at.push(when(tau)); }
    const sc = d.scale ?? 1, s3 = Array.isArray(sc) ? sc : [sc, sc, sc];
    L.set(id, { id, n, slot, pos, at, tau0, dt, t0: d.t0 ?? -Infinity, t1: d.t1 ?? Infinity, color: colorOf(d.color), s3, pop: d.pop ?? POP });
    return L.get(id);
  };
  const rung = (id, d) => {
    if (!rungMesh) throw new Error("strobe: rungs need o.rungs");
    const A = L.get(d.a), B = L.get(d.b);
    if (!A || !B) throw new Error(`strobe: rung "${id}" joins unknown ladders ${d.a} / ${d.b}`);
    const k0 = d.k ? d.k[0] : 0, k1 = d.k ? d.k[1] : Math.min(A.n, B.n) - 1, n = k1 - k0 + 1, slot = d.slot ?? nextRung;
    if (slot + n > RMAX) throw new Error(`strobe: rung "${id}" needs slots ${slot}–${slot + n - 1}, but rungs.max is ${RMAX}`);
    nextRung = Math.max(nextRung, slot + n);
    const starts = [];
    for (let k = k0; k <= k1; k++) starts.push(d.at ? d.at(k) : Math.max(A.at[k], B.at[k]) + (d.delay ?? 0));
    RG.set(id, { id, A, B, k0, k1, slot, starts, grow: d.grow ?? 0.3, t0: d.t0 ?? Math.max(A.t0, B.t0), t1: d.t1 ?? Math.min(A.t1, B.t1),
      color: colorOf(d.color), r: d.radius ?? RR });
  };

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0), dir = new THREE.Vector3();
  const zero = new THREE.Vector3(0, 0, 0);
  const update = (t) => {
    const owned = new Uint8Array(max);
    for (const ld of L.values()) {
      if (!(t >= ld.t0 && t < ld.t1)) continue;
      for (let k = 0; k < ld.n; k++) {
        const i = ld.slot + k, p = ld.pos[k], u = seg(t, ld.at[k], ld.at[k] + ld.pop);
        const s = t < ld.at[k] ? 0 : u >= 1 ? 1 : Math.max(0, E.back(u));
        sv.set(R * ld.s3[0] * s, R * ld.s3[1] * s, R * ld.s3[2] * s);
        m4.compose(pv.set(p[0], p[1], p[2]), q.identity(), sv);
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, ld.color);
        owned[i] = 1;
      }
    }
    for (let i = 0; i < max; i++) if (!owned[i]) { m4.compose(pv.set(PARK[0], PARK[1], PARK[2]), q.identity(), zero); mesh.setMatrixAt(i, m4); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (!rungMesh) return;
    const rOwned = new Uint8Array(RMAX);
    for (const rg of RG.values()) {
      if (!(t >= rg.t0 && t < rg.t1)) continue;
      for (let k = rg.k0; k <= rg.k1; k++) {
        const i = rg.slot + (k - rg.k0), a = rg.A.pos[k], b = rg.B.pos[k], st = rg.starts[k - rg.k0];
        const g = t < st ? 0 : E.out3(seg(t, st, st + rg.grow));
        dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const len = dir.length();
        if (len > 1e-9) q.setFromUnitVectors(xAxis, dir.multiplyScalar(1 / len)); else q.identity();
        const show = g > 0 ? 1 : 0;
        sv.set(Math.max(1e-6, len * g) * show, rg.r * show, rg.r * show);
        m4.compose(pv.set(a[0], a[1], a[2]), q, sv);
        rungMesh.setMatrixAt(i, m4);
        rungMesh.setColorAt(i, rg.color);
        rOwned[i] = 1;
      }
    }
    for (let i = 0; i < RMAX; i++) if (!rOwned[i]) { m4.compose(pv.set(PARK[0], PARK[1], PARK[2]), q.identity(), zero); rungMesh.setMatrixAt(i, m4); }
    rungMesh.instanceMatrix.needsUpdate = true;
    if (rungMesh.instanceColor) rungMesh.instanceColor.needsUpdate = true;
  };

  const get = (id) => { const ld = L.get(id); if (!ld) throw new Error(`strobe: no ladder "${id}"`); return ld; };
  const ghost = (id, k) => get(id).pos[k].slice();
  const stampAt = (id, k) => get(id).at[k];
  const stamps = (id) => { const ld = get(id); return ld.pos.map((_, k) => ({ k, t: ld.at[k], tau: ld.tau0 + k * ld.dt })); };
  const shown = (id, k, t) => { const ld = get(id); return t >= ld.t0 && t < ld.t1 && t >= ld.at[k] + ld.pop; };
  return { ladder, rung, update, ghost, stampAt, stamps, shown, mesh, rungMesh, group, ladders: L, rungs: RG };
};
