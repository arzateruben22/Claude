// One in-game frame for judging Ultra's grade and bloom: the hypercar (owner mode) driving at night.
//   node tools/grade-shot.mjs <out.png> [quality=ultra] [time=night] [WxH=640x360]
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [out, quality = 'ultra', time = 'night', size = '640x360'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { quality, adaptive: false, density: 'heavy', time, weather: 'clear', owner: true, car: 'oc-hyper' });
const page = await ctx.newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'top-speed-ultra.html')).href);
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'));
await page.evaluate(() => { window.__game.chooseOwnerCar('oc-hyper'); });
await page.getByRole('button', { name: 'Drive', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'));
await page.evaluate(() => { const g = window.__game; g.setPaused(true); g.fastForward(6, {}, 30); g.setPaused(false); });
const f0 = await page.evaluate(() => window.__game.frames);
await page.waitForFunction((t) => window.__game.frames >= t, f0 + 3);
const r = await page.evaluate(() => { const x = window.__game.report(); return { calls: x.calls, tris: x.tris, fps: x.fps, quality: x.quality, time: x.time, car: window.__game.carId, mph: x.mph }; });
await page.screenshot({ path: path.resolve(out) });
console.log(JSON.stringify({ out, ...r, errors: errors.slice(0, 5) }));
await browser.close();
