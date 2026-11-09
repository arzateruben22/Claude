// Proof frames for the venues in the game (Phase 3a / J1): from the driving game to Lot 57 and to Stoppage Time and
// back, shot from the single-file artifact page as a phone sees it (dist/artifact.html has no viewport meta, since the
// artifact host adds the shell, so a copy with one injected is loaded at 390 x 844, touch, DPR 3), plus one
// 1440 x 900 desktop frame of each venue. Frames go to tests/out/venues/.
//   npm run build && node tests/venues-shoot.mjs [--only=phone|desk]
// One browser at a time on this machine; software rendering at DPR 3 takes a while per frame.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'venues');
mkdirSync(OUT, { recursive: true });
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7);
// the phone proof rule: the artifact page with a viewport meta injected
const art = readFileSync(path.join(ROOT, 'dist', 'artifact.html'), 'utf8');
const PHONE_PAGE = path.join(OUT, 'artifact-phone.html');
writeFileSync(PHONE_PAGE, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + art);
const DESK_PAGE = path.join(ROOT, 'dist', 'top-speed-ultra.html');

const t0 = Date.now();
const T = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const log = [];
const say = (...a) => { const l = [T(), ...a].join(' '); log.push(l); console.log(l); };

async function open(file, phone) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, density: 'moderate', time: 'sunset', weather: 'clear', hudStyle: 'modern' }));
    localStorage.setItem('lot57.seen', '1');
  });
  const page = await ctx.newPage(); page.setDefaultTimeout(900000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 600000 });
  await page.getByRole('radio', { name: /Free Drive/ }).click();
  await page.getByRole('button', { name: 'Drive', exact: true }).click();
  await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 300000 });
  return { ctx, page, errors };
}
const frames = async (page, n, key = '__game') => { const f0 = await page.evaluate((k) => window[k].frames, key); await page.waitForFunction(([k, t]) => window[k].frames >= t, [key, f0 + n], { timeout: 600000 }); };
// (this round's frames carry -r1: the venue's own Drive, reached by tapping Car, is the way back at both venues)
const SUF = '-r1';
const shot = async (page, name) => { name = name.replace(/\.png$/, `${SUF}.png`); await page.screenshot({ path: path.join(OUT, name), timeout: 600000 }); say('frame', name); };
// the way back as a player takes it: tap Car (it walks you to the driver's door; the walk is run ahead with the venue's
// sim), wait for Drive on the venue's action button, shoot it there by your car (third person), tap Drive, and wait for
// the cockpit; then a cruise down the on-ramp to show it merges
async function driveByButton(page, touch, prefix) {
  const press = (sel) => (touch ? page.tap(sel) : page.click(sel));
  const where = () => page.evaluate(() => { const o = window.__onfoot, p = o.pos(), d = o.yourCar().door; return { actions: o.actions(), m: +Math.hypot(p.x - d.x, p.z - d.z).toFixed(2), indoors: p.indoors ?? null }; });
  say(prefix, 'before Car', JSON.stringify(await where()));
  await press('#onfoot-host #car');
  await page.waitForFunction(() => window.__onfoot.pos().moving || window.__onfoot.actions()[0] === 'Drive', null, { timeout: 600000 });
  await page.evaluate(() => window.__onfoot.sim(90, true, true));
  const w = await where();
  say(prefix, 'after Car', JSON.stringify(w));
  if (w.actions[0] !== 'Drive') throw new Error(`${prefix}: no Drive after Car: ${JSON.stringify(w)}`);
  await page.waitForFunction(() => { const b = document.querySelector('#onfoot-host #act'); return b && b.classList.contains('on') && b.textContent === 'Drive'; }, null, { timeout: 600000 });
  await page.evaluate(() => { const o = window.__onfoot, c = o.yourCar(), p = o.pos(), s = c.stall; o.view('third'); o.look((Math.atan2(s.x - p.x, s.z - p.z) * 180) / Math.PI + 35, -10); });
  await frames(page, 3, '__onfoot');
  await shot(page, `${prefix}-5-drive-by-your-car.png`);
  await press('#onfoot-host #act');
  await page.waitForFunction(() => !window.__game.venue() && !window.__onfoot && !document.getElementById('onfoot-host'), null, { timeout: 300000 });
  await frames(page, 4); await page.waitForTimeout(500);
  await shot(page, `${prefix}-6-back-on-the-ramp.png`);
  say(prefix, 'back', JSON.stringify(await page.evaluate(() => { const g = window.__game, s = g.stats; return { path: s.id, label: s.path, main: s.main, leads: g.net.leadsTo(g.path), s: +s.s.toFixed(1), mph: Math.round(Math.abs(s.v) * 2.237), styles: document.querySelectorAll('style[data-onfoot]').length }; })));
  await page.evaluate(() => window.__game.fastForward(40, {}, 28));
  await frames(page, 4); await page.waitForTimeout(500);
  await shot(page, `${prefix}-7-merged.png`);
  say(prefix, 'after a 40 s cruise', JSON.stringify(await page.evaluate(() => { const s = window.__game.stats; return { path: s.id, label: s.path, main: s.main, mph: Math.round(Math.abs(s.v) * 2.237) }; })));
}

// drive to the venue: on its exit's carriageway 2.5 km out, the route set, Auto-drive running down to just short of
// the exit (rendered: the corner map's route), then on to the fade
async function toVenue(page, venue, prefix) {
  const r = await page.evaluate((venue) => {
    const g = window.__game, ramp = g.net.paths[venue === 'Lot 57' ? 1142 : 124], j = ramp.inc[0];
    g.placeCar(j.to, Math.max(5, j.toS - 2600), 1, 28);
    g.navigateTo(venue); g.setAutoDrive(true);
    g.fastForward(30);
    return { route: g.route.map((x) => x.to.id), dest: g.routeName };
  }, venue);
  say(venue, 'route', JSON.stringify(r));
  await frames(page, 4);
  await shot(page, `${prefix}-1-route.png`);
  const d = await page.evaluate(() => { const g = window.__game; let t = 0; while (t < 300 && !g.venue()) { g.fastForward(0.5); t += 0.5; } return { t, venue: g.venue(), path: g.path.id, s: g.phys.s, auto: g.autoDriving }; });
  say(venue, 'drove', JSON.stringify(d));
  // (the toast has usually gone by the time a DPR 3 frame is read back; the same words stay on screen above Get out)
  await page.waitForFunction(() => document.querySelector('.venue-park .getout') && /street driving isn't built yet/.test(document.querySelector('.venue-note')?.textContent ?? ''), null, { timeout: 300000 });
  await page.waitForTimeout(500);
  await shot(page, `${prefix}-2-arrival.png`);
  say(venue, 'arrived', JSON.stringify(await page.evaluate(() => window.__game.venue())));
}
async function getOut(page) {
  await page.evaluate(() => window.__game.getOut());
  await page.waitForFunction(() => window.__onfoot?.ready, null, { timeout: 900000 });
  await frames(page, 3, '__onfoot');
}
// face your own car from beside it, then (third person) see yourself by it
async function byYourCar(page, prefix) {
  await page.evaluate(() => {
    const o = window.__onfoot, c = o.yourCar(), p = o.pos(), s = c.stall;
    o.view('third'); o.look((Math.atan2(s.x - p.x, s.z - p.z) * 180) / Math.PI + 35, -10);
  });
  await frames(page, 3, '__onfoot');
  await shot(page, `${prefix}-3-by-your-car.png`);
}

if (only !== 'desk') {
  const { ctx, page, errors } = await open(PHONE_PAGE, true);
  // ---- Lot 57
  await toVenue(page, 'Lot 57', 'phone-lot57');
  await getOut(page);
  await byYourCar(page, 'phone-lot57');
  // into the yard: stand by a group of regulars and look at them
  await page.evaluate(() => {
    const o = window.__onfoot, gs = o.groups().filter((g) => g.active && !g.seated), g = gs[0] ?? o.groups()[0];
    const a = Math.atan2(-5121 - g.x, -8345 - g.z) + 0.6, r = g.r + 3.2;
    const at = o.go(g.x + Math.sin(a) * r, g.z + Math.cos(a) * r);
    if (at) o.look((Math.atan2(g.x - at.x, g.z - at.z) * 180) / Math.PI, -6);
    o.sim(1, false, true);
  });
  await frames(page, 4, '__onfoot');
  await shot(page, 'phone-lot57-4-inside-people.png');
  say('Lot 57 stats', JSON.stringify(await page.evaluate(() => { const s = window.__onfoot.stats(); return { npcs: s.npcs, drawn: s.npcsDrawn, guests: s.guests, inside: s.inside, quality: s.quality, crowd: s.crowd }; })));
  await driveByButton(page, true, 'phone-lot57');
  // ---- Stoppage Time
  await toVenue(page, 'Stoppage Time', 'phone-stoppage');
  await getOut(page);
  await byYourCar(page, 'phone-stoppage');
  await page.evaluate(() => {
    // in through the front door (the point just inside it the bar's own page can start you at), looking on in
    const o = window.__onfoot, d0 = o.doors().find((x) => x.id === 'front'), d = o.startAt().door;
    o.view('first'); o.tap(d.x, d.z); o.sim(60, true);
    o.look((Math.atan2(d.x - d0.x, d.z - d0.z) * 180) / Math.PI, -4);
  });
  await frames(page, 4, '__onfoot');
  await shot(page, 'phone-stoppage-4-inside.png');
  say('Stoppage pos', JSON.stringify(await page.evaluate(() => window.__onfoot.pos())));
  await driveByButton(page, true, 'phone-stoppage');
  // ---- the other phone sizes: landscape, parked with Get out
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => { const g = window.__game; g.placeCar(g.net.paths[1142], 290, 0, 0); g.arriveVenue(); });
  await page.waitForSelector('.venue-park .getout'); await page.waitForTimeout(1500);
  await shot(page, 'phone-landscape-844x390-getout.png');
  say('errors (phone)', JSON.stringify(errors.slice(0, 5)));
  await ctx.close();
}
if (only !== 'phone') {
  const { ctx, page, errors } = await open(DESK_PAGE, false);
  for (const [venue, prefix] of [['Lot 57', 'desk-lot57'], ['Stoppage Time', 'desk-stoppage']]) {
    await page.evaluate((v) => { const g = window.__game; g.placeCar(g.net.paths[v === 'Lot 57' ? 1142 : 124], v === 'Lot 57' ? 290 : 300, 0, 0); g.arriveVenue(); }, venue);
    await page.waitForSelector('.venue-park .getout'); await page.waitForTimeout(2500);
    if (venue === 'Lot 57') await shot(page, 'desk-1440x900-getout.png');
    await getOut(page);
    await page.evaluate((v) => {
      const o = window.__onfoot;
      if (v === 'Lot 57') { const g = o.groups().find((x) => x.active) ?? o.groups()[0]; const at = o.go(g.x + 3.5, g.z + 3.5); if (at) o.look((Math.atan2(g.x - at.x, g.z - at.z) * 180) / Math.PI, -6); }
      else { const d0 = o.doors().find((x) => x.id === 'front'), d = o.startAt().door; o.tap(d.x, d.z); o.sim(60, true); o.look((Math.atan2(d.x - d0.x, d.z - d0.z) * 180) / Math.PI, -4); }
    }, venue);
    await frames(page, 4, '__onfoot');
    await shot(page, `${prefix}-1440x900.png`);
    await driveByButton(page, false, prefix);
  }
  say('errors (desk)', JSON.stringify(errors.slice(0, 5)));
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(OUT, 'shoot-log.txt'), log.join('\n') + '\n');
