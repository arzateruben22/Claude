// The heads-up display. It never re-renders: the game writes straight into these elements ten times a second.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Hud as HudData } from '../game/Game';

export interface HudHandle { set: (h: HudData) => void }

const miles = (m: number) => (m / 1609.344).toFixed(m < 1609 ? 2 : 1) + ' mi';

export const HUD = forwardRef<HudHandle, { showFps: boolean; visible: boolean }>(function HUD({ showFps, visible }, ref) {
  const speed = useRef<HTMLSpanElement>(null), gear = useRef<HTMLSpanElement>(null), bar = useRef<HTMLDivElement>(null);
  const k1 = useRef<HTMLElement>(null), v1 = useRef<HTMLElement>(null), k2 = useRef<HTMLElement>(null), v2 = useRef<HTMLElement>(null);
  const k3 = useRef<HTMLElement>(null), v3 = useRef<HTMLElement>(null), fps = useRef<HTMLSpanElement>(null), cam = useRef<HTMLSpanElement>(null);
  const big = useRef<HTMLDivElement>(null), road = useRef<HTMLDivElement>(null), next = useRef<HTMLDivElement>(null), wrong = useRef<HTMLDivElement>(null);
  const last: Record<string, string> = {};
  const put = (el: HTMLElement | null, key: string, text: string) => { if (el && last[key] !== text) { el.textContent = text; last[key] = text; } };
  useImperativeHandle(ref, () => ({
    set(h) {
      put(speed.current, 'speed', String(h.speed));
      put(gear.current, 'gear', h.gear + (h.auto ? '' : ' M'));
      if (bar.current) { bar.current.style.transform = `scaleX(${h.rpmFrac.toFixed(3)})`; bar.current.classList.toggle('red', h.rpmFrac > 0.92); }
      if (h.mode === 'survival') {
        put(k1.current, 'k1', 'Score'); put(v1.current, 'v1', h.score.toLocaleString() + (h.combo > 1 ? `  x${h.combo.toFixed(1)}` : ''));
        put(k2.current, 'k2', 'Over 100'); put(v2.current, 'v2', h.streak.toFixed(1) + ' s');
        put(k3.current, 'k3', 'Near misses'); put(v3.current, 'v3', String(h.nearMisses));
      } else if (h.mode === 'time') {
        put(k1.current, 'k1', 'Time'); put(v1.current, 'v1', h.timeLeft.toFixed(1) + ' s');
        put(k2.current, 'k2', 'Checkpoint'); put(v2.current, 'v2', (h.checkpoint / 1000).toFixed(2) + ' km');
        put(k3.current, 'k3', 'Distance'); put(v3.current, 'v3', miles(h.distance));
      } else {
        put(k1.current, 'k1', 'Distance'); put(v1.current, 'v1', miles(h.distance));
        put(k2.current, 'k2', 'Top'); put(v2.current, 'v2', h.top + ' mph');
        put(k3.current, 'k3', ''); put(v3.current, 'v3', '');
      }
      if (big.current) big.current.classList.toggle('warn', h.mode === 'time' && h.timeLeft < 10);
      put(road.current, 'road', h.road);
      put(next.current, 'next', h.next ? `${h.next} · ${h.nextDist > 1609 ? miles(h.nextDist) : Math.round(h.nextDist * 3.281 / 10) * 10 + ' ft'}` : '');
      if (next.current) next.current.hidden = !h.next;
      if (wrong.current) wrong.current.hidden = !h.wrongWay;
      put(fps.current, 'fps', h.fps + ' fps');
      put(cam.current, 'cam', h.cam);
    },
  }));
  return (
    <div className="hud" hidden={!visible} aria-hidden="true">
      <div className="hud-road"><div className="hud-roadname" ref={road} /><div className="hud-next" ref={next} hidden /></div>
      <div className="hud-wrong" ref={wrong} hidden>WRONG WAY</div>
      <div className="hud-stats" ref={big}>
        <div><b ref={k1 as React.RefObject<HTMLElement>}>Distance</b><span ref={v1 as React.RefObject<HTMLSpanElement>}>0.00 mi</span></div>
        <div><b ref={k2 as React.RefObject<HTMLElement>} /><span ref={v2 as React.RefObject<HTMLSpanElement>} /></div>
        <div><b ref={k3 as React.RefObject<HTMLElement>} /><span ref={v3 as React.RefObject<HTMLSpanElement>} /></div>
      </div>
      {showFps && <span className="hud-fps" ref={fps}>-- fps</span>}
      <div className="hud-speed">
        <div className="hud-row"><span className="hud-mph" ref={speed}>0</span><span className="hud-unit">mph</span><span className="hud-gear" ref={gear}>1</span></div>
        <div className="hud-rpm"><div ref={bar} /></div>
        <span className="hud-cam" ref={cam} />
      </div>
    </div>
  );
});
