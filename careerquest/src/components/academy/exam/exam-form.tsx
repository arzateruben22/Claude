"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { submitExamAction } from "@/lib/academy/actions";
import type { PublicExamQuestion } from "@/lib/academy/exam";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InlineMarkdown } from "../markdown";
import { ExamResults } from "./exam-results";

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * The practice exam. Questions arrive without answer keys; the server re-derives the selection
 * from (size, seed), grades it and stores the attempt. The optional timer runs in the browser only
 * and submits the exam automatically when it reaches zero.
 */
export function ExamForm({
  size,
  seed,
  questions,
  timed,
  durationSeconds,
}: {
  size: number;
  seed: number;
  questions: PublicExamQuestion[];
  timed: boolean;
  durationSeconds: number;
}) {
  const [state, formAction, pending] = useActionState(submitExamAction, null);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState(durationSeconds);
  const formRef = useRef<HTMLFormElement>(null);
  const autoSubmitted = useRef(false);
  const outcome = state?.ok ? state.data : null;
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (!timed || outcome) return;
    const start = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, durationSeconds - Math.floor((Date.now() - start) / 1000));
      setRemaining(left);
      if (left === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        window.clearInterval(id);
        formRef.current?.requestSubmit();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [timed, durationSeconds, outcome]);

  if (outcome) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    return (
      <div className="space-y-5">
        <ExamResults
          result={{
            score: outcome.score,
            maxScore: outcome.maxScore,
            percent: outcome.percent,
            passed: outcome.passed,
            xpAwarded: outcome.xpAwarded,
            byArea: outcome.byArea,
            items: outcome.results.map((r) => ({
              id: r.id,
              areaLabel: byId.get(r.id)?.areaLabel ?? r.area,
              prompt: r.prompt,
              choices: r.choices,
              selected: r.selected,
              correctIndex: r.correctIndex,
              correct: r.correct,
              explanation: r.explanation,
              necReference: r.necReference,
            })),
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Link href={`/academy/exam/take?size=${size}${timed ? "&timed=1" : ""}`} className={buttonClasses("primary")}>
            Take a fresh {size}-question exam
          </Link>
          <Link href="/academy/exam" className={buttonClasses("ghost")}>
            Back to practice exams
          </Link>
        </div>
      </div>
    );
  }

  const count = Object.values(answered).filter(Boolean).length;
  const low = timed && remaining <= 300;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="space-y-4"
      onChange={(e) => {
        const data = new FormData(e.currentTarget);
        setAnswered(Object.fromEntries(questions.map((q) => [q.id, data.get(`answer.${q.id}`) !== null])));
      }}
    >
      <input type="hidden" name="size" value={size} />
      <input type="hidden" name="seed" value={seed} />
      <input type="hidden" name="questionIds" value={questions.map((q) => q.id).join(",")} />
      {error && (
        <Alert tone="danger" title="Not submitted">
          {error}{" "}
          <Link href={`/academy/exam/take?size=${size}`} className="text-accent underline">
            Start a new exam
          </Link>
        </Alert>
      )}

      <nav aria-label="Question navigator" className="glass rounded-card p-3">
        <p className="mb-2 text-xs text-fg-muted">Jump to a question (filled = answered)</p>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => (
            <a
              key={q.id}
              href={`#q-${q.id}`}
              aria-label={`Question ${i + 1}${answered[q.id] ? ", answered" : ", not answered"}`}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] tnum",
                answered[q.id] ? "border-accent/50 bg-accent-soft text-accent" : "border-line text-fg-muted hover:bg-surface-hover",
              )}
            >
              {i + 1}
            </a>
          ))}
        </div>
      </nav>

      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={q.id} id={`q-${q.id}`} className="scroll-mt-24 rounded-card border border-line bg-surface p-4">
            <fieldset className="space-y-2">
              <legend className="text-sm text-fg">
                <span className="mr-2 font-semibold text-accent tnum">{i + 1}.</span>
                <InlineMarkdown source={q.prompt} />
              </legend>
              <p className="text-[11px] text-fg-subtle">{q.areaLabel}</p>
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
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="glass-strong sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-card px-4 py-3 lg:bottom-4">
        {timed && (
          <p
            className={cn("flex items-center gap-1.5 font-mono text-sm tnum", low ? "text-warning" : "text-fg")}
            role="timer"
            aria-live={low ? "polite" : "off"}
            aria-label={`Time remaining ${clock(remaining)}`}
          >
            <Clock className="h-4 w-4" aria-hidden />
            {clock(remaining)}
          </p>
        )}
        <p className="min-w-32 flex-1 text-xs text-fg-muted tnum">
          {count} of {questions.length} answered{count < questions.length ? " · blanks count as wrong" : ""}
        </p>
        <Button type="submit" loading={pending}>
          Submit exam
        </Button>
      </div>
    </form>
  );
}
