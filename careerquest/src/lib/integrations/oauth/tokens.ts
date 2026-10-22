import "server-only";
/**
 * Token endpoint calls (code exchange, refresh, revoke) and account-email lookup, over an injected fetch.
 * Errors never include provider response bodies beyond the OAuth `error` code.
 */
import { z } from "zod";
import { IntegrationAuthError, IntegrationHttpError, type FetchLike } from "../adapters/types";
import { parseScopes, type OAuthClientConfig } from "./providers";

const REQUEST_TIMEOUT_MS = 20_000;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
  id_token: z.string().optional(),
});

const errorSchema = z.object({ error: z.string().max(100) }).passthrough();

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  /** Seconds until the access token expires (defaults to 3600 when the provider omits it). */
  expiresIn: number;
  scopes: string[];
  idToken: string | null;
};

async function postForm(fetchFn: FetchLike, url: string, form: Record<string, string>): Promise<Response> {
  try {
    return await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new IntegrationHttpError("Could not reach the sign-in provider.", 0);
  }
}

async function oauthErrorCode(res: Response): Promise<string | null> {
  try {
    const parsed = errorSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.error : null;
  } catch {
    return null;
  }
}

async function readTokenResponse(res: Response, context: "exchange" | "refresh"): Promise<TokenSet> {
  if (!res.ok) {
    const code = await oauthErrorCode(res);
    if (code === "invalid_grant" || code === "unauthorized_client" || code === "invalid_client") {
      throw new IntegrationAuthError(
        context === "refresh"
          ? "The saved authorization is no longer valid (revoked or expired); reconnect to resume syncing."
          : `The provider rejected the authorization code (${code}).`,
      );
    }
    throw new IntegrationHttpError(`The token endpoint answered HTTP ${res.status}${code ? ` (${code})` : ""}.`, res.status);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new IntegrationHttpError("The token endpoint returned a response that is not JSON.", res.status);
  }
  const parsed = tokenResponseSchema.safeParse(body);
  if (!parsed.success) throw new IntegrationHttpError("The token endpoint returned an unexpected response.", res.status);
  const t = parsed.data;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiresIn: t.expires_in ?? 3600,
    scopes: parseScopes(t.scope),
    idToken: t.id_token ?? null,
  };
}

/** Exchange an authorization code (with its PKCE verifier) for tokens. */
export async function exchangeCode(cfg: OAuthClientConfig, code: string, codeVerifier: string, fetchFn: FetchLike): Promise<TokenSet> {
  const form: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  };
  if (cfg.key === "microsoft") form.scope = cfg.scopes.join(" ");
  return readTokenResponse(await postForm(fetchFn, cfg.tokenUrl, form), "exchange");
}

/** Use a refresh token. Microsoft rotates refresh tokens (a new one is returned); Google usually does not. */
export async function refreshAccessToken(cfg: OAuthClientConfig, refreshToken: string, fetchFn: FetchLike): Promise<TokenSet> {
  const form: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  };
  if (cfg.key === "microsoft") form.scope = cfg.scopes.join(" ");
  return readTokenResponse(await postForm(fetchFn, cfg.tokenUrl, form), "refresh");
}

export type RevokeOutcome = "revoked" | "already_invalid" | "not_supported" | "failed";

/**
 * Revoke a token at the provider. Google's endpoint needs only the token (no client credentials);
 * Microsoft has no per-token revocation endpoint (pass null).
 */
export async function revokeToken(revokeUrl: string | null, token: string, fetchFn: FetchLike): Promise<RevokeOutcome> {
  if (!revokeUrl) return "not_supported";
  try {
    const res = await postForm(fetchFn, revokeUrl, { token });
    if (res.ok) return "revoked";
    // Google answers 400 invalid_token for tokens that are already revoked or expired.
    if (res.status === 400) return "already_invalid";
    return "failed";
  } catch {
    return "failed";
  }
}

/** Decode a JWT payload without verifying it. Only used on an id_token received directly from the token endpoint over TLS. */
function jwtPayload(jwt: string): Record<string, unknown> | null {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const EMAIL = z.email();

/**
 * The connected account's address. Google: the id_token's `email` claim (OIDC allows trusting an
 * id_token obtained directly from the token endpoint over TLS), falling back to the Gmail profile.
 * Microsoft: Graph /me (mail, else userPrincipalName).
 */
export async function fetchAccountEmail(cfg: OAuthClientConfig, tokens: TokenSet, fetchFn: FetchLike): Promise<string | null> {
  const clean = (v: unknown) => (typeof v === "string" && EMAIL.safeParse(v.trim()).success ? v.trim().toLowerCase() : null);
  if (cfg.key === "google") {
    const claims = tokens.idToken ? jwtPayload(tokens.idToken) : null;
    const fromToken = claims && claims.aud === cfg.clientId ? clean(claims.email) : null;
    if (fromToken) return fromToken;
    const res = await fetchFn("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => null);
    if (!res?.ok) return null;
    const body = (await res.json().catch(() => null)) as { emailAddress?: unknown } | null;
    return clean(body?.emailAddress);
  }
  const res = await fetchFn("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { mail?: unknown; userPrincipalName?: unknown } | null;
  return clean(body?.mail) ?? clean(body?.userPrincipalName);
}
