/**
 * SoCal Timesheet — rules engine.
 *
 * Pure ES module: no DOM, no storage, no Date.now(). The only Date usage is
 * deriving the day-of-week / next calendar date from the input date string
 * (done in UTC so the result is identical in every time zone).
 *
 * Contract: ../timesheet/SPEC.md §"rules.js — public API" and §"Rule semantics".
 * Rule authority: ../RULEBOOK.md (labor codes, overnight splits, lunch rules).
 *
 * All arithmetic is in integer minutes. Hours are minutes/60 rounded to 2 dp.
 */

export const FLAG_CODES = Object.freeze({
  LUNCH1_MISSING: 'LUNCH1_MISSING',
  LUNCH1_LATE: 'LUNCH1_LATE',
  LUNCH2_MISSING: 'LUNCH2_MISSING',
  LUNCH2_LATE: 'LUNCH2_LATE',
  LUNCH2_WAIVABLE: 'LUNCH2_WAIVABLE',
  REST_BREAK_ADVISORY: 'REST_BREAK_ADVISORY',
  SAT_RULING_2X: 'SAT_RULING_2X',
  HOLIDAY_RULING: 'HOLIDAY_RULING',
  OVERNIGHT_RULING: 'OVERNIGHT_RULING',
  OVERLAP: 'OVERLAP',
  BAD_BLOCK: 'BAD_BLOCK',
  GAP: 'GAP',
  LONG_SHIFT: 'LONG_SHIFT',
  NO_BLOCKS: 'NO_BLOCKS',
  ODO_NEGATIVE: 'ODO_NEGATIVE',
  MILES_MISMATCH: 'MILES_MISMATCH',
  EA_FORMAT: 'EA_FORMAT',
});

// ---------------------------------------------------------------------------
// Constants (minutes)
// ---------------------------------------------------------------------------

const DAY = 1440;
const WINDOW_START = 6 * 60;   // 06:00 — PW window opens (inclusive)
const WINDOW_END = 17 * 60;    // 17:00 — PW window closes (exclusive)
const REGULAR_CAP = 480;       // accrued minutes 1..480   → Regular
const OT_CAP = 720;            // accrued minutes 481..720 → 1.5 OT; 721+ → 2.0 DT
const LUNCH1_LIMIT = 299;      // 1st lunch must BEGIN at elapsed <= 4:59
const LUNCH2_LIMIT = 599;      // 2nd lunch must BEGIN at elapsed <= 9:59
const LUNCH2_REQUIRED_OVER = 720;  // worked > 12:00 → 2nd lunch required
const LUNCH2_WAIVABLE_OVER = 600;  // worked in (10:00, 12:00] → waivable info
const REST_SPAN_MAX = 240;     // continuous paid span > 4:00 → advisory
const LONG_SHIFT_MAX = 1200;   // elapsed > 20:00 → likely entry error
const SAT_RULING_OVER = 240;   // Saturday paid > 4:00 → open 2.0 question

const TIER_NAMES = ['Regular', '1.5 OT', '2.0 DT']; // index = tier rank
const CATEGORIES = new Set(['work', 'travel', 'lunch', 'break']);
const PAID = new Set(['work', 'travel', 'break']);
const SEVERITY_RANK = { error: 0, warn: 1, ruling: 2, info: 3 };
const TIMELINE_CODES = new Set([
  FLAG_CODES.OVERLAP, FLAG_CODES.BAD_BLOCK, FLAG_CODES.LONG_SHIFT, FLAG_CODES.NO_BLOCKS,
]);
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SAT = 6;
const SUN = 0;

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** "h:mm" for durations / elapsed values (e.g. 299 → "4:59"). */
function fmtHM(minutes) {
  const m = Math.max(0, Math.floor(minutes));
  return `${Math.floor(m / 60)}:${pad2(m % 60)}`;
}

/** "HH:MM" clock for an absolute minute; "+1" marks the day after input.date. */
function fmtClock(abs) {
  if (abs === DAY) return '24:00';
  const clock = ((abs % DAY) + DAY) % DAY;
  const text = `${pad2(Math.floor(clock / 60))}:${pad2(clock % 60)}`;
  return abs > DAY ? `${text} (+1)` : text;
}

/** minutes → hours rounded to 2 decimals (480 → 8, 90 → 1.5, 1 → 0.02). */
function toHours(minutes) {
  return Math.round((minutes * 100) / 60) / 100;
}

/**
 * Parse "HH:MM" (also "H:MM") into minutes since 00:00. Returns null when the
 * string is not a valid clock time. "24:00" is accepted only as a stop time
 * (a block ending exactly at midnight).
 */
function parseTime(value, allowMidnightStop) {
  if (typeof value !== 'string') return null;
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (mm > 59) return null;
  if (h === 24 && mm === 0 && allowMidnightStop) return DAY;
  if (h > 23) return null;
  return h * 60 + mm;
}

/** Parse "YYYY-MM-DD" → {dow, utc} or null (invalid / impossible date). */
function parseDate(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utc = Date.UTC(y, mo - 1, d);
  const dt = new Date(utc);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { text: `${y}-${pad2(mo)}-${pad2(d)}`, dow: dt.getUTCDay(), utc };
}

function addDays(parsed, n) {
  const dt = new Date(parsed.utc + n * 86400000);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function flag(severity, code, message) {
  return { severity, code, message };
}

function sortFlags(flags) {
  return flags
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (SEVERITY_RANK[a.f.severity] - SEVERITY_RANK[b.f.severity]) || (a.i - b.i))
    .map((x) => x.f);
}

/** [reg, ot, dt] minute counters → [{code, minutes, hours}] (zero tiers omitted). */
function tierList(counters, family) {
  const out = [];
  for (let i = 0; i < TIER_NAMES.length; i++) {
    if (counters[i] > 0) {
      out.push({ code: `${family} ${TIER_NAMES[i]}`, minutes: counters[i], hours: toHours(counters[i]) });
    }
  }
  return out;
}

function normalizeJobRef(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizePrior(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

// ---------------------------------------------------------------------------
// evaluateShift
// ---------------------------------------------------------------------------

/**
 * Evaluate one shift. See SPEC.md for the full input/output contract.
 *
 * input = {
 *   date: "YYYY-MM-DD",                       // calendar date the shift STARTS
 *   blocks: [{category, start, stop, jobRef?, note?}],
 *   priorMinutes?: number,                    // paid minutes already worked that day
 *   options?: { holiday?: boolean, secondLunchWaived?: boolean },
 * }
 */
export function evaluateShift(input) {
  const inp = input && typeof input === 'object' ? input : {};
  const options = inp.options && typeof inp.options === 'object' ? inp.options : {};
  const dateParsed = parseDate(inp.date);
  const dateText = dateParsed ? dateParsed.text : (typeof inp.date === 'string' ? inp.date : '');
  const prior = normalizePrior(inp.priorMinutes);
  const rawBlocks = Array.isArray(inp.blocks) ? inp.blocks : [];
  const flags = [];

  // -- 1. Parse + place blocks on an absolute minute axis (0 = 00:00 of input.date)
  //
  // Day placement rule: the first valid block in input order anchors the shift
  // on day one. Any later block whose START clock is earlier than that anchor
  // start is placed on day two (it can only be reached by crossing midnight).
  // A block whose stop <= start crosses midnight itself. For every valid
  // (<= 20h) shift this is equivalent to the spec's "start earlier than the
  // previous block's stop clock → day two" rule, and it additionally lets a
  // same-day block entered out of order sort into place (or be reported as an
  // OVERLAP) instead of being thrown onto day two.
  const placed = [];
  let anchorStart = null;
  rawBlocks.forEach((raw, idx) => {
    const b = raw && typeof raw === 'object' ? raw : {};
    const category = String(b.category === undefined || b.category === null ? '' : b.category).trim().toLowerCase();
    const start = parseTime(b.start, false);
    const stop = parseTime(b.stop, true);
    const label = `Block ${idx + 1}${category ? ` (${category})` : ''}`;
    if (!CATEGORIES.has(category)) {
      flags.push(flag('error', FLAG_CODES.BAD_BLOCK, `${label}: unknown category "${b.category === undefined ? '' : b.category}" — use work, travel, lunch or break.`));
      return;
    }
    if (start === null || stop === null) {
      flags.push(flag('error', FLAG_CODES.BAD_BLOCK, `${label}: invalid time "${b.start === undefined ? '' : b.start}"–"${b.stop === undefined ? '' : b.stop}" — use 24h HH:MM.`));
      return;
    }
    let duration = stop - start;
    if (stop < start) duration += DAY; // crosses midnight
    if (duration <= 0) {
      flags.push(flag('error', FLAG_CODES.BAD_BLOCK, `${label}: zero-length block ${fmtClock(start)}–${fmtClock(stop)}.`));
      return;
    }
    if (anchorStart === null) anchorStart = start;
    const dayIndex = start < anchorStart ? 1 : 0;
    const absStart = dayIndex * DAY + start;
    placed.push({
      index: idx,
      category,
      jobRef: normalizeJobRef(b.jobRef),
      note: typeof b.note === 'string' ? b.note : '',
      absStart,
      absStop: absStart + duration,
      duration,
    });
  });

  if (rawBlocks.length === 0) {
    flags.push(flag('error', FLAG_CODES.NO_BLOCKS, 'No time blocks entered.'));
  }

  if (placed.length === 0) {
    return finish({
      flags, dateText, workedMinutes: 0, lunchMinutes: 0, breakMinutes: 0, elapsedMinutes: 0,
      family: 'PW', familyReason: 'No paid time entered.',
      tiers: [], byJob: [], split: null,
    });
  }

  // -- 2. Auto-sort by absolute start (stable on input order)
  placed.sort((a, b) => (a.absStart - b.absStart) || (a.index - b.index));

  // -- 3. Timeline validation: overlap / gap / long shift
  let latestStop = placed[0].absStop;
  let latestBlock = placed[0];
  for (let i = 1; i < placed.length; i++) {
    const cur = placed[i];
    if (cur.absStart < latestStop) {
      flags.push(flag('error', FLAG_CODES.OVERLAP,
        `Blocks overlap: ${latestBlock.category} ${fmtClock(latestBlock.absStart)}–${fmtClock(latestBlock.absStop)} and ${cur.category} ${fmtClock(cur.absStart)}–${fmtClock(cur.absStop)}.`));
    } else if (cur.absStart > latestStop) {
      const gap = cur.absStart - latestStop;
      flags.push(flag('warn', FLAG_CODES.GAP,
        `Off-clock gap of ${fmtHM(gap)} between ${fmtClock(latestStop)} and ${fmtClock(cur.absStart)} — gap time is not paid.`));
    }
    if (cur.absStop > latestStop) {
      latestStop = cur.absStop;
      latestBlock = cur;
    }
  }

  const shiftStart = placed[0].absStart;
  const shiftEnd = latestStop;
  const elapsedMinutes = shiftEnd - shiftStart;
  if (elapsedMinutes > LONG_SHIFT_MAX) {
    flags.push(flag('error', FLAG_CODES.LONG_SHIFT,
      `Elapsed span ${fmtHM(elapsedMinutes)} exceeds ${fmtHM(LONG_SHIFT_MAX)} — likely an entry error (check AM/PM and block order).`));
  }

  // -- 4. Totals
  let workedMinutes = 0;
  let lunchMinutes = 0;
  let breakMinutes = 0;
  for (const b of placed) {
    if (b.category === 'lunch') lunchMinutes += b.duration;
    else workedMinutes += b.duration;
    if (b.category === 'break') breakMinutes += b.duration;
  }

  // -- 5. Per-minute pass: family window counts, accrual ladder, day minimums,
  //       per-day split, per-job allocation. Every paid minute counted once.
  //       The ladder is the calendar day's clock, not the shift's (RULEBOOK
  //       §Labor codes: "any hours past 8 in a day"; the post-midnight hours
  //       are the next day's Shift Change row), so it restarts at 0 when the
  //       pass crosses midnight. priorMinutes = "already worked today" seeds
  //       day one only.
  const dow0 = dateParsed ? dateParsed.dow : null;
  let inside = 0;
  let outside = 0;
  let accrued = prior;
  let accrualDay = 0;
  let accruedCont = prior;        // alternative reading: one shift, one clock
  const altTotal = [0, 0, 0];     // tallies for the continuous reading
  let satPaid = 0;
  const total = [0, 0, 0];
  const dayOne = [0, 0, 0];
  const dayTwo = [0, 0, 0];
  // jobRef -> { total: [reg, ot, dt], days: [dayOne counters, dayTwo counters] }
  const jobMap = new Map();
  let hasDayTwo = false;

  for (const b of placed) {
    if (b.absStop > DAY) hasDayTwo = true; // any paid/lunch minute after midnight
    if (!PAID.has(b.category)) continue;
    let jobCounters = jobMap.get(b.jobRef);
    if (!jobCounters) {
      jobCounters = { total: [0, 0, 0], days: [[0, 0, 0], [0, 0, 0]] };
      jobMap.set(b.jobRef, jobCounters);
    }
    for (let m = b.absStart; m < b.absStop; m++) {
      const clock = m % DAY;
      const dayIndex = Math.floor(m / DAY);
      if (dayIndex !== accrualDay) { accrued = 0; accrualDay = dayIndex; } // new workday at midnight
      if (clock >= WINDOW_START && clock < WINDOW_END) inside++;
      else outside++;

      accrued++;
      accruedCont++;
      let tier = accrued <= REGULAR_CAP ? 0 : (accrued <= OT_CAP ? 1 : 2);
      let altTier = accruedCont <= REGULAR_CAP ? 0 : (accruedCont <= OT_CAP ? 1 : 2);
      if (dow0 !== null) {
        const dow = (dow0 + dayIndex) % 7;
        if (dow === SAT) {
          satPaid++;
          if (tier < 1) tier = 1;        // Saturday minimum 1.5 OT
          if (altTier < 1) altTier = 1;
        } else if (dow === SUN) {
          tier = 2;                      // Sunday minimum 2.0 DT
          altTier = 2;
        }
      }
      altTotal[altTier]++;
      total[tier]++;
      (dayIndex === 0 ? dayOne : dayTwo)[tier]++;
      jobCounters.total[tier]++;
      jobCounters.days[dayIndex === 0 ? 0 : 1][tier]++;
    }
  }

  // -- 6. Family
  let family;
  let familyReason;
  const startClock = shiftStart % DAY;
  const startInside = startClock >= WINDOW_START && startClock < WINDOW_END;
  if (inside > outside) {
    family = 'PW';
    familyReason = `PW: ${inside} paid min inside 06:00–17:00 vs ${outside} outside — majority inside the window.`;
  } else if (outside > inside) {
    family = 'PWSS';
    familyReason = `PWSS: ${outside} paid min outside 06:00–17:00 vs ${inside} inside — majority outside the window (special shift).`;
  } else {
    family = startInside ? 'PW' : 'PWSS';
    familyReason = `${family}: ${inside} paid min inside 06:00–17:00 vs ${outside} outside — exact tie, coded to the side where the shift started (${fmtClock(startClock)} is ${startInside ? 'inside' : 'outside'} the window).`;
  }

  // -- 7. Lunch compliance (elapsed clock time from the first block start)
  const lunches = placed.filter((b) => b.category === 'lunch');
  const lunch1At = lunches.length > 0 ? lunches[0].absStart - shiftStart : null;
  const lunch2At = lunches.length > 1 ? lunches[1].absStart - shiftStart : null;

  if (lunch1At === null) {
    if (elapsedMinutes > LUNCH1_LIMIT) {
      flags.push(flag('error', FLAG_CODES.LUNCH1_MISSING,
        `No lunch entered on a ${fmtHM(elapsedMinutes)} shift — the first lunch must begin by ${fmtHM(LUNCH1_LIMIT)} after the shift starts.`));
    }
  } else if (lunch1At > LUNCH1_LIMIT) {
    flags.push(flag('error', FLAG_CODES.LUNCH1_LATE,
      `First lunch began ${fmtHM(lunch1At)} into the shift; it must begin by ${fmtHM(LUNCH1_LIMIT)}.`));
  }

  if (workedMinutes > LUNCH2_REQUIRED_OVER) {
    if (lunch2At === null) {
      flags.push(flag('error', FLAG_CODES.LUNCH2_MISSING,
        `Worked ${fmtHM(workedMinutes)} (over 12:00) — a second lunch is required and must begin by ${fmtHM(LUNCH2_LIMIT)}; none entered.`));
    } else if (lunch2At > LUNCH2_LIMIT) {
      flags.push(flag('error', FLAG_CODES.LUNCH2_LATE,
        `Second lunch began ${fmtHM(lunch2At)} into the shift; with over 12:00 worked it must begin by ${fmtHM(LUNCH2_LIMIT)}.`));
    }
  } else if (workedMinutes > LUNCH2_WAIVABLE_OVER && lunch2At === null) {
    flags.push(flag('info', FLAG_CODES.LUNCH2_WAIVABLE,
      `Worked ${fmtHM(workedMinutes)} with no second lunch — second lunch waivable under 12 hrs (${options.secondLunchWaived ? 'waiver recorded' : 'no waiver recorded'}).`));
  }

  // -- 8. Rest-break advisory: longest continuous paid span with no break/lunch
  //       (a gap, a lunch or a break block ends the span).
  let span = 0;
  let longestSpan = 0;
  let prevStop = null;
  for (const b of placed) {
    if (b.category === 'work' || b.category === 'travel') {
      span = (prevStop !== null && b.absStart === prevStop) ? span + b.duration : b.duration;
    } else {
      span = 0;
    }
    if (span > longestSpan) longestSpan = span;
    prevStop = b.absStop;
  }
  if (longestSpan > REST_SPAN_MAX) {
    flags.push(flag('warn', FLAG_CODES.REST_BREAK_ADVISORY,
      `Continuous paid span of ${fmtHM(longestSpan)} without a break or lunch (CA: 10-min paid rest per 4 hrs) — advisory pending company policy ruling.`));
  }

  // -- 9. Open rulings
  if (satPaid > SAT_RULING_OVER) {
    const beyond = satPaid - SAT_RULING_OVER;
    flags.push(flag('ruling', FLAG_CODES.SAT_RULING_2X,
      `Saturday paid time ${fmtHM(satPaid)} exceeds 4:00. Rulebook OPEN question: reading A (applied here) — every Saturday hour is 1.5 OT; reading B — the 4-hour OT rule rolls Saturday hours 5+ to 2.0 DT, which would move ${fmtHM(beyond)} to 2.0 DT. Pending QC ruling.`));
  }
  if (hasDayTwo && (altTotal[0] !== total[0] || altTotal[1] !== total[1] || altTotal[2] !== total[2])) {
    const alt = tierList(altTotal, family).map((t) => `${t.code} ${t.hours.toFixed(2)}`).join(', ');
    flags.push(flag('ruling', FLAG_CODES.OVERNIGHT_RULING,
      `Shift crossed midnight. Coded with the 8-hour clock restarting at 00:00 (workday = calendar day, matching the Shift Change row). Rulebook OPEN question: if a continuous night shift keeps one clock, this shift would be ${alt}. Pending QC ruling.`));
  }
  if (options.holiday) {
    const dayName = dow0 === null ? 'weekday' : DOW_NAMES[dow0];
    flags.push(flag('ruling', FLAG_CODES.HOLIDAY_RULING,
      `Marked as a holiday: no holiday pay rule exists in the rulebook, so hours are computed on the normal ${dayName} ladder with no premium. Pending QC ruling.`));
  }

  // -- 10. Assemble
  const tiers = tierList(total, family);
  const byJob = [];
  for (const [jobRef, counters] of jobMap) {
    byJob.push({ jobRef, tiers: tierList(counters.total, family) });
  }
  // Per-day job allocation for the split halves (jobs with no minutes on that
  // day are omitted). Lets an export emit one row per date × tier × jobRef.
  const byJobForDay = (d) => {
    const out = [];
    for (const [jobRef, counters] of jobMap) {
      const t = tierList(counters.days[d], family);
      if (t.length > 0) out.push({ jobRef, tiers: t });
    }
    return out;
  };
  const split = hasDayTwo
    ? {
      dayOne: { date: dateText, tiers: tierList(dayOne, family), byJob: byJobForDay(0) },
      dayTwo: { date: dateParsed ? addDays(dateParsed, 1) : '', tiers: tierList(dayTwo, family), byJob: byJobForDay(1), shiftChange: true },
    }
    : null;

  return finish({
    flags, dateText, workedMinutes, lunchMinutes, breakMinutes, elapsedMinutes,
    family, familyReason, tiers, byJob, split,
  });
}

function finish(r) {
  const flags = sortFlags(r.flags);
  const ok = !flags.some((f) => f.severity === 'error');
  const timelineOk = !flags.some((f) => f.severity === 'error' && TIMELINE_CODES.has(f.code));
  return {
    ok,
    workedMinutes: r.workedMinutes,
    lunchMinutes: r.lunchMinutes,
    breakMinutes: r.breakMinutes,
    elapsedMinutes: r.elapsedMinutes,
    family: r.family,
    familyReason: r.familyReason,
    tiers: r.tiers,
    byJob: r.byJob,
    split: r.split,
    flags,
    timelineOk,
  };
}

// ---------------------------------------------------------------------------
// validateOdometer
// ---------------------------------------------------------------------------

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * {begin, end, claimedMiles} → {miles, flags}.
 * miles = end − begin (null when either reading is missing/non-numeric).
 * error ODO_NEGATIVE when end < begin; warn MILES_MISMATCH when a claimed
 * mileage is given and differs from end − begin.
 */
export function validateOdometer(args) {
  const a = args && typeof args === 'object' ? args : {};
  const begin = toNumber(a.begin);
  const end = toNumber(a.end);
  const claimed = toNumber(a.claimedMiles);
  const flags = [];
  if (begin === null || end === null) {
    return { miles: null, flags };
  }
  const miles = end - begin;
  if (miles < 0) {
    flags.push(flag('error', FLAG_CODES.ODO_NEGATIVE,
      `Ending odometer ${end} is less than beginning odometer ${begin}.`));
  } else if (claimed !== null && claimed !== miles) {
    flags.push(flag('warn', FLAG_CODES.MILES_MISMATCH,
      `Claimed ${claimed} miles but the odometer shows ${miles} (${end} − ${begin}); the daily log must match the odometer.`));
  }
  return { miles, flags };
}

// ---------------------------------------------------------------------------
// validateEA
// ---------------------------------------------------------------------------

/**
 * EA format rule per project → flags array (warn EA_FORMAT).
 *   105-Express: EA must end in "4" (the 105 EA is 07-314524).
 *   D8:          NO suffix rule — RULEBOOK §District 8 documents the EA as
 *                "1C08U4-style" and states no trailing-digit rule. Only a
 *                blank D8 EA is flagged (the D8 checklist row carries one).
 *   CTC / other: no rule.
 */
export function validateEA(project, ea) {
  const p = String(project === undefined || project === null ? '' : project).trim().toLowerCase();
  const value = String(ea === undefined || ea === null ? '' : ea).trim();
  if (p === '105-express' || p === '105' || p === '105 express' || p === '105-freeway' || p === '105 freeway') {
    if (value.endsWith('4')) return [];
    return [flag('warn', FLAG_CODES.EA_FORMAT,
      `105-Express EA must end in "4"${value ? ` — "${value}" does not` : ' — no EA entered'}.`)];
  }
  if (p === 'd8' || p === 'district 8' || p === 'district-8') {
    if (!value) {
      return [flag('warn', FLAG_CODES.EA_FORMAT,
        'D8 EA is blank — enter the EA from the dispatch (Daily Report form style 08-1C08U3; checklist style 1C08U4).')];
    }
    if (value.endsWith('3')) return [];
    if (value.endsWith('4')) {
      return [flag('info', FLAG_CODES.EA_FORMAT,
        `"${value}" is the checklist-style D8 EA. The D8 Daily Report form uses the 3-suffix form (08-1C08U3; form note: "All EA #'s end in 3"). Both are in use — QC to confirm which belongs on the timesheet.`)];
    }
    return [flag('warn', FLAG_CODES.EA_FORMAT,
      `D8 EA "${value}" matches neither known form (Daily Report 08-1C08U3 style, checklist 1C08U4 style).`)];
  }
  return [];
}
