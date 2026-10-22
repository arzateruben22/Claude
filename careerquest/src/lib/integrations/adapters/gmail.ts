import "server-only";
/**
 * Gmail adapter (read-only). One pass over job-related mail covers both new applications and later
 * status changes, so importApplications and syncStatuses run the same sync.
 *
 *   users.messages.list?q=<narrow query>&maxResults≤100 (paged) → users.messages.get?format=raw
 *   → parseGmailRaw → processRawEmail(provider "GMAIL") → ingestion engine
 *
 * At most `ctx.maxItems` (500) messages are fetched per run. When the cap stops a run, the cursor keeps
 * the query and the next page token so the following run resumes exactly there. Without a pending
 * resume, the window is the user's history range on the first run and "since the last completed run"
 * (plus a day of overlap; processing is idempotent) afterwards.
 */
import { z } from "zod";
import { parseGmailRaw } from "@/lib/email/parse";
import { getProvider } from "../registry";
import { buildGmailQuery } from "../email-filter";
import { createEmailProcessor } from "../email-processor";
import { getAuthorizedJson, safeErrorMessage } from "./http";
import {
  IntegrationAuthError,
  IntegrationHttpError,
  emptySyncResult,
  type IntegrationAdapter,
  type SyncContext,
  type SyncResult,
} from "./types";

export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const PAGE_SIZE = 100;
const DAY_MS = 86_400_000;

const listSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1), threadId: z.string().optional() })).optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

const messageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().optional(),
  raw: z.string().min(1),
});

export type GmailCursor = {
  v: 1;
  /** Start of the last fully completed window (the next window starts here). */
  completedAt?: string;
  /** A run stopped early: resume this query from this page. */
  resume?: { query: string; pageToken: string | null; chainStartedAt: string };
};

export function parseGmailCursor(raw: string | null | undefined): GmailCursor {
  if (!raw) return { v: 1 };
  try {
    const v = JSON.parse(raw) as GmailCursor;
    if (!v || v.v !== 1) return { v: 1 };
    const out: GmailCursor = { v: 1 };
    if (typeof v.completedAt === "string" && !Number.isNaN(Date.parse(v.completedAt))) out.completedAt = v.completedAt;
    if (v.resume && typeof v.resume.query === "string" && typeof v.resume.chainStartedAt === "string") {
      out.resume = {
        query: v.resume.query,
        pageToken: typeof v.resume.pageToken === "string" ? v.resume.pageToken : null,
        chainStartedAt: v.resume.chainStartedAt,
      };
    }
    return out;
  } catch {
    return { v: 1 };
  }
}

/** Days to search: the full history range first, then only since the last completed run (+1 day overlap). */
export function gmailWindowDays(cursor: GmailCursor, historyDays: number, now: Date): number {
  if (!cursor.completedAt) return historyDays;
  const since = Math.ceil((now.getTime() - Date.parse(cursor.completedAt)) / DAY_MS) + 1;
  return Math.max(1, Math.min(historyDays, since));
}

export async function syncGmail(ctx: SyncContext): Promise<SyncResult> {
  const cursor = parseGmailCursor(ctx.cursor);
  const query = cursor.resume?.query ?? buildGmailQuery(gmailWindowDays(cursor, ctx.historyDays, ctx.now));
  const chainStartedAt = cursor.resume?.chainStartedAt ?? ctx.now.toISOString();
  let pageToken: string | null = cursor.resume?.pageToken ?? null;

  const result = emptySyncResult(ctx.cursor);
  const processor = createEmailProcessor(ctx, "GMAIL");
  const resumeCursor = (token: string | null): string =>
    JSON.stringify({ v: 1, completedAt: cursor.completedAt, resume: { query, pageToken: token, chainStartedAt } } satisfies GmailCursor);

  try {
    for (;;) {
      const remaining = ctx.maxItems - result.scanned;
      const params = new URLSearchParams({ q: query, maxResults: String(Math.max(1, Math.min(PAGE_SIZE, remaining))) });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await getAuthorizedJson(ctx.fetch, ctx.tokens, `${GMAIL_API}/messages?${params.toString()}`, listSchema);

      for (const m of page.messages ?? []) {
        result.scanned++;
        try {
          const msg = await getAuthorizedJson(
            ctx.fetch,
            ctx.tokens,
            `${GMAIL_API}/messages/${encodeURIComponent(m.id)}?format=raw`,
            messageSchema,
          );
          const parsed = await parseGmailRaw(msg.raw, { id: msg.id, threadId: msg.threadId });
          await processor.handle(parsed);
        } catch (err) {
          // Auth failures and rate limiting stop the run; the page is retried next time.
          if (err instanceof IntegrationAuthError) throw err;
          if (err instanceof IntegrationHttpError && (err.status === 429 || err.status === 0 || err.status >= 500)) throw err;
          result.issues.push({ code: "MESSAGE_FAILED", message: safeErrorMessage(err), ref: m.id });
        }
      }

      const next = page.nextPageToken ?? null;
      if (!next) {
        result.cursor = JSON.stringify({ v: 1, completedAt: chainStartedAt } satisfies GmailCursor);
        break;
      }
      if (result.scanned >= ctx.maxItems) {
        result.capped = true;
        result.cursor = resumeCursor(next);
        result.issues.push({
          code: "CAP_REACHED",
          message: `Stopped after ${ctx.maxItems} messages; the next sync continues where this one stopped.`,
        });
        break;
      }
      pageToken = next;
    }
  } catch (err) {
    const auth = err instanceof IntegrationAuthError;
    result.fatal = { message: safeErrorMessage(err), auth };
    result.issues.push({ code: auth ? "AUTH" : err instanceof IntegrationHttpError && err.status === 429 ? "RATE_LIMITED" : "PAGE_FAILED", message: safeErrorMessage(err) });
    result.cursor = resumeCursor(pageToken);
  }

  processor.applyTo(result);
  return result;
}

export const gmailAdapter: IntegrationAdapter = {
  provider: "GMAIL",
  capabilities: getProvider("GMAIL")!.capabilities,
  importApplications: syncGmail,
  syncStatuses: syncGmail,
};
