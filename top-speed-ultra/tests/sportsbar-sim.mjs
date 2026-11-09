// S2a's unit test of engine/sim (PROJECT_OC_SPORTS_BAR.md, "### S2a", Checks: "A unit test of engine/sim's decay, with
// the traits as its input, checks the same rates without the page"). Bundles engine/sim/needs.ts, tv.ts and
// tokens.ts with esbuild (vite's own dependency) into the scratch folder and runs them in Node: no browser.
//   node tests/sportsbar-sim.mjs
import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'sportsbar', 'sim');
mkdirSync(OUT, { recursive: true });
const entry = path.join(OUT, 'entry.ts');
const { writeFileSync } = await import('node:fs');
writeFileSync(entry, `export * from '${path.join(ROOT, 'src/onfoot/engine/sim/needs.ts')}';\nexport { Tv, absMinute, fromAbs } from '${path.join(ROOT, 'src/onfoot/engine/sim/tv.ts')}';\nexport { NAMES_FOR_BLOCKLIST } from '${path.join(ROOT, 'src/onfoot/engine/sim/leagues.ts')}';\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: path.join(OUT, 'sim.mjs'), logLevel: 'warning', loader: { '.json': 'json' } });
const S = await import(pathToFileURL(path.join(OUT, 'sim.mjs')).href + '?t=' + Date.now());

let fails = 0;
const check = (name, ok, note) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${note}`); if (!ok) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// 1. the decay over 10 sim minutes, standing and doing nothing, at outgoing 0, 0.5 and 1 (the needs table)
for (const outgoing of [0, 0.5, 1]) {
  const t = { ...S.AVERAGE, outgoing }, n = { hunger: 70, thirst: 70, fun: 70, social: 70, energy: 70, bladder: 90 };
  for (let i = 0; i < 40; i++) S.advance(n, S.rates({ posture: 'stand' }, t), 0.25);
  const want = { hunger: 62, thirst: 54, fun: 58, social: 70 - 10 * (0.6 + 0.8 * outgoing), energy: 66, bladder: 84 };
  const bad = Object.keys(want).filter((k) => !near(n[k], want[k], 1));
  check(`decay over 10 sim minutes at outgoing ${outgoing}`, !bad.length, Object.keys(want).map((k) => `${k} ${n[k].toFixed(2)} (formula ${want[k].toFixed(2)})`).join(', '));
}
// 2. the rates while doing things ("Rates while doing things"), traits average
{
  const t = S.AVERAGE, r = (d) => S.rates(d, t);
  const cases = [
    ['seated', r({ posture: 'sit' }), { energy: 0.8, fun: -1.2, social: -1, thirst: -1.6, hunger: -0.8 }],
    ['watching (not featured)', r({ posture: 'stand', fun: 'watch', match: 1 }), { fun: 2.5, energy: -0.4, social: -1 }],
    ['watching the featured match in play, fan 1', S.rates({ posture: 'sit', fun: 'watch', match: 1.6 }, { ...t, fan: 1 }), { fun: 2.5 * 1.6 * 1.4, energy: 0.8 }],
    ['watching, fan 0', S.rates({ posture: 'sit', fun: 'watch', match: 1 }, { ...t, fan: 0 }), { fun: 2.5 * 0.6 }],
    ['dancing', r({ posture: 'stand', fun: 'dance' }), { fun: 8, social: -1 + 2, energy: -2.5, thirst: -2.2 }],
    ['pool', r({ posture: 'stand', fun: 'pool' }), { fun: 6, social: -1 + 2.5, energy: -0.6, thirst: -2.2 }],
    ['darts', r({ posture: 'stand', fun: 'darts' }), { fun: 6.5, energy: -0.4 }],
    ['eating', r({ posture: 'sit', eating: true }), { hunger: 9.2 }],
    ['in a conversation', r({ posture: 'stand', fun: 'conversation' }), { social: 4, fun: 1 }],
  ];
  for (const [name, got, want] of cases) { const bad = Object.keys(want).filter((k) => !near(got[k], want[k], 1e-9)); check(`rates: ${name}`, !bad.length, Object.keys(want).map((k) => `${k} ${got[k].toFixed(3)}/${want[k].toFixed(3)}`).join(', ')); }
}
// 3. mood: full needs and no moodlets read 80 (Happy); the seeded average within 1 of 20 + 0.6 x the weighted average;
//    empty 20 (Low); an average guest about 57 (Fine), and after 20 minutes alone about 44.5 (Meh)
{
  const full = { hunger: 100, thirst: 100, fun: 100, social: 100, energy: 100, bladder: 100 }, empty = { hunger: 0, thirst: 0, fun: 0, social: 0, energy: 0, bladder: 0 };
  const m1 = S.moodOf(full, S.AVERAGE, 0), m0 = S.moodOf(empty, S.AVERAGE, 0), avg = S.AVERAGE_START, ma = S.moodOf(avg, S.AVERAGE, 0), wa = S.needsAverage(avg, S.AVERAGE);
  check('mood: full needs, no moodlets', m1 === 80 && S.moodLabel(m1) === 'Happy', `${m1} ${S.moodLabel(m1)}`);
  check('mood: empty needs', m0 === 20 && S.moodLabel(m0) === 'Low', `${m0} ${S.moodLabel(m0)}`);
  check('mood: the seeded average', near(ma, 20 + 0.6 * wa, 1) && S.moodLabel(ma) === 'Fine', `${ma.toFixed(2)} vs 20 + 0.6 x ${wa.toFixed(2)} = ${(20 + 0.6 * wa).toFixed(2)} (${S.moodLabel(ma)})`);
  const n = { ...avg }; for (let i = 0; i < 80; i++) S.advance(n, S.rates({ posture: 'stand' }, S.AVERAGE), 0.25);
  const m20 = S.moodOf(n, S.AVERAGE, 0);
  check('mood: an average guest after 20 sim minutes alone', near(m20, 44.5, 1.5) && near(S.needsAverage(n, S.AVERAGE), 41, 1.5), `average ${S.needsAverage(n, S.AVERAGE).toFixed(2)} (plan 41), mood ${m20.toFixed(2)} ${S.moodLabel(m20)} (plan 44.5, Meh)`);
  const ml = new S.Moodlets(); ml.add('goal-for', 0);
  check('moodlets fade linearly: a goal for my team at full needs', near(S.moodOf(full, S.AVERAGE, ml.sum(0)), 95, 1e-9) && near(ml.sum(5), 7.5, 1e-9) && ml.sum(10) === 0, `at 0 ${S.moodOf(full, S.AVERAGE, ml.sum(0))}, +${ml.sum(5)} at 5 min, ${ml.sum(10)} at 10`);
  const tm = S.multipliers({ ...S.AVERAGE, playful: 1, outgoing: 0, active: 1 });
  check('trait multipliers', near(tm.fun, 1.2, 1e-9) && near(tm.social, 0.6, 1e-9) && near(tm.energy, 0.8, 1e-9) && tm.hunger === 1, JSON.stringify(tm));
}
// 4. the TV schedule without the page: the featured match each day, the factor, gameNight, determinism
{
  const sched = { capacity: 130, hours: [[9, 24], [11, 24], [11, 24], [11, 24], [11, 24], [11, 26], [9, 26]], bands: [], events: [], weather: { rain: 1, fog: 1 }, noiseSeed: 2 };
  const tv = new S.Tv(2, sched), tv2 = new S.Tv(2, sched), W = 43;
  const want = { 1: [2, '19:00', 34], 2: null, 3: [1, '20:00', 25], 4: [2, '19:00', 34], 5: [1, '20:00', 25], 6: [1, '20:00', 25], 0: [2, '14:30', 34] };
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const list = tv.fixtures(W, d), fe = list.filter((f) => f.featured), f = fe[0] ?? null, w = want[d];
    const ok = w === null ? fe.length === 0 : fe.length === 1 && f.channel === w[0] && f.fw - f.ko === w[2] && S.fromAbs(f.ko).hour === Number(w[1].slice(0, 2)) + Number(w[1].slice(3)) / 60;
    check(`featured: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}`, ok, f ? `channel ${f.channel} ${f.home.abbr} v ${f.away.abbr}, kick-off ${S.fromAbs(f.ko).hour.toFixed(2)}, ${f.fw - f.ko} min, ${list.length} fixtures` : `none of ${list.length} fixtures`);
  }
  const same = JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((d) => tv.fixtures(W, d))) === JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((d) => tv2.fixtures(W, d)));
  const goals = [0, 1, 3, 4, 5, 6].map((d) => tv.fixtures(W, d)).flat().filter((f) => f.league === 'marigold');
  const g = goals.reduce((a, f) => a + f.events.filter((e) => e.kind === 'goal').length, 0) / Math.max(1, goals.length), bc = goals.reduce((a, f) => a + f.events.filter((e) => e.kind === 'bigChance').length, 0) / Math.max(1, goals.length);
  const gr = [0, 1, 4].map((d) => tv.fixtures(W, d)).flat().filter((f) => f.league === 'gridiron');
  const td = gr.reduce((a, f) => a + f.events.filter((e) => e.kind === 'td').length, 0) / Math.max(1, gr.length);
  check('the same seeds give the same fixtures and scores (two schedules built apart)', same, `${goals.length} Marigold matches: ${g.toFixed(2)} goals and ${bc.toFixed(2)} big chances a match (plan: about 2 and 4); ${gr.length} gridiron: ${td.toFixed(2)} touchdowns (plan 2.5)`);
  const gn = [[5, 20.4], [5, 20 + 26 / 60], [6, 21], [6, 1 + 59 / 60], [4, 21], [5, 20 + 24 / 60]].map(([d, h]) => tv.gameNight(W, d, h));
  check('gameNight: Fri 20:24 no, Fri 20:26 yes, Sat 21:00 yes, Sat 01:59 yes (Friday\'s), Thu 21:00 no', JSON.stringify(gn) === JSON.stringify([false, true, true, true, false, false]), JSON.stringify(gn));
  const ff = [[6, 19.49], [6, 19.51], [6, 20.4], [6, 20.43]].map(([d, h]) => tv.featuredFactor(W, d, h));
  check('featuredFactor 1.25 only from 30 minutes before the featured kick-off to its final whistle', JSON.stringify(ff) === JSON.stringify([1, 1.25, 1.25, 1]), JSON.stringify(ff));
  // the schedule reads as a league's: each day's pairings from a seeded round-robin, so no pairing repeats within a
  // day and no team plays two slots in a row (Saturday's Marigold window has 23 slots of the 28 pairings); Friday's and
  // Saturday's featured pairings differ (and Sunday's and Monday's), every week; the same seeds give the same draw
  {
    const bad = [], featPairs = [], key = (f) => [f.home.abbr, f.away.abbr].sort().join('-');
    let days = 0, slots = 0;
    for (let w = 30; w < 56; w++) {
      for (const d of [0, 1, 2, 3, 4, 5, 6]) {
        const list = tv.fixtures(w, d); days++;
        for (const ch of [1, 2]) {
          const seq = list.filter((f) => f.channel === ch).sort((a, b) => a.slot - b.slot), seen = new Set();
          slots += seq.length;
          seq.forEach((f, i) => {
            if (f.home.abbr === f.away.abbr) bad.push(`w${w} d${d} ch${ch} slot ${f.slot}: a team plays itself`);
            if (seen.has(key(f))) bad.push(`w${w} d${d} ch${ch} slot ${f.slot}: ${key(f)} again`); seen.add(key(f));
            const p = seq[i - 1];
            if (p && [p.home.abbr, p.away.abbr].some((t) => t === f.home.abbr || t === f.away.abbr)) bad.push(`w${w} d${d} ch${ch} slots ${p.slot}-${f.slot}: ${key(p)} then ${key(f)}`);
          });
        }
      }
      const fri = tv.featured(w, 5), sat = tv.featured(w, 6), sun = tv.featured(w, 0), mon = tv.featured(w + 1, 1);
      if (key(fri) === key(sat)) bad.push(`w${w}: Friday's and Saturday's featured are both ${key(fri)}`);
      if (key(sun) === key(mon)) bad.push(`w${w}: Sunday's and the next Monday's featured are both ${key(sun)}`);
      featPairs.push(`${key(fri)}/${key(sat)}`);
    }
    const sat43 = tv.fixtures(W, 6).filter((f) => f.channel === 1).map((f) => `${S.fromAbs(f.ko).hour.toFixed(1)} ${f.home.abbr}-${f.away.abbr}`);
    check('the schedule: no pairing twice in a day, no team in two slots in a row, Friday\'s and Saturday\'s featured pairings differ (weeks 30 to 55)', !bad.length, `${days} days, ${slots} fixtures checked${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}; Saturday of week 43: ${sat43.length} Marigold slots, ${sat43.slice(0, 5).join(', ')} ...; week 43 Fri/Sat featured ${featPairs[13]}`);
    const again = new S.Tv(2, sched);
    check('the schedule\'s draw is the same twice (a fresh schedule, weeks 30 to 55)', JSON.stringify(Array.from({ length: 26 }, (_, k) => [0, 1, 2, 3, 4, 5, 6].map((d) => tv.fixtures(30 + k, d).map((f) => f.id + f.home.abbr + f.away.abbr + f.final)))) === JSON.stringify(Array.from({ length: 26 }, (_, k) => [0, 1, 2, 3, 4, 5, 6].map((d) => again.fixtures(30 + k, d).map((f) => f.id + f.home.abbr + f.away.abbr + f.final)))), 'same teams, same scores');
    // the events between two minutes come back in time order, from a reused buffer
    const a0 = S.absMinute(W, 6, 12), evs = tv.eventsBetween(a0, a0 + 11.5 * 60), n1 = evs.length, sorted = evs.every((e, i) => !i || evs[i - 1].t <= e.t);
    const evs2 = tv.eventsBetween(a0, a0 + 11.5 * 60);
    check('eventsBetween: time order, the same events again, one reused buffer', sorted && n1 > 50 && evs2 === evs && evs2.length === n1, `${n1} events on Saturday 12:00 to 23:30`);
  }
  // the names against the blocklist (whole words and phrases, case and accents folded)
  const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const block = JSON.parse(readFileSync(path.join(ROOT, 'tests/onfoot/sportsbar-blocklist.json'), 'utf8'));
  const entries = Object.values(block.entries).flat().map(fold);
  const hits = [];
  for (const name of S.NAMES_FOR_BLOCKLIST) { const n = ' ' + fold(name).replace(/[^a-z0-9]+/g, ' ') + ' '; for (const e of entries) { const k = ' ' + e.replace(/[^a-z0-9]+/g, ' ').trim() + ' '; if (k.trim() && n.includes(k)) hits.push(`${name} ~ ${e}`); } }
  check('the blocklist: no team, league or channel name matches a real one', !hits.length, `${S.NAMES_FOR_BLOCKLIST.length} names against ${entries.length} entries${hits.length ? ': ' + hits.join(', ') : ''}`);
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
