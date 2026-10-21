#!/usr/bin/env node
/* Framing probe: where is the mascot on screen, every frame, per format.
   node films/made-with-claude/scripts/framing.cjs [16x9|9x16] [--all]
   Flags frames where the visible mascot leaves the safe frame or overfills it. */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const { execFileSync } = require("child_process");
const FILM = path.resolve(__dirname, "..");
const TL = JSON.parse(fs.readFileSync(path.join(FILM, "src", "timeline.json"), "utf8"));
const pw = (() => { try { return require("playwright"); } catch (e) { return require(path.join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "playwright")); } })();
const fmt = process.argv[2] || "16x9", all = process.argv.includes("--all");
const srv = http.createServer((q, r) => {
  const p = path.join(FILM, new URL(q.url, "http://x").pathname);
  if (!p.startsWith(FILM) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".json") ? "application/json" : p.endsWith(".html") ? "text/html" : "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(p).pipe(r);
}).listen(0, async () => {
  const b = await pw.chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  const page = await (await b.newContext({ viewport: { width: 192, height: 192 } })).newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/src/index.html?format=${fmt}&render=1&scale=0.1`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
  const n = Math.round(TL.duration * TL.fps);
  const rows = await page.evaluate((n) => Array.from({ length: n }, (_, f) => window.film.framing(f)), n);
  const safe = fmt === "9x16" ? { x0: 0.06, x1: 0.94, y0: 0.08, y1: 0.8 } : { x0: 0.04, x1: 0.96, y0: 0.05, y1: 0.95 };
  const issues = [];
  for (const r of rows) {
    if (!r.visible) continue;
    const t = r.frame / TL.fps;
    const shot = TL.shots.find((s) => t >= s.start && t < s.end) || TL.shots[TL.shots.length - 1];
    const out = r.cx < safe.x0 || r.cx > safe.x1 || r.cy < safe.y0 || r.cy > safe.y1;
    const h = r.y1 - r.y0;
    const big = h > 0.85;
    if (out || big || all) issues.push(`${shot.id} ${t.toFixed(2)}s f${r.frame}  c=(${r.cx},${r.cy}) box x[${r.x0},${r.x1}] y[${r.y0},${r.y1}] h=${h.toFixed(2)} d=${r.dist}${out ? "  OUT" : ""}${big ? "  BIG" : ""}`);
  }
  console.log(`${fmt}: ${issues.length} flagged frames`);
  // compress runs
  let last = "";
  for (const line of issues) { const key = line.split(" ")[0] + (line.includes("OUT") ? "O" : "") + (line.includes("BIG") ? "B" : ""); if (all || key !== last) console.log(line); last = key; }
  await b.close(); srv.close();
});
