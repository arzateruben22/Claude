"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/rate-limit";
import { fail, type ActionResult } from "@/lib/action-result";
import { currentWeekStartKey, isWeekStartKey } from "./week";
import { getWeeklyReport, reportTimezone } from "./weekly";

/**
 * Generate (or regenerate) a weekly report. With no `weekStart` it generates the current week.
 * Regenerating a past week replaces its frozen snapshot with one computed from today's data.
 * On success it redirects to the report page.
 */
export async function generateWeeklyReportAction(_prev: ActionResult<{ weekStart: string }> | null, formData: FormData): Promise<ActionResult<{ weekStart: string }>> {
  const user = await requireUser();
  const rl = rateLimit(`reports-generate:${user.id}`, 20, 60_000);
  if (!rl.ok) return fail(`Too many report generations. Try again in ${rl.retryAfterSeconds} s.`);
  const raw = formData.get("weekStart");
  let weekStart: string;
  if (typeof raw === "string" && raw.trim() !== "") {
    if (!isWeekStartKey(raw.trim())) return fail("That isn't a valid week.");
    weekStart = raw.trim();
  } else {
    weekStart = currentWeekStartKey(await reportTimezone(user.id));
  }
  const result = await getWeeklyReport(user.id, weekStart, { regenerate: true });
  if (!result.ok) return fail(result.reason === "future_week" ? "That week hasn't started yet." : "That isn't a valid week.");
  revalidatePath("/analytics/reports", "layout");
  redirect(`/analytics/reports/${weekStart}`);
}
