import "server-only";
/**
 * Job-URL imports: each pasted link becomes a JOB_SEEN observation (no network fetch) so the
 * ingestion engine matches it to an existing record or creates a saved lead. Nothing here ever
 * implies an application was submitted.
 */
import type { ApplicationObservation } from "@/lib/ingest/types";
import { createBatch, finishBatch } from "./batches";
import { addOutcome, bucketForIngest, emptyTotals, importReason } from "./outcome";
import type { ImportSummaryData, IngestFn, RowIssue } from "./types";
import { parseUrlLines, type UrlLine } from "./urls";

export function urlObservation(line: UrlLine, now: Date): ApplicationObservation {
  const complete = Boolean(line.company && line.title);
  return {
    kind: "JOB_SEEN",
    source: "IMPORT",
    origin: "URL_IMPORT",
    observedAt: now,
    company: line.company,
    title: line.title,
    postingUrl: line.url,
    platform: line.platform,
    // Typed details are the user's own; URL-path details are a structural reading of the link.
    confidence: complete ? (line.detailsFrom === "user" ? 0.9 : 0.8) : 0.5,
    verified: false,
    evidence: {
      kind: "URL",
      sourceRef: line.normalizedUrl!,
      title: line.company && line.title ? `${line.company} — ${line.title}` : line.url,
      snippet: null,
      data: { detailsFrom: line.detailsFrom, line: line.line },
    },
  };
}

export async function importUrls(
  userId: string,
  text: string,
  ingest: IngestFn,
  opts: { now?: Date } = {},
): Promise<{ ok: true; data: ImportSummaryData } | { ok: false; error: string }> {
  const { lines, tooMany } = parseUrlLines(text);
  if (!lines.length) return { ok: false, error: "Paste at least one job posting URL (one per line)." };
  const now = opts.now ?? new Date();
  const batch = await createBatch(userId, "URL_LIST", null);
  const totals = emptyTotals();
  const issues: RowIssue[] = [];
  if (tooMany) issues.push({ row: 0, type: "warning", message: "Only the first 200 links were imported. Import the rest separately." });

  for (const line of lines) {
    totals.total++;
    if (line.error || !line.normalizedUrl) {
      totals.errors++;
      issues.push({ row: line.line, type: "error", message: line.error ?? "Not a valid web address." });
      continue;
    }
    if (line.detailsFrom === "url") {
      issues.push({ row: line.line, type: "warning", message: `Company/title read from the link (${[line.company, line.title].filter(Boolean).join(" — ")}); edit the record if they are off.` });
    }
    try {
      const result = await ingest(userId, urlObservation(line, now));
      const bucket = bucketForIngest(result);
      addOutcome(totals, bucket);
      if (bucket === "needs_review" || bucket === "ignored") {
        const hint = line.company && line.title ? "" : " Add “| Company | Job title” after the link and import it again.";
        issues.push({ row: line.line, type: bucket, message: `Not imported: ${importReason(result.reason)}${hint}` });
      }
    } catch (err) {
      console.error("url import line failed", err);
      totals.errors++;
      issues.push({ row: line.line, type: "error", message: "Could not be imported because of an internal error." });
    }
  }

  const data = await finishBatch(userId, { id: batch.id, kind: batch.kind, fileName: batch.fileName }, totals, issues, { unit: "line" });
  return { ok: true, data };
}
