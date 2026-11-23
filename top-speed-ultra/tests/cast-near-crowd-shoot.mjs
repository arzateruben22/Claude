// The crowd up close by day (PROJECT_OC_CAST.md): in each venue's own page (Sat 13:00, High), your character is placed
// within 3 m of the nearest crowd member, the page runs until that member's LOD 1 (or LOD 0) is drawn, and the camera
// looks over your shoulder at them. Logs each member within 3.5 m of you with the level it is drawn at; frames in
// tests/out/cast/near-<venue>-<who><suffix>.png.
//   node tests/cast-near-crowd-shoot.mjs [chad] [--venues=lot57,stoppage] [--suffix=-r1] [--port=5793]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'cast');
mkdirSync(OUT, { recursive: true });
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const PORT = arg('port', '5793'), suffix = arg('suffix', ''), venues = arg('venues', 'lot57,stoppage').split(',');
const who = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'chad';
const FILE = { lot57: 'index.html', stoppage: 'sportsbar.html' };

const server = spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'), ['--config', 'src/onfoot/vite.config.ts', '--port', PORT, '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite did not start')), 120000); server.stdout.on('data', (d) => { if (/Local:/.test(String(d))) { clearTimeout(t); res(); } }); });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }));
let fails = 0;
try {
  for (const venue of venues) {
    const t0 = Date.now();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(900000);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/${FILE[venue]}?char=${who}&pack=test&view=third&day=Sat&hour=13&quality=high`);
    await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: 900000, polling: 500 });
    console.log(venue, 'ready', Math.round((Date.now() - t0) / 1000), 's');
    if (venue === 'lot57') await page.evaluate(() => { const o = window.__onfoot; o.peopleReady && o.sim?.(3, true, true); });
    // a member standing still near the middle of the crowd: try spots 1.6 to 2.4 m from them, toward where you are
    const placed = await page.evaluate(() => {
      const o = window.__onfoot, p0 = o.pos(), w = o.cast().where;
      w.sort((a, b) => Math.hypot(a.x - p0.x, a.z - p0.z) - Math.hypot(b.x - p0.x, b.z - p0.z));
      for (const n of w.slice(0, 12)) for (const r of [1.8, 2.2, 1.6, 2.4]) for (let k = 0; k < 12; k++) {
        const a = Math.atan2(p0.z - n.z, p0.x - n.x) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.45;
        const g = o.go(n.x + Math.cos(a) * r, n.z + Math.sin(a) * r);
        if (g && Math.hypot(g.x - n.x, g.z - n.z) < 2.6) return { member: n, you: g };
      }
      return null;
    });
    if (!placed) { console.log(JSON.stringify({ venue, who, placed: null })); fails++; await page.close(); continue; }
    const { member } = placed;
    console.log(venue, 'placed', JSON.stringify(placed), Math.round((Date.now() - t0) / 1000), 's');
    const look = async () => page.evaluate((n) => {
      const o = window.__onfoot, p = o.pos(), dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz) || 1;
      // over your shoulder: 0.9 m behind you and 0.35 m to the side, at eye height, on the member's head
      o.camera([p.x + dx / d * 0.9 - dz / d * 0.35, 1.62, p.z + dz / d * 0.9 + dx / d * 0.35, n.x, 1.45, n.z]);
    }, member);
    await look();
    // run until the member is drawn at LOD 1 or LOD 0 (the venue builds the nearest people's LOD 1 first)
    let state = null;
    for (let i = 0; i < 40; i++) {
      await page.evaluate(() => { const o = window.__onfoot; for (let k = 0; k < 6; k++) o.render?.(); });
      state = await page.evaluate((n) => { const o = window.__onfoot, p = o.pos(), all = o.cast().where; const m = all.filter((q) => Math.hypot(q.x - n.x, q.z - n.z) < 0.6).sort((a, b) => Math.hypot(a.x - n.x, a.z - n.z) - Math.hypot(b.x - n.x, b.z - n.z))[0] ?? null; return { m, near: all.map((q) => ({ cast: q.cast, lod: q.lod, rep: q.rep, d: +Math.hypot(q.x - p.x, q.z - p.z).toFixed(2) })).filter((q) => q.d < 3.5).sort((a, b) => a.d - b.d), you: p }; }, member);
      console.log(venue, 'poll', i, JSON.stringify(state.m), Math.round((Date.now() - t0) / 1000), 's');
      if (state.m && (state.m.lod === 0 || state.m.lod === 1 || /lod[01]/.test(String(state.m.rep)))) break;
      await page.waitForTimeout(1500);
    }
    await look();
    for (let k = 0; k < 4; k++) await page.evaluate(() => window.__onfoot.render?.());
    await page.waitForTimeout(1000);
    const file = `near-${venue}-${who}${suffix}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    // and from beside you, 2 m from the member at 100 degrees either side of your line to them (their face, whichever way
    // they face), with the level each is drawn at then
    const side = [];
    for (const [tag, sg] of [['l', 1], ['r', -1]]) {
      await page.evaluate(([n, sg]) => {
        const o = window.__onfoot, p = o.pos(), a = Math.atan2(p.z - n.z, p.x - n.x) + sg * 1.75;
        o.camera([n.x + Math.cos(a) * 2.0, 1.6, n.z + Math.sin(a) * 2.0, n.x, 1.4, n.z]);
      }, [member, sg]);
      for (let k = 0; k < 6; k++) await page.evaluate(() => window.__onfoot.render?.());
      await page.waitForTimeout(1500);
      for (let k = 0; k < 2; k++) await page.evaluate(() => window.__onfoot.render?.());
      await page.screenshot({ path: path.join(OUT, `near-${venue}-${who}-${tag}${suffix}.png`) });
      side.push(await page.evaluate((n) => { const m = window.__onfoot.cast().where.filter((q) => Math.hypot(q.x - n.x, q.z - n.z) < 0.6)[0]; return m ? { tag: m.cast, lod: m.lod, rep: m.rep ?? m.draw } : null; }, member));
    }
    console.log(venue, 'side frames', JSON.stringify(side));
    const dm = state.m ? +Math.hypot(state.m.x - state.you.x, state.m.z - state.you.z).toFixed(2) : null;
    console.log(JSON.stringify({ venue, who, file, member: state.m && { cast: state.m.cast, lod: state.m.lod, rep: state.m.rep, dFromYou: dm }, within35: state.near, errors: errs.slice(0, 3), s: Math.round((Date.now() - t0) / 1000) }));
    if (!state.m || dm > 3 || !(state.m.lod === 0 || state.m.lod === 1 || /lod[01]/.test(String(state.m.rep)))) fails++;
    await page.close();
  }
} finally { await browser.close(); try { process.kill(-server.pid); } catch { server.kill(); } }
console.log(fails ? `FAIL: ${fails}` : 'all checks passed');
process.exit(fails ? 1 : 0);
