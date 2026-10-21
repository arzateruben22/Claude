import { z } from "zod";
import { PrimaryTrade, UiTheme } from "@/generated/prisma/enums";
import { CAREER_INTEREST_OPTIONS } from "@/lib/validation/profile";

/**
 * Per-tab schemas for the settings pages. Bounds mirror `profileSchema` in
 * `@/lib/validation/profile` (the canonical whole-profile schema) but each tab only submits its own
 * fields, so parsing with the full schema would silently reset the others to defaults.
 */

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const wholeNumber = (label: string) => z.coerce.number({ message: `${label} must be a number` }).int(`${label} must be a whole number`);

export const salaryTargetSchema = (label: string) =>
  wholeNumber(label).min(0, `${label} cannot be negative`).max(5_000_000, `${label} is unrealistically high`);

export const campaignLengthSchema = wholeNumber("Campaign length").min(7, "At least 7 days").max(365, "At most 365 days");
export const dailyTargetSchema = wholeNumber("Daily target").min(0, "Cannot be negative").max(100, "100 per day is the maximum");
export const workdaysSchema = wholeNumber("Workdays per week").min(1, "At least 1 day").max(7, "At most 7 days");
export const weeklyTargetSchema = wholeNumber("Weekly target").min(0, "Cannot be negative").max(500, "500 per week is the maximum");

export const careerInterestsSchema = z
  .array(z.enum(CAREER_INTEREST_OPTIONS))
  .max(CAREER_INTEREST_OPTIONS.length)
  .default([]);

export const apprenticeshipMinHourlySchema = z
  .coerce.number({ message: "Minimum hourly must be a number" })
  .min(0, "Cannot be negative")
  .max(500, "Enter an hourly rate, not an annual salary")
  .nullable();

export const pathwaySchema = z.object({
  primaryTrade: z.enum(PrimaryTrade).default("ELECTRICIAN"),
  careerInterests: careerInterestsSchema,
  openToApprenticeships: z.boolean().default(true),
  apprenticeshipMinHourly: apprenticeshipMinHourlySchema,
});

export const goalsSchema = z.object({
  immediateSalaryTarget: salaryTargetSchema("Immediate salary target"),
  longTermSalaryTarget: salaryTargetSchema("Long-term salary target"),
});

export const profileGoalsSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(80, "Name is too long"),
    regions: z
      .array(z.string().trim().min(1).max(80, "Region names must be 80 characters or fewer"))
      .min(1, "Add at least one region")
      .max(10, "At most 10 regions"),
    timezone: z.string().trim().min(1).max(64).refine(isValidTimeZone, "Choose a valid timezone"),
  })
  .extend(goalsSchema.shape)
  .extend(pathwaySchema.shape);

export type ProfileGoalsInput = z.infer<typeof profileGoalsSchema>;

export const campaignTargetsSchema = z.object({
  campaignLengthDays: campaignLengthSchema,
  dailyApplicationTarget: dailyTargetSchema,
  workdaysPerWeek: workdaysSchema,
  weeklyApplicationTarget: weeklyTargetSchema,
});

export type CampaignTargetsInput = z.infer<typeof campaignTargetsSchema>;

export const eligibilitySchema = z.object({
  excludeCompanyVehicleJobs: z.boolean().default(false),
  excludeDrivingRecordJobs: z.boolean().default(false),
  excludeCdlJobs: z.boolean().default(false),
});

export type EligibilityInput = z.infer<typeof eligibilitySchema>;

export const appearanceSchema = z.object({
  theme: z.enum(UiTheme).default("CYBER"),
  reducedMotion: z.boolean().default(false),
});

export type AppearanceInput = z.infer<typeof appearanceSchema>;

/** The onboarding wizard submits goals, pathway, targets and eligibility in one go. */
export const onboardingSchema = z
  .object({ campaignLengthDays: campaignLengthSchema })
  .extend(goalsSchema.shape)
  .extend(pathwaySchema.shape)
  .extend({
    dailyApplicationTarget: dailyTargetSchema,
    workdaysPerWeek: workdaysSchema,
    weeklyApplicationTarget: weeklyTargetSchema,
  })
  .extend(eligibilitySchema.shape);

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Suggested weekly target shown next to the weekly field. Pure. */
export function suggestedWeeklyTarget(dailyTarget: number, workdaysPerWeek: number): number {
  const d = Number.isFinite(dailyTarget) ? Math.max(0, dailyTarget) : 0;
  const w = Number.isFinite(workdaysPerWeek) ? Math.min(7, Math.max(0, workdaysPerWeek)) : 0;
  return Math.round(d * w);
}
