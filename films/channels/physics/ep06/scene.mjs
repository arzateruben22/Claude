// Rest Frame No. 006, "The ten-metre straw" (films/channels/physics/ep06): the picture, a pure function of t.
// The channel's Bench (../set: the cyc, the mannequin, ink drawings, the title drop) plus the straw block (../set/straw.js:
// glass without transmission, liquid columns, the jar and its pump, the ink house, boiling) and the kit's blocks
// (hud, strobe, arrows). Everything timed comes from film.json (compile.py).
//
// The physics: hydrostatics, h = Δp / ρg (set/straw.js). The heights are computed; how fast the tall column climbs is an
// illustration (badged). The house, Torricelli's tube and the air arrows are ink illustrations.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { strobe } from "cinema/sci/strobe.js";
import { arrows } from "cinema/sci/arrows.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { createSitter } from "../set/chair.js";
import { inkSet } from "../set/ink.js";
import { createGlass, createStraw, createJar, createPump, createHouse, createBubbles, inkBarometer, createTable } from "../set/straw.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, pinSpine } from "../set/spine.js";
import { acesInv, unlit } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, GEO = FILM.geo, EC = FILM.endCard, DUR = FILM.dur;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 5, 6000);

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;

// the bench: the mannequin at a small table, a glass of water, a bendy straw to the mouth
const C = createSitter({ x: 0, z: 0, dumbbells: false });
const T = createTable({ ...GEO.table });
const G = createGlass({ ...GEO.glass });
const ST = GEO.straw, SA = createStraw({ a: ST.a, b: ST.k, r: ST.r }), SB = createStraw({ a: ST.k, b: ST.b, r: ST.r });
const elbow = new THREE.Mesh(new THREE.SphereGeometry(ST.r * 1.02, 16, 10), SA.tube.material); elbow.position.set(...ST.k);
scene.add(C.group, T.group, G.group, SA.group, SB.group, elbow);
C.reach(0, GEO.hands);

// the change: a bell jar over the glass, its hose to a hand pump on the floor
const J = createJar({ r: GEO.jar.r, h: GEO.jar.h }), PU = createPump({ ...GEO.pump });
scene.add(J.group, PU.group);
const jarAt = (k) => J.group.position.set(GEO.glass.x, GEO.table.h + GEO.jar.lift * (1 - k), GEO.glass.z);
const hose = PU.connect(PU.outlet(), [GEO.glass.x + J.portAt()[0], GEO.table.h + J.portAt()[1], GEO.glass.z], 26);
scene.add(hose);
const bub = createBubbles({ n: 10, seed: 6 }); scene.add(bub.group);           // air pushed out of the straw as the jar empties

// ink: Torricelli's tube beside the bench, the house front with the tall straw
const I = inkSet({ color: TK["ink-2"] || "#4B505B", accent: TK.pressure || "#0B6F86" });
const IB = inkSet({ color: TK["ink-2"] || "#4B505B" }), BARO = inkBarometer(IB, { ...GEO.baro }); scene.add(BARO.group);   // its own ink: it fades on and off
const HO = createHouse(I, { ...GEO.house }); scene.add(HO.group);
const PI = GEO.pipe;
const basin = createGlass({ r: PI.basin.r, h: PI.basin.h, x: PI.x, y: 0, z: PI.z, depth: PI.basin.depth, glass: { alpha: 0.08 } });
const TS = createStraw({ a: [PI.x, PI.y0, PI.z], b: [PI.x, PI.top, PI.z], r: PI.r, seg: 24, glass: { alpha: 0.12 } });
const topPump = createPump({ x: PI.x + 14, y: PI.top - 4, z: PI.z });
const cap = new THREE.Mesh(new THREE.CylinderGeometry(PI.r * 1.5, PI.r * 1.5, 5, 20), new THREE.MeshStandardMaterial({ color: 0x2f3238, roughness: 0.7 }));
cap.position.set(PI.x, PI.top + 2.5, PI.z);
const topHose = topPump.connect([PI.x + 14, PI.top + 20, PI.z + 3], [PI.x, PI.top + 5, PI.z], -6);
scene.add(basin.group, TS.group, topPump.group, cap, topHose);
const boil = createBubbles({ n: 16, seed: 1644 }); scene.add(boil.group);
const lungsMark = I.group(); lungsMark.add(I.bar(-7, 0, 7, 0, 1.1, I.accent)); lungsMark.position.set(PI.x, PI.surf + PI.lungs, PI.z + PI.r + 1); scene.add(lungsMark);

// the air's push: arrows onto the drink, and up the straw
const AR = arrows({ max: 8, shaft: 0.45, head: [2.6, 1.2], outline: 0.26, ink: acesInv(TK.ink || "#15171C"), park: [0, 60, 0] });
scene.add(AR.group);
const PRESS = acesInv(TK.pressure || "#0B6F86");
GEO.press.forEach((p, k) => AR.add(`press${k}`, { tail: () => [p[0], p[1] + 12, p[2]], vec: () => [0, -10, 0], color: PRESS, t0: CUE.press[0], t1: CUE.press[1], hold: [CUE.cuts.why, CUE.cuts.whoa] }));
AR.add("up", { tail: () => [ST.a[0] + 2.4, GEO.surfY - 2, ST.a[2]], vec: () => [0, 13, 0], color: PRESS, t0: CUE.up[0], t1: CUE.up[1], hold: [CUE.cuts.why, CUE.cuts.whoa] });

// the strobe motif: the tall column's meniscus every 1/5 s while it climbs (the record in the measure)
const S = strobe({ geometry: new THREE.CylinderGeometry(1, 1, 0.5, 20), radius: PI.r * 0.9, max: 40, pop: 0.12,
  material: new THREE.MeshLambertMaterial({ color: 0xffffff }), rim: { color: [0.045, 0.048, 0.055], width: 0.42, strength: 0.62 }, park: [PI.x, 60, PI.z] });
scene.add(S.group);
const climbY = (t) => {                                   // the tall column's top: the basin's surface → the stop (illustrated pace)
  const c = CUE.climb, u = Math.max(0, Math.min(1, (t - c.t0) / c.T));
  return PI.surf + (PI.stop - PI.surf) * (1 - Math.pow(1 - u, c.p));
};
const L = FILM.ladder;
S.ladder("climb", { at: (tau) => [PI.x, climbY(CUE.climb.t0 + tau), PI.z], tau0: L.tau0, dt: L.dt, n: L.n,
  when: (tau) => CUE.climb.t0 + tau, t0: L.t0, t1: L.t1, slot: 0, color: new THREE.Color().setRGB(0.30, 0.31, 0.34) });

// ── the levels ──
const surfY = GEO.surfY, mouthY = ST.b[1];
const benchLevel = (t) => keyed(FILM.level, t, "inout2");             // the bench straw's column top (world y)
const tallLevel = (t) => (t < CUE.cuts.normal || t >= CUE.loop ? PI.stop : t < CUE.climb.t0 ? PI.surf : climbY(t));

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
window.CINEMA_FOCUS = () => ({ point: [0, 90, 0], fstop: 0 });
const PROBE_PTS = [[-60, 90, 0], [60, 90, 0], [0, 90, 40], [PI.x, 300, PI.z], [PI.x, 900, PI.z], [0, 0, 0]].map((p) => new THREE.Vector3(...p));
const pv = new THREE.Vector3();

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an.point) return () => an.point;
  if (an.tall) return (t) => [PI.x + PI.r + 1, tallLevel(t), PI.z];
  if (an.bench) return (t) => SA.at(Math.max(0, Math.min(1, (benchLevel(t) - ST.a[1]) / (ST.k[1] - ST.a[1]))));
  if (an.ghost) return () => S.ghost("climb", an.ghost);
  return () => [0, 0, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.anchor), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: !!lb.fixed, v: lb.v });
const SPN = FILM.spine;
const spineAt = (t) => SPN.find((s) => t >= s.t0 && t < s.t1) || (t < SPN[0].t0 ? SPN[0] : SPN[SPN.length - 1]);
const spineVal = (t) => {
  const s = spineAt(t);
  if (s.kind === "const") return s.v;
  if (s.kind === "ramp") return keyed(s.keys, t, "inout2");
  if (s.kind === "column") return (tallLevel(t) - PI.surf) / 100;
  return 0;
};
const spineOpts = { value: spineVal, fmt: (v) => v.toFixed(0), unit: "hPa", label: SPN[0].label, t0: SPN[0].t0, t1: SPN[SPN.length - 1].t1, at: [0.26, 0.19], minCh: 4 }, counterEl = hud.counter("spine", spineOpts);
pinSpine(spineOpts, counterEl, hud, W, 0.19);
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const foot = document.createElement("div"); foot.className = "rf-foot"; foot.textContent = FILM.end.foot; endEl.appendChild(foot);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS
    + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });
const inkOn = (t, w) => (w ? Math.min(E.out2(seg(t, w[0], w[0] + 0.5)), 1 - E.in2(seg(t, w[1] - 0.4, w[1]))) : 0);

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  // the bench straw: its column top, both segments
  const lv = benchLevel(t);
  SA.fill(lv); SB.fill(lv);
  // the jar: down over the glass for the change, up and away for the why
  const jk = keyed(FILM.jar, t, "inout3");
  jarAt(jk); J.group.visible = jk > 0.001;
  hose.visible = PU.group.visible = keyed(FILM.pumpOn, t, "linear") > 0.5;
  PU.pumpAt(t >= CUE.pump[0] && t < CUE.pump[1] ? 0.5 - 0.5 * Math.cos(2 * Math.PI * (t - CUE.pump[0]) / CUE.stroke) : 0);
  const out = keyed(FILM.outBubbles, t, "linear");
  bub.group.visible = out > 0.01;
  if (out > 0.01) bub.update(t, [ST.a[0], surfY - 2, ST.a[2]], 2.2, out, 7);
  // ink: Torricelli's tube, the house's lungs mark
  const bk = inkOn(t, CUE.baro);
  BARO.group.visible = bk > 0.001; IB.opacity(bk); BARO.opacity(bk);
  lungsMark.visible = t >= CUE.lungs[0] && t < CUE.lungs[1];
  // the tall straw: the column, boiling at the top once it stops
  const ty = tallLevel(t);
  TS.fill(ty);
  const bk2 = keyed(FILM.boil, t, "linear"), bt = t >= CUE.loop ? t - DUR : t;      // the loop's last frame is frame 0's bubbles
  boil.group.visible = bk2 > 0.01;
  if (bk2 > 0.01) boil.update(bt, [PI.x, ty, PI.z], PI.r * 0.82, bk2, 9);
  S.update(t);
  AR.update(t);
  cyc.update({ grid: 1, casters: [[0, 48, 0, 26], [GEO.glass.x, GEO.table.h, GEO.glass.z, 10], [PI.x, 2, PI.z, 22], [GEO.pump.x, 2, GEO.pump.z, 9]] });
  if (window.CINEMA && window.CINEMA.mode === "probe") {
    PROBE_PTS.forEach((q, i) => {
      pv.copy(q).project(camera);
      if (Math.abs(pv.x) <= 1.15 && Math.abs(pv.y) <= 1.15 && pv.z < 1) window.CINEMA.probe.set("bench" + i, [(pv.x + 1) * 0.5 * W, (1 - pv.y) * 0.5 * H]);
    });
  }
  dropT(t); dropE(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp); }
  hud.update(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp);
    counterEl.classList.toggle("lit", !!(s.lit && t >= s.lit[0] && t < s.lit[1])); }
  renderer.render(scene, camera);
};
