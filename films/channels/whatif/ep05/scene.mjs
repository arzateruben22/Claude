import * as THREE from "three";
// Back of the Envelope No. 005, "Everybody jump" (films/channels/whatif/ep05). The picture as a pure function
// of t for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the world and the
// overlay from t alone, then makes exactly one renderer.render().
//
// One world (bible §2), in metres: the graph-paper desk is the ground. You (anchor blue) crouch on it at frame
// 0; on "jump" you leave it; then everyone gathers round you, one dot a person (set/crowd.js, No. 002's safe 2
// per m²), until the crowd is a square 64 km across. Everyone jumps (slowed ×4, badged), and the camera pulls
// back past the paper's horizon to the planet the desk was resting on (set/ladder05.js createPlanet: the crowd
// a marker dot on top). The whoa dives back in, all the way down to your foot, and on through the powers of
// ten (the ladder: your jump, a hair, a red blood cell, an atom) to the Earth's step, boxed. Landing, the step
// shrinks to nothing; the takeaway climbs back out to you, landed. Everything timed comes from film.json.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createFigure } from "../set/anchor.js";
import { createCrowd } from "../set/crowd.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";
import { createLadder, createPlanet } from "../set/ladder05.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 1e9);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.95, bloom: 0.3 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

// the zoom's ease, shared with compile.py (zkeys): smoothstep between keys, so each move starts and lands softly
const smooth = (u) => u * u * (3 - 2 * u);
const keyedZ = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, z0] = keys[i - 1], [t1, z1] = keys[i]; return z0 + (z1 - z0) * smooth((t - t0) / (t1 - t0)); }
  return keys[keys.length - 1][1];
};

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 60 });
scene.add(desk.group);
const crowd = createCrowd({ tokens: TK, density: WD.density, dotR: 0.22 });
scene.add(crowd.group);
const planet = createPlanet({ tokens: TK, R: WD.R });
scene.add(planet.mesh);
const FIG_H = WD.figH;
const you = createFigure({ tokens: TK, height: FIG_H });
scene.add(you.group);
const ladder = createLadder({ tokens: TK, items: WD.items });
scene.add(ladder.mesh);

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { you: () => S._you, ground: () => [0.0, 0.0, 0.25], crowd: () => [WD.side / 2 * 0.6, 0, 0], dot: () => [0, 0, 0] };
S._you = [0, FIG_H, 0];
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, unit: c.unit, lit: () => !!c.lit });
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  const o = { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v };
  if (L.item !== undefined) o.screen = () => { const p = ladder.screen(L.item); return [p[0], p[1]]; };
  else o.at = S[L.anchor];
  hud.label(L.id, o);
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.6vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "62vmin", margin: "4vmin auto 0" });
const box = endBox(endEl, { t0: FILM.endCard, answer: FILM.spine[FILM.spine.length - 1].terms.find((x) => x[0] === "ans")[1], S1: Math.min(W, H) / 1080 });

// ── staging ─────────────────────────────────────────────────────────────────
// the jump: height above the ground of a body leaving at take-off speed v (slowed by `slow`), from t0
const hop = (t, t0, slow) => { const u = (t - t0) / slow, T = WD.air; return u > 0 && u < T ? WD.v0 * u - 0.5 * 9.81 * u * u : 0; };

window.seek = function (t) {
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  camera.near = Math.max(0.02, pose.dist / 400); camera.far = pose.dist * 60 + WD.R * 3; camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));

  // you: crouched at frame 0 and the end (the loop), the solo hop on "jump", everyone's hop in the change
  const solo = hop(t, CUE.hop1, 1), all = hop(t, CUE.hop2, CUE.slow);
  const crouch = Math.max(1 - seg(t, CUE.hop1 - 0.35, CUE.hop1), seg(t, FILM.endCard + 0.6, FILM.endCard + 1.4));
  const y = solo + all;
  you.set({ at: [0, FIG_H / 2 + y - 0.18 * FIG_H * crouch, 0], arms: y > 0.01 ? 1 : 0 });
  you.group.scale.set(1, 1 - 0.18 * crouch, 1);
  S._you = [0, FIG_H + y, 0];

  // the crowd: grows round you from "gather" to "together"; it jumps with you; gone at frame 0 and the end
  const grow = smooth(clamp01((t - CUE.gather[0]) / (CUE.gather[1] - CUE.gather[0])));
  const side = Math.exp(Math.log(WD.side0) + (Math.log(WD.side) - Math.log(WD.side0)) * grow);
  const co = t < CUE.gather[0] ? 0 : (shot === "end" ? 1 - seg(t, FILM.endCard, FILM.endCard + 1.0) : 1);
  crowd.set({ side, opacity: co });
  crowd.group.position.y = 0.02 + all;
  crowd.mesh.visible = co > 0.002 && side > 0.5;

  // the desk gives way to the planet as the camera leaves the paper's horizon
  const plan = clamp01((Math.log10(pose.dist) - 4.6) / 0.8);
  desk.group.visible = plan < 0.999;
  const ds = Math.max(1, pose.dist / 18);                                   // the paper reaches as far as the view does (its ruling stays 1 m and fades with distance)
  desk.group.scale.set(ds, ds, ds); desk.uniforms.uFar.value = 60 * ds;
  planet.set({ opacity: plan, cam: camera.position.toArray(), dot: WD.side * 0.5 * Math.max(1, pose.dist / 2e6), dotOpacity: clamp01((Math.log10(pose.dist) - 5.2) / 0.8) });

  // the ladder: the powers-of-ten overlay, in from the dive's foot, out in the takeaway
  const z = keyedZ(CUE.zkeys, t);
  const lo = Math.min(seg(t, CUE.ladder[0], CUE.ladder[0] + 0.5), 1 - seg(t, CUE.ladder[1] - 0.5, CUE.ladder[1]));
  const step = 1 - smooth(clamp01((t - CUE.land[0]) / (CUE.land[1] - CUE.land[0])));
  ladder.set({ z, opacity: lo, grow: { [WD.items.length - 1]: Math.max(1e-6, step) } });

  desk.update({ grid: 1, pool: [pose.target[0], pose.target[2]], casters: [[0, FIG_H + y, 0, 0.35]] });

  hud.update(t);
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
