// On-screen controls for phones and tablets: drag the left pad to steer, hold GAS or BRAKE on the right.
// (View, Map, Go to and Pause live in the top bar for every device.)
//
// The handbrake is part of the BRAKE pedal (owner, 2026-11-17: "how do you drift on mobile device?", then "something
// more seamlessly integrated"): a lever-shaped tab on the pedal's inner edge, the side that faces the steering pad. Slide
// it toward the steering side to pull the handbrake; a quick swipe from BRAKE toward the pad does the same. A tap on
// either does nothing but brake (on BRAKE) or nothing at all (on the lever): a pull needs a deliberate PULL_PX slide, and
// it lets go once the thumb comes back inside RELEASE_PX or lifts. The lever and the pedal are one piece of the cluster:
// the pedals' own slanted slab and ember hairline, no separate button. Input.touch.handbrake carries it (game/input.ts
// keeps a flick down for a moment so the same thumb can be back on GAS); a short vibration, where the device has one,
// and the pulled state (the grip slides in and fills ember) are the feedback.
//
// The Retro look (owner, 2026-11-23: "this will be the new layout design for retro look", then "and the brake will
// slide into the red brake to drift as you stated"; App passes `retro`, hud-retro.css skins it) swaps the lever for a
// ROUND HANDBRAKE button between the steering pad and BRAKE: the same slide from BRAKE toward the steering side (past
// PULL_PX, so the thumb runs into the button) pulls it, sliding back inside RELEASE_PX or lifting lets go, and pressing
// the button itself pulls it while held. Its red arc fills on the pull and drains over the 0.22 s the input layer keeps
// a touch pull held after the lift (TOUCH_HB_HOLD). A plain BRAKE tap never pulls it. BRAKE and GAS get their icons.

import { useEffect, useRef } from 'react';
import { TOUCH_HB_HOLD, type Input } from '../game/input';
import { Ico } from './Icons';

export const PULL_PX = 18;      // how far toward the steering side a thumb must slide to pull (a tap or a nudge doesn't)
export const RELEASE_PX = 10;   // back inside this and it lets go (so a thumb resting at the line doesn't flutter)
const GRIP_PX = 14;             // how far the lever's grip travels on screen (the thumb may go further)

export function Touch({ input, manual, onShift, retro = false }: { input: Input; manual: boolean; onShift: (d: 1 | -1) => void; retro?: boolean }) {
  const knob = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: number; x: number } | null>(null);
  const lever = useRef<HTMLDivElement>(null), brake = useRef<HTMLDivElement>(null);
  // the lever's own drag, and a swipe that began on BRAKE (the brake lets go once it becomes a pull)
  const drag = useRef<{ id: number; x: number; y: number; from: 'lever' | 'brake'; swiped: boolean } | null>(null);
  input.touch.active = true;
  useEffect(() => () => { input.touch.handbrake = false; }, [input]);
  const steer = (v: number) => { input.touch.steer = v; if (knob.current) knob.current.style.transform = `translateX(${(v * 52).toFixed(1)}px)`; };
  const pedal = (which: 'gas' | 'brake', on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    input.touch[which] = on;
    (e.currentTarget as HTMLElement).classList.toggle('down', on);
    if (on) try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* fine */ }
  };

  // the pull: `pull` is how far the thumb has slid toward the steering side (px, never negative)
  const pulled = (on: boolean) => {
    if (input.touch.handbrake === on) return;
    input.touch.handbrake = on;
    lever.current?.classList.toggle('pulled', on);
    if (on) { try { navigator.vibrate?.(16); } catch { /* no haptics here */ } }
  };
  const slide = (pull: number) => {
    const p = Math.max(0, pull);
    lever.current?.style.setProperty('--pull', `${Math.min(GRIP_PX, p).toFixed(1)}px`);
    if (!input.touch.handbrake && p >= PULL_PX) pulled(true);
    else if (input.touch.handbrake && p < RELEASE_PX) pulled(false);
  };
  const release = () => {
    drag.current = null;
    pulled(false);
    lever.current?.style.setProperty('--pull', '0px');
  };

  const leverDown = (e: React.PointerEvent) => {
    e.preventDefault();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: 'lever', swiped: true };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  // the Retro look's round button: a press pulls it while held (and sliding into it from BRAKE does, through dragMove)
  const roundDown = (e: React.PointerEvent) => {
    e.preventDefault();
    drag.current = null;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ }
    pulled(true);
  };
  const brakeDown = (e: React.PointerEvent) => {
    pedal('brake', true)(e);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: 'brake', swiped: false };
  };
  const dragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    // from BRAKE: a swipe is mostly sideways and toward the pad; once it is one the brake lets go (it is a pull now)
    if (!d.swiped && -dx >= PULL_PX && -dx >= 1.5 * Math.abs(dy)) {
      d.swiped = true; input.touch.brake = false; brake.current?.classList.remove('down');
    }
    if (d.swiped) slide(-dx);
  };
  const brakeUp = (e: React.PointerEvent) => { release(); pedal('brake', false)(e); };

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
        <div className="brake-wrap">
          {retro ? (
            <div className="hb-round" ref={lever} role="button" aria-label="Handbrake: hold it, or slide from BRAKE into it"
              style={{ '--hb-hold': `${Math.round(TOUCH_HB_HOLD * 1000)}ms` } as React.CSSProperties}
              onPointerDown={roundDown} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
              onContextMenu={(e) => e.preventDefault()}>
              <small className="hb-cap" aria-hidden="true">Handbrake</small>
              <span className="hb-dial" aria-hidden="true">
                <svg className="hb-ring" viewBox="0 0 56 56"><circle className="hb-track" cx="28" cy="28" r="25" /><circle className="hb-arc" cx="28" cy="28" r="25" pathLength={100} /></svg>
                <Ico name="park" />
              </span>
            </div>
          ) : (
            <div className="hb-lever" ref={lever} role="button" aria-label="Handbrake: slide toward the steering pad to pull"
              onPointerDown={leverDown} onPointerMove={dragMove} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
              onContextMenu={(e) => e.preventDefault()}>
              <span className="hb-grip"><i /><b>Handbrake</b><i /></span>
            </div>
          )}
          <div className="pedal brake" ref={brake} onPointerDown={brakeDown} onPointerMove={dragMove} onPointerUp={brakeUp} onPointerCancel={brakeUp} role="button"
            aria-label={retro ? 'Brake (slide into HANDBRAKE to pull the handbrake)' : 'Brake (swipe toward the steering pad for the handbrake)'}>{retro ? <><Ico name="disc" /><span>BRAKE</span></> : 'BRAKE'}</div>
        </div>
        <div className="pedal gas" onPointerDown={pedal('gas', true)} onPointerUp={pedal('gas', false)} onPointerCancel={pedal('gas', false)} role="button" aria-label="Accelerate">{retro ? <><Ico name="speed" /><span>GAS</span></> : 'GAS'}</div>
      </div>
    </div>
  );
}
