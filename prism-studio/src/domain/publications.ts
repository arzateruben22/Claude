// One publication record per (episode, destination). Statuses move independently per destination:
// a YouTube upload never marks TikTok or Instagram. Opening a link, downloading, copying or sharing is never proof
// of publication: only "Mark uploaded" (owner-reported) or an integration's verification is.
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../db/client";
import { destinations, episodes, metricSnapshots, platformExports, publications, versions } from "../db/schema";
import { audit, type Conn, DomainError } from "./core";
import { currentApproval } from "./approvals";
import { onPublicationReported } from "./living";

export type PubStatus = typeof publications.$inferSelect["status"];

const DOMAINS: Record<string, RegExp> = {
  youtube: /^(www\.|m\.)?(youtube\.com|youtu\.be)$/i,
  tiktok: /^(www\.|m\.|vm\.)?tiktok\.com$/i,
  instagram: /^(www\.)?instagram\.com$/i,
};

/** Validates a pasted post URL's domain for the destination's platform, and pulls a post id where the URL has one. */
export function parsePostUrl(platform: "youtube" | "tiktok" | "instagram", raw: string): { ok: true; url: string; postId: string; author?: string } | { ok: false; error: string } {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { ok: false, error: "That is not a URL." }; }
  if (u.protocol !== "https:") return { ok: false, error: "Use the https link from the platform." };
  if (!DOMAINS[platform].test(u.hostname)) return { ok: false, error: `That link is not a ${platform} link (${u.hostname}).` };
  let postId = "", author: string | undefined;
  if (platform === "youtube") {
    postId = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : u.searchParams.get("v") || (u.pathname.match(/\/shorts\/([\w-]+)/)?.[1] ?? "");
  } else if (platform === "tiktok") {
    const m = u.pathname.match(/^\/@([\w.]+)\/video\/(\d+)/);
    if (m) { author = m[1]; postId = m[2]; }
  } else {
    postId = u.pathname.match(/\/(reel|p)\/([\w-]+)/)?.[2] ?? "";
  }
  return { ok: true, url: u.toString(), postId, author };
}

async function load(c: Conn, id: string) {
  const [p] = await c.select().from(publications).where(eq(publications.id, id));
  if (!p) throw new DomainError("not_found", "publication not found");
  return p;
}

/** The owner took the approved materials to the platform (download/share/open). Not a publication. Ignored (the record
 *  is returned unchanged) unless the exact export is approved for this destination: an unapproved video never counts
 *  as handed off, however the download was reached. */
export async function markHandedOff(d: DB, id: string) {
  const p = await load(d, id);
  if (["owner_reported", "verified_published", "scheduled_on_platform"].includes(p.status)) return p;
  if (!p.exportId || !(await currentApproval(d, p.exportId, p.destinationId))) return p;
  const [row] = await d.update(publications).set({ status: "handed_off", handedOffAt: new Date(), updatedAt: new Date() }).where(eq(publications.id, id)).returning();
  await audit(d, "owner", "publication.handed_off", "publication", id);
  return row;
}

/** "Mark uploaded": the owner's confirmation, with the target account and an optional post URL. */
export async function markUploaded(d: DB, id: string, v: { postUrl?: string; scheduledOnPlatformFor?: Date | null; note?: string }) {
  return d.transaction(async (tx) => {
    const [p] = await tx.select().from(publications).where(eq(publications.id, id)).for("update");
    if (!p) throw new DomainError("not_found", "publication not found");
    if (p.simulated) throw new DomainError("simulated", "a simulated publication cannot be marked uploaded");
    const [dest] = await tx.select().from(destinations).where(eq(destinations.id, p.destinationId));
    let postUrl = "", postId = "";
    if (v.postUrl) {
      const parsed = parsePostUrl(dest.platform, v.postUrl);
      if (!parsed.ok) throw new DomainError("bad_url", parsed.error);
      if (parsed.author && dest.handle && parsed.author.toLowerCase() !== dest.handle.replace(/^@/, "").toLowerCase())
        throw new DomainError("wrong_account", `That post belongs to @${parsed.author}, not ${dest.handle}.`);
      postUrl = parsed.url; postId = parsed.postId;
    }
    const status: PubStatus = v.scheduledOnPlatformFor ? "scheduled_on_platform" : "owner_reported";
    const [row] = await tx.update(publications).set({
      status, reportedAt: new Date(), postUrl, postId, evidence: "owner_reported", method: "manual",
      scheduledFor: v.scheduledOnPlatformFor ?? p.scheduledFor, note: v.note ?? p.note, updatedAt: new Date(),
    }).where(eq(publications.id, id)).returning();
    await audit(tx, "owner", "publication.mark_uploaded", "publication", id, { destination: dest.handle || dest.platform, postUrl, status });
    return row;
  });
}

/** The statuses that mean "posted" (the owner pressed an Uploaded button, or the platform verified it). */
export const REPORTED: PubStatus[] = ["owner_reported", "scheduled_on_platform", "verified_published"];

/** Backfill: record posts the owner made by hand before the studio tracked them. It is owner-reported (never
 *  "verified"), skips the Review approval on purpose because the post already happened, labels every row in its note
 *  and audit entry, and never touches simulated rows, other platforms, or a destination already recorded. */
export async function backfillPosted(d: DB, episodeId: string, platforms: ("youtube" | "tiktok" | "instagram")[], note: string) {
  const rows = await d.select({ p: publications, platform: destinations.platform }).from(publications)
    .innerJoin(destinations, eq(destinations.id, publications.destinationId))
    .where(and(eq(publications.episodeId, episodeId), inArray(destinations.platform, platforms)));
  const result: { platform: string; outcome: "marked" | "already" | "simulated" | "missing"; publicationId?: string }[] = [];
  for (const pl of platforms) {
    if (rows.some((r) => r.platform === pl)) continue;
    // Instagram rows are normally created by the calendar; for a post that already happened, create the shared
    // account's row from the current version's Instagram export (still one record per destination).
    const [dest] = pl === "instagram" ? await d.select().from(destinations).where(and(eq(destinations.platform, "instagram"), eq(destinations.shared, true))) : [];
    const vers = dest ? await d.select().from(versions).where(eq(versions.episodeId, episodeId)) : [];
    const cur = vers.filter((v) => !v.superseded).sort((a, b) => b.versionNo - a.versionNo)[0];
    const [x] = cur ? await d.select().from(platformExports).where(and(eq(platformExports.versionId, cur.id), eq(platformExports.platform, "instagram"))) : [];
    if (!dest || !x) { result.push({ platform: pl, outcome: "missing" }); continue; }
    const [row] = await d.insert(publications).values({ episodeId, destinationId: dest.id, exportId: x.id, kind: "instagram", status: "planned" })
      .onConflictDoNothing().returning();
    if (row) rows.push({ p: row, platform: "instagram" });
    else result.push({ platform: pl, outcome: "missing" });
  }
  for (const { p, platform } of rows) {
    if (p.simulated) { result.push({ platform, outcome: "simulated", publicationId: p.id }); continue; }
    if (REPORTED.includes(p.status)) { result.push({ platform, outcome: "already", publicationId: p.id }); continue; }
    await markUploaded(d, p.id, { note });
    result.push({ platform, outcome: "marked", publicationId: p.id });
  }
  return result;
}

/** The two "Uploaded" buttons: the owner posts by hand, then says where. "youtube_tiktok" covers both of the channel's
 *  accounts, "instagram" the shared Instagram. */
export const UPLOAD_GROUPS = { youtube_tiktok: ["youtube", "tiktok"], instagram: ["instagram"] } as const;
export type UploadGroup = keyof typeof UPLOAD_GROUPS;
export const UPLOADED_NOTE = "Marked uploaded by the owner (Uploaded button).";

/** The Uploaded buttons' done state, the one test for it (the button itself, video clearing and season archiving all
 *  use it): a set of publication rows is uploaded when it has real (not simulated) rows and every one is posted. An
 *  undone press puts its rows back to "ready", so an undone group is not uploaded. */
export function allPosted(rows: readonly { status: string; simulated?: boolean }[]): boolean {
  const real = rows.filter((p) => !p.simulated);
  return real.length > 0 && real.every((p) => (REPORTED as readonly string[]).includes(p.status));
}

/** One button for one episode: its rows on the group's platforms ("YouTube & TikTok", or "Instagram") all posted. */
export const groupUploaded = (pubs: readonly { platform: string; status: string; simulated?: boolean }[], group: UploadGroup): boolean =>
  allPosted(pubs.filter((p) => (UPLOAD_GROUPS[group] as readonly string[]).includes(p.platform)));

/** Both buttons stand for this episode: "Uploaded on YouTube & TikTok" and "Uploaded on Instagram". */
export const episodeUploaded = (pubs: readonly { platform: string; status: string; simulated?: boolean }[]): boolean =>
  groupUploaded(pubs, "youtube_tiktok") && groupUploaded(pubs, "instagram");

/** "Uploaded on YouTube & TikTok" / "Uploaded on Instagram": records the owner's own manual posts for one episode.
 *  Needs no approval (the post already happened). Owner-reported only (never "verified"); creates the shared
 *  Instagram row when missing; skips simulated rows and rows already reported; writes the audit log and runs the
 *  rewards hook once per row it marks. */
export async function markEpisodeUploaded(d: DB, episodeId: string, group: UploadGroup, note?: string) {
  const platforms = [...(UPLOAD_GROUPS[group] ?? [])];
  if (!platforms.length) throw new DomainError("bad_group", "unknown upload group");
  const result = await backfillPosted(d, episodeId, platforms, note?.trim() || UPLOADED_NOTE);
  for (const r of result) if (r.outcome === "marked") await onPublicationReported(d, r.publicationId!);
  await audit(d, "owner", "episode.uploaded", "episode", episodeId, { group, outcomes: result.map((r) => `${r.platform}:${r.outcome}`) });
  return result;
}

/** Undo an "Uploaded" press for one episode and group (owner reports only). An Instagram row the button created
 *  itself (never scheduled, no numbers recorded) is removed again, so the episode goes back to "not posted yet". */
export async function undoEpisodeUploaded(d: DB, episodeId: string, group: UploadGroup) {
  const rows = await d.select({ p: publications, platform: destinations.platform }).from(publications)
    .innerJoin(destinations, eq(destinations.id, publications.destinationId))
    .where(and(eq(publications.episodeId, episodeId), inArray(destinations.platform, [...UPLOAD_GROUPS[group]]), eq(publications.evidence, "owner_reported")));
  let undone = 0;
  for (const { p, platform } of rows) {
    const row = await undoUploaded(d, p.id);
    if (!row) continue;
    undone++;
    if (platform === "instagram" && !p.scheduledFor && p.note === UPLOADED_NOTE) {
      const snaps = await d.select({ id: metricSnapshots.id }).from(metricSnapshots).where(eq(metricSnapshots.publicationId, p.id)).limit(1);
      if (!snaps.length) await d.delete(publications).where(eq(publications.id, p.id));
    }
  }
  // the report moved the episode to "published": with no reported post left, put it back in review so season counts drop
  if (undone) {
    const left = await d.select({ status: publications.status }).from(publications).where(eq(publications.episodeId, episodeId));
    if (!left.some((r) => REPORTED.includes(r.status)))
      await d.update(episodes).set({ state: "ready_for_review", updatedAt: new Date() }).where(and(eq(episodes.id, episodeId), eq(episodes.state, "published")));
  }
  await audit(d, "owner", "episode.undo_uploaded", "episode", episodeId, { group, undone });
  return undone;
}

/** Undo an owner report made by mistake (keeps the audit trail). */
export async function undoUploaded(d: DB, id: string) {
  const [row] = await d.update(publications).set({ status: "ready", reportedAt: null, postUrl: "", postId: "", evidence: "none", updatedAt: new Date() })
    .where(and(eq(publications.id, id), eq(publications.evidence, "owner_reported"))).returning();
  if (row) await audit(d, "owner", "publication.undo_uploaded", "publication", id);
  return row ?? null;
}

/** An automated publisher must call this before any upload: it refuses when the owner already posted manually,
 *  when the record is simulated, or when external actions are stopped. */
export function mayAutoPublish(p: typeof publications.$inferSelect, stopExternal: boolean): { ok: boolean; reason?: string } {
  if (stopExternal) return { ok: false, reason: "external actions are stopped" };
  if (p.simulated) return { ok: false, reason: "simulated" };
  if (["owner_reported", "scheduled_on_platform", "verified_published", "handed_off"].includes(p.status)) return { ok: false, reason: `already ${p.status}` };
  if (p.method !== "api" && p.method !== "provider") return { ok: false, reason: "this destination is manual" };
  return { ok: true };
}
