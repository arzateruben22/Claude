// Finds S5's drift before anything is rendered (the owner, 2026-11-25: the first one slid into the barrier).
//   node tools/trailer/drift-search.mjs --build=<dir> [--n=80] [--seed=105]
// One page, simulation only: for each candidate it reseeds, restarts the run, drives the shot's warm-up with the
// autopilot in the candidate's lane, then plays the shot's 87 frames at 4 game steps a frame (as the capture does),
// with the drift controller (drift.mjs) on top of the autopilot. It logs, per frame, the body slip angle, the
// distance from the car to the walls and to the nearest traffic, the speed and any collision, and scores:
//   rejected: any collision or wall impact, the car's middle within 2.2 m of a wall or off the paving, nearest
//             traffic under 4 m, under 15 m/s at the end, still sliding (> 6 deg) at the end
//   score:    peak slip angle (capped at 45) + 12 x seconds counted as a drift + the closest wall margin (capped)
// Prints the best candidates as JSON; the winner goes into shots.mjs.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHOTS, BAR } from './shots.mjs';
import { DRIFT_SRC } from './drift.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const GAME = path.join(path.resolve(opt('build', 'dist')), 'top-speed-ultra.html');
const S = SHOTS.find((s) => s.id === 's5-drift'), N = Math.round(S.bars * BAR * 30), COUNT = Number(opt('n', '80'));
let r = 12345; const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
// --fix='{"seed":205,...}' pins fields (a focused second pass round a clear stretch); --wide widens the drift ranges
const FIX = JSON.parse(opt('fix', '{}')), WIDE = process.argv.includes('--wide');
const cands = [];
for (let i = 0; i < COUNT; i++) cands.push({
  seed: pick([105, 205, 305, 405, 505, 605, 705, 805]), warm: pick([8, 12, 16, 20, 24]), dir: pick([1, -1]), lane: pick(['near', 'mid', 'far']), cruise: pick([27, 30, 33, 36]), at: pick([0.25, 0.4, 0.55]),
  steer: pick([0.45, 0.6, 0.8, 1]), flick: pick([0.15, 0.25, 0.35, 0.45]), thrFlick: pick([0, 0.4, 0.8]),
  hold: pick([0.9, 1.2, 1.5, 1.8]), angle: pick([18, 25, 32, 40]), counter: pick([0.1, 0.25, 0.4, 0.6]), k: pick([0, 0.8, 1.6]), thr: pick([0.5, 0.75, 1]),
  ...(WIDE ? { steer: pick([0.7, 0.85, 1]), flick: pick([0.3, 0.45, 0.6, 0.75]), thrFlick: pick([0.4, 0.7, 1]), hold: pick([1.2, 1.5, 1.8, 2.1]),
    angle: pick([25, 30, 35, 40]), counter: pick([0, 0.1, 0.2, 0.3]), k: pick([1.5, 2.5, 4, 6]), thr: pick([0.7, 0.85, 1]), cruise: pick([27, 30, 33]) } : {}),
  ...FIX,
});

const browser = await chromium.launch({ executablePath: process.env.TRAILER_CHROME || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
await ctx.addInitScript(({ s }) => {
  localStorage.setItem('tsu.settings', JSON.stringify({ quality: s.quality, qualityChosen: true, adaptive: false, density: s.density, owner: true, look: 'ultra', theme: 'dark', time: s.time, weather: s.weather, start: s.start, exit: '', style: 'standard', master: 0, music: 0 }));
  localStorage.setItem('tsu.ownerCar', s.car);
  let a = 1; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__reseed = (n) => { a = n >>> 0; };
}, { s: S });
const page = await ctx.newPage();
page.setDefaultTimeout(240000);
await page.goto(pathToFileURL(GAME).href);
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 240000 });
await page.getByRole('radio', { name: /Free Drive/ }).click();
await page.getByRole('button', { name: 'Start run', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 240000 });

const results = [];
const t0 = Date.now();
for (const [i, P] of cands.entries()) {
  const res = await page.evaluate(async ({ s, P, N, src, seed }) => {
    const g = window.__game, drift = eval(src);
    g.setPaused(true);
    window.__reseed(seed);
    await g.start(g.mode);
    for (let w = 0; w < 400 && (g.inAttract || document.querySelector('.loadbar')); w++) await new Promise((r) => setTimeout(r, 50));
    g.setPaused(true);
    window.__reseed(seed);
    const lanes = () => g.path.lanes;
    const want = () => (P.lane === 'mid' ? Math.floor(lanes() / 2) : (P.dir > 0) === (P.lane === 'near') ? 0 : lanes() - 1);
    // the warm-up, holding the candidate's lane (the autopilot's own lane choice, pinned)
    const step = 4 / 120 - 1e-6;
    for (let k = 0; k < P.warm * 30; k++) { g.apLane = want(); g.fastForward(step, {}, P.cruise); }
    // the capture's 6 settle frames: the frame loop's own order, the controls once a frame (autopilot or drift), then
    // the frame's four 1/120 s steps (fastForward with no cruise only steps; it doesn't steer)
    const frame = (t, rec) => {
      const c = g.input.c;
      g.apLane = want();
      const mine = rec && drift(t, g, c, P);
      if (!mine) { c.handbrake = false; g.autopilot(c, P.cruise); }
      g.fastForward(step, { steer: c.steer, throttle: c.throttle, brake: c.brake, handbrake: c.handbrake });
    };
    for (let k = 0; k < 6; k++) frame(0, false);
    const c0 = g.collisions, log = [];
    let bad = '';
    for (let f = 0; f < N; f++) {
      frame(f / 30, true);
      const p = g.phys, q = g.path;
      const wall = Math.min(p.d - q.wallL, q.wallR - p.d), pave = Math.min(p.d - q.paveL, q.paveR - p.d);
      let near = 1e9; for (const tc of g.traffic.cars) { const dx = tc.x - p.x, dz = tc.z - p.z; near = Math.min(near, Math.hypot(dx, dz)); }
      log.push({ a: +p.drift.angle.toFixed(1), on: p.drift.active, wall: +wall.toFixed(2), pave: +pave.toFixed(2), near: +near.toFixed(1), v: +p.vx.toFixed(1) });
      if (g.collisions > c0) bad ||= `collision f${f}`;
      if (wall < 2.2) bad ||= `wall ${wall.toFixed(2)} f${f}`;
      if (pave < 0.6) bad ||= `off paving f${f}`;
      if (near < 4) bad ||= `traffic ${near.toFixed(1)} m f${f}`;
    }
    const end = log[log.length - 1];
    if (end.v < 15) bad ||= `slow ${end.v}`;
    if (Math.abs(end.a) > 6) bad ||= `still sliding ${end.a}`;
    const peak = Math.max(...log.map((l) => Math.abs(l.a))), driftT = log.filter((l) => l.on).length / 30, minWall = Math.min(...log.map((l) => l.wall));
    return { bad, peak, driftT, minWall, endV: end.v, road: g.path.label, lanes: lanes(), score: Math.min(peak, 45) + 20 * driftT + Math.min(minWall, 4), log };
  }, { s: S, P, N, src: DRIFT_SRC, seed: P.seed });
  results.push({ i, P, ...res });
  if (i % 10 === 9) console.error(`${i + 1}/${cands.length}, ${((Date.now() - t0) / (i + 1) / 1000).toFixed(1)} s each, ok so far ${results.filter((x) => !x.bad).length}`);
}
await browser.close();
const ok = results.filter((x) => !x.bad).sort((a, b) => b.score - a.score);
const why = {}; for (const x of results.filter((x) => x.bad)) { const k = x.bad.split(' ')[0]; why[k] = (why[k] ?? 0) + 1; }
console.error(results.map((x) => `${x.i} ${x.bad || "ok"} peak ${x.peak.toFixed(0)} lane ${x.P.lane} dir ${x.P.dir} lanes ${x.lanes} ${x.road}`).join("\n"));
console.log(JSON.stringify({ tried: results.length, ok: ok.length, rejected: why, best: ok.slice(0, 5).map(({ log, ...x }) => ({ ...x, trace: log.filter((_, k) => k % 6 === 0).map((l) => `${l.a}/${l.wall}/${l.v}`) })) }, null, 1));
