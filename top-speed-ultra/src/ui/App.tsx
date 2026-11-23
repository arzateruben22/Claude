// Menus, settings, pause and results around the game, plus the HUD, the corner map and the touch controls.
// Phone first: big targets, one column, no keyboard needed anywhere.
//
// The main menu is one persistent glass sheet (owner, 2026-10-16: "more seamless, a finer luxury feel"): the sheet,
// the wordmark and the Drive dock stay put, and only what the sheet shows changes, the old content fading out where it
// stood while the new fades in. Opened from the pause screen, the same panels show as a card over the paused drive.

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties, ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Game, Result, CORNER_PX } from '../game/Game';
import type { Hud as HudData } from '../game/Game';
import { shareRunCard } from './runCard';
import { formatReport, copyText } from './feedback';
import { Settings, loadSettings, saveSettings, isFirstRun, loadBench, presetFor, ownerFromHash, ownerTestBuild, QUALITY, MODES, STARTS, Mode, PROFILES, profileOf, TRAFFIC, TRAFFIC_IDS, trafficOf, graphicsOf, graphicsPatch } from '../game/settings';
import type { TrafficMode } from '../game/settings';
import { bestOf } from '../game/bests';
import { board } from '../game/records';
import { AVATARS, ACHIEVEMENTS, ROUTES_ALL, levelOf, xpFor, PROFILE_VERSION } from '../game/profile';
import { DRIVERS, ABILITIES, SKINS } from '../game/drivers';
import { carById, figures, garageCars, PAINTS, paintFor, WHEELS, wheelFor } from '../game/cars';
import { GLACIER_SILVER, FOUNDER_ICE, plaqueNumber, founderWindowText } from '../game/founder';
import { HUD, HudHandle } from './HUD';
import { Touch } from './Touch';
import { Store } from './Store';
import { Seg } from './controls';
import { SettingsPanel } from './Settings';
import { BestsBoards, BestsCard, fmtScore } from './BestsCard';
import { kindOf } from '../game/bests';
import { storeReturnPending } from '../store/payments';
import { equippedPaint } from '../store/locker';
import { OcLockup, OcWatermark } from './Mark';
import { Ico } from './Icons';
import { Homes } from './Homes';
import { unread } from '../game/story';
import { garageSlots } from '../game/homes';
import { WorldMap } from './WorldMap';
import { RadioCard } from './RadioCard';
import { Phone, PhoneApp } from './Phone';
import { RadialMenu, RadialPick } from './RadialMenu';
import { PerfOverlay } from './PerfOverlay';
import type { ReactElement } from 'react';

type Screen = 'loading' | 'menu' | 'playing' | 'paused' | 'over' | 'foot';   // foot: walking a venue (its own page is up)
type Panel = null | 'settings' | 'start' | 'nav' | 'board' | 'profile' | 'driver' | 'garage' | 'feedback' | 'store' | 'map' | 'phone' | 'homes';

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
// the owner's test build turns owner mode on at every load (settings.ts ownerTestBuild); the Settings row and the garage say so
const TEST_BUILD = ownerTestBuild();
// The menu's hero by traffic mode (owner, 2026-11-18, "01 / Midnight Performance"): the headline over the live car, and
// the chips under it. The run's rules are the same words everywhere: a crash or a reset breaks the 60 s.
const HERO: Record<TrafficMode, { eyebrow: string; l1: string; l2: string; sub: string; chips: string[] }> = {
  zero:    { eyebrow: 'Zero traffic · drift mode', l1: 'Link the slides.', l2: 'Hold the angle.', sub: 'An empty freeway with the drift readout on. Chain drifts for your Drift Score.', chips: ['Drift score', 'Crash loses the chain'] },
  light:   { eyebrow: 'The 60 second run', l1: 'Chase speed.', l2: 'Hold your nerve.', sub: 'Push your speed. Survive 60 seconds.', chips: ['60 sec', 'No crashes'] },
  medium:  { eyebrow: 'The 60 second run', l1: 'Find the gaps.', l2: 'Hold your line.', sub: 'Medium traffic, simulated. Keep your average up for 60 seconds.', chips: ['60 sec', 'No crashes'] },
  extreme: { eyebrow: 'The 60 second run', l1: 'No room.', l2: 'No lifting.', sub: 'Extreme traffic, simulated: packed lanes and aggressive drivers.', chips: ['60 sec', 'No crashes'] },
};
// what the run types are called on the menu (Free Drive and Speed Survival are the game's two run types)
const RUN_SUB: Record<Mode, string> = { free: 'No clock. Take any interchange.', survival: 'Stay over 100 mph. One real crash ends it.' };
// the four mode tiles' road icons: a slide, then one, two and three lanes of traffic
function TileIcon({ id }: { id: TrafficMode }) {
  return (
    <svg className="tile-ico" viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {id === 'zero' ? <path d="M6 33C20 33 24 22 32 20S46 24 58 8M4 36c18 0 22-8 30-10" /> : <>
        <path d="M14 38 27 4M50 38 37 4" /><path d="M32 36v-5M32 24v-5M32 12V8" strokeDasharray="0" />
        <rect x="29" y="14" width="6" height="8" rx="1.5" fill="currentColor" stroke="none" opacity="0.9" />
        {(id as string) === 'medium' || id === 'extreme' ? <rect x="21" y="24" width="6" height="8" rx="1.5" fill="currentColor" stroke="none" opacity="0.9" /> : null}
        {id === 'extreme' && <><rect x="38" y="22" width="6" height="8" rx="1.5" fill="currentColor" stroke="none" opacity="0.9" /><rect x="26" y="8" width="5" height="6" rx="1.2" fill="currentColor" stroke="none" opacity="0.9" /></>}
      </>}
    </svg>
  );
}
// room the economy lane (claude/economy) fills: the menu's Road Points widget and a garage card's unlock bar
export interface AppSlots { roadPoints?: ReactElement | null; carUnlock?: (carId: string) => ReactElement | null }
// `?perf` in the address: the performance overlay for this visit (not saved); `?bench=1` lets the first-run graphics
// check run in an automated browser too (it never runs on its own under automation: SwiftShader's frames say nothing
// about a real device)
const QUERY = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
const PERF_URL = QUERY.has('perf');
const BENCH_URL = QUERY.get('bench') === '1';
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// our own venues in the Go to sheet (src/game/venues.ts; the World Map's Places tab lists them too)
const VENUE_LIST = [{ name: 'Lot 57', blurb: 'Taproom and yard · Orangewood Ave, Anaheim' }, { name: 'Stoppage Time', blurb: 'Sports bar · Claudina Way, Anaheim' }];
const ROUTES = ['I-5', 'I-405', 'CA-55', 'CA-57', 'CA-22', 'CA-91', 'CA-73', 'CA-133', 'CA-241', 'CA-261'];
const MODE_LIST = Object.keys(MODES) as Mode[];
const LEAVE_MS = 380;      // the loading screen's fade into the menu (styles.css: .loading-screen.leaving)
const GHOST_MS = 260;      // how long the outgoing content of the sheet lingers while it fades (styles.css: sheet-out)
const IDLE_MS = 4000;      // the Minimal HUD tucks the top bar and the road map away after this long without input (the sky camera stays)
// keys that only drive (throttle, brake, steering, handbrake, look back, shifts): pressing them isn't asking for the HUD
const DRIVING_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyV', 'KeyQ', 'KeyE']);
// the condensed HUD's three layouts (HUD_POV_SPEC 2): a phone upright ('pp': one compact cluster across the top), a
// phone on its side ('pl') and a desktop ('desk', the reference layout). A narrow window with a mouse takes the phone's.
type HudLayout = 'pp' | 'pl' | 'desk';
// the round map's size for each, by the Corner size setting (Small, Medium, Large)
const MAP_PX: Record<HudLayout, number[]> = { pp: [96, 112, 128], pl: [80, 88, 104], desk: CORNER_PX };
const HINT_RADIAL = 'tsu.hint.radial';   // the one-time "Hold Pause for the quick menu" toast on a touch screen

export function App({ slots }: { slots?: AppSlots } = {}) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const hud = useRef<HudHandle>(null);
  const lastHud = useRef<HudData | null>(null);                        // the latest readouts, for the pause screen
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [panel, setPanelState] = useState<Panel>(() => (storeReturnPending() ? 'store' : null));   // back from Stripe or a sign-in link
  const [mapHome, setMapHome] = useState<string | undefined>(undefined);   // the World Map opened from Lifestyle, on a home
  const [busy, setBusy] = useState(true);
  const [loadingText, setLoadingText] = useState('Starting the engine');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [mode, setMode] = useState<Mode>('free');
  const [result, setResult] = useState<Result | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  const [hudOn, setHudOn] = useState(true);
  const [lost, setLost] = useState(false);
  const [error, setError] = useState('');
  const [boardMode, setBoardMode] = useState<Mode>('survival');
  const [moreOpen, setMoreOpen] = useState(false);                    // the menu's overflow: the screens that are not on the front page
  const [navTarget, setNavTarget] = useState<string | null>(null);
  const [exitRoad, setExitRoadState] = useState<string | null>(null);    // the Start panel: which carriageway's exits are listed
  const [radioOpen, setRadioOpen] = useState(false);                  // the radio card beside the controls while driving
  // Auto-drive (Game.setAutoDrive): offered with a route in Free Drive, and whether it drives; from the HUD's readouts,
  // set only when one of them changes
  const [autoDrive, setAutoDrive] = useState({ offer: false, on: false });
  // the venues (Game.arriveVenue, getOut, drive): on a venue's ramp, its name for the prompt; parked there, its name
  const [venueUi, setVenueUi] = useState({ prompt: '', parked: '', note: '' });
  const getOutRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);                   // the pause screen's Resume: the keyboard lands on it
  const [navFrom, setNavFrom] = useState<Panel>(null);                 // the Go to card opened from the World Map goes Back to it
  const [setSec, setSetSec] = useState('graphics');                  // the Settings rail's current section
  // the radial quick menu (U3): held open from the Pause button or Tab; holdT is the 300 ms timer, held says it opened
  const [radial, setRadial] = useState<{ x: number; y: number } | null>(null);
  const holdT = useRef(0), held = useRef(false);
  const [report, setReport] = useState('');                           // the Feedback panel's text
  const [entering, setEntering] = useState(false);                    // the sheet's new content is fading in
  const [loadShown, setLoadShown] = useState(true);                   // the loading screen, kept up while it fades out
  const [, rerender] = useState(0);                                   // the garage changed the car: the atmosphere follows
  const reportRef = useRef<HTMLTextAreaElement>(null);
  const toastId = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // the graphics check (Game.benchmark): its progress while it runs, and how to stop it
  const [bench, setBench] = useState<null | { i: number; n: number; label: string; manual: boolean }>(null);
  const benchCancel = useRef<{ cancelled: boolean } | null>(null);

  // the sheet: its scroll area, the content in it, and the layer the outgoing content fades out on
  const sheetMain = useRef<HTMLDivElement>(null), sheetScroll = useRef<HTMLDivElement>(null), sheetBody = useRef<HTMLDivElement>(null), ghost = useRef<HTMLDivElement>(null);
  const ghostTimer = useRef(0), switched = useRef(false);
  const panelNow = useRef<Panel>(null), roadNow = useRef<string | null>(null);
  panelNow.current = panel; roadNow.current = exitRoad;
  // every change of what the sheet shows goes through here, so it cross-fades (outside the menu there is no sheet and
  // this is a plain state change)
  // (the menu's own screen fills the overlay while a screen opened from it sits in the sheet's column: a switch between
  // the two changes the sheet's shape, so the outgoing copy would land in the wrong place and only the new content fades in)
  const fade = useCallback((reshape = false) => {
    switched.current = true;
    if (reshape) { if (sheetBody.current && !reducedMotion()) setEntering(true); return; }
    if (crossFade(sheetMain.current, sheetBody.current, ghost.current, ghostTimer)) setEntering(true);
  }, []);
  const setPanel = useCallback((p: Panel) => { if (p !== panelNow.current) { fade(!inSheet(p) || !inSheet(panelNow.current)); panelNow.current = p; } setPanelState(p); }, [fade]);
  const setExitRoad = useCallback((r: string | null) => { if (r !== roadNow.current) { fade(); roadNow.current = r; } setExitRoadState(r); }, [fade]);

  const toast = useCallback((text: string, kind = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    // (a long one, the venues' arrival and drive-off, stays long enough to read)
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), text.length > 60 ? 4500 : 1800);
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next); saveSettings(next); game.current?.updateSettings(next);
  };

  useEffect(() => {
    if (!host.current || game.current) return;
    let g: Game;
    try {
      g = new Game(host.current, settings, {
        hud: (h) => { lastHud.current = h; hud.current?.set(h); setAutoDrive((a) => (a.offer === h.autoOffer && a.on === h.autoOn ? a : { offer: h.autoOffer, on: h.autoOn }));
          setVenueUi((v) => (v.prompt === h.venuePrompt && v.parked === h.parked && v.note === h.parkedNote ? v : { prompt: h.venuePrompt, parked: h.parked, note: h.parkedNote })); },
        toast: (text, kind) => toast(text, kind),
        over: (r) => { setResult(r); setScreen('over'); },
        pause: (on) => setScreen((s) => (on ? (s === 'playing' ? 'paused' : s) : s === 'paused' ? 'playing' : s)),
        loading: (on, text) => { if (text) setLoadingText(text); setBusy(on); },
        context: (l) => setLost(l),
        hudToggle: (on) => setHudOn(on),
        corner: (c) => update({ corner: c }),
        foot: (on) => { setRadial(null); setRadioOpen(false); setPanel(null); setScreen(on ? 'foot' : 'playing'); },
      });
    } catch (e) {
      setError('This game needs WebGL 2, and this browser or device has it turned off. ' + String((e as Error).message || ''));
      return;
    }
    game.current = g;
    (window as unknown as { __game: Game }).__game = g;
    g.init().then(() => setScreen('menu'), (e) => setError(String(e)));
    return () => { g.dispose(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { game.current?.setMapCanvas(mapRef.current); });
  // parked at a venue: the keyboard lands on Get out
  // (and the route is done: the Go to button stops showing one)
  useEffect(() => { if (venueUi.parked) { setNavTarget(null); getOutRef.current?.focus({ preventScroll: true }); } }, [venueUi.parked]);
  // the pause screen (and back on it from a card): the keyboard lands on Resume, so Enter carries on driving (Esc too, input.ts)
  useEffect(() => { if (screen === 'paused' && !panel) resumeRef.current?.focus({ preventScroll: true }); }, [screen, panel]);
  // (the Go to card remembers the World Map only while it is up: Esc, a pick or the HUD's Go to start afresh)
  useEffect(() => { if (panel !== 'nav') setNavFrom(null); }, [panel]);
  // owner mode from an open page's address: #owner on, #owner=0 off (settings.ts reads it at load)
  useEffect(() => {
    const h = () => { const o = ownerFromHash(); if (o !== null) update({ owner: o }); };
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadingOn = (screen === 'loading' || busy) && !error;
  // the loading screen fades into the menu (and into the drive): it stays up, fading, a moment after loading ends
  useEffect(() => {
    if (loadingOn) { setLoadShown(true); return; }
    const t = setTimeout(() => setLoadShown(false), reducedMotion() ? 0 : LEAVE_MS);
    return () => clearTimeout(t);
  }, [loadingOn]);

  const inMenu = screen === 'menu' && !busy && !error;
  // The graphics check: on this device's first run it starts on its own on the menu (about 5 s, Skip on its card); Settings
  // runs it again. Run on its own it only measures: the preset stays (Retro Low for a new player, owner 2026-11-16) and
  // the pick is saved for the governor and Settings' hint. Asked for from Settings, the player asked for its pick
  const runBench = useCallback(async (manual: boolean) => {
    const g = game.current;
    if (!g || g.benchRunning() || !g.inAttract) return;
    const cancel = { cancelled: false }; benchCancel.current = cancel;
    setBench({ i: 0, n: 6, label: '', manual });
    const r = await g.benchmark((i, n, label) => setBench({ i, n, label, manual }), cancel);
    benchCancel.current = null; setBench(null);
    if (!r) return;
    if (r.inconclusive) { toast(`Graphics check: frames sat at ${r.cap ?? 30} fps in every round, so the check couldn't tell (the display may cap them). Your settings stay`, 'info'); return; }
    const what = `${QUALITY[r.quality].label}${r.scale < 1 ? ` at ${Math.round(r.scale * 100)}% resolution` : ''}${r.target === 30 ? ', a steady 30 fps' : ''}`;
    if (manual) { update({ ...graphicsPatch(graphicsOf(r)), qualityChosen: false }); toast(`Graphics check: ${what}`, 'info'); return; }
    const now = settingsRef.current, cur = presetFor(now).label;
    toast(`Graphics check: this device holds ${what}. ${now.qualityChosen ? 'Your own choice stays' : `${cur} stays; Settings > Graphics has the rest`}`, 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);
  const skipBench = () => {
    if (benchCancel.current) benchCancel.current.cancelled = true;
    if (bench && !bench.manual) game.current?.skipBenchmark();
    setBench(null);
  };
  const benchAsked = useRef(false);
  useEffect(() => {
    if (!inMenu || benchAsked.current) return;
    benchAsked.current = true;
    const auto = isFirstRun() && !loadBench() && !settingsRef.current.qualityChosen && (!navigator.webdriver || BENCH_URL);
    if (auto) void runBench(false);
  }, [inMenu, runBench]);
  useEffect(() => { if (!inMenu) setEntering(false); }, [inMenu]);
  // a switch starts at the top of the sheet; if the control that made it went with the old content, focus moves to
  // the new content so the keyboard carries on from there
  const view = (panel ?? 'home') + (panel === 'start' ? ':' + (exitRoad ?? '') : '');
  useLayoutEffect(() => {
    if (!switched.current) return;
    switched.current = false;
    if (sheetScroll.current) sheetScroll.current.scrollTop = 0;
    const a = document.activeElement;
    if (!a || a === document.body) sheetBody.current?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => () => clearTimeout(ghostTimer.current), []);

  // the overflow closes on a tap anywhere else
  useEffect(() => {
    if (!moreOpen) return;
    const f = (e: PointerEvent) => { if (!(e.target instanceof Element && e.target.closest('.mp-more-wrap'))) setMoreOpen(false); };
    addEventListener('pointerdown', f, true);
    return () => removeEventListener('pointerdown', f, true);
  }, [moreOpen]);

  const drive = (m: Mode = mode) => {
    setMoreOpen(false); setMode(m); setPanel(null); setResult(null); setNavTarget(null);
    setScreen('playing');
    void game.current?.start(m, settings.start);
    // the quick menu is the way to the radio and the garage on a phone: say once how to open it
    if (coarse) {
      let seen = true;
      try { seen = localStorage.getItem(HINT_RADIAL) === '1'; if (!seen) localStorage.setItem(HINT_RADIAL, '1'); } catch { /* storage off: no hint */ }
      if (!seen) setTimeout(() => toast('Hold Pause for the quick menu'), 2600);
    }
  };
  const resume = () => { setPanel(null); game.current?.setPaused(false); setScreen('playing'); };
  const openFeedback = () => { if (game.current) setReport(formatReport(game.current.report())); setPanel('feedback'); };
  const toMenu = () => { setPanel(null); setResult(null); game.current?.quitToMenu(); setScreen('menu'); };
  const navigate = (label: string | null) => {
    if (game.current?.navigateTo(label)) setNavTarget(label);
    setPanel(null);
    if (screen === 'paused') resume();
  };
  const openBoard = () => { setBoardMode(mode === 'free' ? 'survival' : mode); setPanel('board'); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && moreOpen) { setMoreOpen(false); e.stopPropagation(); return; }
      if (e.code === 'Escape' && panel) { setPanel(null); e.stopPropagation(); }
      // Enter drives from the menu, unless it is pressing a focused control (that control gets it)
      const t = e.target as HTMLElement | null;
      if (e.code === 'Enter' && screen === 'menu' && !panel && !(t && t.closest?.('button, a, input, textarea, select, [role="radio"]'))) drive();
      // hold Tab while driving for the quick menu (released, the menu picks or cancels)
      if (e.code === 'Tab' && screen === 'playing' && !panel && !e.repeat && !radial) { e.preventDefault(); clearTimeout(holdT.current); holdT.current = window.setTimeout(() => setRadial({ x: innerWidth / 2, y: innerHeight / 2 }), 300); }
    };
    // a quick Tab (let go before the quick menu opens) still moves focus, through the HUD's controls while driving
    const ku = (e: KeyboardEvent) => {
      if (e.code !== 'Tab') return;
      const pending = holdT.current && !radial && screen === 'playing' && !panel;
      clearTimeout(holdT.current); holdT.current = 0;
      if (pending) focusHudControl(e.shiftKey ? -1 : 1);
    };
    addEventListener('keyup', ku, true);
    addEventListener('keydown', k, true);
    return () => { removeEventListener('keydown', k, true); removeEventListener('keyup', ku, true); };
  });

  // the mode picker is one radio group: arrow keys move the choice, Tab leaves it
  const modeKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = (MODE_LIST.indexOf(mode) + step + MODE_LIST.length) % MODE_LIST.length;
    setMode(MODE_LIST[i]);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus();
  };

  const playing = screen === 'playing';
  // the adaptive HUD (U1): in Minimal, true once a drive has gone IDLE_MS without a tap, mouse move, key or pad button
  const idle = useIdle(playing && settings.hudStyle === 'minimal', () => game.current?.input.padAt ?? 0);
  const layout = useHudLayout();
  const cornerPx = MAP_PX[layout][settings.cornerSize] ?? MAP_PX[layout][1];
  const appRef = useRef<HTMLDivElement>(null);
  const vis = useVisibleInsets(appRef);
  const start = STARTS.find((s) => s.label === settings.start) ?? STARTS[0];
  // "start at your exit": the key names the carriageway; the exit list gives its sign text
  const exitRoadOf = settings.exit.split(' @ ')[0];
  const myExit = settings.exit ? game.current?.exitsFor(exitRoadOf).find((e) => e.key === settings.exit) ?? null : null;
  const driver = DRIVERS.find((d) => d.id === settings.driver) ?? DRIVERS[0];
  const car = carById(game.current?.carId ?? 'rossini-gt');
  // the drive HUD's chips under the speed: the driving profile the handling slider sits on (settings.ts PROFILES, or
  // Custom between them) and the assists the physics runs at every setting (ABS and traction control). While the
  // hypercar is driven the HUD adds its tune's chip from the run itself (Game.hud.tune, cars.ts tuneFor): Unleashed in
  // Free Drive, its race tune in Speed Survival
  const prof0 = profileOf(settings.handling);
  const chips = [prof0 === 'custom' ? 'Custom' : prof0 === 'sim' ? 'Sim' : PROFILES[prof0].label, 'ABS', 'TCS'];
  // the atmosphere follows the car (owner, 2026-10-21): styles.css re-points the tokens by <html data-car>
  useEffect(() => { document.documentElement.dataset.car = car.id; }, [car.id]);
  // and the driver signs the human elements (the ability ring, the Driver row, the avatar) with their colour
  useEffect(() => { document.documentElement.dataset.driver = settings.driver; }, [settings.driver]);
  // and the look: the interface's art direction from the owner's style library (styles.css :root[data-look])
  useEffect(() => { document.documentElement.dataset.look = settings.look; }, [settings.look]);
  // the theme (owner, 2026-11-18): Midnight (dark) or Velocity (light), Auto following the device's prefers-color-scheme;
  // styles.css re-points the menu's and Settings' tokens by <html data-theme> (the in-drive HUD keeps its own)
  const [prefersLight, setPrefersLight] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(prefers-color-scheme: light)'), f = () => setPrefersLight(q.matches);
    f(); q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  const theme: 'light' | 'dark' = settings.theme === 'auto' ? (prefersLight ? 'light' : 'dark') : settings.theme;
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.themeMode = settings.theme; }, [theme, settings.theme]);
  // the menu's live scene follows it: a night freeway behind Midnight, a day one behind Velocity (Game.setMenuTime)
  useEffect(() => { if (screen !== 'loading') game.current?.setMenuTime(theme === 'dark' ? 'night' : 'day'); }, [theme, screen]);

  // the panels: what each shows, and how wide it is when it is a card over the pause screen
  const panelView = (): { cls: string; body: ReactNode } | null => {
    switch (panel) {
      case 'start': return {
        cls: 'wide', body: exitRoad ? <>
          <h2><Shield label={exitRoad} /></h2>
          <p className="fine">Pick your exit. You start 450 m before its sign, in the second lane, from the signs in the map data.</p>
          <div className="grid exits">
            {(game.current?.exitsFor(exitRoad) ?? []).map((e) => (
              <button key={e.key} className={'gcell' + (settings.exit === e.key ? ' on' : '')} onClick={() => { update({ exit: e.key }); setExitRoad(null); setPanel(null); }}>
                <b>{e.text}</b><span>{e.mi.toFixed(1)} mi along · exit {e.side === 'R' ? 'right' : 'left'}</span>
              </button>
            ))}
          </div>
          <div className="row"><button className="btn" onClick={() => setExitRoad(null)}>Back</button></div>
        </> : <>
          <h2>Start on</h2>
          <div className="grid">
            {STARTS.map((s) => (
              <button key={s.label} className={'gcell' + (!settings.exit && s.label === settings.start ? ' on' : '')} onClick={() => { update({ start: s.label, exit: '' }); setPanel(null); }}>
                <Shield label={s.label} /><span>{s.blurb}</span>
              </button>
            ))}
          </div>
          <h3>Or at your exit</h3>
          <div className="grid roads">
            {ROUTES.flatMap((r) => (game.current?.mainsLabels ?? []).filter((l) => l.startsWith(r + ' ')).map((l) => (
              <button key={l} className={'gcell' + (settings.exit.startsWith(l + ' @') ? ' on' : '')} onClick={() => setExitRoad(l)}><Shield label={l} /></button>
            )))}
          </div>
          <div className="row"><button className="btn" onClick={() => setPanel(null)}>Back</button></div>
        </>,
      };
      case 'nav': return {
        cls: 'wide', body: <>
          <h2>Go to</h2>
          <p className="fine">Pick a place, or a freeway and direction. The yellow line on the map, the card at the top and the blue chevrons on the road show the way through each interchange.</p>
          <h3>Places</h3>
          {/* our own venues: the route ends on the venue's exit ramp, where you park and can get out */}
          <div className="grid places">
            {VENUE_LIST.map((v) => (
              <button key={v.name} className={'gcell place' + (navTarget === v.name ? ' on' : '')} onClick={() => navigate(v.name)}><b>{v.name}</b><span>{v.blurb}</span></button>
            ))}
          </div>
          <h3>Freeways</h3>
          <div className="grid nav">
            {ROUTES.flatMap((r) => (game.current?.mainsLabels ?? []).filter((l) => l.startsWith(r + ' ')).map((l) => (
              <button key={l} className={'gcell' + (navTarget === l ? ' on' : '')} onClick={() => navigate(l)}><Shield label={l} /></button>
            )))}
          </div>
          <div className="row">
            {navTarget && <button className="btn" onClick={() => navigate(null)}>Clear route</button>}
            <button className="btn" onClick={() => { setPanel(navFrom); setNavFrom(null); }}>Back</button>
          </div>
        </>,
      };
      case 'feedback': return {
        cls: 'narrow', body: <>
          <h2>Feedback</h2>
          <p className="fine">This report is about your device and this drive, nothing personal, and the game never sends it anywhere. Copy it, add what you saw, and send it to us wherever you got the game.</p>
          <textarea ref={reportRef} className="report" readOnly value={report} rows={10} aria-label="Feedback report" />
          <div className="row">
            <button className="btn primary" onClick={() => void copyText(report, reportRef.current).then((ok) => toast(ok ? 'Copied' : 'Select the text and copy it', ok ? 'good' : 'info'))}>Copy</button>
            {typeof navigator.share === 'function' && <button className="btn" onClick={() => navigator.share({ title: 'OC Ultra feedback', text: report }).catch(() => { /* cancelled */ })}>Share</button>}
            <button className="btn" onClick={() => setPanel(null)}>Back</button>
          </div>
        </>,
      };
      case 'profile': return game.current ? { cls: 'profile', body: <ProfilePanel game={game.current} onClose={() => setPanel(null)} /> } : null;
      case 'garage': return game.current ? { cls: 'profile', body: <GaragePanel game={game.current} settings={settings} update={update} ui={slots} onClose={() => setPanel(null)} onPick={() => rerender((n) => n + 1)} /> } : null;
      case 'driver': return {
        cls: '', body: <>
          <h2>Driver</h2>
          <div className="drivers">
            {DRIVERS.map((d) => {
              const a = ABILITIES[d.ability];
              return (
                <button key={d.id} className={'gcell driver' + (settings.driver === d.id ? ' on' : '')} onClick={() => update({ driver: d.id })}>
                  <b>{d.name}</b><small>{d.title}</small><span>{d.blurb}</span>
                  <em>{a.name}: {a.blurb} Recharges in {a.cooldown} s.</em>
                </button>
              );
            })}
          </div>
          <div className="field"><label>Presentation</label><Seg label="Presentation" value={settings.presentation} options={['m', 'f']} labels={(v) => (v === 'm' ? 'Male' : 'Female')} onChange={(v) => update({ presentation: v })} /></div>
          <div className="field"><label>Skin tone</label>
            <div className="swatches" role="group" aria-label="Skin tone">{SKINS.map((c, i) => <button key={i} aria-pressed={settings.skin === i} style={{ background: '#' + c.toString(16).padStart(6, '0') }} onClick={() => update({ skin: i })} aria-label={`Tone ${i + 1}`} />)}</div>
          </div>
          <p className="fine">Looks are cosmetic. Use the ability with the round button (or F). Abilities change the traffic or the grip, never the scoring rules.</p>
          <div className="row"><button className="btn primary" onClick={() => setPanel(null)}>Done</button><button className="btn" onClick={openFeedback}>Feedback</button></div>
        </>,
      };
      case 'board': return {
        cls: '', body: <>
          <h2>Personal bests</h2>
          <BestsBoards />
          <p className="eyebrow">Run scores</p>
          <Seg label="Mode" value={boardMode} options={['survival', 'free'] as Mode[]} labels={(m) => MODES[m].label} onChange={setBoardMode} />
          <Board runs={board(boardMode)} mode={boardMode} highlight={0} />
          <div className="row"><button className="btn" onClick={() => setPanel(null)}>Back</button></div>
        </>,
      };
      case 'settings': return {
        cls: 'wide settings', body: <SettingsPanel game={game.current} settings={settings} update={update} sec={setSec} setSec={setSetSec} onDone={() => setPanel(null)} onFeedback={openFeedback}
          inMenu={screen === 'menu'} benching={!!bench} runBench={() => void runBench(true)} coarse={coarse} testBuild={TEST_BUILD} />,
      };
      default: return null;
    }
  };
  const pv = panelView();

  // The main menu, "01 / Midnight Performance" (owner, 2026-11-18): the hero over the game's own live car, the run's type,
  // the car line, FOUR mode tiles (the traffic modes: Zero traffic with drift mode, Light, Medium, Extreme), where the run
  // starts, START RUN and your best. The rest of the menu (World Map, Lifestyle, Phone, the Store, Feedback, the driver) is
  // in the overflow beside Settings; Garage, Bests and Profile are the top bar's (a tab bar on a phone).
  const tm = trafficOf(settings.density), hero = HERO[tm];
  const onUnleashed = car.id === 'oc-hyper' && mode === 'free';
  const pb = bestOf(onUnleashed ? 'unleashed' : 'open', tm), pbKind = kindOf(tm);
  const tileKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = (TRAFFIC_IDS.indexOf(tm) + step + TRAFFIC_IDS.length) % TRAFFIC_IDS.length;
    update({ density: TRAFFIC[TRAFFIC_IDS[i]].density });
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus();
  };
  const unreadN = game.current ? unread(game.current.profile.p, levelOf(game.current.profile.p.xp)) : 0;
  const home = (
    <div className="mp-home">
      <div className="mp-hero">
        <p className="mp-eyebrow">{hero.eyebrow}</p>
        <h2 className="mp-h"><span>{hero.l1}</span><span>{hero.l2}</span></h2>
        <p className="mp-sub">{hero.sub}</p>
        <div className="mp-row">
          <div className="mp-chips" aria-label="This run">{hero.chips.map((c) => <span key={c}>{c}</span>)}</div>
          <div className="runs" role="radiogroup" aria-label="Run type" onKeyDown={modeKeys}>
            {MODE_LIST.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} tabIndex={mode === m ? 0 : -1} aria-describedby="run-brief" onClick={() => setMode(m)}>{MODES[m].label}</button>
            ))}
          </div>
        </div>
        <p className="mp-brief" id="run-brief">{RUN_SUB[mode]}</p>
      </div>
      <button type="button" className="mp-carline" onClick={() => setPanel('garage')} aria-label={`${car.name}. Change car`}>
        <Ico name="garage" /><b>{car.name}</b><i aria-hidden="true" /><span>Change car</span><em aria-hidden="true">›</em>
      </button>
      <section className="mp-modes" aria-labelledby="mp-modes-h">
        <p className="mp-label" id="mp-modes-h">Choose your mode</p>
        <div className="modes" role="radiogroup" aria-label="Traffic mode" onKeyDown={tileKeys}>
          {TRAFFIC_IDS.map((t, i) => (
            <button key={t} type="button" className={'mode' + (tm === t ? ' on' : '')} role="radio" aria-checked={tm === t} tabIndex={tm === t ? 0 : -1} aria-describedby="mode-line"
              onClick={() => update({ density: TRAFFIC[t].density })}>
              <TileIcon id={t} />
              <span className="mode-text"><i>{String(i + 1).padStart(2, '0')}</i><b>{TRAFFIC[t].label}</b><span>{TRAFFIC[t].sub}</span></span>
            </button>
          ))}
        </div>
        <p className="mp-brief" id="mode-line">{TRAFFIC[tm].line}</p>
      </section>
      <div className="mp-go">
        <button type="button" className="mp-loc" onClick={() => { setExitRoadState(null); roadNow.current = null; setPanel('start'); }} aria-label={`Start on ${myExit ? exitRoadOf + ' ' + myExit.text : start.label}. Change`}>
          <Ico name="map" /><span><b>{myExit ? exitRoadOf : start.label}</b><small>{myExit ? `${myExit.text} exit` : start.blurb}</small></span>
        </button>
        <button type="button" className="btn primary go" onClick={() => drive()}>Start run</button>
        <div className="mp-side">
          <button type="button" className="mp-pb" onClick={openBoard} aria-label={`Personal best ${pb > 0 ? fmtScore(pbKind, pb) : 'none yet'}. Open Bests`}>
            <small>Personal best</small><b>{pb > 0 ? fmtScore(pbKind, pb) : '—'}</b>
          </button>
          <div className="mp-slot" data-slot="road-points">{slots?.roadPoints ?? null}</div>
        </div>
      </div>
      <p className="mp-credit fine">Freeway geometry: OpenStreetMap contributors via Overture Maps (ODbL). Elevation: USGS via AWS Terrain Tiles. Traffic and weather are simulated. The car, its badge and everything you see are our own, made in code.</p>
    </div>
  );
  // the top bar's overflow: every screen that is not on the front page
  const moreItems: { key: string; node: ReactNode }[] = [
    { key: 'profile', node: <button type="button" onClick={() => { setMoreOpen(false); setPanel('profile'); }}><Ico name="driver" />Profile</button> },
    { key: 'map', node: <button type="button" onClick={() => { setMoreOpen(false); setPanel('map'); }}><Ico name="map" />World Map</button> },
    { key: 'homes', node: <button type="button" onClick={() => { setMoreOpen(false); setPanel('homes'); }}><Ico name="home" />Lifestyle</button> },
    { key: 'phone', node: <button type="button" onClick={() => { setMoreOpen(false); setPanel('phone'); }}><Ico name="phone" />Phone{unreadN > 0 && <small className="new">{unreadN} new</small>}</button> },
    { key: 'driver', node: <button type="button" onClick={() => { setMoreOpen(false); setPanel('driver'); }}><Ico name="drive" />Driver<small>{driver.name}</small></button> },
    { key: 'store', node: <button type="button" className="store-open" aria-label="Store" onClick={() => { setMoreOpen(false); setPanel('store'); }}><Ico name="store" /><span><small>Optional</small><b>Store</b><span>OC Hypercar · Founders package soon. The OC Hypercar Founder Edition now, the Founders package once it is in the game. Every freeway, every mode and every car you can earn stays free.</span></span></button> },
    { key: 'feedback', node: <button type="button" onClick={() => { setMoreOpen(false); openFeedback(); }}><Ico name="chat" />Feedback</button> },
    { key: 'loop', node: <a href="https://claude.ai/artifact/FDj9Q6S961SLYBg1hMaqd1" target="_blank" rel="noopener noreferrer"><Ico name="go" />Loop Lab<small>Coming soon · an arcade preview, separate from OC</small></a> },
    { key: 'online', node: <span aria-disabled="true" className="off"><Ico name="online" />Online<small>Roadmap</small></span> },
  ];

  return (
    <div ref={appRef} className={'app' + (idle ? ' hud-idle' : '') + (settings.hudStyle === 'minimal' ? ' hud-min' : '')} data-hud={layout}
      style={{ '--map': `${cornerPx}px`, '--vis-t': `${vis.t}px`, '--vis-r': `${vis.r}px`, '--vis-b': `${vis.b}px`, '--vis-l': `${vis.l}px` } as CSSProperties}>
      <div className="stage" ref={host} />
      <HUD ref={hud} showFps={settings.showFps} visible={playing && hudOn} chips={chips} onAbility={() => game.current?.useAbility()} onThrust={(on) => game.current?.input.setThrust('touch', on)} />
      {/* the corner window: the road map is a round dial (the compass is its rim, HUD.tsx); the sky camera keeps its
          square frame and says it is a live view. Tap cycles map, sky camera, off. */}
      {playing && settings.corner !== 'off' && (
        <button type="button" className={'corner ' + settings.corner} style={{ width: cornerPx, height: cornerPx }} onClick={() => game.current?.cycleCorner()}
          aria-label={settings.corner === 'map' ? 'Road map. Tap for the sky camera.' : 'Sky camera. Tap to hide.'}>
          {/* the road map and the sky camera both draw into this canvas (Game.drawMap, Game.renderSky) */}
          <canvas ref={mapRef} />
          {settings.corner === 'sky' && <span className="corner-tag">Sky cam</span>}
        </button>
      )}
      {/* the controls: on a phone three 44 px icons beside the plate (View, Go to, Pause; Map stands where the map was
          while the window is off), each named by its hidden label; on a desktop a labelled rail with Radio too */}
      {playing && (
        <div className="tbar">
          {/* the rail's grid (a desktop: labelled rows, icons in two or three columns on a short window; styles.css) */}
          <div className="tbar-in">
          <button type="button" className="tbtn" title="View" onClick={() => game.current?.cycleCam()}><Ico name="camera" /><span className="tlabel">View</span></button>
          {settings.corner === 'off' && <button type="button" className="tbtn mapbtn" title="Map" onClick={() => game.current?.cycleCorner()}><Ico name="map" /><span className="tlabel">Map</span></button>}
          <button type="button" className={'tbtn' + (navTarget ? ' on' : '')} title="Go to" onClick={() => setPanel('nav')}><Ico name="nav" /><span className="tlabel">Go to</span></button>
          {/* with a route in Free Drive: Auto-drive drives it; steering or braking hands the car back (Game.setAutoDrive) */}
          {autoDrive.offer && (
            <button type="button" className={'tbtn auto' + (autoDrive.on ? ' on' : '')} aria-pressed={autoDrive.on} title="Auto-drive the route. Steer or brake to take over."
              onClick={(e) => {
                const g = game.current; if (!g) return;
                g.setAutoDrive(!g.autoDriving); setAutoDrive({ offer: g.autoDriveOffered, on: g.autoDriving });
                if (e.detail > 0) e.currentTarget.blur();   // a tap or click: Space (the handbrake) mustn't press it again
              }}>
              <Ico name="auto" /><span className="tlabel">Auto-drive</span><b className="tcap" aria-hidden="true">Auto</b>
            </button>
          )}
          <button type="button" className={'tbtn radio' + (radioOpen ? ' on' : '')} title="Radio" aria-expanded={radioOpen} onClick={() => setRadioOpen((o) => !o)}><Ico name="radio" /><span className="tlabel">Radio</span></button>
          {/* Pause never tucks away. Its name stays "Pause". Tap to pause; hold for the radial quick menu (U3). */}
          <button type="button" className="tbtn menu" aria-haspopup="menu" title="Tap to pause; hold for the quick menu"
            onPointerDown={() => { held.current = false; clearTimeout(holdT.current); holdT.current = window.setTimeout(() => { held.current = true; setRadial({ x: innerWidth / 2, y: innerHeight / 2 }); }, 300); }}
            onPointerUp={() => clearTimeout(holdT.current)} onPointerLeave={() => { if (!held.current) clearTimeout(holdT.current); }}
            onClick={() => { if (!held.current) game.current?.setPaused(true); held.current = false; }}>
            <Ico name="pause" /><span className="tlabel">Pause</span>
          </button>
          </div>
        </div>
      )}
      {playing && radial && (
        <RadialMenu at={radial} auto={autoDrive.offer ? autoDrive.on : null} onCancel={() => setRadial(null)} onPick={(p: RadialPick) => {
          setRadial(null); const g = game.current; if (!g) return;
          if (p === 'auto') { g.setAutoDrive(!g.autoDriving); setAutoDrive({ offer: g.autoDriveOffered, on: g.autoDriving }); return; }
          if (p === 'camera') { g.cycleCam(); return; }
          if (p === 'radio') { setRadioOpen(true); return; }
          if (p === 'nav') { setPanel('nav'); return; }
          g.setPaused(true); setPanel(p);
        }} />
      )}
      {playing && radioOpen && game.current && <RadioCard game={game.current} settings={settings} update={update} onClose={() => setRadioOpen(false)} />}
      {(settings.showPerf || PERF_URL) && screen !== 'foot' && game.current && <PerfOverlay game={game.current} />}
      {bench && (
        <div className="bench-card" role="status" aria-live="polite">
          <b>Checking graphics on this device</b>
          <span>{bench.label ? `Trying ${bench.label}` : 'Starting'} · about 5 s</span>
          <i className="bench-bar" aria-hidden="true"><i style={{ width: `${Math.round(((bench.i + 0.5) / bench.n) * 100)}%` }} /></i>
          <button type="button" className="btn" onClick={skipBench}>Skip</button>
        </div>
      )}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}</div>
      {/* a venue's exit ramp: its prompt (tap to park there now); parked at the venue, Get out replaces the pedals */}
      {playing && venueUi.prompt && !venueUi.parked && (
        <button type="button" className="venue-prompt" onClick={() => game.current?.arriveVenue()} aria-label={`Park at ${venueUi.prompt}`}>
          <small>Park at</small><b>{venueUi.prompt}</b><i aria-hidden="true">›</i>
        </button>
      )}
      {playing && venueUi.parked && (
        <div className="venue-park" role="group" aria-label={`Parked at ${venueUi.parked}`}>
          <p className="venue-note">{venueUi.note}</p>
          <button type="button" className="btn primary getout" ref={getOutRef} onClick={() => void game.current?.getOut()}>Get out</button>
          <button type="button" className="btn driveon" onClick={() => void game.current?.drive()}>Drive on</button>
        </div>
      )}
      {playing && !venueUi.parked && (coarse || settings.showTouch) && game.current && (
        <Touch input={game.current.input} manual={settings.transmission === 'manual'} onShift={(d) => game.current?.pushAction(d > 0 ? 'shiftUp' : 'shiftDown')} />
      )}

      {error && <div className="overlay center"><div className="panel narrow"><Brand /><p>{error}</p></div></div>}
      {lost && <div className="overlay center"><div className="panel narrow"><h2>Graphics reset</h2><p>The browser dropped the 3D context for a moment. It's coming back on its own; press Resume when it does.</p><button className="btn primary" onClick={resume}>Resume</button></div></div>}

      {inMenu && (
        <div className="overlay menu themed" data-panel={panel ?? 'home'}>
          <header className="mp-bar">
            <Brand hero />
            <nav className="dock" aria-label="Main menu">
              <button type="button" className="mp-link" aria-current={panel === 'garage' ? 'page' : undefined} onClick={() => (panel === 'garage' ? setPanel(null) : setPanel('garage'))}>Garage</button>
              <button type="button" className="mp-link" aria-current={panel === 'board' ? 'page' : undefined} onClick={() => (panel === 'board' ? setPanel(null) : openBoard())}>Bests</button>
              <button type="button" className="mp-link" aria-current={panel === 'profile' ? 'page' : undefined} onClick={() => (panel === 'profile' ? setPanel(null) : setPanel('profile'))}>Profile</button>
              <i className="mp-sep" aria-hidden="true" />
              <button type="button" className="mp-ic" aria-label="Settings" aria-current={panel === 'settings' ? 'page' : undefined} onClick={() => (panel === 'settings' ? setPanel(null) : setPanel('settings'))}><Ico name="settings" /></button>
              <div className="mp-more-wrap">
                <button type="button" className="mp-ic" aria-label="More" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                </button>
                {moreOpen && <div className="mp-more" aria-label="More">{moreItems.map((m) => <div key={m.key}>{m.node}</div>)}</div>}
              </div>
            </nav>
          </header>
          <div className={'sheet ' + (pv ? 'sub' : 'home')}>
            <div className="sheet-main" ref={sheetMain}>
              <div className="sheet-scroll" ref={sheetScroll}>
                <div className={'sheet-body' + (entering ? ' enter' : '')} key={view} ref={sheetBody} tabIndex={-1}
                  onAnimationEnd={(e) => { if (e.target === e.currentTarget) setEntering(false); }}>
                  {pv ? <>
                    {panel !== 'settings' && <button type="button" className="back" onClick={() => setPanel(null)}><Chevron left />Menu</button>}
                    <div className={'panel in-sheet ' + pv.cls}>{pv.body}</div>
                  </> : home}
                </div>
              </div>
              <div className="sheet-ghost" ref={ghost} aria-hidden="true" />
            </div>
          </div>
          <nav className="mp-tabs" aria-label="Tabs">
            <button type="button" aria-current={!panel ? 'page' : undefined} onClick={() => setPanel(null)}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h14l-3 4.5 3 4.5H5" /></svg>Race</button>
            <button type="button" aria-current={panel === 'garage' ? 'page' : undefined} onClick={() => setPanel('garage')}><Ico name="garage" />Garage</button>
            <button type="button" aria-current={panel === 'board' ? 'page' : undefined} onClick={() => openBoard()}><Ico name="career" />Bests</button>
          </nav>
        </div>
      )}

      {screen === 'paused' && !panel && (() => {
        // the pause screen (owner, 2026-11-16: "this looks too cluttered, lets fix this and get rid of any unnecessary
        // toggles"): Resume as the one big action; the four things done mid-drive as icon tiles (the World Map, whose
        // own "Go to a freeway" opens the Go to card; the radio; the phone; the store); then a slim row of Settings,
        // Restart and one way out: End drive in Free Drive (its results' Main menu goes on to the menu), Main menu in
        // Speed Survival. Feedback moved to Settings, next to Done (and stays on the phone).
        const n = game.current ? unread(game.current.profile.p, levelOf(game.current.profile.p.xp)) : 0;
        return (
          <div className="overlay center">
            <div className="panel narrow paused" role="dialog" aria-labelledby="pause-title">
              <OcWatermark />
              <div className="panel-head"><OcLockup size="md" /><p className="eyebrow">{MODES[mode].label}</p></div>
              <h2 id="pause-title">Paused</h2>
              {/* what left the driving HUD: the time the sky shows, the temperature and where it comes from, the handling
                  chips, the run's numbers */}
              <div className="pause-info">
                {lastHud.current && <p className="pause-clock">{`${lastHud.current.clock} · ${lastHud.current.tempF}° · ${lastHud.current.tempNote}`}</p>}
                <p className="pause-chips">{chips.join(' · ')}</p>
                {lastHud.current && <p className="pause-run">{runLine(lastHud.current)}</p>}
              </div>
              <button className="btn primary pause-resume" ref={resumeRef} onClick={resume}>Resume</button>
              <div className="pause-tiles" role="group" aria-label="While you drive">
                <button type="button" className="btn ptile" aria-label="World map" onClick={() => setPanel('map')}><Ico name="map" /><span>Map</span></button>
                <button type="button" className="btn ptile" onClick={() => { resume(); setRadioOpen(true); }}><Ico name="radio" /><span>Radio</span></button>
                <button type="button" className="btn ptile" aria-label={n > 0 ? `Phone, ${n} new` : 'Phone'} onClick={() => setPanel('phone')}><Ico name="phone" /><span>Phone</span>{n > 0 && <small className="ptile-new" aria-hidden="true">{n}</small>}</button>
                <button type="button" className="btn ptile" onClick={() => setPanel('store')}><Ico name="store" /><span>Store</span></button>
              </div>
              <div className="pause-more" role="group" aria-label="More">
                <button type="button" className="btn slim" onClick={() => setPanel('settings')}>Settings</button>
                <button type="button" className="btn slim" onClick={() => drive(mode)}>Restart</button>
                {mode === 'free'
                  ? <button type="button" className="btn slim" onClick={() => game.current?.endFreeDrive?.()}>End drive</button>
                  : <button type="button" className="btn slim" onClick={toMenu}>Main menu</button>}
              </div>
            </div>
          </div>
        );
      })()}

      {screen === 'over' && result && (
        <div className="overlay center">
          <div className="panel narrow result">
            <div className="panel-head"><OcLockup size="md" /><p className="eyebrow">{MODES[result.mode].label}</p></div>
            <h2>{result.reason}</h2>
            <div className="big">{result.score.toLocaleString()}<small>points</small></div>
            {result.newBest ? <p className="good">New personal best</p> : <p className="muted">Best {result.best.toLocaleString()}</p>}
            <dl className="stats">
              <div><dt>Distance</dt><dd>{(result.distance / 1609.344).toFixed(2)} mi</dd></div>
              <div><dt>Top speed</dt><dd>{Math.round(result.top * 2.236936)} mph</dd></div>
              {result.mode === 'survival' && <>
                <div><dt>Longest streak over 100</dt><dd>{result.bestStreak.toFixed(1)} s</dd></div>
                <div><dt>Near misses</dt><dd>{result.nearMisses}</dd></div>
                <div><dt>Clean passes</dt><dd>{result.overtakes}</dd></div>
                <div><dt>Collisions</dt><dd>{result.collisions}</dd></div>
              </>}
            </dl>
            {result.bests && <BestsCard rb={result.bests} car={result.car} onShare={(line) => void copyText(line, null).then((ok) => toast(ok ? 'Copied. Paste it to share' : 'Could not copy', ok ? 'good' : 'info'))} />}
            {result.jobs && result.jobs.length > 0 && (
              <ul className="jobs-done" aria-label="Jobs done">
                {result.jobs.map((j) => <li key={j.from + j.job}><b>Job done for {j.from}</b><span>{j.job} · +{j.credits.toLocaleString()} credits</span></li>)}
              </ul>
            )}
            <Board runs={result.board.runs} mode={result.mode} highlight={result.board.rank} />
            <div className="row">
              <button className="btn primary" onClick={() => drive(result.mode)}>Drive again</button>
              <button className="btn" onClick={() => void shareRunCard(result, game.current?.profile.p.username ?? 'Driver').then((r) => toast({ shared: 'Shared', saved: 'Run card saved', declined: 'Not saved', failed: 'Could not save the card' }[r], r === 'failed' ? 'bad' : r === 'declined' ? 'info' : 'good'))}>Share run</button>
              <button className="btn" onClick={toMenu}>Main menu</button>
            </div>
          </div>
        </div>
      )}

      {/* away from the main menu (pause, results) a panel is a card of its own over the paused drive */}
      {!inMenu && pv && <div className="overlay center themed"><div className={'panel ' + pv.cls}>{pv.body}</div></div>}
      {panel === 'store' && game.current && <Store game={game.current} onClose={() => setPanel(null)} />}
      {/* the World Map fills the screen over the menu or the paused drive (WorldMap.tsx) */}
      {/* the in-game phone (U6), from the pause screen: a screen of its own over the paused drive (Phone.tsx) */}
      {panel === 'phone' && game.current && (
        <Phone clock={() => lastHud.current?.clock ?? ''} name={game.current.profile.p.username || 'Driver'} credits={game.current.profile.p.credits} level={levelOf(game.current.profile.p.xp)} book={game.current.profile} onClose={() => setPanel(null)}
          onJob={(j) => {
            // a story job: back to the menu with its mode (and freeway) chosen, ready to Drive
            if (j.kind === 'drive' || j.kind === 'errand') update({ start: j.road, exit: '' });
            game.current?.setErrand(j.kind === 'errand' ? j : null);   // an errand rides on the next Free Drive
            setMode(j.kind === 'survival' ? 'survival' : 'free');
            toMenu();
          }}
          onOpen={(a: PhoneApp) => {
            if (a === 'radio') { resume(); setRadioOpen(true); return; }
            if (a === 'feedback') { openFeedback(); return; }
            if (a === 'board') setBoardMode(mode === 'free' ? 'survival' : mode);
            setPanel(a);
          }} />
      )}
      {panel === 'map' && game.current && (
        <WorldMap game={game.current} driving={screen !== 'menu'} navTarget={navTarget} focusHome={mapHome} onClose={() => { setMapHome(undefined); setPanel(null); }}
          onNavigate={(l) => navigate(l)}
          onGoTo={() => { setMapHome(undefined); setNavFrom('map'); setPanel('nav'); }}
          onStartFreeway={(l) => { update({ start: l, exit: '' }); setPanel(null); }}
          onStartExit={(k) => { update({ exit: k }); setMapHome(undefined); setPanel(null); }} />
      )}

      {panel === 'homes' && game.current && (
        <Homes game={game.current} onClose={() => setPanel(null)}
          onStart={(k) => { update({ exit: k }); setPanel(null); }}
          onMap={(h) => { setMapHome(h.id); setPanel('map'); }} />
      )}

      {/* last, so it lies over the menu while it fades into it; it lets taps through as it goes */}
      {(loadingOn || loadShown) && !error && (
        <div className={'overlay center loading-screen' + (loadingOn ? '' : ' leaving')} aria-hidden={loadingOn ? undefined : true}>
          <OcWatermark /><div className="loading"><Brand /><p>{loadingText}…</p><div className="loadbar"><i /></div></div>
        </div>
      )}
    </div>
  );
}

// which panels the sheet shows in its column (the rest are screens of their own over it: the store, the World Map,
// the phone, Lifestyle's homes)
function inSheet(p: Panel) { return p !== null && p !== 'store' && p !== 'map' && p !== 'phone' && p !== 'homes'; }

// The sheet's cross-fade: a copy of the outgoing content is laid over the sheet exactly where it stood, inert and
// hidden from assistive tech, and fades out while React mounts the new content (which fades in, styles.css). Returns
// false when there is no sheet on screen (a panel over the pause screen) or motion is reduced: then it's a plain cut.
function crossFade(main: HTMLElement | null, body: HTMLElement | null, layer: HTMLElement | null, timer: { current: number }) {
  if (!main || !body || !layer || reducedMotion()) return false;
  const m = main.getBoundingClientRect(), b = body.getBoundingClientRect();
  const old = body.cloneNode(true) as HTMLElement;
  old.className = 'sheet-body';
  old.removeAttribute('tabindex');
  for (const el of old.querySelectorAll('[id]')) el.removeAttribute('id');
  Object.assign(old.style, { position: 'absolute', left: `${b.left - m.left}px`, top: `${b.top - m.top}px`, width: `${b.width}px` });
  layer.setAttribute('inert', '');
  layer.replaceChildren(old);
  clearTimeout(timer.current);
  timer.current = window.setTimeout(() => layer.replaceChildren(), GHOST_MS);
  return true;
}

// The Minimal HUD's clock (U1): while `active`, returns true once IDLE_MS pass without a tap, a mouse or pen move, a key
// or a pad button, and false again on the next one. Driving doesn't count (the pedals, the steering rail, the driving
// keys, the pad's triggers), or a driver would never see the road clear. A keyboard user on a control of the bar keeps
// it up, and any wake re-arms the clock.
function useIdle(active: boolean, padAt: () => number) {
  const [idle, setIdle] = useState(false);
  const padRef = useRef(padAt);
  padRef.current = padAt;
  useEffect(() => {
    setIdle(false);
    if (!active) return;
    let timer = 0, pad = padRef.current();
    const sleep = () => {
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.closest('.tbar, .corner, .hud-ability') && a.matches(':focus-visible')) { arm(); return; }
      setIdle(true);
    };
    const arm = () => { clearTimeout(timer); timer = window.setTimeout(sleep, IDLE_MS); };
    const wake = () => { setIdle(false); arm(); };
    const onMove = (e: PointerEvent) => { if (e.pointerType !== 'touch') wake(); };
    const onDown = (e: PointerEvent) => { if (!(e.target instanceof Element && e.target.closest('.touch'))) wake(); };
    const onKey = (e: KeyboardEvent) => { if (!DRIVING_KEYS.has(e.code)) wake(); };
    const poll = window.setInterval(() => { const t = padRef.current(); if (t !== pad) { pad = t; wake(); } }, 250);
    addEventListener('pointermove', onMove, true);
    addEventListener('pointerdown', onDown, true);
    addEventListener('keydown', onKey, true);
    arm();
    return () => {
      clearTimeout(timer); clearInterval(poll);
      removeEventListener('pointermove', onMove, true);
      removeEventListener('pointerdown', onDown, true);
      removeEventListener('keydown', onKey, true);
    };
  }, [active]);
  return active && idle;
}

// the next (or previous) visible HUD control after the focused one: the icons, the map, the ability
function focusHudControl(step: 1 | -1) {
  const els = [...document.querySelectorAll<HTMLElement>('.tbar .tbtn, .corner, .hud-ability')].filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden');
  if (!els.length) return;
  const i = els.indexOf(document.activeElement as HTMLElement);
  els[(i < 0 ? (step > 0 ? 0 : els.length - 1) : (i + step + els.length) % els.length)].focus({ focusVisible: true } as FocusOptions);
}

// the HUD's layout for this window: a phone upright or on its side, or a desktop (a narrow window with a mouse takes the
// upright phone's); it follows a resize or a turn of the phone
function hudLayout(): HudLayout {
  if (typeof matchMedia !== 'function') return 'desk';
  const w = innerWidth, h = innerHeight;
  if (matchMedia('(pointer: coarse)').matches) return w < h ? 'pp' : 'pl';
  return w <= 560 ? 'pp' : 'desk';
}
function useHudLayout(): HudLayout {
  const [l, setL] = useState<HudLayout>(hudLayout);
  useEffect(() => {
    // iOS fires orientationchange (and sometimes resize) before the new size is laid out: look again a frame and a
    // moment later, and on the visual viewport's own resize
    let t = 0, later: ReturnType<typeof setTimeout> | undefined;
    const f = () => {
      setL(hudLayout());
      cancelAnimationFrame(t); t = requestAnimationFrame(() => setL(hudLayout()));
      clearTimeout(later); later = setTimeout(() => setL(hudLayout()), 350);   // one pending look, not one per event
    };
    const vv = typeof visualViewport === 'object' ? visualViewport : null;
    addEventListener('resize', f); addEventListener('orientationchange', f); vv?.addEventListener('resize', f);
    return () => { removeEventListener('resize', f); removeEventListener('orientationchange', f); vv?.removeEventListener('resize', f); cancelAnimationFrame(t); clearTimeout(later); };
  }, []);
  return l;
}

// The part of the page the player can see. A host can show the game in a frame bigger than the window around it: in
// the claude.ai artifact viewer the owner's HUD ran off all four edges (2026-11-09: the directions card cut at the top
// and left, the rail, the sky camera and the speed cut at the right, THRUST and the chips at the bottom), at window sizes
// where the page itself fits them. env(safe-area-inset-*) knows nothing of a host's frame. An IntersectionObserver on
// the full-page .app does: with no root it reports the part of .app inside the top-level window and every frame and
// clip between, in this page's coordinates. What is cut off becomes --vis-* insets, which the HUD's safe areas take
// (styles.css --sa-*). Capped at 30% a side, and only read while most of the page is in view (a frame scrolled away
// or a hidden tab says nothing about the frame's crop). It looks again on a resize and every 2 s, since a crop that
// changes inside one threshold step reports nothing.
type Insets = { t: number; r: number; b: number; l: number };
function useVisibleInsets(el: React.RefObject<HTMLElement>): Insets {
  const [ins, setIns] = useState<Insets>({ t: 0, r: 0, b: 0, l: 0 });
  useEffect(() => {
    const node = el.current;
    if (!node || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      if (!e.isIntersecting || e.intersectionRatio < 0.4) return;
      const b = e.boundingClientRect, v = e.intersectionRect;
      const cut = (x: number, size: number) => { const c = Math.min(Math.max(0, x), size * 0.3); return c < 1 ? 0 : Math.ceil(c); };
      const n = { t: cut(v.top - b.top, b.height), r: cut(b.right - v.right, b.width), b: cut(b.bottom - v.bottom, b.height), l: cut(v.left - b.left, b.width) };
      setIns((o) => (o.t === n.t && o.r === n.r && o.b === n.b && o.l === n.l ? o : n));
    }, { threshold: Array.from({ length: 101 }, (_, i) => i / 100) });
    io.observe(node);
    const again = () => { io.unobserve(node); io.observe(node); };
    addEventListener('resize', again);
    const iv = setInterval(again, 2000);
    return () => { io.disconnect(); removeEventListener('resize', again); clearInterval(iv); };
  }, [el]);
  return ins;
}

// the run's numbers for the pause screen (the phone's plate shows two of them; here they all are)
function runLine(h: HudData): string {
  const mi = (m: number) => (m / 1609.344).toFixed(2) + ' mi';
  if (h.mode === 'survival') return `${h.score.toLocaleString()} points · ${h.streak.toFixed(1)} s over 100 · ${h.nearMisses} near misses`;
  return `${mi(h.distance)} · Top ${h.top} mph` + (h.errand ? ` · Errand ${Math.floor(Math.ceil(h.errand.left) / 60)}:${String(Math.ceil(h.errand.left) % 60).padStart(2, '0')} left` : '');
}

// a route shield: blue for Interstates, white spade for state routes, then the direction
function Shield({ label }: { label: string }) {
  const m = /^(I|CA)-(\d+)\s*(\w+)?/.exec(label);
  if (!m) return <b>{label}</b>;
  return <span className="shield-row"><span className={'shield ' + (m[1] === 'I' ? 'i' : 'ca')}>{m[2]}</span>{m[3] && <b>{m[3]}</b>}</span>;
}

// a list row's chevron (or the back button's), drawn as a hairline
function Chevron({ left = false }: { left?: boolean }) {
  return <i className="chev" aria-hidden="true"><svg viewBox="0 0 8 14" width="8" height="14"><path d={left ? 'M7 1L1 7l6 6' : 'M1 1l6 6-6 6'} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></i>;
}

function Board({ runs, mode, highlight }: { runs: { score: number; distance: number; top: number; streak: number; when: number; road: string; tune?: string }[]; mode: Mode; highlight: number }) {
  return (
    <div className="board">
      <p className="eyebrow">Local leaderboard · this device only</p>
      {runs.length === 0 ? <p className="muted">No runs yet.</p> : (
        <ol>{runs.slice(0, 5).map((r, i) => (
          <li key={r.when + ':' + i} className={i + 1 === highlight ? 'me' : ''}>
            <b>{r.score.toLocaleString()}</b>
            <span>{r.top} mph{mode === 'survival' ? ` · ${r.streak.toFixed(1)} s streak` : ''}{r.tune === 'Unleashed' ? <em className="board-tune" data-tune="unleashed"> · OC Hypercar Unleashed</em> : ''}</span>
            <time>{new Date(r.when).toLocaleDateString()}</time>
          </li>
        ))}</ol>
      )}
    </div>
  );
}

// a rim style as a small face-on drawing for the Wheels tab (the 3D wheel is on the car behind the panel)
function RimIcon({ style }: { style: string }) {
  const n = style === 'five' ? 5 : style === 'blade' ? 7 : style === 'cl10' ? 10 : style === 'mesh' ? 20 : 10;
  const spokes = style === 'aero' ? [] : Array.from({ length: n }, (_, k) => {
    const pair = style === 'twin5' || style === 'multi' || style === 'mesh', base = (pair ? Math.floor(k / 2) / (n / 2) : k / n) * Math.PI * 2, s = k % 2 ? 1 : -1;
    const a0 = base + (style === 'mesh' ? s * 0.15 : pair ? s * 0.05 : 0), a1 = base + (style === 'mesh' ? -s * 0.15 : style === 'blade' ? 0.6 : pair ? s * (style === 'multi' ? 0.17 : 0.14) : 0);
    const p = (a: number, r: number) => `${(20 + Math.sin(a) * r).toFixed(2)} ${(20 - Math.cos(a) * r).toFixed(2)}`;
    return style === 'blade' ? `M${p(a0, 6)} Q${p(base + 0.15, 11)} ${p(a1, 15.5)}` : `M${p(a0, 6)} L${p(a1, 15.5)}`;
  });
  const w = style === 'five' ? 2.6 : style === 'blade' ? 2.2 : style === 'mesh' ? 0.9 : 1.4;
  return (
    <svg className="rim-ico" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" className="tyre" /><circle cx="20" cy="20" r="16" className="lip" />
      {style === 'aero' && <><circle cx="20" cy="20" r="15" className="disc" />{[0, 1, 2, 3, 4].map((k) => { const a = k / 5 * Math.PI * 2 + 0.3; return <path key={k} className="slot" d={`M${20 + Math.sin(a) * 7} ${20 - Math.cos(a) * 7} Q${20 + Math.sin(a + 0.3) * 11} ${20 - Math.cos(a + 0.3) * 11} ${20 + Math.sin(a + 0.55) * 13.5} ${20 - Math.cos(a + 0.55) * 13.5}`} />; })}</>}
      {spokes.map((d, k) => <path key={k} d={d} className="spoke" strokeWidth={w} />)}
      <circle cx="20" cy="20" r={style === 'multi' ? 5 : 4} className="hub" />
    </svg>
  );
}

// the garage (what you own, pick one) and the showroom (what credits can buy, by level)
function GaragePanel({ game, settings, update, ui, onClose, onPick }: { game: Game; settings: Settings; update: (p: Partial<Settings>) => void; ui?: AppSlots; onClose: () => void; onPick: () => void }) {
  const [tab, setTab] = useState<'cars' | 'paint' | 'wheels' | 'upgrades' | 'custom'>('cars');
  const book = game.profile;
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');
  const p = book.p, level = levelOf(p.xp), slots = garageSlots(level, p.homes), owner = game.ownerMode;
  const act = (fn: () => string | null, ok: string) => { const e = fn(); setMsg(e ?? ok); game.applyCarChoice(); bump((n) => n + 1); onPick(); };
  return <>
    <h2>Garage{owner && <span className="chip">{TEST_BUILD ? 'Owner mode · test build' : 'Owner mode'}</span>}</h2>
    <p className="fine">{Math.floor(p.credits).toLocaleString()} credits · {book.slotsUsed} of {slots} slots (more open every 4 levels, and with each home). Credits come from driving; nothing here costs real money.</p>
    {owner && <p className="fine">Owner mode: every car is unlocked to drive (test builds only){TEST_BUILD ? ', and this test build turns it on' : ''}. Your saved garage doesn't change; turn it off in Settings.</p>}
    {msg && <p className="good" role="status">{msg}</p>}
    <Seg label="Garage" value={tab} options={['cars', 'paint', 'wheels', 'upgrades', 'custom']} labels={(t) => ({ cars: 'Vehicles', paint: 'Paint', wheels: 'Wheels', upgrades: 'Upgrades', custom: 'Customize' })[t]} onChange={setTab} />
    {tab === 'paint' && (() => {
      // the car you drive: its six paints, applied live to the car behind the panel and kept for that car
      const car = carById(game.carId), now = paintFor(car, settings.paints), list = PAINTS[car.id] ?? [];
      return (
        <div className="paints">
          <p className="fine">{car.name}: {list.find((x) => x.hex === now)?.name ?? 'its own paint'}. The car behind this panel takes it now.</p>
          {/* a store paint you put on wins over the garage's (Game.configureCar): say so, or a pick here would seem to do nothing */}
          {(() => { const st = equippedPaint(car.id); return st ? <p className="fine">The store's {st.name} is on this car and shows instead; take it off in the Store to wear the one picked here.</p> : null; })()}
          <div className="paint-grid" role="radiogroup" aria-label={`Paint for the ${car.name}`}>
            {list.map((x) => (
              <button key={x.hex} type="button" role="radio" aria-checked={x.hex === now} className={'paint-chip' + (x.hex === now ? ' on' : '')}
                onClick={() => { update({ paints: { ...settings.paints, [car.id]: x.hex } }); onPick(); }}>
                <span className="sw" style={{ background: '#' + x.hex.toString(16).padStart(6, '0') }} /><b>{x.name}</b>
              </button>
            ))}
          </div>
        </div>
      );
    })()}
    {tab === 'wheels' && (() => {
      // the car you drive: its own rims and a second style, fitted live to the car behind the panel and kept for that car
      const car = carById(game.carId), now = wheelFor(car, settings.wheels), list = WHEELS[car.id] ?? [];
      return (
        <div className="paints">
          <p className="fine">{car.name}: {list.find((x) => x.style === now)?.name ?? 'its own rims'}. The car behind this panel wears them now.</p>
          <div className="paint-grid wheel-grid" role="radiogroup" aria-label={`Wheels for the ${car.name}`}>
            {list.map((x, i) => (
              <button key={x.style} type="button" role="radio" aria-checked={x.style === now} className={'paint-chip wheel-chip' + (x.style === now ? ' on' : '')}
                onClick={() => { update({ wheels: { ...settings.wheels, [car.id]: x.style } }); onPick(); }}>
                <RimIcon style={x.style} /><b>{x.name}</b><small>{i === 0 ? 'Factory · ' : ''}{x.note}</small>
              </button>
            ))}
          </div>
        </div>
      );
    })()}
    {tab === 'upgrades' && <p className="fine soon-note">Upgrades (engine, tyres, aero) bought with credits are coming later. Nothing here costs real money.</p>}
    {tab === 'custom' && <p className="fine soon-note">Customize (calipers, tint, liveries in our own designs) is coming later. Nothing here costs real money.</p>}
    {/* named for its car: the menu's Drive dock stays on screen beside the garage, and is the only plain "Drive" */}
    {tab === 'cars' && <div className="drivers">
      {garageCars(owner, p.vehicles).map((c) => {
        const f = figures(c), owned = p.vehicles.includes(c.id), driving = game.carId === c.id, locked = level < c.level;
        // chosen: the Founder Edition's lights wake, on its stage and on the car (Game.applyCarChoice)
        const chosen = () => { if (c.founder) game.playReveal('wake'); };
        return (
          <div key={c.id} className={'gcell driver car' + (driving ? ' on' : '') + (c.founder ? ' founder' : '')}>
            {c.founder && <FounderStage game={game} />}
            <div className="carhead"><span className="paint" title={c.founder ? GLACIER_SILVER.name : undefined} style={{ background: '#' + paintFor(c, settings.paints).toString(16).padStart(6, '0') }} /><b>{c.name}</b>{c.founder && <span className="chip ice">Founder Edition</span>}</div>
            <small>{f.hp} hp · {f.zeroSixty} s 0-60 · {f.topMph} mph · {c.mass.toLocaleString()} kg</small>
            <span>{c.blurb}</span>
            {/* a slot for the economy lane: "Unlocks at 150 mi · 87/150" bars (src/ui/progress*.tsx) */}
            <div className="car-slot" data-slot="unlock" data-car={c.id}>{ui?.carUnlock?.(c.id) ?? null}</div>
            {c.founder && <ul className="fe-list">
              <li><b>{GLACIER_SILVER.name}</b> paint and <b>{FOUNDER_ICE.name}</b> lights, on this car only</li>
              <li>A numbered plaque on the door sill and the console: <b>{plaqueNumber()}</b> until the store assigns real numbers</li>
              <li>Its lights wake in a sweep when you choose it and on the start line</li>
              <li>{founderWindowText()} (Pacific)</li>
            </ul>}
            <div className="row">
              {owner ? (driving ? <em>Driving it</em> : <button className="btn" aria-label={`Drive the ${c.name}`} onClick={() => { act(() => { game.chooseOwnerCar(c.id); return null; }, `${c.name} selected (owner mode)`); chosen(); }}>Drive</button>)
                : owned ? (driving ? <em>Driving it</em> : <button className="btn" aria-label={`Drive the ${c.name}`} onClick={() => { act(() => { book.choose(c.id); return null; }, `${c.name} selected`); chosen(); }}>Drive</button>)
                : c.founder ? <em>Founder Edition · not on sale yet (test build)</em>
                : locked ? <em>Opens at level {c.level}</em>
                : <button className="btn primary" onClick={() => act(() => book.buy(c.id, c.price, c.level, slots), `${c.name} is yours`)}>Buy · {c.price.toLocaleString()}</button>}
              {!owner && owned && c.id !== 'rossini-gt' && !c.founder && <button className="btn" onClick={() => act(() => book.sell(c.id, c.price), `Sold for ${Math.round(c.price * 0.6).toLocaleString()} credits`)}>Sell</button>}
            </div>
          </div>
        );
      })}
    </div>}
    <p className="fine">The makes are our own. Each has its own body and interior, and its own numbers underneath.</p>
    <div className="row"><button className="btn primary" onClick={onClose}>Done</button></div>
  </>;
}

// the OC Hypercar's reveal stage, at the top of its garage card (Game.openReveal: the car on a turntable in a dark
// showroom while its lights wake and a light sweeps over it). It plays by itself the first time on this device, then
// shows its last frame with a button to play it again; with reduced motion it shows the last frame and nothing moves.
const REVEAL_SEEN = 'tsu.founderReveal';
function FounderStage({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(16, Math.round(cv.clientWidth * dpr)); cv.height = Math.max(9, Math.round(cv.clientHeight * dpr));
    let seen = false;
    try { seen = localStorage.getItem(REVEAL_SEEN) === '1'; } catch { /* a convenience */ }
    // a moment for the panel to paint first: building the stage takes a beat
    const id = window.setTimeout(() => {
      game.openReveal(cv, !seen);
      if (!seen) try { localStorage.setItem(REVEAL_SEEN, '1'); } catch { /* a convenience */ }
    }, 60);
    return () => { window.clearTimeout(id); game.closeReveal(); };
  }, [game]);
  return (
    <div className="fe-stage">
      <canvas ref={ref} role="img" aria-label="The OC Hypercar Founder Edition on its reveal stage, turning on a turntable while its lights wake. A procedural model built in code." />
      <p className="fe-cap" aria-hidden="true"><b>Founder Edition</b><span>{plaqueNumber()}</span></p>
      <button className="btn fe-replay" onClick={() => game.playReveal('reveal')}>Replay reveal</button>
    </div>
  );
}

// your profile: who you are, how far you've come, what you've driven
function ProfilePanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const book = game.profile;
  const [, bump] = useState(0);
  const p = book.p, level = levelOf(p.xp), lo = xpFor(level), hi = xpFor(level + 1);
  const routes = new Set(p.freeways.map((f) => f.replace(/\s+(North|South|East|West)$/, '')));
  const av = AVATARS[p.avatar];
  const hours = p.timeDriven / 3600;
  return <>
    <div className="who">
      <span className="avatar" style={{ background: av.bg, color: av.fg }} aria-hidden="true">{(p.username || 'D').slice(0, 1).toUpperCase()}</span>
      <div className="who-main">
        <label className="sr" htmlFor="pname">Name</label>
        <input id="pname" className="name" maxLength={20} defaultValue={p.username} onBlur={(e) => { book.rename(e.target.value); bump((n) => n + 1); }} />
        <p>Level {level} · {Math.floor(p.credits).toLocaleString()} credits</p>
      </div>
    </div>
    <div className="xp" role="progressbar" aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={Math.floor(p.xp)} aria-label={`Level ${level} progress`}>
      <i style={{ width: `${Math.min(100, ((p.xp - lo) / Math.max(1, hi - lo)) * 100).toFixed(1)}%` }} />
    </div>
    <p className="fine">{Math.floor(p.xp).toLocaleString()} XP · {Math.max(0, Math.ceil(hi - p.xp)).toLocaleString()} to level {level + 1}. Credits are earned by driving and only spent in the game.</p>
    <div className="swatches" role="group" aria-label="Avatar colour">
      {AVATARS.map((a, i) => <button key={i} aria-pressed={i === p.avatar} style={{ background: a.bg }} onClick={() => { book.setAvatar(i); bump((n) => n + 1); }} aria-label={`Colour ${i + 1}`} />)}
    </div>
    <dl className="stats">
      <div><dt>Time driven</dt><dd>{hours >= 1 ? hours.toFixed(1) + ' h' : Math.round(p.timeDriven / 60) + ' min'}</dd></div>
      <div><dt>Distance</dt><dd>{(p.distance / 1609.344).toFixed(1)} mi</dd></div>
      <div><dt>Top speed</dt><dd>{Math.round(p.topSpeed * 2.236936)} mph</dd></div>
      <div><dt>Best streak</dt><dd>{p.bestStreak.toFixed(1)} s</dd></div>
      <div><dt>Near misses</dt><dd>{p.nearMisses}</dd></div>
      <div><dt>Clean passes</dt><dd>{p.cleanPasses}</dd></div>
      <div><dt>Interchanges</dt><dd>{p.interchanges}</dd></div>
      <div><dt>Runs</dt><dd>{p.runs}</dd></div>
      <div><dt>Cars</dt><dd>{p.vehicles.length}</dd></div>
    </dl>
    <p className="eyebrow">Freeways driven · {routes.size} of 10</p>
    <div className="routes">{ROUTES_ALL.map((r) => <span key={r} className={routes.has(r) ? 'on' : ''}><Shield label={r} /></span>)}</div>
    <p className="eyebrow">Achievements · {p.achievements.length} of {ACHIEVEMENTS.length}</p>
    <ul className="ach">{ACHIEVEMENTS.map((a) => <li key={a.id} className={p.achievements.includes(a.id) ? 'got' : ''}><b>{a.name}</b><span>{a.how}</span></li>)}</ul>
    <p className="fine">Saved on this device only (profile v{PROFILE_VERSION}).</p>
    <div className="row"><button className="btn primary" onClick={onClose}>Done</button></div>
  </>;
}

// the game's name as the page heading: the OC sunset wordmark, ULTRA beside it, TOP SPEED under (Mark.tsx); on the
// menu (hero) the chrome gets its sunset sheen. A screen reader hears "OC Ultra Top Speed".
function Brand({ hero = false }: { hero?: boolean }) {
  return <div className={'brand' + (hero ? ' hero' : '')}><OcLockup heading /></div>;
}
