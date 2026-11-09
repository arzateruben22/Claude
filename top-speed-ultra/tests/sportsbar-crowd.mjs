// S3a's unit test of the crowd's engine parts (PROJECT_OC_SPORTS_BAR.md, "NPC autonomy (utility AI)", "Regulars,
// walk-ins and staff", "Conversations and lines"): bundles engine/sim/autonomy.ts, groups.ts, crowd.ts, builds.ts,
// names.ts and lines.ts with esbuild into the scratch folder and runs them in Node, no browser.
//   node tests/sportsbar-crowd.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'sportsbar', 'sim');
mkdirSync(OUT, { recursive: true });
const entry = path.join(OUT, 'crowd-entry.ts');
const src = (f) => path.join(ROOT, 'src/onfoot/engine/sim', f);
writeFileSync(entry, ['autonomy', 'groups', 'crowd', 'builds', 'names', 'lines', 'needs', 'rng'].map((m) => `export * from '${src(m + '.ts')}';`).join('\n') + '\n');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: path.join(OUT, 'crowd.mjs'), logLevel: 'warning', loader: { '.json': 'json' } });
const S = await import(pathToFileURL(path.join(OUT, 'crowd.mjs')).href + '?t=' + Date.now());

let fails = 0;
const check = (name, ok, note) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${note}`); if (!ok) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;

// 1. the plan's worked arithmetic ("Urgent needs"): thirst 29, Saturday 20:10, the featured match in play
{
  const fan = { outgoing: 0.5, playful: 0.5, competitive: 0.5, fan: 1, active: 0.5 };
  const needs = { hunger: 70, thirst: 29, fun: 40, social: 60, energy: 70, bladder: 90 };
  const d = { needs, traits: fan, emotion: 'Fine' };
  const watch = { key: 'cur', action: 'stand-watch', object: 'standing-floor', slot: 's', deltas: { fun: 2.5 * 1.6 * 1.4 * 5, social: 5, energy: -2 }, tags: ['watch'], walk: 0, occupancy: 0, wait: 0, current: true, continuous: true, featuredScreen: true };
  const drink = { key: 'bar', action: 'order-drink', object: 'bar', slot: 'b', deltas: { thirst: 42, social: 3 }, tags: ['drink'], walk: 12, occupancy: 10 / 13, wait: 6 };
  const water = { key: 'w', action: 'water', object: 'water', slot: 'w', deltas: { thirst: 20 }, tags: ['drink'], walk: 8, occupancy: 0, wait: 0 };
  const barWatch = { key: 'bw', action: 'watch', object: 'bar', slot: 'x', deltas: { fun: 2.5 * 1.6 * 1.4 * 5, social: 5, energy: -2 }, tags: ['watch'], walk: 12, occupancy: 10 / 13, wait: 0, continuous: true, featuredScreen: true };
  const sw = S.score(watch, d), sd = S.score(drink, { ...d, needs: { ...needs, thirst: 29 } });
  const noUrgent = sd.score - sd.terms.urgent;
  check('the hard case: watching scores 70.5 without the urgent rule', near(sw.score, 70.5, 0.15), `watching ${sw.score.toFixed(2)} (fun ${sw.terms.needs.toFixed(2)} of needs, affinity ${sw.terms.affinity}, event ${sw.terms.event})`);
  check('the drink 12 m away with 10 of 13 taken scores 28.9 without the rule, 58.9 with it', near(noUrgent, 28.9, 0.15) && near(sd.score, 58.9, 0.15), `${noUrgent.toFixed(2)} and ${sd.score.toFixed(2)}`);
  const sWater = S.score(water, d), sPlain = S.score(watch, d, true), sBar = S.score(barWatch, d, true);
  check('water 8 m away 47.3; watching re-scored plain 25.5; the bar screens from 12 m 6.7', near(sWater.score, 47.3, 0.15) && near(sPlain.score, 25.5, 0.15) && near(sBar.score, 6.7, 0.2), `${sWater.score.toFixed(2)}, ${sPlain.score.toFixed(2)}, ${sBar.score.toFixed(2)}`);
  // the choice: the top three sampled by exp((s - best) / 8): a drink-tagged pick 0.988 of the time
  let hits = 0; const N = 20000, r = S.mulberry(7);
  for (let i = 0; i < N; i++) { const x = S.decide([watch, drink, water, barWatch], d, r); if (x.chosen && x.chosen.c.tags.includes('drink')) hits++; }
  check('a drink-tagged action is picked with p 0.988 at each decision', near(hits / N, 0.988, 0.006), `${(hits / N).toFixed(4)} over ${N} seeded decisions`);
  // the typical case: seated at a high-top, fan 0.5: table service is an overlay at 73.6
  const tbl = { key: 't', action: 'order-drink', object: 'high-top-1', slot: 'h', deltas: { thirst: 42, social: 3 }, tags: ['drink'], walk: 0, occupancy: 0, wait: 88, overlay: true };
  const st = S.score(tbl, { needs, traits: { ...fan, fan: 0.5 }, emotion: 'Fine' });
  check('table service seated at thirst 29 scores 73.6 (an overlay, over 25)', near(st.score, 73.6, 0.15), st.score.toFixed(2));
  const at = (thirst) => S.score(tbl, { needs: { ...needs, thirst }, traits: { ...fan, fan: 0.5 }, emotion: 'Fine' }).score;
  check('without urgency a seated person orders at about thirst 45 (28) and not at 50 (24)', near(at(45), 28, 0.6) && near(at(50), 24, 0.6) && at(45) >= 25 && at(50) < 25, `45: ${at(45).toFixed(2)}, 50: ${at(50).toFixed(2)}`);
  // hysteresis: a continuous action is left only for 25% plus 10 more, unless the new one raises an urgent need
  const calm = { ...needs, thirst: 60 };
  const better = { ...barWatch, key: 'b2', featuredScreen: true, walk: 0, occupancy: 0, deltas: { fun: 40 } };
  const keep = S.decide([{ ...watch }, better], { needs: calm, traits: fan, emotion: 'Fine' }, () => 0.01);
  check('hysteresis: a slightly better continuous action doesn\'t take over', keep.kept, `kept ${keep.kept}, top ${keep.top.map((s) => s.c.key + ':' + s.score.toFixed(1)).join(', ')}`);
}
// 2. urgency's curve
check('urgency: full 0.2, half 0.65, 29: 1.11, empty 2.0', near(S.urgency(100), 0.2, 1e-9) && near(S.urgency(50), 0.65, 1e-9) && near(S.urgency(29), 1.107, 0.001) && near(S.urgency(0), 2.0, 1e-9), [100, 50, 29, 0].map((n) => S.urgency(n).toFixed(3)).join(', '));
// 3. the talking groups: one speaker, turns 1 to 10 s with a 3.5 s median, laughter about 1.5 a minute
{
  const r = S.mulberry(11), g = S.newGroup(1, [1, 2, 3, 4], r), present = [1, 2, 3, 4];
  const turns = []; let start = 0, t = 0, laughs = 0;
  for (let i = 0; i < 20 * 60 * 20; i++) { t += 0.05; const e = S.stepGroup(g, present, 0.05, r); if (e.started >= 0) start = t; if (e.ended >= 0) turns.push(t - start); if (e.laugh) laughs++; }
  turns.sort((a, b) => a - b);
  const med = turns[Math.floor(turns.length / 2)], perMin = laughs / 20;
  check('groups: turns 1 to 10 s, median about 3.5 s; laughter about 1.5 a minute', turns[0] >= 0.99 && turns[turns.length - 1] <= 10.05 && near(med, 3.5, 0.5) && perMin > 0.8 && perMin < 2.5, `${turns.length} turns in 20 min, median ${med.toFixed(2)} s, ${turns[0].toFixed(2)} to ${turns[turns.length - 1].toFixed(2)} s; ${perMin.toFixed(2)} laughs a minute`);
}
// 4. the staff plan by share, and Low's five
{
  const P = (s, low, house = false, host = false) => S.staffPlan(s, { open: true, host, low, houseInGame: house });
  const a = P(0.2, false), b = P(0.5, false), c = P(0.95, false), lo = P(0.95, true, false, true), lo2 = P(0.95, true, true, true);
  check('staff by share: bartenders 2 / 3 / 4, servers 1 / 2 / 3, the barback from 0.5, the host from 0.6', a.bartender === 2 && a.server === 1 && !a.barback && !a.host && b.bartender === 3 && b.server === 2 && b.barback === 1 && !b.host && c.bartender === 4 && c.server === 3 && c.host === 1, JSON.stringify({ a, b, c }));
  check('Low draws at most 5: 2 bartenders, 2 servers and the host; a game swaps the host for the house player', S.staffTotal(lo) === 5 && lo.bartender === 2 && lo.server === 2 && lo.host === 1 && !lo.barback && S.staffTotal(lo2) === 5 && lo2.house === 1 && lo2.host === 0, JSON.stringify({ lo, lo2 }));
}
// 5. the regulars: 48 in friend groups of 2 to 5, first names from the list of 200, no surnames
{
  const p = S.regularsPool(1), sizes = p.groups.map((g) => g.members.length);
  check('regulars: 48 in friend groups of 2 to 5', p.regulars.length === 48 && sizes.every((n) => n >= 2 && n <= 5), `${p.groups.length} groups: ${sizes.join(' ')}`);
  const names = new Set(S.FIRST_NAMES);
  check('names: 200 common first names, no surnames, no repeats', S.FIRST_NAMES.length === 200 && names.size === 200 && S.FIRST_NAMES.every((n) => !/\s/.test(n)) && p.regulars.every((r) => names.has(r.name)), `${S.FIRST_NAMES.length} names`);
  const r = S.mulberry(3), stays = Array.from({ length: 4000 }, () => S.stayMinutes(r)).sort((a, b) => a - b);
  check('stays: log-normal with an 80-minute median', near(stays[2000], 80, 4), `median ${stays[2000].toFixed(1)} min, 10% ${stays[400].toFixed(0)}, 90% ${stays[3600].toFixed(0)}`);
  check('lines: the starter set of 30', S.STARTER_LINES.length === 30 && S.STARTER_LINES.every((l) => l.text.length < 90), `${S.STARTER_LINES.length} lines`);
}
// 6. the build scheduler: one a frame, the gap, never idle
{
  const B = new S.BuildScheduler(); let now = 0;
  const realNow = performance.now.bind(performance);
  // a fake clock: frames of 500 ms, builds of 300 ms (Low here: about 2 fps)
  performance.now = () => now;
  let k = 0;
  for (let f = 0; f < 60; f++) { B.frame(now, () => (k < 20 ? { who: k++, level: 2, quality: 'phone', reason: 'fill', run: () => { now += 300; } } : null), k < 20); now += 500; }
  performance.now = realNow;
  const fr = B.frames, bs = B.builds;
  let bad = 0; for (let i = 1; i < bs.length; i++) if (bs[i].start - (bs[i - 1].start + bs[i - 1].dur) < 2 * bs[i - 1].dur - 1e-6) bad++;
  check('the scheduler: 20 builds, never two a frame, the gap always met', bs.length === 20 && bad === 0 && new Set(bs.map((b) => b.frame)).size === 20, `${bs.length} builds over ${fr.length} frames, ${bad} in the gap`);
}
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
