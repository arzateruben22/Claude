// Archived channels (owner's request, 10 Nov 2026: Body Backstage). Paused means nothing is planned and the channel still
// shows everywhere; archived means it is gone from every screen, list and total, and nothing automatic touches it (the
// scheduler, publishing, notifications, analytics pulls, video cleanup, the importer, media push). Nothing is deleted:
// its episodes, publications, lessons, rewards and numbers stay in the database as the backup, and Settings → Archived
// channels restores it. Every query that lists channels, or rows that belong to one, goes through this file.
import { asc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { channels } from "../db/schema";
import { audit, type Conn, DomainError } from "./core";

export type ChannelRow = typeof channels.$inferSelect;

/** Whether a channel is archived (a missing one counts as gone too). */
export const isArchived = (c: { archivedAt: Date | null } | null | undefined): boolean => !c || c.archivedAt != null;

/** The where-clause for the channels table itself: active channels only. */
export const channelActive = (): SQL => isNull(channels.archivedAt);

/** The where-clause for any row that belongs to a channel through `channelId`: rows of an archived channel are left
 *  out; a row with no channel (the shared Instagram, studio-wide entries) stays. */
export const onActiveChannel = (channelId: AnyPgColumn | SQL): SQL =>
  sql`not exists (select 1 from channels arch where arch.id = ${channelId} and arch.archived_at is not null)`;

/** For an achievement: studio-wide ones always stay (a studio milestone is the studio's, whichever post reached it);
 *  a channel's own (scope = the channel) goes with its channel. */
export const achievementOnActiveChannel = (scopeKey: AnyPgColumn, channelId: AnyPgColumn): SQL =>
  sql`(${scopeKey} = 'studio' or ${onActiveChannel(channelId)})`;

/** The active channels, in studio order. The one list every screen, total and job iterates. */
export async function activeChannels(c: Conn): Promise<ChannelRow[]> {
  return c.select().from(channels).where(channelActive()).orderBy(asc(channels.sort));
}

/** The archived channels (Settings → Archived channels), in studio order. */
export async function archivedChannels(c: Conn): Promise<ChannelRow[]> {
  return c.select().from(channels).where(isNotNull(channels.archivedAt)).orderBy(asc(channels.sort));
}

/** An active channel by slug, or null (archived or unknown: its pages answer 404). */
export async function activeChannelBySlug(c: Conn, slug: string): Promise<ChannelRow | null> {
  const [ch] = await c.select().from(channels).where(eq(channels.slug, slug));
  return ch && !isArchived(ch) ? ch : null;
}

/** An active channel by id, or null. */
export async function activeChannelById(c: Conn, id: string): Promise<ChannelRow | null> {
  const [ch] = await c.select().from(channels).where(eq(channels.id, id));
  return ch && !isArchived(ch) ? ch : null;
}

/** The films folders of archived channels ("films/channels/body"), for the importer and media push. */
export async function archivedFilmsPaths(c: Conn): Promise<string[]> {
  return (await archivedChannels(c)).map((ch) => ch.filmsPath?.replace(/\/+$/, "") ?? "").filter(Boolean);
}

/** Whether a films-relative path ("films/channels/body/ep01/out/x.mp4") lies in an archived channel's folder. */
export function inArchivedFolder(rel: string, archivedPaths: string[]): boolean {
  return archivedPaths.some((p) => rel === p || rel.startsWith(`${p}/`));
}

/** Archive a channel: hidden everywhere, nothing deleted (audit-logged). Idempotent: an archived channel keeps its date. */
export async function archiveChannel(c: Conn, id: string, actor: "owner" | "system" = "owner"): Promise<ChannelRow> {
  const [ch] = await c.select().from(channels).where(eq(channels.id, id));
  if (!ch) throw new DomainError("not_found", "channel not found");
  if (ch.archivedAt) return ch;
  const [row] = await c.update(channels).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(channels.id, id)).returning();
  await audit(c, actor, "channel.archive", "channel", id, { slug: ch.slug, name: ch.name });
  return row;
}

/** Settings → Archived channels → Restore: the channel comes back everywhere, with everything it had (audit-logged). */
export async function restoreChannel(c: Conn, id: string): Promise<ChannelRow> {
  const [ch] = await c.select().from(channels).where(eq(channels.id, id));
  if (!ch) throw new DomainError("not_found", "channel not found");
  if (!ch.archivedAt) return ch;
  const [row] = await c.update(channels).set({ archivedAt: null, updatedAt: new Date() }).where(eq(channels.id, id)).returning();
  await audit(c, "owner", "channel.restore", "channel", id, { slug: ch.slug, name: ch.name, archivedAt: ch.archivedAt.toISOString() });
  return row;
}
