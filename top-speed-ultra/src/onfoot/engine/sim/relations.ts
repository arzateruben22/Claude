// Relationships and memory (PROJECT_OC_SPORTS_BAR.md, "Relationships and memory"). Pure: no three.js, no page, no
// storage of its own (the page saves what toSave() gives it). Two numbers per pair, as The Sims 2 kept daily and
// lifetime relationships:
//   - rapport, -100..100, this visit; it fades toward 0 by 1.5 a sim minute once the pair has gone 5 sim minutes
//     without interacting;
//   - friendship, -100..100, lasting (persisted for regulars and the player only); it fades toward 0 by 0.5 per device
//     day apart, and never below 20 once it has reached 45 (old friends stay friendly).
// An outcome's delta d updates both: rapport += d (1 - |rapport| / 150); friendship += k d (1 - |friendship| / 150),
// k 0.35 when d > 0 and 0.15 when it's negative. Each pair keeps a ring of its last 8 memories and up to 3 highlights
// (the first meeting and the biggest moments). Pairs are sparse: at most 64 tracked per person, the weakest and oldest
// dropped first. Levels come from friendship (Stranger when never met).
export type PersonId = string;
export interface Memory { t: number; kind: string; good: boolean; delta: number; ctx?: string }
export interface Rel {
  a: PersonId; b: PersonId;
  rapport: number; friendship: number;
  /** the highest friendship this pair has reached (the old-friends floor needs it) */
  best: number;
  /** sim minutes: first met, last interaction */
  met: number; last: number;
  mem: Memory[]; highlights: Memory[];
  /** good exchanges this visit (Talk's "Great chat" after 3) and whether this visit's Great chat has happened */
  exchanges: number; greatChat: boolean;
}
export const MEM_RING = 8, HIGHLIGHTS = 3, PER_PERSON = 64;
export const RAPPORT_FADE = 1.5, RAPPORT_QUIET = 5, FRIEND_FADE_DAY = 0.5, OLD_FRIEND = 45, OLD_FLOOR = 20;
/** a moment big enough to be a highlight (ours: an outcome of 8 or more either way: a round, a landed joke, a high-five,
 *  a console, an introduction's start) */
export const HIGHLIGHT_MIN = 8;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** the plan's rapport update */
export const rapportStep = (r: number, d: number) => clamp(r + d * (1 - Math.abs(r) / 150), -100, 100);
/** the plan's friendship update (k 0.35 for a good outcome, 0.15 for a bad one) */
export const friendStep = (f: number, d: number) => clamp(f + (d > 0 ? 0.35 : 0.15) * d * (1 - Math.abs(f) / 150), -100, 100);

export type Level = 'Stranger' | 'Acquaintance' | 'Friendly' | 'Friend' | 'Good friend' | 'Awkward' | 'Cold';
/** the level from friendship (rounded to a whole number first): never met Stranger; 0 to 19 Acquaintance; 20 to 44
 *  Friendly; 45 to 74 Friend; 75 and up Good friend; -1 to -29 Awkward; -30 and below Cold */
export function levelOf(rel: Rel | null): Level {
  if (!rel) return 'Stranger';
  const f = Math.round(rel.friendship);
  return f >= 75 ? 'Good friend' : f >= 45 ? 'Friend' : f >= 20 ? 'Friendly' : f >= 0 ? 'Acquaintance' : f > -30 ? 'Awkward' : 'Cold';
}
/** the "Getting along" chip: rapport of 30 and up this visit */
export const gettingAlong = (rel: Rel | null) => !!rel && rel.rapport >= 30;

export interface SavedRel { a: PersonId; b: PersonId; f: number; best: number; met: number; last: number; mem: Memory[]; hl: Memory[] }

export class Relations {
  private pairs = new Map<string, Rel>();
  private by = new Map<PersonId, Set<string>>();
  /** the same pairs by each side's id, both ways round: get() and met() look a pair up with no new string (the decisions
   *  ask for pairs many times a frame) */
  private idx = new Map<PersonId, Map<PersonId, Rel>>();
  static key(a: PersonId, b: PersonId) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
  get size() { return this.pairs.size; }
  get(a: PersonId, b: PersonId): Rel | null { return this.idx.get(a)?.get(b) ?? null; }
  /** both have met (nobody pairs with themselves) */
  met(a: PersonId, b: PersonId) { return a !== b && !!this.idx.get(a)?.has(b); }
  private link(a: PersonId, b: PersonId, r: Rel | null) {
    for (const [x, y] of [[a, b], [b, a]] as [PersonId, PersonId][]) {
      let m = this.idx.get(x);
      if (r) { if (!m) { m = new Map(); this.idx.set(x, m); } m.set(y, r); }
      else if (m) { m.delete(y); if (!m.size) this.idx.delete(x); }
    }
  }
  /** every pair of a person */
  of(id: PersonId): Rel[] { const s = this.by.get(id); if (!s) return []; const out: Rel[] = []; for (const k of s) { const r = this.pairs.get(k); if (r) out.push(r); } return out; }
  other(r: Rel, id: PersonId) { return r.a === id ? r.b : r.a; }
  /** the pair, made at their first meeting (its first highlight) if it's new; the 64-a-person cap drops the weakest and
   *  oldest of each side first. A person can't pair with themselves: nothing is stored for that */
  meet(a: PersonId, b: PersonId, t: number, o: { rapport?: number; friendship?: number; ctx?: string } = {}): Rel {
    // a person can't pair with themselves: a record that's never stored (the callers refuse it first; this keeps the
    // pairs clean if one doesn't)
    if (a === b) return { a, b, rapport: 0, friendship: 0, best: 0, met: t, last: t, mem: [], highlights: [], exchanges: 0, greatChat: false };
    let r = this.get(a, b);
    if (r) return r;
    const k = Relations.key(a, b);
    for (const id of [a, b]) this.makeRoom(id);
    const [x, y] = a < b ? [a, b] : [b, a];
    const first: Memory = { t, kind: 'met', good: true, delta: 0, ctx: o.ctx };
    r = { a: x, b: y, rapport: o.rapport ?? 0, friendship: o.friendship ?? 0, best: Math.max(0, o.friendship ?? 0), met: t, last: t, mem: [first], highlights: [first], exchanges: 0, greatChat: false };
    this.pairs.set(k, r); this.link(a, b, r);
    for (const id of [a, b]) { let s = this.by.get(id); if (!s) { s = new Set(); this.by.set(id, s); } s.add(k); }
    return r;
  }
  private makeRoom(id: PersonId) {
    const s = this.by.get(id); if (!s || s.size < PER_PERSON) return;
    // the weakest first (|friendship| plus half |rapport|), then the oldest (the earliest last interaction)
    let worst: Rel | null = null, ws = Infinity;
    for (const k of s) { const r = this.pairs.get(k)!; const w = Math.abs(r.friendship) + 0.5 * Math.abs(r.rapport); if (w < ws - 1e-9 || (Math.abs(w - ws) <= 1e-9 && worst && r.last < worst.last)) { ws = w; worst = r; } }
    if (worst) this.drop(worst);
  }
  private drop(r: Rel) { const k = Relations.key(r.a, r.b); this.pairs.delete(k); this.link(r.a, r.b, null); this.by.get(r.a)?.delete(k); this.by.get(r.b)?.delete(k); }
  /** an outcome between a and b at sim minute t: the delta to both numbers, a memory, and the highlights */
  apply(a: PersonId, b: PersonId, delta: number, t: number, kind: string, good: boolean, ctx?: string): Rel {
    const r = this.meet(a, b, t);
    r.rapport = rapportStep(r.rapport, delta);
    r.friendship = friendStep(r.friendship, delta);
    r.best = Math.max(r.best, r.friendship);
    r.last = t;
    this.remember(r, { t, kind, good, delta, ctx });
    return r;
  }
  /** a memory into the ring of 8 and, if it's big enough, the highlights (the first meeting stays; the rest are the
   *  biggest moments by |delta|) */
  remember(r: Rel, m: Memory) {
    r.mem.push(m); if (r.mem.length > MEM_RING) r.mem.shift();
    if (Math.abs(m.delta) < HIGHLIGHT_MIN) return;
    if (r.highlights.length < HIGHLIGHTS) { r.highlights.push(m); return; }
    let k = -1, small = Infinity;
    for (let i = 0; i < r.highlights.length; i++) { const h = r.highlights[i]; if (h.kind === 'met') continue; if (Math.abs(h.delta) < small) { small = Math.abs(h.delta); k = i; } }
    if (k >= 0 && Math.abs(m.delta) > small) r.highlights[k] = m;
  }
  /** set a pair's rapport (an introduction's start) */
  setRapport(a: PersonId, b: PersonId, v: number, t: number) { const r = this.meet(a, b, t); r.rapport = clamp(v, -100, 100); r.last = t; return r; }
  /** rapport fades toward 0 by 1.5 a sim minute for pairs quiet for 5 sim minutes or more (dMin sim minutes passed, now
   *  the sim minute) */
  fade(dMin: number, now: number) {
    for (const r of this.pairs.values()) {
      if (r.rapport === 0) continue;
      const quietFrom = r.last + RAPPORT_QUIET; if (now <= quietFrom) continue;
      const step = RAPPORT_FADE * Math.min(dMin, now - quietFrom);
      r.rapport = r.rapport > 0 ? Math.max(0, r.rapport - step) : Math.min(0, r.rapport + step);
    }
  }
  /** friendship fades toward 0 by 0.5 per device day apart, never below 20 once it has reached 45 */
  fadeDays(days: number) {
    if (!(days > 0)) return;
    for (const r of this.pairs.values()) {
      const step = FRIEND_FADE_DAY * days, floor = r.best >= OLD_FRIEND ? OLD_FLOOR : 0;
      if (r.friendship > 0) r.friendship = Math.max(Math.min(r.friendship, floor), r.friendship - step);
      else if (r.friendship < 0) r.friendship = Math.min(0, r.friendship + step);
    }
  }
  /** a walk-in leaves: forgotten (every pair they're in) */
  forget(id: PersonId) { for (const r of this.of(id)) this.drop(r); this.by.delete(id); }
  /** a big good moment both remember (a highlight other than the first meeting): NPC choices +10 toward them */
  sharedHighlight(a: PersonId, b: PersonId) { const r = this.get(a, b); if (!r) return false; for (const h of r.highlights) if (h.kind !== 'met' && h.good) return true; return false; }
  /** the last memory of a kind (or any) */
  lastOf(a: PersonId, b: PersonId, kind?: string): Memory | null { const r = this.get(a, b); if (!r) return null; for (let i = r.mem.length - 1; i >= 0; i--) if (!kind || r.mem[i].kind === kind) return r.mem[i]; return null; }
  /** the pairs to keep on the device: both sides kept (the player and regulars), friendship only (rapport is this visit) */
  toSave(keep: (id: PersonId) => boolean): SavedRel[] {
    const out: SavedRel[] = [];
    for (const r of this.pairs.values()) if (keep(r.a) && keep(r.b)) out.push({ a: r.a, b: r.b, f: +r.friendship.toFixed(3), best: +r.best.toFixed(3), met: r.met, last: r.last, mem: r.mem.map((m) => ({ ...m })), hl: r.highlights.map((m) => ({ ...m })) });
    return out;
  }
  /** the saved pairs back (a new visit: rapport 0), then the friendship fade for the device days apart */
  load(saved: SavedRel[], daysApart: number) {
    for (const s of saved) {
      if (!s || typeof s.a !== 'string' || typeof s.b !== 'string' || typeof s.f !== 'number' || s.a === s.b) continue;
      const r = this.meet(s.a, s.b, s.met);
      r.friendship = clamp(s.f, -100, 100); r.best = Math.max(r.friendship, s.best ?? 0); r.rapport = 0; r.last = s.last ?? s.met;
      r.mem = Array.isArray(s.mem) ? s.mem.slice(-MEM_RING) : r.mem; r.highlights = Array.isArray(s.hl) ? s.hl.slice(0, HIGHLIGHTS) : r.highlights;
    }
    this.fadeDays(daysApart);
  }
  clear() { this.pairs.clear(); this.by.clear(); this.idx.clear(); }
  all() { return [...this.pairs.values()]; }
}
