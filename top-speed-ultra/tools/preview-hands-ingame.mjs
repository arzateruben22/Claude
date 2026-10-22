// The driver's hands as the game shows them: a screenshot of the cockpit from the built game (dist/, so run
// `npm run build` first), the way the suite opens it: headless Chromium on SwiftShader, the settings saved before
// load, Free Drive started on the I-405 North with no traffic, the simulation paused, the overlays hidden. The default
// size is an iPhone's (393x852 CSS px at 3x = 1179x2556, the size of the owner's phone screenshots), portrait, so the
// game frames the cockpit as it does on a phone (fov 96, pitched down 0.27 rad).
//   node tools/preview-hands-ingame.mjs <out.png> [quality=high] [cssW=393] [cssH=852] [scale=3] [phone|desktop] [settings JSON]
// quality is the game's preset (low | medium | high | ultra): low and medium give the hands' phone tier, high and
// ultra their high tier. The settings JSON is merged over the defaults (e.g. '{"driver":"ace","presentation":"f"}').
// Prints the car, driver and presentation it drove, and the seconds it took (two to four minutes in software).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [out, quality = 'high', w = '393', h = '852', dsf = '3', kind = 'phone', extra] = process.argv.slice(2);
if (!out) { console.error('usage: node tools/preview-hands-ingame.mjs <out.png> [quality] [cssW] [cssH] [scale] [phone|desktop] [settings JSON]'); process.exit(2); }
const GAME = path.join(ROOT, 'dist', 'top-speed-ultra.html');
const t0 = Date.now();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const phone = kind === 'phone';
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(dsf), isMobile: phone, hasTouch: phone });
const settings = { quality, adaptive: false, density: 'none', time: 'day', weather: 'clear', start: 'I-405 North', ...(extra ? JSON.parse(extra) : {}) };
await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), settings);
const page = await ctx.newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(GAME).href);
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 240000 });
await page.getByRole('radio', { name: /Free Drive/ }).click();
await page.getByRole('button', { name: 'Drive', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 240000 });
const info = await page.evaluate(() => {
  const g = window.__game; g.fastForward(2, {}, 20); g.setPaused(true);
  return { car: g.carId, driver: g.settings.driver, presentation: g.settings.presentation, quality: g.settings.quality, pixelRatio: g.renderer?.getPixelRatio?.() };
});
// a few frames for the paused scene to settle, the overlays hidden, then the shot
const f0 = await page.evaluate(() => window.__game.frames);
await page.waitForFunction((t) => window.__game.frames >= t, f0 + 3, { timeout: 300000 });
const css = await page.addStyleTag({ content: '.overlay, .touch, .hud-touch { visibility: hidden !important; }' });
await page.waitForFunction((t) => window.__game.frames >= t, f0 + 5, { timeout: 300000 });
await page.screenshot({ path: out, timeout: 600000 });
await css.evaluate((e) => e.remove());
console.log(JSON.stringify({ out, ...info, size: [Number(w) * Number(dsf), Number(h) * Number(dsf)], pageErrors: errors.length, firstErrors: errors.slice(0, 2), seconds: Math.round((Date.now() - t0) / 1000) }));
await ctx.close();
await browser.close();
