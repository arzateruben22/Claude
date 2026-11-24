// Player settings and the graphics quality presets. Saved to localStorage when it's available.

import { CONFIG } from '../store/config';
import { isCastId } from '../onfoot/cast';

export const VERSION = '0.1.0';   // keep in step with package.json; shown in feedback reports

export type Quality = 'low' | 'medium' | 'high' | 'ultra';
// the game's two modes (owner, 2026-11-08: "only stick to free drive and try to stay over 100mph"); Races and Time
// Trial were removed. A mode saved by an older version ('race', 'time') reads as Free Drive through modeOf.
export type Mode = 'free' | 'survival';
export const modeOf = (v: unknown): Mode => (v === 'survival' ? 'survival' : 'free');
// 'none' is the engine's empty freeway (the suite and the graphics check use it); nothing offers it any more (Zero traffic /
// Drift mode went, owner 2026-11-22) and a saved 'none' is read as Light (readSettings).
export type Density = 'none' | 'light' | 'moderate' | 'heavy' | 'expert';
export type Corner = 'map' | 'sky' | 'off';
export type TimeOfDay = 'live' | 'sunrise' | 'day' | 'sunset' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'mist' | 'changing';
// The gearbox is automatic for everyone (owner, 2026-11-22; SETTINGS_V 5): the field stays, always 'auto', so a saved
// 'manual' migrates to it. Q/E and the touch paddles are a short manual hold in the game (Game.MANUAL_HOLD_S).
export type Transmission = 'auto';
export type HudStyle = 'modern' | 'minimal';
export type Style = 'standard' | 'retro';   // RS1: the Retro look on Low; with Low, the default for a new player (SETTINGS_V 3)

export type Look = 'ultra' | 'hd';
// The menu and Settings' colours (owner, 2026-11-18): Midnight (dark) or Velocity (light); Auto follows the device's
// prefers-color-scheme. The in-drive HUD keeps its own look whichever is picked.
export type Theme = 'auto' | 'light' | 'dark';
export interface Settings {
  quality: Quality;
  adaptive: boolean;        // the frame-time governor (src/game/render/governor.ts): steps effects down to hold 60 (or a steady 30)
  qualityChosen: boolean;   // the player picked the Graphics preset themselves: the graphics check never changes it
  showPerf: boolean;        // the performance overlay (src/ui/PerfOverlay.tsx); `?perf` shows it for one visit
  density: Density;
  handling: number;         // 0 = arcade (assists on) .. 1 = simulation; the named profiles are points on it (PROFILES)
  transmission: Transmission;   // always 'auto' (see Transmission)
  tile: Tile;               // the menu's last pick: Free Drive or one of the three difficulties
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
  // the chosen character (src/onfoot/cast.ts id), '' until the player picks one: then the driver's appearance is the
  // old presentation and skin above, exactly as before (2026-11-11). Picked, it is the driver everywhere: the cockpit
  // arms, the on-foot avatar in both venues. The archetype (driver) stays the gameplay choice.
  character: string;
  // (2026-11-12) the pack characters' TEST unlock (src/game/castPack.ts): honoured only in a test-mode build; not a
  // purchase and not a store entitlement
  packTest: boolean;
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
  theme: Theme;             // Settings > Graphics' Menu theme: Auto follows the device, or Light (Velocity) / Dark (Midnight)
  paints: Record<string, number>;   // the garage's paint per car id (cars.ts PAINTS); a car not listed wears its own
  wheels: Record<string, string>;   // the garage's rim style per car id (cars.ts WHEELS); likewise
  radioFavs: string[];      // starred stations on the radio card (station ids)
  // (the ABS | TCS switches and their `abs` / `tcs` settings left on 2026-11-24: assistsFor below decides both)
  v: number;                // the settings' version (SETTINGS_V): which defaults a saved value was made under
}

// The cockpit's field of view, added to its base (owner, 2026-11-16: "make the standard pov set at +10"; 2026-11-24: the
// "Field of view" slider left Settings to declutter, and the view is this one fixed value, "to display the cockpit as much
// as we could"). Change it here: readSettings puts every saved value on it, so `settings.fov` stays readable everywhere.
// +13, the owner's decision (2026-11-24) after the renders: he proposed +15, which failed the suite's iPhone hood check
// (the bonnet 1.3 % of the frame, floor 1.4 %) and the Rossini GT's cluster check (centre 52.4 %, floor 53 %).
export const FOV_DEFAULT = 13;
// 2: the field of view's default went from 0 to +10. Settings saved before it carry no `v`.
// 3: Retro Low is the default (owner, 2026-11-16: "make the style retro low as the new default"): settings saved before
// it by a player who never picked the Graphics preset themselves (qualityChosen false) move to Low + Retro once; a
// player who picked keeps their preset and style as they were.
// 4: Graphics is only two choices, Retro Low and Ultra (owner, 2026-11-18): settings saved before it move to the nearer
// of the two (Low and Medium to Retro Low; High and Ultra to Ultra, with Adaptive quality on behind it), once. The first-run
// default stays Retro Low.
// 5 (owner, 2026-11-22): the gearbox is automatic for everyone (a saved 'manual' becomes 'auto'); Appearance
// (Futuristic / Realistic) folds into the two graphics choices (Ultra = the realistic 'hd' look, Retro Low = the retro
// look), so the saved look follows the saved graphics; a saved density 'none' (Zero traffic) reads as Light.
// 6 (owner, 2026-11-24: "get rid of the traffic selection when choosing free drive and just have the default traffic be
// low"): Free Drive's traffic picker is gone and Free Drive runs Light; a density saved before it (Moderate, Heavy, Expert)
// moves to Light, once. The timed runs keep their own traffic (DIFFICULTY). The field of view is fixed (FOV_DEFAULT).
// The saved ABS | TCS choices are dropped (assistsFor).
export const SETTINGS_V = 6;

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
// the car's ABS and traction control (owner, 2026-11-24: the ABS | TCS bar left the HUD, no toggles anywhere): ABS is
// always on; TCS follows the handling setting, on for Arcade and Sport (and a Custom value below the Simulation point),
// off at Simulation. Game sets Physics.abs / .tc from it at every placement and settings change.
export function assistsFor(s: Pick<Settings, 'handling'>): { abs: boolean; tc: boolean } {
  return { abs: true, tc: s.handling < PROFILES.sim.h - 1e-6 };
}
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
export const RETRO: QualityPreset = { ...QUALITY.low, label: 'Retro · Low', renderScale: 1, maxPixelRatio: 2, minPixelRatio: 1, shadows: 1024, post: false, bloom: false, ao: false, msaa: 0 };
export const retroOn = (s: Pick<Settings, 'quality' | 'style'>) => s.quality === 'low' && s.style === 'retro';
export const presetFor = (s: Pick<Settings, 'quality' | 'style'>): QualityPreset => (retroOn(s) ? RETRO : QUALITY[s.quality]);

// The two Graphics choices the player sees (owner, 2026-11-18): Retro Low (the Low world in the Retro style) and Ultra.
// The four internal presets stay (the graphics check, the governor and the suite use them); the menu maps onto the
// nearer of the two. Ultra keeps Adaptive quality on behind it (the frame-time governor), so it is switched on with it.
export type Graphics = 'retro' | 'ultra';
export const GRAPHICS: Record<Graphics, { label: string; blurb: string }> = {
  retro: { label: 'Retro Low', blurb: 'The default: Low\'s world in the Retro style, cel-shaded with hard sun shadows, at full resolution; 0.9 km of road. Made for phones.' },
  ultra: { label: 'Ultra', blurb: 'Everything: bloom, 4x MSAA, ambient occlusion, a 4K shadow map, denser scenery, 2.4 km of road.' },
};
export const graphicsOf = (s: Pick<Settings, 'quality'>): Graphics => (s.quality === 'high' || s.quality === 'ultra' ? 'ultra' : 'retro');
// The graphics choice carries the look (owner, 2026-11-22: Appearance folded into it): Ultra is the realistic ('hd') look at
// full quality, Retro Low the retro look (the interface's default art direction, 'ultra', over the Retro style).
export const lookFor = (g: Graphics): Look => (g === 'ultra' ? 'hd' : 'ultra');
export const graphicsPatch = (g: Graphics): Partial<Settings> => (g === 'ultra' ? { quality: 'ultra', style: 'standard', adaptive: true, qualityChosen: true, look: lookFor(g) } : { quality: 'low', style: 'retro', qualityChosen: true, look: lookFor(g) });

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

// cars per kilometre per lane, the share of aggressive drivers, and how fast the traffic cruises (1 = as posted)
export const DENSITY: Record<Density, { label: string; perKmLane: number; bold: number; speed: number }> = {
  none:     { label: 'None',     perKmLane: 0,   bold: 0,    speed: 1 },
  light:    { label: 'Light',    perKmLane: 2.2, bold: 0,    speed: 1 },
  moderate: { label: 'Moderate', perKmLane: 5,   bold: 0.04, speed: 1 },
  heavy:    { label: 'Heavy',    perKmLane: 9,   bold: 0.08, speed: 1 },
  expert:   { label: 'Expert',   perKmLane: 9.5, bold: 0.45, speed: 1.12 },
};

// The menu's four tiles (owner, 2026-11-22: three difficulties, not four traffic modes): FREE DRIVE, and the three timed
// runs EASY, MEDIUM and EXTREME. A difficulty is a traffic density and a crash rule; it is a run of its own (Speed
// Survival's rules) and never changes the saved `density`, which is the player's own Free Drive traffic.
//   Easy:    Light traffic (2.2 cars/km/lane) and a forgiving crash rule: the first two real crashes of a run are forgiven
//            (the run goes on; a crash still breaks the 60 s stretch of Fastest Minute); the third ends it.
//   Medium:  Moderate traffic (5): the normal rule, one real crash ends the run.
//   Extreme: Expert traffic (9.5, 45 % aggressive drivers) cruising 12 % faster; one real crash ends the run.
export type Difficulty = 'easy' | 'medium' | 'extreme';
export type Tile = 'free' | Difficulty;
export const DIFFICULTY: Record<Difficulty, { label: string; density: Density; speed: number; forgive: number; sub: string; line: string }> = {
  easy:    { label: 'Easy',    density: 'light',    speed: 1,    forgive: 2, sub: 'Room to run',  line: 'Light traffic, simulated. The first two crashes are forgiven; the third ends the run. Your Fastest Minute is your best 60 s average speed.' },
  medium:  { label: 'Medium',  density: 'moderate', speed: 1,    forgive: 0, sub: 'Find the gaps', line: 'Normal traffic, simulated: gaps close and open. A crash ends the run. Your Fastest Minute is your best 60 s average speed.' },
  extreme: { label: 'Extreme', density: 'expert',   speed: 1.12, forgive: 0, sub: 'Hold nerve',    line: 'Heavy traffic, simulated: aggressive drivers, cruising faster. A crash ends the run. Your Fastest Minute is your best 60 s average speed.' },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY) as Difficulty[];
export const TILE_IDS: Tile[] = ['free', ...DIFFICULTY_IDS];
export const tileOf = (v: unknown): Tile => (v === 'easy' || v === 'medium' || v === 'extreme' ? v : 'free');
// Free Drive's Offline / Online switch (owner, 2026-11-22): Online is the live-servers work, not built: it is labelled so and
// the game stays offline. When it exists, Free Drive Online starts with light traffic (owner, 2026-11-22 4:50 PM: "online
// servers default to low traffic"); offline Free Drive runs settings.density, Light since SETTINGS_V 6 (no picker).
export const FREE_DRIVE_ONLINE = { available: false, label: 'Online', note: 'coming soon: live servers', density: 'light' as Density };
// the traffic a tile's run starts with
export function trafficFor(tile: Tile, s: Pick<Settings, 'density'>, online = false): Density {
  if (tile !== 'free') return DIFFICULTY[tile].density;
  return online ? FREE_DRIVE_ONLINE.density : s.density;
}

export const MODES: Record<Mode, { label: string; blurb: string }> = {
  free:     { label: 'Free Drive',     blurb: 'All of Orange County\'s freeways, no clock. Take any interchange.' },
  survival: { label: 'Speed Survival', blurb: 'Near misses and clean passes over 100 mph build your points. A crash ends it (Easy forgives two).' },   // the three difficulties' run
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

// A new player starts on Retro Low (owner, 2026-11-16), on any device: the Retro style over Low's world. The first-run
// graphics check (Game.benchmark) still measures this device and saves what it holds (settings.ts saveBench), for a
// hint in Settings, but it never changes this preset: only the player's own pick in Settings does (qualityChosen).
export const DEFAULT_QUALITY: Quality = 'low';
export const DEFAULT_STYLE: Style = 'retro';

export function defaults(): Settings {
  return {
    quality: DEFAULT_QUALITY, adaptive: true, qualityChosen: false, showPerf: false, density: 'light', tile: 'free', handling: PROFILES.arcade.h, transmission: 'auto',
    master: 0.8, engine: 0.9, ambient: 0.7, fov: FOV_DEFAULT, showFps: false, corner: 'map', cornerSize: 1, start: 'I-405 North', exit: '', showTouch: false, time: 'day', weather: 'clear', driver: 'closer', presentation: 'm', skin: 1, character: '', packTest: false, music: 0.6, ultra: false, ultraTunnel: true, ultraShake: true, ultraMuffle: true,
    hudStyle: firstHud(), owner: false, style: DEFAULT_STYLE, look: 'ultra', theme: 'auto', paints: {}, wheels: {}, radioFavs: [], v: SETTINGS_V,
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
    // the ABS | TCS switches' saved choices (2026-11-23 to 11-24): gone, assistsFor decides both now
    delete old.abs; delete old.tcs;
    const from = typeof v.v === 'number' && Number.isFinite(v.v) ? v.v : 1;
    // the field of view is one fixed value since the slider left Settings (2026-11-24): whatever was saved reads as it
    const fov = FOV_DEFAULT;
    // Retro Low became the default at SETTINGS_V 3: saved before it without the player's own pick, the preset moves to
    // Low + Retro, once (written back at this version, so a later change of theirs stays). Saved before it with their
    // own pick (qualityChosen): their quality and style as they were (a style never saved reads as the old 'standard')
    const chose = v.qualityChosen === true, toRetro = from < 3 && !chose;
    const style: Style = toRetro ? 'retro' : v.style === 'retro' || v.style === 'standard' ? v.style : from < 3 ? 'standard' : d.style;
    let quality: Quality = toRetro ? 'low' : v.quality && v.quality in QUALITY ? v.quality : d.quality;
    let style2: Style = style, adaptive = v.adaptive !== false;
    // Graphics is two choices at SETTINGS_V 4: the nearer of Retro Low and Ultra (a pick made on any preset)
    if (from < 4) {
      if (quality === 'high' || quality === 'ultra') { quality = 'ultra'; style2 = 'standard'; adaptive = true; }
      else { quality = 'low'; style2 = 'retro'; }
    }
    const s: Settings = {
      ...d, ...v,
      fov, v: SETTINGS_V,
      quality,
      // (a saved 'none', Zero traffic's empty freeway, reads as Light: the nearest traffic there still is)
      // (and since SETTINGS_V 6 a density saved before it reads as Light too: Free Drive's traffic is Light, no picker)
      density: from < 6 || v.density === 'none' ? 'light' : v.density && v.density in DENSITY ? v.density : (v.density as string) === 'medium' ? 'moderate' : d.density,
      tile: tileOf(v.tile),
      corner: v.corner === 'sky' || v.corner === 'off' ? v.corner : 'map',
      start: STARTS.some((x) => x.label === v.start) ? v.start! : d.start,
      exit: typeof v.exit === 'string' ? v.exit : '',
      time: (['live', 'sunrise', 'day', 'sunset', 'night'] as const).includes(v.time as TimeOfDay) ? v.time! : d.time,
      weather: (['clear', 'cloudy', 'rain', 'fog', 'mist', 'changing'] as const).includes(v.weather as Weather) ? v.weather! : d.weather,
      driver: v.driver === 'ace' || v.driver === 'wrench' ? v.driver : 'closer',
      presentation: v.presentation === 'f' ? 'f' : 'm',
      skin: Math.max(0, Math.min(4, Number(v.skin ?? d.skin) || 0)),
      character: isCastId(v.character) ? v.character : '',
      packTest: v.packTest === true,
      transmission: 'auto',   // SETTINGS_V 5: automatic for everyone, a saved 'manual' included
      hudStyle: v.hudStyle === 'minimal' || v.hudStyle === 'modern' ? v.hudStyle : d.hudStyle,
      handling: typeof v.handling === 'number' && Number.isFinite(v.handling) ? Math.min(1, Math.max(0, v.handling)) : d.handling,
      owner: v.owner === true,
      adaptive,
      qualityChosen: chose,
      showPerf: v.showPerf === true,
      style: style2,
      // the look follows the graphics choice (SETTINGS_V 5): Ultra is the realistic look, Retro Low the retro one
      look: lookFor(graphicsOf({ quality })),
      theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'auto',
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
