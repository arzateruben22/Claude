import * as THREE from "three";
// Outer Layer No. 003, "Bath fingers" (films/channels/skincare/ep03). The picture as a pure function of t for the
// film kit's page: window.seek(t) sets the shot, the camera, the wrinkles, the vessels, the water and the overlay from
// t alone, then makes exactly one renderer.render().
//
// The set is the channel's section (../set/section.js: wrinkle(), createVessels, createWater), the depth gauge and the
// layer-bar motif (../set/motif.js) and the microscope-stage rig (../set/rig.js).
//
// Shots: hook (a fingertip block, wrinkled, and a forearm block, smooth, in the bath) · sponge (one block; the wrong
// idea: it swells, then the idea is struck out) · nerves (two fingertips: one with its nerve, which wrinkles, one with
// the nerve cut, which stays smooth) · inside (close on the cut face: the vessels narrow, the pad sinks, the skin on top
// buckles) · reflex (an orbit round the wrinkled block) · palm (the to-scale card) · close (the hook again, the loop).
// Honesty (film.json "badges"): "simplified", "not what happens" (the sponge), the studies' names and years, "the
// trigger: still studied", "debated".
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { createSection, createVessels, createWater } from "../set/section.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, SK = FILM.skin, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 2, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.92, bloom: 0.25, exposure: 1.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

scene.add(new THREE.HemisphereLight(0xf4f8ff, 0xe8ddd4, 1.25));
const key = new THREE.DirectionalLight(0xfff6ec, 2.1); key.position.set(-120, 220, 160); scene.add(key);
const rim = new THREE.DirectionalLight(0xe8f2ff, 0.7); rim.position.set(80, 60, -200); scene.add(rim);

// ── the set ─────────────────────────────────────────────────────────────────
const LAY = { rows: 15, sc: 17, gran: 10, spin: 48, basal: 10 };
const TL = createSection({ width: 70, depth: 46, ...LAY, seed: 31, x: -40 }), TR = createSection({ width: 70, depth: 46, ...LAY, seed: 32, x: 40 });
const S = createSection({ width: 130, depth: 56, ...LAY, seed: 33 });
scene.add(TL.group, TR.group, S.group);
const WL = createWater({ width: 70, depth: 46, top: 36, x: -40 }), WR = createWater({ width: 70, depth: 46, top: 36, x: 40 }), WS = createWater({ width: 130, depth: 56, top: 36 });
scene.add(WL.mesh, WR.mesh, WS.mesh);
const V = createVessels({ x: [-62, 62], ys: [-92, -101, -111], z: 22, r: 2.6 });
scene.add(V.group);
// the nerves of the two fingertips (ink): one whole, one cut (a gap under its middle)
const nerveMat = new THREE.MeshStandardMaterial({ color: 0x2a3a40, roughness: 0.5, metalness: 0 });
const nerve = (x0, x1, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, x1 - x0, 10), nerveMat); m.rotation.z = Math.PI / 2; m.position.set((x0 + x1) / 2, y, z); scene.add(m); return m; };
const nL = nerve(-72, -8, -112, 21);
const nR1 = nerve(8, 33, -112, 21), nR2 = nerve(47, 72, -112, 21);   // the cut: a gap from 33 to 47

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
endEl.style.transform = "translateY(-9.5vmin)";
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe });

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const B0 = Object.fromEntries(FILM.beats.map((b) => [b.id, b.t0]));

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name, tone = FILM.tone[shot];
  rig.place(camera, shot, t);
  const pair = shot === "hook" || shot === "close" || shot === "nerves";
  const one = !pair;
  TL.group.visible = TR.group.visible = pair; S.group.visible = one;
  WL.set({ opacity: pair ? 0.2 : 0 }); WR.set({ opacity: pair ? 0.2 : 0 });

  // ── the pair: a fingertip and a forearm (hook, close), or two fingertips, one nerve cut (nerves) ──
  const nerves = shot === "nerves";
  // the hook and the close: the fingertip wrinkled, the forearm smooth; nerves: both start smooth, the left one wrinkles
  const wL = nerves ? SK.wrinkle * E.inout2(seg(t, CUE.cut - 0.4, CUE.smooth + 0.4)) : SK.wrinkle;
  TL.wrinkle(pair ? wL : 0); TR.wrinkle(0);
  TL.set({ tone, dimLiving: 0.35, glowDead: 0.25 }); TR.set({ tone, dimLiving: 0.35, dimDead: nerves ? 0 : 0.15 });
  nL.visible = nR1.visible = nR2.visible = nerves;
  A.tip = [-40, 2, 22]; A.arm = [40, 2, 22]; A.nerve_l = [-40, -112, 22]; A.nerve_r = [40, -112, 22];

  // ── one block: the sponge (it swells, then the idea is struck out), inside (vessels, buckle), reflex, palm ──
  const sponge = shot === "sponge";
  const sw = sponge ? E.inout2(seg(t, CUE.swell[0], CUE.swell[1])) * (1 - E.inout2(seg(t, CUE.wrong - 0.1, CUE.wrong + 0.7))) : 0;
  S.group.scale.set(1, 1 + 0.12 * sw, 1);
  S.group.position.y = 0;
  const inside = shot === "inside";
  const buckle = inside ? E.inout2(seg(t, CUE.buckle[0] - 0.4, CUE.buckle[1])) : (shot === "reflex" || shot === "palm") ? 1 : 0;
  S.wrinkle(one ? SK.wrinkle * buckle : 0);
  const k = inside ? 1 - (1 - SK.narrow) * E.inout2(seg(t, CUE.narrow[0], CUE.narrow[1])) : (shot === "reflex" || shot === "palm") ? SK.narrow : 1;
  V.set({ k, opacity: one ? 1 : 0 });
  // rule 8: the vessels win while they narrow; then the surface while it buckles
  const vesselsWin = inside ? Math.min(fadeIn(t, B0.why, 0.6), 1 - fadeIn(t, CUE.buckle[0] - 0.3, 0.6)) : 0;
  S.set({ tone, dimDead: shot === "palm" ? 0.8 : 0.6 * vesselsWin, dimLiving: shot === "palm" ? 0.85 : 0.35 + 0.3 * vesselsWin,
    glowDead: inside ? 0.6 * fadeIn(t, CUE.buckle[0] - 0.2, 0.6) : 0 });
  WS.set({ opacity: one && !inside ? 0.18 + 0.12 * sw : 0 });
  A.top = [40, 4 + 18 * sw, 26]; A.vessel = [30, -94, 24];

  // ── the gauge: lifted out of the palm shot, the palm's dead layer (173 µm) beside the paper (100 µm) ──
  camera.updateMatrixWorld();
  const p0 = project(camera, [-63, 0, 28], W, H), p1 = project(camera, [-63, -100, 28], W, H);
  const lift = shot === "palm" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: shot === "palm" ? Math.min(1, Math.max(0, (lift - 0.35) / 0.4)) : 0, lift, sc: G.sc_um, paperUm: G.paper_um,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.9)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
