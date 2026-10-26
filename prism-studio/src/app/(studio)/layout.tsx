import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { Nav } from "@/components/Nav";
import { CelebrationHost } from "@/components/CelebrationHost";
import { Wallpaper } from "@/components/Wallpaper";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const d = db();
  // badge counts are real work only: demo episodes never count, even when "Show demo data" is on
  const [up] = await d.select({ n: sql<number>`count(*)::int` }).from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId))
    .where(sql`${S.publications.status} in ('ready','handed_off') and ${S.publications.scheduledFor} is not null and ${S.publications.scheduledFor} < now() + interval '1 day' and not ${S.episodes.isDemo}`);
  const [rv] = await d.select({ n: sql<number>`count(*)::int` }).from(S.episodes).where(and(inArray(S.episodes.state, ["ready_for_review", "correction_needed"]), eq(S.episodes.isDemo, false)));
  const fresh = await d.select({ id: S.achievementEvents.id, title: S.milestoneRules.title, demo: S.achievementEvents.isDemo }).from(S.achievementEvents)
    .innerJoin(S.milestoneRules, eq(S.milestoneRules.id, S.achievementEvents.ruleId))
    .where(and(isNull(S.achievementEvents.seenAt), gt(S.achievementEvents.achievedAt, new Date(Date.now() - 10 * 60_000))));
  return (
    <div className="shell">
      <Wallpaper variant="soft" />
      <a href="#main" className="skip">Skip to content</a>
      <Nav counts={{ upload: up?.n ?? 0, review: rv?.n ?? 0 }} />
      <main id="main" className="main">{children}</main>
      <CelebrationHost fresh={fresh} />
    </div>
  );
}
