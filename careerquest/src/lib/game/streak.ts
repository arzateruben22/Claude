/**
 * Streak math. Pure (no database, no server-only imports) so it is unit-tested directly and can be
 * reused by Server Components for display.
 *
 * Rules (never punish rest or rejections):
 * - A streak counts *workdays with real activity* in an unbroken run.
 * - Rest days (DailyActivity.restDay) neither break nor extend a streak.
 * - Non-workdays neither break nor extend a streak: with 5 or fewer planned workdays per week
 *   Saturday and Sunday are non-workdays, with 6 Sunday is, with 7 every day is a workday.
 * - With fewer than 5 planned workdays per week, `5 − workdaysPerWeek` inactive weekdays per
 *   Monday-based week are forgiven (the user never promised to show up on those days).
 * - Today never breaks a streak: the day is not over yet.
 * - Rejections and other outcomes are not inputs at all; only the user's own activity is.
 */
import { addUtcDays, dateFromKey, dateKey, startOfWeekUtc } from "@/lib/dates";

export type StreakDay = {
  /** Calendar day in the user's timezone, YYYY-MM-DD. */
  key: string;
  /** The user did something real that day (XP, an application, a follow-up, a lesson, hours…). */
  active: boolean;
  /** The user marked the day as a rest day. */
  restDay?: boolean;
};

export type StreakOptions = {
  workdaysPerWeek: number;
  /** Today's calendar day (YYYY-MM-DD). Defaults to the latest day in the input. */
  todayKey?: string;
};

export type StreakResult = {
  current: number;
  longest: number;
  /** Most recent day with any activity (any weekday, rest days included), or null. */
  lastActiveKey: string | null;
};

export function clampWorkdaysPerWeek(n: number | null | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 5;
  return Math.min(7, Math.max(1, Math.floor(n)));
}

/** Whether a calendar day (UTC-midnight Date) is a planned workday for streaks and daily missions. */
export function isScheduledWorkday(date: Date, workdaysPerWeek: number): boolean {
  const wpw = clampWorkdaysPerWeek(workdaysPerWeek);
  const dow = date.getUTCDay(); // 0 = Sunday
  if (wpw >= 7) return true;
  if (wpw === 6) return dow !== 0;
  return dow >= 1 && dow <= 5;
}

/** Inactive weekdays per week that are forgiven when fewer than five workdays are planned. */
export function weeklyGraceDays(workdaysPerWeek: number): number {
  const wpw = clampWorkdaysPerWeek(workdaysPerWeek);
  return wpw < 5 ? 5 - wpw : 0;
}

/** Whether a DailyActivity row represents real activity. */
export function isActiveDay(row: {
  xpEarned?: number | null;
  applicationsSubmitted?: number | null;
  followUps?: number | null;
  lessonsCompleted?: number | null;
  missionsCompleted?: number | null;
  trainingHours?: number | string | { toString(): string } | null;
}): boolean {
  const hours = row.trainingHours === null || row.trainingHours === undefined ? 0 : Number(row.trainingHours.toString());
  return (
    (row.xpEarned ?? 0) > 0 ||
    (row.applicationsSubmitted ?? 0) > 0 ||
    (row.followUps ?? 0) > 0 ||
    (row.lessonsCompleted ?? 0) > 0 ||
    (row.missionsCompleted ?? 0) > 0 ||
    (Number.isFinite(hours) && hours > 0)
  );
}

const KEY = /^\d{4}-\d{2}-\d{2}$/;

export function computeStreak(days: readonly StreakDay[], opts: StreakOptions): StreakResult {
  const wpw = clampWorkdaysPerWeek(opts.workdaysPerWeek);
  const valid = days.filter((d) => KEY.test(d.key));
  let todayKey = opts.todayKey && KEY.test(opts.todayKey) ? opts.todayKey : null;
  if (!todayKey) {
    for (const d of valid) if (!todayKey || d.key > todayKey) todayKey = d.key;
  }
  if (!todayKey) return { current: 0, longest: 0, lastActiveKey: null };

  const byKey = new Map<string, { active: boolean; restDay: boolean }>();
  let firstKey: string | null = null;
  let lastActiveKey: string | null = null;
  for (const d of valid) {
    if (d.key > todayKey) continue;
    const prev = byKey.get(d.key);
    const merged = { active: (prev?.active ?? false) || d.active, restDay: (prev?.restDay ?? false) || Boolean(d.restDay) };
    byKey.set(d.key, merged);
    if (!firstKey || d.key < firstKey) firstKey = d.key;
    if (merged.active && (!lastActiveKey || d.key > lastActiveKey)) lastActiveKey = d.key;
  }
  if (!firstKey) return { current: 0, longest: 0, lastActiveKey: null };

  let run = 0;
  let longest = 0;
  let graceWeek = "";
  let graceLeft = 0;
  const grace = weeklyGraceDays(wpw);
  for (let d = dateFromKey(firstKey); ; d = addUtcDays(d, 1)) {
    const key = dateKey(d);
    if (key > todayKey) break;
    const info = byKey.get(key);
    if (info?.restDay) continue;
    if (!isScheduledWorkday(d, wpw)) continue;
    if (info?.active) {
      run += 1;
      if (run > longest) longest = run;
      continue;
    }
    if (key === todayKey) continue;
    const week = dateKey(startOfWeekUtc(d));
    if (week !== graceWeek) {
      graceWeek = week;
      graceLeft = grace;
    }
    if (graceLeft > 0) {
      graceLeft -= 1;
      continue;
    }
    run = 0;
  }
  return { current: run, longest, lastActiveKey };
}
