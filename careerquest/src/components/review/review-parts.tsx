import Link from "next/link";
import type {
  ApplicationStatus,
  InterviewType,
} from "@/generated/prisma/enums";
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  StatusBadge,
} from "@/components/ui";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/applications/status";
import { INTERVIEW_TYPE_LABELS } from "@/lib/applications/labels";
import {
  SIGNAL_PREFIX,
  confidenceTone,
  matchStrength,
  percent,
  signalTone,
  type AttachOption,
  type ReviewCandidateView,
  type ReviewFieldsView,
  type SignalView,
} from "@/lib/ingest/review-view";

/**
 * Presentational pieces shared by the review cards. No hooks: usable from client cards and in
 * server-rendered smoke tests.
 */

export type FieldErrors = Record<string, string[]>;

/**
 * Pressing Enter in a text field submits a form with its first submit button. Review forms have
 * several decision buttons, so a disabled hidden first button turns implicit submission off.
 */
export function NoImplicitSubmit() {
  return (
    <button type="submit" disabled hidden aria-hidden="true" tabIndex={-1} />
  );
}

export function ConfidenceBadge({
  value,
  label = "Confidence",
}: {
  value: number;
  label?: string;
}) {
  return (
    <Badge tone={confidenceTone(value)}>
      {label} {percent(value)}
    </Badge>
  );
}

export function SignalList({
  signals,
  label,
}: {
  signals: SignalView[];
  label: string;
}) {
  if (!signals.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label={label}>
      {signals.map((s, i) => (
        <li key={`${s.label}-${i}`}>
          <Badge
            tone={signalTone(s.effect)}
            className="whitespace-normal text-left"
          >
            <span aria-hidden="true">{SIGNAL_PREFIX[s.effect]}</span>
            {s.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function CandidateMatches({
  candidates,
  pending,
  submitted,
}: {
  candidates: ReviewCandidateView[];
  pending: boolean;
  submitted: string | null;
}) {
  if (!candidates.length) {
    return (
      <p className="text-sm text-fg-muted">
        No tracked application looks like this one.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {candidates.map((c) => {
        const strength = matchStrength(c.score);
        const value = `attach:${c.applicationId}`;
        const name = `${c.companyName} – ${c.positionTitle}`;
        return (
          <li
            key={c.applicationId}
            className="rounded-ctl border border-line bg-bg-elevated p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/applications/${c.applicationId}`}
                  className="font-medium break-words hover:underline"
                >
                  {name}
                </Link>
                <p className="mt-0.5 text-xs text-fg-muted break-words">
                  {[c.location, c.sourceLabel, c.dateLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <StatusBadge status={c.status} />
                  {!c.statusVerified && (
                    <Badge tone="warning">Unverified</Badge>
                  )}
                  {c.archived && <Badge>Archived</Badge>}
                </div>
              </div>
              <Badge tone={strength.tone}>
                {strength.label} · {percent(c.score)}
              </Badge>
            </div>
            <div className="mt-2">
              <SignalList
                signals={c.signals}
                label={`Why it may match ${name}`}
              />
            </div>
            <Button
              type="submit"
              name="decision"
              value={value}
              variant="secondary"
              size="sm"
              className="mt-2"
              loading={pending && submitted === value}
              disabled={pending}
              aria-label={`Attach to this record: ${name}`}
            >
              Attach to this record
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function AttachOther({
  idPrefix,
  options,
  pending,
  submitted,
  errors,
}: {
  idPrefix: string;
  options: AttachOption[];
  pending: boolean;
  submitted: string | null;
  errors: FieldErrors;
}) {
  if (!options.length) return null;
  const id = `${idPrefix}-other`;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field
        label="Or attach to another application"
        htmlFor={id}
        errors={errors.otherApplicationId}
        className="min-w-0 flex-1"
      >
        <Select id={id} name="otherApplicationId" defaultValue="">
          <option value="">Choose an application…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        type="submit"
        name="decision"
        value="attach-other"
        variant="outline"
        loading={pending && submitted === "attach-other"}
        disabled={pending}
      >
        Attach
      </Button>
    </div>
  );
}

const INTERVIEW_TYPES = Object.keys(INTERVIEW_TYPE_LABELS) as InterviewType[];

export function InterviewTypeSelect({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: InterviewType;
}) {
  return (
    <Select id={id} name={name} defaultValue={defaultValue}>
      {INTERVIEW_TYPES.map((t) => (
        <option key={t} value={t}>
          {INTERVIEW_TYPE_LABELS[t]}
        </option>
      ))}
    </Select>
  );
}

export function StatusSelect({
  id,
  defaultValue,
}: {
  id: string;
  defaultValue: ApplicationStatus;
}) {
  return (
    <Select id={id} name="status" defaultValue={defaultValue}>
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}

/** Editable extracted fields (company, title, location, stage, and the interview time when relevant). */
export function ReviewFields({
  idPrefix,
  fields,
  errors,
  showInterview,
}: {
  idPrefix: string;
  fields: ReviewFieldsView;
  errors: FieldErrors;
  showInterview: boolean;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-medium text-fg-muted">
        Details (edit before confirming)
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company" htmlFor={id("company")} errors={errors.company}>
          <Input
            id={id("company")}
            name="company"
            defaultValue={fields.company}
            maxLength={200}
            autoComplete="off"
          />
        </Field>
        <Field label="Job title" htmlFor={id("title")} errors={errors.title}>
          <Input
            id={id("title")}
            name="title"
            defaultValue={fields.title}
            maxLength={200}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Location"
          htmlFor={id("location")}
          errors={errors.location}
        >
          <Input
            id={id("location")}
            name="location"
            defaultValue={fields.location}
            maxLength={160}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Stage"
          htmlFor={id("status")}
          errors={errors.status}
          hint="Inferred stages never move a record backwards or override what you confirmed."
        >
          <StatusSelect id={id("status")} defaultValue={fields.status} />
        </Field>
        {showInterview && (
          <>
            <Field
              label="Interview time"
              htmlFor={id("interviewAt")}
              errors={errors.interviewAt}
              hint="Read from the email. Clear it if the time is wrong or not set yet."
            >
              <Input
                id={id("interviewAt")}
                name="interviewAt"
                type="datetime-local"
                defaultValue={fields.interviewAt}
              />
            </Field>
            <Field
              label="Interview type"
              htmlFor={id("interviewType")}
              errors={errors.interviewType}
            >
              <InterviewTypeSelect
                id={id("interviewType")}
                name="interviewType"
                defaultValue={fields.interviewType}
              />
            </Field>
          </>
        )}
      </div>
      <p className="text-xs text-fg-subtle">
        Company and title are used when you create a new record. Attaching never
        renames an existing record; it only fills details that are still empty.
      </p>
    </fieldset>
  );
}
