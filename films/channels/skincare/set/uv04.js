// uv04.js — Outer Layer's S3 Light block as No. 004 uses it (films/channels/skincare/set): ultraviolet drawn as short
// violet dashes falling into the section, additive in the theme's uv-glow so the bloom picks them up (text never
// blooms). A pure function of t: each dash has a seeded column, period and phase; it falls from `top` and either
// stops at its own depth (absorbed: it shortens and fades there) or passes on down to `floor`.
//
//   const R = createRays({ n: 60, x: [-80, 80], z: [-20, 28], top: 70, stop: (i, R) => -10 - R() * 30, seed: 9 });
//   scene.add(R.mesh);   R.set(t, { gain, color, pass: 0.3, stopAt: (b) => y })   → the anchor of a dash in flight
//
// pass (0 … 1) is the share of dashes that get past `stopAt` (the parasols in the whoa: about 1/SPF of them); the
// rest end there. Dashes are thin boxes oriented along their fall (straight down, a little slant), never strobing:
// each fades in over its first fifth and out over its last, so no frame flashes.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

export const createRays = ({ n = 60, x: [xa, xb] = [-80, 80], z: [za, zb] = [-20, 28], top = 80, floor = -70, seed = 9,
  len = 9, width = 0.9, slant = 0.18, speed = 70 } = {}) => {
  const R = rng(seed);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n);
  mesh.frustumCulled = false;
  const B = Array.from({ length: n }, () => ({ x: xa + R() * (xb - xa), z: za + R() * (zb - za), ph: R(), v: speed * (0.85 + R() * 0.3), stop: -4 - R() * 26, k: R() }));
  const dummy = new THREE.Object3D();
  const span = top - floor;
  return {
    mesh, B,
    // gain: 0 … 1 for the whole swarm; pass: the share of dashes that pass stopAt(b) (the others end there);
    // stopAt(b) → y of the stop (default: the dash's own seeded depth in the living layers); returns a dash in flight
    set(t, { gain = 1, color = [0.6, 0.48, 1], pass = 0, stopAt = null, hit = null } = {}) {
      mat.color.setRGB(...color); mat.opacity = Math.min(1, gain);
      mesh.visible = gain > 0.002;
      let any = null;
      B.forEach((b, i) => {
        const P = span / b.v, u = ((t / P + b.ph) % 1 + 1) % 1;
        const y = top - span * u, ys = stopAt ? stopAt(b) : b.stop;
        const through = b.k < pass;
        let s = 1, l = len;
        if (!through && y < ys) { const d = (ys - y) / (len * 1.2); s = Math.max(0, 1 - d); l = len * s + 0.01; }
        s *= Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.12);
        dummy.position.set(b.x + slant * (top - y), y + l / 2, b.z);
        dummy.rotation.set(0, 0, slant);
        dummy.scale.set(width * Math.max(0.001, s), l, width * Math.max(0.001, s));
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        if (!any && s > 0.8 && y > ys + 6 && y < top - 12) any = [b.x + slant * (top - y), y, b.z];
        if (hit && through && s > 0.6 && y < ys - 4) hit.push([b.x, y, b.z]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      return any;
    },
  };
};
