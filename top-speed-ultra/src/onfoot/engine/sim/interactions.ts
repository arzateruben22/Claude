// The 11 interactions between people (PROJECT_OC_SPORTS_BAR.md, "Interacting with people" and "NPC autonomy", "People
// advertise like objects"). Pure: no three.js, no page. The table's numbers, the acceptance formula, the context and
// memory terms, and the expected deltas a person advertises:
//
//   p = clamp(0.05, 0.97, base + 0.004 rapport + 0.002 friendship + 0.15 (target.outgoing - 0.5)
//                         + (target.mood - 50) / 250 + memoryTerm + context)
//   D_k(I, T) = p D_k(I accepted) + (1 - p) D_k(I not accepted)
//
// memoryTerm: +0.05 for each of the pair's last 3 memories of the same kind that went well, -0.08 for each that didn't.
// context (clamped to -0.25..+0.25): +0.10 when both support the team that scored in the last 60 s (Talk, Joke, Cheer
// together, High-five, Toast); -0.10 when the target's team conceded in the last 5 minutes (Joke, Challenge); -0.20 when
// the target is mid-turn in a game; -0.10 when the target is talking in a group the actor isn't in (anything but Join).
// Rapport changes and moodlets aren't needs, so they don't enter the expected deltas. Nothing here is staked: a round
// costs house tokens (no cash value), and a game is friendly.
import type { Need, Traits, MoodletId } from './needs';
import type { AdvertTag } from './objects';
import type { Memory } from './relations';
import type { GameKind } from './games';

export type Kind = 'talk' | 'joke' | 'cheer' | 'high-five' | 'toast' | 'round' | 'introduce' | 'challenge' | 'team' | 'console' | 'goodbye';
export const KINDS: Kind[] = ['talk', 'joke', 'cheer', 'high-five', 'toast', 'round', 'introduce', 'challenge', 'team', 'console', 'goodbye'];
type ND = Partial<Record<Need, number>>;
export interface Outcome { rapport: number; needs: ND; /** moodlets: the actor's and the target's */ actor?: MoodletId; target?: MoodletId }
export interface KindDef {
  label: string;
  base: (t: Traits) => number;
  acc: Outcome; rej: Outcome;
  /** what the advert's affinity reads (social adverts read outgoing; Joke playful; Challenge competitive; Cheer fan) */
  aff: 'outgoing' | 'playful' | 'competitive' | 'fan';
  tags: AdvertTag[];
  /** the context terms that apply to it */
  team60: boolean; conceded: boolean;
  /** a beat's clip (the actor's) and how long it lasts (2 to 4 s) */
  clip: 'talk' | 'cheer' | 'drink' | 'clap'; seconds: number;
}
export const TABLE: Record<Kind, KindDef> = {
  talk: { label: 'Talk', base: () => 0.75, acc: { rapport: 6, needs: { social: 12 } }, rej: { rapport: -3, needs: { social: 2 }, actor: 'brushed-off' }, aff: 'outgoing', tags: ['social'], team60: true, conceded: false, clip: 'talk', seconds: 3 },
  joke: { label: 'Joke', base: (t) => 0.55 + 0.3 * t.playful, acc: { rapport: 9, needs: { fun: 6, social: 8 }, actor: 'shared-laugh', target: 'shared-laugh' }, rej: { rapport: -6, needs: {}, actor: 'joke-flat' }, aff: 'playful', tags: ['social'], team60: true, conceded: true, clip: 'talk', seconds: 2.5 },
  cheer: { label: 'Cheer together', base: () => 0.85, acc: { rapport: 5, needs: { fun: 5 } }, rej: { rapport: 0, needs: {} }, aff: 'fan', tags: ['social'], team60: true, conceded: false, clip: 'cheer', seconds: 2 },
  'high-five': { label: 'High-five', base: () => 0.9, acc: { rapport: 8, needs: {}, actor: 'high-five', target: 'high-five' }, rej: { rapport: -2, needs: {}, actor: 'brushed-off' }, aff: 'outgoing', tags: ['social'], team60: true, conceded: false, clip: 'cheer', seconds: 2 },
  toast: { label: 'Toast', base: () => 0.85, acc: { rapport: 7, needs: { social: 8 }, actor: 'toast', target: 'toast' }, rej: { rapport: 0, needs: {} }, aff: 'outgoing', tags: ['social'], team60: true, conceded: false, clip: 'drink', seconds: 2.4 },
  round: { label: 'Buy a round', base: () => 0.97, acc: { rapport: 15, needs: {}, actor: 'bought-round', target: 'got-round' }, rej: { rapport: 0, needs: {} }, aff: 'outgoing', tags: ['social'], team60: false, conceded: false, clip: 'talk', seconds: 3 },
  introduce: { label: 'Introduce…', base: () => 0.8, acc: { rapport: 5, needs: {}, target: 'introduced' }, rej: { rapport: -2, needs: {} }, aff: 'outgoing', tags: ['social'], team60: false, conceded: false, clip: 'talk', seconds: 3 },
  challenge: { label: 'Challenge', base: (t) => 0.5 + 0.4 * t.competitive, acc: { rapport: 0, needs: {} }, rej: { rapport: -1, needs: {} }, aff: 'competitive', tags: ['social', 'game'], team60: false, conceded: true, clip: 'talk', seconds: 2.5 },
  team: { label: 'Ask about their team', base: () => 0.9, acc: { rapport: 4, needs: {} }, rej: { rapport: 0, needs: {} }, aff: 'outgoing', tags: ['social'], team60: false, conceded: false, clip: 'talk', seconds: 3 },
  console: { label: 'Console', base: () => 0.8, acc: { rapport: 8, needs: {} }, rej: { rapport: -2, needs: {} }, aff: 'outgoing', tags: ['social'], team60: false, conceded: false, clip: 'talk', seconds: 3 },
  goodbye: { label: 'Say goodbye', base: () => 1, acc: { rapport: 2, needs: {} }, rej: { rapport: 0, needs: {} }, aff: 'outgoing', tags: ['social'], team60: false, conceded: false, clip: 'talk', seconds: 2 },
};
/** a game accepted through Challenge advertises the game's own deltas (ours: the play advert's, from the catalogue) */
export const GAME_DELTAS: Record<GameKind, ND> = { pool: { fun: 40, social: 15, energy: -4 }, darts: { fun: 30, social: 10 }, shuffleboard: { fun: 35, social: 12 } };

/** a round: 4 house tokens a person, once every 10 sim minutes a group, delivered by staff in 1 to 2 minutes */
export const ROUND = { perPerson: 4, everyMin: 10, deliver: [60, 120] as [number, number] };

export interface Context {
  /** both support the team that scored in the last 60 s */
  bothScored: boolean;
  /** the target's team conceded in the last 5 minutes */
  conceded: boolean;
  /** the target is lining up a shot, a throw or a slide */
  midTurn: boolean;
  /** the target is talking in a group the actor isn't in */
  otherGroup: boolean;
}
export const NO_CONTEXT: Context = { bothScored: false, conceded: false, midTurn: false, otherGroup: false };
export function contextTerm(kind: Kind, c: Context) {
  const d = TABLE[kind]; let x = 0;
  if (c.bothScored && d.team60) x += 0.1;
  if (c.conceded && d.conceded) x -= 0.1;
  if (c.midTurn) x -= 0.2;
  if (c.otherGroup) x -= 0.1;
  return Math.max(-0.25, Math.min(0.25, x));
}
/** +0.05 for each of the last 3 memories of this kind that went well, -0.08 for each that didn't */
export function memoryTerm(mem: readonly Memory[] | null | undefined, kind: Kind) {
  if (!mem) return 0;
  let n = 0, x = 0;
  for (let i = mem.length - 1; i >= 0 && n < 3; i--) { const m = mem[i]; if (m.kind !== kind) continue; n++; x += m.good ? 0.05 : -0.08; }
  return x;
}
export interface AcceptIn { rapport: number; friendship: number; target: Traits; targetMood: number; memory: number; context: number }
export const clampP = (p: number) => Math.max(0.05, Math.min(0.97, p));
/** the plan's acceptance probability */
export function acceptP(kind: Kind, a: AcceptIn) {
  return clampP(TABLE[kind].base(a.target) + 0.004 * a.rapport + 0.002 * a.friendship + 0.15 * (a.target.outgoing - 0.5) + (a.targetMood - 50) / 250 + a.memory + a.context);
}
/** the expected change to each need: p accepted + (1 - p) not (a Challenge's accepted deltas are its game's) */
export function expected(kind: Kind, p: number, game?: GameKind): ND {
  const d = TABLE[kind], acc = kind === 'challenge' && game ? GAME_DELTAS[game] : d.acc.needs, out: ND = {};
  const keys = new Set<Need>([...Object.keys(acc), ...Object.keys(d.rej.needs)] as Need[]);
  for (const k of keys) { const v = p * (acc[k] ?? 0) + (1 - p) * (d.rej.needs[k] ?? 0); if (v) out[k] = v; }
  return out;
}
/** an introduction's start: A and B at rapport 10 + 0.3 min(your friendships with them) */
export const introStart = (fA: number, fB: number) => 10 + 0.3 * Math.min(fA, fB);
