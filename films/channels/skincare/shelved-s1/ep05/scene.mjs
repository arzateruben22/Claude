import * as THREE from "three";
// Outer Layer No. 005, "Same cells, every colour" (films/channels/skincare/ep05). The picture as a pure function of t
// for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, every object and the overlay
// from t alone, then makes exactly one renderer.render().
//
// The set: three of the channel's sections side by side (light, medium, deep: ../set/section.js; tone is this
// episode's subject, the bible's one exception to one tone per episode), each with two pigment cells on its basal row
// drawn 32 µm apart (the claim's spacing) and melanin caps (../set/melanocyte04.js), UV dashes (../set/rays.js), one
// cell's grains per tone up close (../set/grains05.js), a globe of UV and skin colour (../set/globe05.js), the depth
// gauge and layer bars (../set/motif.js) and the microscope-stage rig (../set/rig.js). Everything timed comes from
// film.json, which compile.py hangs on the voice.
//
// Shots: trio (the payoff, three sections; no cut, the camera pushes down to the basal rows and the pigment cells are
// counted: the same) · grains (an iris into one pigment cell: one cell per tone, small clustered grains → larger, one
// by one) · globe (an iris out: skin colour follows UV) · skies (an iris back to the three sections, each under its
// own sky, never one tone alone) · gauge (the same place: to scale, a bracket across two pigment cells) · close (the
// hook's composition, for the loop).
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { createSection, createVessels } from "../set/section.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { lin } from "../set/look.js";
import { createRays } from "../set/rays.js";
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

// ── the set: three sections, two pigment cells on each basal row (32 µm apart), caps over the nuclei ──
const LAY = { sc: BIO.sc_um, gran: BIO.gran_um, spin: BIO.spin_um, basal: BIO.basal_um, rows: BIO.rows };
const HALF = BIO.gap_um / 2;
const SEC = BIO.sec_x.map((x, i) => {
  const S = createSection({ width: 50, depth: 46, ...LAY, seed: 31 + i, x, mortarFloor: 0 });
  const caps = createCaps(S); S.group.add(caps.mesh);
  const V = createVessels({ x: [-24, 24], ys: [-94, -106], z: 22, r: 2.2 }); S.group.add(V.group);
  const mels = [-HALF, HALF].map((mx, j) => createMelanocyte(S, { x: mx, seed: 40 + i * 3 + j, branches: 3, n: 30, spread: 9 }));
  scene.add(S.group, ...mels.map((m) => m.group));
  return { S, caps, V, mels, x, tone: TONES[i] };
});
const pigGlow = SEC.flatMap((s) => s.mels.map((m) => { const g = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: true })); const b = m.at.body(); g.position.set(b[0] - 4, b[1] - 1, b[2] + 1); g.renderOrder = 5; scene.add(g); return g; }));
const UVC = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 0.9), HIT = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 1.4);   // as No. 002, the glows kept low here
// one sky per section: fierce over the deepest, middling over the medium, weak over the lightest (the UV map's three
// latitudes); the dashes start low enough never to pass behind the notes
const SKY = [{ n: 6, pass: 0.7, rate: 0.3, sky: 0.12 }, { n: 30, pass: 0.25, rate: 0.45, sky: 0.3 }, { n: 110, pass: 0.04, rate: 0.62, sky: 0.6 }];
const RAYS = SKY.map((k, i) => { const r = createRays({ n: k.n, x: [-22, 22], z: [6, 22], top: 26, seed: 52 + i, width: 0.4, len: 7, depthIn: 26 }); scene.add(r.group); return r; });
// each section's own sky: a violet wash above it, strong over the deepest, faint over the lightest (the UV map's three
// latitudes, a model), so the pairing on screen is sky with skin, not tone with outcome
const skyMats = SKY.map(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: true }));
const skyQuads = SKY.map((k, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(50, 20), skyMats[i]); m.position.set(BIO.sec_x[i], 11, -10); scene.add(m); return m; });
// folate (in the deepest section's upper dermis, kept safe) and vitamin D (made in the lightest one's living layers)
const bead = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: true }));
const folate = new THREE.Group(), vitd = new THREE.Group();
for (let i = 0; i < 6; i++) { const b = bead(1.7); b.position.set(BIO.sec_x[2] - 10 + i * 4, -96 + Math.sin(i) * 1.5, 24); folate.add(b); }
for (let i = 0; i < 7; i++) { const b = bead(1.5); b.position.set(BIO.sec_x[0] - 14 + i * 4.5, -58 + Math.cos(i * 1.7) * 5, 24); vitd.add(b); }
scene.add(folate, vitd);
// the bracket for the to-scale beat: two ink ticks and a bar between the middle section's two pigment cells
const ink = new THREE.MeshBasicMaterial({ color: 0x13252c, transparent: true, opacity: 0, toneMapped: false, depthTest: false });
const bracket = new THREE.Group();
const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 3.4, 1), ink), tick = [0, 1].map(() => new THREE.Mesh(new THREE.BoxGeometry(3.4, 14, 1), ink));
bracket.add(bar, ...tick); bracket.renderOrder = 10; bar.renderOrder = tick[0].renderOrder = tick[1].renderOrder = 10;
scene.add(bracket);
const yBr = SEC[1].S.junction(0) + BIO.basal_um + 8;
bracket.position.set(BIO.sec_x[1], yBr, 25);
tick[0].position.x = -HALF; tick[1].position.x = HALF;
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
// the tally: under each section, a count that lands on the same number as the pigment cells light in step
const tally = BIO.sec_x.map(() => {
  const el = document.createElement("div");
  Object.assign(el.style, { position: "absolute", zIndex: "3", font: "500 3.4vmin/1 var(--font-mono)", color: "var(--text)", background: "var(--hud-plate)",
    padding: "1vmin 2.2vmin", borderRadius: "999px", whiteSpace: "nowrap", boxShadow: "var(--hud-shadow)", opacity: "0", fontFeatureSettings: '"tnum" 1' });
  document.getElementById("hud").appendChild(el); return el;
});
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-22vmin)";                              // the card (a four-line question) sits above the tease's caption plate
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
// the irises: a slide-coloured disc grows out of the subject before the cut; a hole opens from the next subject after it
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0" });
document.getElementById("hud").prepend(veil);

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
const CT = CUE.count_t;

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  rig.place(camera, shot, t);
  const inS = ["trio", "skies", "gauge", "close"].includes(shot), isG = shot === "grains", isW = shot === "globe";
  for (const s of SEC) { s.S.group.visible = inS; for (const m of s.mels) m.group.visible = inS; }
  for (const g of GR) g.group.visible = isG;
  globe.group.visible = isW;

  // ── the sections ──
  const rows = shot === "trio" ? fadeIn(t, CUE.feeds - 0.6, 0.8) : 0;          // the push down to the basal rows
  SEC.forEach((s, i) => {
    let dim = 0.3, glow = 0, tan = 0.55;
    if (shot === "trio") { glow = Math.max(fadeIn(t, CUE.pigment - 0.2, 0.5) * (1 - rows), 0.35 * rows); dim = 0.3 + 0.4 * rows; }
    if (shot === "close") glow = 0.7;
    if (shot === "skies") tan = 0.6 + 0.4 * (i / 2);
    if (shot === "gauge") { dim = 0.75; glow = 0.4; }
    s.S.set({ tone: s.tone, dimDead: dim, dimLiving: shot === "trio" ? 0.65 * rows : shot === "gauge" ? 0.75 : 0.1, mortar: 0, glowDead: 0 });
    s.V.set({ k: 1, opacity: 1 });
    s.caps.set({ tone: s.tone, tan, dim: shot === "gauge" ? 0.6 : 0 });
    s.mels.forEach((m, j) => {
      // the count: in step across the three sections, each section's two pigment cells light one after the other
      const counted = shot === "trio" ? fadeIn(t, CT[j] - 0.1, 0.25) : 0;
      const lit = shot === "gauge" && i === 1 ? fadeIn(t, G.bracket[0] - 0.4, 0.4) : 0;
      m.set({ tone: s.tone, fill: 0.6, travel: shot === "trio" ? 0.4 + 0.6 * E.inout2(seg(t, CUE.feeds, CUE.feeds + 2.4)) : 1, glow: 2.4 * Math.max(glow, counted, lit), dim: shot === "gauge" ? 0.6 * (1 - lit) : 0 });   // glow > 1: the pigment cells are the brightest things
    });
  });
  A.mel1 = SEC[1].mels[0].at.body();
  // the pigment cells' glow: lit with the count (and dimly from the hook), a warm light the bloom picks up
  pigGlow.forEach((g, k) => {
    const j = k % 2, on = shot === "trio" ? Math.max(0.45 * fadeIn(t, CUE.pigment - 0.2, 0.5), fadeIn(t, CT[j] - 0.1, 0.25)) * (1 - fadeIn(t, SH.grains - 0.3, 0.3)) : shot === "close" ? 0.5 : shot === "gauge" && k >= 2 && k < 4 ? fadeIn(t, G.bracket[0] - 0.4, 0.4) : 0;
    g.material.color.setRGB(1.6, 1.45, 1.25); g.material.opacity = 0.8 * on; g.visible = on > 0.01;
  });
  // the tally under each section
  SEC.forEach((s, i) => {
    const n = shot === "trio" ? CT.filter((c) => t >= c).length : 0;
    const p = project(camera, [s.x, -112, 23], W, H);   // just under the basal row
    const el = tally[i];
    el.textContent = `${["light", "medium", "deep"][i]}: ${n}`;
    el.style.left = `${Math.min(0.76 * W, Math.max(0.17 * W, p.x)).toFixed(1)}px`;   // inside the safe box
    el.style.top = `${(0.5 * H).toFixed(1)}px`; el.style.transform = "translate(-50%, 0)";   // a fixed band under the basal rows in the count shot
    el.style.opacity = (shot === "trio" ? fadeIn(t, CT[0] - 0.1, 0.3) * (1 - fadeIn(t, SH.grains - 0.5, 0.4)) : 0).toFixed(3);
  });
  A.low0 = [SEC[0].x - 12, -120, 23]; A.low2 = [SEC[2].x + 12, -120, 23];

  // ── skies: each section under its own UV; folate kept safe under the fiercest, vitamin D made under the weakest ──
  const capY = -BIO.sc_um - BIO.gran_um - 6;
  SKY.forEach((k, i) => { skyMats[i].color.setRGB(...UVC); skyMats[i].opacity = k.sky * (shot === "skies" ? fadeIn(t, SH.skies + 0.1, 0.6) : 0); skyQuads[i].visible = skyMats[i].opacity > 0.002; });
  RAYS.forEach((r, i) => r.set(t, { filmTop: capY + 4, filmBottom: capY - 2, pass: SKY[i].pass, gain: shot === "skies" ? fadeIn(t, SH.skies + 0.2, 0.6) : 0, color: UVC, hitColor: HIT, x0: BIO.sec_x[i], rate: SKY[i].rate }));
  const fo = shot === "skies" ? fadeIn(t, CUE.folate - 0.6, 0.5) : 0, vd = shot === "skies" ? fadeIn(t, CUE.vitd - 0.3, 0.6) : 0;
  const neutral = [1.3, 1.27, 1.2];
  folate.children.forEach((b) => { b.material.color.setRGB(...neutral); b.material.opacity = fo; }); folate.visible = fo > 0.01;
  vitd.children.forEach((b, i) => { b.material.color.setRGB(...neutral); b.material.opacity = vd * (0.7 + 0.3 * Math.sin(t * 2 + i)); }); vitd.visible = vd > 0.01;
  A.folate = [BIO.sec_x[2] + 2, -96, 24]; A.vitd = [BIO.sec_x[0] - 4, -58, 24];

  // ── to scale: the bracket across the middle section's two pigment cells ──
  const bOn = shot === "gauge" ? E.out3(seg(t, G.bracket[0], G.bracket[1])) : 0;
  ink.opacity = 0.85 * (shot === "gauge" ? fadeIn(t, G.bracket[0] - 0.2, 0.3) : 0);
  bar.scale.x = Math.max(1e-3, BIO.gap_um * bOn); bar.position.x = -HALF + BIO.gap_um * bOn / 2;
  bracket.visible = ink.opacity > 0.01;

  // ── the grains: the three cells fill with their grains; the deep one's land on "larger" ──
  if (isG) GR.forEach((g, i) => g.set({ show: fadeIn(t, SH.grains + 0.2 + i * 0.5, 1.2), spread: E.out3(seg(t, SH.grains, CUE.larger + 0.6)), dim: i === 1 ? 0.3 * fadeIn(t, CUE.deeper, 0.5) : 0 }));
  A.g0 = [GR[0].group.position.x, 18, 10]; A.g2 = [GR[2].group.position.x, 18, 10]; A.g1 = [GR[1].group.position.x, 0, 10];

  // ── the globe: the UV band, then the dots fill in and follow it ──
  if (isW) globe.set({ uv: 0.6 + 0.4 * fadeIn(t, CUE.sunlight - 0.4, 0.8), dots: 0.7 + 0.3 * E.inout2(seg(t, SH.globe + 0.3, CUE.matched + 0.2)), spin: 0.18 * (t - SH.globe) - 0.6 });
  A.band = globe.at.band();

  // ── the depth gauge: on the light section's left cut edge in the wide shots, lifted to centre for the to-scale beat ──
  const s0 = SEC[0].S, xg = s0.group.position.x - s0.dims.W / 2 + 2, zg = s0.dims.D / 2;
  camera.updateMatrixWorld();
  const p0 = project(camera, [xg, 0, zg], W, H), p1 = project(camera, [xg, -100, zg], W, H);
  const lift = shot === "gauge" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  const gOp = (shot === "gauge" ? fadeIn(t, G.rise[0], 0.3) : 0) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4));
  const sc = BIO.sc_um + (G.sc_um - BIO.sc_um) * Math.min(1, lift * 4);
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: gOp, lift, sc, paperUm: BIO.paper_um,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  // ── the irises: a slide-coloured disc grows round the outgoing subject (to about a third of the frame), then a disc
  // of the same size sits on the incoming subject and shrinks away: never an empty frame, always a point to follow ──
  A.globe = [BIO.wx, 0, 0]; A.mid = [BIO.sec_x[1], -40, 23];
  let rad = 0, subj = null;
  for (const tr of FILM.trans) {
    const d = t - tr.t;
    if (d < 0 && d > -0.4) { rad = 30 * E.in2(1 + d / 0.4); subj = A[tr.from]; }
    else if (d >= 0 && d < 0.45) { rad = 30 * (1 - E.out2(d / 0.45)); subj = A[tr.to]; }
  }
  if (subj && rad > 0.05) {
    const p = project(camera, subj, W, H);
    veil.style.background = `radial-gradient(circle at ${(p.x / W * 100).toFixed(2)}% ${(p.y / H * 100).toFixed(2)}%, var(--slide) ${rad.toFixed(2)}vmax, transparent ${(rad + 0.6).toFixed(2)}vmax)`;
    veil.style.opacity = "1";
  } else {
    // a three-frame step through the slide colour on the dark-to-pale cut into the grains, and the scene fades toward
    // the slide before the end card rises, so the card never sits muddy over the sections
    const step = 1 - Math.min(1, Math.abs(t - SH.grains) / 0.1), end = 0.75 * E.inout2(seg(t, FILM.endCard - 0.6, FILM.endCard));
    veil.style.background = "var(--slide)"; veil.style.opacity = Math.max(0.6 * step, end).toFixed(4);
  }
  // the lifted gauge's column headings show only with the lift
  for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "paper" || el.textContent === G.bar) el.setAttribute("opacity", lift.toFixed(3));

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
