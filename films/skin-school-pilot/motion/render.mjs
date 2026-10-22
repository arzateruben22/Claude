// Skin School cinema pilot: a fork of Lumevina's frame engine (docs/school/motion/render.mjs on the
// Lumevina branch) with the cinema finish added. The changes are marked "cinema:"; everything else is hers.
//
//   node films/skin-school-pilot/motion/render.mjs [--aspect 16x9,9x16] [--fps 30] [--quick] [--plain] [--from S --to S]
//     --plain  her renderer exactly (no cinema finish), for side-by-side comparisons
//     --from/--to  render only part of the clip (review sheets)
//
// Below: her original header.
//
// For every scene in scenes.mjs it opens the scene page in Chromium at the
// frame size, calls seek(t) for every frame, captures the frame and pipes it
// into ffmpeg (H.264, yuv420p, faststart). It writes:
//   img/school/video/<id>.mp4 + <id>.webm + <id>.jpg     the lesson's explainer (16:9, 1280×720; the WebM for browsers without H.264)
//   marketing/ads/out/video/<id>-9x16.mp4 + .jpg           the Reels/TikTok cut (9:16, 720×1280), only with --aspect 9x16
//   docs/school/motion/review/<id>-<aspect>.jpg            a contact sheet, one frame every 1.5 s (not committed)
//   docs/school/motion/render-log.json                     frames, bytes, a hash of every frame, warnings
//   docs/school/videos.js                                  the lessons with a clip, for the player
//
// Review happens in code before anyone watches: a text that runs past the
// frame or sits on another text at a shot's settled moments, and a stretch
// where nothing moves for longer than 2.5 s, are both warned about.
// --quick renders at 6 fps with no encode, for the review sheet only.
// --verify re-renders a sample of frames and compares their hashes with the
// log: "deterministic: true" is the evidence that the clip is a pure function
// of time.
// --cues writes the scene's event table (window.SCENE_CUES) to build/cues-<id>-<aspect>.json
// for the studio's sound (kits/cinema/studio), and renders nothing.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// cinema: her palette (scenes.mjs on the Lumevina branch), inlined so the pilot needs only the solid scene
const PALETTE = { rose: "#f4c9d6", rose2: "#eab9c8", gold: "#e3b48f", green: "#32d74b", red: "#ff7a6b", blue: "#8fd3ff", t2: "#a1a1a6", t3: "#6e6e73" };

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");   // cinema: the pilot folder
const { chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || root, "x.js"))("playwright");

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); if (i === -1) return d; const v = args[i + 1]; return v && !v.startsWith("--") ? v : true; };
const only = opt("only", "") ? String(opt("only")).split(",") : null;
const aspects = String(opt("aspect", "16x9")).split(",");
const quick = opt("quick", false) === true;
const verify = opt("verify", false) === true;
const plain = opt("plain", false) === true;     // cinema: off = her renderer exactly
const cuesOnly = opt("cues", false) === true;   // cinema: write the scene's event table for the sound, render nothing
// cinema: the directed 8-2 (scenes3d.mjs) or her scene as it is on the Lumevina branch (scenes3d-original.mjs)
const { SCENES } = await import(opt("scenes", "directed") === "original" ? "./scenes3d-original.mjs" : "./scenes3d.mjs");
const from = Number(opt("from", 0)), to = opt("to", null);
const times = opt("times", null) ? String(opt("times")).split(",").map(Number) : null;   // cinema: stills only
const fps = quick ? 6 : Number(opt("fps", 30));
const SIZES = { "16x9": [1280, 720], "9x16": [720, 1280] };
const OUT = { "16x9": path.join(root, "out"), "9x16": path.join(root, "out") };
const review = path.join(root, "build", "review"), logFile = path.join(root, "build", "render-log.json");
fs.mkdirSync(review, { recursive: true });
const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, "utf8")) : {};
const font = "file://" + path.join(root, "fonts/inter-var.woff2");
const runtime = fs.readFileSync(path.join(here, "motion.js"), "utf8");
// the solid scenes share one studio set (studio3d.js): rounded blocks, a warm floor, a drifting camera.
// Every box a scene makes becomes a SoftBox, then the set goes in right after the three.js import.
const studio3d = fs.readFileSync(path.join(here, "studio3d.js"), "utf8");
// cinema: the finish goes in before the studio set, so the studio's camera drift wraps it.
// It is the studio's cinema kit (kits/cinema/cinema3d.js at the repo root), read from there.
const cinema3d = plain ? "" : fs.readFileSync(path.join(here, "../../../kits/cinema/cinema3d.js"), "utf8");
const studioModule = (src) => {
  const imp = 'import * as THREE from "../vendor/three.module.min.js";';
  let body = src.split("new THREE.BoxGeometry(").join("new SoftBox(");
  if (cinema3d) body = body.split("new THREE.WebGLRenderer(").join("cinemaRenderer(");   // cinema: see kits/cinema/cinema3d.js (r160 instance render)
  const at = body.indexOf(imp);
  return at < 0 ? body : body.slice(0, at + imp.length) + "\n" + cinema3d + "\n" + studio3d + "\n" + body.slice(at + imp.length);
};

if (opt("list", false) === true) {
  for (const s of Object.values(SCENES)) console.log(`${s.id}  ${s.dur}s  ${s.shots.length} shots  ${s.title.replace(/<[^>]+>/g, "")}`);
  process.exit(0);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// a deterministic film grain: an SVG turbulence with a fixed seed, tiled as a background so it rasterizes once
const grain = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .07 0"/></filter><rect width="320" height="320" filter="url(#g)"/></svg>`);

const page = (scene, W, H) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "InterV"; src: url("${font}") format("woff2"); font-weight: 100 900; }
*, *::before, *::after { box-sizing: border-box; margin: 0; transition: none !important; animation: none !important; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; color: #f5f5f7; font-family: "InterV", -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.stage { position: relative; width: ${W}px; height: ${H}px; padding: 6vmin 6.5vmin 5vmin; display: flex; flex-direction: column; gap: 3.5vmin; background: radial-gradient(90vmax 60vmax at 85% -5%, #1b1316 0%, #000 60%); overflow: hidden; }
.grain { position: absolute; inset: 0; background: url("${grain}"); pointer-events: none; }
.amb { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.amb i { position: absolute; width: 120vmax; height: 120vmax; border-radius: 50%; }
.amb i:first-child { right: -55vmax; top: -70vmax; background: radial-gradient(closest-side, rgba(234,185,200,.13), rgba(234,185,200,0)); }
.amb i:last-child { left: -60vmax; bottom: -75vmax; background: radial-gradient(closest-side, rgba(226,176,140,.10), rgba(226,176,140,0)); }
.dust { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
header { position: relative; z-index: 2; }
.k { font-size: 2.5vmin; font-weight: 600; color: ${PALETTE.rose}; letter-spacing: .02em; }
h1 { font-size: 6vmin; font-weight: 700; letter-spacing: -.035em; line-height: 1.04; margin-top: 1vmin; max-width: 125vmin; text-wrap: balance; }
.grad { background: linear-gradient(95deg, #f7d3de 0%, #eab9c8 45%, #e2b08c 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
main.canvas { position: relative; flex: 1; min-height: 0; z-index: 1; }
.shot { position: absolute; inset: 0; visibility: hidden; opacity: 0; }
footer { position: relative; z-index: 2; display: flex; align-items: flex-end; justify-content: space-between; gap: 4vmin; min-height: 9vmin; }
.capwrap { flex: 1; opacity: 0; }
.cap { display: inline-block; font-size: 3vmin; line-height: 1.35; font-weight: 500; padding: 1.4vmin 2.4vmin; border-radius: 3.2vmin; background: rgba(17,17,19,.92); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); max-width: 110vmin; }
.foot { font-size: 2.1vmin; color: ${PALETTE.t3}; white-space: nowrap; }
.card { background: #111113; border: 1px solid rgba(255,255,255,.1); border-radius: 4.6vmin; padding: 2.6vmin 3vmin; }
.chip { display: inline-flex; align-items: center; gap: 1.2vmin; padding: 1.3vmin 2.4vmin; border-radius: 999px; border: 1.5px solid ${PALETTE.rose2}; color: ${PALETTE.rose2}; font-size: 2.6vmin; font-weight: 600; white-space: nowrap; }
.lbl { font-size: 2.5vmin; color: ${PALETTE.t2}; line-height: 1.4; }
.big { font-size: 5vmin; font-weight: 700; letter-spacing: -.03em; }
svg text { font-family: "InterV", system-ui, sans-serif; }
@media (orientation: portrait) { .stage { padding: 7vmin 6vmin 5vmin; } h1 { font-size: 6.4vmin; } .foot { display: none; } .cap { max-width: 100%; } }
${scene.css}
</style></head><body><div class="stage">
<div class="amb" aria-hidden="true"><i></i><i></i></div><canvas class="dust" width="${W}" height="${H}" aria-hidden="true"></canvas>
<header><p class="k">${esc(scene.kicker)}</p><h1>${scene.title}</h1></header>
<main class="canvas">${scene.html}</main>
<footer><div class="capwrap"><span class="cap" id="cap"></span></div><p class="foot">Lumevina Skin School · Evelyn Romero</p></footer>
<div class="grain"></div>
</div>
<script>${runtime}</script>
<script>
window.C = ${JSON.stringify(PALETTE)};
window.SCENE = ${JSON.stringify({ id: scene.id, dur: scene.dur, poster: scene.poster, shots: scene.shots })};
window.W = ${W}; window.H = ${H};
${scene.setup ? `(${scene.setup.toString()})(M, window.C);` : ""}
${scene.seek ? `window.seek = function (t) { var st = M.stage(t); (${scene.seek.toString()})(t, st, M, window.C); };` : ""}
</script>${scene.module ? `<script type="module">${studioModule(scene.module)}</script>` : ""}</body></html>`;

const sha = (b) => crypto.createHash("sha1").update(b).digest("hex");
const AUDIT = `(() => {
  const W = window.W, H = window.H, bad = [];
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || Number(cs.opacity) < 0.6 || cs.display === "none") return false; } return true; };
  const leaves = [...document.querySelectorAll(".canvas *, header *")].filter((el) => vis(el) && (el instanceof SVGTextElement || [...el.childNodes].every((n) => n.nodeType === 3)) && (el.textContent || "").trim());
  for (const el of leaves) { const r = el.getBoundingClientRect(); const t = el.textContent.trim().slice(0, 36); if (r.right > W - 4 || r.bottom > H - 4 || r.left < 4) bad.push("past the frame: " + t); }
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    if (leaves[i].contains(leaves[j]) || leaves[j].contains(leaves[i])) continue;
    const a = leaves[i].getBoundingClientRect(), b = leaves[j].getBoundingClientRect();
    if (a.left < b.right - 3 && b.left < a.right - 3 && a.top < b.bottom - 3 && b.top < a.bottom - 3) bad.push("overlap: " + leaves[i].textContent.trim().slice(0, 24) + " / " + leaves[j].textContent.trim().slice(0, 24));
  }
  return bad;
})()`;

const encode = (file, fpsOut) => spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fpsOut), "-i", "pipe:0",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "medium", "-profile:v", "high", "-level", "4.0", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
const tmp = path.join(here, ".tmp"); fs.mkdirSync(tmp, { recursive: true });
let videos = {};
const sheetFrames = [];
const videosFile = path.join(here, "..", "videos.js");
if (fs.existsSync(videosFile)) { const w = {}; new Function("window", fs.readFileSync(videosFile, "utf8"))(w); videos = w.SCHOOL_VIDEOS || {}; }

for (const scene of Object.values(SCENES)) {
  if (only && !only.includes(scene.id)) continue;
  for (const aspect of aspects) {
    const [W, H] = SIZES[aspect];
    const t0 = Date.now();
    const file = path.join(tmp, `${scene.id}-${aspect}.html`);
    fs.writeFileSync(file, page(scene, W, H));
    const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await pg.addInitScript(() => { let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; const T0 = 1700000000000; Date.now = () => T0; performance.now = () => 0; window.requestAnimationFrame = () => 0; });
    const errors = [];
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.goto("file://" + file);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForFunction(() => typeof window.seek === "function", null, { timeout: 30000 }).catch(() => {});
    if (errors.length || !(await pg.evaluate(() => typeof window.seek === "function"))) { console.error(`${scene.id} ${aspect}: the scene page failed to load: ${errors.join(" | ") || "no seek()"}`); await pg.close(); continue; }
    if (cuesOnly) {
      // cinema: the scene's own event table, in film time, for the studio (kits/cinema/studio). Labels get
      // their on-screen position from the page itself, once they have settled, so the sound pans with them.
      const cues = await pg.evaluate(() => window.SCENE_CUES ? window.SCENE_CUES() : null);
      if (!cues) { console.error(`${scene.id}: the scene has no SCENE_CUES()`); await pg.close(); continue; }
      cues.shown = {};
      for (const e of cues.events.filter((e) => e.el)) {
        e.pos = await pg.evaluate(([t, id]) => { window.seek(t); const r = document.getElementById(id).getBoundingClientRect(); return [+((r.left + r.width / 2) / innerWidth).toFixed(3), +((r.top + r.height / 2) / innerHeight).toFixed(3)]; }, [e.t + 0.7, e.el]);
        // and, independently of the table, the first frame on which the element is actually visible
        for (let f = Math.floor((e.t - 0.2) * fps); f <= Math.ceil((e.t + 0.5) * fps); f++) {
          const op = await pg.evaluate(([t, id]) => { window.seek(t); return +getComputedStyle(document.getElementById(id)).opacity; }, [f / fps, e.el]);
          if (op > 0.02) { cues.shown[e.tag] = +(f / fps).toFixed(4); break; }
        }
      }
      const cueFile = path.join(root, "build", `cues-${scene.id}-${aspect}.json`);
      fs.writeFileSync(cueFile, JSON.stringify({ scene: scene.id, aspect, fps, ...cues }, null, 1));
      console.log(`${scene.id} ${aspect}: ${cues.events.length} cues → ${path.relative(process.cwd(), cueFile)}`);
      await pg.close(); continue;
    }
    const cdp = await pg.context().newCDPSession(pg);
    const frames = Math.round(scene.dur * fps), hashes = [], samples = [], warnings = [];
    const outDir = OUT[aspect]; fs.mkdirSync(outDir, { recursive: true });
    const base = (aspect === "16x9" ? scene.id : `${scene.id}-${aspect}`) + (opt("scenes", "directed") === "original" ? "-original" : "") + (plain ? "-plain" : "");
    const mp4 = path.join(outDir, `${base}.mp4`), poster = path.join(outDir, `${base}.jpg`);
    let ff = null;
    if (verify) {
      const logged = (log[scene.id] || {})[aspect] || {}, prev = logged.samples || [];
      let same = 0, diff = 0; const diffs = [];
      for (const [i, h] of prev) {
        // cinema: the same call as the frame loop (a plain seek draws the scene unfinished, so it can never match)
        await pg.evaluate(([t, fps]) => { if (window.cinemaFrame) { window.CINEMA.fps = fps; return window.cinemaFrame(t); } window.seek(t); return null; }, [i / (logged.fps || fps), Number(opt("fps", 30))]);
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
        if (sha(Buffer.from(data, "base64")) === h) same++; else { diff++; diffs.push(i); }
      }
      console.log(`${scene.id} ${aspect}: deterministic: ${diff === 0 && same > 0} (${same} of ${same + diff} sampled frames match the log)${diffs.length ? "; differing frames: " + diffs.join(",") : ""}`);
      (log[scene.id] ||= {})[aspect] = { ...((log[scene.id] || {})[aspect] || {}), verified: diff === 0 && same > 0, verifiedAt: new Date().toISOString().slice(0, 10) };
      await pg.close(); continue;
    }
    if (!quick && !to && !times) ff = encode(mp4, fps);
    const sheetEvery = Math.max(1, Math.round((quick ? 0.5 : 1.5) * fps));
    const kLog = [];
    const list = times ? times.map((x) => Math.round(x * fps)) : Array.from({ length: (to ? Math.round(Number(to) * fps) : frames) - Math.round(from * fps) }, (_, k) => k + Math.round(from * fps));
    for (const i of list) {
      const t = i / fps;
      // cinema: one call per frame does the probe, the K sub-frames, the depth and the finish
      const info = await pg.evaluate(([t, fps]) => { if (window.cinemaFrame) { window.CINEMA.fps = fps; return window.cinemaFrame(t); } window.seek(t); return null; }, [t, Number(opt("fps", 30))]);   // the shutter is always the final frame rate's, even in --quick
      if (info) kLog.push(info.K);
      if (info && i % 30 === 0) console.log(`  ${scene.id} ${aspect} ${t.toFixed(1)}s K${info.K} ${info.px}px focus ${info.focusDist}`);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
      const buf = Buffer.from(data, "base64");
      hashes.push(sha(buf));
      if (i % 15 === 0) samples.push([i, hashes[i]]);
      if (times || i % sheetEvery === 0) sheetFrames.push([t, buf]);
      if (ff && !ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (!quick && Math.abs(t - scene.poster) < 0.5 / fps) { const j = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 88 }); fs.writeFileSync(poster, Buffer.from(j.data, "base64")); }
    }
    // review 1: text at each shot's settled moments
    for (let k = 0; k < scene.shots.length; k++) {
      const a = scene.shots[k].at, b = k + 1 < scene.shots.length ? scene.shots[k + 1].at : scene.dur;
      for (const t of [a + Math.min(3, (b - a) * 0.6), b - 0.2]) {
        await pg.evaluate((t) => window.seek(t), t);
        for (const w of await pg.evaluate(AUDIT)) warnings.push(`${scene.shots[k].name} @${t.toFixed(1)}s ${w}`);
      }
    }
    // review 2: dead air (identical frames) longer than 2.5 s, the closing hold excepted
    let run = 1;
    for (let i = 1; i <= hashes.length; i++) {
      if (i < hashes.length && hashes[i] === hashes[i - 1]) { run++; continue; }
      if (run / fps > 2.5 && i < hashes.length) warnings.push(`still for ${(run / fps).toFixed(1)}s ending at ${(i / fps).toFixed(1)}s`);
      run = 1;
    }
    if (ff) { ff.stdin.end(); await new Promise((r) => ff.on("close", r)); }
    if (ff && aspect === "16x9") await new Promise((r) => spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", mp4, "-c:v", "libvpx-vp9", "-crf", "33", "-b:v", "0", "-row-mt", "1", "-cpu-used", "4", "-an", path.join(outDir, `${base}.webm`)], { stdio: "inherit" }).on("close", r));
    // the contact sheet
    const sheet = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const cols = aspect === "16x9" ? 4 : 6, cw = Math.floor(1584 / cols);
    await sheet.setContent(`<body style="margin:8px;background:#222;display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;font:12px/1.4 sans-serif;color:#ddd">${sheetFrames.map(([t, b]) => `<div><img src="data:image/png;base64,${b.toString("base64")}" style="width:${cw - 8}px;display:block;border:1px solid #444"><div>${t.toFixed(1)}s</div></div>`).join("")}</body>`);
    await sheet.screenshot({ path: path.join(review, `${base}${opt("label", "") ? "-" + opt("label") : ""}.jpg`), fullPage: true, type: "jpeg", quality: 80 });
    await sheet.close();
    sheetFrames.length = 0;
    await pg.close();
    const bytes = !quick && fs.existsSync(mp4) ? fs.statSync(mp4).size : 0;
    const entry = { frames, fps, dur: scene.dur, w: W, h: H, bytes, hash: sha(Buffer.from(hashes.join(""))), samples, warnings, renderSec: Math.round((Date.now() - t0) / 100) / 10, renderedAt: new Date().toISOString().slice(0, 10), quick, plain,
      kAvg: kLog.length ? +(kLog.reduce((a, b) => a + b, 0) / kLog.length).toFixed(1) : null, kMax: kLog.length ? Math.max(...kLog) : null };
    (log[scene.id] ||= {})[aspect] = entry;
    if (!quick && aspect === "16x9") videos[scene.id] = { dur: scene.dur, w: W, h: H, bytes };
    console.log(`${scene.id} ${aspect}: ${frames} frames, ${entry.renderSec}s${bytes ? `, ${(bytes / 1024).toFixed(0)} KB` : " (quick)"}${warnings.length ? `\n  ! ${warnings.join("\n  ! ")}` : ""}`);
  }
}
await browser.close();
if (!process.env.KEEP_TMP) fs.rmSync(tmp, { recursive: true, force: true });
if (!times) fs.writeFileSync(logFile, JSON.stringify(log, null, 1));   // cinema: a stills run leaves the log (and the samples --verify reads) alone
if (false) fs.writeFileSync(videosFile, `/* GENERATED by docs/school/motion/render.mjs: the lessons with a rendered explainer in img/school/video/. Don't edit; render again. */\nwindow.SCHOOL_VIDEOS = ${JSON.stringify(videos)};\n`);
