import "server-only";
/**
 * OAuth start/callback orchestration, independent of Next's request objects so it can be tested
 * directly. The route handlers in src/app/api/oauth/* only read cookies/params and write the result.
 */
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { DEFAULT_HISTORY_DAYS, isHistoryDays, type IntegrationEnv } from "../registry";
import { saveOAuthConnection } from "../connections";
import type { FetchLike } from "../adapters/types";
import { buildAuthorizationUrl, getOAuthConfig, hasMailScope, type OAuthProviderKey } from "./providers";
import {
  OAUTH_STATE_TTL_SECONDS,
  bindingMatches,
  codeChallengeS256,
  createCodeVerifier,
  createState,
  oauthCookieName,
  oauthCookiePath,
  openOAuthState,
  sealOAuthState,
  sessionBinding,
  stateMatches,
} from "./state";
import { exchangeCode, fetchAccountEmail, revokeToken } from "./tokens";
import type { CallbackErrorCode } from "./messages";

export type { CallbackErrorCode } from "./messages";

export type OAuthCookie = { name: string; value: string; path: string; maxAge: number };

export type BeginOAuthInput = {
  key: OAuthProviderKey;
  userId: string;
  /** The raw session cookie value of the signed-in user (only its hash is bound). */
  sessionToken: string;
  historyDays: number;
  env: IntegrationEnv;
  now?: Date;
};

export type BeginOAuthResult = { ok: true; authorizeUrl: string; cookie: OAuthCookie } | { ok: false; code: "not_configured" };

export function beginOAuth(input: BeginOAuthInput): BeginOAuthResult {
  const cfg = getOAuthConfig(input.key, input.env);
  if (!cfg) return { ok: false, code: "not_configured" };
  const now = input.now ?? new Date();
  const state = createState();
  const verifier = createCodeVerifier();
  const value = sealOAuthState({
    v: 1,
    p: input.key,
    sh: sha256(state), // stateMatches() compares sha256(returned state) against this
    cv: verifier,
    b: sessionBinding(input.userId, input.sessionToken),
    d: isHistoryDays(input.historyDays) ? input.historyDays : DEFAULT_HISTORY_DAYS,
    exp: now.getTime() + OAUTH_STATE_TTL_SECONDS * 1000,
  });
  return {
    ok: true,
    authorizeUrl: buildAuthorizationUrl(cfg, { state, codeChallenge: codeChallengeS256(verifier) }),
    cookie: { name: oauthCookieName(input.key), value, path: oauthCookiePath(input.key), maxAge: OAUTH_STATE_TTL_SECONDS },
  };
}

export type CompleteOAuthInput = {
  key: OAuthProviderKey;
  params: URLSearchParams;
  cookieValue: string | null | undefined;
  userId: string;
  sessionToken: string;
  env: IntegrationEnv;
  fetch: FetchLike;
  now?: Date;
};

export type CompleteOAuthResult =
  | { ok: true; connectionId: string; accountEmail: string; provider: "GMAIL" | "OUTLOOK" }
  | { ok: false; code: CallbackErrorCode };

export async function completeOAuth(input: CompleteOAuthInput): Promise<CompleteOAuthResult> {
  const cfg = getOAuthConfig(input.key, input.env);
  if (!cfg) return { ok: false, code: "not_configured" };
  const now = input.now ?? new Date();

  const providerError = input.params.get("error");
  if (providerError) return { ok: false, code: providerError === "access_denied" ? "access_denied" : "provider_error" };

  const payload = openOAuthState(input.cookieValue);
  if (!payload) return { ok: false, code: "missing_state" };
  if (payload.p !== input.key || !stateMatches(payload, input.params.get("state"))) return { ok: false, code: "state_mismatch" };
  if (now.getTime() > payload.exp) return { ok: false, code: "expired" };
  if (!bindingMatches(payload, input.userId, input.sessionToken)) return { ok: false, code: "session_mismatch" };

  const code = input.params.get("code");
  if (!code || code.length > 4096) return { ok: false, code: "provider_error" };

  let tokens;
  try {
    tokens = await exchangeCode(cfg, code, payload.cv, input.fetch);
  } catch {
    return { ok: false, code: "exchange_failed" };
  }

  if (!hasMailScope(input.key, tokens.scopes)) {
    // Don't keep a grant we will not use.
    await revokeToken(cfg.revokeUrl, tokens.refreshToken ?? tokens.accessToken, input.fetch);
    return { ok: false, code: "scope_missing" };
  }

  const accountEmail = await fetchAccountEmail(cfg, tokens, input.fetch).catch(() => null);
  if (!accountEmail) {
    await revokeToken(cfg.revokeUrl, tokens.refreshToken ?? tokens.accessToken, input.fetch);
    return { ok: false, code: "no_email" };
  }

  const connection = await saveOAuthConnection(input.userId, {
    provider: cfg.integration,
    accountEmail,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    scopes: tokens.scopes,
    historyDays: payload.d,
    now,
  });
  await audit("integration.connected", {
    userId: input.userId,
    entityType: "IntegrationConnection",
    entityId: connection.id,
    metadata: { provider: cfg.integration, scopes: tokens.scopes, historyDays: payload.d, refreshToken: Boolean(tokens.refreshToken) },
  });
  return { ok: true, connectionId: connection.id, accountEmail, provider: cfg.integration };
}
