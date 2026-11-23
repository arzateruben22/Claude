// On-screen controls for phones and tablets: drag the left pad to steer, hold GAS or BRAKE on the right.
// (Pause lives in the top bar; on a phone View and Go to are in its hold-Pause quick menu, App.tsx.)
//
// The handbrake (owner, 2026-11-17: "how do you drift on mobile device?"; then the new HUD, 2026-11-23: "this will be
// the new layout design", "and the brake will slide into the red brake to drift as you stated"): a ROUND HANDBRAKE
// button between the steering pad and BRAKE, in both looks (hud-layout.css places it, hud-retro.css / hud-ultra.css skin
// it). Two ways to pull it: hold BRAKE and slide toward the steering side, into the button (past PULL_PX; the brake lets
// go once it is a pull, and sliding back inside RELEASE_PX or lifting releases it), or press the button itself (pulled
// while held). A plain BRAKE tap never pulls it. Input.touch.handbrake carries it (game/input.ts keeps a touch pull for
// TOUCH_HB_HOLD after the lift, so the same thumb can be back on GAS); the button's red arc fills on the pull and drains
// over that same hold; a short vibration, where the device has one, marks the pull.

import { useEffect, useRef } from 'react';
import { TOUCH_HB_HOLD, type Input } from '../game/input';
import { Ico } from './Icons';

export const PULL_PX = 18;      // how far toward the steering side a thumb must slide from BRAKE to pull (a tap or a nudge doesn't)
export const RELEASE_PX = 10;   // back inside this and it lets go (so a thumb resting at the line doesn't flutter)

export function Touch({ input, manual, onShift }: { input: Input; manual: boolean; onShift: (d: 1 | -1) => void }) {
  const knob = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: number; x: number } | null>(null);
  const hbBtn = useRef<HTMLDivElement>(null), brake = useRef<HTMLDivElement>(null);
  // the two things that can hold the handbrake: a slide that began on BRAKE, and a thumb on the round button itself
  const slideRef = useRef<{ id: number; x: number; y: number; swiped: boolean; on: boolean } | null>(null);
  const press = useRef<number | null>(null);
  input.touch.active = true;
  useEffect(() => () => { input.touch.handbrake = false; }, [input]);
  const steer = (v: number) => { input.touch.steer = v; if (knob.current) knob.current.style.transform = `translateX(${(v * 52).toFixed(1)}px)`; };
  const pedal = (which: 'gas' | 'brake', on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    input.touch[which] = on;
    (e.currentTarget as HTMLElement).classList.toggle('down', on);
    if (on) try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* fine */ }
  };

  // the pull: on while either source holds it
  const sync = () => {
    const on = press.current !== null || !!slideRef.current?.on;
    if (input.touch.handbrake === on) return;
    input.touch.handbrake = on;
    hbBtn.current?.classList.toggle('pulled', on);
    if (on) { try { navigator.vibrate?.(16); } catch { /* no haptics here */ } }
  };

  // the round button: pulled while a thumb is on it
  const hbDown = (e: React.PointerEvent) => {
    e.preventDefault();
    press.current = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ }
    sync();
  };
  const hbUp = (e: React.PointerEvent) => { if (press.current === e.pointerId) { press.current = null; sync(); } };

  // BRAKE: a slide toward the steering side (mostly sideways) becomes a pull; the brake lets go then
  const brakeDown = (e: React.PointerEvent) => {
    pedal('brake', true)(e);
    slideRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, swiped: false, on: false };
  };
  const brakeMove = (e: React.PointerEvent) => {
    const d = slideRef.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, pull = Math.max(0, -dx);
    if (!d.swiped && pull >= PULL_PX && pull >= 1.5 * Math.abs(dy)) {
      d.swiped = true; input.touch.brake = false; brake.current?.classList.remove('down');
    }
    if (!d.swiped) return;
    if (!d.on && pull >= PULL_PX) d.on = true;
    else if (d.on && pull < RELEASE_PX) d.on = false;
    sync();
  };
  const brakeUp = (e: React.PointerEvent) => {
    if (slideRef.current?.id === e.pointerId) slideRef.current = null;
    sync(); pedal('brake', false)(e);
  };

  return (
    <div className="touch">
      <div className="touch-steer"
        onPointerDown={(e) => { e.preventDefault(); start.current = { id: e.pointerId, x: e.clientX }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ } }}
        onPointerMove={(e) => { if (start.current && e.pointerId === start.current.id) steer(Math.max(-1, Math.min(1, (e.clientX - start.current.x) / 70))); }}
        onPointerUp={() => { start.current = null; steer(0); }} onPointerCancel={() => { start.current = null; steer(0); }}
        aria-label="Steering: drag left or right">
        <span className="touch-hint">◀ steer ▶</span>
        <span className="touch-rod" aria-hidden="true" />
        <div className="touch-knob" ref={knob} />
      </div>
      <div className="touch-pedals">
        {manual && <div className="touch-shift"><button type="button" className="tbtn" onClick={() => onShift(-1)}>−</button><button type="button" className="tbtn" onClick={() => onShift(1)}>+</button></div>}
        <div className="brake-wrap">
          <div className="hb-round" ref={hbBtn} role="button" aria-label="Handbrake: hold it, or slide from BRAKE into it"
            style={{ '--hb-hold': `${Math.round(TOUCH_HB_HOLD * 1000)}ms` } as React.CSSProperties}
            onPointerDown={hbDown} onPointerUp={hbUp} onPointerCancel={hbUp} onLostPointerCapture={hbUp}
            onContextMenu={(e) => e.preventDefault()}>
            <small className="hb-cap" aria-hidden="true">Handbrake</small>
            <span className="hb-dial" aria-hidden="true">
              <svg className="hb-ring" viewBox="0 0 56 56"><circle className="hb-track" cx="28" cy="28" r="25" /><circle className="hb-arc" cx="28" cy="28" r="25" pathLength={100} /></svg>
              <span className="hb-face"><Ico name="park" /></span>
            </span>
          </div>
          <div className="pedal brake" ref={brake} onPointerDown={brakeDown} onPointerMove={brakeMove} onPointerUp={brakeUp} onPointerCancel={brakeUp} role="button"
            aria-label="Brake (slide into HANDBRAKE to pull the handbrake)"><Ico name="disc" /><span>BRAKE</span></div>
        </div>
        <div className="pedal gas" onPointerDown={pedal('gas', true)} onPointerUp={pedal('gas', false)} onPointerCancel={pedal('gas', false)} role="button" aria-label="Accelerate"><Ico name="speed" /><span>GAS</span></div>
      </div>
    </div>
  );
}
