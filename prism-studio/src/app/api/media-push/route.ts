// Media push for a hosted studio (docs/LAUNCH-CHECKLIST.md), used by scripts/push-media.mjs from a cloud session.
// Token only (MEDIA_PUSH_TOKEN, sent as a bearer token); off when the token isn't set. No session cookie needed.
//   GET                      the files already here: { files: { "<films/channels/...>": [size, mtimeMs] } }
//   PUT  ?path=films/...     write one file (streamed, then renamed into place); x-mtime keeps its modified time,
//                            which the import compares (a cover or the 1440p version must be newer than the render)
//   POST                     queue "import rendered episodes" for the worker
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { enqueue } from "@/domain/jobs";
import { PUSH_MAX_BYTES, pushAuthorized, pushPath } from "@/domain/media-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = () => path.resolve(/* turbopackIgnore: true */ process.env.FILMS_REPO_ROOT || "..");
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const denied = () => json({ error: "media push is off or the token is wrong" }, 401);

function walk(dir: string, rel: string, out: Record<string, [number, number]>) {
  for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
    else if (e.isFile() && pushPath(r)) { const s = fs.statSync(path.join(dir, e.name)); out[r] = [s.size, Math.round(s.mtimeMs)]; }
  }
}

export async function GET(req: Request) {
  if (!pushAuthorized(req.headers.get("authorization"))) return denied();
  const files: Record<string, [number, number]> = {};
  walk(path.join(ROOT(), "films", "channels"), "films/channels", files);
  return json({ files });
}

export async function PUT(req: Request) {
  if (!pushAuthorized(req.headers.get("authorization"))) return denied();
  const rel = pushPath(new URL(req.url).searchParams.get("path") ?? "");
  if (!rel) return json({ error: "path not allowed" }, 400);
  const size = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(size) && size > PUSH_MAX_BYTES) return json({ error: "too large" }, 413);
  if (!req.body) return json({ error: "no body" }, 400);
  const root = ROOT(), file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep)) return json({ error: "path not allowed" }, 400);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(6).toString("hex")}.part`;
  let bytes = 0;
  const counted = Readable.fromWeb(req.body as import("node:stream/web").ReadableStream).on("data", (c: Buffer) => {
    bytes += c.length;
    if (bytes > PUSH_MAX_BYTES) counted.destroy(new Error("too large"));
  });
  try {
    await pipeline(counted, fs.createWriteStream(tmp));
    if (Number.isFinite(size) && size !== bytes) throw new Error(`incomplete: ${bytes} of ${size} bytes`);
    const mtime = Number(req.headers.get("x-mtime"));
    if (Number.isFinite(mtime) && mtime > 0) fs.utimesSync(tmp, new Date(), new Date(mtime));
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    return json({ error: e instanceof Error ? e.message : "write failed" }, bytes > PUSH_MAX_BYTES ? 413 : 500);
  }
  return json({ ok: true, path: rel, bytes });
}

export async function POST(req: Request) {
  if (!pushAuthorized(req.headers.get("authorization"))) return denied();
  const r = await enqueue(db(), { type: "import_episodes", idempotencyKey: `import_episodes:push:${new Date().toISOString().slice(0, 16)}` });
  return json({ queued: r.created, jobId: r.job?.id ?? null });
}
