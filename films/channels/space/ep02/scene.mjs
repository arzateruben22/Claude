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
// "comet cloud: theory", "Voyager isn't headed there" (also in the hook, which draws the lane), "at today's
// distance", "light sped up" (while a pulse runs the lane to Proxima).
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
const PXS = Math.min(W, H) / 540;                                           // beacon sizes are render pixels: kept at the reviewed draft's size (540 wide) at every resolution
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.5, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 24, threshold: 0.9, bloom: 0.55 });   // 24 sub-frames: the comet points streak smoothly in the jump
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
const E0 = [0.6, 0, -0.8];                                                    // Earth's direction at launch (in the ecliptic): Voyager starts right of the Sun, clear of its glow
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
// the ice and teal tokens' linear solves have a negative red channel: clamped, a glow doesn't subtract red
const pos = (c) => c.map((v) => Math.max(0, v));
const C = { orbit: line("lilac", 0.55), trail: line("ice", 0.8), ghost: line("ice", 0.82), teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3),
  dim: line("text-2", 0.8), hp: line("text-2", 0.55) };

// ── the set ─────────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 23 });
scene.add(sky.group);
const G = { solar: new THREE.Group(), oort: new THREE.Group(), local: new THREE.Group() };
Object.values(G).forEach((g) => scene.add(g));
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };

// the Sun: one beacon at the scene origin (every rung is centred on it), white with a cool fringe, bloomed (the text
// token's solve, blue 11.6, fell off to a royal-blue orb)
const sun = createBeacon({ color: [2.3, 2.45, 3.0], px: 30 * PXS, core: 0.22 });
scene.add(sun.mesh);

// solar rung (1 unit = 1 AU): the planets' orbits, Voyager, its trail, the heliopause, the signal
const orbits = PH.planets.map(([, r]) => ring({ color: C.orbit, width: 2.6, opacity: 1 }).arc({ r, ...XZ }));
const NTRAIL = PH.ys.length - 1;
const trail = Array.from({ length: NTRAIL }, (_, i) => segment({ color: C.trail, width: 3, opacity: 0, fade: [0.55 + 0.45 * i / NTRAIL, 0.55 + 0.45 * (i + 1) / NTRAIL] }));
const VOY = { color: [1.2, 1.65, 2.9], px: 24 * PXS, core: 0.32 };   // pale ice, and big enough to win its frames (the ice solve halos ultramarine)
const voy = createBeacon(VOY);
const hpShell = shell({ color: C.hp, opacity: 0, power: 3.2 });
const hpTick = segment({ color: line("ice", 0.82), width: 5, opacity: 0 });   // under the bloom knee: pale ice, not a royal-blue halo
const hpRim = ring({ color: line("ice", 0.6), width: 2.6, opacity: 0 });   // ice, not teal: a boundary, not light
const front1 = ring({ color: C.tealHi, width: 4, opacity: 0 }), frontC = ring({ color: C.tealHi, width: 4, opacity: 0 }), front2 = ring({ color: C.tealHi, width: 4, opacity: 0 });
const ldRing = ring({ color: C.teal, width: 2.6, opacity: 0 });
G.solar.add(...orbits.map((o) => o.mesh), ...trail.map((s) => s.mesh), voy.mesh, hpShell.mesh, hpTick.mesh, hpRim.mesh, front1.mesh, frontC.mesh, front2.mesh, ldRing.mesh);
const solarProbe = probes(G.solar, 2);

// oort rung (1 unit = 1 AU): the comet cloud (a theory, badged) and the dashed road to it
const oort = createComets({ n: 9000, r0: PH.r_oort0, r1: PH.r_oort1, seed: 7, color: [0.85, 0.95, 1.2] });   // sparse: a cloud with a rim, not more stars
const ghost = segment({ color: C.ghost, width: 5, opacity: 0, dash: 0.03, duty: 0.7 });   // thick and mostly drawn: it reads over the comet points
const deep = segment({ color: line("ice", 0.75), width: 4.2, opacity: 0, dash: 0.02, duty: 0.6 });   // on into the cloud ("thirty thousand more")
const oortRim = shell({ color: line("ice", 0.6), opacity: 0, power: 2.2 });
const voyO = createBeacon(VOY);   // Voyager today, at the comet cloud's scale
G.oort.add(oort.group, ghost.mesh, deep.mesh, oortRim.mesh, voyO.mesh);

// local rung (1 unit = 0.01 light-year): the speck (one light-day), Proxima, the lane, the readout ring
const LU = FILM.ladder.units.local, AU = PH.au;
const speck = ring({ color: C.teal, width: 2.6, opacity: 1 });
const speckDot = createBeacon({ color: pos(hdr("teal", 1.1)), px: 9 * PXS, core: 0.45 });
const prox = createBeacon({ color: hdr("lemon", 2.0), px: 44 * PXS, core: 0.24 });
const lane = segment({ color: C.teal, width: 3.2, opacity: 0, dash: 0.02, duty: 0.55 });   // the road to Proxima, dashed
const laneLit = segment({ color: C.tealHi, width: 4, opacity: 0 });                    // the part light (or Voyager) has covered
const pulse = createBeacon({ color: pos(hdr("teal", 2.2)), px: 26 * PXS, core: 0.4 });   // light running the lane: the whoa's one motion
const pxRing = ring({ color: C.teal, width: 2.8, opacity: 0 });
G.local.add(speck.mesh, speckDot.mesh, prox.mesh, lane.mesh, laneLit.mesh, pulse.mesh, pxRing.mesh);

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
  hours: (c) => ({ value: (t) => Math.max(0, CLK.signal.tau(t) / 3600 - c.off), fmt: (v) => `${Math.floor(v + 1e-3)} h`, lit: (v) => v >= c.lit - 1e-3, minCh: 2 }),
};
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at };
  if (c.fmt === "year") Object.assign(o, FMT.year);
  else if (c.fmt === "hours") Object.assign(o, FMT.hours(c));
  else Object.assign(o, { value: () => 0, fmt: () => c.text, lit: () => true });
  const el = hud.counter(c.id, o);
  el.classList.add(c.read ? "lm-read" : "lm-clock");
  // the spine and the readout sit on the caption plate's face: fronts, rings and the lane pass behind the number
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 3vmin)" });
  if (c.fmt === "text" && c.text.length > 12) { const v = el.querySelector(".v"); if (v) v.style.fontSize = "5.5vmin"; }   // "4 years, 3 months" stays inside the safe box
  if (c.size) { const v = el.querySelector(".v"); if (v) v.style.fontSize = c.size; }   // a value set smaller in compile.py (≈75,000: the lane passes its plate)
}
for (const p of FILM.pills) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: at(L.anchor), t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");                                    // the end card's footnote: small and quiet
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0" });
const fo = endEl.querySelector(".fo");
if (fo) fo.style.marginTop = "1.8vmin";                                      // the pill sits inside the ring
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";                                   // the title stays inside the end ring
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d * 0.8)));
const LBL = Object.fromEntries(FILM.labels.map((l) => [l.id, l]));
const B0 = Object.fromEntries(FILM.beats.map((b) => [b.id, b.t0]));
const cAU = PH.c_km / AU;                                                    // light, AU per scene second

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;   // a frame's motion blur never blends two shots across a cut
  const st = stage(t), shot = st.name;
  rig.place(camera, shot, t);
  const view = ladder.apply(shot === "hook" ? VIEW_END : dolly(t));
  const aS = view.alpha.solar, aO = view.alpha.oort, aL = view.alpha.local;
  const toS = (id, p) => ladder.toScene(id, p, view);

  // the Sun
  // it steps back while Voyager is the subject (from its name until its signal leaves; the 2012 crossing), and through
  // the whoa once the comet cloud has collapsed onto it, so Proxima wins. Nothing of the picture sits under the end card
  // (Sun, Proxima, speck): it steps back just before the cut, and the loop's first frame brings it all back at once
  const sunDim = shot === "space" ? Math.max(0.45 * winOp(t, CUE.voy, CUE.sig - 0.5, 0.6), 0.45 * winOp(t, B0.why, CUE.pull[0], 0.6), 0.5 * winOp(t, CUE.jump[0] + 0.8, CUE.takeaway, 0.6)) : 0;
  const offCard = 1 - fadeIn(t, FILM.endCard - 0.35, 0.3);
  sun.set({ center: [0, 0, 0], camera, opacity: (1 - sunDim) * offCard });
  S.sun = [0, 0, 0];

  // ── solar rung ──
  const y = shot === "hook" ? PH.y_now : yearAt(t), pv = voyAt(y);
  orbits.forEach((o) => o.set({ opacity: aS }));
  for (let i = 0; i < NTRAIL; i++) {
    const ya = PH.ys[i], yb = Math.min(PH.ys[i + 1], y);
    if (ya >= y || aS <= 1e-4) { trail[i].set({ opacity: 0 }); continue; }
    trail[i].seg(voyAt(ya), voyAt(yb)).set({ opacity: aS * (1 - 0.65 * fadeIn(t, B0.change, 0.8)) });   // the flight steps back once it's told
  }
  voy.set({ center: pv, camera, opacity: aS * (y > PH.y0 + 0.01 || t >= CUE.voy ? 1 : 0) });   // named at its launch spot, then flies
  const g0 = voyAt(PH.y_now);
  S.voy = aO > aS ? toS("oort", g0) : toS("solar", pv);                      // the label follows Voyager onto the comet-cloud rung
  const nep = PH.planets[4][1], an = 1.75;   // on the orbit's back arc, inside the frame
  S.neptune = toS("solar", [nep * Math.cos(an), 0, -nep * Math.sin(an)]);
  // the heliopause: a faint shell, and a tick across the path where Voyager crossed it (2012)
  // (rings that mean "this far from the Sun" are drawn as circles on the screen, through the point as seen)
  const bS0 = screenBasis(), fw = new THREE.Vector3(); camera.getWorldDirection(fw);
  const seen = (p) => { const d = p[0] * fw.x + p[1] * fw.y + p[2] * fw.z; return Math.hypot(p[0] - d * fw.x, p[1] - d * fw.y, p[2] - d * fw.z); };
  // ... at the point's depth: Voyager is about 110 AU farther from the lens than the Sun, so it projects about 6% closer
  // to it; a circle in the Sun's plane passes through a point p as seen at seen(p) · persp(p)
  const camD = -camera.position.dot(fw), persp = (p) => { const q = toS("solar", p); return camD / (camD + q[0] * fw.x + q[1] * fw.y + q[2] * fw.z); };
  const hpOp = aS * fadeIn(t, CUE.hp, 0.8) * (1 - fadeIn(t, CUE.pull[0], 0.6));   // it leaves with the pull-back
  const php = voyAt(PH.y_hp), nrm = norm([-VDIR[1], VDIR[0], 0]), rhp = seen(php) * persp(php);
  hpShell.set({ center: [0, 0, 0], r: rhp, opacity: 0.3 * hpOp });                 // one boundary: the shell's edge is the rim
  hpRim.arc({ center: [0, 0, 0], r: rhp, ...bS0 }).set({ opacity: 0.8 * hpOp });
  hpTick.seg(php.map((v, i) => v - nrm[i] * 22), php.map((v, i) => v + nrm[i] * 22)).set({ opacity: hpOp });
  // the light: Voyager's signal home (a day), then the command out (a day) and the answer back (a day). At this
  // scale Earth sits on the Sun. Fronts are screen circles (so a light-day looks like one), scaled by Voyager as seen.
  const ts = CLK.signal.tau(t), rv = Math.hypot(pv[0], pv[1], pv[2]), rsv = seen(pv), k2s = rsv / rv;
  const pvS = (() => { const d = pv[0] * fw.x + pv[1] * fw.y + pv[2] * fw.z; return [pv[0] - d * fw.x, pv[1] - d * fw.y, pv[2] - d * fw.z]; })();
  const dS = norm(pvS), bW = { e1: dS.map((v) => -v), e2: norm([dS[1] * fw.z - dS[2] * fw.y, dS[2] * fw.x - dS[0] * fw.z, dS[0] * fw.y - dS[1] * fw.x]) };
  const bE = { e1: dS, e2: bW.e2 };
  const leg = (k) => Math.min(rv, Math.max(0, cAU * (ts - 86400 * k)));       // distance covered on leg k (AU)
  const live = (r) => r > 0.5 && r < rv - 1e-6;
  const r1 = leg(0), rc = leg(1), r2 = leg(2);
  const on1 = t >= CUE.sig && t < CUE.arr1 + 0.2, onC = t >= CUE.cmd && t < CUE.ans + 0.2, on2 = t >= CUE.ans && t < CUE.arr2 + 0.2;
  front1.arc({ center: pv, r: Math.max(r1 * k2s, 0.01), a0: -0.9, a1: 0.9, ...bW }).set({ opacity: on1 && live(r1) ? aS : 0 });
  frontC.arc({ center: [0, 0, 0], r: Math.max(rc * k2s * persp(pv.map((v) => v * rc / rv)), 0.01), a0: -0.6, a1: 0.6, ...bE }).set({ opacity: onC && live(rc) ? aS : 0 });   // stops on Voyager's dot, short of its name
  front2.arc({ center: pv, r: Math.max(r2 * k2s, 0.01), a0: -0.9, a1: 0.9, ...bW }).set({ opacity: on2 && live(r2) ? aS : 0 });
  const along = (u) => toS("solar", pv.map((v) => v * u));
  S.front1 = along(1 - r1 / rv); S.frontc = along(rc / rv); S.front2 = along(1 - r2 / rv);
  // the light-day: drawn as Voyager "crosses a line", around Earth (the Sun) through Voyager as seen; it leaves with the change
  const ldOp = aS * 0.85 * winOp(t, CUE.line, B0.why, 0.6);
  const rld = rsv * persp(pv);
  ldRing.arc({ center: [0, 0, 0], r: rld, ...bS0 }).set({ opacity: ldOp });
  S.ldring = toS("solar", [0, 1, 2].map((j) => rld * (bS0.e1[j] * Math.cos(1.62) + bS0.e2[j] * Math.sin(1.62))));   // its top, just left of Voyager: the name sits over it
  const pr = on1 && live(r1) ? pv.map((v) => v * (1 - r1 / rv)) : onC && live(rc) ? pv.map((v) => v * rc / rv) : on2 && live(r2) ? pv.map((v) => v * (1 - r2 / rv)) : null;
  solarProbe([pr, null]);

  // ── oort rung ──
  // the cloud is a theory (badged while it's on screen): it comes with the pull-back, steps back while the road to it
  // is told (so the road reads over its points), and its points are gone in the jump's first 0.9 s, before they can
  // flash white on the Sun; never in the hook or the end, so the loop matches
  const thin = 1 - 0.4 * fadeIn(t, CUE.ghost, 0.6) * (1 - E.inout2(seg(t, CUE.deep, CUE.deep + 0.6)));   // back smoothly: no pump
  const cl = shot === "space" ? 1 - E.inout2(seg(t, CUE.jump[0], CUE.jump[0] + 0.9)) : 0;
  oort.set({ gain: cl * thin });
  // Voyager's road to the cloud, drawn on the screen so it ends on the cloud's rim as seen, then on into it
  const gs = (() => { const d = g0[0] * fw.x + g0[1] * fw.y + g0[2] * fw.z; return norm([g0[0] - d * fw.x, g0[1] - d * fw.y, g0[2] - d * fw.z]); })();
  const g1 = gs.map((v) => v * PH.r_oort0);
  ghost.seg(g0, g1).set({ opacity: aO * fadeIn(t, CUE.ghost, 0.6) });
  // "thirty thousand more": the road grows in log space from the rim to the cloud's far edge (off the frame in about
  // 0.5 s, and on), so it reads 100× the road to the cloud, not a second road of the same length
  const rD = PH.r_oort0 * Math.pow(PH.r_oort1 / PH.r_oort0, E.inout2(seg(t, CUE.deep, CUE.deep + 1.6)));
  deep.seg(g1, gs.map((v) => v * rD)).set({ opacity: aO * fadeIn(t, CUE.deep, 0.3) * (1 - fadeIn(t, CUE.jump[0], 0.5)) });
  voyO.set({ center: g0, camera, opacity: aO * (1 - fadeIn(t, CUE.jump[0], 0.4)) });
  // a faint edge, not a glass bubble; it outlives the points in the jump (a little brighter for 0.8 s), so the cloud is
  // seen shrinking to the speck, not fading to an empty frame, and is gone 1.25 s in, before Proxima arrives
  oortRim.set({ center: [0, 0, 0], r: PH.r_oort0, opacity: aO * (shot === "space" ? 0.5 + 0.3 * winOp(t, CUE.jump[0], CUE.jump[0] + 0.8, 0.2) : 0) * (1 - E.inout2(seg(t, CUE.jump[0] + 0.8, CUE.jump[0] + 1.25))) });
  S.ghost = toS("oort", g0.map((v, i) => (v + g1[i]) / 2));
  const ao = 1.85;   // up and left of the road's crossing, so the name doesn't sit on the road
  S.oort = toS("oort", [PH.r_oort0 * 1.05 * Math.cos(ao), PH.r_oort0 * 1.05 * Math.sin(ao), 0]);

  // ── local rung ──
  // the speck: at least 30 px in radius (clear of a label's dot and the Sun's core), so it reads as a ring around the
  // Sun; the rung is drawn at kL scene units per local unit, so the pixel floor is divided by kL (a mark, badged)
  const bS = screenBasis(), pxU = (2 * Math.tan((camera.fov * D2R) / 2) * camera.position.length()) / H;   // scene units per pixel at the Sun
  const kL = LU / view.scale, rS = Math.max(LD_L, 30 * S1 * pxU / kL);
  const bump = t >= CUE.day ? 1 - E.out3(seg(t, CUE.day, CUE.day + 0.6)) : 0;   // a ping on the readout's "one day"
  speck.arc({ center: [0, 0, 0], r: rS, ...bS }).set({ opacity: aL * offCard, width: 2.6 + 2.4 * bump });
  speckDot.set({ center: [0, 0, 0], camera, opacity: aL * offCard * (shot === "hook" || t >= CUE.speck ? 1 : 0.6) });
  // its labels point at the rim's left, clear of the lane (in the hook its upper left: the pill sits above the two notes)
  const aR = shot === "hook" ? 2.0 : 2.9;
  S.speck = toS("local", [0, 1, 2].map((j) => rS * (bS.e1[j] * Math.cos(aR) + bS.e2[j] * Math.sin(aR))));
  // Proxima fades in below the top-right notes in the jump (not through them), flares once (lemon) as the first pulse
  // reaches it, and steps back with the Sun before the end card
  const pIn = shot === "space" ? fadeIn(t, CUE.jump[1] - 0.5, 0.3) : 1, arr = CUE.lane + CUE.run[0];
  const flare = shot === "space" ? Math.min(fadeIn(t, arr - 0.05, 0.2), 1 - E.inout2(seg(t, arr + 0.15, arr + 0.75))) : 0;
  prox.set({ center: PROX_L, camera, intensity: 1 + 0.6 * flare, opacity: aL * pIn * offCard });
  S.prox = toS("local", PROX_L);
  // the lane, from the speck's rim: named on "fifteen hundred" (it wins: full strength, a pulse of light runs it); steps
  // back for the readout
  const rp = Math.hypot(...PROX_L), u0 = Math.max(0.04, rS / rp), onLane = (u) => PROX_L.map((v) => v * u);
  const named = shot === "hook" ? 1 : fadeIn(t, CUE.lane, 0.6);
  const offEnd = 1 - fadeIn(t, FILM.endCard - 0.3, 0.5);                   // nothing of the readout under the end card
  const laneOp = named * (shot === "hook" ? 1 : (1 - 0.65 * fadeIn(t, CUE.pxring, 0.8)) * offEnd);   // full strength in the hook: the payoff
  lane.seg(onLane(u0), onLane(0.94)).set({ opacity: aL * laneOp });
  // a pulse of light runs the lane on "fifteen hundred" (the whoa), and again, quicker, on the takeaway's "of fifteen
  // hundred" (light sped up: badged while each runs); the second's lit lane is gone before the readout
  const [R1, R2] = CUE.run;
  const run1 = E.inout2(seg(t, CUE.lane, CUE.lane + R1)), run2 = E.inout2(seg(t, CUE.lane2, CUE.lane2 + R2));
  const run = shot === "space" ? (t < CUE.lane2 ? run1 : run2) : 0, uR = u0 + (0.94 - u0) * run;
  pulse.set({ center: onLane(uR), camera, opacity: aL * (run > 0 && run < 1 ? 1 : 0) });
  const litOff = t < CUE.lane2 ? fadeIn(t, CUE.lane + R1 + 0.2, 0.8) : fadeIn(t, CUE.lane2 + R2, 0.5);
  laneLit.seg(onLane(u0), onLane(uR)).set({ opacity: aL * (run > 0.002 ? 0.9 * (1 - litOff) : 0) });
  S.lane = toS("local", onLane(0.72));
  const bp = faceOn(PROX_L);
  pxRing.arc({ center: [0, 0, 0], r: rp, ...bp }).set({ opacity: aL * fadeIn(t, CUE.pxring, 0.8) * offEnd });
  S.pxring = toS("local", [0, 1, 2].map((j) => rp * (bp.e1[j] * Math.cos(0.7) + bp.e2[j] * Math.sin(0.7))));

  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1, bandGain: 1 });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
