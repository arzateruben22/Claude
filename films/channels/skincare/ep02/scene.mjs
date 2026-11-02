import * as THREE from "three";
// Outer Layer No. 002, "Does SPF 100 beat SPF 50?" (films/channels/skincare/ep02). The picture as a pure function of
// t for the film kit's page: window.seek(t) sets the shot, the camera, the films, the rays and the overlay from t
// alone, then makes exactly one renderer.render().
//
// The set is the channel's section (../set/section.js), UV rays and the sunscreen film (../set/rays.js), the depth
// gauge with its film bar and the layer-bar motif (../set/motif.js) and the microscope-stage rig (../set/rig.js).
//
// Shots: hook (two blocks, SPF 50 and 100, rays falling) · ratio (one block, half bare, half filmed; the bare half
// reddens) · count (from above: a hundred rays land on one film, two get through, then one) · inside (low, under the
// two films: only what gets in is lit) · thin (one block, its film thinning as more gets through) · gauge (the to-
// scale card) · close (the hook again, for the loop).
// Honesty (film.json "badges"): "model: one UVB band" (the rays, 1/SPF let through), "at the test layer, 2 mg/cm²",
// "illustration · debated" (the thin film's share), the review's name and year.
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { createSection } from "../set/section.js";
import { createRays, createFilm } from "../set/rays.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { lin } from "../set/look.js";

const FILM = window.FILM, W = window.W, H = window.H, UV = FILM.uv, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 2, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.92, bloom: 0.3, exposure: 1.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

scene.add(new THREE.HemisphereLight(0xf4f8ff, 0xe8ddd4, 1.25));
const key = new THREE.DirectionalLight(0xfff6ec, 2.1); key.position.set(-120, 220, 160); scene.add(key);
const rim = new THREE.DirectionalLight(0xe8f2ff, 0.7); rim.position.set(80, 60, -200); scene.add(rim);

// ── the set ─────────────────────────────────────────────────────────────────
const LAY = { rows: 15, sc: 17, gran: 10, spin: 48, basal: 10 };
const WL = createSection({ width: 60, depth: 46, ...LAY, seed: 21, x: -36 }), WR = createSection({ width: 60, depth: 46, ...LAY, seed: 22, x: 36 });
const S = createSection({ width: 120, depth: 50, ...LAY, seed: 23 });             // ratio, thin, gauge
const SC = createSection({ width: 100, depth: 100, ...LAY, seed: 24 });           // count (seen from above: a square)
scene.add(WL.group, WR.group, S.group, SC.group);
const FL = createFilm({ width: 60, depth: 46, x: -36 }), FR = createFilm({ width: 60, depth: 46, x: 36 });
const FH = createFilm({ width: 60, depth: 50, x: 30 });                           // the ratio's filmed half
const FS = createFilm({ width: 120, depth: 50 }), FC = createFilm({ width: 100, depth: 100 });
scene.add(FL.mesh, FR.mesh, FH.mesh, FS.mesh, FC.mesh);
// rays start a short way above the films (not up through the title band) and are drawn thin and crisp
const RL = createRays({ n: 100, x: [-28, 28], z: [-18, 21], top: 70, seed: 31, width: 0.4, len: 7 }), RR = createRays({ n: 100, x: [-28, 28], z: [-18, 21], top: 70, seed: 32, width: 0.4, len: 7 });
const RB = createRays({ n: 40, x: [-58, -4], z: [-20, 23], top: 70, seed: 33, width: 0.4, len: 7 }), RH = createRays({ n: 40, x: [4, 58], z: [-20, 23], top: 70, seed: 34, width: 0.4, len: 7 });
const RS = createRays({ n: 100, x: [-56, 56], z: [-20, 23], top: 70, seed: 35, width: 0.4, len: 7 }), RC = createRays({ n: 100, x: [-46, 46], z: [-46, 46], top: 90, seed: 36, width: 0.5, len: 8 });
[RL, RR, RB, RH, RS, RC].forEach((r) => scene.add(r.group));
// the bare half reddening (an illustration of the endpoint SPF measures: the first redness)
const redMat = new THREE.MeshBasicMaterial({ color: 0xc8463c, transparent: true, opacity: 0, depthWrite: false });
const red = new THREE.Mesh(new THREE.BoxGeometry(58, 0.6, 48), redMat); red.position.set(-31, 0.35, 0); scene.add(red);
const UVC = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 0.9), HIT = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 3.0);   // rays under the bloom knee; what gets in glows

const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const KIND = { layer: { color: "ink", glyph: "▬", mark: "none" }, cell: { color: "text-2", glyph: "●", mark: "none" },
  water: { color: "water", glyph: "◇", mark: "none" }, uv: { color: "uv", glyph: "◆", mark: "none" } };
const A = {};
const at = (k) => () => A[k] || [0, 0, 0];
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: at(L.anchor), t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe, film: true });

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const B0 = Object.fromEntries(FILM.beats.map((b) => [b.id, b.t0]));
const HIDE = { gain: 0 };

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name, tone = FILM.tone[shot];
  rig.place(camera, shot, t);
  const pair = shot === "hook" || shot === "inside" || shot === "close";
  const one = shot === "ratio" || shot === "thin" || shot === "gauge";
  WL.group.visible = WR.group.visible = pair; S.group.visible = one; SC.group.visible = shot === "count";
  const F = UV.film_um;

  // ── the pair: SPF 50 left, SPF 100 right ──
  const inside = shot === "inside";
  WL.set({ tone, dimLiving: inside ? 0.2 : 0.35 }); WR.set({ tone, dimLiving: inside ? 0.2 : 0.35 });
  FL.set({ top: 0, thick: pair ? F : 0, opacity: inside ? 0.22 : 0.4 }); FR.set({ top: 0, thick: pair ? F : 0, opacity: inside ? 0.22 : 0.4 });
  // inside: the rays that are stopped step back (rule 8), what gets in stays lit
  const rayC = inside ? UVC.map((v) => v * (1 - 0.6 * fadeIn(t, CUE.in, 0.6))) : UVC;
  const hitL = RL.set(t, pair ? { filmTop: F, filmBottom: 0, pass: UV.pass50, color: rayC, hitColor: HIT, x0: -36 } : HIDE);
  const hitR = RR.set(t, pair ? { filmTop: F, filmBottom: 0, pass: UV.pass100, color: rayC, hitColor: HIT, x0: 36 } : HIDE);
  A.film_l = [-36, F + 1, 23]; A.film_r = [36, F + 1, 23];

  // ── one block: the ratio (half bare, half filmed), the thin film, the gauge ──
  S.set({ tone, dimDead: shot === "gauge" ? 0.8 : 0, dimLiving: shot === "gauge" ? 0.85 : 0.35 });
  const ratio = shot === "ratio";
  FH.set({ top: 0, thick: ratio ? F : 0, opacity: 0.55 });
  RB.set(t, ratio ? { filmTop: 0, filmBottom: 0, pass: 1, color: UVC, hitColor: HIT, x0: 0 } : HIDE);
  RH.set(t, ratio ? { filmTop: F, filmBottom: 0, pass: UV.pass50, color: UVC, hitColor: HIT, x0: 0 } : HIDE);
  redMat.opacity = ratio ? 0.38 * E.inout2(seg(t, CUE.reddens - 1.2, CUE.reddens + 0.6)) : 0;
  red.visible = redMat.opacity > 0.002;
  A.bare = [-30, 1, 25]; A.film = [30, F + 1, 25];
  // thin: the film goes from the test layer to the thin one; then more of the light gets through (illustration)
  const thin = shot === "thin" || shot === "gauge";
  const fThick = shot === "thin" ? F + (UV.thin_um - F) * E.inout2(seg(t, CUE.thin[0], CUE.thin[1])) : F;
  const pThin = UV.pass50 + (UV.pass_thin - UV.pass50) * E.inout2(seg(t, CUE.fall[0], CUE.fall[1]));
  FS.set({ top: 0, thick: thin ? fThick : 0, opacity: 0.55 });
  RS.set(t, shot === "thin" ? { filmTop: fThick, filmBottom: 0, pass: pThin, color: UVC, hitColor: HIT, x0: 0 } : HIDE);
  if (shot === "thin") A.film = [36, fThick + 1, 25];

  // ── the count: from above, a hundred rays on one film; fifty's two get through, then a hundred's one ──
  const count = shot === "count";
  SC.set({ tone, dimLiving: 0.35 });
  FC.set({ top: 0, thick: count ? F : 0, opacity: 0.25 });   // see-through from above, so the rays that get in show
  RC.set(t, count ? { filmTop: F, filmBottom: 0, pass: t < CUE.hundred ? UV.pass50 : UV.pass100, color: UVC, hitColor: HIT, x0: 0, rate: 0.42 } : HIDE);

  // ── the gauge: attached to the single block's left cut edge; lifted for the to-scale beat with the film on top ──
  camera.updateMatrixWorld();
  const p0 = project(camera, [-58, 0, 25], W, H), p1 = project(camera, [-58, -100, 25], W, H);
  const lift = shot === "gauge" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: shot === "gauge" ? 1 : 0, lift, sc: G.sc_um, paperUm: G.paper_um, filmUm: G.film_um,
    fillFilm: E.out3(seg(t, G.film - 0.1, G.film + 0.7)), fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
