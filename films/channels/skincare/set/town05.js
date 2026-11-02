// town05.js — No. 005's town (films/channels/skincare/set): a small model town seen from a drone at golden hour,
// standing in for the Nambour trial's households. Houses on a loose street grid (instanced boxes with pitched roofs,
// in the warm light), each with a marker above it that shows its group once chance has split them: cyan for daily
// sunscreen, lilac for "as they pleased". A model, not a map: no real streets, no real houses.
//
//   const T = createTown({ x: -4000, n: 120, seed: 5 });   scene.add(T.group);
//   T.set({ split, glow, years })   split: 0 … 1 the markers appear (in a seeded order) · glow: 0 … 1 the daily
//     group lights · years: 0 … 1 the town's light warms toward evening (time passing; the episode badges it)
//   T.at.centre() → the town's centre for keys and labels
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => s2l(parseInt(x.slice(i, i + 2), 16) / 255)); };

export const createTown = ({ x = -4000, n = 120, seed = 5, cyan = "#5FF2E8", lilac = "#C3A6FF" } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.x = x;
  // the ground: warm grass-and-earth in the low sun, with pale streets
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x6f6a3a, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  const streetMat = new THREE.MeshStandardMaterial({ color: 0xcdb894, roughness: 0.9 });
  for (let k = -3; k <= 3; k++) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(4, 240), streetMat); a.rotation.x = -Math.PI / 2; a.position.set(k * 30 + 2, 0.05, 0); g.add(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(240, 4), streetMat); b.rotation.x = -Math.PI / 2; b.position.set(0, 0.05, k * 30 - 4); g.add(b);
  }
  // houses: in the blocks between the streets, a few to a block
  const H = [];
  while (H.length < n) {
    const bx = Math.floor(R() * 6) - 3, bz = Math.floor(R() * 6) - 3;
    const hx = bx * 30 + 9 + R() * 18, hz = bz * 30 + 5 + R() * 18;
    if (H.some((h) => Math.hypot(h.x - hx, h.z - hz) < 8)) continue;
    H.push({ x: hx, z: hz, w: 5 + R() * 2.5, d: 6 + R() * 3, h: 3 + R() * 1.4, rot: (R() - 0.5) * 0.3, k: R(), daily: R() < 0.5 });
  }
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1e2c8, roughness: 0.8 }), roofMat = new THREE.MeshStandardMaterial({ color: 0xb4583f, roughness: 0.7 });
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), wallMat, n);
  const roofGeo = new THREE.CylinderGeometry(0.62, 0.62, 1, 3, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, n);
  const dm = new THREE.Object3D();
  H.forEach((h, i) => {
    dm.position.set(h.x, 0, h.z); dm.rotation.set(0, h.rot, 0); dm.scale.set(h.w, h.h, h.d); dm.updateMatrix(); walls.setMatrixAt(i, dm.matrix);
    dm.position.set(h.x, h.h + 0.9, h.z); dm.scale.set(h.w * 1.05, 1.6, h.d * 1.05); dm.updateMatrix(); roofs.setMatrixAt(i, dm.matrix);
  });
  g.add(walls, roofs);
  // trees: dark round crowns scattered in the blocks
  const trees = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.9 }), 90);
  for (let i = 0; i < 90; i++) { dm.position.set((R() - 0.5) * 220, 2.5, (R() - 0.5) * 220); dm.rotation.set(0, 0, 0); dm.scale.setScalar(2 + R() * 2); dm.updateMatrix(); trees.setMatrixAt(i, dm.matrix); }
  g.add(trees);
  // the markers: a small disc floating over each roof, cyan (daily) or lilac (as they pleased)
  const CY = hexLin(cyan), LI = hexLin(lilac);
  const markMat = new THREE.MeshBasicMaterial({ toneMapped: true, transparent: true });
  const marks = new THREE.InstancedMesh(new THREE.SphereGeometry(1.3, 14, 10), markMat, n);
  marks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  g.add(marks);
  return {
    group: g, houses: H,
    set({ split = 0, glow = 0 } = {}) {
      H.forEach((h, i) => {
        const s = Math.min(1, Math.max(0, (split - h.k * 0.7) / 0.3));
        dm.position.set(h.x, h.h + 4.2, h.z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(s + 1e-4); dm.updateMatrix(); marks.setMatrixAt(i, dm.matrix);
        const c = h.daily ? CY.map((v) => v * (1 + 1.2 * glow)) : LI.map((v) => v * 0.9);
        marks.instanceColor.setXYZ(i, c[0], c[1], c[2]);
      });
      marks.instanceMatrix.needsUpdate = true; marks.instanceColor.needsUpdate = true;
    },
    at: { centre: () => [x, 0, 0] },
  };
};
