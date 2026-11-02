import * as THREE from "three";
// Back of the Envelope No. 002, "Everyone, one place" (films/channels/whatif/ep02). The picture as a pure
// function of t for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the crowd,
// every object and the overlay from t alone, then makes exactly one renderer.render().
//
// One world at true scale (1 unit = 1 m), the graph-paper desk (its ruling re-scales by powers of ten with the
// camera, so it reads as paper at 2 m and at 200 km): you (anchor blue) in half a square metre; the crowd
// (set/crowd.js) growing to everyone, 64 km a side; a Greater London-sized square over it; then the planet
// (the globe model at true size, everyone a single marker dot); then a cube of every body beside a 828 m tower;
// then back down to you. Everything timed comes from film.json (compile.py, hung on the voice).
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { segment, ring } from "cinema/sci/front.js";
import { createDesk } from "../set/desk.js";
import { createCrowd } from "../set/crowd.js";
import { createGlobe } from "../set/globe.js";
import { createFigure } from "../set/anchor.js";
import { createTower, createCube } from "../set/tower.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok, hdr } from "../set/look.js";

const FILM = window.FILM, W = window.W, H = window.H, PH = FILM.phys, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 1e4);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, kFloor: 2, threshold: 0.9, bloom: 0.4 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const beat = (id) => FILM.beats.find((b) => b.id === id);
const keyed = (keys, t, log = false) => {                         // piecewise ease between [t, v] keys
  let i = keys.findIndex((k) => k[0] > t);
  if (i < 0) return keys[keys.length - 1][1];
  if (i === 0) return keys[0][1];
  const [ta, va] = keys[i - 1], [tb, vb] = keys[i], u = E.inout2(seg(t, ta, tb));
  return log ? Math.exp(Math.log(va) + (Math.log(vb) - Math.log(va)) * u) : va + (vb - va) * u;
};

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 70 });
scene.add(desk.group);
const crowd = createCrowd({ tokens: TK, density: 2 });
crowd.mesh.material.depthTest = false;                           // a flat layer on the paper: no z-fight at any scale
scene.add(crowd.group);
const you = createFigure({ tokens: TK, height: 1.7 });
you.set({ at: [0, 0.85, 0] });
scene.add(you.group);
// your half square metre, and the Greater London-sized square (chalk outlines on the paper)
const sq = (color, width, dash = 0) => [0, 1, 2, 3].map(() => segment({ color, width, opacity: 0, dash, duty: 0.55 }));
const halfSq = sq(hdr("assume", 0.95), 3.2), lonSq = sq(hdr("chalk", 1.0), 4.2);
[...halfSq, ...lonSq].forEach((s) => { s.mesh.material.depthTest = false; s.mesh.renderOrder = 3; scene.add(s.mesh); });
const drawSq = (S, side, y, op, dashUnits) => {
  const h = side / 2, P = [[-h, y, -h], [h, y, -h], [h, y, h], [-h, y, h]];
  S.forEach((s, i) => { s.seg(P[i], P[(i + 1) % 4]).set({ opacity: op, ...(dashUnits ? { dash: 1 / dashUnits } : {}) }); });
};
// the planet at true size (two plaster halves, no cut), everyone as one marker ring
const planet = createGlobe({ R: PH.r_earth, tokens: TK });
planet.face.visible = false;
planet.shell.material.uniforms.uModel.value.multiplyScalar(0.62);     // dimmer than the desk-scale plaster: the cut from graphite never flashes (review 2 #5)
const back = planet.shell.clone(); back.rotation.y = Math.PI; planet.group.add(back);
planet.group.visible = false; scene.add(planet.group);
const dot = ring({ color: hdr("marker", 1.4), width: 3.6, opacity: 0 });
dot.mesh.material.depthTest = false; dot.mesh.renderOrder = 4; scene.add(dot.mesh);
// the cube of every body, and the tower
const cube = createCube({ tokens: TK, side: PH.cube }), tower = createTower({ tokens: TK, height: PH.tower, widen: 2.2, tip: 16 });   // the tip readable at phone size, so the 828 m reads clearly above the cube
scene.add(cube.group, tower.group);
// the 828 m line: a thin chalk rule from the tower's tip across over the cube, so "a little shorter" reads at a glance
const TIP_LINE = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: TK["chalk-2"] || "#A7AAB2", toneMapped: false, transparent: true, opacity: 0 }));
scene.add(TIP_LINE);
const CUBE_X = -PH.cube / 2 - 160, TOWER_X = 260;

// ── camera and overlay ──────────────────────────────────────────────────────
const rig = createRig(FILM.cam);
const hud = createHud({ camera, shots: FILM.shots });
const S = { you: [0, 1.9, 0], half: [PH.side_one / 2, 0, 0], london: [PH.side_lon / 2, 0, -PH.side_lon / 2], dot: [0, PH.r_earth, 0],
  tower: [TOWER_X, PH.tower, 0], cube: [CUBE_X - PH.cube * 0.3, PH.cube, 0] };   // the tower label points at the tip from the right; the cube's front face stands at z = 0 beside it
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const p of FILM.pills) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "70vmin", margin: "4vmin auto 0" });   // readable on a phone (second builder's review, 2 Nov)
const box = endBox(endEl, { t0: FILM.endCard, answer: "≈ 2.6 Londons", S1 });

window.seek = function (t) {
  const st = stage(t), shot = st.name;
  const P = rig.place(camera, shot, t);
  camera.near = Math.max(0.02, P.dist * 0.004); camera.far = P.dist * 60; camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const onDesk = shot !== "orbit";

  // the paper re-rules itself by powers of ten so it always reads as graph paper
  const unit = Math.pow(10, Math.floor(Math.log10(Math.max(1, P.dist / 12))));
  desk.group.visible = onDesk;
  desk.uniforms.uUnit.value = unit; desk.uniforms.uFar.value = Math.max(70, P.dist * 2.2);
  desk.update({ grid: 1, span: P.dist * 8, pool: [P.target[0], P.target[2]], casters: shot === "cube" ? [] : [[0, 1.7, 0, 0.3]] });

  // the crowd: its side and density over time, hatched while it is too tight
  const C = FILM.crowd, side = keyed(C.keys, t, true), dens = keyed(C.density, t);
  const hatch = Math.min(E.out3(seg(t, C.hatch[0], C.hatch[0] + 0.4)), 1 - E.in3(seg(t, C.hatch[1] - 0.4, C.hatch[1])));
  const full = Math.min(E.inout2(seg(t, C.full[0], C.full[0] + 0.8)), 1 - E.inout2(seg(t, C.full[1] - 0.8, C.full[1])));   // the packed street glimpse (ramps, never a pop)
  const glimpse = full > 0 ? Math.max(side, 26 * full) : side;
  crowd.group.visible = onDesk && shot !== "cube";
  crowd.set({ side: glimpse, density: full > 0 ? 2 + 2 * full : dens, hatch, opacity: 1, flow: t });
  you.group.visible = onDesk && shot !== "cube";
  // your half square metre, drawn on "half"; London's square over the crowd on "Londons"
  drawSq(halfSq, PH.side_one, 0.01, (shot === "you" || shot === "home" || shot === "end") ? E.out3(seg(t, CUE.half, CUE.half + 0.5)) * (1 - full) : 0);
  const lo = shot === "grow" ? E.out3(seg(t, CUE.london, CUE.london + 0.6)) : 0;
  drawSq(lonSq, PH.side_lon, 0.5, lo, 0);

  // the planet: everyone one dot at the top of the globe
  planet.group.visible = shot === "orbit";
  if (shot === "orbit") {
    planet.set({ light: [-0.5, 0.8, 0.4] });
    const cr = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), cu = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const rr = P.dist * 0.012;                                    // a ring a constant size on screen around the dot
    dot.arc({ center: [0, PH.r_earth + 1000, 0], r: rr, e1: cr.toArray(), e2: cu.toArray() }).set({ opacity: E.out3(seg(t, CUE.orbit + 0.6, CUE.orbit + 1.0)) });
  } else dot.set({ opacity: 0 });

  // the cube pours up on "packed like water"; the tower rises on "tallest"; in the work card the cube breathes
  // between the two density bounds as each row is said
  cube.group.visible = tower.group.visible = shot === "cube";
  if (shot === "cube") {
    const rows = FILM.work.rows, k = t < rows[1].t ? 1 : t < rows[2].t ? PH.cube_hi / PH.cube : PH.cube_lo / PH.cube;
    const kk = t < rows[1].t ? 1 : 1 + (k - 1) * E.inout2(seg(t, t < rows[2].t ? rows[1].t : rows[2].t, (t < rows[2].t ? rows[1].t : rows[2].t) + 0.6));
    cube.set({ x: CUBE_X, z: -PH.cube / 2, grow: E.inout2(seg(t, CUE.water, CUE.water + 1.4)) * kk, opacity: 1 });
    cube.group.scale.set(kk, 1, kk);
    tower.set({ x: TOWER_X, z: 0, grow: E.inout2(seg(t, CUE.tower - 0.3, CUE.tower + 1.0)), opacity: 1 });
    const x0 = CUBE_X - PH.cube * kk / 2 - 40, x1 = TOWER_X, u = E.out3(seg(t, CUE.tower + 1.0, CUE.tower + 1.8));
    TIP_LINE.scale.set((x1 - x0) * u, 7, 2); TIP_LINE.position.set(x1 - (x1 - x0) * u / 2, PH.tower, 0);   // drawn from the tip toward the cube
    TIP_LINE.material.opacity = 0.9 * u;
  }
  TIP_LINE.visible = shot === "cube";

  hud.update(t);
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
