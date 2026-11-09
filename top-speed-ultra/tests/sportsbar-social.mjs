// S3b's unit test of the social engine parts (PROJECT_OC_SPORTS_BAR.md, "Relationships and memory", "Interacting with
// people", "NPC autonomy" ("People advertise like objects"), "Conversations and lines"): bundles engine/sim/relations.ts,
// interactions.ts, groups.ts, lines.ts and autonomy.ts with esbuild into the scratch folder and runs them in Node, no
// browser. The formulas are checked against hand-worked numbers, not against themselves.
//   node tests/sportsbar-social.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'sportsbar', 'sim');
mkdirSync(OUT, { recursive: true });
const entry = path.join(OUT, 'social-entry.ts');
const src = (f) => path.join(ROOT, 'src/onfoot/engine/sim', f);
writeFileSync(entry, ['relations', 'interactions', 'groups', 'lines', 'autonomy', 'needs', 'rng'].map((m) => `export * from '${src(m + '.ts')}';`).join('\n') + '\n');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: path.join(OUT, 'social.mjs'), logLevel: 'warning', loader: { '.json': 'json' } });
const S = await import(pathToFileURL(path.join(OUT, 'social.mjs')).href + '?t=' + Date.now());

let fails = 0, n = 0;
const results = [];
const check = (name, ok, note) => { n++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${note}`); results.push({ name, ok, note }); if (!ok) fails++; };
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t;

// 1. rapport and friendship updates, by hand
{
  const R = new S.Relations();
  R.apply('you', 'r1', 6, 0, 'talk', true);
  let r = R.get('you', 'r1');
  check('an outcome of +6 from zero: rapport 6, friendship 0.35 x 6 = 2.1', near(r.rapport, 6) && near(r.friendship, 2.1), `rapport ${r.rapport}, friendship ${r.friendship}`);
  // rapport 6 + 9 (1 - 6/150) = 6 + 8.64 = 14.64; friendship 2.1 + 0.35 x 9 x (1 - 2.1/150) = 2.1 + 3.10590 = 5.2059
  R.apply('you', 'r1', 9, 1, 'joke', true); r = R.get('you', 'r1');
  check('then +9: rapport 6 + 9 (1 - 6/150) = 14.64; friendship 2.1 + 0.35 x 9 (1 - 2.1/150) = 5.2059', near(r.rapport, 14.64, 1e-9) && near(r.friendship, 5.2059, 1e-9), `rapport ${r.rapport.toFixed(6)}, friendship ${r.friendship.toFixed(6)}`);
  // a bad outcome -6: rapport 14.64 - 6 (1 - 14.64/150) = 14.64 - 5.41440 = 9.2256; friendship 5.2059 + 0.15 x -6 (1 - 5.2059/150) = 5.2059 - 0.868765...
  R.apply('you', 'r1', -6, 2, 'joke', false); r = R.get('you', 'r1');
  const fExp = 5.2059 - 0.15 * 6 * (1 - 5.2059 / 150);
  check('then -6: rapport 14.64 - 6 (1 - 14.64/150) = 9.2256; friendship by k 0.15', near(r.rapport, 9.2256, 1e-9) && near(r.friendship, fExp, 1e-9), `rapport ${r.rapport.toFixed(6)}, friendship ${r.friendship.toFixed(6)} (expected ${fExp.toFixed(6)})`);
  // the bounds
  const R2 = new S.Relations(); for (let i = 0; i < 400; i++) R2.apply('a', 'b', 15, i, 'round', true);
  const r2 = R2.get('a', 'b');
  check('many +15s stay inside 100 (rapport approaches 150 by the formula, held at 100)', r2.rapport <= 100 && r2.friendship <= 100 && r2.rapport > 95, `rapport ${r2.rapport.toFixed(3)}, friendship ${r2.friendship.toFixed(3)}`);
}
// 2. decay
{
  const R = new S.Relations();
  R.apply('a', 'b', 15, 0, 'round', true); const r0 = R.get('a', 'b').rapport;   // 15
  R.fade(4, 4); const r4 = R.get('a', 'b').rapport;                                 // quiet 4 min: no fade yet
  R.fade(3, 7); const r7 = R.get('a', 'b').rapport;                                 // 2 of these 3 minutes are past the 5-minute quiet: -3
  R.fade(20, 27); const r27 = R.get('a', 'b').rapport;                              // fades to 0, not past it
  check('rapport fades by 1.5 a sim minute only after 5 quiet minutes, toward 0 and not past it', near(r0, 15) && near(r4, 15) && near(r7, 12) && near(r27, 0), `15 -> ${r4} at 4 min -> ${r7} at 7 min -> ${r27} at 27 min`);
  const F = new S.Relations();
  const a = F.meet('you', 'r1', 0, { friendship: 30 }); a.best = 30;
  const b = F.meet('you', 'r2', 0, { friendship: 60 }); b.best = 60;
  const c = F.meet('you', 'r3', 0, { friendship: -10 });
  F.fadeDays(10);
  check('friendship fades 0.5 a device day apart: 30 -> 25 after 10 days; -10 -> -5', near(a.friendship, 25) && near(c.friendship, -5), `${a.friendship}, ${c.friendship}`);
  F.fadeDays(200);
  check('old friends stay friendly: one that reached 45 never drops below 20; one that never did goes to 0', near(b.friendship, 20) && near(a.friendship, 0), `reached 60: ${b.friendship}; reached 30: ${a.friendship}`);
}
// 3. the memory ring of 8, highlights
{
  const R = new S.Relations();
  for (let i = 0; i < 12; i++) R.apply('a', 'b', i % 3 === 0 ? 2 : -1, i, `k${i}`, true);
  const r = R.get('a', 'b');
  check('the memory ring keeps the last 8', r.mem.length === 8 && r.mem[0].kind === 'k4' && r.mem[7].kind === 'k11', r.mem.map((m) => m.kind).join(','));
  const H = new S.Relations();
  H.apply('a', 'b', 6, 0, 'talk', true); H.apply('a', 'b', 9, 1, 'joke', true); H.apply('a', 'b', 15, 2, 'round', true); H.apply('a', 'b', 8, 3, 'high-five', true); H.apply('a', 'b', 2, 4, 'goodbye', true);
  const h = H.get('a', 'b').highlights.map((m) => m.kind);
  check('highlights: the first meeting and the biggest moments, up to 3 (a talk of 6 and a goodbye of 2 are too small; the high-five of 8 loses to the joke 9 and the round 15)', h.length === 3 && h[0] === 'met' && h.includes('round') && h.includes('joke') && !h.includes('high-five'), h.join(','));
  check('a shared highlight (a good one besides meeting) gives NPC choices their +10; a pair that only met has none', H.sharedHighlight('a', 'b') && (() => { const Q = new S.Relations(); Q.meet('x', 'y', 0); return !Q.sharedHighlight('x', 'y'); })(), 'yes / no');
}
// 4. levels
{
  const lv = (f) => { const R = new S.Relations(); const r = R.meet('a', 'b', 0, { friendship: f }); return S.levelOf(r); };
  const rows = [[0, 'Acquaintance'], [19, 'Acquaintance'], [20, 'Friendly'], [44, 'Friendly'], [45, 'Friend'], [74, 'Friend'], [75, 'Good friend'], [100, 'Good friend'], [-1, 'Awkward'], [-29, 'Awkward'], [-30, 'Cold'], [-100, 'Cold']];
  const bad = rows.filter(([f, l]) => lv(f) !== l);
  check('the level thresholds (and Stranger when never met)', !bad.length && S.levelOf(null) === 'Stranger', bad.length ? JSON.stringify(bad.map(([f, l]) => [f, l, lv(f)])) : rows.map(([f, l]) => `${f} ${l}`).join('; '));
  const R = new S.Relations(); const r = R.meet('a', 'b', 0, { rapport: 30 });
  check('"Getting along" at rapport 30 and up', S.gettingAlong(r) && !S.gettingAlong({ ...r, rapport: 29.9 }), 'rapport 30 yes, 29.9 no');
}
// 5. storage: at most 64 a person, the weakest and oldest dropped first; persistence round trip
{
  const R = new S.Relations();
  for (let i = 0; i < 64; i++) { const r = R.meet('you', `p${i}`, i); r.friendship = i === 5 ? 1 : 10 + i; r.last = i; }
  R.meet('you', 'p64', 100).friendship = 50;
  const kept = R.of('you').map((r) => R.other(r, 'you'));
  check('at most 64 pairs a person; the weakest went (p5, friendship 1)', kept.length === 64 && !kept.includes('p5') && kept.includes('p64'), `${kept.length} kept; p5 kept: ${kept.includes('p5')}`);
  const A = new S.Relations(); A.apply('you', 'r3', 15, 10, 'round', true); A.apply('you', 'r3', 9, 11, 'joke', true); A.apply('you', 'n9', 6, 12, 'talk', true); A.apply('r3', 'r4', 6, 13, 'talk', true);
  const saved = JSON.parse(JSON.stringify(A.toSave((id) => id === 'you' || /^r\d+$/.test(id))));
  const B = new S.Relations(); B.load(saved, 0);
  const a = A.get('you', 'r3'), b = B.get('you', 'r3');
  check('persistence round-trips (JSON): friendship, best, memory and highlights kept; rapport back to 0 (it\'s this visit); walk-ins not kept', near(a.friendship, b.friendship, 1e-3) && b.rapport === 0 && b.mem.length === a.mem.length && b.highlights.length === a.highlights.length && !B.get('you', 'n9') && !!B.get('r3', 'r4'), `friendship ${a.friendship.toFixed(3)} -> ${b.friendship.toFixed(3)}, mem ${b.mem.length}, highlights ${b.highlights.length}, walk-in kept: ${!!B.get('you', 'n9')}`);
}
// 6. acceptance, by hand
{
  const t = { outgoing: 0.5, playful: 0.5, competitive: 0.5, fan: 0.5, active: 0.5 };
  const p0 = S.acceptP('talk', { rapport: 0, friendship: 0, target: t, targetMood: 50, memory: 0, context: 0 });
  check('Talk between strangers, an average target at mood 50: p = 0.75', near(p0, 0.75), p0.toFixed(4));
  // joke: 0.55 + 0.3 x 0.9 = 0.82; + 0.004 x 20 + 0.002 x 30 + 0.15 x (0.8 - 0.5) + (70 - 50) / 250 = 0.82 + 0.08 + 0.06 + 0.045 + 0.08 = 1.085 -> 0.97
  const pj = S.acceptP('joke', { rapport: 20, friendship: 30, target: { ...t, playful: 0.9, outgoing: 0.8 }, targetMood: 70, memory: 0, context: 0 });
  check('Joke: base 0.55 + 0.3 playful and every term, held to 0.97', near(pj, 0.97), pj.toFixed(4));
  const pl = S.acceptP('challenge', { rapport: -50, friendship: -60, target: { ...t, competitive: 0, outgoing: 0 }, targetMood: 10, memory: -0.24, context: -0.25 });
  check('Challenge at its worst: held to 0.05', near(pl, 0.05), pl.toFixed(4));
  const mem = [{ kind: 'joke', good: true }, { kind: 'talk', good: true }, { kind: 'joke', good: false }, { kind: 'joke', good: true }, { kind: 'joke', good: true }];
  check('memoryTerm: the last 3 of the same kind, +0.05 good, -0.08 not (here good, good, not: +0.02)', near(S.memoryTerm(mem, 'joke'), 0.02), S.memoryTerm(mem, 'joke').toFixed(4));
  const cx = S.contextTerm;
  check('context: +0.10 both scored (Talk), -0.10 conceded (Joke, Challenge only), -0.20 mid-turn, -0.10 another group; clamped to -0.25..+0.25', near(cx('talk', { bothScored: true, conceded: false, midTurn: false, otherGroup: false }), 0.1) && near(cx('talk', { bothScored: false, conceded: true, midTurn: false, otherGroup: false }), 0) && near(cx('joke', { bothScored: false, conceded: true, midTurn: true, otherGroup: true }), -0.25) && near(cx('challenge', { bothScored: true, conceded: true, midTurn: false, otherGroup: false }), -0.1), 'as listed');
  // the expected deltas: the plan's own examples
  const e1 = S.expected('talk', 0.8), e2 = S.expected('joke', 0.7);
  check('expected deltas: Talk at p 0.8 advertises social 0.8 x 12 + 0.2 x 2 = 10; Joke at p 0.7 fun 4.2 and social 5.6', near(e1.social, 10) && near(e2.fun, 4.2) && near(e2.social, 5.6), JSON.stringify({ talk: e1, joke: e2 }));
  const e3 = S.expected('challenge', 0.6, 'pool');
  check('a Challenge advertises its game\'s deltas x p (pool: fun 40, social 15, energy -4, x 0.6)', near(e3.fun, 24) && near(e3.social, 9) && near(e3.energy, -2.4), JSON.stringify(e3));
  check('Introduce\'s start: rapport 10 + 0.3 min(your friendships)', near(S.introStart(40, 20), 16) && near(S.introStart(-10, 50), 7), `${S.introStart(40, 20)}, ${S.introStart(-10, 50)}`);
  // a person advert scored as an object's: the needs term from the expected deltas, affinity by its trait
  const d = { needs: { hunger: 70, thirst: 70, fun: 40, social: 20, energy: 70, bladder: 90 }, traits: { ...t, outgoing: 0.9, playful: 0.2 }, emotion: 'Lonely' };
  const c = { key: 'x', action: 'interact', object: 'person:1', slot: null, deltas: S.expected('talk', 0.8), tags: ['social'], walk: 5, occupancy: 0.5, wait: 0, inter: 'talk', aff: 'outgoing', memory: 10 };
  const sc = S.score(c, d);
  const m = 0.6 + 0.8 * 0.9, u = 0.2 + 1.8 * ((100 - 20) / 100) ** 2, needs = m * 10 * u;
  const want = needs + 20 * 0.9 + 20 + 10 + 30 - 0.6 * 5 - 15 * 0.5;   // social 20 is urgent and Talk raises it by 10: +30
  check('a Talk advert scored as an object\'s: m_social x 10 x urgency(20) + 20 outgoing + Lonely 20 + memory 10 + urgent 30 (social 20 raised by 10) - walk - occupancy', near(sc.score, want, 1e-9), `${sc.score.toFixed(4)} (by hand ${want.toFixed(4)}: needs ${needs.toFixed(4)})`);
  const cj = { ...c, deltas: S.expected('joke', 0.7), inter: 'joke', aff: 'playful', joke: true, memory: 0, occupancy: 0, walk: 0 };
  check('Joke\'s affinity reads playful (0.2), not outgoing (0.9)', near(S.score(cj, d).terms.affinity, 4), S.score(cj, d).terms.affinity.toFixed(4));
  const ce = { ...c, inter: 'cheer', aff: 'fan', goal60: true, deltas: { fun: 5 }, memory: 0 };
  const se = S.score(ce, { ...d, emotion: 'Excited' });
  check('Cheer together: Excited +15, and +30 for 60 s after a goal', near(se.terms.emotion, 15) && near(se.terms.event, 30), `emotion ${se.terms.emotion}, event ${se.terms.event}`);
}
// 7. groups: 2 to 6
{
  const g = S.newGroup(1, [1, 2], () => 0.5);
  let ok = true; for (let id = 3; id <= 6; id++) ok = ok && S.addMember(g, id);
  check('a group takes up to 6; a seventh is refused; a member twice is refused', ok && !S.addMember(g, 7) && !S.addMember(g, 3) && g.members.length === 6, g.members.join(','));
  g.speaker = 4; S.removeMember(g, 4);
  check('a speaker who leaves ends their turn', g.speaker === -1 && !g.members.includes(4), `speaker ${g.speaker}, members ${g.members.join(',')}`);
  // one speaker at a time over a long run
  const r = S.mulberry(5); const g2 = S.newGroup(2, [1, 2, 3, 4], r); let turns = 0, overlap = 0, last = -1;
  for (let i = 0; i < 6000; i++) { const ev = S.stepGroup(g2, [1, 2, 3, 4], 0.1, r); if (ev.started >= 0) { if (last >= 0) overlap++; last = ev.started; turns++; } if (ev.ended >= 0) last = -1; }
  check('one speaker at a time over 10 minutes of talk', overlap === 0 && turns > 50, `${turns} turns, ${overlap} started over another`);
}
// 8. the lines: about 120, tagged; nothing real, nothing staked
{
  const all = S.ALL_LINES, kinds = new Set(all.filter((l) => l.kind).map((l) => l.kind));
  const need = ['talk', 'joke', 'laugh', 'cheer', 'high-five', 'toast', 'round', 'thanks', 'introduce', 'challenge', 'team', 'console', 'goodbye', 'warm', 'quip', 'wrap'];
  check('about 120 lines (S3a\'s 30 and S3b\'s), every interaction tagged, with outcomes, memory and your state', all.length >= 110 && need.every((k) => kinds.has(k)) && all.some((l) => l.remembers) && all.some((l) => l.state), `${all.length} lines (${S.STARTER_LINES.length} starter, ${S.INTERACTION_LINES.length} interaction); kinds ${[...kinds].length}; remembering ${all.filter((l) => l.remembers).length}; your state ${all.filter((l) => l.state).length}`);
  const banned = /\bbet\b|wager|odds|\blive\b|LIVE|parlay|\$\d/;
  check('no line offers a bet, odds or says LIVE', !all.some((l) => banned.test(l.text)), all.filter((l) => banned.test(l.text)).map((l) => l.text).join(' | ') || 'none');
  const l1 = S.pickFor('talk', 'yes', 3, { night: true, matchOn: true, remembers: new Set(['round']), team: 'Bluffside Undertow' });
  const l2 = S.pickFor('team', 'yes', 2, { night: true, matchOn: true, team: 'Bluffside Undertow' });
  check('a remembered round picks a remembers:round line; {team} is filled in', l1.remembers === 'round' && l2.text.includes('Bluffside Undertow') && !l2.text.includes('{'), `"${l1.text}" / "${l2.text}"`);
}
writeFileSync(path.join(ROOT, 'tests', 'out', 'sportsbar', 'sportsbar-social-unit.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 1));
console.log(`\n${n - fails} of ${n} passed`);
process.exit(fails ? 1 : 0);
