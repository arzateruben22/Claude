import type { Metadata } from "next";
import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getQuestionBank } from "@/lib/academy/content";
import { EXAM_SECONDS_PER_QUESTION, MAX_SEED, isExamSize, isValidSeed, selectExamQuestions, toPublicExamQuestions } from "@/lib/academy/exam";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/academy/lesson-parts";
import { ExamForm } from "@/components/academy/exam/exam-form";

export const metadata: Metadata = { title: "Practice exam in progress · Academy" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TakeExamPage({ searchParams }: Props) {
  const sp = await searchParams;
  const size = Number(one(sp.size));
  const timed = one(sp.timed) === "1";
  const seedParam = Number(one(sp.seed));
  await requireUser("/academy/exam");
  const bank = getQuestionBank();
  if (!bank || bank.questions.length === 0 || !isExamSize(size)) redirect("/academy/exam");
  // A fresh seed per exam; it stays in the URL so a reload shows the same questions and the server
  // can re-derive exactly this selection when grading.
  if (!isValidSeed(seedParam)) redirect(`/academy/exam/take?size=${size}&seed=${randomInt(1, MAX_SEED)}${timed ? "&timed=1" : ""}`);

  const questions = selectExamQuestions(bank, size, seedParam);
  const duration = questions.length * EXAM_SECONDS_PER_QUESTION;

  return (
    <>
      <Breadcrumbs items={[{ href: "/academy", label: "Academy" }, { href: "/academy/exam", label: "Practice exam" }, { label: `${questions.length} questions` }]} />
      <PageHeader
        eyebrow="Practice exam"
        title={`${questions.length}-question practice exam`}
        description={timed ? `Timed: ${Math.round(duration / 60)} minutes. The exam submits automatically when the timer reaches zero.` : "Untimed. Answer every question, then submit."}
      />
      <Alert tone="warning" title="Original study questions — not actual DIR exam content" className="mb-6">
        {bank.disclaimer}
      </Alert>
      <ExamForm size={size} seed={seedParam} timed={timed} durationSeconds={duration} questions={toPublicExamQuestions(bank, questions)} />
    </>
  );
}
