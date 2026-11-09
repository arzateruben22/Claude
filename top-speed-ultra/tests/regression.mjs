// Project OC regression suite. Drives the built game (dist/top-speed-ultra.html) in headless Chromium with
// SwiftShader, through the window.__game test hooks, and prints PASS or FAIL with the numbers each check saw.
//
//   npm run build && npm test             every group
//   npm test -- --only=modes,survival     some groups (boot, interchanges, survival, modes, abilities,
//                                         progression, render, phone, launch, store, store-live, venues)
//   npm test -- --slow                    also render the High and Ultra presets (minutes per frame in SwiftShader)
//   SUITE_HANDLING=0.9 npm test -- ...    every group at that handling value: Settings' Arcade is 0.15, Sport 0.5,
//                                         Simulation 0.9 (src/game/settings.ts PROFILES). Without it the suite drives at
//                                         0.35, the value its checks were tuned at (the game's default was 0.35 until
//                                         the profiles; a new player now starts in Arcade)
//
// Software rendering runs at about 10 fps, so distance is covered with fastForward (the simulation without
// rendering) and real frames are used only where rendering is the point. Screenshots go to tests/out/.
// Every group opens a fresh browser context, so each starts with an empty profile.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GAME = process.env.GAME_HTML ? path.resolve(process.env.GAME_HTML) : path.join(ROOT, 'dist', 'top-speed-ultra.html');   // GAME_HTML: test another build
const OUT = path.join(ROOT, 'tests', 'out');
const MPH = 2.236936;
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const slow = process.argv.includes('--slow');
const HANDLING = process.env.SUITE_HANDLING ? Number(process.env.SUITE_HANDLING) : 0.35;
if (!(HANDLING >= 0 && HANDLING <= 1)) { console.error(`SUITE_HANDLING must be 0..1, not ${process.env.SUITE_HANDLING}`); process.exit(2); }
// the driving profiles as Settings names them (the spec the UI is checked against), and what the suite's value reads as
const PROFILE_AT = [['Arcade', 0.15], ['Sport', 0.5], ['Simulation', 0.9]];
const profileName = (h) => PROFILE_AT.find(([, v]) => Math.abs(v - h) < 0.004)?.[0] ?? 'Custom';
console.log(`handling ${HANDLING} (${profileName(HANDLING)})`);

if (!existsSync(GAME)) { console.error(`No build at ${GAME}. Run \`npm run build\` first.`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------------------------------- the harness
const results = [];
const fmt = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
function expect(ok, msg) { if (!ok) throw new Error(msg); }
async function check(name, fn) {
  const t0 = Date.now();
  try {
    const note = (await fn()) ?? '';
    results.push({ name, ok: true, note });
    console.log(`  PASS  ${name}  ${note}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    results.push({ name, ok: false, note: e.message });
    console.log(`  FAIL  ${name}  ${e.message}`);
  }
}

const browser = await chromium.launch({
  // (gc and precise heap numbers: the venues group reads the JS heap after each round trip)
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', '--enable-precise-memory-info'],
});

// how long a page may take to boot to the menu: about 13 s on an idle machine, but other passes' renders and builds
// share these 4 cores, and under that load a boot has taken over 120 s (the boot check prints the real time)
const BOOT_MS = 300000;
// a fresh context (empty storage) with these settings saved, loaded to the main menu
async function open({ settings = {}, phone = false, size = [1280, 720] } = {}) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: size[0], height: size[1] } });
  const base = { quality: 'low', adaptive: false, density: 'moderate', time: 'day', weather: 'clear', handling: HANDLING };
  await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { ...base, ...settings });
  const page = await ctx.newPage();
  // software rendering shares the CPU with other renders and builds here: a click or a screenshot can wait a while
  // for a frame, so actions get four minutes instead of Playwright's 30 s (a check still fails on what it asserts)
  page.setDefaultTimeout(240000);
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => requests.push(r.url()));               // the store group checks test mode sends nothing
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const t0 = Date.now();
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: BOOT_MS });
  const loadS = (Date.now() - t0) / 1000;
  // keep every result the game reports, so checks can read it
  await hook(page);
  return { ctx, page, errors, loadS, requests };
}
const game = (page, fn, arg) => page.evaluate(fn, arg);
// after a page load: keep every result the game reports, so checks can read it; and the stopped-car helper below
async function hook(page) {
  await page.evaluate(() => { const g = window.__game, o = g.ev.over; window.__results = []; g.ev.over = (r) => { window.__results.push(r); o(r); }; });
  await page.evaluate(`window.__stoppedCarAhead = ${stoppedCarAhead.toString()}`);
}
// wait for this many rendered frames. The wait is not what a check asserts, so it gets the same load allowance as
// the boot and the actions above: software rendering shares these 4 cores with other passes, and at a load average of
// 15 to 19 single frames have blocked for 8 to 32 s on SwiftShader (2026-10-17: 5 frames took 35.7, 54.7 and 58.7 s
// in the render group's pause and reset steps, with 10 to 30 ms of the game's own work a frame), so the old 60 s for
// 5 frames failed those checks at random. 240 s is what the context-loss check already allowed for 5 frames.
const FRAMES_MS = 240000;
async function frames(page, n, timeout = FRAMES_MS) {
  const f0 = await game(page, () => window.__game.frames);
  await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout });
}
// start a mode the way a player does: pick it on the menu, tap Drive, wait for the loading screen to go
async function drive(page, label) {
  await page.getByRole('radio', { name: new RegExp(label) }).click();
  await page.getByRole('button', { name: 'Drive', exact: true }).click();
  await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 900000, polling: 500 });
}
async function group(name, fn) {
  if (only.length && !only.includes(name)) return;
  console.log(`\n${name}`);
  const t0 = Date.now();
  let h = null;
  try { await fn((o) => (h = open(o))); } catch (e) { results.push({ name: `${name}: group`, ok: false, note: e.message }); console.log(`  FAIL  ${name} stopped: ${e.message}`); }
  if (h) {
    const { ctx, errors } = await h;
    await check(`${name}: no page errors`, () => { expect(errors.length === 0, errors.slice(0, 3).join(' | ')); });
    await ctx.close();
  }
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// in the page: drive with the autopilot toward a freeway, one simulated second at a time, watching for jumps
function driveToInPage({ target, budget, cruise }) {
  const g = window.__game;
  const from = g.path.label;
  if (!g.navigateTo(target)) return { ok: false, why: 'no route', from };
  let t = 0, jump = 0, wrongS = 0, px = g.phys.x, pz = g.phys.z;
  const routeLen = g.route.length;
  while (t < budget && !(g.path.main && g.path.label === target)) {
    g.fastForward(1, {}, cruise); t++;
    jump = Math.max(jump, Math.hypot(g.phys.x - px, g.phys.z - pz)); px = g.phys.x; pz = g.phys.z;
    if (g.stats.wrongWay) wrongS++;
  }
  const at = `${g.path.label || 'an unlabelled ramp'}${g.path.main ? '' : ' (a ramp)'} at ${(g.phys.s / 1000).toFixed(1)} km, ${Math.round(g.phys.vx * 2.236936)} mph`;
  return { ok: g.path.main && g.path.label === target, from, at, t, jump, wrongS, routeLen, left: g.route.length, collisions: g.collisions };
}

// in the page: a stopped car this far ahead of you in your lane (an existing traffic car, moved and held at 0 m/s by
// its own stop timer; Races and their AI racers were removed on 2026-11-08, and with them Traffic.addRacer)
function stoppedCarAhead(ahead) {
  const g = window.__game, p = g.phys, T = g.traffic;
  T.clearAround(p.x, p.z, 200);
  if (!T.cars.length) T.fill(g.view());
  const car = T.cars.find((c) => Math.hypot(c.x - p.x, c.z - p.z) > 200) ?? T.cars[0];
  if (!car) return null;
  const lane = g.path.laneOf(p.d), s = p.s + ahead, d = g.path.laneCenter(lane), at = g.path.at(s, d);
  Object.assign(car, { path: g.path, s, ps: s, d, pd: d, lane, from: lane, to: lane, t: -1, sig: 0, v: 0, stopT: 1e9, touched: -99, side: 1, x: at.x, z: at.z, y: at.y, h: at.h });
  return car;
}

// in the page: the OC Hypercar checks' helpers (installed once per page). findStraight: a window of `need` metres of a
// freeway whose curvature stays under 1/3000 m. run: the simulation stepped at 120 Hz with the autopilot steering
// (`ctl` overrides what it drives) and the world streaming; each(t) returning false stops early; `viaInput` runs the
// input layer first each step, as a frame does (so THRUST held through `input.setThrust` goes through its hold delay).
// hop: a Thrust Hop asked for with the game running for that one call (it refuses while paused). __toasts: every toast
// shown.
function hyperHelpers() {
  const g = window.__game;
  window.findStraight = (label, need, from = 500) => {
    const m = g.findMain(label); let best = null;
    for (let s0 = from; s0 < m.len - need - 300; s0 += 100) {
      let kmax = 0; for (let s = s0; s < s0 + need; s += 25) kmax = Math.max(kmax, Math.abs(m.sample(s).k));
      if (!best || kmax < best.kmax) best = { label, s0, kmax };
      if (kmax < 1 / 3000) break;
    }
    return best;
  };
  window.run = (secs, ctl = {}, cruise = 0, each = null, viaInput = false) => {
    for (let t = 0; t < secs - 1e-9; t += 1 / 120) {
      if (viaInput) g.input.update(1 / 120, Math.abs(g.phys.vx));
      if (cruise > 0) g.autopilot(g.input.c, cruise);
      Object.assign(g.input.c, ctl);
      g.simulate(1 / 120);
      if (g.steps % 6 === 0) g.stream(1);
      if (each && each(t) === false) break;
    }
  };
  window.hop = () => { g.setPaused(false); const r = g.thrustHop(); g.setPaused(true); return r; };
  // a straight (as findStraight) with no other freeway on its pavement at its level: the I-405 North straight that
  // findStraight picks (34.5-37.15 km) carries CA-22 West on the same centreline, two routes' traffic half a lane apart
  window.findClean = (labels, need) => {
    const buf = [], clear = (m, s0) => {
      for (let s = s0 - 100; s < s0 + need + 100; s += 50) {
        const a = m.at(Math.max(0, s), 0);
        for (const hit of g.net.near(a.x, a.z, 14, buf)) { const q = hit.path; if (q !== m && q.main && hit.s >= 0 && hit.s <= q.len && Math.abs(q.height(hit.s) - a.y) < 2.5 && Math.abs(hit.d) < (q.paveR - q.paveL) / 2 + 1) return false; }
      }
      return true;
    };
    for (const label of labels) {
      const m = g.findMain(label); if (!m) continue;
      for (let s0 = 500; s0 < m.len - need - 500; s0 += 100) {
        let kmax = 0; for (let s = s0; s < s0 + need; s += 25) kmax = Math.max(kmax, Math.abs(m.sample(s).k));
        if (kmax < 1 / 3000 && clear(m, s0)) return { label, s0 };
      }
    }
    return null;
  };
  // a granted hop flown on the autopilot at `v`: every contact from take-off to 1.5 s after touchdown, the steps the car
  // spends over `target` (and its least clearance), whether it got past it, and the road it came down on
  window.fly = (target, v) => {
    const p = g.phys, T = g.traffic, cl = target ? T.classes[target.cls] : null, id0 = g.path.id, col0 = g.collisions, orig = T.collide.bind(T);
    let contacts = 0, air = 0, t = 0, tl = -1, over = 0, clear = 1e9, passed = false;
    T.collide = (view, dt, dtc) => { const n = orig(view, dt, dtc); contacts += n; if (n && p.airborne) air += n; return n; };
    window.run(8, { thrust: 0 }, v, () => {
      t += 1 / 120;
      if (target && p.airborne && Math.abs(target.s - p.s) < cl.len / 2 + 2.36 && Math.abs(target.d - p.d) < cl.wid / 2 + 1.02) { over++; clear = Math.min(clear, p.altitude - cl.height); }
      if (target && p.s - 2.36 > target.s + cl.len / 2) passed = true;
      if (!p.airborne && tl < 0 && t > 0.05) tl = t;
      if (tl >= 0 && t - tl > 1.5) return false;
    });
    T.collide = orig;
    return { contacts, air, hits: g.collisions - col0, same: g.path.id === id0, over, clear, passed };
  };
  window.__toasts = window.__toasts ?? [];
  if (!window.__toastsOn) { const o = g.ev.toast; g.ev.toast = (m, k) => { window.__toasts.push(m); o(m, k); }; window.__toastsOn = true; }
}
// in the page, with Settings open: what the handling field shows (the readout, the pressed and lit profile, the slider)
// and where the value lives (the saved settings and the physics)
function readHandling() {
  const f = document.querySelector('.field.handling'), g = window.__game;
  return {
    out: f.querySelector('output').textContent,
    pressed: [...f.querySelectorAll('.seg button[aria-pressed="true"]')].map((b) => b.textContent),
    buttons: [...f.querySelectorAll('.seg button')].map((b) => b.textContent),
    lit: [...f.querySelectorAll('.profiles .on dt')].map((d) => d.textContent),
    active: f.querySelector('.profiles .on dd')?.textContent ?? '',
    lines: f.querySelectorAll('.profiles dd').length,
    ticks: f.querySelectorAll('.htrack i').length,
    value: Number(f.querySelector('#handling').value),
    settings: g.settings.handling, phys: g.phys.handling,
    saved: JSON.parse(localStorage.getItem('tsu.settings') || '{}').handling,
    sideScroll: document.documentElement.scrollWidth > innerWidth,
  };
}
// start a mode in the OC Hypercar (owner mode for the test, no traffic) and pause it; the tune it latched
const hyperIn = (page, mode) => game(page, async (mode) => {
  const g = window.__game;
  g.updateSettings({ ...g.settings, owner: true, density: 'none' });
  g.chooseOwnerCar('oc-hyper');
  Object.assign(g.input.c, { throttle: 0, brake: 0, steer: 0, thrust: 0 });
  await g.start(mode); g.setPaused(true);
  return { live: g.hyper.live, keys: g.input.thrustLive, car: g.driving, mode: g.mode, grip: g.carGrip };
}, mode);

// ------------------------------------------------------------------------------------------- the groups
await group('boot', async (use) => {
  const { page, loadS } = await use();
  await check('loads to the main menu', () => `menu after ${fmt(loadS)} s`);
  await check('network: ten freeways, both directions', async () => {
    const labels = await game(page, () => window.__game.mainsLabels);
    const routes = new Set(labels.map((l) => l.replace(/ (North|South|East|West)$/, '')));
    expect(labels.length === 20, `${labels.length} carriageways`);
    for (const r of ['I-5', 'I-405', 'CA-22', 'CA-55', 'CA-57', 'CA-73', 'CA-91', 'CA-133', 'CA-241', 'CA-261']) expect(routes.has(r), `missing ${r}`);
    return `${labels.length} carriageways, ${routes.size} routes`;
  });
  // the barrier rules run on the real data: a barrier should never stand in a travel lane. This found ramp-start stubs
  // left in lanes by the lazy wall cache, barriers on ramps passing 2.5-3.5 m overhead, and crash cushions where ramps
  // cut off at the map edge end inside the 91
  const laneScan = () => game(page, () => {
    const net = window.__game.net, found = [], buf = [];
    let n = 0, segs = 0, long = 0;
    for (const m of net.mains) {
      let last = -1e9;                                    // one report per spot
      for (let s = 5; s < m.len - 5; s += 4) for (let lane = 0; lane < m.lanes; lane++) {
        const at = m.at(s, m.laneCenter(lane)); n++;
        for (const w of net.wallsNear(at.x, at.z, at.y, 2, buf)) {
          const vx = w.bx - w.ax, vz = w.bz - w.az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((at.x - w.ax) * vx + (at.z - w.az) * vz) / L2));
          segs++; if (L2 > 9) long++;
          if (Math.hypot(at.x - (w.ax + t * vx), at.z - (w.az + t * vz)) < 1 && s - last > 60) { found.push(`${m.label} ${(s / 1000).toFixed(2)} km lane ${lane}`); last = s; }
        }
      }
    }
    return { n, found, segs, long };
  });
  let first = null;
  await check('no barrier within 1 m of any travel lane, on all 20 carriageways', async () => {
    const r = first = await laneScan();
    expect(r.found.length === 0, `${r.found.length} spots with a barrier in a lane, such as ${r.found.slice(0, 6).join(', ')}`);
    return `${r.n.toLocaleString()} lane points clear`;
  });
  // barriers are worked out lazily, and the first look at a stretch used to hand back segments tens of metres long
  // (a shared buffer overwritten mid-query): the second look, from the cache, must match the first
  await check('barriers come out the same on a first look as on a second', async () => {
    const again = await laneScan();
    expect(first && again.segs === first.segs && again.long === first.long, `first look: ${first?.segs} segments, ${first?.long} over 3 m; second: ${again.segs}, ${again.long}`);
    return `${again.segs.toLocaleString()} segments both times, ${again.long} over 3 m both times`;
  });
  await check('menu credits the map data and has no Controls screen', async () => {
    const text = await page.locator('.overlay.menu').innerText();
    expect(/OpenStreetMap contributors via Overture Maps \(ODbL\)/.test(text), 'no OSM/Overture credit');
    expect(!(await page.getByRole('button', { name: /^Controls$/ }).count()), 'a Controls button is back');
  });
});

await group('interchanges', async (use) => {
  const { page } = await use({ settings: { start: 'I-405 North' } });
  await drive(page, 'Free Drive');
  // the sim is driven by fastForward from here. Free Drive seeds its traffic at random, and in some seeds the
  // autopilot tangles with traffic at the 55/5 interchange (3 of 8 tried), so seed it: every run is the same drive
  await game(page, () => {
    const g = window.__game, m = g.findMain('I-405 North');
    g.setPaused(true);
    g.placeCar(m, m.len * 0.12, 1, 30); g.apLane = 1;
    g.traffic.reseed(3); g.traffic.fill(g.view());
  });
  const legs = [['CA-55 North', 600], ['CA-91 East', 700], ['CA-241 South', 700]];
  for (const [target, budget] of legs) {
    await check(`autopilot drives to ${target}`, async () => {
      const r = await game(page, driveToInPage, { target, budget, cruise: 50 });
      expect(!r.why, `from ${r.from}: ${r.why}`);
      expect(r.ok, `${r.from} → ${r.at} after ${r.t} s, ${r.left} of ${r.routeLen} hand-offs left, ${r.collisions} collisions`);
      expect(r.jump < 95, `jumped ${fmt(r.jump)} m in one second`);
      return `${r.from} → ${r.at} in ${r.t} s sim, ${r.routeLen} hand-offs, largest 1 s move ${fmt(r.jump)} m, wrong-way ${r.wrongS} s`;
    });
  }
  await check('profile counted the freeways and interchanges', async () => {
    const p = await game(page, () => window.__game.profile.p);
    for (const f of ['I-405 North', 'CA-55 North', 'CA-91 East', 'CA-241 South']) expect(p.freeways.includes(f), `${f} not in profile`);
    expect(p.interchanges >= 3, `${p.interchanges} interchanges`);
    return `${p.freeways.length} freeways, ${p.interchanges} interchanges, ${fmt(p.distance / 1609.344)} mi`;
  });
  // the far south of the 5 has no freeway way back north (turnarounds and street exits aren't in the planner), so the
  // route goes blank down there; turned around at the end, the navigator has to plan again from the 5 North
  await check('turned around at the end of the road, the navigator plans again', async () => {
    const r = await game(page, () => {
      const g = window.__game, s5 = g.findMain('I-5 South'), target = g.findMain('CA-55 North');
      g.placeCar(s5, 45000, 1, 30);
      if (!g.navigateTo('CA-55 North')) return { why: 'no route from the 5 South at 45 km' };
      g.placeCar(s5, s5.len - 150, 1, 25);
      const noWay = g.net.route(s5, s5.len - 150, target) === null;
      g.route = [];                                       // as the planner leaves it down here
      let t = 0;
      while (g.path === s5 && t < 30) { g.fastForward(0.5, {}, 25); t += 0.5; }
      return { noWay, t, at: g.path.label, route: g.route.length, target: g.routeTarget?.label, next: g.route[0]?.to.label ?? '' };
    });
    expect(!r.why, r.why);
    expect(r.noWay, 'the 5 South now has a way north near its end; this check needs another dead end');
    expect(r.at === 'I-5 North' && r.route > 0 && r.target === 'CA-55 North', `after ${r.t} s on ${r.at}: ${r.route} hand-offs to ${r.target}`);
    return `turned onto ${r.at} after ${r.t} s; ${r.route} hand-offs to ${r.target} again`;
  });
  // spin onto a road with no way to the destination (here the 261 South, which just ends), then get back on a
  // freeway: the navigator has to pick the destination up again rather than go quiet for the rest of the drive
  await check('navigation survives a road with no way through', async () => {
    const r = await game(page, () => {
      const g = window.__game, dead = g.findMain('CA-261 South'), back = g.findMain('I-405 North'), target = g.findMain('CA-91 East');
      g.placeCar(back, back.len * 0.3, 1, 30);
      if (!g.navigateTo('CA-91 East')) return { why: 'no route from the 405' };
      const before = g.route.length, noWay = g.net.route(dead, 100, target) === null;
      g.enterPath(dead, 100, 0);
      const lost = { route: g.route.length, target: g.routeTarget?.label };
      g.enterPath(back, back.len * 0.3, 0);
      return { before, noWay, lost, after: g.route.length, target: g.routeTarget?.label, next: g.route[0]?.to.label ?? '' };
    });
    expect(!r.why, r.why);
    expect(r.noWay, 'the 261 South has a way to the 91 now; pick another dead end for this check');
    expect(r.lost.route === 0 && r.lost.target === 'CA-91 East', `on the dead end: ${JSON.stringify(r.lost)}`);
    expect(r.after > 0 && r.target === 'CA-91 East', `back on the 405: ${r.after} hand-offs, target ${r.target}`);
    return `${r.before} hand-offs → 0 on the dead end (destination kept) → ${r.after} again, next ${r.next || 'a ramp'}`;
  });
});

await group('survival', async (use) => {
  const { page } = await use({ settings: { density: 'heavy', start: 'I-405 North' } });
  await drive(page, 'Speed Survival');
  // Survival seeds its traffic at random, and the autopilot isn't a perfect driver (it crashed in 2 of 12 seeded
  // two-minute runs in Heavy traffic), so put the car back on its mark and seed the traffic, so every run is the same
  await game(page, () => {
    const g = window.__game, m = g.findMain('I-405 North');
    g.setPaused(true);
    g.placeCar(m, m.len * 0.12, 1, 30); g.apLane = 1;
    g.traffic.reseed(7); g.traffic.fill(g.view());
  });
  await check('streak and score build over 100 mph in heavy traffic', async () => {
    const r = await game(page, () => { const g = window.__game; g.fastForward(45, {}, 52); return { score: g.score, streak: g.streak, best: g.bestStreak, passes: g.overtakes, near: g.nearMisses, over: g.over, top: g.top, h: g.phys.handling, car: g.driving }; });
    expect(r.h === HANDLING, `the run drove at handling ${r.h}, not the suite's ${HANDLING}`);
    expect(!r.over, 'the run ended');
    expect(r.score > 0 && r.best > 5, `score ${fmt(r.score)}, best streak ${fmt(r.best)} s`);
    return `${r.car} at handling ${r.h} (${profileName(r.h)}): score ${Math.round(r.score)}, best streak ${fmt(r.best)} s, ${r.passes} clean passes, ${r.near} near misses, top ${Math.round(r.top * MPH)} mph`;
  });
  await check('streak drops under 100 mph, best streak kept', async () => {
    const r = await game(page, () => {
      const g = window.__game, best = g.bestStreak;
      g.fastForward(8, {}, 28);
      return { v: g.phys.vx, streak: g.streak, best: g.bestStreak, before: best };
    });
    expect(r.v < 100 / MPH && r.streak === 0, `at ${Math.round(r.v * MPH)} mph the streak is ${fmt(r.streak)}`);
    expect(r.best === r.before, `best streak ${r.before} → ${r.best}`);
    return `${Math.round(r.v * MPH)} mph: streak 0, best ${fmt(r.best)} s kept`;
  });
  await check('a car only scores once, even when passed again', async () => {
    const r = await game(page, () => {
      const g = window.__game, T = g.traffic, step = T.step;
      // watch every pass: a car scores when the game marks it (touched = -1) right after its pass event
      let watch = [], scored = 0, repasses = 0;
      T.step = function (...a) {
        for (const c of watch) if (c.touched === -1) scored++;
        watch = [];
        const ps = step.apply(this, a);
        for (const p of ps) { if (p.car.touched === -1) repasses++; else watch.push(p.car); }
        return ps;
      };
      const before = g.overtakes;
      g.fastForward(20, {}, 52);
      // take a car that just scored, drop back behind it, then pass it again
      const p = g.phys, mine = g.traffic.cars.filter((c) => c.touched === -1 && c.path === g.path && c.s < p.s).sort((a, b) => b.s - a.s)[0];
      let back = false, by = false;
      if (mine) {
        for (let t = 0; t < 40 && !back; t += 0.5) { g.fastForward(0.5, {}, 12); back = mine.s - p.s > 25; }
        for (let t = 0; t < 40 && back && !by; t += 0.5) { g.fastForward(0.5, {}, 52); by = p.s - mine.s > 15; }
      }
      g.fastForward(1 / 120, {}, 52);
      T.step = step;
      return { passes: g.overtakes - before, scored, repasses, back, by, mine: mine?.touched, over: g.over };
    });
    expect(!r.over, 'the run ended');
    expect(r.passes >= 1, 'no passes to check');
    expect(r.back && r.by && r.repasses >= 1, `no re-pass to check (fell back ${r.back}, passed again ${r.by}, ${r.repasses} re-passes)`);
    expect(r.passes === r.scored, `${r.passes} passes counted for ${r.scored} newly scored cars`);
    return `${r.passes} passes = ${r.scored} newly scored cars; ${r.repasses} passes of already-scored cars, none counted`;
  });
  await check('ramming a stopped car ends the run and shows the local board', async () => {
    const r = await game(page, () => {
      const g = window.__game, p = g.phys;
      g.fastForward(6, {}, 30);
      const car = window.__stoppedCarAhead(28);
      const v0 = p.vx, wasOver = g.over;
      g.fastForward(3, { throttle: 1, brake: 0, steer: 0 });
      return { over: g.over, wasOver, v0, collisions: g.collisions, car: car.id };
    });
    expect(!r.wasOver && r.v0 > 7, `the run had already ended (${r.wasOver}) or the car was too slow (${fmt(r.v0)} m/s)`);
    expect(r.over, `no crash at ${fmt(r.v0)} m/s`);
    await page.waitForSelector('.result', { timeout: 900000 });
    const text = await page.locator('.result').innerText(), reason = await page.locator('.result h2').innerText();
    expect(/^crashed into/i.test(reason), `reason: ${reason}`);
    expect(/local leaderboard · this device only/i.test(text), 'no "Local leaderboard · this device only" label');
    await page.screenshot({ path: path.join(OUT, 'survival-result.png') });
    return `closing at ${fmt(r.v0)} m/s: "${reason}", board labelled local`;
  });
  await check('traffic is the preview\'s bodies, with a 20 m tractor-trailer semi that spawns in the right lanes', async () => {
    const r = await game(page, () => {
      const n = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
      const g = window.__game, cls = g.traffic.classes.map((c) => ({ id: c.id, len: +c.len.toFixed(1), wid: +c.wid.toFixed(2), wheels: c.wheels.length, trim: !!c.trim, tris: n(c.body), trimTris: n(c.trim) }));
      const meshes = g.traffic.group.children.filter((o) => o.isInstancedMesh).length;
      g.setPaused(true); g.traffic.reseed(7); g.traffic.fill(g.view());
      const semis = g.traffic.cars.filter((c) => g.traffic.classes[c.cls].id === 'semi');
      const lanes = semis.map((c) => [c.lane, c.path.lanes]), right = lanes.filter(([l, n]) => l >= n - 2).length;
      return { cls, meshes, cars: g.traffic.cars.length, semis: semis.length, right, lanes };
    });
    const semi = r.cls.find((c) => c.id === 'semi');
    expect(r.cls.length === 7, `${r.cls.length} classes, not 7`);
    expect(semi && semi.len === 20 && semi.wheels === 10 && semi.trim, `semi class: ${JSON.stringify(semi)}`);
    expect(r.cls.every((c) => c.tris > 400), 'a class has fewer than 400 triangles: ' + r.cls.map((c) => c.id + ':' + c.tris).join(' '));
    // the trim carries the body details (mirrors on stalks, door seams, handles, pillars, arch liners, sills, plates,
    // the third brake light) in the same one instanced mesh per class: seven meshes a class, as before them
    expect(r.cls.every((c) => c.trimTris >= 150), 'a class\'s trim lacks its body details: ' + r.cls.map((c) => c.id + ':' + c.trimTris).join(' '));
    expect(r.meshes === r.cls.length * 7, `${r.meshes} instanced traffic meshes for ${r.cls.length} classes, not ${r.cls.length * 7}`);
    expect(r.semis >= 2, `only ${r.semis} semis in ${r.cars} cars`);
    expect(r.right === r.semis, `${r.semis - r.right} of ${r.semis} semis spawned outside the two right lanes: ${JSON.stringify(r.lanes)}`);
    return `${r.cls.length} classes in ${r.meshes} instanced meshes, trim ${r.cls.map((c) => c.id + ' ' + c.trimTris).join(', ')} triangles; semi ${semi.len} m × ${semi.wid} m with ${semi.wheels} wheels; ${r.semis} of ${r.cars} cars are semis, all in the two right lanes`;
  });
  await check('the door mirrors have their own paint, without the shut lines, and follow the car\'s colour', async () => {
    const r = await game(page, () => {
      const g = window.__game, car = g.car, cfg = car.config, find = (k) => { let m = null; car.body.traverse((o) => { if (!m && o.isMesh && o.name === k) m = o; }); return m; };
      if (cfg.car === 'rossini-corsa') return { corsa: true };               // its mirror pods are carbon
      const paint = find('paint'), mir = find('mirrorPaint');
      if (!paint || !mir) return { found: `paint ${!!paint}, mirrorPaint ${!!mir}` };
      const shut = (m) => m.material.userData.uniforms?.uShutN.value ?? -1, hex = () => [paint.material.color.getHex(), mir.material.color.getHex()];
      const was = cfg.paint, to = was === 0x1d4f9c ? 0xa80d10 : 0x1d4f9c;
      car.configure({ ...cfg, paint: to }); const after = hex();
      car.configure({ ...cfg, paint: was }); const back = hex();
      return { same: paint.material === mir.material, shutPaint: shut(paint), shutMirror: shut(mir), was, to, after, back };
    });
    if (r.corsa) return 'the Corsa: carbon mirror pods';
    expect(!r.found, r.found);
    expect(!r.same, 'the mirrors share the body\'s paint material');
    expect(r.shutPaint > 0 && r.shutMirror === 0, `shut lines: body ${r.shutPaint}, mirrors ${r.shutMirror}`);
    expect(r.after.every((h) => h === r.to) && r.back.every((h) => h === r.was), `repaint ${r.to.toString(16)}: ${r.after.map((h) => h.toString(16))}; back to ${r.was.toString(16)}: ${r.back.map((h) => h.toString(16))}`);
    return `body ${r.shutPaint} shut lines, mirrors none; repainted #${r.to.toString(16)} and back, both followed`;
  });
  // the OC Hypercar in Speed Survival (owner mode for the test): its race tune, never Unleashed in a scored mode, on the
  // first check's mark in the same seeded heavy traffic, at the suite's handling (SUITE_HANDLING runs it per profile).
  // carTop() is the game's flat-out estimate from gearing and drag (the rivals' pace): 234 mph for the race tune, 341
  // for Unleashed
  await check('the OC Hypercar (race tune) builds a streak over 100 mph in the same heavy traffic', async () => {
    const r = await game(page, async () => {
      const g = window.__game;
      g.updateSettings({ ...g.settings, owner: true });
      g.chooseOwnerCar('oc-hyper');
      Object.assign(g.input.c, { throttle: 0, brake: 0, steer: 0, thrust: 0 });
      await g.start('survival'); g.setPaused(true);
      const m = g.findMain('I-405 North');
      g.placeCar(m, m.len * 0.12, 1, 30); g.apLane = 1;
      g.traffic.reseed(7); g.traffic.fill(g.view());
      g.fastForward(45, {}, 52);
      return { car: g.driving, live: g.hyper.live, grip: g.carGrip, carTop: g.carTop(), h: g.phys.handling, score: g.score, best: g.bestStreak, passes: g.overtakes, near: g.nearMisses, over: g.over, top: g.top };
    });
    expect(r.car === 'oc-hyper' && !r.live && r.grip === 1.04 && r.carTop * MPH < 240, `not the race tune: ${JSON.stringify(r)}`);
    expect(r.h === HANDLING, `the run drove at handling ${r.h}, not the suite's ${HANDLING}`);
    expect(!r.over, 'the run ended');
    expect(r.score > 0 && r.best > 5, `score ${fmt(r.score)}, best streak ${fmt(r.best)} s`);
    return `race tune (grip ${r.grip}, the game's flat-out estimate ${Math.round(r.carTop * MPH)} mph) at handling ${r.h} (${profileName(r.h)}): score ${Math.round(r.score)}, best streak ${fmt(r.best)} s, ${r.passes} clean passes, ${r.near} near misses, top ${Math.round(r.top * MPH)} mph`;
  });
});

// Two modes only (owner, 2026-11-08: "lets get rid of these play modes all entirely and only stick to free drive and
// try to stay over 100mph game mode"): Free Drive and Speed Survival. Races and Time Trial are gone, from the menu, the
// phone, the World Map and the code; what an older version saved for them loads as Free Drive and is otherwise ignored.
await group('modes', async (use) => {
  // an earlier visit's saves: the menu's last race course and a mode ('race' on the first load, 'time' on the second),
  // a profile with race wins, Time Trial and race runs on the local board, a Time Trial best and a race best time
  const { page, ctx } = await use({ settings: { mode: 'race', course: 'irvine', density: 'moderate' } });
  // Settings (1280 x 720) names the profile the suite drives at: its button pressed, its line lit, the slider on its value
  await check('Settings at 1280 × 720 shows the handling profile the suite drives at', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const f = page.locator('.field.handling');
    await f.waitFor();
    await f.scrollIntoViewIfNeeded();
    const r = await game(page, readHandling);
    const name = profileName(HANDLING), file = `settings-profiles-1280-${name.toLowerCase()}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    expect(r.value === HANDLING && r.phys === HANDLING, `slider ${r.value}, physics ${r.phys}, suite ${HANDLING}`);
    expect(r.out === `${name} · ${HANDLING.toFixed(2)}` && r.pressed.join() === (name === 'Custom' ? '' : name) && r.lit.join() === name, `reads "${r.out}", pressed ${r.pressed.join()}, lit ${r.lit.join()}`);
    expect(r.lines === (name === 'Custom' ? 4 : 3) && r.ticks === 3 && r.sideScroll === false, `${r.lines} lines, ${r.ticks} ticks, side scroll ${r.sideScroll}`);
    return `"${r.out}", ${name === 'Custom' ? 'no profile pressed, Custom' : name + ' pressed and'} lit, ${r.lines} lines ("${r.active}"), ${file}`;
  });
  const first = await game(page, () => ({ picked: document.querySelector('.modes [aria-checked="true"] .mode-text b')?.textContent, mode: window.__game.mode }));
  await ctx.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('tsu.settings') || '{}'); s.mode = 'time'; localStorage.setItem('tsu.settings', JSON.stringify(s));
    localStorage.setItem('tsu.profile', JSON.stringify({ v: 1, username: 'Earlier', xp: 900, credits: 4200, racesWon: 3, runs: 5, story: { done: ['mara-1'], read: ['mara-1'] } }));
    const run = (mode, score) => ({ mode, score, distance: 4000, top: 120, streak: 0, nearMisses: 0, overtakes: 0, collisions: 0, when: Date.now(), road: 'I-405 North' });
    localStorage.setItem('tsu.runs.v1', JSON.stringify({ time: [run('time', 4000)], race: [run('race', 1500)], survival: [run('survival', 777)] }));
    localStorage.setItem('tsu.best.time', '4000'); localStorage.setItem('tsu.race.irvine', '312.4');
  });
  await page.reload();
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: BOOT_MS });
  await hook(page);
  await check('the menu offers two modes: 01 Free Drive and 02 Speed Survival, nothing else', async () => {
    const r = await game(page, () => ({
      cards: [...document.querySelectorAll('.modes [role="radio"]')].map((b) => [b.querySelector('.mode-text i')?.textContent, b.querySelector('.mode-text b')?.textContent, b.getAttribute('aria-checked')]),
      text: document.querySelector('.overlay.menu')?.innerText ?? '',
    }));
    await page.screenshot({ path: path.join(OUT, 'modes-menu.png') });
    expect(JSON.stringify(r.cards.map((c) => c.slice(0, 2))) === JSON.stringify([['01', 'Free Drive'], ['02', 'Speed Survival']]), `cards: ${JSON.stringify(r.cards)}`);
    expect(!/\bRaces?\b|Time Trial|rivals/i.test(r.text), `the menu still says: ${(/.{0,40}(\bRaces?\b|Time Trial|rivals).{0,40}/i.exec(r.text) ?? [''])[0]}`);
    return r.cards.map((c) => `${c[0]} ${c[1]}`).join(', ');
  });
  await check('a saved mode "race" or "time" loads as Free Drive; the old race data is ignored', async () => {
    const r = await game(page, async () => {
      const g = window.__game, picked = document.querySelector('.modes [aria-checked="true"] .mode-text b')?.textContent;
      const p = g.profile.p, out = { picked, settingsMode: 'mode' in g.settings, course: 'course' in g.settings, racesWon: 'racesWon' in p, credits: p.credits, done: p.story.done };
      // the Personal bests panel: Speed Survival and Free Drive only (the old Time Trial and race runs aren't shown)
      document.querySelectorAll('.dock button').forEach((b) => { if (/Bests/.test(b.textContent)) b.click(); });
      await new Promise((res) => setTimeout(res, 500));
      out.board = [...document.querySelectorAll('.sheet-body .panel .seg button')].map((b) => b.textContent);
      out.boardRuns = [...document.querySelectorAll('.sheet-body .board li b')].map((b) => b.textContent);
      document.querySelectorAll('.dock button').forEach((b) => { if (/Bests/.test(b.textContent)) b.click(); });
      return out;
    });
    expect(first.picked === 'Free Drive' && first.mode === 'free', `saved "race": picked ${first.picked}, game mode ${first.mode}`);
    expect(r.picked === 'Free Drive' && !r.settingsMode && !r.course, `saved "time": picked ${r.picked}, settings.mode ${r.settingsMode}, settings.course ${r.course}`);
    expect(!r.racesWon && r.credits === 4200 && r.done.includes('mara-1'), `profile: racesWon kept ${r.racesWon}, credits ${r.credits}, story ${r.done}`);
    expect(JSON.stringify(r.board) === JSON.stringify(['Speed Survival', 'Free Drive']), `bests tabs ${JSON.stringify(r.board)}`);
    return `saved "race" and "time" both open on ${r.picked}; settings drop mode and course; profile drops racesWon, keeps 4,200 credits and the story; bests tabs ${r.board.join(' / ')} (${r.boardRuns.join(', ') || 'no runs'})`;
  });
  await check('start("race") and start("time") from an older caller run Free Drive', async () => {
    const r = await game(page, async () => {
      const g = window.__game, modes = [];
      for (const m of ['race', 'time']) { await g.start(m); g.setPaused(true); modes.push([g.mode, g.inAttract, typeof g.race]); }
      g.quitToMenu();
      return modes;
    });
    expect(r.every(([m, a, race]) => m === 'free' && !a && race === 'undefined'), JSON.stringify(r));
    return r.map(([m]) => m).join(', ');
  });
  await check('the phone and the World Map have no Races', async () => {
    await page.getByRole('button', { name: /^Phone/ }).click();
    const apps = await page.locator('.ph-app').allInnerTexts();
    await page.locator('.ph-home').click();
    await page.getByRole('button', { name: 'World Map', exact: true }).click();
    await page.waitForSelector('.worldmap canvas');
    const tabs = await page.locator('.wm-tabs button').allInnerTexts();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    const names = apps.map((a) => a.replace(/\s+\d+$/, '').trim());
    expect(!names.some((a) => /Races?/.test(a)) && JSON.stringify(tabs) === JSON.stringify(['Freeways', 'Places']), `phone apps ${names.join(', ')}; map tabs ${tabs.join(', ')}`);
    return `phone: ${names.join(', ')}; map tabs: ${tabs.join(', ')}`;
  });
  await check('Speed Survival starts, scores above 100 mph, and one real crash ends it', async () => {
    await drive(page, 'Speed Survival');
    const r = await game(page, () => {
      const g = window.__game, m = g.findMain('I-405 North');
      g.setPaused(true);
      g.placeCar(m, m.len * 0.12, 1, 30); g.apLane = 1;
      g.traffic.reseed(7); g.traffic.fill(g.view());
      g.fastForward(20, {}, 52);
      const run = { mode: g.mode, score: g.score, streak: g.streak, v: g.phys.vx, over: g.over };
      let seen = null; const o = g.ev.hud; g.ev.hud = (h) => { seen = h; o(h); }; g.sendHud(); g.ev.hud = o;
      run.hud = { mode: seen.mode, streak: seen.streak, score: seen.score };
      window.__stoppedCarAhead(28);
      const v0 = g.phys.vx;
      g.fastForward(3, { throttle: 1, brake: 0, steer: 0 });
      return { ...run, v0, overAfter: g.over };
    });
    expect(r.mode === 'survival' && !r.over, `mode ${r.mode}, over ${r.over}`);
    expect(r.v * MPH > 100 && r.streak > 3 && r.score > 0 && r.hud.streak > 3, `at ${Math.round(r.v * MPH)} mph: streak ${fmt(r.streak)} s, score ${Math.round(r.score)}, HUD streak ${fmt(r.hud.streak)}`);
    expect(r.overAfter, `no crash at ${fmt(r.v0)} m/s`);
    await page.waitForSelector('.result', { timeout: 10000 });
    const reason = await page.locator('.result h2').innerText(), eyebrow = await page.locator('.result .eyebrow').first().innerText();
    await page.screenshot({ path: path.join(OUT, 'modes-survival-crash.png') });
    expect(/^crashed into/i.test(reason) && /Speed Survival/i.test(eyebrow), `"${eyebrow}": "${reason}"`);
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.waitForSelector('.overlay.menu');
    return `${Math.round(r.v * MPH)} mph, streak ${fmt(r.streak)} s, score ${Math.round(r.score)}; then "${reason}" at ${fmt(r.v0 * MPH)} mph`;
  });
  // Auto-drive is a driving aid, never a score cheat (owner, 2026-11-01): the scored mode doesn't offer it
  await check('Auto-drive: not offered in Speed Survival, even with a route set', async () => {
    const r = await game(page, async () => {
      const g = window.__game;
      await g.start('survival'); g.setPaused(true);
      const routed = g.navigateTo('CA-55 North');
      const offered = g.autoDriveOffered, took = g.setAutoDrive(true);
      g.fastForward(2, { throttle: 0.5, steer: 0, brake: 0 });
      let seen = null; const o = g.ev.hud; g.ev.hud = (h) => { seen = h; o(h); }; g.sendHud(); g.ev.hud = o;
      const out = { mode: g.mode, routed, offered, took, on: g.autoDriving, hudOffer: seen.autoOffer };
      g.quitToMenu();
      return out;
    });
    expect(r.mode === 'survival' && !r.offered && !r.took && !r.on && !r.hudOffer, JSON.stringify(r));
    return `survival with a route (${r.routed ? 'set' : 'none'}): offered ${r.offered}, setAutoDrive ${r.took}, HUD offer ${r.hudOffer}`;
  });
  // the hypercar's two tunes: Unleashed in Free Drive, its race tune (the scored one) in Speed Survival
  await check('the hypercar: Unleashed in Free Drive, its race tune in Speed Survival', async () => {
    const r = await game(page, async () => {
      const g = window.__game, s = { ...g.settings, owner: true };
      g.updateSettings(s); g.chooseOwnerCar('oc-hyper');
      const out = {};
      for (const m of ['free', 'survival']) { await g.start(m); g.setPaused(true); out[m] = { car: g.carId, top: Math.round(g.carTop() * 2.236936) }; }
      g.quitToMenu();
      g.chooseOwnerCar('rossini-gt'); g.updateSettings({ ...g.settings, owner: false });
      return out;
    });
    expect(r.free.car === 'oc-hyper' && r.survival.car === 'oc-hyper' && r.free.top > r.survival.top + 20 && r.survival.top <= 240, JSON.stringify(r));
    return `flat out: Free Drive ${r.free.top} mph (Unleashed), Speed Survival ${r.survival.top} mph (race tune)`;
  });
});

await group('abilities', async (use) => {
  const { page } = await use({ settings: { density: 'heavy', driver: 'closer' } });
  await drive(page, 'Free Drive');
  await game(page, () => { const g = window.__game; g.setPaused(true); g.fastForward(6, {}, 40); });
  // fire the ability with the game running for that one call, then pause again (useAbility refuses while paused)
  const fire = () => game(page, () => { const g = window.__game; g.setPaused(false); const ok = g.useAbility(); g.setPaused(true); return ok; });
  await check('Clear Path thins traffic out of sight only, then ends', async () => {
    const before = await game(page, () => {
      const g = window.__game, p = g.phys, fx = Math.sin(p.psi), fz = Math.cos(p.psi), far = g.traffic.viewAhead * 0.8;
      const seen = g.traffic.cars.filter((c) => { const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz); return d < 40 || (d < far && (dx * fx + dz * fz) / Math.max(1, d) > 0.5); });
      return { all: g.traffic.cars.length, seen: seen.map((c) => c.id) };
    });
    expect(await fire(), 'Clear Path did not fire');
    const during = await game(page, (seen) => { const g = window.__game, ids = new Set(g.traffic.cars.map((c) => c.id)); return { all: g.traffic.cars.length, kept: seen.filter((i) => ids.has(i)).length, scale: g.traffic.scale }; }, before.seen);
    expect(during.kept === before.seen.length, `${before.seen.length - during.kept} cars in view vanished`);
    expect(during.all < before.all && during.scale === 0.65, `${before.all} → ${during.all} cars, scale ${during.scale}`);
    const after = await game(page, () => { const g = window.__game; g.fastForward(g.ability.def.duration + 0.2, {}, 40); return { scale: g.traffic.scale, again: g.ability.ready }; });
    expect(after.scale === 1 && !after.again, `after: scale ${after.scale}, ready again ${after.again}`);
    expect(!(await fire()), 'fired again during the cooldown');
    return `${before.all} → ${during.all} cars; all ${before.seen.length} in view kept; scale 0.65 → ${after.scale}; cooldown blocks a refire`;
  });
  await check('Focus Time slows the world to 0.70×, then ends', async () => {
    await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, driver: 'ace' }); });
    expect(await fire(), 'Focus Time did not fire');
    const r = await game(page, () => { const g = window.__game, during = g.worldScale; g.fastForward(g.ability.def.duration + 0.2, {}, 40); return { during, after: g.worldScale, name: g.ability.def.name }; });
    expect(r.name === 'Focus Time' && r.during === 0.7 && r.after === 1, JSON.stringify(r));
    return `world ${r.during}× during, ${r.after}× after`;
  });
  await check('Locked In multiplies grip by 1.3, then ends', async () => {
    await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, driver: 'wrench' }); });
    expect(await fire(), 'Locked In did not fire');
    const r = await game(page, () => {
      const g = window.__game; g.fastForward(0.1, {}, 40);
      const during = g.phys.grip / (g.env.grip * g.carGrip);
      g.fastForward(g.ability.def.duration + 0.2, {}, 40);
      return { during, after: g.phys.grip / (g.env.grip * g.carGrip), name: g.ability.def.name };
    });
    expect(r.name === 'Locked In' && Math.abs(r.during - 1.3) < 1e-6 && Math.abs(r.after - 1) < 1e-6, JSON.stringify(r));
    return `grip ×${fmt(r.during)} during, ×${fmt(r.after)} after`;
  });
  // ---- the OC Hypercar's own ability (PROJECT_OC_HYPERCAR.md §6): Cold Thrust (hold THRUST), Ground Lock (the fans,
  // automatic) and Thrust Hop (double-tap THRUST), part of its Unleashed tune in Free Drive only. Owner mode puts the
  // car in the garage for the test; nothing is bought.
  await game(page, hyperHelpers);
  await check('OC Hypercar: THRUST comes with its Unleashed tune in Free Drive, and with no other car', async () => {
    const before = await game(page, () => { const g = window.__game; return { car: g.driving, live: g.hyper.live, keys: g.input.thrustLive, btn: !document.querySelector('.hud-thrustbtn')?.hidden }; });
    const r = await hyperIn(page, 'free');
    await page.waitForFunction(() => { const b = document.querySelector('.hud-thrustbtn'); return b && !b.hidden && [...document.querySelectorAll('.hud-chips i')].map((e) => e.textContent).find((t) => t === 'Unleashed' || t === 'Race tune'); }, null, { timeout: 900000, polling: 500 });
    const dom = await game(page, () => ({ btn: !document.querySelector('.hud-thrustbtn').hidden, panel: !document.querySelector('.hud-thrust').hidden, chip: [...document.querySelectorAll('.hud-chips i')].map((e) => e.textContent).find((t) => t === 'Unleashed' || t === 'Race tune'), aria: document.querySelector('.hud-thrustbtn').getAttribute('aria-label') }));
    expect(before.car !== 'oc-hyper' && !before.live && !before.keys && !before.btn, `the ${before.car}: live ${before.live}, keys ${before.keys}, button ${before.btn}`);
    expect(r.live && r.keys && r.car === 'oc-hyper' && r.mode === 'free' && r.grip === 1.3, JSON.stringify(r));
    expect(dom.btn && dom.panel && dom.chip === 'Unleashed', JSON.stringify(dom));
    return `the ${before.car}: none; the OC Hypercar in Free Drive: live, grip ${r.grip}, chip "${dom.chip}", button "${dom.aria}"`;
  });
  await check('Cold Thrust: 0-60 in 0.8 s with THRUST held on the real key, at least 0.4 s quicker than on its tyres and fans', async () => {
    const r = await game(page, () => {
      const g = window.__game, st = window.findStraight('I-405 North', 900), m = g.findMain(st.label), out = {};
      // tyres only (the ability off), Ground Lock only (THRUST not held), THRUST held as the controls set it, and
      // THRUST held on Left Shift through the input layer (input.setThrust + input.update each step, as a frame runs them)
      for (const [k, live, thrust, key] of [['tyres', false, 0, false], ['lock', true, 0, false], ['thrust', true, 1, false], ['key', true, null, true]]) {
        g.setHyper(live); g.placeCar(m, st.s0 + 50, 1, 0); g.apLane = 1;
        if (key) { g.input.clear(); g.input.setThrust('key', true); }
        let t = 0, t60 = -1, peak = 0, v0 = 0;
        window.run(4, thrust === null ? { throttle: 1, brake: 0 } : { throttle: 1, brake: 0, thrust }, 200, () => {
          t += 1 / 120; peak = Math.max(peak, ((g.phys.vx - v0) * 120) / 9.81); v0 = g.phys.vx;
          if (g.phys.vx >= 26.8224) { t60 = t; return false; }
        }, key);
        if (key) { g.input.setThrust('key', false); g.input.update(1 / 120, 0); }
        out[k] = { t60: +t60.toFixed(3), peak: +peak.toFixed(2), tank: +g.hyper.tank.toFixed(3) };
      }
      // on the move the hold delay is back (it tells a hold from a double-tap's first press): pressed at 10 m/s, how
      // long until the controls say THRUST
      g.setHyper(true); g.placeCar(m, st.s0 + 50, 1, 10); g.apLane = 1; g.input.clear(); g.input.setThrust('key', true);
      let wait = -1, tt = 0;
      window.run(0.5, { throttle: 0.3, brake: 0 }, 0, () => { tt += 1 / 120; if (g.input.c.thrust === 1) { wait = tt; return false; } }, true);
      g.input.setThrust('key', false); g.input.update(1 / 120, 0); g.input.clear(); g.input.takeActions();
      out.rollingWait = +wait.toFixed(3);
      g.setHyper(true);
      return out;
    });
    expect(r.key.t60 > 0 && r.key.t60 <= 0.8 && r.thrust.t60 > 0 && r.thrust.t60 <= 0.8, `0-60 with THRUST: ${r.key.t60} s on the key, ${r.thrust.t60} s set directly`);
    expect(r.lock.t60 - r.key.t60 >= 0.4 && r.tyres.t60 > r.lock.t60, `0-60: tyres ${r.tyres.t60} s, fans ${r.lock.t60} s, THRUST ${r.key.t60} s`);
    // the fans spin up for a hard launch and cost a few % (the compressor pauses while they run); THRUST costs far more
    expect(r.key.peak >= 3 && r.tyres.tank === 1 && r.lock.tank < 1 && r.lock.tank > 0.9 && r.key.tank < r.lock.tank - 0.05, `peak ${r.key.peak} g, tank ${r.tyres.tank} / ${r.lock.tank} / ${r.key.tank}`);
    expect(r.rollingWait >= 0.115 && r.rollingWait <= 0.14, `pressed at 10 m/s: THRUST after ${r.rollingWait} s`);
    return `0-60: ${r.tyres.t60} s on its tyres, ${r.lock.t60} s with Ground Lock, ${r.key.t60} s with THRUST held on Left Shift (${r.thrust.t60} s set directly; peak ${r.key.peak} g; tank left ${Math.round(r.lock.tank * 100)} % after the fans' launch, ${Math.round(r.key.tank * 100)} % after THRUST's); pressed at 10 m/s it opens after ${r.rollingWait} s`;
  });
  await check('Cold Thrust: a full tank is about 6 s, refills 1/12 a second driving and 1/6 braking, never stopped, opens at 10 %', async () => {
    const r = await game(page, () => {
      const g = window.__game, st = window.findStraight('I-405 North', 900), m = g.findMain(st.label), p = g.phys, h = g.hyper;
      g.setHyper(true); g.placeCar(m, st.s0 + 50, 1, 40); g.apLane = 1;
      let open = 0, shut = -1;
      window.run(8, { throttle: 0.4, brake: 0, thrust: 1 }, 0, (t) => { if (h.thrust > 0.5) open += 1 / 120; else if (open > 1 && shut < 0) { shut = t; return false; } });
      const left = h.tank;
      g.placeCar(m, st.s0 + 50, 1, 30); h.tank = 0.5;
      window.run(3, { thrust: 0 }, 30);
      const cruise = h.tank;
      g.placeCar(m, st.s0 + 50, 1, 60); h.tank = 0.5;
      window.run(1, { throttle: 0, brake: 0.4, thrust: 0 }, 0);
      const braking = h.tank;
      g.placeCar(m, st.s0 + 50, 1, 0); h.tank = 0.5;
      window.run(2, { throttle: 0, brake: 0, thrust: 0 }, 0);
      const stopped = h.tank;
      g.placeCar(m, st.s0 + 50, 1, 0); h.tank = 0.08;
      window.run(0.5, { throttle: 0, brake: 0, thrust: 1 }, 0);
      const low = { tank: h.tank, thrust: h.thrust, fx: p.ext.fx };
      g.setHyper(true);
      return { open, left, cruise, braking, stopped, low };
    });
    expect(Math.abs(r.open - 6) < 0.35 && r.left < 0.02, `the valve open ${fmt(r.open)} s, ${fmt(r.left * 100)} % left`);
    expect(Math.abs(r.cruise - 0.75) < 0.03 && Math.abs(r.braking - (0.5 + 1 / 6)) < 0.02 && r.stopped === 0.5, `50 % → ${fmt(r.cruise * 100)} % after 3 s driving, ${fmt(r.braking * 100)} % after 1 s braking, ${fmt(r.stopped * 100)} % after 2 s stopped`);
    expect(r.low.thrust === 0 && r.low.fx === 0 && r.low.tank === 0.08, `at 8 %: thrust ${r.low.thrust}, force ${r.low.fx} N`);
    return `full tank ${fmt(r.open)} s; from 50 %: ${fmt(r.cruise * 100)} % after 3 s driving, ${fmt(r.braking * 100)} % after 1 s braking, ${r.stopped * 100} % stopped; at 8 % the valve stays shut`;
  });
  await check('Cold Thrust: a tank of THRUST lifts the top speed', async () => {
    const r = await game(page, () => {
      const g = window.__game, st = window.findStraight('I-405 North', 2600), m = g.findMain(st.label), p = g.phys;
      g.setHyper(true); g.placeCar(m, st.s0 + 20, 1, 150); g.apLane = 1;
      window.run(4, { throttle: 1, brake: 0, thrust: 0 }, 200);
      const flat = p.vx; let peak = 0;
      window.run(7, { throttle: 1, brake: 0, thrust: 1 }, 200, () => { peak = Math.max(peak, p.vx); });
      return { flat: flat * 2.236936, peak: peak * 2.236936, walls: g.collisions, tank: g.hyper.tank };
    });
    expect(r.flat > 320 && r.peak - r.flat >= 3, `flat out ${fmt(r.flat)} mph, with THRUST ${fmt(r.peak)} mph`);
    return `flat out ${fmt(r.flat)} mph, ${fmt(r.peak)} mph on a tank of THRUST`;
  });
  await check('Ground Lock: about 2 g at 25 m/s, and at 40 m/s in Simulation, more than the tyres alone, and it costs tank', async () => {
    const r = await game(page, () => {
      const g = window.__game, Phys = g.phys.constructor, PathC = g.path.constructor, Hyp = g.hyper.constructor;
      const N = 301, cc = new Float64Array(N * 3); for (let i = 0; i < N; i++) cc[i * 3 + 1] = i * 100;
      const road = new PathC(1, 'm', 4, cc), net = { wallsNear(x, z, y, r, out) { out.length = 0; } };
      // the dynamics harness's method: a steering sweep, 4 s at a held speed, the mean |ay| over the last 2 s, counted only
      // with the sideslip under 0.12 rad and the speed within 8 %
      const one = (v0, steer, live, h = 0.35) => {
        const p = new Phys(), H = new Hyp(), c = { throttle: 0, brake: 0, steer: 0, handbrake: false, lookBack: false, lookYaw: 0, lookPitch: 0, analog: true, thrust: 0 };
        p.handling = h; p.grip = g.carGrip; p.auto = true; H.reset(live);
        p.placeAt(road, 500, road.laneCenter(1), v0);
        let sum = 0, n = 0, beta = 0, vMin = 1e9, vMax = 0, fan = 0;
        for (let t = 0; t < 4; t += 1 / 120) {
          c.steer = steer; c.throttle = Math.max(0, Math.min(1, 0.3 + (v0 - p.vx) * 0.5)); c.brake = Math.max(0, Math.min(1, (p.vx - v0 - 0.3) * 0.4));
          H.step(1 / 120, p, c, true); p.step(1 / 120, c, road, net);
          if (t >= 2) { sum += Math.abs(p.ay); n++; beta = Math.max(beta, Math.abs(Math.atan2(p.vy, Math.max(1, p.vx)))); vMin = Math.min(vMin, p.vx); vMax = Math.max(vMax, p.vx); fan += H.fan; }
        }
        return { ok: beta < 0.12 && vMin > v0 * 0.92 && vMax < v0 * 1.08, g: sum / n / 9.81, fan: fan / n, tank: H.tank };
      };
      const best = (v0, live, h = 0.35) => {
        const sweep = [0.02, 0.035, 0.05, 0.07, 0.09, 0.12, 0.15, 0.19, 0.24, 0.3, 0.38, 0.47, 0.58, 0.7, 0.85, 1.0];
        let b = { g: 0, steer: 0, fan: 0, tank: 1 };
        for (const st of sweep) { const x = one(v0, st, live, h); if (x.ok && x.g > b.g) b = { ...x, steer: st }; }
        return b;
      };
      return { off25: best(25, false), on25: best(25, true), off40: best(40, false), on40: best(40, true), simOff40: best(40, false, 1), simOn40: best(40, true, 1) };
    });
    expect(r.on25.g >= 1.85 && r.on25.g - r.off25.g >= 0.3 && r.on25.fan > 0.9, `25 m/s: ${fmt(r.off25.g)} g → ${fmt(r.on25.g)} g (fans ${fmt(r.on25.fan)})`);
    expect(r.on40.g - r.off40.g >= 0.15 && r.simOn40.g >= 1.9 && r.simOn40.g - r.simOff40.g >= 0.3, `40 m/s: ${fmt(r.off40.g)} g → ${fmt(r.on40.g)} g (Arcade), ${fmt(r.simOff40.g)} g → ${fmt(r.simOn40.g)} g (Simulation)`);
    expect(r.on25.tank < 0.99 && r.off25.tank === 1, `tank after 4 s cornering: ${fmt(r.on25.tank * 100)} %`);
    return `lateral g at 25 m/s ${fmt(r.off25.g)} → ${fmt(r.on25.g)}, at 40 m/s ${fmt(r.off40.g)} → ${fmt(r.on40.g)} (Arcade), ${fmt(r.simOff40.g)} → ${fmt(r.simOn40.g)} (Simulation); 4 s of it costs ${fmt((1 - r.on25.tank) * 100)} % of the tank`;
  });
  await check('Thrust Hop at 60, 120 and 200 mph: lands on the road it left, in its lane, no spin, the springs and the camera dip', async () => {
    const r = await game(page, () => {
      const g = window.__game, st = window.findStraight('I-405 North', 1500), m = g.findMain(st.label), p = g.phys, out = [];
      for (const mph of [60, 120, 200]) {
        const v = mph / 2.236936;
        g.setHyper(true); g.placeCar(m, st.s0 + 40, 1, v); g.apLane = 1;
        window.run(1, { thrust: 0 }, v);
        const id0 = g.path.id, d0 = p.d, before = g.hopLog.n, col0 = g.collisions;
        const res = window.hop();
        let apex = 0, air = 0, landed = -1, slip = 0, dMin = 1e9, dMax = -1e9, t = 0, sus = 0, dip = 0;
        window.run(5, { thrust: 0 }, v, () => {
          t += 1 / 120;
          g.car.update(1 / 120, 1, p, false, g.time, g.path);          // the body's springs, as a rendered frame runs them
          if (p.airborne) { air += 1 / 120; apex = Math.max(apex, p.altitude); }
          else if (landed < 0 && g.hopLog.n > before) landed = t;
          if (landed >= 0) { sus = Math.min(sus, g.car.sus.h); dip = Math.max(dip, g.dip.a); slip = Math.max(slip, Math.abs(p.drift.angle)); dMin = Math.min(dMin, p.d); dMax = Math.max(dMax, p.d); if (t - landed > 2.5) return false; }
        });
        const lane = m.laneCenter(1);
        out.push({ mph, res, apex: +apex.toFixed(2), air: +air.toFixed(2), same: g.path.id === id0, inLane: Math.abs(dMin - lane) < 1.6 && Math.abs(dMax - lane) < 1.6, dHeld: +(dMax - d0).toFixed(2), slip: +slip.toFixed(2), sus: +(-sus).toFixed(3), dip: +dip.toFixed(3), landMph: Math.round(g.hopLog.landMph), hits: g.collisions - col0 });
      }
      return out;
    });
    for (const l of r) {
      expect(l.res === 'ok' && Math.abs(l.apex - 1.5) < 0.05 && l.air > 0.9, `${l.mph} mph: ${l.res}, apex ${l.apex} m, ${l.air} s up`);
      expect(l.same && l.inLane && l.slip < 5 && l.hits === 0, `${l.mph} mph landing: same road ${l.same}, in lane ${l.inLane}, slip ${l.slip}°, ${l.hits} hits`);
      expect(l.sus > 0.01 && l.dip > 0.02, `${l.mph} mph landing: springs ${l.sus} m, camera dip ${l.dip} m`);
    }
    return r.map((l) => `${l.mph} mph: apex ${l.apex} m, ${l.air} s up, landed at ${l.landMph} mph, slip ${l.slip}°, springs ${l.sus} m, dip ${l.dip} m`).join('; ');
  });
  await check('Thrust Hop clears a parked sedan and a moving semi in heavy traffic: no contact, the same road', async () => {
    const parked = await game(page, () => {
      const g = window.__game, m = g.findMain('I-405 North'), p = g.phys;
      g.setHyper(true); g.placeCar(m, 3000, 1, 25); g.apLane = 1; g.traffic.clearAround(p.x, p.z, 300);
      const car = g.traffic.addRacer(m, 3030, 1, 'Parked', 0x777777, 0, 0, 3000);
      car.cls = g.traffic.classes.findIndex((c) => c.id === 'sedan');      // a parked sedan, held at 0 m/s
      const id0 = g.path.id, col0 = g.collisions, res = window.hop();
      window.run(3, { throttle: 0.3, thrust: 0 }, 0);
      const out = { res, over: g.hopLog.over, peak: +g.hopLog.peak.toFixed(2), apex: +g.hopLog.apex.toFixed(2), roof: g.traffic.classes[car.cls].height, hits: g.collisions - col0, passed: p.s > car.s + 5, same: g.path.id === id0 };
      g.traffic.removeRacers();
      return out;
    });
    const semi = await game(page, () => {
      const g = window.__game, st = window.findStraight('I-405 North', 900), m = g.findMain(st.label), p = g.phys, T = g.traffic;
      g.updateSettings({ ...g.settings, density: 'heavy' });
      let refused = 0;
      // seeded heavy traffic: the first semi ahead (over a few seeds) that leaves room to land past it
      for (let seed = 11; seed < 31; seed++) {
        g.setHyper(true); g.placeCar(m, st.s0, 1, 30); g.apLane = 1;
        T.reseed(seed); T.fill(g.view());
        const semis = T.cars.filter((c) => T.classes[c.cls].id === 'semi' && c.path === m && c.s > p.s + 80 && !g.structureOver(m, c.s - 80, c.d, 260)).sort((a, b) => a.s - b.s);
        for (const s of semis.slice(0, 6)) {
          const cl = T.classes[s.cls], lane = m.laneOf(s.d);
          // nothing between you and it, on any carriageway that shares these lanes
          T.cars = T.cars.filter((c) => { if (c === s || Math.abs(c.y - s.y) > 2.5) return true; const pr = m.project(c.x, c.z, s.s); return pr.s < s.s - 120 || pr.s > s.s - 12 || Math.abs(pr.d - s.d) > 40; });
          const v = s.v + 40;
          g.placeCar(m, s.s - 52, lane, v); g.apLane = lane; g.hyper.tank = 1;
          const id0 = g.path.id, col0 = g.collisions, orig = T.collide.bind(T);
          let contacts = 0;
          T.collide = (view, dt, dtc) => { const n = orig(view, dt, dtc); contacts += n; return n; };
          const res = window.hop();
          if (res !== 'ok' || g.hopLog.over !== 'semi') { T.collide = orig; refused++; continue; }
          // over it, then down: the driver backs off on landing (lifts and brakes) in the traffic beyond, and every
          // contact until 2 s after touching down counts
          let clear = 1e9, over = 0, passed = false, t = 0, landed = -1;
          const ctl = { thrust: 0 };
          window.run(6, ctl, v, () => {
            t += 1 / 120;
            if (Math.abs(s.s - p.s) < cl.len / 2 + 2.36 && Math.abs(s.d - p.d) < cl.wid / 2 + 1.02) { over++; clear = Math.min(clear, p.altitude - cl.height); }
            if (p.s - 2.36 > s.s + cl.len / 2) passed = true;
            if (!p.airborne && landed < 0 && t > 0.05) { landed = t; ctl.throttle = 0; ctl.brake = 0.6; }
            if (landed >= 0 && t - landed > 2) return false;
          });
          T.collide = orig;
          g.updateSettings({ ...g.settings, density: 'none' });
          return { seed, refused, roof: cl.height, closing: 40, peak: +g.hopLog.peak.toFixed(2), air: +g.hopLog.air.toFixed(2), over, clear: +clear.toFixed(2), passed, contacts, hits: g.collisions - col0, same: g.path.id === id0, cars: T.cars.length };
        }
      }
      g.updateSettings({ ...g.settings, density: 'none' });
      return { refused, none: true };
    });
    expect(parked.res === 'ok' && parked.over === 'sedan' && parked.passed && parked.hits === 0 && parked.same && parked.apex > parked.roof + 0.3, `parked sedan: ${JSON.stringify(parked)}`);
    expect(!semi.none, `every semi in ${semi.refused} tries refused`);
    expect(semi.passed && semi.over > 0 && semi.clear > 0.3 && semi.contacts === 0 && semi.hits === 0 && semi.same, `semi: ${JSON.stringify(semi)}`);
    return `parked sedan (roof ${parked.roof} m): apex ${parked.apex} m, passed, 0 hits; semi (roof ${semi.roof} m, closing ${semi.closing} m/s, seed ${semi.seed}, ${semi.cars} cars, after ${semi.refused} semis refused): peak ${semi.peak} m, ${semi.air} s up, ${semi.over} steps over it with ${semi.clear} m to spare, 0 contacts, same road`;
  });
  // availability in natural traffic (the M5 play review, 2026-11-09): the judge lined the car up 50 m behind each vehicle
  // ahead at +30 m/s in moderate traffic and 11 of 73 double-taps were granted (the planner wanted 1.5 s of empty lane
  // past the touchdown and planned every vehicle at the traffic's extremes). Untouched seeded traffic on a straight with
  // no other freeway on its pavement; a vehicle counts when nothing from any road reaches into its lane between it and
  // the car, and nothing stands over the hop's track (structures refuse it by design, counted apart in the result).
  await check('Thrust Hop in natural traffic: lined up behind a vehicle at +30 m/s (and a sedan at +15 m/s from 15 m), most double-taps go over it with 0 contacts on the same road; casual double-taps at 55 m/s granted', async () => {
    const r = await game(page, () => {
      const g = window.__game, p = g.phys, h = g.hyper, T = g.traffic, st = window.findClean(['I-5 North', 'I-405 South', 'I-5 South', 'I-405 North'], 2500);
      if (!st) return { none: true };
      const m = g.findMain(st.label), out = { site: `${st.label} from ${(st.s0 / 1000).toFixed(1)} km` };
      g.updateSettings({ ...g.settings, density: 'moderate' });
      const lined = (closing, gap, kind) => {
        const res = {}, x = { tries: 0, ok: 0, over: 0, contacts: 0, air: 0, hits: 0, other: 0, warn: 0, under: 0, clearMin: 1e9, res };
        for (const seed of [7, 8, 9, 10, 11, 12]) {
          g.setHyper(true); g.placeCar(m, st.s0, 1, 30); g.apLane = 1; h.tank = 1; T.reseed(seed); T.fill(g.view());
          const cands = T.cars.filter((c) => c.path === m && c.s > st.s0 + 150 && c.s < st.s0 + 2200 && c.t < 0 && (!kind || T.classes[c.cls].id === kind)).sort((a, b) => a.s - b.s).slice(0, 16);
          for (const c of cands) {
            if (!T.cars.includes(c)) continue;
            const cl = T.classes[c.cls], lane = m.laneOf(c.d), d = m.laneCenter(lane), at = c.s - gap - cl.len / 2;
            if (g.structureOver(m, at, d, 230)) { x.under++; continue; }
            const between = T.cars.some((o) => {
              if (o === c || Math.abs(o.y - c.y) > 2.5) return false;
              const pr = o.path === m ? { s: o.s, d: o.t >= 0 && Math.abs(m.laneCenter(o.to) - d) < Math.abs(o.d - d) ? m.laneCenter(o.to) : o.d } : m.project(o.x, o.z, c.s);
              return pr.s > at - 12 && pr.s < c.s && Math.abs(pr.d - d) < T.classes[o.cls].wid / 2 + 1.27;
            });
            if (between) continue;
            const v = c.v + closing;
            g.placeCar(m, at, lane, v); g.apLane = lane; h.tank = 1;
            const a = window.hop();
            x.tries++; res[a] = (res[a] || 0) + 1;
            if (a !== 'ok') continue;
            x.ok++; if (g.hopLog.warn) x.warn++;
            const over = g.hopLog.over, f = window.fly(c, v);
            if (over === cl.id && f.over > 0 && f.passed) { x.over++; x.clearMin = Math.min(x.clearMin, f.clear); }
            x.contacts += f.contacts; x.air += f.air; x.hits += f.hits; if (!f.same) x.other++;
          }
        }
        x.clearMin = x.clearMin === 1e9 ? null : +x.clearMin.toFixed(2);
        return x;
      };
      out.ahead30 = lined(30, 50);
      out.sedan15 = lined(15, 15, 'sedan');
      // casual: cruising on the autopilot at 55 m/s, a double-tap every 2.5 s
      const c55 = { tries: 0, ok: 0, air: 0, res: {} };
      for (const seed of [7, 8]) {
        g.setHyper(true); g.placeCar(m, st.s0, 1, 55); g.apLane = 1; h.tank = 1; T.reseed(seed); T.fill(g.view());
        window.run(2, { thrust: 0 }, 55);
        for (let i = 0; i < 20; i++) {
          h.tank = 1; window.run(2.5, { thrust: 0 }, 55);
          if (p.s > m.len - 900 || g.path !== m || p.vx < 8) { g.placeCar(m, st.s0, 1, 55); g.apLane = 1; T.fill(g.view()); window.run(2, { thrust: 0 }, 55); }
          const a = window.hop(); c55.tries++; c55.res[a] = (c55.res[a] || 0) + 1;
          if (a === 'ok') { c55.ok++; c55.air += window.fly(null, 55).air; }
        }
      }
      out.casual55 = c55;
      g.updateSettings({ ...g.settings, density: 'none' }); g.setHyper(true); T.cars = [];
      return out;
    });
    expect(!r.none, 'no straight without another freeway on its pavement');
    const pct = (a, b) => Math.round((100 * a) / Math.max(1, b));
    for (const [k, x] of [['+30 m/s from 50 m', r.ahead30], ['a sedan at +15 m/s from 15 m', r.sedan15]]) {
      expect(x.tries >= 25, `${k}: only ${x.tries} vehicles lined up`);
      expect(x.over * 2 >= x.tries, `${k}: ${x.over} of ${x.tries} went over it (${JSON.stringify(x.res)})`);
      expect(x.contacts === 0 && x.hits === 0 && x.other === 0, `${k}: ${x.contacts} contacts (${x.air} in the air), ${x.hits} hits, ${x.other} landed on another road`);
    }
    expect(r.casual55.ok * 10 >= r.casual55.tries * 3 && r.casual55.air === 0, `casual at 55 m/s: ${r.casual55.ok} of ${r.casual55.tries} granted, ${r.casual55.air} contacts in the air (${JSON.stringify(r.casual55.res)})`);
    const line = (x) => `${x.over} of ${x.tries} over it (${pct(x.over, x.tries)} %), ${x.ok} granted, ${x.warn} with traffic on landing, at least ${x.clearMin} m over the roof, 0 contacts, the same road; refused ${JSON.stringify(Object.fromEntries(Object.entries(x.res).filter(([k]) => k !== 'ok')))}; ${x.under} under a structure not tried`;
    return `${r.site}, moderate: +30 m/s from 50 m: ${line(r.ahead30)}. A sedan at +15 m/s from 15 m: ${line(r.sedan15)}. Cruising at 55 m/s: ${r.casual55.ok} of ${r.casual55.tries} double-taps granted (${pct(r.casual55.ok, r.casual55.tries)} %), 0 contacts in the air`;
  });
  // the driver's ability and the car's, together: The Ace's Focus Time (the world at 0.7x) and a hop over a moving semi
  // in heavy traffic, through the real ability path. The hop is planned for the traffic at the pace it took off in, so
  // Focus Time never changes that pace in the air: one that runs out mid-hop holds until touchdown, one asked for in the
  // air starts on touchdown. (Before the fix the world snapped back to 1x mid-hop, the semi jumped from 15.8 to 22.6
  // m/s and the car touched its trailer 19 times in the air, 0.27 m under its roof.)
  await check('Thrust Hop and Focus Time: the world keeps its pace in the air (an end held to touchdown, a start asked for in the air waits for it), no contact over the semi', async () => {
    const r = await game(page, () => {
      const g = window.__game, p = g.phys, T = g.traffic, m = g.findMain('I-405 North'), out = [], driver = g.settings.driver;
      g.updateSettings({ ...g.settings, driver: 'ace', density: 'heavy' });
      const ab = () => { g.setPaused(false); const ok = g.useAbility(); g.setPaused(true); return ok; };
      for (const sc of [{ name: 'ends 0.3 s into the hop', endIn: 0.3 }, { name: 'asked for 0.3 s into the hop', startAt: 0.3 }]) {
        let done = null;
        // seed 25's heavy traffic on I-405 North from 34.5 km, the suite's geometry: 52 m behind a semi, closing at 40 m/s
        for (let seed = 25; seed < 31 && !done; seed++) {
          g.ability.reset(); g.endAbility();
          g.setHyper(true); g.placeCar(m, 34500, 1, 30); g.apLane = 1; T.reseed(seed); T.fill(g.view());
          const semis = T.cars.filter((c) => T.classes[c.cls].id === 'semi' && c.path === m && c.s > p.s + 80 && !g.structureOver(m, c.s - 80, c.d, 260)).sort((a, b) => a.s - b.s);
          for (const s of semis.slice(0, 6)) {
            const cl = T.classes[s.cls], lane = m.laneOf(s.d);
            T.cars = T.cars.filter((c) => { if (c === s || Math.abs(c.y - s.y) > 2.5) return true; const pr = m.project(c.x, c.z, s.s); return pr.s < s.s - 120 || pr.s > s.s - 12 || Math.abs(pr.d - s.d) > 40; });
            g.ability.reset(); g.endAbility();
            const fired = sc.endIn ? ab() : null;
            if (sc.endIn) g.ability.active = sc.endIn;
            const v = s.v * g.worldScale + 40;
            g.placeCar(m, s.s - 52, lane, v); g.apLane = lane; g.hyper.tank = 1;
            const orig = T.collide.bind(T);
            let contacts = 0, t = 0, started = null, clear = 1e9, over = 0, airMin = 9, airMax = 0, after = null;
            T.collide = (view, dt, dtc) => { const n = orig(view, dt, dtc); if (n && p.airborne) contacts += n; return n; };
            const col0 = g.collisions, scale0 = g.worldScale, toast0 = window.__toasts.length, res = window.hop();
            if (res !== 'ok' || g.hopLog.over !== 'semi') { T.collide = orig; continue; }
            window.run(4, { thrust: 0 }, v, () => {
              t += 1 / 120;
              if (sc.startAt && started === null && t >= sc.startAt) started = ab();
              if (p.airborne) {
                airMin = Math.min(airMin, g.worldScale); airMax = Math.max(airMax, g.worldScale);
                if (Math.abs(s.s - p.s) < cl.len / 2 + 2.36 && Math.abs(s.d - p.d) < cl.wid / 2 + 1.02) { over++; clear = Math.min(clear, p.altitude - cl.height); }
              } else if (t > 0.05) { after = { scale: g.worldScale, on: g.ability.on, cooling: g.ability.cool > 0 }; return false; }
            });
            T.collide = orig;
            done = { sc: sc.name, seed, fired, semiV: +s.v.toFixed(1), scale0, air: [airMin, airMax], after, started, peak: +g.hopLog.peak.toFixed(2), T: +g.hopLog.T.toFixed(2), over, clear: +clear.toFixed(2), contacts, hits: g.collisions - col0, toasts: window.__toasts.slice(toast0) };
            break;
          }
        }
        out.push(done ?? { sc: sc.name, none: true });
      }
      g.ability.reset(); g.endAbility();
      g.updateSettings({ ...g.settings, driver, density: 'none' }); T.cars = [];
      return out;
    });
    const [end, ask] = r;
    expect(!end.none && !ask.none, `no hop over a semi: ${JSON.stringify(r)}`);
    expect(end.fired && end.scale0 === 0.7 && end.air[0] === 0.7 && end.air[1] === 0.7 && end.after && end.after.scale === 1 && !end.after.on && end.after.cooling, `Focus Time ending in the air: ${JSON.stringify(end)}`);
    expect(ask.started === false && ask.toasts.includes('Focus Time on landing') && ask.scale0 === 1 && ask.air[0] === 1 && ask.air[1] === 1 && ask.after && ask.after.scale === 0.7 && ask.after.on, `Focus Time asked for in the air: ${JSON.stringify(ask)}`);
    for (const x of r) expect(x.over > 0 && x.contacts === 0 && x.hits === 0 && x.clear >= 0.3, `${x.sc}: ${JSON.stringify(x)}`);
    return r.map((x) => `Focus Time ${x.sc} (seed ${x.seed}, semi at ${x.semiV} m/s): world ${x.air[0]}x through the air, ${x.after.scale}x on touchdown${x.after.on ? ' (Focus Time on)' : ''}; peak ${x.peak} m, ${x.clear} m over the trailer, 0 contacts`).join('; ');
  });
  await check('Thrust Hop at a parked sedan too far to clear at 10 m/s: a plain hop that comes down short of it with room to stop; nearer, "Get closer to clear" and no gas spent', async () => {
    const r = await game(page, () => {
      const g = window.__game, m = g.findMain('I-405 North'), p = g.phys, T = g.traffic, out = [];
      for (const gap of [35, 20]) {
        g.setHyper(true); g.placeCar(m, 3000, 1, 10); g.apLane = 1; T.clearAround(p.x, p.z, 300);
        const car = T.addRacer(m, 3000 + gap, 1, 'Parked', 0x777777, 0, 0, 3000);
        car.cls = T.classes.findIndex((c) => c.id === 'sedan');
        const col0 = g.collisions, n0 = g.hopLog.n, res = window.hop(), tank = g.hyper.tank;
        let contacts = 0, landed = null, t = 0; const orig = T.collide.bind(T);
        T.collide = (view, dt, dtc) => { const n = orig(view, dt, dtc); contacts += n; return n; };
        // down, then the driver brakes for the car ahead (run() applies `ctl` before every step, so the brake goes there:
        // set on the controls alone it would be put back to 0 at the next step)
        const ctl = { throttle: 0, brake: 0, thrust: 0 };
        if (res === 'ok') window.run(4, ctl, 0, () => {
          t += 1 / 120;
          if (!p.airborne && t > 0.05 && !landed) { landed = { toTail: +(car.s - 2.4 - 2.36 - p.s).toFixed(1), v: +p.vx.toFixed(1) }; ctl.brake = 1; }
          if (landed && p.vx < 0.3) return false;
        });
        T.collide = orig;
        out.push({ gap, res, hopped: g.hopLog.n > n0, short: g.hopLog.n > n0 ? g.hopLog.short : null, peak: +g.hopLog.peak.toFixed(2), tank: +tank.toFixed(2), landed, stopTail: +(car.s - 2.4 - 2.36 - p.s).toFixed(1), contacts, hits: g.collisions - col0, toast: window.__toasts.at(-1) });
        T.removeRacers();
      }
      g.setHyper(true);
      return out;
    });
    const [far, near] = r;
    expect(far.res === 'ok' && far.short === 'sedan' && far.landed && far.landed.toTail > 10 && far.stopTail > 0 && far.contacts === 0 && far.hits === 0, `35 m: ${JSON.stringify(far)}`);
    expect(near.res === 'Get closer to clear' && !near.hopped && near.tank === 1 && near.toast === near.res, `20 m: ${JSON.stringify(near)}`);
    return `35 m back at 10 m/s: a ${far.peak} m hop, down ${far.landed.toTail} m short of its tail, stopped ${far.stopTail} m short, 0 contacts ("${far.toast}"); 20 m back: "${near.res}", no gas spent`;
  });
  await check('Thrust Hop meets a semi it is under: a forced arc at 3.0-3.4 m (under the 4.1 m roof) makes contact, one at roof + 0.5 m does not', async () => {
    const r = await game(page, () => {
      const g = window.__game, st = window.findStraight('I-405 North', 1500), m = g.findMain(st.label), p = g.phys, T = g.traffic, out = [];
      const cls = T.classes.findIndex((c) => c.id === 'semi'), cl = T.classes[cls];
      // an arc forced through the physics (not the planner) over a parked semi 40 m ahead at 20 m/s, symmetric about
      // the trailer's middle: 3.4 m at its peak (3.1 m at the trailer's tail), and one whose low points over the
      // trailer are at the roof + 0.5 m. Contacts are counted while the car is in the air.
      for (const label of ['under', 'over']) {
        const v = 20, gap = 40, t1 = (gap - cl.len / 2 - 2.36) / v, t2 = (gap + cl.len / 2 + 2.36) / v, Tair = t1 + t2, tau = t1 / Tair;
        const peak = label === 'under' ? 3.4 : (cl.height + 0.5) / (4 * tau * (1 - tau));
        g.setHyper(true); g.placeCar(m, st.s0 + 200, 1, v); g.apLane = 1; T.clearAround(p.x, p.z, 400);
        const car = T.addRacer(m, st.s0 + 200 + gap, 1, 'Parked', 0x777777, 0, 0, st.s0 + 200); car.cls = cls;
        let contacts = 0, first = null; const orig = T.collide.bind(T);
        T.collide = (view, dt, dtc) => { const n = orig(view, dt, dtc); if (n && view.altitude > 0) { contacts += n; if (!first) first = { alt: +view.altitude.toFixed(2), toTail: +(car.s - cl.len / 2 - p.s).toFixed(1) }; } return n; };
        const col0 = g.collisions, ok = p.hop(peak, Tair);
        let altMin = 1e9, altMax = 0, over = 0;
        window.run(Tair + 0.3, { throttle: 0.2, brake: 0, thrust: 0, steer: 0 }, 0, () => {
          if (Math.abs(car.s - p.s) < cl.len / 2 + 2.36 && Math.abs(car.d - p.d) < cl.wid / 2 + 1.02 && p.airborne) { over++; altMin = Math.min(altMin, p.altitude); altMax = Math.max(altMax, p.altitude); }
        });
        T.collide = orig; T.removeRacers();
        out.push({ label, ok, roof: cl.height, peak: +peak.toFixed(2), T: +Tair.toFixed(2), over, altMin: +altMin.toFixed(2), altMax: +altMax.toFixed(2), contacts, first, hits: g.collisions - col0, behind: p.s < car.s });
      }
      g.setHyper(true);
      return out;
    });
    const [under, over] = r;
    expect(under.ok && under.contacts >= 1 && under.first && under.first.alt > 2.5 && under.first.alt < under.roof && under.hits >= 1, `under the roof: ${JSON.stringify(under)}`);
    expect(over.ok && over.over > 0 && over.altMin >= over.roof + 0.45 && over.contacts === 0 && over.hits === 0, `over the roof: ${JSON.stringify(over)}`);
    return `under: contact at ${under.first.alt} m up (roof ${under.roof} m), ${under.contacts} contacts, ${under.hits} hits, stopped ${under.behind ? 'behind' : 'past'} it; over: ${over.over} steps over the trailer at ${over.altMin}-${over.altMax} m, 0 contacts`;
  });
  await check('Thrust Hop with THRUST held through the air (double-tap and hold): the valve stays shut, it lands inside the planned stretch, no contact', async () => {
    const r = await game(page, () => {
      const g = window.__game, st = window.findStraight('I-405 North', 1500), m = g.findMain(st.label), p = g.phys, T = g.traffic, h = g.hyper, out = [];
      for (const [kind, v, gap] of [['semi', 25, 30], ['sedan', 25, 22]]) {
        const cls = T.classes.findIndex((c) => c.id === kind), cl = T.classes[cls];
        g.setHyper(true); g.placeCar(m, st.s0 + 200, 1, v); g.apLane = 1; T.clearAround(p.x, p.z, 400);
        const car = T.addRacer(m, st.s0 + 200 + gap, 1, 'Parked', 0x777777, 0, 0, st.s0 + 200); car.cls = cls;
        let contacts = 0; const orig = T.collide.bind(T);
        T.collide = (view, dt, dtc) => { const n = orig(view, dt, dtc); contacts += n; return n; };
        const col0 = g.collisions, s0 = p.s, v0 = p.vx;
        // the hop, then THRUST held on Left Shift through the air and the landing, through the input layer
        const res = window.hop();
        g.input.clear(); g.input.setThrust('key', true);
        let airThrust = 0, airFx = 0, sLand = -1, clear = 1e9, t = 0, landed = -1, groundThrust = 0;
        if (res === 'ok') window.run(4, { throttle: 0.3, brake: 0, steer: 0 }, 0, () => {
          t += 1 / 120;
          if (p.airborne) { airThrust = Math.max(airThrust, h.thrust); airFx = Math.max(airFx, Math.abs(p.ext.fx)); }
          if (Math.abs(car.s - p.s) < cl.len / 2 + 2.36 && Math.abs(car.d - p.d) < cl.wid / 2 + 1.02) clear = Math.min(clear, p.altitude - cl.height);
          if (!p.airborne && landed < 0 && t > 0.05) { landed = t; sLand = p.s; }
          if (landed >= 0) { groundThrust = Math.max(groundThrust, h.thrust); if (t - landed > 0.6) return false; }
        }, true);
        g.input.setThrust('key', false); g.input.update(1 / 120, 0); g.input.clear(); g.input.takeActions();
        T.collide = orig; T.removeRacers();
        const planned = v0 * g.hopLog.T;
        out.push({ kind, v, res, peak: +g.hopLog.peak.toFixed(2), T: +g.hopLog.T.toFixed(2), airThrust: +airThrust.toFixed(3), airFx: Math.round(airFx), flew: +(sLand - s0).toFixed(1), planned: +planned.toFixed(1), track: +(planned + 20).toFixed(1), clear: +clear.toFixed(2), contacts, hits: g.collisions - col0, groundThrust: +groundThrust.toFixed(2) });
      }
      g.setHyper(true);
      return out;
    });
    for (const x of r) {
      expect(x.res === 'ok', `${x.kind} at ${x.v} m/s: ${x.res}`);
      expect(x.airThrust === 0 && x.airFx === 0, `${x.kind}: thrust in the air ${x.airThrust}, ${x.airFx} N`);
      expect(x.flew > 0 && x.flew <= x.planned + 0.5 && x.clear > 0.3 && x.contacts === 0 && x.hits === 0, `${x.kind}: ${JSON.stringify(x)}`);
      expect(x.groundThrust > 0.5, `${x.kind}: the valve didn't open again on the ground (${x.groundThrust})`);
    }
    return r.map((x) => `${x.kind} at ${x.v} m/s: peak ${x.peak} m, flew ${x.flew} m of the planned ${x.planned} m, ${x.clear} m over its roof, 0 contacts, no thrust in the air, the valve open again ${x.groundThrust} on landing`).join('; ');
  });
  await check('Thrust Hop refused under an overpass and a sign gantry (with a toast), and with the tank under 40 %', async () => {
    const r = await game(page, () => {
      const g = window.__game, m = g.findMain('I-405 North'), p = g.phys, out = {};
      // an overpass over the lanes, found from the data apart from the hop's own check
      let over = null;
      for (const o of g.net.overpasses) {
        const mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2;
        for (let s = 200; s < m.len - 400 && !over; s += 40) {
          const a = m.at(s, 0);
          if (Math.abs(a.x - mx) > 60 || Math.abs(a.z - mz) > 60) continue;
          const ex = o.bx - o.ax, ez = o.bz - o.az, L2 = ex * ex + ez * ez, tt = Math.max(0, Math.min(1, ((a.x - o.ax) * ex + (a.z - o.az) * ez) / L2));
          if (Math.hypot(a.x - (o.ax + ex * tt), a.z - (o.az + ez * tt)) < o.w / 2 && o.y - 1.6 - a.y > 3) over = { name: o.name, s };
        }
        if (over) break;
      }
      if (over) {
        g.setHyper(true); g.placeCar(m, over.s - 35, 1, 40); g.apLane = 1;
        out.overpass = { name: over.name, res: window.hop(), air: p.airborne, tank: g.hyper.tank, toast: window.__toasts.at(-1) };
      }
      const sign = g.net.signs.find((sg) => sg.path === m && sg.s - 260 > 600 && !g.structureOver(m, sg.s - 330, 0, 50));
      if (sign) {
        g.setHyper(true); g.placeCar(m, sign.s - 290, 1, 40); g.apLane = 1;
        out.gantry = { exit: sign.text.join(' / '), res: window.hop(), air: p.airborne, toast: window.__toasts.at(-1) };
      }
      g.setHyper(true); g.placeCar(m, 3200, 1, 40); g.hyper.tank = 0.3;
      out.low = { res: window.hop(), air: p.airborne, tank: g.hyper.tank };
      g.setHyper(true);
      return out;
    });
    expect(r.overpass && /overpass/.test(r.overpass.res) && !r.overpass.air && r.overpass.tank === 1 && r.overpass.toast === r.overpass.res, `overpass: ${JSON.stringify(r.overpass)}`);
    expect(r.gantry && /gantry/.test(r.gantry.res) && !r.gantry.air && r.gantry.toast === r.gantry.res, `gantry: ${JSON.stringify(r.gantry)}`);
    expect(/tank low/.test(r.low.res) && !r.low.air && r.low.tank === 0.3, `low tank: ${JSON.stringify(r.low)}`);
    return `under ${r.overpass.name}: "${r.overpass.res}"; before the ${r.gantry.exit} gantry: "${r.gantry.res}"; at 30 %: "${r.low.res}"; no gas spent`;
  });
  await check('THRUST does nothing while paused (Left Shift held and double-tapped)', async () => {
    await game(page, () => { const g = window.__game, m = g.findMain('I-405 North'); g.setHyper(true); g.placeCar(m, 5000, 1, 30); g.setPaused(true); window.__p0 = { v: g.phys.vx, s: g.phys.s, tank: g.hyper.tank, hops: g.hopLog.n }; });
    await page.keyboard.press('ShiftLeft'); await page.keyboard.down('ShiftLeft');
    await frames(page, 6, 900000);
    const r = await game(page, () => { const g = window.__game; return { ...window.__p0, v1: g.phys.vx, s1: g.phys.s, tank1: g.hyper.tank, hops1: g.hopLog.n, thrust: g.hyper.thrust, c: g.input.c.thrust, fx: g.phys.ext.fx }; });
    await page.keyboard.up('ShiftLeft');
    expect(r.v1 === r.v && r.s1 === r.s && r.tank1 === r.tank && r.hops1 === r.hops && r.thrust === 0 && r.c === 0 && r.fx === 0, JSON.stringify(r));
    return `6 frames paused with Shift held after a double-tap: speed, position and tank unchanged, no hop, no force`;
  });
  await check('the jets flow only while the hypercar thrusts in Free Drive; another car gets no jets, no thrust and no thrust sound', async () => {
    // the hypercar, Free Drive, rendered frames with Left Shift held on a clear straight
    await game(page, () => {
      const g = window.__game, st = window.findStraight('I-405 North', 900), m = g.findMain(st.label);
      g.setHyper(true); g.placeCar(m, st.s0 + 100, 1, 20); g.apLane = 1; g.traffic.clearAround(g.phys.x, g.phys.z, 400);
      g.setPaused(false);
    });
    await frames(page, 3, 900000);
    const idle = await game(page, () => ({ live: window.__game.jets.live, thrust: window.__game.hyper.thrust }));
    await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(() => window.__game.hyper.thrust > 0.5 && window.__game.jets.live > 0, null, { timeout: 900000, polling: 100 });
    const on = await game(page, () => ({ live: window.__game.jets.live, thrust: +window.__game.hyper.thrust.toFixed(2) }));
    await page.keyboard.up('ShiftLeft');
    await page.waitForFunction(() => window.__game.hyper.thrust === 0 && window.__game.jets.live === 0, null, { timeout: 900000, polling: 250 });
    // another car in Free Drive: the same key held over rendered frames; the hiss's gain counted as the frames send it
    const other = await game(page, async () => {
      const g = window.__game;
      g.setPaused(true); g.chooseOwnerCar('rossini-gt'); await g.start('free'); g.setPaused(true);
      const st = window.findStraight('I-405 North', 900), m = g.findMain(st.label);
      g.placeCar(m, st.s0 + 100, 1, 20); g.apLane = 1; g.traffic.clearAround(g.phys.x, g.phys.z, 400);
      const a = g.audio, hiss = a.hissG?.gain; window.__hissCalls = 0;
      if (hiss) { const o = hiss.setTargetAtTime.bind(hiss); hiss.setTargetAtTime = (...x) => { window.__hissCalls++; return o(...x); }; }
      g.setPaused(false);
      return { car: g.driving, live: g.hyper.live, keys: g.input.thrustLive, audio: a.ctx?.state ?? 'none' };
    });
    await frames(page, 3, 900000);                      // the switch's one update that sends the zeros, then counted
    await game(page, () => { window.__hissCalls = 0; });
    await page.keyboard.down('ShiftLeft');
    await frames(page, 8, 900000);
    const held = await game(page, () => { const g = window.__game; return { live: g.jets.live, c: g.input.c.thrust, thrust: g.hyper.thrust, fx: g.phys.ext.fx, hiss: window.__hissCalls, frames: g.frames }; });
    await page.keyboard.up('ShiftLeft');
    await game(page, () => window.__game.setPaused(true));
    await hyperIn(page, 'free');
    expect(idle.live === 0 && idle.thrust === 0, `the hypercar idling: ${JSON.stringify(idle)}`);
    expect(on.live > 0 && on.thrust > 0.5, `the hypercar thrusting: ${JSON.stringify(on)}`);
    expect(other.car === 'rossini-gt' && !other.live && !other.keys, `another car: ${JSON.stringify(other)}`);
    expect(held.live === 0 && held.c === 0 && held.thrust === 0 && held.fx === 0 && held.hiss === 0, `another car with Shift held: ${JSON.stringify(held)} (audio ${other.audio})`);
    return `the hypercar: ${on.live} sprites alive while thrusting, 0 idle; the ${other.car} with Left Shift held over 8 frames: 0 sprites, 0 N, ${held.hiss} thrust-sound updates (audio ${other.audio})`;
  });
  await check('the dash pressure gauge redraws at most 4 times a second on the phone build (10 on High), not at all outside the seat view; the hop\'s label says charging only while it charges', async () => {
    const r = await game(page, () => {
      const g = window.__game, car = g.car, gg = car.gauge, p = g.phys, h = g.hyper;
      // two seconds at 60 frames a second with the tank draining from 100 % to 50 % under thrust (a new 10-bar step
      // almost every frame), seen from the seat, then the same two seconds from the chase camera; then a 12 s recharge
      // from empty, seen from the seat (the suite runs Low quality: the phone build)
      const d0 = car.gaugeDraws;
      for (let i = 0; i < 120; i++) car.setThrustGauge(true, 1 - (0.5 * i) / 120, 1, false, false, true, 1 / 60);
      const seat = car.gaugeDraws - d0, d1 = car.gaugeDraws;
      for (let i = 0; i < 120; i++) car.setThrustGauge(true, 0.5 - (0.5 * i) / 120, 1, false, false, false, 1 / 60);
      const chase = car.gaugeDraws - d1, d2 = car.gaugeDraws;
      for (let i = 0; i < 720; i++) car.setThrustGauge(true, i / 720, 0, false, false, true, 1 / 60, true);
      const recharge = car.gaugeDraws - d2;
      // the HUD's hop label with 30 % in the tank: stopped (nothing charges), then driving (the compressor fills it)
      const st = window.findStraight('I-405 North', 900), m = g.findMain(st.label), label = () => { g.sendHud(); return document.querySelector('.hud-hop').textContent; };
      g.setHyper(true); g.placeCar(m, st.s0 + 100, 1, 0); g.apLane = 1; h.tank = 0.3;
      window.run(0.2, { throttle: 0, brake: 0, thrust: 0 }, 0);
      const stopped = { label: label(), charging: h.charging };
      g.placeCar(m, st.s0 + 100, 1, 20); h.tank = 0.3;
      window.run(0.2, { thrust: 0 }, 20);
      const driving = { label: label(), charging: h.charging };
      g.setHyper(true);
      return { step: gg.step, period: gg.period, seat, chase, recharge, stopped, driving, v: +p.vx.toFixed(1) };
    });
    expect(r.step === 10 && r.period === 0.25 && r.seat >= 6 && r.seat <= 9 && r.chase === 0 && r.recharge <= 49, JSON.stringify(r));
    expect(r.stopped.label === 'Hop: tank low' && !r.stopped.charging && r.driving.label === 'Hop: charging' && r.driving.charging, `hop label: ${JSON.stringify(r)}`);
    return `phone build, ${r.step}-bar steps: 2 s of draining tank ${r.seat} redraws from the seat, ${r.chase} from the chase camera; a 12 s recharge ${r.recharge}; at 30 % the label reads "${r.stopped.label}" stopped and "${r.driving.label}" driving`;
  });
  await check('no THRUST in Speed Survival: the race tune, no button, and holding it changes nothing', async () => {
    const out = [];
    // (Races and Time Trial were removed on 2026-11-08: Speed Survival is the one mode on the race tune)
    for (const mode of ['survival']) {
      const r = await hyperIn(page, mode);
      await page.waitForFunction(() => [...document.querySelectorAll('.hud-chips i')].map((e) => e.textContent).find((t) => t === 'Unleashed' || t === 'Race tune') === 'Race tune', null, { timeout: 900000, polling: 500 });
      // 3 s of driving: no force, no tank change, no hop (no mode has a countdown since Races went)
      const run = await game(page, () => {
        const g = window.__game, p = g.phys;
        let fx = 0, thrust = 0, steps = 0;
        const t0 = 0;
        for (let t = 0; t < t0 + 3; t += 1 / 120) { g.autopilot(g.input.c, 60); Object.assign(g.input.c, { throttle: 1, thrust: 1 }); g.simulate(1 / 120); fx = Math.max(fx, Math.abs(p.ext.fx), Math.abs(p.ext.fz)); thrust = Math.max(thrust, g.hyper.thrust); steps++; }
        g.setPaused(false); const hop = g.thrustHop(); g.setPaused(true);
        return { fx, thrust, tank: g.hyper.tank, hop, air: p.airborne, steps };
      });
      // the real key, with frames running: nothing reaches the controls
      await game(page, () => window.__game.setPaused(false));
      await page.keyboard.down('ShiftLeft'); await frames(page, 4, 900000);
      const key = await game(page, () => { const g = window.__game; const k = { c: g.input.c.thrust, fx: g.phys.ext.fx, jets: g.jets.live }; g.setPaused(true); return k; });
      await page.keyboard.up('ShiftLeft');
      const dom = await game(page, () => ({ btn: !document.querySelector('.hud-thrustbtn').hidden, panel: !document.querySelector('.hud-thrust').hidden, chip: [...document.querySelectorAll('.hud-chips i')].map((e) => e.textContent).find((t) => t === 'Unleashed' || t === 'Race tune') }));
      expect(!r.live && !r.keys && r.car === 'oc-hyper' && r.grip === 1.04, `${mode}: ${JSON.stringify(r)}`);
      expect(run.fx === 0 && run.thrust === 0 && run.tank === 1 && run.hop === 'off' && !run.air && key.c === 0 && key.fx === 0 && key.jets === 0, `${mode}: ${JSON.stringify(run)} key ${JSON.stringify(key)}`);
      expect(!dom.btn && !dom.panel, `${mode}: THRUST on screen ${JSON.stringify(dom)}`);
      out.push(`${mode}: race tune (grip ${r.grip}), chip "${dom.chip}", no button, THRUST held: 0 N, no jets`);
    }
    await hyperIn(page, 'free');
    return out.join('; ');
  });
});

await group('progression', async (use) => {
  const { page } = await use({ settings: { start: 'I-405 North' }, size: [640, 360] });
  await drive(page, 'Free Drive');
  await game(page, () => window.__game.setPaused(true));
  await check('driving earns XP, credits and "Ton Up", saved on the device', async () => {
    const r = await game(page, () => {
      const g = window.__game; g.fastForward(60, {}, 50); g.profile.save();
      const saved = JSON.parse(localStorage.getItem('tsu.profile') || '{}');
      return { xp: g.profile.p.xp, credits: g.profile.p.credits, ach: g.profile.p.achievements, savedXp: saved.xp, v: saved.v };
    });
    expect(r.xp > 0 && r.credits > 0 && r.ach.includes('ton'), JSON.stringify(r));
    expect(r.v === 1 && Math.abs(r.savedXp - r.xp) < 1e-6, `saved v${r.v} xp ${r.savedXp}`);
    return `${Math.round(r.xp)} XP, ${Math.round(r.credits)} credits, achievements ${r.ach.join(', ')}, saved as v${r.v}`;
  });
  // following the route (owner, 2026-11-01): Auto-drive drives the route's hand-offs to a destination a few km away,
  // Free Drive's distance still counts, it stops on arrival; then the keyboard's steer, and its brake, each take the car
  // back at once, while gas alone doesn't
  await check('Auto-drive: takes the hand-offs to CA-55 North; steer and brake keys each take over, gas does not', async () => {
    const r = await game(page, () => {
      const g = window.__game, m = g.findMain('I-405 North');
      g.setPaused(true);
      g.placeCar(m, m.len * 0.12, 1, 25); g.traffic.reseed(3); g.traffic.fill(g.view());
      if (!g.navigateTo('CA-55 North')) return { why: 'no route' };
      const hand = g.route.length, d0 = g.distance, s0 = g.phys.s, x0 = g.phys.x, z0 = g.phys.z, on = g.setAutoDrive(true);
      let t = 0, top = 0;
      while (t < 400 && g.routeTarget) { g.fastForward(1, {}); t++; top = Math.max(top, g.phys.vx); }
      return { hand, on, t, at: g.path.label, auto: g.autoDriving, target: g.routeTarget?.label ?? null, km: (g.distance - d0) / 1000, crow: Math.hypot(g.phys.x - x0, g.phys.z - z0) / 1000, top: top * 2.236936, coll: g.collisions, s0 };
    });
    expect(!r.why, r.why);
    expect(r.on && r.hand >= 1 && r.at === 'CA-55 North' && !r.target && !r.auto, `after ${r.t} s: on ${r.at}, auto ${r.auto}, target ${r.target}, ${r.hand} hand-offs`);
    expect(r.km > 2 && r.top <= 72, `${fmt(r.km)} km counted, top ${fmt(r.top)} mph`);
    // the take-over, by real keys on rendered frames
    await game(page, () => { const g = window.__game; g.navigateTo('CA-91 East') || g.navigateTo('I-5 North'); g.setAutoDrive(true); g.setPaused(false); });
    const keyTakeOver = async (key) => {
      await game(page, () => window.__game.setAutoDrive(true));
      await frames(page, 2);
      const before = await game(page, () => window.__game.autoDriving);
      await page.keyboard.down(key); await frames(page, 2); await page.keyboard.up(key);
      return { before, after: await game(page, () => window.__game.autoDriving) };
    };
    const gas = await (async () => { await game(page, () => window.__game.setAutoDrive(true)); await page.keyboard.down('KeyW'); await frames(page, 3); await page.keyboard.up('KeyW'); return game(page, () => window.__game.autoDriving); })();
    const steer = await keyTakeOver('KeyD'), brake = await keyTakeOver('ArrowDown');
    await game(page, () => { const g = window.__game; g.setAutoDrive(false); g.navigateTo(null); g.setPaused(true); });
    expect(gas, 'gas alone handed the car back');
    expect(steer.before && !steer.after && brake.before && !brake.after, `steer key ${JSON.stringify(steer)}, brake key ${JSON.stringify(brake)}`);
    return `${r.hand} hand-offs, arrived on ${r.at} in ${r.t} s sim, ${fmt(r.km)} km counted (${fmt(r.crow)} km as the crow flies), top ${fmt(r.top)} mph, ${r.coll} collisions, handed back on arrival; D and Down each took over, W didn't`;
  });
  // a missed exit (owner, 2026-11-01, review): with the next hand-off behind the car on the road it is still on, the
  // guidance plans again (it froze at "0 ft KEEP RIGHT" and Auto-drive drove on up I-405 North for 14 km), and Auto-drive,
  // engaged 300 m past the 55's junction, reroutes and still gets there
  await check('Auto-drive: a missed exit reroutes (guidance within 10 s, Auto-drive at once) and still arrives on CA-55 North', async () => {
    const r = await game(page, () => {
      const g = window.__game, m = g.findMain('I-405 North');
      g.setPaused(true);
      g.placeCar(m, m.len * 0.12, 1, 25); g.traffic.reseed(3); g.traffic.fill(g.view());
      if (!g.navigateTo('CA-55 North')) return { why: 'no route' };
      const j0 = g.route[0];
      // the guidance alone: put the car 300 m past the junction in a left lane, and drive straight on
      g.placeCar(m, j0.s + 300, 1, 25);
      const rr0 = g.reroutes; let t1 = 0;
      while (t1 < 10 && g.reroutes === rr0) { g.fastForward(0.25, { throttle: 0.4, steer: 0 }); t1 += 0.25; }
      const guide = { t: t1, rerouted: g.reroutes > rr0, ahead: !!g.route[0] && g.route[0] !== j0 && (g.route[0].s >= g.phys.s - 60 || g.route[0].to === g.path) };
      // Auto-drive: the stale plan again, engaged 300 m past the junction
      g.navigateTo(null); g.placeCar(m, m.len * 0.12, 1, 25); g.navigateTo('CA-55 North');
      const j1 = g.route[0]; g.placeCar(m, j1.s + 300, 1, 25);
      const on = g.setAutoDrive(true), replanned = g.route[0] !== j1;
      let t = 0, rr = g.reroutes;
      // no U-turns on a freeway: the way back is the long way round (I-405 North to CA-22 East to CA-55 North, about
      // 39 km and 1270 s sim from 770 m past)
      while (t < 1600 && g.routeTarget) { g.fastForward(1, {}); t++; }
      return { guide, on, replanned, t, at: g.path.label, target: g.routeTarget?.label ?? null, auto: g.autoDriving, later: g.reroutes - rr, coll: g.collisions };
    });
    await game(page, () => { const g = window.__game; g.setAutoDrive(false); g.navigateTo(null); });
    expect(!r.why, r.why);
    expect(r.guide.rerouted && r.guide.ahead && r.guide.t <= 10, `guidance after the missed exit: ${JSON.stringify(r.guide)}`);
    expect(r.on && r.replanned, `Auto-drive engaged ${r.on}, replanned at once ${r.replanned}`);
    expect(r.at === 'CA-55 North' && !r.target && !r.auto, `after ${r.t} s: on ${r.at}, target ${r.target}, auto ${r.auto}`);
    return `guidance rerouted ${r.guide.t} s after the miss; Auto-drive replanned on engaging and arrived on ${r.at} in ${r.t} s sim (${r.later} more reroutes, ${r.coll} collisions), handed back`;
  });
  // the desktop guidance card with the lane hint up (review r4): the turn word stays whole beside a distance in feet,
  // the whole final approach. The lanes' room was 64 px for 37 px of marks, which cut "Keep right" to "KEEP RIG...";
  // every word the card can say, with 5 lanes and with all 7, fits clear of the marks
  await check('desktop 1440 × 900: the guidance card keeps the turn word whole beside the lane hint, in feet', async () => {
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await game(page, () => {
        const g = window.__game, m = g.findMain('I-405 North');
        g.setPaused(true); g.placeCar(m, m.len * 0.12, 1, 28); g.traffic.reseed(3); g.traffic.fill(g.view()); g.navigateTo('CA-55 North');
        g.fastForward(Math.max(0, (g.route[0].s - g.phys.s - 1000) / 28), {}, 28); g.setPaused(false);   // 1 km (3280 ft) before the hand-off
      });
      await page.waitForFunction(() => document.querySelector('.app')?.dataset.hud === 'desk' && !!document.querySelector('.hud-nav:not([hidden]) .hud-nav-lanes:not([hidden]) i.on')
        && / ft$/.test(document.querySelector('.hud-nav-dist b')?.textContent ?? ''), null, { timeout: FRAMES_MS, polling: 50 });
      // measured running: paused, the pause screen takes the HUD away and every width reads 0
      await frames(page, 2);
      await page.screenshot({ path: path.join(OUT, 'desk-nav-lanes.png'), clip: { x: 0, y: 0, width: 360, height: 150 } });
      const r = await game(page, () => {
        const q = (s) => document.querySelector(s), sp = q('.hud-nav-dist span'), ln = q('.hud-nav-lanes'), kids = [...ln.children];
        const look = () => ({ sw: sp.scrollWidth, cw: sp.clientWidth, lw: Math.round(ln.getBoundingClientRect().width), gap: Math.round(ln.getBoundingClientRect().left - sp.getBoundingClientRect().right) });
        const now = { act: sp.textContent, dist: q('.hud-nav-dist b').textContent, lanes: kids.filter((k) => !k.hidden).length, ...look() };
        // every word, beside the longest distance in feet, with 5 lanes and with all 7 (restored after)
        const act = sp.textContent, dist = q('.hud-nav-dist b').textContent, was = kids.map((k) => k.hidden), words = [];
        q('.hud-nav-dist b').textContent = '5280 ft';
        for (const n of [5, 7]) {
          kids.forEach((k, i) => { k.hidden = i >= n; });
          for (const w of ['Keep right', 'Keep left', 'Continue']) { sp.textContent = w; words.push({ n, w, ...look() }); }
        }
        kids.forEach((k, i) => { k.hidden = was[i]; }); sp.textContent = act; q('.hud-nav-dist b').textContent = dist;
        return { now, words };
      });
      expect(r.now.cw > 40 && r.now.lw > 0, `the card is not laid out: ${JSON.stringify(r.now)}`);
      expect(r.now.sw <= r.now.cw + 1 && r.now.gap >= 0, `"${r.now.dist} ${r.now.act}" with ${r.now.lanes} lanes: the word is cut (${r.now.cw} of ${r.now.sw} px) or under the lanes (gap ${r.now.gap} px)`);
      const bad = r.words.filter((x) => !x.cw || x.sw > x.cw + 1 || x.gap < 0);
      expect(bad.length === 0, `cut or under the lanes beside 5280 ft: ${bad.map((x) => `${x.w} (${x.n} lanes, ${x.cw} of ${x.sw} px, gap ${x.gap})`).join('; ')}`);
      return `"${r.now.dist} ${r.now.act}" with ${r.now.lanes} lanes: ${r.now.sw}/${r.now.cw} px, ${r.now.gap} px clear of the lanes; beside 5280 ft every word whole with 5 and 7 lanes (closest ${Math.min(...r.words.map((x) => x.gap))} px from the lanes)`;
    } finally {
      await game(page, () => { const g = window.__game; g.setAutoDrive(false); g.navigateTo(null); g.setPaused(true); }).catch(() => {});
      await page.setViewportSize({ width: 640, height: 360 }).catch(() => {});
      await frames(page, 2).catch(() => {});
    }
  });
  await check('showroom: refusals, then buy the Brio and drive its numbers', async () => {
    const r = await game(page, () => {
      const g = window.__game, pb = g.profile, lvl = (l) => Math.round(400 * Math.pow(l - 1, 1.5));
      const slots = () => Math.min(6, 1 + Math.floor(pb.level / 4));
      const gtTop = g.carTop();
      pb.p.xp = lvl(5); pb.p.credits = 100;
      const noMoney = pb.buy('rossini-corsa', 30000, 5, slots());
      pb.p.xp = lvl(4);
      const noLevel = pb.buy('rossini-corsa', 30000, 5, slots());
      pb.p.credits = 20000;
      const ok = pb.buy('rossini-brio', 9000, 2, slots());
      g.applyCarChoice();
      return { noMoney, noLevel, ok, credits: pb.p.credits, car: pb.p.car, gtTop, brioTop: g.carTop() };
    });
    expect(r.noMoney === '29,900 more credits needed', `no money: ${r.noMoney}`);
    expect(r.noLevel === 'Opens at level 5', `no level: ${r.noLevel}`);
    expect(r.ok === null && r.credits === 11000 && r.car === 'rossini-brio', `buy: ${r.ok}, ${r.credits} credits, car ${r.car}`);
    expect(r.brioTop < r.gtTop, `top speed GT ${fmt(r.gtTop)} vs Brio ${fmt(r.brioTop)} m/s`);
    return `"${r.noMoney}", "${r.noLevel}", bought: 11,000 left; computed top ${Math.round(r.gtTop * MPH)} → ${Math.round(r.brioTop * MPH)} mph`;
  });
  await check('Ultra Realism: locked below level 5, tunnel vision at speed, switches off', async () => {
    const ramp = () => game(page, () => {
      const g = window.__game; let t = 0;
      g.setPaused(true);
      while (g.phys.vx < 69 && t < 90) { g.fastForward(1, {}, 75); t++; }
      return g.phys.vx;
    });
    // tunnel vision eases in on rendered frames; pausing holds the speed while it does
    const tunnelAt = async () => { await frames(page, 15); await page.waitForTimeout(1500); return game(page, () => window.__game.tunnel); };
    await game(page, () => { const g = window.__game; g.profile.p.xp = 0; g.updateSettings({ ...g.settings, ultra: true }); });
    const v1 = await ramp(), locked = await tunnelAt();
    await game(page, () => { window.__game.profile.p.xp = Math.round(400 * Math.pow(5, 1.5)); });   // level 6
    const v2 = await ramp(), on = await tunnelAt();
    await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, ultraTunnel: false }); });
    const off = await tunnelAt();
    expect(locked === 0, `tunnel ${fmt(locked)} at level 1 and ${Math.round(v1 * MPH)} mph`);
    expect(v2 * MPH > 150 && on > 0.3, `tunnel ${fmt(on)} at ${Math.round(v2 * MPH)} mph`);
    expect(off < 0.05, `tunnel ${fmt(off)} with tunnel vision switched off`);
    return `level 1: ${locked}; level 6 at ${Math.round(v2 * MPH)} mph: ${fmt(on)}; switched off: ${fmt(off)}`;
  });
  await check('radio cycles three stations, then off', async () => {
    const r = await game(page, () => {
      const g = window.__game, seen = [];
      g.setPaused(false);                        // a paused game suspends its audio
      for (let i = 0; i < 4; i++) { g.cycleRadio(); seen.push(g.radio.current ? g.radio.current.name : 'off'); }
      return { seen };
    });
    await page.waitForTimeout(300);
    const state = await game(page, () => { const g = window.__game, st = g.audio.context?.state; g.setPaused(true); return st; });
    expect(r.seen.join(',') === 'Coast,Freeway FM,Canyon Radio,off', r.seen.join(','));
    expect(state === 'running', `audio ${state}`);
    return `${r.seen.join(' → ')}, audio ${state}`;
  });
  // owner mode (owner, 2026-10-16): every car to drive for testing, the Vela E listed only with it or once owned, a chip
  // in the garage, and nothing written to the profile. Here the profile is level 6 with the GT and the Brio (both slots
  // full) and too few credits, so the Vela E (level 8, 60,000) is out of reach on all three counts without it.
  await check('owner mode: every car drivable from the garage, the Vela E included, a chip, the profile untouched; off and #owner', async () => {
    const LABEL = 'Owner mode (all cars unlocked, test builds only)';
    const toMenu = async () => { await page.waitForSelector('.overlay.menu', { timeout: 120000 }); };
    const garage = async () => {
      await page.locator('.pick', { hasText: 'Car' }).first().click();
      await page.waitForSelector('.panel.profile .gcell.car');
      const r = await game(page, () => {
        const panel = document.querySelector('.panel.profile');
        const cards = [...panel.querySelectorAll('.gcell.car')];
        return {
          names: cards.map((c) => c.querySelector('.carhead b').textContent),
          chip: panel.querySelector('h2 .chip')?.textContent ?? '',
          drive: cards.filter((c) => [...c.querySelectorAll('button, em')].some((b) => /^(Drive|Driving it)$/.test(b.textContent))).length,
          shop: [...panel.querySelectorAll('.gcell.car button, .gcell.car em')].map((b) => b.textContent).filter((t) => /^(Buy|Sell|Opens at)/.test(t)),
        };
      });
      return r;
    };
    const done = async () => { await page.locator('.panel').getByRole('button', { name: 'Done' }).click(); await toMenu(); };
    const owner = async (on) => {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const t = page.getByLabel(LABEL);
      if (on) await t.check(); else await t.uncheck();
      await done();
    };
    const state = () => game(page, () => {
      const g = window.__game; g.profile.save();
      return { car: g.carId, built: g.car.config?.car, top: g.carTop(), owner: g.settings.owner, vehicles: [...g.profile.p.vehicles], chosen: g.profile.p.car,
        credits: g.profile.p.credits, level: g.profile.level, saved: localStorage.getItem('tsu.profile') };
    });
    await page.getByRole('button', { name: 'Main menu' }).click();
    await toMenu();
    const s0 = await state();
    const off = await garage(); await done();
    await owner(true);
    const on = await garage();
    await page.locator('.gcell.car', { hasText: 'Vela E' }).getByRole('button', { name: 'Drive' }).click();
    await page.waitForFunction(() => window.__game.carId === 'vela-e');
    const s1 = await state();
    await done();
    const pick = await game(page, () => [...document.querySelectorAll('.pick')].find((p) => /Car/.test(p.textContent))?.querySelector('b')?.textContent);
    // a run starts in the owner's car
    await drive(page, 'Free Drive');
    const run = await game(page, () => { const g = window.__game; g.setPaused(true); return { built: g.car.config?.car, top: g.carTop() }; });
    await page.getByRole('button', { name: 'Main menu' }).click();
    await toMenu();
    await owner(false);
    const s2 = await state();
    const back = await garage(); await done();
    // the address: #owner turns it on and #owner=0 off on an open page (a fresh load reads it too, in settings.ts)
    const hash = await game(page, async () => {
      const g = window.__game, wait = () => new Promise((r) => setTimeout(r, 300)), saved = () => JSON.parse(localStorage.getItem('tsu.settings') || '{}').owner;
      location.hash = 'owner'; await wait();
      const a = { on: g.settings.owner, saved: saved(), car: g.carId };
      location.hash = 'owner=0'; await wait();
      const b = { on: g.settings.owner, saved: saved(), car: g.carId };
      location.hash = ''; await wait();
      return { a, b };
    });
    expect(s0.level < 8 && s0.vehicles.length >= Math.min(6, 1 + Math.floor(s0.level / 4)) && s0.credits < 60000, `the profile could buy the Vela: ${JSON.stringify(s0)}`);
    expect(!off.names.includes('Vela E') && off.names.length === 4 && off.names.includes('OC Hypercar') && !off.chip, `owner mode off lists ${off.names.join(', ')}, chip "${off.chip}"`);
    expect(on.chip === 'Owner mode' && on.names.includes('Vela E') && on.names.includes('OC Hypercar') && on.names.length === 5, `owner mode on lists ${on.names.join(', ')}, chip "${on.chip}"`);
    expect(on.drive === on.names.length && on.shop.length === 0, `owner mode: ${on.drive} of ${on.names.length} cards drivable, shop buttons ${on.shop.join(', ')}`);
    expect(s1.car === 'vela-e' && s1.built === 'vela-e' && s1.top > s0.top, `picked the Vela: car ${s1.car}, built ${s1.built}, top ${fmt(s1.top)} vs ${fmt(s0.top)} m/s`);
    expect(s1.saved === s0.saved && !s1.vehicles.includes('vela-e') && s1.chosen === s0.chosen, `the profile changed: ${s1.vehicles.join(',')} / ${s1.chosen}`);
    expect(pick === 'Vela E', `the menu's Car pick says ${pick}`);
    expect(run.built === 'vela-e' && Math.abs(run.top - s1.top) < 1e-6, `the run drove ${run.built}, top ${fmt(run.top)} m/s`);
    expect(!s2.owner && s2.car === s0.chosen && s2.built === s0.chosen && Math.abs(s2.top - s0.top) < 1e-6, `owner mode off: car ${s2.car}, built ${s2.built}`);
    expect(JSON.stringify(s2.vehicles) === JSON.stringify(s0.vehicles) && s2.chosen === s0.chosen, `owner mode off: vehicles ${s2.vehicles.join(',')}, chosen ${s2.chosen}`);
    expect(!back.chip && !back.names.includes('Vela E') && back.shop.some((t) => /^(Buy|Sell|Opens at)/.test(t)), `off again: ${back.names.join(', ')}, chip "${back.chip}", shop ${back.shop.join(', ')}`);
    expect(hash.a.on && hash.a.saved === true && hash.a.car === 'vela-e' && !hash.b.on && hash.b.saved === false && hash.b.car === s0.chosen, `#owner: ${JSON.stringify(hash)}`);
    return `off: ${off.names.join(', ')}; on: chip "${on.chip}", ${on.names.join(', ')}, ${on.drive}/${on.names.length} drivable; Vela E picked at level ${s0.level}, `
      + `${Math.round(s0.credits).toLocaleString()} credits, ${s0.vehicles.length} slots used: top ${Math.round(s0.top * MPH)} → ${Math.round(s1.top * MPH)} mph, run in ${run.built}; `
      + `profile unchanged (${s1.vehicles.join(', ')}, driving ${s1.chosen}); off: back to ${s2.car}; #owner on/off: ${hash.a.on}/${hash.b.on}`;
  });
  // the owner's test build (owner, 2026-10-21: "make sure the hypercar is playable on my end"): the artifact page that
  // npm run build writes opens in owner mode even where the device saved it off, the OC Hypercar ready to drive; the
  // page above (top-speed-ultra.html) is unmarked; #owner=0 still turns it off
  await check("owner test build: the artifact page opens in owner mode over a saved owner:false; the hypercar drivable; #owner=0 off", async () => {
    const ART = path.join(path.dirname(GAME), 'artifact.html');
    expect(existsSync(ART), `no ${ART}`);
    const marked = /<div id="root" data-build="owner-test">/.test(readFileSync(ART, 'utf8')), plain = !/data-build=/.test(readFileSync(GAME, 'utf8'));
    expect(marked && plain, `artifact marked ${marked}, top-speed-ultra.html unmarked ${plain}`);
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, density: 'moderate', owner: false })); } catch { /* about:blank */ } });
    const pg = await ctx.newPage(); pg.setDefaultTimeout(240000);
    await game(page, () => window.__game.setPaused(true));   // the group's own page stays still while this one boots
    const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
    const boot = async (hash) => {
      await pg.goto('about:blank');   // a load, not a fragment change on the open page
      await pg.goto(pathToFileURL(ART).href + hash);
      await pg.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu .pick'), null, { timeout: BOOT_MS });
      await pg.locator('.pick', { hasText: 'Car' }).first().click({ timeout: BOOT_MS });
      await pg.waitForSelector('.panel.profile .gcell.car', { timeout: BOOT_MS });
      return pg.evaluate(() => {
        const g = window.__game, card = [...document.querySelectorAll('.panel.profile .gcell.car')].find((c) => c.querySelector('.carhead b').textContent === 'OC Hypercar');
        return { owner: g.settings.owner, chip: document.querySelector('.panel.profile h2 .chip')?.textContent ?? '', car: g.carId, drive: !!card?.querySelector('button[aria-label="Drive the OC Hypercar"]') };
      });
    };
    const a = await boot('');
    await pg.getByRole('button', { name: 'Drive the OC Hypercar' }).click();
    const picked = await pg.evaluate(() => window.__game.carId);
    const b = await boot('#owner=0');
    await ctx.close();
    expect(a.owner && a.chip === 'Owner mode · test build' && a.car === 'rossini-gt' && a.drive && picked === 'oc-hyper', `test build: ${JSON.stringify(a)}, picked ${picked}`);
    expect(!b.owner && !b.chip && !b.drive, `#owner=0: ${JSON.stringify(b)}`);
    expect(errs.length === 0, errs.slice(0, 3).join(' | '));
    return `artifact page marked, top-speed-ultra.html not; saved owner:false → owner mode on, chip "${a.chip}", starter ${a.car}, hypercar picked (${picked}); #owner=0 → off, no Drive for it`;
  });
  // the OC Hypercar's two tunes on the HUD and the Free Drive earnings cap (PROJECT_OC_HYPERCAR.md M3, 5.5 item 10):
  // its tune chip reads Unleashed in Free Drive and Race tune in Speed Survival; Unleashed pays XP and credits for
  // distance at no more than the race tune's top speed, so flat out it earns what the race tune's pace would, while
  // the distance driven still counts in full on the profile. Owner mode puts the hypercar in the driver's seat.
  await check('OC Hypercar: Unleashed / Race tune chip, Free Drive earnings capped at the race tune\'s pace', async () => {
    const chips = () => game(page, () => [...document.querySelectorAll('.hud-chips i')].map((e) => e.textContent));
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Owner mode (all cars unlocked, test builds only)').check();
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    await page.waitForSelector('.overlay.menu', { timeout: 120000 });
    const was = await game(page, () => window.__game.carId);
    await game(page, () => window.__game.chooseOwnerCar('oc-hyper'));
    await drive(page, 'Free Drive');
    await frames(page, 2);
    const free = await chips();
    // 30 s each at 150 m/s (the plan's test speed: no road here lets the autopilot hold it, so the car is put back on
    // its lane at that speed every quarter second and coasts) and at 90 m/s, both Unleashed: what each paid
    const r = await game(page, () => {
      const g = window.__game, p = g.profile.p;
      g.setPaused(true);
      const run = (v) => {
        const c0 = p.credits, x0 = p.xp, d0 = p.distance, s0 = g.distance, n0 = g.steps;
        for (let k = 0; k < 120; k++) {
          g.traffic.clearAround(g.phys.x, g.phys.z, 400);
          g.phys.placeAt(g.path, g.phys.s, g.path.laneCenter(1), v);
          g.fastForward(0.25, { throttle: 0, brake: 0, steer: 0 });
        }
        g.fastForward(0.5, { throttle: 0, brake: 1, steer: 0 });               // the last half second's flush
        return { credits: p.credits - c0, xp: p.xp - x0, profileDist: p.distance - d0, driven: g.distance - s0, t: (g.steps - n0) / 120 };
      };
      return { driving: g.driving, mode: g.mode, cap: g.earnCap, fast: run(150), slow: run(90) };
    });
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.waitForSelector('.overlay.menu', { timeout: 120000 });
    await drive(page, 'Speed Survival');
    await frames(page, 2);
    const scored = await chips();
    const race = await game(page, () => { const g = window.__game; g.setPaused(true); return { driving: g.driving, mode: g.mode, cap: g.earnCap }; });
    // back to the menu with the car it came in with, for the checks after this one (the Founder Edition's garage card
    // opens from the menu and chooses the hypercar itself)
    await page.getByRole('button', { name: 'Main menu' }).click().catch(() => game(page, () => window.__game.quitToMenu()));
    await page.waitForSelector('.overlay.menu', { timeout: 120000 });
    await game(page, (id) => { const g = window.__game; g.chooseOwnerCar(id); g.applyCarChoice(); }, was);
    const paidFast = r.fast.credits * 200, paidSlow = r.slow.credits * 200;
    expect(r.driving === 'oc-hyper' && r.mode === 'free' && free.includes('Unleashed') && !free.includes('Race tune'), `Free Drive in ${r.driving}: chips ${free.join(', ')}`);
    expect(race.driving === 'oc-hyper' && race.mode === 'survival' && scored.includes('Race tune') && !scored.includes('Unleashed') && race.cap === 0, `Survival in ${race.driving}: chips ${scored.join(', ')}, cap ${race.cap}`);
    expect(r.cap > 100 && r.cap < 106, `cap ${fmt(r.cap)} m/s`);
    // (t: the simulated seconds, about 31.5: earnings are flushed every half second, so the window pays for between
    // t - 0.5 and t seconds at the cap, plus what was left over from before it, a few metres)
    const capM = r.cap * r.fast.t;
    expect(r.fast.driven > capM * 1.25, `at 150 m/s drove ${Math.round(r.fast.driven)} m in ${fmt(r.fast.t)} s, not over the cap's ${Math.round(capM)} m`);
    expect(paidFast <= capM + 20 && paidFast >= r.cap * (r.fast.t - 0.5) - 1 && Math.abs(r.fast.xp - 2 * r.fast.credits) < 1, `at 150 m/s paid for ${Math.round(paidFast)} m in ${fmt(r.fast.t)} s (cap ${Math.round(capM)} m), ${fmt(r.fast.xp)} XP for ${fmt(r.fast.credits)} credits`);
    expect(Math.abs(r.fast.profileDist - r.fast.driven) < 160, `the profile counted ${Math.round(r.fast.profileDist)} m of ${Math.round(r.fast.driven)} m driven`);
    expect(r.slow.driven < r.cap * r.slow.t && Math.abs(paidSlow - r.slow.driven) < 160, `at 90 m/s it paid for ${Math.round(paidSlow)} m of ${Math.round(r.slow.driven)} m`);
    return `Free Drive chips ${free.join(', ')}; Survival chips ${scored.join(', ')} (cap off); cap ${fmt(r.cap)} m/s; ${fmt(r.fast.t)} s at 150 m/s: drove ${Math.round(r.fast.driven)} m, `
      + `paid ${fmt(r.fast.credits)} credits / ${fmt(r.fast.xp)} XP (${Math.round(paidFast)} m; the cap allows ${Math.round(capM)}); ${fmt(r.slow.t)} s at 90 m/s: drove ${Math.round(r.slow.driven)} m, `
      + `paid ${Math.round(r.slow.credits)} credits / ${Math.round(r.slow.xp)} XP; profile distance ${Math.round(r.fast.profileDist)} m flat out`;
  });
  // the Founder Edition's exclusives (hypercar M6, PROJECT_OC_HYPERCAR.md section 7): no serial until the store assigns
  // one, so every plaque reads No. 0000 · TEST; Glacier Silver and the Founder Ice LEDs on the hypercar only
  await check('Founder Edition: the plaque reads "FOUNDER EDITION · No. 0000 · TEST" with no serial; Glacier Silver and Founder Ice on the hypercar only; still never bought or sold for credits', async () => {
    const r = await game(page, () => {
      const g = window.__game, f = g.founder;
      return { ...f, buy: g.profile.buy('oc-hyper', 0, 1, 6), sell: g.profile.sell('oc-hyper', 0), owned: g.profile.p.vehicles.includes('oc-hyper') };
    });
    expect(r.serial === null && r.number === 'No. 0000 · TEST' && r.plaque === 'FOUNDER EDITION · No. 0000 · TEST', `serial ${r.serial}, plaque "${r.plaque}"`);
    expect(r.paint.name === 'Glacier Silver' && r.led.name === 'Founder Ice' && r.until === '2026-12-31T23:59:59-08:00', `${r.paint.name}, ${r.led.name}, until ${r.until}`);
    const wrong = Object.entries(r.finishes).filter(([id, names]) => names.includes('Glacier Silver') !== (id === 'oc-hyper'));
    expect(!wrong.length, `Glacier Silver offered on: ${JSON.stringify(r.finishes)}`);
    expect(r.ledCars.join() === 'oc-hyper', `cars with the Founder Ice LED strips: ${r.ledCars.join(', ')}`);
    const asked = Object.entries(r.paints).filter(([id, hex]) => (hex === r.paint.hex) !== (id === 'oc-hyper'));
    expect(!asked.length, `Glacier Silver asked for on every car gives: ${JSON.stringify(r.paints)}`);
    expect(/never sold for credits/.test(r.buy) && /can't be sold/.test(r.sell) && !r.owned, `buy "${r.buy}", sell "${r.sell}", owned ${r.owned}`);
    return `"${r.plaque}" (serial ${r.serial}); ${r.paint.name} offered only on ${Object.entries(r.finishes).filter(([, n]) => n.includes('Glacier Silver')).map(([id]) => id).join(', ')}, asked for elsewhere gives the car's own paint; LED strips on ${r.ledCars.join(', ')}; buy "${r.buy}"`;
  });
  // its garage card: the reveal stage plays by itself once on this device, keeps its last frame for the session, plays
  // again on demand; choosing the car wakes its lights on the stage and on the car; reduced motion: nothing moves
  await check('the hypercar\'s garage card: the reveal stage plays once, keeps its last frame, Replay plays it again; choosing the car wakes its lights; reduced motion shows it still', async () => {
    await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, owner: true }); localStorage.removeItem('tsu.founderReveal'); });
    const lit = () => game(page, () => {
      const c = document.querySelector('.gcell.car.founder .fe-stage canvas'); if (!c) return null;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let sum = 0, max = 0, ice = 0;
      for (let i = 0; i < d.length; i += 16) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += l; max = Math.max(max, l); if (d[i + 2] > 180 && d[i + 2] > d[i] + 40) ice++; }
      return { mean: sum / (d.length / 16), max, ice, w: c.width, h: c.height };
    });
    const open = async () => { await page.locator('.pick', { hasText: 'Car' }).first().click(); await page.waitForSelector('.gcell.car.founder .fe-stage canvas'); };
    const done = async () => { await page.locator('.panel').getByRole('button', { name: 'Done' }).click(); await page.waitForSelector('.overlay.menu', { timeout: 120000 }); };
    await open();
    await page.waitForFunction(() => window.__game.revealState.frames > 0, null, { timeout: 900000, polling: 500 });
    const t1 = await game(page, () => window.__game.revealState);
    await page.waitForFunction(() => { const s = window.__game.revealState; return s.frames > 1 && !s.playing; }, null, { timeout: 900000, polling: 500 });
    const end = await game(page, () => ({ ...window.__game.revealState, seen: localStorage.getItem('tsu.founderReveal') }));
    const px = await lit();
    await done();
    await open();
    await page.waitForTimeout(600);
    const again = await game(page, () => window.__game.revealState), px2 = await lit();
    // Drive: the car is chosen, its lights wake (the player's car and the stage's)
    await page.locator('.gcell.car.founder').getByRole('button', { name: 'Drive' }).click();
    await page.waitForFunction(() => window.__game.carId === 'oc-hyper');
    const woke = await game(page, () => ({ car: window.__game.car.config?.car, wake: window.__game.founder.wake, stage: window.__game.revealState }));
    // reduced motion: Replay shows the last frame at once, and the car's lights are on at once
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.gcell.car.founder').getByRole('button', { name: 'Replay reveal' }).click();
    const still = await game(page, () => { const g = window.__game; g.wakeFounder(); return { stage: g.revealState, wake: g.founder.wake }; });
    await frames(page, 2, 400000);                         // the car's lights take the new state on its next frame
    still.after = await game(page, () => window.__game.founder.wake.value);
    await page.emulateMedia({ reducedMotion: null });
    await done();
    await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, owner: false }); });
    expect(t1.built && t1.kind === 'reveal' && (t1.playing || t1.t > 0), `first open: ${JSON.stringify(t1)}`);
    expect(!end.playing && end.t >= 6 && end.frames > 1 && end.still && end.seen === '1', `after the reveal: ${JSON.stringify(end)}`);
    expect(end.calls > 0 && end.calls <= 40 && end.tris > 1000 && end.tris <= 260000, `the stage frame: ${end.calls} calls, ${end.tris} triangles`);
    expect(px && px.mean > 4 && px.max > 150 && px.ice > 0, `the stage's last frame: ${JSON.stringify(px)}`);
    expect(!again.built && !again.playing && px2 && Math.abs(px2.mean - px.mean) < 3, `opened again: ${JSON.stringify(again)}, pixels ${JSON.stringify(px2)}`);
    expect(woke.car === 'oc-hyper' && woke.wake.t < 3 && woke.stage.kind === 'wake', `chosen: ${JSON.stringify(woke)}`);
    expect(!still.stage.playing && still.stage.t >= 6 && !still.wake.waking && still.wake.t >= 99 && still.after === 9, `reduced motion: ${JSON.stringify(still)}`);
    return `played ${end.frames} frames to ${fmt(end.t)} s (build ${end.buildMs} ms; a stage frame ${end.calls} calls, ${end.tris.toLocaleString()} triangles), last frame mean ${fmt(px.mean)}, ${px.ice} ice-blue samples; `
      + `reopened from the session's frame without building; chosen: lights at ${fmt(woke.wake.t)} s into the wake; reduced motion: stage at ${fmt(still.stage.t)} s, lights steady`;
  });
});

// SwiftShader here manages under 2 fps on Low and well under 1 fps on High and Ultra (a frame there can take over a
// minute), so this group renders small, moves the weather on with the game's own weather tick rather than waiting on
// real frames, and only renders High and Ultra with --slow
await group('render', async (use) => {
  const { page } = await use({ settings: { start: 'I-405 North' }, size: [640, 360] });
  await drive(page, 'Free Drive');
  await game(page, () => { const g = window.__game; g.setPaused(true); g.fastForward(3, {}, 30); });
  // a picture of the road without the pause panel over it
  const shot = async (name) => {
    const css = await page.addStyleTag({ content: '.overlay { visibility: hidden !important; }' });
    await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 240000 });
    await css.evaluate((e) => e.remove());
  };
  const sky = async (time, weather) => {
    // the sky eases with a 2.5 s time constant: 15 s of weather ticks settles it
    await game(page, ([t, w]) => { const g = window.__game; g.updateSettings({ ...g.settings, time: t, weather: w }); for (let i = 0; i < 150; i++) g.weatherTick(0.1); }, [time, weather]);
    await frames(page, 2);
    return game(page, () => { const e = window.__game.env; return { grip: e.grip, wet: e.wet, vis: e.visibility, day: e.daylight }; });
  };
  for (const [time, weather, want] of [
    ['day', 'clear', (e) => e.grip === 1 && e.day > 0.9],
    ['sunset', 'clear', (e) => e.day < 1],
    ['night', 'clear', (e) => e.day < 0.05],
    ['day', 'rain', (e) => Math.abs(e.grip - 0.8) < 0.01 && Math.abs(e.wet - 1) < 0.01],
    ['day', 'fog', (e) => Math.abs(e.vis - 0.14) < 0.01],
    ['day', 'mist', (e) => Math.abs(e.vis - 0.42) < 0.01],
  ]) {
    await check(`renders ${time}, ${weather}`, async () => {
      const e = await sky(time, weather);
      await shot(`sky-${time}-${weather}`);
      expect(want(e), JSON.stringify(e));
      return `grip ${fmt(e.grip)}, wet ${fmt(e.wet)}, visibility ${fmt(e.vis)}, daylight ${fmt(e.day)}`;
    });
  }
  // the palms (R4): instanced crowns of alpha-tested frond cards, inside the old crown's 448 triangles, casting
  // shadows; the frond texture has gaps between its leaflets and keeps its colour under the transparent texels
  await check('palms: alpha-tested frond crowns within the old triangle budget', async () => {
    const r = await game(page, () => {
      let crowns = 0, inst = 0, tris = 0, cast = true, mat = null;
      window.__game.terrain.group.traverse((o) => {
        if (!o.isInstancedMesh || !(o.material.alphaTest > 0)) return;
        crowns++; inst += o.count; cast &&= o.castShadow; mat = o.material;
        tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });
      if (!mat) return { crowns };
      const img = mat.map.image, at = mat.alphaTest * 255, a = (x, y) => img.data[(y * img.width + x) * 4 + 3];
      let gap = 0, leaf = 0;
      for (let y = 150; y < 350; y++) for (let x = 68; x < 188; x++) if (a(x, y) < at) gap++; else leaf++;
      const i0 = (300 * img.width + 4) * 4, under = [...img.data.slice(i0, i0 + 4)];
      return { crowns, inst, tris, cast, double: mat.side === 2, w: img.width, gap: gap / (gap + leaf), under };
    });
    expect(r.crowns > 0, 'no palm crowns built on I-405 North');
    expect(r.tris <= 448 && r.cast && r.double, `${r.tris} triangles a crown (the old one was 448), casts shadows ${r.cast}, double-sided ${r.double}`);
    expect(r.gap > 0.15 && r.gap < 0.85, `the frond blade is ${fmt(r.gap * 100)}% gaps`);
    expect(r.under[3] === 0 && r.under[0] + r.under[1] + r.under[2] > 60, `a transparent texel holds rgba ${r.under.join(',')}`);
    return `${r.inst} palms in ${r.crowns} crown meshes, ${r.tris} triangles a crown at Low, castShadow set; blade ${fmt(r.gap * 100)}% gaps; transparent texel rgba ${r.under.join(',')}`;
  });
  // the buildings (W1): house plans (two at Low, four above) and three office types, each one instanced mesh with one material over an
  // atlas whose alpha is the tint mask; every instance's colour packs its tint and its strip (roof row or facade style)
  await check('buildings: house plans and office types, one draw call each, a look per instance', async () => {
    const r = await game(page, () => {
      const kinds = {}, roofs = new Set(), styles = new Set(), tints = new Set();
      let single = true, mask = null;
      window.__game.terrain.group.traverse((o) => {
        const n = o.isInstancedMesh ? o.geometry.name : '';
        if (!/^(house|office)-/.test(n)) return;
        const tris = o.geometry.attributes.position.count / 3;
        const k = (kinds[n] ??= { meshes: 0, inst: 0, tris });
        k.meshes++; k.inst += o.count;
        single &&= !Array.isArray(o.material) && !!o.instanceColor;
        if (!mask && n.startsWith('house')) { const d = o.material.map.image.data; let a0 = 0, a1 = 0; for (let i = 3; i < d.length; i += 4) d[i] === 0 ? a0++ : d[i] === 255 && a1++; mask = { a0, a1, all: d.length / 4 }; }
        const c = o.instanceColor?.array ?? [];
        for (let i = 0; i < o.count; i++) {
          const kk = Math.floor(c[i * 3] / 2);
          (n.startsWith('house') ? roofs : styles).add(kk);
          if (n.startsWith('house')) tints.add([c[i * 3] - 2 * kk, c[i * 3 + 1] % 2, c[i * 3 + 2]].map((v) => v.toFixed(2)).join());
        }
      });
      return { kinds, single, mask, roofs: [...roofs].sort(), styles: [...styles].sort(), tints: tints.size };
    });
    const plans = Object.keys(r.kinds).filter((n) => n.startsWith('house')).sort(), offices = Object.keys(r.kinds).filter((n) => n.startsWith('office'));
    expect(plans.join() === 'house-0,house-1', `house plans built at Low: ${plans.join(', ') || 'none'} (Low builds plans 0 and 1)`);
    expect(offices.length > 0, 'no office types built on I-405 North');
    expect(r.single, 'a building mesh has several materials or no instance colours');
    const worst = Math.max(...plans.map((n) => r.kinds[n].tris));
    expect(worst <= 48, `a house plan has ${worst} triangles at Low (budget 48)`);
    expect(r.mask && r.mask.a0 > 0.01 * r.mask.all && r.mask.a1 > 0.5 * r.mask.all, `the stucco atlas's tint mask: ${JSON.stringify(r.mask)}`);
    expect(r.roofs.length === 3 && r.tints >= 6, `roof rows used ${r.roofs.join(',')}, ${r.tints} stucco tints`);
    return `${plans.map((n) => `${n} ${r.kinds[n].inst} in ${r.kinds[n].meshes} meshes, ${r.kinds[n].tris} tris`).join('; ')}; ${offices.map((n) => `${n} ${r.kinds[n].inst}`).join(', ')}; roofs ${r.roofs.join(',')}, office styles ${r.styles.join(',')}, ${r.tints} stucco tints; mask ${(100 * r.mask.a0 / r.mask.all).toFixed(1)}% untinted`;
  });
  await check('Live time follows the real sun over OC', async () => {
    await page.clock.setFixedTime(new Date('2026-10-12T09:13:00Z'));        // 02:13 Pacific
    const night = await sky('live', 'clear');
    await page.clock.setFixedTime(new Date('2026-10-12T20:00:00Z'));        // 13:00 Pacific
    const noon = (await sky('live', 'clear')).day;
    expect(night.day === 0 && noon > 0.9, `02:13 → ${fmt(night.day)}, 13:00 → ${fmt(noon)}`);
    await sky('day', 'clear');
    return `02:13 Pacific: daylight ${fmt(night.day)}; 13:00: ${fmt(noon)}`;
  });
  // the OC Hypercar's lights and cockpit (PROJECT_OC_HYPERCAR.md M2). The check needs no owner mode or garage pick:
  // its body, wheels and cockpit go on the player's car directly (the profile car's physics stay), then back again.
  await check('OC Hypercar: seat, beams from the blades, brake bar and haze, turn signals, reversing lamps (M2)', async () => {
    const r = await game(page, () => {
      const g = window.__game, c = g.car, cfg = c.config;
      g.fastForward(3, {}, 30);
      const v0 = g.phys.vx;
      c.configure({ ...cfg, car: 'oc-hyper', paint: 0xc8d3e8 });
      const ext = c.exterior, lamps = ['sigL', 'sigR', 'reverse', 'brakeGlow'].map((k) => ext.getObjectByName(k));
      const out = { eye: c.eye.position.toArray(), beam: c.beams[1].position.toArray(), built: lamps.every(Boolean), hidden: lamps.every((m) => m && !m.visible) };
      c.update(0, 1, g.phys, true, g.time); out.brake = c.mats.tail.emissiveIntensity; out.glow = lamps[3].visible;
      c.update(0, 1, g.phys, false, g.time); out.free = c.mats.tail.emissiveIntensity; out.levels = c.mats.tail.userData.levels; out.glowOff = !lamps[3].visible;
      const d0 = g.phys.d;
      for (let k = 0; k < 40 && !out.lane; k++) {
        g.fastForward(0.05, { steer: k < 12 ? 0.22 : 0, throttle: 0.3, brake: 0 });
        c.update(0, 1, g.phys, false, g.time);
        const s = c.lightState;
        if (s.signal > 0 && s.blink) out.lane = { t: (k + 1) * 0.05, dd: g.phys.d - d0, R: lamps[1].visible, L: lamps[0].visible };
      }
      // a turn at walking pace each way: brake to a stop, creep, steer hard; the signal on the side it turns to
      out.turn = [];
      for (const steer of [-1, 1]) {
        for (let k = 0; k < 400 && g.phys.vx > 0.3; k++) g.fastForward(0.05, { steer: 0, throttle: 0, brake: 1 });
        g.fastForward(1.2, { steer: 0, throttle: 0.2, brake: 0 });
        g.fastForward(0.6, { steer, throttle: 0.1, brake: 0 });
        c.update(0, 1, g.phys, false, g.time);
        out.turn.push({ steer, v: +g.phys.vx.toFixed(2), signal: c.lightState.signal });
      }
      g.fastForward(5, { steer: 0, throttle: 0, brake: 1 }); g.fastForward(1.5, { steer: 0, throttle: 0, brake: 1 });
      c.update(0, 1, g.phys, false, g.time);
      out.rev = { gear: g.phys.gear, vx: g.phys.vx, on: lamps[2].visible, signal: c.lightState.signal };
      // leave the car as the next checks expect it: driving forward in the nearest lane at the speed it came in at.
      // Backing up for the reversing lamps left it rolling backwards at about 8 m/s, which the pause and reset checks'
      // autopilot did not always undo in their few seconds (on a loaded machine they failed: s went backwards on resume)
      Object.assign(g.input.c, { throttle: 0, brake: 0, steer: 0 });
      let lane = 0;
      for (let l = 1; l < g.path.lanes; l++) if (Math.abs(g.path.laneCenter(l) - g.phys.d) < Math.abs(g.path.laneCenter(lane) - g.phys.d)) lane = l;
      g.placeCar(g.path, g.phys.s, lane, v0);
      out.after = { gear: g.phys.gear, vx: g.phys.vx };
      out.gauge = !!c.interior.gaugeAt; out.rearView = !!c.interior.group.getObjectByName('rear-view-mirror');
      c.configure({ ...cfg });
      out.back = c.config.car; out.was = cfg.car;
      return out;
    });
    // the car was rebuilt twice: draw a few frames here (compiling its materials' shaders again on a slow machine), so
    // the checks after this one don't pay for it inside their own frame timeouts
    const tw = Date.now();
    await frames(page, 3, 240000);
    const warm = (Date.now() - tw) / 1000;
    expect(r.built && r.hidden, `switched lamps built ${r.built}, hidden until lit ${r.hidden}`);
    expect(Math.abs(r.eye[0] + 0.27) < 0.005 && Math.abs(r.eye[1] - 0.96) < 0.005, `the hypercar's eye at ${r.eye.map(fmt)} (want -0.27, 0.96)`);
    expect(r.beam[2] < -2.2 && r.beam[1] < 0.5 && r.beam[0] > 0.3, `beam at ${r.beam.map(fmt)}: not from the blade`);
    // (its thin bar: a dim tail light and a bright stop, lampMaterials' 'blade' levels; every other car keeps 1.6 → 5)
    expect(r.free === 0.5 && r.brake === 6 && r.levels?.[0] === 0.5, `red bar ${r.free} → ${r.brake} on the brakes (levels ${JSON.stringify(r.levels)})`);
    expect(r.glow && r.glowOff, `the stop light's haze: on the brakes ${r.glow}, off without ${r.glowOff}`);
    expect(r.lane && r.lane.R && !r.lane.L, `lane change right: ${JSON.stringify(r.lane)}`);
    expect(r.turn.every((t) => t.v > 0.5 && t.v < 12 && t.signal === t.steer), `low-speed turns: ${JSON.stringify(r.turn)} (steer -1 is left, signal -1 left)`);
    expect(r.rev.gear < 0 && r.rev.on && r.rev.signal === 0, `reversing (lamps on, no signal): ${JSON.stringify(r.rev)}`);
    expect(r.gauge && !r.rearView && r.back === r.was, `gauge pod ${r.gauge}, rear-view ${r.rearView}, back to ${r.back} (was ${r.was})`);
    expect(r.after.gear > 0 && r.after.vx > 20, `left driving forward: ${JSON.stringify(r.after)}`);
    return `eye ${r.eye.map(fmt)}, beam ${r.beam.map(fmt)}; bar ${r.free} → ${r.brake} and its haze; right signal lit ${fmt(r.lane.t)} s into a lane change (${fmt(r.lane.dd)} m); turns at ${r.turn.map((t) => fmt(t.v)).join(' and ')} m/s signal ${r.turn.map((t) => t.signal).join(', ')}; reverse lamps on in gear ${r.rev.gear}, no signal; left driving at ${fmt(r.after.vx)} m/s, 3 frames in ${fmt(warm)} s`;
  });
  await check('pause stops the simulation, resume carries on', async () => {
    const r = await game(page, () => { const g = window.__game; g.fastForward(5, {}, 35); return g.phys.s; });
    await frames(page, 5);
    const paused = await game(page, () => window.__game.phys.s);
    await game(page, () => window.__game.setPaused(false));
    await frames(page, 5);
    const resumed = await game(page, () => window.__game.phys.s);
    expect(paused === r && resumed > paused, `s ${fmt(r)} → paused ${fmt(paused)} → resumed ${fmt(resumed)}`);
    return `held at s ${Math.round(paused)} m over 5 frames, then moved ${fmt(resumed - paused)} m`;
  });
  await check('reset puts the car back on the road, stopped', async () => {
    const v0 = await game(page, () => { const g = window.__game; g.setPaused(true); g.fastForward(4, {}, 40); g.setPaused(false); g.pushAction('reset'); return g.phys.vx; });
    await frames(page, 5);
    const v1 = await game(page, () => { const g = window.__game, v = g.phys.vx; g.setPaused(true); return v; });
    expect(v0 > 30 && Math.abs(v1) < 1, `${fmt(v0)} → ${fmt(v1)} m/s`);
    return `${fmt(v0)} → ${fmt(v1)} m/s`;
  });
  await check('recovers from a lost WebGL context', async () => {
    await game(page, () => { window.__lose = window.__game.renderer.getContext().getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
    await page.getByText('Graphics reset').waitFor({ timeout: 10000 });
    const lost = await game(page, () => ({ paused: window.__game.isPaused, lost: window.__game.renderer.getContext().isContextLost() }));
    await game(page, () => window.__lose.restoreContext());
    await page.waitForFunction(() => !window.__game.renderer.getContext().isContextLost(), null, { timeout: 15000 });
    await page.getByRole('button', { name: 'Resume' }).first().click();
    await frames(page, 5, 240000);
    const after = await game(page, () => ({ paused: window.__game.isPaused, roads: window.__game.stats.roads }));
    expect(lost.lost && lost.paused && !after.paused, `lost ${JSON.stringify(lost)}, after ${JSON.stringify(after)}`);
    await game(page, () => window.__game.setPaused(true));
    await shot('after-context-loss');
    return `paused while lost, rendering again after Resume (${after.roads} road chunks)`;
  });
  // last, because the first frames after a switch compile new shaders and take minutes here
  await check(`High and Ultra presets rebuild mid-drive${slow ? ' and render' : ' (rebuild only; --slow renders them)'}`, async () => {
    const out = [];
    let crownHigh = 0;
    for (const q of ['high', 'ultra', 'low']) {
      const t0 = Date.now();
      const s = await game(page, (qq) => {
        const g = window.__game; g.updateSettings({ ...g.settings, quality: qq });
        // the live rear-view (a render target on the glass) comes with High and Ultra on a desktop; Low keeps the environment map
        let live = false; g.scene.traverse((o) => { if (o.name === 'rear-view-mirror' && o.target) live = true; });
        // the palm crowns' triangles at this tier (alpha-tested frond cards; fewer fronds below High)
        let crown = 0; g.terrain.group.traverse((o) => { if (o.isInstancedMesh && o.material.alphaTest > 0) crown = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
        // the house plans built (W1): four on High and Ultra, two on Low
        const plans = new Set(); g.terrain.group.traverse((o) => { if (o.isInstancedMesh && /^house-/.test(o.geometry.name)) plans.add(o.geometry.name); });
        return { ...g.stats, post: !!g.composer, live, crown, plans: plans.size };
      }, q);
      crownHigh ||= s.crown;
      expect(s.crown > 0 && s.crown <= 448 && (q === 'low') === (s.crown < crownHigh), `${q}: palm crowns of ${s.crown} triangles (High ${crownHigh})`);
      expect(s.roads > 0 && s.tiles > 0, `${q}: ${s.roads} road chunks, ${s.tiles} tiles`);
      expect(s.plans === (q === 'low' ? 2 : 4), `${q}: ${s.plans} house plans built`);
      expect(s.post === (q !== 'low'), `${q}: post-processing ${s.post ? 'on' : 'off'}`);
      expect(s.live === (q !== 'low'), `${q}: live mirrors ${s.live ? 'on' : 'off'}`);
      if (slow || q === 'low') await frames(page, 3, 400000);
      if (slow && q !== 'low') await shot(`quality-${q}`);
      out.push(`${q}: ${s.roads} chunks, ${s.tiles} tiles, post ${s.post ? 'on' : 'off'}, mirrors ${s.live ? 'live' : 'env'}, palm crowns ${s.crown} triangles, ${s.plans} house plans${slow || q === 'low' ? `, 3 frames in ${((Date.now() - t0) / 1000).toFixed(0)} s` : ''}`);
    }
    return out.join('; ');
  });
  // hypercar M6: the Founder Edition's lights wake on the start line (a run's start; Races were removed): dark, then
  // the sweep (car-wake.ts: one progress uniform, 0 to 1.1 over 1.2 s), then steady; only its LED strips, headlamp
  // blades and red bar take part (the GT's tail material has no wake in its shader); reduced motion: on at once
  await check('the Founder Edition\'s lights wake on the start line: dark, a 1.2 s sweep, then steady; only its own lights take part; at once with reduced motion', async () => {
    const gt = await game(page, () => { const g = window.__game, m = g.car.mats; return { car: g.car.config?.car, tail: m.tail.customProgramCacheKey(), led: !!m.led }; });
    await hyperIn(page, 'free');
    const keys = await game(page, () => { const m = window.__game.car.mats; return { led: m.led.customProgramCacheKey(), lamp: m.lamp.customProgramCacheKey(), tail: m.tail.customProgramCacheKey(), wake: window.__game.founder.wake }; });
    // sample the sweep on real frames from a fresh wake
    await game(page, () => {
      const g = window.__game; window.__wk = [];
      g.setPaused(false); g.wakeFounder();
      const tick = () => { const w = g.founder.wake; window.__wk.push(w.value); if (w.waking || window.__wk.length < 3) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await page.waitForFunction(() => !window.__game.founder.wake.waking && window.__wk.length >= 3, null, { timeout: 900000, polling: 500 });
    const wk = await game(page, () => { window.__game.setPaused(true); return window.__wk; });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await game(page, () => { const g = window.__game; g.wakeFounder(); return g.founder.wake; });
    await page.emulateMedia({ reducedMotion: null });
    await frames(page, 1, 400000);
    const after = await game(page, () => window.__game.founder.wake.value);
    const mid = wk.filter((v) => v > 0.02 && v < 1.1);
    const rising = wk.every((v, i) => i === 0 || v >= wk[i - 1] - 1e-9);
    expect(gt.car === 'rossini-gt' && !gt.led && !/wake/.test(gt.tail), `the GT: ${JSON.stringify(gt)}`);
    expect(/wake-ice/.test(keys.led) && /wake-ice/.test(keys.lamp) && /wake-bar/.test(keys.tail), `the hypercar's lights: ${JSON.stringify(keys)}`);
    expect(wk[0] < 0.3 && mid.length >= 2 && rising && wk[wk.length - 1] === 9, `the sweep's progress frame by frame: ${wk.map(fmt).join(', ')}`);
    expect(!reduced.waking && reduced.t >= 99 && after === 9, `reduced motion: ${JSON.stringify(reduced)}, then ${after}`);
    await page.getByRole('button', { name: 'Main menu' }).click().catch(() => game(page, () => window.__game.quitToMenu()));
    const dark = wk.findIndex((v) => v > 0), last = wk.length - 2;
    return `GT tail shader without the wake; the hypercar's LEDs, blades and red bar with it; over ${wk.length} frames: dark for ${dark}, then ${fmt(wk[dark])} → ${fmt(wk[Math.floor((dark + last) / 2)])} → ${fmt(wk[last])} (${mid.length} frames mid-sweep), then steady (${wk[wk.length - 1]}); reduced motion: steady at once`;
  });
});

// The condensed HUD (HUD_POV_SPEC 5): what the driving HUD covers and where, in the page. HUD_SEL are the readouts and
// the top cluster, CONTROL_SEL the control row; rects that are hidden, faded out or empty don't count. Area is the union
// on a 2 px grid (nested boxes count once). `band` is the open view, 22% to 70% of the height; the chase car's and the
// seat cluster's boxes are the projected boxes of their meshes.
function hudLayoutInPage() {
  const g = window.__game, cam = g.camera, W = innerWidth, H = innerHeight;
  const HUD_SEL = ['.hud-plate', '.hud-speed', '.hud-stats', '.hud-race', '.hud-road', '.hud-compass', '.hud-clock', '.corner', '.tbar .tbtn', '.livechip', '.hud-nav', '.hud-dest', '.hud-next', '.hud-fps'];
  // Auto-drive's button sits with the driving controls on a phone (with a route in Free Drive)
  const CONTROL_SEL = ['.touch-steer', '.pedal', '.touch-shift .tbtn', '.hud-ability', '.tbtn.honk', '.tbtn.auto'];
  const shown = (e) => {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 0 || r.height <= 0) return false;
    for (let a = e; a && a !== document.body; a = a.parentElement) if (Number(getComputedStyle(a).opacity) <= 0.05) return false;
    return true;
  };
  const rects = (sels, skip) => sels.flatMap((q) => [...document.querySelectorAll(q)]).filter((e) => !(skip && e.matches(skip)) && shown(e))
    .map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, sel: String(e.className.baseVal ?? e.className).split(' ')[0] }; });
  const hud = rects(HUD_SEL, '.tbtn.honk, .tbtn.auto'), ctl = rects(CONTROL_SEL);
  let n = 0; for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) if (hud.some((q) => x >= q.l && x < q.r && y >= q.t && y < q.b)) n++;
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const cv = document.querySelector('.stage canvas'), R = cv.getBoundingClientRect();
  const toScreen = (v) => { v.project(cam); return { x: R.left + (v.x + 1) / 2 * R.width, y: R.top + (1 - v.y) / 2 * R.height }; };
  const box = (obj) => {
    if (!obj) return null;
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9; obj.updateMatrixWorld(true);
    obj.traverse((m) => { if (!m.isMesh || !m.visible) return; const gb = m.geometry; gb.boundingBox || gb.computeBoundingBox(); const { min, max } = gb.boundingBox;
      for (const cx of [min.x, max.x]) for (const cy of [min.y, max.y]) for (const cz of [min.z, max.z]) { const p = toScreen(m.localToWorld(cam.position.clone().set(cx, cy, cz))); l = Math.min(l, p.x); r = Math.max(r, p.x); t = Math.min(t, p.y); b = Math.max(b, p.y); } });
    return { l, t, r, b };
  };
  const d = cam.getWorldDirection(cam.position.clone()); d.y = 0; d.normalize().multiplyScalar(2000).add(cam.position);
  const horizon = toScreen(d).y;
  const view = document.querySelector('.hud')?.dataset.view, seat = view === 'cockpit';
  const cluster = seat ? box(g.car.interior.group.getObjectByName('cluster')) : null, glass = seat ? box(g.car.interior.group.getObjectByName('windscreen')) : null;
  const car = seat ? null : box(g.car.exterior), band = { l: 0, r: W, t: 0.22 * H, b: 0.7 * H };
  const taps = [...document.querySelectorAll('.tbar .tbtn, .corner, .hud-ability, .tbtn.honk, .tbtn.auto, .touch-steer, .pedal, .touch-shift .tbtn')].filter(shown)
    .map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, sel: String(e.className).split(' ').slice(0, 2).join('.') }; });
  const overlaps = []; for (let i = 0; i < taps.length; i++) for (let j = i + 1; j < taps.length; j++) if (hit(taps[i], taps[j])) overlaps.push(taps[i].sel + ' / ' + taps[j].sel);
  const sp = document.querySelector('.hud-speed');
  return { W, H, view, area: (n * 4) / (W * H), top: Math.max(0, ...hud.map((q) => q.b)) / H, ctlTop: Math.min(H, ...ctl.map((q) => q.t)) / H,
    band: hud.filter((q) => hit(q, band)).map((q) => q.sel), onCar: car ? hud.filter((q) => hit(q, car)).map((q) => q.sel) : [],
    horizon: horizon / H, cluster: cluster && { mid: (cluster.t + cluster.b) / 2 / H, bottom: cluster.b / H, hits: [...hud, ...ctl].filter((q) => hit(q, cluster)).map((q) => q.sel) },
    onGlass: glass ? hud.filter((q) => hit(q, { l: glass.l, r: glass.r, t: Math.max(glass.t, horizon), b: glass.b })).map((q) => q.sel) : [],
    speed: sp ? getComputedStyle(sp).display !== 'none' : false, small: taps.filter((q) => q.w < 43.5 || q.h < 43.5).map((q) => `${q.sel} ${Math.round(q.w)}x${Math.round(q.h)}`), overlaps };
}
const pct = (f) => (f * 100).toFixed(1) + '%';

// The driving HUD's boxes with a destination set (owner, 2026-11-09): every visible HUD box (the plate or, on a desktop,
// the navigation panel and the numbers, the road sign, the speed, THRUST's panel and button, the ability, the rail's
// buttons, the corner window, the clock, and the touch controls), the outermost only (a phone's plate holds its lines),
// which pairs overlap, which run outside the viewport minus the safe areas (.app's --sa-*, read off a probe), and
// whether the destination's "at your pace" and "simulated" show whole inside it.
function hudBoxesInPage() {
  const W = innerWidth, app = document.querySelector('.app');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:var(--sa-l);top:var(--sa-t);right:var(--sa-r);bottom:var(--sa-b);visibility:hidden;pointer-events:none';
  app.appendChild(probe); const sa = probe.getBoundingClientRect(); probe.remove();
  const SEL = ['.hud-plate', '.hud-navs', '.hud-nav', '.hud-dest', '.hud-next', '.hud-roadname', '.hud-stats', '.hud-speed', '.hud-thrust', '.hud-thrustbtn', '.hud-ability', '.hud-clock',
    '.hud-fps', '.tbar .tbtn', '.corner', '.livechip', '.venue-prompt', '.touch-steer', '.pedal', '.touch-shift .tbtn', '.tbtn.honk'];
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    for (let a = e; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.05) return false; }
    return true;
  };
  const els = [...new Set(SEL.flatMap((q) => [...document.querySelectorAll(q)]))].filter(shown);
  const top = els.filter((e) => !els.some((o) => o !== e && o.contains(e)));
  const name = (e) => String(e.className.baseVal ?? e.className).split(' ').slice(0, 2).join('.');
  const bx = top.map((e) => { const r = e.getBoundingClientRect(); return { n: name(e), l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const hit = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const overlaps = [], outside = [];
  for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) if (hit(bx[i], bx[j])) overlaps.push(`${bx[i].n} / ${bx[j].n}`);
  for (const b of bx) if (b.l < sa.left - 0.5 || b.t < sa.top - 0.5 || b.r > sa.right + 0.5 || b.b > sa.bottom + 0.5) outside.push(`${b.n} ${Math.round(b.l)},${Math.round(b.t)}..${Math.round(b.r)},${Math.round(b.b)}`);
  const dest = document.querySelector('.hud-dest'), dr = dest.getBoundingClientRect();
  const labels = [...dest.querySelectorAll('em')].filter((e) => /pace|simulated/.test(e.textContent)).map((e) => {
    const r = e.getBoundingClientRect();
    return { t: e.textContent, ok: shown(e) && r.left >= dr.left - 0.5 && r.right <= dr.right + 0.5 && r.right <= W && e.scrollWidth <= e.clientWidth + 1 };
  });
  const has = Object.fromEntries([['dest', '.hud-dest'], ['nav', '.hud-nav'], ['thrust', '.hud-thrustbtn'], ['ability', '.hud-ability']].map(([k, q]) => [k, shown(document.querySelector(q))]));
  return { layout: app.dataset.hud, boxes: bx.length, overlaps, outside, labels, has, safe: { l: sa.left, t: sa.top, r: sa.right, b: sa.bottom }, side: document.documentElement.scrollWidth > W };
}

await group('phone', async (use) => {
  // Modern, so the controls stay put while the checks press them (a phone's first run is Minimal; the last check here
  // covers its tuck and wake)
  const { page } = await use({ phone: true, settings: { hudStyle: 'modern' } });
  const noSideScroll = () => game(page, () => document.documentElement.scrollWidth <= innerWidth);
  await check('menu fits a 390 × 844 phone', async () => {
    await page.screenshot({ path: path.join(OUT, 'phone-menu.png') });
    expect(await noSideScroll(), 'the page scrolls sideways');
  });
  // the main menu is one persistent glass sheet (owner, 2026-10-16: "more seamless"): opening a screen changes what the
  // sheet shows, the sheet and the Drive dock stay, and the dock marks where you are
  await check('menu: one sheet; the Drive dock stays while its screens change', async () => {
    await game(page, () => { document.querySelector('.sheet').dataset.k = 'first'; });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForTimeout(400);
    const r = await game(page, () => ({ same: document.querySelector('.sheet')?.dataset.k === 'first', title: document.querySelector('.sheet-body .panel h2')?.textContent,
      go: !!document.querySelector('.dock .btn.go'), here: document.querySelector('.dock [aria-current="page"]')?.textContent }));
    const drives = await page.getByRole('button', { name: 'Drive', exact: true }).count();
    expect(r.same && r.title === 'Settings' && r.go && r.here === 'Settings', JSON.stringify(r));
    expect(drives === 1, `${drives} Drive buttons`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();   // the dock's button toggles back
    await page.waitForTimeout(400);
    expect(await page.locator('.sheet.home .modes').count() === 1, 'not back on the menu');
    return `same sheet, dock marks ${r.here}, one Drive button`;
  });
  await check('profile screen renders', async () => {
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'phone-profile.png') });
    expect(await noSideScroll(), 'the page scrolls sideways');
    const text = await page.locator('.overlay').last().innerText();
    expect(/level/i.test(text), 'no level shown');
    await page.keyboard.press('Escape');
  });
  // hypercar M6: the Founder Edition's garage card at phone size: its reveal stage sits inside the card at 16:9 and plays,
  // the caption and the Replay button don't collide, and nothing scrolls sideways
  await check('the Founder Edition card at 390 × 844: the reveal stage fits the card at 16:9 and plays; caption and Replay apart; no sideways scroll', async () => {
    await page.locator('.pick', { hasText: 'Car' }).first().click();
    await page.waitForSelector('.gcell.car.founder .fe-stage canvas');
    await page.waitForFunction(() => window.__game.revealState.frames > 0, null, { timeout: 900000, polling: 500 });
    await game(page, () => document.querySelector('.gcell.car.founder').scrollIntoView({ block: 'start' }));
    await frames(page, 2, 400000);
    await page.screenshot({ path: path.join(OUT, 'phone-garage-founder.png') });
    const r = await game(page, () => {
      const box = (q) => { const b = document.querySelector(q).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { stage: box('.fe-stage'), card: box('.gcell.car.founder'), cap: box('.fe-cap'), btn: box('.fe-replay'), w: innerWidth, side: document.documentElement.scrollWidth > innerWidth, state: window.__game.revealState };
    });
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    const { stage: st, card, cap, btn } = r, hit = (a, b) => !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);
    expect(st.l >= card.l && st.r <= card.r && st.l >= 0 && st.r <= r.w && Math.abs((st.r - st.l) / (st.b - st.t) - 16 / 9) < 0.03, `stage ${JSON.stringify(st)} in card ${JSON.stringify(card)}`);
    expect(!hit(cap, btn) && btn.b - btn.t >= 36 && btn.r <= st.r && cap.l >= st.l, `caption ${JSON.stringify(cap)}, Replay ${JSON.stringify(btn)}`);
    expect(!r.side, 'the page scrolls sideways');
    expect(r.state.built && r.state.frames > 0 && r.state.calls > 0, `stage: ${JSON.stringify(r.state)}`);
    return `stage ${Math.round(st.r - st.l)} × ${Math.round(st.b - st.t)} px in a ${Math.round(card.r - card.l)} px card; a stage frame ${r.state.calls} calls, ${r.state.tris.toLocaleString()} triangles (the phone build), ${r.state.frames} frames so far`;
  });
  // the driving profiles at 390 x 844: each button puts the one handling value (Settings, the save and the physics) on
  // its point, the slider moved off a point reads Custom with its own line, and the page never scrolls sideways
  await check('Settings at 390 × 844: Arcade, Sport and Simulation set the handling to 0.15 / 0.5 / 0.9; off those points it reads Custom; one line each; saved', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const f = page.locator('.field.handling');
    await f.waitFor();
    await f.scrollIntoViewIfNeeded();
    const r0 = await game(page, readHandling), seen = [];
    expect(r0.value === HANDLING && r0.phys === HANDLING && r0.out === `${profileName(HANDLING)} · ${HANDLING.toFixed(2)}`, `opened at ${JSON.stringify(r0)}`);
    for (const [name, h] of PROFILE_AT) {
      await f.getByRole('button', { name, exact: true }).click();
      const r = await game(page, readHandling);
      expect(r.value === h && r.settings === h && r.phys === h && r.saved === h, `${name}: slider ${r.value}, settings ${r.settings}, physics ${r.phys}, saved ${r.saved}`);
      expect(r.out === `${name} · ${h.toFixed(2)}` && r.pressed.join() === name && r.lit.join() === name && r.lines === 3 && r.buttons.join() === 'Arcade,Sport,Simulation', `${name}: reads "${r.out}", pressed ${r.pressed.join()}, lit ${r.lit.join()}, ${r.lines} lines, buttons ${r.buttons.join()}`);
      expect(!r.sideScroll, `${name}: the page scrolls sideways`);
      if (name === 'Arcade') { await game(page, () => document.querySelector('.field.handling').scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(OUT, 'phone-settings-arcade.png') }); }
      seen.push(`${name} ${r.value}: "${r.active}"`);
    }
    // one step left of Simulation on the slider (the keyboard, as a switch user would): Custom, between Sport and Simulation
    await page.locator('#handling').focus();
    await page.keyboard.press('ArrowLeft');
    const c = await game(page, readHandling);
    expect(Math.abs(c.value - 0.85) < 1e-9 && c.settings === c.value && c.phys === c.value && c.saved === c.value, `custom: slider ${c.value}, settings ${c.settings}, physics ${c.phys}, saved ${c.saved}`);
    expect(c.out === 'Custom · 0.85' && c.pressed.length === 0 && c.lit.join() === 'Custom' && c.lines === 4 && /Between Sport and Simulation/.test(c.active), `custom: reads "${c.out}", pressed ${c.pressed.join()}, lit ${c.lit.join()}, ${c.lines} lines, "${c.active}"`);
    expect(!c.sideScroll, 'custom: the page scrolls sideways');
    await game(page, () => document.querySelector('.field.handling').scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(OUT, 'phone-settings-custom.png') });
    // back to the suite's value, on the slider
    const steps = Math.round((HANDLING - c.value) / 0.05);
    for (let k = 0; k < Math.abs(steps); k++) await page.keyboard.press(steps > 0 ? 'ArrowRight' : 'ArrowLeft');
    const back = await game(page, readHandling);
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    expect(Math.abs(back.phys - HANDLING) < 1e-9 && Math.abs(back.saved - HANDLING) < 1e-9, `not back at ${HANDLING}: ${JSON.stringify(back)}`);
    return `${seen.join('; ')}; slider to 0.85: "${c.out}", "${c.active}"; back to ${back.out}`;
  });
  // the condensed HUD (owner, 2026-10-22: "way too much going on on the hud interface"; HUD_POV_SPEC 5.1, 5.2, 5.4):
  // in Free Drive the HUD outside the controls covers at most 12.5% of a 390-wide phone, nothing of it lies in the open
  // view (22% to 70% of the height) or on the chase car, the control row starts below 70%, every control is 44 px or
  // more and none overlaps another; the same in the claude.ai app's 390 x 715 (a 34 px home-indicator inset) and on its
  // side (12% at 844 x 390). FOCUS TIME is a named button a screen reader reaches.
  await check('driving HUD: condensed, inside its budget, controls reachable', async () => {
    await drive(page, 'Free Drive');
    await game(page, () => { const g = window.__game; g.fastForward(6, {}, 40); g.setCam('chase'); });
    await frames(page, 10);
    await page.screenshot({ path: path.join(OUT, 'phone-driving.png') });
    const r = await game(page, () => {
      const box = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { gear: box('.hud-gear'), tbar: box('.tbar'), steer: box('.touch-steer'), gas: box('.pedal.gas'), w: innerWidth };
    });
    expect(r.gear && r.tbar && r.steer && r.gas, `missing: ${Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
    const overlap = !(r.gear.r <= r.tbar.l || r.tbar.r <= r.gear.l || r.gear.b <= r.tbar.t || r.tbar.b <= r.gear.t);
    expect(!overlap, `gear ${JSON.stringify(r.gear)} under the icons ${JSON.stringify(r.tbar)}`);
    expect(r.tbar.r <= r.w + 0.5 && (await noSideScroll()), 'the icons run off the screen');
    expect(await page.getByRole('button', { name: /Focus Time|Clear Path|Locked In/ }).count() === 1, 'the ability is not a named button');
    const sizes = [];
    const at = async (w, h, inset, limit, label) => {
      await page.setViewportSize({ width: w, height: h });
      await game(page, (i) => { const a = document.querySelector('.app'); for (const [k, v] of Object.entries(i)) a.style.setProperty(k, v); }, inset);
      await frames(page, 3);
      const m = await game(page, hudLayoutInPage);
      expect(m.area <= limit, `${label}: the HUD covers ${pct(m.area)} (limit ${pct(limit)})`);
      expect(m.small.length === 0 && m.overlaps.length === 0, `${label}: small ${m.small.join(', ')}; overlapping ${m.overlaps.join(', ')}`);
      expect(m.onCar.length === 0, `${label}: over the car: ${m.onCar.join(', ')}`);
      if (h > w) expect(m.band.length === 0 && m.ctlTop >= 0.7, `${label}: in the open view: ${m.band.join(', ')}; controls from ${pct(m.ctlTop)}`);
      else expect(m.top <= 0.26, `${label}: the top cluster runs to ${pct(m.top)}`);
      sizes.push(`${label} ${pct(m.area)}, cluster to ${pct(m.top)}, controls from ${pct(m.ctlTop)}`);
    };
    await at(390, 844, {}, 0.125, '390x844');
    await at(390, 715, { '--sa-b': '34px' }, 0.125, '390x715 in the app');
    await at(844, 390, { '--sa-b': '0px', '--sa-l': '47px', '--sa-r': '47px' }, 0.12, '844x390');
    await game(page, () => { const a = document.querySelector('.app'); for (const k of ['--sa-b', '--sa-l', '--sa-r']) a.style.removeProperty(k); });
    await page.setViewportSize({ width: 390, height: 844 });
    await frames(page, 2);
    return sizes.join('; ');
  });
  // the seat view (HUD_POV_SPEC 5.2): the horizon at 35-40% at 60 mph on I-405 North, the car's own display under the
  // road and above the controls with nothing over it, nothing of the HUD on the windscreen below the horizon; the
  // hypercar's display shows the speed, so the HUD drops its own; the Rossini GT's gauges don't, so it keeps it
  await check('seat view: horizon, cluster and windscreen clear; the duplicate speed only where the car shows none', async () => {
    const out = [];
    for (const car of ['oc-hyper', 'rossini-gt']) {
      await game(page, (c) => { const g = window.__game; g.car.configure({ ...g.car.config, car: c }); g.setCam('cockpit'); g.fastForward(3, {}, 27); }, car);
      await frames(page, 6);
      // and the camera in the seat: the half-second blend from the chase camera runs on frame time and starts where the
      // camera was before those 3 s (some 80 m back), so 6 quick frames can leave it a metre or more behind the eye
      await page.waitForFunction(() => window.__game.camBlend >= 1, null, { timeout: FRAMES_MS });
      const m = await game(page, hudLayoutInPage);
      expect(m.horizon >= 0.35 && m.horizon <= 0.4, `${car}: the horizon at ${pct(m.horizon)}`);
      expect(m.cluster && m.cluster.mid >= 0.53 && m.cluster.bottom <= m.ctlTop && m.cluster.hits.length === 0, `${car}: the cluster ${JSON.stringify(m.cluster)}, controls from ${pct(m.ctlTop)}`);
      expect(m.onGlass.length === 0, `${car}: on the windscreen: ${m.onGlass.join(', ')}`);
      expect(m.speed === (car !== 'oc-hyper'), `${car}: the HUD's speed ${m.speed ? 'shown' : 'hidden'}`);
      out.push(`${car}: horizon ${pct(m.horizon)}, cluster centre ${pct(m.cluster.mid)}, HUD speed ${m.speed ? 'shown' : 'hidden'}, ${pct(m.area)}`);
    }
    await game(page, () => { const g = window.__game; g.car.configure({ ...g.car.config, car: 'rossini-gt' }); g.setCam('chase'); });
    return out.join('; ');
  });
  await check('Go to lists all twenty carriageways', async () => {
    await page.getByRole('button', { name: 'Go to' }).click();
    const n = await page.locator('.grid.nav .gcell').count();
    await page.screenshot({ path: path.join(OUT, 'phone-goto.png') });
    expect(n === 20, `${n} listed`);
    return `${n} listed`;
  });
  // the navigation card and the chevrons (U2): picking a freeway in Go to sets a route; on a phone the manoeuvre and the
  // destination fold into a line each, clear of each other and of the road chip, the destination's time is "at your
  // pace" and its traffic "simulated", and the chevrons lie on the road. Clear route takes it all away again.
  await check('Go to: navigation line, destination line and road chevrons; Clear route hides them', async () => {
    await page.locator('.grid.nav .gcell').filter({ has: page.locator('.shield', { hasText: /^55$/ }) }).filter({ hasText: 'North' }).click();
    await frames(page, 3);
    const look = () => game(page, () => {
      const q = (s) => document.querySelector(s), box = (e) => { if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, h: b.height }; };
      const nav = q('.hud-nav'), dest = q('.hud-dest'), m = window.__game.chevrons.mesh;
      return { nav: box(nav), dest: box(dest), chip: box(q('.hud-roadname')), navText: nav.hidden ? '' : nav.innerText.replace(/\s+/g, ' '), destText: dest.hidden ? '' : dest.innerText.replace(/\s+/g, ' '),
        count: m.count, shown: m.visible, w: innerWidth, side: document.documentElement.scrollWidth > innerWidth,
        clipped: [nav, dest, q('.hud-nav-sign')].some((e) => !e.hidden && e.scrollWidth > e.clientWidth + 1) };   // the sign too: it was cut to "CA-55 NORT..."
    });
    const r = await look();
    await page.screenshot({ path: path.join(OUT, 'phone-nav.png') });
    expect(r.nav && r.dest, `the cards: ${JSON.stringify({ nav: !!r.nav, dest: !!r.dest })}`);
    expect(/CA-55 North/i.test(r.navText), `the navigation line says "${r.navText}"`);
    expect(/at your pace/.test(r.destText) && /simulated/.test(r.destText), `the destination line says "${r.destText}"`);
    expect(r.nav.h <= 44 && r.dest.h <= 40, `not one line each: ${fmt(r.nav.h)} and ${fmt(r.dest.h)} px tall`);
    const apart = (a, b) => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;
    expect(apart(r.nav, r.dest) && apart(r.nav, r.chip) && apart(r.dest, r.chip), `overlap: ${JSON.stringify({ nav: r.nav, dest: r.dest, chip: r.chip })}`);
    expect(r.nav.l >= 0 && r.nav.r <= r.w && r.dest.l >= 0 && r.dest.r <= r.w && !r.side && !r.clipped, 'a line runs off the screen or is cut short');
    expect(r.shown && r.count > 20, `${r.count} chevrons, ${r.shown ? 'shown' : 'hidden'}`);
    await page.getByRole('button', { name: 'Go to' }).click();
    await page.getByRole('button', { name: 'Clear route', exact: true }).click();
    await frames(page, 2);
    const c = await look();
    expect(!c.nav && !c.dest && !c.shown && c.count === 0, `after Clear route: ${JSON.stringify({ nav: !!c.nav, dest: !!c.dest, chevrons: c.count })}`);
    await page.getByRole('button', { name: 'Go to' }).click();                  // back where the next check expects it
    return `"${r.navText}" / "${r.destText}"; ${r.count} chevrons; cleared`;
  });
  // following the route (owner, 2026-11-01): the corner map draws what's left of the route in the car's accent with the
  // next manoeuvre's arrow, the guidance carries the lane hint before an exit, and Auto-drive is a 44 px button with the
  // driving controls that drives it, AUTO on the plate. None of it adds to the HUD's cover: with a route the plate
  // already carries the guidance and destination lines (13.6% of 390 x 844 before this, over the 12.5% no-route budget),
  // and the lanes and AUTO sit inside it, the button with the controls (below 70%, 44 px, overlapping nothing). A drag on
  // the steering pad or a press of BRAKE hands the car back
  await check('follow the route: route on the corner map, lane hint, an Auto-drive button that adds nothing to the HUD cover; touch steer and brake take over', async () => {
    try {
      await page.keyboard.press('Escape');                                         // close Go to
      await page.waitForTimeout(300);
      if (await page.locator('.panel.paused').count()) await page.getByRole('button', { name: 'Resume', exact: true }).click();
      // the map's own pixels in the accent, and how many route points it drew
      const mapLook = () => game(page, () => {
        const g = window.__game, cv = document.querySelector('.corner.map canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        const ac = getComputedStyle(document.documentElement).getPropertyValue('--ice').trim(), m = /^#(..)(..)(..)$/.exec(ac), rgb = m.slice(1).map((h) => parseInt(h, 16));
        let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) < 40) n++;
        return { accent: n, drawn: g.routeDrawn };
      });
      // the map and the HUD tick at 0.1 s of game time: each read below waits on the state it reads, not on frames
      const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: FRAMES_MS, polling: 50 }).catch(() => {});
      await game(page, () => { const g = window.__game; g.navigateTo(null); });
      await until(() => window.__game.routeDrawn === 0 && !document.querySelector('.tbtn.auto'));
      await frames(page, 2);
      const none = await mapLook();
      await game(page, () => {
        const g = window.__game, m = g.findMain('I-405 North');
        g.setPaused(true); g.placeCar(m, m.len * 0.12, 1, 28); g.traffic.reseed(3); g.traffic.fill(g.view()); g.navigateTo('CA-55 North');
        g.fastForward(Math.max(0, (g.route[0].s - g.phys.s - 1500) / 28), {}, 28); g.setPaused(false);   // 1.5 km before the exit
      });
      await until(() => window.__game.routeDrawn > 20 && !!document.querySelector('.tbtn.auto') && !!document.querySelector('.hud-nav-lanes:not([hidden]) i.on'));
      await frames(page, 2);
      const withRoute = await mapLook();
      expect(withRoute.drawn > 20 && withRoute.accent > 4 * none.accent + 30, `the map's accent pixels: ${none.accent} without a route, ${withRoute.accent} with one (${withRoute.drawn} route points)`);
      const hint = await game(page, () => ({ lit: document.querySelectorAll('.hud-nav-lanes:not([hidden]) i.on').length, all: document.querySelectorAll('.hud-nav-lanes:not([hidden]) i:not([hidden])').length, act: document.querySelector('.hud-nav-dist span')?.textContent }));
      expect(hint.lit >= 1 && hint.all > hint.lit && /Keep (left|right)/i.test(hint.act ?? ''), `lane hint ${JSON.stringify(hint)}`);
      const auto = page.getByRole('button', { name: 'Auto-drive' });
      expect(await auto.count() === 1 && await auto.getAttribute('aria-pressed') === 'false', 'no Auto-drive button with a route');
      // the HUD's DOM (the AUTO tag, the button's aria-pressed) is waited on as state, not counted frames: three frames
      // hold a HUD send only when frames run 33 ms or more, which a quiet machine beats
      const autoShown = (on) => page.waitForFunction((want) => {
        const t = document.querySelector('.hud-auto'), b = document.querySelector('.tbtn.auto');
        return !!t && t.hidden === !want && !!b && b.getAttribute('aria-pressed') === String(want);
      }, on, { timeout: FRAMES_MS, polling: 50 }).catch(() => {});
      await auto.tap();
      await autoShown(true);
      const st = await game(page, () => ({ on: window.__game.autoDriving, tag: !document.querySelector('.hud-auto').hidden, pressed: document.querySelector('.tbtn.auto').getAttribute('aria-pressed') }));
      expect(st.on && st.tag && st.pressed === 'true', `after the tap: ${JSON.stringify(st)}`);
      const sizes = [];
      try {
        for (const [w, h] of [[390, 844], [390, 760], [844, 390]]) {
          await page.setViewportSize({ width: w, height: h });
          // the route's HUD as it was: no lanes, no AUTO, no button; then all three
          await game(page, () => { const g = window.__game; g.setAutoDrive(false); document.querySelector('.hud-nav-lanes').hidden = true; });
          await autoShown(false);
          await frames(page, 2);                                                     // the new size laid out
          const was = await game(page, hudLayoutInPage);
          await game(page, () => { const g = window.__game; g.setAutoDrive(true); document.querySelector('.hud-nav-lanes').hidden = false; });
          await autoShown(true);
          await frames(page, 2);
          const m = await game(page, hudLayoutInPage);
          const label0 = `${w}x${h}`, stNow = await game(page, () => ({ on: window.__game.autoDriving, tag: !document.querySelector('.hud-auto').hidden }));
          expect(stNow.on && stNow.tag, `${label0}: AUTO is not up for the measure: ${JSON.stringify(stNow)}`);
          const label = `${w}x${h}`;
          expect(m.area <= was.area + 0.002, `${label}: the HUD covers ${pct(m.area)}, up from ${pct(was.area)}`);
          expect(m.small.length === 0 && m.overlaps.length === 0, `${label}: small ${m.small.join(', ')}; overlapping ${m.overlaps.join(', ')}`);
          // the sign whole with the hint up (on its side the lanes beside it cut it to "CA-55 NO..."), and the lanes
          // inside the plate, clear of the sign and the destination's text
          const fit = await game(page, () => {
            const q = (s) => document.querySelector(s), sign = q('.hud-nav-sign'), ln = q('.hud-nav-lanes'), plate = q('.hud-plate').getBoundingClientRect();
            const b = ln.getBoundingClientRect(), sb = sign.getBoundingClientRect(), hit = (a) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            const words = [...q('.hud-dest').querySelectorAll('b, em')].filter((e) => e.getClientRects().length).flatMap((e) => [...e.getClientRects()]);
            return { lanes: !ln.hidden && b.width > 0, sw: sign.scrollWidth, cw: sign.clientWidth, text: sign.textContent, inPlate: b.left >= plate.left && b.right <= plate.right && b.top >= plate.top && b.bottom <= plate.bottom + 0.5, overSign: hit(sb), overDest: words.filter(hit).length };
          });
          expect(fit.lanes && fit.sw <= fit.cw + 1, `${label}: the sign "${fit.text}" is cut (${fit.cw} of ${fit.sw} px) with the lane hint ${fit.lanes ? 'up' : 'missing'}`);
          expect(fit.inPlate && !fit.overSign && fit.overDest === 0, `${label}: the lanes ${JSON.stringify(fit)}`);
          if (h > w) expect(m.band.length === 0 && m.ctlTop >= 0.7, `${label}: in the open view: ${m.band.join(', ')}; controls from ${pct(m.ctlTop)}`);
          // on its side the route's plate already runs past the no-route 26% (28.5% at 844 x 390): no further
          else expect(m.top <= Math.max(0.26, was.top + 0.005), `${label}: the top cluster runs to ${pct(m.top)}, from ${pct(was.top)}`);
          sizes.push(`${label} ${pct(was.area)} → ${pct(m.area)}${h > w ? `, controls from ${pct(m.ctlTop)}` : `, cluster to ${pct(was.top)} → ${pct(m.top)}`}`);
        }
      } finally {
        await page.setViewportSize({ width: 390, height: 844 });
        await game(page, () => { document.querySelector('.hud-nav-lanes').style.display = ''; });
      }
      await frames(page, 2);
      // take over: a drag on the steering pad, then (Auto-drive on again) a press of BRAKE
      const touchOn = async (sel, move) => {
        await game(page, () => window.__game.setAutoDrive(true));
        const b = await page.locator(sel).boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2, o = { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true };
        await page.locator(sel).dispatchEvent('pointerdown', { ...o, clientX: x, clientY: y });
        if (move) await page.locator(sel).dispatchEvent('pointermove', { ...o, clientX: x + 45, clientY: y });
        await frames(page, 2);
        const on = await game(page, () => window.__game.autoDriving);
        await page.locator(sel).dispatchEvent('pointerup', { ...o, clientX: x, clientY: y });
        return on;
      };
      const bySteer = await touchOn('.touch-steer', true), byBrake = await touchOn('.pedal.brake', false);
      expect(!bySteer && !byBrake, `still driving after a steer drag ${bySteer}, after BRAKE ${byBrake}`);
      // clear the route: the button, the map's line and the lane hint go
      await game(page, () => window.__game.navigateTo(null));
      await until(() => window.__game.routeDrawn === 0 && !document.querySelector('.tbtn.auto'));
      const gone = { button: await auto.count(), ...(await mapLook()) };
      expect(gone.button === 0 && gone.drawn === 0, `after clearing: ${JSON.stringify(gone)}`);
      await page.getByRole('button', { name: 'Go to' }).click();                  // back where the next check expects it
      return `map accent pixels ${none.accent} → ${withRoute.accent} (${withRoute.drawn} route points); lanes ${hint.lit} of ${hint.all} lit, "${hint.act}"; AUTO on; ${sizes.join('; ')}; steer drag and BRAKE each took over; cleared`;
    } finally {
      // whatever happened, no route, no Auto-drive and the phone's size for the checks after this one
      await page.setViewportSize({ width: 390, height: 844 }).catch(() => {});
      await game(page, () => { const g = window.__game; g.setAutoDrive(false); g.navigateTo(null); g.input.touch.steer = 0; g.input.touch.brake = false; }).catch(() => {});
      await frames(page, 3).catch(() => {});                                      // the HUD (and the quick menu) hear it
    }
  });
  // what left the driving HUD stays a tap or two away (HUD_POV_SPEC 5.5): hold Pause for the quick menu's six wedges,
  // Pause > Radio for the radio card
  await check('reach: hold Pause for the six-wedge quick menu; Pause > Radio opens the radio card', async () => {
    await page.keyboard.press('Escape');                                         // close Go to
    await page.waitForTimeout(300);
    if (await page.locator('.panel.paused').count()) await page.getByRole('button', { name: 'Resume', exact: true }).click();
    const pause = page.getByRole('button', { name: 'Pause', exact: true });
    await pause.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
    await page.waitForSelector('.radial', { state: 'attached', timeout: 30000 });
    const wedges = await page.locator('.radial-w').count();
    // let go in the middle: nothing picked
    await game(page, () => dispatchEvent(new PointerEvent('pointerup', { clientX: innerWidth / 2, clientY: innerHeight / 2 })));
    await page.waitForSelector('.radial', { state: 'detached', timeout: 30000 });
    expect(wedges === 6, `${wedges} wedges`);
    await pause.tap();
    await page.waitForSelector('.panel.paused', { timeout: 30000 });
    await page.getByRole('button', { name: 'Radio', exact: true }).click();
    await page.waitForSelector('.radio-card', { timeout: 30000 });
    const card = await page.locator('.radio-card').boundingBox();
    expect(card && card.y >= 150, `the radio card at ${JSON.stringify(card)}`);
    await page.locator('.radio-card').getByRole('button', { name: 'Close', exact: true }).click();
    return `${wedges} wedges; radio card at y ${Math.round(card.y)}`;
  });
  // the adaptive HUD (U1): the compass is the ring round the map; the time and the temperature, which says it's
  // simulated, are in the pause screen. Minimal tucks the icons and the map away after 4 s of just driving, keeps Pause
  // in reach, and a tap on the road brings the rest back.
  await check('HUD: compass ring; clock in the pause screen; Minimal tucks the icons away after 4 s, Pause stays, a tap brings them back', async () => {
    const h = await game(page, () => Number(document.querySelector('.hud-tape')?.style.getPropertyValue('--h')));
    // the drive starts on I-405 North through Irvine, which runs northwest
    expect(h > 270 && h < 340, `the compass reads ${h}° on I-405 North in Irvine`);
    await game(page, () => window.__game.setPaused(true));
    const clock = await page.locator('.pause-clock').innerText();
    expect(/\d:\d\d [AP]M · \d+° · (simulated|NWS KSNA)/.test(clock), `the pause screen says "${clock}"`);
    const row = { h, clock };
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('group', { name: 'HUD style' }).getByRole('button', { name: 'Minimal' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    const view = page.getByRole('button', { name: 'View', exact: true }), pause = page.getByRole('button', { name: 'Pause', exact: true });
    const tucked = () => page.waitForFunction(() => document.querySelector('.app.hud-idle') && [...document.querySelectorAll('.tbar .tbtn')].find((b) => b.textContent === 'View')
      && getComputedStyle([...document.querySelectorAll('.tbar .tbtn')].find((b) => b.textContent === 'View')).visibility === 'hidden', null, { timeout: 60000, polling: 250 });
    expect(await view.isVisible(), 'the top bar is not up after Resume');
    const t0 = Date.now();
    await tucked();
    const s = (Date.now() - t0) / 1000;
    expect(s >= 3, `tucked away after ${fmt(s)} s`);
    expect(await pause.isVisible(), 'Pause went with the bar');
    expect(!(await page.locator('.corner').isVisible()), 'the corner window stayed');
    await page.touchscreen.tap(195, 470);
    await view.waitFor({ state: 'visible', timeout: 30000 });
    await tucked();
    await pause.tap();                                                             // the round chip pauses
    await page.waitForSelector('.panel.paused', { timeout: 30000 });
    return `compass ${row.h}°, "${row.clock}"; tucked away ${fmt(s)} s after Resume; a tap brought it back; the chip paused`;
  });
  // the sky camera (owner, 2026-10-27: "Sky view camera still doesn't show correctly on mobile view"): it draws into
  // the window's own canvas at the screen's pixel ratio (it used to land at pr times its place and size, and at 1 pixel
  // per CSS pixel on a phone), a live picture inside its frame, and it stays up when the Minimal HUD tucks the rest
  await check('sky camera: a sharp live picture inside its frame; it stays while Minimal tucks the map', async () => {
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await game(page, () => { const g = window.__game; for (let i = 0; i < 3 && g.settings.corner !== 'sky'; i++) g.cycleCorner(); });
    await page.waitForFunction(() => document.querySelector('.app.hud-idle') && document.querySelector('.corner.sky canvas'), null, { timeout: 60000, polling: 250 });
    await frames(page, 4);
    const r = await game(page, () => {
      const c = document.querySelector('.corner.sky'), cv = c.querySelector('canvas'), cs = getComputedStyle(c);
      const a = c.getBoundingClientRect(), b = cv.getBoundingClientRect(), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; s += l; s2 += l * l; n++; }
      return { inside: b.left >= a.left - 0.5 && b.right <= a.right + 0.5 && b.top >= a.top - 0.5 && b.bottom <= a.bottom + 0.5, css: b.width, px: cv.width, sq: cv.width === cv.height,
        dpr: devicePixelRatio, cap: window.__game.settings.quality === 'low' ? 2 : 3, mean: s / n, sd: Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)), up: cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5 && a.right <= innerWidth + 0.5,
        mode: window.__game.skyMode, self: window.__game.skyCheck };
    });
    expect(r.up, 'the sky camera tucked away with the Minimal HUD');
    // the screen's pixel ratio, up to 3, and up to 2 at Low (a phone's default)
    expect(r.inside && r.sq && Math.abs(r.px - Math.round(r.css * Math.min(r.cap, r.dpr))) <= 1, `a ${r.px} px canvas for ${fmt(r.css)} CSS px at ${r.dpr}x, cap ${r.cap} (inside the frame: ${r.inside})`);
    expect(r.mean > 20 && r.sd > 8, `no picture: mean ${fmt(r.mean)}, sd ${fmt(r.sd)}`);
    // the copy checks itself once against the drawing buffer (it falls back to the direct way if WebKit hands it back empty)
    expect(r.mode === 'copy' && r.self.startsWith('copy ok'), `self-check: ${r.mode}, "${r.self}"`);
    return `${r.px} px for ${fmt(r.css)} CSS px at ${r.dpr}x, mean ${fmt(r.mean)}, sd ${fmt(r.sd)}, up while the HUD is tucked; self-check "${r.self}"`;
  });
  // the fallback (Game.renderSkyDirect, what the self-check switches to): the view drawn into the main canvas under the
  // see-through frame. With the world held still, what the screen shows inside the frame matches the copy's picture,
  // and not the road behind the frame (the same frame with its canvas hidden and no fallback)
  await check('sky camera fallback: drawn into the main canvas, inside its see-through frame', async () => {
    const cssBox = () => game(page, () => { const b = document.querySelector('.corner.sky canvas').getBoundingClientRect(); return { x: b.left + 2, y: b.top + 2, width: b.width - 4, height: Math.round((b.height - 4) * 0.7) }; });
    // 6 x 4 block means of a PNG (decoded in the page) or of the window's own canvas, over the same top 70% (the tag sits below)
    const blocks = (png) => game(page, async (src) => {
      let w, h, d;
      if (src) { const im = await createImageBitmap(new Blob([Uint8Array.from(atob(src), (ch) => ch.charCodeAt(0))], { type: 'image/png' })); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); w = im.width; h = im.height; d = x.getImageData(0, 0, w, h).data; }
      else { const cv = document.querySelector('.corner.sky canvas'), k = cv.width / cv.getBoundingClientRect().width, x0 = Math.round(2 * k), y0 = Math.round(2 * k); w = cv.width - 2 * x0; h = Math.round((cv.height - 2 * y0) * 0.7); d = cv.getContext('2d').getImageData(x0, y0, w, h).data; }
      const out = [];
      for (let by = 0; by < 4; by++) for (let bx = 0; bx < 6; bx++) {
        const s = [0, 0, 0]; let n = 0;
        for (let y = Math.floor((by * h) / 4); y < Math.floor(((by + 1) * h) / 4); y++) for (let x = Math.floor((bx * w) / 6); x < Math.floor(((bx + 1) * w) / 6); x++) { const i = (y * w + x) * 4; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
        out.push(s.map((v) => v / Math.max(1, n)));
      }
      return out;
    }, png ? png.toString('base64') : null);
    const diff = (a, b) => a.reduce((t, p, i) => t + (Math.abs(p[0] - b[i][0]) + Math.abs(p[1] - b[i][1]) + Math.abs(p[2] - b[i][2])) / 3, 0) / a.length;
    await game(page, () => { const g = window.__game; for (let i = 0; i < 3 && g.settings.corner !== 'sky'; i++) g.cycleCorner(); g.paused = true; });   // still, without the pause screen
    await frames(page, 4);
    const copy = await blocks(null);
    await game(page, () => { document.querySelector('.corner.sky canvas').style.visibility = 'hidden'; });
    await frames(page, 2);
    const behind = await blocks(await page.screenshot({ clip: await cssBox() }));
    await game(page, () => { document.querySelector('.corner.sky canvas').style.visibility = ''; window.__game.setSkyFallback(true); });
    await frames(page, 4);
    const direct = await blocks(await page.screenshot({ clip: await cssBox() }));
    const st = await game(page, () => { const c = document.querySelector('.corner.sky'), cs = getComputedStyle(c);
      return { mode: window.__game.skyMode, bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, canvas: getComputedStyle(c.querySelector('canvas')).visibility }; });
    await game(page, () => { const g = window.__game; g.setSkyFallback(false); g.paused = false; for (let i = 0; i < 3 && g.settings.corner !== 'map'; i++) g.cycleCorner(); });
    const dDirect = diff(direct, copy), dBehind = diff(behind, copy);
    expect(st.mode === 'direct' && st.canvas === 'hidden' && /rgba\(0, 0, 0, 0\)|transparent/.test(st.bg) && st.radius === '0px', `the frame in the fallback: ${JSON.stringify(st)}`);
    expect(dDirect < 14 && dDirect < dBehind / 2, `inside the frame the screen is ${fmt(dDirect)} levels from the sky view (the road behind: ${fmt(dBehind)})`);
    return `the screen inside the frame is ${fmt(dDirect)} levels from the copy's picture (the road behind it: ${fmt(dBehind)}); frame ${st.bg}, radius ${st.radius}`;
  });
  await page.keyboard.press('Escape');
  await check('OC Hypercar THRUST button at 390 × 844: beside the ability, clear of the pedals; hold for thrust, double-tap to hop', async () => {
    await game(page, hyperHelpers);
    await hyperIn(page, 'free');
    // a clear straight: nothing overhead for the hop's track, no traffic, 30 m/s
    await game(page, () => {
      const g = window.__game, m = g.findMain('I-405 North'), p = g.phys;
      let s = 3000; while (s < m.len - 600 && g.structureOver(m, s, m.laneCenter(1), 300)) s += 100;
      g.placeCar(m, s, 1, 30); g.apLane = 1; g.traffic.clearAround(p.x, p.z, 400);
      g.setPaused(false);
    });
    await page.waitForFunction(() => { const b = document.querySelector('.hud-thrustbtn'); return b && !b.hidden; }, null, { timeout: 900000, polling: 500 });
    await frames(page, 2, 900000);
    const box = (q) => game(page, (q) => { const e = document.querySelector(q); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }, q);
    const btn = await box('.hud-thrustbtn'), abil = await box('.hud-ability'), gas = await box('.pedal.gas'), brk = await box('.pedal.brake'), panel = await box('.hud-thrust'), speed = await box('.hud-speed');
    const w = await game(page, () => innerWidth), hgt = await game(page, () => innerHeight);
    const hit = (a, b) => a && b && !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);
    expect(btn && abil && gas && brk && panel, `missing: ${JSON.stringify({ btn, abil, gas, brk, panel })}`);
    expect(!hit(btn, abil) && !hit(btn, gas) && !hit(btn, brk) && !hit(panel, abil) && !hit(panel, btn) && !hit(panel, speed), `overlap: ${JSON.stringify({ btn, abil, gas, brk, panel, speed })}`);
    expect(btn.l >= 0 && btn.r <= w && btn.b <= hgt && Math.abs(btn.t - abil.t) < 4 && btn.r - btn.l >= 44, `button ${JSON.stringify(btn)} vs ability ${JSON.stringify(abil)}`);
    // hold: thrust after the 120 ms delay, off on release
    const cx = (btn.l + btn.r) / 2, cy = (btn.t + btn.b) / 2;
    const tank0 = await game(page, () => window.__game.hyper.tank);
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.waitForFunction(() => window.__game.input.c.thrust === 1 && window.__game.hyper.thrust > 0.3, null, { timeout: 900000, polling: 500 });
    await page.screenshot({ path: path.join(OUT, 'phone-thrust.png') });
    await page.mouse.up();
    await page.waitForFunction(() => window.__game.input.c.thrust === 0, null, { timeout: 900000, polling: 500 });
    const held = await game(page, () => ({ tank: window.__game.hyper.tank, hops: window.__game.hopLog.n, refused: window.__game.hopLog.refusedN }));
    expect(held.tank < tank0, `tank ${fmt(tank0)} → ${fmt(held.tank)} while held`);
    // double-tap: a Thrust Hop. The two taps go to the button in one task, so a slow software frame between them can't
    // stretch the gap past the 300 ms window (the hold above used the real pointer)
    await game(page, () => {
      window.__game.hyper.tank = 1;
      const b = document.querySelector('.hud-thrustbtn'), r = b.getBoundingClientRect(), at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true };
      for (const type of ['pointerdown', 'pointerup', 'pointerdown', 'pointerup']) b.dispatchEvent(new PointerEvent(type, at));
    });
    await page.waitForFunction((h) => window.__game.hopLog.n > h.hops || window.__game.hopLog.refusedN > h.refused, held, { timeout: 900000, polling: 500 });
    const hop = await game(page, () => { const g = window.__game; const r = { n: g.hopLog.n, refused: g.hopLog.refused, air: g.phys.airborne, peak: g.hopLog.peak }; g.setPaused(true); return r; });
    expect(hop.n === held.hops + 1, `double-tap: ${JSON.stringify(hop)}`);
    expect(await noSideScroll(), 'the page scrolls sideways');
    return `button ${Math.round(btn.r - btn.l)} × ${Math.round(btn.b - btn.t)} px left of the ability, the tank panel above; held: tank ${fmt(tank0 * 100)} → ${fmt(held.tank * 100)} %; double-tap: a ${fmt(hop.peak)} m hop`;
  });
  // the same phone turned sideways: the corner map takes the right edge, so the ability, THRUST and the tank panel
  // move low into the middle and the road plate up under the top buttons
  await check('OC Hypercar HUD at 844 × 390 (a phone sideways): the ability, THRUST and the tank panel clear the corner map, the pedals, the steering rail and the road plate', async () => {
    await page.setViewportSize({ width: 844, height: 390 });
    await game(page, () => window.__game.setPaused(false));
    await frames(page, 2, 900000);
    const r = await game(page, () => {
      const box = (q) => { const e = document.querySelector(q); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return b.width ? { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) } : null; };
      const boxes = { corner: box('.corner'), panel: box('.hud-thrust'), btn: box('.hud-thrustbtn'), abil: box('.hud-ability'), gas: box('.pedal.gas'), brake: box('.pedal.brake'), steer: box('.touch-steer'), speed: box('.hud-speed'), stats: box('.hud-stats'), road: box('.hud-road'), tbar: box('.tbar') };
      const hit = (a, b) => !!(a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b), ks = Object.keys(boxes), overlaps = [];
      for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (hit(boxes[ks[i]], boxes[ks[j]])) overlaps.push(`${ks[i]}/${ks[j]}`);
      window.__game.setPaused(true);
      return { boxes, overlaps, w: innerWidth, h: innerHeight };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const b = r.boxes;
    expect(b.corner && b.panel && b.btn && b.abil && b.gas && b.road, `missing: ${JSON.stringify(b)}`);
    const mine = r.overlaps.filter((o) => /panel|btn|abil|road/.test(o));
    expect(!mine.length, `overlaps: ${mine.join(', ')} ${JSON.stringify(b)}`);
    expect([b.panel, b.btn, b.abil].every((x) => x.l >= 0 && x.r <= r.w && x.t >= 0 && x.b <= r.h), `off screen: ${JSON.stringify(b)}`);
    return `${r.w} × ${r.h}: THRUST ${b.btn.l}-${b.btn.r} and the ability ${b.abil.l}-${b.abil.r} px across at ${b.btn.t}-${b.btn.b}, the tank panel over them at ${b.panel.t}-${b.panel.b}, the corner map ${b.corner.l}-${b.corner.r} × ${b.corner.t}-${b.corner.b}; no overlaps${r.overlaps.length ? ` (elsewhere: ${r.overlaps.join(', ')})` : ''}`;
  });
  // the destination mode at every size (owner, 2026-11-09, "lets fix the interface when i choose a destiantion", with
  // screenshots at 1450 x 767 and 1350 x 750 in the OC Hypercar headed for Stoppage Time: the destination card under the
  // rail's VIEW button, its "at your pace" and "simulated" hidden; THRUST's tank panel under PAUSE on a short window).
  // With a destination set, in the hypercar (THRUST and FOCUS TIME up), no two visible HUD boxes overlap and every one
  // sits inside the viewport minus its safe areas, the honest labels whole: a desktop at 1450 x 767 (the owner's) and
  // 1280 x 600 (a short window: the rail goes to icons) in a desktop context, this phone upright and on its side
  await check('destination set in the OC Hypercar: no HUD boxes overlap, all inside the viewport and its safe areas, at 1450 × 767, 1280 × 600, 390 × 844 and 844 × 390', async () => {
    const out = [];
    const at = async (p, w, h) => {
      await p.setViewportSize({ width: w, height: h });
      await p.waitForTimeout(450);                                                  // the layout follows a resize a moment later (App.tsx useHudLayout)
      await frames(p, 3, 900000);
      const m = await game(p, hudBoxesInPage);
      const tag = `${w}x${h} (${m.layout})`;
      expect(m.has.dest && m.has.nav && m.has.thrust && m.has.ability, `${tag}: missing ${JSON.stringify(m.has)}`);
      expect(m.overlaps.length === 0, `${tag}: overlapping ${m.overlaps.join(', ')}`);
      expect(m.outside.length === 0, `${tag}: outside ${JSON.stringify(m.safe)}: ${m.outside.join(', ')}`);
      expect(m.labels.length === 2 && m.labels.every((l) => l.ok), `${tag}: the destination's labels ${JSON.stringify(m.labels)}`);
      expect(!m.side, `${tag}: the page scrolls sideways`);
      out.push(`${tag} ${m.boxes} boxes`);
    };
    // this phone: the hypercar from the checks above, Stoppage Time from Go to
    await game(page, () => window.__game.setPaused(false));
    await page.waitForFunction(() => !!document.querySelector('.tbar'), null, { timeout: 900000, polling: 500 });
    await page.getByRole('button', { name: 'Go to', exact: true }).click();
    await page.locator('.grid.places .gcell', { hasText: 'Stoppage Time' }).click();
    await page.waitForFunction(() => { const d = document.querySelector('.hud-dest'); return d && !d.hidden && /Stoppage Time/.test(d.textContent); }, null, { timeout: 900000, polling: 500 });
    await page.screenshot({ path: path.join(OUT, 'phone-destination.png') });
    await at(page, 390, 844);
    await at(page, 844, 390);
    await page.setViewportSize({ width: 390, height: 844 });
    await game(page, () => { const g = window.__game; g.navigateTo(null); g.setPaused(true); });
    // a desktop window: its own page (a mouse, the sky camera top right as the owner had it), the owner's road
    const d = await open({ size: [1450, 767], settings: { corner: 'sky', hudStyle: 'modern' } });
    try {
      await game(d.page, () => { const g = window.__game; g.updateSettings({ ...g.settings, owner: true, density: 'none' }); g.chooseOwnerCar('oc-hyper'); });
      await drive(d.page, 'Free Drive');
      await game(d.page, () => { const g = window.__game, m = g.findMain('CA-22 East'); g.placeCar(m, m.len * 0.35, 1, 60); g.setCam('chase'); });
      await d.page.getByRole('button', { name: 'Go to', exact: true }).click();
      await d.page.locator('.grid.places .gcell', { hasText: 'Stoppage Time' }).click();
      await d.page.waitForFunction(() => { const e = document.querySelector('.hud-dest'); return e && !e.hidden && /Stoppage Time/.test(e.textContent) && !document.querySelector('.hud-thrustbtn').hidden; }, null, { timeout: 900000, polling: 500 });
      await at(d.page, 1450, 767);
      await d.page.screenshot({ path: path.join(OUT, 'desk-destination-1450x767.png') });
      await at(d.page, 1280, 600);
      await d.page.screenshot({ path: path.join(OUT, 'desk-destination-1280x600.png') });
      expect(d.errors.length === 0, `desktop page errors: ${d.errors.slice(0, 3).join(' | ')}`);
    } finally { await d.ctx.close(); }
    return out.join('; ');
  });
});

// the local-launch features: start at your own exit, and the run card you can share
await group('launch', async (use) => {
  const { page } = await use({ settings: { start: 'I-405 North' } });
  const road = 'CA-57 North';
  let want = null;
  // the theme follows the car and the driver, and the Look setting switches the art direction (owner, 2026-10-21;
  // PROJECT_OC_STYLE_GUIDE.md): <html data-car>, data-driver and data-look re-point the tokens in styles.css
  await check('the theme follows the car and the driver; the Look setting switches the art direction and is saved', async () => {
    const attrs = () => game(page, () => { const d = document.documentElement; return { car: d.dataset.car, driver: d.dataset.driver, look: d.dataset.look, carId: window.__game.carId, base: getComputedStyle(d).getPropertyValue('--void').trim() }; });
    const a = await attrs();
    expect(a.car === a.carId && a.driver === 'closer' && a.look === 'ultra', JSON.stringify(a));
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Realistic', exact: true }).click();
    const b = await attrs();
    const saved = await game(page, () => JSON.parse(localStorage.getItem('tsu.settings') || '{}').look);
    expect(b.look === 'hd' && b.base === '#0a111d' && saved === 'hd', `after Realistic: ${JSON.stringify(b)}, saved ${saved}`);
    await page.getByRole('button', { name: 'Futuristic', exact: true }).click();
    const c = await attrs();
    expect(c.look === 'ultra' && c.base !== '#0a111d', `after Futuristic: ${JSON.stringify(c)}`);
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    return `car ${a.car}, driver ${a.driver}; Realistic base ${b.base}, saved; back to Futuristic`;
  });
  // the garage's Paint tab (U5): six paints per car, applied live to the car and kept for that car
  await check("the garage's Paint tab repaints the car live and keeps the choice", async () => {
    await page.locator('.pick', { hasText: 'Car' }).first().click();
    await page.getByRole('button', { name: 'Paint', exact: true }).click();
    await page.getByRole('radio', { name: 'Sunset Orange' }).click();
    await frames(page, 2);
    const r = await game(page, () => ({ paint: window.__game.car.config.paint, saved: JSON.parse(localStorage.getItem('tsu.settings') || '{}').paints?.['rossini-gt'] }));
    await page.screenshot({ path: path.join(OUT, 'launch-paint.png') });
    expect(r.paint === 0xe5620b && r.saved === 0xe5620b, `car wears ${r.paint?.toString(16)}, saved ${r.saved?.toString(16)}`);
    await page.getByRole('radio', { name: 'Rossini Red' }).click();
    const back = await game(page, () => window.__game.car.config.paint);
    expect(back === 0xa80d10, `back to ${back?.toString(16)}`);
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    return 'Sunset Orange on the car and saved; back to Rossini Red';
  });
  // the garage's Wheels tab (U5): two rim styles per car, fitted live (only the wheels rebuilt, never stacked) and kept
  await check("the garage's Wheels tab fits the second rim style live and keeps the choice", async () => {
    const count = () => game(page, () => { const c = window.__game.car; return { wheels: c.wheels.length, inScene: c.wheels.filter((w) => !!w.steer.parent).length, root: c.root.children.length, style: c.config.wheel }; });
    const a = await count();
    await page.locator('.pick', { hasText: 'Car' }).first().click();
    await page.getByRole('button', { name: 'Wheels', exact: true }).click();
    const chips = await page.locator('.wheel-chip').count();
    await page.getByRole('radio', { name: /Cross Lace/ }).click();
    await frames(page, 2);
    const b = await count();
    const saved = await game(page, () => JSON.parse(localStorage.getItem('tsu.settings') || '{}').wheels?.['rossini-gt']);
    await page.screenshot({ path: path.join(OUT, 'launch-wheels.png') });
    expect(chips === 2, `${chips} rim styles listed`);
    expect(b.style === 'mesh' && saved === 'mesh', `car wears ${b.style}, saved ${saved}`);
    expect(b.wheels === 4 && b.inScene === 4 && b.root === a.root, `wheels ${b.wheels} (${b.inScene} in the scene), root children ${a.root} → ${b.root}`);
    await page.getByRole('radio', { name: /Forged Twin/ }).click();
    const c = await count();
    expect(c.style === 'twin5' && c.root === a.root, `back to ${c.style}, root children ${c.root}`);
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    return `2 styles; Cross Lace fitted and saved, 4 wheels, root ${a.root} children throughout; back to Forged Twin`;
  });
  // Lifestyle (homes): bought with earned credits, adds garage slots, starts a drive at the nearest real exit, sells for 60 %
  await check('Lifestyle: a home is bought with credits, adds a garage slot, sets the start to its exit, and sells back', async () => {
    const before = await game(page, () => { const p = window.__game.profile.p; const keep = { credits: p.credits, homes: [...p.homes], home: p.home }; p.credits = 10000; p.homes = []; p.home = ''; return keep; });
    await page.getByRole('button', { name: 'Lifestyle', exact: true }).click();
    const cards = await page.locator('.home-card').count();
    const slots0 = await game(page, () => window.__game.profile.slots);
    await page.locator('.home-card', { hasText: 'Orangewood Studio' }).getByRole('button', { name: /^Buy/ }).click();
    const a = await game(page, () => { const g = window.__game; return { credits: g.profile.p.credits, homes: g.profile.p.homes, home: g.profile.p.home, slots: g.profile.slots }; });
    const locked = await page.locator('.home-card', { hasText: 'Clifftop House' }).getByRole('button', { name: /^Buy/ }).isDisabled();
    await page.screenshot({ path: path.join(OUT, 'launch-homes.png') });
    expect(cards === 9, `${cards} homes listed`);
    expect(a.credits === 2000 && a.homes.join() === 'orangewood' && a.home === 'orangewood', `after buying: ${JSON.stringify(a)}`);
    expect(a.slots === slots0 + 1, `garage slots ${slots0} → ${a.slots}`);
    expect(locked, 'the level-15 home can be bought at level 1');
    await page.locator('.home-card', { hasText: 'Orangewood Studio' }).getByRole('button', { name: 'Start here' }).click();
    const pick = (await page.locator('.pick', { hasText: 'Start on' }).first().innerText()).replace(/\s+/g, ' ');
    expect(/Orangewood Avenue/.test(pick), `the Start pick says "${pick}"`);
    await page.getByRole('button', { name: 'Lifestyle', exact: true }).click();
    await page.locator('.home-card', { hasText: 'Orangewood Studio' }).getByRole('button', { name: /^Sell/ }).click();
    const b = await game(page, () => { const p = window.__game.profile.p; return { credits: p.credits, homes: p.homes.length }; });
    expect(b.credits === 2000 + 4800 && b.homes === 0, `after selling: ${JSON.stringify(b)}`);
    await page.locator('.panel').getByRole('button', { name: 'Done' }).click();
    await game(page, (k) => { const g = window.__game, p = g.profile.p; p.credits = k.credits; p.homes = k.homes; p.home = k.home; g.profile.save(); }, before);
    return `9 homes; bought Orangewood for 8,000 (slots ${slots0} → ${a.slots}); Start pick "${pick.slice(0, 60)}"; sold for 4,800`;
  });
  await check('Start panel lists every real exit on a carriageway; picking one starts 450 m before its sign', async () => {
    const exits = await game(page, (l) => window.__game.exitsFor(l), road);
    expect(exits.length >= 10, `${exits.length} exits on ${road}`);
    want = exits.find((e) => /Orangewood/.test(e.text)) ?? exits[0];
    await page.locator('.pick', { hasText: 'Start on' }).first().click();
    await page.locator('.grid.roads .gcell').filter({ has: page.locator('.shield', { hasText: /^57$/ }) }).filter({ hasText: 'North' }).click();
    const listed = await page.locator('.grid.exits .gcell').count();
    await page.screenshot({ path: path.join(OUT, 'launch-exits.png') });
    expect(listed === exits.length, `${listed} listed, ${exits.length} in the data`);
    await page.locator('.grid.exits .gcell', { hasText: want.text }).first().click();
    const pick = await page.locator('.pick', { hasText: 'Start on' }).first().innerText();
    expect(pick.includes(want.text), `the Start pick says "${pick.replace(/\s+/g, ' ')}"`);
    await drive(page, 'Free Drive');
    const r = await game(page, () => { const g = window.__game; return { road: g.path.label, main: g.path.main, s: g.phys.s }; });
    expect(r.main && r.road === road, `started on ${r.road}`);
    const ahead = want.s - r.s;
    expect(ahead > 430 && ahead < 470, `${fmt(ahead)} m before the sign`);
    return `${exits.length} exits on ${road}; started ${fmt(ahead)} m before "${want.text}"`;
  });
  await check('Clear Path with no traffic says so and keeps its charge', async () => {
    const r = await game(page, () => {
      const g = window.__game;
      g.updateSettings({ ...g.settings, density: 'none' });
      g.traffic.cars.length = 0; g.fastForward(1, {}, 40);
      const fired = g.useAbility(), ready = g.ability.ready, cars = g.traffic.cars.length, name = g.ability.def.name;
      g.updateSettings({ ...g.settings, density: 'moderate' });
      return { fired, ready, cars, name };
    });
    expect(r.name === 'Clear Path', `driver has ${r.name}`);
    expect(r.cars === 0 && !r.fired && r.ready, JSON.stringify(r));
    return `${r.cars} cars: not fired, still ready`;
  });
  await check('Feedback report names the browser, the GPU, the preset, the frame rate and the drive', async () => {
    await game(page, () => window.__game.setPaused(true));
    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    const text = await page.locator('textarea.report').inputValue();
    await page.screenshot({ path: path.join(OUT, 'launch-feedback.png') });
    for (const k of ['Chrome', 'GPU:', 'Low', 'fps', road]) expect(text.includes(k), `the report lacks "${k}": ${text.slice(0, 160)}`);
    // the game is "OC Ultra" (owner, 2026-10-16): the report's first line names it
    expect(/^OC Ultra \S+ · feedback report/.test(text), `the report starts "${text.split('\n')[0]}"`);
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await game(page, () => window.__game.setPaused(false));
    const line = (p) => text.split('\n').find((l) => l.startsWith(p)) ?? '';
    return `${line('GPU')}; ${line('Frame rate')}`;
  });
  await check('the run card downloads as a 1080 × 1350 PNG', async () => {
    await game(page, () => { const g = window.__game; g.fastForward(20, {}, 40); g.endFreeDrive(); });
    await page.waitForSelector('.result', { timeout: 10000 });
    // the results screen still renders the scene behind it at 1-2 fps here, so the click and the card take a while
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.getByRole('button', { name: 'Share run' }).click()]);
    const file = path.join(OUT, 'launch-run-card.png');
    await dl.saveAs(file);
    const buf = readFileSync(file);
    expect(buf.length > 20000 && buf.subarray(1, 4).toString() === 'PNG', `${buf.length} bytes`);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    expect(w === 1080 && h === 1350, `${w} × ${h}`);
    // named for the game, OC Ultra (owner, 2026-10-16): oc-ultra-<mode>-<score>.png
    expect(/^oc-ultra-free-\d+\.png$/.test(dl.suggestedFilename()), `the card is called ${dl.suggestedFilename()}`);
    return `${dl.suggestedFilename()}, ${w} × ${h}, ${Math.round(buf.length / 1024)} KB`;
  });
  // characters and story (the phone's Messages): a message with a job arrives, Set it up picks the mode, a run that
  // meets it is paid and the results say so, and the thread's next message opens
  await check("story: Mara's job is set up from the phone, a run meets it, it's paid and her next message opens", async () => {
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.waitForSelector('.overlay.menu');
    const keep = await game(page, () => { const p = window.__game.profile.p; const k = { story: JSON.parse(JSON.stringify(p.story)), credits: p.credits, xp: p.xp }; p.story = { done: [], read: [] }; return k; });
    await page.getByRole('button', { name: /^Phone/ }).click();
    const badge = await page.locator('.ph-app', { hasText: 'Messages' }).locator('.ph-badge').innerText();
    await page.getByRole('button', { name: /^Messages/ }).click();
    await page.locator('.ph-row', { hasText: 'Mara Ortiz' }).click();
    const job = await page.locator('.ph-job').first().innerText();
    await page.screenshot({ path: path.join(OUT, 'launch-story-thread.png') });
    expect(badge === '1', `the Messages badge reads ${badge}`);
    expect(/Reach 120 mph/.test(job) && /600 credits/.test(job), `the job reads "${job.replace(/\s+/g, ' ')}"`);
    await page.locator('.ph-job').first().getByRole('button', { name: 'Set it up' }).click();
    await page.waitForSelector('.overlay.menu');
    const picked = await page.getByRole('radio', { name: /Free Drive/ }).getAttribute('aria-checked');
    expect(picked === 'true', `Free Drive chosen: ${picked}`);
    await drive(page, 'Free Drive');
    const c0 = await game(page, () => window.__game.profile.p.credits);
    await game(page, () => { const g = window.__game; g.fastForward(5, {}, 30); g.top = 60; g.endFreeDrive(); });
    await page.waitForSelector('.result', { timeout: 10000 });
    const text = (await page.locator('.result').innerText()).replace(/\s+/g, ' ');
    const after = await game(page, () => { const p = window.__game.profile.p; return { done: p.story.done, credits: p.credits }; });
    await page.screenshot({ path: path.join(OUT, 'launch-story-done.png') });
    expect(/Job done for Mara Ortiz/i.test(text), `the results say: ${text.slice(0, 200)}`);
    expect(after.done.includes('mara-1') && after.credits - c0 >= 600, `done ${after.done}, credits +${Math.round(after.credits - c0)}`);
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: /^Phone/ }).click();
    const next = await page.locator('.ph-app', { hasText: 'Messages' }).locator('.ph-badge').innerText().catch(() => '0');
    expect(next === '1', `after the job, ${next} unread (Mara's next)`);
    await page.locator('.ph-home').click();
    await game(page, (k) => { const g = window.__game, p = g.profile.p; p.story = k.story; p.credits = k.credits; p.xp = k.xp; g.profile.save(); }, keep);
    return `badge 1; "${job.split('\n')[0]}"; Set it up chose Free Drive; paid +${Math.round(after.credits - c0)} credits (with the drive's own); next message unread`;
  });
  // activities (errands): a real exit within a time limit; taking its ramp delivers, running out of time calls it off
  await check("errand: Sal's parcel sets up 57 North, the HUD shows the exit and clock, time-out calls it off, the exit ramp delivers it", async () => {
    const keep = await game(page, () => { const p = window.__game.profile.p; const k = { story: JSON.parse(JSON.stringify(p.story)), credits: p.credits, xp: p.xp }; p.story = { done: ['sal-1'], read: [] }; p.xp = Math.max(p.xp, 400); return k; });
    await page.getByRole('button', { name: /^Phone/ }).click();
    await page.getByRole('button', { name: /^Messages/ }).click();
    await page.locator('.ph-row', { hasText: 'Sal Reyes' }).click();
    const card = page.locator('.ph-job', { hasText: 'Imperial Highway' });
    const job = (await card.innerText()).replace(/\s+/g, ' ');
    await card.getByRole('button', { name: 'Set it up' }).click();
    await page.waitForSelector('.overlay.menu');
    const pick = (await page.locator('.pick', { hasText: 'Start on' }).first().innerText()).replace(/\s+/g, ' ');
    expect(/Errand: the Imperial Highway exit off the CA-57 North, within 6:00/.test(job), `the job reads "${job}"`);
    expect(/57/.test(pick) && /North/.test(pick), `the Start pick says "${pick}"`);
    await drive(page, 'Free Drive');
    await frames(page, 3);
    const e = await game(page, () => { const g = window.__game, x = g.errand; return x && { text: x.sign.text.join(' / '), ahead: Math.round(x.sign.s - g.phys.s), t: x.t, road: g.path.label }; });
    const hudNext = await page.locator('.hud-next').innerText();
    await page.screenshot({ path: path.join(OUT, 'launch-errand-hud.png') });
    expect(e && /Imperial Highway/.test(e.text) && e.ahead > 7000 && e.road === 'CA-57 North', `errand ${JSON.stringify(e)}`);
    expect(/Errand: Imperial Highway exit/.test(hudNext), `the HUD's guidance reads "${hudNext}"`);
    // time-out, on a copy of the live errand: ticking past its clock calls it off
    const off = await game(page, () => { const g = window.__game, live = g.errand; g.errand = { ...live, t: 0.05 }; g.errandTick(0.1); const gone = g.errand === null; g.errand = live; return gone; });
    expect(off, 'an errand past its clock is still live');
    // delivered: onto the exit's own ramp
    const c0 = await game(page, () => window.__game.profile.p.credits);
    await game(page, () => { const g = window.__game, r = g.errand.sign.ramp; g.enterPath(r, 20, r.laneCenter(0)); g.fastForward(0.5, {}, 30); });
    await page.waitForSelector('.result', { timeout: 10000 });
    const text = (await page.locator('.result').innerText()).replace(/\s+/g, ' ');
    const after = await game(page, () => { const p = window.__game.profile.p; return { done: p.story.done, credits: p.credits, errand: window.__game.errand }; });
    expect(/Delivered/i.test(text) && /Job done for Sal Reyes/i.test(text), `the results say: ${text.slice(0, 160)}`);
    expect(after.done.includes('sal-e1') && after.credits - c0 >= 1400 && after.errand === null, `done ${after.done}, +${Math.round(after.credits - c0)}, errand ${JSON.stringify(after.errand)}`);
    await page.getByRole('button', { name: 'Main menu' }).click();
    await game(page, (k) => { const g = window.__game, p = g.profile.p; p.story = k.story; p.credits = k.credits; p.xp = k.xp; g.profile.save(); }, keep);
    return `"${job}"; sign ${e.text} ${(e.ahead / 1609.344).toFixed(1)} mi ahead; HUD "${hudNext}"; time-out calls it off; the ramp delivered it, +${Math.round(after.credits - c0)} credits`;
  });
});

// ------------------------------------------------------------------------------------------- the store (test mode)
// The paywall in TEST MODE (the build has no VITE_ store settings): the catalog on show with its prices, a declined
// test card, the Founder Pack bought with 4242, a reload, the paint on the car, the tip's floor, a subscription's
// terms, the run-card badge, the phone layout, and no request to Supabase or Stripe. The OC Hypercar Founder
// Edition's card ("Coming soon" until the car is in the game) and its garage grant (outside the slot count, never
// sold for credits, out on sign-out and back on sign-in). Plus, in Node, the server's webhook signature check against
// known vectors, its Stripe form encoding, and the Founder Edition's serial numbers through the real webhook on a
// throwaway Postgres (server/supabase/tests/serial-webhook.mjs; reported as not run where Postgres isn't installed).
const STORE_HOSTS = /(^|\.)(supabase\.(co|in|com)|stripe\.(com|network)|stripecdn\.com)$/i;
const storeMoney = (c) => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
const storePrice = (s) => (s.kind === 'tip' && s.custom_amount ? `From ${storeMoney(s.custom_amount.minimum_cents)}, pay what you want` : s.mode === 'subscription' ? `${storeMoney(s.price_cents)} a ${s.interval}` : storeMoney(s.price_cents));
// the one founder window (src/store/founder.json), which catalog.json's founder items name as "FOUNDER_UNTIL"
const FOUNDER_UNTIL = JSON.parse(readFileSync(path.join(ROOT, 'src/store/founder.json'), 'utf8')).FOUNDER_UNTIL;
const storeUntil = (s) => (s.window?.until === 'FOUNDER_UNTIL' ? FOUNDER_UNTIL : s.window?.until);
const storeOnSale = (s) => s.available && (!s.window || Date.now() <= Date.parse(storeUntil(s)));
// a server module (TypeScript for Deno) as an ES module Node can import: types stripped by the TypeScript compiler
// the project already has, no new dependency
async function importServerTs(rel) {
  const ts = (await import('typescript')).default;
  const src = readFileSync(path.join(ROOT, rel), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
// in the page: the test-mode ledger's entitlement ids
const ownedIds = (page) => game(page, () => { try { return Object.values(JSON.parse(localStorage.getItem('ocu.store.owned') || '{}')).flatMap((x) => x.items.map((i) => i.entitlement)); } catch { return []; } });
// age question, then sign-in (test mode signs straight in), inside the checkout sheet
async function storeSignIn(sheet, email) {
  await sheet.getByLabel('Month', { exact: true }).selectOption('6');
  await sheet.getByLabel('Year', { exact: true }).fill('1990');
  await sheet.getByRole('button', { name: 'Continue' }).click();
  await sheet.getByLabel('Email', { exact: true }).fill(email);
  await sheet.getByRole('button', { name: 'Send my sign-in link' }).click();
  await sheet.getByLabel('Card number').waitFor();
}
// a screenshot once the panels' entrance animations have finished (software rendering starts them late)
async function storeShot(page, name) {
  await page.waitForTimeout(350);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 60000 }).catch(() => {});
  // the capture waits for a frame of the game drawing behind the store; under load that has taken over 120 s
  // (2026-10-21, load average 35 to 40), so it gets the frames' allowance: the picture is not what a check asserts
  await page.screenshot({ path: path.join(OUT, name), timeout: FRAMES_MS });
}
// a crop of one element as it sits in the viewport. Not locator.screenshot(): that first waits for the element to hold
// still over two animation frames, and with the game rendering behind the store in software under load that wait
// alone has run past two minutes (2026-10-18). The page is already settled by storeShot.
async function storeCrop(page, locator, name) {
  const r = await locator.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; });
  const x = Math.max(0, r.x), y = Math.max(0, r.y), w = Math.min(r.vw, r.x + r.w) - x, h = Math.min(r.vh, r.y + r.h) - y;
  if (w > 0 && h > 0) await page.screenshot({ path: path.join(OUT, name), clip: { x, y, width: w, height: h }, timeout: FRAMES_MS });
}
// in the page: every price on the store (or the checkout sheet) and the test-mode notice that must sit right under it,
// drawn and readable: a price with no notice, a hidden notice or one more than 12 px from its price is a problem
const storePriceTags = (page, scope = '.store-panel') => page.evaluate((sel) => {
  const shown = (el) => { if (!el) return false; const b = el.getBoundingClientRect(), cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.5; };
  const prices = [...document.querySelectorAll(`${sel} .store-price, ${sel} .store-sheet-price`)];
  const bad = [];
  for (const p of prices) {
    const tag = p.classList.contains('store-sheet-price') ? p.nextElementSibling : p.closest('.store-pricebox')?.querySelector('.store-test-tag');
    const gap = tag ? tag.getBoundingClientRect().top - p.getBoundingClientRect().bottom : Infinity;
    const ok = !!tag && tag.classList.contains('store-test-tag') && shown(tag) && /^Test mode · nothing is charged$/.test(tag.textContent.trim()) && gap >= -1 && gap <= 12;
    if (!ok) bad.push(`${p.closest('[data-sku]')?.getAttribute('data-sku') ?? '?'} ${p.textContent.trim()}: ${tag ? `notice "${tag.textContent.trim()}" ${shown(tag) ? 'shown' : 'hidden'}, ${Math.round(gap)} px below` : 'no notice'}`);
  }
  const inView = prices.filter((p) => { const b = p.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; }).length;
  return { prices: prices.length, inView, bad };
}, scope);
// The game draws its scene behind the store on every frame. In software rendering on a shared machine that frame can
// take minutes (2026-10-21: nine headless browsers on these 4 cores, load average 45 to 50), and then a screenshot ran
// past 240 s and a click past 120 s, though nothing the store does was wrong. The store's checks are about its UI, so
// while they run the game's frame loop is held (its last frame stays behind the panel) and it resumes before anything
// that drives or renders (the Founders Sunset run). Test-only: it cancels the game's requestAnimationFrame and starts
// it again, through window.__game, and changes nothing in the game.
const holdGame = (page) => game(page, () => { const g = window.__game; if (!g.__held) { cancelAnimationFrame(g.raf); g.__held = true; } });
const resumeGame = (page) => game(page, () => { const g = window.__game; if (g.__held) { g.__held = false; g.raf = requestAnimationFrame(g.frame); } });
async function storeCard(sheet, number) {
  await sheet.getByLabel('Card number', { exact: true }).fill(number);
  await sheet.getByLabel('Expiry', { exact: true }).fill('12/30');
  await sheet.getByLabel('CVC', { exact: true }).fill('123');
}

await group('store', async (use) => {
  const { page, requests } = await use({ size: [1440, 900] });
  const cat = JSON.parse(readFileSync(path.join(ROOT, 'src/store/catalog.json'), 'utf8'));
  const sale = cat.filter(storeOnSale), founder = cat.find((s) => s.sku === 'founder-pack-2026'), hyper = cat.find((s) => s.sku === 'hypercar-founder');
  const sheet = page.locator('.store-sheet .panel');

  await check('catalog: the two files agree with each other, the code and the server copy', () => {
    const a = execFileSync('node', [path.join(ROOT, 'tools/store-check-catalog.mjs')], { encoding: 'utf8' }).trim();
    const b = execFileSync('node', [path.join(ROOT, 'tools/store-sync-catalog.mjs'), '--check'], { encoding: 'utf8' }).trim();
    return `${a}; ${b}`;
  });

  await check('webhook: the Stripe-Signature check passes known vectors and refuses tampering, wrong keys and old timestamps', async () => {
    const m = await importServerTs('server/supabase/functions/_shared/stripe-signature.ts');
    const { createHmac } = await import('node:crypto');
    // RFC 4231 test case 2 for HMAC-SHA256
    const rfc = await m.hmacSha256Hex('Jefe', 'what do ya want for nothing?');
    expect(rfc === '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843', `RFC 4231 case 2: ${rfc}`);
    // a Stripe-style delivery, signed independently with node:crypto
    const secret = 'whsec_test_oc_ultra_secret', t = 1792195200, body = '{"id":"evt_test_1","type":"checkout.session.completed","data":{"object":{"id":"cs_test_a1"}}}';
    const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    const v = (b, h, sec = secret, now = t + 30) => m.verifyStripeSignature(b, h, sec, { nowSec: now });
    const good = await v(body, `t=${t},v1=${sig}`);
    const rolled = await v(body, `t=${t},v1=${'0'.repeat(64)},v1=${sig},v0=abc`);
    const tampered = await v(body.replace('cs_test_a1', 'cs_test_a2'), `t=${t},v1=${sig}`);
    const wrongKey = await v(body, `t=${t},v1=${sig}`, 'whsec_someone_else');
    const old = await v(body, `t=${t},v1=${sig}`, secret, t + 301);
    const future = await v(body, `t=${t},v1=${sig}`, secret, t - 301);
    const noHeader = await v(body, null);
    const junk = await v(body, 'v1=nothex,t=abc');
    expect(good.ok && rolled.ok, `good ${JSON.stringify(good)} rolled ${JSON.stringify(rolled)}`);
    for (const [k, r] of Object.entries({ tampered, wrongKey, old, future, noHeader, junk })) expect(!r.ok, `${k} passed`);
    const f = await importServerTs('server/supabase/functions/_shared/form.ts');
    const enc = f.formEncode({ mode: 'payment', line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 300, product_data: { name: 'Coast Paint Pack' } } }], metadata: { sku: 'paint-pack-coast', roll_name: undefined }, lookup_keys: ['tip-fuel-the-build'] });
    const want = 'mode=payment&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=300&line_items%5B0%5D%5Bprice_data%5D%5Bproduct_data%5D%5Bname%5D=Coast%20Paint%20Pack&metadata%5Bsku%5D=paint-pack-coast&lookup_keys%5B0%5D=tip-fuel-the-build';
    expect(enc === want, `form encoding: ${enc}`);
    return `RFC 4231 ok; good and rolled-secret headers pass; tampered, wrong key, ±301 s, missing and malformed fail (${old.reason}); form encoding ok`;
  });

  await check('the store opens from the menu with every available item and its price', async () => {
    await holdGame(page);
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.waitForSelector('.store-panel');
    const banner = (await page.locator('.store-panel .store-mode').innerText()).replace(/\s+/g, ' ');
    expect(/test mode/i.test(banner) && banner.includes('Nothing is charged. Use 4242 4242 4242 4242.'), `banner: ${banner}`);
    // "Coming soon" cards (data-soon) are shown but not sold; the hypercar's has its own check below
    const shown = await page.$$eval('.store-panel [data-sku]:not([data-soon])', (els) => els.map((e) => ({ sku: e.getAttribute('data-sku'), price: e.querySelector('.store-price')?.textContent?.trim() })));
    for (const s of sale) {
      const x = shown.find((y) => y.sku === s.sku);
      expect(x, `${s.sku} is not shown`);
      expect(x.price === storePrice(s), `${s.sku} shows "${x.price}", the catalog says "${storePrice(s)}"`);
    }
    const extra = shown.filter((x) => !sale.some((s) => s.sku === x.sku));
    expect(!extra.length, `shown but not on sale: ${extra.map((x) => x.sku).join(', ')}`);
    await storeShot(page, 'store-1440.png');
    const brio = await page.locator('[data-sku="wheels-rossini-brio"] .store-act').textContent();
    expect(/Earn the Rossini Brio first/.test(brio), `Brio wheel set: "${brio}"`);
    const paintBefore = await page.locator('[data-paint="paint-founders-sunset"]').count();
    expect(paintBefore === 0, 'Founders Sunset is offered before it is bought');
    const when = await page.locator('[data-sku="founder-pack-2026"] .store-founder-when').innerText();
    expect(/December 31, 2026/i.test(when), `Founder window: ${when}`);
    return `${shown.length} items with their prices (${sale.length} on sale; ${cat.length - sale.length} not offered); "${banner}"; Brio wheels: "${brio}"`;
  });

  await check('the OC Hypercar Founder Edition card: $4.99, the founder window, its plaque and paint, not in the Founder Pack, "Coming soon"', async () => {
    const card = page.locator('.store-panel [data-sku="hypercar-founder"]');
    await card.waitFor();
    const r = await card.evaluate((el) => ({
      // textContent: the words as written (innerText would apply the card's uppercase styling)
      soon: el.getAttribute('data-soon'), text: [...el.querySelectorAll('p, h3, li, em')].map((n) => n.textContent).join(' ').replace(/\s+/g, ' '), buttons: el.querySelectorAll('button').length,
      grants: [...el.querySelectorAll('.store-grants li')].map((li) => li.textContent.trim()),
      frame: getComputedStyle(el, '::before').backgroundImage,
      // one column, like the Founder Pack's card (a stray class once made it a two-column grid with a hole in it)
      tracks: getComputedStyle(el).gridTemplateColumns.split(' ').length,
    }));
    expect(r.tracks === 1, `the card's grid has ${r.tracks} columns`);
    expect(!hyper.available && r.soon === 'true' && r.buttons === 0, `available ${hyper.available}, data-soon ${r.soon}, ${r.buttons} buttons`);
    for (const k of ['OC Hypercar Founder Edition', '$4.99', 'Founder Edition · sold until Dec 31, 2026', 'Coming soon', 'The $10 Founder Pack does not include this car', 'No pre-orders'])
      expect(r.text.includes(k), `the card lacks "${k}": ${r.text.slice(0, 300)}`);
    expect(r.grants.some((g) => /Founder Edition plaque/.test(g)) && r.grants.some((g) => /OC Founder Silver paint/.test(g) && /Founder Ice lights/.test(g)), `grants: ${r.grants.join(' | ')}`);
    // the two founder offers keep apart: none of the pack's names on this card's grants, and no sunset look
    expect(!r.grants.some((g) => /Founders Sunset|Founder '26|run-card frame/.test(g)), `grants: ${r.grants.join(' | ')}`);
    expect(!/253, 145, 35|232, 98, 44/.test(r.frame), `the card's frame uses the Founder Pack's sunset: ${r.frame}`);
    await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await storeShot(page, 'store-hypercar-1440x900.png');
    await storeCrop(page, card, 'store-hypercar-card-1440.png');
    return `"${r.text.slice(0, 160)}…"; grants: ${r.grants.join(' | ')}`;
  });

  await check('every price carries the test-mode notice right under it, at 1440 × 900 and 1280 × 720', async () => {
    const wide = await storePriceTags(page);
    expect(wide.prices >= sale.length + 1 && !wide.bad.length, `1440: ${wide.prices} prices; ${wide.bad.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 720 });
    try {
      await page.locator('.store-panel').evaluate((el) => el.closest('.overlay')?.scrollTo(0, 0));
      await storeShot(page, 'store-1280x720.png');
      const top = await storePriceTags(page);
      const card = page.locator('.store-panel [data-sku="hypercar-founder"]');
      await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await storeShot(page, 'store-hypercar-1280x720.png');
      await page.locator('.store-panel .store-group').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await storeShot(page, 'store-items-1280x720.png');
      const items = await storePriceTags(page);
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(!top.bad.length && !items.bad.length && items.inView > 0 && !sideways, `1280: ${[...top.bad, ...items.bad].join(' | ')}; ${items.inView} prices in view; sideways scroll ${sideways}`);
      return `${wide.prices} prices, each with "Test mode · nothing is charged" under it at 1440 and 1280 (${items.inView} in view on the items screen)`;
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator('.store-panel').evaluate((el) => el.closest('.overlay')?.scrollTo(0, 0));
    }
  });

  await check('4000 0000 0000 0002 is declined and grants nothing', async () => {
    await page.getByRole('button', { name: /^Buy Coast Paint Pack/ }).click();
    await storeSignIn(sheet, 'founder@example.com');
    await sheet.getByLabel(/18 or over/).check();
    await storeCard(sheet, '4000 0000 0000 0002');
    await sheet.getByRole('button', { name: /^Pay \$3\.00/ }).click();
    const err = await sheet.locator('.store-err').innerText();
    expect(/declined/i.test(err) && /Nothing was charged/.test(err), `message: ${err}`);
    const o = await ownedIds(page);
    expect(o.length === 0, `owned after a decline: ${o.join(', ')}`);
    // a card that isn't one of Stripe's test cards is refused unread
    await storeCard(sheet, '4111 1111 1111 1111');
    await sheet.getByRole('button', { name: /^Pay \$3\.00/ }).click();
    await page.waitForFunction(() => /test cards only/.test(document.querySelector('.store-sheet .store-err')?.textContent ?? ''));
    expect((await ownedIds(page)).length === 0, 'a non-test card granted something');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    return `"${err}"; a non-test card is refused; 0 items`;
  });

  await check('buying the Founder Pack with 4242 grants its entitlements and shows a receipt', async () => {
    await page.getByRole('button', { name: /^Buy Founder Pack/ }).click();
    await sheet.getByLabel(/18 or over/).check();
    await sheet.getByLabel(/Founders roll/).check();
    await sheet.getByLabel(/Name on the roll/).fill('Test Founder');
    await storeCard(sheet, '4242 4242 4242 4242');
    const sheetTags = await storePriceTags(page, '.store-sheet');
    expect(sheetTags.prices === 1 && !sheetTags.bad.length, `checkout price: ${sheetTags.prices} prices; ${sheetTags.bad.join(' | ')}`);
    await sheet.getByRole('button', { name: /^Pay \$10\.00/ }).scrollIntoViewIfNeeded();
    await storeShot(page, 'store-checkout-1440.png');
    await sheet.getByRole('button', { name: /^Pay \$10\.00/ }).click();
    await sheet.locator('.store-receipt').waitFor();
    const text = (await sheet.locator('.store-receipt').innerText()).replace(/\s+/g, ' ');
    expect(/Test mode: nothing was charged/i.test(text) && text.includes('$10.00') && text.includes('Visa •••• 4242') && text.includes('Test Founder'), `receipt: ${text}`);
    const o = await ownedIds(page), missing = founder.grants.filter((g) => !o.includes(g));
    expect(!missing.length, `not granted: ${missing.join(', ')}`);
    const stored = await game(page, () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(!stored.includes('4242424242424242') && !stored.includes('4242 4242 4242 4242'), 'the card number was stored');
    await storeShot(page, 'store-receipt-1440.png');
    return `${founder.grants.length} of ${founder.grants.length} entitlements; receipt: ${text.slice(0, 150)}`;
  });

  await check('the Founders Sunset paint becomes selectable and goes on the car (pearl finish on every body-paint mesh)', async () => {
    await sheet.getByRole('button', { name: 'Done' }).click();
    const btn = page.locator('.store-locker [data-paint="paint-founders-sunset"]');
    await btn.click();
    expect(await btn.getAttribute('aria-pressed') === 'true', 'not pressed');
    const read = () => game(page, () => {
      const c = window.__game.car, m = c.mats.paint, all = [];
      for (const g of [c.exterior, c.interior?.group]) g?.traverse((o) => { if (o.isMesh && o.material?.name === 'paint') all.push(o.material.color.getHexString()); });
      return { paint: c.config.paint, finish: c.config.finish, color: m.color.getHexString(), metal: m.metalness, rough: m.roughness, coat: m.clearcoat, coatRough: m.clearcoatRoughness, meshes: all.length, off: all.filter((h) => h !== m.color.getHexString()).length };
    });
    const on = await read();
    expect(on.paint === 0xe8622c && on.color === 'e8622c', JSON.stringify(on));
    expect(on.metal === 0.35 && on.rough === 0.25 && on.coat === 1 && on.coatRough === 0.03, `finish ${JSON.stringify(on)}`);
    expect(on.meshes > 0 && on.off === 0, `${on.off} of ${on.meshes} paint meshes not repainted`);
    await page.locator('.store-locker .store-paint').first().click();          // Factory paint
    const off = await read();
    expect(off.finish === null && off.color !== 'e8622c' && off.off === 0, `factory: ${JSON.stringify(off)}`);
    await btn.click();
    return `on: #${on.color}, metalness ${on.metal}, roughness ${on.rough}, clear coat ${on.coat}/${on.coatRough}, ${on.meshes} paint meshes; factory: #${off.color}`;
  });

  await check('the tip is pay what you want from $2, one badge at any amount', async () => {
    await page.getByRole('button', { name: /^Support Fuel the Build/ }).click();
    await sheet.getByLabel(/18 or over/).check();
    await sheet.getByLabel(/Or type an amount/).fill('1');
    await storeCard(sheet, '4242424242424242');
    await sheet.getByRole('button', { name: /^Pay \$1\.00/ }).click();
    const err = await sheet.locator('.store-err').innerText();
    expect(/from \$2/.test(err), `under the floor: ${err}`);
    expect(!(await ownedIds(page)).includes('badge-supporter'), 'badge granted under the floor');
    await sheet.getByLabel(/Or type an amount/).fill('7');
    await sheet.getByRole('button', { name: /^Pay \$7\.00/ }).click();
    await sheet.locator('.store-receipt').waitFor();
    expect((await ownedIds(page)).includes('badge-supporter'), 'no badge after $7');
    await sheet.getByRole('button', { name: 'Done' }).click();
    return `$1 refused ("${err}"); $7 grants the badge`;
  });

  await check('a subscription shows its price and renewal terms before an unticked checkbox (preview; the club is not on sale)', async () => {
    await game(page, () => window.__store.preview('club-yearly'));
    await sheet.locator('.store-renew').waitFor();
    const r = await game(page, () => {
      const t = document.querySelector('.store-sheet .store-renew');
      const cb = [...document.querySelectorAll('.store-sheet .store-check')].find((l) => /renewal terms/.test(l.textContent));
      return { terms: t.innerText, before: !!(t.compareDocumentPosition(cb) & Node.DOCUMENT_POSITION_FOLLOWING), checked: cb.querySelector('input').checked, pay: document.querySelector('.store-sheet .btn.primary').disabled };
    });
    expect(r.before && !r.checked && r.pay, JSON.stringify(r));
    for (const k of ['$30.00 a year', 'until you cancel', 'Cancel online', 'remind you before each yearly renewal']) expect(r.terms.includes(k), `terms lack "${k}"`);
    await storeShot(page, 'store-club-terms-1440.png');
    await game(page, () => window.__store.close());
    return r.terms.split('\n')[0];
  });

  await check('the purchase survives a reload', async () => {
    await page.reload();
    await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: BOOT_MS });
    await holdGame(page);
    const paint = await game(page, () => window.__game.car.config.paint);
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.waitForSelector('.store-panel');
    const act = await page.locator('[data-sku="founder-pack-2026"] .store-act').textContent();
    const who = (await page.locator('.store-account').innerText()).replace(/\s+/g, ' ');
    const o = await ownedIds(page), missing = founder.grants.filter((g) => !o.includes(g));
    expect(/Owned/i.test(act) && !missing.length, `after reload: "${act}", missing ${missing.join(', ')}`);
    expect(who.includes('founder@example.com') && who.includes("Founder '26"), `account: ${who}`);
    expect(paint === 0xe8622c, `car paint after reload #${paint.toString(16)}`);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    return `Founder Pack "${act}"; ${o.length} entitlements; the car still wears #${paint.toString(16)}; "${who.slice(0, 80)}"`;
  });

  await check('the car in Founders Sunset, and the Founder badge and frame on the run card', async () => {
    // this one drives and renders: the menu's two clicks with the loop still held, then the loop runs until the chase
    // camera has drawn six frames, and is held again for the shot and the run card (a 2D canvas of its own)
    await page.getByRole('radio', { name: /Free Drive/ }).click();
    await page.getByRole('button', { name: 'Drive', exact: true }).click();
    await resumeGame(page);
    await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: FRAMES_MS });
    await game(page, () => { const g = window.__game; g.fastForward(6, {}, 30); g.cycleCam(); g.cycleCam(); });
    await frames(page, 6);
    await holdGame(page);
    await storeShot(page, 'store-founders-sunset-chase.png');
    await game(page, () => { const g = window.__game; g.fastForward(10, {}, 40); g.endFreeDrive(); });
    await page.waitForSelector('.result', { timeout: 60000 });
    // the card is drawn from the game's canvas: under load (2026-10-21, load average 45 to 50) that took over 90 s, so
    // the download gets the frames' allowance; the pixels below are what the check asserts
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: FRAMES_MS }), page.getByRole('button', { name: 'Share run' }).click()]);
    const file = path.join(OUT, 'store-run-card-founder.png');
    await dl.saveAs(file);
    const px = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const at = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3);
      return { frame: at(18, 675), corner: at(4, 675), w: img.width, h: img.height };
    }, readFileSync(file).toString('base64'));
    const [r, gg, b] = px.frame;
    expect(px.w === 1080 && px.h === 1350, `${px.w} × ${px.h}`);
    expect(r > 170 && gg > 50 && gg < 150 && b < 110, `frame pixel rgb(${px.frame})`);
    return `chase shot saved; run card frame pixel rgb(${px.frame}), outside it rgb(${px.corner})`;
  });

  await check('the hypercar grant: oc-hyper joins the garage outside the slot count, is never sold for credits, leaves on sign-out and comes back on sign-in', async () => {
    // a test-mode ledger entry for the signed-in account, as a purchase would write it (the sku can't be bought yet)
    await game(page, (grants) => {
      const sess = JSON.parse(localStorage.getItem('ocu.store.session')), book = JSON.parse(localStorage.getItem('ocu.store.owned') || '{}');
      const mine = book[sess.userId] ?? { items: [], at: 0 };
      mine.items.push(...grants.map((g) => ({ entitlement: g, sku: 'hypercar-founder', granted_at: new Date().toISOString() })));
      book[sess.userId] = mine; localStorage.setItem('ocu.store.owned', JSON.stringify(book));
    }, hyper.grants);
    await page.reload();
    await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: BOOT_MS });
    await holdGame(page);
    const garage = () => game(page, () => { const b = window.__game.profile; return { vehicles: b.p.vehicles.slice(), used: b.slotsUsed, car: b.p.car, credits: b.p.credits }; });
    const a = await garage();
    const sold = await game(page, () => window.__game.profile.sell('oc-hyper', 100000));
    const after = await garage();
    expect(a.vehicles.includes('oc-hyper') && a.used === a.vehicles.length - 1, `garage ${JSON.stringify(a)}`);
    expect(/can't be sold for credits/.test(sold ?? '') && after.vehicles.includes('oc-hyper') && after.credits === a.credits, `sell: "${sold}", after ${JSON.stringify(after)}`);
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.waitForSelector('.store-panel');
    const serial = await page.locator('.store-locker .store-serial').innerText();
    expect(/no number here: only the server numbers a sale/.test(serial), `serial line: ${serial}`);
    await page.locator('.store-account').getByRole('button', { name: 'Sign out' }).click();
    await page.waitForFunction(() => !window.__game.profile.p.vehicles.includes('oc-hyper'));
    const out = await garage();
    await page.locator('.store-account').getByRole('button', { name: 'Sign in' }).click();
    await page.locator('.store-account').getByLabel('Email', { exact: true }).fill('founder@example.com');
    await page.locator('.store-account').getByRole('button', { name: 'Send my sign-in link' }).click();
    await page.waitForFunction(() => window.__game.profile.p.vehicles.includes('oc-hyper'), null, { timeout: 30000 });
    const back = await garage();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    expect(out.vehicles.join() === 'rossini-gt' && out.car === 'rossini-gt' && back.vehicles.includes('oc-hyper'), `signed out ${JSON.stringify(out)}, back ${JSON.stringify(back)}`);
    return `granted: ${a.vehicles.join(', ')} with ${a.used} slot used; sell: "${sold}"; signed out: ${out.vehicles.join(', ')}; signed in again: ${back.vehicles.join(', ')}; "${serial.slice(0, 70)}…"`;
  });

  await check('webhook: the Founder Edition serial, one per Checkout Session across retries, a refunded number retired, the founder window (real webhook, throwaway Postgres)', () => {
    let out = '', code = 0;
    try { out = execFileSync(process.execPath, [path.join(ROOT, 'server/supabase/tests/serial-webhook.mjs')], { encoding: 'utf8', stdio: 'pipe', timeout: 300000 }); }
    catch (e) { out = String(e.stdout ?? '') + String(e.stderr ?? ''); code = e.status ?? 1; }
    if (code === 3) return 'not run here: ' + out.trim();
    const last = out.trim().split('\n').pop();
    expect(code === 0, `exit ${code}: ${out.split('\n').filter((l) => /FAIL/.test(l)).join(' | ') || out.slice(-400)}`);
    return last;
  });

  await check('phone: the store and the checkout fit a 390 × 844 screen', async () => {
    await page.close();                      // the 1440 page's renders would starve this one's load in software rendering
    const ph = await open({ phone: true });
    try {
      const p = ph.page, sh = p.locator('.store-sheet .panel');
      await holdGame(p);
      const noSide = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.overlay')].every((o) => o.scrollWidth <= o.clientWidth + 1));
      await p.getByRole('button', { name: 'Store', exact: true }).click();
      await p.waitForSelector('.store-panel');
      await p.waitForTimeout(500);
      await storeShot(p, 'store-390.png');
      const a = await noSide();
      const phoneTags = await storePriceTags(p);
      expect(!phoneTags.bad.length && phoneTags.inView > 0, `phone prices: ${phoneTags.bad.join(' | ')}; ${phoneTags.inView} in view`);
      const hc = p.locator('.store-panel [data-sku="hypercar-founder"]');
      await hc.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await storeShot(p, 'store-hypercar-390x844.png');
      await storeCrop(p, hc, 'store-hypercar-card-390.png');
      const hcText = (await hc.textContent()).replace(/\s+/g, ' ');
      expect(hcText.includes('Coming soon') && hcText.includes('$4.99') && hcText.includes('Test mode · nothing is charged'), `phone hypercar card: ${hcText.slice(0, 200)}`);
      await p.locator('.store-panel .store-group').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await storeShot(p, 'store-items-390x844.png');
      const itemTags = await storePriceTags(p);
      expect(!itemTags.bad.length && itemTags.inView > 0, `phone item prices: ${itemTags.bad.join(' | ')}; ${itemTags.inView} in view`);
      await p.locator('.store-panel').evaluate((el) => el.closest('.overlay')?.scrollTo(0, 0));
      await p.getByRole('button', { name: /^Buy Founder Pack/ }).click();
      await storeSignIn(sh, 'phone@example.com');
      await sh.getByLabel(/18 or over/).check();
      await storeCard(sh, '4242 4242 4242 4242');
      await sh.getByLabel('Card number').scrollIntoViewIfNeeded();
      await storeShot(p, 'store-checkout-390.png');
      const b = await noSide();
      await sh.getByRole('button', { name: /^Pay \$10\.00/ }).click();
      await sh.locator('.store-receipt').waitFor();
      await storeShot(p, 'store-receipt-390.png');
      const c = await noSide();
      expect(a && b && c, `sideways scroll: store ${!a}, checkout ${!b}, receipt ${!c}`);
      expect(ph.errors.length === 0, ph.errors.slice(0, 2).join(' | '));
      const bad = ph.requests.filter((u) => { try { return STORE_HOSTS.test(new URL(u).hostname); } catch { return false; } });
      expect(!bad.length, bad.slice(0, 3).join(' '));
      return `store, checkout and receipt at 390 × 844 with no sideways scroll; ${phoneTags.prices} prices, each with the test-mode notice under it`;
    } finally { await ph.ctx.close(); }
  });

  await check('test mode sends nothing to Supabase or Stripe', () => {
    const hosts = [...new Set(requests.map((u) => { try { const x = new URL(u); return x.hostname || x.protocol; } catch { return u.slice(0, 24); } }))];
    const bad = requests.filter((u) => { try { return STORE_HOSTS.test(new URL(u).hostname); } catch { return false; } });
    expect(!bad.length, `requests to payment hosts: ${bad.slice(0, 3).join(' ')}`);
    return `${requests.length} requests, to: ${hosts.join(', ')}`;
  });
});

// ------------------------------------------------------------------------------------------- the store, live wiring
// LIVE mode's client against a mock project: the game built with VITE_PAYMENTS_LIVE=true and a Supabase URL on a
// host that doesn't exist (mock-oc-ultra.supabase.co), served over http://127.0.0.1, with Playwright answering
// Supabase Auth, REST and Functions and Stripe Checkout's page. Nothing real is contacted. It checks the magic-link
// request and return, that the checkout call carries the player's token and a sku but no price, that the card form
// is never shown, the hand-off to Stripe's page, the return, the receipt from the server's purchase row, the items
// from the server's entitlements, a cancelled checkout and a refused item.
await group('store-live', async () => {
  const MOCK = 'https://mock-oc-ultra.supabase.co', USER = '3f2b6c1e-8a4d-4c2e-9b7a-1d2e3f4a5b6c', EMAIL = 'live@example.com';
  const outDir = path.join(OUT, 'store-live-build');
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: ROOT, env: { ...process.env, VITE_SUPABASE_URL: MOCK, VITE_SUPABASE_ANON_KEY: 'eyJmock.anon.key', VITE_PAYMENTS_LIVE: 'true' }, stdio: 'pipe' });
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), f = path.join(outDir, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!f.startsWith(outDir) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const SITE = `http://127.0.0.1:${server.address().port}/index.html`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, density: 'moderate', time: 'day', weather: 'clear' })));
  const errors = [], calls = [];
  const cat = JSON.parse(readFileSync(path.join(ROOT, 'src/store/catalog.json'), 'utf8'));
  const founder = cat.find((s) => s.sku === 'founder-pack-2026');
  const db = { purchases: [], entitlements: [] };
  const reply = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  await ctx.route(`${MOCK}/**`, async (route) => {
    const r = route.request(), u = new URL(r.url()), auth = r.headers()['authorization'] ?? '';
    calls.push({ method: r.method(), path: u.pathname, search: u.search, auth, body: r.postData() });
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (u.pathname === '/auth/v1/otp') return reply(route, 200, {});
    if (u.pathname === '/auth/v1/user') return auth === 'Bearer at-1' ? reply(route, 200, { id: USER, email: EMAIL }) : reply(route, 401, { msg: 'bad token' });
    if (u.pathname === '/auth/v1/logout') return reply(route, 204, {});
    if (u.pathname === '/rest/v1/profiles') return reply(route, 201, {});
    if (u.pathname === '/rest/v1/purchases') return reply(route, 200, db.purchases.filter((p) => u.search.includes(encodeURIComponent(p.stripe_session_id)) || u.search.includes(p.stripe_session_id)));
    if (u.pathname === '/rest/v1/entitlements') return reply(route, 200, db.entitlements);
    if (u.pathname === '/functions/v1/create-checkout' && r.method() === 'GET') return reply(route, 200, { livemode: false, on_sale: cat.filter((s) => s.available).map((s) => s.sku) });
    if (u.pathname === '/functions/v1/create-checkout') {
      const b = JSON.parse(r.postData() || '{}');
      if (auth !== 'Bearer at-1') return reply(route, 401, { error: 'Sign in again to buy.' });
      if (b.sku === 'wheels-rossini-gt') return reply(route, 409, { error: 'Not on sale yet: it goes on sale once it is in the game.' });
      return reply(route, 200, { url: `https://checkout.stripe.com/c/pay/cs_test_mock${b.sku === founder.sku ? 'F' : 'X'}` });
    }
    return reply(route, 404, { error: 'not mocked: ' + u.pathname });
  });
  // Stripe's hosted page: "pay", let the webhook write the rows, and send the player back the way Stripe does
  await ctx.route('https://checkout.stripe.com/**', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    calls.push({ method: 'GET', path: 'stripe:' + id });
    const cancel = id.endsWith('X');
    if (!cancel) {
      db.purchases.push({ stripe_session_id: id, sku: founder.sku, amount_cents: founder.price_cents, currency: 'usd', status: 'paid', created_at: new Date().toISOString() });
      db.entitlements = founder.grants.map((g) => ({ entitlement: g, sku: founder.sku, granted_at: new Date().toISOString() }));
    }
    const back = cancel ? `${SITE}?checkout=cancel` : `${SITE}?checkout=success&session_id=${id}`;
    return route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>Stripe Checkout (mock)</title><p>Paying…</p><script>location.replace(${JSON.stringify(back)})</script>` });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const loaded = () => page.waitForFunction(() => window.__game?.net && !document.querySelector('.loadbar'), null, { timeout: BOOT_MS });
  const sheet = page.locator('.store-sheet .panel');
  try {
    await page.goto(SITE);
    await loaded();

    await check('live: the store says secure checkout and asks the server what is on sale', async () => {
      await page.getByRole('button', { name: 'Store', exact: true }).click();
      await page.waitForSelector('.store-panel');
      const banner = (await page.locator('.store-panel .store-mode').innerText()).replace(/\s+/g, ' ');
      expect(/secure checkout/i.test(banner) && !/4242/.test(banner), banner);
      const asked = () => calls.find((c) => c.path === '/functions/v1/create-checkout' && c.method === 'GET');
      for (let i = 0; i < 100 && !asked(); i++) await page.waitForTimeout(200);
      const got = asked();
      expect(got, 'no on-sale request');
      return `"${banner}"`;
    });

    await check('live: the sign-in link is requested from Supabase Auth and comes back to the game', async () => {
      await page.getByRole('button', { name: /^Buy Founder Pack/ }).click();
      await sheet.getByLabel('Month', { exact: true }).selectOption('3');
      await sheet.getByLabel('Year', { exact: true }).fill('1988');
      await sheet.getByRole('button', { name: 'Continue' }).click();
      await sheet.getByLabel('Email', { exact: true }).fill(EMAIL);
      await sheet.getByRole('button', { name: 'Send my sign-in link' }).click();
      await sheet.getByText(/Check your email/).waitFor();
      const otp = calls.find((c) => c.path === '/auth/v1/otp');
      const body = JSON.parse(otp.body), back = new URLSearchParams(otp.search).get('redirect_to');
      expect(body.email === EMAIL && body.create_user === true, otp.body);
      expect(back === `${SITE}?store=signin`, `redirect_to ${back}`);
      // the player taps the link: Supabase sends them back with the session in the fragment
      await page.goto(`${back}#access_token=at-1&refresh_token=rt-1&expires_in=3600&token_type=bearer&type=magiclink`);
      await loaded();
      await page.waitForSelector('.store-panel', { timeout: 120000 });
      const who = (await page.locator('.store-account').innerText()).replace(/\s+/g, ' ');
      const url = await page.evaluate(() => location.href);
      expect(who.includes(EMAIL) && !/test account/.test(who), `account: ${who}`);
      expect(!url.includes('access_token') && !url.includes('store=signin'), `the address still holds the session: ${url}`);
      return `redirect_to ${back.replace(SITE, '<site>')}; back signed in as ${EMAIL}; address cleaned`;
    });

    await check('live: checkout sends the token and the sku (no price), shows no card form, and goes to Stripe', async () => {
      await page.getByRole('button', { name: /^Buy Founder Pack/ }).click();
      expect(await sheet.getByLabel('Card number').count() === 0, 'a card form in live mode');
      await sheet.getByLabel(/18 or over/).check();
      await storeShot(page, 'store-live-checkout-1280.png');
      await Promise.all([page.waitForURL(/checkout=success/, { timeout: 120000 }), sheet.getByRole('button', { name: /^Checkout/ }).click()]);
      const prof = calls.find((c) => c.path === '/rest/v1/profiles');
      expect(prof && JSON.parse(prof.body).is_13_plus === true && prof.auth === 'Bearer at-1', `profile upsert: ${JSON.stringify(prof)}`);
      const co = calls.find((c) => c.path === '/functions/v1/create-checkout' && c.method === 'POST');
      const b = JSON.parse(co.body);
      expect(co.auth === 'Bearer at-1', `auth ${co.auth}`);
      expect(b.sku === founder.sku && b.adult_or_guardian === true, co.body);
      const priceKeys = Object.keys(b).filter((k) => /price|amount|cents|total/i.test(k));
      expect(!priceKeys.length, `the page sent ${priceKeys.join(', ')}`);
      expect(calls.some((c) => c.path === 'stripe:cs_test_mockF'), 'never reached Stripe');
      return `create-checkout body ${co.body}`;
    });

    await check('live: back from Stripe, the server confirms the purchase and the items arrive', async () => {
      await loaded();
      await page.waitForSelector('.store-panel .store-receipt', { timeout: 120000 });
      const r = (await page.locator('.store-panel .store-receipt').innerText()).replace(/\s+/g, ' ');
      expect(r.includes('$10.00') && /test mode/i.test(r) && r.includes('Founder Pack'), `receipt: ${r}`);
      await page.locator('.store-locker [data-paint="paint-founders-sunset"]').click();
      const paint = await page.evaluate(() => window.__game.car.config.paint);
      const url = await page.evaluate(() => location.href);
      expect(paint === 0xe8622c, `paint #${paint.toString(16)}`);
      expect(!/checkout=|session_id=/.test(url), `address not cleaned: ${url}`);
      const polled = calls.filter((c) => c.path === '/rest/v1/purchases').length;
      await storeShot(page, 'store-live-receipt-1280.png');
      return `receipt "${r.slice(0, 110)}"; ${polled} purchase read(s); Founders Sunset on the car`;
    });

    await check('live: a refused item shows the server\'s reason; a cancelled checkout says nothing was charged', async () => {
      // (the Founder Pack covers both paint packs, so they show as owned now)
      await page.getByRole('button', { name: /^Buy Rossini GT Wheel Set/ }).click();
      await sheet.getByLabel(/18 or over/).check();
      await sheet.getByRole('button', { name: /^Checkout/ }).click();
      const err = await sheet.locator('.store-err').innerText();
      expect(/goes on sale once it is in the game/.test(err), err);
      await sheet.getByRole('button', { name: 'Cancel' }).click();
      await Promise.all([page.waitForURL(/checkout=cancel/, { timeout: 120000 }), (async () => {
        await page.getByRole('button', { name: /^Buy Night Shift Driver Style/ }).click();
        await sheet.getByLabel(/18 or over/).check();
        await sheet.getByRole('button', { name: /^Checkout/ }).click();
      })()]);
      await loaded();
      await page.waitForSelector('.store-panel', { timeout: 120000 });
      const note = await page.locator('.store-panel .store-note').first().innerText();
      expect(/cancelled\. Nothing was charged/i.test(note), note);
      return `"${err}"; "${note.replace(/\s+/g, ' ').slice(0, 60)}"`;
    });

    await check('live: only the mock project and Stripe\'s page were contacted', () => {
      const hosts = [...new Set(calls.map((c) => (c.path.startsWith('stripe:') ? 'checkout.stripe.com' : 'mock-oc-ultra.supabase.co')))];
      return `${calls.length} mocked calls to ${hosts.join(', ')}; nothing real`;
    });
    await check('store-live: no page errors', () => { expect(errors.length === 0, errors.slice(0, 3).join(' | ')); });
  } finally {
    await ctx.close();
    server.close();
  }
});

// The venues (PROJECT_OC_ON_FOOT.md Phase 3a, PROJECT_OC_SPORTS_BAR.md J1): Lot 57 and Stoppage Time from the driving
// game. For each: Free Drive on the carriageway its default exit leaves, navigateTo the venue, Auto-drive (fastForward)
// down to the exit; arriving parks you (the toast says street driving isn't built yet); Get out mounts the venue's own
// page (window.__onfoot) over the paused game, with the venue's own Drive on offer where you stand; a short walk and
// one action; then Car walks you back and the venue's own Drive (tapped, not __game.drive()) puts you on an on-ramp at
// 0 mph with the venue gone. Then three Lot 57 round trips with the memory read after each, and the phone layout of Get out.
// The game's time is Sunset (7:30 PM on the game's clock), when both venues are open every day.
const VENUE_MS = 600000;   // a venue's build under SwiftShader on a shared machine (about 30-60 s idle)
async function heap(page) {
  return game(page, () => { if (typeof gc === 'function') { gc(); gc(); } const g = window.__game, m = g.renderer.info.memory;
    // sceneGeo: the distinct geometries in the game's scene graph (drawn or not); the renderer's count is those it has
    // drawn at least once and not had disposed, so it can only exceed sceneGeo by what other passes hold
    const seen = new Set(); g.scene.traverse((o) => { if (o.geometry) seen.add(o.geometry); });
    return { heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, geometries: m.geometries, sceneGeo: seen.size, textures: m.textures, programs: g.renderer.info.programs?.length ?? 0 }; });
}
// Free Drive on the carriageway the venue's default exit leaves, `before` metres ahead of it, then route there and
// let Auto-drive take it down to the exit (fastForward: the simulation without rendering)
async function autoDriveTo(page, venue, before = 2500) {
  return game(page, ({ venue, before }) => {
    const g = window.__game, ramp = g.net.paths[venue === 'Lot 57' ? 1142 : 124], j = ramp.inc[0];
    g.placeCar(j.to, Math.max(5, j.toS - before), 1, 28);
    const nav = g.navigateTo(venue), auto = g.setAutoDrive(true);
    const route = g.route.map((r) => r.to.id), dest = g.routeName;
    let t = 0, minV = 99;
    while (t < 400 && !g.venue()) { g.fastForward(1); t++; }
    return { nav, auto, route, dest, t, venue: g.venue(), autoOn: g.autoDriving, v: g.phys.vx, path: g.path.id, s: +g.phys.s.toFixed(1), toast: g.lastVenueToast };
  }, { venue, before });
}
async function getOut(page) {
  const t0 = Date.now();
  const ok = await page.evaluate(() => window.__game.getOut());
  const st = await page.evaluate(() => ({ venue: window.__game.venue(), ready: !!window.__onfoot?.ready, err: window.__onfootError ?? null, host: !!document.getElementById('onfoot-host'),
    gameHidden: getComputedStyle(window.__game.renderer.domElement.closest('.app')).display === 'none', frames0: window.__game.frames }));
  return { ok, s: (Date.now() - t0) / 1000, ...st };
}
async function driveBack(page) {
  const f0 = await game(page, () => window.__game.frames);
  const ok = await page.evaluate(() => window.__game.drive());
  await frames(page, 3);
  return { ok, ...(await backState(page, f0)) };
}
// the venue's own way back, as a player does it (not __game.drive()): where you stand, if Drive isn't on the action
// button, tap Car (it walks you to the driver's door; the walk is run ahead with the venue's sim), wait for the venue's
// HUD to put Drive on the action button, and tap it. `spot` is what was offered before (and how far from the door).
async function driveByButton(page, touch = false) {
  const press = (sel) => (touch ? page.tap(sel) : page.click(sel));
  const where = () => game(page, () => { const o = window.__onfoot, p = o.pos(), d = o.yourCar().door; return { actions: o.actions(), m: +Math.hypot(p.x - d.x, p.z - d.z).toFixed(2) }; });
  const spot = await where();
  let walk = null;
  if (spot.actions[0] !== 'Drive') {
    await press('#onfoot-host #car');
    await page.waitForFunction(() => window.__onfoot.pos().moving || window.__onfoot.actions()[0] === 'Drive', null, { timeout: VENUE_MS });
    await game(page, () => window.__onfoot.sim(90, true, true));
    walk = await where();
  }
  await page.waitForFunction(() => { const b = document.querySelector('#onfoot-host #act'); return b && b.classList.contains('on') && b.textContent === 'Drive' && getComputedStyle(b).visibility !== 'hidden'; }, null, { timeout: VENUE_MS });
  const btn = await game(page, () => { const b = document.querySelector('#onfoot-host #act').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; });
  const f0 = await game(page, () => window.__game.frames);
  await press('#onfoot-host #act');
  await page.waitForFunction(() => !window.__game.venue() && !window.__onfoot && !document.getElementById('onfoot-host'), null, { timeout: VENUE_MS });
  await frames(page, 3);
  return { ok: true, spot, walk, btn, ...(await backState(page, f0)) };
}
async function backState(page, f0) {
  return game(page, (f0) => { const g = window.__game, st = g.stats;
    return { venue: g.venue(), onfoot: !!window.__onfoot, host: !!document.getElementById('onfoot-host'), path: st.id, main: st.main, leads: g.net.leadsTo(g.path), s: +st.s.toFixed(1), mph: Math.round(Math.abs(st.v) * 2.236936), framesAfter: g.frames - f0,
      venueStyles: document.querySelectorAll('style[data-onfoot]').length, offSheets: [...document.querySelectorAll('style, link[rel=stylesheet]')].filter((x) => x.disabled).length,
      toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '), screen: !!document.querySelector('.tbar') }; }, f0);
}
await group('venues', async (use) => {
  const { page } = await use({ settings: { time: 'sunset' } });
  await drive(page, 'Free Drive');
  await check('venues: Lot 57 and Stoppage Time are places in the Go to sheet', async () => {
    await page.getByRole('button', { name: 'Go to', exact: true }).click();
    const places = await page.locator('.grid.places .gcell b').allTextContents();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    expect(places.join() === 'Lot 57,Stoppage Time', places.join());
    return places.join(', ');
  });
  const trips = [];
  for (const [venue, rampId] of [['Lot 57', 1142], ['Stoppage Time', 124]]) {
    const tag = venue === 'Lot 57' ? 'Lot 57' : 'Stoppage Time';
    let arrived = null;
    await check(`venues: ${tag}: navigateTo routes to its exit ramp, Auto-drive takes it there and the fade parks you`, async () => {
      const r = await autoDriveTo(page, venue);
      arrived = r;
      expect(r.nav && r.auto && r.dest === venue && r.route.at(-1) === rampId, `route ${JSON.stringify(r)}`);
      expect(r.venue && r.venue.phase === 'parked' && r.venue.name === venue && r.venue.ramp === rampId, `not parked: ${JSON.stringify(r)}`);
      expect(Math.abs(r.v) < 0.01 && !r.autoOn, `still moving or Auto-drive on: ${JSON.stringify(r)}`);
      expect(/^Drove .+ to .+ · street driving isn't built yet\. Auto-drive off: you have control$/.test(r.toast), r.toast);
      await page.waitForFunction(() => document.querySelector('.venue-park .getout') && [...document.querySelectorAll('.toast')].some((t) => /street driving isn't built yet/.test(t.textContent)), null, { timeout: 120000 });
      const ui = await game(page, () => ({ pedals: !!document.querySelector('.touch-pedals'), focus: document.activeElement?.textContent }));
      expect(ui.focus === 'Get out', `focus on ${ui.focus}`);
      return `${r.t} s of Auto-drive on ${r.route.length} hand-offs; parked on ramp ${r.venue.ramp} at ${r.s} m; "${r.toast}"`;
    });
    let out = null;
    await check(`venues: ${tag}: Get out pauses the game and mounts the venue (window.__onfoot ready, your car in the stall)`, async () => {
      expect(arrived?.venue, 'did not arrive');
      out = await getOut(page);
      expect(out.ok && out.ready && out.venue?.phase === 'foot' && out.host && out.gameHidden, JSON.stringify(out));
      const f = await game(page, () => window.__game.frames); await page.waitForTimeout(1500);
      const f2 = await game(page, () => window.__game.frames);
      const st = await game(page, () => { const o = window.__onfoot, s = o.stats(); return { frames: o.frames, quality: s.quality, npcs: s.npcs ?? null, car: o.yourCar(), pos: o.pos(), clock: o.clock(), actions: o.actions() }; });
      expect(f2 === f, `the game drew ${f2 - f} frames while on foot`);
      // where you stand when you get out, the venue's own Drive is on offer (the way back in)
      expect(st.actions[0] === 'Drive', `no Drive where you get out: ${JSON.stringify(st.actions)} at ${Math.hypot(st.pos.x - st.car.door.x, st.pos.z - st.car.door.z).toFixed(2)} m from the door`);
      expect(Math.hypot(st.pos.x - st.car.door.x, st.pos.z - st.car.door.z) < 6, `not by the car: ${JSON.stringify(st.pos)} door ${JSON.stringify(st.car.door)}`);
      trips.push({ venue, getOutS: out.s, quality: st.quality, npcs: st.npcs });
      return `ready in ${out.s.toFixed(1)} s; the game drew 0 frames on foot; ${st.quality}; ${st.npcs ?? 0} people; clock ${st.clock.label}; standing ${Math.hypot(st.pos.x - st.car.door.x, st.pos.z - st.car.door.z).toFixed(2)} m from the driver's door, Drive on offer`;
    });
    await check(`venues: ${tag}: a short walk and ${venue === 'Lot 57' ? 'an Order at the bar' : 'in through the front door'}`, async () => {
      expect(out?.ready, 'not on foot');
      if (venue === 'Lot 57') {
        const r = await game(page, () => { const o = window.__onfoot, c = o.counters().find((x) => x.id === 'bar'), p0 = o.pos();
          const tap = o.tap(c.stand.x, c.stand.z); o.sim(120, true, true); const p1 = o.pos(); o.look(90, -8);
          const press = o.press('Order'), sheet = o.sheet(), pick = o.pick('agua'); o.sim(1, false, true);
          return { walked: Math.hypot(p1.x - p0.x, p1.z - p0.z), tap: !!tap, press, sheetOpen: sheet.open, pick, state: o.state() }; });
        expect(r.tap && r.walked > 5 && r.press?.did && r.pick && r.state.order, JSON.stringify(r).slice(0, 400));
        return `walked ${r.walked.toFixed(1)} m (straight line) to the bar; Order opened the sheet; ordered an agua fresca (${r.state.order.stage})`;
      }
      // (tap to go to the point just inside the front door the bar's own page starts you at: the walk opens the door)
      const r = await game(page, () => { const o = window.__onfoot, p0 = o.pos(), d = o.startAt().door;
        const tap = o.tap(d.x, d.z); o.sim(60, true); const p1 = o.pos();
        return { walked: Math.hypot(p1.x - p0.x, p1.z - p0.z), tap: !!tap, end: p1, doors: o.doors() }; });
      expect(r.walked > 5 && r.end.indoors, JSON.stringify(r).slice(0, 400));
      return `walked ${r.walked.toFixed(1)} m to the front door and in (indoors: ${r.end.indoors})`;
    });
    await check(`venues: ${tag}: tap Car, then the venue's own Drive: back in the cockpit on an on-ramp at 0 mph, the venue gone`, async () => {
      expect(out?.ready, 'not on foot');
      const r = await driveByButton(page);
      expect(r.walk && r.walk.actions[0] === 'Drive', `Car's walk ended without Drive: ${JSON.stringify(r.walk)}`);
      expect(r.ok && !r.venue && !r.onfoot && !r.host && !r.main && /^(I|CA)-/.test(r.leads) && r.s < 10 && r.mph === 0, JSON.stringify(r));
      expect(r.venueStyles === 0 && r.offSheets === 0 && r.framesAfter >= 3 && r.screen, `styles or loop: ${JSON.stringify(r)}`);
      await page.screenshot({ path: path.join(OUT, `venues-${venue === 'Lot 57' ? 'lot57' : 'stoppage'}-back.png`) });
      return `Car walked you to ${r.walk.m} m from the door, Drive (${r.btn.w}x${r.btn.h}) tapped: on the ramp to ${r.leads} (path ${r.path}) at ${r.s} m, ${r.mph} mph; "${r.toast}"`;
    });
  }
  await check('venues: three Lot 57 round trips: no growth in the game renderer or the JS heap, no errors', async () => {
    const rows = [], base = await heap(page);
    for (let i = 0; i < 3; i++) {
      const a = await game(page, () => { const g = window.__game; g.placeCar(g.net.paths[1142], 290, 0, 0); return g.arriveVenue(); });
      expect(a, `trip ${i + 1}: no arrival`);
      await page.waitForTimeout(1500);
      const o = await getOut(page);
      expect(o.ok && o.ready, `trip ${i + 1}: ${JSON.stringify(o)}`);
      const v = await game(page, () => { const s = window.__onfoot.stats(); return { calls: s.calls, tris: s.triangles, textures: s.textures, geometries: s.geometries }; });
      const d = await driveByButton(page);
      expect(d.ok && !d.venue && !d.onfoot && d.spot.actions[0] === 'Drive', `trip ${i + 1} back: ${JSON.stringify(d)}`);
      // the roads, scenery and traffic round the on-ramp stream in over frames, slower the busier the machine: read the
      // game renderer once its geometry count has held still over two 20-frame stretches (at most 8)
      let last = -1, still = 0, rd = null;
      for (let k = 0; k < 8 && still < 2; k++) { await frames(page, 20); rd = await heap(page); still = rd.geometries === last ? still + 1 : 0; last = rd.geometries; }
      rows.push({ trip: i + 1, venue: v, game: rd });
    }
    const h = rows.map((r) => r.game.heapMB), g = rows.map((r) => r.game);
    // (the heap from trip 1 to trip 3. The game renderer's geometry count is a high-water mark of the scene's
    // geometries it has drawn: once, on some trip back, it steps up by about 185 (215 -> 405) as the return's first frames
    // draw scene objects not drawn before (as far as the probes show: the scene graph itself grew by 6), then holds flat over later trips;
    // which trip it lands on varies with the machine's load (2026-11-09 probes: the 2nd mount in one, never in four
    // others). So the geometry check is on the game's scene graph (no venue object left in it, nothing growing) and on
    // the renderer holding nothing the scene doesn't have; textures and programs as counted.)
    expect(h[2] !== null && h[2] - h[0] < 24, `heap ${base.heapMB} -> ${h.join(' -> ')} MB`);
    expect(g[2].sceneGeo - g[1].sceneGeo <= 16 && g.every((x) => x.geometries <= x.sceneGeo + 24) && g[2].textures - g[1].textures <= 4 && g[2].programs - g[1].programs <= 2, `game renderer ${JSON.stringify(g)}`);
    const left = await game(page, () => { let n = 0; window.__game.scene.traverse((o) => { if (/^(lot57|venue|onfoot|sportsbar|your-car)/i.test(o.name) || o.userData?.group === 'your-car') n++; }); return n; });
    expect(left === 0, `${left} venue objects left in the game's scene`);
    trips.push(...rows);
    return `heap ${base.heapMB} MB before, then ${h.join(', ')} MB after each trip; game renderer geometries ${g.map((x) => x.geometries).join('/')} (scene graph ${g.map((x) => x.sceneGeo).join('/')}), textures ${g.map((x) => x.textures).join('/')}, programs ${g.map((x) => x.programs).join('/')}; venue renderer at ready ${rows.map((r) => `${r.venue.geometries} geo ${r.venue.textures} tex`).join(', ')}`;
  });
  writeFileSync(path.join(OUT, 'venues-trips.json'), JSON.stringify(trips, null, 1));
});
// the phone, in a context of its own once the first has closed (booting a second game beside the first, still drawing,
// timed out twice at a load of about 20: both share the one software GPU process)
await group('venues', async (use) => {
  const { page } = await use({ phone: true, settings: { time: 'sunset', hudStyle: 'modern' } });
  await venuesPhone(page);
});
async function venuesPhone(page) {
  await drive(page, 'Free Drive');
  await check('venues phone: on the exit ramp the venue prompt shows; a tap parks you; Get out replaces the pedals (44 px or more, labelled, focusable)', async () => {
    await game(page, () => { const g = window.__game; g.placeCar(g.net.paths[1142], 120, 0, 8); });
    await page.waitForSelector('.venue-prompt', { timeout: 120000 });
    const pr = await game(page, () => { const b = document.querySelector('.venue-prompt').getBoundingClientRect(); return { w: b.width, h: b.height, label: document.querySelector('.venue-prompt').getAttribute('aria-label') }; });
    await page.tap('.venue-prompt');
    await page.waitForSelector('.venue-park .getout', { timeout: 120000 });
    await page.waitForTimeout(1500);
    const r = await game(page, () => {
      const b = document.querySelector('.venue-park .getout'), d = document.querySelector('.venue-park .driveon'), rb = b.getBoundingClientRect(), rd = d.getBoundingClientRect();
      return { getOut: { w: rb.width, h: rb.height, x: rb.x, y: rb.y, text: b.textContent, tab: b.tabIndex, focused: document.activeElement === b }, driveOn: { w: rd.width, h: rd.height, x: rd.x, y: rd.y },
        pedals: !!document.querySelector('.touch-pedals'), steer: !!document.querySelector('.touch-steer'), venue: window.__game.venue(), vw: innerWidth, vh: innerHeight };
    });
    await page.screenshot({ path: path.join(OUT, 'venues-phone-getout.png') });
    const inView = (b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= r.vw && b.y + b.h <= r.vh;
    expect(pr.w >= 44 && pr.h >= 44 && /Park at Lot 57/.test(pr.label), `prompt ${JSON.stringify(pr)}`);
    expect(r.venue?.phase === 'parked' && !r.pedals && !r.steer, JSON.stringify(r));
    expect(r.getOut.w >= 44 && r.getOut.h >= 44 && r.driveOn.h >= 44 && inView(r.getOut) && inView(r.driveOn) && r.getOut.text === 'Get out' && r.getOut.tab >= 0 && r.getOut.focused, JSON.stringify(r));
    return `prompt ${Math.round(pr.w)}x${Math.round(pr.h)} "${pr.label}"; Get out ${Math.round(r.getOut.w)}x${Math.round(r.getOut.h)} at (${Math.round(r.getOut.x)}, ${Math.round(r.getOut.y)}), focused; Drive on ${Math.round(r.driveOn.w)}x${Math.round(r.driveOn.h)}; no pedals`;
  });
  await check('venues phone: a tap on Drive on goes straight back to an on-ramp', async () => {
    const f0 = await game(page, () => window.__game.frames);
    await page.tap('.venue-park .driveon');
    await page.waitForFunction(() => !window.__game.venue(), null, { timeout: 120000 });
    await frames(page, 3);
    const r = { ok: true, ...(await backState(page, f0)) };
    expect(r.ok && !r.venue && !r.main && r.mph === 0, JSON.stringify(r));
    return `on the ramp to ${r.leads}`;
  });
}

await browser.close();

// ------------------------------------------------------------------------------------------- summary
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? '. Failed:\n' + failed.map((f) => `  ${f.name}: ${f.note}`).join('\n') : ''}`);
process.exit(failed.length ? 1 : 0);
