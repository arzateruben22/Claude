import { z } from "zod";

/** Bounds mirror `profileSchema` in @/lib/validation/profile so both write paths agree. */
export const targetsSchema = z.object({
  dailyApplicationTarget: z.coerce.number().int("Whole numbers only").min(0, "Cannot be negative").max(100, "100 per day is the maximum"),
  workdaysPerWeek: z.coerce.number().int("Whole numbers only").min(1, "At least 1 day").max(7, "At most 7 days"),
  campaignLengthDays: z.coerce.number().int("Whole numbers only").min(7, "At least 7 days").max(365, "At most 365 days"),
  weeklyApplicationTarget: z.coerce.number().int("Whole numbers only").min(0, "Cannot be negative").max(500, "500 per week is the maximum").optional(),
});

export type TargetsInput = z.infer<typeof targetsSchema>;

export type SavedTargets = {
  dailyApplicationTarget: number;
  workdaysPerWeek: number;
  campaignLengthDays: number;
  weeklyApplicationTarget: number;
};
