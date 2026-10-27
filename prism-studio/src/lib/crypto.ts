// Sealing for secrets at rest: AES-256-GCM. Sealed values are "v1:<iv>:<tag>:<ciphertext>" (base64url). Secrets are
// never logged and never sent to the browser.
// - Platform tokens use INTEGRATIONS_KEY (64 hex chars) and nothing else: without it, Connect stays off.
// - A secret Prism makes for itself (the push signing key) uses INTEGRATIONS_KEY when it's set; on a box without it,
//   a key derived from SESSION_SECRET (HKDF-SHA256, salted by purpose), so it is still never stored in plain text.
//   The caller records which key sealed it (keyFor().source) and unseals with that one.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/** process.env, or a plain object in tests. */
export type Env = Record<string, string | undefined>;

function key(env: Env = process.env): Buffer {
  const hex = env.INTEGRATIONS_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("INTEGRATIONS_KEY must be 64 hex characters (openssl rand -hex 32)");
  return Buffer.from(hex, "hex");
}
const b64u = (b: Buffer) => b.toString("base64url");

export function sealWithKey(plain: string, k: Buffer): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${b64u(iv)}:${b64u(c.getAuthTag())}:${b64u(ct)}`;
}

export function unsealWithKey(sealed: string, k: Buffer): string {
  const [v, iv, tag, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("not a sealed value");
  const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

export function seal(plain: string, env: Env = process.env): string {
  return sealWithKey(plain, key(env));
}

export function unseal(sealed: string, env: Env = process.env): string {
  return unsealWithKey(sealed, key(env));
}

export const integrationsConfigured = (env: Env = process.env) => /^[0-9a-f]{64}$/i.test(env.INTEGRATIONS_KEY || "");

export type KeySource = "integrations" | "session";

/** The key from one source for `purpose`, or null when that source isn't configured. */
export function keyFrom(source: KeySource, purpose: string, env: Env = process.env): Buffer | null {
  if (source === "integrations") return integrationsConfigured(env) ? key(env) : null;
  const secret = env.SESSION_SECRET || "";
  if (secret.length < 32) return null;   // the same floor the session cookie enforces
  return Buffer.from(hkdfSync("sha256", secret, "prism-studio/seal", `prism-studio/${purpose}`, 32));
}

/** The key to seal a new `purpose` secret with: INTEGRATIONS_KEY when set, else derived from SESSION_SECRET; null when neither is. */
export function keyFor(purpose: string, env: Env = process.env): { source: KeySource; key: Buffer } | null {
  for (const source of ["integrations", "session"] as const) {
    const k = keyFrom(source, purpose, env);
    if (k) return { source, key: k };
  }
  return null;
}
