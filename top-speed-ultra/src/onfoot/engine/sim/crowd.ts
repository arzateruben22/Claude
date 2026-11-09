// The simulated crowd as data (PROJECT_OC_SPORTS_BAR.md, "Regulars, walk-ins and staff", "The simulated crowd" and
// "Personality"). Pure: no three.js, no page. Everything is drawn from seeds, so the same clock and seeds give the same
// room; nothing is live, and nobody is a real person or another player.
//   - the regulars: a pool of 48 seeded on the device (looks, first names, traits, teams, favourites, the days and hours
//     they come), in friend groups of 2 to 5 that arrive together;
//   - walk-ins: parties of 1 to 6, forgotten when they leave;
//   - stays: log-normal with an 80-minute median;
//   - teams by arrival time (the featured match's two teams a quarter each, from 2 h before its kick-off to its final
//     whistle; otherwise 30% Marigold, 25% Canyon Gridiron, 45% none);
//   - the staff plan by the crowd share, capped by the preset's drawn staff (Low draws at most 5).
import type { Traits } from './needs';
import { hash32, mulberry, Rnd, gauss } from './rng';
import { FIRST_NAMES } from './names';
import { LEAGUES } from './leagues';
import type { Fixture } from './tv';

export const REGULARS = 48;
/** the plan's party sizes, 1 to 6 (ours: a mean of about 2.6) */
const PARTY_W = [0.2, 0.35, 0.2, 0.15, 0.06, 0.04];
export const MEAN_PARTY = PARTY_W.reduce((a, w, i) => a + w * (i + 1), 0);
export function partySize(r: Rnd) { let x = r(); for (let i = 0; i < PARTY_W.length; i++) { x -= PARTY_W[i]; if (x <= 0) return i + 1; } return 2; }
/** a stay, sim minutes: log-normal, median 80 (sigma 0.45, ours), held to 25 to 240 */
export const STAY_MEDIAN = 80, STAY_SIGMA = 0.45;
export const STAY_MEAN = STAY_MEDIAN * Math.exp((STAY_SIGMA * STAY_SIGMA) / 2);
export function stayMinutes(r: Rnd) { return Math.min(240, Math.max(25, STAY_MEDIAN * Math.exp(STAY_SIGMA * gauss(r)))); }

export function traitsOf(r: Rnd): Traits { return { outgoing: r(), playful: r(), competitive: r(), fan: r(), active: r() }; }
const MARIGOLD = LEAGUES.marigold.teams.map((t) => t.abbr), GRIDIRON = LEAGUES.gridiron.teams.map((t) => t.abbr);
/** a team at an arrival time (abs sim minute): `featured` is that day's featured fixture, if any */
export function teamAt(r: Rnd, t: number, featured: Fixture | null): string | null {
  if (featured && t >= featured.ko - 120 && t <= featured.fw && r() < 0.5) return r() < 0.5 ? featured.home.abbr : featured.away.abbr;
  const x = r();
  if (x < 0.3) return MARIGOLD[Math.floor(r() * MARIGOLD.length) % MARIGOLD.length];
  if (x < 0.55) return GRIDIRON[Math.floor(r() * GRIDIRON.length) % GRIDIRON.length];
  return null;
}
/** the menu's item ids (venues/sportsbar/menu.ts) a guest can have as a favourite; NPCs also have "a pint" (scene only) */
export const DRINK_FAVES = ['lime-soda', 'tamarindo', 'cucumber', 'zero-lager', 'cafe-olla', 'float'];
export const FOOD_FAVES = ['wings', 'asada-fries', 'nachos', 'smash', 'sliders', 'quesadilla', 'pretzel'];
export const GAME_FAVES = ['pool', 'darts', 'shuffleboard'];

export interface Regular {
  key: string; seed: number; name: string; traits: Traits; team: string | null;
  favourites: { drink: string; food: string; game: string };
  group: number;
}
export interface RegularGroup { id: number; members: number[]; days: number[]; from: number; to: number }
/** the regulars' pool from its seed: 48 people in friend groups of 2 to 5, each group with two or three days a week and
 *  a window of hours they come in (ours: within the open hours, weighted to the evening) */
export function regularsPool(seed: number): { regulars: Regular[]; groups: RegularGroup[] } {
  const r = mulberry(hash32('regulars', seed));
  const regulars: Regular[] = [], groups: RegularGroup[] = [];
  let i = 0, g = 0;
  const used = new Set<string>();
  while (i < REGULARS) {
    // 2 to 5, never leaving one regular on their own at the end
    let n = Math.min(REGULARS - i, 2 + Math.floor(r() * 4));
    if (REGULARS - i - n === 1) n = n < 5 ? n + 1 : n - 1;
    const members: number[] = [];
    for (let k = 0; k < n; k++, i++) {
      let name = FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)];
      for (let tries = 0; used.has(name) && tries < 20; tries++) name = FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)];
      used.add(name);
      regulars.push({ key: `r${i}`, seed: hash32('regular', seed, i), name, traits: traitsOf(r), team: teamAt(r, 0, null), favourites: { drink: DRINK_FAVES[Math.floor(r() * 6)], food: FOOD_FAVES[Math.floor(r() * 7)], game: GAME_FAVES[Math.floor(r() * 3)] }, group: g });
      members.push(i);
    }
    const days = [...new Set([Math.floor(r() * 7), Math.floor(r() * 7), r() < 0.5 ? 5 + Math.floor(r() * 2) : Math.floor(r() * 7)])];
    const from = r() < 0.7 ? 17 + Math.floor(r() * 4) : 11 + Math.floor(r() * 6);
    groups.push({ id: g++, members, days, from, to: from + 3 + Math.floor(r() * 3) });
  }
  return { regulars, groups };
}

// ------------------------------------------------------------------------------------------------ the staff plan
export type StaffRole = 'bartender' | 'server' | 'host' | 'barback' | 'house';
export interface StaffPlan { bartender: number; server: number; host: number; barback: number; house: number }
/** the plan's table by the crowd share s: bartenders 2 / 3 / 4, servers 1 / 2 / 3, the host (s >= 0.6, the featured
 *  match's x1.25 window, game nights), the barback (s >= 0.5); the house player (our games' opponent, S2b). Then the
 *  preset's drawn staff: Low draws at most 5 (2 bartenders, 2 servers and the host; no barback), and the house player
 *  takes the host's place there only while a game is on; HD and Ultra draw them all (up to 9 and the house player) */
export function staffPlan(s: number, o: { open: boolean; host: boolean; low: boolean; houseInGame: boolean }): StaffPlan {
  if (!o.open) return { bartender: 0, server: 0, host: 0, barback: 0, house: 0 };
  const want: StaffPlan = { bartender: s < 0.35 ? 2 : s < 0.7 ? 3 : 4, server: s < 0.3 ? 1 : s < 0.65 ? 2 : 3, host: o.host || s >= 0.6 ? 1 : 0, barback: s >= 0.5 ? 1 : 0, house: 1 };
  if (!o.low) return want;
  const p: StaffPlan = { bartender: Math.min(2, want.bartender), server: Math.min(2, want.server), host: want.host, barback: 0, house: o.houseInGame ? 1 : 0 };
  // at most 5 drawn: the house player, while a game is on, takes the host's place, then a server's
  let total = p.bartender + p.server + p.host + p.house;
  if (total > 5 && p.host) { p.host = 0; total--; }
  while (total > 5 && p.server > 1) { p.server--; total--; }
  return p;
}
export const staffTotal = (p: StaffPlan) => p.bartender + p.server + p.host + p.barback + p.house;
