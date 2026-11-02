import * as THREE from "three";
// Outer Layer No. 001 (reboot), "The fight you never saw" (films/channels/skincare/ep01). The picture as a pure
// function of t: window.seek(t) sets the shot, the camera, every object and the overlay, then renders once.
//
// Three places (compile.py): the UV cheek in the viewfinder (the signature reveal: the spot ringed in cyan, follicle
// bacteria glowing orange-red, a stack of photos flipping back in time), the macro terrain (a golden-hour glide down
// into one pore), and two follicles in section (immune cells ringing one, the same bacterium in both, white cells
// flooding in, the wall giving way, a squeeze driving the spill deeper). Then the gauge, and back to the UV cheek.
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, injectCss } from "../set/motif.js";
import { createUVSkin, createViewfinder, createDaylight } from "../set/uvcam.js";
import { createTerrain, goldenHour } from "../set/terrain.js";
import { createAcneFollicle } from "../set/acne01.js";
import { toneColor } from "../set/section.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, K = FILM.keys, G = FILM.gauge, PL = FILM.place, FPS = FILM.fps || 30;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
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

// ── the set ─────────────────────────────────────────────────────────────────
const uv = createUVSkin({ seed: 3.0 }); uv.mesh.rotation.x = -0.18; scene.add(uv.mesh);
const SPOT = [0.6, 0.45, 0.055];
const terrain = createTerrain({ seed: 9, spots: 0 }); terrain.group.position.x = PL.tx; scene.add(terrain.group);
const F = createAcneFollicle({ x: PL.fx, seed: 21, width: 1000, depth: 2300 }), Gf = createAcneFollicle({ x: PL.gx, seed: 22, width: 1000, depth: 2300 });
Gf.group.position.z = -2;   // set back a hair: where the blocks overlap, the near one's face wins (no seam)
scene.add(F.group, Gf.group);
const rig = createRig(FILM.cam);
const uvAt = (u, v) => { const p = new THREE.Vector3(...uv.at(u, v)); uv.mesh.updateMatrixWorld(); return uv.mesh.localToWorld(p).toArray(); };

// ── the overlay ─────────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
const VF = { x: 0.1, y: 0.285, w: 0.8, h: 0.3 };
const vf = createViewfinder({ root: hudRoot, W, H, ...VF });
vf.el.style.setProperty("--ol-rec-size", "3.3vmin"); vf.el.style.setProperty("--ol-rec-weight", "600");
const day = createDaylight({ root: hudRoot, W, H, y: 0.705, label: "daylight" }); day.el.style.fontSize = "3.1vmin";
// the photo stack (normal): earlier photos of the same patch pile up behind the viewfinder, each with its date
const stackRoot = document.createElement("div");
Object.assign(stackRoot.style, { position: "absolute", left: `${(VF.x + 0.03) * W}px`, top: `${(VF.y + 0.02) * H}px`, width: `${(VF.w - 0.06) * W}px`, height: `${(VF.h - 0.04) * H}px`, zIndex: 1, pointerEvents: "none" });
const frames = FILM.flips.map((_, i) => { const d = document.createElement("div"); Object.assign(d.style, { position: "absolute", inset: "0", border: `${0.35 * 10.8 * S1}px solid var(--uv)`, borderRadius: "1vmin", opacity: "0", transform: `translate(${(i + 1) * 0.7}vmin, ${-(i + 1) * 0.7}vmin)` }); stackRoot.appendChild(d); return d; });
const stamp = document.createElement("div");
Object.assign(stamp.style, { position: "absolute", left: "4vmin", top: "1.6vmin", fontFamily: "var(--font-mono)", fontSize: "3vmin", fontWeight: "600", color: "var(--text)", letterSpacing: ".06em", background: "var(--hud-plate)", padding: ".6vmin 1.6vmin", borderRadius: "1.4vmin" });
stackRoot.appendChild(stamp);
const flash = document.createElement("div");
Object.assign(flash.style, { position: "absolute", inset: "0", background: "#F7F3FF", opacity: "0", borderRadius: "1vmin" });
stackRoot.appendChild(flash);
hudRoot.appendChild(stackRoot);
// the dip: the push into the spot (and back out of it) passes through the theme's violet for a few frames
const dip = document.createElement("div");
Object.assign(dip.style, { position: "absolute", inset: "0", background: "var(--bg, #2C1660)", opacity: "0", zIndex: 1, pointerEvents: "none" });
hudRoot.appendChild(dip);

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
if (foot) Object.assign(foot.style, { fontSize: "3.5vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "80vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-14vmin)";
const gauge = createCellGauge();

// the to-scale card (No. 001's own): 100 µm = GH px. One cell drops in on "pus", is named on "small"; on "ten" nine more
// stack on it (10 × 8 µm = 80 µm); on "paper's" the paper's 100 µm draws beside them.
function createCellGauge() {
  const NS = "http://www.w3.org/2000/svg", mk = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const svg = mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` }); Object.assign(svg.style, { position: "absolute", left: 0, top: 0, zIndex: 2, pointerEvents: "none" });
  hudRoot.appendChild(svg);
  const cx = 0.1 * W, cw = 0.8 * W, cy = 0.19 * H, ch = 0.44 * H, GH = 0.28 * H, base = cy + ch - 0.06 * H, um = GH / G.paper_um;
  const g = mk("g", {}, svg);
  mk("rect", { x: cx, y: cy, width: cw, height: ch, rx: 24 * S1, fill: "var(--card)", opacity: 0.97 }, g);
  const head = mk("text", { x: cx + 40 * S1, y: cy + 62 * S1, "font-size": 34 * S1, fill: "var(--text-2)", "font-family": "var(--font-mono)", "letter-spacing": "0.12em" }, g); head.textContent = "TO SCALE";
  const colX = cx + 0.5 * cw, papX = cx + 0.68 * cw, r = (G.cell_um / 2) * um;
  mk("line", { x1: cx + 40 * S1, x2: cx + cw - 40 * S1, y1: base, y2: base, stroke: "var(--text-2)", "stroke-width": 2 * S1 }, g);
  const cells = Array.from({ length: G.n }, (_, i) => mk("circle", { cx: colX, cy: base - r - 2 * r * i, r: r * 0.96, fill: "var(--water)", stroke: "var(--slide-low)", "stroke-width": 2 * S1 }, g));
  const PW = 0.14 * cw;
  mk("rect", { x: papX, y: base - GH, width: PW, height: GH, rx: 4 * S1, fill: "none", stroke: "var(--text-2)", "stroke-width": 2.5 * S1, "stroke-dasharray": `${10 * S1} ${8 * S1}` }, g);   // the paper's outline waits from the start
  const paper = mk("rect", { x: papX, width: PW, rx: 4 * S1, fill: "var(--text)", opacity: 0.92 }, g);
  const T = (x, y, size, fill, anchor = "start", w = 500) => mk("text", { x, y, "font-size": size * S1, fill, "font-family": "var(--font-text)", "font-weight": w, "text-anchor": anchor, "dominant-baseline": "middle" }, g);
  const cName = T(colX - r - 26 * S1, base - r, 46, "var(--text)", "end", 600), cVal = T(colX - r - 26 * S1, base - r + 54 * S1, 42, "var(--water)", "end", 600);
  cName.textContent = "white cell"; cVal.textContent = "≈ 8 µm";
  const tenTxt = T(colX - r - 26 * S1, base - GH * 0.8 + 10 * S1, 44, "var(--water)", "end", 600); tenTxt.textContent = "10 cells ≈ 80 µm";
  const pName = T(papX + PW / 2, base - GH - 92 * S1, 46, "var(--text)", "middle", 600), pVal = T(papX + PW / 2, base - GH - 40 * S1, 42, "var(--text-2)", "middle", 600);
  pName.textContent = "paper"; pVal.textContent = "≈ 100 µm";
  return {
    update(t, op, lift) {
      svg.style.opacity = op.toFixed(3); svg.style.visibility = op > 0.002 ? "visible" : "hidden"; if (op <= 0.002) return;
      g.setAttribute("transform", `translate(0 ${((1 - lift) * 0.04 * H).toFixed(1)})`);
      const one = E.out3(seg(t, G.pus, G.pus + 0.5)), name = E.out3(seg(t, G.sc, G.sc + 0.4));
      cells.forEach((c, i) => { const a = i === 0 ? one : E.out3(seg(t, G.ten[0] + (i - 1) * (G.ten[1] - G.ten[0]) / (G.n - 1), G.ten[0] + i * (G.ten[1] - G.ten[0]) / (G.n - 1))); c.setAttribute("opacity", a.toFixed(3)); c.setAttribute("transform", `translate(0 ${((i === 0 ? 1 : -1) * (1 - a) * (i === 0 ? 0.12 * H : 40 * S1)).toFixed(1)})`); });   // the first rises out of the spill below
      cName.setAttribute("opacity", name.toFixed(3)); cVal.setAttribute("opacity", name.toFixed(3));
      tenTxt.setAttribute("opacity", E.out3(seg(t, G.ten[1] - 0.3, G.ten[1] + 0.2)).toFixed(3));
      const pp = E.inout2(seg(t, G.paper, G.paper + 0.9)), ph = GH * pp;
      paper.setAttribute("y", (base - ph).toFixed(1)); paper.setAttribute("height", ph.toFixed(1));
      pName.setAttribute("opacity", E.out3(seg(t, G.paper + 0.6, G.paper + 1.0)).toFixed(3)); pVal.setAttribute("opacity", E.out3(seg(t, G.paper + 0.6, G.paper + 1.0)).toFixed(3));
    },
  };
}

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name, tone = FILM.tone;
  rig.place(camera, shot, t);
  const isUV = shot === "uv" || shot === "uv2", isF = ["follicle", "pair", "rupture", "gauge"].includes(shot);
  uv.mesh.visible = isUV; terrain.group.visible = shot === "flight"; F.group.visible = isF; Gf.group.visible = shot === "pair";
  scene.fog = shot === "flight" ? FOG : null;
  lights.sun.intensity = shot === "flight" ? 4.2 : 2.2; lights.key.intensity = shot === "flight" ? 0.9 : 1.6;
  fstop = shot === "flight" ? 0.5 : 0; focusPt = shot === "flight" ? [PL.tx + 1.5, 0, 1] : [0, 0, 0];

  // ── the UV cheek: the spot ringed in cyan; the follicle bacteria glow orange-red; the photos flip back in time ──
  if (isUV) {
    const porph = shot === "uv" ? E.inout2(seg(t, K.porph[0], K.porph[1])) * (1 - fadeIn(t, SH.flight - 0.8, 0.6)) : 0.55;
    const spot = shot === "uv" ? 1 - E.inout2(seg(t, K.spotGone[0], K.spotGone[1])) : 1;
    const rings = shot === "uv2" ? E.inout2(seg(t, K.rings[0], K.rings[1])) : 0;
    uv.set({ focus: [...SPOT, spot], spot, porph, rings: 1.1 * rings, ringR: 0.2, glow: 1, opacity: 1, bump: 0.22, spotRed: 1 });
  }
  A.spot = uvAt(SPOT[0], SPOT[1] + 0.05); A.porph = uvAt(0.3, 0.38); A.rings = uvAt(0.36, 0.44);
  const vfOp = isUV ? (shot === "uv" ? 1 - fadeIn(t, SH.flight - 0.4, 0.35) : fadeIn(t, SH.uv2, 0.4)) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : 0;
  vf.set({ op: vfOp, blink: 1 });
  const dz = (c) => Math.max(0, 1 - Math.abs(t - c) / 0.22);
  dip.style.opacity = Math.max(dz(SH.flight), dz(SH.uv2)).toFixed(3);
  day.set({ op: shot === "uv2" ? fadeIn(t, K.rings[0], 0.6) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : 0 });
  // the stack: one frame per flip, the date stamped, a shutter flash
  let nFlip = 0; for (const ft of FILM.flips) if (t >= ft) nFlip++;
  const stackOn = shot === "uv" && t >= FILM.flips[0] - 0.1 ? 1 - fadeIn(t, CUE.underneath - 0.2, 0.5) : 0;
  frames.forEach((d, i) => { d.style.opacity = (stackOn * (i < nFlip ? 0.75 : 0)).toFixed(3); });
  stamp.textContent = nFlip ? `EARLIER PHOTO  ${nFlip} / ${FILM.flips.length}` : "";; stamp.style.opacity = stackOn.toFixed(3); stamp.style.visibility = stackOn > 0.002 ? "visible" : "hidden";   // no interval implied
  let fl = 0; for (const ft of FILM.flips) fl = Math.max(fl, Math.max(0, 1 - Math.abs(t - ft) / 0.08) * (t >= ft ? 1 : 0));
  flash.style.opacity = (0.35 * fl * stackOn).toFixed(3);

  // ── the macro flight ──
  if (shot === "flight") terrain.set({ tone: toneColor("living", tone).map((v) => v * 1.12), furrows: 0.25, spot: 0, sheen: 0 });

  // ── the follicles ──
  if (isF) {
    let p = { tone, bact: 0, ring: 0, ringLit: 0, flood: 0, rupt: 0, press: 0, red: 0, dim: 0 };
    // the ring is there from the cut ("already there"), lit on "already", fuller on "crowding"; the bacterium waits for "why"
    if (shot === "follicle") p = { ...p, ring: 0.6 + 0.4 * E.inout2(seg(t, K.ring[0], K.ring[1])), ringLit: 0.7 * E.inout2(seg(t, K.ringLit[0], K.ringLit[1])), bact: 0 };
    if (shot === "pair") p = { ...p, ring: 1, ringLit: 0.25 + 0.75 * E.inout2(seg(t, K.answer[0], K.answer[1])), bact: E.inout2(seg(t, K.bact[0], K.bact[1])) };
    if (shot === "rupture" || shot === "gauge") {
      const rupt = E.inout2(seg(t, K.rupt[0], K.rupt[1])), press = E.inout2(seg(t, K.press[0], K.press[1]));
      p = { ...p, ring: 1, ringLit: 1, bact: 0.6, flood: E.inout2(seg(t, K.flood[0], K.flood[1])), rupt, press, red: Math.min(1, 0.35 * rupt + 0.8 * press), dim: shot === "gauge" ? 0.5 * fadeIn(t, SH.gauge, 0.8) : 0,
        thumb: shot === "gauge" ? 0 : 1 - E.inout2(seg(t, K.lift[0], K.lift[1])), mark: E.inout2(seg(t, K.mark[0], K.mark[1])) };
    }
    F.set(p);
    Gf.set({ tone, ring: 0, bact: p.bact, ringLit: 0 });
  }
  A.fWith = [PL.fx, 40, 40]; A.fWo = [PL.gx, 40, 40];
  A.ring = F.at.ring(); A.bactG = Gf.at.bact(); A.cell = F.at.cell(); A.spill = F.at.spill(); A.thumb = [PL.fx + 160, 120, 120];

  // ── the gauge: a centred card, to scale: white cells (8 µm) beside the paper (100 µm) ──
  const lift = shot === "gauge" ? E.inout2(seg(t, G.rise[0], G.rise[1])) : 0;
  const gOp = shot === "gauge" ? lift * (1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, gOp, lift);
  F.group.visible = F.group.visible && !(shot === "gauge" && lift > 0.98);   // the follicle stays behind the card only while it rises and goes

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
