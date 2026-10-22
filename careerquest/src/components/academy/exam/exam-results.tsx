"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { EXAM_PASS_PERCENT } from "@/lib/academy/exam";
import { cn } from "@/lib/utils";
import { InlineMarkdown, Markdown } from "../markdown";

export type ExamResultItem = {
  id: string;
  areaLabel: string;
  prompt: string | null;
  choices: string[];
  selected: number | null;
  correctIndex: number | null;
  correct: boolean;
  explanation: string;
  necReference: string | null;
};

export type ExamResultView = {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  xpAwarded?: number;
  byArea: { key: string; label: string; correct: number; total: number; percent: number }[];
  items: ExamResultItem[];
};

/** Score, results by content area and a per-question review with explanations and NEC references. */
export function ExamResults({ result, heading = "Your result" }: { result: ExamResultView; heading?: string }) {
  const [onlyMissed, setOnlyMissed] = useState(false);
  const items = onlyMissed ? result.items.filter((i) => !i.correct) : result.items;
  const weak = result.byArea.filter((a) => a.percent < EXAM_PASS_PERCENT);

  return (
    <div className="space-y-5" data-testid="exam-results">
      <section
        aria-label={heading}
        className={cn("rounded-card border p-5", result.passed ? "border-success/40 bg-success-soft" : "border-warning/40 bg-warning-soft")}
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-fg-muted">{heading}</p>
        <div className="mt-1 flex flex-wrap items-end gap-3">
          <p className="text-4xl font-semibold tracking-tight tnum">{result.percent}%</p>
          <p className="pb-1 text-sm text-fg-muted tnum">
            {result.score} of {result.maxScore} correct · practice pass mark {EXAM_PASS_PERCENT}%
          </p>
          <Badge tone={result.passed ? "success" : "warning"} className="mb-1.5">
            {result.passed ? "Passed (practice)" : "Below the practice pass mark"}
          </Badge>
          {result.xpAwarded ? (
            <Badge tone="gold" className="mb-1.5">
              +{result.xpAwarded} Electrician XP
            </Badge>
          ) : null}
        </div>
        {result.passed && result.xpAwarded === 0 && (
          <p className="mt-2 text-sm text-fg-muted">Practice-exam XP is earned once per day; this pass is recorded in your history.</p>
        )}
        <p className="mt-2 text-xs text-fg-muted">
          A practice score is not a prediction of the state exam result. The real exam uses scaled scoring and its own question pool.
        </p>
      </section>

      <section aria-labelledby="exam-by-area" className="glass rounded-card p-5">
        <h2 id="exam-by-area" className="text-sm font-medium">
          Results by area
        </h2>
        <ul className="mt-3 space-y-3">
          {result.byArea.map((a) => (
            <li key={a.key}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{a.label}</span>
                <span className={cn("shrink-0 tnum", a.percent < EXAM_PASS_PERCENT ? "text-warning" : "text-success")}>
                  {a.correct}/{a.total} · {a.percent}%
                </span>
              </div>
              <ProgressBar
                value={a.correct}
                max={a.total}
                tone={a.percent < EXAM_PASS_PERCENT ? "warning" : "success"}
                className="mt-1.5"
                label={`${a.label}: ${a.percent}%`}
              />
            </li>
          ))}
        </ul>
        {weak.length > 0 && (
          <Alert tone="info" title="Focus next" className="mt-4">
            {weak.map((a) => a.label).join(", ")} — below {EXAM_PASS_PERCENT}% in this attempt. Revisit the matching Academy lessons, then
            take a fresh exam.
          </Alert>
        )}
      </section>

      <section aria-labelledby="exam-review" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="exam-review" className="text-lg font-semibold tracking-tight">
            Question review
          </h2>
          <Checkbox label="Show only missed questions" checked={onlyMissed} onChange={(e) => setOnlyMissed(e.target.checked)} />
        </div>
        {items.length === 0 && <p className="text-sm text-fg-muted">No missed questions in this attempt.</p>}
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("flex items-center gap-1 text-sm font-medium", item.correct ? "text-success" : "text-danger")}>
                  {item.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                  {item.correct ? "Correct" : item.selected === null ? "Not answered" : "Incorrect"}
                </span>
                <Badge>{item.areaLabel}</Badge>
                {item.necReference && (
                  <Badge tone="info">
                    <BookOpen className="h-3 w-3" aria-hidden />
                    NEC {item.necReference}
                  </Badge>
                )}
              </div>
              {item.prompt ? (
                <>
                  <p className="mt-2 text-sm text-fg">
                    <InlineMarkdown source={item.prompt} />
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {item.choices.map((c, ci) => {
                      const isCorrect = ci === item.correctIndex;
                      const isSelected = ci === item.selected;
                      return (
                        <li
                          key={ci}
                          className={cn(
                            "rounded-ctl border px-3 py-1.5",
                            isCorrect ? "border-success/40 bg-success-soft text-fg" : isSelected ? "border-danger/40 bg-danger-soft text-fg" : "border-line text-fg-muted",
                          )}
                        >
                          <InlineMarkdown source={c} />
                          {isCorrect && <span className="ml-2 text-xs font-medium text-success">correct answer</span>}
                          {isSelected && !isCorrect && <span className="ml-2 text-xs font-medium text-danger">your answer</span>}
                          {isSelected && isCorrect && <span className="ml-2 text-xs font-medium text-success">· your answer</span>}
                        </li>
                      );
                    })}
                  </ul>
                  {item.explanation && <Markdown source={item.explanation} className="mt-2" />}
                </>
              ) : (
                <p className="mt-2 text-sm text-fg-subtle">This question has since been removed from the bank.</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
