/** zod schemas for the apprenticeship directory actions. Pure. */
import { z } from "zod";
import { ProgramInterestStatus } from "@/generated/prisma/enums";
import { dayKeySchema } from "@/lib/academy/hours/validation";

export const programIdSchema = z.object({ programId: z.uuid("Unknown program.") });

export const programInterestSchema = z.object({
  programId: z.uuid("Unknown program."),
  status: z.enum(ProgramInterestStatus, { error: "Choose a status." }),
  appliedAt: z
    .union([z.literal(""), dayKeySchema])
    .optional()
    .transform((v) => (v ? v : null)),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be at most 2,000 characters.")
    .optional()
    .transform((v) => (v ? v : null)),
});

export type ProgramInterestInput = z.output<typeof programInterestSchema>;

export const checklistToggleSchema = z.object({
  programId: z.uuid("Unknown program."),
  itemId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z]-[a-z0-9-]+$/, "Unknown checklist item."),
  done: z.enum(["true", "false"]).transform((v) => v === "true"),
});
