// Register a compilation that compilation.mjs already built as the channel's next lesson, without building it again:
// the lesson is created from the episodes, its queued build job is cancelled, and the existing video, thumbnail,
// chapters, description and QA are recorded, so it waits on Review like any built lesson. When these episodes already
// make a lesson (a rebuild, e.g. at a higher quality), the new build is recorded on it instead: its approval ends, its
// title stays, and a lesson already uploaded is left alone.
//   npm run lesson:register -- films/channels/physics ep01,ep02,ep03,ep04,ep05 "Forces you can see"
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import * as S from "../src/db/schema";
import { createLesson, lessonBuildPlan, recordLessonBuild } from "../src/domain/lessons";
import { loadEnv } from "./env";
loadEnv();

const ROOT = path.resolve(process.env.FILMS_REPO_ROOT || "..");
const [channelPath, epList, title] = process.argv.slice(2);
if (!channelPath || !epList || !title) { console.error('usage: npm run lesson:register -- films/channels/<ch> ep01,ep02,… "Title"'); process.exit(2); }

const d = db();
const [ch] = await d.select().from(S.channels).where(eq(S.channels.filmsPath, channelPath));
if (!ch) throw new Error(`no channel with filmsPath ${channelPath}`);
const eps = [];
for (const e of epList.split(",")) {
  const [row] = await d.select({ id: S.episodes.id }).from(S.episodes).where(and(eq(S.episodes.channelId, ch.id), eq(S.episodes.filmsPath, `${channelPath}/${e.trim()}`)));
  if (!row) throw new Error(`no imported episode at ${channelPath}/${e} (run npm run import:episodes first)`);
  eps.push(row.id);
}
const had = await d.select({ lessonId: S.lessonEpisodes.lessonId }).from(S.lessonEpisodes).where(inArray(S.lessonEpisodes.episodeId, eps));
const ids = [...new Set(had.map((x) => x.lessonId))];
let l: typeof S.lessons.$inferSelect, rebuilt = false;
if (ids.length === 1 && had.length === eps.length) {
  const [old] = await d.select().from(S.lessons).where(eq(S.lessons.id, ids[0]));
  const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(S.lessonEpisodes).where(eq(S.lessonEpisodes.lessonId, old.id));
  if (n !== eps.length) throw new Error(`${old.name} holds ${n} episodes, not these ${eps.length}; dissolve it first`);
  if (old.state === "published") throw new Error(`${old.name} is already uploaded; its build stays as it is`);
  l = old; rebuilt = true;
} else if (ids.length) {
  throw new Error("some of these episodes are already in another lesson; dissolve it first");
} else {
  l = await createLesson(d, { channelId: ch.id, episodeIds: eps, title });
}
const plan = await lessonBuildPlan(d, l.id);
const dir = path.join(ROOT, plan.outDir), video = path.join(dir, `${l.name}-16x9.mp4`);
if (!fs.existsSync(video)) throw new Error(`${l.name} has no build at ${plan.outDir} (build it with compilation.mjs --name ${l.name}, or let the worker do it)`);
await d.update(S.jobs).set({ status: "cancelled" })
  .where(and(eq(S.jobs.type, "build_lesson"), eq(S.jobs.status, "queued"), sql`${S.jobs.payload}->>'lessonId' = ${l.id}`));
const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : "");
await recordLessonBuild(d, l.id, {
  videoPath: `films:${plan.outDir}/${l.name}-16x9.mp4`, videoSha256: createHash("sha256").update(fs.readFileSync(video)).digest("hex"),
  thumbnailPath: fs.existsSync(path.join(dir, "thumbnail.jpg")) ? `films:${plan.outDir}/thumbnail.jpg` : "",
  chapters: read("chapters.txt"), description: read("description.md"), qa: read("qa.json") ? JSON.parse(read("qa.json")) : {},
});
console.log(`${ch.name} ${l.name} "${l.title}": ${eps.length} episodes, ${rebuilt ? "new build recorded" : "registered"} from ${plan.outDir} (ready for review)`);
await pool().end();
