// Meanwhile, Inside No. 01, "Single file": the picture, a pure function of t.
//
// The channel's set (films/channels/body/set, bible §5 with the cross-check's fixes) plus this episode's
// staging. Everything timed comes from film.json (compile.py hangs it on the spoken words); the look comes
// from theme.json (CSS variables, and its "scene" colours through film.json "look").
//
// The world (1 unit = 1 µm, x right, y up, z toward the viewer; vessels lie in the z = 0 plane, cut away on
// the viewer's side):
//   H     the hero's vessel, one path: an arteriole (A) that branches (bp1) into B1, which branches again
//         (bp2) into the capillary N1; N1 narrows (the ride), widens (the why), pinches, widens, narrows to
//         3 µm (the tightest), then flares into a venule V. Its widths are solved so the hero, carried by the
//         flow, reaches each feature on its word (film.json "hero").
//   N±k   neighbouring capillaries (two fed from the tree through B2 and B3), cross-links, the venule V
//   ART   a crowd of cells in an artery, far from the rest (the meet shot)
//   tissue warm cells of the surrounding tissue (cutaway.js shells), behind the net
// Cells: one InstancedMesh (≤ 400; positions computed here with setMatrixAt, folded per instance in the
// vertex shader). The hero: a cutaway.js shell folded on the CPU (so the finish's depth pass sees the fold),
// cut open three times. O₂ and the "passengers": one swarm.js InstancedMesh.
// Flow speed: v = 400 µm/s × (2.6 / r)² in the capillaries (constant flow in one tube: v ∝ 1/r²; 0.3–1 mm/s
// is the cross-check's real range), 2 and 1.3 mm/s in the arteriole and its branch; shown slowed ×100, and
// ×10 for the 3 s ride-along (film.json "clock"; the badge reads the clock).
import * as THREE from "three";
import { stage, shotAt, seg, E, hash, rng, presence } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { path, flow, tube, wrapScale, instance } from "cinema/sci/path.js";
import { swarm } from "cinema/sci/swarm.js";
import { cutaway } from "cinema/sci/cutaway.js";
import { placeCamera, focusAt } from "cinema/keys.js";
import { look } from "../set/look.js";
import { R as RC, rbcGeometry, rbcRadial, cellMaterial, foldFor, thinFor, heroDeform, halfThick, fold as foldFn } from "../set/rbc.js";
import { lining, vessel } from "../set/vessel.js";
import { beatAmp, pulseLine, iris, locator, MOTIF_CSS } from "../set/motif.js";
import { probe } from "../set/probe.js";

const FILM = window.FILM, W = window.W, H = window.H, THEME = window.THEME || { tokens: {} };
const S1 = Math.min(W, H) / 1080;
const SHOTS = FILM.shots;
const shotOf = (t) => shotAt(t, SHOTS).name;

// ── renderer, camera, look ───────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 1, 4000);
const L = look(THREE, { tokens: THEME.tokens, scene: FILM.look, W, H, backdropRadius: 2500 });
scene.add(L.lights, L.backdrop);
scene.fog = L.fog;
// kMax stays the tier's (32 final, 6 draft); the scene caps it per frame in probe mode (kCap below)
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 1.25, bloom: 0.45, maxCoc: 0.024 });
const css = document.createElement("style"); css.textContent = MOTIF_CSS + `
#hud-life .v { color: var(--pulse); }
#hud-life, #hud-tally { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
#hud-life .lb, #hud-tally .lb { color: var(--text); }
#hud-tally .v { font-size: 9.6vmin; }
.hud-end .mi-pulse { margin: 0 0 3vmin; }
.hud-title .mi-pulse { margin-top: 2.2vmin; }
`; document.head.appendChild(css);

const clk = clock(FILM.clock, { words: { slow: "{n}× slower" } });
const world = new THREE.Group(); scene.add(world);          // the vessels, the tissue: hidden in the artery shot

// ── the hero's vessel H: a gently wandering vertical line that bends into the venule at the top ──────
const wig = (y, a, b) => 6 * Math.sin(y / 90 + a) + 3 * Math.sin(y / 37 + b);
const YV = 345, Y0 = -430, SJ = 760;                        // the venule's axis; H's start; H's junction (nominal s)
const vY = (x) => YV + 3 * Math.sin(x / 60);
const HX = (y) => wig(y, 0.3, 1.1);
const hPts = [];
for (let s = 0; s <= SJ - 30; s += 20) hPts.push([HX(Y0 + s), Y0 + s, 0]);
const xJ = HX(Y0 + SJ - 30);
hPts.push([xJ + 1, vY(xJ) - 16, 0], [xJ + 7, vY(xJ) - 5, 0], [xJ + 22, vY(xJ + 22), 0], [xJ + 50, vY(xJ + 50), 0]);
for (let x = xJ + 90; x <= 360; x += 40) hPts.push([x, vY(x), 0]);
const PH = path(hPts, { up: [0, 0, 1] });
const sJ = PH.nearest([xJ + 7, vY(xJ) - 5, 0]);              // where the capillary meets the venule (true arc length)

// radius profiles from knots [s, r], eased between knots (smoothstep), and a speed law
const knots = (K) => (s) => {
  if (s <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (s <= K[i][0]) { const [a, ra] = K[i - 1], [b, rb] = K[i]; const u = b > a ? (s - a) / (b - a) : 1; return ra + (rb - ra) * u * u * (3 - 2 * u); }
  return K[K.length - 1][1];
};
const V0 = 400, capV = (r) => V0 * (2.6 / r) ** 2;            // µm/s of scene time
const VV = 600;                                              // in the venules (they gather many capillaries)
const mixV = (s, a, va, vb, w = 4) => { const u = Math.min(1, Math.max(0, (s - (a - w)) / (2 * w))); return va + (vb - va) * u * u * (3 - 2 * u); };

// ── solve the journey: lay the features out so the flow brings the hero to each on its word ──────────
const HERO = FILM.hero, ROAD = Object.fromEntries(HERO.road.map(([t, k]) => [k, t]));
const feat = { bp1: 70, bp2: 84, cap: 90, narrow: 110, wide: 300, pinch: 325, tight: 352 };
const hKnots = (f) => [[0, 5.5], [f.bp1 - 3, 5.5], [f.bp1 + 4, 4.0], [f.bp2 - 2, 4.0], [Math.max(f.bp2 + 1, f.cap), 3.0],
  [f.narrow - 10, 3.0], [f.narrow + 4, 2.3], [f.wide - 8, 2.3], [f.wide + 4, 4.15], [f.pinch - 9, 4.15], [f.pinch, 1.9],
  [f.pinch + 2.5, 1.9], [f.pinch + 4.0, 4.15], [f.tight - 9, 4.15], [f.tight, 1.5], [sJ - 72, 1.5], [sJ - 64, 2.6], [sJ - 14, 2.6], [sJ, 5.5], [PH.length + 1, 5.5]];
let hR, FH;
const hSpeed = (s) => (s < feat.bp2 + 4 ? (s < feat.bp1 + 4 ? mixV(s, feat.bp1, 2000, 1300) : mixV(s, feat.bp2, 1300, capV(hR(s)))) : s > sJ - 20 ? mixV(s, sJ - 4, capV(hR(s)), VV, 10) : capV(hR(s)));
const ADJ = { bp2: 0, cap: 0, narrow: 3, wide: -7, pinch: -0.3, tight: 0 };   // where the hero stands relative to each feature at its word
let offRoad = 0;
// one feature at a time, in order along the vessel: the features still to solve wait far ahead (so they can't
// slow the hero before its word), and each is iterated until the hero, carried by the flow, stands where it
// should at its word (the residual is reported in MI_SOLVE)
const ORDER = ["bp2", "cap", "narrow", "wide", "pinch", "tight"], RES = {};
const build = () => { hR = knots(hKnots(feat)); FH = flow(PH, { speed: hSpeed, samples: 4096 }); offRoad = FH.tau(feat.bp1) - clk.tau(ROAD.bp1); };
// f(p) = (where the hero is at the word, with the feature at p) − p falls as p grows (a feature further on
// keeps the hero longer in the slower stretch before it), so bisection finds it even where a narrowing
// speeds the hero up (a plain fixed-point iteration oscillated there)
ORDER.forEach((k, i) => {
  const miss = (p) => { feat[k] = p; for (let j = i + 1; j < ORDER.length; j++) feat[ORDER[j]] = feat[ORDER[j - 1]] + 150; build(); return FH.s(clk.tau(ROAD[k]) + offRoad) + ADJ[k] - p; };
  let lo = feat[ORDER[i - 1]] ?? feat.bp1, hi = lo + 400;
  lo += 1;
  for (let it = 0; it < 48; it++) { const m = (lo + hi) / 2; if (miss(m) > 0) lo = m; else hi = m; }
  miss((lo + hi) / 2);
});
build();
for (const k of ORDER) RES[k] = +(FH.s(clk.tau(ROAD[k]) + offRoad) + ADJ[k] - feat[k]).toFixed(4);
offRoad = FH.tau(feat.bp1) - clk.tau(ROAD.bp1);
const offHook = FH.tau(feat.wide - 8 - HERO.hook.ahead) - clk.tau(HERO.hook.at);
const offOut = FH.tau(sJ - 8) - clk.tau(HERO.out.at);
const heroS = (t, sh) => FH.s(clk.tau(t) + (sh === "hook" ? offHook : sh === "out" || sh === "tease" ? offOut : offRoad));
window.MI_SOLVE = { feat: { ...feat }, residual: RES, sJ, L: PH.length, offRoad, offHook, offOut };

// the fold along a vessel: the least fold that fits the narrowest bit under the cell (its rear lets go
// last), plus a damped spring when it lets go (the "spring back"), on a 0.25 µm grid
const foldProfile = (P, rad) => {
  const N = Math.ceil(P.length / 0.25) + 1, K = new Float32Array(N), TH = new Float32Array(N);
  let prev = 0; const rel = [];
  for (let i = 0; i < N; i++) {
    const s = i * 0.25; let rmin = Infinity;
    for (let d = -1.7; d <= 1.7; d += 0.425) rmin = Math.min(rmin, rad(Math.min(P.length, Math.max(0, s + d))));
    const k = foldFor(rmin).k;
    if (k < prev - 0.05) rel.push([s, prev - k]);
    K[i] = k; prev = k;
  }
  for (let i = 0; i < N; i++) {
    const s = i * 0.25; let os = 0;
    for (const [s0, dk] of rel) if (s > s0 && s < s0 + 9) { const d = s - s0; os -= 0.55 * dk * Math.exp(-d / 1.7) * Math.sin((Math.PI * d) / 1.9); }
    K[i] += os; TH[i] = thinFor(Math.max(0, K[i]));
  }
  return (s) => { const x = Math.min(N - 1, Math.max(0, s / 0.25)), i = Math.floor(x), f = x - i, j = Math.min(N - 1, i + 1); return [K[i] + (K[j] - K[i]) * f, TH[i] + (TH[j] - TH[i]) * f]; };
};
const hFold = foldProfile(PH, hR);

// ── the neighbours, the tree's other branches, the venule ─────────────────────────────────────────
// two venules meet above H's junction: the right one drains H, n2 and n3 (+x), the left one nm1 and nm2 (−x),
// so nothing streams past the hero when it pops out
const vPts = [], vlPts = [];
for (let x = xJ - 14; x <= 380; x += 40) vPts.push([x, vY(x), 0]);
for (let x = xJ - 10; x >= -300; x -= 40) vlPts.push([x, vY(x), 0]);
const PV = path(vPts, { up: [0, 0, 1] }), PVL = path(vlPts, { up: [0, 0, 1] });
const capPath = (x0, y0, a, b, extra = [], dir = 1) => {
  const pts = [...extra];
  for (let y = y0; y <= YV - 50; y += 22) pts.push([x0 + wig(y, a, b), y, 0]);
  const xe = x0 + wig(YV - 50, a, b);
  if (dir === 0) {   // dives away from the viewer into the tissue (its venule is out of view), so the venule the hero
    // pops out into carries no one else's cells
    pts.push([xe, YV - 34, -4], [xe + 2, YV - 24, -22], [xe + 4, YV - 18, -60], [xe + 5, YV - 14, -110], [xe + 6, YV - 11, -170]);
    return { pts, junction: [xe + 2, YV - 24, -22] };
  }
  pts.push([xe + dir, vY(xe) - 16, 0], [xe + 7 * dir, vY(xe) - 5, 0], [xe + 22 * dir, vY(xe + 22 * dir), 0], [xe + 50 * dir, vY(xe + 50 * dir), 0]);
  for (let x = xe + 90 * dir; dir > 0 ? x <= 380 : x >= -300; x += 40 * dir) pts.push([x, vY(x), 0]);
  return { pts, junction: [xe + 7 * dir, vY(xe) - 5, 0] };
};
const hHead = (sEnd) => { const out = []; for (let s = 0; s < sEnd - 6; s += 15) out.push(PH.at(s)); out.push(PH.at(sEnd)); return out; };
const bp1 = PH.at(feat.bp1), bp2 = PH.at(feat.bp2);
const NB = [
  // id, x offset, wiggle phases, feeds from (tree branch), capillary radius knots (relative)
  { id: "nm1", x: -48, a: 1.7, b: 0.2, from: "bp1" },
  { id: "n2", x: 46, a: 2.6, b: 2.0, from: "bp2" },
  { id: "nm2", x: -96, a: 0.9, b: 2.9, from: null, y0: Y0 + 40 },
  { id: "n3", x: 93, a: 3.4, b: 0.7, from: null, y0: Y0 + 60 },
];
for (const nb of NB) {
  let head = [], y0 = nb.y0;
  if (nb.from === "bp1") { const p = bp1; head = [...hHead(feat.bp1), [p[0] - 10, p[1] + 14, 0], [p[0] - 26, p[1] + 34, 0]]; y0 = p[1] + 58; }
  if (nb.from === "bp2") { const p = bp2; head = [...hHead(feat.bp2), [p[0] + 9, p[1] + 13, 0], [p[0] + 24, p[1] + 32, 0]]; y0 = p[1] + 54; }
  const c = capPath(nb.x, y0, nb.a, nb.b, head, nb.x < 0 ? -1 : 0);
  nb.P = path(c.pts, { up: [0, 0, 1] });
  nb.sB = nb.from === "bp1" ? nb.P.nearest(bp1) : nb.from === "bp2" ? nb.P.nearest(bp2) : 0;
  nb.sCap = nb.from ? nb.P.nearest(c.pts[head.length]) : 0;
  nb.sJ = nb.P.nearest(c.junction);
  const r0 = nb.from === "bp1" ? 3.8 : 3.4, rr = (k) => 2.45 + 0.35 * hash(k + nb.x * 7);
  const K = nb.from ? [[0, 5.5], [nb.from === "bp1" ? nb.sB - 3 : nb.sB - 2, nb.from === "bp1" ? 5.5 : 4.0], [nb.sB + 5, r0], [nb.sCap, r0], [nb.sCap + 14, rr(1)]] : [[0, rr(1)]];
  const sStart = nb.from ? nb.sCap + 14 : 0;
  for (let k = 1; k <= 6; k++) { const s = sStart + ((nb.sJ - 30 - sStart) * k) / 7; K.push([s, rr(k + 1)]); }
  K.push([nb.sJ - 14, 2.6], [nb.sJ, 5.5], [nb.P.length + 1, 5.5]);
  nb.R = knots(K);
  const sCapEnd = nb.from ? nb.sCap : -1;
  const vb = (s) => (s > nb.sJ - 20 ? mixV(s, nb.sJ - 4, capV(nb.R(s)), VV, 10) : capV(nb.R(s)));
  nb.F = flow(nb.P, { speed: (s) => (nb.from && s < nb.sB + 4 ? mixV(s, nb.sB, nb.from === "bp1" ? 2000 : 1300, 1300) : nb.from && s < sCapEnd ? mixV(s, sCapEnd, 1300, vb(s)) : vb(s)) });
  nb.fold = foldProfile(nb.P, nb.R);
}

// ── vessel meshes ─────────────────────────────────────────────────────────────────────────────────
const TEX = lining(THREE, { seed: 3 });
const VESSELS = [];
const addVessel = (P, o) => { const v = vessel(THREE, L, P, { tex: TEX, ...o }); world.add(v.group); VESSELS.push(v); return v; };
const wallH = (s) => (s < feat.bp2 + 4 ? 1.6 : s > sJ - 4 ? 1.0 : 0.5);
addVessel(PH, { radius: hR, wall: wallH, s0: 0, s1: sJ + 4, radial: 26, step: 1.5 });
addVessel(PV, { radius: 5.5, wall: 1.0, radial: 28, step: 3 });
addVessel(PVL, { radius: 5.5, wall: 1.0, radial: 28, step: 3 });
for (const nb of NB) {
  const s0 = nb.from ? nb.sB - 1 : 0;
  addVessel(nb.P, { radius: nb.R, wall: (s) => (s < nb.sCap ? 1.4 : 0.5), s0, s1: nb.sJ + 4, radial: 20, step: 2.5 });
}
// cross-links: short capillaries between neighbours (no cells: a quiet anastomosis)
const LINKS = [[-96, -48, -150], [-48, 0, 30], [0, 46, -60], [46, 93, 120], [-96, -48, 200], [0, 46, 250], [46, 93, -210]];
for (const [xa, xb, y] of LINKS) {
  const xa1 = xa + wig(y, ...(xa === 0 ? [0.3, 1.1] : [NB.find((n) => n.x === xa).a, NB.find((n) => n.x === xa).b]));
  const xb1 = xb + wig(y + 18, ...(xb === 0 ? [0.3, 1.1] : [NB.find((n) => n.x === xb).a, NB.find((n) => n.x === xb).b]));
  const P = path([[xa1, y, 0], [(xa1 + xb1) / 2, y + 12, 0], [xb1, y + 18, 0]], { up: [0, 0, 1] });
  addVessel(P, { radius: 2.3, wall: 0.45, radial: 16, step: 3 });
}

// ── the tissue around the net: warm cells, never on near-black (cross-check) ─────────────────────────
const tissueMat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin(FILM.look.tissue || "#F0C9B8").multiplyScalar(0.62), emissive: L.lin(FILM.look.tissue || "#F0C9B8"), emissiveIntensity: 0.1, roughness: 0.85 }), { fresnel: 0.45, fresnelPower: 2.2, key: "tissue" });
const TISSUE = [];
{
  const r = rng(91);
  // tissue cells behind the vessels: out of focus behind every close-up, a warm ground for the green
  // (hidden in the net shot, where at that scale they would read as loose stones and crowd the net)
  for (const xc of [-140, -118, -72, -24, 23, 69, 116, 140]) for (let y = -330; y <= 330; y += 46) {
    if (r() < 0.38) continue;
    const rad = 7 + 6 * r(), x = xc + (r() - 0.5) * 14, yy = y + (r() - 0.5) * 34;
    const C = cutaway({ radius: rad * 1.45, noise: { amp: 0.16, freq: 1.7, seed: 1 + TISSUE.length }, segments: [36, 24], material: tissueMat });
    C.group.position.set(x, yy, -(rad * 1.45 * 0.7 + 18 + 16 * r()));
    C.group.scale.set(1, 1.15, 0.7);
    C.group.rotation.set(r() * 3, r() * 3, r() * 3);
    world.add(C.group); TISSUE.push(C.group);
  }
}
// static points for the probe: the back walls of every vessel and the tissue (camera motion, measured right)
const STATIC = [];
for (const v of VESSELS) { const P = v.path; for (let s = 0; s <= P.length; s += 6) { const F = P.frame(s), r = v.radius(s); STATIC.push([F.p[0] - F.n[0] * r, F.p[1] - F.n[1] * r, F.p[2] - F.n[2] * r]); } }
for (const g of TISSUE) STATIC.push([g.position.x, g.position.y, g.position.z + 6]);

// ── cells: one InstancedMesh, folded per instance in the vertex shader ──────────────────────────────
const NCELL = 400;
const cellGeo = rbcGeometry(THREE, { around: 22, along: 18 });
const aFold = new THREE.InstancedBufferAttribute(new Float32Array(NCELL * 2), 2); aFold.setUsage(THREE.DynamicDrawUsage);
cellGeo.setAttribute("aFold", aFold);
const cellMat = cellMaterial(THREE, L, { rbc: FILM.look.rbc, deep: FILM.look["rbc-deep"] });
const cells = new THREE.InstancedMesh(cellGeo, cellMat, NCELL);
cells.frustumCulled = false; cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
for (let i = 0; i < NCELL; i++) { const v = 0.9 + 0.2 * hash(i + 17); cells.setColorAt(i, new THREE.Color(v, v * (0.97 + 0.06 * hash(i + 3)), v)); }
scene.add(cells);

// the streams: H's companions (single file around the hero), and a looping file on each neighbour route
const GAP = 0.04;                                             // scene seconds between cells (16 µm apart in a 5 µm capillary, closer where it widens)
const NCOMP = 14;                                            // companions ahead and behind the hero
const ROUTES = NB.map((nb, k) => ({ nb, n: Math.min(60, Math.floor(nb.F.T / GAP)), phase: 0.3 * k + 0.011 * k * k }));
let nSlots = 2 * NCOMP;
for (const R of ROUTES) { R.slot0 = nSlots; nSlots += R.n; }
if (nSlots > NCELL) throw new Error(`cells: ${nSlots} slots > ${NCELL}`);
window.MI_SOLVE.cellSlots = nSlots;
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), vT = new THREE.Vector3(), vU = new THREE.Vector3(0, 1, 0), eul = new THREE.Euler();
const cellQuat = (tan, r, i, tau, out) => {
  // in a narrow vessel the cell faces the flow (axis along it); in a wide one it tumbles freely
  qA.setFromUnitVectors(vU, vT.set(tan[0], tan[1], tan[2]));
  const w = Math.min(1, Math.max(0, (r - 3.9) / 1.4));
  if (w > 0) { eul.set(hash(i * 3 + 1) * 6.28 + tau * 9 * (hash(i) - 0.5), hash(i * 3 + 2) * 6.28 + tau * 7, hash(i * 3 + 3) * 6.28); qB.setFromEuler(eul); out.copy(qA).slerp(qB, w); }
  else out.copy(qA);
  return out;
};
const lateral = (P, s, r, i) => {       // cells spread across a wide vessel, centred in a narrow one
  const free = Math.max(0, r - 3.9), F = P.frame(s), a = hash(i * 7 + 5) * 6.283, m = Math.sqrt(hash(i * 7 + 6)) * free;
  return [F.p[0] + (F.n[0] * Math.cos(a) + F.b[0] * Math.sin(a)) * m, F.p[1] + (F.n[1] * Math.cos(a) + F.b[1] * Math.sin(a)) * m, F.p[2] + (F.n[2] * Math.cos(a) + F.b[2] * Math.sin(a)) * m];
};
const q0 = new THREE.Quaternion();
const CELLSTATE = new Array(NCELL);
const writeCells = (t, sh) => {
  const tau = clk.tau(t);
  for (let i = 0; i < NCELL; i++) CELLSTATE[i] = null;
  if (sh === "meet") {
    for (let i = 0; i < CROWD.n; i++) {
      const p = CROWD.at(i, t), sc = 1;
      eul.set(hash(i + 200) * 6.28 + t * 0.13 * (hash(i + 201) - 0.5), hash(i + 202) * 6.28 + t * 0.11, hash(i + 203) * 6.28); q0.setFromEuler(eul);
      instance(cells, i, p, q0, sc); aFold.setXY(i, 0, 1);
      CELLSTATE[i] = { p, scale: sc, wrap: false };
    }
    for (let i = CROWD.n; i < NCELL; i++) { instance(cells, i, ART, null, 0); aFold.setXY(i, 0, 1); }
  } else {
    const off = sh === "hook" ? offHook : sh === "out" || sh === "tease" ? offOut : offRoad, th0 = tau + off;
    for (let j = 0; j < 2 * NCOMP; j++) {
      const k = j < NCOMP ? j + 1 : -(j - NCOMP + 1), tk = th0 + k * GAP;
      const s = FH.s(tk), inside = tk > 0 && tk < FH.T;
      const sc = inside ? wrapScale(s, PH.length, 6) : 0, r = hR(s), [kf, th] = hFold(s);
      const p = lateral(PH, s, r, j + 1000);
      instance(cells, j, p, cellQuat(PH.tangent(s), r, j, tau, q0), sc); aFold.setXY(j, kf, th);
      CELLSTATE[j] = { p, scale: sc, wrap: sc < 0.999 };
    }
    for (const R of ROUTES) {
      const { nb, n, slot0 } = R, Lr = nb.P.length;
      for (let i = 0; i < n; i++) {
        const tk = tau + R.phase - i * (nb.F.T / n), s = nb.F.wrapS(tk), sc = wrapScale(s, Lr, 8), r = nb.R(s), [kf, th] = nb.fold(s);
        const p = lateral(nb.P, s, r, slot0 + i);
        instance(cells, slot0 + i, p, cellQuat(nb.P.tangent(s), r, slot0 + i, tau, q0), sc); aFold.setXY(slot0 + i, kf, th);
        CELLSTATE[slot0 + i] = { p, scale: sc, wrap: s < 8 || s > Lr - 8 };
      }
    }
    for (let i = nSlots; i < NCELL; i++) { instance(cells, i, PH.at(0), null, 0); aFold.setXY(i, 0, 1); }
  }
  cells.instanceMatrix.needsUpdate = true; aFold.needsUpdate = true;
};

// ── the artery's crowd (the meet shot): drifting, tumbling discs around the hero, a clear lane for the lens ──
const ART = [-2000, 0, 0];
const CROWD = swarm({
  n: 210, seed: 23, waves: [{ amp: [1.6, 1.2, 1.4], omega: 0.35 }, { amp: 0.5, omega: 0.9 }],
  home: (i, r) => {
    for (let tries = 0; tries < 200; tries++) {
      const z = 2 * r() - 1, a = 6.283 * r(), q = Math.sqrt(1 - z * z), rr = 10 + 62 * Math.cbrt(r());
      const p = [q * Math.cos(a) * rr * 1.1, q * Math.sin(a) * rr * 1.3, z * rr];
      // keep a lane free along the camera's path (from (0, 0, 22) out to (20, 18, 100)): no cell near the lens
      const u = Math.max(0, Math.min(1, (p[2] - 18) / 82)), lane = [20 * u, 18 * u, 18 + 82 * u];
      if (p[2] > 12 && Math.hypot(p[0] - lane[0], p[1] - lane[1]) < 17 + 6 * u) continue;
      if (Math.hypot(p[0], p[1], p[2]) < 10) continue;
      return [ART[0] + p[0], ART[1] + p[1], ART[2] + p[2]];
    }
    return [ART[0] + 60, ART[1], ART[2] - 40];
  },
});

// ── the hero: a cutaway shell, folded on the CPU, cut open toward the camera ─────────────────────────
const heroMat = cellMaterial(THREE, L, { rbc: FILM.look.rbc, deep: FILM.look["rbc-deep"], instanced: false, fresnel: 0.26 });
// the cut face: the cell's inside, a uniform haemoglobin red (no nucleus), a shade apart from the outside
// the cut face: the cell's inside, a uniform haemoglobin red (no nucleus), a shade apart from the outside, with
// its membrane drawn as a thin light line along the cut edge (cutaway.js capEdge: 0 centre → 1 outline)
const capMat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin("#D44A62"), emissive: L.lin("#E5334F"), emissiveIntensity: 0.06, roughness: 0.5, side: THREE.DoubleSide }), { fresnel: 0.05, key: "cap" });
{
  const prev = capMat.onBeforeCompile, mem = L.lin("#F6A3B0");
  capMat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.uniforms.uMem = { value: mem };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float capEdge; varying float vEdge;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvEdge = capEdge;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uMem; varying float vEdge;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb *= 1.0 - 0.28 * vEdge * vEdge;\n  diffuseColor.rgb = mix(diffuseColor.rgb, uMem, smoothstep(0.935, 0.975, vEdge));");
  };
}
const HC = cutaway({ radial: rbcRadial, segments: [112, 84], capSegments: 200, material: heroMat, capMaterial: capMat });
scene.add(HC.group);
// the ghost: the cell's undeformed outline, beside the folded one in the 3 µm vessel ("less than half its width")
const ghost = new THREE.Mesh(rbcGeometry(THREE, { around: 48, along: 32 }), new THREE.ShaderMaterial({
  uniforms: { uCol: { value: L.lin(THEME.tokens.text || "#EFF6F2") }, opacity: { value: 0 } }, transparent: true, depthWrite: false, depthTest: false,
  vertexShader: "varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
  fragmentShader: "uniform vec3 uCol; uniform float opacity; varying vec3 vN, vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uCol * 1.6, opacity * (0.12 + 0.88 * smoothstep(0.55, 0.97, f))); }",
}));
ghost.renderOrder = 5; scene.add(ghost);

const qH = new THREE.Quaternion(), qC = new THREE.Quaternion(), vC = new THREE.Vector3(), vD = new THREE.Vector3(), m3 = new THREE.Matrix4();
const keyed1 = (keys, t) => { if (!keys || !keys.length) return 0; if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return va + (vb - va) * E.inout3(seg(t, a, b)); } return keys[keys.length - 1][1]; };
// the meet shot's turn, relative to the camera: "face" (axis toward the lens, tilted), "edge" (axis across the view)
const turnQuat = (name, t, out) => {
  const back = vC.copy(camera.position).sub(heroPos3).normalize(), up = vD.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3().crossVectors(up, back).normalize();
  let axis;
  if (name === "face") axis = back.clone().multiplyScalar(0.92).add(up.clone().multiplyScalar(0.3)).add(right.clone().multiplyScalar(0.2)).normalize();
  else if (name === "edge") axis = up.clone().multiplyScalar(0.94).add(back.clone().multiplyScalar(0.12)).add(right.clone().multiplyScalar(-0.3)).normalize();
  else { const a = 0.35 * (t - 13); axis = up.clone().multiplyScalar(Math.cos(a)).add(back.clone().multiplyScalar(0.2 + 0.3 * Math.sin(a))).add(right.clone().multiplyScalar(Math.sin(a) * 0.6)).normalize(); }
  return out.setFromUnitVectors(vU, axis);
};
const heroPos3 = new THREE.Vector3();
const hero = { p: [0, 0, 0], s: 0, k: 0, th: 1, cut: 0 };
const placeHero = (t, sh) => {
  if (sh === "meet") { hero.p = ART.slice(); hero.s = -1; hero.k = 0; hero.th = 1; }
  else { const s = heroS(t, sh); hero.s = s; hero.p = PH.at(s); [hero.k, hero.th] = hFold(s); }
  heroPos3.set(hero.p[0], hero.p[1], hero.p[2]);
};
const orientHero = (t, sh) => {
  if (sh === "meet") {
    const T = HERO.meet.turn; let i = 0; for (let k = 0; k < T.length; k++) if (t >= T[k][0]) i = k;
    turnQuat(T[i][1], t, qH);
    if (i + 1 < T.length && T[i + 1][1] !== T[i][1]) { const u = E.inout3(seg(t, T[i][0], T[i + 1][0])); turnQuat(T[i + 1][1], t, qC); qH.slerp(qC, u); }
  } else {
    // the hero never tumbles: its axis follows its vessel, and stays upright once it is out in the venule
    const tg = PH.tangent(hero.s), w = E.inout3(seg(hero.s, sJ - 12, sJ - 2));
    cellQuat(w > 0 ? [tg[0] * (1 - w), tg[1] * (1 - w) + w, tg[2] * (1 - w)].map((x, i, a) => x / Math.hypot(...a)) : tg, Math.min(3.8, hR(hero.s)), 9999, clk.tau(t), qH);
  }
  HC.group.position.copy(heroPos3); HC.group.quaternion.copy(qH);
  // the cut: a plane through the cell's axis whose normal points at the lens (so the open face looks at us)
  const cutK = sh === "meet" ? HERO.meet.cut : sh === "road" ? HERO.why_cut : sh === "tease" ? HERO.tease_cut : null;
  hero.cut = cutK ? keyed1(cutK, t) : 0;
  let cut = null;
  if (hero.cut > 0.001) {
    const local = vC.copy(camera.position).sub(heroPos3).applyQuaternion(qC.copy(qH).invert());
    local.y = 0; if (local.lengthSq() < 1e-9) local.set(0, 0, 1); local.normalize();
    cut = { n: [+local.x.toFixed(4), 0, +local.z.toFixed(4)], d: +(RC * 1.02 * (1 - E.out3(hero.cut))).toFixed(4) };
  }
  HC.set({ cut, deform: heroDeform(+hero.k.toFixed(4), +hero.th.toFixed(4)) });
  HC.update();
};
const heroWorld = (p) => vC.set(p[0], p[1], p[2]).applyQuaternion(qH).add(heroPos3).toArray();
const capWorld = () => (HC.cap.visible ? heroWorld(HC.capCentre()) : hero.p.slice());

// ── O₂ leaving the capillary (takeaway) and the passengers inside the cut cell (tease): one swarm mesh ──
const O2N = 110, PAXN = 170, sO2 = FILM.o2 ?? (FILM.labels.find((l) => l.id === "o2") || {}).t0 ?? 56.5;   // the swarm leaves on "oxygen"; its label lands later
const O2 = swarm({
  n: O2N, seed: 5, waves: [{ amp: 0.3, omega: 1.6 }, { amp: 0.1, omega: 3.2 }],
  home: (i, r) => { const s = sJ - 44 + 34 * r(), a = 6.283 * r(), F = PH.frame(s), m = 1.2 * Math.sqrt(r()); return [F.p[0] + F.b[0] * Math.cos(a) * m + F.n[0] * Math.sin(a) * m, F.p[1] + F.b[1] * Math.cos(a) * m, F.p[2] + Math.sin(a) * m - 0.3]; },
  target: (i, r) => { const s = sJ - 48 + 42 * r(), F = PH.frame(s), side = r() < 0.5 ? -1 : 1, m = 4 + 11 * r(); return [F.p[0] + F.b[0] * side * m, F.p[1] + F.b[1] * side * m + (r() - 0.5) * 4, -1.5 - 5 * r()]; },
  move: { t0: sO2 - 1.1, d: 2.6, stagger: 1.2 },
});
const o2Hero = (() => {   // the label's particle: out of the vessel early, on the right, toward the top of the view
  const c = PH.at(sJ - 20); let best = 0, bs = -Infinity;
  for (let i = 0; i < O2N; i++) { const g = O2.target(i), sc = 3 * O2.mix(i, sO2 + 0.3) + (g[0] > c[0] + 5 ? 1 : -9) + (g[1] - c[1]) / 6; if (sc > bs) { bs = sc; best = i; } }
  return best; })();
const PAX = swarm({
  n: PAXN, seed: 11, waves: [{ amp: 0.06, omega: 1.3 }],
  home: (i, r) => { for (;;) { const x = (2 * r() - 1) * RC * 0.94, h = halfThick(Math.abs(x)) * 0.86, y = (2 * r() - 1) * h; if (Math.abs(y) <= h) return [x, y, 0.02 + 0.05 * r()]; } },
});
const swMat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin(THEME.tokens.o2 || "#FFFFFF"), emissive: L.lin("#FFFFFF"), emissiveIntensity: 0.35, roughness: 0.35 }), { fresnel: 0.1, key: "o2" });
const swMesh = O2.mesh(new THREE.IcosahedronGeometry(1, 2), swMat, O2N + PAXN);
scene.add(swMesh);
const SWSTATE = new Array(O2N + PAXN);
const writeSwarm = (t, sh) => {
  const showO2 = sh === "out" ? presence(t, sO2 - 1.0, FILM.shots.find((s) => s.name === "tease").at - 0.6, { d: 0.6, out: 0.5 }).o : 0;
  for (let i = 0; i < O2N; i++) {
    const p = O2.at(i, t), sc = showO2 * 0.32 * Math.min(1, O2.mix(i, t) * 3 + 0.25);
    instance(swMesh, i, p, null, sc); SWSTATE[i] = { p, scale: sc };
  }
  const open = sh === "tease" ? E.out3(seg(hero.cut, 0.55, 1)) : 0, sparkle = sh === "tease" ? seg(t, FILM.hero.sparkle[0], FILM.hero.sparkle[0] + 0.5) * (1 - seg(t, FILM.hero.sparkle[1], FILM.hero.sparkle[1] + 0.6)) : 0;
  const capN = HC.cap.visible ? new THREE.Vector3(...(HC.cap.geometry.attributes.normal.array.slice(0, 3))) : null;
  for (let i = 0; i < PAXN; i++) {
    let p = hero.p, sc = 0;
    if (open > 0 && capN) {
      const h = PAX.at(i, t), cc = HC.capCentre();
      // homes are in the plane of the cut: x across the cell, y along its axis, z out of the face
      const n = capN, ax = new THREE.Vector3(0, 1, 0), ac = new THREE.Vector3().crossVectors(ax, n).normalize();
      const lp = new THREE.Vector3(cc[0], cc[1], cc[2]).addScaledVector(ac, h[0]).addScaledVector(ax, h[1]).addScaledVector(n, h[2]);
      p = heroWorld(lp.toArray());
      sc = open * (0.075 + 0.02 * hash(i + 77)) * (1 + 0.35 * sparkle * (0.5 + 0.5 * Math.sin(t * 9 + i)));
    }
    instance(swMesh, O2N + i, p, null, sc); SWSTATE[O2N + i] = { p, scale: sc };
  }
  swMat.emissiveIntensity = 0.35 + 1.1 * sparkle;
  swMesh.instanceMatrix.needsUpdate = true;
};

// ── the overlay ─────────────────────────────────────────────────────────────────────────────────
const hud = createHud({ camera });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tPulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(70 * S1), at: 0.3 });
titleEl.appendChild(tPulse.el);
const ANCH = {
  hero: () => { const r = Math.max(1.4, 2.6 * (1 - hero.k * 0.35)); return heroWorld([r * 0.7, 0.2, r * 0.7]); },
  cap: () => capWorld(),
  capwall: () => { const s = feat.cap + 10, r = hR(s), F = PH.frame(s), a = Math.PI * 1.2; return [F.p[0] + (F.n[0] * Math.cos(a) + F.b[0] * Math.sin(a)) * r, F.p[1] + (F.n[1] * Math.cos(a) + F.b[1] * Math.sin(a)) * r, F.p[2] + (F.n[2] * Math.cos(a) + F.b[2] * Math.sin(a)) * r]; },
  o2: (t) => O2.at(o2Hero, t),
  ghost: () => { const r = vD.set(1, 0, 0).applyQuaternion(camera.quaternion); return [hero.p[0] + r.x * RC, hero.p[1] + r.y * RC, hero.p[2] + r.z * RC]; },
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, glyph: lb.glyph, mark: lb.mark, color: lb.color, at: (t) => ANCH[lb.at](t), t0: lb.t0, t1: lb.t1, shot: lb.shot, side: lb.side });
hud.badge("warp", { from: clk, slot: "tl" });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: "tl" });
// a pill's bar is its length at the hero, on screen. hud.js clamps a bar to 4 px–60 % of the safe width, and a
// clamped bar no longer matches its text (the meet close-up's 7.5 µm is 690–860 px at 1080 wide), so a length that
// would be clamped shows no bar: the pill keeps its text alone
const barPx = (len) => () => {
  const p = hero.p, right = vD.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const a = hud.project(p), b = hud.project([p[0] + right.x * len, p[1] + right.y * len, p[2] + right.z * len]);
  if (!a.front || !b.front) return null;
  const px = Math.hypot(b.x - a.x, b.y - a.y);
  return px >= 4 * S1 && px <= (hud.safe.r - hud.safe.l) * 0.6 ? px : null;
};
for (const sp of FILM.scales) hud.scale(sp.id, { text: sp.text, bar: barPx(sp.len), t0: sp.t0, t1: sp.t1, at: sp.pos });
hud.counter("life", { keys: FILM.life.keys, fmt: (v) => String(Math.round(v)), unit: FILM.life.unit, label: FILM.life.label, t0: FILM.life.t0, t1: FILM.life.t1, at: [0.458, 0.235], minCh: 3, ease: "lin" });
const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const tallyEl = hud.counter("tally", { value: (t) => FILM.tally.rate * t, fmt: commas, label: FILM.tally.label, t0: FILM.tally.t0, t1: FILM.tally.t1, at: [0.458, 0.29], minCh: 10 });
const yPulse = pulseLine({ width: Math.round(560 * S1), height: Math.round(58 * S1), at: 0.5 });
tallyEl.appendChild(yPulse.el);
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const ePulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(64 * S1), at: 0.25 });
endEl.insertBefore(ePulse.el, endEl.firstChild);
const stageEl = document.querySelector(".stage");
const IR = iris(stageEl, { events: FILM.iris });
const LOC = locator(document.getElementById("hud"), { x: 92 * S1, y: 318 * S1, h: 232 * S1, region: [0.83, 0.5] });
const MEET = SHOTS.find((s) => s.name === "meet"), TREE = SHOTS.find((s) => s.name === "tree");
const lubs = (t0, t1) => { const out = []; for (let k = Math.ceil(t0 / 0.8); k * 0.8 <= t1; k++) out.push(+(k * 0.8).toFixed(4)); return out; };
const MEET_BEATS = lubs(MEET.at, TREE.at);

// ── focus: keys per shot, live targets ──────────────────────────────────────────────────────────
const TARGETS = {
  hero: () => hero.p, cap: () => capWorld(),
  ahead: () => PH.at(hero.s + 14),
  below: () => PH.at(sJ - 22),
};
window.CINEMA_FOCUS = (t) => focusAt(FILM.foc[shotOf(t)] || FILM.foc.hook, t, { targets: TARGETS });

// ── the probe (set/probe.js) and the K cap: 12, or 16 for the ride-along's streaming walls ────────────
const PR = probe(THREE, { W, H, near: 15, ndc: 1.15 });
let TIER_KMAX = null;
const kCap = (t) => (t >= FILM.ride[0] && t < FILM.ride[1] + 0.2 ? 16 : 12);
const probeAll = (t, sh) => {
  PR.begin(camera);
  for (let i = 0; i < NCELL; i++) { const c = CELLSTATE[i]; if (c && c.scale > 0.15 && !c.wrap) PR.add(`c${i}`, c.p); }
  PR.add("h", hero.p);
  // the hero's rim, folded: the fold is a vertex morph the finish can't see, so its own points are sampled
  for (const [k, p] of [[0, [RC, 0, 0]], [1, [-RC, 0, 0]], [2, [0, 0, RC]], [3, [0, 0, -RC]], [4, [0, 0.4, 0]]]) PR.add(`hr${k}`, heroWorld(foldPoint(p)));
  for (let i = 0; i < SWSTATE.length; i += 3) { const s = SWSTATE[i]; if (s && s.scale > 0.02) PR.add(`o${i}`, s.p); }
  if (sh !== "meet") for (let i = 0; i < STATIC.length; i++) PR.add(`w${i}`, STATIC[i]);
};
const foldPoint = (p) => foldFn(p, [0, 1, 0], hero.k, hero.th).p;

// ── seek ────────────────────────────────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  const sh = shotOf(t), C = window.CINEMA;
  placeHero(t, sh);
  // the camera rides on the hero; in the takeaway it hands over to the capillary the hero left
  const capPt = PH.at(sJ - 20), hand = sh === "out" ? E.inout3(seg(t, HERO.out.track[0], HERO.out.track[1])) : 0;
  const track = hand > 0 ? hero.p.map((x, i) => x + (capPt[i] - x) * hand) : hero.p;
  placeCamera(camera, FILM.cam[sh], t, { track: () => track, handheld: 0 });
  camera.near = 1; camera.far = 4000; camera.updateProjectionMatrix();
  orientHero(t, sh);
  const F = window.CINEMA_FOCUS(t), fd = Math.hypot(F.point[0] - camera.position.x, F.point[1] - camera.position.y, F.point[2] - camera.position.z);
  L.place(camera, F.point);
  scene.fog.density = 0.25 / Math.max(10, fd);
  world.visible = sh !== "meet";
  for (const g of TISSUE) g.visible = sh !== "net";
  writeCells(t, sh);
  writeSwarm(t, sh);
  // the ghost outline: only in the tightest vessel, beside the folded cell
  const g = sh === "road" ? presence(t, FILM.ghost[0], FILM.ghost[1] - 0.25, { d: 0.45, out: 0.25 }).o : 0;
  ghost.visible = g > 0.001; ghost.material.uniforms.opacity.value = 0.85 * g;
  ghost.position.copy(heroPos3); ghost.quaternion.copy(qH);
  // the overlay and its motifs
  hud.update(t);
  tPulse.update(beatAmp(t, [FILM.title.sig, FILM.title.sig + 0.4], { rest: 0.5 }));
  yPulse.update(beatAmp(t, FILM.segBeats));
  ePulse.update(beatAmp(t, [FILM.endCard, FILM.endCard + 0.4], { flat: FILM.endCard + 1.2, rest: 0.6 }));
  const lp = sh === "meet" ? presence(t, MEET.at + 0.35, TREE.at - 0.45, { d: 0.45, out: 0.35 }).o : 0;
  LOC.update(t, lp, beatAmp(t, MEET_BEATS));
  IR.update(t);
  if (C && C.mode === "probe") {
    if (TIER_KMAX == null) TIER_KMAX = C.kMax;
    C.kMax = Math.min(TIER_KMAX, kCap(t));
    probeAll(t, sh);
    scene.visible = false; renderer.render(scene, camera); scene.visible = true;
    return;
  }
  renderer.render(scene, camera);
};
window.SCENE_READY = Promise.resolve();
