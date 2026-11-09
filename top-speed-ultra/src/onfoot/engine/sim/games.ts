// The games' results (PROJECT_OC_SPORTS_BAR.md, "The games: pool, darts, shuffleboard", "Results"): a win gives the
// winner the "Won a game" moodlet, +12 x (0.6 + 0.8 competitive), and 5 house tokens; the loser of a close game gets
// "Lost a close one" (-4). Nothing is wagered: no stake, no odds, no tokens lost. Playing together counts as an
// interaction for relationships (+6 for the winner, +4 for the loser, both in a good mood): S3b's, recorded here as
// the numbers it will use. What "close" means is each game's own (ours): pool, the loser had 2 or fewer of their balls
// left; darts, 40 or fewer to go; shuffleboard, 11 or more points.
import { MOODLETS } from './needs';

export type GameKind = 'pool' | 'darts' | 'shuffleboard';
export const GAME_KINDS: GameKind[] = ['pool', 'darts', 'shuffleboard'];
/** the "Won a game" moodlet's value for a competitiveness */
export const wonGameValue = (competitive: number) => MOODLETS['won-game'].value * (0.6 + 0.8 * competitive);
export const GAME_TOKENS = 5;
/** S3b's relationship deltas for a game played together (both in a good mood) */
export const PLAYED_TOGETHER = { winner: 6, loser: 4 };
export const NO_STAKES = 'Friendly games: nothing is wagered, ever.';
