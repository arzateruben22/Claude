import * as THREE from "three";
// Light Minute No. 002, "The nearest star" (films/channels/space/ep02). The picture as a pure function of t
// for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the scene clocks, the
// ladder, every object and the overlay from t alone, then makes exactly one renderer.render().
//
// The set is the channel's Orrery (../set: sky, orbit rings via front.js, rig, look, motif) plus two blocks
// new in this episode (../set/beacon.js: a constant-pixel light for stars and probes at any rung;
// ../set/comets.js: the Oort cloud as a shell of points) and the shared kit blocks (kits/cinema/sci: hud.js,
// clock.js, front.js, ladder.js). Everything timed comes from film.json, which compile.py hangs on the voice.
//
// Shots: hook (the payoff: the local view, the speck and Proxima) · space (one continuous shot: Voyager's
// flight under a speed note while the camera pulls back with it; the signal out and the answer back; the
// heliopause; a ×12 pull-back to the comet cloud; the one scale jump to Proxima; the readout) · end.
// Three ladder rungs, all centred on the Sun: solar (1 unit = 1 AU), oort (1 AU) and local (0.01 ly).
// Honesty (film.json "badges"): "not to scale" throughout (the Sun's and Voyager's glows are sizes in
// pixels), "path simplified" (the 1979–80 flybys drawn as one smooth curve), the clocks' speed notes,
// "comet cloud: theory", "Voyager isn't headed there", "at today's distance".
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { ring, segment, shell, probes } from "cinema/sci/front.js";
import { createLadder, logDolly } from "cinema/sci/ladder.js";
import { createSky } from "../set/sky.js";
import { createRig } from "../set/rig.js";
import { hdr, line } from "../set/look.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";
import { createBeacon } from "../set/beacon.js";
import { createComets } from "../set/comets.js";

const FILM = window.FILM, W = window.W, H = window.H, PH = FILM.phys, CUE = FILM.cue, FPS = FILM.fps || 30;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.5, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });   // no depth of field: nothing comes near the lens
injectCss();

// ── scene clocks ─────────────────────────────────────────────────────────────
const WORDS = { fast: "{n}× faster", slow: "{n}× slower", freeze: null };
const pinned = (c) => { const c0 = clock(c.keys, { words: WORDS }); return clock(c.keys, { words: WORDS, tau0: c.anchor[1] - c0.tau(c.anchor[0]) }); };
const CLK = Object.fromEntries(Object.entries(FILM.clk).map(([k, c]) => [k, pinned(c)]));
const yearAt = (t) => Math.min(PH.y_now, PH.y0 + Math.max(0, CLK.flight.tau(t)) / PH.year);

// ── Voyager's drawn path (simplified: a smooth curve out to Saturn's distance, then a straight line) ──
const D2R = Math.PI / 180;
const VDIR = [-Math.cos(PH.voy_dir * D2R) * Math.sin(PH.voy_az * D2R), Math.sin(PH.voy_dir * D2R), -Math.cos(PH.voy_dir * D2R) * Math.cos(PH.voy_az * D2R)];   // 35° above the ecliptic, heading away from the camera
const E0 = [-0.2, 0, -0.98];                                                  // Earth's direction at launch (in the ecliptic)
const smooth = (x) => x * x * (3 - 2 * x);
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const voyAt = (y) => {
  if (y >= PH.y_sat) { const r = PH.r_sat + PH.slope * (y - PH.y_sat); return VDIR.map((v) => v * r); }
  const u = clamp01((y - PH.y0) / (PH.y_sat - PH.y0)), w = smooth(u);
  const r = 1 + (PH.r_sat - 1) * (0.35 * u + 0.65 * w);
  const d = norm(E0.map((e, i) => e * (1 - w) + VDIR[i] * w));
  return d.map((v) => v * r);
};

// line colours (look.js: the light each line adds so the finish shows the token at that strength)
const C = { orbit: line("lilac", 0.42), trail: line("ice", 0.8), ghost: line("ice", 0.55), teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3),
  dim: line("text-2", 0.8), hp: line("text-2", 0.55) };

// ── the set ─────────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 23 });
scene.add(sky.group);
const G = { solar: new THREE.Group(), oort: new THREE.Group(), local: new THREE.Group() };
Object.values(G).forEach((g) => scene.add(g));
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };

// the Sun: one beacon at the scene origin (every rung is centred on it), white, bloomed
const sun = createBeacon({ color: hdr("text", 2.2), px: 30, core: 0.22 });
scene.add(sun.mesh);

// solar rung (1 unit = 1 AU): the planets' orbits, Voyager, its trail, the heliopause, the signal
const orbits = PH.planets.map(([, r]) => ring({ color: C.orbit, width: 1.8, opacity: 1 }).arc({ r, ...XZ }));
const NTRAIL = PH.ys.length - 1;
const trail = Array.from({ length: NTRAIL }, (_, i) => segment({ color: C.trail, width: 3, opacity: 0, fade: [0.55 + 0.45 * i / NTRAIL, 0.55 + 0.45 * (i + 1) / NTRAIL] }));
const voy = createBeacon({ color: hdr("ice", 1.25), px: 16, core: 0.3 });
const hpShell = shell({ color: C.hp, opacity: 0, power: 3.2 });
const hpTick = segment({ color: C.teal, width: 3.2, opacity: 0 });
const front1 = ring({ color: C.tealHi, width: 4, opacity: 0 }), front2 = ring({ color: C.tealHi, width: 4, opacity: 0 });
const ldRing = ring({ color: C.teal, width: 2.6, opacity: 0 });
G.solar.add(...orbits.map((o) => o.mesh), ...trail.map((s) => s.mesh), voy.mesh, hpShell.mesh, hpTick.mesh, front1.mesh, front2.mesh, ldRing.mesh);
const solarProbe = probes(G.solar, 2);

// oort rung (1 unit = 1 AU): the comet cloud (a theory, badged) and the dashed road to it
const oort = createComets({ n: 9000, r0: PH.r_oort0, r1: PH.r_oort1, seed: 7, color: [0.75, 0.85, 1.1] });
const ghost = segment({ color: C.ghost, width: 2.6, opacity: 0, dash: 0.03, duty: 0.5 });
const oortRim = shell({ color: line("ice", 0.5), opacity: 0, power: 2.6 });
G.oort.add(oort.group, ghost.mesh, oortRim.mesh);

// local rung (1 unit = 0.01 light-year): the speck (one light-day), Proxima, the lane, the readout ring
const LU = FILM.ladder.units.local, AU = PH.au;
const speck = ring({ color: C.teal, width: 2.6, opacity: 1 });
const speckDot = createBeacon({ color: hdr("teal", 1.1), px: 9, core: 0.45 });
const prox = createBeacon({ color: hdr("lemon", 1.6), px: 22, core: 0.24 });
const lane = segment({ color: C.dim, width: 2, opacity: 0 });
const pxRing = ring({ color: C.teal, width: 2.8, opacity: 0 });
G.local.add(speck.mesh, speckDot.mesh, prox.mesh, lane.mesh, pxRing.mesh);

const ladder = createLadder({
  rungs: ["solar", "oort", "local"].map((id) => ({ id, group: G[id], unit: FILM.ladder.units[id], origin: [0, 0, 0], show: FILM.ladder.show[id], fade: FILM.ladder.fade[id] })),
});
const dolly = logDolly(FILM.ladder.keys.map((k) => ({ ...k, focus: [0, 0, 0] })));
const VIEW_END = { scale: FILM.ladder.end, focus: [0, 0, 0] };

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);
// Proxima's direction: up and a little right of the Sun in the final frame (not Voyager's heading: badged)
const tmpCam = new THREE.PerspectiveCamera(24, W / H, 0.5, 4000);
rig.place(tmpCam, "space", CUE.jump[1]);
const camR = new THREE.Vector3().setFromMatrixColumn(tmpCam.matrixWorld, 0), camU = new THREE.Vector3().setFromMatrixColumn(tmpCam.matrixWorld, 1);
const PDIR = camR.clone().multiplyScalar(Math.cos(76 * D2R)).add(camU.clone().multiplyScalar(Math.sin(76 * D2R))).normalize().toArray();
const PROX_L = PDIR.map((v) => v * PH.prox_au * AU / LU);                   // Proxima in local units (424 = 4.24 ly)
const LD_L = PH.ld_au * AU / LU;                                              // one light-day in local units (0.27)
// a great circle through point p (from the Sun) in the plane nearest the screen: the sphere of radius |p|, seen
const faceOn = (p) => {
  const d = norm(p), f = new THREE.Vector3(); camera.getWorldDirection(f);
  const e2 = norm([d[1] * f.z - d[2] * f.y, d[2] * f.x - d[0] * f.z, d[0] * f.y - d[1] * f.x]);
  return { e1: d, e2 };
};
const screenBasis = () => ({ e1: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).toArray(), e2: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).toArray() });

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = {};
const KIND = { body: { color: "ice", glyph: "●", mark: "none" }, star: { color: "lemon", glyph: "✦", mark: "none" },
  light: { color: "teal", glyph: "◯", mark: "none" }, gravity: { color: "lilac", mark: "dashed" } };
const at = (k) => () => S[k] || [0, 0, 0];
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, b.clock ? { from: CLK[b.clock], t0: b.t0, t1: b.t1, slot: b.slot } : { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const FMT = {
  year: { value: (t) => yearAt(t), fmt: (v) => String(Math.floor(v + 1e-6)), lit: (v) => v >= PH.y_now - 1e-6, minCh: 4 },
  hours: (c) => ({ value: (t) => CLK.signal.tau(t) / 3600, fmt: (v) => `${Math.floor(v + 1e-6)} h`, lit: (v) => v >= c.lit - 1e-6, minCh: 4 }),
};
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at };
  if (c.fmt === "year") Object.assign(o, FMT.year);
  else if (c.fmt === "hours") Object.assign(o, FMT.hours(c));
  else Object.assign(o, { value: () => 0, fmt: () => c.text, lit: () => true });
  const el = hud.counter(c.id, o);
  el.classList.add(c.fmt === "text" ? "lm-read" : "lm-clock");
}
for (const p of FILM.pills) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: at(L.anchor), t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d * 0.8)));
const LBL = Object.fromEntries(FILM.labels.map((l) => [l.id, l]));
const cAU = PH.c_km / AU;                                                    // light, AU per scene second

window.seek = function (t) {
  const st = stage(t), shot = st.name;
  const tr = Math.round(t * FPS) / FPS;
  rig.place(camera, shot, t);
  const view = ladder.apply(shot === "hook" ? VIEW_END : dolly(t));
  const aS = view.alpha.solar, aO = view.alpha.oort, aL = view.alpha.local;
  const toS = (id, p) => ladder.toScene(id, p, view);

  // the Sun
  sun.set({ center: [0, 0, 0], camera });
  S.sun = [0, 0, 0];

  // ── solar rung ──
  const y = shot === "hook" ? PH.y_now : yearAt(t), pv = voyAt(y);
  orbits.forEach((o) => o.set({ opacity: aS }));
  for (let i = 0; i < NTRAIL; i++) {
    const ya = PH.ys[i], yb = Math.min(PH.ys[i + 1], y);
    if (ya >= y || aS <= 1e-4) { trail[i].set({ opacity: 0 }); continue; }
    trail[i].seg(voyAt(ya), voyAt(yb)).set({ opacity: aS });
  }
  voy.set({ center: pv, camera, opacity: aS * (y > PH.y0 + 0.01 || t >= CUE.launch ? 1 : 0) });
  S.voy = toS("solar", pv);
  S.voyV = toS("solar", pv.map((v, i) => v + VDIR[i] * 10));
  S["voy-v"] = S.voyV;
  const nep = PH.planets[4][1], an = 2.4;
  S.neptune = toS("solar", [nep * Math.cos(an), 0, -nep * Math.sin(an)]);
  // the heliopause: a faint shell, and a tick across the path where Voyager crossed it (2012)
  const hpOp = aS * fadeIn(t, CUE.hp, 0.8);
  hpShell.set({ center: [0, 0, 0], r: PH.r_hp, opacity: 0.55 * hpOp });
  const php = voyAt(PH.y_hp), nrm = norm([-VDIR[1], VDIR[0], 0]);
  hpTick.seg(php.map((v, i) => v - nrm[i] * 5), php.map((v, i) => v + nrm[i] * 5)).set({ opacity: hpOp });
  S.hp = toS("solar", php);
  // the signal: out from Earth (at this scale, at the Sun) to Voyager, then the answer back
  const ts = CLK.signal.tau(t), rv = Math.hypot(pv[0], pv[1], pv[2]);
  const r1 = Math.min(rv, cAU * ts), on1 = t >= CUE.sig && t < CUE.ans + 0.4;
  const b1 = faceOn(pv);
  front1.arc({ center: [0, 0, 0], r: Math.max(r1, 0.01), a0: -0.9, a1: 0.9, ...b1 }).set({ opacity: on1 && r1 > 0.5 && r1 < rv - 1e-6 ? aS : 0 });
  S.front1 = toS("solar", pv.map((v) => (v * r1) / rv));
  const arrived = t >= CUE.arr1;
  ldRing.arc({ center: [0, 0, 0], r: PH.ld_au, ...b1 }).set({ opacity: arrived ? aS * (0.85 * fadeIn(t, CUE.arr1, 0.5)) : 0 });
  S.ldring = toS("solar", [0, 1, 2].map((j) => PH.ld_au * (b1.e1[j] * Math.cos(-0.55) + b1.e2[j] * Math.sin(-0.55))));
  const r2 = cAU * Math.max(0, ts - 86400), on2 = t >= CUE.ans && t < CUE.arr2 + 0.2;
  const toSun = pv.map((v) => -v / rv), b2 = { e1: toSun, e2: b1.e2 };
  front2.arc({ center: pv, r: Math.max(Math.min(r2, rv), 0.01), a0: -0.9, a1: 0.9, ...b2 }).set({ opacity: on2 && r2 > 0.5 && r2 < rv - 1e-6 ? aS : 0 });
  S.front2 = toS("solar", pv.map((v, i) => v + toSun[i] * Math.min(r2, rv)));
  solarProbe(on1 && r1 > 0.5 && r1 < rv ? [pv.map((v) => (v * r1) / rv), null] : on2 && r2 > 0.5 && r2 < rv ? [pv.map((v, i) => v + toSun[i] * r2), null] : [null, null]);

  // ── oort rung ──
  oort.set({ gain: shot === "hook" || t >= CUE.jump[1] ? 0.55 : 1 });
  const g0 = voyAt(PH.y_now), g1 = VDIR.map((v) => v * PH.r_oort0);
  ghost.seg(g0, g1).set({ opacity: aO * fadeIn(t, CUE.ghost, 0.6) });
  oortRim.set({ center: [0, 0, 0], r: PH.r_oort0, opacity: aO * (shot === "hook" || t >= CUE.jump[1] ? 0.25 : 0.6) });
  S.ghost = toS("oort", g0.map((v, i) => (v + g1[i]) / 2));
  const ao = 0.35;
  S.oort = toS("oort", [PH.r_oort0 * 1.05 * Math.cos(ao), PH.r_oort0 * 1.05 * Math.sin(ao), 0]);
  S["oort-deep"] = toS("oort", VDIR.map((v) => v * PH.r_oort0 * 1.4));

  // ── local rung ──
  const bS = screenBasis();
  speck.arc({ center: [0, 0, 0], r: LD_L, ...bS }).set({ opacity: aL });
  speckDot.set({ center: [0, 0, 0], camera, opacity: aL * (shot === "hook" || t >= CUE.speck ? 1 : 0.6) });
  S.speck = toS("local", [0, 0, 0]);
  prox.set({ center: PROX_L, camera, opacity: aL });
  S.prox = toS("local", PROX_L);
  const laneOp = (shot === "hook" ? 1 : fadeIn(t, CUE.lane, 0.6)) * (1 - 0.7 * fadeIn(t, CUE.pxring, 0.8)) * 0.6;
  lane.seg(PROX_L.map((v) => v * 0.02), PROX_L.map((v) => v * 0.96)).set({ opacity: aL * laneOp });
  S.lane = toS("local", PROX_L.map((v) => v * 0.5));
  const bp = faceOn(PROX_L), rp = Math.hypot(...PROX_L);
  pxRing.arc({ center: [0, 0, 0], r: rp, ...bp }).set({ opacity: aL * fadeIn(t, CUE.pxring, 0.8) });
  S.pxring = toS("local", [0, 1, 2].map((j) => rp * (bp.e1[j] * Math.cos(1.25) + bp.e2[j] * Math.sin(1.25))));

  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1, bandGain: 1 });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
