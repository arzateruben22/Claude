import * as THREE from "three";
// Back of the Envelope No. 004, "Count to a billion" (films/channels/whatif/ep04). The picture as a pure
// function of t for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, every
// sheet and the overlay from t alone, then makes exactly one renderer.render().
//
// One world (bible §2): one line up the graph-paper desk, away from the camera, so it climbs the vertical
// frame. The counting tape first: a paper slip per number, longer the more syllables it takes to say (one
// marker dot per syllable), with "…" gaps where the count skips ahead; then Harper's summer, a calendar of 89
// squares filling as he counts; then the ruler of centuries, a quarter unit a year, drawn in marker as the
// billion is counted, the naive 32 years ticked on it and five blue lifetimes laid beside it. "You" (anchor
// blue) stand at the tape's foot, which is frame 0 and the last frame; Harper stands by his calendar.
// Everything timed comes from film.json, which compile.py hangs on the voice; this file only stages it.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createFigure } from "../set/anchor.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";
import { createSheet, rrect, numberWords, syllables, commas } from "../set/tape04.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const SC = (window.THEME && window.THEME.scene) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.5, 3000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.95, bloom: 0.3 });   // nothing should bloom: paper and ink
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

// ── colours for the canvases (display sRGB; the sheet shader inverts the finish) ──
const PAPER = SC.model || "#E6E2D8", INK = TK.graphite || "#171A1E", INK2 = "#4A4E57", MARK = TK.marker || "#EB63FF";
const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF";
const FM = '"JetBrains Mono", monospace', FT = '"Figtree", sans-serif';

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 260 });
scene.add(desk.group);
const SW = WD.slipW;

// a slip: the number in mono, its words wrapped below, a marker dot per syllable along its foot. state.say
// (0–1) lights the words and dots left to right (the long slip while "you have to say all of it")
const wrap = (ctx, text, maxW) => {
  const words = text.split(" "), lines = [];
  let cur = "";
  for (const w of words) { const nx = cur ? cur + " " + w : w; if (ctx.measureText(nx).width > maxW && cur) { lines.push(cur); cur = w; } else cur = nx; }
  if (cur) lines.push(cur);
  return lines;
};
const drawSlip = (n) => (ctx, cw, ch, st) => {
  const ppu = cw / SW, pad = 0.28 * ppu, say = st ? st.say : 0, lit = st ? st.lit : 0;
  rrect(ctx, 2, 2, cw - 4, ch - 4, 0.12 * ppu); ctx.fillStyle = PAPER; ctx.fill();
  if (lit) { ctx.lineWidth = 0.07 * ppu; ctx.strokeStyle = MARK; rrect(ctx, 0.05 * ppu, 0.05 * ppu, cw - 0.1 * ppu, ch - 0.1 * ppu, 0.1 * ppu); ctx.stroke(); }
  ctx.fillStyle = INK; ctx.textBaseline = "top";
  ctx.font = `700 ${0.56 * ppu}px ${FM}`;
  ctx.fillText(n === 1e9 ? "1,000,000,000" : commas(n), pad, pad * 0.8);
  ctx.font = `600 ${0.36 * ppu}px ${FT}`;
  const lines = wrap(ctx, numberWords(n), cw - 2 * pad), lh = 0.46 * ppu;
  const total = lines.reduce((a, l) => a + l.length, 0);
  let seen = 0;
  lines.forEach((l, i) => {
    const y = pad * 0.8 + 0.72 * ppu + i * lh;
    ctx.fillStyle = INK2; ctx.fillText(l, pad, y);
    const k = clamp01((say * total - seen) / l.length);         // how much of this line is said
    if (k > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(pad, y - 2, ctx.measureText(l).width * k, lh); ctx.clip();
      ctx.fillStyle = INK; ctx.fillText(l, pad, y);
      ctx.fillStyle = MARK; ctx.fillRect(pad, y + 0.4 * ppu, ctx.measureText(l).width, 0.05 * ppu);
      ctx.restore();
    }
    seen += l.length;
  });
  const s = syllables(n), r = 0.075 * ppu, gap = Math.min(0.26 * ppu, (cw - 2 * pad) / Math.max(1, s));
  for (let i = 0; i < s; i++) {
    ctx.beginPath(); ctx.arc(pad + r + i * gap, ch - pad * 0.75, r, 0, 2 * Math.PI);
    ctx.fillStyle = say > 0 ? (i / s < say ? MARK : CHALK2) : MARK; ctx.fill();
  }
};
const slips = WD.slips.map((s) => {
  const L = s.z0 - s.z1, sh = createSheet({ w: SW, d: L, ppu: 180, at: [0, 0, (s.z0 + s.z1) / 2], draw: drawSlip(s.n) });
  scene.add(sh.mesh);
  if (syllables(s.n) !== s.syl) console.warn(`tape04: syllables(${s.n}) = ${syllables(s.n)} but calc.py says ${s.syl}`);
  return { ...s, sh };
});
// the "…" between groups: three chalk dots where the count skips ahead
const skips = [];
for (let i = 1; i < slips.length; i++) {
  const gap = slips[i - 1].z1 - slips[i].z0;
  if (gap > 1) {
    const sk = createSheet({ w: 1.6, d: 0.6, ppu: 120, at: [0, 0, (slips[i - 1].z1 + slips[i].z0) / 2], draw: (ctx, cw, ch) => {
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cw * (0.2 + 0.3 * k), ch / 2, ch * 0.16, 0, 2 * Math.PI); ctx.fillStyle = CHALK2; ctx.fill(); }
    } });
    scene.add(sk.mesh); skips.push({ sk, after: i - 1 });
  }
}
// "one billion": three syllables, laid in the takeaway right after 1, 2, 3 and a "…", where 4–12 lay: no
// longer than "seven" (the word is easy to say once)
const BIL_L = 1.35 + 0.16 * WD.billionSyl, SL3 = WD.slips[2], BIL_Z = SL3.z1 - 2.4 - BIL_L / 2;
const billion = createSheet({ w: SW, d: BIL_L, ppu: 180, at: [0, 0.004, BIL_Z], draw: drawSlip(1e9) });
const bilSkip = createSheet({ w: 1.6, d: 0.6, ppu: 120, at: [0, 0, SL3.z1 - 1.2], draw: (ctx, cw, ch) => {
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cw * (0.2 + 0.3 * k), ch / 2, ch * 0.16, 0, 2 * Math.PI); ctx.fillStyle = CHALK2; ctx.fill(); }
} });
scene.add(billion.mesh, bilSkip.mesh);

// Harper's calendar: 7 columns (Mon–Sun) × 13 rows up the desk, the months in a column on the left
const CAL = WD.cal, CW = CAL.cell * 7 + 1.7, CD = CAL.cell * CAL.rows + 1.2;
const MONTHS = [["JUN", 0], ["JUL", 13], ["AUG", 44], ["SEP", 75]];
const calendar = createSheet({ w: CW, d: CD, ppu: 150, at: [-0.4, 0, (CAL.z0 + CAL.z1) / 2], draw: (ctx, cw, ch, st) => {
  const ppu = cw / CW, c = CAL.cell * ppu, x0 = 1.5 * ppu, yb = ch - 0.25 * ppu;  // week 0 at the bottom (near the camera)
  rrect(ctx, 2, 2, cw - 4, ch - 4, 0.14 * ppu); ctx.fillStyle = PAPER; ctx.fill();
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.font = `700 ${0.3 * ppu}px ${FM}`; ctx.fillStyle = INK2;
  "MTWTFSS".split("").forEach((d, i) => ctx.fillText(d, x0 + (i + 0.5) * c, 0.5 * ppu));
  for (let i = 0; i < CAL.days; i++) {
    const wk = Math.floor((i + CAL.first_dow) / 7), col = (i + CAL.first_dow) % 7;
    const x = x0 + col * c, y = yb - (wk + 1) * c;
    rrect(ctx, x + 0.06 * c, y + 0.06 * c, c * 0.88, c * 0.88, 0.1 * c);
    ctx.fillStyle = i < st.k ? MARK : "rgba(23, 26, 30, 0.10)"; ctx.fill();
  }
  ctx.textAlign = "left"; ctx.font = `700 ${0.34 * ppu}px ${FM}`;
  MONTHS.forEach(([m, d]) => { const wk = Math.floor((d + CAL.first_dow) / 7); ctx.fillStyle = st.m ? INK : INK2; ctx.fillText(m, 0.2 * ppu, yb - (wk + 0.5) * c); });
} });
scene.add(calendar.mesh);
const CAL_X = calendar.mesh.position.x;
const harper = createFigure({ tokens: TK, height: 1.5 });
harper.group.position.set(WD.harper[0], 0.75, WD.harper[2]);
scene.add(harper.group);
const you = createFigure({ tokens: TK, height: 1.5 });
you.set({ at: [WD.figX, 0.75, -0.6] });
scene.add(you.group);

// the ruler of centuries (units across the sheet, left to right): five blue lifetimes laid end to end, the ruler
// itself, the naive 32 years bracketed in chalk, and a year mark every century. Graduations every 10 years
// (bolder every 50) cross the ruler; it fills in marker up to state.y years; state.n shows the bracket; state.l
// lifetimes have landed (the last one fading in)
const RU = WD.ruler, RW = 30.0, RD = RU.years * RU.yu + 1.0;
const RX = { life: 0.8, lifeW: 4.6, xL: 7.0, xR: 7.0 + RU.w, label: 7.0 + RU.w + 3.2 };
const rx = (u) => u - RW / 2;                                              // sheet units → world x (the sheet is centred on x = 0)
const ruler = createSheet({ w: RW, d: RD, ppu: 36, at: [0, 0.002, RU.z0 - RD / 2 + 0.5], order: -6, draw: (ctx, cw, ch, st) => {
  const ppu = cw / RW, yb = ch - 0.5 * ppu, py = (yr) => yb - yr * RU.yu * ppu, xL = RX.xL * ppu, xR = RX.xR * ppu;
  ctx.fillStyle = "rgba(244, 242, 236, 0.10)"; ctx.fillRect(xL, py(RU.years), xR - xL, py(0) - py(RU.years));
  ctx.fillStyle = MARK; ctx.fillRect(xL, py(st.y), xR - xL, py(0) - py(st.y));
  for (let yr = 0; yr <= RU.years; yr += 10) {
    const big = yr % 50 === 0, on = yr <= st.y;
    ctx.fillStyle = on ? "rgba(23, 26, 30, 0.55)" : big ? CHALK : CHALK2;
    const h = big ? 0.5 * ppu : 0.25 * ppu, w = big ? RU.w * ppu : 0.45 * RU.w * ppu;
    ctx.fillRect(xL, py(yr) - h / 2, w, h);
  }
  ctx.fillStyle = CHALK; ctx.fillRect(xL - 0.3 * ppu, py(RU.years), 0.3 * ppu, py(0) - py(RU.years)); ctx.fillRect(xR, py(RU.years), 0.3 * ppu, py(0) - py(RU.years));
  ctx.font = `700 ${4.2 * ppu}px ${FM}`; ctx.textBaseline = "middle"; ctx.fillStyle = CHALK2;
  for (let yr = 100; yr <= 400; yr += 100) ctx.fillText(`${yr}`, RX.label * ppu, py(yr));
  if (st.n > 0) {
    ctx.globalAlpha = st.n; ctx.fillStyle = CHALK;
    ctx.fillRect(xR + 1.2 * ppu, py(RU.naive), 0.6 * ppu, py(0) - py(RU.naive));
    ctx.fillRect(xR + 0.5 * ppu, py(RU.naive) - 0.3 * ppu, 2.0 * ppu, 0.6 * ppu); ctx.fillRect(xR + 0.5 * ppu, py(0) - 0.3 * ppu, 2.0 * ppu, 0.6 * ppu);
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 5; i++) {
    const a = clamp01(st.l - i);
    if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.fillStyle = ANCH;
    rrect(ctx, RX.life * ppu, py((i + 1) * RU.life) + 0.35 * ppu, RX.lifeW * ppu, py(i * RU.life) - py((i + 1) * RU.life) - 0.7 * ppu, 0.8 * ppu); ctx.fill();
    ctx.globalAlpha = 1;
  }
} });
scene.add(ruler.mesh);
const ZY = (yr) => RU.z0 - RU.yu * yr;

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const SL = Object.fromEntries(slips.map((s) => [s.n, s]));
const S = {
  you: [WD.figX, 1.5, -0.6], slip4: [SW / 2, 0, (SL[4].z0 + SL[4].z1) / 2], dots: [SW / 2 - 0.4, 0, SL[WD.long].z1 + 0.35],
  harper: [WD.harper[0], 1.6, WD.harper[2]], cal: [CAL_X + CW / 2, 0, (CAL.z0 + CAL.z1) / 2],
  naive: [rx(RX.xR + 2.0), 0, ZY(RU.naive)], life1: [rx(RX.life), 0, ZY(RU.life * 2.5)], billion: [SW / 2, 0, BIL_Z],
};
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const mmss = (v) => { const s = Math.max(0, Math.floor(v + 1e-6)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at };
  if (c.fmt === "secs") Object.assign(o, { value: (t) => c.keys[0][1] + Math.min(c.keys[1][1] - c.keys[0][1] - 0.001, Math.max(0, t - c.keys[0][0])), fmt: mmss, minCh: 4 });   // the number on the top slip, minus one: seconds since "1"
  else Object.assign(o, { keys: c.keys, ease: "linear", fmt: (v) => commas(Math.round(v)), unit: c.id === "c-years" ? "yr" : "", minCh: c.id === "c-years" ? 3 : 9, lit: (v) => v >= c.end - 1e-6 });
  hud.counter(c.id, o);
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.6vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "62vmin", margin: "4vmin auto 0" });
const box = endBox(endEl, { t0: FILM.endCard, answer: FILM.spine[FILM.spine.length - 1].terms.find((x) => x[0] === "ans")[1], S1: Math.min(W, H) / 1080 });

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
const fadeIn = (t, t0, d = 0.3) => E.out3(seg(t, t0, t0 + d));

window.seek = function (t) {
  const st = stage(t), shot = st.name, home = shot === "end" || shot === "front" || (shot === "home" && t >= CUE.home + 1.2);
  const away = shot === "home" ? 1 - E.inout2(seg(t, CUE.home, CUE.home + 1.2)) : home ? 0 : 1;   // the far line, fading on the push home
  const pose = rig.place(camera, shot, t);
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));

  // the tape: 1–3 from frame 0; 4–12 one a second; the rest appear up the desk as the camera lifts ("don't stay
  // short"), near to far; the long slip lights as it is said. Back home, only 1–3 again (the loop)
  slips.forEach((s, i) => {
    let o;
    if (s.n <= 3) o = 1;
    else if (s.n <= 12) o = home ? 0 : fadeIn(t, CUE.ticks[s.n - 4], 0.25);
    else o = home ? 0 : fadeIn(t, CUE.short + 0.06 * (i - 12), 0.4);
    if (shot === "ruler" || shot === "work" || (shot === "home" && !home)) o *= 1 - seg(t, beat("whoa").t0, beat("whoa").t0 + 2.0) * 0.6;
    if (shot === "home" && s.n > 3) o *= away;
    const say = s.n === WD.long ? E.inout2(seg(t, CUE.say[0], CUE.say[1])) : 0;
    s.sh.set({ opacity: o, state: { say: Math.round(say * 60) / 60, lit: s.n === WD.long && t >= CUE.fly[1] && !home ? 1 : 0 } });
  });
  skips.forEach(({ sk, after }) => sk.set({ opacity: home ? 0 : away * fadeIn(t, CUE.short + 0.06 * (after - 11), 0.4) }));
  const bo = shot === "home" ? fadeIn(t, CUE.once, 0.35) : shot === "end" ? 1 - seg(t, FILM.endCard + 0.6, beat("tease").t1 - 0.3) : 0;
  billion.set({ opacity: bo, state: { say: 0, lit: 1 } });
  bilSkip.set({ opacity: bo });

  // the calendar fills a square a day from "man" to "million"; the months light on "summer"
  const k = Math.floor(FILM.world.cal.days * clamp01((t - CUE.cal[0]) / (CUE.cal[1] - CUE.cal[0])) + 1e-6);
  calendar.set({ opacity: away, state: { k, m: t >= CUE.summer ? 1 : 0 } });

  // the ruler: in with the whoa, drawn to 380 years by "years"; the naive 32 years from "takes"; the lifetimes
  const ro = away * fadeIn(t, beat("whoa").t0 - 0.2, 0.8);
  const yrs = RU.real * E.inout2(clamp01((t - CUE.ruler[0]) / (CUE.ruler[1] - CUE.ruler[0])));
  const lives = 5 * clamp01((t - CUE.life[0]) / (CUE.life[1] - CUE.life[0]));
  ruler.set({ opacity: ro, state: { y: Math.round(yrs), n: t >= FILM.labels.find((l) => l.id === "l-naive").t0 ? 1 : 0, l: Math.round(lives * 8) / 8 } });

  harper.group.visible = away > 0.5;
  you.group.visible = home || shot === "home" || shot === "count";
  you.set({ at: [WD.figX, 0.75, -0.6] });

  // the desk's lamp pool follows the camera's target; soft shadows under the figures
  desk.update({ grid: 1, pool: [pose.target[0], pose.target[2]], casters: [home || shot === "count" ? [WD.figX, 1.5, -0.6, 0.5] : null, !home ? [WD.harper[0], 1.5, WD.harper[2], 0.5] : null].filter(Boolean) });

  hud.update(t);
  const tail = E.inout2(seg(t, beat("tease").t1 - 0.6, beat("tease").t1));   // the loop: the card lifts, the strips come back up
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
