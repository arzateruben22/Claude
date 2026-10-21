import { getSessionUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { buildAccountExport, exportFileName } from "@/lib/account/export";

export const dynamic = "force-dynamic";

/** GET /api/account/export — download every user-owned record as one JSON file (credentials excluded). */
export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in to export your data." }, { status: 401 });

  const limit = rateLimit(`account-export:${user.id}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return Response.json(
      { error: `Too many exports. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let payload: Awaited<ReturnType<typeof buildAccountExport>>;
  try {
    payload = await buildAccountExport(user.id);
  } catch (err) {
    console.error("account export failed", err);
    return Response.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
  await audit("account.export", { userId: user.id, metadata: { counts: payload.counts ?? null } });

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName()}"`,
      "Cache-Control": "no-store",
    },
  });
}
