"use client";

import { useState } from "react";
import { updateProfileAction } from "@/lib/profile/actions";
import type { ProfileView } from "@/lib/profile/service";
import { PRIMARY_TRADE_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/profile/constants";
import { CAREER_INTEREST_OPTIONS } from "@/lib/validation/profile";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Field, Input, Select } from "@/components/ui";
import { RegionsInput } from "./regions-input";
import { Toggle } from "./toggle";
import { useSettingsAction } from "./use-settings-action";

export function ProfileForm({ profile }: { profile: ProfileView }) {
  const [state, action, pending] = useSettingsAction(updateProfileAction);
  const [openToApprenticeships, setOpenToApprenticeships] = useState(profile.openToApprenticeships);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const timezones = TIMEZONE_OPTIONS.some((t) => t.value === profile.timezone)
    ? [...TIMEZONE_OPTIONS]
    : [{ value: profile.timezone, label: profile.timezone }, ...TIMEZONE_OPTIONS];

  return (
    <form action={action} noValidate className="space-y-4" aria-label="Profile and goals">
      {state && !state.ok && state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>About you</CardTitle>
            <CardDescription>Where you are searching and how CareerQuest counts your days.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Name" htmlFor="name" errors={fe?.name}>
            <Input id="name" name="name" defaultValue={profile.name} autoComplete="name" required maxLength={80} />
          </Field>
          <RegionsInput defaultValue={profile.regions} errors={fe?.regions} />
          <Field label="Timezone" htmlFor="timezone" errors={fe?.timezone} hint="Daily targets, streaks and campaign days roll over at midnight in this zone.">
            <Select id="timezone" name="timezone" defaultValue={profile.timezone}>
              {timezones.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Salary goals</CardTitle>
            <CardDescription>Annual, in US dollars. Used by the salary simulator and the career map — never shared.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Immediate salary target" htmlFor="immediateSalaryTarget" errors={fe?.immediateSalaryTarget} hint="What you need from the next role.">
            <Input id="immediateSalaryTarget" name="immediateSalaryTarget" type="number" inputMode="numeric" min={0} defaultValue={profile.immediateSalaryTarget} required />
          </Field>
          <Field label="Long-term salary target" htmlFor="longTermSalaryTarget" errors={fe?.longTermSalaryTarget} hint="Where the career path should lead.">
            <Input id="longTermSalaryTarget" name="longTermSalaryTarget" type="number" inputMode="numeric" min={0} defaultValue={profile.longTermSalaryTarget} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Pathway</CardTitle>
            <CardDescription>Your primary trade drives the academy and career map; interests widen job discovery.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Primary trade" htmlFor="primaryTrade" errors={fe?.primaryTrade}>
            <Select id="primaryTrade" name="primaryTrade" defaultValue={profile.primaryTrade}>
              {PRIMARY_TRADE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset>
            <legend className="block text-xs font-medium text-fg-muted mb-1.5">Career interests</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CAREER_INTEREST_OPTIONS.map((o) => (
                <Checkbox key={o} name="careerInterests" value={o} defaultChecked={profile.careerInterests.includes(o)} label={o} />
              ))}
            </div>
            {fe?.careerInterests && <p role="alert" className="mt-1 text-xs text-danger">{fe.careerInterests[0]}</p>}
          </fieldset>
          <div className="border-t border-line">
            <Toggle
              id="openToApprenticeships"
              name="openToApprenticeships"
              label="Open to apprenticeships"
              description="Show union and non-union apprenticeship programs alongside direct-hire roles."
              checked={openToApprenticeships}
              onChange={(e) => setOpenToApprenticeships(e.target.checked)}
            />
          </div>
          {openToApprenticeships && (
            <Field label="Minimum starting hourly rate" htmlFor="apprenticeshipMinHourly" errors={fe?.apprenticeshipMinHourly} hint="Optional. Programs that publish a lower verified starting wage get flagged, not hidden.">
              <Input
                id="apprenticeshipMinHourly"
                name="apprenticeshipMinHourly"
                type="number"
                inputMode="decimal"
                min={0}
                max={500}
                step={0.25}
                defaultValue={profile.apprenticeshipMinHourly ?? ""}
                placeholder="e.g. 22.50"
              />
            </Field>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
