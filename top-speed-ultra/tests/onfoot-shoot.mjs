// Shoot the on-foot page (dist/onfoot/index.html, built with `npx vite build --config src/onfoot/vite.config.ts`).
//   node tests/onfoot-shoot.mjs <out.png> [--size=1280x720] [--query="quality=high&day=Sat&hour=21"] [--eval="js run after ready"]
//        [--frames=3] [--timeout=900] [--touch]
// Prints the page's stats() and any console errors as JSON. One browser per run: run them one at a time here.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = path.join(ROOT, 'dist', 'onfoot', 'index.html');
const [out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const [w, h] = opt('size', '1280x720').split('x').map(Number);
const timeout = Number(opt('timeout', '900')) * 1000;
const touch = process.argv.includes('--touch');
const t0 = Date.now();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(touch ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: w, height: h } });
const page = await ctx.newPage();
page.setDefaultTimeout(timeout);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
await page.goto(pathToFileURL(PAGE).href + (opt('query', '') ? '?' + opt('query', '') : ''));
await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout, polling: 500 });
const err = await page.evaluate(() => window.__onfootError ?? null);
let evalOut = null;
if (!err && opt('eval', '')) evalOut = await page.evaluate(opt('eval', ''));
const f0 = await page.evaluate(() => window.__onfoot?.frames ?? 0);
const nf = Number(opt('frames', '3'));
if (!err) await page.waitForFunction((n) => window.__onfoot.frames >= n, f0 + nf, { timeout, polling: 250 });
const stats = err ? null : await page.evaluate(() => window.__onfoot.stats());
if (out) { mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); await page.screenshot({ path: path.resolve(out), timeout: 300000 }); }
await browser.close();
console.log(JSON.stringify({ ok: !err && !logs.some((l) => l.startsWith('pageerror') || l.startsWith('error')), out, seconds: Math.round((Date.now() - t0) / 1000), error: err, evalOut, stats, logs: logs.slice(0, 30) }, null, 1));
