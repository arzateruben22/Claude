// follicle06.js — No. 006's set (films/channels/skincare/set): goosebumps at two scales, built once, set from t.
//   createPatch: a patch of skin at the mm rung (1 unit = 1 µm, about 3 mm across) with fine hairs on a seeded grid;
//     `raise` (0 … 1) pulls each hair upright and lifts a bump beside it (piloerection). Tone from the melanin ramp.
//   createFollicle: one follicle cut open (simplified, badged): epidermis and dermis as slabs, the follicle sloping
//     down to its bulb, the hair inside, the arrector pili muscle from the follicle's bulge to just under the surface,
//     the sympathetic nerve, and the stem cells at the bulge. `pull` shortens the muscle (the hair tips upright and
//     the surface dips where the muscle meets it, so the skin round the hair stands as a bump); `fire` sends pulses
//     down the nerve; `wake` lights and multiplies the stem cells; `grow` pushes a new hair up from the bulb;
//     `muscle` 0 removes the muscle (its nerve branch to the stem cells then fades with `wire`).
//   createFur: a block of furred coat (illustration): dense hairs that stand with `raise`, and the air they trap as a
//     faint water-glow layer that thickens with them.
// Colours: skin from toneColor (never a token); muscle a muted red-brown stain, nerve ink, pulses and air water-glow,
// stem cells lit in water-glow (the barrier colour: renewal), never uv.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { toneColor } from "./section.js";

const D2R = Math.PI / 180;
const mixc = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);

export const createPatch = ({ size = 3000, spacing = 260, seed = 61, hairLen = 900, hairW = 26, x = 0 } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.x = x;
  const half = size / 2, foll = [];
  for (let gx = -half + spacing / 2; gx < half; gx += spacing) for (let gz = -half + spacing / 2; gz < half; gz += spacing)
    foll.push({ x: gx + (R() - 0.5) * spacing * 0.7, z: gz + (R() - 0.5) * spacing * 0.7, yaw: (R() - 0.5) * 0.6 + 0.4, len: hairLen * (0.6 + 0.6 * R()), k: R() });
  const geo = new THREE.PlaneGeometry(size, size, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, y0 = new Float32Array(pos.count);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
  const skin = new THREE.Mesh(geo, mat);
  g.add(skin);
  // per vertex: the nearest follicle's offset (the bump sits a little downhill of the hair, where the muscle pulls)
  const near = new Int32Array(pos.count), dx = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let best = 0, bd = Infinity;
    const px = pos.getX(i), pz = pos.getZ(i);
    for (let j = 0; j < foll.length; j++) { const d = (foll[j].x - px) ** 2 + (foll[j].z - pz) ** 2; if (d < bd) { bd = d; best = j; } }
    near[i] = best; dx[i] = Math.sqrt(bd);
    y0[i] = 6 * Math.sin(px / 140 + 0.3) * Math.sin(pz / 170);       // fine skin texture, always there
  }
  const hm = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, transparent: true, opacity: 0.85 });
  const hairs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 1, 1, 6, 1).translate(0, 0.5, 0), hm, foll.length);
  g.add(hairs);
  const dummy = new THREE.Object3D();
  return {
    group: g, foll,
    // raise: 0 (flat, hairs lying at ~70° from upright) … 1 (bumps up, hairs near upright); tone: melanin 0–1
    set({ raise = 0, tone = 0.5, frost = 0 } = {}) {
      const c = toneColor("living", tone);
      mat.color.setRGB(...mixc(c, [0.92, 0.95, 0.98], 0.25 * frost));
      hm.color.setRGB(...mixc(toneColor("fibre", tone), toneColor("corneo", tone), 0.4));
      for (let i = 0; i < pos.count; i++) {
        const f = foll[near[i]], k = Math.min(1, Math.max(0, (raise * 1.25 - f.k * 0.25)));
        const b = 38 * k * Math.exp(-((dx[i] / 70) ** 2));
        pos.setY(i, y0[i] + b);
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
      foll.forEach((f, i) => {
        const k = Math.min(1, Math.max(0, (raise * 1.25 - f.k * 0.25)));
        dummy.position.set(f.x, 30 * k, f.z);
        dummy.rotation.set(0, f.yaw, (70 - 52 * k) * D2R);
        dummy.scale.set(hairLen > 0 ? 13 : 13, f.len, 13);
        dummy.updateMatrix(); hairs.setMatrixAt(i, dummy.matrix);
      });
      hairs.instanceMatrix.needsUpdate = true;
    },
    at: { hair: (j = 0) => { const f = foll[j]; return [x + f.x, 40, f.z]; }, centre: () => [x, 30, 0] },
    nearest: (p) => foll.reduce((a, f, j) => ((f.x - p[0]) ** 2 + (f.z - p[2]) ** 2 < (foll[a].x - p[0]) ** 2 + (foll[a].z - p[2]) ** 2 ? j : a), 0),
  };
};

export const createFollicle = ({ x = 0, seed = 63, epi = 90, depth = 700, width = 1100, thick = 260 } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.x = x;
  const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];   // cut open along z = 0, the camera on +z
  const mat = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clip, ...o });
  const M = { epi: mat(), sc: mat({ roughness: 0.5 }), dermis: mat({ roughness: 0.8 }), sheath: mat(), hair: mat({ roughness: 0.4 }), muscle: mat({ roughness: 0.55 }),
    nerve: mat({ roughness: 0.4 }), stem: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, emissive: 0x000000 }), bulb: mat() };
  // the slabs: dermis below, epidermis on top (with a thin darker dead layer)
  const dermis = new THREE.Mesh(new THREE.BoxGeometry(width, depth + 200, thick, 40, 1, 1), M.dermis);
  dermis.position.set(0, -epi - (depth + 200) / 2, 0);
  const epiGeo = new THREE.BoxGeometry(width, epi, thick, 160, 1, 1), epiPos = epiGeo.attributes.position, epiY = new Float32Array(epiPos.count);
  for (let i = 0; i < epiPos.count; i++) epiY[i] = epiPos.getY(i);
  const epiMesh = new THREE.Mesh(epiGeo, M.epi); epiMesh.position.y = -epi / 2;
  const scGeo = new THREE.BoxGeometry(width, 14, thick, 160, 1, 1), scPos = scGeo.attributes.position, scY = new Float32Array(scPos.count);
  for (let i = 0; i < scPos.count; i++) scY[i] = scPos.getY(i);
  const sc = new THREE.Mesh(scGeo, M.sc); sc.position.y = -7;
  g.add(dermis, epiMesh, sc);
  // the follicle: a tube sloping down at `tilt` from the surface point (fx, 0) to the bulb
  const tilt = 34 * D2R, fx = -60, L = depth, dir = [Math.sin(tilt), -Math.cos(tilt)];
  const P = (s) => [fx + dir[0] * s, dir[1] * s];                       // s µm down the follicle
  const sheath = new THREE.Mesh(new THREE.CylinderGeometry(34, 30, L, 24, 1, true), M.sheath);
  sheath.position.set(...P(L / 2), 0); sheath.rotation.z = tilt;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(48, 24, 16), M.bulb); bulb.position.set(...P(L - 10), 0);
  g.add(sheath, bulb);
  // the hair: from the bulb up through the follicle and out, pivoting at the surface (upright with `pull`)
  const hairIn = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, L, 12), M.hair); hairIn.position.set(...P(L / 2), 0); hairIn.rotation.z = tilt;
  const hairOut = new THREE.Group(), shaft = new THREE.Mesh(new THREE.CylinderGeometry(9, 13, 700, 12).translate(0, 350, 0), M.hair);
  hairOut.add(shaft); hairOut.position.set(fx, 0, 0);
  g.add(hairIn, hairOut);
  // a new hair, grown up from the bulb (whoa): its tip at s = L − grow·(L − 60)
  const newHair = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 1, 12).translate(0, 0.5, 0), M.hair);
  newHair.rotation.z = tilt; g.add(newHair);
  // the muscle: from the bulge (s = 0.42 L, on the downhill side) up to just under the surface, downhill of the hair
  const bulgeS = 0.42 * L, bulge = P(bulgeS), anchor = [fx + 260, -epi - 6];
  const muscle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14), M.muscle);
  const mLine = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14), new THREE.MeshBasicMaterial({ color: 0x13252c, side: THREE.BackSide, transparent: true, opacity: 0.6, toneMapped: false, clippingPlanes: clip }));
  g.add(mLine, muscle);
  // the nerve: from deep in the dermis up to the muscle, with a branch to the bulge (the stem cells)
  const nA = [anchor[0] + 260, -depth - 120], nB = [(bulge[0] + anchor[0]) / 2 + 40, (bulge[1] + anchor[1]) / 2 - 20], nC = [bulge[0] + 40, bulge[1] - 10];
  const curveMain = new THREE.CatmullRomCurve3([new THREE.Vector3(nA[0], nA[1], 4), new THREE.Vector3(nA[0] - 60, (nA[1] + nB[1]) / 2, 6), new THREE.Vector3(nB[0], nB[1], 6)]);
  const curveBranch = new THREE.CatmullRomCurve3([new THREE.Vector3(nB[0], nB[1], 6), new THREE.Vector3((nB[0] + nC[0]) / 2, (nB[1] + nC[1]) / 2 - 18, 6), new THREE.Vector3(nC[0], nC[1], 6)]);
  const nerve = new THREE.Mesh(new THREE.TubeGeometry(curveMain, 60, 5, 8, false), M.nerve);
  const branchMat = mat({ roughness: 0.4, transparent: true });
  const branch = new THREE.Mesh(new THREE.TubeGeometry(curveBranch, 30, 3.6, 8, false), branchMat);
  g.add(nerve, branch);
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: true });
  const pulses = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 8), pulseMat); g.add(m); return m; });
  // stem cells at the bulge: a seeded cluster on the follicle's outer side
  const stems = Array.from({ length: 22 }, (_, i) => {
    const s = bulgeS + (R() - 0.5) * 70, side = R() < 0.6 ? 1 : -1, p = P(s);
    const m = new THREE.Mesh(new THREE.SphereGeometry(9 + R() * 3, 14, 10), M.stem);
    m.position.set(p[0] + side * 40 * Math.cos(tilt), p[1] + side * 40 * Math.sin(tilt), 4 + R() * 8);
    m.userData.k = i < 10 ? 0 : (i - 10) / 12;                                     // the later ones appear as they divide
    g.add(m); return m;
  });
  const place = (m, a, b, r) => { const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0), l = v.length(); m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); m.scale.set(r, l, r); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); };
  return {
    group: g, dims: { W: width, D: thick, epi, depth, fx, tilt, bulge, anchor },
    set({ tone = 0.2, pull = 0, fire = 0, t = 0, wake = 0, grow = 0, muscle: mu = 1, wire = 1, dimSkin = 0, glow = [0.3, 0.7, 0.75], frost = 0 } = {}) {
      const k = 1 - 0.5 * dimSkin;
      M.epi.color.setRGB(...mixc(toneColor("living", tone), [0.92, 0.95, 0.98], 0.2 * frost).map((v) => v * k));
      M.sc.color.setRGB(...toneColor("corneo", tone).map((v) => v * k));
      M.dermis.color.setRGB(...toneColor("dermis", tone).map((v) => v * k));
      M.sheath.color.setRGB(...toneColor("basal", tone).map((v) => (v + (1 - v) * 0.15) * k));
      M.bulb.color.copy(M.sheath.color);
      M.hair.color.setRGB(...mixc(toneColor("fibre", tone), toneColor("corneo", tone), 0.5));
      M.muscle.color.setRGB(0.42, 0.16, 0.13);
      M.nerve.color.setRGB(0.05, 0.1, 0.12); branchMat.color.copy(M.nerve.color); branchMat.opacity = wire; branch.visible = wire > 0.02;
      // the muscle shortens toward the bulge; its top end pulls the surface down (the dimple that makes the bump read)
      const sh = 0.22 * pull, top = [anchor[0] - (anchor[0] - bulge[0]) * sh, anchor[1] - (anchor[1] - bulge[1]) * sh * 0.5];
      place(muscle, bulge, top, 16 + 6 * pull); place(mLine, bulge, top, 19 + 6 * pull);
      muscle.visible = mLine.visible = mu > 0.02; muscle.material.opacity = mu;
      // the surface: lifted round the hair, dipped where the muscle pulls (simplified)
      const bump = (px) => 46 * pull * Math.exp(-(((px - fx - 80) / 120) ** 2)) - 18 * pull * Math.exp(-(((px - anchor[0]) / 60) ** 2));
      for (let i = 0; i < epiPos.count; i++) if (epiY[i] > 0) epiPos.setY(i, epiY[i] + bump(epiPos.getX(i)));
      for (let i = 0; i < scPos.count; i++) scPos.setY(i, scY[i] + bump(scPos.getX(i)));
      epiPos.needsUpdate = scPos.needsUpdate = true; epiGeo.computeVertexNormals(); scGeo.computeVertexNormals();
      hairOut.position.y = bump(fx);
      hairOut.rotation.z = -(62 - 46 * pull) * D2R;                                // lying downhill → near upright
      // pulses down the nerve: up from the deep end to the muscle and along the branch to the stem cells
      pulseMat.color.setRGB(...glow.map((v) => v * 1.6)); pulseMat.opacity = Math.min(1, fire);
      pulses.forEach((m, i) => {
        const u = ((t * 0.9 + i / pulses.length) % 1 + 1) % 1, onBranch = i % 2 === 1 && wire > 0.3;
        const p = onBranch ? curveBranch.getPoint(u) : curveMain.getPoint(u);
        m.position.set(p.x, p.y, 12); m.visible = fire > 0.02;
      });
      // stem cells: lit and multiplying with wake
      M.stem.color.setRGB(...toneColor("basal", tone).map((v) => v + (1 - v) * 0.4));
      M.stem.emissive.setRGB(...glow.map((v) => v * 0.6 * wake));
      stems.forEach((m) => { const s = Math.min(1, Math.max(0, (wake * 1.2 - m.userData.k))); m.scale.setScalar(m.userData.k === 0 ? 1 : s + 1e-4); m.visible = m.userData.k === 0 || s > 0.01; });
      // the new hair: up from the bulb
      const len = Math.max(1, grow * (L - 80)), base = P(L - 20);
      newHair.position.set(base[0], base[1], 2); newHair.scale.set(1, len, 1); newHair.rotation.z = tilt + Math.PI; newHair.visible = grow > 0.01;
    },
    at: {
      hair: () => [x + fx + 120, 240, 20],
      muscle: () => [x + (bulge[0] + anchor[0]) / 2 + 20, (bulge[1] + anchor[1]) / 2, 30],
      nerve: () => [x + nA[0] - 40, (nA[1] + nB[1]) / 2, 20],
      stem: () => [x + bulge[0] + 50, bulge[1], 30],
      bulb: () => { const p = P(L - 10); return [x + p[0] + 40, p[1], 30]; },
      surface: () => [x - width / 2 + 20, 0, 0],
    },
  };
};

export const createFur = ({ x = 0, size = 1400, n = 900, seed = 65, len = 520 } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.x = x;
  const skin = new THREE.Mesh(new THREE.BoxGeometry(size, 80, size * 0.5), new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 }));
  skin.position.y = -40; skin.material.color.setRGB(0.55, 0.42, 0.36);
  const hm = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  hm.color.setRGB(0.18, 0.13, 0.1);
  const hairs = new THREE.InstancedMesh(new THREE.CylinderGeometry(3, 7, 1, 5, 1).translate(0, 0.5, 0), hm, n);
  const H = Array.from({ length: n }, () => ({ x: (R() - 0.5) * size, z: (R() - 0.5) * size * 0.5, yaw: (R() - 0.5) * 0.8, l: len * (0.75 + 0.5 * R()), k: R() }));
  const air = new THREE.Mesh(new THREE.BoxGeometry(size, 1, size * 0.5).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: true }));
  g.add(skin, hairs, air);
  const dummy = new THREE.Object3D();
  return {
    group: g,
    set({ raise = 0, glow = [0.3, 0.7, 0.75] } = {}) {
      H.forEach((h, i) => {
        const k = Math.min(1, Math.max(0, raise * 1.3 - h.k * 0.3));
        dummy.position.set(h.x, 0, h.z); dummy.rotation.set(0, h.yaw, (72 - 50 * k) * D2R); dummy.scale.set(1, h.l, 1);
        dummy.updateMatrix(); hairs.setMatrixAt(i, dummy.matrix);
      });
      hairs.instanceMatrix.needsUpdate = true;
      const hgt = len * (0.32 + 0.5 * raise);
      air.scale.y = hgt; air.material.color.setRGB(...glow); air.material.opacity = 0.1 + 0.22 * raise;
    },
    at: { air: () => [x + size * 0.25, len * 0.45, size * 0.25], top: () => [x, len * 0.8, 0] },
  };
};
