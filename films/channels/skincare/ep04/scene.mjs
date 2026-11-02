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
import { createSection, createVessels } from "../set/section.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { lin } from "../set/look.js";
import { createRays } from "../set/rays.js";
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
const S = createSection({ width: 180, depth: 60, ...LAY, seed: 3, mortarFloor: 0 });   // the lipid sheets stay hidden (not this episode's subject)
const V = createVessels({ x: [-86, 86], ys: [-96, -122], z: 33, r: 1.7 });   // a few vessels near the junction, so the dermis isn't a blank slab
S.group.add(V.group);
const caps = createCaps(S); S.group.add(caps.mesh);
const mel = createMelanocyte(S, { x: BIO.mel_x, seed: 21 });
scene.add(S.group, mel.group);
// the followed living cell: the cut-face spinous cell nearest the planned point
const hc = caps.cellNear(BIO.hcell), HC = hc.pos;
const hcRing = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x13252c, side: THREE.BackSide, transparent: true, opacity: 0, toneMapped: false }));
hcRing.position.set(HC[0], HC[1], HC[2]); hcRing.scale.set(7.4, 6.8 * hc.sy / 6, 7.4);
scene.add(hcRing);
const p53 = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: true }));
p53.position.set(HC[0], HC[1], HC[2] + 2.5); p53.scale.setScalar(3.4);
scene.add(p53);
// the pair (why): two small sections side by side; the left (with p53) tans, the right (without) never does
const PL = createSection({ width: 60, depth: 46, ...LAY, seed: 11, x: -36, mortarFloor: 0 }), PR = createSection({ width: 60, depth: 46, ...LAY, seed: 12, x: 36, mortarFloor: 0 });
const capsL = createCaps(PL), capsR = createCaps(PR);
PL.group.add(capsL.mesh); PR.group.add(capsR.mesh);
const melL = createMelanocyte(PL, { x: 0, seed: 22, branches: 3, n: 50, spread: 20 }), melR = createMelanocyte(PR, { x: 0, seed: 23, branches: 3, n: 50, spread: 20 });
scene.add(PL.group, PR.group, melL.group, melR.group);
// UV dashes over each place
const UVC = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 0.9), HIT = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 3.0);   // as No. 002: rays under the bloom knee; what gets in glows
const WATER = lin(window.THEME.tokens["water-glow"]).map((v) => v * 1.6);
// the rays fall in front of the cut face's first cells (z near the face), so the ones that get in can be seen
const raysS = createRays({ n: 90, x: [-80, 70], z: [14, 29], top: 70, seed: 9, width: 0.4, len: 7 });
const raysP = createRays({ n: 60, x: [-64, 60], z: [8, 22], top: 70, seed: 10, width: 0.4, len: 7 });
const raysD = createRays({ n: 10, x: [-40, 40], z: [-6, 6], top: 80, seed: 13, width: 0.6, len: 12, depthIn: 0 });
raysD.group.position.x = BIO.dna_x;
scene.add(raysS.group, raysP.group, raysD.group);
const HIDE = { gain: 0 };
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
endEl.style.transform = "translateY(-22vmin)";                              // the card (a four-line question) sits above the tease's caption plate
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;   // the lifted bar names this episode's subject

// cuts: an iris (a slide-coloured disc that grows from the followed cell's nucleus, then opens on the next place)
// on the scale jumps, a short dip to the slide colour on the others (film.json "trans")
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0" });
document.getElementById("hud").prepend(veil);
// "to scale": a dozen parasols stacked inside the paper's bar, one by one, so "a dozen stacked" is on screen
const gsvg = document.querySelector(".ol-gauge"), NS = "http://www.w3.org/2000/svg";
const stack = Array.from({ length: G.n }, () => { const r = document.createElementNS(NS, "rect"); r.setAttribute("fill", "var(--water)"); r.setAttribute("rx", 2 * S1); gsvg.appendChild(r); return r; });
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
  dna.group.visible = raysD.group.visible = isDNA;

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
  if (shot === "field" || shot === "gauge") { tan = 1; fill = 0.5 - 0.1 * fadeIn(t, SH.field, 0.8); travel = 1; pass = BIO.pass; uvGain = shot === "field" ? fadeIn(t, SH.field, 0.8) : 1 - 0.75 * fadeIn(t, SH.gauge, 0.8); dimDead = 0.6 - 0.4 * fadeIn(t, SH.field, 0.8); }
  if (shot === "gauge") { dimDead = 0.2 + 0.6 * fadeIn(t, SH.gauge, 0.8); dimLiving = 0.85 * fadeIn(t, SH.gauge, 0.8); }
  if (shot === "close") { const k = fadeIn(t, SH.close, 1.0); dimDead = 0.8 - 0.6 * k; dimLiving = 0.85 * (1 - k); uvGain = 0.25 + 0.6 * k; }   // continuous from the to-scale shot
  if (inS) {
    S.set({ tone, dimDead, dimLiving, mortar: 0, glowDead: 0 });
    V.set({ k: 1, opacity: 1 - 0.5 * dimLiving });
    caps.set({ tone, tan, dim: shot === "gauge" ? 0.6 : 0 });
    mel.set({ tone, fill, travel, glow: melGlow, dim: shot === "gauge" ? 0.6 : 0 });
    // in the hook and the close the pigment cell is part of the scene, not a subject: kept quiet
    if (shot === "hook" || shot === "close" || shot === "field") mel.group.visible = true;
  }
  // the dashes stop at the caps when there is a tan (all but `pass` of them), else at their own depth in the living layers
  // untanned: the rays end in the living layers (the damage); tanned: most end at the caps, `pass` of them get by
  const capY = -BIO.sc_um - BIO.gran_um - 6;
  const band = tan > 0.5 ? { filmTop: capY + 4, filmBottom: capY - 2 } : { filmTop: -BIO.sc_um - 4, filmBottom: -BIO.sc_um - 22 };
  const got = raysS.set(t, inS ? { ...band, pass: tan > 0.5 ? pass : 0, gain: uvGain, color: UVC, hitColor: HIT } : HIDE);
  A.ray = [HC[0] - 20, 30, 26];
  A.pass = [16, capY - 10, 29];   // the band under the caps where the rays that get by glow
  // the followed cell: an ink ring as the camera arrives, and again as the cell that "notices"
  const ringOp = shot === "section" ? fadeIn(t, CUE.living - 0.2, 0.5) : shot === "cell" ? 1 - fadeIn(t, CUE.message, 0.6) : 0;
  hcRing.material.opacity = 0.75 * ringOp; hcRing.visible = ringOp > 0.01;
  A.hcell = [HC[0] + 7, HC[1] + 2, HC[2] + 2];
  const pOn = shot === "cell" ? fadeIn(t, CUE.guardian - 0.1, 0.4) * (1 - fadeIn(t, CUE.melanin, 0.8)) : 0;
  p53.material.color.setRGB(...[1, 0.98, 0.94].map((v) => v * (1.2 + 0.5 * Math.sin((t - CUE.guardian) * 5.2) ** 2)));   // a neutral light: water is the bible's water/lipid colour
  p53.material.opacity = pOn; p53.visible = pOn > 0.01;
  const capCell = caps.cellNear(shot === "field" ? [24, -44, 30] : [BIO.mel_x + 8, -50, 30]);
  A.cap = [capCell.pos[0] + 3, capCell.pos[1] + 3, capCell.pos[2] + 2];
  A.melano = mel.at.body();

  // ── the message: beads from the cell down to the pigment cell ──
  const su = shot === "cell" ? seg(t, CUE.message - 0.2, CUE.melanin + 0.2) : 0;
  A.signal = sig.set(su, t, { gain: shot === "cell" ? winOp(t, CUE.message - 0.3, CUE.melanin + 0.6, 0.4) : 0, color: [1.3, 1.27, 1.2] }) || A.signal;

  // ── the pair: both under UV; only the one with p53 fills and tans ──
  if (isPair) {
    const k = E.inout2(seg(t, CUE.mice, CUE.never + 1.6));
    PL.set({ tone: tone + 0.4 * E.inout2(seg(k, 0.3, 1)), dimDead: 0.5 }); PR.set({ tone, dimDead: 0.5 });   // the one that tans darkens (illustration)
    capsL.set({ tone: tone + 0.4 * E.inout2(seg(k, 0.3, 1)), tan: E.inout2(seg(k, 0.4, 1)) }); capsR.set({ tone, tan: 0 });
    melL.set({ tone: tone + 0.4 * k, fill: Math.min(1, k * 1.6), travel: E.inout2(seg(k, 0.3, 1)), glow: 0.4 });
    melR.set({ tone, fill: 0, travel: 0, glow: 0.4 * (1 - fadeIn(t, CUE.lacked, 0.5)) });
    raysP.set(t, { filmTop: -BIO.sc_um - 4, filmBottom: -BIO.sc_um - 22, pass: 0, gain: fadeIn(t, SH.pair, 0.6) * 0.8, color: UVC, hitColor: HIT });
    A.pair_l = [PL.group.position.x - 14, 0, 23]; A.pair_r = [PR.group.position.x + 14, 0, 23];
  } else raysP.set(t, HIDE);

  // ── the DNA ladder: two bases fuse on "fuse"; in dna2 the fused pair is held, lit ──
  if (isDNA) {
    const fuse = shot === "dna" ? E.out3(seg(t, CUE.fuse - 0.1, CUE.fuse + 0.5)) : 1;
    const glow = shot === "dna" ? Math.max(0, fuse - 0.6 * fadeIn(t, CUE.dna + 0.6, 0.8)) + 0.4 * fuse : 0.7 + 0.3 * fadeIn(t, CUE.answering, 0.4);
    dna.set({ fuse, glow, uv: UVC, spin: 0.12 * t, dim: shot === "dna" ? 0.6 * fadeIn(t, CUE.fuse, 0.5) : 0.6 });
    raysD.set(t, { filmTop: 2, filmBottom: -2, pass: 0, gain: shot === "dna" ? 0.9 * (1 - fadeIn(t, CUE.fuse + 0.4, 0.8)) : 0, color: UVC.map((v) => v * 1.4), hitColor: HIT });
    A.dimer = dna.at.fused();
  }

  // ── the depth gauge: attached to the section's left cut edge, lifted to centre for the to-scale beat ──
  const xg = -S.dims.W / 2 + 2, zg = S.dims.D / 2;
  camera.updateMatrixWorld();
  const p0 = project(camera, [xg, 0, zg], W, H), p1 = project(camera, [xg, -100, zg], W, H);
  const lift = shot === "gauge" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  const gOp = (shot === "gauge" ? 1 : 0) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4));
  const sc = BIO.sc_um + (G.sc_um - BIO.sc_um) * Math.min(1, lift * 4);   // attached: the dead layer's band; lifted: one parasol
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: gOp, lift, sc, paperUm: BIO.paper_um,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  // the transitions. Iris: before the cut a slide-coloured disc grows out of the subject (the followed nucleus, or the
  // fused bases); after it, a hole opens from the next place's subject, so the eye goes in through one and out of the other
  let dip = 0, disc = 0, hole = 0;
  for (const tr of FILM.trans) {
    const d = t - tr.t;
    if (tr.kind === "dip") dip = Math.max(dip, 1 - Math.min(1, Math.abs(d) / 0.22));
    else if (d < 0 && d > -0.35) disc = 0.62 * E.in2(1 + d / 0.35);                 // the disc never quite fills the frame,
    else if (d >= 0 && d < 0.4) hole = 0.28 + 0.72 * E.out2(d / 0.4);               // and the next place shows at once: no empty frame
  }
  if (disc > 0 || hole > 0) {
    const subj = shot === "section" || shot === "cell" ? [HC[0], HC[1], HC[2]] : dna.at.fused(), p = project(camera, subj, W, H);
    const at = `${(p.x / W * 100).toFixed(2)}% ${(p.y / H * 100).toFixed(2)}%`, r = ((disc || hole) * 125).toFixed(2), r2 = (+r + 0.6).toFixed(2);
    veil.style.background = disc > 0 ? `radial-gradient(circle at ${at}, var(--slide) ${r}vmax, transparent ${r2}vmax)`
      : `radial-gradient(circle at ${at}, transparent ${r}vmax, var(--slide) ${r2}vmax)`;
    veil.style.opacity = "1";
  } else { veil.style.background = "var(--slide)"; veil.style.opacity = (0.85 * dip).toFixed(4); }
  for (const el of gsvg.querySelectorAll("text")) if (el.textContent === "paper") el.setAttribute("opacity", (lift * E.out3(seg(t, G.stack[0] - 0.2, G.stack[0] + 0.3))).toFixed(3));
  // the parasol stack inside the lifted gauge's paper bar (read from motif.js's own bar, so it follows any change there)
  const pb = gsvg.querySelector('rect[stroke]');
  const bxP = +pb.getAttribute("x"), bwP = +pb.getAttribute("width"), y0L = +pb.getAttribute("y"), pxL = 0.15 * H / 100;
  stack.forEach((r, i) => {
    const on = lift * E.out3(seg(t, G.stack[0] + (G.stack[1] - G.stack[0]) * i / G.n, G.stack[0] + (G.stack[1] - G.stack[0]) * (i + 1) / G.n));
    r.setAttribute("x", bxP + 8 * S1); r.setAttribute("width", Math.max(0, bwP - 16 * S1));
    r.setAttribute("y", y0L + i * G.sc_um * pxL + 1); r.setAttribute("height", Math.max(0, G.sc_um * pxL - 2));
    r.setAttribute("opacity", on.toFixed(3));
  });
  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
