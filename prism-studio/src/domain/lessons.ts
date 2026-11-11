// Lessons: a channel's rendered shorts, piled into one long-form 16:9 YouTube video (the films pipeline's
// kits/cinema/film/compilation.mjs does the rendering). An episode joins one lesson only (lesson_episodes.episode_id
// is unique). The owner posts a long video on YouTube by hand and presses "Uploaded on YouTube" (markLessonUploaded,
// undoable); no approval is needed. A recorded approval (approveLesson, no longer in the UI) still lapses on any rebuild or edit.
import { and, asc, eq, ne, notInArray, sql } from "drizzle-orm";
import type { DB, Tx } from "../db/client";
import { channels, episodes, jobs, lessonEpisodes, lessons, milestoneRules, achievementEvents, versions } from "../db/schema";
import { audit, type Conn, DomainError, settings, sha256 } from "./core";
import { enqueue } from "./jobs";
import { awardXp, refreshEvolution } from "./living";
import { parsePostUrl } from "./publications";
import { packagingTitle, type Packaging } from "./packaging";
import { onWorkingSeason, seasonArchive } from "./season-archive";

export const LESSON_MIN = 4, LESSON_MAX = 8;   // "every 4–6 shorts, a 5–10 minute compilation"; a season film has 8 parts

/** Episodes that can go into a new lesson: rendered (a current films: version), not demo, not in a lesson yet, and
 *  not in an archived (uploaded) season (src/domain/season-archive.ts). */
export async function availableForLesson(c: Conn, channelId: string) {
  const used = c.select({ id: lessonEpisodes.episodeId }).from(lessonEpisodes);
  const archive = await seasonArchive(c);
  return c.selectDistinct({ id: episodes.id, number: episodes.number, title: episodes.title, filmsPath: episodes.filmsPath, seriesId: episodes.seriesId, durationS: episodes.durationS })
    .from(episodes).innerJoin(versions, and(eq(versions.episodeId, episodes.id), eq(versions.superseded, false)))
    .where(and(eq(episodes.channelId, channelId), eq(episodes.isDemo, false), notInArray(episodes.id, used), sql`${episodes.filmsPath} is not null`,
      sql`${versions.videoPath} like 'films:%'`, onWorkingSeason(archive, episodes.seasonId)))
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
  if (ch.archivedAt) throw new DomainError("archived", "this channel is archived: restore it in Settings to build its lessons");
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
export type CompilationBuild = {
  videoPath: string; videoSha256: string; thumbnailPath: string; chapters: string; description: string; qa: Record<string, unknown>;
  /** the folder's packaging.json (src/domain/packaging.ts); undefined when there is none, or none usable: what's stored stays */
  packaging?: Packaging;
};
/** created: new. updated: a new video. filled: the same video, files that were missing are added. refreshed: the same
 *  video, a corrected chapters.txt or description.md picked up, or its parts linked on a retry. */
export type CompilationRegistration = {
  lesson: Lesson; action: "created" | "updated" | "filled" | "refreshed" | "unchanged" | "published"; linked: number;
  /** what the importer should say about this folder (an owner's edit kept over a changed file) */
  notes?: string[];
};

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

const linkedCount = async (tx: Tx, lessonId: string) =>
  Number((await tx.select({ n: sql<number>`count(*)::int` }).from(lessonEpisodes).where(eq(lessonEpisodes.lessonId, lessonId)))[0].n);

/** Link a lesson with no episodes yet to the episodes its chapters name, only when that is certain: every chapter
 *  names exactly one of the channel's (non-demo) episodes by its title (case, *stars* and spacing aside), no episode
 *  twice, none already in a lesson. Anything less leaves it unlinked (the screens show its chapters instead). A retry
 *  (`retry`: an existing lesson, same video) never links an uploaded (archived) season's episodes, so an import never
 *  brings a finished season back. Returns how many were linked. */
async function linkByChapters(tx: Tx, l: Lesson, o: { retry?: boolean } = {}): Promise<number> {
  const chapters = parseChapters(l.chapters);
  if (!chapters.length) return 0;
  if (await linkedCount(tx, l.id)) return 0;
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
  if (o.retry) {
    const archive = await seasonArchive(tx);
    if (picked.some((e) => archive.episodeIds.has(e.id))) return 0;
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
 *  lapses as on any rebuild. Known, same video: files that were missing before (a thumbnail pushed later) are filled in;
 *  a changed chapters.txt replaces the chapters (nobody edits them in Prism); a changed description.md replaces the
 *  description only while the stored text is still what the importer wrote (importedDescriptionSha), so the owner's own
 *  edit is kept; and a lesson with no parts linked yet tries again (the parts may have arrived or been retitled since).
 *  A missing file never clears what is stored. The title follows the description's title line only while nobody chose
 *  it (it is still the folder's fallback or the old description's title line, and not the packaging winner). An uploaded
 *  (published) lesson is left as it is.
 *  Packaging: a new or changed packaging.json is stored; a new or changed winner title becomes the title (the YouTube
 *  title is exactly the winner title; the approval lapses). The same packaging again leaves the owner's edits alone. */
export async function registerCompilation(d: DB, channelId: string, name: string, input: CompilationBuild): Promise<CompilationRegistration> {
  const { packaging, ...v } = input;
  if (!COMPILATION_NAME.test(name)) throw new DomainError("name", `not a compilation folder name: ${name}`);
  if (!/^films:./.test(v.videoPath) || (v.thumbnailPath && !/^films:./.test(v.thumbnailPath))) throw new DomainError("path", "compilation media must be films: keys");
  if (!v.videoSha256) throw new DomainError("sha", "the video's sha256 is missing");
  return d.transaction(async (tx) => {
    // one registration per channel at a time, so two imports can't both insert the same name
    const [ch] = await tx.select().from(channels).where(eq(channels.id, channelId)).for("update");
    if (!ch) throw new DomainError("not_found", "channel not found");
    if (ch.archivedAt) throw new DomainError("archived", "this channel is archived: its compilations are not registered");
    const [l] = await tx.select().from(lessons).where(and(eq(lessons.channelId, channelId), eq(lessons.name, name), eq(lessons.isDemo, false)))
      .orderBy(asc(lessons.isTestFixture), asc(lessons.createdAt)).limit(1);
    const fallback = fallbackCompilationTitle(name, ch.name), titled = titleFromDescription(v.description);
    const pkgTitle = packagingTitle(packaging);
    const descSha = v.description ? sha256(v.description) : "";

    if (!l) {
      const [row] = await tx.insert(lessons).values({
        channelId, name, title: pkgTitle ?? titled ?? fallback, state: "ready_for_review", approvedHash: "", ...v, packaging: packaging ?? null,
        outline: parseChapters(v.chapters).map((c) => ({ part: c.title })), importedDescriptionSha: descSha,
      }).returning();
      const linked = await linkByChapters(tx, row);
      await audit(tx, "worker", "lesson.register", "lesson", row.id, { name, video: v.videoPath, sha256: v.videoSha256, linked, qa: v.qa });
      const [fresh] = await tx.select().from(lessons).where(eq(lessons.id, row.id));
      return { lesson: fresh, action: "created", linked };
    }
    if (l.state === "published") return { lesson: l, action: l.videoSha256 === v.videoSha256 ? "unchanged" : "published", linked: 0 };

    // the title follows the description's title line while nobody chose it
    const oldTitled = titleFromDescription(l.description);
    const derivedTitle = l.title !== packagingTitle(l.packaging) && (l.title === fallback || (!!oldTitled && l.title === oldTitled));
    const keepTitle = !(titled && titled !== l.title && derivedTitle);
    // packaging: stored when it changed; a new winner title replaces the title (and so ends the approval)
    const pkgChanged = !!packaging && JSON.stringify(packaging) !== JSON.stringify(l.packaging ?? null);
    const pkgRetitle = pkgChanged && !!pkgTitle && pkgTitle !== packagingTitle(l.packaging) && pkgTitle !== l.title;
    const pkgPatch: Partial<typeof lessons.$inferInsert> = pkgChanged ? { packaging, ...(pkgRetitle ? { title: pkgTitle! } : {}) } : {};
    if (l.videoSha256 !== v.videoSha256) {
      // a new build (or the first one, for a lesson the owner created): exactly what recordLessonBuild does on a rebuild
      await tx.update(lessons).set({ ...v, ...(keepTitle ? {} : { title: titled! }), ...pkgPatch, importedDescriptionSha: descSha, state: "ready_for_review", approvedHash: "", updatedAt: new Date() })
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

    // the same video: what was missing, what was corrected, and the parts' links
    const fill: Partial<typeof lessons.$inferInsert> = {}, notes: string[] = [];
    let refreshed = false;
    const unlinked = !(await linkedCount(tx, l.id));
    if (!l.thumbnailPath && v.thumbnailPath) fill.thumbnailPath = v.thumbnailPath;
    if (!Object.keys(l.qa ?? {}).length && Object.keys(v.qa).length) fill.qa = v.qa;
    if (v.chapters && v.chapters !== l.chapters) {
      fill.chapters = v.chapters;
      if (l.chapters) refreshed = true;
      // an unlinked lesson's outline is its chapters (as on creation); a linked one keeps its parts
      if (unlinked) fill.outline = parseChapters(v.chapters).map((c) => ({ part: c.title }));
    }
    if (v.description && v.description !== l.description) {
      // the stored text is what the importer wrote (or nothing yet): the file wins. Otherwise the owner edited it in Prism,
      // and their text stays. A lesson from before this record ("") counts as edited unless its text is empty.
      const importerText = !l.description || (!!l.importedDescriptionSha && sha256(l.description) === l.importedDescriptionSha);
      if (importerText) {
        if (l.description) refreshed = true;
        Object.assign(fill, { description: v.description, approvedHash: "" }, keepTitle ? {} : { title: titled! }, l.state === "approved" ? { state: "ready_for_review" as const } : {});
      } else if (descSha !== l.importedDescriptionSha) {
        notes.push("description.md changed, but the description was edited in Prism: kept the edited text");
      }
    }
    Object.assign(fill, pkgPatch, pkgRetitle ? { approvedHash: "", ...(l.state === "approved" ? { state: "ready_for_review" as const } : {}) } : {});
    // the file as last read, so the next change is told apart from an edit (a bookkeeping write: no updatedAt, no audit)
    const record = descSha && descSha !== l.importedDescriptionSha ? { importedDescriptionSha: descSha } : {};
    if (Object.keys(fill).length) await tx.update(lessons).set({ ...fill, ...record, updatedAt: new Date() }).where(eq(lessons.id, l.id));
    else if (Object.keys(record).length) await tx.update(lessons).set(record).where(eq(lessons.id, l.id));
    const [row] = await tx.select().from(lessons).where(eq(lessons.id, l.id));
    const linked = unlinked ? await linkByChapters(tx, row, { retry: true }) : 0;
    if (!Object.keys(fill).length && !linked) return { lesson: row, action: "unchanged", linked: 0, notes };
    await audit(tx, "worker", "lesson.register", "lesson", l.id, { name, filled: Object.keys(fill).filter((k) => k !== "approvedHash" && k !== "state"), linked, notes });
    const [fresh] = await tx.select().from(lessons).where(eq(lessons.id, l.id));
    return { lesson: fresh, action: refreshed || (linked && !Object.keys(fill).length) ? "refreshed" : "filled", linked, notes };
  });
}

/** Approval of exactly this video, title and description. No longer a step in the UI and nothing requires it (the owner
 *  dropped approvals on 9 Nov 2026; "Uploaded on YouTube" needs none); kept for the record it leaves. */
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

/** Why the owner can't record this long video as uploaded, or null when they can: any real (not demo, not a test
 *  fixture), built lesson, whatever its approval (the owner dropped approvals on 9 Nov 2026). */
export function lessonUploadBlocker(l: { isDemo: boolean; isTestFixture: boolean; videoPath: string }): string | null {
  if (l.isDemo || l.isTestFixture) return "A demo or test long video can't be marked uploaded.";
  if (!l.videoPath) return "This long video isn't built yet.";
  return null;
}

/** "Uploaded on YouTube" for a long video, the sibling of the episodes' Uploaded buttons: the owner posted it on YouTube
 *  by hand and says so. One press records it (owner-reported: state published with the report time, audit-logged with
 *  the owner as actor, undoable); nothing posts by itself. No approval is needed. Pressing it again changes nothing
 *  ("already"). The XP and "The Long Form" are awarded once, as before. */
export async function markLessonUploaded(d: DB, lessonId: string, v: { postUrl?: string } = {}): Promise<"marked" | "already"> {
  const [l] = await d.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!l) throw new DomainError("not_found", "lesson not found");
  const blocked = lessonUploadBlocker(l);
  if (blocked) throw new DomainError(l.videoPath ? "demo" : "not_built", blocked);
  let postUrl = "";
  if (v.postUrl) {
    const p = parsePostUrl("youtube", v.postUrl);
    if (!p.ok) throw new DomainError("bad_url", p.error);
    postUrl = p.url;
  }
  // one press wins: a lesson already recorded keeps its first report
  const [row] = await d.update(lessons).set({ state: "published", postUrl, reportedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(lessons.id, lessonId), ne(lessons.state, "published"))).returning();
  if (!row) return "already";
  await audit(d, "owner", "lesson.mark_uploaded", "lesson", l.id, { postUrl, evidence: "owner_reported", previousState: l.state });
  await awardXp(d, { channelId: l.channelId, kind: "lesson", amount: 150, key: `lesson:${l.id}` });
  // "The Long Form": the studio's first lesson that covers a whole series bundle
  const s = await settings(d);
  const [{ n }] = (await d.execute(sql`select count(*)::int as n from lesson_episodes where lesson_id = ${l.id}`)).rows as { n: number }[];
  const [rule] = await d.select().from(milestoneRules).where(eq(milestoneRules.key, "first_series_lesson"));
  if (rule?.enabled && l.seriesId && Number(n) >= s.lessonBundleSize) {
    const [ev] = await d.insert(achievementEvents).values({ ruleId: rule.id, scopeKey: "studio", channelId: l.channelId, evidence: { lessonId: l.id, postUrl } }).onConflictDoNothing().returning();
    if (ev && rule.xp) await awardXp(d, { channelId: l.channelId, kind: "achievement:first_series_lesson", amount: rule.xp, key: "achievement:first_series_lesson:studio:live" });
  }
  await refreshEvolution(d, l.channelId);
  return "marked";
}

/** Undo "Uploaded on YouTube" for a long video pressed by mistake: back to built and not uploaded (ready_for_review),
 *  with no report time or link (audit-logged; the audit keeps what it was). Only the owner's button sets a lesson to
 *  published, so this undoes exactly that. As with episodes, XP already earned stays. Returns whether it undid anything. */
export async function undoLessonUploaded(d: DB, lessonId: string): Promise<boolean> {
  const [l] = await d.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!l) throw new DomainError("not_found", "lesson not found");
  const [row] = await d.update(lessons).set({ state: "ready_for_review", postUrl: "", reportedAt: null, updatedAt: new Date() })
    .where(and(eq(lessons.id, lessonId), eq(lessons.state, "published"), eq(lessons.isDemo, false), eq(lessons.isTestFixture, false))).returning();
  if (!row) return false;
  await audit(d, "owner", "lesson.undo_uploaded", "lesson", lessonId, { reportedAt: l.reportedAt?.toISOString() ?? null, postUrl: l.postUrl });
  return true;
}

/** Give a lesson's episodes back (only before it is published) so they can join another one. */
export async function dissolveLesson(d: DB, lessonId: string) {
  const [l] = await d.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!l) throw new DomainError("not_found", "lesson not found");
  if (l.state === "published") throw new DomainError("published", "A published lesson keeps its episodes.");
  await d.delete(lessons).where(eq(lessons.id, lessonId));
  await audit(d, "owner", "lesson.dissolve", "lesson", lessonId, { name: l.name });
}
