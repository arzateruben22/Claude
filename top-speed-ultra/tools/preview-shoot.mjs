// Render a realism-preview page and save a screenshot, with the renderer's numbers.
//   node tools/preview-shoot.mjs src/preview/test-hands.ts tests/out/preview/hands.png [--size=1280x720]
//        [--query="view=close&skin=2"] [--timeout=900] [--keep]
// The entry is bundled with esbuild into its own folder under tests/out/preview/build/, so several of these can run
// at once without touching dist/. The page must call stage.ready() (see src/preview/stage.ts) when the shot is set.
// SwiftShader renders in software: a frame with post-processing can take a minute or more. Be patient.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [entry, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
if (!entry || !out) { console.error('usage: node tools/preview-shoot.mjs <entry.ts> <out.png> [--size=WxH] [--query=a=b&c=d] [--timeout=s]'); process.exit(2); }
const [w, h] = opt('size', '1280x720').split('x').map(Number);
const timeout = Number(opt('timeout', '900')) * 1000;
const query = opt('query', '');

const name = path.basename(entry).replace(/\.[tj]s$/, '');
const dir = path.join(ROOT, 'tests', 'out', 'preview', 'build', name);
mkdirSync(dir, { recursive: true });
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const t0 = Date.now();
await build({ entryPoints: [path.resolve(entry)], bundle: true, format: 'esm', target: 'es2022', outfile: path.join(dir, 'main.js'), logLevel: 'warning', loader: { '.json': 'json' } });
// inlined: a module script can't be loaded from file:// (CORS)
const js = readFileSync(path.join(dir, 'main.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title></head><body><script type="module">${js}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + (query ? `?${query}` : ''));
let ok = true;
// stop at the first page error rather than waiting out the timeout
const failed = new Promise((res) => page.on('pageerror', () => res('pageerror')));
const r = await Promise.race([
  page.waitForFunction(() => window.__previewReady || window.__previewError, null, { timeout, polling: 500 }).then(() => 'ready', () => 'timeout'),
  failed,
]);
if (r !== 'ready') { ok = false; if (r === 'timeout') logs.push(`timeout: not ready after ${timeout / 1000} s`); }
const err = await page.evaluate(() => window.__previewError ?? null);
if (err) { ok = false; logs.push('error: ' + err); }
const info = await page.evaluate(() => window.__stage?.info() ?? null).catch(() => null);
await page.screenshot({ path: path.resolve(out), timeout: 300000 });
await browser.close();
console.log(JSON.stringify({ ok, out, seconds: Math.round((Date.now() - t0) / 1000), info, logs: logs.slice(0, 20) }));
process.exit(ok ? 0 : 1);
