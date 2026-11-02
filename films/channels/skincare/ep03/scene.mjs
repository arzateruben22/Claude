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
import { createSection, createVessels, createWater, createPad, toneColor } from "../set/section.js";
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
const LAY = { rows: 15, sc: 17, gran: 10, spin: 48, basal: 10, mortarFloor: 0, backing: true };   // no resting sheets; tissue behind the cells
const S = createSection({ width: 130, depth: 56, ...LAY, seed: 33 });
scene.add(S.group);
const V = createVessels({ x: [-62, 62], ys: [-94, -104, -114], z: 28.4, r: 3.4, dz: 0 });   // on the cut face (half out of it), so they are seen
scene.add(V.group);
// the two pads in their bath: a fingertip (left) and a forearm patch, later a second fingertip (right)
const PL = createPad({ width: 70, depth: 46, height: 60, x: -40, seed: 3, period: 16 }), PR = createPad({ width: 70, depth: 46, height: 60, x: 40, seed: 4, period: 16 });
scene.add(PL.mesh, PR.mesh);
const WL = createWater({ width: 74, depth: 50, top: 30, x: -40 }), WR = createWater({ width: 74, depth: 50, top: 30, x: 40 });
scene.add(WL.mesh, WR.mesh);
// the wrong idea: a ghost of the fingertip, swollen, in the water's colour
const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(70, 60, 46)), new THREE.LineBasicMaterial({ color: 0x006d74, transparent: true, opacity: 0 }));   // an outline: the swollen pad that doesn't happen
const ghostFill = new THREE.Mesh(new THREE.BoxGeometry(70, 60, 46), new THREE.MeshBasicMaterial({ color: 0x4fb8be, transparent: true, opacity: 0, depthWrite: false }));
ghost.add(ghostFill);   // a translucent body inside the outline, so the swollen ghost reads at phone size
scene.add(ghost);
// the nerves, drawn on the pads' front faces (ink): one whole, one cut (a gap under its middle)
const nerveMat = new THREE.MeshStandardMaterial({ color: 0x1f2d33, roughness: 0.5, metalness: 0 });
const nerve = (x0, x1, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, x1 - x0, 10), nerveMat); m.rotation.z = Math.PI / 2; m.position.set((x0 + x1) / 2, y, z); scene.add(m); return m; };
const nL = nerve(-72, -8, -42, 23.5);
const nR1 = nerve(8, 33, -42, 23.5), nR2 = nerve(47, 72, -42, 23.5);   // the cut: a gap from 33 to 47
// marbles on the wrinkled pad, in the bath (the grip study, an illustration)
const marbleMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ea, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.92 });
const MX = [-62, -48, -36];
const marbles = [[-62, 5, 6], [-48, 5, -6], [-36, 5, 10]].map((p) => { const m = new THREE.Mesh(new THREE.SphereGeometry(5, 28, 20), marbleMat); m.position.set(...p); scene.add(m); return m; });

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
endEl.style.transform = "translateY(-14vmin)";
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe, cheek: true });

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const B0 = Object.fromEntries(FILM.beats.map((b) => [b.id, b.t0]));

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name, tone = FILM.tone[shot];
  rig.place(camera, shot, t);
  const padsOn = shot === "pads" || shot === "nerves" || shot === "close" || shot === "reflex";
  const inside = shot === "inside";
  S.group.visible = inside; V.group.visible = inside;
  const skin = toneColor("living", tone).map((v) => v * 0.95);

  // ── the pads: the fingertip furrowed (hook, close, reflex), the forearm smooth; in the nerves shot both start smooth and
  // only the one with its nerve furrows (the cut one stays smooth) ──
  const nerves = shot === "nerves", reflex = shot === "reflex";
  const fL = nerves ? E.inout2(seg(t, CUE.cut - 0.6, CUE.smooth + 0.6)) : 1;
  const deadTop = toneColor("corneo", tone);
  PL.set({ visible: padsOn, furrows: fL, amp: SK.wrinkle, color: skin, top: deadTop });
  // in the reflex shot the nerve-cut pad (smooth) comes back beside it on "test a nerve", and leaves on "argued"
  const cutIn = reflex ? Math.min(E.inout2(seg(t, CUE.test - 0.5, CUE.test + 0.4)), 1 - E.inout2(seg(t, CUE.argued - 0.3, CUE.argued + 0.5))) : 1;
  PR.mesh.position.x = 40 + (reflex ? 60 * (1 - cutIn) : 0);
  PR.set({ visible: padsOn && cutIn > 0.01, furrows: 0, amp: SK.wrinkle, color: skin, top: deadTop });
  WL.set({ opacity: padsOn ? 0.2 : 0 }); WR.set({ opacity: padsOn && !reflex ? 0.2 : 0 });
  A.cutpad = [PR.mesh.position.x, 6, 22];
  nL.visible = nR1.visible = nR2.visible = nerves;
  // the wrong idea: a swollen ghost over the fingertip, then it collapses on "wrong"
  const sw = shot === "pads" ? E.inout2(seg(t, CUE.swell[0], CUE.swell[1])) * (1 - E.inout2(seg(t, CUE.wrong - 0.1, CUE.wrong + 0.7))) : 0;
  ghost.material.opacity = 0.9 * sw; ghostFill.material.opacity = 0.22 * sw; ghost.visible = sw > 0.002;
  const sp = document.getElementById("hud-l-sponge");   // struck through as it's called wrong
  if (sp) sp.style.textDecoration = t >= CUE.wrong - 0.05 ? "line-through" : "none";
  ghost.scale.set(1 + 0.06 * sw, 1 + 0.25 * sw, 1 + 0.06 * sw); ghost.position.set(-40, -30 + 7.5 * sw, 0);
  // marbles in the grip study
  const mOp = reflex ? Math.min(fadeIn(t, CUE.argued - 0.2, 0.6), 1 - fadeIn(t, B0.toscale + 0.3, 0.8)) : 0;   // the grip study arrives on "argued"
  // they slip across the furrows on "a wet grip" and stop dead on "none"
  const slip = reflex ? E.inout2(seg(t, CUE.grip - 0.5, CUE.none)) : 0;
  marbles.forEach((m, i) => { m.visible = mOp > 0.002; m.position.x = MX[i] + 16 * slip; m.position.y = 4 + 1.2 * Math.sin(Math.min(t, CUE.none) * 1.3 + i) * (1 - slip); m.rotation.z = -slip * 3.2; });
  marbleMat.opacity = 0.92 * mOp;
  A.tip = [-40, 4, 22]; A.arm = [40, 4, 22]; A.nerve_l = [-40, -38, 24]; A.nerve_r = [40, -38, 24]; A.ghost = [-20, 18, 22];

  // ── inside: the vessels narrow over about 2 s, the pad sinks a little, then the dead layer buckles as one sheet ──
  const k = inside ? 1 - (1 - SK.narrow) * E.inout2(seg(t, CUE.narrow[0], CUE.narrow[1])) : 1;
  V.set({ k, opacity: inside ? 1 : 0 });
  const sink = inside ? E.inout2(seg(t, CUE.shrink[0], CUE.shrink[1])) : 0;
  const buckle = inside ? E.inout2(seg(t, CUE.buckle[0], CUE.buckle[1])) : 0;
  S.group.position.y = -3 * sink;
  S.wrinkle(inside ? Math.max(0.06, 3.5 * buckle) : 0, 30, 24);   // inside, the dead layer is always the one sheet (overlapping plates z-fought)   // a gentle buckle of one sheet
  const vesselsWin = inside ? Math.min(fadeIn(t, B0.why, 0.6), 1 - fadeIn(t, CUE.buckle[0] - 0.3, 0.6)) : 0;
  S.set({ tone, dimDead: 0.6 * vesselsWin, dimLiving: 0.35 + 0.3 * vesselsWin, glowDead: inside ? 0.6 * buckle : 0 });
  A.vessel = [-20, -94, 30];

  // ── the gauge: lifted out of the reflex shot as it pulls back: the palm's dead layer (173 µm) beside the paper ──
  camera.updateMatrixWorld();
  const p0 = project(camera, [-75, 0, 23], W, H), p1 = project(camera, [-75, -100, 23], W, H);
  const lift = reflex ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: Math.min(1, Math.max(0, (lift - 0.6) / 0.3)), lift, sc: G.sc_um, paperUm: G.paper_um, scName: "palm", cheekUm: SK.cheek_um, fillCheek: E.out3(seg(t, G.cheek - 0.1, G.cheek + 0.6)),
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 1.4)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 0.7)) });

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
