// The radio card (U7): a compact panel beside the controls while driving; the drive carries on behind it. Now playing
// (the station's call sign and frequency, and a title for what is on, generated from the station and the time: the
// music is composed live in code, so the title is too), the three stations to tune directly, a star for favourites
// (kept on this device), the radio's volume, and Off. Nothing is recorded, licensed or streamed.
import { useState } from 'react';
import type { Game } from '../game/Game';
import type { Settings } from '../game/settings';
import { STATIONS } from '../game/audio/Radio';

const WORDS: Record<string, [string[], string[]]> = {
  pads: [['Low Tide', 'Crystal Cove', 'Blue Hour', 'Salt Air', 'Marine Layer', 'Night Swim'], ['Drift', 'Study', 'Loop', 'Reprise', 'Theme', 'Glow']],
  synthwave: [['Carpool Lane', 'Interchange', 'Overpass', 'Toll Road', 'Night Shift', 'Red Line'], ['Run', 'Rush', 'Signal', 'Pursuit', 'Nights', 'Dash']],
  lofi: [['Canyon Road', 'Back Porch', 'Orange Grove', 'Dust', 'Slow Burn', 'Mesa'], ['Tape', 'Sketch', 'Walk', 'Hours', 'Notes', 'Mood']],
};
// a title for what is on: the same for three minutes on a station, then the next
function title(i: number) {
  const st = STATIONS[i], [a, b] = WORDS[st.style], n = Math.floor(Date.now() / 180000) + i * 7;
  return `${a[n % a.length]} ${b[(n * 5 + 3) % b.length]}`;
}

export function RadioCard({ game, settings, update, onClose }: { game: Game; settings: Settings; update: (p: Partial<Settings>) => void; onClose: () => void }) {
  const [, bump] = useState(0);
  const on = game.radio.station, cur = game.radio.current;
  const tune = (i: number) => { game.tuneRadio(i); bump((n) => n + 1); };
  const fav = (id: string) => update({ radioFavs: settings.radioFavs.includes(id) ? settings.radioFavs.filter((x) => x !== id) : [...settings.radioFavs, id] });
  const order = [...STATIONS.keys()].sort((a, b) => Number(settings.radioFavs.includes(STATIONS[b].id)) - Number(settings.radioFavs.includes(STATIONS[a].id)));
  return (
    <section className="radio-card" aria-label="Radio">
      <div className={'rc-now' + (cur ? ' ' + cur.style : ' off')}>
        <div className="rc-art" aria-hidden="true"><b>{cur ? cur.call : 'OFF'}</b><span>{cur ? cur.freq : '—'}</span>{cur && <i className="rc-eq"><em /><em /><em /><em /></i>}</div>
        <div className="rc-meta">
          <small>{cur ? 'Now playing' : 'Radio off'}</small>
          <b>{cur ? title(on) : 'Pick a station'}</b>
          <span>{cur ? `${cur.name} · ${cur.freq} FM` : 'Three stations, composed live in code'}</span>
        </div>
      </div>
      <ul className="rc-list">
        {order.map((i) => {
          const st = STATIONS[i], starred = settings.radioFavs.includes(st.id);
          return (
            <li key={st.id} className={on === i ? 'on' : ''}>
              <button type="button" className="rc-tune" aria-pressed={on === i} onClick={() => tune(on === i ? -1 : i)}><b>{st.call}</b><span>{st.freq}</span><em>{st.name}</em></button>
              <button type="button" className={'rc-star' + (starred ? ' on' : '')} aria-pressed={starred} aria-label={`${starred ? 'Unstar' : 'Star'} ${st.name}`} onClick={() => fav(st.id)}>★</button>
            </li>
          );
        })}
      </ul>
      <label className="rc-vol"><span>Volume</span><input type="range" min={0} max={1} step={0.05} value={settings.music} aria-label="Radio volume" onChange={(e) => update({ music: Number(e.target.value) })} style={{ '--v': `${(settings.music * 100).toFixed(0)}%` } as React.CSSProperties} /></label>
      <div className="rc-foot">
        <button type="button" className="btn" onClick={() => tune(-1)} disabled={on < 0}>Off</button>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
      <p className="fine">Fictional stations; the music is composed live in code. Nothing is recorded, licensed or streamed.</p>
    </section>
  );
}
