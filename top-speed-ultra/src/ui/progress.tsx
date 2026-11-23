// Progress widgets (progress.ts): the OC Hypercar's Founders' Road bar, a garage card's miles gate, the daily goals, the
// venue passport, Vega & Vinnie's membership and the after-run line. Each is a plain component the menu (or any panel)
// can place with the game; they read game.progress and refresh once a second. Everything is earned by playing: no
// prices on goals, no countdown on a purchase, and the copy says progress is saved on this device.
import { useEffect, useState } from 'react';
import type { Game, Result } from '../game/Game';
import {
  CAR_MILES, FOUNDERS, GOAL_COPY, LADDER, MARKETER, MEMBERSHIPS, PASSPORT, TIER_LABEL, TIER_MULT, VENUE_POINTS, goalText, weeklyText, REGULAR_SECS, LEGEND_SECS,
} from '../game/progress';
import { carById } from '../game/cars';
import './progress.css';

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}
const mins = (secs: number) => { const m = Math.floor(secs / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

/** Founders' Road: "312 / 500 to the OC Hypercar", the bar and the days to Dec 31. The countdown is for this free goal only:
 *  nothing here sells anything (the Founder Edition is in the Store, not on this widget). `onOpen` (the menu) adds a button that
 *  opens the Goals and passport panel. */
export function HypercarProgress({ game, compact = false, onOpen }: { game: Game; compact?: boolean; onOpen?: () => void }) {
  useTick();
  const pr = game.progress, f = pr.founders(), tier = game.trafficTier;
  const left = f.days > 0 ? `${f.days} day${f.days === 1 ? '' : 's'} left` : `${f.hours} hour${f.hours === 1 ? '' : 's'} left`;
  return (
    <section className={'pg hyper' + (f.earned ? ' earned' : '') + (compact ? ' compact' : '')} aria-label="Founders' Road: the OC Hypercar, free by driving" data-pg="hypercar">
      <div className="pg-row"><h3>Founders' Road</h3>{f.earned ? <span className="pg-chip">Unlocked</span> : f.open ? <span className="pg-chip" data-pg="days-left">{left}</span> : <span className="pg-chip">Closed</span>}</div>
      <div className="pg-row"><span className="pg-big" data-pg="hypercar-text">{f.text}</span></div>
      <span className={'pg-bar' + (f.earned ? ' done' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={FOUNDERS.goal} aria-valuenow={f.shown} aria-label="Road Points to the OC Hypercar"><i style={{ width: `${(f.frac * 100).toFixed(1)}%` }} /></span>
      {compact && !f.earned && !f.missed && <small>Earn it free by driving. It's free until Dec 31.</small>}
      {compact && <MilesLine game={game} />}
      {onOpen && <button type="button" className="pg-open" data-pg="open-goals" onClick={onOpen}>Goals and passport<i aria-hidden="true">›</i></button>}
      {!compact && <>
        <small>{f.earned ? 'The standard OC Hypercar is in your garage for good. The Founder Edition keeps its numbered plaque, Glacier Silver paint and Founder Ice lights.'
          : f.missed ? "Founders' Road closed on Dec 31, 2026, so no more points go toward the free OC Hypercar. Everything you earned stays yours."
            : `Earn it free by driving, until Dec 31, 2026. 1 active mile is ${TIER_MULT[tier]} Road Point${TIER_MULT[tier] === 1 ? '' : 's'} in ${TIER_LABEL[tier]}. Free Drive pays 1 whatever its traffic; Speed Survival pays Easy 1, Medium 1.25, Extreme 1.5.`}</small>
        <small className="pg-note">Only active driving counts: unpaused, above 40 mph, your hands on the car. Venue time counts too, up to {VENUE_POINTS.perDay} points a day. {GOAL_COPY.saved}</small>
      </>}
    </section>
  );
}

/** the miles and the next car, one line each */
export function MilesLine({ game }: { game: Game }) {
  useTick();
  const pr = game.progress, next = Object.entries(CAR_MILES).filter(([id, n]) => n > pr.s.miles && id !== 'oc-hyper').sort((a, b) => a[1] - b[1])[0];
  return <p className="pg-note" data-pg="miles"><b>{pr.s.miles.toFixed(1)} active miles</b>{next ? ` · next car: ${carById(next[0]).name} at ${next[1]} mi` : ' · every mile car is open'}</p>;
}

/** a garage card's miles gate: "Unlocks at 150 mi · 87 / 150" and a bar; a "just unlocked" chip while its card glows */
export function CarGate({ game, id }: { game: Game; id: string }) {
  useTick();
  const pr = game.progress, g = pr.carGate(id); if (!g) return null;
  const fresh = pr.glowing(id);
  return (
    <div className="gate" data-gate={id}>
      {fresh && <span className="pg-chip gate-new">Just unlocked</span>}
      <span className="gate-text" data-gate-text>{g.unlocked ? `Unlocked at ${g.need} mi` : g.text}</span>
      {!g.unlocked && <span className={'pg-bar'} role="progressbar" aria-valuemin={0} aria-valuemax={g.need} aria-valuenow={Math.floor(g.have)} aria-label={`Miles toward the ${carById(id).name}`}><i style={{ width: `${(g.frac * 100).toFixed(1)}%` }} /></span>}
    </div>
  );
}

/** today's three goals, the daily bonus, the streak and the week's challenge */
export function GoalsCard({ game }: { game: Game }) {
  useTick();
  const pr = game.progress, g = pr.goals(), sv = g.streak, w = g.weekly;
  const val = (x: { kind: string; progress: number; target: number }) => x.kind === 'miles' ? `${x.progress.toFixed(1)} / ${x.target} mi` : x.kind === 'fast' ? `${Math.floor(x.progress)} / ${x.target} s` : x.progress >= 1 ? 'Done' : 'Not yet';
  return (
    <section className="pg" aria-label="Daily goals" data-pg="goals">
      <div className="pg-row"><h3>Today's goals</h3><span className="pg-chip" data-pg="streak">{sv.count > 0 ? `${sv.count}-day streak` : 'No streak yet'}</span></div>
      <div>
        {g.daily.map((x) => (
          <div key={x.id} className={'pg-goal' + (x.done ? ' done' : '')} data-goal={x.kind}>
            <div className="pg-row"><span className="pg-name">{goalText(x)}</span><span className="pg-pay">+{x.cash} cash · +{x.points} pts</span></div>
            <span className={'pg-bar' + (x.done ? ' done' : '')}><i style={{ width: `${Math.min(100, (x.progress / x.target) * 100)}%` }} /></span>
            <small>{val(x)}</small>
          </div>
        ))}
      </div>
      <small>{g.daily.every((x) => x.done) ? 'All three done today.' : 'Finish all three for a bonus of +150 cash.'} {sv.text}.</small>
      <div className="pg-goal" data-goal="weekly">
        <div className="pg-row"><span className="pg-name"><b>This week:</b> {weeklyText(w)}</span><span className="pg-pay">+{w.cash} cash · +{w.points} pts</span></div>
        <span className={'pg-bar' + (w.done ? ' done' : '')}><i style={{ width: `${Math.min(100, (w.progress / w.target) * 100)}%` }} /></span>
        <small>{w.done ? 'Done this week' : `${w.kind === 'miles' ? w.progress.toFixed(1) : Math.floor(w.progress)} / ${w.target}${w.kind === 'miles' ? ' mi' : w.kind === 'fast' ? ' s' : ' min'}`}</small>
      </div>
      <small className="pg-note">{GOAL_COPY.streakNote} {GOAL_COPY.panelNote} {GOAL_COPY.saved}</small>
    </section>
  );
}

/** one venue's ladder, stamps and time (the menu's passport widget) */
export function PassportCard({ game, venue }: { game: Game; venue: string }) {
  useTick();
  const pr = game.progress, v = PASSPORT.find((x) => x.id === venue)!, p = pr.pass(venue), st = pr.stampList(venue), rung = p.rung;
  const goal = rung < 2 ? REGULAR_SECS : LEGEND_SECS, t = pr.venueToday();
  const member = MEMBERSHIPS[venue];
  return (
    <section className="pg" aria-label={`${v.name} passport`} data-pg="passport" data-venue={venue}>
      <div className="pg-row"><h3>{v.name} passport</h3><span className="pg-chip">{LADDER[rung]}</span></div>
      <div className="pg-ladder" aria-label="Ladder">{[1, 2, 3].map((i) => <span key={i} className={rung >= i ? 'on' : ''}>{LADDER[i]}</span>)}</div>
      <div className="pg-stamps">
        <span className={st.visit ? 'on' : ''}>First visit</span>
        {st.spots.map((x) => <span key={x.id} className={x.found ? 'on' : ''}>{x.label}</span>)}
        {st.actions.map((x) => <span key={x.id} className={x.found ? 'on' : ''}>{x.label}</span>)}
      </div>
      <span className="pg-bar"><i style={{ width: `${Math.min(100, (p.seconds / goal) * 100)}%` }} /></span>
      <small>{mins(p.seconds)} active here{rung < 3 ? ` of ${mins(goal)} for ${LADDER[rung + 1] ?? ''}`.replace('for Not visited', '') : ''}. Today's venue Road Points {t.points.toFixed(1)} / {VENUE_POINTS.perDay}{member && pr.hasAccess(venue) ? ` · marketer cash ${Math.floor(t.cash)} / ${MARKETER.perDay}` : ''}.</small>
      <small className="pg-note">{v.note}. The crowd is simulated. {rung >= 2 ? `Badge: ${v.badge}. ` : ''}{rung >= 3 ? `Paint: ${v.legend.name}. ` : ''}{GOAL_COPY.saved}</small>
    </section>
  );
}

/** the Get out panel's gate at a venue that asks for a cash membership (Vega & Vinnie's): the price and a Join button */
export function VenueMembership({ game, venue, onChange }: { game: Game; venue: string; onChange?: () => void }) {
  useTick();
  const m = MEMBERSHIPS[venue], pr = game.progress; const [msg, setMsg] = useState('');
  if (!m || game.ownerMode || pr.hasAccess(venue)) return null;
  const cash = Math.floor(game.profile.p.credits), can = cash >= m.price;
  return (
    <div className="pg" data-pg="membership" role="group" aria-label={`${m.name} membership`}>
      <h3>{m.name}: members only</h3>
      <small>One-time entry, {m.price.toLocaleString()} cash, yours for good. You have {cash.toLocaleString()} cash. Cash is earned by driving; it is never sold.</small>
      <button type="button" className="pg-btn" disabled={!can} onClick={() => { const e = pr.buyAccess(venue); setMsg(e ?? `Welcome to ${m.name}`); game.profile.save(); onChange?.(); }}>Join · {m.price.toLocaleString()} cash</button>
      {!can && <small>{(m.price - cash).toLocaleString()} more cash to go.</small>}
      {msg && <small role="status">{msg}</small>}
    </div>
  );
}

/** the line under a finished run: what it added, and where Founders' Road stands */
export function RunProgressLine({ result }: { result: Result }) {
  const p = result.progress; if (!p) return null;
  return (
    <p className="pg-run" data-pg="run-line">
      <b>{p.miles.toFixed(2)} active mi</b> · +{p.points.toFixed(1)} Road Points · +{Math.round(p.cash)} cash from speed and goals · {p.founders}
    </p>
  );
}

/** the menu's widget: Founders' Road, the miles and next car, today's goals and the passports */
export function ProgressStrip({ game }: { game: Game }) {
  return (
    <div className="pg-strip" data-pg="strip">
      <HypercarProgress game={game} />
      <MilesLine game={game} />
      <GoalsCard game={game} />
      {PASSPORT.map((v) => <PassportCard key={v.id} game={game} venue={v.id} />)}
    </div>
  );
}
