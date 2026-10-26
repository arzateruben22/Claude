// Designed covers and thumbnails for every delivered episode, each in its channel's own theme (films/channels/<ch>/theme.json):
//   out/<name>-cover.jpg  1080×1920, the 9:16 cover for TikTok, Instagram Reels and YouTube Shorts
//   out/<name>-thumb.jpg  1280×720, the 16:9 YouTube thumbnail (short title, legible at 160 px wide)
// The picture is one frame of the final: a moment between two caption pages (the burned-in captions are fully gone there),
// away from the title card, the end card and shot cuts, scored for a clear, colourful subject (see pickFrame). If the final
// can't be read, the poster (*-9x16.jpg) is used. Colours are the theme's tokens only; faces are its own font files.
// Idempotent: an episode whose cover and thumbnail are both newer than its mp4 is skipped (--force redoes it).
//   npm run covers [-- films/channels/physics/ep01 …] [--force] [--debug: print every candidate's score] [--dry: pick, don't draw]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { CHANNELS } from "../src/domain/catalog";

const ROOT = path.resolve(process.env.FILMS_REPO_ROOT || "..");
const args = process.argv.slice(2);
const force = args.includes("--force"), debug = args.includes("--debug"), dry = args.includes("--dry");
const dirs = args.filter((a) => !a.startsWith("--")).length ? args.filter((a) => !a.startsWith("--")).map((d) => path.resolve(ROOT, d))
  : CHANNELS.filter((c) => c.filmsPath).flatMap((c) => fs.existsSync(path.join(ROOT, c.filmsPath!)) ? fs.readdirSync(path.join(ROOT, c.filmsPath!)).filter((e) => /^ep\d+$/.test(e)).sort().map((e) => path.join(ROOT, c.filmsPath!, e)) : []);

type Font = { family: string; file: string; weight?: string; style?: string };
type Theme = { id?: string; tokens: Record<string, string>; roles?: Record<string, string>; type?: Record<string, string>; fonts?: Font[]; cssText?: string;
  scene?: Record<string, unknown>; labels?: Record<string, unknown>;
  safe?: Record<string, { x: [number, number]; y: [number, number]; frame?: [number, number] }> };
type Page = { t0: number; t1: number };
type Film = { fps?: number; dur?: number; poster?: number; endCard?: number; title?: { title?: string; series?: string; t1?: number };
  captions?: Page[]; shots?: { at: number }[]; beats?: { id: string; t0: number; t1: number }[] };
type Box = { x0: number; y0: number; x1: number; y1: number };   // full-frame px (1080×1920)
type Pick = { t: number | null; why: string; score: number; box: Box; content: Box };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const accent = (s: string) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");       // "*word*" → the theme's accent, asterisks gone
const plain = (s: string) => s.replace(/\*/g, "");
const rgb = (hex: string) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** At most five words for the thumbnail: drop articles first, then cut (keeping the accent's asterisks paired). */
function shortTitle(title: string) {
  let w = title.trim().split(/\s+/);
  if (w.length > 5) w = w.filter((x, i) => i === 0 || !/^(the|a|an)$/i.test(plain(x)));
  if (w.length > 5) { w = w.slice(0, 5); if ((w.join(" ").match(/\*/g) ?? []).length % 2) w[4] += "*"; }
  return w.join(" ");
}

// ── the frame ──────────────────────────────────────────────────────────────────────────────────────────────────────
const AW = 108, AH = 192;                 // analysis size (1/10 of the frame)
const grab = (mp4: string, t: number, out?: string) => out
  ? execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", mp4, "-frames:v", "1", out])
  : execFileSync("ffmpeg", ["-v", "error", "-ss", t.toFixed(3), "-i", mp4, "-frames:v", "1", "-vf", `scale=${AW}:${AH}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 1 << 24 });

/** Caption-free frame times: inside each gap between caption pages (hud.js shows a page only for t0 ≤ t < t1), the middle
 *  frame, plus one every half second in long gaps; never on the title card, the end card or within 0.35 s of a cut. */
function candidates(film: Film) {
  const fps = film.fps ?? 30, pages = [...(film.captions ?? [])].sort((a, b) => a.t0 - b.t0);
  const from = (film.title?.t1 ?? 3) + 0.7, to = (film.endCard ?? film.dur ?? 60) - 0.2;
  const cuts = (film.shots ?? []).map((s) => s.at).filter((a) => a > 0);
  const out: number[] = [];
  for (let i = 0; i + 1 < pages.length; i++) {
    const k0 = Math.ceil(pages[i].t1 * fps + 1e-6), k1 = Math.ceil(pages[i + 1].t0 * fps - 1e-6) - 1;   // frames k with t1 ≤ k/fps < next t0
    if (k1 - k0 < 2) continue;                                                                            // at least 3 clean frames
    const ks = new Set([Math.round((k0 + k1) / 2)]);
    for (let k = k0 + 3; k <= k1 - 3; k += Math.round(fps / 2)) ks.add(k);
    for (const k of ks) { const t = k / fps; if (t >= from && t <= to && !cuts.some((c) => Math.abs(c - t) < 0.35)) out.push(k); }
  }
  return [...new Set(out)].sort((a, b) => a - b).map((k) => ({ k, t: k / fps }));
}

const hue = (r: number, g: number, b: number) => {
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};
const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** The hues the HUD draws in (the accent and the label colours) that the scene itself doesn't use: colour in these hues is
 *  a readout or a tag, not the subject (Rest Frame: cobalt counters, green and red tags; Light Minute: ice and lemon pills). */
function hudHues(theme: Theme) {
  const t = theme.tokens, res = (v?: string) => (v && v in t ? t[v] : v);
  const scene = new Set(Object.values(theme.scene ?? {}).filter((v) => /^#[0-9a-f]{6}$/i.test(String(v))).map((v) => String(v).toLowerCase()));
  return [res(theme.roles?.accent), ...Object.values(theme.labels ?? {}).map((l) => (typeof l === "object" && l ? res((l as { color?: string }).color) : undefined))]
    .filter((c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c) && !scene.has(c.toLowerCase()))
    .map(rgb).filter(([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255 > 0.25).map(([r, g, b]) => hue(r, g, b));
}

/** Score one analysis frame. Only the picture band between the top badges and the caption line counts.
 *  The subject is saturated colour (balls, bobs, rings, planets) outside the HUD's hues, weighted by how much of the band it
 *  spreads over; it is discounted by readouts and tags in the HUD's hues and by plates (light themes: neutral pixels brighter
 *  than the set) or bright neutral text (dark themes). Returns the subject's box (5th–95th percentile of its colour) and the box of everything that isn't
 *  background (subject, tags, counters, props), both in full-frame px. */
function analyse(px: Buffer, bg: number[], hud: number[]) {
  const y0 = Math.round(AH * 0.1), y1 = Math.round(AH * 0.6), bgL = lum(bg[0], bg[1], bg[2]), light = bgL > 0.5;
  const GX = 6, GY = 8, cells = new Array(GX * GY).fill(0);
  let subj = 0, tag = 0, plate = 0, n = 0;
  const xs: [number, number][] = [], ys: [number, number][] = [], ox: number[] = [], oy: number[] = [];
  const band: number[] = [];                         // the set's own brightness (median of the band): plates are brighter than it
  for (let y = y0; y < y1; y += 2) for (let x = 3; x < AW * 0.9; x += 2) { const i = (y * AW + x) * 3; band.push(lum(px[i], px[i + 1], px[i + 2])); }
  const setL = band.sort((a, b) => a - b)[band.length >> 1] ?? bgL;
  for (let y = Math.round(AH * 0.06); y < Math.round(AH * 0.63); y++) for (let x = 3; x < AW * 0.9; x++) {
    const i = (y * AW + x) * 3, r = px[i], g = px[i + 1], b = px[i + 2];
    const c = (Math.max(r, g, b) - Math.min(r, g, b)) / 255, l = lum(r, g, b);
    if (c > 0.16 || Math.abs(l - bgL) > 0.22) { ox.push(x); oy.push(y); }
    if (y < y0 || y >= y1) continue;
    n++;
    if (c > 0.16) {
      const h = hue(r, g, b), w = c * c;
      if (hud.some((u) => hueGap(u, h) < 14)) { tag += w; continue; }
      subj += w; xs.push([x, w]); ys.push([y, w]);
      cells[Math.min(GY - 1, Math.floor((y - y0) / (y1 - y0) * GY)) * GX + Math.min(GX - 1, Math.floor(x / (AW * 0.9) * GX))] += 1;
    } else if (light ? c < 0.04 && l > setL + 0.05 : c < 0.12 && l > 0.7) plate++;
  }
  const pct = (a: [number, number][], q: number) => { a.sort((p, r) => p[0] - r[0]); const tot = a.reduce((s, p) => s + p[1], 0); let acc = 0; for (const [v, w] of a) { acc += w; if (acc >= q * tot) return v; } return a.at(-1)?.[0] ?? 0; };
  const qs = (a: number[], q: number) => [...a].sort((p, r) => p - r)[Math.min(a.length - 1, Math.floor(q * a.length))];
  const spread = cells.filter((v) => v >= 3).length / cells.length;
  const parts = { subject: (subj / n) * 40, spread, tags: (tag / n) * 40, plates: plate / n };
  const score = (parts.subject * (0.35 + spread)) / (1 + 2 * parts.tags + 6 * parts.plates);
  const box = xs.length > 12 ? { x0: pct(xs, 0.05) * 10, x1: (pct(xs, 0.95) + 1) * 10, y0: pct(ys, 0.05) * 10, y1: (pct(ys, 0.95) + 1) * 10 } : { ...DEFAULT_BOX };
  const content = ox.length > 12 ? { x0: qs(ox, 0.03) * 10, x1: (qs(ox, 0.97) + 1) * 10, y0: qs(oy, 0.03) * 10, y1: (qs(oy, 0.97) + 1) * 10 } : { ...box };
  return { score, box, content, parts };
}
const DEFAULT_BOX: Box = { x0: 108, x1: 972, y0: 300, y1: 1100 };

function pickFrame(mp4: string, film: Film, theme: Theme, label: string): Pick {
  const bg = rgb(theme.tokens.bg ?? "#000000"), hud = hudHues(theme);
  const poster = film.poster && film.poster > (film.title?.t1 ?? 3) ? film.poster : null;   // the film's own payoff moment, if it chose one
  let best: Pick | null = null;
  for (const { t } of candidates(film)) {
    let a;
    try { a = analyse(grab(mp4, t) as Buffer, bg, hud); } catch { continue; }
    let s = a.score;
    const beat = film.beats?.find((b) => t >= b.t0 && t < b.t1)?.id;
    if (beat === "whoa") s *= 1.15;                                     // the payoff image
    if (beat && ["readout", "takeaway", "tease"].includes(beat)) s *= 0.75;                      // recurring segments and wrap-up: less about this episode
    if (poster != null) s *= 1 + 0.15 * Math.exp(-Math.abs(t - poster) / 4);
    if (debug) console.log(`  ${label} ${t.toFixed(2).padStart(6)} s  score ${s.toFixed(3)}  ${Object.entries(a.parts).map(([k, v]) => `${k} ${v.toFixed(3)}`).join("  ")} ${beat ?? ""}`);
    if (!best || s > best.score) best = { t, why: [beat ? `${beat} beat` : "", "caption-free"].filter(Boolean).join(", "), score: s, box: a.box, content: a.content };
  }
  return best ?? { t: null, why: "poster", score: 0, box: { ...DEFAULT_BOX }, content: { ...DEFAULT_BOX } };
}

// ── the pages ──────────────────────────────────────────────────────────────────────────────────────────────────────
const FALLBACK: Record<string, string> = { display: '"DejaVu Sans", sans-serif', text: '"DejaVu Sans", sans-serif', mono: '"DejaVu Sans Mono", monospace' };

/** The theme as page.mjs (kits/cinema/film) gives it to a film: tokens → --<name>, roles → --hud-<role>, faces → --font-<role>,
 *  @font-face from the channel's fonts/ folder, and its cssText, so .stage, .hud-series and .hud-h look as they do in the films. */
function themeCss(theme: Theme, dir: string) {
  const tokens = theme.tokens, roleVal = (v: string) => (v in tokens ? `var(--${v})` : v);
  const faces = (theme.fonts ?? []).filter((f) => fs.existsSync(path.resolve(dir, f.file))).map((f) => {
    const file = path.resolve(dir, f.file), fmt = /\.woff2$/i.test(file) ? "woff2" : /\.woff$/i.test(file) ? "woff" : /\.otf$/i.test(file) ? "opentype" : "truetype";
    return `@font-face { font-family: "${f.family}"; src: url("${pathToFileURL(file).href}") format("${fmt}"); font-weight: ${f.weight ?? "400"}; font-style: ${f.style ?? "normal"}; font-display: block; }`;
  }).join("\n");
  const vars = [
    ...Object.entries(tokens).map(([k, v]) => `--${k}: ${v};`),
    ...Object.entries(theme.roles ?? {}).map(([k, v]) => `--hud-${k}: ${roleVal(String(v))};`),
    ...["display", "text", "mono"].map((r) => `--font-${r}: ${theme.type?.[r] ? `"${theme.type[r]}", ` : ""}${FALLBACK[r]};`),
  ].join("\n  ");
  return `${faces}
:root {
  ${vars}
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { overflow: hidden; background: var(--bg); color: var(--text); font-family: var(--font-text); -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
.stage { position: absolute; inset: 0; overflow: hidden; background: var(--bg); }
.hud-series { font: 600 30px/1.2 var(--font-text); letter-spacing: .04em; color: var(--hud-accent, var(--text)); }
.hud-h { font-weight: var(--hud-title-weight, 700); font-family: var(--font-display); line-height: 1.02; color: var(--hud-text, var(--text)); letter-spacing: var(--hud-title-tracking, -.02em); text-wrap: balance; }
.hud-h em { font-style: normal; color: var(--hud-accent, var(--text)); }
${theme.cssText ?? ""}`;
}

/** In-page helpers. fit: the largest size at which the title fits its box in at most maxLines lines; fitTitle: two lines
 *  unless three are much bigger; put: size and place the frame (scale s, offset x, y). */
const PAGE_JS = `
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function fit(el, maxW, maxH, hi, lo, maxLines) {
  for (let s = hi; s >= lo; s -= 2) {
    el.style.fontSize = s + "px";
    const lh = parseFloat(getComputedStyle(el).lineHeight) || s;
    if (el.scrollWidth <= maxW + 1 && el.offsetHeight <= maxH && Math.round(el.offsetHeight / lh) <= maxLines) return s;
  }
  return lo;
}
// two lines unless three are much bigger: "Thrown or / dropped?" reads better than "Thrown / or / dropped?"
function fitTitle(el, maxW, maxH, hi, lo) {
  const s3 = fit(el, maxW, maxH, hi, lo, 3), s2 = fit(el, maxW, maxH, hi, lo, 2);
  return s2 >= 0.8 * s3 ? s2 : fit(el, maxW, maxH, hi, lo, 3);
}
function put(img, s, x, y) { Object.assign(img.style, { left: x.toFixed(1) + "px", top: y.toFixed(1) + "px", width: (1080 * s).toFixed(1) + "px", height: (1920 * s).toFixed(1) + "px" }); }`;

const BASE_CSS = `.pic { position: absolute; overflow: hidden; } .pic img { position: absolute; display: block; }
.block { position: absolute; display: flex; flex-direction: column; }`;

/** 9:16 cover: the title block sits on the safe box's bottom edge (above TikTok's and Reels' bottom UI, left of their right
 *  rail); the frame is scaled (1–1.3×) and lifted so everything in it clears the title, and fades into the channel's ground
 *  behind the type. */
function coverHtml(o: { css: string; frame: string; content: Box; box: Box; series: string; title: string; safe: { x: [number, number]; y: [number, number] } }) {
  const [L, R] = o.safe.x, [T, B] = o.safe.y, W = R - L;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${o.css}
${BASE_CSS}
html, body { width: 1080px; height: 1920px; }
.pic { inset: 0; }
.block { left: ${L}px; width: ${W}px; bottom: ${1920 - B}px; gap: 26px; }
.block .hud-series { font-size: 36px; }
.block .hud-h { width: ${W}px; }
</style></head><body><div class="stage"><div class="pic" id="pic"><img id="f" src="${o.frame}" alt=""></div>
<div class="block" id="b"><p class="hud-series">${esc(o.series)}</p><h1 class="hud-h" id="t">${accent(o.title)}</h1></div></div>
<script>${PAGE_JS}
document.fonts.ready.then(() => {
  fitTitle(document.getElementById("t"), ${W}, 430, 168, 64);
  const top = document.getElementById("b").getBoundingClientRect().top, c = ${JSON.stringify(o.content)}, b = ${JSON.stringify(o.box)};
  const a0 = ${T - 50}, a1 = top - 110, bw = Math.max(80, c.x1 - c.x0), bh = Math.max(80, c.y1 - c.y0);
  const s = clamp(Math.min(1000 / bw, (a1 - a0) / bh), 1, 1.3);
  const x = clamp(540 - (c.x0 + c.x1) / 2 * s, 1080 - 1080 * s, 0);
  // everything fits: centre it; otherwise the subject sits just above the title and the rest (top badges) gives way
  let y = bh * s <= a1 - a0 ? (a0 + a1) / 2 - (c.y0 + c.y1) / 2 * s : Math.max(a1 - b.y1 * s, a0 - 90 - b.y0 * s);
  y = clamp(y, top + 260 - 1920 * s, 0);
  put(document.getElementById("f"), s, x, y);
  const m = "linear-gradient(180deg, rgba(0,0,0,.4) 0, #000 300px, #000 " + (top - 240) + "px, rgba(0,0,0,.1) " + (top - 60) + "px, transparent " + (top + 40) + "px)";
  const pic = document.getElementById("pic"); pic.style.maskImage = m; pic.style.webkitMaskImage = m;
  window.READY = true;
});
</script></body></html>`;
}

/** 16:9 thumbnail: the short title large on the channel's ground at the left; on the right, the frame's content (subject,
 *  tags, readouts: whole, never cut mid-word) fading into the ground. */
function thumbHtml(o: { css: string; frame: string; content: Box; series: string; title: string }) {
  const PX = 690, PW = 1280 - PX, TW = 630;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${o.css}
${BASE_CSS}
html, body { width: 1280px; height: 720px; }
.pic { left: ${PX}px; top: 0; width: ${PW}px; height: 720px; -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 210px); mask-image: linear-gradient(90deg, transparent 0, #000 210px); }
.block { left: 60px; top: 0; height: 720px; width: ${TW}px; justify-content: center; gap: 20px; }
.block .hud-series { font-size: 28px; }
.block .hud-h { width: ${TW}px; }
</style></head><body><div class="stage"><div class="pic"><img id="f" src="${o.frame}" alt=""></div>
<div class="block"><p class="hud-series">${esc(o.series)}</p><h1 class="hud-h" id="t">${accent(o.title)}</h1></div></div>
<script>${PAGE_JS}
document.fonts.ready.then(() => {
  fitTitle(document.getElementById("t"), ${TW}, 480, 176, 60);
  const b = ${JSON.stringify(o.content)}, bw = Math.max(80, b.x1 - b.x0), bh = Math.max(80, b.y1 - b.y0);
  const s = clamp(Math.min(0.94 * ${PW - 90} / bw, 0.94 * 720 / bh), Math.max(${PW} / 1080, 720 / 1920), 1.6);
  put(document.getElementById("f"), s, clamp(${(PW + 90) / 2} - (b.x0 + b.x1) / 2 * s, ${PW} - 1080 * s, 0), clamp(360 - (b.y0 + b.y1) / 2 * s, 720 - 1920 * s, 0));
  window.READY = true;
});
</script></body></html>`;
}

// ── run ────────────────────────────────────────────────────────────────────────────────────────────────────────────
type PWPage = { goto(u: string): Promise<unknown>; waitForFunction(f: string, a?: unknown, o?: { timeout: number }): Promise<unknown>; screenshot(o: { path: string; type: "jpeg"; quality: number }): Promise<unknown>; close(): Promise<void> };
type PWBrowser = { newPage(o: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PWPage>; close(): Promise<void> };
let browser: PWBrowser | null = null;
async function shoot(html: string, size: { width: number; height: number }, out: string, tmp: string) {
  if (!browser) {
    const { chromium } = createRequire(import.meta.url)(path.join(execSync("npm root -g").toString().trim(), "playwright")) as { chromium: { launch(o?: { executablePath?: string }): Promise<PWBrowser> } };
    try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }
  }
  const file = path.join(tmp, `${path.basename(out, ".jpg")}.html`);
  fs.writeFileSync(file, html);
  const pg = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  await pg.goto(pathToFileURL(file).href);
  await pg.waitForFunction("window.READY === true", null, { timeout: 30000 });
  const shot = path.join(tmp, path.basename(out));
  await pg.screenshot({ path: shot, type: "jpeg", quality: 92 });
  await pg.close();
  fs.copyFileSync(shot, out);                        // only a finished image lands in out/ (an interrupted run leaves nothing half-written)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "covers-"));
try {
  for (const dir of dirs) {
    const outDir = path.join(dir, "out");
    const mp4 = fs.existsSync(outDir) ? fs.readdirSync(outDir).find((f) => /-9x16\.mp4$/.test(f)) : undefined;
    if (!mp4) continue;
    const name = mp4.replace(/-9x16\.mp4$/, ""), rel = path.relative(ROOT, dir);
    const cover = path.join(outDir, `${name}-cover.jpg`), thumb = path.join(outDir, `${name}-thumb.jpg`), video = path.join(outDir, mp4);
    const vt = fs.statSync(video).mtimeMs;
    if (!force && [cover, thumb].every((f) => fs.existsSync(f) && fs.statSync(f).mtimeMs > vt)) { console.log(`${rel}: ${name}-cover.jpg, ${name}-thumb.jpg up to date`); continue; }
    const themeFile = path.join(path.dirname(dir), "theme.json");
    if (!fs.existsSync(themeFile)) { console.log(`${rel}: no theme.json, skipped`); continue; }
    const theme = JSON.parse(fs.readFileSync(themeFile, "utf8")) as Theme;
    const film = (fs.existsSync(path.join(dir, "film.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "film.json"), "utf8")) : {}) as Film;
    const title = film.title?.title ?? name, series = film.title?.series ?? theme.id ?? "";
    const pick = pickFrame(video, film, theme, name);
    if (dry) { console.log(`${rel}: would use ${pick.t != null ? `frame ${pick.t.toFixed(2)} s (${pick.why})` : "the poster"}`); continue; }
    let frame = path.join(outDir, `${name}-9x16.jpg`);
    if (pick.t != null) { frame = path.join(tmp, `${name}-frame.png`); grab(video, pick.t, frame); }
    else if (!fs.existsSync(frame)) { console.log(`${rel}: no usable frame or poster, skipped`); continue; }
    const css = themeCss(theme, path.dirname(themeFile)), src = pathToFileURL(frame).href;
    const safe = theme.safe?.["9x16"] ?? { x: [90, 900] as [number, number], y: [250, 1420] as [number, number] };
    await shoot(coverHtml({ css, frame: src, content: pick.content, box: pick.box, series, title, safe }), { width: 1080, height: 1920 }, cover, tmp);
    await shoot(thumbHtml({ css, frame: src, content: pick.content, series, title: shortTitle(title) }), { width: 1280, height: 720 }, thumb, tmp);
    console.log(`${rel}: ${name}-cover.jpg, ${name}-thumb.jpg · ${pick.t != null ? `frame ${pick.t.toFixed(2)} s (${pick.why})` : "from the poster"} · "${plain(title)}"`);
  }
} finally {
  if (browser) await (browser as PWBrowser).close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
