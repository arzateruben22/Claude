// The story's logic without a browser (node --experimental-strip-types tests/story.mjs): which messages open when,
// the weekly events by the device's day and hour, and that a job is paid once (an event once a week).
import { inbox, unread, settle, MESSAGES, EVENTS, meets } from '../src/game/story.ts';

let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${msg}`); if (!c) fails++; };
const profile = (o = {}) => ({ homes: [], racesWon: 0, story: { done: [], read: [] }, ...o });
const sat9 = new Date(2026, 9, 24, 9, 0), sat12 = new Date(2026, 9, 24, 12, 0), fri20 = new Date(2026, 9, 23, 20, 30), sun9 = new Date(2026, 9, 25, 9, 0), nextSat9 = new Date(2026, 9, 31, 9, 0);
const tue = new Date(2026, 9, 20, 15, 0);

// a fresh driver at level 1 on a Tuesday afternoon: only Mara's first message
const p0 = profile();
ok(inbox(p0, 1, tue).map((m) => m.id).join() === 'mara-1', `fresh, level 1: ${inbox(p0, 1, tue).map((m) => m.id).join()}`);
ok(unread(p0, 1) >= 1, 'it is unread');
// chains: Mara's second needs her first done; Sal opens at level 2; Dee needs a home
const p1 = profile({ story: { done: ['mara-1'], read: ['mara-1'] } });
const ids1 = inbox(p1, 2, tue).map((m) => m.id);
ok(ids1.includes('mara-2') && ids1.includes('sal-1') && !ids1.includes('dee-1'), `after mara-1 at level 2: ${ids1.join()}`);
ok(inbox(profile({ homes: ['orangewood'] }), 1, tue).some((m) => m.id === 'dee-1'), 'a home opens Dee\'s thread');
// every job's message has credits, every errand a key, and every chain points at a real message
ok(MESSAGES.every((m) => !m.job || (m.credits ?? 0) > 0), 'every job pays');
ok(MESSAGES.every((m) => !m.unlock?.after || MESSAGES.some((x) => x.id === m.unlock.after)), 'every chain points at a real message');
const keys = [...MESSAGES, ...EVENTS].map((m) => m.job).filter((j) => j?.kind === 'errand').map((j) => j.key);
ok(new Set(keys).size === keys.length, `errand keys unique (${keys.length})`);

// events by day and hour (local time)
const ev = (d, lvl = 5) => inbox(profile(), lvl, d).filter((m) => m.id.includes('@')).map((m) => m.id.split('@')[0]);
ok(ev(sat9).join() === 'cars-coffee', `Saturday 9:00: ${ev(sat9).join()}`);
ok(ev(sat12).length === 0, `Saturday 12:00: ${ev(sat12).join() || 'none'}`);
ok(ev(fri20).join() === 'friday-meet', `Friday 20:30: ${ev(fri20).join()}`);
ok(ev(sun9).join() === 'sunday-run', `Sunday 9:00: ${ev(sun9).join()}`);
ok(ev(sat9, 1).length === 0, 'Cars & Coffee waits for level 2');

// paid once: a run that meets an event's errand pays it this week, not again this week, and again next week
const p2 = profile();
const run = { mode: 'free', score: 0, distance: 15000, top: 30, road: 'CA-73 South', errands: ['meet-cars-coffee'] };
const a = settle(p2, 5, run, sat9).map((m) => m.id.split('@')[0]);
const b = settle(p2, 5, run, sat9).length;
const c = settle(p2, 5, run, nextSat9).map((m) => m.id.split('@')[0]);
ok(a.join() === 'cars-coffee' && b === 0 && c.join() === 'cars-coffee', `Cars & Coffee paid: this week ${a.join()}, again ${b}, next week ${c.join()}`);
// meets: the race needs the course and the place
ok(meets({ kind: 'race', course: 'irvine', place: 2 }, { mode: 'race', courseId: 'irvine', position: 2 }) && !meets({ kind: 'race', course: 'irvine', place: 2 }, { mode: 'race', courseId: 'irvine', position: 3 }), 'a race job needs the course and the place');

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
