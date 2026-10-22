import "server-only";
/**
 * Shared HTTP plumbing for `/api/extension/*`: JSON responses with CORS headers, the preflight
 * answer, bearer authentication + scope check + per-token rate limit.
 *
 * Every response is JSON; errors are `{ error: string }` (429 adds `retryAfterSeconds`).
 */
import { prisma } from "@/lib/db";
import { authenticateBearer, hasScope } from "@/lib/auth/api-token";
import { rateLimit } from "@/lib/rate-limit";
import { appBaseFromEnv, corsHeaders } from "./cors";

export const EXTENSION_RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const;

export const SCOPES = {
  captureWrite: "capture:write",
  applicationsRead: "applications:read",
} as const;

function appUrlEnv(): string | undefined {
  return process.env.APP_URL;
}

/** APP_URL (preferred, stable behind proxies) or the request's own origin. */
export function appBaseFor(req: Request): string {
  return appBaseFromEnv(appUrlEnv()) ?? new URL(req.url).origin;
}

export function apiJson(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(req.headers.get("origin"), appUrlEnv()),
    ...extra,
  });
  return new Response(JSON.stringify(body), { status, headers });
}

export function apiError(req: Request, status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return apiJson(req, { error, ...extra }, status, headers);
}

/** OPTIONS preflight: 204, CORS headers only for chrome-extension:// origins and the APP_URL origin. */
export function preflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: new Headers({ ...corsHeaders(req.headers.get("origin"), appUrlEnv(), { preflight: true }), "Cache-Control": "no-store" }),
  });
}

export type ExtensionPrincipal = {
  userId: string;
  tokenId: string;
  scopes: string[];
  name: string;
  email: string;
};

export type AuthorizeResult = { ok: true; principal: ExtensionPrincipal } | { ok: false; response: Response };

const UNAUTHORIZED = "Missing, invalid or revoked token. Create one in CareerQuest → Settings → Developer tokens.";

/**
 * Bearer token → principal. 401 for a missing/invalid/revoked/expired token or a deleted account,
 * 429 once the token exceeded 60 requests in the last minute, 403 when the token has none of
 * `anyOfScopes`.
 */
export async function authorizeExtension(req: Request, anyOfScopes: readonly string[]): Promise<AuthorizeResult> {
  const token = await authenticateBearer(req.headers.get("authorization"));
  if (!token) {
    return { ok: false, response: apiError(req, 401, UNAUTHORIZED, {}, { "WWW-Authenticate": 'Bearer realm="careerquest"' }) };
  }
  const limited = rateLimit(`extension-api:${token.tokenId}`, EXTENSION_RATE_LIMIT.limit, EXTENSION_RATE_LIMIT.windowMs);
  if (!limited.ok) {
    return {
      ok: false,
      response: apiError(
        req,
        429,
        "Too many requests from this token. Try again shortly.",
        { retryAfterSeconds: limited.retryAfterSeconds },
        { "Retry-After": String(limited.retryAfterSeconds) },
      ),
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: token.userId },
    select: { id: true, name: true, email: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    return { ok: false, response: apiError(req, 401, UNAUTHORIZED, {}, { "WWW-Authenticate": 'Bearer realm="careerquest"' }) };
  }
  const principal: ExtensionPrincipal = { ...token, name: user.name, email: user.email };
  if (!anyOfScopes.some((s) => hasScope(token, s))) {
    return {
      ok: false,
      response: apiError(req, 403, `This token does not have the ${anyOfScopes.map((s) => `"${s}"`).join(" or ")} scope.`),
    };
  }
  return { ok: true, principal };
}

/** Read a JSON body with a byte cap. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; status: number; error: string }> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413, error: `Request body is larger than ${maxBytes} bytes.` };
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type.trim())) return { ok: false, status: 415, error: "Content-Type must be application/json." };
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, status: 400, error: "Could not read the request body." };
  }
  if (new TextEncoder().encode(text).length > maxBytes) return { ok: false, status: 413, error: `Request body is larger than ${maxBytes} bytes.` };
  if (!text.trim()) return { ok: false, status: 400, error: "Request body is empty." };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "Request body is not valid JSON." };
  }
}
