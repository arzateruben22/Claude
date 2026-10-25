// Media keys: "films:<path in the films repo>" (rendered episodes, read in place) or "media:<path>" (the studio's
// own storage root). Both resolve inside an allow-listed directory; anything else, or any escape, is refused.
import path from "node:path";

const FILMS_ROOT = () => path.resolve(/* turbopackIgnore: true */ process.env.FILMS_REPO_ROOT || "..");
const MEDIA_ROOT = () => path.resolve(/* turbopackIgnore: true */ process.env.MEDIA_ROOT || "./data/media");

export function resolveMedia(key: string): string | null {
  const m = /^(films|media):(.+)$/.exec(key);
  if (!m) return null;
  const base = m[1] === "films" ? path.join(FILMS_ROOT(), "films") : MEDIA_ROOT();
  const rel = m[1] === "films" ? m[2].replace(/^films\//, "") : m[2];
  const abs = path.resolve(base, rel);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  if (m[1] === "films" && !/\.(mp4|jpg|jpeg|png|webm|srt|vtt)$/i.test(abs)) return null;
  return abs;
}

export const mediaUrl = (key: string, download?: string) =>
  key ? `/api/media?k=${encodeURIComponent(key)}${download ? `&dl=${encodeURIComponent(download)}` : ""}` : "";

export const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".webm": "video/webm", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".srt": "application/x-subrip", ".vtt": "text/vtt", ".txt": "text/plain; charset=utf-8", ".zip": "application/zip",
};
