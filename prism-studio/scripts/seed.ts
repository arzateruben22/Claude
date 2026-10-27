// Seed (idempotent): settings, five channels, 11 destinations, creations, challenges, quests, milestones, onboarding.
// Real structure only; DEMO episodes are added separately with --demo and are labelled.
import { and, eq, isNull } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import * as S from "../src/db/schema";
import { CHANNELS, CHALLENGES, MILESTONES, OFFICIAL, ONBOARDING_ITEMS, OPTIONAL_QUESTS, SHARED_ONBOARDING } from "../src/domain/catalog";
import { settings } from "../src/domain/core";
import { loadEnv } from "./env";
loadEnv();

export async function seed(d = db()) {
  await settings(d);
  await d.insert(S.rewardSettings).values({ id: 1, monthlyCapCents: null }).onConflictDoNothing();
  for (const [i, c] of CHANNELS.entries()) {
    await d.insert(S.channels).values({
      slug: c.slug, topic: c.topic, name: c.name, nameProvisional: c.provisional, tagline: c.tagline, color: c.color, colorInk: c.colorInk,
      label: c.label, voice: c.voice, editorial: c.editorial, filmsPath: c.filmsPath, sort: i,
    }).onConflictDoNothing();
    const [ch] = await d.select().from(S.channels).where(eq(S.channels.slug, c.slug));
    await d.insert(S.episodeCounters).values({ channelId: ch.id, nextNumber: 1 }).onConflictDoNothing();
    for (const platform of ["youtube", "tiktok"] as const) {
      await d.insert(S.destinations).values({
        platform, channelId: ch.id, displayName: "", studioUrl: OFFICIAL[platform].studio, uploadUrl: OFFICIAL[platform].upload, loginHelpUrl: OFFICIAL[platform].help, provenance: "unset",
      }).onConflictDoNothing();
    }
    await d.insert(S.creations).values({ channelId: ch.id, creationKey: c.creation.key, name: c.creation.name, form: 1 }).onConflictDoNothing();
    for (const x of CHALLENGES[c.topic]) {
      await d.insert(S.challenges).values({ channelId: ch.id, key: x.key, tier: x.tier, title: x.title, description: x.description, requirement: { check: x.check }, status: "active" }).onConflictDoNothing();
    }
    for (const q of OPTIONAL_QUESTS) {
      await d.insert(S.challenges).values({ channelId: ch.id, key: q.key, tier: "optional", title: q.title, description: q.description, requirement: { check: "owner_confirm" }, status: "locked" }).onConflictDoNothing();
    }
    for (const o of ONBOARDING_ITEMS) await d.insert(S.onboarding).values({ channelId: ch.id, item: o.item }).onConflictDoNothing();
  }
  const ig = await d.select().from(S.destinations).where(and(eq(S.destinations.platform, "instagram"), eq(S.destinations.shared, true)));
  if (!ig.length) await d.insert(S.destinations).values({ platform: "instagram", channelId: null, shared: true, displayName: "", studioUrl: OFFICIAL.instagram.studio, uploadUrl: OFFICIAL.instagram.upload, loginHelpUrl: OFFICIAL.instagram.help, provenance: "unset" });
  for (const o of SHARED_ONBOARDING) {
    const ex = await d.select().from(S.onboarding).where(and(isNull(S.onboarding.channelId), eq(S.onboarding.item, o.item)));
    if (!ex.length) await d.insert(S.onboarding).values({ channelId: null, item: o.item });
  }
  for (const m of MILESTONES) await d.insert(S.milestoneRules).values({ ...m, threshold: m.threshold ?? null, rewardCents: m.rewardCents ?? null }).onConflictDoNothing();
}

/**
 * DEMO data for previews (`npm run db:seed -- --demo`): one series of three episodes on Rest Frame, every row
 * is_demo and labelled DEMO. Hidden unless Settings → "Show demo data" is on, and never counted. Idempotent.
 * Numbered from 901 without touching the channel's counter, so real episode numbers are never spent on demo.
 */
export async function seedDemo(d = db()) {
  const [ch] = await d.select().from(S.channels).where(eq(S.channels.slug, "physics"));
  if (!ch) return 0;
  const title = "Things that fall";
  const [had] = await d.select().from(S.series).where(and(eq(S.series.channelId, ch.id), eq(S.series.isDemo, true), eq(S.series.title, title)));
  if (had) return 0;
  const [ser] = await d.insert(S.series).values({ channelId: ch.id, title, objective: "Preview data: never published, never counted.", isDemo: true, sort: 99 }).returning();
  const eps = [["Why does a feather float?", "script"], ["Do heavy things fall faster?", "storyboard"], ["How does a cat land on its feet?", "idea"]] as const;
  for (const [i, [t, state]] of eps.entries()) {
    await d.insert(S.episodes).values({ channelId: ch.id, seriesId: ser.id, seriesOrder: i + 1, number: 901 + i, title: t, state, isDemo: true }).onConflictDoNothing();
  }
  return eps.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seed();
  console.log("seeded");
  if (process.argv.includes("--demo")) console.log(`demo: ${await seedDemo()} DEMO episodes added (hidden until Settings → Show demo data)`);
  await pool().end();
}
