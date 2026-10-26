// Automated publishing through a connected destination. The guards come first and are the same for a scheduled
// job and for the owner's "Publish now": external actions not stopped, a live approval of this exact export for
// this destination, the destination connected, the owner hasn't already posted it by hand. Only a platform's
// own "published" answer becomes a verified publication; anything else stays visible as handed off, with a note.
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import fs from "node:fs";
import type { DB } from "../db/client";
import { channels, connections, destinations, episodes, platformExports, publications } from "../db/schema";
import { audit, DomainError, settings } from "./core";
import { currentApproval } from "./approvals";
import { freshTokens, markConnectionError } from "./connections";
import { mayAutoPublish } from "./publications";
import { onPublicationReported } from "./living";
import { enqueue } from "./jobs";
import { resolveMedia } from "../lib/media";
import { publicMediaUrl } from "../lib/public-media";
import { ConnectorError, type Fetch, type PlatformConnector, type PublishResult } from "../integrations/types";

export type PublishDeps = { connector?: PlatformConnector; fetch?: Fetch; publicOrigin?: string };
export type PublishOutcome = { outcome: PublishResult["status"] | "skipped"; note: string; postUrl?: string; postId?: string };

async function load(d: DB, publicationId: string) {
  const [p] = await d.select().from(publications).where(eq(publications.id, publicationId));
  if (!p) throw new DomainError("not_found", "publication not found");
  const [dest] = await d.select().from(destinations).where(eq(destinations.id, p.destinationId));
  const [ep] = await d.select().from(episodes).where(eq(episodes.id, p.episodeId));
  const [ch] = await d.select().from(channels).where(eq(channels.id, ep.channelId));
  const [x] = p.exportId ? await d.select().from(platformExports).where(eq(platformExports.id, p.exportId)) : [];
  return { p, dest, ep, ch, x };
}

export async function publishPublication(d: DB, publicationId: string, o: { manual?: boolean; onProgress?: (f: number, m: string) => Promise<boolean> | boolean; deps?: PublishDeps } = {}): Promise<PublishOutcome> {
  const s = await settings(d);
  const { p, dest, ep, ch, x } = await load(d, publicationId);
  const gate = mayAutoPublish({ ...p, method: dest.publishMethod }, s.stopExternalActions);
  if (!gate.ok) {
    if (gate.reason === "external actions are stopped") throw new DomainError("stopped", "External actions are stopped in Settings.");
    return { outcome: "skipped", note: gate.reason ?? "not publishable" };
  }
  if (!x) throw new DomainError("no_export", "this publication has no export");
  if (!(await currentApproval(d, x.id, dest.id))) throw new DomainError("not_approved", "Approve this exact video and text for this account first.");
  if (!o.manual && (ch.automationMode !== "approved" || ch.paused || s.globalPause)) return { outcome: "skipped", note: "automatic publishing is off for this channel" };
  const file = resolveMedia(x.filePath);
  if (!file || !fs.existsSync(file)) throw new DomainError("missing_file", `the export file is missing: ${x.filePath}`);
  const { conn, tokens, connector: stored } = await freshTokens(d, dest.id, o.deps?.fetch);
  const connector = o.deps?.connector ?? stored;
  const caps = (conn.capabilities ?? {}) as { audited?: boolean; privacy?: "public" | "private" };
  const origin = o.deps?.publicOrigin ?? process.env.PUBLIC_ORIGIN ?? "";
  const disclosures = { aiVoice: !!x.disclosures?.aiVoice, aiVisuals: !!x.disclosures?.aiVisuals, branded: !!x.disclosures?.branded };
  await audit(d, o.manual ? "owner" : "worker", "publication.publish_start", "publication", p.id, { destination: dest.handle || dest.platform, manual: !!o.manual });
  let result: PublishResult;
  try {
    result = await connector.publish({ ...tokens, extra: { ...(tokens.extra ?? {}), handle: dest.handle.replace(/^@/, "") } }, {
      filePath: file, fileSizeBytes: fs.statSync(file).size,
      publicVideoUrl: dest.platform === "instagram" && origin ? publicMediaUrl(origin, x.filePath, 3 * 3600) : undefined,
      title: x.title, description: x.caption, tags: tagsFromNotes(x.postingNotes),
      captionsSrt: dest.platform === "youtube" && ep.captionsSrt ? ep.captionsSrt : undefined,
      coverPath: x.coverPath ? resolveMedia(x.coverPath) ?? undefined : undefined,
      disclosures, languageCode: "en",
      mode: dest.platform === "tiktok" ? (caps.audited ? "direct" : "inbox") : undefined,
      privacy: caps.privacy ?? (dest.platform === "tiktok" && !caps.audited ? "private" : "public"),
    }, o.onProgress ?? (() => true), o.deps?.fetch);
  } catch (e) {
    if (e instanceof ConnectorError && e.code === "auth") await markConnectionError(d, dest.id, "expired", e.message);
    await audit(d, "worker", "publication.publish_failed", "publication", p.id, { error: (e as Error).message, code: e instanceof ConnectorError ? e.code : "unknown" });
    throw e;
  }
  return recordResult(d, p.id, result, o.manual ? "owner" : "worker");
}

async function recordResult(d: DB, publicationId: string, r: PublishResult, actor: "owner" | "worker"): Promise<PublishOutcome> {
  const now = new Date();
  if (r.status === "published") {
    await d.update(publications).set({ status: "verified_published", verifiedAt: now, reportedAt: now, postUrl: r.postUrl, postId: r.postId, evidence: "api_verified", method: "api", note: r.note, updatedAt: now })
      .where(eq(publications.id, publicationId));
    await audit(d, actor, "publication.verified", "publication", publicationId, { postUrl: r.postUrl, note: r.note });
    await onPublicationReported(d, publicationId);
  } else {
    // uploaded but not public yet: processing on the platform, a private post, or the owner's inbox
    await d.update(publications).set({ status: "handed_off", handedOffAt: now, postId: r.postId, postUrl: r.postUrl, method: "api", note: `${r.status}: ${r.note}`, updatedAt: now }).where(eq(publications.id, publicationId));
    await audit(d, actor, `publication.${r.status}`, "publication", publicationId, { postId: r.postId, note: r.note });
    if (r.status === "processing") await enqueue(d, { type: "publish_status", payload: { publicationId }, idempotencyKey: `publish_status:${publicationId}:${r.postId}`, runAfter: new Date(Date.now() + 2 * 60_000), maxAttempts: 20 });
  }
  return { outcome: r.status, note: r.note, postUrl: r.postUrl, postId: r.postId };
}

/** Ask the platform again about a post that was still processing. */
export async function finalizeProcessing(d: DB, publicationId: string, deps: PublishDeps = {}): Promise<PublishOutcome> {
  const { p, dest } = await load(d, publicationId);
  if (p.status === "verified_published") return { outcome: "published", note: "already verified", postUrl: p.postUrl };
  if (!p.postId) return { outcome: "skipped", note: "no platform post id" };
  const { tokens, connector: stored } = await freshTokens(d, dest.id, deps.fetch);
  const connector = deps.connector ?? stored;
  if (!connector.publishStatus) return { outcome: "skipped", note: "no status check for this platform" };
  const r = await connector.publishStatus(tokens, p.postId, deps.fetch);
  if (r.status === "processing") throw new DomainError("processing", "still processing");
  return recordResult(d, publicationId, { ...r, postUrl: r.postUrl || p.postUrl }, "worker");
}

/** Scheduled publishing: every due, approved publication on a connected destination of an "approved"-mode channel. */
export async function enqueueDuePublishes(d: DB, now = new Date()): Promise<number> {
  const s = await settings(d);
  if (s.globalPause || s.stopExternalActions) return 0;
  const rows = await d.select({ p: publications, dest: destinations, ch: channels })
    .from(publications).innerJoin(destinations, eq(destinations.id, publications.destinationId))
    .innerJoin(episodes, eq(episodes.id, publications.episodeId)).innerJoin(channels, eq(channels.id, episodes.channelId))
    .innerJoin(connections, and(eq(connections.destinationId, destinations.id), eq(connections.status, "connected")))
    .where(and(lte(publications.scheduledFor, now), inArray(publications.status, ["planned", "ready"]), eq(publications.simulated, false), isNull(publications.reportedAt),
      eq(destinations.publishMethod, "api"), eq(destinations.paused, false), eq(channels.automationMode, "approved"), eq(channels.paused, false), eq(episodes.isDemo, false)));
  let n = 0;
  for (const r of rows) {
    if (!r.p.exportId || !(await currentApproval(d, r.p.exportId, r.dest.id))) continue;
    const q = await enqueue(d, { type: "publish", channelId: r.ch.id, payload: { publicationId: r.p.id }, idempotencyKey: `publish:${r.p.id}`, priority: 5, maxAttempts: 3 });
    if (q.created) n++;
  }
  return n;
}

/** The YouTube keyword tags the metadata engine left in the posting notes ("Tags: a, b, c"). */
export function tagsFromNotes(notes: string): string[] {
  const m = /^Tags: (.+)$/m.exec(notes ?? "");
  return m ? m[1].split(",").map((t) => t.trim()).filter(Boolean) : [];
}
