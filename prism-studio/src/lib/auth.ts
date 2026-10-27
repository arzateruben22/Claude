// Owner-only access: one passphrase (scrypt hash in OWNER_PASSWORD_HASH) and an HMAC-signed session cookie.
// The cookie itself lives in session.ts (Web Crypto only, so the proxy can use it).
// Comparison is constant-time (timingSafeEqual on two 32-byte keys); sign-in uses the async form so a check
// doesn't block other requests, and src/domain/signin.ts limits how often it can be tried.
import { scrypt, scryptSync, randomBytes, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEYLEN = 32;

export function hashPassword(passphrase: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passphrase, salt, KEYLEN, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt:16384:8:1:${salt}:${hash}`;   // ":" not "$": .env files expand "$"
}

function parse(stored: string): { salt: string; want: Buffer; opts: ScryptOptions } | null {
  const [alg, N, r, p, salt, hash] = stored.split(":");
  if (alg !== "scrypt" || !salt || !/^[0-9a-f]{64}$/i.test(hash ?? "")) return null;
  const opts = { N: Number(N), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024 };
  if (![opts.N, opts.r, opts.p].every((n) => Number.isInteger(n) && n > 0)) return null;
  return { salt, want: Buffer.from(hash, "hex"), opts };
}

export function checkPassword(passphrase: string, stored = process.env.OWNER_PASSWORD_HASH || ""): boolean {
  const s = parse(stored);
  if (!s) return false;
  return timingSafeEqual(scryptSync(passphrase, s.salt, KEYLEN, s.opts), s.want);
}

export async function checkPasswordAsync(passphrase: string, stored = process.env.OWNER_PASSWORD_HASH || ""): Promise<boolean> {
  const s = parse(stored);
  if (!s) return false;
  const got = await new Promise<Buffer>((resolve, reject) => scrypt(passphrase, s.salt, KEYLEN, s.opts, (e, k) => (e ? reject(e) : resolve(k))));
  return timingSafeEqual(got, s.want);
}

export { COOKIE, makeSession, verifySession } from "./session";
