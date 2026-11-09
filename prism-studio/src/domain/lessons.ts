// Lessons: a channel's rendered shorts, piled into one long-form 16:9 YouTube video (the films pipeline's
// kits/cinema/film/compilation.mjs does the rendering). An episode joins one lesson only (lesson_episodes.episode_id
// is unique). Approval binds the exact video file, title and description; any rebuild or edit needs a fresh one.
import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import type { DB, Tx } from "../db/client";
import { channels, episodes, jobs, lessonEpisodes, lessons, milestoneRules, achievementEvents, versions } from "../db/schema";
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
    // the next volume whose folder name no lesson of this channel holds yet (a pushed compilation may have taken one)
    const taken = new Set((await tx.select({ name: lessons.name }).from(lessons).where(eq(lessons.channelId, v.channelId))).map((r) => r.name));
    let k = Number(n) + 1;
    while (taken.has(`vol${String(k).padStart(2, "0")}`)) k++;
    const series = new Set(chosen.map((e) => e.seriesId));
    const [l] = await tx.insert(lessons).values({
      channelId: v.channelId, title, name: `vol${String(k).padStart(2, "0")}`, state: "render",
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

// ── compilations built outside Prism ───────────────────────────────────────
// A cloud session builds a long video with compilation.mjs and pushes its folder (scripts/push-media.mjs) into
// films/channels/<channel>/compilations/<name>/: <name>-16x9.mp4, thumbnail.jpg, chapters.txt, description.md, qa.json.
// The importer registers each one as the channel's lesson of that folder name (vol02, s2…), so it shows wherever
// lessons do. The folder name is the key: a lesson the owner already created under that name is reused, never doubled.

type Lesson = typeof lessons.$inferSelect;
export type CompilationBuild = { videoPath: string; videoSha256: string; thumbnailPath: string; chapters: string; description: string; qa: Record<string, unknown> };
export type CompilationRegistration = { lesson: Lesson; action: "created" | "updated" | "filled" | "unchanged" | "published"; linked: number };

const COMPILATION_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const plainChannelName = (name: string) => name.replace(/ \(name TBD\)$/, "");

/** YouTube chapters, one per line ("0:00 Title", "1:02:03 Title"), in order. */
export function parseChapters(text: string): { at: number; title: string }[] {
  const out: { at: number; title: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s+(\S.*?)\s*$/.exec(line);
    if (m) out.push({ at: Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]), title: m[4] });
  }
  return out;
}

/** The title a description.md opens with (compilation.mjs writes it on the first line; a markdown heading there
 *  counts too), or null when the first line isn't one (empty, a chapter, too long for YouTube). */
export function titleFromDescription(description: string): string | null {
  const first = description.split(/\r?\n/).map((x) => x.trim()).find(Boolean);
  if (!first) return null;
  const t = first.replace(/^#{1,6}\s+/, "").replace(/\*\*|__|\*/g, "").trim();
  return t.length >= 3 && t.length <= 100 && !parseChapters(t).length && !/^chapters:?$/i.test(t) ? t : null;
}

/** A pushed compilation's title when its description names none: "Skin Sense · Season 2" (s2), "… · Volume 2" (vol02). */
export function fallbackCompilationTitle(name: string, channelName: string) {
  const ch = plainChannelName(channelName);
  const s = /^s(?:eason)?[-_]?(\d+)$/i.exec(name), v = /^vol(?:ume)?[-_]?(\d+)$/i.exec(name);
  return (s ? `${ch} · Season ${Number(s[1])}` : v ? `${ch} · Volume ${Number(v[1])}` : `${ch} · ${name}`).slice(0, 100);
}

export const compilationTitle = (name: string, description: string, channelName: string) =>
  titleFromDescription(description) ?? fallbackCompilationTitle(name, channelName);

/** Link a lesson with no episodes yet to the episodes its chapters name, only when that is certain: every chapter
 *  names exactly one of the channel's (non-demo) episodes, no episode twice, none already in a lesson. Anything less
 *  leaves it unlinked (the screens show its chapters instead). Returns how many were linked. */
async function linkByChapters(tx: Tx, l: Lesson): Promise<number> {
  const chapters = parseChapters(l.chapters);
  if (!chapters.length) return 0;
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(lessonEpisodes).where(eq(lessonEpisodes.lessonId, l.id));
  if (Number(n)) return 0;
  const key = (s: string) => s.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const eps = await tx.select({ id: episodes.id, title: episodes.title, seriesId: episodes.seriesId }).from(episodes)
    .where(and(eq(episodes.channelId, l.channelId), eq(episodes.isDemo, false)));
  const used = new Set((await tx.select({ id: lessonEpisodes.episodeId }).from(lessonEpisodes)
    .innerJoin(episodes, eq(episodes.id, lessonEpisodes.episodeId)).where(eq(episodes.channelId, l.channelId))).map((r) => r.id));
  const picked: typeof eps = [];
  for (const c of chapters) {
    const m = eps.filter((e) => key(e.title) === key(c.title));
    if (m.length !== 1 || used.has(m[0].id) || picked.includes(m[0])) return 0;
    picked.push(m[0]);
  }
  const series = new Set(picked.map((e) => e.seriesId));
  try {
    // a savepoint: should the owner's own new lesson take one of these episodes meanwhile (episode_id is unique),
    // this lesson stays unlinked instead of failing its registration
    await tx.transaction(async (sp) => {
      await sp.insert(lessonEpisodes).values(picked.map((e, i) => ({ lessonId: l.id, episodeId: e.id, position: i + 1 })));
      await sp.update(lessons).set({
        outline: chapters.map((c, i) => ({ part: c.title, episodeId: picked[i].id })),
        ...(series.size === 1 && [...series][0] ? { seriesId: [...series][0] } : {}),
      }).where(eq(lessons.id, l.id));
    });
  } catch { return 0; }
  return picked.length;
}

/** Register or refresh a compilation built and pushed outside Prism as the channel's lesson named `name` (its
 *  folder). New: inserted as a built lesson (Ready for review, like recordLessonBuild leaves one). Known, with a
 *  different video (sha256): the new video, thumbnail, chapters and description replace the old, and its approval
 *  lapses as on any rebuild; the title stays (the owner may have edited it) unless it is still the folder's
 *  fallback. Known, same video: a no-op, except that files which were missing before (a thumbnail pushed later) are
 *  filled in; text already there is never overwritten. An uploaded (published) lesson is left as it is. */
export async function registerCompilation(d: DB, channelId: string, name: string, v: CompilationBuild): Promise<CompilationRegistration> {
  if (!COMPILATION_NAME.test(name)) throw new DomainError("name", `not a compilation folder name: ${name}`);
  if (!/^films:./.test(v.videoPath) || (v.thumbnailPath && !/^films:./.test(v.thumbnailPath))) throw new DomainError("path", "compilation media must be films: keys");
  if (!v.videoSha256) throw new DomainError("sha", "the video's sha256 is missing");
  return d.transaction(async (tx) => {
    // one registration per channel at a time, so two imports can't both insert the same name
    const [ch] = await tx.select().from(channels).where(eq(channels.id, channelId)).for("update");
    if (!ch) throw new DomainError("not_found", "channel not found");
    const [l] = await tx.select().from(lessons).where(and(eq(lessons.channelId, channelId), eq(lessons.name, name), eq(lessons.isDemo, false)))
      .orderBy(asc(lessons.isTestFixture), asc(lessons.createdAt)).limit(1);
    const fallback = fallbackCompilationTitle(name, ch.name), titled = titleFromDescription(v.description);

    if (!l) {
      const [row] = await tx.insert(lessons).values({
        channelId, name, title: titled ?? fallback, state: "ready_for_review", approvedHash: "", ...v,
        outline: parseChapters(v.chapters).map((c) => ({ part: c.title })),
      }).returning();
      const linked = await linkByChapters(tx, row);
      await audit(tx, "worker", "lesson.register", "lesson", row.id, { name, video: v.videoPath, sha256: v.videoSha256, linked, qa: v.qa });
      const [fresh] = await tx.select().from(lessons).where(eq(lessons.id, row.id));
      return { lesson: fresh, action: "created", linked };
    }
    if (l.state === "published") return { lesson: l, action: l.videoSha256 === v.videoSha256 ? "unchanged" : "published", linked: 0 };

    const keepTitle = !(titled && l.title === fallback);
    if (l.videoSha256 !== v.videoSha256) {
      // a new build (or the first one, for a lesson the owner created): exactly what recordLessonBuild does on a rebuild
      await tx.update(lessons).set({ ...v, ...(keepTitle ? {} : { title: titled! }), state: "ready_for_review", approvedHash: "", updatedAt: new Date() })
        .where(eq(lessons.id, l.id));
      // a build the worker would still try (it can't, without the films toolchain) is no longer needed
      await tx.update(jobs).set({ status: "cancelled" })
        .where(and(eq(jobs.type, "build_lesson"), eq(jobs.status, "queued"), sql`${jobs.payload}->>'lessonId' = ${l.id}`));
      const [row] = await tx.select().from(lessons).where(eq(lessons.id, l.id));
      const linked = await linkByChapters(tx, row);
      await audit(tx, "worker", "lesson.register", "lesson", l.id, {
        name, video: v.videoPath, sha256: v.videoSha256, previous: l.videoSha256 || null, approvalWithdrawn: !!l.approvedHash, linked, qa: v.qa,
      });
      const [fresh] = await tx.select().from(lessons).where(eq(lessons.id, l.id));
      return { lesson: fresh, action: "updated", linked };
    }

    // the same video: only what was missing before
    const fill: Partial<typeof lessons.$inferInsert> = {};
    if (!l.thumbnailPath && v.thumbnailPath) fill.thumbnailPath = v.thumbnailPath;
    if (!l.chapters && v.chapters) fill.chapters = v.chapters;
    if (!Object.keys(l.qa ?? {}).length && Object.keys(v.qa).length) fill.qa = v.qa;
    if (!l.description && v.description) {
      Object.assign(fill, { description: v.description, approvedHash: "" }, keepTitle ? {} : { title: titled! }, l.state === "approved" ? { state: "ready_for_review" as const } : {});
    }
    if (!Object.keys(fill).length) return { lesson: l, action: "unchanged", linked: 0 };
    await tx.update(lessons).set({ ...fill, updatedAt: new Date() }).where(eq(lessons.id, l.id));
    const [row] = await tx.select().from(lessons).where(eq(lessons.id, l.id));
    const linked = fill.chapters ? await linkByChapters(tx, row) : 0;
    await audit(tx, "worker", "lesson.register", "lesson", l.id, { name, filled: Object.keys(fill).filter((k) => k !== "approvedHash" && k !== "state"), linked });
    const [fresh] = await tx.select().from(lessons).where(eq(lessons.id, l.id));
    return { lesson: fresh, action: "filled", linked };
  });
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
