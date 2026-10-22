import "server-only";
/**
 * PKCE + state handling for the OAuth start/callback round trip.
 *
 * The start route stores { sha256(state), code_verifier, session binding, history range, expiry } in a
 * short-lived cookie (HttpOnly, SameSite=Lax, scoped to /api/oauth/<provider>). The value is sealed
 * with AES-256-GCM, so the verifier is unreadable and the cookie cannot be forged or edited. The
 * callback accepts the response only when the returned `state` hashes to the stored hash and the
 * binding matches the *current* session (hashed comparisons, constant time).
 */
import { createHash, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, safeEqual, sha256 } from "@/lib/crypto";
import type { OAuthProviderKey } from "./providers";

export const OAUTH_STATE_TTL_SECONDS = 600;
const PURPOSE = "oauth-state";

export function oauthCookieName(key: OAuthProviderKey): string {
  return `cq_oauth_${key}`;
}

export function oauthCookiePath(key: OAuthProviderKey): string {
  return `/api/oauth/${key}`;
}

/** RFC 7636 verifier: 32 random bytes → 43 base64url characters. */
export function createCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createState(): string {
  return randomBytes(24).toString("base64url");
}

/** Binds the round trip to one signed-in session without storing the session token itself. */
export function sessionBinding(userId: string, sessionToken: string): string {
  return sha256(`oauth-binding:${userId}:${sha256(sessionToken)}`);
}

export type OAuthStatePayload = {
  v: 1;
  /** Provider key the flow was started for. */
  p: OAuthProviderKey;
  /** sha256(state). */
  sh: string;
  /** PKCE code verifier. */
  cv: string;
  /** sessionBinding(userId, sessionToken). */
  b: string;
  /** History range (days) chosen in the consent dialog. */
  d: number;
  /** Expiry (epoch ms). */
  exp: number;
};

export function sealOAuthState(payload: OAuthStatePayload): string {
  return encryptSecret(JSON.stringify(payload), PURPOSE);
}

export function openOAuthState(value: string | null | undefined): OAuthStatePayload | null {
  if (!value) return null;
  try {
    const p = JSON.parse(decryptSecret(value, PURPOSE)) as OAuthStatePayload;
    if (
      p?.v !== 1 ||
      (p.p !== "google" && p.p !== "microsoft") ||
      typeof p.sh !== "string" ||
      typeof p.cv !== "string" ||
      typeof p.b !== "string" ||
      typeof p.d !== "number" ||
      typeof p.exp !== "number"
    ) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function stateMatches(payload: OAuthStatePayload, returnedState: string | null | undefined): boolean {
  if (!returnedState) return false;
  return safeEqual(sha256(returnedState), payload.sh);
}

export function bindingMatches(payload: OAuthStatePayload, userId: string, sessionToken: string): boolean {
  return safeEqual(sessionBinding(userId, sessionToken), payload.b);
}
