"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DocumentKind } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/rate-limit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { readFormFile } from "@/lib/documents/service";
import { createWorkHourEntry, deleteWorkHourEntry, updateWorkHourEntry, type HoursWriteOptions } from "./service";
import { entryIdSchema, workHourSchema } from "./validation";

export type HourEntryActionData = { message: string; entryId: string; downgraded: boolean };

function limited(userId: string): string | null {
  const rl = rateLimit(`hours-write:${userId}`, 60, 60_000);
  return rl.ok ? null : `Too many changes. Try again in ${rl.retryAfterSeconds} s.`;
}

function revalidateHours() {
  revalidatePath("/academy", "layout");
  revalidatePath("/missions", "layout");
  revalidatePath("/dashboard");
}

const FIELDS = ["employer", "supervisor", "dateWorked", "hours", "workType", "programId", "description", "verification", "documentId"] as const;

function readEntryForm(formData: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const f of FIELDS) {
    const v = formData.get(f);
    raw[f] = typeof v === "string" ? v : undefined;
  }
  return workHourSchema.safeParse(raw);
}

const newDocKind = z.enum(DocumentKind).catch("PAY_STUB");

function readNewDocument(formData: FormData): HoursWriteOptions["newDocument"] {
  const file = readFormFile(formData, "file");
  if (!file) return undefined;
  return { kind: newDocKind.parse(formData.get("documentKind") ?? "PAY_STUB"), file };
}

export async function createHourEntryAction(
  _prev: ActionResult<HourEntryActionData> | null,
  formData: FormData,
): Promise<ActionResult<HourEntryActionData>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = readEntryForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);
  const result = await createWorkHourEntry(user.id, parsed.data, { newDocument: readNewDocument(formData) });
  if (!result.ok) return fail(result.error, result.fieldErrors);
  revalidateHours();
  return ok({ message: result.message, entryId: result.entryId, downgraded: result.downgraded });
}

export async function updateHourEntryAction(
  _prev: ActionResult<HourEntryActionData> | null,
  formData: FormData,
): Promise<ActionResult<HourEntryActionData>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const id = entryIdSchema.safeParse({ id: formData.get("id") });
  if (!id.success) return fail("That entry was not found.");
  const parsed = readEntryForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);
  const result = await updateWorkHourEntry(user.id, id.data.id, parsed.data, { newDocument: readNewDocument(formData) });
  if (!result.ok) return fail(result.error, result.fieldErrors);
  revalidateHours();
  return ok({ message: result.message, entryId: result.entryId, downgraded: result.downgraded });
}

export async function deleteHourEntryAction(
  _prev: ActionResult<{ message: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const id = entryIdSchema.safeParse({ id: formData.get("id") });
  if (!id.success) return fail("That entry was not found.");
  const result = await deleteWorkHourEntry(user.id, id.data.id);
  if (!result.ok) return fail(result.error);
  revalidateHours();
  return ok({ message: result.message });
}
