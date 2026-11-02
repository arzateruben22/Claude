import * as THREE from "three";
// Outer Layer No. 003 (reboot), "What's in a scar" (films/channels/skincare/ep03). The picture as a pure function of
// t (window.seek). Places (compile.py): the macro terrain with an old scar across it (golden hour, deep tone); the
// dermis in section, its collagen woven over and under (a tug each way), cut, and patched with parallel threads (lit
// cyan) while follicles and glands stay out; a strength meter that stalls near 80%; fetal skin whose cut regrows the
// weave, follicles and all; the gauge (the top layer ≈ a sheet of paper); and the UV camera on the scar's seam.
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { createUVSkin, createViewfinder } from "../set/uvcam.js";
import { createTerrain, goldenHour } from "../set/terrain.js";
import { createWeave } from "../set/weave03.js";
import { toneColor } from "../set/section.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, K = FILM.keys, G = FILM.gauge, PL = FILM.place, FPS = FILM.fps || 30;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 8, threshold: 0.88, bloom: 0.32, exposure: 1.05 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 30000);
injectCss();
const lights = goldenHour(scene);
const FOG = scene.fog; scene.fog = null;
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
const tone = FILM.tone, SKIN = toneColor("living", tone);

// ── the set ─────────────────────────────────────────────────────────────────
const terrain = createTerrain({ seed: 17, spots: 0 }); terrain.group.position.x = PL.tx; scene.add(terrain.group);
const SCAR = [0.5, 1.6];
const EPI = 100;
const mkBlock = (x, scale) => {
  const g = new THREE.Group(); g.position.x = x; g.scale.setScalar(scale);
  const weave = createWeave({ w: 600, h: 260, d: 300, seed: 31 + x });
  weave.group.position.y = -EPI; g.add(weave.group);
  const epiMat = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.94 });
  const epi = new THREE.Mesh(new THREE.BoxGeometry(600, EPI, 300), epiMat); epi.position.y = -EPI / 2; g.add(epi);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(600, 12, 300), new THREE.MeshStandardMaterial({ roughness: 0.8 })); floor.position.y = -EPI - 266; g.add(floor);
  scene.add(g);
  return { g, weave, epiMat, floor };
};
const adult = mkBlock(PL.wx, 1), fetal = mkBlock(PL.fx, 0.85);
const uv = createUVSkin({ seed: 7.0 }); uv.mesh.rotation.x = -0.18; scene.add(uv.mesh);
const rig = createRig(FILM.cam);
const uvAt = (u, v) => { const p = new THREE.Vector3(...uv.at(u, v)); uv.mesh.updateMatrixWorld(); return uv.mesh.localToWorld(p).toArray(); };

// ── the overlay ─────────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
const vf = createViewfinder({ root: hudRoot, W, H, x: 0.1, y: 0.255, w: 0.8, h: 0.29 });
// the strength meter (why): unwounded = 100 %; the scar's bar climbs over weeks and months and stalls near 80 %
const meter = document.createElement("div");
meter.innerHTML = `<div class="mr"><span class="k">unwounded</span><span class="tk"><b style="width:100%"></b></span><span class="v">100%</span></div>
  <div class="mr"><span class="k">scar</span><span class="tk"><b class="s"></b><i></i></span><span class="v sv">0%</span></div><div class="when">weeks … months</div>`;
Object.assign(meter.style, { position: "absolute", left: "50%", top: `${0.27 * H}px`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: "1.2vmin", padding: "1.6vmin 2.8vmin",
  borderRadius: "2.4vmin", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", fontFamily: "var(--font-mono)", fontSize: "2.7vmin", color: "var(--text)", zIndex: 4, opacity: "0", width: "72vmin" });
const css = document.createElement("style");
css.textContent = `.mr{display:flex;align-items:center;gap:2vmin}.mr .k{width:16vmin;color:var(--text-2)}.mr .tk{position:relative;flex:1;height:2.4vmin;border-radius:1vmin;background:rgba(247,243,255,.14)}
.mr .tk b{position:absolute;left:0;top:0;bottom:0;border-radius:1vmin;background:var(--text-2)}.mr .tk b.s{background:var(--water)}.mr .tk i{position:absolute;left:80%;top:-.8vmin;bottom:-.8vmin;border-left:.4vmin dashed var(--text)}
.mr .v{width:10vmin;text-align:right}.when{font-size:2.3vmin;color:var(--text-2);text-align:center}`;
document.head.appendChild(css);
hudRoot.appendChild(meter);
const sBar = meter.querySelector("b.s"), sVal = meter.querySelector(".sv");

const hud = createHud({ camera, shots: FILM.shots });
const KIND = { layer: { color: "ink", glyph: "▬" }, cell: { color: "text", glyph: "●" }, water: { color: "water", glyph: "◇" }, uv: { color: "uv", glyph: "◆" } };
const A = {};
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
  if (c.text.length > 9) el.style.setProperty("--hud-counter-size", `${(10 * 9 / c.text.length).toFixed(2)}vmin`);
}
for (const L of FILM.labels) { const k = KIND[L.kind]; hud.label(L.id, { text: L.text, glyph: k.glyph, mark: "none", color: k.color, at: () => A[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed }); }
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "80vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-14vmin)";
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe });

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  rig.place(camera, shot, t);
  const isA = ["weave", "test", "gauge"].includes(shot);
  terrain.group.visible = shot === "macro"; adult.g.visible = isA; fetal.g.visible = shot === "fetal"; uv.mesh.visible = shot === "uv";
  scene.fog = shot === "macro" ? FOG : null;
  lights.sun.intensity = shot === "macro" ? 4.2 : 2.4; lights.key.intensity = shot === "macro" ? 0.9 : 1.7;
  fstop = shot === "macro" ? 0.45 : 0; focusPt = [PL.tx, 0, 0];

  // ── the macro flight: the scar across the knee ──
  if (shot === "macro") terrain.set({ tone: SKIN.map((v) => v * 1.25), furrows: 0.35, scar: SCAR, scarGlow: 0 });
  A.scar = [PL.tx + 2.5, 0.6, SCAR[0]];

  // ── the adult weave: tugs, the cut, the patch (lit), the strength test ──
  const epiCol = SKIN.map((v) => v * 1.05);
  if (isA) {
    const tug = shot === "weave" ? Math.sin(Math.PI * seg(t, K.tug1[0], K.tug1[1])) * 1 : 0, tug2 = shot === "weave" ? Math.sin(Math.PI * seg(t, K.tug2[0], K.tug2[1])) : 0;
    const stretch = shot === "test" ? Math.sin(Math.PI * Math.min(1, seg(t, K.stretch[0], K.stretch[1]) * 0.5 + (t > K.stretch[1] ? 0.5 : 0))) * 0.6 : 0;
    const cut = shot === "weave" ? E.inout2(seg(t, K.cut[0], K.cut[1])) : 1;
    const patch = shot === "weave" ? E.inout2(seg(t, K.patch[0], K.patch[1])) : 1;
    adult.weave.set({ tone, pull: [tug + stretch, tug2], cut, patch, glow: shot === "weave" ? E.inout2(seg(t, K.glow[0], K.glow[1])) : shot === "test" ? 1 : 0.5,
      dim: shot === "gauge" ? 0.4 * fadeIn(t, SH.gauge, 0.6) : 0 });
    adult.epiMat.color.setRGB(...epiCol); adult.epiMat.opacity = shot === "weave" ? 0.94 * (1 - fadeIn(t, SH.weave + 0.4, 1.2)) + 0.3 : 0.3;
    adult.floor.material.color.setRGB(...toneColor("dermis", tone));
  }
  A.weave = [PL.wx - 170, -170, 160]; A.gap = [PL.wx, -110, 160]; A.app = [PL.wx + 200, -160, 160];

  // ── the strength meter ──
  const mOp = shot === "test" ? fadeIn(t, SH.test + 0.3, 0.5) : 0;
  meter.style.opacity = mOp.toFixed(3); meter.style.visibility = mOp > 0.002 ? "visible" : "hidden";
  const pct = FILM.str.pct * E.out3(seg(t, K.meter[0], K.meter[1]));
  sBar.style.width = `${pct.toFixed(1)}%`; sVal.textContent = `${Math.round(pct)}%`;

  // ── fetal skin: a cut that closes with the weave regrown, follicles and all; after the switch, a patch ──
  if (shot === "fetal") {
    const fcut = E.inout2(seg(t, K.fcut[0], K.fcut[0] + 0.6)), regrow = E.inout2(seg(t, K.regrow[0], K.regrow[1]));
    fetal.weave.set({ tone, cut: fcut, regrow, patch: 0, follicles: 1, glow: 0 });
    fetal.epiMat.color.setRGB(...epiCol.map((v) => Math.min(1, v * 1.1))); fetal.epiMat.opacity = 0.3;
    fetal.floor.material.color.setRGB(...toneColor("dermis", tone));
  }
  A.fgap = [PL.fx, -100, 140];

  // ── the gauge: the top layer ≈ a sheet of paper ──
  const s0 = [PL.wx - 290, 0, 160];
  camera.updateMatrixWorld();
  const p0 = project(camera, [s0[0], 0, s0[2]], W, H), p1 = project(camera, [s0[0], -100, s0[2]], W, H);
  const lift = shot === "gauge" ? E.inout2(seg(t, G.rise[0], G.rise[1])) : 0;
  const gOp = shot === "gauge" ? Math.min(1, Math.max(0, (lift - 0.35) / 0.3)) * (1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: p0.y, bottom: p1.y, um: 100, op: gOp, lift, sc: G.epi_um, paperUm: G.paper_um, scName: "top layer", scText: "≈ 100 µm",
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.9)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  // ── the UV camera on the scar: a seam with no pores and no pattern ──
  if (shot === "uv") uv.set({ damage: 0.35, scar: E.inout2(seg(t, SH.uv, SH.uv + 0.6)), glow: 1, opacity: 1 });
  A.uvscar = uvAt(0.66, 0.5);
  vf.set({ op: shot === "uv" ? fadeIn(t, SH.uv, 0.4) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : 0 });

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
