/** Re-exports of the shared exact-UTC calendar helpers (kept for existing imports). */
import { DAY_MS, addUtcDays, daysBetween, dateKey } from "@/lib/dates";

export { DAY_MS };
export const utcDateKey = dateKey;
export const addDaysUtc = addUtcDays;
/** Whole days from `a` to `b` (positive when b is later). */
export const diffDaysUtc = daysBetween;
