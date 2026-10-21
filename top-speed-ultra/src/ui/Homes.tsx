// Lifestyle: homes (owner 2026-10-21, the life half's first piece). Nine fictional homes in real OC neighbourhoods,
// bought with credits earned by driving (never real money). Owning one adds garage slots and a place to start from:
// the nearest real exit to it. The one you live in is marked; "Start here" sets the menu's start to its exit.
import { useState } from 'react';
import type { Game } from '../game/Game';
import { HOMES, homeXZ, garageSlots, type Home } from '../game/homes';
import { levelOf } from '../game/profile';
import { Ico } from './Icons';

interface Props { game: Game; onClose: () => void; onStart: (exitKey: string) => void; onMap: (h: Home) => void }

export function Homes({ game, onClose, onStart, onMap }: Props) {
  const book = game.profile;
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');
  const p = book.p, level = levelOf(p.xp), slots = garageSlots(level, p.homes);
  const act = (fn: () => string | null, ok: string) => { const e = fn(); setMsg(e ?? ok); bump((n) => n + 1); };
  const exitOf = (h: Home) => { const { x, z } = homeXZ(h); return game.nearestExit(x, z); };
  return (
    <div className="overlay center">
      <div className="panel wide homes">
        <h2>Lifestyle</h2>
        <p className="fine">{Math.floor(p.credits).toLocaleString()} credits · {p.homes.length} of {HOMES.length} homes · {slots} garage {slots === 1 ? 'slot' : 'slots'}. Homes are bought with credits earned by driving; nothing here costs real money. The homes are our own; the neighbourhoods are real.</p>
        {msg && <p className="good" role="status">{msg}</p>}
        <ul className="home-list">
          {HOMES.map((h) => {
            const owned = p.homes.includes(h.id), live = p.home === h.id, locked = level < h.level, ex = exitOf(h);
            return (
              <li key={h.id} className={'home-card' + (owned ? ' owned' : '') + (live ? ' live' : '') + (locked && !owned ? ' locked' : '')}>
                <div className="home-art" data-style={h.style} aria-hidden="true"><Ico name="home" /></div>
                <div className="home-body">
                  <p className="home-head"><b>{h.name}</b><span>{h.area}</span>{live && <em className="chip">You live here</em>}</p>
                  <p className="home-blurb">{h.blurb}</p>
                  <p className="home-facts">
                    <span>+{h.slots} garage {h.slots === 1 ? 'slot' : 'slots'}</span>
                    {ex && <span>Nearest exit: {ex.exit.text} · {ex.label} · {(ex.dist / 1609.344).toFixed(1)} mi</span>}
                    {!owned && <span>{h.price.toLocaleString()} credits{locked ? ` · opens at level ${h.level}` : ''}</span>}
                  </p>
                  <div className="row home-actions">
                    {!owned && <button className="btn primary" disabled={locked} onClick={() => act(() => book.buyHome(h.id), `${h.name} is yours`)}>Buy · {h.price.toLocaleString()}</button>}
                    {owned && !live && <button className="btn" onClick={() => act(() => { book.setHome(h.id); return null; }, `You live at ${h.name} now`)}>Live here</button>}
                    {owned && ex && <button className="btn" onClick={() => onStart(ex.exit.key)}>Start here</button>}
                    <button className="btn ghost" onClick={() => onMap(h)}>On the map</button>
                    {owned && <button className="btn ghost" onClick={() => act(() => book.sellHome(h.id), `${h.name} sold for ${Math.round(h.price * 0.6).toLocaleString()} credits`)}>Sell · {Math.round(h.price * 0.6).toLocaleString()}</button>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="row"><button className="btn primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
