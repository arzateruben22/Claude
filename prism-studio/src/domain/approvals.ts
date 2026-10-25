// Approval binds one exact video + metadata + destination. Its content hash is recomputed whenever the export
// changes; an approval whose hash no longer matches is revoked (it described something that would no longer post).
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "../db/client";
import { approvals, destinations, episodes, platformExports, versions } from "../db/schema";
import { audit, type Conn, DomainError, sha256 } from "./core";

type ExportRow = typeof platformExports.$inferSelect;

export function contentHash(x: Pick<ExportRow, "fileSha256" | "title" | "caption" | "hashtags" | "coverPath" | "disclosures">, destinationId: string): string {
  return sha256(JSON.stringify([x.fileSha256, x.title, x.caption, x.hashtags, x.coverPath, x.disclosures ?? {}, destinationId]));
}

export async function approve(d: DB, v: { exportId: string; destinationId: string }) {
  return d.transaction(async (tx) => {
    const [x] = await tx.select().from(platformExports).where(eq(platformExports.id, v.exportId)).for("update");
    if (!x) throw new DomainError("not_found", "export not found");
    const [ver] = await tx.select().from(versions).where(eq(versions.id, x.versionId));
    if (ver.superseded) throw new DomainError("superseded", "this version has been replaced by a newer render");
    const [dest] = await tx.select().from(destinations).where(eq(destinations.id, v.destinationId));
    if (!dest) throw new DomainError("not_found", "destination not found");
    if (dest.platform !== x.platform) throw new DomainError("wrong_platform", `a ${x.platform} export cannot be approved for ${dest.platform}`);
    const hash = contentHash(x, v.destinationId);
    await tx.update(approvals).set({ revokedAt: new Date(), revokedReason: "re-approved" })
      .where(and(eq(approvals.exportId, x.id), eq(approvals.destinationId, v.destinationId), isNull(approvals.revokedAt)));
    const [a] = await tx.insert(approvals).values({ episodeId: ver.episodeId, exportId: x.id, destinationId: v.destinationId, contentHash: hash }).returning();
    await audit(tx, "owner", "approval.create", "approval", a.id, { exportId: x.id, destinationId: v.destinationId, hash });
    return a;
  });
}

/** Is there a live approval whose hash matches this export as it is right now? */
export async function currentApproval(c: Conn, exportId: string, destinationId: string) {
  const [x] = await c.select().from(platformExports).where(eq(platformExports.id, exportId));
  if (!x) return null;
  const live = await c.select().from(approvals).where(and(eq(approvals.exportId, exportId), eq(approvals.destinationId, destinationId), isNull(approvals.revokedAt)));
  const hash = contentHash(x, destinationId);
  return live.find((a) => a.contentHash === hash) ?? null;
}

/** Revoke approvals that no longer match (or every live approval of an episode, with all: true). Returns the count. */
export async function revokeStaleApprovals(c: Conn, v: { exportId?: string; episodeId?: string; reason: string; all?: boolean }): Promise<number> {
  const cond = v.exportId ? eq(approvals.exportId, v.exportId) : v.episodeId ? eq(approvals.episodeId, v.episodeId) : null;
  if (!cond) return 0;
  const live = await c.select().from(approvals).where(and(cond, isNull(approvals.revokedAt)));
  let n = 0;
  const touched = new Set<string>();
  for (const a of live) {
    let stale = !!v.all;
    if (!stale) {
      const [x] = await c.select().from(platformExports).where(eq(platformExports.id, a.exportId));
      stale = !x || contentHash(x, a.destinationId) !== a.contentHash;
    }
    if (stale) {
      await c.update(approvals).set({ revokedAt: new Date(), revokedReason: v.reason }).where(eq(approvals.id, a.id));
      touched.add(a.episodeId);
      n++;
    }
  }
  // an approved episode whose approval no longer holds goes back to review
  for (const episodeId of touched) {
    const [e] = await c.select().from(episodes).where(eq(episodes.id, episodeId));
    if (e && e.state === "approved") await c.update(episodes).set({ state: "ready_for_review", updatedAt: new Date() }).where(eq(episodes.id, e.id));
  }
  return n;
}
