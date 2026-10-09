// Menus, settings, pause and results around the game, plus the HUD, the corner map and the touch controls.
// Phone first: big targets, one column, no keyboard needed anywhere.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Game, Result, CORNER_PX } from '../game/Game';
import { Settings, loadSettings, saveSettings, QUALITY, DENSITY, MODES, STARTS, Mode, Quality, Density, loadBest } from '../game/settings';
import { board } from '../game/records';
import { HUD, HudHandle } from './HUD';
import { Touch } from './Touch';

type Screen = 'loading' | 'menu' | 'playing' | 'paused' | 'over';
type Panel = null | 'settings' | 'start' | 'nav' | 'board';

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
    void game.current?.start(m, settings.start);
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
      <HUD ref={hud} showFps={settings.showFps} visible={playing && hudOn} />
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
                  {m !== 'free' && <em>Best {m === 'time' ? (loadBest(m) / 1609.344).toFixed(2) + ' mi' : loadBest(m).toLocaleString()}</em>}
                </button>
              ))}
            </div>
            {mode !== 'time' && (
              <button className="pick" onClick={() => setPanel('start')}>
                <small>Start on</small><Shield label={start.label} /><span>{start.blurb}</span><i aria-hidden="true">›</i>
              </button>
            )}
            <div className="field"><label>Traffic</label><Seg value={settings.density} options={Object.keys(DENSITY) as Density[]} labels={(d) => DENSITY[d].label} onChange={(d) => update({ density: d })} /></div>
            <div className="row">
              <button className="btn primary" onClick={() => drive()}>Drive</button>
              <button className="btn" onClick={() => setPanel('settings')}>Settings</button>
              <button className="btn" onClick={() => { setBoardMode(mode === 'free' ? 'survival' : mode); setPanel('board'); }}>Bests</button>
            </div>
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
            <div className="big">{result.mode === 'time' ? (result.distance / 1609.344).toFixed(2) : result.score.toLocaleString()}<small>{result.mode === 'time' ? 'miles' : 'points'}</small></div>
            {result.newBest ? <p className="good">New personal best</p> : <p className="muted">Best {result.mode === 'time' ? (result.best / 1609.344).toFixed(2) + ' mi' : result.best.toLocaleString()}</p>}
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
            <Board runs={result.board.runs} mode={result.mode} highlight={result.board.rank} />
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
            <Range label="Field of view" min={-10} max={15} step={1} value={settings.fov} fmt={(v) => (v > 0 ? '+' : '') + v + '°'} onChange={(v) => update({ fov: v })} />
            <Range label="Master volume" min={0} max={1} step={0.05} value={settings.master} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ master: v })} />
            <Range label="Engine" min={0} max={1} step={0.05} value={settings.engine} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ engine: v })} />
            <Range label="Road and wind" min={0} max={1} step={0.05} value={settings.ambient} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => update({ ambient: v })} />
            {!coarse && <p className="fine">Keyboard: W/S or arrows to drive, A/D to steer, Space handbrake, Q/E shift, C view, N map, V look back, R reset, P pause.</p>}
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
