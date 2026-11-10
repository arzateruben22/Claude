// Record episodes the owner already posted by hand, before Prism Studio tracked them ("backfill"), so a season
// shows as posted. It skips the Review approval on purpose: these posts already happened. Every row it changes is
// labelled in its note and in the audit log (publication.mark_uploaded, via markUploaded), and undo works as usual.
//   npm run posted:backfill -- films/channels/physics ep01-ep06 youtube,tiktok,instagram [--dry-run]
//   npm run posted:backfill -- films/channels/whatif ep01,ep02,ep03 instagram
// Only mark platforms where the posts are really live.
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import * as S from "../src/db/schema";
import { backfillPosted } from "../src/domain/publications";
import { onPublicationReported } from "../src/domain/living";
import { isArchived } from "../src/domain/channels";
import { loadEnv } from "./env";
loadEnv();

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const [channelPath, epArg, platArg] = args.filter((a) => !a.startsWith("--"));
const PLATFORMS = ["youtube", "tiktok", "instagram"] as const;
type Platform = (typeof PLATFORMS)[number];
if (!channelPath || !epArg || !platArg) {
  console.error('usage: npm run posted:backfill -- films/channels/<ch> ep01-ep06|ep01,ep03 youtube,tiktok,instagram [--dry-run]');
  process.exit(2);
}
const platforms = platArg.split(",").map((p) => p.trim().toLowerCase());
for (const p of platforms) if (!(PLATFORMS as readonly string[]).includes(p)) { console.error(`unknown platform: ${p}`); process.exit(2); }

function episodeList(s: string): string[] {
  const range = /^ep(\d{2})-ep(\d{2})$/.exec(s);
  if (range) {
    const out = [];
    for (let n = Number(range[1]); n <= Number(range[2]); n++) out.push(`ep${String(n).padStart(2, "0")}`);
    return out;
  }
  return s.split(",").map((e) => e.trim());
}

const d = db();
const [ch] = await d.select().from(S.channels).where(eq(S.channels.filmsPath, channelPath));
if (!ch) { console.error(`no channel with filmsPath ${channelPath}`); process.exit(1); }
if (isArchived(ch)) { console.error(`${ch.name} is archived: restore it in Settings → Archived channels first`); process.exit(1); }
const NOTE = `Backfilled: posted before Prism Studio tracked it (recorded ${new Date().toISOString().slice(0, 10)}).`;
let marked = 0, already = 0, missing = 0;
for (const ep of episodeList(epArg)) {
  const [e] = await d.select().from(S.episodes).where(and(eq(S.episodes.channelId, ch.id), eq(S.episodes.filmsPath, `${channelPath}/${ep}`)));
  if (!e) { console.log(`${ep}: not imported, skipped`); missing++; continue; }
  if (dry) {
    const rows = await d.select({ p: S.publications, platform: S.destinations.platform }).from(S.publications)
      .innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId))
      .where(and(eq(S.publications.episodeId, e.id), inArray(S.destinations.platform, platforms as Platform[])));
    for (const pl of platforms) {
      const r = rows.find((x) => x.platform === pl);
      console.log(`${ep} ${pl}: ${!r ? (pl === "instagram" ? "would create the shared Instagram record and mark posted" : "no publication row, would skip") : ["owner_reported", "scheduled_on_platform", "verified_published"].includes(r.p.status) ? "already recorded" : r.p.simulated ? "simulated, would skip" : "would mark posted"}`);
    }
    continue;
  }
  for (const r of await backfillPosted(d, e.id, platforms as Platform[], NOTE)) {
    console.log(`${ep} ${r.platform}: ${r.outcome}`);
    if (r.outcome === "marked") { marked++; await onPublicationReported(d, r.publicationId!); }
    else if (r.outcome === "already") already++;
    else missing++;
  }
}
console.log(`${dry ? "dry run (nothing changed)" : `${marked} marked, ${already} already recorded, ${missing} skipped`}`);
await pool().end();
