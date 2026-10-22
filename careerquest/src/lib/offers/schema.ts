/**
 * Offer form validation (zod 4). Pure: shared by the server actions and the tests. Dates arrive as
 * `YYYY-MM-DD` strings and are converted to instants in the user's timezone by the action layer.
 */
import { z } from "zod";
import { OfferStatus, SalaryPeriod } from "@/generated/prisma/enums";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const money = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[$,\s]/g, ""))
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10_000_000), `Enter ${label} between $0 and $10,000,000.`)
    .transform((v) => (v === "" ? undefined : Math.round(Number(v) * 100) / 100));

const int = (label: string, min: number, max: number, fallback: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? String(fallback) : v))
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, `Enter ${label} as a whole number from ${min} to ${max}.`)
    .transform(Number);

const dateKey = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date.")
  .transform((v) => (v === "" ? undefined : v));

export const offerFormSchema = z
  .object({
    baseAmount: z
      .string()
      .trim()
      .transform((v) => v.replace(/[$,\s]/g, ""))
      .refine((v) => v !== "", "Enter the base pay from the offer.")
      .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 10_000_000), "Enter a base pay above $0.")
      .transform((v) => Math.round(Number(v) * 100) / 100),
    period: z.enum(SalaryPeriod),
    hoursPerWeek: int("hours per week", 1, 80, 40),
    overtimeHours: int("expected overtime hours per week", 0, 60, 0),
    signingBonus: money("a signing bonus"),
    annualBonus: money("an annual bonus"),
    benefitsValue: money("a benefits value"),
    benefitHealth: optionalText(500),
    benefitRetirement: optionalText(500),
    benefitPto: optionalText(500),
    benefitOther: optionalText(1000),
    startDate: dateKey,
    decisionDue: dateKey,
    status: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(OfferStatus).default("RECEIVED")),
    notes: optionalText(5000),
  })
  .superRefine((v, ctx) => {
    if (v.period === "HOURLY" && v.baseAmount > 1000) {
      ctx.addIssue({ code: "custom", path: ["baseAmount"], message: "That looks like an annual amount. Switch the period to Annual, or enter the hourly rate." });
    }
    if (v.period === "ANNUAL" && v.baseAmount < 1000) {
      ctx.addIssue({ code: "custom", path: ["baseAmount"], message: "That looks like an hourly rate. Switch the period to Hourly, or enter the annual salary." });
    }
  });

export type OfferFormInput = z.infer<typeof offerFormSchema>;

/** Structured benefits notes stored in `Offer.benefits` (JSON). */
export const benefitsNotesSchema = z
  .object({
    health: z.string().max(500).optional(),
    retirement: z.string().max(500).optional(),
    pto: z.string().max(500).optional(),
    other: z.string().max(1000).optional(),
  })
  .catch({});

export type BenefitsNotes = z.infer<typeof benefitsNotesSchema>;

export function benefitsFromForm(v: Pick<OfferFormInput, "benefitHealth" | "benefitRetirement" | "benefitPto" | "benefitOther">): BenefitsNotes {
  const out: BenefitsNotes = {};
  if (v.benefitHealth) out.health = v.benefitHealth;
  if (v.benefitRetirement) out.retirement = v.benefitRetirement;
  if (v.benefitPto) out.pto = v.benefitPto;
  if (v.benefitOther) out.other = v.benefitOther;
  return out;
}

export const BENEFIT_LABELS: Record<keyof BenefitsNotes, string> = {
  health: "Health insurance",
  retirement: "Retirement / pension",
  pto: "Paid time off",
  other: "Other",
};

export const OFFER_FORM_FIELDS = [
  "baseAmount",
  "period",
  "hoursPerWeek",
  "overtimeHours",
  "signingBonus",
  "annualBonus",
  "benefitsValue",
  "benefitHealth",
  "benefitRetirement",
  "benefitPto",
  "benefitOther",
  "startDate",
  "decisionDue",
  "status",
  "notes",
] as const;

/** Read the offer fields from a FormData (missing fields become ""). */
export function readOfferForm(formData: FormData): Record<(typeof OFFER_FORM_FIELDS)[number], string> {
  const out = {} as Record<(typeof OFFER_FORM_FIELDS)[number], string>;
  for (const k of OFFER_FORM_FIELDS) {
    const v = formData.get(k);
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}
