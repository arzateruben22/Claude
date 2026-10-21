import { z } from "zod";
import { ApplicationSource, ApplicationStatus, EmploymentType, SalaryPeriod } from "@/generated/prisma/enums";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || /^https?:\/\//i.test(v), "Enter a full URL starting with http:// or https://");

const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : v;
    return Number.isFinite(n) ? n : undefined;
  })
  .refine((v) => v === undefined || (v >= 0 && v <= 10_000_000), "Enter a realistic amount");

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined))
  .refine((d) => d === undefined || !Number.isNaN(d.getTime()), "Enter a valid date");

export const applicationInputSchema = z.object({
  companyName: z.string().trim().min(1, "Company is required").max(200),
  positionTitle: z.string().trim().min(1, "Job title is required").max(200),
  jobCategory: optionalTrimmed(80),
  postingUrl: optionalUrl,
  requisitionNumber: optionalTrimmed(80),
  source: z.enum(ApplicationSource).default("OTHER"),
  submissionDestination: z.enum(ApplicationSource).optional(),
  location: optionalTrimmed(160),
  remote: z.coerce.boolean().default(false),
  salaryMin: optionalMoney,
  salaryMax: optionalMoney,
  salaryPeriod: z.enum(SalaryPeriod).optional(),
  employmentType: z.enum(EmploymentType).default("UNKNOWN"),
  status: z.enum(ApplicationStatus).default("SAVED"),
  appliedAt: optionalDate,
  followUpAt: optionalDate,
  isQualified: z.coerce.boolean().default(true),
  requiresCompanyVehicle: z.coerce.boolean().default(false),
  requiresDrivingRecord: z.coerce.boolean().default(false),
  requiresCdl: z.coerce.boolean().default(false),
  recruiterName: optionalTrimmed(120),
  recruiterEmail: optionalTrimmed(254),
  notes: optionalTrimmed(5000),
  jobDescription: optionalTrimmed(20000),
  resumeVersionId: optionalTrimmed(64),
  coverLetterVersionId: optionalTrimmed(64),
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export const statusChangeSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(ApplicationStatus),
  occurredAt: optionalDate,
  note: optionalTrimmed(1000),
});
