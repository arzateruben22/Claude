// The new HUD's frames (claude/retro-hud, owner 2026-11-23: one layout, the Retro skin and the Ultra skin): at 390 x 844
// on a 3x touch phone the drift moment the owner's mockups redraw (I-405 North's straight, 30 m/s, Sport handling, the
// wheel a third right, then the handbrake pulled by sliding from BRAKE into the round HANDBRAKE), chase and seat; the
// handbrake idle and pressed directly; CLEAR PATH charging and ready; on Ultra ABS on + TCS off (the real switch, clicked);
// the OC Hypercar with JUMP; 844 x 390 with a notch's insets; 1280 x 720 on a desktop. Real pointer events on the real
// elements; the simulation stepped by hand through the input layer (the game's own loop paused, as drift-frames.mjs).
//   node tests/retrohud-frames.mjs [--skin=retro|ultra|both] [--only=phone,land,hyper,desk] [--out=tests/out/retrohud]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GAME = path.join(ROOT, 'dist', 'top-speed-ultra.html');
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(arg('out', path.join(ROOT, 'tests', 'out', 'retrohud')));
const SKINS=['ultra'];
const SUF = arg('suffix', '');   // e.g. -r1: a re-shoot's frames keep the first set's names plus this
const ONLY = new Set(arg('only', 'phone,land,hyper,desk').split(','));
mkdirSync(OUT, { recursive: true });
const WARM = path.join(OUT, 'warm.html');
writeFileSync(WARM, '<!doctype html><meta charset="utf-8"><title>warm</title>');
const exe = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const browser = await chromium.launch({ ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }));
const log = {};

async function boot(skin, opts) {
  const ctx = await browser.newContext(opts);
  // Retro = Low + the Retro style; Ultra = the same Low world in the standard style (the skin follows retroOn)
  await ctx.addInitScript((s) => { if (!location.pathname.endsWith('/warm.html') && !sessionStorage.getItem('rh.keep')) { localStorage.setItem('tsu.settings', JSON.stringify(s)); localStorage.setItem('tsu.hint.retrotbar', '1'); localStorage.setItem('tsu.hint.radial', '1'); } },
    { quality: 'low', style: skin === 'retro' ? 'retro' : 'standard', v: 3, qualityChosen: true, adaptive: false, density: 'none', time: 'day', weather: 'clear', handling: 0.5, hudStyle: 'modern', abs: true, tcs: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(WARM).href); await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 400000 });
  await page.getByRole('radio', { name: /Free Drive/ }).click();
  await page.getByRole('button', { name: 'Drive', exact: true }).click();
  await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 900000, polling: 500 });
  await page.evaluate(() => {
    const g = window.__game;
    window.run = (secs, each) => { for (let t = 0; t < secs - 1e-9; t += 1 / 120) { g.input.update(1 / 120, Math.abs(g.phys.vx)); if (each) each(t); g.simulate(1 / 120); if (g.steps % 6 === 0) g.stream(1); } };
    window.setup = (cam) => {
      const m = g.findMain('I-405 North'); let best = null;
      for (let s0 = 3000; s0 < m.len - 1000; s0 += 100) { let k = 0; for (let s = s0; s < s0 + 700; s += 25) k = Math.max(k, Math.abs(m.sample(s).k)); if (!best || k < best.k) best = { s0, k }; if (k < 1 / 3000) break; }
      g.paused = true; g.traffic.clearAround(g.phys.x, g.phys.z, 800); g.placeCar(m, best.s0 + 100, 1, 30); g.apLane = 1; g.phys.handling = 0.5; g.input.clear(); g.setCam(cam);
    };
  });
  const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 300000 }); };
  const fire = (sel, type, dx = 0, dy = 0, id = 31) => page.evaluate((a) => {
    const e = document.querySelector(a.sel), r = e.getBoundingClientRect();
    e.dispatchEvent(new PointerEvent(a.type, { clientX: r.left + r.width / 2 + a.dx, clientY: r.top + r.height / 2 + a.dy, bubbles: true, pointerId: a.id, pointerType: 'touch', isPrimary: true }));
  }, { sel, type, dx, dy, id });
  const shot = async (name) => { name = name.replace(/\.png$/, SUF + '.png'); await frames(4); await page.screenshot({ path: path.join(OUT, name) }); console.log('shot', name); };
  const settle = async (cam, touch = true) => {
    await page.evaluate((c) => window.setup(c), cam);
    if (touch) { await fire('.touch-steer', 'pointerdown', 0, 0, 12); await fire('.touch-steer', 'pointermove', 25, 0, 12); await page.evaluate(() => window.run(0.8)); }
    else await page.evaluate(() => window.run(0.8, () => { window.__game.input.c.steer = 0.36; }));
  };
  const state = () => page.evaluate(() => {
    const g = window.__game, d = g.phys.drift, hb = document.querySelector('.hb-round');
    return { mph: Math.round(Math.abs(g.phys.vx) * 2.236936), gear: g.phys.gear, angle: +d.angle.toFixed(1), driftT: +d.time.toFixed(2), touchHb: g.input.touch.handbrake, hb: g.input.c.handbrake,
      pulled: hb?.classList.contains('pulled') ?? null, readout: document.querySelector('.hud-drift')?.textContent.replace(/\s+/g, ' ').trim(), plate: document.querySelector('.hud-plate')?.innerText.replace(/\s+/g, ' ').trim(),
      skin: document.querySelector('.app').dataset.skin, abs: g.phys.abs, tc: g.phys.tc, lever: !!document.querySelector('.hb-lever') };
  });
  return { ctx, page, errors, frames, fire, shot, settle, state };
}

const boxes = (page, sels) => page.evaluate((S) => Object.fromEntries(Object.entries(S).map(([k, q]) => { const e = document.querySelector(q); if (!e || e.hidden) return [k, null]; const b = e.getBoundingClientRect(); return [k, b.width ? [b.left, b.top, b.right, b.bottom].map(Math.round) : null]; })), sels);
const SEL = { cap: '.hb-cap', card: '.hud-card', plate: '.hud-plate', pause: '.tbtn.menu', map: '.corner', assists: '.hud-assists', drift: '.hud-drift', steer: '.touch-steer', hb: '.hb-round', brake: '.pedal.brake', gas: '.pedal.gas', clear: '.hud-ability', jump: '.hud-thrustbtn' };


const T = await boot('ultra', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
const { page, frames } = T;
await page.evaluate(() => { const g = window.__game, m = g.findMain('I-405 North'); g.setPaused(true); g.placeCar(m, m.len * 0.12, 1, 28); g.navigateTo('CA-55 North'); g.fastForward(Math.max(0, (g.route[0].s - g.phys.s - 1500) / 28), {}, 28); g.setPaused(false); });
await page.waitForFunction(() => window.__game.routeDrawn > 20 && !!document.querySelector('.tbtn.auto') && !!document.querySelector('.hud-nav-lanes:not([hidden]) i.on'), null, { timeout: 300000, polling: 100 });
await frames(4);
const r = await page.evaluate(() => { const q=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [b.left,b.top,b.right,b.bottom].map(Math.round)}; return { H: innerHeight, band: [0.22*innerHeight, 0.7*innerHeight], plate: q('.hud-plate'), assists: q('.hud-assists'), pause: q('.tbtn.menu'), auto: q('.tbtn.auto'), map: q('.corner'), plateB: getComputedStyle(document.querySelector('.app')).getPropertyValue('--plate-b'), plateBinline: document.querySelector('.app').style.getPropertyValue('--plate-b') }; });
console.log(JSON.stringify(r));
await page.screenshot({ path: path.join(OUT, 'route-measure.png') });
await browser.close();
