// nmj04.js — No. 004's neuromuscular junction at cell scale (films/channels/skincare/set), in the approved look
// (look test 2): one nerve ending resting on one muscle fibre, built from studio.js's materials so it reads like the
// look test's white cell. Replaces junction04.js's schematic slab for the hero shot (that file stays as it was).
// An illustration, badged as one: sizes are not to scale (the episode's gauge carries the real gap, ≈ 50 nm).
//
//   const N = createNMJ({ x: 500 });   scene.add(N.group);   (geometry built once; set() moves only what changes)
//   N.set({ t, pull, puff, toxin, cut, bump, sprout, prune, dim })
//     t: seconds (the idle drift of the vesicles)   pull: 0 … 1 the fibre contracts (its bands draw closer)
//     puff: 0 … 1 a cloud of messenger crosses the cleft and lights the receptors on the fibre
//     toxin: 0 … 1 the toxin slips through the ending's wall to the docking proteins   cut: 0 … 1 they are cut in two
//     bump: 0 … 1 the docked vesicles press at the membrane (and, with the protein cut, fall back)
//     sprout: 0 … 1 spare endings grow along the fibre   prune: 0 … 1 they draw back   dim: 0 … 1 the fibre steps back
//   N.at.bulb() · N.at.gap() · N.at.snap() · N.at.tox() · N.at.sprout() → world points for labels and keys
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { cellMaterial, nucleusMaterial, strandMaterial } from "./studio.js";

const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const vn3 = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, q) => a + (b - a) * q; return L(L(L(h3(i, j, k), h3(i + 1, j, k), u), L(h3(i, j + 1, k), h3(i + 1, j + 1, k), u), v), L(L(h3(i, j, k + 1), h3(i + 1, j, k + 1), u), L(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), u), v), w); };
// a membrane: a sphere with soft ruffles (as the look test's white cell)
const ruffled = (r, a = 0.06, seed = 0, ws = 128, hs = 96) => {
  const g = new THREE.SphereGeometry(r, ws, hs), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const d = a * (vn3(n.x * 3 + seed, n.y * 3, n.z * 3) + 0.5 * vn3(n.x * 7.3 + seed, n.y * 7.3, n.z * 7.3) + 0.2 * vn3(n.x * 17, n.y * 17 + seed, n.z * 17) - 0.85);
    v.addScaledVector(n, d * r); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
};
// the fibre's bands (sarcomeres) and its long myofibril lines, as a colour map and a bump map (made once)
const bandTex = (R) => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512; const k = c.getContext("2d");
  for (let y = 0; y < 512; y++) { const s = 0.5 + 0.5 * Math.cos((y / 512) * Math.PI * 2 * 8); const l = Math.round(150 + 80 * s); k.fillStyle = `rgb(${l},${l},${l})`; k.fillRect(0, y, 256, 1); }
  k.globalAlpha = 0.18; for (let i = 0; i < 70; i++) { const x = R() * 256; k.fillStyle = R() > 0.5 ? "#fff" : "#000"; k.fillRect(x, 0, 1 + R() * 1.5, 512); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
};

export const createNMJ = ({ x = 500, seed = 41, cyan = "#5FF2E8", lilac = "#B79BFF" } = {}) => {
  const R = rng(seed), g = new THREE.Group(); g.position.x = x;
  const FR = 5, FL = 80;                                   // the fibre: radius, length (along x); its top is y = 0

  // ── the muscle fibre and its neighbours ──
  const bands = bandTex(R);
  const fibMat = strandMaterial({ tint: [0.78, 0.3, 0.4], gloss: 0.55 }); fibMat.transmission = 0; fibMat.map = bands; fibMat.bumpMap = bands; fibMat.bumpScale = 1.2;
  fibMat.map.repeat.set(3, 15); fibMat.sheenColor = new THREE.Color(1, 0.8, 0.85);
  const fibre = new THREE.Mesh(new THREE.CylinderGeometry(FR, FR, FL, 128, 1, false), fibMat); fibre.rotation.z = Math.PI / 2; fibre.position.set(0, -FR, 0); g.add(fibre);
  const backMat = fibMat.clone(); backMat.color = new THREE.Color(0.42, 0.2, 0.32);   // the neighbours, darker, so the one fibre leads
  for (const [y, z, r] of [[-7, -15, 5.5], [-15, -9, 5], [-3, -30, 6], [-17, 5, 4.5]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, FL, 64), backMat); m.rotation.z = Math.PI / 2; m.position.set(0, y, z); g.add(m); }

  // ── the nerve: an axon from the upper left that swells into one ending resting on the fibre ──
  const nerveMat = strandMaterial({ tint: [0.9, 0.86, 1.0], gloss: 0.7 });
  const axon = new THREE.CatmullRomCurve3([new THREE.Vector3(-34, 22, -10), new THREE.Vector3(-18, 13, -5), new THREE.Vector3(-8, 6, -1.5), new THREE.Vector3(-3, 3.3, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(axon, 96, 1.05, 24, false), nerveMat));
  const BC = new THREE.Vector3(1, 2.7, 0), BS = [4.2, 2.3, 3.4];   // the ending's centre and radii; its floor sits 0.4 above the fibre (the cleft)
  const bulbMat = cellMaterial({ tint: [0.9, 0.87, 1.0], opacity: 0.55 }); bulbMat.transmission = 0.25; bulbMat.roughness = 0.4; bulbMat.depthWrite = false;
  const bulb = new THREE.Mesh(ruffled(1, 0.07, 3), bulbMat); bulb.position.copy(BC); bulb.scale.set(...BS); bulb.renderOrder = 4; g.add(bulb);

  // ── inside: vesicles of messenger (glowing cyan), the lowest docked at the membrane over a docking protein each ──
  const vesMat = nucleusMaterial({ color: cyan, k: 0.42 });
  const VES = [];
  while (VES.length < 90) {
    const p = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]; if (p[0] ** 2 + p[1] ** 2 + p[2] ** 2 > 1) continue;
    if (p[1] < -0.35) continue;
    VES.push({ p: [BC.x + p[0] * BS[0] * 0.72, BC.y + p[1] * BS[1] * 0.62, BC.z + p[2] * BS[2] * 0.7], ph: R() * 6.28, r: 0.14 + R() * 0.07 });
  }
  const ves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), vesMat, VES.length); g.add(ves);
  const DOCK = [-2.1, -1, 0.1, 1.2, 2.3].map((dx, i) => ({ x: BC.x + dx, z: (i % 2 ? 0.7 : -0.3), y: 0.78 }));
  const docked = new THREE.InstancedMesh(new THREE.SphereGeometry(0.21, 20, 14), nucleusMaterial({ color: cyan, k: 0.8 }), DOCK.length); g.add(docked);
  // the docking protein (SNAP-25): a short pale strand from each docked vesicle to the membrane; cut, its halves part and dim
  const snapMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color("#E9FFFD"), emissiveIntensity: 1.1, roughness: 0.4 });
  const snapCut = new THREE.Color(lilac);
  const snaps = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), snapMat, DOCK.length * 2); g.add(snaps);
  // the toxin: a violet, two-lobed fragment that slips through the ending's wall to the docking proteins
  const toxMat = nucleusMaterial({ color: lilac, k: 1.25 }); toxMat.transparent = true;
  const tox = new THREE.Group(); [[-0.22, 0, 0.26], [0.2, 0.08, 0.2]].forEach(([dx, dy, r]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), toxMat); m.position.set(dx, dy, 0); tox.add(m); }); g.add(tox);
  const TOX0 = new THREE.Vector3(-6.5, 6.5, 2.5), TOX1 = new THREE.Vector3(BC.x + 0.6, 1.55, 0.2);

  // ── the receptors on the fibre under the ending: dim pale points that light cyan as the messenger lands ──
  const REC = [];
  for (let i = 0; i < 140; i++) { const px = BC.x + (R() * 2 - 1) * 4.2, pz = (R() * 2 - 1) * 2.9; if ((px - BC.x) ** 2 / 17.6 + pz * pz / 8.4 > 1) continue; REC.push([px, -FR + Math.sqrt(FR * FR - pz * pz) + 0.02, pz]); }
  const recMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cyan), transparent: true, opacity: 0.3, depthWrite: false });
  const rec = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), recMat, REC.length);
  { const d = new THREE.Object3D(); REC.forEach((p, i) => { d.position.set(...p); d.updateMatrix(); rec.setMatrixAt(i, d.matrix); }); } g.add(rec);

  // ── the messenger: soft cyan points from the docked vesicles across the cleft, spreading over the receptors ──
  const dot = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"); const gr = k.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = gr; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const NP = 260, PF = Array.from({ length: NP }, () => ({ d: DOCK[Math.floor(R() * DOCK.length)], a: R() * 6.28, s: R(), k: R() }));
  const pPos = new Float32Array(NP * 3), pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ map: dot, size: 0.16, color: new THREE.Color(cyan).multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const puffPts = new THREE.Points(pGeo, pMat); puffPts.frustumCulled = false; g.add(puffPts);

  // ── spare endings: thin sprouts from the ending along the fibre (grown, later pruned) ──
  const SPR = [[1, 0.6, 9], [-1, -0.8, 8], [1, -1.6, 7], [-1, 1.4, 6]].map(([dir, tz, len]) => {
    const zs = (zz) => -FR + Math.sqrt(FR * FR - zz * zz) + 0.32;
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(BC.x + dir * 3.4, 1.0, tz * 0.5), new THREE.Vector3(BC.x + dir * (3.4 + len * 0.45), zs(tz * 0.9) + 0.1, tz * 0.9), new THREE.Vector3(BC.x + dir * (3.4 + len), zs(tz * 1.2), tz * 1.2)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 48, 0.28, 10, false), nerveMat); m.geometry.setDrawRange(0, 0); g.add(m);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), nerveMat); tip.visible = false; g.add(tip);
    return { m, n: m.geometry.index.count, c, tip };
  });

  const d = new THREE.Object3D();
  const BC_W = () => [x + BC.x, BC.y, BC.z];
  return {
    group: g, BC,
    set({ t = 0, pull = 0, puff = 0, toxin = 0, cut = 0, bump = 0, sprout = 0, prune = 0, dim = 0 } = {}) {
      // the fibre contracts: shorter, its bands closer
      fibre.scale.set(1 + 0.04 * pull, 1 - 0.05 * pull, 1 + 0.04 * pull); fibMat.map.repeat.set(3, 15 * (1 + 0.14 * pull));
      const k = 1 - 0.5 * dim; fibMat.color.setRGB(0.78 * k, 0.3 * k, 0.4 * k);
      // the vesicles idle (a slow drift inside the ending)
      VES.forEach((v, i) => { d.position.set(v.p[0] + 0.08 * Math.sin(t * 0.6 + v.ph), v.p[1] + 0.06 * Math.sin(t * 0.5 + v.ph * 2), v.p[2] + 0.07 * Math.cos(t * 0.55 + v.ph)); d.scale.setScalar(v.r); d.updateMatrix(); ves.setMatrixAt(i, d.matrix); });
      ves.instanceMatrix.needsUpdate = true;
      // the docked vesicles: they press down on the message (released before the cut; held after it)
      DOCK.forEach((q, i) => {
        const press = 0.22 * Math.sin(Math.PI * Math.min(1, puff * 2)) * (1 - cut) + 0.18 * bump;
        d.position.set(q.x, q.y - press, q.z); d.scale.setScalar(1); d.updateMatrix(); docked.setMatrixAt(i, d.matrix);
        for (let j = 0; j < 2; j++) {   // the protein's halves: joined, then parted
          const s = j ? 1 : -1;
          d.position.set(q.x + s * 0.17 * cut, q.y - 0.3 - press + s * 0.09 + (j ? 0 : -0.06) * cut - 0.15 * cut * (j ? 0 : 1), q.z + 0.1);
          d.rotation.set(0, 0, s * (0.15 + 0.9 * cut)); d.updateMatrix(); snaps.setMatrixAt(2 * i + j, d.matrix); d.rotation.set(0, 0, 0);
        }
      });
      docked.instanceMatrix.needsUpdate = true; snaps.instanceMatrix.needsUpdate = true;
      snapMat.emissive.setRGB(0.91 + (snapCut.r - 0.91) * cut, 1 + (snapCut.g - 1) * cut, 0.99 + (snapCut.b - 0.99) * cut); snapMat.emissiveIntensity = 1.1 - 0.5 * cut;
      // the toxin: in through the wall, settling by the docking proteins
      tox.visible = toxin > 0.01; toxMat.opacity = Math.min(1, toxin * 4);
      const u = toxin * toxin * (3 - 2 * toxin); tox.position.lerpVectors(TOX0, TOX1, u); tox.position.y += 1.2 * Math.sin(Math.PI * u) * (1 - u); tox.rotation.set(0.4 * t, 0.7 * t, 0.2);
      // the messenger: down across the cleft, then spread over the receptors
      PF.forEach((q, i) => {
        const e = Math.max(0, Math.min(1, (puff - q.k * 0.3) / 0.7)), fall = Math.min(1, e * 2), spread = Math.max(0, e * 2 - 1) * 0.6 + e * 0.4;
        pPos[3 * i] = q.d.x + Math.cos(q.a) * (0.25 + 3.2 * q.s * spread); pPos[3 * i + 1] = 0.6 - 0.56 * fall + 0.05 * Math.sin(t * 3 + q.a); pPos[3 * i + 2] = q.d.z + Math.sin(q.a) * (0.2 + 2.2 * q.s * spread);
      });
      pGeo.attributes.position.needsUpdate = true; pMat.opacity = puff > 0 && puff < 1 ? 0.95 * Math.min(1, puff * 6) * Math.min(1, (1 - puff) * 4) : 0;
      recMat.opacity = 0.22 + 0.7 * Math.sin(Math.PI * Math.min(1, puff * 1.15)); recMat.color.setRGB(0.37 + 0.3 * puff * (1 - puff), 0.95, 0.91);
      // the spare endings: grow, then draw back
      const grow = Math.max(0, sprout - prune);
      SPR.forEach((s, j) => {
        const k2 = Math.max(0, Math.min(1, grow * 1.3 - j * 0.1)); s.m.geometry.setDrawRange(0, Math.floor(s.n * k2 / 3) * 3);
        s.tip.visible = k2 > 0.02; if (s.tip.visible) { s.tip.position.copy(s.c.getPoint(k2)); s.tip.scale.setScalar(0.6 + 0.4 * k2); }
      });
    },
    at: {
      bulb: () => [x + BC.x - 1.5, BC.y + BS[1] * 0.9, BC.z],
      gap: () => [x + BC.x + 2.5, 0.2, 1.6],
      snap: () => [x + DOCK[2].x, DOCK[2].y - 0.5, DOCK[2].z],
      tox: () => [x + tox.position.x, tox.position.y, tox.position.z],
      sprout: () => [x + BC.x + 9, 0.5, 0.5],
      centre: BC_W,
    },
  };
};
