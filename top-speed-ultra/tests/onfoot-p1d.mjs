// P1d sweep: Lot 57 at each graphics preset (Low, HD, Ultra) and three clocks (golden hour, Saturday 21:00, noon),
// from one or two fixed views, with stats() at each. One boot per run; the presets are switched in place.
//   node tests/onfoot-p1d.mjs --size=1280x720 [--page=dist/onfoot/index.html] [--tag=p1d] [--presets=low,hd,ultra]
//        [--clocks=golden,sat21,noon] [--views=east,shed,lawn] [--detail=sign,gate,trucks] [--touch] [--legacy]
// --detail: views shot at golden hour and Saturday 21:00 only (the pylon's neon, the gate and its bike racks and menu
// board, the trucks' windows and awnings, the Shed's window). Golden hour (repair r2) is the hour the page's sun is about 5 degrees up
// on Saturday afternoon (found on the page: the sun follows the device's season), not a fixed clock.
// --legacy: the P1c build (its presets are low, high, ultra; 'hd' is sent as 'high'), for the before shots.
// Writes tests/out/onfoot/onfoot-<size>-<view>-<preset>-<clock>-<tag>.png and prints one JSON line per shot.
// One browser at a time on this shared machine.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const PAGE = path.resolve(ROOT, opt('page', 'dist/onfoot/index.html'));
const OUT = path.join(ROOT, 'tests', 'out', 'onfoot');
const [w, h] = opt('size', '1280x720').split('x').map(Number);
const tag = opt('tag', 'p1d');
const presets = opt('presets', 'low,hd,ultra').split(',');
const clocks = opt('clocks', 'golden,sat21,noon').split(',');
const viewsWanted = opt('views', 'east,shed,lawn').split(',');
const detail = opt('detail', '').split(',').filter(Boolean);
const touch = process.argv.includes('--touch');
const legacy = process.argv.includes('--legacy');
const T = 1800000;
// (golden hour: Saturday 15:50 Pacific, the sun about 10 degrees up in mid-November; blue hour 17:10)
const CLOCK = { golden: ['Sat', 15.83], sat21: ['Sat', 21], noon: ['Sat', 12], blue: ['Sat', 17.17] };
// views: [x, z, yaw, pitch] in game coordinates (first person), or a fixed camera [px, py, pz, tx, ty, tz]
const VIEWS = {
  east: { at: [-5115.5, -8361.5, 103, 5] },                     // from by the Shed across the yard to the lawn and trucks
  shed: { at: [-5082, -8390, 298, 4] },                         // from the yard's north-east corner to the Shed's doors
  lawn: { at: [-5080.5, -8374, 68, -4] },                         // the lawn's fire tables, the bag toss, the trucks beyond
  trucks: { at: [-5084, -8350.5, 95, 3] },                      // the trucks' windows and awnings
  sign: { at: [-5145.5, -8404.5, 320, 18] },                        // the pylon and its neon from the corner's sidewalk
  gate: { at: [-5097, -8406, 26, 4] },                          // the frontage: the gate, the bike racks, the yard beyond
  glass: { at: [-5114, -8356, 325, 8] },                        // the Shed's tank-room window at an angle (Ultra's reflections)
};
const t0 = Date.now();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(touch ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: w, height: h } });
const page = await ctx.newPage();
page.setDefaultTimeout(T);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
const q0 = (legacy && presets[0] === 'hd') ? 'high' : presets[0];
await page.goto(pathToFileURL(PAGE).href + `?quality=${q0}&day=Sat&hour=15.83&hint=0`);
await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
const err = await page.evaluate(() => window.__onfootError ?? null);
console.log(JSON.stringify({ booted: Math.round((Date.now() - t0) / 1000), error: err, buildMs: await page.evaluate(() => window.__onfoot?.buildMs) }));
const H = (js) => page.evaluate(js);
const frames = async (n) => { const f0 = await H('window.__onfoot.frames'); await page.waitForFunction((k) => window.__onfoot.frames >= k, f0 + n, { timeout: T, polling: 200 }); };
const ready = async () => { try { await page.waitForFunction(() => !window.__onfoot.peopleReady || window.__onfoot.peopleReady(), null, { timeout: 600000, polling: 1000 }); } catch { /* shoot anyway */ } };
mkdirSync(OUT, { recursive: true });
// golden hour: the Saturday-afternoon hour the sun is nearest 5 degrees up (read from the page's own sun)
if (!err && clocks.includes('golden') && !legacy) {
  let best = 16.2, bd = 99;
  for (let hr = 15.8; hr <= 16.9; hr += 0.05) {
    await H(`window.__onfoot.setClock('Sat', ${hr})`); await frames(1);
    const a = await H('window.__onfoot.stats().look.sunAlt');
    if (Math.abs(a - 5) < bd) { bd = Math.abs(a - 5); best = hr; }
  }
  CLOCK.golden = ['Sat', +best.toFixed(3)];
  console.log(JSON.stringify({ golden: CLOCK.golden, sunOffBy: +bd.toFixed(2) }));
}
if (!err) {
  for (const p of presets) {
    const qq = legacy && p === 'hd' ? 'high' : p;
    const tq = Date.now();
    await H(`window.__onfoot.setQuality(${JSON.stringify(qq)})`);
    await frames(2);
    // (the switch's own toast, "Building your driver up close", gone before the shots)
    await page.waitForTimeout(3000);
    await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t || !t.classList.contains('on'); }, null, { timeout: 240000, polling: 500 }).catch(() => {});
    console.log(JSON.stringify({ preset: p, switchS: Math.round((Date.now() - tq) / 1000) }));
    for (const c of clocks) {
      const [d, hr] = CLOCK[c];
      await H(`window.__onfoot.setClock(${JSON.stringify(d)}, ${hr})`);
      // the sky eases toward a new time: a few frames, then let the environment map catch up
      await frames(3); await ready();
      for (const v of [...viewsWanted, ...(c === 'noon' ? [] : detail)]) {
        const V = VIEWS[v];
        await H(`(() => { const o = window.__onfoot; o.camera(null); o.view('first'); o.go(${V.at[0]}, ${V.at[1]}); o.look(${V.at[2]}, ${V.at[3]}); })()`);
        // (Low: a few more frames, so the parked cars' detail has settled under the phone budget; lot57 makeRoom)
        await frames(p === 'low' ? 10 : 3);
        const name = `onfoot-${w}x${h}-${v}-${p}-${c}-${tag}.png`;
        const ts = Date.now();
        // frame ms measured over the next frames (CPU side, SwiftShader: not a phone's frame rate)
        const fm = await H(`new Promise((res) => { const ms = []; let n = 0; const f = () => { ms.push(window.__onfoot.stats().frameMs); if (++n < 4) requestAnimationFrame(f); else res(ms); }; requestAnimationFrame(f); })`);
        const st = await H('window.__onfoot.stats()');
        // a frame drawn start to finish, three times (software rendering: the presets' relative cost), on the first view
        const tf = v === viewsWanted[0] && !legacy ? await H('window.__onfoot.timeFrames ? window.__onfoot.timeFrames(3) : null') : null;
        // (the canvas textures the visible scene uses: the plan's Low budget is 12 at 512 px)
        const tex = !legacy ? await H('window.__onfoot.textures ? (({ canvas, over512 }) => ({ canvas, over512 }))(window.__onfoot.textures()) : null') : null;
        await page.screenshot({ path: path.join(OUT, name), timeout: 900000 });
        console.log(JSON.stringify({ shot: name, s: Math.round((Date.now() - ts) / 1000), quality: st.quality, calls: st.calls, triangles: st.triangles, frameMs: st.frameMs, frameMsRuns: fm, drawnMs: tf, simMs: st.simMs, crowdMs: st.crowdMs, npcCalls: st.npcCalls, textures: st.textures, canvasTextures: tex, programs: st.programs, pixelRatio: st.pixelRatio, look: st.look ? { style: st.look.style, passes: st.look.passes, sunAlt: st.look.sunAlt, gold: st.look.gold, shadow: st.look.shadowMap, spots: st.look.spotsLit, ao: st.look.ao, mirror: st.look.mirror, rim: st.look.rimGain, aniso: st.look.anisotropy, bloom: st.look.bloom, toon: st.look.toon } : null, lights: st.lights ?? null, peopleDrawn: st.npcsDrawn, bodies: st.bodies, impostors: st.impostors, clock: (await H('window.__onfoot.clock()')).label }));
      }
    }
  }
}
await browser.close();
console.log(JSON.stringify({ done: Math.round((Date.now() - t0) / 1000), logs: logs.slice(0, 40) }));
