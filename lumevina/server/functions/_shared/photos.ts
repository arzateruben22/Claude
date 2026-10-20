// Lumevina — photos a client adds to a question for Evelyn (functions/ask).
// The website shrinks each one to a JPEG before sending it (js/ask.js). They
// go in the private question-photos bucket (server/schema.sql); Evelyn's
// dashboard gets short-lived links to them (functions/studio → questions).

// deno-lint-ignore-file no-explicit-any
export const BUCKET = "question-photos";
const MAX_PHOTOS = 3;
const MAX_BYTES = 2_500_000;

export type Photo = { bytes: Uint8Array; base64: string };

/** Up to three JPEGs from "data:image/jpeg;base64,..." strings; anything else is dropped. */
export function readPhotos(list: unknown): Photo[] {
  const out: Photo[] = [];
  for (const v of Array.isArray(list) ? list.slice(0, MAX_PHOTOS) : []) {
    const base64 = String(v ?? "").replace(/^data:image\/jpeg;base64,/, "");
    if (!base64 || base64.length > MAX_BYTES * 1.4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) continue;
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)); } catch { continue; }
    if (bytes.length > MAX_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) continue;   // JPEG only
    out.push({ bytes, base64 });
  }
  return out;
}

/** Stores them under the question's id; returns the paths that saved. */
export async function savePhotos(db: any, questionId: string, photos: Photo[]): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const path = `${questionId}/${i + 1}.jpg`;
    const { error } = await db.storage.from(BUCKET).upload(path, photos[i].bytes, { contentType: "image/jpeg", upsert: true });
    if (error) console.error("photo", error); else paths.push(path);
  }
  return paths;
}

/** Links Evelyn's dashboard can show for an hour. */
export async function photoLinks(db: any, paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) { console.error("photo links", error); return []; }
  return (data ?? []).map((d: any) => d.signedUrl).filter(Boolean);
}
