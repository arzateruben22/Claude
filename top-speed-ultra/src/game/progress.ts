// Progress: the miles that open the cars, Road Points and the free OC Hypercar (Founders' Road), the cash a drive earns,
// the venue passport, and the daily goals. Pure logic: no imports at run time, so a plain `node` test can load it
// (tests/progress.mjs). The game feeds it (Game.simulate, the venue poll) and reads it (the garage, the widgets).
//
// What counts (owner, 2026-11-17..22): only ACTIVE driving. A mile is active when the game is unpaused, the car is above
// 40 mph, you are driving it yourself (not Auto-drive or the menu's attract drive) and you have done something with the
// controls in the last 30 seconds (steer, brake, handbrake, or a change of throttle: a gas pedal held flat on a straight
// does not keep it going). Venue time counts when you walk, sit, order or talk, not when paused or idle.
//
// What this is not (the store's rules, CLAUDE.md): nothing here is sold. Cash is earned only, there is no premium
// currency, no random reward, no timer on a purchase. Saved on this device until the hosted backend exists.

export const PROGRESS_VERSION = 1;
export const PROGRESS_KEY = 'tsu.progress';

export const M_PER_MILE = 1609.344;
export const MPS_TO_MPH = 2.236936;

/** what makes a mile "active" */
export const ACTIVE = { minMph: 40, inputSecs: 30 };

/** cars that unlock by active miles (the Rossini GT is there from the start) */
export const CAR_MILES: Record<string, number> = { 'rossini-gt': 0, 'rossini-brio': 50, 'rossini-corsa': 150, 'vela-e': 300 };
export const MILE_CARS = Object.keys(CAR_MILES);

/** the traffic the menu will offer (Zero + Drift, Light, Medium, Extreme) and what a mile is worth in each. Until the
 *  menu's four modes land, today's five densities map onto them: None is Zero, Light is Light, Moderate is Medium,
 *  Heavy and Expert are Extreme. */
export type Tier = 'zero' | 'light' | 'medium' | 'extreme';
export const TIER_MULT: Record<Tier, number> = { zero: 0.5, light: 1, medium: 1.25, extreme: 1.5 };
export const TIER_LABEL: Record<Tier, string> = { zero: 'Zero traffic', light: 'Light', medium: 'Medium', extreme: 'Extreme' };
export function tierOf(density: string): Tier {
  return density === 'none' ? 'zero' : density === 'light' ? 'light' : density === 'moderate' || density === 'medium' ? 'medium' : density === 'heavy' || density === 'expert' || density === 'extreme' ? 'extreme' : 'medium';
}

/** Founders' Road: 500 Road Points by Dec 31, 2026 (Pacific) unlocks the OC Hypercar for free, forever */
export const FOUNDERS = { goal: 500, until: '2026-12-31T23:59:59-08:00', car: 'oc-hyper' };
export const foundersEnd = () => new Date(FOUNDERS.until).getTime();

/** cash per active mile at speed, on top of a run's own pay (modest, tunable): above 150 mph, and again above 200 mph */
export const SPEED_CASH = { over150: 6, over200: 10 };
export const SPEED_MPH = { a: 150, b: 200 };

/** venue time: Road Points a minute and a day's cap (an option, not a way to skip driving) */
export const VENUE_POINTS = { perMinute: 0.5, perDay: 50 };
/** Vega & Vinnie's "marketer" job: cash an active minute there, more while you socialise (talking, or ordering), a day's cap */
export const MARKETER = { perMinute: 10, socialPerMinute: 30, perDay: 400, socialSecs: 60 };
/** how long you may sit with nothing else before it stops counting as activity */
export const SIT_IDLE_SECS = 600;
/** a minute of standing still with no action is idle */
export const VENUE_IDLE_SECS = 30;

/** the one-time cash entry to a venue that asks one: Vega & Vinnie's (Stoppage Time) */
export const MEMBERSHIPS: Record<string, { name: string; price: number }> = { stoppage: { name: "Vega & Vinnie's", price: 1200 } };

/** a cash price for cosmetics (the garage's Marina Teal, one per car) */
export const COSMETIC_PRICE = 800;

export const BREAK_SECS = 3600;

// ------------------------------------------------------------------------------------------------ the venues' passports
export interface Spot { id: string; label: string }
export interface PassportVenue {
  id: string; name: string; note: string; spots: Spot[];
  badge: string;                         // the Regular badge (profile and run card)
  legend: { name: string; hex: number }; // the Local legend cosmetic: a paint named for the place
}
export const REGULAR_SECS = 3600, LEGEND_SECS = 18000;
export const PASSPORT: PassportVenue[] = [
  { id: 'lot57', name: 'Lot 57', note: 'Taproom and yard', badge: 'Lot 57 Regular',
    spots: [{ id: 'shed', label: 'The Shed' }, { id: 'yard', label: 'The yard' }, { id: 'lawn', label: 'The lawn' }, { id: 'trucks', label: 'Food-truck bay' }, { id: 'lot', label: 'The lot' }],
    legend: { name: 'Lot 57 Amber', hex: 0xd98a1c } },
  { id: 'stoppage', name: "Vega & Vinnie's", note: 'The Stoppage Time sports bar', badge: "Vega & Vinnie's Regular",
    spots: [{ id: 'bar', label: 'The bar' }, { id: 'patio', label: 'The patio' }, { id: 'games', label: 'Pool and darts' }, { id: 'booths', label: 'The booths' }, { id: 'front', label: 'The front walk' }, { id: 'lot', label: 'The lot' }],
    legend: { name: 'Vega Night', hex: 0x1f2f7a } },
];
export const passportVenue = (id: string) => PASSPORT.find((v) => v.id === id) ?? null;
export const LADDER = ['Not visited', 'First visit', 'Regular', 'Local legend'] as const;

export interface VenuePass { visits: number; first: number; stamps: string[]; spots: string[]; seconds: number; rung: 0 | 1 | 2 | 3 }
/** the stamps beside the spots: sat down, ordered, talked with someone (simulated people) */
export const ACTION_STAMPS = [{ id: 'sit', label: 'Sat down' }, { id: 'order', label: 'Ordered' }, { id: 'talk', label: 'Talked to someone' }];

// ------------------------------------------------------------------------------------------------ the goals
export type GoalKind = 'miles' | 'fast' | 'venue';
export interface Goal { id: string; kind: GoalKind; variant: string; target: number; progress: number; cash: number; points: number; done: boolean }
export interface Weekly { id: string; kind: 'miles' | 'fast' | 'venuemin'; target: number; progress: number; cash: number; points: number; done: boolean; week: string }

const DRIVE_VARIANTS = [{ n: 8, cash: 110 }, { n: 10, cash: 140 }, { n: 12, cash: 170 }];
const FAST_VARIANTS = [{ n: 15, cash: 120 }, { n: 20, cash: 150 }, { n: 25, cash: 180 }];
const VENUE_VARIANTS = [{ v: 'visit', cash: 120 }, { v: 'sit', cash: 130 }, { v: 'talk', cash: 140 }];
const WEEKLY = [
  { id: 'miles', kind: 'miles' as const, target: 100, cash: 600, points: 8 },
  { id: 'fast', kind: 'fast' as const, target: 180, cash: 500, points: 6 },
  { id: 'venuemin', kind: 'venuemin' as const, target: 30, cash: 500, points: 6 },
];
export const GOAL_POINTS = 2;
export const ALL_THREE_BONUS = 150;
export const STREAK_BONUS = { perDay: 20, maxDays: 7 };

/** the words on a goal, honest and plain */
export function goalText(g: Goal): string {
  if (g.kind === 'miles') return `Drive ${g.target} active miles`;
  if (g.kind === 'fast') return `Spend ${g.target} s above ${SPEED_MPH.a} mph`;
  return g.variant === 'sit' ? 'Sit down at a venue' : g.variant === 'talk' ? 'Talk to someone at a venue (simulated)' : 'Visit a venue';
}
export function weeklyText(w: Weekly): string {
  return w.kind === 'miles' ? `Drive ${w.target} active miles this week` : w.kind === 'fast' ? `Spend ${w.target / 60} min above ${SPEED_MPH.a} mph this week` : `Spend ${w.target} active minutes at a venue this week`;
}
/** every word the goals show the player: the guardrail test checks them for pressure and spending prompts */
export const GOAL_COPY = {
  panelNote: 'Goals are only ever earned by playing. Nothing here costs cash or money, and nothing on it is for sale.',
  streakNote: 'A day with one goal done keeps your streak. One free streak saver a week covers a single missed day.',
  breakNote: "You've been playing for an hour. Time for a break? Your progress is saved on this device.",
  saved: 'Saved on this device until the hosted accounts exist.',
};

// ------------------------------------------------------------------------------------------------ the saved state
export interface ProgressState {
  v: number;
  miles: number;                    // active miles, for good
  points: number;                   // Road Points: driving and venues
  venuePts: { day: string; n: number };
  marketer: { day: string; cash: number };
  announced: string[];              // cars whose unlock has been shown (or that were yours before the miles gate)
  unseen: string[];                 // cars opened but not yet seen in the garage (their card glows until then)
  hyper: { earnedAt: number | null };
  passport: Record<string, VenuePass>;
  access: string[];                 // venues you have joined (Vega & Vinnie's)
  cosmetics: string[];              // cash cosmetics owned: 'paint:<car>:<hex>'
  daily: { day: string; goals: Goal[]; bonus: boolean; fastToday: number; milesToday: number };
  streak: { count: number; best: number; last: string; saverWeek: string };
  weekly: Weekly | null;
  firstSeen: number;
}

export type ProgressEvent =
  | { type: 'carUnlock'; car: string; miles: number }
  | { type: 'hypercar'; points: number }
  | { type: 'goal'; goal: Goal; text: string }
  | { type: 'weekly'; weekly: Weekly; text: string }
  | { type: 'allthree'; cash: number }
  | { type: 'streak'; count: number; saver: boolean; cash: number }
  | { type: 'stamp'; venue: string; stamp: string; label: string }
  | { type: 'ladder'; venue: string; rung: number; label: string }
  | { type: 'cash'; amount: number; why: string }
  | { type: 'break' }
  | { type: 'member'; venue: string };

export interface Wallet { cash(): number; add(n: number): void }
export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

// ------------------------------------------------------------------------------------------------ dates (device-local days)
const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayNum = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);
/** the week's key: the Monday's day */
export const weekKey = (ms: number) => { const d = new Date(ms); const back = (d.getDay() + 6) % 7; return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime()); };
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const num = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function freshPass(): VenuePass { return { visits: 0, first: 0, stamps: [], spots: [], seconds: 0, rung: 0 }; }

function freshState(owned: string[], now: number): ProgressState {
  return {
    v: PROGRESS_VERSION, miles: 0, points: 0, venuePts: { day: '', n: 0 }, marketer: { day: '', cash: 0 },
    // anyone who already owns a car keeps it: those cars' unlock moments never fire
    announced: [...owned], unseen: [], hyper: { earnedAt: null }, passport: {}, access: [], cosmetics: [],
    daily: { day: '', goals: [], bonus: false, fastToday: 0, milesToday: 0 }, streak: { count: 0, best: 0, last: '', saverWeek: '' }, weekly: null, firstSeen: now,
  };
}

/** a saved state (or none) into this version's shape; `owned` are the cars the profile already holds */
export function migrate(raw: unknown, owned: string[], now: number): ProgressState {
  const base = freshState(owned, now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>, s = base;
  s.miles = Math.max(0, num(r.miles)); s.points = Math.max(0, num(r.points));
  const vp = (r.venuePts ?? {}) as Record<string, unknown>; s.venuePts = { day: String(vp.day ?? ''), n: Math.max(0, num(vp.n)) };
  const mk = (r.marketer ?? {}) as Record<string, unknown>; s.marketer = { day: String(mk.day ?? ''), cash: Math.max(0, num(mk.cash)) };
  s.announced = Array.isArray(r.announced) ? [...new Set([...strs(r.announced), ...owned])] : s.announced;
  s.unseen = strs(r.unseen);
  const hy = (r.hyper ?? {}) as Record<string, unknown>; s.hyper = { earnedAt: typeof hy.earnedAt === 'number' ? hy.earnedAt : null };
  const pp = (r.passport ?? {}) as Record<string, Record<string, unknown>>;
  for (const k of Object.keys(pp)) { const p = pp[k] ?? {}; s.passport[k] = { visits: num(p.visits), first: num(p.first), stamps: strs(p.stamps), spots: strs(p.spots), seconds: Math.max(0, num(p.seconds)), rung: ([0, 1, 2, 3].includes(num(p.rung)) ? num(p.rung) : 0) as 0 | 1 | 2 | 3 }; }
  s.access = strs(r.access); s.cosmetics = strs(r.cosmetics);
  const d = (r.daily ?? {}) as Record<string, unknown>;
  s.daily = { day: String(d.day ?? ''), goals: Array.isArray(d.goals) ? (d.goals as Goal[]).filter((g) => g && typeof g.id === 'string') : [], bonus: !!d.bonus, fastToday: num(d.fastToday), milesToday: num(d.milesToday) };
  const st = (r.streak ?? {}) as Record<string, unknown>; s.streak = { count: num(st.count), best: num(st.best), last: String(st.last ?? ''), saverWeek: String(st.saverWeek ?? '') };
  s.weekly = r.weekly && typeof r.weekly === 'object' ? (r.weekly as Weekly) : null;
  s.firstSeen = num(r.firstSeen, now);
  s.v = PROGRESS_VERSION;
  return s;
}

/** what the driver did with the controls this step */
export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean }
export interface TickIn {
  mps: number;                  // forward speed
  paid?: number;                // the speed that pays (capped under the hypercar's Free Drive earnings cap); default mps
  driving: boolean;             // in the car, in a run (not the menu's attract drive, not over, not parked or on foot)
  paused?: boolean;
  auto?: boolean;               // Auto-drive is steering
  wrongWay?: boolean;
  controls: Controls;
  tier: Tier;
}
export interface VenueIn { active: boolean; social?: boolean }

export class Progress {
  s: ProgressState;
  private listeners: ((e: ProgressEvent) => void)[] = [];
  // input detection (driver activity, in simulation seconds)
  private clock = 0;
  private lastInput = -1e9;
  private prev: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  private sinceSave = 0;
  // the play session (for the break reminder)
  private session = { secs: 0, last: 0, next: BREAK_SECS };
  private fastRun = 0;      // seconds in a row above 150 mph (shown, not paid on)
  private socialUntil = -1e9; private venueClock = 0;
  private run = { miles: 0, points: 0, cash: 0 };

  private store: StorageLike | null; private wallet: Wallet; private now: () => number;
  constructor(store: StorageLike | null, wallet: Wallet, now: () => number = Date.now, owned: string[] = ['rossini-gt']) {
    this.store = store; this.wallet = wallet; this.now = now;
    let raw: unknown = null;
    try { const t = store?.getItem(PROGRESS_KEY); raw = t ? JSON.parse(t) : null; } catch { raw = null; }
    this.s = migrate(raw, owned, now());
    this.roll();
  }
  on(fn: (e: ProgressEvent) => void) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  private emit(e: ProgressEvent) { for (const f of this.listeners) { try { f(e); } catch { /* a listener must not stop the game */ } } }
  save() { this.sinceSave = 0; try { this.store?.setItem(PROGRESS_KEY, JSON.stringify(this.s)); } catch { /* a convenience */ } }
  reset(owned: string[] = ['rossini-gt']) { this.s = freshState(owned, this.now()); this.roll(); this.save(); }

  // ------------------------------------------------------------------ cash
  private pay(amount: number, why: string, quiet = false) {
    if (!(amount > 0)) return;
    this.wallet.add(amount); this.run.cash += amount;
    if (!quiet) this.emit({ type: 'cash', amount, why });
  }
  /** spend earned cash: false (and nothing taken) if there is not enough */
  spend(amount: number): boolean {
    if (!(amount > 0) || this.wallet.cash() < amount) return false;
    this.wallet.add(-amount); return true;
  }

  // ------------------------------------------------------------------ driving
  /** every simulation step of a run (or any time you want the clock to move) */
  tick(dt: number, o: TickIn) {
    if (!(dt > 0)) return;
    this.clock += dt;
    const c = o.controls, p = this.prev;
    // driver activity: steering, braking, the handbrake, or a change of throttle. Auto-drive and the attract drive are not the driver.
    const touched = Math.abs(c.steer) > 0.02 || c.brake > 0.05 || c.handbrake || Math.abs(c.throttle - p.throttle) > 0.02 || Math.abs(c.steer - p.steer) > 0.01;
    this.prev = { throttle: c.throttle, brake: c.brake, steer: c.steer, handbrake: c.handbrake };
    if (!o.driving || o.auto) { this.sessionTick(dt, false); return; }
    if (touched) this.lastInput = this.clock;
    this.sessionTick(dt, !o.paused);
    if (o.paused || o.wrongWay) return;
    const mph = o.mps * MPS_TO_MPH;
    const active = mph > ACTIVE.minMph && this.clock - this.lastInput <= ACTIVE.inputSecs;
    this.roll();
    if (!active) { this.fastRun = 0; return; }
    const v = Math.min(o.mps, o.paid ?? o.mps), miles = Math.max(0, v) * dt / M_PER_MILE;
    const before = this.s.miles;
    this.s.miles += miles; this.s.daily.milesToday += miles; this.run.miles += miles;
    const pts = miles * TIER_MULT[o.tier];
    this.addPoints(pts, 'driving');
    // the speed bonus: cash per active mile above 150 mph and again above 200 mph
    const vm = v * MPS_TO_MPH;
    if (vm > SPEED_MPH.a) this.pay(miles * SPEED_CASH.over150, 'speed', true);
    if (vm > SPEED_MPH.b) this.pay(miles * SPEED_CASH.over200, 'speed', true);
    if (vm > SPEED_MPH.a) { this.fastRun += dt; this.s.daily.fastToday += dt; this.fastWeekly(dt); } else this.fastRun = 0;
    this.milesGoals(miles);
    this.unlocks(before);
    this.sinceSave += dt; if (this.sinceSave > 10) this.save();
  }
  /** the seconds in a row above 150 mph right now */
  get fastSecs() { return this.fastRun; }

  private unlocks(before: number) {
    for (const id of MILE_CARS) {
      const need = CAR_MILES[id];
      if (need > 0 && before < need && this.s.miles >= need) this.announce(id);
      else if (need > 0 && this.s.miles >= need && !this.s.announced.includes(id)) this.announce(id);
    }
  }
  private announce(id: string) {
    if (this.s.announced.includes(id)) return;
    this.s.announced.push(id); this.s.unseen.push(id); this.save();
    this.emit({ type: 'carUnlock', car: id, miles: this.s.miles });
  }

  // ------------------------------------------------------------------ the cars
  carNeed(id: string) { return CAR_MILES[id] ?? null; }
  carUnlocked(id: string) { const n = CAR_MILES[id]; return n !== undefined && this.s.miles >= n; }
  /** the miles gate's numbers for a garage card: "Unlocks at 150 mi · 87 / 150" */
  carGate(id: string): { need: number; have: number; frac: number; unlocked: boolean; text: string } | null {
    const need = CAR_MILES[id]; if (need === undefined) return null;
    const have = Math.min(this.s.miles, need), unlocked = this.s.miles >= need;
    return { need, have, frac: need ? have / need : 1, unlocked, text: unlocked ? 'Unlocked' : `Unlocks at ${need} mi · ${Math.floor(have)} / ${need}` };
  }
  unlockedCars(): string[] { return MILE_CARS.filter((id) => this.carUnlocked(id)); }
  /** a car opened but not yet seen in the garage: its card glows until the garage has shown it */
  glowing(id: string) { return this.s.unseen.includes(id); }
  clearGlow(id: string) { const i = this.s.unseen.indexOf(id); if (i >= 0) { this.s.unseen.splice(i, 1); this.save(); } }

  // ------------------------------------------------------------------ Road Points and Founders' Road
  addPoints(n: number, why = 'points') {
    if (!(n > 0)) return;
    const before = this.s.points;
    this.s.points += n; this.run.points += n;
    void why;
    if (!this.s.hyper.earnedAt && before < FOUNDERS.goal && this.s.points >= FOUNDERS.goal && this.now() <= foundersEnd()) {
      this.s.hyper.earnedAt = this.now(); this.s.unseen.push(FOUNDERS.car); this.save();
      this.emit({ type: 'hypercar', points: this.s.points });
    }
  }
  founders() {
    const now = this.now(), end = foundersEnd(), earned = !!this.s.hyper.earnedAt, over = now > end;
    const left = Math.max(0, end - now), days = Math.floor(left / 86400000), hours = Math.floor((left % 86400000) / 3600000);
    const pts = Math.floor(this.s.points * 10) / 10;
    return { points: pts, goal: FOUNDERS.goal, shown: Math.min(FOUNDERS.goal, Math.floor(this.s.points)), frac: Math.min(1, this.s.points / FOUNDERS.goal), earned, missed: over && !earned, open: !over && !earned, days, hours,
      text: earned ? 'OC Hypercar unlocked: yours for good' : over ? "Founders' Road closed on Dec 31, 2026" : `${Math.min(FOUNDERS.goal, Math.floor(this.s.points))} / ${FOUNDERS.goal} to the OC Hypercar` };
  }
  hypercarEarned() { return !!this.s.hyper.earnedAt; }
  /** the cars this profile holds because of its progress: the miles' cars and the earned Hypercar */
  earnedCars(): string[] { return [...this.unlockedCars(), ...(this.hypercarEarned() ? [FOUNDERS.car] : [])]; }

  // ------------------------------------------------------------------ the run's own numbers (the after-run line)
  runStart() { this.run = { miles: 0, points: 0, cash: 0 }; }
  runDelta() { return { ...this.run }; }

  // ------------------------------------------------------------------ cash spent
  hasAccess(venue: string) { return !MEMBERSHIPS[venue] || this.s.access.includes(venue); }
  /** join a venue that asks for cash (once): why-not text, or null */
  buyAccess(venue: string): string | null {
    const m = MEMBERSHIPS[venue]; if (!m) return 'No membership there';
    if (this.s.access.includes(venue)) return 'Already a member';
    if (!this.spend(m.price)) return `${Math.ceil(m.price - this.wallet.cash()).toLocaleString()} more cash needed`;
    this.s.access.push(venue); this.save(); this.emit({ type: 'member', venue });
    return null;
  }
  ownsCosmetic(id: string) { return this.s.cosmetics.includes(id); }
  buyCosmetic(id: string, price = COSMETIC_PRICE): string | null {
    if (this.s.cosmetics.includes(id)) return 'Already yours';
    if (!this.spend(price)) return `${Math.ceil(price - this.wallet.cash()).toLocaleString()} more cash needed`;
    this.s.cosmetics.push(id); this.save();
    return null;
  }

  // ------------------------------------------------------------------ the venue passport
  pass(venue: string): VenuePass { return (this.s.passport[venue] ??= freshPass()); }
  rungOf(venue: string) { return this.s.passport[venue]?.rung ?? 0; }
  /** stamps of a venue as the card shows them: each spot and action, found or not */
  stampList(venue: string) {
    const v = passportVenue(venue), p = this.s.passport[venue] ?? freshPass();
    return { spots: (v?.spots ?? []).map((sp) => ({ ...sp, found: p.spots.includes(sp.id) })), actions: ACTION_STAMPS.map((a) => ({ ...a, found: p.stamps.includes(a.id) })), visit: p.visits > 0 };
  }
  /** you walked in */
  venueEnter(venue: string) {
    const p = this.pass(venue);
    this.roll();
    this.venueClock = 0; this.socialUntil = -1e9;
    p.visits++;
    if (p.visits === 1) { p.first = this.now(); this.stampEvent(venue, 'visit', 'First visit'); }
    this.venueGoal('visit');
    this.rung(venue); this.save();
  }
  venueSpot(venue: string, spot: string) {
    const v = passportVenue(venue); if (!v || !v.spots.some((x) => x.id === spot)) return;
    const p = this.pass(venue);
    if (p.spots.includes(spot)) return;
    p.spots.push(spot); this.stampEvent(venue, 'spot:' + spot, `Found ${v.spots.find((x) => x.id === spot)!.label}`);
    this.rung(venue); this.save();
  }
  /** an action at the venue: 'sit', 'order' or 'talk' */
  venueDid(venue: string, what: 'sit' | 'order' | 'talk') {
    const p = this.pass(venue);
    if (what === 'order' || what === 'talk') this.socialUntil = this.venueClock + MARKETER.socialSecs;
    this.venueGoal(what);
    if (!p.stamps.includes(what)) { p.stamps.push(what); this.stampEvent(venue, what, ACTION_STAMPS.find((a) => a.id === what)!.label); this.save(); }
  }
  /** a slice of venue time: only an active one counts (walking, sitting, ordering, talking; not paused or idle) */
  venueTick(venue: string, dt: number, o: VenueIn) {
    if (!(dt > 0)) return;
    this.venueClock += dt;
    this.sessionTick(dt, o.active);
    if (!o.active) return;
    this.roll();
    const p = this.pass(venue), day = dayKey(this.now());
    p.seconds += dt;
    // Road Points, up to a day's cap
    if (this.s.venuePts.day !== day) this.s.venuePts = { day, n: 0 };
    const room = Math.max(0, VENUE_POINTS.perDay - this.s.venuePts.n), pts = Math.min(room, dt / 60 * VENUE_POINTS.perMinute);
    if (pts > 0) { this.s.venuePts.n += pts; this.addPoints(pts, 'venue'); }
    // Vega & Vinnie's marketer: cash an active minute there (members), more while you socialise, a day's cap
    if (venue === 'stoppage' && this.hasAccess('stoppage')) {
      if (this.s.marketer.day !== day) this.s.marketer = { day, cash: 0 };
      const social = o.social || this.venueClock <= this.socialUntil;
      const want = dt / 60 * (social ? MARKETER.socialPerMinute : MARKETER.perMinute), got = Math.min(want, Math.max(0, MARKETER.perDay - this.s.marketer.cash));
      if (got > 0) { this.s.marketer.cash += got; this.pay(got, 'marketer', true); }
    }
    this.venueWeekly(dt);
    this.rung(venue);
    this.sinceSave += dt; if (this.sinceSave > 10) this.save();
  }
  venueToday() { this.roll(); const day = dayKey(this.now()); return { points: this.s.venuePts.day === day ? this.s.venuePts.n : 0, pointsCap: VENUE_POINTS.perDay, cash: this.s.marketer.day === day ? this.s.marketer.cash : 0, cashCap: MARKETER.perDay }; }
  private stampEvent(venue: string, stamp: string, label: string) { this.emit({ type: 'stamp', venue, stamp, label }); }
  /** the ladder: First visit, Regular (every spot and an hour), Local legend (five hours) */
  private rung(venue: string) {
    const v = passportVenue(venue); if (!v) return;
    const p = this.pass(venue);
    let r: 0 | 1 | 2 | 3 = p.visits > 0 ? 1 : 0;
    if (r >= 1 && p.spots.length >= v.spots.length && p.seconds >= REGULAR_SECS) r = 2;
    if (r >= 2 && p.seconds >= LEGEND_SECS) r = 3;
    if (r > p.rung) { p.rung = r; this.emit({ type: 'ladder', venue, rung: r, label: `${LADDER[r]} at ${v.name}` }); this.save(); }
  }
  /** badges earned (Regular and up), for the profile and the run card */
  badges(): string[] { return PASSPORT.filter((v) => this.rungOf(v.id) >= 2).map((v) => v.badge); }
  /** venue paints earned (Local legend) */
  legendPaints(): { venue: string; name: string; hex: number }[] { return PASSPORT.filter((v) => this.rungOf(v.id) >= 3).map((v) => ({ venue: v.id, ...v.legend })); }
  legendFor(hex: number) { return PASSPORT.find((v) => v.legend.hex === hex) ?? null; }

  // ------------------------------------------------------------------ daily goals, the streak, the weekly challenge
  /** make today's goals (and this week's challenge) if the day or the week has turned */
  roll() {
    const now = this.now(), day = dayKey(now), week = weekKey(now), d = this.s.daily;
    if (d.day !== day) {
      const dv = DRIVE_VARIANTS[hash(day + 'm') % 3], fv = FAST_VARIANTS[hash(day + 'f') % 3], vv = VENUE_VARIANTS[hash(day + 'v') % 3];
      this.s.daily = { day, bonus: false, fastToday: 0, milesToday: 0, goals: [
        { id: 'drive', kind: 'miles', variant: String(dv.n), target: dv.n, progress: 0, cash: dv.cash, points: GOAL_POINTS, done: false },
        { id: 'fast', kind: 'fast', variant: String(fv.n), target: fv.n, progress: 0, cash: fv.cash, points: GOAL_POINTS, done: false },
        { id: 'venue', kind: 'venue', variant: vv.v, target: 1, progress: 0, cash: vv.cash, points: GOAL_POINTS, done: false },
      ] };
    }
    if (!this.s.weekly || this.s.weekly.week !== week) {
      const w = WEEKLY[hash(week + 'w') % 3];
      this.s.weekly = { ...w, week, progress: 0, done: false };
    }
  }
  private completeGoal(g: Goal) {
    if (g.done) return;
    g.done = true; g.progress = g.target;
    this.pay(g.cash, 'goal', true); this.addPoints(g.points, 'goal');
    this.emit({ type: 'goal', goal: g, text: goalText(g) });
    this.streakTouch();
    const d = this.s.daily;
    if (!d.bonus && d.goals.every((x) => x.done)) { d.bonus = true; this.pay(ALL_THREE_BONUS, 'all three', true); this.emit({ type: 'allthree', cash: ALL_THREE_BONUS }); }
    this.save();
  }
  private milesGoals(miles: number) {
    const g = this.s.daily.goals.find((x) => x.kind === 'miles');
    if (g && !g.done) { g.progress = Math.min(g.target, this.s.daily.milesToday); if (g.progress >= g.target) this.completeGoal(g); }
    const w = this.s.weekly;
    if (w && w.kind === 'miles' && !w.done) { w.progress = Math.min(w.target, w.progress + miles); if (w.progress >= w.target) this.completeWeekly(w); }
  }
  private fastWeekly(dt: number) {
    const g = this.s.daily.goals.find((x) => x.kind === 'fast');
    if (g && !g.done) { g.progress = Math.min(g.target, this.s.daily.fastToday); if (g.progress >= g.target) this.completeGoal(g); }
    const w = this.s.weekly;
    if (w && w.kind === 'fast' && !w.done) { w.progress = Math.min(w.target, w.progress + dt); if (w.progress >= w.target) this.completeWeekly(w); }
  }
  private venueWeekly(dt: number) {
    const w = this.s.weekly;
    if (w && w.kind === 'venuemin' && !w.done) { w.progress = Math.min(w.target, w.progress + dt / 60); if (w.progress >= w.target) this.completeWeekly(w); }
  }
  private venueGoal(what: 'visit' | 'sit' | 'order' | 'talk') {
    this.roll();
    const g = this.s.daily.goals.find((x) => x.kind === 'venue');
    if (g && !g.done && (g.variant === 'visit' || g.variant === what)) { g.progress = 1; this.completeGoal(g); }
  }
  private completeWeekly(w: Weekly) {
    if (w.done) return;
    w.done = true; w.progress = w.target;
    this.pay(w.cash, 'weekly', true); this.addPoints(w.points, 'weekly');
    this.emit({ type: 'weekly', weekly: w, text: weeklyText(w) }); this.save();
  }
  /** the first goal of a day moves the streak on: tomorrow it is +1, a single missed day is covered by the week's saver */
  private streakTouch() {
    const now = this.now(), day = dayKey(now), st = this.s.streak;
    if (st.last === day) return;
    let saver = false;
    if (!st.last) st.count = 1;
    else {
      const gap = daysBetween(st.last, day);
      if (gap === 1) st.count++;
      else if (gap === 2 && st.saverWeek !== weekKey(now)) { st.count++; st.saverWeek = weekKey(now); saver = true; }
      else st.count = 1;
    }
    st.last = day; st.best = Math.max(st.best, st.count);
    const cash = STREAK_BONUS.perDay * Math.min(st.count, STREAK_BONUS.maxDays);
    if (st.count > 1) this.pay(cash, 'streak', true);
    this.emit({ type: 'streak', count: st.count, saver, cash: st.count > 1 ? cash : 0 });
  }
  /** the streak as the panel shows it: its length now, whether it is safe, and whether the week's saver is free */
  streakView() {
    const now = this.now(), day = dayKey(now), st = this.s.streak;
    const saverFree = st.saverWeek !== weekKey(now);
    if (!st.last) return { count: 0, best: st.best, today: false, alive: false, saverFree, text: 'Complete one goal to start a streak' };
    const gap = daysBetween(st.last, day);
    if (gap === 0) return { count: st.count, best: st.best, today: true, alive: true, saverFree, text: `${st.count}-day streak · today's is in` };
    if (gap === 1) return { count: st.count, best: st.best, today: false, alive: true, saverFree, text: `${st.count}-day streak · one goal today keeps it` };
    if (gap === 2 && saverFree) return { count: st.count, best: st.best, today: false, alive: true, saverFree, text: `${st.count}-day streak · this week's free saver covers the missed day` };
    return { count: 0, best: st.best, today: false, alive: false, saverFree, text: 'A new streak starts with your next goal' };
  }
  goals() { this.roll(); return { daily: this.s.daily.goals, bonus: this.s.daily.bonus, weekly: this.s.weekly!, streak: this.streakView() }; }

  // ------------------------------------------------------------------ the play session (a break after an hour)
  private sessionTick(dt: number, playing: boolean) {
    const n = this.now(), s = this.session;
    if (s.last && n - s.last > 300000) { s.secs = 0; s.next = BREAK_SECS; }          // a gap of over five minutes is a break already
    if (!playing) return;
    s.last = n; s.secs += dt;
    if (s.secs >= s.next) { s.next += BREAK_SECS; this.emit({ type: 'break' }); }
  }
  get sessionSecs() { return this.session.secs; }
}
