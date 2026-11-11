// Published (owner's request, 11 Nov 2026: "when videos are published on all 3 platforms they get sent to another tab …
// do it after 24 hours of me clicking uploaded or when all 3 have been completed"). A channel's Published tab lists what
// is done; its Episodes tab keeps the rest (ready for review, in progress, partly uploaded for under 24 hours).
// Derived at read time from the report times the Uploaded buttons write (publications.reported_at, lessons.reported_at),
// never stored and never run by a job: an Undo clears the report time, so the episode is straight back in Episodes.
//  - An episode is done once YouTube, TikTok and Instagram each have a real (not simulated) publication marked uploaded
//    (owner_reported, scheduled_on_platform or verified_published), or 24 hours after the first of its marks.
//  - A long video is YouTube only (its "Uploaded on YouTube" button): it stays on Home's Long videos card, Undo and all,
//    for 24 hours after the press, then it is done and shows in its channel's Published tab.
// Archived seasons (season-archive.ts) are untouched: an uploaded season still leaves every working view, this tab too,
// for Library → Archived seasons.
//
// Season numbers ("S3 · E1" ahead of "No. 013", "S3" for a long video) come from the same data: an episode's season row
// (episodes.season_id → seasons.number, written by the importer from its season slates), else its series' season.
import { eq, inArray } from "drizzle-orm";
import { destinations, episodes, lessonEpisodes, publications, seasons, series } from "../db/schema";
import type { Conn } from "./core";
import { REPORTED } from "./publications";
import { lessonUploaded } from "./season-archive";

/** How long after the first "Uploaded" press an episode (or a long video) moves to Published by itself. */
export const PUBLISHED_AFTER_HOURS = 24;
export const PUBLISHED_AFTER_MS = PUBLISHED_AFTER_HOURS * 60 * 60 * 1000;

/** The three platforms an episode goes to, in the order the screens show them. */
export const SHORT_PLATFORMS = ["youtube", "tiktok", "instagram"] as const;
export type ShortPlatform = (typeof SHORT_PLATFORMS)[number];

export type PubForPublished = { platform: string; status: string; simulated?: boolean; reportedAt?: Date | null; verifiedAt?: Date | null };

const posted = (p: PubForPublished) => !p.simulated && (REPORTED as readonly string[]).includes(p.status);
/** When a posted row was marked: the owner's report time (an integration's verification writes it too). */
const markedAt = (p: PubForPublished) => p.reportedAt ?? p.verifiedAt ?? null;
const earliest = (ts: readonly (Date | null)[]) => ts.filter((t): t is Date => !!t).sort((a, b) => +a - +b)[0] ?? null;

export type PublishedState = {
  done: boolean;
  /** why it is done: every platform marked, or 24 hours since the first mark */
  why: "all_three" | "day_passed" | null;
  /** the first time any platform was marked uploaded (null: none yet) */
  firstAt: Date | null;
  /** each platform, marked or not, with the time it was marked */
  platforms: { platform: ShortPlatform; uploaded: boolean; at: Date | null }[];
};

/** The rule for one episode, from its publication rows (with their destination's platform). A posted row with no time
 *  recorded counts toward "all three" but never starts the 24-hour clock (never guess a time). */
export function episodePublishedState(pubs: readonly PubForPublished[], now: Date = new Date()): PublishedState {
  const platforms = SHORT_PLATFORMS.map((platform) => {
    const rows = pubs.filter((p) => p.platform === platform && posted(p));
    return { platform, uploaded: rows.length > 0, at: earliest(rows.map(markedAt)) };
  });
  const firstAt = earliest(platforms.map((p) => p.at));
  const allThree = platforms.every((p) => p.uploaded);
  const dayPassed = !!firstAt && now.getTime() - firstAt.getTime() >= PUBLISHED_AFTER_MS;
  return { done: allThree || dayPassed, why: allThree ? "all_three" : dayPassed ? "day_passed" : null, firstAt, platforms };
}

export const episodePublished = (pubs: readonly PubForPublished[], now: Date = new Date()): boolean => episodePublishedState(pubs, now).done;

/** These episodes' publication rows with their destination's platform, for episodePublishedState. */
export async function publishedPubs(c: Conn, episodeIds: readonly string[]) {
  if (!episodeIds.length) return [];
  return c.select({
    episodeId: publications.episodeId, platform: destinations.platform, status: publications.status, simulated: publications.simulated,
    reportedAt: publications.reportedAt, verifiedAt: publications.verifiedAt,
  }).from(publications).innerJoin(destinations, eq(destinations.id, publications.destinationId)).where(inArray(publications.episodeId, [...episodeIds]));
}

/** A long video's rule: uploaded (its button pressed) and 24 hours since the press. One marked before report times were
 *  recorded has been up for longer than that, so it counts as done too. */
export function lessonPublishedState(l: { state: string; reportedAt: Date | null }, now: Date = new Date()): { uploaded: boolean; done: boolean; at: Date | null } {
  const uploaded = lessonUploaded(l), at = uploaded ? l.reportedAt : null;
  return { uploaded, at, done: uploaded && (!at || now.getTime() - at.getTime() >= PUBLISHED_AFTER_MS) };
}

export const lessonPublished = (l: { state: string; reportedAt: Date | null }, now: Date = new Date()): boolean => lessonPublishedState(l, now).done;

// ── season numbers ───────────────────────────────────────────────────────────────────────────────────────────────

/** "Season 2" in a series title such as "Season 2: Everyday surprises" (null when it names none). */
export const seasonFromTitle = (seriesTitle: string | null | undefined): number | null => {
  const m = /^\s*season\s+(\d+)\b/i.exec(seriesTitle ?? "");
  return m ? Number(m[1]) : null;
};

/** Season numbers by season row and by series, from loaded rows (seasonIndexFrom; loadSeasonIndex loads them). */
export type SeasonIndex = { bySeason: ReadonlyMap<string, number>; bySeries: ReadonlyMap<string, readonly number[]> };
export type SeasonIndexRow = { seriesId: string; seriesTitle: string; seasonId: string | null; number: number | null };

export function seasonIndexFrom(rows: readonly SeasonIndexRow[]): SeasonIndex {
  const bySeason = new Map<string, number>(), bySeries = new Map<string, number[]>();
  const add = (seriesId: string, n: number) => { const l = bySeries.get(seriesId) ?? []; if (!l.includes(n)) l.push(n); bySeries.set(seriesId, l); };
  for (const r of rows) {
    if (r.seasonId && r.number) { bySeason.set(r.seasonId, r.number); add(r.seriesId, r.number); continue; }
    const n = seasonFromTitle(r.seriesTitle);
    if (n) add(r.seriesId, n);
  }
  return { bySeason, bySeries };
}

/** The one season number in a list, or null when there is none or more than one. */
export function oneSeason(numbers: readonly (number | null | undefined)[]): number | null {
  const set = new Set(numbers.filter((n): n is number => !!n));
  return set.size === 1 ? [...set][0] : null;
}

/** An episode's season: its season row, else its series' one season. Null when it is in no season. */
export const episodeSeason = (e: { seasonId: string | null; seriesId: string | null }, idx: SeasonIndex): number | null =>
  (e.seasonId ? idx.bySeason.get(e.seasonId) : undefined) ?? (e.seriesId ? oneSeason(idx.bySeries.get(e.seriesId) ?? []) : null);

/** "S3 · E1": the season and the episode's place in it (its series order), shown ahead of "No. 013". Null without a season. */
export function seasonTag(season: number | null | undefined, order: number | null | undefined): string | null {
  if (!season) return null;
  return order ? `S${season} · E${order}` : `S${season}`;
}

/** A long video's season: the one season of the episodes it is built from and of its series. Null when the data does not
 *  say, or names more than one. */
export const lessonSeason = (l: { seriesId: string | null }, parts: readonly { seasonId: string | null; seriesId: string | null }[], idx: SeasonIndex): number | null =>
  oneSeason([...parts.map((p) => episodeSeason(p, idx)), ...(l.seriesId ? idx.bySeries.get(l.seriesId) ?? [] : [])]);

/** A long video's small label: "S3" when its season is known, else "Vol 1" for a vol01 folder, else the folder name. */
export function longVideoLabel(name: string, season: number | null | undefined): string {
  if (season) return `S${season}`;
  const vol = /^vol0*(\d+)$/i.exec(name.trim());
  return vol ? `Vol ${Number(vol[1])}` : name;
}

/** Every season and series of these channels, as a SeasonIndex. */
export async function loadSeasonIndex(c: Conn, channelIds: readonly string[]): Promise<SeasonIndex> {
  if (!channelIds.length) return seasonIndexFrom([]);
  const rows = await c.select({ seriesId: series.id, seriesTitle: series.title, seasonId: seasons.id, number: seasons.number })
    .from(series).leftJoin(seasons, eq(seasons.seriesId, series.id)).where(inArray(series.channelId, [...channelIds]));
  return seasonIndexFrom(rows);
}

/** Each long video's season number (null when unknown), from the episodes it is built from and its series. */
export async function lessonSeasons(c: Conn, ls: readonly { id: string; seriesId: string | null }[], idx: SeasonIndex): Promise<Map<string, number | null>> {
  const parts = ls.length ? await c.select({ lessonId: lessonEpisodes.lessonId, seasonId: episodes.seasonId, seriesId: episodes.seriesId })
    .from(lessonEpisodes).innerJoin(episodes, eq(episodes.id, lessonEpisodes.episodeId)).where(inArray(lessonEpisodes.lessonId, ls.map((l) => l.id))) : [];
  return new Map(ls.map((l) => [l.id, lessonSeason(l, parts.filter((p) => p.lessonId === l.id), idx)]));
}
