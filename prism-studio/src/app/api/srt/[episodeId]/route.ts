// The episode's captions as SubRip, from the same word timings as the burned-in captions.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { isOwner } from "@/lib/owner";

export async function GET(_: Request, { params }: { params: Promise<{ episodeId: string }> }) {
  if (!(await isOwner())) return new Response("sign in", { status: 401 });
  const { episodeId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(episodeId)) return new Response("not found", { status: 404 });
  const [e] = await db().select().from(S.episodes).where(eq(S.episodes.id, episodeId));
  if (!e?.captionsSrt) return new Response("no captions", { status: 404 });
  const [c] = await db().select().from(S.channels).where(eq(S.channels.id, e.channelId));
  return new Response(e.captionsSrt, { headers: { "Content-Type": "application/x-subrip; charset=utf-8", "Content-Disposition": `attachment; filename="${c.slug}-${String(e.number).padStart(3, "0")}.srt"` } });
}
