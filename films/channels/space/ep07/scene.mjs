import * as THREE from "three";
// One More Orbit No. 007, "Trees or stars" (films/channels/space/ep07). The picture as a pure function of t.
//
// One camera on the Milky Way (illustration), one flat TALLY drawn over it: 80 × 38 dots, each dot one billion. The first 400
// cells are the galaxy's stars (100 solid, 300 hollow: the range 100 to 400 billion); all 3,040 are Earth's trees (3.04
// trillion). On "every star into a tree" the 400 star dots turn teal one by one, and the trees keep going. The readout
// sends a light ring across the galaxy and a tiny one across "a city block".
// Set: ../set (sky, galaxy, beacon, rig, look, motif). Kit: hud, front.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring } from "cinema/sci/front.js";
import { createSky } from "../set/sky.js";
import { createGalaxy, SUN_LY } from "../set/galaxy.js";
import { createBeacon } from "../set/beacon.js";
import { createRig } from "../set/rig.js";
import { hdr, line } from "../set/look.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30, TL = FILM.tally;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.5, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const pos = (c) => c.map((v) => Math.max(0, v));
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };

// ── the set: the Milky Way (illustration, 1 unit = 1,000 light-years), the Sun, two light rings ─────────────
const sky = createSky({ stars: 6000, seed: 61 });
scene.add(sky.group);
const galaxy = createGalaxy({ n: 40000, radius: 50, seed: 27, sunAngle: -0.97 });
scene.add(galaxy.group);
galaxy.set({ angle: 0 });
const SUN = galaxy.sunAt();
const sunG = createBeacon({ color: pos(hdr("lemon", 1.8)), px: 30, core: 0.5 });
scene.add(sunG.mesh);
const ringG = ring({ color: pos(line("teal", 0.9)), width: 4, opacity: 0 });        // light crossing the galaxy: 100 units = 100,000 ly
const ringB = ring({ color: pos(line("teal", 0.95)), width: 3, opacity: 0 });       // a city block (not to scale: it needs to be seen)
scene.add(ringG.mesh, ringB.mesh);
const rig = createRig(FILM.cam);

// ── the tally: a 2-D canvas over the 3-D scene (a pure function of t) ─────────────────────────────────────────
const tc = document.createElement("canvas");
tc.width = W; tc.height = H;
Object.assign(tc.style, { position: "absolute", left: 0, top: 0, width: `${W}px`, height: `${H}px`, zIndex: 1, pointerEvents: "none" });
document.getElementById("hud").appendChild(tc);
const ctx = tc.getContext("2d");
const GX0 = 90, GX1 = 900, GY0 = 540, GY1 = 924;                                 // the tally's box in 1080 × 1920 units (the safe box)
const PX = (GX1 - GX0) / TL.cols, PY = (GY1 - GY0) / TL.rows;
const TEAL = [79, 227, 198], LEMON = [242, 237, 166], ICE = [143, 208, 255], TXT2 = [169, 176, 217];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
// seeded scatter for the ground plots (a small mulberry32, so any frame can be sought alone)
const mul = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const PLOTS = (() => { const r = mul(7), p = []; for (let k = 0; k < 42; k++) p.push({ c: Math.floor(r() * (TL.cols - 3)), r: Math.floor(r() * (TL.rows - 3)), u: r() }); return p; })();

// per-cell state: colour and alpha as functions of t
// "Nobody counted them": a bright cursor sweeps the star cells and stutters (counting is not what this is)
const scanPos = (t) => TL.stars_hi * E.inout3(seg(t, CUE.nobody, CUE.nobody + 1.9));
const scanHit = (i, t) => t >= CUE.nobody && t <= CUE.nobody + 2.4 && Math.abs(i - scanPos(t)) < 9 + 6 * Math.sin(t * 23) ** 2 * (t < CUE.nobody + 1.9 ? 1 : 0);
const T = { n: CUE.n, c: CUE.c, why: CUE.why, w: CUE.w, tk: CUE.tk, rd: CUE.rd };
function drawTally(t) {
  ctx.clearRect(0, 0, W, H);
  const kIn = 1;                                                                    // frame 0 is the payoff: the tally is already there
  const kOut = 1 - fadeIn(t, CUE.rd - 0.3, 0.5) * 1;                              // gone for the readout
  if (kIn * kOut <= 0.001 || t >= CUE.end - 0.45) return;
  const fillK = (i) => clamp01((t - CUE.fill0 - (i / TL.trees) * (CUE.fill1 - CUE.fill0)) / 0.25);   // trees arrive row by row on "three trillion"
  const flipK = (i) => clamp01((t - CUE.flip0 - (i / TL.stars_hi) * (CUE.flip1 - CUE.flip0)) / 0.2);   // each star turns into a tree
  const overK = E.out3(seg(t, CUE.over, CUE.over + 1.2));
  const hookK = 1 - E.inout3(seg(t, T.n - 0.4, T.n + 0.3));                       // the hook shows the payoff: the tally already overflowing
  const dim = 1 - 0.45 * fadeIn(t, T.tk, 0.6);                                     // takeaway: a little quieter
  const r = 3.3 * S1 * (W / 1080) / (W / 1080);                                    // dot radius in px
  for (let i = 0; i < TL.trees; i++) {
    const col = i % TL.cols, row = (i / TL.cols) | 0;
    const x = (GX0 + (col + 0.5) * PX) * (W / 1080), y = (GY0 + (row + 0.5) * PY) * (H / 1920);
    const isStar = i < TL.stars_hi, solid = i < TL.stars_lo;
    let c, a;
    // trees (teal): the hook's payoff, then off while the stars have the stage, filling on "three trillion", dimmed while the
    // stars turn into trees (so the swap reads), then surging past them on "the forests keep going"
    const dimK = E.inout3(seg(t, CUE.flip0 - 0.2, CUE.flip0 + 0.4)), upK = E.out3(seg(t, CUE.over, CUE.over + 0.9));
    const treeA = t < CUE.fill0 ? 0.55 * hookK : fillK(i) * (0.9 - 0.62 * dimK + 0.72 * upK);
    let rr = r;
    if (isStar) {
      const f = flipK(i);
      if (f > 0.5) { c = TEAL; a = 1; rr = r * 1.3; }                                // a star turned into a tree
      else if (solid) { c = LEMON; a = 1; }
      else {                                                                         // hollow dots: the range, "100 to 400 billion"
        ctx.strokeStyle = rgba(LEMON, 0.8 * kOut * dim); ctx.lineWidth = 1.3 * S1 * (W / 1080);
        ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, 6.2832); ctx.stroke();
        if (!scanHit(i, t)) continue; c = LEMON; a = 1;
      }
      if (solid && scanHit(i, t)) rr = r * 1.7;
      if (!(solid || scanHit(i, t) || f > 0.5)) continue;
    } else { c = TEAL; a = treeA; }
    if (a <= 0.01) continue;
    ctx.fillStyle = rgba(c, a * kIn * kOut * dim);
    ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.fill();
  }
  // the methods (why): ground plots flash as small squares, then a satellite lattice sweeps across
  const tPlots = seg(t, CUE.plots0, CUE.sat0), tSat = seg(t, CUE.sat0, CUE.est0);
  if (t >= CUE.plots0 && t < CUE.est0 + 0.4) {
    ctx.lineWidth = 1.6 * S1 * (W / 1080);
    for (const p of PLOTS) {
      const on = clamp01((tPlots * 1.2 - p.u * 0.9) * 6) * (1 - E.in3(seg(t, CUE.sat0 - 0.4, CUE.sat0)));
      if (on <= 0.01) continue;
      ctx.strokeStyle = rgba(ICE, 0.9 * on * kOut);
      ctx.strokeRect((GX0 + p.c * PX) * (W / 1080), (GY0 + p.r * PY) * (H / 1920), 3 * PX * (W / 1080), 3 * PY * (H / 1920));
    }
    if (tSat > 0) {
      const sweep = E.inout3(tSat), xmax = GX0 + (GX1 - GX0) * sweep, fade = 1 - E.in3(seg(t, CUE.est0 - 0.3, CUE.est0 + 0.3));
      ctx.strokeStyle = rgba(TXT2, 0.55 * fade * kOut); ctx.lineWidth = 1.2 * S1 * (W / 1080);
      ctx.beginPath();
      for (let cx = 0; cx <= TL.cols; cx += 8) { const xx = GX0 + cx * PX; if (xx > xmax) break; ctx.moveTo(xx * (W / 1080), GY0 * (H / 1920)); ctx.lineTo(xx * (W / 1080), GY1 * (H / 1920)); }
      for (let rw = 0; rw <= TL.rows; rw += 7) { const yy = GY0 + rw * PY; ctx.moveTo(GX0 * (W / 1080), yy * (H / 1920)); ctx.lineTo(xmax * (W / 1080), yy * (H / 1920)); }
      ctx.stroke();
    }
  }
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = {};
const KIND = { body: { color: "ice", glyph: "●", mark: "none" }, star: { color: "lemon", glyph: "✦", mark: "none" },
  light: { color: "teal", glyph: "◯", mark: "none" }, gravity: { color: "lilac", mark: "dashed" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true, value: () => 0, fmt: () => c.text };
  const el = hud.counter(c.id, o);
  el.classList.add(c.read ? "lm-read" : "lm-clock");
  const lb = el.querySelector(".lb");
  if (lb) lb.style.textShadow = "0 0 1.2vmin rgba(8,10,28,.95), 0 0 2.6vmin rgba(8,10,28,.85)";
  const v = el.querySelector(".v");
  if (v && c.text.length > 12) v.style.fontSize = c.read ? "4.2vmin" : "5.5vmin";                      // "100 to 400 billion", "1 millionth of a second"
  else if (v && c.text.length > 10 && !c.read) v.style.fontSize = "8.5vmin";
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed });
}
for (const p of FILM.pills || []) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0", textWrap: "balance" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";
const fo = endEl.querySelector(".fo");
if (fo) fo.style.marginTop = "1.8vmin";
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });

const SUN_R = SUN_LY / 1000;
window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  rig.place(camera, shot, t);
  // the galaxy turns slowly (arms trail); it is dimmed while the tally has the stage and comes back for the readout
  const tallyOn = fadeIn(t, 0, 0.5) * (1 - fadeIn(t, CUE.rd - 0.3, 0.5));
  const gain = 1.1 - 0.7 * tallyOn * (t < CUE.n - 0.4 || t > CUE.c ? 1 : 0.0) - 0.15 * tallyOn * (t >= CUE.n - 0.4 && t <= CUE.c ? 1 : 0);
  galaxy.set({ angle: -0.003 * t, gain: Math.max(0.3, gain) * (1 - 0.3 * fadeIn(t, FILM.endCard - 0.45, 0.45)) });
  const sp = galaxy.sunAt();
  const kEnd = fadeIn(t, FILM.endCard - 0.45, 0.45);
  sunG.set({ center: sp, camera, opacity: (1 - kEnd) * (0.5 + 0.5 * (t >= CUE.ring0 ? 1 : 0)) });
  S.sun = sp;
  // the readout: light crosses the galaxy (100,000 light-years in 3 s), then a tiny ring across "a city block" (not to scale)
  const u1 = seg(t, CUE.ring0, CUE.ring1 - 0.2), uB = seg(t, CUE.blk - 0.3, CUE.blk + 1.0);
  ringG.arc({ center: sp, r: Math.max(0.01, 100 * u1), ...XZ }).set({ opacity: u1 > 0.002 && u1 < 0.999 ? (1 - 0.6 * u1) * (1 - kEnd) : 0 });
  ringB.arc({ center: sp, r: Math.max(0.01, 0.6 + 2.4 * E.out3(uB)), ...XZ }).set({ opacity: uB > 0.002 && uB < 0.999 ? (1 - E.in3(uB)) * (1 - kEnd) : 0 });
  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 0.35, bandGain: 0.6 });
  drawTally(t);
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
