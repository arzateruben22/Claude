import { getSessionUser } from "@/lib/auth/session";
import { documentDownloadResponse } from "@/lib/documents/service";

/**
 * Owner-only document download. Signed out → 401; any document that is not the caller's (or does
 * not exist) → 404. Always served as an attachment with `nosniff` and a sandboxing CSP.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  const { id } = await params;
  return documentDownloadResponse(user.id, id);
}
