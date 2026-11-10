// Archived seasons (owner's request, 10 Nov 2026: "as soon as season 1 is uploaded and checked off for each channel,
// remove it"). A season is uploaded once every one of its real (non-demo) episodes stands on both Uploaded buttons
// ("Uploaded on YouTube & TikTok" and "Uploaded on Instagram", episodeUploaded in publications.ts, the buttons' own
// done state) and every built long video (lesson) of the season is marked uploaded too. An uploaded season is archived:
// it leaves every working view (Home, Upload, Review, Calendar, the channel's seasons and lessons, the Library's main
// list, /m pages, the long-video lists) for Library → Archived seasons, where every episode and long video still opens.
// It is derived, never stored: undoing an Uploaded button brings the season straight back. Nothing is deleted, and
// analytics, totals, earnings and rewards keep counting it. Every screen and job that lists working seasons' rows goes
// through this file (onWorkingSeason and friends), the way channels go through channels.ts.
import { asc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { destinations, episodes, lessonEpisodes, lessons, publications, seasons, series } from "../db/schema";
import type { Conn } from "./core";
import { onActiveChannel } from "./channels";
import { episodeUploaded } from "./publications";
import { seasonLabel } from "./season";

/** Episodes that never count toward a season (the same ones season progress leaves out). */
const OUT = ["cancelled", "superseded"];

type Pub = { platform: string; status: string; simulated: boolean; reportedAt?: Date | null };
type RuleEpisode = { isDemo: boolean; state: string; pubs: readonly Pub[] };
type RuleLesson = { isDemo: boolean; isTestFixture: boolean; state: string; videoPath: string };

/** A long video counts for its season once it is built (a real, built lesson: not demo, not a test fixture). */
export const lessonCounts = (l: RuleLesson): boolean => !l.isDemo && !l.isTestFixture && !!l.videoPath;
/** A long video's own uploaded state: its "Uploaded on YouTube" button (markLessonUploaded, no approval needed) sets it
 *  to published; Undo (undoLessonUploaded) puts it back. The button reads this too. */
export const lessonUploaded = (l: { state: string }): boolean => l.state === "published";

/** The rule. A season is uploaded when it has at least one real episode (cancelled and superseded ones aside), every
 *  one of them is uploaded on both buttons, and every built long video of the season is marked uploaded. A season with
 *  no real episodes is never uploaded. */
export function seasonUploaded(eps: readonly RuleEpisode[], longs: readonly RuleLesson[] = []): boolean {
  const real = eps.filter((e) => !e.isDemo && !OUT.includes(e.state));
  if (!real.length || !real.every((e) => episodeUploaded(e.pubs))) return false;
  return longs.filter(lessonCounts).every(lessonUploaded);
}

export type ArchivedEpisode = { id: string; number: number; title: string; seriesOrder: number | null; isDemo: boolean; videoClearedAt: Date | null };
export type ArchivedLesson = {
  id: string; channelId: string; name: string; title: string; videoPath: string; thumbnailPath: string; postUrl: string; reportedAt: Date | null; isDemo: boolean;
  state: string; isTestFixture: boolean;
};
/** One season of an active channel and where it stands: how many real episodes are uploaded on both buttons, and which
 *  built long videos still wait for "Mark uploaded". */
export type SeasonState = {
  id: string; seriesId: string; channelId: string; number: number; label: string; seriesTitle: string;
  archived: boolean; uploadedAt: Date | null;
  episodes: number; uploaded: number; longVideosLeft: { id: string; name: string; title: string }[];
};
export type ArchivedSeason = SeasonState & { episodeList: ArchivedEpisode[]; lessonList: ArchivedLesson[] };

export type SeasonArchive = {
  /** every season of the active channels, in series order */
  seasons: SeasonState[];
  /** the archived (uploaded) ones, with their episodes and long videos for Library → Archived seasons */
  archived: ArchivedSeason[];
  seasonIds: ReadonlySet<string>;
  /** series whose every season is archived (the screens list series as seasons) */
  seriesIds: ReadonlySet<string>;
  /** every episode of an archived season (demo and cancelled ones included: they go with their season) */
  episodeIds: ReadonlySet<string>;
  /** long videos whose every season is archived */
  lessonIds: ReadonlySet<string>;
};

export const EMPTY_ARCHIVE: SeasonArchive = { seasons: [], archived: [], seasonIds: new Set(), seriesIds: new Set(), episodeIds: new Set(), lessonIds: new Set() };

type SeasonRow = { id: string; seriesId: string; number: number; title: string; seriesTitle: string; channelId: string };
type EpisodeRow = ArchivedEpisode & { seasonId: string | null; state: string };
type PubRow = Pub & { episodeId: string };
type LessonRow = ArchivedLesson & { seriesId: string | null };

/** The archive from loaded rows (pure: seasonArchive loads them). A long video belongs to the seasons of the episodes
 *  it is linked to (lesson_episodes) and to its series' seasons. */
export function archiveFrom(rows: { seasons: SeasonRow[]; episodes: EpisodeRow[]; pubs: PubRow[]; links: { lessonId: string; episodeId: string }[]; lessons: LessonRow[] }): SeasonArchive {
  const seasonOfEpisode = new Map(rows.episodes.map((e) => [e.id, e.seasonId]));
  const lessonSeasons = new Map<string, Set<string>>();
  const add = (lessonId: string, seasonId: string | null | undefined) => {
    if (!seasonId) return;
    lessonSeasons.set(lessonId, (lessonSeasons.get(lessonId) ?? new Set()).add(seasonId));
  };
  for (const k of rows.links) add(k.lessonId, seasonOfEpisode.get(k.episodeId));
  for (const l of rows.lessons) for (const s of rows.seasons) if (l.seriesId && s.seriesId === l.seriesId) add(l.id, s.id);

  const states: (SeasonState & { eps: EpisodeRow[]; longs: LessonRow[] })[] = rows.seasons.map((s) => {
    const eps = rows.episodes.filter((e) => e.seasonId === s.id);
    const longs = rows.lessons.filter((l) => lessonSeasons.get(l.id)?.has(s.id));
    const ruleEps = eps.map((e) => ({ ...e, pubs: rows.pubs.filter((p) => p.episodeId === e.id) }));
    const real = ruleEps.filter((e) => !e.isDemo && !OUT.includes(e.state));
    const archived = seasonUploaded(ruleEps, longs);
    const times = [
      ...real.flatMap((e) => e.pubs.filter((p) => !p.simulated).map((p) => p.reportedAt ?? null)),
      ...longs.filter(lessonCounts).map((l) => l.reportedAt),
    ].filter((t): t is Date => !!t);
    return {
      id: s.id, seriesId: s.seriesId, channelId: s.channelId, number: s.number, label: s.title || seasonLabel(s.seriesTitle), seriesTitle: s.seriesTitle,
      archived, uploadedAt: archived && times.length ? new Date(Math.max(...times.map(Number))) : null,
      episodes: real.length, uploaded: real.filter((e) => episodeUploaded(e.pubs)).length,
      longVideosLeft: longs.filter((l) => lessonCounts(l) && !lessonUploaded(l)).map((l) => ({ id: l.id, name: l.name, title: l.title })),
      eps, longs,
    };
  });

  const seasonIds = new Set(states.filter((s) => s.archived).map((s) => s.id));
  const seriesIds = new Set([...new Set(rows.seasons.map((s) => s.seriesId))].filter((id) => rows.seasons.filter((s) => s.seriesId === id).every((s) => seasonIds.has(s.id))));
  const episodeIds = new Set(rows.episodes.filter((e) => e.seasonId && seasonIds.has(e.seasonId)).map((e) => e.id));
  const lessonIds = new Set(rows.lessons.filter((l) => { const s = lessonSeasons.get(l.id); return !!s?.size && [...s].every((id) => seasonIds.has(id)); }).map((l) => l.id));
  const strip = ({ eps: _e, longs: _l, ...s }: (typeof states)[number]): SeasonState => s;
  return {
    seasons: states.map(strip),
    archived: states.filter((s) => s.archived).map((s) => ({
      ...strip(s),
      episodeList: [...s.eps].sort((a, b) => (a.seriesOrder ?? a.number) - (b.seriesOrder ?? b.number))
        .map(({ id, number, title, seriesOrder, isDemo, videoClearedAt }) => ({ id, number, title, seriesOrder, isDemo, videoClearedAt })),
      lessonList: s.longs.filter((l) => lessonIds.has(l.id))
        .map(({ id, channelId, name, title, videoPath, thumbnailPath, postUrl, reportedAt, isDemo, state, isTestFixture }) =>
          ({ id, channelId, name, title, videoPath, thumbnailPath, postUrl, reportedAt, isDemo, state, isTestFixture })),
    })),
    seasonIds, seriesIds, episodeIds, lessonIds,
  };
}

/** Every season of the active channels, worked out from the publication records and long videos as they are now. */
export async function seasonArchive(c: Conn): Promise<SeasonArchive> {
  const ss = await c.select({ id: seasons.id, seriesId: seasons.seriesId, number: seasons.number, title: seasons.title, seriesTitle: series.title, channelId: series.channelId })
    .from(seasons).innerJoin(series, eq(series.id, seasons.seriesId)).where(onActiveChannel(series.channelId))
    .orderBy(asc(series.sort), asc(series.createdAt), asc(seasons.number));
  if (!ss.length) return EMPTY_ARCHIVE;
  const eps = await c.select({
    id: episodes.id, seasonId: episodes.seasonId, state: episodes.state, number: episodes.number, title: episodes.title, seriesOrder: episodes.seriesOrder,
    isDemo: episodes.isDemo, videoClearedAt: episodes.videoClearedAt,
  }).from(episodes).where(inArray(episodes.seasonId, ss.map((s) => s.id)));
  const epIds = eps.map((e) => e.id);
  const pubs = epIds.length ? await c.select({ episodeId: publications.episodeId, platform: destinations.platform, status: publications.status, simulated: publications.simulated, reportedAt: publications.reportedAt })
    .from(publications).innerJoin(destinations, eq(destinations.id, publications.destinationId)).where(inArray(publications.episodeId, epIds)) : [];
  const links = epIds.length ? await c.select({ lessonId: lessonEpisodes.lessonId, episodeId: lessonEpisodes.episodeId }).from(lessonEpisodes).where(inArray(lessonEpisodes.episodeId, epIds)) : [];
  const linked = [...new Set(links.map((k) => k.lessonId))];
  const ls = await c.select({
    id: lessons.id, channelId: lessons.channelId, seriesId: lessons.seriesId, name: lessons.name, title: lessons.title, state: lessons.state, videoPath: lessons.videoPath,
    thumbnailPath: lessons.thumbnailPath, postUrl: lessons.postUrl, reportedAt: lessons.reportedAt, isDemo: lessons.isDemo, isTestFixture: lessons.isTestFixture,
  }).from(lessons).where(or(inArray(lessons.seriesId, [...new Set(ss.map((s) => s.seriesId))]), linked.length ? inArray(lessons.id, linked) : undefined))
    .orderBy(asc(lessons.createdAt));
  return archiveFrom({ seasons: ss, episodes: eps, pubs, links, lessons: ls });
}

const ids = (set: ReadonlySet<string>) => [...set];

/** The where-clause for any row that belongs to an episode through its season (episodes.season_id): an archived
 *  season's rows are left out; an episode in no season stays. */
export const onWorkingSeason = (a: Pick<SeasonArchive, "seasonIds">, seasonId: AnyPgColumn | SQL): SQL =>
  a.seasonIds.size ? sql`(${seasonId} is null or ${seasonId} not in ${ids(a.seasonIds)})` : sql`true`;

/** The where-clause for long videos (lessons.id): one archived with its season is left out. */
export const lessonOnWorkingSeason = (a: Pick<SeasonArchive, "lessonIds">, lessonId: AnyPgColumn | SQL): SQL =>
  a.lessonIds.size ? sql`${lessonId} not in ${ids(a.lessonIds)}` : sql`true`;

/** The where-clause for series (series.id, the screens' "Season 1: …"): one whose seasons are all archived is left out. */
export const seriesOnWorkingSeason = (a: Pick<SeasonArchive, "seriesIds">, seriesId: AnyPgColumn | SQL): SQL =>
  a.seriesIds.size ? sql`${seriesId} not in ${ids(a.seriesIds)}` : sql`true`;

/** For rows already loaded: whether an episode (by its season) is in an archived season. */
export const inArchivedSeason = (a: Pick<SeasonArchive, "seasonIds">, e: { seasonId: string | null }): boolean => !!e.seasonId && a.seasonIds.has(e.seasonId);

/** The archived season an episode belongs to, or null (the episode page says so and links to the archive). */
export const archivedSeasonOf = (a: SeasonArchive, e: { seasonId: string | null }): ArchivedSeason | null =>
  (e.seasonId && a.archived.find((s) => s.id === e.seasonId)) || null;

/** Where a working season stands, for a channel's seasons ("6 of 6 uploaded · long video vol01 still to mark"). */
export const seasonStateOfSeries = (a: SeasonArchive, seriesId: string): SeasonState | null => a.seasons.find((s) => s.seriesId === seriesId) ?? null;

