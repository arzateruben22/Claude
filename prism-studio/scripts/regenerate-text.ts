// Rewrite every current version's platform texts (title, caption, hashtags, notes) from the script and sources.
// Approvals whose text changes are withdrawn (the Review screen asks for them again).
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { regenerateExports } from "../src/domain/exports";
import { loadEnv } from "./env";
loadEnv();

const r = await db().execute(sql`select e.id, e.title from episodes e join versions v on v.episode_id = e.id and not v.superseded order by e.number`);
for (const row of r.rows as { id: string; title: string }[]) {
  const out = await regenerateExports(db(), row.id);
  console.log(`${row.title}: ${out.platforms} texts${out.revoked ? `, ${out.revoked} approvals withdrawn` : ""}${out.warnings.length ? ` · check: ${out.warnings.join("; ")}` : ""}`);
}
await pool().end();
