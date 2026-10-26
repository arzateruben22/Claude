// Read models for the screens. Server-only: every function here runs in a server component or action.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db, type DB } from "@/db/client";
import * as S from "@/db/schema";
import { settings } from "@/domain/core";
import { channelEpisodes, demoFilter } from "@/domain/demo";
import { canUsePaidGeneration, costEntries, costTotals, monthsBack } from "@/domain/costs";
import { channelXp, requirementsFor } from "@/domain/living";
import { rewardBalances } from "@/domain/rewards";
import { pullStates } from "@/domain/api-analytics";
import { listDevices, pushStatus, recentPushEvents } from "@/domain/push";
import { currentApproval } from "@/domain/approvals";
import { CHANNELS, OFFICIAL, youtubeStudioFor } from "@/domain/catalog";
import { slotsForDate } from "@/domain/schedule";
import { addDays, formatLocal, localDate, localMonth, zonedTimeToUtc } from "@/domain/time";
import { INSTAGRAM_SLUG } from "@/lib/rig";
import { resolveMedia } from "@/lib/media";
import { STATE_LABEL } from "@/lib/format";

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

/** A channel's episodes; demo ones only when Settings → "Show demo data" is on (they stay labelled DEMO). */
export async function episodesFor(channelId: string, show?: boolean) {
  return channelEpisodes(db(), channelId, show);
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
  const s = await settings(d);
  const eps = await d.select().from(S.episodes).where(and(inArray(S.episodes.state, ["ready_for_review", "correction_needed"]), demoFilter(s.showDemo, S.episodes.isDemo))).orderBy(asc(S.episodes.updatedAt));
  return Promise.all(eps.map(async (e) => {
    const full = await episodeFull(e.id);
    return full!;
  }));
}

const OPEN_STATUSES = ["planned", "ready", "handed_off"] as const;

/** Publications with everything a task needs: the episode, account, export, live approval, render and channel. */
async function loadTasks(d: DB, where: SQL | undefined) {
  const rows = await d.select({ p: S.publications, e: S.episodes, dest: S.destinations, x: S.platformExports })
    .from(S.publications)
    .innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId))
    .innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId))
    .leftJoin(S.platformExports, eq(S.platformExports.id, S.publications.exportId))
    .where(where)
    .orderBy(asc(S.publications.scheduledFor), asc(S.episodes.number));
  const chans = await d.select().from(S.channels);
  const conns = await d.select({ destinationId: S.connections.destinationId, status: S.connections.status }).from(S.connections);
  const vers = rows.length ? await d.select().from(S.versions).where(inArray(S.versions.id, rows.flatMap((r) => (r.x ? [r.x.versionId] : [])).concat(["00000000-0000-0000-0000-000000000000"]))) : [];
  return Promise.all(rows.map(async (r) => {
    const approval = r.x ? await currentApproval(d, r.x.id, r.dest.id) : null;
    const version = r.x ? vers.find((v) => v.id === r.x!.versionId) ?? null : null;
    const channel = chans.find((c) => c.id === r.e.channelId)!;
    const connected = r.dest.publishMethod === "api" && conns.some((c) => c.destinationId === r.dest.id && c.status === "connected");
    return { ...r, approval, version, channel, connected };
  }));
}

/** Upload Desk: every publication that still needs the owner, grouped by when it's due. */
export async function uploadTasks() {
  const d = db();
  const s = await settings(d);
  const today = localDate(new Date(), s.timezone);
  const endOfToday = zonedTimeToUtc(addDays(today, 1), "00:00", s.timezone);
  const startOfToday = zonedTimeToUtc(today, "00:00", s.timezone);
  const tasks = await loadTasks(d, and(or(inArray(S.publications.status, [...OPEN_STATUSES]), and(inArray(S.publications.status, ["owner_reported", "scheduled_on_platform"]), gte(S.publications.reportedAt, startOfToday))), demoFilter(s.showDemo, S.episodes.isDemo)));
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
    .where(and(isNotNull(S.publications.scheduledFor), gte(S.publications.scheduledFor, start), lt(S.publications.scheduledFor, end), ne(S.publications.status, "cancelled"), demoFilter(s.showDemo, S.episodes.isDemo)))
    .orderBy(asc(S.publications.scheduledFor));
  const chans = await d.select().from(S.channels);
  // the backlog planning would fill: real episodes only (planning never places demo ones)
  const backlog = await d.select({ n: sql<number>`count(*)::int` }).from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId))
    .where(and(isNull(S.publications.scheduledFor), inArray(S.publications.status, ["planned", "ready"]), eq(S.episodes.isDemo, false)));
  const bl = await d.select().from(S.blackouts).where(gte(S.blackouts.endsAt, start)).orderBy(asc(S.blackouts.startsAt));
  return { tz: s.timezone, today, days: Array.from({ length: days }, (_, i) => addDays(today, i)), rows: rows.map((r) => ({ ...r, channel: chans.find((c) => c.id === r.e.channelId)! })), backlog: backlog[0]?.n ?? 0, blackouts: bl, settings: s };
}

export async function jobsList() {
  const s = await settings(db());
  return db().select().from(S.jobs).where(demoFilter(s.showDemo, S.jobs.isDemo)).orderBy(desc(S.jobs.createdAt)).limit(60);
}

const METRICS = ["views", "likes", "comments", "shares", "avg_view_duration_s", "watch_time_s", "followers_gained"] as const;
/** Posted publications (all, or one episode's) with each metric's latest value, recent history and API pull state. */
export async function analyticsRows(o: { episodeId?: string } = {}) {
  const d = db();
  const s = await settings(d);
  const rows = await d.select({ p: S.publications, e: S.episodes, dest: S.destinations })
    .from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId)).innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId))
    .where(and(or(inArray(S.publications.status, ["owner_reported", "scheduled_on_platform", "verified_published"]), eq(S.publications.simulated, true)), demoFilter(s.showDemo, S.episodes.isDemo),
      o.episodeId ? eq(S.publications.episodeId, o.episodeId) : undefined))
    .orderBy(desc(S.publications.reportedAt));
  const ids = rows.map((r) => r.p.id);
  const snaps = ids.length ? await d.select().from(S.metricSnapshots).where(inArray(S.metricSnapshots.publicationId, ids)).orderBy(desc(S.metricSnapshots.retrievedAt)) : [];
  const pulls = await pullStates(d, ids);
  const chans = await d.select().from(S.channels);
  return rows.map((r) => ({
    ...r, channel: chans.find((c) => c.id === r.e.channelId)!,
    latest: Object.fromEntries(METRICS.map((m) => [m, snaps.find((s) => s.publicationId === r.p.id && s.metric === m) ?? null])) as Record<(typeof METRICS)[number], typeof S.metricSnapshots.$inferSelect | null>,
    history: snaps.filter((s) => s.publicationId === r.p.id).slice(0, 10),
    pull: pulls.get(r.p.id) ?? null,
  }));
}
export type AnalyticsRow = Awaited<ReturnType<typeof analyticsRows>>[number];

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

/** The Costs screen: this month's spent vs budget for the studio and each channel (with the paid-generation gate),
 *  the last six months for the studio or one channel, and the cost entries. */
export async function costsView(channelSlug?: string) {
  const d = db();
  const s = await settings(d);
  const now = new Date();
  const month = localMonth(now, s.timezone), months = monthsBack(month, 6);
  const chans = await d.select().from(S.channels).orderBy(asc(S.channels.sort));
  const focus = channelSlug ? chans.find((c) => c.slug === channelSlug) ?? null : null;
  const totals = await costTotals(d, months);
  const scopes = await Promise.all(chans.map(async (c) => ({ channel: c, sum: totals.scope(c.id, month), gate: await canUsePaidGeneration(d, c.id, 1, now) })));
  const entries = await costEntries(d, { channelId: focus?.id, limit: 80 });
  const eps = await d.select({ id: S.episodes.id, number: S.episodes.number, title: S.episodes.title, channelId: S.episodes.channelId }).from(S.episodes)
    .where(eq(S.episodes.isDemo, false)).orderBy(asc(S.episodes.number));
  return {
    tz: s.timezone, month, today: localDate(now, s.timezone), channels: chans, focus,
    studio: totals.scope(null, month), scopes,
    history: [...months].reverse().map((m) => totals.scope(focus?.id ?? null, m)),
    entries, episodes: eps, paidSwitch: s.paidGenerationEnabled, stopExternal: s.stopExternalActions,
  };
}
export type CostsView = Awaited<ReturnType<typeof costsView>>;

/** Settings → Notifications: whether push can work here, each device (no endpoint, no keys) and the latest events,
 *  with times already in the studio timezone. */
export async function notificationsView() {
  const d = db();
  const [s, status, devices, recent] = await Promise.all([settings(d), pushStatus(d), listDevices(d), recentPushEvents(d, 5)]);
  const at = (t: Date | null) => (t ? formatLocal(t, s.timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  return {
    status,
    devices: devices.map((x) => ({
      id: x.id, label: x.label, service: x.service, hash: x.endpointHash, added: formatLocal(x.createdAt, s.timezone, { month: "short", day: "numeric", year: "numeric" }),
      lastSuccess: at(x.lastSuccessAt), lastFailure: at(x.lastFailureAt), failures: x.failureCount, lastError: x.lastError,
    })),
    recent: recent.map((e) => ({ ...e, at: at(e.createdAt) })),
  };
}
export type NotificationsView = Awaited<ReturnType<typeof notificationsView>>;

export async function onboardingView() {
  const d = db();
  return d.select().from(S.onboarding);
}


// ── the monitor wall ("/") and each monitor's extension ("/m/[slug]") ─────────────────────────────────────────

export type Task = Awaited<ReturnType<typeof loadTasks>>[number];
/** One post for one account: a planned publication, or (Instagram only) the next episode in rotation, not planned yet. */
export type PostItem = Omit<Task, "p"> & { p: Task["p"] | null };
export type Led = "ready" | "review" | "off";
export type CoverTone = "light" | "dark";
/** One Instagram slot. "missed": its time passed with nothing planned (no rotation episode is spent on it). */
export type IgSlot = { at: Date; item: PostItem | null; state: "posted" | "ready" | "needs_approval" | "unplanned" | "missed" | "empty"; tone?: CoverTone };
export type MonitorCard = {
  slug: string; kind: "channel" | "instagram"; href: string; name: string; label: string; color: string; colorInk: string;
  cover: string | null; coverTone?: CoverTone; status: string; led: Led; ledLabel: string; slots?: IgSlot[];
};

const POSTED = ["owner_reported", "scheduled_on_platform", "verified_published"];
const plainName = (name: string) => name.replace(/ \(name TBD\)$/, "");
const PLATFORM_NAME = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" } as const;
const INSTAGRAM_LOOK = { color: "#C9CED6", colorInk: "#E4E7EC", label: "INSTAGRAM" };   // neutral pale silver, not a channel colour

/** The account's official upload page: the saved link, a Studio link built from a verified YouTube id, or the generic one. */
export function uploadUrlFor(dest: Destination) {
  return dest.uploadUrl || (dest.platform === "youtube" && dest.platformAccountId ? youtubeStudioFor(dest.platformAccountId) : OFFICIAL[dest.platform].upload);
}

/** The picture for a post: the export's own cover when one is set, else the render's poster frame. */
export const coverOf = (t: Pick<PostItem, "x" | "version">) => t.x?.coverPath || t.version?.posterPath || null;

const mediaFile = (key: string) => { const abs = resolveMedia(key); return abs && fs.existsSync(abs) ? abs : null; };

/** The 480-px copy of a designed cover (scripts/covers.ts writes <name>-cover-480.jpg) for small pictures: the monitor
 *  strip, queue rows, Instagram tiles. Falls back to the full cover when the small one is missing or older. */
export function smallCover(key: string | null): string | null {
  if (!key || !/-cover\.jpg$/.test(key)) return key;
  const small = key.replace(/-cover\.jpg$/, "-cover-480.jpg"), a = mediaFile(small), b = mediaFile(key);
  return a && b && fs.statSync(a).mtimeMs >= fs.statSync(b).mtimeMs ? small : key;
}

/** The 16:9 YouTube thumbnail drawn with a post's designed cover (<name>-thumb.jpg), when it exists. */
export function thumbOf(t: Pick<PostItem, "x" | "version">): string | null {
  const cover = coverOf(t);
  if (!cover || !/-cover\.jpg$/.test(cover)) return null;
  const thumb = cover.replace(/-cover\.jpg$/, "-thumb.jpg");
  return mediaFile(thumb) ? thumb : null;
}

/** Whether a channel's covers are drawn on light paper (its theme.json tokens.bg luminance above 0.5): the wall dims those
 *  so a beige cover never outshines the night. Read once per channel. */
const tones = new Map<string, CoverTone>();
export function coverTone(slug: string): CoverTone {
  if (tones.has(slug)) return tones.get(slug)!;
  let tone: CoverTone = "dark";
  const dir = CHANNELS.find((c) => c.slug === slug)?.filmsPath;
  try {
    if (dir) {
      const theme = JSON.parse(fs.readFileSync(path.join(path.resolve(/* turbopackIgnore: true */ process.env.FILMS_REPO_ROOT || ".."), dir, "theme.json"), "utf8")) as { tokens?: { bg?: string } };
      const hex = (theme.tokens?.bg ?? "").replace("#", "");
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        const lin = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        if (0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4) > 0.5) tone = "light";
      }
    }
  } catch { /* no theme: treat as dark */ }
  tones.set(slug, tone);
  return tone;
}

/** A ready post has a live approval of the current render's exact export. */
export const isReady = (t: Pick<PostItem, "approval" | "x" | "version">) => !!t.approval && !!t.x && !t.version?.superseded;

/** The current render's export for one platform, per episode (non-demo). */
async function currentExports(d: DB, platform: "youtube" | "tiktok" | "instagram", channelIds?: string[]) {
  return d.select({ e: S.episodes, x: S.platformExports, version: S.versions }).from(S.platformExports)
    .innerJoin(S.versions, eq(S.versions.id, S.platformExports.versionId)).innerJoin(S.episodes, eq(S.episodes.id, S.versions.episodeId))
    .where(and(eq(S.platformExports.platform, platform), eq(S.versions.superseded, false), eq(S.episodes.isDemo, false),
      channelIds ? inArray(S.episodes.channelId, channelIds.length ? channelIds : ["00000000-0000-0000-0000-000000000000"]) : undefined))
    .orderBy(asc(S.episodes.number));
}

/**
 * The shared Instagram's next episodes, in the order planning would take them: the channel after the last one placed
 * on Instagram, then round the channels, oldest unplaced episode first. Display only: this mirrors planDays
 * (src/domain/schedule.ts), which is what actually places posts and never puts an episode on Instagram twice.
 */
async function instagramRotation(d: DB, ig: Destination, limit: number): Promise<PostItem[]> {
  const chans = await d.select().from(S.channels).where(eq(S.channels.paused, false)).orderBy(asc(S.channels.sort));
  const [last] = await d.select({ channelId: S.episodes.channelId }).from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId))
    .where(and(eq(S.publications.destinationId, ig.id), ne(S.publications.status, "cancelled"))).orderBy(desc(S.publications.scheduledFor)).limit(1);
  const placed = new Set((await d.select({ id: S.publications.episodeId }).from(S.publications).where(eq(S.publications.destinationId, ig.id))).map((r) => r.id));
  const rows = (await currentExports(d, "instagram")).filter((r) => !placed.has(r.e.id));
  const queues = new Map(chans.map((c) => [c.id, rows.filter((r) => r.e.channelId === c.id)]));
  const out: PostItem[] = [];
  let k = last ? chans.findIndex((c) => c.id === last.channelId) + 1 : 0;
  while (out.length < limit && [...queues.values()].some((q) => q.length)) {
    const ch = chans[((k % chans.length) + chans.length) % chans.length];
    const r = queues.get(ch.id)!.shift();
    if (r) out.push({ p: null, e: r.e, dest: ig, x: r.x, version: r.version, channel: ch, connected: false, approval: await currentApproval(d, r.x.id, ig.id) });
    k++;
  }
  return out;
}

/**
 * The Instagram slots that matter now (2 a day by default, studio_settings.instagram_daily), each with its post or the
 * next in rotation. A slot whose time has passed with nothing planned is "missed" and spends no rotation episode. Once
 * every slot today is over (nothing still open on it), tomorrow's slots are shown instead (day: "tomorrow").
 */
async function instagramToday(d: DB, ig: Destination | undefined, tz: string, today: string, now = new Date()) {
  if (!ig) return { slots: [] as IgSlot[], rotation: [] as PostItem[], day: "today" as "today" | "tomorrow" };
  const dayOf = async (date: string) => {
    const start = zonedTimeToUtc(date, "00:00", tz), end = zonedTimeToUtc(addDays(date, 1), "00:00", tz);
    const times = (await slotsForDate(d, date)).filter((s) => s.kind === "instagram").map((s) => s.at);
    const tasks = await loadTasks(d, and(eq(S.publications.destinationId, ig.id), ne(S.publications.status, "cancelled"), gte(S.publications.scheduledFor, start), lt(S.publications.scheduledFor, end)));
    const at = [...new Set([...times, ...tasks.map((t) => t.p.scheduledFor!)].map((x) => +x))].sort((a, b) => a - b).map((x) => new Date(x));
    return { at, tasks, find: (when: Date) => tasks.find((x) => +x.p.scheduledFor! === +when) };
  };
  let day: "today" | "tomorrow" = "today";
  let cur = await dayOf(today);
  const stillOpen = (when: Date) => { const t = cur.find(when); return t ? !POSTED.includes(t.p.status) : when >= now; };
  if (cur.at.length && !cur.at.some(stillOpen)) { cur = await dayOf(addDays(today, 1)); day = "tomorrow"; }
  const rotation = await instagramRotation(d, ig, Math.max(4, cur.at.length));
  let next = 0;
  const slots: IgSlot[] = cur.at.map((when): IgSlot => {
    const t = cur.find(when);
    if (t) return { at: when, item: t, tone: coverTone(t.channel.slug), state: POSTED.includes(t.p.status) ? "posted" : isReady(t) ? "ready" : "needs_approval" };
    if (when < now) return { at: when, item: null, state: "missed" };
    const cand = rotation[next++] ?? null;
    return { at: when, item: cand, tone: cand ? coverTone(cand.channel.slug) : undefined, state: cand ? "unplanned" : "empty" };
  });
  return { slots, rotation, day };
}

/** The six monitors: each one's cover, one status line and its status light. */
export async function rigView() {
  const d = db();
  const s = await settings(d);
  const tz = s.timezone, today = localDate(new Date(), tz);
  const endOfToday = zonedTimeToUtc(addDays(today, 1), "00:00", tz);
  const chans = await d.select().from(S.channels).orderBy(asc(S.channels.sort));
  const [ig] = await d.select().from(S.destinations).where(and(eq(S.destinations.platform, "instagram"), eq(S.destinations.shared, true)));
  const tasks = (await loadTasks(d, inArray(S.publications.status, [...OPEN_STATUSES]))).filter((t) => !t.e.isDemo && !t.p.simulated);
  const eps = await d.select({ id: S.episodes.id, channelId: S.episodes.channelId, state: S.episodes.state, number: S.episodes.number }).from(S.episodes).where(eq(S.episodes.isDemo, false));
  const renders = [...await currentExports(d, "youtube"), ...await currentExports(d, "tiktok")];
  const when = (at: Date) => formatLocal(at, tz, at < endOfToday ? { hour: "numeric", minute: "2-digit" } : { weekday: "short", hour: "numeric", minute: "2-digit" });

  const monitors: MonitorCard[] = chans.map((c) => {
    const mine = tasks.filter((t) => t.channel.id === c.id && !t.dest.shared);
    const scheduled = mine.filter((t) => t.p.scheduledFor);
    const dueToday = scheduled.filter((t) => t.p.scheduledFor! < endOfToday);
    const chEps = eps.filter((e) => e.channelId === c.id);
    const toReview = chEps.filter((e) => ["ready_for_review", "correction_needed"].includes(e.state));
    const next = scheduled[0] ?? null;
    const reviewRender = renders.find((r) => toReview.some((e) => e.id === r.e.id));
    const anyRender = renders.find((r) => r.e.channelId === c.id);
    const cover = (next ? coverOf(next) : null) ?? (mine[0] ? coverOf(mine[0]) : null) ?? (reviewRender ? coverOf(reviewRender) : null) ?? (anyRender ? coverOf(anyRender) : null);
    // in production = past the idea stage; ideas are counted separately ("1 in script · 5 ideas")
    const inWork = chEps.filter((e) => e.state !== "idea"), ideas = chEps.length - inWork.length;
    const production = [
      inWork.length === 1 ? `1 in ${(STATE_LABEL[inWork[0].state] ?? inWork[0].state).toLowerCase()}` : inWork.length ? `${inWork.length} in production` : "",
      ideas ? `${ideas} idea${ideas === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(" · ");
    const status = next ? `Next: ${next.e.title} · ${PLATFORM_NAME[next.dest.platform]} ${when(next.p.scheduledFor!)}`
      : toReview.length ? `${toReview.length} ready to review`
      : mine.length ? `${mine.length} to schedule`
      : production || "No episodes yet";
    const led: Led = dueToday.some(isReady) ? "ready" : toReview.length || dueToday.length ? "review" : "off";
    return {
      slug: c.slug, kind: "channel", href: `/m/${c.slug}`, name: plainName(c.name), label: c.label, color: c.color, colorInk: c.colorInk, cover, coverTone: cover ? coverTone(c.slug) : undefined, status, led,
      ledLabel: led === "ready" ? "ready to post today" : led === "review" ? "needs review" : "nothing queued today",
    };
  });

  const { slots, day } = await instagramToday(d, ig, tz, today);
  const posted = slots.filter((x) => x.state === "posted").length, ready = slots.filter((x) => x.state === "ready").length;
  const waiting = slots.filter((x) => x.state === "needs_approval").length, unplanned = slots.filter((x) => x.state === "unplanned").length;
  const igStatus = !ig ? "Instagram isn't set up" : s.globalPause ? "Publishing is paused" : !slots.length ? "No Instagram slots today"
    : posted === slots.length ? `${day === "today" ? "Today" : "Tomorrow"}'s ${slots.length} posted`
    : ready ? `${ready} ready to post ${day}${posted ? ` · ${posted} posted` : ""}`
    : waiting ? `${waiting} need${waiting === 1 ? "s" : ""} approval`
    : unplanned ? `Plan ${day}'s ${unplanned === 1 ? "post" : `${unplanned} posts`}` : "Nothing in rotation yet";
  const igLed: Led = ready ? "ready" : waiting ? "review" : "off";
  monitors.push({
    slug: INSTAGRAM_SLUG, kind: "instagram", href: `/m/${INSTAGRAM_SLUG}`, name: "Instagram", ...INSTAGRAM_LOOK,
    cover: slots.map((x) => (x.item ? coverOf(x.item) : null)).find(Boolean) ?? null, status: igStatus, led: igLed,
    ledLabel: igLed === "ready" ? "ready to post today" : igLed === "review" ? "needs approval" : "nothing queued today", slots,
  });
  const reviewCount = eps.filter((e) => e.state === "ready_for_review").length;
  const unseenEvolutions = (await d.select({ channelId: S.evolutions.channelId }).from(S.evolutions).where(and(isNotNull(S.evolutions.evolvedAt), isNull(S.evolutions.seenAt))))
    .map((x) => chans.find((c) => c.id === x.channelId)).filter((c): c is Channel => !!c);
  const unseenAchievements = await d.select({ title: S.milestoneRules.title, demo: S.achievementEvents.isDemo }).from(S.achievementEvents)
    .innerJoin(S.milestoneRules, eq(S.milestoneRules.id, S.achievementEvents.ruleId)).where(isNull(S.achievementEvents.seenAt));
  return {
    tz, today, monitors, reviewCount, unseenEvolutions, unseenAchievements, dueToday: tasks.filter((t) => t.p.scheduledFor && t.p.scheduledFor < endOfToday).length,
    instagram: { toPlan: s.globalPause ? 0 : unplanned, day }, paused: s.globalPause, stopExternal: s.stopExternalActions,
  };
}
export type RigView = Awaited<ReturnType<typeof rigView>>;

/** A channel's extension: its accounts' next posts, its queue, its series. */
export async function channelExtension(slug: string) {
  const d = db();
  const s = await settings(d);
  const c = await channelBySlug(slug);
  if (!c) return null;
  const dests = (await d.select().from(S.destinations).where(eq(S.destinations.channelId, c.id)))
    .sort((a, b) => ["youtube", "tiktok"].indexOf(a.platform) - ["youtube", "tiktok"].indexOf(b.platform));
  const [ig] = await d.select().from(S.destinations).where(and(eq(S.destinations.platform, "instagram"), eq(S.destinations.shared, true)));
  const tasks = (await loadTasks(d, and(inArray(S.publications.status, [...OPEN_STATUSES]), eq(S.episodes.channelId, c.id), demoFilter(s.showDemo, S.episodes.isDemo)))).filter((t) => !t.p.simulated);
  const accounts = dests.map((dest) => ({ dest, uploadUrl: uploadUrlFor(dest), next: (tasks.find((t) => t.dest.id === dest.id) ?? null) as PostItem | null }));
  const eps = await episodesFor(c.id, s.showDemo);
  const ser = await d.select().from(S.series).where(and(eq(S.series.channelId, c.id), demoFilter(s.showDemo, S.series.isDemo))).orderBy(asc(S.series.sort));
  const series = ser.map((x) => ({ series: x, episodes: eps.filter((e) => e.seriesId === x.id).sort((a, b) => (a.seriesOrder ?? a.number) - (b.seriesOrder ?? b.number)) }));
  const loose = eps.filter((e) => !e.seriesId || !ser.some((x) => x.id === e.seriesId));
  return {
    tz: s.timezone, stopExternal: s.stopExternalActions, paused: s.globalPause || c.paused, channel: c, accounts,
    upcoming: tasks.filter((t) => !accounts.some((a) => a.next?.p?.id === t.p.id)).slice(0, 16), igAccount: ig ?? null,
    series, loose, reviewCount: eps.filter((e) => !e.isDemo && ["ready_for_review", "correction_needed"].includes(e.state)).length,
  };
}

/** The shared Instagram's extension: today's slots, the rotation across series, and the never-repeats ledger. */
export async function instagramExtension() {
  const d = db();
  const s = await settings(d);
  const tz = s.timezone, today = localDate(new Date(), tz);
  const [ig] = await d.select().from(S.destinations).where(and(eq(S.destinations.platform, "instagram"), eq(S.destinations.shared, true)));
  const chans = await d.select().from(S.channels).orderBy(asc(S.channels.sort));
  const { slots, rotation, day } = await instagramToday(d, ig, tz, today);
  const upcoming = ig ? (await loadTasks(d, and(eq(S.publications.destinationId, ig.id), inArray(S.publications.status, [...OPEN_STATUSES]), gte(S.publications.scheduledFor, zonedTimeToUtc(addDays(today, 1), "00:00", tz))))).slice(0, 14) : [];
  const pubs = ig ? await d.select({ episodeId: S.publications.episodeId, status: S.publications.status }).from(S.publications).where(eq(S.publications.destinationId, ig.id)) : [];
  const exportsIg = await currentExports(d, "instagram");
  const eps = await d.select({ id: S.episodes.id, channelId: S.episodes.channelId }).from(S.episodes).where(eq(S.episodes.isDemo, false));
  const ledger = chans.map((c) => {
    const ready = exportsIg.filter((r) => r.e.channelId === c.id);
    const statusOf = (id: string) => pubs.filter((p) => p.episodeId === id).map((p) => p.status);
    const posted = ready.filter((r) => statusOf(r.e.id).some((st) => POSTED.includes(st))).length;
    const planned = ready.filter((r) => !statusOf(r.e.id).some((st) => POSTED.includes(st)) && statusOf(r.e.id).some((st) => (OPEN_STATUSES as readonly string[]).includes(st))).length;
    const never = ready.filter((r) => !statusOf(r.e.id).length).length;
    return { channel: c, name: plainName(c.name), episodes: eps.filter((e) => e.channelId === c.id).length, ready: ready.length, posted, planned, never };
  });
  const sum = (k: "ready" | "posted" | "planned" | "never" | "episodes") => ledger.reduce((a, r) => a + r[k], 0);
  return {
    tz, today, ig: ig ?? null, uploadUrl: ig ? uploadUrlFor(ig) : OFFICIAL.instagram.upload, daily: s.instagramDaily, paused: s.globalPause, stopExternal: s.stopExternalActions,
    slots, day, rotation: rotation.filter((r) => !slots.some((x) => x.item?.e.id === r.e.id)), upcoming, ledger,
    totals: { episodes: sum("episodes"), ready: sum("ready"), posted: sum("posted"), planned: sum("planned"), never: sum("never") },
  };
}
