#!/usr/bin/env node
// After `static-preview.cjs`: point every <video> at the artifact's media store first.
//
//   node scripts/static-preview-media.cjs <out dir> <map.json>
//
// map.json: {"assets/media/<name>.mp4": "/_blob/<id>", ...}, the urls the Artifact tool returned when the preview copies
// were uploaded to the artifact's asset store (publish with `asset: true`; the page declares `capabilities: {assets: {}}`).
// Phones play a video only from a server that answers byte-range requests, and the asset store is the artifact's own
// media path; the published file stays as a second <source>, so a player that can't load one tries the other.
const fs = require("fs");
const path = require("path");
const [outDir, mapFile] = process.argv.slice(2);
if (!outDir || !mapFile) { console.error("usage: node scripts/static-preview-media.cjs <out dir> <map.json>"); process.exit(2); }
const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
let pages = 0, videos = 0;
const missing = new Set();
for (const f of fs.readdirSync(outDir).filter((n) => n.endsWith(".html"))) {
  const p = path.join(outDir, f);
  const html = fs.readFileSync(p, "utf8");
  const next = html.replace(/<video\b([^>]*?)\ssrc="([^"]+)"([^>]*)>/gi, (m, a, src, b) => {
    if (!map[src]) { missing.add(src); return m; }
    videos++;
    return `<video${a}${b}><source src="${map[src]}" type="video/mp4"><source src="${src}" type="video/mp4">`;
  });
  if (next !== html) { fs.writeFileSync(p, next); pages++; }
}
console.log(`${videos} videos in ${pages} pages now play from the media store first`);
if (missing.size) { console.log(`not in the map (left as they were): ${[...missing].join(", ")}`); process.exitCode = 1; }
