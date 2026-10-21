/**
 * XP economy. Every key maps to a real-world action; XP is awarded through the idempotent ledger
 * in `xp.ts`, keyed by a dedupeKey derived from the underlying record, so repeated imports or
 * repeated status flips can never award the same action twice.
 */
export const XP = {
  APPLICATION_SUBMITTED: 25,
  FOLLOW_UP_COMPLETED: 15,
  RESUME_IMPROVEMENT: 30,
  INTERVIEW_PREP: 50,
  INTERVIEW_ATTENDED: 100,
  JOB_OFFER_VERIFIED: 500,
  JOB_ACCEPTED: 250,
  LESSON_COMPLETED: 20,
  PRACTICE_EXAM_PASSED: 75,
  TRAINING_MILESTONE: 100,
  CERTIFICATION_VERIFIED: 1000,
  PROFILE_COMPLETED: 50,
  INTEGRATION_CONNECTED: 40,
  EXTENSION_INSTALLED: 40,
  FIRST_RECRUITER_RESPONSE: 30,
  MISSION_DAILY: 20,
  MISSION_WEEKLY: 75,
  WORK_HOURS_LOGGED: 10,
  TARGET_COMPANY_ADDED: 5,
} as const;

export type XpReason = keyof typeof XP;

export type XpTrack = "CAREER" | "JOB_HUNTER" | "ELECTRICIAN";

export const XP_TRACK: Record<XpReason, XpTrack> = {
  APPLICATION_SUBMITTED: "JOB_HUNTER",
  FOLLOW_UP_COMPLETED: "JOB_HUNTER",
  RESUME_IMPROVEMENT: "JOB_HUNTER",
  INTERVIEW_PREP: "JOB_HUNTER",
  INTERVIEW_ATTENDED: "JOB_HUNTER",
  JOB_OFFER_VERIFIED: "JOB_HUNTER",
  JOB_ACCEPTED: "JOB_HUNTER",
  LESSON_COMPLETED: "ELECTRICIAN",
  PRACTICE_EXAM_PASSED: "ELECTRICIAN",
  TRAINING_MILESTONE: "ELECTRICIAN",
  CERTIFICATION_VERIFIED: "ELECTRICIAN",
  PROFILE_COMPLETED: "CAREER",
  INTEGRATION_CONNECTED: "CAREER",
  EXTENSION_INSTALLED: "CAREER",
  FIRST_RECRUITER_RESPONSE: "JOB_HUNTER",
  MISSION_DAILY: "CAREER",
  MISSION_WEEKLY: "CAREER",
  WORK_HOURS_LOGGED: "ELECTRICIAN",
  TARGET_COMPANY_ADDED: "JOB_HUNTER",
};

/** Cumulative XP needed to *reach* a level (level 1 = 0 XP). Gentle power curve. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.5) + 50 * (level - 1));
}

export function levelFromXp(xp: number): { level: number; current: number; next: number; progress: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 200) level++;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const progress = next > current ? (xp - current) / (next - current) : 1;
  return { level, current, next, progress };
}

export const APPLICATION_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
