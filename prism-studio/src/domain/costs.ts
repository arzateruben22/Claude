// Production costs and budgets. Prism records costs; it never pays, charges or moves money.
// - Production budgets are separate from personal rewards: nothing here reads or writes the reward tables
//   (rewards, reward_ledger, reward_settings), and nothing in rewards.ts reads these.
// - A budget is monthly, studio-wide or for one channel. A row applies from its month on until a later row for the
//   same scope replaces it; a row with no cap ends the budget from that month.
// - Only actual (source "manual"), unvoided entries in the budget's currency count as spent. Estimates are labelled
//   ESTIMATE and never count as spent. Prism never converts currencies, so an actual cost in another currency is
//   shown apart, and it keeps paid generation off for that month (Prism can't tell whether the budget has room).
// - Paid generation is allowed only when Settings has it on, external actions aren't stopped, the channel has a
//   production budget this month with room for the amount, and the studio-wide budget (when one is set) has room too.
// Money is integer cents throughout; months are "YYYY-MM" and cost dates "YYYY-MM-DD" in the studio timezone.
import { asc, eq, lte, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { budgets, channels, costLedger, episodes } from "../db/schema";
import { audit, type Conn, DomainError, settings } from "./core";
import { localMonth } from "./time";

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN"] as const;   // two-decimal currencies only (cents)
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "USD";
export const COST_CATEGORIES = ["voice", "visuals", "music", "research", "render", "storage", "software", "publishing", "other"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];
export type CostSource = "manual" | "estimate";
export const MAX_CENTS = 100_000_000;   // $1,000,000: a typo guard, not a business limit

export type Budget = typeof budgets.$inferSelect;
export type CostEntry = typeof costLedger.$inferSelect;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const isMonth = (s: string) => MONTH.test(s);

/** "12", "12.5", "1,234.56", "$19.99" → whole cents. Parsed as text, never through floating point. */
export function parseMoney(input: string): number {
  const s = input.trim().replace(/^\$/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  const m = s.match(/^(\d{1,9})(?:\.(\d{1,2}))?$/);
  if (!m) throw new DomainError("bad_amount", "Enter an amount like 12.50 (at most two decimals).");
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (cents > MAX_CENTS) throw new DomainError("bad_amount", "That amount is too large.");
  return cents;
}

/** The amount an entry carries, whatever its source. */
export const amountOf = (e: Pick<CostEntry, "source" | "estimateCents" | "actualCents">) => (e.source === "estimate" ? e.estimateCents : e.actualCents ?? 0);

/** The months before and including `month`, oldest first. */
export function monthsBack(month: string, n: number): string[] {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return t.toISOString().slice(0, 7);
  });
}

const scopeKeyOf = (channelId: string | null) => channelId ?? "studio";
function checkCurrency(c: string): Currency {
  if (!(CURRENCIES as readonly string[]).includes(c)) throw new DomainError("currency", `Use one of ${CURRENCIES.join(", ")}.`);
  return c as Currency;
}
function checkCents(cents: number, what: string, allowZero = false) {
  if (!Number.isInteger(cents) || cents < 0 || (!allowZero && cents === 0) || cents > MAX_CENTS) throw new DomainError("bad_amount", `${what} must be whole cents${allowZero ? "" : " above zero"}.`);
}

// ── budgets ─────────────────────────────────────────────────────────────────
/** Set (or end, with capCents null) the monthly production budget for the studio (channelId null) or a channel, from `month` on. */
export async function setBudget(d: DB, v: { channelId: string | null; month: string; capCents: number | null; currency?: string; note?: string }) {
  if (!isMonth(v.month)) throw new DomainError("month", "Pick a month.");
  if (v.capCents != null) checkCents(v.capCents, "A budget", true);
  const currency = checkCurrency(v.currency ?? DEFAULT_CURRENCY);
  if (v.channelId) {
    const [ch] = await d.select({ id: channels.id }).from(channels).where(eq(channels.id, v.channelId));
    if (!ch) throw new DomainError("not_found", "channel not found");
  }
  const row = { scope: v.channelId ? "channel" : "studio", scopeKey: scopeKeyOf(v.channelId), channelId: v.channelId, month: v.month, capCents: v.capCents, currency, note: v.note ?? "" };
  const [b] = await d.insert(budgets).values(row)
    .onConflictDoUpdate({ target: [budgets.scopeKey, budgets.month], set: { capCents: v.capCents, currency, note: row.note, updatedAt: new Date() } }).returning();
  await audit(d, "owner", "budget.set", "budget", b.id, { scope: row.scope, channelId: v.channelId, month: v.month, capCents: v.capCents, currency });
  return b;
}

/** The budget row in force for a scope in a month: the latest row at or before it. Null when none, or when it was ended. */
export function effectiveBudget(rows: Budget[], channelId: string | null, month: string): Budget | null {
  const key = scopeKeyOf(channelId);
  const best = rows.filter((r) => r.scopeKey === key && r.month <= month).sort((a, b) => (a.month < b.month ? 1 : -1))[0];
  return best && best.capCents != null ? best : null;
}

export async function budgetRows(c: Conn, upTo?: string) {
  return c.select().from(budgets).where(upTo ? lte(budgets.month, upTo) : undefined).orderBy(asc(budgets.month));
}

// ── cost entries ────────────────────────────────────────────────────────────
export type CostInput = {
  description: string; amountCents: number; currency?: string; incurredOn: string; source: CostSource;
  category: string; channelId?: string | null; episodeId?: string | null; provider?: string; note?: string;
};

async function checkCost(c: Conn, v: CostInput) {
  const description = v.description.trim();
  if (description.length < 2 || description.length > 200) throw new DomainError("description", "Say what it was (2–200 characters).");
  checkCents(v.amountCents, "The amount");
  const currency = checkCurrency(v.currency ?? DEFAULT_CURRENCY);
  if (!isDay(v.incurredOn)) throw new DomainError("date", "Pick the date of the cost.");
  if (v.source !== "manual" && v.source !== "estimate") throw new DomainError("source", "A cost is an actual cost or an estimate.");
  if (!(COST_CATEGORIES as readonly string[]).includes(v.category)) throw new DomainError("category", "Pick a category.");
  let channelId = v.channelId || null;
  const episodeId = v.episodeId || null;
  if (episodeId) {
    const [e] = await c.select({ id: episodes.id, channelId: episodes.channelId, isDemo: episodes.isDemo }).from(episodes).where(eq(episodes.id, episodeId));
    if (!e) throw new DomainError("not_found", "episode not found");
    if (e.isDemo) throw new DomainError("demo", "A DEMO episode can't carry a real cost.");
    if (channelId && channelId !== e.channelId) throw new DomainError("channel", "That episode belongs to another channel.");
    channelId = e.channelId;
  } else if (channelId) {
    const [ch] = await c.select({ id: channels.id }).from(channels).where(eq(channels.id, channelId));
    if (!ch) throw new DomainError("not_found", "channel not found");
  }
  return {
    description, currency, incurredOn: v.incurredOn, source: v.source, category: v.category, channelId, episodeId,
    provider: (v.provider ?? "").trim().slice(0, 80), note: (v.note ?? "").trim().slice(0, 500),
    estimateCents: v.source === "estimate" ? v.amountCents : 0, actualCents: v.source === "estimate" ? null : v.amountCents,
  };
}

/** Record a cost the owner paid themselves (or an estimate). Prism only writes it down. */
export async function addCost(d: DB, v: CostInput) {
  const row = await checkCost(d, v);
  const [e] = await d.insert(costLedger).values(row).returning();
  await audit(d, "owner", "cost.add", "cost", e.id, { amountCents: v.amountCents, currency: row.currency, source: row.source, channelId: row.channelId });
  return e;
}

async function ownerEntry(d: DB, id: string) {
  const [e] = await d.select().from(costLedger).where(eq(costLedger.id, id));
  if (!e) throw new DomainError("not_found", "cost entry not found");
  if (e.jobId) throw new DomainError("job_cost", "This cost was recorded by a job; it can't be edited here.");
  if (e.voidedAt) throw new DomainError("voided", "This entry is void; record a new one instead.");
  return e;
}

export async function editCost(d: DB, id: string, v: CostInput) {
  const before = await ownerEntry(d, id);
  const row = await checkCost(d, v);
  const [e] = await d.update(costLedger).set({ ...row, updatedAt: new Date() }).where(eq(costLedger.id, id)).returning();
  await audit(d, "owner", "cost.edit", "cost", id, { from: { amountCents: amountOf(before), currency: before.currency, source: before.source }, to: { amountCents: v.amountCents, currency: row.currency, source: row.source } });
  return e;
}

/** Void an entry: it stays on the record (struck through) and counts for nothing. */
export async function voidCost(d: DB, id: string, reason: string) {
  await ownerEntry(d, id);
  const why = reason.trim();
  if (why.length < 2) throw new DomainError("reason", "Say why it's void (a typo, a refund…).");
  const [e] = await d.update(costLedger).set({ voidedAt: new Date(), voidReason: why.slice(0, 300), updatedAt: new Date() }).where(eq(costLedger.id, id)).returning();
  await audit(d, "owner", "cost.void", "cost", id, { reason: why });
  return e;
}

// ── spent vs budget ─────────────────────────────────────────────────────────
type Agg = { month: string; channelId: string | null; currency: string; source: string; cents: number };

/** Unvoided totals by month, channel, currency and source for the given months. */
async function aggregates(c: Conn, months: string[]): Promise<Agg[]> {
  if (!months.length) return [];
  const r = await c.execute(sql`
    select to_char(incurred_on, 'YYYY-MM') as month, channel_id as "channelId", currency, source,
           coalesce(sum(case when source = 'estimate' then estimate_cents else actual_cents end), 0)::bigint as cents
      from cost_ledger
     where voided_at is null and to_char(incurred_on, 'YYYY-MM') in ${months}
     group by 1, 2, 3, 4`);
  return (r.rows as Agg[]).map((x) => ({ ...x, cents: Number(x.cents) }));
}

export type ScopeSummary = {
  month: string; channelId: string | null; budget: Budget | null; currency: string;
  spentCents: number;                                   // actual, unvoided, in the budget's currency
  estimateCents: number;                                // estimates in that currency: shown, never spent
  unconverted: { currency: string; cents: number }[];   // actual costs in other currencies: not converted, not counted
  remainingCents: number | null;                        // null without a budget; never below 0
  overCents: number;                                    // how far spending went past the budget
};

export function summarizeScope(aggs: Agg[], rows: Budget[], channelId: string | null, month: string): ScopeSummary {
  const budget = effectiveBudget(rows, channelId, month);
  const currency = budget?.currency ?? DEFAULT_CURRENCY;
  const mine = aggs.filter((a) => a.month === month && (channelId == null || a.channelId === channelId));
  const sum = (f: (a: Agg) => boolean) => mine.filter(f).reduce((n, a) => n + a.cents, 0);
  const spentCents = sum((a) => a.source !== "estimate" && a.currency === currency);
  const estimateCents = sum((a) => a.source === "estimate" && a.currency === currency);
  const other = [...new Set(mine.filter((a) => a.source !== "estimate" && a.currency !== currency).map((a) => a.currency))];
  const unconverted = other.map((cur) => ({ currency: cur, cents: sum((a) => a.source !== "estimate" && a.currency === cur) })).filter((u) => u.cents > 0);
  const cap = budget?.capCents ?? null;
  return {
    month, channelId, budget, currency, spentCents, estimateCents, unconverted,
    remainingCents: cap == null ? null : Math.max(0, cap - spentCents), overCents: cap == null ? 0 : Math.max(0, spentCents - cap),
  };
}

/** Spent vs budget for the studio and each channel, for each of the given months. */
export async function costTotals(c: Conn, months: string[]) {
  const [aggs, rows] = await Promise.all([aggregates(c, months), budgetRows(c)]);
  return { scope: (channelId: string | null, month: string) => summarizeScope(aggs, rows, channelId, month) };
}

// ── the paid-generation gate ────────────────────────────────────────────────
export type PaidGenerationCheck = {
  ok: boolean;
  code: "ok" | "bad_amount" | "switch_off" | "stopped" | "no_budget" | "no_room" | "studio_no_room" | "unconverted";
  reason: string; month: string; currency: string | null; remainingCents: number | null;
};

const fmt = (cents: number, currency: string) => (cents / 100).toLocaleString("en-US", { style: "currency", currency });

/**
 * May a job spend `amountCents` (in the channel budget's currency) on paid generation for this channel now?
 * Read-only: it records nothing and reserves nothing (Prism never pays; the cost is recorded once it's known).
 */
export async function canUsePaidGeneration(c: Conn, channelId: string, amountCents: number, at = new Date()): Promise<PaidGenerationCheck> {
  const s = await settings(c);
  const month = localMonth(at, s.timezone);
  const no = (code: PaidGenerationCheck["code"], reason: string, extra: Partial<PaidGenerationCheck> = {}): PaidGenerationCheck =>
    ({ ok: false, code, reason, month, currency: null, remainingCents: null, ...extra });
  if (!Number.isInteger(amountCents) || amountCents <= 0) return no("bad_amount", "The amount must be whole cents above zero.");
  const t = await costTotals(c, [month]);
  const ch = t.scope(channelId, month), studio = t.scope(null, month);
  const room = { currency: ch.budget ? ch.currency : null, remainingCents: ch.remainingCents };
  if (!s.paidGenerationEnabled) return no("switch_off", "Paid generation is off in Settings.", room);
  if (s.stopExternalActions) return no("stopped", "External actions are stopped in Settings.", room);
  if (!ch.budget) return no("no_budget", "This channel has no production budget this month.");
  if (ch.unconverted.length || (studio.budget && studio.unconverted.length))
    return no("unconverted", `There are costs this month in another currency (${[...ch.unconverted, ...(studio.budget ? studio.unconverted : [])].map((u) => u.currency).join(", ")}); Prism doesn't convert, so it can't tell whether the budget has room.`, room);
  if (ch.remainingCents! < amountCents) return no("no_room", `Not enough room: ${fmt(ch.remainingCents!, ch.currency)} left in this channel's budget this month.`, room);
  if (studio.budget) {
    if (studio.currency !== ch.currency) return no("unconverted", `The studio-wide budget is in ${studio.currency} and this channel's in ${ch.currency}; Prism doesn't convert.`, room);
    if (studio.remainingCents! < amountCents) return no("studio_no_room", `Not enough room in the studio-wide budget: ${fmt(studio.remainingCents!, studio.currency)} left this month.`, room);
  }
  return { ok: true, code: "ok", reason: `Allowed: ${fmt(ch.remainingCents!, ch.currency)} left in this channel's budget this month.`, month, currency: ch.currency, remainingCents: ch.remainingCents };
}

/** Whether the Settings switch may be turned on: some channel has a production budget this month. */
export async function anyChannelBudget(c: Conn, at = new Date()) {
  const s = await settings(c);
  const month = localMonth(at, s.timezone);
  const rows = await budgetRows(c, month);
  const chans = await c.select({ id: channels.id }).from(channels);
  return chans.some((ch) => effectiveBudget(rows, ch.id, month));
}

/** Entries for the Costs screen, newest first (voided ones included, marked). */
export async function costEntries(c: Conn, o: { channelId?: string | null; limit?: number } = {}) {
  return c.select().from(costLedger).where(o.channelId ? eq(costLedger.channelId, o.channelId) : undefined)
    .orderBy(sql`${costLedger.incurredOn} desc, ${costLedger.createdAt} desc`).limit(o.limit ?? 60);
}
