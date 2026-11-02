import * as THREE from "three";
// Back of the Envelope No. 006, "Every raindrop at once" (films/channels/whatif/ep06). The picture as a pure
// function of t for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the world
// and the overlay from t alone, then makes exactly one renderer.render().
//
// One world (bible §2), in true metres: you (anchor blue) on the graph-paper desk under a sky of chalk rain
// streaks (set/rain06.js), frozen at frame 0. An ordinary day drizzles past on the clock; squeezed into one second
// the sky pours (the streaks lengthen and thicken, the Amazons counter leaps to 7 million). A waffle of 100 squares
// on the paper (set/tape04.js's canvas sheet) shows where it lands: 78 on the ocean. Then down to your feet, where
// the day's water stands as a layer 2.8 mm deep (it fills on the line) beside two stacked coins, boxed. The takeaway
// pulls back: a thin film round you, and a record storm day's column (1.8 m) rises beside you, taller than you.
// Everything timed comes from film.json, which compile.py hangs on the voice; this file only stages it.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createFigure } from "../set/anchor.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";
import { createSheet, rrect, commas } from "../set/tape04.js";
import { createRain, createWater, createCoins } from "../set/rain06.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.005, 2000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.95, bloom: 0.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF", INK = TK.graphite || "#171A1E";

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 60 });
scene.add(desk.group);
const rain = createRain({ tokens: TK, count: 9000, half: 9, top: 13 });
scene.add(rain.mesh);
const you = createFigure({ tokens: TK, height: WD.fig });
you.set({ at: [0, WD.fig / 2, 0] });
scene.add(you.group);
// where it lands: 100 squares on the paper, the ocean's share in chalk, the land's in chalk-2 hatching; the squares
// light one by one from "ocean" (state.k of them)
const WF = WD.waffle, WS = WF.cell * 10 + 0.5;
const waffle = createSheet({ w: WS, d: WS, ppu: 110, at: [WF.at[0], 0, WF.at[1]], draw: (ctx, cw, ch, st) => {
  const ppu = cw / WS, c = WF.cell * ppu, m = 0.25 * ppu;
  rrect(ctx, 2, 2, cw - 4, ch - 4, 0.1 * ppu); ctx.fillStyle = "rgba(37, 40, 46, 0.92)"; ctx.fill();
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10), col = i % 10, x = m + col * c, y = m + (9 - r) * c;
    const ocean = i >= 100 - WF.ocean, on = i < st.k;                       // the 22 land squares first, nearest the camera
    rrect(ctx, x + 0.08 * c, y + 0.08 * c, 0.84 * c, 0.84 * c, 0.12 * c);
    ctx.fillStyle = on ? (ocean ? "#CFCCC5" : INK) : "rgba(244, 242, 236, 0.08)"; ctx.fill();   // a little under chalk: no bloom
    if (on && !ocean) { ctx.strokeStyle = CHALK2; ctx.lineWidth = 0.07 * c; ctx.stroke(); for (let h = 0.3; h < 0.9; h += 0.3) { ctx.beginPath(); ctx.moveTo(x + h * c, y + 0.85 * c); ctx.lineTo(x + 0.85 * c, y + h * c); ctx.stroke(); } }
  }
} });
scene.add(waffle.mesh);
const layer = createWater({ tokens: TK, r: 0.5, h: 1e-5, a: 0.22, alpha: 0.35 });
scene.add(layer.mesh);
const film = createWater({ tokens: TK, r: 3.2, h: WD.depth, a: 0.1, alpha: 0.3, solid: 0.15 });   // a faint sheen, not a floor
scene.add(film.mesh);
const storm = createWater({ tokens: TK, r: 0.32, h: 1e-5, a: 0.34, alpha: 0.6 });
scene.add(storm.mesh);
const coins = createCoins({ tokens: TK, n: 2 });
coins.set({ at: WD.coins });
scene.add(coins.group);
// the cross-section card: standing on the paper at your feet, face on to the camera, drawn true to scale in mm: the
// day's water (a column that fills to 2.8 mm, its top a gentle wave), a millimetre scale, and two stacked coins
// (1.52 mm each) that land on "two". state: { f: fill 0–1, c: coins 0–1 }
const CW_M = 0.016, CH_M = 0.0062;
const card = createSheet({ w: CW_M, d: CH_M, ppu: 70000, at: [0, 0, 0], order: 3, draw: (ctx, cw, ch, st) => {
  const pmm = ch / (CH_M * 1000), base = ch - 0.25 * pmm, X = (mm) => mm * pmm;
  ctx.fillStyle = "rgba(23, 26, 30, 0.96)"; rrect(ctx, 0, 0, cw, ch, 0.3 * pmm); ctx.fill();
  ctx.fillStyle = "rgba(244, 242, 236, 0.35)"; ctx.fillRect(X(0.6), base, cw - X(1.2), 2);              // the paper's surface
  // the water: 2.8 mm × f, chalk at 55%, a brighter top line with a small wave
  const hw = WD.depth * 1000 * st.f;
  if (hw > 0.01) {
    ctx.fillStyle = "rgba(244, 242, 236, 0.5)"; ctx.fillRect(X(0.8), base - X(hw), X(5.2), X(hw));
    ctx.strokeStyle = CHALK; ctx.lineWidth = 3; ctx.beginPath();
    for (let k = 0; k <= 40; k++) { const x = X(0.8) + X(5.2) * k / 40, y = base - X(hw) + Math.sin(k * 0.9 + st.w * 3) * 0.05 * pmm; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  // the scale, between them: a tick a millimetre, numbered
  ctx.fillStyle = CHALK2; ctx.font = `700 ${0.62 * pmm}px "JetBrains Mono", monospace`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  for (let mm = 0; mm <= 5; mm++) { const y = base - X(mm); ctx.fillRect(X(6.6), y - 1.5, X(mm % 5 ? 0.45 : 0.8), 3); if (mm) ctx.fillText(mm === 5 ? "5 mm" : `${mm}`, X(mm === 5 ? 8.3 : 7.9), y); }
  // two coins, edge on: 19 mm wide is wider than the card, so their edge-on profiles run off its right side
  const c = st.c;
  for (let i = 0; i < 2; i++) {
    const a = Math.min(1, Math.max(0, c * 2 - i));
    if (a <= 0) continue;
    const y = base - X(1.52 * (i + 1)) - (1 - a) * X(1.6), x0 = X(9.4) + (1 - a) * X(2.0);
    ctx.globalAlpha = a; ctx.fillStyle = CHALK2; rrect(ctx, x0, y + 1, X(6.2), X(1.52) - 2, 0.7 * pmm); ctx.fill();          // a coin, edge on: rounded ends
    ctx.fillStyle = CHALK; ctx.fillRect(x0 + X(0.4), y + X(0.3), X(5.4), 2);                                                 // the rim catching the lamp
    ctx.globalAlpha = 1;
  }
} });
card.mesh.geometry.rotateX(Math.PI / 2);                          // createSheet lays it flat: stand it up, face on to the camera (+z)
card.mesh.position.set(WD.coins[0], CH_M / 2, WD.coins[1]);
scene.add(card.mesh);

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const AN = {
  you: () => [0, WD.fig, 0], waffle: () => [WF.at[0], 0, WF.at[1] - WS / 2], layer: () => [WD.coins[0] - CW_M / 2 + 0.0034, WD.depth, WD.coins[1]],
  coins: () => [WD.coins[0] + CW_M / 2 - 0.002, 0.0031, WD.coins[1]], film: () => [1.8, 0.003, -1.8], storm: () => [-1.1 - 0.3, WD.storm * 0.85, 0.2],
};
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const o = { label: c.label, t0: c.t0, t1: c.t1, at: c.at, keys: c.keys, ease: "linear" };
  if (c.fmt === "hours") Object.assign(o, { fmt: (v) => (v > 24.5 ? "1 second" : `${String(Math.floor(v + 1e-6)).padStart(2, "0")}:00`), minCh: 8, lit: (v) => v > 24.5 });
  else Object.assign(o, { fmt: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} million` : commas(Math.round(v))), minCh: 11, lit: (v) => Boolean(c.end && v >= c.end - 1) });   // millions to one decimal: no fake precision
  hud.counter(c.id, o);
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: AN[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: 0.27 });   // a little higher: room for the trail above the tease caption
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "4vmin auto 0" });
// the tease's picture: a dotted trail of footprints walking up to a small moon, under the next-envelope line
const trail = document.createElement("div");
trail.innerHTML = '<svg viewBox="0 0 220 46" width="42vmin" style="display:block;margin:0.6vmin auto 0;overflow:visible" aria-hidden="true">'
  + [0, 1, 2, 3, 4, 5, 6].map((i) => `<ellipse class="fp" cx="${8 + i * 24}" cy="${i % 2 ? 30 : 38}" rx="6" ry="3.6" fill="var(--chalk-2)" opacity="0"/>`).join("")
  + '<g class="moon" opacity="0"><circle cx="198" cy="18" r="16" fill="none" stroke="var(--chalk)" stroke-width="2.6"/><circle cx="193" cy="13" r="3" fill="var(--chalk-2)"/><circle cx="204" cy="23" r="2.2" fill="var(--chalk-2)"/><circle cx="201" cy="10" r="1.5" fill="var(--chalk-2)"/></g></svg>';
const prints = [...trail.querySelectorAll(".fp")], moonG = trail.querySelector(".moon");
const titleP = endEl.querySelector(".t");
if (titleP) titleP.after(trail);
const box = endBox(endEl, { t0: FILM.endCard, answer: FILM.spine[FILM.spine.length - 1].terms.find((x) => x[0] === "ans")[1], S1: Math.min(W, H) / 1080 });

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
// the rain's fall: piecewise-linear speeds between keys [t, y, v]; distance is the trapezoid (as compile.py lays it out)
const fallAt = (t) => {
  const K = CUE.fall;
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [t0, y0, v0] = K[i - 1], [t1, , v1] = K[i], u = (t - t0) / (t1 - t0), vt = v0 + (v1 - v0) * u; return y0 + (v0 + vt) / 2 * (t - t0); }
  return K[K.length - 1][1];
};

window.seek = function (t) {
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  camera.near = Math.max(0.002, pose.dist / 200); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const home = shot === "front" || shot === "end";

  // the rain: frozen in the hook (and the loop), a drizzle through the day, the pour, then it settles into the layer
  const pour = E.inout2(seg(t, CUE.squeeze[1] - 0.3, CUE.squeeze[1] + 0.6)) * (1 - E.inout2(seg(t, beat("why").t0 + 0.5, CUE.ocean + 1.0)));   // the downpour starts on "second"
  const ro = shot === "macro" || shot === "work" ? 1 - seg(t, beat("whoa").t0, beat("whoa").t0 + 1.2) : shot === "home" ? 0 : shot === "end" ? seg(t, FILM.endCard + 0.6, beat("tease").t1 - 0.4) : 1;
  const frozen = shot === "front" || shot === "end" ? 1 : 1 - seg(t, beat("normal").t0, beat("normal").t0 + 1.2);   // the hook's sky is full, frozen mid-fall
  rain.set({ fall: home ? 0 : fallAt(t), len: 0.35 + 2.6 * pour, density: Math.max(0.18 + 0.82 * pour, 0.85 * frozen), opacity: ro });

  // where it lands: the squares light from "ocean", 78 chalk, then the 22 hatched
  const k = Math.round(100 * clamp01((t - CUE.ocean + 0.2) / 1.6));
  waffle.set({ opacity: shot === "where" ? E.out3(seg(t, beat("why").t0 + 1.0, beat("why").t0 + 2.0)) : 0, state: { k: Math.max(0, k) } });   // on screen to the cut

  // the layer fills to 2.8 mm on the line; the coins and the mm ruler beside it
  const macro = shot === "macro" || shot === "work";
  const fill = E.inout2(seg(t, CUE.layer[0] + 1.6, CUE.layer[1]));
  layer.set({ opacity: 0 }); coins.set({ opacity: 0 });
  const cardO = shot === "macro" ? 1 : 0;   // gone under the work card and before the push home
  card.set({ opacity: cardO, state: { f: Math.round(fill * 50) / 50, c: Math.round(clamp01((t - CUE.coins + 0.3) / 0.8) * 20) / 20, w: Math.round(t * 8) / 8 } });

  // the takeaway: a thin film round you; the storm column rises beside you on "storm … piles up"
  film.set({ opacity: shot === "home" ? 1 : shot === "end" ? 1 - seg(t, FILM.endCard, FILM.endCard + 1.2) : 0, cam: camera.position.toArray(), at: [0, 0] });
  const sh = E.inout2(seg(t, CUE.storm[0], CUE.storm[1]));
  storm.set({ h: Math.max(1e-5, WD.storm * sh), opacity: sh < 0.01 ? 0 : shot === "home" ? 1 : shot === "end" ? 1 - seg(t, FILM.endCard, FILM.endCard + 1.2) : 0, cam: camera.position.toArray(), at: [-1.1, 0.2] });

  desk.group.visible = !(macro && pose.dist < 0.5);                       // at mm scale the 800-unit floor's depth runs out of precision: the card carries its own paper line
  desk.update({ grid: 1, pool: [pose.target[0], pose.target[2]], casters: [[0, WD.fig, 0, 0.35]] });

  hud.update(t);
  const tail = E.inout2(seg(t, beat("tease").t1 - 0.6, beat("tease").t1));   // the loop: the card lifts over the last 0.6 s
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  const tw = t - (FILM.endCard + 0.5);                                                // the trail walks in, a print every 0.22 s, to the Moon
  prints.forEach((p, i) => p.setAttribute("opacity", String(clamp01((tw - i * 0.22) / 0.2) * (0.5 + i * 0.07))));
  moonG.setAttribute("opacity", String(clamp01((tw - 7 * 0.22) / 0.4)));
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
