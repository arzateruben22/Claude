import "server-only";
/**
 * Outlook adapter (Microsoft Graph, read-only).
 *
 *   GET /v1.0/me/messages?$select=…&$filter=receivedDateTime ge {iso}&$orderby=receivedDateTime asc&$top=50
 *   (Prefer: outlook.body-content-type="text"), following @odata.nextLink
 *   → isLikelyJobEmail (everything else is discarded unparsed) → fromGraphMessage
 *   → processRawEmail(provider "OUTLOOK") → ingestion engine
 *
 * Oldest-first ordering keeps paging stable while new mail arrives. At most `ctx.maxItems` (500)
 * messages are fetched per run; the cursor keeps the next link (only ever a graph.microsoft.com URL)
 * so the next run resumes. Bearer tokens are never sent to any other host.
 */
import { z } from "zod";
import { fromGraphMessage, type GraphMessage } from "@/lib/email/parse";
import { getProvider } from "../registry";
import { isLikelyJobEmail } from "../email-filter";
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

export const GRAPH_ROOT = "https://graph.microsoft.com/";
export const GRAPH_API = "https://graph.microsoft.com/v1.0";
export const GRAPH_SELECT = "id,internetMessageId,conversationId,subject,from,toRecipients,receivedDateTime,body";
const PAGE_SIZE = 50;
const DAY_MS = 86_400_000;
const PREFER_TEXT = { Prefer: 'outlook.body-content-type="text"' };

const address = z
  .object({ emailAddress: z.object({ name: z.string().nullish(), address: z.string().nullish() }).nullish() })
  .nullish();

const graphMessageSchema = z.object({
  id: z.string().min(1),
  internetMessageId: z.string().nullish(),
  conversationId: z.string().nullish(),
  subject: z.string().nullish(),
  from: address,
  toRecipients: z.array(address).nullish(),
  receivedDateTime: z.string().nullish(),
  body: z.object({ contentType: z.string().nullish(), content: z.string().nullish() }).nullish(),
});

const pageSchema = z.object({
  value: z.array(graphMessageSchema),
  "@odata.nextLink": z.string().optional(),
});

export type OutlookCursor = {
  v: 1;
  /** Start of the last fully completed window. */
  completedAt?: string;
  /** A run stopped early: resume from this Graph link, skipping the first `skip` messages of that page. */
  resume?: { link: string; skip: number; chainStartedAt: string };
};

export function isGraphUrl(link: string): boolean {
  try {
    const u = new URL(link);
    return u.protocol === "https:" && u.hostname === "graph.microsoft.com" && u.username === "" && u.password === "";
  } catch {
    return false;
  }
}

export function parseOutlookCursor(raw: string | null | undefined): OutlookCursor {
  if (!raw) return { v: 1 };
  try {
    const v = JSON.parse(raw) as OutlookCursor;
    if (!v || v.v !== 1) return { v: 1 };
    const out: OutlookCursor = { v: 1 };
    if (typeof v.completedAt === "string" && !Number.isNaN(Date.parse(v.completedAt))) out.completedAt = v.completedAt;
    if (v.resume && typeof v.resume.link === "string" && isGraphUrl(v.resume.link) && typeof v.resume.chainStartedAt === "string") {
      const skip = typeof v.resume.skip === "number" && Number.isInteger(v.resume.skip) && v.resume.skip > 0 ? v.resume.skip : 0;
      out.resume = { link: v.resume.link, skip, chainStartedAt: v.resume.chainStartedAt };
    }
    return out;
  } catch {
    return { v: 1 };
  }
}

/** Start of the receive window: the history range first, then the last completed run minus a day. */
export function outlookWindowStart(cursor: OutlookCursor, historyDays: number, now: Date): Date {
  const floor = now.getTime() - historyDays * DAY_MS;
  if (!cursor.completedAt) return new Date(floor);
  return new Date(Math.max(floor, Date.parse(cursor.completedAt) - DAY_MS));
}

export function buildOutlookFirstPageUrl(since: Date, top = PAGE_SIZE): string {
  const iso = since.toISOString().replace(/\.\d{3}Z$/, "Z");
  return (
    `${GRAPH_API}/me/messages?$select=${encodeURIComponent(GRAPH_SELECT)}` +
    `&$filter=${encodeURIComponent(`receivedDateTime ge ${iso}`)}` +
    `&$orderby=${encodeURIComponent("receivedDateTime asc")}` +
    `&$top=${top}`
  );
}

export async function syncOutlook(ctx: SyncContext): Promise<SyncResult> {
  const cursor = parseOutlookCursor(ctx.cursor);
  const chainStartedAt = cursor.resume?.chainStartedAt ?? ctx.now.toISOString();
  let skip = cursor.resume?.skip ?? 0;
  let link =
    cursor.resume?.link ??
    buildOutlookFirstPageUrl(outlookWindowStart(cursor, ctx.historyDays, ctx.now), Math.max(1, Math.min(PAGE_SIZE, ctx.maxItems)));

  const result = emptySyncResult(ctx.cursor);
  const processor = createEmailProcessor(ctx, "OUTLOOK");
  const resumeCursor = (l: string, skipCount = 0): string =>
    JSON.stringify({ v: 1, completedAt: cursor.completedAt, resume: { link: l, skip: skipCount, chainStartedAt } } satisfies OutlookCursor);

  try {
    for (;;) {
      if (!isGraphUrl(link)) throw new IntegrationHttpError("Refusing to follow a paging link outside graph.microsoft.com.", 0);
      const page = await getAuthorizedJson(ctx.fetch, ctx.tokens, link, pageSchema, PREFER_TEXT);
      const items = page.value.slice(skip);
      const offset = skip;
      skip = 0;
      let stoppedAt = -1;
      for (let i = 0; i < items.length; i++) {
        if (result.scanned >= ctx.maxItems) {
          stoppedAt = offset + i;
          break;
        }
        const message = items[i]!;
        result.scanned++;
        try {
          const graph = message as GraphMessage;
          const from = graph.from?.emailAddress ?? null;
          if (!isLikelyJobEmail({ fromAddress: from?.address ?? null, fromName: from?.name ?? null, subject: graph.subject ?? null })) {
            processor.totals.total++;
            processor.totals.ignored++;
            continue;
          }
          await processor.handle(fromGraphMessage(graph));
        } catch (err) {
          result.issues.push({ code: "MESSAGE_FAILED", message: safeErrorMessage(err), ref: message.id });
        }
      }
      if (stoppedAt >= 0) {
        // The cap fell inside this page: resume here, skipping what was already processed.
        result.capped = true;
        result.cursor = resumeCursor(link, stoppedAt);
        result.issues.push({
          code: "CAP_REACHED",
          message: `Stopped after ${ctx.maxItems} messages; the next sync continues where this one stopped.`,
        });
        break;
      }
      const next = page["@odata.nextLink"] ?? null;
      if (!next) {
        result.cursor = JSON.stringify({ v: 1, completedAt: chainStartedAt } satisfies OutlookCursor);
        break;
      }
      if (!isGraphUrl(next)) throw new IntegrationHttpError("Refusing to follow a paging link outside graph.microsoft.com.", 0);
      if (result.scanned >= ctx.maxItems) {
        result.capped = true;
        result.cursor = resumeCursor(next);
        result.issues.push({
          code: "CAP_REACHED",
          message: `Stopped after ${ctx.maxItems} messages; the next sync continues where this one stopped.`,
        });
        break;
      }
      link = next;
    }
  } catch (err) {
    const auth = err instanceof IntegrationAuthError;
    result.fatal = { message: safeErrorMessage(err), auth };
    result.issues.push({ code: auth ? "AUTH" : err instanceof IntegrationHttpError && err.status === 429 ? "RATE_LIMITED" : "PAGE_FAILED", message: safeErrorMessage(err) });
    result.cursor = isGraphUrl(link) ? resumeCursor(link, cursor.resume?.link === link ? (cursor.resume?.skip ?? 0) : 0) : JSON.stringify({ v: 1, completedAt: cursor.completedAt } satisfies OutlookCursor);
  }

  processor.applyTo(result);
  return result;
}

export const outlookAdapter: IntegrationAdapter = {
  provider: "OUTLOOK",
  capabilities: getProvider("OUTLOOK")!.capabilities,
  importApplications: syncOutlook,
  syncStatuses: syncOutlook,
};
