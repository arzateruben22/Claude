"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { gradeItem, type ItemResult } from "@/lib/academy/grading";
import type { LessonItem } from "@/lib/academy/schema";
import { cn } from "@/lib/utils";
import { InlineMarkdown, Markdown } from "./markdown";

type ItemState = { value: string; result: ItemResult | null };

/**
 * Practice problems with instant feedback. Practice answers are checked in the browser (they are
 * not graded or saved); only the quiz is graded on the server.
 */
export function PracticePanel({ lessonKey, items }: { lessonKey: string; items: LessonItem[] }) {
  const [state, setState] = useState<Record<string, ItemState>>({});
  const checked = items.filter((i) => state[i.id]?.result);
  const correct = checked.filter((i) => state[i.id]?.result?.correct).length;

  const update = (id: string, patch: Partial<ItemState>) =>
    setState((prev) => ({ ...prev, [id]: { value: prev[id]?.value ?? "", result: prev[id]?.result ?? null, ...patch } }));

  if (!items.length) return null;

  return (
    <section aria-labelledby={`${lessonKey}-practice`} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`${lessonKey}-practice`} className="text-lg font-semibold tracking-tight">
            Practice problems
          </h2>
          <p className="text-xs text-fg-muted">Instant feedback. Practice is not graded or saved — the quiz is.</p>
        </div>
        <p className="text-sm text-fg-muted tnum" aria-live="polite" data-testid="practice-score">
          {checked.length ? `${correct} of ${checked.length} checked correct` : `${items.length} problems`}
        </p>
      </div>

      <ol className="space-y-3">
        {items.map((item, idx) => {
          const s = state[item.id];
          const result = s?.result ?? null;
          const inputId = `${lessonKey}-p-${item.id}`;
          return (
            <li key={item.id} className="rounded-card border border-line bg-surface p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  update(item.id, { result: gradeItem(item, s?.value ?? "") });
                }}
                className="space-y-3"
                noValidate
              >
                <fieldset disabled={Boolean(result)} className="space-y-3">
                  <legend className="text-sm text-fg">
                    <span className="mr-2 font-semibold text-accent tnum">{idx + 1}.</span>
                    <InlineMarkdown source={item.prompt} />
                  </legend>
                  {item.type === "numeric" ? (
                    <div className="flex items-center gap-2">
                      <label htmlFor={inputId} className="sr-only">
                        Your answer{item.unit ? ` in ${item.unit}` : ""}
                      </label>
                      <input
                        id={inputId}
                        inputMode="decimal"
                        autoComplete="off"
                        className={cn(inputClasses, "max-w-48 tnum")}
                        value={s?.value ?? ""}
                        onChange={(e) => update(item.id, { value: e.target.value })}
                        placeholder="Your answer"
                      />
                      {item.unit && <span className="text-sm text-fg-muted">{item.unit}</span>}
                    </div>
                  ) : (
                    <div className="grid gap-2" role="radiogroup" aria-label="Choices">
                      {item.choices.map((choice, ci) => (
                        <label
                          key={ci}
                          className={cn(
                            "flex cursor-pointer items-start gap-2.5 rounded-ctl border border-line px-3 py-2 text-sm hover:bg-surface-hover",
                            s?.value === String(ci) && "border-accent/60 bg-accent-soft",
                          )}
                        >
                          <input
                            type="radio"
                            name={inputId}
                            value={ci}
                            checked={s?.value === String(ci)}
                            onChange={() => update(item.id, { value: String(ci) })}
                            className="mt-0.5 accent-[var(--accent)]"
                          />
                          <span>
                            <InlineMarkdown source={choice} />
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                {result ? (
                  <div
                    role="status"
                    className={cn(
                      "rounded-ctl border px-3 py-2.5 text-sm",
                      result.correct ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft",
                    )}
                  >
                    <p className="flex items-center gap-1.5 font-medium">
                      {result.correct ? (
                        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                      ) : (
                        <XCircle className="h-4 w-4 text-danger" aria-hidden />
                      )}
                      {result.correct ? "Correct" : result.answered ? "Not quite" : "No answer entered"}
                      {!result.correct && <span className="font-normal text-fg-muted"> — correct answer: {result.expected}</span>}
                    </p>
                    {result.explanation && <Markdown source={result.explanation} className="mt-1.5" />}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => update(item.id, { result: null, value: result.correct ? s?.value ?? "" : "" })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Try again
                    </Button>
                  </div>
                ) : (
                  <Button type="submit" variant="secondary" size="sm" disabled={!s?.value?.trim()}>
                    Check answer
                  </Button>
                )}
              </form>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
