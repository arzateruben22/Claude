// The standby picture for a channel with its own identity, drawn in HTML and CSS (no image): what its monitor shows
// until a cover exists, the small thumb in the monitor strip, and the motif in its screen's header. Decorative only
// (the monitor's chin carries the name and the season line). Outer Layer is a light slide: the season's titles over a
// cross-section of skin under UV. Back of the Envelope is graphite: the titles over a ballpoint envelope, with "≈ ?".
import type { SeasonProgress } from "@/domain/season";
import type { Identity } from "@/lib/identity";

export function IdentityArt({ id, small = false, season }: { id: Identity; small?: boolean; season?: SeasonProgress | null }) {
  const list = !small && season?.titles.length ? (
    <ol className="art-titles">{season.titles.map((t, i) => <li key={i}>{t}</li>)}</ol>
  ) : null;
  if (id === "outer-layer") return (
    <span className="art art-ol" aria-hidden>
      {list ? <span className="art-tag">{season!.label}</span> : null}
      {list}
      <span className="ol-uv"><i /><i /><i /></span>
      <span className="ol-layers"><i /><i /><i /><i /></span>
    </span>
  );
  return (
    <span className="art art-env" aria-hidden>
      <svg className="env-svg" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet">
        <path d="M8 14 L152 10 L154 90 L6 92 Z" />
        <path d="M8 15 L80 58 L152 11" />
      </svg>
      {list ? <span className="art-tag">{season!.label}</span> : null}
      {list}
      {small ? null : <span className="env-approx">≈ ?</span>}
    </span>
  );
}
