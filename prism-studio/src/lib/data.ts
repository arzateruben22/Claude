// Read models for the screens. Server-only: every function here runs in a server component or action.
import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { settings } from "@/domain/core";
import { channelXp, requirementsFor } from "@/domain/living";
import { rewardBalances } from "@/domain/rewards";
import { currentApproval } from "@/domain/approvals";
import { addDays, localDate, zonedTimeToUtc } from "@/domain/time";

export type Channel = typeof S.channels.$inferSelect;
export type Destination = typeof S.destinations.$inferSelect;

export async function studio() {
  return settings(db());
}

export async function channelsWithWorlds() {
  const d = db();
  const chans = await d.select().from(S.channels).orderBy(asc(S.channels.sort));
  const crs = await d.select().from(S.creations);
  const counts = await d.select({ channelId: S.episodes.channelId, state: S.episodes.state, n: sql<number>`count(*)::int` })
    .from(S.episodes).where(eq(S.episodes.isDemo, false)).groupBy(S.episodes.channelId, S.episodes.state);
  const pending = await d.select().from(S.evolutions).where(isNull(S.evolutions.evolvedAt));
  return Promise.all(chans.map(async (c) => {
    const cr = crs.find((x) => x.channelId === c.id)!;
    const byState = Object.fromEntries(counts.filter((x) => x.channelId === c.id).map((x) => [x.state, x.n])) as Record<string, number>;
    return { ...c, creation: cr, xp: await channelXp(d, c.id), byState, canEvolve: pending.some((e) => e.channelId === c.id) };
  }));
}

export async function channelBySlug(slug: string) {
  const [c] = await db().select().from(S.channels).where(eq(S.channels.slug, slug));
  return c ?? null;
}

export async function destinationsAll() {
  const d = db();
  const dests = await d.select().from(S.destinations);
  const chans = await d.select().from(S.channels).orderBy(asc(S.channels.sort));
  const order = (x: Destination) => (x.channelId ? chans.findIndex((c) => c.id === x.channelId) : 99) * 10 + ["youtube", "tiktok", "instagram"].indexOf(x.platform);
  return dests.sort((a, b) => order(a) - order(b)).map((x) => ({ ...x, channel: chans.find((c) => c.id === x.channelId) ?? null }));
}

export async function episodesFor(channelId: string) {
  return db().select().from(S.episodes).where(eq(S.episodes.channelId, channelId)).orderBy(asc(S.episodes.number));
}

export async function episodeFull(id: string) {
  const d = db();
  const [ep] = await d.select().from(S.episodes).where(eq(S.episodes.id, id));
  if (!ep) return null;
  const [channel] = await d.select().from(S.channels).where(eq(S.channels.id, ep.channelId));
  const vers = await d.select().from(S.versions).where(eq(S.versions.episodeId, id)).orderBy(desc(S.versions.versionNo));
  const current = vers.find((v) => !v.superseded) ?? null;
  const exports = current ? await d.select().from(S.platformExports).where(eq(S.platformExports.versionId, current.id)) : [];
  const dests = await d.select().from(S.destinations).where(or(eq(S.destinations.channelId, ep.channelId), eq(S.destinations.shared, true)));
  const pubs = await d.select().from(S.publications).where(eq(S.publications.episodeId, id));
  const approvalsAll = await d.select().from(S.approvals).where(eq(S.approvals.episodeId, id)).orderBy(desc(S.approvals.approvedAt));
  const placements = await Promise.all(dests.sort((a, b) => ["youtube", "tiktok", "instagram"].indexOf(a.platform) - ["youtube", "tiktok", "instagram"].indexOf(b.platform)).map(async (dest) => {
    const x = exports.find((e) => e.platform === dest.platform) ?? null;
    const live = x ? await currentApproval(d, x.id, dest.id) : null;
    const lastRevoked = approvalsAll.find((a) => a.destinationId === dest.id && a.revokedAt) ?? null;
    return { dest, export: x, approval: live, lastRevoked, publication: pubs.find((p) => p.destinationId === dest.id) ?? null };
  }));
  const srcs = await d.select().from(S.sources).where(eq(S.sources.episodeId, id)).orderBy(asc(S.sources.claimKey));
  const notes = await d.select().from(S.reviewNotes).where(eq(S.reviewNotes.episodeId, id)).orderBy(desc(S.reviewNotes.createdAt));
  const [se] = ep.seriesId ? await d.select().from(S.series).where(eq(S.series.id, ep.seriesId)) : [];
  return { ep, channel, versions: vers, current, exports, placements, sources: srcs, notes, series: se ?? null };
}

export async function reviewQueue() {
  const d = db();
  const eps = await d.select().from(S.episodes).where(inArray(S.episodes.state, ["ready_for_review", "correction_needed"])).orderBy(asc(S.episodes.updatedAt));
  return Promise.all(eps.map(async (e) => {
    const full = await episodeFull(e.id);
    return full!;
  }));
}

/** Upload Desk: every publication that still needs the owner, grouped by when it's due. */
export async function uploadTasks() {
  const d = db();
  const s = await settings(d);
  const today = localDate(new Date(), s.timezone);
  const endOfToday = zonedTimeToUtc(addDays(today, 1), "00:00", s.timezone);
  const startOfToday = zonedTimeToUtc(today, "00:00", s.timezone);
  const rows = await d.select({ p: S.publications, e: S.episodes, dest: S.destinations, x: S.platformExports })
    .from(S.publications)
    .innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId))
    .innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId))
    .leftJoin(S.platformExports, eq(S.platformExports.id, S.publications.exportId))
    .where(or(inArray(S.publications.status, ["planned", "ready", "handed_off"]), and(inArray(S.publications.status, ["owner_reported", "scheduled_on_platform"]), gte(S.publications.reportedAt, startOfToday))))
    .orderBy(asc(S.publications.scheduledFor), asc(S.episodes.number));
  const chans = await d.select().from(S.channels);
  const vers = rows.length ? await d.select().from(S.versions).where(inArray(S.versions.id, rows.flatMap((r) => (r.x ? [r.x.versionId] : [])).concat(["00000000-0000-0000-0000-000000000000"]))) : [];
  const tasks = await Promise.all(rows.map(async (r) => {
    const approval = r.x ? await currentApproval(d, r.x.id, r.dest.id) : null;
    const version = r.x ? vers.find((v) => v.id === r.x!.versionId) ?? null : null;
    const channel = chans.find((c) => c.id === r.e.channelId)!;
    return { ...r, approval, version, channel };
  }));
  const done = tasks.filter((t) => ["owner_reported", "scheduled_on_platform"].includes(t.p.status));
  const open = tasks.filter((t) => !done.includes(t));
  return {
    tz: s.timezone, today,
    due: open.filter((t) => t.p.scheduledFor && t.p.scheduledFor < endOfToday),
    later: open.filter((t) => t.p.scheduledFor && t.p.scheduledFor >= endOfToday).slice(0, 12),
    backlog: open.filter((t) => !t.p.scheduledFor),
    done,
    stopExternal: s.stopExternalActions, paused: s.globalPause,
  };
}
export type UploadTask = Awaited<ReturnType<typeof uploadTasks>>["due"][number];

export async function calendar(days = 7) {
  const d = db();
  const s = await settings(d);
  const today = localDate(new Date(), s.timezone);
  const start = zonedTimeToUtc(today, "00:00", s.timezone), end = zonedTimeToUtc(addDays(today, days), "00:00", s.timezone);
  const rows = await d.select({ p: S.publications, e: S.episodes, dest: S.destinations })
    .from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId)).innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId))
    .where(and(isNotNull(S.publications.scheduledFor), gte(S.publications.scheduledFor, start), lt(S.publications.scheduledFor, end), ne(S.publications.status, "cancelled")))
    .orderBy(asc(S.publications.scheduledFor));
  const chans = await d.select().from(S.channels);
  const backlog = await d.select({ n: sql<number>`count(*)::int` }).from(S.publications).where(and(isNull(S.publications.scheduledFor), inArray(S.publications.status, ["planned", "ready"])));
  const bl = await d.select().from(S.blackouts).where(gte(S.blackouts.endsAt, start)).orderBy(asc(S.blackouts.startsAt));
  return { tz: s.timezone, today, days: Array.from({ length: days }, (_, i) => addDays(today, i)), rows: rows.map((r) => ({ ...r, channel: chans.find((c) => c.id === r.e.channelId)! })), backlog: backlog[0]?.n ?? 0, blackouts: bl, settings: s };
}

export async function jobsList() {
  return db().select().from(S.jobs).orderBy(desc(S.jobs.createdAt)).limit(60);
}

export async function analyticsRows() {
  const d = db();
  const rows = await d.select({ p: S.publications, e: S.episodes, dest: S.destinations })
    .from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId)).innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId))
    .where(or(inArray(S.publications.status, ["owner_reported", "scheduled_on_platform", "verified_published"]), eq(S.publications.simulated, true)))
    .orderBy(desc(S.publications.reportedAt));
  const snaps = rows.length ? await d.select().from(S.metricSnapshots).where(inArray(S.metricSnapshots.publicationId, rows.map((r) => r.p.id))).orderBy(desc(S.metricSnapshots.retrievedAt)) : [];
  const chans = await d.select().from(S.channels);
  return rows.map((r) => ({
    ...r, channel: chans.find((c) => c.id === r.e.channelId)!,
    latest: Object.fromEntries(["views", "avg_view_duration_s", "likes", "shares", "followers_gained"].map((m) => [m, snaps.find((s) => s.publicationId === r.p.id && s.metric === m) ?? null])),
    history: snaps.filter((s) => s.publicationId === r.p.id).slice(0, 8),
  }));
}

export async function rewardsView() {
  const d = db();
  const balances = await rewardBalances(d);
  const rules = await d.select().from(S.milestoneRules).where(ne(S.milestoneRules.kind, "evolution_threshold")).orderBy(asc(S.milestoneRules.sort));
  const events = await d.select().from(S.achievementEvents).orderBy(desc(S.achievementEvents.achievedAt));
  const rws = await d.select().from(S.rewards).orderBy(desc(S.rewards.createdAt));
  const ledger = await d.select().from(S.rewardLedger).orderBy(desc(S.rewardLedger.createdAt)).limit(30);
  const best = await d.execute(sql`
    select coalesce(max(m.value), 0) as v from metric_snapshots m join publications p on p.id = m.publication_id join episodes e on e.id = p.episode_id
     where m.metric = 'views' and m.source in ('api','csv','manual') and not p.simulated and not e.is_demo and m.status <> 'revised'`);
  return { balances, rules, events, rewards: rws, ledger, bestViews: Number((best.rows[0] as { v: number }).v) };
}

export async function worldView(channelId: string) {
  const d = db();
  const [cr] = await d.select().from(S.creations).where(eq(S.creations.channelId, channelId));
  const evs = await d.select().from(S.evolutions).where(eq(S.evolutions.channelId, channelId)).orderBy(asc(S.evolutions.toForm));
  const chs = await d.select().from(S.challenges).where(eq(S.challenges.channelId, channelId));
  const next = cr.form < 5 ? cr.form + 1 : null;
  const reqs = next ? await requirementsFor(d, channelId, next) : [];
  const ascendReqs = cr.ascended ? [] : await requirementsFor(d, channelId, 6);
  return { creation: cr, evolutions: evs, challenges: chs, next, reqs, ascendReqs, xp: await channelXp(d, channelId) };
}

export async function onboardingView() {
  const d = db();
  return d.select().from(S.onboarding);
}

export async function homeView() {
  const d = db();
  const [worlds, tasks, review, rv, unseenEv, onb] = await Promise.all([
    channelsWithWorlds(), uploadTasks(),
    d.select({ n: sql<number>`count(*)::int` }).from(S.episodes).where(eq(S.episodes.state, "ready_for_review")),
    rewardsView(),
    d.select().from(S.evolutions).where(and(isNotNull(S.evolutions.evolvedAt), isNull(S.evolutions.seenAt))),
    d.select().from(S.onboarding),
  ]);
  const unseenAch = await d.select({ ev: S.achievementEvents, rule: S.milestoneRules }).from(S.achievementEvents)
    .innerJoin(S.milestoneRules, eq(S.milestoneRules.id, S.achievementEvents.ruleId)).where(isNull(S.achievementEvents.seenAt));
  return { worlds, tasks, reviewCount: review[0]?.n ?? 0, rewards: rv, unseenEvolutions: unseenEv, unseenAchievements: unseenAch, onboarding: { done: onb.filter((o) => o.done).length, total: onb.length } };
}
