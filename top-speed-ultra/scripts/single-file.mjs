// After `vite build`: fold the built CSS and JS into one self-contained page.
//   dist/top-speed-ultra.html  a full page you can open straight from disk
//   dist/artifact.html         the same content without the document shell (for hosts that add their own)
// The images Vite emits next to them (the OC wordmark cut-outs and its mask) go in as data URIs, so the page needs
// no other file; the fonts stay a Google Fonts link.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';

const dist = new URL('../dist/', import.meta.url).pathname;
const assets = join(dist, 'assets');
const files = readdirSync(assets);
let js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
let css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const MEDIA = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
let inlined = 0;
for (const f of files) {
  const type = MEDIA[f.split('.').pop().toLowerCase()];
  if (!type) continue;
  const uri = `data:${type};base64,${readFileSync(join(assets, f)).toString('base64')}`;
  // CSS says url(./name) (it sits in assets/ too); JS says new URL("assets/name", import.meta.url) or "./assets/name".
  // A data URI is absolute, so new URL() hands it back unchanged.
  const ref = new RegExp(`(?:\\./)?(?:assets/)?${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
  const before = js.length + css.length;
  js = js.replace(ref, uri); css = css.replace(ref, uri);
  if (js.length + css.length === before) throw new Error(`single-file: ${f} is in dist/assets but nothing refers to it`);
  inlined += uri.length;
}
const safe = js.replace(/<\/script/gi, '<\\/script');
const head = `<title>OC Ultra: Top Speed</title>
<meta name="description" content="First-person sports-car freeway driving in the browser: a live Southern California freeway at speed.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Saira+Semi+Condensed:wght@400;700;800&display=swap">
<style>${css}</style>`;
const body = (root) => `${root}
<noscript>OC Ultra: Top Speed is a 3D driving game and needs JavaScript and WebGL.</noscript>
<script type="module">${safe}</script>`;
// The owner's test build: the artifact page (the owner's private test link) opens with owner mode on, every car to
// drive, the OC Hypercar included (src/game/settings.ts ownerTestBuild). Only the artifact page is marked, and never
// when VITE_OWNER_TEST_BUILD is "false" or VITE_PAYMENTS_LIVE is "true" (the store's live switch, .env.example); the
// game also ignores the mark in a live-mode build. The page that opens from disk (and the regression suite) is unmarked.
const env = loadEnv('production', new URL('..', import.meta.url).pathname, 'VITE_');
const ownerTest = String(env.VITE_PAYMENTS_LIVE ?? '').trim() !== 'true' && String(env.VITE_OWNER_TEST_BUILD ?? '').trim() !== 'false';
writeFileSync(join(dist, 'artifact.html'), `${head}\n${body(ownerTest ? '<div id="root" data-build="owner-test"></div>' : '<div id="root"></div>')}\n`);
writeFileSync(join(dist, 'top-speed-ultra.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body('<div id="root"></div>')}\n</body>\n</html>\n`);
console.log(`single-file: ${(js.length / 1024).toFixed(0)} KB js, ${(css.length / 1024).toFixed(1)} KB css, ${(inlined / 1024).toFixed(1)} KB of images inlined; artifact page ${ownerTest ? 'marked as the owner test build (owner mode on)' : 'unmarked'}`);
