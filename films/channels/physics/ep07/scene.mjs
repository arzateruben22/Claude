// Reality Rulebook No. 007, "The slinky that waits" (films/channels/physics/ep07): the picture, a pure function of t.
// The channel's Bench (../set: the cyc, the title drop, the spine plate) plus the kit's blocks (hud, strobe). Everything
// timed comes from film.json (compile.py). The physics is the instant-collapse model of a falling tension spring in closed
// form (Cross and Wheatland 2012, after Calkin 1993): the front runs down, the coils above it form one pile, the coils
// below stay exactly where they were, and the centre of mass falls at g. The slinky is an illustration (badged).
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { strobe } from "cinema/sci/strobe.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv, screenAlpha } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, EC = FILM.endCard, DUR = FILM.dur, DIM = FILM.dim, SL = FILM.slinky;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 5, 8000);
const dimAt = (name, t) => keyed(DIM[name], t, "linear");
const PAPER_HEX = TK.cyc || "#E6E2D8", onScreen = (k, hex) => screenAlpha(k, hex, PAPER_HEX);
const HEX = { ink2: TK["ink-2"] || "#4B505B", energy: TK.energy || "#B8321A", force: TK.force || "#1F3BD1", motion: TK.motion || "#08805A", ghost: "#55585F" };
const flat = (hex) => new THREE.Color().setRGB(...acesInv(hex));   // a flat colour that comes out as `hex` after the finish

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;

// ── the model (closed form, cm) ──
const { a: AA, xi1: XI1, l1: L1, g: GG, tc: TC, n: N, xb: XB, topY: TOP_Y, ring: RING } = SL;
const Xh = (xi) => (xi <= XI1 ? L1 * xi + AA * (XI1 * xi - xi * xi / 2) : L1 * XI1 + AA * XI1 * XI1 / 2 + L1 * (xi - XI1));
const tOfFront = (xf) => Math.sqrt(Math.max(0, 2 * AA * (XI1 * xf * xf / 2 - xf * xf * xf / 3) / GG));
const frontAt = (tau) => {
  if (tau <= 0) return 0;
  if (tau >= TC) return XI1;
  let lo = 0, hi = XI1;
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (tOfFront(m) < tau) lo = m; else hi = m; }
  return (lo + hi) / 2;
};
let XCOM = 0; for (let i = 0; i < 4000; i++) XCOM += Xh((i + 0.5) / 4000) / 4000;
const coilX = (xi, tau) => {                                  // distance below the release height, cm
  if (tau <= 0) return Xh(xi);
  if (tau < TC) { const xf = frontAt(tau); return xi > xf ? Xh(xi) : Xh(xf) - xf * L1 + xi * L1; }
  return XCOM + 0.5 * GG * tau * tau - L1 / 2 + xi * L1;
};
const coilY = (xi, tau) => TOP_Y - coilX(xi, tau);
const comY = (tau) => TOP_Y - XCOM - 0.5 * GG * Math.max(0, tau) * Math.max(0, tau);

// ── the clock: τ against film time, per take ──
const TAKES = FILM.takes;
const takeAt = (t) => TAKES.find((k) => t >= k.t0 && t < k.t1) || TAKES[TAKES.length - 1];
const tauAt = (t) => keyed(takeAt(t).keys, t, "lin");
const tOfTau = (name, tau) => {                              // the first film time at which the take reaches τ
  const k = TAKES.find((x) => x.name === name).keys;
  for (let i = 1; i < k.length; i++) if (k[i][1] >= tau && k[i - 1][1] < tau) return k[i - 1][0] + (k[i][0] - k[i - 1][0]) * (tau - k[i - 1][1]) / (k[i][1] - k[i - 1][1]);
  return Infinity;
};

// ── the slinky: N flat rings (ink look), the top one red and the bottom one blue ──
const ringGeo = new THREE.TorusGeometry(RING, 0.5, 8, 44); ringGeo.rotateX(Math.PI / 2);
const ringGeoBig = new THREE.TorusGeometry(RING, 0.95, 8, 44); ringGeoBig.rotateX(Math.PI / 2);
const coils = [];
for (let i = 0; i < N; i++) {
  const end = i === 0 ? "energy" : i === N - 1 ? "force" : null;
  const m = new THREE.Mesh(end ? ringGeoBig : ringGeo, new THREE.MeshBasicMaterial({ color: flat(end ? HEX[end] : HEX.ink2) }));
  scene.add(m); coils.push(m);
}
// the stand: a pole, an arm and a small hook that holds the top coil
const standMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) });
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, TOP_Y + 14, 12), standMat); pole.position.set(-36, (TOP_Y + 14) / 2, 0);
const arm = new THREE.Mesh(new THREE.BoxGeometry(36, 1.6, 1.6), standMat); arm.position.set(-18, TOP_Y + 7, 0);
const hook = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8, 1.6), standMat); hook.position.set(0, TOP_Y + 3, 0);
const foot = new THREE.Mesh(new THREE.BoxGeometry(24, 1.6, 12), standMat); foot.position.set(-36, 0.8, 0);
scene.add(pole, arm, hook, foot);

// the front (the news), the middle of the slinky and the dropped ball
const frontMat = new THREE.MeshBasicMaterial({ color: flat(HEX.force), transparent: true });
const frontRing = new THREE.Mesh(new THREE.TorusGeometry(RING + 2.2, 0.75, 8, 48), frontMat); frontRing.geometry.rotateX(Math.PI / 2); scene.add(frontRing);
const dotMat = new THREE.MeshBasicMaterial({ color: flat(HEX.energy), transparent: true });
const dot = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), dotMat); scene.add(dot);
const BALL_X = RING + 18;
const ballMat = new THREE.MeshBasicMaterial({ color: flat(HEX.force), transparent: true });
const ball = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), ballMat); scene.add(ball);

// the strobe: the top and bottom coils every 1/30 s of the slinky's own time (the change and the measure)
const ghostGeo = new THREE.TorusGeometry(1, 0.075, 8, 44); ghostGeo.rotateX(Math.PI / 2);
const S = strobe({ geometry: ghostGeo, radius: RING, max: 40, pop: 0.1, material: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), park: [0, 60, 0] });
scene.add(S.group);
const GH = CUE.ghosts;
for (const [name, take] of [["change", "change"], ["measure", "measure"]]) {
  const g = GH[name];
  S.ladder(`top-${name}`, { at: (tau) => [0, coilY(0, tau), 0], tau0: 0, dt: g.dt, n: g.n, when: (tau) => tOfTau(take, tau), t0: g.t0, t1: g.t1, slot: 0, color: flat(HEX.energy) });
  S.ladder(`bot-${name}`, { at: (tau) => [0, coilY(1, tau), 0], tau0: 0, dt: g.dt, n: g.n, when: (tau) => tOfTau(take, tau), t0: g.t0, t1: g.t1, slot: 12, color: flat(HEX.force) });
}

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
window.CINEMA_FOCUS = () => ({ point: [0, 150, 0], fstop: 0 });
const pv = new THREE.Vector3();

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
const slowTxt = (t) => { const s = FILM.speed.find((x) => t >= x.t0 && t < x.t1 && tauAt(t) > 0 && t >= x.t0); return s ? `${s.slow}× slower` : null; };
hud.badge("hook-speed", { kind: "speed", slot: FILM.noteSlots.hook, t0: 0, t1: CUE.cuts.normal, text: (t) => `${FILM.speed[1].slow}× slower` });
hud.badge("speed", { kind: "speed", slot: FILM.noteSlots.speed, t0: CUE.cuts.normal, t1: null, text: (t) => (t < CUE.cuts.normal ? null : slowTxt(t)) });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an === "top0") return () => [RING + 1, TOP_Y, 0];
  if (an === "top") return (t) => [RING, coilY(0, tauAt(t)), 0];
  if (an === "bottom") return (t) => [RING, coilY(1, tauAt(t)), 0];
  if (an === "front") return (t) => [RING + 2.2, TOP_Y - Xh(frontAt(tauAt(t))), 0];
  if (an === "mid") return (t) => [3, comY(tauAt(t)), 0];
  if (an === "ball") return (t) => [BALL_X + 3.4, comY(tauAt(t)), 0];
  const m = /^ghost-(top|bot)-(change|measure)-(\d+)$/.exec(an);
  if (m) return () => S.ghost(`${m[1]}-${m[2]}`, +m[3]);
  return () => [0, 0, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: false });
const SPN = FILM.spine;
const spineAt = (t) => SPN.find((s) => t >= s.t0 && t < s.t1) || (t < SPN[0].t0 ? SPN[0] : SPN[SPN.length - 1]);
const spineVal = (t) => {
  const s = spineAt(t), tau = Math.max(0, tauAt(t));
  if (s.kind === "bottom") return Math.max(0, coilX(1, tau) - XB);
  if (s.kind === "front") return (frontAt(tau) / XI1) * 100;
  if (s.kind === "mid") return 0.5 * GG * tau * tau;
  if (s.kind === "wait") return Math.min(tau, TC);
  return s.v;
};
const spineOpts = { value: spineVal, fmt: (v) => v.toFixed(0), unit: "cm", label: SPN[0].label, t0: SPN[0].t0, t1: SPN[SPN.length - 1].t1, minCh: 4 }, counterEl = hud.counter("spine", spineOpts);
placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });
const win = (t, w, fin = 0.5, fout = 0.4) => (w ? Math.min(E.out2(seg(t, w[0], w[0] + fin)), 1 - E.in2(seg(t, w[1] - fout, w[1]))) : 0);

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const tau = tauAt(t);
  for (let i = 0; i < N; i++) coils[i].position.set(0, coilY(i / (N - 1), tau), 0);
  // the front: the news running down the slinky (a third once the bottom has been reached)
  const fk = win(t, CUE.front) * dimAt("front", t);
  frontRing.visible = fk > 0.001 && tau > 0 && tau < TC;
  if (frontRing.visible) { frontRing.position.set(0, TOP_Y - Xh(frontAt(tau)), 0); frontMat.opacity = onScreen(fk, HEX.force); }
  // the middle of the slinky and a ball dropped from the same height at the same instant
  const mk = win(t, CUE.mid);
  dot.visible = mk > 0.001; dot.position.set(0, comY(tau), 0); dotMat.opacity = onScreen(mk, HEX.energy);
  const bk = win(t, CUE.ball) * dimAt("ball", t);
  ball.visible = bk > 0.001; ball.position.set(BALL_X, comY(tau), 0); ballMat.opacity = onScreen(bk, HEX.force);
  S.group.children.forEach((m) => { if (m.material && "opacity" in m.material && m.material.transparent) m.material.opacity = 0.9; });
  S.update(t);
  cyc.update({ grid: 1, casters: [[0, 60, 0, 26], [-36, 2, 0, 16]] });
  dropT(t); dropE(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp); }
  hud.update(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp);
    counterEl.classList.toggle("lit", !!(s.lit && t >= s.lit[0] && t < s.lit[1])); }
  renderer.render(scene, camera);
};
