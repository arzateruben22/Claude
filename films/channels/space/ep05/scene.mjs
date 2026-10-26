import * as THREE from "three";
// Light Minute No. 005, "How big is the Sun" (films/channels/space/ep05). The picture as a pure function of t.
//
// Two places and one cut. "sky": the Moon and the Sun at their true size and distance ratios (shrunk together), seen
// from Earth through a long lens: twins. The camera swings out and the depth shows: one is 400 times wider and 400
// times farther. "sun": the Sun at true scale against Earths (109 across its face), a big sunspot with an Earth in
// it, the Peloponnese as a dot, the Sun melted into beads (1 dot = 200 Earths), and the one scale jump: everything
// shrinks ×2,400 until the Sun is a dot inside the outline of the largest known stars. The end card cuts back to the
// sky view, so a replay loops.
// Set: ../set (sky, star, planet with earthSurface, moon.js, beacon, rig, look, motif). Kit: hud, front.
import { stage, seg, E, clamp01, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring, segment, shell, probes } from "cinema/sci/front.js";
import { createSky } from "../set/sky.js";
import { createStar } from "../set/star.js";
import { createPlanet, earthSurface } from "../set/planet.js";
import { moonSurface } from "../set/moon.js";
import { createBeacon } from "../set/beacon.js";
import { createRig } from "../set/rig.js";
import { hdr, line, tok } from "../set/look.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, PH = FILM.phys, CUE = FILM.cue, FPS = FILM.fps || 30;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.01, 6000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();
const B = Object.fromEntries(FILM.beats.map((b) => [b.id, b]));
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d)));
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const C = { teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3), ice: line("ice", 0.8), lemon: line("lemon", 0.8) };

const sky = createSky({ stars: 6000, seed: 53 });
scene.add(sky.group);

// ── "sky": the Moon and the Sun at true ratios (×SKY_K) ─────────────────────
const K = PH.sky_k, G = { sky: new THREE.Group(), sun: new THREE.Group() };
scene.add(G.sky, G.sun);
const dM = PH.d_moon_km * K, dS = PH.d_sun_km * K;
const MOON_AT = [-dM * Math.tan(PH.sep), 0, -dM], SUN_AT = [dS * Math.tan(PH.sep), 0, -dS];
const skyMoon = createPlanet({ radius: PH.r_moon_km * K, surface: moonSurface({ width: 512, seed: 9 }), rimDay: 0.2, rimNight: 0.3, segments: 64 });
skyMoon.group.position.fromArray(MOON_AT);
const skySun = createStar({ radius: PH.r_sun_km * K, intensity: 2.4, corona: 1.5, coronaI: 0.35 });
skySun.set({ center: SUN_AT });
const moonDot = createBeacon({ color: hdr("ice", 1.0), px: 9, core: 0.5 }), earthDot = createBeacon({ color: hdr("ice", 1.1), px: 10, core: 0.5 });
const sunMark = createBeacon({ color: hdr("text", 1.6), px: 14, core: 0.4 });   // the Sun from the side (a 4 px disc at this scale)
const cone = [segment({ color: C.teal, width: 1.6, opacity: 0 }), segment({ color: C.teal, width: 1.6, opacity: 0 })];
G.sky.add(skyMoon.group, skySun.group, moonDot.mesh, earthDot.mesh, sunMark.mesh, ...cone.map((c) => c.mesh));

// ── "sun": the Sun at true scale (100 units = 696,000 km) ───────────────────
const world = new THREE.Group();                                          // shrinks in the jump
G.sun.add(world);
const SUN_I = 1.3, CORONA_I = 0.3;                                       // under the bloom threshold: the face keeps its limb and granulation
const sun = createStar({ radius: 100, intensity: SUN_I, corona: 1.35, coronaI: CORONA_I });
world.add(sun.group);
const RE = PH.r_e, N = PH.n_across;
// silhouettes, as Earth looks crossing the Sun; drawn in the plane of the limb, over the corona glow
const rowMat = new THREE.MeshBasicMaterial({ color: 0x04050b, transparent: true, depthTest: false, depthWrite: false });
const row = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), rowMat, N);
row.frustumCulled = false; row.renderOrder = 5;
world.add(row);
const m4 = new THREE.Matrix4();
const SD = PH.spot_dir, SP = SD.map((v) => v * 100.15);
const qSpot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...SD));
const spotMat = new THREE.MeshBasicMaterial({ color: 0x050608, transparent: true, opacity: 0 });
const penMat = new THREE.MeshBasicMaterial({ color: 0x3a3b44, transparent: true, opacity: 0 });
const spot = new THREE.Mesh(new THREE.CircleGeometry(PH.spot_r, 48), spotMat), pen = new THREE.Mesh(new THREE.CircleGeometry(PH.spot_r * 1.6, 48), penMat);
spot.position.fromArray(SD.map((v) => v * 100.3)); pen.position.fromArray(SD.map((v) => v * 100.2));
spot.quaternion.copy(qSpot); pen.quaternion.copy(qSpot);
world.add(pen, spot);
const spotEarth = createPlanet({ radius: RE, surface: earthSurface({ width: 512 }), tilt: 23.44, rimDay: 0.5, rimNight: 0.4, segments: 48 });
spotEarth.group.position.fromArray(SD.map((v) => v * 101.6));
world.add(spotEarth.group);
const PD = norm([-0.32, -0.22, 0.92]);
const peloMat = new THREE.MeshBasicMaterial({ color: 0x04050b, transparent: true, opacity: 0 });
const pelo = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), peloMat);   // a dark dot (enlarged: badged)
pelo.position.fromArray(PD.map((v) => v * 100.4));
pelo.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...PD)));
const peloRing = ring({ color: C.teal, width: 2.4, opacity: 0 });
world.add(pelo, peloRing.mesh);
// the melted Sun: 6,500 dots filling the sphere from the bottom (1 dot = 200 Earths, by volume)
const R6 = rng(17), NP = PH.dots, P = new Float32Array(NP * 3), order = [];
for (let i = 0; i < NP; i++) { let x, y, z; do { x = R6() * 2 - 1; y = R6() * 2 - 1; z = R6() * 2 - 1; } while (x * x + y * y + z * z > 0.97); P.set([x * 100, y * 100, z * 100], i * 3); order.push(y); }
const dotGeo = new THREE.BufferGeometry(), SH = new Float32Array(NP).map(() => 0.7 + 0.3 * R6());
dotGeo.setAttribute("position", new THREE.BufferAttribute(P, 3));
dotGeo.setAttribute("sh", new THREE.BufferAttribute(SH, 1));
dotGeo.setAttribute("yy", new THREE.BufferAttribute(new Float32Array(order), 1));
const dotMat = new THREE.ShaderMaterial({
  uniforms: { uLevel: { value: -2 }, uS1: { value: S1 }, uOp: { value: 0 }, uA: { value: new THREE.Vector3(...line("ice", 0.9)) }, uB: { value: new THREE.Vector3(...line("ice", 0.7)) } },
  vertexShader: "attribute float yy, sh; uniform float uLevel, uS1; varying float vOn, vSh; void main(){ vOn = step(yy, uLevel); vSh = sh; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 5.0 * uS1; }",
  fragmentShader: "uniform vec3 uA, uB; uniform float uOp; varying float vOn, vSh; void main(){ if (vOn < 0.5) discard; vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; gl_FragColor = vec4(mix(uB, uA, (vSh - 0.7) / 0.3 * (1.0 - 0.5 * r)), uOp); }",
  transparent: true, depthWrite: false, depthTest: false,   // the beads fill the (dimmed) Sun: drawn over its face
});
const dots = new THREE.Points(dotGeo, dotMat);
dots.frustumCulled = false; dots.renderOrder = 4;
world.add(dots);
const rim = shell({ color: line("lemon", 0.9), opacity: 0, power: 2.4 });
world.add(rim.mesh);
const sunDot = createBeacon({ color: hdr("text", 1.8), px: 10, core: 0.35 });
G.sun.add(sunDot.mesh);
const giant = ring({ color: C.lemon, width: 2.6, opacity: 0, dash: 140, duty: 0.6 });
G.sun.add(giant.mesh);
const sunProbe = probes(G.sun, 2);

const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = {};
const KIND = { body: { color: "ice", glyph: "●", mark: "none" }, star: { color: "lemon", glyph: "✦", mark: "none" },
  light: { color: "teal", glyph: "◯", mark: "none" }, gravity: { color: "lilac", mark: "dashed" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true };
  if (c.fmt === "count") Object.assign(o, { value: (t) => c.from + (c.to - c.from) * E.inout2(seg(t, c.c0, c.c1)), fmt: (v) => commas(v), lit: (v) => v >= c.to - 0.5, minCh: 3 });
  else Object.assign(o, { value: () => 0, fmt: () => c.text });
  const el = hud.counter(c.id, o);
  el.classList.add(c.read ? "lm-read" : "lm-clock");
  if (c.text && c.text.length > 10) { const v = el.querySelector(".v"); if (v) v.style.fontSize = "5.2vmin"; }   // long values stay inside the safe box
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, shot: L.shot });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "4vmin auto 0" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";                                   // the title stays inside the end ring
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });
const cb = () => ({ e1: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).toArray(), e2: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).toArray() });

window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  camera.near = shot === "sun" ? 2 : 0.01;                                 // depth precision for the spot close-up (the sky needs the near plane close)
  rig.place(camera, shot, t);
  G.sky.visible = shot === "sky" || shot === "side"; G.sun.visible = shot === "sun";

  // sky: full Moon lit from behind the viewer; the depth shows as the camera swings out
  skyMoon.set({ center: MOON_AT, sunDir: [0.05, 0.05, 1], sun: 1, spin: 0 });
  skySun.set({ tau: t * 600, on: true, camera, center: SUN_AT });
  // side: Earth and the Moon one dot (2,560 km apart at this scale, 2 px), the sight lines drawn out to the Sun's limbs
  const side = shot === "side" ? 1 : 0, reach = E.inout2(seg(t, CUE.side + 0.3, CUE.side + 1.9));
  moonDot.set({ center: MOON_AT, camera, opacity: 0 }); earthDot.set({ center: [0, 0, 0], camera, opacity: side });
  sunMark.set({ center: SUN_AT, camera, opacity: side });
  const rS = PH.r_sun_km * K, oc = side * (reach > 0.002 ? 1 : 0), far = (v) => v * reach;
  cone[0].seg([0, 0, 0], [SUN_AT[0], rS, SUN_AT[2]].map(far)).set({ opacity: oc }); cone[1].seg([0, 0, 0], [SUN_AT[0], -rS, SUN_AT[2]].map(far)).set({ opacity: oc });
  S.skysun = [SUN_AT[0], rS * 1.1, SUN_AT[2]]; S.skymoon = [MOON_AT[0], PH.r_moon_km * K * 1.1, MOON_AT[2]]; S.you = [0, 0, 0];

  // sun: the row, the spot, the dot, the melt, the jump
  const k = PH.base * Math.exp(Math.log(PH.shrink) * E.inout3(seg(t, CUE.j0, CUE.j1)));
  world.scale.setScalar(k);
  const molten = fadeIn(t, CUE.melt0, 0.8);
  // the melt dims the Sun (it stays faintly there behind the dots); in the jump it comes back as the dots fade, so they
  // never pile into one over-bright point
  const back = fadeIn(t, CUE.j0, 0.7);
  const dim = 1 - 0.96 * molten * (1 - back);
  sun.set({ tau: t * 300, on: true, camera, center: [0, 0, 0], intensity: SUN_I * dim });
  sun.corona.material.uniforms.uI.value = CORONA_I * dim;
  rim.set({ center: [0, 0, 0], r: 101, opacity: 0.9 * molten * (1 - back) });
  const nOn = Math.round(N * E.inout2(seg(t, CUE.row0, CUE.row1))), rowOp = 1 - fadeIn(t, B.why.t0 + 0.6, 0.6);
  for (let i = 0; i < N; i++) {
    const x = -100 + RE + 2 * RE * i, on = i < nOn && rowOp > 0.01 ? 1 : 0;
    row.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0, 0), new THREE.Quaternion(), new THREE.Vector3(RE * on, RE * on, RE * on)));
  }
  row.instanceMatrix.needsUpdate = true;
  S.row = [40, 3, 0].map((v) => v * k);
  const so = winOp(t, CUE.spot - 0.4, CUE.melt0 - 0.6, 0.5) * (1 - molten);
  spotMat.opacity = so; penMat.opacity = so * 0.85; spot.visible = pen.visible = so > 0.01;
  spotEarth.set({ center: SD.map((v) => v * 101.6), sunDir: SD, sun: 1, spin: t * 0.2 });
  spotEarth.group.visible = so > 0.01;
  S.spot = SD.map((v) => v * 100 * k).map((v, i) => v + [-PH.spot_r * 1.25 * k, PH.spot_r * 0.55 * k, 0][i]);
  S.spotearth = SD.map((v) => v * 101.6 * k).map((v, i) => v + [RE * k, RE * k, 0][i]);
  const po = winOp(t, CUE.pelo, CUE.melt0, 0.4);
  peloMat.opacity = po; pelo.visible = po > 0.01;
  peloRing.arc({ center: PD.map((v) => v * 100.6), r: 4.5, e1: [1, 0, 0], e2: [0, 1, 0] }).set({ opacity: po });
  S.pelo = PD.map((v) => v * 100.4 * k);
  dotMat.uniforms.uLevel.value = -1.05 + 2.1 * E.inout2(seg(t, CUE.melt0 + 0.4, CUE.melt1));
  dotMat.uniforms.uOp.value = molten * (1 - back);
  sunDot.set({ center: [0, 0, 0], camera, opacity: fadeIn(t, CUE.j0 + 1.6, 0.8) });
  S.sundot = [0, 0, 0];
  const gr = PH.giant * 100 * k;
  giant.arc({ center: [0, 0, 0], r: gr, ...cb() }).set({ opacity: shot === "sun" ? fadeIn(t, CUE.giant, 0.8) : 0 });
  S.giant = [gr * Math.cos(2.2), gr * Math.sin(2.2), 0].map((v, i) => v);
  sunProbe(shot === "sun" && t > CUE.j0 && t < CUE.j1 + 0.2 ? [[60 * k, 0, 0], [0, 60 * k, 0]] : [null, null]);

  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1, bandGain: 1 });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
