import { z } from "zod";
import { PrimaryTrade, UiTheme } from "@/generated/prisma/enums";

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  regions: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
  timezone: z.string().trim().min(1).max(64).default("America/Los_Angeles"),
  immediateSalaryTarget: z.coerce.number().int().min(0).max(5_000_000),
  longTermSalaryTarget: z.coerce.number().int().min(0).max(5_000_000),
  openToApprenticeships: z.coerce.boolean().default(true),
  apprenticeshipMinHourly: z.coerce.number().min(0).max(500).optional(),
  primaryTrade: z.enum(PrimaryTrade).default("ELECTRICIAN"),
  careerInterests: z.array(z.string().trim().max(80)).max(20).default([]),
  campaignLengthDays: z.coerce.number().int().min(7).max(365).default(90),
  dailyApplicationTarget: z.coerce.number().int().min(0).max(100).default(5),
  workdaysPerWeek: z.coerce.number().int().min(1).max(7).default(5),
  weeklyApplicationTarget: z.coerce.number().int().min(0).max(500).default(25),
  excludeCompanyVehicleJobs: z.coerce.boolean().default(false),
  excludeDrivingRecordJobs: z.coerce.boolean().default(false),
  excludeCdlJobs: z.coerce.boolean().default(false),
  theme: z.enum(UiTheme).default("CYBER"),
  reducedMotion: z.coerce.boolean().default(false),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const CAREER_INTEREST_OPTIONS = [
  "Electrician",
  "Elevator mechanic",
  "Commercial HVAC",
  "Industrial maintenance",
  "Building engineer",
  "Construction project coordinator",
  "Construction estimator",
  "Assistant project manager",
  "Commercial plumbing & pipefitting",
] as const;
