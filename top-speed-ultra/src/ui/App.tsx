// Menus, settings, pause and results around the game, plus the HUD, the corner map and the touch controls.
// Phone first: big targets, one column, no keyboard needed anywhere.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Game, Result, CORNER_PX } from '../game/Game';
import { Settings, loadSettings, saveSettings, QUALITY, DENSITY, MODES, STARTS, Mode, Quality, Density, TimeOfDay, Weather, loadBest } from '../game/settings';
import { board } from '../game/records';
import { AVATARS, ACHIEVEMENTS, ROUTES_ALL, levelOf, xpFor, PROFILE_VERSION } from '../game/profile';
import { DRIVERS, ABILITIES, SKINS } from '../game/drivers';
import { COURSES, bestTime, fmtTime } from '../game/race';
import { CARS, carById, figures, slotsFor } from '../game/cars';
import { HUD, HudHandle } from './HUD';
import { Touch } from './Touch';

type Screen = 'loading' | 'menu' | 'playing' | 'paused' | 'over';
type Panel = null | 'settings' | 'start' | 'nav' | 'board' | 'profile' | 'driver' | 'course' | 'garage';

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const ROUTES = ['I-5', 'I-405', 'CA-55', 'CA-57', 'CA-22', 'CA-91', 'CA-73', 'CA-133', 'CA-241', 'CA-261'];

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const hud = useRef<HudHandle>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [panel, setPanel] = useState<Panel>(null);
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
  const toastId = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const toast = useCallback((text: string, kind = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800);
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
    return () => { g.dispose(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { game.current?.setMapCanvas(mapRef.current); });

  const drive = (m: Mode = mode) => {
    setMode(m); setPanel(null); setResult(null); setNavTarget(null);
    setScreen('playing');
    void game.current?.start(m, settings.start, settings.course);
  };
  const resume = () => { setPanel(null); game.current?.setPaused(false); setScreen('playing'); };
  const toMenu = () => { setPanel(null); setResult(null); game.current?.quitToMenu(); setScreen('menu'); };
  const navigate = (label: string | null) => {
    if (game.current?.navigateTo(label)) setNavTarget(label);
    setPanel(null);
    if (screen === 'paused') resume();
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Escape' && panel) { setPanel(null); e.stopPropagation(); } if (e.code === 'Enter' && screen === 'menu' && !panel) drive(); };
    addEventListener('keydown', k, true);
    return () => removeEventListener('keydown', k, true);
  });

  const playing = screen === 'playing';
  const cornerPx = CORNER_PX[settings.cornerSize] ?? CORNER_PX[1];
  const start = STARTS.find((s) => s.label === settings.start) ?? STARTS[0];
  return (
    <div className="app">
      <div className="stage" ref={host} />
      <HUD ref={hud} showFps={settings.showFps} visible={playing && hudOn} onAbility={() => game.current?.useAbility()} />
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
          <button type="button" className="tbtn" onClick={() => game.current?.setPaused(true)}>Pause</button>
        </div>
      )}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}</div>
      {playing && (coarse || settings.showTouch) && game.current && (
        <Touch input={game.current.input} manual={settings.transmission === 'manual'} onShift={(d) => game.current?.pushAction(d > 0 ? 'shiftUp' : 'shiftDown')} />
      )}

      {(screen === 'loading' || busy) && !error && (
        <div className="overlay center"><div className="loading"><Brand /><p>{loadingText}…</p><div className="loadbar"><i /></div></div></div>
      )}
      {error && <div className="overlay center"><div className="panel narrow"><Brand /><p>{error}</p></div></div>}
      {lost && <div className="overlay center"><div className="panel narrow"><h2>Graphics reset</h2><p>The browser dropped the 3D context for a moment. It's coming back on its own; press Resume when it does.</p><button className="btn primary" onClick={resume}>Resume</button></div></div>}

      {screen === 'menu' && !panel && !busy && (
        <div className="overlay menu">
          <div className="menu-col">
            <Brand />
            <p className="lede">Orange County's real freeways (the 5, 405, 55, 57, 22, 91, 73, 133, 241 and 261) and every interchange between them, from the driver's seat of a 711 hp coupe.</p>
            <div className="modes" role="radiogroup" aria-label="Mode">
              {(Object.keys(MODES) as Mode[]).map((m) => (
                <button key={m} className={'mode' + (mode === m ? ' on' : '')} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
                  <b>{MODES[m].label}</b><span>{MODES[m].blurb}</span>
                  {(m === 'survival' || m === 'time') && <em>Best {m === 'time' ? (loadBest(m) / 1609.344).toFixed(2) + ' mi' : loadBest(m).toLocaleString()}</em>}
                  {m === 'race' && <em>{game.current?.profile.p.racesWon ?? 0} won</em>}
                </button>
              ))}
            </div>
            <button className="pick" onClick={() => setPanel('driver')}>
              <small>Driver</small><b>{(DRIVERS.find((d) => d.id === settings.driver) ?? DRIVERS[0]).name}</b><span>{ABILITIES[(DRIVERS.find((d) => d.id === settings.driver) ?? DRIVERS[0]).ability].name}</span><i aria-hidden="true">›</i>
            </button>
            <button className="pick" onClick={() => setPanel('garage')}>
              <small>Car</small><b>{carById(game.current?.profile.p.car ?? 'rossini-gt').name}</b><span>{figures(carById(game.current?.profile.p.car ?? 'rossini-gt')).hp} hp</span><i aria-hidden="true">›</i>
            </button>
            {mode === 'race' && (
              <button className="pick" onClick={() => setPanel('course')}>
                <small>Race</small><b>{(COURSES.find((c) => c.id === settings.course) ?? COURSES[0]).name}</b><span>{(COURSES.find((c) => c.id === settings.course) ?? COURSES[0]).road}</span><i aria-hidden="true">›</i>
              </button>
            )}
            {mode !== 'time' && mode !== 'race' && (
              <button className="pick" onClick={() => setPanel('start')}>
                <small>Start on</small><Shield label={start.label} /><span>{start.blurb}</span><i aria-hidden="true">›</i>
              </button>
            )}
            <div className="field"><label>Traffic</label><Seg value={settings.density} options={Object.keys(DENSITY) as Density[]} labels={(d) => DENSITY[d].label} onChange={(d) => update({ density: d })} /></div>
            <div className="row">
              <button className="btn primary" onClick={() => drive()}>Drive</button>
              <button className="btn" onClick={() => setPanel('settings')}>Settings</button>
              <button className="btn" onClick={() => { setBoardMode(mode === 'free' ? 'survival' : mode); setPanel('board'); }}>Bests</button>
              <button className="btn" onClick={() => setPanel('profile')}>Profile</button>
            </div>
            <a className="soon" href="https://claude.ai/artifact/FDj9Q6S961SLYBg1hMaqd1" target="_blank" rel="noopener noreferrer">
              <small>Coming soon</small><b>Loop Lab</b><span>An arcade track with a loop-the-loop and boost pads, separate from OC. Take a look at the preview.</span><i aria-hidden="true">↗</i>
            </a>
            <p className="fine">Freeway geometry: OpenStreetMap contributors via Overture Maps (ODbL). Elevation: USGS via AWS Terrain Tiles. The car, its badge and everything you see are our own, made in code.</p>
          </div>
        </div>
      )}

      {screen === 'paused' && !panel && (
        <div className="overlay center">
          <div className="panel narrow">
            <h2>Paused</h2>
            <div className="stack">
              <button className="btn primary" onClick={resume}>Resume</button>
              <button className="btn" onClick={() => setPanel('nav')}>Go to a freeway</button>
              <button className="btn" onClick={() => drive(mode)}>Restart</button>
              <button className="btn" onClick={() => setPanel('settings')}>Settings</button>
              {mode === 'free' && <button className="btn" onClick={() => game.current?.endFreeDrive?.()}>End drive</button>}
              <button className="btn" onClick={toMenu}>Main menu</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'over' && result && (
        <div className="overlay center">
          <div className="panel narrow result">
            <p className="eyebrow">{MODES[result.mode].label}</p>
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
              <button className="btn" onClick={toMenu}>Main menu</button>
            </div>
          </div>
        </div>
      )}

      {panel === 'start' && (
        <div className="overlay center">
          <div className="panel">
            <h2>Start on</h2>
            <div className="grid">
              {STARTS.map((s) => (
                <button key={s.label} className={'gcell' + (s.label === settings.start ? ' on' : '')} onClick={() => { update({ start: s.label }); setPanel(null); }}>
                  <Shield label={s.label} /><span>{s.blurb}</span>
                </button>
              ))}
            </div>
            <div className="row"><button className="btn" onClick={() => setPanel(null)}>Back</button></div>
          </div>
        </div>
      )}

      {panel === 'nav' && (
        <div className="overlay center">
          <div className="panel">
            <h2>Go to</h2>
            <p className="fine">Pick a freeway and direction. The yellow line on the map and the prompt at the top show the way through each interchange.</p>
            <div className="grid nav">
              {ROUTES.flatMap((r) => (game.current?.mainsLabels ?? []).filter((l) => l.startsWith(r + ' ')).map((l) => (
                <button key={l} className={'gcell' + (navTarget === l ? ' on' : '')} onClick={() => navigate(l)}><Shield label={l} /></button>
              )))}
            </div>
            <div className="row">
              {navTarget && <button className="btn" onClick={() => navigate(null)}>Clear route</button>}
              <button className="btn" onClick={() => setPanel(null)}>Back</button>
            </div>
          </div>
        </div>
      )}

      {panel === 'profile' && game.current && <ProfilePanel game={game.current} onClose={() => setPanel(null)} />}

      {panel === 'course' && (
        <div className="overlay center">
          <div className="panel">
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
          </div>
        </div>
      )}

      {panel === 'garage' && game.current && <GaragePanel game={game.current} onClose={() => setPanel(null)} />}

      {panel === 'driver' && (
        <div className="overlay center">
          <div className="panel">
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
            <div className="field"><label>Presentation</label><Seg value={settings.presentation} options={['m', 'f']} labels={(v) => (v === 'm' ? 'Male' : 'Female')} onChange={(v) => update({ presentation: v })} /></div>
            <div className="field"><label>Skin tone</label>
              <div className="swatches" role="group" aria-label="Skin tone">{SKINS.map((c, i) => <button key={i} aria-pressed={settings.skin === i} style={{ background: '#' + c.toString(16).padStart(6, '0') }} onClick={() => update({ skin: i })} aria-label={`Tone ${i + 1}`} />)}</div>
            </div>
            <p className="fine">Looks are cosmetic. Use the ability with the round button (or F). Abilities change the traffic or the grip, never the scoring rules.</p>
            <div className="row"><button className="btn primary" onClick={() => setPanel(null)}>Done</button></div>
          </div>
        </div>
      )}

      {panel === 'board' && (
        <div className="overlay center">
          <div className="panel">
            <h2>Personal bests</h2>
            <Seg value={boardMode} options={['survival', 'time', 'free'] as Mode[]} labels={(m) => MODES[m].label} onChange={setBoardMode} />
            <Board runs={board(boardMode)} mode={boardMode} highlight={0} />
            <div className="row"><button className="btn" onClick={() => setPanel(null)}>Back</button></div>
          </div>
        </div>
      )}

      {panel === 'settings' && (
        <div className="overlay center">
          <div className="panel">
            <h2>Settings</h2>
            <div className="field"><label>Time of day</label><Seg value={settings.time} options={['live', 'sunrise', 'day', 'sunset', 'night'] as TimeOfDay[]} labels={(t) => ({ live: 'Live', sunrise: 'Sunrise', day: 'Day', sunset: 'Sunset', night: 'Night' })[t]} onChange={(t) => update({ time: t })} /></div>
            <div className="field"><label>Weather</label><Seg value={settings.weather} options={['clear', 'cloudy', 'rain', 'fog', 'mist', 'changing'] as Weather[]} labels={(w) => ({ clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', fog: 'Fog', mist: 'Mist', changing: 'Changing' })[w]} onChange={(w) => update({ weather: w })} /></div>
            <p className="fine">Live puts the sun where it is over Orange County right now, from this device's clock. Weather is simulated here (no live weather feed). Rain cuts grip by about a fifth.</p>
            <div className="field"><label>Graphics</label><Seg value={settings.quality} options={Object.keys(QUALITY) as Quality[]} labels={(q) => QUALITY[q].label} onChange={(q) => update({ quality: q })} /></div>
            <p className="fine">{qualityNote(settings.quality)}</p>
            <div className="field"><label>Gearbox</label><Seg value={settings.transmission} options={['auto', 'manual']} labels={(t) => (t === 'auto' ? 'Automatic' : 'Manual')} onChange={(t) => update({ transmission: t })} /></div>
            <div className="field"><label htmlFor="handling">Handling</label>
              <div className="slider"><span>Arcade</span><input id="handling" type="range" min={0} max={1} step={0.05} value={settings.handling} onChange={(e) => update({ handling: Number(e.target.value) })} /><span>Sim</span></div>
            </div>
            <div className="field"><label>Corner window</label><Seg value={settings.corner} options={['map', 'sky', 'off']} labels={(c) => (c === 'map' ? 'Road map' : c === 'sky' ? 'Sky camera' : 'Off')} onChange={(c) => update({ corner: c })} /></div>
            <div className="field"><label>Corner size</label><Seg value={String(settings.cornerSize)} options={['0', '1', '2']} labels={(v) => ['Small', 'Medium', 'Large'][Number(v)]} onChange={(v) => update({ cornerSize: Number(v) })} /></div>
            <Toggle label="Adaptive resolution (holds the frame rate)" value={settings.adaptive} onChange={(v) => update({ adaptive: v })} />
            <Toggle label="Show frame rate" value={settings.showFps} onChange={(v) => update({ showFps: v })} />
            {!coarse && <Toggle label="On-screen pedals (for touch screens)" value={settings.showTouch} onChange={(v) => update({ showTouch: v })} />}
            <div className="field"><label>Ultra Realism</label>
              {game.current?.ultraOpen ? <>
                <Toggle label="On: the world closes in at speed" value={settings.ultra} onChange={(v) => update({ ultra: v })} />
                {settings.ultra && <div className="stack">
                  <Toggle label="Tunnel vision above about 100 mph" value={settings.ultraTunnel} onChange={(v) => update({ ultraTunnel: v })} />
                  <Toggle label="Camera shake at speed" value={settings.ultraShake} onChange={(v) => update({ ultraShake: v })} />
                  <Toggle label="Muffled sound at speed" value={settings.ultraMuffle} onChange={(v) => update({ ultraMuffle: v })} />
                </div>}
              </> : <p className="fine">Opens at level 5 (you're level {game.current ? levelOf(game.current.profile.p.xp) : 1}).</p>}
            </div>
            <Range label="Radio" min={0} max={1} step={0.05} value={settings.music} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ music: v })} />
            <Range label="Field of view" min={-10} max={15} step={1} value={settings.fov} fmt={(v) => (v > 0 ? '+' : '') + v + '°'} onChange={(v) => update({ fov: v })} />
            <Range label="Master volume" min={0} max={1} step={0.05} value={settings.master} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ master: v })} />
            <Range label="Engine" min={0} max={1} step={0.05} value={settings.engine} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ engine: v })} />
            <Range label="Road and wind" min={0} max={1} step={0.05} value={settings.ambient} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ ambient: v })} />
            {!coarse && <p className="fine">Keyboard: W/S or arrows to drive, A/D to steer, Space handbrake, Q/E shift, C view, N map, F ability, B radio, V look back, R reset, P pause.</p>}
            <div className="row"><button className="btn primary" onClick={() => setPanel(null)}>Done</button></div>
          </div>
        </div>
      )}
    </div>
  );
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
  return (
    <div className="overlay center">
      <div className="panel profile">
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
                  {owned ? (driving ? <em>Driving it</em> : <button className="btn" onClick={() => act(() => { book.choose(c.id); return null; }, `${c.name} selected`)}>Drive</button>)
                    : locked ? <em>Opens at level {c.level}</em>
                    : <button className="btn primary" onClick={() => act(() => book.buy(c.id, c.price, c.level, slots), `${c.name} is yours`)}>Buy · {c.price.toLocaleString()}</button>}
                  {owned && c.id !== 'rossini-gt' && <button className="btn" onClick={() => act(() => book.sell(c.id, c.price), `Sold for ${Math.round(c.price * 0.6).toLocaleString()} credits`)}>Sell</button>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="fine">The makes are our own. For now every car shares one body; the paint and what's underneath change.</p>
        <div className="row"><button className="btn primary" onClick={onClose}>Done</button></div>
      </div>
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
  return (
    <div className="overlay center">
      <div className="panel profile">
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
      </div>
    </div>
  );
}

function Brand() {
  return <div className="brand"><span className="badge" aria-hidden="true">R</span><div><h1>Ultra</h1><p>Top Speed OC</p></div></div>;
}
function Seg<T extends string>({ value, options, labels, onChange }: { value: T; options: T[]; labels: (v: T) => string; onChange: (v: T) => void }) {
  return <div className="seg" role="group">{options.map((o) => <button key={o} aria-pressed={o === value} onClick={() => onChange(o)}>{labels(o)}</button>)}</div>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle"><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
}
function Range({ label, min, max, step, value, fmt, onChange }: { label: string; min: number; max: number; step: number; value: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  const id = 'r-' + label.replace(/\W+/g, '');
  return <div className="field"><label htmlFor={id}>{label} <output>{fmt(value)}</output></label><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}
