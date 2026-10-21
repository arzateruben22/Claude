#!/usr/bin/env node
/* Camera key sweep without rendering: try candidate values for one key and score the framing.
   node films/made-with-claude/scripts/camsolve.cjs FMT CANDIDATES.json [copy keys, default title,opus]
   CANDIDATES.json: { "times": [6.0, 7.0, ...], "variants": [ { "keys": { "6.0": {pos, look, fov, fstop}, ... } }, ... ] }
   Prints, per variant and time: mascot box, title/opus boxes, CoC. */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const { execFileSync } = require("child_process");
const FILM = path.resolve(__dirname, "..");
const pw = (() => { try { return require("playwright"); } catch (e) { return require(path.join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "playwright")); } })();
const [fmt, candPath, keyArg] = process.argv.slice(2);
const COPYKEYS = (keyArg || "title,opus").split(",");
const cand = JSON.parse(fs.readFileSync(candPath, "utf8"));
const srv = http.createServer((q, r) => {
  const p = path.join(FILM, new URL(q.url, "http://x").pathname);
  if (!p.startsWith(FILM) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".json") ? "application/json" : p.endsWith(".html") ? "text/html" : "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(p).pipe(r);
}).listen(0, async () => {
  const b = await pw.chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  const page = await (await b.newContext({ viewport: { width: 200, height: 200 } })).newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/src/index.html?format=${fmt}&render=1&scale=1`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 180000 });
  const res = await page.evaluate(({ cand }) => {
    const CK = window.__dbg.CK, orig = CK.map((k) => JSON.parse(JSON.stringify(k)));
    const out = [];
    for (const v of cand.variants) {
      CK.length = 0; orig.forEach((k) => CK.push(JSON.parse(JSON.stringify(k))));     // camAt reads CK by reference
      for (const [t, patch] of Object.entries(v.keys || {})) {
        const k = CK.find((x) => Math.abs(x.t - Number(t)) < 1e-6);
        if (k) Object.assign(k, patch); else { CK.push({ t: Number(t), ...patch }); CK.sort((a, c) => a.t - c.t); }
      }
      out.push({ name: v.name, rows: cand.times.map((t) => window.film.probeFrame(Math.round(t * 30))) });
    }
    return out;
  }, { cand });
  for (const v of res) {
    console.log(`== ${v.name}`);
    for (const r of v.rows) {
      const f = r.framing, c = r.copy;
      const m = f.visible ? `m c(${f.cx.toFixed(2)},${f.cy.toFixed(2)}) x[${f.x0.toFixed(2)},${f.x1.toFixed(2)}] y[${f.y0.toFixed(2)},${f.y1.toFixed(2)}] h${(f.y1 - f.y0).toFixed(2)}` : "m -";
      const cs = COPYKEYS.map((k) => `${k} ${c[k].inFrame ? "IN " : "out"} x${c[k].x0.toFixed(0)}..${c[k].x1.toFixed(0)} y${c[k].y0.toFixed(0)} h${c[k].h.toFixed(0)} coc${c[k].coc.toFixed(1)}`).join(" | ");
      console.log(`  ${(r.frame / 30).toFixed(2)} ${m} | ${cs}`);
    }
  }
  await b.close(); srv.close();
});
