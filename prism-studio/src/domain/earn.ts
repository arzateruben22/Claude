// "Get paid": how close each channel is to YouTube's and TikTok's payout programmes. Payout eligibility is per
// account, so this reads account-level numbers (account_snapshots), never per-post metrics.
// Only owner-read (manual) or platform-API values count. Estimates and demo numbers are ignored. A number nobody has
// logged stays blank (null), never 0. The thresholds are platform rules, not business facts; they come from
// third-party summaries, so they carry a source URL and the date they were checked.
import { eq, sql } from "drizzle-orm";
import { DomainError, audit, type Conn } from "./core";
import { OFFICIAL } from "./catalog";
import { accountSnapshots, destinations } from "../db/schema";

export const EARN_COUNTED_SOURCES = ["manual", "api"] as const;
export const STALE_AFTER_DAYS = 14;
export const CLOSE_OVER_PERCENT = 75;

export const YT_METRICS = ["subscribers", "watch_hours_12m", "shorts_views_90d", "uploads_90d"] as const;
export const TT_METRICS = ["followers", "views_30d"] as const;
export type EarnPlatform = "youtube" | "tiktok";
export type EarnMetric = (typeof YT_METRICS)[number] | (typeof TT_METRICS)[number];
export const METRICS_BY_PLATFORM: Record<EarnPlatform, readonly EarnMetric[]> = { youtube: YT_METRICS, tiktok: TT_METRICS };

export const METRIC_LABEL: Record<EarnMetric, string> = {
  subscribers: "Subscribers", watch_hours_12m: "Public watch hours (12 months)", shorts_views_90d: "Valid Shorts views (90 days)",
  uploads_90d: "Public uploads (90 days)", followers: "Followers", views_30d: "Views (30 days)",
};
const SHORT_LABEL: Record<EarnMetric, string> = {
  subscribers: "Subscribers", watch_hours_12m: "Watch hours", shorts_views_90d: "Shorts views", uploads_90d: "Uploads", followers: "Followers", views_30d: "Views, 30 days",
};
const NEXT_PHRASE: Record<EarnMetric, string> = {
  subscribers: "subscribers", watch_hours_12m: "public watch hours", shorts_views_90d: "valid Shorts views", uploads_90d: "public uploads in 90 days", followers: "followers", views_30d: "views in the last 30 days",
};

export type EarnRules = {
  checkedOn: string;
  youtube: {
    sourceUrl: string; sourceLabel: string;
    full: { subscribers: number; watchHours: number; shortsViews: number };
    early: { subscribers: number; uploads: number; watchHours: number; shortsViews: number };
    note: string;
  };
  tiktok: { sourceUrl: string; sourceLabel: string; followers: number; views30d: number; notes: string[] };
  disclaimer: string;
};

export const EARN_RULES: EarnRules = {
  checkedOn: "2026-11-09",
  youtube: {
    sourceUrl: OFFICIAL.youtube.partnerProgram, sourceLabel: "YouTube Partner Program overview",
    full: { subscribers: 1000, watchHours: 4000, shortsViews: 10_000_000 },
    early: { subscribers: 500, uploads: 3, watchHours: 3000, shortsViews: 3_000_000 },
    note: "YouTube has announced new ad-revenue thresholds for new applicants from 1 Feb 2027; current members are kept. Check before then.",
  },
  tiktok: {
    sourceUrl: OFFICIAL.tiktok.creatorRewards, sourceLabel: "TikTok Creator Rewards",
    followers: 10_000, views30d: 100_000,
    notes: ["You must be 18 or older.", "Your country must be eligible.", "Only videos 60 s or longer earn."],
  },
  disclaimer: "Rules checked 9 Nov 2026. Always confirm in YouTube Studio → Earn / TikTok Studio.",
};

export type Snap = { metric: string; value: number; source: string; recordedAt: Date };

export type Req = {
  metric: EarnMetric; label: string; value: number | null; target: number;
  percent: number | null;   // unrounded, capped at 100; null = no counted number yet
  left: number | null;      // what is still missing; null when the number is blank
  met: boolean;
};
export type Tier = {
  id: "full" | "early" | "rewards"; name: string; unlocks: string; met: boolean;
  percent: number;          // the weakest requirement (a blank one counts as 0)
  reqs: Req[];              // the requirements that all apply (YouTube: with the closer route last)
  route: Req | null;        // YouTube: the closer of the two either/or routes
  otherRoute: Req | null;   // YouTube: the route that is further away
};
export type Status = "not_started" | "on_the_way" | "close" | "eligible";
export const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not started (no numbers yet)", on_the_way: "On the way", close: "Close (over 75%)", eligible: "Eligible: apply now",
};
export type Progress = {
  platform: EarnPlatform; status: Status; statusLabel: string; hasNumbers: boolean;
  ageDays: number | null;   // the oldest of the counted numbers in use
  stale: boolean; ageLine: string | null;
  ignored: number;          // metrics that only have estimate or demo values (not counted)
  tiers: Tier[]; lead: Tier;   // lead = the tier that is furthest along
  next: string | null;      // "180 more YouTube subscribers to unlock the early tier"
  missing: string[];        // required numbers nobody has logged yet (the lead tier's)
  notes: string[];
};

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const DAY = 86_400_000;

/** The newest counted value per metric (estimates and demo rows never count), and how many metrics had only ignored ones. */
export function latestCounted(snaps: Snap[], metrics: readonly EarnMetric[]) {
  const counted = new Map<string, Snap>(); const seenIgnored = new Set<string>();
  for (const s of snaps) {
    if (!(metrics as readonly string[]).includes(s.metric)) continue;
    if (!(EARN_COUNTED_SOURCES as readonly string[]).includes(s.source) || !Number.isFinite(s.value) || s.value < 0) { seenIgnored.add(s.metric); continue; }
    const cur = counted.get(s.metric);
    if (!cur || s.recordedAt > cur.recordedAt) counted.set(s.metric, s);
  }
  return { counted, ignored: [...seenIgnored].filter((m) => !counted.has(m)).length };
}

function req(metric: EarnMetric, target: number, counted: Map<string, Snap>): Req {
  const v = counted.get(metric)?.value ?? null;
  return { metric, label: SHORT_LABEL[metric], value: v, target, percent: v == null ? null : Math.min(100, (v / target) * 100), left: v == null ? null : Math.max(0, target - v), met: v != null && v >= target };
}

/** Of two either/or routes, the one nearer its target (a logged number beats a blank one; a tie keeps the first). */
function closer(a: Req, b: Req): [Req, Req] {
  return (b.percent ?? -1) > (a.percent ?? -1) ? [b, a] : [a, b];
}

function tier(id: Tier["id"], name: string, unlocks: string, reqs: Req[], route: Req | null, otherRoute: Req | null): Tier {
  return { id, name, unlocks, met: reqs.every((r) => r.met), percent: Math.min(...reqs.map((r) => r.percent ?? 0)), reqs, route, otherRoute };
}

/** Progress toward payout for one account on one platform, from its snapshots (any order, any source). */
export function earnProgress(platform: EarnPlatform, snaps: Snap[], now: Date, rules: EarnRules = EARN_RULES): Progress {
  const { counted, ignored } = latestCounted(snaps, METRICS_BY_PLATFORM[platform]);
  let tiers: Tier[]; let notes: string[] = [];
  if (platform === "youtube") {
    const { full, early } = rules.youtube;
    const [fr, fo] = closer(req("watch_hours_12m", full.watchHours, counted), req("shorts_views_90d", full.shortsViews, counted));
    const [er, eo] = closer(req("watch_hours_12m", early.watchHours, counted), req("shorts_views_90d", early.shortsViews, counted));
    tiers = [
      tier("full", "Partner Program", "ad revenue", [req("subscribers", full.subscribers, counted), fr], fr, fo),
      tier("early", "Early tier", "fan funding and shopping, no ad revenue", [req("subscribers", early.subscribers, counted), req("uploads_90d", early.uploads, counted), er], er, eo),
    ];
    notes = [rules.youtube.note];
  } else {
    const t = rules.tiktok;
    tiers = [tier("rewards", "Creator Rewards", "paid for qualifying videos", [req("followers", t.followers, counted), req("views_30d", t.views30d, counted)], null, null)];
    notes = t.notes;
  }
  const hasNumbers = counted.size > 0;
  const lead = tiers.reduce((best, t) => (t.percent > best.percent ? t : best), tiers[0]);
  const status: Status = !hasNumbers ? "not_started" : tiers.some((t) => t.met) ? "eligible" : lead.percent > CLOSE_OVER_PERCENT ? "close" : "on_the_way";
  // Age: the oldest counted number among those the lead tier uses, so one fresh number can't hide an old one.
  const used = lead.reqs.map((r) => counted.get(r.metric)).filter((s): s is Snap => !!s);
  const oldest = used.length ? Math.min(...used.map((s) => s.recordedAt.getTime())) : null;
  const ageDays = oldest == null ? null : Math.max(0, Math.floor((now.getTime() - oldest) / DAY));
  const stale = ageDays != null && ageDays > STALE_AFTER_DAYS;
  const unmet = lead.reqs.filter((r) => !r.met);
  const step = unmet.find((r) => r.left != null);
  const unlock = lead.id === "early" ? "early tier" : lead.id === "full" ? "full Partner Program" : "Creator Rewards";
  const next = status === "eligible" || !hasNumbers || !step ? null
    : `${n(Math.ceil(step.left!))} more ${platform === "youtube" ? "YouTube" : "TikTok"} ${NEXT_PHRASE[step.metric]} to unlock the ${unlock}`;
  return {
    platform, status, statusLabel: STATUS_LABEL[status], hasNumbers, ageDays, stale,
    ageLine: ageDays == null ? null : `numbers are ${ageDays} day${ageDays === 1 ? "" : "s"} old`,
    ignored, tiers, lead, next, missing: hasNumbers ? unmet.filter((r) => r.value == null).map((r) => r.label.toLowerCase()) : [], notes,
  };
}

// ── what needs attention ────────────────────────────────────────────────────
export type AttentionInput = { channel: string; rows: { platform: EarnPlatform; progress: Progress }[] };
export type Attention = { kind: "eligible" | "stale" | "next" | "missing" | "none" | "tiktok_60s"; text: string; channel?: string };
const PLATFORM_NAME = { youtube: "YouTube", tiktok: "TikTok" } as const;
const joinNames = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The few things worth the owner's attention, most important first: eligible, stale numbers, the next step for
 *  accounts that are close, then the rest by how far along they are, blank accounts, and the TikTok 60 s reminder. */
export function attentionItems(channels: AttentionInput[], max = 5): Attention[] {
  const out: (Attention & { rank: number })[] = [];
  for (const c of channels) {
    const none: string[] = [];
    for (const { platform, progress: p } of c.rows) {
      const P = PLATFORM_NAME[platform];
      if (!p.hasNumbers) { none.push(P); continue; }
      if (p.status === "eligible") out.push({ kind: "eligible", rank: 0, channel: c.channel, text: `Eligible: ${c.channel} can apply now in ${platform === "youtube" ? "YouTube Studio → Earn" : "TikTok Studio"}` });
      else if (p.next) out.push({ kind: "next", rank: 30 + (100 - p.lead.percent) / 100, channel: c.channel, text: `${c.channel}: ${p.next}` });
      else if (p.missing.length) out.push({ kind: "missing", rank: 40, channel: c.channel, text: `${c.channel} on ${P}: log ${p.missing[0]} to see how close you are` });
      if (p.stale) out.push({ kind: "stale", rank: 10 + (p.status === "close" ? 0 : 1), channel: c.channel, text: `Log your numbers: ${c.channel}'s ${P} numbers are ${p.ageDays} days old` });
    }
    if (none.length) out.push({ kind: "none", rank: 50, channel: c.channel, text: `No numbers yet for ${c.channel} on ${joinNames(none)}` });
  }
  if (channels.some((c) => c.rows.some((r) => r.platform === "tiktok" && r.progress.status !== "eligible"))) {
    out.push({ kind: "tiktok_60s", rank: 60, text: "TikTok: only videos 60 s or longer earn" });
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, max).map(({ rank: _r, ...a }) => a);
}

// ── database ────────────────────────────────────────────────────────────────
/** Every account snapshot grouped by destination (the table is small: a few rows per account per check). */
export async function accountSnapshotsByDestination(c: Conn) {
  const rows = await c.select().from(accountSnapshots).orderBy(sql`${accountSnapshots.recordedAt} desc`);
  const by = new Map<string, Snap[]>();
  for (const r of rows) {
    const list = by.get(r.destinationId) ?? [];
    list.push({ metric: r.metric, value: r.value, source: r.source, recordedAt: r.recordedAt });
    by.set(r.destinationId, list);
  }
  return by;
}

/** Log account numbers the owner read from YouTube Studio or TikTok Studio. A blank field is skipped (never stored as 0). */
export async function recordAccountMetrics(c: Conn, input: { destinationId: string; values: Partial<Record<string, number | null>>; source: "manual" | "estimate" | "demo"; at?: Date }) {
  const [dest] = await c.select().from(destinations).where(eq(destinations.id, input.destinationId));
  if (!dest || (dest.platform !== "youtube" && dest.platform !== "tiktok")) throw new DomainError("destination", "That account can't be logged here.");
  const allowed = METRICS_BY_PLATFORM[dest.platform] as readonly string[];
  const rows = Object.entries(input.values).filter(([, v]) => v != null);
  if (!rows.length) throw new DomainError("empty", "Enter at least one number.");
  for (const [m, v] of rows) {
    if (!allowed.includes(m)) throw new DomainError("metric", "That number doesn't belong to this platform.");
    if (!Number.isFinite(v) || (v as number) < 0) throw new DomainError("value", "Numbers can't be negative.");
  }
  const at = input.at ?? new Date();
  await c.insert(accountSnapshots).values(rows.map(([metric, v]) => ({ destinationId: dest.id, metric, value: v as number, source: input.source, recordedAt: at })));
  await audit(c, "owner", "account_metrics.log", "destination", dest.id, { metrics: rows.map(([m]) => m), source: input.source });
  return { count: rows.length, platform: dest.platform };
}
