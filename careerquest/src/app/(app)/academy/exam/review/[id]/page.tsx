import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { getExamReview, timezoneOf } from "@/lib/academy/service";
import { formatInTz } from "@/lib/applications/time";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/academy/lesson-parts";
import { ExamResults } from "@/components/academy/exam/exam-results";

export const metadata: Metadata = { title: "Exam review · Academy" };

export default async function ExamReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser(`/academy/exam/review/${id}`);
  const [review, tz] = await Promise.all([getExamReview(user.id, id), timezoneOf(user.id)]);
  if (!review) notFound();

  return (
    <>
      <Breadcrumbs items={[{ href: "/academy", label: "Academy" }, { href: "/academy/exam", label: "Practice exam" }, { label: "Review" }]} />
      <PageHeader
        eyebrow="Practice exam review"
        title={`${review.size}-question exam`}
        description={`Taken ${formatInTz(review.createdAt, tz, "datetime")}. Results are shown as they were graded at the time; explanations reflect the current question bank.`}
        actions={
          <Link href={`/academy/exam/take?size=${review.size}`} className={buttonClasses("primary", "sm")}>
            New {review.size}-question exam
          </Link>
        }
      />
      <ExamResults
        heading="Result"
        result={{
          score: review.score,
          maxScore: review.maxScore,
          percent: review.percent,
          passed: review.passed,
          byArea: review.byArea,
          items: review.items.map((i) => ({
            id: i.id,
            areaLabel: i.areaLabel,
            prompt: i.question?.prompt ?? null,
            choices: i.question?.choices ?? [],
            selected: i.selected,
            correctIndex: i.question?.correctIndex ?? null,
            correct: i.correct,
            explanation: i.question?.explanation ?? "",
            necReference: i.question?.necReference ?? null,
          })),
        }}
      />
      <p className="mt-8 text-xs text-fg-subtle">
        Original study questions, not actual DIR exam content. A practice result is not a certification and does not predict the state exam.
      </p>
    </>
  );
}
