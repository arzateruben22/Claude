import * as THREE from "three";
// Outer Layer No. 004, "What a tan is" (films/channels/skincare/ep04). The picture as a pure function of t for the
// film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the tan, every object and the
// overlay from t alone, then makes exactly one renderer.render().
//
// The set is the channel's section (../set/section.js), its depth gauge and layer bars (../set/motif.js), the
// microscope-stage rig (../set/rig.js), and No. 004's own blocks: UV dashes (../set/uv04.js), the DNA ladder
// (../set/dna04.js) and the pigment cell with its message and caps (../set/melanocyte04.js). Everything timed comes
// from film.json, which compile.py hangs on the voice.
//
// Shots: hook (the payoff: a tanned section in a medium tone under UV) · section (untanned; UV rains in; push to one
// living cell and into it) · dna (the scale jump: two bases fuse) · cell (the same cell in a deep tone; pull back to
// its pigment cell; the message goes down and melanin fills) · pair (two sections, with and without p53: only one
// tans) · dna2 (the fused bases again: "damage already done") · tan (days pass: melanin climbs into caps) · field (a
// wide light-toned field of caps, most UV stopped) · gauge (to scale) · close (back to the hook, for the loop).
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { createSection } from "../set/section.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { lin } from "../set/look.js";
import { createRays } from "../set/uv04.js";
import { createDNA } from "../set/dna04.js";
import { createMelanocyte, createCaps, createSignal } from "../set/melanocyte04.js";

const FILM = window.FILM, W = window.W, H = window.H, BIO = FILM.bio, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;                                        // the section is cut open by clipping planes
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 2, 6000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.92, bloom: 0.28, exposure: 1.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });               // no depth of field: the slide is all in focus
injectCss();

// ── light: a lamp over the slide (key, top-left-front), a cool fill from the sky, a thin rim behind the cut ──
scene.add(new THREE.HemisphereLight(0xf4f8ff, 0xe8ddd4, 1.25));
const key = new THREE.DirectionalLight(0xfff6ec, 2.1); key.position.set(-120, 220, 160); scene.add(key);
const rim = new THREE.DirectionalLight(0xe8f2ff, 0.7); rim.position.set(80, 60, -200); scene.add(rim);

// ── the set ─────────────────────────────────────────────────────────────────
const LAY = { sc: BIO.sc_um, gran: BIO.gran_um, spin: BIO.spin_um, basal: BIO.basal_um, rows: BIO.rows };
const S = createSection({ width: 180, depth: 60, ...LAY, seed: 3 });
const caps = createCaps(S); S.group.add(caps.mesh);
const mel = createMelanocyte(S, { x: BIO.mel_x, seed: 21 });
scene.add(S.group, mel.group);
// the followed living cell: the cut-face spinous cell nearest the planned point
const hc = caps.cellNear(BIO.hcell), HC = hc.pos;
const hcRing = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x13252c, side: THREE.BackSide, transparent: true, opacity: 0, toneMapped: false }));
hcRing.position.set(HC[0], HC[1], HC[2]); hcRing.scale.set(7.4, 6.8 * hc.sy / 6, 7.4);
scene.add(hcRing);
// the pair (why): two small sections side by side; the left (with p53) tans, the right (without) never does
const PL = createSection({ width: 60, depth: 46, ...LAY, seed: 11, x: -36 }), PR = createSection({ width: 60, depth: 46, ...LAY, seed: 12, x: 36 });
const capsL = createCaps(PL), capsR = createCaps(PR);
PL.group.add(capsL.mesh); PR.group.add(capsR.mesh);
const melL = createMelanocyte(PL, { x: 0, seed: 22, branches: 3, n: 50 }), melR = createMelanocyte(PR, { x: 0, seed: 23, branches: 3, n: 50 });
scene.add(PL.group, PR.group, melL.group, melR.group);
// UV dashes over each place
const UVC = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 1.5);
const WATER = lin(window.THEME.tokens["water-glow"]).map((v) => v * 1.6);
const raysS = createRays({ n: 70, x: [-80, 70], z: [-20, 28], top: 80, floor: -60, seed: 9 });
const raysP = createRays({ n: 50, x: [-64, 60], z: [-18, 22], top: 70, floor: -60, seed: 10 });
const raysD = createRays({ n: 10, x: [-40, 40], z: [-6, 6], top: 80, floor: -60, seed: 13, len: 16, width: 1.4, speed: 90 });
raysD.mesh.position.x = BIO.dna_x;
scene.add(raysS.mesh, raysP.mesh, raysD.mesh);
// the DNA ladder (its own place) and the message
const dna = createDNA({ x: BIO.dna_x, seed: 4 });
scene.add(dna.group);
const sig = createSignal({ from: [HC[0], HC[1] - 2, HC[2] + 2], to: mel.at.body(), n: 16 });
scene.add(sig.mesh);

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
const WORDS = { fast: "{n}× faster", slow: "{n}× slower", freeze: null };
const pinned = (c) => { const c0 = clock(c.keys, { words: WORDS }); return clock(c.keys, { words: WORDS, tau0: c.anchor[1] - c0.tau(c.anchor[0]) }); };
const CLK = Object.fromEntries(Object.entries(FILM.clk).map(([k, c]) => [k, pinned(c)]));
const DAYS = (t) => Math.max(0, CLK.tan.tau(t)) / 86400;
for (const b of FILM.badges) hud.badge(b.id, b.clock ? { from: CLK[b.clock], t0: b.t0, t1: b.t1, slot: b.slot } : { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at };
  if (c.fmt === "days") Object.assign(o, { value: (t) => Math.min(c.lit, DAYS(t)), fmt: (v) => `day ${Math.floor(v + 1e-6)}`, lit: (v) => v >= c.lit - 1e-6, minCh: 6 });
  else Object.assign(o, { value: () => 0, fmt: () => c.text, lit: () => true });
  const el = hud.counter(c.id, o);
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: at(L.anchor), t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");                                    // the end card's footnote: small and quiet
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;   // the lifted bar names this episode's subject

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d * 0.8)));
const B0 = Object.fromEntries(FILM.beats.map((b) => [b.id, b.t0]));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;   // a frame's motion blur never blends two shots across a cut
  const shot = stage(t).name, tone = FILM.tone[shot];
  rig.place(camera, shot, t);
  const inS = ["hook", "section", "cell", "tan", "field", "gauge", "close"].includes(shot);
  const isDNA = shot === "dna" || shot === "dna2", isPair = shot === "pair";
  S.group.visible = mel.group.visible = inS;
  PL.group.visible = PR.group.visible = melL.group.visible = melR.group.visible = isPair;
  dna.group.visible = raysD.mesh.visible = isDNA;

  // ── the main section: the tan (caps) and the pigment cell, per shot ──
  // rule 8: the beat's subject wins; what delivered the previous beat steps back to about a third
  let tan = 0, fill = 0, travel = 0, dimLiving = 0, dimDead = 0, melGlow = 0, uvGain = 0, pass = 0;
  if (shot === "hook" || shot === "close") { tan = 1; fill = 0.5; travel = 1; uvGain = 0.85; pass = BIO.pass; dimDead = 0.2; }
  if (shot === "section") { uvGain = fadeIn(t, SH.section, 0.6) * (1 - 0.6 * fadeIn(t, CUE.living, 0.5)); pass = 1; dimDead = 0.4 * fadeIn(t, CUE.living - 0.2, 0.5); }
  if (shot === "cell") {
    fill = E.inout2(seg(t, CUE.down + 0.6, CUE.melanin + 1.2)); melGlow = fadeIn(t, CUE.down, 0.5);
    dimLiving = 0.35 * fadeIn(t, CUE.message - 0.3, 0.5); dimDead = 0.6;
  }
  if (shot === "tan") {
    const u = Math.min(1, DAYS(t) / 3);
    fill = 1 - 0.5 * u; travel = E.inout2(u); tan = E.inout2(seg(u, 0.35, 1)); melGlow = 1 - 0.7 * u; dimDead = 0.6;
  }
  if (shot === "field" || shot === "gauge") { tan = 1; fill = 0.4; travel = 1; uvGain = shot === "field" ? 1 : 0.25; pass = BIO.pass; dimDead = 0.2; }
  if (shot === "gauge") { dimDead = 0.8; dimLiving = 0.85; }
  if (inS) {
    S.set({ tone, dimDead, dimLiving, mortar: 0, glowDead: 0 });
    caps.set({ tone, tan, dim: shot === "gauge" ? 0.6 : 0 });
    mel.set({ tone, fill, travel, glow: melGlow, dim: shot === "gauge" ? 0.6 : 0 });
    // in the hook and the close the pigment cell is part of the scene, not a subject: kept quiet
    if (shot === "hook" || shot === "close" || shot === "field") mel.group.visible = true;
  }
  // the dashes stop at the caps when there is a tan (all but `pass` of them), else at their own depth in the living layers
  const capY = -BIO.sc_um - BIO.gran_um - 6;
  const passing = [];
  A.ray = inS ? raysS.set(t, { gain: inS ? uvGain : 0, color: UVC, pass, stopAt: tan > 0.5 ? () => capY : null, hit: passing }) : null;
  if (!inS) raysS.set(t, { gain: 0 });
  A.pass = passing.length ? passing[0] : [40, -50, 26];
  // the followed cell: an ink ring as the camera arrives, and again as the cell that "notices"
  const ringOp = shot === "section" ? fadeIn(t, CUE.living - 0.2, 0.5) : shot === "cell" ? 1 - fadeIn(t, CUE.message, 0.6) : 0;
  hcRing.material.opacity = 0.75 * ringOp; hcRing.visible = ringOp > 0.01;
  A.hcell = [HC[0] + 7, HC[1] + 2, HC[2] + 2];
  const capCell = caps.cellNear(shot === "field" ? [24, -44, 30] : [BIO.mel_x + 8, -50, 30]);
  A.cap = [capCell.pos[0] + 3, capCell.pos[1] + 3, capCell.pos[2] + 2];
  A.melano = mel.at.body();

  // ── the message: beads from the cell down to the pigment cell ──
  const su = shot === "cell" ? seg(t, CUE.message - 0.2, CUE.melanin + 0.2) : 0;
  A.signal = sig.set(su, t, { gain: shot === "cell" ? winOp(t, CUE.message - 0.3, CUE.melanin + 0.6, 0.4) : 0, color: WATER }) || A.signal;

  // ── the pair: both under UV; only the one with p53 fills and tans ──
  if (isPair) {
    const k = E.inout2(seg(t, CUE.mice, CUE.never + 2.2));
    PL.set({ tone: tone + 0.16 * E.inout2(seg(k, 0.3, 1)), dimDead: 0.5 }); PR.set({ tone, dimDead: 0.5 });   // the one that tans darkens (illustration)
    capsL.set({ tone: tone + 0.16 * E.inout2(seg(k, 0.3, 1)), tan: E.inout2(seg(k, 0.4, 1)) }); capsR.set({ tone, tan: 0 });
    melL.set({ tone, fill: Math.min(1, k * 1.6), travel: E.inout2(seg(k, 0.3, 1)), glow: 0.4 });
    melR.set({ tone, fill: 0, travel: 0, glow: 0.4 * (1 - fadeIn(t, CUE.lacked, 0.5)) });
    raysP.set(t, { gain: fadeIn(t, SH.pair, 0.6) * 0.8, color: UVC, pass: 0.5 });
    A.pair_l = [PL.group.position.x - 14, 0, 23]; A.pair_r = [PR.group.position.x + 14, 0, 23];
  } else raysP.set(t, { gain: 0 });

  // ── the DNA ladder: two bases fuse on "fuse"; in dna2 the fused pair is held, lit ──
  if (isDNA) {
    const fuse = shot === "dna" ? E.out3(seg(t, CUE.fuse - 0.1, CUE.fuse + 0.5)) : 1;
    const glow = shot === "dna" ? Math.max(0, fuse - 0.6 * fadeIn(t, CUE.dna + 0.6, 0.8)) + 0.4 * fuse : 0.7 + 0.3 * fadeIn(t, CUE.answering, 0.4);
    dna.set({ fuse, glow, uv: UVC, spin: 0.12 * t, dim: shot === "dna" ? 0.6 * fadeIn(t, CUE.fuse, 0.5) : 0.6 });
    raysD.set(t, { gain: shot === "dna" ? 0.9 * (1 - fadeIn(t, CUE.fuse + 0.4, 0.8)) : 0, color: UVC, stopAt: () => 0 });
    A.dimer = dna.at.fused();
  }

  // ── the depth gauge: attached to the section's left cut edge, lifted to centre for the to-scale beat ──
  const xg = -S.dims.W / 2 + 2, zg = S.dims.D / 2;
  camera.updateMatrixWorld();
  const p0 = project(camera, [xg, 0, zg], W, H), p1 = project(camera, [xg, -100, zg], W, H);
  const lift = shot === "gauge" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  const gOp = (inS && shot !== "cell" && shot !== "tan" ? 1 : 0) * (shot === "section" ? 1 - fadeIn(t, SH.section + 0.6, 0.6) : 1) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4));
  const sc = BIO.sc_um + (G.sc_um - BIO.sc_um) * Math.min(1, lift * 4);   // attached: the dead layer's band; lifted: one parasol
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: gOp, lift, sc, paperUm: BIO.paper_um,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
