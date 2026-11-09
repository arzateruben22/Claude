// The radial quick menu (U3, panel 3 of the owner's concept board). Hold the pause/menu control for 300 ms while
// driving (touch or mouse: press and hold the Pause chip; keyboard: hold Tab; pad: hold Back) and six choices fan out
// around the OC mark: Map, Go to, Garage, Radio, Camera, Settings. Slide onto one and let go to pick it; let go on the
// centre to cancel; let go anywhere else and the menu stays open to tap. Keyboard: the arrows move the highlight, Enter
// picks, Escape (or a fresh Tab) closes. Pad: aim with the right stick or the d-pad and let go of Back. With reduced
// motion it is a plain list in a glass card instead of the fan. The road keeps running underneath, slightly dimmed;
// App.tsx decides what each choice does (Garage and Settings pause the drive).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { OcMark } from './Mark';

export type QuickId = 'map' | 'goto' | 'garage' | 'radio' | 'camera' | 'settings';
export type QuickVia = 'pointer' | 'key' | 'pad';
export interface QuickItem { id: QuickId; label: string; hint: string }
export interface QuickHandle { release: () => void }

// our own line icons, 24 × 24, drawn with a 1.7 stroke (styles.css)
const GEAR = (() => {
  let d = '';
  for (let i = 0; i < 8; i++) {
    ([[-15, 7], [-8, 9.6], [8, 9.6], [15, 7]] as const).forEach(([deg, r], j) => {
      const t = ((i * 45 + deg) * Math.PI) / 180;
      d += (i + j === 0 ? 'M' : 'L') + (12 + r * Math.sin(t)).toFixed(2) + ' ' + (12 - r * Math.cos(t)).toFixed(2);
    });
  }
  return d + 'zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
})();
const ICON: Record<QuickId, string> = {
  map: 'M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13',
  goto: 'M12 20.5s-6-5.6-6-10.2a6 6 0 0 1 12 0c0 4.6-6 10.2-6 10.2zM12 12.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
  garage: 'M3.5 10.5L12 4.5l8.5 6V20h-17zM7 20v-6.5h10V20M7 16.5h10',
  radio: 'M4 9.5h16V20H4zM7.5 9.5L17 4.5M15.5 17.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM7 13.2h3.5M7 16.4h3.5',
  camera: 'M4 8.5h3.2L9 6h6l1.8 2.5H20V19H4zM12 16.6a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2z',
  settings: GEAR,
};
const QuickIcon = ({ id }: { id: QuickId }) => <svg className="quick-ico" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={ICON[id]} /></svg>;

// the wedges, in the ring's own -100..100 space: clockwise from the top, a constant-width gap between them
const RO = 97, RI = 37, GAP = 1.5, LABEL_R = 0.67;
const pt = (r: number, a: number) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
function wedge(k: number, n: number) {
  const a0 = ((k - 0.5) * 2 * Math.PI) / n, a1 = ((k + 0.5) * 2 * Math.PI) / n, go = Math.asin(GAP / RO), gi = Math.asin(GAP / RI);
  return {
    d: `M${pt(RO, a0 + go)}A${RO} ${RO} 0 0 1 ${pt(RO, a1 - go)}L${pt(RI, a1 - gi)}A${RI} ${RI} 0 0 0 ${pt(RI, a0 + gi)}z`,
    edge: `M${pt(RO - 1.5, a0 + go + 0.02)}A${RO - 1.5} ${RO - 1.5} 0 0 1 ${pt(RO - 1.5, a1 - go - 0.02)}`,
    x: LABEL_R * Math.sin((k * 2 * Math.PI) / n), y: -LABEL_R * Math.cos((k * 2 * Math.PI) / n),
  };
}
// which wedge a direction points at (x right, y down), clockwise from the top
const sector = (x: number, y: number, n: number) => (Math.round((Math.atan2(x, -y) / (2 * Math.PI)) * n) + n) % n;

export const Radial = forwardRef<QuickHandle, {
  via: QuickVia;
  pointer: number | null;                       // the pointer still held down on the chip, for a press-and-slide
  held: () => boolean;                          // whether that pointer is still down (it may have let go as the menu opened)
  reduced: boolean;                             // reduced motion: a list, not the fan
  items: QuickItem[];
  aim: () => { x: number; y: number } | undefined;   // the pad's right stick or d-pad
  onPick: (id: QuickId) => void;
  onClose: () => void;
}>(function Radial({ via, pointer, held, reduced, items, aim, onPick, onClose }, ref) {
  const n = items.length;
  // what's highlighted: a wedge (its index), the centre (-1) or nothing (null). The keyboard starts on the first choice.
  const [sel, setSel] = useState<number | null>(via === 'key' ? 0 : via === 'pad' ? -1 : null);
  const [drag, setDrag] = useState(() => via === 'pointer' && pointer !== null && held());
  const selRef = useRef(sel);
  selRef.current = sel;
  const cb = useRef({ onPick, onClose, items, aim });
  cb.current = { onPick, onClose, items, aim };
  const root = useRef<HTMLDivElement>(null), menu = useRef<HTMLDivElement>(null);
  const item = (k: number) => menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[k];

  const pick = (k: number | null) => {
    if (k === null) return;
    if (k < 0) cb.current.onClose(); else cb.current.onPick(cb.current.items[k].id);
  };
  useImperativeHandle(ref, () => ({ release: () => pick(selRef.current ?? -1) }), []);
  // what lies under a point: a wedge or a row (data-k), the centre (-1), or nothing of the menu (null)
  const hit = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-k]');
    return el && root.current?.contains(el) ? Number(el.dataset.k) : null;
  };

  // focus: the keyboard lands on the first choice; otherwise the menu itself takes focus, so the keys work from there
  useEffect(() => {
    if (via === 'key') item(0)?.focus({ preventScroll: true });
    else menu.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // press and slide: the highlight follows the finger or the mouse; letting go picks, cancels on the centre, or leaves
  // the menu open to tap when it's let go of somewhere else. A mouse over the open menu highlights what it's over.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag ? e.pointerId === pointer : via === 'pointer' && e.pointerType !== 'touch') setSel(hit(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== pointer) return;
      const k = hit(e.clientX, e.clientY);
      if (k === null) { setDrag(false); setSel(null); } else pick(k);
    };
    const cancel = (e: PointerEvent) => { if (drag && e.pointerId === pointer) { setDrag(false); setSel(null); } };
    // once it's open to tap, a press anywhere outside it closes it (and still does what it does there: a pedal still
    // presses). The Pause chip is left to App, where a tap on it closes the menu.
    const down = (e: PointerEvent) => {
      if (drag) return;
      const t = e.target instanceof Element ? e.target : null;
      if (!t?.closest('.quick-hit, .tbtn.menu')) cb.current.onClose();
    };
    addEventListener('pointermove', move, true);
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', cancel, true);
    addEventListener('pointerdown', down, true);
    return () => {
      removeEventListener('pointermove', move, true);
      removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', cancel, true);
      removeEventListener('pointerdown', down, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, pointer, via]);

  // the keys, ahead of the game's own (the arrows would steer, Escape would pause, Space would pull the handbrake)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = selRef.current;
      let next: number | undefined;
      switch (e.code) {
        case 'ArrowRight': case 'ArrowDown': next = k === null || k < 0 ? 0 : (k + 1) % n; break;
        case 'ArrowLeft': case 'ArrowUp': next = k === null || k < 0 ? n - 1 : (k - 1 + n) % n; break;
        case 'Home': next = 0; break;
        case 'End': next = n - 1; break;
        case 'Enter': case 'NumpadEnter': case 'Space': if (!e.repeat) pick(k ?? -1); break;
        case 'Escape': cb.current.onClose(); break;
        case 'Tab': if (!e.repeat) cb.current.onClose(); break;     // the Tab that opened it repeats; a fresh one leaves
        default: return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (next !== undefined) { setSel(next); item(next)?.focus({ preventScroll: true }); }
    };
    addEventListener('keydown', key, true);
    return () => removeEventListener('keydown', key, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // the pad: the stick's direction picks the wedge (at rest it's the centre, so letting go of Back cancels); in the list,
  // up and down step through it
  useEffect(() => {
    if (via !== 'pad') return;
    let raf = 0, stepped = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const a = cb.current.aim();
      if (!a) return;
      if (reduced) {
        if (Math.abs(a.y) < 0.3) { stepped = false; return; }
        if (Math.abs(a.y) > 0.6 && !stepped) {
          stepped = true;
          const k = selRef.current ?? -1;
          setSel(a.y > 0 ? (k < 0 ? 0 : (k + 1) % n) : k < 0 ? n - 1 : (k - 1 + n) % n);
        }
        return;
      }
      const m = Math.hypot(a.x, a.y);
      if (m > 0.5) setSel(sector(a.x, a.y, n)); else if (m < 0.25) setSel(-1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [via, reduced, n]);

  const hint = sel === -1 ? (drag || via === 'pad' ? 'Let go here to cancel' : 'Close the menu')
    : sel !== null ? items[sel].hint
    : via === 'pad' ? 'Aim with the right stick, then let go of Back'
    : drag ? 'Slide onto a choice and let go' : 'Tap a choice, or the centre to close';
  const how = via === 'key' ? 'Arrows choose · Enter picks · Esc closes' : via === 'pad' ? 'Stick or d-pad chooses · let go of Back' : drag ? 'Slide onto a choice and let go' : 'Tap a choice';
  const descs = items.map((it) => <span key={it.id} id={'quick-d-' + it.id} hidden>{it.hint}</span>);
  const itemProps = (it: QuickItem, k: number) => ({
    type: 'button' as const, role: 'menuitem', 'data-k': k, tabIndex: sel === k ? 0 : -1, 'aria-describedby': 'quick-d-' + it.id,
    onClick: () => pick(k), onFocus: () => { if (via === 'key') setSel(k); },
  });

  if (reduced) {
    return (
      <div className="quick list" ref={root}>
        <div className="quick-card quick-hit">
          <div className="quick-head"><OcMark size="sm" /><div><b>Quick menu</b><small aria-hidden="true">{how}</small></div></div>
          <div className="quick-rows" role="menu" aria-label="Quick menu" tabIndex={-1} ref={menu}>
            {items.map((it, k) => (
              <button key={it.id} className={'quick-row' + (sel === k ? ' on' : '')} {...itemProps(it, k)}>
                <QuickIcon id={it.id} /><b>{it.label}</b><small aria-hidden="true">{it.hint}</small>
              </button>
            ))}
          </div>
          <div className="quick-foot">
            <button type="button" className={'btn quick-close' + (sel === -1 ? ' on' : '')} data-k={-1} aria-label="Close quick menu" onClick={() => pick(-1)}>Close</button>
          </div>
          {descs}
        </div>
      </div>
    );
  }
  return (
    <div className="quick" ref={root}>
      <div className="quick-ring">
        <svg className="quick-wedges" viewBox="-100 -100 200 200" aria-hidden="true">
          {/* the chosen wedge's glass, lit from its rim (styles.css sets the colours) */}
          <defs><radialGradient id="quick-lit" gradientUnits="userSpaceOnUse" cx="0" cy="0" r={RO}><stop className="quick-lit-in" offset={RI / RO} /><stop className="quick-lit-out" offset="1" /></radialGradient></defs>
          <circle className="quick-base quick-hit" r={RO} />
          {items.map((it, k) => {
            const w = wedge(k, n);
            return (
              <g key={it.id} className={'quick-wedge' + (sel === k ? ' on' : '')} style={{ '--k': k } as CSSProperties}>
                <path className="quick-hit" d={w.d} data-k={k} onClick={() => pick(k)} />
                <path className="quick-edge" d={w.edge} />
              </g>
            );
          })}
        </svg>
        <div className="quick-items" role="menu" aria-label="Quick menu" tabIndex={-1} ref={menu}>
          {items.map((it, k) => {
            const w = wedge(k, n);
            return (
              <button key={it.id} className={'quick-item quick-hit' + (sel === k ? ' on' : '')} style={{ '--x': w.x, '--y': w.y, '--k': k } as CSSProperties} {...itemProps(it, k)}>
                <QuickIcon id={it.id} /><span>{it.label}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className={'quick-core quick-hit' + (sel === -1 ? ' on' : '')} data-k={-1} aria-label="Close quick menu" onClick={() => pick(-1)}>
          <OcMark size="sm" /><small aria-hidden="true">{drag || via === 'pad' ? 'Cancel' : 'Close'}</small>
        </button>
      </div>
      <p className="quick-hint" aria-hidden="true">{hint}</p>
      {descs}
    </div>
  );
});
