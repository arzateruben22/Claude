// Owner-only access: one passphrase (scrypt hash in OWNER_PASSWORD_HASH) and an HMAC-signed session cookie.
// The cookie itself lives in session.ts (Web Crypto only, so the proxy can use it).
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";


export function hashPassword(passphrase: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt:16384:8:1:${salt}:${hash}`;   // ":" not "$": .env files expand "$"
}

export function checkPassword(passphrase: string, stored = process.env.OWNER_PASSWORD_HASH || ""): boolean {
  const [alg, N, r, p, salt, hash] = stored.split(":");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const got = scryptSync(passphrase, salt, 32, { N: +N, r: +r, p: +p });
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

export { COOKIE, makeSession, verifySession } from "./session";
