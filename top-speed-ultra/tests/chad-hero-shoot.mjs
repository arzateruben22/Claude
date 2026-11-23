// The Chad hero test's frames (PROJECT_OC_CAST.md, "Chad hero test"): the head close up from the front, three-quarter,
// profile and back, the hair from above and from above and behind, and portraits, from src/onfoot/test-cast.html on the
// on-foot dev server, into tests/out/cast/hero/.
//   node tests/chad-hero-shoot.mjs [--who=chad] [--quality=high] [--lod=0] [--hair=<style>] [--size=900]
//                                  [--views=yaw0,yaw-40,yaw-90,yaw180,above0,above180,near0,near-40] [--suffix=-hero]
//                                  [--time=40] [--w=390 --h=844]
// Prints the page's stats (triangles, draw calls, build times) and, per view, the frame's triangles and draw calls.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'cast', 'hero');
mkdirSync(OUT, { recursive: true });
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const who = arg('who', 'chad').split(','), quality = arg('quality', 'high'), lod = arg('lod', '0'), hair = arg('hair', ''), size = Number(arg('size', '900')), suffix = arg('suffix', '-hero'), extra = arg('q', '');
const views = arg('views', 'yaw0,yaw-40,yaw-90,yaw180,above0,above180,near0,near-40').split(',');
const port = Number(arg('port', '5771')), timeN = Number(arg('time', '0')), vw = Number(arg('w', '0')), vh = Number(arg('h', '0'));
const server = spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'), ['--config', 'src/onfoot/vite.config.ts', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite did not start')), 180000); server.stdout.on('data', (d) => { if (/Local:/.test(String(d))) { clearTimeout(t); res(); } }); });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }));
let bad = 0;
try {
  for (const id of who) {
    const page = await browser.newPage({ viewport: { width: vw || size, height: vh || size } });
    page.setDefaultTimeout(900000);
    page.on('pageerror', (e) => { bad++; console.log('pageerror', e.message); });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 300)); });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/test-cast.html?who=${id}&lod=${lod}&quality=${quality}${hair ? '&hair=' + hair : ''}${extra ? '&' + extra : ''}`);
    await page.waitForFunction(() => window.__cast?.ready || window.__cast?.error, null, { timeout: 900000, polling: 500 });
    const err = await page.evaluate(() => window.__cast.error); if (err) throw new Error(err);
    for (const a of views) {
      const r = await page.evaluate((a) => window.__cast.shot(a), a);
      await page.screenshot({ path: path.join(OUT, `${id}-${a}${suffix}.png`) });
      console.log(JSON.stringify({ id, view: a, ...r }));
    }
    // --time=N: the cost of drawing this person alone, N frames from the last view (software rendering: a relative cost;
    // compare two builds back to back)
    if (timeN > 0) {
      const t = await page.evaluate((n) => {
        const gl = document.querySelector('canvas').getContext('webgl2'), px = new Uint8Array(4), out = [];
        for (let i = 0; i < n + 3; i++) { const t0 = performance.now(); window.__cast.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (i >= 3) out.push(performance.now() - t0); }
        out.sort((a, b) => a - b);
        return { median: +out[Math.floor(n / 2)].toFixed(2), min: +out[0].toFixed(2), mean: +(out.reduce((a, b) => a + b, 0) / n).toFixed(2) };
      }, timeN);
      console.log(JSON.stringify({ id, quality, lod, view: views.at(-1), frameMs: t }));
    }
    const st = await page.evaluate(() => window.__cast.stats());
    console.log(JSON.stringify({ id, quality, lod, s: (Date.now() - t0) / 1000, ...st[0] }));
    await page.close();
  }
} finally { await browser.close(); try { process.kill(-server.pid); } catch { server.kill(); } }
process.exit(bad ? 1 : 0);
