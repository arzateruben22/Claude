// Season progress at a glance: "Season 1 · 4 of 6 ready" and one segment per episode (filled when ready, brighter when
// posted). A planned season (nothing imported) reads "Season 1 in production" over hollow segments: no numbers.
import type { SeasonProgress } from "@/domain/season";
import { seasonLine } from "@/domain/season";

export function SeasonBar({ season, className = "" }: { season: SeasonProgress; className?: string }) {
  return (
    <span className={`season ${className}`} data-planned={season.planned || undefined}>
      <span className="season-line">{seasonLine(season)}</span>
      {season.total ? (
        <span className="season-segs" aria-hidden>
          {Array.from({ length: season.total }, (_, i) => <i key={i} data-s={i < season.posted ? "posted" : i < season.ready ? "ready" : undefined} />)}
        </span>
      ) : null}
    </span>
  );
}
