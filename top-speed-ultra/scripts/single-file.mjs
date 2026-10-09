// After `vite build`: fold the built CSS and JS into one self-contained page.
//   dist/top-speed-ultra.html  a full page you can open straight from disk
//   dist/artifact.html         the same content without the document shell (for hosts that add their own)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const assets = join(dist, 'assets');
const files = readdirSync(assets);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const safe = js.replace(/<\/script/gi, '<\\/script');
const head = `<title>Top Speed OC: Ultra</title>
<meta name="description" content="First-person sports-car freeway driving in the browser: a live Southern California freeway at speed.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@400;500;600;700;800&display=swap">
<style>${css}</style>`;
const body = `<div id="root"></div>
<noscript>Top Speed OC: Ultra is a 3D driving game and needs JavaScript and WebGL.</noscript>
<script type="module">${safe}</script>`;
writeFileSync(join(dist, 'artifact.html'), `${head}\n${body}\n`);
writeFileSync(join(dist, 'top-speed-ultra.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log(`single-file: ${(js.length / 1024).toFixed(0)} KB js, ${(css.length / 1024).toFixed(1)} KB css`);
