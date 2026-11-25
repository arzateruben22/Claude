// The trailer's deterministic capture: real in-game footage, frame by frame (control/trailer/TRAILER_PLAN.md).
//   node tools/trailer/capture.mjs --build=<dir with top-speed-ultra.html> --shot=s3-cockpit --out=<dir> [--ref] [--size=1920x1080]
// --ref records one reference frame (the shot's middle) instead of every frame; --at=10,40,80 records those frames. Shots are in shots.mjs.
//
// How it stays deterministic:
// - Math.random is a seeded generator (mulberry32), reseeded with the shot's seed just before the warm-up drive, so
//   traffic spawns and the drive are the same every run.
// - requestAnimationFrame and performance.now run on a virtual clock once a shot starts recording: each __tick
//   advances exactly 1000/30 ms and runs the game's frame once, so the game simulates exactly 1/30 s (four of its
//   1/120 s steps) per recorded frame however slowly SwiftShader renders it.
// - The warm-up drive is the game's own fastForward (the fixed step, the autopilot) with the game paused
//   (setPaused), so where the car is when recording starts does not depend on load time.
// - Adaptive quality (the frame-time governor) is off; the camera is one of the game's own (setCam), and for the
//   cinematic camera the shot is pinned (cineShot, cineT) so its move starts at its beginning.
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHOTS, BAR } from './shots.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const REF = process.argv.includes('--ref');
const FPS = 30, MS = 1000 / FPS;
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const GAME = path.join(path.resolve(opt('build', 'dist')), 'top-speed-ultra.html');
if (!existsSync(GAME)) { console.error(`No build at ${GAME}`); process.exit(2); }
const shot = SHOTS.find((s) => s.id === opt('shot', ''));
if (!shot) { console.error(`--shot= one of ${SHOTS.map((s) => s.id).join(', ')}`); process.exit(2); }
const OUT = path.resolve(opt('out', 'trailer-frames'));
const frames = Math.round(shot.bars * BAR * FPS);

async function run(variant, dir) {
  const s = { ...shot, ...(variant ?? {}) };
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.TRAILER_CHROME || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await ctx.addInitScript(({ s }) => {
    const settings = { quality: s.quality, qualityChosen: true, adaptive: false, density: s.density ?? 'moderate', owner: true, look: 'ultra',
      theme: 'dark', time: s.time, weather: s.weather ?? 'clear', start: s.start ?? 'I-405 North', exit: '', style: s.style ?? 'standard',
      showFps: false, showPerf: false, showTouch: false, master: 0, music: 0 };
    if (s.paint != null) settings.paints = { [s.car]: s.paint };
    localStorage.setItem('tsu.settings', JSON.stringify(settings));
    localStorage.setItem('tsu.ownerCar', s.car);
    let a = 1;
    const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    Math.random = rnd;
    window.__reseed = (n) => { a = n >>> 0; };
    const realNow = performance.now.bind(performance), realRaf = window.requestAnimationFrame.bind(window);
    let det = false, vt = 0, q = [];
    performance.now = () => (det ? vt : realNow());
    window.requestAnimationFrame = (cb) => { if (!det) return realRaf(cb); q.push(cb); return 1e6 + q.length; };
    window.__det = () => { if (!det) { vt = realNow(); det = true; } };
    window.__tick = (ms) => { vt += ms; const c = q; q = []; for (const f of c) f(vt); return c.length; };
  }, { s });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 240000 });
  await page.waitForTimeout(1500);

  if (s.reveal) {
    // the garage's Founder reveal stage (Game.openReveal), drawn into a full-frame canvas over the page
    await page.evaluate(({ W, H }) => {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.id = 'trailer-stage';
      cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:#000';
      document.body.appendChild(cv);
      const g = window.__game; g.openReveal(cv, false); g.playReveal('reveal'); g.revealHold(0);
    }, { W, H });
    await page.waitForFunction(() => { const g = window.__game; return g.rv?.compiled; }, null, { timeout: 240000 });
  } else if (s.menu) {
    await page.evaluate(({ s }) => { const g = window.__game; g.setPaused(true); window.__reseed(s.seed); g.fastForward(s.warm, {}, 31); g.cineShot = s.cine; g.cineT = 0; g.setPaused(false); }, { s });
  } else {
    await page.getByRole('radio', { name: /Free Drive/ }).click();
    await page.getByRole('button', { name: 'Start run', exact: true }).click();
    await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 240000 });
    await page.evaluate(({ s }) => {
      const g = window.__game;
      g.setPaused(true);
      window.__reseed(s.seed);
      g.fastForward(s.warm, {}, s.cruise ?? 31);
      g.setCam(s.cam);
      if (s.cam === 'cinematic') { g.cineShot = s.cine; g.cineT = 0; }
      // the player's controls come from the script: the game's own autopilot at the shot's cruise, or the drift's inputs
      const inp = g.input, cruise = s.cruise ?? 31; let t = 0;
      inp.update = (dt) => {
        t += dt;
        g.autopilot(inp.c, cruise);
        const d = s.drift;
        // the drift: a handbrake flick into the turn, then opposite lock to hold the slide, then the autopilot again
        if (d && t >= d.at && t < d.at + d.hand + d.hold) {
          const flick = t < d.at + d.hand;
          inp.c.steer = flick ? d.steer : -d.steer * d.counter; inp.c.throttle = flick ? 0.6 : 1; inp.c.brake = 0; inp.c.handbrake = flick;
        }
      };
      g.setPaused(false);
    }, { s });
  }
  if (!s.hud) await page.addStyleTag({ content: '.hud, .tbar, .hud-assists, .toast, .toasts, [class*="toast"], .corner, .touch, .touch-hint, .touch-knob, .touch-rod, .touch-pedals, .asw-knob, .asw-track { display: none !important; }' });
  await page.evaluate(() => window.__det());
  // preroll: a few frames so programs compile and streamed tiles land before the first recorded frame (the sim
  // still advances; the warm-up already accounts for it)
  for (let i = 0; i < 6; i++) { await page.evaluate((ms) => window.__tick(ms), MS); await page.waitForTimeout(300); }
  const list = opt('at', '') ? opt('at', '').split(',').map(Number) : REF ? [Math.floor(frames / 2)] : [...Array(frames).keys()];
  let done = 0; const t0 = Date.now();
  for (let f = 0; f <= list[list.length - 1]; f++) {
    await page.evaluate(({ ms, f, s, n }) => {
      const g = window.__game;
      if (s.reveal) g.revealHold(s.revealFrom + (f / n) * (6.2 - s.revealFrom));
      window.__tick(ms);
    }, { ms: MS, f, s, n: frames });
    if (list.includes(f)) {
      await page.screenshot({ path: path.join(dir, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 });
      done++;
      if (!REF && done % 15 === 0) console.error(`${s.id}: ${done}/${list.length} (${((Date.now() - t0) / done / 1000).toFixed(1)} s/frame)`);
    }
  }
  const st = await page.evaluate(() => { const g = window.__game; return { road: g.stats.path, mph: Math.round(Math.abs(g.stats.v) * 2.237), traffic: g.stats.traffic }; });
  await browser.close();
  return { dir, frames: done, ...st, errors };
}

const res = [await run(null, shot.twin ? path.join(OUT, shot.id, 'ultra') : path.join(OUT, shot.id))];
if (shot.twin) res.push(await run(shot.twin, path.join(OUT, shot.id, 'retro')));
console.log(JSON.stringify({ shot: shot.id, expectFrames: frames, ref: REF, res }, null, 1));
