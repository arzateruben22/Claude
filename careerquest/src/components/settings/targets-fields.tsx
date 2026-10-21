"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { suggestedWeeklyTarget } from "@/lib/profile/schema";

export type TargetsDefaults = { dailyApplicationTarget: number; workdaysPerWeek: number; weeklyApplicationTarget: number };

/** Daily × workdays → weekly, with a one-click "use suggested". Shared by the campaign tab and the wizard. */
export function TargetsFields({ defaults, errors, idPrefix = "" }: { defaults: TargetsDefaults; errors?: Record<string, string[]>; idPrefix?: string }) {
  const [daily, setDaily] = useState(String(defaults.dailyApplicationTarget));
  const [workdays, setWorkdays] = useState(String(defaults.workdaysPerWeek));
  const [weekly, setWeekly] = useState(String(defaults.weeklyApplicationTarget));
  const suggested = suggestedWeeklyTarget(Number(daily), Number(workdays));
  const matches = weekly.trim() !== "" && Number(weekly) === suggested;
  const id = (k: string) => `${idPrefix}${k}`;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Daily application target" htmlFor={id("dailyApplicationTarget")} errors={errors?.dailyApplicationTarget} hint="Per workday.">
        <Input
          id={id("dailyApplicationTarget")}
          name="dailyApplicationTarget"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          required
          value={daily}
          onChange={(e) => setDaily(e.target.value)}
        />
      </Field>
      <Field label="Workdays per week" htmlFor={id("workdaysPerWeek")} errors={errors?.workdaysPerWeek} hint="1 to 7.">
        <Input
          id={id("workdaysPerWeek")}
          name="workdaysPerWeek"
          type="number"
          inputMode="numeric"
          min={1}
          max={7}
          required
          value={workdays}
          onChange={(e) => setWorkdays(e.target.value)}
        />
      </Field>
      <Field
        label="Weekly application target"
        htmlFor={id("weeklyApplicationTarget")}
        errors={errors?.weeklyApplicationTarget}
        hint={matches ? `Matches ${daily || 0} × ${workdays || 0} workdays.` : `Suggested: ${suggested} (${daily || 0} × ${workdays || 0}).`}
      >
        <Input
          id={id("weeklyApplicationTarget")}
          name="weeklyApplicationTarget"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          required
          value={weekly}
          onChange={(e) => setWeekly(e.target.value)}
        />
        <Button type="button" variant="ghost" size="sm" className="mt-1.5 -ml-2" disabled={matches} onClick={() => setWeekly(String(suggested))}>
          Use suggested ({suggested})
        </Button>
      </Field>
    </div>
  );
}
