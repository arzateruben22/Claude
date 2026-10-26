// pendulum.js — B6 Oscillators' props for "the Bench" (films/channels/physics/set): a gantry with any number of
// pendulums hanging from one beam (the swing set of episode 2: two lanes; the pendulum wave: fifteen), in
// centimetres. The motion is set/swing.js (exact, closed form); this file only draws it. Primitives only; lit
// props keep albedo ≤ 0.7 (the cross-check: bright props compress toward white under the finish's ACES).
//
//   import { createGantry, brassGhost } from "../set/pendulum.js";
//   const R = createGantry({ pivots: [[0, 116, 0], [0, 116, -40]], L: [99.4, 99.4], r: 3.4, beamX: 0,
//                            post: [-70, -20] });        // an inverted-L post at x −70, z −20, its arm along x
//   scene.add(R.group);
//   R.set(i, θ)                                            // pendulum i at angle θ (radians, + toward +x)
//   R.bobAt(i, θ) → [x, y, z]                              // its bob's centre (labels, ghosts)
//   R.group.visible = false                                // a rig that is not in the shot
//
// Parts: a steel beam along z through the pivots (at x = beamX), a steel post and arm holding it, a small clamp at
// each pivot, an ink string (a thin cylinder from the pivot to the top of the bob) and a brass bob with a short
// hook on top. Mesh origins never jump (each string and bob is placed every frame from θ), so the finish's
// motion probe reads the real swing.
import * as THREE from "three";
import { albedo } from "./aces.js";

export const BRASS = "#A8843A";
export const brassGhost = () => albedo("#D2C7A2");          // the strobe ghosts: brass pulled toward the cyc, ≤ 0.7

export const createGantry = (o = {}) => {
  const pivots = o.pivots || [[0, 116, 0]], n = pivots.length;
  const Ls = Array.isArray(o.L) ? o.L : pivots.map(() => o.L ?? 99.4);
  const r = o.r ?? 3.4, beamX = o.beamX ?? pivots[0][0], y = pivots[0][1];
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: albedo("#3B3E45"), roughness: 0.45, metalness: 0.35 });
  const brass = new THREE.MeshStandardMaterial({ color: albedo(o.bob || BRASS), roughness: 0.38, metalness: 0.55 });
  const ink = new THREE.MeshStandardMaterial({ color: albedo("#24252A"), roughness: 0.7, metalness: 0 });
  const zs = pivots.map((p) => p[2]), z0 = Math.min(...zs) - (o.beamPad ?? 8), z1 = Math.max(...zs) + (o.beamPad ?? 8);
  const bw = o.beamW ?? 2.4;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(bw, bw, z1 - z0), steel);
  beam.position.set(beamX, y + bw / 2 + 0.4, (z0 + z1) / 2);
  group.add(beam);
  if (o.post !== null) {
    const [px, pz] = o.post || [beamX - 70, (z0 + z1) / 2];
    const top = y + bw + 0.4;
    const post = new THREE.Mesh(new THREE.BoxGeometry(2.8, top, 2.8), steel); post.position.set(px, top / 2, pz);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(beamX - px) + 2.8, bw, bw), steel); arm.position.set((px + beamX) / 2, y + bw / 2 + 0.4, pz);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 16), steel); foot.position.set(px, 0.6, pz);
    group.add(post, arm, foot);
  }
  const strGeo = new THREE.CylinderGeometry(o.string ?? 0.16, o.string ?? 0.16, 1, 8); strGeo.translate(0, -0.5, 0);   // hangs down from its origin
  const bobGeo = new THREE.SphereGeometry(r, 32, 22);
  const hookGeo = new THREE.CylinderGeometry(r * 0.16, r * 0.22, r * 0.5, 12);
  const clampGeo = new THREE.BoxGeometry(1.6, 1.4, 1.6);
  const strings = [], bobs = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(strGeo, ink); s.position.set(...pivots[i]); s.scale.set(1, Ls[i] - r * 1.15, 1);
    const b = new THREE.Group(); const ball = new THREE.Mesh(bobGeo, brass); const hook = new THREE.Mesh(hookGeo, brass); hook.position.y = r * 1.05;
    b.add(ball, hook);
    const c = new THREE.Mesh(clampGeo, steel); c.position.set(pivots[i][0], y + 0.3, pivots[i][2]);
    group.add(s, b, c); strings.push(s); bobs.push(b);
  }
  const bobAt = (i, th) => [pivots[i][0] + Ls[i] * Math.sin(th), pivots[i][1] - Ls[i] * Math.cos(th), pivots[i][2]];
  const set = (i, th) => {
    strings[i].rotation.z = th;
    const p = bobAt(i, th); bobs[i].position.set(p[0], p[1], p[2]); bobs[i].rotation.z = th;
  };
  for (let i = 0; i < n; i++) set(i, 0);
  return { group, set, bobAt, bobs, strings, pivots, L: Ls, r, materials: { steel, brass, ink } };
};
