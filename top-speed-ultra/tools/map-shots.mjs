// Screenshot the World Map: from the menu (the county, a freeway picked, a race picked) and while driving (paused,
// you and your route), at desktop and phone size.   npm run build && node tools/map-shots.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'tests', 'out', 'map'));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};
for (const [size, o] of Object.entries({ desktop: { viewport: { width: 1280, height: 720 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } })) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(() => localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, density: 'light' })));
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  const errors = [], shots = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (n) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(outDir, `${size}-${n}.png`), timeout: 180000 }); shots.push(n); };
  try {
    await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'top-speed-ultra.html')).href);
    await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'));
    await page.getByRole('button', { name: 'World Map', exact: true }).click();
    await page.waitForSelector('.worldmap canvas');
    await shot('menu-county');
    await page.locator('.wm-item', { hasText: 'North' }).filter({ has: page.locator('.shield', { hasText: /^405$/ }) }).click();
    await shot('menu-405');
    await page.getByRole('button', { name: 'Races', exact: true }).click();
    await page.locator('.wm-item', { hasText: 'Santa Ana Checkpoints' }).click();
    await shot('menu-race');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('radio', { name: /Free Drive/ }).click();
    await page.getByRole('button', { name: 'Drive', exact: true }).click();
    await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'));
    await page.evaluate(() => { const g = window.__game; g.navigateTo('CA-55 North'); g.setPaused(true); g.fastForward(8, {}, 30); g.setPaused(true); });
    await page.waitForSelector('.panel.paused');
    await page.getByRole('button', { name: 'World map', exact: true }).click();
    await page.waitForSelector('.worldmap canvas');
    await shot('drive');
  } catch (e) { errors.push(String(e.message || e).split('\n')[0]); }
  report[size] = { shots, errors };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ outDir, report }, null, 1));
