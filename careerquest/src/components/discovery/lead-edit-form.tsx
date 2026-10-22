"use client";

import { Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { updateLeadAction, type DiscoveryActionData } from "@/lib/discovery/actions";
import { ELIGIBILITY_FLAGS, ELIGIBILITY_FLAG_LABELS } from "@/lib/discovery/eligibility";
import type { LeadView } from "@/lib/discovery/leads";
import { useDiscoveryForm } from "./use-discovery-form";

/** Edit every field of a lead (flags are the user's to change; nothing is auto-rejected). */
export function LeadEditForm({ lead, categories, onDone }: { lead: LeadView; categories: readonly string[]; onDone: (data: DiscoveryActionData) => void }) {
  const { errors, pending, formProps } = useDiscoveryForm(updateLeadAction, { onSuccess: onDone });
  const id = (k: string) => `lead-${lead.id}-${k}`;
  return (
    <form {...formProps} className="space-y-3" noValidate>
      <input type="hidden" name="leadId" value={lead.id} />
      <input type="hidden" name="flagsReviewed" value="1" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Job title" htmlFor={id("title")} errors={errors.title}>
          <Input id={id("title")} name="title" defaultValue={lead.title} maxLength={200} required />
        </Field>
        <Field label="Company" htmlFor={id("company")} errors={errors.company}>
          <Input id={id("company")} name="company" defaultValue={lead.company} maxLength={200} required />
        </Field>
        <Field label="Posting link" htmlFor={id("url")} errors={errors.url}>
          <Input id={id("url")} name="url" type="url" inputMode="url" defaultValue={lead.url ?? ""} maxLength={2048} />
        </Field>
        <Field label="Location" htmlFor={id("location")} errors={errors.location}>
          <Input id={id("location")} name="location" defaultValue={lead.location ?? ""} maxLength={160} />
        </Field>
        <Field label="Pay as posted" htmlFor={id("salary")} errors={errors.salaryText}>
          <Input id={id("salary")} name="salaryText" defaultValue={lead.salaryText ?? ""} maxLength={120} />
        </Field>
        <Field label="Category" htmlFor={id("category")} errors={errors.category}>
          <Input id={id("category")} name="category" list={id("category-options")} defaultValue={lead.category ?? ""} maxLength={80} />
          <datalist id={id("category-options")}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Notes" htmlFor={id("notes")} errors={errors.notes} className="sm:col-span-2">
          <Textarea id={id("notes")} name="notes" defaultValue={lead.notes ?? ""} rows={3} maxLength={5000} />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-fg-muted">Requirements mentioned in the posting</legend>
        <div className="flex flex-col gap-2">
          {ELIGIBILITY_FLAGS.map((flag) => (
            <Checkbox key={flag} name={flag} defaultChecked={lead.flags[flag]} label={ELIGIBILITY_FLAG_LABELS[flag]} />
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
