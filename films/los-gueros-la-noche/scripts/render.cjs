#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   La Noche — renderer

   node films/los-gueros-la-noche/scripts/render.cjs [options]

     --format 16x9|9x16|all   compositions to render (default: all)
     --range A-B              only frames with A <= t < B seconds (re-render a section)
     --times 0.5,1,1.5        only these timestamps (seconds)
     --contact                pre-render contact sheet: one frame every 0.5 s → film/out/contact-*-prerender.jpg
     --qa                     capture QA probes (text-on/text-off frames, layout, opacity curves)
     --workers N              parallel browser pages (default 3)
     --no-encode              stop after writing PNG frames

   Full render: film/build/frames/<fmt>/NNNN.png → audio → film/out/*.mp4 + posters.
   Every frame is window.film.seek(frame) followed by a screenshot, so any
   subset can be re-rendered and dropped into the sequence.
   ═══════════════════════════════════════════════════════════ */
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync, spawnSync } = require("child_process");

const FILM = path.resolve(__dirname, "..");
const REPO = path.resolve(FILM, "../..");
const BUILD = path.join(FILM, "build");
const OUT = path.join(FILM, "out");
const TL = JSON.parse(fs.readFileSync(path.join(FILM, "src", "timeline.json"), "utf8"));
const FPS = TL.fps;
const FRAMES = Math.round(TL.duration * FPS);

function loadPlaywright() {
  try { return require("playwright"); } catch (e) {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    return require(path.join(globalRoot, "playwright"));
  }
}

function parseArgs(argv) {
  const a = { format: "all", workers: 3, encode: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--format") a.format = argv[++i];
    else if (k === "--range") a.range = argv[++i].split("-").map(Number);
    else if (k === "--times") a.times = argv[++i].split(",").map(Number);
    else if (k === "--contact") a.contact = true;
    else if (k === "--qa") a.qa = true;
    else if (k === "--workers") a.workers = Number(argv[++i]);
    else if (k === "--no-encode") a.encode = false;
    else throw new Error("unknown option " + k);
  }
  return a;
}

/* ─── static server rooted at the repo (composition uses ../../ paths) ─── */

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg" };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = path.join(REPO, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function openPage(browser, port, fmt) {
  const { width, height } = TL.formats[fmt];
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { console.error(`[${fmt}] page error:`, e.message); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${port}/films/los-gueros-la-noche/src/index.html?format=${fmt}&render=1`);
  await page.evaluate(() => window.film.ready);
  return page;
}

async function captureFrames(browser, port, fmt, frames, dir, workers) {
  fs.mkdirSync(dir, { recursive: true });
  const chunks = Array.from({ length: workers }, () => []);
  frames.forEach((f, i) => chunks[Math.floor((i * workers) / frames.length)].push(f));
  let done = 0;
  const t0 = Date.now();
  await Promise.all(chunks.filter((c) => c.length).map(async (chunk) => {
    const page = await openPage(browser, port, fmt);
    for (const f of chunk) {
      await page.evaluate((fr) => window.film.seek(fr), f);
      await page.screenshot({ path: path.join(dir, String(f).padStart(4, "0") + ".png"), type: "png", animations: "disabled" });
      if (++done % 48 === 0) process.stdout.write(`  [${fmt}] ${done}/${frames.length} frames (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
    }
    await page.context().close();
  }));
}

/* ─── QA probes: per-card text-on / text-off frames, layout, opacity curves ─── */

function cardProbes() {
  const cards = {};
  for (const ev of TL.events) {
    const id = ev.el.split(" ")[0];
    if (!/^#(hook|reveal|tortillas|pastor|carta|lockup)$/.test(id)) continue;
    const c = (cards[id] = cards[id] || { id: id.slice(1), inEnd: 0, out: TL.duration });
    if (ev.anim === "out") c.out = ev.t;
    else c.inEnd = Math.max(c.inEnd, ev.t + ev.dur + (ev.stagger || 0.13) * 3);
  }
  for (const tr of TL.transitions) if (tr.type === "curtain" && tr.hold) cards["#carta"].out = Math.min(cards["#carta"].out, tr.start);
  return Object.values(cards).map((c) => ({ ...c, probe: Math.round(((c.inEnd + c.out) / 2) * FPS) }));
}

async function captureQA(browser, port, fmt) {
  const dir = path.join(BUILD, "qa", fmt);
  fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(browser, port, fmt);
  const probes = cardProbes();
  for (const p of probes) {
    await page.evaluate((fr) => window.film.seek(fr), p.probe);
    await page.screenshot({ path: path.join(dir, `${p.id}.png`) });
    p.layout = await page.evaluate(() => window.film.layout());
    await page.evaluate((fr) => window.film.seek(fr, { hideText: true }), p.probe);
    await page.screenshot({ path: path.join(dir, `${p.id}-bg.png`) });
  }
  // opacity curves for every event that carries a sound, to measure picture/sound sync
  const sync = [];
  for (const ev of TL.events.filter((e) => e.sfx)) {
    const f0 = Math.floor(ev.t * FPS) - 2;
    const curve = [];
    for (let f = f0; f < f0 + 30; f++) curve.push([f, await page.evaluate(([fr, sel]) => window.film.opacityAt(fr, sel), [f, ev.el])]);
    sync.push({ t: ev.t, el: ev.el, anim: ev.anim, curve });
  }
  // camera path for motion scoring
  const cam = [];
  for (let f = 0; f < FRAMES; f++) cam.push(await page.evaluate((fr) => window.film.placementAt(fr), f));
  fs.writeFileSync(path.join(dir, "qa.json"), JSON.stringify({ probes, sync, cam }, null, 1));
  await page.context().close();
}

/* ─── audio + encode ─── */

function run(cmd, args) { execFileSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"] }); }

function loudnorm(raw, out) {
  const { loudness, truePeak } = TL.audio;
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af",
    `loudnorm=I=${loudness}:TP=${truePeak}:LRA=11:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  const m = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf("{"), r.stderr.lastIndexOf("}") + 1));
  run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af",
    `loudnorm=I=${loudness}:TP=${truePeak}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
    "-c:a", "pcm_s16le", out]);
}

function makeAudio() {
  const raw = path.join(BUILD, "audio-raw.wav"), out = path.join(BUILD, "audio.wav");
  run("python3", ["-I", path.join(FILM, "src", "audio.py"), raw]);
  loudnorm(raw, out);
  return out;
}

function encode(fmt, audio) {
  const frames = path.join(BUILD, "frames", fmt, "%04d.png");
  const file = path.join(OUT, `los-gueros-la-noche-${fmt}.mp4`);
  run("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", frames, "-i", audio,
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", file]);
  return file;
}

function posters(fmt) {
  const shots = { hook: Math.round(1.9 * FPS), lockup: FRAMES - 1 };
  for (const [name, f] of Object.entries(shots)) {
    run("ffmpeg", ["-v", "error", "-y", "-i", path.join(BUILD, "frames", fmt, String(f).padStart(4, "0") + ".png"),
      "-q:v", "2", path.join(OUT, `poster-${fmt}-${name}.jpg`)]);
  }
}

function contactSheet(fmt, dir, frames, label) {
  run("python3", ["-I", path.join(FILM, "scripts", "contact_sheet.py"), dir, path.join(OUT, `contact-${fmt}-${label}.jpg`), fmt, String(FPS), ...frames.map(String)]);
}

/* ─── main ─── */

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const formats = args.format === "all" ? Object.keys(TL.formats) : [args.format];
  run("python3", ["-I", path.join(FILM, "scripts", "plate.py")]);
  fs.mkdirSync(OUT, { recursive: true });

  const server = await serve();
  const port = server.address().port;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--hide-scrollbars"] });

  try {
    for (const fmt of formats) {
      if (args.qa) { console.log(`[${fmt}] QA probes`); await captureQA(browser, port, fmt); continue; }
      if (args.contact) {
        const frames = [];
        for (let t = 0; t < TL.duration; t += 0.5) frames.push(Math.round(t * FPS));
        frames.push(FRAMES - 1);
        const dir = path.join(BUILD, "contact", fmt);
        console.log(`[${fmt}] contact sheet: ${frames.length} frames`);
        await captureFrames(browser, port, fmt, frames, dir, args.workers);
        contactSheet(fmt, dir, frames, "prerender");
        continue;
      }
      let frames = Array.from({ length: FRAMES }, (_, i) => i);
      if (args.range) frames = frames.filter((f) => f / FPS >= args.range[0] - 1e-9 && f / FPS < args.range[1] - 1e-9);
      if (args.times) frames = args.times.map((t) => Math.round(t * FPS));
      console.log(`[${fmt}] rendering ${frames.length} frames with ${args.workers} workers`);
      await captureFrames(browser, port, fmt, frames, path.join(BUILD, "frames", fmt), args.workers);
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (args.qa || args.contact || args.times || !args.encode) return;
  const missing = formats.flatMap((fmt) => Array.from({ length: FRAMES }, (_, i) => i)
    .filter((f) => !fs.existsSync(path.join(BUILD, "frames", fmt, String(f).padStart(4, "0") + ".png"))).map((f) => `${fmt}:${f}`));
  if (missing.length) { console.error(`cannot encode, ${missing.length} frames missing (first: ${missing[0]})`); process.exit(1); }

  console.log("audio: synthesizing from timeline.json + loudness normalize");
  const audio = makeAudio();
  for (const fmt of formats) {
    const file = encode(fmt, audio);
    posters(fmt);
    const sheet = [];
    for (let t = 0; t < TL.duration; t += 0.5) sheet.push(Math.round(t * FPS));
    sheet.push(FRAMES - 1);
    contactSheet(fmt, path.join(BUILD, "frames", fmt), sheet, "final");
    console.log(`[${fmt}] → ${path.relative(REPO, file)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
