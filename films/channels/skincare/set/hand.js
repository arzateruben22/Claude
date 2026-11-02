// hand.js — a smooth model hand for Outer Layer (films/channels/skincare/set): one organic surface grown from
// metaballs (kits/cinema/metaballs.js), so palm, knuckles, fingers, thumb and wrist flow into each other instead of
// reading as stacked capsules. Lying back up, fingers toward +z. A model, badged as one.
//
//   const Hd = createHand({ material, side: 1, at: [x, y, z], resolution: 84 });   scene.add(Hd.mesh)
//   Hd.set({ curl })       curl: 0 … 1 the fingers relax and curl a little (the pose breathes)
//   Hd.at.back() · Hd.at.knuckle(i) → world points (labels, beads, focus)
import * as THREE from "three";
import { liquid } from "cinema/metaballs.js";

export const createHand = ({ material, side = 1, at = [0, 0, 0], size = 15, resolution = 140, scale = 1 } = {}) => {
  const c = [at[0], at[1], at[2] + 0.8];
  const L = liquid(THREE, { material, center: c, size, resolution, maxPolyCount: 90000 });
  const P = (x, y, z) => [at[0] + side * x * scale, at[1] + y * scale, at[2] + z * scale];
  const FING = [[-1.9, 3.0, 0.36], [-0.64, 3.7, 0.38], [0.64, 3.5, 0.37], [1.85, 2.7, 0.33]];   // x, length, root radius (index → little)
  return {
    mesh: L.mesh,
    set({ curl = 0 } = {}) {
      const balls = [];
      // the back of the hand: a soft slab, slightly domed toward the knuckles
      for (const x of [-1.35, -0.45, 0.45, 1.3]) for (const z of [-1.3, -0.4, 0.5, 1.3]) balls.push({ p: P(x, 0.05 + 0.12 * Math.cos(x * 0.9), z), r: 0.88 });
      // the knuckles and the fingers: chains whose radius tapers, dropping a little as they curl
      FING.forEach(([x, len, r0], i) => {
        balls.push({ p: P(x, 0.22, 1.8), r: r0 * 1.45 });   // the knuckle
        const n = Math.round(len / 0.22);
        for (let k = 1; k <= n; k++) { const u = k / n, z = 1.85 + len * u, droop = -(0.25 + 0.6 * curl) * u * u; balls.push({ p: P(x + (i - 1.5) * 0.08 * u, droop, z - curl * 0.5 * u * u), r: r0 * (1 - 0.18 * u) }); }
      });
      // the thumb, out to the side and forward
      for (let k = 0; k <= 8; k++) { const u = k / 8; balls.push({ p: P(-1.8 - 1.3 * u, -0.15 - 0.2 * u, -0.9 + 2.0 * u), r: 0.48 * (1 - 0.25 * u) }); }
      // the wrist
      for (let k = 0; k <= 6; k++) balls.push({ p: P(0, -0.1, -2.2 - 0.6 * k), r: 1.05 * (k < 5 ? 1 : 0.85 - 0.25 * (k - 5)) });   // the wrist, rounded off inside the volume
      L.set(balls);
    },
    at: { back: () => P(0, 0.75, 0), knuckle: (i) => P(FING[i][0], 0.6, 1.85) },
  };
};
