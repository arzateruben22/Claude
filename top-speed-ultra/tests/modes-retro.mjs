// RS1, the Retro render style: the same six frames in any build and look, and the phone cost of a look on one
// seeded drive. Drives a single-file build in headless Chromium with SwiftShader through the window.__game hooks,
// starting the run the way tests/regression.mjs does (the mode's radio, then Drive).
//
//   node tests/modes-retro.mjs shots --build=dist/top-speed-ultra.html --tag=retro --quality=low --style=retro
//        [--sizes=desktop,phone] [--only=405-day-cockpit,...]      frames to tests/out/modes/<tag>-<size>-<frame>.png
//   node tests/modes-retro.mjs perf --runs=before.html:low:standard,dist/top-speed-ultra.html:low:retro [--rounds=2]
//        frame ms (rAF interval while paused, so only rendering differs), draw calls and triangles a frame, at six
//        points of one seeded drive on the phone profile (390 x 844 at 2x, touch); runs alternate, so the machine's
//        load falls on both alike
//
// Software rendering is slow and this machine is shared: one browser at a time, long timeouts.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'modes');
mkdirSync(OUT, { recursive: true });
const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const cmd = process.argv[2];

// the six frames: both cameras at each time of day, on the 405 through Irvine and the 5 through Anaheim
export const FRAMES = [
  { id: '405-day-cockpit', road: 'I-405 North', at: 0.2, time: 'day', cam: 'cockpit' },
  { id: '405-sunset-chase', road: 'I-405 North', at: 0.2, time: 'sunset', cam: 'chase' },
  { id: '405-night-cockpit', road: 'I-405 North', at: 0.2, time: 'night', cam: 'cockpit' },
  { id: '5-day-chase', road: 'I-5 South', at: 0.3, time: 'day', cam: 'chase' },
  { id: '5-sunset-cockpit', road: 'I-5 South', at: 0.3, time: 'sunset', cam: 'cockpit' },
  { id: '5-night-chase', road: 'I-5 South', at: 0.3, time: 'night', cam: 'chase' },
];
const SIZES = {
  desktop: { viewport: { width: 1280, height: 720 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  sweep: { viewport: { width: 640, height: 360 } },
};

async function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
}
// a fresh context with these settings, booted to the menu, then a Free Drive started from the menu
async function openDrive(browser, build, size, settings) {
  const ctx = await browser.newContext(SIZES[size]);
  const base = { quality: 'low', adaptive: false, density: 'moderate', time: 'day', weather: 'clear', start: 'I-405 North' };
  await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { ...base, ...settings });
  const page = await ctx.newPage();
  page.setDefaultTimeout(600000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || /warn/.test(m.type())) errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  const t0 = Date.now();
  await page.goto(pathToFileURL(path.resolve(build)).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 600000 });
  await page.getByRole('radio', { name: /Free Drive/ }).click();
  await page.getByRole('button', { name: 'Drive', exact: true }).click();
  await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 600000 });
  return { ctx, page, errors, bootS: (Date.now() - t0) / 1000 };
}
const frames = async (page, n) => {
  const f0 = await page.evaluate(() => window.__game.frames);
  await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 900000, polling: 200 });
};
// put the car somewhere on a freeway with the same traffic every time, at speed, and build what's in view
async function place(page, road, at, seed, t) {
  await page.evaluate(async ([road, at, seed, t]) => {
    const g = window.__game, m = g.findMain(road);
    g.setPaused(true);
    g.placeCar(m, m.len * at, 1, 30); g.apLane = 1;
    g.traffic.reseed(seed); g.traffic.fill(g.view());
    g.fastForward(t, {}, 30);
    await g.prebuild('Placing');
    g.ev.loading(false);
  }, [road, at, seed, t]);
}
async function sky(page, time) {
  await page.evaluate((time) => {
    const g = window.__game;
    g.updateSettings({ ...g.settings, time, weather: 'clear' });
    for (let i = 0; i < 150; i++) g.weatherTick(0.1);
  }, time);
}
async function cam(page, c) { await page.evaluate((c) => { const g = window.__game; g.setCam(c); g.camBlend = 1; }, c); }

async function shots() {
  const build = arg('build', 'dist/top-speed-ultra.html'), tag = arg('tag', 'shot'), quality = arg('quality', 'low'), style = arg('style', 'standard');
  const sizes = arg('sizes', 'desktop,phone').split(','), only = arg('only').split(',').filter(Boolean);
  const browser = await launch();
  const log = [];
  for (const size of sizes) {
    const { ctx, page, errors, bootS } = await openDrive(browser, build, size, { quality, style });
    console.log(`${tag} ${size}: driving after ${bootS.toFixed(0)} s`);
    for (const f of FRAMES) {
      if (only.length && !only.includes(f.id)) continue;
      const t0 = Date.now();
      await place(page, f.road, f.at, 405, 4);
      await sky(page, f.time);
      await cam(page, f.cam);
      await frames(page, 3);
      const css = await page.addStyleTag({ content: '.overlay, .toasts { visibility: hidden !important; }' });
      await frames(page, 1);
      const file = path.join(OUT, `${tag}-${size}-${f.id}.png`);
      await page.screenshot({ path: file, timeout: 900000 });
      await css.evaluate((e) => e.remove());
      const st = await page.evaluate(() => { const g = window.__game; return { calls: g.stats.calls, pr: g.renderer.getPixelRatio(), buf: `${g.renderer.domElement.width}x${g.renderer.domElement.height}` }; });
      const line = `${tag} ${size} ${f.id}: ${path.relative(ROOT, file)} (${((Date.now() - t0) / 1000).toFixed(0)} s, pixel ratio ${st.pr}, buffer ${st.buf})`;
      console.log(line); log.push(line);
    }
    if (errors.length) { console.log(`${tag} ${size}: page messages:\n  ` + errors.slice(0, 8).join('\n  ')); log.push(...errors.slice(0, 8)); }
    await ctx.close();
  }
  await browser.close();
  writeFileSync(path.join(OUT, `${tag}-shots.log`), log.join('\n') + '\n');
}

// the cost of a look on the phone profile: the same seeded drive, six points along it, each point's frame time the
// median rAF interval over 24 frames while paused (the simulation stands still, so only rendering differs), and every
// renderer.render call's draw calls and triangles added up per frame (the scene, its shadow map, any post pass, the flare)
async function perf() {
  const runs = arg('runs').split(',').filter(Boolean).map((r) => { const [build, quality, style] = r.split(':'); return { build, quality, style }; });
  const rounds = Number(arg('rounds', '2')), size = arg('size', 'phone'), points = Number(arg('points', '6'));
  const browser = await launch();
  const res = runs.map(() => []);
  for (let round = 0; round < rounds; round++) {
    for (let k = 0; k < runs.length; k++) {
      const r = runs[k];
      const { ctx, page, errors } = await openDrive(browser, r.build, size, { quality: r.quality, style: r.style, corner: 'map' });
      await page.evaluate(() => {
        const g = window.__game, ren = g.renderer, orig = ren.render.bind(ren);
        window.__acc = { calls: 0, tris: 0, frames: 0 };
        ren.render = (s, c) => { orig(s, c); window.__acc.calls += ren.info.render.calls; window.__acc.tris += ren.info.render.triangles; };
        window.__ivals = [];
        let last = 0;
        const tick = (t) => { if (last) window.__ivals.push(t - last); last = t; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      await place(page, 'I-405 North', 0.12, 405, 2);
      await frames(page, 6);                                   // shaders compiled, the first chunks uploaded
      for (let i = 0; i < points; i++) {
        await page.evaluate(async () => { const g = window.__game; g.fastForward(5, {}, 31); await g.prebuild('x'); g.ev.loading(false); });
        await frames(page, 4);
        await page.evaluate(() => { window.__ivals.length = 0; window.__acc = { calls: 0, tris: 0, f0: window.__game.frames }; });
        await frames(page, 24);
        const m = await page.evaluate(() => {
          const v = [...window.__ivals].sort((a, b) => a - b), g = window.__game, n = g.frames - window.__acc.f0;
          return { ms: v[Math.floor(v.length / 2)], n: v.length, calls: window.__acc.calls / n, tris: window.__acc.tris / n, pr: g.renderer.getPixelRatio(), buf: `${g.renderer.domElement.width}x${g.renderer.domElement.height}`, s: g.phys.s };
        });
        res[k].push(m);
        console.log(`round ${round + 1} ${r.quality}/${r.style} ${path.basename(r.build)} point ${i + 1}: ${m.ms.toFixed(1)} ms, ${m.calls.toFixed(0)} calls, ${(m.tris / 1000).toFixed(0)}k tris, pr ${m.pr}, ${m.buf}, s ${m.s.toFixed(0)}`);
      }
      if (errors.length) console.log('  page messages: ' + errors.slice(0, 5).join(' | '));
      await ctx.close();
    }
  }
  await browser.close();
  const med = (a) => { const v = [...a].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  const summary = runs.map((r, k) => ({ ...r, ms: med(res[k].map((m) => m.ms)), calls: med(res[k].map((m) => m.calls)), tris: med(res[k].map((m) => m.tris)), buf: res[k][0]?.buf, pr: res[k][0]?.pr, samples: res[k] }));
  for (const s of summary) console.log(`${s.quality}/${s.style} ${s.build}: median ${s.ms.toFixed(1)} ms a frame, ${s.calls.toFixed(0)} draw calls, ${(s.tris / 1000).toFixed(0)}k triangles, pixel ratio ${s.pr}, buffer ${s.buf}`);
  writeFileSync(path.join(OUT, `perf-${arg('tag', 'run')}.json`), JSON.stringify(summary, null, 1));
}

if (cmd === 'shots') await shots();
else if (cmd === 'perf') await perf();
else { console.error('usage: node tests/modes-retro.mjs shots|perf ...'); process.exit(2); }
