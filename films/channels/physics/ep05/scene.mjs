// Rest Frame No. 005, "The spinning chair" (films/channels/physics/ep05): the picture, a pure function of t.
// The channel's Bench (../set: the cyc, the swivel chair and its wooden mannequin, the spin model, ink drawings, the
// title drop) plus the kit's blocks (hud, clock, strobe). Everything timed comes from film.json (compile.py).
//
// The physics: angular momentum conserved (set/spin.js; friction ignored, badged). The seated body's own moment of
// inertia (2.0 kg·m²) is an assumption, badged. The skater is an ink illustration.
//
// WRITING.md "The picture" 8, one line wins: what the caption names is the brightest thing; what delivered the beat
// before steps back to about a third (FILM.dim, keyed on cuts and words in compile.py): the ghost ladders by their
// opacity (two groups, arms out and arms in, each its own strobe), the chair and its sitter by a lerp toward the paper.
// The notes keep the channel's corners (FILM.notes: speed top-left, cheats top-right) and the spine readout sits in
// each shot's empty region (FILM.spineAt).
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { strobe } from "cinema/sci/strobe.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { createSitter } from "../set/chair.js";
import { spinner } from "../set/spin.js";
import { inkSet } from "../set/ink.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { unlit, screenAlpha } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, TAKES = FILM.takes, LAD = FILM.ladders, EC = FILM.endCard;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 5, 4000);

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;
const C = createSitter({ x: 0, z: 0 });
scene.add(C.group);
const SPIN = { chair: spinner({ ...FILM.model, moves: FILM.moves }), hook: spinner({ ...FILM.model, moves: FILM.hookMoves }) };

// ── rule 8: stepping back. dimAt(name, t) is the strength (1 as built, 1/3 stepped back, 0 gone) ──
const DIM = FILM.dim || {};
const dimAt = (name, t) => (DIM[name] ? keyed(DIM[name], t, "inout2") : 1);
// the chair and its sitter step back by a lerp toward the paper, after lighting and before tone mapping, on the
// scene-linear value that lands on #E6E2D8 (set/aces.js): at strength 1 the mix is 0, so the materials are as built.
// The lerp and the ghosts' opacity act in scene light, before the finish's curve, so a strength k goes through
// screenAlpha first: a third keeps a third of the contrast on screen (a two-thirds lerp would keep about 1/11)
const PAPER_HEX = TK.cyc || "#E6E2D8", PAPER = unlit(PAPER_HEX), chairFade = { value: 0 };
const onScreen = (k) => screenAlpha(k, TK["ink-2"] || "#4B505B", PAPER_HEX);
{ const mats = new Set();
  C.group.traverse((o) => { if (o.isMesh && o.material) mats.add(o.material); });
  mats.forEach((m) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFade = chairFade; sh.uniforms.uPaper = { value: PAPER };
      sh.fragmentShader = "uniform float uFade;\nuniform vec3 uPaper;\n" + sh.fragmentShader.replace("#include <tonemapping_fragment>",
        "gl_FragColor.rgb = mix(gl_FragColor.rgb, uPaper, uFade);\n#include <tonemapping_fragment>");
    };
    m.customProgramCacheKey = () => "rf-chair-fade";
  }); }

const clk = clock(FILM.clock, { words: { slow: "{n}× slower", fast: "{n}× faster", freeze: "paused" } });
const TAKE_NAMES = Object.keys(TAKES);
const takeAt = (t) => TAKE_NAMES.find((n) => t >= TAKES[n].t0 && t < TAKES[n].t1) || "loop";
const local = (take, t) => clk.tau(t) - TAKES[take].tauR;
const pose = (take, tau) => { const S = SPIN[TAKES[take].spin]; return { phi: S.phi(tau), R: 100 * S.r(tau) }; };
const handAt = (take, i, t) => { const p = pose(take, local(take, t)); return C.handAt(p.phi, p.R, i); };

// ── the ghosts: both dumbbells every 1/10 s, as beads at hand height ──
// two strobes, so each group steps back on its own (FILM.dim "out", "in"): SO holds the arms-out ladders (live and
// recorded) and the hook's and the loop's spirals, which share its slots; SI the arms-in ladders. Their materials are
// transparent (opacity 1 as built, so frame 0 is unchanged): over the sitter a stepped-back bead fades into her
// instead of turning into a pale dot, as a lerp toward the paper would
const INK2 = unlit(TK["ink-2"] || "#4B505B");
const ghosts = (max) => strobe({ geometry: new THREE.SphereGeometry(1, 20, 14), radius: 2.6, max, pop: 0.14,
  material: new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true }), rim: { color: [0.045, 0.048, 0.055], width: 0.42, strength: 0.62 }, park: [0, 60, 0] });
const SO = ghosts(36), SI = ghosts(14);
scene.add(SO.group, SI.group);
const GCOL = new THREE.Color().setRGB(0.30, 0.31, 0.34), REC = LAD.rec;
const ladder = (S, name, take, L, slot, i, rec) => S.ladder(`${name}:${i}`, {
  at: (tau) => { const p = pose(take, tau); return C.handAt(p.phi, p.R, i); }, tau0: L.tau0, dt: FILM.dt, n: L.n,
  when: rec ? () => REC.t0 - 1 : (tau) => clk.tOf(TAKES[take].tauR + tau), t0: rec ? REC.t0 : L.t0, t1: rec ? REC.t1 : L.t1, slot, color: GCOL });
[0, 1].forEach((i) => {
  ladder(SO, "hook", "hook", LAD.hook, i * 18, i);
  ladder(SO, "loop", "loop", LAD.loop, i * 18, i);
  ladder(SO, "out", "chair", LAD.out, i * 10, i);
  ladder(SO, "rec-out", "chair", LAD.out, i * 10, i, true);
  ladder(SI, "in", "chair", LAD.in, i * 7, i);
  ladder(SI, "rec-in", "chair", LAD.in, i * 7, i, true);
});
const gapPt = (name, k) => { const S = name === "rec-out" ? SO : SI, a = S.ghost(`${name}:1`, k), b = S.ghost(`${name}:1`, k + 1); return [(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2]; };

// ── the whoa's skater: an ink drawing (a scratch spin, arms overhead), motion arcs turning around her ──
const SK = FILM.skater, I = inkSet({ color: TK["ink-2"] || "#4B505B" });
const skater = new THREE.Group(); skater.position.set(SK.x, 0, SK.z);
{
  const h = SK.h, s = h / 162;
  const pts = (a) => a.map(([x, y]) => [x * s, y * s]);
  skater.add(I.poly(pts([[0, 0], [1, 40], [0, 82]]), 1.1));                         // the standing leg
  skater.add(I.poly(pts([[0, 82], [-4, 60], [2, 44]]), 1.1));                        // the crossed leg
  skater.add(I.poly(pts([[0, 82], [0, 128]]), 1.4));                                 // the body
  skater.add(I.poly(pts([[0, 124], [-5, 146], [-1, 168]]), 1.0));                     // the arms, together overhead
  skater.add(I.poly(pts([[0, 124], [5, 146], [1, 168]]), 1.0));
  const head = I.ring(9 * s, 1.0); head.position.set(0, 140 * s, 0); skater.add(head);
  skater.add(I.poly(pts([[-10, 0], [12, 0]]), 1.4));                                 // the blade
}
const arcs = [0, 1, 2].map((k) => { const g = new THREE.Group(), r = I.ring(24, 0.7); r.scale.set(1, 0.32, 1); g.add(r); g.position.set(SK.x, 40 + 34 * k, SK.z); scene.add(g); return g; });
scene.add(skater);

// ── camera ──
const lerp = (a, b, u) => a + (b - a) * u;
const camNow = (t) => {
  const st = shotAt(t, FILM.shots), ks = FILM.cam[st.name];
  let i = ks.findIndex((k) => k.t > t); if (i < 0) i = ks.length - 1; if (i < 1) i = 1;
  const a = ks[Math.min(i - 1, ks.length - 1)], b = ks[Math.min(i, ks.length - 1)];
  const u = a === b ? 1 : ease(b.ease || "p2")(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  return { look: [0, 1, 2].map((j) => lerp(a.look[j], b.look[j], u)), dist: lerp(a.dist, b.dist, u), yaw: lerp(a.yaw, b.yaw, u), pitch: lerp(a.pitch, b.pitch, u), fov: lerp(a.fov, b.fov, u) };
};
const placeCam = (t) => {
  const c = camNow(t), y = (c.yaw * Math.PI) / 180, p = (c.pitch * Math.PI) / 180;
  camera.position.set(c.look[0] + c.dist * Math.sin(y) * Math.cos(p), c.look[1] + c.dist * Math.sin(p), c.look[2] + c.dist * Math.cos(y) * Math.cos(p));
  camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.lookAt(c.look[0], c.look[1], c.look[2]);
  camera.updateMatrixWorld();
};
window.CINEMA_FOCUS = () => ({ point: [0, 80, 0], fstop: 0 });
const PROBE_PTS = [[-80, 95, 0], [80, 95, 0], [0, 95, -80], [0, 95, 80], [0, 0, 0]].map((p) => new THREE.Vector3(...p));
const pv = new THREE.Vector3();

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
const NS = FILM.notes || { clock: "tl", hook: "br" };   // the speed column top-left, the standing cheats top-right
hud.badge("warp", { from: clk, slot: NS.clock });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an.hand) return (t) => handAt(an.hand[0], an.hand[1], t);
  if (an.skater) return () => [SK.x - 6, 150, SK.z];
  if (an.gap) return () => gapPt(an.gap[0] === "out" ? "rec-out" : "rec-in", an.gap[1]);
  return () => an.point;
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.anchor), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: !!lb.fixed, v: lb.v });
const SPN = FILM.spine;
const spineAt = (t) => SPN.find((s) => t >= s.t0 && t < s.t1) || (t < SPN[0].t0 ? SPN[0] : SPN[SPN.length - 1]);
const spineVal = (t) => {
  const s = spineAt(t);
  if (s.kind === "const") return s.v;
  if (s.kind === "ramp") return keyed(s.keys, t, "inout2");
  const tau = local(s.take, t);
  return (SPIN.chair.omega(tau) * 60) / (2 * Math.PI);
};
// the step this frame shows: seek sets it from t before hud.update, so the plate is measured (and placed by
// placeSpine, clamped inside the safe box) with this frame's label, unit, digits and width, never the last frame's
let spNow = SPN[0], spLit = false;
const spineOpts = { value: spineVal, fmt: (v) => v.toFixed(spNow.dp), unit: "rpm", label: SPN[0].label, t0: SPN[0].t0, t1: SPN[SPN.length - 1].t1,
  minCh: SPN[0].minCh ?? 3, lit: () => spLit }, counterEl = hud.counter("spine", spineOpts);
placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
hud.badge("hook-speed", { kind: "speed", slot: NS.hook, t0: 0, t1: FILM.hookNote.t1, text: FILM.hookNote.text });
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const foot = document.createElement("div"); foot.className = "rf-foot"; foot.textContent = FILM.end.foot; endEl.appendChild(foot);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS
    + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const take = takeAt(t), p = pose(take, local(take, t));
  C.set(p.phi, p.R);
  chairFade.value = 1 - onScreen(dimAt("chair", t));   // a third from "Skaters" to the takeaway: the skater, then the record, win
  const sk = t >= CUE.skater[0] && t < CUE.skater[1];
  skater.visible = sk; arcs.forEach((g, k) => { g.visible = sk; g.rotation.y = 2.4 * (t - CUE.skater[0]) + k * 1.3; });
  SO.mesh.material.opacity = onScreen(dimAt("out", t)); SI.mesh.material.opacity = onScreen(dimAt("in", t));
  SO.update(t); SI.update(t);
  const hands = [0, 1].map((i) => C.handAt(p.phi, p.R, i));
  cyc.update({ grid: 1, casters: [[0, 48, 0, 26], [hands[0][0], 60, hands[0][2], 6], [hands[1][0], 60, hands[1][2], 6]] });
  if (window.CINEMA && window.CINEMA.mode === "probe") {
    PROBE_PTS.forEach((q, i) => {
      pv.copy(q).project(camera);
      if (Math.abs(pv.x) <= 1.15 && Math.abs(pv.y) <= 1.15 && pv.z < 1) window.CINEMA.probe.set("bench" + i, [(pv.x + 1) * 0.5 * W, (1 - pv.y) * 0.5 * H]);
    });
  }
  dropT(t); dropE(t);
  spNow = spineAt(t); spLit = !!(spNow.lit && t >= spNow.lit[0] && t < spNow.lit[1]);
  counterLb.textContent = spNow.label; counterU.textContent = spNow.unit; counterV.style.minWidth = (spNow.minCh ?? 3) + "ch";
  counterV.textContent = spineVal(t).toFixed(spNow.dp);
  hud.update(t);   // writes the value through fmt (this step's decimals), measures the plate, places it, lights it
  renderer.render(scene, camera);
};
