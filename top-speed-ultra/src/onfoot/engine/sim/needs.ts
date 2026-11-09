// Needs, personality, mood, moodlets and emotion (PROJECT_OC_SPORTS_BAR.md, "Needs", "Moods, moodlets and emotions"
// and "Personality"). The same model runs the player and every guest. Everything is in sim minutes (one sim minute is
// one real minute at 1x). The formulas are the plan's, term by term; tests/sportsbar-sim.mjs checks the rates without
// the page, with the traits as its input.

export type Need = 'hunger' | 'thirst' | 'fun' | 'social' | 'energy' | 'bladder';
export type ShownNeed = Exclude<Need, 'bladder'>;
/** the five needs shown to the player (bladder is the NPCs' hidden sixth) */
export const SHOWN: ShownNeed[] = ['hunger', 'thirst', 'fun', 'social', 'energy'];
export const NEEDS: Need[] = [...SHOWN, 'bladder'];
export type Needs = Record<Need, number>;

export interface Traits { outgoing: number; playful: number; competitive: number; fan: number; active: number }
export const AVERAGE: Traits = { outgoing: 0.5, playful: 0.5, competitive: 0.5, fan: 0.5, active: 0.5 };

/** where each need starts, seeded within these ranges ("Starts (seeded)") */
export const START: Record<Need, [number, number]> = { hunger: [55, 80], thirst: [50, 75], fun: [50, 70], social: [40, 70], energy: [60, 90], bladder: [70, 100] };
export function startNeeds(r: () => number): Needs {
  const n = {} as Needs;
  for (const k of NEEDS) n[k] = START[k][0] + (START[k][1] - START[k][0]) * r();
  return n;
}
/** the seeded average (the middle of every start range) */
export const AVERAGE_START: Needs = Object.fromEntries(NEEDS.map((k) => [k, (START[k][0] + START[k][1]) / 2])) as Needs;

/** the trait multipliers m ("Personality"): mood and the utility AI's need terms */
export function multipliers(t: Traits): Record<Need, number> {
  return { hunger: 1, thirst: 1, bladder: 1, fun: 0.8 + 0.4 * t.playful, social: 0.6 + 0.8 * t.outgoing, energy: 1.2 - 0.4 * t.active };
}
/** the base weights b of the mood's needs average */
export const WEIGHTS: Record<ShownNeed, number> = { hunger: 0.2, thirst: 0.2, fun: 0.25, social: 0.25, energy: 0.1 };

export type FunKind = 'watch' | 'pool' | 'darts' | 'shuffleboard' | 'dance' | 'conversation' | 'music' | 'people-watch' | 'freeway' | 'water';
/** what someone is doing, as far as the rates care */
export interface Doing {
  posture: 'stand' | 'walk' | 'sit';
  /** a fun action (fun doesn't decay during one); 'water' and 'music' are short one-off actions */
  fun?: FunKind;
  /** in a group or a conversation: social doesn't decay */
  inGroup?: boolean;
  /** holding food and eating it: hunger +10 a minute */
  eating?: boolean;
  /** watching: the match factor, 1.6 while the featured match is in play on the screen watched, otherwise 1 */
  match?: number;
  /** watching: how many other watchers are within 3 m (social +1 a minute with 2 or more) */
  watchers?: number;
}
export const GAMES = new Set<FunKind>(['pool', 'darts', 'shuffleboard']);

/** each need's change per sim minute for what someone is doing (the needs table and "Rates while doing things") */
export function rates(d: Doing, t: Traits, out: Record<Need, number> = {} as Record<Need, number>): Record<Need, number> {
  const f = d.fun;
  out.hunger = -0.8 + (d.eating ? 10 : 0);
  out.thirst = f === 'dance' || (f && GAMES.has(f)) ? -2.2 : -1.6;
  // fun: -1.2 while doing nothing fun, 0 during a fun action, plus what the action gives
  let fun = 0;
  if (!f) fun = -1.2;
  else if (f === 'watch') fun = 2.5 * (d.match ?? 1) * (0.6 + 0.8 * t.fan);
  else if (f === 'pool' || f === 'shuffleboard') fun = 6;
  else if (f === 'darts') fun = 6.5;
  else if (f === 'dance') fun = 8;
  else if (f === 'conversation') fun = 1;
  else if (f === 'people-watch') fun = 0.8;
  else if (f === 'freeway') fun = 1;
  out.fun = fun;
  // social: -1.0 x (0.6 + 0.8 outgoing) when not in a group or a conversation, plus what the action gives
  let social = d.inGroup || f === 'conversation' ? 0 : -1.0 * (0.6 + 0.8 * t.outgoing);
  if (f === 'watch' && (d.watchers ?? 0) >= 2) social += 1;
  else if (f && GAMES.has(f)) social += 2.5;
  else if (f === 'conversation') social += 4;
  else if (f === 'dance') social += 2;
  out.social = social;
  // energy: -0.4 standing or walking, +0.8 seated, more in some actions
  let energy = d.posture === 'sit' ? 0.8 : -0.4;
  if (f === 'dance') energy = -2.5;
  else if (f === 'pool') energy = -0.6;
  else if (f === 'darts' || f === 'shuffleboard') energy = -0.4;
  out.energy = energy;
  out.bladder = -0.6;
  return out;
}
const clamp100 = (v: number) => (v < 0 ? 0 : v > 100 ? 100 : v);
/** advance the needs by `minutes` at the given rates (clamped to 0..100) */
export function advance(n: Needs, r: Record<Need, number>, minutes: number) {
  for (const k of NEEDS) n[k] = clamp100(n[k] + r[k] * minutes);
}
/** a one-off change (a sip, water, a song): clamped */
export function bump(n: Needs, d: Partial<Record<Need, number>>) { for (const k of Object.keys(d) as Need[]) n[k] = clamp100(n[k] + (d[k] ?? 0)); }

// ------------------------------------------------------------------------------------------------ words for the meters
const WORDS: Record<ShownNeed, [string, string, string]> = {
  hunger: ['Hungry', 'Peckish', 'Fed'],
  thirst: ['Thirsty', 'Could drink', 'Refreshed'],
  fun: ['Bored', 'Restless', 'Having fun'],
  social: ['Lonely', 'Could chat', 'Social'],
  energy: ['Tired', 'Flagging', 'Rested'],
};
/** the colour band: 60 and up good, 30 to 59 fair, under 30 low (never shown by colour alone: there's always the word) */
export const band = (v: number): 'good' | 'fair' | 'low' => (v >= 60 ? 'good' : v >= 30 ? 'fair' : 'low');
export const needWord = (k: ShownNeed, v: number) => WORDS[k][v >= 60 ? 2 : v >= 30 ? 1 : 0];
export const NEED_LABEL: Record<ShownNeed, string> = { hunger: 'Hunger', thirst: 'Thirst', fun: 'Fun', social: 'Social', energy: 'Energy' };

// ------------------------------------------------------------------------------------------------ mood
/** the weighted needs average: sum b_k m_k n_k / sum b_k m_k over the five shown needs */
export function needsAverage(n: Needs, t: Traits) {
  const m = multipliers(t); let a = 0, w = 0;
  for (const k of SHOWN) { a += WEIGHTS[k] * m[k] * n[k]; w += WEIGHTS[k] * m[k]; }
  return a / w;
}
/** mood 0..100 = 20 + 0.6 x the weighted needs average + the active moodlets, clamped */
export const moodOf = (n: Needs, t: Traits, moodlets: number) => clamp100(20 + 0.6 * needsAverage(n, t) + moodlets);
export type MoodLabel = 'Elated' | 'Happy' | 'Fine' | 'Meh' | 'Low';
export const moodLabel = (m: number): MoodLabel => (m >= 85 ? 'Elated' : m >= 65 ? 'Happy' : m >= 45 ? 'Fine' : m >= 25 ? 'Meh' : 'Low');

// ------------------------------------------------------------------------------------------------ moodlets
export type MoodletId =
  | 'goal-for' | 'goal-against' | 'team-won' | 'team-lost' | 'won-game' | 'lost-close' | 'good-food' | 'introduced'
  | 'too-crowded' | 'great-chat' | 'shared-laugh' | 'joke-flat' | 'high-five' | 'toast' | 'got-round' | 'bought-round'
  | 'brushed-off' | 'last-call' | 'heater';
/** the plan's table: value and how long it lasts in sim minutes ('while' lasts while its condition holds) */
export const MOODLETS: Record<MoodletId, { label: string; value: number; minutes: number | 'while' }> = {
  'goal-for': { label: 'Goal for my team', value: 15, minutes: 10 },
  'goal-against': { label: 'Goal against my team', value: -8, minutes: 6 },
  'team-won': { label: 'My team won', value: 20, minutes: 30 },
  'team-lost': { label: 'My team lost', value: -12, minutes: 20 },
  'won-game': { label: 'Won a game', value: 12, minutes: 15 },        // x (0.6 + 0.8 competitive), set when added
  'lost-close': { label: 'Lost a close one', value: -4, minutes: 5 },
  'good-food': { label: 'Good food', value: 6, minutes: 15 },
  'introduced': { label: 'Introduced to someone', value: 4, minutes: 6 },
  'too-crowded': { label: 'Too crowded', value: -3, minutes: 'while' },
  'great-chat': { label: 'Great chat', value: 8, minutes: 10 },
  'shared-laugh': { label: 'Shared a laugh', value: 6, minutes: 8 },
  'joke-flat': { label: 'Joke fell flat', value: -4, minutes: 4 },
  'high-five': { label: 'High-five', value: 5, minutes: 5 },
  'toast': { label: 'Toast', value: 6, minutes: 8 },
  'got-round': { label: 'Got a round', value: 10, minutes: 15 },
  'bought-round': { label: 'Bought a round', value: 8, minutes: 15 },
  'brushed-off': { label: 'Brushed off', value: -5, minutes: 5 },
  'last-call': { label: 'Last call', value: -2, minutes: 'while' },
  'heater': { label: 'Warm by the heater', value: 2, minutes: 'while' },
};
export interface ActiveMoodlet { id: MoodletId; t0: number; value: number; minutes: number | 'while' }
/** a person's moodlets: each fades linearly to 0 over its duration ('while' ones hold their value until cleared) */
export class Moodlets {
  list: ActiveMoodlet[] = [];
  add(id: MoodletId, now: number, value = MOODLETS[id].value) {
    const d = MOODLETS[id].minutes;
    // the same moodlet again restarts it (it doesn't stack)
    this.list = this.list.filter((m) => m.id !== id);
    this.list.push({ id, t0: now, value, minutes: d });
  }
  /** a 'while' moodlet on or off (called every frame: no allocation unless it changes) */
  hold(id: MoodletId, on: boolean, now: number) { const i = this.indexOf(id); if (on && i < 0) this.add(id, now); else if (!on && i >= 0) this.list.splice(i, 1); }
  has(id: MoodletId) { return this.indexOf(id) >= 0; }
  private indexOf(id: MoodletId) { for (let i = 0; i < this.list.length; i++) if (this.list[i].id === id) return i; return -1; }
  /** scale an active moodlet's remaining value (Console halves "My team lost") */
  scale(id: MoodletId, k: number) { for (const m of this.list) if (m.id === id) m.value *= k; }
  /** drop the faded ones, in place (called every frame) */
  prune(now: number) { let j = 0; for (let i = 0; i < this.list.length; i++) { const m = this.list[i]; if (m.minutes === 'while' || now - m.t0 < m.minutes) this.list[j++] = m; } this.list.length = j; }
  valueOf(m: ActiveMoodlet, now: number) { return m.minutes === 'while' ? m.value : m.value * Math.max(0, 1 - (now - m.t0) / m.minutes); }
  sum(now: number) { let s = 0; for (const m of this.list) s += this.valueOf(m, now); return s; }
  clear() { this.list = []; }
  /** the clock jumped by d sim minutes (a set clock): every moodlet keeps how far it has faded */
  shift(d: number) { for (const m of this.list) m.t0 += d; }
  report(now: number) { return this.list.map((m) => ({ id: m.id, label: MOODLETS[m.id].label, value: +this.valueOf(m, now).toFixed(2), left: m.minutes === 'while' ? null : +Math.max(0, m.minutes - (now - m.t0)).toFixed(2) })); }
}

// ------------------------------------------------------------------------------------------------ emotion
export type Emotion = 'Excited' | 'Playful' | 'Confident' | 'Social' | 'Bored' | 'Lonely' | 'Hungry' | 'Thirsty' | 'Tired' | 'Gutted' | 'Fine';
export interface EmotionInput {
  needs: Needs; traits: Traits; mood: number; now: number;
  /** when the last team moment (a goal or a touchdown for or against their team, or one they cheered) was */
  teamMomentAt?: number;
  /** when their team last lost */
  teamLostAt?: number;
  jokeLandedAt?: number; wonGameAt?: number; inGoodConversation?: boolean;
}
/** the strongest emotion that applies, in the plan's order */
export function emotionOf(e: EmotionInput): Emotion {
  const n = e.needs, ago = (t?: number) => (t === undefined ? Infinity : e.now - t);
  if (ago(e.teamMomentAt) <= 5) return 'Excited';
  if (ago(e.jokeLandedAt) <= 5 || (e.traits.playful > 0.6 && e.mood >= 65)) return 'Playful';
  if (ago(e.wonGameAt) <= 15) return 'Confident';
  if (e.inGoodConversation) return 'Social';
  if (n.fun < 30) return 'Bored';
  if (n.social < 30) return 'Lonely';
  const low = (['hunger', 'thirst', 'energy'] as const).filter((k) => n[k] < (k === 'energy' ? 25 : 30)).sort((a, b) => n[a] - n[b]);
  if (low.length) return low[0] === 'hunger' ? 'Hungry' : low[0] === 'thirst' ? 'Thirsty' : 'Tired';
  if (ago(e.teamLostAt) <= 20) return 'Gutted';
  return 'Fine';
}
