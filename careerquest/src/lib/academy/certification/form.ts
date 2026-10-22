/** zod schemas for the certification tracker actions. Pure. */
import { z } from "zod";
import { dayKeySchema } from "@/lib/academy/hours/validation";
import { CERTIFICATION_CODE } from "./constants";

const optionalDay = z
  .union([z.literal(""), dayKeySchema])
  .optional()
  .transform((v) => (v ? v : null));

export const classificationSchema = z.string().trim().regex(CERTIFICATION_CODE, "Unknown classification.");

export const CERT_DATE_FIELDS = [
  "traineeRegisteredAt",
  "traineeExpiresAt",
  "examApplicationAt",
  "examEligibleAt",
  "examScheduledAt",
  "examPassedAt",
  "certifiedAt",
  "certificateExpiresAt",
] as const;

export type CertDateField = (typeof CERT_DATE_FIELDS)[number];

/** Dates that describe something that already happened (cannot be in the future). */
export const PAST_ONLY_FIELDS: readonly CertDateField[] = ["traineeRegisteredAt", "examApplicationAt", "examEligibleAt", "examPassedAt", "certifiedAt"];

export const certificationStatusSchema = z
  .object({
    classification: classificationSchema,
    traineeRegisteredAt: optionalDay,
    traineeExpiresAt: optionalDay,
    schoolEnrolled: z
      .string()
      .trim()
      .max(200, "School must be at most 200 characters.")
      .optional()
      .transform((v) => (v ? v : null)),
    examApplicationAt: optionalDay,
    examEligibleAt: optionalDay,
    examScheduledAt: optionalDay,
    examPassedAt: optionalDay,
    certifiedAt: optionalDay,
    certificateExpiresAt: optionalDay,
    notes: z
      .string()
      .trim()
      .max(2000, "Notes must be at most 2,000 characters.")
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((v, ctx) => {
    const before = (a: string | null, b: string | null) => a !== null && b !== null && a < b;
    if (before(v.traineeExpiresAt, v.traineeRegisteredAt)) {
      ctx.addIssue({ code: "custom", path: ["traineeExpiresAt"], message: "Expiry cannot be before the registration date." });
    }
    if (before(v.certificateExpiresAt, v.certifiedAt)) {
      ctx.addIssue({ code: "custom", path: ["certificateExpiresAt"], message: "Expiry cannot be before the certification date." });
    }
    if (before(v.examEligibleAt, v.examApplicationAt)) {
      ctx.addIssue({ code: "custom", path: ["examEligibleAt"], message: "Eligibility cannot be before the exam application." });
    }
    if (before(v.examPassedAt, v.examApplicationAt)) {
      ctx.addIssue({ code: "custom", path: ["examPassedAt"], message: "The pass date cannot be before the exam application." });
    }
    if (before(v.certifiedAt, v.examPassedAt)) {
      ctx.addIssue({ code: "custom", path: ["certifiedAt"], message: "Certification cannot be before the exam pass date." });
    }
  });

export type CertificationStatusInput = z.output<typeof certificationStatusSchema>;

export const verifyCertificationSchema = z.object({
  classification: classificationSchema,
  documentId: z
    .union([z.literal(""), z.uuid("Choose one of your certificate documents.")])
    .optional()
    .transform((v) => (v ? v : null)),
});
