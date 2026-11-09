// NPC autonomy, the utility AI (PROJECT_OC_SPORTS_BAR.md, "NPC autonomy (utility AI)"). Pure: no three.js, no page.
// A decision scores the adverts the caller lets in (S3a: the objects' adverts; S3b adds people's) with the plan's
// formula, term by term:
//
//   score(A) = sum_k m_k * D_k(A) * urgency(n_k)      the needs (hunger, thirst, fun, social, energy, bladder)
//            + 20 * affinity(A)                       0..1, by tag and trait; +0.25 for a favourite; capped at 1
//            + emotion(A) + event(A) + memory(A)
//            + urgent(A)                              +30 for each urgent need (under 30) A raises by 10 or more
//            - 0.6 * walk(A) - 15 * occupancy(A) - 0.05 * wait(A)
//            - 25 * (A leaves a conversation mid-turn)
//   urgency(n) = 0.2 + 1.8 * ((100 - n) / 100)^2
//
// D_k is the advert's delta clipped to the room left (at most 100 - n_k). Overlays are scored apart (the best one
// scoring 25 or more is taken without ending the current action). Hysteresis: a continuous action is dropped only for
// a candidate that beats its score by 25% plus 10, except one that raises an urgent need by 10 or more. With any need
// urgent, the current continuous action and every advert sharing a tag with it are scored without their affinity,
// emotion and event terms. The choice samples the top three by exp((s - best) / 8). tests/sportsbar-sim.mjs checks
// the plan's worked arithmetic against these functions.
import type { Need, Needs, Traits, Emotion } from './needs';
import { NEEDS, multipliers } from './needs';
import type { AdvertTag } from './objects';

export const urgency = (n: number) => 0.2 + 1.8 * ((100 - n) / 100) ** 2;
export const URGENT = 30;
export const OVERLAY_MIN = 25;

/** one advert as the decider sees it: what it gives (already in this person's terms: a continuous advert's rates over
 *  the 5 sim-minute window with their match and fan factors), where, and how crowded */
export interface Cand {
  key: string; action: string; object: string; slot: string | null;
  deltas: Partial<Record<Need, number>>;
  tags: AdvertTag[];
  overlay?: boolean;
  /** metres to the advert's slot (the straight line x 1.3 before a path exists); 0 for overlays and the slot you're in */
  walk: number;
  occupancy: number;
  /** seconds until the item is in hand (the mean of the advert's range) */
  wait: number;
  favourite?: boolean;
  /** the person's current continuous action */
  current?: boolean;
  continuous?: boolean;
  /** the featured match in play on the screen this advert watches */
  featuredScreen?: boolean;
  memory?: number;
  leavesMidTurn?: boolean;
  /** the joke advert's affinity is playful (S3b) */
  joke?: boolean;
  /** S3b: a person's advert: the interaction, the trait its affinity reads, and whether a goal or a touchdown came in
   *  the last 60 s (event: +30 on cheer, high-five and toast) */
  inter?: string;
  aff?: 'outgoing' | 'playful' | 'competitive' | 'fan';
  goal60?: boolean;
  /** S3b: the target and the acceptance probability its expected deltas were worked out with (for the log) */
  target?: string; p?: number;
}
export interface Decider { needs: Needs; traits: Traits; emotion: Emotion }
export interface Scored { c: Cand; score: number; terms: { needs: number; affinity: number; emotion: number; event: number; memory: number; urgent: number; walk: number; occupancy: number; wait: number; midTurn: number } }

const FUN_TAGS: AdvertTag[] = ['game', 'watch', 'dance', 'music'];
/** affinity 0..1: the strongest of the advert's tags (game: competitive; watch: fan; social: outgoing; music: playful;
 *  dance: (active + playful) / 2; rest: 1 - active; drink, food and comfort 0), +0.25 for a favourite, capped at 1 */
export function affinity(c: Cand, t: Traits) {
  let a = 0;
  // a person's advert reads one trait (social: outgoing; Joke: playful; Challenge: competitive; Cheer together: fan)
  if (c.aff) a = t[c.aff];
  else for (const tag of c.tags) {
    const v = tag === 'game' ? t.competitive : tag === 'watch' ? t.fan : tag === 'social' ? (c.joke ? t.playful : t.outgoing) : tag === 'music' ? t.playful
      : tag === 'dance' ? (t.active + t.playful) / 2 : tag === 'rest' ? 1 - t.active : 0;
    if (v > a) a = v;
  }
  if (c.favourite) a += 0.25;
  return Math.min(1, a);
}
/** the emotion bonuses: Excited +15 on dance, cheer and high-five; Bored +20 on fun-tagged adverts; Lonely +20 on
 *  social; Gutted -20 on dance */
export function emotionTerm(c: Cand, e: Emotion) {
  const has = (t: AdvertTag) => c.tags.includes(t);
  if (e === 'Excited' && (has('dance') || c.inter === 'cheer' || c.inter === 'high-five')) return 15;
  if (e === 'Bored' && FUN_TAGS.some(has)) return 20;
  if (e === 'Lonely' && has('social')) return 20;
  if (e === 'Gutted' && has('dance')) return -20;
  return 0;
}
/** which urgent needs (under 30) the advert raises by 10 or more */
export function raisesUrgent(c: Cand, n: Needs): Need[] {
  const out: Need[] = [];
  for (const k of NEEDS) if (n[k] < URGENT && (c.deltas[k] ?? 0) >= 10) out.push(k);
  return out;
}
/** score one advert. `plain`: without its affinity, emotion and event terms (the urgent rule's third clause) */
export function score(c: Cand, d: Decider, plain = false): Scored {
  const m = multipliers(d.traits);
  let needs = 0;
  for (const k of NEEDS) {
    const raw = c.deltas[k]; if (!raw) continue;
    const D = Math.min(raw, 100 - d.needs[k]);
    needs += m[k] * D * urgency(d.needs[k]);
  }
  const affinityT = plain ? 0 : 20 * affinity(c, d.traits);
  const emotionT = plain ? 0 : emotionTerm(c, d.emotion);
  // event: the featured match on the screen this advert watches (+25 fan); for 60 s after a goal or a touchdown, +30 on
  // cheer, high-five and toast
  const eventT = plain ? 0 : (c.featuredScreen && c.tags.includes('watch') ? 25 * d.traits.fan : 0) + (c.goal60 && (c.inter === 'cheer' || c.inter === 'high-five' || c.inter === 'toast') ? 30 : 0);
  const memoryT = c.memory ?? 0;
  const urgentT = URGENT * raisesUrgent(c, d.needs).length;
  const walkT = -0.6 * c.walk, occT = -15 * c.occupancy, waitT = -0.05 * c.wait, midT = c.leavesMidTurn ? -25 : 0;
  const s = needs + affinityT + emotionT + eventT + memoryT + urgentT + walkT + occT + waitT + midT;
  return { c, score: s, terms: { needs, affinity: affinityT, emotion: emotionT, event: eventT, memory: memoryT, urgent: urgentT, walk: walkT, occupancy: occT, wait: waitT, midTurn: midT } };
}

export interface Decision {
  /** the chosen action (the current one when it's kept), or null when there's nothing to do */
  chosen: Scored | null; kept: boolean;
  /** the best overlay scoring 25 or more, taken alongside */
  overlay: Scored | null;
  top: Scored[];
  urgent: Need[];
}
/**
 * One decision. `cands` holds every advert the candidate rule lets in, the current continuous action among them
 * (`current`), overlays marked. `r` is the person's seeded draw.
 */
export function decide(cands: Cand[], d: Decider, r: () => number): Decision {
  const urgentNeeds = NEEDS.filter((k) => d.needs[k] < URGENT);
  const cur = cands.find((c) => c.current) ?? null;
  const curTags = cur && cur.continuous ? cur.tags : null;
  const scored: Scored[] = [], overlays: Scored[] = [];
  for (const c of cands) {
    // the urgent rule's third clause: the current continuous action and anything sharing a tag with it, plain
    const plain = urgentNeeds.length > 0 && !!curTags && (c === cur || c.tags.some((t) => curTags.includes(t)));
    const s = score(c, d, plain);
    (c.overlay ? overlays : scored).push(s);
  }
  // hysteresis: a continuous current action is left only for a candidate beating it by 25% plus 10, unless the
  // candidate raises an urgent need by 10 or more
  const curS = cur ? scored.find((s) => s.c === cur) ?? null : null;
  const pool = scored.filter((s) => {
    if (!curS || s === curS || !cur!.continuous) return true;
    if (raisesUrgent(s.c, d.needs).length) return true;
    return s.score > curS.score * 1.25 + 10;
  });
  pool.sort((a, b) => b.score - a.score);
  const top = pool.slice(0, 3);
  let chosen: Scored | null = null;
  if (top.length) {
    const best = top[0].score, w = top.map((s) => Math.exp((s.score - best) / 8)), W = w.reduce((a, b) => a + b, 0);
    let x = r() * W; chosen = top[top.length - 1];
    for (let i = 0; i < top.length; i++) { x -= w[i]; if (x <= 0) { chosen = top[i]; break; } }
  }
  let overlay: Scored | null = null;
  for (const o of overlays) if (o.score >= OVERLAY_MIN && (!overlay || o.score > overlay.score)) overlay = o;
  return { chosen, kept: !!chosen && chosen === curS, overlay, top, urgent: urgentNeeds };
}
