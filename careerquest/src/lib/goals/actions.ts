"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { audit } from "@/lib/audit";
import { fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { targetsSchema, type SavedTargets } from "@/lib/goals/schema";

export type SaveTargetsResult = ActionResult<SavedTargets>;

function field(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/** Save the calculator's inputs as the user's profile targets. Scoped to the signed-in user only. */
export async function saveTargetsAction(_prev: SaveTargetsResult | null, formData: FormData): Promise<SaveTargetsResult> {
  const user = await requireUser("/dashboard/goals");
  const parsed = targetsSchema.safeParse({
    dailyApplicationTarget: field(formData, "dailyApplicationTarget"),
    workdaysPerWeek: field(formData, "workdaysPerWeek"),
    campaignLengthDays: field(formData, "campaignLengthDays"),
    weeklyApplicationTarget: field(formData, "weeklyApplicationTarget"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const { dailyApplicationTarget, workdaysPerWeek, campaignLengthDays } = parsed.data;
  const weeklyApplicationTarget = parsed.data.weeklyApplicationTarget ?? dailyApplicationTarget * workdaysPerWeek;
  const data: SavedTargets = { dailyApplicationTarget, workdaysPerWeek, campaignLengthDays, weeklyApplicationTarget };

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  await audit("goals.targets_updated", { userId: user.id, entityType: "UserProfile", entityId: user.id, metadata: data });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/goals");
  revalidatePath("/settings");
  return ok(data);
}
