// The daily plan: which destinations are due when, in the studio timezone. A scheduled time on a manual
// destination is an upload task due for the owner. Missed slots move to the next open slot (no catch-up burst).
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { blackouts, channels, destinations, episodes, platformExports, publications, publishingWindows, versions } from "../db/schema";
import { audit, type Conn, settings } from "./core";
import { addDays, localDate, zonedTimeToUtc } from "./time";

// provisional defaults (not claimed to be optimal): one Short per channel per day on YouTube and TikTok,
// staggered so the owner's upload tasks don't all land at once; Instagram twice a day
export const DEFAULT_WINDOWS: Record<"youtube" | "tiktok" | "instagram", string[]> = {
  youtube: ["09:00"], tiktok: ["12:00"], instagram: ["11:30", "18:30", "20:30"],
};
const STAGGER_MIN: Record<string, number> = { skincare: 0, physics: 20, body: 40, space: 60, whatif: 80 };

async function windowsFor(c: Conn, platform: "youtube" | "tiktok" | "instagram", channelId: string | null) {
  const rows = await c.select().from(publishingWindows).where(and(eq(publishingWindows.platform, platform), channelId ? eq(publishingWindows.channelId, channelId) : isNull(publishingWindows.channelId)));
  if (rows.length) return rows.map((r) => r.localTime).sort();
  const generic = await c.select().from(publishingWindows).where(and(eq(publishingWindows.platform, platform), isNull(publishingWindows.channelId)));
  return (generic.length ? generic.map((r) => r.localTime) : DEFAULT_WINDOWS[platform]).sort();
}

function shift(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number), t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export async function isBlackedOut(c: Conn, at: Date, channelId: string | null, destinationId: string) {
  const rows = await c.select().from(blackouts).where(and(lte(blackouts.startsAt, at), gte(blackouts.endsAt, at),
    or(and(isNull(blackouts.channelId), isNull(blackouts.destinationId)), channelId ? eq(blackouts.channelId, channelId) : sql`false`, eq(blackouts.destinationId, destinationId))));
  return rows.length > 0;
}

/** The slots due on one local date: [{ destination, channel, at (UTC), kind }]. Paused channels/destinations and blackouts are skipped. */
export async function slotsForDate(c: Conn, date: string) {
  const s = await settings(c);
  if (s.globalPause) return [];
  const chans = await c.select().from(channels).where(eq(channels.paused, false));
  const dests = await c.select().from(destinations).where(eq(destinations.paused, false));
  const out: { destinationId: string; channelId: string | null; platform: string; at: Date; kind: string }[] = [];
  for (const ch of chans) {
    for (const d of dests.filter((x) => x.channelId === ch.id)) {
      const times = (await windowsFor(c, d.platform, ch.id)).slice(0, s.shortsPerChannelDaily);
      for (const t of times) {
        const at = zonedTimeToUtc(date, shift(t, STAGGER_MIN[ch.topic] ?? 0), s.timezone);
        if (!(await isBlackedOut(c, at, ch.id, d.id))) out.push({ destinationId: d.id, channelId: ch.id, platform: d.platform, at, kind: "short" });
      }
    }
  }
  const ig = dests.find((d) => d.platform === "instagram" && d.shared);
  if (ig) {
    for (const t of (await windowsFor(c, "instagram", null)).slice(0, s.instagramDaily)) {
      const at = zonedTimeToUtc(date, t, s.timezone);
      if (!(await isBlackedOut(c, at, null, ig.id))) out.push({ destinationId: ig.id, channelId: null, platform: "instagram", at, kind: "instagram" });
    }
  }
  return out.sort((a, b) => +a.at - +b.at);
}

/**
 * Missed slots: a manual task left undone past its slot by more than `graceHours` moves to the destination's next
 * free slot (never two on one day for the same destination: no catch-up burst). Returns how many moved.
 */
export async function rescheduleMissed(d: DB, now = new Date(), graceHours = 6) {
  const s = await settings(d);
  if (s.missedSlotPolicy !== "reschedule") return 0;
  const late = await d.select().from(publications).where(and(inArray(publications.status, ["planned", "ready", "handed_off"]), lt(publications.scheduledFor, new Date(+now - graceHours * 3_600_000)), eq(publications.simulated, false)));
  let moved = 0;
  for (const p of late) {
    const taken = await d.select({ at: publications.scheduledFor }).from(publications).where(and(eq(publications.destinationId, p.destinationId), gte(publications.scheduledFor, now)));
    const takenDays = new Set(taken.map((t) => t.at && localDate(t.at, s.timezone)));
    let date = localDate(now, s.timezone);
    for (let i = 0; i < 30; i++, date = addDays(date, 1)) {
      if (takenDays.has(date)) continue;
      const slot = (await slotsForDate(d, date)).find((x) => x.destinationId === p.destinationId && x.at > now);
      if (!slot) continue;
      await d.update(publications).set({ scheduledFor: slot.at, originalSlot: p.originalSlot ?? p.scheduledFor, updatedAt: new Date() }).where(eq(publications.id, p.id));
      await audit(d, "system", "publication.rescheduled", "publication", p.id, { from: p.scheduledFor, to: slot.at });
      moved++;
      break;
    }
  }
  return moved;
}

/** Episodes ready for a destination, in channel order (the next to post first). */
export async function nextReadyEpisodes(c: Conn, channelId: string) {
  return c.select().from(episodes).where(and(eq(episodes.channelId, channelId), inArray(episodes.state, ["approved", "scheduled", "published", "analytics"]))).orderBy(episodes.number);
}

/**
 * Fill the next `days` local days' open slots. A channel's YouTube/TikTok slot takes that destination's next
 * unscheduled publication in episode order; the shared Instagram takes the next channel in turn that has an
 * Instagram export not yet placed there. Planning never approves anything: the Upload Desk still requires a
 * live approval of the exact export before a task can be marked uploaded. Returns how many were placed.
 */
export async function planDays(d: DB, from: string, days: number, now = new Date()) {
  let placed = 0;
  for (let i = 0; i < days; i++) {
    const slots = await slotsForDate(d, addDays(from, i));
    for (const slot of slots) {
      if (slot.at <= now) continue;
      const [taken] = await d.select({ id: publications.id }).from(publications)
        .where(and(eq(publications.destinationId, slot.destinationId), eq(publications.scheduledFor, slot.at), ne(publications.status, "cancelled")));
      if (taken) continue;
      if (slot.kind !== "instagram") {
        const [next] = await d.select({ id: publications.id }).from(publications)
          .innerJoin(episodes, eq(episodes.id, publications.episodeId))
          .where(and(eq(publications.destinationId, slot.destinationId), isNull(publications.scheduledFor), inArray(publications.status, ["planned", "ready"]), eq(episodes.isDemo, false), eq(publications.simulated, false)))
          .orderBy(asc(episodes.number)).limit(1);
        if (!next) continue;
        await d.update(publications).set({ scheduledFor: slot.at, originalSlot: slot.at, updatedAt: new Date() }).where(eq(publications.id, next.id));
        await audit(d, "owner", "publication.planned", "publication", next.id, { at: slot.at });
        placed++;
        continue;
      }
      // shared Instagram: rotate through channels, oldest unplaced episode first
      const chans = await d.select().from(channels).where(eq(channels.paused, false)).orderBy(asc(channels.sort));
      const [last] = await d.select({ channelId: episodes.channelId }).from(publications).innerJoin(episodes, eq(episodes.id, publications.episodeId))
        .where(and(eq(publications.destinationId, slot.destinationId), ne(publications.status, "cancelled"))).orderBy(desc(publications.scheduledFor)).limit(1);
      const start = last ? (chans.findIndex((c) => c.id === last.channelId) + 1) % Math.max(1, chans.length) : 0;
      for (let k = 0; k < chans.length; k++) {
        const ch = chans[(start + k) % chans.length];
        const [cand] = await d.select({ episodeId: episodes.id, exportId: platformExports.id }).from(platformExports)
          .innerJoin(versions, eq(versions.id, platformExports.versionId)).innerJoin(episodes, eq(episodes.id, versions.episodeId))
          .where(and(eq(episodes.channelId, ch.id), eq(platformExports.platform, "instagram"), eq(versions.superseded, false), eq(episodes.isDemo, false),
            sql`not exists (select 1 from publications p where p.episode_id = ${episodes.id} and p.destination_id = ${slot.destinationId})`))
          .orderBy(asc(episodes.number)).limit(1);
        if (!cand) continue;
        const [row] = await d.insert(publications).values({ episodeId: cand.episodeId, destinationId: slot.destinationId, exportId: cand.exportId, kind: "instagram", status: "planned", scheduledFor: slot.at, originalSlot: slot.at })
          .onConflictDoNothing().returning();
        if (row) { await audit(d, "owner", "publication.planned", "publication", row.id, { at: slot.at }); placed++; }
        break;
      }
    }
  }
  return placed;
}

/** Take a publication off the calendar (back to the unscheduled backlog). */
export async function unschedule(d: DB, publicationId: string) {
  await d.update(publications).set({ scheduledFor: null, updatedAt: new Date() })
    .where(and(eq(publications.id, publicationId), inArray(publications.status, ["planned", "ready", "handed_off"])));
}
