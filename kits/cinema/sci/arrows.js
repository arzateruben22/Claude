// arrows.js — vectors for the science films (kits/cinema/sci): up to 64 instanced arrows (a shaft and a cone
// head) with an ink outline, length proportional to the quantity, and tail / tip / mid anchors for HUD
// labels. Brand-neutral: the caller gives colours (linear, as three.js wants them; a channel whose finish
// tone-maps can pass ACES-inverse values so an unlit arrow lands exactly on its token).
//
//   import { arrows } from "cinema/sci/arrows.js";
//   const AR = arrows({ max: 32, shaft: 0.55, head: [3.2, 1.4], outline: 0.3, ink: [0.02, 0.02, 0.03] });
//   scene.add(AR.group);
//   AR.add("g1", { tail: (t) => ballAt(t), vec: () => [0, -20, 0], color: cobalt, t0: 3.2, t1: 6.0 });
//   window.seek = (t) => { ...; AR.update(t); hud.update(t); renderer.render(scene, camera); };
//   hud.label("g1", { text: "gravity", color: "force", at: (t) => AR.tip("g1", t) });
//
// Geometry: the shaft is a cylinder from the tail to the base of the head; the head is a cone of length
// head[0] and radius head[1]. An arrow shorter than 1.6 head lengths scales its head down with it, so a
// 1 cm displacement is still an arrow, not a cone. The outline is the "inverted hull": a slightly fatter
// copy of each part drawn back-faces-only in the ink colour, so it shows only around the silhouette.
// Four InstancedMeshes in all (shaft, head, and their outlines), whatever the number of arrows.
//
// Every instance's origin is the arrow's tail (the head's is the head's base), so the finish's motion
// probe (cinema3d.js samples instance positions) sees an arrow move when its tail moves, not when it
// grows. An arrow holds its slot, at its tail with scale 0 while it is not drawn, for its `hold` window
// (default [t0, t1 + shrink]); give it the take's window (cut to cut) so the slot never jumps between
// the two probe samples of a frame. A slot nobody holds is parked at `park`, which should be a point
// inside the set: the probe reads parked instances too, and a far-off point (y = −10⁴) swings across the
// screen with every camera move and pins K at kMax.
//
// arrows(o) → A
//   o: { max: 32 (≤ 64), shaft: 0.5 (radius), head: [len, radius] = [3, 1.2], outline: 0.25 (0 = none),
//        ink: [r, g, b] linear (default near-black), material: "basic" (unlit, exact colours) | "standard"
//        | a THREE.Material (instance colours tint it), segments: 18, park: [0, 0, 0] }
//   A.add(id, { tail: (t) => [x, y, z], vec: (t) => [dx, dy, dz] | tip: (t) => [x, y, z], color, t0, t1,
//        grow: 0.3 (film s, the arrow draws out from its tail), shrink: 0.2 (it retracts into its tail after
//        t1), slot, width: 1 (multiplies shaft and head radius), hold: [h0, h1] (film s the slot
//        stays at this tail, scale 0 when not drawn; default [t0, t1 + shrink]) })
//   A.update(t)            write every instance for film time t
//   A.tail(id, t) / A.tip(id, t) / A.mid(id, t)   [x, y, z] as drawn at t (tip and mid follow the growth)
//   A.len(id, t)           the drawn length at t
//   A.on(id, t)            0–1, how far the arrow has drawn out (for fading a label with it)
//   A.group, A.meshes
import * as THREE from "three";
import { seg, E } from "../film/runtime.js";

const v3 = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

export const arrows = (o = {}) => {
  const max = Math.min(64, o.max ?? 32), SH = o.shaft ?? 0.5, [HL, HR] = o.head || [3, 1.2], OUT = o.outline ?? 0.25;
  const seg_ = o.segments ?? 18, PARK = o.park ?? [0, 0, 0];
  const shaftG = new THREE.CylinderGeometry(1, 1, 1, seg_, 1, false); shaftG.translate(0, 0.5, 0);   // y ∈ [0, 1]
  const headG = new THREE.ConeGeometry(1, 1, seg_, 1, false); headG.translate(0, 0.5, 0);            // base at 0, tip at 1
  const mat = o.material && o.material.isMaterial ? o.material
    : o.material === "standard" ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 })
    : new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ink = o.ink || [0.012, 0.013, 0.016];
  const inkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(ink[0], ink[1], ink[2]), side: THREE.BackSide });
  const mk = (g, m) => { const x = new THREE.InstancedMesh(g, m, max); x.instanceMatrix.setUsage(THREE.DynamicDrawUsage); x.frustumCulled = false; return x; };
  const shaft = mk(shaftG, mat), head = mk(headG, mat);
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < max; i++) { shaft.setColorAt(i, white); head.setColorAt(i, white); }
  const group = new THREE.Group();
  const meshes = [shaft, head];
  let oShaft = null, oHead = null;
  if (OUT > 0) { oShaft = mk(shaftG, inkMat); oHead = mk(headG, inkMat); meshes.push(oShaft, oHead); }
  for (const m of meshes) group.add(m);

  const A = new Map();
  let next = 0;
  const colorOf = (c) => (c == null ? white : c.isColor ? c : Array.isArray(c) ? new THREE.Color().setRGB(c[0], c[1], c[2]) : new THREE.Color(c));
  const add = (id, d) => {
    const slot = d.slot ?? next;
    if (slot >= max) throw new Error(`arrows: "${id}" needs slot ${slot}, but max is ${max}`);
    next = Math.max(next, slot + 1);
    A.set(id, { id, slot, tail: d.tail, vec: d.vec, tipF: d.tip, color: colorOf(d.color), t0: d.t0 ?? -Infinity, t1: d.t1 ?? Infinity,
      grow: d.grow ?? 0.3, shrink: d.shrink ?? 0.2, w: d.width ?? 1, hold: d.hold || null });
  };
  const get = (id) => { const a = A.get(id); if (!a) throw new Error(`arrows: no arrow "${id}"`); return a; };
  const on = (id, t) => {
    const a = get(id);
    const g = a.t0 === -Infinity ? 1 : E.out3(seg(t, a.t0, a.t0 + a.grow));
    const s = a.t1 === Infinity ? 1 : 1 - E.in3(seg(t, a.t1, a.t1 + a.shrink));
    return Math.max(0, Math.min(g, s));
  };
  const full = (a, t) => {
    const tl = v3(typeof a.tail === "function" ? a.tail(t) : a.tail);
    let v;
    if (a.tipF) { const tp = v3(typeof a.tipF === "function" ? a.tipF(t) : a.tipF); v = [tp[0] - tl[0], tp[1] - tl[1], tp[2] - tl[2]]; }
    else v = v3(typeof a.vec === "function" ? a.vec(t) : a.vec);
    return { tl, v };
  };
  const tail = (id, t) => full(get(id), t).tl;
  const tip = (id, t) => { const a = get(id), { tl, v } = full(a, t), g = on(id, t); return [tl[0] + v[0] * g, tl[1] + v[1] * g, tl[2] + v[2] * g]; };
  const mid = (id, t) => { const a = get(id), { tl, v } = full(a, t), g = on(id, t) / 2; return [tl[0] + v[0] * g, tl[1] + v[1] * g, tl[2] + v[2] * g]; };
  const len = (id, t) => { const { v } = full(get(id), t); return Math.hypot(v[0], v[1], v[2]) * on(id, t); };

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), zero = new THREE.Vector3();
  const put = (mesh, i, p, s3) => { if (!mesh) return; m4.compose(pv.set(p[0], p[1], p[2]), q, sv.set(s3[0], s3[1], s3[2])); mesh.setMatrixAt(i, m4); };
  const update = (t) => {
    const owned = new Uint8Array(max);
    for (const a of A.values()) {
      const drawn = t >= a.t0 - 1e-9 && t < a.t1 + a.shrink, held = a.hold ? t >= a.hold[0] && t < a.hold[1] : drawn;
      if (!(drawn || held) || (owned[a.slot] && !drawn)) continue;   // a drawn arrow wins its slot over one only holding it
      const i = a.slot, { tl, v } = full(a, t), g = drawn ? on(a.id, t) : 0;
      const L = Math.hypot(v[0], v[1], v[2]) * g;
      if (L > 1e-9) q.setFromUnitVectors(yAxis, dir.set(v[0], v[1], v[2]).normalize()); else q.identity();
      const hl = Math.min(HL, L / 1.6) || 0, hr = HR * a.w * (HL > 0 ? hl / HL : 0), sr = SH * a.w * Math.min(1, hl > 0 ? 0.35 + 0.65 * hl / HL : 0);
      const sl = Math.max(0, L - hl), d = L > 1e-9 ? [v[0] / Math.hypot(v[0], v[1], v[2]), v[1] / Math.hypot(v[0], v[1], v[2]), v[2] / Math.hypot(v[0], v[1], v[2])] : [0, 1, 0];
      const hb = [tl[0] + d[0] * sl, tl[1] + d[1] * sl, tl[2] + d[2] * sl];
      const vis = L > 1e-6 ? 1 : 0;
      put(shaft, i, tl, [sr * vis, Math.max(1e-6, sl) * vis, sr * vis]);
      put(head, i, hb, [hr * vis, Math.max(1e-6, hl) * vis, hr * vis]);
      if (OUT > 0) {
        // the outline hull: fatter by OUT all round, and longer at both ends (the cone's slant grows its tip by OUT / sin(half-angle))
        const slope = hl > 0 ? Math.hypot(hl, hr) / hr : 1;
        put(oShaft, i, [tl[0] - d[0] * OUT, tl[1] - d[1] * OUT, tl[2] - d[2] * OUT], [(sr + OUT) * vis, Math.max(1e-6, sl + OUT) * vis, (sr + OUT) * vis]);
        put(oHead, i, [hb[0] - d[0] * OUT * 0.5, hb[1] - d[1] * OUT * 0.5, hb[2] - d[2] * OUT * 0.5], [(hr + OUT * slope) * vis, Math.max(1e-6, hl + OUT * (0.5 + slope)) * vis, (hr + OUT * slope) * vis]);
      }
      shaft.setColorAt(i, a.color); head.setColorAt(i, a.color);
      owned[i] = 1;
    }
    q.identity();
    for (let i = 0; i < max; i++) if (!owned[i]) { sv.copy(zero); for (const m of meshes) { m4.compose(pv.set(PARK[0], PARK[1], PARK[2]), q, zero); m.setMatrixAt(i, m4); } }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    shaft.instanceColor.needsUpdate = true; head.instanceColor.needsUpdate = true;
  };
  return { add, update, tail, tip, mid, len, on, group, meshes, arrows: A };
};
