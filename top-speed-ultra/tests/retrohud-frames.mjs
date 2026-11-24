// The new HUD's frames (claude/retro-hud, owner 2026-11-23: one layout, the Retro skin and the Ultra skin): at 390 x 844
// on a 3x touch phone the drift moment the owner's mockups redraw (I-405 North's straight, 30 m/s, Sport handling, the
// wheel a third right, then the handbrake pulled by sliding the thumb up from BRAKE: the owner's gesture since the round
// HANDBRAKE went, 2026-11-24, Touch.tsx), chase and seat; the handbrake idle and held (slid up and kept there); CLEAR PATH charging and ready; on Ultra ABS on + TCS off (the real switch, clicked);
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
const SKINS = arg('skin', 'both') === 'both' ? ['retro', 'ultra'] : [arg('skin')];
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
    const g = window.__game, d = g.phys.drift, hb = document.querySelector('.pedal.brake');
    return { mph: Math.round(Math.abs(g.phys.vx) * 2.236936), gear: g.phys.gear, angle: +d.angle.toFixed(1), driftT: +d.time.toFixed(2), touchHb: g.input.touch.handbrake, hb: g.input.c.handbrake,
      pulled: hb?.classList.contains('pulled') ?? null, readout: document.querySelector('.hud-drift')?.textContent.replace(/\s+/g, ' ').trim(), plate: document.querySelector('.hud-plate')?.innerText.replace(/\s+/g, ' ').trim(),
      skin: document.querySelector('.app').dataset.skin, abs: g.phys.abs, tc: g.phys.tc, lever: !!document.querySelector('.hb-lever') };
  });
  return { ctx, page, errors, frames, fire, shot, settle, state };
}

const boxes = (page, sels) => page.evaluate((S) => Object.fromEntries(Object.entries(S).map(([k, q]) => { const e = document.querySelector(q); if (!e || e.hidden) return [k, null]; const b = e.getBoundingClientRect(); return [k, b.width ? [b.left, b.top, b.right, b.bottom].map(Math.round) : null]; })), sels);
const SEL = { card: '.hud-card', plate: '.hud-plate', pause: '.tbtn.menu', map: '.corner', assists: '.hud-assists', drift: '.hud-drift', steer: '.touch-steer', brake: '.pedal.brake', gas: '.pedal.gas', clear: '.hud-ability', jump: '.hud-thrustbtn' };

for (const skin of SKINS) {
  const L = log[skin] = {};
  if (ONLY.has('phone') || ONLY.has('land') || ONLY.has('hyper')) {
    const T = await boot(skin, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const { page, fire, shot, settle, state, frames } = T;
    if (ONLY.has('phone')) {
      // idle, CLEAR PATH ready
      await settle('chase');
      await shot(`${skin}-idle-chase-390x844.png`);
      L.idle = await state(); L.boxes = await boxes(page, SEL);
      L.gauge = await page.evaluate(() => { const k = document.querySelector('.hud-ability'), b = getComputedStyle(k, '::before').backgroundImage, r = k.getBoundingClientRect();
        return { conic: /conic-gradient/.test(b), layers: (b.match(/gradient\(/g) || []).length, bg: b.slice(0, 60), rect: [r.left, r.top, r.width, r.height].map(Math.round), p: k.style.getPropertyValue('--p') }; });
      // the drift moment: BRAKE pressed and the thumb slid 40 px up (past Touch.tsx PULL_PX, 28), held there
      await fire('.pedal.brake', 'pointerdown', 0, 0, 26); await fire('.pedal.brake', 'pointermove', 0, -40, 26);
      await page.evaluate(() => window.run(0.55));
      await shot(`${skin}-drift-chase-390x844.png`);
      L.driftChase = await state();
      await fire('.pedal.brake', 'pointerup', 0, -40, 26);
      L.afterLift = await state();
      await fire('.touch-steer', 'pointerup', 0, 0, 12);
      // the seat view, the same moment
      await settle('cockpit');
      await fire('.pedal.brake', 'pointerdown', 0, 0, 27); await fire('.pedal.brake', 'pointermove', 0, -40, 27);
      await page.evaluate(() => window.run(0.55));
      await shot(`${skin}-drift-seat-390x844.png`);
      L.driftSeat = await state();
      await fire('.pedal.brake', 'pointerup', 0, -40, 27); await fire('.touch-steer', 'pointerup', 0, 0, 12);
      // the handbrake held: BRAKE pressed, slid up 40 px and kept there (no separate button since 2026-11-24)
      await settle('chase');
      await fire('.pedal.brake', 'pointerdown', 0, 0, 28); await fire('.pedal.brake', 'pointermove', 0, -40, 28);
      await page.evaluate(() => window.run(0.4));
      await shot(`${skin}-hb-pressed-390x844.png`);
      L.pressed = await state();
      await fire('.pedal.brake', 'pointerup', 0, -40, 28); await fire('.touch-steer', 'pointerup', 0, 0, 12);
      // CLEAR PATH: used, run out, recharging (a third of the way back)
      await settle('chase');
      // (the ability's own trigger: with no traffic set, the button says "No traffic to clear" and keeps the charge)
      await page.evaluate(() => { const g = window.__game; g.ability.trigger(); window.run(6.2 + 15); });
      await shot(`${skin}-clear-charging-390x844.png`);
      L.charging = await page.evaluate(() => { const b = document.querySelector('.hud-ability'); return { cls: b.className, p: b.style.getPropertyValue('--p'), label: b.getAttribute('aria-label') }; });
      await fire('.touch-steer', 'pointerup', 0, 0, 12);
      if (skin === 'ultra') {
        // ABS on + TCS off: the real switch
        await page.click('.asw.tcs');
        await frames(3);
        await settle('chase');
        await shot(`ultra-abs-on-tcs-off-390x844.png`);
        L.tcsOff = await state();
        L.tcsOff.toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent));
        L.tcsOff.saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tsu.settings')).tcs);
        await page.click('.asw.tcs');
        await fire('.touch-steer', 'pointerup', 0, 0, 12);
      }
    }
    if (ONLY.has('land')) {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.evaluate(() => { const a = document.querySelector('.app'); a.style.setProperty('--sa-l', '47px'); a.style.setProperty('--sa-r', '47px'); a.style.setProperty('--sa-b', '0px'); });
      await frames(3);
      await settle('chase');
      await fire('.pedal.brake', 'pointerdown', 0, 0, 29); await fire('.pedal.brake', 'pointermove', 0, -40, 29);
      await page.evaluate(() => window.run(0.55));
      await shot(`${skin}-drift-chase-844x390.png`);
      L.land = await state(); L.landBoxes = await boxes(page, SEL);
      await fire('.pedal.brake', 'pointerup', 0, -40, 29); await fire('.touch-steer', 'pointerup', 0, 0, 12);
      await page.evaluate(() => { const a = document.querySelector('.app'); for (const k of ['--sa-l', '--sa-r', '--sa-b']) a.style.removeProperty(k); });
      await page.setViewportSize({ width: 390, height: 844 });
      await frames(3);
    }
    if (ONLY.has('hyper')) {
      await page.evaluate(async () => {
        const g = window.__game;
        g.updateSettings({ ...g.settings, owner: true, density: 'none' }); g.chooseOwnerCar('oc-hyper');
        Object.assign(g.input.c, { throttle: 0, brake: 0, steer: 0, thrust: 0 });
        await g.start('free'); g.setPaused(false);
      });
      await page.waitForFunction(() => { const b = document.querySelector('.hud-thrustbtn'); return b && !b.hidden && !document.querySelector('.loadbar') && document.querySelector('.touch-steer'); }, null, { timeout: 900000, polling: 500 });
      await settle('chase');
      await shot(`${skin}-hypercar-jump-390x844.png`);
      L.hyper = await state(); L.hyperBoxes = await boxes(page, SEL);
      await fire('.touch-steer', 'pointerup', 0, 0, 12);
    }
    L.errors = T.errors.slice(0, 5);
    await T.ctx.close();
  }
  if (ONLY.has('desk')) {
    const T = await boot(skin, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const { page, shot, settle, state } = T;
    await settle('chase', false);
    await page.evaluate(() => window.run(0.55, () => { const c = window.__game.input.c; c.steer = 0.36; c.handbrake = true; }));
    await shot(`${skin}-drift-chase-1280x720.png`);
    L.desk = await state(); L.deskBoxes = await boxes(page, { ...SEL, speed: '.hud-speed', stats: '.hud-stats', rail: '.tbar' });
    L.deskErrors = T.errors.slice(0, 5);
    await T.ctx.close();
  }
}
writeFileSync(path.join(OUT, 'frames-log.json'), JSON.stringify(log, null, 1));
console.log(JSON.stringify(log, null, 1));
await browser.close();
