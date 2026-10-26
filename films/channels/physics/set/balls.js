// balls.js — more B3 props for "the Bench" (films/channels/physics/set), in centimetres: a basketball (pebbled
// orange with its eight ribs, a seeded canvas texture), plus the closed-form stacked drop (a light ball resting on a
// heavy one, dropped together). Lit props keep albedo ≤ 0.7 (cross-check). Episode 3 introduced them.
//
//   import { createBasketball, stackDrop } from "../set/balls.js";
//   const bb = createBasketball();                       // a Mesh, r = 12 cm
//   const S = stackDrop({ drop: 50, R: 12, r: 3.35, M: 0.6, m: 0.057, e: 1 });
//   S.big(τ) / S.small(τ) → [x, y, z] centres; S.tHit, S.uSmall, S.uBig (cm/s), S.peak (τ, y of the small one's top)
//
// The stacked drop: both fall together from rest (the big ball's bottom `drop` cm up); the big one meets the floor and
// leaves at e·v; at that instant it meets the small one still falling at v (no gap) and the pair separates by
// Newton's rule with the same e. Perfect bounces (e = 1) give the classic result: the small ball leaves at
// (3M − m)/(M + m)·v. After the hit each moves ballistically (the big one bouncing on with e, the small one flying up
// and falling back to bounce with its own e2). No air. No simulation: every branch is closed form.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { albedo } from "./aces.js";

const G = 981;

const skin = () => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d"), r = rng(20261025);
  g.fillStyle = "#B4592B"; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 5000; i++) { g.fillStyle = r() < 0.5 ? "rgba(70, 25, 8, .14)" : "rgba(235, 150, 100, .10)"; g.fillRect(r() * 512, r() * 256, 1.5, 1.5); }   // pebbling
  g.strokeStyle = "#231A16"; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();                               // the equator rib
  [128, 384].forEach((x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); });   // the meridian ribs
  [0, 256].forEach((x0) => { g.beginPath(); for (let i = 0; i <= 64; i++) { const v = i / 64, x = x0 + 64 + 40 * Math.cos(Math.PI * v) * Math.sin(Math.PI * v) * 2.2, y = v * 256; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 1;     // anisotropy 1: seek-order independence (ep01)
  return t;
};

export const createBasketball = (o = {}) => {
  const R = o.r ?? 12;
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), new THREE.MeshStandardMaterial({ map: skin(), color: albedo("#FFFFFF"), roughness: 0.85, metalness: 0 }));
  m.rotation.set(0.25, 0.7, 0.1);
  return m;
};

export const stackDrop = ({ drop = 50, R = 12, r = 3.35, M = 0.6, m = 0.057, e = 1, e2 = 1, x = 0, z = 0 } = {}) => {
  const tHit = Math.sqrt((2 * drop) / G), v = G * tHit;                    // both land / meet at tHit, speed v
  const vb = e * v;                                                       // the big one after the floor, upward
  const vs = -v;                                                          // the small one, still falling
  // Newton's rule for the pair: u_s − u_b = −e (vs − vb); momentum M vb + m vs = M u_b + m u_s
  const uSmall = (M * vb + m * vs + M * e * (vb - vs)) / (M + m);
  const uBig = uSmall - e * (vb - vs);
  const ySmall0 = 2 * R + r, yBig0 = R;                                   // centres at the moment of the hit
  const ballistic = (y0, u, rad, ee, tau) => {                            // from y0 at speed u (up +), bouncing on the floor with ee
    let t = tau, y = y0, vv = u;
    for (let k = 0; k < 20; k++) {
      const disc = vv * vv + 2 * G * (y - rad), tl = (vv + Math.sqrt(Math.max(0, disc))) / G;   // time to touch the floor
      if (t <= tl) return y + vv * t - 0.5 * G * t * t;
      t -= tl; y = rad; vv = ee * Math.sqrt(Math.max(0, disc));
      if (vv < 1) return rad;
    }
    return rad;
  };
  const big = (tau) => {
    if (tau <= 0) return [x, drop + R, z];
    if (tau <= tHit) return [x, drop + R - 0.5 * G * tau * tau, z];
    return [x, ballistic(yBig0, uBig, R, e, tau - tHit), z];
  };
  const small = (tau) => {
    if (tau <= 0) return [x, drop + 2 * R + r, z];
    if (tau <= tHit) return [x, drop + 2 * R + r - 0.5 * G * tau * tau, z];
    return [x, ballistic(ySmall0, uSmall, r, e2, tau - tHit), z];
  };
  const tPeak = tHit + uSmall / G, yPeak = ySmall0 + (uSmall * uSmall) / (2 * G);
  return { big, small, tHit, v, uSmall, uBig, peak: [tPeak, yPeak], ratio: uSmall / v };
};
