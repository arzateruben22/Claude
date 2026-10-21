// Characters and story (owner 2026-10-21, the life half): people in OC who text you on the in-game phone. Their
// threads open as you level up, buy homes and win races; some messages carry a job built from what the game already
// has (a Survival score, Time Trial miles, a race placing, miles on one freeway, a top speed). A job pays credits and
// XP when a run meets it. Everyone here is fictional, ours, and written for the game's 13+ audience: no romance, no
// real people, businesses or brands. Nothing is sent anywhere; it all lives in the profile on this device.
import type { Profile } from './profile';

export interface Character { id: string; name: string; role: string; where: string; colour: string }
export const CHARACTERS: Character[] = [
  { id: 'mara', name: 'Mara Ortiz', role: 'Runs the tyre shop under the Orangewood studio', where: 'Anaheim', colour: '#e8701a' },
  { id: 'jun', name: 'Jun Park', role: 'Aero engineer; tunes cars on weekends', where: 'Irvine', colour: '#3fa7d6' },
  { id: 'sal', name: 'Sal Reyes', role: 'Thirty years a courier; knows every exit in the county', where: 'Santa Ana', colour: '#d8b04a' },
  { id: 'dee', name: 'Dee Okafor', role: 'Organises the Saturday car meet in the hills', where: 'Laguna Hills', colour: '#9b6bd6' },
  { id: 'nina', name: 'Nina Hale', role: 'Test driver for Vela, the electric carmaker', where: 'Tustin', colour: '#5fd6a8' },
];
export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id);

export type Job =
  | { kind: 'survival'; score: number }
  | { kind: 'time'; miles: number }
  | { kind: 'race'; course: string; place: number }
  | { kind: 'drive'; road: string; miles: number }          // Free Drive, ending on that freeway, this far in the run
  | { kind: 'top'; mph: number };                             // any mode
// when a message shows: every condition listed must hold (and the message before it in the thread must be done or read)
export interface Unlock { level?: number; homes?: number; racesWon?: number; after?: string }
export interface Message { id: string; from: string; text: string; unlock?: Unlock; job?: Job; credits?: number; xp?: number; done?: string }

// the threads, in order within each character; `after` chains across characters
export const MESSAGES: Message[] = [
  { id: 'mara-1', from: 'mara', text: 'Hey, I saw the GT come in last night. Welcome to the block. If you ever want new rubber, I\'m downstairs. First, show me it can stretch its legs: 40 miles an hour is for the neighbours, I want to see 120.',
    job: { kind: 'top', mph: 120 }, credits: 600, xp: 150, done: 'Okay, okay. I heard that from the shop. Come by any time.' },
  { id: 'mara-2', from: 'mara', unlock: { after: 'mara-1' }, text: 'Regulars of mine swear they can hold over a hundred through traffic for a full minute. Prove them wrong. Survival, 5,000 points.',
    job: { kind: 'survival', score: 5000 }, credits: 1200, xp: 300, done: 'Five grand. They owe me lunch now.' },
  { id: 'sal-1', from: 'sal', unlock: { level: 2 }, text: 'Mara gave me your number. Old courier here. Lesson one: the 57 north of the Orangewood exit is the quiet way to Brea. Drive it, five miles, and tell me what you see.',
    job: { kind: 'drive', road: 'CA-57 North', miles: 5 }, credits: 800, xp: 250, done: 'See? Quiet. Remember it for when the 5 is a parking lot.' },
  { id: 'sal-2', from: 'sal', unlock: { after: 'sal-1', level: 3 }, text: 'Lesson two: the 241 is the toll road nobody uses at night. Here, nobody pays: the game charges no tolls. Ten miles on the 241 South.',
    job: { kind: 'drive', road: 'CA-241 South', miles: 10 }, credits: 1500, xp: 400, done: 'Ten miles of hills and nobody. That\'s the county\'s best-kept road.' },
  { id: 'jun-1', from: 'jun', unlock: { level: 3 }, text: 'Jun here, from Irvine. Mara says you\'re quick. Quick isn\'t clean. The Irvine Sprint on the 405: finish in the top two and I\'ll take a look at your car.',
    job: { kind: 'race', course: 'irvine', place: 2 }, credits: 2000, xp: 500, done: 'Clean lines. I\'m in. Bring it by when you want it tuned.' },
  { id: 'jun-2', from: 'jun', unlock: { after: 'jun-1', level: 5 }, text: 'Data day. Time Trial, 12 miles before the clock runs out. Every checkpoint you make buys time; every lift costs it.',
    job: { kind: 'time', miles: 12 }, credits: 3000, xp: 700, done: 'Twelve. Your throttle trace looks like a ruler. Good.' },
  { id: 'dee-1', from: 'dee', unlock: { homes: 1 }, text: 'Heard you got a place. Congrats! Saturday nights we meet up in the hills. No street racing, just cars and coffee. Win the Foothill Sprint and you\'re on the poster.',
    job: { kind: 'race', course: 'foothill', place: 1 }, credits: 3500, xp: 800, done: 'Poster\'s printing. Everyone wants to see the car now.' },
  { id: 'sal-3', from: 'sal', unlock: { after: 'sal-2', level: 6 }, text: 'Last lesson. Santa Ana Checkpoints, the 5 north through the middle of everything. Top three. That\'s a courier\'s commute.',
    job: { kind: 'race', course: 'santa-ana', place: 3 }, credits: 4000, xp: 900, done: 'You drive like I used to. Better, honestly. Don\'t tell anyone I said that.' },
  { id: 'nina-1', from: 'nina', unlock: { level: 8 }, text: 'Nina Hale, test driver at Vela. Jun sent me your traces. We\'re looking at drivers for the E. Show me endurance: the Riverside run on the 91, podium finish.',
    job: { kind: 'race', course: 'riverside', place: 3 }, credits: 6000, xp: 1200, done: 'That was 30 kilometres without a lift. The E\'s in the showroom whenever you\'re ready.' },
  { id: 'jun-3', from: 'jun', unlock: { after: 'jun-2', level: 10 }, text: 'New aero package idea. I need someone to see 200. Any car, any road, just don\'t hit anything.',
    job: { kind: 'top', mph: 200 }, credits: 8000, xp: 1500, done: '200! The numbers check out. You just made my whole month.' },
  { id: 'dee-2', from: 'dee', unlock: { after: 'dee-1', racesWon: 5 }, text: 'Five wins and counting. The meet wants a demo: Survival, 25,000. Clean passes only, people are watching.',
    job: { kind: 'survival', score: 25000 }, credits: 10000, xp: 2000, done: 'They\'re still talking about it. You\'re a regular now.' },
  { id: 'mara-3', from: 'mara', unlock: { after: 'mara-2', homes: 3 }, text: 'Three homes? Look at you. Don\'t forget where you started: the studio\'s still yours, and my door\'s still open.' },
];

// the story's state is on the profile (Profile.story): jobs done, and messages read
export type StoryState = Profile['story'];
const storyOf = (p: Profile): StoryState => p.story;

function unlocked(m: Message, p: Profile, level: number, st: StoryState) {
  const u = m.unlock ?? {};
  if (u.level && level < u.level) return false;
  if (u.homes && p.homes.length < u.homes) return false;
  if (u.racesWon && p.racesWon < u.racesWon) return false;
  if (u.after) { const prev = MESSAGES.find((x) => x.id === u.after); if (prev && (prev.job ? !st.done.includes(prev.id) : !st.read.includes(prev.id))) return false; }
  return true;
}
// the messages you have, newest last
export function inbox(p: Profile, level: number) { const st = storyOf(p); return MESSAGES.filter((m) => unlocked(m, p, level, st)); }
export function unread(p: Profile, level: number) { const st = storyOf(p); return inbox(p, level).filter((m) => !st.read.includes(m.id)).length; }
// the people you've heard from
export function contacts(p: Profile, level: number) { const from = new Set(inbox(p, level).map((m) => m.from)); return CHARACTERS.filter((c) => from.has(c.id)); }

export function jobText(j: Job) {
  switch (j.kind) {
    case 'survival': return `Survival: score ${j.score.toLocaleString()}`;
    case 'time': return `Time Trial: ${j.miles} miles`;
    case 'race': return `Race: ${j.place === 1 ? 'win' : `top ${j.place}`}`;
    case 'drive': return `Free Drive: ${j.miles} miles on the ${j.road}`;
    case 'top': return `Reach ${j.mph} mph`;
  }
}

// what a finished run settles: every open job in the inbox that it meets is done and paid. Returns the messages paid.
export interface RunFacts { mode: string; score: number; distance: number; top: number; road: string; courseId?: string; position?: number }
const MPH = 2.236936, MI = 1609.344;
export function meets(j: Job, r: RunFacts) {
  switch (j.kind) {
    case 'survival': return r.mode === 'survival' && r.score >= j.score;
    case 'time': return r.mode === 'time' && r.distance / MI >= j.miles;
    case 'race': return r.mode === 'race' && r.courseId === j.course && !!r.position && r.position <= j.place;
    case 'drive': return r.mode === 'free' && r.road === j.road && r.distance / MI >= j.miles;
    case 'top': return r.top * MPH >= j.mph;
  }
}
export function settle(p: Profile, level: number, r: RunFacts): Message[] {
  const st = storyOf(p), paid: Message[] = [];
  for (const m of inbox(p, level)) if (m.job && !st.done.includes(m.id) && meets(m.job, r)) { st.done.push(m.id); paid.push(m); }
  return paid;
}
