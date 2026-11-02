// Several shots of the on-foot page from one boot (it takes minutes to build under SwiftShader).
//   node tests/onfoot-shots.mjs <plan.json>
// plan.json: { "size": "1280x720", "query": "quality=high&day=Sat&hour=21", "touch": false,
//              "shots": [ { "name": "tests/out/onfoot/x.png", "eval": "js run first (may return a value)", "frames": 2 } ] }
// Prints each shot's eval result and stats() as JSON lines, and any console errors.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [w, h] = (plan.size ?? '1280x720').split('x').map(Number);
const T = (plan.timeout ?? 1200) * 1000;
const t0 = Date.now();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(plan.touch ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: w, height: h } });
const page = await ctx.newPage();
page.setDefaultTimeout(T);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'onfoot', 'index.html')).href + (plan.query ? '?' + plan.query : ''));
await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
const err = await page.evaluate(() => window.__onfootError ?? null);
console.log(JSON.stringify({ booted: Math.round((Date.now() - t0) / 1000), error: err, buildMs: await page.evaluate(() => window.__onfoot?.buildMs) }));
for (const s of err ? [] : plan.shots) {
  const ts = Date.now();
  const r = s.eval ? await page.evaluate(s.eval) : null;
  const f0 = await page.evaluate(() => window.__onfoot.frames);
  await page.waitForFunction((n) => window.__onfoot.frames >= n, f0 + (s.frames ?? 2), { timeout: T, polling: 200 });
  const stats = await page.evaluate(() => window.__onfoot.stats());
  if (s.name) { mkdirSync(path.dirname(path.resolve(ROOT, s.name)), { recursive: true }); await page.screenshot({ path: path.resolve(ROOT, s.name), timeout: 300000 }); }
  console.log(JSON.stringify({ shot: s.name ?? null, seconds: Math.round((Date.now() - ts) / 1000), result: r, calls: stats.calls, triangles: stats.triangles, frameMs: stats.frameMs, simMs: stats.simMs, view: stats.view }));
}
await browser.close();
console.log(JSON.stringify({ done: Math.round((Date.now() - t0) / 1000), logs: logs.slice(0, 40) }));
