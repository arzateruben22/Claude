// Demo data: rows with is_demo = true (episodes, series, lessons, jobs). Settings → "Show demo data" only decides
// whether lists show them: off (the default) hides them; on shows them, always labelled DEMO.
// Counting never reads this setting. Progress, rewards, XP, achievements and analytics totals filter is_demo in their
// own queries (living.ts, rewards.ts, lessons.ts, schedule.ts, analytics.ts), so the toggle can't make demo count.
import { and, asc, eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { episodes } from "../db/schema";
import { type Conn, settings } from "./core";

export async function showDemo(c: Conn): Promise<boolean> {
  return (await settings(c)).showDemo;
}

/** The where-clause that hides demo rows unless they're shown (undefined = no filter). */
export const demoFilter = (show: boolean, isDemo: AnyPgColumn): SQL | undefined => (show ? undefined : eq(isDemo, false));

/** A channel's episodes in number order, demo ones only when shown. */
export async function channelEpisodes(c: Conn, channelId: string, show?: boolean) {
  const visible = show ?? (await showDemo(c));
  return c.select().from(episodes).where(and(eq(episodes.channelId, channelId), demoFilter(visible, episodes.isDemo))).orderBy(asc(episodes.number));
}
