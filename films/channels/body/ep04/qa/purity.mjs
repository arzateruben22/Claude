// Purity: the same frames sought in order and in a shuffled order on one page must give identical canvas pixels
// (plain page, no finish: the scene's own state is what is tested). Prints how many of N frames match.
//   PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium node qa/purity.mjs <film> [n=40]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { page as mkPage, loadTheme } from "../../../../../kits/cinema/film/page.mjs";
const film = path.resolve(process.argv[2] || "."), N = +(process.argv[3] || 40), W = 270, H = 480;
const FILM = JSON.parse(fs.readFileSync(path.join(film, "film.json"), "utf8"));
const html = mkPage({ id: FILM.id, dur: FILM.dur, poster: FILM.poster, shots: FILM.shots, film: FILM, base: film, module: fs.readFileSync(path.join(film, "scene.mjs"), "utf8") }, W, H, loadTheme(path.join(film, "../theme.json")));
fs.mkdirSync(path.join(film, "build", ".tmp"), { recursive: true });
const pageFile = path.join(film, "build", ".tmp", "qa-purity-page.html");
fs.writeFileSync(pageFile, html);
const pw = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "x.js"))("playwright");
const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
const pg = await b.newPage({ viewport: { width: W, height: H } });
await pg.goto("file://" + pageFile);
await pg.evaluate(() => window.FONTS_READY);
await pg.waitForFunction(() => typeof window.seek === "function", null, { timeout: 60000 });
const times = Array.from({ length: N }, (_, i) => +(((i + 0.37) / N) * FILM.dur).toFixed(4));
const grab = async (t) => {
  const canvas = await pg.evaluate((t) => { window.seek(t); return document.getElementById("gl").toDataURL("image/png"); }, t);
  const shot = await pg.screenshot();
  return [crypto.createHash("sha256").update(canvas).digest("hex"), crypto.createHash("sha256").update(shot).digest("hex")];
};
const A = new Map(); for (const t of times) A.set(t, await grab(t));
let s = 7; const order = [...times].sort(() => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5);
let canvasSame = 0, pageSame = 0; const diff = [];
for (const t of order) { const [c, p] = await grab(t); if (c === A.get(t)[0]) canvasSame++; else diff.push(t); if (p === A.get(t)[1]) pageSame++; }
console.log(`canvas identical ${canvasSame}/${N}, whole page identical ${pageSame}/${N}${diff.length ? "; canvas differs at " + diff.join(",") : ""}`);
await b.close();
