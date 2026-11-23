// Vega & Vinnie's proof frames (the 2026-11-16 brief: the outside from the owner's 13 photos, the patio at night, the
// walk out to your car). Drives dist/sportsbar/sportsbar.html (build it with
// `npx vite build --config src/onfoot/vite.sportsbar.config.ts`) in headless Chromium with SwiftShader through the
// window.__onfoot hooks. Frames go in tests/out/vv/; tests/vv-sheets.py puts each beside its reference photo.
//
//   node tests/vv-shoot.mjs --q=hd --size=1280x720            the views at 1280 x 720
//   node tests/vv-shoot.mjs --q=low --size=390x844 --dpr=3    the phone (a 390 x 844 viewport at DPR 3)
//   node tests/vv-shoot.mjs --only=front,patio1               some views
//   node tests/vv-shoot.mjs --walk                            the 10-frame strip host stand -> door -> walk -> car door
//
// One browser at a time (this machine is shared). Frames take seconds each.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = path.join(ROOT, 'dist', 'sportsbar', 'sportsbar.html');
const OUT = path.join(ROOT, 'tests', 'out', 'vv');
const EXE = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const Q = arg('q', 'hd'), [W, H] = arg('size', '1280x720').split('x').map(Number), DPR = Number(arg('dpr', '1'));
const only = arg('only', '').split(',').filter(Boolean), WALK = process.argv.includes('--walk');
const tag = `${Q}-${W}x${H}${DPR > 1 ? `-dpr${DPR}` : ''}`;
mkdirSync(OUT, { recursive: true });

// the views: [name, the reference it answers, hour(s), the camera [x, y, z, tx, ty, tz] in game metres or a function
// of g(u, v) (the building frame) returning one]
const VIEWS = [
  ['front', 'front-entrance', [15, 21], [-6604.0, 1.7, -9342.2, -6616.2, 3.1, -9343.2]],
  ['pylon', 'front-pylon-sign', [15], [-6597.0, 1.6, -9377.5, -6603.6, 4.2, -9363.0]],
  ['pylon-street', 'front-pylon-street', [15], [-6611.5, 1.6, -9372.4, -6597.0, 3.2, -9366.0]],
  ['substation', 'front-pylon-substation', [15], [-6609.5, 1.6, -9378.0, -6588.0, 4.0, -9352.0]],
  ['exit', 'front-exit-street', [15], [-6613.0, 1.6, -9395.2, -6586.0, 2.4, -9399.0]],
  ['street', 'front-street-bend', [15], [-6599.0, 1.6, -9376.0, -6597.0, 2.6, -9334.0]],
  ['walkway', 'lot-centre-walkway', [15], [-6603.4, 1.7, -9384.8, -6640.0, 1.8, -9384.8]],
  ['street-edge', 'lot-street-edge', [15], [-6597.5, 1.6, -9366.0, -6604.0, 2.6, -9359.5]],
  ['strip-mall', 'lot-strip-mall', [15], [-6598.5, 1.7, -9372.5, -6618.0, 3.0, -9346.0]],
  ['strip-corner', 'lot-strip-corner', [15], [-6607.0, 1.7, -9398.0, -6650.0, 3.6, -9376.0]],
  ['patio1', 'patio-night-1', [21], (g) => [...g(3.4, -0.6), 2.4, ...g(16.0, -5.0), 0.6]],
  ['patio2', 'patio-night-2', [21], (g) => [...g(26.4, -0.5), 1.6, ...g(14.0, -4.6), 1.0]],
  ['patio3', 'patio-night-3', [21], (g) => [...g(2.6, -2.8), 1.6, ...g(16.0, -3.6), 1.2]],
];
const xyz = (c) => [c[0], c[2], c[1], c[3], c[5], c[4]];   // g(u, v) returns [x, z]; the camera wants x, y, z

const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(DPR > 1 ? { viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true } : { viewport: { width: W, height: H } });
const page = await ctx.newPage();
page.setDefaultTimeout(2400000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const t0 = Date.now();
await page.goto(pathToFileURL(PAGE).href + `?quality=${Q === 'hd' ? 'high' : Q}&ultra=1&day=Sat&hour=15&hint=0`);
await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: 2400000, polling: 500 });
const err = await page.evaluate(() => window.__onfootError ?? null);
if (err) { console.log('boot error', err); process.exit(1); }
console.log(`boot ${((Date.now() - t0) / 1000).toFixed(0)} s, quality ${await page.evaluate((q) => window.__onfoot.setQuality(q), Q)}`);
const frames = async (n = 2) => { const f0 = await page.evaluate(() => window.__onfoot.frames); await page.waitForFunction((k) => window.__onfoot.frames >= k, f0 + n, { timeout: 2400000, polling: 200 }); };
const log = { tag, quality: Q, size: [W, H], dpr: DPR, shots: [], errors };

if (!WALK) {
  await page.evaluate(() => { document.getElementById('hud')?.setAttribute('hidden', ''); });
  for (const [name, ref, hours, cam] of VIEWS) {
    if (only.length && !only.includes(name)) continue;
    for (const hour of hours) {
      const c = await page.evaluate(([cam0, hr]) => {
        const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]];
        o.setClock('Sat', hr);
        // eslint-disable-next-line no-new-func
        const c1 = typeof cam0 === 'string' ? new Function('g', `return (${cam0})(g)`)(g) : cam0;
        return c1;
      }, [typeof cam === 'function' ? cam.toString() : cam, hour]);
      const camArr = typeof cam === 'function' ? xyz(c) : c;
      await page.evaluate((p) => window.__onfoot.camera(p), camArr);
      await frames(3);
      const file = `vv-${name}-${hour < 17 ? 'day' : 'night'}-${tag}.png`;
      await page.screenshot({ path: path.join(OUT, file), timeout: 900000 });
      const st = await page.evaluate(() => { const s = window.__onfoot.stats?.() ?? {}; return { calls: s.calls ?? null, tris: s.tris ?? null }; });
      log.shots.push({ name, ref, hour, file, ...st });
      console.log(`  ${file}  ${JSON.stringify(st)}`);
    }
  }
} else {
  // the walk: the HUD stays (the Car button is pressed by the hook as a tap would), the clock at 17:30 (open)
  await page.evaluate(() => window.__onfoot.setClock('Sat', 15));
  await frames(2);
  const begin = await page.evaluate(() => window.__onfoot.walkBegin({ view: 'third' }));
  console.log('begin', JSON.stringify(begin));
  const steps = [], strip = [];
  let k = 0;
  // the frame read back every 6 steps (0.1 s); 10 frames kept for the strip, spread over the walk
  for (let i = 0; i < 4000; i++) {
    const r = await page.evaluate(() => window.__onfoot.walkStep(6));
    steps.push(r);
    if (!r.walking) break;
  }
  const n = steps.length, picks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => Math.round((j * (n - 1)) / 9));
  // re-run the same walk to shoot the 10 frames at the picked points (the walk is deterministic: the same path, steps)
  await page.evaluate(() => window.__onfoot.walkBegin({ view: 'third' }));
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.__onfoot.walkStep(6, { read: false }));
    if (picks.includes(i)) {
      const file = `vv-walk-${String(k++).padStart(2, '0')}-${tag}.png`;
      await page.screenshot({ path: path.join(OUT, file), timeout: 900000 });
      strip.push({ i, file, ...steps[i] });
      console.log(`  ${file} step ${steps[i].step} ${steps[i].state} u ${steps[i].u} v ${steps[i].v} exposure ${steps[i].exposure} luma ${steps[i].read?.mean} black ${steps[i].read?.black}`);
    }
  }
  const wl = await page.evaluate(() => window.__onfoot.walkLog());
  const worstBlack = Math.max(...steps.map((s) => s.read?.black ?? 0)), minMean = Math.min(...steps.map((s) => s.read?.mean ?? 0)), minSpread = Math.min(...steps.map((s) => s.read?.spread ?? 0));
  const renderMs = steps.map((s) => s.renderMs).sort((a, b) => a - b);
  const summary = { frames: n, simSteps: wl.steps, endNearCar: steps[n - 1].nearCar, end: steps[n - 1].pos, states: wl.states, camJumpMax: wl.camJumpMax, camJumpAt: wl.camJumpAt, playerStepMax: wl.playerStepMax, fadeSeen: wl.fadeSeen,
    worstBlackShare: worstBlack, minMeanLuma: minMean, minLumaSpread: minSpread, exposure: { min: Math.min(...steps.map((s) => s.exposure)), max: Math.max(...steps.map((s) => s.exposure)), maxStep: Math.max(...steps.slice(1).map((s, i) => Math.abs(s.exposure - steps[i].exposure))) },
    renderMs: { median: renderMs[Math.floor(n / 2)], p95: renderMs[Math.floor(n * 0.95)], max: renderMs[n - 1] } };
  log.walk = { begin, summary, strip, steps };
  console.log('walk', JSON.stringify(summary));
}
log.errors = errors;
const JS = path.join(OUT, `vv-shoot-${WALK ? 'walk-' : ''}${tag}.json`);
// a run of some views (--only) keeps the other views' entries from an earlier run
if (only.length && existsSync(JS)) { try { const old = JSON.parse(readFileSync(JS, 'utf8')); const mine = new Set(log.shots.map((x) => x.file)); log.shots = [...(old.shots ?? []).filter((x) => !mine.has(x.file)), ...log.shots]; } catch { /* a fresh log */ } }
writeFileSync(JS, JSON.stringify(log, null, 1));
console.log(errors.length ? `console errors: ${errors.slice(0, 5).join(' | ')}` : 'no console errors');
await browser.close();
