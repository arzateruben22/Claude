// Player settings and the graphics quality presets. Saved to localStorage when it's available.

export const VERSION = '0.1.0';   // keep in step with package.json; shown in feedback reports

export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type Mode = 'free' | 'survival' | 'race' | 'time';
export type Density = 'none' | 'light' | 'moderate' | 'heavy' | 'expert';
export type Corner = 'map' | 'sky' | 'off';
export type TimeOfDay = 'live' | 'sunrise' | 'day' | 'sunset' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'mist' | 'changing';
export type Transmission = 'auto' | 'manual';

export interface Settings {
  quality: Quality;
  adaptive: boolean;        // scale resolution to hold the frame rate
  density: Density;
  handling: number;         // 0 = arcade (assists on) .. 1 = simulation; the named profiles are points on it (PROFILES)
  transmission: Transmission;
  master: number;
  engine: number;
  ambient: number;
  fov: number;              // added to the cockpit's base field of view, degrees
  showFps: boolean;
  corner: Corner;           // the top-right window: road map, live sky camera, or nothing
  cornerSize: number;       // 0 small, 1 medium, 2 large
  start: string;            // where Free Drive starts: a carriageway label like 'I-405 North'
  exit: string;             // or start at your own exit: a key from Game.exitsFor ('<carriageway> @ <metres>'), '' for the start above
  showTouch: boolean;       // on-screen pedals on a device without a coarse pointer
  time: TimeOfDay;          // 'live' follows this device's clock (the sun's real position over OC)
  weather: Weather;
  driver: 'closer' | 'ace' | 'wrench';
  presentation: 'm' | 'f';
  skin: number;             // index into drivers.SKINS
  course: string;           // the race you last picked
  music: number;            // radio volume
  ultra: boolean;           // Ultra Realism (opens at level 5), and its three parts
  ultraTunnel: boolean;
  ultraShake: boolean;
  ultraMuffle: boolean;
  owner: boolean;           // owner mode: every car in the garage to drive, for test builds only (a local switch, not security)
}

export interface QualityPreset {
  label: string;
  renderScale: number;      // starting fraction of the device pixel ratio
  maxPixelRatio: number;
  shadows: number;          // shadow map size, 0 = off
  post: boolean;            // composer at all
  bloom: boolean;
  ao: boolean;
  msaa: number;             // samples on the composer's target
  drawDistance: number;     // metres of road built ahead
  props: number;            // scenery density multiplier
  texture: number;          // procedural texture size
}

export const QUALITY: Record<Quality, QualityPreset> = {
  low:    { label: 'Low',    renderScale: 0.75, maxPixelRatio: 1,   shadows: 0,    post: false, bloom: false, ao: false, msaa: 0, drawDistance: 900,  props: 0.45, texture: 512 },
  medium: { label: 'Medium', renderScale: 1,    maxPixelRatio: 1.5, shadows: 1024, post: false, bloom: false, ao: false, msaa: 0, drawDistance: 1300, props: 0.75, texture: 1024 },
  high:   { label: 'High',   renderScale: 1,    maxPixelRatio: 2,   shadows: 2048, post: true,  bloom: true,  ao: false, msaa: 4, drawDistance: 1800, props: 1,    texture: 1024 },
  ultra:  { label: 'Ultra',  renderScale: 1,    maxPixelRatio: 2,   shadows: 4096, post: true,  bloom: true,  ao: true,  msaa: 4, drawDistance: 2400, props: 1.25, texture: 2048 },
};

// Driving profiles (hypercar plan M4): named points on the handling slider, which stays the one saved value (the
// physics reads `handling`, so saves and the suite keep working). The values are the dynamics model's (PROJECT_OC_DYNAMICS.md
// §3.9); each line says what that point changes, from Physics.ts: tyre grip 1.12 + 0.3·(1 − h) (Sport 8 % and
// Simulation 16 % under Arcade), the stability control's pull 5·(1 − h) per second plus a race-mode pull past about 5°
// of slide, the slide bleed 2.2·(1 − h)², the traction control's slip target (at the tyre's peak through h 0.35, a
// spin-catcher at 0.9), the falloff past the peak 0.02 + 0.18·h (4.7 / 11 / 18 %) and the steering lock 1 + 0.35·h.
// Any other value is Custom: every assist scales smoothly between the named points.
export type Profile = 'arcade' | 'sport' | 'sim';
export const PROFILES: Record<Profile, { label: string; h: number; line: string }> = {
  arcade: { label: 'Arcade', h: 0.15, line: 'Strong stability and traction control, the most grip; forgiving past the limit.' },
  sport: { label: 'Sport', h: 0.5, line: 'Lighter stability control, 8% less grip; the rear can step out on the power.' },
  sim: { label: 'Simulation', h: 0.9, line: 'Stability control only in a real slide, 16% less grip; the tyres let go past the limit.' },
};
export const PROFILE_IDS = Object.keys(PROFILES) as Profile[];
// the named profile a handling value is, or 'custom' (the slider moves in 0.05 steps, so the match is exact in practice)
export function profileOf(h: number): Profile | 'custom' {
  for (const id of PROFILE_IDS) if (Math.abs(h - PROFILES[id].h) < 0.004) return id;
  return 'custom';
}
// a custom value in words: which named points it sits between
export function customLine(h: number): string {
  const pts = PROFILE_IDS.map((id) => PROFILES[id]);
  if (h < pts[0].h) return `More assisted than Arcade: stronger stability control and more grip still.`;
  if (h > pts[pts.length - 1].h) return `Past Simulation: the least assistance and the least grip.`;
  const i = pts.findIndex((p, k) => k < pts.length - 1 && h > p.h && h < pts[k + 1].h);
  if (i < 0) return 'Your own point on the slider.';
  return `Between ${pts[i].label} and ${pts[i + 1].label}: every assist scales smoothly with the slider.`;
}

// cars per kilometre per lane, and the share of aggressive drivers
export const DENSITY: Record<Density, { label: string; perKmLane: number; bold: number }> = {
  none:     { label: 'None',     perKmLane: 0,   bold: 0 },
  light:    { label: 'Light',    perKmLane: 2.2, bold: 0 },
  moderate: { label: 'Moderate', perKmLane: 5,   bold: 0.04 },
  heavy:    { label: 'Heavy',    perKmLane: 9,   bold: 0.08 },
  expert:   { label: 'Expert',   perKmLane: 9.5, bold: 0.45 },
};

export const MODES: Record<Mode, { label: string; blurb: string }> = {
  free:     { label: 'Free Drive',     blurb: 'All of Orange County\'s freeways, no clock. Take any interchange.' },
  survival: { label: 'Speed Survival', blurb: 'Stay over 100 mph. Near misses and clean passes build the streak. One real crash ends it.' },
  race:     { label: 'Races',          blurb: 'Three rivals on real stretches of freeway: sprints, checkpoints, endurance.' },
  time:     { label: 'Time Trial',     blurb: '60 seconds on the clock. Every 2 km buys 25 more.' },
};

const KEY = 'tsu.settings';

// Free Drive starting points: a carriageway, and how far along it (0..1)
export const STARTS: { label: string; at: number; blurb: string }[] = [
  { label: 'I-405 North', at: 0.12, blurb: 'Irvine, toward Costa Mesa' },
  { label: 'I-405 South', at: 0.55, blurb: 'Huntington Beach, toward Irvine' },
  { label: 'I-5 North', at: 0.42, blurb: 'Tustin, toward Santa Ana' },
  { label: 'I-5 South', at: 0.3, blurb: 'Anaheim, toward Irvine' },
  { label: 'CA-55 North', at: 0.2, blurb: 'Costa Mesa, toward Santa Ana' },
  { label: 'CA-55 South', at: 0.35, blurb: 'Orange, toward Costa Mesa' },
  { label: 'CA-91 East', at: 0.35, blurb: 'Anaheim, toward Riverside' },
  { label: 'CA-91 West', at: 0.55, blurb: 'Anaheim Hills, toward Fullerton' },
  { label: 'CA-57 North', at: 0.25, blurb: 'Orange, toward Brea' },
  { label: 'CA-22 East', at: 0.3, blurb: 'Garden Grove, toward Orange' },
  { label: 'CA-73 South', at: 0.15, blurb: 'Costa Mesa, through the hills' },
  { label: 'CA-241 North', at: 0.3, blurb: 'The Foothill toll road' },
];

function guessQuality(): Quality {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (coarse) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  return cores >= 8 ? 'high' : 'medium';
}

export function defaults(): Settings {
  return {
    quality: guessQuality(), adaptive: true, density: 'moderate', handling: PROFILES.arcade.h, transmission: 'auto',
    master: 0.8, engine: 0.9, ambient: 0.7, fov: 0, showFps: false, corner: 'map', cornerSize: 1, start: 'I-405 North', exit: '', showTouch: false, time: 'day', weather: 'clear', driver: 'closer', presentation: 'm', skin: 1, course: 'irvine', music: 0.6, ultra: false, ultraTunnel: true, ultraShake: true, ultraMuffle: true, owner: false,
  };
}

// owner mode from the address: #owner turns it on, #owner=0 off (an artifact link keeps a bare #anchor); null: neither
export function ownerFromHash(): boolean | null {
  try {
    const h = location.hash.toLowerCase();
    if (h === '#owner' || h === '#owner=1') return true;
    if (h === '#owner=0') return false;
  } catch { /* no address to read */ }
  return null;
}

export function loadSettings(): Settings {
  const s = readSettings(), hash = ownerFromHash();
  if (hash !== null && hash !== s.owner) { s.owner = hash; saveSettings(s); }
  return s;
}

function readSettings(): Settings {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      ...d, ...v,
      quality: v.quality && v.quality in QUALITY ? v.quality : d.quality,
      density: v.density && v.density in DENSITY ? v.density : (v.density as string) === 'medium' ? 'moderate' : d.density,
      corner: v.corner === 'sky' || v.corner === 'off' ? v.corner : 'map',
      start: STARTS.some((x) => x.label === v.start) ? v.start! : d.start,
      exit: typeof v.exit === 'string' ? v.exit : '',
      time: (['live', 'sunrise', 'day', 'sunset', 'night'] as const).includes(v.time as TimeOfDay) ? v.time! : d.time,
      weather: (['clear', 'cloudy', 'rain', 'fog', 'mist', 'changing'] as const).includes(v.weather as Weather) ? v.weather! : d.weather,
      driver: v.driver === 'ace' || v.driver === 'wrench' ? v.driver : 'closer',
      presentation: v.presentation === 'f' ? 'f' : 'm',
      skin: Math.max(0, Math.min(4, Number(v.skin ?? d.skin) || 0)),
      course: typeof v.course === 'string' ? v.course : d.course,
      transmission: v.transmission === 'manual' ? 'manual' : 'auto',
      handling: typeof v.handling === 'number' && Number.isFinite(v.handling) ? Math.min(1, Math.max(0, v.handling)) : d.handling,
      owner: v.owner === true,
    };
  } catch { return d; }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* settings are a convenience */ }
}

export function loadBest(mode: Mode): number {
  try { return Number(localStorage.getItem('tsu.best.' + mode)) || 0; } catch { return 0; }
}
export function saveBest(mode: Mode, v: number): void {
  try { localStorage.setItem('tsu.best.' + mode, String(v)); } catch { /* fine */ }
}
