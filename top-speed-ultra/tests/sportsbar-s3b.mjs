// Phase S3b checks for the sports bar's page (PROJECT_OC_SPORTS_BAR.md, "### S3b: interactions, relationships and
// conversations"). Drives dist/sportsbar/sportsbar.html (build it with
// `npx vite build --config src/onfoot/vite.sportsbar.config.ts`) in headless Chromium with SwiftShader through
// window.__onfoot and prints PASS or FAIL with the numbers each check saw. Screenshots go in tests/out/sportsbar/;
// results are merged into tests/out/sportsbar/sportsbar-s3b-checks.json after every check. The relationship maths'
// unit tests are tests/sportsbar-social.mjs (Node, no browser).
//
//   node tests/sportsbar-s3b.mjs                         every group
//   node tests/sportsbar-s3b.mjs --only=smoke,adverts    some groups: smoke, adverts, talk, interactions, persist,
//                                                         games, budgets, shots
//   --tag=r1   a suffix for every screenshot's name;   --presets=low,high,ultra   the budgets' presets
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
const CHECKS = path.join(OUT, 'sportsbar-s3b-checks.json');
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
const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t;
const CAP = { low: 36, high: 70, ultra: 100 };
/** the plan's update, worked in the test (not read from the page) */
const step = (r, d) => Math.max(-100, Math.min(100, r + d * (1 - Math.abs(r) / 150)));
const fstep = (f, d) => Math.max(-100, Math.min(100, f + (d > 0 ? 0.35 : 0.15) * d * (1 - Math.abs(f) / 150)));
/** the table, as the plan writes it (the test's own copy): rapport and needs, accepted and not */
const TABLE = {
  talk: { acc: [6, { social: 12 }], rej: [-3, { social: 2 }] }, joke: { acc: [9, { fun: 6, social: 8 }], rej: [-6, {}] }, cheer: { acc: [5, { fun: 5 }], rej: [0, {}] },
  'high-five': { acc: [8, {}], rej: [-2, {}] }, toast: { acc: [7, { social: 8 }], rej: [0, {}] }, round: { acc: [15, {}], rej: [0, {}] }, introduce: { acc: [5, {}], rej: [-2, {}] },
  challenge: { acc: [0, {}], rej: [-1, {}] }, team: { acc: [4, {}], rej: [0, {}] }, console: { acc: [8, {}], rej: [-2, {}] }, goodbye: { acc: [2, {}], rej: [0, {}] },
};
const GAME = { pool: { fun: 40, social: 15, energy: -4 }, darts: { fun: 30, social: 10 }, shuffleboard: { fun: 35, social: 12 } };

// ------------------------------------------------------------------------------------------------ smoke
if (want('smoke')) {
  console.log('smoke: 844x390, Low, Saturday 21:00, week 43');
  const { ctx, page, errors, bootS } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await check('smoke: boots with the crowd in talking groups, no console errors', async () => {
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
    const ff = await H(page, 'window.__onfoot.fastForward(3)');
    const g = await H(page, 'window.__onfoot.groups()'), rep = await H(page, 'window.__onfoot.socialReport()');
    summary.smoke = { bootS, groups: g.length, sizes: g.map((x) => x.size), rep, errors };
    expect(!errors.length, errors.join(' | '));
    expect(g.length > 0 && g.every((x) => x.size >= 2 && x.size <= 6), `groups ${JSON.stringify(g.map((x) => x.size))}`);
    return `boot ${bootS} s; ${g.length} groups (sizes ${g.map((x) => x.size).join(',')}), ${rep.pairs} pairs; mood ${ff.mood}`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ people advertise
if (want('adverts')) {
  console.log('adverts: 844x390, Low, Saturday 21:00, a 20 sim-minute fast-forward');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await H(page, 'window.__onfoot.fastForward(20)');
  const decisions = await H(page, 'window.__onfoot.decisions(3000)');
  const ads = await H(page, "window.__onfoot.socialLogs('personAds', 300)");
  const talks = await H(page, "window.__onfoot.socialLogs('talks', 600)");
  const inter = await H(page, "window.__onfoot.socialLogs('interactions', 600)");
  await check('adverts: no decision scores more than 8 people or 89 adverts (at most 41 objects and 48 people\'s)', async () => {
    const real = decisions.filter((d) => d.adverts);
    const maxP = Math.max(...real.map((d) => d.people)), maxA = Math.max(...real.map((d) => d.adverts.total)), maxO = Math.max(...real.map((d) => d.adverts.objects)), maxPA = Math.max(...real.map((d) => d.adverts.people));
    summary.adverts = { decisions: real.length, maxPeople: maxP, maxAdverts: maxA, maxObjects: maxO, maxPeopleAds: maxPA, withPeople: real.filter((d) => d.people > 0).length, chosePerson: real.filter((d) => d.inter).length };
    expect(real.length > 100, `only ${real.length} decisions`);
    expect(maxP <= 8 && maxA <= 89 && maxO <= 41 && maxPA <= 48, JSON.stringify(summary.adverts));
    return `${real.length} decisions: at most ${maxP} people, ${maxA} adverts (${maxO} objects, ${maxPA} people's); ${summary.adverts.withPeople} with people in them; ${summary.adverts.chosePerson} chose an interaction`;
  });
  await check('adverts: every person advert\'s score uses the expected deltas (p x accepted + (1 - p) x not, worked in the test from the logged p)', async () => {
    let n = 0, bad = [];
    const urg = (v) => 0.2 + 1.8 * ((100 - v) / 100) ** 2;
    for (const d of ads) {
      const t = d.traits, m = { hunger: 1, thirst: 1, bladder: 1, fun: 0.8 + 0.4 * t.playful, social: 0.6 + 0.8 * t.outgoing, energy: 1.2 - 0.4 * t.active };
      for (const a of d.ads) {
        n++;
        const T0 = TABLE[a.kind], acc = a.kind === 'challenge' ? null : T0.acc[1], rej = T0.rej[1];
        // a challenge's accepted deltas are its game's: the logged deltas say which (fun 40, 30 or 35 x p)
        const gameAcc = a.kind === 'challenge' ? GAME[a.game] ?? {} : null;
        const A = acc ?? gameAcc, exp = {};
        for (const k of new Set([...Object.keys(A), ...Object.keys(rej)])) exp[k] = a.p * (A[k] ?? 0) + (1 - a.p) * (rej[k] ?? 0);
        for (const k of new Set([...Object.keys(exp), ...Object.keys(a.deltas)])) if (!near(exp[k] ?? 0, a.deltas[k] ?? 0, 2e-3)) bad.push(`${a.kind} ${k} ${exp[k]} vs ${a.deltas[k]}`);
        let needs = 0; for (const k of Object.keys(exp)) { if (!exp[k]) continue; needs += m[k] * Math.min(exp[k], 100 - d.needs[k]) * urg(d.needs[k]); }
        if (!near(needs, a.needs, 5e-3)) bad.push(`${a.kind} needs term ${needs.toFixed(4)} vs ${a.needs}`);
      }
    }
    const kinds = [...new Set(ads.flatMap((d) => d.ads.map((a) => a.kind)))];
    summary.advertsExpected = { decisions: ads.length, adverts: n, kinds, bad: bad.slice(0, 10) };
    expect(n > 50, `only ${n} person adverts logged`);
    expect(!bad.length, bad.slice(0, 5).join('; '));
    return `${n} person adverts in ${ads.length} decisions, kinds ${kinds.join(', ')}: every expected delta and needs term matches the test's own working`;
  });
  await check('adverts: every accepted Talk or Join leaves both in one group of 2 to 6', async () => {
    const acc = talks.filter((t) => t.accepted);
    const bad = acc.filter((t) => !t.bothIn || t.size < 2 || t.size > 6);
    const npcTalks = inter.filter((i) => i.kind === 'talk' && i.actor !== 'you');
    summary.talks = { accepted: acc.length, bad: bad.length, sizes: acc.map((t) => t.size), npcTalks: npcTalks.length, npcAccepted: npcTalks.filter((i) => i.accepted).length, kinds: [...new Set(inter.map((i) => i.kind))] };
    expect(acc.length >= 3, `only ${acc.length} accepted Talks in 20 sim minutes`);
    expect(!bad.length, JSON.stringify(bad.slice(0, 3)));
    return `${acc.length} accepted Talks and Joins (sizes ${[...new Set(acc.map((t) => t.size))].sort().join(', ')}), all both in one group; guests' interactions in the run: ${inter.filter((i) => i.actor !== 'you').length} (${summary.talks.kinds.join(', ')})`;
  });
  await check('adverts: no console errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); return `${errors.length}`; });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ conversations
if (want('talk')) {
  console.log('talk: 844x390, Low, Saturday 21:00, the door pose, rendered frames');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await H(page, 'window.__onfoot.fastForward(5)');
  await check('talk: in every sampled group, at most one speaker at a time, and listeners face the speaker in at least 70% of samples (bodies by the head, cards by the body)', async () => {
    const out = { samples: 0, groups: 0, multi: 0, inTwo: 0, body: [0, 0], card: [0, 0] };
    for (const pose of ['door', 'tv-east', 'overhead']) {
      await H(page, `window.__onfoot.pose('${pose}')`);
      await frames(page, 3);
      for (let i = 0; i < 12; i++) {
        await frames(page, 1);
        const s = await H(page, 'window.__onfoot.talkSample()');
        out.samples++; out.groups += s.groups; out.multi += s.multi; out.inTwo += s.inTwo; out.body[0] += s.body[0]; out.body[1] += s.body[1]; out.card[0] += s.card[0]; out.card[1] += s.card[1];
      }
    }
    const f = out.body[0] + out.card[0], l = out.body[1] + out.card[1];
    summary.talk = { ...out, share: l ? +(f / l).toFixed(3) : null, errors: errors.length };
    expect(out.multi === 0 && out.inTwo === 0, `two speakers ${out.multi}, someone in two groups ${out.inTwo}`);
    expect(l >= 40, `only ${l} listener looks`);
    expect(f / l >= 0.7, `faced ${f} of ${l}`);
    return `${out.samples} frames over three poses, ${out.groups} group samples: ${out.multi} with two speakers, ${out.inTwo} people in two groups; listeners faced the speaker in ${f} of ${l} (${(100 * f / l).toFixed(0)}%): bodies by the head ${out.body[0]} of ${out.body[1]}, cards by the body ${out.card[0]} of ${out.card[1]}`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ each interaction end to end
if (want('interactions')) {
  console.log('interactions: 844x390, Low, Saturday 21:00; each of the 11 through interact()');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await H(page, 'window.__onfoot.fastForward(5)'); await H(page, 'window.__onfoot.buildAll()');
  await H(page, "window.__onfoot.pose('door')");
  await H(page, 'window.__onfoot.setTokens(80)'); await H(page, 'window.__onfoot.setTeam(null)');
  await H(page, 'window.__onfoot.setNeeds({ hunger: 60, thirst: 60, fun: 50, social: 50, energy: 70 })');
  // guests to work with: live, inside, not in a game, needs under 85 (so the table's deltas aren't cut at 100)
  const guests = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.action !== 'game').map((n) => window.__onfoot.npcInfo(n.id)).filter((x) => x && x.needs.social < 80 && x.needs.fun < 80)`);
  summary.interactions = {};
  const byKind = {};
  /** one interaction, forced accepted or not, checked against the table: rapport and friendship by the plan's update,
   *  both people's needs by the table, the memory, the caption and the beat */
  const run = async (id, kind, outcome, o = {}) => {
    const r = await H(page, `window.__onfoot.interact(${id}, '${kind}', ${JSON.stringify({ outcome, ...o })})`);
    if (!r.ok) throw new Error(`${kind}: ${r.why} (offered ${JSON.stringify(r.offered)})`);
    const T0 = TABLE[kind][outcome === 'accept' ? 'acc' : 'rej'], d = T0[0];
    const errs = [];
    if (kind !== 'round' && kind !== 'introduce') {
      const r0 = r.before.rel.rapport, f0 = r.before.rel.friendship;
      if (!near(r.after.rel.rapport, step(r0, d), 2e-3)) errs.push(`rapport ${r0} -> ${r.after.rel.rapport}, wanted ${step(r0, d).toFixed(4)}`);
      if (!near(r.after.rel.friendship, fstep(f0, d), 2e-3)) errs.push(`friendship ${f0} -> ${r.after.rel.friendship}, wanted ${fstep(f0, d).toFixed(4)}`);
      for (const [k, v] of Object.entries(T0[1])) { const dy = r.after.you[k] - r.before.you[k], dt = r.after.them[k] - r.before.them[k]; if (!near(dy, Math.min(v, 100 - r.before.you[k]), 2e-3) || !near(dt, Math.min(v, 100 - r.before.them[k]), 2e-3)) errs.push(`${k}: you +${dy.toFixed(3)}, them +${dt.toFixed(3)}, wanted +${v}`); }
      if (!r.memory || r.memory.kind !== kind || r.memory.good !== (outcome === 'accept') || !near(r.memory.delta, d)) errs.push(`memory ${JSON.stringify(r.memory)}`);
    }
    if (!r.caption) errs.push('no caption');
    const log = await H(page, 'window.__onfoot.lifeLog(12)');
    if (!log.some((l) => l.what.startsWith(`beat ${kind}`))) errs.push('no beat in the log');
    byKind[`${kind} ${outcome}`] = { p: r.p, rapport: [r.before.rel.rapport, r.after.rel.rapport], caption: r.caption, errs };
    if (errs.length) throw new Error(`${kind} ${outcome}: ${errs.join('; ')}`);
    return r;
  };
  const A = guests[0], B = guests.find((g) => g.party !== A.party && g.group !== A.group) ?? guests[1];
  await check('interactions: Talk accepted (+6; social +12 both; you join their group; the reply chips: warm +2, quip +4 or -2), Talk not accepted (-3; social +2), each with its caption and beat', async () => {
    const r = await run(A.id, 'talk', 'accept');
    expect(r.group && r.group.includes(0) && r.group.includes(A.id), `you're not in ${A.name}'s group: ${JSON.stringify(r.group)}`);
    const ex = await H(page, 'window.__onfoot.exchange()'); expect(ex && ex.chips, 'no reply chips');
    const chipsShown = await H(page, "document.getElementById('chips').classList.contains('on')");
    const before = (await H(page, `window.__onfoot.rel(${A.id})`)).rapport;
    const w = await H(page, 'window.__onfoot.reply(0)');
    expect(near(w.rapport, step(before, 2), 2e-3), `warm: ${before} -> ${w.rapport}`);
    const q = await H(page, 'window.__onfoot.reply(1)');
    const qd = A.traits.playful > 0.5 ? 4 : -2;
    expect(near(q.rapport, step(w.rapport, qd), 2e-3), `quip (${A.name} playful ${A.traits.playful.toFixed(2)}): ${w.rapport} -> ${q.rapport}, wanted ${step(w.rapport, qd).toFixed(4)}`);
    const rb = await run(B.id, 'talk', 'reject');
    summary.interactions.talk = { with: A.name, chipsShown, warm: w, quip: q, rejected: B.name };
    return `${A.name}: rapport ${r.before.rel.rapport} -> ${r.after.rel.rapport}, "${r.caption}"; chips shown ${chipsShown}; warm -> ${w.rapport}, quip (${qd > 0 ? 'playful' : 'not playful'}) -> ${q.rapport}, exchanges ${q.exchanges}, wrap at ${q.wrapAt}; ${B.name} said no: ${rb.before.rel.rapport} -> ${rb.after.rel.rapport}`;
  });
  await check('interactions: Joke accepted (+9; fun +6, social +8), Cheer together (+5; fun +5) within 8 s of a goal, High-five (+8) after a goal for a team you share, Toast (+7; social +8) holding drinks', async () => {
    const out = [];
    const j = await run(A.id, 'joke', 'accept'); out.push(`joke ${j.before.rel.rapport}->${j.after.rel.rapport}`);
    const tv = await H(page, 'window.__onfoot.tv()'); const f = tv.featured; const home = f.home.abbr ?? f.home;
    // Cheer: you neutral, a goal for the home side; the target supports it or no one
    const cands = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.action !== 'game' && (n.team === null || n.team === '${home}')).map((n) => n.id)`);
    await H(page, `window.__onfoot.fireMoment('goal', '${home}', 1)`);
    expect(cands.length, 'nobody neutral or backing the scorers');
    const c = await run(cands[0], 'cheer', 'accept'); out.push(`cheer ${c.before.rel.rapport}->${c.after.rel.rapport}`);
    // High-five: back the home side, a goal for it, a target who backs it too
    await H(page, `window.__onfoot.setTeam('${home}')`);
    const fans = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.team === '${home}' && n.action !== 'game').map((n) => n.id)`);
    expect(fans.length, 'no guest backs the home side');
    await H(page, `window.__onfoot.fireMoment('goal', '${home}', 1)`);
    const h = await run(fans[0], 'high-five', 'accept'); out.push(`high-five ${h.before.rel.rapport}->${h.after.rel.rapport}`);
    // Toast: both holding a drink, after a goal (or friendship 20)
    await H(page, "window.__onfoot.giveYou('lime-soda')");
    const drinkers = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.holding.drink && n.action !== 'game').map((n) => n.id)`);
    expect(drinkers.length, 'nobody holding a drink');
    const t = await run(drinkers[0], 'toast', 'accept'); out.push(`toast ${t.before.rel.rapport}->${t.after.rel.rapport} ("${t.caption}")`);
    await H(page, 'window.__onfoot.setTeam(null)');
    return out.join('; ');
  });
  await check('interactions: Buy a round costs 4 house tokens a person (+15 with each), is brought by staff in 1 to 2 minutes, and the group can\'t be bought another within 10 sim minutes', async () => {
    // back in A's group (a Talk accepted puts you there)
    await run(A.id, 'talk', 'accept');
    const g = (await H(page, 'window.__onfoot.groups()')).find((x) => x.members.includes('you'));
    expect(g, 'you are in no group');
    const tok0 = (await H(page, 'window.__onfoot.tokens()')).tokens;
    const r = await H(page, `window.__onfoot.interact(${A.id}, 'round', { outcome: 'accept' })`);
    expect(r.ok && r.accepted, JSON.stringify(r));
    const tok1 = (await H(page, 'window.__onfoot.tokens()')).tokens;
    expect(tok0 - tok1 === 4 * g.size, `tokens ${tok0} -> ${tok1} for a group of ${g.size}`);
    const again = await H(page, `window.__onfoot.interact(${A.id}, 'round', { outcome: 'accept' })`);
    expect(!again.ok || !again.accepted, 'a second round inside 10 minutes: ' + JSON.stringify(again));
    const rounds0 = await H(page, "window.__onfoot.socialLogs('rounds', 5)");
    const rel = await H(page, 'window.__onfoot.rel()');
    await H(page, 'window.__onfoot.fastForward(2.2)');
    const rounds = await H(page, "window.__onfoot.socialLogs('rounds', 5)"); const last = rounds.filter((x) => x.accepted).pop();
    const dt = last.delivered !== null ? (last.delivered - last.t) * 60 : null;
    expect(dt !== null && dt >= 55 && dt <= 135, `delivered after ${dt} sim s`);
    const held = await H(page, 'window.__onfoot.held()');
    summary.interactions.round = { size: g.size, tokens: [tok0, tok1], again, deliveredS: dt, members: last.members, youHold: held.drink };
    const after11 = await H(page, `(() => { window.__onfoot.fastForward(8.5); return window.__onfoot.offeredTo(${A.id}).map((o) => o.kind); })()`);
    return `a round for ${g.size}: ${tok0} -> ${tok1} tokens (${4 * g.size}); a second within 10 minutes: ${again.why ?? (again.accepted ? 'accepted!' : 'declined')}; brought after ${dt?.toFixed(0)} sim s; you hold ${held.drink?.name ?? 'nothing'}; after 10.7 sim minutes Buy a round is ${after11.includes('round') ? 'offered again' : 'not offered (' + after11.join(', ') + ')'}; your pairs ${rel.you.length}`;
  });
  await check('interactions: Introduce (A and B start at rapport 10 + 0.3 min(your friendships), +5 with you), Ask about their team (+4; their team on their card), Console (+8; halves "My team lost"), Challenge (starts a game with them), Say goodbye (+2; you leave the group)', async () => {
    const out = [];
    // Introduce: you've met A and B (a Talk each); they haven't met
    const rA = await H(page, `window.__onfoot.rel(${A.id})`), rB = await H(page, `window.__onfoot.rel(${B.id})`);
    const before = await H(page, `window.__onfoot.rel(${A.id}, ${B.id})`);
    expect(before.level === 'Stranger', `${A.name} and ${B.name} have met already`);
    await H(page, `window.__onfoot.go(...(() => { const i = window.__onfoot.npcInfo(${A.id}); const n = window.__onfoot.npcs().find((x) => x.id === ${A.id}); const f = window.__onfoot.frame(); return [f.O[0] + n.u * f.A[0] + n.v * f.B[0] + 0.9, f.O[1] + n.u * f.A[1] + n.v * f.B[1]]; })())`);
    const i = await H(page, `window.__onfoot.interact(${A.id}, 'introduce', { outcome: 'accept', second: ${B.id}, force: true })`);
    expect(i.ok && i.accepted, JSON.stringify(i).slice(0, 200));
    const ab = await H(page, `window.__onfoot.rel(${A.id}, ${B.id})`), yA = await H(page, `window.__onfoot.rel(${A.id})`), yB = await H(page, `window.__onfoot.rel(${B.id})`);
    const start = 10 + 0.3 * Math.min(rA.friendship, rB.friendship);
    expect(near(ab.rapport, start, 2e-3), `${A.name}-${B.name} rapport ${ab.rapport}, wanted ${start.toFixed(4)}`);
    expect(near(yA.rapport, step(rA.rapport, 5), 2e-3) && near(yB.rapport, step(rB.rapport, 5), 2e-3), `you-A ${rA.rapport} -> ${yA.rapport}; you-B ${rB.rapport} -> ${yB.rapport}`);
    out.push(`introduce: ${A.name}-${B.name} at ${ab.rapport} (10 + 0.3 min(${rA.friendship.toFixed(2)}, ${rB.friendship.toFixed(2)})), with you +5 each`);
    // Team: a guest with a team
    const teamed = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.team && n.action !== 'game').map((n) => n.id)`);
    const tm = await run(teamed[0], 'team', 'accept');
    const card = await H(page, `window.__onfoot.card(${teamed[0]})`);
    expect(card.team && card.shown, `card ${JSON.stringify(card)}`);
    await H(page, 'window.__onfoot.closeSheets()'); await H(page, "document.querySelector('#card [data-close]').click()");
    out.push(`team: ${tm.before.rel.rapport}->${tm.after.rel.rapport}; the card shows "${card.team}"`);
    // Console: a guest whose team just lost (the setup sets it as a seen final whistle does; the reactions check of S3a
    // covers the whistle itself)
    const teamedL = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.team && n.action !== 'game' && n.id !== ${teamed[0]}).map((n) => n.id)`);
    expect(teamedL.length, 'no guest with a team');
    await H(page, `window.__onfoot.npcTeamLost(${teamedL[0]})`);
    const losers = [teamedL[0]], loser = (await H(page, `window.__onfoot.npcInfo(${teamedL[0]})`)).team;
    const ml0 = (await H(page, `window.__onfoot.npcMoodlets(${losers[0]})`)).find((m) => m.id === 'team-lost');
    const co = await run(losers[0], 'console', 'accept');
    const ml1 = (await H(page, `window.__onfoot.npcMoodlets(${losers[0]})`)).find((m) => m.id === 'team-lost');
    expect(ml0 && ml1 && near(ml1.value, ml0.value / 2, 0.05), `team-lost ${JSON.stringify(ml0)} -> ${JSON.stringify(ml1)}`);
    out.push(`console (${loser} lost): ${co.before.rel.rapport}->${co.after.rel.rapport}; "My team lost" ${ml0.value} -> ${ml1.value}`);
    // Challenge: accepted, you walk to the game and they're your opponent
    // (the guests' own matches fill every table on a busy Saturday: free them first, as a quiet moment would)
    for (const sp of ['pool-1', 'pool-2', 'darts-1', 'darts-2', 'darts-3', 'shuffleboard']) await H(page, `window.__onfoot.stopMatch('${sp}')`);
    const ch = await run(A.id, 'challenge', 'accept');
    expect(ch.started, 'the game did not start: ' + JSON.stringify(ch).slice(0, 200));
    await H(page, 'window.__onfoot.fastForward(1.5)');
    const gs = await H(page, 'window.__onfoot.games()');
    const st = gs.mine ? await H(page, `window.__onfoot.game('${gs.mine}')`) : null;
    const oppName = st?.sides?.[1]?.who ?? null;
    expect(gs.mine && oppName === A.name, `game ${gs.mine}, opponent ${oppName}`);
    await H(page, 'window.__onfoot.leaveGame()');
    out.push(`challenge: ${ch.game} on ${ch.spot}, your opponent ${oppName}`);
    // Say goodbye: in a conversation (a Talk first), +2, you leave the group
    await run(A.id, 'talk', 'accept');
    const gb = await run(A.id, 'goodbye', 'accept');
    const inGroup = (await H(page, 'window.__onfoot.groups()')).some((x) => x.members.includes('you'));
    expect(!inGroup, 'still in a group after goodbye');
    out.push(`goodbye: ${gb.before.rel.rapport}->${gb.after.rel.rapport}, out of the group`);
    summary.interactions.byKind = byKind;
    return out.join('; ');
  });
  await check('interactions: a person\'s card and People here; the radial menu has up to six and "More…", and the "i"', async () => {
    const m = await H(page, `window.__onfoot.personMenu(${A.id})`);
    const ph = await H(page, 'window.__onfoot.peopleHere()');
    await H(page, "document.querySelector('#peopleSheet [data-close]').click()");
    expect(m && m.items.length >= 1 && m.items.length <= 7 && m.info, JSON.stringify(m));
    expect(ph.shown && ph.rows.length >= 3 && ph.rows.every((r, i) => i === 0 || ph.rows[i - 1].friendship >= r.friendship), JSON.stringify(ph.rows.slice(0, 4)));
    summary.interactions.menu = m; summary.interactions.people = ph.rows;
    await H(page, 'window.__onfoot.closeRadial()');
    return `${A.name}'s menu: ${m.items.map((x) => x.label).join(' · ')} (+ "i"); People here: ${ph.rows.map((r) => `${r.name} ${r.level} ${r.friendship}`).join(', ')}`;
  });
  await check('interactions: the sparks and puffs are in the HUD layer (no draw calls)', async () => {
    await H(page, "window.__onfoot.pose('door')"); await frames(page, 2);
    await H(page, 'window.__onfoot.freeze(true)');
    const s0 = await H(page, 'window.__onfoot.render()');
    const vis = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && n.dist < 12 && (n.draw === 'lod1' || n.draw === 'lod2')).map((n) => n.id)`);
    let shown = 0, els = 0;
    for (const id of vis.slice(0, 6)) { const r = await H(page, `window.__onfoot.sparkOn(${id}, ${id % 2 === 0})`); shown += r.shown; els = Math.max(els, r.els); }
    const s1 = await H(page, 'window.__onfoot.render()');
    const dom = await H(page, "[...document.querySelectorAll('#sparks .spark.on')].map((e) => e.textContent + '@' + e.style.left + ',' + e.style.top)");
    await H(page, 'window.__onfoot.freeze(false)');
    expect(shown > 0 && els > 0, `no spark shown (${vis.length} candidates)`);
    expect(s1.calls === s0.calls && s1.triangles === s0.triangles, `calls ${s0.calls} -> ${s1.calls}`);
    return `${shown} sparks and puffs on screen (${dom.slice(0, 4).join(' ')}); the frame ${s0.calls} calls / ${fmt(s0.triangles)} before and ${s1.calls} / ${fmt(s1.triangles)} with them`;
  });
  await check('interactions: no console errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); return `${errors.length}`; });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ persistence
if (want('persist')) {
  console.log('persist: 844x390, Low; a regular\'s friendship across a reload');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.fastForward(2)');
  await check('persist: your friendship with a regular round-trips across a reload (rapport, this visit\'s, starts again at 0)', async () => {
    const regs = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.regular && !n.walking && n.action !== 'game').map((n) => n.id)`);
    expect(regs.length, 'no regular in the room');
    const id = regs[0];
    for (const k of ['talk', 'joke', 'team']) await H(page, `window.__onfoot.interact(${id}, '${k}', { outcome: 'accept', force: true })`);
    const before = await H(page, `window.__onfoot.rel(${id})`);
    await H(page, 'window.__onfoot.saveNow()');
    await page.reload();
    await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
    const loaded = await H(page, 'window.__onfoot.relsLoaded()');
    const all = await H(page, 'window.__onfoot.rel()');
    const row = all.you.find((r) => r.with === before.b);
    summary.persist = { before: { friendship: before.friendship, rapport: before.rapport, mem: before.mem.length }, loaded, after: row ? { friendship: row.friendship, rapport: row.rapport, mem: row.mem.length, highlights: row.highlights.length } : null, known: all.known };
    expect(row && near(row.friendship, before.friendship, 1e-2) && row.rapport === 0 && row.mem.length === before.mem.length, JSON.stringify(summary.persist));
    expect(all.known.includes(before.b), 'their team is forgotten');
    return `${before.name} (${before.b}): friendship ${before.friendship} -> ${row.friendship} after the reload (${loaded} pairs loaded), rapport ${before.rapport} -> ${row.rapport}, ${row.mem.length} memories, ${row.highlights.length} highlights, their team still known`;
  });
  await check('persist: no console errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); });
  await H(page, "localStorage.removeItem('oc.onfoot.sportsbar.v1')");
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ guests' games
if (want('games')) {
  console.log('games: 844x390, Low, Saturday 21:00; a pool match on the physics, one off screen, invites');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.fastForward(2)'); await H(page, 'window.__onfoot.buildAll()');
  const two = async () => H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.action !== 'game' && n.action !== 'interact').slice(0, 12).map((n) => n.id)`);
  const toG = (u, v) => `(() => { const f = window.__onfoot.frame(); return [f.O[0] + ${u} * f.A[0] + ${v} * f.B[0], f.O[1] + ${u} * f.A[1] + ${v} * f.B[1]]; })()`;
  await check('games: an on-screen guests\' pool match uses the physics (shots on the table, the balls moving, energy never rising)', async () => {
    await H(page, `window.__onfoot.go(...${toG(11.0, 4.6)})`); await H(page, 'window.__onfoot.look(0, -20)');
    const ids = await two();
    await H(page, "window.__onfoot.stopMatch('pool-1')");
    const r = await H(page, `window.__onfoot.npcMatch('pool-1', ${ids[0]}, ${ids[1]})`);
    expect(r.ok, 'no match');
    await H(page, 'window.__onfoot.fastForward(2)');
    const st = (await H(page, 'window.__onfoot.matches()')).find((m) => m.spot === 'pool-1') ?? null;
    const g = await H(page, "window.__onfoot.game('pool-1')");
    const log = g.npc ? g.npc.log : (await H(page, "window.__onfoot.socialLogs('matches', 50)"));
    const phys = (g.npc?.log ?? []).filter((x) => x.mode === 'physics');
    summary.gamesPhysics = { mode: g.npc?.mode, shots: g.npc?.shots, physics: phys.length, maxEnergyRise: g.npc?.maxEnergyRise, onTable: g.npc?.onTable, match: st };
    expect(g.npc && g.npc.mode === 'physics' && phys.length >= 2, JSON.stringify(summary.gamesPhysics).slice(0, 300));
    expect(g.npc.maxEnergyRise < 1e-6, `energy rose by ${g.npc.maxEnergyRise}`);
    return `pool-1, you 2.3 m away: ${g.npc.sides.map((s) => s.name).join(' v ')}, mode ${g.npc.mode}, ${g.npc.shots} shots in 2 sim minutes, ${phys.length} on the physics (${phys.map((x) => x.potted.length).reduce((a, b) => a + b, 0)} balls potted), ${g.npc.onTable} balls on the table; the largest energy rise in a shot ${g.npc.maxEnergyRise}; void ${JSON.stringify(log).length > 0}`;
  });
  await check('games: one off screen is resolved statistically, and when you walk up the balls are laid out for the counts left', async () => {
    // far from pool-2 (the standing floor's east end, 18 m off) and looking away from it, at the big screen
    await H(page, `window.__onfoot.go(...${toG(34.5, 4.75)})`); await H(page, `window.__onfoot.look(${await H(page, `(() => { const f = window.__onfoot.frame(); const dx = f.A[0], dz = f.A[1]; return Math.atan2(dx, dz) * 180 / Math.PI; })()`)}, 0)`);
    await frames(page, 2);
    const ids = (await two()).filter((x) => x);
    await H(page, "window.__onfoot.stopMatch('pool-2')");
    const r = await H(page, `window.__onfoot.npcMatch('pool-2', ${ids[2]}, ${ids[3]})`);
    expect(r.ok, 'no match');
    const m0 = await H(page, "window.__onfoot.game('pool-2')");
    expect(m0.npc && m0.npc.mode === 'stat', `mode ${m0.npc?.mode}`);
    await H(page, 'window.__onfoot.fastForward(2.5)');
    const m1 = await H(page, "window.__onfoot.game('pool-2')");
    const stat = (m1.npc?.log ?? []).filter((x) => x.mode === 'stat'), potted = stat.reduce((a, x) => a + x.potted.length, 0);
    expect(m1.npc && m1.npc.mode === 'stat' && stat.length >= 3, `log ${JSON.stringify(m1.npc?.log?.slice(-4))}`);
    const left0 = m1.npc.sides.map((s) => s.left), groups = m1.npc.sides.map((s) => s.group), onTable0 = m1.npc.onTable;
    // walk up: within 15 m
    await H(page, `window.__onfoot.go(...${toG(15.3, 4.4)})`); await H(page, 'window.__onfoot.look(0, -20)');
    await H(page, 'window.__onfoot.fastForward(0.05)');
    const m2 = await H(page, "window.__onfoot.game('pool-2')");
    const lay = m2.npc?.lays?.[0];
    summary.gamesStat = { turns: stat.length, potted, left: left0, groups, onTable: onTable0, mode2: m2.npc?.mode, lay, seconds: stat.map((x) => x.seconds) };
    expect(m2.npc && m2.npc.mode === 'physics' && lay, JSON.stringify(summary.gamesStat).slice(0, 300));
    expect(lay.onTable === 15 - potted && lay.onTable === onTable0 - 1, `laid out ${lay.onTable} object balls; ${potted} potted of 15; ${onTable0} on the table with the cue`);
    if (groups[0]) expect(lay.left[0] === left0[0] && lay.left[1] === left0[1], `left ${JSON.stringify(lay.left)} vs ${JSON.stringify(left0)}`);
    const balls = m2.npc.balls; let minGap = Infinity; for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) minGap = Math.min(minGap, Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y));
    expect(minGap >= 0.056 - 1e-3, `two balls ${minGap} apart`);
    return `pool-2 off screen: ${stat.length} statistical turns (${stat.map((x) => x.seconds + ' s').join(', ')}), ${potted} balls potted (groups ${groups.join('/')}; left ${left0.join(', ')}); walking up: mode ${m2.npc.mode}, ${lay.onTable} object balls laid out (15 - ${potted}), left ${lay.left.join(', ')}, the closest two ${minGap.toFixed(3)} m apart (2r = 0.056)`;
  });
  await check('games: guests invite partners by relationship and competitiveness over 20 sim minutes (recorded)', async () => {
    await H(page, "window.__onfoot.pose('door')");
    await H(page, 'window.__onfoot.fastForward(20)');
    const L = await H(page, "window.__onfoot.socialLogs('matches', 400)");
    const inv = L.filter((x) => x.event === 'invite'), starts = L.filter((x) => x.event === 'start'), ends = L.filter((x) => x.event === 'end');
    summary.gamesInvites = { invites: inv.length, accepted: inv.filter((x) => x.accepted).length, solo: inv.filter((x) => x.solo).length, dropped: inv.filter((x) => x.dropped).length, starts: starts.map((x) => `${x.kind} ${x.why} ${x.mode}`), ends: ends.map((x) => `${x.kind} ${x.winner} ${x.close ? 'close' : ''} ${x.relDelta}`), sample: inv.slice(0, 3) };
    return `${inv.length} invites (${summary.gamesInvites.accepted} accepted, ${summary.gamesInvites.solo} solo darts, ${summary.gamesInvites.dropped} dropped); matches started ${starts.length} (${summary.gamesInvites.starts.slice(0, 6).join('; ')}); ended ${ends.length} (${summary.gamesInvites.ends.slice(0, 4).join('; ')})`;
  });
  await check('games: no console errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); });
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
  console.log('budgets: S3a\'s run with groups talking and guests\' games in play: 844x390 (and 390x844 for door and overhead), Saturday 21:00, week 43, seed 1, the caps reached, every item at its cap');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await H(page, 'window.__onfoot.fastForward(30)');
  await check('budgets: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  const ensureGames = async () => {
    const ms = await H(page, 'window.__onfoot.matches()');
    const ids = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.action !== 'game' && n.action !== 'interact').slice(0, 8).map((n) => n.id)`);
    let k = 0;
    for (const spot of ['pool-2', 'darts-2']) if (!ms.some((m) => m.spot === spot)) await H(page, `window.__onfoot.npcMatch('${spot}', ${ids[k++]}, ${ids[k++]})`);
    return H(page, 'window.__onfoot.matches()');
  };
  for (const q of PRESETS) {
    await H(page, `window.__onfoot.setQuality('${q}')`);
    await H(page, 'window.__onfoot.buildAll()');
    for (const [pose, size] of [['door', [844, 390]], ['tv-east', [844, 390]], ['stall', [844, 390]], ['patio', [844, 390]], ['overhead', [844, 390]], ['door', [390, 844]], ['overhead', [390, 844]]]) {
      await check(`budgets ${q} ${pose} ${size.join('x')}: with groups talking and guests' games in play, the pass and the frame within the sums; each shadow map within its row; casters by their LOD 1`, async () => {
        await page.setViewportSize({ width: size[0], height: size[1] });
        if (pose === 'stall' || pose === 'patio') await H(page, `window.__onfoot.crowdAt('outside', ${OUTSIDE_MESHES[q]})`);
        const r = await H(page, `window.__onfoot.pose('${pose}')`);
        const ms = await ensureGames();
        await frames(page, 2);
        await H(page, 'window.__onfoot.freeze(true)');
        await H(page, 'window.__onfoot.itemsAtCap(true)');
        const s = await H(page, 'window.__onfoot.stats()'), v = await H(page, 'window.__onfoot.vis()'), p = await H(page, 'window.__onfoot.peopleBrief()'), g = await H(page, 'window.__onfoot.groups()');
        await H(page, 'window.__onfoot.itemsAtCap(false)'); await H(page, 'window.__onfoot.freeze(false)');
        const st = r.state, [pc, pt] = PASS[q][st], [fc, ft] = FRAME[q][st];
        const talking = g.filter((x) => x.present >= 2).length;
        summary.budgets[`${q}-${pose}-${size.join('x')}`] = { state: st, pass: s.pass, frame: s.frame, maps: s.maps, ao: s.ao, people: { meshes: v.people.meshes, lod1: v.people.lod1, cards: v.people.cards }, live: p.live, groups: g.length, talking, matches: ms.map((m) => `${m.spot} ${m.mode}`), simMs: s.simMs, frameMs: s.frameMs, crowdStepMs: s.crowdStepMs, crowdFrameMs: s.crowdFrameMs, decideMs: s.decideMs };
        expect(p.live === CAP[q], `live ${p.live} of ${CAP[q]}`);
        expect(talking >= 1 && ms.length >= 2, `${talking} groups talking, ${ms.length} guests' games`);
        expect(s.pass.calls <= pc && s.pass.tris <= pt, `pass ${s.pass.calls}/${fmt(s.pass.tris)} > ${pc}/${fmt(pt)}`);
        expect(s.frame.calls <= fc && s.frame.tris <= ft, `frame ${s.frame.calls}/${fmt(s.frame.tris)} > ${fc}/${fmt(ft)}`);
        if (q !== 'low') {
          const sun = s.maps.sun, [sc, stt] = SUN[q][st];
          expect(sun && sun.calls <= sc && sun.tris <= stt, `sun map ${sun?.calls}/${fmt(sun?.tris ?? 0)} > ${sc}/${fmt(stt)}`);
          if (q === 'ultra' && st !== 'outside') for (const k of ['pool-1', 'pool-2']) { const m = s.maps[k], [mc, mt] = POOLMAP[st]; expect(m && m.calls <= mc && m.tris <= mt, `${k} ${m?.calls}/${fmt(m?.tris ?? 0)} > ${mc}/${fmt(mt)}`); }
          expect(!v.people.castingNotLod1.length, 'casting meshes other than lod1: ' + v.people.castingNotLod1.slice(0, 4).join(', '));
        }
        if (st === 'outside') expect(v.people.meshes <= OUTSIDE_MESHES[q], `${v.people.meshes} people meshes outside (count ${OUTSIDE_MESHES[q]})`);
        expect(v.people.lod0Npcs === 0, 'an NPC at LOD 0');
        const mapTxt = Object.entries(s.maps).map(([k, m]) => `${k} ${m.calls}/${fmt(m.tris)}${m.frozen ? ' frozen' : ''}`).join(', ');
        return `${st}: pass ${s.pass.calls}/${fmt(s.pass.tris)} of ${pc}/${fmt(pt)}; frame ${s.frame.calls}/${fmt(s.frame.tris)} of ${fc}/${fmt(ft)}; maps [${mapTxt}]; ${g.length} groups (${talking} talking), games ${ms.map((m) => `${m.spot} ${m.mode}`).join(', ')}; people ${v.people.meshes} meshes (LOD 1 ${v.people.lod1}), ${v.people.cards} cards, live ${p.live}; crowd step ${s.crowdStepMs} ms, crowd frame ${s.crowdFrameMs} ms, decisions ${s.decideMs} ms a batch, frame CPU ${s.frameMs} ms`;
      });
    }
    await page.setViewportSize({ width: 844, height: 390 });
  }
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the screenshots
if (want('shots')) {
  console.log('shots: a conversation with the radial menu open and a person\'s card; buying a round and a toast; a guests\' pool match from overhead');
  const { ctx, page, errors } = await open([1280, 720], 'quality=high&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.fastForward(3)');
  await H(page, 'window.__onfoot.setTokens(80)');
  // a standing group near the door side: a guest standing, in a group with others present
  const g = await H(page, `(() => { const o = window.__onfoot; const gs = o.groups().filter((x) => x.present >= 2 && x.size <= 4); const L = o.npcs(); for (const x of gs) { const m = x.members.map((k) => L.find((n) => n.key === k)).filter(Boolean); if (m.every((n) => n.indoor && !n.walking)) return { g: x, ids: m.map((n) => n.id) }; } return null; })()`);
  await check('shots: a conversation with the radial menu open, and a person\'s card (HD, 1280x720)', async () => {
    expect(g, 'no group to join');
    const A = g.ids[0];
    const r = await H(page, `window.__onfoot.interact(${A}, 'talk', { outcome: 'accept' })`);
    expect(r.ok && r.accepted, JSON.stringify(r).slice(0, 200));
    await H(page, "window.__onfoot.view('third')");
    // face the group's centre from where you stand
    await H(page, `(() => { const o = window.__onfoot, p = o.pos(), L = o.npcs(), ms = ${JSON.stringify(g.ids)}.map((id) => L.find((n) => n.id === id)).filter(Boolean); const f = o.frame(); let x = 0, z = 0; for (const n of ms) { x += f.O[0] + n.u * f.A[0] + n.v * f.B[0]; z += f.O[1] + n.u * f.A[1] + n.v * f.B[1]; } x /= ms.length; z /= ms.length; o.look(Math.atan2(x - p.x, z - p.z) * 180 / Math.PI, -8); })()`);
    await H(page, 'window.__onfoot.buildAll()');
    await frames(page, 3);
    const B = g.ids[1] ?? A;
    await H(page, `window.__onfoot.personMenu(${B})`);
    const n1 = await shot(page, png('s3b-conversation-radial-1280x720'));
    await H(page, 'window.__onfoot.closeRadial()');
    const c = await H(page, `window.__onfoot.card(${A})`);
    const n2 = await shot(page, png('s3b-card-1280x720'));
    await H(page, "document.querySelector('#card [data-close]').click()");
    summary.shotsConversation = { group: g.g, card: c };
    return `${n1} (${g.ids.length} in the group, the menu on the second), ${n2} (${c.name}: ${c.level}, "${c.memory}")`;
  });
  await check('shots: buying a round (its toast), and a Toast (HD, 1280x720)', async () => {
    const A = g.ids[0];
    const r = await H(page, `window.__onfoot.interact(${A}, 'round', { outcome: 'accept' })`);
    expect(r.ok && r.accepted, JSON.stringify(r).slice(0, 200));
    await frames(page, 1);
    const n1 = await shot(page, png('s3b-round-1280x720'));
    await H(page, 'window.__onfoot.fastForward(2.2)');
    await H(page, "window.__onfoot.giveYou('tamarindo')");
    const drinker = await H(page, `(() => { const o = window.__onfoot; for (const id of ${JSON.stringify(g.ids)}) { const i = o.npcInfo(id); if (i && i.holding) return id; } return null; })()`);
    expect(drinker, 'nobody in the group holding a drink after the round');
    const t = await H(page, `window.__onfoot.interact(${drinker}, 'toast', { outcome: 'accept', force: true })`);
    await frames(page, 1);
    const n2 = await shot(page, png('s3b-toast-1280x720'));
    summary.shotsRound = { round: r.cost ?? null, toast: t.caption };
    return `${n1} (a round for the group: ${r.cost} tokens), ${n2} ("${t.caption}")`;
  });
  await check('shots: a guests\' pool match in play, from the overhead view (HD, 1280x720)', async () => {
    await H(page, 'window.__onfoot.closeSheets()');
    // your talk wraps up first (the reply chips go), then the overhead view over the table
    for (let i = 0; i < 3; i++) await H(page, 'window.__onfoot.reply(0)');
    await H(page, "window.__onfoot.pose('overhead')");
    const ids = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.action !== 'game' && n.action !== 'interact').slice(0, 4).map((n) => n.id)`);
    await H(page, "window.__onfoot.stopMatch('pool-1')");
    const r = await H(page, `window.__onfoot.npcMatch('pool-1', ${ids[0]}, ${ids[1]})`);
    expect(r.ok, 'no match');
    await H(page, 'window.__onfoot.overheadAt(11.0, 6.9, 9)');
    await H(page, 'window.__onfoot.fastForward(0.6)');
    // closer over the table: the overhead camera's own hooks
    await H(page, 'window.__onfoot.buildAll()');
    await frames(page, 3);
    const st = await H(page, "window.__onfoot.game('pool-1')");
    const n = await shot(page, png('s3b-npc-pool-overhead-1280x720'));
    summary.shotsPool = { mode: st.npc?.mode, shots: st.npc?.shots, onTable: st.npc?.onTable, sides: st.npc?.sides };
    expect(st.npc && st.npc.mode === 'physics', `mode ${st.npc?.mode}`);
    return `${n}: ${st.npc.sides.map((s) => s.name).join(' v ')}, mode ${st.npc.mode}, ${st.npc.shots} shots, ${st.npc.onTable} balls on the table`;
  });
  await check('shots: no console errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); });
  await ctx.close().catch(() => {});
}

await browser?.close().catch(() => {});
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length} of ${results.length} passed`);
process.exit(fails.length ? 1 : 0);
