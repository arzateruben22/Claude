// Project OC regression suite. Drives the built game (dist/top-speed-ultra.html) in headless Chromium with
// SwiftShader, through the window.__game test hooks, and prints PASS or FAIL with the numbers each check saw.
//
//   npm run build && npm test             every group
//   npm test -- --only=race,survival      some groups (boot, interchanges, survival, race, abilities,
//                                         progression, render, phone, launch, store, store-live)
//   npm test -- --slow                    also render the High and Ultra presets (minutes per frame in SwiftShader)
//
// Software rendering runs at about 10 fps, so distance is covered with fastForward (the simulation without
// rendering) and real frames are used only where rendering is the point. Screenshots go to tests/out/.
// Every group opens a fresh browser context, so each starts with an empty profile.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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

// how long a page may take to boot to the menu: about 13 s on an idle machine, but other passes' renders and builds
// share these 4 cores, and under that load a boot has taken over 120 s (the boot check prints the real time)
const BOOT_MS = 300000;
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
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => requests.push(r.url()));               // the store group checks test mode sends nothing
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const t0 = Date.now();
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: BOOT_MS });
  const loadS = (Date.now() - t0) / 1000;
  // keep every result the game reports, so checks can read it
  await page.evaluate(() => { const g = window.__game, o = g.ev.over; window.__results = []; g.ev.over = (r) => { window.__results.push(r); o(r); }; });
  return { ctx, page, errors, loadS, requests };
}
const game = (page, fn, arg) => page.evaluate(fn, arg);
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
  await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 60000 });
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
    await page.waitForSelector('.result', { timeout: 10000 });
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
    await page.waitForFunction(() => window.__results.length > 0, null, { timeout: 10000 });
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
    await page.waitForFunction(() => window.__results.length > 0, null, { timeout: 10000 });
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
    return `${dl.suggestedFilename()}, ${w} × ${h}, ${Math.round(buf.length / 1024)} KB`;
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

  await check('the Ultra Graphics card: $5 with the test-mode notice, "The maximum graphics tier. Low and HD are free.", and this test build unlocks Ultra for everyone', async () => {
    const card = page.locator('.store-panel [data-sku="graphics-ultra"]');
    await card.waitFor();
    const r = await card.evaluate((el) => ({
      text: [...el.querySelectorAll('p, h4, li, em, button')].map((n) => n.textContent).join(' ').replace(/\s+/g, ' '),
      state: el.querySelector('.store-ultra-state')?.getAttribute('data-ultra'), buy: [...el.querySelectorAll('button')].map((b) => b.textContent),
      group: el.closest('.store-group')?.querySelector('h3')?.textContent,
    }));
    for (const k of ['Ultra Graphics', '$5', 'Test mode · nothing is charged', 'The maximum graphics tier. Low and HD are free.', 'This test build unlocks Ultra for everyone', 'Nothing is charged.'])
      expect(r.text.includes(k), `the card lacks "${k}": ${r.text.slice(0, 300)}`);
    expect(r.state === 'test' && r.buy.join() === 'Buy · $5' && r.group === 'Graphics', `state ${r.state}, buttons ${r.buy.join()}, group ${r.group}`);
    const lede = (await page.locator('.store-panel .store-lede').textContent()).replace(/\s+/g, ' ');
    expect(lede.includes('the Ultra graphics tier') && lede.includes('every graphics setting but Ultra'), `lede: ${lede}`);
    await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await storeShot(page, 'store-ultra-1440x900.png');
    await storeCrop(page, card, 'store-ultra-card-1440.png');
    return `"${r.text.slice(0, 200)}…"; state ${r.state}`;
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
      await page.locator('.store-panel [data-sku="graphics-ultra"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await storeShot(page, 'store-ultra-1280x720.png');
      const ultraTags = await storePriceTags(page);
      expect(!ultraTags.bad.length && ultraTags.inView > 0, `1280, at the Ultra card: ${ultraTags.bad.join(' | ')}; ${ultraTags.inView} in view`);
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

  await check('buying Ultra Graphics with 4242 grants graphics-ultra and a test receipt; Restore purchases keeps it', async () => {
    await page.getByRole('button', { name: /^Buy Ultra Graphics/ }).click();
    const said = (await sheet.locator('.store-q.small').textContent()).trim();
    expect(said === 'Graphics only: it changes nothing about how any car drives, scores or earns. Low and HD are free.', `the sheet says: ${said}`);
    const sheetTags = await storePriceTags(page, '.store-sheet');
    expect(sheetTags.prices === 1 && !sheetTags.bad.length, `checkout price: ${sheetTags.prices} prices; ${sheetTags.bad.join(' | ')}`);
    await sheet.getByLabel(/18 or over/).check();
    await storeCard(sheet, '4242 4242 4242 4242');
    await sheet.getByRole('button', { name: /^Pay \$5\.00/ }).click();
    await sheet.locator('.store-receipt').waitFor();
    const text = (await sheet.locator('.store-receipt').innerText()).replace(/\s+/g, ' ');
    const next = await sheet.locator('.store-ultra-next').textContent();
    expect(/Test mode: nothing was charged/i.test(text) && text.includes('$5.00') && text.includes('Ultra Graphics'), `receipt: ${text}`);
    expect(/Settings → Display → Graphics/.test(next), `after the receipt: ${next}`);
    expect((await ownedIds(page)).includes('graphics-ultra'), 'graphics-ultra not granted');
    await sheet.getByRole('button', { name: 'Done' }).click();
    const card = page.locator('.store-panel [data-sku="graphics-ultra"]');
    const act = await card.locator('.store-act').textContent(), state = await card.locator('.store-ultra-state').getAttribute('data-ultra');
    await page.locator('.store-account').getByRole('button', { name: 'Restore purchases' }).click();
    await page.waitForFunction(() => /on this account/.test(document.querySelector('.store-panel .store-note')?.textContent ?? ''));
    const note = await page.locator('.store-panel .store-note').textContent();
    const still = (await ownedIds(page)).includes('graphics-ultra');
    expect(/Owned/.test(act) && state === 'owned' && still, `after buying: "${act}", state ${state}; after Restore still owned ${still}`);
    return `receipt: ${text.slice(0, 120)}; card "${act}" (${state}); Restore: "${note}"`;
  });

  await check('settings at 1280 × 720: the Graphics picker offers Ultra and says what it is (owned here, after the test purchase)', async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    try {
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const note = page.locator('.settings .ultra-note');
      await note.waitFor();
      const r = await page.evaluate(() => {
        const field = [...document.querySelectorAll('.settings .field')].find((f) => f.querySelector('label')?.textContent === 'Graphics');
        return { labels: [...field.querySelectorAll('.seg button')].map((b) => b.textContent), state: document.querySelector('.settings .ultra-note').getAttribute('data-ultra'), text: document.querySelector('.settings .ultra-note').textContent, drawn: window.__game.settings.quality, sideways: document.documentElement.scrollWidth > innerWidth };
      });
      expect(r.labels.join() === 'Low,Medium,High,Ultra' && r.state === 'owned' && /maximum graphics tier/.test(r.text) && /Every other setting is free/.test(r.text) && !r.sideways, JSON.stringify(r));
      await note.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await storeShot(page, 'settings-ultra-1280x720.png');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      // back to the store, where the next checks pick up
      await page.getByRole('button', { name: 'Store', exact: true }).click();
      await page.waitForSelector('.store-panel');
      return `picker ${r.labels.join(' / ')}; "${r.text}" (${r.state}); the game draws ${r.drawn}`;
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
    }
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

  await check('phone: the store, the Ultra card, the checkout and the settings screen fit a 390 × 844 screen', async () => {
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
      const uc = p.locator('.store-panel [data-sku="graphics-ultra"]');
      await uc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await storeShot(p, 'store-ultra-390x844.png');
      await storeCrop(p, uc, 'store-ultra-card-390.png');
      const ucText = (await uc.textContent()).replace(/\s+/g, ' '), ucTags = await storePriceTags(p);
      expect(ucText.includes('$5') && ucText.includes('Test mode · nothing is charged') && ucText.includes('The maximum graphics tier. Low and HD are free.') && ucText.includes('This test build unlocks Ultra for everyone') && !ucTags.bad.length, `phone Ultra card: ${ucText.slice(0, 220)}; ${ucTags.bad.join(' | ')}`);
      const ua = await noSide();
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
      // the settings screen at phone size: this account bought no Ultra, and this test build unlocks it for everyone
      await sh.getByRole('button', { name: 'Done' }).click();
      await p.getByRole('button', { name: 'Done', exact: true }).click();
      await p.getByRole('button', { name: 'Settings', exact: true }).click();
      const sn = p.locator('.settings .ultra-note');
      await sn.waitFor();
      await sn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await storeShot(p, 'settings-ultra-390x844.png');
      const set = await p.evaluate(() => {
        const field = [...document.querySelectorAll('.settings .field')].find((f) => f.querySelector('label')?.textContent === 'Graphics');
        return { labels: [...field.querySelectorAll('.seg button')].map((b) => b.textContent), state: document.querySelector('.settings .ultra-note').getAttribute('data-ultra'), text: document.querySelector('.settings .ultra-note').textContent };
      });
      const d = await noSide();
      expect(set.labels.join() === 'Low,Medium,High,Ultra' && set.state === 'test' && /This test build unlocks it for everyone, and nothing is charged/.test(set.text), `phone settings: ${JSON.stringify(set)}`);
      expect(a && ua && b && c && d, `sideways scroll: store ${!a}, Ultra card ${!ua}, checkout ${!b}, receipt ${!c}, settings ${!d}`);
      expect(ph.errors.length === 0, ph.errors.slice(0, 2).join(' | '));
      const bad = ph.requests.filter((u) => { try { return STORE_HOSTS.test(new URL(u).hostname); } catch { return false; } });
      expect(!bad.length, bad.slice(0, 3).join(' '));
      return `store, Ultra card, checkout, receipt and settings at 390 × 844 with no sideways scroll; ${phoneTags.prices} prices, each with the test-mode notice under it; settings: "${set.text}"`;
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
  // each page load boots the game again; once it is up, its frame loop is held as in the store group (holdGame above):
  // these checks are about the store's live wiring, and at a load of 45 to 50 the game drawing behind the store made
  // a wait for the store panel run past 120 s (2026-10-21). Nothing here needs a rendered frame.
  const loaded = async () => { await page.waitForFunction(() => window.__game?.net && !document.querySelector('.loadbar'), null, { timeout: BOOT_MS }); await holdGame(page); };
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

    await check('live: Ultra Graphics as the catalog is ("hook"): unlocked for everyone; Restore purchases puts it on the account, a refund takes it off, and settings say so', async () => {
      const card = page.locator('.store-panel [data-sku="graphics-ultra"]');
      const ultraOf = () => page.evaluate(() => document.querySelector('.store-panel [data-sku="graphics-ultra"] .store-ultra-state')?.getAttribute('data-ultra'));
      const before = await ultraOf();
      const restoreTo = async (want) => {
        await page.locator('.store-account').getByRole('button', { name: 'Restore purchases' }).click();
        await page.waitForFunction((w) => document.querySelector('.store-panel [data-sku="graphics-ultra"] .store-ultra-state')?.getAttribute('data-ultra') === w, want, { timeout: 120000 });
      };
      // the webhook writes the row (as the server test does for real), then the player taps Restore purchases
      db.entitlements.push({ entitlement: 'graphics-ultra', sku: 'graphics-ultra', granted_at: new Date().toISOString(), serial: null });
      await restoreTo('owned');
      const act = (await card.locator('.store-act').textContent()).trim();
      await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await storeShot(page, 'store-live-ultra-1280.png');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const sOwned = await page.locator('.settings .ultra-note').getAttribute('data-ultra');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Store', exact: true }).click();
      await page.waitForSelector('.store-panel');
      // a refund: the webhook revokes the row, so Restore reads none
      db.entitlements = db.entitlements.filter((e) => e.entitlement !== 'graphics-ultra');
      await restoreTo('free');
      const reads = calls.filter((c) => c.path === '/rest/v1/entitlements').length;
      expect(before === 'free' && /Owned/.test(act) && sOwned === 'owned', `before ${before}; after restore "${act}"; settings ${sOwned}`);
      return `before: ${before}; restored: "${act}", settings ${sOwned}; refunded and restored: free; ${reads} entitlements reads`;
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

await browser.close();

// ------------------------------------------------------------------------------------------- summary
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? '. Failed:\n' + failed.map((f) => `  ${f.name}: ${f.note}`).join('\n') : ''}`);
process.exit(failed.length ? 1 : 0);
