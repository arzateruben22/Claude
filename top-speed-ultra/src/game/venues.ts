// The places you can drive to and get out at (PROJECT_OC_ON_FOOT.md "Getting there" and Phase 3a; PROJECT_OC_SPORTS_BAR.md
// "Joining the game later", J1): Lot 57 and Stoppage Time, our own fictional venues. Each is reached from the exit
// ramps the data workflow's freeway-link files list (src/data/anaheim/freeway-link.json and
// sportsbar-freeway-link.json, the authoritative ones), where each ramp meets the real street. Street driving isn't
// built yet: about 80 m before the ramp meets the street the game fades and parks you in your stall, and says so.
import lotLink from '../data/anaheim/freeway-link.json';
import barLink from '../data/anaheim/sportsbar-freeway-link.json';
import type { Network } from './world/Network';
import type { Path } from './world/Path';
import { STEP } from './world/Path';
import type { Quality, TimeOfDay } from './settings';

export type VenueId = 'lot57' | 'stoppage';
export interface VenueExit {
  /** the ramps (game path ids, in order from the freeway) and the freeway they leave (its game label) */
  ramps: number[]; from: string;
  /** the guide sign's text, and the street you drive to the venue (for the toast), shortened as on a sign */
  sign: string; street: string;
  /** where the ramp meets the street (game coordinates) */
  x: number; z: number;
}
export interface Venue { id: VenueId; name: string; exits: VenueExit[] }

interface RawExit { main_path: number; freeway: string; sign: string[]; ramp_paths: number[]; terminal: { x: number; z: number; streets: string[] }; route: { streets: string[] } }
const short = (s: string) => s.replace(/^(East|West|North|South) /, '').replace(/ Avenue\b/, ' Ave').replace(/ Boulevard\b/, ' Blvd').replace(/ Drive\b/, ' Dr');
const exitOf = (e: RawExit, street?: string): VenueExit => ({
  ramps: e.ramp_paths, from: String(e.main_path), sign: e.sign.map(short).join(' / '),
  street: street ?? short(e.route.streets.find((s) => !s.startsWith('(')) ?? e.terminal.streets[0]), x: e.terminal.x, z: e.terminal.z,
});
const pick = (link: { exits: RawExit[] }, ramps: number) => link.exits.find((e) => e.ramp_paths[0] === ramps)!;

/** the plan's exits for each venue, the default first (Lot 57: the CA-57 South exit to Orangewood; Stoppage Time: the
 *  I-5 North exit to Disney Way / Katella, ramp 124) */
export const VENUES: Venue[] = [
  { id: 'lot57', name: 'Lot 57', exits: [exitOf(pick(lotLink, 1142)), exitOf(pick(lotLink, 1264)), exitOf(pick(lotLink, 562))] },
  // (the I-5 South exit's route runs a few metres of Manchester Avenue, then east on Katella: the street it's named for)
  { id: 'stoppage', name: 'Stoppage Time', exits: [exitOf(pick(barLink, 124)), exitOf(pick(barLink, 791), 'Katella Ave')] },
];
export const venueByName = (name: string | null) => VENUES.find((v) => v.name === name) ?? null;

/** one of a venue's ramps: how far along it the street is (Infinity: the street is on the next ramp of the exit) */
export interface VenueRamp { venue: Venue; exit: VenueExit; path: Path; sTerm: number }

/** every venue ramp in the network, keyed by path: the street's place on the ramp found from the data's terminal */
export function venueRamps(net: Network): Map<Path, VenueRamp> {
  const out = new Map<Path, VenueRamp>();
  for (const venue of VENUES) for (const exit of venue.exits) {
    exit.from = net.paths[Number(exit.from)]?.label || exit.from;
    for (const id of exit.ramps) {
      const path = net.paths[id];
      if (!path) continue;
      let bi = 0, bd = Infinity;
      for (let i = 0; i < path.n; i++) { const d = Math.hypot(path.xs[i] - exit.x, path.zs[i] - exit.z); if (d < bd) { bd = d; bi = i; } }
      out.set(path, { venue, exit, path, sTerm: bd < 25 ? Math.min(path.len, bi * STEP) : Infinity });
    }
  }
  return out;
}
/** metres from s on this ramp to where it meets the street (along the exit's next ramp if the street is on that) */
export function toStreet(map: Map<Path, VenueRamp>, r: VenueRamp, s: number): number {
  if (isFinite(r.sTerm)) return r.sTerm - s;
  const nx = r.path.next ? map.get(r.path.next) : undefined;
  if (nx && nx.exit === r.exit && isFinite(nx.sTerm)) return r.path.len - s + nx.sTerm;
  return r.path.len - s;
}

/** the venue's graphics for the game's preset: Low and Ultra as they are; High is the venues' High (Stoppage Time
 *  calls it HD); Medium is Low on a touch screen (the venues' phone budget) and High on a desktop */
export function venueQuality(q: Quality, coarse: boolean): 'low' | 'high' | 'ultra' {
  return q === 'ultra' ? 'ultra' : q === 'high' ? 'high' : q === 'medium' && !coarse ? 'high' : 'low';
}
// the hour each of the game's time presets shows (Environment.ts TEMP_HOUR, which the HUD's clock reads)
const PRESET_HOUR: Record<Exclude<TimeOfDay, 'live'>, number> = { sunrise: 6.5, day: 12.5, sunset: 19.5, night: 23 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** the venue's clock from the game's time of day: Live is the device's clock; a preset is its hour, today (Pacific) */
export function venueClock(t: TimeOfDay, now = new Date()): { live: true } | { day: number; hour: number } {
  if (t === 'live') return { live: true };
  const wd = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Los_Angeles' });
  return { day: Math.max(0, DAYS.indexOf(wd)), hour: PRESET_HOUR[t] };
}
