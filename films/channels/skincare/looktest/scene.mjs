import * as THREE from "three";
// Outer Layer look test (films/channels/skincare/looktest): the studio-grade finish from set/studio.js on three hero
// shots, 4 s each, one move per idea. No narration; for the owner's sign-off before any episode is re-rendered.
//   0–4 s   a skin-terrain flight: real-looking skin (subsurface tint, sheen, oil, micro-normals), a warm key, a
//           strong rim, a violet volumetric shaft, rack focus from a pore to the far skin
//   4–8 s   Botox hero: a nerve ending on a muscle fibre; translucent vesicles with glowing cores, the messenger
//           crossing the gap, an orbit reveal with a rack focus from the vesicles to the fibre
//   8–12 s  the sunscreen hands: two model hands in a softbox key, a refracting bead of sunscreen sliding on one, the
//           UV shaft falling across both; a slow push with parallax
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createTerrain } from "../set/terrain.js";
import { createHand } from "../set/hand.js";
import { liquid } from "cinema/metaballs.js";
import { toneColor } from "../set/section.js";
import { createStudio, skinMaterial, cellMaterial, nucleusMaterial, strandMaterial, fluidMaterial, createShaft, createGrain } from "../set/studio.js";

const W = window.W, H = window.H, FILM = window.FILM;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, threshold: 0.9, bloom: 0.28, exposure: 1.0, maxCoc: 0.03 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 20000);
const studio = createStudio(renderer, scene, {});
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
const R = rng(5);

// ── shot A: the skin terrain ──────────────────────────────────────────────
const TA = [0, 0, 0];
const terrain = createTerrain({ seed: 9, spots: 0, segs: 420 });
const tone = toneColor("living", 0.5);   // medium
terrain.mesh.material = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: 0.05, hydration: 0.2, repeat: 14, seed: 4, micro: 0.3 }); terrain.mesh.material.roughness = 0.62; terrain.mesh.material.clearcoatRoughness = 0.5;
terrain.group.traverse((o) => { if (o.isInstancedMesh) { o.material = strandMaterial({ tint: [0.28, 0.17, 0.11], gloss: 0.5 }); o.material.transmission = 0; } });
scene.add(terrain.group);
const shaftA = createShaft({ from: [-14, 30, -18], to: [2, -1, 4], radius: 3.2, color: "#B79BFF" }); scene.add(shaftA.group);

// ── shot B: the nerve ending on a muscle fibre (Botox) ────────────────────
const XB = 400, B = new THREE.Group(); B.position.x = XB; scene.add(B);
const fibreMat = strandMaterial({ tint: [0.72, 0.3, 0.28], gloss: 0.5 });
{ const c = document.createElement("canvas"); c.width = 256; c.height = 64; const k = c.getContext("2d"); for (let x = 0; x < 256; x++) { const v = 128 + 70 * Math.sin(x * 0.7); k.fillStyle = `rgb(${v},128,255)`; k.fillRect(x, 0, 1, 64); }
  const nt = new THREE.CanvasTexture(c); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(6, 1); fibreMat.normalMap = nt; fibreMat.normalScale.set(0.6, 0.6); }   // the striations of muscle
for (let i = 0; i < 5; i++) {
  const y = -2.2 - i * 1.15, pts = Array.from({ length: 9 }, (_, k) => new THREE.Vector3(-9 + k * 2.25, y + 0.25 * Math.sin(k * 0.9 + i), (i % 2 ? -0.6 : 0.4) + 0.2 * Math.cos(k + i)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.55, 20, false), fibreMat); B.add(m);
}
const axonMat = strandMaterial({ tint: [0.95, 0.84, 0.72], gloss: 0.8 }); axonMat.transmission = 0.5;
const axon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-7, 6, -1.5), new THREE.Vector3(-3.5, 3.4, -0.5), new THREE.Vector3(-1, 1.5, 0), new THREE.Vector3(0, 0.6, 0)]), 80, 0.32, 20, false), axonMat); B.add(axon);
const bulbMat = cellMaterial({ tint: [0.98, 0.9, 0.86], opacity: 0.5 }); bulbMat.roughness = 0.12; bulbMat.clearcoat = 1;
const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.35, 48, 32), bulbMat); bulb.scale.set(1.2, 0.8, 1); bulb.position.set(0, -0.2, 0); B.add(bulb);
const vesMat = cellMaterial({ tint: [0.85, 0.98, 1.0], opacity: 0.85 }), vesCore = nucleusMaterial({ color: "#5FF2E8", k: 1.6 });
const ves = Array.from({ length: 16 }, () => { const g = new THREE.Group(); const s = 0.17 + R() * 0.08; const a = R() * Math.PI * 2, r = 0.25 + R() * 0.75;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(s, 24, 16), vesMat)); const c = new THREE.Mesh(new THREE.SphereGeometry(s * 0.45, 12, 8), vesCore); g.add(c);
  g.position.set(Math.cos(a) * r * 1.2, -0.25 + Math.sin(a) * r * 0.55, (R() - 0.5) * 0.9); B.add(g); return g; });
const msg = Array.from({ length: 70 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), nucleusMaterial({ color: "#5FF2E8", k: 2.2 })); m.userData = { x: (R() - 0.5) * 2.6, z: (R() - 0.5) * 1.6, k: R() }; B.add(m); return m; });
const toxin = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), new THREE.MeshPhysicalMaterial({ color: 0x8b5cff, emissive: new THREE.Color("#8B5CFF").multiplyScalar(0.6), roughness: 0.25, clearcoat: 1, transmission: 0.4, thickness: 0.5 }));
B.add(toxin);
const shaftB = createShaft({ from: [-6, 14, -6], to: [0, -2, 0], radius: 2.0, color: "#9F83FF" }); shaftB.group.position.x = XB; scene.add(shaftB.group);

// ── shot C: the sunscreen hands ───────────────────────────────────────────
const XC = 800;
const skinC = skinMaterial({ tone: tone.map((v) => Math.min(1, v * 1.1)), oil: 0.15, hydration: 0.3, micro: 0 }); skinC.normalMap = null;
const skinS = skinMaterial({ tone: tone.map((v) => Math.min(1, v * 1.1)), oil: 0.9, hydration: 0.9, micro: 0 }); skinS.normalMap = null;   // the screened hand: a glossier film
const handL = createHand({ material: skinS, side: -1, at: [XC - 4.0, 0, 0] }), handR = createHand({ material: skinC, side: 1, at: [XC + 4.0, 0, 0] });
handL.set({ curl: 0.15 }); handR.set({ curl: 0.12 }); scene.add(handL.mesh, handR.mesh);
const beadL = liquid(THREE, { material: fluidMaterial({ tint: [1, 0.99, 0.97], k: 0.45 }), center: [XC - 4.0, 1, 0], size: 6, resolution: 64 }); scene.add(beadL.mesh);
const shaftC = createShaft({ from: [XC - 4, 22, -8], to: [XC + 1, -2, 2], radius: 4.5, color: "#B79BFF" }); scene.add(shaftC.group);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshPhysicalMaterial({ color: 0x241450, roughness: 0.35, clearcoat: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, -0.95, 0); scene.add(floor);

const grain = createGrain(document.getElementById("hud"), { amount: 0.022 });
scene.fog = new THREE.Fog(0x2c1660, 28, 70);
const look = (pos, tgt) => { camera.position.set(...pos); camera.lookAt(...tgt); };
const mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);

window.seek = function (t) {
  const shot = stage(t).name;
  terrain.group.visible = shot === "skin"; B.visible = shot === "botox"; handL.mesh.visible = handR.mesh.visible = floor.visible = shot === "hands"; beadL.mesh.visible = shot === "hands";
  shaftA.set({ op: shot === "skin" ? 1 : 0 }); shaftB.set({ op: shot === "botox" ? 0.8 : 0 }); shaftC.set({ op: shot === "hands" ? E.inout2(seg(t, 8.6, 10)) : 0 });
  scene.fog = shot === "skin" ? scene.fog || new THREE.Fog(0x2c1660, 28, 70) : null;
  if (shot === "skin") {
    terrain.set({ tone: tone.map((v) => v * 0.95), furrows: 0.3, spot: 0, sheen: 0 });
    const u = E.inout2(seg(t, 0, 4));
    look(mix3([-6, 3.2, 14], [1.5, 1.4, 5.5], u), mix3([2, 0, 0], [3, -0.2, -2], u));   // a low glide toward a pore
    studio.aim([2, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]); studio.set({ key: 1.3, rim: 1.8, fill: 0.3, env: 0.35, warm: 0.5 });
    // rack focus: the near pore, then the skin beyond
    const rk = E.inout2(seg(t, 1.6, 3.2)); focusPt = mix3([1.5, 0, 4], [3, 0, -3], rk); fstop = 0.28;
  } else if (shot === "botox") {
    const u = E.inout2(seg(t, 4, 8)), a = -0.9 + 1.1 * u;   // an orbit reveal around the ending
    look([XB + Math.sin(a) * 13, 2.6 - 1.4 * u, Math.cos(a) * 13], [XB, -1.6, 0]);
    studio.aim([XB, -1, 0], [-0.4, 0.85, 0.5], [0.6, 0.4, -0.8]); studio.set({ key: 1.6, rim: 4.0, fill: 0.4, env: 0.7, warm: 0.1 });
    const p = E.inout2(seg(t, 5.2, 7.4));
    msg.forEach((m) => { const v = Math.min(1, Math.max(0, p * 1.4 - m.userData.k * 0.4)); m.position.set(m.userData.x, -1.1 - 1.1 * v, m.userData.z); m.visible = v > 0.01 && v < 0.99; });
    ves.forEach((g, i) => { g.position.y += Math.sin(t * 2 + i) * 0.0015; });
    toxin.position.set(-1.8 + 1.2 * E.inout2(seg(t, 4, 7.5)), 1.2 - 0.9 * E.inout2(seg(t, 4, 7.5)), 1.0); toxin.rotation.set(t * 0.6, t * 0.4, 0);
    const rk = E.inout2(seg(t, 5.5, 7.0)); focusPt = mix3([XB, -0.3, 0.3], [XB, -3.3, 0.4], rk); fstop = 0.3;   // vesicles → the fibre
  } else {
    const u = E.inout2(seg(t, 8, 12));
    look(mix3([XC + 1.2, 38, -12], [XC + 0.4, 32, -8], u), [XC, 0, 2.2]);   // high, the hands laid out like a product shot, a slow push   // from behind the wrists: the fingers reach away   // a slow push down onto the hands
    studio.aim([XC, 0, 0], [-0.55, 0.85, -0.5], [0.4, 0.45, 0.85]); studio.set({ key: 1.8, rim: 3.6, fill: 0.4, env: 0.7, warm: 0.4 });
    // the hands hold still (their surface is built once: a metaball rebuild per motion-blur sample is the frame's biggest cost)
    const b = E.inout2(seg(t, 8.3, 11.8));   // a bead of sunscreen lands and spreads across the back of the hand
    beadL.set([{ p: [XC - 4.0 + 0.6 * b, 1.4 - 0.25 * b, -0.2 + 0.9 * b], r: 0.75 - 0.1 * b }, { p: [XC - 3.7 + 1.1 * b, 0.95 - 0.12 * b, 0.4 + 0.6 * b], r: 0.35 * b }, { p: [XC - 4.4 - 0.4 * b, 0.95 - 0.1 * b, 0.0 + 0.3 * b], r: 0.3 * b }]);
    focusPt = [XC, 0.8, 1.5]; fstop = 0.12;
  }
  grain.set(t);
  renderer.render(scene, camera);
};
