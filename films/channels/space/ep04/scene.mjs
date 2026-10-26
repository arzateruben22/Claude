import * as THREE from "three";
// Light Minute No. 004, "The falling Moon" (films/channels/space/ep04). The picture as a pure function of t.
//
// One shot, true scale (1 unit = 10,000 km: Earth 1.27 units across, the Moon 38.44 units out). Frame 0 is the payoff:
// the Moon a minute after leaving its straight line, the gap drawn a million times larger. Then the diagram from
// above (thirty Earths in a row reach the Moon; its speed), gravity switched off (a ghost Moon flies straight) and
// back on (the pull toward Earth), a turn to the side for Newton's test (an apple on Earth's surface, the Moon 60
// Earth radii out, the pull shrinking 3,600 times along the way), the whoa's minute (the Moon falls 4.9 m below its
// straight line, drawn ×1,000,000) and the readout's light-time ring. The end card pushes back into frame 0.
// Set: ../set (sky, planet with earthSurface, moon.js (new), beacon, rig's poseAt, look, motif). Kit: hud, clock, front.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { ring, segment } from "cinema/sci/front.js";
import { createSky } from "../set/sky.js";
import { createPlanet, earthSurface } from "../set/planet.js";
import { moonSurface } from "../set/moon.js";
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
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const WORDS = { fast: "{n}× faster", slow: "{n}× slower", freeze: null };
const CLK = { moon: clock(FILM.clk.moon, { words: WORDS }) };
const R = PH.r_orb, OMEGA = (2 * Math.PI) / PH.p_orb, V = PH.v_kms / PH.u;   // units a second
const thAt = (tau) => PH.th0 + OMEGA * tau;
const onOrbit = (th, r = R) => [r * Math.cos(th), 0, -r * Math.sin(th)];
const tanAt = (th) => [-Math.sin(th), 0, -Math.cos(th)];                     // counterclockwise seen from +y
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const TAU_MIN0 = CLK.moon.tau(CUE.min0);

// ── the set ─────────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 41 });
scene.add(sky.group);
const SUN = norm([0.75, 0.3, 0.6]);
const earth = createPlanet({ radius: PH.r_earth, surface: earthSurface({ width: W >= 1000 ? 1024 : 512 }), tilt: 23.44, rimDay: 0.5, rimNight: 0.45, segments: 64 });
const moon = createPlanet({ radius: PH.r_moon, surface: moonSurface({ width: 512, seed: 9 }), rimDay: 0.4, rimNight: 0.5, segments: 64 });
scene.add(earth.group, moon.group);
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };
const C = { orbit: line("lilac", 0.5), lilac: line("lilac", 0.8), teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3), ice: line("ice", 0.6), ghost: line("text-2", 0.7) };
const orbitRing = ring({ color: C.orbit, width: 2, opacity: 1 }).arc({ r: R, ...XZ });
const row = Array.from({ length: 30 }, () => ring({ color: C.ice, width: 1.6, opacity: 0 }));
const vArrow = [segment({ color: C.lilac, width: 3.2, opacity: 0 }), segment({ color: C.lilac, width: 3.2, opacity: 0 }), segment({ color: C.lilac, width: 3.2, opacity: 0 })];
const freePath = segment({ color: C.teal, width: 2.6, opacity: 0, dash: 1.2, duty: 0.5 });
const ghostMoon = ring({ color: C.ghost, width: 2, opacity: 0 });
const pull = [segment({ color: C.lilac, width: 3.4, opacity: 0 }), segment({ color: C.lilac, width: 3.4, opacity: 0 }), segment({ color: C.lilac, width: 3.4, opacity: 0 })];
const ruler = segment({ color: C.lilac, width: 2, opacity: 0 });
const ticks = Array.from({ length: 13 }, () => segment({ color: C.lilac, width: 2, opacity: 0 }));
const tangent = segment({ color: C.teal, width: 2.6, opacity: 0, dash: 0.25, duty: 0.5 });
const gap = segment({ color: C.tealHi, width: 3.6, opacity: 0 });
const ghostAt = ring({ color: C.ghost, width: 2, opacity: 0, dash: 24, duty: 0.5 });
const lightRing = ring({ color: C.tealHi, width: 3.4, opacity: 0 }).arc({ r: R + 1.6, ...XZ });
const tanTicks = Array.from({ length: 12 }, () => segment({ color: C.teal, width: 2.4, opacity: 0, fade: [1, 0.1] }));
// hollow marker rings of a fixed size in pixels round Earth and the Moon, so the true-scale bodies can be found in the diagrams (they claim no size)
const markM = ring({ color: C.ice, width: 2, opacity: 0 }), markE = ring({ color: C.ice, width: 2, opacity: 0 });
[markM, markE, orbitRing, ...row, ...vArrow, freePath, ghostMoon, ...pull, ruler, ...ticks, tangent, gap, ghostAt, lightRing, ...tanTicks].forEach((r) => scene.add(r.mesh));
const apple = createBeacon({ color: hdr("ice", 1.1), px: 14, core: 0.55 });
scene.add(apple.mesh);

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
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  el.classList.add(c.read ? "lm-read" : "lm-clock");
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.6vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "62vmin", margin: "4vmin auto 0" });
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d)));
const B = Object.fromEntries(FILM.beats.map((b) => [b.id, b]));

// the whoa's minute: where the Moon is drawn, dt seconds after it left its straight line at p0, the gap ×MAG
const fallState = (dt) => {
  const th0 = thAt(TAU_MIN0), p0 = onOrbit(th0), g = add(p0, tanAt(th0), V * dt), r = onOrbit(th0 + OMEGA * dt);
  const drawn = add(g, r.map((v, i) => v - g[i]), PH.mag);
  return { p0, g, drawn, th0 };
};

window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  rig.place(camera, shot, t);
  const tau = CLK.moon.tau(t), th = thAt(tau);
  // the Moon: on its orbit, except in the hook (frame 0, the whoa's end state) and the whoa's minute (the fall magnified)
  const inMin = t >= CUE.min0 && t < B.takeaway.t0 + 0.8, isHook = t < B.normal.t0;
  const dt = isHook ? 60 : Math.min(60, Math.max(0, tau - TAU_MIN0));
  const F = fallState(dt);
  let mp = onOrbit(th);
  if (isHook) mp = F.drawn;
  else if (inMin) mp = t < B.takeaway.t0 ? F.drawn : F.drawn.map((v, i) => v + (onOrbit(th)[i] - v) * E.inout2(seg(t, B.takeaway.t0, B.takeaway.t0 + 0.8)));
  moon.set({ center: mp, sunDir: SUN, sun: 1, spin: -th + Math.PI });               // tidally locked: the near side faces Earth
  earth.set({ center: [0, 0, 0], sunDir: SUN, sun: 1, spin: 0.9 + tau * 7.292e-5 });
  S.moon = add(mp, [0, PH.r_moon * 1.4, 0]); S.earth = [0, PH.r_earth * 1.3, 0];

  // normal: thirty Earths in a row reach the Moon; the speed arrow
  const dirM = norm(onOrbit(th));
  row.forEach((rg, k) => {
    const c = dirM.map((v) => v * PH.r_earth * (2 * k + 3));
    rg.arc({ center: c, r: PH.r_earth, ...XZ }).set({ opacity: winOp(t, CUE.row + k * 0.04, FILM.labels.find((l) => l.id === "l-30").t1, 0.3) });
  });
  S.row = dirM.map((v, i) => v * R * 0.5 + (i === 1 ? 1.5 : 0));
  const ov = winOp(t, CUE.speed0, CUE.speed1);                                // the speed arrow (the spine says "1 km a second")
  const tn = tanAt(th), tip = add(mp, tn, 8), back = add(tip, tn, -1.6), sd = [-tn[2] * 0.9, 0, tn[0] * 0.9];
  vArrow[0].seg(add(mp, tn, PH.r_moon * 2), tip).set({ opacity: ov }); vArrow[1].seg(tip, add(back, sd)).set({ opacity: ov }); vArrow[2].seg(tip, add(back, sd, -1)).set({ opacity: ov });
  S["moon-v"] = tip;

  // change: gravity off: a ghost Moon flies on along the tangent from where it was at "off"; back on: the pull
  const tauOff = CLK.moon.tau(CUE.off), thOff = thAt(tauOff), pOff = onOrbit(thOff);
  const gPos = add(pOff, tanAt(thOff), V * Math.max(0, tau - tauOff));
  const og = t >= CUE.off ? winOp(t, CUE.off, CUE.back + 0.6, 0.3) : 0;
  freePath.seg(pOff, gPos).set({ opacity: og });
  const cb = { e1: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).toArray(), e2: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).toArray() };
  ghostMoon.arc({ center: gPos, r: Math.max(PH.r_moon * 3, 0.9), ...cb }).set({ opacity: og });
  S.free = gPos;
  const op = winOp(t, CUE.back, B.why.t0, 0.3), toE = norm(mp.map((v) => -v)), pt = add(mp, toE, 9), pb = add(pt, toE, -1.6), ps = [-toE[2] * 0.9, 0, toE[0] * 0.9];
  pull[0].seg(add(mp, toE, PH.r_moon * 2), pt).set({ opacity: op }); pull[1].seg(pt, add(pb, ps)).set({ opacity: op }); pull[2].seg(pt, add(pb, ps, -1)).set({ opacity: op });
  S.pull = add(mp, toE, 5);

  // why: the apple on Earth's surface toward the Moon, the ruler of 60 Earth radii, the pull shrinking along it
  const ow = winOp(t, CUE.apple, B.whoa.t0, 0.4), ap = dirM.map((v) => v * PH.r_earth * 1.02);
  apple.set({ center: ap, camera, opacity: ow });
  S.apple = add(ap, [0, 0.6, 0]);
  const orl = winOp(t, CUE.ruler, B.whoa.t0, 0.4), up = [0, 1.6, 0];
  ruler.seg(add([0, 0, 0], up), add(dirM.map((v) => v * R), up)).set({ opacity: orl });
  ticks.forEach((k, i) => { const x = dirM.map((v) => v * PH.r_earth * i * 5); k.seg(add(x, [0, 1.0, 0]), add(x, [0, 2.2, 0])).set({ opacity: orl * (i % 2 ? 0.55 : 1) }); });
  S.ruler = add(dirM.map((v) => v * R * 0.55), [0, 2.4, 0]);
  // the pull, slid out from the apple to the Moon as "thirty-six hundred times weaker" is said: length ∝ 1/r²
  const u = E.inout2(seg(t, CUE.ruler, CUE.weak + 0.6)), rr = PH.r_earth + (R - PH.r_earth) * u, len = 6 * (PH.r_earth / rr) ** 2;
  const pw = winOp(t, CUE.apple, B.whoa.t0, 0.4) * (len > 0.02 ? 1 : 0.0);
  if (t >= CUE.apple && t < B.whoa.t0 + 0.5) {
    const base = dirM.map((v) => v * (rr + 0.05)), tipW = add(base, dirM, -len), hb = Math.min(0.9, len * 0.35);
    pull[0].seg(base, tipW).set({ opacity: pw }); pull[1].seg(tipW, add(add(tipW, dirM, hb), [0, hb * 0.6, 0])).set({ opacity: pw }); pull[2].seg(tipW, add(add(tipW, dirM, hb), [0, -hb * 0.6, 0])).set({ opacity: pw });
  }

  // whoa (and frame 0): the straight line, the ghost where it would be, the gap ×1,000,000
  const om = isHook ? 1 : winOp(t, CUE.min0, B.takeaway.t0, 0.4);
  tangent.seg(add(F.p0, tanAt(F.th0), -0.9), add(F.p0, tanAt(F.th0), 1.1)).set({ opacity: om });
  gap.seg(F.g, add(F.drawn, norm(F.g.map((v, i) => v - F.drawn[i])), PH.r_moon)).set({ opacity: dt > 2 ? om : 0 });
  ghostAt.arc({ center: F.g, r: PH.r_moon, ...cb }).set({ opacity: om * 0.9 });
  S.ghost = add(F.p0, tanAt(F.th0), 0.85); S.gap = F.g.map((v, i) => (v + F.drawn[i]) / 2);
  // takeaway: the fall all the way round: a dozen short straight lines, each leaving the orbit
  tanTicks.forEach((k, i) => { const a = (i / 12) * 2 * Math.PI, p = onOrbit(a); k.seg(p, add(p, tanAt(a), 13)).set({ opacity: 0.9 * winOp(t, B.takeaway.t0 + 0.6 + i * 0.08, FILM.endCard, 0.3) }); });
  orbitRing.set({ opacity: 1 });
  lightRing.set({ opacity: fadeIn(t, CUE.ring, 0.6) * (t < FILM.endCard + 0.6 ? 1 : 0) });
  S.ring = onOrbit(th + 2.4, R + 1.6);
  // the markers: 26 px across wherever the body is smaller than that on screen
  const pxW = (p) => (2 * camera.position.distanceTo(new THREE.Vector3(...p)) * Math.tan((camera.fov * Math.PI) / 360)) / H;
  const mr = (p, r) => Math.max(r * 1.6, 13 * pxW(p));
  const showMark = (p, r) => (13 * pxW(p) > r * 1.6 ? 1 : 0);
  markM.arc({ center: mp, r: mr(mp, PH.r_moon), ...cb }).set({ opacity: 0.85 * showMark(mp, PH.r_moon) });
  markE.arc({ center: [0, 0, 0], r: mr([0, 0, 0], PH.r_earth), ...cb }).set({ opacity: 0.85 * showMark([0, 0, 0], PH.r_earth) });

  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1, bandGain: 1 });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
