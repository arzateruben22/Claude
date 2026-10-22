import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { exportHoursCsv } from "@/lib/academy/hours/service";
import { hoursCsvFileName } from "@/lib/academy/hours/csv";

/** CSV export of the signed-in user's work-hour log (self-reported and verified, labelled). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const rl = rateLimit(`hours-export:${user.id}`, 10, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many exports. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }
  const { csv, rows, todayKey } = await exportHoursCsv(user.id);
  await audit("hours.export", { userId: user.id, entityType: "WorkHourEntry", metadata: { rows } });
  return new Response(`﻿${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${hoursCsvFileName(todayKey)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
