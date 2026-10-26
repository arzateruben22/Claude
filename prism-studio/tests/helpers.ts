// Tests run against TEST_DATABASE_URL (never the studio's own database): every file starts from an empty,
// freshly seeded schema.
import { and, eq, sql } from "drizzle-orm";
import { dbFor, type DB } from "../src/db/client";
import * as S from "../src/db/schema";
import { loadEnv } from "../scripts/env";
import { seed } from "../scripts/seed";
import { createEpisode, addVersion, upsertExport } from "../src/domain/episodes";

loadEnv();

export async function freshDb(): Promise<{ db: DB; end: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must be set and differ from DATABASE_URL");
  const { db, pool } = dbFor(url);
  const r = await db.execute(sql`select tablename from pg_tables where schemaname = 'public'`);
  const tables = (r.rows as { tablename: string }[]).map((t) => `"${t.tablename}"`).join(", ");
  await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`));
  await seed(db);
  return { db, end: () => pool.end() };
}

export async function channel(db: DB, slug = "physics") {
  const [c] = await db.select().from(S.channels).where(eq(S.channels.slug, slug));
  const dests = await db.select().from(S.destinations).where(eq(S.destinations.channelId, c.id));
  const [ig] = await db.select().from(S.destinations).where(eq(S.destinations.shared, true));
  return { c, yt: dests.find((d) => d.platform === "youtube")!, tt: dests.find((d) => d.platform === "tiktok")!, ig };
}

/** An episode with one rendered version, three exports and planned YouTube/TikTok publications. */
export async function renderedEpisode(db: DB, slug = "physics", o: { sourcesOk?: boolean; title?: string } = {}) {
  const { c, yt, tt, ig } = await channel(db, slug);
  const ep = await createEpisode(db, { channelId: c.id, title: o.title ?? "Thrown or dropped?", state: "ready_for_review" });
  await db.insert(S.sources).values({ episodeId: ep.id, claimKey: "c1", claim: "g = 9.8 m/s²", url: "https://openstax.org", status: o.sourcesOk === false ? "unresolved" : "ok" });
  const ver = await addVersion(db, { episodeId: ep.id, videoPath: "films:channels/physics/ep01/out/x.mp4", sha256: `sha-${ep.id}` });
  const exports: Record<string, typeof S.platformExports.$inferSelect> = {};
  for (const platform of ["youtube", "tiktok", "instagram"] as const) {
    exports[platform] = await upsertExport(db, { versionId: ver.id, platform, filePath: "films:x.mp4", fileSha256: `sha-${ep.id}`, title: "Thrown or dropped?", caption: "Which lands first?", hashtags: "#physics" });
  }
  const pubs: Record<string, typeof S.publications.$inferSelect> = {};
  for (const dest of [yt, tt]) {
    const [p] = await db.insert(S.publications).values({ episodeId: ep.id, destinationId: dest.id, exportId: exports[dest.platform].id, status: "planned" }).returning();
    pubs[dest.platform] = p;
  }
  return { c, yt, tt, ig, ep, ver, exports, pubs };
}

export const reload = async <T extends { id: string }>(db: DB, table: typeof S.publications | typeof S.episodes, id: string) =>
  (await db.select().from(table as typeof S.publications).where(eq((table as typeof S.publications).id, id)))[0] as unknown as T;

export { and, eq, sql, S };
