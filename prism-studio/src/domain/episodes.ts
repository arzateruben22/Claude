// Episodes: transactional numbering, the production state machine, versions and exports.
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { episodeCounters, episodes, platformExports, versions } from "../db/schema";
import { audit, type Conn, DomainError } from "./core";
import { revokeStaleApprovals } from "./approvals";

export const PIPELINE = [
  "idea", "research", "outline", "script", "fact_check", "storyboard", "assets", "narration", "captions", "render",
  "quality_check", "ready_for_review", "approved", "scheduled", "uploading", "processing", "published", "analytics",
] as const;
export const SIDE_STATES = ["blocked", "failed", "cancelled", "superseded", "correction_needed"] as const;
export type EpisodeState = (typeof PIPELINE)[number] | (typeof SIDE_STATES)[number];

/** Allowed moves: one step forward, back to any earlier production step (revision), or to a side state.
 *  Leaving "approved" or later for an earlier step is a revision: the caller revokes approvals. */
export function canTransition(from: EpisodeState, to: EpisodeState): boolean {
  if (from === to) return false;
  if ((SIDE_STATES as readonly string[]).includes(to)) return true;
  if (from === "cancelled" || from === "superseded") return false;
  const fi = PIPELINE.indexOf(from as (typeof PIPELINE)[number]), ti = PIPELINE.indexOf(to as (typeof PIPELINE)[number]);
  if (fi < 0) return ti >= 0 && ti <= PIPELINE.indexOf("ready_for_review");   // out of blocked/failed/correction back into production
  return ti === fi + 1 || ti < fi;
}

/**
 * The next episode number for a channel, atomically. The counter row is updated in place (a row lock), so two
 * concurrent callers can never receive the same number; a rolled-back transaction gives its number back.
 */
export async function allocateEpisodeNumber(c: Conn, channelId: string): Promise<number> {
  await c.insert(episodeCounters).values({ channelId, nextNumber: 1 }).onConflictDoNothing();
  const r = await c.execute(sql`update episode_counters set next_number = next_number + 1 where channel_id = ${channelId} returning next_number - 1 as n`);
  return Number((r.rows[0] as { n: number }).n);
}

export async function createEpisode(d: DB, v: { channelId: string; title: string; question?: string; seriesId?: string | null; seriesOrder?: number | null; isDemo?: boolean; state?: EpisodeState; filmsPath?: string | null; number?: number }) {
  return d.transaction(async (tx) => {
    let number = v.number;
    if (number == null) number = await allocateEpisodeNumber(tx, v.channelId);
    else {
      // an imported episode keeps its own number; the counter moves past it
      await tx.insert(episodeCounters).values({ channelId: v.channelId, nextNumber: number + 1 })
        .onConflictDoUpdate({ target: episodeCounters.channelId, set: { nextNumber: sql`greatest(${episodeCounters.nextNumber}, ${number + 1})` } });
    }
    const [e] = await tx.insert(episodes).values({
      channelId: v.channelId, title: v.title, question: v.question ?? "", seriesId: v.seriesId ?? null, seriesOrder: v.seriesOrder ?? null,
      number, isDemo: v.isDemo ?? false, state: v.state ?? "idea", filmsPath: v.filmsPath ?? null,
    }).returning();
    await audit(tx, "owner", "episode.create", "episode", e.id, { number, title: v.title });
    return e;
  });
}

export async function transitionEpisode(d: DB, episodeId: string, to: EpisodeState, actor: "owner" | "worker" = "owner") {
  return d.transaction(async (tx) => {
    const [e] = await tx.select().from(episodes).where(eq(episodes.id, episodeId)).for("update");
    if (!e) throw new DomainError("not_found", "episode not found");
    if (!canTransition(e.state as EpisodeState, to)) throw new DomainError("bad_transition", `cannot move ${e.state} → ${to}`);
    const revising = PIPELINE.indexOf(to as (typeof PIPELINE)[number]) >= 0 && PIPELINE.indexOf(to as (typeof PIPELINE)[number]) < PIPELINE.indexOf("approved")
      && PIPELINE.indexOf(e.state as (typeof PIPELINE)[number]) >= PIPELINE.indexOf("approved");
    await tx.update(episodes).set({ state: to, updatedAt: new Date() }).where(eq(episodes.id, episodeId));
    if (revising || to === "correction_needed") await revokeStaleApprovals(tx, { episodeId, reason: `episode moved to ${to}` , all: true });
    await audit(tx, actor, "episode.transition", "episode", episodeId, { from: e.state, to });
    return { from: e.state, to };
  });
}

export async function addVersion(c: Conn, v: { episodeId: string; videoPath: string; sha256: string; posterPath?: string; srtPath?: string; width?: number; height?: number; durationS?: number; label?: string; qa?: Record<string, unknown> }) {
  const r = await c.execute(sql`select coalesce(max(version_no), 0) + 1 as n from versions where episode_id = ${v.episodeId}`);
  const versionNo = Number((r.rows[0] as { n: number }).n);
  // a new version supersedes the old ones; their approvals no longer describe what would be posted
  await c.update(versions).set({ superseded: true }).where(and(eq(versions.episodeId, v.episodeId), eq(versions.superseded, false)));
  const [row] = await c.insert(versions).values({ ...v, versionNo, posterPath: v.posterPath ?? "", srtPath: v.srtPath ?? "", label: v.label ?? `v${versionNo}`, qa: v.qa ?? {} }).returning();
  await revokeStaleApprovals(c, { episodeId: v.episodeId, reason: `new version v${versionNo}`, all: true });
  return row;
}

export async function upsertExport(c: Conn, v: { versionId: string; platform: "youtube" | "tiktok" | "instagram"; filePath: string; fileSha256: string; title?: string; caption?: string; hashtags?: string; coverPath?: string; disclosures?: Record<string, unknown>; postingNotes?: string }) {
  const [row] = await c.insert(platformExports).values({ ...v, title: v.title ?? "", caption: v.caption ?? "", hashtags: v.hashtags ?? "", coverPath: v.coverPath ?? "", disclosures: v.disclosures ?? {}, postingNotes: v.postingNotes ?? "" })
    .onConflictDoUpdate({ target: [platformExports.versionId, platformExports.platform], set: { filePath: v.filePath, fileSha256: v.fileSha256, updatedAt: new Date() } }).returning();
  return row;
}

/** Edit an export's metadata. Any approval whose content hash no longer matches is revoked. */
export async function editExport(d: DB, exportId: string, patch: { title?: string; caption?: string; hashtags?: string; coverPath?: string; postingNotes?: string; disclosures?: Record<string, unknown> }) {
  return d.transaction(async (tx) => {
    const [row] = await tx.update(platformExports).set({ ...patch, updatedAt: new Date() }).where(eq(platformExports.id, exportId)).returning();
    if (!row) throw new DomainError("not_found", "export not found");
    const revoked = await revokeStaleApprovals(tx, { exportId, reason: "metadata edited" });
    await audit(tx, "owner", "export.edit", "export", exportId, { fields: Object.keys(patch), revoked });
    return { export: row, revoked };
  });
}
