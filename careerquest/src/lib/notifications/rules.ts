/**
 * Pure reminder rules: given a snapshot of the user's data, which notifications should exist?
 * Every candidate carries a dedupeKey derived from the real-world trigger, so generating twice
 * (or from several devices) never creates duplicates.
 */
import { dateKeyInTz } from "@/lib/dates";
import type { NotificationPrefs } from "./prefs";

export type NotificationCandidate = {
  dedupeKey: string;
  type: "FOLLOW_UP_DUE" | "INTERVIEW_SOON" | "TRAINEE_RENEWAL" | "CERT_RENEWAL" | "WEEKLY_REPORT" | "DAILY_NUDGE";
  title: string;
  body: string;
  link: string;
};

export type ReminderSnapshot = {
  now: Date;
  timezone: string;
  workdaysPerWeek: number;
  followUps: { applicationId: string; companyName: string; positionTitle: string; followUpAt: Date }[];
  interviews: { id: string; applicationId: string; companyName: string; scheduledAt: Date }[];
  certifications: { classification: string; traineeExpiresAt: Date | null; certificateExpiresAt: Date | null }[];
  weeklyReports: { weekStart: Date; createdAt: Date }[];
  appliedToday: number;
};

const DAY = 86_400_000;

function localHour(now: Date, tz: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now);
  return Number(h);
}

function localWeekday(now: Date, tz: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function fmtTime(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

export function buildReminderCandidates(s: ReminderSnapshot, prefs: NotificationPrefs): NotificationCandidate[] {
  const out: NotificationCandidate[] = [];
  const todayKey = dateKeyInTz(s.now, s.timezone);

  if (prefs.followUps) {
    for (const f of s.followUps) {
      const dueKey = dateKeyInTz(f.followUpAt, s.timezone);
      if (dueKey > todayKey) continue;
      out.push({
        dedupeKey: `followup:${f.applicationId}:${dueKey}`,
        type: "FOLLOW_UP_DUE",
        title: `Follow up with ${f.companyName}`,
        body: `${f.positionTitle} — follow-up ${dueKey === todayKey ? "due today" : `was due ${dueKey}`}. CareerQuest never contacts anyone for you; open the application to log it.`,
        link: `/applications/${f.applicationId}`,
      });
    }
  }

  if (prefs.interviews) {
    for (const i of s.interviews) {
      const ms = i.scheduledAt.getTime() - s.now.getTime();
      if (ms < 0 || ms > DAY + 60 * 60 * 1000) continue;
      out.push({
        dedupeKey: `interview:${i.id}`,
        type: "INTERVIEW_SOON",
        title: `Interview with ${i.companyName}`,
        body: `Scheduled ${fmtTime(i.scheduledAt, s.timezone)}. Review your prep notes.`,
        link: `/applications/${i.applicationId}`,
      });
    }
  }

  if (prefs.certification) {
    for (const c of s.certifications) {
      for (const [kind, date, label] of [
        ["trainee", c.traineeExpiresAt, "Electrician trainee registration"],
        ["certificate", c.certificateExpiresAt, "Electrician certificate"],
      ] as const) {
        if (!date) continue;
        const days = Math.ceil((date.getTime() - s.now.getTime()) / DAY);
        if (days > 30 || days < -30) continue;
        out.push({
          dedupeKey: `${kind}-renewal:${c.classification}:${date.toISOString().slice(0, 10)}`,
          type: kind === "trainee" ? "TRAINEE_RENEWAL" : "CERT_RENEWAL",
          title: `${label} ${days >= 0 ? `expires in ${days} day${days === 1 ? "" : "s"}` : "has expired"}`,
          body: "Dates are the ones you entered. Confirm renewal requirements on the DIR website.",
          link: "/academy/certification",
        });
      }
    }
  }

  if (prefs.weeklyReport) {
    for (const r of s.weeklyReports) {
      if (s.now.getTime() - r.createdAt.getTime() > 7 * DAY) continue;
      const wk = r.weekStart.toISOString().slice(0, 10);
      out.push({
        dedupeKey: `weekly-report:${wk}`,
        type: "WEEKLY_REPORT",
        title: `Weekly report for the week of ${wk} is ready`,
        body: "See what you accomplished and this week's priorities.",
        link: "/analytics/reports",
      });
    }
  }

  if (prefs.dailyNudge) {
    const wd = localWeekday(s.now, s.timezone);
    const isWorkday = s.workdaysPerWeek >= 7 || (s.workdaysPerWeek === 6 ? wd !== 0 : wd >= 1 && wd <= Math.min(5, s.workdaysPerWeek));
    if (isWorkday && localHour(s.now, s.timezone) >= 18 && s.appliedToday === 0) {
      out.push({
        dedupeKey: `nudge:${todayKey}`,
        type: "DAILY_NUDGE",
        title: "No applications logged today",
        body: "If today was a rest day, mark it as one — rest days never break your streak.",
        link: "/missions",
      });
    }
  }
  return out;
}
