// Reality Rulebook · Season 2 · Episode 4, "The ring a coffee drop leaves" (films/channels/physics/ep10): the picture, a pure function of t.
// A thin drop on paper with a pinned edge, evaporating fastest at the edge: a closed-form model of the specks' paths (compile.py
// docstring). The paths are integrated at load (a table, so seek is pure), the numbers are made up, and the film says "model".
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, EC = FILM.endCard, M = FILM.model;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12, shutter: 0 });   // no motion blur: it smears the specks
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 2, 4000);
const HEX = { ink2: TK["ink-2"] || "#4B505B", energy: TK.energy || "#B8321A", force: TK.force || "#1F3BD1", motion: TK.motion || "#08805A", ghost: "#6E6A62", speck: "#3A2412", water: "#8FA9C4" };
const flat = (hex) => new THREE.Color().setRGB(...acesInv(hex));
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
cyc.wall.visible = false; cyc.floor.scale.set(3, 1, 3);
cyc.uniforms.uCyl.value.set(40, 200, 1e6);
window.SCENE_READY = P.ready;

// ── the model: speck paths dr/dτ = G(r)/4, τ = -ln(1 - s); a table of the one trajectory (specks sit at different phases of it) ──
const R = M.R, H0 = M.H0, N = M.n, RINGF = M.ring;
const G = (r) => (2 * r * r - r ** 4 - 1 + Math.sqrt(Math.max(0, 1 - r * r))) / (r * (1 - r * r));
const TR = [[0, 1e-3]];
{ let r = 1e-3, t = 0; const dt = 0.002;
  while (r < 0.9995 && t < 60) { const k1 = G(r) / 4, k2 = G(r + dt / 2 * k1) / 4, k3 = G(r + dt / 2 * k2) / 4, k4 = G(r + dt * k3) / 4; r += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4); t += dt; TR.push([t, r]); } }
const TEDGE = TR[TR.length - 1][0];
const lookT = (tt) => { let lo = 0, hi = TR.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TR[m][0] < tt) lo = m; else hi = m; } const a = TR[lo], b = TR[hi]; return a[1] + (b[1] - a[1]) * (tt - a[0]) / Math.max(1e-9, b[0] - a[0]); };
const tau0Of = (r0) => { let lo = 0, hi = TR.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TR[m][1] < r0) lo = m; else hi = m; } return TR[hi][0]; };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = rng(1997), SP = [];
for (let i = 0; i < N; i++) { const r0 = Math.max(1e-3, Math.sqrt(rnd())), ph = rnd() * Math.PI * 2, fr = 0.08 + 0.8 * rnd(); SP.push({ r0, ph, fr, tau0: tau0Of(r0), arrive: TEDGE - tau0Of(r0) }); }
{ const order = SP.map((p, i) => i).sort((a, b) => SP[a].arrive - SP[b].arrive); order.forEach((i, k) => { SP[i].rank = k / N; }); }
const tauOfS = (s) => -Math.log(1 - Math.min(0.9999, s));
const radiusAt = (p, s, back = 0) => { const tt = p.tau0 + Math.max(0, tauOfS(s) - back); return tt >= TEDGE ? 1 - 0.008 - 0.04 * p.rank : lookT(tt); };
const hAt = (r, s) => H0 * (1 - Math.min(1, s)) * (1 - r * r);

// ── takes ──
const takeAt = (t) => FILM.takes.find((k) => t >= k.t0 && t < k.t1) || FILM.takes[FILM.takes.length - 1];
const sAt = (t) => keyed(takeAt(t).keys, t, "lin");

// ── the drop, in 3-D: paper, a coffee lens (lathe, height scaled by 1 - s), the specks as small lit nuggets, the dried stain growing on the paper ──
const prof = []; for (let i = 0; i <= 48; i++) { const r = i / 48; prof.push(new THREE.Vector2(R * r, H0 * (1 - r * r))); }
const lensGeo = new THREE.LatheGeometry(prof, 96);
const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x5a3216, transparent: true, opacity: 0.4, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
const lens = new THREE.Mesh(lensGeo, lensMat);
// paper sheet with a fibre texture (a seeded canvas: no image files)
const paperTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"); g.fillStyle = "#ece6d6"; g.fillRect(0, 0, 512, 512);
  const r2 = rng(7); for (let i = 0; i < 2600; i++) { const x = r2() * 512, y = r2() * 512, l = 6 + r2() * 22, a = r2() * Math.PI; g.strokeStyle = `rgba(${150 + r2() * 60 | 0},${135 + r2() * 50 | 0},${110 + r2() * 40 | 0},${0.05 + r2() * 0.08})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t; })();
const paper = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95, metalness: 0 })); paper.rotation.x = -Math.PI / 2; paper.position.y = 0.0; scene.add(paper);
// the stain: a pale wash over the whole footprint and a dark band at the edge, both fading in as the drop dries
const washMat = new THREE.MeshBasicMaterial({ color: 0xb48a5a, transparent: true, opacity: 0, depthWrite: false });
const wash = new THREE.Mesh(new THREE.CircleGeometry(R * 0.985, 96), washMat); wash.rotation.x = -Math.PI / 2; wash.position.y = 0.02; scene.add(wash);
const bandMat = new THREE.MeshBasicMaterial({ color: 0x4a2a12, transparent: true, opacity: 0, depthWrite: false });
const band = new THREE.Mesh(new THREE.RingGeometry(R * 0.955, R * 1.004, 96), bandMat); band.rotation.x = -Math.PI / 2; band.position.y = 0.03; scene.add(band);
const speckGeo = new THREE.IcosahedronGeometry(1, 1);
const mkSet = (n, col, scale, std) => { const m = new THREE.InstancedMesh(speckGeo, std ? new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }) : new THREE.MeshBasicMaterial({ color: col }), n); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); m.userData.scale = scale; return m; };
const specks = mkSet(N, new THREE.Color("#2b1708"), 0.2, true);
const NT = 220, trails = [mkSet(NT, flat("#6D5338"), 0.2), mkSet(NT, flat("#8E7556"), 0.16), mkSet(NT, flat("#AE9B82"), 0.12)];
scene.add(lens);                                   // after the specks, so the lens sits over them
const rimMat = new THREE.MeshStandardMaterial({ color: 0x2b1708, roughness: 0.5, transparent: true });
const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.13, 8, 120), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.06; scene.add(rim);
const mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
const place = (set, i, x, y, z, vis) => { s3.setScalar(vis ? set.userData.scale : 0); p3.set(x, y, z); mtx.compose(p3, q0, s3); set.setMatrixAt(i, mtx); };
const speckPos = (i, s, back = 0) => { const p = SP[i], r = radiusAt(p, s, back), h = hAt(r, s), piled = r > 0.93, y = piled ? 0.24 + 0.5 * p.fr * (0.4 + 0.6 * p.rank) : 0.22 + p.fr * h; return [R * r * Math.cos(p.ph), y, R * r * Math.sin(p.ph)]; };
// arrows in the cutaway (plane z = 0): the flow (blue, outward) and the evaporation (red, up) at the edge
const arMat = new THREE.MeshBasicMaterial({ color: flat(HEX.force), transparent: true }), arMat2 = new THREE.MeshBasicMaterial({ color: flat(HEX.energy), transparent: true });
const mkArrow = (mat, len, rotZ) => { const g = new THREE.Group(), sh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len - 0.55, 8), mat), hd = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.6, 10), mat);
  sh.position.y = (len - 0.55) / 2; hd.position.y = len - 0.25; g.add(sh, hd); const o = new THREE.Group(); o.add(g); o.rotation.z = rotZ; scene.add(o); o.userData.mats = [mat]; return o; };
const flowAr = []; for (const x of [2.6, 4.8, 7.0]) for (const sg of [1, -1]) { const a = mkArrow(arMat, 1.9, sg > 0 ? -Math.PI / 2 : Math.PI / 2); a.position.set(sg * x, 0.9, 0); flowAr.push([a, x, sg]); }
const evapAr = []; for (const x of [7.6, 8.7, 9.6]) for (const sg of [1, -1]) { const a = mkArrow(arMat2, 1.9, 0); a.position.set(sg * x, 0, 0); evapAr.push([a, x, sg]); }

// ── camera ──
const lerp = (a, b, u) => a + (b - a) * u;
const camNow = (t) => {
  const st = shotAt(t, FILM.shots), ks = FILM.cam[st.name];
  let i = ks.findIndex((k) => k.t > t); if (i < 0) i = ks.length - 1; if (i < 1) i = 1;
  const a = ks[Math.min(i - 1, ks.length - 1)], b = ks[Math.min(i, ks.length - 1)];
  const u = a === b ? 1 : ease(b.ease || "p2")(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  return { look: [0, 1, 2].map((j) => lerp(a.look[j], b.look[j], u)), dist: lerp(a.dist, b.dist, u), yaw: lerp(a.yaw, b.yaw, u), pitch: lerp(a.pitch, b.pitch, u), fov: lerp(a.fov, b.fov, u) };
};
const placeCam = (t) => {
  const c = camNow(t), y = (c.yaw * Math.PI) / 180, p = (c.pitch * Math.PI) / 180;
  camera.position.set(c.look[0] + c.dist * Math.sin(y) * Math.cos(p), c.look[1] + c.dist * Math.sin(p), c.look[2] + c.dist * Math.cos(y) * Math.cos(p));
  camera.fov = c.fov; camera.updateProjectionMatrix(); camera.lookAt(c.look[0], c.look[1], c.look[2]); camera.updateMatrixWorld();
};
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an === "edge") return () => [R, 0.2, 0];
  if (an === "speck") return (t) => { const p = speckPos(7, sAt(t)); return [p[0], p[1], p[2]]; };
  if (an === "evap") return (t) => [R - 1.6, hAt(1 - 0.16, sAt(t)) + 2.2, 0];
  if (an === "flow") return (t) => [-4.8, hAt(0.48, sAt(t)) * 0.55 + 1.0, 0];
  return () => [0, 0, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: false });
const SPN = FILM.spine[0];
const shareAt = (s) => { let c = 0; for (let i = 0; i < N; i++) if (radiusAt(SP[i], s) >= RINGF) c++; return (100 * c) / N; };
const spineVal = (t) => shareAt(sAt(t));
const spineOpts = { value: spineVal, fmt: (v) => v.toFixed(0), unit: "%", label: SPN.label, t0: SPN.t0, t1: SPN.t1, minCh: 2 }, counterEl = hud.counter("spine", spineOpts);
placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);
const ES = FILM.endShow, endEl = hud.end({ t0: ES - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: ES, fps: FILM.fps, head: ".t", fall: 90 });
const win = (t, w, fin = 0.5, fout = 0.4) => (w ? Math.min(E.out2(seg(t, w[0], w[0] + fin)), 1 - E.in2(seg(t, w[1] - fout, w[1]))) : 0);

window.seek = function (t) {
  stage(t);
  placeCam(t);
  const s = sAt(t);
  lens.scale.y = Math.max(0.001, 1 - s);
  lensMat.opacity = 0.42 * Math.sqrt(Math.max(0, 1 - s));
  lens.visible = s < 0.998;
  washMat.opacity = 0.34 * Math.min(1, Math.max(0, (s - 0.55) / 0.4)); bandMat.opacity = 0.78 * Math.min(1, Math.max(0, (s - 0.2) / 0.75));
  for (let i = 0; i < N; i++) { const [x, y, z] = speckPos(i, s); place(specks, i, x, y, z, true); }
  specks.instanceMatrix.needsUpdate = true;
  const tk = win(t, FILM.cue.trail);
  trails.forEach((set, k) => { for (let i = 0; i < NT; i++) { const [x, y, z] = speckPos(i, s, 0.14 * (k + 1)); const a = speckPos(i, s), moved = Math.hypot(x - a[0], z - a[2]) > 0.08; place(set, i, x, y, z, tk > 0.05 && moved); } set.instanceMatrix.needsUpdate = true; });
  const ck = win(t, FILM.cue.cut);
  flowAr.forEach(([a, x, sg]) => { a.visible = ck > 0.02; arMat.opacity = ck; a.position.y = 0.4 + 0.55 * hAt(x / R, s); });
  evapAr.forEach(([a, x, sg]) => { a.visible = ck > 0.02; arMat2.opacity = ck; a.position.y = hAt(x / R, s) + 0.3; });
  cyc.update({ grid: 1, casters: [[0, 0, 0, 13]] });
  dropT(t); dropE(t);
  hud.update(t);
  renderer.render(scene, camera);
};

// the self-check: where the drop lands on the screen (a box around its rim), for the render's own overlap pass
window.OBJ_RECTS = () => {
  const V = new THREE.Vector3(); let l = 1e9, r = -1e9, t = 1e9, b = -1e9;
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; V.set(R * Math.cos(a), 0.2, R * Math.sin(a)).project(camera); const x = (V.x * 0.5 + 0.5) * W, y = (1 - (V.y * 0.5 + 0.5)) * H; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  return [{ n: "drop", l, r, t, b }];
};
