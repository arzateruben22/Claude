"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { completeOnboardingAction, type SettingsResult } from "@/lib/profile/actions";
import type { ProfileView } from "@/lib/profile/service";
import { PRIMARY_TRADE_OPTIONS } from "@/lib/profile/constants";
import { CAREER_INTEREST_OPTIONS } from "@/lib/validation/profile";
import { XP } from "@/lib/game/xp-config";
import { cn } from "@/lib/utils";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Field, Input, Select } from "@/components/ui";
import { TargetsFields } from "./targets-fields";
import { Toggle } from "./toggle";

const STEPS = [
  { title: "Goals", blurb: "How long the campaign runs and what it should earn.", fields: ["campaignLengthDays", "immediateSalaryTarget", "longTermSalaryTarget"] },
  { title: "Pathway", blurb: "The trade you are pursuing and what else interests you.", fields: ["primaryTrade", "careerInterests", "openToApprenticeships", "apprenticeshipMinHourly"] },
  {
    title: "Targets",
    blurb: "A weekly pace you can sustain, plus private listing filters.",
    fields: ["dailyApplicationTarget", "workdaysPerWeek", "weeklyApplicationTarget", "excludeCompanyVehicleJobs", "excludeDrivingRecordJobs", "excludeCdlJobs"],
  },
] as const;

/** Index of the first step that owns one of the returned field errors, or null. Pure. */
export function stepForErrors(fieldErrors: Record<string, string[]>): number | null {
  const idx = STEPS.findIndex((s) => s.fields.some((f) => f in fieldErrors));
  return idx >= 0 ? idx : null;
}

export function OnboardingWizard({ defaults, alreadyCompleted }: { defaults: ProfileView; alreadyCompleted: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [openToApprenticeships, setOpenToApprenticeships] = useState(defaults.openToApprenticeships);

  const submit = useCallback(async (prev: SettingsResult | null, formData: FormData) => {
    const r = await completeOnboardingAction(prev, formData);
    if (!r.ok && r.fieldErrors) {
      const target = stepForErrors(r.fieldErrors);
      if (target !== null) setStep(target);
    }
    return r;
  }, []);
  const [state, action, pending] = useActionState(submit, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  const stepIsValid = (index: number) => {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${index}"]`);
    if (!section) return true;
    for (const el of Array.from(section.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"))) {
      if (!el.reportValidity()) return false;
    }
    return true;
  };
  const next = () => {
    if (stepIsValid(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));
  const last = step === STEPS.length - 1;

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5" aria-label="Campaign setup">
      <ol className="flex items-center gap-2 sm:gap-4 text-xs" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? "step" : undefined} className={cn("flex items-center gap-2", i === step ? "text-fg" : "text-fg-muted")}>
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold tnum",
                i < step ? "border-success text-success bg-success-soft" : i === step ? "border-accent text-accent bg-accent-soft" : "border-line text-fg-subtle",
              )}
            >
              {i + 1}
            </span>
            <span className={cn(i !== step && "hidden sm:inline")}>{s.title}</span>
          </li>
        ))}
        <li className="ml-auto text-fg-subtle tnum" aria-hidden>
          Step {step + 1} of {STEPS.length}
        </li>
      </ol>

      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}

      <fieldset data-step="0" hidden={step !== 0} className="space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Step 1 · {STEPS[0].title}</CardTitle>
              <CardDescription>{STEPS[0].blurb}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Campaign length (days)" htmlFor="ob-campaignLengthDays" errors={fe?.campaignLengthDays} hint="90 days is the classic plan: Launch, Momentum, Close." className="max-w-xs">
              <Input id="ob-campaignLengthDays" name="campaignLengthDays" type="number" inputMode="numeric" min={7} max={365} required defaultValue={defaults.campaignLengthDays} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Immediate salary target (annual)" htmlFor="ob-immediateSalaryTarget" errors={fe?.immediateSalaryTarget} hint="What the next role needs to pay.">
                <Input id="ob-immediateSalaryTarget" name="immediateSalaryTarget" type="number" inputMode="numeric" min={0} required defaultValue={defaults.immediateSalaryTarget} />
              </Field>
              <Field label="Long-term salary target (annual)" htmlFor="ob-longTermSalaryTarget" errors={fe?.longTermSalaryTarget} hint="Where the path should lead.">
                <Input id="ob-longTermSalaryTarget" name="longTermSalaryTarget" type="number" inputMode="numeric" min={0} required defaultValue={defaults.longTermSalaryTarget} />
              </Field>
            </div>
          </CardContent>
        </Card>
      </fieldset>

      <fieldset data-step="1" hidden={step !== 1} className="space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Step 2 · {STEPS[1].title}</CardTitle>
              <CardDescription>{STEPS[1].blurb}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Primary trade" htmlFor="ob-primaryTrade" errors={fe?.primaryTrade} className="max-w-sm">
              <Select id="ob-primaryTrade" name="primaryTrade" defaultValue={defaults.primaryTrade}>
                {PRIMARY_TRADE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <p className="block text-xs font-medium text-fg-muted mb-1.5">Also interested in</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CAREER_INTEREST_OPTIONS.map((o) => (
                  <Checkbox key={o} name="careerInterests" value={o} defaultChecked={defaults.careerInterests.includes(o)} label={o} />
                ))}
              </div>
              {fe?.careerInterests && <p role="alert" className="mt-1 text-xs text-danger">{fe.careerInterests[0]}</p>}
            </div>
            <div className="border-t border-line">
              <Toggle
                id="ob-openToApprenticeships"
                name="openToApprenticeships"
                label="Open to apprenticeships"
                description="Include union and non-union programs in discovery and the career map."
                checked={openToApprenticeships}
                onChange={(e) => setOpenToApprenticeships(e.target.checked)}
              />
            </div>
            {openToApprenticeships && (
              <Field label="Minimum starting hourly rate (optional)" htmlFor="ob-apprenticeshipMinHourly" errors={fe?.apprenticeshipMinHourly} className="max-w-xs">
                <Input id="ob-apprenticeshipMinHourly" name="apprenticeshipMinHourly" type="number" inputMode="decimal" min={0} max={500} step={0.25} defaultValue={defaults.apprenticeshipMinHourly ?? ""} placeholder="e.g. 22.50" />
              </Field>
            )}
          </CardContent>
        </Card>
      </fieldset>

      <fieldset data-step="2" hidden={step !== 2} className="space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Step 3 · {STEPS[2].title}</CardTitle>
              <CardDescription>{STEPS[2].blurb}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TargetsFields idPrefix="ob-" defaults={defaults} errors={fe} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Private eligibility filters</CardTitle>
              <CardDescription>
                Preferences only. CareerQuest stores no license or driving-record details — just these switches, used to flag or filter
                listings.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-line">
            <Toggle id="ob-excludeCompanyVehicleJobs" name="excludeCompanyVehicleJobs" label="Exclude roles that require a company vehicle" defaultChecked={defaults.excludeCompanyVehicleJobs} />
            <Toggle id="ob-excludeDrivingRecordJobs" name="excludeDrivingRecordJobs" label="Exclude roles that require an unrestricted driving record" defaultChecked={defaults.excludeDrivingRecordJobs} />
            <Toggle id="ob-excludeCdlJobs" name="excludeCdlJobs" label="Exclude roles that require a CDL" defaultChecked={defaults.excludeCdlJobs} />
          </CardContent>
        </Card>
      </fieldset>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || pending}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        {last ? (
          <Button type="submit" loading={pending}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {alreadyCompleted ? "Save changes" : `Finish setup (+${XP.PROFILE_COMPLETED} XP)`}
          </Button>
        ) : (
          <Button type="button" onClick={next}>
            Next
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}
