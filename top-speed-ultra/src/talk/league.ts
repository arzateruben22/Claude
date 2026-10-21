// The Coastal League: eight made-up baseball clubs, a season that plays itself from the calendar, the same on every
// device with no server (every result comes from a hash of the date, so two phones agree). Nothing here is a real
// team, player or league; the names are ours.

export interface Club { id: string; city: string; name: string; short: string; colour: string }
export const CLUBS: Club[] = [
  { id: 'ana', city: 'Anaheim', name: 'Citrus', short: 'ANA', colour: '#f28c28' },
  { id: 'sna', city: 'Santa Ana', name: 'Sunliners', short: 'SNA', colour: '#d8372b' },
  { id: 'hb', city: 'Huntington', name: 'Tides', short: 'HB', colour: '#2a7fb8' },
  { id: 'irv', city: 'Irvine', name: 'Foxes', short: 'IRV', colour: '#b85c1e' },
  { id: 'ful', city: 'Fullerton', name: 'Rails', short: 'FUL', colour: '#4a4f58' },
  { id: 'nb', city: 'Newport', name: 'Yachts', short: 'NB', colour: '#1f3a6e' },
  { id: 'lag', city: 'Laguna', name: 'Pelicans', short: 'LAG', colour: '#2f8f6f' },
  { id: 'cm', city: 'Costa Mesa', name: 'Rockets', short: 'CM', colour: '#8a2fb8' },
];
export interface Game { home: Club; away: Club; homeRuns: number; awayRuns: number; innings: number }
export interface Standing { club: Club; w: number; l: number; streak: number }   // streak: +n wins in a row, -n losses
export interface Phase { kind: 'season' | 'playoffs' | 'offseason'; day: number; of: number }
export interface LeagueDay { date: string; phase: Phase; yesterday: Game[]; tonight: [Club, Club][]; standings: Standing[]; leader: Standing; hottest: Standing; coldest: Standing; daysToOpening: number }

const SEASON_START = [3, 1], SEASON_END = [8, 30], PLAYOFF_END = [9, 15];    // Apr 1 to Sep 30; playoffs to Oct 15 (month index, day)
export const strength = (c: Club, year: number) => 0.42 + 0.16 * hash(`${c.id}:${year}`);   // a club's true quality this year, 0.42..0.58

export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOf = (year: number, m: number, d: number) => new Date(year, m, d);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

// the four match-ups on a date: a rotation of the eight clubs so everyone plays every day, home and away alternating
export function gamesOn(date: Date): [Club, Club][] {
  const n = CLUBS.length, start = dayOf(date.getFullYear(), SEASON_START[0], SEASON_START[1]);
  const r = ((daysBetween(start, date) % (n - 1)) + (n - 1)) % (n - 1);
  // the circle method: club 0 fixed, the others rotate
  const idx = [0, ...Array.from({ length: n - 1 }, (_, i) => 1 + ((i + r) % (n - 1)))];
  const out: [Club, Club][] = [];
  for (let i = 0; i < n / 2; i++) { const a = CLUBS[idx[i]], b = CLUBS[idx[n - 1 - i]]; out.push(hash(`${key(date)}:${a.id}:${b.id}:home`) < 0.5 ? [a, b] : [b, a]); }
  return out;
}
export function playGame(date: Date, home: Club, away: Club): Game {
  const y = date.getFullYear(), seed = `${key(date)}:${home.id}:${away.id}`;
  const pHome = 0.5 + (strength(home, y) - strength(away, y)) + 0.04;        // home field
  const homeWins = hash(seed + ':w') < pHome;
  const low = Math.floor(hash(seed + ':l') * 5), high = low + 1 + Math.floor(hash(seed + ':h') * 7);
  const innings = hash(seed + ':x') < 0.08 ? 10 + Math.floor(hash(seed + ':xi') * 4) : 9;
  return { home, away, homeRuns: homeWins ? high : low, awayRuns: homeWins ? low : high, innings };
}
function inSeason(d: Date) { const y = d.getFullYear(); return d >= dayOf(y, SEASON_START[0], SEASON_START[1]) && d <= dayOf(y, SEASON_END[0], SEASON_END[1]); }

export function leagueDay(now: Date = new Date()): LeagueDay {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), y = today.getFullYear();
  const start = dayOf(y, SEASON_START[0], SEASON_START[1]), end = dayOf(y, SEASON_END[0], SEASON_END[1]), pEnd = dayOf(y, PLAYOFF_END[0], PLAYOFF_END[1]);
  const phase: Phase = inSeason(today) ? { kind: 'season', day: daysBetween(start, today) + 1, of: daysBetween(start, end) + 1 }
    : today > end && today <= pEnd ? { kind: 'playoffs', day: daysBetween(end, today), of: daysBetween(end, pEnd) }
    : { kind: 'offseason', day: 0, of: 0 };
  // standings: every game from opening day to yesterday
  const table = new Map(CLUBS.map((c) => [c.id, { club: c, w: 0, l: 0, streak: 0 } as Standing]));
  const last = today < start ? dayOf(y - 1, SEASON_END[0], SEASON_END[1]) : today > end ? end : new Date(today.getTime() - 86400000);
  const first = today < start ? dayOf(y - 1, SEASON_START[0], SEASON_START[1]) : start;
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    for (const [h, a] of gamesOn(d)) {
      const g = playGame(d, h, a), hw = g.homeRuns > g.awayRuns;
      const H = table.get(h.id)!, A = table.get(a.id)!;
      if (hw) { H.w++; A.l++; H.streak = H.streak > 0 ? H.streak + 1 : 1; A.streak = A.streak < 0 ? A.streak - 1 : -1; }
      else { A.w++; H.l++; A.streak = A.streak > 0 ? A.streak + 1 : 1; H.streak = H.streak < 0 ? H.streak - 1 : -1; }
    }
  }
  const standings = [...table.values()].sort((p, q) => q.w - p.w || p.l - q.l || p.club.id.localeCompare(q.club.id));
  const yesterdayDate = new Date(today.getTime() - 86400000);
  const yesterday = inSeason(yesterdayDate) ? gamesOn(yesterdayDate).map(([h, a]) => playGame(yesterdayDate, h, a)) : [];
  const tonight = inSeason(today) ? gamesOn(today) : [];
  const hottest = standings.reduce((m, s) => (s.streak > m.streak ? s : m)), coldest = standings.reduce((m, s) => (s.streak < m.streak ? s : m));
  const nextOpening = today < start ? start : dayOf(y + 1, SEASON_START[0], SEASON_START[1]);
  return { date: key(today), phase, yesterday, tonight, standings, leader: standings[0], hottest, coldest, daysToOpening: daysBetween(today, nextOpening) };
}
export const clubName = (c: Club) => `${c.city} ${c.name}`;
export const score = (g: Game) => `${clubName(g.home)} ${g.homeRuns}, ${clubName(g.away)} ${g.awayRuns}${g.innings > 9 ? ` in ${g.innings}` : ''}`;
