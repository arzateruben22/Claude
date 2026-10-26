// A signed, expiring link to one media file, for a platform that fetches the video itself (Instagram).
// Public by design (the proxy opens this path): the token is the only key, and it names one file for a few hours.
import fs from "node:fs";
import path from "node:path";
import { verifyPublicMedia } from "@/lib/public-media";
import { MIME, resolveMedia } from "@/lib/media";
import { fileChunks, webStream } from "@/lib/zip";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const key = verifyPublicMedia((await params).token);
  const file = key ? resolveMedia(key) : null;
  if (!file || !fs.existsSync(file) || !/\.(mp4|jpg|jpeg)$/i.test(file)) return new Response("not found", { status: 404 });
  const size = fs.statSync(file).size, type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m) {
    let start = m[1] ? Number(m[1]) : NaN, end = m[2] ? Number(m[2]) : size - 1;
    if (Number.isNaN(start)) { start = Math.max(0, size - end); end = size - 1; }
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(webStream(fileChunks(file, { start, end })), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  if (req.method === "HEAD") return new Response(null, { headers: { ...headers, "Content-Length": String(size) } });
  return new Response(webStream(fileChunks(file)), { headers: { ...headers, "Content-Length": String(size) } });
}
export const HEAD = GET;
