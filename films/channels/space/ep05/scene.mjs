import * as THREE from "three";
// Light Minute No. 005, "How big is the Sun" (films/channels/space/ep05). The picture as a pure function of t.
//
// Two places and one cut. "sky": the Moon and the Sun at their true size and distance ratios (shrunk together), seen
// from Earth through a long lens: twins. Then "wide": beside the Sun, the Moon moved next to it at its true size (one
// is 400 times wider), and "side": the line seen square-on (400 times farther). "sun": the Sun at true scale against
// Earths (109 across its face), a big sunspot with an Earth in it, the Peloponnese as a map shrinking to a dot, the Sun
// melted into beads (1 dot = 200 Earths), and the one scale jump: everything shrinks ×850 until the Sun is a dot among
// stars, inside the outline of the largest known stars; then a push in on the Sun, and the readout sends its light
// out to Earth's orbit. The end card cuts back to the sky view, so a replay loops.
// Set: ../set (sky, star, planet with earthSurface, moon.js, beacon, rig, look, motif). Kit: hud, front.
import { stage, seg, E, clamp01, rng } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
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
const PXS = Math.min(W, H) / 540;                                         // beacon sizes are render pixels: kept at the reviewed draft's size (540 wide) at every resolution
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
const pos = (c) => c.map((v) => Math.max(0, v));                        // no negative light (an inverted token can dip below 0)
const C = { teal: line("teal", 0.9), tealHi: line("teal", 1, 1.3), ice: line("ice", 0.8), lemon: line("lemon", 0.8) };
const PALE_ICE = [0.4, 0.72, 1.3];   // the ice markers' glow: pale all through its halo (line("ice", 1, 1.3) dips below 0 in red and blooms electric blue)

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
const moonDot = createBeacon({ color: PALE_ICE, px: 9 * PXS, core: 0.5 }), earthDot = createBeacon({ color: PALE_ICE, px: 10 * PXS, core: 0.5 });
const sunMark = createBeacon({ color: hdr("#EEF0F4", 1.6), px: 14 * PXS, core: 0.4 });   // the Sun from the side (a 4 px disc at this scale)
// the sight lines, the subject of "farther": light from the Sun's limbs, so they glow like the readout's light
const cone = [segment({ color: pos(C.tealHi), width: 3, opacity: 0 }), segment({ color: pos(C.tealHi), width: 3, opacity: 0 })];
const moonRing = ring({ color: pos(line("ice", 0.82)), width: 3.4, opacity: 0 });   // "wide": marks the 1 px Moon (a glow would read as its size); ice, under the bloom
G.sky.add(skyMoon.group, skySun.group, moonDot.mesh, earthDot.mesh, sunMark.mesh, moonRing.mesh, ...cone.map((c) => c.mesh));

// ── "sun": the Sun at true scale (100 units = 696,000 km) ───────────────────
const world = new THREE.Group();                                          // shrinks in the jump
G.sun.add(world);
const SUN_I = 1.15, CORONA_I = 0.3;                                     // under the bloom threshold: the face keeps its limb and granulation
const sun = createStar({ radius: 100, intensity: SUN_I, corona: 1.35, coronaI: CORONA_I, limb: 0.6, granulation: 0.22 });   // limb darkening and granulation show
world.add(sun.group);
sun.body.geometry.dispose(); sun.body.geometry = new THREE.SphereGeometry(1, 512, 256);   // a round limb under the ×20 lens (64 × 40 facets show there)
// the close-up's granulation: one finer octave, cells about 1,000 km (true size), drifting slowly; it fades in as the
// lens closes on the spot (uFine), so the ×20 face isn't flat plaster, and stays off in the wide views (no aliasing)
const sunFS = sun.body.material;
sunFS.uniforms.uFine = { value: 0 };
sunFS.fragmentShader = sunFS.fragmentShader.replace("uLimb, uGran;", "uLimb, uGran, uFine;")
  .replace("float gran =", "g += uFine * 0.35 * (vn(d * 700.0 + vec3(uTau * 0.0002)) - 0.5);\n    float gran =");
if (!sunFS.fragmentShader.includes("uGran, uFine;") || !sunFS.fragmentShader.includes("g += uFine")) throw new Error("ep05: star.js's shader changed; the close-up granulation can't be added");
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
// southern Greece: the Peloponnese's coast (lon, lat; traced by hand, about 40 points), drawn dark with the area of a
// 4.5-unit circle (enlarged about 380 times: badged "map enlarged"; the larger dot reads dark through the bloom). It
// arrives 8 times larger still, a map laid on the face, and shrinks to that size before its label comes
const PEL = [[22.96, 37.94], [22.75, 38.02], [22.42, 38.14], [22.08, 38.25], [21.78, 38.31], [21.73, 38.25], [21.38, 38.17], [21.13, 37.93],
  [21.32, 37.64], [21.62, 37.47], [21.66, 37.25], [21.57, 37.13], [21.66, 36.93], [21.7, 36.81], [21.88, 36.72], [21.96, 36.8], [21.93, 36.96],
  [22.11, 37.02], [22.23, 36.89], [22.37, 36.66], [22.48, 36.39], [22.5, 36.62], [22.57, 36.76], [22.68, 36.8], [22.83, 36.66], [23.06, 36.51],
  [23.2, 36.44], [23.06, 36.69], [22.99, 36.98], [22.89, 37.15], [22.77, 37.41], [22.72, 37.56], [22.8, 37.57], [22.86, 37.52], [23.15, 37.32],
  [23.25, 37.38], [23.52, 37.43], [23.45, 37.5], [23.38, 37.6], [23.16, 37.64], [23.05, 37.78], [22.99, 37.9]];
const pk = PEL.map(([lo, la]) => [(lo - 22.3) * 88.4, (la - 37.4) * 110.9]);   // km east and north
let pa = 0, pcx = 0, pcy = 0;
pk.forEach(([x0, y0], i) => { const [x1, y1] = pk[(i + 1) % pk.length], c = x0 * y1 - x1 * y0; pa += c / 2; pcx += ((x0 + x1) * c) / 6; pcy += ((y0 + y1) * c) / 6; });
const pu = 4.5 / Math.sqrt(Math.abs(pa) / Math.PI);                      // units per km: the area of a 4.5-unit circle
const peloShape = new THREE.Shape(pk.map(([x, y]) => new THREE.Vector2((x - pcx / pa) * pu, (y - pcy / pa) * pu)));   // about its centre of area
const peloMat = new THREE.MeshBasicMaterial({ color: 0x04050b, transparent: true, opacity: 0, side: THREE.DoubleSide });
const pelo = new THREE.Mesh(new THREE.ShapeGeometry(peloShape), peloMat);
pelo.position.fromArray(PD.map((v) => v * 100.4));
pelo.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...PD)));   // north stays up
const PV = peloShape.getPoints().map((p) => new THREE.Vector3(p.x, p.y, 0).applyQuaternion(pelo.quaternion));   // the coast's offsets in the world
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
const sunDot = createBeacon({ color: hdr("#EEF0F4", 1.6), px: 10 * PXS, core: 0.5 });   // the Sun as a point: neutral near-white
G.sun.add(limb.mesh, sunDot.mesh);
const giant = ring({ color: line("lemon", 1, 1.3), width: 4.0, opacity: 0, dash: 140, duty: 0.75 });   // the subject of "a thousand times wider": the line that wins
const orbitE = ring({ color: line("lilac", 0.8), width: 2.4, opacity: 0 });        // Earth's orbit, same scale (the readout)
// the readout's light: a ping on the Sun on "Light", then a ring of light out to Earth's orbit by "twenty" (Earth on it)
const lightRing = ring({ color: C.tealHi, width: 3, opacity: 0 });
const ping = createBeacon({ color: hdr("teal", 1.4), px: 16 * PXS, core: 0.4 }), earthO = createBeacon({ color: PALE_ICE, px: 12 * PXS, core: 0.5 });
G.sun.add(giant.mesh, orbitE.mesh, lightRing.mesh, ping.mesh, earthO.mesh);
const sunProbe = probes(G.sun, 2);

const rig = createRig(FILM.cam);

// one star among many: a field around the Sun in the jump's own units, so it streams in as everything shrinks. It stays
// clear of the giants' outline (1,000 Sun radii = 100,000 units) from every view the camera takes after the jump, inside
// the last frame's width, each star smaller and dimmer than the Sun's dot (badged: star spacing not to scale)
const R5 = rng(31), D2R = Math.PI / 180, VIEWS = [], field = [];
for (let tv = CUE.j0 + 2.0; tv <= FILM.endCard + 0.3; tv += 0.5) { const q = rig.pose("sun", tv), e = q.el * D2R, a = q.az * D2R; VIEWS.push([Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]); }
const offAxis = (p, d) => { const s = p[0] * d[0] + p[1] * d[1] + p[2] * d[2]; return Math.hypot(p[0] - s * d[0], p[1] - s * d[1], p[2] - s * d[2]); };
// ...and never in the spine's band (x 0.2–0.8, y 0.50–0.60) from the jump's landing to the end card: a star beside the
// readout's figures reads as punctuation (the push carries them outward through it)
const BAND = [];
for (let tv = CUE.j1; tv <= FILM.endCard; tv += 0.5) { const c = rig.frameCamera(camera, "sun", tv); BAND.push({ matrixWorldInverse: c.matrixWorldInverse.clone(), projectionMatrix: c.projectionMatrix.clone() }); }
const inBand = (p) => BAND.some((c) => { const s = project(c, p.map((v) => v * PH.base * PH.shrink), W, H); return s.front && s.x > 0.2 * W && s.x < 0.8 * W && s.y > 0.5 * H && s.y < 0.6 * H; });
while (field.length < 72) {
  const p = [(R5() * 2 - 1) * 150000, -200000 + 380000 * R5(), (R5() * 2 - 1) * 100000];
  if (VIEWS.some((d) => offAxis(p, d) < 115000) || inBand(p)) continue;
  const b = createBeacon({ color: hdr("#EEF0F4", 0.45 + 0.4 * R5()), px: (3 + 4 * R5()) * PXS, core: 0.5 });
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
  G.sky.visible = shot === "sky" || shot === "wide" || shot === "side"; G.sun.visible = shot === "sun";
  const cbx = cb();                                                          // the camera's right and up: rings and anchors face it

  // sky: full Moon lit from behind the viewer; "wide" moves it beside the Sun at its true size (about 1 px: ringed, and
  // lit brighter so the speck shows inside its ring)
  const wide = shot === "wide" ? 1 : 0;
  // through "look the same size" the twins drift together (true sizes; their separation is the composition, badged),
  // to 0.85 of it (closer, the two name pills could meet and one would hop); frame 0, the cuts and the end card keep
  // the full separation
  const sp = shot === "sky" && t < CUE.wide ? 1 - 0.15 * E.inout2(seg(t, B.normal.t0 + 0.3, CUE.wide - 0.4)) : 1;
  const mAt = [-dM * Math.tan(PH.sep * sp), 0, -dM], sAt = [dS * Math.tan(PH.sep * sp), 0, -dS];
  const endDim = t >= FILM.endCard ? 0.2 : 1;                              // under the end card the twins stay back (the sky shot comes in already dim)
  skyMoon.set({ center: wide ? MOON_W : mAt, sunDir: [0.05, 0.05, 1], sun: wide ? 3.0 : endDim, spin: -Math.PI / 2 });   // the near side (longitude 0) toward Earth
  skySun.set({ tau: t * 600, on: true, camera, center: sAt, intensity: 1.15 * endDim });
  skySun.corona.material.uniforms.uI.value = 0.3 * endDim;
  const mR = (22 * S1 * 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.distanceTo(new THREE.Vector3(...MOON_W))) / H;   // 22 px at the Moon
  moonRing.arc({ center: MOON_W, r: mR, ...cbx }).set({ opacity: wide * fadeIn(t, CUE.wide + 0.15, 0.35) });
  S.wmoon = MOON_W.map((v, j) => v + mR * (cbx.e1[j] * Math.cos(1.05) + cbx.e2[j] * Math.sin(1.05)));   // on the ring: the anchor dot never hides the Moon
  // side: Earth and the Moon one dot (2,560 km apart at this scale, 2 px), the sight lines drawn out to the Sun's limbs
  const side = shot === "side" ? 1 : 0, reach = E.inout2(seg(t, CUE.side + 0.3, CUE.side + 1.9));
  moonDot.set({ center: MOON_AT, camera, opacity: 0 }); earthDot.set({ center: [0, 0, 0], camera, opacity: side });
  sunMark.set({ center: SUN_AT, camera, opacity: side });
  const oc = side * (reach > 0.002 ? 1 : 0), far = (v) => v * reach;
  cone[0].seg([0, 0, 0], [SUN_AT[0], rS, SUN_AT[2]].map(far)).set({ opacity: oc }); cone[1].seg([0, 0, 0], [SUN_AT[0], -rS, SUN_AT[2]].map(far)).set({ opacity: oc });
  S.skysun = [sAt[0], rS * 1.1, sAt[2]]; S.skymoon = [mAt[0], PH.r_moon_km * K * 1.1, mAt[2]]; S.you = [0, 0, 0];

  // sun: the row, the spot, the dot, the melt, the jump
  const k = PH.base * Math.exp(Math.log(PH.shrink) * E.inout3(seg(t, CUE.j0, CUE.j1)));
  world.scale.setScalar(k);
  const molten = fadeIn(t, CUE.melt0, 1.5);                                  // ≥ 1.5 s: no sudden large change in brightness
  // the melt dims the Sun (all but dark behind the dots: its limb line keeps the edge); in the jump it comes back as the
  // dots fade (eased over 1.2 s: no pop to a white disc), so they never pile into one over-bright point
  const back = E.inout2(seg(t, CUE.j0, CUE.j0 + 1.2));
  const dim = 1 - 0.99 * molten * (1 - back);
  // the face dimmer in the long-lens close-up (no near-white frame held for 4 s) and from the row to the melt (the
  // silhouettes keep their edges against the bloom; the why beat's face isn't clipped white); the corona dims with
  // the close-up only
  const gClose = 1 - 0.5 * clamp01((8 - camera.fov) / 6), gRow = 1 - 0.25 * winOp(t, CUE.row0 - 0.6, CUE.melt0, 0.6);
  sun.set({ tau: t * 300, on: true, camera, center: [0, 0, 0], intensity: SUN_I * dim * Math.min(gClose, gRow) });
  sun.corona.material.uniforms.uI.value = CORONA_I * dim * gClose;
  sunFS.uniforms.uFine.value = clamp01((8 - camera.fov) / 6);
  sun.body.visible = dim > 0.04;                                             // the emptied Sun shows the sky behind its beads, not a black hole (a one-frame step at 4%)
  limb.arc({ center: [0, 0, 0], r: 100.5 * k, ...cbx }).set({ opacity: 0.9 * fadeIn(t, CUE.melt0 + 1.0, 0.6) * (1 - back) });   // just outside the silhouette (the sphere would hide half the line)
  // the counter's "1" has its Earth; the row leaves with its label and counter, before the zoom would sweep it up the frame
  const nOn = Math.max(t >= CUE.row0 ? 1 : 0, Math.round(N * E.inout2(seg(t, CUE.row0, CUE.row1))));
  rowMat.opacity = 1 - fadeIn(t, CUE.spot - 0.6, 0.4);
  for (let i = 0; i < N; i++) {
    const x = -100 + RE + 2 * RE * i, on = i < nOn && rowMat.opacity > 0.01 ? 1 : 0;
    row.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0, 0), new THREE.Quaternion(), new THREE.Vector3(RE * on, RE * on, RE * on)));
  }
  row.instanceMatrix.needsUpdate = true;
  S.row = [40, 3, 0].map((v) => v * k);
  const so = winOp(t, CUE.spot - 0.4, CUE.pelo - 1.9, 0.5) * (1 - molten);   // gone before the spine names southern Greece
  spotMat.uniforms.uOp.value = so; spot.visible = so > 0.01;
  spotEarth.set({ center: SE_AT, sunDir: SD, sun: 1, spin: t * 0.2 });
  spotEarth.group.visible = so > 0.01;
  spotEarth.group.scale.setScalar(Math.max(1e-3, so));   // the planet shader has no opacity: it shrinks away with the spot instead of popping
  // the anchor: on the penumbra's soft upper-left rim, so the pill sits above the spot, not on it
  S.spot = SD.map((v) => v * 100 * k).map((v, i) => v + [-PH.spot_r * 0.9 * k, PH.spot_r * 0.75 * k, 0][i]);
  const pxw = (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.length()) / H / k;   // world units per pixel at the Sun
  const po = winOp(t, CUE.pelo, CUE.x1 - 0.1, 0.4);                          // until the ring has grown from it (gone with its note)
  const sc = 1 + 7 * (1 - E.inout2(seg(t, CUE.pelo, CUE.pelo + 1.8)));      // the map shrinks to its dot
  peloMat.opacity = po; pelo.visible = po > 0.01; pelo.scale.setScalar(sc);
  // the label's anchor dot just touches the coast's eastern tip (it never covers the dot, nor points at bare face)
  const pe = Math.max(...PV.map((v) => v.x * cbx.e1[0] + v.y * cbx.e1[1] + v.z * cbx.e1[2])) * sc;
  S.pelo = PD.map((v, j) => (v * 100.4 + cbx.e1[j] * (pe + 12 * S1 * pxw)) * k);
  // ×7,000: a ring from southern Greece's width (about 200 km) out to the Sun's limb, log-eased, between "Bigger, yes"
  // and "thousand"; it grows from the dot (out of it by "By"), slows into the limb, and centres on the disc there
  const r0x = PH.pelo_across / 2 / PH.u, ux = E.out2(seg(t, CUE.x0, CUE.x1)), rx = Math.exp(Math.log(r0x) + (Math.log(100) - Math.log(r0x)) * ux);
  const cx = PD.map((v) => v * 100.4 * (1 - E.inout2(seg(ux, 0.7, 1))));
  const xo = winOp(t, CUE.x0, CUE.melt0 - 0.4, 0.3);
  xMat.opacity = 0.9 * xo; xRing.visible = xo > 0.01;
  if (xRing.visible) {
    xRing.geometry.dispose(); xRing.geometry = new THREE.RingGeometry(Math.max(0, rx - 7 * S1 * pxw), rx, 160);
    xRing.position.fromArray(cx); xRing.quaternion.copy(camera.quaternion);
  }
  S.x7000 = [0, 1, 2].map((j) => (cx[j] + rx * (cbx.e1[j] * Math.cos(0.9) + cbx.e2[j] * Math.sin(0.9))) * k);
  // the melt: the dots fill from the bottom, the level set so the filled volume keeps pace with the counter
  dotMat.uniforms.uLevel.value = 0.985 * levelFor(E.inout2(seg(t, CUE.melt0, CUE.melt1)));
  dotMat.uniforms.uOp.value = molten * (1 - back);
  // takes over as the disc shrinks under its size; it swells once on "dwarf"
  sunDot.set({ center: [0, 0, 0], camera, px: (10 + 6 * Math.exp(-(((t - CUE.dwarf) / 0.3) ** 2))) * PXS, opacity: fadeIn(t, CUE.j0 + 1.1, 0.4) });
  const wpp = (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.length()) / H;   // units per pixel at the Sun
  S.sundot = [0, 1, 2].map((j) => 20 * S1 * wpp * (cbx.e2[j] - cbx.e1[j]) * Math.SQRT1_2);   // up-left of the dot: the anchor dot never hides it
  const fs = fadeIn(t, CUE.j0 + 1.4, 0.6);                                  // the stars: off (and unprobed) until the jump nears them
  for (const f of field) f.b.set(fs > 0 ? { center: f.p, camera, opacity: fs } : { opacity: 0 });
  const gr = PH.giant * 100 * k, onSun = shot === "sun" ? 1 : 0;
  // in once it has shrunk to its size inside the frame (it never sweeps through the spine, the caption or the note
  // above it); it leaves as the takeaway starts: the Sun, one point among many, is the subject from there
  giant.arc({ center: [0, 0, 0], r: gr, ...cbx }).set({ opacity: onSun * fadeIn(t, CUE.j1 - 0.1, 0.5) * (1 - fadeIn(t, B.takeaway.t0, 0.8)) });
  S.giant = [0, 1, 2].map((j) => gr * (cbx.e1[j] * Math.cos(-0.45) + cbx.e2[j] * Math.sin(-0.45)));
  // the readout: a teal ping on the Sun on "Light", then the light's ring out to Earth's orbit by "twenty" (Earth
  // brightens as it arrives; the ring eases out and in, so the trip reads); the light is gone before the end card, the
  // orbit leaves with its label (anchored at its foot, the pill below it)
  const orr = PH.au_r * 100 * k, onOrbit = (a) => [0, 1, 2].map((j) => orr * (cbx.e1[j] * Math.cos(a) + cbx.e2[j] * Math.sin(a)));
  const goneL = 1 - E.in3(seg(t, FILM.endCard - 0.75, FILM.endCard - 0.45)), oo = onSun * fadeIn(t, CUE.orbit, 0.8) * (1 - E.in3(seg(t, FILM.endCard - 0.45, FILM.endCard)));
  orbitE.arc({ center: [0, 0, 0], r: orr, ...cbx }).set({ opacity: oo });
  S.orbit = onOrbit(-Math.PI / 2);
  const up = seg(t, CUE.light, CUE.light + 1.2);
  ping.set({ center: [0, 0, 0], camera, px: (14 + 30 * E.out3(up)) * PXS, opacity: onSun * (up > 0 && up < 1 ? Math.min(1, up / 0.08) * (1 - E.in2(up)) : 0) });
  lightRing.arc({ center: [0, 0, 0], r: orr * E.inout2(seg(t, CUE.orbit, CUE.twenty)), ...cbx }).set({ opacity: onSun * (t >= CUE.orbit ? 1 : 0) * goneL });
  earthO.set({ center: onOrbit(0.75), camera, px: (12 + 8 * Math.exp(-(((t - CUE.twenty) / 0.25) ** 2))) * PXS, opacity: onSun * fadeIn(t, CUE.orbit, 0.8) * goneL });
  sunProbe(shot === "sun" && t > CUE.j0 && t < CUE.j1 + 0.2 ? [[60 * k, 0, 0], [0, 60 * k, 0]] : [null, null]);

  // the backdrop's stars brighten through the jump, so "among the stars" has stars before the field streams in
  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 1 + 1.5 * (shot === "sun" ? fadeIn(t, CUE.j0, 0.8) : 0), bandGain: 1 });
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
