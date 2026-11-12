// The seat view at full lock (owner, 2026-11-11: no hand or arm clipping through the rim, spokes or centre while
// steering to full lock both ways): the Rossini GT, Day, the cockpit camera, stopped, the wheel held left, centred and
// right; a frame of each and a close crop of the wheel, plus two frames of the same still view a moment apart (a
// flicker or z-fight shows as a difference in the wheel's area).
//   node tests/cast-lock.mjs [--profile=desktop|phone] [--quality=high] [--character=<cast id>] [--tag=name]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const profile = arg('profile', 'desktop'), quality = arg('quality', 'high'), character = arg('character', 'marcus-bell'), tag = arg('tag', 'lock');
const GAME = arg('game', path.join(ROOT, 'dist', 'top-speed-ultra.html'));
const OUT = path.join(ROOT, 'tests', 'out', 'cast', 'lock');
mkdirSync(OUT, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }));
const phone = profile === 'phone';
const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { quality, adaptive: false, density: 'moderate', time: 'day', weather: 'clear', handling: 0.35, character });
const page = await ctx.newPage();
page.setDefaultTimeout(900000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(GAME).href);
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 900000 });
await page.getByRole('radio', { name: /Free Drive/ }).click();
await page.getByRole('button', { name: 'Drive', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 900000, polling: 500 });
await page.evaluate(() => window.__game.setCam('cockpit'));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 600000 }); };
// stop the car
await page.keyboard.down('ArrowDown'); await frames(30); await page.keyboard.up('ArrowDown');
const rows = [];
for (const [name, key] of [['left', 'ArrowLeft'], ['centre', null], ['right', 'ArrowRight']]) {
  if (key) await page.keyboard.down(key);
  await frames(40);
  const a = await page.evaluate(() => ({ wheel: +window.__game.car.wheelAngle.toFixed(3), v: +window.__game.phys.vx.toFixed(2) }));
  const file = path.join(OUT, `${tag}-${profile}-${name}.png`);
  await page.screenshot({ path: file });
  rows.push({ name, ...a, file });
  if (key) await page.keyboard.up(key);
  await frames(20);
}
// two frames of the same still view (the wheel centred), half a second apart
await frames(20);
const s1 = await page.screenshot(), w1 = await page.evaluate(() => window.__game.frames);
await page.waitForTimeout(500); await frames(5);
const s2 = await page.screenshot(), w2 = await page.evaluate(() => window.__game.frames);
writeFileSync(path.join(OUT, `${tag}-${profile}-still-a.png`), s1); writeFileSync(path.join(OUT, `${tag}-${profile}-still-b.png`), s2);
console.log(JSON.stringify({ tag, profile, quality, character, rows, still: [w1, w2], errors: errors.slice(0, 3) }));
await browser.close();
