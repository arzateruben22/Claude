"use client";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { createTargetCompanyAction, updateTargetCompanyAction, type DiscoveryActionData } from "@/lib/discovery/actions";
import { PRIORITY_LABELS } from "@/lib/discovery/schemas";
import type { TargetCompanyView } from "@/lib/discovery/companies";
import { useDiscoveryForm } from "./use-discovery-form";

/** Add (no `company`) or edit a target company. */
export function TargetCompanyForm({
  company,
  categories,
  onDone,
}: {
  company?: TargetCompanyView;
  categories: readonly string[];
  onDone?: (data: DiscoveryActionData) => void;
}) {
  const editing = Boolean(company);
  const { errors, pending, formProps } = useDiscoveryForm(editing ? updateTargetCompanyAction : createTargetCompanyAction, {
    resetOnSuccess: !editing,
    onSuccess: onDone,
  });
  const id = (k: string) => `tc-${company?.id ?? "new"}-${k}`;
  return (
    <form {...formProps} className="space-y-3" noValidate>
      {company && <input type="hidden" name="companyId" value={company.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company name" htmlFor={id("name")} errors={errors.name}>
          <Input id={id("name")} name="name" defaultValue={company?.name} maxLength={200} required />
        </Field>
        <Field label="Priority" htmlFor={id("priority")} errors={errors.priority}>
          <Select id={id("priority")} name="priority" defaultValue={String(company?.priority ?? 2)}>
            {([1, 2, 3] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Careers page (optional)" htmlFor={id("careers")} errors={errors.careersUrl}>
          <Input id={id("careers")} name="careersUrl" type="url" inputMode="url" defaultValue={company?.careersUrl ?? ""} maxLength={2048} placeholder="https://…/careers" />
        </Field>
        <Field label="Website (optional)" htmlFor={id("website")} errors={errors.website}>
          <Input id={id("website")} name="website" type="url" inputMode="url" defaultValue={company?.website ?? ""} maxLength={2048} />
        </Field>
        <Field label="Category (optional)" htmlFor={id("category")} errors={errors.category}>
          <Input id={id("category")} name="category" list={id("category-options")} defaultValue={company?.category ?? ""} maxLength={80} placeholder="Electrical contractor" />
          <datalist id={id("category-options")}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Notes (optional)" htmlFor={id("notes")} errors={errors.notes} className="sm:col-span-2">
          <Textarea id={id("notes")} name="notes" defaultValue={company?.notes ?? ""} rows={2} maxLength={2000} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {editing ? "Save changes" : "Add company"}
        </Button>
      </div>
    </form>
  );
}
