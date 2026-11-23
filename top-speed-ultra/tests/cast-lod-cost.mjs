// The cost of the cast's cut coarse levels (Look.cleanLod: splitLooks fills LOD 1 and LOD 2 toward their triangle budgets,
// and the face's features are laid on as flat triangles), measured where it is paid: Lot 57's crowd at the phone tier
// (PROJECT_OC_CAST.md, the r1 repair of 2026-11-16). Opens the venue's own page on the on-foot dev server twice over,
// alternating ?lodcut=0 (the coarse levels as before the cuts: A) and the build as it is (B), stands the player 2.3 m from
// the nearest person, waits for the near levels to finish building, and reports the time to draw frames
// (__onfoot.timeFrames, software rendering: a relative cost, not a phone's fps), the people drawn at each level, their
// triangles, and how many were starved of their near level by the tier's triangle budget.
//   node tests/cast-lod-cost.mjs [--pairs=2] [--quality=phone] [--hour=13] [--frames=20]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const pairs = Number(arg('pairs', 2)), quality = arg('quality', 'phone'), hour = arg('hour', '13'), frames = Number(arg('frames', 20));
const server = spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'), ['--config', 'src/onfoot/vite.config.ts', '--port', '5764', '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite did not start')), 120000); server.stdout.on('data', (d) => { if (/Local:/.test(String(d))) { clearTimeout(t); res(); } }); });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }));
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const rows = [];
try {
  for (let k = 0; k < pairs * 2; k++) {
    const cut = k % 2 === 1, t0 = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(900000);
    await page.goto(`http://127.0.0.1:5764/index.html?char=leila-farahani&view=third&day=Sat&hour=${hour}&quality=${quality}${cut ? '' : '&lodcut=0'}`);
    await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: 900000, polling: 500 });
    // stand 2.3 m from the nearest person (the same rule both ways; the crowd is seeded, so it is the same person)
    const placed = await page.evaluate(() => { const o = window.__onfoot, p = o.pos(), w = o.cast().where.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); for (const n of w.slice(0, 4)) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, at = o.go(n.x + Math.sin(a) * 2.3, n.z + Math.cos(a) * 2.3); if (at) return { cast: n.cast, at }; } return null; });
    for (let i = 0; i < 40; i++) { for (let j = 0; j < 3; j++) await page.evaluate(() => window.__onfoot.render()); await page.waitForTimeout(3000); const s = await page.evaluate(() => window.__onfoot.stats()); if (!s.lod1Pending && i >= 2) break; }
    const ms = [];
    for (let i = 0; i < 3; i++) { const r = await page.evaluate((n) => window.__onfoot.timeFrames(n), frames); ms.push(r.median); }
    const s = await page.evaluate(() => { const s = window.__onfoot.stats(), p = window.__onfoot.pos(), w = window.__onfoot.cast().where.map((m) => +Math.hypot(m.x - p.x, m.z - p.z).toFixed(1)).filter((d) => d < 3.2); return { lod1: s.lod1, lod2: s.lod2, impostors: s.impostors, npcTris: s.npcTris, npcCalls: s.npcCalls, triangles: s.triangles, starved: s.peopleStarved, lod1Built: s.lod1Built, lod1Pending: s.lod1Pending, within3: w.length, crowdMs: s.crowdMs }; });
    rows.push({ run: k, mode: cut ? 'B cut (as built)' : 'A lodcut=0 (as before)', msPerFrame: +med(ms).toFixed(1), all: ms.map((x) => +x.toFixed(1)), ...s, placed: placed?.cast ?? null, s: Math.round((Date.now() - t0) / 1000) });
    console.log(JSON.stringify(rows.at(-1)));
    await ctx.close();
  }
} finally { await browser.close(); try { process.kill(-server.pid); } catch { server.kill(); } }
const A = rows.filter((r) => r.run % 2 === 0).map((r) => r.msPerFrame), B = rows.filter((r) => r.run % 2 === 1).map((r) => r.msPerFrame);
console.log(JSON.stringify({ A: A, B: B, medianA: med(A), medianB: med(B), ratio: +(med(B) / med(A)).toFixed(3) }));
process.exit(0);
