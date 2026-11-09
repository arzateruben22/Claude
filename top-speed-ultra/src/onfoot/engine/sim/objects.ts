// Smart objects, adverts, reservations and the action queue (PROJECT_OC_SPORTS_BAR.md, "Smart objects" and "The action
// queue"). Objects advertise what they offer; people pick from those adverts (the player through menus, NPCs through
// the utility AI in S3a). The catalogue itself is a venue's data (venues/sportsbar/objects.ts); these are its types.
import type { Need } from './needs';

export type Requirement = 'open' | 'staffed' | 'holding:drink' | 'holding:food' | 'notHolding:drink' | 'notHolding:food'
  | 'seated' | 'gameNight' | 'screenInView' | 'npcOnly';
export type AdvertTag = 'drink' | 'food' | 'game' | 'watch' | 'social' | 'dance' | 'rest' | 'music' | 'comfort';

export interface Advert {
  action: string; label: string;               // 'order-drink', "Order a drink"
  /** the expected total change over the action (rates x duration + one-offs); continuous: rates x the 5-minute window */
  deltas: Partial<Record<Need, number>>;
  minutes: [number, number] | 'continuous';
  /** runs alongside the current action without ending it */
  overlay?: boolean;
  /** seconds until the item is in hand, not counting the walk */
  wait?: [number, number];
  party?: [number, number];
  requires?: Requirement[];
  tags: AdvertTag[];
  /** which of the object's slots it uses (slot ids from the venue's layout, or the object's own use spots) */
  slots: string[];
}
/** a place on an object: a seat or a spot; `use` points carry no layout slot (the jukebox, the screens) */
export interface ObjSlot { id: string; role: 'user' | 'watcher' | 'staff' }
export interface SmartObjectType { type: string; label: string; adverts: Advert[] }
export interface SmartObject {
  id: string; type: string; label: string;
  /** the slots people use it from (layout slot ids) */
  slots: string[];
  /** where it is (frame u, v) and how big (for taps and the radial menu), and its height range */
  at: [number, number]; size: [number, number]; y: [number, number];
}

/** the continuous adverts' scoring window, in sim minutes */
export const WINDOW = 5;

/**
 * Reservations: choosing an action reserves its slot for the walk there plus 10 s, so two people never head for one
 * stool; a lapsed reservation makes its holder plan again; a slot's capacity (one body) is never exceeded.
 */
export class Reservations {
  private by = new Map<string, { who: string; until: number; using: boolean }>();
  /** reserve a slot for `who` until `until` (sim seconds); false if someone else holds it */
  reserve(slot: string, who: string, until: number): boolean {
    const r = this.by.get(slot);
    if (r && r.who !== who) return false;
    this.by.set(slot, { who, until, using: false });
    return true;
  }
  /** the holder is now in the slot: it stays theirs until released */
  use(slot: string, who: string) { const r = this.by.get(slot); if (r && r.who === who) r.using = true; else if (!r) this.by.set(slot, { who, until: Infinity, using: true }); }
  release(slot: string, who: string) { const r = this.by.get(slot); if (r && r.who === who) this.by.delete(slot); }
  releaseAll(who: string) { for (const [k, r] of this.by) if (r.who === who) this.by.delete(k); }
  /** the clock jumped by d sim seconds (a set clock): every reservation keeps the time it had left */
  shift(d: number) { for (const r of this.by.values()) if (Number.isFinite(r.until)) r.until += d; }
  holder(slot: string) { return this.by.get(slot)?.who ?? null; }
  free(slot: string, who?: string) { const r = this.by.get(slot); return !r || r.who === who; }
  private lapsed: string[] = [];
  /** drop lapsed reservations (not yet in use and past their time); returns who lost theirs, in a buffer reused by the
   *  next call (called every frame: no allocation) */
  lapse(now: number): string[] { const out = this.lapsed; out.length = 0; for (const [k, r] of this.by) if (!r.using && r.until < now) { this.by.delete(k); out.push(r.who); } return out; }
  /** the check: no slot has two holders (a Map can't), and every held slot names one person */
  report() { return [...this.by.entries()].map(([slot, r]) => ({ slot, who: r.who, using: r.using })); }
}

/** a queued action: what, on which object, and where it stands */
export interface QueuedAction {
  id: number; action: string; object: string; label: string; icon: string;
  stage: 'queued' | 'walking' | 'doing' | 'waiting';
  /** the slot it uses (reserved), and an item for orders */
  slot?: string; item?: string;
  /** sim seconds: when the doing started, how long it lasts (Infinity for continuous) */
  t0?: number; dur?: number;
  /** a short reaction pushed in front of the current action (a cheer), which then resumes */
  reaction?: boolean;
}
/** up to 3 actions, The Sims way: the player adds from menus; NPCs one at a time from the utility AI */
export class ActionQueue {
  static MAX = 3;
  items: QueuedAction[] = [];
  private nextId = 1;
  get current(): QueuedAction | null { return this.items[0] ?? null; }
  get full() { return this.items.length >= ActionQueue.MAX; }
  add(a: Omit<QueuedAction, 'id' | 'stage'>): QueuedAction | null {
    if (this.full) return null;
    const q: QueuedAction = { ...a, id: this.nextId++, stage: 'queued' };
    this.items.push(q); return q;
  }
  /** a reaction goes in front of the current action, which resumes after it */
  interrupt(a: Omit<QueuedAction, 'id' | 'stage' | 'reaction'>): QueuedAction {
    const q: QueuedAction = { ...a, id: this.nextId++, stage: 'doing', reaction: true };
    if (this.items[0]) this.items[0].stage = this.items[0].stage === 'doing' ? 'doing' : 'queued';
    this.items.unshift(q); if (this.items.length > ActionQueue.MAX + 1) this.items.length = ActionQueue.MAX + 1;
    return q;
  }
  cancel(id: number): QueuedAction | null { const i = this.items.findIndex((a) => a.id === id); if (i < 0) return null; const [a] = this.items.splice(i, 1); return a; }
  shift(): QueuedAction | null { return this.items.shift() ?? null; }
  clear(): QueuedAction[] { const out = this.items; this.items = []; return out; }
}
