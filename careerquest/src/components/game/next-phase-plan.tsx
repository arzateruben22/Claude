"use client";

import { NotebookPen } from "lucide-react";
import { Button, Field, Textarea } from "@/components/ui";
import { saveNextPhasePlanAction } from "@/lib/game/actions";
import { MAX_PLAN_LENGTH, type NextPhasePlan } from "@/lib/game/campaign-meta";
import { useGameAction } from "./use-game-action";
import { formatInstant } from "./format";

/** The next-phase plan (Phase 3 mission, and the planning prompt after the campaign window). */
export function NextPhasePlanForm({
  plan,
  timezone,
  beyond,
  daysPast,
}: {
  plan: NextPhasePlan | null;
  timezone: string;
  beyond: boolean;
  daysPast: number;
}) {
  const [state, action, pending] = useGameAction(saveNextPhasePlanAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <section id="next-phase" aria-labelledby="plan-title" className="glass rounded-card p-5 scroll-mt-24">
      <h2 id="plan-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
        <NotebookPen className="h-4 w-4 text-fg-subtle" aria-hidden />
        Next-phase plan
      </h2>
      {beyond ? (
        <div className="mt-2 space-y-2 text-sm text-fg-muted">
          <p>
            You are {daysPast} {daysPast === 1 ? "day" : "days"} past the planned window and still searching. That is common, and every application,
            follow-up and lesson so far still counts. Searches take as long as they take; the work you put in compounds.
          </p>
          <p>
            Use this plan to decide what to keep, what to change and which paths to add (apprenticeship recruitment windows, new target companies,
            different job titles). You can also start a fresh campaign window in Settings → Campaign.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-fg-muted">
          A short plan for after day 90 if you are still searching: what is working, what to change and which paths to try next.
        </p>
      )}
      <form action={action} className="mt-3 grid gap-3">
        <Field label="Your plan" htmlFor="plan-text" errors={errors?.text} hint={`Up to ${MAX_PLAN_LENGTH.toLocaleString("en-US")} characters. Only you can see it.`}>
          <Textarea id="plan-text" name="text" rows={6} maxLength={MAX_PLAN_LENGTH} defaultValue={plan?.text ?? ""} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-fg-subtle">{plan ? `Last saved ${formatInstant(plan.updatedAt, timezone)}` : "Not written yet."}</p>
          <Button type="submit" size="sm" loading={pending}>
            Save plan
          </Button>
        </div>
      </form>
    </section>
  );
}
