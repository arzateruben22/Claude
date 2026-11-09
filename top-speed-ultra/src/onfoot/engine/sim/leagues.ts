// Our two fictional leagues (PROJECT_OC_SPORTS_BAR.md, "The games on the screens (fictional leagues)"). Every name and
// colour is ours; no real league, team, player, broadcaster, channel brand, tournament or trophy appears, and no player
// names at all. tests/onfoot/sportsbar-blocklist.json and tests/sportsbar.mjs check these names against real ones.
export type LeagueId = 'marigold' | 'gridiron';
export interface Team { abbr: string; name: string; league: LeagueId; idx: number; colors: [string, string] }
export interface League { id: LeagueId; name: string; short: string; channel: 1 | 2; teams: Team[] }

const T = (league: LeagueId, rows: [string, string, string, string][]): Team[] => rows.map(([name, abbr, a, b], idx) => ({ abbr, name, league, idx, colors: [a, b] }));
export const LEAGUES: Record<LeagueId, League> = {
  marigold: {
    id: 'marigold', name: 'Marigold League', short: 'Marigold', channel: 1,
    teams: T('marigold', [
      ['Harborline FC', 'HBL', '#1D3B6A', '#F2F2EE'],
      ['Arroyo Kestrels', 'ARK', '#B5532A', '#F1E3C2'],
      ['Citrus Grove Sparrows', 'CGS', '#F28C28', '#24563A'],
      ['Palisade Lanterns', 'PAL', '#E8B931', '#2B2B30'],
      ['Saltflat Terns', 'SFT', '#7FC1E6', '#14324A'],
      ['Ridgeview Sundials', 'RVS', '#5B3A8C', '#F2B134'],
      ['Bluffside Undertow', 'BLU', '#0F6F73', '#E6D3A3'],
      ['Mesa Quail', 'MSQ', '#7A1F2B', '#D8B68A'],
    ]),
  },
  gridiron: {
    id: 'gridiron', name: 'Canyon Gridiron Circuit', short: 'Canyon Gridiron', channel: 2,
    teams: T('gridiron', [
      ['Interchange Flyovers', 'INT', '#5E636B', '#F26A21'],
      ['Basin Freight', 'BAF', '#5C4030', '#F4C430'],
      ['Sunset Signal', 'SSG', '#C2305F', '#F59A3A'],
      ['Ironwood Ratchets', 'IWR', '#1C1C1E', '#C0C4C8'],
      ['Copperline Haulers', 'CPH', '#B5673A', '#1F4A4A'],
      ['Breakwater Gantries', 'BWG', '#2A5D9E', '#D23B2F'],
      ['Dune Patrol', 'DNP', '#C9B27C', '#3E4C22'],
      ['Grove Pickers', 'GRP', '#3C8A3A', '#F5F5F0'],
    ]),
  },
};
export const CHANNEL_NAMES: Record<1 | 2 | 3, string> = { 1: 'Marigold League', 2: 'Canyon Gridiron', 3: 'Highlights' };
export const ALL_TEAMS: Team[] = [...LEAGUES.marigold.teams, ...LEAGUES.gridiron.teams];
export const teamByAbbr = (a: string) => ALL_TEAMS.find((t) => t.abbr === a) ?? null;
/** every name the blocklist test reads: the teams, the leagues and the channels */
export const NAMES_FOR_BLOCKLIST = [...ALL_TEAMS.map((t) => t.name), LEAGUES.marigold.name, LEAGUES.gridiron.name, ...Object.values(CHANNEL_NAMES)];

/** a crest drawn in code: a shield in the team's two colours with its letters (an inline SVG string) */
export function crestSvg(t: Team, px = 28) {
  const [a, b] = t.colors;
  return `<svg width="${px}" height="${px}" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 L36 8 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V8 Z" fill="${a}" stroke="${b}" stroke-width="2.5"/><path d="M4 20 H36" stroke="${b}" stroke-width="3"/><text x="20" y="31" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="9" font-weight="900" fill="${b}">${t.abbr}</text></svg>`;
}
