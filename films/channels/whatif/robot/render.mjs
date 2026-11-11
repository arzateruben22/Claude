// node render.mjs jobs.json  (jobs: [{ out, w, h, pose, expr, yaw, dist, az, el, look, light, over }]) -> transparent PNGs of the robot (scene lit by robot/page.html)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const { chromium } = require(process.env.PLAYWRIGHT_PKG || "playwright");
const root = path.resolve(import.meta.dirname, "../../../.."); const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".js") || f.endsWith(".mjs") ? "text/javascript" : f.endsWith(".html") ? "text/html" : "application/octet-stream" }); r.end(b); } }); });
await new Promise((ok) => srv.listen(0, ok)); const port = srv.address().port;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
page.on("pageerror", (e) => console.error("PAGE ERROR", e.message)); page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
await page.goto(`http://localhost:${port}/films/channels/whatif/robot/page.html`); await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
for (const j of jobs) {
  await page.setViewportSize({ width: j.w, height: j.h });
  await page.evaluate((o) => window.draw(o), j);
  fs.mkdirSync(path.dirname(j.out), { recursive: true });
  await page.locator("#c").screenshot({ path: j.out, omitBackground: true });
}
await browser.close(); srv.close(); console.log("rendered", jobs.length);
