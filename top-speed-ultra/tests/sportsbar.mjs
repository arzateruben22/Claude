// Phase S1 checks for the sports bar's page (PROJECT_OC_SPORTS_BAR.md, "### S1:"). Drives dist/sportsbar/sportsbar.html
// (build it with `npx vite build --config src/onfoot/vite.sportsbar.config.ts`) in headless Chromium with SwiftShader
// through the window.__onfoot hooks, and prints PASS or FAIL with the numbers each check saw. Screenshots go in
// tests/out/sportsbar/; results are merged into tests/out/sportsbar/sportsbar-checks.json after every check.
//
//   node tests/sportsbar.mjs                          every group
//   node tests/sportsbar.mjs --only=data,walks         some groups: data, walks, seats, closed, honesty, cross,
//                                                      budgets, rates, shadows, cars, memory, shots, lot57
//   node tests/sportsbar.mjs --walks=1000             how many random walks (default 1000)
//   node tests/sportsbar.mjs --tag=r2                 a suffix for every screenshot's name (s1-...-r2.png), so a
//                                                      repair's shots sit beside the round they replace
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
const WALKS = Number((process.argv.find((a) => a.startsWith('--walks=')) ?? '--walks=1000').slice(8));
const PRESETS = (process.argv.find((a) => a.startsWith('--presets=')) ?? '--presets=low,high,ultra').slice(10).split(',');
const TAG = (process.argv.find((a) => a.startsWith('--tag=')) ?? '--tag=').slice(6);
/** a screenshot's file name with the run's tag: s1-door-noon.png, or s1-door-noon-r2.png with --tag=r2 */
const png = (base) => (TAG ? `${base}-${TAG}.png` : `${base}.png`);
const want = (g) => !only.length || only.includes(g);
if (!existsSync(PAGE)) { console.error(`No build at ${PAGE}. Run \`npx vite build --config src/onfoot/vite.sportsbar.config.ts\` first.`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const results = [], summary = {};
const CHECKS = path.join(OUT, 'sportsbar-checks.json');
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
async function open(size, query, touch = false, init = null) {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(touch ? { viewport: { width: size[0], height: size[1] }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);
  if (init) await page.addInitScript(init);
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
const closeAll = async () => { await browser?.close().catch(() => {}); browser = null; };
const frames = async (page, n = 2) => { const f0 = await page.evaluate(() => window.__onfoot.frames); await page.waitForFunction((k) => window.__onfoot.frames >= k, f0 + n, { timeout: T, polling: 200 }); };
async function shot(page, name) { await frames(page, 1); await page.screenshot({ path: path.join(OUT, name), timeout: 900000 }); return name; }
const H = (page, js) => page.evaluate(js);
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));

// ------------------------------------------------------------------------------------------------ geometry helpers
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const inPolyP = (x, z, P) => { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segsCross = (a, b, c, d) => cross2(a, b, c) * cross2(a, b, d) < 0 && cross2(c, d, a) * cross2(c, d, b) < 0;
/** the distance between two polygons (0 when they overlap) */
function polyDist(P, Q) {
  for (const p of P) if (inPolyP(p[0], p[1], Q)) return 0;
  for (const q of Q) if (inPolyP(q[0], q[1], P)) return 0;
  let d = Infinity;
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) {
    const a = P[i], b = P[(i + 1) % P.length], c = Q[j], e = Q[(j + 1) % Q.length];
    if (segsCross(a, b, c, e)) return 0;
    d = Math.min(d, segDist(a[0], a[1], c[0], c[1], e[0], e[1]), segDist(b[0], b[1], c[0], c[1], e[0], e[1]), segDist(c[0], c[1], a[0], a[1], b[0], b[1]), segDist(e[0], e[1], a[0], a[1], b[0], b[1]));
  }
  return d;
}
const fd = (d, s) => [d * -0.932 + s * 0.362, d * 0.362 + s * 0.932];
const rectFD = (d0, d1, s0, s1) => [fd(d0, s0), fd(d1, s0), fd(d1, s1), fd(d0, s1)];
const boxR = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
/** the overlap area of two axis-aligned boxes */
const boxOverlap = (a, b) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[2], b[2]));
/** a circle and a box overlap by more than a sliver */
const circBox = (u, v, r, b) => { const qx = Math.max(b[0], Math.min(b[1], u)), qz = Math.max(b[2], Math.min(b[3], v)); return Math.hypot(u - qx, v - qz) < r - 0.01; };
/** a circle inside a convex polygon (with tolerance) */
const circIn = (u, v, r, P) => inPolyP(u, v, P) && P.every((p, i) => segDist(u, v, p[0], p[1], P[(i + 1) % P.length][0], P[(i + 1) % P.length][1]) >= r - 1e-3);

// ------------------------------------------------------------------------------------------------ data: frame, sets, front, zones, walking
if (want('data')) {
  console.log('data: 1280x720, HD, Saturday 12:00');
  const { ctx, page, errors, bootS } = await open([1280, 720], 'quality=high&day=Sat&hour=12&hint=0');
  await check('data: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); return `boot ${bootS} s`; });
  await check('data: the frame matches the building-frame table to 0.1 m, and the bar\'s point lands inside our unit', async () => {
    const f = await H(page, 'window.__onfoot.frame()'); summary.frame = f;
    expect(f.check.worst <= 0.1, `worst ${f.check.worst} m: ${JSON.stringify(f.check.points)}`);
    expect(f.check.pointInUnit, 'the point is outside the unit');
    return `O (${f.O.map((v) => v.toFixed(2))}), A (${f.A.map((v) => v.toFixed(4))}), B (${f.B.map((v) => v.toFixed(4))}); worst ${f.check.worst} m over ${f.check.points.length} points; the point in the unit`;
  });
  const S = await H(page, 'window.__onfoot.streetSets()');
  execFileSync('python3', [path.join(ROOT, 'tools/anaheim/sportsbar_sets.py'), '--json', path.join(OUT, 'sets.json')], { stdio: 'ignore' });
  const want_ = JSON.parse(readFileSync(path.join(OUT, 'sets.json'), 'utf8'));
  summary.sets = { counts: S.counts, nearMeshes: S.nearMeshes, farMeshes: S.farMeshes, streams: S.streams };
  await check('data: the built near set holds exactly the features sportsbar_sets.py lists as near, and the far set the rest', async () => {
    const diffs = [];
    for (const [layer, w] of Object.entries(want_.sets)) {
      const got = new Set(S.nearIds[layer]), exp = new Set(w.near);
      const extra = [...got].filter((i) => !exp.has(i)), missing = [...exp].filter((i) => !got.has(i));
      if (extra.length || missing.length) diffs.push(`${layer}: built near but not listed ${JSON.stringify(extra)}, listed but not built ${JSON.stringify(missing)}`);
      const fg = new Set(S.farIds[layer]); if (fg.size !== w.far.length || w.far.some((i) => !fg.has(i))) diffs.push(`${layer}: the far set differs`);
    }
    expect(!diffs.length, diffs.join(' | '));
    for (const id of [560, 362, 222, 358, 438, 136, 137, 141]) expect(S.nearIds.streets.includes(id), `seg ${id} not near`);
    for (const id of [24, 26, 411]) expect(S.nearIds.buildings.includes(id), `bld ${id} not near`);
    const fc = S.counts.far; expect(fc.streets === 554 && fc.buildings === 417 && fc['infrastructure shapes'] === 172 && fc['land use'] === 67 && fc.water === 18, `far counts ${JSON.stringify(fc)}`);
    return Object.entries(S.counts.near).map(([k, v]) => `${k} ${v}/${S.counts.far[k]}`).join(', ') + ' (near/far)';
  });
  await check('data: the near batches come to at most 14 calls at HD, the far set\'s simple batches to 4', async () => {
    expect(S.nearMeshes.length + 2 <= 14, `near: ${S.nearMeshes.length} batches + 2 stream meshes: ${S.nearMeshes.join(', ')}`);
    expect(S.farMode === 'simple' && S.farMeshes.length <= 4, `far (${S.farMode}): ${S.farMeshes.join(', ')}`);
    return `near ${S.nearMeshes.length} batches (${S.nearMeshes.join(', ')}) + 2 stream meshes; far simple ${S.farMeshes.length} (${S.farMeshes.join(', ')})`;
  });
  await check('data: the light streams run only on the five near carriageway pieces, at their drawn height', async () => {
    const st = S.streams;
    expect(st.paths.length === 2, `paths ${st.paths.length}`);
    const B = await H(page, 'window.__onfoot.bridges()');
    const hmax = Math.max(...[560, 362, 222, 358, 438].map((id) => B.heights[id].hMax));
    expect(st.paths.every((p) => p.yMax <= 7.6 + 0.6 + 0.01 && p.yMin >= 0.59), JSON.stringify(st.paths));
    return `northbound 560 into 362 (${st.paths[0].length} m) and southbound 222 into 358 into 438 (${st.paths[1].length} m); lamps ${st.paths.map((p) => `${p.yMin} to ${p.yMax} m`).join(' and ')} up (the decks' 7.6 m + 0.6 m; carriageways reach ${hmax} m)`;
  });
  const B = await H(page, 'window.__onfoot.bridges()'); summary.bridges = B;
  await check('data: the I-5 is drawn: five near carriageway pieces 14 m and seven near links 8 m, nonzero area', async () => {
    const drawn = new Map(S.drawn.map((d) => [d.id, d]));
    const bad = [];
    for (const id of [560, 362, 222, 358, 438]) { const d = drawn.get(id); if (!d || d.w !== 14 || d.area <= 0) bad.push(`${id}: ${JSON.stringify(d)}`); }
    for (const id of [360, 361, 365, 424, 425, 561, 562]) { const d = drawn.get(id); if (!d || d.w !== 8 || d.area <= 0) bad.push(`${id}: ${JSON.stringify(d)}`); }
    expect(!bad.length, bad.join(' | '));
    return [560, 362, 222, 358, 438, 360, 361, 365, 424, 425, 561, 562].map((id) => `${id} ${drawn.get(id).w} m x ${Math.round(drawn.get(id).area / drawn.get(id).w)} m`).join(', ');
  });
  await check('data: the bridge rule: decks at 7.6 m, piers every 28 m except over drawn ribbons (none meets one), one height per connector, crossings clear', async () => {
    expect(B.leftOut === want_.piers.leftOut && B.leftOutNear === want_.piers.leftOutNear, `left out ${B.leftOut} (${B.leftOutNear} near); the script: ${want_.piers.leftOut} (${want_.piers.leftOutNear})`);
    expect(B.piers + B.leftOut === want_.piers.placed, `placed ${B.piers} + ${B.leftOut} vs ${want_.piers.placed}`);
    expect(B.meets === 0, `${B.meets} built piers meet a drawn ribbon beneath`);
    expect(B.connectors.worst < 0.01, `a connector has ${B.connectors.worst} m between its pieces`);
    for (const id of [222, 358, 438, 560]) if (B.heights[id].br.length) expect(Math.abs(B.heights[id].onSpan - 7.6) < 1e-6, `${id} on its span at ${B.heights[id].onSpan}`);
    const X = await H(page, 'window.__onfoot.crossings()'); summary.crossings = X;
    expect(!X.tight.length && X.tunnels === want_.tunnelled, `tight ${JSON.stringify(X.tight)}, tunnels ${X.tunnels} vs ${want_.tunnelled}`);
    return `${B.piers} piers built (${B.piersNear} near), ${B.leftOut} left out (${B.leftOutNear} near) over ${B.under.join(', ')}; ${B.connectors.connectors} connectors, worst spread ${B.connectors.worst} m; ${X.crossings} crossings without a junction all clear 5.5 m or are in tunnels (${X.tunnels})`;
  });
  await check('data: the 10 street trees at the script\'s spots, each in the near set, at most 4 calls', async () => {
    const t = await H(page, 'window.__onfoot.trees()'), v = await H(page, 'window.__onfoot.vis()');
    expect(t.length === 10 && t.filter((x) => x.kind === 'palm').length === 6, JSON.stringify(t));
    const worst = Math.max(...want_.trees.map((w, i) => Math.hypot(w.frame[0] - t[i].frame[0], w.frame[1] - t[i].frame[1])));
    expect(worst < 0.06, `trees off the script's spots by ${worst} m`);
    expect(v.trees.length <= 4 && v.trees.filter((m) => /trunks/.test(m.name)).reduce((a, m) => a + m.instances, 0) === 10, JSON.stringify(v.trees));
    return `6 palms and 4 shade trees within ${worst.toFixed(3)} m of the script's spots, in ${v.trees.length} instanced meshes (${v.trees.map((m) => `${m.name} ${m.instances}`).join(', ')})`;
  });
  const lay = await H(page, 'window.__onfoot.layout()'); summary.layout = { fillBias: lay.fillBias, stalls: lay.stalls.length };
  await check('data: the front fits: walk, ramp and flares, bikes, planters, patio and fence each 0.4 m or more from aisle 416\'s ribbon; the ribbon 3.5 m or more from building 61', async () => {
    const rib = lay.aisle416.ribbon, d = {};
    d.walk = polyDist(rectFD(0, 3.3, -0.5, 18.2), rib);
    d.ramp = polyDist(rectFD(1.5, 3.3, 7.55, 10.35), rib);
    d.bikes = polyDist(rectFD(1.9, 2.9, 12.5, 15.5), rib);
    d.planter1 = polyDist(rectFD(2.1, 2.7, 2.5, 3.7), rib); d.planter2 = polyDist(rectFD(2.1, 2.7, 16.4, 17.6), rib);
    d.patio = polyDist(boxR(1.95, 24.05, -5.55, 0.3), rib);
    d.building = polyDist(lay.building.host, rib);
    const bad = Object.entries(d).filter(([k, v]) => (k === 'building' ? v < 3.5 : v < 0.4));
    expect(!bad.length, JSON.stringify(d));
    return Object.entries(d).map(([k, v]) => `${k} ${v.toFixed(2)} m`).join(', ');
  });
  await check('data: every interior zone and slot lies inside the walls\' inner faces, every patio zone and seat inside the patio fence', async () => {
    const inner = lay.building.unitInner, bad = [];
    const wallV = (u) => { const a = lay.building.unitOuter[0], b = lay.building.unitOuter[1]; return a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]); };
    for (const z of lay.zones) if (![[z.u0, z.v0], [z.u1, z.v0], [z.u1, z.v1], [z.u0, z.v1]].every(([u, v]) => inPolyP(u, v, inner) || inner.some((p, i) => segDist(u, v, p[0], p[1], inner[(i + 1) % 4][0], inner[(i + 1) % 4][1]) < 1e-3))) bad.push(`zone ${z.id}`);
    for (const z of lay.patio.zones) if (z.u0 < 2.05 - 1e-6 || z.u1 > 23.95 + 1e-6 || z.v0 < -5.45 - 1e-6 || z.v1 > wallV(z.u0) + 1e-6 || z.v1 > wallV(z.u1) + 1e-6) bad.push(`patio zone ${z.id}`);
    const pz = new Set(lay.patio.zones.map((z) => z.id));
    for (const s of lay.slots) {
      const patio = s.at[1] < 0.2 && (pz.has(s.zone) || s.zone === '');
      if (patio) { if (s.at[0] - s.r < 2.05 - 1e-3 || s.at[0] + s.r > 23.95 + 1e-3 || s.at[1] - s.r < -5.45 - 1e-3 || s.at[1] + s.r > wallV(s.at[0]) + 1e-3) bad.push(`patio slot ${s.id}`); }
      else if (!circIn(s.at[0], s.at[1], s.r, inner)) bad.push(`slot ${s.id}`);
    }
    expect(!bad.length, bad.join(', '));
    return `${lay.zones.length} zones and ${lay.slots.filter((s) => s.at[1] >= 0.2).length} slots inside, ${lay.patio.zones.length} patio zones and ${lay.slots.filter((s) => s.at[1] < 0.2).length} patio slots inside the fence`;
  });
  await check('data: nothing overlaps: zones, slots (radii 0.45 and 0.3 m) and the object colliders, each in its own zone only', async () => {
    const bad = [], zones = [...lay.zones, ...lay.patio.zones];
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) { const a = zones[i], b = zones[j]; if (boxOverlap([a.u0, a.u1, a.v0, a.v1], [b.u0, b.u1, b.v0, b.v1]) > 1e-4) bad.push(`zones ${a.id} and ${b.id}`); }
    const S2 = lay.slots;
    for (let i = 0; i < S2.length; i++) for (let j = i + 1; j < S2.length; j++) {
      const a = S2[i], b = S2[j]; if (a.group && a.group === b.group) continue;
      const d = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]); if (d < a.r + b.r - 1e-3) bad.push(`slots ${a.id} and ${b.id} (${d.toFixed(3)} m)`);
    }
    for (const s of S2) for (const z of zones) if (z.id !== s.zone && circBox(s.at[0], s.at[1], s.r, [z.u0, z.u1, z.v0, z.v1])) bad.push(`slot ${s.id} in ${z.id}`);
    for (const c of lay.furniture) for (const z of zones) {
      if (z.id === c.zone) continue;
      const zb = [z.u0, z.u1, z.v0, z.v1];
      const hit = c.k === 'box' ? boxOverlap(c.b, zb) > 1e-4 : c.k === 'circ' ? circBox(c.c[0], c.c[1], c.c[2], zb) : polyDist(c.p, boxR(...zb)) === 0 && boxOverlap([Math.min(...c.p.map((p) => p[0])), Math.max(...c.p.map((p) => p[0])), Math.min(...c.p.map((p) => p[1])), Math.max(...c.p.map((p) => p[1]))], zb) > 1e-4;
      if (hit) bad.push(`${c.tag} of ${c.zone || 'none'} in ${z.id}`);
    }
    const thrower = S2.find((s) => s.id === 'shuffleboard thrower'), stool = S2.find((s) => s.id === 'rail stool v 2.9');
    const dTs = Math.hypot(thrower.at[0] - stool.at[0], thrower.at[1] - stool.at[1]);
    expect(dTs >= 1.58, `the thrower is ${dTs} m from the first stool`);
    expect(!bad.length, bad.slice(0, 12).join(' | '));
    return `${zones.length} zones, ${S2.length} slots (${S2.filter((s) => s.r === 0.45).length} seats), ${lay.furniture.length} object colliders: no overlaps; the thrower ${dTs.toFixed(2)} m from the south rail's first stool`;
  });
  await check('data: walking on the real grid: every stand point within 0.6 m of a reachable cell, H reached, the lane and the flap unreachable (also with only the colliders closing them)', async () => {
    const w = await H(page, 'window.__onfoot.walkTest(0.6)'); summary.walkTest = w;
    expect(!w.bad.length, `${w.bad.length} beyond 0.6 m: ${JSON.stringify(w.bad.slice(0, 6))}`);
    expect(w.handoff <= 0.6, `H ${w.handoff} m from a reachable cell`);
    expect(w.laneCells === 0 && w.laneCellsWithLaneInRegion === 0, `lane cells reached: ${w.laneCells} (cut), ${w.laneCellsWithLaneInRegion} (in the region)`);
    return `${w.slots} stand points, worst ${w.worst[0].d} m (${w.worst[0].id}); H ${w.handoff} m; ${w.reached} cells reached, none in the lane or the flap either way; grid at game (${w.offset.x0.toFixed(2)}, ${w.offset.z0.toFixed(2)})`;
  });
  await check('data: the bartenders\' lane path: a body moved end to end clears every collider but the gate by 0 m or more', async () => {
    const r = await H(page, 'window.__onfoot.laneWalk()'); summary.lane = r;
    expect(r.clearance >= 0, `${r.clearance} m from ${r.by} at ${r.at}`);
    expect(Math.abs(r.length - 16.3) < 0.05, `length ${r.length}`);
    return `${r.length} m, least clearance ${r.clearance} m (${r.by} at frame ${r.at.map((v) => v.toFixed(2))})`;
  });
  await check('data: the player walking at the gate, the counter\'s ends and the flap never gets into the lane', async () => {
    const lane = lay.lane, starts = [[27.2, 12.4, 0], [13.6, 14.6, 90], [13.6, 13.0, 45], [27.2, 12.4, 20], [27.2, 12.4, -20], [27.9, 12.9, 60]];
    let points = 0; const bad = [];
    for (const [u, v, turn] of starts) {
      const r = await H(page, `(() => { const o = window.__onfoot, f = o.frame(), O = f.O, A = f.A, B = f.B;
        const g = (u, v) => [O[0] + u * A[0] + v * B[0], O[1] + u * A[1] + v * B[1]];
        const s = g(${u}, ${v}); o.go(s[0], s[1]);
        const t = g(${u}, 15.0), yaw = Math.atan2(t[0] - s[0], t[1] - s[1]) * 180 / Math.PI + ${turn};
        o.look(yaw, 0); const w = o.walk(0, 1, 4); const pts = [];
        for (let i = 0; i < w.path.length; i += 2) { const dx = w.path[i] - O[0], dz = w.path[i + 1] - O[1]; pts.push([dx * A[0] + dz * A[1], dx * B[0] + dz * B[1]]); }
        return pts; })()`);
      points += r.length;
      for (const p of r) if (lane.some((L) => inPolyP(p[0], p[1], L))) { bad.push(`from (${u}, ${v}) at (${p.map((x) => x.toFixed(2))})`); break; }
    }
    expect(!bad.length, bad.join(' | '));
    return `${starts.length} walks into the counter's ends, the gate and the flap (${points} positions): none in the lane`;
  });
  await check('data: the courtyard stalls: 55 to 62, every one facing 0 or pi; the fill bias recomputed from L6\'s rule', async () => {
    expect(lay.stalls.length >= 55 && lay.stalls.length <= 62, `${lay.stalls.length} stalls`);
    expect(lay.stalls.every((s) => Math.abs(s.face) < 1e-9 || Math.abs(s.face - Math.PI) < 1e-9), 'a stall not facing 0 or pi');
    const y = await H(page, 'window.__onfoot.yourCar()'), mine = lay.stalls.find((s) => s.mine);
    return `${lay.stalls.length} stalls in 4 rows; yours at (${mine.x}, ${mine.z}), its door (${y.door.x}, ${y.door.z}), the spawn (${y.spawn.x}, ${y.spawn.z}); fill bias ${lay.fillBias}`;
  });
  // the darts: S1 put each board's face inside its black backboard's box, so the zone showed three black rectangles
  await check('data: the darts: a ray from each oche point at bullseye height meets the board\'s face (bar-signs) before any painted box', async () => {
    const r = await H(page, `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]];
      return [8.4, 10.1, 11.8].map((u) => { const a = g(u, 13.38), b = g(u, 16.3); return { u, hits: o.rayHits(a[0], 0.15 + 1.73, a[1], b[0], 0.15 + 1.73, b[1]).slice(0, 3) }; }); })()`);
    summary.darts = r;
    const bad = r.filter((x) => !x.hits.length || x.hits[0].name !== 'bar-signs');
    expect(!bad.length, JSON.stringify(bad));
    return r.map((x) => `u ${x.u}: ${x.hits.map((h2) => `${h2.name} ${h2.d} m`).join(', ')}`).join('; ');
  });
  // tap to go from the customer side: S1 snapped a tap on the back bar or a bar screen to the courtyard beyond the
  // north wall, and walked you out of the front door and round the building
  await check('data: tap to go from the customer side: taps on the back bar and on the bar screens snap within 4 m and end inside, within 1.5 m of the counter\'s customer edge', async () => {
    const r = await H(page, `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]], out = [];
      for (const [what, from, tu, tv, ty] of [['the bottle wall', [18, 11.9], 18, 15.67, 1.75], ['the bottle wall', [22, 11.9], 22, 15.67, 1.58], ['the bottle wall, at an angle', [10, 11.9], 22, 15.67, 1.75], ['a bar screen', [18.7, 11.9], 18.7, 15.9, 2.95], ['a bar screen', [21.9, 11.9], 21.9, 15.9, 2.95], ['a bar screen', [25.1, 11.9], 25.1, 15.9, 2.95], ['the counter top', [18, 11.9], 18, 13.7, 1.22]]) {
        o.view('first'); const p = g(from[0], from[1]); o.go(p[0], p[1]); const t = g(tu, tv); const tap = o.tapLook(t[0], ty, t[1]); o.sim(40, true); const e = o.pos();
        const du = Math.max(14.0 - e.u, 0, e.u - 26.8), dv = Math.max(0, Math.abs(e.v - 13.3));
        out.push({ what, from, hit: tap.hit, snap: tap.snap, end: [e.u, e.v], indoors: e.indoors, fromEdge: +Math.hypot(du, dv).toFixed(3), customerSide: e.v < 13.3 }); }
      return out; })()`);
    summary.tapBar = r;
    // the rule: the nearest free cell inside, within 4 m of the tapped point (the review's 3 m refused three of these
    // seven taps: the tapped points lie 3.09 to 3.25 m from the nearest free cell on the customer side)
    const bad = r.filter((x) => !x.indoors || x.fromEdge > 1.5 || !x.customerSide || (x.snap && !(x.snap.d >= 0 && x.snap.d <= 4)));
    expect(!bad.length, JSON.stringify(bad));
    return r.map((x) => `${x.what} from (${x.from}): hit ${x.hit?.name ?? '-'}, ${x.snap ? `snapped ${x.snap.d} m` : 'no snap'}, ended at (${x.end.map((v) => v.toFixed(2))}) inside, ${x.fromEdge} m from the edge`).join('; ');
  });
  // the streets at every preset (night, so the light streams run): both I-5 chains carry lights, and all the streets
  // as built are within their allocation row
  const perPreset = {};
  for (const q of PRESETS) {
    await H(page, `(() => { const o = window.__onfoot; o.setQuality('${q}'); o.setClock('Sat', 21); o.pose('patio'); })()`);
    await frames(page, 2);
    perPreset[q] = await H(page, '(() => { const o = window.__onfoot; return { sets: o.streetSets(), built: o.streetBuilt() }; })()');
  }
  summary.streetsByPreset = Object.fromEntries(Object.entries(perPreset).map(([q, x]) => [q, { streams: x.sets.streams, built: x.built }]));
  await check(`data: the light streams at ${PRESETS.join(', ')}: both I-5 carriageways carry the preset's cars, shared by length`, async () => {
    const notes = [];
    for (const [q, x] of Object.entries(perPreset)) {
      const st = x.sets.streams, want = { low: 100, high: 200, ultra: 400 }[q];
      expect(st.cars === want && st.head === want && st.tail === want, `${q}: ${st.head}/${st.tail} drawn, ${st.cars} wanted ${want}`);
      expect(st.perPath.length === 2 && st.perPath.every((n) => n > 0) && st.perPath[0] + st.perPath[1] === want, `${q}: per chain ${st.perPath}`);
      const share = st.perPath[0] / want, byLength = st.paths[0].length / (st.paths[0].length + st.paths[1].length);
      expect(Math.abs(share - byLength) < 0.02, `${q}: northbound ${share.toFixed(3)} of the cars, ${byLength.toFixed(3)} of the length`);
      notes.push(`${q}: ${want} cars, northbound ${st.perPath[0]} and southbound ${st.perPath[1]}`);
    }
    return notes.join('; ') + ` (the chains ${perPreset[PRESETS[0]].sets.streams.paths.map((p) => p.length + ' m').join(' and ')})`;
  });
  await check(`data: all the streets as built within their row at ${PRESETS.join(', ')} (and the near set within its own)`, async () => {
    const notes = [];
    for (const [q, x] of Object.entries(perPreset)) {
      const b = x.built, [ac, at] = b.alloc.streets, [nc, nt] = b.alloc.near;
      expect(b.all.calls <= ac && b.all.tris <= at, `${q}: all the streets ${b.all.calls}/${fmt(b.all.tris)} > ${ac}/${fmt(at)}`);
      expect(b.near.calls <= nc && b.near.tris <= nt, `${q}: the near set ${b.near.calls}/${fmt(b.near.tris)} > ${nc}/${fmt(nt)}`);
      notes.push(`${q}: all ${b.all.calls}/${fmt(b.all.tris)} of ${ac}/${fmt(at)} (near ${b.near.calls}/${fmt(b.near.tris)} of ${nc}/${fmt(nt)}, far ${b.far.calls}/${fmt(b.far.tris)})`);
    }
    return notes.join('; ');
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ random walks
if (want('walks')) {
  console.log(`random walks: ${WALKS}`);
  const { ctx, page, errors } = await open([640, 360], 'quality=low&day=Sat&hour=12&hint=0');
  await check('walks: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await H(page, 'window.__onfoot.freeze(true)');
  const cols = await H(page, 'window.__onfoot.colliders()'), region = await H(page, 'window.__onfoot.region()');
  const starts = await H(page, `window.__onfoot.randomFree(${WALKS * 2}, 5758)`);
  // Lot 57's step keeps the body's centre at least RADIUS - 0.02 m from everything (it stays put otherwise), so the
  // checker allows that 2 cm and 0.1 mm of floating point, no more
  const R = 0.3, TOL = 0.02, C = 4, hash = new Map(), key = (i, j) => i * 100003 + j;
  const bboxOf = (c) => c.k === 'circ' ? [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r] : c.k === 'seg' ? [Math.min(c.ax, c.bx) - c.r, Math.min(c.az, c.bz) - c.r, Math.max(c.ax, c.bx) + c.r, Math.max(c.az, c.bz) + c.r]
    : (() => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (let i = 0; i < c.pts.length; i += 2) { x0 = Math.min(x0, c.pts[i]); x1 = Math.max(x1, c.pts[i]); z0 = Math.min(z0, c.pts[i + 1]); z1 = Math.max(z1, c.pts[i + 1]); } return [x0, z0, x1, z1]; })();
  cols.forEach((c, n) => { const [x0, z0, x1, z1] = bboxOf(c); for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) { const k = key(i, j); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(n); } });
  const nearby = (x0, z0, x1, z1) => { const s = new Set(); for (let i = Math.floor((x0 - 1) / C); i <= Math.floor((x1 + 1) / C); i++) for (let j = Math.floor((z0 - 1) / C); j <= Math.floor((z1 + 1) / C); j++) for (const n of hash.get(key(i, j)) ?? []) s.add(n); return [...s].map((n) => cols[n]); };
  const inPoly = (x, z, P) => { let ins = false; for (let i = 0, j = P.length / 2 - 1; i < P.length / 2; j = i++) { const xi = P[i * 2], zi = P[i * 2 + 1], xj = P[j * 2], zj = P[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
  const sdist = (c, x, z) => {
    if (c.k === 'circ') return Math.hypot(x - c.x, z - c.z) - c.r;
    if (c.k === 'seg') return segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r;
    let d = Infinity; const P = c.pts, n = P.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) d = Math.min(d, segDist(x, z, P[j * 2], P[j * 2 + 1], P[i * 2], P[i * 2 + 1]));
    return inPoly(x, z, P) ? -d : d;
  };
  const crossL = (ax, az, bx, bz, cx, cz, dx, dz) => segsCross([ax, az], [bx, bz], [cx, cz], [dx, dz]);
  const rows = region.rows, inRegion = (x, z) => { const i = Math.floor((x - region.x0) / region.cell), j = Math.floor((z - region.z0) / region.cell); if (j < 0 || j >= region.nz) return false; const r = rows[j]; for (let k = 0; k < r.length; k += 2) if (i >= r[k] && i < r[k] + r[k + 1]) return true; return false; };
  const fails = []; let points = 0, steps = 0, metres = 0, tapWalks = 0, stickWalks = 0, noPath = 0, arrived = 0;
  const blocked = {}, lost = [];
  const verify = (pathA, label) => {
    for (let i = 0; i < pathA.length; i += 2) {
      const x = pathA[i], z = pathA[i + 1]; points++;
      for (const c of nearby(x - R, z - R, x + R, z + R)) { const d = sdist(c, x, z); if (d < R - TOL - 1e-4) { fails.push(`${label}: inside ${c.tag} (overlap ${(R - d).toFixed(4)} m) at ${x.toFixed(2)}, ${z.toFixed(2)}`); return; } }
      if (!inRegion(x, z)) { fails.push(`${label}: off the walkable area at ${x.toFixed(2)}, ${z.toFixed(2)}`); return; }
      if (i >= 2) {
        const ax = pathA[i - 2], az = pathA[i - 1]; steps++; metres += Math.hypot(x - ax, z - az);
        for (const c of nearby(Math.min(ax, x), Math.min(az, z), Math.max(ax, x), Math.max(az, z))) {
          if (c.k === 'seg' && crossL(ax, az, x, z, c.ax, c.az, c.bx, c.bz)) { fails.push(`${label}: crossed ${c.tag} between ${ax.toFixed(2)},${az.toFixed(2)} and ${x.toFixed(2)},${z.toFixed(2)}`); return; }
          if (c.k === 'poly') { const P = c.pts, n = P.length / 2; for (let a = 0, b = n - 1; a < n; b = a++) if (crossL(ax, az, x, z, P[b * 2], P[b * 2 + 1], P[a * 2], P[a * 2 + 1])) { fails.push(`${label}: crossed the edge of ${c.tag} at ${x.toFixed(2)},${z.toFixed(2)}`); return; } }
        }
      }
    }
  };
  // the checker must be able to fail: made-up paths through the front wall, through the party wall, through the patio
  // fence and into a pool table are each caught
  {
    const f = await H(page, 'window.__onfoot.frame()'), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]];
    const line = (a, b) => { const out = []; for (let k = 0; k <= 10; k++) { const u = a[0] + ((b[0] - a[0]) * k) / 10, v = a[1] + ((b[1] - a[1]) * k) / 10; out.push(...g(u, v)); } return out; };
    const before = fails.length;
    verify(line([1.8, 7.0], [4.3, 7.0]), 'self-test front wall');
    verify(line([35.0, 4.0], [36.6, 4.0]), 'self-test party wall');
    verify(line([1.4, -3.0], [2.6, -3.0]), 'self-test patio fence');
    verify(line([11.0, 6.9], [11.0, 6.9]), 'self-test pool table');
    const caught = fails.splice(before);
    await check('walks: the independent checker catches a path through the front wall, the party wall, the patio fence and into a pool table', async () => {
      expect(caught.length === 4, `caught ${caught.length} of 4: ${caught.join(' | ')}`);
      return caught.map((c) => c.split(': ')[1]).join('; ');
    });
    points = 0; steps = 0; metres = 0;
  }
  const BATCH = 20;
  for (let w0 = 0; w0 < WALKS; w0 += BATCH) {
    const batch = [];
    for (let w = w0; w < Math.min(WALKS, w0 + BATCH); w++) {
      const s = starts[w % starts.length], t = starts[(w * 7 + 3) % starts.length], seed = w * 2654435761 % 1000;
      batch.push(w % 2 ? { kind: 'tap', s, t } : { kind: 'stick', s, legs: [0, 1, 2, 3].map((k) => ({ yaw: ((seed * 37 + k * 97) % 360), sx: (((seed + k * 13) % 21) - 10) / 10, sy: (((seed * 3 + k * 7) % 21) - 10) / 10, run: (seed + k) % 3 === 0 })) });
    }
    const res = await H(page, `(() => { const o = window.__onfoot, out = [];
      for (const b of ${JSON.stringify(batch)}) {
        const st = o.go(b.s.x, b.s.z); let path = [st.x, st.z], info = '';
        if (b.kind === 'tap') {
          const dx = b.t.x - b.s.x, dz = b.t.z - b.s.z, d = Math.hypot(dx, dz), k = d > 60 ? 60 / d : 1;
          const p = o.tap(b.s.x + dx * k, b.s.z + dz * k);
          if (!p) { out.push({ kind: 'tap', path, nopath: true }); continue; }
          const r = o.sim(p.length / 1.2 + 10, true); path = path.concat(r.path); info = p.length;
          const e = o.pos(), last = p.waypoints[p.waypoints.length - 1];
          out.push({ kind: 'tap', path, info, end: e, miss: +Math.hypot(e.x - last.x, e.z - last.z).toFixed(3), gaveUp: e.gaveUp, moving: e.moving });
          continue;
        } else for (const L of b.legs) { o.look(L.yaw, 0); const r = o.walk(L.sx, L.sy, 1.5, L.run); path = path.concat(r.path); }
        out.push({ kind: b.kind, path, info, end: o.pos() });
      }
      return out; })()`);
    for (const [i, r] of res.entries()) {
      if (r.kind === 'tap') tapWalks++; else stickWalks++;
      if (r.nopath) { noPath++; continue; }
      verify(r.path, `walk ${w0 + i} (${r.kind})`);
      if (r.kind === 'tap') {
        if (r.miss <= 0.5 && !r.moving) arrived++;
        else if (r.gaveUp && r.gaveUp.by && r.gaveUp.by !== 'unknown') blocked[r.gaveUp.by] = (blocked[r.gaveUp.by] ?? 0) + 1;
        else lost.push(`walk ${w0 + i}: ${r.info} m path, ended ${r.miss} m short${r.moving ? ', still walking' : ''}`);
      }
    }
    if (fails.length > 20) break;
  }
  summary.walks = { tapWalks, stickWalks, noPath, arrived, blocked, lost: lost.length, points, steps, metres: Math.round(metres), colliders: cols.length, fails: fails.length };
  await check(`walks: ${WALKS} random walks never end inside a collider or cross a wall, the patio fence or the party wall`, async () => {
    expect(!fails.length, `${fails.length} failures: ${fails.slice(0, 6).join(' | ')}`);
    return `${tapWalks} tap-to-go + ${stickWalks} stick walks, ${points} positions over ${Math.round(metres)} m against ${cols.length} colliders and the region (${noPath} taps had no path; ${arrived} arrived; ${lost.length} lost)`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ seats and closed hours
if (want('seats')) {
  console.log('seats: tap to go to every seat');
  const { ctx, page, errors } = await open([640, 360], 'quality=low&day=Sat&hour=12&hint=0');
  await check('seats: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await H(page, 'window.__onfoot.freeze(true)');
  await check('seats: tap to go reaches every one of the 91 seats from just inside the front door and sits you down', async () => {
    const r = await H(page, `(() => { const o = window.__onfoot, st = o.startAt().door, out = [];
      for (const s of o.seats()) { o.go(st.x, st.z); const p = o.tapSeat(s.id); if (!p) { out.push({ id: s.id, kind: s.kind, nopath: true }); continue; } o.sim(p.length / 1.2 + 12, true); const e = o.pos(); out.push({ id: s.id, kind: s.kind, at: s.at, sat: e.sitting === s.id, len: p.length }); }
      return out; })()`);
    const bad = r.filter((x) => !x.sat);
    summary.seats = { n: r.length, kinds: [...new Set(r.map((x) => x.kind))], longest: Math.max(...r.map((x) => x.len ?? 0)) };
    expect(r.length === 91, `${r.length} seats`);
    expect(!bad.length, `${bad.length} not seated: ${JSON.stringify(bad.slice(0, 6))}`);
    return `91 seats (${summary.seats.kinds.join(', ')}), all seated; paths up to ${summary.seats.longest} m`;
  });
  await check('seats: sit and stand work on each kind (the action button)', async () => {
    const r = await H(page, `(() => { const o = window.__onfoot, out = {};
      for (const s of o.seats()) { if (out[s.kind]) continue; o.go(s.approach.x, s.approach.z); const a = o.act(); const sat = o.pos().sitting; const b = o.act(); out[s.kind] = { sit: a.did, sat, stand: b.did, after: o.pos().sitting }; }
      return out; })()`);
    const bad = Object.entries(r).filter(([, v]) => v.sit !== 'sit' || v.sat === null || v.stand !== 'stand' || v.after !== null);
    expect(!bad.length, JSON.stringify(r));
    return Object.keys(r).join(', ') + ': sit, then stand';
  });
  await ctx.close().catch(() => {});
}
if (want('closed')) {
  console.log('closed hours');
  const { ctx, page, errors } = await open([640, 360], 'quality=low&day=Tue&hour=9.5&hint=0');
  await check('closed: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await check('closed: at Tuesday 09:30 the doors are locked, there is no way in, and the lot is walkable; the hours and the chip say so', async () => {
    const r = await H(page, `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]];
      const out = { doors: o.doors(), clock: o.clock(), hud: o.hud() };
      const a = g(-1.2, 8.3); o.go(a[0], a[1]); const inside = g(10, 10); const p = o.tap(inside[0], inside[1]); o.sim(30, true); out.inPos = o.pos();
      const b = g(-1.2, 8.3); o.go(b[0], b[1]); const lotPt = o.yourCar().door; const q = o.tap(lotPt.x, lotPt.z); o.sim(60, true); out.lotPos = o.pos(); out.lotTap = !!q; out.inTap = p;
      return out; })()`);
    expect(r.doors.every((d) => d.locked), `doors: ${JSON.stringify(r.doors)}`);
    expect(!r.inPos.indoors, `got inside: ${JSON.stringify(r.inPos)}`);
    expect(r.lotTap && Math.hypot(r.lotPos.x - (await H(page, 'window.__onfoot.yourCar().door')).x, r.lotPos.z - (await H(page, 'window.__onfoot.yourCar().door')).z) < 0.8, `the lot walk: ${JSON.stringify(r.lotPos)}`);
    expect(/Closed/.test(r.hud.place.text) && /Simulated crowd · Closed/.test(r.hud.crowd.text), JSON.stringify(r.hud));
    await shot(page, png('s1-closed-640x360-tue0930'));
    return `both doors locked; a tap inside from the front walk ${r.inTap ? `found a path that ended outside (${r.inPos.u}, ${r.inPos.v})` : 'had no path'}; the walk to your car arrived; "${r.hud.place.text.trim()}", "${r.hud.crowd.text.trim()}"`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ honesty
if (want('honesty')) {
  console.log('honesty');
  const init = () => {
    window.__drawn = [];
    for (const P of [CanvasRenderingContext2D.prototype]) for (const k of ['fillText', 'strokeText']) { const f = P[k]; P[k] = function (t, ...a) { window.__drawn.push(String(t)); return f.call(this, t, ...a); }; }
  };
  const { ctx, page, errors } = await open([1280, 720], 'quality=high&day=Sat&hour=21&hint=1', false, init);
  await check('honesty: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  const lookup = /LOOKUP = \{'sportsbar': "([^"]+)"\}/.exec(readFileSync(path.join(ROOT, 'tools/anaheim/venue.py'), 'utf8'))[1];
  const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  await check('honesty: the real name appears nowhere in src/, the bar\'s shipped data or the built page (the tooling\'s lookup key, case and punctuation folded)', async () => {
    const key = fold(lookup), files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'src/data/anaheim'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => f && existsSync(path.join(ROOT, f)));
    const hits = [...files.map((f) => path.join(ROOT, f)), PAGE].filter((f) => fold(readFileSync(f, 'latin1')).includes(key));
    expect(!hits.length, `found in ${hits.join(', ')}`);
    return `${files.length + 1} files clean (every file under src/ and the built page)`;
  });
  await check('honesty: no "live" on any canvas; "live" in the UI only inside the two allowed negations; no real-time, odds, bet or currency words', async () => {
    await H(page, `(() => { document.getElementById('crowd').click(); })()`);
    const ui1 = await H(page, `(() => { const out = []; const walk = (n) => { if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) out.push(t); } else if (n.nodeType === 1) { for (const a of ['aria-label', 'title', 'alt', 'placeholder']) if (n.getAttribute(a)) out.push(n.getAttribute(a)); for (const c of n.childNodes) walk(c); } }; walk(document.body); return out; })()`);
    await H(page, `(() => { document.querySelector('#about [data-close]').click(); document.getElementById('menu').click(); })()`);
    const canvas = await H(page, 'window.__drawn');
    const allUi = ui1.join(' • ');
    const allowed = allUi.replace(/Nothing here is live/g, '').replace(/not live/g, '');
    expect(!/\blive\b/i.test(allowed), `"live" in the UI: ${(allowed.match(/.{0,40}\blive\b.{0,40}/i) ?? [''])[0]}`);
    expect(!canvas.some((t) => /\blive\b/i.test(t)), `"live" on a canvas: ${canvas.filter((t) => /\blive\b/i.test(t)).join(' | ')}`);
    const words = /real-time|people here now|\bodds\b|moneyline|point spread|over\/under|parlay|wager|sportsbook|\bbet\b|[$€£¥]|\bUSD\b/i;
    const hit = [...canvas, ...ui1].filter((t) => words.test(t));
    expect(!hit.length, `forbidden words: ${hit.join(' | ')}`);
    expect(/Nothing here is live/.test(allUi), 'the tapped chip\'s sentence is missing');
    await H(page, `document.querySelector('#pause [data-close]').click()`);
    return `${canvas.length} canvas strings (${[...new Set(canvas)].slice(0, 8).map((t) => `"${t}"`).join(', ')}, ...) and ${ui1.length} UI strings with every sheet opened: clean`;
  });
  await check('honesty: the places file is not in the built page; no part of Lot 57\'s slice is; the bar slice\'s own description is', async () => {
    const html = readFileSync(PAGE, 'utf8'), places = JSON.parse(readFileSync(path.join(ROOT, 'src/data/anaheim/sportsbar-slice-places.json'), 'utf8'));
    const lot = JSON.parse(readFileSync(path.join(ROOT, 'src/data/anaheim/slice.json'), 'utf8')), bar = JSON.parse(readFileSync(path.join(ROOT, 'src/data/anaheim/sportsbar-slice.json'), 'utf8'));
    expect(!html.includes(places.what) && !html.includes(places.attribution), 'the places file is in the page');
    expect(!html.includes('Anaheim stadium-district slice'), 'Lot 57\'s slice text is in the page');
    const nums = lot.seg[0].p.slice(0, 16).join(',');
    expect(!html.includes(nums), `Lot 57's first segment (${nums}) is in the page`);
    expect(html.includes(bar.what), 'the bar slice\'s own description is missing');
    return `page ${(html.length / 1024).toFixed(0)} KB: no places file, no "${lot.what.slice(0, 30)}...", no ${nums.slice(0, 30)}...; has "${bar.what.slice(0, 40)}..."`;
  });
  await check('honesty: the chip and the credit are on screen and readable at 1280x720 (Sat 21:00)', async () => {
    const n = await shot(page, png('s1-1280x720-spawn-night')); const h = await H(page, 'window.__onfoot.hud()'), vp = page.viewportSize();
    const inView = (r) => r && r.visible && r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.width + 1 && r.y + r.h <= vp.height + 1;
    expect(inView(h.crowd) && /Simulated crowd/.test(h.crowd.text), JSON.stringify(h.crowd));
    expect(inView(h.credit) && /OpenStreetMap/.test(h.credit.text) && /Overture/.test(h.credit.text) && /TomTom/.test(h.credit.text) && /WorldCover/.test(h.credit.text), JSON.stringify(h.credit));
    return `${n}: "${h.crowd.text.trim()}", credit ${Math.round(h.credit.w)} x ${Math.round(h.credit.h)} px`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ crossing the doors
if (want('cross')) {
  for (const q of PRESETS) {
    console.log(`doors at ${q}`);
    const { ctx, page, errors } = await open([1280, 720], `quality=${q}&ultra=1&day=Sat&hour=12&hint=0`);
    await check(`cross ${q}: boots with no console errors`, async () => { expect(!errors.length, errors.join(' | ')); });
    if (q === 'ultra') await H(page, 'window.__onfoot.setQuality("ultra")');
    for (const door of ['front', 'patio']) for (const v of ['first', 'third']) {
      await check(`cross ${q}: walking out of the ${door} door in ${v} person switches the state on the crossing frame; nothing in the street world and no caster changes but the listed swaps`, async () => {
        const r = await H(page, `window.__onfoot.cross('${door}', '${v}')`);
        expect(r.mismatched === 0, `${r.mismatched} steps where the state didn't match the camera's side`);
        expect(r.crossings.length >= 1 && r.flips.length === r.crossings.length && r.flips.every((f, i) => f === r.crossings[i]), `flips ${r.flips} vs crossings ${r.crossings}`);
        const a = r.before, b = r.after;
        expect(a && b && a.state === 'inside' && b.state === 'outside', `${a?.state} -> ${b?.state}`);
        const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
        expect(same(a.streets, b.streets), 'the street batches differ');
        expect(same(a.trees, b.trees), 'the trees differ');
        // the listed swaps: the parked cars (stand-ins to detailed models) and your car (its stand-in to the full car)
        const swaps = new Set(['your-car', 'your-car-standin']);
        if (a.casters) for (const k of ['sun']) {
          const da = a.casters[k].filter((n) => !n.startsWith('parked-') && !swaps.has(n)).sort(), db = b.casters[k].filter((n) => !n.startsWith('parked-') && !swaps.has(n)).sort();
          expect(same(da, db), `casters differ: ${da.filter((n) => !db.includes(n)).slice(0, 5)} / ${db.filter((n) => !da.includes(n)).slice(0, 5)}`);
          expect(da.includes('avatar'), `your avatar isn't a caster: ${da.slice(0, 8)}`);
        }
        if (a.avatar?.lod === 0 || b.avatar?.lod === 0) expect(!a.avatar.lod0CastShadow && !b.avatar.lod0CastShadow && (a.avatar.lod !== 0 || a.avatar.caster.hidden), JSON.stringify([a.avatar, b.avatar]));
        summary[`cross-${q}-${door}-${v}`] = { before: { parked: a.parked, yourCar: a.yourCar }, after: { parked: b.parked, yourCar: b.yourCar } };
        return `${r.steps} steps, flipped at step ${r.flips.join(', ')} (crossing ${r.crossings.join(', ')}); swaps: parked near ${a.parked.near} -> ${b.parked.near}, your car ${a.yourCar} -> ${b.yourCar}; ${a.streets.near.length} near and ${a.streets.far.length} far street meshes and ${a.trees.length} tree meshes the same; ${a.casters ? a.casters.sun.length + ' sun casters inside, ' + b.casters.sun.length + ' outside' : 'no map'}`;
      });
    }
    // the screenshots on both sides of each door: inside looking out, then 0.5 m past the door at the same yaw and pitch
    for (const hour of [12, 21]) for (const door of ['front', 'patio']) {
      await check(`cross ${q}: screenshots on both sides of the ${door} door at ${hour}:00`, async () => {
        const names = [];
        for (const sideIn of [true, false]) {
          await H(page, `(() => { const o = window.__onfoot; o.view('first'); o.setClock('Sat', ${hour}); const f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]];
            const door = '${door}', out = door === 'front' ? [-0.932, 0.362] : [0, -1], c = door === 'front' ? [3.48, 8.24] : [18.9, 0.35];
            const k = ${sideIn ? -1.4 : 0.6}, p = g(c[0] + out[0] * k, c[1] + out[1] * k); o.go(p[0], p[1]);
            const yaw = Math.atan2(out[0] * f.A[0] + out[1] * f.B[0], out[0] * f.A[1] + out[1] * f.B[1]) * 180 / Math.PI; o.look(yaw, -4); })()`);
          await frames(page, 1);
          const n = png(`s1-door-${door}-${sideIn ? 'in' : 'out'}-${q}-${hour}00`); await shot(page, n); names.push(n);
          const v = await H(page, 'window.__onfoot.vis()'); summary[`door-${door}-${q}-${hour}-${sideIn ? 'in' : 'out'}`] = { state: v.state, parked: v.parked, yourCar: v.yourCar };
        }
        return names.join(', ');
      });
    }
    await ctx.close().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ budgets at the poses
if (want('budgets')) {
  const sizes = [[844, 390, ['door', 'tv-east', 'stall', 'patio', 'overhead']], [390, 844, ['door', 'overhead']]];
  summary.budgets = summary.budgets ?? {};
  for (const [w, h, poses] of sizes) {
    console.log(`budgets at ${w}x${h}`);
    const { ctx, page, errors } = await open([w, h], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
    await check(`budgets ${w}x${h}: boots with no console errors`, async () => { expect(!errors.length, errors.join(' | ')); });
    for (const q of PRESETS) {
      await H(page, `window.__onfoot.setQuality('${q}')`);
      for (const pose of poses) {
        await check(`budgets ${w}x${h} ${q} ${pose}: the pass without people within the "without people or items" row; breakdown() within 1% of the pass; the maps once a frame`, async () => {
          const r = await H(page, `window.__onfoot.pose('${pose}')`);
          await frames(page, 2);
          const s = await H(page, 'window.__onfoot.stats()'), b = await H(page, 'window.__onfoot.breakdown()'), v = await H(page, 'window.__onfoot.vis()'), bud = await H(page, 'window.__onfoot.budget()');
          const av = b.groups.avatar ?? { calls: 0, tris: 0 };
          // the row leaves out the people and the items: your avatar, and from S2a the staff and the six item meshes
          const pi = ['avatar', 'staff', 'items'].reduce((acc, k) => ({ calls: acc.calls + (b.groups[k]?.calls ?? 0), tris: acc.tris + (b.groups[k]?.tris ?? 0) }), { calls: 0, tris: 0 });
          const lessCalls = s.pass.calls - pi.calls, lessTris = s.pass.tris - pi.tris;
          const [bc, bt] = bud.noPeople;
          const okPass = lessCalls <= bc && lessTris <= bt;
          const agree = Math.abs(b.total.calls - s.pass.calls) <= Math.max(1, s.pass.calls * 0.01) && Math.abs(b.total.tris - s.pass.tris) <= s.pass.tris * 0.01;
          // the frame: the pass, at Ultra GTAO's normal pass as measured (the pass less the lines, points, overlays and
          // meshes without normals it leaves out), each map once, the post quads
          const aoC = s.ao ? s.ao.calls : 0, aoT = s.ao ? s.ao.tris : 0, mapsCalls = Object.values(s.maps).filter((m) => !m.frozen).reduce((a, m) => a + m.calls, 0), mapsTris = Object.values(s.maps).filter((m) => !m.frozen).reduce((a, m) => a + m.tris, 0);
          const post = s.frame.calls - s.pass.calls - aoC - mapsCalls, postTris = s.frame.tris - s.pass.tris - aoT - mapsTris;
          const once = q === 'low' ? Math.abs(s.frame.tris - s.pass.tris) <= s.pass.tris * 0.01 : post >= 0 && post <= 30 && Math.abs(postTris) <= s.frame.tris * 0.01;
          // your avatar's caster: the sun's map drops by its own triangles with its castShadow off
          let casterDrop = null;
          if (q !== 'low') { await H(page, 'window.__onfoot.avatarCaster(false)'); const s2 = await H(page, 'window.__onfoot.stats()'); await H(page, 'window.__onfoot.avatarCaster(true)'); casterDrop = s.maps.sun.tris - s2.maps.sun.tris; }
          const row = { pose, state: v.state, view: v.view, pass: s.pass, frame: s.frame, ao: s.ao, maps: s.maps, groups: b.groups, avatar: av, lessPeople: { calls: lessCalls, tris: lessTris }, budget: bud.noPeople, breakdown: b.total, post, postTris, casterDrop, parked: v.parked, yourCar: v.yourCar, frameMs: s.frameMs };
          summary.budgets[`${w}x${h}-${q}-${pose}`] = row;
          const gtxt = Object.entries(b.groups).map(([g2, x]) => `${g2} ${x.calls}/${fmt(x.tris)}`).join(', ');
          expect(r.state === v.state, 'state');
          expect(agree, `breakdown ${b.total.calls}/${b.total.tris} vs pass ${s.pass.calls}/${s.pass.tris}`);
          expect(once, `frame ${s.frame.calls}/${s.frame.tris} vs pass ${s.pass.calls}/${s.pass.tris} + AO ${aoC}/${aoT} + maps ${mapsCalls}/${mapsTris}: post ${post} calls, ${postTris} tris`);
          if (q !== 'low') expect(casterDrop > 0, `the sun's map didn't drop with your avatar's caster off (${casterDrop})`);
          // the sun's map within its row of the sums less the items and the people other than your avatar (5 at HD, 19
          // at Ultra, and Ultra's 16 pool-slot people's empty calls inside and overhead)
          const SUN = { high: { inside: [91, 181.0e3], outside: [126, 333.0e3], overhead: [126, 333.0e3] }, ultra: { inside: [136, 422.0e3], outside: [146, 604.7e3], overhead: [146, 604.7e3] } };
          if (q !== 'low') { const [mc, mt] = SUN[q][v.state]; expect(s.maps.sun.calls <= mc && s.maps.sun.tris <= mt, `the sun's map ${s.maps.sun.calls}/${fmt(s.maps.sun.tris)} > ${mc}/${fmt(mt)}`); }
          // Ultra's pool spots: each map draws only its table and lamp; every other caster is an empty call
          if (q === 'ultra' && v.state !== 'outside') for (const k of [1, 2]) {
            const own = v.poolTris[k - 1];
            const m = s.maps[`pool-${k}`]; expect(m && Math.abs(m.tris - own) <= 2, `pool-${k}'s map draws ${m?.tris} triangles, its table and lamp ${own}`);
          }
          expect(okPass, `pass less the people and items ${lessCalls} calls, ${fmt(lessTris)} > ${bc}, ${fmt(bt)} (${gtxt})`);
          // the rows as drawn at the pose: the venue, all the streets and the trees, each within its allocation
          const A = bud.alloc, gv = b.groups.venue ?? { calls: 0, tris: 0 }, gt = b.groups.trees ?? { calls: 0, tris: 0 };
          const gs = ['near streets', 'far streets'].reduce((a, k) => ({ calls: a.calls + (b.groups[k]?.calls ?? 0), tris: a.tris + (b.groups[k]?.tris ?? 0) }), { calls: 0, tris: 0 });
          expect(gv.calls <= A.venue[0] && gv.tris <= A.venue[1], `the venue ${gv.calls}/${fmt(gv.tris)} > ${A.venue[0]}/${fmt(A.venue[1])}`);
          expect(gs.calls <= A.streets[0] && gs.tris <= A.streets[1], `the streets ${gs.calls}/${fmt(gs.tris)} > ${A.streets[0]}/${fmt(A.streets[1])}`);
          expect(gt.calls <= A.trees[0] && gt.tris <= A.trees[1], `the trees ${gt.calls}/${fmt(gt.tris)} > ${A.trees[0]}/${fmt(A.trees[1])}`);
          return `${v.state}: pass ${s.pass.calls}/${fmt(s.pass.tris)}, less your avatar (${av.calls}/${fmt(av.tris)}) ${lessCalls}/${fmt(lessTris)} of ${bc}/${fmt(bt)}; frame ${s.frame.calls}/${fmt(s.frame.tris)}; maps ${Object.entries(s.maps).map(([n2, m]) => `${n2} ${m.calls}/${fmt(m.tris)}${m.frozen ? ' frozen' : ''}`).join(', ') || 'none'}; ${s.ao ? `AO pass ${s.ao.calls}/${fmt(s.ao.tris)}; ` : ''}post ${post}; caster ${casterDrop ?? '-'}; [${gtxt}]`;
        });
      }
    }
    await ctx.close().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ the page's own rates here (O7)
if (want('rates')) {
  const { ctx, page, errors, bootS } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await check('rates: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); return `boot ${bootS} s; buildMs ${await H(page, 'window.__onfoot.buildMs')}`; });
  summary.rates = {};
  for (const q of PRESETS) {
    await check(`rates ${q}: the warm-up after the switch (3 frames) and the rate over the next 4 frames at the door pose, 844x390`, async () => {
      const t0 = Date.now(); await H(page, `window.__onfoot.setQuality('${q}')`); await H(page, `window.__onfoot.pose('door')`); const tSwitch = (Date.now() - t0) / 1000;
      const t1 = Date.now(); await frames(page, 3); const warm = (Date.now() - t1) / 1000;
      const t2 = Date.now(); await frames(page, 4); const per = (Date.now() - t2) / 4000;
      const st = await H(page, '(() => { const o = window.__onfoot; return { frameMs: o.stats().frameMs }; })()');
      summary.rates[q] = { switchS: +tSwitch.toFixed(1), warmS: +warm.toFixed(1), secondsPerFrame: +per.toFixed(2), fps: +(1 / per).toFixed(2), cpuFrameMs: st.frameMs };
      return `switch ${tSwitch.toFixed(1)} s, 3 warm-up frames ${warm.toFixed(1)} s, then ${per.toFixed(2)} s a frame (${(1 / per).toFixed(2)} fps); the page's CPU ${st.frameMs} ms a frame`;
    });
  }
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ your avatar's shadow
if (want('shadows')) {
  for (const q of PRESETS.filter((p) => p !== 'low')) {
    console.log(`shadows at ${q}`);
    const { ctx, page, errors } = await open([1280, 720], `quality=${q}&ultra=1&day=Sat&hour=12&hint=0`);
    await check(`shadows ${q}: boots with no console errors`, async () => { expect(!errors.length, errors.join(' | ')); });
    if (q === 'ultra') {
      // the page opened at Ultra by your car, outside, where the pool spots' maps are frozen: each is drawn once anyway,
      // so the glazing never shows a spot map that was never rendered (S1 left it empty until you went in)
      await check('shadows ultra: opened outside, both pool spots\' maps are frozen and were drawn once', async () => {
        await frames(page, 2);
        const v = await H(page, 'window.__onfoot.vis()');
        expect(v.state === 'outside', `state ${v.state}`);
        expect(v.poolSpots.every((p) => p && p.castShadow && !p.updating && p.drawn), JSON.stringify(v.poolSpots));
        return `state ${v.state}; pool spots ${JSON.stringify(v.poolSpots)}`;
      });
      await H(page, 'window.__onfoot.setQuality("ultra")');
    }
    for (const where of ['lot', 'walk']) for (const v of ['first', 'third']) {
      await check(`shadows ${q}: your avatar's shadow in ${v} person (${where}, noon, the sun behind the camera), and its caster in the sun's map`, async () => {
        await H(page, `(() => { const o = window.__onfoot; o.setClock('Sat', 12); o.view('${v}'); const f = o.frame(), g = (u, w) => [f.O[0] + u * f.A[0] + w * f.B[0], f.O[1] + u * f.A[1] + w * f.B[1]];
          const p = '${where}' === 'lot' ? [o.yourCar().spawn.x + 2.5, o.yourCar().spawn.z - 3] : g(...[-1.6, 4]); o.go(p[0], p[1]);
          o.look(180, ${v === 'first' ? -38 : -14}); })()`);
        await frames(page, 1);
        const n = png(`s1-shadow-${q}-${v}-${where}-noon`); await shot(page, n);
        const s = await H(page, 'window.__onfoot.stats()'); await H(page, 'window.__onfoot.avatarCaster(false)'); const s2 = await H(page, 'window.__onfoot.stats()'); await H(page, 'window.__onfoot.avatarCaster(true)');
        const v2 = await H(page, 'window.__onfoot.vis()'), b = await H(page, 'window.__onfoot.breakdown()');
        const drop = s.maps.sun.tris - s2.maps.sun.tris;
        expect(drop > 0, `no drop (${drop})`);
        if (v === 'first') expect(b.groups.avatar && b.groups.avatar.calls === 1 && b.groups.avatar.tris === 0, `avatar in the pass: ${JSON.stringify(b.groups.avatar)}`);
        if (q === 'ultra' && v === 'third') expect(v2.avatar.lod === 0 && v2.avatar.caster.hidden && !v2.avatar.lod0CastShadow, JSON.stringify(v2.avatar));
        summary[`shadow-${q}-${v}-${where}`] = { drop, avatar: v2.avatar, pass: b.groups.avatar };
        return `${n}: the sun's map drops ${fmt(drop)} triangles with the caster off; the avatar in the pass ${JSON.stringify(b.groups.avatar)}; caster ${JSON.stringify(v2.avatar.caster)}`;
      });
    }
    await ctx.close().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ cars as measured
if (want('cars')) {
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await check('cars: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  const yours = {};
  for (const q of PRESETS) {
    await H(page, `window.__onfoot.setQuality('${q}')`); await H(page, `window.__onfoot.pose('stall')`); await frames(page, 2);
    const b = await H(page, 'window.__onfoot.breakdown()'), v = await H(page, 'window.__onfoot.vis()'), p = await H(page, 'window.__onfoot.parkedList()'), c = await H(page, 'window.__onfoot.yourCarTris()');
    yours[q] = { car: c, drawn: b.groups['your-car'], parked: Object.fromEntries(Object.entries(b.groups).filter(([k]) => k.startsWith('parked'))), near: v.parked, list: p };
  }
  summary.cars = yours;
  await check('cars: your car 62.2k at Low and 118.3k at HD and Ultra (2%), the parked cars near x their cap plus 152 a stand-in in 25 calls or fewer', async () => {
    const L = yours.low?.car?.tris, Hd = yours.high?.car?.tris, U = yours.ultra?.car?.tris;
    if (L) expect(Math.abs(L - 62.2e3) <= 62.2e3 * 0.02, `Low ${L}`);
    if (Hd) expect(Math.abs(Hd - 118.3e3) <= 118.3e3 * 0.02, `HD ${Hd}`);
    if (U) expect(Math.abs(U - 118.3e3) <= 118.3e3 * 0.02, `Ultra ${U}`);
    const notes = [];
    for (const [q, y] of Object.entries(yours)) {
      const calls = Object.values(y.parked).reduce((a, x) => a + x.calls, 0), tris = Object.values(y.parked).reduce((a, x) => a + x.tris, 0);
      const cap = (q === 'ultra' ? 5600 : 2880) * y.near.detailed + 152 * y.near.standins;
      expect(calls <= 25 && tris <= cap + 1, `${q}: ${calls} calls, ${tris} > ${cap}`);
      notes.push(`${q}: your car ${fmt(y.car.tris)} in ${y.car.calls} meshes (${fmt(y.drawn?.tris ?? 0)} of it in view at the pose); parked ${y.near.detailed} detailed + ${y.near.standins} stand-ins = ${fmt(tris)} in ${calls} calls (cap ${fmt(cap)})`);
    }
    return notes.join('; ');
  });
  await check('cars: switching between HD and Ultra rebuilds the parked cars at the other quality with the same cars in the same stalls', async () => {
    const a = yours.high?.list, b = yours.ultra?.list;
    expect(a && b, 'need HD and Ultra');
    expect(a.quality !== b.quality && a.count === b.count && JSON.stringify(a.kinds) === JSON.stringify(b.kinds), `${JSON.stringify(a).slice(0, 200)} vs ${JSON.stringify(b).slice(0, 200)}`);
    return `${a.count} cars, ${Object.entries(a.kinds).map(([k, v]) => `${k} ${v.n}`).join(', ')}, the same kinds and colours at '${a.quality}' and '${b.quality}'`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ what a switch leaves behind
// Low -> HD -> Ultra -> HD -> Low, twice, with the overhead pose after each switch: renderer.info.memory's textures and
// geometries (each read after two frames and a stats() call, which renders the pass, the maps and the AO pass). A
// switch disposes what it replaces: the post chain's passes and targets, the far set, the trees' instanced meshes,
// your car's geometries and its own materials, your avatar (its skeleton's bone texture and its own textures too),
// the parked cars' models and stand-ins' material; and every clock change's environment map frees the old one's render
// target. The first round leaves the game builders' caches warm (the car materials' high-quality maps, HD's palm crowns
// and canopies, the sun's map kept at Low), so the first round sets the baseline and the second must come back to it
// exactly; the first round's residue is logged. S3a: the crowd's bodies are a moving population (who's in, who's at
// LOD 1, a filler made live is a new person), so the people's own geometries (peopleGeometries(): the uploaded geometries
// of the bodies the crowd holds now, the guests', the spares' and the staff's) are read with each row and taken off the
// count; a body let go without being disposed is in none of the crowd's lists, so it stays in the rest and is caught.
if (want('memory')) {
  const { ctx, page, errors } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await check('memory: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  const read = async (q) => { await H(page, `(() => { const o = window.__onfoot; o.setQuality('${q}'); o.pose('overhead'); })()`); await frames(page, 2); const st = await H(page, 'window.__onfoot.stats()'); const people = await H(page, 'window.__onfoot.peopleGeometries ? window.__onfoot.peopleGeometries() : 0'); return { q, textures: st.textures, geometries: st.geometries - people, people, programs: st.programs }; };
  const seq = ['high', 'ultra', 'high', 'low'], rows = [await read('low')];
  for (let c = 0; c < 2; c++) for (const q of seq) rows.push(await read(q));
  summary.memory = rows;
  await check('memory: Low -> HD -> Ultra -> HD -> Low comes back to the same textures and geometries, round after round (the first round warms the game builders\' caches)', async () => {
    const start = rows[0], one = rows[4], two = rows[8];
    const txt = rows.map((r) => `${r.q} ${r.textures}t/${r.geometries}g` + (r.people ? ` (+${r.people}g people)` : '')).join(' -> ');
    for (let k = 2; k <= 4; k++) expect(rows[k + 4].textures === rows[k].textures && rows[k + 4].geometries === rows[k].geometries, `at ${rows[k].q} (step ${k}) the second round reads ${rows[k + 4].textures}t/${rows[k + 4].geometries}g, the first ${rows[k].textures}t/${rows[k].geometries}g: ${txt}`);
    expect(two.textures === one.textures && two.geometries === one.geometries, `the second round left ${two.textures - one.textures} textures and ${two.geometries - one.geometries} geometries more: ${txt}`);
    return `${txt}; the first round's residue over the start: ${one.textures - start.textures} textures, ${one.geometries - start.geometries} geometries (caches); the second round adds 0 and 0`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the phase's screenshots
if (want('shots')) {
  const SHOTS = [
    ['door', 'first', 'the door (first person)', (o) => o.pose('door')],
    ['bar', 'first', 'at the bar', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.view('first'); const p = g(16.0, 11.6); o.go(p[0], p[1]); const t = g(24, 15.6); o.look(Math.atan2(t[0] - p[0], t[1] - p[1]) * 180 / Math.PI, -6); })()`],
    ['tv', 'first', 'toward the TV wall', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.view('first'); const p = g(23.0, 6.6); o.go(p[0], p[1]); const t = g(35.8, 4.75); o.look(Math.atan2(t[0] - p[0], t[1] - p[1]) * 180 / Math.PI, 2); })()`],
    ['pool', 'first', 'at the pool tables', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.view('first'); const p = g(13.15, 9.6); o.go(p[0], p[1]); const t = g(11.0, 5.0); o.look(Math.atan2(t[0] - p[0], t[1] - p[1]) * 180 / Math.PI, -22); })()`],
    ['spawn', 'first', 'the spawn by your car', `(() => { const o = window.__onfoot, y = o.yourCar(), f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.view('first'); o.go(y.spawn.x, y.spawn.z); const t = g(6.4, 16.5); const p = o.pos(); o.look(Math.atan2(t[0] - p.x, t[1] - p.z) * 180 / Math.PI, 0); })()`],
    ['patio', 'third', 'third person on the patio', (o) => o.pose('patio')],
    ['overhead', 'overhead', 'overhead with the walls cut away', (o) => o.pose('overhead')],
    ['exterior', 'first', 'the exterior from the lot', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]], fd = (d, s) => [d * -0.932 + s * 0.362, d * 0.362 + s * 0.932]; o.view('first'); const p = g(...fd(7.6, 1.0)); o.go(p[0], p[1]); const q = o.pos(), t = g(...fd(0, 10.5)); o.look(Math.atan2(t[0] - q.x, t[1] - q.z) * 180 / Math.PI, 7); })()`],
    ['freeway', 'first', 'the I-5 from the patio rail', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.camera(null); o.view('first'); const p = g(6.0, -3.95); o.go(p[0], p[1]); const q = o.pos(), t = g(40, -70); o.look(Math.atan2(t[0] - q.x, t[1] - q.z) * 180 / Math.PI, 4); })()`],
    ['katella', 'first', 'the I-5 bridge from East Katella (a fixed camera, off the walkable area)', `(() => { const o = window.__onfoot; o.camera([-6566, 1.7, -9221, -6690, 6.5, -9250]); })()`],
    // S1's repair: the darts (the boards' faces), the neon over the restrooms (reads "+3" and the ball), the chalk
    // centre circle (a look down from 2.75 m) and the ceiling (a look up)
    ['darts', 'first', 'the darts from behind the oche', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.view('first'); const p = g(10.1, 11.4); o.go(p[0], p[1]); const q = o.pos(), t = g(10.1, 15.7); o.look(Math.atan2(t[0] - q.x, t[1] - q.z) * 180 / Math.PI, 2); })()`],
    ['neon', 'first', 'the neon over the restroom doors (a fixed camera)', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; const a = g(29.06, 7.2), b = g(29.06, 11.5); o.camera([a[0], 2.0, a[1], b[0], 2.9, b[1]]); })()`],
    ['circle', 'first', 'the chalk centre circle from above (a fixed camera at 2.75 m)', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; const a = g(33.5, 3.2), b = g(33.5, 4.75); o.camera([a[0], 2.75, a[1], b[0], 0.15, b[1]]); })()`],
    ['ceiling', 'first', 'the ceiling (looking up the room)', `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.view('first'); const p = g(14.0, 8.0); o.go(p[0], p[1]); const q = o.pos(), t = g(26, 8); o.look(Math.atan2(t[0] - q.x, t[1] - q.z) * 180 / Math.PI, 18); })()`],
  ];
  const FIXED = new Set(['katella', 'neon', 'circle']);
  const plan = [
    [[1280, 720], 'high', ['door', 'bar', 'tv', 'pool', 'spawn', 'patio', 'overhead', 'exterior', 'freeway', 'katella', 'darts', 'neon', 'circle', 'ceiling'], [12, 21]],
    [[844, 390], 'low', ['door', 'spawn', 'patio', 'overhead', 'exterior', 'freeway'], [12, 21]],
    [[390, 844], 'low', ['door', 'spawn', 'overhead'], [12, 21]],
    [[1280, 720], 'ultra', ['door', 'patio', 'exterior'], [21]],
  ];
  for (const [size, q, which, hours] of plan) {
    if (!PRESETS.includes(q)) continue;
    console.log(`shots ${size.join('x')} ${q}`);
    const { ctx, page, errors } = await open(size, `quality=${q}&ultra=1&day=Sat&hour=12&hint=0`, size[0] < 900);
    await check(`shots ${size.join('x')} ${q}: boots with no console errors`, async () => { expect(!errors.length, errors.join(' | ')); });
    if (q === 'ultra') await H(page, 'window.__onfoot.setQuality("ultra")');
    for (const hour of hours) for (const id of which) {
      const s = SHOTS.find((x) => x[0] === id);
      await check(`shots ${size.join('x')} ${q} ${hour}:00: ${s[2]}`, async () => {
        if (!FIXED.has(id)) await H(page, 'window.__onfoot.camera(null)');
        if (typeof s[3] === 'function') await H(page, `(() => { const o = window.__onfoot; (${s[3].toString()})(o); })()`); else await H(page, s[3]);
        await H(page, `window.__onfoot.setClock('Sat', ${hour})`);
        await frames(page, 1);
        const n = png(`s1-${size.join('x')}-${q}-${id}-${hour === 12 ? 'noon' : 'night'}`); await shot(page, n);
        const st = await H(page, '(() => { const o = window.__onfoot, v = o.vis(); return { state: v.state, view: v.view, yourCar: v.yourCar, near: v.parked.near }; })()');
        return `${n}: ${st.view}, ${st.state}; parked near ${st.near}, your car ${st.yourCar}`;
      });
    }
    await ctx.close().catch(() => {});
  }
}
await closeAll();

// ------------------------------------------------------------------------------------------------ Lot 57 unaffected
if (want('lot57')) {
  await check('lot57: Lot 57\'s page still builds with its own config', async () => {
    const out = execFileSync('npx', ['vite', 'build', '--config', 'src/onfoot/vite.config.ts'], { cwd: ROOT, encoding: 'utf8', timeout: 900000 });
    const m = /dist\/onfoot\/index\.html\s+([\d,.]+ kB)/.exec(out);
    return `dist/onfoot/index.html ${m ? m[1] : '(built)'}`;
  });
}
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass} of ${results.length} pass`);
save();
