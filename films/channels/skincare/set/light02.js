// light02.js — No. 002's light (films/channels/skincare/set): a beam into skin, the glint off its top, and the paths
// light takes inside it (simplified, badged). Pure functions of their parameters; no clock.
//   createBeam({ from, to, radius }) → { group, set({ op, grow }) }: a thin white beam from `from` to `to`, drawn in
//     with grow 0 … 1; a soft core and a halo (additive, under the bloom knee).
//   createGlint({ at, dirs }) → { group, set({ op, spread }) }: reflected rays leaving the surface point: spread 0 →
//     one tight ray (smooth, hydrated), 1 → a spray (dry, scattered).
//   createPaths({ n, origin, width, depth, seed }) → { group, set({ grow, out, red, op }) }: n random walks from the
//     entry point down among cells and fibres; `out` of them turn and climb back out (the glow); grow draws them in;
//     red tints the climbing paths from white to warm to blood red.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

const additive = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true });

export const createBeam = ({ from = [0, 10, 0], to = [0, 0, 0], radius = 0.12 } = {}) => {
  const g = new THREE.Group();
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), len = a.distanceTo(b);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 12, 1, true).translate(0, -0.5, 0), additive(0xfff6e8, 0.9));
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(radius * 3.2, radius * 3.2, 1, 16, 1, true).translate(0, -0.5, 0), additive(0xffe2c0, 0.18));
  [core, halo].forEach((m) => { m.position.copy(a); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), b.clone().sub(a).normalize()); g.add(m); });
  return { group: g, set({ op = 1, grow = 1 } = {}) { g.visible = op > 0.002 && grow > 0.002; core.scale.set(1, len * grow, 1); halo.scale.set(1, len * grow, 1); core.material.opacity = 0.9 * op; halo.material.opacity = 0.18 * op; } };
};

export const createGlint = ({ at = [0, 0, 0], dir = [-0.6, 1, 0.5], len = 6, n = 14, seed = 4 } = {}) => {
  const R = rng(seed), g = new THREE.Group(); g.position.set(...at);
  const base = new THREE.Vector3(...dir).normalize();
  const rays = Array.from({ length: n }, (_, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6, 1, true).translate(0, 0.5, 0), additive(0xffffff, 0.8));
    m.userData.j = new THREE.Vector3((R() - 0.5) * 2, R() * 0.6, (R() - 0.5) * 2); m.userData.l = len * (0.5 + 0.5 * R()); g.add(m); return m;
  });
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), additive(0xffffff, 1)); g.add(spark);
  return {
    group: g,
    set({ op = 1, spread = 0 } = {}) {
      g.visible = op > 0.002; spark.material.opacity = op;
      rays.forEach((m, i) => {
        const d = base.clone().add(m.userData.j.clone().multiplyScalar(spread * 1.4)).normalize();
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        const one = i === 0 ? 1 : spread;                     // smooth: only the first ray; dry: all of them, shorter and dimmer
        m.scale.set(1 + 2 * (1 - spread) * (i === 0), m.userData.l * (i === 0 ? 1.4 : 0.6), 1 + 2 * (1 - spread) * (i === 0));
        m.material.opacity = op * one * (i === 0 ? 0.9 - 0.5 * spread : 0.35);
        m.visible = one > 0.01;
      });
    },
  };
};

// random walks in a block: x ∈ [-width/2, width/2], y ∈ [-depth, 0]; µm units for the section
export const createPaths = ({ n = 26, origin = [0, 0, 20], width = 120, depth = 160, seed = 6, steps = 22 } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  const paths = Array.from({ length: n }, (_, i) => {
    const out = i < Math.round(n * 0.55);                    // these climb back out (shown as the glow); the rest are absorbed
    const pts = [new THREE.Vector3(origin[0], 6, origin[2])];
    let x = origin[0], y = 0, z = origin[2];
    for (let s = 1; s <= steps; s++) {
      const down = out ? (s < steps * 0.5 ? -1 : 1) : -1;
      x += (R() - 0.5) * width * 0.22; y += down * (depth / steps) * (0.6 + R() * 0.9) * (out ? 1.6 : 1); z += (R() - 0.5) * 6;
      x = Math.max(-width / 2, Math.min(width / 2, x)); y = Math.min(out && s === steps ? 8 : 0, Math.max(-depth, y));
      pts.push(new THREE.Vector3(x, y, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false });
    const line = new THREE.Line(geo, mat); line.renderOrder = 20; line.userData = { out, k: R(), np: pts.length };
    g.add(line); return line;
  });
  const white = new THREE.Color(0xfff6ea), warm = new THREE.Color(0xffb27a), red = new THREE.Color(0xff3b3b);
  return {
    group: g,
    set({ grow = 0, out = 0, red: rk = 0, op = 1 } = {}) {
      g.visible = op > 0.002;
      paths.forEach((l) => {
        const { out: isOut, k, np } = l.userData;
        const gg = Math.min(1, Math.max(0, grow * 1.3 - k * 0.3));
        l.geometry.setDrawRange(0, Math.max(2, Math.round(np * gg)));
        const c = white.clone().lerp(warm, isOut ? Math.min(1, out) : 0.2).lerp(red, isOut ? rk : 0);
        l.material.color.copy(c);
        l.material.opacity = op * (isOut ? 0.35 + 0.6 * out : 0.5 * (1 - 0.6 * out)) * (gg > 0.01 ? 1 : 0);
      });
    },
  };
};
