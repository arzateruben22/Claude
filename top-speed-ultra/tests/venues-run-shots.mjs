// Frames for running on foot (PROJECT_OC_ON_FOOT.md, "Running"), from the standalone venue builds:
//   npx vite build --config src/onfoot/vite.config.ts && npx vite build --config src/onfoot/vite.sportsbar.config.ts
//   node tests/venues-run-shots.mjs [--only=phone,laptop,strip]
// Writes to tests/out/run/: the phone (390x844, DPR 3, touch) with the stick walking and in its run state, the laptop
// (1280x720) with the one-time hint, in both venues, and a 6-frame strip of the walk-to-run transition in third person
// at Lot 57 (strip-*.png and strip.png). One browser; prints what each frame saw as JSON.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'run');
mkdirSync(OUT, { recursive: true });
const PAGES = { lot57: path.join(ROOT, 'dist', 'onfoot', 'index.html'), bar: path.join(ROOT, 'dist', 'sportsbar', 'sportsbar.html') };
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const want = (k) => !only.length || only.includes(k);
const T = 900000;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};

async function open(venue, { phone = false, query = '' } = {}) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(T);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(PAGES[venue]).href + '?quality=low&hint=0&day=Sat&hour=12' + query);
  await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
  const err = await page.evaluate(() => window.__onfootError ?? null);
  if (err) throw new Error(`${venue}: ${err}`);
  const frames = async (n) => { const f0 = await page.evaluate(() => window.__onfoot.frames); await page.waitForFunction((t) => window.__onfoot.frames >= t, f0 + n, { timeout: T }); };
  return { ctx, page, errors, frames };
}
// touch pointer events on the venue's canvas (the stick lives in the left 45 %)
const touchJs = `window.__P = (t, id, X, Y) => (t === 'pointerdown' ? document.querySelector('canvas') : window).dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', clientX: X, clientY: Y, bubbles: true, cancelable: true, isPrimary: true }));`;

for (const venue of ['lot57', 'bar']) {
  if (want('phone')) {
    const { ctx, page, errors, frames } = await open(venue, { phone: true, query: '&runhint=0' });
    await page.evaluate(touchJs);
    await page.evaluate(() => { const o = window.__onfoot; o.freeze(true); o.runLane(false, 30); });
    // the stick walking: a thumb down and pushed about half way
    await page.evaluate(() => { window.__P('pointerdown', 5, 96, 600); window.__P('pointermove', 5, 96, 574); window.__onfoot.runWalk(0.6); window.__onfoot.freeze(false); });
    await frames(2);
    const walk = await page.evaluate(() => window.__onfoot.run());
    await page.screenshot({ path: path.join(OUT, `phone-${venue}-stick-walk.png`) });
    await page.evaluate(() => { window.__onfoot.freeze(true); window.__P('pointerup', 5, 96, 574); window.__onfoot.runWalk(0.5); window.__onfoot.runLane(false, 30); });
    await page.waitForTimeout(450);
    // the run state: a tap and a hold where the stick floats, steered a little
    await page.evaluate(async () => { window.__P('pointerdown', 6, 96, 600); window.__P('pointerup', 6, 96, 600); await new Promise((r) => setTimeout(r, 100)); window.__P('pointerdown', 7, 96, 600); window.__P('pointermove', 7, 102, 580); window.__onfoot.runWalk(1.0); window.__onfoot.freeze(false); });
    await frames(2);
    const run = await page.evaluate(() => window.__onfoot.run());
    await page.screenshot({ path: path.join(OUT, `phone-${venue}-stick-run.png`) });
    await page.evaluate(() => { window.__onfoot.freeze(true); window.__P('pointerup', 7, 102, 580); });
    report[`phone-${venue}`] = { walk: { speed: walk.speed, cue: walk.cue, cls: walk.stickClass, fov: walk.fov }, run: { speed: run.speed, by: run.by, cue: run.cue, cls: run.stickClass, fov: run.fov }, errors };
    await ctx.close();
  }
  if (want('laptop')) {
    const { ctx, page, errors, frames } = await open(venue, { query: '&runhint=1' });
    await frames(2);
    const r = await page.evaluate(() => { const o = window.__onfoot; o.freeze(true); return o.run(); });
    await page.screenshot({ path: path.join(OUT, `laptop-${venue}-hint.png`) });
    const box = await page.evaluate(() => { const b = document.getElementById('runHint').getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; });
    report[`laptop-${venue}`] = { hint: r.hint, box, errors };
    await ctx.close();
  }
}

if (want('strip')) {
  const { ctx, page, errors } = await open('lot57', { query: '&runhint=0' });
  await page.evaluate(() => { const o = window.__onfoot; o.freeze(true); o.runLane(false, 30); o.view('third'); });
  await page.focus('canvas').catch(() => {});
  await page.keyboard.down('w');
  await page.evaluate(() => window.__onfoot.runGait(1.0));          // walking, steady
  const steps = [0, 0.1, 0.1, 0.1, 0.15, 0.25], rows = [];
  let t = 0;
  for (let i = 0; i < steps.length; i++) {
    if (i === 1) { await page.keyboard.up('w'); await page.keyboard.down('w'); }   // the second press, held: the run
    if (steps[i]) await page.evaluate((s) => window.__onfoot.runGait(s), steps[i]);
    t += steps[i];
    const d = await page.evaluate(() => window.__onfoot.drawNow());
    const file = path.join(OUT, `strip-${i + 1}.png`);
    await page.screenshot({ path: file });
    rows.push({ file: path.basename(file), t: +t.toFixed(2), ...d });
  }
  await page.keyboard.up('w');
  report.strip = { rows, errors };
  // the strip: six frames side by side, each labelled with its time and speed
  try {
    const labelled = rows.map((r, i) => { const f = path.join(OUT, `strip-${i + 1}-l.png`); execFileSync('convert', [path.join(OUT, r.file), '-resize', '640x360', '-gravity', 'south', '-background', '#0c2328', '-fill', '#f3e6c4', '-pointsize', '22', '-splice', '0x34', '-annotate', '+0+6', `${i === 0 ? 'walking' : `+${r.t.toFixed(2)} s after the double-tap`} · ${r.speed.toFixed(2)} m/s`, f]); return f; });
    execFileSync('montage', [...labelled, '-tile', '3x2', '-geometry', '+4+4', '-background', '#0c2328', path.join(OUT, 'strip.png')]);
  } catch (e) { report.stripMontage = String(e.message).slice(0, 300); }
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
