/**
 * CoachMessage storage format. Pure: parses the `metrics` JSON column defensively (it is written by
 * this module only, but old or hand-edited rows must never crash the page).
 */
import type { Draft } from "./drafts";
import { isInterviewRole, type InterviewRole } from "./intents";
import { isInterviewState, type InterviewState } from "./mock-interview";
import type { QuickReply, ReplyKind } from "./replies";
import type { CitedMetric, MetricBasis, RecommendationAction } from "./types";

export type CoachProvider = "RULES" | "ANTHROPIC";

export type StoredMessageMeta = {
  v: 1;
  kind?: ReplyKind;
  citations: CitedMetric[];
  notice?: string;
  actions?: RecommendationAction[];
  quickReplies?: QuickReply[];
  drafts?: Draft[];
  interview?: InterviewState | null;
  /** Context the user sent with a message. */
  context?: { applicationId?: string; role?: InterviewRole };
  model?: string;
};

export type CoachMessageView = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  provider: CoachProvider;
  createdAt: string;
} & Omit<StoredMessageMeta, "v" | "context">;

const BASES = new Set<MetricBasis>(["observed", "self_reported", "verified", "estimate", "target", "reference"]);

function str(v: unknown, max = 4000): string | undefined {
  return typeof v === "string" && v.length > 0 ? v.slice(0, max) : undefined;
}

function isHref(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//");
}

function parseCited(v: unknown): CitedMetric | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 120);
  const label = str(o.label, 300);
  const display = str(o.display, 600);
  if (!id || !label || display === undefined) return null;
  const basis = BASES.has(o.basis as MetricBasis) ? (o.basis as MetricBasis) : "observed";
  const iv = o.interval as { low?: unknown; high?: unknown } | null | undefined;
  return {
    id,
    label,
    display,
    basis,
    detail: str(o.detail, 1000),
    n: typeof o.n === "number" ? o.n : undefined,
    interval: iv && typeof iv.low === "number" && typeof iv.high === "number" ? { low: iv.low, high: iv.high } : null,
    lowSample: o.lowSample === true ? true : undefined,
    href: isHref(o.href) ? o.href : undefined,
  };
}

function parseActions(v: unknown): RecommendationAction[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((a) => (a && typeof a === "object" ? (a as Record<string, unknown>) : null))
    .filter((a): a is Record<string, unknown> => a !== null && typeof a.label === "string" && isHref(a.href))
    .map((a) => ({ label: String(a.label).slice(0, 120), href: String(a.href) }));
  return out.length ? out : undefined;
}

function parseQuickReplies(v: unknown): QuickReply[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: QuickReply[] = [];
  for (const q of v) {
    if (!q || typeof q !== "object") continue;
    const o = q as Record<string, unknown>;
    const label = str(o.label, 160);
    const text = str(o.text, 500);
    if (!label || !text) continue;
    out.push({
      label,
      text,
      applicationId: typeof o.applicationId === "string" && /^[0-9a-f-]{36}$/i.test(o.applicationId) ? o.applicationId : undefined,
      role: isInterviewRole(o.role) ? o.role : undefined,
    });
  }
  return out.length ? out : undefined;
}

function parseDrafts(v: unknown): Draft[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: Draft[] = [];
  for (const d of v) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    const title = str(o.title, 200);
    const body = str(o.body, 20000);
    if (title && body) out.push({ title, body, subject: str(o.subject, 300) });
  }
  return out.length ? out : undefined;
}

export function parseMeta(raw: unknown): StoredMessageMeta {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const citations = Array.isArray(o.citations) ? o.citations.map(parseCited).filter((c): c is CitedMetric => c !== null) : [];
  const ctx = o.context && typeof o.context === "object" ? (o.context as Record<string, unknown>) : null;
  return {
    v: 1,
    kind: typeof o.kind === "string" ? (o.kind as ReplyKind) : undefined,
    citations,
    notice: str(o.notice, 600),
    actions: parseActions(o.actions),
    quickReplies: parseQuickReplies(o.quickReplies),
    drafts: parseDrafts(o.drafts),
    interview: isInterviewState(o.interview) ? o.interview : null,
    context: ctx
      ? {
          applicationId: typeof ctx.applicationId === "string" ? ctx.applicationId : undefined,
          role: isInterviewRole(ctx.role) ? ctx.role : undefined,
        }
      : undefined,
    model: str(o.model, 100),
  };
}

export function toMessageView(row: { id: string; role: "USER" | "ASSISTANT"; content: string; provider: string; createdAt: Date; metrics: unknown }): CoachMessageView {
  const meta = parseMeta(row.metrics);
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    provider: row.provider === "ANTHROPIC" ? "ANTHROPIC" : "RULES",
    createdAt: row.createdAt.toISOString(),
    kind: meta.kind,
    citations: meta.citations,
    notice: meta.notice,
    actions: meta.actions,
    quickReplies: meta.quickReplies,
    drafts: meta.drafts,
    interview: meta.interview,
    model: meta.model,
  };
}

/** JSON-safe copy (drops undefined) for a Prisma Json column. */
export function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
