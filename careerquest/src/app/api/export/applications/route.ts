import { getSessionUser } from "@/lib/auth/session";
import { dateKeyInTz } from "@/lib/dates";
import { csvChunk, csvHeader, exportFileName } from "@/lib/analytics/csv";
import { parseAnalyticsFilters, searchParamsToRecord } from "@/lib/analytics/filters";
import { getUserTimezone, iterateExportRows } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/applications?<analytics filters>
 * Streams the signed-in user's applications as CSV, honoring exactly the filters the Analytics
 * page uses. Rows are fetched in batches so large trackers never sit fully in memory.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const filters = parseAnalyticsFilters(searchParamsToRecord(url.searchParams));
  const now = new Date();
  const timezone = await getUserTimezone(user.id);
  const fileName = exportFileName(dateKeyInTz(now, timezone));

  const encoder = new TextEncoder();
  const rows = iterateExportRows(user.id, filters, now);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(csvHeader()));
    },
    async pull(controller) {
      try {
        const next = await rows.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(csvChunk(next.value)));
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await rows.return(undefined);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
