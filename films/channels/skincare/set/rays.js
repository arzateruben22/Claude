// rays.js — ultraviolet rays and a sunscreen film for Outer Layer (films/channels/skincare/set). A model, badged
// "model" wherever it is on screen: one sunburning (UVB) band drawn as violet dashes falling straight down onto a
// film, each ray either stopped in the film (it fades there) or let through (it carries on into the skin and leaves a
// small glow where it lands). Which rays get through is fixed per ray by a seeded number, so "let through 1 in 50" is
// exactly that share of the rays drawn, and a frame is a pure function of t.
//
//   const R = createRays({ n: 100, x: [-80, 80], z: [-20, 26], top: 140, seed: 3 });
//   scene.add(R.group);
//   R.set(t, { filmTop, filmBottom, pass, gain, color, hitColor, rate, x0 });   // pass: share let through (0 … 1)
//   const F = createFilm({ width: 160, depth: 50, clip });  F.set({ top: 0, thick: 20, opacity })
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

export const createRays = ({ n = 100, x: [xa, xb] = [-80, 80], z: [za, zb] = [-20, 26], top = 140, seed = 3, len = 9, width = 0.55, depthIn = 14 } = {}) => {
  const R = rng(seed);
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, toneMapped: true });
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(width, width, 1, 6), mat, n);
  const hitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
  const hits = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), hitMat, n);
  group.add(mesh, hits);
  // each ray: its column, its phase in the fall, and a rank in [0, 1): a ray passes when its rank is below `pass`
  const RAY = Array.from({ length: n }, (_, i) => ({ x: xa + R() * (xb - xa), z: za + R() * (zb - za), ph: R(), rank: (i + 0.5) / n }));
  // shuffle the ranks so the passing rays are scattered, not the first columns
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [RAY[i].rank, RAY[j].rank] = [RAY[j].rank, RAY[i].rank]; }
  const d = new THREE.Object3D();
  return {
    group, RAY,
    // t: film time; rate: falls a second; x0: the block's centre; returns the anchor of a passing ray's glow (or null)
    set(t, { filmTop = 0, filmBottom = -20, pass = 0.02, gain = 1, color = [0.6, 0.4, 1.4], hitColor = [1.4, 0.6, 1.6], rate = 0.55, x0 = 0, xs = 1 } = {}) {
      mat.color.setRGB(...color); hitMat.color.setRGB(...hitColor);
      mat.opacity = gain; hitMat.opacity = gain;
      group.visible = gain > 0.002;
      let anchor = null;
      RAY.forEach((r, i) => {
        const u = ((t * rate + r.ph) % 1 + 1) % 1;                       // 0 at the top, 1 at the end of its fall
        const through = r.rank < pass;
        const yEnd = through ? filmBottom - depthIn : filmTop - (filmTop - filmBottom) * 0.5;
        const yHead = top + (yEnd - top) * u, yTail = Math.min(top, yHead + len);
        const fade = through ? 1 : Math.max(0, Math.min(1, (yHead - filmBottom) / Math.max(1, filmTop - filmBottom) * 1.6));
        d.position.set(x0 + r.x * xs, (yHead + yTail) / 2, r.z);
        d.scale.set(1, Math.max(0.01, yTail - yHead), 1);
        d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
        mesh.setColorAt?.(i, new THREE.Color(fade, fade, fade));
        // a passing ray leaves a small glow in the skin while it is there
        const s = through && yHead < filmBottom ? 1.6 * Math.min(1, (filmBottom - yHead) / 4) : 0;
        d.position.set(x0 + r.x * xs, Math.max(yHead, filmBottom - depthIn), r.z); d.scale.setScalar(Math.max(1e-4, s)); d.updateMatrix(); hits.setMatrixAt(i, d.matrix);
        if (through && s > 0.5 && !anchor) anchor = [x0 + r.x * xs, filmBottom - depthIn * 0.5, r.z];
      });
      mesh.instanceMatrix.needsUpdate = true; hits.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return anchor;
    },
  };
};

// the film: a translucent, slightly milky slab laid on the section's surface; its thickness is a scene parameter in µm
// (the gauge reads the same number), clipped to its block like the section
export const createFilm = ({ width = 160, depth = 50, x = 0, clip = null } = {}) => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xf6f7fb, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false,
    clippingPlanes: clip || [] });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1, depth), mat);
  mesh.position.x = x;
  return {
    mesh,
    set({ top = 0, thick = 20, opacity = 0.55, tint = [0.965, 0.97, 0.985] } = {}) {
      mesh.visible = opacity > 0.002 && thick > 0.05;
      mesh.scale.y = Math.max(0.05, thick);
      mesh.position.y = top + thick / 2;
      mat.opacity = opacity;
      mat.color.setRGB(...tint);
    },
  };
};
