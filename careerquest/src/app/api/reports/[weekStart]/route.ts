import { getSessionUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { reportFileName, weeklyReportCsv } from "@/lib/reports/csv";
import { isWeekStartKey } from "@/lib/reports/week";
import { getWeeklyReport } from "@/lib/reports/weekly";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/:weekStart?format=csv|json
 * Downloads the signed-in user's weekly report for the Monday `weekStart` (YYYY-MM-DD). Reports are
 * always looked up by the session's user id, so one user can never read another's report. The
 * freshness rule is the same as the page: the current week is recomputed, past weeks are served as
 * stored (computed and frozen on first access).
 */
export async function GET(request: Request, ctx: { params: Promise<{ weekStart: string }> }): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { weekStart } = await ctx.params;
  if (!isWeekStartKey(weekStart)) return Response.json({ error: "weekStart must be a Monday in YYYY-MM-DD format" }, { status: 400 });
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format !== "csv" && format !== "json") return Response.json({ error: "format must be csv or json" }, { status: 400 });

  const rl = rateLimit(`reports-download:${user.id}`, 60, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });

  const result = await getWeeklyReport(user.id, weekStart);
  if (!result.ok) return Response.json({ error: result.reason === "future_week" ? "That week hasn't started yet" : "Invalid week" }, { status: 404 });

  await audit("export.weekly_report", { userId: user.id, entityType: "WeeklyReport", entityId: result.id, metadata: { weekStart, format } });

  const headers = {
    "Content-Disposition": `attachment; filename="${reportFileName(weekStart, format)}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (format === "csv") return new Response(weeklyReportCsv(result.report), { status: 200, headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  return new Response(JSON.stringify(result.report, null, 2), { status: 200, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
