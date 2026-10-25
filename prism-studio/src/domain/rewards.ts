// Milestones, achievements and personal rewards.
// - An achievement unlocks once per (rule, scope): the unique index on achievement_events makes repeated metric
//   imports, job retries and cross-posts of the same episode unable to unlock it twice.
// - A personal reward is money the owner deliberately put into a reward budget. It is reserved only when both the
//   funded balance and the monthly cap allow it; otherwise the achievement stands and the reward waits ("pending
//   funding"). Nothing here moves money: "claim" records something the owner did themselves.
// - Demo metrics can unlock demo badges only; they never create or reserve a real reward.
import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { achievementEvents, metricSnapshots, milestoneRules, publications, episodes, rewardLedger, rewardSettings, rewards } from "../db/schema";
import { audit, type Conn, DomainError, settings } from "./core";
import { localMonth } from "./time";
import { awardXp } from "./living";

export const QUALIFYING_SOURCES = ["api", "csv", "manual"] as const;   // manual = owner-confirmed from platform analytics

export async function rewardBalances(c: Conn, at = new Date()) {
  const s = await settings(c);
  const month = localMonth(at, s.timezone);
  const [rs] = await c.select().from(rewardSettings).where(eq(rewardSettings.id, 1));
  const sum = async (kinds: string[], m?: string) => {
    const r = await c.execute(sql`select coalesce(sum(amount_cents), 0)::int as v from reward_ledger where kind::text = any(${kinds}) ${m ? sql`and month = ${m}` : sql``}`);
    return Number((r.rows[0] as { v: number }).v);
  };
  const funded = (await sum(["allocation"])) + (await sum(["adjustment"]));
  const reservedRows = await c.select().from(rewards).where(eq(rewards.status, "reserved"));
  const reserved = reservedRows.reduce((a, r) => a + r.amountCents, 0);
  const claimed = await sum(["claim"]);
  const usedThisMonth = (await sum(["reservation"], month)) - (await sum(["release"], month));
  const cap = rs?.monthlyCapCents ?? null;
  return {
    month, capCents: cap, configured: cap != null,
    fundedCents: funded, reservedCents: reserved, claimedCents: claimed,
    availableCents: funded - reserved - claimed,
    remainingMonthlyCents: cap == null ? 0 : Math.max(0, cap - usedThisMonth),
  };
}

export async function setMonthlyCap(d: DB, capCents: number | null) {
  if (capCents != null && (capCents < 0 || !Number.isInteger(capCents))) throw new DomainError("bad_amount", "the cap must be whole cents ≥ 0");
  await d.insert(rewardSettings).values({ id: 1, monthlyCapCents: capCents }).onConflictDoUpdate({ target: rewardSettings.id, set: { monthlyCapCents: capCents, updatedAt: new Date() } });
  await audit(d, "owner", "reward.cap", "reward_settings", "1", { capCents });
  await reservePending(d);
}

/** The owner moves their own money into the reward budget (or corrects it with a signed adjustment). */
export async function addFunding(d: DB, v: { amountCents: number; kind?: "allocation" | "adjustment"; note?: string }) {
  if (!Number.isInteger(v.amountCents) || (v.kind !== "adjustment" && v.amountCents <= 0)) throw new DomainError("bad_amount", "enter a positive whole amount");
  const s = await settings(d);
  await d.insert(rewardLedger).values({ kind: v.kind ?? "allocation", amountCents: v.amountCents, month: localMonth(new Date(), s.timezone), note: v.note ?? "" });
  await audit(d, "owner", "reward.fund", "reward_ledger", "", { ...v });
  await reservePending(d);
}

/** Try to reserve one reward. Serialised on the reward_settings row, so two workers can't spend the same balance. */
export async function tryReserve(d: DB, rewardId: string): Promise<"reserved" | "pending_funding" | "unchanged"> {
  return d.transaction(async (tx) => {
    await tx.insert(rewardSettings).values({ id: 1 }).onConflictDoNothing();
    await tx.execute(sql`select id from reward_settings where id = 1 for update`);
    const [r] = await tx.select().from(rewards).where(eq(rewards.id, rewardId)).for("update");
    if (!r || r.status !== "pending_funding") return "unchanged";
    const [ev] = await tx.select().from(achievementEvents).where(eq(achievementEvents.id, r.achievementEventId));
    if (ev.isDemo) return "unchanged";
    const b = await rewardBalances(tx);
    if (!b.configured || b.availableCents < r.amountCents || b.remainingMonthlyCents < r.amountCents) return "pending_funding";
    await tx.update(rewards).set({ status: "reserved", reservedAt: new Date() }).where(eq(rewards.id, r.id));
    await tx.insert(rewardLedger).values({ kind: "reservation", amountCents: r.amountCents, rewardId: r.id, month: b.month, note: "reserved for an achievement" });
    await audit(tx, "system", "reward.reserve", "reward", r.id, { amountCents: r.amountCents });
    return "reserved";
  });
}

export async function reservePending(d: DB) {
  const pending = await d.select().from(rewards).where(eq(rewards.status, "pending_funding")).orderBy(rewards.createdAt);
  for (const r of pending) await tryReserve(d, r.id);
}

/** Record that the owner used a reserved reward (a dinner, a purchase…). No payment happens here. */
export async function claimReward(d: DB, rewardId: string, v: { description?: string; note?: string }) {
  return d.transaction(async (tx) => {
    const [r] = await tx.select().from(rewards).where(eq(rewards.id, rewardId)).for("update");
    if (!r) throw new DomainError("not_found", "reward not found");
    if (r.status !== "reserved") throw new DomainError("not_reserved", "only a reserved (funded) reward can be claimed");
    const s = await settings(tx);
    await tx.update(rewards).set({ status: "claimed", claimedAt: new Date(), description: v.description ?? r.description, note: v.note ?? r.note }).where(eq(rewards.id, r.id));
    await tx.insert(rewardLedger).values({ kind: "claim", amountCents: r.amountCents, rewardId: r.id, month: localMonth(new Date(), s.timezone), note: v.note ?? "claimed" });
    // the reservation is consumed by the claim; balances count claims once (reserved rows are status-based)
    await audit(tx, "owner", "reward.claim", "reward", r.id, { description: v.description });
  });
}

export async function releaseReward(d: DB, rewardId: string, note = "released") {
  return d.transaction(async (tx) => {
    const [r] = await tx.select().from(rewards).where(eq(rewards.id, rewardId)).for("update");
    if (!r || r.status !== "reserved") throw new DomainError("not_reserved", "only a reserved reward can be released");
    const s = await settings(tx);
    await tx.update(rewards).set({ status: "pending_funding", reservedAt: null }).where(eq(rewards.id, r.id));
    await tx.insert(rewardLedger).values({ kind: "release", amountCents: r.amountCents, rewardId: r.id, month: localMonth(new Date(), s.timezone), note });
    await audit(tx, "owner", "reward.release", "reward", r.id);
  });
}

/**
 * Evaluate the milestone rules against one metric snapshot. Idempotent: a rule unlocks at most once per scope,
 * whatever number of snapshots, retries or cross-posts arrive. Returns the achievements created by this call.
 */
export async function evaluateSnapshot(d: DB, snapshotId: string) {
  const [snap] = await d.select().from(metricSnapshots).where(eq(metricSnapshots.id, snapshotId));
  if (!snap || snap.metric !== "views") return [];
  const isDemo = snap.source === "demo";
  if (!isDemo && !(QUALIFYING_SOURCES as readonly string[]).includes(snap.source)) return [];   // estimates never unlock
  const [pub] = await d.select().from(publications).where(eq(publications.id, snap.publicationId));
  if (pub.simulated && !isDemo) return [];
  const [ep] = await d.select().from(episodes).where(eq(episodes.id, pub.episodeId));
  if (ep.isDemo && !isDemo) return [];

  // a metric revised below an earlier unlock flags that unlock's evidence for review (never a second unlock)
  const [prev] = await d.select().from(metricSnapshots)
    .where(and(eq(metricSnapshots.publicationId, snap.publicationId), eq(metricSnapshots.metric, "views"), sql`${metricSnapshots.id} <> ${snap.id}`))
    .orderBy(desc(metricSnapshots.retrievedAt)).limit(1);
  if (prev && prev.value > snap.value) {
    await d.update(metricSnapshots).set({ status: "revised" }).where(eq(metricSnapshots.id, snap.id));
    await d.update(achievementEvents).set({ evidenceStatus: "flagged" }).where(eq(achievementEvents.publicationId, snap.publicationId));
  }

  const rules = await d.select().from(milestoneRules).where(and(eq(milestoneRules.enabled, true), eq(milestoneRules.kind, "single_post_views")));
  const created: (typeof achievementEvents.$inferSelect)[] = [];
  for (const rule of rules) {
    if (rule.threshold == null || snap.value < rule.threshold) continue;
    const scopeKey = rule.scope === "studio" ? "studio" : ep.channelId;
    const [ev] = await d.insert(achievementEvents).values({
      ruleId: rule.id, scopeKey, isDemo, channelId: ep.channelId, episodeId: ep.id, publicationId: pub.id, snapshotId: snap.id,
      evidence: { views: snap.value, source: snap.source, label: snap.source === "manual" ? "owner-confirmed" : snap.source, retrievedAt: snap.retrievedAt, postUrl: pub.postUrl },
    }).onConflictDoNothing().returning();
    if (!ev) continue;
    created.push(ev);
    await audit(d, "system", "achievement.unlock", "achievement", ev.id, { rule: rule.key, scopeKey, isDemo });
    if (rule.xp) await awardXp(d, { channelId: ep.channelId, kind: `achievement:${rule.key}`, amount: rule.xp, key: `achievement:${rule.key}:${scopeKey}:${isDemo ? "demo" : "live"}`, isDemo });
    if (rule.rewardCents && !isDemo) {
      const [r] = await d.insert(rewards).values({ achievementEventId: ev.id, amountCents: rule.rewardCents, status: "pending_funding" }).onConflictDoNothing().returning();
      if (r) await tryReserve(d, r.id);
    }
  }
  return created;
}

/** Record a metric (API, CSV, owner-entered or demo) and evaluate milestones. Unavailable metrics are never written as 0. */
export async function recordMetric(d: DB, v: { publicationId: string; metric: string; value: number; source: "api" | "csv" | "manual" | "estimate" | "demo"; unit?: string; definition?: string; ageHours?: number; periodStart?: Date; periodEnd?: Date }) {
  if (!Number.isFinite(v.value) || v.value < 0) throw new DomainError("bad_value", "enter a number ≥ 0");
  const [snap] = await d.insert(metricSnapshots).values({ ...v, unit: v.unit ?? "count", definition: v.definition ?? "" }).returning();
  const unlocked = await evaluateSnapshot(d, snap.id);
  return { snapshot: snap, unlocked };
}
