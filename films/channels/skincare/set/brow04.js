// brow04.js — No. 004's brow (films/channels/skincare/set): a frontal, human-scale model of the brow so a frown reads
// at a glance (the macro terrain doesn't: at that scale a brow reads as dunes). Two brow ridges, the eyebrows as
// arcs of short dark hairs, the nose bridge rising below, and the two vertical frown lines between the brows (the
// "11"), whose depth is the frown. A model, badged as one; drawn in the episode's tone.
//
//   const B = createBrow({ x: 0, tone: [r, g, b] });   scene.add(B.group);
//   B.set({ frown })   frown: 0 … 1 the lines deepen and the brows draw in and down
//   B.at.lines() → the point between the brows (for keys and labels)
//   browArcs({ w, h }) → the two eyebrow arcs as [[x, y], …] in a w × h frame centred on the glabella (for the UV view)
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

export const browArcs = ({ w = 7.2, h = 5.0, y = 0.55 } = {}) => [-1, 1].map((s) => Array.from({ length: 24 }, (_, i) => {
  const u = i / 23, x = s * (0.12 + u * 0.36) * w;
  return [x, (y * 0.5 - 0.08 + 0.1 * Math.sin(Math.PI * Math.min(1, u * 1.1)) - 0.06 * u) * h * 0.5];
}));

export const createBrow = ({ x = 0, tone = [0.8, 0.6, 0.48], seed = 9, W = 16, H = 10 } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.x = x;
  const geo = new THREE.PlaneGeometry(W, H, 260, 170), pos = geo.attributes.position, base = Float32Array.from(pos.array);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...tone), roughness: 0.55, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat); g.add(mesh);
  // the eyebrows: short dark hairs along two arcs above the ridges, angled outward and up
  const hairs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 520; i++) {
    const u = R(), ax = s * (0.9 + u * 4.6), ay = 1.05 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.1)) - 0.35 * u + (R() - 0.5) * (0.45 - 0.2 * u);
    hairs.push({ x: ax, y: ay, a: s * (0.35 + 0.5 * u) + (R() - 0.5) * 0.3, l: 0.32 + R() * 0.22 });
  }
  const hm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.035, 0.03), new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.6 }), hairs.length);
  g.add(hm);
  const dm = new THREE.Object3D();
  const surf = (X, Y, f) => {
    const ridge = 0.55 * Math.exp(-((Y - 0.9) ** 2) / 0.9) * (1 - Math.exp(-(X * X) / 2.2));          // the two brow ridges
    const nose = 0.9 * Math.exp(-(X * X) / 0.9) * (1 / (1 + Math.exp((Y + 1.6) * 2.2)));            // the bridge rising below
    const sockets = -0.8 * Math.exp(-(((Math.abs(X) - 3.1) ** 2) / 2.4 + ((Y + 1.9) ** 2) / 1.2));  // the eye hollows, out of frame's foot
    const lines = -0.32 * f * [-0.42, 0.42].reduce((a, lx) => a + Math.exp(-((X - lx) ** 2) / 0.012) * Math.exp(-((Y - 0.35) ** 2) / 1.1), 0);   // the "11"
    const draw = -0.12 * f * Math.exp(-(X * X) / 1.6) * Math.exp(-((Y - 0.6) ** 2) / 1.5);         // the glabella bunches
    return ridge + nose + sockets + lines + draw + 0.025 * Math.sin(X * 9 + Y * 3) * Math.sin(Y * 11);
  };
  let last = -1;
  return {
    group: g,
    set({ frown = 1 } = {}) {
      if (Math.abs(frown - last) < 1e-3) return; last = frown;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, surf(base[3 * i], base[3 * i + 1], frown));
      pos.needsUpdate = true; geo.computeVertexNormals();
      hairs.forEach((h, i) => {
        const pull = frown * 0.25 * Math.sign(h.x) * Math.exp(-(h.x * h.x) / 6);   // the inner brows draw in and down
        const X = h.x - pull, Y = h.y - 0.2 * frown * Math.exp(-(h.x * h.x) / 5);
        dm.position.set(X, Y, surf(X, Y, frown) + 0.02); dm.rotation.set(0, 0, h.a - Math.sign(h.x) * 0.25 * frown * Math.exp(-(h.x * h.x) / 5)); dm.scale.set(h.l, 1, 1); dm.updateMatrix(); hm.setMatrixAt(i, dm.matrix);
      });
      hm.instanceMatrix.needsUpdate = true;
    },
    at: { lines: () => [x, 0.35, surf(0, 0.35, 1)] },
  };
};
