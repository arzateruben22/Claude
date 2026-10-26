// Everything one upload task needs, in one ZIP: the exact export's video, cover, caption, captions and notes.
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { isOwner } from "@/lib/owner";
import { resolveMedia } from "@/lib/media";
import { zipStream, type ZipEntry } from "@/lib/zip";
import { markHandedOff } from "@/domain/publications";
import { composePostText } from "@/domain/metadata";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ publicationId: string }> }) {
  if (!(await isOwner())) return new Response("sign in", { status: 401 });
  const { publicationId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(publicationId)) return new Response("not found", { status: 404 });
  const d = db();
  const [p] = await d.select().from(S.publications).where(eq(S.publications.id, publicationId));
  if (!p?.exportId) return new Response("not found", { status: 404 });
  const [x] = await d.select().from(S.platformExports).where(eq(S.platformExports.id, p.exportId));
  const [e] = await d.select().from(S.episodes).where(eq(S.episodes.id, p.episodeId));
  const [c] = await d.select().from(S.channels).where(eq(S.channels.id, e.channelId));
  const [dest] = await d.select().from(S.destinations).where(eq(S.destinations.id, p.destinationId));
  const base = `${c.slug}-${String(e.number).padStart(3, "0")}-${dest.platform}`;
  const video = resolveMedia(x.filePath), cover = x.coverPath ? resolveMedia(x.coverPath) : null;
  if (!video || !fs.existsSync(video)) return new Response("video missing", { status: 404 });
  const entries: ZipEntry[] = [{ name: `${base}.mp4`, path: video }];
  if (cover && fs.existsSync(cover)) entries.push({ name: `${base}-cover.jpg`, path: cover });
  const text = [dest.platform === "youtube" ? `TITLE\n${x.title}\n` : "", `CAPTION\n${composePostText(x)}\n`, `POST TO\n${dest.handle || dest.displayName || "(account not set up)"} on ${dest.platform}\n`, x.postingNotes ? `NOTES\n${x.postingNotes}\n` : ""].filter(Boolean).join("\n");
  entries.push({ name: `${base}-caption.txt`, data: Buffer.from(text, "utf8") });
  if (e.captionsSrt) entries.push({ name: `${base}.srt`, data: Buffer.from(e.captionsSrt, "utf8") });
  await markHandedOff(d, p.id);
  return new Response(zipStream(entries), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"`, "Cache-Control": "no-store" } });
}
