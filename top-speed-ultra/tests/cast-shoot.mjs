// The cast's renders (PROJECT_OC_CAST.md): each character front, side and back, and the head front, side and
// three-quarter, from src/onfoot/test-cast.html on the on-foot dev server, into tests/out/cast/. tests/cast-sheets.py
// then sets them beside the same views cropped from the owner's sheets.
//   node tests/cast-shoot.mjs [who,...] [--lod=0] [--quality=high] [--view=lineup|crowd] [--fh=beard] [--hair=<style>]
//                             [--views=head,headThree] [--suffix=-try]   (a variant's frames get the suffix)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'cast');
mkdirSync(OUT, { recursive: true });
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const lod = arg('lod', '0'), quality = arg('quality', 'high'), view = arg('view', 'one'), fh = arg('fh', ''), hairQ = arg('hair', ''), views = arg('views', 'front,side,back,head,headSide,headThree').split(','), suffix = arg('suffix', '');
const who = (process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'mateo-reyes,danny-tran,marcus-bell,leila-farahani,jas-cruz,kate-morgan').split(',');

const server = spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'), ['--config', 'src/onfoot/vite.config.ts', '--port', '5761', '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite did not start')), 120000); server.stdout.on('data', (d) => { if (/Local:/.test(String(d))) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }));
const rows = [];
try {
  if (view !== 'one') {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(900000);
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(`http://127.0.0.1:5761/test-cast.html?view=${view}&lod=${lod}&quality=${quality}`);
    await page.waitForFunction(() => window.__cast?.ready || window.__cast?.error, null, { timeout: 900000 });
    const err = await page.evaluate(() => window.__cast.error); if (err) throw new Error(err);
    await page.evaluate(() => window.__cast.render());
    await page.screenshot({ path: path.join(OUT, `${view}-lod${lod}-${quality}.png`) });
    console.log(JSON.stringify(await page.evaluate(() => window.__cast.stats())));
  } else for (const id of who) {
    const page = await browser.newPage({ viewport: { width: 600, height: 900 } });
    page.setDefaultTimeout(900000);
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:5761/test-cast.html?who=${id}&lod=${lod}&quality=${quality}${fh ? '&fh=' + fh : ''}${hairQ ? '&hair=' + hairQ : ''}`);
    await page.waitForFunction(() => window.__cast?.ready || window.__cast?.error, null, { timeout: 900000 });
    const err = await page.evaluate(() => window.__cast.error); if (err) throw new Error(err);
    for (const a of views) {
      if (a.startsWith('head')) await page.setViewportSize({ width: 600, height: 600 });
      await page.evaluate((a) => window.__cast.shot(a), a);
      await page.screenshot({ path: path.join(OUT, `${id}-${a}${suffix}.png`) });
    }
    const st = await page.evaluate(() => window.__cast.stats());
    rows.push({ id, s: (Date.now() - t0) / 1000, ...st[0] });
    console.log(JSON.stringify(rows.at(-1)));
    await page.close();
  }
} finally { await browser.close(); try { process.kill(-server.pid); } catch { server.kill(); } }
process.exit(0);
