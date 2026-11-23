// Settings (owner, 2026-11-18; the Gearbox and Appearance sections went on 2026-11-22: the car is automatic for everyone, and
// the look follows the Graphics choice: "One category at a time. Details when you need them."), in the Midnight / Velocity
// templates' layout: on a desktop a rail of six tabs (Graphics, HUD & Map, World, Driving, Sound, Testing) with one
// category beside it; on a phone a back arrow, the title and a category dropdown over stacked sections, DONE pinned at the
// foot. One line of help under every control; "Compare handling" and "Performance details" open when asked for.

import { useEffect, useState } from 'react';
import type { Game } from '../game/Game';
import { Settings, TimeOfDay, Weather, HudStyle, Theme, Graphics, GRAPHICS, graphicsOf, graphicsPatch, loadBench, QUALITY } from '../game/settings';
import { levelOf } from '../game/profile';
import { Seg, Toggle, Range, Handling, Disclosure } from './controls';
import { STATIONS } from '../game/audio/Radio';

export const SET_SECTIONS: [string, string, string][] = [
  ['graphics', 'Graphics', 'How the world is drawn, and the colours of the menus.'],
  ['hud', 'HUD & Map', 'What stays on screen while you drive.'],
  ['world', 'World', 'The sky over your drive.'],
  ['driving', 'Driving', 'Tune the feel of your next run.'],
  ['sound', 'Sound', 'The mix: radio, engine, road.'],
  ['testing', 'Testing', 'For test builds.'],
];

// Settings' live line under the presets: the preset the player chose ("Ultra · auto" while the governor runs it) and
// where the governor stands, read from the game twice a second while Settings is open
function GovNow({ game }: { game: Game | null }) {
  const [t, setT] = useState<[string, string]>(['', '']);
  useEffect(() => {
    if (!game) return;
    const read = () => setT((o) => { const a = game.govLabel(), b = game.govDetail(); return o[0] === a && o[1] === b ? o : [a, b]; });
    read();
    const i = setInterval(read, 500);
    return () => clearInterval(i);
  }, [game]);
  if (!t[0]) return null;
  return <p className="help gov-now">Now: <b>{t[0]}</b> · {t[1]}</p>;
}

// what the graphics check measured on this device (saved by Game.benchmark), as a hint: it never picks the graphics by
// itself (a new player starts on Retro Low; owner, 2026-11-16)
function BenchHint({ graphics }: { graphics: Graphics }) {
  const b = loadBench();
  if (!b || b.skipped || b.inconclusive) return null;
  const nearer = graphicsOf({ quality: b.quality });
  const what = `${GRAPHICS[nearer].label}${b.scale < 1 ? ` at ${Math.round(b.scale * 100)}% resolution` : ''}${b.target === 30 ? ' at a steady 30 fps' : ''}`;
  if (nearer === graphics) return <p className="help bench-hint">The graphics check found this device holds {what}.{graphics === 'retro' ? ' It measured the standard presets, not Retro\'s own picture.' : ''}</p>;
  return <p className="help bench-hint">The graphics check found this device holds {what}. Pick it above if you want it.</p>;
}

export interface SettingsProps {
  game: Game | null; settings: Settings; update: (p: Partial<Settings>) => void;
  sec: string; setSec: (k: string) => void; onDone: () => void; onFeedback: () => void;
  inMenu: boolean; benching: boolean; runBench: () => void; coarse: boolean; testBuild: boolean;
}

export function SettingsPanel({ game, settings, update, sec, setSec, onDone, onFeedback, inMenu, benching, runBench, coarse, testBuild }: SettingsProps) {
  const g = graphicsOf(settings), cur = SET_SECTIONS.find(([k]) => k === sec) ?? SET_SECTIONS[0];
  const pct = (v: number) => Math.round(v * 100) + '%';
  const [, bump] = useState(0);
  // the radio (music composed live in code) is reached from the drive's radio button and the B key, and here: on tunes the first
  // starred station (or the first), off turns it off. It plays while you drive, so on the menu the switch waits.
  const radioOn = !!game && game.radio.station >= 0;
  const radioSwitch = (on: boolean) => {
    if (!game) return;
    const fav = settings.radioFavs[0], i = fav ? STATIONS.findIndex((x) => x.id === fav) : 0;
    game.tuneRadio(on ? Math.max(0, i) : -1); bump((n) => n + 1);
  };
  return (
    <div className="set">
      <header className="set-head">
        <button type="button" className="set-back" aria-label="Back" onClick={onDone}><svg viewBox="0 0 8 14" width="10" height="16" aria-hidden="true"><path d="M7 1L1 7l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <h2>Settings</h2>
        <button type="button" className="set-x" aria-label="Close settings" onClick={onDone}><svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
      </header>
      <div className="set-body">
        <nav className="s-rail" aria-label="Settings sections">
          {SET_SECTIONS.map(([k, t]) => <button key={k} type="button" className={'s-tab' + (sec === k ? ' on' : '')} aria-current={sec === k ? 'true' : undefined} onClick={() => setSec(k)}>{t}</button>)}
        </nav>
        <label className="s-pick">
          <span className="sr">Category</span>
          <select value={cur[0]} onChange={(e) => setSec(e.target.value)} aria-label="Settings category">
            {SET_SECTIONS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <svg viewBox="0 0 14 8" width="14" height="8" aria-hidden="true"><path d="M1 1l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </label>
        <div className="s-main" key={cur[0]}>
          <h3 className="s-title">{cur[1]}</h3>
          <p className="s-tag">{cur[2]}</p>

          {cur[0] === 'graphics' && <section className="sgroup" id="set-graphics">
            <div className="field"><label>Graphics</label>
              <Seg label="Graphics" value={g} options={['retro', 'ultra'] as Graphics[]} labels={(v) => GRAPHICS[v].label} onChange={(v) => update(graphicsPatch(v))} />
              <p className="help">{GRAPHICS[g].blurb}</p>
              <p className="help" id="adaptive-note">{g === 'ultra' ? 'Adaptive quality stays on behind Ultra: it turns effects down one at a time when frames run long, and back up when there is room.' : 'Retro keeps its own fixed picture; Adaptive quality only works behind Ultra.'}</p>
              <GovNow game={game} />
            </div>
            <div className="field"><label>Menu theme</label>
              <Seg label="Menu theme" value={settings.theme} options={['auto', 'light', 'dark'] as Theme[]} labels={(v) => ({ auto: 'Auto', light: 'Light', dark: 'Dark' })[v]} onChange={(v) => update({ theme: v })} />
              <p className="help">Auto follows this device. Dark is Midnight, light is Velocity. The menu, the pause screen and Settings take it; the drive's HUD stays as it is.</p>
            </div>
            <Toggle label="Show frame rate" help="A small frame counter on the drive's HUD." value={settings.showFps} onChange={(v) => update({ showFps: v })} />
            <Range label="Field of view" min={-10} max={15} step={1} value={settings.fov} fmt={(v) => (v > 0 ? '+' : '') + v + '°'} onChange={(v) => update({ fov: v })} help="Widens or narrows the driver's view." />
            <Disclosure label="Performance details" id="perf-details">
              <Toggle label="Show performance" help="Frame times and what Adaptive quality is doing, over the drive." value={settings.showPerf} onChange={(v) => update({ showPerf: v })} />
              <BenchHint graphics={g} />
              {inMenu && <div className="row"><button type="button" className="btn" disabled={benching} onClick={runBench}>Run graphics check</button></div>}
              <p className="help">Ultra's draw distance: {QUALITY.ultra.drawDistance / 1000} km; Retro Low's: {QUALITY.low.drawDistance / 1000} km.</p>
            </Disclosure>
          </section>}

          {cur[0] === 'hud' && <section className="sgroup" id="set-hud">
            <div className="field"><label>HUD style</label><Seg label="HUD style" value={settings.hudStyle} options={['modern', 'minimal'] as HudStyle[]} labels={(v) => (v === 'modern' ? 'Modern' : 'Minimal')} onChange={(v) => update({ hudStyle: v })} />
              <p className="help">{settings.hudStyle === 'minimal'
                ? 'Minimal tucks the icons, the map and the road away after 4 s of just driving; a tap, a key or a pad button brings them back. Speed, the guidance and Pause stay.'
                : 'Modern keeps every control on screen; on a phone the road chip shows for 8 s after the road changes.'}</p></div>
            <div className="field"><label>Corner window</label><Seg label="Corner window" value={settings.corner} options={['map', 'sky', 'off']} labels={(c) => (c === 'map' ? 'Road map' : c === 'sky' ? 'Sky camera' : 'Off')} onChange={(c) => update({ corner: c })} />
              <p className="help">The round window in the corner of the drive: the road map, a live sky camera, or nothing.</p></div>
            <div className="field"><label>Corner size</label><Seg label="Corner size" value={String(settings.cornerSize)} options={['0', '1', '2']} labels={(v) => ['Small', 'Medium', 'Large'][Number(v)]} onChange={(v) => update({ cornerSize: Number(v) })} /></div>
            {!coarse && <Toggle label="On-screen pedals (for touch screens)" help="Pedals and a steering pad on screen, for a touch screen with a mouse." value={settings.showTouch} onChange={(v) => update({ showTouch: v })} />}
          </section>}

          {cur[0] === 'world' && <section className="sgroup" id="set-world">
            <div className="field"><label>Time of day</label><Seg label="Time of day" value={settings.time} options={['live', 'sunrise', 'day', 'sunset', 'night'] as TimeOfDay[]} labels={(t) => ({ live: 'Live', sunrise: 'Sunrise', day: 'Day', sunset: 'Sunset', night: 'Night' })[t]} onChange={(t) => update({ time: t })} />
              <p className="help">Live puts the sun where it is over Orange County right now, from this device's clock.</p></div>
            <div className="field"><label>Weather</label><Seg label="Weather" value={settings.weather} options={['clear', 'cloudy', 'rain', 'fog', 'mist', 'changing'] as Weather[]} labels={(w) => ({ clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', fog: 'Fog', mist: 'Mist', changing: 'Changing' })[w]} onChange={(w) => update({ weather: w })} />
              <p className="help">Weather is simulated here (no live weather feed). Rain cuts grip by about a fifth.</p></div>
          </section>}

          {cur[0] === 'driving' && <section className="sgroup" id="set-driving">
            <Handling value={settings.handling} onChange={(h) => update({ handling: h })} />
            <div className="card ultra-real">
              <h4 className="sect">Ultra Realism</h4>
              {game?.ultraOpen ? <>
                <Toggle label="Speed effects" help="The world closes in at speed." value={settings.ultra} onChange={(v) => update({ ultra: v })} />
                {settings.ultra && <div className="sub">
                  <Toggle label="Tunnel vision" help="150+ mph" value={settings.ultraTunnel} onChange={(v) => update({ ultraTunnel: v })} />
                  <Toggle label="Camera shake" help="At high speed" value={settings.ultraShake} onChange={(v) => update({ ultraShake: v })} />
                  <Toggle label="Muffled sound" help="At high speed" value={settings.ultraMuffle} onChange={(v) => update({ ultraMuffle: v })} />
                </div>}
              </> : <p className="help locked">Opens at level 5 (you're level {game ? levelOf(game.profile.p.xp) : 1}).</p>}
            </div>
            {!coarse && <p className="fine keys">Keyboard: W/S or arrows to drive, A/D to steer, Space handbrake, Q/E shift for a moment (then automatic takes over), C view, N map, F ability, B radio, V look back, R reset, P pause. OC Hypercar in Free Drive: tap Left Shift or J (gamepad: D-pad up) to jump over the traffic ahead (Thrust Hop).</p>}
            {coarse && <p className="fine keys">OC Hypercar in Free Drive: tap JUMP (over GAS) to hop over the traffic ahead. The paddles (− and +) hold a gear for a moment, then automatic takes over.</p>}
          </section>}

          {cur[0] === 'sound' && <section className="sgroup" id="set-sound">
            <Toggle label="Radio" value={radioOn} disabled={inMenu || !game} onChange={radioSwitch} help={inMenu ? 'Plays while you drive. In the drive: the radio button or B.' : 'Fictional stations, composed live in code. In the drive: the radio button or B.'} />
            <Range label="Radio volume" min={0} max={1} step={0.05} value={settings.music} fmt={pct} onChange={(v) => update({ music: v })} help="The in-game radio's level." />
            <Range label="Master volume" min={0} max={1} step={0.05} value={settings.master} fmt={pct} onChange={(v) => update({ master: v })} help="Everything at once." />
            <Range label="Engine" min={0} max={1} step={0.05} value={settings.engine} fmt={pct} onChange={(v) => update({ engine: v })} />
            <Range label="Road and wind" min={0} max={1} step={0.05} value={settings.ambient} fmt={pct} onChange={(v) => update({ ambient: v })} />
          </section>}

          {cur[0] === 'testing' && <section className="sgroup" id="set-testing">
            <Toggle label="Owner mode (all cars unlocked, test builds only)" help="Every car in the garage to drive, without credits, a level or a slot." value={settings.owner} onChange={(v) => update({ owner: v })} />
            {testBuild && <p className="fine" id="owner-test-note"><b>This test build turns owner mode on</b> every time it opens, so the OC Hypercar and every other car are ready to drive. Turn it off here for this visit, or open the game with #owner=0 in the address.</p>}
            <p className="fine">Your saved garage, credits and level stay as you earned them. A switch on this device, not a sign-in; opening the game with #owner turns it on.</p>
          </section>}
        </div>
      </div>
      <footer className="set-foot">
        <button type="button" className="set-fb" onClick={onFeedback}>Feedback</button>
        <button type="button" className="btn primary done" onClick={onDone}>Done</button>
      </footer>
    </div>
  );
}
