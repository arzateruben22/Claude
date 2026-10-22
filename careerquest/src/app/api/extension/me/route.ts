import { SCOPES, apiJson, authorizeExtension, preflight } from "@/lib/extension-api/http";

/**
 * GET /api/extension/me — the extension's connection test.
 * 200 { userId, name, email, scopes } | 401 { error } | 403 { error } | 429 { error, retryAfterSeconds }.
 * Any token carrying an extension scope may call it: it only describes the token's own owner.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await authorizeExtension(req, [SCOPES.applicationsRead, SCOPES.captureWrite]);
  if (!auth.ok) return auth.response;
  const { userId, name, email, scopes } = auth.principal;
  return apiJson(req, { userId, name, email, scopes });
}

export function OPTIONS(req: Request): Response {
  return preflight(req);
}
