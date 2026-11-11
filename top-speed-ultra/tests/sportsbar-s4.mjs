// Phase S4 checks for the sports bar's page (PROJECT_OC_SPORTS_BAR.md, "### S4: maximum graphics and polish"). Drives
// dist/sportsbar/sportsbar.html (build it with `npx vite build --config src/onfoot/vite.sportsbar.config.ts`) in
// headless Chromium with SwiftShader through window.__onfoot and prints PASS or FAIL with the numbers each check saw.
// Screenshots go in tests/out/sportsbar/; results are merged into tests/out/sportsbar/sportsbar-s4-checks.json.
//
//   node tests/sportsbar-s4.mjs                       every group
//   node tests/sportsbar-s4.mjs --only=look,locked    some groups: look, locked, preset, dance, settings, release, audio, lines,
//                                                      budgets, shots, before
//   --tag=r1   a suffix for every screenshot's name;   --presets=low,hd,ultra   the budgets' and shots' presets
//   --places=tv,bar,pool,freeway,exterior   the shots' places;   --page=<file>   a frozen copy of the build
//   --sizes=1280x720,390x844   the shots' sizes;   --times=noon,golden,night   the shots' times
//
// One browser at a time (this machine is shared by ten workflows). Frames here take seconds: be patient.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE0 = path.join(ROOT, 'dist', 'sportsbar', 'sportsbar.html');
const OUT = path.join(ROOT, 'tests', 'out', 'sportsbar');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const only = arg('only', '').split(',').filter(Boolean);
// --page=<file>: a frozen copy of the build for a long run (so a rebuild meanwhile doesn't change what later groups load)
const PAGE = arg('page', '') ? path.resolve(arg('page', '')) : PAGE0;
const TAG = arg('tag', '');
const PRESETS = arg('presets', 'low,hd,ultra').split(',').map((q) => (q === 'high' ? 'hd' : q));
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
// a portrait size (narrower than it is tall) opens as a phone: DPR 3, isMobile and touch (S4's second repair: the
// art review found the first repair's portrait frames taken at DPR 1, not as a phone)
const PHONE = (size) => size[0] < size[1];
async function open(size, query, init) {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext(PHONE(size) ? { viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: size[0], height: size[1] } });
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
const CAP = { low: 36, hd: 70, ultra: 100 };
const LABEL = { low: 'Low', hd: 'HD', ultra: 'Ultra' };

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
        // Low is Retro (decision 15): the toon materials on, the one full-screen pass, no composer
        expect(L.retro.attached === true && L.retro.toon.meshes > 50 && L.retro.toon.materials > 10, 'Retro: ' + JSON.stringify(L.retro));
      } else {
        expect(L.retro.attached === false && L.retro.toon.meshes === 0, 'Retro still attached at ' + q + ': ' + JSON.stringify(L.retro));
        expect(L.grade && L.relief === (q === 'ultra' ? 512 : 256) && L.cube === (q === 'ultra' ? 256 : 128) && L.rimGain > 0, JSON.stringify(L).slice(0, 300));
        expect(L.swapped.length >= 5 && L.swapped.every((s) => s.hi), 'swaps: ' + JSON.stringify(L.swapped));
        expect(L.composer && L.composer.includes('Grade'), 'no grade pass in ' + JSON.stringify(L.composer));
        if (q === 'ultra') expect(L.clearcoat === 1 && L.sheen === 1 && L.composer.includes('GTAO'), `clearcoat ${L.clearcoat}, sheen ${L.sheen}`);
      }
      // the graphics table's Details row (Saturday 21:00, open): Low neon only, HD plus the pendants' cones, Ultra plus
      // the dust in them; the screens unlit at HD and Ultra; a far streak no taller than the mode's cap
      expect(L.cones === (q !== 'low') && L.dust === (q === 'ultra'), `details: cones ${L.cones}, dust ${L.dust}`);
      expect(q === 'low' ? L.screen === 'lit (Low)' : L.screen === 'unlit', 'screen ' + L.screen);
      expect(L.streams.tall > 0 && L.streams.tall <= 2, 'streams ' + JSON.stringify(L.streams));
      // the performance pass: the light streams' update at this mode's car count (a binary search per car)
      const ts = await H(page, 'window.__onfoot.timeStreams(200)');
      summary.look[q].timeStreams = ts;
      return `${LABEL[q]}: cones ${L.cones}, dust ${L.dust}, screens ${L.screen}, streams ${ts.cars} cars ${ts.ms} ms an update, tall ${L.streams.tall}; pixel ratio ${L.pixelRatio}, relief ${L.relief}, cube ${L.cube} (${L.bakes} bakes, last ${L.lastBakeMs} ms), grade ${L.grade}, rim ${L.rimGain}, clearcoat ${L.clearcoat}, sheen ${L.sheen}, anisotropy ${L.aniso}, composer [${(L.composer ?? []).join(', ')}]; Retro: ${L.retro.attached ? `attached (${L.retro.toon.meshes} meshes, ${L.retro.toon.materials} toon materials, ${L.retro.toon.kept} kept their own, ${L.retro.toon.atlased} on the surface atlas)` : 'detached'}`;
    });
  }
  await check('look: no console errors after the three modes', async () => { expect(!errors.length, errors.join(' | ')); });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ a locked Ultra
if (want('locked')) {
  console.log('locked: no Ultra entitlement on this device: the button reads "Ultra · locked", opens nothing, no price anywhere');
  // no owner flag on this device: cleared on the page, then a reload (S4's repair: an init script that cleared it once
  // per session, by a sessionStorage mark, cleared it again on the second check's reload here, so that check failed)
  const { ctx, page, errors } = await open([844, 390], 'quality=hd&day=Sat&hour=21&hint=0');
  await H(page, "localStorage.removeItem('tsu.owner'); localStorage.removeItem('tsu.settings')");
  await page.reload(); await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
  await check('locked: "Ultra · locked", no price and no purchase path; a tap changes nothing', async () => {
    const L = await H(page, 'window.__onfoot.lookInfo()');
    expect(L.ultraButton === 'Ultra · locked', `button "${L.ultraButton}"`);
    expect(!L.entitlement.unlocked, 'unlocked: ' + L.entitlement.by);
    await H(page, "window.__onfoot.pause ? window.__onfoot.pause(true) : document.getElementById('pauseBtn')?.click()");
    await H(page, "document.querySelector('#segQ [data-q=\"ultra\"]').click()");
    await frames(page, 2);
    const st = await H(page, 'window.__onfoot.stats()');
    expect(st.quality === 'hd', `quality ${st.quality} after tapping a locked Ultra`);
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
    for (const m of ours.matchAll(/^\s*(low|hd|ultra):\s*\{([^}]*)\}/gm)) bar[m[1]] = Object.fromEntries([...m[2].matchAll(/(\w+):\s*('?[\w.]+'?)/g)].map(([, k, v]) => [k, v.replace(/'/g, '')]));
    const pairs = [['low', 'low'], ['hd', 'hd'], ['ultra', 'ultra']], diffs = [];
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
  const { ctx, page, errors } = await open([1280, 720], 'quality=hd&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
  await check('dance: the dance spot\'s lights on a game night, off on a Tuesday, still under reduced motion', async () => {
    const tv = await H(page, 'window.__onfoot.tvAt("Sat", 21)');
    // the lights fade over 1.25 s of page time (a frame here steps at most 0.1 s): wait for them, up to 40 frames
    const settle = (up) => page.waitForFunction((u) => { const d = window.__onfoot.lookInfo().dance; return u ? d > 0.95 : d < 0.05; }, up, { timeout: T, polling: 300 }).catch(() => {});
    await frames(page, 2); await Promise.race([settle(true), frames(page, 40)]);
    const a = await H(page, 'window.__onfoot.lookInfo()');
    await H(page, "window.__onfoot.setClock('Tue', 21)"); await frames(page, 2);
    const tue = await H(page, 'window.__onfoot.tvAt("Tue", 21)');
    await Promise.race([settle(false), frames(page, 40)]);
    const b = await H(page, 'window.__onfoot.lookInfo()');
    await H(page, "window.__onfoot.setClock('Sat', 21)"); await H(page, 'window.__onfoot.reducedMotion(true)'); await frames(page, 2);
    const c = await H(page, 'window.__onfoot.lookInfo()');
    expect(tv.gameNight && a.dance > 0.95, `Saturday: game night ${tv.gameNight}, lights ${a.dance}`);
    expect(!tue.gameNight && b.dance < 0.05, `Tuesday: game night ${tue.gameNight}, lights ${b.dance}`);
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
    expect(sizes[2].place > sizes[1].place && sizes[1].place > sizes[0].place, 'place: ' + sizes.map((s) => s.place).join(' / '));
    expect(sizes[2].caption > sizes[1].caption && sizes[1].caption > sizes[0].caption && sizes[1].sheet > sizes[0].sheet, 'Small under Medium: ' + JSON.stringify(sizes));
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
    const r = await H(page, "window.__onfoot.switchSheet('hd')");
    expect(r.quality === 'hd' && r.sheet.includes('Switching to HD…'), JSON.stringify(r));
    return JSON.stringify(r);
  });
  await check('settings: the transitions: a dip covers the cut into and out of the overhead view, none under reduced motion; the switch sheet fades out', async () => {
    const dip = async () => H(page, "document.getElementById('fade').classList.contains('dip')");
    const clear = () => H(page, "document.getElementById('fade').classList.remove('dip')");
    await clear(); await H(page, "window.__onfoot.view('overhead')"); const into = await dip();
    await clear(); await H(page, "window.__onfoot.view('first')"); const outOf = await dip();
    await H(page, 'window.__onfoot.reducedMotion(true)');
    await clear(); await H(page, "window.__onfoot.view('overhead')"); const intoR = await dip();
    await clear(); await H(page, "window.__onfoot.view('first')");
    const anim = await H(page, "getComputedStyle(document.getElementById('busy')).transitionDuration");
    await H(page, 'window.__onfoot.reducedMotion(false)');
    const animF = await H(page, "getComputedStyle(document.getElementById('busy')).transitionDuration");
    expect(into && outOf && !intoR, `dip into ${into}, out of ${outOf}, reduced ${intoR}`);
    return `dip into the overhead ${into}, out of it ${outOf}, under reduced motion ${intoR}; the switch sheet's fade ${animF} (reduced ${anim})`;
  });
  await check('settings: no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ leaving the venue
// S4's repair: what S4's look and sound made is released when the venue is left (the live game's mount layer calls the
// same release; the page calls it on pagehide)
if (want('release')) {
  console.log('release: S4\'s look and sound released as leaving the venue does (HD, then Low)');
  for (const q of ['hd', 'low']) {
    const { ctx, page, errors } = await open([844, 390], `quality=${q}&day=Sat&hour=21&hint=0`);
    await check(`release ${LABEL[q]}: the look's textures, targets, meshes and materials and the sound's context freed`, async () => {
      await H(page, 'window.__onfoot.audio(true)'); await frames(page, 3);
      const r = await H(page, 'window.__onfoot.releaseS4()');
      await frames(page, 3);
      expect(r.look && r.sound === 'closed' && r.inScene.length === 0, JSON.stringify(r));
      expect(r.after.textures < r.before.textures, 'textures ' + r.before.textures + ' -> ' + r.after.textures);
      // (S4's second repair: the release itself, the one main.ts exports for the mount layer, takes the grade out of
      // the composer; the test hook no longer does it)
      const chain = (await H(page, 'window.__onfoot.lookInfo()')).composer;
      expect(!chain || !chain.includes('Grade'), 'the grade still in the chain: ' + JSON.stringify(chain));
      expect(!errors.length, errors.join(' | '));
      return `the chain after [${(chain ?? []).join(', ')}]; textures ${r.before.textures} -> ${r.after.textures}, geometries ${r.before.geometries} -> ${r.after.geometries}, programs ${r.before.programs} -> ${r.after.programs}; the sound's context ${r.sound}; the dance lights, cones and dust out of the scene; a plain draw after it with no errors (textures then ${r.afterDraw.textures})`;
    });
    await ctx.close().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ the sound
if (want('audio')) {
  console.log('audio: the sound made in code (Saturday 21:00, 844x390, Low then HD): the beds, a pool shot, a goal, the mix, the voice cap');
  const { ctx, page, errors } = await open([844, 390], 'quality=low&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.fastForward(30)');
  await H(page, "window.__onfoot.pose('door')");
  const A = () => H(page, 'window.__onfoot.audio(false)');
  const waitFor = async (js, n = 60) => { for (let i = 0; i < n; i++) { if (await H(page, js)) return true; await frames(page, 1); } return false; };
  await check('audio: starts (as a first tap would) and runs; at Low equal-power panning and 12 voices', async () => {
    await H(page, 'window.__onfoot.audio(true)');
    await waitFor("window.__onfoot.audio(false).state === 'running' && window.__onfoot.audio(false).heads > 0", 40);
    await frames(page, 4);
    const a = await A(); summary.audio = { low: a };
    expect(a.on && a.state === 'running', `state ${a.state}`);
    expect(a.panning === 'equalpower' && a.cap === 12, `panning ${a.panning}, cap ${a.cap}`);
    return `state ${a.state} at ${a.sampleRate} Hz; panning ${a.panning}; cap ${a.cap} (${a.beds} beds)`;
  });
  await check('audio: the room\'s murmur follows the head count; the jukebox plays KFWY; the broadcast bed while a match is on; the interior reverb', async () => {
    await frames(page, 6);
    const a = await A(), on = await H(page, 'window.__onfoot.lookInfo && window.__onfoot.clock().open');
    expect(a.heads >= 20 && a.murmur.every((g) => g > 0.02), `heads ${a.heads}, murmur ${a.murmur.join(', ')}`);
    expect(a.jukebox && a.jukebox.on && a.jukebox.station === 'KFWY' && a.jukebox.gain > 0.1, 'jukebox ' + JSON.stringify(a.jukebox));
    expect(a.wet > 0.25, `reverb send ${a.wet} inside`);
    expect(a.levels.room > -70 && a.levels.music > -80 && a.levels.master > -60, 'levels ' + JSON.stringify(a.levels));
    // a quiet Tuesday afternoon: fewer heads, a quieter murmur
    // (the murmur re-counts heads every 0.5 s of page time: a frame here steps at most 0.1 s, so 8 frames)
    await H(page, "window.__onfoot.setClock('Tue', 15)"); await H(page, 'window.__onfoot.fastForward(20)'); await frames(page, 8);
    const b = await A();
    await H(page, "window.__onfoot.setClock('Sat', 21)"); await H(page, 'window.__onfoot.fastForward(20)'); await frames(page, 8);
    expect(b.heads < a.heads && Math.max(...b.murmur) < Math.max(...a.murmur), `Tuesday 15:00 heads ${b.heads} murmur ${Math.max(...b.murmur)} vs Saturday ${a.heads} ${Math.max(...a.murmur)}`);
    summary.audio.saturday = a; summary.audio.tuesday = b;
    return `open ${on}; Saturday 21:00: ${a.heads} inside, murmur ${a.murmur.join('/')}, broadcast ${a.broadcast}, jukebox ${a.jukebox.station} at ${a.jukebox.gain}, freeway ${a.freeway}, reverb ${a.wet}; levels (dBFS) ${JSON.stringify(a.levels)}; Tuesday 15:00: ${b.heads} inside, murmur ${b.murmur.join('/')}`;
  });
  await check('audio: a pool shot clicks and thuds as the balls collide (modal synthesis), from the physics', async () => {
    const st = await H(page, 'window.__onfoot.stageGames()');
    const id = st?.staged?.pool ?? 'pool-2';
    const before = (await A()).played;
    const r = await H(page, `window.__onfoot.shoot('${id}', { angle: -90, speed: 2.4 })`);
    const ok = await waitFor(`(window.__onfoot.audio(false).played.click ?? 0) > ${before.click ?? 0}`, 80);
    const a = await A();
    expect(ok, `no click in 80 frames after the shot (${JSON.stringify(r).slice(0, 160)}); played ${JSON.stringify(a.played)}`);
    return `${id}: shot ${JSON.stringify(r).slice(0, 120)}; played ${JSON.stringify(a.played)}`;
  });
  await check('audio: a goal on the screens: the crowd\'s cheer (or groan) as one swell, the broadcast rising', async () => {
    const before = (await A()).played;
    // (as S3a's reactions check: the fixture on channel 1 first, then a goal for its home side, so its fans cheer and
    // the other side's groan)
    const fx = await H(page, "window.__onfoot.fireMoment('bigChance', 'X', 1)");
    await frames(page, 2);
    const e = await H(page, `window.__onfoot.fireMoment('goal', '${fx?.home ?? 'X'}', 1)`);
    const ok = await waitFor(`(() => { const p = window.__onfoot.audio(false).played; return (p.cheer ?? 0) + (p.groan ?? 0) > ${(before.cheer ?? 0) + (before.groan ?? 0)}; })()`, 30);
    const a = await A();
    expect(ok, `no cheer or groan after the goal (${JSON.stringify(e)?.slice(0, 100)}); played ${JSON.stringify(a.played)}`);
    return `goal for ${fx?.home} (${fx?.home} v ${fx?.away}); played ${JSON.stringify(a.played)}; excitement ${a.excite}, broadcast ${a.broadcast}; dropped at the cap ${JSON.stringify(a.droppedBy)}, slots taken ${a.stolen}`;
  });
  await check('audio: the mix: a slider at 0 silences its bus; kept on the device', async () => {
    await H(page, "window.__onfoot.setMix('music', 0)"); await frames(page, 4);
    const a = await A();
    const kept = await H(page, "localStorage.getItem('sportsbar.mix')");
    await H(page, "window.__onfoot.setMix('music', 0.6)");
    expect(a.mix.music === 0 && a.levels.music < -90, `music ${a.mix.music}, level ${a.levels.music} dBFS`);
    expect(kept && JSON.parse(kept).music === 0, 'kept: ' + kept);
    const sliders = await H(page, "['room', 'screens', 'music', 'effects'].map((b) => !!document.getElementById('mix-' + b))");
    expect(sliders.every(Boolean), 'sliders ' + sliders);
    return `music at 0: ${a.levels.music} dBFS; kept ${kept}; the pause sheet's four sliders present`;
  });
  await check('audio: HD: HRTF panning and 24 voices; never more one-shots than the cap allows', async () => {
    await H(page, "window.__onfoot.setQuality('hd')"); await frames(page, 3);
    const a = await A(); summary.audio.hd = a;
    expect(a.panning === 'HRTF' && a.cap === 24, `panning ${a.panning}, cap ${a.cap}`);
    expect(a.maxVoices + a.beds <= 24, `max voices ${a.maxVoices} + ${a.beds} beds`);
    return `panning ${a.panning}, cap ${a.cap}; most one-shots at once ${a.maxVoices} (+${a.beds} beds); dropped at the cap ${a.dropped} (${JSON.stringify(a.droppedBy)}), slots taken by a higher sound ${a.stolen}`;
  });
  await check('audio: no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ O38: Ultra's fillers and the facing
if (want('o38')) {
  console.log('o38: Ultra, Saturday 21:00 (week 43, seed 1, 30 sim minutes in): where the fillers go with guests\' games and circles on the floor; the listeners\' facing');
  const { ctx, page, errors } = await open([844, 390], 'quality=ultra&ultra=1&day=Sat&hour=21&hint=0');
  await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)'); await H(page, 'window.__onfoot.fastForward(30)');
  await check('o38: Ultra\'s guests by kind, the fillers by zone, the games and groups on the floor (logged)', async () => {
    const p = await H(page, 'window.__onfoot.peopleBrief()'), f = await H(page, 'window.__onfoot.fillers()'), ms = await H(page, 'window.__onfoot.matches()'), sr = await H(page, 'window.__onfoot.socialReport()');
    const zone = (slot) => String(slot).replace(/\s*\d+.*$/, '').replace(/ (n|s|e|w)$/, '') || '?';
    const byZone = {}; for (const x of f) byZone[zone(x.slot)] = (byZone[zone(x.slot)] ?? 0) + 1;
    summary.o38 = { live: p.live, held: p.held, fillers: p.fillers, target: p.target, byZone, matches: ms.map((m) => m.spot), groups: sr.groups, sizes: sr.sizes };
    expect(!errors.length, errors.join(' | '));
    return `live ${p.live} + held ${p.held} + fillers ${p.fillers} = ${p.live + p.held + p.fillers} of target ${p.target}; fillers by zone ${JSON.stringify(byZone)}; guests' games ${ms.length} (${ms.map((m) => m.spot).join(', ')}); talking groups ${sr.groups} (sizes ${(sr.sizes ?? []).join(',')})`;
  });
  await check('o38: the listeners facing their speaker, S3b\'s way at Ultra (door, tv-east, overhead, 12 frames each; S3b\'s floor 70%)', async () => {
    let fb = 0, nb = 0, fc = 0, nc = 0;
    for (const pose of ['door', 'tv-east', 'overhead']) {
      await H(page, `window.__onfoot.pose('${pose}')`); await frames(page, 3);
      for (let i = 0; i < 12; i++) { await frames(page, 1); const t = await H(page, 'window.__onfoot.talkSample()'); fb += t.body[0]; nb += t.body[1]; fc += t.card[0]; nc += t.card[1]; }
    }
    const share = (fb + fc) / Math.max(1, nb + nc);
    summary.o38.facing = { bodies: [fb, nb], cards: [fc, nc], share: +share.toFixed(3) };
    expect(share >= 0.7, `facing ${(share * 100).toFixed(1)}%`);
    return `bodies ${fb} of ${nb} faced, cards ${fc} of ${nc}: ${(share * 100).toFixed(1)}%`;
  });
  await check('O10: Ultra\'s pool spots\' maps at door and overhead: calls, the members that draw, the empty calls (the plan\'s upper bounds 177 and 187)', async () => {
    const out = [];
    for (const pose of ['door', 'overhead']) {
      await H(page, `window.__onfoot.pose('${pose}')`); await frames(page, 2);
      await H(page, 'window.__onfoot.freeze(true)'); await H(page, 'window.__onfoot.render()');
      const st = await H(page, 'window.__onfoot.stats()'), v = await H(page, 'window.__onfoot.vis()');
      await H(page, 'window.__onfoot.freeze(false)');
      for (const k of ['pool-1', 'pool-2']) {
        const m = st.maps[k], mem = (v.casters?.[k] ?? []).length;
        out.push({ pose, map: k, calls: m?.calls, tris: m?.tris, members: mem, empty: (m?.calls ?? 0) - mem });
        expect(m && m.calls <= (pose === 'door' ? 177 : 187), `${k} at ${pose}: ${m?.calls} calls`);
      }
    }
    summary.o10 = out;
    return out.map((r) => `${r.pose} ${r.map}: ${r.calls} calls (${r.members} casting members, about ${r.empty} empty), ${fmt(r.tris)}`).join('; ');
  });
  await ctx.close().catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the budgets
const PASS = { low: { inside: [118, 203.9e3], outside: [139, 244.3e3], overhead: [118, 197.9e3] }, hd: { inside: [177, 465.7e3], outside: [176, 449.5e3], overhead: [222, 609.4e3] }, ultra: { inside: [302, 1202.6e3], outside: [246, 1086.4e3], overhead: [302, 1180.0e3] } };
const FRAME = { low: { inside: [150, 250e3], outside: [150, 250e3], overhead: [150, 250e3] }, hd: { inside: [294, 718.9e3], outside: [328, 854.6e3], overhead: [374, 1014.5e3] }, ultra: { inside: [1155, 3259.2e3], outside: [683, 3011.9e3], overhead: [1185, 3396.7e3] } };
const SUN = { hd: { inside: [102, 253.1e3], outside: [137, 405.1e3], overhead: [137, 405.1e3] }, ultra: { inside: [177, 656.5e3], outside: [171, 839.2e3], overhead: [187, 839.2e3] } };
const POOLMAP = { inside: [177, 98.8e3], overhead: [187, 98.8e3] };
const POST = { low: 1, hd: 15, ultra: 20 };     // Low: the Retro pass's one full-screen draw
const OUTSIDE_MESHES = { low: 12, hd: 24, ultra: 40 };
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
        // a frozen map (Ultra's pool spots outside) isn't drawn in the frame: only the updating maps count toward it
        const drawn = Object.values(s.maps).filter((m) => !m.frozen);
        const mapCalls = drawn.reduce((a, m) => a + m.calls, 0), mapTris = drawn.reduce((a, m) => a + m.tris, 0);
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
        } else expect(post === 1 && postTris === 2 && !Object.keys(s.maps).length && L.retro.attached, `Low: post ${post} calls/${postTris} tris (the Retro pass's one quad), maps ${Object.keys(s.maps).join(', ')}, Retro ${L.retro.attached}`);
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
// the repair's five places (entrance, bar, pool tables, TVs, patio): the entrance is the front door and the wordmark
// from the lot (the exterior view), the patio the view from its rail toward the freeway
VIEWS.entrance = ['the entrance from the lot', VIEWS.exterior[1]];
// (S4's repair: from the fence by planter 3, clear of the rail stools, which a packed night fills with guests' backs,
// and of the pergola's posts at u 13 and 18.5)
// (S4's second repair: from the east tables over the lit patio, the festoon, the planters and the fence, out to the
// I-5's lamps: the first repair's view from the fence looked over the dark ground beyond it, with no lit foreground)
VIEWS.patio = ['the patio toward the freeway', CAM(17.0, -1.2, 1.7, 12, -60, 2.0)];
// (S4's repair) the TVs and the bar from just over head height, looking a little down (at 1.72 m a packed night's standing guests put a
// head across a third of the frame, and the camera looked up into the ceiling)
// a fixed camera in a packed room can find a guest's head a foot in front of it (the Ultra night TV frame did): from a
// few nearby spots, take the first with no live person within 1.8 m ahead of it (else the least blocked)
const CAMCLEAR = (cands, ey, tu, tv, ty) => `(() => { const o = window.__onfoot, ppl = o.npcs().filter((n) => n.mode === 'live'); let best = null, bestD = -1;
  for (const [eu, ev] of ${JSON.stringify(cands)}) { const dl = Math.hypot(${tu} - eu, ${tv} - ev), du = (${tu} - eu) / dl, dv = (${tv} - ev) / dl; let near = 9;
    for (const n of ppl) { const ru = n.u - eu, rv = n.v - ev, ahead = ru * du + rv * dv, side = Math.abs(ru * dv - rv * du); if (ahead > -0.2 && ahead < 1.8 && side < 0.45 + ahead * 0.45) near = Math.min(near, Math.hypot(ru, rv)); }
    if (near > bestD) { bestD = near; best = [eu, ev]; } if (near === 9) break; }
  const f = o.frame(), g = (u, v) => [f.O[0] + u * f.A[0] + v * f.B[0], f.O[1] + u * f.A[1] + v * f.B[1]]; o.view('first'); const a = g(best[0], best[1]), b = g(${tu}, ${tv}); o.camera([a[0], ${ey}, a[1], b[0], ${ty}, b[1]]); return best; })()`;
VIEWS.tv = ['toward the TV wall', CAMCLEAR([[26.4, 6.6], [25.4, 8.6], [26.4, 4.6], [24.4, 6.6], [24.4, 9.6]], 1.98, 35.7, 4.75, 1.45)];
VIEWS.bar = ['at the bar', CAMCLEAR([[16.0, 11.4], [15.0, 10.8], [17.0, 10.6]], 1.85, 24.0, 15.4, 0.85)];
VIEWS.pool = ['at the pool tables', CAMCLEAR([[13.15, 10.9], [14.4, 10.9], [11.9, 10.9]], 2.15, 12.0, 6.5, 0.55)];
VIEWS.patio = ['the patio toward the freeway', CAMCLEAR([[17.7, -2.75], [18.6, -2.75], [16.8, -2.75]], 1.7, 12, -60, 2.0)];
if (want('shots')) {
  summary.shots = summary.shots ?? {};
  // one page a mode and size (a portrait size opens as a phone); the times in turn, the places at each
  for (const q of PRESETS) for (const size of SIZES) {
    console.log(`shots ${LABEL[q]} ${size.join('x')}${PHONE(size) ? ' (phone: DPR 3, isMobile)' : ''}`);
    const { ctx, page, errors } = await open(size, `quality=${q}&ultra=1&day=Sat&hour=12&hint=0`);
    await H(page, 'window.__onfoot.setWeek(43)'); await H(page, 'window.__onfoot.seed(1)');
    if (q === 'ultra') await H(page, 'window.__onfoot.buildAll()');
    await check(`shots ${LABEL[q]} ${size.join('x')}: boots with no console errors`, async () => { expect(!errors.length, errors.join(' | ')); return `pixel ratio ${await H(page, 'window.__onfoot.lookInfo().pixelRatio')}`; });
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
      for (const id of PLACES) {
        const [label, js] = VIEWS[id];
        await check(`shots ${LABEL[q]} ${size.join('x')} ${t}: ${label}`, async () => {
          await H(page, js);
          await H(page, `window.__onfoot.setClock('Sat', ${HOURS[t]})`);
          await frames(page, 2);
          const n = png(`s4-${q}-${size.join('x')}-${t}-${id}`);
          await shot(page, n);
          const L = await H(page, 'window.__onfoot.lookInfo ? window.__onfoot.lookInfo() : { gold: null }'), c = await H(page, 'window.__onfoot.clock()'), s = await H(page, '(() => { const o = window.__onfoot, v = o.vis(), b = o.peopleBrief(); return { state: v.state, live: b.live }; })()');
          summary.shots[n] = { clock: c.label, night: c.night, gold: L.gold, state: s.state, live: s.live, pixelRatio: L.pixelRatio };
          return `${n}: ${c.label}, night ${c.night}, gold ${L.gold}, ${s.state}, live ${s.live}, pixel ratio ${L.pixelRatio}`;
        });
      }
    }
    await check(`shots ${LABEL[q]} ${size.join('x')}: no console errors over the run`, async () => { expect(!errors.length, errors.join(' | ')); });
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
  for (const [name, q, day, hour, pose] of [['s3a-overhead-friday-1280x720', 'hd', 'Fri', 21, 'overhead'], ['s3a-tuesday-1280x720', 'hd', 'Tue', 15, 'door']]) {
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
    const { ctx, page } = await open([1280, 720], 'quality=hd&day=Sat&hour=21&hint=0');
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
