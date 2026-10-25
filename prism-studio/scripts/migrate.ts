// Apply the committed SQL migrations (drizzle/) to DATABASE_URL (or the URL given as the first argument).
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { dbFor } from "../src/db/client";
import { loadEnv } from "./env";
loadEnv();
const url = process.argv[2] || process.env.DATABASE_URL!;
const { db, pool } = dbFor(url);
await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
console.log(`migrated ${url.replace(/:[^:@/]+@/, ":***@")}`);
await pool.end();
