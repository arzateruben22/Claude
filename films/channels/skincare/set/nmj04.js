// nmj04.js — No. 004's neuromuscular junction at cell scale (films/channels/skincare/set), in the approved look
// (look test 2): one nerve ending resting on one muscle fibre, built from studio.js's materials. An illustration,
// badged as one: sizes are not to scale (the episode's gauge carries the real gap, ≈ 50 nm). Review round 1 (3 Nov):
// vesicles are lit spheres with a fresnel rim and an inner glow, clustered at the docking zone and drifting; the fibre's
// sarcomeres are geometry; the ending is a translucent shell with a violet back-rim; SNAP-25 is a twisted strand that
// visibly splits on "cuts".
//
//   const N = createNMJ({ x: 500 });   scene.add(N.group);   (geometry built once; set() moves only what changes)
//   N.set({ t, pull, puff, toxin, cut, bump, sprout, prune, dim })
//     t: seconds (the vesicles' drift)   pull: 0 … 1 the fibre contracts   puff: 0 … 1 the messenger crosses the cleft
//     toxin: 0 … 1 the toxin slips in    cut: 0 … 1 SNAP-25 splits        bump: 0 … 1 docked vesicles press and fall back
//     sprout: 0 … 1 spare endings grow   prune: 0 … 1 they draw back      dim: 0 … 1 the fibre steps back
//   N.at.bulb() · N.at.gap() · N.at.snap() · N.at.tox() · N.at.sprout() → world points for labels, keys and focus
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { cellMaterial, strandMaterial } from "./studio.js";

const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const vn3 = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, q) => a + (b - a) * q; return L(L(L(h3(i, j, k), h3(i + 1, j, k), u), L(h3(i, j + 1, k), h3(i + 1, j + 1, k), u), v), L(L(h3(i, j, k + 1), h3(i + 1, j, k + 1), u), L(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), u), v), w); };
const ruffled = (r, a = 0.06, seed = 0, ws = 128, hs = 96) => {
  const g = new THREE.SphereGeometry(r, ws, hs), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const d = a * (vn3(n.x * 3 + seed, n.y * 3, n.z * 3) + 0.5 * vn3(n.x * 7.3 + seed, n.y * 7.3, n.z * 7.3) + 0.2 * vn3(n.x * 17, n.y * 17 + seed, n.z * 17) - 0.85);
    v.addScaledVector(n, d * r); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
};
// a fresnel rim added to a material's emission (light coming back at grazing angles): the vesicles' rim, the ending's back-rim
const rim = (m, color, k, pw = 2.5, key = "rim") => {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(color) }; sh.uniforms.uRimK = { value: k };
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uRim; uniform float uRimK;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n  { float fr = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), ${pw.toFixed(2)}); totalEmissiveRadiance += uRim * uRimK * fr; }`);
  };
  m.customProgramCacheKey = () => key; m.needsUpdate = true; return m;
};
const bandTex = (R) => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512; const k = c.getContext("2d");
  for (let y = 0; y < 512; y++) { const s = 0.5 + 0.5 * Math.cos((y / 512) * Math.PI * 2 * 8); const l = Math.round(160 + 70 * s); k.fillStyle = `rgb(${l},${l},${l})`; k.fillRect(0, y, 256, 1); }
  k.globalAlpha = 0.16; for (let i = 0; i < 90; i++) { const x = R() * 256; k.fillStyle = R() > 0.5 ? "#fff" : "#000"; k.fillRect(x, 0, 1 + R() * 1.5, 512); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
};

export const createNMJ = ({ x = 500, seed = 41, cyan = "#5FF2E8", lilac = "#B79BFF" } = {}) => {
  const R = rng(seed), g = new THREE.Group(); g.position.x = x;
  const FR = 5, FL = 80, BAND = FL / 120;                 // the fibre: radius, length (along x), one sarcomere; its top is y = 0

  // ── the muscle fibre: sarcomeres as ripples in the geometry and as bands in the colour and bump ──
  const bands = bandTex(R);
  const fibMat = strandMaterial({ tint: [0.74, 0.32, 0.36], gloss: 0.5 }); fibMat.transmission = 0; fibMat.map = bands; fibMat.bumpMap = bands; fibMat.bumpScale = 1.6;
  fibMat.map.repeat.set(3, 15); fibMat.sheenColor = new THREE.Color(1, 0.78, 0.74);
  const fibGeo = new THREE.CylinderGeometry(FR, FR, FL, 160, 720, false);
  { const p = fibGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 + 0.016 * Math.cos((2 * Math.PI * (y + FL / 2)) / BAND) + 0.006 * vn3(p.getX(i) * 0.6, y * 0.15, p.getZ(i) * 0.6); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } fibGeo.computeVertexNormals(); }
  const fibre = new THREE.Mesh(fibGeo, fibMat); fibre.rotation.z = Math.PI / 2; fibre.position.set(0, -FR, 0); g.add(fibre);
  const backMat = fibMat.clone(); backMat.color = new THREE.Color(0.4, 0.18, 0.26);
  for (const [y, z, r] of [[-7, -15, 5.5], [-15, -9, 5], [-3, -30, 6], [-17, 5, 4.5]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, FL, 64), backMat); m.rotation.z = Math.PI / 2; m.position.set(0, y, z); g.add(m); }

  // ── the nerve and its ending: a translucent shell with a violet back-rim ──
  const nerveMat = strandMaterial({ tint: [0.9, 0.86, 1.0], gloss: 0.7 }); rim(nerveMat, lilac, 0.35, 2.5, "nmjNerve");
  const axon = new THREE.CatmullRomCurve3([new THREE.Vector3(-34, 22, -10), new THREE.Vector3(-18, 13, -5), new THREE.Vector3(-8, 6, -1.5), new THREE.Vector3(-3, 3.3, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(axon, 96, 1.05, 24, false), nerveMat));
  const BC = new THREE.Vector3(1, 2.7, 0), BS = [4.2, 2.3, 3.4];   // the ending's centre and radii; its floor sits 0.4 above the fibre (the cleft)
  const bulbMat = cellMaterial({ tint: [0.9, 0.87, 1.0], opacity: 0.5 }); bulbMat.transmission = 0.25; bulbMat.roughness = 0.35; bulbMat.depthWrite = false;
  rim(bulbMat, lilac, 0.9, 2.2, "nmjShell");
  const bulb = new THREE.Mesh(ruffled(1, 0.07, 3), bulbMat); bulb.position.copy(BC); bulb.scale.set(...BS); bulb.renderOrder = 4; g.add(bulb);

  // ── vesicles: lit spheres, a cyan inner glow and a bright rim, varied in size, clustered over the docking zone ──
  const vesMat = rim(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.32, 0.7, 0.72), emissive: new THREE.Color(cyan), emissiveIntensity: 0.16, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }), "#C9FFFA", 0.8, 2.4, "nmjVes");
  const DOCK = [-2.1, -1, 0.1, 1.2, 2.3].map((dx, i) => ({ x: BC.x + dx, z: (i % 2 ? 0.7 : -0.3), y: 1.0 }));
  const VES = [];
  for (let n = 0; n < 50; n++) {
    let p;
    if (n < 40) { const d = DOCK[n % DOCK.length]; p = [d.x + (R() - 0.5) * 0.9, d.y + 0.3 + R() * 0.7, d.z + (R() - 0.5) * 1.0]; }   // clusters over each docking site
    else { for (;;) { const q = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]; if (q[0] ** 2 + q[1] ** 2 + q[2] ** 2 < 1 && q[1] > -0.2) { p = [BC.x + q[0] * BS[0] * 0.7, BC.y + q[1] * BS[1] * 0.6, BC.z + q[2] * BS[2] * 0.68]; break; } } }
    VES.push({ p, r: 0.08 + R() * R() * 0.12, ph: [R() * 6.28, R() * 6.28, R() * 6.28], f: 0.4 + R() * 0.5 });
  }
  const ves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), vesMat, VES.length); g.add(ves);
  const docked = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 24, 16), vesMat, DOCK.length); g.add(docked);

  // ── SNAP-25: per docked vesicle, a twisted double strand down to the membrane, in two halves that part on the cut ──
  const snapMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color("#E9FFFD"), emissiveIntensity: 1.2, roughness: 0.4 });
  const snapCut = new THREE.Color(lilac);
  const helix = (y0, y1, ph) => { const pts = []; for (let k = 0; k <= 24; k++) { const u = k / 24, a = ph + u * Math.PI * 2 * 1.4; pts.push(new THREE.Vector3(0.045 * Math.cos(a), y0 + (y1 - y0) * u, 0.045 * Math.sin(a))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.014, 6, false); };
  const SN = DOCK.map((q) => {
    const top = new THREE.Group(), bot = new THREE.Group();   // local origin: the split point
    for (const ph of [0, Math.PI]) { top.add(new THREE.Mesh(helix(0, 0.2, ph), snapMat)); bot.add(new THREE.Mesh(helix(-0.2, 0, ph + Math.PI * 1.4), snapMat)); }
    g.add(top, bot); return { q, top, bot };
  });
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: new THREE.Color(lilac), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"), gr = k.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = gr; k.fillRect(0, 0, 64, 64); flash.material.map = new THREE.CanvasTexture(c); }
  flash.scale.set(1.2, 1.2, 1); g.add(flash);

  // the toxin: a violet, two-lobed fragment that slips in through the ending's wall from the camera side
  const toxMat = rim(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.35, 0.25, 0.6), emissive: new THREE.Color(lilac), emissiveIntensity: 0.9, roughness: 0.3, clearcoat: 0.8, transparent: true }), "#E8DDFF", 1.0, 2.0, "nmjTox");
  const tox = new THREE.Group(); [[-0.2, 0, 0.24], [0.19, 0.07, 0.18]].forEach(([dx, dy, r]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), toxMat); m.position.set(dx, dy, 0); tox.add(m); }); g.add(tox);
  const TOX0 = new THREE.Vector3(-4.5, 4.8, 4.2), TOX1 = new THREE.Vector3(BC.x + 0.45, 0.98, 0.45);

  // ── receptors on the fibre under the ending: dim points that light cyan as the messenger lands ──
  const REC = [];
  for (let i = 0; i < 160; i++) { const px = BC.x + (R() * 2 - 1) * 4.2, pz = (R() * 2 - 1) * 2.9; if ((px - BC.x) ** 2 / 17.6 + pz * pz / 8.4 > 1) continue; REC.push([px, -FR + Math.sqrt(FR * FR - pz * pz) + 0.02, pz]); }
  const recMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cyan), transparent: true, opacity: 0.25, depthWrite: false });
  const rec = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), recMat, REC.length);
  { const d = new THREE.Object3D(); REC.forEach((p, i) => { d.position.set(...p); d.updateMatrix(); rec.setMatrixAt(i, d.matrix); }); } g.add(rec);

  // ── the messenger: soft cyan points from the docked vesicles across the cleft, spreading over the receptors ──
  const dot = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"); const gr = k.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = gr; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const NP = 260, PF = Array.from({ length: NP }, () => ({ d: DOCK[Math.floor(R() * DOCK.length)], a: R() * 6.28, s: R(), k: R() }));
  const pPos = new Float32Array(NP * 3), pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ map: dot, size: 0.14, color: new THREE.Color(cyan).multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
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
  const SPLIT = (q) => [q.x, q.y - 0.2 - 0.2, q.z];          // the strand runs from the vesicle's foot (y − 0.2) to the membrane (≈ 0.4 above the fibre)
  return {
    group: g, BC,
    set({ t = 0, pull = 0, puff = 0, toxin = 0, cut = 0, bump = 0, sprout = 0, prune = 0, dim = 0 } = {}) {
      fibre.scale.set(1 + 0.04 * pull, 1 - 0.06 * pull, 1 + 0.04 * pull);   // the fibre shortens (its length is the cylinder's y)
      const k = 1 - 0.5 * dim; fibMat.color.setRGB(0.74 * k, 0.32 * k, 0.36 * k);
      // the vesicles drift (a Brownian-looking wander: three incommensurate sines per axis)
      VES.forEach((v, i) => {
        const w = (a, ph) => 0.07 * Math.sin(t * v.f + ph) + 0.04 * Math.sin(t * v.f * 2.3 + ph * 1.7) + 0.02 * Math.sin(t * v.f * 5.1 + ph * 2.9);
        d.position.set(v.p[0] + w(0, v.ph[0]), v.p[1] + w(1, v.ph[1]), v.p[2] + w(2, v.ph[2])); d.scale.setScalar(v.r); d.rotation.set(0, 0, 0); d.updateMatrix(); ves.setMatrixAt(i, d.matrix);
      });
      ves.instanceMatrix.needsUpdate = true;
      const press = 0.12 * Math.sin(Math.PI * Math.min(1, puff * 2)) * (1 - cut) + 0.1 * bump;
      DOCK.forEach((q, i) => { d.position.set(q.x, q.y - press, q.z); d.scale.setScalar(1); d.updateMatrix(); docked.setMatrixAt(i, d.matrix); });
      docked.instanceMatrix.needsUpdate = true;
      // SNAP-25: joined, then split, the halves springing apart and dimming to lilac
      SN.forEach(({ q, top, bot }, i) => {
        const [sx, sy, sz] = SPLIT(q), c = Math.min(1, cut * (1.15 - 0.03 * i));
        top.position.set(sx, sy - press + 0.06 * c, sz); top.rotation.set(0.3 * c, 0, 0.55 * c);
        bot.position.set(sx, sy - 0.04 * c, sz); bot.rotation.set(-0.25 * c, 0, -0.7 * c);
      });
      snapMat.emissive.setRGB(0.91 + (snapCut.r - 0.91) * cut, 1 + (snapCut.g - 1) * cut, 0.99 + (snapCut.b - 0.99) * cut); snapMat.emissiveIntensity = 1.2 - 0.55 * cut;
      const sp = SPLIT(DOCK[2]); flash.position.set(sp[0], sp[1], sp[2] + 0.1); flash.material.opacity = 0.9 * Math.sin(Math.PI * Math.min(1, cut * 1.6)) * (cut < 0.99 ? 1 : 0);
      // the toxin: in through the wall, settling by the docking proteins
      tox.visible = toxin > 0.01; toxMat.opacity = Math.min(1, toxin * 4);
      const u = toxin * toxin * (3 - 2 * toxin); tox.position.lerpVectors(TOX0, TOX1, u); tox.position.y += 0.8 * Math.sin(Math.PI * u) * (1 - u); tox.rotation.set(0.4 * t, 0.7 * t, 0.2);
      // the messenger: down across the cleft, then spread over the receptors
      PF.forEach((q, i) => {
        const e = Math.max(0, Math.min(1, (puff - q.k * 0.3) / 0.7)), fall = Math.min(1, e * 2), spread = Math.max(0, e * 2 - 1) * 0.6 + e * 0.4;
        pPos[3 * i] = q.d.x + Math.cos(q.a) * (0.2 + 3.2 * q.s * spread); pPos[3 * i + 1] = 0.55 - 0.5 * fall + 0.04 * Math.sin(t * 3 + q.a); pPos[3 * i + 2] = q.d.z + Math.sin(q.a) * (0.2 + 2.2 * q.s * spread);
      });
      pGeo.attributes.position.needsUpdate = true; pMat.opacity = puff > 0 && puff < 1 ? 0.95 * Math.min(1, puff * 6) * Math.min(1, (1 - puff) * 4) : 0;
      recMat.opacity = 0.2 + 0.7 * Math.sin(Math.PI * Math.min(1, puff * 1.15));
      const grow = Math.max(0, sprout - prune);
      SPR.forEach((s, j) => {
        const k2 = Math.max(0, Math.min(1, grow * 1.3 - j * 0.1)); s.m.geometry.setDrawRange(0, Math.floor(s.n * k2 / 3) * 3);
        s.tip.visible = k2 > 0.02; if (s.tip.visible) { s.tip.position.copy(s.c.getPoint(k2)); s.tip.scale.setScalar(0.6 + 0.4 * k2); }
      });
    },
    at: {
      bulb: () => [x + BC.x - 1.5, BC.y + BS[1] * 0.9, BC.z],
      gap: () => [x + BC.x + 2.5, 0.2, 1.6],
      snap: () => { const s = SPLIT(DOCK[2]); return [x + s[0], s[1], s[2]]; },
      tox: () => [x + tox.position.x, tox.position.y, tox.position.z],
      sprout: () => [x + BC.x + 9, 0.5, 0.5],
    },
  };
};
