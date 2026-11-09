// Phase S2b checks for the sports bar's page (PROJECT_OC_SPORTS_BAR.md, "### S2b: the games"). Drives
// dist/sportsbar/sportsbar.html (build it with `npx vite build --config src/onfoot/vite.sportsbar.config.ts`) in
// headless Chromium with SwiftShader through window.__onfoot and prints PASS or FAIL with the numbers each check saw.
// The engine's own checks (pool physics, the house's shots, darts 301, the shuffleboard's slide) are in
// tests/sportsbar-games.mjs, which this runs too. Screenshots go in tests/out/sportsbar/; results are merged into
// tests/out/sportsbar/sportsbar-s2b-checks.json after every check.
//
//   node tests/sportsbar-s2b.mjs                         every group
//   node tests/sportsbar-s2b.mjs --only=checks,controls  some groups: checks, controls, budgets, shots, clipshots
//   node tests/sportsbar-s2b.mjs --tag=r2                a suffix for every screenshot's name
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
const CHECKS = path.join(OUT, 'sportsbar-s2b-checks.json');
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
async function open(size, query, touch = false) {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(touch ? { viewport: { width: size[0], height: size[1] }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);
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
const frames = async (page, n = 2) => { const f0 = await page.evaluate(() => window.__onfoot.frames); await page.waitForFunction((k) => window.__onfoot.frames >= k, f0 + n, { timeout: T, polling: 200 }); };
async function shot(page, name) { await frames(page, 1); await page.screenshot({ path: path.join(OUT, name), timeout: 900000 }); return name; }
const H = (page, js) => page.evaluate(js);
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
const near = (a, b, t) => Math.abs(a - b) <= t;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** wait (in frames) until the game camera's blend reaches a value */
async function blendTo(page, b, max = 60, mode = null) { for (let i = 0; i < max; i++) { if (i === 0 && b === 1) { await frames(page, 1); } const c = await H(page, 'window.__onfoot.gamecam()'); if (c.moving === 0 && ((b === 1 && c.camOn && c.blend >= 1 && (!mode || c.mode === mode)) || (b === 0 && !c.camOn))) return { ...c, frames: i }; await frames(page, 1); } throw new Error(`the game camera never reached ${b}${mode ? ' in ' + mode : ''}: ${JSON.stringify(await H(page, 'window.__onfoot.gamecam()'))}`); }
/** a touch gesture dispatched in the page with exact timing (the canvas gets the press, the window the moves and the
 *  release, as from a finger): steps of [type, x, y, wait ms before it] */
const gesture = (page, steps) => page.evaluate(async (st) => {
  const c = document.getElementById('view'), r = c.getBoundingClientRect(), out = [];
  for (const [type, x, y, wait] of st) {
    if (wait) await new Promise((res) => setTimeout(res, wait));
    const e = new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: 41, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true });
    (type === 'pointerdown' ? c : window).dispatchEvent(e); out.push([type, Math.round(performance.now())]);
  }
  return out;
}, steps);
const clearQueue = async (page) => { await H(page, 'window.__onfoot.leaveGame()'); const q = await H(page, 'window.__onfoot.queue()'); for (const a of q) await H(page, `window.__onfoot.cancelAction(${a.id})`); };
const at = (u, v) => `(() => { const f = window.__onfoot.frame(); return [f.O[0] + ${u} * f.A[0] + ${v} * f.B[0], f.O[1] + ${u} * f.A[1] + ${v} * f.B[1]]; })()`;

// ------------------------------------------------------------------------------------------------ the engine's own checks
if (want('checks')) {
  await check('engine: tests/sportsbar-games.mjs (pool physics, the house\'s shots, darts 301, the shuffleboard\'s slide, whole games)', async () => {
    let out = '';
    try { out = execFileSync('node', [path.join(ROOT, 'tests/sportsbar-games.mjs')], { cwd: ROOT, encoding: 'utf8' }); } catch (e) { out = String(e.stdout ?? e.message); }
    summary.engine = out.split('\n').filter((l) => /PASS|FAIL/.test(l)).map((l) => l.trim());
    expect(/all passed/.test(out), out);
    return `${summary.engine.length} engine checks passed: ` + summary.engine.map((l) => l.replace(/^PASS\s+/, '').split('  ').slice(0, 2).join(': ')).join(' | ');
  });
}

// ------------------------------------------------------------------------------------------------ the page's checks
if (want('checks')) {
  console.log('checks: 844x390, Low, Saturday 21:00, week 43');
  const { ctx, page, errors, bootS } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await check('checks: boots with no console errors; the house player is built with the staff at load', async () => {
    expect(!errors.length, errors.join(' | '));
    await H(page, 'window.__onfoot.setWeek(43)');
    const h = await H(page, 'window.__onfoot.house()'), st = await H(page, 'window.__onfoot.staff()'), g = await H(page, 'window.__onfoot.games()');
    expect(h.lod === 1 && g.spots.length === 6, JSON.stringify({ h, g }));
    return `boot ${bootS} s; ${h.name} at frame (${h.u}, ${h.v}), LOD ${h.lod}, ${fmt(h.tris)} tris, with ${st.map((s) => s.role).join(' and ')}; ${g.spots.length} game spots (${g.spots.map((s) => s.id).join(', ')}); "${g.note}"`;
  });
  const play = async (id, strategy, competitive) => {
    await clearQueue(page);
    await H(page, `(() => { const o = window.__onfoot; o.setTraits({ competitive: ${competitive} }); o.clearMoodlets(); o.setNeeds({ hunger: 80, thirst: 80, fun: 50, social: 60, energy: 80 }); })()`);
    const t0k = await H(page, 'window.__onfoot.tokens()'), tk0 = t0k.tokens;
    const u = await H(page, `window.__onfoot.playHere('${id}')`);
    await H(page, 'window.__onfoot.fastForward(0.02)');
    const doing = (await H(page, 'window.__onfoot.needs()')).doing;
    const r = await H(page, `window.__onfoot.playOut('${id}', '${strategy}')`);
    await H(page, 'window.__onfoot.fastForward(0.02)');
    const t1k = await H(page, 'window.__onfoot.tokens()'), tk1 = t1k.tokens, m = await H(page, 'window.__onfoot.mood()'), q = await H(page, 'window.__onfoot.queue()');
    // the tokens that aren't the game's: 1 per 5 minutes in the bar, and tonight's three
    const other = (t1k.fromTime - t0k.fromTime) + 5 * (t1k.tonight.done.length - t0k.tonight.done.length);
    return { u, r, tk0, tk1, game: tk1 - tk0 - other, other, moodlets: m.moodlets, emotion: m.emotion, doing, queue: q };
  };
  const verdict = (x, competitive) => {
    const o = x.r.outcome; expect(o, 'no outcome: ' + JSON.stringify(x.r).slice(0, 400));
    const won = x.moodlets.find((mm) => mm.id === 'won-game'), lost = x.moodlets.find((mm) => mm.id === 'lost-close'), want = 12 * (0.6 + 0.8 * competitive);
    if (o.won) { expect(won && near(won.value, want, 0.05) && x.game === 5, `a win: moodlet ${JSON.stringify(won)} (want +${want.toFixed(2)}), tokens ${x.tk0} -> ${x.tk1} (the game's ${x.game}, others ${x.other})`); }
    else { expect(!won && x.game === 0 && (o.close ? !!lost && near(lost.value, -4, 0.05) : !lost), `a loss: ${JSON.stringify(x.moodlets)}, tokens ${x.tk0} -> ${x.tk1} (the game's ${x.game}, others ${x.other}), close ${o.close}`); }
    expect(!x.queue.some((a) => a.action.startsWith('play-')), 'the game action is still queued: ' + JSON.stringify(x.queue));
    return `${o.won ? 'you won' : 'the house won'} (${o.detail}) after ${x.r.yourTurns} of your turns in ${x.r.simMinutes} sim min; ${o.won ? `"Won a game" +${won.value} (12 x (0.6 + 0.8 x ${competitive}) = ${want.toFixed(2)}), tokens ${x.tk0} -> ${x.tk1} (the game's +${x.game}, other earnings +${x.other})` : o.close ? `"Lost a close one" ${lost.value}, no tokens from the game (${x.tk0} -> ${x.tk1}: +${x.other} for the time in the bar)` : 'no moodlet, no tokens from the game'}; emotion ${x.emotion}; while playing, doing ${JSON.stringify(x.doing.fun)}`;
  };
  await check('a pool game completes with a winner, the moodlet and the tokens (your shots by the best pot; the house by the plan\'s selection with its aim error)', async () => {
    await H(page, `window.__onfoot.setTonight(['pool-two', 'darts-win', 'shuffle-three'])`);
    const x = await play('pool-1', 'best', 0.5);
    summary.pool = { outcome: x.r.outcome, log: x.r.state.log, left: x.r.state.left, shots: x.r.state.shots, tokens: [x.tk0, x.tk1] };
    expect(x.doing.fun === 'pool', 'doing ' + JSON.stringify(x.doing));
    return verdict(x, 0.5) + `; ${x.r.state.shots} shots in all; the last: ${x.r.state.log.slice(-3).join(' / ')}`;
  });
  await check('a darts game completes with a winner, the moodlet (scaled by competitive 0.9) and the tokens; "Win a game of darts" pays tonight\'s +5', async () => {
    const x = await play('darts-2', 'best', 0.9);
    const tn = await H(page, 'window.__onfoot.tokens()');
    summary.darts = { outcome: x.r.outcome, left: x.r.state.left, tokens: [x.tk0, x.tk1], tonight: tn.tonight };
    expect(x.doing.fun === 'darts', 'doing ' + JSON.stringify(x.doing));
    const v = verdict(x, 0.9);
    if (x.r.outcome.won) expect(tn.tonight.done.includes('darts-win'), `tonight ${JSON.stringify(tn.tonight)} tokens ${x.tk0} -> ${x.tk1}`);
    return v + `; left at the end ${JSON.stringify(x.r.state.left)}; tonight's three done: ${JSON.stringify(tn.tonight.done)}`;
  });
  await check('a shuffleboard game completes with a winner, the moodlet and the tokens', async () => {
    const x = await play('shuffleboard', 'best', 0.5);
    summary.shuffleboard = { outcome: x.r.outcome, score: x.r.state.score, log: x.r.state.log, tokens: [x.tk0, x.tk1] };
    expect(x.doing.fun === 'shuffleboard', 'doing ' + JSON.stringify(x.doing));
    return verdict(x, 0.5) + `; ${x.r.state.log.join(' / ')}`;
  });
  await check('a close loss: darts down to 20 and then off the board, the house checks out: "Lost a close one" (-4), no tokens', async () => {
    const x = await play('darts-1', 'stall', 0.5);
    summary.closeLoss = { outcome: x.r.outcome, left: x.r.state.left, tokens: [x.tk0, x.tk1], moodlets: x.moodlets };
    expect(x.r.outcome && !x.r.outcome.won && x.r.outcome.close, JSON.stringify(x.r.outcome));
    return verdict(x, 0.5) + `; left ${JSON.stringify(x.r.state.left)}`;
  });
  await check('With all three games set up, breakdown() shows the pieces in the items row\'s meshes, with no other new calls (a fixed camera over the games, the loop frozen)', async () => {
    await clearQueue(page);
    const p0 = await H(page, 'window.__onfoot.pos()');
    const [cx, cz] = await H(page, at(9.0, 3.2)), [tx, tz] = await H(page, at(11.5, 9.5));
    await H(page, `window.__onfoot.camera([${cx}, 4.6, ${cz}, ${tx}, 0.6, ${tz}])`);
    await frames(page, 2);
    await H(page, 'window.__onfoot.freeze(true)');
    await H(page, 'window.__onfoot.piecesOff(true)');
    const a = await H(page, 'window.__onfoot.breakdown()');
    await H(page, 'window.__onfoot.piecesOff(false)');
    const staged = await H(page, 'window.__onfoot.stageGames()');
    await H(page, `window.__onfoot.go(${p0.x}, ${p0.z})`);
    await H(page, 'window.__onfoot.piecesOff(false)');
    const b = await H(page, 'window.__onfoot.breakdown()'), it = await H(page, 'window.__onfoot.items()');
    await H(page, 'window.__onfoot.freeze(false)'); await H(page, 'window.__onfoot.camera(null)');
    // rows by group and name, summed (several meshes share a name: the staff's lod1, the sky's Mesh)
    const agg = (rows) => { const m = new Map(); for (const r of rows) { const k = `${r.group}|${r.name}`, o = m.get(k) ?? { group: r.group, name: r.name, calls: 0, tris: 0, n: 0 }; o.calls += r.calls; o.tris += r.tris; o.n++; m.set(k, o); } return m; };
    const ma = agg(a.rows), mb = agg(b.rows), keys = new Set([...ma.keys(), ...mb.keys()]);
    const notItems = [...keys].filter((k) => { const x = ma.get(k), y = mb.get(k); return (!x || !y || x.calls !== y.calls || x.tris !== y.tris) && (x ?? y).group !== 'items'; }).map((k) => ({ k, before: ma.get(k) ?? null, after: mb.get(k) ?? null }));
    const items = b.groups.items ?? { calls: 0, tris: 0 }, itemRows = b.rows.filter((r) => r.group === 'items');
    summary.pieces = { base: a.total, with: b.total, items, itemRows, counts: staged.counts, notItems };
    expect(!notItems.length, 'other rows changed: ' + JSON.stringify(notItems).slice(0, 600));
    expect(itemRows.every((r) => r.name.startsWith('items-') && r.calls === 1) && items.calls <= 6, JSON.stringify(itemRows));
    const per = it.perInstance, over = Object.keys(per).filter((k) => per[k] > it.alloc[k]);
    expect(!over.length, 'per instance over the row: ' + JSON.stringify(per));
    return `without pieces ${a.total.calls} calls/${fmt(a.total.tris)}, with the three games set up ${b.total.calls}/${fmt(b.total.tris)}: the difference is all in the items meshes (${itemRows.map((r) => `${r.name} ${r.n} x ${per[r.name.slice(6)]} = ${fmt(r.tris)}`).join(', ')}; the items row ${items.calls} calls, ${fmt(items.tris)}); instances ${JSON.stringify(staged.counts)}`;
  });
  await check('The game cameras return to your view after each turn (first person; the move takes about 0.5 s), and cut with reduced motion', async () => {
    const out = [];
    for (const [id, play] of [['pool-2', `window.__onfoot.shoot('pool-2', { speed: 0.6, angle: -90, settle: true })`], ['darts-3', `(() => { const o = window.__onfoot; for (const s of [20, 20, 20]) o.shoot('darts-3', { seg: s, mult: 1, settle: true }); return o.game('darts-3'); })()`], ['shuffleboard', `window.__onfoot.shoot('shuffleboard', { zone: 2, settle: true })`]]) {
      await clearQueue(page);
      await H(page, 'window.__onfoot.view("first")');
      await H(page, `window.__onfoot.playHere('${id}')`); await H(page, 'window.__onfoot.fastForward(0.01)');
      const inn = await blendTo(page, 1);
      const r = await H(page, play);
      // the turn passes (the pause after it runs in sim time), then the camera comes back to you
      for (let i = 0; i < 20 && (await H(page, `window.__onfoot.game('${id}')`)).yourTurn; i++) await H(page, 'window.__onfoot.fastForward(0.02)');
      await H(page, 'window.__onfoot.fastForward(0.05)');
      const back = await blendTo(page, 0);
      await frames(page, 1);
      const cam = await H(page, 'window.__onfoot.camera()'), p = await H(page, 'window.__onfoot.pos()'), g = await H(page, `window.__onfoot.game('${id}')`);
      const d = Math.hypot(cam.p.x - p.x, cam.p.z - p.z);
      expect(inn.mode === (id.startsWith('pool') ? 'pool' : id.startsWith('darts') ? 'darts' : 'shuffleboard') && back.blend === 0 && !back.camOn && d < 0.25, JSON.stringify({ inn, back, d, cam, p, r: r?.ok }));
      expect(inn.frames >= 3 && back.lastReturnFrames >= 3, `the move took ${inn.frames} and ${back.lastReturnFrames} frames (want a 0.5 s move)`);
      out.push(`${id}: in over ${inn.lastEnterFrames} frames, back over ${back.lastReturnFrames} (turn ${g.turn}), the camera ${d.toFixed(3)} m from your eye`);
      await H(page, 'window.__onfoot.leaveGame()');
      await blendTo(page, 0);
    }
    // reduced motion: a cut each way (the blend jumps in the frame the turn starts and ends)
    await H(page, 'window.__onfoot.reducedMotion(true)');
    await clearQueue(page);
    await H(page, `window.__onfoot.playHere('pool-1')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await frames(page, 1);
    const c1 = await H(page, 'window.__onfoot.gamecam()');
    await H(page, `window.__onfoot.shoot('pool-1', { speed: 0.6, angle: -90, settle: true })`);
    for (let i = 0; i < 20 && (await H(page, `window.__onfoot.game('pool-1')`)).yourTurn; i++) await H(page, 'window.__onfoot.fastForward(0.02)');
    await H(page, 'window.__onfoot.fastForward(0.05)');
    await frames(page, 1);
    const c2 = await H(page, 'window.__onfoot.gamecam()');
    await H(page, 'window.__onfoot.reducedMotion(false)'); await H(page, 'window.__onfoot.leaveGame()');
    expect(c1.blend === 1 && c1.lastEnterFrames === 0 && c2.blend === 0 && c2.cuts >= 2, JSON.stringify({ c1, c2 }));
    summary.cams = { out, c1, c2 };
    return out.join('; ') + `; reduced motion: the blend 1 on the first frame of the turn and 0 on the first frame after (${c2.cuts} cuts)`;
  });
  // ---- S2b's repair: ball in hand for you, the scripted shot's refusals, the toasts and the chip, the bar's rebuilds,
  //      your avatar hidden under the pool view
  /** a pool game where the house scratches (its shot scripted by the hook): returns your turn's state, ball in hand */
  const toBallInHand = async (id) => {
    await clearQueue(page);
    await H(page, `window.__onfoot.playHere('${id}')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await frames(page, 1);
    // your break, soft: the cue ball to the head rail, nothing down; the house's next shot is scripted to scratch
    const r0 = await H(page, `window.__onfoot.shoot('${id}', { angle: -90, speed: 0.6, settle: true })`);
    await frames(page, 1);
    const boxes = await H(page, 'window.__onfoot.hudBoxes()');
    await H(page, `window.__onfoot.houseShot('${id}', 'scratch')`);
    let g = null;
    for (let i = 0; i < 80; i++) { g = await H(page, `window.__onfoot.game('${id}')`); if (g.yourTurn) break; await H(page, 'window.__onfoot.fastForward(0.02)'); }
    return { r0, g, boxes };
  };
  await check('pool, ball in hand: after the house scratches, your cue ball starts on the head spot and stays in hand; the hook\'s place puts it off the head spot and the shot leaves from there; the hint says so', async () => {
    const { g, r0 } = await toBallInHand('pool-1');
    expect(r0.ok && g.yourTurn && g.ballInHand && g.last?.scratch && g.last.side === 1, JSON.stringify({ r0: { ok: r0.ok, last: r0.last }, g: { yourTurn: g.yourTurn, ballInHand: g.ballInHand, last: g.last, cue: g.cue, log: g.log } }).slice(0, 900));
    expect(Math.hypot(g.cue[0] - 0, g.cue[1] + 0.495) < 0.08, 'the cue ball is not on the head spot: ' + JSON.stringify(g.cue));
    await frames(page, 1);
    const hint = await H(page, `document.getElementById('gameHint').textContent`);
    expect(/Ball in hand/.test(hint), 'the hint: ' + hint);
    const r = await H(page, `window.__onfoot.shoot('pool-1', { place: [0.3, -0.25], angle: 90, speed: 1.0, settle: true })`);
    const g2 = await H(page, `window.__onfoot.game('pool-1')`);
    summary.ballInHand = { houseLog: g.log.slice(-3), startCue: g.cue, hint, shot: { from: r.from, ballInHand: r.ballInHand, last: r.last }, after: { ballInHand: g2.ballInHand, shots: g2.shots } };
    expect(r.ok && r.ballInHand && near(r.from[0], 0.3, 1e-3) && near(r.from[1], -0.25, 1e-3) && !g2.ballInHand && g2.shots === g.shots + 1, JSON.stringify({ r, g2: { ballInHand: g2.ballInHand, shots: g2.shots } }).slice(0, 900));
    await H(page, 'window.__onfoot.leaveGame()');
    return `the house: "${g.log.slice(-1)[0]}"; your turn: ball in hand, the cue ball at (${g.cue.join(', ')}) (the head spot is (0, -0.495)); hint "${hint}"; shoot with place [0.3, -0.25]: struck from (${r.from.join(', ')}), ${r.last.potted.length ? 'potted ' + r.last.potted.join(', ') : 'nothing down'}; ball in hand after the shot: ${g2.ballInHand}`;
  });
  await check('the scripted shots refuse a NaN, infinite, zero or negative speed, a NaN angle, a place without ball in hand, and darts and shuffleboard values that aren\'t numbers (nothing is clamped, nothing moves)', async () => {
    await clearQueue(page);
    await H(page, `window.__onfoot.playHere('pool-2')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    const g0 = await H(page, `window.__onfoot.game('pool-2')`);
    const pool = await H(page, `(() => { const o = window.__onfoot; return [o.shoot('pool-2', { angle: NaN, speed: 1 }), o.shoot('pool-2', { angle: 10, speed: NaN }), o.shoot('pool-2', { angle: 10, speed: Infinity }), o.shoot('pool-2', { angle: 10, speed: 0 }), o.shoot('pool-2', { angle: 10, speed: -2 }), o.shoot('pool-2', { place: [0.1, -0.3], angle: 10, speed: 1 })]; })()`);
    const g1 = await H(page, `window.__onfoot.game('pool-2')`);
    await H(page, 'window.__onfoot.leaveGame()');
    await H(page, `window.__onfoot.playHere('darts-3')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    const darts = await H(page, `(() => { const o = window.__onfoot; return [o.shoot('darts-3', { x: NaN, y: 0 }), o.shoot('darts-3', { seg: 20, mult: 1, held: -1 })]; })()`);
    const d1 = await H(page, `window.__onfoot.game('darts-3')`);
    await H(page, 'window.__onfoot.leaveGame()');
    await H(page, `window.__onfoot.playHere('shuffleboard')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    const shuf = await H(page, `(() => { const o = window.__onfoot; return [o.shoot('shuffleboard', { speed: NaN }), o.shoot('shuffleboard', { speed: -3 }), o.shoot('shuffleboard', { speed: 3, line: Infinity }), o.shoot('shuffleboard', { zone: 7 })]; })()`);
    const s1 = await H(page, `window.__onfoot.game('shuffleboard')`);
    await H(page, 'window.__onfoot.leaveGame()');
    const all = [...pool, ...darts, ...shuf];
    expect(all.every((r) => r.ok === false) && g1.shots === g0.shots && g1.state === 'aim' && d1.thrown === 0 && d1.flying === 0 && s1.thrown === 0 && s1.state === 'aim', JSON.stringify({ all, g1: { shots: g1.shots, state: g1.state }, d1: { thrown: d1.thrown, flying: d1.flying }, s1: { thrown: s1.thrown, state: s1.state } }).slice(0, 900));
    return `${all.length} refused: ` + all.map((r) => r.why).join(' | ');
  });
  await check('the toasts never cover the "Simulated crowd" chip at 844x390: a game\'s toast sits just above its bar; other toasts sit under the top centre column', async () => {
    const { boxes } = await toBallInHand('pool-2');
    const gb = await H(page, 'window.__onfoot.gamebar()');
    await H(page, 'window.__onfoot.leaveGame()');
    await frames(page, 1);
    const out = await H(page, 'window.__onfoot.hudBoxes()');
    summary.toasts844 = { inGame: boxes, gaming: gb, afterLeave: out };
    const t = boxes.toast, c = boxes.crowd, b = boxes.gamebar, t2 = out.toast;
    expect(t.shown && !boxes.overlap && t.y + t.h <= b.y + 1, 'in the game: ' + JSON.stringify(boxes));
    expect(t2.shown && !out.overlap && t2.y >= c.y + c.h, 'after leaving: ' + JSON.stringify(out));
    return `in a game, "${boxes.toastText}" at y ${t.y} to ${t.y + t.h} (the bar from ${b.y}; the chip at y ${c.y} to ${c.y + c.h}): no overlap; after leaving, "${out.toastText}" at y ${t2.y} to ${t2.y + t2.h}, under the chip (${c.y + c.h})`;
  });
  await check('the game bar\'s text is rebuilt only when the game changes (not every frame), and your avatar is hidden under the pool view but shown over your shoulder at darts', async () => {
    await clearQueue(page);
    await H(page, 'window.__onfoot.view("third")');
    await H(page, `window.__onfoot.playHere('pool-1')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await blendTo(page, 1, 60, 'pool'); await frames(page, 1);
    const a = await H(page, 'window.__onfoot.gamebar()');
    await frames(page, 4);
    const b = await H(page, 'window.__onfoot.gamebar()');
    const visPool = (await H(page, 'window.__onfoot.vis()')).avatar, camPool = await H(page, 'window.__onfoot.gamecam()');
    await H(page, `window.__onfoot.shoot('pool-1', { angle: -90, speed: 0.6, settle: true })`);
    await frames(page, 1);
    const c = await H(page, 'window.__onfoot.gamebar()');
    await H(page, 'window.__onfoot.leaveGame()');
    await H(page, `window.__onfoot.playHere('darts-1')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await blendTo(page, 1, 60, 'darts'); await frames(page, 1);
    const visDarts = (await H(page, 'window.__onfoot.vis()')).avatar, camDarts = await H(page, 'window.__onfoot.gamecam()');
    await H(page, 'window.__onfoot.leaveGame()'); await H(page, 'window.__onfoot.view("first")');
    summary.barAndAvatar = { a, b, c, visPool, visDarts };
    expect(b.builds === a.builds && c.builds > b.builds, JSON.stringify({ a, b, c }));
    expect(camPool.shown === 'pool' && visPool.caster && visPool.caster.visible === false && camDarts.shown === 'darts' && visDarts.caster && visDarts.caster.visible === true, JSON.stringify({ camPool, visPool, camDarts, visDarts }));
    return `the bar rebuilt ${a.builds} times so far; over 4 frames of your turn, ${b.builds - a.builds} more; after a shot, ${c.builds - b.builds} more (version ${b.ver} to ${c.ver}); third person at Low: in the pool view your avatar drawn ${visPool.caster.visible}; in the darts view drawn ${visDarts.caster.visible}`;
  });
  await check('each game clip plays on a person built at each LOD, and git diff on people/ is still empty', async () => {
    const st = execFileSync('git', ['status', '--porcelain', '--', 'src/onfoot/people'], { cwd: ROOT, encoding: 'utf8' }) + execFileSync('git', ['diff', '--stat', 'HEAD', '--', 'src/onfoot/people'], { cwd: ROOT, encoding: 'utf8' });
    expect(!st.trim(), st);
    const r = await H(page, 'window.__onfoot.clipTest()');
    const bad = [], games = ['pool-stance', 'pool-shot', 'dart-throw', 'shuffle-slide'];
    for (const lv of r) for (const p of lv.probes) if (!(p.weight > 0.9 && Math.max(p.armR, p.chest, p.hips) > 0.05 && p.bones >= 16)) bad.push(`LOD ${lv.lod} ${p.clip} ${JSON.stringify(p)}`);
    const missing = games.filter((g) => !r.every((lv) => lv.probes.some((p) => p.clip === g)));
    summary.clips = r;
    expect(!bad.length && !missing.length, bad.join('; ') + ' missing ' + missing.join(','));
    return `git: clean; ` + r.map((lv) => `LOD ${lv.lod} (${fmt(lv.tris)} tris): ` + lv.probes.filter((p) => games.includes(p.clip)).map((p) => `${p.clip} weight ${p.weight}, arm ${p.armR}, chest ${p.chest}, hips ${p.hips}`).join('; ')).join(' | ');
  });
  await check('checks: no console errors after the run', async () => { expect(!errors.length, errors.slice(0, 5).join(' | ')); return 'clean'; });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ your controls, by pointer
if (want('controls')) {
  console.log('controls: 1280x720, Low, Saturday 21:00 (the loop frozen during each gesture, so the pointer events are quick)');
  const { ctx, page, errors } = await open([1280, 720], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)');
  await check('controls: pool, drag back from the cue ball sets the aim and the power (the meter shows), release shoots', async () => {
    expect(!errors.length, errors.join(' | '));
    await clearQueue(page); await H(page, `window.__onfoot.playHere('pool-2')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await blendTo(page, 1);
    const g0 = await H(page, `window.__onfoot.game('pool-2')`), s = await H(page, `window.__onfoot.gameScreen('pool-2')`);
    await H(page, 'window.__onfoot.freeze(true)');
    await page.mouse.move(s.x, s.y); await page.mouse.down();
    for (let k = 1; k <= 6; k++) await page.mouse.move(s.x - 14 * k, s.y + 4 * k);
    // a frame while you hold: the power meter shows
    await H(page, 'window.__onfoot.freeze(false)'); await frames(page, 1); await H(page, 'window.__onfoot.freeze(true)');
    const mid = await H(page, `window.__onfoot.game('pool-2')`), meter = await H(page, `(() => { const e = document.getElementById('gamePower'); return { on: e.classList.contains('on'), p: e.style.getPropertyValue('--p') }; })()`);
    await page.mouse.up();
    const g1 = await H(page, `window.__onfoot.game('pool-2')`);
    await H(page, 'window.__onfoot.freeze(false)');
    expect(mid.aim.power > 0.05 && meter.on && g1.shots === g0.shots + 1, JSON.stringify({ mid: mid.aim, meter, shots: [g0.shots, g1.shots], state: g1.state }));
    await H(page, 'window.__onfoot.leaveGame()');
    return `the cue ball at (${s.x.toFixed(0)}, ${s.y.toFixed(0)}) px; dragged 91 px back: aim ${mid.aim.angle} degrees, power ${mid.aim.power} (meter ${meter.p}); released: shot ${g1.shots}, ${g1.state}`;
  });
  await check('controls: darts, hold (the aim steadies) and flick up to throw; a press without a flick throws nothing', async () => {
    await clearQueue(page); await H(page, `window.__onfoot.playHere('darts-1')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await blendTo(page, 1);
    const s = await H(page, `window.__onfoot.gameScreen('darts-1')`);
    await H(page, 'window.__onfoot.freeze(true)');
    // a press and a slow release: no throw
    await gesture(page, [['pointerdown', s.x, s.y + 120, 0], ['pointermove', s.x + 3, s.y + 118, 300], ['pointerup', s.x + 3, s.y + 118, 300]]);
    const g0 = await H(page, `window.__onfoot.game('darts-1')`);
    // hold for 1.2 s (a slow drag of 10 px on the way moves the aim 4 mm), then flick up: 240 px in 64 ms
    const ev = await gesture(page, [['pointerdown', s.x, s.y + 120, 0], ['pointermove', s.x + 10, s.y + 120, 500], ['pointermove', s.x + 10, s.y + 120, 700], ['pointermove', s.x + 10, s.y + 60, 16], ['pointermove', s.x + 10, s.y, 16], ['pointermove', s.x + 10, s.y - 60, 16], ['pointermove', s.x + 10, s.y - 120, 16], ['pointerup', s.x + 10, s.y - 120, 0]]);
    await H(page, 'window.__onfoot.freeze(false)');
    await H(page, 'window.__onfoot.fastForward(0.02)');
    const g1 = await H(page, `window.__onfoot.game('darts-1')`);
    expect(g0.thrown === 0 && g1.thrown === 1, JSON.stringify({ g0: g0.thrown, ev, g1: { thrown: g1.thrown, board: g1.board, left: g1.left, aim: g1.aim } }));
    await H(page, 'window.__onfoot.leaveGame()');
    return `no flick: ${g0.thrown} darts; after a 1.2 s hold and a flick up: ${g1.thrown} dart, ${g1.board.map((d) => d.label).join(', ')} (${g1.left[0]} left), the aim at (${g1.aim.x}, ${g1.aim.y}) m (it starts on the treble 20's middle, (0, 0.103); the two slow drags, 13 px in all, moved it ${(g1.aim.x * 1000).toFixed(1)} mm right)`;
  });
  await check('controls: shuffleboard, a swipe up slides the puck (the swipe\'s speed sets the puck\'s)', async () => {
    await clearQueue(page); await H(page, `window.__onfoot.playHere('shuffleboard')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await blendTo(page, 1);
    const g0 = await H(page, `window.__onfoot.game('shuffleboard')`);
    await H(page, 'window.__onfoot.freeze(true)');
    // 360 px of 720 in 0.2 s: 2.5 screen heights a second, so 3.0 m/s
    await gesture(page, [['pointerdown', 640, 620, 0], ['pointermove', 640, 548, 40], ['pointermove', 640, 476, 40], ['pointermove', 640, 404, 40], ['pointermove', 640, 332, 40], ['pointermove', 640, 260, 40], ['pointerup', 640, 260, 0]]);
    await H(page, 'window.__onfoot.freeze(false)');
    const g1 = await H(page, `window.__onfoot.game('shuffleboard')`);
    const sp = await H(page, `window.__onfoot.lastSlide()`);
    await H(page, 'window.__onfoot.fastForward(0.15)');
    const g2 = await H(page, `window.__onfoot.game('shuffleboard')`);
    expect(g0.thrown === 0 && g1.thrown === 1 && sp > 2.4 && sp < 3.6, JSON.stringify({ g0: g0.thrown, g1: g1.thrown, speed: sp, pucks: g2.pucks }));
    await H(page, 'window.__onfoot.leaveGame()');
    const pk = g2.pucks[0] ?? null;
    return `a swipe of 360 px in 0.2 s (2.5 screen heights a second): the puck left at ${sp.toFixed(2)} m/s and came to rest ${pk ? (pk.on ? `at ${pk.x} m (zone ${pk.zone})` : pk.out) : '(the frame moved on)'}`;
  });
  await check('controls: pool ball in hand by pointer: after the house scratches, a drag that starts on the cue ball moves it off the head spot; a drag back from it then aims and shoots from there', async () => {
    await clearQueue(page);
    await H(page, `window.__onfoot.playHere('pool-2')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await H(page, `window.__onfoot.shoot('pool-2', { angle: -90, speed: 0.6, settle: true })`);
    await H(page, `window.__onfoot.houseShot('pool-2', 'scratch')`);
    let g = null;
    for (let i = 0; i < 80; i++) { g = await H(page, `window.__onfoot.game('pool-2')`); if (g.yourTurn) break; await H(page, 'window.__onfoot.fastForward(0.02)'); }
    await blendTo(page, 1);
    expect(g.yourTurn && g.ballInHand, JSON.stringify({ yourTurn: g.yourTurn, ballInHand: g.ballInHand, last: g.last }));
    const s0 = await H(page, `window.__onfoot.gameScreen('pool-2')`);
    await H(page, 'window.__onfoot.freeze(true)');
    // the drag that places: from the cue ball 180 px across the screen and 50 px up
    await page.mouse.move(s0.x, s0.y); await page.mouse.down();
    for (let k = 1; k <= 6; k++) await page.mouse.move(s0.x + 30 * k, s0.y - 8.3 * k);
    await page.mouse.up();
    const g1 = await H(page, `window.__onfoot.game('pool-2')`);
    const s1 = await H(page, `window.__onfoot.gameScreen('pool-2')`);
    // the drag that aims: it starts 90 px left of the cue ball's new place (off the ball) and pulls back further left
    await page.mouse.move(s1.x - 90, s1.y); await page.mouse.down();
    for (let k = 1; k <= 6; k++) await page.mouse.move(s1.x - 90 - 16 * k, s1.y + 2 * k);
    await page.mouse.up();
    const g2 = await H(page, `window.__onfoot.game('pool-2')`);
    await H(page, 'window.__onfoot.freeze(false)');
    const moved = Math.hypot(g1.cue[0] - g.cue[0], g1.cue[1] - g.cue[1]);
    summary.ballInHandPointer = { before: g.cue, placed: g1.cue, screen: [s0, s1], struck: g2.strikeFrom, shots: [g.shots, g2.shots], aim: g2.aim };
    expect(g1.ballInHand && moved > 0.15 && g2.shots === g.shots + 1 && Math.hypot(g2.strikeFrom[0] - g1.cue[0], g2.strikeFrom[1] - g1.cue[1]) < 1e-3 && !g2.ballInHand, JSON.stringify(summary.ballInHandPointer));
    await H(page, 'window.__onfoot.leaveGame()');
    return `ball in hand on the head spot (${g.cue.join(', ')}); a 190 px drag from the cue ball at (${s0.x.toFixed(0)}, ${s0.y.toFixed(0)}) px put it at (${g1.cue.join(', ')}), ${moved.toFixed(3)} m away, still in hand; a drag back from it: shot ${g2.shots} struck from (${g2.strikeFrom.join(', ')}) at ${g2.aim.angle} degrees`;
  });
  await check('controls: shuffleboard, a swipe that drifts right sends the puck to the right of the board as you see it (the line +, the bed\'s +y on the right of the screen)', async () => {
    await clearQueue(page); await H(page, `window.__onfoot.playHere('shuffleboard')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await blendTo(page, 1);
    await H(page, 'window.__onfoot.freeze(true)');
    // 360 px up in 0.2 s, drifting 20 px right
    await gesture(page, [['pointerdown', 640, 620, 0], ['pointermove', 644, 548, 40], ['pointermove', 648, 476, 40], ['pointermove', 652, 404, 40], ['pointermove', 656, 332, 40], ['pointermove', 660, 260, 40], ['pointerup', 660, 260, 0]]);
    await H(page, 'window.__onfoot.freeze(false)');
    const ln = await H(page, 'window.__onfoot.lastLine()');
    const centre = await H(page, `window.__onfoot.gameScreen('shuffleboard', [5.6, 0])`), plusY = await H(page, `window.__onfoot.gameScreen('shuffleboard', [5.6, 0.15])`);
    await H(page, 'window.__onfoot.fastForward(0.15)');
    const g = await H(page, `window.__onfoot.game('shuffleboard')`);
    await H(page, 'window.__onfoot.leaveGame()');
    const pk = g.pucks?.[0] ?? null;
    summary.shuffleLine = { ln, centre, plusY, puck: pk };
    expect(ln && ln.line > 0 && plusY.x > centre.x + 5 && (!pk || !pk.on || pk.y > 0), JSON.stringify(summary.shuffleLine));
    return `the line ${ln.line} degrees (side ${ln.side}); on screen the bed's centre line at 5.6 m is at x ${centre.x.toFixed(0)} px and 0.15 m toward +y at x ${plusY.x.toFixed(0)} px (to the right); the puck ${pk ? (pk.on ? `came to rest at y ${pk.y} m (zone ${pk.zone})` : pk.out) : '(the frame moved on)'}`;
  });
  await check('controls: at 1280x720 a game\'s toast sits above its bar, clear of the "Simulated crowd" chip', async () => {
    await clearQueue(page); await H(page, `window.__onfoot.playHere('darts-2')`); await H(page, 'window.__onfoot.fastForward(0.01)');
    await blendTo(page, 1);
    await H(page, `window.__onfoot.shoot('darts-2', { seg: 20, mult: 1, settle: true })`);
    await frames(page, 1);
    const boxes = await H(page, 'window.__onfoot.hudBoxes()');
    await H(page, 'window.__onfoot.leaveGame()');
    await frames(page, 1);
    const out = await H(page, 'window.__onfoot.hudBoxes()');
    summary.toasts1280 = { inGame: boxes, afterLeave: out };
    const t = boxes.toast, c = boxes.crowd, b = boxes.gamebar, t2 = out.toast;
    expect(t.shown && !boxes.overlap && t.y + t.h <= b.y + 1 && t2.shown && !out.overlap && t2.y >= c.y + c.h, JSON.stringify(summary.toasts1280));
    return `in a game, "${boxes.toastText}" at y ${t.y} to ${t.y + t.h} (the bar from ${b.y}); after leaving, "${out.toastText}" at y ${t2.y} to ${t2.y + t2.h}; the chip at y ${c.y} to ${c.y + c.h}: no overlap either time`;
  });
  await check('controls: no console errors', async () => { expect(!errors.length, errors.slice(0, 5).join(' | ')); });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the screenshots
if (want('shots')) {
  for (const [w, h, q] of [[844, 390, 'low'], [1280, 720, 'high']]) {
    console.log(`shots: ${w}x${h}, ${q}, Saturday 21:00`);
    const { ctx, page, errors } = await open([w, h], `quality=${q}&day=Sat&hour=21&hint=0`, w < 1000);
    await H(page, 'window.__onfoot.setWeek(43)');
    await check(`shots ${w}x${h} ${q}: a pool shot overhead (your aim with the guide line and the power, then the break rolling)`, async () => {
      expect(!errors.length, errors.join(' | '));
      await clearQueue(page); await H(page, `window.__onfoot.playHere('pool-1')`); await H(page, 'window.__onfoot.fastForward(0.01)');
      await blendTo(page, 1);
      await H(page, `window.__onfoot.gameAim('pool-1', 92, 0.55)`);
      await frames(page, 2);
      const a = await shot(page, png(`s2b-pool-aim-${w}x${h}`));
      await H(page, `window.__onfoot.shoot('pool-1', { break: true })`);
      await frames(page, 6);
      const b = await shot(page, png(`s2b-pool-shot-${w}x${h}`));
      const g = await H(page, `window.__onfoot.game('pool-1')`);
      const av = (await H(page, 'window.__onfoot.vis()')).avatar, cam = await H(page, 'window.__onfoot.gamecam()');
      // your avatar under the pool view: not drawn (Low), or only a hidden caster (HD and Ultra)
      expect(cam.shown === 'pool' && av.caster && (av.caster.visible === false || av.caster.hidden === true), 'your avatar is drawn in the pool view: ' + JSON.stringify({ cam, av }));
      return `${a}, ${b} (${g.state}, ${g.balls.filter((x) => x.moving).length} balls moving; your avatar in the pool view: ${av.caster.visible ? (av.caster.hidden ? 'a hidden caster only' : 'drawn') : 'not drawn'})`;
    });
    await check(`shots ${w}x${h} ${q}: darts behind the oche (two darts in the board, the aim held, a third in the air)`, async () => {
      await clearQueue(page); await H(page, `window.__onfoot.playHere('darts-2')`); await H(page, 'window.__onfoot.fastForward(0.01)');
      await blendTo(page, 1);
      await H(page, `(() => { const o = window.__onfoot; o.shoot('darts-2', { seg: 20, mult: 3, settle: true }); o.shoot('darts-2', { seg: 20, mult: 1, settle: true }); return o.gameAim('darts-2', 0.004, 0.103, true); })()`);
      await frames(page, 3);
      const a = await shot(page, png(`s2b-darts-oche-${w}x${h}`));
      // the third dart: a frame here (0.5 to 3 s) is longer than the whole 0.44 s throw, so the hook holds the dart at
      // 12% of its flight (just out of your hand, off the board's face as the camera sees it) once its 0.12 s wind-up
      // has passed; the screenshot is taken while it's held, and the check fails if no dart is in the air then
      await H(page, `window.__onfoot.holdDart('darts-2', 0.12)`);
      await H(page, `window.__onfoot.shoot('darts-2', { seg: 1, mult: 1 })`);
      let f = null;
      for (let i = 0; i < 12; i++) { await frames(page, 1); f = await H(page, `window.__onfoot.game('darts-2')`); if (f.inAir >= 1 && f.flights[0].k >= 0.1) break; }
      const b = await shot(page, png(`s2b-darts-throw-${w}x${h}`));
      const g = await H(page, `window.__onfoot.game('darts-2')`);
      const boxes = await H(page, 'window.__onfoot.hudBoxes()');
      await H(page, `window.__onfoot.holdDart('darts-2', null)`);
      expect(g.inAir >= 1, `no dart in the air at the screenshot: ${JSON.stringify({ flying: g.flying, inAir: g.inAir, flights: g.flights })}`);
      expect(!boxes.overlap, 'the toast covers the crowd chip: ' + JSON.stringify(boxes));
      return `${a}, ${b} (in the board ${g.board.map((d) => d.label).join(', ')}; ${g.left[0]} left; ${g.inAir} in the air at ${Math.round(g.flights[0].k * 100)}% of its flight, held by the hook; the toast "${boxes.toastText}" ${boxes.toast.shown ? `at y ${boxes.toast.y} to ${boxes.toast.y + boxes.toast.h}, the chip at y ${boxes.crowd.y} to ${boxes.crowd.y + boxes.crowd.h}: no overlap` : 'not showing'})`;
    });
    await check(`shots ${w}x${h} ${q}: a shuffleboard slide (behind the puck)`, async () => {
      await clearQueue(page); await H(page, `window.__onfoot.playHere('shuffleboard')`); await H(page, 'window.__onfoot.fastForward(0.01)');
      await blendTo(page, 1);
      // a few pucks down first (yours and the house's), then your slide, caught on its way
      await H(page, `window.__onfoot.shoot('shuffleboard', { zone: 2, settle: true })`);
      for (let i = 0; i < 40 && !(await H(page, `window.__onfoot.game('shuffleboard')`)).yourTurn; i++) await H(page, 'window.__onfoot.fastForward(0.05)');
      await blendTo(page, 1);
      await H(page, `window.__onfoot.shoot('shuffleboard', { speed: 3.0, line: 0.3 })`);
      await frames(page, 7);
      const a = await shot(page, png(`s2b-shuffle-slide-${w}x${h}`));
      const g = await H(page, `window.__onfoot.game('shuffleboard')`);
      // the house's slide, then yours run to rest at once: the camera, following your puck, stays over it through the
      // pause after (0.7 s), with the zones' lines and numbers just ahead
      for (let i = 0; i < 40 && !(await H(page, `window.__onfoot.game('shuffleboard')`)).yourTurn; i++) await H(page, 'window.__onfoot.fastForward(0.05)');
      await blendTo(page, 1);
      const r = await H(page, `window.__onfoot.shoot('shuffleboard', { speed: 3.02, line: -0.4, settle: true })`);
      await frames(page, 1);
      const b = await shot(page, png(`s2b-shuffle-rest-${w}x${h}`));
      const g2 = await H(page, `window.__onfoot.game('shuffleboard')`), cam = await H(page, 'window.__onfoot.camera()');
      return `${a} (${g.state}; pucks ${g.pucks.map((p) => `${p.side ? 'house' : 'you'} ${p.on ? p.x : p.out}`).join(', ')}); ${b} (your puck at rest at ${r.puck?.x} m, zone ${g2.pucks[g2.pucks.length - 1]?.zone}, the pause ${g2.hold} s left; the camera at game (${cam.p.x}, ${cam.p.y}, ${cam.p.z}))`;
    });
    await check(`shots ${w}x${h}: no console errors`, async () => { await H(page, 'window.__onfoot.leaveGame()'); expect(!errors.length, errors.slice(0, 5).join(' | ')); });
    await ctx.close().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ the game clips, looked at
if (want('clipshots')) {
  console.log('clipshots: 960x720, Low, Saturday 12:00, third person, a fixed camera beside your avatar, the HUD hidden');
  const { ctx, page, errors } = await open([960, 720], 'quality=low&day=Sat&hour=12&hint=0');
  await H(page, `document.getElementById('hud').hidden = true`);
  await check('clipshots: each game clip on your avatar (pool stance, pool shot, dart throw, shuffleboard slide), seen from the side', async () => {
    expect(!errors.length, errors.join(' | '));
    const [x, z] = await H(page, at(32.6, 4.75)); await H(page, `window.__onfoot.go(${x}, ${z})`); await H(page, 'window.__onfoot.view("third")');
    const p = await H(page, 'window.__onfoot.pos()'), [tx, tz] = await H(page, at(32.6, 9.0));
    await H(page, `window.__onfoot.look(${(Math.atan2(tx - p.x, tz - p.z) * 180) / Math.PI}, 0)`);
    const [cx, cz] = await H(page, at(29.9, 4.4));
    await H(page, `window.__onfoot.camera([${cx}, 1.3, ${cz}, ${p.x}, 0.95, ${p.z}])`);
    const out = [];
    for (const [c, sec] of [['pool-stance', 40], ['pool-shot', 40], ['dart-throw', 40], ['shuffle-slide', 40]]) {
      // the timed clips are caught in their swing: played with a long duration so the frames land mid-move
      await H(page, `window.__onfoot.clipYou('${c}', ${sec})`); await frames(page, 2);
      out.push(await shot(page, png(`s2b-clip-${c}`)));
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
  console.log('budgets at 844x390: the three games set up (the pieces in play), then every item model at its cap');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await check('budgets: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await H(page, 'window.__onfoot.setWeek(43)');
  for (const q of PRESETS) {
    await H(page, `window.__onfoot.setQuality('${q}')`);
    for (const pose of ['door', 'tv-east', 'stall', 'patio', 'overhead']) {
      await check(`budgets ${q} ${pose}: the pass with the games set up within the sums' column; the items in play and at their caps within their row; less people and items within the "without people or items" row`, async () => {
        // the games set up first (it moves you to the tables), then the pose (you walk away: the pieces stay where they are)
        await H(page, 'window.__onfoot.itemsAtCap(false)');
        await H(page, 'window.__onfoot.stageGames()');
        const r = await H(page, `window.__onfoot.pose('${pose}')`);
        await frames(page, 2);
        await H(page, 'window.__onfoot.freeze(true)');
        await H(page, 'window.__onfoot.piecesOff(false)');
        const gc = await H(page, 'window.__onfoot.gamecam()');
        expect(!gc.camOn, 'a game view is on at the pose: ' + JSON.stringify(gc));
        const s = await H(page, 'window.__onfoot.stats()'), b = await H(page, 'window.__onfoot.breakdown()'), bud = await H(page, 'window.__onfoot.budget()');
        const inPlay = b.groups.items ?? { calls: 0, tris: 0 }, counts = (await H(page, 'window.__onfoot.items()')).counts;
        // every model at its cap: the pass as the sums count it (the pass in play, its items swapped for the capped ones)
        await H(page, 'window.__onfoot.itemsAtCap(true)');
        const b2 = await H(page, 'window.__onfoot.breakdown()'), cap = b2.groups.items ?? { calls: 0, tris: 0 };
        await H(page, 'window.__onfoot.itemsAtCap(false)'); await H(page, 'window.__onfoot.freeze(false)');
        const g = (k) => b.groups[k] ?? { calls: 0, tris: 0 };
        const pi = ['avatar', 'staff', 'items'].reduce((a, k) => ({ calls: a.calls + g(k).calls, tris: a.tris + g(k).tris }), { calls: 0, tris: 0 });
        const atCap = { calls: s.pass.calls - inPlay.calls + cap.calls, tris: s.pass.tris - inPlay.tris + cap.tris };
        const [pc, pt] = PASS[q][r.state], [ic, itr] = ITEMS[q], [nc, nt] = bud.noPeople;
        summary.budgets[`${q}-${pose}`] = { pose, state: r.state, pass: s.pass, passAtCap: atCap, frame: s.frame, maps: s.maps, ao: s.ao, groups: b.groups, itemsInPlay: inPlay, itemsAtCap: cap, counts, frameMs: s.frameMs, simMs: s.simMs };
        expect(s.pass.calls <= pc && s.pass.tris <= pt && atCap.calls <= pc && atCap.tris <= pt, `pass ${s.pass.calls}/${fmt(s.pass.tris)} (at the caps ${atCap.calls}/${fmt(atCap.tris)}) > ${pc}/${fmt(pt)}`);
        expect(inPlay.calls <= ic && inPlay.tris <= itr && cap.calls <= ic && cap.tris <= itr, `items in play ${inPlay.calls}/${inPlay.tris}, at the caps ${cap.calls}/${cap.tris} (row ${ic}/${fmt(itr)})`);
        expect(s.pass.calls - pi.calls <= nc && s.pass.tris - pi.tris <= nt, `less people ${s.pass.calls - pi.calls}/${fmt(s.pass.tris - pi.tris)} > ${nc}/${fmt(nt)}`);
        const gtxt = ['venue', 'near streets', 'far streets', 'trees', 'sky', 'avatar', 'staff', 'items', 'your-car', 'your-car-standin'].filter((k) => b.groups[k]).map((k) => `${k} ${g(k).calls}/${fmt(g(k).tris)}`).join(', ');
        return `${r.state}: pass ${s.pass.calls}/${fmt(s.pass.tris)} (at the caps ${atCap.calls}/${fmt(atCap.tris)}) of ${pc}/${fmt(pt)}; frame ${s.frame.calls}/${fmt(s.frame.tris)}; items in play ${inPlay.calls}/${fmt(inPlay.tris)} (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' ')}), at the caps ${cap.calls}/${fmt(cap.tris)}; less people and items ${s.pass.calls - pi.calls}/${fmt(s.pass.tris - pi.tris)} of ${nc}/${fmt(nt)}; [${gtxt}]; sim ${s.simMs} ms, frame ${s.frameMs} ms`;
      });
    }
  }
  await ctx.close().catch(() => {});
}

await browser?.close().catch(() => {});
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length} of ${results.length} passed`);
process.exit(fails.length ? 1 : 0);
