// The phone handbrake's frames (claude/drift): at 390 x 844 on a 3x phone, the controls as they were (the new lever and
// readout hidden by CSS on the same build, labelled so), the lever at rest, the lever pulled with the drift readout up
// (chase and seat views), the same on its side at 844 x 390, and the second variant as a MOCK (a separate DRIFT key above
// BRAKE: not built, drawn over the real HUD for the owner to compare). Real pointer events on the real elements; the
// simulation stepped by hand through the input layer, the car at 30 m/s on I-405's straight at Sport handling.
//   node tests/drift-frames.mjs [--out=tests/out/drift]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GAME = path.join(ROOT, 'dist', 'top-speed-ultra.html');
const OUT = path.resolve(process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? path.join(ROOT, 'tests', 'out', 'drift'));
mkdirSync(OUT, { recursive: true });
const WARM = path.join(OUT, 'warm.html');
writeFileSync(WARM, '<!doctype html><meta charset="utf-8"><title>warm</title>');

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
await ctx.addInitScript((s) => { if (!location.pathname.endsWith('/warm.html')) localStorage.setItem('tsu.settings', JSON.stringify(s)); },
  { quality: 'low', style: 'standard', v: 3, adaptive: false, density: 'none', time: 'day', weather: 'clear', handling: 0.5, hudStyle: 'modern' });
const page = await ctx.newPage();
page.setDefaultTimeout(240000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(pathToFileURL(WARM).href); await page.goto(pathToFileURL(GAME).href);
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 300000 });
await page.getByRole('radio', { name: /Free Drive/ }).click();
await page.getByRole('button', { name: 'Drive', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 900000, polling: 500 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 240000 }); };
const fire = (sel, type, dx = 0, dy = 0, id = 31) => page.evaluate((a) => {
  const e = document.querySelector(a.sel), r = e.getBoundingClientRect();
  e.dispatchEvent(new PointerEvent(a.type, { clientX: r.left + r.width / 2 + a.dx, clientY: r.top + r.height / 2 + a.dy, bubbles: true, pointerId: a.id, pointerType: 'touch', isPrimary: true }));
}, { sel, type, dx, dy, id });
// a clean straight, the car at 30 m/s, the wheel a third of the way right; `run` steps the sim through the input layer
await page.evaluate(() => {
  const g = window.__game;
  window.run = (secs, each) => { for (let t = 0; t < secs - 1e-9; t += 1 / 120) { g.input.update(1 / 120, Math.abs(g.phys.vx)); g.simulate(1 / 120); if (g.steps % 6 === 0) g.stream(1); if (each) each(t); } };
  window.setup = (cam) => {
    const m = g.findMain('I-405 North'); let best = null;
    for (let s0 = 3000; s0 < m.len - 1000; s0 += 100) { let k = 0; for (let s = s0; s < s0 + 700; s += 25) k = Math.max(k, Math.abs(m.sample(s).k)); if (!best || k < best.k) best = { s0, k }; if (k < 1 / 3000) break; }
    g.paused = true; g.traffic.clearAround(g.phys.x, g.phys.z, 800); g.placeCar(m, best.s0 + 100, 1, 30); g.apLane = 1; g.phys.handling = 0.5; g.input.clear(); g.setCam(cam);
  };
});
const caption = (text) => page.evaluate((t) => { document.querySelector('.cap')?.remove(); if (!t) return; const d = document.createElement('div'); d.className = 'cap'; d.textContent = t;
  d.style.cssText = 'position:fixed;left:50%;top:max(env(safe-area-inset-top),0px);transform:translateX(-50%);z-index:99;padding:3px 8px;font:700 10px/1.3 ui-monospace,monospace;color:#fff;background:#b3261e;white-space:nowrap;pointer-events:none';
  document.querySelector('.app').appendChild(d); }, text);
const shot = async (name) => { await frames(4); await page.screenshot({ path: path.join(OUT, name) }); console.log('shot', name); };
const settle = async (cam) => { await page.evaluate((c) => window.setup(c), cam); await fire('.touch-steer', 'pointerdown', 0, 0, 12); await fire('.touch-steer', 'pointermove', 25, 0, 12); await page.evaluate(() => window.run(0.8)); };
const log = {};

// 1. before: the same build with the lever and the readout hidden and the steering pad back at its old width
await settle('chase');
await page.addStyleTag({ content: '.hb-lever{display:none!important}.hud-drift{display:none!important}.touch-steer{width:min(46vw,230px)!important}' });
await caption('BEFORE: lever + readout hidden (same build)');
await shot('drift-before-390x844.png');
await caption('');
await page.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.startsWith('.hb-lever{display:none')) s.remove(); });

// 2. the lever at rest
await shot('drift-idle-390x844.png');
const rest = await page.evaluate(() => { const r = (q) => { const b = document.querySelector(q).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); }; return { lever: r('.hb-lever'), brake: r('.pedal.brake'), gas: r('.pedal.gas'), steer: r('.touch-steer'), clear: r('.hud-ability') }; });
log.rest = rest;

// 3. the lever pulled, the drift readout up (chase, then the seat)
for (const cam of ['chase', 'cockpit']) {
  await settle(cam);
  await fire('.hb-lever', 'pointerdown', 0, 0, 25); await fire('.hb-lever', 'pointermove', -24, 0, 25);
  const d = await page.evaluate(() => { let maxA = 0; window.run(0.7, () => { maxA = Math.max(maxA, Math.abs(window.__game.phys.drift.angle)); }); const g = window.__game; return { maxA: +maxA.toFixed(1), angle: +g.phys.drift.angle.toFixed(1), on: g.phys.drift.active, time: +g.phys.drift.time.toFixed(2), hb: g.input.c.handbrake, mph: Math.round(Math.abs(g.phys.vx) * 2.236936) }; });
  await frames(4);
  const dom = await page.evaluate(() => ({ readout: document.querySelector('.hud-drift').textContent, hidden: document.querySelector('.hud-drift').hidden, pulled: document.querySelector('.hb-lever').classList.contains('pulled') }));
  log[cam] = { ...d, ...dom };
  await page.screenshot({ path: path.join(OUT, `drift-pulled-${cam}-390x844.png`) }); console.log('shot pulled', cam, JSON.stringify(log[cam]));
  await fire('.hb-lever', 'pointerup', 0, 0, 25); await fire('.touch-steer', 'pointerup', 0, 0, 12);
}

// 4. the mock variant B: a separate DRIFT key above BRAKE (the ability's key steps up a row); not built
await settle('chase');
await page.addStyleTag({ content: '.hb-lever{display:none!important}.touch-steer{width:min(46vw,230px)!important}.hud-ability{bottom:calc(var(--ctl-b) + 96px + 10px + 58px)!important}' });
await page.evaluate(() => {
  const k = document.createElement('button'); k.type = 'button'; k.className = 'hud-ability on mock-drift'; k.innerHTML = '<span>DRIFT</span>';
  k.style.cssText = '--k:var(--ember);color:var(--ink);bottom:calc(var(--ctl-b) + 96px + 10px)!important';
  k.classList.remove('on'); document.querySelector('.hud').appendChild(k);
});
await caption('MOCK B: DRIFT key above BRAKE (not built)');
await shot('drift-mock-variantB-390x844.png');
await caption('');

// 5. on its side, 844 x 390 with the notch's insets: the lever at rest, then pulled with the readout
await page.reload(); // fresh page for the landscape run
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 300000 });
await page.setViewportSize({ width: 844, height: 390 });
await page.getByRole('radio', { name: /Free Drive/ }).click();
await page.getByRole('button', { name: 'Drive', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 900000, polling: 500 });
await page.evaluate(() => {
  const g = window.__game;
  window.run = (secs, each) => { for (let t = 0; t < secs - 1e-9; t += 1 / 120) { g.input.update(1 / 120, Math.abs(g.phys.vx)); g.simulate(1 / 120); if (g.steps % 6 === 0) g.stream(1); if (each) each(t); } };
  const m = g.findMain('I-405 North'); let best = null;
  for (let s0 = 3000; s0 < m.len - 1000; s0 += 100) { let k = 0; for (let s = s0; s < s0 + 700; s += 25) k = Math.max(k, Math.abs(m.sample(s).k)); if (!best || k < best.k) best = { s0, k }; if (k < 1 / 3000) break; }
  g.paused = true; g.traffic.clearAround(g.phys.x, g.phys.z, 800); g.placeCar(m, best.s0 + 100, 1, 30); g.apLane = 1; g.phys.handling = 0.5; g.input.clear(); g.setCam('chase');
  const a = document.querySelector('.app'); a.style.setProperty('--sa-l', '47px'); a.style.setProperty('--sa-r', '47px'); a.style.setProperty('--sa-b', '0px');
});
await fire('.touch-steer', 'pointerdown', 0, 0, 12); await fire('.touch-steer', 'pointermove', 25, 0, 12);
await page.evaluate(() => window.run(0.8));
await shot('drift-idle-844x390.png');
await fire('.hb-lever', 'pointerdown', 0, 0, 25); await fire('.hb-lever', 'pointermove', -24, 0, 25);
await page.evaluate(() => window.run(0.7));
await frames(4);
log.landscape = await page.evaluate(() => ({ readout: document.querySelector('.hud-drift').textContent, hidden: document.querySelector('.hud-drift').hidden, pulled: document.querySelector('.hb-lever').classList.contains('pulled') }));
await page.screenshot({ path: path.join(OUT, 'drift-pulled-844x390.png') }); console.log('shot pulled landscape', JSON.stringify(log.landscape));
console.log(JSON.stringify(log), 'page errors:', errors.length, errors.slice(0, 3));
await browser.close();
