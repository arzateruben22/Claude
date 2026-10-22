/** Work-hour log constants, labels and XP keys. Pure (safe for client components). */
import type { HourVerification, WorkType } from "@/generated/prisma/enums";

export const MIN_ENTRY_HOURS = 0.25;
export const MAX_ENTRY_HOURS = 24;
/** Hours across all entries on one calendar date may not exceed this. */
export const MAX_HOURS_PER_DAY = 24;

/** Verified cumulative hours that award TRAINING_MILESTONE XP once each. */
export const HOUR_MILESTONES = [1000, 2000, 4000, 6000, 8000] as const;

export const VERIFIED_SOURCES: readonly HourVerification[] = ["EMPLOYER_VERIFIED", "OFFICIAL_RECORD"];

export function isVerifiedSource(v: HourVerification): boolean {
  return v === "EMPLOYER_VERIFIED" || v === "OFFICIAL_RECORD";
}

/** XP attribution so entry XP can be revoked when the entry is deleted. */
export const HOURS_ENTRY_XP_SOURCE = "WorkHourEntry";
export const HOURS_MILESTONE_XP_SOURCE = "WorkHourMilestone";
export const entryXpKey = (entryId: string) => `xp:hours-entry:${entryId}`;
export const milestoneXpKey = (hours: number) => `xp:hours-milestone:${hours}`;

/** The default classification for the hours log and certification tracker. */
export const DEFAULT_CLASSIFICATION = "GENERAL";
/** Fallback only when the seeded requirement is unavailable; the UI then shows it as unverified. */
export const FALLBACK_GENERAL_HOURS = 8000;

/** Trailing window for the completion projection, and the minimum history before projecting. */
export const PROJECTION_WINDOW_WEEKS = 8;
export const PROJECTION_MIN_WEEKS = 4;

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  COMMERCIAL: "Commercial wiring",
  RESIDENTIAL: "Residential wiring",
  INDUSTRIAL: "Industrial wiring",
  FIRE_LIFE_SAFETY: "Fire / life safety",
  VOICE_DATA_VIDEO: "Voice / data / video",
  LIGHTING: "Lighting / fixtures",
  SOLAR_PV: "Solar PV",
  MAINTENANCE: "Troubleshooting & maintenance",
  CLASSROOM: "Classroom instruction",
  OTHER: "Other",
};

export const WORK_TYPE_ORDER: readonly WorkType[] = [
  "COMMERCIAL",
  "RESIDENTIAL",
  "INDUSTRIAL",
  "MAINTENANCE",
  "LIGHTING",
  "FIRE_LIFE_SAFETY",
  "VOICE_DATA_VIDEO",
  "SOLAR_PV",
  "CLASSROOM",
  "OTHER",
];

export const VERIFICATION_LABELS: Record<HourVerification, string> = {
  SELF_REPORTED: "Self-reported",
  EMPLOYER_VERIFIED: "Employer-verified",
  OFFICIAL_RECORD: "Official record",
};

export const VERIFICATION_HINTS: Record<HourVerification, string> = {
  SELF_REPORTED: "Your own log. Tracked, but not treated as accepted by California.",
  EMPLOYER_VERIFIED: "Backed by a pay stub or a signed employer letter you attach.",
  OFFICIAL_RECORD: "Backed by a union hour report or another official record you attach.",
};

/** Round to cents of an hour so float sums stay stable (Decimal(5,2) column). */
export function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}
