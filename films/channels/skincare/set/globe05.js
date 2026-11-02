// globe05.js — No. 005's world (films/channels/skincare/set): a small globe for the why beat, a model of the
// published pattern (Jablonski & Chaplin 2000), badged "model". The surface carries ultraviolet as a violet band,
// strongest at the equator and fading toward the poles (∝ cos² of latitude, simplified); dots of skin colour fill in
// across it, each dot's melanin following the UV where it sits plus a little seeded spread, so the two visibly
// match. No continents are drawn and no dot stands for a people: it is the shape of the relation, not a map.
//
//   const W = createGlobe({ x: 5000, r: 60, seed: 51 });   scene.add(W.group);
//   W.set({ t, uv, dots, spin, dim })   W.at.band() → a point on the equator facing the camera side (+z)
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { toneColor } from "./section.js";

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => s2l(parseInt(x.slice(i, i + 2), 16) / 255)); };

export const createGlobe = ({ x = 5000, r = 60, seed = 51, n = 140, uvHex = "#9C7BFF", baseHex = "#DCE4E3" } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.x = x;
  const spin = new THREE.Group();
  spin.rotation.z = (23.4 * Math.PI) / 180 * 0.35;   // a slight tilt so it reads as a globe, not a ball
  g.add(spin);
  const geo = new THREE.SphereGeometry(r, 96, 64), pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const base = hexLin(baseHex), uv = hexLin(uvHex);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  const globe = new THREE.Mesh(geo, mat);
  spin.add(globe);
  // latitude lines: the equator and the two tropics (thin ink rings)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x13252c, transparent: true, opacity: 0.35, toneMapped: false });
  for (const lat of [0, 23.4, -23.4]) {
    const a = (lat * Math.PI) / 180, rr = r * Math.cos(a) * 1.003;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, lat === 0 ? 0.32 : 0.2, 6, 120), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = r * Math.sin(a);
    spin.add(ring);
  }
  // the dots: seeded points over the sphere (fewer near the poles), melanin from the UV at their latitude ± spread
  const dots = [];
  while (dots.length < n) {
    const lat = Math.asin(2 * R() - 1), lon = R() * Math.PI * 2;
    if (Math.abs(lat) > 1.15) continue;
    const I = Math.cos(lat) ** 2, m = Math.min(1, Math.max(0, 0.08 + 0.86 * I + (R() - 0.5) * 0.16));
    dots.push({ lat, lon, m, k: R() });
  }
  const dm = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  const dMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), dm, n);
  const c = new THREE.Color();
  dots.forEach((d, i) => { c.setRGB(...toneColor("living", d.m)); dMesh.setColorAt(i, c); });
  spin.add(dMesh);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x13252c, side: THREE.BackSide, transparent: true, opacity: 0.55, toneMapped: false });
  const outline = new THREE.Mesh(geo, lineMat);
  outline.scale.setScalar(1.012);
  g.add(outline);
  const dummy = new THREE.Object3D();
  return {
    group: g, dots, r,
    // uv: 0 … 1 the violet band's strength; dots: 0 … 1 the dots fill in (in a seeded order); spin: the globe's turn
    // about its axis (radians); dim: 0 … 1 everything steps back
    set({ uv: u = 1, dots: show = 1, spin: a = 0, dim = 0 } = {}) {
      spin.rotation.y = a;
      for (let i = 0; i < pos.count; i++) {
        const lat = Math.asin(Math.max(-1, Math.min(1, pos.getY(i) / r))), I = Math.cos(lat) ** 2 * u;
        for (let j = 0; j < 3; j++) col[i * 3 + j] = (base[j] + (uv[j] * 0.9 - base[j]) * I * 0.75) * (1 - 0.4 * dim);
      }
      geo.attributes.color.needsUpdate = true;
      dots.forEach((d, i) => {
        const s = Math.min(1, Math.max(0, (show - d.k * 0.8) / 0.2)) * 2.3;
        const cl = Math.cos(d.lat), p = [r * 1.01 * cl * Math.sin(d.lon), r * 1.01 * Math.sin(d.lat), r * 1.01 * cl * Math.cos(d.lon)];
        dummy.position.set(...p); dummy.scale.set(s + 1e-4, s + 1e-4, s * 0.4 + 1e-4);
        dummy.lookAt(0, 0, 0); dummy.updateMatrix(); dMesh.setMatrixAt(i, dummy.matrix);
      });
      dMesh.instanceMatrix.needsUpdate = true;
      ringMat.opacity = 0.35 * (1 - 0.5 * dim);
    },
    at: {
      band: () => [x + r * 0.55, r * 0.05, r * 0.84],
      pole: () => [x - r * 0.25, r * 0.92, r * 0.3],
    },
  };
};
