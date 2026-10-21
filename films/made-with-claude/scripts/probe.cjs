#!/usr/bin/env node
/* Dump per-frame geometry for QA: node films/made-with-claude/scripts/probe.cjs [16x9|9x16|all] → build/qa/<fmt>-probe.json */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const { execFileSync } = require("child_process");
const FILM = path.resolve(__dirname, "..");
const TL = JSON.parse(fs.readFileSync(path.join(FILM, "src", "timeline.json"), "utf8"));
const pw = (() => { try { return require("playwright"); } catch (e) { return require(path.join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "playwright")); } })();
const fmts = (process.argv[2] || "all") === "all" ? Object.keys(TL.formats) : [process.argv[2]];
const srv = http.createServer((q, r) => {
  const p = path.join(FILM, new URL(q.url, "http://x").pathname);
  if (!p.startsWith(FILM) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".json") ? "application/json" : p.endsWith(".html") ? "text/html" : "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(p).pipe(r);
}).listen(0, async () => {
  const b = await pw.chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  fs.mkdirSync(path.join(FILM, "build", "qa"), { recursive: true });
  for (const fmt of fmts) {
    const { width, height } = TL.formats[fmt];
    const page = await (await b.newContext({ viewport: { width: 200, height: 200 } })).newPage();
    // full-size geometry (scale=1) without rendering anything heavy: probeFrame never draws
    await page.goto(`http://127.0.0.1:${srv.address().port}/src/index.html?format=${fmt}&render=1&scale=1`);
    await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 180000 });
    const n = Math.round(TL.duration * TL.fps);
    const rows = await page.evaluate((n) => Array.from({ length: n }, (_, f) => window.film.probeFrame(f)), n);
    fs.writeFileSync(path.join(FILM, "build", "qa", `${fmt}-probe.json`), JSON.stringify({ width, height, rows }));
    console.log(`${fmt}: probed ${rows.length} frames`);
    await page.context().close();
  }
  await b.close(); srv.close();
});
