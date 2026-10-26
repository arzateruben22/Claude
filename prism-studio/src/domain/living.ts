// The Living Studio: channel XP and levels, challenges, and evolution of each channel's creation.
// XP, evolution forms and money rewards are separate systems. Evolution needs real, reviewed work (and later real
// audience milestones); the owner presses "Evolve" when ready, and the reveal is stored so it never replays.
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { achievementEvents, challenges, creations, episodes, evolutions, lessons, metricSnapshots, milestoneRules, publications, series, sources, xpEvents } from "../db/schema";
import { audit, type Conn, DomainError } from "./core";

// ── XP ─────────────────────────────────────────────────────────────────────
/** Award XP once per idempotency key (retries, re-renders, cross-posts and re-imports can't double it). */
export async function awardXp(c: Conn, v: { channelId: string; kind: string; amount: number; key: string; isDemo?: boolean }) {
  const [row] = await c.insert(xpEvents).values({ channelId: v.channelId, kind: v.kind, amount: v.amount, idempotencyKey: v.key, isDemo: v.isDemo ?? false })
    .onConflictDoNothing().returning();
  return row ?? null;
}
export const levelFor = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
export const xpForLevel = (level: number) => 50 * (level - 1) ** 2;

export async function channelXp(c: Conn, channelId: string) {
  const r = await c.execute(sql`select coalesce(sum(amount), 0)::int as xp from xp_events where channel_id = ${channelId} and not is_demo`);
  const xp = Number((r.rows[0] as { xp: number }).xp), level = levelFor(xp);
  return { xp, level, levelStart: xpForLevel(level), next: xpForLevel(level + 1) };
}

// ── progress facts used by challenges and evolution ────────────────────────
const PUBLISHED = ["owner_reported", "scheduled_on_platform", "verified_published"] as const;

export async function publishedEpisodes(c: Conn, channelId: string) {
  const rows = await c.selectDistinct({ id: episodes.id, seriesId: episodes.seriesId }).from(episodes)
    .innerJoin(publications, eq(publications.episodeId, episodes.id))
    .where(and(eq(episodes.channelId, channelId), eq(episodes.isDemo, false), eq(publications.simulated, false), inArray(publications.status, [...PUBLISHED])));
  return rows;
}

async function bestPostViews(c: Conn, channelId: string) {
  const r = await c.execute(sql`
    select coalesce(max(m.value), 0) as v from metric_snapshots m
      join publications p on p.id = m.publication_id
      join episodes e on e.id = p.episode_id
     where e.channel_id = ${channelId} and m.metric = 'views' and m.source in ('api','csv','manual')
       and not e.is_demo and not p.simulated and m.status <> 'revised'`);
  return Number((r.rows[0] as { v: number }).v);
}

async function completedSeriesWithLesson(c: Conn, channelId: string, bundle: number) {
  const pubs = await publishedEpisodes(c, channelId);
  const bySeries = new Map<string, number>();
  for (const p of pubs) if (p.seriesId) bySeries.set(p.seriesId, (bySeries.get(p.seriesId) ?? 0) + 1);
  const full = [...bySeries.entries()].filter(([, n]) => n >= bundle).map(([s]) => s);
  if (!full.length) return { series: null as string | null, lesson: false };
  const ls = await c.select().from(lessons).where(and(eq(lessons.channelId, channelId), inArray(lessons.seriesId, full), eq(lessons.state, "published"), eq(lessons.isDemo, false), eq(lessons.isTestFixture, false)));
  return { series: full[0], lesson: ls.length > 0 };
}

async function threshold(c: Conn, key: string, fallback: number) {
  const [r] = await c.select().from(milestoneRules).where(eq(milestoneRules.key, key));
  return r?.threshold ?? fallback;
}

// ── challenges ─────────────────────────────────────────────────────────────
/** Automatic checks a challenge can carry; anything else is owner-confirmed with an evidence note. */
export async function autoCheck(c: Conn, channelId: string, check: string): Promise<{ met: boolean; detail: string } | null> {
  if (check === "published_sourced_episode") {
    const pubs = await publishedEpisodes(c, channelId);
    for (const p of pubs) {
      const srcs = await c.select().from(sources).where(eq(sources.episodeId, p.id));
      if (srcs.length && srcs.every((s) => s.status === "ok")) return { met: true, detail: `episode ${p.id.slice(0, 8)} published with ${srcs.length} checked sources` };
    }
    return { met: false, detail: "publish an episode whose every claim has a checked source" };
  }
  if (check === "series_and_lesson") {
    const r = await completedSeriesWithLesson(c, channelId, 6);
    return { met: !!r.series && r.lesson, detail: r.series ? (r.lesson ? "series and lesson complete" : "series complete; lesson not yet published") : "complete a six-episode series" };
  }
  return null;
}

export async function completeChallenge(d: DB, challengeId: string, evidence: { note: string; by: "owner" | "auto" }) {
  const [ch] = await d.select().from(challenges).where(eq(challenges.id, challengeId));
  if (!ch) throw new DomainError("not_found", "challenge not found");
  if (ch.status === "completed") return ch;
  const auto = await autoCheck(d, ch.channelId, ch.requirement.check);
  if (auto && !auto.met) throw new DomainError("not_met", `Not yet: ${auto.detail}.`);
  if (!auto && !evidence.note.trim()) throw new DomainError("evidence", "add a short evidence note (what was done, where)");
  const [row] = await d.update(challenges).set({
    status: "completed", completedAt: new Date(),
    evidence: { note: evidence.note, by: auto ? "auto" : "owner-confirmed", detail: auto?.detail },
  }).where(eq(challenges.id, challengeId)).returning();
  await awardXp(d, { channelId: ch.channelId, kind: "challenge", amount: ch.tier === "optional" ? 40 : 120, key: `challenge:${ch.id}` });
  await audit(d, "owner", "challenge.complete", "challenge", ch.id, { by: auto ? "auto" : "owner" });
  await refreshEvolution(d, ch.channelId);
  return row;
}

// ── evolution ─────────────────────────────────────────────────────────────
export type Requirement = { label: string; met: boolean; detail: string; action?: string };

/** What the next form needs, with live progress. Form 6 means the Ascended appearance (first million-view post). */
export async function requirementsFor(c: Conn, channelId: string, toForm: number): Promise<Requirement[]> {
  const chs = await c.select().from(challenges).where(eq(challenges.channelId, channelId));
  const tierDone = (tier: string) => chs.find((x) => x.tier === tier)?.status === "completed";
  const tierTitle = (tier: string) => chs.find((x) => x.tier === tier)?.title ?? tier;
  if (toForm === 2) {
    const pubs = await publishedEpisodes(c, channelId);
    return [
      { label: "An original episode approved and published", met: pubs.length > 0, detail: pubs.length ? `${pubs.length} published` : "none published yet", action: "Publish one from the Upload Desk and mark it uploaded" },
      { label: `Challenge: ${tierTitle("intro")}`, met: tierDone("intro"), detail: tierDone("intro") ? "complete" : "open", action: "Open the challenge card" },
    ];
  }
  if (toForm === 3) {
    const r = await completedSeriesWithLesson(c, channelId, 6);
    return [
      { label: "A six-episode series published", met: !!r.series, detail: r.series ? "complete" : "in progress", action: "Finish the current series" },
      { label: "Its expanded lesson published", met: r.lesson, detail: r.lesson ? "published" : "not yet", action: "Build the lesson from the series" },
      { label: `Challenge: ${tierTitle("series")}`, met: tierDone("series"), detail: tierDone("series") ? "complete" : "open" },
    ];
  }
  if (toForm === 4 || toForm === 5 || toForm === 6) {
    const need = toForm === 4 ? await threshold(c, "form4_views", 10_000) : toForm === 5 ? await threshold(c, "form5_views", 100_000) : await threshold(c, "channel_1m", 1_000_000);
    const best = await bestPostViews(c, channelId);
    const reqs: Requirement[] = [{ label: `One post reaches ${need.toLocaleString("en-US")} views`, met: best >= need, detail: `best so far ${best.toLocaleString("en-US")} (platform-reported, one post)`, action: "Log views in Analytics" }];
    if (toForm !== 6) {
      const tier = toForm === 4 ? "advanced" : "masterwork";
      reqs.push({ label: `Challenge: ${tierTitle(tier)}`, met: tierDone(tier), detail: tierDone(tier) ? "complete" : "open" });
    }
    return reqs;
  }
  return [];
}

/** Record every form the channel now qualifies for (once each). Never evolves by itself. */
export async function refreshEvolution(d: DB, channelId: string) {
  const [cr] = await d.select().from(creations).where(eq(creations.channelId, channelId));
  if (!cr) return [];
  const newly: number[] = [];
  for (let to = cr.form + 1; to <= 5; to++) {
    const reqs = await requirementsFor(d, channelId, to);
    if (!reqs.length || !reqs.every((r) => r.met)) break;   // forms are earned in order
    const [row] = await d.insert(evolutions).values({ channelId, toForm: to, evidence: { requirements: reqs } }).onConflictDoNothing().returning();
    if (row) newly.push(to);
  }
  if (!cr.ascended) {
    const reqs = await requirementsFor(d, channelId, 6);
    if (reqs.every((r) => r.met)) {
      const [row] = await d.insert(evolutions).values({ channelId, toForm: 6, evidence: { requirements: reqs } }).onConflictDoNothing().returning();
      if (row) newly.push(6);
    }
  }
  return newly;
}

/** The owner presses Evolve. Applies the next eligible form (or the Ascended appearance) exactly once. */
export async function evolve(d: DB, channelId: string, opts: { branch?: "a" | "b"; ascend?: boolean } = {}) {
  return d.transaction(async (tx) => {
    const [cr] = await tx.select().from(creations).where(eq(creations.channelId, channelId)).for("update");
    if (!cr) throw new DomainError("not_found", "no creation for this channel");
    const toForm = opts.ascend ? 6 : cr.form + 1;
    const [ev] = await tx.select().from(evolutions).where(and(eq(evolutions.channelId, channelId), eq(evolutions.toForm, toForm), isNull(evolutions.evolvedAt)));
    if (!ev) throw new DomainError("not_eligible", "this evolution has not been earned yet");
    // re-check at the moment of evolving: requirements can be lost (e.g. a revised metric)
    const reqs = await requirementsFor(tx, channelId, toForm);
    if (!reqs.every((r) => r.met)) throw new DomainError("not_eligible", "a requirement is no longer met");
    if (toForm === 3 && !opts.branch && !cr.branch) throw new DomainError("branch", "choose a cosmetic branch for form 3");
    const patch = toForm === 6 ? { ascended: true } : { form: toForm, branch: toForm >= 3 ? (cr.branch ?? opts.branch ?? "a") : cr.branch };
    await tx.update(creations).set({ ...patch, updatedAt: new Date() }).where(eq(creations.channelId, channelId));
    await tx.update(evolutions).set({ evolvedAt: new Date() }).where(eq(evolutions.id, ev.id));
    await awardXp(tx, { channelId, kind: "evolution", amount: 200, key: `evolve:${channelId}:${toForm}` });
    await audit(tx, "owner", "creation.evolve", "creation", channelId, { toForm, branch: opts.branch });
    return { toForm, from: cr.form };
  });
}

export async function markEvolutionSeen(d: DB, evolutionId: string) {
  await d.update(evolutions).set({ seenAt: new Date() }).where(and(eq(evolutions.id, evolutionId), isNull(evolutions.seenAt)));
}

export async function chooseCosmetic(d: DB, channelId: string, cosmetics: Record<string, unknown>) {
  await d.update(creations).set({ cosmetics, updatedAt: new Date() }).where(eq(creations.channelId, channelId));
  await audit(d, "owner", "creation.cosmetics", "creation", channelId, cosmetics);
}

export async function unseenAchievements(c: Conn) {
  return c.select().from(achievementEvents).where(isNull(achievementEvents.seenAt));
}
export { series, metricSnapshots };

/** After the owner reports (or an integration verifies) a publication: XP once per episode, the studio's
 *  "first published" achievement once, then a fresh look at evolution eligibility. */
export async function onPublicationReported(d: DB, publicationId: string) {
  const [p] = await d.select().from(publications).where(eq(publications.id, publicationId));
  if (!p || p.simulated || !(PUBLISHED as readonly string[]).includes(p.status)) return;
  const [e] = await d.select().from(episodes).where(eq(episodes.id, p.episodeId));
  if (!e || e.isDemo) return;
  await awardXp(d, { channelId: e.channelId, kind: "publish", amount: 60, key: `publish:${e.id}` });     // once per episode, not per cross-post
  await awardXp(d, { channelId: e.channelId, kind: "placement", amount: 10, key: `placement:${p.id}` });
  const [rule] = await d.select().from(milestoneRules).where(eq(milestoneRules.key, "first_published"));
  if (rule?.enabled) {
    const [ev] = await d.insert(achievementEvents).values({ ruleId: rule.id, scopeKey: "studio", channelId: e.channelId, episodeId: e.id, publicationId: p.id, evidence: { status: p.status, postUrl: p.postUrl, label: p.evidence } })
      .onConflictDoNothing().returning();
    if (ev && rule.xp) await awardXp(d, { channelId: e.channelId, kind: "achievement:first_published", amount: rule.xp, key: "achievement:first_published:studio:live" });
  }
  if (e.state !== "published" && e.state !== "analytics") await d.update(episodes).set({ state: "published", updatedAt: new Date() }).where(eq(episodes.id, e.id));
  await refreshEvolution(d, e.channelId);
}
