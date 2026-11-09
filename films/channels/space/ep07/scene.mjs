import * as THREE from "three";
// One More Orbit, Season 2 · Episode 1 (folder ep07), "Trees or stars". The picture as a pure function of t.
//
// Places: two equal clouds ("trees or stars?"); the Milky Way (illustration) with the Sun pin and a dark-matter halo; Earth
// with its forests and a crowd; the two methods side by side (ground plots, a satellite map); the tally (19 × 16 dots, each
// dot = ten billion: 304 trees, 40 star dots) with the stars turning into trees and the trees overflowing; one tree; a light
// ring across the galaxy and across a city block. The end card sits on frame 0's two clouds, so a replay loops.
// Set: ../set (sky, galaxy, planet, beacon, rig, look, motif). Kit: hud, front.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring } from "cinema/sci/front.js";
import { createSky } from "../set/sky.js";
import { createGalaxy, SUN_LY } from "../set/galaxy.js";
import { createPlanet, earthSurface } from "../set/planet.js";
import { createBeacon } from "../set/beacon.js";
import { createRig } from "../set/rig.js";
import { hdr, line } from "../set/look.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30, TL = FILM.tally;
const S1 = Math.min(W, H) / 1080, sx = W / 1080, sy = H / 1920;
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
const EARTH_P = [1000, 0, 0];

// ── the 3-D set: the sky, the Milky Way (1 unit = 1,000 light-years) with the Sun, Earth (not to scale) with its forests ─
const sky = createSky({ stars: 6000, seed: 61 });
scene.add(sky.group);
const galaxy = createGalaxy({ n: 40000, radius: 50, seed: 27, sunAngle: -0.97 });
scene.add(galaxy.group);
galaxy.set({ angle: 0 });
const sunG = createBeacon({ color: pos(hdr("lemon", 1.8)), px: 30, core: 0.5 });
scene.add(sunG.mesh);
const ringG = ring({ color: pos(line("teal", 0.9)), width: 4, opacity: 0 });
scene.add(ringG.mesh);
const gE = new THREE.Group(); gE.position.fromArray(EARTH_P); scene.add(gE);
const ER = 5.5;
const earth = createPlanet({ radius: ER, surface: earthSurface({ width: W >= 1000 ? 2048 : 1024 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.5, segments: 96 });
gE.add(earth.group);
const mul = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// forests: 304 dots (each = ten billion trees) in the forest belts (tropics, temperate, boreal), clumped into "continents"
const NF = TL.trees, fr = mul(5), fp = new Float32Array(NF * 3), fo = new Float32Array(NF);
for (let i = 0; i < NF; ) {
  const u = fr(), lat = (u < 0.5 ? 0 + (fr() + fr() - 1) * 26 : u < 0.72 ? 58 + (fr() + fr() - 1) * 10 : u < 0.9 ? 42 + (fr() + fr() - 1) * 9 : -34 + (fr() + fr() - 1) * 9) * Math.PI / 180;
  const lon = fr() * 6.2832;
  if (Math.sin(lon * 2 + lat * 3) + Math.sin(lon * 3 - 1) * 0.6 < -0.2) continue;                   // ocean gaps
  fp.set([ER * 1.012 * Math.cos(lat) * Math.cos(lon), ER * 1.012 * Math.sin(lat), ER * 1.012 * Math.cos(lat) * Math.sin(lon)], i * 3);
  fo[i] = fr(); i++;
}
const fg = new THREE.BufferGeometry();
fg.setAttribute("position", new THREE.BufferAttribute(fp, 3)); fg.setAttribute("ord", new THREE.BufferAttribute(fo, 1));
const forestMat = new THREE.ShaderMaterial({
  uniforms: { uFill: { value: 0 }, uPx: { value: 9 * S1 }, uOp: { value: 1 } },
  vertexShader: `attribute float ord; uniform float uFill, uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * smoothstep(ord - 0.02, ord + 0.04, uFill); vA = step(ord, uFill); }`,
  fragmentShader: `uniform float uOp; varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0 || vA < 0.5) discard; float a = (1.0 - smoothstep(0.55, 1.0, r2)) * uOp; gl_FragColor = vec4(vec3(0.31, 0.89, 0.78) * a * 1.6, a); }`,
  transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
});
const forest = new THREE.Points(fg, forestMat); forest.frustumCulled = false; gE.add(forest);
const rig = createRig(FILM.cam);

// ── the 2-D picture over the 3-D set (a pure function of t) ───────────────────────────────────────────────────
const tc = document.createElement("canvas");
tc.width = W; tc.height = H;
Object.assign(tc.style, { position: "absolute", left: 0, top: 0, width: `${W}px`, height: `${H}px`, zIndex: 1, pointerEvents: "none" });
document.getElementById("hud").appendChild(tc);
const ctx = tc.getContext("2d");
const TEAL = [79, 227, 198], LEMON = [242, 237, 166], ICE = [143, 208, 255], LILAC = [185, 166, 255], TXT = [238, 240, 255], TXT2 = [169, 176, 217], VOID = [8, 10, 28];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const circ = (x, y, r) => { ctx.beginPath(); ctx.arc(x * sx, y * sy, r * sx, 0, 6.2832); };
const lw = (w) => { ctx.lineWidth = w * S1; };

// the tally: 19 × 16 dots; the 40 dots nearest the centre are the stars (10 solid, 30 hollow: the range)
const GX0 = 100, GX1 = 880, GY0 = 340, GY1 = 1000, PXD = (GX1 - GX0) / TL.cols, PYD = (GY1 - GY0) / TL.rows;
const cell = (i) => [GX0 + ((i % TL.cols) + 0.5) * PXD, GY0 + (((i / TL.cols) | 0) + 0.5) * PYD];
const RANK = (() => { const c0 = [(TL.cols - 1) / 2, (TL.rows - 1) / 2]; const idx = Array.from({ length: TL.trees }, (_, i) => i);
  idx.sort((a, b) => Math.hypot((a % TL.cols) - c0[0], ((a / TL.cols) | 0) - c0[1]) - Math.hypot((b % TL.cols) - c0[0], ((b / TL.cols) | 0) - c0[1]) || a - b);
  const r = new Array(TL.trees); idx.forEach((i, k) => { r[i] = k; }); return r; })();
const NS = TL.stars_hi, NSOLID = TL.stars_lo;                                    // 40 and 10
// the hook's two equal clouds (the same for stars and trees: the answer is not shown)
const cr = mul(33);
const CLOUD = (cx) => Array.from({ length: 64 }, () => { const a = cr() * 6.2832, d = Math.sqrt(cr()) * 175; return { x: cx + Math.cos(a) * d, y: 700 + Math.sin(a) * d * 0.9, ph: cr() * 6.2832 }; });
const CL_T = CLOUD(285), CL_S = CLOUD(795);
const PLOTS = Array.from({ length: 14 }, () => ({ c: Math.floor(cr() * 18), r: Math.floor(cr() * 5), u: cr() }));
const SAT = Array.from({ length: 36 * 11 }, (_, i) => { const x = i % 36, y = (i / 36) | 0; return 0.5 + 0.5 * Math.sin(x * 0.45 + Math.sin(y * 0.7) * 1.6) * Math.cos(y * 0.5 - x * 0.12); });

const pulse = (t) => { let z = 0; for (const tp of CUE.pulses) { const x = t - tp; if (x > 0 && x < 2.2) z += 0.042 * (x < 0.25 ? Math.sin((x / 0.25) * 1.5708) : Math.exp(-(x - 0.25) / 0.55)); } return z; };

function clouds(t, k) {
  if (k <= 0.001) return;
  for (const [pts, col] of [[CL_T, TEAL], [CL_S, LEMON]]) for (const p of pts) {
    circ(p.x + Math.sin(t * 0.9 + p.ph) * 4, p.y + Math.cos(t * 0.7 + p.ph) * 4, 9);
    ctx.fillStyle = rgba(col, 0.85 * k); ctx.fill();
  }
}
function person(x, y, a) {                                                      // a figure: head, body, and a cloud of trees above (illustration)
  ctx.strokeStyle = rgba(TXT, 0.9 * a); ctx.fillStyle = rgba(TXT, 0.9 * a); lw(4);
  circ(x, y - 54, 11); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x * sx, (y - 40) * sy); ctx.lineTo(x * sx, (y + 10) * sy); ctx.moveTo((x - 18) * sx, (y - 28) * sy); ctx.lineTo((x + 18) * sx, (y - 28) * sy);
  ctx.moveTo(x * sx, (y + 10) * sy); ctx.lineTo((x - 14) * sx, (y + 44) * sy); ctx.moveTo(x * sx, (y + 10) * sy); ctx.lineTo((x + 14) * sx, (y + 44) * sy); ctx.stroke();
}
function treeIcon(cx, cy, s, a) {                                              // one tree (a plain icon)
  ctx.strokeStyle = rgba(LILAC, 0.95 * a); lw(14); ctx.beginPath(); ctx.moveTo(cx * sx, (cy + 40 * s) * sy); ctx.lineTo(cx * sx, (cy + 210 * s) * sy); ctx.moveTo(cx * sx, (cy + 150 * s) * sy); ctx.lineTo((cx + 50 * s) * sx, (cy + 100 * s) * sy); ctx.moveTo(cx * sx, (cy + 120 * s) * sy); ctx.lineTo((cx - 46 * s) * sx, (cy + 78 * s) * sy); ctx.stroke();
  for (const [dx, dy, r] of [[0, -70, 78], [-70, -10, 62], [70, -10, 62], [0, 10, 58]]) { circ(cx + dx * s, cy + dy * s, r * s); ctx.fillStyle = rgba(TEAL, 0.62 * a); ctx.fill(); ctx.strokeStyle = rgba(TEAL, 0.95 * a); lw(3.5); ctx.stroke(); }
}

function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const kEnd = fadeIn(t, FILM.endCard - 0.45, 0.45), kLoop = kEnd;               // the end card: frame 0's clouds come back
  const z = 1 + pulse(t), fcy = 0.36 * H;                                       // push-ins on the starred words (about the picture's centre)
  ctx.setTransform(z, 0, 0, z, (W / 2) * (1 - z), fcy * (1 - z));
  // 1. the hook's two clouds (and the loop back)
  clouds(t, Math.max(1 - E.inout3(seg(t, CUE.n - 0.5, CUE.n + 0.2)), kLoop));
  // dips to black hide the cut to Earth
  const dip = Math.max(E.inout3(seg(t, CUE.cut1 - 0.18, CUE.cut1 + 0.02)) * (1 - E.inout3(seg(t, CUE.cut1 + 0.05, CUE.cut1 + 0.3))), 0);
  // 2. the dark-matter halo around the galaxy (the weight is mostly not stars)
  const hK = fadeIn(t, CUE.most + 0.2, 0.8) * (1 - fadeIn(t, CUE.c - 0.6, 0.5));
  if (hK > 0.01) {
    const gcx = 540 * sx, gcy = 0.36 * H, g = ctx.createRadialGradient(gcx, gcy, 60 * sx, gcx, gcy, 420 * sx);
    g.addColorStop(0, rgba(LILAC, 0.0)); g.addColorStop(0.55, rgba(LILAC, 0.16 * hK)); g.addColorStop(1, rgba(LILAC, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.setLineDash([10 * S1, 12 * S1]); ctx.strokeStyle = rgba(LILAC, 0.55 * hK); lw(2.5); circ(540, 691, 400 + 6 * Math.sin(t * 1.4)); ctx.stroke(); ctx.setLineDash([]);
  }
  // a scan across the galaxy while "nobody counted them"
  const sc = seg(t, CUE.nobody, CUE.nobody + 1.8);
  if (sc > 0 && sc < 1) { const x = (90 + 720 * E.inout3(sc)) * sx; ctx.strokeStyle = rgba(TEAL, 0.8 * (1 - 0.0)); lw(3); ctx.beginPath(); ctx.moveTo(x, 330 * sy); ctx.lineTo(x, 1040 * sy); ctx.stroke();
    for (let k = 0; k < 14; k++) { const y = (350 + ((k * 53 + Math.floor(t * 18) * 37) % 680)) * sy; ctx.fillStyle = rgba(LEMON, 0.9); ctx.beginPath(); ctx.arc(x + (k % 2 ? 9 : -9) * sx, y, 3.5 * sx, 0, 6.2832); ctx.fill(); } }
  // 3. the crowd: hundreds of trees for every person alive (Earth steps back)
  const cK = fadeIn(t, CUE.per - 0.1, 0.5) * (1 - fadeIn(t, CUE.why - 0.3, 0.4));
  if (cK > 0.01) for (let k = 0; k < 8; k++) {
    const x = 160 + k * 108, a = cK * fadeIn(t, CUE.per + k * 0.14, 0.4);
    if (a <= 0.01) continue;
    person(x, 925, a);
    const r2 = mul(90 + k);
    for (let j = 0; j < 18; j++) { const ax = x + (r2() - 0.5) * 80, ay = 825 - r2() * 70; circ(ax, ay, 5.2); ctx.fillStyle = rgba(TEAL, 0.9 * a); ctx.fill(); }
  }
  // 4. the two methods, side by side: ground plots, and a satellite map
  const pK = fadeIn(t, CUE.why - 0.05, 0.35) * (1 - fadeIn(t, CUE.est0 + 0.1, 0.4));
  if (pK > 0.01) {
    ctx.fillStyle = rgba(VOID, 0.96 * pK); ctx.fillRect(0, 0, W, H);
    // (a) ground plots: a forest of dots, small squares counted one by one
    ctx.strokeStyle = rgba(TXT2, 0.5 * pK); lw(2); ctx.strokeRect(90 * sx, 330 * sy, 810 * sx, 330 * sy);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 21; c++) { circ(116 + c * 38.5, 392 + r * 36, 6.5); ctx.fillStyle = rgba(TEAL, 0.5 * pK); ctx.fill(); }
    const tp = seg(t, CUE.why, CUE.sat0);
    for (const p of PLOTS) { const on = clamp01((tp * 1.3 - p.u * 0.95) * 6); if (on <= 0.01) continue;
      ctx.strokeStyle = rgba(ICE, 0.95 * on * pK); lw(3); ctx.strokeRect((101 + p.c * 38.5) * sx, (373 + p.r * 36) * sy, 116 * sx, 108 * sy);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { circ(116 + (p.c + c) * 38.5, 392 + (p.r + r) * 36, 7.5); ctx.fillStyle = rgba(LEMON, 0.95 * on * pK); ctx.fill(); } }
    // (b) a satellite map: cells shaded by how dense the trees are, a sweep, a lattice
    const sK = fadeIn(t, CUE.sat0 - 0.1, 0.4) * pK, sw = E.inout3(seg(t, CUE.sat0, CUE.est0 - 0.1));
    ctx.strokeStyle = rgba(TXT2, 0.5 * sK); lw(2); ctx.strokeRect(90 * sx, 720 * sy, 810 * sx, 300 * sy);
    for (let i = 0; i < SAT.length; i++) { const x = i % 36, y = (i / 36) | 0, px = 90 + x * 22.5;
      if (px > 90 + 810 * sw) continue;
      ctx.fillStyle = rgba(TEAL, (0.1 + 0.8 * SAT[i]) * 0.85 * sK); ctx.fillRect((px + 1) * sx, (722 + y * 27) * sy, 20.5 * sx, 25 * sy); }
    ctx.strokeStyle = rgba(TXT, 0.8 * sK * (1 - sw * 0.0)); lw(3); const lx = (90 + 810 * sw) * sx; ctx.beginPath(); ctx.moveTo(lx, 720 * sy); ctx.lineTo(lx, 1020 * sy); ctx.stroke();
  }
  // 5. the tally: stars (lemon) and trees (teal), each dot = ten billion
  const tOn = fadeIn(t, CUE.est0 + 0.5, 0.6) * (1 - fadeIn(t, CUE.rd - 0.3, 0.5));
  if (tOn > 0.01) {
    const flip = (rk) => clamp01((t - CUE.flip0 - (rk / NS) * 1.6) / 0.15);
    const dimK = E.inout3(seg(t, CUE.flip0 - 0.2, CUE.flip0 + 0.4));
    const shrink = 1 - 0.5 * E.inout3(seg(t, CUE.pass - 0.5, CUE.pass + 1.2));        // pull back to one tree
    const base = 0.3 * (1 - 0.6 * dimK), dimTk = 1 - 0.7 * E.inout3(seg(t, CUE.pass - 0.5, CUE.pass + 1.0));
    const cx0 = (GX0 + GX1) / 2, cy0 = (GY0 + GY1) / 2;
    for (let i = 0; i < TL.trees; i++) {
      const rk = RANK[i], isStar = rk < NS;
      const [x0, y0] = cell(i), x = cx0 + (x0 - cx0) * shrink, y = cy0 + (y0 - cy0) * shrink;
      let col, a, r = 12 * shrink + 1 * (1 - shrink);
      if (isStar) {
        const f = flip(rk);
        if (f > 0.5) { col = TEAL; a = 1; r *= 1.12; }
        else if (rk < NSOLID) { col = LEMON; a = 1; }
        else { col = LEMON; a = 0; circ(x, y, r * 0.8); ctx.strokeStyle = rgba(LEMON, (0.75 + 0.2 * Math.sin(t * 3 + rk)) * tOn * dimTk); lw(2.4); ctx.stroke(); continue; }
      } else {
        const fl = E.out3(seg(t, CUE.over + ((rk - NS) / (TL.trees - NS)) * 2.3, CUE.over + ((rk - NS) / (TL.trees - NS)) * 2.3 + 0.5));
        a = base + (1 - base) * fl; col = TEAL;
        if (t > CUE.est0 && t < CUE.flip0 - 1.2 && rk > TL.trees - 34) a = base * (0.6 + 0.4 * Math.sin(t * 5 + rk));   // the edge flickers: "about"
      }
      circ(x, y, r); ctx.fillStyle = rgba(col, a * tOn * dimTk); ctx.fill();
    }
  }
  // 6. one tree
  const oK = fadeIn(t, CUE.pass - 0.3, 0.7) * (1 - fadeIn(t, CUE.rd - 0.3, 0.5));
  if (oK > 0.01) treeIcon(540, 640, 1.0, oK);
  // 7. a city block: light crosses it (not to scale)
  const bK = fadeIn(t, CUE.blk - 0.3, 0.4) * (1 - kEnd);
  if (bK > 0.01) {
    ctx.fillStyle = rgba(VOID, 0.55 * bK); ctx.fillRect(90 * sx, 770 * sy, 810 * sx, 230 * sy);
    for (let b = 0; b < 4; b++) { ctx.fillStyle = rgba(TXT2, 0.18 * bK); ctx.fillRect((130 + b * 190) * sx, 800 * sy, 150 * sx, 170 * sy); ctx.strokeStyle = rgba(TXT2, 0.55 * bK); lw(2); ctx.strokeRect((130 + b * 190) * sx, 800 * sy, 150 * sx, 170 * sy); }
    const u = E.out3(seg(t, CUE.blk, CUE.blk + 1.1));
    if (u > 0.002) { circ(205, 885, 6); ctx.fillStyle = rgba(TEAL, bK); ctx.fill(); circ(205, 885, 6 + 150 * u); ctx.strokeStyle = rgba(TEAL, 0.9 * bK * (1 - 0.5 * u)); lw(4); ctx.stroke(); }
  }
  // dip to black (the cut to Earth)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (dip > 0.001) { ctx.fillStyle = rgba(VOID, dip); ctx.fillRect(0, 0, W, H); }
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = {};
const KIND = { star: { color: "lemon", glyph: "✦", mark: "none" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true, value: () => 0, fmt: () => c.text });
  el.classList.add(c.read ? "lm-read" : "lm-clock");
  const lb = el.querySelector(".lb");
  if (lb) lb.style.textShadow = "0 0 1.2vmin rgba(8,10,28,.95), 0 0 2.6vmin rgba(8,10,28,.85)";
  const v = el.querySelector(".v");
  if (v && c.text.length > 12) v.style.fontSize = c.read ? "4.2vmin" : "5.5vmin";
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
const fo2 = endEl.querySelector(".fo");
if (fo2) fo2.style.marginTop = "1.8vmin";
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });

window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  rig.place(camera, shot, t);
  const kEnd = fadeIn(t, FILM.endCard - 0.45, 0.45);
  // which places are drawn: the galaxy (normal, then from the cut back through the end), Earth (change, why), neither in the hook
  const galOn = (t >= CUE.n - 0.3 && t < CUE.cut1) || t >= CUE.cut2;
  const earthOn = t >= CUE.cut1 && t < CUE.cut2;
  galaxy.group.visible = galOn; sunG.mesh.visible = galOn; gE.visible = earthOn;
  const gGain = (t < CUE.cut1 ? fadeIn(t, CUE.n - 0.3, 0.7) : 0.0) + (t >= CUE.cut2 ? 0.75 * fadeIn(t, CUE.cut2, 0.5) : 0) ;
  const tallyDim = t >= CUE.est0 ? 1 - 0.35 * fadeIn(t, CUE.flip0, 0.5) : 1;
  const readK = fadeIn(t, CUE.rd - 0.3, 0.5);
  galaxy.set({ angle: -0.003 * t, gain: Math.max(0.0, (t < CUE.cut1 ? 1.1 * gGain : Math.max(0.55 * gGain * tallyDim, 1.1 * readK))) * (1 - 0.9 * kEnd) });
  const sp = galaxy.sunAt();
  sunG.set({ center: sp, camera, opacity: (1 - kEnd) * (galOn ? 1 : 0) * (1 - 0.85 * fadeIn(t, CUE.est0 + 0.5, 0.6) * (1 - readK)) });
  S.sun = sp;
  const u1 = seg(t, CUE.ring0, CUE.ring1 - 0.2);
  ringG.arc({ center: sp, r: Math.max(0.01, 100 * u1), ...XZ }).set({ opacity: galOn && u1 > 0.002 && u1 < 0.999 ? (1 - 0.6 * u1) * (1 - kEnd) : 0 });
  // Earth: it turns slowly; the forests arrive dot by dot on "three trillion"
  const psi = 1.2 + 0.05 * (t - CUE.cut1);
  earth.set({ center: [0, 0, 0], sunDir: [0.52, 0.2, 0.83], sun: 1, rimNight: 0.5, spin: psi });
  forest.rotation.y = -psi;
  forestMat.uniforms.uFill.value = clamp01((t - CUE.fill0) / (CUE.fill1 - CUE.fill0)) * 1.05;
  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 0.35, bandGain: 0.6 });
  draw(t);
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
