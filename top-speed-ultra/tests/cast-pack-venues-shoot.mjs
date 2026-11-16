// The pack characters on the venues' own pages (PROJECT_OC_CAST.md): Lot 57 (src/onfoot/index.html) and Stoppage Time
// (src/onfoot/sportsbar.html) on the on-foot dev server, opened with ?char=<chad|chadaline>&pack=test (the standalone
// pages' TEST unlock; a live build ignores it), in third person, in the late afternoon. For each: the page's own
// cast() hook must name the pack character as the avatar and nobody from the pack in the crowd; then two frames from
// a fixed camera 2.6 m from the avatar, one from each side along z, into tests/out/cast/pack-page-<venue>-<who>-a|b.png.
//   node tests/cast-pack-venues-shoot.mjs [chad,chadaline] [--hour=17] [--quality=high]
// Also checks the lock: the same page without &pack=test must NOT show the pack character.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'tests', 'out', 'cast');
mkdirSync(OUT, { recursive: true });
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const hour = arg('hour', '17'), quality = arg('quality', 'high');
const who = (process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'chad,chadaline').split(',');
const server = spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'), ['--config', 'src/onfoot/vite.config.ts', '--port', '5762', '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite did not start')), 120000); server.stdout.on('data', (d) => { if (/Local:/.test(String(d))) { clearTimeout(t); res(); } }); });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args }));
let bad = 0;
const open = async (file, query) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(900000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:5762/${file}?${query}`);
  await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: 900000, polling: 500 });
  const err = await page.evaluate(() => window.__onfootError ?? null);
  if (err) throw new Error(err);
  return { page, errs };
};
try {
  for (const [venue, file] of [['lot57', 'index.html'], ['stoppage', 'sportsbar.html']]) {
    // the lock: without the TEST unlock the page does not play a pack character
    { const { page } = await open(file, `char=chad&view=third&day=Sat&hour=${hour}&quality=phone`);
      const c = await page.evaluate(() => window.__onfoot.cast());
      const ok = c.avatar !== 'chad' && c.choice !== 'chad';
      if (!ok) bad++;
      console.log(JSON.stringify({ venue, check: 'locked without pack=test', ok, avatar: c.avatar, choice: c.choice }));
      await page.close(); }
    for (const id of who) {
      const { page, errs } = await open(file, `char=${id}&pack=test&view=third&day=Sat&hour=${hour}&quality=${quality}`);
      const c = await page.evaluate(() => window.__onfoot.cast());
      const ok = c.avatar === id && c.choice === id && !c.pool.includes('chad') && !c.pool.includes('chadaline') && c.notCast === 0;
      if (!ok || errs.length) bad++;
      for (const [tag, dz] of [['a', 1], ['b', -1]]) {
        await page.evaluate(([dz]) => { const o = window.__onfoot, p = o.pos(); o.view('third'); o.camera([p.x + 0.9 * dz, 1.45, p.z + 2.45 * dz, p.x, 1.0, p.z]); }, [dz]);
        for (let i = 0; i < 4; i++) await page.evaluate(() => window.__onfoot.render?.());
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(OUT, `pack-page-${venue}-${id}-${tag}.png`) });
      }
      console.log(JSON.stringify({ venue, id, ok, avatar: c.avatar, skin: '#' + c.skin.toString(16), hair: c.hair, height: c.height, people: c.people, pool: [...new Set(c.pool)], errors: errs.slice(0, 3) }));
      await page.close();
    }
  }
} finally { await browser.close(); try { process.kill(-server.pid); } catch { server.kill(); } }
console.log(bad ? `FAILED: ${bad} check(s)` : 'all checks passed');
process.exit(bad ? 1 : 0);
