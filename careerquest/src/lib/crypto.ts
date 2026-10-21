import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET must be set to a string of at least 16 characters.");
  }
  return s;
}

/** Derive a 32-byte key for AES-256-GCM from AUTH_SECRET (scoped by purpose). */
function deriveKey(purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}:${secret()}`).digest();
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Encrypt a secret (OAuth tokens etc.) for storage. Output: base64url(iv).base64url(tag).base64url(ct) */
export function encryptSecret(plain: string, purpose = "integration-token"): string {
  const key = deriveKey(purpose);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function decryptSecret(payload: string, purpose = "integration-token"): string {
  const [ivB, tagB, ctB] = payload.split(".");
  if (!ivB || !tagB || !ctB) throw new Error("Malformed encrypted payload");
  const key = deriveKey(purpose);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]);
  return pt.toString("utf8");
}
