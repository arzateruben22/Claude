// Short-lived, signed links to one media file, for platforms that fetch the video themselves (Instagram).
// The token carries the media key and an expiry, signed with SESSION_SECRET; nothing else is public.
import { createHmac, timingSafeEqual } from "node:crypto";

const secret = (env = process.env) => {
  const s = env.SESSION_SECRET || "";
  if (s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return s;
};
const sign = (payload: string, env?: NodeJS.ProcessEnv) => createHmac("sha256", secret(env)).update(payload).digest("base64url");

export function signPublicMedia(key: string, ttlSeconds = 3600, now = Date.now(), env?: NodeJS.ProcessEnv): string {
  const payload = Buffer.from(JSON.stringify({ k: key, exp: now + ttlSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, env)}`;
}

export function verifyPublicMedia(token: string, now = Date.now(), env?: NodeJS.ProcessEnv): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload, env)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { k?: string; exp?: number };
    return typeof p.k === "string" && typeof p.exp === "number" && p.exp > now ? p.k : null;
  } catch { return null; }
}

export const publicMediaUrl = (origin: string, key: string, ttlSeconds?: number) => `${origin.replace(/\/$/, "")}/api/public-media/${signPublicMedia(key, ttlSeconds)}`;
