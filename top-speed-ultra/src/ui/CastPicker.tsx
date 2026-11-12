// The character picker (owner, 2026-11-11): six cards (three men, three women) with each character's portrait (the
// three-quarter smile cropped from the owner's face sheet), and a live 3D turntable of the one selected (castStage.ts,
// the in-game build of that character). Choosing saves Settings.character; from then on the character is the driver
// everywhere: the cockpit's arms and the on-foot avatar in both venues. The six are cosmetic: no gameplay difference.
// Until the player chooses, the game keeps the old look (a saved presentation and skin tone); the picker opens on the
// character closest to it (cast.ts closestCharacter).
import { useEffect, useRef, useState } from 'react';
import { CAST, castById, closestCharacter, CastId, CAST_PACK } from '../onfoot/cast';
import { SKINS } from '../game/drivers';
import type { Settings } from '../game/settings';
import type { Stage } from './castStage';
import mateo from './assets/cast/mateo-reyes.webp';
import danny from './assets/cast/danny-tran.webp';
import marcus from './assets/cast/marcus-bell.webp';
import leila from './assets/cast/leila-farahani.webp';
import jas from './assets/cast/jas-cruz.webp';
import kate from './assets/cast/kate-morgan.webp';

export const PORTRAITS: Record<CastId, string> = { 'mateo-reyes': mateo, 'danny-tran': danny, 'marcus-bell': marcus, 'leila-farahani': leila, 'jas-cruz': jas, 'kate-morgan': kate };

declare global { interface Window { __castStage?: Stage['state'] } }

export function CastPicker({ settings, update, onClose }: { settings: Settings; update: (p: Partial<Settings>) => void; onClose: () => void }) {
  const chosen = castById(settings.character);
  const closest = closestCharacter(settings.presentation, SKINS[Math.max(0, Math.min(SKINS.length - 1, settings.skin))]);
  const [sel, setSel] = useState<CastId>(chosen?.id ?? closest);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let dead = false;
    const quality = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'phone' : 'high';
    import('./castStage').then(({ castStage }) => {
      if (dead || !canvas.current) return;
      try { stage.current = castStage(canvas.current, quality); stage.current.show(sel); window.__castStage = stage.current.state; } catch (e) { setErr(String((e as Error)?.message ?? e)); }
    }, (e) => setErr(String(e)));
    return () => { dead = true; stage.current?.dispose(); stage.current = null; delete window.__castStage; };
    // (the stage is made once; show() follows the selection below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { stage.current?.show(sel); }, [sel]);
  const c = castById(sel)!;
  return <>
    <h2>Character</h2>
    <p className="fine">Six drivers to choose from. Who you pick is who you see on the wheel, in the seat and on foot at Lot 57 and Stoppage Time. Looks only: every character drives the same.</p>
    <div className="cast-pick">
      <figure className="cast-stage">
        <canvas ref={canvas} aria-label={`${c.name}, turning`} />
        <figcaption><b>{c.name}</b><span>{c.age} · {c.heightCm} cm · {c.build}</span><span>{c.from}</span>{err && <span className="fine">The 3D view couldn't start here ({err}).</span>}</figcaption>
      </figure>
      <div className="cast-grid" role="radiogroup" aria-label="Character">
        {CAST.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={sel === x.id} className={'cast-card' + (sel === x.id ? ' on' : '') + (chosen?.id === x.id ? ' mine' : '')} onClick={() => setSel(x.id)}>
            <img src={PORTRAITS[x.id]} alt="" width={160} height={200} />
            <b>{x.name}</b>
            <small>{x.age} · {x.heightCm} cm</small>
            {chosen?.id === x.id && <em>Driving now</em>}
            {!chosen && closest === x.id && <em>Closest to your look</em>}
          </button>
        ))}
      </div>
    </div>
    <p className="fine">Real-time 3D on your device: stylised, not a photograph. {CAST_PACK.identities.length === 0 ? 'More characters may come later as a cosmetic pack; nothing is on sale yet.' : ''}</p>
    <div className="row">
      <button className="btn primary" disabled={chosen?.id === sel} onClick={() => { update({ character: sel, presentation: c.presentation }); onClose(); }}>{chosen?.id === sel ? `${c.first} is driving` : `Drive as ${c.first}`}</button>
      <button className="btn" onClick={onClose}>Back</button>
    </div>
  </>;
}
