// Project OC regression suite. Drives the built game (dist/top-speed-ultra.html) in headless Chromium with
// SwiftShader, through the window.__game test hooks, and prints PASS or FAIL with the numbers each check saw.
//
//   npm run build && npm test             every group
//   npm test -- --only=race,survival      some groups (boot, interchanges, survival, race, abilities,
//                                         progression, render, phone, launch)
//   npm test -- --slow                    also render the High and Ultra presets (minutes per frame in SwiftShader)
//
// Software rendering runs at about 10 fps, so distance is covered with fastForward (the simulation without
// rendering) and real frames are used only where rendering is the point. Screenshots go to tests/out/.
// Every group opens a fresh browser context, so each starts with an empty profile.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GAME = process.env.GAME_HTML ? path.resolve(process.env.GAME_HTML) : path.join(ROOT, 'dist', 'top-speed-ultra.html');   // GAME_HTML: test another build
const OUT = path.join(ROOT, 'tests', 'out');
const MPH = 2.236936;
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const slow = process.argv.includes('--slow');

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
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

// a fresh context (empty storage) with these settings saved, loaded to the main menu
async function open({ settings = {}, phone = false, size = [1280, 720] } = {}) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: size[0], height: size[1] } });
  const base = { quality: 'low', adaptive: false, density: 'moderate', time: 'day', weather: 'clear' };
  await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { ...base, ...settings });
  const page = await ctx.newPage();
  // software rendering shares the CPU with other renders and builds here: a click or a screenshot can wait a while
  // for a frame, so actions get two minutes instead of Playwright's 30 s (a check still fails on what it asserts)
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const t0 = Date.now();
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 120000 });
  const loadS = (Date.now() - t0) / 1000;
  // keep every result the game reports, so checks can read it
  await page.evaluate(() => { const g = window.__game, o = g.ev.over; window.__results = []; g.ev.over = (r) => { window.__results.push(r); o(r); }; });
  return { ctx, page, errors, loadS };
}
const game = (page, fn, arg) => page.evaluate(fn, arg);
// wait for this many rendered frames
async function frames(page, n, timeout = 60000) {
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
  window.__toasts = window.__toasts ?? [];
  if (!window.__toastsOn) { const o = g.ev.toast; g.ev.toast = (m, k) => { window.__toasts.push(m); o(m, k); }; window.__toastsOn = true; }
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
    const r = await game(page, () => { const g = window.__game; g.fastForward(45, {}, 52); return { score: g.score, streak: g.streak, best: g.bestStreak, passes: g.overtakes, near: g.nearMisses, over: g.over, top: g.top }; });
    expect(!r.over, 'the run ended');
    expect(r.score > 0 && r.best > 5, `score ${fmt(r.score)}, best streak ${fmt(r.best)} s`);
    return `score ${Math.round(r.score)}, best streak ${fmt(r.best)} s, ${r.passes} clean passes, ${r.near} near misses, top ${Math.round(r.top * MPH)} mph`;
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
      const lane = g.path.laneOf(p.d);
      g.traffic.clearAround(p.x, p.z, 200);
      const car = g.traffic.addRacer(g.path, p.s + 28, lane, 'Stopped', 0x777777, 0, 0, p.s);    // held at 0 m/s
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
      const g = window.__game, cls = g.traffic.classes.map((c) => ({ id: c.id, len: +c.len.toFixed(1), wid: +c.wid.toFixed(2), wheels: c.wheels.length, trim: !!c.trim, tris: (c.body.index ? c.body.index.count : c.body.attributes.position.count) / 3 }));
      g.setPaused(true); g.traffic.reseed(7); g.traffic.fill(g.view());
      const semis = g.traffic.cars.filter((c) => g.traffic.classes[c.cls].id === 'semi');
      const lanes = semis.map((c) => [c.lane, c.path.lanes]), right = lanes.filter(([l, n]) => l >= n - 2).length;
      return { cls, cars: g.traffic.cars.length, semis: semis.length, right, lanes };
    });
    const semi = r.cls.find((c) => c.id === 'semi');
    expect(r.cls.length === 7, `${r.cls.length} classes, not 7`);
    expect(semi && semi.len === 20 && semi.wheels === 10 && semi.trim, `semi class: ${JSON.stringify(semi)}`);
    expect(r.cls.every((c) => c.tris > 400), 'a class has fewer than 400 triangles: ' + r.cls.map((c) => c.id + ':' + c.tris).join(' '));
    expect(r.semis >= 2, `only ${r.semis} semis in ${r.cars} cars`);
    expect(r.right === r.semis, `${r.semis - r.right} of ${r.semis} semis spawned outside the two right lanes: ${JSON.stringify(r.lanes)}`);
    return `${r.cls.length} classes, semi ${semi.len} m × ${semi.wid} m with ${semi.wheels} wheels; ${r.semis} of ${r.cars} cars are semis, all in the two right lanes`;
  });
  await check('time trial traffic is the same every time', async () => {
    const snap = () => game(page, async () => {
      const g = window.__game, cars = () => JSON.stringify(g.traffic.cars.map((c) => [c.id, c.path.id, Math.round(c.s * 10), Math.round(c.d * 10)]));
      Object.assign(g.input.c, { throttle: 0, brake: 0, steer: 0 });      // the same hands on the controls each time
      await g.start('time'); g.setPaused(true);
      const filled = cars();
      // frames may have eaten some of the countdown while it loaded; run out the rest one step at a time
      while (g.countdown > 0) g.fastForward(1 / 120);
      g.apLane = 1;                              // the autopilot's lane carries over between runs
      g.fastForward(8, {}, 40);
      return { filled, driven: cars() };
    });
    const a = await snap(), b = await snap();
    expect(a.filled === b.filled, 'the starting traffic differed');
    expect(a.driven === b.driven, 'the traffic diverged over 8 s');
    return `${JSON.parse(a.filled).length} cars at the start and ${JSON.parse(a.driven).length} after 8 s, identical`;
  });
});

await group('race', async (use) => {
  const { page } = await use({ settings: { course: 'irvine', density: 'moderate' } });
  // hands off or flat on the gas, the grid holds; holding the brake there must not back the car up
  for (const throttle of [0, 1]) {
    await check(`the countdown holds you and every rival (gas ${throttle ? 'flat' : 'off'})`, async () => {
      const r = await game(page, async (thr) => {
        const g = window.__game;
        Object.assign(g.input.c, { throttle: 0, brake: 0, steer: 0 });
        await g.start('race'); g.setPaused(true);
        const left = g.countdown, x0 = g.phys.x, z0 = g.phys.z;
        let worst = 0;
        while (g.countdown > 0.05) { g.fastForward(1 / 120, { throttle: thr, brake: 0, steer: 0 }); worst = Math.max(worst, Math.abs(g.phys.vx)); }
        return { left, worst, moved: Math.hypot(g.phys.x - x0, g.phys.z - z0), gear: g.phys.gear, rivals: g.race.racers.map((c) => c.v) };
      }, throttle);
      expect(r.left > 1, `only ${fmt(r.left)} s of countdown left to test`);
      expect(r.worst < 0.5 && r.moved < 0.5 && r.gear > 0, `you: up to ${fmt(r.worst)} m/s, moved ${fmt(r.moved)} m, gear ${r.gear}`);
      expect(r.rivals.every((v) => v === 0), `rivals ${r.rivals.map(fmt)}`);
      return `${fmt(r.left)} s: you at most ${fmt(r.worst)} m/s, moved ${fmt(r.moved)} m, in gear ${r.gear}; rivals ${r.rivals.join(', ')} m/s`;
    });
  }
  // the standings: the gap column has to read in the same order as the positions (every gap is estimated at your
  // speed), and the race timer lives in the race box, not on the road plate over the horizon
  await check('race standings: gaps fall in position order, the timer sits in the race box', async () => {
    const r = await game(page, async () => {
      const g = window.__game;
      await g.start('race'); g.setPaused(true);
      while (g.countdown > 0) g.fastForward(0.5, { throttle: 0, brake: 0, steer: 0 }, 0);
      // slow for 20 s so the rivals lead, then fast for 30 s to pass them: rows ahead and behind, at mixed speeds
      let bad = null, ahead = 0, behind = 0;
      for (let t = 0; t < 50; t++) {
        g.fastForward(1, {}, t < 20 ? 28 : 80);
        const st = g.race.standings;
        for (let k = 1; k < st.length; k++) if (st[k].gap > st[k - 1].gap + 1e-9) bad ??= { t, rows: st.map((s) => `P${s.pos} ${s.name} ${s.gap.toFixed(1)}`).join(', ') };
        ahead += st.filter((s) => s.gap > 0).length; behind += st.filter((s) => s.gap < 0).length;
      }
      return { bad, ahead, behind, last: g.race.standings.map((s) => `P${s.pos} ${s.name} ${s.you ? '' : s.gap.toFixed(1)}`.trim()).join(', ') };
    });
    expect(!r.bad, `gaps out of order at ${r.bad?.t} s: ${r.bad?.rows}`);
    expect(r.ahead > 0 && r.behind > 0, `only rows ${r.ahead ? 'ahead' : 'behind'} were sampled`);
    await frames(page, 2);
    const dom = await game(page, () => ({
      inBox: document.querySelector('.hud-race .hud-timer em')?.textContent ?? null,
      onPlate: !!document.querySelector('.hud-road .hud-timer'),
      gaps: [...document.querySelectorAll('.hud-standings li:not([hidden]) b')].map((b) => b.textContent),
    }));
    expect(/^\d+:\d\d\.\d$/.test(dom.inBox ?? '') && !dom.onPlate, `timer in the race box "${dom.inBox}", on the road plate ${dom.onPlate}`);
    const shown = dom.gaps.map((s) => (s === '' ? 0 : s === 'FIN' ? Infinity : Number(s.replace('−', '-'))));
    expect(shown.every((v, k) => k === 0 || v <= shown[k - 1]), `the HUD gap column reads ${dom.gaps.join(' / ')}`);
    return `${r.ahead} rows ahead and ${r.behind} behind over 50 s, all in order; now ${r.last}; HUD timer ${dom.inBox}, gaps ${dom.gaps.map((s) => s || 'you').join(' / ')}`;
  });
  await check('flat out, the autopilot wins the Irvine Sprint', async () => {
    const credits0 = await game(page, () => window.__game.profile.p.credits);
    const r = await game(page, async () => {
      const g = window.__game; let t = 0;
      await g.start('race'); g.setPaused(true);
      while (!g.over && t < 400) { g.fastForward(1, {}, 120); t++; }
      return { over: g.over, t, order: g.race?.order, pos: g.race?.position };
    });
    expect(r.over, `not finished after ${r.t} s`);
    await page.waitForFunction(() => window.__results.length > 0, null, { timeout: 900000, polling: 500 });
    const res = await game(page, () => window.__results.at(-1));
    const p = await game(page, () => window.__game.profile.p);
    expect(res.race.position === 1, `finished P${res.race.position}: ${res.reason}`);
    expect(p.racesWon === 1 && p.credits - credits0 >= 1500, `racesWon ${p.racesWon}, credits +${fmt(p.credits - credits0)}`);
    return `P1 in ${res.race.time}, order ${res.race.order.join(' > ')}, +${Math.round(p.credits - credits0)} credits`;
  });
  await check('racing slowly ends "Too far behind" in last place', async () => {
    const r = await game(page, async () => {
      const g = window.__game;
      window.__results.length = 0;
      await g.start('race'); g.setPaused(true);
      let t = 0;
      while (!g.over && t < 400) { g.fastForward(1, {}, 18); t++; }
      return { over: g.over, t };
    });
    expect(r.over, `not over after ${r.t} s`);
    await page.waitForFunction(() => window.__results.length > 0, null, { timeout: 900000, polling: 500 });
    const res = await game(page, () => window.__results.at(-1));
    expect(res.reason === 'Too far behind' && res.race.position === 4, `${res.reason}, P${res.race.position}`);
    return `"${res.reason}" at P${res.race.position} after ${r.t} s`;
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
    await page.waitForFunction(() => { const b = document.querySelector('.hud-thrustbtn'); return b && !b.hidden && document.querySelector('.hud-tune')?.textContent; }, null, { timeout: 900000, polling: 500 });
    const dom = await game(page, () => ({ btn: !document.querySelector('.hud-thrustbtn').hidden, panel: !document.querySelector('.hud-thrust').hidden, chip: document.querySelector('.hud-tune').textContent, aria: document.querySelector('.hud-thrustbtn').getAttribute('aria-label') }));
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
          if (res !== 'ok') { T.collide = orig; refused++; continue; }
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
    return `parked sedan (roof ${parked.roof} m): apex ${parked.apex} m, passed, 0 hits; semi (roof ${semi.roof} m, closing ${semi.closing} m/s, seed ${semi.seed}, ${semi.cars} cars): peak ${semi.peak} m, ${semi.air} s up, ${semi.over} steps over it with ${semi.clear} m to spare, 0 contacts, same road`;
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
  await check('the dash pressure gauge redraws at most 10 times a second, and not at all outside the seat view', async () => {
    const r = await game(page, () => {
      const g = window.__game, car = g.car;
      // two seconds at 60 frames a second with the tank draining from 100 % to 50 % under thrust (a new 5-bar step
      // almost every frame), seen from the seat, then the same two seconds from the chase camera
      const d0 = car.gaugeDraws;
      for (let i = 0; i < 120; i++) car.setThrustGauge(true, 1 - (0.5 * i) / 120, 1, false, false, true, 1 / 60);
      const seat = car.gaugeDraws - d0, d1 = car.gaugeDraws;
      for (let i = 0; i < 120; i++) car.setThrustGauge(true, 0.5 - (0.5 * i) / 120, 1, false, false, false, 1 / 60);
      return { seat, chase: car.gaugeDraws - d1 };
    });
    expect(r.seat >= 15 && r.seat <= 21 && r.chase === 0, JSON.stringify(r));
    return `2 s of draining tank: ${r.seat} redraws from the seat, ${r.chase} from the chase camera`;
  });
  await check('no THRUST in a race, the time trial or Speed Survival: the race tune, no button, and holding it changes nothing', async () => {
    const out = [];
    for (const mode of ['race', 'time', 'survival']) {
      const r = await hyperIn(page, mode);
      await page.waitForFunction(() => document.querySelector('.hud-tune')?.textContent === 'Race tune', null, { timeout: 900000, polling: 500 });
      // held through the countdown (where there is one) and 3 s of driving: no force, no tank change, no hop
      const run = await game(page, () => {
        const g = window.__game, p = g.phys;
        let fx = 0, thrust = 0, steps = 0;
        const t0 = g.countdown;
        for (let t = 0; t < t0 + 3; t += 1 / 120) { g.autopilot(g.input.c, 60); Object.assign(g.input.c, { throttle: 1, thrust: 1 }); g.simulate(1 / 120); fx = Math.max(fx, Math.abs(p.ext.fx), Math.abs(p.ext.fz)); thrust = Math.max(thrust, g.hyper.thrust); steps++; }
        g.setPaused(false); const hop = g.thrustHop(); g.setPaused(true);
        return { countdown: +t0.toFixed(2), fx, thrust, tank: g.hyper.tank, hop, air: p.airborne, steps };
      });
      // the real key, with frames running: nothing reaches the controls
      await game(page, () => window.__game.setPaused(false));
      await page.keyboard.down('ShiftLeft'); await frames(page, 4, 900000);
      const key = await game(page, () => { const g = window.__game; const k = { c: g.input.c.thrust, fx: g.phys.ext.fx, jets: g.jets.live }; g.setPaused(true); return k; });
      await page.keyboard.up('ShiftLeft');
      const dom = await game(page, () => ({ btn: !document.querySelector('.hud-thrustbtn').hidden, panel: !document.querySelector('.hud-thrust').hidden, chip: document.querySelector('.hud-tune').textContent }));
      expect(!r.live && !r.keys && r.car === 'oc-hyper' && r.grip === 1.04, `${mode}: ${JSON.stringify(r)}`);
      expect(run.fx === 0 && run.thrust === 0 && run.tank === 1 && run.hop === 'off' && !run.air && key.c === 0 && key.fx === 0 && key.jets === 0, `${mode}: ${JSON.stringify(run)} key ${JSON.stringify(key)}`);
      expect(!dom.btn && !dom.panel, `${mode}: THRUST on screen ${JSON.stringify(dom)}`);
      out.push(`${mode}: race tune (grip ${r.grip}), chip "${dom.chip}", no button${run.countdown ? `, ${run.countdown} s countdown` : ''}, THRUST held: 0 N, no jets`);
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
  await check('Live time follows the real sun over OC', async () => {
    await page.clock.setFixedTime(new Date('2026-10-12T09:13:00Z'));        // 02:13 Pacific
    const night = await sky('live', 'clear');
    await page.clock.setFixedTime(new Date('2026-10-12T20:00:00Z'));        // 13:00 Pacific
    const noon = (await sky('live', 'clear')).day;
    expect(night.day === 0 && noon > 0.9, `02:13 → ${fmt(night.day)}, 13:00 → ${fmt(noon)}`);
    await sky('day', 'clear');
    return `02:13 Pacific: daylight ${fmt(night.day)}; 13:00: ${fmt(noon)}`;
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
        return { ...g.stats, post: !!g.composer, live, crown };
      }, q);
      crownHigh ||= s.crown;
      expect(s.crown > 0 && s.crown <= 448 && (q === 'low') === (s.crown < crownHigh), `${q}: palm crowns of ${s.crown} triangles (High ${crownHigh})`);
      expect(s.roads > 0 && s.tiles > 0, `${q}: ${s.roads} road chunks, ${s.tiles} tiles`);
      expect(s.post === (q !== 'low'), `${q}: post-processing ${s.post ? 'on' : 'off'}`);
      expect(s.live === (q !== 'low'), `${q}: live mirrors ${s.live ? 'on' : 'off'}`);
      if (slow || q === 'low') await frames(page, 3, 400000);
      if (slow && q !== 'low') await shot(`quality-${q}`);
      out.push(`${q}: ${s.roads} chunks, ${s.tiles} tiles, post ${s.post ? 'on' : 'off'}, mirrors ${s.live ? 'live' : 'env'}, palm crowns ${s.crown} triangles${slow || q === 'low' ? `, 3 frames in ${((Date.now() - t0) / 1000).toFixed(0)} s` : ''}`);
    }
    return out.join('; ');
  });
});

await group('phone', async (use) => {
  const { page } = await use({ phone: true });
  const noSideScroll = () => game(page, () => document.documentElement.scrollWidth <= innerWidth);
  await check('menu fits a 390 × 844 phone', async () => {
    await page.screenshot({ path: path.join(OUT, 'phone-menu.png') });
    expect(await noSideScroll(), 'the page scrolls sideways');
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
  await check('driving HUD: top bar clear of the gear readout, touch controls shown', async () => {
    await drive(page, 'Free Drive');
    await frames(page, 10);
    await page.screenshot({ path: path.join(OUT, 'phone-driving.png') });
    const r = await game(page, () => {
      const box = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { gear: box('.hud-gear'), tbar: box('.tbar'), steer: box('.touch-steer'), gas: box('.pedal.gas'), w: innerWidth };
    });
    expect(r.gear && r.tbar && r.steer && r.gas, `missing: ${Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
    const overlap = !(r.gear.r <= r.tbar.l || r.tbar.r <= r.gear.l || r.gear.b <= r.tbar.t || r.tbar.b <= r.gear.t);
    expect(!overlap, `gear ${JSON.stringify(r.gear)} under top bar ${JSON.stringify(r.tbar)}`);
    expect(r.tbar.r <= r.w + 0.5 && (await noSideScroll()), 'the top bar runs off the screen');
  });
  await check('Go to lists all twenty carriageways', async () => {
    await page.getByRole('button', { name: 'Go to' }).click();
    const n = await page.locator('.grid.nav .gcell').count();
    await page.screenshot({ path: path.join(OUT, 'phone-goto.png') });
    expect(n === 20, `${n} listed`);
    return `${n} listed`;
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
});

// the local-launch features: start at your own exit, and the run card you can share
await group('launch', async (use) => {
  const { page } = await use({ settings: { start: 'I-405 North' } });
  const road = 'CA-57 North';
  let want = null;
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
});

await browser.close();

// ------------------------------------------------------------------------------------------- summary
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? '. Failed:\n' + failed.map((f) => `  ${f.name}: ${f.note}`).join('\n') : ''}`);
process.exit(failed.length ? 1 : 0);
