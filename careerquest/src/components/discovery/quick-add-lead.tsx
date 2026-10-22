"use client";

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { useIsMounted } from "@/lib/hooks";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { createLeadAction } from "@/lib/discovery/actions";
import { ELIGIBILITY_FLAGS, ELIGIBILITY_FLAG_LABELS, emptyFlags, type EligibilityFlag, type EligibilityFlags } from "@/lib/discovery/eligibility";
import { parseLeadPaste, type LeadDraft } from "@/lib/discovery/paste";
import { hostLabel } from "./discovery-parts";
import { useDiscoveryForm } from "./use-discovery-form";

type FieldKey = "title" | "company" | "url" | "location" | "salaryText";
const FIELD_KEYS: FieldKey[] = ["title", "company", "url", "location", "salaryText"];
const EMPTY: Record<FieldKey, string> = { title: "", company: "", url: "", location: "", salaryText: "" };

/**
 * "Paste a job URL or posting text": parses on this device as you type (no network), pre-fills the
 * fields you have not edited, and shows the eligibility keywords it found as flags you can change.
 */
export function QuickAddLead({ categories }: { categories: readonly string[] }) {
  const mounted = useIsMounted();
  const [pasted, setPasted] = useState("");
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [fields, setFields] = useState<Record<FieldKey, string>>(EMPTY);
  const [auto, setAuto] = useState<ReadonlySet<FieldKey>>(new Set());
  const [flags, setFlags] = useState<EligibilityFlags>(emptyFlags());
  const [flagsTouched, setFlagsTouched] = useState(false);
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setPasted("");
    setDraft(null);
    setFields(EMPTY);
    setAuto(new Set());
    setFlags(emptyFlags());
    setFlagsTouched(false);
    setCategory("");
    setNotes("");
  };
  const { data, errors, pending, formProps } = useDiscoveryForm(createLeadAction, { onSuccess: reset });

  const onPaste = (value: string) => {
    setPasted(value);
    const next = value.trim() ? parseLeadPaste(value) : null;
    setDraft(next);
    const filled = { ...fields };
    const nextAuto = new Set(auto);
    for (const key of FIELD_KEYS) {
      if (fields[key] === "" || auto.has(key)) {
        filled[key] = (next?.[key] as string | null) ?? "";
        if (filled[key]) nextAuto.add(key);
        else nextAuto.delete(key);
      }
    }
    setFields(filled);
    setAuto(nextAuto);
    if (!flagsTouched) setFlags(next?.flags ?? emptyFlags());
  };
  const onField = (key: FieldKey, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setAuto((a) => {
      const n = new Set(a);
      n.delete(key);
      return n;
    });
  };
  const toggleFlag = (flag: EligibilityFlag, on: boolean) => {
    setFlagsTouched(true);
    setFlags((f) => ({ ...f, [flag]: on }));
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Add a lead</CardTitle>
          <CardDescription>
            Paste a job link or the posting text. It is read on this device only — CareerQuest never opens the link or contacts the job board.
          </CardDescription>
        </div>
        <ClipboardPaste className="h-5 w-5 shrink-0 text-fg-subtle" aria-hidden />
      </CardHeader>
      <CardContent>
        <form {...formProps} className="space-y-4" noValidate>
          {mounted && <input type="hidden" name="flagsReviewed" value="1" />}
          <Field label="Paste a job URL or posting text" htmlFor="lead-pasted" hint="Company, title, location, pay and driving/vehicle requirements are picked up when the text has them.">
            <Textarea id="lead-pasted" name="pasted" value={pasted} onChange={(e) => onPaste(e.target.value)} rows={3} maxLength={20000} placeholder="https://www.indeed.com/viewjob?jk=…  or the posting text" />
          </Field>
          {draft?.url && (
            <p className="text-xs text-fg-muted break-words">
              Link: <span className="text-fg">{hostLabel(draft.url)}</span> · Source: {SOURCE_LABELS[draft.platform]}
              {draft.detailsFrom === "url" ? " · Company/title read from the link path — check them." : ""}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Job title" htmlFor="lead-title" errors={errors.title}>
              <Input id="lead-title" name="title" value={fields.title} onChange={(e) => onField("title", e.target.value)} maxLength={200} required aria-invalid={Boolean(errors.title) || undefined} />
            </Field>
            <Field label="Company" htmlFor="lead-company" errors={errors.company}>
              <Input id="lead-company" name="company" value={fields.company} onChange={(e) => onField("company", e.target.value)} maxLength={200} required aria-invalid={Boolean(errors.company) || undefined} />
            </Field>
            <Field label="Posting link (optional)" htmlFor="lead-url" errors={errors.url}>
              <Input id="lead-url" name="url" type="url" inputMode="url" value={fields.url} onChange={(e) => onField("url", e.target.value)} maxLength={2048} aria-invalid={Boolean(errors.url) || undefined} />
            </Field>
            <Field label="Location (optional)" htmlFor="lead-location" errors={errors.location}>
              <Input id="lead-location" name="location" value={fields.location} onChange={(e) => onField("location", e.target.value)} maxLength={160} placeholder="Anaheim, CA" />
            </Field>
          </div>
          <details className="rounded-ctl border border-line px-3 py-2">
            <summary className="cursor-pointer text-sm text-fg-muted hover:text-fg">Pay, category and notes</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Pay as posted (optional)" htmlFor="lead-salary" errors={errors.salaryText} hint="E.g. “$32–$38/hr”. Used for the fit score.">
                <Input id="lead-salary" name="salaryText" value={fields.salaryText} onChange={(e) => onField("salaryText", e.target.value)} maxLength={120} />
              </Field>
              <Field label="Category (optional)" htmlFor="lead-category" errors={errors.category}>
                <Input id="lead-category" name="category" list="lead-category-options" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} />
                <datalist id="lead-category-options">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Notes (optional)" htmlFor="lead-notes" errors={errors.notes} className="sm:col-span-2">
                <Textarea id="lead-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={5000} />
              </Field>
            </div>
          </details>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-fg-muted">Requirements mentioned in the posting (flags only — never rejected)</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
              {ELIGIBILITY_FLAGS.map((flag) => (
                <Checkbox key={flag} name={flag} checked={flags[flag]} onChange={(e) => toggleFlag(flag, e.target.checked)} label={ELIGIBILITY_FLAG_LABELS[flag]} />
              ))}
            </div>
            {draft && draft.hits.length > 0 && (
              <p className="text-xs text-fg-muted">Found in the text: {draft.hits.map((h) => `“${h.phrase}”`).join(", ")}</p>
            )}
          </fieldset>
          {data?.href && data.tone === "info" && (
            <Alert tone="info" title={data.message}>
              <a href={data.href} className="text-accent hover:underline">
                {data.hrefLabel ?? "Open it"}
              </a>
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
              Clear
            </Button>
            <Button type="submit" loading={pending}>
              Save lead
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
