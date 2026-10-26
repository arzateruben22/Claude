// Renders the Prism Studio skyline wallpaper (scene.js) in headless Chromium and writes the
// JPEGs to public/wallpaper/.
//
//   npm run wallpaper                      # every file, full quality (a few minutes)
//   node scripts/wallpaper/render.mjs --preview --out /tmp/wp   # quick half-size look, 1x
//   node scripts/wallpaper/render.mjs --only portrait
//
// Needs the globally installed Playwright (its bundled Chromium renders WebGL2 through
// SwiftShader, so no GPU is required) and three.js r160 from kits/cinema/vendor.

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '../..');
const THREE_FILE = process.env.THREE_PATH ?? resolve(appRoot, '../kits/cinema/vendor/three.module.min.js');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const preview = flag('--preview');
const outDir = resolve(opt('--out', join(appRoot, 'public/wallpaper')));
const only = opt('--only', 'all');
const ss = Number(opt('--ss', preview ? 1 : 2));
const scale = preview ? 0.5 : 1;

if (!existsSync(THREE_FILE)) {
  console.error(`three.js not found at ${THREE_FILE} (set THREE_PATH)`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)(execSync('npm root -g').toString().trim() + '/playwright'));
} catch {
  console.error('Playwright is not installed globally: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
}

const FILES = {
  '/scene.html': [join(here, 'scene.html'), 'text/html'],
  '/scene.js': [join(here, 'scene.js'), 'text/javascript'],
  '/three.module.js': [THREE_FILE, 'text/javascript'],
};

const JOBS = [
  // the 3840 file for 2x screens and a 1920 copy for 1x (globals.css picks one with image-set)
  { key: 'landscape', format: 'landscape', width: 3840, height: 2160, file: 'skyline-landscape.jpg', half: 'skyline-landscape-1920.jpg' },
  { key: 'portrait', format: 'portrait', width: 1440, height: 3120, file: 'skyline-portrait.jpg' },
].filter((j) => only === 'all' || only === j.key);

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 2000)); });
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.route('http://wallpaper.local/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  const f = FILES[path];
  if (!f) return route.fulfill({ status: 404, body: 'not found' });
  return route.fulfill({ status: 200, contentType: f[1], body: readFileSync(f[0]) });
});
await page.goto('http://wallpaper.local/scene.html');
await page.waitForFunction(() => window.wallpaperReady === true, null, { timeout: 60000 });

const save = (file, dataUrl) => {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const p = join(outDir, file);
  writeFileSync(p, buf);
  return { path: p, kb: Math.round(statSync(p).size / 1024) };
};

for (const job of JOBS) {
  const width = Math.round(job.width * scale), height = Math.round(job.height * scale);
  const t = Date.now();
  const res = await page.evaluate((o) => window.renderWallpaper(o), {
    format: job.format, width, height, ss, quality: 0.88, soft: 0,
  });
  const main = save(job.file, res.jpeg);
  console.log(`${job.file}  ${width}x${height}  ${main.kb} KB  ${((Date.now() - t) / 1000).toFixed(1)} s`, JSON.stringify(res.counts), JSON.stringify(res.timings));
  console.log('  look:', JSON.stringify(res.stats));
  if (job.half) {
    // the 1x copy: the finished frame downscaled in the same browser (high-quality smoothing), so no image library is needed
    const half = await page.evaluate(async ({ src, w }) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = w; c.height = Math.round(img.height * w / img.width);
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.86);
    }, { src: res.jpeg, w: Math.round(width / 2) });
    const h = save(job.half, half);
    console.log(`${job.half}  ${Math.round(width / 2)}px  ${h.kb} KB`);
  }
}
await browser.close();
