// Rest Frame No. 006, "The ten-meter straw" (films/channels/physics/ep06): the picture, a pure function of t.
// The channel's Bench (../set: the cyc, the mannequin, ink drawings, the title drop) plus the straw block (../set/straw.js:
// glass without transmission, liquid columns, a lid, the pump, the ink house, boiling) and the kit's blocks (hud,
// strobe, arrows). Everything timed comes from film.json (compile.py).
//
// The physics: hydrostatics, h = Δp / ρg (set/straw.js, compile.py). The heights are computed; how fast the tall column
// climbs is an illustration (badged). The house, Torricelli's tube and the air arrows are ink illustrations.
// Rule 8 (WRITING.md): what the caption names is the brightest thing; the previous beat's deliverer drops to a third
// (FILM.dim, keyed on words).
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { strobe } from "cinema/sci/strobe.js";
import { arrows } from "cinema/sci/arrows.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { createSitter } from "../set/chair.js";
import { inkSet } from "../set/ink.js";
import { createGlass, createStraw, createLid, createPump, createHouse, createBubbles, inkBarometer, inkDash, createTable } from "../set/straw.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv, screenAlpha } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, GEO = FILM.geo, EC = FILM.endCard, DUR = FILM.dur, DIM = FILM.dim;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 5, 8000);
const dimAt = (name, t) => keyed(DIM[name], t, "linear");
// a mark at strength k (1 as built, 1/3 stepped back) keeps k of its contrast against the paper on screen (set/aces.js)
const PAPER_HEX = TK.cyc || "#E6E2D8", onScreen = (k, hex) => screenAlpha(k, hex, PAPER_HEX);
const HEX = { ink2: TK["ink-2"] || "#4B505B", hg: "#2E3139", energy: TK.energy || "#B8321A", pressure: TK.pressure || "#0B6F86", motion: TK.motion || "#08805A", ghost: "#55585F" };

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
cyc.wall.visible = false; cyc.floor.scale.set(4, 1, 4);                              // an open paper floor: the house is the backdrop, 11 m tall
cyc.uniforms.uCyl.value.set(40, 200, 1e6);                                            // no cove shading on the open floor (its wall is hidden)
window.SCENE_READY = P.ready;

// the bench: the mannequin at a small table, a glass of water, a bendy straw to the mouth, a lid for the change
const C = createSitter({ x: 0, z: 0, dumbbells: false });
const T = createTable({ ...GEO.table });
const G = createGlass({ ...GEO.glass });
const ST = GEO.straw, SA = createStraw({ a: ST.a, b: ST.k, r: ST.r }), SB = createStraw({ a: ST.k, b: ST.b, r: ST.r });
const elbow = new THREE.Mesh(new THREE.SphereGeometry(ST.r * 1.02, 16, 10), SA.tube.material); elbow.position.set(...ST.k);
const LD = createLid({ r: GEO.lid.r, hole: ST.r + 0.05 });
LD.group.traverse((m) => { if (m.material) { m.material.transparent = true; m.material.depthWrite = true; } });
scene.add(C.group, T.group, G.group, SA.group, SB.group, elbow, LD.group);
C.reach(0, GEO.hands);
const lidAt = (k) => {
  LD.group.position.set(GEO.glass.x, GEO.lid.y + GEO.lid.lift * (1 - E.out3(k)), GEO.glass.z);
  LD.group.visible = k > 0.002;
  LD.group.traverse((m) => { if (m.material) m.material.opacity = Math.min(1, k * 3); });
};

// ink: Torricelli's tube beside the table (its own ink, so it can fade), the house front with the tall straw
const IB = inkSet({ color: TK["ink-2"] || "#4B505B" }), BARO = inkBarometer(IB, { ...GEO.baro }); scene.add(BARO.group);
const I = inkSet({ color: TK["ink-2"] || "#4B505B", accent: TK.pressure || "#0B6F86" });
const HO = createHouse(I, { ...GEO.house }); scene.add(HO.group);
const PI = GEO.pipe;
const basin = createGlass({ r: PI.basin.r, h: PI.basin.h, x: PI.x, y: 0, z: PI.z, depth: PI.basin.depth, glass: { alpha: 0.08 } });
const TS = createStraw({ a: [PI.x, PI.y0, PI.z], b: [PI.x, PI.top, PI.z], r: PI.r, seg: 24, glass: { alpha: 0.12 } });
const topPump = createPump({ x: PI.x + 18, y: GEO.house.storeys * GEO.house.storey + 28, z: PI.z });   // standing on the flat roof
const cap = new THREE.Mesh(new THREE.CylinderGeometry(PI.r * 1.5, PI.r * 1.5, 5, 20), new THREE.MeshStandardMaterial({ color: 0x2f3238, roughness: 0.7 }));
cap.position.set(PI.x, PI.top + 2.5, PI.z);
const topHose = topPump.connect(topPump.outlet(), [PI.x, PI.top + 5, PI.z], -4);
scene.add(basin.group, TS.group, topPump.group, cap, topHose);
const boil = createBubbles({ n: 16, seed: 1644, spread: 1.4 }); scene.add(boil.group);   // inside the column (inner radius 2.6)
// the lungs' meter and the stunt's seven (accent ticks on the straw), and the measure's two marks: the air above 1 cm², the 10.3 m line
const IL = inkSet({ color: HEX.energy }), lungsMark = IL.group();
lungsMark.add(IL.bar(-9, 0, 9, 0, 1.6)); lungsMark.position.set(PI.x, PI.surf + PI.lungs, PI.z + PI.r + 1); scene.add(lungsMark);
const IS = inkSet({ color: HEX.energy }), stuntMark = IS.group();
stuntMark.add(IS.bar(-9, 0, 9, 0, 1.6)); stuntMark.position.set(PI.x, PI.surf + PI.stunt, PI.z + PI.r + 1); scene.add(stuntMark);
const IA = inkSet({ color: TK.pressure || "#0B6F86" }), airCol = IA.group();
airCol.add(inkDash(IA, 0, PI.surf, 0, 2600, { dash: 14, gap: 10, w: 2.2 })); airCol.add(IA.bar(-3, PI.surf, 3, PI.surf, 1.6));
airCol.position.set(PI.x - PI.r - 9, 0, PI.z); scene.add(airCol);
const IW = inkSet({ color: TK.motion || "#08805A" }), line103 = IW.group();
line103.add(IW.bar(-26, 0, 30, 0, 1.6)); line103.position.set(PI.x, PI.line103, PI.z + PI.r + 1); scene.add(line103);

// the air's push: arrows onto the drink, and up the straw
const AR = arrows({ max: 8, shaft: 0.45, head: [2.6, 1.2], outline: 0.26, ink: acesInv(TK.ink || "#15171C"), park: [0, 60, 0] });
scene.add(AR.group);
const PRESS = acesInv(TK.pressure || "#0B6F86"), PRESS3 = acesInv("#ADC9CF");                     // full, and a third (two-thirds toward the paper)
const pressC = new THREE.Color().setRGB(...PRESS);                                                     // arrows.js keeps this Color by reference
GEO.press.forEach((p, k) => AR.add(`press${k}`, { tail: () => [p[0], GEO.surfB + 12, p[2]], vec: () => [0, -10, 0], color: pressC, t0: CUE.press[0], t1: CUE.press[1], hold: [CUE.cuts.why, CUE.cuts.whoa] }));
AR.add("up", { tail: () => [ST.a[0] + 2.4, GEO.surfB - 2, ST.a[2]], vec: () => [0, 13, 0], color: PRESS, t0: CUE.up[0], t1: CUE.up[1], hold: [CUE.cuts.why, CUE.cuts.whoa] });

// the strobe motif: the tall column's meniscus every 1/5 s while the pump lifts it (the record, in the measure)
const S = strobe({ geometry: new THREE.CylinderGeometry(1, 1, 0.6, 20), radius: PI.r * 1.25, max: 40, pop: 0.12,
  material: new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true }), rim: { color: [0.045, 0.048, 0.055], width: 0.42, strength: 0.62 }, park: [PI.x, 60, PI.z] });
scene.add(S.group);
const climbY = (t) => {                                   // the stunt's seven → the stop (an ease-out: the illustrated pace)
  const c = CUE.climb, u = Math.max(0, Math.min(1, (t - c.t0) / c.T)), y0 = PI.surf + PI.stunt;
  return y0 + (PI.stop - y0) * (1 - Math.pow(1 - u, c.p));
};
const L = FILM.ladder;
S.ladder("climb", { at: (tau) => [PI.x, climbY(CUE.climb.t0 + tau), PI.z], tau0: L.tau0, dt: L.dt, n: L.n,
  when: (tau) => CUE.climb.t0 + tau, t0: L.t0, t1: L.t1, slot: 0, color: new THREE.Color().setRGB(0.30, 0.31, 0.34) });

// ── the levels ──
const benchLevel = (t) => keyed(FILM.level, t, "inout2");             // the bench straw's column top (world y)
const tallLevel = (t) => (t >= CUE.climb.t0 && t < CUE.loop ? climbY(t) : keyed(FILM.tall, t, "inout2"));

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
const spineOpts = { value: spineVal, fmt: (v) => v.toFixed(0), unit: "hPa", label: SPN[0].label, t0: SPN[0].t0, t1: SPN[SPN.length - 1].t1, minCh: 4 }, counterEl = hud.counter("spine", spineOpts);
placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const foot = document.createElement("div"); foot.className = "rf-foot"; foot.textContent = FILM.end.foot; endEl.appendChild(foot);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS
    + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });
const win = (t, w, fin = 0.5, fout = 0.4) => (w ? Math.min(E.out2(seg(t, w[0], w[0] + fin)), 1 - E.in2(seg(t, w[1] - fout, w[1]))) : 0);

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  // the bench: the drink's depth (filled to the brim in the change), the straw's column, the lid
  G.setWater(keyed(FILM.depth, t, "inout2"));
  const lv = benchLevel(t);
  SA.fill(lv); SB.fill(lv);
  lidAt(keyed(FILM.lid, t, "inout3"));
  I.opacity(onScreen(dimAt("house", t), HEX.ink2));                  // the house: a backdrop at the bench, the subject in the whoa and the measure
  // ink: Torricelli's tube (a third once the air takes over), the lungs' meter, the stunt's seven, the measure's marks
  const bk = win(t, CUE.baro) * dimAt("baro", t);
  BARO.group.visible = bk > 0.001; IB.opacity(onScreen(bk, HEX.ink2)); BARO.opacity(onScreen(bk, HEX.hg));
  const lk = win(t, CUE.lungs) * dimAt("lungs", t);
  lungsMark.visible = lk > 0.001; IL.opacity(onScreen(lk, HEX.energy));
  const sk = win(t, CUE.stunt) * dimAt("stunt", t);
  stuntMark.visible = sk > 0.001; IS.opacity(onScreen(sk, HEX.energy));
  const ak = win(t, CUE.air) * dimAt("air", t);
  airCol.visible = ak > 0.001; IA.opacity(onScreen(ak, HEX.pressure));
  const wk = win(t, CUE.line);
  line103.visible = wk > 0.001; IW.opacity(onScreen(wk, HEX.motion));
  // the tall straw: the column, boiling at the top once it stops (the loop's last frame is frame 0's bubbles)
  const ty = tallLevel(t);
  TS.fill(ty);
  const bk2 = keyed(FILM.boil, t, "linear"), bt = t >= CUE.loop ? t - DUR : t;
  boil.group.visible = bk2 > 0.01;
  if (bk2 > 0.01) boil.update(bt, [PI.x, ty, PI.z], PI.r * 1.5, Math.min(1, bk2 * 3), 1.4);   // larger bubbles so they read; still only in the top 1.4 cm (c7)
  boil.group.children.forEach((m) => { m.material.opacity = 0.85 * Math.min(1, bk2); });
  S.group.children.forEach((m) => { if (m.material && "opacity" in m.material && m.material.transparent) m.material.opacity = onScreen(dimAt("ghosts", t), HEX.ghost); });
  S.update(t);
  { const u = (dimAt("press", t) - 0.33) / 0.67; pressC.setRGB(...[0, 1, 2].map((j) => PRESS3[j] + (PRESS[j] - PRESS3[j]) * u)); }
  AR.update(t);
  cyc.update({ grid: 1, casters: [[0, 48, 0, 26], [GEO.glass.x, GEO.table.h, GEO.glass.z, 10], [PI.x, 2, PI.z, 22], [-20, 2, 30, 30]] });
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
