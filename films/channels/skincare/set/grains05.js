// grains05.js — No. 005's close-up (films/channels/skincare/set): one pigment cell's melanin grains (melanosomes) as
// they sit in a keratinocyte, drawn for a given tone. An illustration of the measured pattern (Thong et al. 2003):
// in lighter skin the grains are smaller and gathered in clusters of two or three; in deeper skin they are larger,
// more of them, and handed out one by one. One parameter (tone, 0 light … 1 deep) sets size, count and grouping, so
// no tone is drawn from a different rulebook.
//
//   const G = createGrains({ tone: 0.12, x: -40, seed: 31 });   scene.add(G.group);
//   G.set({ show, spread, dim })   G.at.cell() → [x, y, z]   G.at.grain() → a grain near the front
//
// The cell is a translucent pale sphere with a thin ink ring and a violet-grey nucleus; the grains are lit,
// opaque ellipsoids in the section's melanin colour for that tone (toneColor), never a token.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { toneColor } from "./section.js";

export const createGrains = ({ tone = 0.5, x = 0, y = 0, z = 0, r = 16, seed = 31 } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.set(x, y, z);
  const cellMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
  const living = toneColor("living", tone);
  cellMat.color.setRGB(...living.map((v) => v + (1 - v) * 0.45));
  const cell = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), cellMat);
  // the cell's edge: a thin ink ring facing the camera (a full back-face shell would darken the whole translucent cell)
  const line = new THREE.Mesh(new THREE.RingGeometry(r * 1.0, r * 1.05, 64), new THREE.MeshBasicMaterial({ color: 0x13252c, transparent: true, opacity: 0.7, toneMapped: false, side: THREE.DoubleSide }));
  const nuc = new THREE.Mesh(new THREE.SphereGeometry(r * 0.36, 28, 20), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 }));
  nuc.material.color.setRGB(...toneColor("nucleus", tone));
  nuc.position.set(0, -r * 0.12, 0);
  g.add(line, cell, nuc);
  // grains: count, size and clustering from the tone
  const n = Math.round(26 + 70 * tone), size = 0.75 + 0.75 * tone, cluster = tone < 0.35 ? 3 : tone < 0.7 ? 2 : 1;
  const mm = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 });
  mm.color.setRGB(...toneColor("melanin", Math.min(1, tone + 0.2)));
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), mm, n);
  const G = [];
  let centre = null;
  const sites = [];
  for (let i = 0; i < n; i++) {
    if (i % cluster === 0 || !centre) {
      // a new site in the cytoplasm, biased above the nucleus (the cap side), never inside the nucleus
      // sites keep their distance (a single grain is never drawn touching another, so "one by one" reads)
      let p, tries = 0;
      const gap = (cluster > 1 ? 3.6 : 2.9) * size;
      do { p = [(R() - 0.5) * 1.7 * r, (R() * 0.95 - 0.25) * r, (R() - 0.5) * 1.7 * r]; tries++; }
      while ((Math.hypot(...p) > r * 0.86 || Math.hypot(p[0], p[1] + r * 0.12, p[2]) < r * 0.46 || sites.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < gap)) && tries < 400);
      sites.push(p);
      centre = p;
    }
    const o = cluster > 1 ? [(R() - 0.5) * 2.2 * size, (R() - 0.5) * 1.6 * size, (R() - 0.5) * 2.2 * size] : [0, 0, 0];
    G.push({ p: centre.map((v, j) => v + o[j]), rot: [R() * 3, R() * 3, R() * 3], k: R() });
  }
  const dummy = new THREE.Object3D();
  g.add(mesh);
  const front = G.reduce((a, b) => (b.p[2] > a.p[2] ? b : a), G[0]);
  return {
    group: g, n, size, cluster,
    // show: 0 … 1 the grains appear (in a seeded order); spread: 0 … 1 they drift from the centre to their places;
    // dim: 0 … 1 the whole cell steps back
    set({ show = 1, spread = 1, dim = 0 } = {}) {
      mm.color.setRGB(...toneColor("melanin", Math.min(1, tone + 0.2)).map((v) => v * (1 - 0.5 * dim)));
      cellMat.opacity = 0.32 * (1 - 0.5 * dim);
      G.forEach((q, i) => {
        const s = Math.min(1, Math.max(0, (show - q.k * 0.85) / 0.15)) * size;
        dummy.position.set(...q.p.map((v) => v * (0.35 + 0.65 * spread)));
        dummy.rotation.set(...q.rot); dummy.scale.set(s * 1.25 + 1e-4, s * 0.7 + 1e-4, s * 0.7 + 1e-4);
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    at: {
      cell: () => [x + r * 0.7, y + r * 0.7, z + r * 0.3],
      grain: () => [x + front.p[0], y + front.p[1], z + front.p[2]],
    },
  };
};
