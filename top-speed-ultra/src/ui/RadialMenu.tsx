// The radial quick menu (U3 in PROJECT_OC_UI_TARGET.md): hold the Pause button (or hold Tab) for 300 ms while driving
// and seven wedges open round the middle of the screen; slide to one and let go to pick it, let go in the middle to
// cancel. A quick tap on Pause still pauses. Keyboard: while it is open, the arrow keys move between wedges and Enter
// picks. Reduced motion: it opens without the fan-out. The Online wedge opens the live panel (an alpha: who's driving
// on the server, the board, an invite) over the paused drive.
import { useEffect, useRef, useState } from 'react';
import { Ico } from './Icons';

export type RadialPick = 'map' | 'nav' | 'garage' | 'radio' | 'camera' | 'settings' | 'live';
const WEDGES: { id: RadialPick; name: string; icon: Parameters<typeof Ico>[0]['name'] }[] = [
  { id: 'map', name: 'Map', icon: 'map' }, { id: 'nav', name: 'Go to', icon: 'nav' }, { id: 'garage', name: 'Garage', icon: 'garage' },
  { id: 'live', name: 'Online', icon: 'online' }, { id: 'settings', name: 'Settings', icon: 'settings' }, { id: 'camera', name: 'Camera', icon: 'camera' },
  { id: 'radio', name: 'Radio', icon: 'radio' },
];
const R = 132;   // the wedges' radius, CSS px

export function RadialMenu({ at, onPick, onCancel }: { at: { x: number; y: number }; onPick: (p: RadialPick) => void; onCancel: () => void }) {
  const [hot, setHot] = useState<number>(-1);
  const hotRef = useRef(-1); hotRef.current = hot;
  // which wedge a point is over: by its angle from the centre, none within 40 px of it
  const wedgeAt = (x: number, y: number) => {
    const dx = x - at.x, dy = y - at.y; if (Math.hypot(dx, dy) < 40) return -1;
    const a = (Math.atan2(dy, dx) + Math.PI * 2 + Math.PI / 2 + Math.PI / WEDGES.length) % (Math.PI * 2);   // 0 at the top, clockwise
    return Math.floor(a / ((Math.PI * 2) / WEDGES.length)) % WEDGES.length;
  };
  useEffect(() => {
    const move = (e: PointerEvent) => setHot(wedgeAt(e.clientX, e.clientY));
    const up = () => { const h = hotRef.current; if (h >= 0) onPick(WEDGES[h].id); else onCancel(); };
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { e.preventDefault(); setHot((h) => (h + 1) % WEDGES.length); }
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { e.preventDefault(); setHot((h) => (h + WEDGES.length - 1) % WEDGES.length); }
      else if (e.code === 'Enter') { e.preventDefault(); const h = hotRef.current; if (h >= 0) onPick(WEDGES[h].id); }
    };
    const keyUp = (e: KeyboardEvent) => { if (e.code === 'Tab') { e.preventDefault(); up(); } };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('keydown', key, true); addEventListener('keyup', keyUp, true);
    return () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('keydown', key, true); removeEventListener('keyup', keyUp, true); };
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
