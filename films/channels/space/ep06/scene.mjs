import * as THREE from "three";
// Light Minute No. 006, "Your speed" (films/channels/space/ep06). The picture as a pure function of t.
//
// One world on three rungs of the scale ladder, one camera pose: Earth at true size with a pin on the equator
// ("you") turning under a speed note; a pull-back to Earth's orbit, Earth moving under a second speed note, the
// spine counting the real km it has carried you since the film began; Ptolemy's objection and Galileo's answer
// labelled on Earth; then the one scale jump ("Zoom out") to the galaxy, the Sun on its lap under a third speed note.
// Set: ../set (sky, star, planet with earthSurface, galaxy, beacon, rig, look, motif). Kit: hud, clock, front, ladder.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { ring, segment } from "cinema/sci/front.js";
import { createLadder, logDolly } from "cinema/sci/ladder.js";
import { createSky } from "../set/sky.js";
import { createStar } from "../set/star.js";
import { createPlanet, earthSurface } from "../set/planet.js";
import { createGalaxy, SUN_LY } from "../set/galaxy.js";
import { createBeacon } from "../set/beacon.js";
import { createRig } from "../set/rig.js";
import { hdr, line } from "../set/look.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, PH = FILM.phys, CUE = FILM.cue, FPS = FILM.fps || 30;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.5, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const B = Object.fromEntries(FILM.beats.map((b) => [b.id, b]));

const WORDS = { fast: "{n}× faster", slow: "{n}× slower", freeze: null };
const CLK = Object.fromEntries(Object.entries(FILM.clk).map(([k, keys]) => [k, clock(keys, { words: WORDS })]));
const AU = 1.496e8, LY = PH.ly, XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };
const thE = (t) => -0.6 + (2 * Math.PI * CLK.orbit.tau(t)) / PH.year;                 // Earth's angle on its orbit
const earthAbs = (t) => [AU * Math.cos(thE(t)), 0, -AU * Math.sin(thE(t))];            // km from the Sun

// ── the set ─────────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 61 });
scene.add(sky.group);
const G = { earth: new THREE.Group(), solar: new THREE.Group(), galaxy: new THREE.Group() };
Object.values(G).forEach((g) => scene.add(g));
// earth rung (1 unit = 1,000 km): Earth at true size, a meridian pin, "you" on the equator
const earth = createPlanet({ radius: 6.371, surface: earthSurface({ width: W >= 1000 ? 2048 : 1024 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.5, segments: 128 });
const you = createBeacon({ color: hdr("teal", 1.2), px: 12, core: 0.5 });
G.earth.add(earth.group, you.mesh);
// solar rung (1 unit = 1 million km): the Sun (not to scale), Earth's orbit, Earth's marker, the arc it has run
const sun = createStar({ radius: 8, intensity: 1.4, corona: 2.4, limb: 0.6, granulation: 0.2 });   // not to scale (badged): a face, not a dot
const orbitR = ring({ color: line("lilac", 0.7), width: 2, opacity: 1 }).arc({ r: AU / 1e6, ...XZ });
const trail = ring({ color: line("teal", 1, 1.2), width: 4, opacity: 0 });
const earthDot = createBeacon({ color: hdr("ice", 1.1), px: 14, core: 0.5 });
G.solar.add(sun.group, orbitR.mesh, trail.mesh, earthDot.mesh);
// galaxy rung (1 unit = 1,000 light-years): the Milky Way (illustration), the Sun's lap, the Sun
const galaxy = createGalaxy({ n: 40000, radius: 50, seed: 27, sunAngle: Math.PI * 0.75 });
const lap = ring({ color: line("lilac", 0.8), width: 2.4, opacity: 0, dash: 90, duty: 0.55 }).arc({ r: SUN_LY / 1000, ...XZ });
const gcRing = ring({ color: line("teal", 0.9), width: 2.8, opacity: 0 }).arc({ r: SUN_LY / 1000 + 0.4, ...XZ });
const gcPath = segment({ color: line("teal", 1, 1.2), width: 3.2, opacity: 0 });
const sunG = createBeacon({ color: hdr("text", 1.6), px: 12, core: 0.4 });
const sunJ = createBeacon({ color: hdr("text", 1.6), px: 12, core: 0.4 });   // the Sun through the jump (between the rungs)
scene.add(sunJ.mesh);
G.galaxy.add(galaxy.group, lap.mesh, gcRing.mesh, gcPath.mesh, sunG.mesh);
galaxy.set({ angle: 0 });
const SUN0 = galaxy.sunAt();
const GC_ABS = SUN0.map((v) => -v * 1000 * LY);                                    // the galactic centre, km from the Sun at t = 0

const E0 = earthAbs(0);
const ORIGIN = { earth: [...E0] };                                                 // the earth rung follows Earth (mutated each seek)
const ladder = createLadder({
  rungs: [
    { id: "earth", group: G.earth, unit: FILM.ladder.units.earth, origin: ORIGIN.earth, show: FILM.ladder.show.earth, fade: FILM.ladder.fade.earth },
    { id: "solar", group: G.solar, unit: FILM.ladder.units.solar, origin: [0, 0, 0], show: FILM.ladder.show.solar, fade: FILM.ladder.fade.solar },
    { id: "galaxy", group: G.galaxy, unit: FILM.ladder.units.galaxy, origin: GC_ABS, show: FILM.ladder.show.galaxy, fade: FILM.ladder.fade.galaxy },
  ],
});
const FOCUS = { earth: E0, sun: [0, 0, 0], gc: GC_ABS, earthW: earthAbs(CUE.e0) };   // earthW: where Earth waits through the argument (its clock stops)
const dolly = logDolly(FILM.ladder.keys.map((k) => ({ ...k, focus: FOCUS[k.focus] })));
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = {};
const KIND = { body: { color: "ice", glyph: "●", mark: "none" }, star: { color: "lemon", glyph: "✦", mark: "none" },
  light: { color: "teal", glyph: "◯", mark: "none" }, gravity: { color: "lilac", mark: "dashed" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, b.clock ? { from: CLK[b.clock], t0: b.t0, t1: b.t1, slot: b.slot } : { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true };
  if (c.fmt === "since") Object.assign(o, { value: (t) => PH.v_orb * t, fmt: (v) => commas(Math.floor(v)), minCh: 5 });   // real km, real time
  else Object.assign(o, { value: () => 0, fmt: () => c.text });
  const el = hud.counter(c.id, o);
  el.classList.add(c.read ? "lm-read" : "lm-clock");
  if (c.text && c.text.length > 12) { const v = el.querySelector(".v"); if (v) v.style.fontSize = "5.5vmin"; }
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed });
}
for (const p of FILM.pills || []) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";                                   // the title stays inside the end ring
const fo = endEl.querySelector(".fo");
if (fo) fo.style.marginTop = "1.8vmin";                                      // the pill sits inside the ring
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });

window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  rig.place(camera, shot, t);
  const ea = earthAbs(t);
  ORIGIN.earth[0] = ea[0]; ORIGIN.earth[1] = ea[1]; ORIGIN.earth[2] = ea[2];
  const view = ladder.apply(dolly(t));
  const toS = (id, p) => ladder.toScene(id, p, view);
  const sunDirE = (() => { const l = Math.hypot(...ea); return ea.map((v) => -v / l); })();

  // Earth: spinning at the clock's rate (counterclockwise seen from the north); "you" stand on the equator in Ecuador
  // (longitude 78.5° W), which crosses the side facing the camera from left to right while the spin plays
  const psi = 3.78 + (2 * Math.PI * CLK.spin.tau(t)) / PH.sidereal;
  earth.set({ center: [0, 0, 0], sunDir: norm([sunDirE[0] + 0.35, 0.25, sunDirE[2] + 0.6]), sun: 1, spin: psi + (78.5 * Math.PI) / 180 });
  const pinL = [6.371 * 1.01 * Math.cos(psi), 0, -6.371 * 1.01 * Math.sin(psi)];
  you.set({ center: pinL, camera, opacity: view.alpha.earth });
  S.pin = toS("earth", pinL.map((v) => v * 1.06));

  // the orbit: the Sun, Earth's marker, the arc it has run since the orbit clock started
  sun.set({ tau: t * 300, on: view.alpha.solar > 0.001, camera, center: [0, 0, 0] });
  const eS = ea.map((v) => v / 1e6);
  earthDot.set({ center: eS, camera, opacity: view.alpha.solar });
  trail.arc({ r: AU / 1e6, a0: -0.6, a1: Math.max(-0.6 + 1e-4, thE(t)), ...XZ }).set({ opacity: thE(t) > -0.6 + 1e-3 ? view.alpha.solar : 0 });
  S.earthS = toS("solar", eS.map((v, i) => v + (i === 1 ? 3 : 0)));
  S.sun = toS("solar", [0, 5, 0]);

  // the galaxy: the Sun on its lap
  const ga = (2 * Math.PI * CLK.gal.tau(t)) / (PH.lap_y * PH.year);
  galaxy.set({ angle: ga, gain: 1.5 });
  const sp = galaxy.sunAt();
  sunG.set({ center: sp, camera, opacity: view.alpha.galaxy });
  lap.set({ opacity: view.alpha.galaxy * fadeIn(t, CUE.lap, 0.6) });
  gcRing.set({ opacity: 0 });
  // the readout: light's path from the Sun to the galaxy's centre, drawn out on "To the galaxy's center"
  const ug = E.inout2(seg(t, CUE.gcring, CUE.gcring + 0.8));
  gcPath.seg(sp, sp.map((v) => v * (1 - ug))).set({ opacity: view.alpha.galaxy * (ug > 0.002 ? 1 : 0) });
  S.sunG = toS("galaxy", sp); S.gc = toS("galaxy", [0, 0, 0]);
  const la = Math.atan2(sp[2], sp[0]) + 2.2, rl = SUN_LY / 1000;
  S.lap = toS("galaxy", [rl * Math.cos(la), 0, rl * Math.sin(la)]);

  // through the jump the Sun stays a point: in when the orbit fades, out when the galaxy's own Sun has come in
  const jIn = fadeIn(t, CUE.j0 + 0.2, 0.4), jOut = fadeIn(t, CUE.j1 - 0.3, 0.4);
  sunJ.set({ center: toS("solar", [0, 0, 0]), camera, opacity: jIn * (1 - jOut) * (1 - view.alpha.solar) });
  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1 - clamp01((view.s - 12) / 2), bandGain: 1 - clamp01((view.s - 12) / 2) });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
function norm(a) { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); }
