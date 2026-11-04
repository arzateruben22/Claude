// Pushing finished films to a hosted studio that has no films checkout (docs/LAUNCH-CHECKLIST.md): a cloud session
// sends each file over https with a bearer token, into the same films/channels/... paths the importer and the "films:"
// media keys read. Only the files the studio uses may be written, only under films/channels, and only with the token.
import { createHash, timingSafeEqual } from "node:crypto";

const NAME = "[A-Za-z0-9][A-Za-z0-9._-]*";
const EXT = "(?:mp4|jpg|jpeg|png|srt|vtt|json|md|txt)";
// what the importer reads per episode (script, claims, film timings, the QA report, the finals and their covers) and
// the lesson compilations (one folder per volume)
const ALLOWED = new RegExp(
  `^films/channels/[a-z0-9-]+/(?:ep\\d{2}/(?:script\\.md|claims\\.json|film\\.json|build/qa-delivery\\.json|out/${NAME}\\.${EXT})` +
  `|compilations/(?:${NAME}/)?${NAME}\\.${EXT})$`,
);

/** A path relative to the films root ("films/channels/physics/ep01/out/x.mp4") that a push may write, or null. */
export function pushPath(rel: string): string | null {
  if (typeof rel !== "string" || rel.length > 300 || rel.includes("\\") || rel.split("/").some((s) => s === ".." || s.startsWith("."))) return null;
  return ALLOWED.test(rel) ? rel : null;
}

/** The push token from the environment: 32+ characters, or pushing is off. */
export function pushToken(env: Record<string, string | undefined> = process.env): string | null {
  const t = env.MEDIA_PUSH_TOKEN || "";
  return t.length >= 32 ? t : null;
}

/** "Bearer <token>" against MEDIA_PUSH_TOKEN, in constant time (both sides hashed to the same length first). */
export function pushAuthorized(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const want = pushToken(env), m = /^Bearer (\S+)$/.exec(header ?? "");
  if (!want || !m) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(m[1]), h(want));
}

/** The largest file a push accepts (the longest compilation is a few hundred MB). */
export const PUSH_MAX_BYTES = 2 * 1024 ** 3;
