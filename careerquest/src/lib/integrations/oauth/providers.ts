/**
 * OAuth client configuration for the two mailbox providers. Pure: values come from the env object
 * passed in, never from process.env directly.
 *
 * Scope choices (least privilege that still works):
 * - Google: `openid email` identifies which account was connected. `gmail.readonly` is the narrowest
 *   Gmail scope that can read message bodies: `gmail.metadata` exposes only headers/labels and cannot
 *   be combined with the `q` search parameter we use to fetch job-related mail only, and every other
 *   Gmail scope (modify, compose, send, full access) can change the mailbox. Nothing is ever written.
 * - Microsoft: `Mail.Read` is the narrowest Graph scope that returns message bodies (`Mail.ReadBasic`
 *   excludes the body). `User.Read` returns the account's address; `offline_access` issues the
 *   refresh token needed for background syncs.
 */
import { appBaseUrl } from "../env";
import { oauthConfigured, type IntegrationEnv, type OAuthKey } from "../registry";

export type OAuthProviderKey = "google" | "microsoft";
export const OAUTH_PROVIDER_KEYS: readonly OAuthProviderKey[] = ["google", "microsoft"];

export const INTEGRATION_FOR: Record<OAuthProviderKey, OAuthKey> = { google: "GMAIL", microsoft: "OUTLOOK" };
export const OAUTH_KEY_FOR: Record<OAuthKey, OAuthProviderKey> = { GMAIL: "google", OUTLOOK: "microsoft" };

export const GOOGLE_GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_SCOPES = ["openid", "email", GOOGLE_GMAIL_SCOPE] as const;
export const MICROSOFT_SCOPES = ["offline_access", "Mail.Read", "User.Read"] as const;

export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export type OAuthClientConfig = {
  key: OAuthProviderKey;
  integration: OAuthKey;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Null when the provider has no per-token revocation endpoint (Microsoft). */
  revokeUrl: string | null;
  scopes: readonly string[];
  redirectUri: string;
  /** Extra authorization request parameters. */
  authParams: Record<string, string>;
};

const TENANT = /^[A-Za-z0-9.-]{1,100}$/;

export function microsoftTenant(env: IntegrationEnv): string {
  const t = env.MICROSOFT_TENANT?.trim();
  return t && TENANT.test(t) ? t : "common";
}

export function redirectUriFor(key: OAuthProviderKey, env: IntegrationEnv): string | null {
  const base = appBaseUrl(env);
  return base ? `${base}/api/oauth/${key}/callback` : null;
}

/** The client configuration, or null when the provider is not configured on this server. */
export function getOAuthConfig(key: OAuthProviderKey, env: IntegrationEnv): OAuthClientConfig | null {
  const integration = INTEGRATION_FOR[key];
  if (!oauthConfigured(integration, env)) return null;
  const redirectUri = redirectUriFor(key, env);
  if (!redirectUri) return null;
  if (key === "google") {
    return {
      key,
      integration,
      clientId: env.GOOGLE_CLIENT_ID!.trim(),
      clientSecret: env.GOOGLE_CLIENT_SECRET!.trim(),
      authorizeUrl: GOOGLE_AUTHORIZE_URL,
      tokenUrl: GOOGLE_TOKEN_URL,
      revokeUrl: GOOGLE_REVOKE_URL,
      scopes: GOOGLE_SCOPES,
      redirectUri,
      // offline + consent: always issue a refresh token for background sync.
      authParams: { access_type: "offline", prompt: "consent" },
    };
  }
  const tenant = microsoftTenant(env);
  return {
    key,
    integration,
    clientId: env.MICROSOFT_CLIENT_ID!.trim(),
    clientSecret: env.MICROSOFT_CLIENT_SECRET!.trim(),
    authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    revokeUrl: null,
    scopes: MICROSOFT_SCOPES,
    redirectUri,
    authParams: { response_mode: "query", prompt: "select_account" },
  };
}

/** Authorization-code + PKCE (S256) request URL. */
export function buildAuthorizationUrl(cfg: OAuthClientConfig, opts: { state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: cfg.scopes.join(" "),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    ...cfg.authParams,
  });
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

/** Scopes from a token response's space-separated `scope` field. */
export function parseScopes(scope: string | null | undefined): string[] {
  return (scope ?? "").split(/\s+/).filter(Boolean);
}

/**
 * Whether the mail-reading scope was actually granted. Google lets users untick individual scopes on
 * the consent screen; Microsoft may return resource-qualified names (https://graph.microsoft.com/Mail.Read).
 */
export function hasMailScope(key: OAuthProviderKey, granted: readonly string[]): boolean {
  if (key === "google") return granted.includes(GOOGLE_GMAIL_SCOPE);
  return granted.some((s) => /(^|\/)mail\.read$/i.test(s));
}
