"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { collectPrefixed, examFormSchema, lessonQuizFormSchema, readString, workshopFormSchema } from "./form";
import { submitExam, submitLessonQuiz, submitWorkshop, type ExamOutcome, type LessonQuizOutcome, type WorkshopOutcome } from "./service";
import type { WorkshopAnswer } from "./workshop";

/**
 * Academy server actions. Each one authenticates, rate-limits per user, validates the form with
 * zod and delegates grading + persistence to `service.ts` (which re-reads the content on the
 * server, so the client never supplies answer keys or scores).
 */

function limited(userId: string): string | null {
  const rl = rateLimit(`academy-submit:${userId}`, 30, 60_000);
  return rl.ok ? null : `Too many submissions. Try again in ${rl.retryAfterSeconds} s.`;
}

function revalidateAcademy() {
  revalidatePath("/academy", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/missions");
}

export async function submitLessonQuizAction(
  _prev: ActionResult<LessonQuizOutcome> | null,
  formData: FormData,
): Promise<ActionResult<LessonQuizOutcome>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = lessonQuizFormSchema.safeParse({
    lessonKey: readString(formData, "lessonKey"),
    answers: collectPrefixed(formData, "answer."),
  });
  if (!parsed.success) return fail("That quiz submission was not valid.");
  const result = await submitLessonQuiz(user.id, parsed.data.lessonKey, parsed.data.answers);
  if (!result.ok) return fail(result.message);
  revalidateAcademy();
  return ok(result.data);
}

export async function submitWorkshopAction(
  _prev: ActionResult<WorkshopOutcome> | null,
  formData: FormData,
): Promise<ActionResult<WorkshopOutcome>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = workshopFormSchema.safeParse({
    workshopKey: readString(formData, "workshopKey"),
    answers: collectPrefixed(formData, "answer."),
    measured: formData.getAll("measured").filter((v): v is string => typeof v === "string"),
  });
  if (!parsed.success) return fail("That bench report was not valid.");
  const measured = new Set(parsed.data.measured);
  const answers: Record<string, WorkshopAnswer> = {};
  for (const [id, value] of Object.entries(parsed.data.answers)) answers[id] = { value, measuredFirst: measured.has(id) };
  const result = await submitWorkshop(user.id, parsed.data.workshopKey, answers);
  if (!result.ok) return fail(result.message);
  revalidateAcademy();
  return ok(result.data);
}

export async function submitExamAction(_prev: ActionResult<ExamOutcome> | null, formData: FormData): Promise<ActionResult<ExamOutcome>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = examFormSchema.safeParse({
    size: readString(formData, "size"),
    seed: readString(formData, "seed"),
    questionIds: readString(formData, "questionIds"),
    answers: collectPrefixed(formData, "answer."),
  });
  if (!parsed.success) return fail("That exam submission was not valid. Start a new exam.");
  const result = await submitExam(user.id, parsed.data);
  if (!result.ok) return fail(result.message);
  revalidateAcademy();
  return ok(result.data);
}
