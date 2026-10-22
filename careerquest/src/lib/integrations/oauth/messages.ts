/** User-facing outcomes of the OAuth round trip (pure; shown on /integrations after the redirect). */

export type CallbackErrorCode =
  | "not_configured"
  | "access_denied"
  | "provider_error"
  | "missing_state"
  | "state_mismatch"
  | "expired"
  | "session_mismatch"
  | "exchange_failed"
  | "scope_missing"
  | "no_email";

export type OAuthErrorCode = CallbackErrorCode | "rate_limited";

export const OAUTH_ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
  not_configured: "This provider is not configured on the server.",
  access_denied: "You cancelled the connection, so nothing was connected.",
  provider_error: "The provider reported an error and nothing was connected. Please try again.",
  missing_state: "The sign-in attempt expired or was started in another browser. Please start again.",
  state_mismatch: "The sign-in response did not match the request, so it was rejected. Please start again.",
  expired: "The sign-in attempt took longer than 10 minutes. Please start again.",
  session_mismatch: "The sign-in was started from a different session, so it was rejected. Please start again.",
  exchange_failed: "The provider did not accept the authorization. Please try again.",
  scope_missing: "Read access to your mail was not granted, so nothing was connected. Allow mail access to connect.",
  no_email: "The provider did not tell us which account was connected, so nothing was saved.",
  rate_limited: "Too many connection attempts. Wait a few minutes and try again.",
};

export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return Object.hasOwn(OAUTH_ERROR_MESSAGES, code) ? OAUTH_ERROR_MESSAGES[code as OAuthErrorCode] : "The connection did not complete. Please try again.";
}

