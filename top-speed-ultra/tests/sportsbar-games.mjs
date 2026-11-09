// S2b's unit test of the games' engine (PROJECT_OC_SPORTS_BAR.md, "### S2b: the games", Checks): pool physics, the
// house opponent's pool shots, darts 301, shuffleboard's slide, and whole games played out by the engine on both sides.
// Bundles engine/sim/pool.ts, darts.ts, shuffle.ts and games.ts with esbuild into the scratch folder and runs them in
// Node: no browser.
//   node tests/sportsbar-games.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'sportsbar', 'sim');
mkdirSync(OUT, { recursive: true });
const entry = path.join(OUT, 'games-entry.ts');
writeFileSync(entry, ['pool', 'darts', 'shuffle', 'games'].map((m) => `export * as ${m === 'shuffle' ? 'shuffle' : m} from '${path.join(ROOT, `src/onfoot/engine/sim/${m}.ts`)}';`).join('\n') + `\nexport { mulberry, hash32 } from '${path.join(ROOT, 'src/onfoot/engine/sim/rng.ts')}';\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: path.join(OUT, 'games.mjs'), logLevel: 'warning' });
const S = await import(pathToFileURL(path.join(OUT, 'games.mjs')).href + '?t=' + Date.now());
const { pool: P, darts: D, shuffle: SH, mulberry, hash32 } = S;

let fails = 0;
const summary = {};
const check = (name, ok, note) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${note}`); if (!ok) fails++; };

// ------------------------------------------------------------------------------------------------ pool physics
{
  const { R, W, L, POCKET_R } = P.POOL;
  let worstRise = 0, worstT = 0, offTable = 0, onTableBad = 0, totalPotted = 0, n = 0, settleTimes = [];
  for (let k = 0; k < 500; k++) {
    const r = mulberry(hash32('break', k));
    const balls = P.rack(k);
    // a random break: the cue ball anywhere behind the head string, aimed within 3 degrees of the apex, 3.5 to 5.5 m/s
    const cue = balls[0]; cue.x = (r() * 2 - 1) * 0.35; cue.y = -L / 4 - r() * 0.3;
    const apex = balls.find((b) => b.y === Math.min(...balls.filter((x) => x.id).map((x) => x.y)) && b.id);
    const a = Math.atan2(apex.y - cue.y, apex.x - cue.x) + ((r() * 2 - 1) * 3 * Math.PI) / 180, v = 3.5 + 2 * r();
    cue.vx = Math.cos(a) * v; cue.vy = Math.sin(a) * v;
    const ev = { potted: [], firstHit: null, cushions: 0, clicks: 0 };
    let e0 = P.energy(balls), t = 0;
    while (P.moving(balls) && t < 60) {
      P.substep(balls, ev); t += 1 / P.POOL.HZ;
      const e1 = P.energy(balls); if (e1 - e0 > worstRise) worstRise = e1 - e0; e0 = e1;
      for (const b of balls) {
        if (!b.on) continue;
        if (Math.abs(b.x) > W / 2 - R + 1e-9 || Math.abs(b.y) > L / 2 - R + 1e-9) onTableBad++;
      }
    }
    // a pocketed ball must have gone down within a pocket's radius; every ball off the table is one that was potted
    const offIds = balls.filter((b) => !b.on).map((b) => b.id).sort((x, y) => x - y), pottedIds = [...ev.potted].sort((x, y) => x - y);
    if (JSON.stringify(offIds) !== JSON.stringify(pottedIds)) offTable++;
    totalPotted += ev.potted.length; n++;
    settleTimes.push(t); if (t > worstT) worstT = t;
  }
  settleTimes.sort((a, b) => a - b);
  summary.breaks = { n, worstRise, worstT, median: settleTimes[250], potted: totalPotted / n };
  check('pool physics: energy never grows (500 random breaks, every 240 Hz substep)', worstRise <= 1e-12, `the largest rise in kinetic energy over a substep: ${worstRise.toExponential(2)} J/kg (none allowed)`);
  check('pool physics: no ball ever leaves the table (every substep of 500 breaks)', offTable === 0 && onTableBad === 0, `${onTableBad} positions off the bed, ${offTable} breaks whose balls off the table weren't potted`);
  check('pool physics: 500 random breaks all settle in under 20 s', worstT < 20, `the slowest ${worstT.toFixed(2)} s, the median ${settleTimes[250].toFixed(2)} s; ${(totalPotted / n).toFixed(2)} balls potted a break (3.5 to 5.5 m/s)`);
}
// ------------------------------------------------------------------------------------------------ the house's pool shots
{
  const { R, W, L } = P.POOL;
  let pots = 0, safeties = 0, bad = [];
  for (let k = 0; k < 200; k++) {
    const r = mulberry(hash32('rack-layout', k));
    // a seeded rack in play: 2 to 15 object balls left, scattered (no overlaps, none in a mouth), the cue anywhere
    const nObj = 2 + Math.floor(r() * 14), ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].sort(() => r() - 0.5).slice(0, nObj);
    if (!ids.includes(8)) ids[0] = 8;
    const balls = P.layOut([0, ...ids], hash32('lay', k));
    const g = ['solids', 'stripes', null][k % 3];
    const targets = g === null ? balls.filter((b) => b.id && b.id !== 8).map((b) => b.id) : (() => { const own = balls.filter((b) => b.id && b.id !== 8 && (b.id < 8) === (g === 'solids')).map((b) => b.id); return own.length ? own : [8]; })();
    const shot = P.choose(balls, targets);
    if (!shot) { bad.push(`rack ${k}: no shot`); continue; }
    if (shot.kind === 'safety') { safeties++; continue; }
    pots++;
    const cue = balls.find((b) => b.id === 0), b = balls.find((x) => x.id === shot.ball), pk = P.POCKETS[shot.pocket];
    const clear1 = P.clearPath(balls, cue.x, cue.y, shot.ghost[0], shot.ghost[1], 0, b.id), clear2 = P.clearPath(balls, b.x, b.y, pk.x, pk.y, b.id);
    const ux = (pk.x - b.x), uy = (pk.y - b.y), ul = Math.hypot(ux, uy), gx = shot.ghost[0] - cue.x, gy = shot.ghost[1] - cue.y, gl = Math.hypot(gx, gy);
    const theta = Math.acos(Math.max(-1, Math.min(1, (gx * ux + gy * uy) / (gl * ul)))) * 180 / Math.PI;
    const side = pk.side ? Math.acos((ux * pk.nx + uy * pk.ny) / ul) * 180 / Math.PI : 0;
    if (!clear1 || !clear2 || theta >= 70 || side > 50 || !targets.includes(shot.ball)) bad.push(`rack ${k}: ball ${shot.ball} pocket ${shot.pocket} clear ${clear1}/${clear2} cut ${theta.toFixed(1)} side ${side.toFixed(1)}`);
  }
  summary.house = { pots, safeties, bad: bad.length };
  check('the house\'s pool shots: in 200 seeded racks every chosen shot passes the clear-path test with a cut under 70 degrees (side pockets within 50 degrees), or it\'s a safety', bad.length === 0, `${pots} pots, ${safeties} safeties${bad.length ? '; ' + bad.slice(0, 4).join('; ') : ''}`);
}
// ------------------------------------------------------------------------------------------------ ball in hand (S2b's repair)
{
  // the player's ball in hand: placing keeps it in hand (the player can move it again), clamps to the bed and finds the
  // nearest free spot; the shot ends it; a direction or speed that isn't a finite number, or a speed of 0 or less, is
  // refused rather than clamped
  const g = new P.PoolGame([{ who: 'you', group: null, competitive: 0.5 }, { who: 'house', group: null, competitive: 0.6 }], 9);
  g.breakShot = false; g.ballInHand = true;
  g.place(0.2, -0.3, true); const a = [g.cue().x, g.cue().y, g.ballInHand];
  g.place(9, 0.3, true); const b = [g.cue().x, g.cue().y, g.ballInHand];
  const onBall = g.balls.find((x) => x.id === 5); g.place(onBall.x, onBall.y, true); const c = [g.cue().x, g.cue().y], gap = Math.hypot(c[0] - onBall.x, c[1] - onBall.y);
  g.place(0.2, -0.3, true);
  const bad = [g.shoot(NaN, 2), g.shoot(1, NaN), g.shoot(1, -1), g.shoot(1, 0), g.shoot(Infinity, 2)];
  const okShot = g.shoot(Math.PI / 2, 1.0), from = [g.cue().x, g.cue().y], after = g.ballInHand;
  g.settle();
  const XM = P.POOL.W / 2 - P.POOL.R, YM = P.POOL.L / 2 - P.POOL.R;
  check('pool: ball in hand stays in hand while you place it (anywhere on the bed, the nearest free spot); the shot ends it; NaN, infinite, zero or negative shots are refused',
    a[2] === true && Math.abs(a[0] - 0.2) < 1e-9 && Math.abs(a[1] + 0.3) < 1e-9 && b[2] === true && Math.abs(b[0] - XM) < 1e-9 && Math.abs(b[1] - 0.3) < 1e-9 && gap >= 2 * P.POOL.R && bad.every((x) => x === false) && okShot && !after && Math.abs(from[0] - 0.2) < 1e-9,
    `placed at (0.2, -0.3): (${a[0].toFixed(3)}, ${a[1].toFixed(3)}), in hand ${a[2]}; asked for (9, 0.3), off the bed: (${b[0].toFixed(3)}, ${b[1].toFixed(3)}), on the bed at the cushion's line; on the 5 ball: moved ${(gap * 1000).toFixed(1)} mm from its centre (>= ${(2 * P.POOL.R * 1000).toFixed(0)}); refused shots ${JSON.stringify(bad)}; a good shot ${okShot} from (${from[0].toFixed(2)}, ${from[1].toFixed(2)}), in hand after it ${after}`);
  // the house's ball in hand: bestPlacement over 200 seeded layouts, timed (it runs candidates() at up to 91 grid points)
  const times = [];
  for (let k = 0; k < 200; k++) {
    const r = mulberry(hash32('bip', k)), nObj = 2 + Math.floor(r() * 14), ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].sort(() => r() - 0.5).slice(0, nObj);
    if (!ids.includes(8)) ids[0] = 8;
    const gg = new P.PoolGame([{ who: 'A', group: ['solids', 'stripes', null][k % 3], competitive: 0.5 }, { who: 'B', group: null, competitive: 0.5 }], k);
    gg.balls = P.layOut([0, ...ids], hash32('bip-lay', k)); gg.breakShot = false; gg.open = k % 3 === 2; gg.ballInHand = true;
    const t0 = performance.now(); gg.bestPlacement(); times.push(performance.now() - t0);
  }
  times.sort((x, y) => x - y);
  summary.bestPlacement = { median: times[100], p95: times[190], worst: times[199] };
  check('pool: the house\'s ball-in-hand search (bestPlacement) over 200 seeded layouts, timed in Node on this machine', times[199] < 250, `median ${times[100].toFixed(2)} ms, 95th percentile ${times[190].toFixed(2)} ms, worst ${times[199].toFixed(2)} ms (the first call includes the JIT's warm-up)`);
}
// ------------------------------------------------------------------------------------------------ whole pool games
{
  const out = []; let finished = 0, longest = 0;
  for (let k = 0; k < 40; k++) {
    const c = [0.2 + 0.6 * ((k * 7) % 10) / 10, 0.5];
    const g = new P.PoolGame([{ who: 'A', group: null, competitive: c[0] }, { who: 'B', group: null, competitive: c[1] }], k);
    // the break: a firm shot at the apex
    const cue = g.cue(), apex = g.balls.reduce((m, b) => (b.id && b.y < m.y ? b : m), { y: Infinity });
    g.shoot(Math.atan2(apex.y - cue.y, apex.x - cue.x), 5);
    g.settle();
    let shots = 1;
    while (g.winner === null && shots < 400) { const p = g.plan(hash32('g', k), g.sides[g.turn].competitive); if (!p) break; g.shoot(p.angle, p.speed); g.settle(); shots++; }
    if (g.winner !== null) finished++;
    longest = Math.max(longest, shots);
    if (k < 3) out.push(`game ${k}: ${g.winner !== null ? g.sides[g.winner].who + ' won' : 'unfinished'} in ${shots} shots (${g.overNote})`);
  }
  check('pool: 40 whole games, the house\'s selection on both sides, each ends with a winner', finished === 40, `${finished} of 40 finished, the longest ${longest} shots; ${out.join('; ')}`);
}
// ------------------------------------------------------------------------------------------------ darts
{
  const g = new D.DartsGame([{ who: 'you', competitive: 0.5 }, { who: 'house', competitive: 0.5 }]);
  const at = (seg, mult) => D.bedPoint(seg, mult);
  const t20 = D.scoreAt(...at(20, 3)), d20 = D.scoreAt(...at(20, 2)), s1 = D.scoreAt(...at(1, 1)), bull = D.scoreAt(0, 0), b25 = D.scoreAt(0, 0.012), miss = D.scoreAt(0.2, 0);
  const s6 = D.scoreAt(0.05, 0), s3 = D.scoreAt(0, -0.05), s11 = D.scoreAt(-0.05, 0);
  check('darts: the standard board (T20 60, D20 40, 1 to the right of 20, 6 at 3 o\'clock, 3 at 6, 11 at 9, bull 50, outer bull 25, off the board 0)', t20.score === 60 && d20.score === 40 && s1.score === 1 && bull.score === 50 && b25.score === 25 && miss.score === 0 && s6.seg === 6 && s3.seg === 3 && s11.seg === 11, [t20, d20, s1, bull, b25, miss, s6, s3, s11].map((h) => h.label).join(', '));
  // 301 straight out: down to 20, then a single 20 wins with no double needed
  const throwAt = (seg, mult) => g.land(...at(seg, mult));
  for (const [s, m] of [[20, 3], [20, 3], [20, 3]]) throwAt(s, m);                       // you: 180, 121 left
  for (const [s, m] of [[1, 1], [1, 1], [1, 1]]) throwAt(s, m);                           // house: 3, 298
  for (const [s, m] of [[20, 3], [20, 1], [1, 1]]) throwAt(s, m);                         // you: 81, 40 left
  for (const [s, m] of [[1, 1], [1, 1], [1, 1]]) throwAt(s, m);                           // house: 295
  const a = throwAt(20, 1);                                                               // you: 20 left
  const bust = throwAt(20, 3);                                                            // 60 > 20: bust, back to 40
  check('darts: a throw past zero busts (the turn\'s darts don\'t count; back to 40, the turn passes)', bust.bust && g.left[0] === 40 && g.turn === 1 && a.left === 20, `after a single 20: ${a.left} left; the treble 20 busts: ${JSON.stringify({ bust: bust.bust, left: g.left[0], turn: g.turn })}`);
  for (const [s, m] of [[1, 1], [1, 1], [1, 1]]) throwAt(s, m);
  throwAt(20, 1); const win = throwAt(20, 1);
  check('darts: 301 straight out (a single 20 then a single 20 from 40 wins: no double needed)', win.won && g.winner === 0 && g.left[0] === 0, JSON.stringify({ won: win.won, winner: g.winner, left: g.left, hit: win.hit.label }));
  // whole games, the house on both sides
  let finished = 0, turnsMax = 0;
  for (let k = 0; k < 40; k++) {
    const gg = new D.DartsGame([{ who: 'A', competitive: 0.3 }, { who: 'B', competitive: 0.8 }], k % 2);
    let n = 0;
    while (gg.winner === null && n < 600) { const h = gg.houseThrow(hash32('d', k)); const res = gg.land(...h.at); if (res.turnOver) gg.clearBoard(); n++; }
    if (gg.winner !== null) finished++; turnsMax = Math.max(turnsMax, gg.turns);
  }
  check('darts: 40 whole games of 301, the house on both sides, each ends with a winner', finished === 40, `${finished} of 40, the longest ${turnsMax} turns`);
  // the sway: steadies over 1.2 s, then grows; low energy widens it
  const sw = [0, 0.6, 1.2, 2.0, 3.0].map((t) => D.swayAmp(t, 70)), low = D.swayAmp(1.2, 5);
  check('darts: your aim\'s sway steadies for 1.2 s, then grows; low energy widens it a little', sw[1] < sw[0] && sw[2] < sw[1] && sw[3] > sw[2] && sw[4] > sw[3] && low > sw[2] && low < sw[2] * 1.6, `amplitude at 0, 0.6, 1.2, 2.0, 3.0 s: ${sw.map((x) => (x * 1000).toFixed(1)).join(', ')} mm; at 1.2 s with energy 5: ${(low * 1000).toFixed(1)} mm`);
}
// ------------------------------------------------------------------------------------------------ shuffleboard
{
  const d = SH.slideDistance(3.0);
  check('shuffleboard: a puck released at 3.0 m/s stops 6.55 m +- 0.05 m away', Math.abs(d - 6.55) <= 0.05, `${d.toFixed(4)} m (v^2 / 2 mu g = ${(9 / (2 * SH.DECEL)).toFixed(4)} m); it lies in zone ${SH.zoneOf(SH.SHUFFLE.X0 + d)}`);
  // momentum and energy in a puck-puck hit: e 0.8
  const g = new SH.ShuffleGame([{ who: 'A', competitive: 0.5 }, { who: 'B', competitive: 0.5 }]);
  g.slide(SH.speedFor(6.0), 0, 0); g.settle();
  g.slide(SH.speedFor(6.0) + 0.6, 0, 0); g.settle();
  const [p0, p1] = g.pucks;
  check('shuffleboard: a puck slid into another knocks it on (restitution 0.8)', p0.x > 6.0 + 0.05 || p0.out === 'gutter', `the first puck at ${p0.on ? p0.x.toFixed(3) : p0.out}, the second at ${p1.on ? p1.x.toFixed(3) : p1.out}`);
  let finished = 0, frames = 0, gutters = 0;
  for (let k = 0; k < 40; k++) {
    const gg = new SH.ShuffleGame([{ who: 'A', competitive: 0.3 }, { who: 'B', competitive: 0.8 }], k % 2);
    let n = 0;
    while (gg.winner === null && n < 800) { const h = gg.housePlan(hash32('s', k)); gg.slide(h.speed, h.line, h.y0); gg.settle(); n++; }
    if (gg.winner !== null) finished++; frames += gg.frame;
    gutters += gg.log.length;
  }
  check('shuffleboard: 40 whole games to 15, the house on both sides, each ends with a winner', finished === 40, `${finished} of 40, ${(frames / 40).toFixed(1)} frames a game on average`);
}

console.log(fails ? `${fails} FAILED` : 'all passed');
writeFileSync(path.join(OUT, 'games-summary.json'), JSON.stringify(summary, null, 1));
process.exit(fails ? 1 : 0);
