// The heads-up display. It never re-renders: the game writes straight into these elements ten times a second.
//
// The condensed HUD (owner, 2026-10-22: "way too much going on on the hud interface, condense everything seamlessly";
// HUD_POV_SPEC sections 1, 2 and 4). On a phone every readout lives in one glass plate top left: line 1 the speed and
// the gear with the revs as a thin bar under them, line 2 the mode's numbers, or in a race the position box, with a
// route the guidance and destination lines. The compass is the ring round the round map (App.tsx draws the map), and
// the road is a small chip under it. The clock and the temperature leave the driving HUD for the pause screen (and, on
// a desktop, a caption over the map dial). On a desktop the plate is `display: contents` and its parts keep the
// reference layout: the numbers top left, the speed block bottom right, the road's guide sign top centre.
//
// The readouts sit in `.hud-read`, hidden from assistive tech (they change ten times a second); the ability button is
// outside it, so a screen reader and the keyboard reach it. The root carries what the CSS keys off: `data-view` (the
// camera in use), `data-live-cluster` (the car's own display shows the speed: the HUD drops its duplicate in the seat),
// `data-wake` (something worth a look: the Minimal HUD brings the map back for it) and `data-road-new` (the road just
// changed: its chip shows for 8 s).

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Hud as HudData } from '../game/Game';
import { OcMark } from './Mark';

export interface HudHandle { set: (h: HudData) => void }

const miles = (m: number) => (m / 1609.344).toFixed(m < 1609 ? 2 : 1) + ' mi';
// how far to the next manoeuvre
const toGo = (m: number) => (m > 1609 ? miles(m) : Math.round(m * 3.281 / 10) * 10 + ' ft');
// the time to the destination at your pace
const eta = (s: number) => (s < 0 ? '–' : s < 60 ? 'Under 1 min' : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${String(Math.round(s / 60) % 60).padStart(2, '0')} min`);
const CARDINAL = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROAD_MS = 8000;      // the road chip shows this long after the road changes
const WAKE_MS = 4000;      // a wake (a hard stop, a race position change) brings the tucked map back this long

// the manoeuvre's arrow: straight on, or a fork to the right (mirrored for the left); styles.css shows the one data-turn names
function TurnArrow({ size, className }: { size: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width={size} height={size}>
      <path className="ahead" d="M16 28V6M9 13l7-7 7 7" />
      <path className="thru" d="M12 28V6" />
      <path className="fork" d="M12 28v-8c0-5 8-5 8-10V6M16 10l4-4 4 4" />
    </svg>
  );
}
// the destination card's icons: a map pin, a clock, a car
const ICONS = {
  pin: 'M8 14.5s-4.5-4.6-4.5-8a4.5 4.5 0 0 1 9 0c0 3.4-4.5 8-4.5 8zM8 8.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z',
  clock: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 4.5V8l2.5 1.6',
  car: 'M2.5 11.5V8.4l1.6-3.6c.2-.5.7-.8 1.2-.8h5.4c.5 0 1 .3 1.2.8l1.6 3.6v3.1M2.5 8.5h11M2.5 11.5h2M11.5 11.5h2M5 11.5v1.5M11 11.5v1.5',
};
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 16 16" width="14" height="14"><path d={d} /></svg>;

const MODE_LABEL: Record<string, string> = { free: 'Free Drive', survival: 'Speed Survival', race: 'Race', time: 'Time Trial' };

type El = React.RefObject<HTMLElement>;

export const HUD = forwardRef<HudHandle, { showFps: boolean; visible: boolean; chips: string[]; onAbility: () => void }>(function HUD({ showFps, visible, chips, onAbility }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const speed = useRef<HTMLSpanElement>(null), gear = useRef<HTMLSpanElement>(null), bar = useRef<HTMLDivElement>(null);
  const k1 = useRef<HTMLElement>(null), v1 = useRef<HTMLElement>(null), k2 = useRef<HTMLElement>(null), v2 = useRef<HTMLElement>(null);
  const k3 = useRef<HTMLElement>(null), v3 = useRef<HTMLElement>(null), fps = useRef<HTMLSpanElement>(null), cam = useRef<HTMLSpanElement>(null);
  const big = useRef<HTMLDivElement>(null), road = useRef<HTMLSpanElement>(null), next = useRef<HTMLDivElement>(null), wrong = useRef<HTMLDivElement>(null);
  const modeEl = useRef<HTMLElement>(null), shield = useRef<HTMLSpanElement>(null);
  const abil = useRef<HTMLButtonElement>(null), abilName = useRef<HTMLSpanElement>(null), tun = useRef<HTMLDivElement>(null);
  // the race box: the position with the race timer beside it, the standings, and the rev lights over the gear
  const race = useRef<HTMLDivElement>(null), pos = useRef<HTMLElement>(null), posOf = useRef<HTMLElement>(null), prog = useRef<HTMLElement>(null);
  const timer = useRef<HTMLElement>(null), rows = useRef<HTMLOListElement>(null), revs = useRef<HTMLDivElement>(null);
  // the compass ring (its tape turns by --h) and the heading's cardinal; the clock caption (desktop)
  const tape = useRef<HTMLDivElement>(null), card = useRef<HTMLElement>(null), compass = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLElement>(null), temp = useRef<HTMLElement>(null), note = useRef<HTMLElement>(null);
  // the navigation line and the destination line (U2)
  const nav = useRef<HTMLDivElement>(null), navDist = useRef<HTMLElement>(null), navAct = useRef<HTMLSpanElement>(null), navTo = useRef<HTMLDivElement>(null);
  const exitKey = useRef<HTMLElement>(null), exitText = useRef<HTMLSpanElement>(null);
  const dest = useRef<HTMLDivElement>(null), destRoad = useRef<HTMLElement>(null), destDist = useRef<HTMLElement>(null), destEta = useRef<HTMLElement>(null), traffic = useRef<HTMLElement>(null);
  // what the wake rules remember between calls (kept across re-renders)
  const st = useRef({ t: 0, road: '', roadAt: -1e9, wakeUntil: 0, brakeS: 0, racePos: 0, cool: 0 });
  const last: Record<string, string> = {};
  const put = (el: HTMLElement | null, key: string, text: string) => { if (el && last[key] !== text) { el.textContent = text; last[key] = text; } };
  // a line-2 slot: its key (the long form for a desktop plate, `data-s` the short one a phone shows) and its value
  const slot = (k: HTMLElement | null, v: HTMLElement | null, i: number, key: string, short: string, val: string) => {
    put(k, 'k' + i, key); put(v, 'v' + i, val);
    if (k && k.dataset.s !== short) k.dataset.s = short;
  };
  const attr = (el: HTMLElement | null, name: string, on: boolean) => { if (el && el.hasAttribute(name) !== on) el.toggleAttribute(name, on); };
  const data = (el: HTMLElement | null, name: string, v: string) => { if (el && el.dataset[name] !== v) el.dataset[name] = v; };
  useImperativeHandle(ref, () => ({
    set(h) {
      const now = performance.now(), s = st.current, dt = Math.min(0.5, Math.max(0, (now - (s.t || now)) / 1000));
      s.t = now;
      const R = root.current;
      put(speed.current, 'speed', String(h.speed));
      put(gear.current, 'gear', h.gear + (h.auto ? '' : ' M'));
      if (bar.current) {
        const r = h.rpmFrac.toFixed(3);
        if (last.rpm !== r) { last.rpm = r; bar.current.style.setProperty('--r', r); }
        bar.current.classList.toggle('red', h.rpmFrac > 0.92); bar.current.classList.toggle('flash', h.rpmFrac > 0.95);
      }
      if (revs.current) {
        // eight lights from 55% of the redline, the last one at 90%; all of them flash at the limiter
        const lit = h.rpmFrac < 0.55 ? 0 : Math.min(8, Math.floor((h.rpmFrac - 0.55) / 0.05) + 1);
        if (last.revs !== String(lit)) { last.revs = String(lit); const kids = revs.current.children; for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i < lit); }
        revs.current.classList.toggle('flash', h.rpmFrac > 0.95);
      }
      // the camera in use and whether the car's own display shows the speed (the seat view drops the HUD's duplicate)
      data(R, 'view', h.view);
      attr(R, 'data-live-cluster', h.liveCluster);
      const racing = h.mode === 'race';
      if (race.current) race.current.hidden = !racing;
      if (big.current) { big.current.hidden = racing; data(big.current, 'mode', h.mode); attr(big.current, 'data-errand', h.mode === 'free' && !!h.errand); }
      if (racing) {
        put(pos.current, 'pos', h.racePos ? String(h.racePos) : '–'); put(posOf.current, 'posOf', `of ${h.raceOf}`);
        put(prog.current, 'prog', h.raceCp ? `Gates ${h.raceCp} · ${miles(Math.max(0, h.raceLeft))} to go` : `${miles(Math.max(0, h.raceLeft))} to go`);
        put(timer.current, 'timer', h.raceTime);
        // every row on a wide screen; a phone shows the car ahead and the car behind (class near, not you)
        const n = h.standings.length, me = Math.max(0, h.standings.findIndex((x) => x.you)), lo = Math.max(0, Math.min(me - 1, n - 3));
        const lis = rows.current?.children;
        for (let k = 0; lis && k < lis.length; k++) {
          const li = lis[k] as HTMLLIElement, sd = h.standings[k];
          li.hidden = !sd;
          if (!sd) continue;
          const [p, t, nm, gp] = li.children as unknown as HTMLElement[];
          put(p, `r${k}p`, String(sd.pos)); put(t, `r${k}t`, sd.tag); put(nm, `r${k}n`, sd.name);
          put(gp, `r${k}g`, sd.you ? '' : sd.done ? 'FIN' : (sd.gap >= 0 ? '+' : '−') + Math.min(999, Math.abs(sd.gap)).toFixed(1));
          t.classList.toggle('oc', sd.you);       // your tag reads "OC": the mark goes there (styles.css)
          li.classList.toggle('me', sd.you); li.classList.toggle('done', sd.done > 0); li.classList.toggle('near', k >= lo && k < lo + 3);
        }
        for (let i = 1; i <= 3; i++) slot([k1, k2, k3][i - 1].current, [v1, v2, v3][i - 1].current, i, '', '', '');
        // a new position is worth a look
        if (s.racePos && h.racePos && h.racePos !== s.racePos) s.wakeUntil = now + WAKE_MS;
        s.racePos = h.racePos;
      } else if (h.mode === 'survival') {
        slot(k1.current, v1.current, 1, 'Score', '', h.score.toLocaleString() + (h.combo > 1 ? `  x${h.combo.toFixed(1)}` : ''));
        slot(k2.current, v2.current, 2, 'Over 100', '', h.streak.toFixed(1) + ' s');
        slot(k3.current, v3.current, 3, 'Near misses', 'Near', String(h.nearMisses));
      } else if (h.mode === 'time') {
        slot(k1.current, v1.current, 1, 'Time', '', h.timeLeft.toFixed(1) + ' s');
        slot(k2.current, v2.current, 2, 'Checkpoint', 'CP', (h.checkpoint / 1000).toFixed(2) + ' km');
        slot(k3.current, v3.current, 3, 'Distance', 'Dist', miles(h.distance));
      } else {
        slot(k1.current, v1.current, 1, 'Distance', '', miles(h.distance));
        slot(k2.current, v2.current, 2, 'Top', 'Top', h.top + ' mph');
        // a story errand (story.ts): its clock in the third slot (a phone shows it in place of Top)
        if (h.errand) { const t = Math.ceil(h.errand.left); slot(k3.current, v3.current, 3, 'Errand', 'Errand', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`); }
        else slot(k3.current, v3.current, 3, '', '', '');
      }
      const warn = h.mode === 'time' && h.timeLeft < 10;
      if (big.current) big.current.classList.toggle('warn', warn);
      put(modeEl.current, 'modeLabel', MODE_LABEL[h.mode] ?? h.mode);
      // the road as a guide sign: the route shield (blue Interstate, white state route) then the direction
      const rm = /^(I|CA)-(\d+)\s*(\w+)?/.exec(h.road);
      if (shield.current) { shield.current.hidden = !rm; if (rm) { put(shield.current, 'shieldNo', rm[2]); const cls = 'shield ' + (rm[1] === 'I' ? 'i' : 'ca'); if (last.shieldCls !== cls) { last.shieldCls = cls; shield.current.className = cls; } } }
      put(road.current, 'road', rm ? (rm[3] ?? '') : h.road);
      if (h.road !== s.road) { s.road = h.road; s.roadAt = now; }
      attr(R, 'data-road-new', !racing && now - s.roadAt < ROAD_MS);
      // with a route the navigation line says what's next; with none, a story errand's exit and how far its sign is
      const navOn = !!h.next && !racing;
      const nx = h.next ? `${h.next} · ${toGo(h.nextDist)}` : h.errand ? `Errand: ${h.errand.exit} exit${h.errand.dist >= 0 ? ' · ' + toGo(h.errand.dist) : ''}` : '';
      put(next.current, 'next', nx);
      if (next.current) next.current.hidden = !nx || navOn;
      if (nav.current) { nav.current.hidden = !navOn; if (nav.current.dataset.turn !== h.turn) nav.current.dataset.turn = h.turn; }
      if (navOn) {
        put(navDist.current, 'navDist', toGo(h.nextDist)); put(navAct.current, 'navAct', h.navAct); put(navTo.current, 'navTo', h.navTo);
        // the next exit's sign, or (on a ramp, with no exits along it) the sign it was taken from, or the road you're on
        put(exitKey.current, 'exitKey', h.exitText ? (h.exitMine ? 'Your exit' : 'Next exit') : 'Now on');
        put(exitText.current, 'exitText', h.exitText || h.onSign || h.road);
      }
      const destOn = !!h.dest && !racing;
      if (dest.current) dest.current.hidden = !destOn;
      if (destOn) {
        // on a phone the destination line leaves its road out when the manoeuvre's sign already names it
        attr(dest.current, 'data-same', h.dest === h.navTo && navOn);
        put(destRoad.current, 'destRoad', h.dest); put(destDist.current, 'destDist', miles(h.destDist));
        put(destEta.current, 'destEta', eta(h.eta)); put(traffic.current, 'traffic', h.traffic === 'None' ? 'No traffic' : `${h.traffic} traffic`);
      }
      // the compass ring: the N tick orbits the heading-up map; the heading's cardinal sits at twelve o'clock
      const hd = h.heading.toFixed(1);
      if (tape.current && last.hd !== hd) { last.hd = hd; tape.current.style.setProperty('--h', hd); }
      put(card.current, 'card', CARDINAL[Math.round(h.heading / 45) % 8]);
      attr(compass.current, 'data-north', h.heading < 20 || h.heading > 340);
      // the time the sky shows and the temperature, with where it comes from (desktop caption; the pause screen too)
      put(clock.current, 'clock', h.clock); put(temp.current, 'temp', `${h.tempF}°`); put(note.current, 'note', h.tempNote);
      if (wrong.current) wrong.current.hidden = !h.wrongWay;
      put(fps.current, 'fps', h.fps + ' fps');
      if (tun.current) tun.current.style.setProperty('--t', h.tunnel.toFixed(3));
      if (abil.current) {
        put(abilName.current, 'abil', h.ability);
        const b = abil.current, on = h.abilityOn > 0, cool = h.abilityCool;
        b.classList.toggle('on', on); b.classList.toggle('cool', !on && cool > 0);
        b.style.setProperty('--p', String(on ? h.abilityOn : 1 - cool));
        b.setAttribute('aria-label', on ? `${h.ability} active` : cool > 0 ? `${h.ability} recharging` : `Use ${h.ability}`);
        // ready again: one 300 ms pulse (none with reduced motion)
        if (s.cool > 0 && cool <= 0 && !on && !REDUCED) { b.classList.add('ready'); setTimeout(() => b.classList.remove('ready'), 300); }
        s.cool = cool;
      }
      put(cam.current, 'cam', h.cam);
      // what wakes the tucked Minimal HUD (App.tsx tucks; styles.css reads data-wake): a hard stop held 0.4 s above
      // 30 mph, a new race position (above), Time Trial's last 10 s, and an exit coming up (the route's manoeuvre
      // within 800 m, the errand's sign within a mile), which keeps it up until it is passed
      s.brakeS = h.brake >= 0.5 && h.speed > 30 ? s.brakeS + dt : 0;
      if (s.brakeS >= 0.4) s.wakeUntil = now + WAKE_MS;
      const approach = (navOn && h.nextDist < 800) || (!!h.errand && h.errand.dist >= 0 && h.errand.dist < 1600);
      attr(R, 'data-wake', approach || warn || now < s.wakeUntil);
    },
  }));
  return (
    <div className="hud" ref={root} hidden={!visible}>
      <div className="hud-read" aria-hidden="true">
        <div className="tunnel" ref={tun} />
        {/* the compass, as the ring round the round map (styles.css places it on the map's box) */}
        <div className="hud-compass" ref={compass}>
          <div className="hud-tape" ref={tape}><i className="hud-n">N</i></div>
          <b className="hud-card" ref={card as El}>N</b>
        </div>
        {/* the time and the temperature: a caption over the map dial on a desktop; on a phone they are in the pause screen */}
        <div className="hud-clock"><b ref={clock as El} /><span><em ref={temp as El} /> · <i ref={note as El}>simulated</i></span></div>
        <div className="hud-road"><div className="hud-roadname"><span className="shield i" ref={shield} hidden /><span ref={road} /></div></div>
        <div className="hud-plate">
          {/* line 1: the speed and the gear, the revs as a slanted bar; on a desktop the speed block bottom right with the
              rev lights and the chips (handling profile, assists, the hypercar's tune) */}
          <div className="hud-speed">
            <div className="hud-rpm"><div ref={bar} /></div>
            <div className="hud-main">
              <div className="hud-revs" ref={revs}>{[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <i key={k} />)}</div>
              <div className="hud-row"><span className="hud-mph" ref={speed}>0</span><span className="hud-unit">mph</span><span className="hud-gear" ref={gear}>1</span></div>
              <div className="hud-chips">{chips.map((c) => <i key={c} className={c === 'Unleashed' ? 'hot' : ''}>{c}</i>)}</div>
              <span className="hud-cam" ref={cam} />
            </div>
          </div>
          {/* line 2: the mode's numbers */}
          <div className="hud-stats" ref={big}>
            <OcMark size="sm" />
            <em className="hud-mode" ref={modeEl as El} />
            <div><b ref={k1 as El}>Distance</b><span ref={v1 as El}>0.00 mi</span></div>
            <div><b ref={k2 as El} /><span ref={v2 as El} /></div>
            <div><b ref={k3 as El} /><span ref={v3 as El} /></div>
          </div>
          <div className="hud-race" ref={race} hidden>
            <div className="hud-pos"><b ref={pos as El}>–</b><span><i>Position</i><em ref={posOf as El}>of 4</em></span><span className="hud-timer"><i>Time</i><em ref={timer as El}>0:00.0</em></span><small ref={prog as El} /></div>
            <ol className="hud-standings" ref={rows}>{[0, 1, 2, 3].map((k) => <li key={k} hidden><i /><em /><span /><b /></li>)}</ol>
            <small className="hud-race-note">Gaps in s · estimated</small>
          </div>
          {/* the guidance: the errand's exit (and, without a route card, the route's next manoeuvre) */}
          <div className="hud-next" ref={next} hidden />
          <div className="hud-navs">
            <div className="hud-nav" ref={nav} hidden>
              <TurnArrow size={40} className="hud-nav-arrow" />
              <div className="hud-nav-dist"><b ref={navDist as El} /><span ref={navAct} /></div>
              <div className="hud-nav-sign" ref={navTo} />
              <div className="hud-nav-exit"><i ref={exitKey as El} /><span ref={exitText} /></div>
            </div>
            <div className="hud-dest" ref={dest} hidden>
              <small>Destination</small>
              <div className="dest-road"><Icon d={ICONS.pin} /><b ref={destRoad as El} /><em ref={destDist as El} /></div>
              <div className="dest-eta"><Icon d={ICONS.clock} /><b ref={destEta as El} /><em>at your pace</em></div>
              <div className="dest-traffic"><Icon d={ICONS.car} /><b ref={traffic as El} /><em>simulated</em></div>
            </div>
          </div>
          {showFps && <span className="hud-fps" ref={fps}>-- fps</span>}
        </div>
        <div className="hud-wrong" ref={wrong} hidden>WRONG WAY</div>
      </div>
      {/* the driver's ability: a real button outside the hidden readouts, so a screen reader and the keyboard reach it */}
      <button type="button" className="hud-ability" ref={abil} onClick={onAbility} aria-keyshortcuts="F"><span ref={abilName}>Ability</span></button>
    </div>
  );
});
