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
const venus = createPlanet({ radius: VR, surface: venusSurface({ width: W >= 1000 ? 2048 : 1024, seed: 3 }), tilt: -2.64, pin: 1, rimDay: 0.45, rimNight: 0.5, segments: 96 });
const earth = createPlanet({ radius: ER, surface: earthSurface({ width: 512 }), tilt: 23.44, rimDay: 0.5, rimNight: 0.8, segments: 48 });   // its night side still reads as a disc
scene.add(venus.group, earth.group);
const you = createBeacon({ color: hdr("teal", 1.2), px: 16, core: 0.5 });
scene.add(you.mesh);
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };
const C = { orbit: line("lilac", 0.75), lilac: line("lilac", 0.8), teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3) };
const orbV = ring({ color: C.orbit, width: 2, opacity: 1 }).arc({ r: PH.r_v, ...XZ });
const orbE = ring({ color: C.orbit, width: 2, opacity: 1 }).arc({ r: PH.r_e, ...XZ });
const ticks = FILM.sunrises.map(() => segment({ color: C.tealHi, width: 4, opacity: 0 }));
const beam = segment({ color: C.teal, width: 3.6, opacity: 0, dash: 2.2, duty: 0.5 });

const C_ARROW = line("ice", 0.95, 1.1);                                       // the turn is motion, not gravity: ice, not lilac
const arrow = [ring({ color: C_ARROW, width: 4.6, opacity: 0 }), segment({ color: C_ARROW, width: 4.6, opacity: 0 }), segment({ color: C_ARROW, width: 4.6, opacity: 0 })];
const lightRing = ring({ color: C.teal, width: 2.8, opacity: 0 }).arc({ r: PH.r_v + 0.25, ...XZ });
const echo = segment({ color: C.tealHi, width: 3.4, opacity: 0 });
const pulse = createBeacon({ color: hdr("teal", 1.5), px: 16, core: 0.4 });   // a radar ping, out and back
scene.add(pulse.mesh);
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
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "4vmin auto 0" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";                                   // the title stays inside the end ring
// a small horizon dial under the captions for the whoa: the Sun's place in the pin's sky (a diagram: the clouds hide it), crossing from the west
const dial = document.createElement("div");
const DW = 620 * S1, DH = 128 * S1, RX = 190 * S1, RY = 40 * S1,   // flat: the Sun at noon clears a two-line caption plate
      DCX = DW / 2, DCY = DH - 34 * S1;
Object.assign(dial.style, { position: "absolute", left: `${(W - DW) / 2}px`, top: `${0.672 * H}px`, width: `${DW}px`, height: `${DH}px`, opacity: 0, zIndex: 3, pointerEvents: "none" });
const tx = (x, y, a, txt, w = 650, sz = 24) => `<text x="${x}" y="${y}" text-anchor="${a}" style="fill:var(--text-2);font:${w} ${sz * S1}px var(--font-text)">${txt}</text>`;
dial.innerHTML = `<svg width="${DW}" height="${DH}" viewBox="0 0 ${DW} ${DH}" style="overflow:visible">
  <path d="M ${DCX - RX} ${DCY} A ${RX} ${RY} 0 0 1 ${DCX + RX} ${DCY}" fill="none" style="stroke:var(--text-2)" stroke-width="${1.8 * S1}" stroke-dasharray="${5 * S1} ${6 * S1}" opacity="0.6"/>
  <line x1="${DCX - RX - 24 * S1}" y1="${DCY}" x2="${DCX + RX + 24 * S1}" y2="${DCY}" style="stroke:var(--text-2)" stroke-width="${2.6 * S1}"/>
  ${tx(DCX - RX - 34 * S1, DCY + 9 * S1, "end", "W")}${tx(DCX + RX + 34 * S1, DCY + 9 * S1, "start", "E")}
  ${tx(DCX, DCY + 26 * S1, "middle", "the Sun's place, behind the clouds", 550, 21)}
  <circle id="dial-sun" r="${12.5 * S1}" style="fill:var(--lemon)"/></svg>`;
document.getElementById("hud").appendChild(dial);
const dialSun = dial.querySelector("#dial-sun");
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d)));

window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  applyPose(camera, poseFor(shot, t));
  const tv = thV(t), te = thE(t), vp = onOrbit(PH.r_v, tv), ep = onOrbit(PH.r_e, te);
  const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const psi = psiAt(t), wf = followW(t);
  // the Sun goes with the follow (off in the close view, where it would fill a corner): it shrinks away at full
  // brightness over the move instead of popping (dimming it would leave a grey disc)
  const sunK = 1 - E.inout2(clamp01((wf - 0.2) / 0.6));
  sun.set({ tau: CLK.orbit.tau(t), on: sunK > 0.01, camera, center: [0, 0, 0] });
  sun.group.scale.setScalar(Math.max(sunK, 0.01));
  venus.set({ center: vp, sunDir: norm(vp.map((v) => -v)), sun: 1, spin: psi - Math.PI });
  earth.set({ center: ep, sunDir: norm(ep.map((v) => -v)), sun: 1, spin: 2 * Math.PI * 0.15 * t });   // an illustrative slow turn (at 10⁶× it would strobe)
  earth.group.visible = shot !== "end";                                     // the end card pushes back to frame 0's Venus alone
  const big = 1 + 0.25 * (1 - wf);                                          // the bodies a little larger on the diagram (not to scale)
  venus.group.scale.setScalar(big); earth.group.scale.setScalar(big);
  const pinDir = [Math.cos(psi), 0, -Math.sin(psi)];
  const pinAt = vp.map((v, j) => v + pinDir[j] * VR * 1.01);
  you.set({ center: pinAt, camera });
  S.pin = vp.map((v, j) => v + pinDir[j] * VR * 1.15);
  S.venus = [vp[0], vp[1] + VR * 0.8, vp[2]]; S.earth = [ep[0], ep[1] + ER * 0.8, ep[2]]; S.sun = [0, 1.4, 0];
  const camX = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).toArray();
  S.limb = vp.map((v, j) => v + camX[j] * VR * 1.06);                        // Venus's right limb, as seen
  // the orbits fade in the close view (they would cut through Venus)
  orbV.set({ opacity: 1 - wf }); orbE.set({ opacity: 1 - wf });
  // the sunrise ticks: one across the orbit wherever Venus was at each sunrise
  S.rise = onOrbit(PH.r_v + 0.9, FILM.sunrises[0].th);
  FILM.sunrises.forEach((s, i) => {
    const a = onOrbit(PH.r_v - 0.9, s.th), b = onOrbit(PH.r_v + 0.9, s.th);
    ticks[i].seg(a, b).set({ opacity: (t >= s.t && t < FILM.endCard + 0.6 ? fadeIn(t, s.t, 0.25) : 0) * (1 - wf) });
  });
  // the radar beam (1962): Earth to Venus, dashed
  // the radar (1962): a dashed beam from Earth, and a pulse that reaches Venus on "pierced"
  beam.seg(ep, vp).set({ opacity: winOp(t, CUE.radar, CUE.true, 0.35) });
  // the ping goes out on "radar" and reaches Venus on "pierced"; its echo heads home
  const toE = norm(ep.map((v, j) => v - vp[j])), hit = vp.map((v, j) => v + toE[j] * VR);
  const uo = E.inout2(seg(t, CUE.radar, CUE.pierce)), ub = E.inout2(seg(t, CUE.pierce, CUE.pierce + (CUE.pierce - CUE.radar)));
  const pr = t < CUE.pierce ? ep.map((v, j) => v + (hit[j] - v) * uo) : hit.map((v, j) => v + (ep[j] - v) * ub);
  const live = (t > CUE.radar && t < CUE.pierce) || (t >= CUE.pierce && ub < 1);
  S.beam = vp.map((v, j) => v + toE[j] * VR * 2.3);
  // "backwards": an arc arrow around Venus's equator on the side facing the camera (it stays put while the pin turns
  // under it), pointing the way Venus turns (clockwise seen from north)
  const aCam = Math.atan2(-(camera.position.z - vp[2]), camera.position.x - vp[0]);
  const ra = VR * 1.3, a0 = aCam + 0.95, a1 = aCam - 0.95, ao = winOp(t, CUE.back, FILM.beats.find((b) => b.id === "whoa").t0, 0.35);
  const ex = { center: vp, ...XZ };
  arrow[0].arc({ r: ra, a0: a1, a1: a0, ...ex }).set({ opacity: ao });
  const tip = [vp[0] + ra * Math.cos(a1), 0, vp[2] - ra * Math.sin(a1)];
  const tan = [Math.sin(a1), 0, Math.cos(a1)];                              // the direction of travel (clockwise) at the tip
  const rad = [Math.cos(a1), 0, -Math.sin(a1)];
  arrow[1].seg(tip, tip.map((v, j) => v - tan[j] * 0.35 + rad[j] * 0.2)).set({ opacity: ao });
  arrow[2].seg(tip, tip.map((v, j) => v - tan[j] * 0.35 - rad[j] * 0.2)).set({ opacity: ao });
  // the label at whichever end of the arc is on the left of the frame, just outside it
  const endA = [a0, a1].map((a) => [vp[0] + ra * 1.2 * Math.cos(a), 0, vp[2] - ra * 1.2 * Math.sin(a)]);
  const sx = (p) => new THREE.Vector3(...p).project(camera).x;
  S.arrow = sx(endA[0]) < sx(endA[1]) ? endA[0] : endA[1];
  // Schiaparelli's lock: a pointer toward the (off-frame) Sun

  // the readout: Venus's light-time ring, then the radar's round trip (Venus and Earth lined up)
  // the light-time ring grows out from the Sun to Venus's orbit; it steps back when the echo is named
  lightRing.arc({ r: 1.6 + (PH.r_v + 0.25 - 1.6) * E.out3(seg(t, CUE.ring, CUE.ring + 1.2)), ...XZ })
    .set({ opacity: (t >= CUE.ring ? 1 : 0) * (1 - 0.65 * fadeIn(t, CUE.echo, 0.6)) * (1 - wf) });
  const ar = Math.PI * 0.8;
  S.ring = [(PH.r_v + 0.25) * Math.cos(ar), 0, -(PH.r_v + 0.25) * Math.sin(ar)];
  const d = norm(vp), e0 = vp.map((v, j) => v + d[j] * VR * 1.2), e1 = ep.map((v, j) => v - d[j] * ER * 1.2);
  echo.seg(e0, e1).set({ opacity: fadeIn(t, CUE.echo, 0.5) * (1 - wf) });
  S.echo = ep.map((v, j) => v + d[j] * ER * 2.6);                              // outside Earth's orbit, on the same line
  // the readout's ping: Earth → Venus → Earth over two seconds (the radar ping above shares the beacon)
  const ue = seg(t, CUE.echo, CUE.echo + 2.0), tri = ue < 0.5 ? E.inout2(ue * 2) : E.inout2(2 - ue * 2);
  const pe = e1.map((v, j) => v + (e0[j] - v) * tri), liveE = ue > 0 && ue < 1;
  pulse.set({ center: liveE ? pe : pr, camera, opacity: liveE || live ? 1 : 0 });
  // the dial: the Sun's place in the sky of the pin ("you"), from its hour angle (0 = noon, +π/2 = sunrise, in the west)
  const hA = ((psi - (thV(t) + Math.PI)) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  const th = Math.PI / 2 + hA, up = Math.abs(hA) <= Math.PI / 2;
  dialSun.setAttribute("cx", (DCX + RX * Math.cos(th)).toFixed(2)); dialSun.setAttribute("cy", (DCY - RY * Math.sin(th)).toFixed(2));
  dialSun.setAttribute("opacity", up ? "1" : "0");
  dial.style.opacity = (winOp(t, CUE.dial0, CUE.dial1, 0.4) * (shot === "end" ? 0 : 1)).toFixed(3);

  sky.update(camera, { frameCam: (applyPose(tmpCam, poseFor(shot, tr)), tmpCam), starGain: 1, bandGain: 1 });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
