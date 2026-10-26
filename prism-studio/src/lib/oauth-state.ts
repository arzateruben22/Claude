// The OAuth round trip's state: a random nonce, the PKCE verifier and which destination is being connected,
// sealed into a short-lived httpOnly cookie. The callback accepts only a state that matches it.
import { createHash, randomBytes } from "node:crypto";
import { seal, unseal } from "./crypto";

export const OAUTH_COOKIE = "prism_oauth";
export type OauthState = { state: string; verifier: string; destinationId: string; platform: string; iat: number };

export function newOauthState(destinationId: string, platform: string): { cookie: string; state: string; codeChallenge: string; verifier: string } {
  const state = randomBytes(24).toString("base64url"), verifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
  return { cookie: seal(JSON.stringify({ state, verifier, destinationId, platform, iat: Date.now() } satisfies OauthState)), state, codeChallenge, verifier };
}

export function readOauthState(cookie: string | undefined, state: string | null, platform: string, maxAgeMs = 15 * 60_000): OauthState | null {
  if (!cookie || !state) return null;
  try {
    const s = JSON.parse(unseal(cookie)) as OauthState;
    if (s.state !== state || s.platform !== platform || Date.now() - s.iat > maxAgeMs) return null;
    return s;
  } catch { return null; }
}

export const redirectUriFor = (origin: string, platform: string) => `${origin.replace(/\/$/, "")}/api/auth/${platform}/callback`;
