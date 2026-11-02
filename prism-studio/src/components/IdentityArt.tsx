// The standby picture for a channel with its own identity, drawn in HTML and CSS (no image): what its monitor shows
// until a cover exists, and the small thumb in the monitor strip. Decorative only; the monitor's name and status say
// what it is. Outer Layer is a light slide (a cross-section of skin layers under UV); Back of the Envelope is graphite
// with a ballpoint envelope, a marker title and a tally.
import type { Identity } from "@/lib/identity";

export function IdentityArt({ id, small = false }: { id: Identity; small?: boolean }) {
  if (id === "outer-layer") return (
    <span className="art art-ol" aria-hidden>
      {small ? null : <span className="ol-tag">Skin, up close</span>}
      {small ? null : <span className="ol-word">Outer<br />Layer</span>}
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
      {small ? null : <span className="env-word">Back of the<br />Envelope</span>}
      {small ? null : <span className="env-tally"><i /><i /><i /><i /><b /></span>}
      {small ? null : <span className="env-approx">≈ ?</span>}
    </span>
  );
}
