// Rest Frame No. 004, "The hammer and the feather" (films/channels/physics/ep04): the picture, a pure function of t.
// The channel's Bench (../set: the cyc, the Moon dressing, the hammer and the feather, ink drawings, the title drop)
// plus the kit's blocks (hud, clock, strobe, arrows). Everything timed comes from film.json (compile.py).
//
// The physics: both released from rest with their lowest points 160 cm up. On the Moon (162 cm/s², no air) both fall
// in 1.405 s, exactly together (closed form). On Earth the hammer falls freely (0.571 s); the feather's drift is an
// illustration (badged). The whoa's Earth, orbit and satellite are an ink illustration.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { strobe } from "cinema/sci/strobe.js";
import { arrows } from "cinema/sci/arrows.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { createMoonFloor, createHammer, createFeather } from "../set/moon.js";
import { inkSet, hand } from "../set/ink.js";
import { dropTitle } from "../set/title.js";
import { unlit, acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, DR = FILM.drop, TAKES = FILM.takes, EC = FILM.endCard;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 5, 4000);

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK, stickX: -46 });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;
const moon = createMoonFloor({ size: 420, z: -20 }); scene.add(moon.group);
const hammer = createHammer(), feather = createFeather();
scene.add(hammer, feather);
const HAM_LOW = 29.4;                                     // the hammer's origin (head centre) above its lowest point (the handle's end)

const clk = clock(FILM.clock, { words: { slow: "{n}× slower", fast: "{n}× faster", freeze: "paused" } });
const TAKE_NAMES = Object.keys(TAKES);
const takeAt = (t) => TAKE_NAMES.find((n) => t >= TAKES[n].t0 && t < TAKES[n].t1) || null;
const local = (take, t) => clk.tau(t) - TAKES[take].tauR;
// cm fallen: the Moon's closed form, Earth's free fall for the hammer, the feather's illustrated drift on Earth
const fallen = (world, which, tau) => {
  if (tau <= 0) return 0;
  if (world === "earth" && which === "feather") {
    const tc = DR.vt / DR.gE;
    return Math.min(DR.h0, tau < tc ? 0.5 * DR.gE * tau * tau : 0.5 * DR.gE * tc * tc + DR.vt * (tau - tc));
  }
  const g = world === "earth" ? DR.gE : DR.gM;
  return Math.min(DR.h0, 0.5 * g * tau * tau);
};
// the lowest point's height, and where each object's label anchors (the hammer's head, the feather's vane)
const objAt = (take, which, t) => {
  const tk = TAKES[take], tau = local(take, t), y = DR.h0 - fallen(tk.world, which, tau);
  if (which === "hammer") return [DR.xh, y + HAM_LOW, 0];
  const sway = tk.world === "earth" ? 4 * Math.sin(5 * Math.max(0, tau)) : 0;
  return [DR.xf + sway, y + 12, 0];
};

// ── ghost rows: beads at the hammer's head and the feather's middle, every 1/10 s (Moon) or 1/20 s (Earth) ──
const INK2 = unlit(TK["ink-2"] || "#4B505B");
const S = strobe({ geometry: new THREE.SphereGeometry(1, 20, 14), radius: 1.6, max: 48, pop: 0.14,
  material: new THREE.MeshLambertMaterial({ color: 0xffffff }), rim: { color: [0.045, 0.048, 0.055], width: 0.42, strength: 0.62 },
  rungs: { max: 16, radius: 0.22 }, park: [0, 60, 0] });
scene.add(S.group);
const HCOL = new THREE.Color().setRGB(0.42, 0.44, 0.47), FCOL = new THREE.Color().setRGB(0.36, 0.30, 0.24);
for (const name of TAKE_NAMES) {
  const tk = TAKES[name];
  if (!tk.stamps) continue;
  const earth = tk.world === "earth", dt = earth ? DR.dtE : DR.dt, n = earth ? DR.nE : DR.n;
  ["hammer", "feather"].forEach((which, j) => S.ladder(`${name}:${which}`, {
    at: (tau) => { const y = DR.h0 - fallen(tk.world, which, tau); return which === "hammer" ? [DR.xh, y + HAM_LOW, -2] : [DR.xf + (earth ? 4 * Math.sin(5 * tau) : 0), y + 12, -2]; },
    dt, n, when: (tau) => clk.tOf(tk.tauR + tau), t0: tk.t0, t1: tk.t1, slot: j * 16, color: which === "hammer" ? HCOL : FCOL,
  }));
  if (!earth) S.rung(`${name}:r`, { a: `${name}:feather`, b: `${name}:hammer`, k: [0, n - 1], slot: 0, color: INK2, grow: 0.2 });
}

// ── the why's vectors: gravity's pull (force) and the acceleration (motion) ──
const FORCE = unlit(TK.force || "#1F3BD1"), MOTION = unlit(TK.motion || "#08805A");
const AR = arrows({ max: 8, shaft: 0.6, head: [3.6, 1.6], outline: 0.34, ink: acesInv(TK.ink || "#15171C"), park: [0, 60, 0] });
scene.add(AR.group);
const HOLD = [TAKES.why.t0, TAKES.why.t1];
AR.add("pull-h", { tail: (t) => objAt("why", "hammer", t), vec: [0, -34, 0], color: FORCE, t0: CUE.why.pull, t1: CUE.why.inertia, slot: 0, hold: HOLD });
AR.add("pull-f", { tail: (t) => objAt("why", "feather", t), vec: [0, -1.2, 0], color: FORCE, t0: CUE.why.pull + 0.15, t1: CUE.why.inertia, slot: 1, hold: HOLD });
AR.add("acc-h", { tail: (t) => objAt("why", "hammer", t), vec: [0, -16, 0], color: MOTION, t0: CUE.why.inertia + 0.4, t1: CUE.why.R + 0.4, slot: 2, hold: HOLD });
AR.add("acc-f", { tail: (t) => objAt("why", "feather", t), vec: [0, -16, 0], color: MOTION, t0: CUE.why.inertia + 0.55, t1: CUE.why.R + 0.4, slot: 3, hold: HOLD });

// ── ink: two hands that held them, the whoa's Earth and orbit ──
const I = inkSet({ color: TK["ink-2"] || "#4B505B" });
const handH = hand(I, { x: DR.xh - 3.5, y: DR.h0 + HAM_LOW + 3.6, z: 2, scale: 0.9 });
const handF = hand(I, { x: DR.xf + 3.5, y: DR.h0 + 24 + 1.4, z: 2, scale: 0.9 }); handF.scale.x = -1;
scene.add(handH, handF);
const IS = inkSet({ color: TK["ink-2"] || "#4B505B", accent: TK.cobalt || "#1F3BD1" });
const space = new THREE.Group(); space.position.set(0, 190, -20);
const earthR = 46, orbitR = 51.1;                        // 710 km over 6,371 km, to scale
space.add(IS.ring(earthR, 1.2), IS.ring(orbitR, 0.45));
const sat = IS.poly([[-2.2, -1.4], [2.2, -1.4], [2.2, 1.4], [-2.2, 1.4]], 0.6, true); space.add(sat);
const masses = [IS.ring(0.9, 0.35, IS.accent), IS.ring(0.45, 0.3, IS.accent)]; masses.forEach((m) => sat.add(m));
scene.add(space);
const satAt = (t) => { const a = 1.2 + 0.9 * (t - CUE.whoa.orbit); return [orbitR * Math.cos(a), orbitR * Math.sin(a)]; };

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
  camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.lookAt(c.look[0], c.look[1], c.look[2]);
  camera.updateMatrixWorld();
};
window.CINEMA_FOCUS = () => ({ point: [0, 80, 0], fstop: 0 });
const PROBE_PTS = [[-40, 160, 0], [40, 160, 0], [-40, 0, 0], [40, 0, 0], [0, 80, -60]].map((p) => new THREE.Vector3(...p));
const pv = new THREE.Vector3();

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
hud.badge("warp", { from: clk, slot: "tr" });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an.obj) return (t) => objAt(an.obj[0], an.obj[1], t);
  if (an.arrow) return (t) => AR.tip(an.arrow, t);
  if (an.sat) return (t) => { const s = satAt(t); return [s[0], 190 + s[1], -20]; };
  return () => an.point;
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.anchor), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: !!lb.fixed, v: lb.v });
const SP = FILM.spine;
const spineAt = (t) => SP.find((s) => t >= s.t0 && t < s.t1) || (t < SP[0].t0 ? SP[0] : SP[SP.length - 1]);
const spineTxt = (t) => {
  const s = spineAt(t);
  if (s.kind === "text") return s.text;
  if (s.kind === "const") return s.v.toFixed(s.dp);
  return Math.min(s.cap, Math.max(0, local(s.take, t))).toFixed(s.dp);
};
const counterEl = hud.counter("spine", { value: () => 0, fmt: () => "0.00", unit: "s", label: SP[0].label, t0: SP[0].t0, t1: SP[SP.length - 1].t1, at: [0.29, 0.235], minCh: 4 });
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const foot = document.createElement("div"); foot.className = "rf-foot"; foot.textContent = FILM.end.foot; endEl.appendChild(foot);
{ const st = document.createElement("style");
  st.textContent = ".hud-badge.card { max-width: 44vmin; } #hud .hud-counter { padding: .9vmin 2.2vmin 1.2vmin; border-radius: .8vmin; background: rgba(255, 253, 247, .95); } "
    + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const take = takeAt(t) || "loop", tk = TAKES[take], inSpace = tk.world === "space";
  // the Moon's regolith: on in the hook, off for Earth, faded in on "take the air away", on from then (not in space)
  const mk = take === "hook" ? 1 : take === "earth" ? 0 : take === "moon" ? E.inout2(seg(t, CUE.moon.fade[0], CUE.moon.fade[1])) : 1;
  moon.set(mk);
  const casters = [];
  const showObj = take !== "space";
  hammer.visible = feather.visible = showObj; handH.visible = handF.visible = showObj;
  if (showObj) {
    const h = objAt(take, "hammer", t), fe = objAt(take, "feather", t), tau = local(take, t);
    hammer.position.set(...h);
    // the hammer tips over once it lands (an illustration: the fall itself is exact)
    const tl = (tk.world === "earth" ? DR.tE : DR.tM);
    const tip = Math.min(1, Math.max(0, (tau - tl) / 0.35));
    hammer.rotation.z = -1.45 * E.in2(tip);
    hammer.position.x = DR.xh + Math.sin(1.45 * E.in2(tip)) * HAM_LOW; hammer.position.y = h[1] - (1 - Math.cos(1.45 * E.in2(tip))) * HAM_LOW + 0.0;
    feather.position.set(fe[0], fe[1] - 12, 0);
    feather.rotation.z = tk.world === "earth" ? 0.3 * Math.sin(5 * Math.max(0, tau) + 1) * Math.min(1, Math.max(0, tau) * 4) : 0.08;
    casters.push([hammer.position.x, hammer.position.y - 10, 0, 6], [fe[0], fe[1] - 6, 0, 3]);
  }
  space.visible = inSpace;
  if (inSpace) { const s = satAt(t); sat.position.set(s[0], s[1], 0); sat.rotation.z = Math.atan2(s[1], s[0]); }
  S.update(t); AR.update(t);
  cyc.update({ grid: 1, casters });
  if (window.CINEMA && window.CINEMA.mode === "probe") {
    PROBE_PTS.forEach((p, i) => {
      pv.copy(p).project(camera);
      if (Math.abs(pv.x) <= 1.15 && Math.abs(pv.y) <= 1.15 && pv.z < 1) window.CINEMA.probe.set("bench" + i, [(pv.x + 1) * 0.5 * W, (1 - pv.y) * 0.5 * H]);
    });
  }
  dropT(t); dropE(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterV.textContent = spineTxt(t); counterU.textContent = s.unit; }
  hud.update(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterV.textContent = spineTxt(t); counterU.textContent = s.unit;
    counterEl.classList.toggle("lit", !!(s.lit && t >= s.lit[0] && t < s.lit[1])); }
  renderer.render(scene, camera);
};
