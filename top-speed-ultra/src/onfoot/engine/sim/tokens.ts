// House tokens, tonight's three, and saving (PROJECT_OC_SPORTS_BAR.md, "Tokens and saving"). Tokens are house tokens:
// earned in the bar, spent only on rounds, never bought, never exchanged and never staked; there is no purchase path
// and no price anywhere. Saving is on this device only (localStorage, every read and write wrapped), and the page
// works without storage.
import { hash32, mulberry } from './rng';

export const TOKENS_LABEL = "House tokens are part of the game. They can't be bought and have no cash value.";
export const SAVE_LABEL = 'Saved on this device only';

export type GoalId = 'darts-win' | 'toast-goal' | 'introduce' | 'buy-round' | 'regular-laugh' | 'cheer-three' | 'watch-final'
  | 'shuffle-three' | 'pool-two' | 'order-favourite' | 'dance-game-night' | 'song';
/** about a dozen evening goals (ours): optional, no timer, nothing to fail */
export const GOALS: Record<GoalId, string> = {
  'darts-win': 'Win a game of darts', 'toast-goal': 'Toast a goal with someone', 'introduce': 'Introduce two people',
  'buy-round': 'Buy a round', 'regular-laugh': 'Make a regular laugh', 'cheer-three': 'Cheer a goal with three people',
  'watch-final': 'Watch a match to the final whistle', 'shuffle-three': 'Land a 3 at shuffleboard', 'pool-two': 'Pot two balls in one pool turn',
  'order-favourite': 'Order your favourite', 'dance-game-night': 'Dance on a game night', 'song': 'Pick a song on the jukebox',
};
/** tonight's three, seeded by the date and the visit */
export function tonightsThree(dateKey: number, visit: number): GoalId[] {
  const ids = Object.keys(GOALS) as GoalId[], r = mulberry(hash32('three', dateKey, visit)), out: GoalId[] = [];
  while (out.length < 3) { const g = ids[Math.floor(r() * ids.length) % ids.length]; if (!out.includes(g)) out.push(g); }
  return out;
}

export interface SaveData {
  v: 1;
  tokens: number; visits: number; firstVisitPaid: boolean;
  regularsSeed: number;
  friendships: Record<string, number>; memories: { who: string; text: string; t: number }[]; highlights: string[];
  team: string | null;
  favourites: { drink: string; food: string; game: string };
  settings: { autonomy: boolean; text: 0 | 1 | 2 };
  /** tonight's three for the visit in progress and which are done */
  tonight: { date: number; visit: number; goals: GoalId[]; done: GoalId[] } | null;
}
export const SAVE_KEY = 'oc.onfoot.sportsbar.v1';

/** the saved state, or a fresh one; never throws (blocked storage, a private window, a bad record) */
export function loadSave(seed: number): { data: SaveData; storage: 'ok' | 'empty' | 'blocked' | 'bad' } {
  const fresh = (): SaveData => {
    const r = mulberry(hash32('fresh', seed));
    const drinks = ['lime-soda', 'tamarindo', 'cucumber', 'zero-lager', 'cafe-olla', 'float'], foods = ['wings', 'asada-fries', 'nachos', 'smash', 'sliders', 'quesadilla', 'pretzel'], games = ['pool', 'darts', 'shuffleboard'];
    return { v: 1, tokens: 0, visits: 0, firstVisitPaid: false, regularsSeed: hash32('regulars', seed), friendships: {}, memories: [], highlights: [], team: null,
      favourites: { drink: drinks[Math.floor(r() * drinks.length)], food: foods[Math.floor(r() * foods.length)], game: games[Math.floor(r() * games.length)] },
      settings: { autonomy: false, text: 1 }, tonight: null };
  };
  let raw: string | null = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return { data: fresh(), storage: 'blocked' }; }
  if (!raw) return { data: fresh(), storage: 'empty' };
  try {
    const d = JSON.parse(raw) as SaveData;
    if (d.v !== 1 || typeof d.tokens !== 'number') return { data: fresh(), storage: 'bad' };
    return { data: { ...fresh(), ...d, settings: { ...fresh().settings, ...(d.settings ?? {}) } }, storage: 'ok' };
  } catch { return { data: fresh(), storage: 'bad' }; }
}
/** write the state; false if storage is blocked or full (the page carries on) */
export function writeSave(d: SaveData): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); return true; } catch { return false; }
}

/** the token rules: what each earning is worth */
export const EARN = { firstVisit: 50, gameWon: 5, firstGoodChat: 2, perFiveMinutes: 1, perVisitTimeCap: 12, tonightsGoal: 5 };
