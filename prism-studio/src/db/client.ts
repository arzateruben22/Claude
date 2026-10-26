// One pg pool per process (the Next server, the worker, scripts, tests). Drizzle on top for typed queries.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
const g = globalThis as unknown as { __prismPool?: pg.Pool; __prismDb?: DB };

export function pool(url = process.env.DATABASE_URL || "postgres://prism:prism-dev@localhost:5432/prism"): pg.Pool {
  if (!g.__prismPool) g.__prismPool = new pg.Pool({ connectionString: url, max: 10 });
  return g.__prismPool;
}
export function db(): DB {
  if (!g.__prismDb) g.__prismDb = drizzle(pool(), { schema });
  return g.__prismDb;
}
export function dbFor(url: string): { db: DB; pool: pg.Pool } {
  const p = new pg.Pool({ connectionString: url, max: 10 });
  return { db: drizzle(p, { schema }), pool: p };
}
export { schema };
