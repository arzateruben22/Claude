import { z } from "zod";
import { contentKeySchema } from "./schema";

/**
 * FormData parsing for the academy server actions (kept out of the "use server" file so only the
 * actions themselves are public endpoints).
 */

const MAX_FIELDS = 120;
const answerValue = z.string().max(64);
const fieldId = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);

/** Collect `prefix<id>` fields into `{ id: value }`, bounded and validated. */
export function collectPrefixed(formData: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith(prefix) || typeof value !== "string") continue;
    if (++n > MAX_FIELDS) break;
    const id = name.slice(prefix.length);
    if (!fieldId.safeParse(id).success || !answerValue.safeParse(value).success) continue;
    out[id] = value;
  }
  return out;
}

export const lessonQuizFormSchema = z.object({
  lessonKey: contentKeySchema,
  answers: z.record(z.string(), answerValue),
});

export const workshopFormSchema = z.object({
  workshopKey: contentKeySchema,
  answers: z.record(z.string(), answerValue),
  measured: z.array(fieldId).max(MAX_FIELDS),
});

export const examFormSchema = z.object({
  size: z.coerce.number().int(),
  seed: z.coerce.number().int(),
  questionIds: z
    .string()
    .max(6000)
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(fieldId).min(1).max(100)),
  answers: z.record(z.string(), answerValue),
});

export function readString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}
