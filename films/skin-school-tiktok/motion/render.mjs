// Skin School on TikTok: the chunked, crash-safe, resumable frame renderer for long films (60 s to 3 min).
//
// Each frame is drawn on the pilot's page, unchanged (films/skin-school-pilot/motion/render.mjs): the same
// page(scene, W, H) HTML, motion.js runtime, studio3d.js set, cinema3d.js finish, seeded Math.random /
// Date.now / performance.now, Chromium flags, one window.cinemaFrame(t) per frame with window.CINEMA.fps at
// the delivery rate, the AUDIT and --plain. The runtime is read from the pilot's folder, never copied.
// What is new is everything around the page: tiers, frames on disk in chunks, resume, retries on a fresh
// page, a verified encode per chunk, and assembly. README-render.md has the details and the measurements.
//
//   node films/skin-school-tiktok/motion/render.mjs --tier draft --resume          render (or resume) the film
//   node films/skin-school-tiktok/motion/render.mjs --tier final --assemble --audio mix.m4a
//   node films/skin-school-tiktok/motion/render.mjs --cues                          the event table for the sound
//   films/skin-school-tiktok/motion/run.sh --tier final                             detached, survives the shell
//
// build/<tier>/<aspect>/
//   manifest.json                     what made these frames: code sha256, Chromium, size, fps, start date
//   frames/<chunk>/<frame>.png        written as .tmp, then renamed; deleted once the chunk's mp4 is verified
//   frames/<chunk>/frames.jsonl       one line per finished frame: frame, t, sha256, K, ms (kept)
//   frames/<chunk>/chunk.json         the versions that rendered into the chunk, and its verified encode
//   chunks/<chunk>.mp4                x264 crf 15, constant fps, keyframe every second
//   master.mp4, master-audio.mp4, contact-sheet.jpg, audit.json, render.log (from run.sh)
//
// Exit codes: 0 done · 2 refused (usage, a code/version mismatch, the scene would not load, another render
// running) · 3 a frame failed 3 times · 4 an encode, verify or assembly step failed · 1 anything unexpected ·
// 130/143 stopped by a signal. run.sh restarts on 1 and 3 only.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));              // films/skin-school-tiktok/motion
const film = path.resolve(here, "..");                                    // films/skin-school-tiktok
const repo = path.resolve(film, "../..");
const pilotMotion = path.resolve(here, "../../skin-school-pilot/motion"); // motion.js, studio3d.js, vendor/: read from there
const root = path.resolve(pilotMotion, "..");                             // the pilot folder (its fonts/), the pilot's `root`
const kitFile = path.resolve(repo, "kits/cinema/cinema3d.js");
// the page HTML sits at the pilot's depth (motion/.tmp/), so a scene's "../vendor/" (motion/vendor links to the
// pilot's) and "../../../../kits/cinema/..." imports resolve from it
const tmp = path.join(here, ".tmp");
const rel = (f) => path.relative(repo, f) || ".";
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(`[${ts()}]`, ...a);
const warn = (...a) => console.log(`[${ts()}] !`, ...a);
class Stop extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const die = (code, msg) => { console.error(`render.mjs: ${msg}`); process.exit(code); };

// ───────── options ─────────
const USAGE = `usage: node films/skin-school-tiktok/motion/render.mjs [options]        (README-render.md)
  --tier final|draft|animatic  final: 1080x1920 (16x9: 1920x1080) at --fps, full finish (default)
                               draft: 540x960, 15 fps, full finish with K <= 6 · animatic: 540x960, 6 fps, no finish
  --aspect 9x16|16x9           one per run (default 9x16)
  --fps N                      the delivery rate (default 30): the final tier's frame rate and every tier's shutter
  --from S --to S              part of the film, in seconds · --times S,S,...  single frames (stills)
  --chunk S                    chunk length in seconds (default 10)
  --resume                     keep finished frames (PNG + log line + matching sha256), render the rest
  --fresh                      discard every chunk the range touches, then render them
  --force-mixed                resume or assemble frames made by different code or another Chromium build
  --keep-png                   keep a chunk's PNGs after its mp4 is verified
  --assemble                   join the chunk mp4s, mux --audio (no -shortest), make the delivery file, poster
                               and contact sheet · --audio FILE --poster S --name NAME --out DIR
  --cues                       write the scene's event table to build/cues-<id>-<aspect>.json; renders nothing
  --scenes FILE --scene ID     the scene module (default ./scene.mjs; relative paths are read from motion/)
  --plain                      no cinema finish (the animatic tier never has it)
  --build DIR                  the build root (default films/skin-school-tiktok/build)
  --page-frames N              a fresh page every N frames (default 300)
  --frame-timeout S            a frame that takes longer is retried on a fresh page (default 600)
  --list | --where             list the scenes | print this run's build folder`;
const SPEC = { tier: 1, aspect: 1, fps: 1, from: 1, to: 1, times: 1, chunk: 1, scenes: 1, scene: 1, only: 1, build: 1, out: 1, name: 1, audio: 1, poster: 1,
  "page-frames": 1, "frame-timeout": 1, resume: 0, fresh: 0, "force-mixed": 0, "keep-png": 0, assemble: 0, plain: 0, cues: 0, list: 0, where: 0, help: 0 };
const A = {};
{
  const argv = process.argv.slice(2);
  const bad = (m) => die(2, `${m}\n\n${USAGE}`);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) bad(`unexpected argument "${a}"`);
    let k = a.slice(2), v;
    if (k.includes("=")) { v = k.slice(k.indexOf("=") + 1); k = k.slice(0, k.indexOf("=")); }
    if (!(k in SPEC)) bad(`unknown option --${k}`);
    if (!SPEC[k]) { if (v !== undefined) bad(`--${k} takes no value`); A[k] = true; continue; }
    if (v === undefined) { v = argv[++i]; if (v === undefined || v.startsWith("--")) bad(`--${k} needs a value`); }
    A[k] = v;
  }
  if (A.help) { console.log(USAGE); process.exit(0); }
  if (A.resume && A.fresh) bad("--resume keeps finished frames and --fresh discards them: pick one");
  if (A.times && (A.from !== undefined || A.to !== undefined)) bad("--times or --from/--to, not both");
}
const num = (k, d) => { if (A[k] === undefined) return d; const x = Number(A[k]); if (!Number.isFinite(x)) die(2, `--${k} must be a number, not "${A[k]}"`); return x; };

const TIERS = {
  final: { size: { "9x16": [1080, 1920], "16x9": [1920, 1080] }, fps: null, kMax: null, plain: false },
  draft: { size: { "9x16": [540, 960], "16x9": [960, 540] }, fps: 15, kMax: 6, plain: false },
  animatic: { size: { "9x16": [540, 960], "16x9": [960, 540] }, fps: 6, kMax: null, plain: true },
};
const tier = A.tier || "final", aspect = A.aspect || "9x16";
if (!TIERS[tier]) die(2, `--tier is final, draft or animatic, not "${tier}"`);
if (!TIERS[tier].size[aspect]) die(2, `--aspect is 9x16 or 16x9, one per run, not "${aspect}"`);
const deliveryFps = num("fps", 30);
const [W, H] = TIERS[tier].size[aspect];
const fps = TIERS[tier].fps || deliveryFps;
const plain = TIERS[tier].plain || A.plain === true;     // cinema: off = her renderer exactly
const kMax = plain ? null : TIERS[tier].kMax;
const tierDir = tier + (A.plain && !TIERS[tier].plain ? "-plain" : "");
const buildRoot = path.resolve(A.build || path.join(film, "build"));
const base = path.join(buildRoot, tierDir, aspect);
if (A.where) { console.log(base); process.exit(0); }
const keepPng = A["keep-png"] === true, forceMixed = A["force-mixed"] === true;
const pageFrames = Math.max(1, Math.round(num("page-frames", 300)));
const frameTimeout = num("frame-timeout", 600) * 1000;
const CHROMIUM = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const pwDir = process.env.PLAYWRIGHT_DIR || (() => { const r = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }); return r.status === 0 ? path.dirname(r.stdout.trim()) : root; })();

// ───────── the scene ─────────
const input = (p, order) => {
  if (path.isAbsolute(p)) return p;
  for (const b of order) if (fs.existsSync(path.resolve(b, p))) return path.resolve(b, p);
  return path.resolve(order[0], p);
};
const scenesPath = input(A.scenes || "./scene.mjs", [here, process.cwd()]);
if (!fs.existsSync(scenesPath)) die(2, `no scene module at ${rel(scenesPath)} (--scenes; a relative path is read from motion/)`);
const { SCENES } = await import(pathToFileURL(scenesPath).href);
if (A.list) {
  for (const s of Object.values(SCENES)) console.log(`${s.id}  ${s.dur}s  ${s.shots.length} shots  ${s.title.replace(/<[^>]+>/g, "")}`);
  process.exit(0);
}
const want = A.scene || A.only, ids = Object.keys(SCENES || {});
const scene = want ? SCENES[want] || Object.values(SCENES).find((s) => s.id === want) : ids.length === 1 ? SCENES[ids[0]] : null;
if (!scene) die(2, want ? `no scene "${want}" in ${rel(scenesPath)} (it has ${ids.join(", ")})` : `${rel(scenesPath)} has ${ids.length} scenes (${ids.join(", ")}): pick one with --scene`);
// the film's own scene reads ../film.json at import, so that file is part of its code
const filmJson = !path.relative(film, scenesPath).startsWith("..") && fs.existsSync(path.join(film, "film.json")) ? path.join(film, "film.json") : null;

// ───────── the page: the pilot's, unchanged (films/skin-school-pilot/motion/render.mjs) ─────────
// Only where the files are read from differs. Keep this block identical to the pilot's.
// cinema: her palette (scenes.mjs on the Lumevina branch), inlined so the pilot needs only the solid scene
const PALETTE = { rose: "#f4c9d6", rose2: "#eab9c8", gold: "#e3b48f", green: "#32d74b", red: "#ff7a6b", blue: "#8fd3ff", t2: "#a1a1a6", t3: "#6e6e73" };
const font = "file://" + path.join(root, "fonts/inter-var.woff2");
const runtime = fs.readFileSync(path.join(pilotMotion, "motion.js"), "utf8");
// the solid scenes share one studio set (studio3d.js): rounded blocks, a warm floor, a drifting camera.
// Every box a scene makes becomes a SoftBox, then the set goes in right after the three.js import.
const studio3d = fs.readFileSync(path.join(pilotMotion, "studio3d.js"), "utf8");
// cinema: the finish goes in before the studio set, so the studio's camera drift wraps it.
// It is the studio's cinema kit (kits/cinema/cinema3d.js at the repo root), read from there.
const cinema3d = plain ? "" : fs.readFileSync(kitFile, "utf8");
const studioModule = (src) => {
  const imp = 'import * as THREE from "../vendor/three.module.min.js";';
  let body = src.split("new THREE.BoxGeometry(").join("new SoftBox(");
  if (cinema3d) body = body.split("new THREE.WebGLRenderer(").join("cinemaRenderer(");   // cinema: see kits/cinema/cinema3d.js (r160 instance render)
  const at = body.indexOf(imp);
  return at < 0 ? body : body.slice(0, at + imp.length) + "\n" + cinema3d + "\n" + studio3d + "\n" + body.slice(at + imp.length);
};

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
const LAUNCH_ARGS = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"];
const SEED = () => { let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; const T0 = 1700000000000; Date.now = () => T0; performance.now = () => 0; window.requestAnimationFrame = () => 0; };
// cinema: one call per frame does the probe, the K sub-frames, the depth and the finish; the shutter is always the delivery rate's
const FRAME = ([t, fps]) => { if (window.cinemaFrame) { window.CINEMA.fps = fps; return window.cinemaFrame(t); } window.seek(t); return null; };
// ───────── end of the pilot's page ─────────

const IMP = 'import * as THREE from "../vendor/three.module.min.js";';
if (scene.module && !plain && !scene.module.includes(IMP)) die(2, `${scene.id}: the scene module has no line ${IMP} so cinema3d.js can't go in after it`);
const html = page(scene, W, H);
const pageFile = path.join(tmp, `${String(scene.id).replace(/[^\w.-]/g, "_")}-${tierDir}-${aspect}.html`);

// ───────── hashes: what made a frame ─────────
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
const sha256File = (f) => {
  const h = crypto.createHash("sha256"), fd = fs.openSync(f, "r"), buf = Buffer.allocUnsafe(1 << 20);
  try { let n; while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n)); } finally { fs.closeSync(fd); }
  return h.digest("hex");
};
const codeFiles = { scene: scenesPath, "motion.js": path.join(pilotMotion, "motion.js"), "studio3d.js": path.join(pilotMotion, "studio3d.js"), "cinema3d.js": kitFile, ...(filmJson ? { "film.json": filmJson } : {}) };
const files = Object.fromEntries(Object.entries(codeFiles).map(([k, f]) => [k, { path: rel(f), sha256: sha256File(f) }]));
const codeSha256 = sha256(Object.entries(files).map(([k, v]) => `${k} ${v.sha256}\n`).join(""));
const pageSha256 = sha256(html);   // everything the browser is given; also catches a change in a module the scene imports in Node
const info = { "three.module.min.js": sha256File(path.join(pilotMotion, "vendor/three.module.min.js")), "inter-var.woff2": sha256File(path.join(root, "fonts/inter-var.woff2")),
  "render.mjs": sha256File(fileURLToPath(import.meta.url)), node: process.version, chromiumPath: (() => { try { return CHROMIUM ? fs.realpathSync(CHROMIUM) : "playwright default"; } catch { return CHROMIUM; } })() };

// ───────── frames, chunks and their records ─────────
const total = Math.round(scene.dur * fps);
const chunkSec = num("chunk", 10), chunkFrames = Math.round(chunkSec * fps);
if (chunkFrames < 1 || Math.abs(chunkSec * fps - chunkFrames) > 1e-6) die(2, `--chunk ${chunkSec} s is ${chunkSec * fps} frames at ${fps} fps: it must be a whole number of frames`);
const nChunks = Math.ceil(total / chunkFrames);
const chunkOf = (f) => Math.floor(f / chunkFrames);
const chunkRange = (k) => [k * chunkFrames, Math.min(total, (k + 1) * chunkFrames)];
const pad = (n, w) => String(n).padStart(w, "0"), c3 = (k) => pad(k, 3);
const chunkDir = (k) => path.join(base, "frames", c3(k));
const pngOf = (f) => path.join(chunkDir(chunkOf(f)), pad(f, 5) + ".png");
const jsonlOf = (k) => path.join(chunkDir(k), "frames.jsonl");
const metaOf = (k) => path.join(chunkDir(k), "chunk.json");
const mp4Of = (k) => path.join(base, "chunks", c3(k) + ".mp4");
const manifestFile = path.join(base, "manifest.json");

let planFrames;
if (A.times) {
  const secs = String(A.times).split(",").map(Number);
  if (secs.some((x) => !Number.isFinite(x) || x < 0 || x > scene.dur)) die(2, `--times must be seconds within 0–${scene.dur}`);
  planFrames = [...new Set(secs.map((x) => Math.min(total - 1, Math.round(x * fps))))].sort((a, b) => a - b);
} else {
  const from = num("from", 0), to = num("to", scene.dur);
  if (!(from >= 0 && to > from && from < scene.dur)) die(2, `--from ${from} --to ${to}: need 0 <= from < to, and from inside the scene's ${scene.dur} s`);
  const fa = Math.round(from * fps), fb = Math.min(total, Math.round(to * fps));
  planFrames = Array.from({ length: Math.max(0, fb - fa) }, (_, i) => fa + i);
}
if (!planFrames.length) die(2, "the range holds no frame");
const planChunks = [...new Set(planFrames.map(chunkOf))];
const span = (a, b) => `${(a / fps).toFixed(2)}–${(b / fps).toFixed(2)} s`;

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJsonAtomic = (f, obj) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const t = f + ".tmp", fd = fs.openSync(t, "w");
  try { fs.writeFileSync(fd, JSON.stringify(obj, null, 1) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(t, f);
};
const readJsonl = (k) => {
  const lines = new Map(); let bad = 0;
  if (!fs.existsSync(jsonlOf(k))) return { lines, bad };
  for (const s of fs.readFileSync(jsonlOf(k), "utf8").split("\n")) {
    if (!s.trim()) continue;
    try { const r = JSON.parse(s); if (Number.isInteger(r.frame) && typeof r.sha256 === "string") lines.set(r.frame, r); else bad++; } catch { bad++; }
  }
  return { lines, bad };
};
const hasWork = (k) => fs.existsSync(mp4Of(k)) || readJsonl(k).lines.size > 0 || (fs.existsSync(chunkDir(k)) && fs.readdirSync(chunkDir(k)).some((n) => n.endsWith(".png")));
const chunksOnDisk = () => {
  const ks = new Set();
  if (fs.existsSync(path.join(base, "frames"))) for (const n of fs.readdirSync(path.join(base, "frames"))) if (/^\d{3}$/.test(n)) ks.add(Number(n));
  if (fs.existsSync(path.join(base, "chunks"))) for (const n of fs.readdirSync(path.join(base, "chunks"))) if (/^\d{3}\.mp4$/.test(n)) ks.add(Number(n.slice(0, 3)));
  return [...ks].sort((a, b) => a - b).filter(hasWork);
};
const encCache = new Map();
// a chunk is encoded when its mp4 is there and is byte for byte the one that was verified
const encodedOk = (k) => {
  if (encCache.has(k)) return encCache.get(k);
  const e = readJson(metaOf(k), {}).encoded, f = mp4Of(k), [a, b] = chunkRange(k);
  const ok = !!(e && fs.existsSync(f) && e.first === a && e.frames === b - a && e.fps === fps && fs.statSync(f).size === e.bytes && sha256File(f) === e.sha256);
  if (e && !ok) warn(`chunk ${c3(k)}: chunk.json records an encode, but ${rel(f)} is missing or changed; its frames count as not done`);
  encCache.set(k, ok);
  return ok;
};
const deletePngs = (k) => {
  let n = 0;
  if (fs.existsSync(chunkDir(k))) for (const name of fs.readdirSync(chunkDir(k))) if (name.endsWith(".png")) { fs.rmSync(path.join(chunkDir(k), name)); n++; }
  return n;
};
// which frames of chunk k are done: all of them if its mp4 is verified, else each frame with a PNG, a log line and a matching sha256
const scanChunk = (k) => {
  const [a, b] = chunkRange(k), done = new Set(), dir = chunkDir(k);
  if (fs.existsSync(dir)) for (const n of fs.readdirSync(dir)) if (n.endsWith(".tmp")) fs.rmSync(path.join(dir, n), { force: true });
  if (encodedOk(k)) {
    for (let f = a; f < b; f++) done.add(f);
    if (!keepPng) { const n = deletePngs(k); if (n) log(`chunk ${c3(k)}: mp4 already verified, deleted ${n} leftover PNGs`); }
    return done;
  }
  const { lines, bad } = readJsonl(k);
  if (bad) warn(`chunk ${c3(k)}: ${bad} unreadable line(s) in frames.jsonl (a write cut off by a kill); those frames render again`);
  // a line cut off mid-write has no newline: start the next one on a line of its own
  if (fs.existsSync(jsonlOf(k)) && !fs.readFileSync(jsonlOf(k), "utf8").endsWith("\n") && fs.statSync(jsonlOf(k)).size) fs.appendFileSync(jsonlOf(k), "\n");
  let mism = 0, orphan = 0;
  for (let f = a; f < b; f++) {
    const L = lines.get(f), png = pngOf(f), has = fs.existsSync(png);
    if (L && has) { if (sha256File(png) === L.sha256) done.add(f); else mism++; } else if (has) orphan++;
  }
  if (mism) warn(`chunk ${c3(k)}: ${mism} PNG(s) don't match the sha256 in frames.jsonl; they render again`);
  if (orphan) log(`chunk ${c3(k)}: ${orphan} PNG(s) without a log line (killed between the two writes); they render again`);
  return done;
};

// ───────── processes, the lock, the browser ─────────
const children = new Set();
const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  children.add(p);
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("error", (e) => { children.delete(p); reject(e); });
  p.on("close", (code, sig) => { children.delete(p); code === 0 ? resolve(out) : reject(new Error(`${cmd} exited with ${code ?? sig}: ${err.trim().split("\n").slice(-4).join(" | ")}`)); });
});
const ffmpeg = (args) => run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
const probe = async (f) => JSON.parse(await run("ffprobe", ["-v", "error", "-show_entries", "stream=index,codec_type,codec_name,duration,nb_frames,width,height,r_frame_rate:format=duration,bit_rate,size", "-of", "json", f]));
const countFrames = async (f, decode) => {
  const k = decode ? "nb_read_frames" : "nb_read_packets";
  const j = JSON.parse(await run("ffprobe", ["-v", "error", "-select_streams", "v:0", decode ? "-count_frames" : "-count_packets", "-show_entries", `stream=${k}`, "-of", "json", f]));
  return Number(j.streams[0][k]);
};
const X264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709",
  "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"];
const mb = (f) => (fs.statSync(f).size / 1048576).toFixed(1) + " MB";
const fmtDur = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h${pad(m, 2)}m` : m ? `${m}m${pad(x, 2)}s` : `${x}s`; };
const errText = (e) => String((e && e.message) || e).split("\n")[0].slice(0, 300);
const withTimeout = (p, ms, onTimeout) => new Promise((resolve, reject) => {
  const id = setTimeout(() => { try { onTimeout && onTimeout(); } catch {} reject(new Error(`timed out after ${ms / 1000} s`)); }, ms);
  Promise.resolve(p).then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
});

// one Chromium render (or assembly) at a time for this film, whatever --build says
const lockFile = path.join(film, "build", ".render.lock");
const isRender = (pid) => { try { return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("render.mjs"); } catch { return false; } };
let locked = false;
const takeLock = () => {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const L = readJson(lockFile, null);
  if (L && L.pid !== process.pid && isRender(L.pid)) throw new Stop(2, `another render is running: PID ${L.pid} (${L.what}, since ${L.at}). One at a time: wait, or stop it with run.sh stop / kill ${L.pid}.`);
  writeJsonAtomic(lockFile, { pid: process.pid, what: `${tierDir}/${aspect}${A.assemble ? " assemble" : A.cues ? " cues" : ""}`, base: rel(base), at: new Date().toISOString() });
  locked = true;
};
process.on("exit", () => { if (locked && readJson(lockFile, {}).pid === process.pid) fs.rmSync(lockFile, { force: true }); });

let chromium = null, browser = null, chromiumVersion = null, P = null, everOpened = false;
const ensureBrowser = async () => {
  if (stopping) await new Promise(() => {});      // never launch Chromium while stopping
  if (browser && browser.isConnected()) return;
  if (browser) { warn("Chromium went away; launching it again"); browser = null; }
  chromium ||= createRequire(path.join(pwDir, "x.js"))("playwright").chromium;
  browser = await chromium.launch({ executablePath: CHROMIUM, args: LAUNCH_ARGS });
  chromiumVersion = browser.version();
};
const closeBrowser = async () => { const b = browser; browser = null; if (b) await withTimeout(b.close(), 15000).catch(() => {}); };
class SceneError extends Error {}
// a page exactly like the pilot's: init script, goto, fonts, seek(); plus the tier's kMax and a CDP session
const openPage = () => withTimeout((async () => {
  await ensureBrowser();
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const Q = { pg, cdp: null, errors: [], frames: 0 };
  // a crash or close fails the frame in flight at once (Playwright leaves an evaluate on a crashed page pending)
  Q.dead = new Promise((_, reject) => { pg.once("crash", () => reject(new Error("the page crashed"))); pg.once("close", () => reject(new Error("the page closed"))); });
  Q.dead.catch(() => {});
  try {
    await pg.addInitScript(SEED);
    pg.on("pageerror", (e) => Q.errors.push(e.message));
    pg.on("crash", () => Q.errors.push("the page crashed"));
    await pg.goto("file://" + pageFile);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForFunction(() => typeof window.seek === "function", null, { timeout: 30000 }).catch(() => {});
    if (Q.errors.length || !(await pg.evaluate(() => typeof window.seek === "function"))) throw new SceneError(`the scene page failed to load: ${Q.errors.join(" | ") || "no seek()"}`);
    if (!plain && scene.module && !(await pg.evaluate(() => typeof window.cinemaFrame === "function"))) throw new SceneError("the cinema finish did not load (no window.cinemaFrame)");
    if (kMax != null) await pg.evaluate((k) => { if (window.CINEMA) window.CINEMA.kMax = k; }, kMax);
    Q.cdp = await pg.context().newCDPSession(pg);
    everOpened = true;
    return Q;
  } catch (e) {
    await pg.close().catch(() => {});
    if (e instanceof SceneError && !everOpened) throw new Stop(2, `${scene.id}: ${e.message} (page ${rel(pageFile)})`);
    throw e;
  }
})(), 180000);
const closePage = async () => {
  const Q = P; P = null;
  if (Q) await withTimeout(Q.pg.close(), 20000).catch(async () => { warn("a page would not close; restarting Chromium"); await closeBrowser(); });
};

// test hook: RENDER_TEST_FAULTS="45:throw,45:close,50:hang,60:crash" fails those frames once per entry
const faults = (process.env.RENDER_TEST_FAULTS || "").split(",").filter(Boolean).map((s) => { const [f, kind] = s.split(":"); return { f: Number(f), kind }; });
const injectFault = async (f) => {
  const i = faults.findIndex((x) => x.f === f);
  if (i < 0) return null;
  const { kind } = faults.splice(i, 1)[0];
  warn(`test fault at frame ${f}: ${kind}`);
  if (kind === "throw") await P.pg.evaluate(() => { throw new Error("test fault"); });
  if (kind === "close") await P.pg.close();
  if (kind === "crash") await P.pg.goto("chrome://crash").catch(() => {});
  return kind;
};

// ───────── one frame: render, capture, write .tmp, rename, log ─────────
const chunksStarted = new Set();
let version = null;
const startChunk = (k) => {
  if (chunksStarted.has(k)) return;
  fs.mkdirSync(chunkDir(k), { recursive: true });
  const [a, b] = chunkRange(k), meta = readJson(metaOf(k), { chunk: k, first: a, end: b, versions: [] });
  meta.versions ||= [];
  if (!meta.versions.some((v) => v.codeSha256 === version.codeSha256 && v.pageSha256 === version.pageSha256 && v.chromium === version.chromium)) {
    meta.versions.push({ ...version, at: new Date().toISOString() });
    writeJsonAtomic(metaOf(k), meta);
  }
  chunksStarted.add(k);
};
const renderFrame = async (f) => {
  const t = f / fps, k = chunkOf(f), t0 = Date.now(), Q = P;
  const kind = await injectFault(f);
  const work = (async () => {
    if (kind === "hang") await Q.pg.evaluate(() => new Promise(() => {}));
    const info = await Q.pg.evaluate(FRAME, [t, deliveryFps]);
    const { data } = await Q.cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
    return { info, data };
  })();
  work.catch(() => {});
  const { info, data } = await withTimeout(Promise.race([work, Q.dead]), frameTimeout, () => Q.pg.close().catch(() => {}));
  if (Q.errors.length) throw new Error(`page error: ${Q.errors.join(" | ")}`);
  const buf = Buffer.from(data, "base64");
  if (buf.length < 64 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("the capture is not a PNG");
  startChunk(k);
  const png = pngOf(f), part = png + ".tmp";
  let fd = fs.openSync(part, "w");
  try { fs.writeFileSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(part, png);
  const ms = Date.now() - t0, K = info ? info.K : null;
  fd = fs.openSync(jsonlOf(k), "a");
  try { fs.writeFileSync(fd, JSON.stringify({ frame: f, t: +t.toFixed(6), sha256: sha256(buf), K, ms }) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  Q.frames++;
  return { K, ms };
};

// ───────── a finished chunk: encode, verify, then delete its PNGs ─────────
const encodeFailures = [];
const finishChunk = async (k) => {
  const [a, b] = chunkRange(k), n = b - a, out = mp4Of(k), part = out.replace(/\.mp4$/, ".part.mp4"), t0 = Date.now();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    await ffmpeg(["-framerate", String(fps), "-start_number", String(a), "-i", path.join(chunkDir(k), "%05d.png"), "-frames:v", String(n),
      ...X264, "-preset", "medium", "-crf", "15", "-g", String(fps), "-r", String(fps), "-fps_mode", "cfr", "-an", part]);
    const got = await countFrames(part, true);
    if (got !== n) throw new Error(`the encode decodes to ${got} frames, expected ${n}`);
    fs.renameSync(part, out);
    const meta = readJson(metaOf(k), { chunk: k, first: a, end: b, versions: [] });
    meta.encoded = { file: path.relative(base, out), first: a, frames: n, fps, bytes: fs.statSync(out).size, sha256: sha256File(out), verifiedFrames: got, at: new Date().toISOString() };
    writeJsonAtomic(metaOf(k), meta);
    encCache.set(k, true);
    const del = keepPng ? 0 : deletePngs(k);
    const L = [...readJsonl(k).lines.values()].filter((x) => x.frame >= a && x.frame < b), Ks = L.map((x) => x.K).filter((x) => x != null);
    const kTxt = Ks.length ? `K avg ${(Ks.reduce((s, x) => s + x, 0) / Ks.length).toFixed(1)} max ${Math.max(...Ks)}, ` : "";
    log(`chunk ${c3(k)} done: frames ${a}–${b - 1} (${span(a, b)}), ${kTxt}${(L.reduce((s, x) => s + x.ms, 0) / L.length / 1000).toFixed(2)} s/frame → ${rel(out)} ${mb(out)}, ${got} frames verified, encoded in ${fmtDur((Date.now() - t0) / 1000)}${keepPng ? ", PNGs kept" : `, ${del} PNGs deleted`}`);
  } catch (e) {
    fs.rmSync(part, { force: true });
    encodeFailures.push(k);
    console.error(`[${ts()}] ERROR chunk ${c3(k)}: the encode failed: ${errText(e)}. Its PNGs are kept; the next --resume encodes it again. Rendering goes on.`);
  }
};

// ───────── the manifest: refuse to mix versions ─────────
let manifest = null;
const settingsNow = () => ({ scene: scene.id, dur: scene.dur, frames: total, width: W, height: H, fps, shutterFps: plain ? null : deliveryFps, kMax, plain, chunkSeconds: chunkSec, chunkFrames });
const gate = (work) => {
  const man = readJson(manifestFile, null), settings = settingsNow(), now = new Date().toISOString();
  if (!work.length || !man) {
    if (work.length && !forceMixed) throw new Stop(2, `${rel(base)} holds frames but no manifest.json, so nothing says what made them. Discard them with --fresh, or adopt them with --force-mixed.`);
    manifest = { film: "skin-school-tiktok", tier: tierDir, aspect, ...settings, codeSha256, files, pageSha256, chromium: chromiumVersion, info, startedAt: now, mixed: [], runs: [] };
    if (work.length) manifest.mixed.push({ at: now, note: "adopted frames that had no manifest (--force-mixed)" });
    return;
  }
  const hard = Object.keys(settings).filter((k) => JSON.stringify(man[k]) !== JSON.stringify(settings[k]));
  if (hard.length) throw new Stop(2, `the frames in ${rel(base)} were made with ${hard.map((k) => `${k}=${JSON.stringify(man[k])}`).join(", ")}; this run has ${hard.map((k) => `${k}=${JSON.stringify(settings[k])}`).join(", ")}. They can't be one film: use --fresh over the whole film, or another --build.`);
  const soft = [];
  if (man.codeSha256 !== codeSha256) soft.push(`the code hash differs (changed: ${Object.keys({ ...files, ...man.files }).filter((k) => (man.files[k] || {}).sha256 !== (files[k] || {}).sha256).join(", ")})`);
  else if (man.pageSha256 !== pageSha256) soft.push("the page HTML differs (the page template in render.mjs, a module the scene imports, or the repo moved)");
  if (man.chromium !== chromiumVersion) soft.push(`Chromium differs (${man.chromium} on disk, ${chromiumVersion} now)`);
  if (soft.length) {
    const what = `the frames in ${rel(base)} (started ${man.startedAt}) were made by other code: ${soft.join("; ")}`;
    if (!forceMixed) throw new Stop(2, `refusing to ${A.resume ? "resume" : "add to"} ${tierDir}/${aspect}: ${what}. That would mix two versions in one film. Render again with --fresh, or pass --force-mixed to accept the mix.`);
    warn(`--force-mixed: ${what}`);
    (man.mixed ||= []).push({ at: now, codeSha256, pageSha256, chromium: chromiumVersion, files });
  }
  manifest = man;
};
let runEntry = null;
const saveManifest = () => manifest && writeJsonAtomic(manifestFile, manifest);
const endRun = (status, extra = {}) => { if (runEntry && !runEntry.endedAt) { Object.assign(runEntry, { endedAt: new Date().toISOString(), status, ...extra }); try { saveManifest(); } catch {} } };

// ───────── render ─────────
const render = async () => {
  takeLock();
  fs.mkdirSync(base, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(base, "render.pid"), process.pid + "\n");
  fs.writeFileSync(pageFile, html);
  log(`${scene.id} · ${tierDir} ${aspect} ${W}x${H} @ ${fps} fps · ${plain ? "no finish (plain)" : `shutter at ${deliveryFps} fps${kMax ? `, K <= ${kMax}` : ""}`} · chunks of ${chunkFrames} frames`);
  log(`scene ${rel(scenesPath)}: ${scene.dur} s = ${total} frames, ${nChunks} chunks · this run: ${A.times ? `frames ${planFrames.join(",")}` : `frames ${planFrames[0]}–${planFrames.at(-1)} (${span(planFrames[0], planFrames.at(-1) + 1)})`} → ${rel(base)}`);
  await ensureBrowser();
  version = { codeSha256, pageSha256, chromium: chromiumVersion };
  log(`Chromium ${chromiumVersion} · code ${codeSha256.slice(0, 12)} (${Object.keys(files).join(", ")}) · page ${pageSha256.slice(0, 12)}`);

  const withWork = planChunks.filter(hasWork);
  if (withWork.length && !A.resume && !A.fresh) throw new Stop(2, `${withWork.length} chunk(s) of this range already hold frames (${withWork.map(c3).join(", ")} in ${rel(base)}). Pass --resume to keep the finished ones and render the rest, or --fresh to discard them and render again.`);
  // --fresh discards the chunks the range touches (every chunk on disk when the range is the whole film), but
  // only after the gate has passed on what stays, so a refused run deletes nothing
  const discard = !A.fresh ? [] : !A.times && planFrames.length === total ? chunksOnDisk() : withWork;
  gate(chunksOnDisk().filter((k) => !discard.includes(k)));
  for (const k of discard) {
    fs.rmSync(chunkDir(k), { recursive: true, force: true }); fs.rmSync(mp4Of(k), { force: true });
    warn(`--fresh: discarded chunk ${c3(k)}`);
  }
  manifest.runs = [...(manifest.runs || []), (runEntry = { at: new Date().toISOString(), pid: process.pid, args: process.argv.slice(2), frames: planFrames.length, codeSha256 })].slice(-50);
  saveManifest();

  const done = new Map(planChunks.map((k) => [k, scanChunk(k)]));
  const todo = planFrames.filter((f) => !done.get(chunkOf(f)).has(f));
  const chunkLen = (k) => chunkRange(k)[1] - chunkRange(k)[0];
  const pendingEncode = planChunks.filter((k) => !encodedOk(k) && done.get(k).size === chunkLen(k));
  log(`${planFrames.length - todo.length} of ${planFrames.length} frames already done · ${todo.length} to render${pendingEncode.length ? ` · ${pendingEncode.length} finished chunk(s) to encode first` : ""}`);
  for (const k of pendingEncode) await finishChunk(k);

  const t0 = Date.now(), recent = [], Ks = [];
  let rendered = 0, renderMs = 0;
  for (let i = 0; i < todo.length; i++) {
    const f = todo[i], k = chunkOf(f);
    if (P && P.frames >= pageFrames) await closePage();   // a fresh page every --page-frames frames
    let r;
    for (let attempt = 1; ; attempt++) {
      try { P ||= await openPage(); r = await renderFrame(f); break; }
      catch (e) {
        if (e instanceof Stop) throw e;
        if (stopping) await new Promise(() => {});   // a signal closed the browser under this frame: let bail() finish, no retry
        warn(`frame ${f} (t ${(f / fps).toFixed(3)} s, chunk ${c3(k)}) failed, attempt ${attempt} of 3: ${errText(e)}`);
        await closePage();
        if (attempt >= 3) throw new Stop(3, `frame ${f} (t ${(f / fps).toFixed(3)} s, chunk ${c3(k)}) failed on 3 fresh pages. Last error: ${errText(e)}. The finished frames are on disk: fix the cause, then resume (run.sh, or --resume).`);
      }
    }
    rendered++; renderMs += r.ms; done.get(k).add(f);
    recent.push(r.ms); if (recent.length > 30) recent.shift();
    if (r.K != null) Ks.push(r.K);
    if (rendered === 1 || rendered % 30 === 0 || i === todo.length - 1) {
      const avg = recent.reduce((s, x) => s + x, 0) / recent.length / 1000;
      log(`frame ${pad(f, 5)}  t ${(f / fps).toFixed(2)} s  K ${r.K ?? "-"}  ${avg.toFixed(2)} s/frame  ETA ${fmtDur((todo.length - i - 1) * avg)}  (${i + 1}/${todo.length})`);
    }
    if (done.get(k).size === chunkLen(k) && !encodedOk(k)) await finishChunk(k);
  }

  // the pilot's review: text past the frame or on other text at each shot's settled moments, and dead air
  const warnings = [];
  if (rendered) {
    try {   // the frames are safe on disk whatever happens here: a failed audit is reported, not fatal
      P ||= await openPage();
      const lo = planFrames[0] / fps, hi = (planFrames.at(-1) + 1) / fps;
      for (let k = 0; k < scene.shots.length; k++) {
        const a = scene.shots[k].at, b = k + 1 < scene.shots.length ? scene.shots[k + 1].at : scene.dur;
        for (const t of [a + Math.min(3, (b - a) * 0.6), b - 0.2]) {
          if (t < lo || t >= hi) continue;
          await P.pg.evaluate((t) => window.seek(t), t);
          for (const w of await P.pg.evaluate(AUDIT)) warnings.push(`${scene.shots[k].name} @${t.toFixed(1)}s ${w}`);
        }
      }
    } catch (e) { warnings.push(`the text audit could not run: ${errText(e)}`); }
    if (!A.times) {
      const L = new Map();
      for (const k of planChunks) for (const [f, x] of readJsonl(k).lines) L.set(f, x.sha256);
      let runLen = 1;
      for (let f = planFrames[0] + 1; f <= planFrames.at(-1) + 1; f++) {
        if (f <= planFrames.at(-1) && L.get(f) && L.get(f) === L.get(f - 1)) { runLen++; continue; }
        if (runLen / fps > 2.5 && f < total) warnings.push(`still for ${(runLen / fps).toFixed(1)}s ending at ${(f / fps).toFixed(1)}s`);
        runLen = 1;
      }
    }
    writeJsonAtomic(path.join(base, "audit.json"), { at: new Date().toISOString(), range: A.times ? planFrames : [planFrames[0], planFrames.at(-1)], warnings });
  }
  await closePage();
  await closeBrowser();
  if (!process.env.KEEP_TMP) fs.rmSync(pageFile, { force: true });

  const wall = (Date.now() - t0) / 1000;
  if (rendered) log(`rendered ${rendered} frames in ${fmtDur(wall)}: ${(renderMs / rendered / 1000).toFixed(2)} s/frame (${(wall / rendered).toFixed(2)} s with page loads and encodes)${Ks.length ? `, K avg ${(Ks.reduce((s, x) => s + x, 0) / Ks.length).toFixed(1)} max ${Math.max(...Ks)}` : ""}`);
  for (const w of warnings) warn(w);
  const notEncoded = planChunks.filter((k) => !encodedOk(k));
  const allDone = chunksOnDisk().length && Array.from({ length: nChunks }, (_, k) => k).every((k) => encodedOk(k));
  if (notEncoded.length) log(`not encoded: chunk(s) ${notEncoded.map(c3).join(", ")} (the range stops inside them${encodeFailures.length ? ", or their encode failed" : ""})`);
  else log(`all ${planChunks.length} chunk(s) of the range are encoded${allDone ? "; the whole film is ready for --assemble" : ""}`);
  endRun(encodeFailures.length ? "encode failed" : "done", { rendered, renderSecPerFrame: rendered ? +(renderMs / rendered / 1000).toFixed(3) : null, wallSec: Math.round(wall), warnings: warnings.length });
  if (encodeFailures.length) throw new Stop(4, `chunk(s) ${encodeFailures.map(c3).join(", ")} failed to encode (see above); their PNGs are kept and --resume encodes them again`);
};

// ───────── assemble: chunks → master → (+ audio) → delivery, poster, contact sheet ─────────
const assemble = async () => {
  takeLock();
  const man = readJson(manifestFile, null);
  if (!man) throw new Stop(2, `nothing rendered in ${rel(base)} (no manifest.json)`);
  const hard = Object.entries(settingsNow()).filter(([k, v]) => JSON.stringify(man[k]) !== JSON.stringify(v)).map(([k]) => k);
  if (hard.length) throw new Stop(2, `${rel(base)} was rendered with other settings (${hard.map((k) => `${k}=${JSON.stringify(man[k])}`).join(", ")}): pass the same --tier/--fps/--chunk/--scenes as the render`);
  const f0 = planFrames[0], f1 = planFrames.at(-1) + 1;
  const ks = Array.from({ length: chunkOf(f1 - 1) - chunkOf(f0) + 1 }, (_, i) => chunkOf(f0) + i);
  const first = chunkRange(ks[0])[0], end = chunkRange(ks.at(-1))[1], n = end - first, vDur = n / fps, frame = 1 / fps;
  const missing = ks.filter((k) => !encodedOk(k));
  if (missing.length) throw new Stop(4, `can't assemble ${tierDir}/${aspect}: chunk(s) ${missing.map(c3).join(", ")} have no verified mp4 yet. Render them first (run.sh --tier ${tier} --resume ...).`);
  if (first !== f0 || end !== f1) warn(`the range is widened to whole chunks: frames ${first}–${end - 1} (${span(first, end)})`);
  const vers = new Map();
  for (const k of ks) for (const v of readJson(metaOf(k), {}).versions || []) vers.set(`${v.codeSha256} ${v.pageSha256} ${v.chromium}`, (vers.get(`${v.codeSha256} ${v.pageSha256} ${v.chromium}`) || []).concat(c3(k)));
  if (vers.size > 1) {
    const what = `the chunks were rendered by ${vers.size} versions: ${[...vers].map(([v, c]) => `code ${v.slice(0, 12)} → chunks ${c.join(",")}`).join("; ")}`;
    if (!forceMixed) throw new Stop(2, `${what}. Render the odd ones again with --fresh, or pass --force-mixed.`);
    warn(`--force-mixed: ${what}`);
  }
  const whole = first === 0 && end === total;
  const name = A.name || `skin-school-pore-${aspect}${tierDir === "final" ? "" : "-" + tierDir}${whole ? "" : `-${+(first / fps).toFixed(2)}s-${+(end / fps).toFixed(2)}s`}`;
  const outDir = path.resolve(A.out || path.join(film, "out"));
  fs.mkdirSync(outDir, { recursive: true });
  const partOf = (f) => f.replace(/(\.\w+)$/, ".part$1");
  const streams = async (f) => { const j = await probe(f); const v = j.streams.find((s) => s.codec_type === "video"), a = j.streams.find((s) => s.codec_type === "audio"); return { v, a, j }; };

  // 1. the chunk mp4s, joined without re-encoding
  const list = path.join(base, "chunks", "concat.txt"), master = path.join(base, "master.mp4");
  fs.writeFileSync(list, "ffconcat version 1.0\n" + ks.map((k) => `file '${c3(k)}.mp4'\n`).join(""));
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-map", "0:v:0", "-c", "copy", "-movflags", "+faststart", partOf(master)]);
  const mFrames = await countFrames(partOf(master), false);
  if (mFrames !== n) throw new Stop(4, `master.mp4 has ${mFrames} frames, expected ${n}`);
  fs.renameSync(partOf(master), master);
  log(`master: ${ks.length} chunks, ${n} frames = ${vDur.toFixed(3)} s → ${rel(master)} ${mb(master)}`);

  // 2. the audio: copied if it is AAC, lengths within one frame, never -shortest
  let src = master, audio = null;
  if (A.audio) {
    audio = input(A.audio, [process.cwd(), here]);
    if (!fs.existsSync(audio)) throw new Stop(2, `no audio file at ${A.audio}`);
    const { a, j } = await streams(audio);
    if (!a) throw new Stop(2, `${rel(audio)} has no audio stream`);
    const aDur = Number(a.duration || j.format.duration);
    if (!(Math.abs(aDur - vDur) <= frame + 1e-6)) throw new Stop(4, `the audio is ${aDur.toFixed(3)} s and the picture ${vDur.toFixed(3)} s (${n} frames at ${fps} fps): ${Math.abs(aDur - vDur).toFixed(3)} s apart, more than one frame (${frame.toFixed(3)} s). Not muxed: fix the length of one of them (no -shortest, by design).`);
    const copy = a.codec_name === "aac";
    if (!copy) warn(`${rel(audio)} is ${a.codec_name}, not AAC: encoding it to AAC 256k here. Measure the loudness on the delivered file (kits/cinema/studio), or pass the studio's .m4a`);
    const withAudio = path.join(base, "master-audio.mp4");
    await ffmpeg(["-i", master, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", ...(copy ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "256k", "-ar", "48000"]), "-movflags", "+faststart", partOf(withAudio)]);
    const s = await streams(partOf(withAudio)), dv = Number(s.v.duration), da = Number(s.a.duration);
    if (!(Math.abs(da - dv) <= frame + 1e-6)) throw new Stop(4, `after the mux, the audio is ${da.toFixed(3)} s and the picture ${dv.toFixed(3)} s: more than one frame apart`);
    fs.renameSync(partOf(withAudio), withAudio);
    log(`audio: ${rel(audio)} ${a.codec_name} ${aDur.toFixed(3)} s against ${vDur.toFixed(3)} s of picture (${((aDur - vDur) * 1000).toFixed(1)} ms) → ${rel(withAudio)} (${copy ? "copied" : "AAC 256k"}; muxed ${da.toFixed(3)} s / ${dv.toFixed(3)} s)`);
    src = withAudio;
  }

  // 3. the delivery encode
  const out = path.join(outDir, name + ".mp4");
  await ffmpeg(["-i", src, "-map", "0:v:0", ...(audio ? ["-map", "0:a:0", "-c:a", "copy"] : []), "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "12M", "-bufsize", "24M",
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(fps), "-fps_mode", "cfr", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
    "-movflags", "+faststart", partOf(out)]);
  const dFrames = await countFrames(partOf(out), false), d = await streams(partOf(out));
  if (dFrames !== n) throw new Stop(4, `the delivery file has ${dFrames} frames, expected ${n}`);
  if (audio && !(Math.abs(Number(d.a.duration) - Number(d.v.duration)) <= frame + 1e-6)) throw new Stop(4, `the delivery file's audio (${d.a.duration} s) and picture (${d.v.duration} s) are more than one frame apart`);
  fs.renameSync(partOf(out), out);
  log(`delivery: ${rel(out)} ${mb(out)}, ${d.v.width}x${d.v.height} ${fps} fps, ${dFrames} frames, ${(Number(d.j.format.bit_rate) / 1e6).toFixed(1)} Mbps${audio ? `, audio ${Number(d.a.duration).toFixed(3)} s` : ", no audio"}`);

  // 4. the poster
  let pt = A.poster !== undefined ? num("poster") : scene.poster ?? first / fps;
  if (pt < first / fps || pt > (end - 1) / fps) { const c = Math.min(Math.max(pt, first / fps), (end - 1) / fps); warn(`--poster ${pt} s is outside the assembled ${span(first, end)}; using ${c.toFixed(2)} s`); pt = c; }
  const poster = path.join(outDir, name + ".jpg");
  await ffmpeg(["-ss", (pt - first / fps).toFixed(6), "-i", master, "-frames:v", "1", "-q:v", "2", "-update", "1", partOf(poster)]);
  fs.renameSync(partOf(poster), poster);
  log(`poster: ${pt.toFixed(2)} s → ${rel(poster)}`);

  // 5. the contact sheet: one frame every 2 s, read from the chunk mp4s by ffmpeg
  const every = Math.max(1, Math.round(2 * fps)), count = Math.floor((n - 1) / every) + 1;
  const cols = Math.min(count, aspect === "9x16" ? 6 : 4), rows = Math.ceil(count / cols), [tw, th] = aspect === "9x16" ? [180, 320] : [320, 180];
  const fontFile = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  const label = fs.existsSync(fontFile) ? `,drawtext=fontfile=${fontFile}:text='%{eif\\:trunc(t+${(first / fps).toFixed(4)}+0.5)\\:d}s':x=6:y=h-th-6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4` : "";
  const sheet = path.join(base, "contact-sheet.jpg");
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-vf", `select='not(mod(n\\,${every}))',scale=${tw}:${th}${label},tile=${cols}x${rows}:padding=6:margin=6:color=0x202020`,
    "-frames:v", "1", "-q:v", "3", "-update", "1", partOf(sheet)]);
  fs.renameSync(partOf(sheet), sheet);
  log(`contact sheet: ${count} frames, one every 2 s → ${rel(sheet)}`);
};

// ───────── cues: the scene's event table for the studio's sound (as the pilot's --cues) ─────────
const cues = async () => {
  takeLock();
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(pageFile, html);
  P = await openPage();
  const pg = P.pg, fps = deliveryFps;
  // cinema: the scene's own event table, in film time, for the studio (kits/cinema/studio). Labels get
  // their on-screen position from the page itself, once they have settled, so the sound pans with them.
  const c = await pg.evaluate(() => window.SCENE_CUES ? window.SCENE_CUES() : null);
  if (!c) throw new Stop(2, `${scene.id}: the scene has no SCENE_CUES()`);
  c.shown = {};
  for (const e of c.events.filter((e) => e.el)) {
    e.pos = await pg.evaluate(([t, id]) => { window.seek(t); const r = document.getElementById(id).getBoundingClientRect(); return [+((r.left + r.width / 2) / innerWidth).toFixed(3), +((r.top + r.height / 2) / innerHeight).toFixed(3)]; }, [e.t + 0.7, e.el]);
    // and, independently of the table, the first frame on which the element is actually visible
    for (let f = Math.floor((e.t - 0.2) * fps); f <= Math.ceil((e.t + 0.5) * fps); f++) {
      const op = await pg.evaluate(([t, id]) => { window.seek(t); return +getComputedStyle(document.getElementById(id)).opacity; }, [f / fps, e.el]);
      if (op > 0.02) { c.shown[e.tag] = +(f / fps).toFixed(4); break; }
    }
  }
  const cueFile = path.join(buildRoot, `cues-${scene.id}-${aspect}.json`);
  fs.mkdirSync(buildRoot, { recursive: true });
  fs.writeFileSync(cueFile, JSON.stringify({ scene: scene.id, aspect, fps, ...c }, null, 1));
  log(`${scene.id} ${aspect}: ${c.events.length} cues → ${rel(cueFile)}`);
  await closePage(); await closeBrowser();
  if (!process.env.KEEP_TMP) fs.rmSync(pageFile, { force: true });
};

// ───────── run, and never die quietly ─────────
let stopping = false;
const bail = async (code, text) => {
  if (stopping) return; stopping = true;
  if (text) console.error(`[${ts()}] ${text}`);
  for (const c of children) c.kill("SIGTERM");
  await closeBrowser();
  endRun(code === 0 ? "done" : `exit ${code}`);
  process.exit(code);
};
for (const [sig, code] of [["SIGINT", 130], ["SIGTERM", 143]]) process.on(sig, () => bail(code, `stopped by ${sig}: the finished frames are on disk; resume with run.sh (or --resume)`));
process.on("unhandledRejection", (e) => bail(1, `ERROR (unhandled): ${(e && e.stack) || e}`));
try {
  await (A.cues ? cues() : A.assemble ? assemble() : render());
  process.exit(0);
} catch (e) {
  await bail(e instanceof Stop ? e.code : 1, `ERROR: ${e instanceof Stop ? e.message : (e && e.stack) || e}`);
}
