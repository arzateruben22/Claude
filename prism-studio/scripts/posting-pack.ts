// Write the posting sheet next to every delivered episode in the films repo: <episode>/out/POSTING.md and
// posting.json (the same text the studio's exports carry), so posting works even without the studio open.
//   npx tsx scripts/posting-pack.ts [films/channels/physics/ep01 …]   (default: every delivered episode)
import fs from "node:fs";
import path from "node:path";
import { CHANNELS } from "../src/domain/catalog";
import { buildMetadata, postingSheet } from "../src/domain/metadata";
import { metaInputFor, SLATES } from "./import-episodes";

const ROOT = path.resolve(process.env.FILMS_REPO_ROOT || "..");
const plain = (s: string) => s.replace(/\*/g, "");
const dirs = process.argv.slice(2).length ? process.argv.slice(2).map((d) => path.resolve(ROOT, d))
  : CHANNELS.filter((c) => c.filmsPath).flatMap((c) => fs.existsSync(path.join(ROOT, c.filmsPath!)) ? fs.readdirSync(path.join(ROOT, c.filmsPath!)).filter((e) => /^ep\d+$/.test(e)).map((e) => path.join(ROOT, c.filmsPath!, e)) : []);
for (const dir of dirs) {
  const out = path.join(dir, "out");
  if (!fs.existsSync(out) || !fs.readdirSync(out).some((f) => /-9x16\.mp4$/.test(f))) continue;
  const slug = path.basename(path.dirname(dir)), ch = CHANNELS.find((c) => c.slug === slug);
  if (!ch) continue;
  const n = Number(path.basename(dir).replace(/^ep0*/, "")), slate = SLATES[slug];
  const film = fs.existsSync(path.join(dir, "film.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "film.json"), "utf8")) : null;
  const input = metaInputFor(dir, { name: ch.name, label: ch.label, tagline: ch.tagline, topic: ch.topic },
    { number: n, title: film?.title?.title ? plain(film.title.title) : slate?.titles[n - 1] ?? path.basename(dir), durationS: film?.dur, seriesTitle: slate?.series, seriesOrder: n, seriesTotal: slate?.titles.length });
  const meta = buildMetadata(input);
  const name = fs.readdirSync(out).find((f) => /-9x16\.mp4$/.test(f))!.replace(/-9x16\.mp4$/, "");
  const art = [[`${name}-cover.jpg`, "9:16 cover: TikTok, Reels, Shorts"], [`${name}-thumb.jpg`, "16:9 YouTube thumbnail"]].filter(([f]) => fs.existsSync(path.join(out, f)));
  const coverLine = `**Cover / thumbnail**: ${art.length ? art.map(([f, use]) => `\`${f}\` (${use})`).join(" · ") : `\`${name}-9x16.jpg\` (the poster; \`npm run covers\` makes the designed cover and thumbnail)`}`;
  fs.writeFileSync(path.join(out, "POSTING.md"), postingSheet(input, meta).replace(/\n## /, `\n${coverLine}\n\n## `));
  fs.writeFileSync(path.join(out, "posting.json"), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), ...meta }, null, 1));
  const warn = Object.values(meta).flatMap((m) => m.warnings);
  console.log(`${path.relative(ROOT, dir)}: POSTING.md, posting.json${warn.length ? ` · check: ${warn.join("; ")}` : ""}`);
}
