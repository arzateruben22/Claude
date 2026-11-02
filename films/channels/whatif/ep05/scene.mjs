import * as THREE from "three";
// Back of the Envelope No. 005, "Everybody jump" (films/channels/whatif/ep05). The picture as a pure function
// of t for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the world and the
// overlay from t alone, then makes exactly one renderer.render().
//
// One world (bible §2; rebuilt after review round 1, so it no longer re-runs No. 002's crowd-to-planet
// pull-back): a model Earth stands on the graph-paper desk (badged "a model"), and you (anchor blue, not to
// scale) crouch on its top at frame 0. On "jump" you leave it and it dips the other way, a marker arrow beside
// the dip (exaggerated, badged); everyone gathers round you as a cap of blue beads; everyone jumps (slowed ×4)
// and the globe dips again. For "off course" the camera pulls out to its dashed path round the Sun, a ghost globe
// knocked off it and back; then the speed counters, you against the Earth, while the camera pushes in. The whoa
// dives into your foot and hands over to the powers-of-ten ladder (set/ladder05.js, true metres): your jump, a
// hair, a red blood cell, an atom, the Earth's step (boxed), which shrinks back to nothing as we land. The takeaway
// climbs back out to you, landed. Everything timed comes from film.json, which compile.py hangs on the voice.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring } from "cinema/sci/front.js";
import { createDesk } from "../set/desk.js";
import { createFigure } from "../set/anchor.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok, hdr } from "../set/look.js";
import { createLadder, createPlanet, createBeads, createArrow } from "../set/ladder05.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.01, 2000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.95, bloom: 0.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const smooth = (u) => u * u * (3 - 2 * u);
const keyedZ = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, z0] = keys[i - 1], [t1, z1] = keys[i]; return z0 + (z1 - z0) * smooth((t - t0) / (t1 - t0)); }
  return keys[keys.length - 1][1];
};

// ── the set ─────────────────────────────────────────────────────────────────
const RM = WD.RM, C0 = WD.centre, TOP = 2 * RM;
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 120 });
scene.add(desk.group);
const globe = createPlanet({ tokens: TK, R: RM });
scene.add(globe.mesh);
const ghost = createPlanet({ tokens: TK, R: RM });
scene.add(ghost.mesh);
const beads = createBeads({ tokens: TK, R: RM, n: 1400, bead: 0.045 });
scene.add(beads.group);
const you = createFigure({ tokens: TK, height: WD.fig });
scene.add(you.group);
const arrow = createArrow({ tokens: TK, color: "marker" });
scene.add(arrow.group);
// the path round the Sun: a dashed chalk arc through the globe's centre, the Sun far off to −x
const path = ring({ color: hdr("chalk", 0.8), width: 2.2, dash: 90, opacity: 0 });
path.arc({ center: [C0[0] - WD.orbitR, C0[1], C0[2]], r: WD.orbitR, a0: -0.35, a1: 0.35 });
scene.add(path.mesh);
const ladder = createLadder({ tokens: TK, items: WD.items, cy: WD.cy });
scene.add(ladder.mesh);

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { _you: [0, TOP + WD.fig, 0], _arrow: [-1.7, RM + 2.6, RM + 0.4] };
const AN = {
  you: () => S._you, arrow: () => S._arrow, cap: () => [RM * Math.sin(WD.cap) + 0.1, C0[1] + RM * Math.cos(WD.cap), 0],
  path: () => [C0[0] - WD.orbitR + WD.orbitR * Math.cos(-0.25), C0[1], WD.orbitR * Math.sin(-0.25)], ghost: () => [WD.ghost[0] + RM * 0.7, WD.ghost[1] + RM * 0.4, WD.ghost[2]],
};
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, unit: c.unit, lit: () => Boolean(c.lit) });
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  const o = { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v };
  if (L.item !== undefined) o.screen = () => { const p = ladder.screen(L.item); return [p[0], p[1]]; };
  else o.at = AN[L.anchor];
  hud.label(L.id, o);
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.6vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "62vmin", margin: "4vmin auto 0" });
const box = endBox(endEl, { t0: FILM.endCard, answer: FILM.spine[FILM.spine.length - 1].terms.find((x) => x[0] === "ans")[1], S1: Math.min(W, H) / 1080 });

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
// a jump's shape, 0 → 1 → 0 over its time in the air (a parabola), from t0, slowed by `slow`
const hop = (t, t0, slow) => { const u = (t - t0) / (slow * WD.air); return u > 0 && u < 1 ? 4 * u * (1 - u) : 0; };

window.seek = function (t) {
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  camera.near = Math.max(0.005, pose.dist / 300); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));

  // the jumps: yours on "jump", everyone's in the change; the globe dips the other way (both drawn exaggerated)
  const h1 = hop(t, CUE.hop1, 1), h2 = hop(t, CUE.hop2, CUE.slow), h = Math.max(h1, h2);
  const dip = WD.dip * h;
  const gc = [C0[0], C0[1] - dip, C0[2]];
  globe.mesh.position.set(...gc);
  globe.set({ opacity: 1, cam: camera.position.toArray(), grid: 1, dotOpacity: 0 });
  const crouch = Math.max(1 - seg(t, CUE.hop1 - 0.35, CUE.hop1), seg(t, FILM.endCard + 0.6, FILM.endCard + 1.4));
  const fy = TOP - dip + WD.fig / 2 + WD.hop * h - 0.18 * WD.fig * crouch;
  you.set({ at: [0, fy, 0], arms: h > 0.02 ? 1 : 0 });
  you.group.scale.set(1, 1 - 0.18 * crouch, 1);
  S._you = [0, fy + WD.fig / 2, 0];

  // everyone: the cap of beads opens from you on "gather"…"together", lifts with the jump, gone at frame 0 and the end
  const ga = smooth(clamp01((t - CUE.gather[0]) / (CUE.gather[1] - CUE.gather[0])));
  const bo = t < CUE.gather[0] ? 0 : shot === "end" ? 1 - seg(t, FILM.endCard, FILM.endCard + 1.0) : 1;
  beads.set({ centre: gc, angle: WD.cap * ga, lift: WD.hop * h2, opacity: bo });

  // the arrow beside the globe, pointing down while it dips (and on "ground … whole planet")
  const pushWin = seg(t, CUE.hop1 - 0.1, CUE.hop1 + 0.2) * (1 - seg(t, CUE.gather[0] - 0.6, CUE.gather[0] - 0.1));
  const airWin = seg(t, CUE.hop2 - 0.2, CUE.hop2 + 0.2) * (1 - seg(t, beat("why").t0 - 0.5, beat("why").t0));
  const ao = Math.max(pushWin, airWin);
  const ax = -1.9, az = RM + 0.4, ay0 = C0[1] + 3.4 - dip, ay1 = C0[1] + 1.6 - dip - 1.0 * h;   // in front of the globe's face, left of you
  arrow.set({ from: [ax, ay0, az], to: [ax, ay1, az], width: 0.08, opacity: ao });
  S._arrow = [ax + 0.2, ay0 - 0.4, az];

  // the path round the Sun, and the ghost globe knocked off it (the wrong idea), out and back
  const why = shot === "path";
  path.set({ opacity: why ? E.out3(seg(t, beat("why").t0 + 0.2, beat("why").t0 + 1.2)) * (1 - seg(t, beat("whoa").t0 - 0.6, beat("whoa").t0)) : 0 });
  const gk = Math.min(E.inout2(seg(t, CUE.ghost[0], CUE.ghost[0] + 0.8)), 1 - E.inout2(seg(t, CUE.ghost[1] - 0.4, CUE.ghost[1] + 0.4)));
  ghost.mesh.position.set(C0[0] + (WD.ghost[0] - C0[0]) * gk, C0[1] + (WD.ghost[1] - C0[1]) * gk, C0[2] + (WD.ghost[2] - C0[2]) * gk);
  ghost.set({ opacity: why ? 0.45 * gk : 0, cam: camera.position.toArray(), grid: 1, dotOpacity: 0 });

  // the ladder: in from the dive's foot, out in the takeaway; dimmer under the work card
  const z = keyedZ(CUE.zkeys, t);
  const lo = Math.min(seg(t, CUE.ladder[0], CUE.ladder[0] + 0.5), 1 - seg(t, CUE.ladder[1] - 0.5, CUE.ladder[1]));
  const under = 1;                                                       // the work card zooms out to a small atom instead of dimming (review round 1)
  const step = 1 - smooth(clamp01((t - CUE.land[0]) / (CUE.land[1] - CUE.land[0])));
  ladder.set({ z, opacity: lo * under, grow: { [WD.items.length - 1]: Math.max(1e-6, step) } });

  desk.update({ grid: 1, pool: [pose.target[0], pose.target[2]], casters: [[gc[0], gc[1], gc[2], RM * 0.9]], span: Math.max(800, pose.dist * 8) });

  hud.update(t);
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
