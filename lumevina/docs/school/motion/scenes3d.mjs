// Lumevina Skin School motion studio: the solid scenes (three.js, WebGL).
//
// The same contract as scenes.mjs (a shot list, markup, CSS, seek(t) as a
// pure function of time), but the picture is a lit three-dimensional set
// rendered in WebGL: a voxel block of skin with a pore that clogs and clears,
// ninety dominoes falling one night at a time. The renderer draws into a
// canvas behind the header and caption; nothing in the set is random (every
// variation is hashed from an index) and every frame re-renders from t.
//
// A scene here carries `module`: an ES module (three.js from ./vendor) that
// defines window.seek itself, calling M.stage(t) for the shot list and the
// caption like the flat scenes do.

export const SCENES = {

  /* ───────── 8-2 Inside a pore ───────── */
  "8-2": {
    id: "8-2", kicker: "What acne actually is", title: `Inside a pore, <span class="grad">and how it clears.</span>`, dur: 26, poster: 16,
    shots: [
      { at: 0, name: "healthy", cap: "A pore: a hair, an oil gland, oil flowing up and out. That's the healthy version." },
      { at: 6, name: "clog", cap: "Dead skin and oil pack the pore. Open to the air it oxidizes dark, a blackhead. Closed over, a whitehead." },
      { at: 12, name: "inflame", cap: "Bacteria feed on the trapped oil. The wall swells red: a papule, then a pustule." },
      { at: 18, name: "clear", cap: "Mandelic acid keeps the pore clear. Benzoyl peroxide clears the bacteria. Judge it at 8 to 12 weeks." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.stage::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 34%; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.45) 55%, rgba(0,0,0,0) 100%); }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.dayc { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; opacity: 0; }
.dayc b { font-size: 8vmin; font-weight: 700; letter-spacing: -.03em; text-shadow: 0 .4vmin 2.4vmin rgba(0,0,0,.75); } .dayc span { font-size: 2.6vmin; color: #a1a1a6; }
@media (orientation: portrait) { .dayc { bottom: 1vmin; } }`,
    html: `
<section class="shot"><span class="lab3" id="l-hair" style="left:52%;top:4%"><i style="background:#5a3a2e"></i>hair</span><span class="lab3" id="l-gland" style="left:62%;top:46%"><i style="background:#e8c96a"></i>oil gland</span><span class="lab3" id="l-oil" style="left:30%;top:22%"><i style="background:#f1d57a"></i>oil, on its way out</span></section>
<section class="shot"><span class="lab3" id="l-plug" style="left:58%;top:26%"><i style="background:#8e8e93"></i>dead skin cells + oil</span><span class="lab3" id="l-black" style="left:24%;top:10%"><i style="background:#1a1210"></i>oxidized: a blackhead</span></section>
<section class="shot"><span class="lab3" id="l-bact" style="left:60%;top:30%"><i style="background:#ff5a4a"></i>bacteria</span><span class="lab3" id="l-red" style="left:22%;top:16%"><i style="background:#e0574a"></i>inflammation</span></section>
<section class="shot"><span class="lab3" id="l-mand" style="left:22%;top:8%"><i style="background:#f4c9d6"></i>mandelic acid</span><span class="lab3" id="l-bp" style="left:58%;top:8%"><i style="background:#ffffff"></i>benzoyl peroxide</span><div class="dayc" id="dayc"><b id="dayn">0</b><span>days</span></div></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
import { liquid } from "../metaballs.js";   // directed: liquid beads (metaballs.js, from the cinema kit on the made-with-claude-film branch)
const tmpV = new THREE.Vector3();
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((x >>> 16) ^ x) / 4294967296 % 1; };
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
// directed: a warmer key with real falloff, a rose rim from behind, less flat fill
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.55));
const key = new THREE.DirectionalLight(0xffe9d6, 2.7); key.position.set(9, 16, 14); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -16; key.shadow.camera.right = 16; key.shadow.camera.top = 16; key.shadow.camera.bottom = -16; key.shadow.camera.near = 1; key.shadow.camera.far = 60; key.shadow.bias = -0.0008;
scene.add(key);
const fill = new THREE.DirectionalLight(0xf4c9d6, 0.35); fill.position.set(-12, 6, -6); scene.add(fill);
const rim = new THREE.DirectionalLight(0xf4c9d6, 1.7); rim.position.set(-5, 15, -16); scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block: X across, Y up, Z toward the camera; the cut face is z = 0 (front)
const NX = 16, NY = 14, NZ = 9, PORE = { x: [-1, 0], z: [7, 8], from: 6 };
const PZ = 8 - NZ / 2; // world z of the pore axis (the face toward the camera)
const inPore = (x, y, z) => PORE.x.includes(x) && PORE.z.includes(z) && y >= PORE.from;
const GLAND = [[1, 6, 8], [2, 6, 8], [1, 7, 8], [2, 7, 8], [3, 7, 8], [1, 6, 7], [2, 6, 7], [1, 7, 7], [2, 7, 7]];
const isGland = (x, y, z) => GLAND.some(([a, b, c]) => a === x && b === y && c === z);
const cells = [];
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  if (inPore(x, y, z)) continue;
  const i = cells.length, v = hash(i) * 0.08 - 0.04;
  let c;
  if (isGland(x, y, z)) c = new THREE.Color(0xe8c96a);
  else if (y >= 11) c = new THREE.Color(0xe9c4b4).offsetHSL(0, 0, v + (y === 13 ? 0.04 : 0));
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  cells.push({ x, y, z, c, base: c.clone() });
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 });
const block = new THREE.InstancedMesh(geo, mat, cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
const near = cells.map(({ x, y, z }) => Math.hypot(x + 0.5, z - 7.5)); // distance to the pore axis
cells.forEach((c, i) => { dummy.position.set(c.x + 0.5, c.y, c.z + 0.5 - NZ / 2); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
// the hair
const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 12, 10), new THREE.MeshStandardMaterial({ color: 0x4a2c22, roughness: 0.5 }));
hair.position.set(0, PORE.from + 5.6, PZ); hair.rotation.z = 0.08; hair.castShadow = true; scene.add(hair);
// oil on its way out (healthy): little spheres cycling up the shaft
const oilGeo = new THREE.SphereGeometry(0.22, 12, 10), oilMat = new THREE.MeshStandardMaterial({ color: 0xf1d57a, roughness: 0.35, emissive: 0xd9a838, emissiveIntensity: 1.25 });
const oils = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(oilGeo, oilMat); m.castShadow = true; scene.add(m); return m; });
// the plug: dead cells and oil, 2×2×5 small cubes in the top of the shaft
const plugGeo = new THREE.BoxGeometry(0.72, 0.72, 0.72);
const plug = [];
for (let y = 9; y < 14; y++) for (const x of PORE.x) for (const z of PORE.z) {
  const i = plug.length, grey = hash(i + 500) < 0.6;
  const m = new THREE.Mesh(plugGeo, new THREE.MeshStandardMaterial({ color: grey ? 0x8e8e93 : 0xd9b85c, roughness: 0.8 }));
  m.castShadow = true; m.position.set(x + 0.5, y, z + 0.5 - NZ / 2); m.rotation.set(hash(i + 900) * 0.6, hash(i + 901) * 0.6, 0); m.userData = { y, top: y === 13, i }; m.visible = false; scene.add(m); plug.push(m);
}
// bacteria
const bactGeo = new THREE.SphereGeometry(0.16, 10, 8), bactMat = new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0xff3a24, emissiveIntensity: 1.1, roughness: 0.4 });
const bact = Array.from({ length: 14 }, (_, i) => { const m = new THREE.Mesh(bactGeo, bactMat); m.position.set(-1 + hash(i + 300) * 2, 9.5 + hash(i + 301) * 4.2, PZ - 0.7 + hash(i + 302) * 1.6); m.userData.home = m.position.clone(); m.visible = false; scene.add(m); return m; });
// the drops
const dropMand = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xf4c9d6, roughness: 0.15, transmission: 0.3, opacity: 0.85, transparent: true }));
const dropBP = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, opacity: 0.9, transparent: true }));
dropMand.visible = dropBP.visible = false; dropMand.castShadow = dropBP.castShadow = true; scene.add(dropMand, dropBP);
// directed: a splash ring on the skin where each drop lands (additive, so it blooms)
const ring = (col) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m; };
const splashMand = ring(0xf4c9d6), splashBP = ring(0xffffff);
const SURF = 13.5;   // the skin's top surface
// directed: on impact each drop hands over to liquid that beads, rolls and merges (kits/cinema/metaballs.js,
// three's marching cubes): mandelic puddles, pinches into beads that roll back and sink down the pore;
// benzoyl peroxide spreads over the inflamed ring and its beads soak in where they sit
const LQ = {
  mand: liquid(THREE, { material: dropMand.material, center: [0, SURF - 0.6, PZ - 0.6], size: 7.6, resolution: 64 }),
  bp: liquid(THREE, { material: dropBP.material, center: [0.6, SURF - 0.4, PZ - 0.4], size: 8.4, resolution: 64 })
};
scene.add(LQ.mand.mesh, LQ.bp.mesh);
const lqEmpty = { mand: false, bp: false };
const setLiquid = (key, balls) => { if (!balls.length && lqEmpty[key]) return; LQ[key].set(balls); lqEmpty[key] = !balls.length; };
setLiquid("mand", []); setLiquid("bp", []);
const lh = (k) => hash(k + 700);
const mandBalls = (q, R) => {
  const x0 = 0, z0 = PZ, B = [];
  const spread = E.out(seg(q, 0, 0.24)), back = E.inout(seg(q, 0.95, 1.45)), sink = seg(q, 1.45, 2.6), gone = 1 - sink;
  const core = R * (1 - 0.45 * spread + 0.25 * back) * gone;
  B.push({ p: [x0, SURF + core * 0.6 - 2.6 * sink, z0], r: core });
  for (let k = 0; k < 6; k++) {                      // beads on the skin behind the slot (never off the block's front edge)
    const a = Math.PI + (k / 5) * Math.PI, d = 1.95 * R * spread * (1 - back);
    const rb = R * 0.42 * (0.85 + 0.3 * lh(k)) * (1 - back * 0.6) * gone;
    const bob = 0.05 * Math.sin(q * 9 + k * 1.3) * (1 - back);
    B.push({ p: [x0 + Math.cos(a) * d, SURF + rb * 0.75 + bob - 2.6 * sink, z0 + Math.sin(a) * d * 0.85], r: rb });
  }
  return B;
};
const bpBalls = (q, R) => {
  const x0 = 0.6, z0 = PZ + 0.4, B = [];
  const spread = E.out(seg(q, 0, 0.3)), soak = E.inout(seg(q, 0.9, 2.0)), gone = 1 - soak;
  B.push({ p: [x0, SURF + R * 0.5 * gone, z0], r: R * (1 - 0.5 * spread) * gone });
  for (let k = 0; k < 7; k++) {
    const a = Math.PI + (k / 6) * Math.PI, d = 2.4 * R * spread;
    const rb = R * 0.38 * (0.8 + 0.4 * lh(k + 20)) * gone;
    B.push({ p: [x0 + Math.cos(a) * d, SURF + rb * 0.7, z0 + Math.sin(a) * d * 0.9], r: rb });
  }
  return B;
};
const splash = (m, x, z, q) => { m.visible = q >= 0 && q < 0.7; if (!m.visible) return; const k = 1 - Math.pow(1 - q / 0.7, 3); m.position.set(x, SURF + 0.03, z); m.scale.setScalar(0.6 + 2.8 * k); m.material.opacity = 0.75 * Math.pow(1 - q / 0.7, 1.6); };

const RED = new THREE.Color(0xe0574a), BLACK = new THREE.Color(0x1a1210);
const tmp = new THREE.Color();
const paint = (redP) => {
  let any = false;
  cells.forEach((c, i) => {
    const d = near[i];
    if (c.y >= 10 && d < 3.6) {
      const k = redP * Math.max(0, 1 - d / 3.6) * (c.y === 13 ? 1 : 0.7);
      tmp.copy(c.base).lerp(RED, k); block.setColorAt(i, tmp);
      // the wall swells: the ring around the pore rises with the inflammation
      const lift = (c.y === 13 && d < 2.6) ? 0.55 * redP * Math.max(0, 1 - d / 2.6) : 0;
      dummy.position.set(c.x + 0.5, c.y + lift, c.z + 0.5 - NZ / 2); dummy.scale.set(1, 1 + lift, 1); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix);
      any = true;
    }
  });
  if (any) { block.instanceColor.needsUpdate = true; block.instanceMatrix.needsUpdate = true; }
};
// directed: the camera is keyed per shot (macro on the pore mouth, crane back into the section,
// push into the clog, pull back for the bacteria, crane over the drops, the hero wide at the end).
// Portrait frames the same moves from further back with a wider lens.
const EZ = { sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2, p2: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2), p3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), out: (x) => 1 - Math.pow(1 - x, 3) };
const CAM = [
  { t: 0.0, pos: [4.2, 17.4, 11.6], look: [0.1, 14.4, 3.4], fov: 30 },
  { t: 2.3, pos: [8.6, 12.2, 24.8], look: [0.6, 10.6, 3.2], fov: 32, ease: "p3" },
  { t: 6.0, pos: [6.2, 11.4, 22.4], look: [0.3, 11.0, 3.4], fov: 32, ease: "sine" },
  { t: 7.4, pos: [1.8, 11.9, 12.6], look: [0.0, 11.2, 3.5], fov: 30, ease: "p3" },
  { t: 10.0, pos: [-2.4, 12.4, 12.2], look: [0.0, 11.5, 3.5], fov: 30, ease: "sine" },
  { t: 12.0, pos: [-1.4, 15.4, 10.6], look: [0.0, 13.1, 3.5], fov: 30, ease: "p2" },
  { t: 13.3, pos: [7.8, 16.8, 18.6], look: [0.0, 12.8, 3.0], fov: 32, ease: "p3" },
  { t: 17.9, pos: [5.0, 15.8, 14.8], look: [0.0, 12.8, 3.5], fov: 30, ease: "sine" },
  { t: 18.9, pos: [3.6, 19.6, 17.6], look: [0.0, 16.4, 3.5], fov: 34, ease: "p3" },
  { t: 19.7, pos: [2.4, 16.8, 10.8], look: [0.0, 13.9, 3.2], fov: 30, ease: "p3" },     // directed: push in on the beads
  { t: 20.9, pos: [1.6, 16.2, 10.2], look: [0.0, 13.2, 3.4], fov: 30, ease: "sine" },   // follow the merge and the sink
  { t: 21.5, pos: [4.2, 18.8, 18.4], look: [0.2, 15.8, 3.5], fov: 34, ease: "p2" },     // back out for the second drop's fall
  { t: 22.9, pos: [2.6, 16.9, 11.6], look: [0.5, 13.9, 3.3], fov: 31, ease: "p3" },     // and in on its beads
  { t: 24.4, pos: [10.4, 14.6, 29.0], look: [0.3, 10.4, 1.6], pl: [0.3, 7.4, 1.6], fov: 32, ease: "p3" },
  { t: 26.0, pos: [9.8, 14.2, 27.8], look: [0.3, 10.4, 1.6], pl: [0.3, 7.4, 1.6], fov: 32, ease: "sine" }
];
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), lk = new THREE.Vector3();
const place = (t) => {
  let i = CAM.findIndex((k) => k.t > t); if (i < 0) i = CAM.length - 1; if (i < 1) i = 1;
  const a = CAM[i - 1], b = CAM[i], e = EZ[b.ease || "p2"](Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  const sc = portrait ? 1.32 : 1;
  const L = lk.fromArray(portrait && a.pl ? a.pl : a.look).lerp(vB.fromArray(portrait && b.pl ? b.pl : b.look), e);   // pl: a portrait-only look target
  const P = vA.fromArray(a.pos).lerp(vB.fromArray(b.pos), e).sub(L).multiplyScalar(sc).add(L);
  // a hand on the camera: tiny, slow, deterministic
  P.x += Math.sin(t * 0.9) * 0.05 + Math.sin(t * 2.3 + 1) * 0.02; P.y += Math.sin(t * 1.1 + 2) * 0.04;
  camera.position.copy(P); camera.fov = (a.fov + (b.fov - a.fov) * e) + (portrait ? 12 : 0); camera.updateProjectionMatrix();
  camera.lookAt(L.x + Math.sin(t * 0.7) * 0.03, L.y + Math.sin(t * 0.8 + 1) * 0.03, L.z);
};
// directed: focus pulls to whatever the caption and labels name, racked over 0.45 s
const DROP = { mand: new THREE.Vector3(0, 22, PZ), bp: new THREE.Vector3(0.6, 22, PZ + 0.4) };
const FOC = [
  { t: 0.0, at: [0.1, 13.6, 3.5], f: 0.55 },
  { t: 1.6, at: [2.5, 6.8, 4.0], f: 0.32 },
  { t: 2.9, at: [0.0, 11.0, 3.5], f: 0.36 },
  { t: 6.2, at: [0.5, 11.2, 3.6], f: 0.48 },
  { t: 10.2, at: [0.0, 13.2, 3.6], f: 0.5 },
  { t: 12.6, at: [0.3, 11.5, 3.5], f: 0.38 },
  { t: 14.5, at: [-2.4, 13.4, 3.6], f: 0.38 },
  { t: 18.0, at: "mand", f: 0.45 },
  { t: 21.5, at: "bp", f: 0.45 },
  { t: 23.6, at: [0.3, 9.5, 3.0], f: 0.22 }
];
const fA = new THREE.Vector3(), fB = new THREE.Vector3();
const focusPoint = (k, out) => (typeof k.at === "string" ? out.copy(DROP[k.at]) : out.fromArray(k.at));
window.CINEMA_FOCUS = (t) => {
  let i = 0; for (let k = 0; k < FOC.length; k++) if (t >= FOC[k].t) i = k;
  const cur = FOC[i], prev = FOC[Math.max(0, i - 1)], r = EZ.p2(Math.min(1, (t - cur.t) / 0.45));
  focusPoint(prev, fA); focusPoint(cur, fB);
  return { point: fA.lerp(fB, i === 0 ? 1 : r), fstop: (prev.f + (cur.f - prev.f) * (i === 0 ? 1 : r)) * (portrait ? 0.8 : 1) };
};
// a label follows the part it names: project the point, offset a little
const ANCHOR = { "l-hair": [0.4, 16.6, PZ], "l-gland": [3, 6.6, PZ + 0.5], "l-oil": [-0.6, 12, PZ + 0.5], "l-plug": [0.8, 11.2, PZ + 0.5], "l-black": [-0.6, 14.4, PZ + 0.5], "l-bact": [0.9, 10.6, PZ + 0.5], "l-red": [-2.8, 14.2, PZ + 0.5], "l-mand": [-1.2, 17.5, PZ], "l-bp": [1.4, 17.3, PZ] };
const OFF = { "l-hair": [1, -1], "l-gland": [1, 0], "l-oil": [-1, 0], "l-plug": [1, 0], "l-black": [-1, -1], "l-bact": [1, 0], "l-red": [-1, -1], "l-mand": [-1, -1], "l-bp": [1, -1] };
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; const pw = el.offsetParent ? el.offsetParent.clientWidth : W; el.style.left = Math.min(pw - w - 6, Math.max(6, x + (ox > 0 ? 14 : -w - 14))) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; el.style.visibility = el.getBoundingClientRect().top < titleBottom() + 6 ? "hidden" : ""; } };   // directed: labels stay inside the frame, and out of the title (the push in at the end carries the top ones up past it)
const titleBottom = () => { const hd = document.querySelector("header"); return hd ? hd.getBoundingClientRect().bottom : 0; };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // healthy oil, until the clog
  const oilOn = i === 0 ? 1 : i === 1 ? 1 - seg(lt, 0, 1.5) : 0;
  // directed: each drop grows in at the gland and shrinks away at the top, so the loop's wrap is never seen (or blurred)
  oils.forEach((o, k) => { const ph = (t * 0.32 + k * 0.2) % 1, life = Math.min(1, ph / 0.08, (1 - ph) / 0.1); const sc = (0.7 + 0.5 * ph) * oilOn * life * life * (3 - 2 * life); o.visible = sc > 0.02; o.position.set(0 + Math.sin(ph * 9 + k) * 0.25, 7 + ph * 8.5, PZ + Math.cos(ph * 7 + k) * 0.2); o.scale.setScalar(Math.max(0.001, sc)); });
  // the plug fills from shot 1, dissolves in shot 3
  const fillP = i === 0 ? 0 : i >= 2 ? 1 : seg(lt, 0.3, 4.8);
  const clearP = i === 3 ? seg(lt, 1.4, 4.6) : 0;
  plug.forEach((m, k) => {
    const t0 = k / plug.length, p = seg(fillP, t0, t0 + 0.25);
    const gone = seg(clearP, 1 - (k + 1) / plug.length, 1 - k / plug.length);
    m.visible = p > 0 && gone < 1;
    // directed: a real fall (accelerating), a little bounce and squash where it lands
    const land = 0.3 + (t0 + 0.25) * 4.5, q = lt - land;
    const settled = i >= 2 || (i === 1 && q >= 0);
    const bounce = settled && i === 1 && q < 0.8 ? 0.32 * Math.exp(-q * 7) * Math.abs(Math.sin(q * 13)) : 0;
    const sq = settled && i === 1 && q < 0.6 ? 0.22 * Math.exp(-q * 9) * Math.cos(q * 26) : 0;
    m.position.y = m.userData.y + (p < 1 ? (1 - p * p) * 7 : 0) + bounce;
    const sz = Math.max(0.001, (0.8 + 0.4 * p) * (1 - gone));
    m.scale.set(sz * (1 + sq * 0.5), sz * (1 - sq), sz * (1 + sq * 0.5));
    if (m.userData.top) { tmp.set(hash(k + 500) < 0.6 ? 0x8e8e93 : 0xd9b85c).lerp(BLACK, i === 1 ? seg(lt, 4.2, 5.8) : i >= 2 ? 1 - clearP : 0); m.material.color.copy(tmp); }
  });
  // bacteria and the red wall
  const bactP = i === 2 ? seg(lt, 0.6, 4.4) : i === 3 ? 1 - seg(lt, 4.4, 6.2) : 0;
  bact.forEach((b, k) => { const p = seg(bactP, k / bact.length, k / bact.length + 0.3); b.visible = p > 0; const h = b.userData.home;
    b.position.set(h.x + 0.06 * Math.sin(t * 6.1 + k * 1.7), h.y + 0.07 * Math.sin(t * 5.3 + k * 2.3), h.z + 0.05 * Math.sin(t * 4.7 + k));
    const pop = E.back(Math.min(1, p * 1.2)); b.scale.set(Math.max(0.001, pop) * (1 + 0.15 * Math.sin(t * 5 + k)), Math.max(0.001, pop) * (1 - 0.12 * Math.sin(t * 5 + k)), Math.max(0.001, pop) * (1 + 0.15 * Math.sin(t * 5 + k))); });
  const redP = i === 2 ? E.out(seg(lt, 1.6, 5.4)) : i === 3 ? 1 - E.inout(seg(lt, 3.2, 6.4)) : 0;
  paint(redP);
  // the drops in shot 3
  // directed: each drop stretches as it falls, lands with a sprung squash and a splash ring
  const drop = (m, x, z, r, t0, t1, fadeA, fadeB, flatMax, ringM, key, balls) => {
    m.visible = i === 3 && lt > t0 && lt < fadeB;
    const q = lt - t1;
    splash(ringM, x, z, i === 3 ? q : -1);
    // after impact the liquid takes over from the sphere
    if (m.visible && q >= 0) {
      m.visible = false;
      m.material.opacity = (m === dropMand ? 0.85 : 0.9) * (1 - seg(lt, fadeA, fadeB));
      setLiquid(key, balls(q, r));
      return tmpV.set(x, SURF + 0.3, z);
    }
    setLiquid(key, []);
    if (!m.visible) return null;
    const u = seg(lt, t0, t1), f = u * u * u, speed = 3 * u * u;
    let sy, sxz;
    if (q < 0) { sy = Math.min(1.55, 1 + 0.2 * speed); sxz = 1 / Math.sqrt(sy); }
    else { const flat = flatMax * (1 - Math.exp(-q * 6)), wob = 0.13 * Math.sin(q * 22) * Math.exp(-q * 4.5); sy = Math.max(0.2, 1 - flat + wob); sxz = 1 + 1.35 * flat - 0.5 * wob; }
    const y = q < 0 ? 22 - (22 - (SURF + r)) * f : SURF + r * sy;
    m.position.set(x, y, z); m.scale.set(sxz, sy, sxz);
    m.material.opacity = (m === dropMand ? 0.85 : 0.9) * (1 - seg(lt, fadeA, fadeB));
    return m.position;
  };
  const pm = drop(dropMand, 0, PZ, 0.9, 0.1, 1.0, 3.8, 5, 0.65, splashMand, "mand", mandBalls); if (pm) DROP.mand.copy(pm); else if (i === 3 && lt <= 0.1) DROP.mand.set(0, 22, PZ);
  const pb = drop(dropBP, 0.6, PZ + 0.4, 0.8, 3.6, 4.4, 6.2, 7.2, 0.6, splashBP, "bp", bpBalls); if (pb) DROP.bp.copy(pb); else if (i === 3 && lt <= 3.6) DROP.bp.set(0.6, 22, PZ + 0.4);
  // labels and the day counter (DOM)
  const $ = M.$;
  if (i === 0) { enter($("#l-hair"), lt, 0.8, { y: 8 }); enter($("#l-gland"), lt, 1.8, { y: 8 }); enter($("#l-oil"), lt, 3.0, { y: 8 }); }
  if (i === 1) { enter($("#l-plug"), lt, 1.2, { y: 8 }); enter($("#l-black"), lt, 4.4, { y: 8 }); }
  if (i === 2) { enter($("#l-bact"), lt, 1.0, { y: 8 }); enter($("#l-red"), lt, 2.6, { y: 8 }); }
  if (i === 3) { enter($("#l-mand"), lt, 0.6, { y: 8 }); enter($("#l-bp"), lt, 4.0, { y: 8 }); enter($("#dayc"), lt, 6.4, { y: 10 }); $("#dayn").textContent = Math.round(90 * E.out(seg(lt, 6.6, 7.9))); }
  renderer.render(scene, camera);
};
`
  },

  /* ───────── 3-3 Ninety nights: the domino chain ───────── */
  "3-3": {
    id: "3-3", kicker: "Habits that matter more than products", title: `Ninety nights, <span class="grad">one at a time.</span>`, dur: 20, poster: 3.2,
    shots: [
      { at: 0, name: "chain", cap: "Every night you do the routine, the next night is easier. That's the whole trick." },
      { at: 5.5, name: "gap", cap: "A few skipped nights don't reset anything. Pick it back up at the same strength." },
      { at: 13, name: "ninety", cap: "A week or more away from a retinoid or acid: go back to a few nights a week first. Then: day 90." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.nightc { position: absolute; left: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; }
.nightc b { font-size: 8vmin; font-weight: 700; letter-spacing: -.03em; } .nightc span { font-size: 2.6vmin; color: #a1a1a6; }
.skip { position: absolute; left: 50%; top: 30%; margin-left: -18vmin; width: 36vmin; text-align: center; padding: 1.2vmin 2vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,122,107,.6); color: #ff7a6b; font-size: 2.4vmin; font-weight: 600; opacity: 0; }
.day90 { position: absolute; right: 0; bottom: 2vmin; font-size: 7vmin; font-weight: 700; letter-spacing: -.03em; opacity: 0; }
@media (orientation: portrait) { .skip { top: 36%; } }`,
    html: `
<section class="shot"><div class="nightc"><b id="n0">0</b><span>nights</span></div></section>
<section class="shot"><div class="nightc"><b id="n1">39</b><span>nights</span></div><div class="skip" id="skip">four nights skipped</div></section>
<section class="shot"><div class="nightc"><b id="n2">44</b><span>nights</span></div><div class="day90" id="d90">Day 90</div></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 26, 60);
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(portrait ? 50 : 36, W / H, 0.1, 120);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x1a0e10, 0.8));
const key = new THREE.DirectionalLight(0xfff4ea, 2.4); key.position.set(6, 14, 8); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -24; key.shadow.camera.right = 24; key.shadow.camera.top = 24; key.shadow.camera.bottom = -24; key.shadow.camera.near = 1; key.shadow.camera.far = 60; key.shadow.bias = -0.0006;
scene.add(key);
const fill = new THREE.DirectionalLight(0xf4c9d6, 0.45); fill.position.set(-10, 5, -8); scene.add(fill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x141012, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// ninety dominoes along a gentle curve; 40 to 43 are the skipped nights
const N = 90, SKIP = [40, 41, 42, 43], STEP = 1.15, DW = 0.72, DH = 1.5, DT = 0.22;
const geo = new THREE.BoxGeometry(DW, DH, DT);
const pathAt = (i) => { const s = i * STEP; return new THREE.Vector3(s - N * STEP / 2, 0, Math.sin(s / 16) * 5); };
const dominoes = [];
for (let i = 0; i < N; i++) {
  if (SKIP.includes(i)) { dominoes.push(null); continue; }
  const p = pathAt(i), q = pathAt(i + 1), heading = Math.atan2(q.x - p.x, q.z - p.z);
  const pivot = new THREE.Group(); pivot.position.copy(p); pivot.rotation.y = heading;
  const col = new THREE.Color().setHSL(0.95 + (i % 7) * 0.004, 0.25, 0.86 - (i % 3) * 0.03);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: i === N - 1 ? 0xe3b48f : col, roughness: 0.55 }));
  m.position.set(0, DH / 2, -DT / 2); m.castShadow = true; m.receiveShadow = true;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshStandardMaterial({ color: 0x2a1a1e, roughness: 0.9 }));
  dot.position.set(0, DH * 0.72, 0.001); m.add(dot);
  pivot.add(m); scene.add(pivot); dominoes.push(pivot);
}
// the plaque at the end
const plaque = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1.6), new THREE.MeshStandardMaterial({ color: 0xe3b48f, roughness: 0.4, metalness: 0.2 }));
const pe = pathAt(N + 1); plaque.position.set(pe.x, 0.09, pe.z); plaque.receiveShadow = true; plaque.castShadow = true; scene.add(plaque);
// when each domino tips: the first run (0..39) in shot 0, the restart (44..89) in shots 1 and 2
const TIP = 0.082, TIP2 = 0.11, RUN1 = 0.6, RUN2 = 9.5;
const tipAt = (i) => i < 40 ? RUN1 + i * TIP : RUN2 + (i - 44) * TIP2;
const wave = (t) => t < RUN2 - 1 ? Math.min(39, Math.max(0, (t - RUN1) / TIP)) + 3 : 42 + (47 + Math.max(0, (t - RUN2) / TIP2) - 42) * E.inout(seg(t, RUN2 - 1, RUN2));
const angle = (t, i) => { const a = i === 39 || i === N - 1 ? 1.52 : 1.18; const p = E.in(seg(t, tipAt(i), tipAt(i) + 0.42)); return a * p + (p >= 1 ? 0 : 0); };
const look = new THREE.Vector3();
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  dominoes.forEach((d, k) => { if (!d) return; d.rotation.x = angle(t, k); });
  // the camera follows the wavefront with a little lead, drifts all the time, and rises for the finish
  const fi = Math.min(N - 1, wave(t));
  look.copy(pathAt(fi)); look.y = 0.6;
  // the key light travels with the wave, so the dominoes at either end of the line keep their shadows
  key.position.set(look.x + 6, 14, look.z + 8); key.target.position.set(look.x, 0, look.z); key.target.updateMatrixWorld();
  const rise = i === 2 ? E.inout(seg(lt, 2.2, 5.6)) : 0, drift = Math.sin(t * 0.35) * 0.5;
  const back = portrait ? 11 : 9;
  camera.position.set(look.x - 5 - rise * 3 + drift, 4.2 + rise * 3.5 + Math.cos(t * 0.3) * 0.25, look.z + back + rise * 3);
  camera.lookAt(look.x + 1.5 + drift * 0.5, 0.4, look.z - 1);
  // the counters
  const $ = M.$;
  const n2 = Math.min(N, Math.max(40, 40 + Math.floor((t - RUN2) / TIP2) + 1));
  if (i === 0) $("#n0").textContent = Math.min(40, Math.max(0, Math.floor((t - RUN1) / TIP) + 1));
  if (i === 1) { enter($("#skip"), lt, 0.8, { y: 10, s: 0.9 }); if (lt > 3.6) $("#skip").style.opacity = 1 - seg(lt, 3.6, 4.4); $("#n1").textContent = n2; }
  if (i === 2) { $("#n2").textContent = n2; enter($("#d90"), lt, 2.4, { y: 12, s: 0.8 }); }
  renderer.render(scene, camera);
};
`
  },
  /* ───────── 2-1 Cleansing, done right: the day off, without stripping ───────── */
  "2-1": {
    id: "2-1", kicker: "Cleansing, done right", title: `Take the day off <span class="grad">without stripping the skin.</span>`, dur: 22, poster: 13,
    shots: [
      { at: 0, name: "day", cap: "By evening your face carries the day: sunscreen, makeup, oil, and what the air left on it. Water alone doesn't move it." },
      { at: 7, name: "melt", cap: "At night, cleanse twice: an oil or balm first. It melts sunscreen and makeup, and rinses off with lukewarm water, not hot." },
      { at: 14, name: "wash", cap: "Then your cleanser, a gel for oily skin, a cream or milk for dry, massaged for a full 60 seconds. Rinse. Not tight, not squeaky: that's clean." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.clock3 { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; opacity: 0; }
.clock3 b { font-size: 7vmin; font-weight: 700; letter-spacing: -.03em; } .clock3 span { font-size: 2.6vmin; color: #a1a1a6; }
.note3 { position: absolute; left: 0; bottom: 2vmin; max-width: 64vmin; font-size: 2.5vmin; line-height: 1.4; color: #ff7a6b; opacity: 0; }`,
    html: `
<section class="shot"><span class="lab3" id="l-spf"><i style="background:#f6f0e8"></i>sunscreen, makeup</span><span class="lab3" id="l-oil"><i style="background:#f1d57a"></i>your own oil</span><span class="lab3" id="l-city"><i style="background:#6e6e73"></i>what the air left</span></section>
<section class="shot"><span class="lab3" id="l-balm"><i style="background:#f5c98a"></i>oil or balm first</span><span class="lab3" id="l-melt"><i style="background:#f5c98a"></i>sunscreen and makeup, melting</span><span class="lab3" id="l-warm"><i style="background:#8fd3ff"></i>lukewarm, not hot</span></section>
<section class="shot"><span class="lab3" id="l-gel"><i style="background:#dff3ff"></i>your cleanser, massaged</span><span class="lab3" id="l-clean"><i style="background:#e9c4b4"></i>clean, barrier still there</span><div class="clock3" id="clock3"><b id="clockn">0:00</b><span>massage</span></div><p class="note3" id="note3">Tight and squeaky afterward means the cleanser is too strong. Switch to a gentler one.</p></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((((x >>> 16) ^ x) / 4294967296) % 1 + 1) % 1; };
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(portrait ? 46 : 34, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.85));
const key = new THREE.DirectionalLight(0xfff4ea, 2.0); key.position.set(10, 20, 12); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; key.shadow.camera.near = 1; key.shadow.camera.far = 70; key.shadow.bias = -0.0008;
scene.add(key);
const fill2 = new THREE.DirectionalLight(0xf4c9d6, 0.45); fill2.position.set(-12, 6, -8); scene.add(fill2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block of skin
const NY = 12, NZ = 9, cells = [];
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  const i = x * 1000 + y * 20 + z, v = hash(i) * 0.08 - 0.04;
  let c;
  if (y >= 9) c = new THREE.Color(0xe9c4b4).offsetHSL(0, 0, v + (y === 11 ? 0.04 : 0));
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  cells.push({ x, y, z, c, base: c.clone(), wx: x + 0.5, wz: z + 0.5 - NZ / 2 });
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const block = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 }), cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
cells.forEach((c, i) => { dummy.position.set(c.wx, c.y, c.wz); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
// the day: a sunscreen-and-makeup film, oil beads, grit
const dayFilm = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.34, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xf2e4d2, roughness: 0.55, opacity: 0.0, transparent: true }));
dayFilm.position.set(0, 11.7, 0); dayFilm.castShadow = true; scene.add(dayFilm);
const beadGeo = new THREE.SphereGeometry(0.26, 12, 10);
const oilMat = new THREE.MeshStandardMaterial({ color: 0xf1d57a, emissive: 0x5a4410, emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 1 });
const beads = Array.from({ length: 16 }, (_, k) => { const m = new THREE.Mesh(beadGeo, oilMat); m.position.set(-7 + hash(k + 20) * 14, 12.05, -3.8 + hash(k + 21) * 7.6); m.scale.set(1.7, 0.7, 1.7); m.visible = false; scene.add(m); return m; });
const gritGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const gritMat = new THREE.MeshStandardMaterial({ color: 0x6e6e73, roughness: 0.9, transparent: true, opacity: 1 });
const grit = Array.from({ length: 36 }, (_, k) => { const m = new THREE.Mesh(gritGeo, gritMat); m.position.set(-7.6 + hash(k + 40) * 15.2, 12.1, -4 + hash(k + 41) * 8); m.rotation.set(hash(k + 42) * 2, hash(k + 43) * 2, 0); m.visible = false; scene.add(m); return m; });
// the balm: a drop that spreads into a warm amber pool, then rinses away in a lukewarm sheet
const balm = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xf5c98a, roughness: 0.2, transmission: 0.2, opacity: 0.95, transparent: true }));
balm.position.set(0, 24, 0); balm.visible = false; balm.castShadow = true; scene.add(balm);
const pool = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.5, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xf5c98a, roughness: 0.15, clearcoat: 0.9, transmission: 0.25, opacity: 0.0, transparent: true }));
pool.position.set(0, 11.9, 0); scene.add(pool);
const rinse = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.5, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0x8fd3ff, roughness: 0.1, transmission: 0.5, opacity: 0.0, transparent: true }));
rinse.position.set(0, 12.1, 0); scene.add(rinse);
const dropGeo = new THREE.SphereGeometry(0.18, 10, 8);
const rinseDrops = Array.from({ length: 24 }, (_, k) => { const m = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x2a7fb8, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 })); m.visible = false; scene.add(m); return { m, k, x: -7 + hash(k + 70) * 14, z: NZ / 2 + 0.5 }; });
// the cleanser: a soft foam of spheres over the surface, moving in small circles (the massage)
const foamGeo = new THREE.SphereGeometry(0.42, 14, 12);
const foamMat = new THREE.MeshStandardMaterial({ color: 0xdff3ff, roughness: 0.65, transparent: true, opacity: 0.0 });
const foam = Array.from({ length: 70 }, (_, k) => { const m = new THREE.Mesh(foamGeo, foamMat); m.userData = { x: -7.2 + hash(k + 100) * 14.4, z: -3.6 + hash(k + 101) * 7.2, s: 0.6 + hash(k + 102) * 0.7, ph: hash(k + 103) * 6.28 }; m.visible = false; m.castShadow = true; scene.add(m); return m; });
const look = new THREE.Vector3(0, 8, 0);
const place = (t) => (place.d || (place.d = direct(camera, look, 0.42, ANCHOR, portrait)))(t);   // directed: see direct() in studio3d.js
const ANCHOR = { "l-spf": [7.5, 12.6, 1.5], "l-oil": [-4, 12.6, 3.5], "l-city": [2, 12.6, -3], "l-balm": [-1, 16, 0], "l-melt": [7.5, 12.8, 1.5], "l-warm": [-5, 13, 4], "l-gel": [7.5, 13.2, 1.5], "l-clean": [-4.5, 12.4, 4] };
const OFF = { "l-spf": [-1, -1], "l-oil": [-1, -1], "l-city": portrait ? [-1, -1] : [1, -1], "l-balm": [1, -1], "l-melt": [-1, -1], "l-warm": [-1, -1], "l-gel": [-1, -1], "l-clean": [-1, -1] };   // on a phone the block fills the width: "what the air left" goes to the left of its point, clear of "sunscreen, makeup"
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; el.style.visibility = el.getBoundingClientRect().top < titleBottom() + 6 ? "hidden" : ""; } };   // a label never sits on the title
const titleBottom = () => { const hd = document.querySelector("header"); return hd ? hd.getBoundingClientRect().bottom : 0; };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // the day lands in shot 0 and stays until the balm melts it (shot 1), the grit until the wash (shot 2)
  const dayOn = i === 0 ? E.out(seg(lt, 0.6, 2.2)) : 1;
  const melt = i === 1 ? E.inout(seg(lt, 2.0, 4.6)) : i > 1 ? 1 : 0;
  const rinsed = i === 1 ? E.out(seg(lt, 4.8, 6.4)) : i > 1 ? 1 : 0;
  const wash = i === 2 ? E.inout(seg(lt, 3.6, 6.4)) : 0;
  dayFilm.material.opacity = 0.9 * dayOn * (1 - melt);
  dayFilm.scale.set(1, Math.max(0.05, 1 - 0.9 * melt), 1);
  beads.forEach((b, k) => { const on = i === 0 ? lt > 1.0 + k * 0.08 : true; b.visible = on && (1 - melt) > 0.02; b.scale.set(1.7 * (1 - 0.8 * melt), 0.7 * (1 - 0.8 * melt), 1.7 * (1 - 0.8 * melt)); });
  grit.forEach((g, k) => { const on = i === 0 ? lt > 1.4 + k * 0.03 : true; const gone = i === 2 ? seg(lt, 3.8 + k * 0.03, 4.6 + k * 0.03) : 0; g.visible = on && gone < 0.98; g.material.opacity = 1 - gone; g.position.y = 12.1 + (i === 1 ? 0.35 * melt : 0); });
  // the balm drop lands and spreads into the pool, lifting the film; the lukewarm rinse carries the pool off
  balm.visible = i === 1 && lt > 0.3 && lt < 2.4;
  if (balm.visible) { const f = E.in(seg(lt, 0.3, 1.2)), sp = seg(lt, 1.2, 2.4); balm.position.set(0, 24 - 12 * f, 0); balm.scale.set(1 + 2.5 * sp, 1 - 0.7 * sp, 1 + 2.5 * sp); balm.material.opacity = 0.95 * (1 - sp); }
  const poolOn = i === 1 ? E.out(seg(lt, 1.6, 2.8)) * (1 - rinsed) : 0;
  pool.material.opacity = 0.85 * poolOn; pool.position.y = 11.95;
  const rinseOn = i === 1 ? Math.sin(Math.PI * seg(lt, 4.6, 6.6)) : i === 2 ? Math.sin(Math.PI * seg(lt, 6.2, 7.6)) : 0;
  const rp = i === 1 ? seg(lt, 4.6, 6.6) : i === 2 ? seg(lt, 6.2, 7.6) : 0;
  const rs = rp < 0.5 ? rp * 2 : 1 - (rp - 0.5) * 2;
  rinse.scale.x = Math.max(0.02, rs); rinse.position.x = rp < 0.5 ? -8.2 + 8.2 * rs : 8.2 - 8.2 * rs;
  rinse.material.opacity = 0.6 * Math.min(1, rs * 3); rinse.visible = rp > 0 && rp < 1;
  rinseDrops.forEach((d) => { const on = rinseOn > 0.05; d.m.visible = on; if (!on) return; const ph = (t * 0.9 + d.k * 0.041) % 1; d.m.position.set(d.x, 12.2 - ph * 7, d.z); d.m.material.opacity = 0.9 * (1 - ph) * rinseOn; });
  // the cleanser: foam appears, circles for the minute, then rinses
  const foamOn = i === 2 ? E.out(seg(lt, 0.4, 1.4)) * (1 - seg(lt, 6.2, 7.2)) : 0;
  foamMat.opacity = 0.92 * foamOn;
  foam.forEach((m) => { const u = m.userData; m.visible = foamOn > 0.02; const r = 0.5, ang = u.ph + t * 2.2; m.position.set(u.x + Math.cos(ang) * r, 12.3 + Math.sin(ang * 0.5) * 0.08, u.z + Math.sin(ang) * r); m.scale.setScalar(u.s * (0.6 + 0.4 * foamOn)); });
  // labels, the clock and the note (DOM)
  const $ = M.$;
  if (i === 0) { enter($("#l-spf"), lt, 1.2, { y: 8 }); enter($("#l-oil"), lt, 2.4, { y: 8 }); enter($("#l-city"), lt, 3.6, { y: 8 }); }
  if (i === 1) { enter($("#l-balm"), lt, 0.5, { y: 8 }); if (lt > 2.6) $("#l-balm").style.opacity = 1 - seg(lt, 2.6, 3.1); enter($("#l-melt"), lt, 2.4, { y: 8 }); if (lt > 4.8) $("#l-melt").style.opacity = 1 - seg(lt, 4.8, 5.3); enter($("#l-warm"), lt, 4.8, { y: 8 }); }
  if (i === 2) { enter($("#l-gel"), lt, 0.8, { y: 8 }); if (lt > 6.2) $("#l-gel").style.opacity = 1 - seg(lt, 6.2, 6.7); enter($("#clock3"), lt, 0.6, { y: 10 }); const secs = Math.round(60 * E.lin(seg(lt, 0.8, 6.0))); $("#clockn").textContent = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0"); enter($("#l-clean"), lt, 7.0, { y: 8 }); enter($("#note3"), lt, 6.4, { y: 10 }); if (lt > 6.2) $("#clock3").style.opacity = 1 - seg(lt, 6.2, 6.6); }   // the clock leaves as the note arrives (they share the bottom on a phone)
  renderer.render(scene, camera);
};
`
  },

  /* ───────── 2-2 Moisturizer, decoded: the three kinds of ingredients ───────── */
  "2-2": {
    id: "2-2", kicker: "Moisturizer, decoded", title: `Every moisturizer is <span class="grad">three kinds of ingredients.</span>`, dur: 22, poster: 12,
    shots: [
      { at: 0, name: "pull", cap: "Humectants pull water in: glycerin, hyaluronic acid, urea. Dry, tight skin is skin that's short of water in the top layers." },
      { at: 7, name: "smooth", cap: "Emollients smooth and soften: squalane, ceramides, plant oils. They fill the gaps between the cells, so the surface stops looking rough." },
      { at: 14, name: "seal", cap: "Occlusives seal it in: petrolatum, dimethicone, shea butter. A thin film on top, so the water stays. Everyone needs a moisturizer." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.pick3 { position: absolute; right: 0; bottom: 2vmin; display: grid; gap: .8vmin; justify-items: end; opacity: 0; }
.pick3 span { padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18); font-size: 2.3vmin; font-weight: 600; }
.pick3 b { color: #8fd3ff; }`,
    html: `
<section class="shot"><span class="lab3" id="l-dry"><i style="background:#c9a090"></i>dry: short of water</span><span class="lab3" id="l-hum"><i style="background:#8fd3ff"></i>humectants: glycerin, hyaluronic acid, urea</span><span class="lab3" id="l-water"><i style="background:#8fd3ff"></i>water, pulled up</span></section>
<section class="shot"><span class="lab3" id="l-emo"><i style="background:#f1c98a"></i>emollients: squalane, ceramides, oils</span><span class="lab3" id="l-gap"><i style="background:#f1c98a"></i>gaps filled, surface smooth</span></section>
<section class="shot"><span class="lab3" id="l-occ"><i style="background:#f3e6da"></i>occlusives: petrolatum, dimethicone, shea</span><span class="lab3" id="l-stay"><i style="background:#8fd3ff"></i>water stays in</span><div class="pick3" id="pick3"><span><b>Oily skin:</b> a light gel, humectants first</span><span><b>Dry skin:</b> a cream, all three</span></div></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((((x >>> 16) ^ x) / 4294967296) % 1 + 1) % 1; };   // always in [0, 1)
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(portrait ? 46 : 34, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.85));
const key = new THREE.DirectionalLight(0xfff4ea, 2.0); key.position.set(10, 20, 12); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; key.shadow.camera.near = 1; key.shadow.camera.far = 70; key.shadow.bias = -0.0008;
scene.add(key);
const fill2 = new THREE.DirectionalLight(0x8fd3ff, 0.35); fill2.position.set(-12, 6, -8); scene.add(fill2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block below the surface, and the surface cells on their own (they move, plump and go glossy)
const NY = 12, NZ = 9, cells = [], tops = [];
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  const i = x * 1000 + y * 20 + z, v = hash(i) * 0.08 - 0.04;
  let c;
  if (y >= 9) c = new THREE.Color(0xe9c4b4).offsetHSL(0, 0, v);
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  const cell = { x, y, z, c, base: c.clone(), wx: x + 0.5, wz: z + 0.5 - NZ / 2, j: hash(i + 7), k: hash(i + 11) };
  (y === 11 ? tops : cells).push(cell);
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const block = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 }), cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
cells.forEach((c, i) => { dummy.position.set(c.wx, c.y, c.wz); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
const topMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 });
const top = new THREE.InstancedMesh(geo, topMat, tops.length);
top.castShadow = true; top.receiveShadow = true; scene.add(top);
tops.forEach((c, i) => top.setColorAt(i, c.c));
// dry: the surface cells sit askew with their edges lifted; hydrated: plump; smooth: straight
const DRY = new THREE.Color(0xd9ad9c), WET = new THREE.Color(0xf0cfc0), tmp = new THREE.Color();
const layTop = (hyd, smooth) => {
  tops.forEach((c, i) => {
    const rough = 1 - smooth;
    dummy.position.set(c.wx, c.y + 0.12 * hyd + 0.18 * rough * c.j, c.wz);
    dummy.rotation.set(0.22 * rough * (c.j - 0.5), 0, 0.22 * rough * (c.k - 0.5));
    dummy.scale.set(1, 1 + 0.12 * hyd, 1); dummy.updateMatrix(); top.setMatrixAt(i, dummy.matrix);
    tmp.copy(DRY).lerp(WET, hyd).lerp(c.base, 0.5); top.setColorAt(i, tmp);
  });
  top.instanceMatrix.needsUpdate = true; top.instanceColor.needsUpdate = true;
  topMat.roughness = 0.85 - 0.55 * smooth;
  // the rows under the surface plump a little too
  cells.forEach((c, i) => { if (c.y < 9) return; dummy.position.set(c.wx, c.y + 0.06 * hyd * (c.y - 8), c.wz); dummy.scale.set(1, 1 + 0.06 * hyd, 1); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); });
  block.instanceMatrix.needsUpdate = true;
};
// the humectant sponges, in the top rows; water rises to them
const SP = Array.from({ length: 8 }, (_, k) => new THREE.Vector3(-6 + hash(k + 60) * 12, 10.2 + hash(k + 61) * 1.0, NZ / 2 - 0.2));   // on the face toward the camera
const spongeMat = new THREE.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x2a7fb8, emissiveIntensity: 0, roughness: 0.4, transparent: true, opacity: 0 });
const sponges = SP.map((p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), spongeMat); m.position.copy(p); m.rotation.set(0.4, 0.6, 0.2); scene.add(m); return m; });
const dropGeo = new THREE.SphereGeometry(0.2, 12, 10);
const drops = Array.from({ length: 22 }, (_, k) => { const m = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x2a7fb8, emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 0.9 })); m.visible = false; scene.add(m); return { m, k, sp: SP[k % SP.length], ox: hash(k + 80) * 2 - 1, oz: 0 }; });
// the emollient: a glossy amber fill in the seams between the surface cells
const seams = [];
for (let x = -7; x < 8; x++) for (let z = 0; z < NZ; z++) seams.push({ p: [x, 11, z + 0.5 - NZ / 2], s: [0.14, 0.7, 0.96] });
for (let x = -8; x < 8; x++) for (let z = 1; z < NZ; z++) seams.push({ p: [x + 0.5, 11, z - NZ / 2], s: [0.96, 0.7, 0.14] });
const seamMat = new THREE.MeshPhysicalMaterial({ color: 0xf1c98a, roughness: 0.15, clearcoat: 0.8, emissive: 0x7a4a10, emissiveIntensity: 0.45 });
const seam = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), seamMat, seams.length);
seam.visible = false; scene.add(seam);
const laySeams = (f) => {
  seams.forEach((q, i) => { dummy.position.set(q.p[0], q.p[1] + 0.3, q.p[2]); dummy.rotation.set(0, 0, 0); dummy.scale.set(q.s[0], q.s[1] * f, q.s[2]); dummy.updateMatrix(); seam.setMatrixAt(i, dummy.matrix); });
  seam.instanceMatrix.needsUpdate = true; seam.visible = f > 0.01;
};
// the occlusive film: thin, a little glossy, lowered onto the surface
const film = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.26, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xf3e6da, roughness: 0.12, clearcoat: 1, transmission: 0.45, opacity: 0.85, transparent: true }));
film.position.set(0, 12.4, 0); film.castShadow = true; film.visible = false; scene.add(film);
const look = new THREE.Vector3(0, 8, 0);
const place = (t) => (place.d || (place.d = direct(camera, look, -0.45, ANCHOR, portrait)))(t);   // directed: see direct() in studio3d.js
const ANCHOR = { "l-dry": [-5, 12.6, 4.5], "l-hum": [8, 12.6, 1.5], "l-water": [-2.5, 7.5, 4.6], "l-emo": [8, 12.8, 1.5], "l-gap": [-4, 12.3, 3], "l-occ": [8, 13.3, 1.5], "l-stay": [-3.5, 10.4, 4.6] };
const OFF = { "l-dry": [-1, -1], "l-hum": [-1, -1], "l-water": [-1, 0], "l-emo": [-1, -1], "l-gap": [-1, -1], "l-occ": [-1, -1], "l-stay": [-1, 0] };
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; el.style.visibility = el.getBoundingClientRect().top < titleBottom() + 6 ? "hidden" : ""; } };   // a label never sits on the title
const titleBottom = () => { const hd = document.querySelector("header"); return hd ? hd.getBoundingClientRect().bottom : 0; };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // hydration builds through shot 0; smoothing through shot 1; the film lands in shot 2
  const hyd = i === 0 ? E.inout(seg(lt, 2.2, 6.2)) : 1;
  const smooth = i === 1 ? E.inout(seg(lt, 1.4, 5.4)) : i > 1 ? 1 : 0;
  layTop(hyd, smooth);
  laySeams(i === 1 ? E.out(seg(lt, 1.0, 4.6)) : i > 1 ? 1 : 0);
  const spOn = i === 0 ? E.out(seg(lt, 1.6, 2.6)) : i === 1 ? 1 - seg(lt, 0, 0.8) : 0;
  spongeMat.opacity = 0.95 * spOn; spongeMat.emissiveIntensity = 1.2 * spOn * (0.6 + 0.4 * hyd);
  const filmOn = i === 2 ? E.out(seg(lt, 0.6, 1.8)) : 0;
  film.visible = filmOn > 0.01; film.position.y = 14.3 - 2.35 * filmOn; film.material.opacity = 0.85 * filmOn;
  // water: rising toward the sponges (shot 0), kept under the film (shot 2); between, resting in the top rows
  drops.forEach((d) => {
    const ph = (t * 0.3 + d.k * 0.0455) % 1;
    const on = i === 0 ? lt > 2.0 : i === 2 ? lt > 2.4 : false;
    d.m.visible = on;
    if (!on) return;
    if (i === 0) { const y0 = 4.5, p = E.inout(ph); d.m.position.set(d.sp.x + d.ox * (1 - p) * 1.5, y0 + (d.sp.y - y0) * p, NZ / 2 + 0.45); d.m.scale.setScalar(1 - 0.75 * seg(ph, 0.85, 1)); d.m.material.opacity = 0.9; }
    else { const y = 9.4 + 3.0 * ph, capY = 11.75; const under = y < capY; d.m.position.set(d.sp.x + d.ox * 1.2, under ? y : capY - (y - capY) * 0.6, NZ / 2 + 0.45); d.m.scale.setScalar(0.8); d.m.material.opacity = under ? 0.9 : 0.9 * Math.max(0, 1 - (y - capY) * 1.4); }
  });
  // labels (DOM)
  const $ = M.$;
  if (i === 0) { enter($("#l-dry"), lt, 0.4, { y: 8 }); if (lt > 3.6) $("#l-dry").style.opacity = 1 - seg(lt, 3.6, 4.1); enter($("#l-hum"), lt, 1.8, { y: 8 }); enter($("#l-water"), lt, 2.8, { y: 8 }); }
  if (i === 1) { enter($("#l-emo"), lt, 0.8, { y: 8 }); enter($("#l-gap"), lt, 3.6, { y: 8 }); }
  if (i === 2) { enter($("#l-occ"), lt, 1.2, { y: 8 }); enter($("#l-stay"), lt, 3.0, { y: 8 }); enter($("#pick3"), lt, 4.6, { y: 10 }); }
  renderer.render(scene, camera);
};
`
  },

  /* ───────── 4-2 How often, and how much: the dose, the overdose, the rest ───────── */
  "4-2": {
    id: "4-2", kicker: "How often, and how much", title: `More exfoliation <span class="grad">isn't better.</span>`, dur: 24, poster: 11,
    shots: [
      { at: 0, name: "dose", cap: "An exfoliating acid loosens the dead cells on top so fresh skin shows. Start with a few nights a week, and build up only as your skin allows." },
      { at: 7, name: "overdose", cap: "Every night from day one, or two exfoliants on the same night, is how most barriers break: a shine like plastic, stinging, redness, flaking." },
      { at: 15, name: "rest", cap: "If it burns or stings, back off and message Evelyn. Rest with a gentle cleanser, moisturizer and SPF, and never an acid and a retinoid on the same night." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.week3 { position: absolute; right: 0; bottom: 2vmin; display: flex; gap: .7vmin; opacity: 0; }
.week3 span { width: 5.2vmin; height: 5.2vmin; border-radius: 1.2vmin; display: grid; place-items: center; font-size: 2.1vmin; font-weight: 700; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); color: #a1a1a6; }
.week3 span.on { background: #f4c9d6; color: #1a1210; border-color: #f4c9d6; }
.week3 span.bad { background: #e0574a; color: #fff; border-color: #e0574a; }
.dayc { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; opacity: 0; }
.dayc b { font-size: 7vmin; font-weight: 700; letter-spacing: -.03em; } .dayc span { font-size: 2.6vmin; color: #a1a1a6; }
.note3 { position: absolute; left: 0; bottom: 2vmin; max-width: 64vmin; font-size: 2.5vmin; line-height: 1.4; color: #ff7a6b; opacity: 0; }`,
    html: `
<section class="shot"><span class="lab3" id="l-dead"><i style="background:#e9d5c8"></i>dead cells on top</span><span class="lab3" id="l-acid"><i style="background:#f4c9d6"></i>the acid, loosening them</span><span class="lab3" id="l-fresh"><i style="background:#f0cfc0"></i>fresh skin showing</span><div class="week3" id="week3"><span>M</span><span id="w-tu">T</span><span>W</span><span>T</span><span id="w-fr">F</span><span>S</span><span>S</span></div></section>
<section class="shot"><span class="lab3" id="l-shine"><i style="background:#fff3ea"></i>shine like plastic</span><span class="lab3" id="l-sting"><i style="background:#e0574a"></i>stinging, red, flaking</span><div class="week3" id="week3b"><span class="bad">M</span><span class="bad">T</span><span class="bad">W</span><span class="bad">T</span><span class="bad">F</span><span class="bad">S</span><span class="bad">S</span></div></section>
<section class="shot"><span class="lab3" id="l-cream"><i style="background:#f3e6da"></i>gentle cleanser, moisturizer, SPF</span><span class="lab3" id="l-grow"><i style="background:#e9d5c8"></i>the top layer grows back</span><div class="dayc" id="dayc"><b id="dayn">0</b><span>days of rest</span></div><p class="note3" id="note3">The week before and after a professional peel: no home acids.</p></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((((x >>> 16) ^ x) / 4294967296) % 1 + 1) % 1; };
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(portrait ? 46 : 34, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.85));
const key = new THREE.DirectionalLight(0xfff4ea, 2.0); key.position.set(-10, 20, 12); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; key.shadow.camera.near = 1; key.shadow.camera.far = 70; key.shadow.bias = -0.0008;
scene.add(key);
const fill2 = new THREE.DirectionalLight(0xf4c9d6, 0.45); fill2.position.set(12, 6, -8); scene.add(fill2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block (rows 0 to 10) and, on top, the dead-cell plates (the stratum corneum) that an acid loosens
const NY = 11, NZ = 9, cells = [];
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  const i = x * 1000 + y * 20 + z, v = hash(i) * 0.08 - 0.04;
  let c;
  if (y >= 9) c = new THREE.Color(0xf0cfc0).offsetHSL(0, 0, v);
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  cells.push({ x, y, z, c, base: c.clone(), wx: x + 0.5, wz: z + 0.5 - NZ / 2 });
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const block = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 }), cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
cells.forEach((c, i) => { dummy.position.set(c.wx, c.y, c.wz); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
const plates = [];
for (let x = -8; x < 8; x++) for (let z = 0; z < NZ; z++) plates.push({ wx: x + 0.5, wz: z + 0.5 - NZ / 2, j: hash(x * 50 + z + 300), k: hash(x * 50 + z + 400) });
const plateMat = new THREE.MeshStandardMaterial({ color: 0xe9d5c8, roughness: 0.85, metalness: 0.0 });
const plate = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.34, 0.92), plateMat, plates.length);
plate.castShadow = true; plate.receiveShadow = true; scene.add(plate);
const PLATE = new THREE.Color(0xe9d5c8), RED = new THREE.Color(0xe0574a), FRESH = new THREE.Color(0xf0cfc0), tmp = new THREE.Color();
// a plate's thickness: full (1) → shed (0); the top of the block tints red when the plates are gone
const layPlates = (thick, red) => {
  plates.forEach((p, i) => {
    const th = thick(p, i);
    dummy.position.set(p.wx, 11.0 + 0.17 * th - 0.17 * (1 - th) * 0.5, p.wz);
    dummy.scale.set(0.6 + 0.4 * th, Math.max(0.03, th), 0.6 + 0.4 * th); dummy.updateMatrix(); plate.setMatrixAt(i, dummy.matrix);
    tmp.copy(PLATE).lerp(RED, red * 0.45); plate.setColorAt(i, tmp);
  });
  plate.instanceMatrix.needsUpdate = true; plate.instanceColor.needsUpdate = true;
  cells.forEach((c, i) => { if (c.y < 9) return; tmp.copy(c.base).lerp(RED, red * (c.y === 10 ? 0.55 : 0.3)); block.setColorAt(i, tmp); });
  block.instanceColor.needsUpdate = true;
};
// the acid drops (pink), the cream slab, the sting sparks
const dropGeo = new THREE.SphereGeometry(0.7, 20, 16), dropMat = new THREE.MeshPhysicalMaterial({ color: 0xf4c9d6, roughness: 0.15, transmission: 0.3, opacity: 0.9, transparent: true });
const drops = Array.from({ length: 8 }, (_, k) => { const m = new THREE.Mesh(dropGeo, dropMat.clone()); m.visible = false; m.castShadow = true; scene.add(m); return { m, k, x: -6 + hash(k + 500) * 12, z: -3 + hash(k + 501) * 6 }; });
const cream = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.6, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xf3e6da, roughness: 0.35, opacity: 0.85, transparent: true }));
cream.position.set(0, 14, 0); cream.visible = false; cream.castShadow = true; scene.add(cream);
const sparkGeo = new THREE.OctahedronGeometry(0.22), sparkMat = new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 1 });
const sparks = Array.from({ length: 18 }, (_, k) => { const m = new THREE.Mesh(sparkGeo, sparkMat.clone()); m.visible = false; scene.add(m); return { m, k, x: -7 + hash(k + 600) * 14, z: -3.5 + hash(k + 601) * 7 }; });
const look = new THREE.Vector3(0, 8, 0);
const place = (t) => (place.d || (place.d = direct(camera, look, 0.5, ANCHOR, portrait)))(t);   // directed: see direct() in studio3d.js
const ANCHOR = { "l-dead": [-7.5, 12.4, 3.5], "l-acid": [2.5, 14.5, 1], "l-fresh": [-3.5, 11.6, 4.2], "l-shine": [-6.5, 12.6, 3.5], "l-sting": [3, 12.8, 4], "l-cream": [7.5, 13.6, 1.5], "l-grow": [-5, 12.4, 4] };
const OFF = { "l-dead": [1, -1], "l-acid": [1, -1], "l-fresh": [-1, -1], "l-shine": [1, -1], "l-sting": [1, -1], "l-cream": [-1, -1], "l-grow": [-1, -1] };
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; el.style.visibility = el.getBoundingClientRect().top < titleBottom() + 6 ? "hidden" : ""; } };   // a label never sits on the title
const titleBottom = () => { const hd = document.querySelector("header"); return hd ? hd.getBoundingClientRect().bottom : 0; };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // shot 0: one drop, a few loosest plates shed (the dose). shot 1: a drop every 0.9 s, the plates go, shine and red build. shot 2: rest, they grow back.
  const dose = i === 0 ? E.out(seg(lt, 1.6, 4.0)) : 1;
  const over = i === 1 ? E.lin(seg(lt, 0.6, 6.4)) : i === 2 ? 1 : 0;
  const rest = i === 2 ? E.inout(seg(lt, 1.6, 7.0)) : 0;
  const red = i === 1 ? E.out(seg(lt, 2.4, 6.0)) : i === 2 ? 1 - E.inout(seg(lt, 1.2, 6.0)) : 0;
  const thick = (p) => {
    const shedDose = p.j < 0.22 ? dose : 0;                                   // the loosest fifth, at the dose
    const shedOver = seg(over, p.k * 0.8, p.k * 0.8 + 0.2);                   // then all of them, in order
    const gone = Math.max(shedDose, shedOver);
    const back = rest * (0.7 + 0.3 * p.j);
    return Math.max(0, Math.min(1, 1 - gone + back));
  };
  layPlates(thick, red);
  plateMat.roughness = 0.85 - 0.7 * over * (1 - rest) ;                      // plastic shine, then matte again
  plateMat.color.set(0xe9d5c8).lerp(new THREE.Color(0xfff3ea), over * (1 - rest) * 0.6);
  // drops: one in shot 0, a run of them in shot 1
  drops.forEach((d) => {
    let on = false, f = 0, sp = 0, fade = 0;
    if (i === 0 && d.k === 0) { on = lt > 0.6 && lt < 3.0; f = E.in(seg(lt, 0.6, 1.4)); sp = seg(lt, 1.4, 2.1); fade = seg(lt, 2.3, 3.0); }
    if (i === 1 && d.k > 0) { const t0 = 0.2 + (d.k - 1) * 0.85; on = lt > t0 && lt < t0 + 2.2; f = E.in(seg(lt, t0, t0 + 0.7)); sp = seg(lt, t0 + 0.7, t0 + 1.3); fade = seg(lt, t0 + 1.5, t0 + 2.2); }
    d.m.visible = on; if (!on) return;
    d.m.position.set(d.x, 22 - 10.2 * f, d.z); d.m.scale.set(1 + 1.2 * sp, 1 - 0.65 * sp, 1 + 1.2 * sp); d.m.material.opacity = 0.9 * (1 - fade);
  });
  sparks.forEach((sk) => { const on = red > 0.35 && (i === 1 || (i === 2 && lt < 2.5)); sk.m.visible = on; if (!on) return; const ph = (t * 0.7 + sk.k * 0.055) % 1; sk.m.position.set(sk.x, 11.6 + ph * 2.4, sk.z); sk.m.rotation.set(ph * 5, sk.k, ph * 3); sk.m.material.opacity = Math.sin(ph * Math.PI) * red; sk.m.scale.setScalar(0.6 + 0.6 * ph); });
  cream.visible = i === 2 && lt > 0.3;
  if (cream.visible) { const p = E.out(seg(lt, 0.3, 1.3)); cream.position.y = 14 - 2.2 * p; cream.material.opacity = 0.85 * Math.min(1, p * 1.5) * (1 - 0.5 * seg(lt, 6.5, 8.5)); }
  // labels, the week chips, the day counter (DOM)
  const $ = M.$;
  if (i === 0) { enter($("#l-dead"), lt, 0.3, { y: 8 }); enter($("#l-acid"), lt, 1.0, { y: 8 }); if (lt > 3.4) $("#l-acid").style.opacity = 1 - seg(lt, 3.4, 3.9); enter($("#l-fresh"), lt, 3.6, { y: 8 }); enter($("#week3"), lt, 4.2, { y: 10 }); $("#w-tu").classList.toggle("on", lt > 4.6); $("#w-fr").classList.toggle("on", lt > 5.1); }
  if (i === 1) { enter($("#week3b"), lt, 0.2, { y: 10 }); enter($("#l-shine"), lt, 3.0, { y: 8 }); enter($("#l-sting"), lt, 4.4, { y: 8 }); }
  if (i === 2) { enter($("#l-cream"), lt, 1.2, { y: 8 }); enter($("#l-grow"), lt, 3.8, { y: 8 }); enter($("#dayc"), lt, 1.6, { y: 10 }); $("#dayn").textContent = Math.round(14 * E.lin(seg(lt, 1.8, 7.0))); enter($("#note3"), lt, 7.2, { y: 10 }); }
  renderer.render(scene, camera);
};
`
  },

  /* ───────── 5-1 Vitamin C: the morning antioxidant, and the bottle that turns brown ───────── */
  "5-1": {
    id: "5-1", kicker: "Vitamin C", title: `Vitamin C works in the morning, <span class="grad">under your sunscreen.</span>`, dur: 22, poster: 9,
    shots: [
      { at: 0, name: "radicals", cap: "Daylight and city air make free radicals: unstable bits that bounce around the skin and chip at collagen. Sunscreen stops most, not all." },
      { at: 7, name: "serum", cap: "Vitamin C in the morning catches the rest: an antioxidant, on clean skin, before moisturizer and sunscreen. L-ascorbic acid at 10 to 20% is the most studied form." },
      { at: 14, name: "brown", cap: "It oxidizes. Pale straw is fresh; dark orange or brown is past its best. Keep it cool, dark and closed. A slight tingle is normal; burning is not." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.bottle5 { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: flex-end; gap: 1.6vmin; opacity: 0; }
.bottle5 .vial { position: relative; width: 7vmin; height: 16vmin; border-radius: 1.4vmin 1.4vmin 2.4vmin 2.4vmin; border: .3vmin solid rgba(255,255,255,.35); overflow: hidden; background: rgba(255,255,255,.04); }
.bottle5 .vial::before { content: ""; position: absolute; left: 2vmin; right: 2vmin; top: -1.6vmin; height: 2.4vmin; border-radius: .6vmin; background: #2a2a2e; }
.bottle5 .juice { position: absolute; left: 0; right: 0; bottom: 0; height: 78%; background: #f3e3a0; }
.bottle5 .txt { font-size: 2.3vmin; line-height: 1.3; color: #d9d9de; max-width: 30vmin; } .bottle5 .txt b { display: block; font-size: 2.7vmin; color: #fff; }
.order5 { position: absolute; left: 0; bottom: 2vmin; display: flex; gap: .8vmin; opacity: 0; }
.order5 span { padding: 1vmin 1.6vmin; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); font-size: 2.1vmin; font-weight: 600; color: #d9d9de; }
.order5 span.c { background: #ffc46b; color: #1a1210; border-color: #ffc46b; }`,
    html: `
<section class="shot"><span class="lab3" id="l-rad"><i style="background:#ff6a5a"></i>free radicals</span><span class="lab3" id="l-col"><i style="background:#b77a80"></i>collagen, chipped</span><span class="lab3" id="l-spf"><i style="background:#f6f0e8"></i>sunscreen stops most</span></section>
<section class="shot"><span class="lab3" id="l-c"><i style="background:#ffc46b"></i>vitamin C, on clean skin</span><span class="lab3" id="l-catch"><i style="background:#ffc46b"></i>caught before they land</span><div class="order5" id="order5"><span>cleanser</span><span class="c">vitamin C</span><span>moisturizer</span><span>sunscreen</span></div></section>
<section class="shot"><span class="lab3" id="l-fresh"><i style="background:#f3e3a0"></i>pale straw: fresh</span><span class="lab3" id="l-old"><i style="background:#8a4a1c"></i>brown: past its best</span><div class="bottle5" id="bottle5"><div class="vial"><div class="juice" id="juice"></div></div><div class="txt"><b id="vialn">week 1</b>cool, dark, closed</div></div></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((((x >>> 16) ^ x) / 4294967296) % 1 + 1) % 1; };
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(portrait ? 46 : 34, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.85));
const key = new THREE.DirectionalLight(0xfff4ea, 2.0); key.position.set(-14, 20, 10); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; key.shadow.camera.near = 1; key.shadow.camera.far = 70; key.shadow.bias = -0.0008;
scene.add(key);
const fill2 = new THREE.DirectionalLight(0xffc46b, 0.35); fill2.position.set(12, 6, -8); scene.add(fill2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block: epidermis on top, collagen (dermis) below
const NY = 12, NZ = 9, cells = [];
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  const i = x * 1000 + y * 20 + z, v = hash(i) * 0.08 - 0.04;
  let c;
  if (y >= 9) c = new THREE.Color(0xe9c4b4).offsetHSL(0, 0, v + (y === 11 ? 0.04 : 0));
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  cells.push({ x, y, z, c, base: c.clone(), wx: x + 0.5, wz: z + 0.5 - NZ / 2, j: hash(i + 9) });
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const block = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 }), cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
cells.forEach((c, i) => { dummy.position.set(c.wx, c.y, c.wz); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
// the sun and the sunscreen film
const sun = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
sun.position.set(-12.5, 19, 3); scene.add(sun);
const sunGlow = new THREE.PointLight(0xffd27a, 40, 60, 1.6); sunGlow.position.copy(sun.position); scene.add(sunGlow);
const shield = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.5, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xf6f0e8, roughness: 0.3, transmission: 0.35, opacity: 0.75, transparent: true }));
shield.position.set(0, 12.1, 0); shield.castShadow = true; shield.visible = false; scene.add(shield);
// free radicals: spiky red bits that fly in from the light and chip at the collagen on the cut face
const radGeo = new THREE.OctahedronGeometry(0.3), radMat = new THREE.MeshStandardMaterial({ color: 0xff6a5a, emissive: 0x8a1a12, emissiveIntensity: 0.8, roughness: 0.4, transparent: true, opacity: 1 });
const CZ = NZ / 2 + 0.4;
const rads = Array.from({ length: 16 }, (_, k) => { const m = new THREE.Mesh(radGeo, radMat.clone()); m.visible = false; scene.add(m); return { m, k, x: -6.5 + hash(k + 20) * 13, y0: 13.8 + hash(k + 21) * 2.2, y1: 3.5 + hash(k + 22) * 5, ph: hash(k + 23) }; });   // they start just above the block, under the title
// chipped collagen: cells on the cut face near where radicals landed go dark and shrink a little
const hits = rads.map((r) => ({ x: r.x, y: r.y1 }));
const TIRED = new THREE.Color(0x6e4348), tmp = new THREE.Color();
const paint = (dmg) => {
  cells.forEach((c, i) => {
    if (c.z !== NZ - 1 || c.y < 3 || c.y > 8) return;
    let k = 0;
    hits.forEach((h, j) => { const d = Math.hypot(c.wx - h.x, c.y - h.y); if (d < 1.6) k = Math.max(k, dmg[j] * (1 - d / 1.6)); });
    tmp.copy(c.base).lerp(TIRED, Math.min(1, k)); block.setColorAt(i, tmp);
    dummy.position.set(c.wx, c.y, c.wz); dummy.scale.setScalar(1 - 0.14 * Math.min(1, k)); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix);
  });
  block.instanceColor.needsUpdate = true; block.instanceMatrix.needsUpdate = true;
};
// the vitamin C: an amber drop that spreads into a thin glow over the surface; radicals that reach it fizzle
const drop = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xffc46b, roughness: 0.15, transmission: 0.2, opacity: 0.95, transparent: true }));
drop.visible = false; drop.castShadow = true; scene.add(drop);
const glow = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.36, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xffc46b, roughness: 0.2, emissive: 0x7a4a10, emissiveIntensity: 0.5, opacity: 0.0, transparent: true }));
glow.position.set(0, 11.75, 0); scene.add(glow);
const fizzGeo = new THREE.SphereGeometry(0.12, 8, 6), fizzMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 1 });
const fizz = Array.from({ length: 24 }, (_, k) => { const m = new THREE.Mesh(fizzGeo, fizzMat.clone()); m.visible = false; scene.add(m); return { m, k, r: rads[k % rads.length], a: hash(k + 50) * 6.28 }; });
const look = new THREE.Vector3(0, 8, 0);
const place = (t) => (place.d || (place.d = direct(camera, look, 0.5, ANCHOR, portrait)))(t);   // directed: see direct() in studio3d.js
const ANCHOR = { "l-rad": [-7, 15.5, 3], "l-col": [-2, 5.5, 4.6], "l-spf": [7.5, 12.8, 1.5], "l-c": [7.5, 13.2, 1.5], "l-catch": [-3, 13.4, 4.2], "l-fresh": [7.5, 12.8, 1.5], "l-old": [7.5, 12.8, 1.5] };
const OFF = { "l-rad": [1, -1], "l-col": [1, 0], "l-spf": [-1, -1], "l-c": [-1, -1], "l-catch": [-1, -1], "l-fresh": [-1, -1], "l-old": [-1, -1] };
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; el.style.visibility = el.getBoundingClientRect().top < titleBottom() + 6 ? "hidden" : ""; } };   // a label never sits on the title
const titleBottom = () => { const hd = document.querySelector("header"); return hd ? hd.getBoundingClientRect().bottom : 0; };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // the shield is on from 4 s of shot 0; the vitamin C from 2 s of shot 1
  const shieldOn = i === 0 ? E.out(seg(lt, 4.0, 5.0)) : 1;
  shield.visible = shieldOn > 0.01; shield.material.opacity = 0.75 * shieldOn; shield.scale.set(1, Math.max(0.02, shieldOn), 1);
  const cOn = i === 1 ? E.out(seg(lt, 2.2, 3.4)) : i === 2 ? 1 : 0;
  glow.material.opacity = 0.7 * cOn; glow.material.emissiveIntensity = 0.5 + 0.4 * Math.sin(t * 3) * cOn;
  drop.visible = i === 1 && lt > 1.0 && lt < 3.4;
  if (drop.visible) { const f = E.in(seg(lt, 1.0, 1.9)), sp = seg(lt, 1.9, 2.8), fade = seg(lt, 2.8, 3.4); drop.position.set(-1, 22 - 9.6 * f, 1); drop.scale.set(1 + 2.2 * sp, 1 - 0.7 * sp, 1 + 2.2 * sp); drop.material.opacity = 0.95 * (1 - fade); }
  // radicals: before the shield they all go in; with the shield most bounce (fewer get through); with vitamin C the rest fizzle at the glow
  const dmg = rads.map(() => 0);
  rads.forEach((r, k) => {
    const speed = 0.22, ph = (t * speed + r.ph) % 1;
    const through = shieldOn < 0.5 ? true : (k % 4 === 0);           // a quarter slip past the sunscreen
    const stopY = cOn > 0.5 ? 12.2 : r.y1;
    const y = r.y0 - (r.y0 - stopY) * E.lin(ph);
    const arrived = through && ph > 0.92;
    r.m.visible = i < 3 && (through ? ph < 0.95 : ph < 0.6);
    const bounce = !through && ph > 0.45 ? (ph - 0.45) * 8 : 0;
    r.m.position.set(r.x + Math.sin(t * 6 + k) * 0.25, through ? y : Math.max(12.6, r.y0 - (r.y0 - 12.6) * (ph / 0.45) + bounce), CZ + (through ? 0 : 0.3));
    r.m.rotation.set(t * 5 + k, t * 3, 0); r.m.material.opacity = through ? 1 : 1 - seg(ph, 0.45, 0.6);
    if (through && cOn < 0.5) dmg[k] = i === 0 ? Math.min(1, 0.3 + 0.7 * seg(lt, 1.5 + k * 0.3, 5.5 + k * 0.3)) : 1;
    else if (through) dmg[k] = i === 1 ? 1 - 0.35 * cOn : 0.65;
  });
  paint(dmg);
  fizz.forEach((f) => { const on = cOn > 0.5 && (f.r.k % 4 === 0); f.m.visible = on; if (!on) return; const ph = (t * 1.3 + f.k * 0.07) % 1; f.m.position.set(f.r.x + Math.cos(f.a + ph * 4) * ph * 1.4, 12.3 + ph * 1.6, CZ + Math.sin(f.a) * 0.4); f.m.material.opacity = 1 - ph; f.m.scale.setScalar(1 - 0.6 * ph); });
  // labels, the order chips, the vial (DOM)
  const $ = M.$;
  if (i === 0) { enter($("#l-rad"), lt, 0.6, { y: 8 }); enter($("#l-col"), lt, 2.6, { y: 8 }); enter($("#l-spf"), lt, 4.4, { y: 8 }); }
  if (i === 1) { enter($("#l-c"), lt, 1.4, { y: 8 }); enter($("#l-catch"), lt, 3.2, { y: 8 }); enter($("#order5"), lt, 4.4, { y: 10 }); }
  if (i === 2) {
    enter($("#bottle5"), lt, 0.4, { y: 10 }); enter($("#l-fresh"), lt, 0.8, { y: 8 }); if (lt > 3.6) $("#l-fresh").style.opacity = 1 - seg(lt, 3.6, 4.1);
    const age = E.lin(seg(lt, 1.6, 6.0));                                  // straw → orange → brown over the weeks
    const col = age < 0.5 ? M.lerpColor([243, 227, 160], [232, 154, 60], age * 2) : M.lerpColor([232, 154, 60], [122, 63, 20], (age - 0.5) * 2);
    $("#juice").style.background = col; $("#vialn").textContent = "week " + (1 + Math.round(11 * age));
    enter($("#l-old"), lt, 4.2, { y: 8 });
  }
  renderer.render(scene, camera);
};
`
  },

  /* ───────── 9-3 Heat, light and patience: why a dark spot is slow ───────── */
  "9-3": {
    id: "9-3", kicker: "Heat, light and patience", title: `Why a dark spot takes <span class="grad">months, not weeks.</span>`, dur: 24, poster: 9,
    shots: [
      { at: 0, name: "made", cap: "A dark spot starts at the bottom of the epidermis: UV, heat or a breakout tells the pigment cells there to make more melanin and hand it up." },
      { at: 7, name: "rises", cap: "The cells holding it take about a month to climb to the surface and shed. Each cycle carries a little out. Fading is measured in months." },
      { at: 15, name: "guard", cap: "SPF every morning (tinted mineral for melasma) and no heat keep it from restarting. Vitamin C by day, azelaic acid or a retinoid at night, speed the fade." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.dayc { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; opacity: 0; }
.dayc b { font-size: 7vmin; font-weight: 700; letter-spacing: -.03em; } .dayc span { font-size: 2.6vmin; color: #a1a1a6; }
.note3 { position: absolute; left: 0; bottom: 2vmin; max-width: 64vmin; font-size: 2.5vmin; line-height: 1.4; color: #d9d9de; opacity: 0; }`,
    html: `
<section class="shot"><span class="lab3" id="l-uv"><i style="background:#ffd27a"></i>UV, heat, a breakout</span><span class="lab3" id="l-mel"><i style="background:#4a2a1c"></i>pigment cells, at the bottom</span><span class="lab3" id="l-gran"><i style="background:#3b2418"></i>melanin, handed up</span><span class="lab3" id="l-spot"><i style="background:#6b3f2e"></i>the spot you see</span></section>
<section class="shot"><span class="lab3" id="l-shed"><i style="background:#e9c4b4"></i>about a month per cycle</span><span class="lab3" id="l-less"><i style="background:#8f6a5c"></i>a little lighter each time</span><div class="dayc" id="dayc"><b id="dayn">0</b><span>days</span></div></section>
<section class="shot"><span class="lab3" id="l-spf"><i style="background:#f6f0e8"></i>SPF every morning, tinted mineral</span><span class="lab3" id="l-heat"><i style="background:#ffb067"></i>no saunas, hot yoga, hot stove</span><span class="lab3" id="l-bright"><i style="background:#ffc46b"></i>vitamin C · azelaic acid · retinoid</span><div class="dayc" id="dayc2"><b id="dayn2">56</b><span>days</span></div><p class="note3" id="note3">Same spot, same light, a photo every four weeks: that's how you see it move.</p></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((x >>> 16) ^ x) / 4294967296 % 1; };
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(portrait ? 46 : 34, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.85));
const key = new THREE.DirectionalLight(0xfff4ea, 2.0); key.position.set(-14, 20, 10); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; key.shadow.camera.near = 1; key.shadow.camera.far = 70; key.shadow.bias = -0.0008;
scene.add(key);
const fill2 = new THREE.DirectionalLight(0xf4c9d6, 0.45); fill2.position.set(12, 6, -8); scene.add(fill2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block: epidermis is the top three rows (9, 10, 11); the pigment cells sit in row 9, on the cut face
const NY = 12, NZ = 9, cells = [];
const CX = -1.5, CZ = NZ / 2 - 0.5;            // the spot's centre, on the face toward the camera
const MEL = [[-3, 8], [-2, 8], [-1, 8], [-2, 7]];   // pigment cells: (x, z) in row 9
const isMel = (x, y, z) => y === 9 && MEL.some(([a, b]) => a === x && b === z);
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  const i = cells.length, v = hash(i) * 0.08 - 0.04;
  let c;
  if (isMel(x, y, z)) c = new THREE.Color(0x4a2a1c);
  else if (y >= 9) c = new THREE.Color(0xe9c4b4).offsetHSL(0, 0, v + (y === 11 ? 0.04 : 0));
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  const wx = x + 0.5, wz = z + 0.5 - NZ / 2;
  cells.push({ x, y, z, c, base: c.clone(), wx, wz, mel: isMel(x, y, z), d: Math.hypot(wx - CX, wz - CZ) });
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const block = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 }), cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
cells.forEach((c, i) => { dummy.position.set(c.wx, c.y, c.wz); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
// the pigment cells glow when they're told to make more
const melGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
const melMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1c, emissive: 0x9a5a2c, emissiveIntensity: 0, roughness: 0.5 });
const mels = MEL.map(([x, z]) => { const m = new THREE.Mesh(melGeo, melMat); m.position.set(x + 0.5, 9, z + 0.5 - NZ / 2); m.castShadow = true; scene.add(m); return m; });
// melanin, handed up: little grains that ride from a pigment cell to the cells above it
const grainGeo = new THREE.SphereGeometry(0.15, 10, 8), grainMat = new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.5 });
const grains = Array.from({ length: 14 }, (_, k) => {
  const m = new THREE.Mesh(grainGeo, grainMat); m.visible = false; scene.add(m);
  const [mx, mz] = MEL[k % MEL.length];
  return { m, k, from: new THREE.Vector3(mx + 0.5, 9.3, mz + 0.5 - NZ / 2 + 0.35), to: new THREE.Vector3(CX + (hash(k + 40) - 0.5) * 3.6, 10.6 + hash(k + 41) * 1.2, CZ + 0.45 - hash(k + 42) * 1.4) };
});
// the sun, its ray, the shield (shot 2) and the two drops
const sun = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
const SUN = new THREE.Vector3(-12.5, 19, 3); sun.position.copy(SUN); scene.add(sun);
const sunGlow = new THREE.PointLight(0xffd27a, 50, 60, 1.6); sunGlow.position.copy(SUN); scene.add(sunGlow);
const HIT = new THREE.Vector3(CX, 11.5, CZ - 1.2);
const rayGeo = new THREE.CylinderGeometry(0.16, 0.16, 3.2, 8);
const up = new THREE.Vector3(0, 1, 0);
const mkRay = (dir) => { const m = new THREE.Mesh(rayGeo, new THREE.MeshBasicMaterial({ color: 0xffdd8a, transparent: true, opacity: 1 })); m.quaternion.setFromUnitVectors(up, dir); m.visible = false; scene.add(m); return m; };
const dir = HIT.clone().sub(SUN), len = dir.length(); dir.normalize();
const refl = dir.clone().reflect(up);
const ray = mkRay(dir), rayIn = mkRay(dir), rayOut = mkRay(refl); rayIn.scale.set(0.7, 1, 0.7);
const shield = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.7, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xf1e2d2, roughness: 0.3, transmission: 0.3, opacity: 0.85, transparent: true }));
shield.position.set(0, 12.2, 0); shield.castShadow = true; shield.visible = false; scene.add(shield);
const dropC = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xffc46b, roughness: 0.2, opacity: 0.9, transparent: true }));
const dropN = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xf4c9d6, roughness: 0.2, opacity: 0.9, transparent: true }));
dropC.visible = dropN.visible = false; dropC.castShadow = dropN.castShadow = true; scene.add(dropC, dropN);
// heat: a warm haze that is shown, then crossed out by the label (shot 2 only names it)
const BROWN = new THREE.Color(0x5a3324), tmp = new THREE.Color();
// stain per cell: how much melanin it holds; rows fill from the bottom up as it is handed up
const paint = (amt, rise, ph, shedK) => {
  cells.forEach((c, i) => {
    const top = c.y === 11;
    let changed = false;
    if (c.y >= 9 && !c.mel && c.d < 2.6) {
      const rowGate = seg(rise, (c.y - 9) / 3, (c.y - 9) / 3 + 0.34);
      const k = amt * rowGate * Math.max(0, 1 - 0.55 * c.d / 2.6) * (top ? 1 : c.y === 10 ? 0.85 : 0.55);
      tmp.copy(c.base).lerp(BROWN, Math.min(1, k)); block.setColorAt(i, tmp); changed = true;
    } else if (c.y >= 9) { block.setColorAt(i, c.base); }
    if (top) {
      // the surface sheds: late in each cycle the top row lifts and thins away
      const lift = 0.9 * E.in(seg(ph, 0.55, 1)) * shedK, sc = 1 - 0.95 * E.in(seg(ph, 0.72, 1)) * shedK;
      dummy.position.set(c.wx, c.y + lift, c.wz); dummy.scale.set(1, Math.max(0.05, sc), 1); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); changed = true;
    }
  });
  block.instanceColor.needsUpdate = true; block.instanceMatrix.needsUpdate = true;
};
const look = new THREE.Vector3(0, 8, 0);
const place = (t) => (place.d || (place.d = direct(camera, look, 0.5, ANCHOR, portrait)))(t);   // directed: see direct() in studio3d.js
const ANCHOR = { "l-uv": [-9, 16.5, 4], "l-mel": [-1.2, 9, 4.6], "l-gran": [0.6, 10.6, 4.6], "l-spot": [-1.5, 12.3, 2.4], "l-shed": [5, 13.2, 0], "l-less": [-2.5, 12.4, 4.2], "l-spf": [6.5, 12.7, 4.5], "l-heat": [-7, 14.8, 3], "l-bright": [0.5, 15.6, 1.5] };
const OFF = { "l-uv": [1, -1], "l-mel": [1, 0], "l-gran": [1, -1], "l-spot": [-1, -1], "l-shed": [1, -1], "l-less": [-1, 0], "l-spf": [1, 0], "l-heat": [1, -1], "l-bright": [1, portrait ? 0 : -1] };   // upright, the two heat-and-brightening labels meet: the second sits level with its point instead
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; el.style.visibility = el.getBoundingClientRect().top < titleBottom() + 6 ? "hidden" : ""; } };   // a label never sits on the title
const titleBottom = () => { const hd = document.querySelector("header"); return hd ? hd.getBoundingClientRect().bottom : 0; };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // shot 0: the ray lands, the pigment cells light up, the grains rise, the spot shows
  const made = i === 0 ? E.out(seg(lt, 1.0, 1.8)) : 1;
  const making = i === 0 ? made : i === 1 ? 0.45 : 0.45 * (1 - E.out(seg(lt, 0.4, 1.4)));
  melMat.emissiveIntensity = 1.6 * making;
  const rise = i === 0 ? E.lin(seg(lt, 1.6, 5.6)) : 1;
  // cycles of turnover: two in shot 1 (a month each), three more in shot 2, faster with the brighteners
  const cycles = i === 0 ? 0 : i === 1 ? lt / 4 : 2 + lt / 3;
  const ph = cycles % 1, shedK = i === 0 ? 0 : 1;
  const bright = i === 2 ? 0.5 * seg(lt, 3.6, 8.5) : 0;
  const amt = (i === 0 ? 1 : Math.pow(0.85, cycles)) * (1 - bright);
  paint(amt, rise, ph, shedK);
  grains.forEach((g) => { const on = making > 0.05 && (i > 0 || lt > 1.5); const p = (t * 0.36 + g.k * 0.071) % 1; g.m.visible = on && p < 0.92; g.m.position.lerpVectors(g.from, g.to, E.inout(p)); g.m.scale.setScalar(0.6 + 0.6 * Math.sin(p * Math.PI) * Math.min(1, making * 2)); });
  // the ray: once in shot 0 (it goes in), on repeat in shot 2 (it bounces off the shield)
  const shieldOn = i === 2 ? E.out(seg(lt, 0.3, 1.2)) : 0;
  shield.visible = shieldOn > 0.01; shield.scale.set(1, Math.max(0.02, shieldOn), 1); shield.position.y = 12.0 + 0.35 * shieldOn; shield.material.opacity = 0.85 * shieldOn;
  const rayPh = i === 0 ? seg(lt, 0.2, 1.1) : i === 2 ? (t * 0.42) % 1 : 2;
  const hitPh = 0.86;
  ray.visible = rayPh < hitPh; ray.position.copy(SUN).addScaledVector(dir, len * rayPh);
  const past = (rayPh - hitPh) / (1 - hitPh);
  rayIn.visible = i === 0 && rayPh >= hitPh && rayPh <= 1; if (rayIn.visible) { rayIn.position.copy(HIT).addScaledVector(dir, past * 5); rayIn.material.opacity = 0.95 * (1 - past); }
  rayOut.visible = i === 2 && rayPh >= hitPh && shieldOn > 0.45; if (rayOut.visible) { rayOut.position.copy(HIT).addScaledVector(refl, past * 7); rayOut.material.opacity = 0.95 * (1 - past * 0.7); }
  // the drops, shot 2: vitamin C by day, the night one after
  const drop = (m, t0) => { m.visible = i === 2 && lt > t0 && lt < t0 + 2.6; if (m.visible) { const f = E.in(seg(lt, t0, t0 + 0.8)), s = seg(lt, t0 + 0.8, t0 + 1.5), fade = seg(lt, t0 + 1.8, t0 + 2.6); m.position.set(CX + (m === dropN ? 1.6 : -0.6), 22.5 - 9.6 * f, CZ - 1.5); m.scale.set(1 + 0.8 * s, 1 - 0.6 * s, 1 + 0.8 * s); m.material.opacity = 0.9 * (1 - fade); } };
  drop(dropC, 3.4); drop(dropN, 5.0);
  // labels and the day counter (DOM)
  const $ = M.$;
  if (i === 0) { enter($("#l-uv"), lt, 0.4, { y: 8 }); if (lt > 3.2) $("#l-uv").style.opacity = 1 - seg(lt, 3.2, 3.7); enter($("#l-mel"), lt, 1.6, { y: 8 }); enter($("#l-gran"), lt, 2.8, { y: 8 }); enter($("#l-spot"), lt, 5.0, { y: 8 }); }
  if (i === 1) { enter($("#l-shed"), lt, 1.2, { y: 8 }); enter($("#l-less"), lt, 4.6, { y: 8 }); enter($("#dayc"), lt, 0.3, { y: 10 }); $("#dayn").textContent = Math.round(56 * E.lin(seg(lt, 0.4, 7.6))); }
  if (i === 2) { enter($("#l-spf"), lt, 1.3, { y: 8 }); enter($("#l-heat"), lt, 2.4, { y: 8 }); enter($("#l-bright"), lt, 4.2, { y: 8 }); enter($("#dayc2"), lt, 0.2, { y: 10 }); $("#dayn2").textContent = Math.round(56 + 64 * E.lin(seg(lt, 0.3, 6.8))); enter($("#note3"), lt, 6.6, { y: 10 }); }
  renderer.render(scene, camera);
};
`
  },

  /* ───────── 10-1 The sun, and the shield ───────── */
  "10-1": {
    id: "10-1", kicker: "What actually ages skin", title: `The sun does most of it. <span class="grad">SPF is the shield.</span>`, dur: 22, poster: 12,
    shots: [
      { at: 0, name: "bare", cap: "UV goes past the surface to the dermis, where collagen lives. The dark spots and the lines add up over years." },
      { at: 7, name: "shield", cap: "Sunscreen is a shield on top. Enough of it, every morning, broad spectrum, SPF 30 or more, and most of the UV never gets in." },
      { at: 14, name: "wears", cap: "It wears off. Outside, reapply every two hours, sooner after sweat or water. Makeup with SPF is a top-up, not the base." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.clock3 { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; opacity: 0; }
.clock3 b { font-size: 7vmin; font-weight: 700; letter-spacing: -.03em; } .clock3 span { font-size: 2.6vmin; color: #a1a1a6; }`,
    html: `
<section class="shot"><span class="lab3" id="l-uv"><i style="background:#ffd27a"></i>UV</span><span class="lab3" id="l-col"><i style="background:#b77a80"></i>collagen, in the dermis</span><span class="lab3" id="l-spot"><i style="background:#6b3f2e"></i>a dark spot, years later</span></section>
<section class="shot"><span class="lab3" id="l-spf"><i style="background:#f6f0e8"></i>sunscreen, enough of it</span><span class="lab3" id="l-bounce"><i style="background:#ffd27a"></i>reflected and absorbed</span></section>
<section class="shot"><span class="lab3" id="l-thin"><i style="background:#f6f0e8"></i>two hours in: thinning</span><span class="lab3" id="l-re"><i style="background:#f4c9d6"></i>reapply</span><div class="clock3" id="clock3"><b id="clockn">0:00</b><span>outside</span></div></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((x >>> 16) ^ x) / 4294967296 % 1; };
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(portrait ? 46 : 34, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.85));
const key = new THREE.DirectionalLight(0xfff4ea, 2.0); key.position.set(-14, 20, 10); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; key.shadow.camera.near = 1; key.shadow.camera.far = 70; key.shadow.bias = -0.0008;
scene.add(key);
const fill2 = new THREE.DirectionalLight(0xf4c9d6, 0.45); fill2.position.set(12, 6, -8); scene.add(fill2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block of skin: epidermis on top, dermis (collagen) below, fat at the base
const NY = 12, NZ = 9, cells = [];
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  const i = cells.length, v = hash(i) * 0.08 - 0.04;
  let c;
  if (y >= 9) c = new THREE.Color(0xe9c4b4).offsetHSL(0, 0, v + (y === 11 ? 0.04 : 0));
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  cells.push({ x, y, z, c, base: c.clone() });
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const block = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 }), cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
cells.forEach((c, i) => { dummy.position.set(c.x + 0.5, c.y, c.z + 0.5 - NZ / 2); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
// the sun, up and to the left; the rays land on the surface at these spots
const sun = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
const SUN = new THREE.Vector3(-12.5, 18.5, 2); sun.position.copy(SUN); scene.add(sun);
const sunGlow = new THREE.PointLight(0xffd27a, 60, 60, 1.6); sunGlow.position.copy(SUN); scene.add(sunGlow);
const HITS = [[-4.5, 2.5], [-1.5, -1.5], [1.5, 3.0], [4.0, 0.5], [-3.0, -2.8], [3.5, -3.0], [0.5, 0.8]].map(([x, z]) => new THREE.Vector3(x, 11.5, z));
const rayGeo = new THREE.CylinderGeometry(0.16, 0.16, 3.2, 8);
const rayMat = new THREE.MeshBasicMaterial({ color: 0xffdd8a, transparent: true, opacity: 1 });
const up = new THREE.Vector3(0, 1, 0);
const rays = HITS.map((hit, k) => {
  const dir = hit.clone().sub(SUN), len = dir.length(); dir.normalize();
  const m = new THREE.Mesh(rayGeo, rayMat.clone()); m.quaternion.setFromUnitVectors(up, dir); scene.add(m);
  const refl = dir.clone().reflect(up);   // off the shield, back up
  const inner = new THREE.Mesh(rayGeo, rayMat.clone()); inner.quaternion.setFromUnitVectors(up, dir); inner.scale.set(0.7, 1, 0.7); scene.add(inner);
  const bounce = new THREE.Mesh(rayGeo, rayMat.clone()); bounce.quaternion.setFromUnitVectors(up, refl); scene.add(bounce);
  return { hit, dir, len, refl, m, inner, bounce, k };
});
// the shield: a thin translucent slab over the surface
const shield = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.7, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xf6f0e8, roughness: 0.25, transmission: 0.35, opacity: 0.8, transparent: true }));
shield.position.set(0, 12.2, 0); shield.castShadow = true; shield.visible = false; scene.add(shield);
// damage: a dark spot on the surface and tired collagen under each hit
const BROWN = new THREE.Color(0x6b3f2e), TIRED = new THREE.Color(0x6e4348);
const tmp = new THREE.Color();
const near = cells.map((c) => HITS.map((h) => Math.hypot(c.x + 0.5 - h.x, c.z + 0.5 - NZ / 2 - h.z)));
let damage = HITS.map(() => 0);
const paint = () => {
  cells.forEach((c, i) => {
    if (c.y < 3) return;
    let k = 0;
    near[i].forEach((d, j) => { const r = c.y === 11 ? 1.7 : 2.1; if (d < r) k = Math.max(k, damage[j] * (1 - 0.6 * d / r)); });
    if (k <= 0) return;
    tmp.copy(c.base).lerp(c.y >= 9 ? BROWN : TIRED, Math.min(1, k * (c.y >= 9 ? 1.0 : 0.6)));
    block.setColorAt(i, tmp);
    if (c.y < 9) { dummy.position.set(c.x + 0.5, c.y, c.z + 0.5 - NZ / 2); dummy.scale.setScalar(1 - 0.12 * k); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); }
  });
  block.instanceColor.needsUpdate = true; block.instanceMatrix.needsUpdate = true;
};
const look = new THREE.Vector3(0, 8, 0);
const place = (t) => (place.d || (place.d = direct(camera, look, 0.5, ANCHOR, portrait)))(t);   // directed: see direct() in studio3d.js
const ANCHOR = { "l-uv": [-9, 16.5, 4], "l-col": [5.5, 6, 4.5], "l-spot": [-4.5, 12.4, 3], "l-spf": [6.5, 12.6, 4.5], "l-bounce": [-3, 15.5, 4], "l-thin": [6.5, 12.6, 4.5], "l-re": [-5, 13.2, 4.5] };
const OFF = { "l-uv": [1, -1], "l-col": [-1, 0], "l-spot": [1, -1], "l-spf": [-1, 0], "l-bounce": [1, -1], "l-thin": [-1, 0], "l-re": [1, -1] };   // directed: the right-hand labels sit left of their points, clear of the edge and the clock
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; el.style.visibility = el.getBoundingClientRect().top < titleBottom() + 6 ? "hidden" : ""; } };   // a label never sits on the title
const titleBottom = () => { const hd = document.querySelector("header"); return hd ? hd.getBoundingClientRect().bottom : 0; };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // the shield: on in shot 1, thinning then refilled in shot 2
  const on = i >= 1 ? E.out(seg(i === 1 ? lt : 99, 0.3, 1.2)) : 0;
  let thick = i === 2 ? 1 - 0.85 * E.inout(seg(lt, 0.6, 3.6)) + 0.85 * E.out(seg(lt, 5.4, 6.4)) : i === 1 ? on : 0;
  shield.visible = thick > 0.01;
  shield.scale.set(1, Math.max(0.02, thick), 1); shield.position.y = 12.0 + 0.35 * thick;
  shield.material.opacity = 0.8 * Math.min(1, thick * 1.4);
  const guarded = thick > 0.45;
  // the rays travel from the sun; without the shield they go in, with it they bounce
  rays.forEach((r) => {
    const speed = 0.42, ph = (t * speed + r.k * 0.17) % 1, hitPh = 0.86;
    const p = r.len * ph;
    r.m.visible = ph < hitPh;
    r.m.position.copy(SUN).addScaledVector(r.dir, p);
    const past = (ph - hitPh) / (1 - hitPh);
    r.inner.visible = ph >= hitPh && !guarded;
    r.inner.position.copy(r.hit).addScaledVector(r.dir, past * 6);
    r.inner.material.opacity = 0.95 * (1 - past);
    r.bounce.visible = ph >= hitPh && guarded;
    r.bounce.position.copy(r.hit).addScaledVector(r.refl, past * 7);
    r.bounce.material.opacity = 0.95 * (1 - past * 0.7);
  });
  // damage lands in shot 0 and stays; a little more during the thin stretch of shot 2
  damage = HITS.map((_, j) => Math.min(1, E.out(seg(i === 0 ? lt : 99, 1.2 + j * 0.55, 5.2 + j * 0.55)) + (i > 0 ? 1 : 0) * (0.65 + 0.07 * j) + (i === 2 ? 0.25 * seg(lt, 2.4, 5.2) : 0)));
  paint();
  // labels and the clock (DOM)
  const $ = M.$;
  if (i === 0) { enter($("#l-uv"), lt, 0.6, { y: 8 }); enter($("#l-col"), lt, 2.2, { y: 8 }); enter($("#l-spot"), lt, 4.6, { y: 8 }); }
  if (i === 1) { enter($("#l-spf"), lt, 1.4, { y: 8 }); enter($("#l-bounce"), lt, 2.8, { y: 8 }); }
  if (i === 2) {
    enter($("#l-thin"), lt, 1.4, { y: 8 }); if (lt > 5.2) $("#l-thin").style.opacity = 1 - seg(lt, 5.2, 5.8);
    enter($("#l-re"), lt, 5.4, { y: 0, s: 0.6, d: 0.5 });
    enter($("#clock3"), lt, 0.2, { y: 10 });
    const mins = Math.round(120 * E.lin(seg(lt, 0.4, 3.6))); $("#clockn").textContent = Math.floor(mins / 60) + ":" + String(mins % 60).padStart(2, "0");
  }
  renderer.render(scene, camera);
};
`
  },
  /* ───────── 11-1 A tired barrier ───────── */
  "11-1": {
    id: "11-1", kicker: "Sensitive and rosacea-prone skin", title: `"My skin suddenly hates everything" <span class="grad">is a tired barrier.</span>`, dur: 24, poster: 10,
    shots: [
      { at: 0, name: "healthy", cap: "The barrier: skin cells are the bricks, your own oils the mortar. Water stays in, irritants stay out." },
      { at: 6, name: "wear", cap: "Too many actives, harsh cleansing, hot water, scrubbing: the mortar wears. Water leaks out, irritants get in, it stings and goes red." },
      { at: 13, name: "subtract", cap: "The fix is subtraction: a gentle fragrance-free cleanser, a moisturizer with barrier lipids, mineral SPF, actives paused. Days to weeks, it seals." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.dayc { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; opacity: 0; }
.dayc b { font-size: 7vmin; font-weight: 700; letter-spacing: -.03em; } .dayc span { font-size: 2.6vmin; color: #a1a1a6; }
.note3 { position: absolute; left: 0; bottom: 2vmin; max-width: 70vmin; font-size: 2.5vmin; line-height: 1.4; color: #ffa092; opacity: 0;
  background: rgba(24,17,16,.9); padding: 1.3vmin 2.2vmin; border-radius: 2.4vmin; box-shadow: 0 1.2vmin 3vmin rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,160,146,.18); }   /* on a card: it sits over the block, where bare text was hard to read */`,
    html: `
<section class="shot"><span class="lab3" id="l-brick"><i style="background:#e9c4b4"></i>bricks: skin cells</span><span class="lab3" id="l-mortar"><i style="background:#eab9c8"></i>mortar: your oils</span><span class="lab3" id="l-water"><i style="background:#8fd3ff"></i>water, kept in</span></section>
<section class="shot"><span class="lab3" id="l-scrub"><i style="background:#9a9a9f"></i>scrubbing</span><span class="lab3" id="l-hot"><i style="background:#ffb067"></i>hot water</span><span class="lab3" id="l-acid"><i style="background:#8fe38f"></i>one active too many</span><span class="lab3" id="l-leak"><i style="background:#8fd3ff"></i>water leaking out</span><span class="lab3" id="l-red"><i style="background:#e0574a"></i>red, stinging</span></section>
<section class="shot"><span class="lab3" id="l-cream"><i style="background:#f3e6da"></i>barrier lipids, mineral SPF</span><span class="lab3" id="l-pause"><i style="background:#8fe38f"></i>actives paused</span><div class="dayc" id="dayc"><b id="dayn">0</b><span>days</span></div><p class="note3" id="note3">Flushing with bumps across the cheeks and nose, or redness that comes with heat, alcohol or spicy food, can be rosacea: a doctor's diagnosis.</p></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((x >>> 16) ^ x) / 4294967296 % 1; };
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(portrait ? 46 : 34, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.85));
const key = new THREE.DirectionalLight(0xfff4ea, 2.0); key.position.set(10, 20, 12); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; key.shadow.camera.near = 1; key.shadow.camera.far = 70; key.shadow.bias = -0.0008;
scene.add(key);
const fill2 = new THREE.DirectionalLight(0xf4c9d6, 0.45); fill2.position.set(-12, 6, -8); scene.add(fill2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block: the top two rows are the bricks of the barrier, set a little apart so the mortar shows between them
const NY = 12, NZ = 9, cells = [];
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  const i = cells.length, v = hash(i) * 0.08 - 0.04;
  let c;
  if (y >= 10) c = new THREE.Color(0xe9c4b4).offsetHSL(0, 0, v + (y === 11 ? 0.04 : 0));
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  cells.push({ x, y, z, c, base: c.clone(), top: y === 11 });
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const block = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 }), cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
const BRICK = 0.84;
cells.forEach((c, i) => { dummy.position.set(c.x + 0.5, c.y, c.z + 0.5 - NZ / 2); dummy.scale.setScalar(c.top ? BRICK : 1); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
// the mortar: a glowing slab the bricks sit in
const mortarMat = new THREE.MeshStandardMaterial({ color: 0xeab9c8, emissive: 0xeab9c8, emissiveIntensity: 0.55, roughness: 0.5 });
const mortar = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.14, NZ + 0.2), mortarMat); mortar.position.set(0, 10.56, 0); scene.add(mortar);
// where it wears: the bricks over these spots shrink, the gaps let water out and irritants in
const GAPS = [[-5, 2.5], [-1, -1.5], [2.5, 3], [5, -0.5], [-3, -3], [1, 0.5]].map(([x, z]) => new THREE.Vector3(x, 11, z));
const gapCells = GAPS.map((g) => cells.map((c, i) => ({ c, i })).filter(({ c }) => c.top && Math.hypot(c.x + 0.5 - g.x, c.z + 0.5 - NZ / 2 - g.z) < 1.2).map(({ i }) => i));
const dropGeo = new THREE.SphereGeometry(0.24, 10, 8);
const drops = GAPS.map((g, k) => { const m = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x1b4a66, roughness: 0.3, transparent: true })); m.visible = false; scene.add(m); return m; });
const irrGeo = new THREE.IcosahedronGeometry(0.22, 0);
const irritants = GAPS.map((g, k) => { const m = new THREE.Mesh(irrGeo, new THREE.MeshStandardMaterial({ color: 0x8e8e93, roughness: 0.9, transparent: true })); m.visible = false; scene.add(m); return m; });
// the aggressors
const scrub = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: 0x9a9a9f, roughness: 0.95, flatShading: true })); scrub.castShadow = true; scrub.visible = false; scene.add(scrub);
const hot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 8, 12, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffb067, transmission: 0.4, opacity: 0.55, transparent: true, roughness: 0.2, side: THREE.DoubleSide })); hot.visible = false; scene.add(hot);
const acid = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0x8fe38f, transmission: 0.3, opacity: 0.85, transparent: true, roughness: 0.2 })); acid.castShadow = true; acid.visible = false; scene.add(acid);
// the cream: barrier lipids and mineral SPF laid on top
const cream = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.6, NZ + 0.4), new THREE.MeshPhysicalMaterial({ color: 0xf3e6da, roughness: 0.4, opacity: 0.85, transparent: true })); cream.position.set(0, 12.0, 0); cream.visible = false; cream.castShadow = true; scene.add(cream);

const RED = new THREE.Color(0xe0574a);
const tmp = new THREE.Color();
const paint = (wear) => {
  // wear: 0..1 per gap
  cells.forEach((c, i) => { if (c.top) { block.setColorAt(i, c.base); dummy.position.set(c.x + 0.5, c.y, c.z + 0.5 - NZ / 2); dummy.scale.setScalar(BRICK); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); } });
  GAPS.forEach((g, k) => {
    const w = wear[k];
    if (w <= 0) return;
    gapCells[k].forEach((i) => {
      const c = cells[i], d = Math.hypot(c.x + 0.5 - g.x, c.z + 0.5 - NZ / 2 - g.z), f = w * (1 - d / 1.4);
      tmp.copy(c.base).lerp(RED, Math.min(1, f * 1.1)); block.setColorAt(i, tmp);
      dummy.position.set(c.x + 0.5, c.y, c.z + 0.5 - NZ / 2); dummy.scale.setScalar(BRICK - 0.3 * f); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix);
    });
  });
  block.instanceColor.needsUpdate = true; block.instanceMatrix.needsUpdate = true;
};
const look = new THREE.Vector3(0, 8.5, 0);
const place = (t) => (place.d || (place.d = direct(camera, look, -0.45, ANCHOR, portrait)))(t);   // directed: see direct() in studio3d.js
const ANCHOR = { "l-brick": [-6, 12.4, 4.5], "l-mortar": [3, 10.6, 4.6], "l-water": [-3, 9.2, 4.5], "l-scrub": [-5, 13.6, 4], "l-hot": [2, 16, 2], "l-acid": [-1, 15.5, 4], "l-leak": [5.5, 14.5, 3], "l-red": [-4, 12.3, 4.5], "l-cream": [6.5, 12.6, 4.5], "l-pause": [-6, 13.4, 4] };
const OFF = { "l-brick": [1, -1], "l-mortar": [1, 0], "l-water": [1, 0], "l-scrub": [-1, -1], "l-hot": [1, -1], "l-acid": [-1, -1], "l-leak": [1, -1], "l-red": [-1, -1], "l-cream": [-1, 0], "l-pause": [-1, -1] };   // directed: "one active too many" left of its point, clear of "water leaking out"; the lipids label clear of the day counter
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; el.style.visibility = el.getBoundingClientRect().top < titleBottom() + 6 ? "hidden" : ""; } };   // a label never sits on the title
const titleBottom = () => { const hd = document.querySelector("header"); return hd ? hd.getBoundingClientRect().bottom : 0; };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // wear per gap: builds through shot 1 (each aggressor opens two gaps), heals through shot 2
  const T = [0.6, 2.6, 4.4];
  const wear = GAPS.map((_, k) => {
    const t0 = T[Math.floor(k / 2)] + 0.5 + (k % 2) * 0.3;
    const up = i === 1 ? E.out(seg(lt, t0, t0 + 1.4)) : i >= 2 ? 1 : 0;
    const heal = i === 2 ? E.inout(seg(lt, 1.6 + k * 0.25, 5.2 + k * 0.25)) : 0;
    return up * (1 - heal);
  });
  paint(wear);
  const worn = wear.reduce((a, b) => a + b, 0) / wear.length;
  mortarMat.emissiveIntensity = 0.55 * (1 - 0.85 * worn) + (i === 2 ? 0.25 * E.out(seg(lt, 5.5, 7.5)) : 0);
  mortarMat.color.set(0xeab9c8).lerp(new THREE.Color(0x6e5055), worn * 0.8);
  // water inside: still when the barrier holds; rising out through the gaps when it doesn't
  drops.forEach((d, k) => { const w = wear[k]; const ph = (t * 0.45 + k * 0.19) % 1; d.visible = w > 0.3; const g = GAPS[k]; d.position.set(g.x, 11.6 + ph * 7, g.z); d.material.opacity = Math.sin(ph * Math.PI) * w; d.scale.setScalar(0.6 + 0.5 * ph); });
  irritants.forEach((m, k) => { const w = wear[k]; const ph = (t * 0.4 + k * 0.23) % 1; m.visible = w > 0.3; const g = GAPS[k]; m.position.set(g.x + 0.3, 18 - ph * 7.5, g.z - 0.3); m.rotation.set(ph * 6, k, ph * 4); m.material.opacity = Math.min(1, w * (1 - ph * 0.6)); });
  // the aggressors, shot 1: a scrub rolls across, hot water pours, an active lands
  scrub.visible = i === 1 && lt > 0.2 && lt < 3.4;
  if (scrub.visible) { const p = E.inout(seg(lt, 0.3, 2.6)); scrub.position.set(-8 + 16 * p, 12.9, 1); scrub.rotation.set(p * 9, 0, p * 7); scrub.scale.setScalar(1 - seg(lt, 2.8, 3.4)); }
  hot.visible = i === 1 && lt > 2.2 && lt < 5.2;
  if (hot.visible) { const p = E.out(seg(lt, 2.3, 3.0)), f = seg(lt, 4.4, 5.2); hot.position.set(2, 16, -1); hot.scale.set(1 - f, p, 1 - f); hot.material.opacity = 0.55 * (1 - f); }
  acid.visible = i === 1 && lt > 4.0 && lt < 6.6;
  if (acid.visible) { const f = E.in(seg(lt, 4.0, 4.8)), s = seg(lt, 4.8, 5.5), fade = seg(lt, 5.8, 6.6); acid.position.set(-1, 22 - 10 * f, -1.5); acid.scale.set(1 + 0.8 * s, 1 - 0.6 * s, 1 + 0.8 * s); acid.material.opacity = 0.85 * (1 - fade); }
  // the cream, shot 2
  cream.visible = i === 2 && lt > 0.3;
  if (cream.visible) { const p = E.out(seg(lt, 0.3, 1.3)); cream.position.y = 14 - 1.9 * p; cream.material.opacity = 0.85 * Math.min(1, p * 1.5); }
  // labels and the day counter (DOM)
  const $ = M.$;
  if (i === 0) { enter($("#l-brick"), lt, 0.6, { y: 8 }); enter($("#l-mortar"), lt, 1.8, { y: 8 }); enter($("#l-water"), lt, 3.2, { y: 8 }); }
  if (i === 1) { enter($("#l-scrub"), lt, 0.6, { y: 8 }); if (lt > 3) $("#l-scrub").style.opacity = 1 - seg(lt, 3, 3.5); enter($("#l-hot"), lt, 2.5, { y: 8 }); if (lt > 5) $("#l-hot").style.opacity = 1 - seg(lt, 5, 5.5); enter($("#l-acid"), lt, 4.4, { y: 8 }); enter($("#l-leak"), lt, 3.6, { y: 8 }); enter($("#l-red"), lt, 5.2, { y: 8 }); }
  if (i === 2) { enter($("#l-cream"), lt, 1.2, { y: 8 }); enter($("#l-pause"), lt, 2.2, { y: 8 }); enter($("#dayc"), lt, 1.8, { y: 10 }); $("#dayn").textContent = Math.round(14 * E.out(seg(lt, 2.0, 6.5))); enter($("#note3"), lt, 7.2, { y: 10 }); }
  renderer.render(scene, camera);
};
`
  },
  /* ───────── the course page's hero: a living cross-section of skin, told in the three levels ─────────
     bare: no header, caption bar or foot; the page under it says what each level is. One loop of 24 s:
     the camera, the cells' rise, the sun, the drops and the glow all return to where they began. */
  "hero": {
    id: "hero", bare: true, kicker: "Lumevina Skin School", title: `Know your skin. <span class="grad">Then glow for life.</span>`, dur: 24, poster: 20.5,
    shots: [
      { at: 0, name: "know", cap: "New cells rise to the surface about every four weeks." },
      { at: 8, name: "actives", cap: "The right active, in the right order, on the right night." },
      { at: 16, name: "treat", cap: "Spots fade, collagen builds, and the glow comes through." }
    ],
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }`,
    html: `<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
const W = window.W, H = window.H, M = window.M;
const { seg, E } = M;
const DUR = 24, TAU = Math.PI * 2;
const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((x >>> 16) ^ x) / 4294967296 % 1; };
const canvas = document.createElement("canvas"); canvas.id = "gl"; canvas.width = W; canvas.height = H;
document.querySelector(".stage").insertBefore(canvas, document.querySelector("header"));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const portrait = H > W;
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.55));
const key = new THREE.DirectionalLight(0xffe9d6, 2.7); key.position.set(9, 16, 14); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -16; key.shadow.camera.right = 16; key.shadow.camera.top = 16; key.shadow.camera.bottom = -16; key.shadow.camera.near = 1; key.shadow.camera.far = 60; key.shadow.bias = -0.0008;
scene.add(key);
const fill = new THREE.DirectionalLight(0xf4c9d6, 0.35); fill.position.set(-12, 6, -6); scene.add(fill);
const rim = new THREE.DirectionalLight(0xf4c9d6, 1.7); rim.position.set(-5, 15, -16); scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; ground.receiveShadow = true; scene.add(ground);

// the block: X across, Y up, Z toward the camera; the cut face is the front. A follicle with its hair, as in 8-2.
const NX = 16, NY = 14, NZ = 9, PORE = { x: [-1, 0], z: [7, 8], from: 6 };
const PZ = 8 - NZ / 2;
const inPore = (x, y, z) => PORE.x.includes(x) && PORE.z.includes(z) && y >= PORE.from;
const cells = [];
for (let x = -8; x < 8; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
  if (inPore(x, y, z)) continue;
  const i = cells.length, v = hash(i) * 0.08 - 0.04;
  let c;
  if (y >= 11) c = new THREE.Color(0xe9c4b4).offsetHSL(0, 0, v + (y === 13 ? 0.04 : 0));
  else if (y >= 3) c = new THREE.Color(0xb77a80).offsetHSL(0, 0, v);
  else c = new THREE.Color(0xe6d49a).offsetHSL(0, 0, v);
  cells.push({ x, y, z, c, base: c.clone(), ph: hash(i + 77) * TAU, k: hash(i + 99) });
}
const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 });
const block = new THREE.InstancedMesh(geo, mat, cells.length);
block.castShadow = true; block.receiveShadow = true;
const dummy = new THREE.Object3D();
cells.forEach((c, i) => { dummy.position.set(c.x + 0.5, c.y, c.z + 0.5 - NZ / 2); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix); block.setColorAt(i, c.c); });
scene.add(block);
const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 12, 10), new THREE.MeshStandardMaterial({ color: 0x4a2c22, roughness: 0.5 }));
hair.position.set(0, PORE.from + 5.6, PZ); hair.rotation.z = 0.08; hair.castShadow = true; scene.add(hair);

// the sun: a warm ray that touches the surface in level 1 and leaves two dark patches on the cut face
const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 26, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
ray.position.set(-3.6, 26, PZ - 1); ray.rotation.z = 0.22; scene.add(ray);
const SPOTS = [[-4, -3, -2, -3, -4, -2], [3, 4, 5, 4, 3, 5]];   // x columns of two patches, on the front rows
const spotK = cells.map((c) => {
  if (c.y < 11 || c.z < NZ - 3) return 0;
  const d = Math.min(Math.hypot(c.x + 3, (c.y - 13) * 0.7), Math.hypot(c.x - 4, (c.y - 13) * 0.7));
  return Math.max(0, 1 - d / 2.4) * (c.y === 13 ? 1 : 0.6);
});
const BROWN = new THREE.Color(0x7a4634), GLOW = new THREE.Color(0xd79aa2), TOPGLOW = new THREE.Color(0xf6d6c8);
const tmp = new THREE.Color();

// the drops: vitamin C, a retinoid, niacinamide; each falls, lands with a squash, spreads and sinks in
const SURF = 13.5;
const mkDrop = (col) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 18), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.15, transmission: 0.25, opacity: 0.9, transparent: true })); m.visible = false; m.castShadow = true; scene.add(m); return m; };
const ring = (col) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m; };
const DROPS = [
  { m: mkDrop(0xf1d57a), r: ring(0xf1d57a), x: -4.6, z: PZ - 2.4, t0: 8.4 },
  { m: mkDrop(0xf4c9d6), r: ring(0xf4c9d6), x: 0.8, z: PZ - 3.2, t0: 10.6 },
  { m: mkDrop(0xffffff), r: ring(0xffffff), x: 5.2, z: PZ - 2.0, t0: 12.8 }
];
const splash = (m, x, z, q) => { m.visible = q >= 0 && q < 0.7; if (!m.visible) return; const k = 1 - Math.pow(1 - q / 0.7, 3); m.position.set(x, SURF + 0.03, z); m.scale.setScalar(0.6 + 2.8 * k); m.material.opacity = 0.75 * Math.pow(1 - q / 0.7, 1.6); };

// the camera: one slow orbit of the cut face per loop, so the last frame meets the first
const look = new THREE.Vector3(0, 9.4, 1.2), lk = new THREE.Vector3();
window.CINEMA_FOCUS = () => ({ point: lk.copy(look), fstop: 0.5 });
const place = (t) => {
  const a = TAU * t / DUR, sc = portrait ? 1.3 : 1;
  camera.position.set((6.2 + 2.0 * Math.sin(a)) * sc, 13.8 + 0.9 * Math.sin(a + 1.1), (19.0 + 1.5 * Math.cos(a)) * sc);
  camera.fov = 32 + (portrait ? 12 : 0); camera.updateProjectionMatrix();
  camera.lookAt(look.x + 0.3 * Math.sin(a + 0.4), look.y + 0.2 * Math.sin(a + 2), look.z);
};
const smooth = (x) => x * x * (3 - 2 * x);
window.seek = function (t) {
  M.stage(t);
  place(t);
  // the sun, in level 1
  const sun = t < 8 ? Math.sin(Math.PI * seg(t, 1.2, 7.2)) : 0;
  ray.material.opacity = 0.22 * sun;
  // the spots: made by the sun, faded by level 3; the fade ends before the loop wraps
  const made = E.out(seg(t, 2.4, 7.0)), faded = E.inout(seg(t, 16.5, 21.5));
  const spot = made * (1 - faded);
  // level 3: the dermis brightens as collagen builds, the surface glows; both ease back by the end of the loop
  const glow = E.inout(seg(t, 16.8, 20.4)) * (1 - E.inout(seg(t, 22.2, 23.9)));
  key.intensity = 2.7 + 0.9 * glow; rim.intensity = 1.7 + 1.1 * glow;
  // the cells: a slow swell that travels up through the epidermis, the turnover, all year round
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    let lift = 0, sw = 1;
    if (c.y >= 11) {
      const w = Math.sin(TAU * (2 * t / DUR) - (c.y - 11) * 0.9 + c.ph * 0.35 + c.x * 0.18);
      lift = 0.16 * w; sw = 1 + 0.14 * w;
    } else if (c.y >= 3) { sw = 1 + 0.06 * glow * Math.sin(c.ph); }
    dummy.position.set(c.x + 0.5, c.y + lift, c.z + 0.5 - NZ / 2); dummy.scale.set(sw, sw, sw); dummy.updateMatrix(); block.setMatrixAt(i, dummy.matrix);
    tmp.copy(c.base);
    if (spotK[i]) tmp.lerp(BROWN, 0.85 * spotK[i] * spot);
    if (c.y >= 3 && c.y < 11) tmp.lerp(GLOW, 0.55 * glow);
    else if (c.y === 13) tmp.lerp(TOPGLOW, 0.5 * glow);
    block.setColorAt(i, tmp);
  }
  block.instanceMatrix.needsUpdate = true; block.instanceColor.needsUpdate = true;
  // the drops, in level 2
  for (const d of DROPS) {
    const q = t - (d.t0 + 1.2);
    splash(d.r, d.x, d.z, q);
    const on = t > d.t0 && q < 2.2;
    d.m.visible = on;
    if (!on) continue;
    const u = seg(t, d.t0, d.t0 + 1.2), f = u * u * u, speed = 3 * u * u;
    let sy, sxz, y;
    if (q < 0) { sy = Math.min(1.5, 1 + 0.2 * speed); sxz = 1 / Math.sqrt(sy); y = 22 - (22 - (SURF + 1.1)) * f; }
    else { const flat = 0.65 * (1 - Math.exp(-q * 6)), wob = 0.12 * Math.sin(q * 22) * Math.exp(-q * 4.5), sink = smooth(seg(q, 0.9, 2.2)); sy = Math.max(0.15, 1 - flat + wob) * (1 - sink); sxz = (1 + 1.6 * flat - 0.5 * wob) * (1 - 0.3 * sink); y = SURF + 1.1 * sy; }
    d.m.position.set(d.x, y, d.z); d.m.scale.set(Math.max(0.001, sxz), Math.max(0.001, sy), Math.max(0.001, sxz));
    d.m.material.opacity = 0.9 * (1 - seg(q, 1.4, 2.2));
  }
  renderer.render(scene, camera);
};
`
  }
};
