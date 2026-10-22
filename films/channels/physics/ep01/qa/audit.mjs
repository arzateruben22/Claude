// Dense text audit: kits/cinema/film/render.mjs's own AUDIT (text past the frame, outside the safe box, on other text),
// run at every STEP seconds over the whole film on the plain page, instead of two moments per shot.
//   PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium node qa/audit.mjs <film folder> [step=0.25] [width=540]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { page as mkPage, loadTheme } from "../../../../../kits/cinema/film/page.mjs";
const [film, step = "0.25", Wd = "540"] = process.argv.slice(2);
const FILM = JSON.parse(fs.readFileSync(path.join(film, "film.json"), "utf8")), dur = FILM.dur;
const W = +Wd, H = Math.round(W * 16 / 9);
const theme = loadTheme(path.join(film, "../theme.json"));
const html = mkPage({ id: FILM.id, dur: FILM.dur, poster: FILM.poster, shots: FILM.shots, film: FILM, base: path.resolve(film), module: fs.readFileSync(path.join(film, "scene.mjs"), "utf8") }, W, H, theme);
fs.mkdirSync(path.join(film, "build", ".tmp"), { recursive: true });
const page = path.join(film, "build", ".tmp", "qa-audit-page.html");
fs.writeFileSync(page, html);
const pw = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "x.js"))("playwright");
const src = fs.readFileSync(new URL("../../../../../kits/cinema/film/render.mjs", import.meta.url), "utf8");
const AUDIT = src.slice(src.indexOf("const AUDIT = `") + 15, src.indexOf("})()`;", src.indexOf("const AUDIT = `")) + 4);
const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
const pg = await b.newPage({ viewport: { width: W, height: H } });
pg.on("pageerror", (e) => console.log("pageerror", e.message));
await pg.addInitScript(() => { let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; Date.now = () => 1700000000000; performance.now = () => 0; window.requestAnimationFrame = () => 0; });
await pg.goto("file://" + path.resolve(page));
await pg.evaluate(() => window.FONTS_READY);
await pg.waitForFunction(() => typeof window.seek === "function");
await pg.evaluate(() => window.SCENE_READY || null);
const out = new Map();
for (let t = 0; t < +dur; t += +step) {
  await pg.evaluate((t) => window.seek(t), t);
  for (const w of await pg.evaluate(AUDIT)) { if (!out.has(w)) out.set(w, []); out.get(w).push(+t.toFixed(2)); }
}
for (const [w, ts] of out) console.log(`${w.replace(/\n/g, " ")}  @ ${ts[0]}–${ts.at(-1)} (${ts.length}×)`);
console.log(out.size ? `${out.size} distinct warnings` : "audit clean at every step");
await b.close();
