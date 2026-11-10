// render_bridges.mjs <bridges.json> <outdir> [height=1440] [fps=15] [only-id]
// Draws each bridge/opening/finale of the Season 2 long video as an animated 16:9 night-sky card (code-rendered, never still):
// a drifting starfield, one simple illustration per bridge, and the line as a single caption block. Writes <outdir>/seg-<id>.mp4 (picture only,
// the same x264 settings the compilation uses, so the segments join without re-encoding); the sound is bridges.json's mix.
import fs from "node:fs"; import path from "node:path"; import { spawn, spawnSync } from "node:child_process"; import { createRequire } from "node:module"; import { pathToFileURL } from "node:url";
const [bj, outDir, HH = "1440", FR = "15", ONLY] = process.argv.slice(2);
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../..");
const theme = JSON.parse(fs.readFileSync(path.join(repo, "films/channels/space/theme.json"), "utf8")), tok = theme.tokens || {};
const W = 1920, H = 1080, OH = Number(HH), S = OH / H, FPS = 30, RF = Number(FR);
const segs = JSON.parse(fs.readFileSync(bj, "utf8")).filter((s) => !ONLY || s.id === ONLY);
fs.mkdirSync(outDir, { recursive: true });
const fontCss = theme.fonts.map((f) => `@font-face { font-family: "${f.family}"; src: url("${pathToFileURL(path.resolve(repo, "films/channels/space", f.file)).href}"); font-weight: ${f.weight}; font-style: ${f.style}; font-display: block; }`).join("\n");
const colors = { bg: tok.bg || "#0B0F2A", teal: tok.teal || "#4FE3C6", lilac: tok.lilac || "#9B87F5", ice: tok.ice || "#BFD6FF", lemon: tok.lemon || "#F5D76E", text: tok.text || "#EEF0FF" };
const page_js = `
const C = ${JSON.stringify(colors)}; const W = ${W}, H = ${H};
const cv = document.getElementById("c"), ctx = cv.getContext("2d"); const rnd = (s) => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const layers = [0, 1, 2].map((L) => { const r = rnd(10 + L); return Array.from({ length: [220, 120, 60][L] }, () => ({ x: r() * W, y: r() * H, s: [0.9, 1.4, 2.2][L], p: r() * 6.28 })); });
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function sky(t) { const g = ctx.createRadialGradient(W / 2 + 220 * Math.sin(t * 0.5), H * 0.4 + 90 * Math.cos(t * 0.4), 100, W / 2, H * 0.4, 1200); g.addColorStop(0, "#1d2d6e"); g.addColorStop(1, C.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.lineWidth = 120; [["rgba(79,227,198,.055)", 0.17, 760, 280], ["rgba(155,135,245,.05)", -0.11, 620, 360]].forEach(([c, w, rx, ry]) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.48, rx, ry, t * w, 0, 6.283); ctx.stroke(); }); ctx.restore();
  layers.forEach((arr, L) => arr.forEach((s) => { const x = ((s.x - t * [26, 64, 130][L]) % W + W) % W; ctx.globalAlpha = 0.4 + 0.5 * Math.sin(t * 2.4 + s.p); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, s.y, s.s, 0, 6.283); ctx.fill(); })); ctx.globalAlpha = 1; }
const disc = (x, y, r, fill, glow) => { if (glow) { const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4); g.addColorStop(0, glow); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 6.283); ctx.fill(); } ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); };
const ringE = (x, y, rx, ry, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.stroke(); };
const glyph = (k, x, y, a, t) => { ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y + 16 * Math.sin(t * 2.2 + x)); ctx.rotate(0.12 * Math.sin(t * 1.7 + x)); const s = 1.7;
  if (k === 0) { ctx.fillStyle = "#5b3a24"; ctx.fillRect(-6 * s, 10 * s, 12 * s, 26 * s); ctx.fillStyle = "#58c46a"; [[-30, 14], [-22, -8], [-12, -30]].forEach(([w, yy], i) => { ctx.beginPath(); ctx.moveTo(0, yy * s - 22 * s); ctx.lineTo(-(34 - i * 6) * s, (yy + 30) * s - 22 * s); ctx.lineTo((34 - i * 6) * s, (yy + 30) * s - 22 * s); ctx.fill(); }); }
  if (k === 1) { ctx.fillStyle = C.lemon; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 16 * s : 38 * s, an = -1.5708 + i * 0.6283; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.fill(); }
  if (k === 2) { ringE(0, 8 * s, 30 * s, 24 * s, 7 * s, C.lemon); ctx.fillStyle = C.ice; ctx.beginPath(); ctx.moveTo(-8 * s, -14 * s); ctx.lineTo(8 * s, -14 * s); ctx.lineTo(0, -26 * s); ctx.fill(); }
  if (k === 3) { disc(0, 0, 26 * s, "#000", "rgba(255,255,255,.35)"); ringE(0, 0, 30 * s, 30 * s, 3 * s, "#fff"); ringE(0, 0, 52 * s, 10 * s, 3 * s, C.ice); }
  if (k === 4) { disc(0, 0, 28 * s, "#d8c08a"); ringE(0, 0, 52 * s, 14 * s, 5 * s, "#e8dcc0"); }
  if (k === 5) { disc(0, 0, 32 * s, "#c9c9d6"); ctx.fillStyle = "rgba(90,90,110,.5)"; [[-10, -8, 8], [10, 8, 6], [4, -16, 5]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a * s, b * s, r * s, 0, 6.283); ctx.fill(); }); } ctx.restore(); };
const skyline = (y0, t, seed) => { const r = rnd(seed); ctx.fillStyle = "#070a1c"; for (let i = 0, x = 0; x < W; i++) { const w = 70 + r() * 90, h = 120 + r() * 260; ctx.fillRect(x, y0 - h, w, h + 400); ctx.fillStyle = "rgba(255,226,150,.85)"; for (let j = 0; j < 14; j++) { const wx = x + 8 + r() * (w - 20), wy = y0 - h + 12 + r() * (h - 20); if (r() > 0.45) ctx.fillRect(wx, wy, 5, 7); } ctx.fillStyle = "#070a1c"; x += w + 6; } };
const galaxy = (x, y, r, a, ang) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, "#fff"); g.addColorStop(1, "rgba(155,135,245,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.45, 0, 0, 6.283); ctx.fill(); ctx.restore(); };
const gx = (() => { const r = rnd(77); return Array.from({ length: 420 }, () => ({ x: (r() - 0.5) * 120, y: (r() - 0.5) * 68, r: 0.5 + r() * 1.4, a: 0.4 + r() * 0.6, g: r() * 3 })); })();
const sparks = (() => { const r = rnd(99); return Array.from({ length: 60 }, () => ({ u: r(), v: r() - 0.5, p: r() * 6.28 })); })();
const draw = (kind, t, dur) => { sky(t); const u = t / dur;
  if (kind === "opening") { for (let i = 0; i < 6; i++) { const t0 = 4.2 + i * 2.5, a = 0.22 + 0.78 * ease((t - t0) / 0.8); glyph(i, 330 + i * 252, 520, a, t); } }
  else if (kind === "bridge1") { const z = Math.exp(u * 3.2), cx = W / 2, cy = H / 2; ctx.save(); ctx.translate(cx, cy); ctx.scale(z, z); ctx.strokeStyle = C.teal; ctx.lineWidth = 2 / z; ctx.strokeRect(-60, -34, 120, 68); gx.forEach((q) => galaxy(q.x, q.y, q.r * (1 + 0.1 * Math.sin(t + q.g)), q.a, q.g)); ctx.restore(); }
  else if (kind === "bridge2") { const x0 = 300, x1 = 1620, y = 540; ctx.strokeStyle = "rgba(190,200,255,.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); disc(x0, y, 14 + 3 * Math.sin(t * 3), C.lemon, "rgba(245,215,110,.5)"); disc(x1, y, 9, C.teal, "rgba(79,227,198,.4)");
    const b0 = x0 + 0.05 * (x1 - x0), b1 = x0 + (0.14 + 0.02 * Math.sin(t * 1.2)) * (x1 - x0), gr = ctx.createLinearGradient(b0, 0, b1, 0); gr.addColorStop(0, "rgba(79,227,198,0)"); gr.addColorStop(0.5, "rgba(79,227,198,.55)"); gr.addColorStop(1, "rgba(79,227,198,0)"); ctx.fillStyle = gr; ctx.fillRect(b0, y - 60, b1 - b0, 120); sparks.forEach((s) => { const px = b0 + ((s.u + t * 0.08) % 1) * (b1 - b0); disc(px, y + s.v * 110, 2.4, C.ice); }); }
  else if (kind === "bridge3") { const cx = W / 2, cy = 520, r = 260 * (1 - ease(u * 1.05)) + 26, an = 2 + 9 * u * u + t * 0.6; for (let k = 0; k < 8; k++) { const ph = ((t * 0.55 + k / 8) % 1); ctx.globalAlpha = (1 - ph) * 0.5 * Math.min(1, u * 3); ringE(cx, cy, 40 + ph * 560, (40 + ph * 560) * 0.45, 3, C.lilac); } ctx.globalAlpha = 1; [0, Math.PI].forEach((o) => { const x = cx + Math.cos(an + o) * r, y = cy + Math.sin(an + o) * r * 0.5; disc(x, y, 30, "#000", "rgba(255,255,255,.3)"); ringE(x, y, 34, 34, 3, "#fff"); }); }
  else if (kind === "bridge4") { skyline(H - 80, t, 5); const x = W / 2, y = 380, k = ease(u * 1.6); disc(x, y, 5 + 3 * k, "#000", "rgba(255,255,255,.5)"); ringE(x, y, 8 + 4 * k + 3 * Math.sin(t * 2), 8 + 4 * k + 3 * Math.sin(t * 2), 2, "#fff"); ctx.strokeStyle = "rgba(79,227,198,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 20 - 60 * k, y + 40); ctx.lineTo(x + 20 + 60 * k, y + 40); ctx.stroke(); }
  else if (kind === "bridge5") { const cx = 760, cy = 520; disc(cx, cy, 86, "#d8c08a"); ringE(cx, cy, 160, 38, 9, "#e8dcc0"); const r = rnd(5); for (let i = 0; i < 70; i++) { const a = r() * 6.28 + t * (0.15 + r() * 0.4), d = 230 + r() * 420; disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.4, 2.2, C.ice); }
    const m = ease((u - 0.55) / 0.4); if (m > 0) { ctx.globalAlpha = m; disc(1380, 480 + 20 * Math.sin(t), 20 + 60 * m, "#c9c9d6", "rgba(201,201,214,.25)"); ctx.globalAlpha = 1; } }
  else if (kind === "finale") { const my = 700 - 300 * ease(u); disc(960, my, 130, "#d9d9e6", "rgba(217,217,230,.25)"); ctx.fillStyle = "rgba(100,100,125,.45)"; [[-40, -20, 22], [30, 30, 16], [20, -50, 12], [-20, 40, 14]].forEach(([a, b, rr]) => { ctx.beginPath(); ctx.arc(960 + a, my + b, rr, 0, 6.283); ctx.fill(); }); skyline(H - 40, t, 8); } };
window.setup = (kind, dur, text) => { window.K = kind; window.D = dur; };
window.frame = (t, text) => { draw(window.K, t, window.D); const cap = document.getElementById("cap"); if (text) { cap.textContent = text; cap.style.opacity = 1; } else cap.style.opacity = 0; };
`;
const page_html = `<!doctype html><meta charset="utf-8"><style>${fontCss} html,body{margin:0;background:${colors.bg};width:${W}px;height:${H}px;overflow:hidden}
#c{position:absolute;inset:0} #cap{position:absolute;left:50%;bottom:78px;transform:translateX(-50%);max-width:1380px;text-align:center;padding:20px 34px;border-radius:22px;background:rgba(8,10,28,.84);color:${colors.text};font:600 46px/1.28 "${theme.type.text}",sans-serif;letter-spacing:.005em}</style>
<canvas id="c" width="${W}" height="${H}"></canvas><div id="cap"></div><script>${page_js}</script>`;
const pwDir = process.env.PLAYWRIGHT_DIR || path.dirname(spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout.trim());
const { chromium } = createRequire(path.join(pwDir, "x.js"))("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
const htmlPath = path.join(outDir, "bridge.html"); fs.writeFileSync(htmlPath, page_html);
const V = ["-c:v", "libx264", "-preset", "slow", "-crf", "15", "-x264-params", "aq-mode=3:deblock=-1,-1", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(FPS), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"];
for (const sg of segs) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: S }); await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(async () => { await document.fonts.ready; }); await page.evaluate(([k, d]) => window.setup(k, d), [sg.kind, sg.dur]);
  const out = path.join(outDir, `seg-${sg.id}.mp4`), n = Math.round(sg.dur * RF);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(RF), "-c:v", "mjpeg", "-i", "-", "-vf", `fps=${FPS},scale=${Math.round(W * S)}:${OH}:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=0.3`, "-an", ...V, "-t", String(sg.dur), out], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < n; i++) {
    const t = i / RF, s = sg.sentences.find((q) => t >= q.t0 && t < q.t1);
    await page.evaluate(([tt, tx]) => window.frame(tt, tx), [t, s ? s.text : ""]);
    const buf = await page.screenshot({ type: "jpeg", quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on("close", r)); await page.close(); console.log(`seg-${sg.id}: ${sg.dur} s, ${n} frames`);
}
await browser.close();
