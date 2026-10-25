// hemoglobin.js — B3's hemoglobin variant (films/channels/body/set, bible §5): one hemoglobin as four
// lumpy subunits with a heme disc each, the four O₂ "seats", and a merged low-poly copy for crowds.
// Episode 2 ("A billion passengers") builds on it; any episode that needs oxygen on board can reuse it.
//
//   import { hemoglobin, hbGeometry, o2Geometry, HB_R } from "../set/hemoglobin.js";
//   const HB = hemoglobin(THREE, L, { seed: 4, garnet: "#7A2234", crimson: "#E5334F" });
//   scene.add(HB.group);
//   window.seek = (t) => { HB.set({ load: [1, 1, 0.4, 0], shift: 0.6 }); ... HB.seat(2) → world [x, y, z] };
//
// Units: 1 = 0.5 nm (a hemoglobin is about 5.5 nm across; HB_R = 5.5 units is its outer radius here).
// It is a stylised model, not a crystal structure: two α and two β subunits sit at the corners of a
// flattened tetrahedron, each a seeded lumpy blob; each holds a heme disc in a shallow pocket on the
// outside, with its iron as a small bright bead (the seat). `load[i]` (0..1) is how far subunit i has
// taken its O₂: its colour runs from garnet (empty) to crimson (full), the colour change c6 states.
// `shift` (0..1) turns the two αβ halves a few degrees against each other: the T → R change that makes
// the next O₂ bind more readily (c5), drawn, not measured.
//
// hemoglobin(THREE, L, o) → { group, units: [Mesh ×4], hemes: [Mesh ×4], set({ load, shift }),
//   seat(i) → world [x, y, z] (where O₂ i docks), seatLocal(i), centre() → world, rmax }
// hbGeometry(THREE, { detail = 2, seed = 4 }) → one merged BufferGeometry of the four blobs (crowds:
//   inside the cut cell, the reveal pull), radius ≈ HB_R, with a vertex colour for a subtle unit shading
// o2Geometry(THREE, { r = 0.9 }) → two fused spheres (an O₂ molecule), centred, along x
import { rng } from "cinema/film/runtime.js";

export const HB_R = 5.5;
// the four subunit centres (a flattened tetrahedron; α1 β1 on top, α2 β2 below, turned 90°)
const C4 = [[2.3, 1.55, 0.0], [-2.3, 1.55, 0.0], [0.0, -1.55, 2.3], [0.0, -1.55, -2.3]];
const lumpy = (THREE, r0, seed, detail) => {
  // an indexed sphere, so the displaced blob keeps smooth shared normals (detail ≥ 3: a close-up hero)
  const g = detail >= 3 ? new THREE.SphereGeometry(r0, 56, 40) : new THREE.SphereGeometry(r0, 14, 10), p = g.attributes.position, r = rng(seed);
  const W = Array.from({ length: 6 }, () => [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, 1.2 + 2.4 * r(), r() * 6.28]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z), u = [x / l, y / l, z / l];
    let d = 0; for (const [a, b, c, f, ph] of W) d += 0.055 * Math.sin(f * (a * u[0] + b * u[1] + c * u[2]) * 2.2 + ph);
    p.setXYZ(i, u[0] * r0 * (1 + d), u[1] * r0 * (1 + d), u[2] * r0 * (1 + d));
  }
  g.computeVertexNormals();
  return g;
};
const out = (c) => { const l = Math.hypot(...c); return c.map((x) => x / l); };

export const hemoglobin = (THREE, L, o = {}) => {
  const seed = o.seed ?? 4, group = new THREE.Group(), inner = new THREE.Group();
  const halves = [new THREE.Group(), new THREE.Group()];            // α1β1 and α2β2: the shift turns them apart
  inner.add(halves[0], halves[1]); group.add(inner);
  const garnet = L.lin(o.garnet || "#7A2234"), crimson = L.lin(o.crimson || "#E5334F");
  const units = [], hemes = [], irons = [], mats = [];
  const heme = new THREE.CylinderGeometry(0.95, 0.95, 0.22, 28);
  const ironG = new THREE.IcosahedronGeometry(0.34, 2);
  const hemeMat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin("#3A0E18"), emissive: L.lin("#8E2A3F"), emissiveIntensity: 0.25, roughness: 0.4 }), { fresnel: 0.15, key: "heme" });
  const ironMat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin("#E8C9A0"), emissive: L.lin("#FFD9A8"), emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 }), { fresnel: 0.1, key: "iron" });
  C4.forEach((c, i) => {
    const m = L.patch(new THREE.MeshStandardMaterial({ color: garnet.clone(), roughness: 0.55 }), { fresnel: 0.32, fresnelPower: 2.4, key: "hb" + i });
    const u = new THREE.Mesh(lumpy(THREE, 2.75, seed * 17 + i, o.detail ?? 4), m);
    u.position.set(...c); units.push(u); mats.push(m);
    // the heme pocket: outward and a little up from the unit's centre, the disc facing out
    const n = out([c[0] * 1.0, c[1] * 0.6 + (i < 2 ? 0.9 : -0.9), c[2] * 1.0]);
    const h = new THREE.Mesh(heme, hemeMat), fe = new THREE.Mesh(ironG, ironMat);
    const at = c.map((x, k) => x + n[k] * 2.45);
    h.position.set(...at); h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...n));
    fe.position.set(...at.map((x, k) => x + n[k] * 0.12));
    hemes.push(h); irons.push({ mesh: fe, n });
    halves[i < 2 ? 0 : 1].add(u, h, fe);
  });
  const vA = new THREE.Vector3();
  const set = (s = {}) => {
    const load = s.load || [0, 0, 0, 0], shift = s.shift ?? 0;
    for (let i = 0; i < 4; i++) mats[i].color.copy(garnet).lerp(crimson, Math.min(1, Math.max(0, load[i])));
    halves[0].rotation.set(0, 0.13 * shift, 0); halves[1].rotation.set(0, -0.13 * shift, 0);
    halves[0].position.set(0, 0.12 * shift, 0); halves[1].position.set(0, -0.12 * shift, 0);
    group.updateMatrixWorld(true);
  };
  const seatLocal = (i) => irons[i].mesh.position.toArray().map((x, k) => x + irons[i].n[k] * 0.75);
  const seat = (i) => { group.updateMatrixWorld(true); const f = irons[i]; return f.mesh.localToWorld(vA.set(...f.n.map((x) => x * 0.75 / Math.max(1e-6, f.mesh.scale.x)))).toArray(); };
  const centre = () => group.localToWorld(vA.set(0, 0, 0)).toArray();
  const ironWorld = (i) => irons[i].mesh.localToWorld(vA.set(0, 0, 0)).toArray();
  set({});
  return { group, units, hemes, irons: irons.map((x) => x.mesh), set, seat, seatLocal, centre, ironWorld, rmax: HB_R };
};

export const hbGeometry = (THREE, o = {}) => {
  const parts = C4.map((c, i) => { const g = lumpy(THREE, 2.75, (o.seed ?? 4) * 17 + i, o.detail ?? 1).toNonIndexed(); g.translate(...c); return g; });
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let k = 0;
  parts.forEach((g, i) => {
    pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3);
    const shade = i < 2 ? 1.0 : 0.86;                                // α and β read as two shades
    for (let j = 0; j < g.attributes.position.count; j++) col.set([shade, shade, shade], (k + j) * 3);
    k += g.attributes.position.count;
  });
  const G = new THREE.BufferGeometry();
  G.setAttribute("position", new THREE.BufferAttribute(pos, 3)); G.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); G.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return G;
};

export const o2Geometry = (THREE, o = {}) => {
  const r = o.r ?? 0.9, a = new THREE.SphereGeometry(r, 18, 12).toNonIndexed(), b = a.clone();
  a.translate(-r * 0.62, 0, 0); b.translate(r * 0.62, 0, 0);
  const n = a.attributes.position.count, pos = new Float32Array(n * 6), nor = new Float32Array(n * 6);
  pos.set(a.attributes.position.array, 0); pos.set(b.attributes.position.array, n * 3);
  nor.set(a.attributes.normal.array, 0); nor.set(b.attributes.normal.array, n * 3);
  const G = new THREE.BufferGeometry();
  G.setAttribute("position", new THREE.BufferAttribute(pos, 3)); G.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return G;
};
