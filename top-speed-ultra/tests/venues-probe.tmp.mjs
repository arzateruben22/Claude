import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await b.newContext()).newPage(); page.setDefaultTimeout(300000);
await page.goto(pathToFileURL('/home/user/Claude/tsu-venues/top-speed-ultra/dist/top-speed-ultra.html').href);
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 300000 });
console.log(JSON.stringify(await page.evaluate(() => { const g = window.__game, m = g.vramps(); return [...m.values()].map((r) => { let bd = 1e9, bi = 0; const p = r.path; for (let i = 0; i < p.n; i++) { const d = Math.hypot(p.xs[i] - r.exit.x, p.zs[i] - r.exit.z); if (d < bd) { bd = d; bi = i; } } return { id: p.id, len: Math.round(p.len), next: p.next?.id, out: p.out.map((j) => [Math.round(j.s), j.to.id, j.kind, j.to.label]), sTerm: r.sTerm, near: Math.round(bd), at: Math.round(p.ss[bi]), label: p.label, end: [Math.round(p.xs[p.n-1]), Math.round(p.zs[p.n-1])], term: [r.exit.x, r.exit.z] }; }); }), null, 1));
await b.close();
