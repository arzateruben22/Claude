import * as THREE from "three";
// Light Minute No. 001, "If the Sun vanished" (films/channels/space/ep01). The picture as a pure function
// of t for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the scene's
// own clocks, every object and the overlay from t alone, then makes exactly one renderer.render().
//
// The set is the channel's reusable Orrery (../set/*.js: sky, star, planet, orbit, grid, galaxy, rig, look,
// motif) plus the shared kit blocks (kits/cinema/sci: hud.js, clock.js, front.js, ladder.js). Everything
// timed comes from film.json, which compile.py hangs on the voice; this file only stages it.
//
// Shots (film.json "shots"): diagram (hook, rewind, normal, change) · grid (gravity, an analogy) · race
// (GW170817) · earth (Earth's true 14,900 km) · news (the diagram again: the news arrives) · restore
// (takeaway and the readout, with the one scale jump) · end (the end card over the galaxy).
// Honesty: every cheat on screen carries its badge (film.json "badges"): "not to scale" on every diagram,
// "time ×N" from each scene clock, "orbit sped up ×5,000" apart from the light clock, "analogy" on the grid,
// "thought experiment" while the Sun is gone, and "true scale" on the one shot that is.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { ring, segment, train, probes } from "cinema/sci/front.js";
import { createLadder, logDolly } from "cinema/sci/ladder.js";
import { createSky } from "../set/sky.js";
import { createStar } from "../set/star.js";
import { createPlanet, earthSurface } from "../set/planet.js";
import { createGrid } from "../set/grid.js";
import { createGalaxy, createCloud, SUN_LY } from "../set/galaxy.js";
import { orbit } from "../set/orbit.js";
import { createRig } from "../set/rig.js";
import { hdr, tok, line } from "../set/look.js";
import { titleRing, endRing, fmtClock, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, PH = FILM.phys, CUE = FILM.cue, FPS = FILM.fps || 30;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.5, 4000);
if (window.CINEMA) {
  // the bible's budget: K stays at 2 in slow shots and caps at 12 (the scale jump); bloom only on what is
  // brighter than white (the Sun, light fronts, the kilonova), never on text (text is DOM, above the canvas)
  Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
}
// no depth of field: nothing in this film comes near the lens, and the finish's bokeh is the costliest pass
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

// ── scene clocks (clock.js; each pinned so τ(anchor t) = anchor τ) ─────────
const WORDS = { fast: "time ×{n}", slow: "slowed ×{n}", freeze: null };
const pinned = (c) => { const c0 = clock(c.keys, { words: WORDS }); return clock(c.keys, { words: WORDS, tau0: c.anchor[1] - c0.tau(c.anchor[0]) }); };
const CLK = Object.fromEntries(Object.entries(FILM.clk).map(([k, c]) => [k, pinned(c)]));
const DG = FILM.clk.diagram;
const tauDiagram = (t) => {                     // the hook is a frozen moment; the rewind runs it back to the normal clock
  if (t < DG.rewind[0]) return DG.hook;
  const after = CLK.diagram.tau(DG.rewind[1]);
  if (t < DG.rewind[1]) return DG.hook + (after - DG.hook) * E.inout3(seg(t, DG.rewind[0], DG.rewind[1]));
  return CLK.diagram.tau(t);
};

// ── constants of the picture ────────────────────────────────────────────────
const R = PH.r_d, T_ARR = PH.t_arr, cD = R / T_ARR;                       // the diagram: 1 unit = 10 million km; light crosses R in 8:20
const orb = orbit({ a: R, e: 0, period: PH.year / PH.n_orbit, m0: PH.e0 }); // the orbit sped up ×N (badged); light runs true
const SUN_R = 1.35, EARTH_R = 0.45, RMAX = FILM.ripple.rMax;
const SPIN = (tau) => (2 * Math.PI * tau) / 86164;                          // Earth's own spin runs at the clock's rate, never sped up
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// line colours: the light each line adds over the void so the finish shows the token at that strength (look.js)
// (lilac and ice above 0.8 need so much blue light that the bloom would turn them blue: they stay at 0.8)
const C = { orbit: line("lilac", 0.5), lilac: line("lilac", 0.8), teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3), ripple: line("teal", 0.24),
  ghost: line("text-2", 0.7), dim: line("text-2", 0.55), ice: line("ice", 0.8), iceDim: line("ice", 0.55) };

// ── the set ─────────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 11 });
scene.add(sky.group);
const surface = earthSurface({ width: W >= 1000 ? 1024 : 512 });

// diagram (also the ladder's "solar" rung: 1 unit = 10 million km)
const G = { diagram: new THREE.Group(), grid: new THREE.Group(), race: new THREE.Group(), earth: new THREE.Group(), local: new THREE.Group(), galaxy: new THREE.Group() };
Object.values(G).forEach((g) => scene.add(g));
const sun = createStar({ radius: SUN_R, intensity: 2.6, corona: 2.7 });
const earth = createPlanet({ radius: EARTH_R, surface, tilt: 23.44, rimDay: 0.5, rimNight: 0.22, segments: 48 });
G.diagram.add(sun.group, earth.group);
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };                              // angles run counterclockwise seen from +y (north up)
const orbitRing = ring({ color: C.orbit, width: 2.2, opacity: 1 }).arc({ r: R, ...XZ });
const trail = ring({ color: C.lilac, width: 3.6, opacity: 0.95, fade: [0.08, 1] });
const freePath = segment({ color: C.lilac, width: 3.6, opacity: 0.95, fade: [0.25, 1] });
const R_AU = R + 0.32;                                                     // drawn just outside the orbit, so both read
const ringAU = ring({ color: C.teal, width: 2.6, opacity: 0 }).arc({ r: R_AU, ...XZ });
const ghost = ring({ color: C.ghost, width: 2.2, opacity: 0, dash: 16, duty: 0.5 }).arc({ r: SUN_R, ...XZ });
const gravFront = ring({ color: C.lilac, width: 3.2, opacity: 0, dash: 72, duty: 0.55 });
const radiusLine = segment({ color: C.ghost, width: 2, opacity: 0, dash: 1.1, duty: 0.5 });
const vArrow = [segment({ color: C.lilac, width: 3.4, opacity: 0 }), segment({ color: C.lilac, width: 3.4, opacity: 0 }), segment({ color: C.lilac, width: 3.4, opacity: 0 })];
const ripples = Array.from({ length: 16 }, () => ring({ color: C.ripple, width: 1.8, opacity: 0 }));
[orbitRing, trail, freePath, ringAU, ghost, gravFront, radiusLine, ...vArrow, ...ripples].forEach((r) => G.diagram.add(r.mesh));
const frontProbe = probes(G.diagram, 2);

// grid (the gravity well, an analogy; same units as the diagram)
const grid = createGrid({ size: 66, segments: 160, spacing: 2.2, depth: 7, soft: 2.4, c: cD, front: 30, color: line("lilac", 0.75), opacity: 1 });
const gridSun = createStar({ radius: SUN_R, intensity: 2.6, corona: 2.7 });
const gridFront = ring({ color: C.tealHi, width: 4.2, opacity: 0 });
G.grid.add(grid.mesh, gridSun.group, gridFront.mesh);
const gridProbe = probes(G.grid, 2);

// race (GW170817: 1 unit = 130/80 million light-years along the lane; sizes not to scale)
const LANE = 80, M_AT = [0, 0, -LANE / 2], E_AT = [0, 0, LANE / 2], cR = LANE / PH.race_s;
const host = createCloud({ n: 2600, radius: 4.2, seed: 41, flat: 0.32 });
host.group.position.fromArray(M_AT);
const nsMat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 2.2 } }, vertexShader: "void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: "uniform float uI; void main(){ gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * uI, 1.0); }" });
const ns = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), nsMat));
const glowMat = new THREE.ShaderMaterial({
  uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Vector3(0.86, 0.93, 1.0) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform float uI; uniform vec3 uCol; varying vec2 vUv; void main(){ vec2 q = vUv * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard; float a = (exp(-r * r * 9.0) * 1.6 + pow(1.0 - r, 2.0) * 0.35) * uI; gl_FragColor = vec4(uCol * a, a); }",
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMat);
glow.scale.setScalar(3.2); glow.userData.noProbe = true;
const raceEarth = createPlanet({ radius: 1.6, surface, tilt: 23.44, rimDay: 0.5, rimNight: 0.2, segments: 48 });
raceEarth.group.position.fromArray(E_AT);
const lane = segment({ color: C.dim, width: 2, opacity: 1, dash: 0.6, duty: 0.45 }).seg(M_AT, E_AT);
const raceLight = ring({ color: C.tealHi, width: 4, opacity: 0 }), raceGW = ring({ color: C.lilac, width: 3.4, opacity: 0, dash: 110, duty: 0.55 });
G.race.add(host.group, ...ns, glow, raceEarth.group, lane.mesh, raceLight.mesh, raceGW.mesh);
const raceProbe = probes(G.race, 2);

// earth (Earth at Earth scale: 1 unit = 1,000 km, true size and true move)
const bigEarth = createPlanet({ radius: PH.earth_r / 1000, surface, tilt: 23.44, rimDay: 0.6, rimNight: 0.12, segments: 128 });
const X0 = -PH.move_km / 2000, X1 = PH.move_km / 2000, VX = PH.v_km / 1000, RY = -PH.earth_r / 1000 - 2.1;
const ghostA = ring({ color: C.iceDim, width: 2.4, opacity: 0, dash: 44, duty: 0.5 }), ghostB = ring({ color: C.iceDim, width: 2.2, opacity: 0, dash: 44, duty: 0.5 });
const ruler = segment({ color: C.ice, width: 3, opacity: 0 }).seg([X0, RY, 0], [X1, RY, 0]);
const rulerDone = segment({ color: C.tealHi, width: 5, opacity: 0 });
const ticks = [X0, X1].map((x) => segment({ color: C.ice, width: 3, opacity: 0 }).seg([x, RY - 0.7, 0], [x, RY + 0.7, 0]));
G.earth.add(bigEarth.group, ghostA.mesh, ghostB.mesh, ruler.mesh, rulerDone.mesh, ...ticks.map((k) => k.mesh));

// the ladder's other rungs: the solar neighbourhood (1 unit = 1 light-year) and the galaxy (1 unit = 1,000 ly)
const cloud = createCloud({ n: 1800, radius: 60, seed: 5 });
G.local.add(cloud.group);
const galaxy = createGalaxy({ n: 40000, radius: 50, seed: 27, sunAngle: Math.PI * 0.75 });   // the Sun lands lower left in the end view
const ringGC = ring({ color: C.teal, width: 2.8, opacity: 1 }).arc({ r: SUN_LY / 1000, ...XZ });
G.galaxy.add(galaxy.group, ringGC.mesh);
const LY = PH.ly_km, sunLocal = galaxy.sunAt();
const GC_ABS = sunLocal.map((v) => -v * 1000 * LY);                        // the galactic centre, km from the Sun
const ladder = createLadder({
  rungs: [
    { id: "solar", group: G.diagram, unit: FILM.ladder.units.solar, origin: [0, 0, 0], show: FILM.ladder.show.solar, fade: FILM.ladder.fade.solar },
    { id: "local", group: G.local, unit: FILM.ladder.units.local, origin: [0, 0, 0], show: FILM.ladder.show.local, fade: FILM.ladder.fade.local },
    { id: "galaxy", group: G.galaxy, unit: FILM.ladder.units.galaxy, origin: GC_ABS, show: FILM.ladder.show.galaxy, fade: FILM.ladder.fade.galaxy },
  ],
});
const FOCUS = { sun: [0, 0, 0], center: GC_ABS };
const dolly = logDolly(FILM.ladder.keys.map((k) => ({ ...k, focus: FOCUS[k.focus] })));

// ── the camera (a telescope mount: set/rig.js) ─────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { earth: [R, 0, 0], earthV: [R, 0, -3], front: [0, 0, 0], ringAU: [0, 0, -R], well: [5, -2, 3], gridFront: [0, 0, 0],
  merger: M_AT, raceGW: E_AT, raceLight: E_AT, raceEarth: E_AT, ruler: [0, RY, 0], here: [0, 0, 0], gc: [0, 0, 0], ringGC: [0, 0, 0], sunPos: [0, 0, 0] };
const KIND = { body: { color: "ice", glyph: "●", mark: "none" }, star: { color: "lemon", glyph: "✦", mark: "none" },
  light: { color: "teal", glyph: "◯", mark: "none" }, gravity: { color: "lilac", mark: "dashed" } };
const ANCHOR = { earth: () => S.earth, "earth-v": () => S.earthV, sun: () => S.sunPos, "ring-au": () => S.ringAU, front: () => S.front, well: () => S.well,
  "grid-front": () => S.gridFront, merger: () => S.merger, "race-gw": () => S.raceGW, "race-light": () => S.raceLight, "race-earth": () => S.raceEarth,
  ruler: () => S.ruler, here: () => S.here, gc: () => S.gc, "ring-gc": () => S.ringGC };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, b.clock ? { from: CLK[b.clock], t0: b.t0, t1: b.t1, slot: b.slot } : { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at, unit: c.unit };
  if (c.fmt === "clock") Object.assign(o, { value: (t) => Math.min(CLK[c.clock].tau(t), c.stop ?? Infinity), fmt: fmtClock, lit: c.lit ? (v) => v >= c.lit - 1e-6 : null, minCh: 4 });
  else if (c.fmt === "lt2") Object.assign(o, { value: () => 0, fmt: () => "< 2" });
  else Object.assign(o, { value: () => 0, fmt: () => c.text, lit: () => true });
  const el = hud.counter(c.id, o);
  el.classList.add(c.fmt === "text" ? "lm-read" : "lm-clock");
}
const BARS = {
  "sun-earth": () => { const a = hud.project(S.sunPos), b = hud.project(S.earth); return Math.hypot(b.x - a.x, b.y - a.y); },
  lane: () => { const a = hud.project(M_AT), b = hud.project(E_AT); return Math.hypot(b.x - a.x, b.y - a.y); },
};
for (const p of FILM.pills) hud.scale(p.id, { text: p.text, bar: p.bar ? BARS[p.bar] : null, t0: p.t0, t1: p.t1, at: p.at });
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: ANCHOR[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });

// ── per-shot staging ────────────────────────────────────────────────────────
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d * 0.8)));
const LBL = Object.fromEntries(FILM.labels.map((l) => [l.id, l]));
const PIL = Object.fromEntries(FILM.pills.map((p) => [p.id, p]));

// the diagram at scene time tau. story: the Sun vanishes at τ = 0 and the news reaches Earth at T_ARR;
// real: the Sun stays on (the restored system).
const diagram = (t, tau, mode) => {
  const story = mode === "story", sunOn = !story || tau < 0;
  sun.set({ tau, on: sunOn, camera, center: [0, 0, 0] });
  ghost.set({ opacity: sunOn ? 0 : 0.7 });
  const released = story && tau > T_ARR;
  const p = story ? orb.free(tau, T_ARR) : orb.at(tau);
  const dist = Math.hypot(p[0], p[2]);
  const lit = story ? clamp01(1 - (tau - (dist - EARTH_R) / cD) / ((2 * EARTH_R) / cD)) : 1;
  earth.set({ center: p, sunDir: norm([-p[0], -p[1], -p[2]]), sun: lit, spin: SPIN(tau) + 1.2 });
  S.earth = [p[0], p[1] + EARTH_R * 0.6, p[2]];
  // the orbit: solid while bound; once the news arrives the circle Earth left is dashed (the old orbit)
  orbitRing.set({ opacity: released ? 0.8 : 1, dash: released ? 64 : 0 });
  // the arc it travelled since the vanish (sped up ×N, badged), then the straight line
  if (story && tau > 0) {
    const a1 = PH.e0 + (2 * Math.PI * PH.n_orbit * Math.min(tau, T_ARR)) / PH.year;
    trail.arc({ r: R, a0: PH.e0, a1, ...XZ }).set({ opacity: 0.95 });
  } else trail.set({ opacity: 0 });
  if (released) freePath.seg(orb.at(T_ARR), p).set({ opacity: 0.95 }); else freePath.set({ opacity: 0 });
  // light: one front every PERIOD while the Sun shines; after the vanish nothing follows the last one
  const fr = train(tau, { c: cD, period: FILM.ripple.period, to: story ? 0 : Infinity, rMax: RMAX + 2 });
  let lastR = null;
  ripples.forEach((rp, i) => {
    const f = fr[i];
    if (!f || f.r < SUN_R * 0.9) { rp.set({ opacity: 0 }); return; }
    const isLast = story && tau >= 0 && Math.abs(f.t0) < 1e-6, isHi = !story ? false : Math.abs(f.t0 - FILM.ripple.hi) < 1e-3 && tau < 0;
    const fade = clamp01((f.r - SUN_R) / 2.2) * (1 - clamp01((f.r - (RMAX - 10)) / 10));
    rp.arc({ r: f.r, ...XZ }).set({ opacity: fade, width: isLast || isHi ? 4.2 : 1.8, color: isLast || isHi ? C.tealHi : C.ripple });
    if (isLast) lastR = f.r;
  });
  // the news: light (teal) and gravity (lilac, dashed, drawn just outside it), together
  const rNews = story && tau > 0 ? cD * tau : null;
  gravFront.arc({ r: (rNews || 0) + 0.24, ...XZ }).set({ opacity: rNews && mode === "story" && t >= FILM.shots[4].at ? (1 - clamp01((rNews - (RMAX - 10)) / 10)) : 0 });
  const ae = Math.atan2(-p[2], p[0]) + 0.32;                                    // the front's anchor: a little ahead of Earth
  S.front = rNews ? [rNews * Math.cos(ae), 0, -rNews * Math.sin(ae)] : [0, 0, 0];
  frontProbe(rNews && rNews < RMAX ? [S.front, [rNews * Math.cos(ae - 0.6), 0, -rNews * Math.sin(ae - 0.6)]] : [null, null]);
  // the light-time ring "8 min 20 s" and its label's spot (on the far side of the ring, up the frame)
  const ar = 0.5;                                                                // the ring label sits up and to the right of the Sun
  S.ringAU = [R_AU * Math.cos(ar), 0, -R_AU * Math.sin(ar)];
  S.sunPos = [0, SUN_R * 0.7, 0];
  return { p, released, lastR };
};

window.seek = function (t) {
  const st = stage(t), shot = st.name;
  const camShot = shot === "end" ? "end" : shot;
  const tr = Math.round(t * FPS) / FPS;
  const show = { diagram: false, grid: false, race: false, earth: false, local: false, galaxy: false };
  let starGain = 1, bandGain = 1;

  if (shot === "diagram" || shot === "news") {
    show.diagram = true;
    G.diagram.position.set(0, 0, 0); G.diagram.scale.setScalar(1);
    const tau = shot === "diagram" ? tauDiagram(t) : CLK.whoa.tau(t);
    rig.place(camera, camShot, t);
    const d = diagram(t, tau, "story");
    ringAU.set({ opacity: shot === "diagram" ? fadeIn(t, CUE.ring, 0.5) : 0.45 });
    // normal beat: the radius (150 million km) and the speed arrow (nearly 30 km/s)
    const pa = PIL["p-au"], lv = LBL["l-v"];
    radiusLine.seg([0, 0, 0], d.p).set({ opacity: shot === "diagram" ? winOp(t, pa.t0, pa.t1) : 0 });
    const v = norm(orb.vel(tau)), tip = [d.p[0] + v[0] * 3.4, 0, d.p[2] + v[2] * 3.4], back = [tip[0] - v[0] * 0.9, 0, tip[2] - v[2] * 0.9];
    const side = [-v[2] * 0.55, 0, v[0] * 0.55], ov = shot === "diagram" ? winOp(t, lv.t0, lv.t1) : 0;
    vArrow[0].seg([d.p[0] + v[0] * (EARTH_R + 0.2), 0, d.p[2] + v[2] * (EARTH_R + 0.2)], tip).set({ opacity: ov });
    vArrow[1].seg(tip, [back[0] + side[0], 0, back[2] + side[2]]).set({ opacity: ov });
    vArrow[2].seg(tip, [back[0] - side[0], 0, back[2] - side[2]]).set({ opacity: ov });
    S.earthV = tip;
  } else if (shot === "grid") {
    show.grid = true;
    rig.place(camera, camShot, t);
    const tg = CLK.grid.tau(t);
    grid.set({ tau: tg, masses: [{ at: [0, 0], m: 1, off: 0 }] });
    gridSun.set({ tau: tg, on: tg < 0, camera, center: [0, -7 + SUN_R * 0.9, 0] });
    const r = tg > 0 ? cD * tg : 0, ag = 2.55;
    gridFront.arc({ center: [0, 0.06, 0], r, ...XZ }).set({ opacity: r > 0.3 ? 1 - clamp01((r - 26) / 6) : 0 });
    S.gridFront = [r * Math.cos(ag), 0.06, -r * Math.sin(ag)];
    gridProbe(r > 0.3 ? [S.gridFront, [r * Math.cos(ag + 1), 0.06, -r * Math.sin(ag + 1)]] : [null, null]);
    const wx = 6.5, wz = 4.5;
    S.well = [wx, grid.depthAt(wx, wz, tg), wz];
  } else if (shot === "race") {
    show.race = true;
    rig.place(camera, camShot, t);
    const tr_ = CLK.race.tau(t), merged = tr_ >= 0;
    const tm = CUE.race.merge, k = merged ? Math.min(1, (t - tm) / 0.6) : 0;          // the kilonova brightens over 0.6 s: a ramp, never a flash
    ns[0].position.set(M_AT[0] - 0.42, 0.1, M_AT[2]); ns[1].position.set(M_AT[0] + 0.42, 0.1, M_AT[2]);
    ns.forEach((m) => { m.visible = !merged; });
    glow.position.set(M_AT[0], 0.1, M_AT[2]); glow.quaternion.copy(camera.quaternion);
    glowMat.uniforms.uI.value = merged ? E.inout2(clamp01(k)) * (0.55 + 0.45 * Math.exp(-(t - tm - 0.6) / 2.5)) : 0;
    const r = merged ? cR * tr_ : 0, fadeR = 1 - clamp01((r - (LANE + 6)) / 10);
    raceLight.arc({ center: M_AT, r, ...XZ }).set({ opacity: r > 0.2 ? fadeR : 0 });
    raceGW.arc({ center: M_AT, r: r + 0.45, ...XZ }).set({ opacity: r > 0.2 ? fadeR : 0 });
    const a = -Math.PI / 2;                                                            // XZ's −π/2 points at Earth (+z)
    const pt = (rr, da) => [M_AT[0] + rr * Math.cos(a + da), 0, M_AT[2] - rr * Math.sin(a + da)];
    S.raceLight = pt(r, -0.55); S.raceGW = pt(r + 0.45, 0.62); S.merger = [M_AT[0], 0.5, M_AT[2]]; S.raceEarth = [E_AT[0], 1.6, E_AT[2]];
    raceProbe(r > 0.2 && fadeR > 0 ? [pt(r, 0), pt(r, 0.5)] : [null, null]);
    raceEarth.set({ sunDir: norm([-0.55, 0.45, 0.7]), sun: 1, spin: 2.2 });
  } else if (shot === "earth") {
    show.earth = true;
    rig.place(camera, camShot, t);
    const tw = CLK.whoa.tau(t), x = X0 + VX * tw;
    bigEarth.set({ center: [x, 0, 0], sunDir: norm([0, 0.08, 1]), sun: 1, spin: SPIN(tw) - 0.35 });
    const cr = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), cu = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const basis = { e1: cr.toArray(), e2: cu.toArray() }, rr = PH.earth_r / 1000 + 0.25;
    ghostA.arc({ center: [X0, 0, 0], r: rr, ...basis }).set({ opacity: fadeIn(t, FILM.shots[3].at + 0.3, 0.6) });
    ghostB.arc({ center: [X1, 0, 0], r: rr, ...basis }).set({ opacity: 0.75 * fadeIn(t, LBL["l-move"].t0 - 0.4, 0.6) });
    const ro = fadeIn(t, FILM.shots[3].at + 0.2, 0.6);
    ruler.set({ opacity: ro }); ticks.forEach((k) => k.set({ opacity: ro }));
    rulerDone.seg([X0, RY, 0], [Math.min(x, X1), RY, 0]).set({ opacity: ro * (x > X0 + 0.05 ? 0.95 : 0) });
    S.ruler = [0, RY, 0];
  } else {                                                                             // restore + end: the restored system, then the ladder
    show.diagram = show.local = show.galaxy = true;
    rig.place(camera, camShot, t);
    const tau = CLK.restore.tau(t), view = ladder.apply(dolly(t));
    show.diagram = view.alpha.solar > 1e-4; show.local = view.alpha.local > 1e-4; show.galaxy = view.alpha.galaxy > 1e-4;
    diagram(t, tau, "real");
    const lr = LBL["l-ring-au"];
    ringAU.set({ opacity: 0.55 + 0.45 * fadeIn(t, lr.t0, 0.4) });
    radiusLine.set({ opacity: 0 }); vArrow.forEach((a) => a.set({ opacity: 0 }));
    // the sky is the Sun's neighbourhood: it fades as we leave it, and the galaxy is seen against the void
    starGain = bandGain = 1 - clamp01((view.s - 9.0) / 3.5);
    S.here = ladder.toScene("solar", [0, 0, 0], view);
    S.gc = ladder.toScene("galaxy", [0, 0, 0], view);
    const ag = 2.2, rg = SUN_LY / 1000;
    S.ringGC = ladder.toScene("galaxy", [rg * Math.cos(ag), 0, -rg * Math.sin(ag)], view);
    S.ringAU = ladder.toScene("solar", S.ringAU, view);
    S.earth = ladder.toScene("solar", S.earth, view);
    galaxy.set({ angle: 0, gain: 1 });
  }
  for (const [k, g] of Object.entries(G)) g.visible = show[k];
  if (!show.diagram) { G.diagram.position.set(0, 0, 0); G.diagram.scale.setScalar(1); }
  if (shot !== "restore" && shot !== "end") { G.local.visible = G.galaxy.visible = false; }
  sky.update(camera, { frameCam: rig.frameCamera(camera, camShot, tr), starGain, bandGain });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
