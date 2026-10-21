// Screenshot the menu and a driving frame in every car's atmosphere (the theme follows the car, owner 2026-10-21).
//   npm run build && node tools/atmo-shots.mjs [outDir] [--size=1280x720] [--look=ultra|hd] [--cars=id,id] [--drivers=0] [--shot=N] [--settle=seconds]
// Opens the build in owner mode, picks each car through the garage (the real path, so the attribute switch is what
// a player gets), shoots the menu, drives for a moment and shoots the HUD. Prints the cars shot and any page errors.
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(ROOT, 'tests', 'out', 'atmo'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const [w, h] = opt('size', '1280x720').split('x').map(Number);
const GAME = path.join(ROOT, 'dist', 'top-speed-ultra.html');
if (!existsSync(GAME)) { console.error(`No build at ${GAME}. Run npm run build first.`); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const CARS = [['rossini-gt', 'Rossini GT'], ['rossini-brio', 'Rossini Brio'], ['rossini-corsa', 'Rossini Corsa'], ['vela-e', 'Vela E'], ['oc-hyper', 'OC Hypercar']];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h } });
const LOOK = opt('look', 'ultra');
await ctx.addInitScript((look) => localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, density: 'moderate', owner: true, look })), LOOK);
const page = await ctx.newPage();
page.setDefaultTimeout(120000);          // a busy machine renders slowly in software
const errors = [], shots = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(GAME).href);
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 120000 });
const settled = () => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
const ONLY = opt('cars', '') ? opt('cars', '').split(',') : null;
for (const [id, name] of CARS.filter(([i]) => !ONLY || ONLY.includes(i))) {
  try {
    await page.locator('.pick', { hasText: 'Car' }).first().click();
    const card = page.locator('.gcell.car', { hasText: name });
    if (await card.getByRole('button', { name: 'Drive' }).count()) await card.getByRole('button', { name: 'Drive' }).click();
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    await page.waitForFunction((want) => document.documentElement.dataset.car === want, id, { timeout: 5000 });
    // --shot=N pins the menu's cinematic camera on one shot (0 the hero) a few seconds in, for a like-for-like frame
    if (opt('shot', '') !== '') { await page.waitForTimeout(Number(opt('settle', '0')) * 1000); await page.evaluate((n) => { const g = window.__game; g.cineShot = n; g.cineT = 3; }, Number(opt('shot', '0'))); const f0 = await page.evaluate(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + 3); }
    await page.waitForTimeout(300); await settled();
    await page.screenshot({ path: path.join(outDir, `${id}-menu.png`), timeout: 180000 });
    await page.getByRole('button', { name: 'Drive', exact: true }).click();
    await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 60000 });
    await page.evaluate(() => { const g = window.__game; g.setPaused(true); g.fastForward(4, {}, 30); g.setPaused(false); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, `${id}-drive.png`), timeout: 180000 });
    await page.evaluate(() => window.__game.setPaused(true));
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.waitForSelector('.overlay.menu', { timeout: 20000 });
    shots.push(id);
  } catch (e) {
    errors.push(`${id}: ${String(e.message || e).split('\n')[0]}`);
    // back to the menu whatever state the failure left (a panel open, or mid-drive)
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { const g = window.__game; if (g && !g.inAttract) g.quitToMenu(); }).catch(() => {});
    await page.waitForSelector('.overlay.menu', { timeout: 20000 }).catch(() => {});
  }
}
// the driver's layer on top of the car's world: each driver picked through the Driver panel, on the hypercar
for (const [id, name] of opt('drivers', '1') === '0' ? [] : [['closer', 'The Closer'], ['ace', 'The Ace'], ['wrench', 'The Wrench']]) {
  try {
    await page.locator('.pick', { hasText: 'Driver' }).first().click();
    await page.locator('.gcell.driver', { hasText: name }).first().click();
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    await page.waitForFunction((want) => document.documentElement.dataset.driver === want, id, { timeout: 5000 });
    await page.waitForTimeout(300); await settled();
    await page.screenshot({ path: path.join(outDir, `driver-${id}-menu.png`), timeout: 180000 });
    shots.push('driver-' + id);
  } catch (e) { errors.push(`driver ${id}: ${String(e.message || e).split('\n')[0]}`); await page.keyboard.press('Escape').catch(() => {}); }
}
await browser.close();
console.log(JSON.stringify({ outDir, shots, errors }, null, 1));
