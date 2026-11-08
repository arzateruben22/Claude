import * as THREE from "three";
// Possibility Lab No. 007, "Walking to the Moon" (films/channels/whatif/ep07). The picture as a pure function of t for
// the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the world and the overlay from t
// alone, then makes exactly one renderer.render().
//
// One world (bible §2), in true metres: you (anchor blue) stand on the graph-paper desk, which is the top of the Earth
// (set/ladder05.js's planet, R about 6,378 km, resting on the desk), and a thin line leaves the paper straight up. The
// camera pulls back (distance eased in log space) until the Earth and the Moon sit on that one line, thirty Earth-widths
// apart: a ruler of rings fills the gap. Three walkers climb it on one clock of years: nonstop (about 9), eight hours a
// day (about 26, blue: you) and 10,000 steps a day (about 140). The takeaway sends a small capsule up the same line
// in three days. Everything timed comes from film.json, which compile.py hangs on the voice; this file only stages it.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createFigure } from "../set/anchor.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";
import { createPlanet } from "../set/ladder05.js";
import { unlit } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 2000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.95, bloom: 0.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF", MARK = TK.marker || "#EB63FF";
const UP = new THREE.Vector3(0, 1, 0);

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 60 });
scene.add(desk.group);
const earth = createPlanet({ tokens: TK, R: WD.rE });                          // rests on the desk: its top is the paper
scene.add(earth.mesh);
const moon = createPlanet({ tokens: TK, R: WD.rM });
moon.mesh.position.set(0, WD.yMoon, 0);
scene.add(moon.mesh);
const you = createFigure({ tokens: TK, height: WD.fig });
you.set({ at: [0, WD.fig / 2, 0] });
scene.add(you.group);

// flat things in the world: a unit quad (width, length), a unit ring, a unit bead; each scaled to the camera's distance
const basic = (hex, o = 1) => new THREE.MeshBasicMaterial({ color: unlit(hex), transparent: true, opacity: o, depthTest: false, depthWrite: false });
const mk = (geo, hex, order = 4) => { const m = new THREE.Mesh(geo, basic(hex)); m.renderOrder = order; m.frustumCulled = false; m.userData.noProbe = true; scene.add(m); return m; };
const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);           // grows up from its foot
const lane = { A: mk(quad, CHALK, 4), B: mk(quad, ANCH, 5), S: mk(quad, CHALK2, 3), C: mk(quad, MARK, 6) };
const bead = { A: mk(new THREE.CircleGeometry(1, 28), CHALK, 7), B: mk(new THREE.CircleGeometry(1, 28), ANCH, 8), S: mk(new THREE.CircleGeometry(1, 28), CHALK2, 7), C: mk(new THREE.CircleGeometry(1, 28), MARK, 9) };
// the ruler: thirty Earths side by side, one ring each
const rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.86, 1, 48), basic(CHALK2, 0.9), WD.n - 1);
rings.frustumCulled = false; rings.renderOrder = 2; rings.userData.noProbe = true;
scene.add(rings);
const ringE = mk(new THREE.CircleGeometry(1, 64), CHALK2, 6), ringM = mk(new THREE.CircleGeometry(1, 64), CHALK, 6);   // the Earth and the Moon, outlined
const mark = mk(new THREE.RingGeometry(0.82, 1, 48), CHALK, 7);                   // the hook's small Moon, "not to scale", on the line above you

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const LANE_X = { A: -1, B: 0, S: 1 };                                             // lane offsets as multiples of `off`
let off = 0;                                                                      // set in seek: metres, scales with the camera's distance
const yA = (t) => lerpKeys(CUE.clockA, t), yB = (t) => lerpKeys(CUE.clockB, t);
function lerpKeys(K, t) {
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * (t - K[i - 1][0]) / Math.max(1e-6, K[i][0] - K[i - 1][0]);
  return K[K.length - 1][1];
}
const YN = WD.years || 8.77, Y8 = 26.31, YS = 140.32;
const frac = { A: (t) => Math.min(1, yA(t) / YN), B: (t) => Math.min(1, yB(t) / Y8), S: (t) => Math.min(1, yB(t) / YS) };
const AN = {
  you: () => [0, WD.fig, 0], earth: () => [WD.rE * 0.0, -WD.rE * 0.6, 0], moon: () => [-WD.rM * 0.0, WD.yMoon + WD.rM * 1.25, 0],
  laneA: () => [LANE_X.A * off, WD.top, 0], laneS: () => [LANE_X.S * off, WD.top * frac.S(window.__t || 0), 0],
  capsule: () => [3 * off, WD.top * 0.55, 0],
};
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, keys: c.keys, ease: "linear", fmt: (v) => String(Math.round(v)), minCh: 3,
    unit: "yr", lit: (v) => v >= c.end - 0.4 });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: AN[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: 0.27 });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "4vmin auto 0" });
const box = endBox(endEl, { t0: FILM.endCard, answer: FILM.spine[FILM.spine.length - 1].terms.find((x) => x[0] === "ans")[1], S1: Math.min(W, H) / 1080 });

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
const place = (m, x, y, sx, sy) => { m.position.set(x, y, 0); m.scale.set(sx, sy, 1); };
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();

window.seek = function (t) {
  window.__t = t;
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  const d = pose.dist;
  camera.near = Math.max(0.05, d / 200); camera.far = Math.max(2000, d * 30); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const space = d > 3e5;
  const px = d * 0.0016;                                                           // a few pixels, at any distance

  // the planets: graticule only where it reads; the desk fades as the paper stops being the world
  earth.set({ opacity: 1, cam: camera.position.toArray(), grid: 1 - seg(Math.log10(d), 3.5, 5.5) });
  moon.set({ opacity: 1, cam: camera.position.toArray(), grid: 1 });
  desk.group.visible = d < 600;
  desk.update({ grid: 1 - seg(Math.log10(d), 1.6, 2.7), pool: [pose.target[0], pose.target[2]], casters: [[0, WD.fig, 0, 0.35]], span: Math.max(800, d * 8) });
  you.group.visible = d < 4e3;

  // the lanes spread as the walk begins, then rest
  const spread = E.inout2(seg(t, CUE.spread[0], CUE.spread[1]));
  off = d * 0.05 * (space ? spread : 0) * (shot === "end" ? 1 - E.inout2(seg(t, FILM.endCard + 0.3, FILM.endCard + 1.6)) : 1);
  const fA = frac.A(t), fB = frac.B(t), fS = frac.S(t);
  const started = seg(t, CUE.clockA[0][0] - 0.05, CUE.clockA[0][0] + 0.3);
  const raceOn = seg(t, CUE.clockB[0][0] - 0.05, CUE.clockB[0][0] + 0.3);
  const top = WD.top, pre = shot === "front" || shot === "pull" || t < CUE.clockA[0][0];
  // before the walk: a single thin line up from you (the road to the Moon), blue, full height
  const hookLine = pre ? 1 : 0;
  const setLane = (k, x, f, w, o) => { const l = lane[k]; l.visible = o > 0.003; l.material.opacity = o; place(l, x, 0, w, Math.max(1e-6, top * f)); };
  setLane("B", LANE_X.B * off, hookLine ? 1 : fB * raceOn + (1 - raceOn) * 0, px * (hookLine ? 0.6 : 1.1), hookLine ? 0.8 : raceOn);
  setLane("A", LANE_X.A * off, fA, px * 0.9, started * (shot === "end" ? gate : 1));
  setLane("S", LANE_X.S * off, fS, px * 0.7, raceOn * (shot === "end" ? gate : 1));
  const bd = (k, x, f, r, o, y0 = 0) => { const b = bead[k]; b.visible = o > 0.003; b.material.opacity = o; b.position.set(x, y0 + (top - y0) * f, 0); b.scale.set(r, r, 1); };
  bd("A", LANE_X.A * off, fA, px * 2.4, started);
  bd("B", LANE_X.B * off, hookLine ? 0 : fB, px * 2.8, raceOn * (hookLine ? 0 : 1));
  bd("S", LANE_X.S * off, fS, px * 2.2, raceOn);
  // the Apollo capsule: a small marker bead up the line in three days, trailing a short streak, beside the others
  const cap = E.inout2(seg(t, CUE.apollo[0], CUE.apollo[1]));
  const capOn = seg(t, CUE.apollo[0] - 0.05, CUE.apollo[0] + 0.2) * (shot === "end" ? gate : 1);
  setLane("C", 3 * off, cap, px * 0.8, capOn);
  bd("C", 3 * off, cap, px * 2.6, capOn);

  // the ruler: thirty Earths, 29 rings between you and the Moon, each appearing in turn
  for (let i = 1; i < WD.n; i++) {
    const on = E.out3(seg(t, CUE.rings[0] + (CUE.rings[1] - CUE.rings[0]) * (i - 1) / (WD.n - 1), CUE.rings[0] + (CUE.rings[1] - CUE.rings[0]) * (i - 1) / (WD.n - 1) + 0.25));
    const out = shot === "end" ? gate : 1;
    const r = WD.rE * on * out;
    S3.set(r, r, 1); P3.set(0, -WD.rE + i * WD.earthKm * 1e3, 0); M.compose(P3, Q, S3); rings.setMatrixAt(i - 1, M);
  }
  rings.instanceMatrix.needsUpdate = true;
  rings.visible = space;
  const pl = seg(Math.log10(d), 5.2, 6.8) * (shot === "end" ? gate : 1);
  ringE.visible = ringM.visible = pl > 0.01; ringE.material.opacity = ringM.material.opacity = 0.9 * pl;
  const rE = Math.max(WD.rE, px * 2.6), rM = Math.max(WD.rM, px * 2.2);
  place(ringE, 0, -rE, rE, rE); place(ringM, 0, WD.yMoon, rM, rM);
  // the hook's small moon on the line above you: fades once the real one is findable
  const mk0 = 1 - E.inout2(seg(Math.log10(d), 1.6, 3.0));
  mark.visible = mk0 > 0.01 && d < 4e3; mark.material.opacity = 0.9 * mk0;
  place(mark, 0, 14 + d * 0.22, 2.0 + d * 0.015, 2.0 + d * 0.015);
  mark.scale.set(2.0 + d * 0.015, 2.0 + d * 0.015, 1); mark.position.set(0, 14 + d * 0.22, 0);

  hud.update(t);
  const tail = E.inout2(seg(t, beat("tease").t1 - 0.6, beat("tease").t1));
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
