// Dense text audit: kits/cinema/film/render.mjs's own AUDIT (text past the frame, outside the safe box, on other
// text), run every STEP seconds over the film on the plain page, instead of the renderer's two moments per shot.
// Also checks the apps' UI zones at 1080×1920 (top 250, bottom 500, right 180 px) for every visible text box,
// and prints each problem with its times.
//   PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium node qa/audit.mjs <film> [step=0.25] [width=540] [from] [to]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { page as mkPage, loadTheme } from "../../../../../kits/cinema/film/page.mjs";
const [film, step = "0.25", Wd = "540", from = "0", to] = process.argv.slice(2);
const FILM = JSON.parse(fs.readFileSync(path.join(film, "film.json"), "utf8")), dur = +(to ?? FILM.dur);
const W = +Wd, H = Math.round((W * 16) / 9);
const theme = loadTheme(path.join(film, "../theme.json"));
const html = mkPage({ id: FILM.id, dur: FILM.dur, poster: FILM.poster, shots: FILM.shots, film: FILM, base: path.resolve(film), module: fs.readFileSync(path.join(film, "scene.mjs"), "utf8") }, W, H, theme);
fs.mkdirSync(path.join(film, "build", ".tmp"), { recursive: true });
const page = path.join(film, "build", ".tmp", "qa-audit-page.html");
fs.writeFileSync(page, html);
const pw = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "x.js"))("playwright");
const src = fs.readFileSync(new URL("../../../../../kits/cinema/film/render.mjs", import.meta.url), "utf8");
const AUDIT = src.slice(src.indexOf("const AUDIT = `") + 15, src.indexOf("})()`;", src.indexOf("const AUDIT = `")) + 4);
const ZONES = `(() => { const W = window.W, H = window.H, k = W / 1080, bad = [];
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || Number(cs.opacity) < 0.3 || cs.display === "none") return false; } return true; };
  for (const el of document.querySelectorAll(".stage *")) {
    if (!vis(el) || !(el.textContent || "").trim() || ![...el.childNodes].every((n) => n.nodeType === 3)) continue;
    const r = el.getBoundingClientRect();
    if (r.top < 250 * k || r.bottom > H - 500 * k || r.right > W - 180 * k) bad.push("UI zone: " + el.textContent.trim().slice(0, 30) + " [" + [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x / k)).join(",") + "]");
  }
  return bad; })()`;
const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
const pg = await b.newPage({ viewport: { width: W, height: H } });
pg.on("pageerror", (e) => console.log("pageerror", e.message));
await pg.addInitScript(() => { let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; Date.now = () => 1700000000000; performance.now = () => 0; window.requestAnimationFrame = () => 0; });
await pg.goto("file://" + path.resolve(page));
await pg.evaluate(() => window.FONTS_READY);
await pg.waitForFunction(() => typeof window.seek === "function", null, { timeout: 60000 });
await pg.evaluate(() => window.SCENE_READY || null);
const out = new Map();
let n = 0;
for (let t = +from; t < dur; t += +step) {
  await pg.evaluate((t) => window.seek(t), t);
  n++;
  for (const w of [...(await pg.evaluate(AUDIT)), ...(await pg.evaluate(ZONES))]) { if (!out.has(w)) out.set(w, []); out.get(w).push(+t.toFixed(2)); }
}
for (const [w, ts] of out) console.log(`${w.replace(/\n/g, " ")}  @ ${ts[0]}–${ts.at(-1)} (${ts.length}×)`);
console.log(out.size ? `${out.size} distinct warnings over ${n} moments` : `audit clean at all ${n} moments (every ${step} s)`);
await b.close();
