// Owner-only media: rendered videos, posters and captions, with HTTP Range support so phones can seek and
// stream. Only allow-listed keys resolve (see lib/media); downloads get a safe Content-Disposition.
import fs from "node:fs";
import path from "node:path";
import { isOwner } from "@/lib/owner";
import { MIME, resolveMedia } from "@/lib/media";
import { fileChunks, webStream } from "@/lib/zip";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await isOwner())) return new Response("sign in", { status: 401 });
  const url = new URL(req.url);
  const file = resolveMedia(url.searchParams.get("k") ?? "");
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("not found", { status: 404 });
  const size = fs.statSync(file).size, type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const dl = url.searchParams.get("dl");
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" };
  if (dl) headers["Content-Disposition"] = `attachment; filename="${dl.replace(/[^\w.-]/g, "_").slice(0, 120)}"`;
  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (range && !m) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  if (m) {
    let start = m[1] ? Number(m[1]) : NaN, end = m[2] ? Number(m[2]) : size - 1;
    if (Number.isNaN(start)) { start = Math.max(0, size - end); end = size - 1; }   // suffix range: the last N bytes
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const body = webStream(fileChunks(file, { start, end }));
    return new Response(body, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(webStream(fileChunks(file)), { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
