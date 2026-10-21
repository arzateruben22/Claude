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
  // the OC Hypercar's lights and cockpit (PROJECT_OC_HYPERCAR.md M2). It has no CarDef until M3, so its body,
  // wheels and cockpit go on the player's car directly (the GT's physics), then back to the profile's car.
  await check('OC Hypercar: seat, beams from the blades, brake bar, turn signals, reversing lamps (M2)', async () => {
    const r = await game(page, () => {
      const g = window.__game, c = g.car, cfg = c.config;
      g.fastForward(3, {}, 30);
      c.configure({ ...cfg, car: 'oc-hyper', paint: 0xc8d3e8 });
      const ext = c.exterior, lamps = ['sigL', 'sigR', 'reverse'].map((k) => ext.getObjectByName(k));
      const out = { eye: c.eye.position.toArray(), beam: c.beams[1].position.toArray(), built: lamps.every(Boolean), hidden: lamps.every((m) => m && !m.visible) };
      c.update(0, 1, g.phys, true, g.time); out.brake = c.mats.tail.emissiveIntensity;
      c.update(0, 1, g.phys, false, g.time); out.free = c.mats.tail.emissiveIntensity;
      const d0 = g.phys.d;
      for (let k = 0; k < 40 && !out.lane; k++) {
        g.fastForward(0.05, { steer: k < 12 ? 0.22 : 0, throttle: 0.3, brake: 0 });
        c.update(0, 1, g.phys, false, g.time);
        const s = c.lightState;
        if (s.signal > 0 && s.blink) out.lane = { t: (k + 1) * 0.05, dd: g.phys.d - d0, R: lamps[1].visible, L: lamps[0].visible };
      }
      g.fastForward(5, { steer: 0, throttle: 0, brake: 1 }); g.fastForward(1.5, { steer: 0, throttle: 0, brake: 1 });
      c.update(0, 1, g.phys, false, g.time);
      out.rev = { gear: g.phys.gear, vx: g.phys.vx, on: lamps[2].visible };
      Object.assign(g.input.c, { throttle: 0, brake: 0, steer: 0 });
      out.gauge = !!c.interior.gaugeAt; out.rearView = !!c.interior.group.getObjectByName('rear-view-mirror');
      c.configure({ ...cfg });
      out.back = c.config.car; out.was = cfg.car;
      return out;
    });
    expect(r.built && r.hidden, `switched lamps built ${r.built}, hidden until lit ${r.hidden}`);
    expect(Math.abs(r.eye[0] + 0.27) < 0.005 && Math.abs(r.eye[1] - 0.96) < 0.005, `the hypercar's eye at ${r.eye.map(fmt)} (want -0.27, 0.96)`);
    expect(r.beam[2] < -2.2 && r.beam[1] < 0.5 && r.beam[0] > 0.3, `beam at ${r.beam.map(fmt)}: not from the blade`);
    expect(r.brake === 5 && r.free === 1.6, `red bar ${r.free} → ${r.brake} on the brakes`);
    expect(r.lane && r.lane.R && !r.lane.L, `lane change right: ${JSON.stringify(r.lane)}`);
    expect(r.rev.gear < 0 && r.rev.on, `reversing: ${JSON.stringify(r.rev)}`);
    expect(r.gauge && !r.rearView && r.back === r.was, `gauge pod ${r.gauge}, rear-view ${r.rearView}, back to ${r.back} (was ${r.was})`);
    return `eye ${r.eye.map(fmt)}, beam ${r.beam.map(fmt)}; bar ${r.free} → ${r.brake}; right signal lit ${fmt(r.lane.t)} s into a lane change (${fmt(r.lane.dd)} m); reverse lamps on in gear ${r.rev.gear}`;
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
