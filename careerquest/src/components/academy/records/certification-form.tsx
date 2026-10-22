"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { saveCertificationStatusAction } from "@/lib/academy/certification/actions";
import type { CertDates } from "@/lib/academy/certification/timeline";
import type { CertDateField } from "@/lib/academy/certification/form";
import { useRecordsAction } from "./use-records-action";

type DateFieldDef = { name: CertDateField; label: string; hint?: string; pastOnly: boolean };

const GROUPS: { title: string; fields: DateFieldDef[] }[] = [
  {
    title: "Electrician Trainee",
    fields: [
      { name: "traineeRegisteredAt", label: "Trainee registration date", pastOnly: true },
      { name: "traineeExpiresAt", label: "Registration expires", hint: "From your trainee card. Leave empty to estimate one year after registration.", pastOnly: false },
    ],
  },
  {
    title: "Certification exam",
    fields: [
      { name: "examApplicationAt", label: "Exam application submitted", pastOnly: true },
      { name: "examEligibleAt", label: "Eligibility notice received", pastOnly: true },
      { name: "examScheduledAt", label: "Exam date (scheduled)", pastOnly: false },
      { name: "examPassedAt", label: "Exam passed", pastOnly: true },
    ],
  },
  {
    title: "Certification",
    fields: [
      { name: "certifiedAt", label: "Certified on", pastOnly: true },
      { name: "certificateExpiresAt", label: "Certificate expires", hint: "From your card. Leave empty to estimate three years after certification.", pastOnly: false },
    ],
  },
];

/** Self-reported certification dates for one classification. */
export function CertificationForm({
  classification,
  classificationName,
  dates,
  notes,
  todayKey,
}: {
  classification: string;
  classificationName: string;
  dates: CertDates;
  notes: string | null;
  todayKey: string;
}) {
  const uid = useId();
  const [state, action, pending] = useRecordsAction(saveCertificationStatusAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="classification" value={classification} />
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="space-y-3">
          <legend className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">{g.title}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.fields.map((f) => (
              <Field key={f.name} label={f.label} htmlFor={`${uid}-${f.name}`} errors={errors?.[f.name]} hint={f.hint}>
                <Input id={`${uid}-${f.name}`} name={f.name} type="date" defaultValue={dates[f.name] ?? ""} max={f.pastOnly ? todayKey : undefined} />
              </Field>
            ))}
            {g.title === "Electrician Trainee" && (
              <Field label="Approved school / curriculum" htmlFor={`${uid}-school`} errors={errors?.schoolEnrolled} hint="Name of the DIR-approved school you are enrolled in.">
                <Input id={`${uid}-school`} name="schoolEnrolled" maxLength={200} defaultValue={dates.schoolEnrolled ?? ""} />
              </Field>
            )}
          </div>
        </fieldset>
      ))}
      <Field label="Notes (optional)" htmlFor={`${uid}-notes`} errors={errors?.notes}>
        <Textarea id={`${uid}-notes`} name="notes" maxLength={2000} defaultValue={notes ?? ""} placeholder="Application number, test center, CE courses completed…" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          Save {classificationName} timeline
        </Button>
        <p className="text-xs text-fg-subtle">Self-reported. Clear a field to remove the date.</p>
      </div>
    </form>
  );
}
