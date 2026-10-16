// The OC sunset wordmark (owner, 2026-10-16): the letters "OC" cut like a racing decal and filled with an Orange
// County sunset. Three cut-outs (src/ui/assets, transparent WebP) and the letterform alpha (oc-mask.png, used as a
// CSS mask). The single-file build inlines them (scripts/single-file.mjs). The skyline in the mark is stylised, not
// any real building, and nothing in it is a brand. Never stretch it: every use keeps the 1200 × 429 aspect.
import logo1200 from './assets/oc-logo-1200.webp';
import logo480 from './assets/oc-logo-480.webp';
import logo240 from './assets/oc-logo-240.webp';

const CUTS = {
  lg: { src: logo1200, w: 1200, h: 429 },     // the menu and loading brand block
  md: { src: logo480, w: 480, h: 171 },       // panel headers, the run card
  sm: { src: logo240, w: 240, h: 86 },        // HUD chips
} as const;
export const OC_LOGO_480 = logo480, OC_LOGO_240 = logo240;

export function OcMark({ size = 'md', alt = '', className = '' }: { size?: keyof typeof CUTS; alt?: string; className?: string }) {
  const c = CUTS[size];
  return <img className={'oc-mark ' + className} src={c.src} width={c.w} height={c.h} alt={alt} decoding="async" draggable={false} />;
}

// The game's name (owner, 2026-10-16): OC Ultra, with Top Speed beneath. The lockup is the OC wordmark, the chromed
// ULTRA beside it as the second word, and a quiet TOP SPEED line under both. No R badge here: the R is the car's
// brand (Rossini), on the wheel hub and the bodies only. `heading` makes it the page's h1 (menu, loading); in a panel
// header (pause, results) it is one labelled image. styles.css sizes every part from --mk, the mark's width.
export function OcLockup({ heading = false, size = 'lg' }: { heading?: boolean; size?: 'lg' | 'md' }) {
  const word = <span className="word" data-text="Ultra"><span data-text="Ultra">Ultra</span></span>;
  if (heading) {
    return (
      <h1 className="lockup">
        <span className="lockup-name"><OcMark size={size} alt="OC" />{word}</span>
        <span className="lockup-sub">Top Speed</span>
      </h1>
    );
  }
  return (
    <div className="lockup" role="img" aria-label="OC Ultra: Top Speed">
      <span className="lockup-name"><OcMark size={size} />{word}</span>
      <span className="lockup-sub">Top Speed</span>
    </div>
  );
}

// The watermark on the loading and pause screens: palms and a skyline over a sunset, drawn here in the mask's own
// 960 × 343 space and cut to the letterform by oc-mask.png (a CSS mask in styles.css), at 7 % so it stays a texture.
const HORIZON = 243;
// [trunk foot x, height, lean]: a grove in the O, a pair in the C, short ones along the C's lower bar
const PALMS: [number, number, number][] = [
  [92, 150, -10], [134, 206, 12], [182, 172, -8], [230, 122, 6],
  [508, 124, -6], [548, 152, 9], [592, 104, -4],
  [742, 62, 4], [790, 74, -5], [836, 56, 3],
];
// frond ends around the crown, in crown lengths (x right, y down); each arches up before it droops
const FRONDS: [number, number][] = [[-1, 0.45], [-0.9, 0.04], [-0.55, -0.3], [-0.1, -0.42], [0.36, -0.32], [0.86, 0], [1, 0.44], [-0.5, 0.72], [0.55, 0.74]];
// [left, width, height]: a stylised downtown in the O's right stroke, the sun behind it
const TOWERS: [number, number, number][] = [
  [300, 14, 26], [316, 10, 40], [328, 17, 62], [347, 12, 46], [361, 19, 92], [382, 13, 70],
  [397, 21, 112], [420, 12, 56], [434, 16, 84], [452, 10, 38], [464, 14, 22],
];
const n = (v: number) => Math.round(v * 10) / 10;

function palm([x, h, lean]: [number, number, number], k: number) {
  const tx = x + lean, ty = HORIZON - h, L = h * 0.3;
  const fronds = FRONDS.map(([dx, dy]) => `M${n(tx)} ${n(ty)}q${n(dx * L * 0.45)} ${n((dy * 0.45 - 0.34) * L)} ${n(dx * L)} ${n(dy * L)}`).join('');
  return (
    <g key={k}>
      <path className="wm-trunk" d={`M${x} ${HORIZON + 4}Q${n(x + lean * 0.15)} ${n(HORIZON - h * 0.55)} ${n(tx)} ${n(ty)}`} strokeWidth={n(Math.max(2.5, h * 0.034))} />
      <path className="wm-frond" d={fronds} strokeWidth={n(Math.max(2, h * 0.026))} />
    </g>
  );
}

export function OcWatermark() {
  return (
    <div className="oc-watermark" aria-hidden="true">
      <i>
        <svg viewBox="0 0 960 343" preserveAspectRatio="none">
          <circle className="wm-sun" cx={394} cy={180} r={36} />
          <path className="wm-ink" d={TOWERS.map(([l, w, h]) => `M${l} ${HORIZON}v${-h}h${w}v${h}z`).join('') + `M0 ${HORIZON}h960v100H0z`} />
          <path className="wm-lights" d={`M40 ${HORIZON + 14}H900M80 ${HORIZON + 28}H940`} />
          {PALMS.map(palm)}
        </svg>
      </i>
    </div>
  );
}
