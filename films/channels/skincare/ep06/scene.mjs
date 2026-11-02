import * as THREE from "three";
// Outer Layer No. 006, "Goosebumps" (films/channels/skincare/ep06). The picture as a pure function of t for the film
// kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, every object and the overlay from t
// alone, then makes exactly one renderer.render().
//
// The set (../set/follicle06.js): a patch of skin at the mm rung with fine hairs and their bumps; one follicle cut
// open with its muscle, nerve and stem cells, and a second beside it whose muscle is taken away; a furred coat. Plus
// the depth gauge and layer bars (../set/motif.js) and the microscope-stage rig (../set/rig.js). Everything timed
// comes from film.json, which compile.py hangs on the voice.
//
// Shots: hook (the payoff: deep-toned skin, bumps up round fine hairs) · follicle (one bump cut open: the muscle
// shortens on "tugs", the hair stands) · fur (a coat lifting, air trapped) · ours (our skin: the same follicles, fine
// hairs) · bulge (down to the stem cells; the nerve reaches them; the muscle holds it) · cold (frost; the nerve fires,
// the stem cells wake, a new hair grows) · nomuscle (the muscle taken away: the wiring fades) · gauge (to scale) ·
// close (back to the hook, for the loop).
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { lin } from "../set/look.js";
import { createPatch, createFollicle, createFur } from "../set/follicle06.js";

const FILM = window.FILM, W = window.W, H = window.H, BIO = FILM.bio, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 10, 30000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.92, bloom: 0.28, exposure: 1.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

scene.add(new THREE.HemisphereLight(0xf4f8ff, 0xe8ddd4, 1.25));
const key = new THREE.DirectionalLight(0xfff6ec, 2.1); key.position.set(-2400, 1100, 1400); scene.add(key);
const rim = new THREE.DirectionalLight(0xe8f2ff, 0.7); rim.position.set(800, 600, -2000); scene.add(rim);

// ── the set ─────────────────────────────────────────────────────────────────
const patch = createPatch({ size: 3000, spacing: 280, seed: 61 });
const F1 = createFollicle({ x: BIO.fx, seed: 63 });
const F2 = createFollicle({ x: BIO.fx + 1100, seed: 64 });   // touching F1: one continuous block
const fur = createFur({ x: BIO.px });
scene.add(patch.group, F1.group, F2.group, fur.group);
const WATER = lin(window.THEME.tokens["water-glow"]).map((v) => v * 1.6);
const fine = patch.nearest([260, 0, 420]);

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
  if (c.text.length > 9) el.style.setProperty("--hud-counter-size", `${(10 * 9 / c.text.length).toFixed(2)}vmin`);   // long words fit the safe box
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: at(L.anchor), t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.3vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "80vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-22vmin)";                              // the card (a four-line question) sits above the tease's caption plate
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe, liftK: 1.6, liftAt: [0.16, 0.24] });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;

const veil = document.createElement("div");                                // the cuts' dip to the slide colour (film.json "trans")
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
document.getElementById("hud").prepend(veil);
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const B0 = Object.fromEntries(FILM.beats.map((b) => [b.id, b.t0]));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name, tone = FILM.tone[shot];
  rig.place(camera, shot, t);
  const isP = ["hook", "ours", "close"].includes(shot), isF = ["follicle", "bulge", "cold", "nomuscle", "gauge", "payoff"].includes(shot);
  patch.group.visible = isP; F1.group.visible = isF && shot !== "nomuscle"; F2.group.visible = shot === "nomuscle";   // one block in frame at a time: no seams fur.group.visible = shot === "fur";

  // ── the patch: bumps up in the hook, flat then rising in "ours", rising again in the close ──
  if (isP) {
    // hook: the bumps rise on "goosebumps" (the frame moves in the first second); ours: the same follicles first with a
    // chimp's thick dark hairs, then ours (fine, pale) on "ours"; close: they rise again on "raises"
    const raise = shot === "hook" ? 0.2 + 0.8 * E.inout2(seg(t, CUE.goose - 0.6, CUE.goose + 0.6)) : shot === "ours" ? 0.15 : E.inout2(seg(t, CUE.raises - 0.3, CUE.looks + 0.6));
    const thick = shot === "ours" ? E.inout2(seg(t, CUE.chimp - 0.4, CUE.chimp + 0.3)) * (1 - E.inout2(seg(t, CUE.ours - 0.1, CUE.ours + 0.6))) : 0;   // grown and thinned over ~0.7 s, never swapped
    patch.set({ raise, tone, thick });
  }
  A.finehair = patch.at.hair(fine);

  // ── the follicle(s) ──
  if (isF) {
    let pull = 0, fire = 0, wake = 0, grow = 0, frost = 0, dimSkin = 0;
    if (shot === "follicle") { pull = E.inout2(seg(t, CUE.tugs - 0.1, CUE.upright + 0.4)); fire = fadeIn(t, CUE.cold - 0.2, 0.4) * (1 - fadeIn(t, CUE.bump + 0.8, 0.6)); }
    if (shot === "bulge") { pull = 0.3; fire = fadeIn(t, CUE.reaches - 0.4, 0.5); wake = 0.6 * fadeIn(t, CUE.stem - 0.2, 0.6); dimSkin = 0.35; }
    if (shot === "cold" || shot === "nomuscle") {
      frost = fadeIn(t, SH.cold + 0.2, 1.0); pull = 0.8; fire = 1;
      wake = 0.6 + 0.4 * E.inout2(seg(t, CUE.wakes - 0.2, CUE.wakes + 0.6)); grow = E.inout2(seg(t, CUE.wakes, CUE.sooner)); dimSkin = 0.3;   // the new hair reaches the surface on "sooner"
    }
    if (shot === "gauge") { pull = 0.2; dimSkin = 0.55; }
    if (shot === "payoff") { pull = 0.3 + 0.6 * E.inout2(seg(t, CUE.raises - 0.3, CUE.raises + 0.6)); fire = 1; wake = 0.4 + 0.5 * fadeIn(t, CUE.looks - 0.3, 0.8); grow = 1; }
    F1.set({ tone, pull, fire, t, wake, grow, frost, dimSkin, glow: WATER, pulseK: shot === "follicle" ? 1 : 0.5 });
    // the second follicle (no muscle): the same cold, its branch to the stem cells fading, its stem cells asleep
    // the muscle is taken away on "Take", then the wiring (branch and pulses) fades on "fades"; its hair waits
    const mu = shot === "nomuscle" ? 1 - E.inout2(seg(t, CUE.take, CUE.take + 0.8)) : 1;
    const wire = shot === "nomuscle" ? 1 - 0.85 * E.inout2(seg(t, CUE.fades - 0.6, CUE.fades + 0.7)) : 1;
    F2.set({ tone, pull: 0.8 * mu, fire: shot === "nomuscle" || shot === "cold" ? wire : 0, t, wake: 0.5 * wire, grow: 0, frost, dimSkin: 0.3, muscle: mu, wire, glow: WATER, pulseK: 0.5 });
  }
  A.muscle = F1.at.muscle(); A.nerve = F1.at.nerve(); A.hair = F1.at.hair(); A.stem = F1.at.stemC(); A.bulb = F1.at.newTip(); A.insertion = F1.at.insertion();
  A.nomus = F2.at.muscle(); A.nomnerve = F2.at.nerve();

  // ── the fur: raised on "fluffs", air thickening ──
  if (shot === "fur") fur.set({ raise: E.inout2(seg(t, CUE.fluffs - 0.1, CUE.fluffs + 0.9)), glow: WATER });   // up on "fluffs"
  A.air = fur.at.air();

  // ── the depth gauge: on the follicle section's left cut edge, lifted to centre for the to-scale beat ──
  const s0 = F1.at.surface();
  camera.updateMatrixWorld();
  const p0 = project(camera, [s0[0], 0, 130], W, H), p1 = project(camera, [s0[0], -100, 130], W, H);
  const lift = shot === "gauge" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  const gOp = (shot === "gauge" ? 1 : 0) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4));   // only the to-scale beat (the attached ruler crowded the follicle)
  const sc = G.sc_um;
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: gOp, lift, sc, paperUm: BIO.paper_um, scText: "< 30 µm",
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  let dip = 0;
  for (const tr of FILM.trans) dip = Math.max(dip, 1 - Math.min(1, Math.abs(t - tr.t) / 0.22));
  veil.style.opacity = (0.85 * dip).toFixed(4);
  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
