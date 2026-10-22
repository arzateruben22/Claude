/** zod schema for work-hour entries (server actions + service). Pure. */
import { z } from "zod";
import { HourVerification, WorkType } from "@/generated/prisma/enums";
import { MAX_ENTRY_HOURS, MIN_ENTRY_HOURS } from "./constants";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const dayKeySchema = z
  .string({ error: "Enter a date." })
  .trim()
  .regex(DAY_KEY, "Enter a valid date.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= "1970-01-01";
  }, "Enter a valid date.");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : null));

const optionalUuid = (message: string) =>
  z
    .union([z.literal(""), z.uuid(message)])
    .optional()
    .transform((v) => (v ? v : null));

export const workHourSchema = z.object({
  employer: z.string({ error: "Enter the employer." }).trim().min(1, "Enter the employer.").max(120, "Employer must be at most 120 characters."),
  supervisor: optionalText(120, "Supervisor"),
  dateWorked: dayKeySchema,
  hours: z.coerce
    .number({ error: "Enter the hours worked." })
    .refine((n) => Number.isFinite(n), "Enter the hours worked.")
    .refine((n) => n >= MIN_ENTRY_HOURS, `Log at least ${MIN_ENTRY_HOURS} hours.`)
    .refine((n) => n <= MAX_ENTRY_HOURS, `One entry can be at most ${MAX_ENTRY_HOURS} hours.`)
    .refine((n) => Math.abs(n * 4 - Math.round(n * 4)) < 1e-9, "Use quarter-hour steps (for example 7.5 or 7.75).")
    .transform((n) => Math.round(n * 4) / 4),
  workType: z.enum(WorkType, { error: "Choose the type of work." }),
  programId: optionalUuid("Choose a program from the list."),
  description: optionalText(1000, "Description"),
  verification: z.enum(HourVerification, { error: "Choose how these hours are documented." }).default("SELF_REPORTED"),
  documentId: optionalUuid("Choose one of your documents."),
});

export type WorkHourInput = z.output<typeof workHourSchema>;

export const entryIdSchema = z.object({ id: z.uuid("Unknown entry.") });
