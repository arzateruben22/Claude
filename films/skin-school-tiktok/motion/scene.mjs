// Skin School on TikTok: "Why does a pore clog?" (60 s, 9:16, narrated).
//
// Lesson 8-2's scene as directed in the pilot (films/skin-school-pilot/motion/scenes3d.mjs), on the
// film's own clock: every event time, camera key and focus key comes from ../film.json, which
// compile.py builds from the script and the voice's word timings. What changed for TikTok is marked
// "tiktok:": captions with the spoken word lit, the layout kept out of the apps' own UI, the skin
// cap for the whitehead, weeks instead of days, the end card, and the plug's top layer landing.
import fs from "node:fs";
const FILM = JSON.parse(fs.readFileSync(new URL("../film.json", import.meta.url), "utf8"));

export const SCENES = {

  /* ───────── 8-2 Inside a pore, for TikTok ───────── */
  "skin-school-pore": {
    id: "skin-school-pore", kicker: "What acne actually is", title: `Inside a pore, <span class="grad">and how it clears.</span>`, dur: FILM.dur, poster: FILM.poster,
    shots: FILM.shots,   // tiktok: her four shots, at the film's beats (captions come from the voice)
    css: `
#gl { position: absolute; inset: 0; z-index: 0; }
.stage::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 34%; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.45) 55%, rgba(0,0,0,0) 100%); }
.lab3 { position: absolute; z-index: 2; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.14); font-size: 2.3vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.lab3 i { display: inline-block; width: 1.6vmin; height: 1.6vmin; border-radius: 50%; margin-right: 1vmin; vertical-align: -.1vmin; }
.dayc { position: absolute; right: 0; bottom: 2vmin; display: flex; align-items: baseline; gap: 1.2vmin; opacity: 0; }
.dayc b { font-size: 8vmin; font-weight: 700; letter-spacing: -.03em; text-shadow: 0 .4vmin 2.4vmin rgba(0,0,0,.75); } .dayc span { font-size: 2.6vmin; color: #a1a1a6; }
@media (orientation: portrait) { .dayc { bottom: 1vmin; } }
/* tiktok: TikTok, Reels and Shorts draw their own UI over the top ~220 px, the bottom ~480 px and the
   right ~140 px of a 1080×1920 frame. Text and the subject the voice names stay in x 90–900, y 250–1420. */
.stage { padding: 0 !important; }
header { position: absolute; left: 8.3vw; right: 16.7vw; top: 13.5vh; z-index: 3; }
.k { font-size: 3vmin; } h1 { font-size: 6.6vmin; }
main.canvas { position: absolute !important; inset: 0; }
footer { display: none !important; }
.stage::before { height: 30%; }
.lab3 { font-size: 3.1vmin; padding: 1.1vmin 2vmin; }
.tcap { position: absolute; left: 50%; top: 61vh; transform: translateX(-50%); width: max-content; max-width: 72vw; z-index: 4; text-align: center; font-size: 5.6vmin; font-weight: 700; line-height: 1.22; letter-spacing: -.012em; padding: 1.6vmin 3vmin; border-radius: 3.4vmin; background: rgba(12,10,11,.66); opacity: 0; }
.tcap .r { display: block; white-space: nowrap; }
.tcap i { font-style: normal; color: rgba(245,245,247,.80); }
.tcap i.on { color: #f4c9d6; } .tcap i.said { color: #f5f5f7; }
.dayc { right: auto !important; left: 50%; bottom: auto !important; top: 47vh; transform: translateX(-50%); }
.dayc b.lit { color: #f4c9d6; }
.endscrim { position: absolute; inset: 0; z-index: 4; background: rgba(0,0,0,.62); opacity: 0; pointer-events: none; }
.endc { position: absolute; left: 8.3vw; right: 16.7vw; top: 33vh; z-index: 5; opacity: 0; }
.endc .t { font-size: 8.2vmin; font-weight: 700; letter-spacing: -.035em; line-height: 1.04; }
.endc .p2 { margin-top: 4vmin; font-size: 4.6vmin; font-weight: 600; line-height: 1.2; }
.endc .chip { margin-top: 3.4vmin; font-size: 3.6vmin; }`,
    html: `
<section class="shot"><span class="lab3" id="l-hair" style="left:52%;top:4%"><i style="background:#5a3a2e"></i>hair</span><span class="lab3" id="l-gland" style="left:62%;top:46%"><i style="background:#e8c96a"></i>oil gland</span><span class="lab3" id="l-oil" style="left:30%;top:22%"><i style="background:#f1d57a"></i>oil, on its way out</span></section>
<section class="shot"><span class="lab3" id="l-plug" style="left:58%;top:26%"><i style="background:#8e8e93"></i>dead skin cells + oil</span><span class="lab3" id="l-black" style="left:24%;top:10%"><i style="background:#1a1210"></i>oxidized: a blackhead</span><span class="lab3" id="l-white"><i style="background:#efe3d3"></i>closed over: a whitehead</span></section>
<section class="shot"><span class="lab3" id="l-bact" style="left:60%;top:30%"><i style="background:#ff5a4a"></i>bacteria</span><span class="lab3" id="l-red" style="left:22%;top:16%"><i style="background:#e0574a"></i>inflammation</span></section>
<section class="shot"><span class="lab3" id="l-mand" style="left:22%;top:8%"><i style="background:#f4c9d6"></i>mandelic acid</span><span class="lab3" id="l-bp" style="left:58%;top:8%"><i style="background:#ffffff"></i>benzoyl peroxide</span><div class="dayc" id="dayc"><b id="dayn">0</b><span>weeks</span></div></section>
<div class="tcap" id="tcap"></div><div class="endscrim" id="endscrim"></div>
<div class="endc" id="endc"><p class="t">Inside a pore, <span class="grad">and how it clears.</span></p><p class="p2">Part 2: what to put on it.</p><span class="chip">Follow Skin School</span></div>`,
    module: `
import * as THREE from "../vendor/three.module.min.js";
import { liquid } from "../../../../kits/cinema/metaballs.js";   // directed: liquid beads (served from the repo's kit)
const tmpV = new THREE.Vector3();
const W = window.W, H = window.H, M = window.M;
const { seg, tw, E, enter } = M;
// tiktok: every timed event comes from the film's clock (shot-local seconds, from ../film.json),
// so the picture, the captions and the sound (kits/cinema/studio) all hang on the same spoken words
const FILM = ${JSON.stringify(FILM)};
const CUE = FILM.cue;
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

const RED = new THREE.Color(0xe0574a), BLACK = new THREE.Color(0x1a1210), PALE = new THREE.Color(0xe8dccb);
// tiktok: the whitehead. A thin cap of skin slides over the pore mouth; under it the plug's top stays pale.
const capMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.32, 2.4), new THREE.MeshStandardMaterial({ color: 0xe9c4b4, roughness: 0.6, transparent: true, opacity: 0 }));
capMesh.castShadow = true; capMesh.receiveShadow = true; capMesh.visible = false; scene.add(capMesh);
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
const CAM = FILM.cam;   // tiktok: keyed to the voice by compile.py
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
const FOC = FILM.foc;
const fA = new THREE.Vector3(), fB = new THREE.Vector3();
const focusPoint = (k, out) => (typeof k.at === "string" ? out.copy(DROP[k.at]) : out.fromArray(k.at));
window.CINEMA_FOCUS = (t) => {
  let i = 0; for (let k = 0; k < FOC.length; k++) if (t >= FOC[k].t) i = k;
  const cur = FOC[i], prev = FOC[Math.max(0, i - 1)], r = EZ.p2(Math.min(1, (t - cur.t) / 0.45));
  focusPoint(prev, fA); focusPoint(cur, fB);
  return { point: fA.lerp(fB, i === 0 ? 1 : r), fstop: (prev.f + (cur.f - prev.f) * (i === 0 ? 1 : r)) * (portrait ? 0.8 : 1) };
};
// a label follows the part it names: project the point, offset a little
const ANCHOR = { "l-white": [0.6, 14.6, PZ + 0.5], "l-hair": [0.4, 16.6, PZ], "l-gland": [3, 6.6, PZ + 0.5], "l-oil": [-0.6, 12, PZ + 0.5], "l-plug": [0.8, 11.2, PZ + 0.5], "l-black": [-0.6, 14.4, PZ + 0.5], "l-bact": [0.9, 10.6, PZ + 0.5], "l-red": [-2.8, 14.2, PZ + 0.5], "l-mand": [-1.2, 17.5, PZ], "l-bp": [1.4, 17.3, PZ] };
const OFF = { "l-white": [1, -1], "l-hair": [1, -1], "l-gland": [1, 0], "l-oil": [-1, 0], "l-plug": [1, 0], "l-black": [-1, -1], "l-bact": [1, 0], "l-red": [-1, -1], "l-mand": [-1, -1], "l-bp": [1, -1] };
const v3 = new THREE.Vector3();
// tiktok: labels stay inside the apps' safe box and above the captions
const SAFE = { l: 90 / 1080 * W, r: 900 / 1080 * W, t: 250 / 1920 * H, b: 1140 / 1920 * H };
const pin = () => { for (const id in ANCHOR) { const el = document.getElementById(id); if (!el) continue; v3.set(...ANCHOR[id]).project(camera); const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, [ox, oy] = OFF[id], w = el.offsetWidth, h = el.offsetHeight; const pw = Math.min(el.offsetParent ? el.offsetParent.clientWidth : W, SAFE.r); el.style.left = Math.min(pw - w - 6, Math.max(SAFE.l, x + (ox > 0 ? 14 : -w - 14))) + "px"; el.style.top = Math.min(SAFE.b - h, Math.max(SAFE.t, y + (oy < 0 ? -h - 10 : -h / 2))) + "px"; } };   // directed: labels stay inside the frame
// tiktok: captions. One page per sentence (≤ 2 lines), the word being spoken lit rose, the words
// already said white, the rest a little dimmer. Built from the voice's word times in film.json.
const capEl = document.getElementById("tcap"), CAPS = FILM.captions;
let capShown = -1;
const captions = (t) => {
  let k = -1; for (let j = 0; j < CAPS.length; j++) if (t >= CAPS[j].t0 && t < CAPS[j].t1) k = j;
  if (k !== capShown) {
    capEl.innerHTML = k < 0 ? "" : CAPS[k].lines.map((r) => '<span class="r">' + r.map(([w]) => "<i>" + w.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</i>").join(" ") + "</span>").join("");
    capShown = k;
  }
  if (k < 0) { capEl.style.opacity = 0; return; }
  const c = CAPS[k], words = c.lines.flat(), el = capEl.querySelectorAll("i");
  let on = -1; words.forEach(([, wt], j) => { if (t >= wt) on = j; });
  el.forEach((e, j) => { e.className = j === on ? "on" : j < on ? "said" : ""; });
  capEl.style.opacity = Math.min(1, (t - c.t0) / 0.12, (c.t1 - t) / 0.12);
};
// tiktok: the header (her kicker and title) only over the hook; the end card brings the title back
const headerEl = document.querySelector("header"), endEl = document.getElementById("endc"), scrimEl = document.getElementById("endscrim");
const endCard = (t) => {
  const e = E.out(seg(t, FILM.endCard, FILM.endCard + 0.6));
  endEl.style.opacity = e; endEl.style.transform = "translateY(" + (2.4 * (1 - e)) + "vmin)"; scrimEl.style.opacity = e;
  headerEl.style.opacity = 1 - seg(t, FILM.beats[1].t0 - 0.3, FILM.beats[1].t0 + 0.4);
};
window.seek = function (t) {
  const st = M.stage(t), { i, lt } = st;
  place(t); pin();
  // healthy oil, until the clog
  const oilOn = i === 0 ? 1 : i === 1 ? 1 - seg(lt, CUE.oilOff[0], CUE.oilOff[1]) : 0;
  // directed: each drop grows in at the gland and shrinks away at the top, so the loop's wrap is never seen (or blurred)
  oils.forEach((o, k) => { const ph = (t * 0.32 + k * 0.2) % 1, life = Math.min(1, ph / 0.08, (1 - ph) / 0.1); const sc = (0.7 + 0.5 * ph) * oilOn * life * life * (3 - 2 * life); o.visible = sc > 0.02; o.position.set(0 + Math.sin(ph * 9 + k) * 0.25, 7 + ph * 8.5, PZ + Math.cos(ph * 7 + k) * 0.2); o.scale.setScalar(Math.max(0.001, sc)); });
  // the plug fills from shot 1, dissolves in shot 3
  const fillP = i === 0 ? 0 : i >= 2 ? 1 : seg(lt, CUE.fill[0], CUE.fill[1]);
  const clearP = i === 3 ? seg(lt, CUE.clear[0], CUE.clear[1]) : 0;
  // tiktok: the skin cap (shot 1): slides in, the top fades pale under it, then it slides back off
  const capIn = i === 1 ? E.out(seg(lt, CUE.cap.in[0], CUE.cap.in[1])) * (1 - E.inout(seg(lt, CUE.cap.out[0], CUE.cap.out[1]))) : 0;
  const paleP = i === 1 ? seg(lt, CUE.cap.pale[0], CUE.cap.pale[1]) * (1 - seg(lt, CUE.cap.out[0], CUE.cap.out[1])) : 0;
  capMesh.visible = capIn > 0.001; capMesh.position.set(3.4 * (1 - capIn) * (lt > CUE.cap.out[0] ? -1 : 1), SURF + 0.14, PZ); capMesh.material.opacity = Math.min(1, capIn * 1.6);
  plug.forEach((m, k) => {
    const t0 = k / plug.length, p = seg(fillP, 0.8 * t0, 0.8 * t0 + 0.2);   // tiktok: every cell lands by the end of the fill (the top layer never did)
    const gone = seg(clearP, 1 - (k + 1) / plug.length, 1 - k / plug.length);
    m.visible = p > 0 && gone < 1;
    // directed: a real fall (accelerating), a little bounce and squash where it lands
    const land = CUE.fill[0] + (0.8 * t0 + 0.2) * (CUE.fill[1] - CUE.fill[0]), q = lt - land;
    const settled = i >= 2 || (i === 1 && q >= 0);
    const bounce = settled && i === 1 && q < 0.8 ? 0.32 * Math.exp(-q * 7) * Math.abs(Math.sin(q * 13)) : 0;
    const sq = settled && i === 1 && q < 0.6 ? 0.22 * Math.exp(-q * 9) * Math.cos(q * 26) : 0;
    m.position.y = m.userData.y + (p < 1 ? (1 - p * p) * 7 : 0) + bounce;
    const sz = Math.max(0.001, (0.8 + 0.4 * p) * (1 - gone));
    m.scale.set(sz * (1 + sq * 0.5), sz * (1 - sq), sz * (1 + sq * 0.5));
    if (m.userData.top) { tmp.set(hash(k + 500) < 0.6 ? 0x8e8e93 : 0xd9b85c).lerp(BLACK, i === 1 ? seg(lt, CUE.oxidize[0], CUE.oxidize[1]) : i >= 2 ? 1 - clearP : 0).lerp(PALE, paleP); m.material.color.copy(tmp); }
  });
  // bacteria and the red wall
  const bactP = i === 2 ? seg(lt, CUE.bact[0], CUE.bact[1]) : i === 3 ? 1 - seg(lt, CUE.bactOut[0], CUE.bactOut[1]) : 0;
  bact.forEach((b, k) => { const p = seg(bactP, k / bact.length, k / bact.length + 0.3); b.visible = p > 0; const h = b.userData.home;
    b.position.set(h.x + 0.06 * Math.sin(t * 6.1 + k * 1.7), h.y + 0.07 * Math.sin(t * 5.3 + k * 2.3), h.z + 0.05 * Math.sin(t * 4.7 + k));
    const pop = E.back(Math.min(1, p * 1.2)); b.scale.set(Math.max(0.001, pop) * (1 + 0.15 * Math.sin(t * 5 + k)), Math.max(0.001, pop) * (1 - 0.12 * Math.sin(t * 5 + k)), Math.max(0.001, pop) * (1 + 0.15 * Math.sin(t * 5 + k))); });
  const redP = i === 2 ? E.out(seg(lt, CUE.red[0], CUE.red[1])) : i === 3 ? 1 - E.inout(seg(lt, CUE.redOut[0], CUE.redOut[1])) : 0;
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
  const pm = drop(dropMand, 0, PZ, 0.9, CUE.mand[0], CUE.mand[1], CUE.mand[2], CUE.mand[3], 0.65, splashMand, "mand", mandBalls); if (pm) DROP.mand.copy(pm); else if (i === 3 && lt <= CUE.mand[0]) DROP.mand.set(0, 22, PZ);
  const pb = drop(dropBP, 0.6, PZ + 0.4, 0.8, CUE.bp[0], CUE.bp[1], CUE.bp[2], CUE.bp[3], 0.6, splashBP, "bp", bpBalls); if (pb) DROP.bp.copy(pb); else if (i === 3 && lt <= CUE.bp[0]) DROP.bp.set(0.6, 22, PZ + 0.4);
  // labels and the day counter (DOM)
  const $ = M.$;
  (CUE.labels[i] || []).forEach(([id, at]) => enter($("#" + id), lt, at, { y: id === "dayc" ? 10 : 8 }));
  if (i === 3) {   // tiktok: weeks, 0 → 8 → 12 on the spoken words, 8 to 12 lit
    const W_ = CUE.weeks; let wk = 0;
    for (let j = 1; j < W_.length; j++) if (lt >= W_[j - 1][0]) wk = W_[j - 1][1] + (W_[j][1] - W_[j - 1][1]) * E.inout(seg(lt, W_[j - 1][0], W_[j][0]));
    const n = Math.round(wk); $("#dayn").textContent = n; $("#dayn").classList.toggle("lit", n >= 8);
  }
  captions(t); endCard(t);
  renderer.render(scene, camera);
};
// directed: the same table as film-time events for the sound. "first" is the first moment the event
// shows; the studio snaps it to the frame grid. Labels carry their element id, so the cue runner can
// read their screen position for the pan.
window.SCENE_CUES = function () {   // tiktok: labels only (compile.py writes every sound event); the runner adds pos and shown
  const at = window.SCENE.shots.map((x) => x.at), ev = [];
  CUE.labels.forEach((row, k) => row.forEach(([id, t]) => ev.push({ t: at[k] + t, kind: id === "dayc" ? "counter.show" : "label", tag: id, el: id })));
  return { dur: window.SCENE.dur, events: ev };
};
`
  }
};
