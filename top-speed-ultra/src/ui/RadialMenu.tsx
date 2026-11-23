// The radial quick menu (U3 in PROJECT_OC_UI_TARGET.md): hold the Pause button (or hold Tab) for 300 ms while driving
// and six wedges open round the middle of the screen; slide to one and let go to pick it, let go in the middle to
// cancel. A quick tap on Pause still pauses. Keyboard: while it is open, the arrow keys move between wedges and Enter
// picks. Reduced motion: it opens without the fan-out.
import { useEffect, useRef, useState } from 'react';
import { Ico } from './Icons';

export type RadialPick = 'map' | 'nav' | 'garage' | 'radio' | 'camera' | 'settings' | 'auto';
type Wedge = { id: RadialPick; name: string; icon: Parameters<typeof Ico>[0]['name'] };
const SIX: Wedge[] = [
  { id: 'map', name: 'Map', icon: 'map' }, { id: 'nav', name: 'Go to', icon: 'nav' }, { id: 'garage', name: 'Garage', icon: 'garage' },
  { id: 'settings', name: 'Settings', icon: 'settings' }, { id: 'camera', name: 'Camera', icon: 'camera' }, { id: 'radio', name: 'Radio', icon: 'radio' },
];
// with a route in Free Drive, a seventh wedge turns Auto-drive on or off (App passes `auto`: null when not offered)
const WITH_AUTO = (on: boolean): Wedge[] => [...SIX.slice(0, 2), { id: 'auto', name: on ? 'Auto-drive off' : 'Auto-drive', icon: 'auto' }, ...SIX.slice(2)];
const R = 132;   // the wedges' radius, CSS px

export function RadialMenu({ at, auto = null, onPick, onCancel }: { at: { x: number; y: number }; auto?: boolean | null; onPick: (p: RadialPick) => void; onCancel: () => void }) {
  const WEDGES = auto === null ? SIX : WITH_AUTO(auto);
  const [hot, setHot] = useState<number>(-1);
  const hotRef = useRef(-1); hotRef.current = hot;
  // which wedge a point is over: by its angle from the centre, none within 40 px of it
  const wedgeAt = (x: number, y: number) => {
    const dx = x - at.x, dy = y - at.y; if (Math.hypot(dx, dy) < 40) return -1;
    const a = (Math.atan2(dy, dx) + Math.PI * 2 + Math.PI / 2 + Math.PI / WEDGES.length) % (Math.PI * 2);   // 0 at the top, clockwise
    return Math.floor(a / ((Math.PI * 2) / WEDGES.length)) % WEDGES.length;
  };
  useEffect(() => {
    // (a lift where the finger came down, with no slide since the menu opened, cancels: the hold on Pause lifts far from
    // the menu's centre and must not pick whatever wedge lies under it; judge, 2026-11-23)
    // (a fresh press after the menu opened, a tap on a wedge, counts as a slide: the hold's own press came before it)
    let moved = false;
    const move = (e: PointerEvent) => { moved = true; setHot(wedgeAt(e.clientX, e.clientY)); };
    const down = () => { moved = true; };
    // Let go: the wedge under the finger or pointer right now. (Not the highlighted one: a tap or a click lands on a wedge in the
    // same moment the pointer enters it, before the highlight has rendered, and a quick tap on Radio would read as "the middle".)
    // The Tab key's release has no point, so it takes the highlighted wedge.
    const up = (e?: PointerEvent) => {
      const h = !e ? hotRef.current : !moved ? -1 : (e.clientX || e.clientY) ? wedgeAt(e.clientX, e.clientY) : hotRef.current;
      if (h >= 0) onPick(WEDGES[h].id); else onCancel();
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { e.preventDefault(); setHot((h) => (h + 1) % WEDGES.length); }
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { e.preventDefault(); setHot((h) => (h + WEDGES.length - 1) % WEDGES.length); }
      else if (e.code === 'Enter') { e.preventDefault(); const h = hotRef.current; if (h >= 0) onPick(WEDGES[h].id); }
    };
    const keyUp = (e: KeyboardEvent) => { if (e.code === 'Tab') { e.preventDefault(); up(); } };
    addEventListener('pointermove', move); addEventListener('pointerdown', down); addEventListener('pointerup', up); addEventListener('keydown', key, true); addEventListener('keyup', keyUp, true);
    return () => { removeEventListener('pointermove', move); removeEventListener('pointerdown', down); removeEventListener('pointerup', up); removeEventListener('keydown', key, true); removeEventListener('keyup', keyUp, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at.x, at.y]);
  return (
    <div className="radial" role="menu" aria-label="Quick menu" style={{ left: at.x, top: at.y }}>
      <span className="radial-hub" aria-hidden="true">{hot >= 0 ? WEDGES[hot].name : 'Quick menu'}</span>
      {WEDGES.map((w, i) => {
        const a = (i / WEDGES.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <button key={w.id} type="button" role="menuitem" className={'radial-w' + (hot === i ? ' on' : '')} style={{ '--x': `${Math.cos(a) * R}px`, '--y': `${Math.sin(a) * R}px`, '--i': i } as React.CSSProperties}
            onPointerEnter={() => setHot(i)} onClick={() => onPick(w.id)}>
            <Ico name={w.icon} /><span>{w.name}</span>
          </button>
        );
      })}
    </div>
  );
}
