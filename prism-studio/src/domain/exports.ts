// Regenerate a version's three platform exports from the episode as it is in the database (script beats,
// sources, series, channel). Goes through editExport, so any approval whose text changes is withdrawn.
import { asc, eq } from "drizzle-orm";
import type { DB } from "../db/client";
import { channels, episodes, platformExports, series, sources, versions } from "../db/schema";
import { audit, DomainError } from "./core";
import { editExport } from "./episodes";
import { buildMetadata, postingNotesFor, type MetaInput, type Topic } from "./metadata";

export async function metaInputFromDb(d: DB, episodeId: string): Promise<MetaInput> {
  const [ep] = await d.select().from(episodes).where(eq(episodes.id, episodeId));
  if (!ep) throw new DomainError("not_found", "episode not found");
  const [ch] = await d.select().from(channels).where(eq(channels.id, ep.channelId));
  const [se] = ep.seriesId ? await d.select().from(series).where(eq(series.id, ep.seriesId)) : [];
  const total = ep.seriesId ? (await d.select({ id: episodes.id }).from(episodes).where(eq(episodes.seriesId, ep.seriesId))).length : null;
  const srcs = await d.select().from(sources).where(eq(sources.episodeId, episodeId)).orderBy(asc(sources.claimKey));
  const beats = (ep.storyboard ?? []).filter((b) => b.vo).map((b) => ({ beat: b.beat, vo: b.vo! }));
  return {
    channel: { name: ch.name, label: ch.label, tagline: ch.tagline, topic: ch.topic as Topic },
    episode: { number: ep.number, title: ep.title, durationS: ep.durationS, seriesTitle: se?.title ?? null, seriesOrder: ep.seriesOrder, seriesTotal: total },
    beats, sources: srcs.map((s) => ({ key: s.claimKey, claim: s.claim, title: s.title, publisher: s.publisher, url: s.url })),
    disclosures: { aiVoice: true, aiVisuals: false },
    next: null,
  };
}

/** Rewrite the current version's exports from the script. Returns how many approvals were withdrawn. */
export async function regenerateExports(d: DB, episodeId: string) {
  const [ver] = await d.select().from(versions).where(eq(versions.episodeId, episodeId)).orderBy(asc(versions.superseded), asc(versions.versionNo));
  const current = (await d.select().from(versions).where(eq(versions.episodeId, episodeId))).find((v) => !v.superseded) ?? ver;
  if (!current) throw new DomainError("no_version", "nothing rendered yet");
  const meta = buildMetadata(await metaInputFromDb(d, episodeId));
  const xs = await d.select().from(platformExports).where(eq(platformExports.versionId, current.id));
  let revoked = 0;
  const warnings: string[] = [];
  for (const x of xs) {
    const m = meta[x.platform];
    const r = await editExport(d, x.id, {
      title: m.title, caption: m.caption, hashtags: m.hashtags, postingNotes: postingNotesFor(m),
    });
    revoked += r.revoked;
    warnings.push(...m.warnings.map((w) => `${x.platform}: ${w}`));
  }
  await audit(d, "owner", "exports.regenerate", "episode", episodeId, { revoked, warnings });
  return { revoked, warnings, platforms: xs.length };
}
