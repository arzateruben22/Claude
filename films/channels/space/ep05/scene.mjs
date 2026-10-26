import * as THREE from "three";
// Light Minute No. 005, "How big is the Sun" (films/channels/space/ep05). The picture as a pure function of t.
//
// Two places and one cut. "sky": the Moon and the Sun at their true size and distance ratios (shrunk together), seen
// from Earth through a long lens: twins. Then "wide": beside the Sun, the Moon moved next to it at its true size (one
// is 400 times wider), and "side": the line seen square-on (400 times farther). "sun": the Sun at true scale against
// Earths (109 across its face), a big sunspot with an Earth in it, the Peloponnese as a dot, the Sun melted into beads
// (1 dot = 200 Earths), and the one scale jump: everything shrinks ×3,400 until the Sun is a dot among stars, inside
// the outline of the largest known stars; the readout sends its light out to Earth's orbit. The end card cuts back to
// the sky view, so a replay loops.
// Set: ../set (sky, star, planet with earthSurface, moon.js, beacon, rig, look, motif). Kit: hud, front.
import { stage, seg, E, clamp01, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring, segment, probes } from "cinema/sci/front.js";
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
const MOON_AT = [-dM * Math.tan(PH.sep), 0, -dM], SUN_AT = [dS * Math.tan(PH.sep), 0, -dS], rS = PH.r_sun_km * K;
const MOON_W = [SUN_AT[0] + rS * 1.6, 0, SUN_AT[2]];                      // "wide": the Moon moved beside the Sun (badged)
const skyMoon = createPlanet({ radius: PH.r_moon_km * K, surface: moonSurface({ width: W >= 1000 ? 2048 : 1024, seed: 9 }), rimDay: 0.0, rimNight: 0.15, segments: 96 });
skyMoon.group.position.fromArray(MOON_AT);
const skySun = createStar({ radius: PH.r_sun_km * K, intensity: 1.15, corona: 1.5, coronaI: 0.3, limb: 0.6, granulation: 0.2 });   // a face, not a blown disc: the twins read as twins
skySun.set({ center: SUN_AT });
// the markers' colours stay on the palette: ice for Earth and the Moon, a neutral near-white for the Sun (the text
// token through ACES reads blue-violet)
const moonDot = createBeacon({ color: line("ice", 1, 1.3), px: 9, core: 0.5 }), earthDot = createBeacon({ color: line("ice", 1, 1.3), px: 10, core: 0.5 });
const sunMark = createBeacon({ color: hdr("#EEF0F4", 1.6), px: 14, core: 0.4 });   // the Sun from the side (a 4 px disc at this scale)
const cone = [segment({ color: C.teal, width: 1.6, opacity: 0 }), segment({ color: C.teal, width: 1.6, opacity: 0 })];
const moonRing = ring({ color: line("ice", 0.9), width: 2.2, opacity: 0 });   // "wide": marks the 1 px Moon (a glow would read as its size)
G.sky.add(skyMoon.group, skySun.group, moonDot.mesh, earthDot.mesh, sunMark.mesh, moonRing.mesh, ...cone.map((c) => c.mesh));

// ── "sun": the Sun at true scale (100 units = 696,000 km) ───────────────────
const world = new THREE.Group();                                          // shrinks in the jump
G.sun.add(world);
const SUN_I = 1.15, CORONA_I = 0.3;                                     // under the bloom threshold: the face keeps its limb and granulation
const sun = createStar({ radius: 100, intensity: SUN_I, corona: 1.35, coronaI: CORONA_I, limb: 0.6, granulation: 0.22 });   // limb darkening and granulation show
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
// the sunspot: one disc, a dark umbra in a grey penumbra with faint radial filaments, soft edges feathered into the
// face (the radii stay the umbra's, spot_r, and the penumbra's, 1.6 spot_r: true scale)
const spotMat = new THREE.ShaderMaterial({
  uniforms: { uOp: { value: 0 }, uR: { value: PH.spot_r }, uU: { value: new THREE.Color(0x050608) }, uP: { value: new THREE.Color(0x3a3b44) } },
  vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform float uOp, uR; uniform vec3 uU, uP; varying vec2 vP; void main(){ float r = length(vP) / uR, a = atan(vP.y, vP.x);"
    + " float fil = 1.0 + 0.15 * sin(80.0 * a + 2.5 * sin(11.0 * a) + 1.7 * sin(29.0 * a)), pen = smoothstep(0.88, 1.08, r);"
    + " gl_FragColor = vec4(mix(uU, uP * fil, pen), (1.0 - smoothstep(1.45, 1.75, r)) * mix(1.0, 0.85, pen) * uOp); }",
  transparent: true, depthWrite: false,
});
const spot = new THREE.Mesh(new THREE.CircleGeometry(PH.spot_r * 1.75, 96), spotMat);
spot.position.fromArray(SD.map((v) => v * 100.25)); spot.quaternion.copy(qSpot);
world.add(spot);
const spotEarth = createPlanet({ radius: RE, surface: earthSurface({ width: 512 }), tilt: 23.44, rimDay: 0.5, rimNight: 0.4, segments: 48 });
const SE_AT = SD.map((v, i) => v * 100.3 + (i === 2 ? 1.3 : 0));            // in front of the spot's centre as seen (the view looks along -z)
spotEarth.group.position.fromArray(SE_AT);
world.add(spotEarth.group);
const PD = norm([-0.32, -0.22, 0.92]);
const peloMat = new THREE.MeshBasicMaterial({ color: 0x04050b, transparent: true, opacity: 0 });
const pelo = new THREE.Mesh(new THREE.CircleGeometry(3.0, 32), peloMat);   // a dark dot, big enough to see (enlarged: badged)
pelo.position.fromArray(PD.map((v) => v * 100.4));
pelo.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...PD)));
// "by a factor of about seven thousand": southern Greece's width grown to the Sun's; drawn dark (a line of light
// would vanish on the white face), over the face, a constant 7 px thick (the bloom thins a dark line)
const xMat = new THREE.MeshBasicMaterial({ color: 0x04050b, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
const xRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 160), xMat);
xRing.renderOrder = 6; xRing.frustumCulled = false;
world.add(pelo, xRing);
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
// the fill level that holds a fraction of the sphere's volume: (h + 1)²(2 − h) / 4 = frac, h from −1 to 1
const levelFor = (frac) => { let a = -1, b = 1; for (let i = 0; i < 30; i++) { const h = (a + b) / 2; if (((h + 1) ** 2 * (2 - h)) / 4 < frac) a = h; else b = h; } return (a + b) / 2; };
const limb = ring({ color: line("lemon", 1, 1.2), width: 3, opacity: 0 });   // the melted Sun's outline: a crisp limb, not a glow (dim lemon reads olive)
const sunDot = createBeacon({ color: hdr("#EEF0F4", 1.6), px: 10, core: 0.5 });   // the Sun as a point: neutral near-white
G.sun.add(limb.mesh, sunDot.mesh);
const giant = ring({ color: line("lemon", 1, 1.3), width: 4.0, opacity: 0, dash: 140, duty: 0.75 });   // the subject of "a thousand times wider": the line that wins
const orbitE = ring({ color: line("lilac", 0.8), width: 2.4, opacity: 0 });        // Earth's orbit, same scale (the readout)
// the readout's light: a ping on the Sun on "Light", then a ring of light out to Earth's orbit by "twenty" (Earth on it)
const lightRing = ring({ color: C.tealHi, width: 3, opacity: 0 });
const ping = createBeacon({ color: hdr("teal", 1.4), px: 16, core: 0.4 }), earthO = createBeacon({ color: line("ice", 1, 1.3), px: 12, core: 0.5 });
G.sun.add(giant.mesh, orbitE.mesh, lightRing.mesh, ping.mesh, earthO.mesh);
const sunProbe = probes(G.sun, 2);

const rig = createRig(FILM.cam);

// one star among many: a field around the Sun in the jump's own units, so it streams in as everything shrinks. It stays
// clear of the giants' outline (1,000 Sun radii = 100,000 units) from every view the camera takes after the jump, inside
// the last frame's width, each star smaller and dimmer than the Sun's dot (badged: star spacing not to scale)
const R5 = rng(31), D2R = Math.PI / 180, VIEWS = [], field = [];
for (let tv = CUE.j0 + 2.0; tv <= FILM.endCard + 0.3; tv += 0.5) { const P = rig.pose("sun", tv), e = P.el * D2R, a = P.az * D2R; VIEWS.push([Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]); }
const offAxis = (p, d) => { const s = p[0] * d[0] + p[1] * d[1] + p[2] * d[2]; return Math.hypot(p[0] - s * d[0], p[1] - s * d[1], p[2] - s * d[2]); };
while (field.length < 72) {
  const p = [(R5() * 2 - 1) * 150000, -200000 + 380000 * R5(), (R5() * 2 - 1) * 100000];
  if (VIEWS.some((d) => offAxis(p, d) < 115000)) continue;
  const b = createBeacon({ color: hdr("#EEF0F4", 0.45 + 0.4 * R5()), px: 3 + 4 * R5(), core: 0.5 });
  world.add(b.mesh); field.push({ p, b });
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = {};
const KIND = { body: { color: "ice", glyph: "●", mark: "none" }, star: { color: "lemon", glyph: "✦", mark: "none" },
  light: { color: "teal", glyph: "◯", mark: "none" }, gravity: { color: "lilac", mark: "dashed" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) {
  const el = hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot, maxW: b.maxW });
  if (b.text.includes("\n")) el.style.setProperty("--hud-card-size", "2.778vmin");   // a card at the notes' size (the channel's badge size)
}
const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true };
  if (c.fmt === "count") Object.assign(o, { value: (t) => c.from + (c.to - c.from) * E.inout2(seg(t, c.c0, c.c1)), fmt: (v) => commas(v), lit: (v) => v >= c.to - 0.5, minCh: commas(c.to).length });   // the number grows in place
  else Object.assign(o, { value: () => 0, fmt: () => c.text });
  const el = hud.counter(c.id, o);
  el.classList.add(c.read ? "lm-read" : "lm-clock");
  if (c.text && c.text.length > 10) { const v = el.querySelector(".v"); if (v) v.style.fontSize = "5.2vmin"; }   // long values stay inside the safe box
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed, shot: L.shot });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0" });
const fo = endEl.querySelector(".fo");
if (fo) fo.style.marginTop = "1.8vmin";                                      // the pill sits inside the ring
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";                                   // the title stays inside the end ring
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });
const cb = () => ({ e1: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).toArray(), e2: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).toArray() });

window.seek = function (t) {
  if (stage(t).name !== stage(Math.round(t * FPS) / FPS).name) t = Math.round(t * FPS) / FPS;   // motion blur never blends two shots across a cut
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  camera.near = shot === "sun" ? 2 : 0.01;                                 // depth precision for the spot close-up (the sky needs the near plane close)
  rig.place(camera, shot, t);
  G.sky.visible = shot === "sky" || shot === "side"; G.sun.visible = shot === "sun";

  // sky: full Moon lit from behind the viewer; the depth shows as the camera swings out
  skyMoon.set({ center: MOON_AT, sunDir: [0.05, 0.05, 1], sun: 1, spin: -Math.PI / 2 });   // the near side (longitude 0) toward Earth
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
  const molten = fadeIn(t, CUE.melt0, 1.5);                                  // ≥ 1.5 s: no sudden large change in brightness
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
  spotEarth.set({ center: SE_AT, sunDir: SD, sun: 1, spin: t * 0.2 });
  spotEarth.group.visible = so > 0.01;
  S.spot = SD.map((v) => v * 100 * k).map((v, i) => v + [-PH.spot_r * 1.25 * k, PH.spot_r * 0.55 * k, 0][i]);
  S.spotearth = SE_AT.map((v) => v * k).map((v, i) => v + [RE * k, RE * k, 0][i]);
  const po = winOp(t, CUE.pelo, CUE.melt0, 0.4);
  peloMat.opacity = po; pelo.visible = po > 0.01;
  peloRing.arc({ center: PD.map((v) => v * 100.6), r: 4.5, e1: [1, 0, 0], e2: [0, 1, 0] }).set({ opacity: po });
  S.pelo = PD.map((v) => v * 100.4 * k);
  // ×7,000: a ring from southern Greece's width (about 200 km) out to the Sun's limb, log-eased, between "By" and "thousand"
  const r0x = PH.pelo_across / 2 / PH.u, ux = E.inout2(seg(t, CUE.x0, CUE.x1)), rx = Math.exp(Math.log(r0x) + (Math.log(100) - Math.log(r0x)) * ux);
  const cx = PD.map((v) => v * 100.4 * (1 - ux));
  const xo = winOp(t, CUE.x0, CUE.melt0 - 0.4, 0.3);
  xMat.opacity = 0.9 * xo; xRing.visible = xo > 0.01;
  if (xRing.visible) {
    const pxw = (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.length()) / H / k;   // world units per pixel at the Sun
    xRing.geometry.dispose(); xRing.geometry = new THREE.RingGeometry(Math.max(0, rx - 4 * S1 * pxw), rx, 160);
    xRing.position.fromArray(cx); xRing.quaternion.copy(camera.quaternion);
  }
  const cbx = cb();
  S.x7000 = [0, 1, 2].map((j) => (cx[j] + rx * (cbx.e1[j] * Math.cos(0.5) + cbx.e2[j] * Math.sin(0.5))) * k);
  dotMat.uniforms.uLevel.value = -1.05 + 2.1 * E.inout2(seg(t, CUE.melt0 + 0.4, CUE.melt1));
  dotMat.uniforms.uOp.value = molten * (1 - back);
  sunDot.set({ center: [0, 0, 0], camera, opacity: fadeIn(t, CUE.j0 + 1.6, 0.8) });
  S.sundot = [0, 0, 0];
  const gr = PH.giant * 100 * k;
  giant.arc({ center: [0, 0, 0], r: gr, ...cb() }).set({ opacity: shot === "sun" ? fadeIn(t, CUE.j0 + 0.9, 0.6) : 0 });   // in with the zoom-out, not after it
  S.giant = [gr * Math.cos(2.5), gr * Math.sin(2.5), 0];
  const orr = PH.au_r * 100 * k, oo = shot === "sun" ? fadeIn(t, CUE.orbit, 0.8) : 0;
  orbitE.arc({ center: [0, 0, 0], r: orr, ...cb() }).set({ opacity: oo });
  S.orbit = [orr * Math.cos(-2.4), orr * Math.sin(-2.4), 0];
  sunProbe(shot === "sun" && t > CUE.j0 && t < CUE.j1 + 0.2 ? [[60 * k, 0, 0], [0, 60 * k, 0]] : [null, null]);

  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1, bandGain: 1 });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
