// Builds a real compilation through the worker's handler (compilation.mjs over the delivered physics ep01, four
// times) and records it. Slow (minutes of ffmpeg): runs only with LESSON_E2E=1.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { freshDb, renderedEpisode, channel, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { createLesson, lessonBuildPlan } from "../src/domain/lessons";
import { claim } from "../src/domain/jobs";

const ROOT = path.resolve(process.env.FILMS_REPO_ROOT || "..");
const delivered = fs.existsSync(path.join(ROOT, "films/channels/physics/ep01/out")) && fs.readdirSync(path.join(ROOT, "films/channels/physics/ep01/out")).some((f) => f.endsWith("-9x16.mp4"));
const on = process.env.LESSON_E2E === "1" && delivered;

describe.skipIf(!on)("lesson build (real compilation.mjs)", () => {
  let db: DB, end: () => Promise<void>;
  beforeAll(async () => ({ db, end } = await freshDb()));
  afterAll(() => end());

  it("builds vol-e2e from four copies of ep01, with QA, chapters and a description", async () => {
    const { c } = await channel(db, "physics");
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await renderedEpisode(db, "physics", { title: `Thrown or dropped? (${i + 1})` });
      await db.update(S.episodes).set({ filmsPath: "films/channels/physics/ep01" }).where(eq(S.episodes.id, r.ep.id));
      ids.push(r.ep.id);
    }
    const l = await createLesson(db, { channelId: c.id, episodeIds: ids, title: "Rest Frame: a test compilation" });
    await db.update(S.lessons).set({ name: "vol-e2e", isTestFixture: true }).where(eq(S.lessons.id, l.id));
    const plan = await lessonBuildPlan(db, l.id);
    expect(plan.args.join(" ")).toContain("--episodes ep01,ep01,ep01,ep01 --title Rest Frame: a test compilation --name vol-e2e");
    const job = await claim(db, "e2e", { types: ["build_lesson"] });
    expect(job?.payload.lessonId).toBe(l.id);
    // the worker's handler, run in-process
    const { runHandler } = await import("../worker/handlers");
    const result = await runHandler("build_lesson", job!, async () => true, db);
    expect(result.video).toBe("films/channels/physics/compilations/vol-e2e");
    const [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row.state).toBe("ready_for_review");
    expect(row.videoSha256).toHaveLength(64);
    expect(row.chapters.startsWith("0:00")).toBe(true);
    expect(row.description).toMatch(/AI|synthetic/i);
    const qa = row.qa as { fails?: unknown[]; dur?: number; lufs?: number };
    expect(qa.fails).toEqual([]);
    expect(qa.dur).toBeGreaterThan(4 * 70);
    expect(Math.abs((qa.lufs ?? 0) + 14)).toBeLessThan(1.5);
    fs.rmSync(path.join(ROOT, "films/channels/physics/compilations/vol-e2e"), { recursive: true, force: true });
  }, 20 * 60_000);
});
