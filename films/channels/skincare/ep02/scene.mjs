import * as THREE from "three";
// Outer Layer No. 002 (reboot), "Where a glow comes from" (films/channels/skincare/ep02). The picture as a pure
// function of t (window.seek). Places (compile.py): the macro terrain at golden hour with a beam of light and its
// glint (one ray off smooth, hydrated skin; a haze off dry skin), the section where the rest of the light threads among
// cells and fibres and much of it climbs back out, warmed by melanin and reddened by a widening capillary; the
// viewfinder's model cheek beside a "blood colour" slider; a depth chart (blue ≈ 1 mm, ten sheets of paper; red 4–5
// mm); and back to the terrain, glowing from within.
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, injectCss } from "../set/motif.js";
import { createUVSkin, createViewfinder, createDaylight } from "../set/uvcam.js";
import { createTerrain, goldenHour } from "../set/terrain.js";
import { createSection, createVessels, toneColor } from "../set/section.js";
import { createBeam, createGlint, createPaths } from "../set/light02.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, K = FILM.keys, PL = FILM.place, FPS = FILM.fps || 30, D = FILM.depth;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 8, threshold: 0.86, bloom: 0.4, exposure: 1.05 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 30000);
injectCss();
const lights = goldenHour(scene);
const FOG = scene.fog; scene.fog = null;
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
const tone = FILM.tone, SKIN = toneColor("living", tone);

// ── the set ─────────────────────────────────────────────────────────────────
const terrain = createTerrain({ seed: 13, spots: 0 }); terrain.group.position.x = PL.tx; scene.add(terrain.group);
const beam = createBeam({ from: [PL.tx - 9, 16, -6], to: [PL.tx, 0.25, 0], radius: 0.1 }); scene.add(beam.group);
const glint = createGlint({ at: [PL.tx, 0.3, 0], dir: [0.55, 1, 0.45], len: 7 }); scene.add(glint.group);
const beamL = createBeam({ from: [PL.tx - 12, 16, -6], to: [PL.tx - 3.5, 0.25, 0], radius: 0.09 }), beamR = createBeam({ from: [PL.tx - 5, 16, -6], to: [PL.tx + 3.5, 0.25, 0], radius: 0.09 });
const glintL = createGlint({ at: [PL.tx - 3.5, 0.3, 0], dir: [0.55, 1, 0.45], len: 6, seed: 5 }), glintR = createGlint({ at: [PL.tx + 3.5, 0.3, 0], dir: [0.55, 1, 0.45], len: 6, seed: 6 });
scene.add(beamL.group, beamR.group, glintL.group, glintR.group);
// the glow from within (takeaway): warm rays rising out of the surface around the beam
const glows = [[-2, 1], [1.5, -1.2], [3, 1.6], [-3.5, -2], [0.4, 2.6]].map(([dx, dz], i) => { const gl = createGlint({ at: [PL.tx + dx, 0.2, dz], dir: [0.1, 1, 0.2], len: 3.5, n: 8, seed: 20 + i }); gl.group.traverse((o) => { if (o.material) o.material.color.set(0xffb07a); }); scene.add(gl.group); return gl; });

const S = createSection({ width: 180, depth: 60, sc: 17, gran: 10, spin: 48, basal: 10, seed: 23, x: PL.sx, backing: true });
S.group.position.x = PL.sx; scene.add(S.group);
const V = createVessels({ x: [-80, 80], ys: [-118, -132], z: 30.4, r: 4.2, ox: PL.sx, dz: 0 }); scene.add(V.group);
const paths = createPaths({ n: 18, origin: [0, 0, 32], width: 170, depth: 150, seed: 6 }); paths.group.position.x = PL.sx; scene.add(paths.group);
const beamS = createBeam({ from: [PL.sx - 70, 230, 32], to: [PL.sx, 1, 32], radius: 2.2 }); scene.add(beamS.group);

const face = createUVSkin({ seed: 5.0 }); face.mesh.rotation.x = -0.18; scene.add(face.mesh);
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
const vf = createViewfinder({ root: hudRoot, W, H, x: 0.1, y: 0.255, w: 0.8, h: 0.29 });
vf.el.querySelector(".rec").textContent = "● REC  DAYLIGHT";
const day = createDaylight({ root: hudRoot, W, H, y: 0.552 });
// the slider (whoa): "blood colour", nudged up
const slider = document.createElement("div");
slider.innerHTML = `<span class="k">blood colour</span><span class="tr"><i></i><b></b></span>`;
Object.assign(slider.style, { position: "absolute", left: "50%", top: `${0.555 * H}px`, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "2.4vmin", padding: "1.2vmin 2.6vmin",
  borderRadius: "2.4vmin", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", fontFamily: "var(--font-mono)", fontSize: "2.8vmin", color: "var(--text)", zIndex: 4, opacity: "0" });
const css = document.createElement("style");
css.textContent = `.tr{position:relative;display:block;width:36vmin;height:1.2vmin;border-radius:1vmin;background:linear-gradient(90deg,#d9b49a,#c8504a)}.tr i{position:absolute;top:50%;width:3.4vmin;height:3.4vmin;margin:-1.7vmin 0 0 -1.7vmin;border-radius:50%;background:#F7F3FF;border:.5vmin solid var(--water)}.tr b{display:none}
.dc{position:absolute;left:50%;transform:translateX(-50%);display:flex;gap:5vmin;align-items:flex-start;padding:2.4vmin 3.4vmin;border-radius:2.4vmin;background:var(--hud-plate);box-shadow:var(--hud-shadow);font-family:var(--font-mono);color:var(--text);font-size:2.8vmin;z-index:4}
.dc .col{display:flex;flex-direction:column;align-items:center;gap:1vmin}.dc .bar{width:9vmin;border-radius:.6vmin;background:var(--c)}.dc .sh{display:flex;flex-direction:column;gap:.35vmin}.dc .sh i{display:block;width:9vmin;height:.55vmin;background:#EDE6FF;border-radius:.2vmin}
.dc .ax{position:relative;width:9vmin;white-space:nowrap;border-left:.35vmin solid var(--text-2)}.dc .ax span{position:absolute;left:1vmin;font-size:2.3vmin;color:var(--text-2);transform:translateY(-50%)}`;
document.head.appendChild(css);
hudRoot.appendChild(slider);
// the depth chart (toscale): mm axis, blue bar to ≈ 1 mm beside ten sheets, red bar to 4–5 mm
const PXMM = 0.056 * H;                                               // 1 mm on the chart
const chart = document.createElement("div"); chart.className = "dc";
chart.innerHTML = `<div class="ax" style="height:${5 * PXMM}px">${[0, 1, 2, 3, 4, 5].map((m) => `<span style="top:${m * PXMM}px">${m} mm</span>`).join("")}</div>
  <div class="col"><div class="bar b" style="--c:#6E8CFF;height:0px"></div><span>blue</span></div>
  <div class="col"><div class="sh">${Array.from({ length: 10 }, () => "<i></i>").join("")}</div><span>10 sheets</span></div>
  <div class="col"><div class="bar r" style="--c:#FF5A4E;height:0px"></div><span>red</span></div>`;
Object.assign(chart.style, { top: `${0.25 * H}px`, opacity: "0" });
hudRoot.appendChild(chart);
const barB = chart.querySelector(".bar.b"), barR = chart.querySelector(".bar.r"), sheets = [...chart.querySelectorAll(".sh i")];
sheets.forEach((s) => { s.style.height = `${0.1 * PXMM - 0.35 * H / 100 * 0.6}px`; });

const hud = createHud({ camera, shots: FILM.shots });
const KIND = { layer: { color: "ink", glyph: "▬" }, cell: { color: "text", glyph: "●" }, water: { color: "water", glyph: "◇" }, uv: { color: "uv", glyph: "◆" } };
const A = {};
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
  if (c.text.length > 9) el.style.setProperty("--hud-counter-size", `${(10 * 9 / c.text.length).toFixed(2)}vmin`);
}
for (const L of FILM.labels) { const k = KIND[L.kind]; hud.label(L.id, { text: L.text, glyph: k.glyph, mark: "none", color: k.color, at: () => A[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed }); }
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "80vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-14vmin)";

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  rig.place(camera, shot, t);
  const isT = ["macro", "split", "macro2"].includes(shot), isS = shot === "inside" || shot === "depth";
  terrain.group.visible = isT; S.group.visible = V.group.visible = paths.group.visible = isS; face.mesh.visible = shot === "face";
  scene.fog = isT ? FOG : null;
  lights.sun.intensity = isT ? 4.2 : 2.0; lights.key.intensity = isT ? 0.9 : 1.6;
  fstop = isT ? 0.45 : 0; focusPt = [PL.tx, 0, 0];

  // ── the terrain: one beam and its glint; then two halves, smooth (one ray) and dry (a haze) ──
  if (isT) terrain.set({ tone: SKIN.map((v) => v * 1.1), furrows: shot === "split" ? 1.1 : 0.3, sheen: shot === "split" ? 1 : 0, spot: 0 });
  const one = shot === "macro" || shot === "macro2";
  beam.set({ op: one ? 1 : 0, grow: shot === "macro" ? E.out3(seg(t, K.beam[0], K.beam[1])) : 1 });
  glint.set({ op: shot === "macro" ? E.out3(seg(t, K.glint[0], K.glint[1])) : 0, spread: 0 });
  beamL.set({ op: shot === "split" ? 1 : 0 }); beamR.set({ op: shot === "split" ? 1 : 0 });
  glintL.set({ op: shot === "split" ? 1 : 0, spread: 0 });
  glintR.set({ op: shot === "split" ? 1 : 0, spread: shot === "split" ? E.inout2(seg(t, K.spread[0], K.spread[1])) : 0 });
  const gOut = shot === "macro2" ? E.inout2(seg(t, K.glowout[0], K.glowout[1])) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : 0;
  glows.forEach((g) => g.set({ op: 0.8 * gOut, spread: 0.7 }));
  A.glint = [PL.tx + 1.5, 2.2, 1]; A.glintL = [PL.tx - 4.5, 2.5, 0]; A.glintR = [PL.tx + 4.5, 2.5, 0];

  // ── the section: the rest of the light threads in; much of it climbs back out, warmed, then reddened ──
  if (isS) {
    const dim = shot === "depth" ? 0.55 * fadeIn(t, SH.depth, 0.6) : 0;
    S.set({ tone, dimDead: dim, dimLiving: 0.25 + dim });
    const widen = shot === "inside" ? E.inout2(seg(t, K.widen[0], K.widen[1])) : 1;
    V.set({ k: 1 + 0.9 * widen, opacity: 1 });
    paths.set({ grow: shot === "inside" ? E.inout2(seg(t, K.paths[0], K.paths[1])) : 1, out: shot === "inside" ? E.inout2(seg(t, K.out[0], K.out[1])) * (0.6 + 0.4 * E.inout2(seg(t, K.warm[0], K.warm[1]))) : 1,
      red: shot === "inside" ? widen : 1, op: 1 - dim });
  }
  beamS.set({ op: isS ? 1 - (shot === "depth" ? 0.6 * fadeIn(t, SH.depth, 0.6) : 0) : 0 });
  A.melanin = [PL.sx - 40, -45, 32]; A.cap = [PL.sx + 30, -118, 34];

  // ── the viewfinder cheek: daylight, the slider nudged up, the cheek flushing ──
  const flush = shot === "face" ? E.inout2(seg(t, K.flush[0], K.flush[1])) : 0;
  face.set({ day: 1, skin: SKIN.map((v) => v * 1.2), red: 0.15 + 0.85 * flush, opacity: 1 });
  vf.set({ op: shot === "face" ? fadeIn(t, SH.face, 0.4) : 0, left: "model face", right: "" });
  slider.style.opacity = (shot === "face" ? fadeIn(t, SH.face + 0.6, 0.5) : 0).toFixed(3);
  slider.querySelector("i").style.left = `${(25 + 60 * flush).toFixed(1)}%`;

  // ── the depth chart ──
  const cOp = shot === "depth" ? fadeIn(t, SH.depth + 0.2, 0.5) * (1 - fadeIn(t, SH.macro2 - 0.5, 0.45)) : 0;
  chart.style.opacity = cOp.toFixed(3); chart.style.visibility = cOp > 0.002 ? "visible" : "hidden";
  barB.style.height = `${(D.blue_mm * PXMM * E.out3(seg(t, K.blue[0], K.blue[1]))).toFixed(1)}px`;
  sheets.forEach((s, i) => { s.style.opacity = (E.out3(seg(t, K.sheets[0] + i * 0.08, K.sheets[0] + i * 0.08 + 0.3))).toFixed(2); });
  barR.style.height = `${(D.red_mm[1] * PXMM * E.out3(seg(t, K.redbar[0], K.redbar[1]))).toFixed(1)}px`;
  day.set({ op: shot === "macro2" ? fadeIn(t, K.glowout[0], 0.6) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : 0 });

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
