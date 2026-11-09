// Reality Rulebook · Season 2 · Episode 3, "The nut that rises" (films/channels/physics/ep09): the picture, a pure function of t.
// The grains are a 2D soft-disc simulation run once (sim.mjs → sim.json → film.json); the film plays it 2× slower and says so.
// The arrows of the flow loop and the ghosts of the big ball are drawn on top. It is our model, not a measurement.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, EC = FILM.endCard, SIM = FILM.sim, PR = SIM.params;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 2, 4000);
const HEX = { ink2: TK["ink-2"] || "#4B505B", energy: TK.energy || "#B8321A", force: TK.force || "#1F3BD1", motion: TK.motion || "#08805A", ghost: "#6E6A62" };
const flat = (hex) => new THREE.Color().setRGB(...acesInv(hex));
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;

// ── the simulation, read at film time t ──
const WC = PR.Wc, RS = PR.rs, RB = PR.rb, NP = SIM.xy[0].length / 2;
const frameAt = (t) => { const s = Math.min(SIM.xy.length - 1.001, Math.max(0, (t / SIM.slow) / SIM.dt)), i = Math.floor(s); return [i, s - i]; };
const posAt = (t, n) => { const [i, u] = frameAt(t), a = SIM.xy[i], b = SIM.xy[i + 1]; return [a[2 * n] + (b[2 * n] - a[2 * n]) * u, a[2 * n + 1] + (b[2 * n + 1] - a[2 * n + 1]) * u]; };
const floorAt = (t) => { const [i, u] = frameAt(t); return SIM.floor[i] + (SIM.floor[i + 1] - SIM.floor[i]) * u; };
const simT = (t) => t / SIM.slow;

// grains: instanced spheres (flat colours, three nut tones); the big ball is its own mesh
const grainGeo = new THREE.SphereGeometry(1, 20, 14);
const TONES = ["#B07A2A", "#8C5A1C", "#C99A4B"].map(flat);
const grains = new THREE.InstancedMesh(grainGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), NP - 1);
grains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
for (let i = 0; i < NP - 1; i++) grains.setColorAt(i, TONES[i % 3]);
grains.instanceColor.needsUpdate = true; grains.frustumCulled = false;
const ballMat = new THREE.MeshBasicMaterial({ color: flat("#1F3BD1") });
const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), ballMat); ball.scale.setScalar(RB);
const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: flat("#0E1F8A") })); ring.scale.setScalar(RB * 1.02);
scene.add(grains, ball, ring);

// the jar: a glass base that shakes, two glass walls, in ink-grey
const inkMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) });
const base = new THREE.Mesh(new THREE.BoxGeometry(WC + 3, 1.6, 6), inkMat); scene.add(base);
const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 40, 6), inkMat); wallL.position.set(-0.3, 18, 0);
const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 40, 6), inkMat); wallR.position.set(WC + 0.3, 18, 0);
scene.add(wallL, wallR);
// ruler beside the jar (measure): ticks every 5 cm from the floor
const rulerMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) }), ruler = new THREE.Group();
for (let c = 0; c <= 30; c += 5) { const w = c % 10 === 0 ? 3.2 : 2, tk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, 0.4), rulerMat); tk.position.set(-w / 2 - 1.2, c, 0); ruler.add(tk); }
const rbar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 30, 0.4), rulerMat); rbar.position.set(-1.2, 15, 0); ruler.add(rbar);
scene.add(ruler);
// ghosts of the big ball every 3 s of simulation time (measure, takeaway)
const NG = 14, ghostMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ghost), transparent: true, opacity: 0.55 }), ghosts = [];
for (let i = 0; i < NG; i++) { const g = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 40), ghostMat); g.scale.setScalar(RB); g.visible = false; scene.add(g); ghosts.push(g); }
const ghostPos = (k) => { const ts = CUE.ghosts.every * k, i = Math.min(SIM.xy.length - 1, Math.round(ts / SIM.dt)); return [SIM.xy[i][0], SIM.xy[i][1]]; };
// the flow loop (illustrated): arrows up along the walls and down the middle
const arrowMat = new THREE.MeshBasicMaterial({ color: flat(HEX.energy), transparent: true }), arrowMat2 = new THREE.MeshBasicMaterial({ color: flat(HEX.force), transparent: true });
const mkArrow = (x, y0, y1, mat) => { const gr = new THREE.Group(), dir = Math.sign(y1 - y0), L = Math.abs(y1 - y0);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, L - 2, 8), mat); sh.position.set(0, (y0 + y1) / 2 - dir, 0);
  const hd = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 10), mat); hd.position.set(0, y1 - dir, 0); if (dir < 0) hd.rotation.z = Math.PI;
  gr.add(sh, hd); gr.position.set(x, 0, 4); scene.add(gr); return gr; };
const arrowsUp = [mkArrow(-3.2, 6, 24, arrowMat), mkArrow(WC + 3.2, 6, 24, arrowMat)], arrowsDown = [mkArrow(WC / 2, 24, 6, arrowMat2)];

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
window.CINEMA_FOCUS = () => ({ point: [WC / 2, 14, 0], fstop: 0 });

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
hud.badge("hook-speed", { kind: "speed", slot: FILM.noteSlots.hook, t0: 0, t1: CUE.cuts.normal, text: () => FILM.speedNote });
hud.badge("speed", { kind: "speed", slot: FILM.noteSlots.speed, t0: CUE.cuts.normal, t1: null, text: () => FILM.speedNote });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an === "ball") return (t) => { const [x, y] = posAt(t, 0); return [x + RB, y, 0]; };
  if (an === "small") return () => [WC - 2, 24, 0];
  if (an === "under") return (t) => { const [x, y] = posAt(t, 0); return [x + 1, y - RB - 1.2, 0]; };
  if (an === "wallL") return () => [-3.2, 15, 4];
  if (an === "mid") return () => [WC / 2, 15, 4];
  if (an === "ghost0") return () => { const [x, y] = ghostPos(0); return [x + RB, y, 0]; };
  return () => [WC / 2, 14, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: false });
const SPN = FILM.spine[0];
const spineVal = (t) => Math.max(0, posAt(t, 0)[1] - RB);
const spineOpts = { value: spineVal, fmt: (v) => v.toFixed(0), unit: "cm", label: SPN.label, t0: SPN.t0, t1: SPN.t1, minCh: 2 }, counterEl = hud.counter("spine", spineOpts);
placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });
const win = (t, w, fin = 0.5, fout = 0.4) => (w ? Math.min(E.out2(seg(t, w[0], w[0] + fin)), 1 - E.in2(seg(t, w[1] - fout, w[1]))) : 0);

window.seek = function (t) {
  stage(t);
  placeCam(t);
  const fl = floorAt(t);
  for (let i = 1; i < NP; i++) { const [x, y] = posAt(t, i); p3.set(x, y, 0); s3.set(RS, RS, RS); mtx.compose(p3, q0, s3); grains.setMatrixAt(i - 1, mtx); }
  grains.instanceMatrix.needsUpdate = true;
  const [bx, by] = posAt(t, 0); ball.position.set(bx, by, 0); ring.position.set(bx, by, 0);
  base.position.set(WC / 2, fl - 0.8, 0);
  ruler.visible = t >= CUE.height[0] - 0.3 && t < CUE.cuts.tease;
  const ak = win(t, CUE.arrows);
  arrowsUp.forEach((a) => { a.visible = ak > 0.01; a.children.forEach((m) => { m.material.opacity = ak; }); });
  arrowsDown.forEach((a) => { a.visible = ak > 0.01; a.children.forEach((m) => { m.material.opacity = ak; }); });
  ghosts.forEach((g, k) => { const tk = CUE.ghosts.every * k; g.visible = t >= CUE.ghosts.t0 && t < CUE.ghosts.t1 && simT(t) >= tk + 0.1; if (g.visible) { const [gx, gy] = ghostPos(k); g.position.set(gx, gy, 1); } });
  cyc.update({ grid: 1, casters: [[WC / 2, 2, 0, 14]] });
  dropT(t); dropE(t);
  hud.update(t);
  renderer.render(scene, camera);
};
