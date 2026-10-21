#!/usr/bin/env node
/* Frame signatures: a hash of everything a frame's pixels depend on (sub-frame count, UI state,
   every visible object's transform and material per sub-frame, focus). Compare two dumps to get
   the exact frames an edit touched, then re-render only those with render.cjs --frames.

   node films/made-with-claude/scripts/signatures.cjs [--root FILM_DIR] [16x9|9x16|all] > sigs.json
   node films/made-with-claude/scripts/signatures.cjs --diff old.json new.json   → dirty frame lists */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const { execFileSync } = require("child_process");
const argv = process.argv.slice(2);
if (argv[0] === "--diff") {
  const A = JSON.parse(fs.readFileSync(argv[1], "utf8")), B = JSON.parse(fs.readFileSync(argv[2], "utf8"));
  const out = {};
  for (const fmt of Object.keys(B)) out[fmt] = B[fmt].map((s, f) => (A[fmt] && A[fmt][f] === s ? -1 : f)).filter((f) => f >= 0);
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}
let FILM = path.resolve(__dirname, "..");
const ri = argv.indexOf("--root");
if (ri >= 0) { FILM = path.resolve(argv[ri + 1]); argv.splice(ri, 2); }
const TL = JSON.parse(fs.readFileSync(path.join(FILM, "src", "timeline.json"), "utf8"));
const pw = (() => { try { return require("playwright"); } catch (e) { return require(path.join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "playwright")); } })();
const fmts = (argv[0] || "all") === "all" ? Object.keys(TL.formats) : [argv[0]];
const srv = http.createServer((q, r) => {
  const p = path.join(FILM, new URL(q.url, "http://x").pathname);
  if (!p.startsWith(FILM) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".json") ? "application/json" : p.endsWith(".html") ? "text/html" : "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(p).pipe(r);
}).listen(0, async () => {
  const b = await pw.chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  const out = {};
  for (const fmt of fmts) {
    const page = await (await b.newContext({ viewport: { width: 200, height: 200 } })).newPage();
    // signatures never draw, but geometry must be full size (scale=1) and the quality must match the render
    await page.goto(`http://127.0.0.1:${srv.address().port}/src/index.html?format=${fmt}&render=1&q=final&scale=1`);
    await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 180000 });
    const n = Math.round(TL.duration * TL.fps);
    out[fmt] = await page.evaluate((n) => Array.from({ length: n }, (_, f) => window.film.signature(f)), n);
    process.stderr.write(`${fmt}: ${n} signatures\n`);
    await page.context().close();
  }
  await b.close(); srv.close();
  process.stdout.write(JSON.stringify(out) + "\n");
});
