// The heads-up display. It never re-renders: the game writes straight into these elements ten times a second.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Hud as HudData } from '../game/Game';

export interface HudHandle { set: (h: HudData) => void }

const miles = (m: number) => (m / 1609.344).toFixed(m < 1609 ? 2 : 1) + ' mi';

export const HUD = forwardRef<HudHandle, { showFps: boolean; visible: boolean; onAbility: () => void }>(function HUD({ showFps, visible, onAbility }, ref) {
  const speed = useRef<HTMLSpanElement>(null), gear = useRef<HTMLSpanElement>(null), bar = useRef<HTMLDivElement>(null);
  const k1 = useRef<HTMLElement>(null), v1 = useRef<HTMLElement>(null), k2 = useRef<HTMLElement>(null), v2 = useRef<HTMLElement>(null);
  const k3 = useRef<HTMLElement>(null), v3 = useRef<HTMLElement>(null), fps = useRef<HTMLSpanElement>(null), cam = useRef<HTMLSpanElement>(null);
  const big = useRef<HTMLDivElement>(null), road = useRef<HTMLDivElement>(null), next = useRef<HTMLDivElement>(null), wrong = useRef<HTMLDivElement>(null);
  const abil = useRef<HTMLButtonElement>(null), abilName = useRef<HTMLSpanElement>(null), tun = useRef<HTMLDivElement>(null);
  // the race HUD: the position box with the race timer beside the position, the standings, and the rev lights over the gear
  const race = useRef<HTMLDivElement>(null), pos = useRef<HTMLElement>(null), posOf = useRef<HTMLElement>(null), prog = useRef<HTMLElement>(null);
  const timer = useRef<HTMLElement>(null), rows = useRef<HTMLOListElement>(null), revs = useRef<HTMLDivElement>(null);
  const last: Record<string, string> = {};
  const put = (el: HTMLElement | null, key: string, text: string) => { if (el && last[key] !== text) { el.textContent = text; last[key] = text; } };
  useImperativeHandle(ref, () => ({
    set(h) {
      put(speed.current, 'speed', String(h.speed));
      put(gear.current, 'gear', h.gear + (h.auto ? '' : ' M'));
      if (bar.current) { bar.current.style.transform = `scaleX(${h.rpmFrac.toFixed(3)})`; bar.current.classList.toggle('red', h.rpmFrac > 0.92); }
      if (revs.current) {
        // eight lights from 55% of the redline, the last one at 90%; all of them flash at the limiter
        const lit = h.rpmFrac < 0.55 ? 0 : Math.min(8, Math.floor((h.rpmFrac - 0.55) / 0.05) + 1);
        if (last.revs !== String(lit)) { last.revs = String(lit); const kids = revs.current.children; for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i < lit); }
        revs.current.classList.toggle('flash', h.rpmFrac > 0.95);
      }
      const racing = h.mode === 'race';
      if (race.current) race.current.hidden = !racing;
      if (big.current) big.current.hidden = racing;
      if (racing) {
        put(pos.current, 'pos', h.racePos ? String(h.racePos) : '–'); put(posOf.current, 'posOf', `of ${h.raceOf}`);
        put(prog.current, 'prog', h.raceCp ? `Gates ${h.raceCp} · ${miles(Math.max(0, h.raceLeft))} to go` : `${miles(Math.max(0, h.raceLeft))} to go`);
        put(timer.current, 'timer', h.raceTime);
        // every row on a wide screen; a phone shows the three around you (class near)
        const n = h.standings.length, me = Math.max(0, h.standings.findIndex((x) => x.you)), lo = Math.max(0, Math.min(me - 1, n - 3));
        const lis = rows.current?.children;
        for (let k = 0; lis && k < lis.length; k++) {
          const li = lis[k] as HTMLLIElement, st = h.standings[k];
          li.hidden = !st;
          if (!st) continue;
          const [p, t, nm, gp] = li.children as unknown as HTMLElement[];
          put(p, `r${k}p`, String(st.pos)); put(t, `r${k}t`, st.tag); put(nm, `r${k}n`, st.name);
          put(gp, `r${k}g`, st.you ? '' : st.done ? 'FIN' : (st.gap >= 0 ? '+' : '−') + Math.min(999, Math.abs(st.gap)).toFixed(1));
          li.classList.toggle('me', st.you); li.classList.toggle('done', st.done > 0); li.classList.toggle('near', k >= lo && k < lo + 3);
        }
        put(k1.current, 'k1', ''); put(v1.current, 'v1', ''); put(k2.current, 'k2', ''); put(v2.current, 'v2', ''); put(k3.current, 'k3', ''); put(v3.current, 'v3', '');
      } else if (h.mode === 'survival') {
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
      if (tun.current) tun.current.style.setProperty('--t', h.tunnel.toFixed(3));
      if (abil.current) {
        put(abilName.current, 'abil', h.ability);
        const b = abil.current, on = h.abilityOn > 0, cool = h.abilityCool;
        b.classList.toggle('on', on); b.classList.toggle('cool', !on && cool > 0);
        b.style.setProperty('--p', String(on ? h.abilityOn : 1 - cool));
        b.setAttribute('aria-label', on ? `${h.ability} active` : cool > 0 ? `${h.ability} recharging` : `Use ${h.ability}`);
      }
      put(cam.current, 'cam', h.cam);
    },
  }));
  return (
    <div className="hud" hidden={!visible} aria-hidden="true">
      <div className="tunnel" ref={tun} />
      <div className="hud-road"><div className="hud-roadname" ref={road} /><div className="hud-next" ref={next} hidden /></div>
      <div className="hud-race" ref={race} hidden>
        <div className="hud-pos"><b ref={pos as React.RefObject<HTMLElement>}>–</b><span><i>Position</i><em ref={posOf as React.RefObject<HTMLElement>}>of 4</em></span><span className="hud-timer"><i>Time</i><em ref={timer as React.RefObject<HTMLElement>}>0:00.0</em></span><small ref={prog as React.RefObject<HTMLElement>} /></div>
        <ol className="hud-standings" ref={rows}>{[0, 1, 2, 3].map((k) => <li key={k} hidden><i /><em /><span /><b /></li>)}</ol>
        <small className="hud-race-note">Gaps in s · estimated</small>
      </div>
      <div className="hud-wrong" ref={wrong} hidden>WRONG WAY</div>
      <div className="hud-stats" ref={big}>
        <div><b ref={k1 as React.RefObject<HTMLElement>}>Distance</b><span ref={v1 as React.RefObject<HTMLSpanElement>}>0.00 mi</span></div>
        <div><b ref={k2 as React.RefObject<HTMLElement>} /><span ref={v2 as React.RefObject<HTMLSpanElement>} /></div>
        <div><b ref={k3 as React.RefObject<HTMLElement>} /><span ref={v3 as React.RefObject<HTMLSpanElement>} /></div>
      </div>
      {showFps && <span className="hud-fps" ref={fps}>-- fps</span>}
      <button type="button" className="hud-ability" ref={abil} onClick={onAbility}><span ref={abilName}>Ability</span></button>
      <div className="hud-speed">
        <div className="hud-revs" ref={revs}>{[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <i key={k} />)}</div>
        <div className="hud-row"><span className="hud-mph" ref={speed}>0</span><span className="hud-unit">mph</span><span className="hud-gear" ref={gear}>1</span></div>
        <div className="hud-rpm"><div ref={bar} /></div>
        <span className="hud-cam" ref={cam} />
      </div>
    </div>
  );
});
