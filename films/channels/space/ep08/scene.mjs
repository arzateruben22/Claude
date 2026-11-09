import * as THREE from "three";
// One More Orbit No. 008, "Dark sky" (films/channels/space/ep08). The picture as a pure function of t.
//
// One flat picture drawn over the channel's night sky: a top-down DISTANCE MAP (you in the middle, stars at their distances,
// equal density) and a strip above it: "the night sky" as you would see it. Far stars are fainter but more numerous, so each
// ring of distance adds the same light and the strip climbs to white (an endless, eternal universe). Light needs time: a
// horizon (the universe's age) closes in, the stars beyond it have not arrived, and the strip falls back to dark. The readout
// sends light 8 minutes (the Sun) and then "billions of years" (the farthest galaxies).
// Set: ../set (sky, rig, look, motif). Kit: hud.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createSky } from "../set/sky.js";
import { createRig } from "../set/rig.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30;
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
const sky = createSky({ stars: 6000, seed: 81 });
scene.add(sky.group);
const rig = createRig(FILM.cam);

// ── the picture (a 2-D canvas over the 3-D sky; a pure function of t) ──────────────────────────────
const tc = document.createElement("canvas");
tc.width = W; tc.height = H;
Object.assign(tc.style, { position: "absolute", left: 0, top: 0, width: `${W}px`, height: `${H}px`, zIndex: 1, pointerEvents: "none" });
document.getElementById("hud").appendChild(tc);
const ctx = tc.getContext("2d");
const CX = 540, CY = 752, R = 262;                                           // the distance map (1080 × 1920 units)
const SX0 = 90, SX1 = 900, SY0 = 400, SY1 = 480;                              // the night-sky strip
const TEAL = [79, 227, 198], LEMON = [242, 237, 166], LILAC = [185, 166, 255], TXT = [238, 240, 255], TXT2 = [169, 176, 217];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const mul = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rnd = mul(21);
const STARS = Array.from({ length: 520 }, () => { const a = rnd() * 6.2832, d = Math.sqrt(rnd()) * 0.97 + 0.03; return { a, d, x: Math.cos(a) * d, y: Math.sin(a) * d, tw: rnd() }; });
const SPOKES = Array.from({ length: 30 }, (_, k) => ({ a: (k / 30) * 6.2832 + rnd() * 0.15, u: rnd() }));
const STRIPDOTS = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), m: rnd() }));
const FRONTS = [0, 0.5];

const lw = (w) => { ctx.lineWidth = w * S1; };
const pulse = (t) => { let z = 0; for (const tp of CUE.pulses) { const x = t - tp; if (x > 0 && x < 2.2) z += 0.04 * (x < 0.25 ? Math.sin((x / 0.25) * 1.5708) : Math.exp(-(x - 0.25) / 0.55)); } return z; };
const FR = mul(77);
const TRUNKS = Array.from({ length: 34 }, () => ({ x: FR() * 810, w: 16 + FR() * 40, a: 0.35 + FR() * 0.4 }));
function forest(t, k) {                                                         // "like a forest": every look hits a trunk
  if (k <= 0.001) return;
  const x0 = 90 * sx, y0 = 540 * sy, w = 810 * sx, h = 470 * sy;
  ctx.fillStyle = rgba([14, 17, 44], 0.97 * k); ctx.fillRect(x0, y0, w, h);
  for (const tr of TRUNKS) { ctx.fillStyle = rgba(TXT2, tr.a * 0.55 * k); ctx.fillRect(x0 + tr.x * sx, y0, tr.w * sx, h); }
  const u = E.inout3(seg(t, CUE.forest0, CUE.trunk + 0.4));
  for (let j = 0; j < 7; j++) {                                                 // lines of sight from you, each stopped by a trunk
    const y = (590 + j * 62) * sy, L = (120 + 690 * ((j * 0.37) % 1) * 0.0 + 60 * j % 300 + 190) * sx * u;
    ctx.strokeStyle = rgba(TEAL, 0.9 * k); lw(3.5); ctx.beginPath(); ctx.moveTo(x0 + 6 * sx, y); ctx.lineTo(x0 + 6 * sx + L, y); ctx.stroke();
    if (u > 0.95) { ctx.fillStyle = rgba(LEMON, k); ctx.beginPath(); ctx.arc(x0 + 6 * sx + L, y, 7 * S1, 0, 6.2832); ctx.fill(); }
  }
  ctx.fillStyle = rgba(TEAL, k); ctx.beginPath(); ctx.arc(x0 + 6 * sx, 590 * sy + 186 * sy, 9 * S1, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = rgba(TXT2, 0.6 * k); lw(2); ctx.strokeRect(x0, y0, w, h);
}
function bar(t, S, ramp) {                                                      // the night sky: S = 0 (dark) … 1 (white); ramp = the hook's payoff
  const x0 = SX0 * sx, x1 = SX1 * sx, y0 = SY0 * sy, y1 = SY1 * sy, w = x1 - x0, h = y1 - y0;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 10 * S1); ctx.clip();
  ctx.fillStyle = "rgba(14,17,44,0.95)"; ctx.fillRect(x0, y0, w, h);
  if (ramp > 0.001) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "rgba(14,17,44,0)"); g.addColorStop(1, rgba(TXT, 0.95 * ramp));
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  }
  if (S > 0.001) { ctx.fillStyle = rgba(TXT, S * 0.95 * (1 - ramp)); ctx.fillRect(x0, y0, w, h); }
  const dark = (1 - S) * (1 - ramp);
  for (const d of STRIPDOTS) {                                                  // stars in a dark sky
    if (d.m > dark * 0.9) continue;
    ctx.fillStyle = rgba(TXT, 0.35 + 0.6 * d.m * dark);
    ctx.beginPath(); ctx.arc(x0 + d.x * w, y0 + 4 * sy + d.y * (h - 8 * sy), (1.1 + 1.4 * d.m) * S1, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = rgba(TXT2, 0.5); ctx.lineWidth = 1.6 * S1;
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 10 * S1); ctx.stroke();
}

function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const kLoop = fadeIn(t, CUE.end - 0.45, 0.45);                                // the end card sits on frame 0 (a replay loops)
  const z = 1 + pulse(t), fcy = 0.36 * H;
  ctx.setTransform(z, 0, 0, z, (W / 2) * (1 - z), fcy * (1 - z));
  const kOut = 1 - kLoop;
  const kRd = fadeIn(t, CUE.rd, 0.6);                                           // the readout: the strip leaves, the map stays quietly
  // the horizon: the universe's age closes in on "thirteen point eight billion years"
  const hz = E.inout3(seg(t, CUE.age0, CUE.age1 + 0.6)), Hr = R * (1.03 - 0.75 * hz);
  // the night sky: ramp (hook) → dark → climbs to white (fainter, but more) → falls with the horizon → dark, one star lit
  const ramp = Math.max(1 - E.inout3(seg(t, CUE.n - 0.4, CUE.n + 0.3)), kLoop);
  const climb = E.inout3(seg(t, CUE.fainter, CUE.surface));
  const fall = Math.pow(Math.min(1, Hr / (R * 1.03)), 2);
  let S = 0.08 + 0.92 * climb * (t < CUE.age0 ? 1 : fall) + (t >= CUE.age0 ? 0 : 0);
  if (t >= CUE.age0) S = 0.08 + 0.92 * climb * fall;
  S *= 1 - 0.55 * fadeIn(t, CUE.clue, 0.6);
  if (t < CUE.rd || kLoop > 0.01) bar(t, kLoop > 0.01 ? 0 : S, ramp);
  // the distance map
  const cx = CX * sx, cy = CY * sy, r0 = R * sx;
  const mapA = 1;
  ctx.strokeStyle = rgba(LILAC, 0.55 * mapA); ctx.lineWidth = 2 * S1;
  ctx.beginPath(); ctx.arc(cx, cy, r0, 0, 6.2832); ctx.stroke();
  ctx.setLineDash([4 * S1, 8 * S1]); ctx.strokeStyle = rgba(TXT2, 0.28 * mapA);
  for (const f of [1 / 3, 2 / 3]) { ctx.beginPath(); ctx.arc(cx, cy, r0 * f, 0, 6.2832); ctx.stroke(); }
  ctx.setLineDash([]);
  // stars: fainter and smaller with distance, more of them; beyond the horizon they have not arrived
  const lit = (d) => (d * R < Hr ? 1 : 0.1);
  const starsOn = fadeIn(t, 0.0, 0.01);
  for (const s of STARS) {
    const near = 1 - s.d;
    const k = lit(s.d) * (t < CUE.n ? 0.55 : 1 - 0.45 * kLoop) * mapA * starsOn;
    const a = (0.28 + 0.72 * near * near + 0.05 * Math.sin(t * 1.3 + s.tw * 9) * 0) * k;
    ctx.fillStyle = rgba(s.d * R < Hr ? LEMON : TXT2, a);
    ctx.beginPath(); ctx.arc(cx + s.x * r0, cy + s.y * r0, (0.9 + 3.8 * near * near) * S1 * (W / 1080 > 0.7 ? 1 : 1.2), 0, 6.2832); ctx.fill();
  }
  // lines of sight: each ends on a star (the forest)
  const sp = E.inout3(seg(t, CUE.spokes0, CUE.spokes1));
  if (sp > 0.001) {
    for (const s of SPOKES) {
      const L = r0 * 0.97 * sp;
      ctx.strokeStyle = rgba(TEAL, 0.55 * mapA * (1 - 0.7 * kRd) * (1 - fadeIn(t, CUE.fainter, 0.8)));
      ctx.lineWidth = 1.5 * S1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(s.a) * L, cy + Math.sin(s.a) * L); ctx.stroke();
      if (sp > 0.95) { ctx.fillStyle = rgba(LEMON, 0.95 * (1 - fadeIn(t, CUE.fainter, 0.8))); ctx.beginPath(); ctx.arc(cx + Math.cos(s.a) * L, cy + Math.sin(s.a) * L, 4 * S1, 0, 6.2832); ctx.fill(); }
    }
  }
  // the rings of "fainter, but more": near / middle / far bands light in turn
  for (let k = 0; k < 3; k++) {
    const on = fadeIn(t, CUE.fainter + k * 0.9, 0.5) * (1 - fadeIn(t, CUE.cancel + 1.0, 0.8));
    if (on <= 0.01) continue;
    ctx.strokeStyle = rgba(TEAL, 0.8 * on * mapA); ctx.lineWidth = (3 - 0.6 * k) * S1;
    ctx.beginPath(); ctx.arc(cx, cy, r0 * ((k + 1) / 3), 0, 6.2832); ctx.stroke();
  }
  // the horizon, and light still on its way
  if (t >= CUE.age0 - 0.2 && kLoop < 0.5) {
    ctx.strokeStyle = rgba(TEAL, 0.95 * mapA * fadeIn(t, CUE.age0 - 0.2, 0.5)); ctx.lineWidth = 3.4 * S1;
    ctx.beginPath(); ctx.arc(cx, cy, Hr * sx, 0, 6.2832); ctx.stroke();
  }
  if (t >= CUE.way) {
    ctx.setLineDash([10 * S1, 10 * S1]);
    for (const ph of FRONTS) {
      const u = (((t - CUE.way) * 0.16 + ph) % 1), rr = (R * 1.0 - (R - Hr) * 0 - (R * 1.0 - Hr) * u * 0.9);
      if (rr <= Hr + 4) continue;
      ctx.strokeStyle = rgba(TEAL, 0.6 * (1 - u) * mapA * (1 - fadeIn(t, CUE.rd, 0.4)));
      ctx.lineWidth = 2 * S1; ctx.beginPath(); ctx.arc(cx, cy, rr * sx, 0, 6.2832); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  forest(t, fadeIn(t, CUE.forest0 - 0.3, 0.4) * (1 - fadeIn(t, CUE.c - 0.4, 0.4)));
  // you (the observer)
  ctx.fillStyle = rgba(TEAL, mapA); ctx.beginPath(); ctx.arc(cx, cy, 6.5 * S1, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = rgba(TEAL, 0.7 * mapA); ctx.lineWidth = 2 * S1; ctx.beginPath(); ctx.arc(cx, cy, 13 * S1, 0, 6.2832); ctx.stroke();
  // the readout: light crosses 8 minutes (the Sun, near), then "billions of years" (the farthest galaxies, the map's edge)
  const u1 = E.out3(seg(t, CUE.sun, CUE.sun + 1.6)), u2 = E.out3(seg(t, CUE.farthest, CUE.farthest + 2.6));
  if (u1 > 0.002 && t < CUE.farthest + 0.1) { ctx.strokeStyle = rgba(TEAL, 0.9 * (1 - u1 * 0.6) * kOut); ctx.lineWidth = 3.4 * S1; ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.1 * u1, 0, 6.2832); ctx.stroke(); }
  if (u2 > 0.002) { ctx.strokeStyle = rgba(TEAL, 0.9 * (1 - 0.7 * u2) * kOut); ctx.lineWidth = 3.4 * S1; ctx.beginPath(); ctx.arc(cx, cy, r0 * u2, 0, 6.2832); ctx.stroke(); }
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
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
  if (v && c.text.length > 12) v.style.fontSize = c.read ? "4.6vmin" : "5.2vmin";
  else if (v && c.text.length > 10 && !c.read) v.style.fontSize = "8.5vmin";
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

window.seek = function (t) {
  const st = stage(t), shot = st.name, tr = Math.round(t * FPS) / FPS;
  rig.place(camera, shot, t);
  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 0.3, bandGain: 0.5 });
  draw(t);
  hud.update(t);
  tRing.update(t);
  eRing.update(t);
  renderer.render(scene, camera);
};
