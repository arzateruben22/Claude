// Reality Rulebook · Season 3 long film lf01, "Slow Down One Second Until Light Stands Still" (films/channels/physics/lf01):
// the picture, a pure function of t. One kitchen (a counter along the back wall, a window onto a backyard), one live number: the
// slow-motion factor F. Each picture reads its own local real time r = (t - t0) / F from the film clock; the numbers come from calc.py.
import * as THREE from "three";
import { stage, seg, E, ease, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { dropTitle } from "../set/title.js";
import { createPlates } from "../set/plates.js";
import { ACES_INV_GLSL } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const EV = FILM.ev, CAL = FILM.calc, ES = FILM.endShow, T = new Proxy(FILM.cue.cuts, { get: (o, k) => (k in o ? o[k] : 1e9) });   // a part has only its own beats: the others are never
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = true; renderer.localClippingEnabled = true;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.2, bloom: 0.45, fstop: 0, kMax: 12, shutter: 0 });
const scene = new THREE.Scene();
const VFOV = 30;
const camera = new THREE.PerspectiveCamera(VFOV, W / H, 0.0001, 80);
const INK = "#1B1E24", COB = TK.force || "#1F3BD1", AMB = "#E8A356";
const plates = createPlates({ scene, camera, W, H, FILM, canvas });     // photographic plates behind the code subjects (film.json "plates"); none listed = the code kitchen as before
window.SCENE_READY = plates.ready;
window.CINEMA_FOCUS = (t) => plates.active(t) ? { fstop: 0 } : (window.FILM && window.FILM.ev && window.FILM.ev.bird && t >= window.FILM.ev.bird[0] && t < window.FILM.ev.bird[1]) ? { point: [-1.4, 1.86, -1.45], fstop: 0.7 } : { fstop: 0 };

// ── the slow-motion factor: k = log10 F (keys from compile.py), the light front's radius R(t) = integral of c / F dt ─────────────────
const FK = FILM.factorKeys;
const kAt = (t) => {
  if (t <= FK[0][0]) return FK[0][1];
  for (let i = 1; i < FK.length; i++) if (t <= FK[i][0]) { const [t0, k0] = FK[i - 1], [t1, k1] = FK[i]; return t1 > t0 ? k0 + (k1 - k0) * E.inout3(seg(t, t0, t1)) : k1; }
  return FK[FK.length - 1][1];
};
const CUM = (() => { const n = Math.ceil(FILM.dur * 30) + 2, a = new Float64Array(n); for (let i = 1; i < n; i++) a[i] = a[i - 1] + CAL.c / Math.pow(10, kAt(i / 30)) / 30; return a; })();
const Rint = (t) => { const x = Math.max(0, t) * 30, i = Math.floor(x); return CUM[i] + (CUM[Math.min(i + 1, CUM.length - 1)] - CUM[i]) * (x - i); };

// ── the wave painter: one patch for every kitchen material: the light front (lit behind, dark ahead) and the sound ring ──────────────
const WV = {
  uLSrc: { value: new THREE.Vector3(-2.5, 0.96, -1.0) }, uLR: { value: 0 }, uLOn: { value: 0 }, uLW: { value: 0.05 }, uLK: { value: 1 },
  uSS1: { value: new THREE.Vector3() }, uSS2: { value: new THREE.Vector3() }, uSR1: { value: -9 }, uSR2: { value: -9 }, uSOn: { value: 0 }, uSW: { value: 0.045 }, uSTa: { value: new THREE.Vector3(0.62, 0.82, 1.0) }, uSTb: { value: new THREE.Vector3(0.3, 0.52, 0.95) },
};
const planeSolid = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e6), planeWire = new THREE.Plane(new THREE.Vector3(1, 0, 0), -1e6);
const patch = (m, clip = true) => {
  if (clip) m.clippingPlanes = [planeSolid];
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WV);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP; uniform vec3 uLSrc, uSS1, uSS2; uniform float uLR, uLOn, uLW, uLK, uSR1, uSR2, uSOn, uSW; uniform vec3 uSTa, uSTb;")
      .replace("#include <dithering_fragment>", `
  float rl = length(vWP - uLSrc);
  float lit = smoothstep(uLR + uLW * 0.5, uLR - uLW * 0.5, rl);
  gl_FragColor.rgb *= mix(1.0, mix(0.06, 1.0, lit), uLOn);
  gl_FragColor.rgb += vec3(1.0, 0.9, 0.62) * (exp(-pow((rl - uLR) / uLW, 2.0)) * 1.7 + 0.28 * exp(-pow((rl - uLR) / (uLW * 7.0), 2.0))) * uLOn * uLK;
  float sd1 = length(vWP - uSS1), sd2 = length(vWP - uSS2);
  float sr = exp(-pow((sd1 - uSR1) / uSW, 2.0)) + exp(-pow((sd2 - uSR2) / uSW, 2.0));
  float se = exp(-pow((sd1 - uSR1) / 0.011, 2.0)) + exp(-pow((sd2 - uSR2) / 0.011, 2.0));   // the thin bright edge of the front
  float st = exp(-pow((sd1 - uSR1 + 0.2) / 0.16, 2.0)) * step(sd1, uSR1) + exp(-pow((sd2 - uSR2 + 0.2) / 0.16, 2.0)) * step(sd2, uSR2);
  float rp = 1.0;
  gl_FragColor.rgb += (uSTa * (sr * 0.38 + se * 0.55) + uSTb * st * 0.03 * rp) * uSOn;
  #include <dithering_fragment>`);
  };
  m.customProgramCacheKey = () => "wp" + (clip ? "c" : "n");
  return m;
};
const std = (hex, rough = 0.85, metal = 0, o = {}) => patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal, ...o }), o.noclip !== true);

// ── lights ──
scene.add(new THREE.HemisphereLight(0xfff1dc, 0xc2a98a, 1.1));
const winLight = new THREE.DirectionalLight(0xffe2b0, 1.1); winLight.position.set(-1.0, 3.0, -3.0); winLight.target.position.set(-0.5, 0.9, -1.0); scene.add(winLight, winLight.target);   // daylight through the window
const sun = new THREE.DirectionalLight(0xfff0dc, 1.7); sun.position.set(-2.5, 4.0, 4.0); scene.add(sun);
const rim = new THREE.DirectionalLight(0xbcd0ff, 0.5); rim.position.set(2.0, 2.0, -3.0); scene.add(rim);

// ── the kitchen: a room 5.4 m wide, a counter along the back wall, a window onto the backyard ──
const kitchen = new THREE.Group(); scene.add(kitchen);
const edgeSrc = [];
const box = (w, h, d, x, y, z, mat, edges = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); kitchen.add(m); if (edges) edgeSrc.push(m); return m; };
const CREAM = "#E9E3D3", WALL = "#E4DDCB", COUNTER = "#B7AE9C", CAB = "#5E6B7F", TOPC = "#D8D1BF";
const wallM = std(WALL, 0.95), counterM = std(COUNTER, 0.8), cabM = std(CAB, 0.7), topM = std(TOPC, 0.55), frameM = std("#F4F1E8", 0.6), steel = std("#B4BBC6", 0.4, 0.15);
box(10, 0.04, 6, 0, -0.02, 1.2, std("#CFC7B5", 0.9), false);                           // floor
box(0.1, 2.8, 4, -2.75, 1.4, 0.2, std("#DDD5C2", 0.95), false); box(0.1, 2.8, 4, 2.75, 1.4, 0.2, std("#DDD5C2", 0.95), false);   // side walls
box(5.6, 0.05, 4, 0, 2.8, 0.2, std("#EFEBDD", 0.95), false);                           // ceiling
const WINX0 = -1.95, WINX1 = -0.05, WINY0 = 1.2, WINY1 = 2.35, WZ = -1.82;
box(WINX0 + 2.75, 2.8, 0.12, (-2.75 + WINX0) / 2, 1.4, WZ, wallM); box(2.75 - WINX1, 2.8, 0.12, (WINX1 + 2.75) / 2, 1.4, WZ, wallM);
box(WINX1 - WINX0, WINY0, 0.12, (WINX0 + WINX1) / 2, WINY0 / 2, WZ, wallM); box(WINX1 - WINX0, 2.8 - WINY1, 0.12, (WINX0 + WINX1) / 2, (2.8 + WINY1) / 2, WZ, wallM);
const FW = 0.05;                                                                         // window frame
box(WINX1 - WINX0 + 0.1, FW, 0.1, (WINX0 + WINX1) / 2, WINY0, WZ + 0.03, frameM); box(WINX1 - WINX0 + 0.1, FW, 0.1, (WINX0 + WINX1) / 2, WINY1, WZ + 0.03, frameM);
box(FW, WINY1 - WINY0, 0.1, WINX0, (WINY0 + WINY1) / 2, WZ + 0.03, frameM); box(FW, WINY1 - WINY0, 0.1, WINX1, (WINY0 + WINY1) / 2, WZ + 0.03, frameM);
box(FW, WINY1 - WINY0, 0.1, (WINX0 + WINX1) / 2, (WINY0 + WINY1) / 2, WZ + 0.03, frameM);
box(WINX1 - WINX0 + 0.2, 0.04, 0.24, (WINX0 + WINX1) / 2, WINY0 - 0.02, WZ + 0.1, frameM);   // sill
const woodTex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d"); g.fillStyle = "#C79A64"; g.fillRect(0, 0, 512, 256); const r2 = rng(3);
  for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${90 + r2() * 50 | 0},${55 + r2() * 30 | 0},${25 + r2() * 20 | 0},${0.12 + r2() * 0.18})`; g.lineWidth = 0.6 + r2() * 1.6; g.beginPath(); const y = r2() * 256; g.moveTo(0, y); g.bezierCurveTo(170, y + (r2() - 0.5) * 8, 340, y + (r2() - 0.5) * 8, 512, y + (r2() - 0.5) * 6); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })();
const tileTex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#F2EEE2"; g.fillRect(0, 0, 512, 128); g.strokeStyle = "#CFC8B5"; g.lineWidth = 3; for (let x = 0; x <= 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); } for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t; })();
box(5.4, 0.86, 1.3, 0, 0.43, -1.17, cabM); box(5.5, 0.04, 1.34, 0, 0.88, -1.17, patch(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 })));     // the counter: cabinets, then the top at y = 0.90
box(5.4, 0.3, 0.02, 0, 1.05, -1.79, patch(new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.35 })), false);   // tiles behind the counter
for (let i = -2; i <= 2; i++) box(0.98, 0.7, 0.02, i * 1.08, 0.43, -0.5, std("#6B7990", 0.6), false);   // cabinet doors
const TOP = 0.90;
for (let i = -2; i <= 2; i++) box(0.12, 0.012, 0.012, i * 1.08, 0.7, -0.485, steel, false);   // cabinet handles
{ const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 14), std('#B8683F', 0.7)); pot.position.set(-2.55, TOP + 0.045, -1.5); kitchen.add(pot); for (let k = 0; k < 7; k++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std('#4E8A4B', 0.8)); leaf.scale.set(1, 0.7, 1); leaf.position.set(-2.55 + Math.cos(k * 2.4) * 0.05, TOP + 0.14 + 0.05 * (k % 3), -1.5 + Math.sin(k * 2.4) * 0.05); kitchen.add(leaf); }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#E7DFCB', 0.5, 0, { side: THREE.DoubleSide })); bowl.position.set(0.15, TOP + 0.1, -1.55); kitchen.add(bowl);
  for (const [x, c2] of [[0.1, '#E0A92E'], [0.19, '#C8442B'], [0.15, '#7FA84A']]) { const fr = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), std(c2, 0.5)); fr.position.set(x, TOP + 0.05, -1.55 + (x - 0.15) * 0.4); kitchen.add(fr); }
  box(0.28, 0.02, 0.18, 1.0, TOP + 0.011, -1.55, std('#B99668', 0.7), false); }
// the sink and the tap
box(0.9, 0.012, 0.6, -2.1, TOP + 0.006, -1.1, steel, false); box(0.78, 0.004, 0.46, -2.1, TOP + 0.014, -1.1, std("#6E7682", 0.3, 0.6), false);
const CUPX = -0.3, CUPZ = -1.0;
box(0.022, 0.2, 0.022, CUPX, TOP + 0.1, -1.55, steel, false); box(0.02, 0.02, 0.56, CUPX, TOP + 0.21, -1.27, steel, false);
const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.007, 0.03, 12), steel); nozzle.position.set(CUPX, TOP + 0.195, -1.0); kitchen.add(nozzle);
const TAPY = TOP + 0.195 - 0.015;                                                          // the tap's tip (where a drop forms)
const TAPZ = CUPZ;
// the cup: a lathe with a coffee surface, the same cup all film
const cupG = new THREE.Group(); cupG.position.set(CUPX, TOP + 0.005, CUPZ); kitchen.add(cupG);
{ const prof = [[0.001, 0], [0.032, 0], [0.04, 0.004], [0.046, 0.09], [0.043, 0.09], [0.0365, 0.008], [0.001, 0.007]].map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), std("#F6F3EA", 0.35, 0, { side: THREE.DoubleSide })); cupG.add(m); edgeSrc.push(m);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 20, Math.PI), std("#F6F3EA", 0.35)); h.rotation.z = -Math.PI / 2; h.position.set(0.05, 0.05, 0); cupG.add(h); }
const WLEVEL = 0.07;
const water = new THREE.Mesh(new THREE.CylinderGeometry(0.0395, 0.034, WLEVEL, 40), patch(new THREE.MeshPhysicalMaterial({ color: 0x5b3a22, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.97 })));
water.position.y = WLEVEL / 2 + 0.008; cupG.add(water);
const surfY = 0.008 + WLEVEL;
// the apple, the stove and pan with popcorn, the chip, the flashlight and its ruler
const APPX = 0.8, APPY = TOP + 0.04;
const apple = new THREE.Mesh(new THREE.SphereGeometry(0.04, 28, 20), std("#B0261C", 0.45)); apple.position.set(APPX, APPY, CUPZ); kitchen.add(apple);
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.012, 6), std("#4A3220")); stem.position.set(APPX, APPY + 0.042, CUPZ); kitchen.add(stem);
box(0.95, 0.02, 0.7, 1.82, TOP + 0.02, -1.1, std("#2B2F37", 0.5), true);
for (const dx of [-0.25, 0.25]) for (const dz of [-0.17, 0.17]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 6, 24), std("#16181D", 0.5)); ring.rotation.x = Math.PI / 2; ring.position.set(1.82 + dx, TOP + 0.034, -1.1 + dz); kitchen.add(ring); }
const PANX = 1.57, PANZ = -1.0, PANY = TOP + 0.03;
const pan = new THREE.Group(); pan.position.set(PANX, PANY, PANZ); kitchen.add(pan);
{ const prof = [[0.001, 0], [0.085, 0], [0.095, 0.01], [0.105, 0.045], [0.1, 0.045], [0.09, 0.012], [0.001, 0.008]].map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), std("#2A2D33", 0.45, 0.5, { side: THREE.DoubleSide })); pan.add(m); edgeSrc.push(m);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.018), std("#1B1D22", 0.5)); hd.position.set(0.18, 0.04, 0); pan.add(hd); }
const kernels = []; const rk = rng(11);
const KERN_COL = "#E7B83A", FOAM_COL = "#FFFBF0";
for (let i = 0; i < 16; i++) { const a = rk() * Math.PI * 2, d = Math.sqrt(rk()) * 0.075; const m = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), std(KERN_COL, 0.5)); m.scale.set(1, 0.85, 0.8); m.position.set(Math.cos(a) * d, 0.0145, Math.sin(a) * d); m.rotation.set(rk() * 3, rk() * 3, rk() * 3); pan.add(m); kernels.push(m); }
const HERO = kernels[0]; HERO.position.set(0.0, 0.0145, 0.0);
const foam = new THREE.Group(); pan.add(foam);                                              // the popped kernel: lumpy white foam
const foamBits = []; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), std(FOAM_COL, 0.9)); const a = rk() * 6.28, e = (rk() - 0.3) * 1.4; m.userData = { dir: new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e) * 0.6 + 0.4, Math.sin(a) * Math.cos(e)), s: 0.5 + rk() * 0.6 }; foam.add(m); foamBits.push(m); }
const hullA = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8, 0, Math.PI), std(KERN_COL, 0.5, 0, { side: THREE.DoubleSide })), hullB = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8, 0, Math.PI), std(KERN_COL, 0.5, 0, { side: THREE.DoubleSide }));
pan.add(hullA, hullB);
const CHIPX = 2.4, CHIPZ = -0.85;
const chipB = box(0.07, 0.006, 0.05, CHIPX, TOP + 0.003, CHIPZ, std("#1F7A55", 0.5), false);
const chipD = box(0.03, 0.006, 0.03, CHIPX, TOP + 0.009, CHIPZ, std("#16181D", 0.4), false);
const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a1a })); led.position.set(CHIPX + 0.025, TOP + 0.012, CHIPZ + 0.018); kitchen.add(led);
const FLX = -2.5, FLY = TOP + 0.022, FLZ = -1.0;
box(0.14, 0.04, 0.04, FLX - 0.07, FLY, FLZ, std("#2F3640", 0.5), false);
const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.008, 18), new THREE.MeshBasicMaterial({ color: 0xfff3c8 })); lens.rotation.z = Math.PI / 2; lens.position.set(FLX + 0.004, FLY, FLZ); kitchen.add(lens);
const rulerG = new THREE.Group(); kitchen.add(rulerG);
{ const rm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.002, 0.03), std("#F2EBD1", 0.6, 0, { noclip: true })); rm.position.set(FLX + 0.22, TOP + 0.001, FLZ - 0.05); rulerG.add(rm);
  for (let i = 0; i <= 200; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(0.0004, 0.0021, i % 10 === 0 ? 0.016 : i % 5 === 0 ? 0.012 : 0.008), new THREE.MeshBasicMaterial({ color: 0x1b1e24 })); tk.position.set(FLX + 0.02 + i * 0.001, TOP + 0.0016, FLZ - 0.05 + (i % 10 === 0 ? -0.007 : i % 5 === 0 ? -0.005 : -0.003)); rulerG.add(tk); } }
const hang = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 14, 10), patch(new THREE.MeshPhysicalMaterial({ color: 0x9fcdf2, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.95 }), false)); kitchen.add(hang);   // the drop at the tap / frozen over the cup

// the backyard: a sky backdrop (a storm that darkens), a lawn, a feeder
const skyTex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#9DB7D6"); gr.addColorStop(0.65, "#D7E2EA"); gr.addColorStop(0.7, "#8FA97F"); gr.addColorStop(1, "#5E7A55");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: skyTex })); sky.position.set(-1.0, 2.0, -4.6); scene.add(sky);
const stormMat = new THREE.MeshBasicMaterial({ color: 0x1D2331, transparent: true, opacity: 0 }); const storm = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), stormMat); storm.position.set(-1.0, 2.0, -4.55); scene.add(storm);
const feeder = new THREE.Group(); feeder.position.set(-1.5 + 0.215, 1.865, -1.45); scene.add(feeder);
{ const fm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.13, 18), new THREE.MeshStandardMaterial({ color: 0xD9372B, roughness: 0.4 })); feeder.add(fm); const port = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0xF2C94C, roughness: 0.5 })); port.rotation.z = Math.PI / 2; port.position.set(-0.04, 0.0, 0); feeder.add(port); { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const cx = cv.getContext("2d"), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(20,22,26,0.55)"); gr.addColorStop(1, "rgba(20,22,26,0)"); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64); const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); sh.position.set(-0.018, -0.01, 0.036); feeder.add(sh); } const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.4, 5), new THREE.MeshBasicMaterial({ color: 0x333333 })); st.position.y = 0.26; feeder.add(st); }

// wire overlay: the kitchen is drawn on (wireframe, then solid behind a sweeping line)
const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(COB), transparent: true, opacity: 0.8, clippingPlanes: [planeWire] });
const wires = new THREE.Group(); scene.add(wires);
for (const m of edgeSrc) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), wireMat); e.position.copy(m.position); e.rotation.copy(m.rotation); e.scale.copy(m.scale); (m.parent === kitchen ? wires : (() => { const g = new THREE.Group(); g.position.copy(m.parent.position); wires.add(g); return g; })()).add(e); }

// ── flyers: a body, a head and wings that sweep and flip; ghost copies stand in for what the eye blends ──
const GHOSTS = 14;
const mkFlyer = (scale, body, wingCol, kind = "fly") => {      // a fly or a mosquito: thorax, banded abdomen, head with big eyes, legs, and two veined translucent wings that sweep and flip
  const g = new THREE.Group(), M = (c, r = 0.5, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }), mq = kind === "mosq";
  const th = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M(body, 0.45, 0.12)); th.scale.set(mq ? 0.5 : 0.6, mq ? 0.36 : 0.45, mq ? 0.36 : 0.45); th.position.set(0.25, 0.05, 0); g.add(th);
  const ab = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M(body, 0.5, 0.05)); ab.scale.set(mq ? 1.1 : 0.85, mq ? 0.2 : 0.4, mq ? 0.2 : 0.4); ab.position.set(mq ? -0.95 : -0.7, -0.03, 0); ab.rotation.z = mq ? -0.12 : -0.1; g.add(ab);
  for (let k = 0; k < 4; k++) { const band = new THREE.Mesh(new THREE.TorusGeometry(mq ? 0.2 : 0.4, 0.035, 6, 18), M(0xCFC8B8, 0.6)); band.rotation.y = Math.PI / 2; band.scale.set(1, 1, 1); band.position.set((mq ? -0.55 : -0.45) - k * (mq ? 0.32 : 0.24), -0.03, 0); g.add(band); }
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), M(body, 0.5, 0.1)); hd.position.set(0.9, 0.04, 0); g.add(hd);
  for (const sd of [-1, 1]) { const ey = new THREE.Mesh(new THREE.SphereGeometry(mq ? 0.14 : 0.2, 12, 9), M(mq ? 0x1B1B1B : 0x8E2A1E, 0.3, 0.2)); ey.position.set(1.0, 0.12, sd * 0.2); g.add(ey);
    for (let k = 0; k < 3; k++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, mq ? 1.2 : 0.7, 5), M(0x2A2A2A, 0.6)); lg.position.set(0.35 - k * 0.32, -0.45, sd * (0.18 + 0.08 * k)); lg.rotation.z = (k - 1) * 0.35; lg.rotation.x = sd * 0.4; g.add(lg); } }
  if (mq) { const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.025, 0.7, 6), M(0x222222)); pr.rotation.z = -Math.PI / 2; pr.position.set(1.5, -0.04, 0); g.add(pr); }
  const wsh = new THREE.Shape(); wsh.moveTo(0, 0); wsh.bezierCurveTo(mq ? 0.16 : 0.34, 0.2, mq ? 0.16 : 0.34, 0.95, 0.02, mq ? 1.7 : 1.3); wsh.bezierCurveTo(-0.1, 0.8, -0.14, 0.3, 0, 0);
  const wings = [];
  for (let i = 0; i < GHOSTS; i++) for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(0.1, 0.3, side * 0.14); hinge.rotation.order = "ZXY";
    const wm = new THREE.Mesh(new THREE.ShapeGeometry(wsh, 10), new THREE.MeshBasicMaterial({ color: wingCol, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    hinge.add(wm);
    const vein = new THREE.Mesh(new THREE.PlaneGeometry(0.012, mq ? 1.5 : 1.15), new THREE.MeshBasicMaterial({ color: 0x55616B, transparent: true, opacity: 0.7, depthWrite: false })); vein.position.set(0.05, (mq ? 1.5 : 1.15) / 2, 0.001); wm.add(vein); wm.userData.vein = vein;
    g.add(hinge); wings.push({ hinge, wm, i, side });
  }
  g.scale.setScalar(scale); scene.add(g); return { g, wings, scale };
};
const poseFlyer = (fl, hz, tReal, blur, amp = 1.0) => {                                 // blur: 0 = one crisp pose, 1 = many poses of one beat, faint
  for (const w of fl.wings) {
    const on = blur > 0.01 || w.i === 0; w.hinge.visible = on; if (!on) continue;
    w.tip.visible = blur <= 0.01;
    const ph = hz * tReal + (blur > 0.01 ? w.i / GHOSTS : 0);
    const a = Math.sin(ph * Math.PI * 2) * 1.0 * amp, fl2 = Math.cos(ph * Math.PI * 2);
    w.hinge.rotation.set(w.side * fl2 * 0.7, 0, 0); w.hinge.rotation.y = -a * 0.9 * w.side * 0 + 0; w.hinge.rotation.z = 0;
    w.hinge.rotation.set(0, 0, -a * 0.95 + 0.1); void fl2;   // a flap: both wings up and down about the body's long axis
    w.wm.material.opacity = blur > 0.01 ? 0.08 + 0.05 * (1 - blur) : 0.55; if (w.wm.userData.vein) w.wm.userData.vein.material.opacity = blur > 0.01 ? 0.03 : 0.7; w.hinge.rotation.x = w.side * 0.25 * Math.sin(2 * ph * Math.PI * 2 + 0.6); w.hinge.rotation.y = w.side * 0.5 * Math.cos(ph * Math.PI * 2);
  }
};
const flyH = mkFlyer(0.03, 0x2B2E34, 0xDDE6EE), flyC = mkFlyer(0.03, 0x2B2E34, 0xDDE6EE), mosq = mkFlyer(0.034, 0x3B3F46, 0xDDE6EE, "mosq");
// the hummingbird: a tapered body (emerald back, pale belly), a ruby throat, a small head with a long thin bill and an eye with a highlight, a forked tail, and two long narrow wings that
// beat in a figure of eight (sweep forward and back, tip loops via a second-harmonic tilt, flip at each end of the stroke); the ghosts stand in for what the eye blends at full speed
// a small studio-less "environment" for the bird only: a leafy sky dome, a bright window behind it and a dim room in front, so the clearcoat, throat and iridescence have something to reflect
const birdEnv = (() => { const es = new THREE.Scene(), dome = new THREE.SphereGeometry(10, 32, 20), P = dome.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
  for (let k = 0; k < P.count; k++) { const y = P.getY(k) / 10; if (y > 0.1) c.setRGB(0.55, 0.75, 1.0).multiplyScalar(0.9); else if (y > -0.2) c.setRGB(0.28, 0.5, 0.18).multiplyScalar(0.7); else c.setRGB(0.55, 0.42, 0.3).multiplyScalar(0.6); col.set([c.r, c.g, c.b], k * 3); }
  dome.setAttribute("color", new THREE.BufferAttribute(col, 3)); es.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 4.8, 3.6) })); win.position.set(0.8, 1, -8); es.add(win);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.95, 1.1) })); fill.position.set(-3, 1, 7); fill.lookAt(0, 0, 0); es.add(fill);
  const pm = new THREE.PMREMGenerator(renderer), tx = pm.fromScene(es, 0.03).texture; pm.dispose(); return tx; })();
const BILL_TIP = new THREE.Vector3(1.99, 0.03, 0);   // the bill is about a quarter of the bird's length, nose to tail tip
const featherTex = (() => { const cv = document.createElement("canvas"); cv.width = 256; cv.height = 512; const g = cv.getContext("2d");   // a dark-grey vane: barbs fanning out from the root, translucent toward the trailing edge
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "rgba(92,102,112,0.96)"); gr.addColorStop(0.55, "rgba(128,138,148,0.8)"); gr.addColorStop(1, "rgba(176,186,196,0.45)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  for (let k = 0; k < 26; k++) { const a = -0.22 + (k / 25) * 0.5, x0 = 70 + 8 * Math.sin(k), y0 = 6; g.strokeStyle = k % 2 ? "rgba(38,44,52,0.5)" : "rgba(220,228,236,0.3)"; g.lineWidth = k % 2 ? 2.2 : 1.4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.sin(a) * 520 + 160, 500); g.stroke(); }
  g.strokeStyle = "rgba(14,16,20,0.9)"; g.lineWidth = 3; g.beginPath(); g.moveTo(82, 0); g.quadraticCurveTo(96, 250, 116, 512); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const tipGeo = new THREE.SphereGeometry(0.01, 4, 3), tipMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
const mkBird = () => {
  const g = new THREE.Group();
  // one smooth skin from tail to head: a spline through the profile, lathed finely (no facets), emerald back shading to teal on the head, pale grey belly
  const pts = [[0.04, -0.66], [0.11, -0.54], [0.22, -0.34], [0.31, -0.02], [0.325, 0.2], [0.3, 0.42], [0.215, 0.6], [0.135, 0.72], [0.14, 0.82], [0.17, 0.93], [0.175, 1.03], [0.15, 1.12], [0.09, 1.19], [0.0, 1.225]].map(([r, x]) => new THREE.Vector2(r, x));   // a compact, full-chested body (about 2.4 diameters long), a narrow neck, a round head (60% of the body's width)
  const spl = new THREE.SplineCurve(pts), prof = spl.getPoints(90).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y));
  const bg = new THREE.LatheGeometry(prof, 72); bg.rotateZ(-Math.PI / 2);
  { const pos = bg.attributes.position, col = new Float32Array(pos.count * 3), emerald = new THREE.Color(0x1C9A52), bronze = new THREE.Color(0x5E9A2E), teal = new THREE.Color(0x0E9486), belly = new THREE.Color(0xDAD8CE), c = new THREE.Color(), up = new THREE.Color();
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), y = pos.getY(k), m = Math.min(1, Math.max(0, (y + 0.26) / 0.2)), sm = m * m * (3 - 2 * m);
      up.copy(emerald).lerp(bronze, Math.min(1, Math.max(0, (-x - 0.0) / 0.6)) * 0.6).lerp(teal, Math.min(1, Math.max(0, (x - 0.75) / 0.35)) * 0.8);
      c.copy(belly).lerp(up, sm); col.set([c.r, c.g, c.b], k * 3); }
    bg.setAttribute("color", new THREE.BufferAttribute(col, 3)); }
  g.add(new THREE.Mesh(bg, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.28, sheen: 0.6, sheenColor: new THREE.Color(0xBFFFE0), sheenRoughness: 0.5, iridescence: 0.45, iridescenceIOR: 1.6 })));
  const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.034, 0.78, 12), new THREE.MeshPhysicalMaterial({ color: 0x14161A, roughness: 0.3, clearcoat: 0.6 })); bill.rotation.z = -Math.PI / 2; bill.position.set(1.6, 0.04, 0); g.add(bill);
  const gorMat = new THREE.MeshPhysicalMaterial({ color: 0xC4144C, roughness: 0.22, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.12, iridescence: 1, iridescenceIOR: 1.8, emissive: 0xFF2A5E, emissiveIntensity: 0.15 });
  const gor = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), gorMat); gor.scale.set(0.2, 0.085, 0.15); gor.position.set(0.93, -0.13, 0); g.add(gor);   // the ruby throat: its glow flashes as the bird turns (set per frame)
  for (const sd of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0x08080A, roughness: 0.05, clearcoat: 1 })); eye.position.set(1.04, 0.07, sd * 0.158); g.add(eye);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xFFFFFF })); hl.position.set(1.06, 0.085, sd * 0.19); g.add(hl);
  }
  { const tsh = new THREE.Shape(); tsh.moveTo(0, 0.1); tsh.lineTo(-0.5, 0.24); tsh.lineTo(-0.38, 0.02); tsh.lineTo(-0.5, -0.22); tsh.lineTo(0, -0.1); tsh.closePath();   // a short forked tail, a fifth of the body
    for (const rx of [-0.38, 0, 0.38]) { const tm = new THREE.Mesh(new THREE.ShapeGeometry(tsh), new THREE.MeshStandardMaterial({ color: 0x14301F, roughness: 0.6, side: THREE.DoubleSide })); tm.position.set(-0.62, -0.02, 0); tm.rotation.x = rx * 1.15; g.add(tm); } }
  const wings = [], wsh = new THREE.Shape(); wsh.moveTo(-0.06, 0); wsh.bezierCurveTo(0.22, 0.2, 0.22, 0.9, 0.05, 2.0); wsh.bezierCurveTo(-0.06, 1.2, -0.12, 0.5, -0.06, 0);
  const wgeo = new THREE.ShapeGeometry(wsh, 12); { const P = wgeo.attributes.position, uv = new Float32Array(P.count * 2); for (let k = 0; k < P.count; k++) { uv[2 * k] = (P.getX(k) + 0.14) / 0.4; uv[2 * k + 1] = 1 - P.getY(k) / 2.0; } wgeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); }
  for (let i = 0; i < GHOSTS; i++) for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(0.12, 0.22, side * 0.1); hinge.rotation.order = "ZXY";
    const wm = new THREE.Mesh(wgeo, new THREE.MeshBasicMaterial({ map: featherTex, color: 0xFFFFFF, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide }));
    const tip = new THREE.Mesh(tipGeo, tipMat); tip.position.set(0.02, 1.7, 0); hinge.add(tip);   // draws nothing, but the finish's motion probe follows it, so the wing tip's speed sets the shutter samples (the real motion blur)
    wm.scale.set(1.2, 1.2, 1); hinge.add(wm); g.add(hinge); wings.push({ hinge, wm, i, side, tip });
  }
  g.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { o.material.envMap = birdEnv; o.material.envMapIntensity = o.material === gorMat ? 1.0 : 0.3; } });
  g.scale.setScalar(0.075); scene.add(g); return { g, wings, scale: 0.075, gor: gorMat };
};
const poseBird = (fl, hz, tReal, blur) => {
  for (const w of fl.wings) {
    const trail = blur <= 0.01 && w.i >= 1 && w.i <= 4, on = blur > 0.01 || w.i === 0 || trail; w.hinge.visible = on; if (!on) continue;   // in a hover the wing keeps a faint trail of its last few positions: the fan
    w.tip.visible = blur <= 0.01 && w.i === 0;
    const ph = (hz * tReal + (blur > 0.01 ? w.i / GHOSTS : -w.i * 0.013)) * Math.PI * 2;
    w.hinge.rotation.z = -Math.sin(ph) * 1.0 + 0.1;                         // the sweep, forward and back
    w.hinge.rotation.x = w.side * 0.38 * Math.sin(2 * ph + 0.6);            // the second harmonic: the tip draws a figure of eight
    w.hinge.rotation.y = w.side * 0.7 * Math.cos(ph);                       // the flip at each end of the stroke
    w.wm.material.opacity = blur > 0.01 ? 0.06 + 0.05 * (1 - blur) : (trail ? 0.3 * (1 - (w.i - 1) / 4.5) : 0.94);
  }
};
const hum = mkBird();
const birdShadow = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const cx = cv.getContext("2d"), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(30,24,18,0.7)"); gr.addColorStop(1, "rgba(30,24,18,0)"); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); m.visible = false; scene.add(m); return m; })();   // the bird's soft shadow on a plate's feeder dish
const plateRig = new THREE.Group(); plateRig.visible = false; scene.add(plateRig);   // a plate's own frame for the code subjects that live in the kitchen (the crown, the drop): origin on the plate's water surface, scaled to the plate's pixels
const birdRim = new THREE.DirectionalLight(0xFFD9A0, 3.6); birdRim.position.set(0.7, 0.9, -4.0); birdRim.target.position.set(0, 0.4, -1.0); const birdFill = new THREE.DirectionalLight(0xBCD6FF, 1.25); birdFill.position.set(-1.2, 0.2, 3.0); birdFill.target.position.set(0, 0.4, -1.0); birdRim.visible = birdFill.visible = false; scene.add(birdRim, birdRim.target, birdFill, birdFill.target);   // on a plate: the window is behind the bird (a warm back light) and the room fills softly from the front
const keyLights = [[scene.children.find((o) => o.isHemisphereLight), 1.1], [sun, 1.7], [winLight, 1.1], [rim, 0.5]];
const trail = []; for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0x20232A, transparent: true, opacity: 0.25 })); m.visible = false; scene.add(m); trail.push(m); }

// ── the splash: a crown of spikes at the rim, droplets that pinch off, ripples; the cup rings ──
const crown = new THREE.Group(); crown.position.set(0, surfY, 0); cupG.add(crown);
// clear water for the coronet: opaque glass-like shading (no white): the plate behind it is sampled through the surface (shifted by the normal), Fresnel brightens the edges, the window glints sharp, a faint blue stays at the base
const wU = { uPlateR: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uZS: { value: new THREE.Vector4(1, 0, 0, 1) }, uRefr: { value: 46 } };
const waterMat = new THREE.MeshPhysicalMaterial({ color: 0xFFFFFF, roughness: 0.02, side: THREE.DoubleSide });
waterMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, wU);
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D uPlateR; uniform vec2 uRes; uniform vec4 uZS; uniform float uRefr;\n" + ACES_INV_GLSL)
    .replace("#include <opaque_fragment>", `
  vec3 N = normalize(normal); if (!gl_FrontFacing) N = -N; vec3 V = normalize(vViewPosition); float ndv = clamp(dot(N, V), 0.0, 1.0), fr = pow(1.0 - ndv, 3.0);
  vec2 sp = vec2(gl_FragCoord.x - uRes.x * 0.5 - uZS.y, (uRes.y - gl_FragCoord.y) - uRes.y * 0.5 - uZS.z) - N.xy * vec2(-1.0, 1.0) * uRefr * uZS.x;
  vec2 pp = vec2(836.0 + sp.x / (uZS.w * uZS.x), 470.5 + sp.y / (uZS.w * uZS.x)); vec3 bg = vec3(0.5);
  if (uZS.w > 0.0) bg = texture2D(uPlateR, vec2(pp.x / 1672.0, 1.0 - pp.y / 941.0)).rgb;
  vec3 R = reflect(-V, N); float gl = pow(max(dot(R, normalize(vec3(0.45, 0.55, -0.7))), 0.0), 140.0), sky = 0.5 + 0.5 * R.y;
  vec3 col = bg * vec3(0.86, 0.94, 1.0); col = mix(col, vec3(0.62, 0.78, 1.0) * (0.35 + 0.5 * sky), fr * 0.6);
  col *= 1.0 - 0.55 * smoothstep(0.78, 0.98, 1.0 - ndv);
  outgoingLight = acesInv(clamp(col, 0.0, 1.0), 1.0) + vec3(1.0, 0.96, 0.88) * gl * 3.0 * (0.4 + 0.6 * fr);
  diffuseColor.a = opacity < 0.99 ? opacity * (0.45 + 0.55 * fr) : 1.0;
  #include <opaque_fragment>`); };
const crownMat = waterMat, sheetMat = waterMat.clone(); sheetMat.onBeforeCompile = waterMat.onBeforeCompile; sheetMat.transparent = true; sheetMat.opacity = 0.7; sheetMat.depthWrite = false; sheetMat.needsUpdate = true;
const spikes = [], tips = []; const NSP = 18; for (let i = 0; i < NSP; i++) { const tp = new THREE.Mesh(new THREE.SphereGeometry(0.0013, 12, 9), crownMat); crown.add(tp); tips.push(tp); const m = new THREE.Mesh(new THREE.ConeGeometry(0.0013, 1, 8), crownMat); m.userData.a = (i / NSP) * Math.PI * 2; crown.add(m); spikes.push(m); }
const sheet = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), sheetMat); sheet.frustumCulled = false; crown.add(sheet); let sheetKey = "";
const crater = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0x14246A, transparent: true, opacity: 0.3, depthWrite: false })); crater.rotation.x = -Math.PI / 2; crater.position.y = 0.0004; crown.add(crater);   // the depressed ring of water the coronet stands on   // the thin water wall between the jets
const crownRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0016, 6, 40), crownMat); crownRing.rotation.x = Math.PI / 2; crown.add(crownRing);
const drops = []; for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), crownMat); m.userData = { a: (i / 12) * Math.PI * 2 + 0.2, v: 0.35 + 0.25 * ((i * 7) % 5) / 5, w: 0.7 + 0.3 * ((i * 3) % 4) / 4 }; crown.add(m); drops.push(m); }
const ripples = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0007, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); m.rotation.x = Math.PI / 2; crown.add(m); ripples.push(m); }

// ── the bubble: a thin film with a hole that opens at the Taylor-Culick speed ──
const BUBX = -2.05, BUBY = TOP + 0.26, BUBZ = -1.05, BUBR = 0.025;
const bubMat = new THREE.MeshPhysicalMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5, roughness: 0.04, metalness: 0.0, iridescence: 1.0, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520], clearcoat: 1.0, side: THREE.DoubleSide, depthWrite: false, envMap: birdEnv, envMapIntensity: 2.4 });
// a soap film: nearly clear in the middle, bright and rainbow-banded toward the edge (fresnel), so it reads as a bubble in front of any photo
bubMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", `
  vec3 N = normalize(normal); bool ff = gl_FrontFacing; if (!ff) N = -N; vec3 V = normalize(vViewPosition); float ndv = abs(dot(N, V)), fr = pow(1.0 - ndv, 2.0), top = 0.5 + 0.5 * N.y;
  float thick = 0.3 + 0.55 * (1.0 - top) + 0.18 * sin(N.x * 7.0 + N.y * 5.0 + sin(N.y * 11.0) * 1.7) + 0.12 * sin(N.x * 17.0 - N.y * 9.0);   // thinner at the top, swirled
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + thick * 2.2 + fr * 0.8));   // magenta, green, gold
  float st = max(fr, 0.17) * (0.55 + 0.75 * top);
  vec2 w = (N.xy - vec2(0.38, 0.34)) / vec2(0.3, 0.26); float inR = step(abs(w.x), 1.0) * step(abs(w.y), 1.0), bar = smoothstep(0.0, 0.13, abs(w.x)) * smoothstep(0.0, 0.13, abs(w.y)), edge = smoothstep(1.0, 0.8, abs(w.x)) * smoothstep(1.0, 0.8, abs(w.y));
  float win = inR * bar * edge * (ff ? 1.0 : 0.0) * smoothstep(0.75, 0.5, ndv);   // the curved reflection of a window's panes on the film
  outgoingLight = outgoingLight * 0.2 + irid * st * 1.15 + vec3(1.0, 0.97, 0.9) * win * 2.2;
  diffuseColor.a = clamp(0.14 + fr * 0.8 + win * 0.75, 0.0, 0.97);
  #include <opaque_fragment>`); };
let bubTh = -1;
const bubPole = new THREE.Vector3(-0.5, 0.52, 0.69).normalize(), bubPoleZ = new THREE.Vector3(0, 0, 1), bv = new THREE.Vector3();
const bubQf = new THREE.Quaternion().setFromUnitVectors(bubPoleZ, bubPole), bubQId = new THREE.Quaternion(), bubQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bubPole);
const bubble = new THREE.Mesh(new THREE.SphereGeometry(BUBR, 40, 28), bubMat); bubble.rotation.x = Math.PI / 2; bubble.position.set(BUBX, BUBY, BUBZ); kitchen.add(bubble);   // the pole points at the camera: the hole opens there and grows to the equator and beyond
const rimG = new THREE.TorusGeometry(1, 0.016, 8, 128); { const P = rimG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k), r = Math.hypot(x, y), ph = Math.atan2(y, x), th = 1 + 0.75 * Math.sin(3 * ph + 0.4) + 0.5 * Math.sin(7 * ph + 1.3) + 0.3 * Math.sin(13 * ph);   // thicker and thinner stretches
    const k2 = Math.max(0.35, th), rc = 1, dx = x - (x / r) * rc, dy = y - (y / r) * rc; P.setXYZ(k, (x / r) * rc + dx * k2, (y / r) * rc + dy * k2, z * k2); } rimG.computeVertexNormals(); }
const rimR = new THREE.Mesh(rimG, new THREE.MeshBasicMaterial({ color: 0xf4f8ff, transparent: true, opacity: 0.62, depthWrite: false }));
for (let i = 0; i < 9; i++) { const a2 = (i / 9) * 6.2832 + 0.5 * Math.sin(i * 3.1), b = new THREE.Mesh(new THREE.SphereGeometry(0.03 + 0.02 * ((i * 5) % 3) / 2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })); b.position.set(Math.cos(a2), Math.sin(a2), 0); rimR.add(b); }   // a few beads on the lip
 kitchen.add(rimR);
const mist = []; { const rm = rng(11); for (let i = 0; i < 150; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.00035 + 0.0004 * rm() * rm(), 6, 5), new THREE.MeshBasicMaterial({ color: 0xF4F8FF, transparent: true, opacity: 0.8, depthWrite: false })); m.userData = { a: rm() * 6.2832, thI: 0.12 + 2.6 * rm(), vr: 0.7 + 1.2 * rm(), vz: 0.3 + 0.7 * rm() }; m.visible = false; kitchen.add(m); mist.push(m); } }   // the fine mist the tearing rim sheds

// the proxy room of a plate: black additive surfaces (they add nothing but the wave painter's band and ripples), matched to the plate's walls, floor, ceiling and table
const proxy = new THREE.Group(); proxy.visible = false; scene.add(proxy);
const proxyMat = patch(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false, side: THREE.DoubleSide }), false);
const proxyBox = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), proxyMat); m.position.set(x, y, z); m.frustumCulled = false; proxy.add(m); };
// the proxy room of a plate comes from its anchor.room {x0, x1, z0, h, table:{y, x0, x1, z0, z1}} (the default is plate-01's wide kitchen from the doorway: camera 1.06 m up, back wall 3.8 m away, counters 1.73 m left and 1.36 m right, ceiling 2.6 m, the table 1.3-2.6 m out)
let proxyKey = "";
const buildProxy = (R) => { const key = JSON.stringify(R); if (key === proxyKey) return; proxyKey = key; while (proxy.children.length) { const c = proxy.children[0]; proxy.remove(c); c.geometry.dispose(); }
  const w = R.x1 - R.x0, cx = (R.x0 + R.x1) / 2, d = -R.z0, h = R.h; proxyBox(w, h, 0.02, cx, h / 2, R.z0); proxyBox(0.02, h, d, R.x0, h / 2, R.z0 / 2); proxyBox(0.02, h, d, R.x1, h / 2, R.z0 / 2); proxyBox(w, 0.02, d, cx, 0.0, R.z0 / 2); proxyBox(w, 0.02, d, cx, h, R.z0 / 2);
  if (R.table) { const T = R.table; proxyBox(T.x1 - T.x0, 0.04, T.z1 - T.z0, (T.x0 + T.x1) / 2, T.y - 0.02, (T.z0 + T.z1) / 2); } };
buildProxy({ x0: -1.73, x1: 1.36, z0: -3.8, h: 2.6, table: { y: 0.78, x0: -0.35, x1: 0.33, z0: -2.6, z1: -1.3 } });
// ── sound: hands that clap, a ring (the wave painter draws it on every surface) ──
const waveRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 128), new THREE.MeshBasicMaterial({ color: 0xA8D4FF, transparent: true, opacity: 0.8, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false, side: THREE.DoubleSide })); waveRing.visible = false; scene.add(waveRing);
const waveFill = new THREE.Mesh(new THREE.CircleGeometry(0.93, 96), new THREE.MeshBasicMaterial({ color: 0x7FB6FF, transparent: true, opacity: 0.07, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false, side: THREE.DoubleSide })); waveFill.visible = false; scene.add(waveFill);
const hands = new THREE.Group(); scene.add(hands); const handL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.07), std("#D9A786", 0.7)), handR = handL.clone(); hands.add(handL, handR);
let CLAPX = 2.45, CLAPY = TOP + 0.32, CLAPZ = -0.8;   // where the clap is (a plate's anchor moves it)

// ── the bullet and the apple's spray ──
const bullet = new THREE.Group(); scene.add(bullet);
{ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xB5651D, roughness: 0.28, metalness: 0.9, envMap: birdEnv, envMapIntensity: 1.4 })); b.rotation.z = -Math.PI / 2; bullet.add(b);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.0038, 0.014, 12), new THREE.MeshStandardMaterial({ color: 0xB5651D, roughness: 0.28, metalness: 0.9, envMap: birdEnv, envMapIntensity: 1.4 })); nose.rotation.z = -Math.PI / 2; nose.position.x = 0.017; bullet.add(nose); }
// the plate's apple: a proxy mesh textured by CAMERA PROJECTION. Every vertex remembers where it sits in the photo (uvRest), so at rest each pixel is the photo's own pixel (pixel-identical);
// when the bullet leaves, the exit side bulges and the skin stretches with it, a ragged flesh crater opens, and code fragments fly. The photo's colours go through the finish's inverse curve (set/aces.js).
const appleU = { uPlate: { value: null }, uExit: { value: 0 }, uEntry: { value: 0 } };
const appleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
appleMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, appleU);
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 uvRest; varying vec2 vPUV; varying vec3 vLoc; uniform float uExit, uEntry;")
    .replace("#include <begin_vertex>", "vLoc = position; vPUV = uvRest; vec3 transformed = position; float yz2 = dot(position.yz, position.yz); transformed.x += exp(-yz2 / 0.00022) * step(0.0, position.x) * uExit * 0.004 + exp(-yz2 / 0.00002) * step(position.x, 0.0) * uEntry * 0.003;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vPUV; varying vec3 vLoc; uniform sampler2D uPlate; uniform float uExit, uEntry;\n" + ACES_INV_GLSL)
    .replace("#include <opaque_fragment>", `
  vec3 lin = texture2D(uPlate, vPUV).rgb;
  float dE = length(vLoc.yz), an = atan(vLoc.y, vLoc.z), jag = 0.2 * sin(an * 7.0 + 2.0) + 0.12 * sin(an * 13.0 + 0.5), rE = 0.013 * min(1.0, uExit * 3.0);
  float wm = smoothstep(rE * (1.0 + jag), rE * (0.8 + jag), dE) * step(0.0, vLoc.x) * step(0.001, uExit);
  vec3 wc = mix(vec3(0.07, 0.025, 0.02), mix(vec3(0.83, 0.72, 0.46), vec3(0.62, 0.45, 0.26), smoothstep(0.5 * rE, rE, dE)), smoothstep(0.3 * rE, 0.55 * rE, dE));
  float wb = exp(-dot(vLoc.yz, vLoc.yz) / 0.00022) * step(0.0, vLoc.x) * uExit; lin = mix(lin, mix(vec3(0.66, 0.5, 0.28), vec3(0.85, 0.74, 0.48), smoothstep(0.5, 1.0, wb)), smoothstep(0.22, 0.55, wb) * 0.92);
  lin = mix(lin, wc, wm * 0.96);
  float wn = smoothstep(0.0048, 0.0036, dE) * step(vLoc.x, 0.0) * step(0.001, uEntry); lin = mix(lin, vec3(0.05, 0.02, 0.015), wn);
  outgoingLight = acesInv(lin, 1.0);
  #include <opaque_fragment>`); };
const appleP = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), appleMat); appleP.geometry.scale(0.040, 0.0378, 0.040); appleP.frustumCulled = false; appleP.renderOrder = 2; let appleUVfor = null;
const appleUV = (rg) => { if (appleUVfor === rg) return; appleUVfor = rg; const F = rg.uvf || { cx: 836, cy: 470.5, ppm: 1790, w: 1672, h: 941 }, P = appleP.geometry.attributes.position, uv = new Float32Array(P.count * 2);
  for (let k = 0; k < P.count; k++) { const wx = rg.pos[0] + rg.scale * P.getX(k), wy = rg.pos[1] + rg.scale * P.getY(k), wz = rg.pos[2] + rg.scale * P.getZ(k), d = -wz; uv[2 * k] = (F.cx + F.ppm * wx / d) / F.w; uv[2 * k + 1] = 1 - (F.cy - F.ppm * (wy - 0.4) / d) / F.h; }
  appleP.geometry.setAttribute("uvRest", new THREE.BufferAttribute(uv, 2)); };
const MACH = CAL.bullet.mach, HALFANG = Math.asin(1 / MACH);
const coneM = new THREE.MeshBasicMaterial({ color: 0x9CB4FF, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), coneM); scene.add(cone);
const spray = []; const rs2 = rng(5); for (let i = 0; i < 70; i++) { const sz = 0.0011 + 0.0027 * rs2() * rs2(), skin = i % 4 === 0, g = new THREE.IcosahedronGeometry(sz, 2), P = g.attributes.position;
  for (let k = 0; k < P.count; k++) { const q = 1 + 0.28 * Math.sin(P.getX(k) / sz * 3.1 + i) * Math.cos(P.getY(k) / sz * 2.7 + 2 * i) + 0.12 * Math.sin(P.getZ(k) / sz * 5.0 + i * 0.7); P.setXYZ(k, P.getX(k) * q * (1 + 0.3 * (i % 4) / 4), P.getY(k) * q, P.getZ(k) * q); } g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: skin ? 0xB0261C : 0xEFE3C4, roughness: skin ? 0.35 : 0.3, clearcoat: 1, clearcoatRoughness: 0.12, emissive: skin ? 0x7A1410 : 0xC9B98E, emissiveIntensity: skin ? 0.3 : 0.4, envMap: birdEnv, envMapIntensity: 0.6 }));
  m.userData = { v: [50 + 130 * rs2(), (rs2() - 0.5) * 90, (rs2() - 0.5) * 90], s: 0.5 + rs2(), spin: [rs2() * 40, rs2() * 40, rs2() * 40] }; m.visible = false; scene.add(m); spray.push(m); }
// the pulp mist (hundreds of fine specks from the exit, a smaller puff back out of the entry) and the red skin petals that peel back around the exit
const mistV = []; { const rq = rng(21); for (let i = 0; i < 520; i++) { const back = i >= 400, th = (back ? 0.9 : 0.62) * Math.pow(rq(), 0.8), ph = rq() * 6.2832, sp = (back ? 25 : 40) + (back ? 70 : 190) * rq() * rq(); mistV.push({ d: [(back ? -1 : 1) * Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)], sp, back }); } }
const mistGeo = new THREE.BufferGeometry(); mistGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(mistV.length * 3), 3));
const mistTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 32; const c = cv.getContext("2d"), gr = c.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, "rgba(238,205,120,1)"); gr.addColorStop(1, "rgba(238,205,120,0)"); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })();
const mistPts = new THREE.Points(mistGeo, new THREE.PointsMaterial({ size: 0.0062, map: mistTex, transparent: true, depthWrite: false, opacity: 0.85, sizeAttenuation: true })); mistPts.frustumCulled = false; mistPts.visible = false; scene.add(mistPts);
const cloudN = 110, cloudV = []; { const rc = rng(31); for (let i = 0; i < cloudN; i++) { const th = 0.5 * Math.pow(rc(), 0.9), ph = rc() * 6.2832; cloudV.push({ d: [Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)], sp: 30 + 90 * rc() }); } }
const cloudGeo = new THREE.BufferGeometry(); cloudGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cloudN * 3), 3));
const cloudTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const c = cv.getContext("2d"), gr = c.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, "rgba(239,227,196,0.7)"); gr.addColorStop(0.5, "rgba(236,222,186,0.3)"); gr.addColorStop(1, "rgba(234,220,184,0)"); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
const cloudPts = new THREE.Points(cloudGeo, new THREE.PointsMaterial({ size: 0.024, map: cloudTex, transparent: true, depthWrite: false, opacity: 0.9, sizeAttenuation: true })); cloudPts.frustumCulled = false; cloudPts.visible = false; scene.add(cloudPts);   // the soft wet pulp cloud
const flapU = { uPlate: appleU.uPlate, uSkin: { value: new THREE.Vector4(1120 / 1672, 470 / 941, 70 / 1672, 130 / 941) } };
const flapMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });   // real skin on the outside (the plate's own apple skin pixels), wet cream flesh on the inside
flapMat.onBeforeCompile = (sh) => { sh.uniforms.uPlate = flapU.uPlate; sh.uniforms.uSkin = flapU.uSkin;
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vFU;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvFU = uv;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vFU; uniform sampler2D uPlate; uniform vec4 uSkin;\n" + ACES_INV_GLSL)
    .replace("#include <opaque_fragment>", `
  float al = 1.0 - vFU.y; vec2 su = vec2(uSkin.x + vFU.x * uSkin.z, 1.0 - (uSkin.y + al * uSkin.w));
  vec3 sk = texture2D(uPlate, su).rgb * (0.8 + 0.3 * (1.0 - al)); vec3 cr = mix(vec3(0.88, 0.78, 0.5), vec3(0.97, 0.9, 0.7), al);
  vec3 c = gl_FrontFacing ? cr : sk; c = mix(c, vec3(0.9, 0.82, 0.58), smoothstep(0.93, 0.99, al) * (gl_FrontFacing ? 0.0 : 0.8));
  outgoingLight = acesInv(clamp(c, 0.0, 1.0), 1.0);
  #include <opaque_fragment>`); };
const petals = []; for (let i = 0; i < 6; i++) { const g = new THREE.PlaneGeometry(1, 1, 5, 6), m = new THREE.Mesh(g, flapMat); m.frustumCulled = false; m.userData = { a: (i / 6) * 6.2832 + 0.35 + 0.2 * Math.sin(i * 2.3), k: 0.8 + 0.5 * ((i * 5) % 7) / 7, w: 0.011 + 0.004 * ((i * 3) % 4) / 4, L: 0.015 + 0.007 * ((i * 7) % 5) / 5 }; m.visible = false; scene.add(m); petals.push(m); }
const bendFlap = (m, bx, rE0, open) => { const u = m.userData, P = m.geometry.attributes.position, ca = Math.cos(u.a), sa = Math.sin(u.a), nx = 6, ny = 7;   // a thick skin flap curling outward and back around the exit hole
  for (let jj = 0; jj < ny; jj++) { const sN = jj / (ny - 1); let ax = 0, ar = 0; const nst = jj; for (let q = 0; q < nst; q++) { const f = (q + 0.5) / (ny - 1), phi = 0.35 + (0.5 + 2.1 * f) * open * u.k; ar += Math.cos(phi) * u.L / (ny - 1); ax += Math.sin(phi) * u.L / (ny - 1); }
    for (let ii = 0; ii < nx; ii++) { const w = (ii / (nx - 1) - 0.5) * u.w * (1 - 0.35 * sN), k = jj * nx + ii, rr = rE0 * 1.05 + ar; P.setXYZ(k, bx + ax, rr * ca - w * sa, rr * sa + w * ca); } }
  P.needsUpdate = true; m.geometry.computeVertexNormals(); };
// ── the storm: a leader tree in the window, a return stroke (drawn in the backdrop plane) ──
const SL = FILM.ev.leader, LZ = -4.4, TOPY = 6.6, GROUNDY = 0.15, LX0 = -1.2;
const mkSeg = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); scene.add(m); m.visible = false; return m; };
const setSeg = (m, a, b, w, op, col) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, LZ); m.rotation.z = Math.atan2(dy, dx); m.scale.set(L, w, 0.01); m.material.opacity = op; if (col) m.material.color.set(col); m.visible = op > 0.01; };
const rl = rng(33); const STEPS = SL.steps, PATH = [[LX0, TOPY]];
for (let i = 1; i <= STEPS; i++) { const p = PATH[i - 1]; PATH.push([i === STEPS ? LX0 + (rl() - 0.5) * 0.4 : p[0] + (rl() - 0.5) * 0.9, TOPY - (TOPY - GROUNDY) * i / STEPS]); }
const BRANCH = []; for (const [at, dir] of [[2, -1], [3, 1], [4, -1], [5, 1], [6, -1]]) { const pts = [PATH[at]]; for (let j = 1; j <= 3; j++) { const q = pts[j - 1]; pts.push([q[0] + dir * (0.35 + rl() * 0.5), q[1] - 0.45 - rl() * 0.4]); } BRANCH.push({ at, pts }); }
const mainSegs = PATH.slice(1).map(() => mkSeg()), mainGlow = PATH.slice(1).map(() => mkSeg()), brSegs = BRANCH.map((b) => b.pts.slice(1).map(() => mkSeg())), retSegs = PATH.slice(1).map(() => mkSeg());
const flashLight = new THREE.PointLight(0xcfe0ff, 0, 12); flashLight.position.set(-1.0, 2.0, -1.0); scene.add(flashLight);

// ── the macro stage (a human hair and the light front, mm ruler) and the lab bench (the MIT camera's bottle) ──
const macro = new THREE.Group(); macro.position.set(0, 3.0, 0); scene.add(macro);
{ const bk = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.006), new THREE.MeshBasicMaterial({ color: 0x07090d })); bk.position.z = -0.0006; macro.add(bk);
  const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.00005, 0.00005, 0.004, 14), new THREE.MeshStandardMaterial({ color: 0xC9A27A, roughness: 0.5 })); hair.position.z = -0.0002; macro.add(hair);
  const ml = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.00004, 0.00004), new THREE.MeshBasicMaterial({ color: 0xF2EBD1 })); ml.position.set(0, -0.00022, -0.00008); macro.add(ml);
  for (let i = -4; i <= 4; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(0.000004, 0.00004, 0.00004), new THREE.MeshBasicMaterial({ color: 0x1B1E24 })); tk.position.set(i * 0.0001, -0.00018, -0.00008); macro.add(tk); } }
macro.add(new THREE.AmbientLight(0xffffff, 0.35)); const frontPl = new THREE.Mesh(new THREE.BoxGeometry(0.000012, 0.0008, 0.0006), new THREE.MeshBasicMaterial({ color: 0xFFE8A8, transparent: true, opacity: 0.85 })); frontPl.position.z = -0.00015; macro.add(frontPl);
const litLayer = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0008, 0.0006), new THREE.MeshBasicMaterial({ color: 0xFFF2CF, transparent: true, opacity: 0.18, depthWrite: false })); macro.add(litLayer);
const lab = new THREE.Group(); lab.position.set(0, 3.0, 0); scene.add(lab);
{ const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 1.2), new THREE.MeshStandardMaterial({ color: 0x14171D, roughness: 0.6 })); table.position.y = -0.3; lab.add(table);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ color: 0x0A0C11 })); wall.position.set(0, 0.2, -0.5); lab.add(wall);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 28, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x9AD6C4, roughness: 0.08, transmission: 0.0, transparent: true, opacity: 0.25, side: THREE.DoubleSide })); bottle.rotation.z = Math.PI / 2; bottle.position.y = -0.18; lab.add(bottle);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.1, 0.16, 28, 1, true), bottle.material); neck.rotation.z = Math.PI / 2; neck.position.set(0.33, -0.18, 0); lab.add(neck);
  lab.add(new THREE.AmbientLight(0x88aaff, 0.5)); const key = new THREE.PointLight(0xaaccff, 0.8, 5); key.position.set(0, 0.5, 0.8); lab.add(key); }
const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.024, 18, 12), new THREE.MeshBasicMaterial({ color: 0xFFF4CE })); lab.add(pulse);
const pulseGhosts = []; for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshBasicMaterial({ color: 0xFFE9A8, transparent: true, opacity: 0.35 })); lab.add(m); pulseGhosts.push(m); }
macro.visible = lab.visible = false;

// ── camera: keys {t, look, fitW (metres across the frame at the look point), yaw} from compile.py ──
const CK = FILM.cam, lerp = (a, b, u) => a + (b - a) * u;
const camNow = (t) => {
  let i = CK.findIndex((k) => k.t > t); if (i < 0) i = CK.length - 1; if (i < 1) i = 1;
  const a = CK[i - 1], b = CK[i], u = a === b ? 1 : ease(b.ease || "p2")(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  const lw = (x, y) => Math.exp(lerp(Math.log(x), Math.log(y), u));
  return { look: [0, 1, 2].map((j) => lerp(a.look[j], b.look[j], u)), fitW: lw(a.fitW, b.fitW), yaw: lerp(a.yaw, b.yaw, u), pitch: lerp(a.pitch ?? 3, b.pitch ?? 3, u) };
};
const placeCam = (t) => {
  const c3 = plates.cam3(t);
  if (c3) {   // a plate's own pinhole camera: the push is a zoom, so the proxy room stays on the plate
    const z = plates.zoom(t); camera.position.set(...c3.pos); camera.fov = (2 * Math.atan(Math.tan((c3.fov * Math.PI) / 360) / z) * 180) / Math.PI; camera.near = 0.05; camera.far = 80; camera.updateProjectionMatrix(); camera.lookAt(...c3.target); camera.updateMatrixWorld(); return;
  }
  const c = plates.cam(t) || camNow(t), dr = driftAt(t), dist = c.fitW * (1 - 0.034 * dr) / (2 * Math.tan((VFOV * Math.PI) / 360) * (W / H)), y = ((c.yaw + 1.6 * dr + 0.9 * Math.sin(t * 0.55)) * Math.PI) / 180, p = ((c.pitch + 0.45 * Math.sin(t * 0.37 + 1.0)) * Math.PI) / 180;   // a slow sway: nothing is ever perfectly still
  camera.position.set(c.look[0] + dist * Math.sin(y) * Math.cos(p), c.look[1] + dist * Math.sin(p), c.look[2] + dist * Math.cos(y) * Math.cos(p));
  camera.near = Math.max(1e-5, dist * 0.05); camera.far = 80; camera.fov = VFOV; camera.updateProjectionMatrix(); camera.lookAt(c.look[0], c.look[1], c.look[2]); camera.updateMatrixWorld();
};

const fadeMat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, uniforms: { uA: { value: 0 } }, vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }", fragmentShader: "uniform float uA; void main(){ gl_FragColor = vec4(0.02, 0.025, 0.035, uA); }" });
const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMat); fadeQuad.renderOrder = 1000; fadeQuad.frustumCulled = false; scene.add(fadeQuad);
const dip = (t) => { let a = 0; for (const c of EV.fades) a = Math.max(a, 1 - E.inout2(seg(Math.abs(t - c), 0.2, 0.65))); return a; };   // a dip through black, 0.4 s fully black either side of nothing: |t - c| < 0.2 is black, gone by 0.65

// ── the overlay: captions, the factor (the one live number), badges, the end card ──
{ const st = document.createElement("style"); st.textContent = "#stage.night { --hud-plate: rgba(8,10,14,.86); --hud-cap-said: #fff; --hud-cap-next: #b9c1cc; --hud-note-bg: rgba(8,10,14,.82); --hud-badge-text: #e6e9ee; } #stage.night .hud-badge { background: rgba(8,10,14,.84) !important; color: #e6e9ee !important; } #stage.night .hud-badge .in, #stage.night .hud-badge .n { color: #e6e9ee !important; } #stage.night .hud-counter { background: rgba(8,10,14,.86); padding: .6vmin 1.4vmin .8vmin; } #stage.night .hud-counter .v { font-size: 6vmin; color: #fff; } #stage.night .hud-counter .u { font-size: 2.5vmin; color: #fff; } #stage.night .hud-counter .lb { font-size: 2vmin; max-width: 20vmin; color: #d3d9e1; margin-bottom: .4vmin; }"; document.head.appendChild(st); }   // night plates: dark pills (near-black, white text) and a smaller counter
const hud = createHud({ camera, captionY: typeof FILM.captionY === "object" ? FILM.captionY[H > W ? "9x16" : "16x9"] : FILM.captionY });
hud.captions(FILM.captions, { fade: 0.001 });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const fmtX = (v) => { if (v >= 1e6) { const [u, n] = v >= 1e12 ? [1e12, "trillion"] : v >= 1e9 ? [1e9, "billion"] : [1e6, "million"], q = v / u, r = q >= 9.95 ? Math.round(q) : Math.round(q * 10) / 10; return (r >= 1000 ? Math.round(r).toLocaleString("en-US") : String(r)) + " " + n; } const k = Math.log10(Math.max(v, 1)); const r = Math.round(k); if (Math.abs(k - r) < 0.012) return Math.round(Math.pow(10, r)).toLocaleString("en-US"); const s = Math.pow(10, k), d = Math.pow(10, Math.max(0, Math.floor(Math.log10(s)) - 1)); return (Math.round(s / d) * d).toLocaleString("en-US"); };
const SPN = FILM.spine[0], spineOpts = { value: (t) => Math.pow(10, kAt(t)), fmt: fmtX, unit: "×", label: FILM.labelKeys, t0: SPN.t0, t1: SPN.t1, minCh: 5 }, counterEl = hud.counter("spine", spineOpts);
placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);
const endEl = hud.end({ t0: ES - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style"); st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }"; document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: ES, fps: FILM.fps, head: ".t", fall: 90 });

// ── helpers ──
const sp = (x, y, z) => new THREE.Vector3(x, y, z);
const flightAt = (u) => { const x = 2.3 - 4.6 * u; return [x, 1.32 + 0.12 * Math.sin(u * 9) + 0.05 * Math.sin(u * 23), -0.55 + 0.1 * Math.sin(u * 5)]; };
const place = (fl, x, y, z, yaw = 0) => { fl.g.visible = true; fl.g.position.set(x, y, z); fl.g.rotation.set(0, yaw, 0); };

// a slow push-and-drift (a sine bump: still at both ends) over the holds that read as stills, so nothing sits motionless for more than a beat
const DRIFTS = [[19.4, 22.0], [343.2, 345.8], [474.7, 477.3], [487.2, 489.8], [498.2, 501.2], [515.4, 518.8], [520.4, 523.0], [531.5, 534.1]];
const driftAt = (t) => { for (const [a, b] of (FILM.drifts || (FILM.part ? [] : DRIFTS))) if (t > a && t < b) return Math.pow(Math.sin(Math.PI * (t - a) / (b - a)), 2); return 0; };
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const plateOn = plates.apply(t);
  { const an0 = plateOn ? plates.anchor(t) : null; document.getElementById("stage").classList.toggle("night", !!(an0 && an0.night)); }
  const k = kAt(t), F = Math.pow(10, k);
  const inLab = t >= EV.lab[0] && t < EV.lab[1], inMacro = t >= EV.hair[0] - 0.3 && t < EV.hair[1] + 4.1 && !inLab;
  fadeMat.uniforms.uA.value = dip(t);
  kitchen.visible = !inLab && !inMacro && !plateOn; wires.visible = kitchen.visible; sky.visible = storm.visible = kitchen.visible; feeder.visible = kitchen.visible && t < T.pop;
  macro.visible = inMacro; lab.visible = inLab;
  // the kitchen is drawn on (wireframe -> solid behind a sweeping line) during the method lines
  const [w0, w1] = EV.wire;
  planeSolid.constant = t < w0 ? 1e6 : t < w1 ? lerp(-3.3, 3.3, E.inout2(seg(t, w0 + 0.4, w1))) : 1e6;
  planeWire.constant = t < w0 || t >= w1 ? 1e6 : -lerp(-3.3, 3.3, E.inout2(seg(t, w0 + 0.4, w1)));
  wires.visible = kitchen.visible && t >= w0 && t < w1 + 0.2;
  // storm
  const stormK = E.inout2(seg(t, EV.storm - 1.0, EV.storm + 3.0)) * (1 - E.inout2(seg(t, T.light + 8, T.light + 14)));
  stormMat.opacity = 0.82 * stormK;
  // the fly's flight in the hook: once at 1x, then 2x, then 4x slower (the same second)
  for (const [t0, f] of [[EV.fly1, 1], [EV.fly2, 2], [EV.fly3, 4], [EV.fly4, 1]]) { /* handled below */ void t0; void f; }
  let flyHook = null;
  for (const [t0, f] of [[EV.fly1, 1], [EV.fly2, 2], [EV.fly3, 4], [EV.fly4, 1]]) { const r = (t - t0) / f; if (r >= 0 && r <= 1.0) flyHook = r; }
  // wings: hummingbird (10x), the blur demonstration, the fly by the cup
  if (window.CINEMA) window.CINEMA.pxPerSample = (t >= EV.bird[0] && t < EV.bird[1]) ? 9 : 3.5;   // a hovering bird's wing tips move 100 px a frame: fewer, wider shutter steps keep the render time sane
  birdRim.visible = birdFill.visible = false; for (const [l, i0] of keyLights) if (l) l.intensity = i0;
  hum.g.visible = flyH.g.visible = flyC.g.visible = mosq.g.visible = false; trail.forEach((m) => { m.visible = false; });
  if (flyHook !== null) {
    const u = flyHook, [x, y, z] = flightAt(u); place(flyH, x, y, z, Math.PI); poseFlyer(flyH, CAL.hz.fly, u * 1.0, 1.0);
    for (let i = 0; i < trail.length; i++) { const [tx, ty, tz] = flightAt(Math.max(0, u - (i + 1) * 0.014)); trail[i].visible = u > (i + 1) * 0.014; trail[i].position.set(tx, ty, tz); trail[i].material.opacity = 0.28 * (1 - i / trail.length); }
  }
  if (t >= EV.bird[0] && t < EV.bird[1]) {
    const r = (t - EV.bird[0]) / 10, b2 = EV.blur2 ? 1 - E.inout2(seg(t, EV.blur2[1] - 0.5, EV.blur2[1])) : 0, blurMix = Math.max(b2, E.inout2(seg(t, EV.blur[0], EV.blur[0] + 0.8)) * (1 - E.inout2(seg(t, EV.blur[1] - 0.6, EV.blur[1]))));
    const fr = blurMix > 0.01 ? Math.max(0.0, 1) : 1;
    { const ab = plates.anchor(t), bd = ab && ab.bird;   // a plate with a feeder: the bird hovers at its port, at the plate's scale
      if (bd) { const bob = [0.003 * Math.sin(r * 3), 0.0025 * Math.sin(r * 7), 0], q = bd.pos || [0, 0, 0]; place(hum, q[0], q[1], q[2], bd.yaw ?? -0.35); hum.g.rotation.z = bd.tilt ?? 0.18; hum.g.scale.setScalar(bd.scale);
        if (bd.tip) { hum.g.position.set(0, 0, 0); hum.g.updateMatrix(); const o = BILL_TIP.clone().applyMatrix4(hum.g.matrix); hum.g.position.set(bd.tip[0] - o.x + bob[0], bd.tip[1] - o.y + bob[1], bd.tip[2] - o.z); }   // the bill tip is held at the port; the body hovers behind it
        hum.gor.emissiveIntensity = 0.1 + 1.1 * Math.pow(Math.max(0, Math.sin(t * 1.9 + 0.4)), 5);   // the gorget flashes as it turns
        hum.g.rotation.y = (bd.yaw ?? -0.35) + 0.16 * Math.sin(t * 0.9); }
      else { hum.g.scale.setScalar(0.075); place(hum, -1.5 + 0.012 * Math.sin(r * 3), 1.86 + 0.01 * Math.sin(r * 7), -1.45, -0.4); hum.g.rotation.z = 0.2; }
      { const on = !!bd; birdRim.visible = birdFill.visible = on; for (const [l, i0] of keyLights) if (l) l.intensity = on ? i0 * 0.35 : i0; }
      birdShadow.visible = !!bd; if (bd && ab.shadow) { birdShadow.position.set(...ab.shadow.pos); birdShadow.scale.set(ab.shadow.w, ab.shadow.h, 1); birdShadow.material.opacity = ab.shadow.opacity ?? 0.3; } }
    poseBird(hum, CAL.hz.hum, blurMix > 0.01 ? (t - EV.bird[0]) / 1 : r, blurMix);
    if (blurMix <= 0.01) poseBird(hum, CAL.hz.hum, r, 0);
    void fr;
  }
  if (t >= EV.cupfly[0] && t < EV.cupfly[1]) { const a = t * 0.9; place(flyC, CUPX + 0.1 + 0.07 * Math.cos(a), TOP + 0.2 + 0.015 * Math.sin(a * 2), CUPZ + 0.12 * Math.sin(a), -a + Math.PI * 0.5); poseFlyer(flyC, CAL.hz.fly, (t - EV.cupfly[0]) / F, F < 50 ? 1 : 0, 1.0); }
  if (t >= EV.fly100[0] && t < EV.fly100[1]) { const a = t * 0.9; place(flyC, CUPX + 0.1 + 0.07 * Math.cos(a), TOP + 0.2 + 0.015 * Math.sin(a * 2), CUPZ + 0.12 * Math.sin(a), -a + Math.PI * 0.5); poseFlyer(flyC, CAL.hz.fly, (t - EV.fly100[0]) / F, 0, 1.0); }
  if (t >= EV.mosq[0] && t < EV.mosq[1]) { const a = t * 0.8 + 2; place(mosq, CUPX - 0.06 + 0.06 * Math.cos(a), TOP + 0.18 + 0.02 * Math.sin(a * 2), CUPZ + 0.1 * Math.sin(a), -a + Math.PI * 0.5); poseFlyer(mosq, CAL.hz.mosq, (t - EV.mosq[0]) / F, 0, 1.0); }
  // the tap drop, the crown
  const [d0, d1, d2] = EV.tapdrop; let hangV = false;
  if (t >= d0 && t < d2) { hangV = true; if (t < d1) { hang.position.set(CUPX, TAPY - 0.004 * E.in2(seg(t, d0, d1)), TAPZ); hang.scale.setScalar(2.5 * (0.3 + 0.7 * E.out2(seg(t, d0, d1 - 0.2)))); } else { const u = E.in2(seg(t, d1, d2)); hang.position.set(CUPX, lerp(TAPY - 0.004, TOP + 0.005 + surfY + 0.004, u), TAPZ); hang.scale.set(2.5, 2.5 * (1 + 0.4 * u), 2.5); } }
  const rC = (t - d2) / 100;   // the crown is drawn at 100x (this event's own factor, not the clock's present one)                                                                 // real seconds since the impact
  crown.visible = rC >= 0 && rC < 0.6; crown.position.x = 0; crown.position.z = 0; crown.rotation.set(0, 0, 0);
  if (crown.visible) {
    const rgK = (() => { const q = plates.anchor(t); return q && q.rig ? q.rig : null; })(), grow = Math.min(1, rC / 0.04), Rc = (0.007 + 0.03 * Math.sqrt(grow)) * (rgK ? rgK.rad : 1), Hc = rC < 0.04 ? 0.026 * Math.sin(Math.min(1, rC / 0.034) * Math.PI * 0.5) : Math.max(0, 0.026 * (1 - (rC - 0.04) / 0.05));
    const flare = 0.5, Hs = Hc * 0.78, Rt = Rc + Hs * Math.tan(flare) * 0.9, vis = Hc > 0.001;
    crownRing.visible = false; crater.visible = vis; crater.scale.setScalar(Math.max(1e-4, Rc * 1.1)); crater.material.opacity = 0.3 * Math.min(1, Hc / 0.01);
    sheet.visible = vis; { const key = Rc.toFixed(5) + "," + Hs.toFixed(5); if (vis && key !== sheetKey) { sheetKey = key; const pts = []; for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push(new THREE.Vector2(Rc + (Rt - Rc) * Math.pow(u, 1.25), Hs * u)); } sheet.geometry.dispose(); const lg = new THREE.LatheGeometry(pts, 108), LP = lg.attributes.position; for (let k = 0; k < LP.count; k++) { const x = LP.getX(k), z = LP.getZ(k), y = LP.getY(k), u = Math.min(1, y / Math.max(1e-6, Hs)), sc = 0.5 + 0.5 * Math.cos(18 * Math.atan2(z, x)); LP.setY(k, y * (1 - 0.32 * u * u * (1 - sc))); } sheet.geometry = lg; } }   // a scalloped rim: it dips between the jets
    spikes.forEach((s, i) => { const a = s.userData.a, k = 0.5 + 0.5 * Math.abs(Math.sin(a * 2.0 + 0.7) * Math.cos(a * 3.0 + 1.0)), h = Hc * 0.14 + Hc * 0.34 * k + 0.0005, ca = Math.cos(a), sa = Math.sin(a), lean = flare * 0.8;
      s.visible = vis; tips[i].visible = vis; s.scale.set(1, h, 1);
      const bx = ca * Rt, bz = sa * Rt, dx = Math.sin(lean) * ca, dz = Math.sin(lean) * sa, dy = Math.cos(lean);   // each jet leans on along the flare
      s.position.set(bx + dx * h / 2, Hs + dy * h / 2, bz + dz * h / 2); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz));
      tips[i].position.set(bx + dx * h, Hs + dy * h, bz + dz * h); tips[i].scale.setScalar(0.8 + 0.7 * k); });
    drops.forEach((m) => { const sepT = 0.03, rr = rC - sepT; m.visible = rr > 0 && rr < 0.12; if (!m.visible) return; const a = m.userData.a, v = m.userData.v; m.position.set(Math.cos(a) * (Rc + (v * 0.2 * rr * 10 * 0.1 + v * rr) * (rgK ? rgK.rad : 1)), 0.022 + 0.32 * rr - 4.9 * rr * rr * 2.2, Math.sin(a) * (Rc + v * rr * (rgK ? rgK.rad : 1))); });
    ripples.forEach((rp, i) => { const q = rC - i * 0.05; rp.visible = q > 0; if (!rp.visible) return; const rad = 0.01 + 0.4 * q * 0.18; rp.scale.set(rad, rad, rad); rp.material.opacity = 0.7 * Math.max(0, 1 - q * 1.6) * (rad < 0.036 ? 1 : 0); });
  }
  { const an = plates.anchor(t), rg = plateOn && an && an.rig ? an.rig : null;   // plate-03: the photo's mug is the cup; the drop and the crown are drawn in the plate's frame
    if (rg) {
      plateRig.visible = true; plateRig.position.set(...rg.pos); plateRig.scale.setScalar(H > W && rg.scale9 ? rg.scale9 : rg.scale); plateRig.rotation.set(rg.rotX ?? 0, 0, 0);
      if (rg.kind === "bubble") { if (bubble.parent !== plateRig) { plateRig.add(bubble); plateRig.add(rimR); } }
      else if (rg.kind === "apple") {
        if (appleP.parent !== plateRig) plateRig.add(appleP, bullet, cone, ...spray);
        appleUV(rg); if (rg.skin) flapU.uSkin.value.set(...rg.skin); if (!appleU.uPlate.value) { const im = plates.imageOf("applep"); if (im) { const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext("2d").drawImage(im, 0, 0); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.generateMipmaps = false; tx.minFilter = THREE.LinearFilter; tx.needsUpdate = true; appleU.uPlate.value = tx; } }
        appleP.visible = !!appleU.uPlate.value; }
      else { if (crown.parent !== plateRig) { plateRig.add(crown); plateRig.add(hang); } crown.position.set(0, 0, 0); }
      if (!rg.kind) { const sf = plates.shiftPx ? plates.shiftPx(t) : [0, 0]; wU.uZS.value.set(plates.zoom(t), sf[0], sf[1], Math.max(W / 1672, H / 941)); if (!wU.uPlateR.value) { const im = plates.imageOf("tapmug"); if (im) { const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext("2d").drawImage(im, 0, 0); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.generateMipmaps = false; tx.minFilter = THREE.LinearFilter; tx.needsUpdate = true; wU.uPlateR.value = tx; } } if (!wU.uPlateR.value) wU.uZS.value.w = -1; }
      if (hangV && !rg.kind) { const u = t < d1 ? 0 : E.in2(seg(t, d1, d2)); hang.position.set(0, t < d1 ? rg.tipY - 0.0025 * E.in2(seg(t, d0, d1)) : lerp(rg.tipY - 0.0025, 0.003, u), 0); hang.scale.set(rg.drop, rg.drop * (t < d1 ? 1 : 1 + 0.4 * u), rg.drop); }
      birdRim.visible = birdFill.visible = true; for (const [l, i0] of keyLights) if (l) l.intensity = i0 * 0.35;
    } else { plateRig.visible = false; if (crown.parent === plateRig) { cupG.add(crown); crown.position.set(0, surfY, 0); kitchen.add(hang); } if (bubble.parent === plateRig) { kitchen.add(bubble); kitchen.add(rimR); }  if (appleP.parent === plateRig) { plateRig.remove(appleP); scene.add(bullet, cone, ...spray, ...petals, mistPts, cloudPts); petals.forEach((m) => { m.visible = false; }); mistPts.visible = false; cloudPts.visible = false; } }
    hang.visible = hangV || (!rg && t >= EV.light9 - 2.0 && t < T.still + 1.0 && !inMacro && !inLab); }
  if (!hang.visible) hang.visible = false;
  void 0;
  if (!hangV && hang.visible) { hang.position.set(CUPX, TOP + 0.005 + surfY + 0.07, CUPZ); hang.scale.setScalar(2.6); }
  const hush = t >= EV.light9 - 2.0 && t < T.still + 1.0;
  // popcorn: the kernel jumps, the pop, the foam; the bubble
  const K = EV.kernel, rP = (t - K.pop) / 1000;
  kernels.forEach((m, i) => { m.visible = !(i === 0 && t >= K.pop - 0.2); });
  HERO.visible = t < K.pop - 0.2;
  { const j = seg(t, K.jump, K.jump + 0.9); HERO.position.y = 0.0145 + 0.012 * 4 * j * (1 - j) * (t < K.pop - 0.2 ? 1 : 0); HERO.rotation.z = j * 1.2; }
  const popOn = t >= K.pop - 0.2 && t < K.foamEnd + 5;
  hullA.visible = hullB.visible = popOn && rP > 0; foam.visible = popOn && rP > -0.0002;
  if (popOn) {
    const g = E.out3(Math.min(1, Math.max(0, rP) / 0.004)), settle = E.inout2(seg(t, K.foamEnd - 0.5, K.foamEnd + 1.5));
    foam.position.set(0, 0.0145 + 0.002, 0); foamBits.forEach((m) => { const s = 0.0085 * (0.6 + 2.0 * g * m.userData.s) * (1 - 0.35 * settle); m.scale.setScalar(s); m.position.copy(m.userData.dir).multiplyScalar(0.008 * g * (1 + 1.6 * m.userData.s) * (1 - 0.5 * settle)).add(sp(0, 0.006 * g, 0)); });
    const hh = Math.max(0, rP) / 0.004; hullA.position.set(-0.01 * hh, 0.0145 + 0.012 * hh, 0.004); hullA.rotation.set(0, 0, 0.5 + hh * 2.2); hullB.position.set(0.012 * hh, 0.0145 + 0.01 * hh, -0.004); hullB.rotation.set(0, 0, -0.5 - hh * 2.0);
  }
  { const B = EV.bubble, inB = t >= B.in - 0.5 && t < B.pop + 11.5, rB = (t - B.pop) / 1000;
    bubble.visible = inB && !(rB >= CAL.bubble_t * 1.02); rimR.visible = false;
    const bb = bubble.parent === plateRig ? [0, 0, 0] : [BUBX, BUBY, BUBZ];
    bubble.position.set(bb[0] + 0.01 * Math.sin(t * 0.7), bb[1] + 0.006 * Math.sin(t * 0.9) + 0.03 * (1 - E.out3(seg(t, B.in - 0.5, B.in + 3))), bb[2]);
    const onPlate = bubble.parent === plateRig, pd = onPlate ? bubPole : bubPoleZ;   // on a plate the tear starts off-centre (upper left of the face), so the lip sweeps across the sphere as a curved front
    if (onPlate) { bubble.quaternion.copy(bubQ); } else { bubble.rotation.set(Math.PI / 2, 0, 0); }
    const qf = onPlate ? bubQf : bubQId, bf = (x, y, z, o) => o.set(x, y, z).applyQuaternion(qf);
    const th = Math.max(0, Math.min(Math.PI, Math.PI * rB / CAL.bubble_t)); { const thq = Math.round((rB > 0 ? th : 0) * 60) / 60; if (thq !== bubTh) { bubTh = thq; bubble.geometry.dispose(); bubble.geometry = new THREE.SphereGeometry(BUBR, 40, 28, 0, Math.PI * 2, thq, Math.max(0.01, Math.PI - thq)); } }
    { const par = bubble.parent; for (const m of mist) { if (m.parent !== par) par.add(m); const u = m.userData, dth = th - u.thI, on = inB && rB > 0 && rB < CAL.bubble_t && dth > 0 && dth < 1.4; m.visible = on; if (!on) continue; const rr = BUBR * Math.sin(u.thI) + dth * u.vr * BUBR * 1.2; bf(Math.cos(u.a) * rr, Math.sin(u.a) * rr - 0.5 * dth * dth * BUBR * 0.8, BUBR * Math.cos(u.thI) - dth * u.vz * BUBR * 0.7, bv); m.position.copy(bubble.position).add(bv); m.material.opacity = 0.85 * (1 - dth / 1.4); } }
    if (inB && rB > 0 && rB < CAL.bubble_t) { rimR.visible = true; const rr = BUBR * Math.sin(th); bf(0, 0, BUBR * Math.cos(th), bv); rimR.position.copy(bubble.position).add(bv); rimR.quaternion.copy(qf); rimR.scale.setScalar(Math.max(rr, 1e-4)); } }
  // sound: the clap, a ring from the hands, its bounce off the left wall
  { const C0 = EV.clap, r = (t - C0) / 1000, vs = CAL.sound * 0.0, sm = t >= C0 - 16 && t < C0 + 36;
    const an = plates.anchor(t); proxy.visible = !!(plateOn && an && an.proxy); if (an && an.room) buildProxy(an.room);
    if (an && an.pos) { [CLAPX, CLAPY, CLAPZ] = an.pos; } else { CLAPX = 2.45; CLAPY = TOP + 0.32; CLAPZ = -0.8; }
    const tint = an && an.tint ? an.tint : null; WV.uSTa.value.set(...(tint ? tint[0] : [0.62, 0.82, 1.0])); WV.uSTb.value.set(...(tint ? tint[1] : [0.3, 0.52, 0.95])); waveRing.material.color.set(tint ? tint[2] : 0xA8D4FF); waveFill.material.color.set(tint ? tint[3] : 0x7FB6FF);
    hands.visible = sm; hands.position.set(CLAPX, CLAPY, CLAPZ); const clap = t < C0 ? 0.5 + 0.5 * Math.abs(Math.sin(t * 2.5)) * seg(t, C0 - 14, C0 - 10) * (t < C0 - 2 ? 1 : 0) : 0; void vs;
    const sep = t < C0 ? 0.06 * (1 - seg(t, C0 - 1.2, C0)) + 0.002 : 0.002; handL.position.set(-sep - 0.015, 0, 0); handR.position.set(sep + 0.015, 0, 0); void clap;
    WV.uSS1.value.set(CLAPX, CLAPY, CLAPZ); if (an && an.mirror) WV.uSS2.value.set(...an.mirror); else WV.uSS2.value.set(-5.4 - CLAPX, CLAPY, CLAPZ);   // the image source behind the left wall (x = -2.7)
    { const on = r > 0 && r < 0.052, Rs = CAL.sound * r; for (const m of [waveRing, waveFill]) { m.visible = on && sm && !(an && an.proxy); m.position.set(CLAPX, CLAPY, CLAPZ); m.scale.setScalar(Math.max(Rs, 1e-3)); m.lookAt(camera.position); } waveRing.material.opacity = 0.3 * (1 - seg(r, 0.03, 0.052)); waveFill.material.opacity = 0.035 * (1 - seg(r, 0.03, 0.052)); }
    const Rr = CAL.sound * r; WV.uSR1.value = r > 0 ? Rr : -9; WV.uSR2.value = r > 0 ? Rr : -9; WV.uSOn.value = r > 0 && r < 0.052 ? 1 : 0; }
  // the bullet, the apple's spray
  { const Bt = EV.bullet, r = (t - Bt.enter) / 1e4, ax = bullet.parent === plateRig ? 0 : APPX, ay = bullet.parent === plateRig ? 0 : APPY, az = bullet.parent === plateRig ? 0 : CUPZ, ap = ax - 0.04, speed = CAL.bullet.v;
    const x = ap + speed * r - 0.0, show = t >= Bt.approach - 1.0 && t < Bt.enter + 70 && x < 3.4;
    bullet.visible = show && !(Math.abs(x - APPX) < 0.0 && false); bullet.position.set(x, ay, az); cone.visible = show;
    const inRig = bullet.parent === plateRig, L = inRig ? 0.09 : 0.22; coneM.opacity = inRig ? 0.0 : 0.12; if (inRig) cone.visible = false; cone.scale.set(L * Math.tan(HALFANG) * 1.0, L, L * Math.tan(HALFANG) * 1.0); cone.rotation.z = Math.PI / 2; cone.position.set(x - L / 2 - 0.006, ay, az);
    const exit = ap + 0.08, afterExit = x > exit, rEx = (t - (Bt.enter + 0.08 / speed * 1e4)) / 1e4;
    spray.forEach((m) => { m.visible = rEx > 0 && rEx < 0.0009; if (!m.visible) return; const v = m.userData.v; { const kk = bullet.parent === plateRig ? 3 : 1; m.scale.setScalar(1); m.position.set(exit + v[0] * rEx * m.userData.s * kk, ay + v[1] * rEx * 0.6 * kk, az + v[2] * rEx * 0.6 * kk); } m.rotation.set(m.userData.spin[0] * rEx * 1e3, m.userData.spin[1] * rEx * 1e3, m.userData.spin[2] * rEx * 1e3); });
    const dim = seg(t, Bt.enter - 3.0, Bt.enter - 0.2), shell = afterExit ? 0 : 1; apple.visible = true; apple.scale.set(1 - 0.12 * dim * (afterExit ? 0 : 1) - (afterExit ? 0.0 : 0), 1, 1 - 0.12 * dim); apple.scale.x = t >= Bt.enter + 70 ? 1 : afterExit ? Math.max(0.6, 1 - 0.4 * seg(t, Bt.enter + 0.08 / speed * 1e4, Bt.enter + 0.08 / speed * 1e4 + 2.0)) : 1 - 0.06 * dim; void shell;
    apple.position.set(APPX, APPY, CUPZ); stem.visible = !afterExit;
    if (appleP.parent === plateRig) { const tEx = Bt.enter + 0.08 / speed * 1e4, rEn = (t - Bt.enter) / 1e4;
      if (petals[0].parent !== plateRig) plateRig.add(...petals, mistPts, cloudPts);
      const open = seg(t, tEx - 0.02, tEx + 0.6), rE0 = 0.0125 * Math.min(1, seg(t, tEx - 0.05, tEx + 0.3) * 3.0);
      { const bx = 0.0395 * 0.998 * Math.sqrt(Math.max(0.05, 1 - (rE0 / 0.04) * (rE0 / 0.04))); petals.forEach((m) => { m.visible = open > 0.02; if (m.visible) bendFlap(m, bx, rE0, open); }); }
      { const P = mistGeo.attributes.position, rx = (t - tEx) / 1e4, rn = rEn - 0.08 / speed - 0.00003; mistPts.visible = rx > 0 || rEn > 0.08 / speed + 0.00001;
        for (let k = 0; k < mistV.length; k++) { const q = mistV[k], r0 = q.back ? Math.max(0, (t - Bt.enter - 0.0) / 1e4 - 0.0 ) : rx; const age = q.back ? Math.max(0, rEn - 0.0) * 0.18 : Math.max(0, rx); const kk = 4, ox = q.back ? -0.04 : 0.04; P.setXYZ(k, ox + q.d[0] * q.sp * age * kk, q.d[1] * q.sp * age * kk, q.d[2] * q.sp * age * kk); void r0; }
        { const C = cloudGeo.attributes.position, age = Math.max(0, rx); cloudPts.visible = rx > 0; for (let k = 0; k < cloudN; k++) { const q = cloudV[k]; const f = (0.4 + 0.6 * (k % 5) / 4) * q.sp * age * 2.4 + 0.0015 * (k % 3); C.setXYZ(k, 0.040 + q.d[0] * f, q.d[1] * f * 0.9, q.d[2] * f * 0.9); } C.needsUpdate = true; cloudPts.material.size = 0.035 + 0.12 * Math.min(1, age / 0.0008); cloudPts.material.opacity = 0.9 * Math.max(0, 1 - age / 0.0011); }
        P.needsUpdate = true; mistPts.material.opacity = 0.85 * Math.max(0, 1 - Math.max(0, rx) / 0.0009); } appleP.position.set(0, 0, 0); appleU.uExit.value = seg(t, tEx - 0.05, tEx + 0.3); appleU.uEntry.value = seg(t, Bt.enter - 0.05, Bt.enter + 0.25); } }
  // the storm's leader: a step every 3 s (1 s of growth, then a skipped wait), branches, the return stroke
  { const Lt = SL.t0, ground = SL.ground, every = SL.stepEvery; let flashV = 0;
    const retK = seg(t, ground, ground + 30), inL = t >= Lt && t < T.light + 6;
    PATH.slice(1).forEach((p, i) => {
      const t0i = Lt + i * every, g = E.inout2(seg(t, t0i, t0i + 1.0)), a = PATH[i], b = [lerp(a[0], p[0], g), lerp(a[1], p[1], g)];
      const age = t - (t0i + 1.0), op = !inL || t < t0i ? 0 : (t < ground ? 0.95 - 0.22 * Math.min(1, Math.max(0, age) / 12) : Math.max(0, 0.5 - 0.5 * seg(t, ground + 3, ground + 30)));
      setSeg(mainSegs[i], a, b, 0.07, op, 0xE6EEFF); setSeg(mainGlow[i], a, b, 0.22, op * 0.28, 0x7FA6FF);
    });
    BRANCH.forEach((br, bi) => br.pts.slice(1).forEach((q, j) => { const t0b = Lt + (br.at + j * 0.6) * every * 0.75 + 4, g = E.inout2(seg(t, t0b, t0b + 1.4)); const a = br.pts[j]; setSeg(brSegs[bi][j], a, [lerp(a[0], q[0], g), lerp(a[1], q[1], g)], 0.035, (!inL || t < t0b ? 0 : (t < ground ? 0.8 : Math.max(0, 0.45 - 0.45 * seg(t, ground + 3, ground + 30)))), 0xCFDDFF); }));
    PATH.slice(1).forEach((p, i) => { const idx = STEPS - 1 - i, a = PATH[idx + 1], b = PATH[idx], f0 = i / STEPS, f1 = (i + 1) / STEPS, g = Math.min(1, Math.max(0, (retK - f0) / (f1 - f0))); setSeg(retSegs[i], a, [lerp(a[0], b[0], g), lerp(a[1], b[1], g)], 0.12, inL && t >= ground && g > 0 ? 0.85 * E.out2(seg(t, ground, ground + 0.3)) : 0, 0xF2F6FF); });
    if (t >= ground && t < ground + 2.0) flashV = E.out2(seg(t, ground, ground + 0.35)) * (1 - E.inout2(seg(t, ground + 0.5, ground + 2.0)));   // soft: in over 0.35 s, out over 1.5 s (no full-frame white)
    flashLight.intensity = 1.6 * flashV; renderer.toneMappingExposure = 1.0 + 0.18 * flashV; }
  // the light fronts: a flash across the room (1e8x), the flashlight's front (1e9x), a crawling pulse (1e10x and more)
  { const fl8 = EV.flash8, l9 = EV.light9, pulse0 = EV.pulse; let R = 0, lk = 1;
    const env = (a, b, fin = 1.2, fout = 1.2) => Math.min(E.inout2(seg(t, a - fin, a)), 1 - E.inout2(seg(t, b, b + fout)));
    const on = Math.max(env(fl8, fl8 + 3.0), env(l9, EV.hair[0] - 0.3 + 0.0, 1.5, 0.8));
    if (t >= fl8 && t < fl8 + 4.0) R = Rint(t) - Rint(fl8);
    if (t >= l9) R = Rint(t) - Rint(l9);
    if (t >= pulse0 - 0.2) { const rn = Rint(t) - Rint(pulse0) + 0.005, q = E.inout2(seg(t, pulse0 - 0.2, pulse0 + 1.4)); R = lerp(Math.max(R, 6.0), rn, q); }   // the lit room's front shrinks back into the flashlight, smoothly
    if (plateOn) plates.drawNight(t, on > 0.01 && R > 0 ? R : -1, 0.12 + 0.025 * R);   // a night plate: the lamp's light front reveals the original pixels
    WV.uLOn.value = on; WV.uLR.value = R; WV.uLW.value = t >= pulse0 ? Math.max(0.0004, Math.min(0.05, 0.4 * (Rint(t) - Rint(pulse0) + 0.01))) : 0.06; WV.uLK.value = lk;
    // the macro stage: the front crosses a hair (0.1 mm) in 1/3 s at 1e12x
    if (inMacro) { const rr = (t - EV.hair[1]) / 1.0, x = -0.0003 + CAL.c / 1e12 * (t - (EV.hair[1] - 0.18) ) * 1.0; frontPl.position.x = x; litLayer.position.x = x - 0.0003 - 0.000006; litLayer.visible = true; void rr; }
    led.material.color.set(t >= EV.chip[0] && t < EV.chip[1] ? ((Math.floor((t - EV.chip[0]) * 3) % 2) ? 0xff3a1a : 0x401008) : 0x401008);
  }
  // the lab bench (the MIT setup): a pulse crawls through the bottle, with stamped ghosts
  if (inLab) { const u = E.inout2(seg(t, T.real + 2.0, T.real + 18.0)), x = lerp(-0.45, 0.42, u); pulse.position.set(x, -0.18, 0); pulseGhosts.forEach((m, i) => { const q = Math.max(0, u - (i + 1) * 0.045); m.position.set(lerp(-0.45, 0.42, q), -0.18, 0); m.visible = u > (i + 1) * 0.045; m.material.opacity = 0.32 * (1 - i / 12); }); }
  // back to the kitchen's own light after the dark chapters
  void hush; void F; void k;
  dropE(t);
  hud.update(t);
  renderer.render(scene, camera);
};
window.OBJ_RECTS = () => [];
