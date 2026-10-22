// Every final frame's motion-blur sample count K, from the finish's own probe, with no pixels drawn: the page is the
// final tier's (1080x1920, cinema3d.js spliced in as render.mjs does), and each frame runs only cinemaFrame's probe
// half. Gives the K histogram that, with a measured s/frame per K, projects the final render's time.
//   PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium node qa/kprobe.mjs <film folder>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { page as mkPage, loadTheme } from "../../../../../kits/cinema/film/page.mjs";
const film = path.resolve(process.argv[2] || "."), W = 1080, H = 1920;
const FILM = JSON.parse(fs.readFileSync(path.join(film, "film.json"), "utf8"));
const theme = loadTheme(path.join(film, "../theme.json"));
const IMP = 'import * as THREE from "three";';
const c3d = fs.readFileSync(new URL("../../../../../kits/cinema/cinema3d.js", import.meta.url), "utf8");
let src = fs.readFileSync(path.join(film, "scene.mjs"), "utf8").split("new THREE.WebGLRenderer(").join("cinemaRenderer(");
const at = src.indexOf(IMP); src = src.slice(0, at + IMP.length) + "\n" + c3d + "\n" + src.slice(at + IMP.length);
const html = mkPage({ id: FILM.id, dur: FILM.dur, poster: FILM.poster, shots: FILM.shots, film: FILM, base: path.resolve(film), module: src }, W, H, theme);
fs.mkdirSync(path.join(film, "build", ".tmp"), { recursive: true });
const pageFile = path.join(film, "build", ".tmp", "qa-kprobe-page.html");
fs.writeFileSync(pageFile, html);
const pw = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "x.js"))("playwright");
const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
const pg = await b.newPage({ viewport: { width: W, height: H } });
await pg.goto("file://" + pageFile);
await pg.evaluate(() => window.FONTS_READY);
await pg.waitForFunction(() => typeof window.seek === "function");
await pg.evaluate(() => window.SCENE_READY || null);
const Ks = await pg.evaluate(({ n, fps }) => {
  const C = window.CINEMA, sh = C.shutter / fps, dur = window.SCENE.dur, out = [];
  const at = (x) => Math.min(Math.max(x, 0), dur - 1e-4);
  const dist2 = (a, b) => { let m = 0; a.forEach((p, k) => { const q = b.get(k); if (q) m = Math.max(m, Math.hypot(p[0] - q[0], p[1] - q[1])); }); return m; };
  for (let f = 0; f < n; f++) {
    const t = f / fps;
    C.mode = "probe"; C.probe = new Map(); window.seek(at(t - sh / 2)); const a = C.probe;
    C.probe = new Map(); window.seek(at(t + sh / 2)); const b = C.probe;
    C.mode = "direct";
    out.push(Math.max(C.kMin, Math.min(C.kMax, Math.ceil(dist2(a, b) / C.pxPerSample))));
  }
  return out;
}, { n: Math.round(FILM.dur * 30), fps: 30 });
await b.close();
const hist = {}; for (const k of Ks) hist[k] = (hist[k] || 0) + 1;
const sorted = [...Ks].sort((x, y) => x - y);
console.log(JSON.stringify({ frames: Ks.length, hist, meanK: +(Ks.reduce((s, x) => s + x, 0) / Ks.length).toFixed(2), medianK: sorted[Ks.length >> 1] }));
fs.writeFileSync(path.join(film, "build", "kprobe.json"), JSON.stringify(Ks));
