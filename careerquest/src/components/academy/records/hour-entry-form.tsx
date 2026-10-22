"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { DocumentKind, HourVerification, WorkType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { createHourEntryAction, updateHourEntryAction, type HourEntryActionData } from "@/lib/academy/hours/actions";
import { MAX_ENTRY_HOURS, MIN_ENTRY_HOURS, VERIFICATION_HINTS, VERIFICATION_LABELS, WORK_TYPE_LABELS, WORK_TYPE_ORDER } from "@/lib/academy/hours/constants";
import { ACCEPT_ATTRIBUTE, ALLOWED_TYPES_LABEL, DOCUMENT_KIND_LABELS, HOUR_PROOF_KINDS, MAX_DOCUMENT_BYTES, MAX_DOCUMENT_LABEL } from "@/lib/documents/validation";
import { cn } from "@/lib/utils";
import { UPLOAD_TRANSPORT_ERROR, useRecordsAction } from "./use-records-action";
import { formatDayKey } from "./format";

export type HourEntryDefaults = {
  id: string;
  employer: string;
  supervisor: string | null;
  dateKey: string;
  hours: number;
  workType: WorkType;
  programId: string | null;
  description: string | null;
  verification: HourVerification;
  documentId: string | null;
};

type DocOption = { id: string; fileName: string; kind: DocumentKind; createdAt: Date | string };

const VERIFICATIONS: HourVerification[] = ["SELF_REPORTED", "EMPLOYER_VERIFIED", "OFFICIAL_RECORD"];

/** Log (or edit) a work-hour entry, optionally attaching proof that makes it count as verified. */
export function HourEntryForm({
  todayKey,
  programs,
  documents,
  entry,
}: {
  todayKey: string;
  programs: { id: string; name: string }[];
  documents: DocOption[];
  entry?: HourEntryDefaults;
}) {
  const router = useRouter();
  const uid = useId();
  const [verification, setVerification] = useState<HourVerification>(entry?.verification ?? "SELF_REPORTED");
  const [documentId, setDocumentId] = useState<string>(entry?.documentId ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const onSuccess = useCallback(
    (data: HourEntryActionData) => {
      void data;
      if (entry) {
        router.push("/academy/hours");
        return;
      }
      setVerification("SELF_REPORTED");
      setDocumentId("");
      setFileName(null);
    },
    [entry, router],
  );
  const [state, action, pending] = useRecordsAction(entry ? updateHourEntryAction : createHourEntryAction, {
    onSuccess,
    transportErrorMessage: UPLOAD_TRANSPORT_ERROR,
  });
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const wantsVerified = verification !== "SELF_REPORTED";
  const hasProof = Boolean(documentId || fileName);
  const id = (name: string) => `${uid}-${name}`;

  return (
    <form action={action} className="space-y-4" noValidate aria-describedby={id("intro")}>
      <p id={id("intro")} className="sr-only">
        Log hours you worked. Employer-verified and official-record hours need an attached document.
      </p>
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Employer" htmlFor={id("employer")} errors={errors?.employer}>
          <Input id={id("employer")} name="employer" required maxLength={120} defaultValue={entry?.employer ?? ""} autoComplete="organization" />
        </Field>
        <Field label="Supervisor (optional)" htmlFor={id("supervisor")} errors={errors?.supervisor} hint="The certified electrician or foreman who directed the work.">
          <Input id={id("supervisor")} name="supervisor" maxLength={120} defaultValue={entry?.supervisor ?? ""} />
        </Field>
        <Field label="Date worked" htmlFor={id("date")} errors={errors?.dateWorked}>
          <Input id={id("date")} name="dateWorked" type="date" required max={todayKey} defaultValue={entry?.dateKey ?? todayKey} />
        </Field>
        <Field label="Hours" htmlFor={id("hours")} errors={errors?.hours} hint={`${MIN_ENTRY_HOURS}–${MAX_ENTRY_HOURS} in quarter hours; at most 24 per date across entries.`}>
          <Input
            id={id("hours")}
            name="hours"
            type="number"
            inputMode="decimal"
            required
            min={MIN_ENTRY_HOURS}
            max={MAX_ENTRY_HOURS}
            step={0.25}
            defaultValue={entry ? String(entry.hours) : ""}
          />
        </Field>
        <Field label="Type of work" htmlFor={id("worktype")} errors={errors?.workType}>
          <Select id={id("worktype")} name="workType" defaultValue={entry?.workType ?? "COMMERCIAL"}>
            {WORK_TYPE_ORDER.map((w) => (
              <option key={w} value={w}>
                {WORK_TYPE_LABELS[w]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Training program (optional)" htmlFor={id("program")} errors={errors?.programId}>
          <Select id={id("program")} name="programId" defaultValue={entry?.programId ?? ""}>
            <option value="">No program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="What you worked on (optional)" htmlFor={id("description")} errors={errors?.description}>
        <Textarea id={id("description")} name="description" maxLength={1000} defaultValue={entry?.description ?? ""} placeholder="e.g. pulled wire for a tenant improvement, panel terminations" />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-xs font-medium text-fg-muted">How are these hours documented?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {VERIFICATIONS.map((v) => (
            <label
              key={v}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-ctl border p-3 text-sm transition-colors",
                verification === v ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-hover",
              )}
            >
              <input type="radio" name="verification" value={v} checked={verification === v} onChange={() => setVerification(v)} className="mt-0.5 accent-[var(--accent)]" />
              <span>
                <span className="font-medium">{VERIFICATION_LABELS[v]}</span>
                <span className="mt-0.5 block text-xs text-fg-muted">{VERIFICATION_HINTS[v]}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError errors={errors?.verification} />
      </fieldset>

      <div className={cn("space-y-3 rounded-ctl border p-3", wantsVerified ? "border-accent/40" : "border-line")}>
        <p className="text-xs font-medium text-fg-muted">
          Supporting document {wantsVerified ? "(required for verified hours)" : "(optional)"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Use a document you uploaded" htmlFor={id("doc")} errors={errors?.documentId}>
            <Select id={id("doc")} name="documentId" value={documentId} onChange={(e) => setDocumentId(e.target.value)} disabled={Boolean(fileName)}>
              <option value="">{documents.length ? "None" : "No documents uploaded yet"}</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName} · {DOCUMENT_KIND_LABELS[d.kind]}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <Label htmlFor={id("file")}>…or attach a new file</Label>
            <input
              id={id("file")}
              name="file"
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-ctl file:border-0 file:bg-surface-strong file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-surface-hover"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f && f.size > MAX_DOCUMENT_BYTES) {
                  setFileError(`That file is larger than ${MAX_DOCUMENT_LABEL}.`);
                  e.currentTarget.value = "";
                  setFileName(null);
                  return;
                }
                setFileError(null);
                setFileName(f ? f.name : null);
                if (f) setDocumentId("");
              }}
            />
            <p className="mt-1 text-xs text-fg-subtle">
              {ALLOWED_TYPES_LABEL}, up to {MAX_DOCUMENT_LABEL}.
            </p>
            <FieldError errors={fileError ? [fileError] : errors?.file} />
          </div>
        </div>
        {fileName && (
          <Field label="This file is a…" htmlFor={id("dockind")} errors={errors?.documentKind}>
            <Select id={id("dockind")} name="documentKind" defaultValue="PAY_STUB">
              {HOUR_PROOF_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DOCUMENT_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {wantsVerified && !hasProof && (
          <p className="flex items-start gap-2 text-xs text-warning" role="status">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Without a document this entry will be saved as self-reported.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          {entry ? "Save changes" : "Log hours"}
        </Button>
        {entry && (
          <Button type="button" variant="ghost" onClick={() => router.push("/academy/hours")}>
            Cancel
          </Button>
        )}
        {entry && <p className="text-xs text-fg-subtle">Logged for {formatDayKey(entry.dateKey)}.</p>}
      </div>
    </form>
  );
}
