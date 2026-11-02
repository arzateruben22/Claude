// Season progress for a monitor: how much of the current season is ready, from the episodes in the database. A channel
// with no season imported yet shows its planned titles and "in production", never a number it doesn't have.
import { PIPELINE, type EpisodeState } from "./episodes";

export type SeasonProgress = {
  label: string;           // "Season 1"
  total: number;           // episodes in the season (cancelled and superseded ones don't count)
  ready: number;           // rendered and through QA: ready for review or any later step
  posted: number;          // published (or later)
  planned: boolean;        // nothing imported yet: titles come from the plan, every count is 0
  titles: string[];        // in season order
};

const READY_FROM = PIPELINE.indexOf("ready_for_review");
const POSTED_FROM = PIPELINE.indexOf("published");
const OUT: EpisodeState[] = ["cancelled", "superseded"];

/** "Season 1" from a series title such as "Season 1: Forces you can see" (or the whole title when it has no colon). */
export const seasonLabel = (seriesTitle: string) => seriesTitle.split(":")[0].trim() || seriesTitle.trim();

export function seasonProgress(seriesTitle: string, episodes: { state: string; title: string; seriesOrder: number | null; number: number }[]): SeasonProgress {
  const live = episodes.filter((e) => !OUT.includes(e.state as EpisodeState)).sort((a, b) => (a.seriesOrder ?? a.number) - (b.seriesOrder ?? b.number));
  const step = (e: { state: string }) => PIPELINE.indexOf(e.state as (typeof PIPELINE)[number]);   // -1 for side states (blocked, failed, correction_needed)
  return {
    label: seasonLabel(seriesTitle), total: live.length, planned: false, titles: live.map((e) => e.title),
    ready: live.filter((e) => step(e) >= READY_FROM).length,
    posted: live.filter((e) => step(e) >= POSTED_FROM).length,
  };
}

export function plannedSeason(plan: { label: string; titles: string[] }): SeasonProgress {
  return { label: plan.label, total: plan.titles.length, ready: 0, posted: 0, planned: true, titles: [...plan.titles] };
}

/** One line for the monitor: "Season 1 · 4 of 6 ready", "Season 1 · 6 of 6 ready · 2 posted", "Season 1 in production". */
export function seasonLine(p: SeasonProgress): string {
  if (p.planned || !p.total) return `${p.label} in production`;
  return `${p.label} · ${p.ready} of ${p.total} ready${p.posted ? ` · ${p.posted} posted` : ""}`;
}
