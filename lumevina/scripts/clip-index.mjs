// The TikTok clip index: one line per rendered 9:16 clip, with its hook from
// marketing/tiktok.md and its length from docs/school/videos.js, written to
// marketing/ads/out/video/README.md so Ruben can grab a week's clip without
// opening the pack.   node scripts/clip-index.mjs   (from lumevina/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
await import(path.join(root, "docs/school/videos.js"));
const vids = globalThis.window.SCHOOL_VIDEOS || {};
const pack = fs.readFileSync(path.join(root, "marketing/tiktok.md"), "utf8");
const rows = [...pack.matchAll(/^\| (\d+) \| `([0-9]+-[0-9]+)-9x16\.mp4` ([^|]+)\| ([^|]+)\|/gm)]
  .map((m) => ({ week: +m[1], id: m[2], title: m[3].trim(), hook: m[4].trim() }));
const out = path.join(root, "marketing/ads/out/video");
const lines = ["# The clips, 9:16, ready to post", "", "Rendered from `docs/school/motion/` (see the README there). Week numbers follow `marketing/tiktok.md`, which has the full caption, body and hashtags for each. A clip listed here exists in this folder; one marked *rendering* is still on its way.", "", "| Week | File | Title | Hook | Length |", "|---|---|---|---|---|"];
for (const r of rows) {
  const file = `${r.id}-9x16.mp4`, have = fs.existsSync(path.join(out, file));
  const dur = vids[r.id] ? Math.round(vids[r.id].dur) + " s" : "";
  lines.push(`| ${r.week} | ${have ? "`" + file + "`" : "*rendering*"} | ${r.title} | ${r.hook} | ${dur} |`);
}
lines.push("", "Post the pore clip first (skin science travels), then one a week in this order. Each is silent with the words on screen; the caption's first line is the hook.");
fs.writeFileSync(path.join(out, "README.md"), lines.join("\n") + "\n");
console.log(`clip index: ${rows.length} rows, ${rows.filter((r) => fs.existsSync(path.join(out, `${r.id}-9x16.mp4`))).length} rendered`);
