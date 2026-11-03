// brow04.js — No. 004's brow (films/channels/skincare/set): a frontal, human-scale model of the upper face so a frown
// reads at a glance: two brow ridges, a groomed pair of eyebrows (tapered, clumped strands flowing outward), the bridge
// of the nose, a hint of the upper lids, fine vellus hair, and the two frown folds between the brows (the "11": soft
// tissue bunching with a bulge between them, not cut grooves), whose depth is the frown. A model, badged as one; drawn
// in the episode's tone. Look-2 rebuild (3 Nov, review round 1).
//
//   const B = createBrow({ x: 0, tone: [r, g, b], segs: [720, 560] });   scene.add(B.group);
//   B.set({ frown })   frown: 0 … 1 the folds rise, the brows draw in and down, the hairs sway with them
//   B.hairMat / B.vellusMat / B.mesh   for the scene's grade; B.at.lines() → the point between the brows
//   browNormal({ seed, size })   a skin normal map for the brow: pores and short cross-hatched micro-furrows (no long
//                                lines, so a deep relief shows no streaks)
//   browArcs({ w, h }) → the two eyebrow arcs as [[x, y], …] in a w × h frame centred on the glabella
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

export const browArcs = ({ w = 7.2, h = 5.0, y = 0.55 } = {}) => [-1, 1].map((s) => Array.from({ length: 24 }, (_, i) => {
  const u = i / 23, x = s * (0.12 + u * 0.36) * w;
  return [x, (y * 0.5 - 0.08 + 0.1 * Math.sin(Math.PI * Math.min(1, u * 1.1)) - 0.06 * u) * h * 0.5];
}));

export const browNormal = ({ seed = 4, size = 1024, pores = 900, hatch = 2600 } = {}) => {
  const R = rng(seed), h = new Float32Array(size * size);
  const add = (x, y, v) => { const i = (((Math.floor(y) % size) + size) % size) * size + (((Math.floor(x) % size) + size) % size); h[i] += v; };
  for (let n = 0; n < pores; n++) {   // pores: small soft pits
    const px = R() * size, py = R() * size, r = 1.4 + R() * 2.2;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const d2 = (x * x + y * y) / (r * r); if (d2 < 4) add(px + x, py + y, -0.8 * Math.exp(-d2 * 1.5)); }
  }
  for (let n = 0; n < hatch; n++) {   // micro-furrows: short strokes in two crossing families, the skin's diamond grid
    const a = (R() > 0.5 ? 0.7 : -0.75) + (R() - 0.5) * 0.25, len = 10 + R() * 26, px = R() * size, py = R() * size, dep = 0.12 + R() * 0.18;
    for (let k = 0; k < len; k++) { const f = Math.sin(Math.PI * k / len); add(px + Math.cos(a) * k, py + Math.sin(a) * k, -dep * f); add(px + Math.cos(a) * k + 1, py + Math.sin(a) * k, -dep * f * 0.5); }
  }
  for (let i = 0; i < h.length; i++) h[i] += (R() - 0.5) * 0.04;
  const c = document.createElement("canvas"); c.width = c.height = size; const k = c.getContext("2d"), img = k.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.0, dy = (at(x, y + 1) - at(x, y - 1)) * 2.0, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    img.data[i] = 128 + (-dx / l) * 127; img.data[i + 1] = 128 + (dy / l) * 127; img.data[i + 2] = 128 + (1 / l) * 127; img.data[i + 3] = 255;
  }
  k.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
};

export const createBrow = ({ x = 0, tone = [0.8, 0.6, 0.48], seed = 9, W = 18, H = 14, yc = 0.2, segs = [720, 560], hairN = 900, vellusN = 5000 } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.x = x;
  const geo = new THREE.PlaneGeometry(W, H, segs[0], segs[1]); geo.translate(0, yc, 0);
  const pos = geo.attributes.position, base = Float32Array.from(pos.array);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...tone), roughness: 0.55, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat); g.add(mesh);

  const surf = (X, Y, f) => {
    const ax = Math.abs(X);
    const ridge = 0.55 * Math.exp(-((Y - 0.95) ** 2) / 0.9) * (1 - Math.exp(-(X * X) / 2.2));                 // the two brow ridges
    const nose = 0.5 * Math.exp(-(X * X) / 1.8) * (1 / (1 + Math.exp((Y + 1.6) * 2.2)));                   // the bridge rising below
    const socket = -0.32 * Math.exp(-(((ax - 3.1) ** 2) / 2.4 + ((Y + 1.9) ** 2) / 1.2));                    // shallow: no bruise
    const lid = 0.2 * Math.exp(-(((ax - 3.1) ** 2) / 1.5 + ((Y + 2.45) ** 2) / 0.16)) - 0.07 * Math.exp(-(((ax - 3.1) ** 2) / 1.8 + ((Y + 2.0) ** 2) / 0.015));   // the upper lids and their crease
    const env = Math.exp(-((Y - 0.8) ** 2) / 0.45);
    const folds = f * env * (-0.1 * (Math.exp(-((X - 0.36) ** 2) / 0.035) + Math.exp(-((X + 0.36) ** 2) / 0.035))   // the two valleys of the "11" (soft)
      + 0.11 * Math.exp(-(X * X) / 0.06)                                                                       // the bulge between them
      + 0.07 * (Math.exp(-((X - 0.78) ** 2) / 0.09) + Math.exp(-((X + 0.78) ** 2) / 0.09)));                    // the corrugators bunching outside
    const draw = -0.06 * f * Math.exp(-(X * X) / 1.6) * Math.exp(-((Y - 0.6) ** 2) / 1.5);
    return ridge + nose + socket + lid + folds + draw;
  };

  // ── the groom: per brow, clumps of tapered strands; the head (medial) hairs stand up, the body and tail flow outward ──
  // root at the origin, tip along +x, a slight bend (down for the right brow, mirrored for the left: two geometries)
  const hairGeo = (bend) => { const g2 = new THREE.CylinderGeometry(0.004, 0.018, 1, 6, 8, false).rotateZ(-Math.PI / 2).translate(0.5, 0, 0), p = g2.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i); p.setY(i, p.getY(i) + bend * u * u); } g2.computeVertexNormals(); return g2; };
  const alpha = (() => { const c = document.createElement("canvas"); c.width = 4; c.height = 64; const k = c.getContext("2d"); const gr = k.createLinearGradient(0, 64, 0, 0);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.7, "#ddd"); gr.addColorStop(1, "#333"); k.fillStyle = gr; k.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c); })();
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x2e1d12, roughness: 0.55, metalness: 0, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.7, 0.52, 0.36), specularIntensity: 0.25,
    alphaMap: alpha, alphaToCoverage: true, transparent: false });
  const HAIRS = [];
  for (const s of [-1, 1]) {
    const clumps = Math.round(hairN / 7);
    for (let c = 0; c < clumps; c++) {
      const u = Math.pow(R(), 0.9), cx = s * (0.75 + u * 4.5), cy = 1.08 + 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.1)) - 0.35 * u + (R() - 0.5) * (0.42 - 0.22 * u);
      const th0 = (1.35 - 1.2 * Math.pow(u, 0.7)) + (R() - 0.5) * 0.25;   // the head stands up; the tail lies outward
      for (let j = 0; j < 7; j++) HAIRS.push({ s, x: cx + (R() - 0.5) * 0.12, y: cy + (R() - 0.5) * 0.08, th: th0 + (R() - 0.5) * 0.22, l: (0.24 + R() * 0.18) * (1 - 0.25 * u), lift: 0.08 + R() * 0.12, ph: R() * 6.28 });
    }
  }
  const SIDE = [-1, 1].map((s) => { const list = HAIRS.filter((h) => h.s === s), m = new THREE.InstancedMesh(hairGeo(s > 0 ? -0.07 : 0.07), hairMat, list.length); m.frustumCulled = false; g.add(m);
    const c = new THREE.Color(); list.forEach((h, i) => { const v = 0.6 + 0.8 * R(); c.setRGB(v, v * (0.9 + 0.1 * R()), v * (0.82 + 0.15 * R())); m.setColorAt(i, c); }); m.instanceColor.needsUpdate = true; return { m, list }; });

  // ── vellus: fine pale hair lying on the skin ──
  const vellusMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.93, 0.84, 0.74), roughness: 0.45, transparent: true, opacity: 0.55, depthWrite: false });
  const VEL = Array.from({ length: vellusN }, () => ({ x: (R() - 0.5) * W * 0.9, y: yc + (R() - 0.5) * H * 0.9, a: (R() - 0.5) * 1.2 + (R() > 0.5 ? 0.6 : 2.5), l: 0.05 + R() * 0.07 }));
  const vm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0012, 0.0035, 1, 4, 1).rotateZ(-Math.PI / 2).translate(0.5, 0, 0), vellusMat, VEL.length); vm.frustumCulled = false; g.add(vm);

  const dm = new THREE.Object3D(); dm.rotation.order = "ZYX";
  let last = -1;
  return {
    group: g, mesh, hairMat, vellusMat, surf,
    // set: the inner brows draw in and down with the frown, and the hairs sway with it
    set({ frown = 1 } = {}) {
      if (Math.abs(frown - last) < 1e-3) return; last = frown;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, surf(base[3 * i], base[3 * i + 1], frown));
      pos.needsUpdate = true; geo.computeVertexNormals();
      for (const { m, list } of SIDE) {
        list.forEach((h, i) => {
          const k = Math.exp(-(h.x * h.x) / 5), pull = frown * 0.22 * Math.sign(h.x) * k;
          const X = h.x - pull, Y = h.y - 0.18 * frown * k;
          const th = h.th + 0.16 * frown * k + 0.02 * Math.sin(h.ph + 5 * frown);
          dm.position.set(X, Y, surf(X, Y, frown) + 0.004);
          dm.rotation.set(0, -h.lift, h.s > 0 ? th : Math.PI - th); dm.scale.set(h.l, 1, 1); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      }
      VEL.forEach((v, i) => { dm.position.set(v.x, v.y, surf(v.x, v.y, frown) + 0.003); dm.rotation.set(0, -0.15, v.a); dm.scale.set(v.l, 1, 1); dm.updateMatrix(); vm.setMatrixAt(i, dm.matrix); });
      vm.instanceMatrix.needsUpdate = true;
    },
    at: { lines: () => [x, 0.8, surf(0, 0.8, 1)] },
  };
};
