// Player settings and the graphics quality presets. Saved to localStorage when it's available.

export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type Mode = 'free' | 'survival' | 'time';
export type Density = 'none' | 'light' | 'moderate' | 'heavy' | 'expert';
export type Corner = 'map' | 'sky' | 'off';
export type TimeOfDay = 'live' | 'sunrise' | 'day' | 'sunset' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'mist' | 'changing';
export type Transmission = 'auto' | 'manual';

export interface Settings {
  quality: Quality;
  adaptive: boolean;        // scale resolution to hold the frame rate
  density: Density;
  handling: number;         // 0 = arcade (assists on) .. 1 = simulation
  transmission: Transmission;
  master: number;
  engine: number;
  ambient: number;
  fov: number;              // added to the cockpit's base field of view, degrees
  showFps: boolean;
  corner: Corner;           // the top-right window: road map, live sky camera, or nothing
  cornerSize: number;       // 0 small, 1 medium, 2 large
  start: string;            // where Free Drive starts: a carriageway label like 'I-405 North'
  showTouch: boolean;       // on-screen pedals on a device without a coarse pointer
  time: TimeOfDay;          // 'live' follows this device's clock (the sun's real position over OC)
  weather: Weather;
  driver: 'closer' | 'ace' | 'wrench';
  presentation: 'm' | 'f';
  skin: number;             // index into drivers.SKINS
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
    quality: guessQuality(), adaptive: true, density: 'moderate', handling: 0.35, transmission: 'auto',
    master: 0.8, engine: 0.9, ambient: 0.7, fov: 0, showFps: false, corner: 'map', cornerSize: 1, start: 'I-405 North', showTouch: false, time: 'day', weather: 'clear', driver: 'closer', presentation: 'm', skin: 1,
  };
}

export function loadSettings(): Settings {
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
      time: (['live', 'sunrise', 'day', 'sunset', 'night'] as const).includes(v.time as TimeOfDay) ? v.time! : d.time,
      weather: (['clear', 'cloudy', 'rain', 'fog', 'mist', 'changing'] as const).includes(v.weather as Weather) ? v.weather! : d.weather,
      driver: v.driver === 'ace' || v.driver === 'wrench' ? v.driver : 'closer',
      presentation: v.presentation === 'f' ? 'f' : 'm',
      skin: Math.max(0, Math.min(4, Number(v.skin ?? d.skin) || 0)),
      transmission: v.transmission === 'manual' ? 'manual' : 'auto',
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
