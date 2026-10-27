import * as THREE from "three";
// Back of the Envelope No. 001, "Through the Earth" (films/channels/whatif/ep01). The picture as a pure
// function of t for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the
// fall clock, every object and the overlay from t alone, then makes exactly one renderer.render().
//
// One world (bible §2): a half-cut Earth model (1 unit = 1,000 km) floating over the graph-paper desk, its
// cut face to the camera, a straight tunnel from pole to pole. The faller ("you", anchor blue, not to
// scale: badged) falls along the trajectory calc.py computed with PREM's density (film.json phys.depth); a
// ruler as long as the tunnel lies on the paper with a car on it (the human-scale anchor). The gravity
// profile is drawn on the cut face beside the tunnel: the textbook (uniform) line dashed in chalk, the real
// Earth's in marker. The running sum (set/spine.js) sits under the model, above the captions, and boxes
// "≈ 38 min" on the word; the show-your-work card is the segment; the core lights marker at the takeaway.
// Everything timed comes from film.json, which compile.py hangs on the voice; this file only stages it.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { segment } from "cinema/sci/front.js";
import { createDesk } from "../set/desk.js";
import { createGlobe, strip } from "../set/globe.js";
import { createFigure, createCar } from "../set/anchor.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, fmtKms, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok, hdr } from "../set/look.js";

const FILM = window.FILM, W = window.W, H = window.H, PH = FILM.phys, CUE = FILM.cue, FPS = FILM.fps || 30;
const TK = (window.THEME && window.THEME.tokens) || {};
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.5, 2000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.9, bloom: 0.45 });   // only the lit core blooms
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });                           // nothing nears the lens
injectCss();

// ── the fall clock (clock.js keys, pinned so τ(anchor t) = anchor τ) ─────────
const WORDS = { fast: "time {n}× faster", slow: "{n}× slower", freeze: null };
const pinned = (c) => { const c0 = clock(c.keys, { words: WORDS }); return clock(c.keys, { words: WORDS, tau0: c.anchor[1] - c0.tau(c.anchor[0]) }); };
const CLK = Object.fromEntries(Object.entries(FILM.clk).map(([k, c]) => [k, pinned(c)]));
const R = PH.R, TT = PH.t_trip, HALF = PH.half_s, N = PH.depth.length - 1;
// depth below the entry rim after τ s of fall (mirrored past the centre; back and forth beyond a trip)
const depthAt = (tau) => {
  let x = ((tau % (2 * TT)) + 2 * TT) % (2 * TT);
  if (x > TT) x = 2 * TT - x;
  const far = x > HALF, u = (far ? TT - x : x) / HALF * N, i = Math.min(N - 1, Math.floor(u));
  const d = PH.depth[i] + (PH.depth[i + 1] - PH.depth[i]) * (u - i);
  return far ? 2 * R - d : d;
};
const speedAt = (tau) => {
  let x = ((tau % (2 * TT)) + 2 * TT) % (2 * TT);
  if (x > TT) x = 2 * TT - x;
  const u = (x > HALF ? TT - x : x) / HALF * N, i = Math.min(N - 1, Math.floor(u));
  return PH.speed_ms[i] + (PH.speed_ms[i + 1] - PH.speed_ms[i]) * (u - i);
};
// τ of the faller at film time t: at rest on the top rim, then the fall (×250), at rest on the far rim, the
// whoa's back and forth (×1000, parked at the top rim), and at rest there to the end (the loop)
const tauAt = (t) => {
  if (t < CUE.jump) return 0;
  if (t < CUE.stop) return CLK.fall.tau(t);
  if (t < FILM.beats.find((b) => b.id === "whoa").t0) return TT;
  if (t < CUE.park) return CLK.whoa.tau(t);
  return 2 * TT * Math.round(CLK.whoa.tau(CUE.park) / (2 * TT));
};

// ── the set ─────────────────────────────────────────────────────────────────
const DESK_Y = -R - 1.5;
const desk = createDesk({ tokens: TK, y: DESK_Y, unit: 1, far: 70 });
scene.add(desk.group);
const globe = createGlobe({ R, layers: PH.layers_km.map((k) => k / 1000), tokens: TK });
scene.add(globe.group);
const FIG_H = 0.78, FIG_Z = 0.42;                                         // the figure stands just in front of the cut face
const you = createFigure({ tokens: TK, height: FIG_H });
scene.add(you.group);
const RULER_Z = 5.2, CAR_L = 0.9;
const car = createCar({ tokens: TK, length: CAR_L });
scene.add(car.group);
// the ruler lies square to the drive shot's camera (its azimuth from film.json), so it reads as a level line
const AZ = (FILM.cam.drive[1].az * Math.PI) / 180, EX = [Math.cos(AZ), 0, -Math.sin(AZ)], EZ = [Math.sin(AZ), 0, Math.cos(AZ)];
const onRuler = (u, off = 0, h = 0.02) => [EX[0] * u + EZ[0] * (RULER_Z + off), DESK_Y + h, EX[2] * u + EZ[2] * (RULER_Z + off)];
const ruler = segment({ color: hdr("chalk", 0.9), width: 3.2, opacity: 0 }).seg(onRuler(-R), onRuler(R));
const ticks = [-R, R].map((x) => segment({ color: hdr("chalk", 0.9), width: 3.2, opacity: 0 }).seg(onRuler(x, -0.5), onRuler(x, 0.5)));
const done = segment({ color: hdr("anchor", 1), width: 5, opacity: 0 });
scene.add(ruler.mesh, done.mesh, ...ticks.map((k) => k.mesh));

// the gravity profiles, drawn beside the model in its plane (a graph whose vertical axis is the tunnel itself:
// each height on the graph is the same height in the bore): x = the axis + g scaled, y = height
const GMAX = Math.max(...PH.g_prem), X0 = R + 1.1, XS = 3.4 / GMAX;
const profile = (g) => {
  const pts = [];
  for (let k = 64; k >= 0; k--) pts.push([X0 + g[k] * XS, PH.g_r[k]]);
  for (let k = 1; k <= 64; k++) pts.push([X0 + g[k] * XS, -PH.g_r[k]]);
  return pts;
};
const pUni = strip(profile(PH.g_uniform), { width: 0.075, color: hdr("chalk", 0.95), dash: 0.22 });
const pPrem = strip(profile(PH.g_prem), { width: 0.1, color: hdr("marker", 1.0) });
const axis = strip([[X0, R], [X0, -R]], { width: 0.03, color: hdr("chalk-2", 0.6) });
globe.group.add(axis.mesh, pUni.mesh, pPrem.mesh);
const kPeak = PH.g_prem.indexOf(GMAX);

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { figure: [0, R, FIG_Z], tunnel: [0, R * 0.55, 0], car: [0, DESK_Y + 0.6, RULER_Z], mantle: [-4.6, 0.6, 0], core: [-1.9, -0.8, 0],
  peak: [X0 + GMAX * XS, -PH.g_r[kPeak], 0], uni: [X0 + PH.g_uniform[32] * XS, PH.g_r[32], 0] };
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
const ANCHOR = Object.fromEntries(Object.keys(S).map((k) => [k, () => S[k]]));
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, b.clock ? { from: CLK[b.clock], t0: b.t0, t1: b.t1, slot: b.slot } : { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
// a counter that rides its anchor, kept clear of the top notes and of the running sum under the model
const ride = (anchor, dx, dy) => (t) => { const p = hud.project(S[anchor]); return [p.x / W + dx, Math.min(0.47, Math.max(0.25, p.y / H + dy))]; };
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1 };
  if (c.fmt === "days") Object.assign(o, { value: (t) => c.end * clamp01((t - c.drive[0]) / (c.drive[1] - c.drive[0])), fmt: (v) => String(Math.floor(v + 1e-6)), unit: "days", at: ride("car", 0, -0.085), minCh: 1, lit: (v) => v >= c.end - 1e-6 });
  else if (c.fmt === "kms") Object.assign(o, { value: (t) => speedAt(tauAt(t)), fmt: fmtKms, unit: "km/s", at: ride("figure", 0.21, 0.0), minCh: 4 });
  else Object.assign(o, { value: () => 0, fmt: () => c.text, at: ride("figure", 0.2, 0.0), lit: () => true });
  hud.counter(c.id, o);
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: ANCHOR[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.6vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "62vmin", margin: "4vmin auto 0" });
const box = endBox(endEl, { t0: FILM.endCard, answer: FILM.spine[FILM.spine.length - 1].terms.find((x) => x[0] === "ans")[1], S1 });

// ── staging ─────────────────────────────────────────────────────────────────
const LBL = Object.fromEntries(FILM.labels.map((l) => [l.id, l]));
const beat = (id) => FILM.beats.find((b) => b.id === id);
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1 - d, t1)));

window.seek = function (t) {
  const st = stage(t), shot = st.name;
  rig.place(camera, shot, t);
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));

  // the faller: on the rim at rest, arms down; falling, arms up; the depth is PREM's (calc.py)
  const tau = tauAt(t), d = depthAt(tau), moving = t >= CUE.jump && t < CUE.park && !(t >= CUE.stop && t < beat("whoa").t0);
  const atTop = d < 1e-3, atBottom = d > 2 * R - 1e-3;
  const y = atTop ? R + FIG_H / 2 : atBottom ? -R - FIG_H / 2 : R - d;
  const step = CUE.jump - 0.35;                                          // the step in: from standing on the rim into the bore
  const yy = t >= step && t < CUE.jump ? R + FIG_H / 2 - (FIG_H / 2) * E.in2(seg(t, step, CUE.jump)) : y;
  const arms = moving ? 1 : t >= step && t < CUE.jump ? seg(t, step, CUE.jump) : 0;
  you.set({ at: [0, yy, FIG_Z], arms, tilt: atBottom && !moving ? Math.PI : 0 });
  S.figure = [0, yy, FIG_Z];

  // the car drives the ruler: as long as the tunnel, five days at 100 km/h
  const dr = CUE.drive, inDrive = shot === "drive";
  const u = clamp01((t - dr[0]) / (dr[1] - dr[0]));
  car.group.visible = inDrive;
  const ux = -R + 2 * R * E.inout2(u);
  car.set({ at: onRuler(ux, 0.6, 0), heading: AZ });
  S.car = onRuler(ux, 0.6, 0.9);
  const ro = inDrive ? fadeIn(t, beat("normal").t0 + 0.4, 0.6) : shot === "fall" ? 1 - seg(t, beat("change").t0, beat("change").t0 + 0.8) : 0;
  ruler.set({ opacity: ro }); ticks.forEach((k) => k.set({ opacity: ro }));
  done.seg(onRuler(-R, 0, 0.03), onRuler(ux + 1e-4, 0, 0.03)).set({ opacity: ro * (u > 0 ? 1 : 0) });

  // the cut face: the textbook (one grey) and the real layers; the profiles; the core at the payoff
  const L = CUE.layers, why = shot === "layers";
  const flat = why ? win(t, L.crust - 0.1, CUE.layers.mantle + 2.4, 0.5) : 0;
  const lit = why ? seg(t, L.core, L.core + 0.5) : 0;
  globe.set({
    light: [-0.55, 0.75, 0.45],
    hi: [lit, lit, why ? 0.4 * seg(t, L.mantle + 2.4, L.mantle + 3.0) : 0, 0, 0],
    glow: shot === "core" || shot === "end" ? 0.85 * E.inout2(seg(t, CUE.core, CUE.core + 0.7)) * (shot === "end" ? 1 - seg(t, FILM.endCard, FILM.endCard + 1.0) : 1) : 0,
    flat, tunnel: 1,
  });
  const tUni = FILM.spine[3].t;                                          // the textbook line draws on "forty-two"
  const showP = why || shot === "answer";
  S.uni = globe.group.localToWorld(new THREE.Vector3(X0 + PH.g_uniform[32] * XS, PH.g_r[32], 0)).toArray();
  pUni.set({ upto: E.inout2(seg(t, tUni, tUni + 1.2)), opacity: showP ? (shot === "answer" ? 0.6 * (1 - seg(t, beat("whoa").t0, beat("whoa").t0 + 1)) : 1) : 0 });
  pPrem.set({ upto: E.inout2(seg(t, L.graph, L.graph + 1.4)), opacity: showP ? (shot === "answer" ? 1 - seg(t, beat("whoa").t0, beat("whoa").t0 + 1) : 1) : 0 });
  axis.set({ opacity: showP ? Math.max(pUni.mesh.material.uniforms.uOpacity.value > 0 ? 0.8 : 0, 0) : 0 });

  // the desk: the lamp pool under the model, the model's and the car's shadows
  desk.update({ grid: 1, pool: [0, 2], casters: [[0, 0, 0, R * 0.92], car.group.visible ? [S.car[0], DESK_Y + 0.4, S.car[2], 0.55] : null].filter(Boolean) });

  hud.update(t);
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
