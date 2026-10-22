"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { markAllRead, markRead, savePrefs } from "./service";
import { DEFAULT_PREFS, type NotificationPrefs } from "./prefs";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (id.success) await markRead(user.id, id.data);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/notifications");
}

export async function saveNotificationPrefsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const prefs = {} as NotificationPrefs;
  for (const key of Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]) {
    prefs[key] = formData.get(key) === "on";
  }
  try {
    await savePrefs(user.id, prefs);
  } catch {
    return fail("Could not save your preferences. Please try again.");
  }
  revalidatePath("/notifications");
  return ok(undefined);
}
