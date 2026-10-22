import { audit } from "@/lib/audit";
import { processCapture } from "@/lib/extension-api/captures";
import { SCOPES, apiError, apiJson, appBaseFor, authorizeExtension, preflight, readJsonBody } from "@/lib/extension-api/http";
import { EXTENSION_LIMITS, captureBodySchema, zodMessage } from "@/lib/extension-api/schemas";

/**
 * POST /api/extension/captures — see src/lib/extension-api/captures.ts for the rules.
 * 201 { capture: { id, status }, application: { id, status, detailUrl } | null, action }
 * | 400 | 401 | 403 | 404 (applicationId is not yours) | 413 | 415 | 429 { retryAfterSeconds }.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorizeExtension(req, [SCOPES.captureWrite]);
  if (!auth.ok) return auth.response;
  const { userId, tokenId } = auth.principal;

  const raw = await readJsonBody(req, EXTENSION_LIMITS.bodyBytes);
  if (!raw.ok) return apiError(req, raw.status, raw.error);
  const parsed = captureBodySchema.safeParse(raw.value);
  if (!parsed.success) return apiError(req, 400, zodMessage(parsed.error));
  const body = parsed.data;

  let outcome: Awaited<ReturnType<typeof processCapture>>;
  try {
    outcome = await processCapture({ userId, tokenId, appBase: appBaseFor(req) }, body);
  } catch (err) {
    console.error("extension capture failed", err);
    return apiError(req, 500, "The capture could not be saved. It will be retried.");
  }

  if (!outcome.ok) {
    await audit("extension.capture.rejected", {
      userId,
      entityType: "ApiToken",
      entityId: tokenId,
      metadata: { kind: body.kind, status: outcome.status },
    });
    return apiError(req, outcome.status, outcome.error);
  }

  // No URL, company, title or page text in the audit row — only what happened.
  await audit("extension.capture", {
    userId,
    entityType: "ExtensionCapture",
    entityId: outcome.body.capture.id,
    metadata: {
      tokenId,
      kind: body.kind,
      platform: body.platform ?? null,
      confidence: Math.round(body.confidence * 100) / 100,
      action: outcome.body.action,
      captureStatus: outcome.body.capture.status,
      attached: Boolean(body.applicationId),
      applicationId: outcome.body.application?.id ?? null,
    },
  });
  return apiJson(req, outcome.body, 201);
}

export function OPTIONS(req: Request): Response {
  return preflight(req);
}
