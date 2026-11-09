// Screenshot the garage's tabs (U5: Vehicles, Paint, Wheels, Upgrades, Customize) at desktop and phone size, and
// report horizontal overflow.   node tools/garage-shot.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.resolve(process.argv[2] ?? path.join(ROOT, 'tests', 'out', 'garage'));
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
    await page.locator('.pick', { hasText: 'Car' }).first().click();
    for (const t of ['Vehicles', 'Paint', 'Wheels', 'Customize']) {
      await page.locator('.panel').getByRole('button', { name: t, exact: true }).click();
      await page.waitForTimeout(500);
      facts[t] = await page.evaluate(() => {
        const seg = document.querySelector('.panel .seg') ?? document.querySelector('.panel [role="group"]');
        return { pageScroll: document.documentElement.scrollWidth > innerWidth, segOverflow: seg ? seg.scrollWidth > seg.clientWidth + 1 : null };
      });
      await page.screenshot({ path: path.join(dir, `${size}-${t.toLowerCase()}.png`), timeout: 180000 });
    }
  } catch (e) { errors.push(String(e.message || e).split('\n')[0]); }
  report[size] = { facts, errors };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ dir, report }, null, 1));
