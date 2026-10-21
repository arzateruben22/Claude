import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const GAME = new URL('../dist/top-speed-ultra.html', import.meta.url).pathname;
const port = 18877, base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [new URL('../live/server.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: '/tmp/claude-0/dbg/d.db' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => localStorage.setItem('tsu.settings', JSON.stringify(s)), { quality: 'low', liveUrl: base });
const p = await ctx.newPage();
await p.goto(pathToFileURL(GAME).href); await p.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 120000 }); await p.evaluate(() => { const g = window.__game, o = g.ev.over; window.__results = []; g.ev.over = (r) => { o(r); }; }); await p.goto(pathToFileURL(GAME).href + '?crew=wxyz');
await p.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 120000 });
for (let i = 0; i < 4; i++) {
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => { const w = document.querySelector('.welcome'); return { keys: Object.keys(localStorage), settings: localStorage.getItem('tsu.settings'), welcome: !!w, rect: w && JSON.stringify(w.getBoundingClientRect()), overlays: [...document.querySelectorAll('.overlay')].map(e => e.className) }; }));
}
await b.close(); server.kill();
