// After `vite build`: fold the built CSS and JS into one self-contained page.
//   dist/top-speed-ultra.html  a full page you can open straight from disk
//   dist/artifact.html         the same content without the document shell (for hosts that add their own)
// The images Vite emits next to them (the OC wordmark cut-outs and its mask) go in as data URIs, so the page needs
// no other file; the fonts stay a Google Fonts link.
// The chunks the game's dynamic imports produce (the on-foot venues, loaded only when you get out of the car) go in
// too, without a file or a blob URL each: every one becomes a function in a second module script, registered by name
// and run on its first import; the entry hands its exports to the chunks that import from it (see foldChunks below).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';

const dist = new URL('../dist/', import.meta.url).pathname;
const assets = join(dist, 'assets');
const files = readdirSync(assets);
// the entry is the script the built index.html loads; every other .js file is a chunk it (or another chunk) imports
const entry = /src="\.\/assets\/([^"]+\.js)"/.exec(readFileSync(join(dist, 'index.html'), 'utf8'))?.[1];
if (!entry || !files.includes(entry)) throw new Error('single-file: no entry script in dist/index.html');
const chunkFiles = files.filter((f) => f.endsWith('.js') && f !== entry);
let js = readFileSync(join(assets, entry), 'utf8');
const chunks = new Map(chunkFiles.map((f) => [f, readFileSync(join(assets, f), 'utf8')]));
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
  const size = () => js.length + css.length + [...chunks.values()].reduce((n, c) => n + c.length, 0), before = size();
  js = js.replace(ref, uri); css = css.replace(ref, uri);
  for (const [k, c] of chunks) chunks.set(k, c.replace(ref, uri));
  if (size() === before) throw new Error(`single-file: ${f} is in dist/assets but nothing refers to it`);
  inlined += uri.length;
}
// ------------------------------------------------------------------------------------------- the chunks
// Rollup's ES chunks start with their imports (import{a as b}from"./x.js";) and end with their exports
// (export{c as d};). A chunk is folded into a function that takes its imports as arguments (a destructuring of each
// dependency's exports) and returns its exports; import("./x.js") anywhere becomes globalThis.__tsuChunks.load("x.js").
// The entry keeps running as the page's module script; its export statement becomes a hand-over of the same names.
// Each chunk's function is its own scope, inside a module script of its own, so no minified name meets another's.
const REGISTRY = `(()=>{const g=globalThis,defs={},mods={},wait={};g.__tsuChunks={set(n,e){mods[n]=Promise.resolve(e)},def(n,d,f){defs[n]={d,f};const w=wait[n];if(w){delete wait[n];w()}},load(n){return mods[n]||(mods[n]=new Promise((r)=>{if(defs[n])r(defs[n]);else wait[n]=()=>r(defs[n])}).then(async(c)=>{const x=await Promise.all(c.d.map((m)=>g.__tsuChunks.load(m))),a={};c.d.forEach((m,i)=>{a[m]=x[i]});return c.f(a)}))}}})();`;
const dyn = (code) => code.replace(/\bimport\(\s*["']\.\/([^"']+\.js)["']\s*\)/g, (_m, n) => `globalThis.__tsuChunks.load(${JSON.stringify(n)})`);
const specs = (list) => list.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = /^(\S+)\s+as\s+(\S+)$/.exec(x); return m ? [m[1], m[2]] : [x, x]; });
const exportsOf = (code) => {
  const m = /export\s*\{([^}]*)\}\s*;?\s*$/.exec(code);
  return m ? { body: code.slice(0, m.index), names: specs(m[1]) } : { body: code, names: [] };
};
const handOver = (names) => `{${names.map(([local, out]) => `${JSON.stringify(out)}:${local}`).join(',')}}`;
function foldChunk(name, code) {
  let rest = code, deps = [], pre = [];
  for (;;) {
    rest = rest.replace(/^\s+/, '');
    let m = /^import\s*\{([^}]*)\}\s*from\s*["']\.\/([^"']+)["']\s*;?/.exec(rest);
    if (m) { deps.push(m[2]); pre.push(`const{${specs(m[1]).map(([a, b]) => `${JSON.stringify(a)}:${b}`).join(',')}}=__tsuI[${JSON.stringify(m[2])}];`); rest = rest.slice(m[0].length); continue; }
    m = /^import\s*\*\s*as\s*(\S+)\s*from\s*["']\.\/([^"']+)["']\s*;?/.exec(rest);
    if (m) { deps.push(m[2]); pre.push(`const ${m[1]}=__tsuI[${JSON.stringify(m[2])}];`); rest = rest.slice(m[0].length); continue; }
    m = /^import\s*["']\.\/([^"']+)["']\s*;?/.exec(rest);
    if (m) { deps.push(m[1]); rest = rest.slice(m[0].length); continue; }
    break;
  }
  if (/^\s*import[\s{*"']/.test(rest) || /\bexport\s*\{[^}]*\}\s*from\b/.test(rest)) throw new Error(`single-file: ${name} has an import or re-export this script doesn't fold`);
  const { body, names } = exportsOf(rest);
  for (const d of deps) if (d !== entry && !chunks.has(d)) throw new Error(`single-file: ${name} imports ${d}, which isn't in dist/assets`);
  return `globalThis.__tsuChunks.def(${JSON.stringify(name)},${JSON.stringify(deps)},async function(__tsuI){${pre.join('')}\n${dyn(body)}\nreturn ${handOver(names)};});`;
}
const ent = exportsOf(dyn(js));
js = ent.body + (chunks.size ? `\nglobalThis.__tsuChunks.set(${JSON.stringify(entry)},${handOver(ent.names)});\n` : '');
const folded = [...chunks].map(([n, c]) => foldChunk(n, c)).join('\n');
let chunkKB = 0; for (const c of chunks.values()) chunkKB += c.length / 1024;
const esc = (code) => code.replace(/<\/script/gi, '<\\/script');
const safe = esc(js);
const head = `<title>OC Ultra: Top Speed</title>
<meta name="description" content="First-person sports-car freeway driving in the browser: a live Southern California freeway at speed.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Saira+Semi+Condensed:wght@400;700;800&display=swap">
<style>${css}</style>`;
const body = (root) => `${root}
<noscript>OC Ultra: Top Speed is a 3D driving game and needs JavaScript and WebGL.</noscript>
${chunks.size ? `<script>${REGISTRY}</script>\n` : ''}<script type="module">${safe}</script>${chunks.size ? `\n<script type="module">${esc(folded)}</script>` : ''}`;
// The owner's test build: the artifact page (the owner's private test link) opens with owner mode on, every car to
// drive, the OC Hypercar included (src/game/settings.ts ownerTestBuild). Only the artifact page is marked, and never
// when VITE_OWNER_TEST_BUILD is "false" or VITE_PAYMENTS_LIVE is "true" (the store's live switch, .env.example); the
// game also ignores the mark in a live-mode build. The page that opens from disk (and the regression suite) is unmarked.
const env = loadEnv('production', new URL('..', import.meta.url).pathname, 'VITE_');
const ownerTest = String(env.VITE_PAYMENTS_LIVE ?? '').trim() !== 'true' && String(env.VITE_OWNER_TEST_BUILD ?? '').trim() !== 'false';
writeFileSync(join(dist, 'artifact.html'), `${head}\n${body(ownerTest ? '<div id="root" data-build="owner-test"></div>' : '<div id="root"></div>')}\n`);
writeFileSync(join(dist, 'top-speed-ultra.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body('<div id="root"></div>')}\n</body>\n</html>\n`);
console.log(`single-file: ${(js.length / 1024).toFixed(0)} KB js (+ ${chunks.size} chunks, ${chunkKB.toFixed(0)} KB, loaded on demand), ${(css.length / 1024).toFixed(1)} KB css, ${(inlined / 1024).toFixed(1)} KB of images inlined; artifact page ${ownerTest ? 'marked as the owner test build (owner mode on)' : 'unmarked'}`);
