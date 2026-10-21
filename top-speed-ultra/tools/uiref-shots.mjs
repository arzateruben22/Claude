// The home screen at the four sizes the 2026-10-21 reference pass checks, each beside the owner's reference crop, plus
// (with --checks) the measured text contrast of the rail labels and the tiles and a keyboard-focus frame.
//   npm run build && node tools/uiref-shots.mjs --tag=after [--ref=path/to/ui-ref-menu.png] [--game=dist/x.html]
//                                               [--only=desktop|phone] [--checks]
// Writes tests/out/uiref/<tag>-<w>x<h>.png, and with --ref <tag>-<w>x<h>-vs-ref.png (the reference crop on the left,
// ours on the right, the same height). One browser and two boots (a desktop context resized 1440x900 to 1280x720, a
// touch context turned from 390x844 to 844x390), so it stays light on a shared machine. The reference image is the
// owner's concept and stays out of the repo; pass its path. Composites are drawn in the browser: no new dependency.
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const opt = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const TAG = opt('tag') ?? 'after';
const GAME = path.resolve(opt('game') ?? path.join(ROOT, 'dist', 'top-speed-ultra.html'));
const REF = opt('ref') ? path.resolve(opt('ref')) : null;
const CHECKS = process.argv.includes('--checks');
const OUT = path.join(ROOT, 'tests', 'out', 'uiref');
if (!existsSync(GAME)) { console.error(`No build at ${GAME}. Run npm run build first.`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { tag: TAG, shots: [], contrast: [], focus: [], errors: [], boot: {} };
const settings = { quality: 'low', adaptive: false, density: 'moderate', time: 'day', weather: 'clear' };

async function boot(ctxOpt, name) {
  const ctx = await browser.newContext(ctxOpt);
  await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), settings);
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(`${name}: ${String(e)}`));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${name} console: ${m.text()}`); });
  const t0 = Date.now();
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu') && !document.querySelector('.loading-screen'), null, { timeout: 400000, polling: 500 });
  report.boot[name] = Math.round((Date.now() - t0) / 1000);
  return { ctx, page };
}
// a frame or two after a resize, the entrance animations done, the pointer parked
async function settle(page) {
  await page.mouse.move(1, 1).catch(() => {});
  const f0 = await page.evaluate(() => window.__game.frames);
  await page.waitForFunction((t) => window.__game.frames >= t, f0 + 3, { timeout: 240000, polling: 250 });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 30000, polling: 500 }).catch(() => {});
}
const file = (w, h, extra = '') => path.join(OUT, `${TAG}-${w}x${h}${extra}.png`);

// the reference crop and our shot side by side at one height, with a caption over each
async function composite(page, shotPath, w, h) {
  if (!REF) return;
  const a = 'data:image/png;base64,' + readFileSync(REF).toString('base64');
  const b = 'data:image/png;base64,' + readFileSync(shotPath).toString('base64');
  const H = 640;
  // PNG sizes from their IHDR, so the page is exactly as big as the row (an element shot wider than the viewport stalls)
  const dims = (p) => { const x = readFileSync(p); return [x.readUInt32BE(16), x.readUInt32BE(20)]; };
  const [aw, ah] = dims(REF), [bw, bh] = dims(shotPath);
  const W = Math.ceil(16 * 3 + (aw / ah) * H + (bw / bh) * H), HH = H + 12 * 2 + 26;
  const p2 = await browser.newPage({ viewport: { width: W, height: HH } });
  p2.setDefaultTimeout(240000);
  await p2.setContent(`<body style="margin:0;background:#000;font:500 15px/1.2 system-ui;color:#ddd;overflow:hidden">
    <div style="display:flex;gap:16px;padding:12px 16px;background:#000">
      <figure style="margin:0"><figcaption style="padding:0 0 8px">Reference (owner, 2026-10-21)</figcaption><img src="${a}" style="height:${H}px;display:block"></figure>
      <figure style="margin:0"><figcaption style="padding:0 0 8px">OC Ultra ${TAG}, ${w} x ${h}</figcaption><img src="${b}" style="height:${H}px;display:block"></figure>
    </div></body>`);
  await p2.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
  const out = file(w, h, '-vs-ref');
  await p2.screenshot({ path: out });
  await p2.close();
  report.shots.push(path.relative(ROOT, out));
}

async function home(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await settle(page);
  const p = file(w, h);
  await page.screenshot({ path: p });
  report.shots.push(path.relative(ROOT, p));
  report[`${w}x${h}`] = await page.evaluate(() => ({ sideScroll: document.documentElement.scrollWidth > innerWidth, overlayScroll: [...document.querySelectorAll('.overlay')].some((o) => o.scrollWidth > o.clientWidth + 1) }));
  await composite(page, p, w, h);
}

// Text contrast against what is really behind each label: the screen is shot once as it is and once with that text
// made transparent, and the label's colour is compared with the background pixels in its box (WCAG 2.x relative
// luminance). The worst case is reported: the background pixel nearest the text's own luminance, after dropping the
// nearest 2 % (antialiasing at the box's edges and the odd specular sparkle).
async function contrast(page, label) {
  const sel = { 'rail label': '.rail-nav .rail-item span', 'rail foot': '.rail-foot', 'tile title': '.tile b', 'tile subtitle': '.tile small', 'chip name': '.pchip-name', 'chip level': '.pchip-level', 'chip credits': '.pchip-credits' };
  const boxes = await page.evaluate((sel) => {
    const out = [];
    for (const [k, q] of Object.entries(sel)) for (const e of document.querySelectorAll(q)) {
      const b = e.getBoundingClientRect(); if (!b.width || !b.height || getComputedStyle(e).visibility === 'hidden') continue;
      out.push({ k, text: e.textContent.trim().slice(0, 32), x: b.left, y: b.top, w: b.width, h: b.height, color: getComputedStyle(e).color });
    }
    return out;
  }, sel);
  const shot = async () => 'data:image/png;base64,' + (await page.screenshot()).toString('base64');
  const lit = await shot();
  await page.addStyleTag({ content: '.measure-off, .measure-off * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' });
  await page.evaluate((sel) => { for (const q of Object.values(sel)) for (const e of document.querySelectorAll(q)) e.classList.add('measure-off'); }, sel);
  await page.waitForTimeout(150);
  const bare = await shot();
  await page.evaluate(() => { for (const e of document.querySelectorAll('.measure-off')) e.classList.remove('measure-off'); });
  const r = await page.evaluate(async ({ bare, boxes }) => {
    const img = new Image(); img.src = bare; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const k = img.naturalWidth / innerWidth;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return boxes.map((bx) => {
      const [tr, tg, tb] = bx.color.match(/[\d.]+/g).map(Number);
      const lt = L(tr, tg, tb);
      const d = g.getImageData(Math.round(bx.x * k), Math.round(bx.y * k), Math.max(1, Math.round(bx.w * k)), Math.max(1, Math.round(bx.h * k))).data;
      const ls = [];
      for (let i = 0; i < d.length; i += 4) ls.push(L(d[i], d[i + 1], d[i + 2]));
      ls.sort((a, b) => Math.abs(a - lt) - Math.abs(b - lt));
      const worst = ls[Math.min(ls.length - 1, Math.floor(ls.length * 0.02))];
      const mean = ls.reduce((a, b) => a + b, 0) / ls.length;
      return { k: bx.k, text: bx.text, color: bx.color, worst: Math.round(ratio(lt, worst) * 100) / 100, typical: Math.round(ratio(lt, mean) * 100) / 100 };
    });
  }, { bare, boxes });
  void lit;
  for (const x of r) report.contrast.push({ at: label, ...x });
}

// keyboard focus: Tab from the top of the page until a rail item (then a tile) holds focus, and shoot that region
async function focusShots(page, w, h) {
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  for (const [q, name] of [['.rail-item', 'rail'], ['.tile', 'tile']]) {
    let hit = null;
    for (let i = 0; i < 40 && !hit; i++) {
      await page.keyboard.press('Tab');
      hit = await page.evaluate((q) => { const a = document.activeElement; if (!a?.matches(q)) return null;
        const s = getComputedStyle(a), b = a.getBoundingClientRect();
        return { text: a.textContent.trim().slice(0, 24), outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow.slice(0, 80), x: b.left, y: b.top, w: b.width, h: b.height, visible: a.matches(':focus-visible') }; }, q);
    }
    if (!hit) { report.focus.push({ at: `${w}x${h}`, q, found: false }); continue; }
    await page.waitForTimeout(300);
    const p = file(w, h, `-focus-${name}`);
    const pad = 24;
    await page.screenshot({ path: p, clip: { x: Math.max(0, hit.x - pad), y: Math.max(0, hit.y - pad), width: Math.min(w, hit.w + pad * 2), height: Math.min(h, hit.h + pad * 2) } });
    report.focus.push({ at: `${w}x${h}`, q, ...hit, shot: path.relative(ROOT, p) });
  }
}

const only = opt('only');
if (!only || only === 'desktop') {
  const { ctx, page } = await boot({ viewport: { width: 1440, height: 900 } }, 'desktop');
  await home(page, 1440, 900);
  if (CHECKS) { await contrast(page, '1440x900'); await focusShots(page, 1440, 900); }
  await home(page, 1280, 720);
  if (CHECKS) await contrast(page, '1280x720');
  await ctx.close();
}
if (!only || only === 'phone') {
  const { ctx, page } = await boot({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'phone');
  await home(page, 390, 844);
  if (CHECKS) await contrast(page, '390x844');
  await home(page, 844, 390);
  if (CHECKS) await contrast(page, '844x390');
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(OUT, `${TAG}-report.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
