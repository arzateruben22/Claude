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
import { createGalaxy, createCloud, SUN_LY } from "../set/galaxy.js";
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
const pos = (c) => c.map((v) => Math.max(0, v));                              // no negative light (an inverted token can dip below 0)
const B = Object.fromEntries(FILM.beats.map((b) => [b.id, b]));

const WORDS = { fast: "{n}× faster", slow: "{n}× slower", freeze: null };
const CLK = Object.fromEntries(Object.entries(FILM.clk).map(([k, keys]) => [k, clock(keys, { words: WORDS })]));
const AU = 1.496e8, LY = PH.ly, XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };
const thE = (t) => -0.6 + (2 * Math.PI * CLK.orbit.tau(t)) / PH.year;                 // Earth's angle on its orbit
const earthAbs = (t) => [AU * Math.cos(thE(t)), 0, -AU * Math.sin(thE(t))];            // km from the Sun

// ── the set ─────────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 61 });
scene.add(sky.group);
const G = { earth: new THREE.Group(), solar: new THREE.Group(), local: new THREE.Group(), galaxy: new THREE.Group() };
Object.values(G).forEach((g) => scene.add(g));
// earth rung (1 unit = 1,000 km): Earth at true size, a meridian pin, "you" on the equator
const earth = createPlanet({ radius: 6.371, surface: earthSurface({ width: W >= 1000 ? 2048 : 1024 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.5, segments: 128 });
const you = createBeacon({ color: hdr("teal", 1.2), px: 12, core: 0.5 });
// the equator "you" stand on (on "at the equator"): solid, so it stays on the turning ground; the planet hides its far half
const eqR = ring({ color: pos(line("ice", 0.5)), width: 2, opacity: 0 }).arc({ r: 6.371 * 1.004, ...XZ });
G.earth.add(earth.group, you.mesh, eqR.mesh);
// solar rung (1 unit = 1 million km): the Sun (not to scale), Earth's orbit, Earth's marker, the arc it has run
const sun = createStar({ radius: 8, intensity: 1.4, corona: 2.4, limb: 0.6, granulation: 0.2 });   // not to scale (badged): a face, not a dot
const orbitR = ring({ color: line("lilac", 0.7), width: 2, opacity: 1 }).arc({ r: AU / 1e6, ...XZ });
const trail = ring({ color: pos(line("ice", 0.8)), width: 4, opacity: 0 });               // ice, a body's path (teal is light's)
const earthDot = createBeacon({ color: pos(line("ice", 0.85)), px: 14, core: 0.5 });     // under the bloom's knee: hdr ice blooms royal blue
G.solar.add(sun.group, orbitR.mesh, trail.mesh, earthDot.mesh);
// local rung (1 unit = 1 light-year): the Sun's neighbourhood, a cloud of nearby stars the jump passes through
const cloud = createCloud({ n: 3000, radius: 60, seed: 5 });
cloud.material.uniforms.uGain.value = 2.6;                                    // bright enough to read as a ball of stars through the hold
G.local.add(cloud.group);
// galaxy rung (1 unit = 1,000 light-years): the Milky Way (illustration), the Sun's lap, the Sun
const galaxy = createGalaxy({ n: 40000, radius: 50, seed: 27, sunAngle: Math.PI * 0.75 });
// the lap stays under the bloom's knee (pushed into it, lilac blooms royal blue) and wide enough to read over the arms' grain
const lap = ring({ color: pos(line("lilac", 0.8)), width: 7, opacity: 0, dash: 40, duty: 0.6 }).arc({ r: SUN_LY / 1000, ...XZ });
const gcRing = ring({ color: line("teal", 0.9), width: 2.8, opacity: 0 }).arc({ r: SUN_LY / 1000 + 0.4, ...XZ });
const gcPath = segment({ color: line("teal", 1, 1.8), width: 7, opacity: 0 });
const gcHead = createBeacon({ color: hdr("teal", 1.4), px: 16, core: 0.5 });    // the light's front, riding the path's drawn end
// the Sun as a point (in the jump and in the galaxy): pale lemon-white like its ✦ label, not Earth's ice-blue marker. In the
// galaxy it glows past its label's dot and outshines the bulge's points (the line says "the Sun"); lemon blooms lemon
const sunG = createBeacon({ color: pos(hdr("lemon", 1.8)), px: 30, core: 0.5 });
const sunJ = createBeacon({ color: hdr("lemon", 1.3), px: 18, core: 0.5 });   // the Sun through the jump (between the rungs)
const earthJ = createBeacon({ color: hdr("ice", 1.1), px: 12, core: 0.5 });   // Earth as a point as the jump begins
scene.add(sunJ.mesh, earthJ.mesh);
G.galaxy.add(galaxy.group, lap.mesh, gcRing.mesh, gcPath.mesh, gcHead.mesh, sunG.mesh);
galaxy.set({ angle: 0 });
const SUN0 = galaxy.sunAt();
const GC_ABS = SUN0.map((v) => -v * 1000 * LY);                                    // the galactic centre, km from the Sun at t = 0

const E0 = earthAbs(0);
const ORIGIN = { earth: [...E0] };                                                 // the earth rung follows Earth (mutated each seek)
const ladder = createLadder({
  rungs: [
    { id: "earth", group: G.earth, unit: FILM.ladder.units.earth, origin: ORIGIN.earth, show: FILM.ladder.show.earth, fade: FILM.ladder.fade.earth },
    { id: "solar", group: G.solar, unit: FILM.ladder.units.solar, origin: [0, 0, 0], show: FILM.ladder.show.solar, fade: FILM.ladder.fade.solar },
    { id: "local", group: G.local, unit: FILM.ladder.units.local, origin: [0, 0, 0], show: FILM.ladder.show.local, fade: FILM.ladder.fade.local },
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
  if (c.fmt === "since") { const v = el.querySelector(".v"); if (v) v.style.textAlign = "center"; }   // 3 digits sit under the label's centre
  const lb = el.querySelector(".lb");                                          // the small label stays readable on the galaxy's grain
  if (lb) lb.style.textShadow = "0 0 1.2vmin rgba(8,10,28,.95), 0 0 2.6vmin rgba(8,10,28,.85)";
  if (c.text && c.text.length > 12) { const v = el.querySelector(".v"); if (v) v.style.fontSize = "5.5vmin"; }
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed });
}
for (const p of FILM.pills || []) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0", textWrap: "balance" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";                                   // the title stays inside the end ring
const fo = endEl.querySelector(".fo");
if (fo) fo.style.marginTop = "1.8vmin";                                      // the pill sits inside the ring
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });

// Galileo's cabin (an illustration, as an inset over Earth): a ship on calm water, the hull cut away below deck. The
// water slides past (the ship is moving); inside nothing shows it: the drops fall straight down (lilac: gravity), the
// fish swims, the butterflies flutter in place. On "jolt" the ship lurches once; then the smooth ride again.
const cab = document.createElement("div");
const CW = 0.8 * W, CH = 0.3 * H;
Object.assign(cab.style, { position: "absolute", left: `${(W - CW) / 2}px`, top: `${0.165 * H}px`, width: `${CW}px`, height: `${CH}px`, opacity: 0, zIndex: 3,
  pointerEvents: "none", background: "rgba(8,10,28,.9)", borderRadius: "3vmin", boxShadow: "0 0 0 1px rgba(170,185,230,.18)" });
const wave = (y, a, ph) => { let d = `M -100 ${y}`; for (let x = -100; x <= 900; x += 20) d += ` L ${x} ${(y + a * Math.sin((x / 100) * Math.PI + ph)).toFixed(1)}`; return d; };
cab.innerHTML = `<svg width="${CW}" height="${CH}" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet" style="overflow:hidden;border-radius:3vmin">
  <g id="cab-water" style="stroke:var(--ice)" fill="none" stroke-width="3" stroke-linecap="round" opacity="0.55">
    <path d="${wave(450, 6, 0)}"/><path d="${wave(478, 5, 1.3)}" opacity="0.7"/><path d="${wave(504, 4, 2.4)}" opacity="0.45"/></g>
  <g id="cab-ship" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 400 168 L 400 34" style="stroke:var(--text-2)" stroke-width="4"/>
    <path d="M 408 44 L 408 150 L 560 150 Z" style="stroke:var(--text-2)" stroke-width="3"/>
    <path d="M 40 168 L 760 168 L 700 432 Q 400 462 100 432 Z" style="stroke:var(--ice)" stroke-width="4"/>
    <rect x="130" y="192" width="540" height="214" rx="10" style="stroke:var(--text-2);fill:rgba(143,208,255,.05)" stroke-width="2.5"/>
    <path d="M 430 352 L 640 352 M 450 352 L 450 404 M 620 352 L 620 404" style="stroke:var(--text-2)" stroke-width="3"/>
    <circle cx="535" cy="322" r="30" style="stroke:var(--ice)" stroke-width="3"/>
    <path id="cab-fish" d="M -12 0 Q 0 -8 10 0 Q 0 8 -12 0 M 10 0 L 17 -6 L 17 6 Z" style="stroke:var(--ice)" stroke-width="2.5"/>
    <path d="M 238 192 L 238 206 M 224 206 L 252 206 L 247 232 L 229 232 Z" style="stroke:var(--text-2)" stroke-width="3"/>
    <path d="M 226 372 L 226 400 L 250 400 L 250 372 M 222 372 L 254 372" style="stroke:var(--text-2)" stroke-width="3"/>
    <g id="cab-drops" style="fill:var(--lilac)"><circle r="4.5"/><circle r="4.5"/><circle r="4.5"/></g>
    <g id="cab-b1" style="stroke:var(--text)" stroke-width="2.5"><path d="M 0 0 Q -14 -14 -18 0 Q -14 12 0 0 Q 14 -14 18 0 Q 14 12 0 0"/></g>
    <g id="cab-b2" style="stroke:var(--text)" stroke-width="2.5"><path d="M 0 0 Q -12 -12 -15 0 Q -12 10 0 0 Q 12 -12 15 0 Q 12 10 0 0"/></g>
  </g></svg>`;
document.getElementById("hud").appendChild(cab);
const CAB = { water: cab.querySelector("#cab-water"), ship: cab.querySelector("#cab-ship"), fish: cab.querySelector("#cab-fish"),
  drops: [...cab.querySelectorAll("#cab-drops circle")], b1: cab.querySelector("#cab-b1"), b2: cab.querySelector("#cab-b2") };
const cabOp = (t) => Math.min(E.out3(seg(t, CUE.cab0, CUE.cab0 + 0.45)), 1 - E.in3(seg(t, CUE.cab1 - 0.45, CUE.cab1)));
const cabin = (t) => {
  const op = cabOp(t);
  cab.style.opacity = op.toFixed(3);
  if (op <= 0.001) return;
  const u = t - CUE.cab0;
  CAB.water.setAttribute("transform", `translate(${(-(u * 60) % 200).toFixed(1)} 0)`);   // the water slides past: the ship moves
  const j = t - CUE.jolt, lurch = j > 0 && j < 0.7 ? 16 * Math.sin(j * 2 * Math.PI * 5) * Math.exp(-j / 0.18) : 0;
  CAB.ship.setAttribute("transform", `translate(${lurch.toFixed(2)} ${(lurch * 0.25).toFixed(2)})`);
  CAB.fish.setAttribute("transform", `translate(${(535 + 12 * Math.sin(u * 1.3)).toFixed(1)} 324) scale(${Math.cos(u * 1.3) >= 0 ? 1 : -1} 1)`);
  CAB.drops.forEach((d, k) => { const q = ((u / 0.9) + k / 3) % 1; d.setAttribute("cx", "238"); d.setAttribute("cy", (236 + q * 132).toFixed(1)); d.setAttribute("opacity", q < 0.94 ? "1" : "0"); });
  const flap = (ph) => (0.35 + 0.65 * Math.abs(Math.cos(u * 9 + ph))).toFixed(3);
  CAB.b1.setAttribute("transform", `translate(${(330 + 6 * Math.sin(u * 0.8)).toFixed(1)} ${(262 + 4 * Math.sin(u * 1.7)).toFixed(1)}) scale(${flap(0)} 1)`);
  CAB.b2.setAttribute("transform", `translate(${(610 + 5 * Math.sin(u * 0.9 + 1)).toFixed(1)} ${(236 + 4 * Math.sin(u * 1.5 + 2)).toFixed(1)}) scale(${flap(1.7)} 1)`);
};

window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  rig.place(camera, shot, t);
  const ea = earthAbs(t);
  ORIGIN.earth[0] = ea[0]; ORIGIN.earth[1] = ea[1]; ORIGIN.earth[2] = ea[2];
  const view = ladder.apply(dolly(t));
  // the jump passes the orbit's rung in about half a second: drawn, its ring and trail only slash across the frame and
  // the spine, so the jump shows Earth shrinking, the Sun as a point, then the galaxy
  const inJump = t > CUE.j0 && t < CUE.j1;
  if (inJump) G.solar.visible = false;
  // the push back in to Earth (e0 → e1): the orbit and its trail would pass the lens as huge arcs; they leave first
  const kPush = t > CUE.e0 && t < CUE.j0 ? 1 - E.out3(seg(t, CUE.e0, CUE.e0 + 0.35)) : 1;
  const kCab = cabOp(t);                                                        // Earth steps back behind Galileo's cabin
  if (kCab > 0.001) setOpacity(G.earth, view.alpha.earth * (1 - 0.85 * kCab));
  const toS = (id, p) => ladder.toScene(id, p, view);
  const sunDirE = (() => { const l = Math.hypot(...ea); return ea.map((v) => -v / l); })();

  // Earth: spinning at the clock's rate (counterclockwise seen from the north); "you" stand on the equator in Ecuador
  // (longitude 78.5° W), which crosses the side facing the camera from left to right while the spin plays
  const psi = 3.955 + (2 * Math.PI * CLK.spin.tau(t)) / PH.sidereal;
  earth.set({ center: [0, 0, 0], sunDir: norm([sunDirE[0] + 0.35, 0.25, sunDirE[2] + 0.6]), sun: 1, spin: psi + (78.5 * Math.PI) / 180 });
  const pinL = [6.371 * 1.01 * Math.cos(psi), 0, -6.371 * 1.01 * Math.sin(psi)];
  you.set({ center: pinL, camera, opacity: view.alpha.earth });
  S.pin = toS("earth", pinL.map((v) => v * 1.06));

  // the orbit: the Sun, Earth's marker, the arc it has run since the orbit clock started
  sun.set({ tau: t * 300, on: view.alpha.solar > 0.001, camera, center: [0, 0, 0] });
  const eS = ea.map((v) => v / 1e6);
  earthDot.set({ center: eS, camera, opacity: view.alpha.solar });
  trail.arc({ r: AU / 1e6, a0: -0.6, a1: Math.max(-0.6 + 1e-4, thE(t)), ...XZ }).set({ opacity: thE(t) > -0.6 + 1e-3 ? view.alpha.solar * kPush : 0 });
  orbitR.set({ opacity: view.alpha.solar * kPush });
  S.earthS = toS("solar", eS.map((v, i) => v + (i === 1 ? 3 : 0)));
  S.sun = toS("solar", [0, 5, 0]);

  // the galaxy: the Sun on its lap. The disc turns so its arms trail (as real spiral arms do); it steps down while the
  // lap is drawn and again for the readout, so the lap, the Sun and light's path win over the bulge
  const ga = (2 * Math.PI * CLK.gal.tau(t)) / (PH.lap_y * PH.year);
  galaxy.set({ angle: -ga, gain: (1.5 - 0.5 * fadeIn(t, CUE.lap - 0.6, 0.6)) * (1 - 0.35 * fadeIn(t, CUE.rd, 0.5)) });
  const sp = galaxy.sunAt();
  sunG.set({ center: sp, camera, opacity: view.alpha.galaxy });
  lap.set({ opacity: view.alpha.galaxy * fadeIn(t, CUE.lap, 0.6) * (1 - 0.55 * fadeIn(t, CUE.last, 0.6)) * (1 - 0.5 * fadeIn(t, CUE.gcring, 0.5)) });   // loud for "One lap", then quieter
  gcRing.set({ opacity: 0 });
  // the readout: light's path from the Sun to the galaxy's centre, drawn out on "To the galaxy's center"
  const ug = E.inout2(seg(t, CUE.gcring, CUE.gcring + 0.8)), gEnd = sp.map((v) => v * (1 - ug));
  gcPath.seg(sp, gEnd).set({ opacity: view.alpha.galaxy * (ug > 0.002 ? 1 : 0) });
  gcHead.set({ center: gEnd, camera, opacity: view.alpha.galaxy * (ug > 0.002 && ug < 0.999 ? 1 : 0) });
  // through the jump the Sun stays a point: in when the orbit fades, out when the galaxy's own Sun has come in;
  // "the Sun, and you" rides that point and hands over to the galaxy's Sun as it comes in
  const jIn = fadeIn(t, CUE.j0 + 0.2, 0.4), jOut = fadeIn(t, CUE.j1 - 0.3, 0.4), sJ = toS("solar", [0, 0, 0]), sG = toS("galaxy", sp);
  S.sunG = t > CUE.j0 && t < CUE.j1 + 0.1 ? sG.map((v, i) => sJ[i] + (v - sJ[i]) * jOut) : sG;
  S.gc = toS("galaxy", [0, 0, 0]);
  // the lap's label: on the ring's upper-left corner on screen (the far side, away from the Sun's path and the core)
  camera.updateMatrixWorld();
  const rl = SUN_LY / 1000;
  let best = null, by = -Infinity;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * 2 * Math.PI, pS = toS("galaxy", [rl * Math.cos(a), 0, rl * Math.sin(a)]);
    const q = new THREE.Vector3(...pS).project(camera), sc = q.y - q.x;
    if (sc > by) { by = sc; best = pS; }
  }
  S.lap = best;

  sunJ.set({ center: sJ, camera, opacity: jIn * (1 - jOut) * (inJump ? 1 : 1 - view.alpha.solar) });
  earthJ.set({ center: toS("earth", [0, 0, 0]), camera, opacity: inJump ? (1 - view.alpha.earth) * (1 - fadeIn(t, CUE.jm - 0.3, 0.4)) : 0 });
  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1 - clamp01((view.s - 12) / 2), bandGain: 1 - clamp01((view.s - 12) / 2) });
  cabin(t);
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
function norm(a) { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); }
