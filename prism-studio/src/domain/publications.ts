// One publication record per (episode, destination). Statuses move independently per destination:
// a YouTube upload never marks TikTok or Instagram. Opening a link, downloading, copying or sharing is never proof
// of publication: only "Mark uploaded" (owner-reported) or an integration's verification is.
import { and, eq } from "drizzle-orm";
import type { DB } from "../db/client";
import { destinations, publications } from "../db/schema";
import { audit, type Conn, DomainError } from "./core";

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

/** The owner took the materials to the platform (download/share/open). Not a publication. */
export async function markHandedOff(d: DB, id: string) {
  const p = await load(d, id);
  if (["owner_reported", "verified_published", "scheduled_on_platform"].includes(p.status)) return p;
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
