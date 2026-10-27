// Analytics totals: real posts and platform-reported views only. Demo episodes, simulated publications, estimates
// and demo numbers never count, whether or not "Show demo data" is on (this never reads that setting).
import { sql } from "drizzle-orm";
import type { Conn } from "./core";
import { QUALIFYING_SOURCES } from "./rewards";

const POSTED = ["owner_reported", "scheduled_on_platform", "verified_published"];

/** Posts counted, how many have a platform-reported view count, and the sum of each post's latest such count. */
export async function analyticsTotals(c: Conn) {
  const r = await c.execute(sql`
    with posts as (
      select p.id from publications p join episodes e on e.id = p.episode_id
       where p.status::text in ${POSTED} and not p.simulated and not e.is_demo
    ), latest as (
      select distinct on (m.publication_id) m.publication_id, m.value from metric_snapshots m
       where m.metric = 'views' and m.source::text in ${[...QUALIFYING_SOURCES]} and m.publication_id in (select id from posts)
       order by m.publication_id, m.retrieved_at desc, m.id
    )
    select (select count(*) from posts)::int as posts, (select count(*) from latest)::int as measured,
           coalesce((select sum(value) from latest), 0)::float8 as views`);
  const row = r.rows[0] as { posts: number; measured: number; views: number };
  return { posts: Number(row.posts), measured: Number(row.measured), views: Number(row.views) };
}
