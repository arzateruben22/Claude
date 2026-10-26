// Rest Frame No. 002, "The swing's secret" (films/channels/physics/ep02): the picture, a pure function of t.
// The set is the channel's reusable Bench (../set: the cyc, the gantry and the exact pendulum of B6, the title
// drop) plus the kit's shared blocks (kits/cinema/sci: hud, clock, strobe, arrows). Everything timed comes from
// film.json, which compile.py hangs on the spoken words: the time warp, the takes (each release solved back from
// the word its bottom pass or its twentieth swing lands on), labels, badges, camera.
//
// The physics is exact and closed-form (set/swing.js): two identical 99.4 cm pendulums from 10° and 30°, the
// large-angle motion through Jacobi's elliptic functions, no air, no friction (badged). Ghosts are stamped at the
// true positions every 1/10 s of scene time. The whoa's fifteen are Harvard's 51 … 65 swings a minute.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { strobe } from "cinema/sci/strobe.js";
import { arrows } from "cinema/sci/arrows.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { createGantry, brassGhost } from "../set/pendulum.js";
import { pendulum } from "../set/swing.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, pinSpine } from "../set/spine.js";
import { unlit, acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, SW = FILM.swing, WV = FILM.wave, TAKES = FILM.takes, EC = FILM.endCard;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;                            // draw in scene-graph order (ep01: seek-order independence)
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 5, 4000);

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });                    // only its lights here: the stick and the rail stay out of shot
P.stick.visible = false; P.rig.group.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;

const LANES = ["small", "big"];
const PIV = LANES.map((k) => [0, SW.pivotY, SW.lanes[k]]);
const RIG = createGantry({ pivots: PIV, L: SW.L, r: SW.r, beamX: 0, post: [-70, 5] });
const PEND = Object.fromEntries(LANES.map((k, i) => [k, pendulum({ L: SW.L, theta0: SW.theta[k], pivot: PIV[i] })]));
const WPIV = WV.L.map((_, n) => [0, WV.y, WV.z0 + n * WV.dz]);
const WAVE = createGantry({ pivots: WPIV, L: WV.L, r: WV.r, beamX: 0, post: [40, WV.z0 + (WV.n - 1) * WV.dz / 2], string: 0.1, beamPad: 5, beamW: 2 });
const WP = WV.L.map((L, n) => pendulum({ L, theta0: WV.theta, pivot: WPIV[n] }));
scene.add(RIG.group, WAVE.group);

// "as in a grandfather clock": a 2 m long-case clock drawn as ink lines beside the rig (an illustration, the
// human-scale anchor), its 99.4 cm pendulum swinging with the small one; it draws on and off with the line
const GC = FILM.gclock, gcMat = new THREE.MeshBasicMaterial({ color: unlit(TK["ink-2"] || "#4B505B"), transparent: true, opacity: 0, depthWrite: false });
const gclock = new THREE.Group(), gcPend = new THREE.Group();
const bar = (x0, y0, x1, y1, w = 0.9) => { const l = Math.hypot(x1 - x0, y1 - y0), m = new THREE.Mesh(new THREE.BoxGeometry(l, w, 0.4), gcMat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); return m; };
{
  const w = GC.w / 2, h = GC.h, hood = h - 52, waist = 70, ww = w - 6;
  [[-w, 0, w, 0], [-w, 0, -w, 14], [w, 0, w, 14], [-w, 14, w, 14], [-ww, 14, -ww, hood], [ww, 14, ww, hood], [-ww, waist, ww, waist],   // base, trunk
   [-w, hood, w, hood], [-w, hood, -w, h - 6], [w, hood, w, h - 6], [-w, h - 6, 0, h], [0, h, w, h - 6]].forEach((b) => gclock.add(bar(...b)));   // hood
  const dial = new THREE.Mesh(new THREE.TorusGeometry(15, 0.5, 6, 48), gcMat); dial.position.set(0, hood + 22, 0); gclock.add(dial);
  gcPend.position.set(0, GC.pivotY, 0); const rod = bar(0, 0, 0, -SW.L + 6, 0.7); gcPend.add(rod);
  const disc = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.7, 6, 32), gcMat); disc.position.set(0, -SW.L, 0); gcPend.add(disc);
  gclock.add(gcPend); gclock.position.set(GC.x, 0, GC.z); scene.add(gclock);
}

const clk = clock(FILM.clock, { words: { slow: "{n}× slower", fast: "{n}× faster", freeze: "paused" } });
const TAKE_NAMES = Object.keys(TAKES);
const takeAt = (t) => TAKE_NAMES.find((n) => t >= TAKES[n].t0 && t < TAKES[n].t1) || null;
const local = (take, t) => clk.tau(t) - TAKES[take].tauR;
const pull = CUE.change.pull;
// the angle of a lane in a take: swinging if the take releases it, else hanging at rest (in the change, the big
// one is pulled out to 30° as "pull one three times farther" is said)
const thetaOf = (take, lane, t) => {
  const tk = TAKES[take];
  if (tk && tk.pend.includes(lane)) return PEND[lane].theta(local(take, t));
  if (take === "change" && lane === "big") return SW.theta.big * E.inout3(seg(t, pull[0], pull[1]));
  return 0;
};
const bobPos = (take, lane, t) => RIG.bobAt(LANES.indexOf(lane), thetaOf(take, lane, t));

// ── the strobe ladders: one per lane per take, a ghost every 1/10 s of scene time ──
const GZ = 2;                                            // ghosts 2 cm behind the live bobs (ep01)
const INK2 = unlit(TK["ink-2"] || "#4B505B");
const S = strobe({
  geometry: new THREE.SphereGeometry(1, 24, 16), radius: 2.0,          // beads, not copies: the gaps between them must read max: 48, pop: 0.18,
  material: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  rim: { color: [0.05, 0.045, 0.035], width: 0.42, strength: 0.6 },
  rungs: { max: 12, radius: 0.28 }, park: [0, 60, 5],
});
scene.add(S.group);
const GHOST = brassGhost();
for (const name of TAKE_NAMES) {
  const tk = TAKES[name];
  if (tk.ladder === undefined) continue;
  tk.pend.forEach((lane) => S.ladder(`${name}:${lane}`, {
    at: (tau) => { const p = PEND[lane].pos(tau); return [p[0], p[1], p[2] - GZ]; }, tau0: tk.ladder, dt: SW.dt, n: SW.n,
    when: (tau) => clk.tOf(tk.tauR + tau), t0: tk.t0, t1: tk.t1, slot: LANES.indexOf(lane) * SW.n, color: GHOST,
  }));
}
S.rung("why:same", { a: "why:small", b: "why:big", k: [0, SW.n - 1], at: (k) => CUE.why.rungs + 0.07 * k, grow: 0.3, slot: 0, color: INK2 });

// ── the vectors: the pull back along the arc (force) and the speed at the bottom (motion) ──
const FORCE = unlit(TK.force || "#1F3BD1"), MOTION = unlit(TK.motion || "#08805A");
const AR = arrows({ max: 8, shaft: 0.6, head: [3.6, 1.6], outline: 0.34, ink: acesInv(TK.ink || "#15171C"), park: [0, 60, 5] });
scene.add(AR.group);
const HOLD = [TAKES.why.t0, TAKES.why.t1];
LANES.forEach((lane, i) => {
  const th = SW.theta[lane], F = 40 * Math.sin(Math.abs(th));
  AR.add(`wy-f-${lane}`, { tail: (t) => bobPos("why", lane, t), vec: [F * Math.cos(th), F * Math.sin(th), 0], color: FORCE,
    t0: CUE.why.pull + 0.15 * i, t1: CUE.why.R, slot: i, hold: HOLD });
  AR.add(`wy-v-${lane}`, { tail: (t) => bobPos("why", lane, t), vec: (t) => { const v = PEND[lane].vel(local("why", t)); return [v[0] * 0.12, v[1] * 0.12, 0]; },
    color: MOTION, t0: CUE.why.speed + 0.15 * i, t1: CUE.why.rungs - 0.15, slot: 2 + i, hold: HOLD });
});

// ── camera: orbit keys per shot (film.json "cam"); pitch > 0 looks down ──
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
window.CINEMA_FOCUS = () => ({ point: [0, 50, 5], fstop: 0 });
const PROBE_PTS = [[-50, 116, 30], [50, 116, -20], [-50, 0, 30], [50, 0, -20], [0, 50, -40]].map((p) => new THREE.Vector3(...p));
const pv = new THREE.Vector3();

// ── the overlay ───────────────────────────────────────────────────────────
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
hud.badge("warp", { from: clk, slot: "tr" });
// the hook's speed note: bottom-right, so the poster's title has the top of the frame to itself
{ const HN = FILM.hookNote;
  hud.badge("hook-speed", { kind: "speed", slot: "br", t0: 0, t1: HN.paused[1], text: (t) => (t < HN.paused[0] ? "10× slower" : "paused") }); }
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const waveBob = (n, t) => WAVE.bobAt(n, WP[n].theta(local("wave", t)));
const anchorFn = (an) => {
  if (an.bob) return (t) => bobPos(an.bob[0], an.bob[1], t);
  if (an.ghost) return () => S.ghost(`${an.ghost[0]}:${an.ghost[1]}`, an.ghost[2]);
  if (an.string) return (t) => { const take = takeAt(t) || "measure", i = LANES.indexOf(an.string), b = bobPos(take, an.string, t), p = PIV[i];
    return [p[0] + (b[0] - p[0]) * an.u, p[1] + (b[1] - p[1]) * an.u, p[2]]; };
  if (an.arrow) return (t) => AR.tip(an.arrow, t);
  if (an.wave !== undefined) return (t) => waveBob(an.wave, t);
  return () => an.point;
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.anchor), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: !!lb.fixed, v: lb.v });
// the spine readout: one number from the normal to the end card; its label names the beat (film.json "spine")
const SWG = CUE.measure.swings, nSw = (t) => SWG.filter((x) => t >= x).length, SP = FILM.spine;
const spineAt = (t) => SP.find((s) => t >= s.t0 && t < s.t1) || (t < SP[0].t0 ? SP[0] : SP[SP.length - 1]);
const spineVal = (t) => {
  const s = spineAt(t);
  if (s.kind === "const") return s.v;
  if (s.kind === "count") return nSw(t);
  return Math.min(s.cap, Math.max(0, local(s.take, t)));
};
const spineOpts = { value: spineVal, fmt: (v) => v.toFixed(2), unit: "s", label: "one swing",
  t0: SP[0].t0, t1: SP[SP.length - 1].t1, at: [0.25, 0.235], minCh: 4 }, counterEl = hud.counter("spine", spineOpts);
pinSpine(spineOpts, counterEl, hud, W, 0.235);
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const foot = document.createElement("div"); foot.className = "rf-foot"; foot.textContent = FILM.end.foot; endEl.appendChild(foot);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const take = takeAt(t) || "measure", wave = take === "wave";
  RIG.group.visible = !wave; WAVE.group.visible = wave;
  const casters = [];
  if (!wave) {
    LANES.forEach((lane, i) => { const th = thetaOf(take, lane, t); RIG.set(i, th); const p = RIG.bobAt(i, th); casters.push([p[0], p[1], p[2], SW.r]); });
    casters.push([-70, 3, 5, 5]);
  } else {
    WP.forEach((pd, n) => { const th = pd.theta(local("wave", t)); WAVE.set(n, th); if (n % 2 === 0) { const p = WAVE.bobAt(n, th); casters.push([p[0], p[1], p[2], WV.r]); } });
    casters.length = Math.min(casters.length, 7); casters.push([40, 3, WV.z0 + (WV.n - 1) * WV.dz / 2, 5]);
  }
  const gk = Math.min(E.out3(seg(t, GC.t0, GC.t0 + 0.6)), 1 - E.in3(seg(t, GC.t1, GC.t1 + 0.5)));
  gclock.visible = gk > 0.001; gcMat.opacity = gk; gcPend.rotation.z = take === "normal" ? thetaOf("normal", "small", t) : 0;
  S.update(t); AR.update(t);
  cyc.update({ grid: 1, casters });
  if (window.CINEMA && window.CINEMA.mode === "probe") {
    PROBE_PTS.forEach((p, i) => {
      pv.copy(p).project(camera);
      if (Math.abs(pv.x) <= 1.15 && Math.abs(pv.y) <= 1.15 && pv.z < 1) window.CINEMA.probe.set("bench" + i, [(pv.x + 1) * 0.5 * W, (1 - pv.y) * 0.5 * H]);
    });
  }
  dropT(t); dropE(t);
  { const s = spineAt(t); counterLb.textContent = s.label; }   // before the HUD measures it
  hud.update(t);
  { const s = spineAt(t); counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp); counterEl.classList.toggle("lit", !!s.lit); }
  renderer.render(scene, camera);
};
