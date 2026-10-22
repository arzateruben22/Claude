// Purity: 40 frames sought in order and then shuffled, each run on a fresh page, must give the same canvas pixels
// (and, ideally, the same HUD markup).
//   PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium node qa/purity.mjs <film folder>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { page as mkPage, loadTheme } from "../../../../../kits/cinema/film/page.mjs";
const film = path.resolve(process.argv[2] || "."), W = 540, H = 960;
const FILM = JSON.parse(fs.readFileSync(path.join(film, "film.json"), "utf8"));
const html = mkPage({ id: FILM.id, dur: FILM.dur, poster: FILM.poster, shots: FILM.shots, film: FILM, base: path.resolve(film), module: fs.readFileSync(path.join(film, "scene.mjs"), "utf8") }, W, H, loadTheme(path.join(film, "../theme.json")));
fs.mkdirSync(path.join(film, "build", ".tmp"), { recursive: true });
const pageFile = path.join(film, "build", ".tmp", "qa-purity-page.html"); fs.writeFileSync(pageFile, html);
const pw = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "x.js"))("playwright");
const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
const times = Array.from({ length: 40 }, (_, i) => +(i * 1.87 % FILM.dur).toFixed(3));
const run = async (order) => {
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  await pg.addInitScript(() => { let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; Date.now = () => 1700000000000; performance.now = () => 0; window.requestAnimationFrame = () => 0; });
  await pg.goto("file://" + pageFile); await pg.evaluate(() => window.FONTS_READY); await pg.waitForFunction(() => typeof window.seek === "function"); await pg.evaluate(() => window.SCENE_READY || null);
  const out = {};
  for (const t of order) out[t] = await pg.evaluate((t) => { window.seek(t); return document.getElementById("gl").toDataURL() + "|" + document.getElementById("hud").innerHTML; }, t);
  await pg.close();
  return out;
};
const A = await run(times), sh = [...times].sort((x, y) => ((x * 7919) % 13) - ((y * 7919) % 13)), B = await run(sh);
let same = 0; const diff = [];
for (const t of times) { const h = (s) => crypto.createHash("sha256").update(s).digest("hex"); if (h(A[t]) === h(B[t])) same++; else {
  diff.push(t);
  const [ca, ha] = A[t].split("|"), [cb, hb] = B[t].split("|");
  if (diff.length <= 3) { console.log(t, "canvas", ca === cb ? "same" : "DIFF", "hud", ha === hb ? "same" : "DIFF");
    if (ha !== hb) { let i = 0; while (ha[i] === hb[i]) i++; console.log("  hud A:", ha.slice(Math.max(0, i - 150), i + 120)); console.log("  hud B:", hb.slice(Math.max(0, i - 150), i + 120)); } } } }
const canvasSame = times.filter((t) => A[t].split("|")[0] === B[t].split("|")[0]).length;
console.log(`canvas ${canvasSame}/${times.length} identical; canvas + HUD markup ${same}/${times.length}${diff.length ? " (differ at " + diff.join(", ") + ")" : ""}`);
await b.close();
