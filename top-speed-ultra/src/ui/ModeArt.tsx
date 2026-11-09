// The mode cards' pictures, drawn in code (no photos): two night scenes, one per mode, of Orange County in the UI's own colours,
// 320 × 140, cropped to the card. Decoration beside the card's text, so hidden from screen readers.
import type { Mode } from '../game/settings';

// a freeway seen from low down: the road to the horizon, lane dashes running away
function Road({ id }: { id: string }) {
  return (
    <>
      <path d="M-40 140 L128 62 H192 L360 140 Z" fill={`url(#${id}-road)`} />
      <path d="M160 64 V140" stroke="var(--chrome)" strokeWidth="1.2" strokeDasharray="6 7" opacity="0.6" />
      <path d="M128 62 L-40 140 M192 62 L360 140" stroke="var(--line-3)" strokeWidth="1.4" />
    </>
  );
}
function Palm({ x, h, flip = false }: { x: number; h: number; flip?: boolean }) {
  const t = flip ? -1 : 1;
  return (
    <g stroke="var(--night)" fill="none" strokeLinecap="round">
      <path d={`M${x} 66 Q${x + 2 * t} ${66 - h * 0.55} ${x + 5 * t} ${66 - h}`} strokeWidth="2.2" />
      <path d={`M${x + 5 * t} ${66 - h} q-12 -6 -18 2 M${x + 5 * t} ${66 - h} q-9 -11 -4 -16 M${x + 5 * t} ${66 - h} q4 -13 10 -12 M${x + 5 * t} ${66 - h} q12 -5 17 3 M${x + 5 * t} ${66 - h} q10 2 14 10 M${x + 5 * t} ${66 - h} q-11 1 -14 9`} strokeWidth="1.8" />
    </g>
  );
}
const TOWERS: [number, number, number][] = [[190, 10, 22], [202, 8, 34], [212, 13, 52], [227, 9, 40], [238, 15, 72], [255, 10, 58], [267, 17, 90], [286, 9, 46], [297, 12, 66], [311, 8, 30]];

export function ModeArt({ kind }: { kind: Mode }) {
  const id = 'ma-' + kind;
  return (
    <svg className="mode-art" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--void)" /><stop offset="1" stopColor="var(--ice-deep)" stopOpacity="0.55" /></linearGradient>
        <linearGradient id={`${id}-road`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--night-3)" /><stop offset="1" stopColor="var(--night-1)" /></linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="1" r="0.8"><stop offset="0" stopColor="var(--ice)" stopOpacity="0.55" /><stop offset="1" stopColor="var(--ice)" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="320" height="140" fill={`url(#${id}-sky)`} />
      {kind === 'free' && <>
        <rect x="150" y="0" width="170" height="66" fill={`url(#${id}-glow)`} />
        <path d={TOWERS.map(([l, w, h]) => `M${l} 66v${-h}h${w}v${h}z`).join('')} fill="var(--night-1)" />
        {TOWERS.flatMap(([l, , h], k) => [0, 1, 2].map((r) => <rect key={k * 3 + r} x={l + 2 + (r % 2) * 3} y={66 - h + 6 + r * (h / 3.6)} width="2" height="2" fill="var(--cyan)" opacity={0.5 + ((k + r) % 3) * 0.2} />))}
        <Road id={id} />
        <Palm x={34} h={44} /><Palm x={70} h={58} flip /><Palm x={112} h={36} />
      </>}
      {kind === 'survival' && <>
        <rect x="60" y="20" width="200" height="50" fill={`url(#${id}-glow)`} />
        <Road id={id} />
        {[[118, 84, 10], [136, 104, 14], [196, 92, 12], [214, 118, 16]].map(([x, y, w], k) => (
          <g key={k}><rect x={x} y={y} width={w} height="3" rx="1.5" fill="var(--ember)" /><rect x={x - 2} y={y - 1} width={w + 4} height="5" rx="2.5" fill="var(--ember)" opacity="0.35" /></g>
        ))}
        <path d="M146 108 h28 M140 122 h40" stroke="var(--ice-hi)" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      </>}
    </svg>
  );
}
