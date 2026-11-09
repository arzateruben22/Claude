// Reality Rulebook · Season 2 · Episode 6, "The slow raindrop" (films/channels/physics/ep12; the season finale): the picture, a pure function of t.
// Three round drops (0.5, 1.5, 2.5 mm radius) fall through a stage that stands for 16 m of height, computed from m dv/dt = m g - 1/2 C rho A v^2
// (closed form: v = vT tanh(g t / vT)), drawn slowed 4x. Ghosts every quarter of a real second show the gaps grow, then stop growing; arrows show
// the weight and the drag; a plot strip shows speed against time. The model uses round drops (badged); the flattening and the breakup are illustrations.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, M = FILM.model, ES = FILM.endShow;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12, shutter: 0 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 2, 4000);
const HEX = { ink: "#1B1E24", ink2: TK["ink-2"] || "#4B505B", energy: TK.energy || "#B8321A", force: TK.force || "#1F3BD1", motion: TK.motion || "#08805A", ghost: "#6E6A62" };
const flat = (hex) => new THREE.Color().setRGB(...acesInv(hex));
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
cyc.wall.visible = false; cyc.floor.scale.set(3, 1, 3);
cyc.uniforms.uCyl.value.set(40, 200, 1e6);
cyc.group.position.y = -12.6;
window.SCENE_READY = P.ready;

// ── physics: a round drop, drag 1/2 C rho A v^2 ──
const G = M.g, SLOW = M.slow, HST = M.hstage;
const LANES = { small: { x: -5.4, vt: M.vT.small, r: 0.3, col: "#1F3BD1", mm: "1 mm" }, medium: { x: 0, vt: M.vT.medium, r: 0.5, col: "#08805A", mm: "3 mm" }, big: { x: 5.4, vt: M.vT.big, r: 0.72, col: "#B8321A", mm: "5 mm" } };
const sOf = (vt, tau) => (vt * vt / G) * Math.log(Math.cosh(G * tau / vt)), vOf = (vt, tau) => vt * Math.tanh(G * tau / vt);
for (const k in LANES) LANES[k].fall = (LANES[k].vt / G) * Math.acosh(Math.exp(G * HST / (LANES[k].vt * LANES[k].vt)));
const PAUSE = 0.9, YTOP = 9.0, YH = 9.0;
const yOfS = (s) => YTOP - (s / HST) * YH;
const laneState = (lane, t) => {
  const L = LANES[lane]; let sg = null; for (const f of FILM.falls) if (f.lane === lane && t >= f.t0 && t < f.t1) sg = f;
  if (!sg) return null;
  const fallFilm = L.fall * SLOW, period = fallFilm + PAUSE, el = t - sg.t0, ph = el % period, cyc_ = Math.floor(el / period);
  if (ph < fallFilm) { const tau = ph / SLOW; return { falling: true, tau, s: sOf(L.vt, tau), v: vOf(L.vt, tau), cyc: cyc_, ph, seg: sg }; }
  return { falling: false, tau: L.fall, s: HST, v: L.vt, cyc: cyc_, ph, since: ph - fallFilm, seg: sg };
};

// ── the stage: cloud, ground, a height ladder, lane guides ──
const stageG = new THREE.Group(); scene.add(stageG);
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.95 });
for (const [x, y, s] of [[-7.4, 9.0, 0.9], [-5.2, 9.25, 1.1], [-2.6, 9.05, 1.0], [0, 9.35, 1.15], [2.7, 9.05, 1.0], [5.3, 9.25, 1.1], [7.5, 8.95, 0.9]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), cloudMat); m.position.set(x, y, -0.5); m.scale.set(1.25, 0.62, 0.8); stageG.add(m); }
const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 0.9 });
const ground = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 2.2), groundMat); ground.position.set(0, -0.2, 0); stageG.add(ground);
const inkMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) });
const ladder = new THREE.Group(); stageG.add(ladder);
{ const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, YH, 0.08), inkMat); bar.position.set(-8.4, YH / 2, 0); ladder.add(bar);
  for (let m = 0; m <= HST; m += 2) { const t = new THREE.Mesh(new THREE.BoxGeometry(m % 8 === 0 ? 0.9 : 0.5, 0.06, 0.08), inkMat); t.position.set(-8.4 + (m % 8 === 0 ? 0.45 : 0.25), YTOP - (m / HST) * YH, 0); ladder.add(t); } }
const guideMat = new THREE.MeshBasicMaterial({ color: flat("#CFC8B8") });
for (const k in LANES) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.04, YH, 0.04), guideMat); g.position.set(LANES[k].x, YH / 2, -0.4); stageG.add(g); }
// the drops (a ring in the lane's colour marks each), the ghosts, the splash rings
const dropMat = new THREE.MeshPhysicalMaterial({ color: 0x7db4e6, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.95 });
const sphere = new THREE.SphereGeometry(1, 22, 16);
const lanes = {};
for (const k in LANES) { const L = LANES[k], g = new THREE.Group(); stageG.add(g);
  const body = new THREE.Mesh(sphere, dropMat); body.scale.setScalar(L.r); g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: flat(L.col) })); ring.scale.setScalar(L.r * 2.0 + 0.2); ring.position.z = 0.7; g.add(ring);
  const ghostMat = new THREE.MeshBasicMaterial({ color: flat(L.col), transparent: true, opacity: 0.5 });
  const ghosts = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(sphere, ghostMat); m.scale.setScalar(L.r * 0.8); m.visible = false; stageG.add(m); ghosts.push(m); }
  const splash = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); splash.rotation.x = Math.PI / 2; splash.visible = false; stageG.add(splash);
  lanes[k] = { g, body, ring, ghosts, splash }; }
const frags = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(sphere, dropMat); m.scale.setScalar(0.17); m.visible = false; stageG.add(m); frags.push(m); }
// arrows on the medium drop: weight (down, steady, blue) and drag (up, growing, red)
const mkArrow = (col) => { const mat = new THREE.MeshBasicMaterial({ color: flat(col), transparent: true }), g = new THREE.Group(), sh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), mat), hd = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 12), mat); g.add(sh, hd); stageG.add(g);
  return { g, mat, set: (len) => { const L = Math.max(0.08, Math.abs(len)), d = Math.sign(len) || 1; sh.scale.y = Math.max(0.01, L - 0.5); sh.position.y = d * (L - 0.5) / 2; hd.position.y = d * (L - 0.27); hd.rotation.z = d > 0 ? 0 : Math.PI; } }; };
const wArrow = mkArrow("#1F3BD1"), dArrow = mkArrow("#B8321A");

// ── the plot strip (below the caption): speed against time, three curves ──
const panel = new THREE.Group(); panel.position.set(0, -8.2, 1.2); scene.add(panel);
const card = new THREE.Mesh(new THREE.PlaneGeometry(17.6, 6.2), new THREE.MeshBasicMaterial({ color: flat("#F6F1E6") })); card.position.z = -0.05; panel.add(card);
const cardEdge = new THREE.Mesh(new THREE.PlaneGeometry(17.8, 6.4), new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) })); cardEdge.position.z = -0.09; panel.add(cardEdge);
const mkRibbon = (n, color) => { const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const idx = []; for (let i = 0; i < n - 1; i++) { const a = 2 * i, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); } g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.frustumCulled = false; panel.add(m); return { m, pos, n, g }; };
const setRibbon = (rb, pts, w) => { for (let i = 0; i < rb.n; i++) { const [x, y] = pts[Math.min(i, pts.length - 1)]; rb.pos.set([x, y + w, 0, x, y - w, 0], i * 6); } rb.g.attributes.position.needsUpdate = true; };
const PX0 = -7.4, PX1 = 7.6, PY0 = -2.1, PY1 = 2.3, TMAX = 2.2, VMAX = 11.5;
const pxOf = (tau) => PX0 + (PX1 - PX0) * Math.min(tau, TMAX) / TMAX, pyOf = (v) => PY0 + (PY1 - PY0) * v / VMAX;
const curves = {}; for (const k in LANES) { const rb = mkRibbon(90, flat(LANES[k].col)); const pts = []; for (let i = 0; i < 90; i++) { const tau = TMAX * i / 89; pts.push([pxOf(tau), pyOf(vOf(LANES[k].vt, tau))]); } setRibbon(rb, pts, 0.09); curves[k] = rb; }
const axisMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) });
{ const ax = new THREE.Mesh(new THREE.BoxGeometry(PX1 - PX0 + 0.4, 0.07, 0.05), axisMat); ax.position.set((PX0 + PX1) / 2, PY0 - 0.25, 0.02); panel.add(ax);
  const ay = new THREE.Mesh(new THREE.BoxGeometry(0.07, PY1 - PY0 + 0.6, 0.05), axisMat); ay.position.set(PX0 - 0.25, (PY0 + PY1) / 2, 0.02); panel.add(ay); }
const curDots = {}; for (const k in LANES) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshBasicMaterial({ color: flat(LANES[k].col) })); d.position.z = 0.07; d.visible = false; panel.add(d); curDots[k] = d; }
const mkTag = (text, w, h, x, y, col = "#1B1E24") => { const cv = document.createElement("canvas"); cv.width = 512; cv.height = Math.round(512 * h / w); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); m.position.set(x, y, 0.08); panel.add(m);
  const draw = () => { const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = col; g.font = `600 ${Math.round(cv.height * 0.55)}px "IBM Plex Sans", sans-serif`; g.textBaseline = "middle"; g.fillText(text, 8, cv.height / 2); tex.needsUpdate = true; };
  if (window.FONTS_READY) window.FONTS_READY.then(draw); else draw(); return m; };
const tagSpeed = mkTag("speed", 4.6, 1.1, -6.3, 2.65), tagSmall = mkTag("1 mm: 4.6 m/s", 5.6, 1.1, 1.9, pyOf(M.vT.small) - 1.05, "#1F3BD1"), tagBig = mkTag("5 mm: 10.4 m/s", 5.8, 1.1, -3.3, pyOf(M.vT.big) + 0.72, "#B8321A");
tagSmall.position.x = 3.6; tagBig.position.x = 2.8;

// ── the rain (the finale): many drops falling slowly to the ground ──
const rain = new THREE.Group(); scene.add(rain); rain.visible = false;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rr = rng(2006), NR = 34, RD = [];
for (let i = 0; i < NR; i++) { const r = (0.4 + 2.2 * rr()) * 1e-3, vt = Math.sqrt(8 * M.rhoW * G * r / (3 * M.rhoA * M.C)); RD.push({ x: -7.8 + 15.6 * rr(), off: rr(), vt, r: 0.12 + 0.07 * (r * 1e3), fall: (vt / G) * Math.acosh(Math.exp(G * HST / (vt * vt))) }); }
const rainDrops = RD.map((d) => { const m = new THREE.Mesh(sphere, dropMat); m.scale.set(d.r, d.r * 1.15, d.r); rain.add(m); return m; });
const rainSplash = RD.map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.rotation.x = Math.PI / 2; m.visible = false; rain.add(m); return m; });

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
window.CINEMA_FOCUS = () => ({ point: [0, 4.5, 0], fstop: 0 });

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const dropPos = (lane, t) => { const st = laneState(lane, t); return [LANES[lane].x, st && st.falling ? yOfS(st.s) : YTOP]; };
const anchorFn = (an) => {
  if (an === "med-top") return (t) => { const [x, y] = dropPos("medium", t); return [x, y + 0.5, 0.5]; };
  if (an === "med-low") return (t) => { const [x, y] = dropPos("medium", t); return [x, y, 0.5]; };
  if (an === "w-arrow") return (t) => { const [x, y] = dropPos("medium", t); return [x - 0.9, y - 2.0, 0.8]; };
  if (an === "d-arrow") return (t) => { const [x, y] = dropPos("medium", t), st = laneState("medium", t), v = st ? st.v : 0; return [x + 0.9, y + 2.0 * (v / LANES.medium.vt) ** 2, 0.8]; };
  if (an === "lane-small") return (t) => { const [x, y] = dropPos("small", t); return [x, y, 0.5]; };
  if (an === "lane-big") return (t) => { const [x, y] = dropPos("big", t); return [x, y, 0.5]; };
  return () => [0, 0, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: false });
const focusVal = (t) => { const f = FILM.focus.find((q) => t >= q.t0 && t < q.t1) || FILM.focus[FILM.focus.length - 1], st = laneState(f.lane, t); return st ? st.v : LANES[f.lane].vt; };
FILM.spine.forEach((SPN, i) => { const o = { value: focusVal, fmt: (v) => v.toFixed(1), unit: "m/s", label: SPN.label, t0: SPN.t0, t1: SPN.t1, minCh: 4 }, el = hud.counter(i ? "spine" + (i + 1) : "spine", o); placeSpine(o, el, hud, W, H, FILM.spineAt); });
const endEl = hud.end({ t0: ES - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: ES, fps: FILM.fps, head: ".t", fall: 90 });
const win = (t, w, fin = 0.5, fout = 0.4) => (w ? Math.min(E.out2(seg(t, w[0], w[0] + fin)), 1 - E.in2(seg(t, w[1] - fout, w[1]))) : 0);
const FRAGX = [-1.3, -0.6, 0.2, 0.8, 1.5], FRAGV = [0.9, 1.1, 0.8, 1.0, 1.2];

window.seek = function (t) {
  stage(t);
  placeCam(t);
  const T = CUE.cuts, inRain = t >= T.tease, ghostsOn = t >= FILM.ghostT[0] && !inRain;
  stageG.visible = true; panel.visible = !inRain; rain.visible = inRain;
  const bun = t >= FILM.bun[0] && t < FILM.bun[1] ? E.out2(seg(t, FILM.bun[0], FILM.bun[0] + 0.9)) : 0;
  const splitDone = t >= FILM.split && t < T.measure;
  for (const k in LANES) {
    const L = LANES[k], o = lanes[k], st = inRain ? null : laneState(k, t);
    const show = !!(st && st.falling) && !(k === "big" && splitDone);
    o.g.visible = show;
    if (show) { o.g.position.set(L.x, yOfS(st.s), 0); const u = k === "big" ? bun : 0; o.body.scale.set(L.r * (1 + 0.35 * u), L.r * (1 - 0.45 * u), L.r * (1 + 0.35 * u)); }
    o.ghosts.forEach((m, i) => { const tk = 0.25 * i, on = ghostsOn && st && st.falling && st.tau >= tk + 0.02 && !(k === "big" && splitDone); m.visible = !!on; if (on) m.position.set(L.x, yOfS(sOf(L.vt, tk)), -0.2); });
    const sp = o.splash; if (st && !st.falling && st.since < 0.9 && !(k === "big" && splitDone)) { sp.visible = true; const q = st.since / 0.9; sp.position.set(L.x, 0.08, 0); sp.scale.setScalar(0.3 + 1.1 * q); sp.material.opacity = 0.9 * (1 - q); } else sp.visible = false;
  }
  // the big drop breaks apart (an illustration)
  { const on = splitDone && t < FILM.split + 3.2; const s0 = laneState("big", FILM.split);
    frags.forEach((m, i) => { m.visible = !!(on && s0); if (m.visible) { const u = t - FILM.split; m.position.set(LANES.big.x + FRAGX[i] * (1 - Math.exp(-u * 1.1)) * 1.3, Math.max(0.15, yOfS(s0.s) - 0.65 * FRAGV[i] * u), 0); } }); }
  // arrows on the medium drop
  { const ck = win(t, FILM.cue.arrows), st = laneState("medium", t), on = ck > 0.02 && st && st.falling && yOfS(st.s) > 2.5; wArrow.g.visible = dArrow.g.visible = !!on;
    if (on) { const x = LANES.medium.x, y = yOfS(st.s); wArrow.g.position.set(x - 0.9, y, 0.8); dArrow.g.position.set(x + 0.9, y, 0.8); wArrow.set(-2.0); dArrow.set(2.0 * Math.pow(st.v / LANES.medium.vt, 2)); wArrow.mat.opacity = dArrow.mat.opacity = ck; } }
  // the plot strip
  for (const k in LANES) { const st = inRain ? null : laneState(k, t), on = !!(st && st.falling && st.tau <= TMAX && panel.visible); curDots[k].visible = on; if (on) curDots[k].position.set(pxOf(st.tau), pyOf(st.v), 0.07); }
  tagSmall.visible = panel.visible && t >= FILM.tagT[0] && t < FILM.tagT[2]; tagBig.visible = panel.visible && t >= FILM.tagT[1] && t < FILM.tagT[2];
  for (const k in curves) curves[k].m.visible = panel.visible && (t >= T.whoa ? true : k === "medium");
  // the rain
  if (inRain) RD.forEach((d, i) => { const m = rainDrops[i], sp = rainSplash[i], fallFilm = d.fall * SLOW, period = fallFilm + 1.0, el = (t - T.tease) + d.off * period, ph = el % period;
    if (ph < fallFilm) { m.visible = true; m.position.set(d.x, yOfS(sOf(d.vt, ph / SLOW)), 0); sp.visible = false; }
    else { m.visible = false; const q = (ph - fallFilm) / 1.0; sp.visible = q < 1; sp.position.set(d.x, 0.08, 0); sp.scale.setScalar(0.25 + 0.9 * q); sp.material.opacity = 0.8 * (1 - q); } });
  cyc.update({ grid: 1, casters: [] });
  dropT(t); dropE(t);
  hud.update(t);
  renderer.render(scene, camera);
};
// the self-check: boxes of what is on screen
window.OBJ_RECTS = () => {
  const out = [], V = new THREE.Vector3();
  const box = (n, pts) => { let l = 1e9, r = -1e9, tp = 1e9, b = -1e9; for (const [x, y, z] of pts) { V.set(x, y, z).project(camera); const px = (V.x * 0.5 + 0.5) * W, py = (1 - (V.y * 0.5 + 0.5)) * H; l = Math.min(l, px); r = Math.max(r, px); tp = Math.min(tp, py); b = Math.max(b, py); } out.push({ n, l, r, t: tp, b }); };
  box("stage", [[-8.7, 0, 0], [8.7, 0, 0], [-8.7, 10.0, 0], [8.7, 10.0, 0]]);
  if (panel.visible) box("panel", [[-8.9, -11.3, 1.2], [8.9, -11.3, 1.2], [-8.9, -5.1, 1.2], [8.9, -5.1, 1.2]]);
  for (const k in lanes) if (lanes[k].g.visible) { const p = lanes[k].g.position, r = LANES[k].r * 1.2 + 0.2; box("drop-" + k, [[p.x - r, p.y - r, 0], [p.x + r, p.y + r, 0]]); }
  return out;
};
