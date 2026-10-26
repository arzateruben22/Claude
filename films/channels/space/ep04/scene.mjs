import * as THREE from "three";
// Light Minute No. 004, "The falling Moon" (films/channels/space/ep04). The picture as a pure function of t.
//
// One shot, true scale (1 unit = 10,000 km: Earth 1.27 units across, the Moon 38.44 units out). Frame 0 is the payoff:
// the Moon a minute after leaving its straight line, the gap drawn a million times larger. Then the diagram from
// above (thirty Earths in a row reach the Moon; its speed), gravity switched off (the Moon flies on along its straight
// line) and back on (the pull toward Earth bends it back), a turn to the side for Newton's test (an apple on Earth's
// surface, the Moon 60 Earth radii out, the pull shrinking 3,600 times along the way), the whoa's minute (the Moon
// falls 4.9 m below its straight line, drawn ×1,000,000, beside an apple's first second), the takeaway (the Moon runs on
// under a fan of the straight lines it keeps falling from) and the readout's light-time ring. The end card pushes back
// into frame 0.
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
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 24, threshold: 0.9, bloom: 0.55 });
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
const TAU_MIN0 = CLK.moon.tau(CUE.min0), TAU_DROP = CLK.moon.tau(CUE.drop);

// ── the set ─────────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 41 });
scene.add(sky.group);
const SUN = norm([0.55, 0.65, 0.5]);                                         // high enough that the camera (from above) sees a lit Moon
const earth = createPlanet({ radius: PH.r_earth, surface: earthSurface({ width: W >= 1000 ? 1024 : 512 }), tilt: 23.44, rimDay: 0.5, rimNight: 0.45, segments: 64 });
const moon = createPlanet({ radius: PH.r_moon, surface: moonSurface({ width: W >= 1000 ? 2048 : 512, seed: 9 }), rimDay: 0, rimNight: 0.12, segments: 64 });   // airless: no glowing rim
scene.add(earth.group, moon.group);
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };
// the ice token's linear solve has a negative red channel: clamped, a dimmed or bloomed halo stays pale ice (not royal blue)
const pos = (c) => c.map((v) => Math.max(0, v));
// a beacon's halo is that light dimmed: clamped and mixed toward white, it stays pale (not royal or pure blue)
const pale = (c) => pos(c).map((v) => 0.35 + 0.65 * v);
const C = { orbit: line("lilac", 0.8), lilac: line("lilac", 0.8), lilacHi: line("lilac", 1), teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3), ice: line("ice", 0.6), iceHi: line("ice", 0.95), ghost: line("ice", 0.75) };
const orbitRing = ring({ color: C.orbit, width: 3, opacity: 1 }).arc({ r: R, ...XZ });
const row = Array.from({ length: 30 }, () => ring({ color: C.iceHi, width: 2.8, opacity: 0 }));   // bright enough to read as rings, not a dotted line
const vArrow = [0, 1, 2].map(() => segment({ color: pos(C.iceHi), width: 4, opacity: 0 }));   // speed: ice (lilac is gravity)
// gravity off: the straight line, a trail behind the flying Moon and dashed ahead of it (dash is per unit: 3.3 units a
// dash, 2 of them lit); the rest of the dash the Moon is in is a piece of its own
const FREE_DASH = 0.3, FREE_ON = 0.6, freePath = segment({ color: C.tealHi, width: 4, opacity: 0, dash: FREE_DASH, duty: FREE_ON }), trail = segment({ color: C.tealHi, width: 4, opacity: 0, fade: [0.3, 1] });
const freeHead = segment({ color: C.tealHi, width: 4, opacity: 0 });
const ghostMoon = ring({ color: C.ghost, width: 3, opacity: 0 });
const pull = [0, 1, 2].map(() => segment({ color: C.lilac, width: 4.5, opacity: 0 }));
// Newton's test: the pull's strength along the Earth–Moon line, hung below it (height ∝ 1/r²), drawn out from the apple
const NPROF = 40, prof = Array.from({ length: NPROF }, () => segment({ color: C.lilac, width: 3.4, opacity: 0 }));
const ruler = segment({ color: C.lilac, width: 3, opacity: 0 });
const reach = segment({ color: C.lilac, width: 3, opacity: 0, fade: [0.35, 1] });   // "…reaches the Moon": brightest at its leading end
const ticks = Array.from({ length: 13 }, () => segment({ color: C.lilac, width: 3, opacity: 0 }));
const tangent = segment({ color: C.teal, width: 2.6, opacity: 0, dash: 0.25, duty: 0.5 });
const tangent2 = segment({ color: C.teal, width: 2.6, opacity: 0, dash: 0.25, duty: 0.5 });   // the change's, at the moving Moon (tangent is frame 0's)
// the two falls, the Moon's minute and the apple's second: one colour (gravity), one weight, the same length
const gap = segment({ color: C.lilacHi, width: 3.6, opacity: 0, depthTest: false });   // centre to centre, over the Moon's disc
const ghostAt = ring({ color: C.ghost, width: 3, opacity: 0, dash: 24, duty: 0.5 });
const dropLine = segment({ color: C.lilacHi, width: 3.6, opacity: 0 });   // the apple's first second, beside the Moon's minute
const lightRing = ring({ color: C.tealHi, width: 3.4, opacity: 0 }).arc({ r: R + 1.6, ...XZ });
const tanTicks = Array.from({ length: 12 }, () => segment({ color: C.teal, width: 4.5, opacity: 0, fade: [1, 0.2] }));
// hollow marker rings of a fixed size in pixels round Earth and the Moon, so the true-scale bodies can be found in the diagrams (they claim no size)
const markM = ring({ color: C.ice, width: 2, opacity: 0 }), markE = ring({ color: C.ice, width: 2, opacity: 0 });
[markM, markE, orbitRing, ...row, ...vArrow, trail, freeHead, freePath, ghostMoon, ...pull, ...prof, reach, ruler, ...ticks, tangent, tangent2, gap, ghostAt, dropLine, lightRing, ...tanTicks].forEach((r) => scene.add(r.mesh));
const apple = createBeacon({ color: pale(hdr("ice", 1.1)), px: 14, core: 0.8 }), apple2 = createBeacon({ color: pale(hdr("ice", 1.1)), px: 16, core: 0.8 });
const moonGlow = createBeacon({ color: pale(hdr("ice", 1.2)), px: 14, core: 0.8 });   // gravity off: the flying Moon (its disc is a pixel)
scene.add(apple.mesh, apple2.mesh, moonGlow.mesh);

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
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0", textWrap: "balance" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";                                   // the title stays inside the end ring
const fo = endEl.querySelector(".fo");
if (fo) fo.style.marginTop = "1.8vmin";                                      // the pill sits inside the ring
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
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;   // a frame's motion blur never blends two shots across a cut
  const st = stage(t), shot = st.name;
  rig.place(camera, shot, t);
  const tau = CLK.moon.tau(t), th = thAt(tau);
  // the Moon: on its orbit, except in the hook (frame 0, the whoa's end state), with gravity off (on its straight line,
  // then drawn back onto the orbit) and in the whoa's minute (the fall magnified; back onto the orbit only once the
  // camera is well back, so it never "un-falls" in close-up)
  const inMin = t >= CUE.min0 && t < CUE.home1, isHook = t < B.normal.t0 || t > FILM.endCard + 1.6;   // the end card hands back frame 0
  const dt = isHook ? 60 : Math.min(60, Math.max(0, tau - TAU_MIN0));
  const F = fallState(dt);
  const tauOff = CLK.moon.tau(CUE.off), thOff = thAt(tauOff), pOff = onOrbit(thOff), tOff = tanAt(thOff);
  const sOff = (tt) => V * Math.max(0, CLK.moon.tau(tt) - tauOff);              // how far along its straight line it has flown
  const gAt = (tt) => add(pOff, tOff, sOff(tt));
  const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  let mp = onOrbit(th);
  if (isHook) mp = F.drawn;
  else if (t >= CUE.off && t < CUE.back) mp = gAt(t);
  else if (t >= CUE.back && t < CUE.back + 1.0) {
    // bent back, not slid: angle and radius ease together, so the Moon swoops forward onto its orbit (the angle
    // unwrapped first, so it never goes the long way round)
    const g = gAt(CUE.back), u = E.inout2(seg(t, CUE.back, CUE.back + 1.0)), ra = Math.hypot(g[0], g[2]);
    let aa = Math.atan2(-g[2], g[0]);
    aa += 2 * Math.PI * Math.round((th - aa) / (2 * Math.PI));
    mp = onOrbit(aa + (th - aa) * u, ra + (R - ra) * u);
  } else if (inMin) mp = t < CUE.home0 ? F.drawn : lerp3(F.drawn, onOrbit(th), E.inout2(seg(t, CUE.home0, CUE.home1)));
  moon.set({ center: mp, sunDir: SUN, sun: 1, spin: -th + Math.PI });               // tidally locked: the near side faces Earth
  earth.set({ center: [0, 0, 0], sunDir: SUN, sun: 1, spin: 0.9 + tau * 7.292e-5 });
  S.moon = add(mp, [0, PH.r_moon * 1.4, 0]); S.earth = [0, PH.r_earth * 1.3, 0];

  // normal: thirty Earths in a row reach the Moon; the speed arrow
  const dirM = norm(onOrbit(th));
  row.forEach((rg, k) => {
    const c = dirM.map((v) => v * PH.r_earth * (2 * k + 3));
    rg.arc({ center: c, r: PH.r_earth, ...XZ }).set({ opacity: winOp(t, CUE.row + k * 0.04, FILM.labels.find((l) => l.id === "l-30").t1, 0.3) });
  });
  S.row = dirM.map((v) => v * R * 0.32);                                     // on the row it names
  const ov = winOp(t, CUE.speed0, CUE.speed1);                                // the speed arrow (the spine says "1 km a second")
  const tn = tanAt(th), tip = add(mp, tn, 14), back = add(tip, tn, -2.4), sd = [-tn[2] * 1.2, 0, tn[0] * 1.2];
  vArrow[0].seg(add(mp, tn, PH.r_moon * 2), tip).set({ opacity: ov }); vArrow[1].seg(tip, add(back, sd)).set({ opacity: ov }); vArrow[2].seg(tip, add(back, sd, -1)).set({ opacity: ov });
  S["moon-v"] = tip;

  // change: gravity off: the Moon itself flies on along its straight line (lit, a trail behind it, the rest of the line
  // dashed ahead, the orbit faint); back on: the pull toward Earth, the Moon bent back onto its orbit (under the
  // thought-experiment note; the straight flight stays up meanwhile), then the straight line it now falls below
  const og = t >= CUE.off ? winOp(t, CUE.off, CUE.back + 0.6, 0.3) : 0, sNow = sOff(Math.min(t, CUE.back));
  const sDash = Math.floor(sNow * FREE_DASH) / FREE_DASH;                       // where the dash the Moon is in starts
  trail.seg(pOff, add(pOff, tOff, sNow)).set({ opacity: og });
  // ahead of it: the rest of that dash, then whole dashes from the next one on, so the dashes stay put and no stretch is
  // drawn twice (lines add: a dash over the trail flashed brighter behind the Moon at every dash, about 4 a second)
  freeHead.seg(add(pOff, tOff, sNow), add(pOff, tOff, Math.max(sNow, sDash + FREE_ON / FREE_DASH))).set({ opacity: og });
  freePath.seg(add(pOff, tOff, sDash + 1 / FREE_DASH), add(pOff, tOff, 48)).set({ opacity: og });
  moonGlow.set({ center: mp, camera, opacity: winOp(t, CUE.off, CUE.back + 1.0, 0.3) });
  // what the spine's "below its straight line" means; once the thought-experiment note has gone (it runs up into its corner)
  tangent2.seg(mp, add(mp, tanAt(th), 14)).set({ opacity: winOp(t, CUE.back + 1.3, B.why.t0, 0.4) });
  const cb = { e1: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).toArray(), e2: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).toArray() };
  ghostMoon.set({ opacity: 0 });
  S.free = add(pOff, tOff, 4);                                                 // early on the line: its label sits under it, behind the Moon
  const op = Math.max(winOp(t, CUE.back, B.why.t0, 0.3), winOp(t, CUE.settle, B.readout.t0, 0.4)), toE = norm(mp.map((v) => -v)), pt = add(mp, toE, 22), pb = add(pt, toE, -3.0), ps = [-toE[2] * 1.6, 0, toE[0] * 1.6];
  pull[0].seg(add(mp, toE, PH.r_moon * 2), pt).set({ opacity: op }); pull[1].seg(pt, add(pb, ps)).set({ opacity: op }); pull[2].seg(pt, add(pb, ps, -1)).set({ opacity: op });
  S.pull = add(mp, toE, 20);                                                    // at the arrow's head: the label names the pull, not its shaft

  // why: the apple just off Earth's surface toward the Moon, its pull (an arrow from outside, pointing at Earth's
  // centre), the ruler of 60 Earth radii above the line, and below it the pull's strength out to the Moon (∝ 1/r²),
  // drawn out from the apple as the ruler is read and complete on "weaker"; all gone before the swing into the whoa
  const ow = winOp(t, CUE.apple, CUE.weak + 0.6, 0.4), ap = dirM.map((v) => v * (PH.r_earth + 0.6));
  apple.set({ center: ap, camera, opacity: ow });
  S.apple = ap;
  // "…reaches the Moon": the pull's reach wiped along the line from the apple's arrow out to the Moon, gone before the ruler
  const uR = E.inout2(seg(t, CUE.reach, CUE.reach + 0.8));
  reach.seg(add(ap, dirM, 3.0), add(ap, dirM, 3.0 + (R - PH.r_earth - 3.6) * uR)).set({ opacity: uR > 0.01 ? winOp(t, CUE.reach, CUE.ruler - 0.4, 0.3) : 0 });
  const orl = winOp(t, CUE.ruler, CUE.weak + 0.6, 0.4), up = [0, 3.0, 0];
  ruler.seg(add([0, 0, 0], up), add(dirM.map((v) => v * R), up)).set({ opacity: orl });
  ticks.forEach((k, i) => { const x = dirM.map((v) => v * PH.r_earth * i * 5); k.seg(add(x, [0, 2.4, 0]), add(x, [0, 3.6, 0])).set({ opacity: orl * (i % 2 ? 0.55 : 1) }); });
  S.ruler = add(dirM.map((v) => v * R * 0.55), [0, 3.8, 0]);
  if (t >= CUE.apple && t < B.whoa.t0 + 0.5) {
    const tail = add(ap, dirM, 3.0), head = add(ap, dirM, 0.25), hb = 0.7;
    pull[0].seg(tail, head).set({ opacity: ow }); pull[1].seg(head, add(add(head, dirM, hb), [0, hb * 0.6, 0])).set({ opacity: ow }); pull[2].seg(head, add(add(head, dirM, hb), [0, -hb * 0.6, 0])).set({ opacity: ow });
  }
  const r0 = PH.r_earth + 0.6, HP = 8.0, prOf = (r) => add(dirM.map((v) => v * r), [0, -HP * (r0 / r) ** 2, 0]);
  const uP = E.inout2(seg(t, CUE.ruler, CUE.weak)), rU = r0 * Math.pow(R / r0, uP), opP = t >= CUE.ruler ? orl : 0;
  prof.forEach((sg, k) => {
    const ra = r0 * Math.pow(R / r0, k / NPROF), rb = Math.min(rU, r0 * Math.pow(R / r0, (k + 1) / NPROF));
    sg.seg(prOf(ra), prOf(Math.max(ra, rb))).set({ opacity: rb > ra ? opP : 0 });
  });
  S.prof = prOf(r0 * 1.6);

  // whoa (and frame 0): the straight line, the ghost where it would be, the gap ×1,000,000; under the end card they
  // step back, and come up again for the loop to frame 0
  const endK = E.out3(seg(t, FILM.endCard, FILM.endCard + 0.6)) * (1 - E.inout2(seg(t, FILM.dur - 0.8, FILM.dur - 0.1)));
  const om = (isHook ? 1 : winOp(t, CUE.min0, B.takeaway.t0, 0.4)) * (1 - 0.8 * endK);
  tangent.seg(add(F.p0, tanAt(F.th0), -0.9), add(F.p0, tanAt(F.th0), 1.1)).set({ opacity: om });
  gap.seg(F.g, F.drawn).set({ opacity: dt > 2 ? om : 0 });
  ghostAt.arc({ center: F.g, r: PH.r_moon, ...cb }).set({ opacity: om * 0.9 });
  // the gap runs centre to centre (the line through the ghost's centre to the Moon's), as the apple's drop runs
  // from the line to the apple, so the two 4.9 m falls are the same length on screen; its label sits at its middle
  S.ghost = add(F.p0, tanAt(F.th0), 0.85); S.gap = F.g.map((v, i) => (v + F.drawn[i]) / 2);
  // the apple beside it: 4.9 m in its first second, drawn at the same ×1,000,000 (the same length as the gap); its
  // second runs on the Moon's clock (×8: a blink beside the Moon's minute), so it waits on the line first
  const fdir = norm(F.drawn.map((v, i) => v - F.g[i]));
  const a0p = add(F.g, tanAt(F.th0), 0.5), ud = E.in2(clamp01(CLK.moon.tau(t) - TAU_DROP)), oa = isHook ? 0 : winOp(t, CUE.drop - 0.5, B.takeaway.t0 - 0.3, 0.3);
  const aNow = add(a0p, fdir, (PH.drop_1m * PH.mag) / 1000 / PH.u * ud);   // 4.9 m × 1,000,000 = 0.49 units
  apple2.set({ center: aNow, camera, opacity: oa });
  dropLine.seg(a0p, aNow).set({ opacity: ud > 0.02 ? oa : 0 });
  S.apple2 = aNow; S.apple2end = add(a0p, fdir, (PH.drop_1m * PH.mag) / 1000 / PH.u);   // where the apple lands: its label hangs below
  // takeaway: the straight lines the Moon keeps falling away from: a fan of them from its last dozen places on its
  // orbit (0.8° apart), moving on with it
  tanTicks.forEach((k, i) => { const a = th - (i * 0.8 * Math.PI) / 180, p = onOrbit(a); k.seg(p, add(p, tanAt(a), 13)).set({ opacity: 0.9 * winOp(t, CUE.settle + 0.1 + i * 0.08, B.readout.t0, 0.5) }); });
  // the orbit: faint while gravity is off; gone through the swing from the side view into the whoa (it would slice the
  // frame); dimmed under Newton's ruler and curve (lilac on lilac) and while its near arc sweeps up behind the caption in
  // the pull back; gone under the end card, back for the loop to frame 0
  const endOut = E.in3(seg(t, FILM.endCard - 0.3, FILM.endCard + 0.3)) * (1 - E.inout2(seg(t, FILM.dur - 0.8, FILM.dur - 0.1)));
  orbitRing.set({ opacity: (1 - 0.75 * winOp(t, CUE.off, CUE.back, 0.3)) * (1 - winOp(t, CUE.weak + 0.6, CUE.min0 - 0.2, 0.4))
    * (1 - 0.7 * winOp(t, CUE.ruler, CUE.weak + 0.6, 0.4)) * (1 - 0.7 * winOp(t, CUE.tk + 2.5, CUE.tk + 3.1, 0.2)) * (1 - endOut) });
  // the readout: light leaves Earth and reaches the Moon's distance in 1.3 s of film, its real speed (badged)
  const lr = PH.r_earth + (R + 1.6 - PH.r_earth) * clamp01((t - CUE.ring) / 1.3);
  lightRing.arc({ r: lr, ...XZ }).set({ opacity: (t >= CUE.ring ? 1 : 0) * (1 - E.in3(seg(t, FILM.endCard - 0.3, FILM.endCard + 0.3))) });
  S.ring = onOrbit(th + 2.4, R + 1.6);
  // the markers: 26 px across wherever the body is smaller than that on screen
  const pxW = (p) => (2 * camera.position.distanceTo(new THREE.Vector3(...p)) * Math.tan((camera.fov * Math.PI) / 360)) / H;
  const mr = (p, r) => Math.max(r * 1.6, 13 * pxW(p));
  const showMark = (p, r) => (13 * pxW(p) > r * 1.6 ? 1 : 0);
  // the readout: the Moon's marker swells as the light reaches its distance
  const hit = Math.exp(-(((t - (CUE.ring + 1.3 * (R - PH.r_earth) / (R + 1.6 - PH.r_earth))) / 0.2) ** 2));
  markM.arc({ center: mp, r: mr(mp, PH.r_moon) * (1 + 0.6 * hit), ...cb }).set({ opacity: Math.min(1, (0.85 + 0.15 * hit) * showMark(mp, PH.r_moon)) });
  markE.arc({ center: [0, 0, 0], r: mr([0, 0, 0], PH.r_earth), ...cb }).set({ opacity: 0.85 * showMark([0, 0, 0], PH.r_earth) });

  // the side view looks along the Milky Way's band: it is turned down there so the ruler and the orbit keep their contrast
  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1, bandGain: 1 - 0.65 * winOp(t, B.why.t0 + 1.0, B.whoa.t0, 1.0) });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
