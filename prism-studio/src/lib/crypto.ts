// Sealing for platform tokens at rest: AES-256-GCM with a key from INTEGRATIONS_KEY (64 hex chars). Sealed
// values are "v1:<iv>:<tag>:<ciphertext>" (base64url). Tokens are never logged and never sent to the browser.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(env = process.env): Buffer {
  const hex = env.INTEGRATIONS_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("INTEGRATIONS_KEY must be 64 hex characters (openssl rand -hex 32)");
  return Buffer.from(hex, "hex");
}
const b64u = (b: Buffer) => b.toString("base64url");

export function seal(plain: string, env = process.env): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(env), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${b64u(iv)}:${b64u(c.getAuthTag())}:${b64u(ct)}`;
}

export function unseal(sealed: string, env = process.env): string {
  const [v, iv, tag, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("not a sealed value");
  const d = createDecipheriv("aes-256-gcm", key(env), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

export const integrationsConfigured = (env = process.env) => /^[0-9a-f]{64}$/i.test(env.INTEGRATIONS_KEY || "");
