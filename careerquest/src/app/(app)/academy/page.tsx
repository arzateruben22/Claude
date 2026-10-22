import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getAcademyOverview } from "@/lib/academy/service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { ACADEMY_DISCLAIMER, AcademyQuickLinks, AcademyStats, NextLessonCard, TrackSection } from "@/components/academy/overview";

export const metadata: Metadata = { title: "Electrician Academy" };

export default async function AcademyPage() {
  const user = await requireUser("/academy");
  const overview = await getAcademyOverview(user.id);
  const hasLessons = overview.stats.lessonsTotal > 0;

  return (
    <>
      <PageHeader
        eyebrow="California Electrician Career Academy"
        title="Electrician Academy"
        description="Interactive lessons, worked examples, quizzes, a simulated bench and practice exams — from Ohm's law to NEC fundamentals."
      />
      <AcademyTabs />
      <div className="space-y-8">
        <AcademyStats stats={overview.stats} />
        {hasLessons ? (
          <>
            <NextLessonCard lesson={overview.next} />
            <AcademyQuickLinks />
            {overview.tracks.map((t) => (
              <TrackSection key={t.key} track={t} />
            ))}
          </>
        ) : (
          <>
            <EmptyState
              icon={<Info className="h-6 w-6" aria-hidden />}
              title="No lessons are available right now"
              description="The lesson library could not be loaded. The roadmap, workshop and practice exam may still be available."
            />
            <AcademyQuickLinks />
          </>
        )}
        <p className="text-xs text-fg-subtle">{ACADEMY_DISCLAIMER}</p>
      </div>
    </>
  );
}
