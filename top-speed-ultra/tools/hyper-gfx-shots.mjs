// In-game frames of the OC Hypercar for its G1 graphics pass: Free Drive on I-405 North in owner mode, a route set
// with Go To (so the cluster, the console screen and the head-up display show a real next turn), cruising, then one
// frame per shot from the named camera.
//   node tools/hyper-gfx-shots.mjs <outDir> <shot> [<shot> ...] [--html=dist/top-speed-ultra.html]
//   shot: name:quality:time:cam:WxH[:dpr[:mobile]]   e.g. seat-ultra-day:ultra:day:cockpit:1280x720  phone:low:night:cockpit:390x844:3:1
// One browser for every shot, one shot at a time (a context each). Prints one JSON line per shot: the renderer's
// figures (calls, triangles, pixel ratio, drawing buffer), the cockpit's console and HUD words, any page errors.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const dir = path.resolve(args[0]);
mkdirSync(dir, { recursive: true });
const html = path.resolve(ROOT, opt('html', 'dist/top-speed-ultra.html'));
let browser;
try { browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); }
catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); }
// shots that share a size, a pixel ratio and touch run in one page, one after another (a boot is minutes here)
const specs = args.slice(1).map((spec) => { const [name, quality, time, cam, size, dpr = '1', mobile = '0'] = spec.split(':'); return { name, quality, time, cam, size, dpr, mobile }; });
const groups = [];
for (const s of specs) { const k = `${s.size}:${s.dpr}:${s.mobile}`; let g = groups.find((x) => x.k === k); if (!g) groups.push(g = { k, list: [] }); g.list.push(s); }
for (const grp of groups) {
  const { size, dpr, mobile, quality: q0, time: t0s } = grp.list[0];
  const [w, h] = size.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr), isMobile: mobile === '1', hasTouch: mobile === '1' });
  await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { quality: q0, adaptive: false, density: 'light', time: t0s, owner: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(600000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  let booted = false, routed = false;
  for (const { name, quality, time, cam } of grp.list) {
    const t0 = Date.now();
    let facts = null;
    try {
      if (!booted) {
        await page.goto(pathToFileURL(html).href + '#owner');
        await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 600000, polling: 1000 });
        await page.evaluate(() => window.__game.chooseOwnerCar('oc-hyper'));
        // Free Drive from the menu (the UI closes with it)
        await page.getByRole('button', { name: 'Drive', exact: true }).click();
        await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar') && window.__game.driving === 'oc-hyper', null, { timeout: 600000, polling: 1000 });
        routed = await page.evaluate(() => {
          const g = window.__game;
          Object.assign(g.input.c, { throttle: 0, brake: 0, steer: 0, thrust: 0 });
          g.fastForward(4, {}, 31);
          return g.navigateTo('CA-55 North') || g.navigateTo('I-5 South') || false;
        });
        booted = true;
      }
      await page.evaluate(({ quality, time, cam }) => {
        const g = window.__game;
        if (g.settings.quality !== quality || g.settings.time !== time) g.updateSettings({ ...g.settings, quality, time, adaptive: false });
        g.fastForward(2, {}, 31);
        g.setCam(cam);
      }, { quality, time, cam });
      // let the frames run (the displays redraw on a tick, the sky settles), cruising
      await page.waitForTimeout(5000);
      facts = await page.evaluate(() => {
        const g = window.__game, r = g.renderer;
        const ck = g.car?.interior?.group?.userData?.dash ?? null;
        return { car: g.driving, mode: g.mode, mph: Math.round(g.phys.vx * 2.237), calls: r.info.render.calls, tris: r.info.render.triangles, pr: r.getPixelRatio(), buffer: [r.domElement.width, r.domElement.height],
          console: ck?.console?.shown ?? null, hud: ck?.hud?.shown ?? null, cluster: ck?.main?.shown ? { mph: ck.main.shown.mph, next: ck.main.shown.next } : null };
      }).catch((e) => ({ err: String(e).slice(0, 200) }));
      facts.routed = routed;
      await page.screenshot({ path: path.join(dir, `${name}.png`), timeout: 600000 });
    } catch (e) { errors.push(String(e.message || e).split('\n')[0].slice(0, 200)); }
    console.log(JSON.stringify({ name, quality, time, cam, size, dpr, mobile, seconds: Math.round((Date.now() - t0) / 1000), facts, errors: errors.splice(0) }));
  }
  await ctx.close();
}
await browser.close();
