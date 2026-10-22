"use client";

import { useActionState, useId, useState } from "react";
import { Calculator, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { dateFromKey } from "@/lib/dates";
import { formatNumber, formatPercent } from "@/lib/format";
import { saveTargetsAction, type SaveTargetsResult } from "@/lib/goals/actions";
import { computePace } from "@/lib/goals/calculator";
import { fmtDay, perDay } from "./format";

export type CalculatorDefaults = {
  dailyTarget: number;
  workdaysPerWeek: number;
  campaignLengthDays: number;
  completed: number;
  /** Observed response rate as a percentage 0..100, or null when there is no data. */
  responseRatePct: number | null;
};

type Props = { defaults: CalculatorDefaults; todayKey: string; campaignStartKey: string };

function num(v: string, fallback: number): number {
  const n = Number(v);
  return v.trim() === "" || !Number.isFinite(n) ? fallback : n;
}

function Out({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-ctl bg-surface-strong px-3 py-2.5 min-w-0">
      <p className="text-[11px] text-fg-muted truncate">{label}</p>
      <p className="text-lg font-semibold tnum truncate" data-out={label}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

export function GoalsCalculator({ defaults, todayKey, campaignStartKey }: Props) {
  const id = useId();
  const [daily, setDaily] = useState(String(defaults.dailyTarget));
  const [workdays, setWorkdays] = useState(String(defaults.workdaysPerWeek));
  const [length, setLength] = useState(String(defaults.campaignLengthDays));
  const [completed, setCompleted] = useState(String(defaults.completed));
  const [available, setAvailable] = useState("");
  const [responsePct, setResponsePct] = useState(defaults.responseRatePct === null ? "" : String(Math.round(defaults.responseRatePct * 10) / 10));
  const [state, formAction, pending] = useActionState<SaveTargetsResult | null, FormData>(saveTargetsAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  const dailyN = Math.max(0, num(daily, 0));
  const workdaysN = Math.min(7, Math.max(1, num(workdays, 5)));
  const lengthN = Math.max(1, num(length, 90));
  const pace = computePace({
    dailyTarget: dailyN,
    workdaysPerWeek: workdaysN,
    campaignLengthDays: lengthN,
    campaignStartDate: dateFromKey(campaignStartKey),
    today: dateFromKey(todayKey),
    completedApplications: Math.max(0, num(completed, 0)),
    availableOpportunities: available.trim() === "" ? null : Math.max(0, num(available, 0)),
    historicalResponseRate: responsePct.trim() === "" ? null : Math.min(100, Math.max(0, num(responsePct, 0))) / 100,
  });
  const weekly = dailyN * workdaysN;
  const upcoming = pace.projectedMilestoneDates.filter((m) => !m.achieved).slice(0, 4);

  return (
    <section aria-labelledby={`${id}-title`} className="glass rounded-card p-5">
      <h2 id={`${id}-title`} className="text-sm font-medium tracking-tight flex items-center gap-2">
        <Calculator className="h-4 w-4 text-fg-subtle" aria-hidden />
        Pace calculator
      </h2>
      <p className="text-xs text-fg-muted mt-0.5">Change any input to see the numbers update. Saving stores the first three as your profile targets.</p>

      <form action={formAction} className="mt-4 grid gap-4 lg:grid-cols-2" noValidate>
        <div className="grid grid-cols-2 gap-3 content-start">
          <Field label="Daily target" htmlFor={`${id}-daily`} errors={fe?.dailyApplicationTarget} hint="Applications per workday">
            <Input id={`${id}-daily`} name="dailyApplicationTarget" type="number" inputMode="numeric" min={0} max={100} step={1} value={daily} onChange={(e) => setDaily(e.target.value)} required />
          </Field>
          <Field label="Days per week" htmlFor={`${id}-workdays`} errors={fe?.workdaysPerWeek}>
            <Input id={`${id}-workdays`} name="workdaysPerWeek" type="number" inputMode="numeric" min={1} max={7} step={1} value={workdays} onChange={(e) => setWorkdays(e.target.value)} required />
          </Field>
          <Field label="Campaign length (days)" htmlFor={`${id}-length`} errors={fe?.campaignLengthDays}>
            <Input id={`${id}-length`} name="campaignLengthDays" type="number" inputMode="numeric" min={7} max={365} step={1} value={length} onChange={(e) => setLength(e.target.value)} required />
          </Field>
          <Field label="Already completed" htmlFor={`${id}-completed`} hint="Defaults to applications this campaign">
            <Input id={`${id}-completed`} name="completedApplications" type="number" inputMode="numeric" min={0} step={1} value={completed} onChange={(e) => setCompleted(e.target.value)} />
          </Field>
          <Field label="Available opportunities" htmlFor={`${id}-available`} hint="Optional: qualifying postings you can see">
            <Input id={`${id}-available`} name="availableOpportunities" type="number" inputMode="numeric" min={0} step={1} value={available} onChange={(e) => setAvailable(e.target.value)} placeholder="—" />
          </Field>
          <Field label="Response rate (%)" htmlFor={`${id}-response`} hint={defaults.responseRatePct === null ? "No observed rate yet" : "Defaults to your observed rate"}>
            <Input id={`${id}-response`} name="historicalResponseRate" type="number" inputMode="decimal" min={0} max={100} step={0.1} value={responsePct} onChange={(e) => setResponsePct(e.target.value)} placeholder="—" />
          </Field>
          <input type="hidden" name="weeklyApplicationTarget" value={weekly} />
          <div className="col-span-2 flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" loading={pending}>
              <Save className="h-4 w-4" aria-hidden />
              Save as my targets
            </Button>
            <span className="text-xs text-fg-subtle tnum">Weekly target will be {formatNumber(weekly)}</span>
          </div>
          {state?.ok && (
            <div className="col-span-2">
              <Alert tone="success" title="Targets saved">
                {state.data.dailyApplicationTarget}/day on {state.data.workdaysPerWeek} days a week for {state.data.campaignLengthDays} days.
              </Alert>
            </div>
          )}
          {state && !state.ok && !state.fieldErrors && (
            <div className="col-span-2">
              <Alert tone="danger">{state.error}</Alert>
            </div>
          )}
        </div>

        <div aria-live="polite" className="grid grid-cols-2 gap-2 content-start">
          <Out label="Campaign goal" value={formatNumber(pace.campaignGoalApplications)} hint={`${dailyN} × ${workdaysN} × ${(lengthN / 7).toFixed(1)} weeks`} />
          <Out label="Remaining to goal" value={formatNumber(pace.remainingToGoal)} hint={pace.beyondCampaign ? "campaign window passed" : `${pace.daysRemaining} days left`} />
          <Out label="Required pace" value={pace.requiredDailyPace === null ? "—" : perDay(pace.requiredDailyPace)} hint={pace.requiredWeeklyPace === null ? "no days left in campaign" : `${pace.requiredWeeklyPace.toFixed(1)}/week`} />
          <Out label="Observed pace" value={perDay(pace.observedDailyPace)} hint={`${pace.observedWeeklyPace.toFixed(1)}/week · day ${pace.campaignDay || 1}`} />
          <Out label="Goal date at observed pace" value={pace.projectedGoalDate ? fmtDay(pace.projectedGoalDate, true) : pace.remainingToGoal === 0 ? "reached" : "—"} hint="projection, not a guarantee" />
          <Out
            label="Expected responses (estimate)"
            value={pace.expectedResponses === null ? "—" : formatNumber(Math.round(pace.expectedResponses))}
            hint={pace.expectedResponsesAtGoal === null ? "enter a response rate" : `~${formatNumber(Math.round(pace.expectedResponsesAtGoal))} at goal · ${formatPercent(num(responsePct, 0) / 100, 1)} rate`}
          />
          {pace.opportunity && (
            <div className="col-span-2 rounded-ctl bg-surface-strong px-3 py-2.5 text-xs text-fg-muted">
              {pace.opportunity.goalExceedsAvailable ? (
                <>
                  Your goal of {formatNumber(pace.campaignGoalApplications)} exceeds the {formatNumber(pace.opportunity.available)} opportunities you can see; the reachable goal is{" "}
                  <span className="text-fg font-medium tnum">{formatNumber(pace.opportunity.reachableGoal)}</span>. Widening categories or sources would raise the ceiling.
                </>
              ) : (
                <>
                  {formatNumber(pace.opportunity.remainingAvailable)} opportunities remain
                  {pace.opportunity.runwayDays !== null ? ` — about ${pace.opportunity.runwayDays} days of runway at ${dailyN}/day.` : "."}
                </>
              )}
            </div>
          )}
          <div className="col-span-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-fg-subtle mb-1.5">Next milestones at observed pace</p>
            {upcoming.length === 0 ? (
              <p className="text-xs text-fg-muted">All milestones reached.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-1.5 text-xs">
                {upcoming.map((m) => (
                  <li key={m.milestone} className="flex items-center justify-between rounded-ctl bg-surface-strong px-2.5 py-1.5 tnum">
                    <span className="font-medium">{formatNumber(m.milestone)}</span>
                    <span className="text-fg-muted">{m.projectedDate ? `~${fmtDay(m.projectedDate)}` : "no pace yet"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
