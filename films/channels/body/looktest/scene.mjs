import * as THREE from "three";
// Body Backstage, season 1 reboot: look test ("live scan"). Three hero stills, 2 s each, one slow move each.
//   0–2 s  lungs (No. 005): a cluster of air pockets wrapped in capillaries, caught mid-scan: above the phosphor
//          line, wet living tissue under a film light; below it, the scan view (glass-dark pockets, blood hot).
//   2–4 s  capillary (No. 001): a vessel sliced open by the scan (the cut edges glow); red cells folded into
//          cups, single file, the hero cell locked in a tracking reticle.
//   4–6 s  synapse (No. 004): one nerve ending over the next cell, in scan view so the packets inside show;
//          the chemical message crossing the gap; the reticle on the gap.
// Units: lungs 1 = 10 µm, capillary 1 = 1 µm, synapse 1 = 10 nm. Every scene is a pure function of t.
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createRig, tissue, scanPatch, SCAN, backdrop, shaft, motes, grain, lumpy, vnoise } from "../set/scan.js";
import { rbcGeometry } from "../set/rbc.js";

const W = window.W, H = window.H;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, threshold: 0.85, bloom: 0.32, exposure: 1.0, maxCoc: 0.03 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 9000);
const rig = createRig(renderer, scene);
const sky = backdrop(scene);
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
const R = rng(5);
const look = (pos, tgt) => { camera.position.set(...pos); camera.lookAt(...tgt); camera.updateMatrixWorld(); };
const mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const v3 = new THREE.Vector3();
const toScreen = (p) => { v3.set(...p).project(camera); return [(v3.x * 0.5 + 0.5) * 1080, (1 - (v3.y * 0.5 + 0.5)) * 1920]; };

// a wandering line on a sphere's surface (a capillary), as a smooth curve
const surfaceWalk = (c, r, n, step, Rn) => {
  let d = new THREE.Vector3(Rn() - 0.5, Rn() - 0.5, Rn() - 0.5).normalize(), h = new THREE.Vector3(Rn() - 0.5, Rn() - 0.5, Rn() - 0.5).cross(d).normalize();
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push(d.clone().multiplyScalar(r).add(c));
    h.applyAxisAngle(d, (Rn() - 0.5) * 0.9);
    const ax = new THREE.Vector3().crossVectors(d, h).normalize(); d.applyAxisAngle(ax, step).normalize(); h.sub(d.clone().multiplyScalar(h.dot(d))).normalize();
  }
  return new THREE.CatmullRomCurve3(pts);
};

// ═══ A: lungs ═══════════════════════════════════════════════════════════════════════════════════════════════
const A = new THREE.Group(); scene.add(A);
const sacMat = scanPatch(tissue({ color: "#E59A90", glow: "#FF7563", glowK: 0.7, wet: 0.9, sheen: 0.7, seed: 4, repeat: 2.5, rough: 0.36 }), { edge: "#BFF8E4", core: "#021416", contour: 0.9 });
sacMat.userData.scanKey = "sac";
const capMat = scanPatch(tissue({ color: "#A8132C", glow: "#FF2E44", glowK: 0.9, wet: 1, sheen: 0.4, seed: 7, repeat: 6, rough: 0.28 }), { edge: "#FF5A6E", core: "#2A0208", hot: 1 });
capMat.userData.scanKey = "cap";
const SACS = [[-3, 2, 4, 9.5], [9, 6, -2, 9], [1, 13, -5, 8.5], [-11, 9, -6, 8.8], [12, -6, -4, 9.2], [-2, -9, -3, 9.6], [-14, -4, -9, 8.4], [4, 1, -15, 9.4], [16, 14, -16, 8]];
const sacGeo = (r, s) => lumpy(new THREE.SphereGeometry(r, 160, 120), 0.07, 2.0, s);
const capGeos = [];
SACS.forEach(([x, y, z, r], i) => {
  const m = new THREE.Mesh(sacGeo(r, i * 3.7), sacMat); m.position.set(x, y, z); A.add(m);
  const Rn = rng(40 + i);
  for (let k = 0; k < 30; k++) { const c = surfaceWalk(new THREE.Vector3(0, 0, 0), r * 1.012, 60, 0.09, Rn); capGeos.push([new THREE.TubeGeometry(c, 180, 0.15 + 0.07 * Rn(), 7, false), [x, y, z]]); }
});
capGeos.forEach(([g, p]) => { const m = new THREE.Mesh(g, capMat); m.position.set(...p); A.add(m); });
// the airway the pockets hang from
const airway = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(4, 4, -8), new THREE.Vector3(10, 22, -12), new THREE.Vector3(14, 46, -20), new THREE.Vector3(12, 80, -30)]), 120, 4.2, 48, false), scanPatch(tissue({ color: "#E8B0A4", glow: "#FF8C76", glowK: 0.5, wet: 0.8, sheen: 0.6, seed: 9, repeat: 5, rough: 0.4 }), { edge: "#BFF8E4", core: "#021416" }));
A.add(airway);
// far clusters (they blur into shapes in the haze)
for (let i = 0; i < 14; i++) { const r = 7 + R() * 5, m = new THREE.Mesh(sacGeo(r, 50 + i), sacMat); m.position.set(-70 + R() * 140, -60 + R() * 130, -70 - R() * 90); A.add(m); }
// red cells riding the capillaries in front (instanced, tiny, true to scale: 0.75 units = 7.5 µm)
const cellGeoSmall = rbcGeometry(THREE, { around: 22, along: 14 }); cellGeoSmall.scale(0.1, 0.1, 0.1);
const cellMat = scanPatch(tissue({ color: "#C8102E", glow: "#FF3048", glowK: 0.8, wet: 1, sheen: 0.5, seed: 2, repeat: 1, micro: 0.2, rough: 0.3 }), { edge: "#FF6B7C", core: "#2A0208", hot: 1 });
cellMat.userData.scanKey = "cell";
const capCells = new THREE.InstancedMesh(cellGeoSmall, cellMat, 260); A.add(capCells);
{ const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0); let n = 0;
  capGeos.slice(0, 48).forEach(([g, p], gi) => { const path = g.parameters.path; for (let s = 0.04; s < 1 && n < 260; s += 0.09 + 0.05 * ((gi * 7) % 3)) {
    const at = path.getPointAt(s).add(new THREE.Vector3(...p)), tg = path.getTangentAt(s); q.setFromUnitVectors(up, tg); M.compose(at, q, new THREE.Vector3(1, 1, 1)); capCells.setMatrixAt(n++, M); } });
  capCells.count = n; capCells.instanceMatrix.needsUpdate = true; }
const shaftA = shaft({ from: [-40, 70, 10], to: [6, -10, 0], radius: 12, color: "#FFE9D2", k: 0.1 }); A.add(shaftA.group);
const dustA = motes(scene, 320, [[-40, -40, -30], [40, 40, 30]], 0.5, "#FFF4E6", R, 0.55);
const o2A = motes(scene, 420, [[-18, -16, -10], [20, 18, 14]], 0.28, "#FFFFFF", R, 0.9);   // oxygen, crossing

// ═══ B: capillary ═══════════════════════════════════════════════════════════════════════════════════════════
const XB = 1000, B = new THREE.Group(); B.position.x = XB; scene.add(B);
// the vessel as a half tube (the scan has sliced away the half facing us), bent gently; 1 = 1 µm
const bend = (x) => 0.0025 * x * x;
const halfTube = (r, len = 140, sx = 360, st = 72) => {
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= sx; i++) for (let j = 0; j <= st; j++) {
    const x = -len / 2 + (len * i) / sx, th = Math.PI + (Math.PI * j) / st, wob = 1 + 0.035 * Math.sin(x * 0.7 + j * 0.4) + 0.05 * (vnoise(x * 0.3, j * 0.2, 1) - 0.5);
    pos.push(x, bend(x) + r * wob * Math.cos(th), r * wob * Math.sin(th)); uv.push(x / 12, j / st);
  }
  for (let i = 0; i < sx; i++) for (let j = 0; j < st; j++) { const a = i * (st + 1) + j, b = a + st + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
};
const wallMat = scanPatch(tissue({ color: "#D88B84", glow: "#FF7A6B", glowK: 0.45, wet: 0.95, sheen: 0.6, seed: 11, repeat: 1, micro: 1.4, rough: 0.34 }), { edge: "#BFF8E4", core: "#021416" });
wallMat.side = THREE.DoubleSide; wallMat.normalMap.repeat.set(1, 1); wallMat.userData.scanKey = "wall";
const inner = new THREE.Mesh(halfTube(3.1), wallMat); B.add(inner);
const outerMat = scanPatch(tissue({ color: "#C77C76", glow: "#FF8F7E", glowK: 0.4, wet: 0.7, sheen: 0.5, seed: 12, repeat: 1, micro: 1.2, rough: 0.45 }), { edge: "#BFF8E4", core: "#021416" });
outerMat.side = THREE.DoubleSide; B.add(new THREE.Mesh(halfTube(3.8), outerMat));
// the slice: the cut faces glow phosphor where the scan plane cuts the wall (two strips along the tube)
const sliceMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#D6F25F").multiplyScalar(1.6), toneMapped: false });
for (const sgn of [1, -1]) { const pts = []; for (let i = 0; i <= 200; i++) { const x = -70 + i * 0.7; pts.push(new THREE.Vector3(x, bend(x) + sgn * 3.45, 0)); }
  const strip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.07, 6, false), sliceMat); B.add(strip); }
// red cells, folded into cups by the squeeze, single file
const cupGeo = (() => { const g = rbcGeometry(THREE, { around: 64, along: 48 }), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rho = Math.hypot(x, z); p.setXYZ(i, x * 0.78, y - 0.17 * rho * rho, z * 0.78); }
  g.computeVertexNormals(); return g; })();
const heroMat = scanPatch(tissue({ color: "#C3102C", glow: "#FF3A50", glowK: 0.85, wet: 1, sheen: 0.55, seed: 2, repeat: 1, micro: 0.25, rough: 0.26 }), { edge: "#FF6B7C", core: "#2A0208", hot: 1 });
heroMat.userData.scanKey = "hero";
const cells = [];
for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(cupGeo, heroMat); B.add(m); cells.push(m); }
const placeCells = (t) => cells.forEach((m, i) => {
  const x = -i * 10.5 + 6 + t * 1.4, y = bend(x) + 0.25 * Math.sin(i * 1.7), slope = 0.005 * x;
  m.position.set(x, y, -0.3 + 0.3 * Math.sin(i * 2.3)); m.rotation.set(0.3 * Math.sin(i * 1.3 + t * 0.4), 0, -Math.PI / 2 - Math.atan(slope));   // cup axis along the flow, bowl trailing
});
// the tissue the vessel runs through, blurred behind
for (let i = 0; i < 18; i++) { const r = 4 + R() * 7, m = new THREE.Mesh(lumpy(new THREE.SphereGeometry(r, 64, 48), 0.18, 1.6, i), outerMat); m.position.set(-60 + R() * 120, -30 + R() * 60, -18 - R() * 40); B.add(m); }
const shaftB = shaft({ from: [XB - 30, 40, 8], to: [XB + 2, -4, -2], radius: 6, color: "#FFE6CF", k: 0.09 }); scene.add(shaftB.group);
const plasma = motes(scene, 500, [[XB - 40, -12, -10], [XB + 20, 14, 10]], 0.12, "#FFEFE2", R, 0.6);

// ═══ C: synapse ═════════════════════════════════════════════════════════════════════════════════════════════
const XC = 2000, C = new THREE.Group(); C.position.x = XC; scene.add(C);
renderer.localClippingEnabled = true;
const cutC = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 3)];   // the scan's slice: keep z ≤ 3, so we look into the ending
const bulbMat = scanPatch(tissue({ color: "#D9A193", glow: "#FF9C7E", glowK: 0.55, wet: 0.85, sheen: 0.6, seed: 13, repeat: 2.5, rough: 0.38 }), { k: 0 });
bulbMat.side = THREE.DoubleSide; bulbMat.clippingPlanes = cutC; bulbMat.userData.scanKey = "bulb";
const bulbGeo = lumpy(new THREE.SphereGeometry(30, 200, 150), 0.06, 1.7, 3); bulbGeo.scale(1.15, 0.9, 1);
const bulb = new THREE.Mesh(bulbGeo, bulbMat); bulb.position.set(0, 29.5, 0); C.add(bulb);   // its lowest point sits ~2 units (20 nm) above the next cell
const axon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-4, 50, -2), new THREE.Vector3(-14, 80, -8), new THREE.Vector3(-30, 140, -20)]), 80, 9, 40, false), bulbMat); C.add(axon);
// the slice rim, glowing where the scan plane cuts the ending's wall
{ const pts = [], v = new THREE.Vector3(), pa = bulbGeo.attributes.position, ring = [];
  for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); if (Math.abs(v.z - 3) < 0.6) ring.push([Math.atan2(v.y, v.x), v.x, v.y]); }
  ring.sort((a, b) => a[0] - b[0]); const N = 160;
  for (let k = 0; k < N; k++) { const a0 = -Math.PI + (2 * Math.PI * k) / N; let best = ring[0], bd = 9; for (const r of ring) { const d = Math.abs(r[0] - a0); if (d < bd) { bd = d; best = r; } } pts.push(new THREE.Vector3(best[1], best[2] + 29.5, 3.05)); }
  C.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320, 0.32, 8, true), new THREE.MeshBasicMaterial({ color: new THREE.Color("#D6F25F").multiplyScalar(1.6), toneMapped: false }))); }
const postMat = scanPatch(tissue({ color: "#8A5651", glow: "#FF9A80", glowK: 0.3, wet: 0.9, sheen: 0.6, seed: 14, repeat: 18, rough: 0.36 }), { k: 0 });
postMat.userData.scanKey = "post";
for (const [x, y, z, sc] of [[-95, 22, -130, 0.9], [105, 14, -170, 1.0], [-30, 30, -260, 1.1]]) { const b2 = new THREE.Mesh(bulbGeo, bulbMat); b2.position.set(x, y + 29.5 * sc, z); b2.scale.setScalar(sc); C.add(b2); }
const post = new THREE.Mesh(lumpy(new THREE.SphereGeometry(260, 260, 180), 0.01, 6, 8), postMat); post.position.set(0, -260 - 2.4 + 2, 0); C.add(post);
// packets (vesicles) inside the ending, crowding its floor; glassy, rims lit in the nerve's chartreuse
const vesMat = scanPatch(tissue({ color: "#1C2610", glow: "#D6F25F", glowK: 1.7, wet: 1, sheen: 0.3, seed: 15, repeat: 1, micro: 0.3, rough: 0.2 }), { k: 0 });
vesMat.userData.scanKey = "ves";
const vesMat2 = scanPatch(tissue({ color: "#2A3814", glow: "#E9FF7A", glowK: 2.6, wet: 1, sheen: 0.3, seed: 15, repeat: 1, micro: 0.3, rough: 0.18 }), { k: 0 });
vesMat2.userData.scanKey = "ves2";
const VR = rng(77);
for (let i = 0; i < 58; i++) { let p; do { p = [(VR() - 0.5) * 56, 4.5 + Math.pow(VR(), 1.8) * 36, -VR() * 26 + 2]; } while (Math.hypot(p[0] / 1.15, (p[1] - 29.5) / 0.9, p[2]) > 26.5);
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.5 + VR() * 1.1, 40, 30), p[1] < 12 && VR() < 0.6 ? vesMat2 : vesMat); m.position.set(...p); m.scale.set(1, 0.9 + VR() * 0.2, 1); C.add(m); }
// the signal arriving: a bright core down the cut fibre, fading into the ending
{ const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-30, 140, -20), new THREE.Vector3(-14, 80, -8), new THREE.Vector3(-4, 50, -2), new THREE.Vector3(0, 30, -2)]);
  const g = new THREE.TubeGeometry(path, 120, 1.1, 12, false), col = [], pa = g.attributes.position, n = pa.count;
  for (let i = 0; i < n; i++) { const u = Math.floor(i / 13) / 120, k = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), 0.6) * (0.35 + 0.65 * u); col.push(k, k, k); }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  C.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color("#D6F25F").multiplyScalar(2.2), vertexColors: true, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); }
// where the message lands: a soft pool of chartreuse light on the next cell, under the gap
{ const c = document.createElement("canvas"); c.width = c.height = 128; const k = c.getContext("2d"), gr = k.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(214,242,95,.9)"); gr.addColorStop(0.4, "rgba(214,242,95,.25)"); gr.addColorStop(1, "rgba(214,242,95,0)"); k.fillStyle = gr; k.fillRect(0, 0, 128, 128);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 2.9, -2); pool.renderOrder = 3; C.add(pool); }
// three packets fusing with the ending's floor, opening onto the gap
[[-4, 3.4, 2], [5, 3.6, -3], [1, 3.3, 6]].forEach(([x, y, z]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(2.1, 40, 30), vesMat); m.position.set(x, y, z); m.scale.set(1.25, 0.55, 1.25); C.add(m); });
// receptors on the next cell, under the ending
const recGeo = lumpy(new THREE.SphereGeometry(0.7, 16, 12), 0.25, 3, 2); recGeo.scale(1, 0.6, 1);
const recMat = new THREE.MeshStandardMaterial({ color: 0x1a2c10, emissive: new THREE.Color("#D6F25F"), emissiveIntensity: 0.18, roughness: 0.4 });
const recs = new THREE.InstancedMesh(recGeo, recMat, 140); C.add(recs);
{ const M = new THREE.Matrix4(), RR = rng(9); for (let i = 0; i < 140; i++) { const a = RR() * 6.28, d = Math.sqrt(RR()) * 22, x = Math.cos(a) * d, z = Math.sin(a) * d; M.makeTranslation(x, 2 - (x * x + z * z) / 520 + 0.6, z); recs.setMatrixAt(i, M); } recs.instanceMatrix.needsUpdate = true; }
// the message: transmitter crossing the gap from three fusing packets (bright, the nerve's chartreuse)
const msg = motes(scene, 1600, [[XC - 16, 2.0, -14], [XC + 16, 4.3, 3]], 0.6, "#F0FF9A", R, 1.0);
const glowC = motes(scene, 260, [[XC - 80, -40, -60], [XC + 80, 80, 20]], 1.4, "#BFF8E4", R, 0.25);
const pulseRing = new THREE.Mesh(new THREE.TorusGeometry(9.6, 0.5, 12, 80), new THREE.MeshBasicMaterial({ color: new THREE.Color("#D6F25F").multiplyScalar(2), toneMapped: false, transparent: true }));
C.add(pulseRing);

// ═══ HUD: one design system ═════════════════════════════════════════════════════════════════════════════════
const hudRoot = document.getElementById("hud"), SC = W / 1080;
Object.assign(hudRoot.style, { position: "absolute", inset: 0, zIndex: 2, overflow: "hidden" });
const hud = document.createElement("div"); Object.assign(hud.style, { position: "absolute", left: 0, top: 0, width: "1080px", height: "1920px", transform: `scale(${SC})`, transformOrigin: "0 0" }); hudRoot.appendChild(hud);
const gr = grain(hudRoot, 0.012);
const grad = document.createElement("div"); Object.assign(grad.style, { position: "absolute", left: 0, right: 0, bottom: 0, height: "46%", background: "linear-gradient(to bottom, rgba(2,8,9,0), rgba(2,8,9,.78) 70%, rgba(2,8,9,.9))", zIndex: 1, display: "none" }); hud.appendChild(grad);
const vig = document.createElement("div"); Object.assign(vig.style, { position: "absolute", inset: 0, background: "radial-gradient(130% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,4,5,.55) 100%)", zIndex: 1 }); hud.appendChild(vig);
const css = document.createElement("style"); css.textContent = `
  .lt { position:absolute; z-index:3; color:var(--text); }
  .mono { font-family:var(--font-mono); letter-spacing:.14em; text-transform:uppercase; font-weight:500; }
  .series { left:90px; top:250px; font-size:2.5vmin; color:var(--text-2); }
  .title { left:88px; top:302px; font-family:var(--font-display); font-weight:800; font-size:7.6vmin; line-height:1.0; letter-spacing:-.02em; }
  .title b { color:var(--signal); font-weight:800; }
  .badge { left:90px; top:404px; font-size:2.2vmin; color:var(--text-2); border:1.5px solid rgba(166,196,190,.55); padding:.5vmin 1.1vmin; border-radius:.6vmin; }
  .ro { right:180px; background:rgba(3,12,14,.72); padding:.8vmin 1.2vmin; border-radius:.8vmin; font-size:2.3vmin; color:var(--text-2); text-align:right; line-height:1.55; }
  .ro u, .scale u { text-decoration:none; text-transform:none; }
  .ro em { font-style:normal; color:var(--signal); font-weight:700; }
  .ret { position:absolute; z-index:3; pointer-events:none; filter: drop-shadow(0 0 6px rgba(214,242,95,.55)); }
  .card { position:absolute; z-index:3; background:rgba(3,12,14,.80); border:1.5px solid rgba(214,242,95,.65); border-radius:1vmin; padding:1.4vmin 1.8vmin 1.5vmin; min-width:30vmin; }
  .card .k { font-size:2.2vmin; color:var(--signal); }
  .card .v { font-family:var(--font-display); font-weight:800; font-size:6.4vmin; line-height:1.05; letter-spacing:-.01em; margin-top:.6vmin; font-feature-settings:"tnum"; }
  .card .v small { text-transform:none; font-size:3.2vmin; font-weight:700; color:var(--text-2); margin-left:.6vmin; }
  .card .s { font-size:2.9vmin; font-weight:600; color:var(--text); margin-top:.4vmin; }
  .cap { left:50%; transform:translateX(-50%); top:1236px; background:rgba(3,12,14,.82); border-radius:2.2vmin; padding:1.4vmin 3vmin 1.6vmin; font-weight:700; font-size:5.1vmin; line-height:1.24; text-align:center; white-space:nowrap; color:var(--text); }
  .cap i { font-style:normal; color:var(--signal); }
  .cap span { color:var(--text-2); }
  .scale { left:90px; top:1168px; font-size:2.2vmin; color:var(--text); }
  .scale .bar { height:3px; background:var(--signal); margin-bottom:.8vmin; position:relative; box-shadow:0 0 8px rgba(214,242,95,.6); }
  .scale .bar:before, .scale .bar:after { content:""; position:absolute; top:-7px; width:3px; height:17px; background:var(--signal); }
  .scale .bar:before { left:0; } .scale .bar:after { right:0; }
  .scanline { position:absolute; left:0; right:0; height:3px; z-index:2; background:var(--signal); box-shadow:0 0 14px 3px rgba(214,242,95,.55), 0 0 60px 10px rgba(214,242,95,.18); }
  .scantag { position:absolute; z-index:3; font-size:2.1vmin; color:var(--signal); background:rgba(3,12,14,.72); padding:.4vmin .9vmin; border-radius:.6vmin; }
  .tick { position:absolute; z-index:3; width:1.5px; background:rgba(214,242,95,.7); }
`.replace(/([\d.]+)vmin/g, (m, v) => `${(v * 10.8).toFixed(1)}px`); document.head.appendChild(css);
const el = (cls, html, style = {}) => { const d = document.createElement("div"); d.className = `lt ${cls}`; d.innerHTML = html; Object.assign(d.style, style); hud.appendChild(d); return d; };
const svgNS = "http://www.w3.org/2000/svg";
const reticle = () => {
  const s = document.createElementNS(svgNS, "svg"); s.setAttribute("class", "ret"); s.style.overflow = "visible"; hud.appendChild(s);
  return { el: s, set(cx, cy, r, op = 1, leader) {
    const c = 0.32 * r, k = (x0, y0, dx, dy) => `M${x0 + dx * c},${y0} L${x0},${y0} L${x0},${y0 + dy * c}`;
    let d = [k(cx - r, cy - r, 1, 1), k(cx + r, cy - r, -1, 1), k(cx - r, cy + r, 1, -1), k(cx + r, cy + r, -1, -1)].join(" ");
    d += ` M${cx - 0.14 * r},${cy} L${cx - 0.05 * r},${cy} M${cx + 0.05 * r},${cy} L${cx + 0.14 * r},${cy} M${cx},${cy - 0.14 * r} L${cx},${cy - 0.05 * r} M${cx},${cy + 0.05 * r} L${cx},${cy + 0.14 * r}`;
    let l = ""; if (leader) l = `<path d="M${leader[0]},${leader[1]} L${leader[2]},${leader[3]} L${leader[4]},${leader[3]}" fill="none" stroke="#D6F25F" stroke-width="2"/><circle cx="${leader[0]}" cy="${leader[1]}" r="4" fill="#D6F25F"/>`;
    s.setAttribute("width", 1080); s.setAttribute("height", 1920); Object.assign(s.style, { position: "absolute", left: 0, top: 0, opacity: op });
    s.innerHTML = `<path d="${d}" fill="none" stroke="#D6F25F" stroke-width="3" stroke-linecap="square"/>${l}`;
  } };
};
const series = el("series mono", "");
const title = el("title", "");
const badge = el("badge mono", "");
const ro = el("ro mono", "", { top: "404px" });
const ret1 = reticle(), ret2 = reticle();
const card1 = el("card", ""), card2 = el("card", "");
const scaleEl = el("scale mono", "");
const cap = el("cap", "");
const scanEl = document.createElement("div"); scanEl.className = "scanline"; hud.appendChild(scanEl);
const tagUp = el("scantag mono", "▲ Live"), tagDn = el("scantag mono", "▼ Scan view · blood flow");
const setCard = (c, k, v, unit, s, x, y) => { c.innerHTML = `<div class="k mono">${k}</div><div class="v">${v}<small>${unit}</small></div><div class="s">${s}</div>`; Object.assign(c.style, { left: `${x}px`, top: `${y}px`, display: "block" }); };
const setScale = (px, label) => { scaleEl.innerHTML = `<div class="bar" style="width:${px}px"></div>${label}`; };
const hideAll = () => { [ret1.el, ret2.el, card1, card2].forEach((e) => (e.style.display = "none")); scanEl.style.display = tagUp.style.display = tagDn.style.display = "none"; };

window.seek = function (t) {
  const shot = stage(t).name;
  grad.style.display = shot === "synapse" ? "block" : "none";
  A.visible = shot === "lungs"; B.visible = shot === "capillary"; C.visible = shot === "synapse";
  shaftA.set(shot === "lungs" ? 1 : 0); shaftB.set(shot === "capillary" ? 1 : 0);
  dustA.set(t, shot === "lungs" ? 1 : 0); o2A.set(t, shot === "lungs" ? 1 : 0); plasma.set(t, shot === "capillary" ? 1 : 0);
  msg.set(t * 0.4, shot === "synapse" ? 1 : 0); glowC.set(t, shot === "synapse" ? 1 : 0);
  hideAll(); [ret1.el, ret2.el].forEach((e) => (e.style.display = "block"));
  scene.fog = null;
  if (shot === "lungs") {
    const u = E.inout2(seg(t, 0, 2));
    camera.fov = 30; camera.updateProjectionMatrix();
    look(mix3([-10, -1, 112], [-8, 0, 101], u), mix3([1, 5, -2], [0.5, 5.5, -2], u));
    rig.aim([0, 0, 0], [-0.6, 0.8, 0.55], [0.7, 0.25, -0.75]); rig.set({ key: 2.6, rim: 3.6, fill: 0.3, env: 0.55 });
    scene.fog = new THREE.FogExp2(0x06191a, 0.0065);
    focusPt = [-3, 2, 12]; fstop = 0.2;
    const sy = 0.585; SCAN.y.value = H * (1 - sy); SCAN.k.value = 1;
    scanEl.style.display = tagUp.style.display = tagDn.style.display = "block";
    scanEl.style.top = `${sy * 1920 - 1.5}px`; Object.assign(tagUp.style, { left: "90px", top: `${sy * 1920 - 44}px` }); Object.assign(tagDn.style, { left: "90px", top: `${sy * 1920 + 18}px` });
    series.textContent = "Body Backstage · No. 05"; title.innerHTML = "Where breath <b>goes</b>";
    badge.textContent = "Model · not to scale"; 
    ro.innerHTML = `O₂ in <em>≈ 250 <u>mL</u></em><u>/min</u><br>breaths <em>12</em>/min<br>air <em>≈ 6 <u>L</u></em><u>/min</u>`; 
    const p = toScreen([-3 + A.position.x, 2, 4 + 9.5 * 0.2]), r = 150;
    ret1.set(p[0], p[1], r, 1, [p[0] + r * 0.72, p[1] - r * 0.72, 600, p[1] - r - 100, 600]);
    setCard(card1, "Air pocket", "0.2", "mm", "smaller than a salt grain", 560, p[1] - r - 250);
    const q = toScreen([5, -8, 10]); ret2.set(q[0], q[1], 46, 1, null);
    card2.innerHTML = `<div class="k mono" style="color:#FF8A98">Blood · running hot</div>`; Object.assign(card2.style, { display: "block", left: `${Math.min(q[0] + 60, 640)}px`, top: `${q[1] - 22}px`, minWidth: "0", borderColor: "rgba(255,90,110,.8)", padding: "11px 15px" });
    ret2.el.style.filter = "drop-shadow(0 0 6px rgba(255,90,110,.6))"; ret2.el.querySelector("path").setAttribute("stroke", "#FF5A6E");
    setScale(162, "100 <u>µm</u>");
    cap.innerHTML = `They'd cover a <i>quarter</i><br>of a tennis court.`;
  }
  if (shot === "capillary") {
    const u = E.inout2(seg(t, 2, 4));
    camera.fov = 30; camera.updateProjectionMatrix();
    look(mix3([XB + 34, 13, 38], [XB + 30, 11.5, 33], u), mix3([XB - 6, 0.6, -1], [XB - 7, 0.6, -1], u));
    rig.aim([XB, 0, 0], [-0.3, 0.9, 0.5], [0.8, 0.2, -0.6]); rig.set({ key: 2.2, rim: 4, fill: 0.35, env: 0.6 });
    scene.fog = new THREE.FogExp2(0x061719, 0.012);
    placeCells(t - 2);
    focusPt = [XB + cells[1].position.x, cells[1].position.y, 0]; fstop = 0.2;
    SCAN.k.value = 0;
    series.textContent = "Body Backstage · No. 01"; title.innerHTML = "Single <b>file</b>";
    badge.textContent = "Model · cut open"; ro.innerHTML = `speed <em>≈ 1 <u>mm</u></em><u>/s</u><br>tube <em>~5 <u>µm</u></em> wide<br>cell <em>7.5 <u>µm</u></em> wide`;
    const c = cells[1].position, p = toScreen([XB + c.x, c.y, c.z]), r = 120;
    ret1.set(p[0], p[1], r, 1, [p[0] + r * 0.7, p[1] + r * 0.7, 660, 980, 900]);
    ret1.el.style.filter = "drop-shadow(0 0 6px rgba(214,242,95,.55))"; ret1.el.querySelector("path").setAttribute("stroke", "#D6F25F");
    setCard(card1, "Red cell · locked", "7.5", "µm", "folds itself to fit", 580, 990);
    ret2.el.style.display = "none";
    setScale(150, "5 <u>µm</u>");
    cap.innerHTML = `Your red cells are wider<br>than the <i>tubes</i> they ride.`;
  }
  if (shot === "synapse") {
    const u = E.inout2(seg(t, 4, 6));
    look(mix3([XC + 64, 12, 262], [XC + 57, 11, 240], u), mix3([XC + 4, 9, -4], [XC + 3, 8.5, -4], u));
    camera.fov = 25; camera.updateProjectionMatrix();
    rig.aim([XC, 5, 0], [-0.5, 0.9, 0.4], [0.6, 0.3, -0.8]); rig.set({ key: 1.6, rim: 3.6, fill: 0.3, env: 0.5 });
    scene.fog = new THREE.FogExp2(0x041214, 0.004);
    pulseRing.position.set(-6, 46, 0); pulseRing.rotation.set(Math.PI / 2 - 0.25, 0, 0.3); pulseRing.visible = false;
    focusPt = [XC, 3, -2]; fstop = 0.34;
    SCAN.k.value = 0;
    series.textContent = "Body Backstage · No. 04"; title.innerHTML = "Do they <b>touch?</b>";
    badge.textContent = "Model · cut open"; ro.innerHTML = `signal <em>arriving</em><br>packets <em>releasing</em><br>crossing <em>&lt; 1 <u>ms</u></em>`;
    const p = toScreen([XC, 2.2, 0]), r = 110;
    ret1.set(p[0], p[1], r, 1, [p[0] + r * 0.72, p[1] + r * 0.72, 640, 1000, 900]);
    ret1.el.querySelector("path").setAttribute("stroke", "#D6F25F"); ret1.el.style.filter = "drop-shadow(0 0 6px rgba(214,242,95,.55))";
    setCard(card1, "The gap", "20", "nm", "a hair is 4,000× wider", 560, 1000);
    ret2.el.style.display = "none";
    setScale(170, "100 <u>nm</u>");
    cap.innerHTML = `Your nerves never <i>touch</i>.<br>The message has to jump.`;
  }
  sky.at(shot === "lungs" ? [0, 0, 0] : shot === "capillary" ? [XB, 0, 0] : [XC, 0, 0], W, H);
  gr.set(t);
  renderer.render(scene, camera);
};
window.SCENE_READY = Promise.resolve();
