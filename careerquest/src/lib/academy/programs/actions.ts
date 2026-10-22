"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/rate-limit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { checklistToggleSchema, programIdSchema, programInterestSchema } from "./form";
import { removeProgramInterest, saveProgramInterest, toggleChecklistItem, trackProgram } from "./interest";

function limited(userId: string): string | null {
  const rl = rateLimit(`programs-write:${userId}`, 60, 60_000);
  return rl.ok ? null : `Too many changes. Try again in ${rl.retryAfterSeconds} s.`;
}

function revalidatePrograms() {
  revalidatePath("/academy", "layout");
  revalidatePath("/missions", "layout");
  revalidatePath("/dashboard");
}

type Msg = { message: string };

export async function trackProgramAction(_prev: ActionResult<Msg> | null, formData: FormData): Promise<ActionResult<Msg>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = programIdSchema.safeParse({ programId: formData.get("programId") });
  if (!parsed.success) return fail("That program was not found.");
  const result = await trackProgram(user.id, parsed.data.programId);
  if (!result.ok) return fail(result.error, result.fieldErrors);
  revalidatePrograms();
  return ok({ message: result.message });
}

export async function saveProgramInterestAction(_prev: ActionResult<Msg> | null, formData: FormData): Promise<ActionResult<Msg>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = programInterestSchema.safeParse({
    programId: formData.get("programId"),
    status: formData.get("status"),
    appliedAt: formData.get("appliedAt") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const result = await saveProgramInterest(user.id, parsed.data);
  if (!result.ok) return fail(result.error, result.fieldErrors);
  revalidatePrograms();
  return ok({ message: result.message });
}

export async function removeProgramInterestAction(_prev: ActionResult<Msg> | null, formData: FormData): Promise<ActionResult<Msg>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = programIdSchema.safeParse({ programId: formData.get("programId") });
  if (!parsed.success) return fail("That program was not found.");
  const result = await removeProgramInterest(user.id, parsed.data.programId);
  if (!result.ok) return fail(result.error);
  revalidatePrograms();
  return ok({ message: result.message });
}

export async function toggleChecklistItemAction(_prev: ActionResult<Msg> | null, formData: FormData): Promise<ActionResult<Msg>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = checklistToggleSchema.safeParse({
    programId: formData.get("programId"),
    itemId: formData.get("itemId"),
    done: formData.get("done"),
  });
  if (!parsed.success) return fail("That checklist item was not found.");
  const result = await toggleChecklistItem(user.id, parsed.data.programId, parsed.data.itemId, parsed.data.done);
  if (!result.ok) return fail(result.error);
  revalidatePath("/academy/apprenticeships", "layout");
  return ok({ message: result.message });
}
