"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/rate-limit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { INTERVIEW_ROLES } from "./intents";
import { MAX_MESSAGE_LENGTH, clearCoachMessages, sendCoachMessage } from "./service";
import { RESUME_CONTENT_MAX, RESUME_CONTENT_MIN, RESUME_NAME_MAX, deleteResume, saveResume, setDefaultResume } from "./resumes";

/**
 * Advisor server actions. Each authenticates with requireUser(), rate-limits per user and validates
 * input with zod; ids from the form are only ever used together with the session's userId.
 */

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.uuid().optional());

const messageSchema = z.object({
  text: z.string().trim().min(1, "Type a message first.").max(MAX_MESSAGE_LENGTH, `Keep messages under ${MAX_MESSAGE_LENGTH} characters.`),
  applicationId: optionalUuid.optional(),
  role: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.enum(INTERVIEW_ROLES).optional())
    .optional(),
});

function field(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

export type SendMessageData = { replyId: string };

export async function sendCoachMessageAction(_prev: ActionResult<SendMessageData> | null, formData: FormData): Promise<ActionResult<SendMessageData>> {
  const user = await requireUser();
  const rl = rateLimit(`coach-msg:${user.id}`, 30, 60_000);
  if (!rl.ok) return fail(`You're sending messages quickly. Try again in ${rl.retryAfterSeconds} s.`);
  const parsed = messageSchema.safeParse({ text: field(formData, "text") ?? "", applicationId: field(formData, "applicationId"), role: field(formData, "role") });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const { reply } = await sendCoachMessage(user.id, { text: parsed.data.text, applicationId: parsed.data.applicationId ?? null, role: parsed.data.role ?? null });
    revalidatePath("/coach");
    return ok({ replyId: reply.id });
  } catch (err) {
    console.error("[coach] sendCoachMessage failed", err);
    return fail("The Advisor couldn't answer that right now. Your data is unchanged; please try again.");
  }
}

export async function clearCoachHistoryAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser();
  if (field(formData, "confirm") !== "yes") return fail("Confirm that you want to clear the conversation.");
  const n = await clearCoachMessages(user.id);
  revalidatePath("/coach");
  return ok({ message: n ? `Cleared ${n} message${n === 1 ? "" : "s"}.` : "The conversation was already empty." });
}

const resumeSchema = z.object({
  id: optionalUuid.optional(),
  name: z.string().trim().min(1, "Give this version a name.").max(RESUME_NAME_MAX, `Keep the name under ${RESUME_NAME_MAX} characters.`),
  content: z
    .string()
    .trim()
    .min(RESUME_CONTENT_MIN, "Paste the full text of your résumé.")
    .max(RESUME_CONTENT_MAX, `That's longer than ${RESUME_CONTENT_MAX.toLocaleString("en-US")} characters; paste the text only.`),
  isDefault: z.boolean(),
});

export type ResumeActionData = { message: string; id?: string };

function revalidateResumes() {
  revalidatePath("/coach", "layout");
  revalidatePath("/missions");
  revalidatePath("/dashboard");
}

export async function saveResumeAction(_prev: ActionResult<ResumeActionData> | null, formData: FormData): Promise<ActionResult<ResumeActionData>> {
  const user = await requireUser();
  const rl = rateLimit(`coach-resume:${user.id}`, 30, 60_000);
  if (!rl.ok) return fail(`Too many saves. Try again in ${rl.retryAfterSeconds} s.`);
  const parsed = resumeSchema.safeParse({
    id: field(formData, "id"),
    name: field(formData, "name") ?? "",
    content: field(formData, "content") ?? "",
    isDefault: formData.get("isDefault") === "on" || formData.get("isDefault") === "true",
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const res = await saveResume(user.id, { id: parsed.data.id ?? null, name: parsed.data.name, content: parsed.data.content, isDefault: parsed.data.isDefault });
  if (!res.ok) return fail("That résumé version no longer exists.");
  revalidateResumes();
  return ok({ message: res.created ? "Résumé version saved." : "Résumé version updated.", id: res.id });
}

const idSchema = z.object({ id: z.uuid() });

export async function deleteResumeAction(_prev: ActionResult<ResumeActionData> | null, formData: FormData): Promise<ActionResult<ResumeActionData>> {
  const user = await requireUser();
  const parsed = idSchema.safeParse({ id: field(formData, "id") });
  if (!parsed.success) return fail("Unknown résumé version.");
  const done = await deleteResume(user.id, parsed.data.id);
  if (!done) return fail("That résumé version no longer exists.");
  revalidateResumes();
  return ok({ message: "Résumé version deleted." });
}

export async function setDefaultResumeAction(_prev: ActionResult<ResumeActionData> | null, formData: FormData): Promise<ActionResult<ResumeActionData>> {
  const user = await requireUser();
  const parsed = idSchema.safeParse({ id: field(formData, "id") });
  if (!parsed.success) return fail("Unknown résumé version.");
  const done = await setDefaultResume(user.id, parsed.data.id);
  if (!done) return fail("That résumé version no longer exists.");
  revalidateResumes();
  return ok({ message: "Default résumé updated." });
}
