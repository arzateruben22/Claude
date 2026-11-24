// On-screen controls for phones and tablets: drag the left pad to steer, hold GAS or BRAKE on the right.
// (Pause and View live in the top bar; on a phone Go to is in Pause's hold quick menu, App.tsx.)
//
// The handbrake lives on BRAKE (owner, 2026-11-24: "get rid of the drift button all entirely but find a way to
// incorporate it on the brake button but make the brake emblem that emblem"; the gesture he chose: "I like the flick but
// maybe a slide up option and it drifts as long as you hold it"). There is no separate HANDBRAKE button:
//   - press BRAKE: the brake, as before;
//   - slide the thumb UP from BRAKE past PULL_PX (a quick flick counts: the lift's own position is read too): the brake
//     lets go and the handbrake is pulled, and it stays pulled, drifting, for as long as the finger is held anywhere above
//     that line (sideways doesn't matter);
//   - slide back down onto BRAKE (under RELEASE_PX): braking again; lift: everything lets go.
// Input.touch.handbrake carries it (game/input.ts keeps a touch pull for TOUCH_HB_HOLD after the lift, so a flick lasts
// long enough for the rear to step out). BRAKE's icon is the owner's emblem (control/ui-refs/2026-11-24-brake-emblem.png):
// a red (P) inside two red arcs on a dark lens in a knurled chrome ring (Ultra; a flat version in Retro), with a short red
// arc on the ring that lights while the handbrake is pulled and drains over that hold. A one-time hint, "Slide up to
// drift", shows over BRAKE the first time it is pressed on this device. Keyboard Space stays the handbrake (input.ts).

import { useEffect, useRef, useState } from 'react';
import { TOUCH_HB_HOLD, type Input } from '../game/input';
import { Ico } from './Icons';

export const PULL_PX = 28;      // how far up from where the thumb came down on BRAKE it must slide to pull the handbrake
export const RELEASE_PX = 20;   // back under this and it is the brake again (a thumb resting on the line doesn't flutter)
export const HINT_HB_SLIDE = 'tsu.hint.hbslide';
const HINT_MS = 4500;

// the owner's emblem: the ring's short red arc (lit while pulled), the dark lens, the red (P) inside its two arcs
export function BrakeEmblem() {
  return (
    <span className="bk-emb" aria-hidden="true">
      <svg viewBox="0 0 40 40" width="40" height="40">
        <defs>
          <radialGradient id="bk-lens-g" cx="50%" cy="30%" r="70%"><stop offset="0" stopColor="#2a2d33" /><stop offset="0.55" stopColor="#101114" /><stop offset="1" stopColor="#040405" /></radialGradient>
        </defs>
        <circle className="bk-lens" cx="20" cy="20" r="14.2" />
        <circle className="bk-edge" cx="20" cy="20" r="14.6" />
        <circle className="bk-arc" cx="20" cy="20" r="17.6" pathLength={100} />
        <g className="bk-p">
          <circle cx="20" cy="20" r="7" />
          <path d="M17.7 24.2V15.8h2.9a2.45 2.45 0 0 1 0 4.9h-2.9" />
          <path d="M12.6 14.4A9.6 9.6 0 0 0 12.6 25.6M27.4 14.4A9.6 9.6 0 0 1 27.4 25.6" />
        </g>
      </svg>
    </span>
  );
}

export function Touch({ input, manual, onShift }: { input: Input; manual: boolean; onShift: (d: 1 | -1) => void }) {
  const knob = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: number; x: number } | null>(null);
  const brake = useRef<HTMLDivElement>(null);
  // the thumb that came down on BRAKE: where, and whether it is above the line (the handbrake) now
  const slideRef = useRef<{ id: number; y: number; on: boolean } | null>(null);
  const [hint, setHint] = useState(false);
  input.touch.active = true;
  useEffect(() => () => { input.touch.handbrake = false; }, [input]);
  // the one-time hint: the first time BRAKE is pressed on this device (when the drive is surely on screen and the thumb is
  // there); marked seen as it shows; it goes after HINT_MS or at the first pull
  const hintT = useRef(0);
  useEffect(() => () => window.clearTimeout(hintT.current), []);
  const firstBrake = () => {
    let seen = true;
    try { seen = localStorage.getItem(HINT_HB_SLIDE) === '1'; if (!seen) localStorage.setItem(HINT_HB_SLIDE, '1'); } catch { /* a convenience */ }
    if (seen) return;
    setHint(true);
    hintT.current = window.setTimeout(() => setHint(false), HINT_MS);
  };
  const steer = (v: number) => { input.touch.steer = v; if (knob.current) knob.current.style.transform = `translateX(${(v * 52).toFixed(1)}px)`; };
  const pedal = (which: 'gas' | 'brake', on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    input.touch[which] = on;
    (e.currentTarget as HTMLElement).classList.toggle('down', on);
    if (on) try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* fine */ }
  };

  // the handbrake on or off (the brake the other way while the thumb is down)
  const pull = (on: boolean, held = true) => {
    if (input.touch.handbrake === on) return;
    input.touch.handbrake = on;
    input.touch.brake = !on && held;
    brake.current?.classList.toggle('pulled', on);
    brake.current?.classList.toggle('down', !on && held);
    if (on) { setHint(false); try { navigator.vibrate?.(16); } catch { /* no haptics here */ } }
  };
  const brakeDown = (e: React.PointerEvent) => {
    pedal('brake', true)(e);
    slideRef.current = { id: e.pointerId, y: e.clientY, on: false };
    firstBrake();
  };
  const brakeMove = (e: React.PointerEvent) => {
    const d = slideRef.current;
    if (!d || e.pointerId !== d.id) return;
    const up = d.y - e.clientY;
    if (!d.on && up >= PULL_PX) { d.on = true; pull(true); }
    else if (d.on && up < RELEASE_PX) { d.on = false; pull(false); }
  };
  const brakeUp = (e: React.PointerEvent) => {
    const d = slideRef.current;
    if (d && d.id === e.pointerId) {
      // a quick flick: the thumb was up past the line by the lift, though no move said so (the hold carries it on)
      if (!d.on && e.type === 'pointerup' && d.y - e.clientY >= PULL_PX) input.flickHandbrake();
      slideRef.current = null;
    }
    pull(false, false);
    pedal('brake', false)(e);
    brake.current?.classList.remove('pulled');
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
          {hint && <p className="hb-hint" role="status"><span aria-hidden="true">↑</span>Slide up to drift</p>}
          <div className="pedal brake" ref={brake} onPointerDown={brakeDown} onPointerMove={brakeMove} onPointerUp={brakeUp} onPointerCancel={brakeUp} role="button"
            style={{ '--hb-hold': `${Math.round(TOUCH_HB_HOLD * 1000)}ms` } as React.CSSProperties}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Brake. Slide up from it and hold for the handbrake, to drift"><BrakeEmblem /><span>BRAKE</span></div>
        </div>
        <div className="pedal gas" onPointerDown={pedal('gas', true)} onPointerUp={pedal('gas', false)} onPointerCancel={pedal('gas', false)} role="button" aria-label="Accelerate"><Ico name="speed" /><span>GAS</span></div>
      </div>
    </div>
  );
}
