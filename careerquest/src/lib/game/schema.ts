/** zod schemas for the game server actions. Pure. */
import { z } from "zod";
import { MAX_PLAN_LENGTH } from "@/lib/game/campaign-meta";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const dayKey = z
  .string()
  .trim()
  .regex(DAY_KEY, "Use a valid date.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Use a valid date.");

export const restDaySchema = z.object({
  restDay: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const missionIdSchema = z.object({ missionId: z.uuid("Unknown mission.") });

export const employmentSchema = z
  .object({
    employer: z.string().trim().min(1, "Enter the employer.").max(120, "Keep it under 120 characters."),
    title: z
      .string()
      .trim()
      .max(120, "Keep it under 120 characters.")
      .optional()
      .transform((v) => (v ? v : null)),
    startDate: dayKey,
    amount: z.coerce.number({ error: "Enter the pay amount." }).positive("Enter a pay amount above zero."),
    period: z.enum(["HOURLY", "ANNUAL"], { error: "Choose hourly or annual." }),
    hoursPerWeek: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 40 : v),
      z.coerce.number().int("Use whole hours.").min(1, "At least 1 hour.").max(80, "At most 80 hours."),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.period === "HOURLY" && v.amount > 1000) ctx.addIssue({ code: "custom", path: ["amount"], message: "Hourly pay above $1,000 looks like an annual amount." });
    if (v.period === "ANNUAL" && v.amount < 1000) ctx.addIssue({ code: "custom", path: ["amount"], message: "Annual pay below $1,000 looks like an hourly amount." });
    if (v.amount > 10_000_000) ctx.addIssue({ code: "custom", path: ["amount"], message: "That amount is too large." });
  });

export type EmploymentInput = z.output<typeof employmentSchema>;

export const paycheckSchema = z.object({
  amount: z.coerce
    .number({ error: "Enter the paycheck amount." })
    .positive("Enter an amount above zero.")
    .max(1_000_000, "That amount is too large.")
    .transform((v) => Math.round(v * 100) / 100),
  payDate: dayKey,
});

export type PaycheckInput = z.output<typeof paycheckSchema>;

export const paycheckIdSchema = z.object({ paycheckId: z.uuid("Unknown paycheck.") });

export const planSchema = z.object({
  text: z.string().trim().min(1, "Write at least a sentence.").max(MAX_PLAN_LENGTH, `Keep it under ${MAX_PLAN_LENGTH} characters.`),
});

export const seenSchema = z.array(z.uuid()).min(1).max(50);
