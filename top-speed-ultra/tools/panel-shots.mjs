// Screenshot menu panels at desktop and phone size, at the top and scrolled to the bottom (to see the sticky Done bar
// over scrolled content).   node tools/panel-shots.mjs [Profile,Lifestyle,...] [outDir]
// Waits for the panel's entry animation to finish: in software rendering the first frames can take seconds, and a
// shot taken before then shows the panel at opacity 0.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const names = (process.argv[2] ?? 'Profile,Lifestyle').split(',');
const dir = path.resolve(process.argv[3] ?? path.join(ROOT, 'tests', 'out', 'panels'));
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};
for (const [size, o] of Object.entries({ desktop: { viewport: { width: 1280, height: 720 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } })) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(() => localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, density: 'light' })));
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  const errors = [], facts = {};
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'top-speed-ultra.html')).href);
    await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'));
    for (const n of names) {
      await page.getByRole('button', { name: n, exact: true }).first().click();
      await page.waitForFunction(() => { const p = document.querySelector('.overlay .panel'); return p && p.getAnimations().every((a) => a.playState === 'finished'); });
      await page.screenshot({ path: path.join(dir, `${size}-${n.toLowerCase()}.png`), timeout: 180000 });
      await page.evaluate(() => { const o = document.querySelector('.overlay.center'); if (o) o.scrollTop = o.scrollHeight; });
      await page.waitForTimeout(800);
      facts[n] = await page.evaluate(() => {
        const bar = document.querySelector('.overlay .panel > .row:last-child')?.getBoundingClientRect();
        return { barBottomGap: bar ? Math.round(innerHeight - bar.bottom) : null, pageScroll: document.documentElement.scrollWidth > innerWidth };
      });
      await page.screenshot({ path: path.join(dir, `${size}-${n.toLowerCase()}-end.png`), timeout: 180000 });
      await page.locator('.overlay .panel > .row:last-child button').last().click();
      await page.waitForTimeout(400);
    }
  } catch (e) { errors.push(String(e.message || e).split('\n')[0]); }
  report[size] = { facts, errors };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ dir, report }));
