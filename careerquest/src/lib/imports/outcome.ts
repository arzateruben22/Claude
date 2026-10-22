/**
 * Shared vocabulary for import / sync summaries. Pure (client-safe).
 *
 * Every capture path reports per-item outcomes in the same five buckets plus errors, so the email
 * import, spreadsheet import, URL import and mailbox syncs all read the same way to the user.
 */
import type { IngestResult } from "@/lib/ingest/types";

export type OutcomeBucket = "created" | "updated" | "duplicate" | "needs_review" | "ignored";

export type ImportTotals = {
  /** Items read from the input (messages, data rows, URL lines). */
  total: number;
  created: number;
  updated: number;
  duplicate: number;
  needsReview: number;
  ignored: number;
  errors: number;
};

export function emptyTotals(): ImportTotals {
  return { total: 0, created: 0, updated: 0, duplicate: 0, needsReview: 0, ignored: 0, errors: 0 };
}

export function addOutcome(totals: ImportTotals, bucket: OutcomeBucket): void {
  switch (bucket) {
    case "created":
      totals.created++;
      break;
    case "updated":
      totals.updated++;
      break;
    case "duplicate":
      totals.duplicate++;
      break;
    case "needs_review":
      totals.needsReview++;
      break;
    default:
      totals.ignored++;
  }
}

/** Bucket for a direct ingestion-engine answer (spreadsheet rows, URL lines). */
export function bucketForIngest(result: Pick<IngestResult, "action">): OutcomeBucket {
  switch (result.action) {
    case "created":
      return "created";
    case "updated":
      return "updated";
    case "duplicate":
      return "duplicate";
    case "needs_review":
      return "needs_review";
    default:
      return "ignored";
  }
}

/** The email pipeline's per-message actions (mirrors EmailProcessAction in src/lib/email/pipeline.ts). */
export type EmailAction = "ingested" | "duplicate" | "needs_review" | "stored" | "ignored" | "user_reviewed" | "ingest_failed";

/**
 * Bucket for an email pipeline summary. `ingest` is the engine's answer captured during the same call
 * (the pipeline reports "ingested" for both created and updated records).
 */
export function bucketForEmail(action: EmailAction, ingest: Pick<IngestResult, "action"> | null): OutcomeBucket {
  switch (action) {
    case "ingested":
      return ingest?.action === "created" ? "created" : "updated";
    case "duplicate":
    case "user_reviewed":
      return "duplicate";
    case "needs_review":
    case "ingest_failed":
      return "needs_review";
    default:
      return "ignored";
  }
}

export function totalsFromJson(value: unknown): ImportTotals {
  const t = emptyTotals();
  if (!value || typeof value !== "object" || Array.isArray(value)) return t;
  const v = value as Record<string, unknown>;
  for (const k of Object.keys(t) as (keyof ImportTotals)[]) {
    const n = v[k];
    if (typeof n === "number" && Number.isFinite(n)) t[k] = n;
  }
  return t;
}

export function describeTotals(t: ImportTotals): string {
  const parts: string[] = [];
  if (t.created) parts.push(`${t.created} new`);
  if (t.updated) parts.push(`${t.updated} updated`);
  if (t.duplicate) parts.push(`${t.duplicate} already tracked`);
  if (t.needsReview) parts.push(`${t.needsReview} need review`);
  if (t.ignored) parts.push(`${t.ignored} ignored`);
  if (t.errors) parts.push(`${t.errors} error${t.errors === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "nothing new";
}

/**
 * Engine reasons written for the email/extension review queue mention that queue. Spreadsheet and URL
 * rows have no review-queue entry (nothing is stored for them), so strip that advice.
 */
export function importReason(reason: string): string {
  const cleaned = reason
    .replace(/[;,]?\s*(confirm|add them|review)[^.;]*review queue[^.]*\.?/i, ".")
    .replace(/\s+\./g, ".")
    .replace(/\.\.+$/, ".")
    .trim();
  return cleaned || reason;
}
