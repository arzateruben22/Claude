// One More Orbit S3 scene engine: draws the painted beach, the Moon at its true angular size, the tide, the brightening, the daytime eclipse, the
// break-up, the ring and the loop back to tonight, from a timeline + plates. Pure function of t: window.renderAt(t). Plates are read by file name from art/.
const C = { teal: "#4FE3C6", text: "#EEF0FF", bg: "#0B0F2A" };
const R0KM = 1737.4, D0 = 384400;
const sizeX = (d) => Math.atan(R0KM / d) / Math.atan(R0KM / D0);
const clamp01 = (x) => Math.max(0, Math.min(1, x)), sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;
const rnd = (s) => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let TL, IM = {}, cv, ctx, W, H, MODE, U;
const track = (arr, t) => { if (!arr || !arr.length) return 0; if (t <= arr[0][0]) return arr[0][1]; for (let i = 1; i < arr.length; i++) if (t <= arr[i][0]) { const a = arr[i - 1], b = arr[i]; return b[0] === a[0] ? b[1] : lerp(a[1], b[1], sm((t - a[0]) / (b[0] - a[0]))); } return arr[arr.length - 1][1]; };
// distance: the picture creeps continuously between the narrated values (log-space); the counter holds each spoken value and glides to the next as it is said
function dVis(t) { return dCount(t); }
// chapter 1 beats (found by caption text; only the timelines that carry the opening chapter have them)
function beats() {
  if (TL._b !== undefined) return TL._b; const c = TL.captions, f = (x) => c.find((q) => (q.spoken || q.text).includes(x)), o = f("It only ever goes down"), dr = f("drifting away");
  if (!o || !dr) return (TL._b = null); const ch = c.filter((q) => (q.line || "").startsWith("ch1"));
  const ext = (cap, kind) => { const bt = (TL.beats || []).find((x) => x.kind === kind && cap && x.t0 >= cap.t1 - 0.6 && x.t0 <= cap.t1 + 0.6); return bt ? { ...cap, t1: bt.t1 } : cap; };
  return (TL._b = { start: Math.min(...ch.map((q) => q.t0)), calm: f("The sea is calm") || dr, drift: dr, size: f("half a degree wide") || f("About the same size"), sun: ext(f("About the same size as the Sun"), "sun"), light: f("Its light takes"), mlight: ext(f("Moonlight is just sunlight"), "sunbeam"), only: o, end: Math.max(...ch.map((q) => q.t1)) });
}
function dCount(t) { const d = dCount0(t), b = beats(); if (!b || t < b.only.t0) return d; const tick = sm((t - b.only.t0) / 5.0), gp = clamp01((Math.log(D0) - Math.log(d)) / (Math.log(D0) - Math.log(288300))); return d * (1 - 0.0086 * tick * (1 - gp)); }
function dCount0(t) { const k = TL.km; if (t <= k[0][0]) return k[0][1]; for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const a = k[i - 1], b = k[i]; if (a[1] === b[1]) return a[1]; const g0 = Math.max(a[0], b[0] - (b[2] || 8.0)); return t < g0 ? a[1] : Math.exp(lerp(Math.log(a[1]), Math.log(b[1]), sm((t - g0) / (b[0] - g0)))); } return k[k.length - 1][1]; }
function geom() {
  if (MODE === "land") return { r0: 69 / 941 * H, cx0: 0.68 * W, cy0: 312 / 941 * H, cx1: 0.553 * W, yb1: 0.774 * H, horizon: 0.715 * H, shore: 0.80 * H, plate: "beach-clean", flood: "flood-clean" };
  return { r0: 73, cx0: 0.62 * W, cy0: 807, cx1: 0.553 * W, yb1: 1450, horizon: 1414, shore: 1535, plate: "beach-clean-9x16", flood: "flood-clean-9x16" };
}
function camT(cam, ox, oy) { ctx.translate(W / 2 + ox, H * 0.72 + oy); ctx.scale(cam, cam); ctx.translate(-W / 2, -H * 0.72); }
function drawPlateWaves(img, a, t, G, cam, ox, oy) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2 + ox, H * 0.72 + oy); ctx.scale(cam, cam); ctx.translate(-W / 2, -H * 0.72);
  const hz = Math.floor(G.horizon), sh = img.height / H, STEP = Math.max(3, Math.round(4 * U));
  ctx.drawImage(img, 0, 0, img.width, hz * sh, 0, 0, W, hz);                                  // sky and headland: still
  ctx.drawImage(img, 0, hz * sh, img.width, img.height - hz * sh, 0, hz, W, H - hz);          // still sea under the moving strips (no gap at the edges)
  for (let y = hz; y < H; y += STEP) { const f = (y - hz) / (H - hz), amp = (2.5 + 27 * f) * U * (1 + 0.7 * swayAmp(t)), dx = amp * Math.sin(y / (26 * U) * (1 + f) - t * (0.9 + 0.6 * f)) + 0.45 * amp * Math.sin(y / (9 * U) + t * 1.7); ctx.drawImage(img, 0, y * sh, img.width, STEP * sh, dx, y, W, STEP + 0.6); }
  ctx.restore();
}
function drawPlateWavesNoState(img, t, G) { const hz = Math.floor(G.horizon), sh = img.height / H, STEP = Math.max(3, Math.round(4 * U)); ctx.drawImage(img, 0, hz * sh, img.width, img.height - hz * sh, 0, hz, W, H - hz); for (let y = hz; y < H; y += STEP) { const f = (y - hz) / (H - hz), amp = (3 + 30 * f) * U, dx = amp * Math.sin(y / (24 * U) * (1 + f) - t * (1.0 + 0.6 * f)) + 0.45 * amp * Math.sin(y / (8 * U) + t * 1.9); ctx.drawImage(img, 0, y * sh, img.width, STEP * sh, dx, y, W, STEP + 0.6); } }
function drawPlate(img, a, scale = 1, ox = 0, oy = 0) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2 + ox, H * 0.72 + oy); ctx.scale(scale, scale); ctx.translate(-W / 2, -H * 0.72); ctx.drawImage(img, 0, 0, W, H); ctx.restore(); }
function moonState(d, G) { const m = sizeX(d), r = G.r0 * m, u = sm((m - 1) / 8.5), yb = lerp(G.cy0 + G.r0, G.yb1, u), cx = lerp(G.cx0, G.cx1, sm((m - 1) / 6)); return { m, r, cx, cy: yb - r }; }
function sceneComposite(t, d, ecl, moonAlpha, G) {
  const cam = 1.06 + 0.026 * Math.sin(t * 0.37) + 0.02 * (t / (TL.dur || 1)), ox = 12 * U * Math.sin(t * 0.43), oy = 9 * U * Math.sin(t * 0.31 + 1);   // overscan (>= 2.9%) is always larger than the largest pan, so the painting's edge never shows
  const tide = clamp01(Math.log10(Math.pow(D0 / d, 3)) / Math.log10(900) + tideBoost(t)) * moonAlpha, lightx = 1 + (Math.pow(D0 / d, 2) - 1) * moonAlpha, mo = moonState(d, G); mo.cx += slideOff(t);
  ctx.save(); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  drawPlateWaves(IM[G.plate], 1, lapse(t), G, cam, ox, oy);
  // stars twinkle in the plate's sky (a few more than the painting has)
  const sr = rnd(5); ctx.save(); for (let i = 0; i < 160; i++) { const x = sr() * W, y = sr() * G.horizon * 0.85, p = sr() * 6.28, s = (0.8 + sr() * 1.8) * U; ctx.globalAlpha = (0.12 + 0.7 * (0.5 + 0.5 * Math.sin(t * (1.2 + 2 * sr()) + p))) * (1 - ecl * 0.3); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, s, 0, 6.283); ctx.fill(); } ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "screen"; const cr = rnd(21); for (let i = 0; i < 5; i++) { const y = (0.12 + 0.5 * cr()) * G.horizon, sp = (12 + 20 * cr()) * U, x = (((cr() * (W + 1200 * U) - t * sp) % (W + 1200 * U)) + (W + 1200 * U)) % (W + 1200 * U) - 600 * U, wd = (500 + 500 * cr()) * U;
    ctx.save(); ctx.filter = `blur(${30 * U}px)`; const g = ctx.createRadialGradient(x, y, 0, x, y, wd); g.addColorStop(0, `rgba(120,140,210,${0.13 + 0.12 * swayAmp(t)})`); g.addColorStop(1, "rgba(120,140,210,0)"); ctx.translate(x, y); ctx.scale(1, 0.22); ctx.translate(-x, -y); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, wd, 0, 6.283); ctx.fill(); ctx.restore(); } ctx.restore();
  // the sky: brighter as the Moon comes in (inverse square), and the dim 'noon' of the eclipse
  const skyLift = clamp01(0.11 * Math.log2(lightx) + 0.10 * flareBoost(t)), sky = ctx.createLinearGradient(0, 0, 0, G.horizon);
  ctx.save(); ctx.globalCompositeOperation = "screen"; sky.addColorStop(0, `rgba(40,70,120,${skyLift * 0.55})`); sky.addColorStop(1, `rgba(110,140,190,${skyLift * 0.85})`); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, G.horizon + 2); ctx.restore();
  if (ecl > 0) { const g = ctx.createLinearGradient(0, 0, 0, G.horizon); g.addColorStop(0, `rgba(26,52,104,${0.55 * ecl})`); g.addColorStop(1, `rgba(120,98,150,${0.65 * ecl})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, G.horizon + 2); }
  // the Moon: lit disc (fades as the eclipse darkens it) and the corona around the dark disc
  if (moonAlpha > 0.002) {
    const x = mo.cx + (ecl > 0 ? 0 : 0), y = mo.cy, r = mo.r;
    ctx.save(); ctx.globalAlpha = moonAlpha * (1 - ecl); const gl = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.7); gl.addColorStop(0, "rgba(170,225,225,.28)"); gl.addColorStop(1, "rgba(170,225,225,0)"); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, 6.283); ctx.fill(); { const sa = swayAmp(t), rot = sa * (0.035 * Math.sin(t * 0.23) + 0.014 * Math.sin(t * 0.61 + 1)); ctx.translate(x, y); ctx.rotate(rot); ctx.translate(-x, -y); } ctx.drawImage(r > 900 ? IM["moon-disc-hi"] : IM["moon-disc"], x - r, y - r, 2 * r, 2 * r); ctx.restore();
    if (ecl > 0) { ctx.save(); ctx.globalAlpha = moonAlpha * ecl; const cs = r / 512; ctx.drawImage(IM[MODE === "land" ? "eclipse" : "eclipse-9x16"], x - 1024 * cs, y - 1024 * cs, 2048 * cs, 2048 * cs); ctx.fillStyle = "#06080f"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.restore(); }
  }
  // the tide: the sea over the sand, the waterline climbing the beach in long swells
  if (tide > 0.01) {
    const yTop = lerp(G.shore - 10 * U, H + 40 * U, tide), amp = (10 + 22 * tide) * U; ctx.save(); ctx.beginPath(); ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 20) { const w = Math.sin(x / (230 * U) + t * 0.9) * amp * 0.5 + Math.sin(x / (97 * U) - t * 1.4) * amp * 0.25 + (1 - x / W) * 60 * U * (1 - tide); ctx.lineTo(x, yTop + w); }
    ctx.lineTo(W + 10, H + 10); ctx.closePath(); ctx.clip(); camT(cam, ox, oy); drawPlateWavesNoState(IM[G.flood], lapse(t), G); ctx.restore();
    ctx.save(); ctx.strokeStyle = "rgba(200,240,240,.55)"; ctx.lineWidth = 4 * U; ctx.beginPath(); for (let x = -10; x <= W + 10; x += 20) { const w = Math.sin(x / (230 * U) + t * 0.9) * amp * 0.5 + Math.sin(x / (97 * U) - t * 1.4) * amp * 0.25 + (1 - x / W) * 60 * U * (1 - tide); x === -10 ? ctx.moveTo(x, yTop + w) : ctx.lineTo(x, yTop + w); } ctx.stroke(); ctx.restore();
  }
  ctx.save(); camT(cam, ox, oy); ctx.drawImage(IM[MODE === "land" ? "figure-layer" : "figure-layer-9x16"], 0, 0, W, H); ctx.restore();   // the small figure stays upright on top of the moving sea
  // moonlight on the water: the silver road, wider and brighter as the light grows; the wet sand and the headland lit
  const bright = Math.max(clamp01(0.13 * Math.log2(lightx)), 0.07), roadW = Math.min(W * 0.5, mo.r * 0.9 + 90 * U);
  if (bright > 0.01 && moonAlpha > 0.01) {
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.filter = `blur(${22 * U}px)`; const rg = ctx.createLinearGradient(0, G.horizon, 0, H); rg.addColorStop(0, `rgba(170,235,230,${0.6 * bright * moonAlpha})`); rg.addColorStop(1, `rgba(90,170,190,${0.25 * bright * moonAlpha})`);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(mo.cx - roadW * 0.12, G.horizon); ctx.lineTo(mo.cx + roadW * 0.12, G.horizon); ctx.lineTo(mo.cx + roadW * 0.5 + 40 * Math.sin(t * 0.8), H); ctx.lineTo(mo.cx - roadW * 0.5 + 40 * Math.sin(t * 0.8), H); ctx.fill(); ctx.filter = "none";
    for (let i = 0; i < 26; i++) { const yy = G.horizon + (i + 1) / 26 * (H - G.horizon), ww = roadW * (0.1 + 0.4 * (i / 26)) * (0.7 + 0.3 * Math.sin(t * 2 + i)); ctx.fillStyle = `rgba(230,255,250,${0.14 * bright * moonAlpha})`; ctx.fillRect(mo.cx - ww / 2 + 30 * Math.sin(t * 0.8 + i), yy, ww, 3 * U); }
    const fill = ctx.createLinearGradient(0, G.horizon, 0, H); fill.addColorStop(0, `rgba(60,100,130,${0.16 * bright * moonAlpha})`); fill.addColorStop(1, `rgba(120,160,175,${0.30 * bright * moonAlpha})`); ctx.fillStyle = fill; ctx.fillRect(0, G.horizon, W, H - G.horizon); ctx.restore();
  }
  ctx.restore();
}


// the global view: slow sway and the beat shake, with an overscan (scale) that always exceeds the largest displacement + 0.6%, so the painting's edge never shows
function viewShift(t) {
  const A = swayAmp(t), SH = shakeAmp(t); if (A < 0.001 && SH < 0.001) return { on: false, dx: 0, dy: 0, sc: 1 };
  const dx = 16 * U * A * Math.sin(t * 0.55) + 9 * U * SH * Math.sin(t * 43), dy = 8 * U * A * Math.sin(t * 0.4) + 6 * U * SH * Math.sin(t * 57 + 1);
  const mx = 16 * U * A + 9 * U * SH + 0.006 * W, my = 8 * U * A + 6 * U * SH + 0.006 * H, sc = 1 + Math.max(2 * mx / W, 2 * my / H);
  return { on: true, dx, dy, sc };
}

// time-lapse: during a 'climb' beat the sea's own motion runs 6x faster (the phase stays continuous afterwards)
function lapse(t) { let e = 0; for (const b of (TL.beats || [])) if (b.kind === "climb") e += 5 * Math.max(0, Math.min(t, b.t1) - b.t0); return t + e; }
function zoomParams(t, G) {   // the camera at time t: a zoom of s about the world point F, anchored at screen point (tx, ty); null = identity
  const b = beats(), inCh1 = b && t >= b.start - 0.01 && t <= b.end + 2.5; let z = null;
  if (inCh1) { const mo0 = moonState(384400, G), zs = zoomState(t, b, mo0); z = { s: zs.s, F: zs.F, k: zs.k }; } else { const mv = movesState(t, G); if (mv) z = mv; }
  if (!z) return null; let tx = lerp(z.F.x, W * 0.54, z.k), ty = lerp(z.F.y, H * 0.46, z.k);
  tx = Math.max(W - (W - z.F.x) * z.s, Math.min(z.F.x * z.s, tx)); ty = Math.max(H - (H - z.F.y) * z.s, Math.min(z.F.y * z.s, ty));   // never show past the painting
  return { tx, ty, s: z.s, Fx: z.F.x, Fy: z.F.y };
}
function moonScreen(t) {   // where the Moon is on the screen at time t (centre and radius in canvas px), through the shake, the sway and the camera
  const G = geom(), mo = moonState(Math.max(dVis(t), 17000), G); mo.cx += slideOff(t); let x = mo.cx, y = mo.cy, r = mo.r; const zp = zoomParams(t, G);
  if (zp) { x = zp.tx + (x - zp.Fx) * zp.s; y = zp.ty + (y - zp.Fy) * zp.s; r *= zp.s; }
  const v = viewShift(t); if (v.on) { x = W / 2 + v.dx + (x - W / 2) * v.sc; y = H / 2 + v.dy + (y - H / 2) * v.sc; r *= v.sc; }
  return { x, y, r, vis: track(TL.tracks.moon, t) };
}
// the caption pill keeps clear of the Moon: the first slot whose rectangle misses the Moon (plus a margin) at the start, middle and end of the line
function placeCaption(cap, el, t) {
  const b = beats(), land = MODE === "land", w = el.offsetWidth, h = el.offsetHeight;
  const first = land ? (b && t < b.end + 0.5 ? [250, 84, 440, 600] : [84, 250, 440, 600]) : (TL.chips ? [450, 1180, 1000, 640, 1290] : [390, 1180, 1000, 640, 1290]);
  const extra = land ? [120, 340, 520, 700] : [440, 520, 760, 880, 1100, 1380, 1480, 1560];
  const cs = [cap.t0, (cap.t0 + cap.t1) / 2, cap.t1 - 0.05].map(moonScreen).filter((m) => m.vis > 0.3);
  const clearance = (v) => { const px = v * U, x0 = (W - w) / 2, x1 = (W + w) / 2, y0 = land ? H - px - h : px, y1 = y0 + h;
    return cs.length ? Math.min(...cs.map((m) => { const nx = Math.max(x0, Math.min(m.x, x1)), ny = Math.max(y0, Math.min(m.y, y1)); return Math.hypot(m.x - nx, m.y - ny) - m.r * 1.12 - 20 * U; })) : 1e9; };
  let pick = first.find((v) => clearance(v) > 0);
  if (pick === undefined) pick = first.concat(extra).reduce((best, v) => (clearance(v) > clearance(best) ? v : best), first[0]);   // the Moon fills the frame: the slot that overlaps it least
  if (land) { el.style.bottom = `calc(${pick} * var(--u))`; } else { el.style.top = `calc(${pick} * var(--u))`; }
}

// small comparison chips at each stop ("2x wider", "8x pull"): timeline.chips [{t0, t1, text}]
function chips(t) { const c = (TL.chips || []).find((q) => t >= q.t0 && t < q.t1), el = document.getElementById("chip"); if (!el) return; if (c) { el.textContent = c.text; el.style.opacity = Math.min(1, (t - c.t0) / 0.25, (c.t1 - t) / 0.25); } else el.style.opacity = 0; }
function hud(t) {
  const d = dCount(t), s = sizeX(dVis(t)), fmt = (n) => Math.round(n).toLocaleString("en-US");
  document.getElementById("num").textContent = fmt(d) + " km"; document.getElementById("size").textContent = "size in the sky ×" + (s < 9.95 ? s.toFixed(1) : Math.round(s));
  chips(t); const cap = TL.captions.find((c) => t >= c.t0 && t < c.t1), el = document.getElementById("cap");
  if (cap) { el.textContent = cap.text; el.style.opacity = 1; placeCaption(cap, el, t); } else el.style.opacity = 0;
}
window.setup = async (tl, assets, mode, w, h) => {
  TL = tl; MODE = mode; W = w; H = h; U = mode === "land" ? H / 1080 : W / 1080; cv = document.getElementById("c"); cv.width = W; cv.height = H; ctx = cv.getContext("2d");
  await Promise.all(Object.entries(assets).map(([k, src]) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IM[k] = i; res(); }; i.onerror = () => rej(new Error("asset " + k)); i.src = src; })));
  await document.fonts.ready; document.documentElement.style.setProperty("--u", U + "px");
};
// extra life for the long film's still stretches (the hold in chapter 1 and everything from the break-up on): a slow camera sway, the Moon's libration, drifting dust.
// Gated by time so the segments rendered separately join without a pop (it is 0 at 345.1 s).
const holdAmp = (t) => { const b = beats(); return (b && t > b.calm.t1 + 1 && t < b.size.t0 - 0.2) ? sm((t - b.calm.t1 - 1) / 2) * sm((b.size.t0 - 0.2 - t) / 1) : 0; };
const swayAmp = (t) => (MODE !== "land" || TL.dur < 300) ? (/^part[4-8]/.test(TL.name || "") ? sm((t - 0.5) / 1.5) : holdAmp(t)) : Math.max(sm((t - 346) / 4), holdAmp(t));
const figPos = () => (MODE === "land" ? { x: 0.342 * W, y: 0.831 * H } : { x: 0.38 * W, y: 0.81 * H });

// camera beats for parts 2-8: 2-3 moves tied to the part's idea (keyed by caption text); each key eases the zoom to s about a pivot (the Moon, the figure or the sea)
const MOVES = {
  2: [["The Moon looks one and a third", 0, 1.55, "moon"], ["Its light now takes", -0.3, 1.0, "moon"], ["The Moon's pull on the Earth", 0, 1.3, "sea"], ["Today, the Sun pulls", 0, 1.0, "sea"]],
  3: [["The Moon now looks twice", 0, 1.45, "moon"], ["Tides come from the difference", -0.2, 1.0, "moon"], ["the water at your feet", 0, 1.45, "sea"], ["Imagine the foam line", 0, 1.8, "fig"], ["The Moon is no longer", -0.3, 1.0, "fig"]],
  4: [["The beach is brighter", 0, 1.25, "sea"], ["about six and a half", -2.5, 1.5, "moon"], ["Your shadow on the sand", 0, 1.6, "fig"], ["The water has a silver road", 0, 1.15, "sea"], ["Night is not as dark", -0.3, 1.0, "sea"]],
  5: [["The Moon is nearly four", 0, 1.3, "moon"], ["The Sun and the Moon look", 0, 1.0, "moon"], ["The sky goes dim", -0.3, 1.5, "moon"], ["A long dark noon", 0, 1.5, "moon"], ["And then you look", -0.3, 1.0, "moon"]],
  6: [["The solid Earth already", -0.5, 1.5, "fig"], ["With far more pull", 0, 1.6, "fig"], ["In real life, tides", -0.3, 1.0, "fig"]],
  7: [["The Moon is nearly eight", 0, 1.3, "moon"], ["One lap now takes", 0, 1.0, "moon"], ["Watch the number", 0, 1.6, "moon"], ["Then it begins to slide", -0.3, 1.25, "moon"], ["The Moon rises in the west", 0, 1.0, "moon"]],
  8: [["At eighteen thousand", 0, 1.3, "moon"], ["It is a wall of grey", 0, 1.15, "moon"], ["The tide is enormous", 0, 1.3, "sea"], ["And then the Moon does", -0.3, 1.0, "sea"]],
};

// picture-led beats (timeline.beats: [{t0, t1, kind}]): a silent stretch where the idea plays out on the painting
const BK = { climb: ["fig", 1.55],  approach: ["moon", 1.35], grow: ["moon", 1.5], tide: ["fig", 1.6], pull: ["moon", 1.2], bright: ["moon", 1.35], eclipse: ["moon", 1.5], flex: ["fig", 1.7], rise: ["moon", 1.25], slide: ["moon", 1.3], strain: ["moon", 1.15], stretch: ["moon", 1.0], band: ["moon", 1.0], ring: ["fig", 1.0], drift: ["moon", 1.0], sun: ["moon", 1.0], sunbeam: ["moon", 1.0], tick: ["moon", 1.0] };
const beatPhase = (t, kind, tail) => { let v = 0; for (const b of (TL.beats || [])) if (b.kind === kind) { if (t >= b.t0 && t < b.t1) v = Math.max(v, sm((t - b.t0) / (b.t1 - b.t0))); else if (t >= b.t1 && t < b.t1 + tail) v = Math.max(v, 1 - sm((t - b.t1) / tail)); } return v; };
const tideBoost = (t) => 0.13 * beatPhase(t, "tide", 2.5) + 0.28 * beatPhase(t, "climb", 6.0);
const flareBoost = (t) => beatPhase(t, "bright", 2.0);
const slideOff = (t) => -0.30 * W * beatPhase(t, "slide", 3.0);
const shakeAmp = (t) => Math.max(beatPhase(t, "flex", 0.8), 0.45 * beatPhase(t, "strain", 0.8));
function beatKeys() {
  if (TL._bk !== undefined) return TL._bk; const bs = TL.beats || []; if (!bs.length) return (TL._bk = null); const keys = [];
  for (const b of bs) { const [pv, sc] = BK[b.kind] || ["moon", 1.0]; if (sc <= 1.0) continue; keys.push({ t: b.t0 - 0.1, s: sc, pv });
    if (b.kind === "climb") keys.push({ t: b.t0 + 0.62 * (b.t1 - b.t0), s: 1.25, pv: "moon" });   // the camera tilts up as the Moon fills the sky
    keys.push({ t: b.t1 + 0.2, s: 1.0, pv: b.kind === "climb" ? "moon" : pv }); }
  keys.sort((a, c) => a.t - c.t); return (TL._bk = keys.length ? keys : null);
}
function partKeys() {
  if (TL._pk !== undefined) return TL._pk; const bk = beatKeys(); if (bk) return (TL._pk = bk); const m = /^part(\d)/.exec(TL.name || ""); const n = m ? Number(m[1]) : 0; if (n < 2 || !MOVES[n]) return (TL._pk = null);
  const keys = []; for (const [txt, off, sc, pv] of MOVES[n]) { const c = TL.captions.find((q) => (q.spoken || q.text).includes(txt)); if (c) keys.push({ t: c.t0 + off, s: sc, pv }); }
  return (TL._pk = keys.length ? keys : null);
}
function pivotOf(pv, t, G) { if (pv === "fig") return { F: figPos(), k: 0 }; if (pv === "sea") return { F: { x: W * 0.5, y: G.horizon + 0.2 * (H - G.horizon) }, k: 0 }; const mo = moonState(Math.max(dVis(t), 17000), G); return { F: { x: mo.cx, y: mo.cy }, k: 0.9 }; }
function movesState(t, G) {
  const ks = partKeys(); if (!ks) return null; let i = -1; for (let j = 0; j < ks.length; j++) if (t >= ks[j].t) i = j;
  if (i < 0) { const P = pivotOf(ks[0].pv, t, G); return { s: 1, F: P.F, k: P.k }; }
  const k = ks[i], p = i > 0 ? ks[i - 1] : { s: 1, pv: k.pv }, u = sm((t - k.t) / (k.s === 1.0 ? 1.8 : 1.4)), A = pivotOf(p.pv, t, G), B = pivotOf(k.pv, t, G);
  const dr = (q) => (q.s > 1.0 && q.t !== undefined ? 1 + 0.07 * sm((t - q.t - 1.2) / 4.5) : 1);   // the push keeps creeping in after it lands, so a held beat never sits still
  return { s: lerp(p.s * dr(p), k.s * dr(k), u), F: { x: lerp(A.F.x, B.F.x, u), y: lerp(A.F.y, B.F.y, u) }, k: lerp(A.k, B.k, u) };
}
function zoomState(t, b, mo) {   // {s, F (world pivot), k (0 = pivot stays put, 1 = pivot goes to the screen anchor)}
  const fg = figPos(), mp = { x: mo.cx, y: mo.cy }, e = (a, c, u) => lerp(a, c, sm(u));
  const A = b.start, calm = b.calm, lt = b.light.t0, sz = b.size.t0;
  if (t < calm.t0) return { s: MODE === "land" ? 1.3 : 1.15, F: fg, k: 0 };
  const tr = calm.t0 + Math.max(1.5, calm.t1 - calm.t0 + 0.6);
  if (t < tr) { const u = (t - calm.t0) / (tr - calm.t0); return { s: e(MODE === "land" ? 1.3 : 1.15, 1.3, u), F: { x: e(fg.x, mp.x, u), y: e(fg.y, mp.y, u) }, k: sm(u) }; }
  if (t < sz - 0.1) return { s: 1.3 + 0.2 * clamp01((t - tr) / Math.max(1, sz - 0.1 - tr)), F: mp, k: 1 };      // a slow push toward the Moon while the ruler ticks
  if (t < sz + 1.4) { const u = (t - (sz - 0.1)) / 1.5; return { s: e(1.5, 2.3, u), F: mp, k: 1 }; }
  if (t < lt - 0.3) return { s: 2.3 + 0.16 * sm((t - (sz + 1.4)) / Math.max(1, lt - 0.3 - sz - 1.4)), F: mp, k: 1 };
  if (t < lt + 1.7) { const u = (t - (lt - 0.3)) / 2.0; return { s: e(2.46, 1.0, u), F: mp, k: 1 - sm(u) }; }
  return { s: 1.0, F: mp, k: 0 };
}
function ch1Overlays(t, b, mo, G) {
  const r = mo.r, X = mo.cx, Y = mo.cy, fg = figPos(), pr = (a, c, x) => clamp01((x - a) / (c - a));
  ctx.save(); ctx.globalCompositeOperation = "screen";
  // drifting away: a small ruler under the Moon, a tick sliding along it
  const rd0 = b.drift.t0, rd1 = b.size.t0 - 0.1;
  if (t > rd0 && t < rd1) { const a = Math.min(sm((t - rd0) / 0.6), 1 - sm((t - (rd1 - 0.6)) / 0.6)), L = 3.6 * r, x0 = X - L / 2, y0 = Y + r * 1.9, u = (t - rd0) / (rd1 - rd0); ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = "#B7BEEA"; ctx.lineWidth = 2 * U;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + L, y0); for (let i = 0; i <= 12; i++) { const xx = x0 + L * i / 12; ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 + (i % 4 === 0 ? 14 : 8) * U); } ctx.stroke();
    const mx = x0 + L * (0.12 + 0.76 * sm(u)); ctx.fillStyle = C.teal; ctx.beginPath(); ctx.moveTo(mx, y0 - 3 * U); ctx.lineTo(mx - 9 * U, y0 - 20 * U); ctx.lineTo(mx + 9 * U, y0 - 20 * U); ctx.fill(); }
  // the Sun's disc, the same size, slides over the Moon's for a second
  if (b.sun) { const s0 = b.sun.t0 + 0.2, s1 = b.sun.t1 + 0.2, u = (t - s0) / (s1 - s0); if (u > 0 && u < 1) { const off = u < 0.35 ? -4.2 * r * (1 - sm(u / 0.35)) : u > 0.65 ? 4.2 * r * sm((u - 0.65) / 0.35) : 0, a = 0.8 * Math.min(sm(u / 0.2), 1 - sm((u - 0.85) / 0.15)), x = X + off;
    ctx.globalAlpha = a; const g = ctx.createRadialGradient(x, Y, r * 0.2, x, Y, r * 1.5); g.addColorStop(0, "rgba(255,232,170,.95)"); g.addColorStop(0.62, "rgba(255,206,120,.75)"); g.addColorStop(1, "rgba(255,190,100,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, Y, r * 1.5, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "rgba(255,236,190,.95)"; ctx.lineWidth = 3 * U; ctx.beginPath(); ctx.arc(x, Y, r, 0, 6.283); ctx.stroke(); } }
  // light takes a second and a quarter: a pulse travels from the Moon to the beach
  const p0 = b.light.t0 + 0.7, u = (t - p0) / 1.28; if (u > 0 && u < 1.15) { const q = Math.min(u, 1), hx = fg.x, hy = fg.y - 0.03 * H, px = lerp(X, hx, q), py = lerp(Y + r, hy, q);
    ctx.globalAlpha = 0.5 * (1 - sm((u - 1) / 0.15)); ctx.strokeStyle = "rgba(180,240,235,.8)"; ctx.lineWidth = 2 * U; ctx.beginPath(); ctx.moveTo(X, Y + r); ctx.lineTo(px, py); ctx.stroke();
    ctx.globalAlpha = 1 - sm((u - 1) / 0.15); const g = ctx.createRadialGradient(px, py, 0, px, py, 26 * U); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(160,240,235,.8)"); g.addColorStop(1, "rgba(160,240,235,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 26 * U, 0, 6.283); ctx.fill(); }
  // moonlight is sunlight bounced off grey rock: a beam comes in from the Sun's side, hits the Moon and bends down onto the water
  const m0 = b.mlight.t0, m1 = b.mlight.t1 + 0.3, mu = (t - m0) / (m1 - m0); if (mu > 0 && mu < 1) {
    const a = Math.min(sm(mu / 0.15), 1 - sm((mu - 0.8) / 0.2)), sx = -0.1 * W, sy = 0.30 * H, hx = X - r * 0.78, hy = Y - r * 0.55, wx = X + (MODE === "land" ? 0 : -0.03 * W), wy = G.horizon + 0.07 * (H - G.horizon), l1 = sm(mu / 0.4), l2 = sm((mu - 0.35) / 0.35);
    ctx.filter = `blur(${3 * U}px)`; ctx.globalAlpha = a; ctx.lineWidth = 6 * U; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,225,160,.85)"; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lerp(sx, hx, l1), lerp(sy, hy, l1)); ctx.stroke();
    if (l2 > 0) { ctx.strokeStyle = "rgba(170,240,235,.85)"; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lerp(hx, wx, l2), lerp(hy, wy, l2)); ctx.stroke(); } ctx.filter = "none"; }
  ctx.restore();
}
window.renderAt = (t) => {
  const G = geom(), ecl = track(TL.tracks.eclipse, t), moonA = track(TL.tracks.moon, t), brk = track(TL.tracks.brk, t), ring = track(TL.tracks.ring, t), tn = track(TL.tracks.tonight, t), d = dVis(t);
  const A = swayAmp(t), SH = shakeAmp(t); ctx.save(); { const v = viewShift(t); if (v.on) { ctx.translate(W / 2 + v.dx, H / 2 + v.dy); ctx.scale(v.sc, v.sc); ctx.translate(-W / 2, -H / 2); } }
  const b = beats(), inCh1 = b && t >= b.start - 0.01 && t <= b.end + 2.5; ctx.save();
  const zp = zoomParams(t, G); if (zp) { ctx.translate(zp.tx, zp.ty); ctx.scale(zp.s, zp.s); ctx.translate(-zp.Fx, -zp.Fy); }
  sceneComposite(t, Math.max(d, 17000), ecl, moonA, G);
  if (inCh1) ch1Overlays(t, b, moonState(384400, G), G);
  ctx.restore();
  if (brk > 0.001) { ctx.save(); ctx.globalAlpha = brk; const sc = 1.02 + 0.03 * (t / TL.dur) + 0.01 * Math.sin(t * 0.3) + 0.018 * A * Math.sin(t * 0.45); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2); ctx.drawImage(IM["plate-breakup"], 0, 0, W, H); ctx.restore(); }
  if (ring > 0.001) { ctx.save(); ctx.globalAlpha = ring; ctx.translate(W / 2, H / 2); ctx.scale(1 + 0.02 * A * Math.sin(t * 0.4), 1 + 0.02 * A * Math.sin(t * 0.4)); ctx.translate(-W / 2, -H / 2); ctx.drawImage(IM["plate-ring"], 0, 0, W, H); ctx.restore(); }
  if (tn > 0.001) { ctx.save(); ctx.globalAlpha = tn; ctx.drawImage(IM["plate-tonight"], 0, 0, W, H); ctx.restore(); }
  if (A > 0.01 && (brk + ring + tn > 0.01)) { const mr = rnd(77); ctx.save(); ctx.globalCompositeOperation = "screen"; for (let i = 0; i < 70; i++) { const sp = (6 + 20 * mr()) * U, x = (((mr() * W - t * sp * (mr() > 0.5 ? 1 : -1)) % W) + W) % W, y = (((mr() * H - t * sp * 0.4) % H) + H) % H, rr = (1 + 2.4 * mr()) * U; ctx.globalAlpha = A * (0.15 + 0.35 * mr()) * (0.6 + 0.4 * Math.sin(t * 1.5 + i)); ctx.fillStyle = "#cfe9ff"; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill(); } ctx.restore(); }
  ctx.restore();
  hud(t);
};
