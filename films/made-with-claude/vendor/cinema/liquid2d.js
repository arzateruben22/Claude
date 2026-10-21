// liquid2d.js — liquid-chrome text morph for canvas 2D (after the "Opus 5.5" chrome-blob reference).
//
// A blob squashes flat, pinches into one bead per glyph, each bead swells into its glyph left to right,
// and the letters ripple and settle into crisp chrome. Rendered as a 2D metaball field: beads and
// glyphs are drawn white, blurred, and thresholded, so they neck and merge like a liquid. The blurred
// field doubles as a height map whose normals reflect a studio environment: a white sky, a dark horizon
// band, a light floor, a coral rim light and a specular glint. That gives the chrome.
//
//   import { liquidText } from "kits/cinema/liquid2d.js";
//   liquidText(ctx, { text: "OPUS 5.5", font: '600 110px "Montserrat"', x, y, form: p, settle: s, t, res: 2, palette });
//
// form 0→1 runs blob → beads → glyphs, settle 0→1 runs ripple → still, and t (seconds) phases the
// ripple. It is a pure function of its inputs, so it is safe for frame-by-frame rendering. Work happens
// in a cached offscreen canvas; the result is drawn into ctx centred on (x, y).
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
let cache = null;
function canvases(w, h) {
  if (!cache || cache.w !== w || cache.h !== h) {
    const mk = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    cache = { w, h, shape: mk(), blur: mk(), hgt: mk(), out: mk() };
  }
  return cache;
}
export const ENV = {
  face: [52, 52, 57], sky: [246, 246, 243], floor: [196, 196, 192], band: [22, 22, 26], rim: [232, 97, 60]
};
const mix = (a, b, k, out) => { for (let i = 0; i < 3; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; };
// a white studio seen in chrome. Facing the lens: graphite (the dark room behind the camera). Curving up:
// the white sky; curving down: the light floor; in between, a dark horizon band. A narrow coral rim on the
// right and a small glint upper left, like the reference's key and practical.
function env(rx, ry, rz, out, pal) {
  const s = pal || ENV, tmp = [0, 0, 0];
  const edge = 1 - smooth((rz - 0.55) / 0.4);               // 0 facing the lens, 1 at grazing angles
  mix(s.face, s.band, 0.5 * edge, out);
  if (ry > 0) mix(out, s.sky, smooth((ry - 0.06) / 0.42), out);
  else mix(out, s.floor, smooth((-ry - 0.1) / 0.5) * 0.9, out);
  const rim = smooth((rx - 0.62) / 0.22) * smooth((ry + 0.15) / 0.3) * 0.75;
  mix(out, s.rim, rim, tmp); out[0] = tmp[0]; out[1] = tmp[1]; out[2] = tmp[2];
  const glint = Math.exp(-((rx + 0.3) ** 2 + (ry - 0.5) ** 2) / 0.006) * 0.8;
  for (let i = 0; i < 3; i++) out[i] = Math.min(255, out[i] + 255 * glint);
  return out;
}

export function liquidText(ctx, o) {
  const text = o.text, form = clamp01(o.form), settle = clamp01(o.settle ?? 0), t = o.t || 0;
  // res: work at res× the target units (a canvas drawn with a density scale should pass that density)
  const res = o.res || 1, font = o.font.replace(/(\d+(?:\.\d+)?)px/, (m, v) => (parseFloat(v) * res) + "px");
  // measure with the drawing font (letter spacing is applied per glyph so beads sit on glyph centres)
  ctx.save(); ctx.font = font; const spacing = (o.spacing || 0) * res;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const fs = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)[1]);
  ctx.restore();
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  const pad = Math.ceil(fs * 0.6), W = Math.ceil(total + pad * 2), H = Math.ceil(fs * 1.5 + pad * 2);
  const C = canvases(W, H), sc = C.shape.getContext("2d");   // (readbacks use willReadFrequently contexts below)
  sc.clearRect(0, 0, W, H); sc.fillStyle = "#fff"; sc.font = font; sc.textBaseline = "middle"; sc.textAlign = "center";
  const cy = H / 2;
  let x = pad; const centres = [];
  [...text].forEach((ch, i) => { centres.push(ch === " " ? null : x + widths[i] / 2); x += widths[i] + spacing; });
  const glyphs = centres.map((c, i) => ({ c, ch: text[i] })).filter((g) => g.c !== null);
  const n = glyphs.length, mid = W / 2, bead = fs * 0.2;
  // phase 1 (form 0–0.3): one blob squashes into a bar and pinches into beads at the glyph centres
  const q = smooth(form / 0.3);
  if (form < 0.32) {
    const barW = (total * 0.15 + total * 0.85 * easeOut(form / 0.22)), barH = fs * (0.62 - 0.4 * q);
    sc.beginPath(); sc.ellipse(mid, cy, barW / 2, Math.max(1, barH / 2) * (1 - q * q), 0, 0, Math.PI * 2); sc.fill();
  }
  // phase 2 (form 0.3–0.85): each bead swells into its glyph, left to right
  glyphs.forEach((g, i) => {
    const bx = mid + (g.c - mid) * q, gi = smooth((form - 0.3 - 0.055 * i) / 0.22);
    const r = bead * (0.55 + 0.45 * q) * (1 - gi);
    if (form > 0.08 && r > 0.5) { sc.beginPath(); sc.arc(bx, cy + Math.sin(t * 9 + i) * fs * 0.03 * (1 - gi), r, 0, Math.PI * 2); sc.fill(); }
    if (gi > 0) {
      sc.save(); sc.globalAlpha = gi; sc.translate(g.c, cy); const s = 0.55 + 0.45 * easeOut(gi); sc.scale(s, s);
      sc.fillText(g.ch, 0, 0); sc.restore();
    }
  });
  // metaball: blur, then threshold; the blur shrinks as the letters settle so they end crisp (soft-cornered)
  const bl = fs * (0.085 - 0.06 * smooth(settle)) * (0.4 + 0.6 * Math.min(1, form * 3));
  const bc = C.blur.getContext("2d", { willReadFrequently: true });
  bc.clearRect(0, 0, W, H); bc.filter = `blur(${bl.toFixed(2)}px)`; bc.drawImage(C.shape, 0, 0); bc.filter = "none";
  const src = bc.getImageData(0, 0, W, H).data;
  // a wider blur is the height map: beads and strokes shade as domes and tubes, not flat cut-outs
  const hb = fs * 0.12, hc = C.hgt.getContext("2d", { willReadFrequently: true });
  hc.clearRect(0, 0, W, H); hc.filter = `blur(${hb.toFixed(2)}px)`; hc.drawImage(C.shape, 0, 0); hc.filter = "none";
  const hsrc = hc.getImageData(0, 0, W, H).data;
  const Hh = (xx, yy) => hsrc[((yy < 0 ? 0 : yy >= H ? H - 1 : yy) * W + (xx < 0 ? 0 : xx >= W ? W - 1 : xx)) * 4 + 3] / 255;
  const oc = C.out.getContext("2d"), img = oc.createImageData(W, H), d = img.data, rgb = [0, 0, 0];
  const ripple = fs * 0.05 * (1 - smooth(settle)) * smooth((form - 0.5) / 0.3);
  const A = (xx, yy) => src[((yy < 0 ? 0 : yy >= H ? H - 1 : yy) * W + (xx < 0 ? 0 : xx >= W ? W - 1 : xx)) * 4 + 3] / 255;
  const k = hb * 2.6;                     // normal strength (height-map units per pixel)
  const bev = 0.25 + 0.6 * smooth(settle) * smooth((form - 0.6) / 0.4);
  for (let yy = 0; yy < H; yy++) {
    const off = Math.round(ripple * Math.sin(yy * 0.09 + t * 11));   // a liquid ripple that decays as it settles
    for (let xx = 0; xx < W; xx++) {
      const sx = xx - off, a = A(sx, yy);
      const m = smooth((a - 0.47) / 0.06);   // a tight threshold: crisp liquid edges, ~1 px of anti-aliasing
      if (m <= 0) continue;
      // height: domes while it is beads, bevels once it is letters (flat faces read graphite, edges catch the sky)
      const hx = (xx2) => Hh(xx2, yy) * (1 - bev) + A(xx2, yy) * bev, hy = (yy2) => Hh(sx, yy2) * (1 - bev) + A(sx, yy2) * bev;
      const nx = -(hx(sx + 3) - hx(sx - 3)) * k * 0.67, ny = (hy(yy + 3) - hy(yy - 3)) * k * 0.67;
      const len = Math.hypot(nx, ny, 1), Nx = nx / len, Ny = ny / len, Nz = 1 / len;
      // view ray (0,0,-1) reflected about N; a slight top-to-bottom bend stands in for the letters' curvature
      const rx = 2 * Nz * Nx, ry = 2 * Nz * Ny + 0.12 * (0.5 - yy / H), rz = 2 * Nz * Nz - 1;
      env(rx, ry, rz, rgb, o.palette);
      const i4 = (yy * W + xx) * 4;
      d[i4] = rgb[0]; d[i4 + 1] = rgb[1]; d[i4 + 2] = rgb[2]; d[i4 + 3] = 255 * m;
    }
  }
  oc.putImageData(img, 0, 0);
  ctx.drawImage(C.out, o.x - W / 2 / res, o.y - H / 2 / res, W / res, H / res);
  return { w: W / res, h: H / res };
}
