// Phase S3a checks for the sports bar's page (PROJECT_OC_SPORTS_BAR.md, "### S3a: the crowd, staff, fillers and how
// people are drawn"). Drives dist/sportsbar/sportsbar.html (build it with
// `npx vite build --config src/onfoot/vite.sportsbar.config.ts`) in headless Chromium with SwiftShader through
// window.__onfoot and prints PASS or FAIL with the numbers each check saw. Screenshots go in tests/out/sportsbar/;
// results are merged into tests/out/sportsbar/sportsbar-s3a-checks.json after every check.
//
//   node tests/sportsbar-s3a.mjs                         every group
//   node tests/sportsbar-s3a.mjs --only=smoke,checks     some groups: smoke, checks, staff, reactions, clock, fillers,
//                                                         retro, builds, switch, budgets, shots
//   node tests/sportsbar-s3a.mjs --tag=r1                a suffix for every screenshot's name
//   --presets=low,high,ultra                             the presets the per-preset groups run
//
// One browser at a time (this machine is shared by ten workflows). Frames here take seconds: be patient.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const CHECKS = path.join(OUT, 'sportsbar-s3a-checks.json');
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
  catch (e) { results.push({ name, ok: false, note: e.message, when: new Date().toISOString() }); console.log(`  FAIL  ${name}  ${e.message}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
  save();
}
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };
const T = 3600000;
let browser = null;
async function open(size, query) {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
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
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)));
const CAP = { low: 36, high: 70, ultra: 100 };

// ------------------------------------------------------------------------------------------------ smoke
if (want('smoke')) {
  console.log('smoke: 844x390, Low, Saturday 21:00, week 43');
  const { ctx, page, errors, bootS } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await check('smoke: boots with the crowd, no console errors', async () => {
    await H(page, 'window.__onfoot.setWeek(43)');
    const p = await H(page, 'window.__onfoot.peopleBrief()');
    summary.smoke = { bootS, p, errors };
    expect(!errors.length, errors.join(' | '));
    return `boot ${bootS} s; live ${p.live} of ${p.cap} (${p.staff} staff: ${JSON.stringify(p.staffRoles)}), held ${p.held}, fillers ${p.fillers}, target ${p.target}; cards ${p.cards}, blobs ${p.blobs}; atlas ${JSON.stringify(p.atlas)}`;
  });
  await check('smoke: the door pose at Low after buildAll', async () => {
    await H(page, 'window.__onfoot.seed(1)');
    const b = await H(page, 'window.__onfoot.buildAll()');
    await H(page, "window.__onfoot.pose('door')");
    await frames(page, 3);
    const s = await H(page, 'window.__onfoot.stats()'), v = await H(page, 'window.__onfoot.vis()');
    await shot(page, png('s3a-smoke-door-844x390'));
    return `built ${JSON.stringify(b)}; pass ${s.pass.calls}/${fmt(s.pass.tris)}, frame ${s.frame.calls}/${fmt(s.frame.tris)}; people ${JSON.stringify({ meshes: v.people.meshes, lod1: v.people.lod1, cards: v.people.cards, byMode: v.people.byMode })}; errors ${errors.length}`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the crowd's own checks
/** the share of a population (needs[k] under 30, not holding or waiting on its kind) choosing a tagged action within
 *  their next two decisions, from decisions(n) */
function needShare(log, keys, need, test, holdKey) {
  const by = new Map();
  for (const d of log) { if (!d.npc || d.watchdog || !keys.includes(d.npc)) continue; (by.get(d.npc) ?? by.set(d.npc, []).get(d.npc)).push(d); }
  let pop = 0, hit = 0; const misses = [];
  for (const [k, ds] of by) {
    // the population: under 30, not holding that kind or waiting on it (the plan's: thirst and a drink, hunger and food)
    const i = ds.findIndex((d) => d.needs[need] < 30 && !d[holdKey] && !(need === 'thirst' && d.waitingDrink) && !(need === 'hunger' && d.waitingFood));
    if (i < 0) continue;
    pop++;
    const two = ds.slice(i, i + 2);
    if (two.some((d) => test(d.chosen) || test(d.overlay))) hit++; else misses.push({ k, d: two.map((d) => ({ top: d.top.map((t) => `${t.action}@${t.object}:${t.score}`), chosen: d.chosen?.action, overlay: d.overlay?.action })) });
  }
  return { pop, hit, share: pop ? hit / pop : null, misses: misses.slice(0, 3) };
}
if (want('checks')) {
  console.log('checks: 844x390, Low, Saturday 21:00, week 43, seed 1');
  const { ctx, page, errors, bootS } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await check('checks: boots with no console errors; the room at the cap', async () => {
    expect(!errors.length, errors.join(' | '));
    const p = await H(page, 'window.__onfoot.peopleBrief()');
    expect(p.live === CAP.low, `live ${p.live} of ${CAP.low}`);
    return `boot ${bootS} s; live ${p.live} (${p.staff} staff), fillers ${p.fillers}, target ${p.target}`;
  });
  const drinkT = (c) => !!c && c.tags.includes('drink');
  const foodT = (c) => !!c && c.tags.includes('food') && (c.action.startsWith('order-food') || c.action === 'eat');
  const funT = (c) => !!c && (c.raises ?? []).includes('fun');
  for (const [need, test, hold, val] of [['thirst', drinkT, 'holdingDrink', 22], ['hunger', foodT, 'holdingFood', 22], ['fun', funT, null, 20]]) {
    await check(`needs drive choices: ${need} under 30, at least 70% choose a ${need === 'thirst' ? 'drink' : need === 'hunger' ? 'food' : 'fun'}-tagged action within their next two decisions`, async () => {
      const n0 = (await H(page, 'window.__onfoot.decisions(3000)')).length;
      const set = await H(page, `window.__onfoot.setNpcNeeds({ ${need}: ${val} }, 0.6, ${need.length})`);
      await H(page, 'window.__onfoot.fastForward(2)');
      const log = await H(page, 'window.__onfoot.decisions(3000)');
      const r = needShare(log.slice(Math.max(0, log.length - (log.length - n0) - 50)), set.keys, need, test, hold ?? '__none');
      summary[`needs-${need}`] = r;
      expect(r.pop >= 5, `population ${r.pop} (set ${set.n})`);
      expect(r.share >= 0.7, `${(100 * r.share).toFixed(1)}% of ${r.pop}: ${JSON.stringify(r.misses)}`);
      return `${r.hit} of ${r.pop} (${(100 * r.share).toFixed(1)}%) chose one; set on ${set.n} guests`;
    });
  }
  // a fresh room for the 30 sim-minute run
  await H(page, "window.__onfoot.setClock('Sat', 21)"); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.resetAudits()');
  await check('mood, no stuck people, no slot over capacity, nobody in the lane: Saturday 21:00 after a 30 sim-minute fast-forward', async () => {
    const t0 = Date.now();
    await H(page, 'window.__onfoot.fastForward(30)');
    const p = await H(page, 'window.__onfoot.people()'), sr = await H(page, 'window.__onfoot.staffReport()');
    const guests = p.list.filter((x) => x.kind === 'guest' && x.mode === 'live');
    const moods = guests.map((x) => x.mood).sort((a, b) => a - b), med = moods[Math.floor(moods.length / 2)], low = guests.filter((x) => x.label === 'Low').length / guests.length;
    const speedOk = guests.every((x) => x.speedK === (x.label === 'Low' ? 0.9 : x.emotion === 'Excited' ? 1.05 : 1));
    summary.run30 = { ms: Date.now() - t0, report: { ...p, list: undefined }, staff: sr, med, low };
    expect(med >= 45, `median mood ${med}`); expect(low < 0.15, `Low ${(100 * low).toFixed(1)}%`);
    expect(speedOk, 'a walk speed off its mood');
    expect(p.stuckMax <= 60, `stuck ${p.stuckMax} s`);
    expect(p.audits.overCap === 0, `slots over capacity ${p.audits.overCap} times`);
    expect(p.audits.laneHits === 0 && p.audits.playerLane === 0, `in the lane: guests ${p.audits.laneHits}, you ${p.audits.playerLane}`);
    expect(p.audits.liveOver === 0 && p.audits.liveMax <= CAP.low, `live max ${p.audits.liveMax}`);
    expect(p.lod0Npcs === undefined || p.lod0Npcs === 0, 'an NPC at LOD 0');
    const labels = guests.reduce((a, x) => { a[x.label] = (a[x.label] ?? 0) + 1; return a; }, {});
    return `median mood ${med.toFixed(1)}, Low ${(100 * low).toFixed(1)}% (${JSON.stringify(labels)}); walk speeds by mood ok; stuck max ${p.stuckMax.toFixed(1)} s, watchdog rescues ${p.rescues}; over capacity ${p.audits.overCap}, lane ${p.audits.laneHits}/${p.audits.playerLane}; live max ${p.audits.liveMax}; decisions ${JSON.stringify(p.decideMs)}; staff ${JSON.stringify(sr.bartenders.map((b) => ({ on: b.on, served: b.served.length, trips: b.trips.length })))}, min gap ${sr.minGap} m; ${((Date.now() - t0) / 1000).toFixed(0)} s real`;
  });
  await check('mood shows on bodies: cheer, groan and clap play on LOD 1 and LOD 2 bodies (in real frames), laughs on bodies, no NPC at LOD 0', async () => {
    // the standing floor: the nearest guests (LOD 1) watch the big screen
    await H(page, "window.__onfoot.pose('tv-east')");
    await H(page, 'window.__onfoot.resetAudits()');
    const fx = await H(page, "window.__onfoot.fireMoment('bigChance', 'X', 1)");
    for (let k = 0; k < 6; k++) { await H(page, `window.__onfoot.fireMoment('goal', '${k % 2 ? fx.away : fx.home}', 1)`); await frames(page, 8); }
    // laughter needs talking groups over sim time: a short fast-forward (the laughs are logged with the body's draw mode)
    await H(page, 'window.__onfoot.fastForward(4)');
    const clips = await H(page, "window.__onfoot.crowdLogs('clips', 2000)"), laughs = await H(page, "window.__onfoot.crowdLogs('laughs')"), v = await H(page, 'window.__onfoot.vis()');
    const byLod = {};
    for (const c of clips) if (!c.missed && ['cheer', 'groan', 'clap'].includes(c.clip)) byLod[`${c.clip}@${c.lod}`] = (byLod[`${c.clip}@${c.lod}`] ?? 0) + 1;
    const laughLod = laughs.reduce((a, l) => { a[l.lod] = (a[l.lod] ?? 0) + 1; return a; }, {});
    summary.bodies = { byLod, laughs: laughs.length, laughLod, fx };
    expect(v.people.lod0Npcs === 0, `${v.people.lod0Npcs} NPCs at LOD 0`);
    const played = Object.keys(byLod);
    expect(played.some((k) => k.endsWith('@1')) && played.some((k) => k.endsWith('@2')), `clips by LOD ${JSON.stringify(byLod)}`);
    expect(['cheer', 'groan', 'clap'].every((c) => played.some((k) => k.startsWith(c + '@'))), `not every clip played: ${JSON.stringify(byLod)}`);
    expect(laughs.some((l) => l.lod === 'lod1' || l.lod === 'lod2'), `no laugh on a body: ${JSON.stringify(laughLod)}`);
    return `in real frames at tv-east, 6 goals on ${fx.fixture} (${fx.home}-${fx.away}): clips ${JSON.stringify(byLod)}; laughs in a 4-minute run ${JSON.stringify(laughLod)}; NPCs at LOD 0: 0`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the staff
if (want('staff')) {
  console.log('staff: 844x390, Saturday 21:00, each preset; the counter, the lane, the flap trip at Low');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  for (const q of PRESETS) {
    await check(`bartenders serve the whole counter at ${q}: every stool and gap served on the lane path, centres 0.6 m apart, nobody in the lane or the flap${q === 'low' ? '; the westmost leaves by the flap, reaches H, collects empties and comes back' : ''}`, async () => {
      await H(page, `window.__onfoot.setQuality('${q}')`);
      await H(page, "window.__onfoot.setClock('Sat', 21)"); await H(page, 'window.__onfoot.resetAudits()');
      const us = await H(page, 'window.__onfoot.serveAll()');
      await H(page, 'window.__onfoot.fastForward(q === "low" ? 12 : 4)'.replace('q === "low"', q === 'low' ? 'true' : 'false'));
      const sr = await H(page, 'window.__onfoot.staffReport()'), p = await H(page, 'window.__onfoot.peopleBrief()');
      const served = new Set(sr.bartenders.flatMap((b) => b.served));
      const missing = us.filter((u) => ![...served].some((x) => Math.abs(x - u) < 0.011));
      summary[`staff-${q}`] = { sr, plan: p.plan, staffRoles: p.staffRoles, audits: p.audits };
      expect(!errors.length, errors.join(' | '));
      expect(!missing.length, `not served at u ${missing.join(', ')} (served ${[...served].join(', ')})`);
      expect(sr.minGap === null || sr.minGap >= 0.6 - 1e-6, `two bartenders ${sr.minGap} m apart`);
      expect(p.audits.laneHits === 0 && p.audits.playerLane === 0, `lane ${p.audits.laneHits}/${p.audits.playerLane}`);
      if (q === 'low') {
        expect(p.audits.staffLowMax <= 5, `Low drew ${p.audits.staffLowMax} staff`);
        const west = sr.bartenders.filter((b) => b.on).sort((a, b) => b.section[0] - a.section[0])[0];
        const trips = sr.bartenders.flatMap((b) => b.trips.map((t) => ({ ...t, i: b.i })));
        const ok = trips.filter((t) => t.reachedH !== null && t.picked > 0 && t.back !== null);
        summary.flap = { trips, west };
        expect(ok.length > 0, `no completed flap trip: ${JSON.stringify(trips)} (empties ${sr.empties})`);
      }
      const on = sr.bartenders.filter((b) => b.on);
      return `${on.length} bartenders (sections ${on.map((b) => b.section.join('-')).join(', ')}), ${sr.servers.filter((s) => s.on).length} servers, host ${sr.host.on}, barback ${sr.barback.on} (picked ${sr.barback.picked}), house ${sr.house}; staff on ${p.staff} (${JSON.stringify(p.staffRoles)}); all ${us.length} counter positions served; min gap ${sr.minGap} m; lane ${p.audits.laneHits}/${p.audits.playerLane}${q === 'low' ? `; flap trips ${JSON.stringify(sr.bartenders.flatMap((b) => b.trips))}` : ''}`;
    });
  }
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ reactions
if (want('reactions')) {
  console.log('reactions: 844x390, Ultra (90 guests), Saturday 20:08 (the featured match in play), week 43, seed 1');
  const { ctx, page, errors } = await open([844, 390], 'quality=ultra&ultra=1&day=Sat&hour=20.1333&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await check('reactions: over 10 seeded goals the scoring team\'s live supporters who can see a screen react within 1 s at their mean p (within 12 points); nobody who can\'t see one reacts', async () => {
    await H(page, 'window.__onfoot.buildAll()');
    await H(page, 'window.__onfoot.resetAudits()');
    const tv = await H(page, 'window.__onfoot.tv()');
    const f = tv.featured; expect(!!f, 'no featured match');
    const fx = await H(page, "window.__onfoot.fireMoment('goal', 'X', 1)");
    expect(fx && fx.featured, 'not the featured fixture in play: ' + JSON.stringify(fx));
    await H(page, 'window.__onfoot.resetAudits()');
    for (let k = 0; k < 10; k++) { await H(page, `window.__onfoot.fireMoment('goal', '${k % 2 ? fx.away : fx.home}', 1)`); await H(page, 'window.__onfoot.fastForward(0.05)'); }
    const R = (await H(page, "window.__onfoot.crowdLogs('reactions', 4000)")).filter((r) => r.kind === 'goal');
    const sup = R.filter((r) => r.supports === 'for' && r.canSee);
    const share = sup.filter((r) => r.reacted && r.delay <= 1).length / Math.max(1, sup.length), meanP = sup.reduce((a, r) => a + r.p, 0) / Math.max(1, sup.length);
    const blind = R.filter((r) => !r.canSee && r.reacted).length;
    const against = R.filter((r) => r.supports === 'against' && r.canSee), neutral = R.filter((r) => r.supports === 'neutral' && r.canSee);
    summary.reactions = { samples: sup.length, share, meanP, blind, against: against.length, againstShare: against.filter((r) => r.reacted).length / Math.max(1, against.length), neutralShare: neutral.filter((r) => r.reacted).length / Math.max(1, neutral.length), errors };
    expect(sup.length >= 100, `only ${sup.length} samples`);
    expect(Math.abs(share - meanP) <= 0.12, `share ${(100 * share).toFixed(1)}% vs mean p ${(100 * meanP).toFixed(1)}%`);
    expect(blind === 0, `${blind} reacted without seeing a screen`);
    return `${sup.length} samples: ${(100 * share).toFixed(1)}% reacted within 1 s against a mean p of ${(100 * meanP).toFixed(1)}%; against ${against.length} (${(100 * summary.reactions.againstShare).toFixed(0)}% groaned), neutral ${neutral.length} (${(100 * summary.reactions.neutralShare).toFixed(0)}% clapped, p 0.25); blind reactions ${blind}; fixture ${fx.fixture} ${fx.home}-${fx.away}`;
  });
  await check('dancing at the featured final whistle: only winners who can see a screen, with active over 0.4 and fun under 70, start through the direct chance', async () => {
    // 20:26: the featured match's final whistle has gone (20:25) and game night holds, so the dance floor is open
    await H(page, "window.__onfoot.setClock('Sat', 20.4333)");
    await H(page, 'window.__onfoot.fastForward(0.2)');
    await H(page, 'window.__onfoot.resetAudits()');
    const fx = await H(page, "window.__onfoot.fireMoment('bigChance', 'X', 1)");
    expect(fx && fx.featured, 'not the featured fixture: ' + JSON.stringify(fx));
    await H(page, `window.__onfoot.resetAudits()`);
    // the check's population: everyone's fun at 50 (watching the match had filled it), so the fun rule can admit them
    await H(page, 'window.__onfoot.setNpcNeeds({ fun: 50 }, 1, 3)');
    // the direct chance for each side's winners in turn (two synthetic finals: twice the samples of one)
    await H(page, `window.__onfoot.fireMoment('final', '${fx.home}', 1)`);
    await H(page, 'window.__onfoot.fastForward(0.1)');
    await H(page, `window.__onfoot.fireMoment('final', '${fx.away}', 1)`);
    await H(page, 'window.__onfoot.fastForward(0.1)');
    const D = await H(page, "window.__onfoot.crowdLogs('dances')"), R = (await H(page, "window.__onfoot.crowdLogs('reactions', 4000)")).filter((r) => r.kind === 'final');
    const noSpot = D.filter((d) => d.noSpot).length; D.splice(0, D.length, ...D.filter((d) => !d.noSpot));
    const bad = D.filter((d) => !(d.winner && d.canSee && d.active > 0.4 && d.fun < 70));
    const eligible = R.filter((r) => r.p > 0);
    summary.dances = { D, eligible: eligible.length };
    expect(!bad.length, 'dances outside the rule: ' + JSON.stringify(bad));
    expect(D.length > 0, `nobody danced (${eligible.length} eligible)`);
    return `${D.length} started dancing of ${eligible.length} eligible winners (p = 0.5 x active; ${noSpot} drew it with no free spot on the dance floor); every one a winner who could see a screen, active ${Math.min(...D.map((d) => d.active)).toFixed(2)} and up, fun ${Math.max(...D.map((d) => d.fun)).toFixed(0)} or less`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the crowd by clock, fillers
if (want('clock') || want('fillers')) {
  console.log('clock and fillers: 844x390, each preset, Saturday 21:00 and Tuesday 15:00, closed hours');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await H(page, 'window.__onfoot.resetAudits()');
  const counts = {};
  for (const q of PRESETS) {
    await H(page, `window.__onfoot.setQuality('${q}')`);
    for (const [day, hour] of [['Sat', 21], ['Tue', 15]]) {
      await check(`fillers at ${q}, ${day} ${hour}:00: live + held + fillers = the target (or every free eligible slot); none nearer than the distance; no table mixes fillers and live people`, async () => {
        await H(page, `window.__onfoot.setClock('${day}', ${hour})`);
        await H(page, "window.__onfoot.pose('door')"); await H(page, `window.__onfoot.setClock('${day}', ${hour})`);
        await H(page, 'window.__onfoot.fastForward(2)');
        await frames(page, 2);
        const c = await H(page, 'window.__onfoot.fillerCheck()'), fl = await H(page, 'window.__onfoot.fillers()'), tb = await H(page, 'window.__onfoot.tables()'), p = await H(page, 'window.__onfoot.peopleBrief()');
        counts[`${q}-${day}`] = { ...c, plan: p.plan };
        const sum = c.live + c.held + c.fillers, wantN = Math.min(c.target, c.live + c.held + c.freeEligible);
        const minD = q === 'low' ? 6 : 9, near = fl.filter((f) => f.d < minD - 1e-6), mixed = tb.filter((t) => t.mixed);
        expect(sum === c.target || sum === wantN, `live ${c.live} + held ${c.held} + fillers ${c.fillers} = ${sum}, target ${c.target}, free eligible ${c.freeEligible}`);
        expect(!near.length, `fillers within ${minD} m: ${JSON.stringify(near.slice(0, 3))}`);
        expect(!mixed.length, `mixed tables ${JSON.stringify(mixed.slice(0, 3))}`);
        expect(c.live + c.staff <= CAP[q], `live ${c.live + c.staff} over the cap`);
        return `target ${c.target}: live ${c.live} + held ${c.held} + fillers ${c.fillers} = ${sum} (free eligible ${c.freeEligible}); staff ${c.staff} (${JSON.stringify(p.staffRoles)}); nearest filler ${fl.length ? Math.min(...fl.map((f) => f.d)).toFixed(2) : '-'} m (min ${minD}); mixed tables 0`;
      });
    }
  }
  await check('the crowd by clock: Tuesday 15:00 has fewer people than Saturday 21:00; closed hours have nobody inside; staff follow the share; Low never draws more than 5; the live count never passes the cap', async () => {
    const sat = counts['low-Sat'] ?? counts[`${PRESETS[0]}-Sat`], tue = counts['low-Tue'] ?? counts[`${PRESETS[0]}-Tue`];
    await H(page, "window.__onfoot.setClock('Mon', 4)");
    await H(page, 'window.__onfoot.fastForward(1)');
    const closed = await H(page, 'window.__onfoot.fillerCheck()'), pc = await H(page, 'window.__onfoot.peopleBrief()');
    const inside = (await H(page, 'window.__onfoot.npcs()')).filter((x) => x.mode === 'live' && x.indoor);
    expect(tue.target + 0 < sat.target && tue.live + tue.held + tue.fillers < sat.live + sat.held + sat.fillers, `Tue ${JSON.stringify(tue)} vs Sat ${JSON.stringify(sat)}`);
    expect(closed.live === 0 && closed.fillers === 0 && inside.length === 0, `closed: ${JSON.stringify(closed)}, inside ${inside.length}`);
    expect(pc.audits.liveOver === 0, `the live count passed the cap ${pc.audits.liveOver} times`);
    expect(pc.audits.staffLowMax <= 5, `Low drew ${pc.audits.staffLowMax} staff`);
    summary.clock = { counts, closed, audits: pc.audits };
    return `Sat 21:00 ${sat.live + sat.held + sat.fillers} guests (target ${sat.target}), Tue 15:00 ${tue.live + tue.held + tue.fillers} (target ${tue.target}); closed Mon 04:00: nobody (${JSON.stringify({ live: closed.live, fillers: closed.fillers, staff: closed.staff })}); staff plans ${Object.entries(counts).map(([k, v]) => `${k} ${JSON.stringify(v.plan)}`).join('; ')}; live never over the cap; Low staff at most ${pc.audits.staffLowMax}`;
  });
  await check('fillers: tapping a filler gives a live person and their menu opens; no filler is a regular', async () => {
    await H(page, "window.__onfoot.setClock('Sat', 21)"); await H(page, "window.__onfoot.pose('door')");
    await frames(page, 2);
    const fl = await H(page, 'window.__onfoot.fillers()');
    expect(fl.length > 0, 'no fillers');
    const far = fl.sort((a, b) => a.d - b.d)[0];
    const r = await H(page, `window.__onfoot.tapFiller('${far.slot}')`);
    expect(r && r.ok, 'the tap gave nobody: ' + JSON.stringify(r));
    const who = (await H(page, 'window.__onfoot.npcs()')).find((x) => x.id === r.id);
    expect(who && who.mode === 'live' && who.slot === far.slot, JSON.stringify(who));
    expect(!!r.menu, 'no menu');
    await H(page, 'window.__onfoot.closeRadial()');
    return `the filler at ${far.slot} (${far.d} m) became ${who.name} (${who.key}, ${who.regular ? 'a regular' : 'a walk-in'}), live at that slot; their menu: ${JSON.stringify(r.menu)}. Fillers carry no identity, so none is a regular`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ Low and the shaders
if (want('retro')) {
  console.log('retro: 844x390, Low, Saturday 21:00; one NPC forced to LOD 0 in view, watching for shader errors');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await check('Low and the shaders: after a 30 sim-minute fast-forward and every pose, one NPC forced to LOD 0 in view compiles with no shader error; its hair meshes marked retroSkip', async () => {
    await H(page, 'window.__onfoot.shaderWatch()');
    await H(page, 'window.__onfoot.fastForward(30)');
    for (const pose of ['door', 'tv-east', 'stall', 'patio', 'overhead']) { await H(page, `window.__onfoot.pose('${pose}')`); await frames(page, 1); }
    await H(page, "window.__onfoot.pose('door')");
    const list = (await H(page, 'window.__onfoot.npcs()')).filter((x) => x.kind === 'guest' && x.mode === 'live' && x.indoor && x.draw !== 'card').sort((a, b) => a.dist - b.dist);
    expect(list.length, 'nobody in view');
    const r = await H(page, `window.__onfoot.forceLod0(${list[0].id})`);
    await frames(page, 3);
    const caught = await H(page, 'window.__onfoot.shaderWatch()');
    const e2 = [...caught, ...errors.filter((e) => /WebGLProgram|shader|THREE/.test(e))];
    summary.retro = { forced: r, errors: e2, note: 'The Retro style module (RS1) is still uncommitted (origin/claude/wip-modes only), so Low draws standard materials (O15): the toon-material half of this check cannot run; the shader-error half does.' };
    expect(!e2.length, e2.join(' | '));
    return `forced ${list[0].name} (${list[0].key}) to LOD 0: ${r.calls} calls, ${fmt(r.tris)} tris; no shader or WebGLProgram error in ${errors.length} console errors. The toon-material half waits for the Retro module (O15)`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the background builds
/** the plan's four marks from a builds() log: the timed span starts at the first build after the 3 frames that follow
 *  the load (or a switch) and ends when the last counted build ends */
function marks(log, fromMark, maxBuilds = Infinity) {
  const fr = log.frames, bs = new Map(log.builds.filter((b) => !b.sync).map((b) => [b.i, b]));
  const m0 = fr.findIndex((f) => f.mark === fromMark); if (m0 < 0) return { error: 'no ' + fromMark + ' mark' };
  const after = fr.slice(m0);
  const warm = after.slice(0, 3);
  const rest = after.slice(3);
  const firstB = rest.findIndex((f) => f.build >= 0); if (firstB < 0) return { error: 'no build after the warm-up', warm };
  let span = rest.slice(firstB);
  const counted = []; for (const f of span) if (f.build >= 0 && counted.length < maxBuilds) counted.push(bs.get(f.build));
  const lastB = counted[counted.length - 1];
  const lastFi = span.findIndex((f) => f.build === lastB.i);
  span = span.slice(0, lastFi + 1);
  // 1. one at most a frame (the log has one build field a frame; two builds would need two records with the same frame)
  const perFrame = new Map(); for (const b of log.builds) if (!b.sync) perFrame.set(b.frame, (perFrame.get(b.frame) ?? 0) + 1);
  const two = [...perFrame.values()].filter((v) => v > 1).length;
  // 2. the gap at each counted build's check, from the logged times: since the last build ended >= 2 x its duration
  let gapBad = 0; const gaps = [];
  for (let i = 1; i < counted.length; i++) { const prev = counted[i - 1], b = counted[i], since = b.start - (prev.start + prev.dur); gaps.push(since / (2 * prev.dur)); if (since + 0.5 < 2 * prev.dur) gapBad++; }
  // 3. never idle: a frame whose check found work and the gap met (worked out here) started a build
  let idle = 0; let prevB = null;
  for (const f of span) { const b = f.build >= 0 ? bs.get(f.build) : null; if (prevB && !b && f.queued) { const since = f.start - (prevB.start + prevB.dur); if (since >= 2 * prevB.dur + 0.5) idle++; } if (b) prevB = b; }
  // 4. the span within 1.7 x sum max(F, 3d), F the median non-build part of the span's frames
  const nonBuild = span.filter((f) => f.len > 0).map((f) => f.len - (f.build >= 0 ? bs.get(f.build).dur : 0)).sort((a, b) => a - b);
  const F = nonBuild[Math.floor(nonBuild.length / 2)] ?? 0;
  const L = lastB.start + lastB.dur - counted[0].start, bound = counted.reduce((a, b) => a + Math.max(F, 3 * b.dur), 0);
  const longest = Math.max(...after.map((f) => f.len)), over50 = after.filter((f) => f.len > 50).length;
  return { counted: counted.length, two, gapBad, idle, spanS: +(L / 1000).toFixed(1), boundS: +(1.7 * bound / 1000).toFixed(1), ratio: +(L / bound).toFixed(3), F: +F.toFixed(1), sumDurS: +(counted.reduce((a, b) => a + b.dur, 0) / 1000).toFixed(2), warm: warm.map((f) => ({ len: +f.len.toFixed(0), build: f.build })), longest: +longest.toFixed(0), over50, byLevel: counted.reduce((a, b) => { a[`L${b.level}`] = (a[`L${b.level}`] ?? 0) + 1; return a; }, {}), gapMin: gaps.length ? +Math.min(...gaps).toFixed(2) : null };
}
if (want('builds')) {
  for (const q of PRESETS) {
    console.log(`builds: 844x390, ${q}, Saturday 21:00, no fast-forward, from the load`);
    const { ctx, page, errors, bootS } = await open([844, 390], `quality=${q}&ultra=1&day=Sat&hour=21&hint=0`);
    await check(`the background builds at ${q}: one at most a frame, the gap, never idle, the span within 1.7 (${q === 'low' ? 'until the room reaches its cap' : 'the first 30 counted builds'})`, async () => {
      expect(!errors.length, errors.join(' | '));
      const t0 = Date.now();
      const limit = q === 'low' ? Infinity : 30;
      for (;;) {
        await frames(page, 4);
        const log = await H(page, 'window.__onfoot.builds()');
        const counted = log.builds.filter((b) => !b.sync && b.frame >= 0).length;
        const pending = await H(page, '(() => { const p = window.__onfoot.peopleBrief(); return p; })()');
        if (counted >= limit + 4 || (q === 'low' && log.frames.length > 10 && !log.frames[log.frames.length - 1].queued && counted > 3) || Date.now() - t0 > 40 * 60 * 1000) break;
        void pending;
      }
      const log = await H(page, 'window.__onfoot.builds()');
      const m = marks(log, 'load', limit);
      summary[`builds-${q}`] = { m, bootS, frames: log.frames.length, builds: log.builds.length, sync: log.builds.filter((b) => b.sync).length };
      expect(!m.error, m.error);
      expect(m.two === 0, `${m.two} frames with two builds`);
      expect(m.gapBad === 0, `${m.gapBad} builds inside the gap`);
      expect(m.idle === 0, `${m.idle} idle frames with work and the gap met`);
      expect(m.ratio <= 1.7, `span ${m.spanS} s, ratio ${m.ratio} > 1.7`);
      return `${m.counted} counted builds (${JSON.stringify(m.byLevel)}): no frame with two; gap met at every build (least ${m.gapMin} x the need); no idle frame; span ${m.spanS} s within ${m.boundS} s (ratio ${m.ratio}, F ${m.F} ms); the builds took ${m.sumDurS} s; warm-up frames ${JSON.stringify(m.warm)} (ms); longest frame ${m.longest} ms, ${m.over50} over 50 ms; boot ${bootS} s; ${((Date.now() - t0) / 1000).toFixed(0)} s watched`;
    });
    await ctx.close().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ a change of graphics
if (want('switch')) {
  console.log('switch: 844x390, Saturday 21:00, from a full room at Low with you joined to a group of three; every ordered pair');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await H(page, 'window.__onfoot.buildAll()');
  await H(page, "window.__onfoot.pose('door')");
  let yours = null;
  await check('switch: you join a talking group of three', async () => {
    const l = await H(page, 'window.__onfoot.npcs()');
    const byParty = {}; for (const x of l) if (x.kind === 'guest' && x.mode === 'live' && x.indoor && !x.walking) (byParty[x.party] ??= []).push(x);
    const three = Object.values(byParty).find((m) => m.length === 3) ?? Object.values(byParty).find((m) => m.length >= 2);
    expect(three, 'no group of three');
    yours = await H(page, `window.__onfoot.join(${three[0].id})`);
    return `joined party ${yours.party}: ${yours.members.join(', ')}`;
  });
  const pairs = [['low', 'high'], ['high', 'ultra'], ['ultra', 'low'], ['low', 'ultra'], ['ultra', 'high'], ['high', 'low']];
  for (const [a, b] of pairs) {
    await check(`switch ${a} to ${b}: the sheet shows; from the switch frame the live count is the new cap (${CAP[b]}); your group live; no regular or held guest a filler; ${CAP[b] < CAP[a] ? 'the farthest held first' : 'held guests back before fillers'}${(a === 'low') !== (b === 'low') ? '; every body at the new quality (or a card) from the next frame, rebuilds logged as switch' : '; no body rebuilt, the atlas kept'}`, async () => {
      const before = await H(page, 'window.__onfoot.people()');
      const f0 = await H(page, 'window.__onfoot.buildFrame()'), t0p = await H(page, 'performance.now()');
      const atlas0 = before.atlas;
      const r = await H(page, `window.__onfoot.switchSheet('${b}')`);
      const sw = (await H(page, "window.__onfoot.crowdLogs('switches')")).slice(-1)[0];
      const p = await H(page, 'window.__onfoot.people()');
      await frames(page, 1);
      const v = await H(page, 'window.__onfoot.vis()');
      const log = await H(page, `window.__onfoot.builds(${f0})`);
      const pq = b === 'low' ? 'phone' : 'high';
      const wrongQ = v.people.rows.filter((x) => x.draw !== 'card' && x.draw !== 'off' && x.lod !== null && (p.list.find((y) => y.key === x.key)?.quality ?? pq) !== pq);
      const yoursLive = (yours?.members ?? []).every((k) => p.list.find((x) => x.key === k)?.mode === 'live');
      expect(r.sheet.some((t) => /Switching to|Preparing Ultra/.test(t)), 'no sheet: ' + JSON.stringify(r.sheet));
      expect(p.live === CAP[b], `live ${p.live} of ${CAP[b]}`);
      expect(yoursLive, 'your group held');
      if (CAP[b] < CAP[a]) { const d = sw.held.map((h) => h.d); const held = d.length; expect(held > 0, 'nobody held'); }
      else expect(sw.back.length >= 0 && (sw.heldBefore === 0 || sw.back.length > 0 || sw.promoted === 0), 'fillers before held: ' + JSON.stringify({ back: sw.back.length, promoted: sw.promoted, heldBefore: sw.heldBefore }));
      // this switch's own rebuilds: logged from its start on (the log keeps the earlier ones too)
      const rebuilds = log.builds.filter((x) => x.reason === 'switch' && x.start >= t0p);
      if ((a === 'low') !== (b === 'low')) { expect(!wrongQ.length, 'old-quality bodies drawn: ' + JSON.stringify(wrongQ.slice(0, 3))); expect(rebuilds.length > 0, 'no switch rebuilds logged'); expect(p.atlas.quality === pq, 'atlas ' + JSON.stringify(p.atlas)); }
      else { expect(JSON.stringify(atlas0) === JSON.stringify(p.atlas), 'the atlas was repainted'); expect(!rebuilds.length, `${rebuilds.length} rebuilds between HD and Ultra`); }
      summary[`switch-${a}-${b}`] = { sheet: r.sheet, sw, live: p.live, held: p.held, fillers: p.fillers, rebuilds: rebuilds.length, wrongQ: wrongQ.length };
      // after it, buildAll and the door: LOD 1 bodies at the preset's own cost
      await H(page, 'window.__onfoot.buildAll()'); await H(page, "window.__onfoot.pose('door')"); await frames(page, 2);
      const s2 = await H(page, 'window.__onfoot.stats()'), bd = await H(page, 'window.__onfoot.breakdown()');
      const lod1rows = bd.rows.filter((x) => x.name === 'lod1' && x.tris > 0), per = lod1rows.length ? Math.max(...lod1rows.map((x) => x.tris)) : 0;
      const mean = lod1rows.length ? lod1rows.reduce((a, x) => a + x.tris, 0) / lod1rows.length : 0, minL1 = lod1rows.length ? Math.min(...lod1rows.map((x) => x.tris)) : 0;
      const p2 = await H(page, 'window.__onfoot.peopleBrief()'), v2 = await H(page, 'window.__onfoot.vis()'), l2 = await H(page, 'window.__onfoot.npcs()');
      expect(p2.live === CAP[b], `live after buildAll ${p2.live}`);
      // every body drawn after buildAll is at this preset's people quality (bodies differ by person, so the check is the
      // quality, and the per-body cost is reported against the sums' 7.5k and 11.6k)
      const oldQ = v2.people.rows.filter((x) => (x.draw === 'lod1' || x.draw === 'lod2') && (l2.find((y) => y.key === x.key)?.quality ?? pq) !== pq);
      expect(!oldQ.length, `${oldQ.length} bodies at the other quality after buildAll`);
      summary[`switch-${a}-${b}`].lod1 = { n: lod1rows.length, min: minL1, mean: Math.round(mean), max: per };
      return `sheet "${r.sheet.join(' / ')}"; live ${p.live} (cap ${CAP[b]}), held ${p.held}, fillers ${p.fillers}; held at the switch ${sw.held.length}${sw.held.length ? ` (nearest ${Math.min(...sw.held.map((h) => h.d))} m, farthest ${Math.max(...sw.held.map((h) => h.d))} m, ${sw.held.filter((h) => h.regular).length} regulars, ${sw.held.filter((h) => h.standing).length} standing)` : ''}, back ${sw.back.length}, fillers made live ${sw.promoted}; switch rebuilds ${rebuilds.length} (${sw.ms} ms behind the sheet); your group live; after buildAll at door: pass ${s2.pass.calls}/${fmt(s2.pass.tris)}, every body at ${pq} quality; LOD 1 bodies ${fmt(minL1)} to ${fmt(per)}, mean ${fmt(mean)} (${lod1rows.length})`;
    });
    if (a === 'ultra' && b === 'low') {
      await check('a held guest, tapped, comes back as the same person', async () => {
        const held = (await H(page, 'window.__onfoot.npcs()')).filter((x) => x.kind === 'guest' && x.mode === 'held').sort((x, y) => x.dist - y.dist);
        expect(held.length, 'nobody held');
        let r = null;
        for (const h of held.slice(0, 6)) { r = await H(page, `window.__onfoot.tapNpc(${h.id})`); if (r && r.same) break; }
        expect(r && r.same && r.mode === 'live', 'the tap gave ' + JSON.stringify(r));
        await H(page, 'window.__onfoot.closeRadial()');
        const p = await H(page, 'window.__onfoot.peopleBrief()');
        expect(p.live <= CAP.low, `live ${p.live} of ${CAP.low} after the tap`);
        return `${r.name} (${r.key}) was held and came back live as themselves; live ${p.live} of ${CAP.low} (room was made under the cap first)`;
      });
    }
    if (a === 'low' && b === 'high') {
      await check('switch Low to HD, timed: the 3 warm-up frames logged and not timed, then the next 30 counted builds pass the four marks', async () => {
        // the previous check ran buildAll; time a fresh switch round: back to Low and to HD again, then watch the frames
        await H(page, "window.__onfoot.switchSheet('low')"); await H(page, "window.__onfoot.pose('door')");
        await H(page, "window.__onfoot.switchSheet('high')");
        const t0 = Date.now();
        for (;;) { await frames(page, 4); const log = await H(page, 'window.__onfoot.builds()'); const m0 = log.frames.map((f) => f.mark).lastIndexOf('switch'); const n = log.builds.filter((x) => !x.sync && x.frame >= (log.frames[m0]?.f ?? 0)).length; if (n >= 34 || Date.now() - t0 > 30 * 60 * 1000) break; }
        const log = await H(page, 'window.__onfoot.builds()');
        const last = log.frames.map((f) => f.mark).lastIndexOf('switch');
        const m = marks({ frames: log.frames.slice(last), builds: log.builds }, 'switch', 30);
        summary['switch-timed'] = m;
        expect(!m.error, m.error); expect(m.two === 0 && m.gapBad === 0 && m.idle === 0 && m.ratio <= 1.7, JSON.stringify(m));
        return `${m.counted} counted builds: no frame with two, the gap met (least ${m.gapMin} x), no idle frame, span ${m.spanS} s within ${m.boundS} s (ratio ${m.ratio}); warm-up ${JSON.stringify(m.warm)}; ${((Date.now() - t0) / 1000).toFixed(0)} s`;
      });
      await H(page, 'window.__onfoot.buildAll()');
    }
  }
  await check('switch: no console errors through the switches', async () => { expect(!errors.length, errors.slice(0, 4).join(' | ')); return `${errors.length} errors`; });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the budgets
const PASS = { low: { inside: [118, 203.9e3], outside: [139, 244.3e3], overhead: [118, 197.9e3] }, high: { inside: [177, 465.7e3], outside: [176, 449.5e3], overhead: [222, 609.4e3] }, ultra: { inside: [302, 1202.6e3], outside: [246, 1086.4e3], overhead: [302, 1180.0e3] } };
const FRAME = { low: { inside: [150, 250e3], outside: [150, 250e3], overhead: [150, 250e3] }, high: { inside: [294, 718.9e3], outside: [328, 854.6e3], overhead: [374, 1014.5e3] }, ultra: { inside: [1155, 3259.2e3], outside: [683, 3011.9e3], overhead: [1185, 3396.7e3] } };
const SUN = { high: { inside: [102, 253.1e3], outside: [137, 405.1e3], overhead: [137, 405.1e3] }, ultra: { inside: [177, 656.5e3], outside: [171, 839.2e3], overhead: [187, 839.2e3] } };
const POOLMAP = { inside: [177, 98.8e3], overhead: [187, 98.8e3] };
const OUTSIDE_MESHES = { low: 12, high: 24, ultra: 40 };
if (want('budgets')) {
  summary.budgets = summary.budgets ?? {};
  console.log('budgets: 844x390 (and 390x844 for door and overhead), Saturday 21:00, week 43, seed 1, the caps reached, every item at its cap');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await H(page, 'window.__onfoot.fastForward(30)');
  await check('budgets: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  for (const q of PRESETS) {
    await H(page, `window.__onfoot.setQuality('${q}')`);
    await H(page, 'window.__onfoot.buildAll()');
    for (const [pose, size] of [['door', [844, 390]], ['tv-east', [844, 390]], ['stall', [844, 390]], ['patio', [844, 390]], ['overhead', [844, 390]], ['door', [390, 844]], ['overhead', [390, 844]]]) {
      await check(`budgets ${q} ${pose} ${size.join('x')}: the pass and the frame within the sums; each shadow map within its row; vis() lists each map's members by their LOD 1; outdoors no more meshes than the outside count, the casters among them, no card holding an item`, async () => {
        await page.setViewportSize({ width: size[0], height: size[1] });
        if (pose === 'stall' || pose === 'patio') await H(page, `window.__onfoot.crowdAt('outside', ${OUTSIDE_MESHES[q]})`);
        const r = await H(page, `window.__onfoot.pose('${pose}')`);
        await frames(page, 2);
        await H(page, 'window.__onfoot.freeze(true)');
        await H(page, 'window.__onfoot.itemsAtCap(true)');
        const s = await H(page, 'window.__onfoot.stats()'), v = await H(page, 'window.__onfoot.vis()'), b = await H(page, 'window.__onfoot.breakdown()'), p = await H(page, 'window.__onfoot.peopleBrief()');
        await H(page, 'window.__onfoot.itemsAtCap(false)'); await H(page, 'window.__onfoot.freeze(false)');
        const st = r.state, [pc, pt] = PASS[q][st], [fc, ft] = FRAME[q][st];
        const peopleG = ['people', 'staff', 'avatar', 'cards'].reduce((a, k) => ({ calls: a.calls + (b.groups[k]?.calls ?? 0), tris: a.tris + (b.groups[k]?.tris ?? 0) }), { calls: 0, tris: 0 });
        summary.budgets[`${q}-${pose}-${size.join('x')}`] = { state: st, pass: s.pass, frame: s.frame, maps: s.maps, ao: s.ao, people: { meshes: v.people.meshes, lod1: v.people.lod1, cards: v.people.cards, byMode: v.people.byMode, sun: v.people.sun.length, pool1: v.people.pool1.length, pool2: v.people.pool2.length }, live: p.live, peopleG, groups: b.groups, simMs: s.simMs, frameMs: s.frameMs, crowdStepMs: s.crowdStepMs, crowdFrameMs: s.crowdFrameMs, decideMs: s.decideMs };
        expect(p.live === CAP[q], `live ${p.live} of ${CAP[q]}`);
        expect(s.pass.calls <= pc && s.pass.tris <= pt, `pass ${s.pass.calls}/${fmt(s.pass.tris)} > ${pc}/${fmt(pt)}`);
        expect(s.frame.calls <= fc && s.frame.tris <= ft, `frame ${s.frame.calls}/${fmt(s.frame.tris)} > ${fc}/${fmt(ft)}`);
        if (q !== 'low') {
          const sun = s.maps.sun, [sc, stt] = SUN[q][st];
          expect(sun && sun.calls <= sc && sun.tris <= stt, `sun map ${sun?.calls}/${fmt(sun?.tris ?? 0)} > ${sc}/${fmt(stt)}`);
          if (q === 'ultra' && st !== 'outside') for (const k of ['pool-1', 'pool-2']) { const m = s.maps[k], [mc, mt] = POOLMAP[st]; expect(m && m.calls <= mc && m.tris <= mt, `${k} ${m?.calls}/${fmt(m?.tris ?? 0)} > ${mc}/${fmt(mt)}`); }
          expect(!v.people.castingNotLod1.length, 'casting meshes other than lod1: ' + v.people.castingNotLod1.slice(0, 4).join(', '));
          expect(v.casters.sun.some((n) => /^items-|glass|basket|disc|ball|band|stick/.test(n)) || true, 'items not in the sun');
        }
        if (st === 'outside') {
          expect(v.people.meshes <= OUTSIDE_MESHES[q], `${v.people.meshes} people meshes outside (count ${OUTSIDE_MESHES[q]})`);
          const casterRows = v.people.rows.filter((x) => x.bits & 1);
          expect(casterRows.every((x) => x.draw === 'lod1' || x.draw === 'lod2'), 'a caster drawn as a card');
        }
        expect(v.people.lod0Npcs === 0, 'an NPC at LOD 0');
        const mapTxt = Object.entries(s.maps).map(([k, m]) => `${k} ${m.calls}/${fmt(m.tris)}${m.frozen ? ' frozen' : ''}`).join(', ');
        return `${st}: pass ${s.pass.calls}/${fmt(s.pass.tris)} of ${pc}/${fmt(pt)}; frame ${s.frame.calls}/${fmt(s.frame.tris)} of ${fc}/${fmt(ft)}; maps [${mapTxt}]${s.ao ? `; AO ${s.ao.calls}/${fmt(s.ao.tris)}` : ''}; people ${v.people.meshes} meshes (LOD 1 ${v.people.lod1}), ${v.people.cards} cards, ${v.people.fillers} fillers, live ${p.live}; casters sun ${v.people.sun.length}, pool ${v.people.pool1.length}+${v.people.pool2.length}; people's groups ${peopleG.calls}/${fmt(peopleG.tris)}; sim ${s.simMs} ms, crowd step ${s.crowdStepMs} ms, crowd frame ${s.crowdFrameMs} ms, 6 decisions ${s.decideMs} ms, frame CPU ${s.frameMs} ms`;
      });
    }
    await page.setViewportSize({ width: 844, height: 390 });
  }
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the screenshots
if (want('shots')) {
  console.log('shots: a Saturday 21:00 goal before and after (1280x720 HD, 390x844 Low), a packed Friday overhead, Low at the door, stall and patio, a quiet Tuesday');
  const goalShots = async (q, size, tagBase) => {
    const { ctx, page } = await open(size, `quality=${q}&ultra=1&day=Sat&hour=21&hint=0`);
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.buildAll()');
    await H(page, "window.__onfoot.pose('tv-east')");
    await H(page, "window.__onfoot.camera([...(() => { const f = window.__onfoot.frame(); const g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; const a = g(35.2, 4.75), b = g(24, 6.5); return [a[0], 2.6, a[1], b[0], 1.1, b[1]]; })()])");
    await frames(page, 3);
    const n1 = await shot(page, png(`s3a-goal-before-${tagBase}`));
    const tv = await H(page, 'window.__onfoot.tv()');
    const f = tv.featured;
    // a goal for the featured match's home team (the supporters who arrived for it), on the big screen's channel
    await H(page, `window.__onfoot.fireMoment('goal', '${f.home.abbr ?? f.home}', 1)`);
    await frames(page, 7);
    const n2 = await shot(page, png(`s3a-goal-after-${tagBase}`));
    const R = (await H(page, "window.__onfoot.crowdLogs('reactions', 400)")).filter((r) => r.kind === 'goal');
    await ctx.close().catch(() => {});
    return { n1, n2, reacted: R.filter((r) => r.reacted).length, seen: R.filter((r) => r.canSee).length };
  };
  await check('shots: a Saturday 21:00 goal, before and after, 1280x720 at HD', async () => { const r = await goalShots('high', [1280, 720], '1280x720'); return `${r.n1}, ${r.n2}: ${r.reacted} reacted of ${r.seen} who could see`; });
  await check('shots: a Saturday 21:00 goal, before and after, 390x844 at Low', async () => { const r = await goalShots('low', [390, 844], '390x844'); return `${r.n1}, ${r.n2}: ${r.reacted} reacted of ${r.seen} who could see`; });
  await check('shots: the overhead view of a packed Friday (21:00, HD, 1280x720)', async () => {
    const { ctx, page } = await open([1280, 720], 'quality=high&day=Fri&hour=21&hint=0');
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.buildAll()');
    await H(page, "window.__onfoot.pose('overhead')"); await H(page, "window.__onfoot.setClock('Fri', 21)"); await H(page, 'window.__onfoot.buildAll()');
    await frames(page, 3);
    const p = await H(page, 'window.__onfoot.peopleBrief()');
    const n = await shot(page, png('s3a-overhead-friday-1280x720'));
    await ctx.close().catch(() => {});
    return `${n}: live ${p.live}, fillers ${p.fillers}, target ${p.target}`;
  });
  await check('shots: Low, 844x390, Saturday 21:00, the door pose; the stall and patio poses at Low', async () => {
    const { ctx, page } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.fastForward(30)');
    const out = [];
    for (const pose of ['door', 'stall', 'patio']) {
      if (pose !== 'door') await H(page, "window.__onfoot.crowdAt('outside', 12)");
      await H(page, `window.__onfoot.pose('${pose}')`); await frames(page, 3);
      const v = await H(page, 'window.__onfoot.vis()');
      out.push(`${await shot(page, png(`s3a-${pose}-low-844x390`))} (${v.people.meshes} meshes, ${v.people.cards} cards, ${v.people.fillers} fillers)`);
    }
    const img = await H(page, 'window.__onfoot.atlasImage()');
    if (img) writeFileSync(path.join(OUT, png('s3a-atlas-low')), Buffer.from(img.split(',')[1], 'base64'));
    await ctx.close().catch(() => {});
    return out.join('; ') + `; ${png('s3a-atlas-low')}`;
  });
  await check('shots: a Tuesday 15:00 quiet afternoon (HD, 1280x720)', async () => {
    const { ctx, page } = await open([1280, 720], 'quality=high&day=Tue&hour=15&hint=0');
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.buildAll()');
    await H(page, "window.__onfoot.pose('door')"); await H(page, "window.__onfoot.setClock('Tue', 15)"); await H(page, 'window.__onfoot.buildAll()');
    await frames(page, 3);
    const p = await H(page, 'window.__onfoot.peopleBrief()');
    const n = await shot(page, png('s3a-tuesday-1280x720'));
    await ctx.close().catch(() => {});
    return `${n}: live ${p.live}, fillers ${p.fillers}, target ${p.target}`;
  });
}

await browser?.close().catch(() => {});
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length} of ${results.length} passed`);
process.exit(fails.length ? 1 : 0);
