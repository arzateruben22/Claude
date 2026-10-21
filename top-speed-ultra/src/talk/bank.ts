// The talk bank: what people at Lot 57, the sports bar and on the radio say, built from moods, energies and the
// topics of the day. Lines are made, not stored: a template, a filler, a mood's flavour and an energy's delivery
// combine into well over 100,000 distinct openers and, paired with replies, over a million short conversations
// (tests/talk.mjs counts them). What is "live" in them comes from the now feed (src/live/now.ts): the weather,
// how the freeways are moving, the Coastal League (made up, see league.ts) and a hand-written list of trends.
// Nothing political by construction: there is no news feed, only those four sources.

import { leagueDay, clubName, score } from './league.ts';
import type { LeagueDay } from './league.ts';

export type Mood = 'cheerful' | 'tired' | 'hyped' | 'chill' | 'grumpy' | 'nervous' | 'nostalgic' | 'proud' | 'curious' | 'sarcastic' | 'hungry' | 'sweet';
export type Energy = 'low' | 'mid' | 'high';
export type Topic = 'weather' | 'traffic' | 'league' | 'food' | 'cars' | 'music' | 'freeway' | 'venue' | 'trends' | 'small';
export const MOODS: Mood[] = ['cheerful', 'tired', 'hyped', 'chill', 'grumpy', 'nervous', 'nostalgic', 'proud', 'curious', 'sarcastic', 'hungry', 'sweet'];
export const ENERGIES: Energy[] = ['low', 'mid', 'high'];
export const TOPICS: Topic[] = ['weather', 'traffic', 'league', 'food', 'cars', 'music', 'freeway', 'venue', 'trends', 'small'];

export interface TalkNow {
  weather: { kind: 'clear' | 'cloudy' | 'rain' | 'fog' | 'mist'; tempF: number | null; source: string };
  traffic: { roads: Record<string, { ratio: number }>; source: string };
  trends: string[];
  league?: LeagueDay;
  road?: string;                     // the freeway the player is on or came in from
  venue?: string;                    // where we are: 'Lot 57' or the sports bar's name
}
export interface Line { text: string; mood: Mood; energy: Energy; topic: Topic }
export type Rng = () => number;

// ------------------------------------------------------------------------------------------- the pieces
const WEATHER_WORDS: Record<TalkNow['weather']['kind'], string[]> = {
  clear: ['this sun', 'a sky like this', 'how clear it is', 'this weather', 'a day this nice'],
  cloudy: ['this marine layer', 'the gray', 'this overcast', 'the clouds hanging around', 'this gloom'],
  rain: ['this rain', 'the rain', 'how wet it is', 'this downpour', 'rain in OC, of all things'],
  fog: ['this fog', 'the fog', 'how thick it is out there', 'this soup', 'the fog on the 55'],
  mist: ['this mist', 'the haze', 'this damp', 'the drizzle', 'this wet air'],
};
const T: Record<Topic, string[]> = {
  weather: ['{m} {w}, right?', '{m} Did you see {w}?', '{m} {w} all week, I swear.', '{m} It\'s {t} out there.', '{m} Can\'t decide if I love or hate {w}.', '{m} {w} and {t}. Classic.'],
  traffic: ['{m} The {r} was {tr} coming in.', '{m} {tr} on the {r} again.', '{m} Took the {r}. {tr}.', '{m} Anyone else sit on the {r}? {tr}.', '{m} The {r} is {tr} tonight, I heard.'],
  league: ['{m} {g}', '{m} Did you catch the {c} game? {g}', '{m} {l} are still on top. {s}', '{m} {h} won {hn} straight.', '{m} {c} tonight. You watching?', '{m} {k}'],
  food: ['{m} The {f} here is {fa}.', '{m} Who ordered the {f}? {fa}.', '{m} I came for the {f}, honestly.', '{m} Get the {f}. {fa}.', '{m} {f} and a {d}. That\'s the night.'],
  cars: ['{m} Did you see the {ca} out front?', '{m} I\'d drive the {ca} every day if I could.', '{m} A {ca} just did {sp} on the {r}.', '{m} The {ca} sounds {cs}.', '{m} Still saving for the {ca}.'],
  music: ['{m} {st} is playing {mu} tonight.', '{m} Who picked {mu}?', '{m} Turn {st} up, that\'s {mu}.', '{m} I had {st} on the whole drive. {mu} all the way.'],
  freeway: ['{m} The {r} at {ti} is {fw}.', '{m} There\'s a stretch of the {r} that\'s {fw}.', '{m} Took the {r} to the {r2}. {fw}.', '{m} Nothing like the {r} at {ti}.'],
  venue: ['{m} {v} is {va} tonight.', '{m} First time at {v}? It\'s {va}.', '{m} {v} on a {dy}: {va}.', '{m} I love this spot. {va}.'],
  trends: ['{m} Everyone\'s on about {x}.', '{m} {x}, huh.', '{m} Still thinking about {x}.', '{m} Did you hear about {x}?', '{m} {x} is all anyone talks about.'],
  small: ['{m} Long day?', '{m} You been here before?', '{m} How\'s your week?', '{m} Is this seat taken?', '{m} What are you having?', '{m} Good crowd tonight.'],
};
// the mood's flavour: a lead-in that colours the line (the {m} slot), with its own vocabulary
const M: Record<Mood, string[]> = {
  cheerful: ['Ha!', 'Oh nice.', 'Love it.', 'Honestly, great.'],
  tired: ['Ugh.', 'Man.', 'Long day.', 'Barely awake, but.'],
  hyped: ['Yo!', 'Let\'s go!', 'Okay okay okay.', 'Dude.'],
  chill: ['Eh.', 'All good.', 'Easy.', 'No rush.'],
  grumpy: ['Great.', 'Of course.', 'Figures.', 'Don\'t get me started.'],
  nervous: ['Um.', 'So, uh.', 'Not sure, but.', 'Is it just me, or.'],
  nostalgic: ['Back in the day.', 'Remember when?', 'It used to be different.', 'Takes me back.'],
  proud: ['Told you.', 'Called it.', 'Not to brag.', 'See?'],
  curious: ['Wait.', 'Huh.', 'Question.', 'Okay so.'],
  sarcastic: ['Oh, wonderful.', 'Shocking.', 'Sure.', 'Love that for us.'],
  hungry: ['Okay but first, food.', 'I could eat.', 'Starving.', 'After we order.'],
  sweet: ['Aw.', 'Honestly?', 'Hey.', 'Glad you\'re here.'],
};
const FOOD = ['street tacos', 'wings', 'the smash burger', 'the fish tacos', 'the garlic fries', 'the carne asada fries', 'the elote', 'the nachos'];
const FOOD_ADJ = ['unreal', 'the move', 'better than last time', 'dangerous', 'worth the drive', 'the reason I\'m here'];
const DRINK = ['hazy IPA', 'lager', 'michelada', 'agua fresca', 'cold brew', 'lemonade'];
const CARS = ['Rossini GT', 'Rossini Brio', 'Rossini Corsa', 'Vela E', 'OC Hypercar'];
const CAR_SOUND = ['like a jet', 'angry', 'expensive', 'like the ocean', 'like my rent'];
const SPEEDS = ['a buck twenty', 'the limit, for once', 'about 90', 'triple digits'];
const STATIONS = ['KCST', 'KFWY', 'Canyon Radio'];
const MUSIC = ['synthwave', 'the lo-fi stuff', 'coast pads', 'the late set', 'that one loop'];
const TIMES = ['sunset', '2 a.m.', 'rush hour', 'sunrise', 'noon'];
const FREEWAY_ADJ = ['a dream', 'a parking lot', 'all elbows', 'pure gold', 'a different planet', 'the best road in the county'];
const VENUE_ADJ = ['packed', 'easy', 'lively', 'just right', 'quiet for once', 'loud in a good way'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ROADS = ['5', '405', '55', '57', '22', '91', '73', '133', '241', '261'];
const TRAFFIC_WORD = (ratio: number) => ratio >= 0.9 ? ['wide open', 'flowing', 'empty, somehow'] : ratio >= 0.7 ? ['moving', 'not bad', 'okay-ish'] : ratio >= 0.5 ? ['slow', 'stop and go', 'crawling'] : ['a parking lot', 'jammed', 'brutal'];
const ENERGY_FIX: Record<Energy, (s: string) => string> = {
  low: (s) => s.replace(/!/g, '.').replace(/\.\.$/, '.'),
  mid: (s) => s,
  high: (s) => s.replace(/\.$/, '!').replace(/\?$/, '?!'),
};

// ------------------------------------------------------------------------------------------- filling
const pick = <X>(rng: Rng, a: X[]) => a[Math.floor(rng() * a.length) % a.length];
const roadOf = (now: TalkNow, rng: Rng) => (now.road || '').replace(/^(I-|CA-)/, '').split(' ')[0] || pick(rng, ROADS);
const trafficWord = (now: TalkNow, road: string, rng: Rng) => {
  const entry = Object.entries(now.traffic.roads).find(([k]) => k.replace(/^(I-|CA-)/, '').startsWith(road + ' '));
  return pick(rng, TRAFFIC_WORD(entry ? entry[1].ratio : 0.8));
};
function fill(tpl: string, mood: Mood, now: TalkNow, rng: Rng): string {
  const lg = now.league ?? leagueDay();
  const yesterday = lg.yesterday.length ? pick(rng, lg.yesterday) : null;
  const tonight = lg.tonight.length ? pick(rng, lg.tonight) : null;
  const road = roadOf(now, rng);
  const t = now.weather.tempF == null ? 'mild' : now.weather.tempF >= 85 ? 'hot' : now.weather.tempF >= 72 ? 'warm' : now.weather.tempF >= 60 ? 'mild' : 'chilly';
  const x = now.trends.length ? pick(rng, now.trends) : 'the game night traffic';
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    switch (k) {
      case 'm': return pick(rng, M[mood]);
      case 'w': return pick(rng, WEATHER_WORDS[now.weather.kind]);
      case 't': return t;
      case 'r': return road; case 'r2': return pick(rng, ROADS.filter((r) => r !== road));
      case 'tr': return trafficWord(now, road, rng);
      case 'g': return yesterday ? score(yesterday) + '.' : lg.phase.kind === 'playoffs' ? 'Playoffs. Every game counts now.' : `Opening day in ${lg.daysToOpening} days.`;
      case 'c': return tonight ? clubName(tonight[0]) : yesterday ? clubName(yesterday.home) : clubName(lg.leader.club);
      case 'l': return `The ${clubName(lg.leader.club)}`; case 's': return `${lg.leader.w} and ${lg.leader.l}.`;
      case 'h': return `The ${clubName(lg.hottest.club)}`; case 'hn': return String(Math.max(1, lg.hottest.streak));
      case 'k': return lg.coldest.streak <= -3 ? `The ${clubName(lg.coldest.club)} have lost ${-lg.coldest.streak} in a row. Rough.` : `The ${clubName(lg.coldest.club)} need a win.`;
      case 'f': return pick(rng, FOOD); case 'fa': return pick(rng, FOOD_ADJ); case 'd': return pick(rng, DRINK);
      case 'ca': return pick(rng, CARS); case 'cs': return pick(rng, CAR_SOUND); case 'sp': return pick(rng, SPEEDS);
      case 'st': return pick(rng, STATIONS); case 'mu': return pick(rng, MUSIC);
      case 'ti': return pick(rng, TIMES); case 'fw': return pick(rng, FREEWAY_ADJ);
      case 'v': return now.venue || 'this place'; case 'va': return pick(rng, VENUE_ADJ); case 'dy': return pick(rng, DAYS);
      case 'x': return x;
      default: return k;
    }
  });
}
// tidy spacing, start every sentence with a capital (fillers are lower case), then the energy's delivery
const polish = (s: string, energy: Energy) => ENERGY_FIX[energy](s.replace(/\s+/g, ' ').trim().replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase()));

// one opener: a topic (weighted toward what is live), a template, filled for the mood and delivered at the energy
export function opener(rng: Rng, mood: Mood, energy: Energy, now: TalkNow, topic?: Topic): Line {
  const tp = topic ?? pick(rng, TOPICS);
  const text = polish(fill(pick(rng, T[tp]), mood, now, rng), energy);
  return { text, mood, energy, topic: tp };
}
// replies, by topic, coloured by the replier's mood
const R: Record<Topic, string[]> = {
  weather: ['{m} Give it till noon.', '{m} I\'ll take it over the heat.', '{m} The coast is worse.', '{m} Perfect driving weather, though.'],
  traffic: ['{m} Always is.', '{m} Should\'ve taken the toll road.', '{m} That\'s why I leave early.', '{m} It cleared up after Katella.'],
  league: ['{m} They won\'t keep it up.', '{m} I had money on the other guys. Fake money.', '{m} Watch them blow it in the playoffs.', '{m} Finally some good news.'],
  food: ['{m} Order two.', '{m} Last time I waited forty minutes for those.', '{m} Split it?', '{m} Get the salsa too.'],
  cars: ['{m} Someday.', '{m} Rent, then car.', '{m} I saw it on the 55 last week.', '{m} Loud is the point.'],
  music: ['{m} Better than talk radio.', '{m} That loop again.', '{m} Leave it.', '{m} Change it after this one.'],
  freeway: ['{m} Every time.', '{m} Worth it for the view.', '{m} Try it at sunrise.', '{m} The 241 is better and you know it.'],
  venue: ['{m} Beats staying in.', '{m} Wait till Friday.', '{m} The patio is where it\'s at.', '{m} We should come more.'],
  trends: ['{m} Can\'t escape it.', '{m} I\'m over it already.', '{m} Wait, what happened?', '{m} Everyone says that.'],
  small: ['{m} Yeah, long one.', '{m} First time, actually.', '{m} Go ahead, sit.', '{m} Same as always.'],
};
export function reply(rng: Rng, mood: Mood, energy: Energy, topic: Topic, now: TalkNow): Line {
  return { text: polish(fill(pick(rng, R[topic]), mood, now, rng), energy), mood, energy, topic };
}
export function exchange(rng: Rng, a: { mood: Mood; energy: Energy }, b: { mood: Mood; energy: Energy }, now: TalkNow, topic?: Topic): [Line, Line] {
  const o = opener(rng, a.mood, a.energy, now, topic);
  return [o, reply(rng, b.mood, b.energy, o.topic, now)];
}
// a DJ's line for the radio: upbeat, about what is live right now
export function djLine(rng: Rng, now: TalkNow, station: string): string {
  const tp = pick(rng, (['weather', 'traffic', 'league', 'trends'] as Topic[]));
  const o = opener(rng, pick(rng, ['cheerful', 'hyped', 'chill']), 'mid', now, tp);
  return `${station}: ${o.text.replace(/^(Ha!|Oh nice\.|Love it\.|Honestly, great\.|Yo!|Let's go!|Okay okay okay\.|Dude\.|Eh\.|All good\.|Easy\.|No rush\.)\s*/, '')}`;
}

// for the count: every distinct opener and reply for one fixed "now", by walking every choice
export function enumerateAll(now: TalkNow): { openers: Map<Topic, Set<string>>; replies: Map<Topic, Set<string>> } {
  const openers = new Map<Topic, Set<string>>(), replies = new Map<Topic, Set<string>>();
  for (const topic of TOPICS) {
    openers.set(topic, new Set()); replies.set(topic, new Set());
    for (const mood of MOODS) for (const energy of ENERGIES) {
      for (const tpl of T[topic]) walk(tpl, mood, energy, now, (s) => openers.get(topic)!.add(s));
      for (const tpl of R[topic]) walk(tpl, mood, energy, now, (s) => replies.get(topic)!.add(s));
    }
  }
  return { openers, replies };
}
function walk(tpl: string, mood: Mood, energy: Energy, now: TalkNow, emit: (s: string) => void) {
  // a mixed-radix counter over every list the filler picks from: fillCount records each pick's list length as it
  // goes, and the counter walks every combination (a later pick's list may depend on an earlier pick, so the
  // tail is rediscovered after each carry)
  const digits: number[] = [], ranges: number[] = [];
  for (let guard = 0; guard < 1000000; guard++) {
    emit(polish(fillCount(tpl, mood, now, digits, ranges), energy));
    let p = digits.length - 1;
    while (p >= 0) { digits[p]++; if (digits[p] < ranges[p]) break; digits[p] = 0; p--; }
    if (p < 0) return;
    digits.length = p + 1; ranges.length = p + 1;
  }
}
// the same filler, driven by a digit vector that records each list's length
function fillCount(tpl: string, mood: Mood, now: TalkNow, digits: number[], ranges: number[]): string {
  let i = 0;
  const take = <X>(a: X[]): X => { if (i >= digits.length) { digits.push(0); ranges.push(a.length); } else ranges[i] = a.length; const v = a[digits[i] % a.length]; i++; return v; };
  const lg = now.league ?? leagueDay();
  const road = (now.road || '').replace(/^(I-|CA-)/, '').split(' ')[0] || take(ROADS);
  const t = now.weather.tempF == null ? 'mild' : now.weather.tempF >= 85 ? 'hot' : now.weather.tempF >= 72 ? 'warm' : now.weather.tempF >= 60 ? 'mild' : 'chilly';
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    switch (k) {
      case 'm': return take(M[mood]);
      case 'w': return take(WEATHER_WORDS[now.weather.kind]);
      case 't': return t;
      case 'r': return road; case 'r2': return take(ROADS.filter((r) => r !== road));
      case 'tr': { const e = Object.entries(now.traffic.roads).find(([kk]) => kk.replace(/^(I-|CA-)/, '').startsWith(road + ' ')); return take(TRAFFIC_WORD(e ? e[1].ratio : 0.8)); }
      case 'g': return lg.yesterday.length ? score(take(lg.yesterday)) + '.' : lg.phase.kind === 'playoffs' ? 'Playoffs. Every game counts now.' : `Opening day in ${lg.daysToOpening} days.`;
      case 'c': return lg.tonight.length ? clubName(take(lg.tonight)[0]) : lg.yesterday.length ? clubName(take(lg.yesterday).home) : clubName(lg.leader.club);
      case 'l': return `The ${clubName(lg.leader.club)}`; case 's': return `${lg.leader.w} and ${lg.leader.l}.`;
      case 'h': return `The ${clubName(lg.hottest.club)}`; case 'hn': return String(Math.max(1, lg.hottest.streak));
      case 'k': return lg.coldest.streak <= -3 ? `The ${clubName(lg.coldest.club)} have lost ${-lg.coldest.streak} in a row. Rough.` : `The ${clubName(lg.coldest.club)} need a win.`;
      case 'f': return take(FOOD); case 'fa': return take(FOOD_ADJ); case 'd': return take(DRINK);
      case 'ca': return take(CARS); case 'cs': return take(CAR_SOUND); case 'sp': return take(SPEEDS);
      case 'st': return take(STATIONS); case 'mu': return take(MUSIC);
      case 'ti': return take(TIMES); case 'fw': return take(FREEWAY_ADJ);
      case 'v': return now.venue || 'this place'; case 'va': return take(VENUE_ADJ); case 'dy': return take(DAYS);
      case 'x': return now.trends.length ? take(now.trends) : 'the game night traffic';
      default: return k;
    }
  });
}
