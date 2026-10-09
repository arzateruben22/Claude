// On-screen controls for phones and tablets: drag the left pad to steer, hold GAS or BRAKE on the right.
// (View, Map, Go to and Pause live in the top bar for every device.)

import { useRef } from 'react';
import type { Input } from '../game/input';

export function Touch({ input, manual, onShift }: { input: Input; manual: boolean; onShift: (d: 1 | -1) => void }) {
  const knob = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: number; x: number } | null>(null);
  input.touch.active = true;
  const steer = (v: number) => { input.touch.steer = v; if (knob.current) knob.current.style.transform = `translateX(${(v * 52).toFixed(1)}px)`; };
  const pedal = (which: 'gas' | 'brake', on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    input.touch[which] = on;
    (e.currentTarget as HTMLElement).classList.toggle('down', on);
    if (on) try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  return (
    <div className="touch">
      <div className="touch-steer"
        onPointerDown={(e) => { e.preventDefault(); start.current = { id: e.pointerId, x: e.clientX }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ } }}
        onPointerMove={(e) => { if (start.current && e.pointerId === start.current.id) steer(Math.max(-1, Math.min(1, (e.clientX - start.current.x) / 70))); }}
        onPointerUp={() => { start.current = null; steer(0); }} onPointerCancel={() => { start.current = null; steer(0); }}
        aria-label="Steering: drag left or right">
        <span className="touch-hint">◀ steer ▶</span>
        <div className="touch-knob" ref={knob} />
      </div>
      <div className="touch-pedals">
        {manual && <div className="touch-shift"><button type="button" className="tbtn" onClick={() => onShift(-1)}>−</button><button type="button" className="tbtn" onClick={() => onShift(1)}>+</button></div>}
        <div className="pedal brake" onPointerDown={pedal('brake', true)} onPointerUp={pedal('brake', false)} onPointerCancel={pedal('brake', false)} role="button" aria-label="Brake">BRAKE</div>
        <div className="pedal gas" onPointerDown={pedal('gas', true)} onPointerUp={pedal('gas', false)} onPointerCancel={pedal('gas', false)} role="button" aria-label="Accelerate">GAS</div>
      </div>
    </div>
  );
}
