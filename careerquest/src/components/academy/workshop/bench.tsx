"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2, Lightbulb, Lock, RotateCcw, XCircle } from "lucide-react";
import { submitWorkshopAction } from "@/lib/academy/actions";
import type { WorkshopOutcome } from "@/lib/academy/service";
import { parseNumericInput } from "@/lib/academy/grading";
import { layoutSchematic } from "@/lib/academy/schematic";
import { parseQuantity, solveCircuit } from "@/lib/academy/solver";
import { ANSWER_PREFIXES, checkNumericTask, formatMeasurement, toBaseUnits, type PublicWorkshop } from "@/lib/academy/workshop";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SimulationNotice } from "../badges";
import { InlineMarkdown } from "../markdown";
import { SchematicView } from "./schematic-view";
import { Multimeter, meterQuantity, type MeterMode } from "./multimeter";
import { BenchSandbox } from "./sandbox";

type NumericState = { raw: string; prefix: string; committed: boolean; value: number | null; correct: boolean; expected: number | null };
type ChoiceState = { choice: number | null; committed: boolean };

/**
 * Interactive simulated bench with two modes:
 * - Exercise (graded): predict → commit → the meter reveals the reading. Numeric answers are
 *   checked instantly against the solver (they follow from the published circuit); fault-finding
 *   choices are graded on the server when the report is submitted, which records the QuizAttempt.
 * - Experiment (ungraded): edit the circuit freely and watch held meter readings update.
 */
export function WorkshopBench({ workshop }: { workshop: PublicWorkshop }) {
  const [run, setRun] = useState(0);
  const [view, setView] = useState<"exercise" | "experiment">("exercise");
  const [experimented, setExperimented] = useState(false);

  return (
    <div className="space-y-5">
      <SimulationNotice />
      <div role="tablist" aria-label="Bench mode" className="inline-flex gap-1 rounded-ctl bg-surface-strong p-1">
        {(
          [
            ["exercise", "Exercise (graded)"],
            ["experiment", "Experiment (ungraded)"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`bench-tab-${key}`}
            aria-selected={view === key}
            aria-controls={`bench-panel-${key}`}
            onClick={() => {
              setView(key);
              if (key === "experiment") setExperimented(true);
            }}
            className={cn("rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors", view === key ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-hover")}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="bench-panel-exercise" aria-labelledby="bench-tab-exercise" hidden={view !== "exercise"}>
        <BenchRun
          key={run}
          workshop={workshop}
          experimented={experimented}
          onReset={() => {
            setRun((r) => r + 1);
            setExperimented(false);
          }}
        />
      </div>
      <div role="tabpanel" id="bench-panel-experiment" aria-labelledby="bench-tab-experiment" hidden={view !== "experiment"}>
        <BenchSandbox circuit={workshop.circuit} />
      </div>
    </div>
  );
}

function BenchRun({ workshop, experimented, onReset }: { workshop: PublicWorkshop; experimented: boolean; onReset: () => void }) {
  const solution = solveCircuit(workshop.circuit);
  const schematic = layoutSchematic(workshop.circuit);
  const [state, formAction, pending] = useActionState(submitWorkshopAction, null);
  const [numeric, setNumeric] = useState<Record<string, NumericState>>({});
  const [choices, setChoices] = useState<Record<string, ChoiceState>>({});
  const [measuredFirst, setMeasuredFirst] = useState<string[]>([]);
  const [target, setTarget] = useState<string>("source");
  const [mode, setMode] = useState<MeterMode>("V");
  const [held, setHeld] = useState<string | null>(null);
  const [hints, setHints] = useState(0);

  const outcome: WorkshopOutcome | null = state?.ok ? state.data : null;
  const error = state && !state.ok ? state.error : null;
  const current = meterQuantity(mode, target);
  const pendingTask = workshop.tasks.find((t) => t.type === "numeric" && t.quantity === current && !numeric[t.id]?.committed);
  const committedCount = workshop.tasks.filter((t) => (t.type === "numeric" ? numeric[t.id]?.committed : choices[t.id]?.committed)).length;
  const flag = (id: string) => setMeasuredFirst((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const measure = (quantity: string) => {
    setHeld(quantity);
    const task = workshop.tasks.find((t) => t.type === "numeric" && t.quantity === quantity && !numeric[t.id]?.committed);
    if (task) flag(task.id);
  };

  const commitNumeric = (taskId: string) => {
    const task = workshop.tasks.find((t) => t.id === taskId);
    if (!task || task.type !== "numeric") return;
    const s = numeric[taskId] ?? { raw: "", prefix: task.unit, committed: false, value: null, correct: false, expected: null };
    const parsed = parseNumericInput(s.raw);
    if (parsed === null) return;
    const value = toBaseUnits(parsed, task.unit, s.prefix || task.unit);
    const { correct, expected } = checkNumericTask(solution, task, value);
    setNumeric((prev) => ({ ...prev, [taskId]: { ...s, committed: true, value, correct, expected } }));
    // Answers committed after free experimentation on this circuit cannot count as predictions.
    if (experimented) flag(taskId);
    // The meter now shows the real reading for that quantity (power is calculated, not metered).
    const q = parseQuantity(task.quantity);
    if (q && q.kind !== "P") {
      setMode(q.kind as MeterMode);
      setTarget(q.target === "total" ? "source" : q.target);
      setHeld(task.quantity);
    }
  };

  const setRaw = (taskId: string, unit: string, patch: Partial<NumericState>) =>
    setNumeric((prev) => {
      const base: NumericState = prev[taskId] ?? { raw: "", prefix: unit, committed: false, value: null, correct: false, expected: null };
      return { ...prev, [taskId]: { ...base, ...patch } };
    });

  return (
    <div className="space-y-5">
      {experimented && !outcome && committedCount < workshop.tasks.length && (
        <Alert tone="info" title="You experimented with this circuit">
          Answers you commit from now on are marked “Measured”, so this run cannot be a clean run. Use “Run the bench again” after
          submitting for a fresh attempt.
        </Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="bench-schematic" className="glass rounded-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="bench-schematic" className="text-sm font-medium">
              Schematic
            </h2>
            <p className="text-xs text-fg-subtle">Tap a part to probe it</p>
          </div>
          <div className="overflow-x-auto rounded-ctl border border-line bg-bg-elevated p-2">
            <SchematicView schematic={schematic} selected={target} onSelect={setTarget} title={`Schematic: ${workshop.title}`} />
          </div>
          {workshop.circuit.faults.length > 0 && (
            <p className="mt-2 text-xs text-fg-muted">
              Fault in this scenario: {workshop.circuit.faults.map((f) => `${f.id} ${f.fault === "open" ? "open (∞ Ω)" : "shorted (0 Ω)"}`).join(", ")}.
            </p>
          )}
        </section>

        <Multimeter
          id="exercise-meter"
          solution={solution}
          targets={["source", ...solution.order]}
          target={target}
          onTarget={setTarget}
          mode={mode}
          onMode={setMode}
          held={held}
          onMeasure={measure}
          note={
            pendingTask ? (
              <p className="text-xs text-warning">Measuring now reveals the answer to a task you have not committed yet; that task will be marked “Measured”.</p>
            ) : (
              <p className="text-xs text-fg-subtle">The display stays blank until you commit a prediction or press Measure.</p>
            )
          }
        />
      </div>

      <section aria-labelledby="bench-tasks" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="bench-tasks" className="text-lg font-semibold tracking-tight">
            Tasks
          </h2>
          <p className="text-xs text-fg-muted">Predict first, then commit. Each answer is final for this run.</p>
        </div>
        <ol className="space-y-3">
          {workshop.tasks.map((task, i) => {
            if (task.type === "numeric") {
              const s = numeric[task.id];
              const inputId = `task-${task.id}`;
              const measured = measuredFirst.includes(task.id);
              const tolerance =
                task.toleranceType === "relative" ? `±${(task.tolerance * 100).toFixed(1).replace(/\.0$/, "")}%` : `±${formatMeasurement(task.tolerance, task.unit)}`;
              return (
                <li key={task.id} className="rounded-card border border-line bg-surface p-4" data-testid={`task-${task.id}`}>
                  <p className="text-sm text-fg">
                    <span className="mr-2 font-semibold text-accent tnum">{i + 1}.</span>
                    <InlineMarkdown source={task.question} />
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {task.label} · tolerance {tolerance}
                  </p>
                  {s?.committed ? (
                    <div className={cn("mt-3 flex flex-wrap items-center gap-2 text-sm", s.correct ? "text-success" : "text-danger")} role="status">
                      {s.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                      <span className="font-medium">{s.correct ? "Correct" : "Off"}</span>
                      <span className="text-fg-muted">
                        you said {formatMeasurement(s.value ?? 0, task.unit)} · bench {parseQuantity(task.quantity)?.kind === "P" ? "calculates" : "reads"}{" "}
                        {s.expected === null ? "—" : formatMeasurement(s.expected, task.unit)}
                      </span>
                      {measured && <Badge tone="warning">Measured before answering</Badge>}
                    </div>
                  ) : (
                    <form
                      className="mt-3 flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitNumeric(task.id);
                      }}
                    >
                      <label htmlFor={inputId} className="sr-only">
                        Your answer for task {i + 1}
                      </label>
                      <input
                        id={inputId}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="Prediction"
                        value={s?.raw ?? ""}
                        onChange={(e) => setRaw(task.id, task.unit, { raw: e.target.value })}
                        className={cn(inputClasses, "w-36 tnum")}
                      />
                      <label htmlFor={`${inputId}-unit`} className="sr-only">
                        Unit for task {i + 1}
                      </label>
                      <select
                        id={`${inputId}-unit`}
                        value={s?.prefix ?? task.unit}
                        onChange={(e) => setRaw(task.id, task.unit, { prefix: e.target.value })}
                        className={cn(inputClasses, "w-24")}
                      >
                        {(ANSWER_PREFIXES[task.unit] ?? [{ symbol: task.unit, factor: 1 }]).map((p) => (
                          <option key={p.symbol} value={p.symbol}>
                            {p.symbol}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" disabled={parseNumericInput(s?.raw ?? "") === null}>
                        Commit
                      </Button>
                      {measured && <Badge tone="warning">Measured before answering</Badge>}
                    </form>
                  )}
                </li>
              );
            }
            const c = choices[task.id];
            return (
              <li key={task.id} className="rounded-card border border-line bg-surface p-4" data-testid={`task-${task.id}`}>
                <fieldset disabled={c?.committed} className="space-y-2">
                  <legend className="text-sm text-fg">
                    <span className="mr-2 font-semibold text-accent tnum">{i + 1}.</span>
                    <InlineMarkdown source={task.question} />
                  </legend>
                  {task.choices.map((choice, ci) => (
                    <label
                      key={ci}
                      className="flex cursor-pointer items-start gap-2.5 rounded-ctl border border-line px-3 py-2 text-sm hover:bg-surface-hover has-[:checked]:border-accent/60 has-[:checked]:bg-accent-soft"
                    >
                      <input
                        type="radio"
                        name={`choice-${task.id}`}
                        checked={c?.choice === ci}
                        onChange={() => setChoices((prev) => ({ ...prev, [task.id]: { choice: ci, committed: false } }))}
                        className="mt-0.5 accent-[var(--accent)]"
                      />
                      <span>
                        <InlineMarkdown source={choice} />
                      </span>
                    </label>
                  ))}
                </fieldset>
                {c?.committed ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
                    <Lock className="h-3.5 w-3.5" aria-hidden /> Locked in — graded when you submit the bench report.
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    disabled={c?.choice === null || c?.choice === undefined}
                    onClick={() => setChoices((prev) => ({ ...prev, [task.id]: { choice: prev[task.id]?.choice ?? null, committed: true } }))}
                  >
                    Lock in answer
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {workshop.hints.length > 0 && (
        <section aria-labelledby="bench-hints" className="rounded-card border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="bench-hints" className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-gold" aria-hidden /> Hints
            </h2>
            {hints < workshop.hints.length && (
              <Button variant="ghost" size="sm" onClick={() => setHints((h) => h + 1)}>
                Show {hints === 0 ? "a hint" : "another hint"} ({hints}/{workshop.hints.length})
              </Button>
            )}
          </div>
          {hints > 0 && (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-fg-muted">
              {workshop.hints.slice(0, hints).map((h, i) => (
                <li key={i}>
                  <InlineMarkdown source={h} />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {outcome ? (
        <WorkshopResults outcome={outcome} workshop={workshop} onReset={onReset} />
      ) : (
        <form action={formAction} className="glass-strong sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-card px-4 py-3 lg:bottom-4">
          <input type="hidden" name="workshopKey" value={workshop.key} />
          {workshop.tasks.map((t) => {
            if (t.type === "numeric") {
              const s = numeric[t.id];
              return s?.committed && s.value !== null ? <input key={t.id} type="hidden" name={`answer.${t.id}`} value={String(s.value)} /> : null;
            }
            const c = choices[t.id];
            return c?.committed && c.choice !== null ? <input key={t.id} type="hidden" name={`answer.${t.id}`} value={String(c.choice)} /> : null;
          })}
          {measuredFirst.map((id) => (
            <input key={id} type="hidden" name="measured" value={id} />
          ))}
          <p className="min-w-40 flex-1 text-xs text-fg-muted tnum" aria-live="polite">
            {committedCount} of {workshop.tasks.length} tasks committed
            {committedCount < workshop.tasks.length ? " · uncommitted tasks count as wrong" : ""}
          </p>
          {error && (
            <p className="w-full text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={pending} disabled={committedCount === 0}>
            Submit bench report
          </Button>
        </form>
      )}
    </div>
  );
}

export function WorkshopResults({ outcome, workshop, onReset }: { outcome: WorkshopOutcome; workshop: PublicWorkshop; onReset?: () => void }) {
  const questions = new Map(workshop.tasks.map((t) => [t.id, t.question]));
  return (
    <section aria-label="Bench report result" className="space-y-3" data-testid="workshop-results">
      <Alert
        tone={outcome.cleanRun ? "success" : outcome.allCorrect ? "info" : "warning"}
        title={outcome.cleanRun ? `Clean run · ${outcome.score} of ${outcome.maxScore} correct` : `${outcome.score} of ${outcome.maxScore} correct`}
      >
        {outcome.cleanRun
          ? outcome.firstClear
            ? "Every task correct and every reading predicted before measuring. Saved to your bench history and counted toward Academy quiz missions (the workshop never awards XP)."
            : "Every task correct and predicted before measuring. Saved to your bench history."
          : outcome.allCorrect
            ? "All correct, but at least one answer was read off the meter (or committed after experimenting) before you predicted it. Run it again and predict every value first for a clean run."
            : "Saved to your bench history. Review the readings below and run the bench again."}
      </Alert>
      <ol className="space-y-2">
        {outcome.results.map((r, i) => (
          <li key={r.id} className="rounded-ctl border border-line bg-surface px-3 py-2.5 text-sm">
            <p className="text-fg">
              <span className="mr-2 font-semibold text-accent tnum">{i + 1}.</span>
              <InlineMarkdown source={questions.get(r.id) ?? r.id} />
            </p>
            <p className={cn("mt-1 flex flex-wrap items-center gap-1.5", r.correct ? "text-success" : "text-danger")}>
              {r.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
              {r.correct ? "Correct" : r.answered ? "Incorrect" : "Not answered"}
              <span className="text-fg-muted">
                {r.given !== null ? `· you: ${r.given}` : ""} · answer: {r.expected}
              </span>
              {r.measuredFirst && <Badge tone="warning">Measured first</Badge>}
            </p>
            {r.explanation && <p className="mt-1 text-fg-muted">{r.explanation}</p>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {onReset && (
          <Button variant="secondary" onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Run the bench again
          </Button>
        )}
        <Link href="/academy/workshop" className={buttonClasses("ghost")}>
          All exercises
        </Link>
      </div>
    </section>
  );
}
