// Rest Frame No. 003, "Where does the bounce go?" (films/channels/physics/ep03): the picture, a pure function of t.
// The channel's Bench (../set: the cyc, the props, the closed-form bounce, the stacked drop, ink drawings, the title
// drop) plus the kit's blocks (hud, clock, strobe). Everything timed comes from film.json (compile.py hangs it on
// the spoken words).
//
// The physics: a tennis ball dropped from 1 m bouncing with restitution 0.75 (set/bench.js, exact, no air); one
// contact slowed ×40 with a 5 ms squash (an illustration, badged); a tennis ball on a basketball dropped from 50 cm
// with perfect bounces (set/balls.js, badged). The sound rings, the heat glow and Joule's apparatus are illustrations.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { strobe } from "cinema/sci/strobe.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { ballAt, R_BALL } from "../set/bench.js";
import { createBasketball, stackDrop } from "../set/balls.js";
import { inkSet, hand, joule } from "../set/ink.js";
import { dropTitle } from "../set/title.js";
import { unlit } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, BN = FILM.bench, ST = FILM.stack, TAKES = FILM.takes, EC = FILM.endCard;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 2, 4000);

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK, stickX: BN.stickX });
P.rig.group.visible = false;                              // the hand drops it here, not the rail
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;
const ball = P.ball(); scene.add(ball);
const basket = createBasketball({ r: ST.R }); scene.add(basket);
const tennis2 = P.ball(); scene.add(tennis2);
const SPEC = { x0: BN.x0, vx: BN.vx, e: BN.e, drop: BN.drop };
const STK = stackDrop({ drop: ST.drop, R: ST.R, r: BN.r, M: ST.M, m: ST.m, e: 1, e2: 1, x: ST.x });

const clk = clock(FILM.clock, { words: { slow: "{n}× slower", fast: "{n}× faster", freeze: "paused" } });
const TAKE_NAMES = Object.keys(TAKES);
const takeAt = (t) => TAKE_NAMES.find((n) => t >= TAKES[n].t0 && t < TAKES[n].t1) || null;
const local = (take, t) => clk.tau(t) - TAKES[take].tauR;
// the macro's contact: 5 ms of squash (an illustration; the bench's other bounces are instants)
const macroAt = (tau) => {
  if (tau < BN.land) return { p: ballAt(tau, SPEC), sq: 0 };
  if (tau < BN.land + BN.dc) {
    const d = BN.squash * Math.sin((Math.PI * (tau - BN.land)) / BN.dc), x = BN.x0 + BN.vx * tau;
    return { p: [x, BN.r - d, 0], sq: d };
  }
  return { p: ballAt(tau - BN.dc, SPEC), sq: 0 };
};
const ballPos = (take, t) => (TAKES[take].kind === "macro" ? macroAt(local(take, t)).p : ballAt(local(take, t), SPEC));

// ── the strobe ladders: the drop and its bounces, a ghost every 1/20 s ──
const S = strobe({ geometry: new THREE.SphereGeometry(1, 24, 16), radius: BN.r * 0.6, max: 48, pop: 0.16,
  material: new THREE.MeshLambertMaterial({ color: 0xffffff }), rim: { color: [0.045, 0.048, 0.055], width: 0.42, strength: 0.62 }, park: [0, 50, 0] });
scene.add(S.group);
for (const name of ["hook", "normal", "record", "loop"]) {
  const tk = TAKES[name];
  S.ladder(name, { at: (tau) => { const p = ballAt(tau, SPEC); return [p[0], p[1], p[2] - 2]; }, dt: BN.dt, n: BN.n,
    when: name === "record" ? () => tk.t0 - 1 : (tau) => clk.tOf(tk.tauR + tau), t0: tk.t0, t1: tk.t1, slot: 0, color: P.ghostColor });
}
// the stack's climb: the tennis ball every 1/20 s from the hit to its peak, slowing all the way up
S.ladder("stack", { at: (tau) => { const p = STK.small(tau); return [p[0], p[1], p[2] - 2]; }, tau0: ST.thit, dt: BN.dt, n: 18,
  when: (tau) => clk.tOf(TAKES.stack.tauR + tau), t0: TAKES.stack.t0, t1: TAKES.stack.t1, slot: 0, color: P.ghostColor });

// ── ink drawings: the hands, Joule's apparatus ──
const I = inkSet({ color: TK["ink-2"] || "#4B505B", accent: TK.energy || "#B8321A" });
const handB = hand(I, { x: BN.x0 - 4.5, y: BN.drop + 2 * BN.r + 1.6, z: 1.5, scale: 1.0 });
const handS = hand(I, { x: ST.x - 4.5, y: ST.handY + 1.6, z: 1.5, scale: 1.0 });
const IJ = inkSet({ color: TK["ink-2"] || "#4B505B", accent: TK.energy || "#B8321A" });   // its own material: it draws on and off
const J = joule(IJ, { x: FILM.joule.x, z: FILM.joule.z });
J.group.scale.setScalar(FILM.joule.s);
scene.add(handB, handS, J.group);
const handAt = (which) => (which === "stack" ? [ST.x - 2, ST.handY + 5, 1.5] : [BN.x0 - 2, BN.drop + 2 * BN.r + 5, 1.5]);

// ── illustrations: the sound rings, the heat glow ──
const WAVE = new THREE.MeshBasicMaterial({ color: unlit(TK.wave || "#6D3FC8"), transparent: true, opacity: 0, depthWrite: false });
const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 72), WAVE.clone()); scene.add(m); return m; });
const glowMat = new THREE.MeshBasicMaterial({ color: unlit(TK.energy || "#B8321A"), transparent: true, opacity: 0, depthWrite: false });
const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glowMat); scene.add(glow);
const CONTACT = [BN.x0 + BN.vx * BN.land, 0.6, 1.0];
const ringR = (k, t, t0) => { const u = seg(t, t0 + 0.28 * k, t0 + 0.28 * k + 1.6); return { r: 2.5 + 12 * E.out3(u), a: u > 0 && u < 1 ? (1 - u) * 0.95 : 0 }; };
const ringPt = (k, t) => { const t0 = t < CUE.cuts.why ? CUE.change.rings : CUE.why.sound, q = ringR(k - 1, t, t0); return [CONTACT[0] + q.r * 0.7, CONTACT[1] + q.r * 0.7, CONTACT[2]]; };

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
window.CINEMA_FOCUS = () => ({ point: [0, 50, 0], fstop: 0 });
const PROBE_PTS = [[-40, 100, 0], [40, 100, 0], [-40, 0, 0], [40, 0, 0], [0, 50, -60]].map((p) => new THREE.Vector3(...p));
const pv = new THREE.Vector3();

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
hud.badge("warp", { from: clk, slot: "tr" });
{ const HN = FILM.hookNote;   // the hook's speed note, bottom-right: the poster's title keeps the top to itself
  hud.badge("hook-speed", { kind: "speed", slot: "br", t0: 0, t1: HN.paused[1], text: (t) => (t < HN.paused[0] ? "5× slower" : "paused") }); }
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an.ball) return (t) => ballPos(an.ball, t);
  if (an.hand) return () => handAt(an.hand);
  if (an.tennis) return (t) => STK.small(local("stack", t));
  if (an.ring) return (t) => ringPt(an.ring, t);
  if (an.joule) { const s = FILM.joule.s; return () => (an.joule === "therm" ? [FILM.joule.x + 26 * s, 30 * s, FILM.joule.z] : [FILM.joule.x + 30 * s, 82 * s, FILM.joule.z]); }
  return () => an.point;
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.anchor), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: !!lb.fixed, v: lb.v });
const SP = FILM.spine;
const spineAt = (t) => SP.find((s) => t >= s.t0 && t < s.t1) || (t < SP[0].t0 ? SP[0] : SP[SP.length - 1]);
const spineVal = (t) => {
  const s = spineAt(t);
  if (s.kind === "const") return s.v;
  if (s.kind === "stack") return Math.max(0, STK.small(local("stack", t))[1] - BN.r);
  const take = takeAt(t) || s.take;
  return Math.max(0, ballPos(take, t)[1] - BN.r);
};
const counterEl = hud.counter("spine", { value: spineVal, fmt: (v) => v.toFixed(0), unit: "cm", label: SP[0].label, t0: SP[0].t0, t1: SP[SP.length - 1].t1, at: [0.26, 0.19], minCh: 4 });
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const foot = document.createElement("div"); foot.className = "rf-foot"; foot.textContent = FILM.end.foot; endEl.appendChild(foot);
{ const st = document.createElement("style");
  st.textContent = ".hud-badge.card { max-width: 40vmin; } #hud .hud-counter { padding: .9vmin 2.2vmin 1.2vmin; border-radius: .8vmin; background: rgba(255, 253, 247, .95); } "
    + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const take = takeAt(t) || "loop", tk = TAKES[take], casters = [[BN.stickX, 2.4, 0, 2.4]];
  const isStack = tk.kind === "stack";
  ball.visible = !isStack; basket.visible = isStack; tennis2.visible = isStack;
  ball.scale.set(1, 1, 1);
  if (!isStack) {
    const tau = local(take, t);
    if (tk.kind === "macro") {
      const m = macroAt(tau); ball.position.set(...m.p); const k = 1 - m.sq / BN.r; ball.scale.set(1 + (1 - k) * 0.55, k, 1 + (1 - k) * 0.55);
    } else ball.position.set(...ballAt(tau, SPEC));
    casters.push([ball.position.x, ball.position.y, 0, BN.r]);
  } else {
    const tau = local("stack", t), b = STK.big(tau), s = STK.small(tau);
    basket.position.set(...b); tennis2.position.set(...s); basket.rotation.z = 0.25 - 0.002 * b[1];
    casters.push([b[0], b[1], 0, ST.R], [s[0], s[1], 0, BN.r]);
  }
  // the hands: the bench's from the start to the change and from the measure on; the stack's in the whoa
  const hb = take === "macro" ? 0 : isStack ? 0 : 1;
  handB.visible = hb > 0; handS.visible = isStack;
  // ink opacity: hands always full where shown; Joule's apparatus draws on and off in the why
  const jk = Math.min(E.out3(seg(t, CUE.why.joule[0] - 0.4, CUE.why.joule[0] + 0.3)), 1 - E.in3(seg(t, CUE.why.joule[1] - 0.2, CUE.why.joule[1] + 0.5)));
  J.group.visible = jk > 0.001;
  IJ.opacity(jk);
  J.update(E.inout2(seg(t, CUE.why.fall[0], CUE.why.fall[1])), E.out2(seg(t, CUE.why.fall[0] + 0.8, CUE.why.fall[1] + 0.6)));
  // the sound rings: in the change ("puff of sound") and again in the why ("sound")
  const r0 = t < CUE.cuts.why ? CUE.change.rings : CUE.why.sound;
  rings.forEach((m, k) => { const q = ringR(k, t, r0); m.visible = q.a > 0.001 && (take === "macro"); m.material.opacity = q.a; m.position.set(...CONTACT); m.scale.setScalar(q.r); });
  // the heat glow at the contact patch: from "squashes" on, fading slowly
  const gk = take === "macro" ? Math.min(E.out2(seg(t, CUE.change.heat, CUE.change.heat + 0.5)), 1) * (t < CUE.cuts.whoa ? 1 : 0) : 0;
  glow.visible = gk > 0.001; glowMat.opacity = 0.55 * gk;
  if (glow.visible) { glow.position.set(ball.position.x, ball.position.y - BN.r * ball.scale.y * 0.82, 0.6); glow.scale.set(1.9, 0.55, 1.9); }
  S.update(t);
  cyc.update({ grid: 1, casters });
  if (window.CINEMA && window.CINEMA.mode === "probe") {
    PROBE_PTS.forEach((p, i) => {
      pv.copy(p).project(camera);
      if (Math.abs(pv.x) <= 1.15 && Math.abs(pv.y) <= 1.15 && pv.z < 1) window.CINEMA.probe.set("bench" + i, [(pv.x + 1) * 0.5 * W, (1 - pv.y) * 0.5 * H]);
    });
  }
  dropT(t); dropE(t);
  { const s = spineAt(t); counterLb.textContent = s.label; }
  hud.update(t);
  { const s = spineAt(t); counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp);
    counterEl.classList.toggle("lit", !!(s.lit && t >= s.lit[0] && t < s.lit[1])); }
  renderer.render(scene, camera);
};
