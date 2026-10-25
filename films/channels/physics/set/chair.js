// chair.js — a swivel chair and a seated wooden mannequin holding two dumbbells (films/channels/physics/set), in
// centimetres: the human-scale anchor of episode 5. Primitives only, lit, albedo ≤ 0.7. The mannequin is an artist's
// figure (no face, no likeness). Its arms reach for a hand distance R from the turning axis by two-bone IK, so the
// spin model (set/spin.js) drives them: R = 80 cm, arms straight out to the sides; R = 20 cm, the hands at the chest.
//
//   import { createSitter } from "../set/chair.js";
//   const C = createSitter({ x: 0, z: 0 });
//   scene.add(C.group);
//   C.set(phi, R)                  // the turned angle (rad, counter-clockwise seen from above) and the hands' distance (cm)
//   C.hand(i) → [x, y, z]          // dumbbell i's centre in world space, after set()
//   C.handAt(phi, R, i) → [x, y, z] // the same for any pose, without touching the meshes (ghosts, labels)
//   C.base, C.top                  // the fixed star base and the turning part
import * as THREE from "three";
import { albedo } from "./aces.js";

export const createSitter = (o = {}) => {
  const group = new THREE.Group(), top = new THREE.Group();
  group.position.set(o.x ?? 0, 0, o.z ?? 0);
  const steel = new THREE.MeshStandardMaterial({ color: albedo("#3B3E45"), roughness: 0.45, metalness: 0.35 });
  const seatM = new THREE.MeshStandardMaterial({ color: albedo("#2C3A57"), roughness: 0.85, metalness: 0 });
  const wood = new THREE.MeshStandardMaterial({ color: albedo("#B89A72"), roughness: 0.7, metalness: 0 });
  const iron = new THREE.MeshStandardMaterial({ color: albedo("#2A2B2F"), roughness: 0.5, metalness: 0.4 });
  const cap = (r, len) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), wood);
  // the base: five legs and casters, a gas column (fixed)
  const base = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const a = (k * 2 * Math.PI) / 5, leg = new THREE.Mesh(new THREE.BoxGeometry(30, 2.4, 4), steel);
    leg.position.set(15 * Math.cos(a), 7, -15 * Math.sin(a)); leg.rotation.y = a; base.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.2, 14), iron); wheel.rotation.x = Math.PI / 2;
    wheel.position.set(29 * Math.cos(a), 2.6, -29 * Math.sin(a)); base.add(wheel);
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 38, 16), steel); col.position.y = 26; base.add(col);
  group.add(base);
  // the turning part: seat, back, the sitter
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(24, 23, 7, 32), seatM); seat.position.y = 48;
  const back = new THREE.Mesh(new THREE.BoxGeometry(40, 46, 5), seatM); back.position.set(0, 80, -21); back.rotation.x = -0.08;
  const backPost = new THREE.Mesh(new THREE.BoxGeometry(4, 30, 3), steel); backPost.position.set(0, 58, -22);
  top.add(seat, back, backPost);
  const pelvis = cap(12, 14); pelvis.rotation.z = Math.PI / 2; pelvis.position.set(0, 58, -4);
  const torso = cap(13, 26); torso.position.set(0, 82, -6); torso.scale.set(1.1, 1, 0.75);
  const neck = cap(4, 4); neck.position.set(0, 104, -6);
  const head = new THREE.Mesh(new THREE.SphereGeometry(10.5, 28, 20), wood); head.position.set(0, 117, -5); head.scale.set(0.9, 1.08, 0.95);
  top.add(pelvis, torso, neck, head);
  [-1, 1].forEach((s) => {                                // the legs: thighs forward, shins down, feet on the floor
    const thigh = cap(6.5, 34); thigh.rotation.x = Math.PI / 2; thigh.position.set(s * 10, 56, 16); top.add(thigh);
    const shin = cap(5, 36); shin.position.set(s * 10, 30, 36); top.add(shin);
    const foot = cap(4, 12); foot.rotation.x = Math.PI / 2; foot.position.set(s * 10, 6, 42); top.add(foot);
  });
  // the arms: shoulder → elbow → hand by two-bone IK; a dumbbell in each hand (its bar front-to-back)
  const A1 = 31, A2 = 31, shoulders = [-1, 1].map((s) => new THREE.Vector3(s * 19, 98, -6));
  const upper = [], fore = [], hands = [], bells = [], elbows = [];
  const ug = new THREE.CylinderGeometry(4.6, 4.2, 1, 14), fg = new THREE.CylinderGeometry(4.0, 3.5, 1, 14);   // unit height: a bone scales y only
  for (let i = 0; i < 2; i++) {
    const u = new THREE.Mesh(ug, wood), f = new THREE.Mesh(fg, wood), h = new THREE.Mesh(new THREE.SphereGeometry(4.4, 16, 12), wood);
    const b = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 15, 12), iron); bar.rotation.x = Math.PI / 2; b.add(bar);
    [-1, 1].forEach((e) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 4, 6), iron); w.rotation.x = Math.PI / 2; w.position.z = e * 6.5; b.add(w); });
    const e = new THREE.Mesh(new THREE.SphereGeometry(4.4, 14, 10), wood), sh = new THREE.Mesh(new THREE.SphereGeometry(5.4, 14, 10), wood);
    sh.position.copy(shoulders[i]);
    top.add(u, f, h, b, e, sh); upper.push(u); fore.push(f); hands.push(h); bells.push(b); elbows.push(e);
  }
  group.add(top);
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  const bone = (mesh, a, b, len) => {                       // a capsule from a to b
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    tmp.copy(b).sub(a); const l = tmp.length();
    q.setFromUnitVectors(up, tmp.normalize()); mesh.quaternion.copy(q); mesh.scale.set(1, Math.max(0.01, l), 1);   // len: the rest length (unused)
  };
  const T = new THREE.Vector3(), Eb = new THREE.Vector3(), dir = new THREE.Vector3(), pole = new THREE.Vector3(), side = new THREE.Vector3();
  const handTarget = (i, R) => {                            // out: straight to the side; in: in front of the chest
    const s = i ? 1 : -1, k = Math.max(0, Math.min(1, (R - 20) / 60));
    const ang = (Math.PI / 2) * (1 - k) * 0.82;             // the hand swings from the side (0) toward the front as it comes in
    const rr = R;
    return new THREE.Vector3(s * rr * Math.cos(ang), 95, rr * Math.sin(ang) + 4 * (1 - k));
  };
  const set = (phi, R) => {
    top.rotation.y = phi;
    for (let i = 0; i < 2; i++) {
      const S = shoulders[i]; T.copy(handTarget(i, R));
      dir.copy(T).sub(S); let d = dir.length(); const dmax = A1 + A2 - 0.5;
      if (d > dmax) { dir.multiplyScalar(dmax / d); T.copy(S).add(dir); d = dmax; }
      dir.normalize();
      const cosA = (A1 * A1 + d * d - A2 * A2) / (2 * A1 * d), a = Math.acos(Math.max(-1, Math.min(1, cosA)));
      pole.set(0, -0.6, -1).normalize();                    // the elbow bends down and back
      side.copy(pole).sub(tmp.copy(dir).multiplyScalar(pole.dot(dir))).normalize();
      Eb.copy(S).add(tmp.copy(dir).multiplyScalar(A1 * Math.cos(a))).add(side.multiplyScalar(A1 * Math.sin(a)));
      bone(upper[i], S, Eb, A1); bone(fore[i], Eb, T, A2);
      hands[i].position.copy(T); bells[i].position.copy(T); elbows[i].position.copy(Eb);
    }
  };
  // dumbbell i's centre in world space for a pose (pure: no matrices), for ghosts and labels
  const clampT = (i, R) => { const S = shoulders[i], t = handTarget(i, R), d = t.clone().sub(S), l = d.length(), m = A1 + A2 - 0.5;
    return l > m ? S.clone().add(d.multiplyScalar(m / l)) : t; };
  const handAt = (phi, R, i) => { const t = clampT(i, R), c = Math.cos(phi), s = Math.sin(phi);
    return [group.position.x + t.x * c + t.z * s, t.y, group.position.z - t.x * s + t.z * c]; };
  const hand = (i) => { top.updateMatrixWorld(true); const v = bells[i].position.clone(); top.localToWorld(v); return [v.x, v.y, v.z]; };
  set(0, 80);
  return { group, top, base, set, hand, handAt, handTarget };
};
