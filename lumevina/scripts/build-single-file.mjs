// Builds the whole site as ONE self-contained page: every style, script,
// image, photo and font inside it, nothing else to fetch.
//
//   node scripts/build-single-file.mjs        (from lumevina/)
//   → dist/lumevina.html
//
// This is how v1 was shared, and why it opened instantly anywhere (the
// Claude preview, a text, an email): one file instead of a hundred
// requests, so the Lumevina logo animation plays the moment it opens.
// Publish the preview from this file (the page itself; no other files).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const MIME = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", woff2: "font/woff2" };
const cache = new Map();
const missing = new Set();
const dataUri = (ref) => {
  const rel = ref.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
  if (!cache.has(rel)) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) { missing.add(rel); return null; }
    const ext = rel.split(".").pop().toLowerCase();
    cache.set(rel, `data:${MIME[ext]};base64,${fs.readFileSync(file).toString("base64")}`);
  }
  return cache.get(rel);
};
// a path to one of the site's images or fonts, in HTML, CSS or a script
const ASSET = /(?:\.\.\/)?(?:img|fonts)\/[A-Za-z0-9_\-/.]+\.(?:png|webp|jpe?g|gif|svg|woff2)/g;
const inlineAssets = (text) => text.replace(ASSET, (m) => dataUri(m) || m);
// a script's text can't contain "</script" inside an inline <script>
const safeScript = (js) => js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

let html = read("index.html");
// things a single file doesn't need: font preloads (the fonts are inside) and the app manifest
html = html.replace(/\s*<link rel="preload"[^>]*>/g, "").replace(/\s*<link rel="manifest"[^>]*>/g, "");
// images in the page itself (the logo, service photos, favicons…)
html = inlineAssets(html);
// the stylesheet, with its fonts and images inside
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, href) => `<style>\n${inlineAssets(read(href))}\n</style>`);
// every script, in the same order
let scripts = 0;
html = html.replace(/<script src="((?:js)\/[^"]+)"><\/script>/g, (_, src) => {
  scripts++;
  return `<script>/* ${src} */\n${safeScript(inlineAssets(read(src)))}\n</script>`;
});

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/lumevina.html"), html);
const left = (html.match(/(?:src|href)="(?:css|js|img|fonts)\//g) || []).length;
console.log(`dist/lumevina.html: ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB, ${scripts} scripts and ${cache.size} images/fonts inside` +
  (missing.size ? `; not found: ${[...missing].join(", ")}` : "") + (left ? `; ${left} file links left` : "; nothing left to fetch"));
