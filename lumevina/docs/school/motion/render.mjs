// Lumevina Skin School motion studio: the frame engine.
//
//   node docs/school/motion/render.mjs [--only 1-1,6-2] [--aspect 16x9,9x16] [--fps 30] [--quick] [--verify] [--list]
//     (from lumevina/; playwright from PLAYWRIGHT_DIR or the project; CHROMIUM for the browser)
//
// For every scene in scenes.mjs it opens the scene page in Chromium at the
// frame size, calls seek(t) for every frame, captures the frame and pipes it
// into ffmpeg (H.264, yuv420p, faststart). Every page is the same room: a warm
// backdrop with a pool of light drawn on a canvas behind the scene (motion.js),
// the header, the scene's canvas, the caption bar and a film grain. It writes:
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

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { SCENES as FLAT, PALETTE } from "./scenes.mjs";
import { SCENES as SOLID } from "./scenes3d.mjs";
const SCENES = { ...FLAT, ...SOLID };
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
// the five free lessons (docs/school/curriculum.js: free) get the studio cut: "Free lesson n of 5"
// in the kicker and a closing card after the last shot, teasing the next free lesson, or the rest
// of the course after the fifth. The card adds END seconds; the scene's own timing is untouched.
const END = 4.5;
const FREE = (() => { const w = {}; new Function("window", fs.readFileSync(path.join(here, "..", "curriculum.js"), "utf8"))(w); return (w.SCHOOL && w.SCHOOL.free) || []; })();
const LESSONS = (() => { const w = {}; new Function("window", fs.readFileSync(path.join(here, "..", "curriculum.js"), "utf8"))(w); let n = 0; (w.SCHOOL.levels || []).forEach((l) => l.modules.forEach((m) => { n += m.lessons.length; })); return n; })();
FREE.forEach((id, k) => {
  const sc = SCENES[id]; if (!sc || sc.endAt) return;
  const nx = SCENES[FREE[k + 1]];
  sc.endAt = sc.dur; sc.dur = Math.round((sc.dur + END) * 10) / 10;
  sc.kicker = `Free lesson ${k + 1} of ${FREE.length} · ${sc.kicker}`;
  sc.endcard = nx
    ? `<span class="ec-pill" data-i>Free lesson ${k + 1} of ${FREE.length}</span><p class="ec-sm" data-i>Next free lesson</p><p class="ec-big" data-i>${nx.title}</p>`
    : `<span class="ec-pill" data-i>Free lesson ${k + 1} of ${FREE.length}</span><p class="ec-big" data-i>${LESSONS - FREE.length} more lessons <span class="grad">inside Skin School.</span></p><p class="ec-sm" data-i>Three levels, one course, made with Evelyn</p>`;
});
const { chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || root, "x.js"))("playwright");

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); if (i === -1) return d; const v = args[i + 1]; return v && !v.startsWith("--") ? v : true; };
const only = opt("only", "") ? String(opt("only")).split(",") : null;
const aspects = String(opt("aspect", "16x9")).split(",");
const quick = opt("quick", false) === true;
const stills = opt("at", "") ? String(opt("at")).split(",").map(Number) : null;   // --at 4,9.5: those moments as PNGs in review/, nothing else
const verify = opt("verify", false) === true;
const fps = quick ? 6 : Number(opt("fps", 30));
const SIZES = { "16x9": [1280, 720], "9x16": [720, 1280] };
const OUT = { "16x9": path.join(root, "img/school/video"), "9x16": path.join(root, "marketing/ads/out/video") };
const review = path.join(here, "review"), logFile = path.join(here, "render-log.json");
fs.mkdirSync(review, { recursive: true });
const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, "utf8")) : {};
const font = "file://" + path.join(root, "docs/blueprint/inter-var.woff2");
const runtime = fs.readFileSync(path.join(here, "motion.js"), "utf8");
// the solid scenes share one studio set (studio3d.js): rounded blocks, a warm floor, a drifting camera.
// Every box a scene makes becomes a SoftBox, then the set goes in right after the three.js import.
const studio3d = fs.readFileSync(path.join(here, "studio3d.js"), "utf8");
// the skin (skin3d.js): the scenes' grids of cells become one piece of tissue, shaded as skin;
// every InstancedMesh of cells a scene makes becomes a stand-in that writes into it. --cubes renders the old blocks.
const skin3d = opt("cubes", false) === true ? "" : fs.readFileSync(path.join(here, "skin3d.js"), "utf8");
// the film finish (cinema3d.js, from the cinema kit on the made-with-claude-film branch): each frame a
// short exposure with real motion blur, focus where the scene says, bloom and a filmic tone curve.
// It goes in before the studio set; --plain renders without it.
const plain = opt("plain", false) === true;
const cinema3d = plain ? "" : fs.readFileSync(path.join(here, "cinema3d.js"), "utf8");
const studioModule = (src) => {
  const imp = 'import * as THREE from "../vendor/three.module.min.js";';
  let body = src.split("new THREE.BoxGeometry(").join("new SoftBox(");
  if (cinema3d) body = body.split("new THREE.WebGLRenderer(").join("cinemaRenderer(");
  if (skin3d) body = body.split("new THREE.InstancedMesh(").join("skinOrInstanced(");
  const at = body.indexOf(imp);
  return at < 0 ? body : body.slice(0, at + imp.length) + "\n" + cinema3d + "\n" + studio3d + "\n" + skin3d + "\n" + body.slice(at + imp.length);
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
.stage { position: relative; width: ${W}px; height: ${H}px; padding: 6vmin 6.5vmin 5vmin; display: flex; flex-direction: column; gap: 3.5vmin; background: #0b0807; overflow: hidden; }
.grain { position: absolute; inset: 0; background: url("${grain}"); pointer-events: none; }
.room { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
header { position: relative; z-index: 2; }
.stage:has(#gl) header::before { content: ""; position: absolute; z-index: -1; left: -10vmin; right: -10vmin; top: -12vmin; bottom: -7vmin; background: linear-gradient(180deg, rgba(9,6,6,.86), rgba(9,6,6,.6) 58%, rgba(9,6,6,0)); pointer-events: none; }   /* a directed solid scene can fill the frame: a soft scrim keeps the title legible */
.k { font-size: 2.5vmin; font-weight: 600; color: ${PALETTE.rose}; letter-spacing: .02em; }
h1 { font-size: 6vmin; font-weight: 700; letter-spacing: -.035em; line-height: 1.04; margin-top: 1vmin; max-width: 125vmin; text-wrap: balance; }
.grad { background: linear-gradient(95deg, #f7d3de 0%, #eab9c8 45%, #e2b08c 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
main.canvas { position: relative; flex: 1; min-height: 0; z-index: 1; }
.shot { position: absolute; inset: 0; visibility: hidden; opacity: 0; }
footer { position: relative; z-index: 2; display: flex; align-items: flex-end; justify-content: space-between; gap: 4vmin; min-height: 9vmin; }
.capwrap { flex: 1; opacity: 0; }
.cap { display: inline-block; font-size: 3vmin; line-height: 1.35; font-weight: 500; padding: 1.4vmin 2.4vmin; border-radius: 3.2vmin; background: rgba(24,17,16,.93); box-shadow: 0 1.2vmin 3vmin rgba(0,0,0,.45), inset 0 1px 0 rgba(255,225,205,.14), inset 0 0 0 1px rgba(255,255,255,.07); max-width: 110vmin; }
.foot { font-size: 2.1vmin; color: ${PALETTE.t3}; white-space: nowrap; }
.card { background: #1a1416; border: 1px solid rgba(255,255,255,.1); border-radius: 4.6vmin; padding: 2.6vmin 3vmin; }
.obj-sh { box-shadow: 0 1.6vmin 3.4vmin rgba(0,0,0,.5), 0 .3vmin .7vmin rgba(0,0,0,.35), inset 0 1px 0 rgba(255,225,205,.17); }
.obj-sh.lit { box-shadow: 0 1.6vmin 3.4vmin rgba(0,0,0,.45), 0 .3vmin .7vmin rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.4); }
.obj-lt { background-image: linear-gradient(165deg, rgba(255,225,205,.075), rgba(255,225,205,0) 55%); }
.obj-lt.lit { background-image: linear-gradient(165deg, rgba(255,255,255,.16), rgba(255,255,255,0) 60%); }
.chip { display: inline-flex; align-items: center; gap: 1.2vmin; padding: 1.3vmin 2.4vmin; border-radius: 999px; border: 1.5px solid ${PALETTE.rose2}; color: ${PALETTE.rose2}; font-size: 2.6vmin; font-weight: 600; white-space: nowrap; }
.lbl { font-size: 2.5vmin; color: ${PALETTE.t2}; line-height: 1.4; }
.big { font-size: 5vmin; font-weight: 700; letter-spacing: -.03em; }
svg text { font-family: "InterV", system-ui, sans-serif; }
/* the free lessons' closing card: the frame softens and darkens behind it, the next lesson rises in */
.endc { position: absolute; inset: 0; z-index: 6; display: grid; place-items: center; visibility: hidden; opacity: 0;
  background: radial-gradient(110% 90% at 50% 45%, rgba(26,16,14,.55), rgba(6,4,4,.92)); -webkit-backdrop-filter: blur(1.6vmin) saturate(1.1); backdrop-filter: blur(1.6vmin) saturate(1.1); }
.ec-in { display: flex; flex-direction: column; align-items: center; gap: 2.4vmin; text-align: center; padding: 0 8vmin; max-width: 150vmin; }
.ec-mark { margin: 0; font-size: 3vmin; font-weight: 700; letter-spacing: .02em; }
.ec-mark span { font-weight: 500; color: ${PALETTE.t2}; margin-left: .6vmin; }
.ec-line { display: block; width: 18vmin; height: .4vmin; border-radius: .2vmin; background: linear-gradient(90deg, #f7d3de, #eab9c8 45%, #e2b08c); transform-origin: 50% 50%; }
.ec-pill { display: inline-block; padding: 1.1vmin 2.6vmin; border-radius: 999px; border: 1.5px solid rgba(244,201,214,.6); color: #f4c9d6; font-size: 2.4vmin; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
.ec-sm { margin: 0; font-size: 2.8vmin; color: ${PALETTE.t2}; font-weight: 500; }
.ec-big { margin: 0; font-size: 7vmin; font-weight: 700; letter-spacing: -.035em; line-height: 1.05; text-wrap: balance; }
@media (orientation: portrait) { .ec-big { font-size: 8.4vmin; } .ec-in { padding: 0 7vmin; } }
@media (orientation: portrait) { .stage { padding: 7vmin 6vmin 5vmin; } h1 { font-size: 6.4vmin; } .foot { display: none; } .cap { max-width: 100%; } }
${scene.bare ? "header, footer { display: none !important; } .stage { padding: 0; gap: 0; } main.canvas { position: absolute; inset: 0; }" : ""}
${scene.css}
</style></head><body><div class="stage">
<canvas class="room" width="${W}" height="${H}" aria-hidden="true"></canvas>
<header><p class="k">${esc(scene.kicker)}</p><h1>${scene.title}</h1></header>
<main class="canvas">${scene.html}</main>
<footer><div class="capwrap"><span class="cap" id="cap"></span></div><p class="foot">Lumevina Skin School · Evelyn Romero</p></footer>
${scene.endcard ? `<div class="endc" id="endc"><div class="ec-in"><p class="ec-mark" data-i>Lumevina <span>Skin School</span></p><i class="ec-line" data-i></i>${scene.endcard}</div></div>` : ""}
<div class="grain"></div>
</div>
<script>${runtime}</script>
<script>
window.C = ${JSON.stringify(PALETTE)};
window.SCENE = ${JSON.stringify({ id: scene.id, dur: scene.dur, poster: scene.poster, shots: scene.shots, endAt: scene.endAt || null })};
window.W = ${W}; window.H = ${H};
${scene.setup ? `(${scene.setup.toString()})(M, window.C);` : ""}
${scene.seek ? `window.seek = function (t) { var st = M.stage(t); (${scene.seek.toString()})(t, st, M, window.C); };` : ""}
</script>${scene.module ? `<script type="module">${studioModule(scene.module)}</script>` : ""}</body></html>`;

const sha = (b) => crypto.createHash("sha1").update(b).digest("hex");
const AUDIT = `(() => {
  const W = window.W, H = window.H, bad = [];
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || Number(cs.opacity) < 0.6 || cs.display === "none") return false; } return true; };
  // a text leaf: an SVG text, or an element whose children are text and empty marks (a colour dot in a label or chip)
  const leaves = [...document.querySelectorAll(".canvas *, header *")].filter((el) => vis(el) && (el instanceof SVGTextElement || [...el.childNodes].every((n) => n.nodeType === 3 || !(n.textContent || "").trim())) && (el.textContent || "").trim());
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

// the last two flags make the compositor finish every raster before it draws a frame: without them a
// capture can show a tile (a frame-wide band 256 px tall) at low resolution while something in it
// is still changing, a lighter stripe across the frame for a frame or two
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files", "--run-all-compositor-stages-before-draw", "--disable-checker-imaging"] });
const tmp = path.join(here, `.tmp-${process.pid}`); fs.mkdirSync(tmp, { recursive: true });   // one folder per run: a stills run beside a long render must not sweep its pages away
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
    if (opt("skin", "")) await pg.addInitScript((o) => { window.SKIN_OPTS = o; }, Object.fromEntries(String(opt("skin")).split(",").map((kv) => { const [k, v] = kv.split("="); return [k, isNaN(Number(v)) ? v : Number(v)]; })));   // --skin bump=0,res=0.3: the skin's knobs, for tuning
    await pg.addInitScript(() => { let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; const T0 = 1700000000000; Date.now = () => T0; performance.now = () => 0; window.requestAnimationFrame = () => 0; });
    const errors = [];
    pg.on("pageerror", (e) => errors.push(e.message));
    if (stills) pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.text().slice(0, 600)); });   // a shader that failed to compile says so here
    await pg.goto("file://" + file);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForFunction(() => typeof window.seek === "function", null, { timeout: 30000 }).catch(() => {});
    if (errors.length || !(await pg.evaluate(() => typeof window.seek === "function"))) { console.error(`${scene.id} ${aspect}: the scene page failed to load: ${errors.join(" | ") || "no seek()"}`); await pg.close(); continue; }
    const cdp = await pg.context().newCDPSession(pg);
    const frames = Math.round(scene.dur * fps), hashes = [], samples = [], warnings = [];
    const outDir = OUT[aspect]; fs.mkdirSync(outDir, { recursive: true });
    const base = aspect === "16x9" ? scene.id : `${scene.id}-${aspect}`;
    const mp4 = path.join(outDir, `${base}.mp4`), poster = path.join(outDir, `${base}.jpg`);
    let ff = null;
    if (verify) {
      const prev = ((log[scene.id] || {})[aspect] || {}).samples || [];
      let same = 0, diff = 0;
      for (const [i, h] of prev) {
        await pg.evaluate(([t, f]) => { if (window.cinemaFrame) { window.CINEMA.fps = f; return window.cinemaFrame(t); } window.seek(t); return null; }, [i / fps, Number(opt("fps", 30))]);
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
        if (sha(Buffer.from(data, "base64")) === h) same++; else diff++;
      }
      console.log(`${scene.id} ${aspect}: deterministic: ${diff === 0 && same > 0} (${same} of ${same + diff} sampled frames match the log)`);
      (log[scene.id] ||= {})[aspect] = { ...((log[scene.id] || {})[aspect] || {}), verified: diff === 0 && same > 0, verifiedAt: new Date().toISOString().slice(0, 10) };
      await pg.close(); continue;
    }
    if (stills) {
      for (const t of stills) {
        await pg.evaluate(([t, f]) => { if (window.cinemaFrame) { window.CINEMA.fps = f; return window.cinemaFrame(t); } window.seek(t); return null; }, [t, Number(opt("fps", 30))]);
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
        fs.writeFileSync(path.join(review, `${scene.id}-${aspect}-${t}.png`), Buffer.from(data, "base64"));
      }
      const skin = await pg.evaluate(() => { const T = window.SKIN && window.SKIN.tissue; if (!T || !T.mc) return null; const p = T.mc.geometry.attributes.position, n = T.mc.count; let top = -1e9; for (let i = 0; i < n; i++) top = Math.max(top, p.getY(i)); return { grid: T.g, res: T.f.res, size: T.f.size, tris: Math.round(n / 3), top: Math.round((top * T.mc.scale.y + T.mc.position.y) * 100) / 100, sets: window.SKIN.sets.map((s) => [s.count, s.size.map((v) => +v.toFixed(2))]) }; });
      console.log(`${scene.id} ${aspect}: ${stills.length} stills in review/${skin ? "  skin " + JSON.stringify(skin) : ""}${errors.length ? "\n  ! " + errors.join("\n  ! ") : ""}`);
      await pg.close(); continue;
    }
    if (!quick) ff = encode(mp4, fps);
    const sheetEvery = Math.max(1, Math.round(1.5 * fps));
    for (let i = 0; i < frames; i++) {
      const t = i / fps;
      await pg.evaluate(([t, f]) => { if (window.cinemaFrame) { window.CINEMA.fps = f; return window.cinemaFrame(t); } window.seek(t); return null; }, [t, Number(opt("fps", 30))]);   // the shutter is the final frame rate's, even in --quick
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
      const buf = Buffer.from(data, "base64");
      hashes.push(sha(buf));
      if (i % 15 === 0) samples.push([i, hashes[i]]);
      if (i % sheetEvery === 0) sheetFrames.push([t, buf]);
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
    await sheet.screenshot({ path: path.join(review, `${scene.id}-${aspect}.jpg`), fullPage: true, type: "jpeg", quality: 80 });
    await sheet.close();
    sheetFrames.length = 0;
    await pg.close();
    const bytes = !quick && fs.existsSync(mp4) ? fs.statSync(mp4).size : 0;
    const entry = { frames, fps, dur: scene.dur, w: W, h: H, bytes, hash: sha(Buffer.from(hashes.join(""))), samples, warnings, renderSec: Math.round((Date.now() - t0) / 100) / 10, renderedAt: new Date().toISOString().slice(0, 10), quick };
    (log[scene.id] ||= {})[aspect] = entry;
    if (!quick && aspect === "16x9" && !scene.bare) videos[scene.id] = { dur: scene.dur, w: W, h: H, bytes };   // a bare scene (the page's hero) isn't a lesson
    console.log(`${scene.id} ${aspect}: ${frames} frames, ${entry.renderSec}s${bytes ? `, ${(bytes / 1024).toFixed(0)} KB` : " (quick)"}${warnings.length ? `\n  ! ${warnings.join("\n  ! ")}` : ""}`);
  }
}
await browser.close();
if (!opt("keep", false)) fs.rmSync(tmp, { recursive: true, force: true });   // --keep leaves the scene pages in .tmp for probing
if (!stills) fs.writeFileSync(logFile, JSON.stringify(log, null, 1));
if (!quick && !verify && !stills) fs.writeFileSync(videosFile, `/* GENERATED by docs/school/motion/render.mjs: the lessons with a rendered explainer in img/school/video/. Don't edit; render again. */\nwindow.SCHOOL_VIDEOS = ${JSON.stringify(videos)};\n`);
