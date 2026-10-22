/**
 * Form schemas for the review queue's server actions. Dates stay strings here; the action converts
 * them with the user's timezone.
 */
import { z } from "zod";
import { ApplicationStatus, InterviewType } from "@/generated/prisma/enums";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.uuid().optional());

const dateTimeString = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || !Number.isNaN(new Date(v).getTime()), "Enter a valid date and time");

/**
 * "create" | "dismiss" | "attach:<applicationId>" | "attach-other" (uses `otherApplicationId`).
 * Submitted as the clicked button's name/value.
 */
const decisionField = z
  .string()
  .trim()
  .regex(/^(create|dismiss|attach-other|attach:[0-9a-fA-F-]{36})$/, "Choose what to do with this item");

export type ParsedDecision = { kind: "create" } | { kind: "dismiss" } | { kind: "attach"; applicationId: string };

const reviewItemShape = {
  decision: decisionField,
  otherApplicationId: optionalUuid,
  company: optionalText(200),
  title: optionalText(200),
  location: optionalText(160),
  status: z.enum(ApplicationStatus),
  interviewAt: dateTimeString,
  interviewType: z.enum(InterviewType).optional(),
};

type ItemFields = {
  decision: string;
  otherApplicationId?: string;
  company?: string;
  title?: string;
};

function refineDecision(v: ItemFields, ctx: z.RefinementCtx) {
  if (v.decision === "create") {
    if (!v.company) ctx.addIssue({ code: "custom", path: ["company"], message: "Company is required to create an application" });
    if (!v.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Job title is required to create an application" });
  }
  if (v.decision === "attach-other" && !v.otherApplicationId) {
    ctx.addIssue({ code: "custom", path: ["otherApplicationId"], message: "Pick the application to attach to" });
  }
}

export const emailReviewFormSchema = z
  .object({ emailId: z.uuid(), ...reviewItemShape })
  .superRefine(refineDecision);

export const captureReviewFormSchema = z
  .object({ captureId: z.uuid(), ...reviewItemShape })
  .superRefine(refineDecision);

export function parseDecision(v: { decision: string; otherApplicationId?: string }): ParsedDecision {
  if (v.decision === "create") return { kind: "create" };
  if (v.decision === "dismiss") return { kind: "dismiss" };
  if (v.decision === "attach-other") return { kind: "attach", applicationId: v.otherApplicationId! };
  return { kind: "attach", applicationId: v.decision.slice("attach:".length) };
}

export const interviewInviteFormSchema = z.object({
  emailId: z.uuid(),
  decision: z.enum(["add", "skip"]),
  scheduledAt: dateTimeString,
  interviewType: z.enum(InterviewType).default("OTHER"),
}).superRefine((v, ctx) => {
  if (v.decision === "add" && !v.scheduledAt) {
    ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Pick the interview date and time" });
  }
});

export const duplicateFormSchema = z.object({
  candidateId: z.uuid(),
  decision: z.enum(["merge", "dismiss"]),
  keepId: optionalUuid,
}).superRefine((v, ctx) => {
  if (v.decision === "merge" && !v.keepId) {
    ctx.addIssue({ code: "custom", path: ["keepId"], message: "Choose which record to keep" });
  }
});
