// Your driver profile: name, avatar, level and XP, credits (fictional, earned by driving, never bought), lifetime
// stats, the freeways you've driven, achievements. Saved on this device (localStorage) with a version number, so
// later versions can migrate it. Nothing leaves the device.

export const PROFILE_VERSION = 1;
const KEY = 'tsu.profile';

export interface Profile {
  v: number;
  username: string;
  avatar: number;                    // index into AVATARS
  xp: number;
  credits: number;                   // OC Credits: fictional, in-game only
  timeDriven: number;                // seconds
  distance: number;                  // metres
  topSpeed: number;                  // m/s
  bestStreak: number;                // longest time over 100 mph, seconds
  nearMisses: number;
  cleanPasses: number;
  collisions: number;
  interchanges: number;              // times you've gone from one freeway onto another
  racesWon: number;
  runs: number;
  freeways: string[];                // carriageways driven, e.g. 'CA-55 North'
  vehicles: string[];
  achievements: string[];
  created: number;
}

export const AVATARS = [
  { bg: '#d0141e', fg: '#fff' }, { bg: '#f5c518', fg: '#111' }, { bg: '#1d4f9c', fg: '#fff' }, { bg: '#0a6a3a', fg: '#fff' },
  { bg: '#f3f1ec', fg: '#111' }, { bg: '#7a3cc2', fg: '#fff' }, { bg: '#e8701a', fg: '#111' }, { bg: '#2b2f36', fg: '#f5c518' },
];

export const ROUTES_ALL = ['I-5', 'I-405', 'CA-55', 'CA-57', 'CA-22', 'CA-91', 'CA-73', 'CA-133', 'CA-241', 'CA-261'];

export const ACHIEVEMENTS: { id: string; name: string; how: string }[] = [
  { id: 'ton', name: 'Ton Up', how: 'Reach 100 mph' },
  { id: 'double-ton', name: 'Double Ton', how: 'Reach 200 mph' },
  { id: 'first-merge', name: 'First Merge', how: 'Take a connector onto another freeway' },
  { id: 'orange-crush', name: 'Orange Crush', how: 'Drive the 5, the 22 and the 57' },
  { id: 'toll-roads', name: 'The Toll Roads', how: 'Drive the 73, 133, 241 and 261 (no tolls charged here)' },
  { id: 'ten', name: 'Ten for Ten', how: 'Drive all ten freeways' },
  { id: 'survivor', name: 'Survivor', how: 'Stay over 100 mph for 60 seconds' },
  { id: 'needle', name: 'Thread the Needle', how: '10 near misses in one run' },
  { id: 'hundred-miles', name: 'Commuter', how: 'Drive 100 miles in total' },
];

// level n needs 400·n^1.5 XP in total (level 1 at 0)
export const xpFor = (level: number) => Math.round(400 * Math.pow(Math.max(0, level - 1), 1.5));
export function levelOf(xp: number) { let l = 1; while (xpFor(l + 1) <= xp) l++; return l; }

function fresh(): Profile {
  return { v: PROFILE_VERSION, username: 'Driver', avatar: 0, xp: 0, credits: 0, timeDriven: 0, distance: 0, topSpeed: 0, bestStreak: 0,
    nearMisses: 0, cleanPasses: 0, collisions: 0, interchanges: 0, racesWon: 0, runs: 0, freeways: [], vehicles: ['rossini-gt'], achievements: [], created: Date.now() };
}

// older saves come in through here, one version at a time
function migrate(raw: Record<string, unknown>): Profile {
  const base = fresh();
  const p = { ...base, ...raw } as Profile;
  // (v0 never shipped; a future v2 would be handled with: if (p.v === 1) { ...; p.v = 2; })
  p.v = PROFILE_VERSION;
  for (const k of ['xp', 'credits', 'timeDriven', 'distance', 'topSpeed', 'bestStreak', 'nearMisses', 'cleanPasses', 'collisions', 'interchanges', 'racesWon', 'runs'] as const) {
    if (typeof p[k] !== 'number' || !isFinite(p[k])) p[k] = 0;
  }
  if (!Array.isArray(p.freeways)) p.freeways = [];
  if (!Array.isArray(p.vehicles) || !p.vehicles.length) p.vehicles = ['rossini-gt'];
  if (!Array.isArray(p.achievements)) p.achievements = [];
  p.username = String(p.username || 'Driver').slice(0, 20);
  p.avatar = Math.max(0, Math.min(AVATARS.length - 1, Number(p.avatar) || 0));
  return p;
}

export function loadProfile(): Profile {
  try { const raw = localStorage.getItem(KEY); return raw ? migrate(JSON.parse(raw)) : fresh(); } catch { return fresh(); }
}
export function saveProfile(p: Profile) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* a convenience */ } }

// what a stretch of driving earns: XP and credits, plus anything newly unlocked
export interface Earned { xp: number; credits: number; levelUp: number | null; unlocked: string[] }
export class ProfileBook {
  p: Profile;
  private dirty = 0;
  constructor() { this.p = loadProfile(); }
  get level() { return levelOf(this.p.xp); }

  // call often with small amounts; returns what changed worth telling you about
  add(d: { time?: number; distance?: number; speed?: number; streak?: number; nearMiss?: number; cleanPass?: number; collision?: number; freeway?: string; interchange?: number; runNearMisses?: number }): Earned {
    const p = this.p, before = this.level;
    let xp = 0, credits = 0;
    if (d.time) p.timeDriven += d.time;
    if (d.distance) { p.distance += d.distance; xp += d.distance / 100; credits += d.distance / 200; }
    if (d.speed && d.speed > p.topSpeed) p.topSpeed = d.speed;
    if (d.streak && d.streak > p.bestStreak) p.bestStreak = d.streak;
    if (d.nearMiss) { p.nearMisses += d.nearMiss; xp += 25 * d.nearMiss; credits += 10 * d.nearMiss; }
    if (d.cleanPass) { p.cleanPasses += d.cleanPass; xp += 8 * d.cleanPass; credits += 3 * d.cleanPass; }
    if (d.collision) p.collisions += d.collision;
    if (d.interchange) { p.interchanges += d.interchange; xp += 30 * d.interchange; credits += 15 * d.interchange; }
    if (d.freeway && !p.freeways.includes(d.freeway)) { p.freeways.push(d.freeway); xp += 150; credits += 50; }
    p.xp += xp; p.credits += credits;
    const unlocked = this.check(d.runNearMisses ?? 0);
    const after = this.level;
    this.dirty += xp + (unlocked.length ? 1e9 : 0) + (d.freeway ? 1e9 : 0);
    if (this.dirty > 50) this.save();
    return { xp, credits, levelUp: after > before ? after : null, unlocked };
  }

  private check(runNearMisses: number): string[] {
    const p = this.p, got: string[] = [];
    const routes = new Set(p.freeways.map((f) => f.replace(/\s+(North|South|East|West)$/, '')));
    const has = (r: string[]) => r.every((x) => routes.has(x));
    const test: Record<string, boolean> = {
      ton: p.topSpeed >= 100 / 2.236936,
      'double-ton': p.topSpeed >= 200 / 2.236936,
      'first-merge': p.interchanges >= 1,
      'orange-crush': has(['I-5', 'CA-22', 'CA-57']),
      'toll-roads': has(['CA-73', 'CA-133', 'CA-241', 'CA-261']),
      ten: has(ROUTES_ALL),
      survivor: p.bestStreak >= 60,
      needle: runNearMisses >= 10,
      'hundred-miles': p.distance >= 160934,
    };
    for (const a of ACHIEVEMENTS) if (test[a.id] && !p.achievements.includes(a.id)) { p.achievements.push(a.id); got.push(a.name); }
    return got;
  }

  rename(name: string) { this.p.username = name.trim().slice(0, 20) || 'Driver'; this.save(); }
  setAvatar(i: number) { this.p.avatar = Math.max(0, Math.min(AVATARS.length - 1, i)); this.save(); }
  endRun() { this.p.runs++; this.save(); }
  save() { this.dirty = 0; saveProfile(this.p); }
  reset() { this.p = fresh(); this.save(); }
}
