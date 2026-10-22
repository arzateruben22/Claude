"use client";

import { useCallback, useState } from "react";
import { Briefcase, PartyPopper, RotateCcw } from "lucide-react";
import { Alert, Badge, Button, Dialog, Field, Input, Select } from "@/components/ui";
import { reopenJobSearchAction, reportEmploymentAction } from "@/lib/game/actions";
import type { Employment } from "@/lib/game/campaign-meta";
import { formatCurrency } from "@/lib/format";
import { useGameAction } from "./use-game-action";
import { formatDayKey } from "./format";

function EmploymentForm({ initial, todayKey, onDone }: { initial: Employment | null; todayKey: string; onDone: () => void }) {
  const [state, action, pending] = useGameAction(reportEmploymentAction, onDone);
  const [period, setPeriod] = useState<"HOURLY" | "ANNUAL">(initial?.period ?? "HOURLY");
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" noValidate>
      <Field label="Employer" htmlFor="emp-employer" errors={errors?.employer} className="sm:col-span-2">
        <Input id="emp-employer" name="employer" required maxLength={120} defaultValue={initial?.employer ?? ""} autoComplete="organization" />
      </Field>
      <Field label="Job title (optional)" htmlFor="emp-title" errors={errors?.title} className="sm:col-span-2">
        <Input id="emp-title" name="title" maxLength={120} defaultValue={initial?.title ?? ""} />
      </Field>
      <Field label="Start date" htmlFor="emp-start" errors={errors?.startDate}>
        <Input id="emp-start" name="startDate" type="date" required defaultValue={initial?.startDate ?? todayKey} />
      </Field>
      <Field label="Pay period" htmlFor="emp-period" errors={errors?.period}>
        <Select id="emp-period" name="period" value={period} onChange={(e) => setPeriod(e.target.value === "ANNUAL" ? "ANNUAL" : "HOURLY")}>
          <option value="HOURLY">Hourly</option>
          <option value="ANNUAL">Annual salary</option>
        </Select>
      </Field>
      <Field label={period === "HOURLY" ? "Hourly rate (USD)" : "Annual salary (USD)"} htmlFor="emp-amount" errors={errors?.amount}>
        <Input id="emp-amount" name="amount" type="number" inputMode="decimal" min={0} step="0.01" required defaultValue={initial?.amount ?? ""} />
      </Field>
      <Field
        label="Hours per week"
        htmlFor="emp-hours"
        errors={errors?.hoursPerWeek}
        hint={period === "HOURLY" ? "Annualized as rate × hours × 52 (no overtime assumed)." : "Kept for reference."}
      >
        <Input id="emp-hours" name="hoursPerWeek" type="number" inputMode="numeric" min={1} max={80} step={1} defaultValue={initial?.hoursPerWeek ?? 40} />
      </Field>
      <p className="sm:col-span-2 text-xs text-fg-muted">
        Saved as <strong>self-reported</strong>. Operation Get Hired is marked complete and job-search missions pause; the $150K Electrician Path keeps going.
      </p>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {initial ? "Save changes" : "Save my new job"}
        </Button>
      </div>
    </form>
  );
}

function ReopenForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useGameAction(reopenJobSearchAction, onDone);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="confirm" value="REOPEN" />
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Keep it
        </Button>
        <Button type="submit" variant="outline" loading={pending}>
          Re-open job search
        </Button>
      </div>
    </form>
  );
}

/** Employment card: report an accepted job (self-reported) or show / update the current one. */
export function EmploymentCard({ employment, hired, todayKey }: { employment: Employment | null; hired: boolean; todayKey: string }) {
  const [dialog, setDialog] = useState<"form" | "reopen" | null>(null);
  const close = useCallback(() => setDialog(null), []);
  return (
    <section aria-labelledby="employment-title" className="glass rounded-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="employment-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-fg-subtle" aria-hidden />
          Employment
        </h2>
        {hired && <Badge tone="neutral">Self-reported</Badge>}
      </div>
      {hired && employment ? (
        <div className="mt-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <PartyPopper className="h-4 w-4 text-gold" aria-hidden />
            {employment.title ? `${employment.title} at ${employment.employer}` : employment.employer}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-fg-subtle">Start date</dt>
              <dd className="tnum">{formatDayKey(employment.startDate, true)}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Pay</dt>
              <dd className="tnum">
                {employment.period === "HOURLY" ? `${formatCurrency(employment.amount, { cents: true })}/hr · ${employment.hoursPerWeek} h/wk` : `${formatCurrency(employment.amount)}/yr`}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-fg-subtle">Annualized (stored as current salary)</dt>
              <dd className="tnum">{formatCurrency(employment.annualized)}/yr</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog("form")}>
              Update details
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog("reopen")}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Re-open job search
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-fg-muted">
            Landed a job? Record it here. It is stored as self-reported; offers recorded on an application in the tracker stay the verified source for offer XP.
          </p>
          <Button className="mt-3" size="sm" variant="gold" onClick={() => setDialog("form")} data-testid="accept-job">
            <PartyPopper className="h-4 w-4" aria-hidden />I accepted a job
          </Button>
        </div>
      )}
      {dialog === "form" && (
        <Dialog open onClose={close} title={hired ? "Update your job" : "I accepted a job"} description="Self-reported details. You can update them any time.">
          <EmploymentForm initial={employment} todayKey={todayKey} onDone={close} />
        </Dialog>
      )}
      {dialog === "reopen" && (
        <Dialog open onClose={close} title="Re-open Operation Get Hired?" description="Use this if the job ended or was recorded by mistake." size="sm">
          <ul className="text-sm text-fg-muted list-disc pl-5 space-y-1">
            <li>The job moves to your history and your current salary is cleared.</li>
            <li>Job-search missions come back for the current day, week and phase.</li>
            <li>XP, achievements and logged paychecks are kept.</li>
          </ul>
          <ReopenForm onDone={close} />
        </Dialog>
      )}
    </section>
  );
}
