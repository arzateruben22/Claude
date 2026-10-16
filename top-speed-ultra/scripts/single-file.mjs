// After `vite build`: fold the built CSS and JS into one self-contained page.
//   dist/top-speed-ultra.html  a full page you can open straight from disk
//   dist/artifact.html         the same content without the document shell (for hosts that add their own)
// The images Vite emits next to them (the OC wordmark cut-outs and its mask) go in as data URIs, so the page needs
// no other file; the fonts stay a Google Fonts link.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
const body = `<div id="root"></div>
<noscript>OC Ultra: Top Speed is a 3D driving game and needs JavaScript and WebGL.</noscript>
<script type="module">${safe}</script>`;
writeFileSync(join(dist, 'artifact.html'), `${head}\n${body}\n`);
writeFileSync(join(dist, 'top-speed-ultra.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log(`single-file: ${(js.length / 1024).toFixed(0)} KB js, ${(css.length / 1024).toFixed(1)} KB css, ${(inlined / 1024).toFixed(1)} KB of images inlined`);
