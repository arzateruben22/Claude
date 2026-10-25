import * as THREE from "three";
// Light Minute No. 003, "Venus day" (films/channels/space/ep03). The picture as a pure function of t for the
// film kit's page: window.seek(t) sets the camera, the scene clocks, every object and the overlay from t alone,
// then makes exactly one renderer.render().
//
// One shot. A close view that follows Venus (the hook; the two old guesses played on its pin; the 1962 radar;
// the true turn, backwards, with the orbit paused) and the diagram (Earth's sunrises; the whoa, both clocks
// running and a teal tick on the orbit at every sunrise; the readout, with Venus and Earth lined up for the
// radar's round trip). The end card pushes back into the close view, so a replay loops to frame 0.
// Set: ../set (sky, star, planet, orbit rings via front.js, rig's poseAt, look, motif, beacon) plus
// ../set/venus.js (new: the cloud deck, an illustration). Kit: hud.js, clock.js, front.js.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { ring, segment } from "cinema/sci/front.js";
import { createSky } from "../set/sky.js";
import { createStar } from "../set/star.js";
import { createPlanet, earthSurface } from "../set/planet.js";
import { venusSurface } from "../set/venus.js";
import { createBeacon } from "../set/beacon.js";
import { poseAt } from "../set/rig.js";
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

// ── clocks (each starts at τ = 0 on frame 0) ───────────────────────────────
const WORDS = { fast: "{n}× faster", slow: "{n}× slower", freeze: null };
const CLK = Object.fromEntries(Object.entries(FILM.clk).map(([k, keys]) => [k, clock(keys, { words: WORDS })]));
const thV = (t) => PH.th_v0 + (2 * Math.PI * CLK.orbit.tau(t)) / PH.p_orb;
const thE = (t) => PH.th_e0 + (2 * Math.PI * CLK.orbit.tau(t)) / PH.p_earth;
const onOrbit = (r, th) => [r * Math.cos(th), 0, -r * Math.sin(th)];
const lerpA = (a, b, u) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * u; };
// the pin's angle (where "you" stand, measured like the orbit's angle): the truth, or the guess being played
const psiAt = (t) => {
  const truth = PH.psi0 - (2 * Math.PI * CLK.spin.tau(t)) / PH.p_rot;
  const g1 = truth + (2 * Math.PI * CLK.guess.tau(t)) / (23 * 3600);       // the Cassinis: one turn in about 23 hours, forwards
  const g2 = thV(t) + Math.PI;                                              // Schiaparelli: one face always to the Sun
  if (t < CUE.g1) return truth;
  if (t < CUE.g2) return lerpA(truth, g1, E.inout2(seg(t, CUE.g1, CUE.g1 + 0.4)));
  if (t < CUE.true) return lerpA(g1, g2, E.inout2(seg(t, CUE.g2, CUE.g2 + 0.6)));
  return lerpA(g2, truth, E.inout2(seg(t, CUE.true, CUE.true + 0.8)));
};

// ── the set ─────────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 31 });
scene.add(sky.group);
const sun = createStar({ radius: 1.6, intensity: 2.6, corona: 2.7 });
scene.add(sun.group);
const VR = 1.3, ER = 0.9;
const venus = createPlanet({ radius: VR, surface: venusSurface({ width: W >= 1000 ? 1024 : 512, seed: 3 }), tilt: -2.64, pin: 1, rimDay: 0.45, rimNight: 0.5, segments: 96 });
const earth = createPlanet({ radius: ER, surface: earthSurface({ width: 512 }), tilt: 23.44, rimDay: 0.5, rimNight: 0.4, segments: 48 });
scene.add(venus.group, earth.group);
const you = createBeacon({ color: hdr("teal", 1.2), px: 11, core: 0.5 });
scene.add(you.mesh);
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };
const C = { orbit: line("lilac", 0.45), lilac: line("lilac", 0.8), teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3) };
const orbV = ring({ color: C.orbit, width: 2, opacity: 1 }).arc({ r: PH.r_v, ...XZ });
const orbE = ring({ color: C.orbit, width: 2, opacity: 1 }).arc({ r: PH.r_e, ...XZ });
const ticks = FILM.sunrises.map(() => segment({ color: C.tealHi, width: 4, opacity: 0 }));
const beam = segment({ color: C.teal, width: 2.6, opacity: 0, dash: 2.2, duty: 0.5 });
const arrow = [ring({ color: C.lilac, width: 3.4, opacity: 0 }), segment({ color: C.lilac, width: 3.4, opacity: 0 }), segment({ color: C.lilac, width: 3.4, opacity: 0 })];
const lightRing = ring({ color: C.teal, width: 2.8, opacity: 0 }).arc({ r: PH.r_v + 0.25, ...XZ });
const echo = segment({ color: C.tealHi, width: 3.4, opacity: 0 });
[orbV, orbE, ...ticks, beam, ...arrow, lightRing, echo].forEach((r) => scene.add(r.mesh));

// ── the camera: rig.js's poseAt, with the target following Venus by FILM.follow's weight ──
const D2R = Math.PI / 180;
const followW = (t) => {
  const F = FILM.follow;
  let i = F.findIndex((p) => p[0] > t);
  if (i < 0) return F[F.length - 1][1];
  if (i === 0) return F[0][1];
  const [t0, w0] = F[i - 1], [t1, w1] = F[i];
  return w0 + (w1 - w0) * E.inout3(clamp01((t - t0) / (t1 - t0)));
};
const applyPose = (cam, P) => {                                              // rig.js's apply, with the target given
  const el = P.el * D2R, az = P.az * D2R, [tx, ty, tz] = P.target;
  cam.position.set(tx + P.dist * Math.cos(el) * Math.sin(az), ty + P.dist * Math.sin(el), tz + P.dist * Math.cos(el) * Math.cos(az));
  cam.fov = P.fov; cam.updateProjectionMatrix(); cam.up.set(0, 1, 0); cam.lookAt(tx, ty, tz);
  const tv = Math.tan((P.fov * D2R) / 2), th = tv * cam.aspect;
  cam.rotateY(Math.atan((P.fx - 0.5) * 2 * th)); cam.rotateX(Math.atan((P.fy - 0.5) * 2 * tv));
  cam.updateMatrixWorld();
};
const poseFor = (shot, t) => {
  const P = poseAt(FILM.cam[shot], t), w = followW(t), vp = onOrbit(PH.r_v, thV(t));
  P.target = P.target.map((v, j) => v + w * vp[j]);
  return P;
};
const tmpCam = new THREE.PerspectiveCamera(24, W / H, 0.5, 4000);

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

window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  applyPose(camera, poseFor(shot, t));
  const tv = thV(t), te = thE(t), vp = onOrbit(PH.r_v, tv), ep = onOrbit(PH.r_e, te);
  const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  sun.set({ tau: CLK.orbit.tau(t), on: true, camera, center: [0, 0, 0] });
  const psi = psiAt(t);
  venus.set({ center: vp, sunDir: norm(vp.map((v) => -v)), sun: 1, spin: psi - Math.PI });
  earth.set({ center: ep, sunDir: norm(ep.map((v) => -v)), sun: 1, spin: 2 * Math.PI * CLK.orbit.tau(t) / 86164 });
  const pinDir = [Math.cos(psi), 0, -Math.sin(psi)];
  const pinAt = vp.map((v, j) => v + pinDir[j] * VR * 1.01);
  you.set({ center: pinAt, camera });
  S.pin = vp.map((v, j) => v + pinDir[j] * VR * 1.15);
  S.venus = [vp[0], vp[1] + VR * 0.8, vp[2]]; S.earth = [ep[0], ep[1] + ER * 0.8, ep[2]]; S.sun = [0, 1.4, 0];
  // the orbits fade in the close view (they would cut through Venus)
  const wf = followW(t);
  orbV.set({ opacity: 1 - 0.85 * wf }); orbE.set({ opacity: 1 - 0.85 * wf });
  // the sunrise ticks: one across the orbit wherever Venus was at each sunrise
  FILM.sunrises.forEach((s, i) => {
    const a = onOrbit(PH.r_v - 0.9, s.th), b = onOrbit(PH.r_v + 0.9, s.th);
    ticks[i].seg(a, b).set({ opacity: t >= s.t && t < FILM.endCard + 0.6 ? fadeIn(t, s.t, 0.25) : 0 });
  });
  // the radar beam (1962): Earth to Venus, dashed
  beam.seg(ep, vp).set({ opacity: winOp(t, CUE.radar, CUE.true, 0.35) });
  S.beam = vp.map((v, j) => v + (ep[j] - v) * 0.12);
  // "backwards": an arc arrow around Venus's equator, pointing the way it turns (clockwise seen from north)
  const ra = VR * 1.45, a0 = psi + 0.5, a1 = psi - 1.2, ao = winOp(t, CUE.back, FILM.beats.find((b) => b.id === "whoa").t0, 0.35);
  const ex = { center: vp, ...XZ };
  arrow[0].arc({ r: ra, a0: a1, a1: a0, ...ex }).set({ opacity: ao });
  const tip = [vp[0] + ra * Math.cos(a1), 0, vp[2] - ra * Math.sin(a1)];
  const tan = [Math.sin(a1), 0, Math.cos(a1)];                              // the direction of travel (clockwise) at the tip
  const rad = [Math.cos(a1), 0, -Math.sin(a1)];
  arrow[1].seg(tip, tip.map((v, j) => v - tan[j] * 0.35 + rad[j] * 0.2)).set({ opacity: ao });
  arrow[2].seg(tip, tip.map((v, j) => v - tan[j] * 0.35 - rad[j] * 0.2)).set({ opacity: ao });
  S.arrow = [vp[0] + ra * Math.cos(psi - 0.35), 0, vp[2] - ra * Math.sin(psi - 0.35)];
  // the readout: Venus's light-time ring, then the radar's round trip (Venus and Earth lined up)
  lightRing.set({ opacity: fadeIn(t, CUE.ring, 0.6) * (1 - wf) });
  const ar = Math.PI * 0.8;
  S.ring = [(PH.r_v + 0.25) * Math.cos(ar), 0, -(PH.r_v + 0.25) * Math.sin(ar)];
  const d = norm(vp), e0 = vp.map((v, j) => v + d[j] * VR * 1.2), e1 = ep.map((v, j) => v - d[j] * ER * 1.2);
  echo.seg(e0, e1).set({ opacity: fadeIn(t, CUE.echo, 0.5) * (1 - wf) });
  S.echo = vp.map((v, j) => (v + ep[j]) / 2);

  sky.update(camera, { frameCam: (applyPose(tmpCam, poseFor(shot, tr)), tmpCam), starGain: 1, bandGain: 1 });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
