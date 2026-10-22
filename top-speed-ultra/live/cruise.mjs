// Cruise nights: meetup times the owner sets (CRUISE="Fri 20:00, Sun 18:00", Pacific time), so players know when
// the lobby will be busy. The menu shows the next one. Nothing is promised beyond the time itself.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TZ = 'America/Los_Angeles';

// "Fri 20:00, Sun 18:00" -> [{ day: 5, h: 20, m: 0 }, ...]; bad entries are skipped
export function parseCruise(spec) {
  const out = [];
  for (const part of String(spec || '').split(',')) {
    const m = /^\s*(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*\s+(\d{1,2}):(\d{2})\s*$/i.exec(part);
    if (!m) continue;
    const day = DAYS.findIndex((d) => d.toLowerCase() === m[1].slice(0, 3).toLowerCase()), h = Number(m[2]), mi = Number(m[3]);
    if (h < 24 && mi < 60) out.push({ day, h, m: mi });
  }
  return out;
}
// the Pacific wall-clock parts of an instant
function pacific(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(date).map((x) => [x.type, x.value]));
  return { day: DAYS.indexOf(p.weekday), h: Number(p.hour) % 24, m: Number(p.minute) };
}
// the next cruise at or after `now` (a cruise counts as on for 2 hours after it starts): { at: ISO, live: bool }
export function nextCruise(spec, now = new Date()) {
  const list = parseCruise(spec);
  if (!list.length) return null;
  const here = pacific(now), nowMin = here.day * 1440 + here.h * 60 + here.m;
  let best = null;
  for (const c of list) {
    const start = c.day * 1440 + c.h * 60 + c.m;
    let ahead = (start - nowMin + 7 * 1440) % (7 * 1440);
    const live = (nowMin - start + 7 * 1440) % (7 * 1440) < 120;
    if (live) ahead = -((nowMin - start + 7 * 1440) % (7 * 1440));
    if (!best || ahead < best.ahead) best = { ahead, live };
  }
  const at = new Date(Math.floor(now.getTime() / 60000) * 60000 + best.ahead * 60000);
  return { at: at.toISOString(), live: best.live };
}
