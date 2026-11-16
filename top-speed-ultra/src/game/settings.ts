// Player settings and the graphics quality presets. Saved to localStorage when it's available.

import { CONFIG } from '../store/config';

export const VERSION = '0.1.0';   // keep in step with package.json; shown in feedback reports

export type Quality = 'low' | 'medium' | 'high' | 'ultra';
// the game's two modes (owner, 2026-11-08: "only stick to free drive and try to stay over 100mph"); Races and Time
// Trial were removed. A mode saved by an older version ('race', 'time') reads as Free Drive through modeOf.
export type Mode = 'free' | 'survival';
export const modeOf = (v: unknown): Mode => (v === 'survival' ? 'survival' : 'free');
export type Density = 'none' | 'light' | 'moderate' | 'heavy' | 'expert';
export type Corner = 'map' | 'sky' | 'off';
export type TimeOfDay = 'live' | 'sunrise' | 'day' | 'sunset' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'mist' | 'changing';
export type Transmission = 'auto' | 'manual';
export type HudStyle = 'modern' | 'minimal';
export type Style = 'standard' | 'retro';   // RS1: the Retro look on Low (temporary switch until RS2 makes it Low itself)

export type Look = 'ultra' | 'hd';
export interface Settings {
  quality: Quality;
  adaptive: boolean;        // the frame-time governor (src/game/render/governor.ts): steps effects down to hold 60 (or a steady 30)
  qualityChosen: boolean;   // the player picked the Graphics preset themselves: the graphics check never changes it
  showPerf: boolean;        // the performance overlay (src/ui/PerfOverlay.tsx); `?perf` shows it for one visit
  density: Density;
  handling: number;         // 0 = arcade (assists on) .. 1 = simulation; the named profiles are points on it (PROFILES)
  transmission: Transmission;
  master: number;
  engine: number;
  ambient: number;
  fov: number;              // added to the cockpit's base field of view, degrees (FOV_DEFAULT unless the player moved it)
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
  music: number;            // radio volume
  ultra: boolean;           // Ultra Realism (opens at level 5), and its three parts
  ultraTunnel: boolean;
  ultraShake: boolean;
  ultraMuffle: boolean;
  hudStyle: HudStyle;       // Minimal tucks the top bar and the corner window away after 4 s without input (U1)
  owner: boolean;           // owner mode: every car in the garage to drive, for test builds only (a local switch, not security)
  style: Style;             // RS1: 'retro' draws Low in the Retro style (src/game/render/style.ts)
  // the art direction of the interface (the owner's style library, PROJECT_OC_STYLE_GUIDE.md): 'ultra' futuristic
  // luxury (the default), 'hd' modern realistic. The car still sets the accent; the look sets the surfaces and shapes
  look: Look;
  paints: Record<string, number>;   // the garage's paint per car id (cars.ts PAINTS); a car not listed wears its own
  wheels: Record<string, string>;   // the garage's rim style per car id (cars.ts WHEELS); likewise
  radioFavs: string[];      // starred stations on the radio card (station ids)
  v: number;                // the settings' version (SETTINGS_V): which defaults a saved value was made under
}

// The field of view's default (owner, 2026-11-16: "make the standard pov set at +10"): Settings' "Field of view" slider
// (-10..+15) starts at +10. It was 0; readSettings moves a saved 0 made under the old default to +10, once (SETTINGS_V).
export const FOV_DEFAULT = 10;
// 2: the field of view's default went from 0 to +10. Settings saved before it carry no `v`.
export const SETTINGS_V = 2;

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
  grade: boolean;           // the Ultra grade pass: a soft vignette, edge chromatic aberration and faint film grain
  minPixelRatio?: number;   // the adaptive resolution's floor (Retro: never under the screen's CSS pixels)
}

export const QUALITY: Record<Quality, QualityPreset> = {
  low:    { label: 'Low',    renderScale: 0.75, maxPixelRatio: 1,   shadows: 0,    post: false, bloom: false, ao: false, msaa: 0, drawDistance: 900,  props: 0.45, texture: 512,  grade: false },
  medium: { label: 'Medium', renderScale: 1,    maxPixelRatio: 1.5, shadows: 1024, post: false, bloom: false, ao: false, msaa: 0, drawDistance: 1300, props: 0.75, texture: 1024, grade: false },
  high:   { label: 'High',   renderScale: 1,    maxPixelRatio: 2,   shadows: 2048, post: true,  bloom: true,  ao: false, msaa: 4, drawDistance: 1800, props: 1,    texture: 1024, grade: false },
  ultra:  { label: 'Ultra',  renderScale: 1,    maxPixelRatio: 2,   shadows: 4096, post: true,  bloom: true,  ao: true,  msaa: 4, drawDistance: 2400, props: 1.25, texture: 2048, grade: true },
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

// RS1, the Retro style on Low: Low's world (draw distance, scenery, textures) at full resolution, the device's pixel
// ratio up to 2 and never under 1, with hard one-step sun shadows and its own single post pass (no composer)
export const RETRO: QualityPreset = { ...QUALITY.low, label: 'Low · Retro', renderScale: 1, maxPixelRatio: 2, minPixelRatio: 1, shadows: 1024, post: false, bloom: false, ao: false, msaa: 0 };
export const retroOn = (s: Pick<Settings, 'quality' | 'style'>) => s.quality === 'low' && s.style === 'retro';
export const presetFor = (s: Pick<Settings, 'quality' | 'style'>): QualityPreset => (retroOn(s) ? RETRO : QUALITY[s.quality]);

// The frame-time governor's floors (SMOOTH): the lowest render scale it may take, as a share of the preset's own
// resolution (its pixel ratio on this screen). High and Ultra keep at least three quarters of theirs; Low and Medium
// may go to half. The absolute floor of 0.5 device pixels per CSS pixel holds as before.
export const GOV_FLOOR: Record<Quality, number> = { low: 0.5, medium: 0.5, high: 0.75, ultra: 0.75 };

// The first-run graphics check (Game.benchmark): what it picked on this device, saved apart from the settings so a
// new device starts fresh. `skipped`: the player skipped it (it doesn't ask again; Settings can run it).
export interface BenchPick {
  v: 1; quality: Quality; scale: number; target: 60 | 30; skipped?: boolean; at: string;
  // every round sat at a display/browser frame cap (`cap` fps) with light work: the check couldn't tell (no pick)
  inconclusive?: boolean; cap?: number;
  rounds: { quality: Quality; scale: number; ms: number; work?: number; slow: number }[];
}
const BENCH_KEY = 'tsu.bench';
export function loadBench(): BenchPick | null {
  try {
    const v = JSON.parse(localStorage.getItem(BENCH_KEY) || 'null') as BenchPick | null;
    if (!v || v.v !== 1 || !(v.quality in QUALITY)) return null;
    return { ...v, scale: Math.min(1, Math.max(0.5, Number(v.scale) || 1)), target: v.target === 30 ? 30 : 60, rounds: Array.isArray(v.rounds) ? v.rounds : [] };
  } catch { return null; }
}
export function saveBench(b: BenchPick): void {
  try { localStorage.setItem(BENCH_KEY, JSON.stringify(b)); } catch { /* a convenience */ }
}

// What this device's display has shown the frame-time governor (SMOOTH), kept apart from the settings: the fastest
// frames' mean it has drawn (ms; a display cap is ruled out by faster frames) and a cap a probe confirmed (ms, or 0)
export interface DisplaySeen { minMs: number; capMs: number }
const DISPLAY_KEY = 'tsu.display';
export function loadDisplay(): DisplaySeen {
  try {
    const v = JSON.parse(localStorage.getItem(DISPLAY_KEY) || 'null') as Partial<DisplaySeen> | null;
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 1000 ? x : 0);
    return { minMs: n(v?.minMs), capMs: n(v?.capMs) };
  } catch { return { minMs: 0, capMs: 0 }; }
}
export function saveDisplay(d: DisplaySeen): void {
  try { localStorage.setItem(DISPLAY_KEY, JSON.stringify({ minMs: Math.round(d.minMs * 10) / 10, capMs: Math.round(d.capMs * 10) / 10 })); } catch { /* a convenience */ }
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

// a phone's first run starts in the Minimal HUD (it tucks the map and the icons after 4 s of just driving); a saved choice wins
const firstHud = (): HudStyle => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'minimal' : 'modern');

function guessQuality(): Quality {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (coarse) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  return cores >= 8 ? 'high' : 'medium';
}

export function defaults(): Settings {
  return {
    quality: guessQuality(), adaptive: true, qualityChosen: false, showPerf: false, density: 'moderate', handling: PROFILES.arcade.h, transmission: 'auto',
    master: 0.8, engine: 0.9, ambient: 0.7, fov: FOV_DEFAULT, showFps: false, corner: 'map', cornerSize: 1, start: 'I-405 North', exit: '', showTouch: false, time: 'day', weather: 'clear', driver: 'closer', presentation: 'm', skin: 1, music: 0.6, ultra: false, ultraTunnel: true, ultraShake: true, ultraMuffle: true,
    hudStyle: firstHud(), owner: false, style: 'standard', look: 'ultra', paints: {}, wheels: {}, radioFavs: [], v: SETTINGS_V,
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

// The owner's test build (owner, 2026-10-21: "make sure the hypercar is playable on my end"): owner mode starts on, with
// no setting to find and no #owner needed, even where this device saved it off. scripts/single-file.mjs marks the
// artifact page it writes (<div id="root" data-build="owner-test">) unless VITE_OWNER_TEST_BUILD=false or anything
// says live payments; and a build whose store is live (src/store/config.ts) ignores the mark. #owner=0, or the Settings
// toggle, turns it off for that visit.
export function ownerTestBuild(): boolean {
  if (CONFIG.live) return false;
  try { return document.getElementById('root')?.dataset.build === 'owner-test'; } catch { return false; }
}

export function loadSettings(): Settings {
  const { s, migrated } = readSettings(), hash = ownerFromHash();
  if (migrated) saveSettings(s);                                  // the move to SETTINGS_V happens once, and is kept
  if (hash !== null && hash !== s.owner) { s.owner = hash; saveSettings(s); }
  else if (hash === null && ownerTestBuild()) s.owner = true;   // for this visit; what the device saved is left as it was
  return s;
}

// nothing was saved on this device before this load: its first run (the graphics check runs on its own only then)
let firstRun = false;
export const isFirstRun = () => firstRun;

// the settings this device saved, checked, over the defaults; `migrated` when they were saved by an older version
// (before SETTINGS_V) and moved to this one here, so loadSettings writes them back once
function readSettings(): { s: Settings; migrated: boolean } {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { firstRun = true; return { s: d, migrated: false }; }
    const v = JSON.parse(raw) as Partial<Settings>;
    // keys an older version saved for the removed Races (the course picked) and any mode: not settings any more
    const old = v as Record<string, unknown>; delete old.course; delete old.mode;
    const from = typeof v.v === 'number' && Number.isFinite(v.v) ? v.v : 1;
    let fov = typeof v.fov === 'number' && Number.isFinite(v.fov) ? Math.max(-10, Math.min(15, Math.round(v.fov))) : d.fov;
    // the old default, never moved: saved before SETTINGS_V 2 at exactly 0, it takes the new default (+10). Once saved
    // at v 2, a 0 is the player's own choice and stays.
    if (from < 2 && fov === 0) fov = FOV_DEFAULT;
    const s: Settings = {
      ...d, ...v,
      fov, v: SETTINGS_V,
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
      transmission: v.transmission === 'manual' ? 'manual' : 'auto',
      hudStyle: v.hudStyle === 'minimal' || v.hudStyle === 'modern' ? v.hudStyle : d.hudStyle,
      handling: typeof v.handling === 'number' && Number.isFinite(v.handling) ? Math.min(1, Math.max(0, v.handling)) : d.handling,
      owner: v.owner === true,
      adaptive: v.adaptive !== false,
      qualityChosen: v.qualityChosen === true,
      showPerf: v.showPerf === true,
      style: v.style === 'retro' ? 'retro' : 'standard',
      look: v.look === 'hd' ? 'hd' : 'ultra',
      paints: v.paints && typeof v.paints === 'object' ? Object.fromEntries(Object.entries(v.paints).filter(([k, x]) => typeof k === 'string' && Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 0xffffff)) as Record<string, number> : {},
      wheels: v.wheels && typeof v.wheels === 'object' ? Object.fromEntries(Object.entries(v.wheels).filter(([k, x]) => typeof k === 'string' && typeof x === 'string' && /^[a-z0-9]{2,8}$/.test(x))) as Record<string, string> : {},
      radioFavs: Array.isArray(v.radioFavs) ? v.radioFavs.filter((x) => typeof x === 'string').slice(0, 8) : [],
    };
    return { s, migrated: from < SETTINGS_V };
  } catch { return { s: d, migrated: false }; }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* settings are a convenience */ }
}

export function loadBest(mode: Mode): number {
  // (an older version's Time Trial best, tsu.best.time, stays on the device unread)
  try { return Number(localStorage.getItem('tsu.best.' + mode)) || 0; } catch { return 0; }
}
export function saveBest(mode: Mode, v: number): void {
  try { localStorage.setItem('tsu.best.' + mode, String(v)); } catch { /* fine */ }
}
