// Every post's file, checked: for each episode's current render, the YouTube export is the 1440×2560 version (when one
// was made) and TikTok and Instagram get the 1080×1920 master; every file exists, is the size it should be, and matches
// the hash its approval would bind; each built long video is 16:9 and passed its QA. Prints one line per episode and a
// summary; exits 1 when anything is wrong.
//   npm run media:check
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import * as S from "../src/db/schema";
import { resolveMedia } from "../src/lib/media";
import { loadEnv } from "./env";
loadEnv();

const size = (f: string) => {
  const [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f]).toString().trim().split(",").map(Number);
  return `${w}x${h}`;
};
const sha = (f: string) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");

const d = db();
const problems: string[] = [];
let ok = 0;
const chans = await d.select().from(S.channels).orderBy(asc(S.channels.sort));
for (const c of chans) {
  const rows = await d.select({ e: S.episodes, v: S.versions }).from(S.versions).innerJoin(S.episodes, eq(S.episodes.id, S.versions.episodeId))
    .where(and(eq(S.episodes.channelId, c.id), eq(S.versions.superseded, false), eq(S.episodes.isDemo, false))).orderBy(asc(S.episodes.number));
  for (const { e, v } of rows) {
    const xs = await d.select().from(S.platformExports).where(eq(S.platformExports.versionId, v.id));
    const line: string[] = [];
    const bad: string[] = [];
    for (const p of ["youtube", "tiktok", "instagram"] as const) {
      const x = xs.find((r) => r.platform === p);
      if (!x) { bad.push(`no ${p} export`); continue; }
      const f = resolveMedia(x.filePath);
      if (!f || !fs.existsSync(f)) { bad.push(`${p} file missing`); continue; }
      const dims = size(f), want = p === "youtube" && /-youtube\.mp4$/.test(f) ? "1440x2560" : "1080x1920";
      if (dims !== want) bad.push(`${p} is ${dims}, not ${want}`);
      if (p === "youtube" && !/-youtube\.mp4$/.test(f)) bad.push("youtube has no 1440p version");
      if (sha(f) !== x.fileSha256) bad.push(`${p} file differs from its recorded hash`);
      if (!x.coverPath || !resolveMedia(x.coverPath) || !fs.existsSync(resolveMedia(x.coverPath)!)) bad.push(`${p} cover missing`);
      line.push(`${p} ${dims}`);
    }
    if (!e.captionsSrt) bad.push("no captions");
    const name = `${c.name.replace(/ \(name TBD\)$/, "")} ${String(e.number).padStart(3, "0")} "${e.title}"`;
    if (bad.length) problems.push(`${name}: ${bad.join("; ")}`); else ok++;
    console.log(`${bad.length ? "✗" : "✓"} ${name} · ${line.join(" · ")} · ${e.state}${bad.length ? ` · ${bad.join("; ")}` : ""}`);
  }
  const lessons = await d.select().from(S.lessons).where(and(eq(S.lessons.channelId, c.id), eq(S.lessons.isTestFixture, false), ne(S.lessons.videoPath, "")));
  for (const l of lessons) {
    const f = resolveMedia(l.videoPath), bad: string[] = [];
    const dims = f && fs.existsSync(f) ? size(f) : "missing";
    if (dims === "missing") bad.push("file missing");
    else if (!["2560x1440", "1920x1080"].includes(dims)) bad.push(`${dims}, not 16:9`);
    if (f && fs.existsSync(f) && sha(f) !== l.videoSha256) bad.push("file differs from its recorded hash");
    const fails = Array.isArray((l.qa as { fails?: unknown[] })?.fails) ? (l.qa as { fails: unknown[] }).fails.length : 0;
    if (fails) bad.push(`${fails} QA failure${fails > 1 ? "s" : ""}`);
    const name = `${c.name.replace(/ \(name TBD\)$/, "")} ${l.name} "${l.title}" (long video)`;
    if (bad.length) problems.push(`${name}: ${bad.join("; ")}`); else ok++;
    console.log(`${bad.length ? "✗" : "✓"} ${name} · ${dims} · ${l.state}${bad.length ? ` · ${bad.join("; ")}` : ""}`);
  }
}
console.log(`\n${ok} ready, ${problems.length} with problems`);
for (const p of problems) console.log(`  ${p}`);
await pool().end();
process.exit(problems.length ? 1 : 0);
