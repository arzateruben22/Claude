// Quick looks at the scene without the renderer's bookkeeping: loads the film's page (the kit's page.mjs, with
// cinema3d.js spliced in as render.mjs does when --finish), seeks the given times and saves PNGs. For iterating
// on the set and the staging; the real stills come from render.mjs --tier final --times.
//   PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium node qa/peek.mjs <film> <out dir> 0,5.2,20 [--finish] [--size 540x960]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { page as mkPage, loadTheme } from "../../../../../kits/cinema/film/page.mjs";
const [film0, out0, times0, ...rest] = process.argv.slice(2);
const film = path.resolve(film0), out = path.resolve(out0), finish = rest.includes("--finish");
const size = (rest[rest.indexOf("--size") + 1] || "540x960").split("x").map(Number), [W, H] = rest.includes("--size") ? size : [540, 960];
const FILM = JSON.parse(fs.readFileSync(path.join(film, "film.json"), "utf8"));
const theme = loadTheme(path.join(film, "../theme.json"));
const IMP = 'import * as THREE from "three";';
let src = fs.readFileSync(path.join(film, "scene.mjs"), "utf8");
if (finish) {
  const c3d = fs.readFileSync(new URL("../../../../../kits/cinema/cinema3d.js", import.meta.url), "utf8");
  src = src.split("new THREE.WebGLRenderer(").join("cinemaRenderer(");
  const at = src.indexOf(IMP); src = src.slice(0, at + IMP.length) + "\n" + c3d + "\n" + src.slice(at + IMP.length);
}
const html = mkPage({ id: FILM.id, dur: FILM.dur, poster: FILM.poster, shots: FILM.shots, film: FILM, base: film, module: src }, W, H, theme);
fs.mkdirSync(out, { recursive: true });
const pageFile = path.join(out, "peek-page.html"); fs.writeFileSync(pageFile, html);
const pw = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "x.js"))("playwright");
const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
const pg = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; pg.on("pageerror", (e) => errs.push(e.message)); pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.text()); });
await pg.addInitScript(() => { let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; Date.now = () => 1700000000000; performance.now = () => 0; });
await pg.goto("file://" + pageFile);
await pg.evaluate(() => window.FONTS_READY);
await pg.waitForFunction(() => typeof window.seek === "function", null, { timeout: 60000 }).catch(() => {});
if (errs.length) console.log("errors:", errs.join("\n"));
console.log(JSON.stringify(await pg.evaluate(() => window.MI_SOLVE || null)));
for (const t of times0.split(",").map(Number)) {
  const t0 = Date.now();
  const info = await pg.evaluate(([t]) => { if (window.cinemaFrame) { window.CINEMA.fps = 30; return window.cinemaFrame(t); } window.seek(t); return null; }, [t]);
  await pg.screenshot({ path: path.join(out, `t${t.toFixed(2).padStart(6, "0")}.png`) });
  console.log(`t ${t}: ${Date.now() - t0} ms ${info ? JSON.stringify(info) : ""}`);
}
if (errs.length) console.log("errors:", errs.slice(0, 10).join("\n"));
await b.close();
