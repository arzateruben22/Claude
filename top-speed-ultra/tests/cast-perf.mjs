// The seat view's smoothness (owner, 2026-11-11: "no laggy graphics or glitchy when 1st person POV with the arms"):
// a 120 s drive in the cockpit camera with steering (left and right taps, and two full-lock holds at low speed), on
// the phone profile (390x844, DPR 3, isMobile, CPU throttled 4x through the DevTools protocol) or desktop 1280x720.
// Reports the frame times (p50, p95, p99, from requestAnimationFrame), long tasks over 50 ms, draw calls and
// triangles (renderer.info through __game.stats), and the JS heap after a forced GC at the start and the end.
//   node tests/cast-perf.mjs --profile=phone|desktop [--game=<path to top-speed-ultra.html>] [--seconds=120]
//                            [--character=<cast id>] [--quality=low|medium|high|ultra] [--tag=name]
// Run one at a time (SwiftShader shares the machine's cores); the absolute numbers are software rendering's, so
// compare a build with the base under the same conditions, back to back.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const profile = arg('profile', 'desktop'), GAME = arg('game', path.join(ROOT, 'dist', 'top-speed-ultra.html'));
const SECONDS = Number(arg('seconds', 120)), character = arg('character', ''), tag = arg('tag', 'run');
const quality = arg('quality', profile === 'phone' ? 'low' : 'high');
const OUT = path.join(ROOT, 'tests', 'out', 'cast', 'perf');
mkdirSync(OUT, { recursive: true });

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'];
const browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }));
const phone = profile === 'phone';
const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: 1280, height: 720 } });
const settings = { quality, adaptive: false, density: 'moderate', time: 'day', weather: 'clear', handling: 0.35, presentation: 'f', skin: 1, ...(character ? { character, packTest: true } : {}) };   // (packTest: the pack characters' TEST unlock; a base character ignores it)
await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), settings);
const page = await ctx.newPage();
page.setDefaultTimeout(900000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const t0 = Date.now();
await page.goto(pathToFileURL(GAME).href);
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 900000 });
await page.getByRole('radio', { name: /Free Drive/ }).click();
await page.getByRole('button', { name: 'Drive', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 900000, polling: 500 });
await page.evaluate(() => window.__game.setCam('cockpit'));
const bootS = (Date.now() - t0) / 1000;
const cdp = await ctx.newCDPSession(page);
await cdp.send('HeapProfiler.enable');
const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
// warm up a few seconds (shaders compile on the first frames) before the clock starts
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(6000);
const heap0 = await heap();
if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.evaluate(() => {
  const w = window, d = { frames: [], long: [], calls: [], tris: [], run: true, last: 0, wheel: [] };
  w.__perf = d;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (d.run) d.long.push(e.duration); }).observe({ type: 'longtask', buffered: false });
  // renderer.info counts every render call of a frame only with autoReset off (with the post chain on High, the last
  // call alone is a full-screen pass): this callback runs after the game's own each frame, reads the frame's totals
  // and resets them
  const info = w.__game.renderer.info; info.autoReset = false; info.reset();
  const f = (t) => { if (!d.run) return; if (d.last) d.frames.push(t - d.last); d.last = t; d.calls.push(info.render.calls); d.tris.push(info.render.triangles); info.reset(); requestAnimationFrame(f); };
  requestAnimationFrame(f);
});
// the drive: the throttle held; a steering tap left or right every 3 s (0.7 s long) at speed; at 40 s and 80 s, a
// slow stretch (brakes) with the wheel held at full lock, 3 s left then 3 s right
const start = Date.now(), el = () => (Date.now() - start) / 1000;
let k = 0;
while (el() < SECONDS) {
  const t = el();
  if ((t > 40 && t < 52) || (t > 80 && t < 92)) {
    await page.keyboard.up('ArrowUp'); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowDown');
    await page.keyboard.down('ArrowUp');
    for (const key of ['ArrowLeft', 'ArrowRight']) { await page.keyboard.down(key); await page.waitForTimeout(3000); await page.keyboard.up(key); }
    while (el() < (t < 60 ? 52 : 92)) await page.waitForTimeout(500);
    continue;
  }
  const key = k++ % 2 ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(key); await page.waitForTimeout(700); await page.keyboard.up(key);
  await page.waitForTimeout(2300);
}
const d = await page.evaluate(() => { const d = window.__perf; d.run = false; window.__game.renderer.info.autoReset = true; return { frames: d.frames, long: d.long, calls: d.calls, tris: d.tris }; });
await page.keyboard.up('ArrowUp');
if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const heap1 = await heap();
await page.screenshot({ path: path.join(OUT, `${tag}-${profile}-end.png`) });
const arms = await page.evaluate(() => window.__game.driverArms ?? null).catch(() => null);
await browser.close();

const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const r = {
  tag, profile, quality, character: character || '(none)', game: GAME, bootS, seconds: SECONDS, frames: d.frames.length,
  p50: +q(d.frames, 0.5).toFixed(1), p95: +q(d.frames, 0.95).toFixed(1), p99: +q(d.frames, 0.99).toFixed(1), max: +Math.max(...d.frames).toFixed(1),
  long50: d.long.length, longMs: Math.round(d.long.reduce((a, b) => a + b, 0)),
  calls: { mean: Math.round(mean(d.calls)), max: Math.max(...d.calls) }, tris: { mean: Math.round(mean(d.tris)), max: Math.max(...d.tris) },
  heapStartMB: +(heap0 / 1048576).toFixed(1), heapEndMB: +(heap1 / 1048576).toFixed(1), errors: errors.slice(0, 3), arms: arms ? { skin: arms.skin, tone: arms.tone, outfit: arms.outfit } : null,
};
writeFileSync(path.join(OUT, `${tag}-${profile}.json`), JSON.stringify({ ...r, raw: d.frames }, null, 0));
console.log(JSON.stringify(r));
