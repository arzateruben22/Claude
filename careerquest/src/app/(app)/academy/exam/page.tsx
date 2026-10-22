import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getQuestionBank } from "@/lib/academy/content";
import { EXAM_PASS_PERCENT, EXAM_SECONDS_PER_QUESTION, EXAM_SIZES, examAreas } from "@/lib/academy/exam";
import { loadRoadmap } from "@/lib/academy/roadmap";
import { listExamAttempts, timezoneOf } from "@/lib/academy/service";
import { formatInTz } from "@/lib/applications/time";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { FlagBadge } from "@/components/academy/badges";

export const metadata: Metadata = { title: "Practice exam · Academy" };

export default async function ExamPage() {
  const user = await requireUser("/academy/exam");
  const bank = getQuestionBank();
  const [history, tz] = await Promise.all([listExamAttempts(user.id, 10), timezoneOf(user.id)]);
  const roadmap = loadRoadmap();
  const officialFacts = (roadmap.exam?.facts ?? []).filter((f) => ["Questions", "Time limit", "Passing score"].includes(f.label));
  const areas = bank ? examAreas(bank).map((a) => ({ ...a, count: bank.questions.filter((q) => q.area === a.key).length })) : [];

  return (
    <>
      <PageHeader
        eyebrow="Electrician Academy"
        title="Practice exam"
        description="Randomized multiple-choice exams drawn in proportion to the content areas, graded on the server with explanations and NEC references."
      />
      <AcademyTabs />
      <div className="space-y-6">
        <Alert tone="warning" title="Original study questions — not actual DIR exam content">
          {bank?.disclaimer ??
            "These are original CareerQuest study questions. They are not taken from, and do not predict, the California DIR electrician certification examination."}
        </Alert>

        {!bank || bank.questions.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" aria-hidden />}
            title="The question bank is not available right now"
            description="Practice exams need the question bank file. Lessons and their quizzes are still available."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-labelledby="exam-start" className="glass rounded-card p-5">
              <h2 id="exam-start" className="text-sm font-medium">
                Start an exam
              </h2>
              <form action="/academy/exam/take" method="get" className="mt-4 space-y-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-fg-muted">Length</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {EXAM_SIZES.map((size, i) => (
                      <label
                        key={size}
                        className="flex cursor-pointer flex-col rounded-ctl border border-line px-3 py-2.5 hover:bg-surface-hover has-[:checked]:border-accent/60 has-[:checked]:bg-accent-soft"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <input type="radio" name="size" value={size} defaultChecked={i === 0} className="accent-[var(--accent)]" />
                          {size} questions
                        </span>
                        <span className="mt-0.5 pl-5 text-xs text-fg-muted">
                          Timed: {Math.round((size * EXAM_SECONDS_PER_QUESTION) / 60)} min
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="timed" value="1" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                  <span>
                    <span className="font-medium">Use a timer</span>
                    <span className="block text-xs text-fg-muted">
                      {Math.round((EXAM_SECONDS_PER_QUESTION / 60) * 10) / 10} minutes per question, runs in your browser and submits automatically at
                      zero. It is a study pace, not the official limit.
                    </span>
                  </span>
                </label>
                <Button type="submit" className="w-full sm:w-auto">
                  <Timer className="h-4 w-4" aria-hidden />
                  Start practice exam
                </Button>
                <p className="text-xs text-fg-subtle">
                  Passing a practice exam ({EXAM_PASS_PERCENT}% or better) earns Electrician XP once per day. Every attempt is saved with
                  results by area.
                </p>
              </form>
            </section>

            <section aria-labelledby="exam-blueprint" className="glass rounded-card p-5">
              <h2 id="exam-blueprint" className="text-sm font-medium">
                How questions are drawn
              </h2>
              <p className="mt-1 text-xs text-fg-muted">{bank.questions.length} questions in the bank, sampled in proportion to these weights.</p>
              <ul className="mt-3 space-y-2 text-sm">
                {areas.map((a) => (
                  <li key={a.key} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{a.label}</span>
                    <span className="shrink-0 text-xs text-fg-muted tnum">
                      {Math.round(a.weight * 100)}% · {a.count} in bank
                    </span>
                  </li>
                ))}
              </ul>
              {officialFacts.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-xs font-medium text-fg-muted">The real exam, per the researched facts</p>
                  <dl className="mt-2 space-y-2 text-xs">
                    {officialFacts.map((f) => (
                      <div key={f.label}>
                        <dt className="flex items-center gap-2 font-medium text-fg">
                          {f.label} <FlagBadge flag={f.flag} />
                        </dt>
                        <dd className="text-fg-muted">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link href="/academy/roadmap#exam" className="mt-2 inline-block text-xs text-accent hover:underline">
                    Sources and verification notes on the roadmap
                  </Link>
                </div>
              )}
            </section>
          </div>
        )}

        <section aria-labelledby="exam-history" className="space-y-3">
          <h2 id="exam-history" className="text-lg font-semibold tracking-tight">
            Your attempts
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-fg-muted">No practice exams yet. Start one above; your results and per-area breakdown will appear here.</p>
          ) : (
            <ul className="divide-y divide-line rounded-card border border-line">
              {history.map((h) => (
                <li key={h.id}>
                  <Link href={`/academy/exam/review/${h.id}`} className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-surface-hover">
                    <span className="min-w-0 flex-1 text-sm">
                      {h.size}-question exam
                      <span className="block text-xs text-fg-muted">{formatInTz(h.createdAt, tz, "datetime")}</span>
                    </span>
                    <span className="text-sm tnum">
                      {h.score}/{h.maxScore} · {h.percent}%
                    </span>
                    <Badge tone={h.passed ? "success" : "warning"}>{h.passed ? "Passed" : `Below ${EXAM_PASS_PERCENT}%`}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
