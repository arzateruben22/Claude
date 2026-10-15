// Screenshot every screen of the game's UI, at phone and desktop size, for design work and review.
//   npm run build && node tools/ui-shots.mjs [outDir] [--only=phone|desktop] [--game=path/to/top-speed-ultra.html]
// Writes <outDir>/<size>-<screen>.png (default tests/out/ui/). Screens: menu, settings, bests, profile, driver, garage,
// start, course, loading, driving, goto, paused, results. Prints which screens it captured and any page errors.
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(ROOT, 'tests', 'out', 'ui'));
const opt = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const GAME = path.resolve(opt('game') ?? path.join(ROOT, 'dist', 'top-speed-ultra.html'));
if (!existsSync(GAME)) { console.error(`No build at ${GAME}. Run npm run build first.`); process.exit(2); }
mkdirSync(outDir, { recursive: true });

const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 720 } },
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};
for (const [size, ctxOpt] of Object.entries(SIZES)) {
  if (opt('only') && opt('only') !== size) continue;
  const ctx = await browser.newContext(ctxOpt);
  await ctx.addInitScript(() => localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, density: 'moderate' })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 120000 });
  const shots = [];
  // let the entrance animations finish (in software rendering a frame can take a while, so they start late)
  const settled = () => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
  const shot = async (name) => { await page.waitForTimeout(350); await settled(); await page.screenshot({ path: path.join(outDir, `${size}-${name}.png`) }); shots.push(name); };
  const close = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(200); };
  const tryShot = async (name, fn) => { try { await fn(); await shot(name); } catch (e) { errors.push(`${name}: ${String(e.message || e).split('\n')[0]}`); } };

  await tryShot('menu', async () => {});
  await tryShot('settings', async () => { await page.getByRole('button', { name: 'Settings', exact: true }).click(); });
  await close();
  await tryShot('bests', async () => { await page.getByRole('button', { name: 'Bests', exact: true }).click(); });
  await close();
  await tryShot('profile', async () => { await page.getByRole('button', { name: 'Profile', exact: true }).click(); });
  await close();
  await tryShot('driver', async () => { await page.locator('.pick', { hasText: 'Driver' }).first().click(); });
  await close();
  await tryShot('garage', async () => { await page.locator('.pick', { hasText: 'Car' }).first().click(); });
  await close();
  await tryShot('start', async () => { await page.locator('.pick', { hasText: 'Start on' }).first().click(); });
  await close();
  await tryShot('course', async () => { await page.getByRole('radio', { name: /Races/ }).click(); await page.locator('.pick', { hasText: 'Race' }).first().click(); });
  await close();
  await page.getByRole('radio', { name: /Free Drive/ }).click();
  await tryShot('loading', async () => { await page.getByRole('button', { name: 'Drive', exact: true }).click(); await page.waitForTimeout(150); });
  await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 60000 });
  await tryShot('driving', async () => { await page.evaluate(() => { const g = window.__game; g.setPaused(true); g.fastForward(4, {}, 30); g.setPaused(false); }); await page.waitForTimeout(1500); });
  await tryShot('goto', async () => { await page.getByRole('button', { name: 'Go to' }).click(); });
  await close();
  await tryShot('paused', async () => { await page.evaluate(() => window.__game.setPaused(true)); });
  await tryShot('results', async () => { await page.evaluate(() => window.__game.endFreeDrive()); await page.waitForSelector('.result', { timeout: 10000 }); });
  report[size] = { shots, errors };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ outDir, report }, null, 1));
