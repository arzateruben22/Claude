// The home screen and the Free Drive HUD at night, each beside the owner's 2026-10-21 reference crop (the menu crop
// beside the home screen, the HUD crop beside the drive), for the reference lane's merges and milestones.
//   npm run build && node tools/uiref-sync-shots.mjs --tag=after --menu-ref=<ui-ref-menu.png> --hud-ref=<ui-ref-hud.png>
//        [--sizes=1440x900,390x844] [--no-hud] [--game=dist/top-speed-ultra.html]
// Writes tests/out/uiref/<tag>-home-<w>x<h>.png, <tag>-hud-<w>x<h>.png and, with the reference paths, the same names
// ending -vs-ref.png (the reference crop on the left, ours on the right, one height). One browser, one boot per size,
// one drive per boot: light on a shared machine. The reference images are the owner's and stay out of the repo.
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const opt = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const TAG = opt('tag') ?? 'after';
const GAME = path.resolve(opt('game') ?? path.join(ROOT, 'dist', 'top-speed-ultra.html'));
const MENU_REF = opt('menu-ref') ? path.resolve(opt('menu-ref')) : null;
const HUD_REF = opt('hud-ref') ? path.resolve(opt('hud-ref')) : null;
const HUD = !process.argv.includes('--no-hud');
const SIZES = (opt('sizes') ?? '1440x900,390x844').split(',').map((s) => s.split('x').map(Number));
const OUT = path.join(ROOT, 'tests', 'out', 'uiref');
if (!existsSync(GAME)) { console.error(`No build at ${GAME}. Run npm run build first.`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { tag: TAG, shots: [], errors: [], boot: {}, layout: {}, hud: {} };
// night, as the reference; the start the reference's HUD shows (the 405 North through Santa Ana)
const settings = { quality: 'low', adaptive: false, density: 'moderate', time: 'night', weather: 'clear', start: 'I-405 North' };
const file = (kind, w, h, extra = '') => path.join(OUT, `${TAG}-${kind}-${w}x${h}${extra}.png`);
const rel = (p) => path.relative(ROOT, p);

async function settle(page) {
  await page.mouse.move(1, 1).catch(() => {});
  const f0 = await page.evaluate(() => window.__game.frames);
  await page.waitForFunction((t) => window.__game.frames >= t, f0 + 3, { timeout: 300000, polling: 250 });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 30000, polling: 500 }).catch(() => {});
}

async function composite(ref, shot, label) {
  if (!ref) return;
  const a = 'data:image/png;base64,' + readFileSync(ref).toString('base64');
  const b = 'data:image/png;base64,' + readFileSync(shot).toString('base64');
  const H = 640;
  const dims = (p) => { const x = readFileSync(p); return [x.readUInt32BE(16), x.readUInt32BE(20)]; };
  const [aw, ah] = dims(ref), [bw, bh] = dims(shot);
  const W = Math.ceil(16 * 3 + (aw / ah) * H + (bw / bh) * H), HH = H + 12 * 2 + 26;
  const p2 = await browser.newPage({ viewport: { width: W, height: HH } });
  p2.setDefaultTimeout(240000);
  await p2.setContent(`<body style="margin:0;background:#000;font:500 15px/1.2 system-ui;color:#ddd;overflow:hidden">
    <div style="display:flex;gap:16px;padding:12px 16px;background:#000">
      <figure style="margin:0"><figcaption style="padding:0 0 8px">Reference (owner, 2026-10-21)</figcaption><img src="${a}" style="height:${H}px;display:block"></figure>
      <figure style="margin:0"><figcaption style="padding:0 0 8px">OC Ultra ${TAG}: ${label}</figcaption><img src="${b}" style="height:${H}px;display:block"></figure>
    </div></body>`);
  await p2.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
  const out = shot.replace(/\.png$/, '-vs-ref.png');
  await p2.screenshot({ path: out });
  await p2.close();
  report.shots.push(rel(out));
}

for (const [w, h] of SIZES) {
  const phone = w < 600 || h < 500;
  const ctx = await browser.newContext(phone
    ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: w, height: h } });
  await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), settings);
  const page = await ctx.newPage();
  page.setDefaultTimeout(300000);
  const name = `${w}x${h}`;
  page.on('pageerror', (e) => report.errors.push(`${name}: ${String(e)}`));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${name} console: ${m.text()}`); });
  const t0 = Date.now();
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu') && !document.querySelector('.loading-screen'), null, { timeout: 500000, polling: 500 });
  report.boot[name] = Math.round((Date.now() - t0) / 1000);
  await settle(page);
  const hp = file('home', w, h);
  await page.screenshot({ path: hp });
  report.shots.push(rel(hp));
  report.layout[name] = await page.evaluate(() => ({
    sideScroll: document.documentElement.scrollWidth > innerWidth,
    overlayScroll: [...document.querySelectorAll('.overlay')].some((o) => o.scrollWidth > o.clientWidth + 1),
    drives: [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Drive' || b.getAttribute('aria-label') === 'Drive').length,
    car: document.documentElement.dataset.car ?? null,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || null,
  }));
  await composite(MENU_REF, hp, `home, ${w} x ${h}`);
  if (HUD) {
    // start Free Drive the way the suite does: pick the mode, then Drive
    await page.getByRole('radio', { name: /Free Drive/ }).click();
    await page.getByRole('button', { name: 'Drive', exact: true }).click();
    await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 300000 });
    // up to speed on the 405, a route set (the guide signs and the route on the map), then a few frames
    await page.evaluate(() => { const g = window.__game; g.fastForward(10, {}, 30); g.navigateTo('CA-55 South'); });
    await settle(page);
    await page.evaluate(() => { const g = window.__game; g.fastForward(1, {}, 30); });
    await settle(page);
    const up = file('hud', w, h);
    await page.screenshot({ path: up });
    report.shots.push(rel(up));
    report.hud[name] = await page.evaluate(() => ({ mph: window.__game.debug?.mph ?? null, road: window.__game.stats.path, car: document.documentElement.dataset.car ?? null,
      sideScroll: document.documentElement.scrollWidth > innerWidth }));
    await composite(HUD_REF, up, `Free Drive HUD, ${w} x ${h}`);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(OUT, `${TAG}-sync-report.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
