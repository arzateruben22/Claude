"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Award, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { submitLessonQuizAction } from "@/lib/academy/actions";
import type { LessonQuizOutcome } from "@/lib/academy/service";
import type { PublicQuiz } from "@/lib/academy/quiz";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { InlineMarkdown, Markdown } from "./markdown";

/**
 * Lesson quiz. Answers are posted to a server action that grades them against the server-side
 * key, records the QuizAttempt and lesson progress, and only then returns per-question results.
 */
export function QuizForm({ lessonKey, lessonTitle, quiz }: { lessonKey: string; lessonTitle: string; quiz: PublicQuiz }) {
  const [state, formAction, pending] = useActionState(submitLessonQuizAction, null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [answered, setAnswered] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  const outcome = state?.ok && state.data.attemptId !== dismissed ? state.data : null;
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (outcome) resultsRef.current?.focus();
  }, [outcome]);

  if (outcome) {
    return (
      <div ref={resultsRef} tabIndex={-1} className="outline-none">
        <QuizResults
          outcome={outcome}
          quiz={quiz}
          lessonKey={lessonKey}
          lessonTitle={lessonTitle}
          onRetake={() => {
            setDismissed(outcome.attemptId);
            setFormKey((k) => k + 1);
            setAnswered(0);
          }}
        />
      </div>
    );
  }

  const total = quiz.questions.length;
  return (
    <form
      key={formKey}
      action={formAction}
      noValidate
      className="space-y-4"
      onChange={(e) => {
        const data = new FormData(e.currentTarget);
        setAnswered(quiz.questions.filter((q) => String(data.get(`answer.${q.id}`) ?? "").trim() !== "").length);
      }}
    >
      <input type="hidden" name="lessonKey" value={lessonKey} />
      {error && (
        <Alert tone="danger" title="Not submitted">
          {error}
        </Alert>
      )}
      <ol className="space-y-3">
        {quiz.questions.map((q, i) => {
          const fieldId = `quiz-${q.id}`;
          return (
            <li key={q.id} className="rounded-card border border-line bg-surface p-4">
              <fieldset className="space-y-3">
                <legend className="text-sm text-fg">
                  <span className="mr-2 font-semibold text-accent tnum">{i + 1}.</span>
                  <InlineMarkdown source={q.prompt} />
                </legend>
                {q.type === "numeric" ? (
                  <div className="flex items-center gap-2">
                    <label htmlFor={fieldId} className="sr-only">
                      Answer to question {i + 1}
                      {q.unit ? ` in ${q.unit}` : ""}
                    </label>
                    <input id={fieldId} name={`answer.${q.id}`} inputMode="decimal" autoComplete="off" className={cn(inputClasses, "max-w-48 tnum")} placeholder="Your answer" />
                    {q.unit && <span className="text-sm text-fg-muted">{q.unit}</span>}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {q.choices.map((choice, ci) => (
                      <label
                        key={ci}
                        className="flex cursor-pointer items-start gap-2.5 rounded-ctl border border-line px-3 py-2 text-sm hover:bg-surface-hover has-[:checked]:border-accent/60 has-[:checked]:bg-accent-soft"
                      >
                        <input type="radio" name={`answer.${q.id}`} value={ci} className="mt-0.5 accent-[var(--accent)]" />
                        <span>
                          <InlineMarkdown source={choice} />
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="sticky bottom-20 lg:bottom-4 z-10 glass-strong rounded-card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-40 flex-1">
          <p className="text-xs text-fg-muted tnum" aria-live="polite">
            {answered} of {total} answered{answered < total ? ` · ${total - answered} blank (counted wrong)` : ""}
          </p>
          <ProgressBar value={answered} max={total} className="mt-1.5" label="Questions answered" />
        </div>
        <Button type="submit" loading={pending}>
          Submit answers
        </Button>
      </div>
    </form>
  );
}

export function QuizResults({
  outcome,
  quiz,
  lessonKey,
  lessonTitle,
  onRetake,
}: {
  outcome: LessonQuizOutcome;
  quiz: PublicQuiz;
  lessonKey: string;
  lessonTitle: string;
  onRetake?: () => void;
}) {
  const prompts = new Map(quiz.questions.map((q) => [q.id, q.prompt]));
  return (
    <div className="space-y-4" data-testid="quiz-results">
      <section
        aria-label="Quiz result"
        className={cn("rounded-card border p-5", outcome.passed ? "border-success/40 bg-success-soft" : "border-warning/40 bg-warning-soft")}
      >
        <div className="flex flex-wrap items-center gap-3">
          {outcome.passed ? <Award className="h-6 w-6 text-success" aria-hidden /> : <RotateCcw className="h-6 w-6 text-warning" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">
              {outcome.passed ? "Passed" : "Not passed yet"} · <span className="tnum">{outcome.percent}%</span>
            </p>
            <p className="text-sm text-fg-muted tnum">
              {outcome.score} of {outcome.maxScore} correct · passing score {outcome.passingScore}% · best {outcome.bestScore}% · attempt{" "}
              {outcome.attempts}
            </p>
          </div>
          {outcome.xpAwarded > 0 && (
            <Badge tone="gold" className="text-xs">
              +{outcome.xpAwarded} Electrician XP
            </Badge>
          )}
        </div>
        <p className="mt-3 text-sm">
          {outcome.completedNow
            ? `“${lessonTitle}” is now completed. Lessons that required it are unlocked.`
            : outcome.passed
              ? "You already completed this lesson; XP for a lesson is earned once, so retakes are for practice."
              : `You need ${outcome.passingScore}% to complete the lesson. Review the explanations below, revisit the lesson and retake the quiz any time.`}
        </p>
        {outcome.achievements.length > 0 && (
          <p className="mt-1 text-sm text-fg-muted">
            Achievement unlocked: {outcome.achievements.join(", ")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetake && (
            <Button variant="secondary" size="sm" onClick={onRetake}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Retake quiz
            </Button>
          )}
          <Link href={`/academy/lessons/${lessonKey}`} className={buttonClasses("ghost", "sm")}>
            Back to the lesson
          </Link>
          <Link href="/academy" className={buttonClasses("ghost", "sm")}>
            All lessons
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>

      <h2 className="text-lg font-semibold tracking-tight">Review</h2>
      <ol className="space-y-3">
        {outcome.results.map((r, i) => (
          <li key={r.id} className="rounded-card border border-line bg-surface p-4">
            <p className="text-sm text-fg">
              <span className="mr-2 font-semibold text-accent tnum">{i + 1}.</span>
              <InlineMarkdown source={prompts.get(r.id) ?? ""} />
            </p>
            <p className={cn("mt-2 flex items-center gap-1.5 text-sm font-medium", r.correct ? "text-success" : "text-danger")}>
              {r.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
              {r.correct ? "Correct" : r.answered ? "Incorrect" : "Not answered"}
            </p>
            <dl className="mt-1 grid gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[auto_1fr]">
              {r.given !== null && (
                <>
                  <dt className="text-fg-subtle">Your answer</dt>
                  <dd className="text-fg-muted">
                    <InlineMarkdown source={r.given} />
                  </dd>
                </>
              )}
              {!r.correct && (
                <>
                  <dt className="text-fg-subtle">Correct answer</dt>
                  <dd className="text-fg">
                    <InlineMarkdown source={r.expected} />
                  </dd>
                </>
              )}
            </dl>
            {r.explanation && <Markdown source={r.explanation} className="mt-2" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
