// The Chad hero test in the picker on the phone (PROJECT_OC_CAST.md, "Chad hero test"): the built game
// (dist/top-speed-ultra.html) at 390x844, DPR 3, with the pack's TEST unlock and Chad chosen; the Character picker
// opened, his turntable waited for at the close-up level (LOD 0, the builder's phone quality), held three-quarter on and
// front-on. Saves the page and the turntable's own canvas into tests/out/cast/hero/.
//   node tests/chad-hero-picker.mjs [--game=<path>] [--who=chad] [--w=390 --h=844 --dpr=3] [--suffix=]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'cast', 'hero');
mkdirSync(OUT, { recursive: true });
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const GAME = arg('game', path.join(ROOT, 'dist', 'top-speed-ultra.html')), who = arg('who', 'chad'), W = Number(arg('w', '390')), H = Number(arg('h', '844')), dpr = Number(arg('dpr', '3')), suffix = arg('suffix', '');
const phone = W < 700;
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }));
let bad = 0;
try {
  const ctx = await browser.newContext(phone ? { viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: dpr } : { viewport: { width: W, height: H } });
  await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { quality: phone ? 'low' : 'ultra', adaptive: false, density: 'moderate', time: 'day', weather: 'clear', character: who, packTest: true, presentation: 'm', skin: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(600000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 600000 });
  await page.getByRole('button', { name: /^Character/ }).click();
  await page.waitForSelector('.cast-card');
  await page.waitForFunction((id) => window.__castStage?.id === id && window.__castStage.lod === 0, who, { timeout: 600000 });
  const st = await page.evaluate(() => ({ ...window.__castStage }));
  for (const [tag, hold] of [['three', -0.5], ['front', 0]]) {
    await page.evaluate((h) => { window.__castStage.hold = h; }, hold);
    await page.waitForTimeout(3000);
    await page.evaluate(() => document.querySelector('canvas[aria-label$=", turning"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `picker-${who}-${W}x${H}-${tag}${suffix}.png`) });
    const url = await page.evaluate(() => document.querySelector('canvas[aria-label$=", turning"]')?.toDataURL('image/png') ?? null);
    if (url) writeFileSync(path.join(OUT, `picker-${who}-${W}x${H}-${tag}-canvas${suffix}.png`), Buffer.from(url.split(',')[1], 'base64')); else bad++;
  }
  if (errors.length) bad++;
  console.log(JSON.stringify({ who, viewport: `${W}x${H}@${dpr}`, stage: { id: st.id, lod: st.lod, tris: st.tris, ms: st.ms }, errors: errors.slice(0, 3) }));
  await ctx.close();
} finally { await browser.close(); }
console.log(bad ? `FAILED: ${bad} check(s)` : 'all checks passed');
process.exit(bad ? 1 : 0);
