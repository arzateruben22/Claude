// The Chad hero test on foot (PROJECT_OC_CAST.md, "Chad hero test"): Chad in Stoppage Time (src/onfoot/sportsbar.html on
// the on-foot dev server, ?char=chad&pack=test, the standalone page's TEST unlock) by day, in third person, the camera
// 2 m from him, at Ultra and at High; frames into tests/out/cast/hero/venue-stoppage-chad-<quality>-<a|b>.png with the
// avatar's level of detail and triangles. With --time: the cost of a frame on foot in Lot 57 (index.html) at Low (the
// phone's preset), third person, by the page's own timeFrames hook (software rendering: compare builds back to back).
//   node tests/chad-hero-venue.mjs [--qualities=ultra,hd] [--hour=13] [--who=chad] [--time=30] [--port=5772] [--suffix=]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'cast', 'hero');
mkdirSync(OUT, { recursive: true });
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const qualities = arg('qualities', 'ultra,hd').split(',').filter(Boolean), hour = arg('hour', '13'), who = arg('who', 'chad'), timeN = Number(arg('time', '0')), port = Number(arg('port', '5772')), suffix = arg('suffix', '');
const server = spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'), ['--config', 'src/onfoot/vite.config.ts', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite did not start')), 180000); server.stdout.on('data', (d) => { if (/Local:/.test(String(d))) { clearTimeout(t); res(); } }); });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }));
let bad = 0;
const open = async (file, query, viewport = { width: 1280, height: 720 }) => {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(900000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/${file}?${query}`);
  await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: 900000, polling: 500 });
  const err = await page.evaluate(() => window.__onfootError ?? null);
  if (err) throw new Error(err);
  return { page, errs };
};
try {
  for (const quality of qualities) {
    const { page, errs } = await open('sportsbar.html', `char=${who}&pack=test&view=third&day=Sat&hour=${hour}&quality=${quality}`);
    const c = await page.evaluate(() => window.__onfoot.cast());
    for (const [tag, dx, dz, y, ty] of [['a', 0.35, 1.97, 1.62, 1.22], ['b', -1.25, 1.56, 1.66, 1.3]]) {
      await page.evaluate(([dx, dz, y, ty]) => { const o = window.__onfoot, p = o.pos(); o.view('third'); o.camera([p.x + dx, y, p.z + dz, p.x, ty, p.z]); }, [dx, dz, y, ty]);
      for (let i = 0; i < 4; i++) await page.evaluate(() => window.__onfoot.render?.());
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, `venue-stoppage-${who}-${quality}-${tag}${suffix}.png`) });
    }
    const you = await page.evaluate(() => window.__onfoot.cast().you ?? window.__onfoot.stats?.().avatar ?? null);
    if (c.avatar !== who || errs.length || (you && you.lod !== 0)) bad++;
    console.log(JSON.stringify({ venue: 'stoppage', quality, avatar: c.avatar, hair: c.hair, height: c.height, you, errors: errs.slice(0, 3) }));
    await page.close();
  }
  if (timeN > 0) {
    const { page, errs } = await open('index.html', `char=${who}&pack=test&view=third&day=Sat&hour=${hour}&quality=low`, { width: 390, height: 844 });
    await page.evaluate(() => { const o = window.__onfoot, p = o.pos(); o.view('third'); });
    await page.waitForTimeout(1500);
    const runs = [];
    for (let k = 0; k < 3; k++) runs.push(await page.evaluate((n) => window.__onfoot.timeFrames(n), timeN));
    const st = await page.evaluate(() => { const s = window.__onfoot.stats(); return { quality: s.quality, view: s.view, avatar: s.avatar, calls: s.calls, triangles: s.triangles, programs: s.programs }; });
    console.log(JSON.stringify({ venue: 'lot57', timeFrames: runs.map((r) => ({ median: r.median, min: r.min })), ...st, errors: errs.slice(0, 3) }));
    await page.close();
  }
} finally { await browser.close(); try { process.kill(-server.pid); } catch { server.kill(); } }
console.log(bad ? `FAILED: ${bad} check(s)` : 'all checks passed');
process.exit(bad ? 1 : 0);
