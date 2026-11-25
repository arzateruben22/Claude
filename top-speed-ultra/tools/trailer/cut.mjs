// The trailer's cut (control/trailer/TRAILER_PLAN.md, Step 3): title cards rendered in the game's own page with its
// own OC Ultra lockup and type, then /usr/bin/ffmpeg cuts the captured frames and the cards to the 124 BPM timeline.
//   node tools/trailer/cut.mjs --build=<dir with top-speed-ultra.html> --frames=<capture out dir> --out=<dir>
// Writes <out>/cards/*.png, <out>/segments/*.mp4, <out>/trailer-clean.mp4 (no marks) and <out>/trailer-beats.mp4
// (the silent cut with a beat tick and a bar.beat counter in the corner, for cutting music to later).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHOTS, BEAT, BAR } from './shots.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const FF = '/usr/bin/ffmpeg', FPS = 30, W = 1920, H = 1080;
const GAME = path.join(path.resolve(opt('build', 'dist')), 'top-speed-ultra.html');
const FR = path.resolve(opt('frames', 'trailer-frames')), OUT = path.resolve(opt('out', 'trailer-cut'));
for (const d of ['cards', 'segments']) mkdirSync(path.join(OUT, d), { recursive: true });
const ff = (args) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const n = (bars) => Math.round(bars * BAR * FPS);

// ---------------------------------------------------------------- cards, in the game's page (its CSS, its fonts)
const CARDS = {
  c1: { head: 'The real 405', sub: "Orange County's freeways, built from open map data" },
  c2: { head: 'Sunrise to midnight', sub: 'Five cars. One coast. Your pace.' },
  c3: { logo: true, sub: 'Coming soon to Google Play and the App Store' },
};
{
  const browser = await chromium.launch({ executablePath: process.env.TRAILER_CHROME || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  await page.addInitScript(() => localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'low', adaptive: false, look: 'ultra', theme: 'dark', owner: true, master: 0, music: 0 })));
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu .lockup'), null, { timeout: 240000 });
  await page.evaluate(() => { window.__game.setPaused(true); document.fonts.ready; });
  await page.waitForTimeout(1500);
  const shoot = async (id, c, transparent = false) => {
    await page.evaluate(({ c, transparent }) => {
      window.__lock ??= document.querySelector('.overlay.menu .lockup').cloneNode(true);
      const lock = window.__lock.cloneNode(true);
      document.body.innerHTML = '';
      const root = document.createElement('div');
      root.style.cssText = `position:fixed;inset:0;display:grid;place-content:center;justify-items:center;gap:34px;text-align:center;
        background:${transparent ? 'transparent' : 'radial-gradient(120% 90% at 50% 58%, #0b1a33 0%, var(--void) 62%, #000 100%)'}`;
      if (c.logo) { lock.style.setProperty('--mk', '760px'); root.appendChild(lock); }
      if (c.head) {
        const w = document.createElement('p'); w.className = 'word'; w.dataset.text = c.head;
        w.style.cssText = 'font-size:150px;transform:skewX(-8deg)'; const s = document.createElement('span'); s.dataset.text = c.head; s.textContent = c.head; w.appendChild(s); root.appendChild(w);
      }
      if (c.sub) {
        const s = document.createElement('p'); s.className = 'lockup-sub'; s.textContent = c.sub;
        s.style.cssText = `font-size:${c.logo ? 30 : 26}px;letter-spacing:0.3em;color:var(--dim);margin:${c.logo ? "40px 0 0" : "0"}`; root.appendChild(s);
      }
      if (c.label) {
        root.style.cssText = 'position:fixed;inset:0;background:transparent';
        const l = document.createElement('p'); l.className = 'lockup-sub'; l.textContent = c.label;
        l.style.cssText = `position:absolute;bottom:64px;${c.side}:80px;margin:0;font-size:30px;letter-spacing:0.36em;color:var(--ink);text-shadow:0 2px 12px #000a`;
        root.appendChild(l);
      }
      document.documentElement.style.background = transparent ? 'transparent' : '#000';
      document.body.style.background = 'transparent';
      document.body.appendChild(root);
    }, { c, transparent });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'cards', `${id}.png`), omitBackground: transparent });
  };
  for (const [id, c] of Object.entries(CARDS)) await shoot(id, c);
  await shoot('label-retro', { label: 'Retro Low', side: 'right' }, true);
  await shoot('label-ultra', { label: 'Ultra', side: 'left' }, true);
  await browser.close();
}

// ---------------------------------------------------------------- segments (H.264 intermediates, identical params)
const X264 = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const order = [];
const shotSeg = (s, extra = '') => {
  const out = path.join(OUT, 'segments', `${s.id}.mp4`), N = n(s.bars);
  ff(['-framerate', String(FPS), '-i', path.join(FR, s.id, 'f%04d.jpg'), '-frames:v', String(N), '-vf', `scale=${W}:${H},setsar=1${extra}`, ...X264, out]);
  order.push(out);
};
const cardSeg = (id, bars) => {
  const out = path.join(OUT, 'segments', `${id}.mp4`), d = bars * BAR;
  // in on its downbeat (a quarter of a beat), out in the last few frames before the next bar's cut
  ff(['-loop', '1', '-framerate', String(FPS), '-i', path.join(OUT, 'cards', `${id}.png`), '-frames:v', String(n(bars)),
    '-vf', `scale=${W}:${H},setsar=1,fade=t=in:st=0:d=${(BEAT / 4).toFixed(3)},fade=t=out:st=${(d - 0.12).toFixed(3)}:d=0.12`, ...X264, out]);
  order.push(out);
};
const by = Object.fromEntries(SHOTS.map((s) => [s.id.split('-')[0], s]));
shotSeg(by.s1, ',fade=t=in:st=0:d=0.25');
cardSeg('c1', 1);
shotSeg(by.s2); shotSeg(by.s3); shotSeg(by.s4);
cardSeg('c2', 1);
shotSeg(by.s5); shotSeg(by.s6);
{ // S7: the same frames twice, Retro Low then Ultra, wiped left to right; each carries its own label
  const s = by.s7, N = n(s.bars), lead = 9, wipe = 1.2, out = path.join(OUT, 'segments', `${s.id}.mp4`);
  ff(['-framerate', String(FPS), '-i', path.join(FR, s.id, 'retro', 'f%04d.jpg'), '-framerate', String(FPS), '-i', path.join(FR, s.id, 'ultra', 'f%04d.jpg'),
    '-i', path.join(OUT, 'cards', 'label-retro.png'), '-i', path.join(OUT, 'cards', 'label-ultra.png'),
    '-filter_complex', `[0:v]trim=end_frame=${N},setpts=PTS-STARTPTS,format=yuv420p[r0];[r0][2:v]overlay=0:0,format=yuv420p,settb=1/${FPS}[r];` +
      `[1:v]trim=start_frame=${lead}:end_frame=${N},setpts=PTS-STARTPTS,format=yuv420p[u0];[u0][3:v]overlay=0:0,format=yuv420p,settb=1/${FPS}[u];` +
      `[r][u]xfade=transition=wiperight:duration=${wipe}:offset=${(lead / FPS).toFixed(4)},setsar=1[v]`,
    '-map', '[v]', '-frames:v', String(N), ...X264, out]);
  order.push(out);
}
shotSeg(by.s8);
cardSeg('c3', 1);

// ---------------------------------------------------------------- the cut, clean and with beat marks
const list = path.join(OUT, 'segments', 'list.txt');
writeFileSync(list, order.map((f) => `file '${f}'`).join('\n') + '\n');
const FINAL = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an'];
ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', 'setsar=1', ...FINAL, path.join(OUT, 'trailer-clean.mp4')]);
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf';
const b = BEAT.toFixed(6), br = BAR.toFixed(6);
const marks = [
  // a tick on every beat (3 frames), a bigger one on each bar's downbeat
  `drawbox=x=W-150:y=40:w=26:h=26:color=white@0.9:t=fill:enable='lt(mod(t+0.0001\\,${b})\\,0.1)'`,
  `drawbox=x=W-158:y=32:w=42:h=42:color=0x408cff@0.95:t=4:enable='lt(mod(t+0.0001\\,${br})\\,0.1)'`,
  `drawtext=fontfile=${font}:fontsize=26:fontcolor=white@0.9:box=1:boxcolor=black@0.45:boxborderw=8:x=W-108:y=40:text='%{eif\\:floor((t+0.0001)/${br})+1\\:d}.%{eif\\:mod(floor((t+0.0001)/${b})\\,4)+1\\:d}'`,
  `drawtext=fontfile=${font}:fontsize=22:fontcolor=white@0.8:box=1:boxcolor=black@0.45:boxborderw=6:x=40:y=H-60:text='124 BPM  %{pts\\:hms}'`,
];
ff(['-i', path.join(OUT, 'trailer-clean.mp4'), '-vf', marks.join(','), ...FINAL, path.join(OUT, 'trailer-beats.mp4')]);
console.log(JSON.stringify({ out: OUT, segments: order.length, expectSeconds: 62 * BEAT }, null, 1));
