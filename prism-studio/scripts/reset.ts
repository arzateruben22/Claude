// Development only: empty the studio database and seed it again (then re-import the real episodes).
// Refuses unless --yes is passed and DATABASE_URL points at localhost, so it can never wipe a hosted database.
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { seed } from "./seed";
import { importEpisodes } from "./import-episodes";
import { loadEnv } from "./env";
loadEnv();

const url = process.env.DATABASE_URL ?? "";
if (!process.argv.includes("--yes") || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("db:reset wipes every table. Run `npm run db:reset -- --yes` against a localhost database only.");
  process.exit(1);
}
const r = await db().execute(sql`select tablename from pg_tables where schemaname = 'public'`);
await db().execute(sql.raw(`truncate table ${(r.rows as { tablename: string }[]).map((t) => `"${t.tablename}"`).join(", ")} restart identity cascade`));
await seed();
for (const line of await importEpisodes()) console.log(line);
await pool().end();
