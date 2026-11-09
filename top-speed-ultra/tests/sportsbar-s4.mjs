// Phase S4 checks for the sports bar's page (PROJECT_OC_SPORTS_BAR.md, "### S4: maximum graphics and polish"). Drives
// dist/sportsbar/sportsbar.html (build it with `npx vite build --config src/onfoot/vite.sportsbar.config.ts`) in
// headless Chromium with SwiftShader through window.__onfoot and prints PASS or FAIL with the numbers each check saw.
// Screenshots go in tests/out/sportsbar/; results are merged into tests/out/sportsbar/sportsbar-s4-checks.json.
//
//   node tests/sportsbar-s4.mjs                       every group
//   node tests/sportsbar-s4.mjs --only=look,locked    some groups: look, locked, preset, dance, settings, audio, lines,
//                                                      budgets, shots, before
//   --tag=r1   a suffix for every screenshot's name;   --presets=low,high,ultra   the budgets' and shots' presets
//   --sizes=1280x720,390x844   the shots' sizes;   --times=noon,golden,night   the shots' times
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
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const only = arg('only', '').split(',').filter(Boolean);
const TAG = arg('tag', '');
const PRESETS = arg('presets', 'low,high,ultra').split(',');
const SIZES = arg('sizes', '1280x720,390x844').split(',').map((s) => s.split('x').map(Number));
const TIMES = arg('times', 'noon,golden,night').split(',');
const PLACES = arg('places', 'tv,bar,pool,freeway,exterior').split(',');
const png = (base) => (TAG ? `${base}-${TAG}.png` : `${base}.png`);
const want = (g) => !only.length || only.includes(g);
if (!existsSync(PAGE)) { console.error(`No build at ${PAGE}.`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const results = [], summary = {};
const CHECKS = path.join(OUT, 'sportsbar-s4-checks.json');
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
async function open(size, query, init) {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
  if (init) await ctx.addInitScript(init);
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
const CAP = { low: 36, high: 70, ultra: 100 };
const LABEL = { low: 'Low', high: 'HD', ultra: 'Ultra' };

// ------------------------------------------------------------------------------------------------ the look at each mode
if (want('look')) {
  console.log('look: the three modes on one page (Saturday 21:00, 844x390): materials, relief, cube, grade, pixel ratio, the composer');
  const { ctx, page, errors, bootS } = await open([844, 390], 'quality=low&ultra=1&day=Sat&hour=21&hint=0');
  await check('look: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); return `boot ${bootS} s`; });
  summary.look = {};
  for (const q of PRESETS) {
    await check(`look ${q}: the mode's look (${LABEL[q]})`, async () => {
      await H(page, `window.__onfoot.setQuality('${q}')`);
      await frames(page, 2);
      const L = await H(page, 'window.__onfoot.lookInfo()');
      summary.look[q] = L;
      expect(L.pixelRatio >= 1 && L.scale === 1, `pixel ratio ${L.pixelRatio}, scale ${L.scale}`);
      if (q === 'low') {
        expect(!L.grade && L.relief === 0 && L.cube === 0 && L.rimGain === 0 && L.composer === null, JSON.stringify(L).slice(0, 300));
        expect(L.swapped.every((s) => !s.hi), 'a physical material at Low');
        expect(L.retro.attached === false, 'Retro attached?');
      } else {
        expect(L.grade && L.relief === (q === 'ultra' ? 512 : 256) && L.cube === (q === 'ultra' ? 256 : 128) && L.rimGain > 0, JSON.stringify(L).slice(0, 300));
        expect(L.swapped.length >= 5 && L.swapped.every((s) => s.hi), 'swaps: ' + JSON.stringify(L.swapped));
        expect(L.composer && L.composer.includes('Grade'), 'no grade pass in ' + JSON.stringify(L.composer));
        if (q === 'ultra') expect(L.clearcoat === 1 && L.sheen === 1 && L.composer.includes('GTAO'), `clearcoat ${L.clearcoat}, sheen ${L.sheen}`);
      }
      return `${LABEL[q]}: pixel ratio ${L.pixelRatio}, relief ${L.relief}, cube ${L.cube} (${L.bakes} bakes, last ${L.lastBakeMs} ms), grade ${L.grade}, rim ${L.rimGain}, clearcoat ${L.clearcoat}, sheen ${L.sheen}, anisotropy ${L.aniso}, composer [${(L.composer ?? []).join(', ')}]; Retro: ${L.retro.attached ? 'attached' : 'not attached (' + L.retro.why + ')'}`;
    });
  }
  await check('look: no console errors after the three modes', async () => { expect(!errors.length, errors.join(' | ')); });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ a locked Ultra
if (want('locked')) {
  console.log('locked: no Ultra entitlement on this device: the button reads "Ultra · locked", opens nothing, no price anywhere');
  const { ctx, page, errors } = await open([844, 390], 'quality=high&day=Sat&hour=21&hint=0', () => { try { localStorage.removeItem('tsu.owner'); localStorage.removeItem('tsu.settings'); } catch { /* fine */ } });
  await check('locked: "Ultra · locked", no price and no purchase path; a tap changes nothing', async () => {
    const L = await H(page, 'window.__onfoot.lookInfo()');
    expect(L.ultraButton === 'Ultra · locked', `button "${L.ultraButton}"`);
    expect(!L.entitlement.unlocked, 'unlocked: ' + L.entitlement.by);
    await H(page, "window.__onfoot.pause ? window.__onfoot.pause(true) : document.getElementById('pauseBtn')?.click()");
    await H(page, "document.querySelector('#segQ [data-q=\"ultra\"]').click()");
    await frames(page, 2);
    const st = await H(page, 'window.__onfoot.stats()');
    expect(st.quality === 'high', `quality ${st.quality} after tapping a locked Ultra`);
    const txt = await H(page, 'document.body.innerText');
    const bad = [/\$\s?\d/, /\bbuy ultra\b/i, /\bpurchase\b/i, /\bprice\b/i, /\bsubscribe\b/i, /\bupgrade now\b/i].filter((r) => r.test(txt)).map(String);
    expect(!bad.length, 'money words on the page: ' + bad.join(', '));
    const toast = await H(page, 'window.__onfoot.toast()');
    expect(!errors.length, errors.join(' | '));
    return `button "${L.ultraButton}", quality stays ${st.quality}, toast "${toast}", no $ amount, "buy", "purchase", "price" or "subscribe" in the page's text`;
  });
  await check('locked: the owner flag in the game\'s settings unlocks Ultra (RS2 not landed; ultra.ts)', async () => {
    await H(page, "localStorage.setItem('tsu.settings', JSON.stringify({ owner: true }))");
    await page.reload(); await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
    const L = await H(page, 'window.__onfoot.lookInfo()');
    await H(page, "localStorage.removeItem('tsu.settings')");
    expect(L.entitlement.unlocked && L.entitlement.by === 'owner-settings' && L.ultraButton === 'Ultra', JSON.stringify(L.entitlement) + ' ' + L.ultraButton);
    return `unlocked by ${L.entitlement.by}, button "${L.ultraButton}"`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the PRESET copy
if (want('preset')) {
  await check('preset: the bar\'s PRESET copy against Lot 57\'s main.ts as committed on origin/claude/onfoot (L1 re-measured)', async () => {
    const src = execFileSync('git', ['show', 'origin/claude/onfoot:top-speed-ultra/src/onfoot/main.ts'], { cwd: ROOT, encoding: 'utf8' });
    const block = /const PRESET[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src)[1];
    const lot = {};
    for (const m of block.matchAll(/(\w+):\s*\{([^}]*)\}/g)) lot[m[1]] = Object.fromEntries([...m[2].matchAll(/(\w+):\s*('?[\w.]+'?)/g)].map(([, k, v]) => [k, v.replace(/'/g, '')]));
    const ours = readFileSync(path.join(ROOT, 'src/onfoot/venues/sportsbar/quality.ts'), 'utf8');
    const bar = {};
    for (const m of ours.matchAll(/^\s*(low|high|ultra):\s*\{([^}]*)\}/gm)) bar[m[1]] = Object.fromEntries([...m[2].matchAll(/(\w+):\s*('?[\w.]+'?)/g)].map(([, k, v]) => [k, v.replace(/'/g, '')]));
    const pairs = [['low', 'low'], ['high', 'hd'], ['ultra', 'ultra']], diffs = [];
    for (const [b, l] of pairs) for (const k of Object.keys(lot[l] ?? {})) if (String(bar[b]?.[k]) !== String(lot[l][k])) diffs.push(`${b}.${k}: bar ${bar[b]?.[k]}, Lot 57 ${lot[l][k]}`);
    summary.preset = { lot57: lot, bar, diffs };
    // the written-up differences (quality.ts's marker and the plan's L1 row): Low's shadow map (owner question 1)
    // and HD's and Ultra's minimum pixel ratio (the bar's own 0.5 floor is Lot 57's clamp written into the row)
    const known = diffs.filter((d) => !/^low\.shadows: bar 0, Lot 57 1024$/.test(d));
    expect(!known.length, 'differences not written up: ' + known.join('; '));
    return `Lot 57's ids ${Object.keys(lot).join(', ')}; the differences: ${diffs.join('; ') || 'none'} (Low's shadow map is owner question 1, written up)`;
  });
}

// ------------------------------------------------------------------------------------------------ dance nights
if (want('dance')) {
  console.log('dance: Saturday 21:00 (a game night after the featured match) and Tuesday 21:00; reduced motion');
  const { ctx, page, errors } = await open([1280, 720], 'quality=high&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await check('dance: the dance spot\'s lights on a game night, off on a Tuesday, still under reduced motion', async () => {
    const tv = await H(page, 'window.__onfoot.tvAt("Sat", 21)');
    await frames(page, 3);
    const a = await H(page, 'window.__onfoot.lookInfo()');
    await H(page, "window.__onfoot.setClock('Tue', 21)"); await frames(page, 3);
    const tue = await H(page, 'window.__onfoot.tvAt("Tue", 21)');
    const b = await H(page, 'window.__onfoot.lookInfo()');
    await H(page, "window.__onfoot.setClock('Sat', 21)"); await H(page, 'window.__onfoot.reducedMotion(true)'); await frames(page, 2);
    const c = await H(page, 'window.__onfoot.lookInfo()');
    expect(tv.gameNight && a.dance > 0.5, `Saturday: game night ${tv.gameNight}, lights ${a.dance}`);
    expect(!tue.gameNight || b.dance < 0.5, `Tuesday: game night ${tue.gameNight}, lights ${b.dance}`);
    expect(c.dance === 1, `reduced motion: lights ${c.dance} (on at once, still)`);
    await H(page, 'window.__onfoot.reducedMotion(false)');
    // the shot: from the standing floor toward the big screen, the dance spot between
    const cam = await H(page, `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; const a = g(28.6, 6.8), b = g(34.0, 4.1); return o.camera([a[0], 2.6, a[1], b[0], 0.4, b[1]]); })()`);
    await H(page, 'window.__onfoot.buildAll()'); await frames(page, 3);
    const n = await shot(page, png('s4-dance-night-1280x720'));
    await H(page, 'window.__onfoot.camera(null)');
    expect(!errors.length, errors.join(' | '));
    return `Saturday 21:00 game night ${tv.gameNight}: lights ${a.dance}; Tuesday game night ${tue.gameNight}: ${b.dance}; reduced motion ${c.dance}; ${n} (camera ${JSON.stringify(cam.p)})`;
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the settings
if (want('settings')) {
  console.log('settings: text size and reduced motion; the switch sheet');
  const { ctx, page, errors } = await open([390, 844], 'quality=low&day=Sat&hour=21&hint=0');
  await check('settings: text size Small, Medium, Large scales the HUD and the sheets; kept on the device', async () => {
    const sizes = [];
    for (const t of [0, 1, 2]) {
      await H(page, `document.querySelector('#segText [data-t="${t}"]').click()`);
      await frames(page, 1);
      sizes.push(await H(page, "(() => { const f = (s) => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : null; }; return { place: f('#place'), crowd: f('#crowd'), toast: f('#toast'), caption: f('#caption'), sheet: f('.sheet p'), cls: document.documentElement.className }; })()"));
    }
    const kept = await H(page, "(() => { try { return Object.keys(localStorage).filter((k) => /sportsbar/.test(k)).map((k) => k + '=' + localStorage.getItem(k).slice(0, 80)); } catch { return []; } })()");
    summary.textSizes = sizes;
    expect(sizes[2].place > sizes[1].place && sizes[1].place >= sizes[0].place, 'place: ' + sizes.map((s) => s.place).join(' / '));
    expect(sizes[2].caption > sizes[1].caption && sizes[2].sheet > sizes[1].sheet, 'caption/sheet: ' + JSON.stringify(sizes));
    await H(page, `document.querySelector('#segText [data-t="2"]').click()`);
    const n = await shot(page, png('s4-text-large-390x844'));
    await H(page, `document.querySelector('#segText [data-t="1"]').click()`);
    return `place ${sizes.map((s) => s.place).join(' / ')} px, caption ${sizes.map((s) => s.caption).join(' / ')}, sheet text ${sizes.map((s) => s.sheet).join(' / ')}; kept: ${kept.join(', ') || '(none)'}; ${n}`;
  });
  await check('settings: reduced motion turns off the bob, the camera moves and the transitions', async () => {
    const r = await H(page, 'window.__onfoot.reducedMotion(true)');
    const bob = await H(page, 'window.__onfoot.bobRange()');
    const tr = await H(page, "getComputedStyle(document.getElementById('toast')).transitionDuration");
    await H(page, 'window.__onfoot.reducedMotion(false)');
    const bob2 = await H(page, 'window.__onfoot.bobRange()');
    expect(r.reduced && r.bobOff && r.transitionsOff && bob === 0, JSON.stringify(r) + ' bob ' + bob);
    return `bob ${bob} m reduced, ${bob2} m full; the toast's transition ${tr} reduced`;
  });
  await check('settings: a change of graphics behind its sheet, the sheet\'s words', async () => {
    const r = await H(page, "window.__onfoot.switchSheet('high')");
    expect(r.quality === 'high' && r.sheet.includes('Switching to HD…'), JSON.stringify(r));
    return JSON.stringify(r);
  });
  await check('settings: no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the budgets
const PASS = { low: { inside: [118, 203.9e3], outside: [139, 244.3e3], overhead: [118, 197.9e3] }, high: { inside: [177, 465.7e3], outside: [176, 449.5e3], overhead: [222, 609.4e3] }, ultra: { inside: [302, 1202.6e3], outside: [246, 1086.4e3], overhead: [302, 1180.0e3] } };
const FRAME = { low: { inside: [150, 250e3], outside: [150, 250e3], overhead: [150, 250e3] }, high: { inside: [294, 718.9e3], outside: [328, 854.6e3], overhead: [374, 1014.5e3] }, ultra: { inside: [1155, 3259.2e3], outside: [683, 3011.9e3], overhead: [1185, 3396.7e3] } };
const SUN = { high: { inside: [102, 253.1e3], outside: [137, 405.1e3], overhead: [137, 405.1e3] }, ultra: { inside: [177, 656.5e3], outside: [171, 839.2e3], overhead: [187, 839.2e3] } };
const POOLMAP = { inside: [177, 98.8e3], overhead: [187, 98.8e3] };
const POST = { low: 0, high: 15, ultra: 20 };
const OUTSIDE_MESHES = { low: 12, high: 24, ultra: 40 };
if (want('budgets')) {
  summary.budgets = summary.budgets ?? {};
  console.log('budgets: the final materials, the grade and the dance lights: 844x390 (and 390x844 for door and overhead), Saturday 21:00, week 43, seed 1, the caps reached, every item at its cap, guests\' games in play');
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
      await check(`budgets ${q} ${pose} ${size.join('x')}: the final look; the pass and the frame within the sums; each shadow map within its row; the post chain measured`, async () => {
        await page.setViewportSize({ width: size[0], height: size[1] });
        if (pose === 'stall' || pose === 'patio') await H(page, `window.__onfoot.crowdAt('outside', ${OUTSIDE_MESHES[q]})`);
        const r = await H(page, `window.__onfoot.pose('${pose}')`);
        const ms = await ensureGames();
        await frames(page, 2);
        await H(page, 'window.__onfoot.freeze(true)');
        await H(page, 'window.__onfoot.itemsAtCap(true)');
        await H(page, 'window.__onfoot.render()');
        const s = await H(page, 'window.__onfoot.stats()'), v = await H(page, 'window.__onfoot.vis()'), p = await H(page, 'window.__onfoot.peopleBrief()'), L = await H(page, 'window.__onfoot.lookInfo()');
        await H(page, 'window.__onfoot.itemsAtCap(false)'); await H(page, 'window.__onfoot.freeze(false)');
        const st = r.state, [pc, pt] = PASS[q][st], [fc, ft] = FRAME[q][st];
        const mapCalls = Object.values(s.maps).reduce((a, m) => a + m.calls, 0), mapTris = Object.values(s.maps).reduce((a, m) => a + m.tris, 0);
        const post = s.frame.calls - s.pass.calls - mapCalls - (s.ao ? s.ao.calls : 0), postTris = s.frame.tris - s.pass.tris - mapTris - (s.ao ? s.ao.tris : 0);
        const empty = {};
        for (const [k, m] of Object.entries(s.maps)) empty[k] = m.calls;
        summary.budgets[`${q}-${pose}-${size.join('x')}`] = { state: st, pass: s.pass, frame: s.frame, maps: s.maps, ao: s.ao, post: { calls: post, tris: postTris }, people: { meshes: v.people.meshes, lod1: v.people.lod1, cards: v.people.cards }, live: p.live, matches: ms.map((m) => `${m.spot} ${m.mode}`), simMs: s.simMs, frameMs: s.frameMs, crowdFrameMs: s.crowdFrameMs, decideMs: s.decideMs, look: { grade: L.grade, cube: L.cube, dance: L.dance }, textures: s.textures, programs: s.programs };
        expect(p.live === CAP[q], `live ${p.live} of ${CAP[q]}`);
        expect(s.pass.calls <= pc && s.pass.tris <= pt, `pass ${s.pass.calls}/${fmt(s.pass.tris)} > ${pc}/${fmt(pt)}`);
        expect(s.frame.calls <= fc && s.frame.tris <= ft, `frame ${s.frame.calls}/${fmt(s.frame.tris)} > ${fc}/${fmt(ft)}`);
        if (q !== 'low') {
          const sun = s.maps.sun, [sc, stt] = SUN[q][st];
          expect(sun && sun.calls <= sc && sun.tris <= stt, `sun map ${sun?.calls}/${fmt(sun?.tris ?? 0)} > ${sc}/${fmt(stt)}`);
          if (q === 'ultra' && st !== 'outside') for (const k of ['pool-1', 'pool-2']) { const m = s.maps[k], [mc, mt] = POOLMAP[st]; expect(m && m.calls <= mc && m.tris <= mt, `${k} ${m?.calls}/${fmt(m?.tris ?? 0)} > ${mc}/${fmt(mt)}`); }
          expect(!v.people.castingNotLod1.length, 'casting meshes other than lod1: ' + v.people.castingNotLod1.slice(0, 4).join(', '));
          expect(post <= POST[q], `post ${post} calls > ${POST[q]}`);
        } else expect(post === 0 && !Object.keys(s.maps).length, `Low: post ${post}, maps ${Object.keys(s.maps).join(', ')}`);
        if (st === 'outside') expect(v.people.meshes <= OUTSIDE_MESHES[q], `${v.people.meshes} people meshes outside (count ${OUTSIDE_MESHES[q]})`);
        expect(v.people.lod0Npcs === 0, 'an NPC at LOD 0');
        const mapTxt = Object.entries(s.maps).map(([k, m]) => `${k} ${m.calls}/${fmt(m.tris)}${m.frozen ? ' frozen' : ''}`).join(', ');
        return `${st}: pass ${s.pass.calls}/${fmt(s.pass.tris)} of ${pc}/${fmt(pt)}; frame ${s.frame.calls}/${fmt(s.frame.tris)} of ${fc}/${fmt(ft)}; maps [${mapTxt}]; AO ${s.ao ? s.ao.calls + '/' + fmt(s.ao.tris) : '-'}; post ${post} calls/${postTris} tris; people ${v.people.meshes} meshes (LOD 1 ${v.people.lod1}), ${v.people.cards} cards, live ${p.live}; games ${ms.length}; dance lights ${L.dance}; frame CPU ${s.frameMs} ms, crowd frame ${s.crowdFrameMs} ms, decisions ${s.decideMs} ms; textures ${s.textures}, programs ${s.programs}`;
      });
    }
    await page.setViewportSize({ width: 844, height: 390 });
  }
  await check('budgets: no console errors over the run', async () => { expect(!errors.length, errors.join(' | ')); });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the phase's screenshots
// inside at the TV wall, the bar, the pool tables, the patio toward the freeway, and the exterior from the lot (S1's
// views, first person), at noon, golden hour and Saturday 21:00, at Low, HD and Ultra, at 1280 x 720 and 390 x 844
const CAM = (eu, ev, ey, tu, tv, ty) => `(() => { const o = window.__onfoot, f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.view('first'); const a = g(${eu}, ${ev}), b = g(${tu}, ${tv}); o.camera([a[0], ${ey}, a[1], b[0], ${ty}, b[1]]); })()`;
// fixed cameras in the aisles (S1's first-person spots now have guests standing in them): the TV wall from between
// the high-tops, the bar from the pool side, the pool tables from the darts side, the freeway from the patio rail and
// the front from the lot (S1's exterior view)
const VIEWS = {
  tv: ['toward the TV wall', CAM(26.4, 6.6, 1.72, 35.7, 4.75, 1.85)],
  bar: ['at the bar', CAM(16.0, 11.4, 1.68, 24.0, 15.4, 1.0)],
  pool: ['at the pool tables', CAM(13.15, 10.9, 2.15, 12.0, 6.5, 0.55)],
  freeway: ['the patio toward the freeway', CAM(6.0, -3.6, 1.62, 40, -70, 6.5)],
  exterior: ['the exterior from the lot', (() => { const fd = (d, s2) => [d * -0.932 + s2 * 0.362, d * 0.362 + s2 * 0.932]; const [eu, ev] = fd(7.6, 1.0), [tu, tv] = fd(0, 10.5); return CAM(eu, ev, 1.65, tu, tv, 2.9); })()],
};
if (want('shots')) {
  summary.shots = summary.shots ?? {};
  for (const q of PRESETS) {
    console.log(`shots ${LABEL[q]}`);
    const { ctx, page, errors } = await open(SIZES[0], `quality=${q}&ultra=1&day=Sat&hour=12&hint=0`);
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
    if (q === 'ultra') await H(page, 'window.__onfoot.buildAll()');
    await check(`shots ${LABEL[q]}: boots with no console errors`, async () => { expect(!errors.length, errors.join(' | ')); });
    // golden hour: the hour of Saturday's sun a few degrees up (the grade's gold at its most), found on the page
    let golden = 16.5;
    if (TIMES.includes('golden')) {
      let best = -1;
      for (let h = 15.75; h <= 17.0; h += 0.125) { await H(page, `window.__onfoot.setClock('Sat', ${h})`); const g = (await H(page, 'window.__onfoot.lookInfo()')).gold, c = await H(page, 'window.__onfoot.clock()'); if (g > best && c.night < 0.5) { best = g; golden = h; } }
      summary.shots.golden = { hour: golden, gold: best };
    }
    const HOURS = { noon: 12, golden, night: 21 };
    for (const t of TIMES) {
      await H(page, `window.__onfoot.setClock('Sat', ${HOURS[t]})`);
      await H(page, 'window.__onfoot.fastForward(1)');
      await H(page, 'window.__onfoot.buildAll()');
      for (const size of SIZES) {
        await page.setViewportSize({ width: size[0], height: size[1] });
        for (const id of PLACES) {
          const [label, js] = VIEWS[id];
          await check(`shots ${LABEL[q]} ${size.join('x')} ${t}: ${label}`, async () => {
            await H(page, js);
            await H(page, `window.__onfoot.setClock('Sat', ${HOURS[t]})`);
            await frames(page, 2);
            const n = png(`s4-${q}-${size.join('x')}-${t}-${id}`);
            await shot(page, n);
            const L = await H(page, 'window.__onfoot.lookInfo()'), c = await H(page, 'window.__onfoot.clock()'), s = await H(page, '(() => { const o = window.__onfoot, v = o.vis(), b = o.peopleBrief(); return { state: v.state, live: b.live }; })()');
            summary.shots[n] = { clock: c.label, night: c.night, gold: L.gold, state: s.state, live: s.live };
            return `${n}: ${c.label}, night ${c.night}, gold ${L.gold}, ${s.state}, live ${s.live}`;
          });
        }
      }
    }
    await check(`shots ${LABEL[q]}: no console errors over the run`, async () => { expect(!errors.length, errors.join(' | ')); });
    await ctx.close().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ before and after
// S3a's and S3b's shots taken again on this build, the same way (their names with -s4)
if (want('before')) {
  await check('before/after: S3a\'s Low door, stall and patio (844x390, Saturday 21:00)', async () => {
    const { ctx, page } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.fastForward(30)');
    const out = [];
    for (const pose of ['door', 'stall', 'patio']) {
      if (pose !== 'door') await H(page, "window.__onfoot.crowdAt('outside', 12)");
      await H(page, `window.__onfoot.pose('${pose}')`); await frames(page, 3);
      out.push(await shot(page, png(`s4-before-s3a-${pose}-low-844x390`)));
    }
    await ctx.close().catch(() => {});
    return out.join(', ');
  });
  for (const [name, q, day, hour, pose] of [['s3a-overhead-friday-1280x720', 'high', 'Fri', 21, 'overhead'], ['s3a-tuesday-1280x720', 'high', 'Tue', 15, 'door']]) {
    await check(`before/after: ${name} again (HD)`, async () => {
      const { ctx, page } = await open([1280, 720], `quality=${q}&day=${day}&hour=${hour}&hint=0`);
      await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.buildAll()');
      await H(page, `window.__onfoot.pose('${pose}')`); await H(page, `window.__onfoot.setClock('${day}', ${hour})`); await H(page, 'window.__onfoot.buildAll()');
      await frames(page, 3);
      const n = await shot(page, png(`s4-before-${name}`));
      await ctx.close().catch(() => {});
      return n;
    });
  }
  await check('before/after: S3b\'s guests\' pool match from overhead again (HD, 1280x720)', async () => {
    const { ctx, page } = await open([1280, 720], 'quality=high&day=Sat&hour=21&hint=0');
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.fastForward(3)');
    await H(page, "window.__onfoot.pose('overhead')");
    const ids = await H(page, `window.__onfoot.npcs().filter((n) => n.kind === 'guest' && n.mode === 'live' && n.indoor && !n.walking && n.action !== 'game' && n.action !== 'interact').slice(0, 4).map((n) => n.id)`);
    await H(page, "window.__onfoot.stopMatch('pool-1')");
    await H(page, `window.__onfoot.npcMatch('pool-1', ${ids[0]}, ${ids[1]})`);
    await H(page, 'window.__onfoot.overheadAt(11.0, 6.9, 9)');
    await H(page, 'window.__onfoot.fastForward(0.6)');
    await H(page, 'window.__onfoot.buildAll()');
    await frames(page, 3);
    const n = await shot(page, png('s4-before-s3b-npc-pool-overhead-1280x720'));
    await ctx.close().catch(() => {});
    return n;
  });
}

if (browser) await browser.close().catch(() => {});
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails} of ${results.length} passed`);
process.exit(fails ? 1 : 0);
