import { SCOPES, apiError, apiJson, appBaseFor, authorizeExtension, preflight } from "@/lib/extension-api/http";
import { lookupMatches } from "@/lib/extension-api/lookup";
import { parseLookupQuery } from "@/lib/extension-api/schemas";

/**
 * GET /api/extension/lookup?url=&company=&title=&requisitionId=
 * 200 { matches: [{ id, companyName, positionTitle, status, appliedAt, postingUrl, detailUrl }] }
 * (top 3 with score ≥ 0.65) | 400 | 401 | 403 | 429.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await authorizeExtension(req, [SCOPES.applicationsRead]);
  if (!auth.ok) return auth.response;
  const parsed = parseLookupQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return apiError(req, 400, parsed.error);
  try {
    const matches = await lookupMatches(auth.principal.userId, parsed.data, appBaseFor(req));
    return apiJson(req, { matches });
  } catch (err) {
    console.error("extension lookup failed", err);
    return apiError(req, 500, "Lookup failed. Try again.");
  }
}

export function OPTIONS(req: Request): Response {
  return preflight(req);
}
