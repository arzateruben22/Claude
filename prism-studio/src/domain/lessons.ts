// Lessons: a channel's rendered shorts, piled into one long-form 16:9 YouTube video (the films pipeline's
// kits/cinema/film/compilation.mjs does the rendering). An episode joins one lesson only (lesson_episodes.episode_id
// is unique). Approval binds the exact video file, title and description; any rebuild or edit needs a fresh one.
import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { channels, episodes, lessonEpisodes, lessons, milestoneRules, achievementEvents, versions } from "../db/schema";
import { audit, type Conn, DomainError, settings, sha256 } from "./core";
import { enqueue } from "./jobs";
import { awardXp, refreshEvolution } from "./living";
import { parsePostUrl } from "./publications";

export const LESSON_MIN = 4, LESSON_MAX = 6;   // "every 4–6 shorts, a 5–10 minute compilation"

/** Episodes that can go into a new lesson: rendered (a current films: version), not demo, not in a lesson yet. */
export async function availableForLesson(c: Conn, channelId: string) {
  const used = c.select({ id: lessonEpisodes.episodeId }).from(lessonEpisodes);
  return c.selectDistinct({ id: episodes.id, number: episodes.number, title: episodes.title, filmsPath: episodes.filmsPath, seriesId: episodes.seriesId, durationS: episodes.durationS })
    .from(episodes).innerJoin(versions, and(eq(versions.episodeId, episodes.id), eq(versions.superseded, false)))
    .where(and(eq(episodes.channelId, channelId), eq(episodes.isDemo, false), notInArray(episodes.id, used), sql`${episodes.filmsPath} is not null`,
      sql`${versions.videoPath} like 'films:%'`))
    .orderBy(asc(episodes.number));
}

export function lessonHash(l: { videoSha256: string; title: string; description: string }) {
  return sha256(JSON.stringify([l.videoSha256, l.title, l.description]));
}

/** Create a lesson from 4–6 of a channel's rendered episodes (in episode order) and queue its build. */
export async function createLesson(d: DB, v: { channelId: string; episodeIds: string[]; title: string }) {
  const ids = [...new Set(v.episodeIds)];
  if (ids.length < LESSON_MIN || ids.length > LESSON_MAX) throw new DomainError("count", `Pick ${LESSON_MIN} to ${LESSON_MAX} episodes.`);
  const title = v.title.trim();
  if (title.length < 3 || title.length > 100) throw new DomainError("title", "Give it a title (3–100 characters; YouTube's limit is 100).");
  return d.transaction(async (tx) => {
    const avail = await availableForLesson(tx, v.channelId);
    const chosen = avail.filter((e) => ids.includes(e.id));
    if (chosen.length !== ids.length) throw new DomainError("unavailable", "Every episode must be rendered, from this channel, and not already in a lesson.");
    const [{ n }] = (await tx.execute(sql`select count(*)::int as n from lessons where channel_id = ${v.channelId} and not is_test_fixture`)).rows as { n: number }[];
    const series = new Set(chosen.map((e) => e.seriesId));
    const [l] = await tx.insert(lessons).values({
      channelId: v.channelId, title, name: `vol${String(Number(n) + 1).padStart(2, "0")}`, state: "render",
      seriesId: series.size === 1 ? [...series][0] : null,
      organizingQuestion: "", outline: chosen.map((e) => ({ part: e.title, episodeId: e.id, seconds: e.durationS ?? undefined })),
    }).returning();
    await tx.insert(lessonEpisodes).values(chosen.map((e, i) => ({ lessonId: l.id, episodeId: e.id, position: i + 1 })));
    await enqueue(tx, { type: "build_lesson", channelId: v.channelId, payload: { lessonId: l.id }, idempotencyKey: `build_lesson:${l.id}:1`, maxAttempts: 2 });
    await audit(tx, "owner", "lesson.create", "lesson", l.id, { episodes: chosen.map((e) => e.number), name: l.name });
    return l;
  });
}

/** What the worker needs to run compilation.mjs for a lesson. */
export async function lessonBuildPlan(c: Conn, lessonId: string) {
  const [l] = await c.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!l) throw new DomainError("not_found", "lesson not found");
  const [ch] = await c.select().from(channels).where(eq(channels.id, l.channelId));
  if (!ch.filmsPath) throw new DomainError("no_films", "this channel has no films pipeline folder");
  const parts = await c.select({ position: lessonEpisodes.position, filmsPath: episodes.filmsPath }).from(lessonEpisodes)
    .innerJoin(episodes, eq(episodes.id, lessonEpisodes.episodeId)).where(eq(lessonEpisodes.lessonId, lessonId)).orderBy(asc(lessonEpisodes.position));
  const epDirs = parts.map((p) => (p.filmsPath ?? "").split("/").pop()!).filter(Boolean);
  const args = ["kits/cinema/film/compilation.mjs", "--channel", ch.filmsPath, "--episodes", epDirs.join(","), "--title", l.title, "--name", l.name];
  return { lesson: l, channel: ch, args, outDir: `${ch.filmsPath}/compilations/${l.name}` };
}

/** Record a finished build: the video, thumbnail, chapters, description and QA. Any earlier approval lapses. */
export async function recordLessonBuild(d: DB, lessonId: string, v: { videoPath: string; videoSha256: string; thumbnailPath: string; chapters: string; description: string; qa: Record<string, unknown> }) {
  const [l] = await d.update(lessons).set({ ...v, state: "ready_for_review", approvedHash: "", updatedAt: new Date() }).where(eq(lessons.id, lessonId)).returning();
  await audit(d, "worker", "lesson.built", "lesson", lessonId, { video: v.videoPath, qa: v.qa });
  return l;
}

export async function approveLesson(d: DB, lessonId: string) {
  const [l] = await d.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!l) throw new DomainError("not_found", "lesson not found");
  if (!l.videoPath || !l.videoSha256) throw new DomainError("not_built", "The compilation hasn't been built yet.");
  const fails = Array.isArray(l.qa?.fails) ? (l.qa.fails as unknown[]).length : 0;
  if (fails) throw new DomainError("qa", `The build failed ${fails} quality check${fails > 1 ? "s" : ""}; rebuild it first.`);
  await d.update(lessons).set({ approvedHash: lessonHash(l), state: "approved", updatedAt: new Date() }).where(eq(lessons.id, lessonId));
  await audit(d, "owner", "lesson.approve", "lesson", lessonId, { hash: lessonHash(l) });
}

/** Edit the title or description: the approval no longer describes what would be posted. */
export async function editLesson(d: DB, lessonId: string, patch: { title?: string; description?: string }) {
  const [l] = await d.update(lessons).set({ ...patch, approvedHash: "", updatedAt: new Date() }).where(eq(lessons.id, lessonId)).returning();
  if (!l) throw new DomainError("not_found", "lesson not found");
  if (l.state === "approved") await d.update(lessons).set({ state: "ready_for_review" }).where(eq(lessons.id, lessonId));
  return l;
}

/** "Mark uploaded" for a lesson (YouTube only). Needs a live approval of exactly this video and text. */
export async function markLessonUploaded(d: DB, lessonId: string, v: { postUrl?: string }) {
  const [l] = await d.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!l) throw new DomainError("not_found", "lesson not found");
  if (l.isDemo || l.isTestFixture) throw new DomainError("demo", "a demo or test lesson can't be marked uploaded");
  if (!l.approvedHash || l.approvedHash !== lessonHash(l)) throw new DomainError("not_approved", "Approve this exact video, title and description first.");
  let postUrl = "";
  if (v.postUrl) {
    const p = parsePostUrl("youtube", v.postUrl);
    if (!p.ok) throw new DomainError("bad_url", p.error);
    postUrl = p.url;
  }
  await d.update(lessons).set({ state: "published", postUrl, reportedAt: new Date(), updatedAt: new Date() }).where(eq(lessons.id, lessonId));
  await awardXp(d, { channelId: l.channelId, kind: "lesson", amount: 150, key: `lesson:${l.id}` });
  // "The Long Form": the studio's first lesson that covers a whole series bundle
  const s = await settings(d);
  const [{ n }] = (await d.execute(sql`select count(*)::int as n from lesson_episodes where lesson_id = ${l.id}`)).rows as { n: number }[];
  const [rule] = await d.select().from(milestoneRules).where(eq(milestoneRules.key, "first_series_lesson"));
  if (rule?.enabled && l.seriesId && Number(n) >= s.lessonBundleSize) {
    const [ev] = await d.insert(achievementEvents).values({ ruleId: rule.id, scopeKey: "studio", channelId: l.channelId, evidence: { lessonId: l.id, postUrl } }).onConflictDoNothing().returning();
    if (ev && rule.xp) await awardXp(d, { channelId: l.channelId, kind: "achievement:first_series_lesson", amount: rule.xp, key: "achievement:first_series_lesson:studio:live" });
  }
  await audit(d, "owner", "lesson.mark_uploaded", "lesson", l.id, { postUrl });
  await refreshEvolution(d, l.channelId);
}

/** Give a lesson's episodes back (only before it is published) so they can join another one. */
export async function dissolveLesson(d: DB, lessonId: string) {
  const [l] = await d.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!l) throw new DomainError("not_found", "lesson not found");
  if (l.state === "published") throw new DomainError("published", "A published lesson keeps its episodes.");
  await d.delete(lessons).where(eq(lessons.id, lessonId));
  await audit(d, "owner", "lesson.dissolve", "lesson", lessonId, { name: l.name });
}
