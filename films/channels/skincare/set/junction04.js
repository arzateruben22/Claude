// junction04.js — No. 004's world below the frown (films/channels/skincare/set), as a cut-face section in the macro
// flight's warm light: the skin on top (a crease that folds as the muscle pulls), a band of muscle fibres under it,
// and one motor nerve that ends in a bulb on the top fibre (the neuromuscular junction). Inside the bulb: vesicles
// of the chemical messenger (acetylcholine), a docking protein (SNAP-25) for each, and room for the toxin.
// Schematic and simplified: sizes are not to scale (the episode's gauge carries the real gap, ≈ 50 nm).
//
//   const J = createJunction({ x: 4000, tone: [r, g, b] });   scene.add(J.group);
//   J.set({ pull, puff, cut, toxin, sprout, open, dim })
//     pull: 0 … 1 the muscle contracts and the crease above folds   puff: 0 … 1 a cloud of messenger crosses the gap
//     toxin: 0 … 1 the toxin fragment slips into the bulb            cut: 0 … 1 the docking protein is cut in two
//     sprout: 0 … 1 new nerve endings grow from the bulb           open: 0 … 1 the bulb's near half fades (see inside)
//   J.at.bulb() · J.at.gap() · J.at.crease() · J.at.snap() · J.at.muscle() · J.at.sprout() → points for labels and keys
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => s2l(parseInt(x.slice(i, i + 2), 16) / 255)); };

export const createJunction = ({ x = 4000, tone = [0.78, 0.56, 0.42], seed = 41, cyan = "#5FF2E8", lilac = "#C3A6FF" } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  g.position.x = x;
  const W = 200, D = 60;                         // the slab's width (x) and depth (z); the cut face is at z = +D/2
  const CY = hexLin(cyan), LI = hexLin(lilac);

  // ── the skin on top: a slab from y = 22 to 44 whose top folds into a crease at x = 0 ──
  const skinGeo = new THREE.BoxGeometry(W, 10, D, 160, 4, 24);
  const sp = skinGeo.attributes.position, sBase = Float32Array.from(sp.array);
  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...tone), roughness: 0.6, metalness: 0 });
  const skin = new THREE.Mesh(skinGeo, skinMat); skin.position.y = 39; g.add(skin);
  // the dermis under it: a pinker, fibrous band (y 0 … 34)
  // its cut face carries the collagen: wavy pale strands (a canvas texture, made once)
  const collagen = (() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 128; const k = c.getContext("2d");
    k.fillStyle = "#d98d7e"; k.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 70; i++) {
      const y0 = R() * 128, a = 2 + R() * 5, f = 0.02 + R() * 0.03, ph = R() * 6;
      k.strokeStyle = `rgba(${250},${222 + Math.round(R() * 20)},${205},${0.25 + R() * 0.35})`; k.lineWidth = 1 + R() * 2.2; k.beginPath();
      for (let x = 0; x <= 512; x += 8) k.lineTo(x, y0 + a * Math.sin(x * f + ph)); k.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const derm = new THREE.Mesh(new THREE.BoxGeometry(W, 34, D), new THREE.MeshStandardMaterial({ map: collagen, roughness: 0.85 }));
  derm.position.y = 17; g.add(derm);

  // ── the muscle: five fibres along x, striped (the sarcomeres), under the dermis ──
  const FIB = [];
  const stripeTex = (() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 8; const k = c.getContext("2d");
    for (let i = 0; i < 256; i++) { const s = 0.5 + 0.5 * Math.cos(i / 256 * Math.PI * 2 * 16); k.fillStyle = `rgb(${Math.round(150 + 40 * s)},${Math.round(62 + 18 * s)},${Math.round(64 + 16 * s)})`; k.fillRect(i, 0, 1, 8); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(4, 1); return t;
  })();
  const fibMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.55 });
  // the front-top fibre (by the cut face) carries the nerve; the rest pack in behind and below it
  for (const [y, z, r] of [[-26, 12, 8], [-28, -6, 7.5], [-24, -22, 7], [-44, 4, 8], [-46, -14, 7.5], [-42, 20, 6.5], [-62, 14, 8], [-64, -4, 7.5], [-60, -20, 7], [-80, 6, 8], [-82, -12, 7.5], [-78, 22, 7]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, W - 4, 32, 1), fibMat);
    m.rotation.z = Math.PI / 2; m.position.set(0, y, z); g.add(m); FIB.push({ m, r, y, z });
  }
  const top = FIB[0], topY = top.y + top.r, ZN = top.z;
  // the fat behind the muscle (a pale backdrop, so the gap under the dermis is tissue, not empty)
  const fat = new THREE.Mesh(new THREE.BoxGeometry(W, 92, 6), new THREE.MeshStandardMaterial({ color: 0xe9d3a6, roughness: 0.9 }));
  fat.position.set(0, -46, -D / 2 + 3); g.add(fat);

  // ── the nerve: a pale cable from the left, ending in a bulb on the top fibre ──
  const nerveMat = new THREE.MeshStandardMaterial({ color: 0xf6e7c8, emissive: 0x4a3a24, emissiveIntensity: 0.5, roughness: 0.45, transparent: true, opacity: 1 });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-110, -9, ZN - 8), new THREE.Vector3(-60, -10, ZN - 2), new THREE.Vector3(-22, topY + 12, ZN), new THREE.Vector3(-6, topY + 9, ZN)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 2.6, 12, false), nerveMat));
  const B = new THREE.Vector3(4, topY + 7.5, ZN);                    // the bulb's centre
  const bulbNear = new THREE.Mesh(new THREE.SphereGeometry(9, 40, 24, 0, Math.PI, 0, Math.PI), nerveMat.clone());   // the near half (fades to see inside)
  const bulbFar = new THREE.Mesh(new THREE.SphereGeometry(9, 40, 24, Math.PI, Math.PI, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe6d6c2, emissive: 0x6a5a48, emissiveIntensity: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
  for (const b of [bulbNear, bulbFar]) { b.position.copy(B); b.scale.set(1.3, 0.75, 1); g.add(b); }
  bulbNear.material.transparent = true;
  // inside: vesicles of messenger (cyan beads), the lowest ones docked at the membrane with a SNAP-25 strand each
  const vesMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...CY), emissive: new THREE.Color(...CY), emissiveIntensity: 0.25, roughness: 0.3, transparent: true });
  const ves = [];
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2, rr = 2 + R() * 5;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 12), vesMat); m.position.set(B.x + Math.cos(a) * rr * 1.2, B.y + 0.5 + Math.sin(a) * 2.2, B.z + (R() - 0.5) * 6); g.add(m); ves.push(m);
  }
  const docked = [-4, 0, 4].map((dx) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 12), vesMat); m.position.set(B.x + dx, B.y - 4.1, B.z + 2); g.add(m); return m; });
  // SNAP-25 under the middle docked vesicle: two short halves of a strand (cut → they drift apart)
  const snapMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...CY), transparent: true, toneMapped: true });
  const snap = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.9, 8), snapMat); m.rotation.z = Math.PI / 2; g.add(m); return m; });
  // the toxin: a lilac fragment (two lobes) that slips in through the bulb's wall
  const toxMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...LI), emissive: new THREE.Color(...LI), emissiveIntensity: 0.35, roughness: 0.35, transparent: true });
  const tox = new THREE.Group(); [[-0.9, 0, 1.3], [1.0, 0.3, 0.95]].forEach(([dx, dy, r]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), toxMat); m.position.set(dx, dy, 0); tox.add(m); }); g.add(tox);
  // the messenger released: a cloud of small cyan beads crossing the gap to the fibre
  const puffMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...CY).multiplyScalar(1.4), transparent: true, toneMapped: true, depthWrite: false });
  const PUFF = Array.from({ length: 26 }, () => ({ dx: (R() - 0.5) * 12, dz: (R() - 0.5) * 6, k: R() }));
  const puff = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), puffMat, PUFF.length); puff.frustumCulled = false; g.add(puff);
  // new endings: thin sprouts growing from the bulb along the fibre
  const SPR = [[1, 0.2], [-1, -0.3], [1, -0.6]].map(([dir, tw]) => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(B.x + dir * 10, B.y - 3, B.z), new THREE.Vector3(B.x + dir * 22, topY + 2.4, B.z + tw * 6), new THREE.Vector3(B.x + dir * 36, topY + 1.4, B.z + tw * 10)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.9, 8, false), nerveMat); m.geometry.setDrawRange(0, 0); g.add(m); return { m, n: m.geometry.index.count };
  });
  const dm = new THREE.Object3D();
  return {
    group: g, topY, B,
    set({ pull = 0, puff: p = 0, cut = 0, toxin = 0, sprout = 0, open = 0, dim = 0 } = {}) {
      // the crease: the skin's top surface folds down at x = 0 as the muscle pulls; the fibres shorten a little
      for (let i = 0; i < sp.count; i++) {
        const x0 = sBase[3 * i], y0 = sBase[3 * i + 1];
        if (y0 > 4.9) sp.setY(i, y0 - (1.5 + 6 * pull) * Math.exp(-(x0 * x0) / (2 * (7 + 4 * (1 - pull)) ** 2)));
        sp.setX(i, x0 * (1 - 0.05 * pull * Math.exp(-(x0 * x0) / 9000)));
      }
      sp.needsUpdate = true; skinGeo.computeVertexNormals();
      stripeTex.repeat.set(4 * (1 + 0.12 * pull), 1);
      for (const f of FIB) f.m.scale.set(1 + 0.06 * pull, 1 - 0.04 * pull, 1 + 0.06 * pull);
      bulbNear.material.opacity = 1 - 0.85 * open; bulbNear.material.depthWrite = open < 0.5;
      // the messenger: from the docked vesicles down across the gap, spreading over the fibre
      PUFF.forEach((q, i) => {
        const k = Math.max(0, Math.min(1, (p - q.k * 0.35) / 0.65)), on = k > 0 && k < 1 ? 1 : 0;
        dm.position.set(B.x + q.dx * (0.3 + 1.2 * k), B.y - 5 - (B.y - 5 - topY - 0.4) * k, B.z + q.dz * (0.4 + k));
        dm.scale.setScalar(on * (1 - 0.4 * k) + 1e-4); dm.updateMatrix(); puff.setMatrixAt(i, dm.matrix);
      });
      puff.instanceMatrix.needsUpdate = true; puffMat.opacity = 0.95;
      for (const d of docked) d.position.y = B.y - 4.1 - 1.2 * p * (1 - cut);
      // the toxin enters through the wall and settles by the docking protein
      tox.visible = toxin > 0.01; toxMat.opacity = Math.min(1, toxin * 3);
      tox.position.set(B.x - 16 + 16 * toxin, B.y + 6 - 10 * toxin, B.z + 3);
      snap.forEach((m, j) => { m.position.set(B.x + (j ? 1.05 : -1.05) + (j ? 1 : -1) * 1.6 * cut, B.y - 5.9 - 0.8 * cut, B.z + 2.2); m.rotation.z = Math.PI / 2 + (j ? 1 : -1) * 0.5 * cut; });
      // the sprouts
      SPR.forEach((s, j) => s.m.geometry.setDrawRange(0, Math.floor(s.n * Math.max(0, Math.min(1, sprout * 1.4 - j * 0.2)) / 3) * 3));
      // dim: the cut face steps back (the gauge's beat), the nerve and its messenger stay bright
      const k = 1 - 0.45 * dim;
      skinMat.color.setRGB(tone[0] * k, tone[1] * k, tone[2] * k);
      fibMat.color.setScalar(k);
    },
    at: {
      bulb: () => [x + B.x, B.y + 6, B.z],
      gap: () => [x + B.x, topY + 0.6, B.z + 2],
      snap: () => [x + B.x, B.y - 6, B.z + 2.2],
      crease: () => [x, 44 - 2.5, D / 2],
      muscle: () => [x + 60, top.y, top.z + top.r],
      sprout: () => [x + B.x + 30, topY + 2, B.z],
      nerve: () => [x - 60, -10, ZN],
      tox: () => [x + tox.position.x, tox.position.y, tox.position.z],
    },
  };
};
