// Smoothness of the OC Hypercar's seat view (the G1 graphics pass): a 60 s Free Drive from the driver's seat at
// cruising speed, steering to full lock left and right in turn (5 s each way), frame times from requestAnimationFrame.
//   node tools/hyper-gfx-perf.mjs <html> <profile> [--seconds=60] [--quality=ultra]
//   profile: desktop (1280 x 720) | phone (390 x 844, DPR 3, touch, the CPU throttled 4x through CDP)
// Prints one JSON line: p50 and p95 frame time (ms), frames, the renderer's calls and triangles (the last frame), the JS
// heap at the start and the end of the drive (Chromium's performance.memory), page errors.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const [html, profile = 'desktop'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const seconds = Number(opt('seconds', '60')), quality = opt('quality', profile === 'phone' ? 'low' : 'ultra');
const phone = profile === 'phone';
let browser;
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'];
try { browser = await chromium.launch({ args }); } catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }); }
const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { quality, adaptive: false, density: 'light', time: 'day', owner: true });
const page = await ctx.newPage(); page.setDefaultTimeout(900000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const t0 = Date.now();
let out = null;
try {
  await page.goto(pathToFileURL(path.resolve(html)).href + '#owner');
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 900000, polling: 1000 });
  await page.evaluate(() => window.__game.chooseOwnerCar('oc-hyper'));
  await page.getByRole('button', { name: 'Drive', exact: true }).click();
  await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar') && window.__game.driving === 'oc-hyper', null, { timeout: 900000, polling: 1000 });
  if (phone) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  out = await page.evaluate(async (seconds) => {
    const g = window.__game, r = g.renderer;
    g.setCam('cockpit');
    g.fastForward(3, {}, 31);
    // settle 3 s, then measure
    await new Promise((res) => setTimeout(res, 3000));
    const heap0 = performance.memory?.usedJSHeapSize ?? 0;
    const dts = []; let last = performance.now(); const tEnd = last + seconds * 1000;
    await new Promise((res) => {
      const f = (now) => {
        dts.push(now - last); last = now;
        const t = (now - (tEnd - seconds * 1000)) / 1000;
        // full lock one way, then the other, 5 s each; enough throttle to hold a cruise
        Object.assign(g.input.c, { steer: Math.floor(t / 5) % 2 ? -1 : 1, throttle: g.phys.vx < 28 ? 0.6 : 0.15, brake: 0 });
        if (now < tEnd) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
    Object.assign(g.input.c, { steer: 0, throttle: 0 });
    const heap1 = performance.memory?.usedJSHeapSize ?? 0;
    const s = dts.slice(1).sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return { frames: s.length, p50: Math.round(q(0.5) * 10) / 10, p95: Math.round(q(0.95) * 10) / 10, calls: r.info.render.calls, tris: r.info.render.triangles, pr: r.getPixelRatio(), buffer: [r.domElement.width, r.domElement.height], heap0, heap1, car: g.driving };
  }, seconds);
} catch (e) { errors.push(String(e.message || e).split('\n')[0].slice(0, 200)); }
await browser.close();
console.log(JSON.stringify({ label: opt('label', ''), profile, quality, seconds: Math.round((Date.now() - t0) / 1000), out, errors }));
