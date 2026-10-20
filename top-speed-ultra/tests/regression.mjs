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

// ------------------------------------------------------------------------------------------- the store (test mode)
// The paywall in TEST MODE (the build has no VITE_ store settings): the catalog on show with its prices, a declined
// test card, the Founder Pack bought with 4242, a reload, the paint on the car, the tip's floor, a subscription's
// terms, the run-card badge, the phone layout, and no request to Supabase or Stripe. Plus, in Node, the server's
// webhook signature check against known vectors and its Stripe form encoding.
const STORE_HOSTS = /(^|\.)(supabase\.(co|in|com)|stripe\.(com|network)|stripecdn\.com)$/i;
const storeMoney = (c) => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
const storePrice = (s) => (s.kind === 'tip' && s.custom_amount ? `From ${storeMoney(s.custom_amount.minimum_cents)}, pay what you want` : s.mode === 'subscription' ? `${storeMoney(s.price_cents)} a ${s.interval}` : storeMoney(s.price_cents));
const storeOnSale = (s) => s.available && (!s.window || Date.now() <= Date.parse(s.window.until));
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
  await page.screenshot({ path: path.join(OUT, name) });
}
async function storeCard(sheet, number) {
  await sheet.getByLabel('Card number', { exact: true }).fill(number);
  await sheet.getByLabel('Expiry', { exact: true }).fill('12/30');
  await sheet.getByLabel('CVC', { exact: true }).fill('123');
}

await group('store', async (use) => {
  const { page, requests } = await use({ size: [1440, 900] });
  const cat = JSON.parse(readFileSync(path.join(ROOT, 'src/store/catalog.json'), 'utf8'));
  const sale = cat.filter(storeOnSale), founder = cat.find((s) => s.sku === 'founder-pack-2026');
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
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.waitForSelector('.store-panel');
    const banner = (await page.locator('.store-panel .store-mode').innerText()).replace(/\s+/g, ' ');
    expect(/test mode/i.test(banner) && banner.includes('Nothing is charged. Use 4242 4242 4242 4242.'), `banner: ${banner}`);
    const shown = await page.$$eval('.store-panel [data-sku]', (els) => els.map((e) => ({ sku: e.getAttribute('data-sku'), price: e.querySelector('.store-price')?.textContent?.trim() })));
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
    const when = await page.locator('.store-founder-when').innerText();
    expect(/December 31, 2026/i.test(when), `Founder window: ${when}`);
    return `${shown.length} items with their prices (${sale.length} on sale; ${cat.length - sale.length} not offered); "${banner}"; Brio wheels: "${brio}"`;
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
    await drive(page, 'Free Drive');
    await game(page, () => { const g = window.__game; g.fastForward(6, {}, 30); g.cycleCam(); g.cycleCam(); });
    await frames(page, 6);
    await storeShot(page, 'store-founders-sunset-chase.png');
    await game(page, () => { const g = window.__game; g.fastForward(10, {}, 40); g.endFreeDrive(); });
    await page.waitForSelector('.result', { timeout: 30000 });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.getByRole('button', { name: 'Share run' }).click()]);
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

  await check('phone: the store and the checkout fit a 390 × 844 screen', async () => {
    await page.close();                      // the 1440 page's renders would starve this one's load in software rendering
    const ph = await open({ phone: true });
    try {
      const p = ph.page, sh = p.locator('.store-sheet .panel');
      const noSide = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.overlay')].every((o) => o.scrollWidth <= o.clientWidth + 1));
      await p.getByRole('button', { name: 'Store', exact: true }).click();
      await p.waitForSelector('.store-panel');
      await p.waitForTimeout(500);
      await storeShot(p, 'store-390.png');
      const a = await noSide();
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
      return 'store, checkout and receipt at 390 × 844 with no sideways scroll';
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

await browser.close();

// ------------------------------------------------------------------------------------------- summary
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? '. Failed:\n' + failed.map((f) => `  ${f.name}: ${f.note}`).join('\n') : ''}`);
process.exit(failed.length ? 1 : 0);
