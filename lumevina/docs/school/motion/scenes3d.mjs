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
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.dayc { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; opacity: 0; }
.dayc b { font-size: 8vmin; font-weight: 700; letter-spacing: -.03em; } .dayc span { font-size: 2.6vmin; color: #a1a1a6; }
@media (orientation: portrait) { .dayc { bottom: 1vmin; } }`,
    html: `
<section class="shot"><span class="lab3" id="l-hair" style="left:52%;top:4%"><i style="background:#5a3a2e"></i>hair</span><span class="lab3" id="l-gland" style="left:62%;top:46%"><i style="background:#e8c96a"></i>oil gland</span><span class="lab3" id="l-oil" style="left:30%;top:22%"><i style="background:#f1d57a"></i>oil, on its way out</span></section>
<section class="shot"><span class="lab3" id="l-plug" style="left:58%;top:26%"><i style="background:#8e8e93"></i>dead skin cells + oil</span><span class="lab3" id="l-black" style="left:24%;top:10%"><i style="background:#1a1210"></i>oxidized: a blackhead</span></section>
<section class="shot"><span class="lab3" id="l-bact" style="left:60%;top:30%"><i style="background:#ff5a4a"></i>bacteria</span><span class="lab3" id="l-red" style="left:22%;top:16%"><i style="background:#e0574a"></i>inflammation</span></section>
<section class="shot"><span class="lab3" id="l-mand" style="left:22%;top:8%"><i style="background:#f4c9d6"></i>mandelic acid</span><span class="lab3" id="l-bp" style="left:58%;top:8%"><i style="background:#ffffff"></i>benzoyl peroxide</span><div class="dayc" id="dayc"><b id="dayn">0</b><span>days</span></div></section>`,
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
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1418, 0.9));
const key = new THREE.DirectionalLight(0xfff4ea, 2.2); key.position.set(10, 18, 12); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -16; key.shadow.camera.right = 16; key.shadow.camera.top = 16; key.shadow.camera.bottom = -16; key.shadow.camera.near = 1; key.shadow.camera.far = 60; key.shadow.bias = -0.0008;
scene.add(key);
const fill = new THREE.DirectionalLight(0xf4c9d6, 0.5); fill.position.set(-12, 6, -6); scene.add(fill);
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
const oilGeo = new THREE.SphereGeometry(0.22, 12, 10), oilMat = new THREE.MeshStandardMaterial({ color: 0xf1d57a, roughness: 0.35, emissive: 0x5a4410 });
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
const bactGeo = new THREE.SphereGeometry(0.16, 10, 8), bactMat = new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0x7a1a12, roughness: 0.4 });
const bact = Array.from({ length: 14 }, (_, i) => { const m = new THREE.Mesh(bactGeo, bactMat); m.position.set(-1 + hash(i + 300) * 2, 9.5 + hash(i + 301) * 4.2, PZ - 0.7 + hash(i + 302) * 1.6); m.visible = false; scene.add(m); return m; });
// the drops
const dropMand = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xf4c9d6, roughness: 0.15, transmission: 0.3, opacity: 0.85, transparent: true }));
const dropBP = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, opacity: 0.9, transparent: true }));
dropMand.visible = dropBP.visible = false; dropMand.castShadow = dropBP.castShadow = true; scene.add(dropMand, dropBP);

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
const look = new THREE.Vector3(0, 8.5, 0);
const place = (t) => {
  const a = -0.42 + t * 0.014, r = portrait ? 44 : 34;
  camera.position.set(Math.sin(a) * r, 17 + Math.sin(t * 0.07) * 0.6, Math.cos(a) * r);
  camera.lookAt(look);
};
// a label follows the part it names: project the point, offset a little
const ANCHOR = { "l-hair": [0.4, 16.6, PZ], "l-gland": [3, 6.6, PZ + 0.5], "l-oil": [-0.6, 12, PZ + 0.5], "l-plug": [0.8, 11.2, PZ + 0.5], "l-black": [-0.6, 14.4, PZ + 0.5], "l-bact": [0.9, 10.6, PZ + 0.5], "l-red": [-2.8, 14.2, PZ + 0.5], "l-mand": [-1.2, 17.5, PZ], "l-bp": [1.4, 17.3, PZ] };
const OFF = { "l-hair": [1, -1], "l-gland": [1, 0], "l-oil": [-1, 0], "l-plug": [1, 0], "l-black": [-1, -1], "l-bact": [1, 0], "l-red": [-1, -1], "l-mand": [-1, -1], "l-bp": [1, -1] };
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; } };
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // healthy oil, until the clog
  const oilOn = i === 0 ? 1 : i === 1 ? 1 - seg(lt, 0, 1.5) : 0;
  oils.forEach((o, k) => { const ph = (t * 0.32 + k * 0.2) % 1; o.visible = oilOn > 0; o.position.set(0 + Math.sin(ph * 9 + k) * 0.25, 7 + ph * 8.5, PZ + Math.cos(ph * 7 + k) * 0.2); o.scale.setScalar((0.7 + 0.5 * ph) * oilOn); });
  // the plug fills from shot 1, dissolves in shot 3
  const fillP = i === 0 ? 0 : i >= 2 ? 1 : seg(lt, 0.3, 4.8);
  const clearP = i === 3 ? seg(lt, 1.4, 4.6) : 0;
  plug.forEach((m, k) => {
    const t0 = k / plug.length, p = seg(fillP, t0, t0 + 0.25);
    const gone = seg(clearP, 1 - (k + 1) / plug.length, 1 - k / plug.length);
    m.visible = p > 0 && gone < 1;
    m.position.y = m.userData.y + (1 - E.out(p)) * 7;
    m.scale.setScalar(Math.max(0.001, (0.8 + 0.4 * p) * (1 - gone)));
    if (m.userData.top) { tmp.set(hash(k + 500) < 0.6 ? 0x8e8e93 : 0xd9b85c).lerp(BLACK, i === 1 ? seg(lt, 4.2, 5.8) : i >= 2 ? 1 - clearP : 0); m.material.color.copy(tmp); }
  });
  // bacteria and the red wall
  const bactP = i === 2 ? seg(lt, 0.6, 4.4) : i === 3 ? 1 - seg(lt, 4.4, 6.2) : 0;
  bact.forEach((b, k) => { const p = seg(bactP, k / bact.length, k / bact.length + 0.3); b.visible = p > 0; b.scale.setScalar(Math.max(0.001, p) * (1 + 0.15 * Math.sin(t * 5 + k))); });
  const redP = i === 2 ? E.out(seg(lt, 1.6, 5.4)) : i === 3 ? 1 - E.inout(seg(lt, 3.2, 6.4)) : 0;
  paint(redP);
  // the drops in shot 3
  dropMand.visible = i === 3 && lt > 0.1 && lt < 5;
  if (dropMand.visible) { const f = E.in(seg(lt, 0.1, 1.0)), s = seg(lt, 1.0, 1.8), fade = seg(lt, 3.8, 5); dropMand.position.set(0, 22 - 7.6 * f, PZ); dropMand.scale.set(1 + 0.9 * s, 1 - 0.65 * s, 1 + 0.9 * s); dropMand.material.opacity = 0.85 * (1 - fade); }
  dropBP.visible = i === 3 && lt > 3.6 && lt < 7.2;
  if (dropBP.visible) { const f = E.in(seg(lt, 3.6, 4.4)), s = seg(lt, 4.4, 5.2), fade = seg(lt, 6.2, 7.2); dropBP.position.set(0.6, 22 - 7.7 * f, PZ + 0.4); dropBP.scale.set(1 + 0.8 * s, 1 - 0.6 * s, 1 + 0.8 * s); dropBP.material.opacity = 0.9 * (1 - fade); }
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
const place = (t) => {
  const a = 0.5 - t * 0.012, r = portrait ? 44 : 34;
  camera.position.set(Math.sin(a) * r, 18 + Math.sin(t * 0.07) * 0.6, Math.cos(a) * r);
  camera.lookAt(look);
};
const ANCHOR = { "l-uv": [-9, 16.5, 4], "l-col": [5.5, 6, 4.5], "l-spot": [-4.5, 12.4, 3], "l-spf": [6.5, 12.6, 4.5], "l-bounce": [-3, 15.5, 4], "l-thin": [6.5, 12.6, 4.5], "l-re": [-5, 13.2, 4.5] };
const OFF = { "l-uv": [1, -1], "l-col": [1, 0], "l-spot": [1, -1], "l-spf": [1, 0], "l-bounce": [1, -1], "l-thin": [1, 0], "l-re": [1, -1] };
const v3 = new THREE.Vector3();
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x + (ox > 0 ? 14 : -w - 14)) + "px"; el.style.top = (y + (oy < 0 ? -h - 10 : -h / 2)) + "px"; } };
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
  }
};
