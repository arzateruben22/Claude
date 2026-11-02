// Phase 1 checks for the on-foot page (PROJECT_OC_ON_FOOT.md, "Phase 1"). Drives dist/onfoot/index.html (build it
// with `npx vite build --config src/onfoot/vite.config.ts`) in headless Chromium with SwiftShader through the
// window.__onfoot hooks, and prints PASS or FAIL with the numbers each check saw. Screenshots: tests/out/onfoot/.
//
//   node tests/onfoot.mjs                     every group (desktop, landscape, portrait, actions, actions-phone, walks, names)
//   node tests/onfoot.mjs --only=walks,names  some groups
//   node tests/onfoot.mjs --walks=1000        how many random walks (default 1000)
//   node tests/onfoot.mjs --suffix=-r2        add a suffix to every screenshot's name (a re-shoot beside the old ones)
//
// One browser at a time (this machine is shared). A boot takes minutes in software rendering: be patient.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = path.join(ROOT, 'dist', 'onfoot', 'index.html');
const OUT = path.join(ROOT, 'tests', 'out', 'onfoot');
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const WALKS = Number((process.argv.find((a) => a.startsWith('--walks=')) ?? '--walks=1000').slice(8));
const want = (g) => !only.length || only.includes(g);
const SUFFIX = (process.argv.find((a) => a.startsWith('--suffix=')) ?? '--suffix=').slice(9);
const nm = (n) => n.replace(/\.png$/, `${SUFFIX}.png`);
if (!existsSync(PAGE)) { console.error(`No build at ${PAGE}. Run \`npx vite build --config src/onfoot/vite.config.ts\` first.`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const results = [];
const summary = {};
// Results are saved after every check, merged by name into tests/out/onfoot/onfoot-checks.json (a run of some groups
// keeps the other groups' last results; each result carries when it ran), so a browser that dies mid-run (this
// machine is shared) loses nothing already checked.
const CHECKS = path.join(OUT, 'onfoot-checks.json');
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
const T = 1500000;

// one browser per group (closed at the group's end), so a crash in one group doesn't take the others with it
let browser = null;
async function open(size, query, touch) {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(touch ? { viewport: { width: size[0], height: size[1] }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: size[0], height: size[1] } });
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
async function shot(page, name) { name = nm(name); await frames(page, 2); await page.screenshot({ path: path.join(OUT, name), timeout: 900000 }); return name; }
const H = (page, js) => page.evaluate(js);

/** the chip and the credit are on screen and readable */
async function hudVisible(page) {
  const h = await H(page, 'window.__onfoot.hud()'), vp = page.viewportSize();
  const inView = (r) => r && r.visible && r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.width + 1 && r.y + r.h <= vp.height + 1;
  expect(inView(h.crowd) && /Simulated crowd/.test(h.crowd.text), `crowd chip not visible: ${JSON.stringify(h.crowd)}`);
  expect(inView(h.credit) && /OpenStreetMap/.test(h.credit.text) && /Overture/.test(h.credit.text), `credit not visible: ${JSON.stringify(h.credit)}`);
  // the chip and the credit don't overlap the action button
  if (h.act?.visible) { const a = h.act, c = h.credit; expect(!(c.x < a.x + a.w && c.x + c.w > a.x && c.y < a.y + a.h && c.y + c.h > a.y), 'the credit overlaps the action button'); }
  return h;
}

// ------------------------------------------------------------------------------------------------ desktop
if (want('desktop')) {
  console.log('desktop 1280x720, High');
  const { ctx, page, errors, bootS } = await open([1280, 720], 'quality=high&day=Sat&hour=14&hint=1', false);
  await check('desktop: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); return `boot ${bootS} s`; });
  await check('desktop: day screenshot, chip and credit visible', async () => {
    const n = await shot(page, 'onfoot-1280x720-day.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopDay = s;
    await H(page, 'window.__onfoot.hint(false)');
    return `${n}: ${s.calls} calls, ${s.triangles} tris, frame ${s.frameMs} ms, sim ${s.simMs} ms`;
  });
  await check('desktop: third person in the yard', async () => {
    await H(page, "window.__onfoot.go(-5098, -8362); window.__onfoot.look(205, -10); window.__onfoot.view('third')");
    await frames(page, 4);
    const n = await shot(page, 'onfoot-1280x720-third-day.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopThird = s;
    return `${n}: avatar LOD ${s.avatar?.lod}, ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: third person from the front (your driver, the close-up body on High)', async () => {
    // a fixed camera 2.6 m in front of your driver, who faces it, the trucks and the lawn behind
    await H(page, "window.__onfoot.view('third'); window.__onfoot.go(-5084, -8366); window.__onfoot.look(270, 0); window.__onfoot.camera([-5086.6, 1.55, -8366.2, -5084, 1.15, -8366])");
    await frames(page, 4);
    const n = await shot(page, 'onfoot-1280x720-third-front-day.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopFront = s;
    await H(page, 'window.__onfoot.camera(null)');
    expect(s.avatar?.lod === 0, `the close-up body isn't showing on High: ${JSON.stringify(s.avatar)}`);
    return `${n}: avatar LOD ${s.avatar?.lod} (${s.avatar?.tris} tris, ${s.avatar?.calls} calls), ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: the food trucks by day (wheels in their arches, the cabs, the window)', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.go(-5060, -8367); window.__onfoot.look(52, -5)");
    const n = await shot(page, 'onfoot-1280x720-trucks-day.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopTrucks = s;
    return `${n}: ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: night screenshot (Sat 21:00), chip and credit visible', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.go(-5100, -8346); window.__onfoot.look(200, 8); window.__onfoot.setClock('Sat', 21)");
    const n = await shot(page, 'onfoot-1280x720-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopNight = s;
    return `${n}: ${s.crowd}, ${s.parkedCars} parked cars, ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: third person at night', async () => {
    await H(page, "window.__onfoot.go(-5108, -8380); window.__onfoot.look(150, -6); window.__onfoot.view('third')");
    const n = await shot(page, 'onfoot-1280x720-third-night.png'); await hudVisible(page);
    return n;
  });
  await check('desktop: inside the Shed at night', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.go(-5122, -8366); window.__onfoot.look(270, 0)");
    const n = await shot(page, 'onfoot-1280x720-shed-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopShed = s;
    return `${n}: ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: the food trucks at night (the kitchens lit, the menu boards readable)', async () => {
    await H(page, "window.__onfoot.go(-5065, -8355); window.__onfoot.look(95, 2)");
    const n = await shot(page, 'onfoot-1280x720-trucks-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopTrucksNight = s;
    return `${n}: ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: across Orangewood at night (walls dark, a scattering of lit windows)', async () => {
    await H(page, "window.__onfoot.go(-5085, -8404); window.__onfoot.look(188, 9)");
    const n = await shot(page, 'onfoot-1280x720-park-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopPark = s;
    return `${n}: ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: our sign at night from the Orangewood sidewalk and from the crosswalk', async () => {
    await H(page, "window.__onfoot.go(-5118, -8404); window.__onfoot.look(279, 8)");
    const n = await shot(page, 'onfoot-1280x720-sign-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopSign = s;
    await H(page, "window.__onfoot.go(-5152, -8428); window.__onfoot.look(4, 8)");
    const n2 = await shot(page, 'onfoot-1280x720-sign-crosswalk-night.png');
    return `${n}, ${n2}: ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: Ultra preset at night (shadows 4096, ambient occlusion, bloom, normal maps, the detail tier), no errors', async () => {
    const q = await H(page, "window.__onfoot.setQuality('ultra')");
    await H(page, "window.__onfoot.view('first'); window.__onfoot.go(-5070, -8370); window.__onfoot.look(49, 2)");
    const n = await shot(page, 'onfoot-1280x720-ultra-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopUltra = s;
    await H(page, "window.__onfoot.go(-5065, -8355); window.__onfoot.look(95, 2)");
    const n2 = await shot(page, 'onfoot-1280x720-ultra-trucks-night.png');
    await H(page, "window.__onfoot.go(-5122, -8366); window.__onfoot.look(270, 0)");
    const n3 = await shot(page, 'onfoot-1280x720-ultra-shed-night.png');
    await H(page, "window.__onfoot.go(-5143, -8375); window.__onfoot.look(268, -9)");
    const n4 = await shot(page, 'onfoot-1280x720-ultra-bar-night.png');
    const s4 = await H(page, 'window.__onfoot.stats()'); summary.desktopUltraBar = s4;
    await H(page, "window.__onfoot.go(-5118, -8404); window.__onfoot.look(279, 8)");
    const n5 = await shot(page, 'onfoot-1280x720-ultra-sign-night.png');
    expect(q === 'ultra' && s.quality === 'ultra' && !errors.length, `quality ${q}/${s.quality}; ${errors.join(' | ')}`);
    return `${n}, ${n2}, ${n3}, ${n4}, ${n5}: yard ${s.calls} calls, ${s.triangles} tris, frame ${s.frameMs} ms; bar ${s4.calls} calls, ${s4.triangles} tris`;
  });
  await check('desktop: Ultra at dusk: third person (the close-up body casting its own shadow), the lot (no box cars), from above', async () => {
    await H(page, "window.__onfoot.setClock('Sat', 17.5); window.__onfoot.view('third'); window.__onfoot.go(-5098, -8362); window.__onfoot.look(205, -10)");
    await frames(page, 3);
    const n = await shot(page, 'onfoot-1280x720-ultra-third-evening.png');
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopUltraThird = s;
    // the lot from the walk by the fence, the camera above the cars' roofs
    await H(page, "window.__onfoot.view('first'); window.__onfoot.go(-5096, -8336); window.__onfoot.camera([-5094, 2.6, -8337.5, -5070, 0.6, -8312])");
    const n2 = await shot(page, 'onfoot-1280x720-ultra-lot-evening.png');
    const s2 = await H(page, 'window.__onfoot.stats()'); summary.desktopUltraLot = s2;
    await H(page, "window.__onfoot.camera([-5040, 62, -8445, -5100, 0, -8352])");
    const n3 = await shot(page, 'onfoot-1280x720-aerial-evening.png');
    await H(page, "window.__onfoot.camera(null); window.__onfoot.setQuality('high'); window.__onfoot.setClock('Sat', 21)");
    expect(s.avatar?.lod === 0 && !errors.length, `avatar ${JSON.stringify(s.avatar)}; ${errors.join(' | ')}`);
    return `${n}, ${n2}, ${n3}: third person ${s.calls} calls, ${s.triangles} tris (avatar LOD ${s.avatar?.lod}, ${s.avatar?.tris} tris); lot ${s2.parkedCars} parked cars, ${s2.calls} calls, ${s2.triangles} tris`;
  });
  await check('desktop: tap a seat, walk there, sit, stand (tap to go and the action button)', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.setClock('Sat', 21)");
    const seats = await H(page, 'window.__onfoot.seats()');
    const s = seats.find((x) => x.kind === 'bench');
    await H(page, `window.__onfoot.go(${s.approach.x + 3}, ${s.approach.z + 2})`);
    const r = await H(page, `(() => { const o = window.__onfoot; const t = o.tap(${s.approach.x}, ${s.approach.z}); o.sim(12); return { t, a: o.actions(), pos: o.pos() }; })()`);
    expect(r.t && r.a[0] === 'Sit', `no Sit offered after tap to go: ${JSON.stringify(r)}`);
    const sat = await H(page, 'window.__onfoot.act()');
    const p1 = await H(page, 'window.__onfoot.pos()');
    expect(sat.did === 'sit' && p1.sitting !== null, `didn't sit: ${JSON.stringify(sat)} ${JSON.stringify(p1)}`);
    await shot(page, 'onfoot-1280x720-seated-night.png');
    const st = await H(page, 'window.__onfoot.act()');
    const p2 = await H(page, 'window.__onfoot.pos()');
    expect(st.did === 'stand' && p2.sitting === null, `didn't stand: ${JSON.stringify(st)}`);
    return `seat ${p1.sitting} (${s.at}), path ${r.t.length} m`;
  });
  await check('desktop: tap to go reaches every seat from the front gate and from the lot walk, and sits you down', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.setClock('Sat', 21)");
    const r = await H(page, `(() => { const o = window.__onfoot, seats = o.seats(), out = [];
      const starts = [{ name: 'the front gate', x: -5100, z: -8398 }, { name: 'the lot walk', x: -5105, z: -8336.5 }];
      for (const st of starts) for (const s of seats) {
        o.go(st.x, st.z);
        const p = o.tapSeat(s.id);
        if (!p) { out.push({ from: st.name, seat: s.id, at: s.at, nopath: true }); continue; }
        o.sim(p.length / 1.2 + 10, true);
        const e = o.pos();
        out.push({ from: st.name, seat: s.id, at: s.at, kind: s.kind, len: p.length, sat: e.sitting === s.id, gaveUp: e.gaveUp, end: [e.x, e.z] });
        o.act();
      }
      return out; })()`);
    const bad = r.filter((x) => !x.sat), lens = r.filter((x) => x.len).map((x) => x.len);
    summary.seats = { walks: r.length, sat: r.length - bad.length, longest: Math.max(...lens), mean: +(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1) };
    expect(!bad.length, `${bad.length} of ${r.length} didn't end seated: ${bad.slice(0, 6).map((x) => JSON.stringify(x)).join(' | ')}`);
    return `${r.length} walks (${r.length / 2} seats x 2 starts), all seated; paths ${Math.min(...lens).toFixed(1)} to ${Math.max(...lens).toFixed(1)} m, mean ${summary.seats.mean} m`;
  });
  await check('desktop: reduced motion turns off head bob and transitions', async () => {
    await H(page, 'window.__onfoot.reducedMotion(false); window.__onfoot.go(-5104, -8337)');
    const bob = await H(page, 'window.__onfoot.bobRange()');
    const rm = await H(page, 'window.__onfoot.reducedMotion(true)');
    await H(page, 'window.__onfoot.go(-5104, -8337)');
    const bob2 = await H(page, 'window.__onfoot.bobRange()');
    const css = await H(page, "getComputedStyle(document.getElementById('toast')).transitionDuration");
    expect(bob > 0.015 && bob2 === 0 && rm.transitionsOff && /^0s/.test(css), `bob ${bob} -> ${bob2}, transitions ${css}`);
    await H(page, 'window.__onfoot.reducedMotion(false)');
    return `head bob ${(bob * 100).toFixed(1)} cm -> ${bob2} cm; toast transition ${css}`;
  });
  await check('desktop: the test hooks are all there, and stats() reports every listed field', async () => {
    const r = await H(page, `(() => { const o = window.__onfoot, s = o.stats();
      return { fns: ['setClock', 'setQuality', 'stats', 'go', 'tap', 'act', 'view'].filter((k) => typeof o[k] !== 'function'),
        frames: typeof o.frames === 'number' && o.frames > 0 ? o.frames : null,
        missing: ['npcs', 'groups', 'seated', 'walkers', 'drawCalls', 'triangles', 'simMs', 'frameMs'].filter((k) => typeof s[k] !== 'number'), s }; })()`);
    expect(!r.fns.length && r.frames && !r.missing.length, `missing hooks ${r.fns.join(', ')}; frames ${r.frames}; missing stats ${r.missing.join(', ')}`);
    const s = r.s;
    return `frames ${r.frames}; npcs ${s.npcs}, groups ${s.groups}, seated ${s.seated}, walkers ${s.walkers}, draw calls ${s.drawCalls}, triangles ${s.triangles}, sim ${s.simMs} ms, frame ${s.frameMs} ms`;
  });
  await check('desktop: at closing the gate shuts and you are shown out to the lot; the hours say so', async () => {
    await H(page, "window.__onfoot.setClock('Sat', 21); window.__onfoot.go(-5098, -8362)");
    const r = await H(page, `(() => { const o = window.__onfoot; const c = o.setClock('Tue', 9); return { c, pos: o.pos(), hours: document.getElementById('hours').textContent, crowd: document.getElementById('crowdText').textContent, toast: o.toast(), tapIn: o.tap(-5098, -8362) }; })()`);
    expect(!r.c.open && r.pos.z > -8340 && /Closed/.test(r.hours) && /Closed/.test(r.crowd), JSON.stringify(r));
    // a tap into the yard from the lot finds no way in (the gates are shut), or ends outside the fence
    const end = r.tapIn ? r.tapIn.waypoints[r.tapIn.waypoints.length - 1] : null;
    expect(!end || end.z > -8340, `a path into the closed yard: ${JSON.stringify(r.tapIn)}`);
    await H(page, "window.__onfoot.setClock('Sat', 21)");
    return `Tue 09:00: at ${r.pos.x}, ${r.pos.z} (the lot walk), "${r.hours}", "${r.crowd}", toast "${r.toast}", tap into the yard: ${r.tapIn ? 'stops outside' : 'no path'}`;
  });
  await check('desktop: High preset within 350 draw calls and 700k triangles (shadow passes included) in the views shot above', async () => {
    const keys = ['desktopDay', 'desktopThird', 'desktopFront', 'desktopTrucks', 'desktopNight', 'desktopShed', 'desktopTrucksNight', 'desktopPark', 'desktopSign'];
    const v = keys.map((k) => [k, summary[k]]).filter(([, x]) => x);
    const worst = v.reduce((w, [, x]) => ({ calls: Math.max(w.calls, x.calls), triangles: Math.max(w.triangles, x.triangles) }), { calls: 0, triangles: 0 });
    summary.highWorst = worst;
    expect(v.length === keys.length && worst.calls <= 350 && worst.triangles <= 700000, `worst ${worst.calls} calls, ${worst.triangles} triangles: ${v.map(([k, x]) => `${k} ${x.calls}/${x.triangles}`).join(', ')}`);
    return v.map(([k, x]) => `${k} ${x.calls}/${Math.round(x.triangles / 1000)}k`).join(', ');
  });
  await ctx.close().catch(() => {}); await browser?.close().catch(() => {}); browser = null;
}

// ------------------------------------------------------------------------------------------------ phones
for (const [g, size, label] of [['landscape', [844, 390], '844x390'], ['portrait', [390, 844], '390x844']]) {
  if (!want(g)) continue;
  console.log(`phone ${label}, touch (the default preset for a coarse pointer)`);
  const { ctx, page, errors, bootS } = await open(size, 'day=Sat&hour=14&hint=1', true);
  await check(`${label}: boots with no console errors`, async () => { expect(!errors.length, errors.join(' | ')); const s = await H(page, 'window.__onfoot.stats()'); return `boot ${bootS} s, quality ${s.quality}`; });
  await check(`${label}: day screenshot, chip and credit visible`, async () => { const n = await shot(page, `onfoot-${label}-day.png`); await hudVisible(page); const s = await H(page, 'window.__onfoot.stats()'); summary[`${label}Day`] = s; await H(page, 'window.__onfoot.hint(false)'); return `${n}: ${s.calls} calls, ${s.triangles} tris`; });
  await check(`${label}: night screenshot, chip and credit visible`, async () => {
    await H(page, "window.__onfoot.go(-5100, -8346); window.__onfoot.look(200, 8); window.__onfoot.setClock('Sat', 21)");
    const n = await shot(page, `onfoot-${label}-night.png`); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary[`${label}Night`] = s; return `${n}: ${s.calls} calls, ${s.triangles} tris`;
  });
  if (g === 'landscape') await check('844x390: our sign at night from the Orangewood sidewalk (Low)', async () => {
    await H(page, "window.__onfoot.go(-5118, -8404); window.__onfoot.look(279, 8)");
    const n = await shot(page, 'onfoot-844x390-sign-night.png'); await hudVisible(page);
    return n;
  });
  if (g === 'landscape') {
    const ptr = (t, id, x, y) => `(() => { const c = document.getElementById('view'); (${JSON.stringify(t)} === 'pointerdown' ? c : window).dispatchEvent(new PointerEvent(${JSON.stringify(t)}, { pointerId: ${id}, pointerType: 'touch', clientX: ${x}, clientY: ${y}, bubbles: true, isPrimary: true })); })()`;
    await check('844x390: the thumb pad walks you, a look drag turns you, a quick tap walks you there', async () => {
      await H(page, "window.__onfoot.go(-5104, -8337); window.__onfoot.look(180, 0)");
      const p0 = await H(page, 'window.__onfoot.pos()');
      await H(page, ptr('pointerdown', 11, 120, 300)); await H(page, ptr('pointermove', 11, 120, 280)); await H(page, ptr('pointermove', 11, 120, 236));
      await frames(page, 6);
      const p1 = await H(page, 'window.__onfoot.pos()'), stickShown = await H(page, "getComputedStyle(document.getElementById('stick')).display");
      await H(page, ptr('pointerup', 11, 120, 236));
      const walked = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      expect(walked > 0.3 && p1.z < p0.z - 0.2 && stickShown === 'block', `thumb pad: moved ${walked.toFixed(2)} m from ${JSON.stringify(p0)} to ${JSON.stringify(p1)}, stick ${stickShown}`);
      await H(page, ptr('pointerdown', 12, 700, 200)); await H(page, ptr('pointermove', 12, 670, 200)); await H(page, ptr('pointermove', 12, 640, 200));
      await frames(page, 2);
      await H(page, ptr('pointerup', 12, 640, 200));
      const p2 = await H(page, 'window.__onfoot.pos()');
      const turned = Math.atan2(Math.sin(p2.yaw - p1.yaw), Math.cos(p2.yaw - p1.yaw));
      expect(Math.abs(turned) > 0.2, `look drag turned ${turned.toFixed(3)} rad`);
      await H(page, "window.__onfoot.look(180, -12)"); await frames(page, 1);
      await H(page, `(() => { ${ptr('pointerdown', 13, 422, 300)}; ${ptr('pointerup', 13, 422, 300)}; })()`);
      await frames(page, 2);
      const p3 = await H(page, 'window.__onfoot.pos()');
      expect(p3.moving || Math.hypot(p3.x - p2.x, p3.z - p2.z) > 0.2, `tap didn't start a walk: ${JSON.stringify(p3)}`);
      return `thumb pad ${walked.toFixed(2)} m north, look drag ${(turned * 180 / Math.PI).toFixed(0)} deg, tap to go ${p3.moving ? 'walking' : 'arrived'}`;
    });
    await check('844x390: the keyboard walks you (W) and a gamepad walks you (left stick) and switches the view (Y)', async () => {
      await H(page, "window.__onfoot.go(-5104, -8337); window.__onfoot.look(180, 0); window.__onfoot.view('first')");
      const p0 = await H(page, 'window.__onfoot.pos()');
      await page.keyboard.down('w'); await frames(page, 10); await page.keyboard.up('w');
      const p1 = await H(page, 'window.__onfoot.pos()');
      const kb = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      expect(kb > 0.2 && p1.z < p0.z, `W moved ${kb.toFixed(2)} m`);
      await H(page, `(() => { const btn = () => Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
        window.__pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, -1, 0, 0], buttons: btn() };
        navigator.getGamepads = () => [window.__pad]; })()`);
      await frames(page, 5);
      const p2 = await H(page, 'window.__onfoot.pos()');
      await H(page, 'window.__pad.axes = [0, 0, 0, 0]; window.__pad.buttons[3] = { pressed: true, touched: true, value: 1 }');
      await frames(page, 2);
      const v = await H(page, 'window.__onfoot.pos().view');
      await H(page, 'window.__pad.buttons[3] = { pressed: false, touched: false, value: 0 }'); await frames(page, 1);
      await H(page, "navigator.getGamepads = () => []; window.__onfoot.view('first')");
      const pad = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      expect(pad > 0.2 && p2.z < p1.z && v === 'third', `pad moved ${pad.toFixed(2)} m, view after Y ${v}`);
      return `W ${kb.toFixed(2)} m, left stick ${pad.toFixed(2)} m, Y switched to ${v} person`;
    });
    await check('Low preset: within 150 draw calls and 250k triangles in the busiest views', async () => {
      const views = [[-5104, -8337, 185, 4], [-5104, -8337, 0, -10], [-5150, -8300, 110, 0], [-5040, -8270, 300, -2], [-5100, -8405, 0, 0], [-5098, -8362, 205, -10]];
      let worst = { calls: 0, triangles: 0 }; const seen = [];
      for (const [x, z, yaw, pitch] of views) {
        await H(page, `window.__onfoot.go(${x}, ${z}); window.__onfoot.look(${yaw}, ${pitch})`);
        await frames(page, 2);
        const s = await H(page, 'window.__onfoot.stats()');
        seen.push(`${s.calls}/${Math.round(s.triangles / 1000)}k`);
        worst = { calls: Math.max(worst.calls, s.calls), triangles: Math.max(worst.triangles, s.triangles) };
      }
      await H(page, "window.__onfoot.view('third')"); await frames(page, 2);
      const s3 = await H(page, 'window.__onfoot.stats()'); seen.push(`third ${s3.calls}/${Math.round(s3.triangles / 1000)}k`);
      worst = { calls: Math.max(worst.calls, s3.calls), triangles: Math.max(worst.triangles, s3.triangles) };
      await H(page, "window.__onfoot.view('first')");
      summary.lowWorst = worst;
      expect(worst.calls <= 150 && worst.triangles <= 250000, `worst ${worst.calls} calls, ${worst.triangles} triangles (views: ${seen.join(', ')})`);
      return `worst ${worst.calls} calls, ${worst.triangles} triangles (calls/tris per view: ${seen.join(', ')})`;
    });
  }
  await ctx.close().catch(() => {}); await browser?.close().catch(() => {}); browser = null;
}

// ------------------------------------------------------------------------------------------------ P1b: things to do
// Tap to go, Sit and Stand, Order and Pick up (and hold), Join and Leave, and nothing done through a wall. The line
// test is checked independently here in Node, against the exported colliders, as the walk checker does.
const SIGHT = new Set(['wall', 'fence', 'gate', 'glass', 'door', 'building', 'truck', 'tank', 'sign', 'cage', 'generator']);
const isBlocker = (c) => SIGHT.has(c.tag) || (c.tall && !(c.k === 'circ' && c.r < 0.5));
function sightChecker(cols) {
  const bl = cols.filter(isBlocker);
  const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  const cross = (ax, az, bx, bz, cx, cz, dx, dz) => { const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax), d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx); return d1 * d2 < 0 && d3 * d4 < 0; };
  const segSeg = (ax, az, bx, bz, cx, cz, dx, dz) => cross(ax, az, bx, bz, cx, cz, dx, dz) ? 0 : Math.min(segD(ax, az, cx, cz, dx, dz), segD(bx, bz, cx, cz, dx, dz), segD(cx, cz, ax, az, bx, bz), segD(dx, dz, ax, az, bx, bz));
  const inPoly = (x, z, P) => { let ins = false; for (let i = 0, j = P.length / 2 - 1; i < P.length / 2; j = i++) { const xi = P[i * 2], zi = P[i * 2 + 1], xj = P[j * 2], zj = P[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
  /** what blocks the straight line a to b (null if nothing): a wall, fence, glass, door, truck, tank or building */
  return (ax, az, bx, bz) => {
    const x0 = Math.min(ax, bx) - 1, x1 = Math.max(ax, bx) + 1, z0 = Math.min(az, bz) - 1, z1 = Math.max(az, bz) + 1;
    for (const c of bl) {
      if (c.k === 'circ') { if (c.x < x0 - c.r || c.x > x1 + c.r || c.z < z0 - c.r || c.z > z1 + c.r) continue; if (segD(c.x, c.z, ax, az, bx, bz) < c.r - 1e-3) return c.tag; continue; }
      if (c.k === 'seg') { if (Math.max(c.ax, c.bx) < x0 || Math.min(c.ax, c.bx) > x1 || Math.max(c.az, c.bz) < z0 || Math.min(c.az, c.bz) > z1) continue; if (segSeg(ax, az, bx, bz, c.ax, c.az, c.bx, c.bz) < c.r - 1e-3) return c.tag; continue; }
      const P = c.pts, n = P.length / 2; let px0 = Infinity, px1 = -Infinity, pz0 = Infinity, pz1 = -Infinity;
      for (let i = 0; i < n; i++) { px0 = Math.min(px0, P[i * 2]); px1 = Math.max(px1, P[i * 2]); pz0 = Math.min(pz0, P[i * 2 + 1]); pz1 = Math.max(pz1, P[i * 2 + 1]); }
      if (px1 < x0 || px0 > x1 || pz1 < z0 || pz0 > z1) continue;
      if (inPoly(ax, az, P) || inPoly(bx, bz, P)) return c.tag;
      for (let a = 0, b = n - 1; a < n; b = a++) if (cross(ax, az, bx, bz, P[b * 2], P[b * 2 + 1], P[a * 2], P[a * 2 + 1])) return c.tag;
    }
    return null;
  };
}
/** every offer the page makes over a 0.5 m grid round the venue (seats, counters, groups), at a stretch of the reach */
async function offersAt(page, k) {
  return H(page, `(() => { const o = window.__onfoot; o.reach(${k}); const out = [];
    for (let x = -5156; x <= -5040; x += 0.5) for (let z = -8406; z <= -8330; z += 0.5) { const f = o.offerAt(x, z); if (!f.free) continue; out.push([x, z, f.seat, f.counter, f.group]); }
    o.reach(1); return out; })()`);
}
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** let the world run (unrendered, 0.5 s at a time) until a condition on the hooks holds; returns the hooks' state then */
async function until(page, cond, maxS = 15) {
  return H(page, `(() => { const o = window.__onfoot; for (let t = 0; t < ${maxS}; t += 0.5) { if (${cond}) return { ok: true, t, st: o.state(), talk: o.talk() }; o.sim(0.5, false, true); } return { ok: ${cond}, t: ${maxS}, st: o.state(), talk: o.talk() }; })()`);
}

/** (in page code) step the world until the order is ready, at most maxS seconds: the make's 4 to 8 s start only once
 *  the bartender or cook has reached the taps or the flat-top, so a fixed wait of the make's length can come up short */
const untilReady = (maxS = 30) => `for (let w = 0; w < ${maxS} && window.__onfoot.state().order?.stage !== 'ready'; w += 0.25) window.__onfoot.sim(0.25, false, true);`;

if (want('actions')) {
  console.log('P1b actions at 1280x720, High');
  const { ctx, page, errors, bootS } = await open([1280, 720], 'quality=high&day=Sat&hour=21&hint=0', false);
  const S = 'onfoot-1280x720-act-';
  await check('actions 1280x720: boots with the regulars and the staff, no console errors', async () => {
    const s = await H(page, 'window.__onfoot.stats()'); summary.actStats = s;
    expect(!errors.length && s.npcs === 9 && s.groups === 2 && s.staff === 3, `${errors.join(' | ')}; npcs ${s.npcs}, groups ${s.groups}, staff ${s.staff}`);
    return `boot ${bootS} s; npcs ${s.npcs} (groups ${s.groups}, staff ${s.staff}), built in ${s.crowdBuildMs} ms`;
  });
  await check('actions 1280x720: a tap on the ground walks a path round the tables, shown as dots', async () => {
    // from beside a table in the yard's north row to a point beyond it: the straight line runs through the table
    await H(page, `window.__onfoot.view('first'); window.__onfoot.go(-5116, -8388); window.__onfoot.look(${Math.atan2(-5096 + 5116, -8372 + 8388) * 180 / Math.PI}, -16)`);
    await frames(page, 2);
    const px = await H(page, 'window.__onfoot.project(-5096, 0, -8372)');
    expect(px && px.x > 0 && px.x < 1280 && px.y > 0 && px.y < 720, `the target is off screen: ${JSON.stringify(px)}`);
    const t = await H(page, `window.__onfoot.tapScreen(${px.x}, ${px.y})`);
    const lt = await H(page, 'window.__onfoot.lastTap()');
    expect(t && t.waypoints >= 3 && lt.kind === 'ground' && lt.moving, `tap: ${JSON.stringify(t)} ${JSON.stringify(lt)}`);
    const n = await shot(page, S + 'tap-to-go.png');
    const r = await H(page, 'window.__onfoot.sim(30, true).end');
    expect(Math.hypot(r.x + 5096, r.z + 8372) < 0.7, `ended at ${r.x}, ${r.z}`);
    return `${n}: ${t.waypoints} waypoints round the tables, arrived at ${r.x}, ${r.z}`;
  });
  await check('actions 1280x720: Sit and Stand at every kind of seat (bench, picnic table, lawn chair, bar stool, high-top) with the action button', async () => {
    const seats = await H(page, 'window.__onfoot.seats()'), done = [];
    for (const kind of ['bench', 'picnic', 'lawn', 'stool', 'hightop']) {
      const s = seats.filter((x) => x.kind === kind)[3] ?? seats.find((x) => x.kind === kind);
      const r = await H(page, `(() => { const o = window.__onfoot; o.go(${s.approach.x}, ${s.approach.z}); const t = o.target(); const a = o.press('Sit'); const p = o.pos(); return { t, a, p }; })()`);
      expect(r.t.actions.includes('Sit') && r.a.did === 'sit' && r.p.sitting !== null, `${kind}: ${JSON.stringify(r)}`);
      if (kind === 'bench') { await H(page, "window.__onfoot.view('third')"); const n = await shot(page, S + 'sit.png'); await H(page, "window.__onfoot.view('first')"); done.push(n); }
      const st = await H(page, `(() => { const o = window.__onfoot; const t = o.target(); const a = o.press('Stand'); return { t, a, p: o.pos() }; })()`);
      expect(st.t.actions[0] === 'Stand' && st.a.did === 'stand' && st.p.sitting === null, `${kind} stand: ${JSON.stringify(st)}`);
      done.push(`${kind} seat ${r.p.sitting} (${s.at})${kind === 'stool' ? `, actions seated ${JSON.stringify(r.a.now)}` : ''}`);
    }
    return done.join('; ');
  });
  await check('actions 1280x720: a tap on a seat on screen walks there and sits you down', async () => {
    const seats = await H(page, 'window.__onfoot.seats()'), s = seats.find((x) => x.kind === 'bench' && x.at === 'table 6');
    await H(page, `window.__onfoot.go(${s.x - 4.5}, ${s.z + 3.5}); window.__onfoot.look(${Math.atan2(4.5, -3.5) * 180 / Math.PI}, -18)`);
    await frames(page, 2);
    const px = await H(page, `window.__onfoot.project(${s.x}, 0.62, ${s.z})`);
    const t = await H(page, `window.__onfoot.tapScreen(${px.x}, ${px.y})`), lt = await H(page, 'window.__onfoot.lastTap()');
    const e = await H(page, 'window.__onfoot.sim(20, true).end');
    expect(lt.kind === 'seat' && e.sitting === lt.id, `tap ${JSON.stringify(t)} ${JSON.stringify(lt)}, ended ${JSON.stringify(e)}`);
    await H(page, "window.__onfoot.press('Stand')");
    return `tapped seat ${lt.id} (${s.at}) at pixel ${px.x}, ${px.y}: walked ${t.waypoints - 1} legs and sat`;
  });
  await check('actions 1280x720: Order at the bar (five items, made in 4 to 8 s, set on the counter), Pick up, then hold it (first and third person)', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.go(-5144.2, -8372); window.__onfoot.look(270, -10)");
    const t = await H(page, 'window.__onfoot.target()');
    expect(t.actions[0] === 'Order' && t.counter === 'bar', `at the bar: ${JSON.stringify(t)}`);
    const o = await H(page, "window.__onfoot.press('Order')"), sh = await H(page, 'window.__onfoot.sheet()');
    expect(o.did === 'order' && sh.open && sh.items.length === 5 && /bar/.test(sh.title), `sheet: ${JSON.stringify(sh).slice(0, 300)}`);
    const n1 = await shot(page, S + 'order-sheet.png');
    const btn = await page.evaluate(() => Array.from(document.querySelectorAll('#menuItems button')).map((b) => b.getBoundingClientRect().height));
    expect(Math.min(...btn) >= 56, `item buttons ${btn.join(', ')} px tall`);
    await page.click('#menuItems button[data-item="fizz"]');
    await frames(page, 1);
    const m0 = await H(page, 'window.__onfoot.state()');
    expect(m0.order?.stage === 'making' && m0.order.dur >= 4 && m0.order.dur <= 8 && !m0.sheet && /Pouring/.test(m0.status), `making: ${JSON.stringify(m0)}`);
    await H(page, 'window.__onfoot.sim(2.5, false, true)');
    const n2 = await shot(page, S + 'making.png');
    const staffAt = (await H(page, 'window.__onfoot.npcs()')).find((x) => x.role === 'bartender');
    await H(page, `(() => { ${untilReady()} })()`);
    const m1 = await H(page, 'window.__onfoot.state()');
    expect(m1.order?.stage === 'ready' && m1.order.served && m1.actions[0] === 'Pick up', `ready: ${JSON.stringify(m1)}`);
    const n3 = await shot(page, S + 'ready.png');
    const p = await H(page, "window.__onfoot.press('Pick up')"), m2 = await H(page, 'window.__onfoot.state()');
    expect(p.did === 'pickup' && m2.held?.id === 'fizz' && !m2.order, `pick up: ${JSON.stringify(m2)}`);
    await frames(page, 2);
    const m3 = await H(page, 'window.__onfoot.state()');
    expect(m3.held.first && /Holding/.test(m3.status), `held in first person: ${JSON.stringify(m3)}`);
    const n4 = await shot(page, S + 'holding.png'); summary.actHolding = await H(page, 'window.__onfoot.stats()');
    // third person, from the front: in your avatar's right hand
    await H(page, "window.__onfoot.view('third'); window.__onfoot.go(-5084, -8366); window.__onfoot.look(270, 0); window.__onfoot.camera([-5085.9, 1.45, -8366.3, -5084, 1.1, -8366])");
    await frames(page, 4);
    const hand = await H(page, 'window.__onfoot.inHand()'), m4 = await H(page, 'window.__onfoot.state()');
    const mine = hand.find((x) => x.who === 'you');
    expect(m4.held.third && mine && mine.d < 0.12, `third person: ${JSON.stringify(m4.held)} hand ${JSON.stringify(mine)}`);
    const n5 = await shot(page, S + 'holding-third.png'); summary.actHoldingThird = await H(page, 'window.__onfoot.stats()');
    await H(page, "window.__onfoot.camera(null); window.__onfoot.view('first')");
    return `${n1}, ${n2}, ${n3}, ${n4}, ${n5}: bartender went to the taps at ${staffAt.x}, ${staffAt.z}; a ${m0.order.dur} s make; cup ${mine.d} m from your right hand`;
  });
  await check('actions 1280x720: Order at both trucks (the cook turns to the flat-top and back), Pick up replaces what you held', async () => {
    const out = [];
    for (const [id, item] of [['tacos', 'birria'], ['noodles', 'garlic']]) {
      const c = (await H(page, 'window.__onfoot.counters()')).find((x) => x.id === id);
      const r = await H(page, `(() => { const o = window.__onfoot; o.go(${c.stand.x}, ${c.stand.z}); o.look(90, -8); const t = o.target(); const a = o.press('Order'); const p = o.pick('${item}'); o.sim(2.5, false, true); const cook = o.npcs().filter((n) => n.role === 'cook')[${id === 'tacos' ? 0 : 1}]; ${untilReady()} return { t, a, p, cook, s2: o.state() }; })()`);
      expect(r.t.counter === id && r.a.did === 'order' && r.p && r.s2.order?.stage === 'ready', `${id}: ${JSON.stringify(r).slice(0, 600)}`);
      if (id === 'tacos') out.push(await shot(page, S + 'ready-truck.png'));
      const pu = await H(page, "(() => { const o = window.__onfoot; const p = o.press('Pick up'); return { p, s: o.state() }; })()");
      expect(pu.p.did === 'pickup' && pu.s.held?.id === item, `${id} pick up: ${JSON.stringify(pu)}`);
      out.push(`${id}: ${item} held (the cook at the line at ${r.cook.x})`);
    }
    out.push(await shot(page, S + 'holding-noodles.png'));
    return out.join('; ');
  });
  await check('actions 1280x720: from a bar stool, Order is the second button; the order comes to you and you pick it up seated', async () => {
    const seats = await H(page, 'window.__onfoot.seats()'), s = seats.filter((x) => x.kind === 'stool')[8];
    // (the make's 4 to 8 s start once the bartender is at the taps: wait for ready, at most 30 s)
    const r = await H(page, `(() => { const o = window.__onfoot; o.go(${s.approach.x}, ${s.approach.z}); o.press('Sit'); const a = o.target(); const b = o.press('Order'); const p = o.pick('hazy'); for (let w = 0; w < 30 && o.state().order?.stage !== 'ready'; w += 0.25) o.sim(0.25, false, true); const t = o.target(); const u = o.press('Pick up'); return { a, b, p, t, u, st: o.state(), pos: o.pos() }; })()`);
    expect(r.a.actions[0] === 'Stand' && r.a.actions[1] === 'Order' && r.b.did === 'order' && r.t.actions[0] === 'Pick up' && r.u.did === 'pickup' && r.st.held?.id === 'hazy' && r.pos.sitting === s.id, JSON.stringify(r).slice(0, 700));
    const n = await shot(page, S + 'seated-holding.png');
    await H(page, "window.__onfoot.press('Stand')");
    return `${n}: stool ${s.id}: ${JSON.stringify(r.a.actions)} -> order -> ${JSON.stringify(r.t.actions)} -> holding ${r.st.held.name}, still seated`;
  });
  await check('actions 1280x720: from either end of the bar (stools 0 and 19), the bartender walks down first; the order is ready only once they are back at the counter by it', async () => {
    const stools = (await H(page, 'window.__onfoot.seats()')).filter((x) => x.kind === 'stool'), out = [];
    for (const k of [0, 19]) {
      const s = stools[k];
      // order from the stool, then step the world 0.1 s at a time until it's ready: where's the bartender then?
      const r = await H(page, `(() => { const o = window.__onfoot; o.go(${s.approach.x}, ${s.approach.z}); o.press('Sit'); o.sim(4, false, true);
        const bt = () => o.npcs().find((n) => n.role === 'bartender'), b0 = bt(), a = o.press('Order'), p = o.pick('agua');
        let t = 0, started = null;
        while (t < 40) {
          o.sim(0.1, false, true); t += 0.1;
          const st = o.state(), b = bt();
          if (started === null && st.order && st.order.t > 0) started = { t: +t.toFixed(1), walked: +Math.hypot(b.x - b0.x, b.z - b0.z).toFixed(2) };
          // (the served item's position is in the page's local metres: shifted to game coordinates as npcs() reports them)
          if (st.order?.stage === 'ready') { const P = o.pos(), v = { x: st.order.served.x + P.x - P.lx, z: st.order.served.z + P.z - P.lz }; return { a, p, t: +t.toFixed(1), dur: st.order.dur, started, b0, b, v, d: +Math.hypot(b.x - v.x, b.z - v.z).toFixed(3), dz: +Math.abs(b.z - v.z).toFixed(3), pos: P }; }
        }
        return { a, p, t, never: true, st: o.state() }; })()`);
      expect(r.a.did === 'order' && r.p && !r.never && r.started && r.dz < 0.3 && r.d <= 1.05 && r.t >= r.started.t + r.dur - 0.25, `stool ${s.id}: ${JSON.stringify(r).slice(0, 700)}`);
      const u = await H(page, "(() => { const o = window.__onfoot; const u = o.press('Pick up'); const st = o.state(); o.press('Stand'); return { u, held: st.held }; })()");
      expect(u.u.did === 'pickup' && u.held?.id === 'agua', `stool ${s.id} pick up: ${JSON.stringify(u)}`);
      out.push(`stool ${s.id}: the bartender walked ${r.started.walked} m and started at ${r.started.t} s, ready at ${r.t} s (a ${r.dur} s make) with them ${r.d} m from the cup across the counter (${r.dz} m along it)`);
    }
    return out.join('; ');
  });
  await check('actions 1280x720: Join the yard group: the circle opens a gap where you stand, they turn to you, a short conversation (two exchanges), they wrap up; then Leave', async () => {
    const g0 = (await H(page, 'window.__onfoot.groups()'))[0];
    await H(page, `window.__onfoot.view('first'); window.__onfoot.go(${g0.x}, ${g0.z + 2.4}); window.__onfoot.look(180, -4)`);
    const t = await H(page, 'window.__onfoot.target()');
    expect(t.actions.includes('Join') && t.group === 0, `near the group: ${JSON.stringify(t)}`);
    const j = await H(page, "(() => { const o = window.__onfoot; const a = o.press('Join'); o.sim(10, true, true); o.sim(2.4, false, true); return { a, st: o.state(), talk: o.talk(), g: o.groups()[0], pos: o.pos() }; })()");
    expect(j.a.did === 'join' && j.st.joined === 0 && j.talk && j.talk.stage === 'reply' && j.st.replies && j.st.caption, `joined: ${JSON.stringify(j).slice(0, 900)}`);
    // the gap: your angle round the centre is clear, the members spaced evenly round the rest
    const you = Math.atan2(j.pos.x - j.g.x, j.pos.z - j.g.z), n = j.g.members.length;
    const gaps = j.g.members.map((m) => Math.abs(ang(Math.atan2(m.x - j.g.x, m.z - j.g.z) - you)));
    expect(Math.min(...gaps) > 0.8 * (2 * Math.PI / (n + 1)), `members too close to your slot: ${gaps.map((x) => (x * 180 / Math.PI).toFixed(0)).join(', ')} deg`);
    const n1 = await shot(page, S + 'joined.png');
    const h1 = await H(page, 'window.__onfoot.hud()');
    const chips = await page.evaluate(() => ['caption', 'chips', 'act'].map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { id, x: b.x, y: b.y, w: b.width, h: b.height }; }));
    const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    expect(!ov(chips[0], chips[1]) && !ov(chips[1], chips[2]), `caption, chips and button overlap: ${JSON.stringify(chips)}`);
    await page.click('#reply0');
    const t2 = (await until(page, "o.talk()?.n === 1 && o.talk()?.stage === 'reply'", 15)).talk;
    expect(t2.n === 1 && t2.stage === 'reply' && t2.replies, `after the first reply: ${JSON.stringify(t2)}`);
    await H(page, "window.__onfoot.view('third')");
    const n2 = await shot(page, S + 'joined-third.png'); summary.actJoinedThird = await H(page, 'window.__onfoot.stats()');
    await H(page, "window.__onfoot.view('first')");
    await page.click('#reply1');
    const w3 = await until(page, "o.talk()?.stage === 'done'", 20), t3 = w3.talk, st3 = w3.st;
    expect(t3.stage === 'done' && t3.n === 2 && /Drive safe/.test(t3.log[t3.log.length - 1].text) && !st3.replies && st3.actions[0] === 'Leave', `wrap-up: ${JSON.stringify(t3)}`);
    const l = await H(page, "(() => { const o = window.__onfoot; const a = o.press('Leave'); o.sim(5, false, true); return { a, st: o.state(), g: o.groups()[0], pos: o.pos() }; })()");
    const home = l.g.members.map((m) => Math.hypot(m.x - j.g.x, m.z - j.g.z));
    expect(l.a.did === 'leave' && l.st.joined === null && Math.hypot(l.pos.x - l.g.x, l.pos.z - l.g.z) > l.g.r + 0.8, `leave: ${JSON.stringify(l).slice(0, 600)}`);
    const n3 = await shot(page, S + 'left.png');
    return `${n1}, ${n2}, ${n3}: gap ${(Math.min(...gaps) * 180 / Math.PI).toFixed(0)} deg either side; ${t3.log.map((x) => `${x.who}: "${x.text}"`).join(' / ')}; left to ${Math.hypot(l.pos.x - l.g.x, l.pos.z - l.g.z).toFixed(2)} m from the centre; members ${home.map((x) => x.toFixed(2)).join(', ')} m out`;
  });
  await check('actions 1280x720: Join the lawn group by tapping one of them on screen, Leave mid-conversation (they say goodbye, the circle closes)', async () => {
    const g1 = (await H(page, 'window.__onfoot.groups()'))[1], m = g1.members[0];
    await H(page, `window.__onfoot.go(${g1.x - 4}, ${g1.z}); window.__onfoot.look(90, -6)`);
    await frames(page, 2);
    const px = await H(page, `window.__onfoot.project(${m.x}, 1.2, ${m.z})`);
    await H(page, `window.__onfoot.tapScreen(${px.x}, ${px.y})`);
    const lt = await H(page, 'window.__onfoot.lastTap()');
    await H(page, 'window.__onfoot.sim(8, true)');
    const t = await H(page, 'window.__onfoot.target()');
    expect(lt.kind === 'group' && lt.id === 1 && t.actions[0] === 'Join', `tap ${JSON.stringify(lt)}, then ${JSON.stringify(t)}`);
    const r = await H(page, "(() => { const o = window.__onfoot; o.press('Join'); o.sim(10, true, true); o.sim(2.4, false, true); const a = o.talk(); const l = o.press('Leave'); const cap = o.state().caption; o.sim(5, false, true); return { a, l, cap, st: o.state(), g: o.groups()[1] }; })()");
    expect(r.a?.stage === 'reply' && r.l.did === 'leave' && r.st.joined === null && /Later|See you|Take care/.test(r.cap), JSON.stringify(r).slice(0, 700));
    return `tapped ${m.name} at pixel ${px.x}, ${px.y}; joined, "${r.a.caption.text}"; left mid-conversation: "${r.cap}"`;
  });
  await check('actions 1280x720: in the yard circle, a tap on one of the lawn group walks you all the way to them (you leave the yard circle on the way) and Join is offered there', async () => {
    const gs = await H(page, 'window.__onfoot.groups()'), g0 = gs[0], g1 = gs[1];
    let got = null;
    for (const m of g1.members) {
      // join the yard group from its east side (facing the lawn), then look at one of the lawn group and tap them
      const j = await H(page, `(() => { const o = window.__onfoot; o.view('first'); o.go(${g0.x + 2.4}, ${g0.z}); o.look(270, -4); const a = o.press('Join'); o.sim(10, true, true); o.sim(1, false, true); return { a, st: o.state(), pos: o.pos() }; })()`);
      expect(j.a.did === 'join' && j.st.joined === 0, `join the yard group: ${JSON.stringify(j).slice(0, 400)}`);
      await H(page, `window.__onfoot.look(${Math.atan2(m.x - j.pos.x, m.z - j.pos.z) * 180 / Math.PI}, -1)`);
      await frames(page, 2);
      const px = await H(page, `window.__onfoot.project(${m.x}, 1.45, ${m.z})`);
      await H(page, `window.__onfoot.tapScreen(${px.x}, ${px.y})`);
      const lt = await H(page, 'window.__onfoot.lastTap()');
      if (lt.kind === 'group' && lt.id === 1) { got = { m, px, lt, from: j.pos }; break; }
      await H(page, "window.__onfoot.press('Leave'); window.__onfoot.sim(3, false, true)");
    }
    expect(got, 'no tap on a lawn-group member registered from the yard circle');
    const r = await H(page, `(() => { const o = window.__onfoot; const w = o.sim(60, true, true); const p = o.pos(), t = o.target(), st = o.state(), gs = o.groups(); return { p, t, st, g0you: gs[0].you, g1: gs[1], log: st.log.slice(-4) }; })()`);
    const d = Math.hypot(r.p.x - r.g1.x, r.p.z - r.g1.z), d0 = Math.hypot(r.p.x - g0.x, r.p.z - g0.z);
    expect(d <= r.g1.r + 1.1 && r.st.joined === null && r.st.pending === null && r.g0you === null && r.t.actions.includes('Join') && r.t.group === 1, `ended ${d.toFixed(2)} m from the lawn group (${d0.toFixed(2)} m from the yard group): ${JSON.stringify(r).slice(0, 700)}`);
    return `tapped ${got.m.name} at pixel ${got.px.x}, ${got.px.y} from the yard circle; walked ${Math.hypot(r.p.x - got.from.x, r.p.z - got.from.z).toFixed(1)} m and stopped ${d.toFixed(2)} m from the lawn group's centre (r ${r.g1.r} m); left the yard circle on the way (${r.log.filter((x) => /^leave/.test(x)).join(', ')}); offered ${JSON.stringify(r.t.actions)} for group ${r.t.group}`;
  });
  await check('actions 1280x720: in each group one speaker at a time, and listeners face the speaker in at least 70% of samples', async () => {
    await H(page, 'window.__onfoot.go(-5104, -8337)');
    const r = await H(page, `(() => { const o = window.__onfoot; let samples = 0, multi = 0, faced = 0, looks = 0;
      for (let i = 0; i < 60; i++) { o.sim(0.5, false, true); for (const g of o.groups()) { if (!g.active) continue; samples++; if (g.members.filter((m) => m.speaking).length > 1) multi++; for (const m of g.members) if (m.facesSpeaker !== null) { looks++; if (m.facesSpeaker) faced++; } } }
      return { samples, multi, faced, looks }; })()`);
    summary.groupTalk = r;
    expect(r.multi === 0 && r.looks > 20 && r.faced / r.looks >= 0.7, JSON.stringify(r));
    return `${r.samples} group samples over 30 s: ${r.multi} with two speakers; listeners faced the speaker in ${r.faced} of ${r.looks} (${(100 * r.faced / r.looks).toFixed(0)}%)`;
  });
  await check('actions 1280x720: nothing can be done through a wall (every offer has a clear line, checked independently; the guard holds at 4x reach; taps through a wall do not pick what is behind it)', async () => {
    const cols = await H(page, 'window.__onfoot.colliders()'), blocked = sightChecker(cols);
    const seats = await H(page, 'window.__onfoot.seats()'), counters = await H(page, 'window.__onfoot.counters()'), groups = await H(page, 'window.__onfoot.groups()');
    const seatAt = new Map(seats.map((s) => [s.id, s])), cAt = new Map(counters.map((c) => [c.id, c])), gAt = new Map(groups.map((g) => [g.id, g]));
    const cPoint = (c, x, z) => ({ x: c.from.x - c.side * -0.12, z: Math.max(Math.min(c.from.z, c.to.z), Math.min(Math.max(c.from.z, c.to.z), z)) });
    const res = {};
    for (const k of [1, 4]) {
      const offers = await offersAt(page, k);
      let bad = [], n = 0, engaged = 0;
      for (const [x, z, sid, cid, gid] of offers) {
        if (sid !== null) { n++; const s = seatAt.get(sid), b = blocked(x, z, s.x, s.z); if (b) bad.push(`seat ${sid} from ${x},${z} through ${b}`); }
        if (cid) { n++; const c = cAt.get(cid), q = cPoint(c, x, z), b = blocked(x, z, q.x, q.z); if (b) bad.push(`${cid} from ${x},${z} through ${b}`); }
        if (gid !== null) { n++; const g = gAt.get(gid), b = blocked(x, z, g.x, g.z); if (b) bad.push(`group ${gid} from ${x},${z} through ${b}`); }
        // the guard at work: the nearest seat by distance alone is behind a wall, so it isn't the one offered
        if (k > 1) { let best = null, bd = 1.4 * k; for (const s of seats) { const d = Math.min(Math.hypot(s.approach.x - x, s.approach.z - z), Math.hypot(s.x - x, s.z - z) + 0.2); if (d < bd) { bd = d; best = s; } } if (best && blocked(x, z, best.x, best.z) && sid !== best.id) engaged++; }
      }
      res[k] = { points: offers.length, offers: n, bad: bad.length, engaged };
      if (k === 4) summary.wallsSample = offers.length;
      expect(!bad.length, `reach x${k}: ${bad.length} offers through a wall: ${bad.slice(0, 5).join(' | ')}`);
    }
    expect(res[4].engaged > 50, `at 4x reach the line test turned down only ${res[4].engaged} nearest seats behind walls`);
    // taps through a wall: a high-top stool behind the Shed's north wall, seen from the forecourt; the cook behind
    // the taco truck's body, seen from its back. Then the same stool from inside, where the tap does pick it.
    // (the high-top at local -32, -39 stands behind a solid stretch of the north wall, between the entrance and a
    // storefront window: its stool nearest the wall)
    const stool = seats.filter((s) => s.kind === 'hightop' && s.x > -5133 && s.x < -5131 && s.z < -8388.5).sort((a, b) => a.z - b.z)[0];
    await H(page, `window.__onfoot.view('first'); window.__onfoot.go(${stool.x}, -8396.5); window.__onfoot.look(${Math.atan2(0, stool.z + 8396.5) * 180 / Math.PI}, -6)`);
    await frames(page, 2);
    let px = await H(page, `window.__onfoot.project(${stool.x}, 0.9, ${stool.z})`);
    await H(page, `window.__onfoot.tapScreen(${px.x}, ${px.y})`); const t1 = await H(page, 'window.__onfoot.lastTap()');
    const n1 = await shot(page, S + 'wall-tap.png');
    expect(!(t1.kind === 'seat' && t1.id === stool.id) && t1.goal?.seat !== stool.id, `a tap through the Shed's north wall picked stool ${stool.id}: ${JSON.stringify(t1)}`);
    const cook = (await H(page, 'window.__onfoot.npcs()')).filter((n) => n.role === 'cook')[0];
    await H(page, `window.__onfoot.go(${cook.x + 3.0}, ${cook.z}); window.__onfoot.look(270, -4)`);
    await frames(page, 2);
    const back = await H(page, `(() => { const o = window.__onfoot; const p = o.pos(); return { p, offer: o.offerAt(p.x, p.z), t: o.target() }; })()`);
    px = await H(page, `window.__onfoot.project(${cook.x}, 2.0, ${cook.z})`);
    await H(page, `window.__onfoot.tapScreen(${px.x}, ${px.y})`); const t2 = await H(page, 'window.__onfoot.lastTap()');
    expect(t2.kind !== 'counter' && back.offer.counter === null && !back.t.actions.includes('Order'), `behind the truck: ${JSON.stringify(back)}; tap ${JSON.stringify(t2)}`);
    await H(page, `window.__onfoot.go(${stool.x + 2.2}, ${stool.z + 1.2}); window.__onfoot.look(${Math.atan2(-2.2, -1.2) * 180 / Math.PI}, -20)`);
    await frames(page, 2);
    px = await H(page, `window.__onfoot.project(${stool.x}, 0.9, ${stool.z})`);
    await H(page, `window.__onfoot.tapScreen(${px.x}, ${px.y})`); const t3 = await H(page, 'window.__onfoot.lastTap()');
    expect(t3.kind === 'seat', `the control tap from inside didn't pick a seat: ${JSON.stringify(t3)}`);
    // glass is not a wall for a tap: seat 22 (a high-top stool) seen through the west storefront window from the
    // forecourt is picked, and the walk goes in by the entrance (the line test still keeps Sit from being offered
    // through the glass: the 0.5 m grid above)
    const s22 = seats.find((s) => s.id === 22);
    await H(page, `window.__onfoot.go(${s22.x}, -8396.5); window.__onfoot.look(${Math.atan2(0, s22.z + 8396.5) * 180 / Math.PI}, -8)`);
    await frames(page, 2);
    px = await H(page, `window.__onfoot.project(${s22.x}, 0.9, ${s22.z})`);
    await H(page, `window.__onfoot.tapScreen(${px.x}, ${px.y})`); const t4 = await H(page, 'window.__onfoot.lastTap()');
    const w4 = await H(page, 'window.__onfoot.sim(60, true)');
    let door = null; for (let i = 2; i < w4.path.length; i += 2) if ((w4.path[i - 1] + 8394) * (w4.path[i + 1] + 8394) <= 0) { door = w4.path[i]; break; }
    expect(t4.kind === 'seat' && t4.id === 22 && w4.end.sitting === 22 && door !== null && door > -5136.4 && door < -5133.6, `seat 22 through the storefront glass: tap ${JSON.stringify(t4)}, ended ${JSON.stringify(w4.end)}, crossed the north wall at x ${door}`);
    await H(page, "window.__onfoot.press('Stand')");
    summary.walls = res;
    return `${n1}; offers at normal reach: ${res[1].offers} from ${res[1].points} points, none through a wall; at 4x reach: ${res[4].offers} offers, none through a wall, and ${res[4].engaged} times the nearest seat was behind a wall and not offered; the tap from the forecourt went to ${t1.kind}, the tap at the cook from the truck's back to ${t2.kind}; from inside the same stool's tap picked seat ${t3.id}; seat 22 tapped through the storefront glass from the forecourt was picked and reached by the entrance (crossed the north wall at x ${door.toFixed(2)}) and sat in`;
  });
  await check('actions 1280x720: Ultra: the regular who talks to you is the close-up body (LOD 0)', async () => {
    await H(page, "window.__onfoot.setQuality('ultra')");
    await frames(page, 3);
    const g0 = (await H(page, 'window.__onfoot.groups()'))[0];
    const r = await H(page, `(() => { const o = window.__onfoot; o.view('first'); o.go(${g0.x}, ${g0.z + 2.4}); o.look(180, -4); o.press('Join'); o.sim(10, true, true); o.sim(2.4, false, true); return { talk: o.talk() }; })()`);
    await frames(page, 3);
    const g = (await H(page, 'window.__onfoot.groups()'))[0], by = g.members.find((m) => m.name === r.talk?.caption?.who);
    const n = await shot(page, S + 'joined-ultra.png'); const s = await H(page, 'window.__onfoot.stats()'); summary.actUltraJoined = s;
    await H(page, "window.__onfoot.press('Leave'); window.__onfoot.setQuality('high')");
    expect(by && by.lod === 0 && !errors.length, `speaker ${JSON.stringify(by)}; ${errors.join(' | ')}`);
    return `${n}: ${by.name} at LOD 0; ${s.calls} calls, ${s.triangles} triangles`;
  });
  await check('actions 1280x720: High within 350 draw calls and 700k triangles in the action views', async () => {
    const v = [['holding', summary.actHolding], ['holding third person', summary.actHoldingThird], ['joined third person', summary.actJoinedThird]].filter(([, x]) => x);
    const worst = v.reduce((w, [, x]) => ({ calls: Math.max(w.calls, x.calls), triangles: Math.max(w.triangles, x.triangles) }), { calls: 0, triangles: 0 });
    expect(v.length === 3 && worst.calls <= 350 && worst.triangles <= 700000, v.map(([k, x]) => `${k} ${x.calls}/${x.triangles}`).join(', '));
    return v.map(([k, x]) => `${k} ${x.calls}/${Math.round(x.triangles / 1000)}k`).join(', ');
  });
  await ctx.close().catch(() => {}); await browser?.close().catch(() => {}); browser = null;
}

if (want('actions-phone')) {
  console.log('P1b actions at 390x844, touch (Low)');
  const { ctx, page, errors, bootS } = await open([390, 844], 'day=Sat&hour=21&hint=0', true);
  const S = 'onfoot-390x844-act-';
  const touch = (x, y) => `(() => { const c = document.getElementById('view'); for (const t of ['pointerdown', 'pointerup']) (t === 'pointerdown' ? c : window).dispatchEvent(new PointerEvent(t, { pointerId: 41, pointerType: 'touch', clientX: ${x}, clientY: ${y}, bubbles: true, isPrimary: true })); })()`;
  const inView = (b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= 391 && b.y + b.h <= 845;
  const box = (id) => page.evaluate((i) => { const e = document.getElementById(i); const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: b.x, y: b.y, w: b.width, h: b.height, on: cs.display !== 'none' && Number(cs.opacity) > 0.05 && b.width > 0 }; }, id);
  const ov = (a, b) => a.on && b.on && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  await check('actions 390x844: boots with the regulars and the staff, no console errors (Low)', async () => {
    const s = await H(page, 'window.__onfoot.stats()'); summary.actPhone = s;
    expect(!errors.length && s.npcs === 9 && s.quality === 'low', `${errors.join(' | ')}; ${JSON.stringify(s).slice(0, 200)}`);
    return `boot ${bootS} s; npcs ${s.npcs}, built in ${s.crowdBuildMs} ms; ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('actions 390x844: a finger tap on the ground walks there (dots), then Sit and Stand with the big button', async () => {
    const seats = await H(page, 'window.__onfoot.seats()'), s = seats.find((x) => x.kind === 'bench' && x.at === 'table 7');
    await H(page, `window.__onfoot.go(${s.approach.x + 1.5}, ${s.approach.z + 6}); window.__onfoot.look(180, -22)`);
    await frames(page, 2);
    const px = await H(page, `window.__onfoot.project(${s.approach.x}, 0, ${s.approach.z})`);
    await H(page, touch(px.x, px.y)); await frames(page, 2);
    const lt = await H(page, 'window.__onfoot.lastTap()');
    expect(lt.moving && (lt.kind === 'ground' || lt.kind === 'seat'), `tap: ${JSON.stringify(lt)}`);
    const n0 = await shot(page, S + 'tap-to-go.png');
    await H(page, 'window.__onfoot.sim(15, true)');
    let t = await H(page, 'window.__onfoot.target()');
    if (lt.kind === 'ground') { expect(t.actions.includes('Sit'), `no Sit offered: ${JSON.stringify(t)}`); await page.tap('#act'); }
    await frames(page, 2);
    const p = await H(page, 'window.__onfoot.pos()'), a = await box('act');
    expect(p.sitting !== null && a.w >= 70 && inView(a), `seated ${p.sitting}; button ${JSON.stringify(a)}`);
    const n1 = await shot(page, S + 'sit.png');
    await page.tap('#act'); await frames(page, 1);
    const p2 = await H(page, 'window.__onfoot.pos()');
    expect(p2.sitting === null, 'Stand did nothing');
    return `${n0}, ${n1}: tap went to ${lt.kind}; sat in seat ${p.sitting}; the button is ${a.w} px`;
  });
  await check('actions 390x844: a finger tap on the bar walks you there and opens the order sheet; tap an item, wait, Pick up; you hold it', async () => {
    await H(page, "window.__onfoot.go(-5140.5, -8371); window.__onfoot.look(270, -12)");
    await frames(page, 2);
    const c = (await H(page, 'window.__onfoot.counters()')).find((x) => x.id === 'bar');
    const px = await H(page, `window.__onfoot.project(${c.from.x - 0.25}, 1.07, -8371)`);
    await H(page, touch(px.x, px.y)); await frames(page, 2);
    const lt = await H(page, 'window.__onfoot.lastTap()');
    await H(page, 'window.__onfoot.sim(10, true)'); await frames(page, 2);
    const sh = await H(page, 'window.__onfoot.sheet()');
    expect(lt.kind === 'counter' && sh.open && sh.items.length === 5, `tap ${JSON.stringify(lt)}; sheet ${JSON.stringify(sh).slice(0, 200)}`);
    const sizes = await page.evaluate(() => Array.from(document.querySelectorAll('#menuItems button')).map((b) => { const r = b.getBoundingClientRect(); return [r.width, r.height, r.y + r.height]; }));
    expect(sizes.every(([w, h, b]) => h >= 56 && w >= 280 && b <= 844), `item buttons ${JSON.stringify(sizes)}`);
    const n1 = await shot(page, S + 'order-sheet.png');
    await page.tap('#menuItems button[data-item="agua"]');
    await H(page, 'window.__onfoot.sim(2.5, false, true)');
    const st = await box('status2'), cr = await box('credit');
    expect(st.on && inView(st) && !ov(st, cr), `status chip ${JSON.stringify(st)} credit ${JSON.stringify(cr)}`);
    const n2 = await shot(page, S + 'making.png');
    await H(page, `(() => { ${untilReady()} })()`); await frames(page, 2);
    const r = await H(page, 'window.__onfoot.state()');
    expect(r.actions[0] === 'Pick up', `ready: ${JSON.stringify(r)}`);
    const n3 = await shot(page, S + 'ready.png');
    await page.tap('#act'); await frames(page, 2);
    const h = await H(page, 'window.__onfoot.state()');
    expect(h.held?.id === 'agua' && h.held.first, `holding: ${JSON.stringify(h)}`);
    const n4 = await shot(page, S + 'holding.png'); summary.actPhoneHolding = await H(page, 'window.__onfoot.stats()');
    return `${n1}, ${n2}, ${n3}, ${n4}: item buttons ${sizes.map((x) => Math.round(x[1])).join('/')} px tall; holding ${h.held.name}`;
  });
  await check('actions 390x844: Low: the cook is drawn at each truck window through the whole order (and not from behind the truck); the bartender is drawn through the storefront window, not through the wall beside it', async () => {
    const cs = await H(page, 'window.__onfoot.counters()'), out = [];
    for (const id of ['tacos', 'noodles']) {
      const c = cs.find((x) => x.id === id), ci = id === 'tacos' ? 0 : 1;
      await H(page, `window.__onfoot.go(${c.stand.x}, ${c.stand.z}); window.__onfoot.look(90, -4)`);
      await frames(page, 2);
      const r = await H(page, `(() => { const o = window.__onfoot, cook = o.npcs().filter((n) => n.role === 'cook')[${ci}], p = o.pos(); return { cook, d: +Math.hypot(cook.x - p.x, cook.z - p.z).toFixed(2), t: o.target(), s: o.stats() }; })()`);
      expect(r.cook.drawn && r.s.quality === 'low' && r.s.npcsDrawn >= 1 && r.t.actions.includes('Order'), `${id} at the window: ${JSON.stringify(r).slice(0, 500)}`);
      if (id === 'tacos') {
        // the whole beat at the window, on Low: order, making (the cook at the flat-top), ready (back at the window)
        await H(page, "window.__onfoot.press('Order')"); await H(page, "window.__onfoot.pick('elote')");
        await H(page, 'window.__onfoot.sim(2.5, false, true)'); await frames(page, 2);
        const mk = await H(page, `(() => { const o = window.__onfoot; return { cook: o.npcs().filter((n) => n.role === 'cook')[0], st: o.state() }; })()`);
        await H(page, `(() => { ${untilReady()} })()`); await frames(page, 2);
        const rd = await H(page, `(() => { const o = window.__onfoot; return { cook: o.npcs().filter((n) => n.role === 'cook')[0], st: o.state(), s: o.stats() }; })()`);
        expect(mk.cook.drawn && mk.st.order?.stage === 'making' && rd.cook.drawn && rd.st.order?.stage === 'ready' && rd.st.actions[0] === 'Pick up', `the beat: making ${JSON.stringify(mk).slice(0, 300)}; ready ${JSON.stringify(rd).slice(0, 300)}`);
        out.push(await shot(page, S + 'truck.png'));
        await page.tap('#act'); await frames(page, 1);
        out.push(`tacos: cook drawn ${r.d} m away at the window, at the flat-top while making, and back at the window when ready (${rd.s.npcsDrawn} people drawn, ${rd.s.calls} calls, ${rd.s.triangles} tris)`);
      } else out.push(`noodles: cook drawn ${r.d} m away at the window`);
      // from behind the truck (its east side) the cook isn't drawn: the truck's body is between
      await H(page, `window.__onfoot.go(${r.cook.x + 3}, ${r.cook.z}); window.__onfoot.look(270, -4)`);
      await frames(page, 2);
      const bk = await H(page, `window.__onfoot.npcs().filter((n) => n.role === 'cook')[${ci}]`);
      expect(!bk.drawn, `${id}: the cook is drawn from behind the truck`);
    }
    // the bartender at the bar, from the forecourt: through the west storefront window (drawn), then from a spot where
    // the line runs through the solid wall between the window and the entrance (not drawn)
    const b = await H(page, "window.__onfoot.npcs().find((n) => n.role === 'bartender')"), seen = {};
    for (const [k, x] of [['window', -5142], ['wall', -5137.8]]) {
      await H(page, `window.__onfoot.go(${x}, -8396)`);
      const p = await H(page, 'window.__onfoot.pos()');
      await H(page, `window.__onfoot.look(${Math.atan2(b.x - p.x, b.z - p.z) * 180 / Math.PI}, 0)`);
      await frames(page, 2);
      seen[k] = await H(page, "window.__onfoot.npcs().find((n) => n.role === 'bartender').drawn");
    }
    expect(seen.window === true && seen.wall === false, `the bartender from the forecourt: ${JSON.stringify(seen)}`);
    out.push('the bartender drawn through the storefront window and hidden behind the wall beside it; both cooks hidden from behind their trucks');
    return out.join('; ');
  });
  await check('actions 390x844: tap one of the regulars, Join with the button, a reply chip, Leave; caption, chips and button clear of each other and on screen', async () => {
    const g0 = (await H(page, 'window.__onfoot.groups()'))[0], m = g0.members[1];
    await H(page, `window.__onfoot.go(${g0.x}, ${g0.z + 4.5}); window.__onfoot.look(180, -6)`);
    await frames(page, 2);
    const px = await H(page, `window.__onfoot.project(${m.x}, 1.2, ${m.z})`);
    await H(page, touch(px.x, px.y)); await frames(page, 2);
    const lt = await H(page, 'window.__onfoot.lastTap()');
    await H(page, 'window.__onfoot.sim(8, true)'); await frames(page, 2);
    const t = await H(page, 'window.__onfoot.target()');
    expect(lt.kind === 'group' && t.actions[0] === 'Join', `tap ${JSON.stringify(lt)} then ${JSON.stringify(t)}`);
    await page.tap('#act');
    await H(page, 'window.__onfoot.sim(10, true, true)'); await H(page, 'window.__onfoot.sim(2.4, false, true)'); await frames(page, 2);
    await page.waitForTimeout(600);                    // (the caption fades in over 0.25 s)
    const cap = await box('caption'), chips = await box('chips'), act = await box('act'), r0 = await box('reply0');
    expect(cap.on && chips.on && inView(cap) && inView(chips) && !ov(cap, chips) && !ov(chips, act) && r0.h >= 52, `caption ${JSON.stringify(cap)}, chips ${JSON.stringify(chips)}, act ${JSON.stringify(act)}, chip ${JSON.stringify(r0)}`);
    const n1 = await shot(page, S + 'joined.png'); summary.actPhoneJoined = await H(page, 'window.__onfoot.stats()');
    await page.tap('#reply0'); await H(page, 'window.__onfoot.sim(1.2, false, true)'); await frames(page, 2);
    const t2 = await H(page, 'window.__onfoot.talk()');
    expect(t2.log.some((x) => x.who === 'You'), `the reply: ${JSON.stringify(t2)}`);
    const n2 = await shot(page, S + 'reply.png');
    await page.tap('#act'); await H(page, 'window.__onfoot.sim(4, false, true)'); await frames(page, 2);
    const st = await H(page, 'window.__onfoot.state()');
    expect(st.joined === null, `leave: ${JSON.stringify(st)}`);
    const n3 = await shot(page, S + 'left.png');
    return `${n1}, ${n2}, ${n3}: tapped ${m.name}; chips ${r0.h} px tall; "${t2.log.find((x) => x.who === 'You').text}"`;
  });
  await check('actions 390x844: Low within 150 draw calls and 250k triangles in the action views', async () => {
    const v = [['holding', summary.actPhoneHolding], ['joined', summary.actPhoneJoined]].filter(([, x]) => x);
    const worst = v.reduce((w, [, x]) => ({ calls: Math.max(w.calls, x.calls), triangles: Math.max(w.triangles, x.triangles) }), { calls: 0, triangles: 0 });
    expect(v.length === 2 && worst.calls <= 150 && worst.triangles <= 250000, v.map(([k, x]) => `${k} ${x.calls}/${x.triangles}`).join(', '));
    return v.map(([k, x]) => `${k} ${x.calls}/${Math.round(x.triangles / 1000)}k`).join(', ');
  });
  await ctx.close().catch(() => {}); await browser?.close().catch(() => {}); browser = null;
}

// ------------------------------------------------------------------------------------------------ random walks
if (want('walks')) {
  console.log(`random walks: ${WALKS}`);
  const { ctx, page, errors } = await open([640, 360], 'quality=low&day=Sat&hour=21', false);
  await check('walks: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await H(page, 'window.__onfoot.freeze(true)');
  const cols = await H(page, 'window.__onfoot.colliders()'), region = await H(page, 'window.__onfoot.region()');
  const starts = await H(page, `window.__onfoot.randomFree(${WALKS * 2}, 5757)`);
  const R = 0.3, TOL = 0.02;
  // an independent checker: the colliders and the walkable region as plain data, tested here in Node
  const C = 4, hash = new Map(), key = (i, j) => i * 100003 + j;
  const bboxOf = (c) => c.k === 'circ' ? [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r] : c.k === 'seg' ? [Math.min(c.ax, c.bx) - c.r, Math.min(c.az, c.bz) - c.r, Math.max(c.ax, c.bx) + c.r, Math.max(c.az, c.bz) + c.r]
    : (() => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (let i = 0; i < c.pts.length; i += 2) { x0 = Math.min(x0, c.pts[i]); x1 = Math.max(x1, c.pts[i]); z0 = Math.min(z0, c.pts[i + 1]); z1 = Math.max(z1, c.pts[i + 1]); } return [x0, z0, x1, z1]; })();
  cols.forEach((c, n) => { const [x0, z0, x1, z1] = bboxOf(c); for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) { const k = key(i, j); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(n); } });
  const nearby = (x0, z0, x1, z1) => { const s = new Set(); for (let i = Math.floor((x0 - 1) / C); i <= Math.floor((x1 + 1) / C); i++) for (let j = Math.floor((z0 - 1) / C); j <= Math.floor((z1 + 1) / C); j++) for (const n of hash.get(key(i, j)) ?? []) s.add(n); return [...s].map((n) => cols[n]); };
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  const inPoly = (x, z, P) => { let ins = false; for (let i = 0, j = P.length / 2 - 1; i < P.length / 2; j = i++) { const xi = P[i * 2], zi = P[i * 2 + 1], xj = P[j * 2], zj = P[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
  const sdist = (c, x, z) => {
    if (c.k === 'circ') return Math.hypot(x - c.x, z - c.z) - c.r;
    if (c.k === 'seg') return segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r;
    let d = Infinity; const P = c.pts, n = P.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) d = Math.min(d, segDist(x, z, P[j * 2], P[j * 2 + 1], P[i * 2], P[i * 2 + 1]));
    return inPoly(x, z, P) ? -d : d;
  };
  const cross = (ax, az, bx, bz, cx, cz, dx, dz) => { const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax), d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx); return d1 * d2 < 0 && d3 * d4 < 0; };
  const rows = region.rows, inRegion = (x, z) => { const i = Math.floor((x - region.x0) / region.cell), j = Math.floor((z - region.z0) / region.cell); if (j < 0 || j >= region.nz) return false; const r = rows[j]; for (let k = 0; k < r.length; k += 2) if (i >= r[k] && i < r[k] + r[k + 1]) return true; return false; };
  const fails = []; let points = 0, steps = 0, metres = 0, tapWalks = 0, stickWalks = 0, noPath = 0, arrived = 0, tapMetres = 0;
  const blocked = {}, lost = [];
  const verify = (path, label) => {
    for (let i = 0; i < path.length; i += 2) {
      const x = path[i], z = path[i + 1]; points++;
      for (const c of nearby(x - R, z - R, x + R, z + R)) { const d = sdist(c, x, z); if (d < R - TOL) { fails.push(`${label}: inside ${c.tag} (overlap ${(R - d).toFixed(3)} m) at ${x.toFixed(2)}, ${z.toFixed(2)}`); return; } }
      if (!inRegion(x, z)) { fails.push(`${label}: off the walkable area at ${x.toFixed(2)}, ${z.toFixed(2)}`); return; }
      if (i >= 2) {
        const ax = path[i - 2], az = path[i - 1]; steps++; metres += Math.hypot(x - ax, z - az);
        for (const c of nearby(Math.min(ax, x), Math.min(az, z), Math.max(ax, x), Math.max(az, z))) {
          if (c.k === 'seg' && cross(ax, az, x, z, c.ax, c.az, c.bx, c.bz)) { fails.push(`${label}: crossed ${c.tag} between ${ax.toFixed(2)},${az.toFixed(2)} and ${x.toFixed(2)},${z.toFixed(2)}`); return; }
          if (c.k === 'poly') { const P = c.pts, n = P.length / 2; for (let a = 0, b = n - 1; a < n; b = a++) if (cross(ax, az, x, z, P[b * 2], P[b * 2 + 1], P[a * 2], P[a * 2 + 1])) { fails.push(`${label}: crossed the edge of ${c.tag} at ${x.toFixed(2)},${z.toFixed(2)}`); return; } }
        }
      }
    }
  };
  // the checker must be able to fail: a made-up path straight through the Shed's west wall, one into a table, and
  // one into the road away from a crosswalk, each has to be caught
  {
    const before = fails.length;
    verify([-5150, -8370, -5149.2, -8370, -5148.4, -8370, -5147.6, -8370, -5146.8, -8370], 'self-test wall');
    verify([-5112.6, -8383, -5112, -8383], 'self-test table');
    verify([-5060, -8402.5, -5060, -8410], 'self-test road');
    const caught = fails.splice(before);
    await check('walks: the independent checker catches a path through a wall, into a table and onto the road', async () => {
      expect(caught.length === 3, `caught ${caught.length} of 3: ${caught.join(' | ')}`);
      return caught.map((c) => c.split(': ')[1]).join('; ');
    });
    points = 0; steps = 0; metres = 0;
  }
  const B = 20;
  for (let w0 = 0; w0 < WALKS; w0 += B) {
    const batch = [];
    for (let w = w0; w < Math.min(WALKS, w0 + B); w++) {
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
        tapMetres += r.info;
        // it arrived (within 0.5 m of the path's last point), or it stopped at something named
        if (r.miss <= 0.5 && !r.moving) arrived++;
        else if (r.gaveUp && r.gaveUp.by && r.gaveUp.by !== 'unknown') blocked[r.gaveUp.by] = (blocked[r.gaveUp.by] ?? 0) + 1;
        else lost.push(`walk ${w0 + i}: ${r.info} m path, ended ${r.miss} m short${r.moving ? ', still walking' : ''}${r.gaveUp ? `, gave up (${r.gaveUp.by})` : ''}`);
      }
    }
    if (fails.length > 20) break;
  }
  const nBlocked = Object.values(blocked).reduce((a, b) => a + b, 0);
  summary.walks = { walks: tapWalks + stickWalks, tapWalks, stickWalks, noPath, arrived, blocked, lost: lost.length, tapPathMetres: Math.round(tapMetres), points, steps, metres: Math.round(metres), colliders: cols.length, fails: fails.length };
  await check('walks: every tap-to-go walk with a path arrives (within 0.5 m of its last point) or stops at a named obstacle', async () => {
    expect(!lost.length, `${lost.length} walks neither arrived nor were blocked by something named: ${lost.slice(0, 6).join(' | ')}`);
    return `${arrived} of ${tapWalks - noPath} tap-to-go walks with a path arrived (${Math.round(tapMetres)} m of paths); ${nBlocked} stopped at a named obstacle${nBlocked ? ` (${JSON.stringify(blocked)})` : ''}; ${noPath} taps had no path`;
  });
  await check(`walks: ${WALKS} random walks never end inside a collider, leave the walkable area or cross a wall`, async () => {
    expect(!fails.length, `${fails.length} failures: ${fails.slice(0, 6).join(' | ')}`);
    return `${tapWalks} tap-to-go walks + ${stickWalks} stick walks, ${points} positions over ${Math.round(metres)} m checked against ${cols.length} colliders and the region (${noPath} taps had no path)`;
  });
  await ctx.close().catch(() => {}); await browser?.close().catch(() => {}); browser = null;
}
if (browser) await browser.close().catch(() => {});

// ------------------------------------------------------------------------------------------------ names
if (want('names')) {
  await check("names: the real venue's name appears nowhere in src/onfoot or the shipped data", async () => {
    const files = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
    walk(path.join(ROOT, 'src', 'onfoot'));
    walk(path.join(ROOT, 'src', 'data', 'anaheim'));
    files.push(PAGE);
    const re = /golden[\s_-]*road/i, hits = files.filter((f) => re.test(readFileSync(f, 'utf8')));
    expect(!hits.length, `found in ${hits.join(', ')}`);
    return `${files.length} files clean (src/onfoot, every file in src/data/anaheim, dist/onfoot/index.html)`;
  });
  await check('names: our own names are on the page (Lot 57, Two Lane Tacos, Night Shift Noodles)', async () => {
    const html = readFileSync(PAGE, 'utf8');
    for (const n of ['LOT 57', 'TWO LANE TACOS', 'NIGHT SHIFT', 'Simulated crowd', 'OpenStreetMap']) expect(html.includes(n), `missing ${n}`);
    for (const w of ['people here now', 'real-time']) expect(!html.toLowerCase().includes(w), `the page says "${w}"`);
  });
}

save();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Details in tests/out/onfoot/onfoot-checks.json`);
process.exit(failed.length ? 1 : 0);
