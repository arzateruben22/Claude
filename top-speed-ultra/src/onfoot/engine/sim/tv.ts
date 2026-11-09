// The screens' fictional schedule and simulated matches (PROJECT_OC_SPORTS_BAR.md, "The games on the screens", "The
// featured match", "The match model"). Nothing is live: every fixture, event and score is generated from a seed, the
// hash of the venue's noise seed, the ISO week, the day, the slot and the channel, so the same clock always gives the
// same fixtures and scores. Times here are absolute sim minutes: A = week * 10080 + isoDay * 1440 + minute of the day,
// isoDay Monday 0 .. Sunday 6 (the ISO week a Sunday ends), so a calendar day d (Sunday 0 .. Saturday 6) is isoDay
// (d + 6) % 7.
import { hash32, mulberry, expo } from './rng';
import { LEAGUES, League, LeagueId, Team } from './leagues';
import type { Schedule } from '../schedule';
import { businessDay, isOpen } from '../schedule';

export const WEEK = 10080, DAY = 1440;
export const isoOf = (day: number) => (((day % 7) + 7) % 7 + 6) % 7;
export const dayOfIso = (iso: number) => (iso + 1) % 7;
export const absMinute = (week: number, day: number, hour: number) => week * WEEK + isoOf(day) * DAY + hour * 60;
export function fromAbs(a: number) { const week = Math.floor(a / WEEK), r = a - week * WEEK, iso = Math.floor(r / DAY), m = r - iso * DAY; return { week, iso, day: dayOfIso(iso), hour: m / 60, minute: m }; }
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hhmm = (min: number) => { const m = ((Math.round(min) % DAY) + DAY) % DAY; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export type EventKind = 'goal' | 'bigChance' | 'td' | 'fg' | 'bigPlay' | 'final';
export interface TvEvent { channel: 1 | 2; kind: EventKind; team: string; intensity: number; t: number; fixture: string; score: [number, number]; label: string }
export interface Fixture {
  id: string; channel: 1 | 2; league: LeagueId; day: number; week: number; slot: number;
  ko: number; fw: number; home: Team; away: Team; events: TvEvent[]; final: [number, number]; featured: boolean;
}
/** the windows by calendar day (Sunday 0 .. Saturday 6), in minutes of the day: [start, end] */
const MARIGOLD: Record<number, [number, number]> = { 3: [19 * 60, 23 * 60], 5: [19 * 60, 23 * 60], 6: [12 * 60, 23.5 * 60], 0: [11 * 60, 16 * 60] };
const GRIDIRON: Record<number, [number, number]> = { 0: [10 * 60, 20 * 60], 1: [17.5 * 60, 22 * 60], 4: [17.5 * 60, 22 * 60] };
/** Marigold: 10-minute halves, a 5-minute half-time, the final whistle 25 minutes after kick-off, a kick-off every 30;
 *  gridiron: 6-minute quarters, 2-minute breaks after the first and third, a 6-minute half-time, the whistle at 34,
 *  a kick-off every 45 */
export const FORMAT = { marigold: { every: 30, length: 25, card: 5 }, gridiron: { every: 45, length: 34, card: 5 } };
/** the featured fixture by calendar day: its channel and kick-off (minutes of the day); Tuesday has none */
export const FEATURED: Record<number, { channel: 1 | 2; ko: number } | null> = {
  0: { channel: 2, ko: 14.5 * 60 }, 1: { channel: 2, ko: 19 * 60 }, 2: null, 3: { channel: 1, ko: 20 * 60 },
  4: { channel: 2, ko: 19 * 60 }, 5: { channel: 1, ko: 20 * 60 }, 6: { channel: 1, ko: 20 * 60 },
};
/** the big screen's channel by calendar day (Marigold on Wednesday, Friday and Saturday; gridiron on Sunday, Monday and
 *  Thursday; highlights on Tuesday) */
export const BIG_CHANNEL: Record<number, 1 | 2 | 3> = { 0: 2, 1: 2, 2: 3, 3: 1, 4: 2, 5: 1, 6: 1 };

/** Marigold real minutes after kick-off for a match minute (the half-time break after 10) */
const mgReal = (mm: number) => (mm < 10 ? mm : mm + 5);
/** gridiron real minutes after kick-off for a game-clock minute (the breaks after each quarter) */
const grReal = (gc: number) => gc + (gc >= 6 ? 2 : 0) + (gc >= 12 ? 6 : 0) + (gc >= 18 ? 2 : 0);

/** a pairing of two team indices, home first */
type Pair = [number, number];
const sameTeams = (p: Pair, q: Pair) => (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);
const shares = (p: Pair, q: Pair) => p[0] === q[0] || p[0] === q[1] || p[1] === q[0] || p[1] === q[1];
const byT = (p: TvEvent, q: TvEvent) => p.t - q.t;

export class Tv {
  /** fixtures by day, keyed week * 7 + day (a number: no string built per call) */
  private cache = new Map<number, Fixture[]>();
  private pairCache = new Map<number, Pair[]>();
  private evBuf: TvEvent[] = [];
  constructor(private noiseSeed: number, private schedule: Schedule) {}

  /**
   * A league's pairings for a calendar day, slot by slot: a seeded round-robin. The circle method over the league's
   * eight teams (in a seeded order) gives 7 rounds of 4 matches, 28 pairings, each pair of teams once; the rounds and
   * the matches inside each round are put in a seeded order, and each round's first match is swapped for one sharing
   * no team with the round before's last (two of a round's four always qualify), so no team plays two slots in a row
   * and no pairing repeats within a day (Saturday's Marigold window has 23 slots, Sunday's gridiron 13). When the day
   * before has its featured match in the same league (Friday and Saturday's Marigold, Sunday and Monday's gridiron),
   * the draw is salted again until the two featured pairings differ. Deterministic: the seed is the venue's noise
   * seed, the ISO week, the day, the channel and the salt.
   */
  pairings(lg: League, week: number, day: number, depth = 0): Pair[] {
    const d = ((day % 7) + 7) % 7, key = (week * 7 + d) * 2 + (lg.channel - 1);
    const hit = this.pairCache.get(key); if (hit) return hit;
    const f = FEATURED[d], fSlot = f && f.channel === lg.channel ? this.slotOf(lg, d, f.ko) : -1;
    // the day before (a Monday's is the previous ISO week's Sunday)
    let avoid: Pair | null = null;
    if (fSlot >= 0 && depth < 2) {
      const pd = (d + 6) % 7, pw = d === 1 ? week - 1 : week, pf = FEATURED[pd];
      if (pf && pf.channel === lg.channel) avoid = this.pairings(lg, pw, pd, depth + 1)[this.slotOf(lg, pd, pf.ko)] ?? null;
    }
    let out: Pair[] = [];
    for (let salt = 0; salt < 16; salt++) {
      out = this.roundRobin(lg, week, d, salt);
      if (!avoid || fSlot < 0 || !sameTeams(out[fSlot % out.length], avoid)) break;
    }
    if (this.pairCache.size > 128) this.pairCache.clear();
    this.pairCache.set(key, out);
    return out;
  }
  /** the slot index of a kick-off (minutes of the day) in a league's window on a calendar day, or -1 */
  private slotOf(lg: League, day: number, ko: number) {
    const win = (lg.id === 'marigold' ? MARIGOLD : GRIDIRON)[day]; if (!win) return -1;
    const k = (ko - win[0]) / FORMAT[lg.id].every; return Number.isInteger(k) && k >= 0 ? k : -1;
  }
  private roundRobin(lg: League, week: number, day: number, salt: number): Pair[] {
    const r = mulberry(hash32(this.noiseSeed, 'pairs', week, day, lg.channel, salt)), n = lg.teams.length;
    const shuffle = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const t = shuffle(Array.from({ length: n }, (_, i) => i)), fixed = t[n - 1], rot = t.slice(0, n - 1), m = rot.length;
    const rounds: Pair[][] = [];
    for (let k = 0; k < m; k++) {
      const round: Pair[] = [[rot[k], fixed]];
      for (let i = 1; i < n / 2; i++) round.push([rot[(k + i) % m], rot[(k - i + m) % m]]);
      rounds.push(shuffle(round));
    }
    shuffle(rounds);
    const out: Pair[] = [];
    for (const round of rounds) {
      const last = out[out.length - 1];
      if (last && shares(round[0], last)) { const j = round.findIndex((p) => !shares(p, last)); [round[0], round[j]] = [round[j], round[0]]; }
      for (const p of round) out.push(r() < 0.5 ? p : [p[1], p[0]]);
    }
    return out;
  }

  /** a team's attack and defence (0.8 to 1.2), seeded per season */
  rating(t: Team, season = 0) { const r = mulberry(hash32(this.noiseSeed, 'rating', t.league, t.idx, season)); return { att: 0.8 + 0.4 * r(), def: 0.8 + 0.4 * r() }; }

  /** every fixture on a calendar day of an ISO week, both channels, kick-off order */
  fixtures(week: number, day: number): Fixture[] {
    const d = ((day % 7) + 7) % 7, key = week * 7 + d;
    const hit = this.cache.get(key); if (hit) return hit;
    const out: Fixture[] = [];
    const base = week * WEEK + isoOf(d) * DAY;
    for (const [lg, win] of [[LEAGUES.marigold, MARIGOLD[d]], [LEAGUES.gridiron, GRIDIRON[d]]] as [League, [number, number] | undefined][]) {
      if (!win) continue;
      const F = FORMAT[lg.id];
      for (let slot = 0, ko = win[0]; ko + F.length <= win[1]; slot++, ko += F.every) out.push(this.make(lg, week, d, slot, base + ko));
    }
    out.sort((a, b) => a.ko - b.ko);
    if (this.cache.size > 64) this.cache.clear();
    this.cache.set(key, out);
    return out;
  }
  private make(lg: League, week: number, day: number, slot: number, ko: number): Fixture {
    // the teams: the day's round-robin (pairings()); the match itself: seed = hash(noise seed, week, day, slot, channel)
    const seed = hash32(this.noiseSeed, week, day, slot, lg.channel), r = mulberry(seed);
    const pairs = this.pairings(lg, week, day), [a, b] = pairs[slot % pairs.length];
    const home = lg.teams[a], away = lg.teams[b];
    const f = FEATURED[day];
    const fx: Fixture = { id: `${lg.id}-${week}-${day}-${slot}`, channel: lg.channel, league: lg.id, day, week, slot, ko, fw: ko + FORMAT[lg.id].length, home, away, events: [], final: [0, 0], featured: !!f && f.channel === lg.channel && f.ko === ko - (week * WEEK + isoOf(day) * DAY) };
    const score: [number, number] = [0, 0];
    const push = (kind: EventKind, side: 0 | 1, intensity: number, t: number, label: string) => fx.events.push({ channel: lg.channel, kind, team: side ? away.abbr : home.abbr, intensity, t, fixture: fx.id, score: [score[0], score[1]], label });
    if (lg.id === 'marigold') {
      // per team per minute, a chance at rate 0.35 x attack / defence; on target with p 0.45; an on-target chance
      // scores with p 0.32 (about 2 goals a match), otherwise it's a big chance (about 4 a match)
      const ra = [this.rating(home), this.rating(away)];
      const chances: { side: 0 | 1; mm: number; u1: number; u2: number }[] = [];
      for (const side of [0, 1] as const) {
        const rate = 0.35 * ra[side].att / ra[1 - side].def;
        for (let mm = expo(r, rate); mm < 20; mm += expo(r, rate)) chances.push({ side, mm, u1: r(), u2: r() });
      }
      chances.sort((p, q) => p.mm - q.mm);
      for (const c of chances) {
        if (c.u1 >= 0.45) continue;
        const t = ko + mgReal(c.mm), minute = Math.min(20, Math.floor(c.mm) + 1);
        if (c.u2 < 0.32) { score[c.side]++; push('goal', c.side, 1, t, `${minute}'`); }
        else push('bigChance', c.side, 0.45 + 0.35 * c.u2, t, `${minute}'`);
      }
    } else {
      // possessions alternate, 1.5 to 3 minutes of game clock each: touchdown 0.24, field goal 0.16, punt 0.45,
      // turnover 0.15; a big play inside a drive with p 0.35
      let gc = 0, side: 0 | 1 = r() < 0.5 ? 0 : 1;
      while (gc < 24) {
        const len = 1.5 + 1.5 * r(), end = Math.min(24, gc + len), u = r(), big = r() < 0.35, bt = gc + len * (0.25 + 0.5 * r());
        const q = (x: number) => `Q${Math.min(4, Math.floor(x / 6) + 1)} ${clockLeft(x)}`;
        if (big && bt < 24) push('bigPlay', side, 0.5, ko + grReal(bt), q(bt));
        if (end >= gc + len - 1e-9) {
          if (u < 0.24) { score[side] += 7; push('td', side, 1, ko + grReal(end), q(end)); }
          else if (u < 0.40) { score[side] += 3; push('fg', side, 0.6, ko + grReal(end), q(end)); }
        }
        gc = end; side = (1 - side) as 0 | 1;
      }
    }
    fx.final = [score[0], score[1]];
    fx.events.push({ channel: lg.channel, kind: 'final', team: score[0] > score[1] ? home.abbr : score[1] > score[0] ? away.abbr : '', intensity: 0.8, t: fx.fw, fixture: fx.id, score: [score[0], score[1]], label: lg.id === 'marigold' ? 'Full time' : 'Final' });
    return fx;
  }

  /** the day's featured fixture (a calendar day of an ISO week), or null (Tuesday) */
  featured(week: number, day: number): Fixture | null { return this.fixtures(week, day).find((f) => f.featured) ?? null; }
  /** the crowd's x1.25: from 30 minutes before the day's featured kick-off to its final whistle, otherwise 1 */
  featuredFactor(week: number, day: number, hour: number) {
    const f = this.featured(week, day); if (!f) return 1;
    const a = absMinute(week, day, hour);
    return a >= f.ko - 30 && a <= f.fw ? 1.25 : 1;
  }
  /** Friday and Saturday from the featured match's final whistle (never before 20:00) until close; 00:00 to 02:00
   *  belongs to the business day that opened the evening */
  gameNight(week: number, day: number, hour: number) {
    if (!isOpen(this.schedule, day, hour)) return false;
    const b = businessDay(this.schedule, day, hour);
    if (b.day !== 5 && b.day !== 6) return false;
    // the business day's own week: going back past Monday 00:00 (a Sunday-morning hour of Saturday's evening) stays
    // in the same ISO week, since a Sunday belongs to the week it ends
    const wk = week, f = this.featured(wk, b.day); if (!f) return false;
    const fwMin = f.fw - (wk * WEEK + isoOf(b.day) * DAY);
    return b.hour * 60 >= Math.max(20 * 60, fwMin);
  }

  /** the fixture in play on a channel at an absolute minute (kick-off to final whistle), or null */
  inPlay(channel: 1 | 2, a: number): Fixture | null {
    const { week, day } = fromAbs(a);
    return this.fixtures(week, day).find((f) => f.channel === channel && a >= f.ko && a < f.fw) ?? null;
  }
  /** what a channel shows at a minute: a fixture (in play, or its score card for 5 minutes after), the next one, or off air */
  onChannel(channel: 1 | 2, a: number): { fixture: Fixture | null; phase: 'play' | 'half' | 'card' | 'next' | 'off'; next: Fixture | null } {
    const { week, day } = fromAbs(a), list = this.fixtures(week, day).filter((f) => f.channel === channel);
    for (const f of list) {
      if (a >= f.ko && a < f.fw) {
        const m = a - f.ko, half = f.league === 'marigold' ? m >= 10 && m < 15 : m >= 14 && m < 20;
        return { fixture: f, phase: half ? 'half' : 'play', next: null };
      }
      if (a >= f.fw && a < f.fw + FORMAT[f.league].card) return { fixture: f, phase: 'card', next: list.find((g) => g.ko > a) ?? null };
    }
    const next = list.find((f) => f.ko > a) ?? null;
    return { fixture: null, phase: next ? 'next' : 'off', next: next ?? this.nextOnChannel(channel, a) };
  }
  /** the next fixture on a channel within a week */
  nextOnChannel(channel: 1 | 2, a: number): Fixture | null {
    for (let k = 0; k < 8; k++) { const { week, day } = fromAbs(a + k * DAY); const f = this.fixtures(week, day).find((x) => x.channel === channel && x.ko > a); if (f) return f; }
    return null;
  }
  /** the big screen's channel now: the day's featured channel, or highlights on Tuesday and whenever that channel has
   *  no fixture in play */
  bigChannel(a: number): 1 | 2 | 3 {
    const { day } = fromAbs(a), c = BIG_CHANNEL[day];
    if (c === 3) return 3;
    return this.inPlay(c, a) ? c : 3;
  }
  /** the score of a fixture at a minute */
  scoreAt(f: Fixture, a: number): [number, number] {
    let s: [number, number] = [0, 0];
    for (const e of f.events) { if (e.t > a) break; if (e.kind === 'goal' || e.kind === 'td' || e.kind === 'fg' || e.kind === 'final') s = e.score; }
    return s;
  }
  /** the match clock's label at a minute: "14'" (Marigold) or "Q2 3:12" (gridiron) */
  clockLabel(f: Fixture, a: number): string {
    const m = a - f.ko;
    if (f.league === 'marigold') { const mm = m < 10 ? m : m < 15 ? 10 : m - 5; return `${Math.min(20, Math.floor(mm) + 1)}'`; }
    const gc = m < 6 ? m : m < 8 ? 6 : m < 14 ? m - 2 : m < 20 ? 12 : m < 26 ? m - 8 : m < 28 ? 18 : m - 10;
    return `Q${Math.min(4, Math.floor(Math.min(23.999, gc) / 6) + 1)} ${clockLeft(Math.min(23.999, gc))}`;
  }
  /** every event on both channels with t in (a0, a1], in time order, into `out` (cleared first; by default a buffer
   *  this schedule reuses, so read it before the next call) */
  eventsBetween(a0: number, a1: number, out: TvEvent[] = this.evBuf): TvEvent[] {
    out.length = 0;
    if (a1 <= a0) return out;
    // day starts: absolute minutes are whole days from 0, so a day starts at a multiple of DAY
    for (let a = Math.floor(a0 / DAY) * DAY, end = Math.floor(a1 / DAY) * DAY; a <= end; a += DAY) {
      const week = Math.floor(a / WEEK), day = dayOfIso(Math.round((a - week * WEEK) / DAY));
      const list = this.fixtures(week, day);
      for (let i = 0; i < list.length; i++) { const f = list[i]; if (f.ko > a1 || f.fw <= a0) continue; for (const e of f.events) if (e.t > a0 && e.t <= a1) out.push(e); }
    }
    if (out.length > 1) out.sort(byT);
    return out;
  }
  /** the highlights channel at a minute: the newest scores (goals, touchdowns, field goals) of the day's completed
   *  fixtures, up to 12; until the day's first final whistle, and all of Tuesday, the previous match day's under its
   *  name */
  highlights(a: number): { title: string; day: number; items: { e: TvEvent; f: Fixture }[] } {
    const { week, day } = fromAbs(a), today = this.fixtures(week, day);
    const first = today.length ? Math.min(...today.map((f) => f.fw)) : Infinity;
    const pick = (list: Fixture[], upTo: number) => {
      const items: { e: TvEvent; f: Fixture }[] = [];
      for (const f of list) if (f.fw <= upTo) for (const e of f.events) if (e.kind === 'goal' || e.kind === 'td' || e.kind === 'fg') items.push({ e, f });
      return items.sort((p, q) => q.e.t - p.e.t).slice(0, 12);
    };
    if (today.length && a >= first) return { title: "Today's highlights · simulated", day, items: pick(today, a) };
    // the previous match day, regenerated from its seeds
    for (let k = 1; k <= 7; k++) {
      const p = fromAbs(a - k * DAY), list = this.fixtures(p.week, p.day);
      if (list.length) return { title: `${DAY_NAMES[p.day]}'s highlights · simulated`, day: p.day, items: pick(list, Infinity) };
    }
    return { title: 'Highlights · simulated', day, items: [] };
  }
  /** a plain description of a fixture for the guide and the hooks */
  describe(f: Fixture, a: number) {
    const playing = a >= f.ko && a < f.fw;
    return {
      id: f.id, channel: f.channel, league: LEAGUES[f.league].name, slot: f.slot, kickoff: hhmm(f.ko), finalWhistle: hhmm(f.fw), ko: f.ko, fw: f.fw,
      home: f.home.abbr, away: f.away.abbr, homeName: f.home.name, awayName: f.away.name, featured: f.featured,
      state: a < f.ko ? 'upcoming' : playing ? 'in play' : 'finished', score: this.scoreAt(f, a), final: f.final,
      events: f.events.map((e) => ({ kind: e.kind, team: e.team, t: e.t, at: hhmm(e.t), label: e.label, score: e.score, intensity: +e.intensity.toFixed(2) })),
    };
  }
}
/** a gridiron quarter's clock, counting down from 6:00 */
function clockLeft(gc: number) { const q = gc % 6, left = Math.max(0, 6 - q), mm = Math.floor(left), ss = Math.floor((left - mm) * 60); return `${mm}:${String(ss).padStart(2, '0')}`; }
export { hhmm };
