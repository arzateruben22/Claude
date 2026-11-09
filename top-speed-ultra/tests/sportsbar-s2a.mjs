// Phase S2a checks for the sports bar's page (PROJECT_OC_SPORTS_BAR.md, "### S2a: needs, objects, ordering and the
// screens"). Drives dist/sportsbar/sportsbar.html (build it with `npx vite build --config
// src/onfoot/vite.sportsbar.config.ts`) in headless Chromium with SwiftShader through window.__onfoot and prints PASS or
// FAIL with the numbers each check saw. Screenshots go in tests/out/sportsbar/; results are merged into
// tests/out/sportsbar/sportsbar-s2a-checks.json after every check.
//
//   node tests/sportsbar-s2a.mjs                         every group
//   node tests/sportsbar-s2a.mjs --only=checks,save      some groups: checks, save, shots, budgets
//   node tests/sportsbar-s2a.mjs --tag=r2                a suffix for every screenshot's name
//
// One browser at a time (this machine is shared by ten workflows). Frames here take seconds: be patient.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = path.join(ROOT, 'dist', 'sportsbar', 'sportsbar.html');
const OUT = path.join(ROOT, 'tests', 'out', 'sportsbar');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const TAG = (process.argv.find((a) => a.startsWith('--tag=')) ?? '--tag=').slice(6);
const PRESETS = (process.argv.find((a) => a.startsWith('--presets=')) ?? '--presets=low,high,ultra').slice(10).split(',');
const png = (base) => (TAG ? `${base}-${TAG}.png` : `${base}.png`);
const want = (g) => !only.length || only.includes(g);
if (!existsSync(PAGE)) { console.error(`No build at ${PAGE}.`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const results = [], summary = {};
const CHECKS = path.join(OUT, 'sportsbar-s2a-checks.json');
function save() {
  let old = { results: [], summary: {} };
  try { old = JSON.parse(readFileSync(CHECKS, 'utf8')); } catch { /* first run */ }
  const byName = new Map((old.results ?? []).map((r) => [r.name, r]));
  for (const r of results) byName.set(r.name, r);
  writeFileSync(CHECKS, JSON.stringify({ when: new Date().toISOString(), results: [...byName.values()], summary: { ...(old.summary ?? {}), ...summary } }, null, 1));
}
async function check(name, fn) {
  const t0 = Date.now();
  try { const note = (await fn()) ?? ''; results.push({ name, ok: true, note, when: new Date().toISOString() }); console.log(`  PASS  ${name}  ${note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
  catch (e) { results.push({ name, ok: false, note: e.message, when: new Date().toISOString() }); console.log(`  FAIL  ${name}  ${e.message}`); }
  save();
}
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };
const T = 2400000;
let browser = null;
async function open(size, query, touch = false, init = null, ctxIn = null) {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = ctxIn ?? await browser.newContext(touch ? { viewport: { width: size[0], height: size[1] }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);
  if (init) await page.addInitScript(init);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const t0 = Date.now();
  await page.goto(pathToFileURL(PAGE).href + '?' + query);
  await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
  const err = await page.evaluate(() => window.__onfootError ?? null);
  if (err) errors.push('boot: ' + err);
  return { ctx, page, errors, bootS: Math.round((Date.now() - t0) / 1000) };
}
const closeAll = async () => { await browser?.close().catch(() => {}); browser = null; };
const frames = async (page, n = 2) => { const f0 = await page.evaluate(() => window.__onfoot.frames); await page.waitForFunction((k) => window.__onfoot.frames >= k, f0 + n, { timeout: T, polling: 200 }); };
async function shot(page, name) { await frames(page, 2); await page.screenshot({ path: path.join(OUT, name), timeout: 900000 }); return name; }
const H = (page, js) => page.evaluate(js);
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
const near = (a, b, t) => Math.abs(a - b) <= t;
const drawnInit = () => {
  window.__drawn = [];
  for (const k of ['fillText', 'strokeText']) { const f = CanvasRenderingContext2D.prototype[k]; CanvasRenderingContext2D.prototype[k] = function (t, ...a) { if (window.__drawn.length < 200000) window.__drawn.push(String(t)); return f.call(this, t, ...a); }; }
};
// a place to stand inside, clear of every object: between the pool tables and the high-tops (frame 18.6, 10.6)
const STAND = `(() => { const o = window.__onfoot, f = o.frame(); return [f.O[0] + 18.6 * f.A[0] + 10.6 * f.B[0], f.O[1] + 18.6 * f.A[1] + 10.6 * f.B[1]]; })()`;
const goStand = async (page) => { const [x, z] = await H(page, STAND); return H(page, `window.__onfoot.go(${x}, ${z})`); };
const AVG = { hunger: 67.5, thirst: 62.5, fun: 60, social: 55, energy: 75 };

// ------------------------------------------------------------------------------------------------ the checks
if (want('checks')) {
  console.log('checks: 1280x720, Low, Saturday 21:00, week 43');
  const { ctx, page, errors, bootS } = await open([1280, 720], 'quality=low&day=Sat&hour=21&hint=0', false, drawnInit);
  await check('checks: boots with no console errors (the merged Lot 57 HUD ids are on the page)', async () => { expect(!errors.length, errors.join(' | ')); return `boot ${bootS} s`; });
  await H(page, 'window.__onfoot.setWeek(43)');
  await check('needs decay at the table\'s rates: 10 sim minutes standing, every need within 1 of the formula, at outgoing 0, 0.5 and 1', async () => {
    const out = [];
    for (const outgoing of [0, 0.5, 1]) {
      await goStand(page);
      await H(page, `(() => { const o = window.__onfoot; o.setTraits({ outgoing: ${outgoing} }); o.clearMoodlets(); return o.setNeeds({ hunger: 70, thirst: 70, fun: 70, social: 70, energy: 70 }); })()`);
      const n = await H(page, 'window.__onfoot.fastForward(10)');
      const w = { hunger: 62, thirst: 54, fun: 58, social: 70 - 10 * (0.6 + 0.8 * outgoing), energy: 66 };
      const bad = Object.keys(w).filter((k) => !near(n[k], w[k], 1));
      out.push(`outgoing ${outgoing}: ` + Object.keys(w).map((k) => `${k} ${n[k].toFixed(2)}/${w[k].toFixed(1)}`).join(' '));
      expect(!bad.length, `outgoing ${outgoing}: ${bad.map((k) => `${k} ${n[k]} vs ${w[k]}`).join(', ')} (doing ${JSON.stringify(n.doing)})`);
    }
    await H(page, 'window.__onfoot.setTraits({ outgoing: 0.5 })');
    summary.decay = out; return out.join('; ');
  });
  await check('mood follows its formula: full needs and no moodlets read 80 (Happy); the seeded average reads within 1 of 20 + 0.6 x the weighted average', async () => {
    await H(page, `(() => { const o = window.__onfoot; o.clearMoodlets(); o.setNeeds({ hunger: 100, thirst: 100, fun: 100, social: 100, energy: 100 }); })()`);
    const a = await H(page, 'window.__onfoot.mood()');
    await H(page, `window.__onfoot.setNeeds(${JSON.stringify(AVG)})`);
    const b = await H(page, 'window.__onfoot.mood()');
    expect(near(a.mood, 80, 1e-6) && a.label === 'Happy', JSON.stringify(a));
    expect(near(b.mood, 20 + 0.6 * b.average, 1) && b.label === 'Fine', JSON.stringify(b));
    return `full: ${a.mood} ${a.label}; seeded average: ${b.mood} (${b.label}) vs 20 + 0.6 x ${b.average} = ${(20 + 0.6 * b.average).toFixed(2)}`;
  });
  await check('the jukebox and the water station: Pick a song gives fun +6, Get water thirst +20 (less the walk\'s decay)', async () => {
    await goStand(page);
    await H(page, `window.__onfoot.setNeeds({ fun: 40, thirst: 40 })`);
    const u = await H(page, `window.__onfoot.use('jukebox', 'song')`);
    const n0 = await H(page, 'window.__onfoot.needs()');
    const n1 = await H(page, 'window.__onfoot.fastForward(1.5)');
    const log1 = await H(page, 'window.__onfoot.lifeLog(10)');
    const w = await H(page, `window.__onfoot.use('water', 'water')`);
    const n2 = await H(page, 'window.__onfoot.fastForward(1.5)');
    const log2 = await H(page, 'window.__onfoot.lifeLog(10)');
    const df = n1.fun - n0.fun, dt = n2.thirst - n1.thirst;
    expect(u.ok && log1.some((l) => l.what === 'song done'), `song: ${JSON.stringify(u)} ${JSON.stringify(log1)}`);
    expect(w.ok && log2.some((l) => l.what === 'water done'), `water: ${JSON.stringify(w)} ${JSON.stringify(log2)}`);
    expect(df >= 6 - 1.2 * 1.5 - 0.05 && df <= 6.05, `fun ${df.toFixed(2)}`);
    expect(dt >= 20 - 1.6 * 1.5 - 0.05 && dt <= 20.05, `thirst ${dt.toFixed(2)}`);
    return `fun ${n0.fun.toFixed(1)} -> ${n1.fun.toFixed(1)} (+${df.toFixed(2)} over 1.5 min with the walk); thirst ${n1.thirst.toFixed(1)} -> ${n2.thirst.toFixed(1)} (+${dt.toFixed(2)})`;
  });
  await check('Dance is offered only during gameNight: not Friday 20:24 or Thursday 21:00; offered Friday 20:26, Saturday 21:00 and Saturday 01:59 (Friday\'s game night)', async () => {
    const cases = [['Fri', 20 + 24 / 60, false], ['Thu', 21, false], ['Fri', 20 + 26 / 60, true], ['Sat', 21, true], ['Sat', 1 + 59 / 60, true]];
    const out = [];
    for (const [d, h, wanted] of cases) {
      const r = await H(page, `(() => { const o = window.__onfoot; o.setClock('${d}', ${h}); return { offers: o.offers('screen-big').map((x) => x.action), gn: o.tv().gameNight, open: o.clock().open }; })()`);
      const has = r.offers.includes('dance-spot:dance');
      out.push(`${d} ${h.toFixed(3)}: ${has ? 'offered' : 'not offered'} (gameNight ${r.gn})`);
      expect(has === wanted && r.gn === wanted, `${d} ${h}: ${JSON.stringify(r)}`);
    }
    // and you dance (the player only, in S2a)
    await H(page, `window.__onfoot.setClock('Sat', 21)`);
    const u = await H(page, `window.__onfoot.use('dance-spot', 'dance')`);
    const n = await H(page, 'window.__onfoot.fastForward(1)');
    expect(u.ok && n.doing.fun === 'dance', `dance: ${JSON.stringify(u)} ${JSON.stringify(n.doing)}`);
    const q = await H(page, 'window.__onfoot.queue()'); for (const a of q) await H(page, `window.__onfoot.cancelAction(${a.id})`);
    return out.join('; ') + `; at Saturday 21:00 you dance (${JSON.stringify(n.doing)})`;
  });
  await check('watching raises fun, by x1.6 only while the featured match is in play on the watched screen', async () => {
    const run = async (h, label) => {
      await H(page, `window.__onfoot.setClock('Sat', ${h})`);
      await goStand(page);
      const u = await H(page, `window.__onfoot.use('screen-big', 'watch')`);
      await H(page, 'window.__onfoot.fastForward(0.5)');
      await H(page, `(() => { const o = window.__onfoot; o.clearMoodlets(); o.setNeeds({ fun: 30 }); })()`);
      const n0 = await H(page, 'window.__onfoot.needs()'), n1 = await H(page, 'window.__onfoot.fastForward(2)'), tv = await H(page, 'window.__onfoot.tv()');
      const q = await H(page, 'window.__onfoot.queue()'); for (const a of q) await H(page, `window.__onfoot.cancelAction(${a.id})`);
      return { label, u, d: n1.fun - n0.fun, match: n1.doing.match, fun: n1.doing.fun, big: tv.big, featured: tv.featured?.state };
    };
    const a = await run(20 + 5 / 60, 'Saturday 20:05, the featured match in play');
    const b = await run(21 + 5 / 60, 'Saturday 21:05, the 21:00 match (not featured)');
    const c = await run(20 + 27 / 60, 'Saturday 20:27, between matches (highlights)');
    summary.watching = [a, b, c];
    expect(a.u.ok && a.fun === 'watch' && a.match === 1.6 && near(a.d, 2 * 2.5 * 1.6, 0.4), JSON.stringify(a));
    expect(b.u.ok && b.fun === 'watch' && b.match === 1 && near(b.d, 2 * 2.5, 0.4), JSON.stringify(b));
    expect(c.u.ok && c.match === 1 && c.big === 3 && near(c.d, 2 * 2.5, 0.4), JSON.stringify(c));
    return [a, b, c].map((r) => `${r.label}: fun +${r.d.toFixed(2)} in 2 min (x${r.match}, big screen channel ${r.big})`).join('; ');
  });
  await check('order a drink at the bar: you walk to the counter, wait while the bartender makes it, hold it, and sips raise thirst', async () => {
    await H(page, `window.__onfoot.setClock('Sat', 21)`);
    await goStand(page);
    const names0 = await H(page, 'window.__onfoot.meshNames()');
    const u = await H(page, `window.__onfoot.use('bar', 'order-drink', 'tamarindo')`);
    const seen = new Set(); let held = null, steps = 0, staffSeen = [];
    for (; steps < 16 && !held; steps++) {
      await H(page, 'window.__onfoot.fastForward(0.1)');
      for (const o of await H(page, 'window.__onfoot.orders()')) seen.add(o.stage);
      staffSeen.push((await H(page, 'window.__onfoot.staff()'))[0]);
      held = (await H(page, 'window.__onfoot.held()')).drink;
    }
    const pos = await H(page, 'window.__onfoot.pos()');
    expect(u.ok && held && held.id === 'tamarindo', `order ${JSON.stringify(u)}; held ${JSON.stringify(held)}; stages ${[...seen]}`);
    expect(seen.has('making'), `no wait seen: ${[...seen]}`);
    await H(page, `window.__onfoot.setNeeds({ thirst: 40 })`);
    const t0 = (await H(page, 'window.__onfoot.needs()')).thirst, n = await H(page, 'window.__onfoot.fastForward(2.5)'), h2 = (await H(page, 'window.__onfoot.held()')).drink;
    expect(n.thirst > t0 + 3 && h2 && h2.left < held.left, `thirst ${t0} -> ${n.thirst}; sips left ${held.left} -> ${h2?.left}`);
    const names1 = await H(page, 'window.__onfoot.meshNames()');
    const added = names1.filter((x) => !names0.includes(x));
    expect(!added.length, `new meshes: ${added.join(', ')}`);
    summary.orderDrink = { steps, stages: [...seen], pos, thirst: [t0, n.thirst], sipsLeft: [held.left, h2.left], bartender: staffSeen.slice(-3) };
    return `${steps * 6} sim s to the hand-over (stages ${[...seen].join(' > ')}); you at frame (${pos.u}, ${pos.v}); thirst ${t0.toFixed(1)} -> ${n.thirst.toFixed(1)} in 2.5 min, sips left ${held.left} -> ${h2.left}; no new mesh`;
  });
  await check('order food at a table: a server comes, the food arrives, eating raises hunger', async () => {
    // (S3b: guests move between tables now, so the check takes a high-top whose four stools nobody holds, high-top 2 first)
    const ht = await H(page, `(() => { const r = window.__onfoot.catalogue().reservations; for (const k of [2, 1, 3, 4, 5, 6]) if (!r.some((x) => x.slot.startsWith('high-top ' + k + ' '))) return 'high-top-' + k; return 'high-top-2'; })()`);
    const u = await H(page, `window.__onfoot.use('${ht}', 'order-food', 'wings')`);
    const stages = [], dists = []; let food = null, k = 0;
    for (; k < 48 && !food; k++) {
      await H(page, 'window.__onfoot.fastForward(0.25)');
      const o = await H(page, 'window.__onfoot.orders()'), s = await H(page, 'window.__onfoot.staff()'), p = await H(page, 'window.__onfoot.pos()');
      if (o[0] && stages[stages.length - 1] !== o[0].stage) stages.push(o[0].stage);
      dists.push(+Math.hypot(s[1].u - p.u, s[1].v - p.v).toFixed(2));
      food = (await H(page, 'window.__onfoot.held()')).food;
    }
    const p = await H(page, 'window.__onfoot.pos()');
    expect(u.ok && food && food.id === 'wings', `order ${JSON.stringify(u)}; stages ${stages}; food ${JSON.stringify(food)}`);
    expect(stages.includes('server-coming') && (stages.includes('kitchen') || stages.includes('carrying')), `stages ${stages}`);
    expect(p.sitting !== null, `not seated: ${JSON.stringify(p)}`);
    await H(page, `window.__onfoot.setNeeds({ hunger: 30 })`);
    const h0 = (await H(page, 'window.__onfoot.needs()')).hunger, n = await H(page, 'window.__onfoot.fastForward(1)');
    expect(near(n.hunger - h0, 9.2, 1.2), `hunger ${h0} -> ${n.hunger}`);
    summary.orderFood = { minutes: k * 0.25, stages, serverDistance: dists, hunger: [h0, n.hunger] };
    return `${(k * 0.25).toFixed(2)} sim min to the food (stages ${stages.join(' > ')}; the server ${dists[0]} m -> ${Math.min(...dists)} m from you); seated at seat ${p.sitting}; hunger ${h0.toFixed(1)} -> ${n.hunger.toFixed(1)} in 1 min (eating +10 a minute, less 0.8)`;
  });
  await check('items: everything held, ordered or left as an empty is an instance in the six item meshes, each model within its row; no other new mesh', async () => {
    await H(page, 'window.__onfoot.fastForward(8)');
    const it = await H(page, 'window.__onfoot.items()'), b = await H(page, 'window.__onfoot.breakdown()');
    const rows = b.rows.filter((r) => r.name.startsWith('items-'));
    expect(it.meshes.length === 6 && it.frustumCulled.every((f) => f === false), JSON.stringify(it));
    const over = Object.keys(it.perInstance).filter((k) => it.perInstance[k] > it.alloc[k]);
    expect(!over.length, `over: ${over.map((k) => `${k} ${it.perInstance[k]} > ${it.alloc[k]}`)}`);
    expect(rows.every((r) => r.group === 'items' && r.tris / r.n <= it.alloc[r.name.slice(6)] + 1e-6), JSON.stringify(rows));
    summary.items = { it, rows };
    return `per instance ${Object.entries(it.perInstance).map(([k, v]) => `${k} ${v}/${it.alloc[k]}`).join(', ')}; in the pass now: ${rows.map((r) => `${r.name} ${r.n} x ${r.tris / r.n} = ${r.tris}`).join(', ') || 'none'}; empties ${it.empties}`;
  });
  // ---- S2a's repair (the review's defects): ordering both at the counter, Not now, a menu closed unanswered, sips at
  // their pace, a match watched to the final whistle, the nudges, the heater, messages on a set clock
  // finish what you hold standing by the counter (its edge is a surface within 3 m, so the empties go down there)
  const BARSIDE = `(() => { const f = window.__onfoot.frame(); return [f.O[0] + 19.2 * f.A[0] + 12.4 * f.B[0], f.O[1] + 19.2 * f.A[1] + 12.4 * f.B[1]]; })()`;
  const emptyHands = async () => {
    const q = await H(page, 'window.__onfoot.queue()'); for (const a of q) await H(page, `window.__onfoot.cancelAction(${a.id})`);
    const [x, z] = await H(page, BARSIDE); await H(page, `window.__onfoot.go(${x}, ${z})`);
    for (let i = 0; i < 12; i++) { const h = await H(page, 'window.__onfoot.held()'); if (!h.drink && !h.food) return true; await H(page, 'window.__onfoot.fastForward(1)'); }
    lastHeld = { held: await H(page, 'window.__onfoot.held()'), pos: await H(page, 'window.__onfoot.pos()'), orders: await H(page, 'window.__onfoot.orders()'), log: await H(page, 'window.__onfoot.lifeLog(12)') };
    return false;
  };
  let lastHeld = null;
  const waitMenu = async (kind) => { for (let i = 0; i < 40; i++) { const m = await H(page, 'window.__onfoot.menu()'); if (m.open && m.order && m.order.kind === kind) return m; await H(page, 'window.__onfoot.fastForward(0.05)'); } return H(page, 'window.__onfoot.menu()'); };
  const choosing = async () => (await H(page, 'window.__onfoot.orders()')).filter((o) => o.stage === 'choosing');
  await check('ordering at the counter: Order a drink then Order food: one menu at a time (food waits), a food item can\'t answer the drink menu, each answered, both delivered, both offered again after', async () => {
    await H(page, `window.__onfoot.setClock('Sat', 21)`);
    expect(await emptyHands(), 'still holding something after 12 sim minutes: ' + JSON.stringify(lastHeld));
    await goStand(page);
    const u1 = await H(page, `window.__onfoot.use('bar', 'order-drink')`), u2 = await H(page, `window.__onfoot.use('bar', 'order-food')`);
    expect(u1.ok && u2.ok, `${JSON.stringify(u1)} ${JSON.stringify(u2)}`);
    const m1 = await waitMenu('drink'), c1 = await choosing(), q1 = await H(page, 'window.__onfoot.queue()');
    expect(m1.open && m1.order?.kind === 'drink' && c1.length === 1 && c1[0].kind === 'drink', `menu ${JSON.stringify(m1)}; choosing ${JSON.stringify(c1)}`);
    expect(q1.length === 1 && q1[0].action === 'order-food' && q1[0].stage === 'waiting', `queue ${JSON.stringify(q1)}`);
    // a food item can't land in the drink order
    await H(page, `window.__onfoot.pickItem('wings')`);
    const c1b = await choosing(), m1b = await H(page, 'window.__onfoot.menu()');
    expect(m1b.open && c1b.length === 1 && c1b[0].kind === 'drink' && c1b[0].item === null, `after wings on the drink menu: ${JSON.stringify(c1b)} ${JSON.stringify(m1b)}`);
    // the menu stays open while you choose: nothing else starts
    await H(page, 'window.__onfoot.fastForward(0.5)');
    const c1c = await choosing();
    expect(c1c.length === 1 && c1c[0].kind === 'drink', `after 30 s: ${JSON.stringify(c1c)}`);
    await H(page, `window.__onfoot.pickItem('lime-soda')`);
    const m2 = await waitMenu('food'), c2 = await choosing();
    expect(m2.open && m2.order?.kind === 'food' && c2.length === 1 && c2[0].kind === 'food', `food menu ${JSON.stringify(m2)}; choosing ${JSON.stringify(c2)}`);
    await H(page, `window.__onfoot.pickItem('wings')`);
    let held = null, k = 0;
    for (; k < 30; k++) { await H(page, 'window.__onfoot.fastForward(0.25)'); held = await H(page, 'window.__onfoot.held()'); if (held.drink && held.food) break; }
    expect(held.drink?.id === 'lime-soda' && held.food?.id === 'wings', `held ${JSON.stringify(held)} after ${k * 0.25} min; orders ${JSON.stringify(await H(page, 'window.__onfoot.orders()'))}`);
    const during = (await H(page, `window.__onfoot.offers('bar')`)).map((o) => o.action);
    const done = await emptyHands(), after = (await H(page, `window.__onfoot.offers('bar')`)).map((o) => o.action), it = await H(page, 'window.__onfoot.items()');
    expect(!during.includes('order-drink') && !during.includes('order-food'), `offered while holding both: ${during}`);
    expect(done && after.includes('order-drink') && after.includes('order-food'), `after: ${after} (hands empty ${done})`);
    summary.orderBoth = { minutesToBoth: (k + 1) * 0.25, offersAfter: after, empties: it.empties };
    return `the drink menu first with the food order waiting in the queue; wings on the drink menu ignored; both delivered ${((k + 1) * 0.25).toFixed(2)} sim min after the food was picked; finished, the empties on the counter (${it.empties}); the bar offers ${after.join(', ')} again`;
  });
  await check('ordering: Not now on each menu drops only that menu\'s order; a menu closed unanswered drops its order; nothing stays "choosing"; both offered again', async () => {
    await goStand(page);
    await H(page, `window.__onfoot.use('bar', 'order-drink')`); await H(page, `window.__onfoot.use('bar', 'order-food')`);
    const m1 = await waitMenu('drink');
    const o1 = await H(page, 'window.__onfoot.notNow()');
    const m2 = await waitMenu('food'), c2 = await choosing();
    expect(m1.order?.kind === 'drink' && !o1.some((o) => o.kind === 'drink') && m2.open && m2.order?.kind === 'food' && c2.length === 1, `drink menu ${JSON.stringify(m1)}; after Not now ${JSON.stringify(o1)}; then ${JSON.stringify(m2)} ${JSON.stringify(c2)}`);
    const o2 = await H(page, 'window.__onfoot.notNow()'), m3 = await H(page, 'window.__onfoot.menu()');
    expect(!o2.length && !m3.open, `after the second Not now: ${JSON.stringify(o2)} ${JSON.stringify(m3)}`);
    const offers1 = (await H(page, `window.__onfoot.offers('bar')`)).map((o) => o.action);
    expect(offers1.includes('order-drink') && offers1.includes('order-food'), `offers ${offers1}`);
    // a menu that goes away without an answer (another sheet, a hook): its order is dropped by the next frame
    await H(page, `window.__onfoot.use('bar', 'order-food')`);
    await waitMenu('food');
    await H(page, 'window.__onfoot.closeSheets()'); await H(page, 'window.__onfoot.fastForward(0.05)');
    const o3 = await H(page, 'window.__onfoot.orders()'), offers2 = (await H(page, `window.__onfoot.offers('bar')`)).map((o) => o.action), log = await H(page, 'window.__onfoot.lifeLog(8)');
    expect(!o3.length && offers2.includes('order-food'), `after closing the menu unanswered: ${JSON.stringify(o3)} ${offers2} ${JSON.stringify(log)}`);
    return `Not now on the drink menu dropped the drink order only, the food menu opened; Not now there dropped it; a food menu closed unanswered was dropped ("${log.filter((l) => /dropped/.test(l.what)).map((l) => l.what).pop()}"); the bar offers ${offers2.join(', ')}`;
  });
  await check('Sip: rapid taps give at most one sip per 2.4 sim seconds (the sip\'s clip); the next only after it', async () => {
    expect(await emptyHands(), 'still holding something: ' + JSON.stringify(lastHeld));
    await goStand(page);
    await H(page, `window.__onfoot.use('bar', 'order-drink', 'cucumber')`);
    let held = null; for (let i = 0; i < 16 && !held; i++) { await H(page, 'window.__onfoot.fastForward(0.05)'); held = (await H(page, 'window.__onfoot.held()')).drink; }
    expect(held, 'no drink');
    const n0 = (await H(page, 'window.__onfoot.needs()')).thirst;
    const taps = await H(page, `Array.from({ length: 12 }, () => window.__onfoot.sip('drink'))`);
    const h1 = (await H(page, 'window.__onfoot.held()')).drink, n1 = (await H(page, 'window.__onfoot.needs()')).thirst;
    await H(page, 'window.__onfoot.fastForward(2 / 60)'); const t2 = await H(page, `window.__onfoot.sip('drink')`);
    await H(page, 'window.__onfoot.fastForward(1 / 60)'); const t3 = await H(page, `window.__onfoot.sip('drink')`);
    const h3 = (await H(page, 'window.__onfoot.held()')).drink;
    const ok = taps.filter(Boolean).length;
    expect(ok === 1 && h1.left === held.left - 1 && t2 === false && t3 === true && h3.left === held.left - 2, `12 taps: ${ok} sips (left ${held.left} -> ${h1.left}); at +2 s ${t2}, at +3 s ${t3} (left ${h3.left})`);
    // the automatic sips keep their pace when the clock is set back an hour (their timers count from the sim's now)
    const clk = await H(page, 'window.__onfoot.clock()');
    await H(page, `window.__onfoot.setClock('Sat', ${Math.max(12, clk.hour - 1)})`);
    await H(page, 'window.__onfoot.fastForward(1.5)');
    const h4 = (await H(page, 'window.__onfoot.held()')).drink;
    expect(h4 && h4.left < h3.left, `after setting the clock back an hour: sips left ${h3.left} -> ${h4?.left} in 1.5 sim min`);
    await H(page, `window.__onfoot.setClock('Sat', 21)`);
    summary.sips = { taps: ok, left: [held.left, h1.left, h3.left, h4.left], thirst: [n0, n1] };
    return `12 taps in a row: ${ok} sip (sips left ${held.left} -> ${h1.left}, thirst ${n0.toFixed(1)} -> ${n1.toFixed(1)}); a tap 2 sim s later: no sip; 3 s later: a sip (left ${h3.left}); the clock set back an hour, the automatic sips went on (left ${h4.left} after 1.5 min)`;
  });
  await check('tonight\'s three: a match watched on the big screen, and on a patio screen that follows it, to the final whistle completes "watch-final" (+5 house tokens)', async () => {
    const out = [];
    for (const scr of ['screen-big', 'screen-patio-1']) {
      await H(page, `window.__onfoot.setClock('Sat', ${20 + 10 / 60})`);
      await H(page, `window.__onfoot.setTonight(['watch-final', 'order-favourite', 'song'])`);
      await goStand(page);
      const t0 = await H(page, 'window.__onfoot.tokens()');
      const u = await H(page, `window.__onfoot.use('${scr}', 'watch')`);
      await H(page, 'window.__onfoot.fastForward(1)');
      const q = await H(page, 'window.__onfoot.queue()'), tv0 = await H(page, 'window.__onfoot.tv()');
      await H(page, 'window.__onfoot.fastForward(16)');
      const t1 = await H(page, 'window.__onfoot.tokens()'), tv1 = await H(page, 'window.__onfoot.tv()'), log = await H(page, 'window.__onfoot.lifeLog(40)');
      const fromGoal = (t1.tokens - t0.tokens) - (t1.fromTime - t0.fromTime);
      for (const a of await H(page, 'window.__onfoot.queue()')) await H(page, `window.__onfoot.cancelAction(${a.id})`);
      expect(u.ok && q[0]?.stage === 'doing' && t1.tonight.done.includes('watch-final') && fromGoal === 5 && log.some((l) => l.what === 'goal watch-final'), `${scr}: ${JSON.stringify(u)} queue ${JSON.stringify(q)} done ${JSON.stringify(t1.tonight)} tokens ${t0.tokens} -> ${t1.tokens} (time ${t0.fromTime} -> ${t1.fromTime}); screens ${JSON.stringify(tv0.screens)} then ${JSON.stringify(tv1.screens)}`);
      out.push(`${scr}: watched from ${tv0.now.time} (channel ${tv0.screens[scr.slice(7)]}) to ${tv1.now.time} (channel ${tv1.screens[scr.slice(7)]} after the whistle); done, +${fromGoal} tokens`);
    }
    return out.join('; ');
  });
  await check('the low-need nudge toast: a need falling under 30 shows its nudge (thirst: how far the bar is); a set clock takes toasts and captions down', async () => {
    await H(page, `window.__onfoot.setClock('Sat', 21)`);
    expect(await emptyHands(), 'still holding something: ' + JSON.stringify(lastHeld));
    await goStand(page);
    // every need well clear of 30 for a sim minute (the nudges come at most once a sim minute), then thirst just over
    await H(page, `window.__onfoot.setNeeds({ hunger: 70, thirst: 70, fun: 70, social: 70, energy: 70 })`);
    await H(page, 'window.__onfoot.fastForward(1.2)');
    await H(page, `window.__onfoot.setNeeds({ hunger: 70, thirst: 30.05, fun: 70, social: 70, energy: 70 })`);
    await H(page, 'window.__onfoot.fastForward(0.05)');
    const t = await H(page, 'window.__onfoot.lastToast()'), log = await H(page, 'window.__onfoot.lifeLog(6)'), n = await H(page, 'window.__onfoot.needs()');
    expect(/^Thirsty: the bar's \d+ m away$/.test(t) && log.some((l) => l.what === 'nudge thirst') && n.thirst < 30, `toast "${t}", thirst ${n.thirst}, log ${JSON.stringify(log)}`);
    await H(page, `window.__onfoot.setClock('Sat', 21.5)`);
    const t2 = await H(page, 'window.__onfoot.lastToast()'), c2 = await H(page, 'window.__onfoot.lastCaption()');
    expect(t2 === '' && c2 === '', `after setClock: toast "${t2}", caption "${c2}"`);
    await H(page, `window.__onfoot.setNeeds({ thirst: 60 })`);
    return `"${t}" (thirst ${n.thirst.toFixed(2)}); after setClock no toast and no caption`;
  });
  await check('the patio heaters: +2 mood at night within 2.5 m, none beyond, none by day', async () => {
    const at = (u, v) => `(() => { const f = window.__onfoot.frame(); return [f.O[0] + ${u} * f.A[0] + ${v} * f.B[0], f.O[1] + ${u} * f.A[1] + ${v} * f.B[1]]; })()`;
    const place = async (spots) => { for (const [u, v] of spots) { const [x, z] = await H(page, at(u, v)); if (await H(page, `window.__onfoot.go(${x}, ${z})`)) return [u, v]; } return null; };
    const heater = async () => { await H(page, 'window.__onfoot.fastForward(0.05)'); const m = await H(page, 'window.__onfoot.mood()'); const h = m.moodlets.find((x) => x.id === 'heater'); return { h: h ? h.value : null, mood: m.mood, formula: m.formula, night: (await H(page, 'window.__onfoot.clock()')).night }; };
    await H(page, `window.__onfoot.setClock('Sat', 21)`);
    const near1 = await place([[12.9, -2.6], [14.2, -3.95], [11.6, -3.95], [12.9, -2.2]]);
    expect(near1, 'no free spot near the heater');
    const a = await heater();
    const far = await place([[17.0, -2.6], [17.0, -3.2], [16.9, -2.2]]);
    expect(far, 'no free spot away from the heaters');
    const b = await heater();
    await H(page, `window.__onfoot.setClock('Sat', 13)`);
    await place([near1]);
    const c = await heater();
    await H(page, `window.__onfoot.setClock('Sat', 21)`); await goStand(page);
    expect(a.h === 2 && near(a.mood, a.formula, 1e-3) && b.h === null && c.h === null && a.night > 0.5 && c.night < 0.5, `near ${JSON.stringify(a)}; far ${JSON.stringify(b)}; noon ${JSON.stringify(c)}`);
    return `at frame (${near1}) at 21:00 (night ${a.night}): "Warm by the heater" +${a.h}, mood ${a.mood} = the formula's ${a.formula}; at (${far}): none; at 13:00 (night ${c.night}) by the heater: none`;
  });
  await check('the featured match: exactly one a day with the plan\'s slot, channel, kick-off and final whistle, none on Tuesday; featuredFactor 1.25 only inside its window; other fixtures aren\'t featured', async () => {
    const want = { Mon: [2, '19:00', '19:34'], Tue: null, Wed: [1, '20:00', '20:25'], Thu: [2, '19:00', '19:34'], Fri: [1, '20:00', '20:25'], Sat: [1, '20:00', '20:25'], Sun: [2, '14:30', '15:04'] };
    const out = [];
    for (const [d, w] of Object.entries(want)) {
      const tv = await H(page, `window.__onfoot.tv('${d}', 43)`), fe = tv.fixtures.filter((f) => f.featured);
      if (!w) { expect(!fe.length && !tv.featured, `${d}: ${fe.length} featured`); out.push(`${d}: none`); continue; }
      expect(fe.length === 1 && fe[0].channel === w[0] && fe[0].kickoff === w[1] && fe[0].finalWhistle === w[2], `${d}: ${JSON.stringify(fe.map((f) => [f.channel, f.kickoff, f.finalWhistle]))}`);
      const [hh, mm] = w[1].split(':').map(Number), ko = hh + mm / 60, [fh, fm] = w[2].split(':').map(Number), fw = fh + fm / 60;
      const ff = await H(page, `[${[ko - 31 / 60, ko - 29 / 60, fw - 1 / 60, fw + 1 / 60].join(',')}].map((h) => window.__onfoot.tvAt('${d}', h).featuredFactor)`);
      expect(JSON.stringify(ff) === '[1,1.25,1.25,1]', `${d} factor ${JSON.stringify(ff)}`);
      out.push(`${d}: ch ${fe[0].channel} ${fe[0].home} v ${fe[0].away} ${fe[0].kickoff}-${fe[0].finalWhistle} (${tv.fixtures.length} fixtures, ${tv.fixtures.length - 1} not featured); x1.25 ${JSON.stringify(ff)}`);
    }
    return out.join('; ');
  });
  await check('highlights: the previous match day\'s goals on Tuesday and before a day\'s first final whistle, under its name; the day\'s own after it', async () => {
    const r = await H(page, `(() => { const o = window.__onfoot, out = {}; for (const [d, h] of [['Tue', 20], ['Sat', 11], ['Sat', 13], ['Wed', 12]]) { o.setClock(d, h); const t = o.tv(); out[d + h] = { title: t.highlights.title, days: [...new Set(t.highlights.items.map((x) => x.fixture.split('-')[2]))], n: t.highlights.items.length, big: t.big }; } return out; })()`);
    expect(r.Tue20.title === "Monday's highlights · simulated" && r.Tue20.days.every((d) => d === '1') && r.Tue20.n > 0 && r.Tue20.big === 3, JSON.stringify(r.Tue20));
    expect(r.Sat11.title === "Friday's highlights · simulated" && r.Sat11.days.every((d) => d === '5') && r.Sat11.n > 0, JSON.stringify(r.Sat11));
    expect(r.Sat13.title === "Today's highlights · simulated" && r.Sat13.days.every((d) => d === '6'), JSON.stringify(r.Sat13));
    expect(r.Wed12.title === "Monday's highlights · simulated", JSON.stringify(r.Wed12));
    return Object.entries(r).map(([k, v]) => `${k}: "${v.title}" (${v.n} items, days ${v.days})`).join('; ');
  });
  await check('the same clock gives the same fixtures and scores twice; honesty check 3 on every screen frame: each has SIMULATED, none says "live" in any case', async () => {
    const a = await H(page, `(() => { const o = window.__onfoot; o.setClock('Sat', 20.2); return JSON.stringify(o.tv('Sat', 43).fixtures); })()`);
    await H(page, `window.__onfoot.setClock('Sun', 15)`); await H(page, 'window.__onfoot.fastForward(3)');
    const b = await H(page, `(() => { const o = window.__onfoot; o.setClock('Sat', 20.2); return JSON.stringify(o.tv('Sat', 43).fixtures); })()`);
    expect(a === b, 'the fixtures differ');
    await frames(page, 3);
    const f = await H(page, 'window.__onfoot.tvFrames()'), drawn = await H(page, 'window.__drawn');
    expect(f.frames >= 8 && f.missingTag === 0 && f.liveWord === 0, JSON.stringify(f));
    expect(!drawn.some((t) => /\blive\b/i.test(t)) && drawn.includes('SIMULATED'), `canvas strings: ${drawn.filter((t) => /\blive\b/i.test(t)).slice(0, 5)}`);
    const words = /real-time|people here now|\bodds\b|moneyline|point spread|over\/under|parlay|wager|sportsbook|\bbet\b|[$€£¥]|\bUSD\b/i;
    expect(!drawn.some((t) => words.test(t)), `forbidden: ${drawn.filter((t) => words.test(t)).slice(0, 5)}`);
    const sample = [...new Set(drawn)].filter((t) => /–|GOAL|TOUCHDOWN|highlights|UP NEXT|FULL TIME/.test(t)).slice(0, 6);
    return `fixtures identical (${(a.length / 1024).toFixed(0)} KB of JSON); ${f.frames} channel frames drawn (${f.cell.join(' x ')} at ${f.hz} Hz), ${f.missingTag} without the tag, ${f.liveWord} with the word; ${drawn.length} canvas strings, e.g. ${sample.map((t) => `"${t}"`).join(', ')}`;
  });
  await check('the menu: alcohol-free for the player and no prices; the blocklist test passes (tests/sportsbar-sim.mjs)', async () => {
    const c = await H(page, 'window.__onfoot.catalogue()');
    expect(c.menu.length >= 14 && c.menu.every((i) => i.alcohol === false) && c.menu.every((i) => !i.keys.some((k) => /price|cost/i.test(k))), JSON.stringify(c.menu));
    expect(c.menuNote === 'You drove here, so your drinks are alcohol-free. On the house.', c.menuNote);
    expect(c.adverts === 41, `adverts ${c.adverts}`);
    const out = execFileSync('node', [path.join(ROOT, 'tests/sportsbar-sim.mjs')], { cwd: ROOT, encoding: 'utf8' });
    expect(/all passed/.test(out), out);
    const line = out.split('\n').find((l) => /blocklist/.test(l));
    return `${c.menu.length} items, all alcohol-free, no price field; ${c.adverts} adverts in ${c.types} types; ${line.trim()}`;
  });
  await check('the clip layer leaves people/ untouched (git status and git diff on it are empty), and each clip plays on a person built at each LOD', async () => {
    const st = execFileSync('git', ['status', '--porcelain', '--', 'src/onfoot/people'], { cwd: ROOT, encoding: 'utf8' }) + execFileSync('git', ['diff', '--stat', 'HEAD', '--', 'src/onfoot/people'], { cwd: ROOT, encoding: 'utf8' });
    expect(!st.trim(), st);
    const r = await H(page, 'window.__onfoot.clipTest()');
    const bad = [];
    for (const lv of r) for (const p of lv.probes) if (!(p.weight > 0.9 && Math.max(p.armR, p.chest, p.hips) > 0.05 && p.bones >= 16)) bad.push(`LOD ${lv.lod} ${p.clip} ${JSON.stringify(p)}`);
    summary.clips = r;
    expect(!bad.length, bad.join('; '));
    return `git: clean; ` + r.map((lv) => `LOD ${lv.lod} (${fmt(lv.tris)} tris, built in ${lv.buildMs} ms): ` + lv.probes.map((p) => `${p.clip} ${Math.max(p.armR, p.chest, p.hips).toFixed(2)}`).join(' ')).join('; ');
  });
  await check('items at HD: the six models within the HD and Ultra row', async () => {
    await H(page, `window.__onfoot.setQuality('high')`);
    const it = await H(page, 'window.__onfoot.items()');
    const over = Object.keys(it.perInstance).filter((k) => it.perInstance[k] > it.alloc[k]);
    expect(it.hi && !over.length, JSON.stringify(it));
    await H(page, `window.__onfoot.setQuality('low')`);
    return Object.entries(it.perInstance).map(([k, v]) => `${k} ${v}/${it.alloc[k]}`).join(', ');
  });
  await check('checks: no console errors after the run', async () => { expect(!errors.length, errors.slice(0, 5).join(' | ')); return 'clean'; });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ saving
if (want('save')) {
  console.log('save: round trip, and the page with storage blocked');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await check('save: saving round-trips (tokens, your team, the visit count, the seed of the regulars) on this device', async () => {
    const t0 = await H(page, 'window.__onfoot.tokens()');
    await H(page, `window.__onfoot.setTeam('HBL')`);
    const s0 = await H(page, 'window.__onfoot.saveNow()');
    expect(s0 && s0.v === 1 && s0.team === 'HBL' && s0.tokens === t0.tokens, JSON.stringify(s0));
    const p2 = await ctx.newPage(); p2.setDefaultTimeout(T);
    await p2.goto(pathToFileURL(PAGE).href + '?quality=low&day=Sat&hour=21&hint=0');
    await p2.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
    const t1 = await H(p2, 'window.__onfoot.tokens()'), s1 = await H(p2, 'window.__onfoot.saved()');
    expect(t1.storage === 'ok' && t1.visits === t0.visits + 1 && t1.tokens >= t0.tokens && s1.team === 'HBL' && s1.regularsSeed === s0.regularsSeed, `${JSON.stringify(t1)} ${JSON.stringify({ team: s1.team, seed: s1.regularsSeed })}`);
    await p2.close();
    return `visit ${t0.visits} -> ${t1.visits}, tokens ${t0.tokens} -> ${t1.tokens}, team ${s1.team}, regulars' seed kept; the label "${t0.label}"`;
  });
  await ctx.close().catch(() => {});
  const blocked = () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage blocked'); } }); };
  const B = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0', false, blocked);
  await check('save: the page works with storage blocked (boots, plays a song, fast-forwards; nothing is kept)', async () => {
    expect(!B.errors.length, B.errors.join(' | '));
    const t = await H(B.page, 'window.__onfoot.tokens()');
    const u = await H(B.page, `window.__onfoot.use('jukebox', 'song')`); await H(B.page, 'window.__onfoot.fastForward(1.5)');
    const log = await H(B.page, 'window.__onfoot.lifeLog(5)'), s = await H(B.page, 'window.__onfoot.saveNow()');
    expect(t.storage === 'blocked' && u.ok && log.some((l) => l.what === 'song done') && s.blocked, `${JSON.stringify(t)} ${JSON.stringify(u)} ${JSON.stringify(s)}`);
    expect(!B.errors.length, B.errors.join(' | '));
    return `storage ${t.storage}; tokens ${t.tokens} this visit only; a song picked; saveNow -> ${JSON.stringify(s)}`;
  });
  await B.ctx.close().catch(() => {});
  void errors;
}

// ------------------------------------------------------------------------------------------------ screenshots
if (want('shots')) {
  const at = (u, v) => `(() => { const f = window.__onfoot.frame(); return [f.O[0] + ${u} * f.A[0] + ${v} * f.B[0], f.O[1] + ${u} * f.A[1] + ${v} * f.B[1]]; })()`;
  const lookAt = async (page, u, y, v) => { const [x, z] = await H(page, at(u, v)); const p = await H(page, 'window.__onfoot.pos()'); const yaw = Math.atan2(x - p.x, z - p.z) * 180 / Math.PI, e = 1.62; const pitch = Math.atan2(y - e, Math.hypot(x - p.x, z - p.z)) * 180 / Math.PI; await H(page, `window.__onfoot.look(${yaw}, ${pitch})`); };
  for (const [w, h] of [[390, 844], [844, 390]]) {
    console.log(`shots: the needs panel at ${w}x${h}`);
    const { ctx, page, errors } = await open([w, h], 'quality=low&day=Sat&hour=21&hint=0', true);
    await check(`shots ${w}x${h}: the needs panel open`, async () => {
      expect(!errors.length, errors.join(' | '));
      await H(page, `window.__onfoot.pose('door')`);
      await H(page, `(() => { const o = window.__onfoot; o.setNeeds({ hunger: 64, thirst: 27, fun: 48, social: 35, energy: 71 }); o.openNeeds(); })()`);
      const n = await shot(page, png(`s2a-needs-panel-${w}x${h}`));
      await H(page, 'window.__onfoot.closeSheets()');
      const n2 = await shot(page, png(`s2a-needs-strip-${w}x${h}`));
      return `${n}, ${n2}`;
    });
    await ctx.close().catch(() => {});
  }
  console.log('shots: 1280x720, HD, Saturday 21:00');
  const { ctx, page, errors } = await open([1280, 720], 'quality=high&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)');
  await check('shots 1280x720 HD: the radial menu on the bar, ordering, holding a drink in first person', async () => {
    expect(!errors.length, errors.join(' | '));
    const [x, z] = await H(page, at(19.2, 11.6)); await H(page, `window.__onfoot.go(${x}, ${z})`); await H(page, 'window.__onfoot.view("first")');
    await lookAt(page, 19.2, 1.4, 14.5);
    const items = await H(page, `window.__onfoot.radial('bar')`);
    const a = await shot(page, png('s2a-radial-bar-1280x720'));
    await H(page, 'window.__onfoot.closeRadial()');
    await H(page, `window.__onfoot.use('bar', 'order-drink')`);
    for (let i = 0; i < 12; i++) { await H(page, 'window.__onfoot.fastForward(0.05)'); if ((await H(page, 'window.__onfoot.orders()')).some((o) => o.stage === 'choosing')) break; }
    const b = await shot(page, png('s2a-ordering-1280x720'));
    await H(page, `window.__onfoot.pickItem('lime-soda')`);
    for (let i = 0; i < 12; i++) { await H(page, 'window.__onfoot.fastForward(0.05)'); if ((await H(page, 'window.__onfoot.held()')).drink) break; }
    await H(page, 'window.__onfoot.view("first")'); await lookAt(page, 22, 1.2, 4.6);
    const held = await H(page, 'window.__onfoot.held()');
    const c = await shot(page, png('s2a-holding-drink-first-1280x720'));
    expect(items && items.length >= 2 && held.drink, `${JSON.stringify(items)} ${JSON.stringify(held)}`);
    return `${a} (${items.map((i) => i.label).join(', ')}), ${b}, ${c} (holding ${held.drink.name})`;
  });
  await check('shots 1280x720 HD: the TV wall with the featured match and a GOAL banner at its first goal (Saturday, week 43), and the guide card', async () => {
    // the plan's week 43; should its Saturday featured match end 0-0 (simulated), the next week whose has a goal
    let wk = 43, tv = null, f = null, g = null;
    for (; wk < 53; wk++) { tv = await H(page, `window.__onfoot.tv('Sat', ${wk})`); f = tv.featured; g = f.events.find((e) => e.kind === 'goal'); if (g) break; }
    expect(g, 'no featured match with a goal in weeks 43 to 52');
    await H(page, `window.__onfoot.setWeek(${wk})`);
    const hour = (((g.t % 1440) + 1440) % 1440) / 60 + 3 / 3600;
    await H(page, `window.__onfoot.setClock('Sat', ${hour})`);
    const [x, z] = await H(page, at(29.6, 4.75)); await H(page, `window.__onfoot.go(${x}, ${z})`); await H(page, 'window.__onfoot.view("first")');
    await lookAt(page, 35.8, 2.2, 4.75);
    const now = await H(page, 'window.__onfoot.tv()');
    const a = await shot(page, png('s2a-tv-goal-1280x720'));
    await H(page, 'window.__onfoot.openGuide()');
    const b = await shot(page, png('s2a-guide-1280x720'));
    await H(page, 'window.__onfoot.closeSheets()');
    await H(page, 'window.__onfoot.setWeek(43)');
    summary.goalShot = { week: wk, goal: g, hour, now: now.now, big: now.big, chip: now.chip };
    return `${a} at ${now.now.time} of week ${wk}${wk !== 43 ? ' (week 43\'s Saturday featured match ends ' + (await H(page, `window.__onfoot.tv('Sat', 43)`)).featured.final.join('-') + ', simulated, with no goal)' : ''} (the first goal ${g.at}, ${g.team}, ${g.label}; big screen channel ${now.big}; "${now.chip}"), ${b}`;
  });
  await check('shots 1280x720 HD: a gameNight dance, Saturday 21:00', async () => {
    await H(page, `window.__onfoot.setClock('Sat', 21)`);
    const u = await H(page, `window.__onfoot.use('dance-spot', 'dance')`);
    await H(page, 'window.__onfoot.fastForward(0.4)');
    await H(page, 'window.__onfoot.view("third")');
    const p = await H(page, 'window.__onfoot.pos()');
    const [cx, cz] = await H(page, at(p.u - 3.2, p.v + 1.1));
    await H(page, `window.__onfoot.camera([${cx}, 1.75, ${cz}, ${p.x}, 1.0, ${p.z}])`);
    await frames(page, 2);
    const a = await shot(page, png('s2a-dance-1280x720'));
    await H(page, 'window.__onfoot.camera(null)');
    const n = await H(page, 'window.__onfoot.needs()');
    expect(u.ok && n.doing.fun === 'dance', `${JSON.stringify(u)} ${JSON.stringify(n.doing)}`);
    return `${a}: dancing at frame (${p.u}, ${p.v})`;
  });
  await check('shots: no console errors', async () => { expect(!errors.length, errors.slice(0, 5).join(' | ')); });
  await ctx.close().catch(() => {});
  // the review's two phone-size shots, again: Saturday 21:00 at 844 x 390 on Low, a dance and the big screen's radial
  console.log('shots: 844x390, Low, Saturday 21:00 (after a closed hour and an order, as the review drove it)');
  {
    const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0', true);
    await H(page, 'window.__onfoot.setWeek(43)');
    await check('shots 844x390 Low: a gameNight dance at Saturday 21:00 with no stale toast or caption (after a closed hour and a drink)', async () => {
      expect(!errors.length, errors.join(' | '));
      // the review's path: the clock at a closed hour with you inside (shown out, the "closed" toast), then open again, a
      // drink ordered and handed over (the bartender's caption), then Saturday 21:00
      await goStand(page);
      await H(page, `window.__onfoot.setClock('Sat', 5)`);
      const closedToast = await H(page, 'window.__onfoot.lastToast()');
      await H(page, `window.__onfoot.setClock('Sat', 20.9)`); await goStand(page);
      await H(page, `window.__onfoot.use('bar', 'order-drink', 'lime-soda')`);
      for (let i = 0; i < 16; i++) { await H(page, 'window.__onfoot.fastForward(0.05)'); if ((await H(page, 'window.__onfoot.held()')).drink) break; }
      await H(page, `window.__onfoot.setClock('Sat', 21)`);
      const u = await H(page, `window.__onfoot.use('dance-spot', 'dance')`);
      await H(page, 'window.__onfoot.fastForward(0.4)');
      await H(page, 'window.__onfoot.view("third")');
      const t = await H(page, 'window.__onfoot.lastToast()'), c = await H(page, 'window.__onfoot.lastCaption()'), n = await H(page, 'window.__onfoot.needs()');
      const a = await shot(page, png('s2a-dance-844x390'));
      expect(/closed/.test(closedToast), `no closed toast at 05:00: "${closedToast}"`);
      expect(u.ok && n.doing.fun === 'dance' && !/closed/i.test(t) && !/Enjoy/.test(c), `dance ${JSON.stringify(u)} ${JSON.stringify(n.doing)}; toast "${t}", caption "${c}"`);
      return `${a}: dancing; the 05:00 toast was "${closedToast}"; at 21:00 the toast is "${t}" and the caption "${c}"`;
    });
    await check('shots 844x390 Low: the big screen\'s radial menu stays below the needs strip (and above the credit)', async () => {
      const q = await H(page, 'window.__onfoot.queue()'); for (const a of q) await H(page, `window.__onfoot.cancelAction(${a.id})`);
      await H(page, 'window.__onfoot.view("first")');
      const [x, z] = await H(page, at(29.6, 4.75)); await H(page, `window.__onfoot.go(${x}, ${z})`);
      await lookAt(page, 35.8, 2.6, 4.75);
      await frames(page, 1);
      const items = await H(page, `window.__onfoot.radial('screen-big')`);
      const r = await H(page, `(() => { const s = document.getElementById('needs').getBoundingClientRect(), c = document.getElementById('credit').getBoundingClientRect(), b = [...document.querySelectorAll('#radial button')].map((e) => e.getBoundingClientRect()); return { strip: s.bottom, credit: c.top, top: Math.min(...b.map((x) => x.top)), bottom: Math.max(...b.map((x) => x.bottom)), n: b.length }; })()`);
      const a = await shot(page, png('s2a-radial-big-844x390'));
      await H(page, 'window.__onfoot.closeRadial()');
      expect(items && r.n >= 2 && r.top >= r.strip && r.bottom <= r.credit, JSON.stringify(r));
      return `${a}: ${items.map((i) => i.label).join(', ')}; the pills from ${r.top.toFixed(0)} to ${r.bottom.toFixed(0)} px, the strip ends at ${r.strip.toFixed(0)}, the credit starts at ${r.credit.toFixed(0)}`;
    });
    await check('shots 844x390: no console errors', async () => { expect(!errors.length, errors.slice(0, 5).join(' | ')); });
    await ctx.close().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ the clips, looked at
if (want('clipshots')) {
  console.log('clipshots: 960x720, Low, Saturday 12:00, third person, a fixed camera in front of your avatar, the HUD hidden');
  const { ctx, page, errors } = await open([960, 720], 'quality=low&day=Sat&hour=12&hint=0');
  await H(page, `document.getElementById('hud').hidden = true`);
  const at = (u, v) => `(() => { const f = window.__onfoot.frame(); return [f.O[0] + ${u} * f.A[0] + ${v} * f.B[0], f.O[1] + ${u} * f.A[1] + ${v} * f.B[1]]; })()`;
  await check('clipshots: each clip on your avatar (drink, eat, sway, two-step, arm pump, cheer, groan, clap)', async () => {
    expect(!errors.length, errors.join(' | '));
    const [x, z] = await H(page, at(32.6, 4.75)); await H(page, `window.__onfoot.go(${x}, ${z})`); await H(page, 'window.__onfoot.view("third")');
    const p = await H(page, 'window.__onfoot.pos()'), [tx, tz] = await H(page, at(29.0, 4.75));
    await H(page, `window.__onfoot.look(${(Math.atan2(tx - p.x, tz - p.z) * 180) / Math.PI}, 0)`);
    const [cx, cz] = await H(page, at(29.9, 3.7));
    await H(page, `window.__onfoot.camera([${cx}, 1.35, ${cz}, ${p.x}, 1.0, ${p.z}])`);
    const out = [];
    for (const c of ['drink', 'eat', 'sway', 'two-step', 'arm-pump', 'cheer', 'groan', 'clap']) {
      await H(page, `window.__onfoot.clipYou('${c}', 40)`); await frames(page, 2);
      out.push(await shot(page, png(`s2a-clip-${c}`)));
    }
    await H(page, 'window.__onfoot.camera(null)');
    return out.join(', ');
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the budget poses
if (want('budgets')) {
  // the sums' pass column at each preset and state (the plan's "The sums"), and the items' row
  const PASS = { low: { inside: [118, 203.9e3], outside: [139, 244.3e3], overhead: [118, 197.9e3] }, high: { inside: [177, 465.7e3], outside: [176, 449.5e3], overhead: [222, 609.4e3] }, ultra: { inside: [302, 1202.6e3], outside: [246, 1086.4e3], overhead: [302, 1180.0e3] } };
  const ITEMS = { low: [6, 6.0e3], high: [6, 14.1e3], ultra: [6, 14.1e3] };
  summary.budgets = summary.budgets ?? {};
  console.log('budgets at 844x390');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await check('budgets: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  // the items as the sums count them: every model at its cap (the staff are in the room too)
  await H(page, `(() => { const o = window.__onfoot; o.setWeek(43); return o.itemsAtCap(true); })()`);
  for (const q of PRESETS) {
    await H(page, `window.__onfoot.setQuality('${q}')`);
    for (const pose of ['door', 'tv-east', 'stall', 'patio', 'overhead']) {
      await check(`budgets ${q} ${pose}: the pass within the sums' column; the items within their row; the pass less the people and items within the "without people or items" row`, async () => {
        const r = await H(page, `window.__onfoot.pose('${pose}')`);
        await frames(page, 2);
        const s = await H(page, 'window.__onfoot.stats()'), b = await H(page, 'window.__onfoot.breakdown()'), bud = await H(page, 'window.__onfoot.budget()');
        const g = (k) => b.groups[k] ?? { calls: 0, tris: 0 };
        const pi = ['avatar', 'staff', 'items'].reduce((a, k) => ({ calls: a.calls + g(k).calls, tris: a.tris + g(k).tris }), { calls: 0, tris: 0 });
        const [pc, pt] = PASS[q][r.state], [ic, itr] = ITEMS[q], [nc, nt] = bud.noPeople;
        const row = { pose, state: r.state, pass: s.pass, frame: s.frame, maps: s.maps, ao: s.ao, groups: b.groups, frameMs: s.frameMs, simMs: s.simMs };
        summary.budgets[`${q}-${pose}`] = row;
        const gtxt = ['venue', 'near streets', 'far streets', 'trees', 'sky', 'avatar', 'staff', 'items', 'your-car', 'your-car-standin'].filter((k) => b.groups[k]).map((k) => `${k} ${g(k).calls}/${fmt(g(k).tris)}`).join(', ');
        expect(s.pass.calls <= pc && s.pass.tris <= pt, `pass ${s.pass.calls}/${fmt(s.pass.tris)} > ${pc}/${fmt(pt)}`);
        expect(g('items').calls === 6 && g('items').calls <= ic && g('items').tris <= itr, `items ${g('items').calls}/${g('items').tris} (all six at their caps: 6 calls within ${fmt(itr)})`);
        expect(s.pass.calls - pi.calls <= nc && s.pass.tris - pi.tris <= nt, `less people ${s.pass.calls - pi.calls}/${fmt(s.pass.tris - pi.tris)} > ${nc}/${fmt(nt)}`);
        return `${r.state}: pass ${s.pass.calls}/${fmt(s.pass.tris)} of ${pc}/${fmt(pt)}; frame ${s.frame.calls}/${fmt(s.frame.tris)}; less people and items ${s.pass.calls - pi.calls}/${fmt(s.pass.tris - pi.tris)} of ${nc}/${fmt(nt)}; [${gtxt}]; sim ${s.simMs} ms, frame ${s.frameMs} ms`;
      });
    }
  }
  await ctx.close().catch(() => {});
}
await closeAll();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length} of ${results.length} passed`);
process.exit(fails.length ? 1 : 0);
