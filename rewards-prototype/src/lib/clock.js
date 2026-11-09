// Time is always injected so tests are deterministic. Stored timestamps are ISO-8601 UTC.

export const systemClock = { now: () => new Date() };

/** A controllable clock for tests: fixedClock('2026-11-09T12:00:00Z'). */
export function fixedClock(iso) {
  let current = new Date(iso);
  if (Number.isNaN(current.getTime())) throw new TypeError(`invalid date: ${iso}`);
  return {
    now: () => new Date(current),
    set: (next) => {
      current = new Date(next);
    },
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

export const iso = (date) => date.toISOString();

const formatters = new Map();
function partsIn(timeZone, date) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    // Throws RangeError for an unknown zone, which is what we want at validation time.
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, fmt);
  }
  const out = {};
  for (const part of fmt.formatToParts(date)) out[part.type] = part.value;
  return out;
}

export function isValidTimeZone(timeZone) {
  try {
    partsIn(timeZone, new Date(0));
    return typeof timeZone === 'string' && timeZone.length > 0;
  } catch {
    return false;
  }
}

/** Calendar month a moment falls in, in the given IANA zone: '2026-11'. */
export function periodOf(date, timeZone) {
  const p = partsIn(timeZone, date);
  return `${p.year}-${p.month}`;
}

/** Calendar day a moment falls in, in the given IANA zone: '2026-11-09'. */
export function localDateOf(date, timeZone) {
  const p = partsIn(timeZone, date);
  return `${p.year}-${p.month}-${p.day}`;
}
