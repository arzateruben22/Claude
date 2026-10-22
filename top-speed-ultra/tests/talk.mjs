// The talk bank's count: how many distinct openers, replies and two-line conversations the bank can make for one
// fixed "now", and that none of them trips the no-politics blocklist. Runs on Node's type stripping (22.18+):
//   node tests/talk.mjs
import { enumerateAll, opener, reply, exchange, djLine, MOODS, ENERGIES, TOPICS } from '../src/talk/bank.ts';
import { leagueDay, CLUBS, gamesOn, playGame } from '../src/talk/league.ts';

const BLOCK = /\b(elect|vote|ballot|senat|congress|president|governor|mayor|democrat|republican|liberal|conservative|immigra|abortion|gun|protest|riot|war|tariff|police|shooting|murder|crime)\w*/i;
const now = {
  weather: { kind: 'cloudy', tempF: 64, source: 'NWS' },
  traffic: { roads: { 'I-405 North': { ratio: 0.45 }, 'I-5 South': { ratio: 0.9 }, 'CA-57 North': { ratio: 0.7 } }, source: 'TomTom' },
  trends: ['the marine layer that won\'t burn off', 'the Coastal League playoffs', 'a taco truck on every corner this week', 'the new paint on the 57 overpass', 'the first cold morning of the season', 'that cover band at the fair', 'sunset at 6:15 now', 'the stadium traffic on game nights'],
  league: leagueDay(new Date(2026, 6, 15)),   // mid-season
  road: '',                                   // no road set: every freeway is possible
  venue: 'Lot 57',
};
let fails = 0;
const expect = (ok, msg) => { if (!ok) { fails++; console.log('  FAIL ' + msg); } else console.log('  PASS ' + msg); };

// the league plays itself the same way everywhere
const d = new Date(2026, 6, 15);
expect(gamesOn(d).length === 4 && new Set(gamesOn(d).flat().map((c) => c.id)).size === 8, 'four games a day, every club plays once');
const g1 = playGame(d, CLUBS[0], CLUBS[1]), g2 = playGame(new Date(2026, 6, 15), CLUBS[0], CLUBS[1]);
expect(g1.homeRuns === g2.homeRuns && g1.awayRuns === g2.awayRuns && g1.homeRuns !== g1.awayRuns, `a result is the same on every device and never a tie: ${g1.homeRuns}-${g1.awayRuns}`);
const lg = now.league;
expect(lg.phase.kind === 'season' && lg.standings.reduce((n, s) => n + s.w, 0) === lg.standings.reduce((n, s) => n + s.l, 0), `mid-July standings balance: ${lg.standings.map((s) => `${s.club.short} ${s.w}-${s.l}`).join(', ')}`);
const off = leagueDay(new Date(2026, 0, 10));
expect(off.phase.kind === 'offseason' && off.daysToOpening > 0 && off.yesterday.length === 0, `January is the off-season, opening day in ${off.daysToOpening} days`);
expect(leagueDay(new Date(2026, 9, 5)).phase.kind === 'playoffs', 'early October is the playoffs');

// the count: every distinct opener and reply per topic, exactly; a conversation is an opener and a reply on the
// same topic
const t0 = Date.now();
const { openers, replies } = enumerateAll(now);
let openerTotal = 0, replyTotal = 0, conversations = 0;
const all = new Set();
for (const tp of TOPICS) {
  const o = openers.get(tp).size, r = replies.get(tp).size;
  openerTotal += o; replyTotal += r; conversations += o * r;
  for (const s of openers.get(tp)) all.add(s);
  console.log(`    ${tp.padEnd(8)} ${String(o).padStart(7)} openers × ${String(r).padStart(4)} replies = ${(o * r).toLocaleString().padStart(11)} conversations`);
}
console.log(`  distinct openers ${all.size.toLocaleString()} (${openerTotal.toLocaleString()} by topic), distinct replies ${replyTotal.toLocaleString()}, conversations ${conversations.toLocaleString()} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
expect(all.size >= 20000, `at least 20,000 distinct openers (${all.size.toLocaleString()})`);
expect(conversations >= 100000, `at least 100,000 distinct two-line conversations (${conversations.toLocaleString()})`);
let bad = 0; for (const s of all) if (BLOCK.test(s)) { bad++; if (bad < 4) console.log('    blocklisted: ' + s); }
for (const set of replies.values()) for (const s of set) if (BLOCK.test(s)) bad++;
expect(bad === 0, `no line trips the no-politics blocklist (${bad})`);
let empty = 0; for (const s of all) if (/\{\w+\}/.test(s) || s.length < 4) empty++;
expect(empty === 0, `every line is filled (${empty} with a slot left)`);

// what it sounds like
function rngFrom(seed) { let x = (seed * 2654435761 + 1) >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
console.log('\n  samples:');
for (let i = 0; i < 8; i++) { const [a, b] = exchange(rngFrom(100 + i), { mood: MOODS[i], energy: 'mid' }, { mood: MOODS[(i + 5) % 12], energy: ENERGIES[i % 3] }, now); console.log(`    [${a.topic}] ${a.mood}: ${a.text}\n      ${b.mood}: ${b.text}`); }
console.log('    DJ: ' + djLine(rngFrom(7), now, 'KFWY'));
console.log(`\n${fails ? fails + ' FAILED' : 'all passed'}`);
process.exit(fails ? 1 : 0);
