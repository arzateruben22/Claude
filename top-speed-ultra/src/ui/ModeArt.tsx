// The mode cards' pictures, drawn in code (no photos): four night scenes of Orange County in the UI's own colours,
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
      {kind === 'race' && <>
        <Road id={id} />
        <rect x="104" y="52" width="112" height="7" fill="var(--sign-green)" /><path d="M106 59v30M214 59v30" stroke="var(--chrome-lo)" strokeWidth="3" />
        {[0, 1, 2, 3, 4, 5, 6].map((c) => [0, 1].map((r) => <rect key={c * 2 + r} x={108 + c * 15} y={60 + r * 5} width="15" height="5" fill={(c + r) % 2 ? 'var(--ink)' : 'var(--night)'} />))}
        <rect x="128" y="106" width="22" height="9" rx="3" fill="var(--ice)" /><rect x="170" y="98" width="18" height="7" rx="3" fill="var(--ember)" />
      </>}
      {kind === 'time' && <>
        <Road id={id} />
        <circle cx="160" cy="70" r="40" fill="var(--glass-2)" stroke="var(--chrome)" strokeWidth="2.5" />
        {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <path key={i} d={`M${160 + Math.sin(a) * 33} ${70 - Math.cos(a) * 33}L${160 + Math.sin(a) * 36} ${70 - Math.cos(a) * 36}`} stroke="var(--dim)" strokeWidth="2" />; })}
        <path d="M160 70 V38 A32 32 0 0 1 187.7 54" fill="none" stroke="var(--ice)" strokeWidth="5" strokeLinecap="round" />
        <path d="M160 70 L160 44" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" /><circle cx="160" cy="70" r="3" fill="var(--ink)" />
        <rect x="154" y="24" width="12" height="6" rx="2" fill="var(--chrome)" />
      </>}
    </svg>
  );
}
