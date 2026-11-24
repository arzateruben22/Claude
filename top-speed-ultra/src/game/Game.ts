// Runs the whole thing: renderer, scene, the 120 Hz simulation, the real Orange County freeway network, cameras,
// modes, sound, navigation, and the numbers the HUD shows.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Settings, QUALITY, DENSITY, Mode, modeOf, STARTS, TimeOfDay, Weather, loadBest, saveBest, VERSION, loadSettings, DIFFICULTY, FREE_DRIVE_ONLINE, trafficFor, FOV_DEFAULT, assistsFor } from './settings';
import type { Difficulty } from './settings';
import { MinuteMeter, DriftTracker, bestOf, bestsFor, recordBest, recordDrift, driftBest, driftBests, migrateBests, shareLine, round1 } from './bests';
import type { Board, Kind, Placed } from './bests';
import { presetFor, retroOn, GOV_FLOOR, loadBench, saveBench, loadDisplay, saveDisplay } from './settings';
import type { QualityPreset, Quality, Density, BenchPick } from './settings';
import { FrameGovernor, Rung, T60, T30, STEP as GOV_STEP, capPeriod } from './render/governor';
import { RetroStyle } from './render/style';
import { Input, Controls } from './input';
import { configureTextures } from './textures';
import { Network, Hit, Sign, Overpass, GANTRY_AHEAD, GANTRY_MIN_S } from './world/Network';
import { Path, Junction, ORIGIN, STEP } from './world/Path';
import { Roads } from './world/Roads';
import { Terrain } from './world/Terrain';
import { CarPhysics, SPEC } from './vehicle/Physics';
import { PlayerCar } from './vehicle/PlayerCar';
import { HyperAbility, planHop, HOP, TANK, HopVehicle, hopCostFor, hopNeedAt } from './vehicle/HyperAbility';
import { ThrustJets } from './vehicle/ThrustJets';
import { CAR_IDS, shapeFor } from '../preview/car-shape';
import type { CarId } from '../preview/car-shape';
import { buildReveal, RevealStage, RevealKind, REVEAL_SECONDS, WAKE_ONLY_SECONDS } from '../preview/reveal';
import { WAKE } from '../preview/car-wake';
import { carPaint } from '../preview/car';
import { FOUNDER_CAR, FOUNDER_UNTIL, GLACIER_SILVER, FOUNDER_ICE, founderSerial, setFounderSerial, plaqueLine, plaqueNumber, finishesFor, paintFor as founderPaint } from './founder';
import { Traffic, PlayerView } from './traffic/Traffic';
import { Environment } from './env/Environment';
import { AudioEngine } from './audio/AudioEngine';
import * as P from './road/props';
import { Radio } from './audio/Radio';
import { RouteChevrons } from './road/chevrons';
import { clamp, damp, lerp, smoothstep, MPH } from './util';
import { Leaderboard, Run, recordRun } from './records';
import { ProfileBook, Earned } from './profile';
import { Ability, ABILITIES, DRIVERS, characterLook } from './drivers';
import { playableCharacter } from './castPack';
import { CARS, carById, applyCar, paintFor, paintForEdition, wheelFor, earnCapFor, tuneFor } from './cars';
import { settle, characterById, jobText, type RunFacts, type Job } from './story';
type ErrandJob = Extract<Job, { kind: 'errand' }>;
import type { TrafficCar } from './traffic/Traffic';
const fmtClock = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
import { equippedPaint } from '../store/locker';
import { onStoreChange } from '../store/bus';
import { syncGarage, serialOf } from '../store/entitlements';
import { VENUES, Venue, VenueExit, VenueRamp, venueByName, venueRamps, toStreet, venueQuality, venueClock } from './venues';
import { mountVenue, fade } from './onfoot';
import { Progress, ProgressEvent, TickIn, tierOf, TIER_CASH, CAR_MILES, MEMBERSHIPS, passportVenue, GOAL_COPY, SIT_IDLE_SECS, VENUE_IDLE_SECS } from './progress';
import { mountVenueCard, VenueCard } from '../ui/progressVenue';
import { storeCars } from '../store/entitlements';
import type { Mounted } from '../onfoot/embed';

export type CamMode = 'cockpit' | 'hood' | 'chase' | 'free' | 'cinematic';
const CAMS: CamMode[] = ['cockpit', 'hood', 'chase', 'free', 'cinematic'];
const CAM_LABEL: Record<CamMode, string> = { cockpit: "Driver's seat", hood: 'Hood', chase: 'Chase', free: 'Free look', cinematic: 'Cinematic' };
// The cinematic camera (the style library's DRV_CINEMATIC, PROJECT_OC_STYLE_GUIDE.md): a cycle of tracking shots cut
// hard from one to the next, every one close to the car so it never needs to know where the walls are. In the car's
// frame: f metres ahead, s to the side (+ the driver's left), y up; looking at the car's middle plus `at` metres ahead;
// a long lens. The menu's attract drive runs it, and its hero shot sits the car right of centre, clear of the rail.
interface Shot { f: [number, number]; s: number; y: number; at: number; fov: number; len: number }
const SHOTS: Shot[] = [
  { f: [-9.0, -7.0], s: 3.4, y: 1.35, at: 5, fov: 32, len: 8 },     // the hero: a rear three-quarter, the freeway running off ahead under the sky (a front view looked back at a sound wall)
  { f: [-11, -9], s: -3.8, y: 1.9, at: 6, fov: 36, len: 6 },        // a high rear three-quarter from the right, the road ahead (a profile shot looked across at the sound wall)
  { f: [-6.4, -5.6], s: -2.7, y: 0.6, at: 1.8, fov: 38, len: 6 },   // a low rear three-quarter from the other side
  { f: [-15, -12], s: 0, y: 8.5, at: 10, fov: 44, len: 6 },         // the drone, high behind
];
const DT = 1 / 120;
// the governor's traffic step (SMOOTH): `steps` density levels lighter, never under Light (no traffic at all would
// change the drive, not just its cost)
const DENS_ORDER: Density[] = ['none', 'light', 'moderate', 'heavy', 'expert'];
const govDensity = (d: Density, steps: number): Density => (steps > 0 && DENS_ORDER.indexOf(d) >= 2 ? DENS_ORDER[DENS_ORDER.indexOf(d) - steps] : d);
// Auto-drive's cruise: the attract drive's own (31 m/s, about 69 mph, a posted-limit pace), well under every car's top
// speed in either tune; the autopilot slows from it for traffic and curves
const AUTO_CRUISE = 31;
const MISS_PR = { s: 0, d: 0 };   // missedHandOff's projection, reused
const LANE_HINT_M = 3200;          // the lane hint shows this far before a hand-off (about 2 mi)
const OWNER_CAR = 'tsu.ownerCar';  // owner mode's car (localStorage), never part of the profile
const FAST = 100 / MPH;            // 100 mph: where Speed Survival starts counting
const MANUAL_HOLD_S = 4;            // a Q/E or paddle shift holds the gear this long before automatic takes back over
export const TUNNEL_FROM = 150 / MPH;   // Ultra Realism's tunnel vision begins here (m/s)
export const CORNER_PX = [112, 150, 196];
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const HOP_SAY = 2500;              // a hop refusal's reason stays on the HUD's strip and the car's cluster this long (ms)
const ARRIVE_M = 80;               // a venue's ramp: how far before the street the fade parks you (the plans' 80 m)
// the seat view on a portrait screen: its horizontal field of view (degrees), the cap on its vertical base (degrees,
// before the player's setting and the speed's widening) and where the horizon sits (from the top)
const SEAT_HFOV_P = 50, SEAT_VMAX_P = 76, SEAT_HORIZON_P = 0.31, DEG = Math.PI / 180;
// the seat view's widening with speed: flat out it reaches the width it always had (the old +10 and its 4 degrees at
// speed, +14), so the fixed +13 (settings.ts FOV_DEFAULT, 2026-11-24) shows more cockpit at a cruise and the same bonnet
// flat out (the suite's iPhone hood checks are calibrated there)
const SEAT_FOV_FLAT_OUT = 14;
// read when it's needed (the Founder Edition's wake-up and reveal), so a change in the system setting is honoured
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Hud {
  speed: number; gear: string; rpm: number; rpmFrac: number; distance: number; score: number; combo: number;
  fps: number; mode: Mode; auto: boolean; cam: string; best: number; overtakes: number;
  road: string; next: string; nextDist: number; wrongWay: boolean; streak: number; bestStreak: number; nearMisses: number; top: number;
  ability: string; abilityOn: number; abilityCool: number;
  tunnel: number; radio: string;
  // the adaptive HUD (U1): the compass bearing the car points along (degrees from north, clockwise), the simulated air
  // temperature (°F) for the clock chip, and which way the next manoeuvre goes for the nav bubble ('' with no route)
  heading: number; tempF: number; turn: Turn;
  // the navigation card (U2): what to do ('Keep right') and the road it leads to; the next exit along this road with its
  // real sign text, and whether it's the one the route takes (on a ramp, with no exits along it, the sign it was taken
  // from); and the destination card: the destination road, how far it
  // is along the route, the time that takes at your pace (s; -1 when you aren't moving enough to say) and the traffic
  // setting (simulated, and labelled so). All '' with no route.
  navAct: string; navTo: string; exitText: string; exitMine: boolean; onSign: string; dest: string; destDist: number; eta: number; traffic: string;
  errand: { exit: string; left: number; dist: number } | null;   // a story errand: its exit, seconds left, metres to its sign (-1 off its road)
  // the camera in use ('back' while looking back) and whether the car's own cluster shows the live speed and gear (the
  // hypercar's display): together they let the HUD drop its duplicate speed in the seat view
  view: CamMode | 'back'; liveCluster: boolean;
  // the condensed HUD: the brake pedal (0..1; a hard stop wakes the tucked map), the time the sky shows ('12:30 PM') and
  // where the temperature comes from ('simulated'), for the pause screen, the phone and the desktop map caption
  brake: number; clock: string; tempNote: string;
  // following the route (owner, 2026-11-01): Auto-drive offered (a route in Free Drive) and on; and the lane hint
  // before a hand-off: the current road's lanes left to right, '1' for each one the route leaves from ('' with none)
  autoOffer: boolean; autoOn: boolean; lanes: string;
  // the venues (Phase 3a): on one of a venue's exit ramps, its name for the prompt (tap to park there); parked at a
  // venue, its name (Get out replaces the pedals); '' otherwise
  venuePrompt: string; parked: string;
  // parked: what happened, plainly ("Drove Orangewood Ave to Lot 57 · street driving isn't built yet"), kept on screen
  parkedNote: string;
  // the OC Hypercar: which tune runs ('' for another car), and its own systems (live only on the Unleashed tune in
  // Free Drive): the tank (0..1, the jump's gas and Ground Lock's), the fans, and the hop's state in a word or two
  tune: string; thrustLive: boolean; tank: number; groundLock: boolean; hop: string;
  // the drift readout (Physics.drift): the body's slip angle in degrees (+ when the nose points left of the way the car
  // travels), whether it counts as a drift now, and the chain's clock in seconds (it holds half a second of grace
  // between slides, so the readout stays up through a transition)
  driftAngle: number; driftOn: boolean; driftTime: number;
  // the run's score meter (bests.ts): a difficulty run's Fastest Minute (the live 60 s average against this device's best
  // on the board the run counts on), or Free Drive's drift readout; kind '' on the menu
  bests: BestsHud;
}
export interface BestsHud {
  kind: Kind | ''; board: Board; diff: Difficulty | '';
  avg: number; t: number; full: boolean; runBest: number;          // Fastest Minute: the live average, seconds in the window, whether it is a full 60 s, the run's best
  angle: number; chain: number; chainT: number; chainBest: number; // Drift: the slip angle, the running chain's points and seconds, the run's best chain
  best: number;                                                    // this device's best on the board (before this run)
  counts: boolean;                                                 // false once Adaptive quality eased the traffic: the run no longer counts
}
// what a run's end says about its score (the end-of-run card, App.tsx BestsCard)
export interface RunBests {
  kind: Kind; diff: Difficulty | null; board: Board; value: number;    // this run's score on its board (0: no full minute, or no chain); diff null: Free Drive's Best drift
  counted: boolean; why: string;                                   // false: the run did not count, and why
  placed: Placed | null;
}
export type Turn = 'left' | 'right' | 'ahead' | '';
// signs that are no way off to a place (a weigh station, a rest area, a vista point): never a home's nearest exit
const NOT_AN_EXIT = /weigh|inspection|rest area|vista point|scales?\b/i;
// a real exit on a carriageway, for "start at your exit" (key goes into Settings.exit)
export interface Exit { key: string; text: string; s: number; mi: number; side: 'L' | 'R' }
// what a feedback report says about the device and this drive: nothing personal, nothing sent by the game
export interface Report {
  version: string; host: string; ua: string; screen: string; pointer: 'touch' | 'mouse'; cores: number; memoryGB: number | null; gpu: string;
  quality: string; adaptive: boolean; pixelRatio: number; buffer: string; fps: number; calls: number; tris: number; textures: number;
  mode: Mode; attract: boolean; road: string; mph: number; density: string; cars: number; runSeconds: number;
  time: string; weather: string; ultra: boolean;
}
export interface Result {
  bests?: RunBests;
  mode: Mode; score: number; distance: number; overtakes: number; top: number; reason: string; road: string; best: number; newBest: boolean; time: number;
  nearMisses: number; bestStreak: number; collisions: number; board: Leaderboard;
  // the car the run was in and, for the OC Hypercar, its tune ('Unleashed' in Free Drive, 'Race tune' in the scored
  // modes; '' for every other car): the run card marks the Founder Edition's runs
  car: string; tune: string; edition?: 'standard';   // 'standard': the earned OC Hypercar (the run card then has no Founder Edition badge)
  jobs?: { from: string; job: string; credits: number }[];   // story jobs this run completed (story.ts), already paid
  // what the run added to the miles, Road Points and cash (progress.ts), and where Founders' Road stands
  progress?: { miles: number; points: number; cash: number; founders: string; badges: string[] };
}
export interface GameEvents {
  hud: (h: Hud) => void;
  toast: (text: string, kind?: 'good' | 'bad' | 'info') => void;
  over: (r: Result) => void;
  pause: (on: boolean) => void;
  /** the loading screen on or off; `progress` (0..1) when the work is measured, else the bar runs on its own */
  loading: (on: boolean, text?: string, progress?: number) => void;
  context: (lost: boolean) => void;
  hudToggle: (show: boolean) => void;
  corner: (mode: Settings['corner']) => void;
  /** on foot at a venue (the game's UI hides; the venue's page is up) or back in the car */
  foot?: (on: boolean) => void;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly skyCam = new THREE.PerspectiveCamera(50, 1, 5, 2500);
  readonly input: Input;
  readonly audio = new AudioEngine();
  private env: Environment;
  net!: Network;
  private roads!: Roads;
  private terrain!: Terrain;
  private traffic!: Traffic;
  private car: PlayerCar;
  readonly phys = new CarPhysics();
  path!: Path;                       // the road you're on
  private lastMain: Path | null = null;
  route: Junction[] = [];            // hand-offs still to make, for the navigator and the autopilot
  routeTarget: Path | null = null;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private gtao: GTAOPass | null = null;
  private outputSat: THREE.IUniform<number> | null = null;   // the output pass's saturation, under cloud
  private grade: ShaderPass | null = null;                    // Ultra's grade: vignette, edge aberration, film grain
  private settings: Settings;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private paused = false;
  private attract = true;
  private attractAtmo = true;        // the menu shows the chosen car's atmosphere, until the player touches time or weather
  private shown: { time: TimeOfDay; weather: Weather } | null = null;   // what the environment was last set to
  private mode: Mode = 'free';
  private cam: CamMode = 'cockpit';
  private camBlend = 1;
  private camFrom = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  private chasePos = new THREE.Vector3();
  private chaseFwd = new THREE.Vector3(0, 0, 1);
  private cineT = 0; private cineShot = 0;   // the cinematic camera's clock and its current shot
  private head = new THREE.Vector3();
  private shake = 0;
  private renderScale = 1;           // the preset's render scale times the governor's share of it (stats.scale)
  // ------------------------------------------------------------------ the frame-time governor (SMOOTH)
  // the preset in force, as a live copy the world reads (Roads, Terrain hold it): the governor's draw distance and
  // scenery density land on it without a rebuild (scenery density on the tiles built from then on)
  private live: QualityPreset = { ...QUALITY.low };
  readonly gov = new FrameGovernor((level) => this.applyGov(level));
  govFeed = true;                    // the frame loop feeds the governor (a test turns it off to feed it its own frame times)
  private govScale = 1;              // the governor's share of the preset's resolution (GOV_FLOOR..startScale)
  private startScale = 1;            // where it starts: 1, or the graphics check's pick for this preset
  private govTraffic = 0;            // traffic density steps the governor took off
  private benchPick: BenchPick | null = loadBench();
  // what this device's display showed on earlier visits and in the graphics check's rounds (seeded into the governor in
  // the constructor; saved again when it learns more: adapt)
  private display = loadDisplay();
  private benchQ: Quality | null = null;   // the graphics check's preset while it runs (its frames, not the player's)
  private benchScale = 1;
  private bench = { on: false, n: 0, sum: 0, slow: 0, work: 0 };
  private workMs = 0; private lastDrawn = 0;
  injectMs = 0;                      // test hook: artificial work added to every frame (ms), the governor sees it as load
  private perfCalls = 0; private perfTris = 0;
  private fpsN = 0; private fpsT = 0; private fps = 60;
  private hudT = 0;
  private hudOn = true;
  private mapCanvas: HTMLCanvasElement | null = null;
  private mapT = 0;
  // run state
  private distance = 0; private score = 0; private combo = 1; private comboT = 0; private overtakes = 0;
  private top = 0; private over = false;
  // the run's scores (bests.ts): Fastest Minute's window, the drift chain, and the board and traffic mode the run counts on
  private manualUntil = 0;
  readonly bests = { minute: new MinuteMeter(), drift: new DriftTracker(), diff: null as Difficulty | null, board: 'open' as Board, stored: 0, toasted: false, eased: false, crashes: 0, forgiven: 0, forgiveUntil: 0, banked: true };
  // the traffic a difficulty's run starts with (null: Free Drive's own, settings.density) and how fast it cruises
  private runDiff: Difficulty | null = null;
  private get density(): Density { return this.runDiff ? DIFFICULTY[this.runDiff].density : this.settings.density; }
  private streak = 0; private bestStreak = 0; private nearMisses = 0; private collisions = 0; private wrongWay = false;
  private scrape = 0;
  private ctxLost = false;
  private steps = 0;
  private cands: Hit[] = [];
  readonly profile = new ProfileBook();
  // the miles, Road Points, cash bonuses, venue passport and daily goals (progress.ts): saved on this device. The wallet is
  // the profile's credits (the one currency, shown as cash): earned only, never sold.
  readonly progress = new Progress((() => { try { return localStorage; } catch { return null; } })(),
    { cash: () => this.profile.p.credits, add: (n) => { this.profile.p.credits = Math.max(0, this.profile.p.credits + n); } }, Date.now, this.profile.p.vehicles);
  private offStore: () => void = () => {};
  ability = new Ability(ABILITIES.clear);
  private worldScale = 1;            // Focus Time slows the world (not you)
  // the driver's ability never changes the world's pace while the car is in a hop: the hop's arc is planned for the
  // traffic at the pace it took off in, so a Focus Time that runs out in the air holds the world at 0.7x until
  // touchdown (abilityEndHeld), and one asked for in the air starts on touchdown (focusOnLand)
  private abilityEndHeld = false;
  private focusOnLand = false;
  private gripBoost = 1;
  private carGrip = 1;
  // the OC Hypercar's own systems (Ground Lock, and THRUST's one job: the Thrust Hop) and the hop's jets; a camera dip on a landing
  readonly hyper = new HyperAbility();
  private jets!: ThrustJets;
  private dip = { a: 0, t: 1 };
  private fulls = 0;
  // the last hop, for the HUD and the tests: its arc, what it went over, the apex and the air time seen, the landing
  // (`short`: a plain hop that came down short of a vehicle too far ahead to clear; `warn`: it came down with traffic
  // close ahead), and the last refusal (`block`: the vehicle behind the plan's refusal, its distance ahead and to the side
  // in this road's frame, its speed, and whether it was on another road projected onto this one)
  hopLog = { n: 0, peak: 0, T: 0, cost: 0, over: '' as string | null, short: null as string | null, warn: false, apex: 0, air: 0, landV: 0, landMph: 0, refused: '', refusedN: 0,
    refusedAt: -1e9, block: null as { kind: string; ds: number; dd: number; v: number; other: boolean } | null };
  private driving = 'rossini-gt';    // the car applyCarChoice last put into the physics and the scene
  private ownerPick: string | null | undefined;   // owner mode's car, kept on this device apart from the profile (undefined: not read yet)
  // a story errand (story.ts): set from the phone before a Free Drive, live during it (the sign, the time left)
  private pendingErrand: ErrandJob | null = null;
  errand: { job: ErrandJob; sign: Sign; t: number; done: boolean } | null = null;
  readonly radio = new Radio(() => this.audio.context, () => this.audio.musicBus, () => this.audio.noiseBuffer);
  private tunnel = 0;
  private prof = { t: 0, dist: 0, paid: 0, flush: 0 };
  private pace = 0;                  // your speed over the last few seconds (m/s), for the navigation card's time estimate
  // the blue chevrons on the road along the route (U2)
  readonly chevrons = new RouteChevrons({ diverge: (p, j) => this.sideOf(p, j), merge: (r, j) => this.sideOfMerge(r, j) });
  // the distance-earnings cap in m/s (cars.ts earnCapFor: the hypercar Unleashed in Free Drive), 0 for none
  private earnCap = 0;
  frames = 0;
  switches = 0;                      // how many times you've moved from one road to another (for tests)
  visited = new Set<string>();       // freeways driven this session (for tests and the profile)

  constructor(private host: HTMLElement, settings: Settings, private ev: GameEvents) {
    this.settings = settings;
    this.seedDisplay();
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.setAttribute('aria-label', 'The view from the driver\'s seat on an Orange County freeway');
    host.appendChild(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    configureTextures(QUALITY[settings.quality].texture, this.renderer.capabilities.getMaxAnisotropy());
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);
    this.scene.add(this.camera);
    this.env = new Environment(this.scene, this.renderer);
    this.env.set(settings.time, settings.weather, true);
    this.car = new PlayerCar();
    this.scene.add(this.car.root);
    this.scene.add(this.chevrons.mesh);
    this.jets = new ThrustJets(settings.quality === 'high' || settings.quality === 'ultra' ? 24 : 12);
    this.scene.add(this.jets.mesh);
    this.driving = this.carId;
    this.applyDriver();
    // the earned cars first: syncGarage drops any store-only car (the OC Hypercar) the profile doesn't know it owns, and
    // would reset the chosen car to the first one, so a boot sync must see the earned Hypercar already in place
    this.profile.setEarnedCars(this.progress.earnedCars());       // the cars miles and Founders' Road have opened, outside the slot count
    syncGarage(this.profile);                                     // a car from the store, outside the slot count
    this.progress.on((e) => this.onProgress(e));
    setFounderSerial(serialOf('plaque-founder-edition'));         // the plaque's number: the server's, on the entitlement row
    this.applyCarChoice();
    // a store paint equipped or no longer owned; a store car bought, restored on sign-in, refunded or signed out (the
    // car you drive changes on the menu at once, and mid-run at the next start, like the garage)
    this.offStore = onStoreChange(() => { setFounderSerial(serialOf('plaque-founder-edition')); if (syncGarage(this.profile) && this.attract) this.applyCarChoice(); else this.configureCar(); });
    this.syncAtmosphere(true);         // the menu opens in the car's atmosphere, no fade from the settings' sky
    this.input = new Input(canvas);
    // (after three's own listeners, added in the renderer's constructor: by the time ours runs it has a new context)
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestore);
    addEventListener('resize', this.onResize);
    // the stage's own size, too: iOS can lay out a turned phone or a resized viewer's iframe after its resize event has
    // fired (the handler reads the old size), which left the drawing buffer at the old shape, stretched to the new one
    if (typeof ResizeObserver === 'function') { this.resizeObs = new ResizeObserver(this.onStageResize); this.resizeObs.observe(host); }
    document.addEventListener('visibilitychange', this.onVisibility);
    // test hook: the sky camera's fallback from the start (renderSkyDirect); window.__game.setSkyFallback does it live
    try { if (new URLSearchParams(location.search).get('skyfallback') === '1') { this.setSkyFallback(true); this.skyCheck = 'forced (?skyfallback=1)'; } } catch { /* no query */ }
  }
  private resizeObs: ResizeObserver | null = null;

  // ----------------------------------------------------------------------------------------- set up
  async init() {
    this.ev.loading(true, 'Loading Orange County');
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch { /* fonts are optional */ }
    this.net = await Network.load();
    this.buildWorld();
    this.applyQuality();
    this.onResize();
    this.input.attach();
    this.startAttract();
    const warm = this.warmNeeded();
    await this.prebuild('Building the freeway', 0, warm ? 0.6 : 1);
    await this.warmUp('Building the freeway', 0.6, 1);           // High and Ultra: the menu's drive ready before it shows
    this.ev.loading(false);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private buildWorld() {
    if (this.roads) { this.roads.clear(); this.scene.remove(this.roads.group); }
    if (this.terrain) { this.terrain.clear(); this.scene.remove(this.terrain.group); }
    this.syncLive();
    const q = this.live;                 // the live preset: the governor's draw distance and scenery reach the world
    this.roads = new Roads(this.net, q); this.scene.add(this.roads.group);
    this.terrain = new Terrain(this.net, q); this.scene.add(this.terrain.group);
    if (!this.traffic) { this.traffic = new Traffic(this.net); this.scene.add(this.traffic.group); }
    this.traffic.viewAhead = q.drawDistance * 0.95;
    this.env.setFlareOccluders([this.roads.group, this.traffic.group], [this.terrain.group], (o, d) => this.car.sunBlocked(o, d));
    this.applyDensity();
  }
  private applyDensity() {
    const d = DENSITY[govDensity(this.density, this.govTraffic)];
    this.traffic.level = { perKmLane: d.perKmLane, bold: this.govTraffic ? DENSITY[this.density].bold : d.bold, speed: this.govTraffic ? DENSITY[this.density].speed : d.speed };
  }

  // build everything in view before showing it (yielding now and then so the page stays alive). The loading bar runs
  // from..to as the chunks and tiles in reach are built (what is left is counted at each yield: Roads.pending, Terrain.left)
  private async prebuild(text: string, from = 0, to = 1) {
    this.ev.loading(true, text, from);
    const p = this.phys, h = p.psi;
    let done = 0;
    for (let i = 0; i < 600; i++) {
      const a = this.roads.update(p.x, p.z, Math.sin(h), Math.cos(h), 6), b = this.terrain.update(p.x, p.z, 3);
      if (a === 0 && b === 0) break;
      done += a + b;
      if (i % 4 === 3) {
        const left = this.roads.pending(p.x, p.z) + this.terrain.left;
        this.ev.loading(true, text, from + (to - from) * (done / Math.max(1, done + left)));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    this.ev.loading(true, text, to);
  }

  // ----------------------------------------------------------------------------------------- the warm-up
  // (owner, 2026-11-24: "make sure it doesn't lag when choosing ultra ... have everything set and working smoothly before
  // the game starts playing ultra"). Measured on SwiftShader (PROJECT_OC_TECHNICAL_NOTES, "The warm-up"): what landed
  // on the first driven frames of an Ultra run was not chunk building (the prebuild already builds everything within
  // the draw distance) but first-use work on the GPU: the cockpit's and the mirrors' first draws, the post passes' and
  // mirrors' render targets, the geometry buffers three uploads at a first draw, and the GPU's own pipeline for each
  // new draw state, which a browser builds at the first draw, not at the shader compile. So on the presets with post
  // (High and Ultra) that work is done behind the loading screen, in order: every texture the scene's materials hold
  // is uploaded (initTexture, the hidden parts too); every material's program is compiled (compileAsync, in parallel
  // where the browser can) for the render target the main view draws into (three keys a program on its output's tone
  // mapping and colour space: the composer's linear target, not the screen); then one hidden frame from every camera
  // View cycles to (the shadow map and its depth materials, the mirrors, the post passes and their targets at the final
  // size, the GPU's pipelines), each finished on the GPU (a one-pixel read) before the bar moves on. The frame loop
  // draws nothing meanwhile (`warming`), and the governor doesn't see the gap. Low, Medium and Retro skip it (no post:
  // their start is unchanged). Warm-ups run one at a time (warmChain).
  private warming = 0;
  private starts = 0;                // runs started (a switch's sheet doesn't take down a newer run's loading screen)
  // a new preset mid-drive: the drive stays as it is (paused under Settings) behind a "Preparing Ultra" sheet until the
  // warm-up is done; the frame loop draws nothing meanwhile
  private async prepareSwitch() {
    if (!this.warmNeeded()) return;
    const text = `Preparing ${presetFor(this.settings).label}`, run = this.starts;
    this.ev.loading(true, text, 0);
    await this.warmUp(text, 0, 1);
    if (run === this.starts) this.ev.loading(false);
  }
  private warmChain: Promise<void> = Promise.resolve();
  /** the last warm-up (tests): why, how long, programs before and after, textures, the views drawn */
  warmLog: { why: string; ms: number; programs: [number, number]; textures: number; views: string[] } | null = null;
  warmNeeded() { const q = this.preset(); return q.post && !this.style; }
  /** (tests) resolves once every warm-up asked for so far is done */
  warmIdle(): Promise<void> { return this.warmChain; }
  private warmUp(text: string | null, from = 0, to = 1, views: CamMode[] = CAMS): Promise<void> {
    const job = this.warmChain.then(() => this.warmJob(text, from, to, views)).catch((e) => console.warn('warm-up', e));
    this.warmChain = job;
    return job;
  }
  private async warmJob(text: string | null, from: number, to: number, views: CamMode[]) {
    if (!this.warmNeeded() || this.ctxLost || !this.net || !this.roads) return;
    const r = this.renderer, gl = r.getContext(), t0 = performance.now(), p0 = r.info.programs?.length ?? 0;
    const say = (k: number) => { if (text) this.ev.loading(true, text, from + (to - from) * k); };
    const breathe = () => new Promise<void>((res) => setTimeout(res, 0));
    const px = new Uint8Array(4);
    const finish = () => { try { r.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch { /* a lost context */ } };
    this.warming++;
    try {
      // the scene as the first frame will have it: the lamps and beams for this hour and weather, and the environment
      // map for this sky (a run's start sets its atmosphere: the map would otherwise be made on its first seconds)
      this.weatherTick(0);
      this.env.flushEnv();
      // 1. textures (a traffic class not on the road yet, the cockpit while the view is outside: hidden, still uploaded)
      const tex = new Set<THREE.Texture>();
      const add = (v: unknown) => {
        const t = v as (THREE.Texture & { isRenderTargetTexture?: boolean }) | null;
        if (t && t.isTexture && !t.isRenderTargetTexture && t.image) tex.add(t);
      };
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!m) return;
        for (const mm of Array.isArray(m) ? m : [m]) {
          const rec = mm as unknown as Record<string, unknown>;
          for (const k in rec) add(rec[k]);
          const u = (mm as THREE.ShaderMaterial).uniforms;
          if (u) for (const k in u) add(u[k]?.value);
        }
      });
      add(this.scene.environment); add(this.scene.background);
      let i = 0;
      for (const t of tex) {
        r.initTexture(t);
        if (++i % 12 === 0) { say((0.25 * i) / tex.size); await breathe(); if (this.ctxLost) return; }
      }
      say(0.25); await breathe();
      // 2. programs, for the target the main view draws into (the composer's; the live mirrors draw into the same kind)
      const prev = r.getRenderTarget();
      r.setRenderTarget(this.composer ? this.composer.renderTarget1 : null);
      let compiled: Promise<unknown>;
      try { compiled = r.compileAsync(this.scene, this.camera); } finally { r.setRenderTarget(prev); }
      await compiled;
      if (this.ctxLost) return;
      say(0.55); await breathe();
      // 3. a hidden frame from each camera (on the menu its own film camera only), finished on the GPU
      const list: CamMode[] = this.attract ? ['cinematic'] : views;
      const keep = { cam: this.cam, blend: this.camBlend, free: this.input.freeLook, p: this.camera.position.clone(), q: this.camera.quaternion.clone(), fov: this.camera.fov,
        near: this.camera.near, chase: this.chasePos.clone(), fwd: this.chaseFwd.clone(), cineT: this.cineT, cineShot: this.cineShot, dip: this.dip.t };
      let mine: CamMode | null = null;                           // the camera this warm-up put in (a View press meanwhile wins)
      try {
        for (let k = 0; k < list.length; k++) {
          if (mine !== null && this.cam !== mine) break;           // the camera was changed while this one yielded
          this.cam = mine = list[k]; this.camBlend = 1; this.input.freeLook = list[k] === 'free';
          this.updateCamera(1);                                  // (a whole second: the chase and film cameras settle where they'd be)
          this.draw(performance.now(), 0);
          finish();
          say(0.55 + (0.45 * (k + 1)) / list.length);
          await breathe();
          if (this.ctxLost) return;
        }
      } finally {
        if (mine === null || this.cam === mine) { this.cam = keep.cam; this.camBlend = keep.blend; this.input.freeLook = keep.free; }
        this.camera.position.copy(keep.p); this.camera.quaternion.copy(keep.q); this.camera.fov = keep.fov; this.camera.near = keep.near; this.camera.updateProjectionMatrix();
        this.chasePos.copy(keep.chase); this.chaseFwd.copy(keep.fwd); this.cineT = keep.cineT; this.cineShot = keep.cineShot; this.dip.t = keep.dip;
        const v = this.view3(); this.car.setOutsideView(!(v === 'cockpit' || v === 'free'));
      }
      this.warmLog = { why: text ?? 'quiet', ms: Math.round(performance.now() - t0), programs: [p0, r.info.programs?.length ?? 0], textures: tex.size, views: list };
    } finally {
      this.warming--;
      this.lastDrawn = 0;                                        // the next frame's interval isn't the loading screen's
      this.last = performance.now();
    }
  }

  findMain(label: string) { return this.net.mains.find((m) => m.label === label) ?? this.net.mains[0]; }
  // every real exit on a carriageway, from the guide signs in the map data, in order along the road
  exitsFor(label: string): Exit[] {
    const out: Exit[] = [], seen = new Set<string>();
    for (const g of this.net.signs) {
      if (!g.path.main || g.path.label !== label) continue;
      const key = `${label} @ ${Math.round(g.s)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, text: g.text.join(' / '), s: g.s, mi: g.s / 1609.344, side: g.side });
    }
    return out.sort((a, b) => a.s - b.s);
  }
  // the real exit nearest a place (a home, homes.ts): its carriageway, its Settings.exit key, and how far its sign is
  // from the place in metres. Every direction is considered; the nearest sign wins.
  nearestExit(x: number, z: number): { label: string; exit: Exit; dist: number } | null {
    let best: { label: string; exit: Exit; dist: number } | null = null;
    const p = { x: 0, y: 0, z: 0, h: 0 };
    for (const g of this.net.signs) {
      if (!g.path.main || NOT_AN_EXIT.test(g.text.join(' '))) continue;
      g.path.at(g.s, 0, p);
      const d = Math.hypot(p.x - x, p.z - z);
      if (best && d >= best.dist) continue;
      const label = g.path.label;
      best = { label, dist: d, exit: { key: `${label} @ ${Math.round(g.s)}`, text: g.text.join(' / '), s: g.s, mi: g.s / 1609.344, side: g.side } };
    }
    return best;
  }
  // the sign a Settings.exit key names, if the data still has it
  private resolveExit(key: string): Sign | null {
    const m = /^(.+) @ (\d+)$/.exec(key);
    if (!m) return null;
    const s = Number(m[2]);
    let best: Sign | null = null;
    for (const g of this.net.signs) if (g.path.main && g.path.label === m[1] && Math.abs(g.s - s) < 20 && (!best || Math.abs(g.s - s) < Math.abs(best.s - s))) best = g;
    return best;
  }

  private placeCar(path: Path, s: number, lane: number, speed: number) {
    this.bests.minute.broken();                                 // a reset or a teleport breaks the 60 s stretch
    this.path = path;
    if (path.main) { this.lastMain = path; this.visited.add(path.label); }
    this.phys.placeAt(path, s, path.laneCenter(clamp(lane, 0, path.lanes - 1)), speed);
    this.phys.ext.fx = 0; this.phys.ext.fz = 0;
    this.jets?.clear();
    this.focusOnLand = false;                                   // a Focus Time queued in a hop is dropped by a reset
    this.phys.auto = true; this.manualUntil = 0;     // automatic for everyone (a shift holds the gear for a moment: actions())
    this.phys.handling = this.settings.handling;
    { const a = assistsFor(this.settings); this.phys.abs = a.abs; this.phys.tc = a.tc; }   // ABS always, TCS by the handling (settings.ts assistsFor)
    this.car.teleport(this.phys);
    this.recentre();
  }
  private recentre() {
    const dx = Math.round(this.phys.x - ORIGIN.x), dz = Math.round(this.phys.z - ORIGIN.z);
    if (Math.abs(dx) < 1 && Math.abs(dz) < 1) return;
    ORIGIN.x += dx; ORIGIN.z += dz;
    this.roads?.rebase(); this.terrain?.rebase(this.phys.x, this.phys.z);
    this.camera.position.x -= dx; this.camera.position.z -= dz;
    this.chasePos.x -= dx; this.chasePos.z -= dz;
    this.camFrom.p.x -= dx; this.camFrom.p.z -= dz;
    this.car.update(0, 1, this.phys, false, this.time);
  }

  private startAttract() {
    this.attract = true; this.over = false; this.mode = 'free';
    if (this.gov.rungs.length) this.govLadder(true);
    this.syncAtmosphere();
    this.setHyper(false);
    const m = this.findMain('I-405 North');
    this.placeCar(m, m.len * 0.12, 1, 28);
    this.apLane = 1;
    this.setRoute(null);
    this.traffic.reseed(405);
    this.traffic.fill(this.view());
    this.cam = 'cockpit'; this.camBlend = 1;
    this.audio.silence();
  }

  // `diff`: one of the menu's three difficulties (a timed run, Speed Survival's rules: pass 'survival'); null is Free Drive, with the
  // player's own traffic (settings.density). A difficulty sets its own traffic for the run, never the saved setting.
  async start(mode: Mode, startLabel = this.settings.start, diff: Difficulty | null = null) {
    mode = modeOf(mode);               // only Free Drive and Speed Survival exist; anything older starts Free Drive
    this.starts++;
    // a graphics check still running on the menu ends here, and the player's preset is back before the warm-up prepares
    // it (the check would otherwise put it back mid-drive, a new composer and its targets on a driven frame)
    if (this.stopBench()) this.applyQuality();
    this.bankRun();                    // a run left by Restart keeps what it scored (Free Drive's Best drift, a timed run's Fastest Minute)
    this.runDiff = mode === 'survival' ? (diff ?? 'medium') : null;   // a timed run always has a difficulty: Medium's normal rule when none is named
    this.applyDensity();
    this.leaveVenue();
    this.applyCarChoice(mode);
    // the car's own ability comes with its tune (tuneFor): the hypercar's Unleashed tune in Free Drive has it, its race
    // tune in Speed Survival does not
    this.setHyper(tuneFor(carById(this.driving), mode).ability === 'hyper');
    this.audio.start();
    this.audio.vol = { master: this.settings.master, engine: this.settings.engine, ambient: this.settings.ambient };
    this.audio.applyVolumes();
    this.mode = mode; this.attract = false; this.over = false;
    this.govLadder(true);              // Speed Survival's ladder has no traffic step: the steps taken carry over
    this.syncAtmosphere(true);         // a run opens in the player's own time and weather, behind the loading screen
    const st = STARTS.find((x) => x.label === startLabel) ?? STARTS[0];
    // "start at your exit": on that exit's carriageway, 450 m before its sign, so the first thing you see is your exit
    const exit = this.resolveExit(this.settings.exit);
    const m = exit ? exit.path : this.findMain(st.label);
    const s0 = exit ? clamp(exit.s - 450, 40, Math.max(40, m.len - 200)) : m.len * st.at;
    this.placeCar(m, s0, Math.min(1, m.lanes - 1), mode === 'survival' ? 30 : 0);
    if (mode === 'free') this.startErrand(m, s0); else { this.errand = null; this.pendingErrand = null; }
    this.earned(this.profile.add({ freeway: m.label }));
    this.setRoute(null);
    this.traffic.reseed(1000 + Math.floor(Math.random() * 1e6));
    this.traffic.fill(this.view());
    this.progress.runStart();
    this.distance = 0; this.score = 0; this.combo = 1; this.comboT = 0; this.overtakes = 0; this.top = 0; this.pace = 0;
    this.streak = 0; this.bestStreak = 0; this.nearMisses = 0; this.collisions = 0;
    this.beginScores();
    this.endAbility(); this.ability.reset();
    this.input.recenter();
    const warm = this.warmNeeded();
    await this.prebuild('Merging onto ' + m.label, 0, warm ? 0.5 : 1);
    await this.warmUp(`Preparing ${presetFor(this.settings).label}`, 0.5, 1);   // High and Ultra: every camera ready before you drive
    this.setPaused(false);
    this.ev.loading(false);
    if (this.driving === FOUNDER_CAR) this.wakeFounder();          // the Founder Edition's lights wake on the line
    this.last = performance.now();
    const what = (mode === 'survival' ? 'stay over 100 mph' : 'Free Drive') + (this.driving === 'oc-hyper' ? (mode === 'free' ? ' · Unleashed' : ' · race tune') : '');
    this.ev.toast(exit ? `${m.label} · your exit ahead: ${exit.text.join(' / ')}` : `${m.label} · ${what}`, 'info');
  }

  quitToMenu() { this.bankRun(); this.runDiff = null; this.applyDensity(); this.leaveVenue(); this.errand = null; this.profile.save(); this.radio.stop(); this.radio.station = -1; this.setPaused(false); this.startAttract(); }
  cycleRadio() { if (this.attract) return; this.audio.start(); this.audio.setMusicVolume(this.settings.music); this.ev.toast(this.radio.cycle(), 'info'); }
  // tune a station directly (the radio card), -1 for off
  tuneRadio(i: number) { if (this.attract) return; this.audio.start(); this.audio.setMusicVolume(this.settings.music); this.radio.tune(i); }
  // Ultra Realism opens at level 5; then each of its parts can be switched on its own
  get ultraOpen() { return this.profile.level >= 5; }
  private ultraOn() { return this.settings.ultra && this.ultraOpen && !this.attract; }

  // what this car does flat out (from its gearing and drag): Auto-drive's cruise stays under it
  private carTop() {
    const wheelTop = ((SPEC.redline * Math.PI) / 30) * SPEC.wheelR / (SPEC.gears[SPEC.gears.length - 1] * SPEC.final);
    const dragTop = Math.cbrt((SPEC.power * 0.9) / (0.5 * 1.225 * SPEC.CdA));
    return Math.min(wheelTop, dragTop);
  }
  restart() { void this.start(this.mode); }

  setPaused(on: boolean) {
    if (this.attract && on) return;
    if (this.paused === on) return;
    this.paused = on;
    if (on) { this.audio.suspend(); this.input.clear(); this.profile.save(); } else { this.audio.resume(); this.last = performance.now(); }
    this.ev.pause(on);
  }
  get isPaused() { return this.paused; }

  updateSettings(s: Settings) {
    const q = this.settings.quality !== s.quality, d = this.settings.density !== s.density, st = this.settings.style !== s.style;
    const ad = this.settings.adaptive !== s.adaptive || this.settings.qualityChosen !== s.qualityChosen;
    const atmo = s.time !== this.settings.time || s.weather !== this.settings.weather;
    const who = s.driver !== this.settings.driver || s.presentation !== this.settings.presentation || s.skin !== this.settings.skin || s.character !== this.settings.character || s.packTest !== this.settings.packTest;
    const owner = s.owner !== this.settings.owner;
    const cur = carById(this.driving);
    const repaint = paintFor(cur, s.paints) !== paintFor(cur, this.settings.paints) || wheelFor(cur, s.wheels) !== wheelFor(cur, this.settings.wheels);
    this.settings = s;
    // the player touched time or weather: from now on the menu shows their choice, not the car's atmosphere (the
    // settings themselves never take the car's atmosphere; it lives only in the environment)
    if (atmo) { this.attractAtmo = false; this.syncAtmosphere(); }
    if (who) this.applyDriver();
    else if (repaint) this.configureCar();   // the garage's Paint and Wheels tabs: the car changes live
    if (owner && this.attract) this.applyCarChoice();   // on the menu; a run keeps its car until the next start
    this.phys.handling = s.handling;
    { const a = assistsFor(s); this.phys.abs = a.abs; this.phys.tc = a.tc; }   // ABS always, TCS by the handling (settings.ts assistsFor)
    this.audio.vol = { master: s.master, engine: s.engine, ambient: s.ambient }; this.audio.applyVolumes();
    this.audio.setMusicVolume(s.music);
    if (d && this.traffic) this.applyDensity();
    if (q) {
      this.stopBench();                    // a graphics check running on the menu is moot once the player picks a preset
      configureTextures(QUALITY[s.quality].texture, this.renderer.capabilities.getMaxAnisotropy()); this.applyQuality(true);
      // the new preset prepared before it is driven: mid-drive (the pause screen's Settings) behind a short "Preparing
      // Ultra" sheet; on the menu quietly, for its film camera (the run's warm-up does the rest at its start)
      if (this.attract) void this.warmUp(null); else void this.prepareSwitch();
    }
    else if (st) this.applyQuality();
    else if (ad || d) { if (ad) this.startScale = this.pickStart(); this.govLadder(!ad); }   // Adaptive quality switched (from the top of the ladder, at its start scale), or a traffic step came or went
    this.onResize();
  }

  // the car you drive: your profile's, or in owner mode the one picked from the whole garage. Owner mode never
  // writes the profile, so turning it off brings back the car you own and chose.
  get carId() {
    if (this.settings.owner) {
      if (this.ownerPick === undefined) { this.ownerPick = null; try { this.ownerPick = localStorage.getItem(OWNER_CAR); } catch { /* fine */ } }
      if (this.ownerPick && CARS.some((c) => c.id === this.ownerPick)) return this.ownerPick;
    }
    return this.profile.p.car;
  }
  get ownerMode() { return this.settings.owner; }
  // owner mode's Drive button: any car, no credits, level or slot, and nothing saved to the profile
  chooseOwnerCar(id: string) {
    if (!this.settings.owner || !CARS.some((c) => c.id === id)) return;
    this.ownerPick = id;
    try { localStorage.setItem(OWNER_CAR, id); } catch { /* a convenience */ }
  }
  // the car from your garage: its numbers into the physics, its body and cockpit into the scene
  applyCarChoice(mode: string = this.mode) {
    const c = carById(this.carId), was = this.driving;
    this.driving = c.id;
    this.carGrip = applyCar(c, mode);
    this.earnCap = earnCapFor(c, mode);
    // a car whose tune has no ability of its own never keeps the hypercar's (it is latched again at the next start)
    if (this.hyper.live && tuneFor(c, mode).ability !== 'hyper') this.setHyper(false);
    this.configureCar();
    if (this.attract) this.syncAtmosphere();   // the menu's attract drive takes the car's atmosphere
    // chosen in the garage: the Founder Edition's lights wake
    if (c.id === FOUNDER_CAR && was !== c.id) this.wakeFounder();
    return c;
  }
  // The atmosphere on screen (owner, 2026-10-21: "every car we choose represents a different atmosphere"). On the
  // menu the attract drive runs in the chosen car's time and weather (cars.ts); a run runs in the player's settings.
  // The rule: the car's atmosphere holds on the menu only until the player touches time or weather in Settings this
  // session (attractAtmo); from then on the menu shows what they chose, so a change made on the menu is seen. The
  // car's atmosphere never reaches the saved settings: it lives only in the environment. Same env.set as always:
  // eased over a few seconds, or instant behind a loading screen (instant also re-snaps an unchanged atmosphere).
  // the menu's theme sets the hour of its scene (owner, 2026-11-18: a night freeway behind Midnight); the car's weather stays
  private menuTime: TimeOfDay | null = null;
  // `instant`: behind the loading screen the scene starts at that hour, not easing to it once the menu is up
  setMenuTime(t: TimeOfDay | null, instant = false) { if (this.menuTime === t) return; this.menuTime = t; if (this.attract) this.syncAtmosphere(instant); }
  private syncAtmosphere(instant = false) {
    const car = carById(this.driving).atmosphere, s = this.settings, fromCar = this.attract && this.attractAtmo;
    const time = fromCar ? (this.menuTime ?? car.time) : s.time, weather = fromCar ? car.weather : s.weather;
    if (!instant && this.shown && this.shown.time === time && this.shown.weather === weather) return;
    this.shown = { time, weather };
    this.env.set(time, weather, instant);
  }
  // the Founder Edition's LED wake-up on the player's car (reduced motion: on at once)
  // (the paid edition's alone: the earned standard car has no Founder Ice to wake)
  wakeFounder() { if (this.hypercarEdition === 'founder') this.car.wake(reducedMotion()); }
  // what a run's result says about its car
  private runCar() {
    return { car: this.driving, tune: this.driving === FOUNDER_CAR ? (this.mode === 'free' ? 'Unleashed' : 'Race tune') : '', edition: this.driving === FOUNDER_CAR && this.hypercarEdition === 'standard' ? 'standard' as const : undefined };
  }

  // ------------------------------------------------------------------- the Founder Edition's reveal stage
  // The OC Hypercar's garage card shows it on a stage (src/preview/reveal.ts). The stage renders with the game's own
  // renderer, into a corner of the game's canvas just before the frame's own render covers it, and is copied into the
  // card's canvas; it renders only while it moves (then the card keeps the last frame, and so does the session, so
  // opening the garage again shows it without building anything). openReveal plays it once if asked (the first time
  // on this device); reduced motion shows the last frame, still. Test hooks: revealState, revealHold.
  //
  // The garage's SHOWROOM (owner, 2026-11-24: the Vehicles carousel's centred car and the Paint tab's car) is the same stage
  // with another car on the turntable: openReveal(canvas, false, { car, paint }) shows that car still at its hero angle
  // (built once, rendered once, then kept as a frame per car and paint for the session); setRevealPaint repaints it live
  // (a material swap, as PlayerCar.setPaint). The Founder Edition's own reveal is unchanged (no `show`).
  private rv: { stage: RevealStage | null; canvas: HTMLCanvasElement; t: number; kind: RevealKind; playing: boolean; dirty: boolean; hold: number | null;
    calls: number; tris: number; frames: number; buildMs: number; compiled: boolean; show?: { car: string; paint: number; std: boolean }; shown?: number } | null = null;
  private revealStill: HTMLCanvasElement | null = null;
  private showStills = new Map<string, HTMLCanvasElement>();
  private showKey(sh: { car: string; paint: number; std: boolean }) { return `${sh.car}|${sh.paint}|${sh.std ? 's' : 'f'}|${this.settings.quality}`; }
  // the paint a car shows in the garage for a garage paint pick (as configureCar paints the player's car)
  stagePaint(carId: string, hex: number) { return founderPaint(carId, hex, shapeFor(carId as CarId).paint); }
  openReveal(canvas: HTMLCanvasElement, autoplay: boolean, show?: { car: string; paint: number }): 'playing' | 'still' {
    this.closeReveal();
    if (show) {
      const sh = { car: show.car, paint: this.stagePaint(show.car, show.paint), std: show.car === FOUNDER_CAR && this.hypercarEdition === 'standard' };
      this.rv = { stage: null, canvas, t: WAKE_ONLY_SECONDS, kind: 'wake', playing: false, dirty: true, hold: null, calls: 0, tris: 0, frames: 0, buildMs: 0, compiled: false, show: sh };
      if (this.showStills.has(this.showKey(sh))) { this.rv.dirty = false; this.drawStill(); return 'still'; }
      this.buildRevealStage();
      return 'still';
    }
    this.rv = { stage: null, canvas, t: REVEAL_SECONDS, kind: 'reveal', playing: false, dirty: true, hold: null, calls: 0, tris: 0, frames: 0, buildMs: 0, compiled: false };
    if (this.revealStill && !autoplay) { this.rv.dirty = false; this.drawStill(); return 'still'; }
    if (autoplay && !reducedMotion()) { this.playReveal('reveal'); return 'playing'; }
    this.buildRevealStage();
    return 'still';
  }
  // play the reveal from the start, or only the lights' wake-up ('wake': when the car is chosen in the garage)
  playReveal(kind: RevealKind = 'reveal') {
    const r = this.rv; if (!r) return;
    this.buildRevealStage();
    r.kind = kind; r.dirty = true;
    if (reducedMotion()) { r.t = kind === 'wake' ? WAKE_ONLY_SECONDS : REVEAL_SECONDS; r.playing = false; } else { r.t = 0; r.playing = true; }
  }
  // (a stage still compiling is disposed once its compile settles: three's compileAsync polls the programs it started,
  // and a carousel swiped past a car closes its stage within moments)
  closeReveal() {
    const r = this.rv;
    if (r?.stage) { if (r.compiled) r.stage.dispose(); else this.revealDead.add(r.stage); }
    this.rv = null;
  }
  private revealDead = new Set<RevealStage>();
  // the showroom's car in another garage paint, live (from the session's frame when it was shown in it before)
  setRevealPaint(hex: number) {
    const r = this.rv; if (!r?.show) return;
    const paint = this.stagePaint(r.show.car, hex);
    if (paint === r.show.paint) return;
    const was = r.show.paint, q = this.revealQuality(), id = r.show.car as CarId;
    r.show = { ...r.show, paint };
    if (r.stage) {
      const swap = [[carPaint(was, q, id), carPaint(paint, q, id)], [carPaint(was, q, id, null, true), carPaint(paint, q, id, null, true)]];
      r.stage.car.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; for (const [a, b] of swap) if (m.material === a) { m.material = b; break; } });
      r.dirty = true;
    } else if (this.showStills.has(this.showKey(r.show))) this.drawStill();
    else { r.dirty = true; this.buildRevealStage(); }
  }
  /** (tests) the showroom's car and paint, null when the stage is the Founder Edition's reveal or closed */
  get revealShow() { const r = this.rv; return r?.show ? { ...r.show, stills: this.showStills.size, shown: r.shown ?? 0 } : null; }
  private revealQuality(): 'high' | 'phone' { return this.settings.quality === 'high' || this.settings.quality === 'ultra' ? 'high' : 'phone'; }
  revealHold(t: number | null) { if (this.rv) { this.rv.hold = t; this.rv.dirty = true; } }
  get revealState() {
    const r = this.rv;
    return r ? { open: true, built: !!r.stage, t: r.hold ?? r.t, kind: r.kind, playing: r.playing, calls: r.calls, tris: r.tris, frames: r.frames, buildMs: r.buildMs, compiled: r.compiled, still: !!this.revealStill }
      : { open: false, built: false, t: 0, kind: 'reveal', playing: false, calls: 0, tris: 0, frames: 0, buildMs: 0, compiled: false, still: !!this.revealStill };
  }
  private buildRevealStage() {
    const r = this.rv; if (!r || r.stage) return;
    const q = this.revealQuality(), sh = r.show;
    r.stage = sh ? buildReveal(this.renderer, q, sh.car as CarId, { paint: sh.paint, edition: sh.std ? 'standard' : 'founder', rim: wheelFor(carById(sh.car), this.settings.wheels) }) : buildReveal(this.renderer, q);
    r.buildMs = r.stage.buildMs;
    // its shaders compile off the main thread where the browser can; until then it waits (the card shows its dark stage)
    const st = r.stage;
    this.renderer.compileAsync(st.scene, st.camera).catch(() => undefined).then(() => {
      if (this.revealDead.delete(st)) { st.dispose(); return; }
      if (this.rv?.stage === st) { this.rv.compiled = true; this.rv.dirty = true; }
    });
  }
  private drawStill() {
    const r = this.rv, s = r?.show ? this.showStills.get(this.showKey(r.show)) : this.revealStill; if (!r || !s) return;
    const g = r.canvas.getContext('2d'); if (!g) return;
    g.drawImage(s, 0, 0, r.canvas.width, r.canvas.height);
    r.shown = (r.shown ?? 0) + 1;
  }
  private tmpSize = new THREE.Vector2();
  // a stage's frame into a canvas: rendered into a corner of the game's own drawing buffer (just before the frame's own
  // render covers it) and copied out
  private drawStage(stage: RevealStage, t: number, kind: RevealKind, cv: HTMLCanvasElement) {
    const g = cv.getContext('2d')!;
    const buf = this.renderer.getDrawingBufferSize(this.tmpSize), k = Math.min(1, buf.x / cv.width, buf.y / cv.height);
    const w = Math.max(1, Math.floor(cv.width * k)), h = Math.max(1, Math.floor(cv.height * k)), bh = buf.y;
    const pose = stage.pose(t, kind);
    const wake = WAKE.value, exposure = this.renderer.toneMappingExposure, pr = this.renderer.getPixelRatio();
    WAKE.value = pose.wake; this.renderer.toneMappingExposure = pose.exposure;
    stage.camera.aspect = w / h; stage.camera.updateProjectionMatrix();
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(0, 0, w / pr, h / pr); this.renderer.setViewport(0, 0, w / pr, h / pr);
    this.renderer.render(stage.scene, stage.camera);
    this.renderer.setScissorTest(false);
    const size = this.renderer.getSize(this.tmpSize);
    this.renderer.setViewport(0, 0, size.x, size.y);
    WAKE.value = wake; this.renderer.toneMappingExposure = exposure;
    g.drawImage(this.renderer.domElement, 0, bh - h, w, h, 0, 0, cv.width, cv.height);
    return pose;
  }

  // The showroom's STILLS (owner, 2026-11-24: "make the car selection display the cars"): the carousel's neighbours show
  // each car's own model, rendered once on the stage at its hero angle in its paint and rims, and kept for the session.
  // showroomStill(car, paint) gives the frame when there is one, else queues it; the queue renders one car at a time,
  // only while the live stage is idle (built, compiled, drawn), and calls the listeners as each lands.
  private stillQueue: { car: string; paint: number; std: boolean }[] = [];
  private stillJob: { stage: RevealStage; show: { car: string; paint: number; std: boolean }; compiled: boolean } | null = null;
  private stillListeners = new Set<() => void>();
  onShowroomStill(fn: () => void) { this.stillListeners.add(fn); return () => { this.stillListeners.delete(fn); }; }
  showroomStill(car: string, hex: number): HTMLCanvasElement | null {
    const sh = { car, paint: this.stagePaint(car, hex), std: car === FOUNDER_CAR && this.hypercarEdition === 'standard' };
    const key = this.showKey(sh), have = this.showStills.get(key);
    if (have) return have;
    if (!this.stillQueue.some((q) => this.showKey(q) === key) && !(this.stillJob && this.showKey(this.stillJob.show) === key)) this.stillQueue.push(sh);
    return null;
  }
  /** (tests) stills waiting to be rendered, and whether one is being built */
  get showroomQueue() { return this.stillQueue.length + (this.stillJob ? 1 : 0); }
  private renderStills() {
    const r = this.rv;
    if (r && (!r.stage ? !!r.show && !this.showStills.has(this.showKey(r.show)) : !r.compiled || r.dirty || r.playing)) return;   // the live stage first
    if (!this.stillJob) {
      const next = this.stillQueue.shift(); if (!next) return;
      if (this.showStills.has(this.showKey(next))) return;
      const q = this.revealQuality();
      const stage = buildReveal(this.renderer, q, next.car as CarId, { paint: next.paint, edition: next.std ? 'standard' : 'founder', rim: wheelFor(carById(next.car), this.settings.wheels) });
      const job = { stage, show: next, compiled: false };
      this.stillJob = job;
      this.renderer.compileAsync(stage.scene, stage.camera).catch(() => undefined).then(() => { job.compiled = true; });
      return;
    }
    const job = this.stillJob;
    if (!job.compiled) return;
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270;
    this.drawStage(job.stage, WAKE_ONLY_SECONDS, 'wake', cv);
    this.showStills.set(this.showKey(job.show), cv);
    job.stage.dispose(); this.stillJob = null;
    for (const fn of this.stillListeners) fn();
  }
  private renderReveal(dt: number) {
    const r = this.rv;
    if (!r || !r.stage || !r.compiled) return;
    const T = r.kind === 'wake' ? WAKE_ONLY_SECONDS : REVEAL_SECONDS;
    if (r.playing && r.hold === null) { r.t += dt; if (r.t >= T) { r.t = T; r.playing = false; r.dirty = true; } }
    if (!r.playing && !r.dirty) return;
    const cv = r.canvas, g = cv.getContext('2d');
    if (!g || !cv.width || !cv.height || !cv.isConnected) return;
    const pose = this.drawStage(r.stage, r.hold ?? r.t, r.kind, cv);
    r.calls = this.renderer.info.render.calls; r.tris = this.renderer.info.render.triangles; r.frames++;
    // the light sweep's band across the card as the light passes (none with reduced motion: nothing moves then)
    if (pose.band !== null) {
      const x = (pose.band * 1.4 - 0.2) * cv.width, bw = cv.width * 0.12, a = Math.sin(Math.PI * pose.band);
      const gr = g.createLinearGradient(x - bw, 0, x + bw, cv.height * 0.3);
      gr.addColorStop(0, 'rgba(200,230,255,0)'); gr.addColorStop(0.42, `rgba(200,230,255,${0.12 * a})`); gr.addColorStop(0.5, `rgba(225,242,255,${0.36 * a})`);
      gr.addColorStop(0.58, `rgba(200,230,255,${0.12 * a})`); gr.addColorStop(1, 'rgba(200,230,255,0)');
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); g.restore();
    }
    r.dirty = false;
    r.shown = (r.shown ?? 0) + 1;
    if (!r.playing && r.hold === null) {
      // the last frame, for the session (the showroom's: one per car and paint)
      const key = r.show ? this.showKey(r.show) : '';
      const s = (r.show ? this.showStills.get(key) : this.revealStill) ?? document.createElement('canvas');
      s.width = cv.width; s.height = cv.height; s.getContext('2d')?.drawImage(cv, 0, 0);
      if (r.show) { this.showStills.set(key, s); if (this.showStills.size > 24) this.showStills.delete(this.showStills.keys().next().value!); for (const fn of this.stillListeners) fn(); }
      else this.revealStill = s;
    }
  }
  // the Founder Edition's rules as the game holds them (for the suite): the plaque, the reserved paint and LEDs
  get founder() {
    return {
      car: FOUNDER_CAR, until: FOUNDER_UNTIL, serial: founderSerial(), plaque: plaqueLine(), number: plaqueNumber(),
      paint: GLACIER_SILVER, led: FOUNDER_ICE,
      finishes: Object.fromEntries(CARS.map((c) => [c.id, finishesFor(c.id).map((f) => f.name)])),
      ledCars: CAR_IDS.filter((id) => !!shapeFor(id).led),
      paints: Object.fromEntries(CARS.map((c) => [c.id, founderPaint(c.id, GLACIER_SILVER.hex, c.paint)])),
      wake: { value: WAKE.value, t: this.car.wakeTime, waking: this.car.waking },
    };
  }
  // the car, its paint, the graphics quality and the driver's look: PlayerCar rebuilds only what changed. Live
  // mirrors (the road and the traffic behind, one extra low-resolution render a frame) come with High and Ultra on
  // a device with a fine pointer; phones keep the environment map whatever the preset.
  private configureCar() {
    const s = this.settings, c = carById(this.driving), d = DRIVERS.find((x) => x.id === s.driver) ?? DRIVERS[0];
    const store = equippedPaint(c.id);                          // a paint from the store (src/store), if you put one on
    const desktop = !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
    // the chosen character's appearance (cast.ts) on the archetype's pose; no character yet: the archetype's look
    // (a pack character only while the pack is unlocked: castPack.ts; else the look without a character)
    const { look, presentation } = characterLook(d.id, playableCharacter(s)?.id ?? '', s.presentation, s.skin);
    const high = s.quality === 'high' || s.quality === 'ultra';
    this.jets?.setPerNozzle(high ? 24 : 12);       // the hop's jets: half the sprites on the phone build
    this.style?.unstyle(this.car.root);                         // the car swaps its own materials (paint): on the originals
    this.car.configure({
      car: c.id as CarId, paint: store?.hex ?? founderPaint(c.id, paintForEdition(c, s.paints, this.hypercarEdition), shapeFor(c.id as CarId).paint), finish: store?.finish ?? null, wheel: wheelFor(c, s.wheels), quality: high ? 'high' : 'phone', mirrors: high && desktop ? 'live' : 'env',
      edition: c.founder && this.hypercarEdition === 'standard' ? 'standard' : 'founder', look, presentation, nails: look.nails !== undefined ? look.nails : presentation === 'f' ? 0x7c1426 : null,   // the driver's own polish (drivers.ts lookFor / characterLook)
    });
    this.style?.restyle(this.car.root);
  }

  /** (tests) what the cockpit's arms show now: the look they were built with, the tone set through setTone */
  get driverArms() { return this.car.armsLook; }
  /** (tests) the ability the archetype gives */
  get abilityId() { return this.ability?.def.id ?? null; }
  // who's driving: their look in the cockpit, and their ability
  private applyDriver() {
    const d = DRIVERS.find((x) => x.id === this.settings.driver) ?? DRIVERS[0];
    this.configureCar();
    this.endAbility();
    this.ability = new Ability(ABILITIES[d.ability]);
  }
  useAbility() {
    return !this.paused && this.tryAbility();
  }
  // the ability's own rules (the pause is the caller's: a simulation step never runs paused)
  private tryAbility() {
    if (this.attract || this.over || !this.ability.ready) return false;
    // Focus Time asked for in a hop waits for the touchdown (the arc was planned at the world's pace when it took off)
    if (this.ability.def.id === 'focus' && this.phys.airborne) {
      if (!this.focusOnLand) { this.focusOnLand = true; this.ev.toast('Focus Time on landing', 'info'); }
      return false;
    }
    // with no traffic there is nothing to clear: say so and keep the charge
    if (this.ability.def.id === 'clear' && this.traffic.level.perKmLane === 0 && this.traffic.cars.length === 0) { this.ev.toast('No traffic to clear', 'info'); return false; }
    if (!this.ability.trigger()) return false;
    const v = this.view(), id = this.ability.def.id;
    if (id === 'clear') {
      this.traffic.scale = 0.65;
      const cf = new THREE.Vector3(); this.camera.getWorldDirection(cf);
      this.traffic.thin(0.35, v, cf.x, cf.z);
      this.traffic.makeWay(v);
      this.car.setPose('wave'); this.poseT = 1.6;
    } else if (id === 'focus') {
      this.worldScale = 0.7;
      this.car.setPose('watch'); this.poseT = 0.9;
    } else {
      this.gripBoost = 1.3;
      this.car.setPose('knee'); this.poseT = this.ability.def.duration;   // one hand on the wheel
    }
    this.ev.toast(this.ability.def.name, 'good');
    return true;
  }
  // the hypercar's systems for this run (latched at its start, like the tune). Public: the suite's abilities group and
  // the proof script call it through window.__game to put the systems on or off without starting a new run
  setHyper(live: boolean) {
    this.hyper.reset(live);
    this.input.thrustLive = live;
    this.fulls = this.hyper.fulls;
    this.phys.ext.fx = 0; this.phys.ext.fz = 0;
    this.hopLog.refusedAt = -1e9;
    this.jets?.clear();
  }
  // Thrust Hop (a tap of THRUST, or J; THRUST is the jump only): plans an arc over the vehicles ahead in your lane and launches it, or says why not.
  // Returns 'ok' or the reason. Refused while it isn't live, in the air, with under 40 % in the tank, under 5 m/s,
  // when no arc clears the vehicle ahead, with no room to land on this road, or under a structure (an overpass, another
  // road's deck, a sign gantry) anywhere over the hop's ground track.
  thrustHop(): string {
    const p = this.phys, h = this.hyper;
    if (!h.live || this.attract || this.over || this.paused) return 'off';
    if (p.airborne) return 'in the air';
    const no = (why: string) => { this.hopLog.refused = why; this.hopLog.refusedN++; this.hopLog.refusedAt = performance.now(); this.ev.toast(why, 'info'); return why; };
    if (h.tank < TANK.hopNeed) return no('Thrust Hop: tank low');
    if (p.vx < HOP.minV) return no('Need more speed');
    // every vehicle on this road, out to the longest hop's landing and its room, in this road's frame: one on another
    // carriageway that shares these lanes at this level (a co-signed stretch, a merge) is projected onto it, so it
    // counts. The level is read against this road's own height where the vehicle is (a grade climbs metres over the
    // distance a hop looks ahead), not against the height under the car
    const cars: HopVehicle[] = [];
    const fx = Math.sin(p.psi), fz = Math.cos(p.psi), reach = p.vx * (HOP.maxT + HOP.landWarn) + 40;
    for (const t of this.traffic.cars) {
      const dx = t.x - p.x, dz = t.z - p.z, along = dx * fx + dz * fz;
      if (along < -40 || along > reach + 20 || Math.abs(dx * fz - dz * fx) > 60) continue;
      let ds = t.s - p.s, dd = t.d - p.d, v = t.v;
      if (t.path === this.path) {
        // one changing lanes counts in the lane it is moving to, when that is nearer the car's
        if (t.t >= 0) { const dTo = this.path.laneCenter(t.to) - p.d; if (Math.abs(dTo) < Math.abs(dd)) dd = dTo; }
      } else {
        const pr = this.path.project(t.x, t.z, p.s + along, this.hopProj), sc = clamp(pr.s, 0, this.path.len);
        if (Math.abs(t.y - this.path.height(sc)) > 2.5) continue;      // a deck above or a road below
        ds = pr.s - p.s; dd = pr.d - p.d;
        v = t.v * Math.cos(t.h - this.path.heading(sc));
      }
      if (ds < -30 || ds > reach) continue;
      const cl = this.traffic.classes[t.cls], ws = this.worldScale;
      // its cruising speed as it drives it now (the weather's pace; none while it stops after a hit),
      // seen at the world's pace like its speed; projected from another road, along this one
      const v0 = (t.stopT > 0 ? 0 : t.v0 * this.traffic.pace) * (t.v > 0.1 ? v / t.v : 1);
      cars.push({ ds, v: v * ws, v0: v0 * ws, bold: t.bold, acc: t.acc * ws * ws, dd, len: cl.len, wid: cl.wid, height: cl.height, kind: cl.id, other: t.path !== this.path });
    }
    // (the car's drag slows it in the air, where nothing pushes it: the plan allows for it)
    const airDrag = (0.5 * 1.225 * SPEC.CdA * p.vx * p.vx) / SPEC.mass;
    const plan = planHop(p.vx, SPEC.halfL, SPEC.halfW, cars, airDrag), b = plan.block;
    this.hopLog.block = b ? { kind: b.kind, ds: +b.ds.toFixed(1), dd: +b.dd.toFixed(2), v: +b.v.toFixed(1), other: !!b.other } : null;
    if (plan.refuse) return no(plan.refuse);
    const track = p.vx * plan.T + 20;
    // (to where the road is drawn: a road cut back off another's lanes ends short of its length, Network.trimEnds)
    if (p.s + track > this.path.end - 5 && !this.path.next) return no('No room to land');
    if (p.s + track > this.path.end - 5) return no('Junction ahead: no hop');
    // the gas scales with the arc (hopCostFor): a big arc can ask for more than the tank holds
    const cost = hopCostFor(plan.peak, plan.T);
    if (h.tank < cost) return no('Thrust Hop: tank low');
    const over = this.structureOver(this.path, p.s, p.d, track);
    if (over) return no(over === 'overpass' ? 'No hop: overpass ahead' : over === 'sign gantry' ? 'No hop: sign gantry ahead' : 'No hop: bridge overhead');
    if (!p.hop(plan.peak, plan.T)) return no('No hop');
    h.spendHop(p, cost);                                         // nothing pushes it along: the arc is planned at this speed
    const L = this.hopLog;
    L.n++; L.peak = plan.peak; L.T = plan.T; L.cost = cost; L.over = plan.over; L.short = plan.short ?? null; L.warn = !!plan.warn; L.apex = 0; L.air = 0; L.landV = 0; L.landMph = 0;
    this.jets.puff(0.35);
    if (!this.attract) this.audio.hop();
    const name = (k: string) => (k === 'semi' ? 'big rig' : k === 'truck' ? 'box truck' : k);
    this.ev.toast((plan.over ? `Thrust Hop · over the ${name(plan.over)}` : plan.short ? `Thrust Hop · short of the ${name(plan.short)}` : 'Thrust Hop') + (plan.warn ? ' · traffic on landing' : ''), 'good');
    return 'ok';
  }
  // what stands over a stretch of road (this road from s for len metres at offset d): a sign gantry on it, a street
  // overpass, or another road's deck. The clearance check for the hop; it runs once per request.
  private hopBuf: Hit[] = [];
  private hopProj = { s: 0, d: 0 };
  private hopAt = { x: 0, y: 0, z: 0, h: 0 };
  structureOver(path: Path, s0: number, d: number, len: number): string | null {
    // the guide-sign gantries (where Roads.ts draws them: GANTRY_AHEAD before each exit, moved by Roads.gantrySpot to
    // where there's room, or left out), across the whole carriageway
    for (const g of this.net.signs) {
      if (g.path !== path) continue;
      for (let i = 0; i < GANTRY_AHEAD.length; i++) {
        if (g.s - GANTRY_AHEAD[i] < GANTRY_MIN_S) continue;
        const at = this.roads.gantryAt(g, i);
        if (at && at.s > s0 - 6 && at.s < s0 + len + 6) return 'sign gantry';
      }
    }
    const a0 = path.at(clamp(s0, 0, path.len), d), reach = len + 60;
    const near: Overpass[] = [];
    for (const o of this.net.overpasses) if (Math.abs((o.ax + o.bx) / 2 - a0.x) < reach + 80 && Math.abs((o.az + o.bz) / 2 - a0.z) < reach + 80) near.push(o);
    for (let s = s0; s <= s0 + len + 0.01; s += 4) {
      const a = path.at(clamp(s, 0, path.len), d, this.hopAt);
      for (const o of near) {
        const ex = o.bx - o.ax, ez = o.bz - o.az, L2 = ex * ex + ez * ez || 1;
        const t = clamp(((a.x - o.ax) * ex + (a.z - o.az) * ez) / L2, 0, 1);
        const dist = Math.hypot(a.x - (o.ax + ex * t), a.z - (o.az + ez * t));
        const under = o.y - 1.6 - a.y;
        if (dist < o.w / 2 + 2 && under > 0.5 && under < 30) return 'overpass';
      }
      for (const hit of this.net.near(a.x, a.z, 14, this.hopBuf)) {
        const q = hit.path;
        if (q === path || hit.s < 0 || hit.s > q.len || hit.d < q.paveL - 1.5 || hit.d > q.paveR + 1.5) continue;
        const up = q.height(hit.s) - a.y;
        if (up > 2.5 && up < 30) return 'bridge deck';
      }
    }
    return null;
  }
  private poseT = 0;
  private endAbility() {
    this.traffic && (this.traffic.scale = 1);
    this.worldScale = 1; this.gripBoost = 1;
    this.abilityEndHeld = false; this.focusOnLand = false;
    this.car.setPose(null); this.poseT = 0;
  }

  // navigation: head for a freeway (by label), or clear it
  navigateTo(label: string | null) {
    if (!label) { this.setRoute(null); return true; }
    if (this.venueState) return false;                          // parked or on foot: you're there
    // a venue (Lot 57, Stoppage Time): the route ends on its default exit ramp (another of its exits if that one can't
    // be reached from here), and Auto-drive and the guidance carry on down the ramp to where the fade parks you
    const v = venueByName(label);
    if (v) {
      for (const exit of v.exits) {
        const target = this.net.paths[exit.ramps[0]];
        if (!target) continue;
        const r = target === this.path || this.vramps().get(this.path)?.exit === exit ? [] : this.net.route(this.path, Math.max(0, this.phys.s), target);
        if (!r) continue;
        this.route = r; this.routeTarget = r.length ? target : this.path; this.routeVenue = { venue: v, exit }; this.navNow();
        if (!r.length) this.ev.toast(`${v.name} is down this ramp`, 'info');
        return true;
      }
      this.ev.toast(`No way to ${label} from here`, 'bad'); return false;
    }
    const target = this.net.mains.find((m) => m.label === label);
    if (!target) return false;
    if (target === this.path) { this.setRoute(null); this.ev.toast(`You're on ${label}`, 'info'); return true; }
    const r = this.net.route(this.path, Math.max(0, this.phys.s), target);
    if (!r) { this.ev.toast(`No way to ${label} from here`, 'bad'); return false; }
    this.route = r; this.routeTarget = target; this.routeVenue = null; this.navNow();
    return true;
  }
  private setRoute(target: Path | null) { this.route = []; this.routeTarget = target; if (!target) { this.autoDrive = false; this.routeVenue = null; } this.navNow(); }
  // a route to a venue: the venue and the exit it takes (null for a freeway)
  routeVenue: { venue: Venue; exit: VenueExit } | null = null;
  /** what the route is to: a venue's name or a freeway's label */
  get routeName() { return this.routeVenue?.venue.name ?? this.routeTarget?.label ?? ''; }
  // a route set or cleared, or Auto-drive switched: the HUD (the guidance, the AUTO tag, the Auto-drive button) and
  // the corner map hear it on the next frame, not up to one 0.1 s tick of each later
  private navNow() { this.hudT = 0; this.mapT = 0; }

  // ----------------------------------------------------------------------------------------- Auto-drive
  // The route, driven for you (owner, 2026-11-01: "make it where you put navigation on the gps to follow it"): the
  // autopilot (the attract drive's driver) follows the route's hand-offs at AUTO_CRUISE. Steering or braking, by keys,
  // touch or a pad, hands the car back at once; gas alone doesn't. A driving aid only: Free Drive with a route, never
  // a scored mode, and Free Drive's numbers count as usual.
  private autoDrive = false;
  private autoCruise = AUTO_CRUISE;
  get autoDriving() { return this.autoDrive; }
  get autoDriveOffered() { return !this.attract && !this.over && this.mode === 'free' && !!this.routeTarget; }
  setAutoDrive(on: boolean, why = '') {
    if (on && !this.autoDriveOffered) return false;
    if (on === this.autoDrive) return true;
    this.navNow();                   // the AUTO tag, data-auto and the button's state change with the toggle
    if (on) {
      // a hand-off already behind the car (or no plan from the last road): plan again from here before driving it.
      // Planned before switching on, so no plan from here says so once ("No way to X from here"), not twice
      if ((!this.route.length || this.missedHandOff()) && !this.replan()) { this.ev.toast(`No way to ${this.routeName} from here`, 'bad'); return false; }
      this.autoDrive = true;
      // from the lane you're in, so it doesn't swerve to its own
      const p = this.path; this.apLane = p.laneOf(clamp(this.phys.d, p.edgeL, p.edgeR));
      this.autoCruise = Math.min(AUTO_CRUISE, this.carTop() * 0.85);   // the car's tune as it is now (never above its limit)
      this.ev.toast(`Auto-drive to ${this.routeName}. Steer or brake to take over`, 'info');
    } else { this.autoDrive = false; this.ev.toast(why || 'Auto-drive off. You have control', 'info'); }
    return true;
  }
  // A hand-off passed or missed on the road you're still on (traffic in the way, an exit left too late): the next
  // hand-off is more than 60 m behind the car and the car is not on the road it leads to (clear of that road's lanes by
  // 3 m; OSM ramps leave from inside the carriageway, so the car stays on this road for a while as it takes one, and a
  // ramp can run on past its merge), or 700 m behind whatever. followRoute only replans on a road change, so without
  // this the guidance froze at "0 ft" and Auto-drive drove on up the freeway for good.
  private missedHandOff() {
    const j = this.route[0], p = this.phys, path = this.path;
    if (!this.routeTarget || !j || j.to === path) return false;
    if (!path.out.includes(j)) return true;                                   // not a hand-off from this road at all
    if (j.s >= p.s - 60) return false;
    if (j.s < p.s - 700) return true;
    const q = j.to, pr = q.project(p.x, p.z, clamp(j.toS + (p.s - j.s), 0, q.len), MISS_PR);
    return pr.s >= q.len - 1 || pr.d < q.edgeL - 3 || pr.d > q.edgeR + 3;
  }
  // plan again from where the car is (Rerouting); with no way from here keep the destination, as followRoute does,
  // and hand Auto-drive back
  private replan() {
    if (this.routeVenue && this.path === this.routeTarget) { this.route = []; return true; }   // on the venue's ramp: drive on down it
    const r = this.net.route(this.path, Math.max(0, this.phys.s), this.routeTarget!);
    if (r && r.length) { this.route = r; if (!this.attract) this.ev.toast('Rerouting', 'info'); return true; }
    this.route = [];
    if (this.autoDrive) this.setAutoDrive(false, 'No way from here: Auto-drive off. You have control');
    return false;
  }
  reroutes = 0;                      // replans for a missed hand-off (for tests)
  // the player asked to steer or brake (Input.steerAsked, brakeAsked, or a fastForward's controls): hand back
  private takeOver(steer: boolean, brake: boolean) {
    if (this.autoDrive && (steer || brake)) this.setAutoDrive(false, `${steer ? 'Steering' : 'Braking'}: Auto-drive off. You have control`);
  }
  get mainsLabels() { return this.net.mains.map((m) => m.label); }

  // ----------------------------------------------------------------------------------------- graphics quality
  private applyQuality(rebuild = false) {
    const q = this.preset();
    this.syncLive();
    this.startScale = this.pickStart();
    this.govScale = this.startScale; this.renderScale = q.renderScale * this.govScale;
    this.renderer.shadowMap.enabled = q.shadows > 0;
    const far = this.live.drawDistance * 1.15;
    this.camera.far = far; this.camera.updateProjectionMatrix();
    this.env.setQuality(q.shadows, far);
    if (this.traffic) this.traffic.viewAhead = this.live.drawDistance * 0.95;
    if (rebuild && this.net) {
      this.configureCar();                 // the car's own quality tier may have changed
      this.buildWorld();
      const p = this.phys;
      for (let i = 0; i < 200 && this.roads.update(p.x, p.z, Math.sin(p.psi), Math.cos(p.psi), 6) + this.terrain.update(p.x, p.z, 3) > 0; i++) { /* rebuild what's in view */ }
    }
    this.composer?.dispose(); this.composer = null; this.bloom = null; this.gtao = null; this.outputSat = null; this.grade = null;
    if (q.post) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q.msaa });
      const c = new EffectComposer(this.renderer, rt);
      c.addPass(new RenderPass(this.scene, this.camera));
      if (q.ao) { this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y); this.gtao.blendIntensity = 0.75; c.addPass(this.gtao); }
      // Ultra's bloom is set so the hypercar's LEDs bloom at night without the sky blowing out: a lower threshold
      // (0.85) lets the lamps and the cluster through, a touch more strength (0.3); High keeps its lighter bloom
      if (q.bloom) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), q.grade ? 0.3 : 0.22, 0.45, q.grade ? 0.85 : 0.92);
        // (2026-11-23) the threshold reads luminance x the frame's alpha: every material writes alpha 1, so nothing
        // changes, except the OC Hypercar's paint, which writes its bloom share (car-mats paint o.bloom): its sunlit
        // white body bloomed as a halo round the whole car on Ultra by day, its LEDs and every other light still bloom
        const hp = this.bloom.materialHighPassFilter;
        hp.fragmentShader = hp.fragmentShader.replace('float v = dot( texel.xyz, luma );', 'float v = dot( texel.xyz, luma ) * texel.a;');
        hp.needsUpdate = true;
        c.addPass(this.bloom);
      }
      // Ultra's grade, one small pass between the bloom and the output pass, on the linear HDR frame: a soft
      // vignette, a chromatic aberration that is zero in the centre and about 1.5 px at the corners (red pushed out,
      // blue pulled in, radially), and a faint film grain (about ±5 % of each pixel's own value) that moves with time
      if (q.grade) {
        this.grade = new ShaderPass({
          uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(size.x, size.y) }, time: { value: 0 }, aberration: { value: 1.5 }, grain: { value: 0.012 }, vignette: { value: 0.32 } },
          vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: `
            uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float time; uniform float aberration; uniform float grain; uniform float vignette;
            varying vec2 vUv;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            void main() {
              vec2 c = vUv - 0.5;
              float r2 = dot(c, c) * 2.0;                                   // 0 in the centre, 1 at the corners
              vec2 off = c * r2 * 1.4142 * aberration / resolution;         // radial, |off| = aberration px at a corner
              vec4 g = texture2D(tDiffuse, vUv);
              vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, g.g, texture2D(tDiffuse, vUv - off).b);
              float n = hash(gl_FragCoord.xy + vec2(fract(time * 7.31) * 977.0, fract(time * 3.17) * 613.0)) * 2.0 - 1.0;
              col *= 1.0 + n * grain * 4.0;                                  // proportional: an added grain on the linear frame would lift the night's blacks to grey speckle (0.012 linear is about 28 levels near black after the sRGB curve)
              col *= 1.0 - vignette * smoothstep(0.25, 1.1, r2);
              gl_FragColor = vec4(col, g.a);
            }`,
        });
        c.addPass(this.grade);
      }
      // the output pass with a saturation control folded into its shader (no extra pass): the grade under cloud
      const out = new OutputPass(), sat: THREE.IUniform<number> = { value: 1 };
      (out.uniforms as Record<string, THREE.IUniform>).saturation = sat;
      out.material.fragmentShader = out.material.fragmentShader
        .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\n\t\tuniform float saturation;')
        .replace('// tone mapping', 'gl_FragColor.rgb = mix(vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), gl_FragColor.rgb, saturation);\n\t\t\t// tone mapping');
      c.addPass(out); this.outputSat = sat;
      this.composer = c;
    }
    this.applyStyle();
    this.govLadder(false);                 // the preset's ladder, from the top: the effects as the preset has them
    this.resize(true);                     // a new composer (and grade pass) takes the size even when the canvas kept it
  }

  // ----------------------------------------------------------------------------------------- the frame-time governor
  // the preset in force: the graphics check's while it runs, else the player's (Retro on Low its own)
  private preset(): QualityPreset { return this.benchQ ? QUALITY[this.benchQ] : presetFor(this.settings); }
  private syncLive() {
    const p = this.preset();
    Object.assign(this.live, p);
    if (p.minPixelRatio === undefined) delete this.live.minPixelRatio;
    // the graphics check measures each preset's effects and resolution, not its world: the player's draw distance and
    // scenery stay (nothing is built or dropped for it)
    if (this.benchQ) { const w = presetFor(this.settings); this.live.drawDistance = w.drawDistance; this.live.props = w.props; }
  }
  // the governor works on the standard looks with Adaptive quality on; Retro keeps its own fixed picture, the check its own
  private govOn() { return this.settings.adaptive && !retroOn(this.settings) && !this.benchQ; }
  // where the preset's resolution starts: the graphics check's round while it runs; else the check's saved start scale
  // for this preset, only while Adaptive quality runs it and only when the check chose the preset (the player's own
  // pick, or Adaptive off, renders the preset at its full resolution)
  private pickStart(): number {
    if (this.benchQ) return this.benchScale;
    const b = this.benchPick;
    return b && !b.skipped && !b.inconclusive && b.quality === this.settings.quality && this.govOn() && !this.settings.qualityChosen ? b.scale : 1;
  }
  // the step-down ladder for the preset in force, costliest and least visible first (governor.ts says why)
  private govRungs(): Rung[] {
    const q = this.preset(), r: Rung[] = [];
    if (!this.govOn()) return r;
    if (q.post && q.ao) r.push({ id: 'ao', text: 'AO off', up: 'AO on' });
    if (q.shadows >= 1024) r.push({ id: 'shadow', text: `Shadows ${q.shadows / 2}`, up: `Shadows ${q.shadows}` });
    if (q.post && q.msaa > 0) r.push({ id: 'msaa', text: 'MSAA off', up: `MSAA ${q.msaa}x` });
    if (q.post && q.bloom) r.push({ id: 'bloom', text: 'Bloom off', up: 'Bloom on' });
    r.push({ id: 'draw', text: `Draw distance ${Math.round(q.drawDistance * 0.8)} m`, up: `Draw distance ${q.drawDistance} m` });
    r.push({ id: 'props', text: 'Scenery -25%', up: 'Scenery full' });
    // one traffic step (Moderate and up; Light never goes to none). Never in Speed Survival: its scores stay comparable
    const dn = govDensity(this.density, 1);
    if (dn !== this.density && !(this.mode === 'survival' && !this.attract)) r.push({ id: 'traffic', text: `Traffic ${DENSITY[dn].label}`, up: `Traffic ${DENSITY[this.density].label}` });
    const floor = GOV_FLOOR[this.settings.quality];
    for (let k = 1, n = Math.round((this.startScale - floor) / 0.05); k <= n; k++) r.push({ id: 'scale', text: `Resolution ${Math.round((this.startScale - 0.05 * k) * 100)}%`, up: `Resolution ${Math.round((this.startScale - 0.05 * (k - 1)) * 100)}%` });
    return r;
  }
  // a new ladder: `keep` holds the steps already taken that the new ladder still has (a run's start keeps them; a new
  // preset starts from the top)
  private govLadder(keep: boolean) {
    const old = this.gov.rungs, oldLevel = this.gov.level, rungs = this.govRungs();
    let level = 0;
    if (keep) while (level < rungs.length && old.slice(0, oldLevel).some((o) => o.text === rungs[level].text)) level++;
    // the check's steady-30 lock, set before the reset so its target applies from the first frame
    const b = this.benchPick;
    this.gov.lock30 = !!b && !b.skipped && !b.inconclusive && b.target === 30;
    this.gov.reset(rungs, level, keep);
    this.applyGov(level);
  }
  // put the effects where `level` steps down the ladder has them (from the preset; idempotent: only what changed moves)
  private applyGov(level: number) {
    const q = this.preset(), rungs = this.gov.rungs, world = this.benchQ ? presetFor(this.settings) : q;
    let ao = q.ao, shadows = q.shadows, msaa = q.msaa, bloom = q.bloom, draw = world.drawDistance, props = world.props, traffic = 0, scale = this.startScale;
    for (let i = 0; i < level && i < rungs.length; i++) {
      switch (rungs[i].id) {
        case 'ao': ao = false; break;
        case 'shadow': shadows = q.shadows / 2; break;
        case 'msaa': msaa = 0; break;
        case 'bloom': bloom = false; break;
        case 'draw': draw = world.drawDistance * 0.8; break;
        case 'props': props = world.props * 0.75; break;
        case 'traffic': traffic = 1; break;
        case 'scale': scale -= 0.05; break;
      }
    }
    if (this.gtao) this.gtao.enabled = ao;
    if (this.bloom) this.bloom.enabled = bloom;
    const c = this.composer;
    if (c && c.renderTarget1.samples !== msaa) for (const rt of [c.renderTarget1, c.renderTarget2]) { rt.samples = msaa; rt.dispose(); }
    const L = this.live;
    if (L.shadows !== shadows || L.drawDistance !== draw) {
      L.shadows = shadows; L.drawDistance = draw;
      const far = draw * 1.15;
      this.camera.far = far; this.camera.updateProjectionMatrix();
      this.env.setQuality(shadows, far);
      if (this.traffic) this.traffic.viewAhead = draw * 0.95;
    }
    L.ao = ao; L.msaa = msaa; L.bloom = bloom; L.props = props;
    if (traffic !== this.govTraffic) { this.govTraffic = traffic; if (this.traffic) this.applyDensity(); }
    scale = Math.round(scale * 100) / 100;
    if (scale !== this.govScale) { this.govScale = scale; this.renderScale = q.renderScale * scale; this.resize(); }
  }
  // what this device's display showed before (earlier visits, the graphics check's rounds: any round faster than a
  // cap's interval rules that cap out), into the governor
  private seedDisplay() {
    let min = this.display.minMs;
    for (const r of this.benchPick?.rounds ?? []) if (r.ms > 0 && (!min || r.ms < min)) min = r.ms;
    this.gov.seedDisplay(min, this.display.capMs);
    this.display.capMs = this.gov.capOk;                     // (the exact interval: saved rounded)
  }
  // once a frame, from the frame loop: this frame's interval and the last frame's own work (ms). Not while paused,
  // hidden, parked or walking a venue, or during the graphics check
  private adapt(intervalMs: number) {
    const b = this.bench;
    if (b.on) { b.n++; b.sum += intervalMs; b.work += this.workMs; if (intervalMs > T60 * 1.5) b.slow++; }
    // the overlay's numbers come from every drawn frame, governor on or off (Adaptive off, Retro, the check)
    if (intervalMs > 0) this.gov.record(intervalMs, this.workMs);
    // what the display has shown, kept on this device when the governor learns more (rarely: a faster mean, a cap)
    const d = this.display, g = this.gov;
    if ((g.minMean < 1000 && (!d.minMs || g.minMean < d.minMs - 0.5)) || g.capOk !== d.capMs) { d.minMs = Math.min(d.minMs || 1e9, g.minMean); d.capMs = g.capOk; saveDisplay(d); }
    if (!this.govFeed || !this.govOn() || this.paused || document.hidden || this.foot || this.venueState) { this.gov.restart(0.25); return; }
    this.gov.tick(intervalMs, this.workMs);
  }
  // what the overlay and Settings show: the preset the player chose, "· auto" while the governor runs it
  govLabel(): string {
    const q = presetFor(this.settings);
    return q.label + (this.govOn() ? ' · auto' : '');
  }
  govDetail(): string {
    const g = this.gov;
    if (this.benchQ) return 'graphics check running';
    if (!this.govOn()) return retroOn(this.settings) ? 'Retro keeps its own fixed picture' : 'fixed: Adaptive quality is off';
    const start = this.startScale < 1 ? `starts at ${Math.round(this.startScale * 100)}% resolution (graphics check)` : 'full quality';
    const at = g.level === 0 ? start : `${g.level} of ${g.rungs.length} steps down (${g.rungs[g.level - 1].text})`;
    // a cap only once a probe confirmed it (here or on an earlier visit); while one runs, what the frames do
    const fr = g.probe ? `frames steady at ${Math.round(1000 / g.probe)} fps: checking for a display cap` : g.capMs > g.target ? `display capped at ${g.fps} fps` : `${g.fps} fps target`;
    return `${at} · ${fr}`;
  }
  // the overlay's numbers, all measured here (one object, refilled on each read)
  private perfOut = { fps: 0, low1: 0, frameMs: 0, workMs: 0, calls: 0, tris: 0, label: '', detail: '', last: '', lastAgo: -1, level: 0, levels: 0, target: 60, scale: 1, pixelRatio: 1, injectMs: 0 };
  get perf() {
    const g = this.gov, o = this.perfOut;
    const r1 = (v: number) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
    o.fps = r1(g.fpsOver(60)); o.low1 = r1(g.low1());
    const last = g.ring[(g.head - 1 + g.ring.length) % g.ring.length];
    o.frameMs = Math.round(last * 10) / 10; o.workMs = Math.round(this.workMs * 10) / 10;
    o.calls = this.perfCalls; o.tris = this.perfTris; o.label = this.govLabel(); o.detail = this.govDetail();
    // the last action only while the governor runs (off, its clock stops and the line would go stale)
    const on = this.govOn();
    o.last = on ? g.last : ''; o.lastAgo = !on || g.lastAt < 0 ? -1 : Math.round(g.clock - g.lastAt);
    o.level = g.level; o.levels = g.rungs.length; o.target = g.fps; o.scale = this.govScale;
    o.pixelRatio = Math.round(this.renderer.getPixelRatio() * 100) / 100; o.injectMs = this.injectMs;
    return o;
  }
  // the effects as they stand now (for tests and the feedback report)
  get govState() {
    const L = this.live;
    return { level: this.gov.level, levels: this.gov.rungs.length, rungs: this.gov.rungs.map((r) => r.text), target: this.gov.fps, last: this.gov.last, actions: this.gov.actions,
      ao: !!this.gtao?.enabled, bloom: !!this.bloom?.enabled, msaa: this.composer?.renderTarget1.samples ?? 0, shadows: L.shadows, drawDistance: L.drawDistance, props: L.props,
      traffic: govDensity(this.density, this.govTraffic), scale: this.govScale, floor: GOV_FLOOR[this.settings.quality], startScale: this.startScale, on: this.govOn(), label: this.govLabel() };
  }

  // The first-run graphics check (SMOOTH): about 5 s on the menu, behind its card. It draws the menu's own freeway drive
  // with each preset's effects and resolution in turn, costliest first (Ultra, Ultra at 75 %, High, High at 75 %,
  // Medium, Low), and stops at the first the device holds at 60 (the frames' mean within 10 % of 16.7 ms, at most a
  // tenth of them slow); if none does, the costliest that holds a steady 30. The world itself isn't rebuilt for it (its
  // draw distance and scenery are the menu's). It saves the pick on this device (settings.ts saveBench) and returns it;
  // the caller applies it unless the player chose a preset themselves. null: cancelled, or the tab went to the back.
  benchRunning() { return !!this.benchQ; }
  private benchCancel: { cancelled: boolean } | null = null;
  // end a running check now (the player picked a preset, or a run starts): its rounds stop, the player's preset is in
  // force from the next line on (the caller applies it). True if one was running
  private stopBench() {
    if (!this.benchQ) return false;
    if (this.benchCancel) this.benchCancel.cancelled = true;
    this.bench.on = false; this.benchQ = null; this.benchScale = 1;
    return true;
  }
  async benchmark(onStep?: (i: number, n: number, label: string) => void, cancel?: { cancelled: boolean }): Promise<BenchPick | null> {
    if (this.benchQ || !this.attract || this.ctxLost) return null;
    const rounds: [Quality, number][] = [['ultra', 1], ['ultra', 0.75], ['high', 1], ['high', 0.75], ['medium', 1], ['low', 1]];
    const out: BenchPick['rounds'] = [];
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let pick: [Quality, number, 60 | 30] | null = null, aborted = false, stopped = false;
    const token = cancel ?? { cancelled: false };
    this.benchCancel = token;
    try {
      for (let i = 0; i < rounds.length; i++) {
        const [q, sc] = rounds[i];
        onStep?.(i, rounds.length, QUALITY[q].label + (sc < 1 ? ` at ${Math.round(sc * 100)}%` : ''));
        this.benchQ = q; this.benchScale = sc; this.applyQuality();
        await this.warmUp(null);                             // its programs and targets ready: the round measures frames, not compiles
        if (this.benchQ !== q) { aborted = stopped = true; break; }   // ended from outside (stopBench): the player's preset is back
        await wait(250);                                     // its buffers settle
        const b = this.bench; b.n = 0; b.sum = 0; b.slow = 0; b.work = 0; b.on = true;
        await wait(650);
        b.on = false;
        if (this.benchQ !== q) { aborted = stopped = true; break; }
        if (token.cancelled || document.hidden || !this.attract) { aborted = true; break; }
        const ms = b.n ? b.sum / b.n : 999;
        out.push({ quality: q, scale: sc, ms: Math.round(ms * 10) / 10, work: b.n ? Math.round((b.work / b.n) * 10) / 10 : 0, slow: b.n ? Math.round((b.slow / b.n) * 100) / 100 : 1 });
        if (b.n >= 3 && ms <= T60 * GOV_STEP.over && b.slow / b.n <= 0.1) { pick = [q, sc, 60]; break; }
      }
    } finally {
      this.bench.on = false; this.benchQ = null; this.benchScale = 1;
      if (this.benchCancel === token) this.benchCancel = null;
    }
    if (stopped) return null;                                // whoever stopped it has the player's preset in force
    if (aborted) { this.applyQuality(); if (this.attract) void this.warmUp(null); return null; }
    this.seedDisplay();                                      // a round faster than a cap's interval rules that cap out
    // every round at a display/browser cap (30, 40 or 50 fps) with light work: the cap, not the device, set the
    // frames, so the check can't tell. Inconclusive: the player's preset stays, no start scale, never a 30 lock
    if (!pick && out.length && out.every((r) => (r.work ?? 0) < r.ms * GOV_STEP.capLight && capPeriod(r.ms) > 0)) {
      const res: BenchPick = { v: 1, quality: this.settings.quality, scale: 1, target: 60, inconclusive: true, cap: Math.round(1000 / capPeriod(out[0].ms)), at: new Date().toISOString(), rounds: out };
      saveBench(res); this.benchPick = res;
      this.applyQuality();
      void this.warmUp(null);
      return res;
    }
    if (!pick) {
      const ok = out.find((r) => r.ms <= T30 * GOV_STEP.over);
      pick = ok ? [ok.quality, ok.scale, 30] : ['low', 1, 30];
    }
    const res: BenchPick = { v: 1, quality: pick[0], scale: pick[1], target: pick[2], at: new Date().toISOString(), rounds: out };
    saveBench(res); this.benchPick = res;
    this.applyQuality();                                     // the player's preset back, with the pick's start if it is this one
    void this.warmUp(null);                                  // and ready before a run starts on it
    return res;
  }
  // the player skipped the check: it doesn't ask again on this device (Settings runs it)
  skipBenchmark() {
    const res: BenchPick = { v: 1, quality: this.settings.quality, scale: 1, target: 60, skipped: true, at: new Date().toISOString(), rounds: [] };
    saveBench(res); this.benchPick = res;
  }
  get benchSaved() { return this.benchPick; }
  // RS1: the Retro style (src/game/render/style.ts) on Low while Settings.style says so: attached with the tier, its
  // materials, sky and pass all undone when it goes. The road chunks and terrain tiles are styled as they're built.
  // Low has no composer (post is off), so the frame takes the style's own pass in place of renderer.render (draw), and
  // the sky camera's corner takes its rectangle version (drawSky).
  private style: RetroStyle | null = null;
  // (off while the graphics check runs: its rounds measure the standard presets, and a new player's Retro Low comes back
  // when it ends)
  private applyStyle() {
    const on = retroOn(this.settings) && !this.benchQ, roots = this.roads ? [this.roads.group, this.terrain.group] : [];
    if (!on && this.style) { this.style.detach(); this.style = null; }
    if (on && !this.style) { this.style = new RetroStyle(this.renderer); this.style.attach(this.scene, roots); }
    this.style?.watch(roots);
  }

  // Fit the drawing buffer to the stage. setPixelRatio and setSize reassign canvas.width and height, which clears the
  // buffer even at the same values, so nothing is touched when the size, the pixel ratio and the canvas already agree:
  // the ResizeObserver runs after the frame's render, and a buffer cleared there was presented as a blank frame (once per
  // turn of an iPhone, every frame of a window or viewer-panel drag). Returns whether it changed (and so cleared) it.
  private applied = { w: 0, h: 0, pr: 0 };
  private resize(force = false): boolean {
    const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
    const q = this.preset(), dpr = window.devicePixelRatio || 1;
    // the preset's own pixel ratio on this screen (its floor: 0.5 as always, or the preset's own: Retro the screen's CSS
    // pixels, never more than the device has), then the governor's share of it, never under 0.5
    const lo = q.minPixelRatio !== undefined ? Math.min(q.minPixelRatio, dpr) : 0.5;
    const base = clamp(dpr * q.renderScale, lo, q.maxPixelRatio);
    const pr = this.govScale >= 1 ? base : Math.max(Math.min(lo, base), Math.round(base * this.govScale * 100) / 100);
    const cv = this.renderer.domElement, a = this.applied;
    if (!force && w === a.w && h === a.h && pr === a.pr && cv.width === Math.floor(w * pr) && cv.height === Math.floor(h * pr)) return false;
    a.w = w; a.h = h; a.pr = pr;
    if (this.renderer.getPixelRatio() !== pr) this.renderer.setPixelRatio(pr);   // it calls setSize too: one reallocation, not two
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(pr); this.composer?.setSize(w, h);
    if (this.grade) (this.grade.uniforms.resolution.value as THREE.Vector2).set(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    return true;
  }
  private onResize = () => { this.resize(); };
  // the stage's ResizeObserver: its callbacks run after the frame's render and before the paint, so a buffer it resized
  // (and cleared) is drawn again at once, from the state the frame left, or that empty buffer is what the screen shows
  private onStageResize = () => {
    if (this.resize() && this.raf && !this.ctxLost) this.draw(performance.now(), 0);
  };
  private onVisibility = () => { if (document.hidden && !this.attract && !this.foot) this.setPaused(true); };

  // ----------------------------------------------------------------------------------------- a lost WebGL context
  // iOS drops a page's WebGL context when the app goes to the background or memory runs short, and the browser hands
  // back a new, empty one later; the loss can come again. three re-creates its own state on the restore (programs,
  // buffers, and textures with a source to upload again), but whatever was only ever drawn on the GPU is gone: the
  // environment map (PMREM) that lights and reflects every lit material, so the cabin drew pure black and stayed so.
  // This is the one restore path: everything the game draws into a GPU-only target is rebuilt here, in order, and other
  // parts register their own rebuilds with onContextRestored (they run last, after the scene's own).
  private restorers = new Set<(n: number) => void>();
  /** how many times the context has been restored this session (for tests) */
  contextRestores = 0;
  /**
   * Run `fn` each time a lost WebGL context comes back, after the game has rebuilt its own GPU resources (the
   * environment map, the composer and its targets, the shadow maps; scene.environment is already the new map). For a
   * part that draws its own textures or targets on the GPU (a procedural texture rendered by a shader, a reflection
   * probe): rebuild them in `fn`. Textures with a CPU source (canvas, ImageData, data arrays) come back by themselves.
   * `fn` gets the restore's number (1 for the first). Returns a function that unregisters it; call that on dispose.
   */
  onContextRestored(fn: (n: number) => void): () => void {
    this.restorers.add(fn);
    return () => { this.restorers.delete(fn); };
  }
  private onContextLost = (e: Event) => {
    e.preventDefault();                                         // or the browser never offers it back
    if (this.ctxLost) return;
    this.ctxLost = true;
    this.setPaused(true);
    this.ev.context(true);
  };
  private onContextRestore = () => {
    if (!this.ctxLost) return;                                  // one restore per loss
    this.ctxLost = false;
    const n = ++this.contextRestores;
    try { this.restoreGpu(); } catch (e) { console.warn('context restore', e); }
    for (const fn of [...this.restorers]) { try { fn(n); } catch (e) { console.warn('context restore hook', e); } }
    this.ev.context(false);
  };
  private restoreGpu() {
    // the environment map, drawn again now; any material holding the old map as its own envMap takes the new one
    const { from, to } = this.env.restore();
    // every texture with a CPU source (canvas, ImageData, data) uploaded again: three would on first use anyway, as its
    // record of them went with the old context; marking them keeps that true even for one three still thinks is current
    const seen = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) {
        const mm = m as THREE.Material & { envMap?: THREE.Texture | null };
        if (from && mm.envMap === from) { mm.envMap = to; mm.needsUpdate = true; }
        for (const v of Object.values(m)) {
          if (!(v instanceof THREE.Texture) || seen.has(v)) continue;
          seen.add(v);
          const t = v as THREE.Texture & { isRenderTargetTexture?: boolean; isDepthTexture?: boolean; isFramebufferTexture?: boolean };
          if (t.isRenderTargetTexture || t.isDepthTexture || t.isFramebufferTexture || t === to) continue;
          const img = t.image as { width?: number; data?: unknown } | null;
          if (img && (img.data || (img.width ?? 0) > 0)) t.needsUpdate = true;
        }
        if ((m as THREE.ShaderMaterial).uniforms) {
          for (const u of Object.values((m as THREE.ShaderMaterial).uniforms)) if (from && u && u.value === from) u.value = to;
        }
      }
    });
    // the sun's shadow map, made and drawn again on the next frame
    this.env.restoreShadows();
    this.renderer.shadowMap.needsUpdate = true;
    // the composer and its targets made again at the current size, the Retro pass kept. What went with the old context
    // is dropped, not disposed, here and below: three's dispose would send its stale handles to the new context
    this.composer = null;
    this.applyQuality();
    // the garage's reveal stage, if one is open: its own environment map was GPU-only too
    const r = this.rv;
    if (r?.stage) { r.stage = null; r.compiled = false; this.buildRevealStage(); r.dirty = true; }
    // the sky camera's corner: copied again on the next frame
    this.skyAt = -1e9;
  }

  // ----------------------------------------------------------------------------------------- input actions
  private actions() {
    if (!this.phys.auto && !this.attract && !this.paused && this.time >= this.manualUntil) this.phys.auto = true;   // the hold ran out
    for (const a of this.input.takeActions()) {
      if (a === 'pause') { if (!this.attract && !this.over) this.setPaused(!this.paused); continue; }
      if (this.paused || this.attract) continue;
      if (a === 'camera') this.setCam(CAMS[(CAMS.indexOf(this.cam) + 1) % CAMS.length]);
      if (a === 'reset') this.resetCar();
      if (a === 'hud') { this.hudOn = !this.hudOn; this.ev.hudToggle(this.hudOn); }
      if (a === 'corner') this.cycleCorner();
      if (a === 'ability') this.useAbility();
      if (a === 'hop') this.thrustHop();
      if (a === 'radio') this.cycleRadio();
      if (a === 'shiftUp' || a === 'shiftDown') {
        // the gearbox is automatic (owner, 2026-11-22); a shift is a manual hold of MANUAL_HOLD_S, which every further shift
        // renews, and then automatic takes back over
        this.holdManual();
        const dir = a === 'shiftUp' ? 1 : -1;
        if (this.phys.shift(dir)) { this.car.flickPaddle(dir); this.audio.shift(); }
      }
    }
  }
  cycleCorner() {
    const order: Settings['corner'][] = ['map', 'sky', 'off'];
    const next = order[(order.indexOf(this.settings.corner) + 1) % order.length];
    this.settings = { ...this.settings, corner: next };
    this.ev.corner(next);
  }
  setCam(c: CamMode) {
    if (c === this.cam) return;
    this.camFrom.p.copy(this.camera.position); this.camFrom.q.copy(this.camera.quaternion);
    this.camBlend = 0; this.cam = c;
    this.input.freeLook = c === 'free';
    if (c === 'chase') this.chasePos.copy(this.camera.position);
    this.ev.toast(CAM_LABEL[c], 'info');
  }
  cycleCam() { this.setCam(CAMS[(CAMS.indexOf(this.cam) + 1) % CAMS.length]); }
  // a manual hold: automatic steps aside for MANUAL_HOLD_S (every shift renews it), then takes back over (actions())
  holdManual() {
    if (this.attract || this.paused) return;
    if (this.phys.auto) { this.phys.auto = false; this.ev.toast('Manual for a moment · automatic takes over', 'info'); }
    this.manualUntil = this.time + MANUAL_HOLD_S;
  }
  pushAction(a: Parameters<Input['push']>[0]) { this.input.push(a); }
  setMapCanvas(c: HTMLCanvasElement | null) { this.mapCanvas = c; }

  private resetCar() {
    const p = this.path, s = clamp(this.phys.s + 5, 2, p.len - 2), lane = p.laneOf(clamp(this.phys.d, p.edgeL, p.edgeR));
    const at = p.at(s, p.laneCenter(lane));
    this.traffic.clearAround(at.x, at.z);
    this.placeCar(p, s, lane, 0);
    this.ev.toast('Back on the road', 'info');
  }

  private view(): PlayerView {
    const p = this.phys, path = this.path, h = path.heading(clamp(p.s, 0, path.len));
    let rel = p.psi - h; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const sf = Math.sin(p.psi), cf = Math.cos(p.psi);
    return {
      path, s: p.s, d: p.d, v: p.vx * Math.cos(rel) + p.vy * Math.sin(rel), vd: -p.vx * Math.sin(rel) - p.vy * Math.cos(rel), rel,
      len: SPEC.halfL * 2, wid: SPEC.halfW * 2, x: p.x, z: p.z, y: p.y, psi: p.psi, wx: sf * p.vx + cf * p.vy, wz: cf * p.vx - sf * p.vy,
      px: p.px, pz: p.pz, ppsi: p.ppsi, altitude: p.altitude,
    };
  }

  // ----------------------------------------------------------------------------------------- which road you're on
  private trackPath() {
    const p = this.phys, cur = this.path;
    const onCur = p.s >= -0.5 && p.s <= cur.len + 0.5 && p.d >= cur.paveL - 0.8 && p.d <= cur.paveR + 0.8;
    const inLanes = onCur && p.d >= cur.edgeL - 0.3 && p.d <= cur.edgeR + 0.3;
    if (inLanes && (this.steps & 3) !== 0) return;
    const hits = this.net.surfaces(p.x, p.z, p.y, 0.8, this.cands);
    const score = (h: Hit) => {
      const path = h.path;
      let rel = p.psi - path.heading(clamp(h.s, 0, path.len)); rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const lanes = h.d >= path.edgeL - 0.3 && h.d <= path.edgeR + 0.3 ? 2 : 0;
      return lanes + Math.cos(rel) * 2 + (path === cur ? 1.2 : 0) + (this.route[0]?.to === path ? 0.8 : 0);
    };
    let best: Hit | null = null, bestScore = -1e9;
    for (const h of hits) { const sc = score(h); if (sc > bestScore) { best = h; bestScore = sc; } }
    if (!best || best.path === cur) return;
    this.enterPath(best.path, best.s, best.d);
  }
  private enterPath(path: Path, s: number, d: number) {
    this.path = path; this.phys.s = s; this.phys.d = d;
    this.switches++;
    this.followRoute(path, s);
    if (path.main) {
      this.visited.add(path.label);
      if (path !== this.lastMain && !this.attract) {
        this.ev.toast(path.label + (path.name ? ' · ' + path.name : ''), 'info');
        const crossed = this.lastMain && this.lastMain.route !== path.route ? 1 : 0;
        this.earned(this.profile.add({ freeway: path.label, interchange: crossed }));
      }
      this.lastMain = path;
    }
  }
  // keep the navigator on track on the road you're now on: tick off the hand-off you just made, plan again if you've
  // left the route (if there's no way from this road, a ramp you've spun onto backwards say, keep the destination and
  // try again at the next road), or arrive
  private followRoute(path: Path, s: number) {
    if (this.route.length && this.route[0].to === path) this.route.shift();
    else if (this.routeTarget && path !== this.routeTarget && !this.route.some((j) => j.to === path)) {
      const r = this.net.route(path, Math.max(0, s), this.routeTarget);
      this.route = r ?? [];
      if (r && !this.attract) this.ev.toast('Rerouting', 'info');
    }
    if (this.routeTarget === path && this.routeVenue) this.route = [];   // a venue's ramp: on down it to the street
    else if (this.routeTarget === path) {
      this.route = []; this.routeTarget = null;
      // Auto-drive hands back on arrival, in the same toast
      if (!this.attract) this.ev.toast(`You made it: ${path.label}` + (this.autoDrive ? '. Auto-drive off: you have control' : ''), 'good');
      // its pedal lifts as it hands back (the driver's own input sets it from the next frame; a fast-forward with no
      // input of its own would otherwise hold the autopilot's last throttle)
      if (this.autoDrive) this.input.c.throttle = 0;
      this.autoDrive = false; this.navNow();                                 // the button and the AUTO tag go at once
    }
  }

  // the end of the road: turn around (a freeway that just stops) or rejoin from the street (an off-ramp)
  private rejoin() {
    const p = this.phys, cur = this.path;
    if (cur.main) {
      const other = this.net.mains.find((m) => m.route === cur.route && m !== cur)!;
      const pr = other.project(p.x, p.z, other.len - p.s);
      const s = clamp(pr.s + 25, 5, other.len - 5);
      this.placeCar(other, s, 1, Math.min(Math.abs(p.vx), 25));
      this.ev.toast(`End of the freeway. Turned around: ${other.label}`, 'info');
      return;
    }
    // an on-ramp starting near here (from the same street), preferably back the way you were going
    let best: Path | null = null, bestScore = 1e9;
    for (const q of this.net.paths) {
      if (q.main || q.prev || q.inc.length) continue;
      const dist = Math.hypot(q.xs[0] - p.x, q.zs[0] - p.z);
      if (dist > 700) continue;
      const lead = this.net.leadsTo(q);
      if (!lead) continue;
      const sc = dist + (this.lastMain && lead === this.lastMain.label ? 0 : 400);
      if (sc < bestScore) { bestScore = sc; best = q; }
    }
    if (best) {
      this.placeCar(best, 4, 0, 12);
      this.ev.toast(`Back on: ${this.net.leadsTo(best)}`, 'info');
      return;
    }
    const m = this.lastMain ?? this.net.mains[0], pr = m.project(p.x, p.z, p.s);
    this.placeCar(m, clamp(pr.s, 5, m.len - 5), 1, 15);
    this.ev.toast(`Back on ${m.label}`, 'info');
  }

  // ----------------------------------------------------------------------------------------- autopilot
  // the menu's demo driver and the test driver: picks the clearest lane, checks the mirror, brakes by closing speed,
  // slows for curves, and follows the route through interchanges (pure pursuit on whichever road it's taking)
  private apLane = 1;
  private autopilot(c: Controls, cruise = 31) {
    const p = this.phys, path = this.path, v = Math.max(3, p.vx);
    const lanes = path.lanes;
    // a car counts as in lane l when it is there, or is signalling and moving into it (t.to while its change runs)
    const inLane = (t: TrafficCar, l: number, tol: number) => Math.abs(t.d - path.laneCenter(l)) <= tol || (t.t >= 0 && t.to === l);
    const ahead = (l: number) => {
      let g = 1e9, sp = 0;
      for (const t of this.traffic.cars) {
        if (t.path !== path || !inLane(t, l, 2.3) || t.s < p.s - 2) continue;
        const d = t.s - p.s - this.traffic.classes[t.cls].len / 2 - SPEC.halfL; if (d < g) { g = d; sp = t.v; }
      }
      return { g, v: sp };
    };
    const clear = (l: number) => this.traffic.cars.every((t) => t.path !== path || !inLane(t, l, 2.6) || t.s < p.s - 25 || t.s > p.s + 30);
    // where the route wants you
    const next = this.route[0];
    let want = -1;
    const side = next ? this.sideOf(path, next) : 'R';
    if (next && next.kind === 'diverge' && next.s - p.s < 1600) want = side === 'R' ? lanes - 1 : 0;
    this.apLane = clamp(this.apLane, 0, lanes - 1);
    const cur = this.apLane, here = ahead(cur);
    const settled = Math.abs(p.d - path.laneCenter(cur)) < 0.6;
    if (want >= 0 && settled && want !== cur) { const step = cur + Math.sign(want - cur); if (clear(step)) this.apLane = step; }
    else if (settled && want < 0 && here.g < Math.max(90, p.vx * 3)) {
      let best = cur, bestG = here.g + 40;
      for (const l of [cur - 1, cur + 1]) { if (l < 0 || l >= lanes) continue; const a2 = ahead(l); if (a2.g > bestG && clear(l)) { best = l; bestG = a2.g; } }
      this.apLane = best;
    }
    // pure pursuit: a point `look` metres ahead on the road we mean to be on (carrying on into the route's next road)
    const look = clamp(6 + v * 0.75, 9, 70);
    const aim = (q: Path, s: number, off: number) => {
      let ts = s + look, tq = q;
      if (ts > tq.len) {
        const on = this.route.find((j) => j.to !== tq && j.s >= tq.len - 1 && tq.out.includes(j)) ?? null;
        const nq = on ? on.to : tq.next;
        if (nq) { ts = (on ? on.toS : 0) + (ts - tq.len); tq = nq; off = tq.main ? off : 0; }
      }
      return tq.at(clamp(ts, 0, tq.len), tq === q ? off : (tq.main ? tq.laneCenter(Math.min(1, tq.lanes - 1)) : 0));
    };
    let tgt = aim(path, p.s, path.laneCenter(this.apLane));
    let follow = path, fs = p.s;
    if (next) {
      const dist = next.s - p.s, q = next.to;
      const qs = q.project(p.x, p.z, Math.max(0, next.toS + (p.s - next.s))).s;
      if (next.kind === 'diverge' && dist < 160 && dist > -700) {
        // OSM ramps leave from the middle of the carriageway: only steer for the ramp once it's further out than our lane
        const r = aim(q, qs, 0), pr = path.project(r.x, r.z, p.s + look);
        const lane = path.laneCenter(side === 'R' ? lanes - 1 : 0);
        if (side === 'R' ? pr.d > lane - 0.3 : pr.d < lane + 0.3) { tgt = r; follow = q; fs = qs; }
      } else if (next.kind === 'merge' && dist < 120 + v * 2) {
        // joining a freeway: line up with its outside lane on the side we're coming in from
        const into = this.sideOfMerge(path, next);
        tgt = aim(q, qs, q.laneCenter(into === 'R' ? q.lanes - 1 : 0)); follow = q; fs = qs;
      } else if (next.kind === 'continue' && dist < look) { follow = q; fs = qs; tgt = aim(q, qs, q.main ? q.laneCenter(Math.min(1, q.lanes - 1)) : 0); }
    }
    const dx = tgt.x - p.x, dz = tgt.z - p.z;
    const fwd = dx * Math.sin(p.psi) + dz * Math.cos(p.psi), left = dx * Math.cos(p.psi) - dz * Math.sin(p.psi);
    const alpha = Math.atan2(left, Math.max(0.1, fwd)), Ld = Math.hypot(dx, dz);
    // pure pursuit's arc, plus yaw-rate damping so lane changes at speed don't wag
    const kappa = (2 * Math.sin(alpha)) / Math.max(1, Ld), Lw = SPEC.a + SPEC.b;
    const deltaLeft = Math.atan(Lw * kappa) + 0.55 * (kappa * v - p.r) * (Lw / v);
    c.steer = clamp(-deltaLeft / this.phys.maxDelta(), -1, 1);
    // speed: traffic ahead, and the sharpest curve in the next stretch
    let kmax = 0;
    for (let s2 = 0; s2 < 40 + v * 3; s2 += 6) {
      let q = follow, ss = fs + s2;
      if (ss > q.len && q.next) { ss -= q.len; q = q.next; }
      kmax = Math.max(kmax, Math.abs(q.sample(clamp(ss, 0, q.len)).k));
    }
    const target = Math.min(cruise, Math.sqrt(7.5 / Math.max(kmax, 1e-5)));
    const lead = ahead(this.apLane), closing = Math.max(0, p.vx - lead.v);
    const safe = 10 + p.vx * 0.5 + (closing * closing) / 14;
    const tooFast = p.vx > target + 1.5;
    c.throttle = p.vx < target && lead.g > safe ? 0.85 : 0.04;
    // in a slide, lift as a driver does: from 1.4° of body slip, down to 5 % by 3.4°. In Simulation the traction control
    // only catches a spin, so 0.85 throttle out of a slow-down could step a torquey car's tail out and walk it across a
    // lane (the OC Hypercar's race tune into a box truck, hypercar M4); the arcade profiles rarely pass 1°
    c.throttle *= 1 - 0.95 * smoothstep(0.025, 0.06, Math.abs(Math.atan2(p.vy, Math.max(1, p.vx))));
    c.brake = lead.g < safe * 0.75 ? clamp((safe * 0.75 - lead.g) / 15 + 0.2, 0.2, 1) : tooFast ? clamp((p.vx - target) / 12, 0.1, 0.7) : 0;
    c.handbrake = false;
  }
  // which side of the freeway a ramp comes in on (seen from the freeway)
  private sideOfMerge(ramp: Path, j: Junction): 'L' | 'R' {
    const m = j.to, b = ramp.at(Math.max(0, ramp.len - 120), 0);
    return m.project(b.x, b.z, Math.max(0, j.toS - 120)).d >= 0 ? 'R' : 'L';
  }
  // which side a ramp leaves on, judged against the curving road (not the tangent at the split)
  private sideOf(path: Path, j: Junction): 'L' | 'R' {
    const b = j.to.at(Math.min(j.to.len, j.toS + 150), 0);
    return path.project(b.x, b.z, j.s + 150).d >= 0 ? 'R' : 'L';
  }


  // ----------------------------------------------------------------------------------------- the loop
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (this.warming > 0) return;                                  // the warm-up draws its own hidden frames behind the loading screen
    // a steady 30 where the governor aims at it: every other display frame at 60 Hz (rendering only ever on rAF)
    if (this.gov.target === T30 && this.govOn() && now - this.lastDrawn < T30 - 4) return;
    const t0 = performance.now();
    const interval = this.lastDrawn > 0 ? now - this.lastDrawn : 0; this.lastDrawn = now;
    this.frames++;
    if (this.ctxLost) return;
    let dt = (now - this.last) / 1000; this.last = now;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    this.fpsN++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsT); this.fpsN = 0; this.fpsT = 0; }
    this.adapt(interval);
    this.actions();
    if (!this.paused) {
      this.input.update(dt, Math.abs(this.phys.vx));
      if (this.attract) this.autopilot(this.input.c);
      else this.takeOver(this.input.steerAsked, this.input.brakeAsked);
      this.acc += dt;
      let steps = 0;
      // Auto-drive steers every step, as fastForward's autopilot does, so a slow frame doesn't leave it unsteered
      while (this.acc >= DT && steps < 12) { if (this.autoDrive) this.autopilot(this.input.c, this.autoCruise); this.simulate(DT); this.acc -= DT; steps++; }
      if (steps === 12) this.acc = 0;
      this.time += dt;
    }
    const alpha = this.paused ? 1 : this.acc / DT;
    this.stream(1);
    this.car.update(dt, alpha, this.phys, this.input.c.brake > 0.05 && this.phys.gear > 0, this.time, this.path);
    this.car.updateCockpit(dt, {
      delta: this.phys.delta, rpm: this.phys.rpm, gear: this.phys.gear, auto: this.phys.auto, limiter: this.phys.limiter,
      speed: Math.abs(this.phys.vx), throttle: this.input.c.throttle, brake: this.input.c.brake, paused: this.paused,
      handling: this.phys.handling, tank: this.hyper.tank, tcs: this.phys.tc, abs: this.phys.abs, ax: this.phys.ax, ay: this.phys.ay,
    });
    {
      const h = this.hyper, p = this.phys;
      this.car.setThrustGauge(h.live, h.tank, h.fan > 0.3, p.airborne, this.cam === 'cockpit' || this.cam === 'free', dt, h.charging);
      const fx = Math.sin(p.psi), fz = Math.cos(p.psi);
      this.jets.update(this.paused ? 0 : dt, h.live ? this.car.nozzleWorld() : null, fx, fz, fx * p.vx + fz * p.vy, fz * p.vx - fx * p.vy, this.env.daylight);
    }
    this.traffic.render(alpha, this.time);
    this.updateCamera(dt);
    this.chevrons.update(this.path, this.phys.s, this.phys.d, this.route, !this.attract);
    this.weatherTick(dt);
    this.realism(dt);
    this.env.follow(this.car.root.position, this.camera, this.time, this.paused ? 0 : dt, this.carVel.set(Math.sin(this.phys.psi) * this.phys.vx, 0, Math.cos(this.phys.psi) * this.phys.vx));
    this.car.updateSunShade(this.env.sunDir, dt, false, this.renderer.shadowMap.enabled ? this.net : undefined);     // the sun on the driver's arms through the cabin's glass and under bridges' decks where the world casts shadows (hands-sun.ts)
    this.draw(now, dt);
    this.renderCorner(dt);
    if (!this.attract) {
      this.audio.update(dt, { rpm: this.phys.rpm, throttle: this.phys.throttleOut, speed: Math.abs(this.phys.vx), slip: Math.max(this.phys.slipR, this.phys.slipF) + (this.input.c.handbrake ? 0.2 : 0), limiter: this.phys.limiter, scrape: this.scrape, cockpit: this.cam === 'cockpit' || this.cam === 'free' });
      const h = this.hyper;
      this.audio.setThrust(h.fan, h.live && h.charging);
      if (h.fulls !== this.fulls) { this.fulls = h.fulls; if (h.live) this.audio.tankFull(); }
      this.scrape = Math.max(0, this.scrape - dt * 3);
    }
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.sendHud(); }
    if (this.injectMs > 0) while (performance.now() - t0 < this.injectMs) { /* the test hook's artificial frame cost */ }
    this.workMs = performance.now() - t0;
  };

  // the frame's pictures, from the state the frame has set up: the loop's, and once more at once after the stage's
  // ResizeObserver resized (and so cleared) the drawing buffer (onStageResize)
  private draw(now: number, dt: number) {
    this.renderSky(now);                                // into the corner's own canvas, before the main view (see renderSky)
    const view = this.view3(), seat = view === 'cockpit' || view === 'free';
    this.car.setOutsideView(!seat);
    if (seat) this.car.setCabinLight(this.env.daylight);
    if (this.outputSat) this.outputSat.value = this.env.saturation;
    if (this.grade) this.grade.uniforms.time.value = (now / 1000) % 1000;   // the grain moves every frame, paused or not
    this.renderReveal(dt);                              // the garage's reveal stage, under this frame's own render
    this.renderStills();                                // and the showroom's stills for the carousel's neighbours
    // the frame's draw calls and triangles for the overlay: every pass of the main view counted together
    const info = this.renderer.info, auto = info.autoReset;
    info.reset(); info.autoReset = false;
    if (this.composer) this.composer.render(dt); else if (this.style) this.style.render(this.scene, this.camera, this.env); else this.renderer.render(this.scene, this.camera);
    this.perfCalls = info.render.calls; this.perfTris = info.render.triangles;
    info.autoReset = auto;
    this.env.renderFlare();
    this.renderSkyDirect();                             // the sky camera's fallback, over the finished frame
  }

  // Ultra Realism: the edges close in and the world goes quiet as the speed builds, and the car buzzes at speed
  private realism(dt: number) {
    // tunnel vision starts at 150 mph (owner, 2026-11-18; it was about 100); the muffled sound keeps its own ramp
    const on = this.ultraOn(), v = Math.abs(this.phys.vx), k = smoothstep(45, 95, v), kt = smoothstep(TUNNEL_FROM, TUNNEL_FROM + 33, v);
    this.tunnel = damp(this.tunnel, on && this.settings.ultraTunnel ? kt * 0.9 : 0, 3, dt);
    this.audio.setMuffle(on && this.settings.ultraMuffle ? lerp(20000, 1900, k) : 20000);
  }

  // the weather reaches everything: grip, traffic pace, the road's sheen, headlights, lamps, the sound of rain
  private carVel = new THREE.Vector3();
  private weatherTick(dt: number) {
    const e = this.env;
    e.update(dt);
    this.traffic.pace = 1 - 0.14 * e.wet - 0.1 * (1 - Math.min(1, e.visibility * 3));
    this.roads.setWet(e.wet);
    const dark = 1 - e.daylight, gloom = Math.max(dark, e.visibility < 0.3 ? 0.6 : 0, e.wet > 0.5 ? 0.5 : 0);
    // a ramp, not a switch: the beams stay off through sunset, come up faintly through dusk and reach full at night
    this.car.setHeadlights(smoothstep(0.35, 0.8, gloom), dark);
    const lamp = P.mats.lampHead() as THREE.MeshStandardMaterial;
    lamp.emissive.setRGB(1, 0.86, 0.62); lamp.emissiveIntensity = dark > 0.4 ? 3.2 * dark : 0.05;
    if (!this.attract) this.audio.setRain(e.wet > 0.5 && e.visibility > 0.3 ? e.wet : 0);
  }

  private stream(budget: number) {
    const p = this.phys, h = p.psi;
    this.roads.update(p.x, p.z, Math.sin(h), Math.cos(h), budget);
    this.terrain.update(p.x, p.z, budget);
    if (Math.abs(p.x - ORIGIN.x) > 1500 || Math.abs(p.z - ORIGIN.z) > 1500) this.recentre();
  }

  private simulate(dt: number) {
    const p = this.phys;
    this.steps++;
    if (this.venueState) { this.car.snapshot(p); return; }        // parked at a venue (or on foot): the car stays put
    const c = this.input.c;
    p.grip = this.env.grip * this.gripBoost * this.carGrip;
    this.hyper.step(dt, p, c, !this.attract && !this.over);       // writes p.ext (thrust, fan suction); zero for every other car
    p.step(dt, this.over ? { ...c, throttle: 0, brake: 0.3 } : c, this.path, this.net);
    if (p.airborne) { this.hopLog.apex = Math.max(this.hopLog.apex, p.altitude); this.hopLog.air += dt; }
    if (!p.airborne) this.trackPath();                            // a hop always lands on the road it left
    // a venue's exit ramp, ARRIVE_M before it meets the street: the fade parks you there (street driving isn't built)
    if (this.venueAllowed) { const vr = this.vramps().get(this.path); if (vr && toStreet(this.vramps(), vr, p.s) <= ARRIVE_M) { this.arriveVenue(vr); return; } }
    // the end of the road: turned around or put back on, and the route planned again from there
    if (!this.path.next && p.s > this.path.end - 30 && p.vx > 0.5) { this.rejoin(); this.route = []; this.followRoute(this.path, this.phys.s); }
    // a missed hand-off on this road: plan again from here (four times a second)
    if (!this.attract && !this.over && this.steps % 30 === 0 && this.missedHandOff()) { this.reroutes++; this.replan(); }
    this.car.snapshot(p);
    const playing = !this.attract && !this.over;
    // walls
    for (const im of p.impacts) {
      if (im.kind === 'land') {
        // the landing: the springs compress, the camera dips, a thump and a chirp from the tyres; never a crash
        this.car.land(im.speed);
        this.dip.a = Math.min(0.12, 0.016 * im.speed); this.dip.t = 0;
        // (the shake's random jolt capped at the old 1.5 m hop's: the bigger hop lands at up to 8 m/s down, and its
        // settle is the dip and the springs, not more jitter)
        this.shake = Math.max(this.shake, Math.min(0.4, im.speed / 14));
        if (!this.attract) this.audio.land(im.speed, Math.abs(p.vx));
        this.hopLog.landV = im.speed; this.hopLog.landMph = Math.abs(p.vx) * MPH;
        continue;
      }
      if (im.speed > 1.2) { this.scrape = Math.min(1, this.scrape + im.speed * 0.08); this.shake = Math.max(this.shake, Math.min(1, im.speed / 14)); }
      if (im.speed > 3) this.streak = 0;
      if (im.speed > 6) { this.audio.thump(im.speed); this.combo = 1; if (playing) { this.collisions++; this.crashed(); } }
      if (this.mode === 'survival' && playing && im.speed > 17) this.crashEnd('Hit the wall');
    }
    p.impacts.length = 0;
    // traffic
    const view = this.view();
    // the ability's end in the air holds until touchdown, and a Focus Time asked for in the air starts there
    if (this.ability.update(dt) === 'end') { if (p.airborne) this.abilityEndHeld = true; else this.endAbility(); }
    if (!p.airborne && this.abilityEndHeld) this.endAbility();
    if (!p.airborne && this.focusOnLand) { this.focusOnLand = false; this.tryAbility(); }
    if (this.poseT > 0) { this.poseT -= dt; if (this.poseT <= 0) this.car.setPose(null); }
    const passes = this.traffic.step(dt * this.worldScale, view, this.time);
    const nContacts = this.traffic.collide(view, dt, dt * this.worldScale);
    for (let ci = 0; ci < nContacts; ci++) {
      const contact = this.traffic.contacts[ci];
      p.x += contact.nx * contact.depth; p.z += contact.nz * contact.depth;
      if (p.airborne) {
        // in a hop the car is bound to its road (the air step rebuilds x and z from s and d), so the shove out of the
        // other vehicle moves it back along and across the road instead
        const rh = this.path.heading(clamp(p.s, 0, this.path.len)), sinH = Math.sin(rh), cosH = Math.cos(rh);
        p.s = clamp(p.s + (contact.nx * sinH + contact.nz * cosH) * contact.depth, 0, this.path.len);
        p.d += (-contact.nx * cosH + contact.nz * sinH) * contact.depth;
      }
      if (contact.speed <= 0) continue;
      const cl = this.traffic.classes[contact.car.cls];
      const J = (1.2 * contact.speed) / (1 / SPEC.mass + 1 / cl.mass);
      const dvp = J / SPEC.mass, dvc = J / cl.mass;
      const ch = contact.car.h, along = -(contact.nx * Math.sin(ch) + contact.nz * Math.cos(ch));
      const lever = clamp((contact.car.x - p.x) * Math.sin(p.psi) + (contact.car.z - p.z) * Math.cos(p.psi), -2.2, 2.2);
      const side = contact.nx * -Math.cos(p.psi) + contact.nz * Math.sin(p.psi);
      p.push(contact.nx * dvp, contact.nz * dvp, clamp(-lever * side * dvp * 0.22, -1.6, 1.6));
      this.traffic.bump(contact.car, dvc * along, this.time);       // pushed along -n: that much faster (or slower) along its lane
      this.shake = Math.max(this.shake, Math.min(1, contact.speed / 12));
      this.combo = 1; this.comboT = 0; this.streak = 0;
      if (contact.speed > 2 && playing) { this.collisions++; this.crashed(); this.profile.add({ collision: 1 }); }
      if (contact.speed > 3) this.audio.crash(contact.speed); else this.audio.thump(contact.speed * 3);
      if (this.mode === 'survival' && playing && contact.speed > 7) this.crashEnd(`Crashed into ${cl.id === 'suv' ? 'an SUV' : cl.id === 'semi' ? 'a big rig' : 'a ' + (cl.id === 'truck' ? 'box truck' : cl.id === 'sports' ? 'sports car' : cl.id)}`);
    }
    // wrong way?
    let rel = p.psi - this.path.heading(clamp(p.s, 0, this.path.len)); rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.wrongWay = Math.abs(rel) > 1.75 && Math.abs(p.vx) > 4;
    // passes: whooshes, and points for clean passes and near misses (once per car, only past moving cars)
    for (const ps of passes) {
      if (!this.attract) this.audio.passBy(ps.rel, Math.max(0.5, ps.gap), this.traffic.classes[ps.car.cls].len > 7);
      if (this.mode !== 'survival' || !playing || !ps.clean || ps.rel < 3 || ps.car.v < 10 || this.wrongWay || ps.car.touched === -1) continue;
      ps.car.touched = -1;                         // counted: a car only scores once
      this.overtakes++;
      this.comboT = 4;
      if (ps.close) this.nearMisses++;
      this.earned(this.profile.add(ps.close ? { nearMiss: 1, runNearMisses: this.nearMisses, cashMult: this.cashMult } : { cleanPass: 1, cashMult: this.cashMult }));
      const pts = Math.round((ps.close ? 250 : 100) * this.combo);
      this.score += pts;
      this.ev.toast(ps.close ? `Near miss +${pts}` : `Clean pass +${pts}`, 'good');
      this.combo = Math.min(8, this.combo + (ps.close ? 1 : 0.5));
    }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 1; }
    // distance, the streak and the clocks
    const fwd = Math.max(0, view.v) * dt;
    if (!this.attract && !this.wrongWay) this.distance += fwd;
    if (!this.attract) this.pace = damp(this.pace, Math.max(0, view.v), 1 / 12, dt);
    if (playing) {
      // (the distance that pays is capped at the race tune's pace while the hypercar runs Unleashed)
      this.prof.t += dt; if (!this.wrongWay) { this.prof.dist += fwd; this.prof.paid += this.earnCap > 0 ? Math.min(fwd, this.earnCap * dt) : fwd; }
      this.prof.flush -= dt;
      if (this.prof.flush <= 0) {
        this.prof.flush = 0.5;
        this.earned(this.profile.add({ time: this.prof.t, distance: this.prof.dist, paid: this.prof.paid, speed: Math.abs(p.vx), streak: this.bestStreak, runNearMisses: this.nearMisses, cashMult: this.cashMult }));
        this.prof.t = 0; this.prof.dist = 0; this.prof.paid = 0;
        this.profile.setEarnedCars(this.progress.earnedCars());
      }
    }
    this.top = Math.max(this.top, Math.abs(p.vx));
    // the miles, Road Points, the speed bonus and the goals (progress.ts): active driving only
    if (!this.attract) {
      const v = Math.max(0, view.v);
      const pin = this.pin;                                       // one object reused every step: nothing allocated on the drive path
      pin.mps = v; pin.paid = this.earnCap > 0 ? Math.min(v, this.earnCap) : undefined; pin.driving = playing; pin.auto = this.autoDrive; pin.wrongWay = this.wrongWay; pin.controls = c; pin.tier = this.trafficTier;
      this.progress.tick(dt, pin);
    }
    if (playing) this.scoreStep(dt);
    if (playing) {
      if (this.mode === 'survival') {
        if (p.vx > FAST && !this.wrongWay) { this.streak += dt; this.bestStreak = Math.max(this.bestStreak, this.streak); }
        else this.streak = 0;
        const band = p.vx > FAST ? 1 + (p.vx - FAST) / 22 : 0.2;
        this.score += fwd * 0.1 * band * (1 + Math.min(this.streak, 60) / 30);
      }
      if (this.mode === 'free') this.errandTick(dt);
    }
  }

  // the phone's "Set it up" on an errand: the next Free Drive on its freeway carries it
  setErrand(job: ErrandJob | null) { this.pendingErrand = job; }
  // at a Free Drive's start: the errand's sign is the first ahead on this carriageway whose text names its exit
  private startErrand(m: Path, s0: number) {
    const j = this.pendingErrand; this.pendingErrand = null; this.errand = null;
    if (!j || j.road !== m.label) return;
    const want = j.exit.toLowerCase();
    const sign = this.net.signs.filter((g) => g.path === m && g.s > s0 + 200 && g.text.join(' / ').toLowerCase().includes(want)).sort((a, b) => a.s - b.s)[0];
    if (!sign) { this.ev.toast(`No ${j.exit} exit ahead on ${m.label}`, 'bad'); return; }
    this.errand = { job: j, sign, t: j.seconds, done: false };
    this.ev.toast(`Errand: ${j.what}. Take the ${j.exit} exit · ${fmtClock(j.seconds)}`, 'info');
  }
  private errandTick(dt: number) {
    const e = this.errand; if (!e || e.done) return;
    e.t -= dt;
    if (this.path === e.sign.ramp) { e.done = true; this.ev.toast(`Delivered with ${fmtClock(e.t)} to spare`, 'good'); this.endRun('Delivered'); return; }
    if (e.t <= 0) { this.errand = null; this.ev.toast('Too late: the errand is off. Keep driving, or try it again from the phone.', 'bad'); }
  }

  // story jobs (the phone's Messages): what this run met is paid now, and the results screen lists it
  private settleJobs(r: RunFacts): Result['jobs'] {
    if (this.attract) return undefined;
    const paid = settle(this.profile.p, this.profile.level, r);
    if (!paid.length) return undefined;
    let lvl: number | null = null;
    for (const m of paid) { lvl = this.profile.reward(m.xp ?? 0, m.credits ?? 0) ?? lvl; this.ev.toast(`${characterById(m.from)?.name ?? 'Job'}: job done · +${(m.credits ?? 0).toLocaleString()} cash`, 'good'); }
    this.profile.save();
    if (lvl) this.ev.toast(`Level ${lvl}`, 'good');
    return paid.map((m) => ({ from: characterById(m.from)?.name ?? m.from, job: m.job ? jobText(m.job) : '', credits: m.credits ?? 0 }));
  }

  // level-ups and achievements, as they happen
  private earned(e: Earned) {
    if (this.attract) return;
    if (e.levelUp) this.ev.toast(`Level ${e.levelUp}`, 'good');
    for (const a of e.unlocked) this.ev.toast(`Achievement: ${a}`, 'good');
  }

  private endRun(reason: string) {
    this.over = true; this.autoDrive = false;
    this.profile.endRun();
    const score = Math.round(this.score);
    const best = loadBest(this.mode), newBest = score > best;
    if (newBest) saveBest(this.mode, score);
    const run: Run = { mode: this.mode, score, distance: Math.round(this.distance), top: Math.round(this.top * MPH), streak: Math.round(this.bestStreak * 10) / 10, nearMisses: this.nearMisses, overtakes: this.overtakes, collisions: this.collisions, when: Date.now(), road: this.lastMain?.label ?? '' };
    const rc = this.runCar(); if (rc.tune) run.tune = rc.tune;      // the hypercar's runs carry their tune (the board marks Unleashed)
    const board = recordRun(run);
    const bests = this.finishScores();
    const jobs = this.settleJobs({ mode: this.mode, score, distance: this.distance, top: this.top, road: run.road, errands: this.errand?.done ? [this.errand.job.key] : [] });
    this.errand = null;
    this.progress.save();
    const pd = this.progress.runDelta(), fnd = this.progress.founders();
    setTimeout(() => this.ev.over({ mode: this.mode, score, distance: this.distance, overtakes: this.overtakes, top: this.top, reason, road: run.road, best: Math.max(best, score), newBest, time: this.time, nearMisses: this.nearMisses, bestStreak: this.bestStreak, collisions: this.collisions, board, jobs, bests, progress: { miles: pd.miles, points: pd.points, cash: pd.cash, founders: fnd.text, badges: this.progress.badges() }, ...this.runCar() }), 1200);
  }

  // ------------------------------------------------------------------------------------------ the run's scores (bests.ts)
  // the board a run counts on: the OC Hypercar's Unleashed tune (Free Drive) has its own; every other run, the hypercar's
  // race tune included, is on the open board
  private boardNow(): Board { return this.driving === FOUNDER_CAR && this.mode === 'free' ? 'unleashed' : 'open'; }
  // test hooks (the suite checks the scoring rules, the traffic rule and the settings migration on synthetic runs)
  get api() { return { MinuteMeter, DriftTracker, recordBest, recordDrift, bestsFor, bestOf, driftBest, driftBests, migrateBests, shareLine, loadSettings, DIFFICULTY, FREE_DRIVE_ONLINE, trafficFor, FOV_DEFAULT }; }
  // a Free Drive run's drift and a difficulty's Fastest Minute start from nothing
  private beginScores() {
    const b = this.bests;
    b.minute.reset(); b.drift.reset();
    b.diff = this.runDiff; b.board = this.boardNow(); b.stored = b.diff ? bestOf(b.board, b.diff) : driftBest(b.board);
    b.toasted = false; b.eased = false; b.crashes = 0; b.forgiven = 0; b.forgiveUntil = 0; b.banked = false;
  }
  private crashed() { this.bests.minute.broken(); this.bests.drift.crash(); this.bests.crashes++; }
  // A real crash in a timed run ends it (Speed Survival's rule), except on Easy, which forgives the first DIFFICULTY.easy.forgive
  // of them: the run goes on (the crash still broke the 60 s stretch, crashed()). One collision is one crash: contact held over
  // a few frames, or a second hit within a second and a half, is not counted again.
  private crashEnd(reason: string) {
    const b = this.bests, allowed = this.runDiff ? DIFFICULTY[this.runDiff].forgive : 0;
    if (this.time < b.forgiveUntil) return;
    if (b.forgiven < allowed) {
      b.forgiven++; b.forgiveUntil = this.time + 1.5;
      this.ev.toast(`Crash forgiven · ${allowed - b.forgiven} left on Easy`, 'info');
      return;
    }
    this.endRun(reason);
  }
  private scoreStep(dt: number) {
    const b = this.bests, p = this.phys;
    if (this.govTraffic > 0) b.eased = true;
    let live = 0;
    if (!b.diff) {          // Free Drive: the drift readout and Best drift
      b.drift.step(dt, (Math.atan2(Math.abs(p.vy), Math.max(1, p.vx)) * 180) / Math.PI, Math.max(0, p.vx) * MPH);
      live = b.drift.live;
    } else { b.minute.push(dt, Math.max(0, p.vx) * MPH); live = b.minute.best; }
    // a toast the first time the run beats this device's best on its board (the card has the rest)
    if (!b.toasted && !b.eased && live > 0 && live > b.stored) {
      b.toasted = true;
      this.ev.toast(b.diff ? `New Fastest Minute ${round1(live).toFixed(1)} mph` : `New Best drift ${Math.round(live).toLocaleString('en-US')}`, 'good');
    }
  }
  // A run's score is kept when the drive ends, and also when it is left without ending (Restart, Main menu): Free Drive's
  // Best drift (a chain still running is banked first) and a timed run's Fastest Minute (the best full 60 s so far), unless
  // Adaptive quality eased the traffic, the same rule the end card applies. A run that ended already banked itself (finishScores).
  private bankRun() {
    const b = this.bests;
    if (b.banked || this.attract) return;
    b.banked = true;
    if (b.diff) {
      const v = round1(b.minute.best);
      if (!b.eased && v > 0) recordBest(b.board, b.diff, { v, when: Date.now(), car: this.driving, road: this.lastMain?.label ?? '', run: this.mode });
    } else if (this.mode === 'free') {
      b.drift.finish();
      const v = Math.round(b.drift.best);
      if (v > 0) recordDrift(b.board, { v, when: Date.now(), car: this.driving, road: this.lastMain?.label ?? '', run: 'free' });
    }
  }
  private finishScores(): RunBests {
    const b = this.bests; b.drift.finish();
    if (!b.diff) {
      const value = Math.round(b.drift.best), placed = value > 0 && !b.banked ? recordDrift(b.board, { v: value, when: Date.now(), car: this.driving, road: this.lastMain?.label ?? '', run: 'free' }) : null;
      b.banked = true;
      return { kind: 'drift', diff: null, board: b.board, value, counted: true, why: '', placed };
    }
    const value = round1(b.minute.best), counted = !b.eased;
    b.banked = true;
    const placed = counted && value > 0 ? recordBest(b.board, b.diff, { v: value, when: Date.now(), car: this.driving, road: this.lastMain?.label ?? '', run: this.mode }) : null;
    return { kind: 'minute', diff: b.diff, board: b.board, value, counted, why: counted ? '' : 'Adaptive quality eased the traffic to hold your frame rate, so this run does not count.', placed };
  }

  // END DRIVE (the pause screen's way out, every mode): the drive ends through endRun, so its summary and end card show and its
  // scores are filed. Free Drive has no ending of its own, so its score is the distance; a timed run keeps the score it has.
  endDrive() {
    if (this.attract || this.over) return;
    this.setPaused(false);
    if (this.mode === 'free') { this.score = Math.round(this.distance); this.endRun('Parked'); } else this.endRun('Drive ended');
  }
  endFreeDrive() { this.endDrive(); }

  // ----------------------------------------------------------------------------------------- cameras
  private tmpQ = new THREE.Quaternion(); private tmpE = new THREE.Euler(0, 0, 0, 'YXZ'); private tmpV = new THREE.Vector3(); private wantP = new THREE.Vector3(); private wantQ = new THREE.Quaternion();
  // the camera actually in use: the menu's attract drive is filmed cinematically, a run uses the player's choice
  private view3(): CamMode { return this.attract ? 'cinematic' : this.cam; }
  private updateCamera(dt: number) {
    const c = this.input.c, p = this.phys, portrait = this.camera.aspect < 0.95, view = this.view3();
    const speedK = clamp(Math.abs(p.vx) / 90, 0, 1);
    let fov = 60;
    this.car.root.updateMatrixWorld(true);
    const lookBack = c.lookBack && !this.attract;
    if (lookBack) {
      this.car.rear.getWorldPosition(this.wantP); this.car.rear.getWorldQuaternion(this.wantQ);
      this.tmpQ.setFromEuler(this.tmpE.set(-0.08, 0, 0)); this.wantQ.multiply(this.tmpQ);
      fov = 62;
    } else if (view === 'cockpit' || view === 'free') {
      this.head.x = damp(this.head.x, clamp(p.ay * 0.0032, -0.04, 0.04), 6, dt);
      this.head.z = damp(this.head.z, clamp(p.ax * 0.0028, -0.035, 0.03), 6, dt);
      this.car.eye.getWorldPosition(this.wantP);
      this.car.body.getWorldQuaternion(this.wantQ);
      this.tmpV.set(this.head.x, 0, this.head.z).applyQuaternion(this.wantQ); this.wantP.add(this.tmpV);
      // the hypercar's seat camera sits ahead of its eye (car-shape eyeNudge), 6 cm off the A-pillar and the canopy
      // frame. Straight ahead that shows the hood; turned round with the mouse look or a stick (touch has none) it
      // would bury the view in the pillar, so the nudge eases back out as the look turns or tips up
      const back = smoothstep(0.35, 1.1, Math.max(Math.abs(c.lookYaw), Math.abs(c.lookPitch) * 2));
      if (back > 0) { this.tmpV.copy(this.car.eyeNudge).multiplyScalar(-back).applyQuaternion(this.wantQ); this.wantP.add(this.tmpV); }
      // portrait: aim for a 50-degree horizontal view (Three's fov is vertical, so it follows the aspect, 62..76
      // degrees, clamped at 76 on tall phones) with the horizon 31% from the top. The old 96 degrees took in a 61-degree
      // width at the owner's phone aspect: the door and the flank through the side window crowded the left edge and the
      // cluster was drawn small mid-screen. The cap was 84 until 2026-11-16 (owner, v19 at 207 mph on an iPhone: "the
      // hood being more presented"): with the default +10 and the speed's +4 that drew 98 degrees, a 56-degree width,
      // and the bonnet and fenders a sliver at the dash's corners; at 76 the default draws 90 (a 50-degree width) and
      // the hood 1.1x larger. Landscape's fov and pitch are unchanged, but the hypercar's eye moved (car-shape seatDrop,
      // eyeNudge), so its landscape and desktop seat views also lose the A-pillar band and show the hood.
      // (the hypercar's a few degrees wider: car-shape seatFov)
      const vBase = (portrait ? clamp(2 * Math.atan(Math.tan((SEAT_HFOV_P / 2) * DEG) / this.camera.aspect) / DEG, 62, SEAT_VMAX_P) : 58) + this.car.seatFov[portrait ? 0 : 1];
      fov = vBase + (view === 'free' ? 8 : 0) + this.settings.fov + speedK * Math.max(0, Math.min(4, SEAT_FOV_FLAT_OUT - this.settings.fov));
      // the horizon sits 31% of the way down the part of the screen below the top safe area (the notch or Dynamic
      // Island when the page runs edge to edge): with a 59 px inset the HUD comes down 59 px and the windscreen with it.
      // The pitch is aimed with the field of view drawn (the setting and the speed in it), so the horizon stays put
      // as they change; aimed with the base alone, the default +10 put it at 40% (owner, v19: the top 45% sky)
      const hz = SEAT_HORIZON_P + (1 - SEAT_HORIZON_P) * this.topInsetFrac();
      const basePitch = portrait ? -Math.atan((0.5 - hz) * 2 * Math.tan((fov / 2) * DEG)) : this.car.seatPitchL;   // (the hypercar's lower: car-shape seatPitchL)
      const sway = this.attract ? Math.sin(this.time * 0.25) * 0.18 : 0;
      this.tmpQ.setFromEuler(this.tmpE.set(basePitch + c.lookPitch, c.lookYaw + sway, 0));
      this.wantQ.multiply(this.tmpQ);
    } else if (view === 'hood') {
      this.car.hood.getWorldPosition(this.wantP); this.car.root.getWorldQuaternion(this.wantQ);
      this.tmpQ.setFromEuler(this.tmpE.set(-0.04 + c.lookPitch, c.lookYaw, 0)); this.wantQ.multiply(this.tmpQ);
      fov = (portrait ? 92 : 62) + this.settings.fov + speedK * 5;
    } else if (view === 'cinematic') {
      // the shot's clock; a new shot is a hard cut (no blend), as an edit would be
      this.cineT += dt;
      if (this.cineT >= SHOTS[this.cineShot].len) { this.cineT = 0; this.cineShot = (this.cineShot + 1) % SHOTS.length; this.camBlend = 1; }
      const sh = SHOTS[this.cineShot], k = this.cineT / sh.len, ease = k * k * (3 - 2 * k);
      const root = this.car.root.position, fwd = this.tmpV.set(Math.sin(p.psi), 0, Math.cos(p.psi));
      this.chaseFwd.lerp(fwd, 1 - Math.exp(-dt * 3)).normalize();
      const F = this.chaseFwd, side = new THREE.Vector3(F.z, 0, -F.x), ahead = lerp(sh.f[0], sh.f[1], ease);
      this.wantP.copy(root).addScaledVector(F, ahead).addScaledVector(side, sh.s); this.wantP.y = root.y + sh.y;
      const look = root.clone().addScaledVector(F, sh.at); look.y += 0.55;
      this.wantQ.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.wantP, look, new THREE.Vector3(0, 1, 0)));
      // on the menu the hero sits right of centre, clear of the rail (a turn to the left moves the subject right)
      // and tilted down a touch so it sits above the mode cards along the bottom
      if (this.attract && !portrait && this.cineShot === 0) { this.tmpQ.setFromEuler(this.tmpE.set(-0.07, 0.16, 0)); this.wantQ.multiply(this.tmpQ); }
      // on a phone's menu the car is framed wider and tipped down so it sits in the top sixth, under the bar (the front page
      // stacks its text below it, clear of the car)
      const menuP = this.attract && portrait;
      fov = (portrait ? sh.fov * (menuP ? 2.4 : 1.6) : sh.fov) + speedK * 3;
      if (menuP) { this.tmpQ.setFromEuler(this.tmpE.set(-Math.atan(0.37 * 2 * Math.tan((fov / 2) * DEG)), 0, 0)); this.wantQ.multiply(this.tmpQ); }
    } else {
      const root = this.car.root.position, psi = p.psi;
      const fwd = this.tmpV.set(Math.sin(psi), 0, Math.cos(psi));
      this.chaseFwd.lerp(fwd, 1 - Math.exp(-dt * 4)).normalize();
      const back = (portrait ? 8.2 : 6.6) + speedK * 1.4, up = (portrait ? 2.9 : 2.25) - speedK * 0.25;
      this.wantP.copy(root).addScaledVector(this.chaseFwd, -back); this.wantP.y = root.y + up;
      this.chasePos.y += (this.wantP.y - this.chasePos.y) * (1 - Math.exp(-dt * 8));
      this.chasePos.x = this.wantP.x; this.chasePos.z = this.wantP.z;
      this.wantP.copy(this.chasePos);
      const look = root.clone().addScaledVector(this.chaseFwd, 3.5); look.y += 0.9;
      const m = new THREE.Matrix4().lookAt(this.wantP, look, new THREE.Vector3(0, 1, 0));
      this.wantQ.setFromRotationMatrix(m);
      this.tmpQ.setFromEuler(this.tmpE.set(c.lookPitch * 0.5, c.lookYaw, 0)); this.wantQ.multiply(this.tmpQ);
      fov = (portrait ? 80 : 60) + this.settings.fov * 0.5 + speedK * 6;
    }
    // Ultra Realism's road shake at speed: a smooth vibration from three incommensurate sines on the game clock (was
    // fresh Math.random() every frame, which read as the whole view jittering and kept going on the pause screen, where
    // the speed stays set: owner, 2026-11-22, "why does it shake like the outside of the car when paused and driving").
    // The clock stops while paused, so the view holds still there.
    if (this.ultraOn() && this.settings.ultraShake && !lookBack && !REDUCED_MOTION && !this.paused) {
      const b = smoothstep(30, 90, Math.abs(p.vx)) * 0.0032, t = this.time;
      this.wantP.x += (Math.sin(t * 57.1) * 0.5 + Math.sin(t * 83.3 + 1.3) * 0.3 + Math.sin(t * 131.7 + 2.1) * 0.2) * b * 0.5;
      this.wantP.y += (Math.sin(t * 61.9 + 0.7) * 0.5 + Math.sin(t * 97.1 + 2.6) * 0.3 + Math.sin(t * 143.3 + 0.4) * 0.2) * b * 0.7 + Math.sin(t * 23) * b * 0.4;
    }
    if (this.dip.t < 0.8) {
      // a hop's landing: the view drops with the body and comes back (peak at 80 ms, gone in about half a second)
      const x = this.dip.t / 0.08;
      this.wantP.y -= this.dip.a * x * Math.exp(1 - x) * (lookBack ? 0.5 : 1);
      this.dip.t += dt;
    }
    if (this.shake > 0 && !this.paused) {   // an impact's jolt waits out the pause screen too
      this.wantP.x += (Math.random() - 0.5) * this.shake * 0.06; this.wantP.y += (Math.random() - 0.5) * this.shake * 0.05;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    if (this.camBlend < 1) {
      this.camBlend = Math.min(1, this.camBlend + dt / 0.5);
      const t = this.camBlend * this.camBlend * (3 - 2 * this.camBlend);
      this.camera.position.lerpVectors(this.camFrom.p, this.wantP, t);
      this.camera.quaternion.slerpQuaternions(this.camFrom.q, this.wantQ, t);
    } else { this.camera.position.copy(this.wantP); this.camera.quaternion.copy(this.wantQ); }
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = lerp(this.camera.fov, fov, 1 - Math.exp(-dt * 6)); this.camera.updateProjectionMatrix(); }
    this.camera.near = (view === 'chase' || view === 'cinematic') && !lookBack ? 0.15 : 0.05;
  }

  // the top safe area as a fraction of the stage's height, from the --sa-t the HUD lays itself out by (styles.css; the
  // suite sets it to emulate an inset), read twice a second rather than every frame
  private insetAt = -1e9; private insetFrac = 0;
  private topInsetFrac() {
    const now = performance.now();
    if (now - this.insetAt > 500) {
      this.insetAt = now;
      const app = this.host.closest('.app') as HTMLElement | null, h = this.host.clientHeight || innerHeight;
      const v = app ? parseFloat(getComputedStyle(app).getPropertyValue('--sa-t')) : 0;
      this.insetFrac = Number.isFinite(v) && h > 0 ? clamp(v / h, 0, 0.15) : 0;
    }
    return this.insetFrac;
  }

  // ----------------------------------------------------------------------------------------- the corner window
  cornerRect() {
    // where the UI actually put the window (safe areas move it on notched phones)
    const el = document.querySelector('.corner') as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect(), h = this.host.getBoundingClientRect();
      return { x: r.left - h.left + 1, y: r.top - h.top + 1, size: Math.min(r.width, r.height) - 2 };
    }
    const size = CORNER_PX[this.settings.cornerSize] ?? CORNER_PX[1];
    return { x: (this.host.clientWidth || innerWidth) - size - 12, y: 64, size };
  }
  // The sky camera: a live camera 150 m up, heading-up, looking down just ahead of the car, shown in the corner
  // window's own canvas. It used to be drawn into the full-screen WebGL canvas behind the window with a scissor, which
  // went wrong three ways: setScissor/setViewport take CSS pixels and three.js multiplies them by the pixel ratio itself,
  // so the old `* pr` put the picture at pr times its place and size (Low on a desktop: 0.75; a phone on Medium or up:
  // 1.5 to 2, mostly off the window); a square drawn under the page can't follow the frame's rounded corners; and it
  // had the main view's resolution, 1 pixel per CSS pixel on a phone at Low, so a blur of 3x3 blocks on an iPhone. Now
  // it is rendered at the window's size times the screen's pixel ratio (up to 3; up to 2 at Low, a phone's default) into
  // the bottom-left of the drawing buffer before the main view, and copied out with drawImage while that buffer is still
  // this frame's (the main view then clears and covers it). The window's canvas sits inside the frame, so it is clipped,
  // moved and tucked with it. That copy has not been tried on WebKit (no WebKit here), so it checks itself once
  // (checkSkyCopy) and falls back to drawing straight into the main canvas (renderSkyDirect).
  private skyAt = -1e9;
  private skyDirect = false;           // the fallback is on, for the rest of the session
  private skyCopies = 0;
  skyCheck = '';                       // what checkSkyCopy found ('' before the third copy), for tests
  get skyMode(): 'copy' | 'direct' { return this.skyDirect ? 'direct' : 'copy'; }
  // the fallback on or off; also the test hook (window.__game.setSkyFallback(true), or ?skyfallback=1 at load). The stage
  // carries data-sky="direct" so the frame turns see-through and square for it (styles.css)
  setSkyFallback(on: boolean) {
    this.skyDirect = on;
    if (on) this.host.dataset.sky = 'direct'; else delete this.host.dataset.sky;
  }
  private renderSky(now: number) {
    const cv = this.mapCanvas;
    if (this.skyDirect || this.attract || this.settings.corner !== 'sky' || !cv) return;
    if (now - this.skyAt < 1000 / 30 - 2) return;          // 30 a second is plenty for a map view; the copy stays up between
    const css = cv.clientWidth;
    if (css <= 0 || this.cornerAway(this.cornerRect())) return;
    const gl = this.renderer.domElement, pr = this.renderer.getPixelRatio(), cap = this.settings.quality === 'low' ? 2 : 3;
    const want = Math.min(Math.round(css * Math.min(cap, window.devicePixelRatio || 1)), gl.width, gl.height);
    const v = want / pr, px = Math.floor(v * pr);          // three.js sets floor(v * pr) device pixels: copy exactly those
    if (px < 8) return;
    const g = cv.getContext('2d'); if (!g) return;
    if (cv.width !== px || cv.height !== px) { cv.width = px; cv.height = px; }
    this.skyAt = now;
    this.drawSky(0, 0, v);
    const check = ++this.skyCopies === 3, view = check ? this.readSkyView(px) : null;   // read before the copy touches it
    g.drawImage(gl, 0, gl.height - px, px, px, 0, 0, px, px);
    if (check) this.checkSkyCopy(g, px, view);
  }
  // the drawing buffer's bottom-left px x px, the sky view just rendered (null if it can't be read)
  private readSkyView(px: number): Uint8Array | null {
    try {
      const r = this.renderer, gl = r.getContext(), buf = new Uint8Array(px * px * 4);
      r.setRenderTarget(null);
      gl.readPixels(0, 0, px, px, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    } catch { return null; }
  }
  // One render of the sky camera into the square at (x, y) from the drawing buffer's bottom left, s on a side. The units
  // are CSS pixels: three's setScissor and setViewport multiply by the renderer's pixel ratio themselves (the old bug
  // multiplied by it again).
  private drawSky(x: number, y: number, s: number) {
    const p = this.car.root.position;
    const fx = Math.sin(this.phys.psi), fz = Math.cos(this.phys.psi);
    this.skyCam.position.set(p.x + fx * 40, p.y + 150, p.z + fz * 40);
    this.skyCam.up.set(fx, 0, fz);
    this.skyCam.lookAt(p.x + fx * 40, p.y, p.z + fz * 40);
    this.skyCam.aspect = 1; this.skyCam.updateProjectionMatrix();
    const r = this.renderer, fog = this.scene.fog, chev = this.chevrons.mesh.visible, shadows = r.shadowMap.autoUpdate;
    this.scene.fog = null;
    this.car.setOutsideView(true);
    this.chevrons.mesh.visible = false;                    // the chevrons are for the road ahead, not the sky camera
    r.shadowMap.autoUpdate = false;                        // the shadows already made will do; the main view updates them
    r.setRenderTarget(null);
    r.setScissorTest(true); r.setScissor(x, y, s, s); r.setViewport(x, y, s, s);
    if (this.style) this.style.renderRect(this.scene, this.skyCam); else r.render(this.scene, this.skyCam);   // Retro: its pass, into the square
    r.setScissorTest(false);
    const size = r.getSize(this.tmpSize);
    r.setViewport(0, 0, size.x, size.y);
    r.shadowMap.autoUpdate = shadows;
    this.chevrons.mesh.visible = chev;
    this.scene.fog = fog;
  }
  // Once, at the third copy: a 7 x 7 grid of the copy's pixels against the drawing buffer's own (readSkyView, read just
  // before the copy, while the buffer held the sky view). drawImage from a WebGL canvas without preserveDrawingBuffer is
  // not verified on WebKit (iOS Safari, the Claude iOS app); if the copy came back empty (all transparent, black where
  // the view is not, or not the view at all), or the check itself fails, the sky camera is drawn the direct way for the
  // rest of the session.
  private checkSkyCopy(g: CanvasRenderingContext2D, px: number, buf: Uint8Array | null) {
    let ok = false, why = '';
    try {
      if (!buf) throw new Error('readPixels failed');
      const img = g.getImageData(0, 0, px, px).data, N = 7;
      let opaque = 0, lit = 0, litCopy = 0, same = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = Math.floor(((i + 0.5) / N) * px), y = Math.floor(((j + 0.5) / N) * px);
        const c = (y * px + x) * 4, b = ((px - 1 - y) * px + x) * 4;          // the copy runs top down, the buffer bottom up
        if (img[c + 3] > 0) opaque++;
        if (buf[b] + buf[b + 1] + buf[b + 2] > 48) lit++;
        if (img[c] + img[c + 1] + img[c + 2] > 48) litCopy++;
        if (Math.max(Math.abs(img[c] - buf[b]), Math.abs(img[c + 1] - buf[b + 1]), Math.abs(img[c + 2] - buf[b + 2])) <= 40) same++;
      }
      const n = N * N;
      ok = opaque > 0 && !(lit >= n / 4 && litCopy === 0) && same >= n / 2;
      why = `${opaque}/${n} opaque, ${litCopy} lit (the view: ${lit}), ${same}/${n} match the view`;
    } catch (e) { why = 'the check failed: ' + String((e as Error)?.message ?? e); }
    this.skyCheck = (ok ? 'copy ok: ' : 'copy empty, direct: ') + why;
    if (!ok) this.setSkyFallback(true);
  }
  // The fallback: the sky camera drawn straight into the main canvas over the window's box (its own canvas hidden, the
  // frame see-through and square, styles.css), every frame after the main view, which clears the whole buffer. It has
  // the main view's resolution, not the screen's. A pixel wider each side, under the frame's 1 px border, so the floor()
  // three applies to each of x, y and size can't leave a sliver of the road showing at an edge.
  private renderSkyDirect() {
    const cv = this.mapCanvas;
    if (!this.skyDirect || this.attract || this.settings.corner !== 'sky' || !cv) return;
    const a = cv.getBoundingClientRect(), h = this.host.getBoundingClientRect(), s = Math.min(a.width, a.height) + 2;
    const x = a.left - h.left - 1, top = a.top - h.top - 1;
    if (s < 10 || this.cornerAway({ x: x + 1, size: s - 2 })) return;
    this.drawSky(x, this.renderer.getSize(this.tmpSize).y - top - s, s);
  }
  // the road map, ten times a second (the sky camera is renderSky)
  private renderCorner(dt: number) {
    if (this.attract || this.settings.corner !== 'map') return;
    this.mapT -= dt;
    if (this.mapT > 0 || !this.mapCanvas) return;
    this.mapT = 0.1;
    if (this.cornerAway(this.cornerRect())) return;
    this.drawMap(this.mapCanvas);
  }
  // the Minimal HUD (U1) slides the window off the right edge when it tucks it away: nothing to draw while it's there
  private cornerAway(r: { x: number; size: number }) { return r.size <= 0 || r.x >= (this.host.clientWidth || innerWidth) - 1; }

  // a heading-up road map: every freeway within a few kilometres, the route, you
  private drawMap(cv: HTMLCanvasElement) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), size = this.cornerRect().size;
    if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); }
    const g = cv.getContext('2d'); if (!g) return;
    const W = cv.width, R = this.mapRange(), k = (W / 2) / R;
    const p = this.phys, ch = Math.cos(p.psi), sh = Math.sin(p.psi);
    const tx = (x: number, z: number): [number, number] => {
      const dx = x - p.x, dz = z - p.z;
      const right = dx * -ch + dz * sh, fwd = dx * sh + dz * ch;
      return [W / 2 + right * k, W * 0.62 - fwd * k];
    };
    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(14,16,20,0.78)'; g.fillRect(0, 0, W, W);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const draw = (path: Path, color: string, width: number, step: number) => {
      if (path.maxX < p.x - R || path.minX > p.x + R || path.maxZ < p.z - R || path.minZ > p.z + R) return;
      g.strokeStyle = color; g.lineWidth = width * dpr; g.beginPath();
      let pen = false;
      for (let i = 0; i < path.n; i += step) {
        const x = path.xs[i], z = path.zs[i];
        if (Math.abs(x - p.x) > R * 1.5 || Math.abs(z - p.z) > R * 1.5) { pen = false; continue; }
        const [a, b] = tx(x, z);
        if (pen) g.lineTo(a, b); else { g.moveTo(a, b); pen = true; }
      }
      g.stroke();
    };
    for (const q of this.net.paths) if (!q.main && Math.abs(q.xs[0] - p.x) < 900 && Math.abs(q.zs[0] - p.z) < 900) draw(q, 'rgba(160,170,180,0.45)', 1, 3);
    for (const q of this.net.mains) draw(q, 'rgba(225,228,232,0.85)', 2.2, 10);
    // with a route, what's left of it; without one, the road you're on in yellow, as the map always drew it
    if (this.routeTarget) this.drawRoute(g, W, k, dpr);
    else { this.routeDrawn = 0; draw(this.path, '#f5c518', 3, this.path.main ? 6 : 2); }
    // where the next manoeuvre's arrow goes: no road shield is set down on it
    const jn = this.routeTarget ? this.route[0] : undefined, ji = jn ? clamp(Math.round(jn.s / STEP), 0, this.path.n - 1) : 0;
    const jx = jn ? this.mapX(this.path.xs[ji], this.path.zs[ji], W, k) : -1e9, jy = jn ? this.mapY(this.path.xs[ji], this.path.zs[ji], W, k) : -1e9;
    g.font = `${Math.round(9 * dpr)}px "Saira Semi Condensed", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const done = new Set<string>();
    for (const q of this.net.mains) {
      const key = q.route!;
      if (done.has(key) || q.maxX < p.x - R || q.minX > p.x + R || q.maxZ < p.z - R || q.minZ > p.z + R) continue;
      let bi = -1, bd = 1e18;
      for (let i = 0; i < q.n; i += 25) { const dd = (q.xs[i] - p.x) ** 2 + (q.zs[i] - p.z) ** 2; if (dd < bd) { bd = dd; bi = i; } }
      if (bi < 0 || bd > (R * 0.8) ** 2) continue;
      const i2 = Math.min(q.n - 1, bi + 250), [mx, my] = tx(q.xs[i2], q.zs[i2]);
      if (mx < 12 || my < 10 || mx > W - 12 || my > W - 10 || (Math.abs(mx - jx) < 24 * dpr && Math.abs(my - jy) < 20 * dpr)) continue;
      done.add(key);
      const inter = q.route!.startsWith('I-');
      g.fillStyle = inter ? '#1d4f9c' : '#f4f4ee';
      g.fillRect(mx - 11 * dpr, my - 6 * dpr, 22 * dpr, 12 * dpr);
      g.fillStyle = inter ? '#fff' : '#111';
      g.fillText(q.route!.replace(/^(I|SR)-/, ''), mx, my + 0.5);
    }
    if (this.routeTarget) this.drawManoeuvre(g, W, k, dpr);
    g.fillStyle = '#d0141e'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr;
    const cy = W * 0.62;
    g.beginPath(); g.moveTo(W / 2, cy - 7 * dpr); g.lineTo(W / 2 + 5 * dpr, cy + 5 * dpr); g.lineTo(W / 2, cy + 2 * dpr); g.lineTo(W / 2 - 5 * dpr, cy + 5 * dpr); g.closePath(); g.fill(); g.stroke();
  }

  // The route on the round map (owner, 2026-11-01): what is left of it, as a bright line in the car's accent over a
  // dark casing: this road from the car to the next hand-off, then each hand-off's road from where it is joined to the
  // next hand-off (the last one, the destination, for a couple of kilometres). Heading-up like the map: a point is
  // turned into the car's frame here, with no allocation per point.
  routeDrawn = 0;                    // points of route drawn on the map last time (for tests)
  // the map's reach (metres from the middle to the rim): 2.6 km, closing in to about 1.7 times the distance to the next
  // hand-off from 1.5 km out (never under 1.1 km), so the manoeuvre and the road to it fill the dial; eased per draw
  private mapR = 2600;
  private mapRange() {
    const j = this.routeTarget ? this.route[0] : undefined;
    const want = j ? clamp((j.s - this.phys.s) * 1.7, 1100, 2600) : 2600;
    this.mapR += (want - this.mapR) * 0.3;
    return this.mapR;
  }
  private accentKey = ''; private accentCol = '#408cff';
  private accent() {
    // the --ice token the car's atmosphere and the look set (styles.css), read again only when they change
    const de = document.documentElement, key = (de.dataset.car ?? '') + '/' + (de.dataset.look ?? '');
    if (key !== this.accentKey) { this.accentKey = key; this.accentCol = getComputedStyle(de).getPropertyValue('--ice').trim() || '#408cff'; }
    return this.accentCol;
  }
  private mapX(x: number, z: number, W: number, k: number) {
    const p = this.phys, dx = x - p.x, dz = z - p.z;
    return W / 2 + (dx * -Math.cos(p.psi) + dz * Math.sin(p.psi)) * k;
  }
  private mapY(x: number, z: number, W: number, k: number) {
    const p = this.phys, dx = x - p.x, dz = z - p.z;
    return W * 0.62 - (dx * Math.sin(p.psi) + dz * Math.cos(p.psi)) * k;
  }
  // one stretch of a road, s0 to s1, onto the current canvas path (a point every 8 m; pen up where it leaves the map)
  private traceRoad(g: CanvasRenderingContext2D, q: Path, s0: number, s1: number, W: number, k: number) {
    const p = this.phys, far = this.mapR * 1.5, i0 = clamp(Math.floor(s0 / STEP), 0, q.n - 1), i1 = clamp(Math.ceil(s1 / STEP), 0, q.n - 1);
    let pen = false, n = 0;
    for (let i = i0; ; i = Math.min(i1, i + 4)) {
      const x = q.xs[i], z = q.zs[i];
      if (Math.abs(x - p.x) > far || Math.abs(z - p.z) > far) pen = false;
      else {
        const a = this.mapX(x, z, W, k), b = this.mapY(x, z, W, k);
        if (pen) g.lineTo(a, b); else { g.moveTo(a, b); pen = true; }
        n++;
      }
      if (i >= i1) break;
    }
    return n;
  }
  private drawRoute(g: CanvasRenderingContext2D, W: number, k: number, dpr: number) {
    let n = 0;
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      n = this.traceRoad(g, this.path, Math.max(0, this.phys.s), this.route.length ? this.route[0].s : Math.min(this.path.len, this.phys.s + 2500), W, k);
      for (let i = 0; i < this.route.length; i++) {
        const j = this.route[i], nx = this.route[i + 1];
        n += this.traceRoad(g, j.to, j.toS, nx ? nx.s : Math.min(j.to.len, j.toS + 2500), W, k);
      }
      g.strokeStyle = pass === 0 ? 'rgba(0,0,0,0.6)' : this.accent();
      g.lineWidth = (pass === 0 ? 6.5 : 3.6) * dpr;
      g.stroke();
    }
    this.routeDrawn = n;
  }
  // the next manoeuvre: an arrow at its junction, pointing the way the route goes on (once the junction is on the dial),
  // and the distance to it on a pill at the dial's foot
  private drawManoeuvre(g: CanvasRenderingContext2D, W: number, k: number, dpr: number) {
    const j = this.route[0];
    if (!j) return;
    const q = this.path, i = clamp(Math.round(j.s / STEP), 0, q.n - 1), i0 = clamp(i - 15, 0, q.n - 1);
    const ax = this.mapX(q.xs[i], q.zs[i], W, k), ay = this.mapY(q.xs[i], q.zs[i], W, k);
    const r = W / 2, inside = Math.hypot(ax - r, ay - r) < r - 14 * dpr;
    if (inside) {
      // a guidance arrow at the junction: along this road, then bent 45 degrees to the side the hand-off leaves from
      // (exitSide, the network's data for the ramp), or straight on for a merge or a plain carry-on
      const fork = j.kind === 'diverge' || (j.kind === 'continue' && q.out.filter((o) => o.s >= q.len - 1).length > 1);
      const bend = fork ? (this.exitSide(q, j) === 'R' ? 1 : -1) * Math.PI / 4 : 0;
      const a0 = Math.atan2(ay - this.mapY(q.xs[i0], q.zs[i0], W, k), ax - this.mapX(q.xs[i0], q.zs[i0], W, k)), a1 = a0 + bend;
      const L0 = 9 * dpr, L1 = 7 * dpr;
      const sx = ax - Math.cos(a0) * L0, sy = ay - Math.sin(a0) * L0, hx = ax + Math.cos(a1) * L1, hy = ay + Math.sin(a1) * L1;
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? 'rgba(0,0,0,0.75)' : '#fff'; g.lineWidth = (pass === 0 ? 5.5 : 2.6) * dpr;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(ax, ay); g.lineTo(hx, hy); g.stroke();
      }
      g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 1.5 * dpr;
      const w = 6.5 * dpr, c = Math.cos(a1), sn = Math.sin(a1);
      g.beginPath(); g.moveTo(hx + c * w * 1.3, hy + sn * w * 1.3); g.lineTo(hx - sn * w, hy + c * w); g.lineTo(hx + sn * w, hy - c * w); g.closePath(); g.stroke(); g.fill();
    }
    const ac = this.accent();
    // the distance, on a pill in the accent at the foot of the dial, under the car's marker (clear of the shields)
    const m = Math.max(0, j.s - this.phys.s), text = m > 1609 ? (m / 1609.344).toFixed(1) + ' mi' : Math.round(m * 3.281 / 10) * 10 + ' ft';
    g.font = `700 ${Math.round(10 * dpr)}px "Saira Semi Condensed", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = g.measureText(text).width + 8 * dpr, th = 13 * dpr;
    const px = W / 2, py = W * 0.84;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(px - tw / 2 - dpr, py - th / 2 - dpr, tw + 2 * dpr, th + 2 * dpr);
    g.fillStyle = ac; g.fillRect(px - tw / 2, py - th / 2, tw, th);
    g.fillStyle = '#0b0b10'; g.fillText(text, px, py + 0.5 * dpr);
  }

  // what's next on the route, how far, which way it goes, and the road it leads to: the first freeway along the route
  // from there (a ramp that splits for both directions of a freeway leads to the one the route takes), or where the
  // ramp goes
  private nextManoeuvre(): [string, number, Turn, string, string] {
    const j = this.route[0];
    if (!j) return ['', 0, '', '', ''];
    // a diverge, or the end of a ramp that forks (for both directions of a freeway): keep to one side
    const fork = j.kind === 'diverge' || (j.kind === 'continue' && this.path.out.filter((o) => o.s >= this.path.len - 1).length > 1);
    const turn: Turn = fork ? (this.exitSide(this.path, j) === 'R' ? 'right' : 'left') : 'ahead';
    const side = turn === 'right' ? 'Keep right' : turn === 'left' ? 'Keep left' : 'Continue';
    const main = this.route.find((r) => r.to.main);
    const rv = this.routeVenue;
    const to = rv && j.to === this.routeTarget ? `${rv.exit.sign} exit to ${rv.venue.name}` : main ? main.to.label : this.net.leadsTo(j.to) || 'the ramp';
    return [`${side} for ${to}`, Math.max(0, j.s - this.phys.s), turn, side, to];
  }
  // which side a hand-off leaves from: the network's own data for that ramp (the side its guide sign stands for, from
  // the map data) where it has a sign, else judged from the roads' shapes (sideOf)
  private signSide: Map<Path, 'L' | 'R'> | null = null;
  private exitSide(path: Path, j: Junction): 'L' | 'R' {
    if (!this.signSide) { this.signSide = new Map(); for (const g of this.net.signs) this.signSide.set(g.ramp, g.side); }
    return (j.kind === 'diverge' && this.signSide.get(j.to)) || this.sideOf(path, j);
  }
  // the lane hint: the road's lanes, left to right, '1' for those the route leaves from (as many as the ramp has, short
  // of all of them), within LANE_HINT_M of a hand-off to one side; '' otherwise
  private laneHint(turn: Turn, dist: number) {
    const j = this.route[0], n = this.path.lanes;
    if (!j || (turn !== 'left' && turn !== 'right') || dist > LANE_HINT_M || n < 2) return '';
    const m = clamp(j.to.lanes, 1, n - 1);
    let out = '';
    for (let i = 0; i < n; i++) out += (turn === 'right' ? i >= n - m : i < m) ? '1' : '0';
    return out;
  }
  // the exits along a road, from the guide signs in the map data: where each ramp leaves (or where its sign stands) and
  // what the sign says, one per ramp, in order along the road. Worked out once per road.
  private exitIndex = new Map<Path, { s: number; ramp: Path; text: string }[]>();
  private exitsAlong(p: Path) {
    let a = this.exitIndex.get(p);
    if (!a) {
      const byRamp = new Map<Path, { s: number; ramp: Path; text: string }>();
      for (const g of this.net.signs) {
        if (g.path !== p) continue;
        const j = p.out.find((o) => o.to === g.ramp), text = g.text.join(' / '), had = byRamp.get(g.ramp);
        if (!had || text.length > had.text.length) byRamp.set(g.ramp, { s: j ? j.s : g.s, ramp: g.ramp, text });
      }
      a = [...byRamp.values()].sort((u, v) => u.s - v.s);
      this.exitIndex.set(p, a);
    }
    return a;
  }
  // the sign a ramp was taken from (the longest, where a ramp has more than one), '' for a ramp with none
  private rampSigns: Map<Path, string> | null = null;
  private rampSign(p: Path) {
    if (!this.rampSigns) {
      this.rampSigns = new Map();
      for (const g of this.net.signs) { const t = g.text.join(' / '), had = this.rampSigns.get(g.ramp); if (!had || t.length > had.length) this.rampSigns.set(g.ramp, t); }
    }
    return this.rampSigns.get(p) ?? '';
  }

  private hudBests(): BestsHud {
    const b = this.bests, m = b.minute, d = b.drift, on = !this.attract && !this.over;
    return {
      kind: on ? (b.diff ? 'minute' : 'drift') : '', board: b.board, diff: b.diff ?? '', avg: m.avg, t: m.t, full: m.full, runBest: m.best,
      angle: d.angle, chain: d.points, chainT: d.chainT, chainBest: d.best, best: b.stored, counts: !b.eased,
    };
  }
  private sendHud() {
    const p = this.phys;
    const [next, nextDist, turn, navAct, navTo] = this.nextManoeuvre();
    // the navigation card (U2): the next exit along this road, the destination, how far it is along the route and how
    // long that takes at your pace
    const onVenueRamp = !!this.routeVenue && this.path === this.routeTarget;
    const routed = (this.route.length > 0 || onVenueRamp) && !!this.routeTarget;
    const exit = routed ? this.exitsAlong(this.path).find((e) => e.s > p.s) : undefined;
    let destDist = 0;
    if (routed) {
      let s = p.s; for (const j of this.route) { destDist += Math.max(0, j.s - s); s = j.toS; }
      const vr = this.routeVenue ? this.vramps().get(this.routeTarget!) : undefined;   // and down the venue's ramp
      if (vr) destDist += Math.max(0, toStreet(this.vramps(), vr, s) - ARRIVE_M);
    }
    // world x runs east and z south (tools/oc-network/common.py), and the car points along (sin psi, cos psi): its
    // bearing from north is pi - psi
    const heading = ((((Math.PI - p.psi) * 180) / Math.PI) % 360 + 360) % 360;
    const h: Hud = {
      speed: Math.round(Math.abs(p.vx) * MPH), gear: p.gear < 0 ? 'R' : String(p.gear), rpm: Math.round(p.rpm), rpmFrac: clamp(p.rpm / SPEC.redline, 0, 1),
      distance: this.distance, score: Math.round(this.score), combo: this.combo, fps: this.fps, mode: this.mode,
      auto: p.auto, cam: CAM_LABEL[this.cam],
      best: loadBest(this.mode), overtakes: this.overtakes,
      road: this.path.main ? this.path.label : (this.path.label ? 'To ' + this.path.label : 'Ramp'),
      next, nextDist, wrongWay: this.wrongWay, streak: this.streak, bestStreak: this.bestStreak, nearMisses: this.nearMisses, top: Math.round(this.top * MPH),
      ability: this.ability.def.name, abilityOn: this.abilityEndHeld ? 0.01 : this.ability.active / this.ability.def.duration, abilityCool: this.ability.coolFrac,
      tunnel: this.tunnel, radio: this.radio.current ? `${this.radio.current.call} ${this.radio.current.freq}` : '',
      heading, tempF: this.env.tempF(), turn,
      navAct, navTo, exitText: exit?.text ?? '', exitMine: !!exit && exit.ramp === this.route[0]?.to, onSign: routed && !exit && !this.path.main ? this.rampSign(this.path) : '',
      dest: routed ? this.routeName : '', destDist, eta: routed && this.pace > 4.5 ? destDist / this.pace : -1,
      traffic: DENSITY[this.density].label,
      view: this.input.c.lookBack && !this.attract ? 'back' : this.view3(), liveCluster: this.car.liveCluster,
      brake: this.input.c.brake, clock: this.env.clockText(), tempNote: 'simulated',
      autoOffer: this.autoDriveOffered, autoOn: this.autoDrive, lanes: this.laneHint(turn, nextDist),
      venuePrompt: !this.venueState && this.venueAllowed ? this.vramps().get(this.path)?.venue.name ?? '' : '',
      parked: this.venueState?.phase === 'parked' ? this.venueState.vr.venue.name : '',
      parkedNote: this.venueState?.phase === 'parked' ? `Drove ${this.venueState.vr.exit.street} to ${this.venueState.vr.venue.name} · street driving isn't built yet` : '',
      errand: this.errand && !this.errand.done ? { exit: this.errand.job.exit, left: Math.max(0, this.errand.t), dist: this.path === this.errand.sign.path ? Math.max(0, this.errand.sign.s - p.s) : -1 } : null,
      tune: this.driving === 'oc-hyper' && !this.attract ? (this.mode === 'free' ? 'Unleashed' : 'Race tune') : '',
      thrustLive: this.hyper.live && !this.over, tank: this.hyper.tank, groundLock: this.hyper.fan > 0.3,
      hop: this.hopState(),
      driftAngle: p.drift.angle, driftOn: p.drift.active, driftTime: p.drift.time,
      bests: this.hudBests(),
    };
    this.ev.hud(h);
    // the car's own cluster shows the same facts (cockpit.ts / car-dash.ts): one object, filled in place
    const d = this.dashInfo;
    d.tripMi = this.distance / 1609.344; d.topMph = h.top; d.clock = h.clock; d.tempF = h.tempF;
    d.tune = h.tune; d.tank = h.tank; d.thrustLive = h.thrustLive; d.lock = h.groundLock; d.hop = h.hop;
    d.turn = h.dest ? h.turn : ''; d.nextMi = nextDist / 1609.344; d.navTo = navTo; d.dest = h.dest; d.destMi = destDist / 1609.344; d.road = h.road;
    this.car.setDash(d);
  }
  private dashInfo = { tripMi: 0, topMph: 0, clock: '', tempF: 0, tune: '', tank: 0, thrustLive: false, lock: false, hop: '', turn: '' as Turn, nextMi: 0, navTo: '', dest: '', destMi: 0, road: '' };
  // the hop's state for the HUD and the cluster: in the air; a refusal's reason for HOP_SAY ms after it; ready when the
  // tank holds the default hop's gas at this speed (hopNeedAt); else charging or tank low
  private hopState() {
    const h = this.hyper, p = this.phys;
    if (!h.live) return '';
    if (p.airborne) return 'Airborne';
    if (performance.now() - this.hopLog.refusedAt < HOP_SAY && this.hopLog.refused) return this.hopLog.refused;
    return h.tank >= hopNeedAt(Math.abs(p.vx)) ? 'Hop ready' : h.charging ? 'Hop: charging' : 'Hop: tank low';
  }

  get inAttract() { return this.attract; }
  // for the Feedback panel: the device and this drive, as numbers a player can paste to us. Nothing personal.
  report(): Report {
    const gl = this.renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const nav = navigator as Navigator & { deviceMemory?: number };
    const info = this.renderer.info, el = this.renderer.domElement;
    return {
      version: VERSION, host: location.protocol === 'file:' ? 'file' : location.host, ua: navigator.userAgent,
      screen: `${innerWidth}×${innerHeight} @${Math.round(devicePixelRatio * 100) / 100}`,
      pointer: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse',
      cores: navigator.hardwareConcurrency || 0, memoryGB: nav.deviceMemory ?? null,
      gpu: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'not reported',
      quality: presetFor(this.settings).label, adaptive: this.settings.adaptive, pixelRatio: Math.round(this.renderer.getPixelRatio() * 100) / 100,
      buffer: `${el.width}×${el.height}`, fps: this.fps, calls: info.render.calls, tris: info.render.triangles, textures: info.memory.textures,
      mode: this.mode, attract: this.attract, road: this.path?.label || 'ramp', mph: Math.round(Math.abs(this.phys.vx) * MPH), density: this.density,
      cars: this.traffic.cars.length, runSeconds: Math.round(this.time),
      time: this.settings.time, weather: this.settings.weather, ultra: this.ultraOn(),
    };
  }
  // ----------------------------------------------------------------------------------------- progress (progress.ts)
  // what the progress engine says worth telling the player: cars opening, the Hypercar, goals, the passport. In a venue
  // the game's own toasts are hidden, so the venue card shows them (footMsg).
  private footMsg: ((t: string) => void) | null = null;
  private say(text: string, kind: 'good' | 'info' = 'good') {
    if (this.attract) return;
    if (this.footMsg) this.footMsg(text); else this.ev.toast(text, kind);
  }
  private onProgress(e: ProgressEvent) {
    switch (e.type) {
      case 'carUnlock': this.profile.setEarnedCars(this.progress.earnedCars()); this.say(`Unlocked: ${carById(e.car).name} · ${CAR_MILES[e.car]} miles driven`); break;
      case 'hypercar': this.profile.setEarnedCars(this.progress.earnedCars()); this.say("OC Hypercar unlocked: 500 Road Points. It's yours for good"); break;
      case 'goal': this.say(`Goal done: ${e.text} · +${e.goal.cash} cash`); break;
      case 'allthree': this.say(`All three goals done · +${e.cash} cash`); break;
      case 'weekly': this.say(`Weekly challenge done: ${e.text} · +${e.weekly.cash} cash`); break;
      case 'streak': this.say(`${e.count}-day streak${e.saver ? " (this week's free saver used)" : ''}${e.cash ? ` · +${e.cash} cash` : ''}`); break;
      case 'stamp': this.footMsg?.(`Passport stamp: ${e.label}`); break;
      case 'ladder': this.say(e.label); break;
      case 'member': this.say(`Welcome to ${MEMBERSHIPS[e.venue]?.name ?? 'the venue'}`); break;
      case 'break': this.say(GOAL_COPY.breakNote, 'info'); break;
      default: break;
    }
  }
  private readonly pin: TickIn = { mps: 0, driving: false, controls: { throttle: 0, brake: 0, steer: 0, handbrake: false }, tier: 'free' };
  /** the tier of this run (progress.ts TIER_MULT): Free Drive is always `free`; a timed run's tier is the menu's difficulty
   *  (runDiff), which is the same mapping tierOf makes from its traffic (light Easy, moderate Medium, expert Extreme) */
  get trafficTier() { return this.runDiff && this.mode !== 'free' ? this.runDiff : tierOf(this.density, this.mode); }
  /** what a run's own pay is multiplied by: 1.5 on Extreme (progress.ts TIER_CASH) */
  get cashMult() { return TIER_CASH[this.trafficTier]; }
  /** which edition of the OC Hypercar this player has: the paid Founder Edition (its plaque, Glacier Silver and Founder
   *  Ice lights; owner mode counts), the standard car earned on Founders' Road, or null (not yours) */
  get hypercarEdition(): 'founder' | 'standard' | null {
    if (this.settings.owner || storeCars().owned.includes(FOUNDER_CAR)) return 'founder';
    return this.progress.hypercarEarned() ? 'standard' : null;
  }

  // ----------------------------------------------------------------------------------------- the venues (Phase 3a)
  // Lot 57 and Stoppage Time (venues.ts). On one of a venue's exit ramps in Free Drive, ARRIVE_M before the street (or
  // on a tap of the venue's prompt), the screen fades and the car is parked at the venue: the game stops driving and
  // says plainly that street driving isn't built yet. Get out mounts the venue's own page over the paused game (its
  // loop, sound and renderer stop: no frames drawn, no hidden GPU work); its Drive (or Drive on, from the car) fades
  // back to the cockpit on the nearest on-ramp to the freeway, the venue disposed completely.
  private vr: Map<Path, VenueRamp> | null = null;
  private vramps() { return (this.vr ??= venueRamps(this.net)); }
  private get venueAllowed() { return !this.attract && !this.over && this.mode === 'free'; }
  venueState: { vr: VenueRamp; phase: 'parked' | 'leaving' | 'foot' | 'returning' } | null = null;
  private foot: Mounted | null = null;
  private footHost: HTMLDivElement | null = null;
  /** where you are: null driving; else the venue, the ramp you came by and parked, getting out, on foot or driving off */
  venue() { const v = this.venueState; return v ? { id: v.vr.venue.id, name: v.vr.venue.name, phase: v.phase, ramp: v.vr.path.id, street: v.vr.exit.street, from: v.vr.exit.from } : null; }
  get venues() { return VENUES.map((v) => v.name); }
  /** park at the venue whose ramp you're on (the trigger, or a tap on the prompt) */
  arriveVenue(vr = this.vramps().get(this.path)) {
    if (!vr || this.venueState || !this.venueAllowed || this.paused) return false;
    const auto = this.autoDrive;
    this.venueState = { vr, phase: 'parked' };
    this.route = []; this.routeTarget = null; this.routeVenue = null; this.autoDrive = false;
    this.input.clear();
    this.placeCar(this.path, clamp(this.phys.s, 2, this.path.len - 2), 0, 0);
    this.navNow();
    // (Auto-drive hands back on arrival as at any destination, in the same toast)
    const text = `Drove ${vr.exit.street} to ${vr.venue.name} · street driving isn't built yet` + (auto ? '. Auto-drive off: you have control' : '');
    this.lastVenueToast = text;
    // (the parked panel states "Drove <road> to <venue> · street driving isn't built yet" itself and keeps it up, so a toast of the
    // same words would stack over the membership panel: only the hand-back, which the panel doesn't say, is a toast)
    void fade(true).then(() => new Promise((r) => setTimeout(r, 240))).then(() => { if (auto) this.ev.toast('Auto-drive off: you have control', 'info'); return fade(false, 420); });
    return true;
  }
  lastVenueToast = '';
  // the car's paint as it is drawn (a store paint if one is on), for your car in the venue's lot
  private paintNow() { const c = carById(this.driving); return equippedPaint(c.id)?.hex ?? paintFor(c, this.settings.paints); }
  // the game stops for the walk (its loop, its sound, its input) and starts again
  private hold(on: boolean) {
    if (on) { cancelAnimationFrame(this.raf); this.raf = 0; this.audio.suspend(); this.input.detach(); this.input.clear(); this.input.takeActions(); return; }
    this.input.attach(); this.input.clear(); this.input.takeActions();
    this.audio.start(); this.audio.resume();
    this.last = performance.now(); this.acc = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }
  /** Get out: fade, the game stops, and the venue's page loads over it; resolves true once you're standing there */
  async getOut(): Promise<boolean> {
    const vs = this.venueState;
    if (!vs || vs.phase !== 'parked' || this.paused) return false;
    // Vega & Vinnie's asks a one-time cash membership (owner mode skips it); the HUD's Join button buys it
    if (!this.settings.owner && !this.progress.hasAccess(vs.vr.venue.id)) {
      const m = MEMBERSHIPS[vs.vr.venue.id];
      this.ev.toast(`${m.name} is members only: ${m.price.toLocaleString()} cash for a lifetime entry. Join from the Get out panel`, 'info');
      return false;
    }
    vs.phase = 'leaving'; this.navNow();
    this.audio.thump(3);                                          // the door
    await fade(true);
    this.hold(true);
    const host = document.createElement('div'); host.id = 'onfoot-host'; document.body.appendChild(host); this.footHost = host;
    const app = this.host.parentElement; if (app) app.style.display = 'none';
    this.ev.foot?.(true);
    try {
      this.foot = await mountVenue(vs.vr.venue.id, host, {
        car: this.driving, paint: this.paintNow(), quality: venueQuality(this.settings.quality, COARSE), clock: venueClock(this.settings.time),
        reducedMotion: REDUCED_MOTION, onDrive: () => { void this.drive(); },
      });
      void fade(false, 300);                                      // the venue's own loading screen shows its progress
      await this.foot.ready;
      if (this.venueState === vs) { vs.phase = 'foot'; this.startFootPoll(vs.vr.venue.id); }
      return true;
    } catch (e) {
      this.leaveFoot(); this.hold(false);
      if (this.venueState === vs) vs.phase = 'parked';
      this.navNow();
      this.ev.toast(`Couldn't open ${vs.vr.venue.name}: ${String((e as Error)?.message ?? e).slice(0, 120)}`, 'bad');
      await fade(false);
      return false;
    }
  }
  // the venue's page off (disposed: its renderer, people, listeners and hooks), the game's UI back
  private leaveFoot() {
    this.stopFootPoll();
    const f = this.foot; this.foot = null;
    try { f?.dispose(); } catch (e) { console.warn('venue dispose', e); }
    this.footHost?.remove(); this.footHost = null;
    const app = this.host.parentElement; if (app) app.style.display = '';
    configureTextures(QUALITY[this.settings.quality].texture, this.renderer.capabilities.getMaxAnisotropy());
    this.ev.foot?.(false);
    this.resize(true);
  }
  // a quit or a new drive while parked or on foot: no fade, nothing to drive back to
  private leaveVenue() { if (!this.venueState) return; const foot = !!this.foot || this.venueState.phase === 'foot'; this.venueState = null; if (foot) { this.leaveFoot(); this.hold(false); } }
  // The venue passport while you walk (progress.ts): once a second the venue page's `passport()` hook says where you are, whether you
  // sit, order or talk and whether it is paused; the game turns that into stamps, active time, Road Points and (at Vega &
  // Vinnie's, for members) marketer cash. Standing still for 30 s counts as idle; sitting or talking counts for up to 10 min.
  private footPoll = 0; private footCard: VenueCard | null = null;
  private startFootPoll(id: string) {
    this.stopFootPoll();
    const pv = passportVenue(id), host = this.footHost; if (!pv || !host) return;
    const pr = this.progress; pr.venueEnter(id);
    const card = this.footCard = mountVenueCard(host, id, pr);
    this.footMsg = (t) => card.say(t);
    let last = performance.now(), clock = 0, lastAct = 0, holdFrom = -1e9, px = NaN, pz = NaN, spot = '', sat = false, talked = false, orders = 0;
    const step = () => {
      const now = performance.now(); let dt = (now - last) / 1000; last = now; dt = Math.min(dt, 2);
      const hook = (window as unknown as { __onfoot?: { passport?: () => { spot: string | null; sitting: boolean; moving: boolean; talking: boolean; orders: number; paused: boolean; x: number; z: number } } }).__onfoot?.passport;
      if (typeof hook !== 'function') return;
      let s: ReturnType<NonNullable<typeof hook>>; try { s = hook(); } catch { return; }
      clock += dt;
      if (s.spot && s.spot !== spot) { pr.venueSpot(id, s.spot); lastAct = clock; }
      spot = s.spot ?? '';
      if (Math.hypot(s.x - px, s.z - pz) > 0.3 || s.moving) lastAct = clock;
      px = s.x; pz = s.z;
      if (s.sitting && !sat) { pr.venueDid(id, 'sit'); lastAct = holdFrom = clock; }
      sat = s.sitting;
      if (s.talking && !talked) { pr.venueDid(id, 'talk'); lastAct = holdFrom = clock; }
      talked = s.talking;
      if (s.orders > orders) { pr.venueDid(id, 'order'); lastAct = clock; }
      orders = Math.max(orders, s.orders);
      const holding = (s.sitting || s.talking) && clock - holdFrom <= SIT_IDLE_SECS;
      const active = !s.paused && !document.hidden && (clock - lastAct <= VENUE_IDLE_SECS || holding);
      pr.venueTick(id, dt, { active, social: s.talking });
      card.update(active);
    };
    this.footPoll = window.setInterval(step, 1000);
    this.progress.save();
  }
  private stopFootPoll() {
    if (this.footPoll) { clearInterval(this.footPoll); this.footPoll = 0; }
    this.footMsg = null;
    this.footCard?.dispose(); this.footCard = null;
    this.profile.setEarnedCars(this.progress.earnedCars()); this.progress.save(); this.profile.save();
  }
  /** the on-ramp nearest where the exit met the street, preferring one back onto the freeway you left by */
  private onRampNear(exit: VenueExit): Path | null {
    let best: Path | null = null, bs = Infinity;
    for (const q of this.net.paths) {
      if (q.main || q.prev || q.inc.length) continue;
      const d = Math.hypot(q.xs[0] - exit.x, q.zs[0] - exit.z);
      if (d > 1500) continue;
      const lead = this.net.leadsTo(q);
      if (!lead) continue;
      const sc = d + (lead === exit.from ? 0 : 350);
      if (sc < bs) { bs = sc; best = q; }
    }
    return best;
  }
  /** Drive: from the venue's Drive (or the car's Drive on): fade, the cockpit, the engine, the nearest on-ramp */
  async drive(): Promise<boolean> {
    const vs = this.venueState;
    if (!vs || (vs.phase !== 'foot' && vs.phase !== 'parked')) return false;
    const fromFoot = vs.phase === 'foot';
    vs.phase = 'returning'; this.navNow();
    await fade(true);
    if (fromFoot) this.leaveFoot();
    const ramp = this.onRampNear(vs.vr.exit);
    if (ramp) this.placeCar(ramp, 4, 0, 0);
    else { const m = this.lastMain ?? this.net.mains[0], pr = m.project(vs.vr.exit.x, vs.vr.exit.z, 0); this.placeCar(m, clamp(pr.s, 5, m.len - 5), 1, 0); }
    this.venueState = null;
    this.cam = 'cockpit'; this.camBlend = 1; this.input.freeLook = false;
    const p = this.phys;
    for (let i = 0; i < 300 && this.roads.update(p.x, p.z, Math.sin(p.psi), Math.cos(p.psi), 6) + this.terrain.update(p.x, p.z, 3) > 0; i++) { /* build what's in view */ }
    this.traffic.fill(this.view());
    if (fromFoot) this.hold(false);
    this.audio.start();
    this.navNow();
    this.ev.toast(`${ramp ? `On the ramp to ${this.net.leadsTo(ramp)}` : `Back on ${this.path.label}`} · street driving isn't built yet`, 'info');
    await fade(false, 420);
    return true;
  }

  // testing aids: run the simulation ahead with fixed controls (or the autopilot), without waiting for frames
  fastForward(seconds: number, c: Partial<Controls> = {}, cruise = 0) {
    Object.assign(this.input.c, c);
    this.takeOver(Math.abs(c.steer ?? 0) > 0.02 || !!c.handbrake, (c.brake ?? 0) > 0.05 || !!c.handbrake);
    for (let t = 0; t < seconds; t += DT) {
      if (cruise > 0) this.autopilot(this.input.c, cruise);
      else if (this.autoDrive) this.autopilot(this.input.c, this.autoCruise);
      this.simulate(DT);
      if (this.steps % 24 === 0) this.stream(1);
    }
  }
  get stats() {
    return { roads: this.roads.count, tiles: this.terrain.count, traffic: this.traffic.cars.length, path: this.path.label, main: this.path.main, id: this.path.id, s: this.phys.s, d: this.phys.d, v: this.phys.vx,
      x: this.phys.x, z: this.phys.z, y: this.phys.y, scale: this.renderScale, calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles, switches: this.switches,
      visited: [...this.visited], route: this.route.map((j) => j.to.label), score: this.score, streak: this.streak, wrongWay: this.wrongWay, sky: this.skyMode };
  }

  dispose() {
    this.leaveVenue(); this.progress.save();
    cancelAnimationFrame(this.raf);
    this.offStore();
    removeEventListener('resize', this.onResize);
    this.resizeObs?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.detach();
    const cv = this.renderer.domElement;
    cv.removeEventListener('webglcontextlost', this.onContextLost);
    cv.removeEventListener('webglcontextrestored', this.onContextRestore);
    this.restorers.clear();
    this.style?.detach(); this.style = null;
    this.renderer.dispose();
  }
}
