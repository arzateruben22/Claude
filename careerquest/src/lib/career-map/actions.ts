"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { clearMarkSchema, markNodeSchema } from "./schema";
import { CareerMapInputError, clearCareerNodeMark, setCareerNodeMark } from "./service";
import { MARK_LABELS } from "./labels";

export type CareerMapActionResult = ActionResult<{ message: string }>;

function field(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

function limited(userId: string): CareerMapActionResult | null {
  const r = rateLimit(`career-map:mark:${userId}`, 30, 60_000);
  return r.ok ? null : fail(`Too many changes. Try again in ${r.retryAfterSeconds} seconds.`);
}

function failure(err: unknown): CareerMapActionResult {
  if (err instanceof CareerMapInputError) return fail(err.message);
  console.error("career-map mark failed", err);
  return fail("Something went wrong saving that. Please try again.");
}

/** Save the user's own status for a stop ("marked by you"). */
export async function markCareerNodeAction(_prev: CareerMapActionResult | null, formData: FormData): Promise<CareerMapActionResult> {
  const user = await requireUser("/career-map");
  const limit = limited(user.id);
  if (limit) return limit;
  const parsed = markNodeSchema.safeParse({ nodeKey: field(formData, "nodeKey"), status: field(formData, "status"), notes: field(formData, "notes") });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const row = await setCareerNodeMark(user.id, parsed.data);
    revalidatePath("/career-map");
    return ok({ message: `Marked as ${MARK_LABELS[row.status]}. This changes your map only — it is not a credential.` });
  } catch (err) {
    return failure(err);
  }
}

/** Remove the user's mark so the stop follows their data again. */
export async function clearCareerNodeMarkAction(_prev: CareerMapActionResult | null, formData: FormData): Promise<CareerMapActionResult> {
  const user = await requireUser("/career-map");
  const limit = limited(user.id);
  if (limit) return limit;
  const parsed = clearMarkSchema.safeParse({ nodeKey: field(formData, "nodeKey") });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const removed = await clearCareerNodeMark(user.id, parsed.data.nodeKey);
    revalidatePath("/career-map");
    return ok({ message: removed ? "Your mark was removed. This stop follows your data again." : "There was no mark to remove." });
  } catch (err) {
    return failure(err);
  }
}
