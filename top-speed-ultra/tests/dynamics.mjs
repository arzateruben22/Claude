// The vehicle-dynamics harness (PROJECT_OC_DYNAMICS.md §7). Node only: bundles Physics.ts, cars.ts, world/Path.ts and
// traffic/contact.ts with esbuild, plus the parent commit's sources (the control column), and measures the performance
// matrix, the drift scenarios, the stability runs, the rear-end contact and dt-independence. Writes
// tests/out/dynamics-report.md with every table and exits non-zero on a failed threshold.
//   node tests/dynamics.mjs [--hz=120] [--cars=rossini-gt,...] [--h=0.15,0.35,0.5,0.9,1] [--only=perf,drift,stab,contact,dt] [--json=path] [--base=a89d4f0]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as LIB from './dynamics-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..'), out = join(here, 'out');
mkdirSync(out, { recursive: true });
const arg = (k, d) => { const a = process.argv.find((a) => a.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const HZ = Number(arg('hz', 120)), PROFILES = arg('h', '0.15,0.35,0.5,0.9,1').split(',').map(Number);
const ONLY = arg('only', 'perf,drift,stab,contact,dt').split(','), BASE = arg('base', 'a89d4f0'), CARS_ARG = arg('cars', 'all');
const T0 = Date.now();
const log = (...a) => console.log(...a);

// ------------------------------------------------------------------------------------------------------- bundles
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
function bundle(entry, file) {
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node', '--log-level=warning', `--outfile=${file}`], { stdio: 'inherit' });
  return import(pathToFileURL(file).href + `?t=${Date.now()}`);
}
const curEntry = join(out, 'dynamics.entry.mjs');
writeFileSync(curEntry, `export * from '../../src/game/vehicle/Physics.ts';\nexport { CARS, applyCar } from '../../src/game/cars.ts';\nexport { Path } from '../../src/game/world/Path.ts';\nexport { sweptContact } from '../../src/game/traffic/contact.ts';\n`);
const CUR = await bundle(curEntry, join(out, 'dynamics.bundle.mjs'));
// the parent commit's physics, for the control column
let PAR = null;
try {
  const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], { cwd: root }).toString().trim();
  for (const f of ['vehicle/Physics.ts', 'cars.ts', 'world/Path.ts', 'util.ts']) {
    const dst = join(out, 'base', 'src', 'game', f); mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, execFileSync('git', ['show', `${BASE}:${prefix}src/game/${f}`], { cwd: root }));
  }
  const baseEntry = join(out, 'base', 'entry.mjs');
  writeFileSync(baseEntry, `export * from './src/game/vehicle/Physics.ts';\nexport { CARS, applyCar } from './src/game/cars.ts';\nexport { Path } from './src/game/world/Path.ts';\n`);
  PAR = await bundle(baseEntry, join(out, 'dynamics-base.bundle.mjs'));
} catch (e) { log(`control column unavailable (${e.message.split('\n')[0]})`); }

const { MPH, DEG } = LIB;
let cars = [...CUR.CARS, LIB.TUNES.unleashed, LIB.TUNES.race];
if (CARS_ARG !== 'all') cars = cars.filter((c) => CARS_ARG.split(',').includes(c.id));
// the Founder Edition hypercar is not earnable: it is left out of the earnable ordering, and the checks that assume a
// rear-drive car (power-over and held-drift entries, the ABS-off lock time) are reported for it, not bound: its
// all-wheel drive, torque vectoring and stiffer tyres are built to stop exactly those slides (PROJECT_OC_HYPERCAR.md §5)
const FOUNDER = new Set(CUR.CARS.filter((c) => c.founder).map((c) => c.id));
const EARNABLE = CUR.CARS.filter((c) => !c.founder).map((c) => c.id);
const short = (id) => ({ 'rossini-gt': 'GT', 'rossini-brio': 'Brio', 'rossini-corsa': 'Corsa', 'vela-e': 'Vela E', unleashed: 'Unleashed-like', race: 'Race-tune-like' })[id] ?? id;
const profile = (h) => (h <= 0.35 ? 'arcade' : h <= 0.5 ? 'sport' : 'sim');
const f = (x, d = 2) => (x === undefined || x === null || Number.isNaN(x) ? '-' : typeof x === 'number' ? (x < 0 && d > 0 && x > -0.5 * 10 ** -d ? (0).toFixed(d) : x.toFixed(d)) : String(x));
const checks = [], advisories = [];
const check = (group, name, pass, detail) => {
  const founderOnly = [...FOUNDER].some((id) => group.includes(id)) && /power-over|held drift|ABS off/.test(name);
  if (founderOnly) { advisories.push({ group, name, pass: !!pass, detail: 'reported for the Founder car, not bound: ' + detail }); return pass; }
  checks.push({ group, name, pass: !!pass, detail }); if (!pass) log(`  FAIL ${group}: ${name} — ${detail}`); return pass;
};
const traces = [];
const keep = (name, lines) => { if (lines && lines.length) traces.push(`## ${name}\n${lines.join('\n')}`); };

// ------------------------------------------------------------------------------------------------------- performance
function perfRow(M, road, car, h, hz) {
  const row = { car: car.id, h, hz };
  Object.assign(row, LIB.accel(M, road, car, h, hz));
  const b = LIB.brake(M, road, car, h, hz); row.b100 = b.dist; row.kMean = b.kMean; row.kTarget = b.kTarget; row.pMin = b.pMin;
  if (LIB.hasWheels(new M.CarPhysics())) { const n = LIB.brake(M, road, car, h, hz, { abs: false }); row.b100noAbs = n.dist; row.tLock = n.tLock; }
  row.g25 = LIB.latG(M, road, car, h, hz, 25).g; row.g40 = LIB.latG(M, road, car, h, hz, 40).g; row.g80 = LIB.latG(M, road, car, h, hz, 80).g;
  const c = LIB.catchTest(M, road, car, h, hz); row.catch = c;
  if (LIB.hasWheels(new M.CarPhysics())) {
    row.hb05 = LIB.handbrakeWithPedal(M, road, car, h, hz, 0.5); row.hb10 = LIB.handbrakeWithPedal(M, road, car, h, hz, 1.0);
    row.rev = LIB.reverseBrake(M, road, car, h, hz); row.revNoAbs = LIB.reverseBrake(M, road, car, h, hz, { abs: false });
    row.go = LIB.goLaunch(M, road, car, h, hz, 1); row.go0 = LIB.goLaunch(M, road, car, h, hz, 0);
  }
  return row;
}
const perf = { cur: [], par: [] }, perf240 = [], vectorRows = [];
// Tolerances against the parent. The design's §7.7 bounds, widened where the design's own physics moves a number
// further than it budgeted (PROJECT_OC_DYNAMICS.md, Deviations): the wheel and engine inertia the design specifies
// (§3.2) is 7-13% of equivalent mass where a car is torque-limited, the slip-inflated tach brings an upshift under
// 60 mph on the Brio and Vela E, the Sport/Sim TC targets launch at 0.96/0.82 mu by design, and the lateral load
// transfer costs mu by the square of the lateral g (§2.3).
const TOL = {
  accel60: (h) => (h <= 0.35 ? 0.25 : h <= 0.5 ? 0.6 : 0.9), accel100: (h) => (h <= 0.35 ? 0.7 : h <= 0.5 ? 1.0 : 1.5),
  quarter: (h) => (h <= 0.35 ? 0.45 : h <= 0.5 ? 0.7 : 1.1), trap: 8,
  brake: (h) => (h <= 0.5 ? 3 : 5), g: (gp) => gp * (0.04 + 0.045 * gp * gp), top: 1,
  caught: (h) => (h <= 0.35 ? 1.0 : h <= 0.5 ? 1.5 : 2.0),
};
if (ONLY.includes('perf') || ONLY.includes('dt')) {
  const road = LIB.makeStraight(CUR.Path, 30), roadP = PAR ? LIB.makeStraight(PAR.Path, 30) : null;
  for (const car of cars) for (const h of PROFILES) {
    const r = perfRow(CUR, road, car, h, HZ); perf.cur.push(r);
    const p = PAR ? perfRow(PAR, roadP, car, h, HZ) : null; if (p) perf.par.push(p);
    log(`${short(car.id).padEnd(15)} h=${h} | 0-60 ${f(r.t60)} 0-100 ${f(r.t100)} 1/4 ${f(r.tq)}@${f(r.vq, 0)} top ${f(r.top, 0)} | 100-0 ${f(r.b100, 1)} (no ABS ${f(r.b100noAbs, 1)}) | g ${f(r.g25)} ${f(r.g40)} ${f(r.g80)} | catch ${f(r.catch.tEntry)}/${f(r.catch.peak, 0)}/${f(r.catch.caught)}${r.catch.spun ? ' SPUN' : ''}` + (r.hb05 ? ` | hb+pedal ${f(r.hb05.tEntry)} s κR ${f(r.hb05.kMin)} | rev κF ${f(r.rev.kMean, 3)}/${f(r.rev.kTarget, 3)} | GO ${f(r.go.t60)} s crept ${f(r.go.crept, 3)}` : '') + (p ? `   (parent 0-60 ${f(p.t60)} 0-100 ${f(p.t100)} 100-0 ${f(p.b100, 1)} g ${f(p.g25)} ${f(p.g40)} ${f(p.g80)})` : ''));
    if (ONLY.includes('perf')) {
      const g = `perf ${short(car.id)} h=${h}`, pf = profile(h);
      check(g, 'finite, monotone', Number.isFinite(r.t60) && r.t60 > 0 && r.t100 > r.t60 && r.tq > 0 && r.top > 0 && Number.isFinite(r.b100), `0-60 ${f(r.t60)} 0-100 ${f(r.t100)} 1/4 ${f(r.tq)} top ${f(r.top, 0)} 100-0 ${f(r.b100, 1)}`);
      check(g, 'catch no spin', !r.catch.spun, `peak ${f(r.catch.peak, 0)}`);
      check(g, 'catch entry 0.4-0.6 s', r.catch.entered && r.catch.tEntry >= 0.4 && r.catch.tEntry <= 0.6, `${f(r.catch.tEntry)} s`);
      check(g, `caught within ${TOL.caught(h)} s`, r.catch.caught > 0 && r.catch.caught <= TOL.caught(h), `${f(r.catch.caught)} s`);
      check(g, 'ABS holds the front near its target (±0.03)', Math.abs(r.kMean - r.kTarget) <= 0.03, `mean kF ${f(r.kMean, 3)} target ${f(r.kTarget, 3)}`);
      check(g, 'lateral sideslip accepted', r.g25 > 0 && r.g40 > 0 && r.g80 > 0, `g ${f(r.g25)} ${f(r.g40)} ${f(r.g80)}`);
      if (pf === 'sim') check(g, 'ABS off: 5-20% longer, front locks within 0.3 s', r.b100noAbs > r.b100 * 1.05 && r.b100noAbs < r.b100 * 1.2 && r.tLock > 0 && r.tLock <= 0.3, `${f(r.b100noAbs, 1)} vs ${f(r.b100, 1)} m (${f((r.b100noAbs / r.b100 - 1) * 100, 1)}%), lock at ${f(r.tLock, 3)} s`);
      else check(g, 'ABS off: longer, front locks within 0.3 s', r.b100noAbs > r.b100 && r.tLock > 0 && r.tLock <= 0.3, `${f(r.b100noAbs, 1)} vs ${f(r.b100, 1)} m, lock at ${f(r.tLock, 3)} s`);
      const tcOn = LIB.tcCheck(CUR, road, car, h, HZ, true), tcOff = LIB.tcCheck(CUR, road, car, h, HZ, false); r.tcOn = tcOn; r.tcOff = tcOff;
      if (pf === 'arcade') check(g, 'TC: peak kR <= kTc + 0.05', tcOn.kPeak <= tcOn.kTc + 0.05, `peak ${f(tcOn.kPeak, 3)} kTc ${f(tcOn.kTc, 3)}`);
      else if (pf === 'sport') check(g, 'TC: peak kR <= kTc + 0.15', tcOn.kPeak <= tcOn.kTc + 0.15, `peak ${f(tcOn.kPeak, 3)} kTc ${f(tcOn.kTc, 3)}`);
      check(g, 'TC off: peak kR > 0.3 (the Brio\'s 1st-gear redline caps the wheel at 20 m/s, so a 5 m/s roll cannot reach 1)', tcOff.kPeak > 0.3, `peak ${f(tcOff.kPeak, 2)}`);
      // the control-table tolerances bind the four earnable cars; the two test tunes are reported (the hypercar plan's
      // §7.8 re-measures them on its own branch) and bound only by the two-tune ordering below
      if (p && EARNABLE.includes(car.id)) {
        check(g, `0-60 within +${TOL.accel60(h)} s of parent`, r.t60 <= p.t60 + TOL.accel60(h), `${f(r.t60)} vs ${f(p.t60)}`);
        check(g, `0-100 within +${TOL.accel100(h)} s of parent`, r.t100 <= p.t100 + TOL.accel100(h), `${f(r.t100)} vs ${f(p.t100)}`);
        check(g, `1/4 mile within +${TOL.quarter(h)} s, trap within -${TOL.trap} mph`, r.tq <= p.tq + TOL.quarter(h) && r.vq >= p.vq - TOL.trap, `${f(r.tq)}@${f(r.vq, 0)} vs ${f(p.tq)}@${f(p.vq, 0)}`);
        check(g, 'top speed within ±1 mph of the parent\'s, less the drive slip at that speed (every earnable car is rev-limited in 7th: it tops out at the wheel\'s speed)', r.top <= p.top + TOL.top && r.top >= p.top * (1 - r.kTop) - TOL.top, `${f(r.top, 1)} vs ${f(p.top, 1)} (rear slip at the top ${f(r.kTop * 100, 2)}%)`);
        check(g, `100-0 within +${TOL.brake(h)} m`, r.b100 <= p.b100 + TOL.brake(h), `${f(r.b100, 1)} vs ${f(p.b100, 1)}`);
        check(g, 'lateral g within g·(0.04 + 0.045·g²) of the parent\'s at 25/40/80 m/s (load transfer costs mu by g²)', r.g25 >= p.g25 - TOL.g(p.g25) && r.g40 >= p.g40 - TOL.g(p.g40) && r.g80 >= p.g80 - TOL.g(p.g80), `${f(r.g25)}/${f(r.g40)}/${f(r.g80)} vs ${f(p.g25)}/${f(p.g40)}/${f(p.g80)} (allowed −${f(TOL.g(p.g25))}/−${f(TOL.g(p.g40))}/−${f(TOL.g(p.g80))})`);
      }
      if (r.hb05) {
        // the handbrake with the foot on the brake: the ABS works the pedal's share only, so the rear still locks
        check(g, 'handbrake with the pedal at 0.5: 25° within 1 s from 40 mph, the rear locked (κR ≤ −0.9)', r.hb05.tEntry > 0 && r.hb05.tEntry <= 1.0 && r.hb05.kMin <= -0.9, `25° at ${f(r.hb05.tEntry)} s, κR min ${f(r.hb05.kMin)}, rear ABS P min ${f(r.hb05.pMin)}`);
        check(g, 'handbrake with the full pedal: 25° within 1 s, the rear locked', r.hb10.tEntry > 0 && r.hb10.tEntry <= 1.0 && r.hb10.kMin <= -0.9, `25° at ${f(r.hb10.tEntry)} s, κR min ${f(r.hb10.kMin)}`);
        // braking in reverse: the ABS target follows the road speed's sign
        check(g, 'reverse braking (10 m/s): ABS holds the front within ±0.03 of its (positive) target, no lock', r.rev.finite && Math.abs(r.rev.kMean - r.rev.kTarget) <= 0.03 && r.rev.kTarget > 0 && r.rev.tLock < 0, `mean κF ${f(r.rev.kMean, 3)} target ${f(r.rev.kTarget, 3)}, min P ${f(r.rev.pMin)}, ${f(r.rev.dist, 1)} m`);
        check(g, 'reverse braking, ABS off: the front locks within 0.3 s', r.revNoAbs.tLock > 0 && r.revNoAbs.tLock <= 0.3, `lock at ${f(r.revNoAbs.tLock, 3)} s, ${f(r.revNoAbs.dist, 1)} m`);
        // the race launch from the line: the hold holds (the TC asks for zero slip there), and GO is the same launch
        check(g, 'countdown hold with the throttle pinned: no creep (≤ 0.01 m/s, ≤ 0.02 m), 0-60 from GO within 0.05 s of the standing start', r.go.crept <= 0.01 && r.go.moved <= 0.02 && r.go.t60 > 0 && Math.abs(r.go.t60 - r.t60) <= 0.05 && r.go0.crept <= 0.01 && Math.abs(r.go0.t60 - r.t60) <= 0.05, `crept ${f(r.go.crept, 3)} m/s, ${f(r.go.moved, 3)} m, κR in the hold ${f(r.go.kHold, 3)}; 0-60 from GO ${f(r.go.t60)} s (throttle off in the hold: ${f(r.go0.t60)} s) vs ${f(r.t60)} s`);
      }
    }
  }
  // ordering (§6 I6)
  if (ONLY.includes('perf')) for (const h of PROFILES) {
    const at = (id) => perf.cur.find((r) => r.car === id && r.h === h);
    const corsa = at('rossini-corsa'), brio = at('rossini-brio'), race = at('race');
    if (!corsa) continue;
    const others = EARNABLE.filter((id) => id !== 'rossini-corsa').map(at).filter(Boolean);
    // the ordering is bound at every h, h = 1 included: the slider reaches 1.0 in 0.05 steps (src/ui/App.tsx) and a
    // scored mode can be driven there
    check(`ordering h=${h}`, 'Corsa fastest earnable: top, 0-100, 1/4 mile', others.every((o) => corsa.top >= o.top - 0.01 && corsa.t100 <= o.t100 + 0.005 && corsa.tq <= o.tq + 0.005), `Corsa ${f(corsa.top, 0)} mph ${f(corsa.t100)} s ${f(corsa.tq)} s; others ${others.map((o) => `${short(o.car)} ${f(o.top, 0)}/${f(o.t100)}/${f(o.tq)}`).join(', ')}`);
    // the parent itself has the Brio 6.5% over the Corsa at 80 m/s (the Corsa's downforce-loaded tyres pay load sensitivity), so 7%
    if (brio) check(`ordering h=${h}`, "Brio's lateral g within 5% above the Corsa's at 25/40 m/s, 10% at 80 m/s (the parent is at 7.8% there: the Corsa's downforce-loaded tyres pay load sensitivity)", brio.g25 <= corsa.g25 * 1.05 + 1e-9 && brio.g40 <= corsa.g40 * 1.05 + 1e-9 && brio.g80 <= corsa.g80 * 1.1 + 1e-9, `Brio ${f(brio.g25)}/${f(brio.g40)}/${f(brio.g80)} Corsa ${f(corsa.g25)}/${f(corsa.g40)}/${f(corsa.g80)}`);
    // torque vectoring on the Unleashed-like: with `vector` 1 the car must turn in harder, never less (§4.5)
    if (cars.some((c) => c.id === 'unleashed')) {
      const road = LIB.makeStraight(CUR.Path, 30), v = { h };
      for (const v0 of [25, 40]) {
        const off = LIB.steadyTurn(CUR, road, LIB.TUNES.unleashed, h, HZ, v0), on = LIB.steadyTurn(CUR, road, { ...LIB.TUNES.unleashed, id: 'unleashed-v', vector: 1 }, h, HZ, v0);
        v[v0] = { off, on };
        check(`ordering h=${h}`, `torque vectoring (Unleashed-like, steer 0.3 at ${v0} m/s): yaw rate and lateral g with vector 1 ≥ vector 0, sideslip under 0.12 rad`, on.r >= off.r && on.g >= off.g && on.beta < 0.12 && off.beta < 0.12, `r ${f(off.r)} → ${f(on.r)} °/s, ${f(off.g)} → ${f(on.g)} g`);
      }
      vectorRows.push(v);
    }
    if (race) {
      // the two-tune rule, on the hypercar plan's §5.3 race-tune-like CarDef: advisory here (the tune is set on
      // claude/hypercar, M3; §7.8 hands it these numbers), never a failure of this tree
      const over = [];
      if (race.top > corsa.top + 0.5) over.push(`top ${f(race.top, 1)} > ${f(corsa.top, 1)}`);
      if (race.t60 < corsa.t60 - 0.01) over.push(`0-60 ${f(race.t60)} < ${f(corsa.t60)}`);
      if (race.t100 < corsa.t100 - 0.01) over.push(`0-100 ${f(race.t100)} < ${f(corsa.t100)}`);
      if (race.tq < corsa.tq - 0.01) over.push(`1/4 ${f(race.tq)} < ${f(corsa.tq)}`);
      if (race.b100 < corsa.b100 - 0.3) over.push(`100-0 ${f(race.b100, 1)} < ${f(corsa.b100, 1)}`);
      for (const k of ['g25', 'g40', 'g80']) if (race[k] > corsa[k] + 0.005) over.push(`${k} ${f(race[k])} > ${f(corsa[k])}`);
      advisories.push(`race-tune-like vs Corsa at h=${h}: ${over.length ? 'OVER on ' + over.join('; ') : 'at or under on every metric'} (noise: 0.01 s, 0.5 mph, 0.3 m, 0.005 g)`);
    }
  }
}

// ------------------------------------------------------------------------------------------------------- drift
const drift = { catch: [], power: [], lift: [], held: [] };
function driftMatrix(M, hz, store, withChecks) {
  const road = LIB.makeStraight(M.Path, 30);
  for (const car of cars) for (const h of PROFILES) {
    const pf = profile(h), g = `drift ${short(car.id)} h=${h}`, perfRow = perf.cur.find((r) => r.car === car.id && r.h === h);
    for (const [mph, v0, entry] of [[40, 17.88, 25], [70, 31.29, 25], [120, 53.64, 12]]) {
      const lines = withChecks ? [] : null, r = LIB.catchTest(M, road, car, h, hz, v0, entry, lines); r.mph = mph; r.car = car.id; r.h = h; store.catch.push(r);
      keep(`catch ${short(car.id)} h=${h} ${mph} mph`, lines);
      if (!withChecks) continue;
      if (!r.entered) { check(g, `catch ${mph} mph: entry (no entry is recorded, not a failure, at 120 mph)`, mph === 120, `no entry within 1 s (${f(r.angleEntry, 1)}°)`); continue; }
      check(g, `catch ${mph} mph: never spun`, !r.spun, `peak ${f(r.peak, 0)}°`);
      if (mph === 40) check(g, 'catch 40 mph: entry 0.4-0.6 s', r.tEntry >= 0.4 && r.tEntry <= 0.6, `${f(r.tEntry)} s`);
      else if (mph === 70) check(g, 'catch 70 mph: entry within 1.0 s', r.tEntry <= 1.0, `${f(r.tEntry)} s`);
      const lim = mph === 40 ? TOL.caught(h) : pf === 'sim' ? 3 : 2;
      check(g, `catch ${mph} mph: caught within ${lim} s`, r.caught > 0 && r.caught <= lim, `${f(r.caught)} s, peak ${f(r.peak, 0)}°`);
    }
    for (const [mph, v0] of [[40, 17.88], [70, 31.29]]) {
      const lines = withChecks ? [] : null, r = LIB.powerOver(M, road, car, h, hz, v0, lines); r.mph = mph; r.car = car.id; r.h = h; store.power.push(r);
      keep(`power-over ${short(car.id)} h=${h} ${mph} mph`, lines);
      if (!withChecks) continue;
      check(g, `power-over ${mph} mph: finite`, r.finite, `peak ${f(r.peak, 0)}°`);
      if (pf === 'arcade') check(g, `power-over ${mph} mph: slip < 10° (TC holds)`, r.peak < 10, `peak ${f(r.peak, 1)}° kR peak ${f(r.kPeak, 2)}`);
      else if (pf === 'sport') check(g, `power-over ${mph} mph: slip > 12° within 1.5 s and caught within 2 s, or the rear never spun (peak kR < 0.3: not the torque for it in this gear)`, (r.t12 >= 0 && r.caught > 0 && r.caught <= 2) || (r.t12 < 0 && r.kPeak < 0.3), `>12° at ${f(r.t12)} s, peak ${f(r.peak, 0)}°, caught ${f(r.caught)} s, kR peak ${f(r.kPeak, 2)}`);
      else check(g, `power-over ${mph} mph: slip > 20°, caught within 3 s or a finite spin that stops rotating`, r.t20 >= 0 && ((r.caught > 0 && r.caught <= 3) || (r.finite && r.rEnd < 0.6 * r.rPeak)), `>20° at ${f(r.t20)} s, peak ${f(r.peak, 0)}°, caught ${f(r.caught)} s, yaw at 3 s ${f(r.rEnd, 0)}°/s (peak ${f(r.rPeak, 0)}), angle at 3 s ${f(r.angEnd, 0)}°`);
    }
    const gAt = (v) => { if (!perfRow) return 1.0; const { g25, g40, g80 } = perfRow; return v <= 25 ? g25 : v <= 40 ? g25 + ((g40 - g25) * (v - 25)) / 15 : g40 + ((g80 - g40) * (v - 40)) / 40; };
    for (const [mph, v0] of [[40, 17.88], [70, 31.29], [120, 53.64]]) {
      const lines = withChecks ? [] : null, r = LIB.liftOff(M, car, h, hz, v0, gAt(v0), lines); r.mph = mph; r.car = car.id; r.h = h; store.lift.push(r);
      keep(`lift-off ${short(car.id)} h=${h} ${mph} mph`, lines);
      if (!withChecks) continue;
      if (pf === 'arcade') check(g, `lift-off ${mph} mph: slip < 6°`, r.worst < 6 && !r.spun, `worst ${f(r.worst, 1)}° (R ${f(r.R, 0)} m)`);
      else if (pf === 'sport') check(g, `lift-off ${mph} mph: slip < 15°, after 4 s < 4°`, r.worst < 15 && r.tail < 4 && !r.spun, `worst ${f(r.worst, 1)}° after 4 s ${f(r.tail, 1)}° (R ${f(r.R, 0)} m)`);
      else check(g, `lift-off ${mph} mph: finite${mph === 40 ? ', < 25°' : ''}`, r.finite && (mph !== 40 || r.worst < 25), `worst ${f(r.worst, 1)}° after 4 s ${f(r.tail, 1)}° (R ${f(r.R, 0)} m)${r.spun ? ' SPUN' : ''}`);
    }
    const lines = withChecks ? [] : null, hd = LIB.heldDrift(M, road, car, h, hz, lines); hd.car = car.id; hd.h = h; store.held.push(hd);
    keep(`held drift ${short(car.id)} h=${h}`, lines);
    if (withChecks) {
      const hr = LIB.heldRule(M, road, car, h, hz); hd.rule = hr;
      check(g, 'held-drift rule: in a 20° slide with full counter-steer and 0.8 throttle the rear spins past the plain TC target and the TC does not cut (tcM ≥ 0.9 while it is over)', hr.kPeak > hr.kTc + 0.04 && hr.over > 0 && hr.minM >= 0.9, `kR peak ${f(hr.kPeak, 2)} while sliding, plain TC target ${f(hr.kTc, 3)}, lowest tcM over the target ${f(hr.minM, 2)} (${hr.over} steps)`);
      check(g, `held drift (scripted driver): finite, no spin, drift.time reaches ${pf === 'arcade' ? 0.5 : 0.9} s`, !hd.spun && hd.held >= (pf === 'arcade' ? 0.5 : 0.9), `drift.time ${f(hd.held)} s, mean angle ${f(hd.meanAngle, 0)}°, kR while holding ${f(hd.kMean, 2)}${hd.spun ? ' SPUN' : ''}`);
    }
    if (withChecks) log(`${short(car.id).padEnd(15)} h=${h} drift: ` + store.catch.slice(-3).map((r) => `${r.mph}mph ${r.entered ? `${f(r.tEntry)}/${f(r.peak, 0)}/${f(r.caught)}${r.spun ? 'S' : ''}` : 'no entry'}`).join(' ') + ` | power ${store.power.slice(-2).map((r) => `${f(r.peak, 0)}°/${f(r.caught)}`).join(' ')} | lift ${store.lift.slice(-3).map((r) => f(r.worst, 1)).join(' ')} | held kR ${f(hd.kMean, 2)} ${f(hd.held, 1)} s`);
  }
}
if (ONLY.includes('drift')) driftMatrix(CUR, HZ, drift, true);

// ------------------------------------------------------------------------------------------------------- stability
const stabRows = [];
function stabMatrix(M, hz, store, withChecks) {
  const S = LIB.makeStraight(M.Path, 30), W = LIB.makeArc(M.Path, 600, 1), WR = LIB.makeArc(M.Path, 600, -1);
  const gt = M.CARS[0], unl = LIB.TUNES.unleashed;
  for (const [car, straights, sweeps] of [[gt, [60, 75, 90], [45, 55]], [unl, [60, 90, 112, 150], [55, 80]]]) {
    if (CARS_ARG !== 'all' && !cars.includes(car) && !(car === gt && cars.some((c) => c.id === gt.id))) continue;
    for (const h of [0, 0.15, 0.35, 0.5, 0.9, 1]) {
      for (const v of straights) {
        const r = LIB.stab(M, S, car, h, hz, v, 'straight'); Object.assign(r, { car: car.id, h, v, kind: 'straight' }); store.push(r);
        if (withChecks) check(`stab ${short(car.id)} h=${h}`, `straight ${Math.round(v * MPH)} mph: worst < 3°, after 7 s < 0.5°, no spin`, r.worst < 3 && r.tail < 0.5 && !r.spun, `worst ${f(r.worst)}° at ${f(r.worstT, 1)} s, after 7 s ${f(r.tail)}°${r.spun ? ' SPUN' : ''}`);
      }
      for (const v of sweeps) for (const [path, side] of [[W, 'L'], [WR, 'R']]) {
        const r = LIB.stab(M, path, car, h, hz, v, 'sweeper'); Object.assign(r, { car: car.id, h, v, kind: `sweeper ${side}` }); store.push(r);
        if (withChecks) {
          // I2 is an arcade invariant (h <= 0.35): 3° there; sport 5°; in sim the speed hold floors the throttle after
          // the brake and the sim TC lets the tail step out (the Unleashed-like at 55 m/s: 11°), so sim asks for a
          // finite, damped slide under 15° and no spin
          const atLimit = v >= 80, lim = h <= 0.35 ? 3 : h <= 0.5 ? 5 : 15;
          const settled = atLimit ? r.tail <= r.worst + 0.1 : r.tail < Math.max(1, r.steady + 0.5, h > 0.5 ? r.worst / 2 : 0);
          check(`stab ${short(car.id)} h=${h}`, `sweeper ${side} ${Math.round(v * MPH)} mph: worst < ${lim}°, ${atLimit ? 'no new peak after 7 s' : 'after 7 s within 0.5° of the steady cornering slip (or < 1°' + (h > 0.5 ? ', or half the worst' : '') + ')'}, no spin`, r.worst < lim && !r.spun && settled, `worst ${f(r.worst)}° at ${f(r.worstT, 1)} s, after 7 s ${f(r.tail)}° (steady ${f(r.steady)}°), ${f(r.wide, 1)} m off the lane${r.spun ? ' SPUN' : ''}`);
        }
      }
    }
    if (withChecks) log(`stability ${short(car.id)}: worst ${f(Math.max(...store.filter((r) => r.car === car.id).map((r) => r.worst)))}°, spins ${store.filter((r) => r.car === car.id && r.spun).length}`);
  }
}
if (ONLY.includes('stab')) stabMatrix(CUR, HZ, stabRows, true);

// ------------------------------------------------------------------------------------------------------- contact
const contactRows = [];
if (ONLY.includes('contact')) {
  const CLS = { sedan: [4.88, 1.84, 1.44], semi: [6.3, 2.5, 4.1] };
  for (const cls of ['sedan', 'semi']) for (const U of [60, 120, 150]) {
    const row = { cls, U, cells: [] };
    const miss = CLS[cls][1] / 2 + 0.99 + 0.1;                 // just past the boxes' half widths: a miss by geometry (sedan 2.0 m, semi 2.3 m)
    for (const off of [0, 0.5, 1.0, 1.2, 1.6, miss]) {
      const r = LIB.contactCase(CUR.sweptContact, CLS[cls], U, off, HZ); row.cells.push({ off, ...r });
      if (off < 1.9) check(`contact ${cls} ${U} m/s`, `offset ${off} m: every phase a contact on the first overlapping step with speed·|n·forward| ≥ 0.9·closing`, r.hits === r.n && r.late === 0 && r.minAlong >= 0.9, `${r.hits}/${r.n} contacts, ${r.late} late, min along ${f(r.minAlong * 100, 0)}%`);
      else check(`contact ${cls} ${U} m/s`, `offset ${f(off, 1)} m: no contact`, r.hits === 0, `${r.hits}/${r.n} contacts`);
    }
    contactRows.push(row);
    log(`contact ${cls} ${U} m/s: ` + row.cells.map((c) => `${c.off}m ${c.hits}/${c.n} ${f(c.minAlong * 100, 0)}%`).join(' | '));
  }
}

// ------------------------------------------------------------------------------------------------------- dt
const dtRows = [];
if (ONLY.includes('dt') && HZ === 120) {
  const road = LIB.makeStraight(CUR.Path, 30);
  const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
  for (const car of cars) for (const h of PROFILES) {
    const a = perf.cur.find((r) => r.car === car.id && r.h === h), b = perfRow(CUR, road, car, h, 240); perf240.push(b);
    const g = `dt ${short(car.id)} h=${h}`;
    const d = { car: car.id, h, t60: rel(b.t60, a.t60), t100: rel(b.t100, a.t100), tq: rel(b.tq, a.tq), top: rel(b.top, a.top), b100: rel(b.b100, a.b100), g25: Math.abs(b.g25 - a.g25), g40: Math.abs(b.g40 - a.g40), g80: Math.abs(b.g80 - a.g80), caught: rel(b.caught = b.catch.caught, a.catch.caught), peak: Math.abs(b.catch.peak - a.catch.peak),
      hb: Math.abs(b.hb05.tEntry - a.hb05.tEntry), rev: Math.abs(b.rev.kMean - a.rev.kMean), go: rel(b.go.t60, a.go.t60) };
    dtRows.push(d);
    check(g, 'handbrake-with-pedal entry within 0.02 s, reverse ABS mean κF within 0.01, GO 0-60 within 2% at 240 Hz (2.5% at h ≥ 0.9, as the standing start: a TC-held launch resolved to a substep)', d.hb <= 0.02 && d.rev <= 0.01 && d.go <= (h >= 0.9 ? 0.025 : 0.02), `entry ${f(a.hb05.tEntry)} vs ${f(b.hb05.tEntry)} s, κF ${f(a.rev.kMean, 3)} vs ${f(b.rev.kMean, 3)}, GO ${f(a.go.t60)} vs ${f(b.go.t60)} s`);
    check(g, 'times and distances within 2% at 240 Hz (0-60 2.5% at h ≥ 0.9: a spinning launch)', d.t60 <= (h >= 0.9 ? 0.025 : 0.02) && d.t100 <= 0.02 && d.tq <= 0.02 && d.top <= 0.02 && d.b100 <= 0.02, `0-60 ${f(d.t60 * 100, 2)}% 0-100 ${f(d.t100 * 100, 2)}% 1/4 ${f(d.tq * 100, 2)}% top ${f(d.top * 100, 2)}% 100-0 ${f(d.b100 * 100, 2)}%`);
    check(g, 'lateral g within 0.02 g at 240 Hz', d.g25 <= 0.02 && d.g40 <= 0.02 && d.g80 <= 0.02, `${f(d.g25, 3)} ${f(d.g40, 3)} ${f(d.g80, 3)}`);
    // the lock-up and the re-grip are events resolved to a substep (4 vs 2 ms) and the release angle to a 120 Hz tick;
    // the catch time moves about 0.03 s per degree of release angle, so 5% (or 0.07 s) and 3° is what the metric resolves
    check(g, 'catch time within 5% (or 0.07 s), peak within 4° at 240 Hz', (d.caught <= 0.05 || Math.abs(b.caught - a.catch.caught) <= 0.07) && d.peak <= 4 && !b.catch.spun, `caught ${f(a.catch.caught)} vs ${f(b.catch.caught)} s (${f(d.caught * 100, 1)}%), peak ${f(a.catch.peak, 1)} vs ${f(b.catch.peak, 1)}°`);
    log(`${short(car.id).padEnd(15)} h=${h} 240 Hz: 0-60 ${f(d.t60 * 100, 2)}% 100-0 ${f(d.b100 * 100, 2)}% g ${f(d.g25, 3)}/${f(d.g40, 3)}/${f(d.g80, 3)} catch ${f(d.caught * 100, 1)}% peak Δ${f(d.peak, 1)}°`);
  }
  // the drift and stability matrices at 240 Hz against 120 Hz
  if (ONLY.includes('drift')) {
    const d240 = { catch: [], power: [], lift: [], held: [] }; driftMatrix(CUR, 240, d240, false);
    for (let i = 0; i < drift.catch.length; i++) {
      const a = drift.catch[i], b = d240.catch[i]; if (!a.entered || !b.entered || a.spun || b.spun) continue;
      check(`dt ${short(a.car)} h=${a.h}`, `catch ${a.mph} mph at 240 Hz: caught within 5% (or 0.07 s), peak within 4°`, (a.caught > 0 && b.caught > 0 && (rel(b.caught, a.caught) <= 0.05 || Math.abs(b.caught - a.caught) <= 0.07)) && Math.abs(a.peak - b.peak) <= 4, `caught ${f(a.caught)} vs ${f(b.caught)} s, peak ${f(a.peak, 1)} vs ${f(b.peak, 1)}°`);
    }
    for (let i = 0; i < drift.lift.length; i++) { const a = drift.lift[i], b = d240.lift[i]; check(`dt ${short(a.car)} h=${a.h}`, `lift-off ${a.mph} mph at 240 Hz: worst slip within 1°`, Math.abs(a.worst - b.worst) <= 1, `${f(a.worst)} vs ${f(b.worst)}°`); }
  }
  if (ONLY.includes('stab')) {
    const s240 = []; stabMatrix(CUR, 240, s240, false);
    for (let i = 0; i < stabRows.length; i++) { const a = stabRows[i], b = s240[i]; check(`dt ${short(a.car)} h=${a.h}`, `${a.kind} ${Math.round(a.v * MPH)} mph at 240 Hz: worst slip within 1°`, Math.abs(a.worst - b.worst) <= 1 && a.spun === b.spun, `${f(a.worst)} vs ${f(b.worst)}°`); }
  }
}

// ------------------------------------------------------------------------------------------------------- report
const fails = checks.filter((c) => !c.pass), passes = checks.length - fails.length;
const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root }).toString().trim() ? ' (with uncommitted changes)' : '';
const md = [];
md.push(`# Vehicle dynamics report`, '', `Tree \`${head}\`${dirty}, control \`${BASE}\`${PAR ? '' : ' (unavailable)'}, ${HZ} Hz, ${new Date().toISOString()}, ${((Date.now() - T0) / 1000).toFixed(1)} s. **${passes} checks passed, ${fails.length} failed.**`, '');
md.push('Method (PROJECT_OC_DYNAMICS.md §0): a straight 4-lane Path 30 km long, no walls, every figure one deterministic run. 0-60 / 0-100 / quarter mile / top speed from a full-throttle start (top: |dv| per step under 0.0002 m/s for 3 s). 100-0: full pedal from 44.7 m/s after a 0.2 s settle, to 0.5 m/s. Lateral g: a 16-point steering sweep refined around the best, 4 s with a speed hold, mean |ay| over the last 2 s with sideslip under 0.12 rad and speed within 8%. Catch: full left steer with the handbrake from 40 mph to 25° of body slip, then throttle 0.15 and a scripted counter-steer (front wheels along the front axle\'s travel, within steerLock); caught when |angle| < 5°. The ordering (Corsa fastest earnable; the Brio\'s lateral g within 5 %/10 % above it) is bound at every h, 1.0 included (the slider reaches it).', '');
if (fails.length) { md.push('## Failed checks', ''); for (const c of fails) md.push(`- **${c.group}** — ${c.name}: ${c.detail}`); md.push(''); }
if (advisories.length) { md.push('## Advisory (not counted): the two-tune rule on the plan\'s race-tune-like CarDef', '', 'The race tune is set on claude/hypercar (M3); PROJECT_OC_DYNAMICS.md §7.8 hands it these numbers. The Corsa is rev-limited in 7th and its top speed fell with the drive slip; the race-tune-like CarDef is drag-limited and did not.', ''); for (const a of advisories) md.push(`- ${a}`); md.push(''); }
if (perf.cur.length) {
  md.push('## Control table: parent → finished model', '', 'Parent = commit ' + BASE + ' measured live by this harness with the same method; → the current tree. Bounds applied to the four earnable cars (PROJECT_OC_DYNAMICS.md §7.7 as re-derived in its Deviations section): 0-60 +0.25 s (h ≤ 0.35) / +0.6 (0.5) / +0.9 (≥ 0.9); 0-100 +0.7 / +1.0 / +1.5 s; ¼ mile +0.45 / +0.7 / +1.1 s, trap −8 mph; top speed within ±1 mph of the parent\'s less the drive slip at that speed; 100-0 never more than +3 m (≤ 0.5) / +5 m; lateral g within g·(0.04 + 0.045·g²) of the parent\'s; catch entry 0.4–0.6 s, caught ≤ 1.0 / 1.5 / 2.0 s, no spin. The two tunes are reported, not bound (the hypercar plan re-measures them).', '');
  md.push('| Car | h | 0-60 s | 0-100 s | ¼ mile | Top mph | 100-0 m | Lat g @25 | @40 | @80 | Catch: entry s / peak ° / caught s |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of perf.cur) {
    const p = perf.par.find((q) => q.car === r.car && q.h === r.h);
    const pair = (a, b, d = 2) => (p ? `${f(a, d)} → ${f(b, d)}` : f(b, d));
    const cc = (c) => `${f(c.tEntry)} / ${f(c.peak, 0)} / ${c.spun ? 'SPUN' : f(c.caught)}`;
    md.push(`| ${short(r.car)} | ${r.h} | ${pair(p?.t60, r.t60)} | ${pair(p?.t100, r.t100)} | ${p ? `${f(p.tq)}@${f(p.vq, 0)} → ` : ''}${f(r.tq)}@${f(r.vq, 0)} | ${pair(p?.top, r.top, 0)} | ${pair(p?.b100, r.b100, 1)} | ${pair(p?.g25, r.g25)} | ${pair(p?.g40, r.g40)} | ${pair(p?.g80, r.g80)} | ${p ? cc(p.catch) + ' → ' : ''}${cc(r.catch)} |`);
  }
  md.push('', '## Brakes and traction control', '', 'ABS: the mean front slip ratio over the stop against the controller\'s target (−sAbs·μF/kx, computed from the same state); the lowest front pressure multiplier. ABS off: the stop with the front locked (κ < −0.9 at the time shown). TC: full throttle from 5 m/s in 1st for 2 s, the peak rear slip ratio against the target (sTc·μR/kx), and with TC off.', '');
  md.push('| Car | h | 100-0 ABS m | mean κF | target κF | min P | 100-0 no ABS m | Δ | lock at s | TC peak κR | kTc | TC off peak κR |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of perf.cur) md.push(`| ${short(r.car)} | ${r.h} | ${f(r.b100, 1)} | ${f(r.kMean, 3)} | ${f(r.kTarget, 3)} | ${f(r.pMin)} | ${f(r.b100noAbs, 1)} | ${f((r.b100noAbs / r.b100 - 1) * 100, 1)}% | ${f(r.tLock, 3)} | ${f(r.tcOn?.kPeak, 3)} | ${f(r.tcOn?.kTc, 3)} | ${f(r.tcOff?.kPeak, 2)} |`);
  md.push('');
  if (perf.cur.some((r) => r.hb05)) {
    md.push('## The launch from the line, the handbrake with the pedal, braking in reverse', '', 'GO: 1 s of the countdown hold (brake, handbrake, `hold`, the throttle pinned) then full throttle; how far the car crept in the hold and 0-60 from GO against the standing start (the control table\'s). Handbrake + pedal: from 40 mph, full left steer with the handbrake and the foot brake at 0.5 (and 1.0): the time to 25° of body slip and the lowest rear slip ratio (−1.00 is locked). Reverse: 10 m/s backwards, the full pedal: the mean front slip ratio against the ABS target (positive in reverse), the lowest front pressure, the stop, and with ABS off the time to a locked front.', '');
    md.push('| Car | h | GO 0-60 s (standing) | crept m/s / m | hb + pedal 0.5: 25° at s / κR min | hb + pedal 1.0 | reverse: mean κF / target / min P / m | reverse, no ABS: lock at s / m |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of perf.cur) if (r.hb05) md.push(`| ${short(r.car)} | ${r.h} | ${f(r.go.t60)} (${f(r.t60)}) | ${f(r.go.crept, 3)} / ${f(r.go.moved, 3)} | ${f(r.hb05.tEntry)} / ${f(r.hb05.kMin)} | ${f(r.hb10.tEntry)} / ${f(r.hb10.kMin)} | ${f(r.rev.kMean, 3)} / ${f(r.rev.kTarget, 3)} / ${f(r.rev.pMin)} / ${f(r.rev.dist, 1)} | ${f(r.revNoAbs.tLock, 3)} / ${f(r.revNoAbs.dist, 1)} |`);
    md.push('');
  }
  if (vectorRows.length) {
    md.push('## Torque vectoring (§4.5): the Unleashed-like with `vector` 1 against 0', '', 'A steady turn, steer 0.3 with a speed hold; the mean yaw rate and lateral acceleration over the last 2 s of 4. The vectoring targets the neutral yaw rate for the wheel angle, so it adds rotation in every steady corner.', '', '| h | 25 m/s: yaw °/s 0 → 1 | lat g 0 → 1 | 40 m/s: yaw °/s 0 → 1 | lat g 0 → 1 |', '| --- | --- | --- | --- | --- |');
    for (const v of vectorRows) md.push(`| ${v.h} | ${f(v[25].off.r)} → ${f(v[25].on.r)} | ${f(v[25].off.g)} → ${f(v[25].on.g)} | ${f(v[40].off.r)} → ${f(v[40].on.r)} | ${f(v[40].off.g)} → ${f(v[40].on.g)} |`);
    md.push('');
  }
}
if (drift.catch.length) {
  md.push('## Drift scenarios', '', '### Handbrake entry and catch (entry target 25°; 12° at 120 mph)', '', '| Car | h | 40 mph: entry / peak / caught | 70 mph | 120 mph |', '| --- | --- | --- | --- | --- |');
  const cc = (r) => (!r ? '-' : !r.entered ? `no entry (${f(r.angleEntry, 0)}°)` : `${f(r.tEntry)} / ${f(r.peak, 0)}° / ${r.spun ? 'SPUN' : f(r.caught) + ' s'}`);
  for (const car of cars) for (const h of PROFILES) { const at = (m) => drift.catch.find((r) => r.car === car.id && r.h === h && r.mph === m); md.push(`| ${short(car.id)} | ${h} | ${cc(at(40))} | ${cc(at(70))} | ${cc(at(120))} |`); }
  md.push('', '### Power-over (2nd/3rd gear, steer 0.5, full throttle 1.5 s, then the catch with throttle 0.3)', '', '| Car | h | 40 mph: peak slip / >12° at / >20° at / caught / kR peak | 70 mph |', '| --- | --- | --- | --- |');
  const pc = (r) => (!r ? '-' : `${f(r.peak, 0)}° / ${f(r.t12)} / ${f(r.t20)} / ${r.spun ? 'SPUN' : f(r.caught)} / ${f(r.kPeak, 2)}${r.finite ? '' : ' NaN'}`);
  for (const car of cars) for (const h of PROFILES) { const at = (m) => drift.power.find((r) => r.car === car.id && r.h === h && r.mph === m); md.push(`| ${short(car.id)} | ${h} | ${pc(at(40))} | ${pc(at(70))} |`); }
  md.push('', '### Lift-off in a sweeper needing 0.9 × the measured lateral g (radius shown)', '', '| Car | h | 40 mph: R / worst / after 4 s | 70 mph | 120 mph |', '| --- | --- | --- | --- | --- |');
  const lc = (r) => (!r ? '-' : `${f(r.R, 0)} m / ${f(r.worst, 1)}° / ${f(r.tail, 1)}°${r.spun ? ' SPUN' : ''}`);
  for (const car of cars) for (const h of PROFILES) { const at = (m) => drift.lift.find((r) => r.car === car.id && r.h === h && r.mph === m); md.push(`| ${short(car.id)} | ${h} | ${lc(at(40))} | ${lc(at(70))} | ${lc(at(120))} |`); }
  md.push('', '### Held drift (40 mph entry, counter-steer and 0.8 throttle for 3 s), and the §3.7 rule on its own', '', 'The scripted driver: the hands come round past 8°, the handbrake is let go as the angle plus 0.05 s of yaw reaches 25°, then counter-steer trimmed toward 25° with the throttle eased from 0.8 as the angle runs past it. κR while holding = the rear slip ratio over the steps with the throttle at least half open and the wheel turned against the slide. The rule column: a 20° slide imposed at 15 m/s, full counter-steer, 0.8 throttle, 0.5 s: the peak rear slip against the profile\'s plain TC target.', '', '| Car | h | κR while holding | mean angle ° | drift.time s | rule: κR peak while sliding |', '| --- | --- | --- | --- | --- | --- |');
  for (const r of drift.held) md.push(`| ${short(r.car)} | ${r.h} | ${f(r.kMean)} | ${f(r.meanAngle, 0)} | ${f(r.held)}${r.spun ? ' SPUN' : ''} | ${r.rule ? `${f(r.rule.kPeak)} (plain target ${f(r.rule.kTc, 3)}, lowest tcM ${f(r.rule.minM)})` : '-'} |`);
  md.push('');
}
if (stabRows.length) {
  md.push('## Stability runs', '', 'The lane follower with the autopilot\'s gains: straight with a lane change at 1 s and a 0.12 rad/s yaw shove at 4 s; the R600 sweeper with a lift (2–3.5 s) and a 0.8 brake (4.5–5.5 s). Worst body slip, worst after 7 s, how far off the lane.', '', '| Car | h | run | worst ° (at s) | after 7 s ° | off lane m | end m/s |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of stabRows) md.push(`| ${short(r.car)} | ${r.h} | ${r.kind} ${Math.round(r.v * MPH)} mph | ${f(r.worst)} (${f(r.worstT, 1)}) | ${f(r.tail)} | ${f(r.wide, 1)} | ${f(r.vEnd, 1)}${r.spun ? ' SPUN' : ''} |`);
  md.push('');
}
if (contactRows.length) {
  md.push('## Rear-end contact (swept)', '', 'A stopped car, the player closing at U with a lateral offset, 25 approach phases at 120 Hz with the push-out applied. Cell: contacts / phases, and the lowest contact speed along the player\'s nose as a share of the closing speed. 2.0 m must be a miss.', '', '| Class, closing | 0 m | 0.5 m | 1.0 m | 1.2 m | 1.6 m | miss (sedan 2.0 m, semi 2.3 m) |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of contactRows) md.push(`| ${r.cls} ${r.U} m/s | ` + r.cells.map((c) => `${c.hits}/${c.n}${c.hits ? ` ${f(c.minAlong * 100, 0)}%` : ''}${c.late ? ` ${c.late} late` : ''}`).join(' | ') + ' |');
  md.push('');
}
if (dtRows.length) {
  md.push('## dt-independence: 240 Hz against 120 Hz', '', '| Car | h | 0-60 | 0-100 | ¼ mile | top | 100-0 | g25 | g40 | g80 | caught | peak Δ° | hb entry Δs | rev κF Δ | GO 0-60 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const d of dtRows) md.push(`| ${short(d.car)} | ${d.h} | ${f(d.t60 * 100)}% | ${f(d.t100 * 100)}% | ${f(d.tq * 100)}% | ${f(d.top * 100)}% | ${f(d.b100 * 100)}% | ${f(d.g25, 3)} | ${f(d.g40, 3)} | ${f(d.g80, 3)} | ${f(d.caught * 100, 1)}% | ${f(d.peak, 1)} | ${f(d.hb, 3)} | ${f(d.rev, 3)} | ${f(d.go * 100)}% |`);
  md.push('');
}
md.push('## All checks', '', `${passes} passed, ${fails.length} failed.`, '');
const groups = new Map(); for (const c of checks) { const g = groups.get(c.group) ?? { pass: 0, fail: 0 }; c.pass ? g.pass++ : g.fail++; groups.set(c.group, g); }
md.push('| Group | passed | failed |', '| --- | --- | --- |'); for (const [g, v] of groups) md.push(`| ${g} | ${v.pass} | ${v.fail} |`);
writeFileSync(join(out, 'dynamics-report.md'), md.join('\n') + '\n');
writeFileSync(join(out, 'dynamics-traces.txt'), traces.join('\n\n') + '\n');
writeFileSync(arg('json', join(out, 'dynamics.json')), JSON.stringify({ perf, perf240, drift, stab: stabRows, contact: contactRows, dt: dtRows, checks }, null, 1));
log(`\n${passes} passed, ${fails.length} failed in ${((Date.now() - T0) / 1000).toFixed(1)} s → ${join(out, 'dynamics-report.md')}`);
process.exit(fails.length ? 1 : 0);
