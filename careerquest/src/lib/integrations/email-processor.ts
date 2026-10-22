import "server-only";
/**
 * Runs parsed mailbox messages through the shared email pipeline and tallies SyncRun counts.
 *
 * Messages the classifier labels UNRELATED are skipped before anything is stored (the mailbox syncs
 * read only a narrow slice of mail, and what is not job-related is not kept).
 */
import { classifyEmail } from "@/lib/email/classify";
import type { ParsedEmail } from "@/lib/email/parse";
import { processRawEmail } from "@/lib/email/pipeline";
import type { IngestResult } from "@/lib/ingest/types";
import { addOutcome, bucketForEmail, emptyTotals, type ImportTotals } from "@/lib/imports/outcome";
import type { SyncContext, SyncResult } from "./adapters/types";

export type EmailSyncProvider = "GMAIL" | "OUTLOOK";

export type EmailProcessor = {
  /** Classify + store + ingest one message. Throws only on unexpected pipeline failures. */
  handle(parsed: ParsedEmail): Promise<void>;
  /** Totals by outcome bucket (for summaries). */
  totals: ImportTotals;
  /** Messages skipped as unrelated (never stored). */
  skippedUnrelated: number;
  /** Copy matched/created/updated counts into a SyncResult. */
  applyTo(result: SyncResult): void;
};

export function createEmailProcessor(ctx: SyncContext, provider: EmailSyncProvider): EmailProcessor {
  const totals = emptyTotals();
  let skippedUnrelated = 0;
  let matched = 0;
  let lastIngest: IngestResult | null = null;

  const ingest = async (userId: string, observation: Parameters<SyncContext["ingest"]>[1]) => {
    const r = await ctx.ingest(userId, observation);
    lastIngest = r;
    return r;
  };

  return {
    totals,
    get skippedUnrelated() {
      return skippedUnrelated;
    },
    async handle(parsed) {
      totals.total++;
      if (classifyEmail(parsed).classification === "UNRELATED") {
        skippedUnrelated++;
        totals.ignored++;
        return;
      }
      lastIngest = null;
      const summary = await processRawEmail(
        ctx.userId,
        parsed,
        { provider, connectionId: ctx.connectionId, now: ctx.now },
        ingest,
      );
      const bucket = bucketForEmail(summary.action, lastIngest);
      addOutcome(totals, bucket);
      if ((bucket === "updated" || bucket === "duplicate") && summary.applicationId) matched++;
    },
    applyTo(result) {
      result.created = totals.created;
      result.updated = totals.updated;
      result.matched = matched;
    },
  };
}
