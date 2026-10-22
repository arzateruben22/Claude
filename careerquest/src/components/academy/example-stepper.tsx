"use client";

import { useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineMarkdown } from "./markdown";

/** Worked example: the student reveals one solution step at a time, then the answer. */
export function ExampleStepper({ id, title, problem, steps, answer }: { id: string; title?: string; problem: string; steps: string[]; answer?: string }) {
  const [shown, setShown] = useState(0);
  const total = steps.length + (answer ? 1 : 0);
  const done = shown >= total;
  const answerVisible = Boolean(answer) && shown > steps.length;

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Worked example</p>
      <h3 id={`${id}-title`} className="mt-1 text-sm font-semibold text-fg">
        {title ?? "Try it before you reveal the steps"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-fg">
        <InlineMarkdown source={problem} />
      </p>

      {shown > 0 && (
        <ol className="mt-4 space-y-2" aria-live="polite">
          {steps.slice(0, shown).map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-fg-muted animate-rise">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent tnum">
                {i + 1}
              </span>
              <span className="leading-relaxed">
                <InlineMarkdown source={step} />
              </span>
            </li>
          ))}
        </ol>
      )}

      {answerVisible && answer && (
        <p className="mt-4 rounded-ctl border border-success/30 bg-success-soft px-3 py-2 text-sm text-fg animate-rise">
          <span className="font-medium text-success">Answer: </span>
          <InlineMarkdown source={answer} />
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!done && (
          <Button variant="secondary" size="sm" onClick={() => setShown((s) => Math.min(total, s + 1))}>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            {shown < steps.length ? (shown === 0 ? "Show the first step" : "Show next step") : "Show the answer"}
          </Button>
        )}
        {!done && (
          <Button variant="ghost" size="sm" onClick={() => setShown(total)}>
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Reveal all
          </Button>
        )}
        {shown > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShown(0)}>
            Hide steps
          </Button>
        )}
        <span className="ml-auto text-xs text-fg-subtle tnum">
          {Math.min(shown, steps.length)} / {steps.length} steps
        </span>
      </div>
    </section>
  );
}
