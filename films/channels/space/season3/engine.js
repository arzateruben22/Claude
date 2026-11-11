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
  if (TL._b !== undefined) return TL._b; const c = TL.captions, f = (x) => c.find((q) => q.text.includes(x)), o = f("It only ever goes down"), dr = f("drifting away");
  if (!o || !dr) return (TL._b = null); const ch = c.filter((q) => (q.line || "").startsWith("ch1"));
  return (TL._b = { start: Math.min(...ch.map((q) => q.t0)), calm: f("The sea is calm") || dr, drift: dr, size: f("half a degree wide") || f("About the same size"), sun: f("About the same size as the Sun"), light: f("Its light takes"), mlight: f("Moonlight is just sunlight"), only: o, end: Math.max(...ch.map((q) => q.t1)) });
}
function dCount(t) { const d = dCount0(t), b = beats(); if (!b || t < b.only.t0) return d; const tick = sm((t - b.only.t0) / 5.0), gp = clamp01((Math.log(D0) - Math.log(d)) / (Math.log(D0) - Math.log(288300))); return d * (1 - 0.0086 * tick * (1 - gp)); }
function dCount0(t) { const k = TL.km; if (t <= k[0][0]) return k[0][1]; for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const a = k[i - 1], b = k[i]; if (a[1] === b[1]) return a[1]; const g0 = Math.max(a[0], b[0] - 8.0); return t < g0 ? a[1] : Math.exp(lerp(Math.log(a[1]), Math.log(b[1]), sm((t - g0) / (b[0] - g0)))); } return k[k.length - 1][1]; }
function geom() {
  if (MODE === "land") return { r0: 69 / 941 * H, cx0: 0.68 * W, cy0: 312 / 941 * H, cx1: 0.5 * W, yb1: 0.67 * H, horizon: 0.715 * H, shore: 0.80 * H, plate: "plate-beach", flood: "plate-flood" };
  return { r0: 73, cx0: 0.62 * W, cy0: 807, cx1: 0.5 * W, yb1: 1180, horizon: 1190, shore: 1190 + 0.115 * 1000 * 1.0 + 60, plate: "plate-beach-9x16", flood: "plate-flood-9x16" };
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
  const cam = 1.02 + 0.026 * Math.sin(t * 0.37) + 0.02 * (t / (TL.dur || 1)), ox = 26 * U * Math.sin(t * 0.43), oy = 12 * U * Math.sin(t * 0.31 + 1);
  const tide = clamp01(Math.log10(Math.pow(D0 / d, 3)) / Math.log10(900)) * moonAlpha, lightx = 1 + (Math.pow(D0 / d, 2) - 1) * moonAlpha, mo = moonState(d, G);
  ctx.save(); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  drawPlateWaves(IM[G.plate], 1, t, G, cam, ox, oy);
  // stars twinkle in the plate's sky (a few more than the painting has)
  const sr = rnd(5); ctx.save(); for (let i = 0; i < 160; i++) { const x = sr() * W, y = sr() * G.horizon * 0.85, p = sr() * 6.28, s = (0.8 + sr() * 1.8) * U; ctx.globalAlpha = (0.12 + 0.7 * (0.5 + 0.5 * Math.sin(t * (1.2 + 2 * sr()) + p))) * (1 - ecl * 0.3); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, s, 0, 6.283); ctx.fill(); } ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "screen"; const cr = rnd(21); for (let i = 0; i < 5; i++) { const y = (0.12 + 0.5 * cr()) * G.horizon, sp = (12 + 20 * cr()) * U, x = (((cr() * (W + 1200 * U) - t * sp) % (W + 1200 * U)) + (W + 1200 * U)) % (W + 1200 * U) - 600 * U, wd = (500 + 500 * cr()) * U;
    ctx.save(); ctx.filter = `blur(${30 * U}px)`; const g = ctx.createRadialGradient(x, y, 0, x, y, wd); g.addColorStop(0, `rgba(120,140,210,${0.13 + 0.12 * swayAmp(t)})`); g.addColorStop(1, "rgba(120,140,210,0)"); ctx.translate(x, y); ctx.scale(1, 0.22); ctx.translate(-x, -y); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, wd, 0, 6.283); ctx.fill(); ctx.restore(); } ctx.restore();
  // the sky: brighter as the Moon comes in (inverse square), and the dim 'noon' of the eclipse
  const skyLift = clamp01(0.11 * Math.log2(lightx)), sky = ctx.createLinearGradient(0, 0, 0, G.horizon);
  ctx.save(); ctx.globalCompositeOperation = "screen"; sky.addColorStop(0, `rgba(40,70,120,${skyLift * 0.55})`); sky.addColorStop(1, `rgba(110,140,190,${skyLift * 0.85})`); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, G.horizon + 2); ctx.restore();
  if (ecl > 0) { const g = ctx.createLinearGradient(0, 0, 0, G.horizon); g.addColorStop(0, `rgba(26,52,104,${0.55 * ecl})`); g.addColorStop(1, `rgba(120,98,150,${0.65 * ecl})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, G.horizon + 2); }
  // the Moon: lit disc (fades as the eclipse darkens it) and the corona around the dark disc
  if (moonAlpha > 0.002) {
    const x = mo.cx + (ecl > 0 ? 0 : 0), y = mo.cy, r = mo.r;
    ctx.save(); ctx.globalAlpha = moonAlpha * (1 - ecl); const gl = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.7); gl.addColorStop(0, "rgba(170,225,225,.28)"); gl.addColorStop(1, "rgba(170,225,225,0)"); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, 6.283); ctx.fill(); { const sa = swayAmp(t), rot = sa * (0.035 * Math.sin(t * 0.23) + 0.014 * Math.sin(t * 0.61 + 1)); ctx.translate(x, y); ctx.rotate(rot); ctx.translate(-x, -y); } ctx.drawImage(r > 900 ? IM["moon-disc-hi"] : IM["moon-disc"], x - r, y - r, 2 * r, 2 * r); ctx.restore();
    if (ecl > 0) { ctx.save(); ctx.globalAlpha = moonAlpha * ecl; const cs = r / 512; ctx.drawImage(IM["eclipse"], x - 1024 * cs, y - 1024 * cs, 2048 * cs, 2048 * cs); ctx.fillStyle = "#06080f"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.restore(); }
  }
  // the tide: the sea over the sand, the waterline climbing the beach in long swells
  if (tide > 0.01) {
    const yTop = lerp(G.shore - 10 * U, H + 40 * U, tide), amp = (10 + 22 * tide) * U; ctx.save(); ctx.beginPath(); ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 20) { const w = Math.sin(x / (230 * U) + t * 0.9) * amp * 0.5 + Math.sin(x / (97 * U) - t * 1.4) * amp * 0.25 + (1 - x / W) * 60 * U * (1 - tide); ctx.lineTo(x, yTop + w); }
    ctx.lineTo(W + 10, H + 10); ctx.closePath(); ctx.clip(); camT(cam, ox, oy); drawPlateWavesNoState(IM[G.flood], t, G); ctx.restore();
    ctx.save(); ctx.strokeStyle = "rgba(200,240,240,.55)"; ctx.lineWidth = 4 * U; ctx.beginPath(); for (let x = -10; x <= W + 10; x += 20) { const w = Math.sin(x / (230 * U) + t * 0.9) * amp * 0.5 + Math.sin(x / (97 * U) - t * 1.4) * amp * 0.25 + (1 - x / W) * 60 * U * (1 - tide); x === -10 ? ctx.moveTo(x, yTop + w) : ctx.lineTo(x, yTop + w); } ctx.stroke(); ctx.restore();
  }
  ctx.save(); camT(cam, ox, oy); ctx.drawImage(IM[MODE === "land" ? "figure-layer" : "figure-layer-9x16"], 0, 0, W, H); ctx.restore();   // the small figure stays upright on top of the moving sea
  // moonlight on the water: the silver road, wider and brighter as the light grows; the wet sand and the headland lit
  const bright = clamp01(0.13 * Math.log2(lightx)), roadW = Math.min(W * 0.5, mo.r * 0.9 + 90 * U);
  if (bright > 0.01 && moonAlpha > 0.01) {
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.filter = `blur(${22 * U}px)`; const rg = ctx.createLinearGradient(0, G.horizon, 0, H); rg.addColorStop(0, `rgba(170,235,230,${0.6 * bright * moonAlpha})`); rg.addColorStop(1, `rgba(90,170,190,${0.25 * bright * moonAlpha})`);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(mo.cx - roadW * 0.12, G.horizon); ctx.lineTo(mo.cx + roadW * 0.12, G.horizon); ctx.lineTo(mo.cx + roadW * 0.5 + 40 * Math.sin(t * 0.8), H); ctx.lineTo(mo.cx - roadW * 0.5 + 40 * Math.sin(t * 0.8), H); ctx.fill(); ctx.filter = "none";
    for (let i = 0; i < 26; i++) { const yy = G.horizon + (i + 1) / 26 * (H - G.horizon), ww = roadW * (0.1 + 0.4 * (i / 26)) * (0.7 + 0.3 * Math.sin(t * 2 + i)); ctx.fillStyle = `rgba(230,255,250,${0.14 * bright * moonAlpha})`; ctx.fillRect(mo.cx - ww / 2 + 30 * Math.sin(t * 0.8 + i), yy, ww, 3 * U); }
    const fill = ctx.createLinearGradient(0, G.horizon, 0, H); fill.addColorStop(0, `rgba(60,100,130,${0.16 * bright * moonAlpha})`); fill.addColorStop(1, `rgba(120,160,175,${0.30 * bright * moonAlpha})`); ctx.fillStyle = fill; ctx.fillRect(0, G.horizon, W, H - G.horizon); ctx.restore();
  }
  ctx.restore();
}
function hud(t) {
  const d = dCount(t), s = sizeX(dVis(t)), fmt = (n) => Math.round(n).toLocaleString("en-US");
  document.getElementById("num").textContent = fmt(d) + " km"; document.getElementById("size").textContent = "size in the sky ×" + (s < 9.95 ? s.toFixed(1) : Math.round(s));
  const cap = TL.captions.find((c) => t >= c.t0 && t < c.t1), el = document.getElementById("cap"), b = beats(); if (MODE === "land") el.style.bottom = b && t < b.end + 0.5 ? "calc(250 * var(--u))" : "calc(84 * var(--u))";   // the opening keeps the little figure clear of the caption
   if (cap) { el.textContent = cap.text; el.style.opacity = 1; } else el.style.opacity = 0;
}
window.setup = async (tl, assets, mode, w, h) => {
  TL = tl; MODE = mode; W = w; H = h; U = mode === "land" ? H / 1080 : W / 1080; cv = document.getElementById("c"); cv.width = W; cv.height = H; ctx = cv.getContext("2d");
  await Promise.all(Object.entries(assets).map(([k, src]) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IM[k] = i; res(); }; i.onerror = () => rej(new Error("asset " + k)); i.src = src; })));
  await document.fonts.ready; document.documentElement.style.setProperty("--u", U + "px");
};
// extra life for the long film's still stretches (the hold in chapter 1 and everything from the break-up on): a slow camera sway, the Moon's libration, drifting dust.
// Gated by time so the segments rendered separately join without a pop (it is 0 at 345.1 s).
const swayAmp = (t) => (MODE !== "land" || TL.dur < 300) ? 0 : Math.max(sm((t - 346) / 4), (beats() && t > beats().calm.t1 + 1 && t < beats().size.t0 - 0.2) ? sm((t - beats().calm.t1 - 1) / 2) * sm((beats().size.t0 - 0.2 - t) / 1) : 0);
const figPos = () => (MODE === "land" ? { x: 0.342 * W, y: 0.831 * H } : { x: 0.423 * W, y: 0.681 * H });
function zoomState(t, b, mo) {   // {s, F (world pivot), k (0 = pivot stays put, 1 = pivot goes to the screen anchor)}
  const fg = figPos(), mp = { x: mo.cx, y: mo.cy }, e = (a, c, u) => lerp(a, c, sm(u));
  const A = b.start, calm = b.calm, lt = b.light.t0, sz = b.size.t0;
  if (t < calm.t0) return { s: 1.5, F: fg, k: 0 };
  const tr = calm.t0 + Math.max(1.5, calm.t1 - calm.t0 + 0.6);
  if (t < tr) { const u = (t - calm.t0) / (tr - calm.t0); return { s: e(1.5, 1.3, u), F: { x: e(fg.x, mp.x, u), y: e(fg.y, mp.y, u) }, k: sm(u) }; }
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
    const a = Math.min(sm(mu / 0.15), 1 - sm((mu - 0.8) / 0.2)), sx = -0.1 * W, sy = -0.05 * H, hx = X - r * 0.78, hy = Y - r * 0.55, wx = X + (MODE === "land" ? 0 : -0.03 * W), wy = G.horizon + 0.07 * (H - G.horizon), l1 = sm(mu / 0.4), l2 = sm((mu - 0.35) / 0.35);
    ctx.filter = `blur(${3 * U}px)`; ctx.globalAlpha = a; ctx.lineWidth = 6 * U; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,225,160,.85)"; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lerp(sx, hx, l1), lerp(sy, hy, l1)); ctx.stroke();
    if (l2 > 0) { ctx.strokeStyle = "rgba(170,240,235,.85)"; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lerp(hx, wx, l2), lerp(hy, wy, l2)); ctx.stroke(); } ctx.filter = "none"; }
  ctx.restore();
}
window.renderAt = (t) => {
  const G = geom(), ecl = track(TL.tracks.eclipse, t), moonA = track(TL.tracks.moon, t), brk = track(TL.tracks.brk, t), ring = track(TL.tracks.ring, t), tn = track(TL.tracks.tonight, t), d = dVis(t);
  const A = swayAmp(t); ctx.save(); if (A > 0.001) { const sc = 1 + 0.016 * A; ctx.translate(W / 2 + 16 * U * A * Math.sin(t * 0.55), H / 2 + 8 * U * A * Math.sin(t * 0.4)); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2); }
  const b = beats(), inCh1 = b && t >= b.start - 0.01 && t <= b.end + 2.5; ctx.save();
  if (inCh1) { const mo0 = moonState(384400, G), z = zoomState(t, b, mo0); let tx = lerp(z.F.x, W * 0.54, z.k), ty = lerp(z.F.y, H * 0.46, z.k);
    tx = Math.max(W - (W - z.F.x) * z.s, Math.min(z.F.x * z.s, tx)); ty = Math.max(H - (H - z.F.y) * z.s, Math.min(z.F.y * z.s, ty));   // never show past the painting
    ctx.translate(tx, ty); ctx.scale(z.s, z.s); ctx.translate(-z.F.x, -z.F.y); }
  sceneComposite(t, Math.max(d, 17000), ecl, moonA, G);
  if (inCh1) ch1Overlays(t, b, moonState(384400, G), G);
  ctx.restore();
  if (brk > 0.001) { ctx.save(); ctx.globalAlpha = brk; const sc = 1.02 + 0.03 * (t / TL.dur) + 0.01 * Math.sin(t * 0.3) + 0.018 * A * Math.sin(t * 0.45); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2); ctx.drawImage(IM["plate-breakup"], 0, 0, W, H); ctx.restore(); }
  if (ring > 0.001) { ctx.save(); ctx.globalAlpha = ring; ctx.translate(W / 2, H / 2); ctx.scale(1 + 0.02 * A * Math.sin(t * 0.4), 1 + 0.02 * A * Math.sin(t * 0.4)); ctx.translate(-W / 2, -H / 2); ctx.drawImage(IM["ring"], 0, -20 * U * Math.sin(t * 0.2), W, H); ctx.restore(); }
  if (tn > 0.001) { ctx.save(); ctx.globalAlpha = tn; ctx.drawImage(IM["plate-tonight"], 0, 0, W, H); ctx.restore(); }
  if (A > 0.01 && (brk + ring + tn > 0.01)) { const mr = rnd(77); ctx.save(); ctx.globalCompositeOperation = "screen"; for (let i = 0; i < 70; i++) { const sp = (6 + 20 * mr()) * U, x = (((mr() * W - t * sp * (mr() > 0.5 ? 1 : -1)) % W) + W) % W, y = (((mr() * H - t * sp * 0.4) % H) + H) % H, rr = (1 + 2.4 * mr()) * U; ctx.globalAlpha = A * (0.15 + 0.35 * mr()) * (0.6 + 0.4 * Math.sin(t * 1.5 + i)); ctx.fillStyle = "#cfe9ff"; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill(); } ctx.restore(); }
  ctx.restore();
  hud(t);
};
