// Menus, settings, pause and results around the game, plus the HUD, the corner map and the touch controls.
// Phone first: big targets, one column, no keyboard needed anywhere.
//
// The main menu is one persistent glass sheet (owner, 2026-10-16: "more seamless, a finer luxury feel"): the sheet,
// the wordmark and the Drive dock stay put, and only what the sheet shows changes, the old content fading out where it
// stood while the new fades in. Opened from the pause screen, the same panels show as a card over the paused drive.

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties, ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Game, Result, CORNER_PX } from '../game/Game';
import { shareRunCard } from './runCard';
import { formatReport, copyText } from './feedback';
import { Settings, loadSettings, saveSettings, QUALITY, DENSITY, MODES, STARTS, Mode, Quality, Density, TimeOfDay, Weather, HudStyle, loadBest } from '../game/settings';
import { board } from '../game/records';
import { AVATARS, ACHIEVEMENTS, ROUTES_ALL, levelOf, xpFor, PROFILE_VERSION } from '../game/profile';
import { DRIVERS, ABILITIES, SKINS } from '../game/drivers';
import { COURSES, bestTime, fmtTime } from '../game/race';
import { CARS, carById, figures, slotsFor } from '../game/cars';
import { HUD, HudHandle } from './HUD';
import { Touch } from './Touch';
import { OcLockup, OcWatermark } from './Mark';
import { AccountPanel, LiveChip } from './Live';
import { LiveClient, LiveInfo, liveBase, loadToken, loadName, liveApi } from '../live/client';

type Screen = 'loading' | 'menu' | 'playing' | 'paused' | 'over';
type Panel = null | 'settings' | 'start' | 'nav' | 'board' | 'profile' | 'driver' | 'course' | 'garage' | 'feedback' | 'account';
const LIVE_OFF: LiveInfo = { status: 'off', online: 0, cap: 0, position: 0, error: '' };

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROUTES = ['I-5', 'I-405', 'CA-55', 'CA-57', 'CA-22', 'CA-91', 'CA-73', 'CA-133', 'CA-241', 'CA-261'];
const MODE_LIST = Object.keys(MODES) as Mode[];
const LEAVE_MS = 380;      // the loading screen's fade into the menu (styles.css: .loading-screen.leaving)
const GHOST_MS = 260;      // how long the outgoing content of the sheet lingers while it fades (styles.css: sheet-out)
const IDLE_MS = 4000;      // the Minimal HUD tucks the top bar and the corner window away after this long without input
// keys that only drive (throttle, brake, steering, handbrake, look back, shifts): pressing them isn't asking for the HUD
const DRIVING_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyV', 'KeyQ', 'KeyE']);

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const hud = useRef<HudHandle>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [panel, setPanelState] = useState<Panel>(null);
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
  const [navTarget, setNavTarget] = useState<string | null>(null);
  const [exitRoad, setExitRoadState] = useState<string | null>(null);    // the Start panel: which carriageway's exits are listed
  const [report, setReport] = useState('');                           // the Feedback panel's text
  const [entering, setEntering] = useState(false);                    // the sheet's new content is fading in
  const [loadShown, setLoadShown] = useState(true);                   // the loading screen, kept up while it fades out
  // the live server: the client while a live drive is on, what it reports, and who is signed in on this device
  const live = useRef<LiveClient | null>(null);
  const [liveInfo, setLiveInfo] = useState<LiveInfo>(LIVE_OFF);
  const [liveName, setLiveName] = useState(loadName);
  const [liveToken, setLiveToken] = useState(loadToken);
  const liveStatus = useRef('off');
  const reportRef = useRef<HTMLTextAreaElement>(null);
  const toastId = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // the sheet: its scroll area, the content in it, and the layer the outgoing content fades out on
  const sheetMain = useRef<HTMLDivElement>(null), sheetScroll = useRef<HTMLDivElement>(null), sheetBody = useRef<HTMLDivElement>(null), ghost = useRef<HTMLDivElement>(null);
  const ghostTimer = useRef(0), switched = useRef(false);
  const panelNow = useRef<Panel>(null), roadNow = useRef<string | null>(null);
  panelNow.current = panel; roadNow.current = exitRoad;
  // every change of what the sheet shows goes through here, so it cross-fades (outside the menu there is no sheet and
  // this is a plain state change)
  const fade = useCallback(() => {
    switched.current = true;
    if (crossFade(sheetMain.current, sheetBody.current, ghost.current, ghostTimer)) setEntering(true);
  }, []);
  const setPanel = useCallback((p: Panel) => { if (p !== panelNow.current) { fade(); panelNow.current = p; } setPanelState(p); }, [fade]);
  const setExitRoad = useCallback((r: string | null) => { if (r !== roadNow.current) { fade(); roadNow.current = r; } setExitRoadState(r); }, [fade]);

  const toast = useCallback((text: string, kind = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    // long enough to read: 1.8 s for a short one, about a fifth of a second more per word past five, 6 s at most
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), Math.min(6000, 1800 + Math.max(0, text.length - 30) * 45));
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
        hud: (h) => hud.current?.set(h),
        toast: (text, kind) => toast(text, kind),
        over: (r) => { setResult(r); setScreen('over'); },
        pause: (on) => setScreen((s) => (on ? (s === 'playing' ? 'paused' : s) : s === 'paused' ? 'playing' : s)),
        loading: (on, text) => { if (text) setLoadingText(text); setBusy(on); },
        context: (l) => setLost(l),
        hudToggle: (on) => setHudOn(on),
        corner: (c) => update({ corner: c }),
      });
    } catch (e) {
      setError('This game needs WebGL 2, and this browser or device has it turned off. ' + String((e as Error).message || ''));
      return;
    }
    game.current = g;
    (window as unknown as { __game: Game }).__game = g;
    g.init().then(() => setScreen('menu'), (e) => setError(String(e)));
    return () => { live.current?.close(); live.current = null; g.dispose(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { game.current?.setMapCanvas(mapRef.current); });

  const loadingOn = (screen === 'loading' || busy) && !error;
  // the loading screen fades into the menu (and into the drive): it stays up, fading, a moment after loading ends
  useEffect(() => {
    if (loadingOn) { setLoadShown(true); return; }
    const t = setTimeout(() => setLoadShown(false), reducedMotion() ? 0 : LEAVE_MS);
    return () => clearTimeout(t);
  }, [loadingOn]);

  const inMenu = screen === 'menu' && !busy && !error;
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

  // a live drive: connect when the drive starts (signed in, the setting on, a server address known), drop it back at
  // the menu. Status changes read out as toasts: in line, let in, disconnected.
  const startLive = () => {
    const s = settingsRef.current, g = game.current;
    if (!s.live || !g || live.current) return;
    const base = liveBase(s.liveUrl), token = loadToken();
    if (!token) { toast('Sign in to drive live', 'info'); return; }
    if (!base) { toast('Set the live server address', 'info'); return; }
    const c = new LiveClient();
    c.onInfo = (i) => {
      setLiveInfo(i);
      if (i.status !== liveStatus.current) {
        liveStatus.current = i.status;
        if (i.status === 'online') toast(`Live: ${i.online} of ${i.cap} driving`, 'good');
        else if (i.status === 'queued') toast(`Server full: you're #${i.position} in line`, 'info');
        else if (i.status === 'error') toast(i.error || 'Live server unavailable', 'bad');
      } else if (i.status === 'queued' && i.position !== liveInfoRef.current.position) toast(`In line: #${i.position}`, 'info');
      liveInfoRef.current = i;
    };
    live.current = c; g.setLive(c);
    const car = carById(g.profile.p.car);
    c.connect(base, token, car.id, car.paint, s.crew);
  };
  const liveInfoRef = useRef<LiveInfo>(LIVE_OFF);
  // a first visit from the live server's own page or an invite link: a one-time welcome that says what live is
  const [welcome, setWelcome] = useState(() => {
    try {
      if (loadName() || localStorage.getItem('tsu.live.welcomed')) return '';
      const crew = new URLSearchParams(location.search).get('crew');
      if (crew && /^[A-Za-z0-9]{4,8}$/.test(crew)) return crew.toUpperCase();
      return liveBase('') ? '-' : '';             // served by the live server itself (not a file, not the artifact)
    } catch { return ''; }
  });
  const closeWelcome = (signUp: boolean) => {
    try { localStorage.setItem('tsu.live.welcomed', '1'); } catch { /* a convenience */ }
    setWelcome('');
    if (signUp) setPanel('account');
  };
  // the crew field while it's being typed (the setting takes it once it's a whole code); an invite link's ?crew= wins
  const [crewDraft, setCrewDraft] = useState(settings.crew);
  useEffect(() => {
    try {
      const c = new URLSearchParams(location.search).get('crew');
      if (c && /^[A-Za-z0-9]{4,8}$/.test(c)) { const v = c.toUpperCase(); setCrewDraft(v); update({ crew: v }); toast(`Crew ${v}: sign in and drive live to join`, 'good'); }
    } catch { /* no query */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // on the menu, how many are driving live right now (the public health check, every 30 s)
  const [lobby, setLobby] = useState<{ online: number; cap: number; queued: number; cruise: { at: string; live: boolean } | null } | null>(null);
  const menuNow = screen === 'menu';
  useEffect(() => {
    const base = liveBase(settings.liveUrl);
    if (!menuNow || !base) { setLobby(null); return; }
    let stop = false;
    const look = () => void liveApi.health(base).then((r) => { if (!stop) setLobby(r.ok ? { online: Number(r.data.online), cap: Number(r.data.cap), queued: Number(r.data.queued), cruise: (r.data.cruise as { at: string; live: boolean } | null) ?? null } : null); });
    look();
    const t = setInterval(look, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [menuNow, settings.liveUrl]);
  // the live address to a friend: the phone's share sheet, or the clipboard
  const invite = async () => {
    const crew = settingsRef.current.crew;
    const url = liveBase(settingsRef.current.liveUrl) + '/' + (crew ? `?crew=${crew}` : '');
    const text = crew ? `Join my OC Ultra crew ${crew} on Orange County's freeways (live alpha): ${url}` : `Drive Orange County's freeways with me in OC Ultra (live alpha): ${url}`;
    if (typeof navigator.share === 'function') { try { await navigator.share({ title: 'OC Ultra', text, url }); return; } catch { /* cancelled, or not allowed: copy instead */ } }
    toast((await copyText(text, null)) ? 'Invite copied' : url, 'good');
  };
  const stopLive = () => { live.current?.close(); live.current = null; game.current?.setLive(null); liveStatus.current = 'off'; setLiveInfo(LIVE_OFF); };
  const drive = (m: Mode = mode) => {
    setMode(m); setPanel(null); setResult(null); setNavTarget(null);
    setScreen('playing');
    void game.current?.start(m, settings.start, settings.course);
    startLive();
  };
  const resume = () => { setPanel(null); game.current?.setPaused(false); setScreen('playing'); };
  const openFeedback = () => { if (game.current) setReport(formatReport(game.current.report())); setPanel('feedback'); };
  const toMenu = () => { setPanel(null); setResult(null); stopLive(); game.current?.quitToMenu(); setScreen('menu'); };
  const navigate = (label: string | null) => {
    if (game.current?.navigateTo(label)) setNavTarget(label);
    setPanel(null);
    if (screen === 'paused') resume();
  };
  const openBoard = () => { setBoardMode(mode === 'free' ? 'survival' : mode); setPanel('board'); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (welcome) { if (e.code === 'Escape') { closeWelcome(false); e.stopPropagation(); } if (e.code === 'Enter') return; }
      if (e.code === 'Escape' && panel) { setPanel(null); e.stopPropagation(); }
      // Enter drives from the menu, unless it is pressing a focused control (that control gets it)
      const t = e.target as HTMLElement | null;
      if (e.code === 'Enter' && screen === 'menu' && !panel && !(t && t.closest?.('button, a, input, textarea, select, [role="radio"]'))) drive();
    };
    addEventListener('keydown', k, true);
    return () => removeEventListener('keydown', k, true);
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
  const modeStat = (m: Mode) => m === 'survival' ? `Best ${loadBest(m).toLocaleString()}` : m === 'time' ? `Best ${(loadBest(m) / 1609.344).toFixed(2)} mi`
    : m === 'race' ? `${game.current?.profile.p.racesWon ?? 0} won` : 'No clock';

  const playing = screen === 'playing';
  // the adaptive HUD (U1): in Minimal, true once a drive has gone IDLE_MS without a tap, mouse move, key or pad button
  const idle = useIdle(playing && settings.hudStyle === 'minimal', () => game.current?.input.padAt ?? 0);
  const cornerPx = CORNER_PX[settings.cornerSize] ?? CORNER_PX[1];
  const start = STARTS.find((s) => s.label === settings.start) ?? STARTS[0];
  // "start at your exit": the key names the carriageway; the exit list gives its sign text
  const exitRoadOf = settings.exit.split(' @ ')[0];
  const myExit = settings.exit ? game.current?.exitsFor(exitRoadOf).find((e) => e.key === settings.exit) ?? null : null;
  const driver = DRIVERS.find((d) => d.id === settings.driver) ?? DRIVERS[0];
  const car = carById(game.current?.profile.p.car ?? 'rossini-gt');
  const course = COURSES.find((c) => c.id === settings.course) ?? COURSES[0];

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
          <p className="fine">Pick a freeway and direction. The yellow line on the map, the card at the top and the blue chevrons on the road show the way through each interchange.</p>
          <div className="grid nav">
            {ROUTES.flatMap((r) => (game.current?.mainsLabels ?? []).filter((l) => l.startsWith(r + ' ')).map((l) => (
              <button key={l} className={'gcell' + (navTarget === l ? ' on' : '')} onClick={() => navigate(l)}><Shield label={l} /></button>
            )))}
          </div>
          <div className="row">
            {navTarget && <button className="btn" onClick={() => navigate(null)}>Clear route</button>}
            <button className="btn" onClick={() => setPanel(null)}>Back</button>
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
      case 'garage': return game.current ? { cls: 'profile', body: <GaragePanel game={game.current} onClose={() => setPanel(null)} /> } : null;
      case 'account': return {
        cls: 'narrow', body: <AccountPanel settings={settings} update={update} name={liveName} token={liveToken} toast={toast}
          onLogin={(t, n) => { setLiveToken(t); setLiveName(n); if (!settingsRef.current.live) update({ live: true }); }} onLogout={() => { setLiveToken(''); setLiveName(''); update({ live: false }); }} onClose={() => setPanel(null)} />,
      };
      case 'course': return {
        cls: '', body: <>
          <h2>Races</h2>
          <div className="drivers">
            {COURSES.map((c) => {
              const b = bestTime(c.id);
              return (
                <button key={c.id} className={'gcell driver' + (settings.course === c.id ? ' on' : '')} onClick={() => { update({ course: c.id }); setPanel(null); }}>
                  <b>{c.name}</b><small>{c.kind} · {(c.length / 1609.344).toFixed(1)} mi · <Shield label={c.road} /></small><span>{c.blurb}</span>
                  <em>Win {c.reward[0].toLocaleString()} credits{b ? ` · best ${fmtTime(b)}` : ''}</em>
                </button>
              );
            })}
          </div>
          <div className="row"><button className="btn" onClick={() => setPanel(null)}>Back</button></div>
        </>,
      };
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
          <Seg label="Mode" value={boardMode} options={['survival', 'time', 'free'] as Mode[]} labels={(m) => MODES[m].label} onChange={setBoardMode} />
          <Board runs={board(boardMode)} mode={boardMode} highlight={0} />
          <div className="row"><button className="btn" onClick={() => setPanel(null)}>Back</button></div>
        </>,
      };
      case 'settings': return {
        cls: 'wide settings', body: <>
          <h2>Settings</h2>
          <div className="sgrid">
            <div className="scol">
              <section className="sgroup">
                <h3 className="sect">World</h3>
                <div className="field"><label>Time of day</label><Seg label="Time of day" value={settings.time} options={['live', 'sunrise', 'day', 'sunset', 'night'] as TimeOfDay[]} labels={(t) => ({ live: 'Live', sunrise: 'Sunrise', day: 'Day', sunset: 'Sunset', night: 'Night' })[t]} onChange={(t) => update({ time: t })} /></div>
                <div className="field"><label>Weather</label><Seg label="Weather" value={settings.weather} options={['live', 'clear', 'cloudy', 'rain', 'fog', 'mist', 'changing'] as Weather[]} labels={(w) => ({ live: 'Live', clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', fog: 'Fog', mist: 'Mist', changing: 'Changing' })[w]} onChange={(w) => update({ weather: w })} /></div>
                <p className="fine">Live time puts the sun where it is over Orange County right now, from this device's clock. Live weather and Live traffic follow the live server's feed (the National Weather Service at John Wayne Airport; TomTom's flow on each freeway, one point per carriageway, every 15 minutes); with no server in reach they follow a simulated typical day, and the drive says which. Rain cuts grip by about a fifth.</p>
                <div className="row"><button className="btn" onClick={() => update({ time: 'live', weather: 'live', density: 'live' })} aria-pressed={settings.time === 'live' && settings.weather === 'live' && settings.density === 'live'}>Realistic: live time, weather and traffic</button></div>
              </section>
              <section className="sgroup">
                <h3 className="sect">Driving</h3>
                <div className="field"><label>Gearbox</label><Seg label="Gearbox" value={settings.transmission} options={['auto', 'manual']} labels={(t) => (t === 'auto' ? 'Automatic' : 'Manual')} onChange={(t) => update({ transmission: t })} /></div>
                <div className="field"><label htmlFor="handling">Handling</label>
                  <div className="slider"><span>Arcade</span><input id="handling" type="range" min={0} max={1} step={0.05} value={settings.handling} style={fill(settings.handling, 0, 1)} onChange={(e) => update({ handling: Number(e.target.value) })} /><span>Sim</span></div>
                </div>
                <div className="field"><label>Ultra Realism</label>
                  {game.current?.ultraOpen ? <>
                    <Toggle label="On: the world closes in at speed" value={settings.ultra} onChange={(v) => update({ ultra: v })} />
                    {settings.ultra && <div className="stack">
                      <Toggle label="Tunnel vision above about 100 mph" value={settings.ultraTunnel} onChange={(v) => update({ ultraTunnel: v })} />
                      <Toggle label="Camera shake at speed" value={settings.ultraShake} onChange={(v) => update({ ultraShake: v })} />
                      <Toggle label="Muffled sound at speed" value={settings.ultraMuffle} onChange={(v) => update({ ultraMuffle: v })} />
                    </div>}
                  </> : <p className="fine locked">Opens at level 5 (you're level {game.current ? levelOf(game.current.profile.p.xp) : 1}).</p>}
                </div>
              </section>
            </div>
            <div className="scol">
              <section className="sgroup">
                <h3 className="sect">Display</h3>
                <div className="field"><label>Graphics</label><Seg label="Graphics" value={settings.quality} options={Object.keys(QUALITY) as Quality[]} labels={(q) => QUALITY[q].label} onChange={(q) => update({ quality: q })} /></div>
                <p className="fine">{qualityNote(settings.quality)}</p>
                <div className="field"><label>Corner window</label><Seg label="Corner window" value={settings.corner} options={['map', 'sky', 'off']} labels={(c) => (c === 'map' ? 'Road map' : c === 'sky' ? 'Sky camera' : 'Off')} onChange={(c) => update({ corner: c })} /></div>
                <div className="field"><label>Corner size</label><Seg label="Corner size" value={String(settings.cornerSize)} options={['0', '1', '2']} labels={(v) => ['Small', 'Medium', 'Large'][Number(v)]} onChange={(v) => update({ cornerSize: Number(v) })} /></div>
                <div className="field"><label>HUD style</label><Seg label="HUD style" value={settings.hudStyle} options={['modern', 'minimal'] as HudStyle[]} labels={(v) => (v === 'modern' ? 'Modern' : 'Minimal')} onChange={(v) => update({ hudStyle: v })} /></div>
                <p className="fine">{settings.hudStyle === 'minimal'
                  ? 'Minimal tucks the top bar and the corner window away after 4 s of just driving; a tap, a mouse move, a key or a pad button brings them back. Speed, the route prompt and Pause stay.'
                  : 'Modern keeps every control on screen.'}</p>
                <div className="toggles">
                  <Toggle label="Adaptive resolution (holds the frame rate)" value={settings.adaptive} onChange={(v) => update({ adaptive: v })} />
                  <Toggle label="Show frame rate" value={settings.showFps} onChange={(v) => update({ showFps: v })} />
                  {!coarse && <Toggle label="On-screen pedals (for touch screens)" value={settings.showTouch} onChange={(v) => update({ showTouch: v })} />}
                </div>
                <Range label="Field of view" min={-10} max={15} step={1} value={settings.fov} fmt={(v) => (v > 0 ? '+' : '') + v + '°'} onChange={(v) => update({ fov: v })} />
              </section>
              <section className="sgroup">
                <h3 className="sect">Sound</h3>
                <Range label="Radio" min={0} max={1} step={0.05} value={settings.music} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ music: v })} />
                <Range label="Master volume" min={0} max={1} step={0.05} value={settings.master} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ master: v })} />
                <Range label="Engine" min={0} max={1} step={0.05} value={settings.engine} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ engine: v })} />
                <Range label="Road and wind" min={0} max={1} step={0.05} value={settings.ambient} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ ambient: v })} />
              </section>
            </div>
          </div>
          {!coarse && <p className="fine keys">Keyboard: W/S or arrows to drive, A/D to steer, Space handbrake, Q/E shift, C view, N map, F ability, B radio, G horn, V look back, R reset, P pause.</p>}
          <div className="row"><button className="btn primary" onClick={() => setPanel(null)}>Done</button></div>
        </>,
      };
      default: return null;
    }
  };
  const pv = panelView();

  // the main menu's own content: the lede, the mode, the loadout, the traffic, then the extras
  const home = <>
    <p className="lede">Orange County's real freeways (the 5, 405, 55, 57, 22, 91, 73, 133, 241 and 261) and every interchange between them, from the driver's seat of a 711 hp coupe.</p>
    <section className="menu-sec">
      <p className="sect" aria-hidden="true">Mode</p>
      <div className="modes" role="radiogroup" aria-label="Mode" onKeyDown={modeKeys}>
        {MODE_LIST.map((m) => (
          <button key={m} type="button" className={'mode' + (mode === m ? ' on' : '')} role="radio" aria-checked={mode === m} tabIndex={mode === m ? 0 : -1}
            aria-describedby={mode === m ? 'mode-brief' : undefined} onClick={() => setMode(m)}>
            <b>{MODES[m].label}</b><small>{modeStat(m)}</small>
          </button>
        ))}
      </div>
      <p className="mode-brief" id="mode-brief">{MODES[mode].blurb}</p>
    </section>
    <section className="menu-sec">
      <p className="sect" aria-hidden="true">Loadout</p>
      <div className="picks">
        <button className="pick" onClick={() => setPanel('driver')}>
          <small>Driver</small><b>{driver.name}</b><span>{ABILITIES[driver.ability].name}</span><Chevron />
        </button>
        <button className="pick" onClick={() => setPanel('garage')}>
          <small>Car</small><b>{car.name}</b><span>{figures(car).hp} hp</span><Chevron />
        </button>
        {mode === 'race' && (
          <button className="pick" onClick={() => setPanel('course')}>
            <small>Race</small><b>{course.name}</b><span>{course.road}</span><Chevron />
          </button>
        )}
        {mode !== 'time' && mode !== 'race' && (
          <button className="pick" onClick={() => { setExitRoadState(null); roadNow.current = null; setPanel('start'); }}>
            <small>Start on</small><Shield label={myExit ? exitRoadOf : start.label} /><span>{myExit ? `${myExit.text} exit` : start.blurb}</span><Chevron />
          </button>
        )}
      </div>
    </section>
    <section className="menu-sec">
      <div className="field"><label>Traffic</label><Seg label="Traffic" value={settings.density} options={Object.keys(DENSITY) as Density[]} labels={(d) => DENSITY[d].label} onChange={(d) => update({ density: d })} /></div>
    </section>
    <section className="menu-sec live-sec">
      <p className="sect"><span aria-hidden="true">Live · alpha</span>{lobby && <span aria-live="polite">{` · ${lobby.online} of ${lobby.cap} driving now${lobby.queued ? `, ${lobby.queued} waiting` : ''}`}</span>}</p>
      <div className="picks">
        <button className="pick" onClick={() => setPanel('account')}>
          <small>Account</small><b>{liveName || 'Not signed in'}</b><span>{liveName ? 'Signed in on this device' : 'Sign up or log in to drive live'}</span><Chevron />
        </button>
      </div>
      <Toggle label="Drive live: other drivers' cars appear on the freeway" value={settings.live} onChange={(v) => { if (v && !liveName) { setPanel('account'); return; } update({ live: v }); }} />
      <div className="field crew"><label htmlFor="crew">Crew code <span className="muted">optional</span></label>
        <div className="row">
          <input id="crew" className="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={8} placeholder="Everyone" value={crewDraft}
            onChange={(e) => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); setCrewDraft(v); if (!v || /^[A-Z0-9]{4,8}$/.test(v)) update({ crew: v }); }} />
          <button type="button" className="btn" onClick={() => { const v = newCrew(); setCrewDraft(v); update({ crew: v }); }}>New code</button>
        </div>
        <p className="fine">{settings.crew ? `In crew ${settings.crew}: you'll only see, hear and list drivers with the same code.` : 'Leave it empty to drive with everyone. Friends who share a code see only each other.'}</p>
      </div>
      {liveBase(settings.liveUrl) && <div className="row"><button type="button" className="btn invite" onClick={() => void invite()}>{settings.crew ? 'Invite to your crew' : 'Invite a friend'}</button></div>}
      {lobby?.cruise && <p className="cruise">{lobby.cruise.live ? 'OC cruise night is on now. Jump in.' : `Next OC cruise night: ${new Date(lobby.cruise.at).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}`}</p>}
      <p className="fine">One small server, a limited number of drivers at a time; past that you wait in line. Other drivers are ghosts: no collisions, nothing scored. While you drive live the computer traffic stays light, so the real people stand out. Your progress stays on this device.</p>
    </section>
    <div className="menu-aside">
      <a className="soon" href="https://claude.ai/artifact/FDj9Q6S961SLYBg1hMaqd1" target="_blank" rel="noopener noreferrer">
        <small>Coming soon</small><b>Loop Lab</b><span>An arcade track with a loop-the-loop and boost pads, separate from OC. Take a look at the preview.</span>
        <i aria-hidden="true"><svg viewBox="0 0 14 14" width="14" height="14"><path d="M4 2.5h7.5V10M11.5 2.5L2.5 11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></i>
      </a>
      <p className="fine">Freeway geometry: OpenStreetMap contributors via Overture Maps (ODbL). Elevation: USGS via AWS Terrain Tiles. The car, its badge and everything you see are our own, made in code.</p>
    </div>
  </>;

  return (
    <div className={'app' + (idle ? ' hud-idle' : '')} style={{ '--cw': settings.corner === 'off' ? '0px' : `${cornerPx + 6}px` } as CSSProperties}>
      <div className="stage" ref={host} />
      <HUD ref={hud} showFps={settings.showFps} visible={playing && hudOn} bubble={idle && settings.corner !== 'off'} onAbility={() => game.current?.useAbility()} />
      {playing && settings.corner !== 'off' && (
        <button type="button" className={'corner ' + settings.corner} style={{ width: cornerPx, height: cornerPx }} onClick={() => game.current?.cycleCorner()}
          aria-label={settings.corner === 'map' ? 'Road map. Tap for the sky camera.' : 'Sky camera. Tap to hide.'}>
          {settings.corner === 'map' && <canvas ref={mapRef} />}
          <span className="corner-tag">{settings.corner === 'map' ? 'Map' : 'Sky cam'}</span>
        </button>
      )}
      {playing && (
        <div className="tbar">
          <button type="button" className="tbtn" onClick={() => game.current?.cycleCam()}>View</button>
          {settings.corner === 'off' && <button type="button" className="tbtn" onClick={() => game.current?.cycleCorner()}>Map</button>}
          <button type="button" className={'tbtn' + (navTarget ? ' on' : '')} onClick={() => setPanel('nav')}>Go to</button>
          <button type="button" className="tbtn" onClick={() => game.current?.cycleRadio()} aria-label="Radio: next station">Radio</button>
          {liveInfo.status === 'online' && <button type="button" className="tbtn honk" onClick={() => game.current?.honk()} aria-label="Honk (G)" title="Honk (G)">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 6.2h2.6L9.5 3v10L4.6 9.8H2z" fill="currentColor" /><path d="M11.6 5.4a3.4 3.4 0 0 1 0 5.2M13.3 3.8a5.6 5.6 0 0 1 0 8.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>}
          <LiveChip info={liveInfo} me={liveName} crew={settings.crew} canJoin={mode === 'free'} onJoin={(id) => { if (!game.current?.joinDriver(id)) toast('Can\'t find them right now', 'info'); }}
            people={() => [...(live.current?.peers.values() ?? [])].map((p) => ({ id: p.id, name: p.name, road: game.current?.liveRoad(p.id) ?? '' }))} />
          {/* the menu chip: always on screen; while the Minimal HUD is tucked away it is all that's left of the bar, a round
              pause button in the corner (styles.css). Its name stays "Pause" either way. */}
          <button type="button" className="tbtn menu" onClick={() => game.current?.setPaused(true)}>
            <svg className="tico" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M4.5 3v8M9.5 3v8" /></svg><span>Pause</span>
          </button>
        </div>
      )}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}</div>
      {playing && (coarse || settings.showTouch) && game.current && (
        <Touch input={game.current.input} manual={settings.transmission === 'manual'} onShift={(d) => game.current?.pushAction(d > 0 ? 'shiftUp' : 'shiftDown')} />
      )}

      {error && <div className="overlay center"><div className="panel narrow"><Brand /><p>{error}</p></div></div>}
      {welcome && screen === 'menu' && !busy && !panel && (
        <div className="overlay center welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <div className="panel narrow">
            <p className="eyebrow">Live · alpha</p>
            <h2 id="welcome-title">{welcome !== '-' ? `You're invited to crew ${welcome}` : 'Drive OC with other people'}</h2>
            <ul className="welcome-list">
              <li>Orange County's real freeways, from the driver's seat.</li>
              <li>{welcome !== '-' ? 'Your crew drives together: you see, hear and honk at each other.' : 'Other drivers appear as ghost cars with their names. No collisions, no chat.'}</li>
              <li>A free account is a name and a password. Up to 25 drive at once to start; past that you wait in line.</li>
            </ul>
            <div className="row">
              <button className="btn primary" onClick={() => closeWelcome(true)}>Sign up and drive live</button>
              <button className="btn" onClick={() => closeWelcome(false)}>Just drive</button>
            </div>
          </div>
        </div>
      )}
      {lost && <div className="overlay center"><div className="panel narrow"><h2>Graphics reset</h2><p>The browser dropped the 3D context for a moment. It's coming back on its own; press Resume when it does.</p><button className="btn primary" onClick={resume}>Resume</button></div></div>}

      {inMenu && (
        <div className="overlay menu">
          <div className={'sheet ' + (pv ? 'sub' : 'home')}>
            <div className="sheet-main" ref={sheetMain}>
              <div className="sheet-scroll" ref={sheetScroll}>
                <Brand hero />
                <div className={'sheet-body' + (entering ? ' enter' : '')} key={view} ref={sheetBody} tabIndex={-1}
                  onAnimationEnd={(e) => { if (e.target === e.currentTarget) setEntering(false); }}>
                  {pv ? <>
                    <button type="button" className="back" onClick={() => setPanel(null)}><Chevron left />Menu</button>
                    <div className={'panel in-sheet ' + pv.cls}>{pv.body}</div>
                  </> : home}
                </div>
              </div>
              <div className="sheet-ghost" ref={ghost} aria-hidden="true" />
            </div>
            <div className="dock">
              <button className="btn primary go" onClick={() => drive()}>Drive</button>
              <button className="btn" aria-current={panel === 'settings' ? 'page' : undefined} onClick={() => (panel === 'settings' ? setPanel(null) : setPanel('settings'))}>Settings</button>
              <button className="btn" aria-current={panel === 'board' ? 'page' : undefined} onClick={() => (panel === 'board' ? setPanel(null) : openBoard())}>Bests</button>
              <button className="btn" aria-current={panel === 'profile' ? 'page' : undefined} onClick={() => (panel === 'profile' ? setPanel(null) : setPanel('profile'))}>Profile</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'paused' && !panel && (
        <div className="overlay center">
          <div className="panel narrow paused">
            <OcWatermark />
            <div className="panel-head"><OcLockup size="md" /><p className="eyebrow">{MODES[mode].label}</p></div>
            <h2>Paused</h2>
            {liveInfo.status === 'online' && (() => {
              const others = [...(live.current?.peers.values() ?? [])].map((p) => p.name).filter(Boolean).sort();
              return <p className="fine live-line">Live: {liveInfo.online} of {liveInfo.cap} driving{others.length ? ` · ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` and ${others.length - 3} more` : ''}` : ' · just you so far'}. Others can't see your car while you're paused.</p>;
            })()}
            {liveInfo.status === 'queued' && <p className="fine live-line">Live: you're #{liveInfo.position} in line for one of {liveInfo.cap} spots.</p>}
            <div className="stack">
              <button className="btn primary" onClick={resume}>Resume</button>
              <button className="btn" onClick={() => setPanel('nav')}>Go to a freeway</button>
              <button className="btn" onClick={() => drive(mode)}>Restart</button>
              <button className="btn" onClick={() => setPanel('settings')}>Settings</button>
              {mode === 'free' && <button className="btn" onClick={() => game.current?.endFreeDrive?.()}>End drive</button>}
              {liveInfo.status === 'online' && <button className="btn" onClick={() => void invite()}>Invite a friend</button>}
              <button className="btn" onClick={openFeedback}>Feedback</button>
              <button className="btn" onClick={toMenu}>Main menu</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'over' && result && (
        <div className="overlay center">
          <div className="panel narrow result">
            <div className="panel-head"><OcLockup size="md" /><p className="eyebrow">{MODES[result.mode].label}</p></div>
            <h2>{result.reason}</h2>
            {result.race ? <>
              <div className="big">P{result.race.position}<small>of {result.race.of} · {result.race.time}</small></div>
              {result.newBest ? <p className="good">New best time on {result.race.course}</p> : result.race.best ? <p className="muted">Best {result.race.best}</p> : null}
              <p className="good">+{result.race.credits.toLocaleString()} credits · +{result.race.xp.toLocaleString()} XP</p>
              <ol className="order">{result.race.order.map((n, i) => <li key={n} className={n === 'You' ? 'me' : ''}><b>{i + 1}</b>{n}</li>)}</ol>
            </> : <>
              <div className="big">{result.mode === 'time' ? (result.distance / 1609.344).toFixed(2) : result.score.toLocaleString()}<small>{result.mode === 'time' ? 'miles' : 'points'}</small></div>
              {result.newBest ? <p className="good">New personal best</p> : <p className="muted">Best {result.mode === 'time' ? (result.best / 1609.344).toFixed(2) + ' mi' : result.best.toLocaleString()}</p>}
            </>}
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
            {!result.race && <Board runs={result.board.runs} mode={result.mode} highlight={result.board.rank} />}
            <div className="row">
              <button className="btn primary" onClick={() => drive(result.mode)}>Drive again</button>
              <button className="btn" onClick={() => void shareRunCard(result, game.current?.profile.p.username ?? 'Driver').then((r) => toast({ shared: 'Shared', saved: 'Run card saved', declined: 'Not saved', failed: 'Could not save the card' }[r], r === 'failed' ? 'bad' : r === 'declined' ? 'info' : 'good'))}>Share run</button>
              <button className="btn" onClick={toMenu}>Main menu</button>
            </div>
          </div>
        </div>
      )}

      {/* away from the main menu (pause, results) a panel is a card of its own over the paused drive */}
      {!inMenu && pv && <div className="overlay center"><div className={'panel ' + pv.cls}>{pv.body}</div></div>}

      {/* last, so it lies over the menu while it fades into it; it lets taps through as it goes */}
      {(loadingOn || loadShown) && !error && (
        <div className={'overlay center loading-screen' + (loadingOn ? '' : ' leaving')} aria-hidden={loadingOn ? undefined : true}>
          <OcWatermark /><div className="loading"><Brand /><p>{loadingText}…</p><div className="loadbar"><i /></div></div>
        </div>
      )}
    </div>
  );
}

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
      if (a instanceof HTMLElement && a.closest('.tbar, .corner') && a.matches(':focus-visible')) { arm(); return; }
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

function qualityNote(q: Quality) {
  return {
    low: 'For phones: no shadows or post-processing, 0.9 km of road.',
    medium: 'Sun shadows around the car, 1.3 km of road.',
    high: 'Sharper shadows, bloom, 4x MSAA, 1.8 km of road.',
    ultra: 'Everything: ambient occlusion, 4K shadow map, denser scenery, 2.4 km of road.',
  }[q];
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

function Board({ runs, mode, highlight }: { runs: { score: number; distance: number; top: number; streak: number; when: number; road: string }[]; mode: Mode; highlight: number }) {
  return (
    <div className="board">
      <p className="eyebrow">Local leaderboard · this device only</p>
      {runs.length === 0 ? <p className="muted">No runs yet.</p> : (
        <ol>{runs.slice(0, 5).map((r, i) => (
          <li key={r.when + ':' + i} className={i + 1 === highlight ? 'me' : ''}>
            <b>{mode === 'time' ? (r.distance / 1609.344).toFixed(2) + ' mi' : r.score.toLocaleString()}</b>
            <span>{r.top} mph{mode === 'survival' ? ` · ${r.streak.toFixed(1)} s streak` : ''}</span>
            <time>{new Date(r.when).toLocaleDateString()}</time>
          </li>
        ))}</ol>
      )}
    </div>
  );
}

// the garage (what you own, pick one) and the showroom (what credits can buy, by level)
function GaragePanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const book = game.profile;
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');
  const p = book.p, level = levelOf(p.xp), slots = slotsFor(level);
  const act = (fn: () => string | null, ok: string) => { const e = fn(); setMsg(e ?? ok); game.applyCarChoice(); bump((n) => n + 1); };
  return <>
    <h2>Garage</h2>
    <p className="fine">{Math.floor(p.credits).toLocaleString()} credits · {p.vehicles.length} of {slots} slots (more open every 4 levels). Credits come from driving; nothing here costs real money.</p>
    {msg && <p className="good" role="status">{msg}</p>}
    <div className="drivers">
      {CARS.map((c) => {
        const f = figures(c), owned = p.vehicles.includes(c.id), driving = p.car === c.id, locked = level < c.level;
        return (
          <div key={c.id} className={'gcell driver car' + (driving ? ' on' : '')}>
            <div className="carhead"><span className="paint" style={{ background: '#' + c.paint.toString(16).padStart(6, '0') }} /><b>{c.name}</b></div>
            <small>{f.hp} hp · {f.zeroSixty} s 0-60 · {f.topMph} mph · {c.mass.toLocaleString()} kg</small>
            <span>{c.blurb}</span>
            <div className="row">
              {/* named for its car: the menu's Drive dock stays on screen beside the garage, and is the only plain "Drive" */}
              {owned ? (driving ? <em>Driving it</em> : <button className="btn" aria-label={`Drive the ${c.name}`} onClick={() => act(() => { book.choose(c.id); return null; }, `${c.name} selected`)}>Drive</button>)
                : locked ? <em>Opens at level {c.level}</em>
                : <button className="btn primary" onClick={() => act(() => book.buy(c.id, c.price, c.level, slots), `${c.name} is yours`)}>Buy · {c.price.toLocaleString()}</button>}
              {owned && c.id !== 'rossini-gt' && <button className="btn" onClick={() => act(() => book.sell(c.id, c.price), `Sold for ${Math.round(c.price * 0.6).toLocaleString()} credits`)}>Sell</button>}
            </div>
          </div>
        );
      })}
    </div>
    <p className="fine">The makes are our own. Each has its own body and interior, and its own numbers underneath.</p>
    <div className="row"><button className="btn primary" onClick={onClose}>Done</button></div>
  </>;
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
      <div><dt>Races won</dt><dd>{p.racesWon}</dd></div>
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
// how far along a range input is, for the filled part of its track
function fill(v: number, min: number, max: number): CSSProperties {
  return { '--v': `${(((v - min) / (max - min || 1)) * 100).toFixed(1)}%` } as CSSProperties;
}
// a segmented control: one rounded track, the chosen segment raised in it. --n sets the columns (styles.css wraps a
// six-way choice into two rows on a phone)
function Seg<T extends string>({ value, options, labels, onChange, label }: { value: T; options: T[]; labels: (v: T) => string; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label} data-n={options.length} style={{ '--n': options.length } as CSSProperties}>
      {options.map((o) => <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>{labels(o)}</button>)}
    </div>
  );
}
// a switch: a real checkbox drawn as an iOS-style switch (styles.css), its label to the left
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle"><input type="checkbox" role="switch" checked={value} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
}
function Range({ label, min, max, step, value, fmt, onChange }: { label: string; min: number; max: number; step: number; value: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  const id = 'r-' + label.replace(/\W+/g, '');
  return <div className="field"><label htmlFor={id}>{label} <output>{fmt(value)}</output></label><input id={id} type="range" min={min} max={max} step={step} value={value} style={fill(value, min, max)} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}

// a crew code nobody will guess by accident: five letters and numbers, no look-alikes (0/O, 1/I)
function newCrew() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; const r = new Uint32Array(5); crypto.getRandomValues(r); for (const v of r) s += a[v % a.length]; return s; }
