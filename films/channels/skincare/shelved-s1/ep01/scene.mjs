import * as THREE from "three";
// Outer Layer No. 001, "The dead layer" (films/channels/skincare/ep01). The picture as a pure function of t for
// the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the cell's climb, every object
// and the overlay from t alone, then makes exactly one renderer.render().
//
// The set is the channel's section (../set/section.js: a block of skin cut open, the climbing cell, water beads),
// the depth gauge and the layer-bar motif (../set/motif.js), the microscope-stage rig (../set/rig.js) and the
// shared kit (kits/cinema/sci: hud.js, clock.js). Everything timed comes from film.json, which compile.py hangs on
// the voice.
//
// Shots: hook (the payoff: the section in a light tone, its dead rows lit) · section (one continuous dive in a deep
// tone: the rows named, one cell's climb under a speed note, the wall and its mortar, water kept inside) · walls
// (two sections in a medium tone: a finished wall and a thin one, water leaving through the thin one) · gauge (the
// to-scale segment over the dimmed section) · close (back to the hook's composition, for the loop).
// Honesty (film.json "badges"): "simplified" (the section), the clock's speed note, "model" (bricks and mortar),
// "illustration" (the two walls), the study's name and year, "cheek; varies by site".
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { createSection, createClimber, createBeads, createFlakes, toneColor } from "../set/section.js";
import { createRays } from "../set/rays.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { lin } from "../set/look.js";

const FILM = window.FILM, W = window.W, H = window.H, BIO = FILM.bio, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;                                        // the section is cut open by clipping planes
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 2, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.92, bloom: 0.28, exposure: 1.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });               // no depth of field: the slide is all in focus
injectCss();

// ── light: a lamp over the slide (key, top-left-front), a cool fill from the sky, a thin rim behind the cut ──
scene.add(new THREE.HemisphereLight(0xf4f8ff, 0xe8ddd4, 1.25));
const key = new THREE.DirectionalLight(0xfff6ec, 2.1); key.position.set(-120, 220, 160); scene.add(key);
const rim = new THREE.DirectionalLight(0xe8f2ff, 0.7); rim.position.set(80, 60, -200); scene.add(rim);

// ── the set ─────────────────────────────────────────────────────────────────
const LAY = { sc: BIO.sc_um, gran: BIO.gran_um, spin: BIO.spin_um, basal: BIO.basal_um };
const S = createSection({ width: 180, depth: 60, rows: BIO.rows, ...LAY, seed: 3 });
scene.add(S.group);
const WL = createSection({ width: 60, depth: 46, rows: BIO.rows, ...LAY, seed: 11, x: -36 });   // born near term: the finished wall
const thin = 4, scThin = BIO.sc_um * thin / BIO.rows;                                   // born before 30 weeks: a thin wall (illustration)
const WR = createSection({ width: 60, depth: 46, rows: thin, ...LAY, sc: scThin, seed: 12, x: 36 });
scene.add(WL.group, WR.group);
const climber = createClimber();
scene.add(climber.group);
const WATER = lin(window.THEME.tokens["water-glow"]).map((v) => v * 1.6);
// the water is the subject when it's named: large, glowing beads (the review: 3–5 px specks didn't read)
const beadsS = createBeads({ n: 60, x: [-80, 80], z: [-14, 27], y0: -72, wallY: -BIO.sc_um, seed: 5, size: 3.0 });
beadsS.mesh.renderOrder = 20; beadsS.mesh.material.depthTest = false;   // drawn over the cells: the water is the subject
// the walls' beads: the same rising water under both; a share passes (left 12%, right 64%: ≈ 5.3×, claims c11); a dense,
// fast stream from the thin wall against a trickle from the finished one
const beadsL = createBeads({ n: 70, x: [-60, -12], z: [-16, 23], y0: -60, wallY: -BIO.sc_um, seed: 6, pass: (i, R) => R() < 0.1, size: 3.4, period: [1.8, 1.0] });
const beadsR = createBeads({ n: 110, x: [22, 50], z: [-6, 23], y0: -60, wallY: -scThin, seed: 7, pass: (i, R) => R() < 0.6, size: 3.4, period: [1.4, 0.8] });   // a dense column up through the thin wall
scene.add(beadsS.mesh, beadsL.mesh, beadsR.mesh);
const flakes = createFlakes({ n: 7, x: [-55, 55], z: 26, seed: 9 });                // "waiting to flake away"
scene.add(flakes.mesh);
// one dead cell lifted a little out of its row while it's named (rule 8: the named thing wins)
const one = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 0.9, 6, 1), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 }));
scene.add(one);
// the tease's bridge to No. 002: a few UV rays landing on the dead layer
const rays = createRays({ n: 26, x: [-70, 70], z: [-10, 26], top: 70, seed: 51, width: 0.4, len: 7 });   // crisp streaks, as in No. 002
scene.add(rays.group);
const UVC = lin(window.THEME.tokens["uv-glow"]).map((v) => v * 0.9);

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
const DAYS = (t) => Math.max(0, CLK.climb.tau(t)) / 86400;
for (const b of FILM.badges) hud.badge(b.id, b.clock ? { from: CLK[b.clock], t0: b.t0, t1: b.t1, slot: b.slot } : { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at };
  if (c.fmt === "days") Object.assign(o, { value: (t) => Math.min(c.lit, DAYS(t)), fmt: (v) => `day ${Math.round(v)}`, lit: (v) => v >= c.lit - 1e-6, minCh: 6 });
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
endEl.style.transform = "translateY(-14vmin)";                                // clear of the tease's caption plate
const gauge = createGauge({ root: document.getElementById("hud"), W, H, S1, safe: hud.safe });

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const winOp = (t, t0, t1, d = 0.4) => Math.min(fadeIn(t, t0, d), 1 - E.in3(seg(t, t1, t1 + d * 0.8)));
const B0 = Object.fromEntries(FILM.beats.map((b) => [b.id, b.t0]));
const add = (a, b) => a.map((v, i) => v + b[i]);
const D = S.dims;

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;   // a frame's motion blur never blends two shots across a cut
  const shot = stage(t).name, tone = FILM.tone[shot];
  rig.place(camera, shot, t);
  const inSection = shot === "hook" || shot === "section" || shot === "close";
  S.group.visible = inSection; WL.group.visible = WR.group.visible = shot === "walls";

  // ── the main section ──
  // rule 8: the beat's subject wins; what delivered the previous beat steps back to about a third
  let dimDead = 0, dimLiving = 0, glowDead = 0, mortar = 0;
  // the hook: the dead rows lit from frame 0 (the brightest thing), then on "isn't" the push down lights the living
  if (shot === "hook") { const k = E.inout2(seg(t, CUE.dead_lit - 0.6, CUE.dead_lit + 0.6)); glowDead = 0.7 * (1 - k); dimLiving = 0.85 * (1 - k); dimDead = 0.3 * k; }   // the dead rows win frame 0: the living ones dark under them
  // the close: the living glow on "Underneath", then the dead rows win on "died"
  if (shot === "close") {
    const u1 = E.inout2(seg(t, CUE.under - 0.2, CUE.under + 0.5)), u2 = E.inout2(seg(t, CUE.died - 0.2, CUE.died + 0.5));
    glowDead = 0.2 + 1.0 * u2; dimLiving = 0.6 * (1 - u1) + 0.8 * u2; dimDead = 0.5 * u1 * (1 - u2);   // "died": the dead layer wins clearly
  }
  if (shot === "section") {
    dimLiving = 0.6 * fadeIn(t, B0.normal, 1.0) * (1 - fadeIn(t, CUE.living, 1.0));   // from where the hook left it (no one-frame jump), the rows the subject until "the living ones"
    dimDead = 0.6 * fadeIn(t, CUE.living, 1.0) * (1 - fadeIn(t, B0.why, 1.0)); // then the living layers (1 s blends: no jump)
    const climbing = winOp(t, CUE.born - 0.3, CUE.apart[1] + 0.3, 0.5);
    dimLiving = Math.max(dimLiving * (1 - fadeIn(t, CUE.born - 0.3, 0.5)), 0.75 * climbing);
    dimDead = Math.max(dimDead, 0.6 * climbing);
    mortar = fadeIn(t, CUE.lipid - 0.15, 0.6);                               // "fats for mortar": the lipid sheets light
    glowDead = 0.5 * fadeIn(t, CUE.bricks - 0.15, 0.5) * (1 - 0.6 * fadeIn(t, CUE.lipid, 0.5));
    if (t >= CUE.water - 0.3) dimLiving = Math.max(dimLiving, 0.4 * fadeIn(t, CUE.water - 0.3, 0.6));   // the water is the subject
  }
  S.set({ tone, dimDead, dimLiving, mortar, glowDead, mortarColor: WATER });
  A.sc_top = add(S.at.scTop(0.66), [0, 0, 0]);
  A.sc_mid = S.at.scMid(0.45);   // leaders end inside the safe box
  A.corneo = S.at.corneo(4, 0.62);
  A.living = S.at.living(0.74);
  A.brick = S.at.corneo(9, 0.5);
  A.mortar = S.at.corneo(6, 0.42);

  // the named dead cell, lifted out of its row toward the camera
  const oneOp = shot === "section" ? winOp(t, CUE.dead - 0.3, CUE.living - 0.3, 0.4) : 0;
  one.visible = oneOp > 0.002;
  if (one.visible) {
    const c = S.at.corneo(4, 0.62);
    one.position.set(c[0], c[1] + 2.2 * oneOp, c[2] + 3 * oneOp);
    one.material.color.setRGB(...toneColor("corneo", tone).map((v) => v * 1.15)); one.material.emissive.setRGB(...toneColor("corneo", tone).map((v) => v * 0.35 * oneOp));
    A.corneo = one.position.toArray();
  }
  flakes.set(t, { t0: CUE.flake, color: toneColor("corneo", tone), gain: shot === "section" ? 1 - fadeIn(t, CUE.flake + 2.4, 0.4) : 0 });
  rays.set(t, shot === "close" ? { filmTop: 0, filmBottom: 0, pass: 0, gain: fadeIn(t, CUE.rays - 0.3, 0.6), color: UVC } : { gain: 0 });

  // ── the climbing cell ──
  if (shot === "section" && t >= CUE.born - 0.4 && t < B0.why + 0.6) {
    const u = Math.min(1, DAYS(t) / 14), k = E.inout2(seg(t, CUE.apart[0], CUE.apart[1]));
    const yB = S.at.basal(0.5)[1], yTop = -D.SC + D.rowH * 0.6;
    const y = yB + (yTop - yB) * E.inout2(u);
    const pos = [0, y, D.D / 2 - 5];
    const body = toneColor("living", tone).map((v, i) => v + (toneColor("corneo", tone)[i] - v) * Math.max(u * 0.5, k));
    climber.set({ pos, u, k, tone, glow: 1 - 0.7 * fadeIn(t, B0.why, 0.5), bodyColor: body, nucColor: toneColor("nucleus", tone) });
    climber.group.scale.setScalar(1.35 * fadeIn(t, CUE.born - 0.4, 0.4) * (1 - fadeIn(t, B0.why, 0.6)) + 1e-4);   // drawn a little larger than its neighbours: it wins its frames
    A.climber = add(pos, [6, 0, 0]);
  } else climber.hide();

  // ── water: kept inside by the wall (why), and leaving through the thin wall (whoa) ──
  beadsS.set(t, { gain: shot === "section" ? fadeIn(t, CUE.water - 0.4, 0.6) : 0, color: WATER });
  const wb = shot === "walls" ? fadeIn(t, CUE.babies ?? B0.whoa, 0.15) * (1 - 0.7 * fadeIn(t, B0.toscale + 0.3, 0.8)) : 0;   // the water carries across the match cut
  const back = shot === "walls" ? fadeIn(t, B0.toscale + 0.3, 0.8) : 0;      // the card is the subject in the to-scale beat
  WL.set({ tone, mortar: 1, mortarColor: WATER, dimLiving: 0.55 + 0.3 * back, glowDead: 0.6 * (1 - back), dimDead: 0.6 * back });
  WR.set({ tone, mortar: 1, mortarColor: WATER, dimLiving: 0.55 + 0.3 * back, glowDead: 0.6 * (1 - back), dimDead: 0.6 * back });
  beadsL.set(t, { gain: wb, color: WATER });
  const passR = beadsR.set(t, { gain: wb, color: WATER });
  A.wall_l = [WL.group.position.x + 16, 0, 23];
  A.wall_r = [WR.group.position.x - 16, 0, 23];
  A.beads = [WR.group.position.x - 6, 22, 20];   // a fixed spot in the stream (a passing bead's anchor made the label jump)

  // ── the depth gauge: attached to the section's left cut edge, lifted to centre for the to-scale beat ──
  const sec = shot === "walls" ? WL : S, ox = sec.group.position.x;
  const xg = ox - sec.dims.W / 2 + 2, zg = sec.dims.D / 2;
  camera.updateMatrixWorld();
  const p0 = project(camera, [xg, 0, zg], W, H), p1 = project(camera, [xg, -100, zg], W, H);
  // the ruler: attached while the layers are being named (hook, normal), then away; lifted out of the walls shot
  const lift = shot === "walls" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  const gOp = shot === "walls" ? Math.min(1, Math.max(0, (lift - 0.6) / 0.3)) : (shot === "hook" || shot === "section") ? 1 - fadeIn(t, B0.normal - 0.5, 0.4) : 0;   // the ruler only in the hook: gone before the wide captions   // gone before the wide captions; no flash over the left wall
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: gOp, lift, sc: BIO.sc_um, paperUm: BIO.paper_um,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
