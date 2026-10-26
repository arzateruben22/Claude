// The film renderer (kits/cinema/film): chunked, crash-safe and resumable, for any episode folder.
//
// Generalized from films/skin-school-tiktok/motion/render.mjs (that file is left as it is). What changed:
// the page is the kit's brand-neutral page (./page.mjs: the theme's faces and tokens, an import map,
// ./runtime.js) instead of the pilot's, and the film is a folder (--film) instead of a scene list. What
// stayed: cinema3d.js spliced in after the scene's three.js import with the cinemaRenderer instance
// patch, one window.cinemaFrame(t) per frame with CINEMA.fps at the delivery rate, the seeded clock and
// random, the Chromium flags, tiers, chunks, resume by sha256, the manifest that refuses mixed versions,
// retries on fresh pages, the verified encode per chunk, assembly with the audio length check (no
// -shortest), --cues with pos and shown, the lock file, and run.sh. README.md has the details.
//
//   node kits/cinema/film/render.mjs --film <dir> --tier animatic            render (or resume with --resume)
//   node kits/cinema/film/render.mjs --film <dir> --tier final --times 1,4   stills
//   node kits/cinema/film/render.mjs --film <dir> --tier final --assemble --audio mix.m4a
//   node kits/cinema/film/render.mjs --film <dir> --cues                     the event table for the sound
//   kits/cinema/film/run.sh <dir> --tier final                               detached, survives the shell
//
// The film folder (an episode): film.json (id, dur, fps, poster, shots, captions, ... and optional
// "scene" and "theme" paths), scene.mjs (a browser module that starts with import * as THREE from
// "three"; and defines window.seek), and the theme: film.json's "theme" path, else ../theme.json (the
// channel's), else ./theme.json. Everything the renderer writes goes inside the film folder:
//
// <film>/build/<tier>/<aspect>/
//   manifest.json                     what made these frames: code sha256 per file, page sha256, Chromium, settings
//   frames/<chunk>/<frame>.png        written as .tmp, then renamed; deleted once the chunk's mp4 is verified
//   frames/<chunk>/frames.jsonl       one line per finished frame: frame, t, sha256, K, ms (kept)
//   frames/<chunk>/chunk.json         the versions that rendered into the chunk, and its verified encode
//   chunks/<chunk>.mp4                x264 crf 15, constant fps, keyframe every second
//   master.mp4, master-audio.mp4, contact-sheet.jpg, audit.json, render.log (from run.sh)
// <film>/build/.tmp/                  the page HTML · <film>/build/.render.lock · <film>/build/cues-<id>-<aspect>.json
// <film>/out/<name>.mp4 + .jpg        the delivery file and its poster
//
// Exit codes: 0 done · 2 refused (usage, a code/version mismatch, the scene would not load, another render
// running) · 3 a frame failed 3 times · 4 an encode, verify or assembly step failed · 1 anything unexpected ·
// 130/143 stopped by a signal. run.sh restarts on 1 and 3 only.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { page, loadTheme, KIT, THREE_FILE } from "./page.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));              // kits/cinema/film
const repo = path.resolve(KIT, "../..");
const kitFile = path.join(KIT, "cinema3d.js");
const rel = (f) => path.relative(repo, f) || ".";
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(`[${ts()}]`, ...a);
const warn = (...a) => console.log(`[${ts()}] !`, ...a);
class Stop extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const die = (code, msg) => { console.error(`render.mjs: ${msg}`); process.exit(code); };

// ───────── options ─────────
const USAGE = `usage: node kits/cinema/film/render.mjs --film <dir> [options]        (kits/cinema/film/README.md)
  --film DIR                   the episode folder: film.json, scene.mjs, theme (film.json "theme", ../theme.json or ./theme.json)
  --tier final|draft|animatic  final: 1080x1920 (16x9: 1920x1080) at --fps, full finish (default)
                               draft: 540x960, 15 fps, full finish with K <= 6 · animatic: 540x960, 6 fps, no finish
  --aspect 9x16|16x9           one per run (default 9x16)
  --fps N                      the delivery rate (default film.json fps, else 30): the final tier's rate and every tier's shutter
  --from S --to S              part of the film, in seconds · --times S,S,...  single frames (stills)
  --chunk S                    chunk length in seconds (default 10)
  --resume                     keep finished frames (PNG + log line + matching sha256), render the rest
  --fresh                      discard every chunk the range touches, then render them
  --force-mixed                resume or assemble frames made by different code or another Chromium build
  --keep-png                   keep a chunk's PNGs after its mp4 is verified
  --assemble                   join the chunk mp4s, mux --audio (no -shortest), make the delivery file, poster
                               and contact sheet · --audio FILE --poster S --name NAME --out DIR
  --crf N                      the delivery encode's x264 CRF (default 19; lower is higher quality, e.g. 14 for crisp line art)
  --cues                       write the scene's event table to <build>/cues-<id>-<aspect>.json; renders nothing
  --plain                      no cinema finish (the animatic tier never has it)
  --build DIR                  the build root (default <film>/build)
  --share-cpu                  render although another render.mjs is running on this box (both slow down)
  --fallback-fonts             let the final tier render with a theme font missing (the system-safe face stands in)
  --page-frames N              a fresh page every N frames (default 300)
  --frame-timeout S            a frame that takes longer is retried on a fresh page (default 600)
  --where                      print this run's build folder`;
const SPEC = { film: 1, tier: 1, aspect: 1, fps: 1, from: 1, to: 1, times: 1, chunk: 1, build: 1, out: 1, name: 1, audio: 1, poster: 1,
  "page-frames": 1, "frame-timeout": 1, crf: 1, resume: 0, fresh: 0, "force-mixed": 0, "keep-png": 0, assemble: 0, plain: 0, cues: 0, where: 0, help: 0, "share-cpu": 0,
  "fallback-fonts": 0 };
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
  if (!A.film) bad("--film <dir> is required (the episode folder holding film.json and scene.mjs)");
  if (A.resume && A.fresh) bad("--resume keeps finished frames and --fresh discards them: pick one");
  if (A.times && (A.from !== undefined || A.to !== undefined)) bad("--times or --from/--to, not both");
}
const num = (k, d) => { if (A[k] === undefined) return d; const x = Number(A[k]); if (!Number.isFinite(x)) die(2, `--${k} must be a number, not "${A[k]}"`); return x; };

// ───────── the film folder ─────────
const filmDir = path.resolve(A.film);
const filmJson = path.join(filmDir, "film.json");
if (!fs.existsSync(filmJson)) die(2, `no film.json in ${rel(filmDir)} (--film is the episode folder)`);
let FILM;
try { FILM = JSON.parse(fs.readFileSync(filmJson, "utf8")); } catch (e) { die(2, `${rel(filmJson)} is not valid JSON: ${e.message}`); }
if (!(FILM.dur > 0)) die(2, `${rel(filmJson)} needs "dur" (seconds, > 0)`);
const filmId = String(FILM.id || path.basename(filmDir));
const scenePath = path.resolve(filmDir, FILM.scene || "scene.mjs");
if (!fs.existsSync(scenePath)) die(2, `no scene module at ${rel(scenePath)} (film.json "scene", default scene.mjs)`);
const themeCands = FILM.theme ? [path.resolve(filmDir, FILM.theme)] : [path.resolve(filmDir, "../theme.json"), path.join(filmDir, "theme.json")];
const themePath = themeCands.find((f) => fs.existsSync(f));
if (!themePath) die(2, `no theme: looked for ${themeCands.map(rel).join(" and ")} (film.json "theme" names another)`);
let theme;
try { theme = loadTheme(themePath); } catch (e) { die(2, e.message); }

const TIERS = {
  final: { size: { "9x16": [1080, 1920], "16x9": [1920, 1080] }, fps: null, kMax: null, plain: false },
  draft: { size: { "9x16": [540, 960], "16x9": [960, 540] }, fps: 15, kMax: 6, plain: false },
  animatic: { size: { "9x16": [540, 960], "16x9": [960, 540] }, fps: 6, kMax: null, plain: true },
};
const tier = A.tier || "final", aspect = A.aspect || "9x16";
if (!TIERS[tier]) die(2, `--tier is final, draft or animatic, not "${tier}"`);
if (!TIERS[tier].size[aspect]) die(2, `--aspect is 9x16 or 16x9, one per run, not "${aspect}"`);
const deliveryFps = num("fps", FILM.fps || 30);
const [W, H] = TIERS[tier].size[aspect];
const fps = TIERS[tier].fps || deliveryFps;
const plain = TIERS[tier].plain || A.plain === true;     // no finish: the scene's own renderer, as written
const kMax = plain ? null : TIERS[tier].kMax;
const tierDir = tier + (A.plain && !TIERS[tier].plain ? "-plain" : "");
const buildRoot = path.resolve(A.build || path.join(filmDir, "build"));
const base = path.join(buildRoot, tierDir, aspect);
if (A.where) { console.log(base); process.exit(0); }
const keepPng = A["keep-png"] === true, forceMixed = A["force-mixed"] === true;
const pageFrames = Math.max(1, Math.round(num("page-frames", 300)));
const frameTimeout = num("frame-timeout", 600) * 1000;
const CHROMIUM = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const pwDir = process.env.PLAYWRIGHT_DIR || (() => { const r = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }); return r.status === 0 ? path.dirname(r.stdout.trim()) : repo; })();

// ───────── the scene module, with the finish spliced in ─────────
// cinema3d.js goes in right after the scene's three.js import (it needs THREE in scope), and the scene's
// renderer is built through cinemaRenderer() (kits/cinema/cinema3d.js: r160 assigns render() per instance)
const IMP = 'import * as THREE from "three";';
const sceneSrc = fs.readFileSync(scenePath, "utf8");
const cinema3d = plain ? "" : fs.readFileSync(kitFile, "utf8");
if (!plain && !sceneSrc.includes(IMP)) die(2, `${rel(scenePath)} has no line ${IMP} so cinema3d.js can't go in after it`);
if (/<\/script/i.test(sceneSrc)) die(2, `${rel(scenePath)} contains "</script", which would end the page's inline module`);
const filmModule = (src) => {
  if (!cinema3d) return src;
  const body = src.split("new THREE.WebGLRenderer(").join("cinemaRenderer(");
  const at = body.indexOf(IMP);
  return body.slice(0, at + IMP.length) + "\n" + cinema3d + "\n" + body.slice(at + IMP.length);
};
const shots = Array.isArray(FILM.shots) && FILM.shots.length ? FILM.shots : [{ at: 0, name: "main" }];
const scene = { id: filmId, dur: FILM.dur, poster: FILM.poster, shots, film: FILM, base: path.dirname(scenePath), module: filmModule(sceneSrc) };
const html = page(scene, W, H, theme);
const tmp = path.join(filmDir, "build", ".tmp");
const pageFile = path.join(tmp, `${filmId.replace(/[^\w.-]/g, "_")}-${tierDir}-${aspect}.html`);

// the page's text, checked at each shot's settled moments: past the frame, outside the safe box, on other text
const AUDIT = `(() => {
  const W = window.W, H = window.H, S = window.HUD_SAFE, bad = [];
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || Number(cs.opacity) < 0.6 || cs.display === "none") return false; } return true; };
  const GROUP = ".hud-cap, .hud-label, .hud-badge, .hud-counter, .hud-scale, .hud-title, .hud-end, [data-group]";
  const leaves = [...document.querySelectorAll(".stage *")].filter((el) => vis(el) && (el instanceof SVGTextElement || [...el.childNodes].every((n) => n.nodeType === 3)) && (el.textContent || "").trim());
  for (const el of leaves) {
    const r = el.getBoundingClientRect(), t = el.textContent.trim().slice(0, 36);
    if (r.right > W - 4 || r.bottom > H - 4 || r.left < 4 || r.top < 4) bad.push("past the frame: " + t);
    else if (S && (r.left < S.l - 2 || r.right > S.r + 2 || r.top < S.t - 2 || r.bottom > S.b + 2)) bad.push("outside the safe box: " + t);
  }
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    if (leaves[i].contains(leaves[j]) || leaves[j].contains(leaves[i])) continue;
    const gi = leaves[i].closest(GROUP), gj = leaves[j].closest(GROUP);
    if (gi && gi === gj) continue;
    const a = leaves[i].getBoundingClientRect(), b = leaves[j].getBoundingClientRect();
    if (a.left < b.right - 3 && b.left < a.right - 3 && a.top < b.bottom - 3 && b.top < a.bottom - 3) bad.push("overlap: " + leaves[i].textContent.trim().slice(0, 24) + " / " + leaves[j].textContent.trim().slice(0, 24));
  }
  return bad;
})()`;
const LAUNCH_ARGS = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"];
const SEED = () => { let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; const T0 = 1700000000000; Date.now = () => T0; performance.now = () => 0; window.requestAnimationFrame = () => 0; };
// one call per frame does the probe, the K sub-frames, the depth and the finish; the shutter is always the delivery rate's
const FRAME = ([t, fps]) => { if (window.cinemaFrame) { window.CINEMA.fps = fps; return window.cinemaFrame(t); } window.seek(t); return null; };

// ───────── hashes: what made a frame ─────────
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
const sha256File = (f) => {
  const h = crypto.createHash("sha256"), fd = fs.openSync(f, "r"), buf = Buffer.allocUnsafe(1 << 20);
  try { let n; while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n)); } finally { fs.closeSync(fd); }
  return h.digest("hex");
};
// every module the page can import, found by following the static imports from the scene (the import map's
// "three" and "cinema/", relative paths, file:// URLs). A file the page loads that this misses is reported
// when the page opens, because a change to it would go unnoticed on resume.
const IMPORT_RE = /\bimport\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+)["']|\bexport\s*[\w$*{}\s,]+?\s*from\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const resolveSpec = (spec, from) => {
  if (spec === "three") return THREE_FILE;
  if (spec.startsWith("cinema/")) return path.join(KIT, spec.slice(7));
  if (spec.startsWith("file://")) return fileURLToPath(spec);
  if (/^\.{0,2}\//.test(spec)) return path.resolve(path.dirname(from), spec);
  return null;
};
const modules = new Set(), unresolved = new Set();
const scan = (file) => {
  if (modules.has(file) || file === THREE_FILE) return;
  modules.add(file);
  for (const m of fs.readFileSync(file, "utf8").matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2] || m[3], f = resolveSpec(spec, file);
    if (f === THREE_FILE) continue;
    if (!f) unresolved.add(spec); else if (fs.existsSync(f)) scan(f);
  }
};
scan(scenePath);
modules.delete(scenePath);
const codeFiles = {
  scene: scenePath, "film.json": filmJson, "theme.json": themePath, ...(theme.cssFile ? { "theme.css": theme.cssFile } : {}),
  ...(plain ? {} : { "cinema3d.js": kitFile }), "three.module.min.js": THREE_FILE,
  ...Object.fromEntries([...modules].sort().map((f) => [rel(f), f])),
  ...Object.fromEntries(theme.fonts.map((f) => [`font:${path.basename(f.file)}`, f.file])),
};
const files = Object.fromEntries(Object.entries(codeFiles).map(([k, f]) => [k, { path: rel(f), sha256: sha256File(f) }]));
const codeSha256 = sha256(Object.entries(files).map(([k, v]) => `${k} ${v.sha256}\n`).join(""));
const pageSha256 = sha256(html);   // everything the browser is given inline (page.mjs, the splice, film.json, the theme)
const hashed = new Set([...Object.values(codeFiles), pageFile]);
const info = { "page.mjs": sha256File(path.join(here, "page.mjs")), "render.mjs": sha256File(fileURLToPath(import.meta.url)), node: process.version,
  chromiumPath: (() => { try { return CHROMIUM ? fs.realpathSync(CHROMIUM) : "playwright default"; } catch { return CHROMIUM; } })(),
  fontsMissing: theme.missing.map((f) => rel(f.file)) };

// ───────── frames, chunks and their records ─────────
const total = Math.round(FILM.dur * fps);
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
  if (secs.some((x) => !Number.isFinite(x) || x < 0 || x > FILM.dur)) die(2, `--times must be seconds within 0–${FILM.dur}`);
  planFrames = [...new Set(secs.map((x) => Math.min(total - 1, Math.round(x * fps))))].sort((a, b) => a - b);
} else {
  const from = num("from", 0), to = num("to", FILM.dur);
  if (!(from >= 0 && to > from && from < FILM.dur)) die(2, `--from ${from} --to ${to}: need 0 <= from < to, and from inside the film's ${FILM.dur} s`);
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

// ───────── processes, the locks, the browser ─────────
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
const lockFile = path.join(filmDir, "build", ".render.lock");
const isRender = (pid) => { try { return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("render.mjs"); } catch { return false; } };
let locked = false;
const takeLock = () => {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const L = readJson(lockFile, null);
  if (L && L.pid !== process.pid && isRender(L.pid)) throw new Stop(2, `another render of this film is running: PID ${L.pid} (${L.what}, since ${L.at}). One at a time: wait, or stop it with run.sh ${rel(filmDir)} stop / kill ${L.pid}.`);
  writeJsonAtomic(lockFile, { pid: process.pid, what: `${tierDir}/${aspect}${A.assemble ? " assemble" : A.cues ? " cues" : ""}`, base: rel(base), at: new Date().toISOString() });
  locked = true;
};
process.on("exit", () => { if (locked && readJson(lockFile, {}).pid === process.pid) fs.rmSync(lockFile, { force: true }); });
// and one Chromium job per box (the studio rule: two renders slow each other 1.6–1.8×), across every film
// and both renderers: any other node process running a render.mjs, unless --share-cpu
const otherRenders = () => {
  const out = [];
  let ids = [];
  try { ids = fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d) && +d !== process.pid); } catch { return out; }
  for (const d of ids) {
    let argv;
    try { argv = fs.readFileSync(`/proc/${d}/cmdline`, "utf8").split("\0").filter(Boolean); } catch { continue; }
    if (argv.length < 2 || path.basename(argv[0]) !== "node" || !/render\.mjs$/.test(argv[1])) continue;
    if (argv.some((a) => /^--(where|help|list)$/.test(a))) continue;
    out.push(`PID ${d}: ${argv.slice(1).join(" ").replace(repo + "/", "").slice(0, 140)}`);
  }
  return out;
};
const boxCheck = () => {
  const o = otherRenders();
  if (!o.length) return;
  if (!A["share-cpu"]) throw new Stop(2, `another render is running on this box (${o.join("; ")}). One job at a time: wait for it, or pass --share-cpu to run anyway (both slow down).`);
  warn(`--share-cpu: sharing the CPU with ${o.join("; ")}; s/frame here is slower than on an idle box`);
};

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
const reported = new Set();
// a page: init script, goto, the theme's faces loaded, seek(); plus the tier's kMax and a CDP session
const openPage = () => withTimeout((async () => {
  await ensureBrowser();
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const Q = { pg, cdp: null, errors: [], frames: 0, loaded: new Set() };
  // a crash or close fails the frame in flight at once (Playwright leaves an evaluate on a crashed page pending)
  Q.dead = new Promise((_, reject) => { pg.once("crash", () => reject(new Error("the page crashed"))); pg.once("close", () => reject(new Error("the page closed"))); });
  Q.dead.catch(() => {});
  try {
    await pg.addInitScript(SEED);
    pg.on("pageerror", (e) => Q.errors.push(e.message));
    pg.on("crash", () => Q.errors.push("the page crashed"));
    pg.on("request", (r) => { if (r.url().startsWith("file://")) { try { Q.loaded.add(fileURLToPath(r.url())); } catch {} } });
    pg.on("requestfailed", (r) => Q.errors.push(`could not load ${r.url().slice(0, 160)}`));
    await pg.goto("file://" + pageFile);
    await pg.evaluate(() => window.FONTS_READY);
    await pg.waitForFunction(() => typeof window.seek === "function", null, { timeout: 30000 }).catch(() => {});
    await pg.evaluate(() => window.SCENE_READY || null);              // a scene that loads something async sets this promise
    await pg.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
    if (Q.errors.length || !(await pg.evaluate(() => typeof window.seek === "function"))) throw new SceneError(`the scene page failed to load: ${Q.errors.join(" | ") || "no seek()"}`);
    if (!plain && !(await pg.evaluate(() => typeof window.cinemaFrame === "function"))) throw new SceneError("the cinema finish did not load (no window.cinemaFrame)");
    if (kMax != null) await pg.evaluate((k) => { if (window.CINEMA) window.CINEMA.kMax = k; }, kMax);
    for (const f of Q.loaded) if (!hashed.has(f) && !reported.has(f)) { reported.add(f); warn(`the page loaded ${rel(f)}, which is not in the code hash (an import render.mjs could not follow): a change to it would go unnoticed on resume`); }
    Q.cdp = await pg.context().newCDPSession(pg);
    everOpened = true;
    return Q;
  } catch (e) {
    await pg.close().catch(() => {});
    if (e instanceof SceneError && !everOpened) throw new Stop(2, `${filmId}: ${e.message} (page ${rel(pageFile)})`);
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
const settingsNow = () => ({ scene: filmId, dur: FILM.dur, frames: total, width: W, height: H, fps, shutterFps: plain ? null : deliveryFps, kMax, plain, chunkSeconds: chunkSec, chunkFrames });
const gate = (work) => {
  const man = readJson(manifestFile, null), settings = settingsNow(), now = new Date().toISOString();
  if (!work.length || !man) {
    if (work.length && !forceMixed) throw new Stop(2, `${rel(base)} holds frames but no manifest.json, so nothing says what made them. Discard them with --fresh, or adopt them with --force-mixed.`);
    manifest = { film: rel(filmDir), theme: rel(themePath), tier: tierDir, aspect, ...settings, codeSha256, files, pageSha256, chromium: chromiumVersion, info, startedAt: now, mixed: [], runs: [] };
    if (work.length) manifest.mixed.push({ at: now, note: "adopted frames that had no manifest (--force-mixed)" });
    return;
  }
  const hard = Object.keys(settings).filter((k) => JSON.stringify(man[k]) !== JSON.stringify(settings[k]));
  if (hard.length) throw new Stop(2, `the frames in ${rel(base)} were made with ${hard.map((k) => `${k}=${JSON.stringify(man[k])}`).join(", ")}; this run has ${hard.map((k) => `${k}=${JSON.stringify(settings[k])}`).join(", ")}. They can't be one film: use --fresh over the whole film, or another --build.`);
  const soft = [];
  if (man.codeSha256 !== codeSha256) soft.push(`the code hash differs (changed: ${Object.keys({ ...files, ...man.files }).filter((k) => (man.files[k] || {}).sha256 !== (files[k] || {}).sha256).join(", ")})`);
  else if (man.pageSha256 !== pageSha256) soft.push("the page HTML differs (page.mjs, the splice in render.mjs, or the repo moved)");
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
  boxCheck();
  fs.mkdirSync(base, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(base, "render.pid"), process.pid + "\n");
  fs.writeFileSync(pageFile, html);
  log(`${filmId} · ${tierDir} ${aspect} ${W}x${H} @ ${fps} fps · ${plain ? "no finish (plain)" : `shutter at ${deliveryFps} fps${kMax ? `, K <= ${kMax}` : ""}`} · chunks of ${chunkFrames} frames`);
  log(`film ${rel(filmDir)} (theme ${rel(themePath)}): ${FILM.dur} s = ${total} frames, ${nChunks} chunks · this run: ${A.times ? `frames ${planFrames.join(",")}` : `frames ${planFrames[0]}–${planFrames.at(-1)} (${span(planFrames[0], planFrames.at(-1) + 1)})`} → ${rel(base)}`);
  if (theme.missing.length) {
    const what = `theme font(s) missing: ${theme.missing.map((f) => `${f.family} (${rel(f.file)})`).join(", ")}`;
    // a final set in the stand-in face is hours wasted: refuse unless asked; drafts and animatics only warn
    if (tier === "final" && !A["fallback-fonts"]) throw new Stop(2, `${what}. Add the files (the channel's fonts/ folder), or pass --fallback-fonts to render the final in the system-safe face.`);
    warn(`${what}; the system-safe fallback stands in`);
  }
  if (unresolved.size) warn(`imports render.mjs can't follow (not hashed): ${[...unresolved].join(", ")}`);
  await ensureBrowser();
  version = { codeSha256, pageSha256, chromium: chromiumVersion };
  log(`Chromium ${chromiumVersion} · code ${codeSha256.slice(0, 12)} (${Object.keys(files).length} files: ${Object.keys(files).join(", ")}) · page ${pageSha256.slice(0, 12)}`);

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

  // the review: text past the frame, outside the safe box or on other text at each shot's settled moments, and dead air
  const warnings = [];
  if (rendered) {
    try {   // the frames are safe on disk whatever happens here: a failed audit is reported, not fatal
      P ||= await openPage();
      const lo = planFrames[0] / fps, hi = (planFrames.at(-1) + 1) / fps;
      for (let k = 0; k < shots.length; k++) {
        const a = shots[k].at, b = k + 1 < shots.length ? shots[k + 1].at : FILM.dur;
        for (const t of [a + Math.min(3, (b - a) * 0.6), b - 0.2]) {
          if (t < lo || t >= hi) continue;
          await P.pg.evaluate((t) => window.seek(t), t);
          for (const w of await P.pg.evaluate(AUDIT)) warnings.push(`${shots[k].name} @${t.toFixed(1)}s ${w}`);
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
  if (hard.length) throw new Stop(2, `${rel(base)} was rendered with other settings (${hard.map((k) => `${k}=${JSON.stringify(man[k])}`).join(", ")}): pass the same --tier/--fps/--chunk as the render`);
  const f0 = planFrames[0], f1 = planFrames.at(-1) + 1;
  const ks = Array.from({ length: chunkOf(f1 - 1) - chunkOf(f0) + 1 }, (_, i) => chunkOf(f0) + i);
  const first = chunkRange(ks[0])[0], end = chunkRange(ks.at(-1))[1], n = end - first, vDur = n / fps, frame = 1 / fps;
  const missing = ks.filter((k) => !encodedOk(k));
  if (missing.length) throw new Stop(4, `can't assemble ${tierDir}/${aspect}: chunk(s) ${missing.map(c3).join(", ")} have no verified mp4 yet. Render them first (run.sh ${rel(filmDir)} --tier ${tier} ...).`);
  if (first !== f0 || end !== f1) warn(`the range is widened to whole chunks: frames ${first}–${end - 1} (${span(first, end)})`);
  const vers = new Map();
  for (const k of ks) for (const v of readJson(metaOf(k), {}).versions || []) vers.set(`${v.codeSha256} ${v.pageSha256} ${v.chromium}`, (vers.get(`${v.codeSha256} ${v.pageSha256} ${v.chromium}`) || []).concat(c3(k)));
  if (vers.size > 1) {
    const what = `the chunks were rendered by ${vers.size} versions: ${[...vers].map(([v, c]) => `code ${v.slice(0, 12)} → chunks ${c.join(",")}`).join("; ")}`;
    if (!forceMixed) throw new Stop(2, `${what}. Render the odd ones again with --fresh, or pass --force-mixed.`);
    warn(`--force-mixed: ${what}`);
  }
  const whole = first === 0 && end === total;
  const name = A.name || `${filmId}-${aspect}${tierDir === "final" ? "" : "-" + tierDir}${whole ? "" : `-${+(first / fps).toFixed(2)}s-${+(end / fps).toFixed(2)}s`}`;
  const outDir = path.resolve(A.out || path.join(filmDir, "out"));
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
    audio = path.isAbsolute(A.audio) ? A.audio : [path.resolve(A.audio), path.resolve(filmDir, A.audio)].find((f) => fs.existsSync(f)) || path.resolve(A.audio);
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
  const dcrf = A.crf !== undefined ? String(num("crf")) : "19", hiQ = Number(dcrf) < 19;   // --crf: default 19 (unchanged); lower allows a higher rate cap
  await ffmpeg(["-i", src, "-map", "0:v:0", ...(audio ? ["-map", "0:a:0", "-c:a", "copy"] : []), "-c:v", "libx264", "-preset", "slow", "-crf", dcrf, "-maxrate", hiQ ? "24M" : "12M", "-bufsize", hiQ ? "48M" : "24M",
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(fps), "-fps_mode", "cfr", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
    "-movflags", "+faststart", partOf(out)]);
  const dFrames = await countFrames(partOf(out), false), d = await streams(partOf(out));
  if (dFrames !== n) throw new Stop(4, `the delivery file has ${dFrames} frames, expected ${n}`);
  if (audio && !(Math.abs(Number(d.a.duration) - Number(d.v.duration)) <= frame + 1e-6)) throw new Stop(4, `the delivery file's audio (${d.a.duration} s) and picture (${d.v.duration} s) are more than one frame apart`);
  fs.renameSync(partOf(out), out);
  log(`delivery: ${rel(out)} ${mb(out)}, ${d.v.width}x${d.v.height} ${fps} fps, ${dFrames} frames, ${(Number(d.j.format.bit_rate) / 1e6).toFixed(1)} Mbps${audio ? `, audio ${Number(d.a.duration).toFixed(3)} s` : ", no audio"}`);

  // 4. the poster
  let pt = A.poster !== undefined ? num("poster") : FILM.poster ?? first / fps;
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

// ───────── cues: the scene's event table for the studio's sound ─────────
const cues = async () => {
  takeLock();
  boxCheck();
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(pageFile, html);
  P = await openPage();
  const pg = P.pg, fps = deliveryFps;
  // the scene's own event table (the HUD supplies one: labels, counters, badges, signatures), in film time,
  // for the studio (kits/cinema/studio). Each element's on-screen position is read once it has settled, so
  // the sound pans with it, and, independently of the table, the first frame on which it is actually visible.
  const c = await pg.evaluate(() => window.SCENE_CUES ? window.SCENE_CUES() : null);
  if (!c) throw new Stop(2, `${filmId}: the scene has no SCENE_CUES() (createHud defines one; a scene without the HUD defines its own)`);
  c.shown = {};
  for (const e of c.events.filter((e) => e.el)) {
    e.pos = await pg.evaluate(([t, id]) => { window.seek(t); const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); return [+((r.left + r.width / 2) / innerWidth).toFixed(3), +((r.top + r.height / 2) / innerHeight).toFixed(3)]; }, [Math.min(e.t + 0.7, FILM.dur - 1e-3), e.el]);
    for (let f = Math.max(0, Math.floor((e.t - 0.2) * fps)); f <= Math.min(Math.ceil((e.t + 0.5) * fps), Math.round(FILM.dur * fps) - 1); f++) {
      const op = await pg.evaluate(([t, id]) => { window.seek(t); const el = document.getElementById(id); return el ? +getComputedStyle(el).opacity : 0; }, [f / fps, e.el]);
      if (op > 0.02) { c.shown[e.tag] = +(f / fps).toFixed(4); break; }
    }
  }
  const cueFile = path.join(buildRoot, `cues-${filmId}-${aspect}.json`);
  fs.mkdirSync(buildRoot, { recursive: true });
  fs.writeFileSync(cueFile, JSON.stringify({ scene: filmId, aspect, fps, ...c }, null, 1));
  log(`${filmId} ${aspect}: ${c.events.length} cues → ${rel(cueFile)}`);
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
