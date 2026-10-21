// Project OC regression suite. Drives the built game (dist/top-speed-ultra.html) in headless Chromium with
// SwiftShader, through the window.__game test hooks, and prints PASS or FAIL with the numbers each check saw.
//
//   npm run build && npm test             every group
//   npm test -- --only=race,survival      some groups (boot, interchanges, survival, race, abilities,
//                                         progression, render, phone, launch, live, livephone)
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
async function open({ settings = {}, phone = false, size = [1280, 720], loadTimeout = 120000 } = {}) {
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
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: loadTimeout });
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
async function drive(page, label, timeout = 60000) {
  await page.getByRole('radio', { name: new RegExp(label) }).click();
  await page.getByRole('button', { name: 'Drive', exact: true }).click();
  await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout });
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
        clipped: [nav, dest].some((e) => !e.hidden && e.scrollWidth > e.clientWidth + 1) };
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
  // the adaptive HUD (U1): every style has a status row, a compass and a clock chip whose temperature says it's
  // simulated. Minimal tucks the top bar and the corner window away after 4 s of just driving, keeps Pause in reach as
  // a round chip, and a tap on the road brings the rest back.
  await check('HUD: compass and clock chip; Minimal tucks the bar away after 4 s, Pause stays, a tap brings it back', async () => {
    await page.keyboard.press('Escape');                                         // close Go to
    const row = await game(page, () => ({ h: Number(document.querySelector('.hud-tape')?.style.getPropertyValue('--h')), clock: document.querySelector('.hud-clock')?.textContent ?? '' }));
    // the drive starts on I-405 North through Irvine, which runs northwest
    expect(row.h > 270 && row.h < 340, `the compass reads ${row.h}° on I-405 North in Irvine`);
    expect(/\d+° · simulated/.test(row.clock), `the clock chip says "${row.clock}"`);
    // the Day preset is 12:30 on OC's clock: the chip agrees with the sky, not with this device
    expect(/12:30 PM/.test(row.clock), `the Day preset's clock chip says "${row.clock}"`);
    // Live weather with the real feed: the chip shows the observed temperature and names its source
    // (the setting first: with no server, turning it on loads the simulated day, which the reading then replaces)
    await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, weather: 'live' }); g.now.snapshot = { ...g.now.snapshot, weather: { source: 'NWS', updated: Date.now(), kind: 'cloudy', text: 'Cloudy', tempF: 61 } }; });
    await page.waitForFunction(() => /61° · NWS KSNA/.test(document.querySelector('.hud-clock')?.textContent || ''), null, { timeout: 30000 })
      .catch(async () => { throw new Error('the chip says ' + await page.locator('.hud-clock').innerText()); });
    await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, weather: 'clear' }); });
    await game(page, () => window.__game.setPaused(true));
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
  await check('a Lot 57 billboard stands on the 57 before the Orangewood exit, and is drawn', async () => {
    const bb = await game(page, (r) => { const g = window.__game; return g.billboards.children.filter((b) => b.userData.road === r).map((b) => ({ s: b.userData.s, creative: b.userData.creative, ahead: b.userData.s - g.phys.s })); }, road);
    expect(bb.length === 2, `${bb.length} billboards on ${road}`);
    const next = bb.filter((b) => b.ahead > 0).sort((a, b) => a.ahead - b.ahead)[0];
    expect(next, `none ahead: ${JSON.stringify(bb)}`);
    // drive to about 110 m short of it, brake to a stop (the car would keep rolling while frames render), and look
    // (braking only while moving: held at a standstill, the automatic gearbox takes the brake as reverse)
    await game(page, (d) => { const g = window.__game; while (g.phys.s < d - 110) g.fastForward(0.25, {}, 20); for (let i = 0; i < 40 && g.phys.vx > 0.3; i++) g.fastForward(0.1, { throttle: 0, brake: 1 }); Object.assign(g.input.c, { brake: 0 }); }, next.s);
    await game(page, () => window.__game.setCam('hood'));
    await frames(page, 3);
    await page.screenshot({ path: path.join(OUT, 'launch-billboard.png') });
    const s = await game(page, () => window.__game.phys.s);
    await game(page, () => { Object.assign(window.__game.input.c, { brake: 0 }); });
    expect(next.s - s > 40 && next.s - s < 160, `${fmt(next.s - s)} m short of the sign`);
    return `${next.creative} billboard ${fmt(next.ahead)} m ahead at the start; screenshot launch-billboard.png from ${fmt(next.s - s)} m`;
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
    for (const k of ['Chrome', 'GPU:', 'Low', 'fps', road, 'Live: off']) expect(text.includes(k), `the report lacks "${k}": ${text.slice(0, 160)}`);
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

// the live server (live/server.mjs): three signed-in browsers against a cap of two. The third waits in line and is
// let in when one leaves; the first sees the second's car on the road.
await group('live', async (use) => {
  const { spawn } = await import('node:child_process');
  const { rmSync } = await import('node:fs');
  const port = 21000 + Math.floor(Math.random() * 10000), base = `http://127.0.0.1:${port}`;
  const db = path.join(OUT, 'live-test.db');
  for (const f of [db, db + '-wal', db + '-shm']) rmSync(f, { force: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'live', 'server.mjs')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MAX_PLAYERS: '2', IP_MAX: '1000', SOCKETS_PER_IP: '50', DB_PATH: db, NOW_WEATHER: 'mock', NOW_TRAFFIC: 'mock', MAIL_MODE: 'log' }, stdio: ['ignore', 'pipe', 'inherit'] });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  await new Promise((resolve, reject) => { server.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) resolve(); }); server.on('exit', () => reject(new Error('the live server did not start'))); });
  const signup = async (name) => { const r = await fetch(base + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, password: 'correct horse battery', over13: true }) }); expect(r.ok, `sign-up ${r.status}`); return (await r.json()).token; };
  const extra = [];
  try {
    const tokens = { a: await signup('live_a'), b: await signup('live_b'), c: await signup('live_c') };
    const settings = { live: true, liveUrl: base, start: 'I-405 North', density: 'none' };
    const { page: A } = await use({ settings });
    const step = (m) => process.stderr.write(`    · ${m} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`), t0 = Date.now();
    // the second and third browsers open only when their checks need them: three software-rendered pages at once
    // starve each other here
    let B, C;
    const signIn = (page, t, name) => page.evaluate(([t, n]) => { localStorage.setItem('tsu.live.token', t); localStorage.setItem('tsu.live.name', n); }, [t, name]);
    const status = (page) => game(page, () => ({ ...window.__game.live?.info, peers: window.__game.stats.livePeers, drawn: window.__game.stats.liveDrawn }));
    const until = async (page, fn, what, timeout = 30000) => { await page.waitForFunction(fn, null, { timeout }).catch(() => { throw new Error(`timed out waiting for ${what}`); }); };
    await check('the menu shows the Live section with the account and the toggle; the account panel has the form', async () => {
      const sec = await A.locator('.live-sec').innerText();
      expect(/Not signed in/.test(sec) && /Drive live/.test(sec), sec.replace(/\s+/g, ' ').slice(0, 120));
      step('menu read');
      await A.locator('.pick', { hasText: 'Account' }).click();
      await A.waitForSelector('#live-name');
      step('account panel open');
      await A.screenshot({ path: path.join(OUT, 'live-account.png') });
      step('screenshot taken');
      const names = await A.locator('input').evaluateAll((els) => els.map((e) => e.id));
      expect(names.includes('live-name') && names.includes('live-pw') && names.includes('live-email'), names.join(','));
      await A.getByRole('button', { name: 'Back', exact: true }).click();
      return 'account panel: sign up form with name, password, email, age gate';
    });
    await check('the menu says how many are driving live right now', async () => {
      await A.waitForFunction(() => /\d+ of 2 driving now/.test(document.querySelector('.live-sec .sect')?.textContent || ''), null, { timeout: 30000 });
      return (await A.locator('.live-sec .sect').innerText()).replace(/\s+/g, ' ');
    });
    await check('signing up from the page itself works and the menu shows the name', async () => {
      await A.locator('.pick', { hasText: 'Account' }).click();
      await A.locator('#live-name').fill('live_ui');
      await A.locator('#live-pw').fill('a long enough password');
      await A.locator('label.check input').check();
      await A.getByRole('button', { name: 'Create account', exact: true }).click();
      await A.waitForSelector('.name-static', { timeout: 15000 });
      await A.getByRole('button', { name: 'Done', exact: true }).click();
      const sec = await A.locator('.live-sec').innerText();
      expect(/live_ui/.test(sec), sec.replace(/\s+/g, ' ').slice(0, 120));
      return 'signed up as live_ui from the panel';
    });
    await check('two drivers are online under the cap of 2, and each sees the other', async () => {
      await drive(A, 'Free Drive');
      await until(A, () => window.__game.live?.info.status === 'online', 'A online');
      step('A is driving live');
      B = await open({ settings }); extra.push(B);
      await signIn(B.page, tokens.b, 'live_b'); B = B.page;
      await drive(B, 'Free Drive');
      await until(B, () => window.__game.live?.info.status === 'online', 'B online');
      step('B is driving live');
      await until(A, () => window.__game.live?.info.online === 2 && window.__game.stats.livePeers === 1, 'A to see 2 online and 1 peer');
      // B's poses go out from its frame loop at 10 Hz; A draws B once a pose arrived
      await game(B, () => window.__game.fastForward(2, { throttle: 1 }));
      await frames(B, 3);
      await until(A, () => window.__game.stats.liveDrawn === 1, 'A to draw B\'s car', 60000);
      step('A draws B');
      const sa = await status(A), sb = await status(B);
      expect(sa.cap === 2 && sb.cap === 2 && sb.peers === 1, JSON.stringify({ sa, sb }));
      const chip = await A.locator('.livechip').innerText();
      expect(chip.toLowerCase() === 'live 2/2', `the chip says "${chip}"`);
      await game(A, () => window.__game.setCam('chase'));
      await frames(A, 2);
      await A.screenshot({ path: path.join(OUT, 'live-ghost.png') });
      const plates = await game(A, () => window.__game.stats.livePlates);
      expect(plates === 1, `${plates} name plates`);
      return `A: ${sa.online}/${sa.cap} online, ${sa.peers} peer, ${sa.drawn} drawn, ${plates} plate; chip "${chip}"`;
    });
    await check('the chip lists who is driving and where; Drive with puts A 80 m behind B on B\'s freeway', async () => {
      // B's road reaches A through the roster (every 2 s) or the live pose
      await A.waitForFunction(() => window.__game.liveRoad([...window.__game.live.peers.keys()][0]) !== '', null, { timeout: 30000 });
      await A.locator('.livechip').click();
      await A.waitForSelector('.livewho');
      const text = (await A.locator('.livewho').innerText()).replace(/\s+/g, ' ');
      await A.screenshot({ path: path.join(OUT, 'live-who.png') });
      expect(/live_ui you/i.test(text) && /live_b/i.test(text) && /Drive with/i.test(text), text);
      const bRoad = await game(B, () => window.__game.path.label);
      expect(text.includes(bRoad), `the list doesn't say B is on ${bRoad}: ${text}`);
      await A.getByRole('button', { name: 'Drive with', exact: true }).click();
      const r = await game(A, () => { const g = window.__game, id = [...g.live.peers.keys()][0], p = g.live.peers.get(id), at = g.live.whereIs(p, performance.now()); return { road: g.path.label, gap: Math.hypot(at.x - g.phys.x, at.z - g.phys.z) }; });
      expect(r.road === bRoad && r.gap > 50 && r.gap < 130, JSON.stringify(r));
      // B honks: A, 80 m behind, hears it
      const h0 = await game(A, () => window.__game.honks);
      await B.getByRole('button', { name: 'Honk (G)' }).click();
      await A.waitForFunction((n) => window.__game.honks > n, h0, { timeout: 20000 }).catch(() => { throw new Error('A never heard B honk'); });
      return `list: "${text.slice(0, 90)}"; A now on ${r.road}, ${fmt(r.gap)} m behind B; A heard B honk`;
    });
    await check('a third driver waits in line (#1) and is let in when one leaves; the counts follow', async () => {
      C = await open({ settings, loadTimeout: 400000 }); extra.push(C);
      await signIn(C.page, tokens.c, 'live_c'); C = C.page;
      await drive(C, 'Free Drive', 240000);
      step('C asked to drive');
      await until(C, () => window.__game.live?.info.status === 'queued' && window.__game.live.info.position === 1, 'C queued at #1');
      const chip = await C.locator('.livechip').innerText();
      expect(chip.toLowerCase() === 'in line #1', `the chip says "${chip}"`);
      const h1 = await (await fetch(base + '/health')).json();
      expect(h1.online === 2 && h1.queued === 1, JSON.stringify(h1));
      // B goes back to the main menu: its slot frees and C is let in
      await B.getByRole('button', { name: 'Pause', exact: true }).click();
      await B.getByRole('button', { name: 'Main menu', exact: true }).click();
      await until(C, () => window.__game.live?.info.status === 'online', 'C online after B left');
      await until(A, () => window.__game.live?.info.online === 2, 'A to still count 2 online');
      const h2 = await (await fetch(base + '/health')).json();
      expect(h2.online === 2 && h2.queued === 0 && h2.peak === 2, JSON.stringify(h2));
      const sb = await game(B, () => window.__game.live);
      expect(sb === null, 'B still holds a live client at the menu');
      return `C was #${1} in line, then online; server peak ${h2.peak}, admitted ${h2.admitted}, poses in ${h2.posesIn}, dropped ${h2.posesDropped}`;
    });
    await check('the server refuses a pose faster than any car and keeps the last good one', async () => {
      const h0 = await (await fetch(base + '/health')).json();
      // straight at the socket, past the client's own rounding: 1,118 mph and a NaN
      await game(A, () => { const ws = window.__game.live['ws']; ws.send(JSON.stringify({ t: 's', x: 0, y: 0, z: 0, h: 0, v: 500 })); ws.send(JSON.stringify({ t: 's', x: 'no', y: 0, z: 0, h: 0, v: 1 })); });
      await new Promise((r) => setTimeout(r, 300));
      const h1 = await (await fetch(base + '/health')).json();
      expect(h1.posesDropped - h0.posesDropped === 2, `${h1.posesDropped - h0.posesDropped} dropped`);
      return `2 bad poses dropped (${h1.posesDropped} in all)`;
    });
    await check('realistic mode: Live traffic and Live weather follow the server\'s feed, and the HUD says where it comes from', async () => {
      await game(A, () => { const g = window.__game; g.updateSettings({ ...g.settings, density: 'live', weather: 'live' }); });
      await until(A, () => window.__game.now.source === 'server' && window.__game.now.snapshot.traffic.source === 'mock', 'the feed from the server', 90000)
        .catch(async (e) => { const st = await game(A, () => { const n = window.__game.now; return { source: n.source, running: n.running, base: n.base, traffic: n.snapshot.traffic.source }; }); throw new Error(`${e.message}: ${JSON.stringify(st)}`); });
      // the traffic line lives on the destination card, which shows only with a route
      await game(A, () => { window.__game.navigateTo('CA-55 North'); window.__game.fastForward(3); });
      await frames(A, 3);
      const r = await game(A, () => { const g = window.__game; const road = g.path.main ? g.path.label : g.settings.start; return { road, ratio: g.now.ratioFor(road), level: g.traffic.level, weather: g.now.snapshot.weather, note: document.querySelector('.dest-traffic em')?.textContent, label: document.querySelector('.dest-traffic b')?.textContent, roads: Object.keys(g.now.snapshot.traffic.roads).length }; });
      expect(r.roads === 20, `${r.roads} roads in the feed`);
      expect(r.ratio > 0 && r.ratio <= 1 && r.level.perKmLane >= 1.2 && r.level.perKmLane <= 3.5 && r.level.bold === 0, JSON.stringify(r));
      // the density follows this road's ratio exactly (the mapping in src/live/now.ts), kept light while driving live
      // (lightForLive in src/game/settings.ts: 2.2 to 9.5 cars/km/lane becomes 1.2 to 3.5)
      const full = Math.round((r.ratio >= 0.95 ? 2.2 : r.ratio >= 0.8 ? 2.2 + ((0.95 - r.ratio) / 0.15) * 2.8 : r.ratio >= 0.6 ? 5 + ((0.8 - r.ratio) / 0.2) * 4 : r.ratio >= 0.45 ? 9 + ((0.6 - r.ratio) / 0.15) * 0.5 : 9.5) * 10) / 10;
      const want = 1.2 + Math.max(0, Math.min(1, (full - 2.2) / 7.3)) * 2.3;
      expect(Math.abs(r.level.perKmLane - Math.round(want * 10) / 10) < 0.11, `ratio ${r.ratio} should give ${want.toFixed(1)} cars/km/lane, got ${r.level.perKmLane}`);
      // the mock feed stands in for a real one on the server; the player is told it is simulated, and that it's kept light
      expect(/simulated/.test(r.note || '') && /light while live/.test(r.note || '') && /Live/.test(r.label || ''), `HUD says "${r.label} / ${r.note}"`);
      // a preset is capped at Light while live, and comes back when live is off
      const heavy = await game(A, () => { const g = window.__game, c = g.live; g.updateSettings({ ...g.settings, density: 'heavy' }); const on = { ...g.traffic.level }; g.setLive(null); const off = { ...g.traffic.level }; g.setLive(c); return { on, off, back: { ...g.traffic.level } }; });
      expect(heavy.on.perKmLane === 2.2 && heavy.on.bold === 0 && heavy.off.perKmLane === 9 && heavy.back.perKmLane === 2.2, JSON.stringify(heavy));
      expect(['clear', 'cloudy', 'rain', 'fog', 'mist'].includes(r.weather.kind), JSON.stringify(r.weather));
      await game(A, () => { const g = window.__game; g.navigateTo(null); g.updateSettings({ ...g.settings, density: 'moderate', weather: 'clear' }); });
      return `${r.road}: ratio ${r.ratio} → ${r.level.perKmLane} cars/km/lane, bold ${r.level.bold}; weather ${r.weather.kind} ${r.weather.tempF}°F (${r.weather.source}); HUD "${r.label} · ${r.note}"; Heavy while live ${heavy.on.perKmLane}, off ${heavy.off.perKmLane}`;
    });
    await check('the billboards stand on their freeways near the two venues (our own places only)', async () => {
      const b = await game(A, () => window.__game.billboards.children.map((g) => ({ road: g.userData.road, s: Math.round(g.userData.s), creative: g.userData.creative })));
      expect(b.length === 12, `${b.length} billboards placed of 12 slots`);
      const roads = new Set(b.map((x) => x.road));
      expect(roads.has('CA-57 North') && roads.has('I-5 South') && roads.has('CA-91 East') && roads.has('CA-22 West'), [...roads].join(', '));
      expect(b.every((x) => x.creative === 'lot57' || x.creative === 'dugout'), 'only our own creatives');
      return b.map((x) => `${x.road} @ ${(x.s / 1000).toFixed(1)} km ${x.creative}`).join('; ');
    });
    await check('the account panel changes the password and deletes the account, and the server agrees', async () => {
      await game(A, () => window.__game.setPaused(true));
      const line = (await A.locator('.live-line').innerText()).replace(/\s+/g, ' ');
      expect(/Live: \d+ of 2 driving/.test(line), `the pause screen says "${line}"`);
      // and where you stand on today's online board, from the server
      await A.waitForSelector('.board-line', { timeout: 20000 });
      const standing = (await A.locator('.board-line').innerText()).replace(/\s+/g, ' ');
      expect(/online board: #\d+ for distance \(\d/.test(standing), standing);
      await A.getByRole('button', { name: 'Main menu', exact: true }).click();
      await A.locator('.pick', { hasText: 'Account' }).click();
      await A.locator('summary', { hasText: 'Change password' }).click();
      await A.locator('#live-cur').fill('a long enough password');
      await A.locator('#live-new').fill('an even longer password');
      await A.getByRole('button', { name: 'Change password', exact: true }).click();
      await A.waitForFunction(() => !document.querySelector('.acct-more form button[disabled]'), null, { timeout: 15000 });
      const login = async (pw) => (await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'live_ui', password: pw }) })).status;
      expect(await login('an even longer password') === 200 && await login('a long enough password') === 401, 'the new password works and the old one doesn\'t');
      await A.locator('summary', { hasText: 'Delete account' }).click();
      await A.locator('#live-del').fill('an even longer password');
      await A.screenshot({ path: path.join(OUT, 'live-account-signed-in.png') });
      await A.getByRole('button', { name: 'Delete my account', exact: true }).click();
      await A.waitForSelector('#live-name', { timeout: 15000 });          // back to the sign-up form
      expect(await login('an even longer password') === 401, 'the account still logs in');
      return `pause: "${standing}"; password changed, then the account deleted; the panel is back to sign-up`;
    });
    await check('the online board: the menu opens it, and it lists what the server saw (the deleted account is gone)', async () => {
      await A.getByRole('button', { name: 'Back', exact: true }).first().click();          // the signed-out account panel
      const api = await (await fetch(base + '/api/board')).json();
      expect(api.distance.length >= 1, `nobody on the server's board: ${JSON.stringify(api)}`);
      expect(!api.distance.some((r) => r.name === 'live_ui'), 'the deleted account is still listed');
      await A.locator('.pick', { hasText: 'Online board' }).click();
      try {
        // the panel shows its loading bar until the first answer, never a false "nobody yet"
        await A.waitForSelector('.board ol li, .board .muted, .board .bad', { timeout: 30000 });
        const shown = await A.evaluate(() => [...document.querySelectorAll('.board ol li span')].map((e) => e.textContent));
        await A.screenshot({ path: path.join(OUT, 'live-online-board.png') });
        expect(api.distance.every((r) => shown.includes(r.name)) && shown.length >= 1, `panel ${JSON.stringify(shown)} vs server ${JSON.stringify(api.distance)}`);
      } finally {
        await A.getByRole('button', { name: 'Done', exact: true }).first().click();
        await A.locator('.pick', { hasText: 'Account' }).click();            // the next check starts on the account panel
      }
      return `distance today: ${api.distance.map((r) => `${r.name} ${r.value} m`).join(', ')}; top speed: ${api.speed.map((r) => `${r.name} ${r.value} m/s`).join(', ') || 'none held 3 s'}`;
    });
    await check('forgot password: the panel asks for a code, the emailed code sets a new password and signs in', async () => {
      await fetch(base + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'live_reset', password: 'the first password', email: 'reset@example.com', over13: true }) });
      await A.getByRole('button', { name: 'Log in', exact: true }).first().click();
      await A.getByRole('button', { name: 'Forgot password?', exact: true }).click();
      await A.locator('#live-rname').fill('live_reset');
      await A.getByRole('button', { name: 'Email me a code', exact: true }).click();
      await A.waitForSelector('#live-code', { timeout: 15000 });
      const code = [...serverLog.matchAll(/"ev":"mail".*?is (\d{6})\./g)].at(-1)?.[1];
      expect(/^\d{6}$/.test(code || ''), 'no code in the server log');
      await A.locator('#live-code').fill(code);
      await A.locator('#live-npw').fill('the second password');
      await A.screenshot({ path: path.join(OUT, 'live-reset.png') });
      await A.getByRole('button', { name: 'Set new password', exact: true }).click();
      await A.waitForSelector('.name-static', { timeout: 15000 });
      const who = await A.locator('.name-static').innerText();
      const login = (await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'live_reset', password: 'the second password' }) })).status;
      expect(who === 'live_reset' && login === 200, `${who}, log-in ${login}`);
      return `code ${code.replace(/\d/g, '•')} from the mail log; signed in as ${who}; the new password logs in`;
    });
  } finally {
    for (const h of extra) await h.ctx.close();
    server.kill('SIGTERM');
  }
});

// the live UI at phone size (390 × 844): the menu's Live section, the account panel, the top bar with the chip and the
// horn, and the who's-on list, with a scripted peer (a plain socket, no second browser) driving nearby
await group('livephone', async (use) => {
  const { spawn } = await import('node:child_process');
  const { rmSync } = await import('node:fs');
  const port = 31000 + Math.floor(Math.random() * 5000), base = `http://127.0.0.1:${port}`;
  const db = path.join(OUT, 'livephone-test.db');
  for (const f of [db, db + '-wal', db + '-shm']) rmSync(f, { force: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'live', 'server.mjs')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MAX_PLAYERS: '25', IP_MAX: '1000', SOCKETS_PER_IP: '50', DB_PATH: db }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => { server.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) resolve(); }); server.on('exit', () => reject(new Error('the live server did not start'))); });
  const signup = async (name) => (await (await fetch(base + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, password: 'correct horse battery', over13: true }) })).json()).token;
  let peer = null, ticker = null, me = null;
  try {
    const [tPhone, tPeer] = [await signup('phone_me'), await signup('Westbound_GT')];
    void tPhone;
    const { page } = await use({ phone: true, settings: { live: true, liveUrl: base, start: 'I-405 North', density: 'none' } });
    // log in through the panel (a reload would lose localStorage: Chromium's phone emulation drops a file:// page's
    // storage on reload, which a real phone loading the game over https doesn't)
    await page.locator('.pick', { hasText: 'Account' }).click();
    await page.getByRole('button', { name: 'Log in', exact: true }).first().click();
    await page.locator('#live-name').fill('phone_me');
    await page.locator('#live-pw').fill('correct horse battery');
    await page.locator('form button[type="submit"]').click();
    await page.waitForSelector('.name-static', { timeout: 30000 });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const fits = async (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; return els.every((e) => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }); }, sel);
    await check('phone: the Live section fits and shows the count', async () => {
      await page.locator('.live-sec').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => /driving now/.test(document.querySelector('.live-sec .sect')?.textContent || ''), null, { timeout: 40000 });
      await page.screenshot({ path: path.join(OUT, 'livephone-menu.png') });
      expect(await fits('.live-sec, .live-sec *'), 'something in the Live section runs off the screen');
      return (await page.locator('.live-sec .sect').innerText()).replace(/\s+/g, ' ');
    });
    await check('phone: the account panel fits', async () => {
      await page.locator('.pick', { hasText: 'Account' }).click();
      await page.waitForSelector('.name-static');
      await page.locator('summary', { hasText: 'Email for password reset' }).click();
      await page.screenshot({ path: path.join(OUT, 'livephone-account.png'), fullPage: false });
      expect(await fits('.panel input, .panel .btn, .acct-more'), 'the account panel runs off the screen');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      return 'signed in, the email setting open, nothing off screen';
    });
    await check('phone: the top bar holds the chip and the horn without crowding; the who\'s-on list fits', async () => {
      await drive(page, 'Free Drive');
      await page.waitForFunction(() => window.__game.live?.info.status === 'online', null, { timeout: 60000 });
      // the scripted peer: online, 60 m ahead on the same road, sending poses at 10 Hz
      me = await game(page, () => { const g = window.__game, p = g.path.at(g.phys.s + 60, g.path.laneCenter(1)); return { x: p.x, y: p.y, z: p.z, h: p.h }; });
      peer = new WebSocket(base.replace('http', 'ws') + '/ws');
      await new Promise((r) => peer.addEventListener('open', r));
      peer.send(JSON.stringify({ t: 'hello', token: tPeer, car: 'rossini-gt', paint: 0x1d4f9c }));
      ticker = setInterval(() => peer.send(JSON.stringify({ t: 's', x: me.x, y: me.y, z: me.z, h: me.h, v: 0 })), 100);
      await page.waitForFunction(() => window.__game.stats.liveDrawn === 1, null, { timeout: 60000 });
      await frames(page, 3);
      const bar = await page.evaluate(() => { const b = document.querySelector('.tbar').getBoundingClientRect(), kids = [...document.querySelectorAll('.tbar > *')].map((e) => e.getBoundingClientRect()), map = document.querySelector('.corner')?.getBoundingClientRect(); return { left: b.left, right: b.right, bottom: b.bottom, mapTop: map ? map.top : 9999, w: innerWidth, tall: kids.some((k) => k.height > 46), overlap: kids.some((a, i) => kids.some((c, j) => j > i && a.right > c.left + 1 && a.left < c.right - 1 && a.bottom > c.top && a.top < c.bottom)), n: kids.length }; });
      await page.screenshot({ path: path.join(OUT, 'livephone-drive.png') });
      expect(bar.left >= 0 && bar.right <= bar.w + 1 && !bar.overlap && !bar.tall && bar.bottom <= bar.mapTop + 1, JSON.stringify(bar));
      await page.locator('.livechip').click();
      await page.waitForSelector('.livewho');
      await page.screenshot({ path: path.join(OUT, 'livephone-who.png') });
      expect(await fits('.livewho, .livewho *'), 'the who\'s-on list runs off the screen');
      const text = (await page.locator('.livewho').innerText()).replace(/\s+/g, ' ');
      expect(/Westbound_GT/.test(text), text);
      return `top bar ${Math.round(bar.right - bar.left)} px of ${bar.w}, ${bar.n} items, no overlap; list "${text.slice(0, 80)}"`;
    });
    await check('phone: at night a ghost car shows its lamps, and its tail lamps brighten when that driver brakes', async () => {
      await page.locator('.livechip').click().catch(() => {});                       // close the who's-on list
      await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, time: 'night' }); g.setCam('chase'); });
      clearInterval(ticker);
      ticker = setInterval(() => peer.send(JSON.stringify({ t: 's', x: me.x, y: me.y, z: me.z, h: me.h, v: 0, b: 1 })), 100);
      await page.waitForFunction(() => window.__game.liveCars.tail.instanceColor.getX(0) > 3, null, { timeout: 30000 });
      // the sky eases into night: wait for the dark before the picture
      await page.waitForFunction(() => window.__game.env.daylight < 0.15, null, { timeout: 120000 });
      await frames(page, 3);
      await page.screenshot({ path: path.join(OUT, 'livephone-night-ghost.png') });
      const r = await game(page, () => { const lc = window.__game.liveCars; return { head: lc.head.count, tail: lc.tail.count, brake: lc.tail.instanceColor.getX(0) }; });
      expect(r.head === 1 && r.tail === 1 && r.brake > 3, JSON.stringify(r));
      await game(page, () => { const g = window.__game; g.updateSettings({ ...g.settings, time: 'day' }); g.setCam('cockpit'); });
      return `1 ghost with head and tail lamps; brake lamp ${r.brake}`;
    });
    await check('phone: a crew code hides drivers outside the crew, and the invite carries it', async () => {
      await game(page, () => window.__game.setPaused(true));
      await page.getByRole('button', { name: 'Main menu', exact: true }).click();
      await page.locator('#crew').fill('oc405');
      expect(await game(page, () => window.__game.settings?.crew ?? JSON.parse(localStorage.getItem('tsu.settings')).crew) === 'OC405', 'the crew setting');
      await drive(page, 'Free Drive');
      await page.waitForFunction(() => window.__game.live?.info.status === 'online', null, { timeout: 60000 });
      await page.waitForTimeout(2500);
      const seen = await game(page, () => ({ peers: window.__game.stats.livePeers, drawn: window.__game.stats.liveDrawn }));
      expect(seen.peers === 0 && seen.drawn === 0, `the peer outside the crew is still seen: ${JSON.stringify(seen)}`);
      await page.locator('.livechip').click();
      const head = (await page.locator('.livewho .eyebrow').innerText()).replace(/\s+/g, ' ');
      expect(/Crew OC405 · 1 here · 2 of 25 live/i.test(head), head);
      return `"${head}"; the outside peer is hidden`;
    });
    await check('phone: an invite link greets a first-time player once, and Sign up opens the account panel', async () => {
      // the first phone is still driving: pause it so this one gets the CPU
      await game(page, () => window.__game.setPaused(true));
      const { ctx: c2, page: p2 } = await open({ phone: true, settings: { liveUrl: base } });
      try {
        await p2.goto(pathToFileURL(GAME).href + '?crew=wxyz');
        await p2.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 120000 });
        // the first phone is still driving; bring this one forward so its frames (and Playwright's checks) run
        await p2.bringToFront();
        // poll from here: on this loaded machine the second phone's in-page waits (rAF or timers) stall even while
        // its page answers evaluate() at once
        const shown = async () => p2.evaluate(() => { const r = document.querySelector('.welcome')?.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0; });
        for (let t = Date.now(); !(await shown()); await new Promise((r) => setTimeout(r, 500))) {
          if (Date.now() - t > 30000) {
            const st = await p2.evaluate(() => ({ href: location.href, keys: Object.keys(localStorage), overlays: [...document.querySelectorAll('.overlay')].map((o) => o.className) }));
            throw new Error(`no welcome card: ${JSON.stringify(st)}`);
          }
        }
        const text = (await p2.locator('.welcome').innerText()).replace(/\s+/g, ' ');
        await p2.screenshot({ path: path.join(OUT, 'livephone-welcome.png') });
        expect(/invited to crew WXYZ/.test(text) && /No collisions|ghost|honk/.test(text), text.slice(0, 160));
        // the card sits on top of the menu: a tap on its button lands on the button, not on the menu under it
        const onTop = await p2.evaluate(() => { const b = [...document.querySelectorAll('.welcome button')].find((x) => /Sign up/.test(x.textContent)), r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b; });
        expect(onTop, 'the menu covers the welcome card');
        // tap it in the page (the check above proves a real tap lands on it)
        await p2.evaluate(() => [...document.querySelectorAll('.welcome button')].find((x) => /Sign up/.test(x.textContent)).click());
        for (let t = Date.now(); !(await p2.evaluate(() => !!document.querySelector('#live-name'))); await new Promise((r) => setTimeout(r, 500))) {
          if (Date.now() - t > 15000) throw new Error('Sign up did not open the account panel');
        }
        const crew = await p2.evaluate(() => JSON.parse(localStorage.getItem('tsu.settings')).crew);
        expect(crew === 'WXYZ' && !(await p2.locator('.welcome').count()), `crew ${crew}; the card still shows`);
        return `"${text.slice(0, 70)}…"; Sign up opened the panel; crew set to ${crew}`;
      } finally { await c2.close(); }
    });
  } finally {
    clearInterval(ticker); try { peer?.close(); } catch { /* gone */ }
    server.kill('SIGTERM');
  }
});

await browser.close();

// ------------------------------------------------------------------------------------------- summary
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? '. Failed:\n' + failed.map((f) => `  ${f.name}: ${f.note}`).join('\n') : ''}`);
process.exit(failed.length ? 1 : 0);
