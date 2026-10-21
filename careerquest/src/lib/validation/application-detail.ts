import { z } from "zod";
import {
  ApplicationStatus,
  InterviewOutcome,
  InterviewType,
} from "@/generated/prisma/enums";

/**
 * Schemas for the tracker's detail-page actions (status change, follow-up, notes, interviews).
 * Dates are kept as raw strings here and converted with the user's timezone in the service layer.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

/** Raw `<input type="date">` / `datetime-local` value; parsed in the user's timezone later. */
const dateString = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine(
    (v) => v === undefined || !Number.isNaN(new Date(v).getTime()),
    "Enter a valid date",
  );

const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === "1" || v === true,
  z.boolean(),
);

export const applicationIdSchema = z.object({ applicationId: z.uuid() });

export const statusChangeFormSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum(ApplicationStatus),
  occurredAt: dateString,
  note: optionalText(1000),
});

export const followUpSchema = z.object({
  applicationId: z.uuid(),
  occurredAt: dateString,
  nextFollowUpAt: dateString,
  note: optionalText(1000),
});

export const noteSchema = z.object({
  applicationId: z.uuid(),
  note: z.string().trim().min(1, "Write a note first").max(5000),
});

export const interviewSchema = z.object({
  applicationId: z.uuid(),
  type: z.enum(InterviewType).default("PHONE_SCREEN"),
  scheduledAt: z
    .string()
    .trim()
    .min(1, "Pick a date and time")
    .refine(
      (v) => !Number.isNaN(new Date(v).getTime()),
      "Enter a valid date and time",
    ),
  durationMinutes: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v > 0 && v <= 600),
      "Enter minutes between 1 and 600",
    ),
  interviewer: optionalText(160),
  location: optionalText(240),
  notes: optionalText(2000),
});

export const interviewOutcomeSchema = z.object({
  interviewId: z.uuid(),
  outcome: z.enum(InterviewOutcome),
  attended: checkbox,
  prepCompleted: checkbox,
});

export type StatusChangeForm = z.infer<typeof statusChangeFormSchema>;
export type FollowUpForm = z.infer<typeof followUpSchema>;
export type InterviewForm = z.infer<typeof interviewSchema>;
export type InterviewOutcomeForm = z.infer<typeof interviewOutcomeSchema>;
