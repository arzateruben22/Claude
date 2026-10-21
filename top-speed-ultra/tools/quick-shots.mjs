// Screenshot the Settings sections (U8) and the radial quick menu (U3, held open from the Pause button) at desktop and
// phone size.   node tools/quick-shots.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.resolve(process.argv[2] ?? path.join(ROOT, 'tests', 'out', 'quick'));
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};
for (const [size, o] of Object.entries({ desktop: { viewport: { width: 1280, height: 720 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } })) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(() => localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, density: 'light' })));
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  const errors = [], shots = [], facts = {};
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (n) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(dir, `${size}-${n}.png`), timeout: 180000 }); shots.push(n); };
  try {
    await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'top-speed-ultra.html')).href);
    await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'));
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await shot('settings');
    await page.getByRole('button', { name: 'Sound', exact: true }).click();
    await page.waitForTimeout(800);
    await shot('settings-sound');
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Drive', exact: true }).click();
    await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'));
    // hold Pause: press, wait past 300 ms, slide to the right-hand wedge, shoot, then let go there
    const b = await page.getByRole('button', { name: 'Pause', exact: true }).boundingBox();
    if (o.hasTouch) {
      // touch: a long press through the pointer events the button listens to
      await page.getByRole('button', { name: 'Pause', exact: true }).dispatchEvent('pointerdown');
      await page.waitForTimeout(700);
      await shot('radial');
      await page.mouse.move(o.viewport.width / 2 + 120, o.viewport.height / 2 - 60);
      await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    } else {
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.move(640 + 125, 360 - 70, { steps: 4 });
      await shot('radial');
      await page.mouse.up();
    }
    await page.waitForTimeout(500);
    facts.after = await page.evaluate(() => ({ radial: !!document.querySelector('.radial'), paused: window.__game.isPaused, panel: [...document.querySelectorAll('.overlay .panel h2')].map((h) => h.textContent) }));
  } catch (e) { errors.push(String(e.message || e).split('\n')[0]); }
  report[size] = { shots, facts, errors };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ dir, report }, null, 1));
