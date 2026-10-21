#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   Made with Claude — Breakout · renderer

   node films/made-with-claude/scripts/render.cjs [options]

     --format 16x9|9x16|all   compositions (default all)
     --range A-B              frames with A <= t < B seconds (re-render a section)
     --times 0.5,1.25         only these timestamps
     --contact                one frame every 0.5 s → out/contact-<fmt>-<label>.jpg
     --label NAME             contact-sheet / frames label (default: prerender | final)
     --scale 0.5              draft size (default 1)
     --q preview|final        sample counts (default final)
     --workers N              parallel pages (default 2)
     --out DIR                frame directory override
     --no-encode              stop after PNG frames

   Each frame = window.film.seek(frame) + screenshot. Frames are a pure
   function of their index, so any subset can be re-rendered in place.
   ═══════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");

const FILM = path.resolve(__dirname, "..");
const BUILD = path.join(FILM, "build");
const OUT = path.join(FILM, "out");
const TL = JSON.parse(fs.readFileSync(path.join(FILM, "src", "timeline.json"), "utf8"));
const FPS = TL.fps, FRAMES = Math.round(TL.duration * FPS);

function loadPlaywright() {
  try { return require("playwright"); } catch (e) {
    return require(path.join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "playwright"));
  }
}
function args(argv) {
  const a = { format: "all", workers: 2, encode: true, scale: 1, q: "final" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--format") a.format = argv[++i];
    else if (k === "--range") a.range = argv[++i].split("-").map(Number);
    else if (k === "--times") a.times = argv[++i].split(",").map(Number);
    else if (k === "--frames") a.frames = argv[++i].split(",").map(Number);
    else if (k === "--contact") a.contact = true;
    else if (k === "--label") a.label = argv[++i];
    else if (k === "--scale") a.scale = Number(argv[++i]);
    else if (k === "--q") a.q = argv[++i];
    else if (k === "--workers") a.workers = Number(argv[++i]);
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--no-encode") a.encode = false;
    else if (k === "--resume") a.resume = true;
    else throw new Error("unknown option " + k);
  }
  return a;
}
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png" };
function serve() {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => {
      const p = path.join(FILM, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(FILM) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(p).pipe(rsp);
    });
    s.listen(0, "127.0.0.1", () => res(s));
  });
}
async function openPage(browser, port, fmt, a) {
  const { width, height } = TL.formats[fmt];
  const W = Math.round(width * a.scale), H = Math.round(height * a.scale);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(0);                             // heavy frames can take minutes under load; never give up mid-render
  page.on("pageerror", (e) => { console.error(`[${fmt}] page error:`, e.message); process.exitCode = 1; });
  page.on("console", (m) => { if (m.type() === "error") console.error(`[${fmt}] console:`, m.text()); });
  await page.goto(`http://127.0.0.1:${port}/src/index.html?format=${fmt}&render=1&q=${a.q}&scale=${a.scale}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 120000 });
  return page;
}
async function capture(browser, port, fmt, frames, dir, a) {
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.max(1, Math.min(a.workers, frames.length));
  // interleave so each worker gets a spread of easy and heavy frames
  const chunks = Array.from({ length: n }, (_, w) => frames.filter((_, i) => i % n === w));
  let done = 0; const t0 = Date.now(); const log = [];
  await Promise.all(chunks.map(async (chunk) => {
    const page = await openPage(browser, port, fmt, a);
    for (const f of chunk) {
      const s = Date.now();
      const r = await page.evaluate((fr) => window.film.seek(fr), f);
      await page.screenshot({ path: path.join(dir, String(f).padStart(4, "0") + ".png"), type: "png", timeout: 0 });
      log.push({ ...r, ms: Date.now() - s });
      if (++done % 30 === 0 || done === frames.length) process.stdout.write(`  [${fmt}] ${done}/${frames.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
    }
    await page.context().close();
  }));
  const logPath = path.join(dir, "render-log.json");
  const prev = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")).filter((x) => !frames.includes(x.frame)) : [];
  fs.writeFileSync(logPath, JSON.stringify(prev.concat(log).sort((x, y) => x.frame - y.frame)));
  return log;
}
function run(cmd, argv) { execFileSync(cmd, argv, { stdio: ["ignore", "inherit", "inherit"] }); }
function sheet(fmt, dir, frames, label) {
  run("python3", ["-I", path.join(FILM, "scripts", "contact_sheet.py"), dir, path.join(OUT, `contact-${fmt}-${label}.jpg`), fmt, String(FPS), ...frames.map(String)]);
}
function makeAudio() {
  const raw = path.join(BUILD, "audio-raw.wav"), out = path.join(BUILD, "audio.wav");
  run("python3", ["-I", path.join(FILM, "src", "audio.py"), raw]);
  const { loudness, truePeak } = TL.music;
  const r = require("child_process").spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", `loudnorm=I=${loudness}:TP=${truePeak}:LRA=9:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  const m = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf("{"), r.stderr.lastIndexOf("}") + 1));
  run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af",
    `loudnorm=I=${loudness}:TP=${truePeak}:LRA=9:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
    "-c:a", "pcm_s16le", out]);
  return out;
}
function encode(fmt, dir, audio) {
  // two encodes from the same frames: a near-lossless master (build/, not committed) and the delivery file (out/)
  const file = path.join(OUT, `made-with-claude-${fmt}.mp4`);
  const v = (crf, tune, dst) => run("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(dir, "%04d.png"), "-i", audio,
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), ...(tune ? ["-tune", tune] : []), "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
    "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", dst]);
  v(15, null, path.join(BUILD, `master-${fmt}.mp4`));
  v(19, "grain", file);
  for (const [name, f] of [["hook", 68], ["final", FRAMES - 1]]) {
    run("ffmpeg", ["-v", "error", "-y", "-i", path.join(dir, String(f).padStart(4, "0") + ".png"), "-q:v", "2", path.join(OUT, `poster-${fmt}-${name}.jpg`)]);
  }
  return file;
}

(async () => {
  const a = args(process.argv.slice(2));
  const formats = a.format === "all" ? Object.keys(TL.formats) : [a.format];
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const port = server.address().port;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--force-color-profile=srgb", "--font-render-hinting=none", "--hide-scrollbars", "--ignore-gpu-blocklist"] });
  const dirs = {};
  try {
    for (const fmt of formats) {
      let frames = Array.from({ length: FRAMES }, (_, i) => i);
      let label = a.label || "frames";
      if (a.contact) { frames = []; for (let t = 0; t < TL.duration; t += 0.5) frames.push(Math.round(t * FPS)); frames.push(FRAMES - 1); label = a.label || "prerender"; }
      if (a.range) frames = frames.filter((f) => f / FPS >= a.range[0] - 1e-9 && f / FPS < a.range[1] - 1e-9);
      if (a.times) frames = a.times.map((t) => Math.min(FRAMES - 1, Math.round(t * FPS)));
      if (a.frames) frames = a.frames.filter((f) => f >= 0 && f < FRAMES);
      const dir = a.out ? path.resolve(a.out, fmt) : path.join(BUILD, a.contact ? `contact-${label}` : "frames", fmt);
      dirs[fmt] = dir;
      if (a.resume) {                                   // frames are pure functions of their index: keep the ones on disk
        const before = frames.length;
        frames = frames.filter((f) => !fs.existsSync(path.join(dir, String(f).padStart(4, "0") + ".png")));
        console.log(`[${fmt}] resume: ${before - frames.length} frames already on disk`);
        if (!frames.length) continue;
      }
      console.log(`[${fmt}] ${frames.length} frames · scale ${a.scale} · q ${a.q} · ${a.workers} workers → ${path.relative(FILM, dir)}`);
      const log = await capture(browser, port, fmt, frames, dir, a);
      const ms = log.map((l) => l.ms), ks = log.map((l) => l.K);
      console.log(`  [${fmt}] avg ${(ms.reduce((x, y) => x + y, 0) / ms.length / 1000).toFixed(2)} s/frame · K avg ${(ks.reduce((x, y) => x + y, 0) / ks.length).toFixed(1)} max ${Math.max(...ks)}`);
      if (a.contact) sheet(fmt, dir, frames, label);
    }
  } finally { await browser.close(); server.close(); }

  if (a.contact || a.times || (a.frames && !a.encode) || !a.encode) return;
  for (const fmt of formats) {
    const miss = Array.from({ length: FRAMES }, (_, i) => i).filter((f) => !fs.existsSync(path.join(dirs[fmt], String(f).padStart(4, "0") + ".png")));
    if (miss.length) { console.log(`[${fmt}] ${miss.length} frames missing (first f${miss[0]}); not encoding`); return; }
  }
  const audio = makeAudio();
  for (const fmt of formats) {
    const file = encode(fmt, dirs[fmt], audio);
    const fr = []; for (let t = 0; t < TL.duration; t += 0.5) fr.push(Math.round(t * FPS)); fr.push(FRAMES - 1);
    sheet(fmt, dirs[fmt], fr, "final");
    console.log(`[${fmt}] → ${path.relative(FILM, file)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
