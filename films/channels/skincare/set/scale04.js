// scale04.js — No. 004's non-skin props (films/channels/skincare/set), for the lines about lethality, which never play
// over a face or skin (bible rule, 3 Nov): a two-pan balance with a plain paper note (a generic note, no currency's
// design) level with a small heap of white crystals, "≈ 1 g" each; and the toxin molecule as three domains (an
// illustration of its shape, not a structure). Both lit by the episode's studio rig.
//
//   const S = createBalance({ x: 2000 });   scene.add(S.group);   S.set({ t })   S.at.heap() · S.at.note() → world points
//   const M = createMolecule({ x: 1500 });  scene.add(M.group);   M.set({ t })   M.at.centre()
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

const noteTex = () => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 224; const k = c.getContext("2d");
  k.fillStyle = "#cfd8c9"; k.fillRect(0, 0, 512, 224);
  k.strokeStyle = "rgba(70,90,80,.35)"; k.lineWidth = 1;
  for (let i = 0; i < 60; i++) { k.beginPath(); for (let x = 0; x <= 512; x += 8) k.lineTo(x, 112 + 80 * Math.sin(x / 40 + i * 0.21) * Math.cos(i * 0.37)); k.stroke(); }   // an abstract guilloche, no design of any real note
  k.strokeStyle = "rgba(60,80,70,.6)"; k.lineWidth = 6; k.strokeRect(14, 14, 484, 196);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};

export const createBalance = ({ x = 2000, seed = 7 } = {}) => {
  const R = rng(seed), g = new THREE.Group(); g.position.x = x;
  const metal = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.32, 0.28, 0.42), metalness: 1, roughness: 0.28, clearcoat: 0.4 });
  const brass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.75, 0.7, 0.82), metalness: 1, roughness: 0.2 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.25, 64), metal); base.position.y = -1.2; g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 24), brass); post.position.y = 0.05; g.add(post);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.08), brass); beam.position.y = 1.25; g.add(beam);
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), brass); pivot.position.y = 1.25; g.add(pivot);
  const pans = [-1.5, 1.5].map((px) => {
    const p = new THREE.Group(); p.position.set(px, 1.25, 0); g.add(p);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 0.06, 64), brass); dish.position.y = -1.0; p.add(dish);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2, top = new THREE.Vector3(0, 0, 0), bot = new THREE.Vector3(0.55 * Math.cos(a), -0.97, 0.55 * Math.sin(a));
      const len = top.distanceTo(bot), w = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 6), brass); w.position.copy(top.clone().add(bot).multiplyScalar(0.5)); w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bot.clone().sub(top).normalize()); p.add(w); }
    return p;
  });
  // the left pan: a plain paper note, folded once
  const nm = new THREE.MeshPhysicalMaterial({ map: noteTex(), roughness: 0.75, sheen: 0.3, side: THREE.DoubleSide });
  const half = (s) => { const geo = new THREE.PlaneGeometry(0.62, 0.52); geo.translate(0.31, 0, 0); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, s > 0 ? 0.5 + uv.getX(i) * 0.5 : 0.5 - uv.getX(i) * 0.5); const m = new THREE.Mesh(geo, nm); m.rotation.set(-Math.PI / 2, 0, 0); m.rotateY(s > 0 ? -0.25 : Math.PI + 0.25); return m; };
  const note = new THREE.Group(); note.add(half(1), half(-1)); note.position.set(0, -0.93, 0); note.rotation.y = 0.4; pans[0].add(note);
  // the right pan: a small heap of white crystals
  const cm = new THREE.MeshPhysicalMaterial({ color: 0xf4f1fb, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: new THREE.Color(0.85, 0.8, 1) });
  const NC = 260, crys = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.035, 0), cm, NC), d = new THREE.Object3D();
  for (let i = 0; i < NC; i++) { const r = 0.24 * Math.sqrt(R()), a = R() * 6.28, h = 0.17 * (1 - (r / 0.24) ** 2) * R() + 0.01; d.position.set(r * Math.cos(a), -0.96 + h, r * Math.sin(a)); d.rotation.set(R() * 3, R() * 3, R() * 3); d.scale.set(0.6 + R(), 0.6 + R() * 0.8, 0.6 + R()); d.updateMatrix(); crys.setMatrixAt(i, d.matrix); }
  pans[1].add(crys);
  return {
    group: g,
    set({ t = 0 } = {}) { const sw = 0.006 * Math.sin(t * 0.9); beam.rotation.z = sw; pans[0].position.y = 1.25 - 1.5 * sw; pans[1].position.y = 1.25 + 1.5 * sw; },   // level, a breath of sway
    at: { heap: () => [x + 1.5, 0.45, 0], note: () => [x - 1.5, 0.45, 0], pans: () => [x, 0.3, 0] },
  };
};

export const createMolecule = ({ x = 1500, seed = 12 } = {}) => {
  const R = rng(seed), g = new THREE.Group(); g.position.x = x;
  const gauss = () => { let s = 0; for (let k = 0; k < 4; k++) s += R(); return (s - 2) / 0.58; };
  const dom = (c, n, sx, sy, sz, col) => {
    const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(col), roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.5, sheenColor: new THREE.Color(0.9, 0.85, 1) });
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), m, n), d = new THREE.Object3D();
    for (let i = 0; i < n; i++) { d.position.set(c[0] + gauss() * sx, c[1] + gauss() * sy, c[2] + gauss() * sz); d.scale.setScalar(0.12 + R() * 0.1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
    g.add(im); return im;
  };
  dom([-1.1, 0.4, 0], 420, 0.55, 0.5, 0.45, "#B79BFF");     // the light chain (the part that cuts)
  dom([0.3, 0.0, 0.1], 520, 0.9, 0.35, 0.4, "#D8CCF4");     // the translocation domain
  dom([1.5, -0.5, -0.1], 460, 0.5, 0.6, 0.5, "#8F86C9");    // the binding domain
  return { group: g, set({ t = 0 } = {}) { g.rotation.set(0.15 * Math.sin(t * 0.2), 0.12 * t, 0.05); }, at: { centre: () => [x, 0, 0] } };
};
