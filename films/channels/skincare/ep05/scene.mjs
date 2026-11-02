import * as THREE from "three";
// Outer Layer No. 005, "Same cells, every colour" (films/channels/skincare/ep05). The picture as a pure function of t
// for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, every object and the overlay
// from t alone, then makes exactly one renderer.render().
//
// The set: three of the channel's sections side by side (light, medium, deep: ../set/section.js), each with three
// pigment cells on its basal row and melanin caps (../set/melanocyte04.js), UV dashes (../set/uv04.js), one cell's
// grains per tone up close (../set/grains05.js), a globe of UV and skin colour (../set/globe05.js), the depth gauge
// and layer bars (../set/motif.js) and the microscope-stage rig (../set/rig.js). Everything timed comes from
// film.json, which compile.py hangs on the voice.
//
// Shots: hook (the payoff: three sections, their pigment cells lit) · rows (the basal rows, counted: the same) ·
// grains (one cell per tone: small and clustered → larger, one by one) · trio ("more of them?": no) · globe (skin
// colour follows UV) · strong (the deep section under fierce UV; folate below kept safe) · weak (the light one under
// weak UV; vitamin D made) · gauge (to scale) · close (back to the hook, for the loop).
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { createSection } from "../set/section.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { lin } from "../set/look.js";
import { createRays } from "../set/uv04.js";
import { createMelanocyte, createCaps } from "../set/melanocyte04.js";
import { createGrains } from "../set/grains05.js";
import { createGlobe } from "../set/globe05.js";

const FILM = window.FILM, W = window.W, H = window.H, BIO = FILM.bio, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge;
const S1 = Math.min(W, H) / 1080, TONES = FILM.tones;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 2, 8000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.92, bloom: 0.28, exposure: 1.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

scene.add(new THREE.HemisphereLight(0xf4f8ff, 0xe8ddd4, 1.25));
const key = new THREE.DirectionalLight(0xfff6ec, 2.1); key.position.set(-120, 220, 160); scene.add(key);
const rim = new THREE.DirectionalLight(0xe8f2ff, 0.7); rim.position.set(80, 60, -200); scene.add(rim);

// ── the set: three sections, three pigment cells on each basal row, caps over the nuclei ──
const LAY = { sc: BIO.sc_um, gran: BIO.gran_um, spin: BIO.spin_um, basal: BIO.basal_um, rows: BIO.rows };
const SEC = BIO.sec_x.map((x, i) => {
  const S = createSection({ width: 58, depth: 46, ...LAY, seed: 31 + i, x });
  const caps = createCaps(S); S.group.add(caps.mesh);
  const mels = [-17, 0, 17].map((mx, j) => createMelanocyte(S, { x: mx, seed: 40 + i * 3 + j, branches: 3, n: 30 }));
  scene.add(S.group, ...mels.map((m) => m.group));
  return { S, caps, mels, x, tone: TONES[i] };
});
const UVC = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 1.5);
const WATER = lin(window.THEME.tokens["water-glow"]).map((v) => v * 1.6);
const raysStrong = createRays({ n: 70, x: [BIO.sec_x[2] - 28, BIO.sec_x[2] + 26], z: [-16, 22], top: 70, floor: -80, seed: 52, speed: 80 });
const raysWeak = createRays({ n: 14, x: [BIO.sec_x[0] - 28, BIO.sec_x[0] + 26], z: [-16, 22], top: 70, floor: -80, seed: 53, speed: 60 });
scene.add(raysStrong.mesh, raysWeak.mesh);
// folate (in a capillary loop under the deep section) and vitamin D (made in the light section's living layers): glows
const glowBead = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: true }));
const folate = new THREE.Group(), vitd = new THREE.Group();
for (let i = 0; i < 7; i++) { const b = glowBead(1.6); b.position.set(BIO.sec_x[2] - 12 + i * 4, -96 + Math.sin(i) * 1.5, 22); folate.add(b); }
for (let i = 0; i < 9; i++) { const b = glowBead(1.3); b.position.set(BIO.sec_x[0] - 18 + i * 4.5, -60 + Math.cos(i * 1.7) * 6, 22); vitd.add(b); }
scene.add(folate, vitd);
// the grains (their own place) and the globe (its own place)
const GR = TONES.map((tone, i) => createGrains({ tone, x: BIO.gx + (i - 1) * 46, r: 18, seed: 61 + i }));
scene.add(...GR.map((g) => g.group));
const globe = createGlobe({ x: BIO.wx, r: 70, seed: 51 });
scene.add(globe.group);

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
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d * 0.8)));
const B0 = Object.fromEntries(FILM.beats.map((b) => [b.id, b.t0]));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
const CT = CUE.count_t;

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  rig.place(camera, shot, t);
  const inS = ["hook", "rows", "trio", "strong", "weak", "gauge", "close"].includes(shot);
  const isG = shot === "grains", isW = shot === "globe";
  for (const s of SEC) { s.S.group.visible = inS; for (const m of s.mels) m.group.visible = inS; }
  for (const g of GR) g.group.visible = isG;
  globe.group.visible = isW;

  // ── the sections ──
  SEC.forEach((s, i) => {
    let dimLiving = 0, dimDead = 0.35, glow = 0, tan = 0.55, fill = 0.6, travel = 1, dimSec = 0;
    if (shot === "hook" || shot === "close") glow = shot === "hook" ? fadeIn(t, CUE.pigment - 0.2, 0.5) : 0.7;
    if (shot === "rows") {
      dimDead = 0.6; dimLiving = 0.45 * fadeIn(t, SH.rows, 0.6);
      glow = 0.4 + 0.6 * fadeIn(t, CUE.feeds - 0.2, 0.5);
      travel = 0.4 + 0.6 * E.inout2(seg(t, CUE.feeds, CUE.feeds + 2.4));
    }
    if (shot === "trio") glow = i === 2 ? 1 : 0.4;
    if (shot === "strong") { dimSec = i === 2 ? 0 : 1; tan = 1; dimDead = 0.5; }
    if (shot === "weak") { dimSec = i === 0 ? 0 : 1; dimDead = 0.5; dimLiving = 0.2; }
    if (shot === "gauge") { dimDead = 0.8; dimLiving = 0.8; glow = 0.5; }
    s.S.set({ tone: s.tone, dimDead: Math.max(dimDead, dimSec), dimLiving: Math.max(dimLiving, dimSec * 0.8), mortar: 0, glowDead: 0 });
    s.caps.set({ tone: s.tone, tan, dim: shot === "gauge" ? 0.6 : 0 });
    s.mels.forEach((m, j) => {
      // in the rows shot each section's pigment cells light one after another, in step across the three (the count)
      const counted = shot === "rows" ? fadeIn(t, CT[j] - 0.1, 0.25) : 0;
      m.set({ tone: s.tone, fill, travel, glow: Math.max(glow * (shot === "rows" ? 0.5 : 1), counted), dim: shot === "gauge" ? 0.6 : 0 });
    });
  });
  A.mel1 = SEC[1].mels[1].at.body();
  A.top0 = [SEC[0].x - 14, 0, 23]; A.top2 = [SEC[2].x + 14, 0, 23];

  // ── UV over the deep section (fierce: stopped at the caps) and the light one (weak: a few reach the living layers) ──
  const capY = -BIO.sc_um - BIO.gran_um - 6;
  raysStrong.set(t, { gain: shot === "strong" ? fadeIn(t, SH.strong, 0.5) : 0, color: UVC, pass: 0.06, stopAt: () => capY });
  raysWeak.set(t, { gain: shot === "weak" ? fadeIn(t, SH.weak, 0.5) : 0, color: UVC, pass: 0.8, stopAt: () => -62 });
  const fo = shot === "strong" ? fadeIn(t, CUE.folate - 0.3, 0.5) : 0, vd = shot === "weak" ? fadeIn(t, CUE.vitd - 0.3, 0.6) : 0;
  folate.children.forEach((b) => { b.material.color.setRGB(...WATER); b.material.opacity = fo; }); folate.visible = fo > 0.01;
  vitd.children.forEach((b, i) => { b.material.color.setRGB(...WATER); b.material.opacity = vd * (0.6 + 0.4 * Math.sin(t * 2 + i)); }); vitd.visible = vd > 0.01;
  A.folate = [BIO.sec_x[2] + 14, -96, 22]; A.vitd = [BIO.sec_x[0] + 20, -60, 22];

  // ── the grains: the three cells fill with their grains; the deep one's land on "larger" ──
  if (isG) GR.forEach((g, i) => g.set({ show: fadeIn(t, SH.grains + 0.2 + i * 0.5, 1.2), spread: E.out3(seg(t, SH.grains, CUE.larger + 0.6)), dim: i === 1 ? 0.3 * fadeIn(t, CUE.deeper, 0.5) : 0 }));
  A.g0 = [GR[0].group.position.x, 18, 10]; A.g2 = [GR[2].group.position.x, 18, 10];

  // ── the globe: UV band, then the dots fill in and follow it ──
  if (isW) globe.set({ uv: fadeIn(t, CUE.sunlight - 0.4, 0.8), dots: E.inout2(seg(t, CUE.colour - 0.2, CUE.matched + 0.2)), spin: 0.18 * (t - SH.globe) - 0.6 });
  A.band = globe.at.band();

  // ── the depth gauge: on the light section's left cut edge, lifted to centre for the to-scale beat ──
  const s0 = SEC[0].S, xg = s0.group.position.x - s0.dims.W / 2 + 2, zg = s0.dims.D / 2;
  camera.updateMatrixWorld();
  const p0 = project(camera, [xg, 0, zg], W, H), p1 = project(camera, [xg, -100, zg], W, H);
  const lift = shot === "gauge" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  const gOp = (["hook", "trio", "gauge", "close"].includes(shot) ? 1 : 0) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4));
  const sc = BIO.sc_um + (G.sc_um - BIO.sc_um) * Math.min(1, lift * 4);
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: gOp, lift, sc, paperUm: BIO.paper_um,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
