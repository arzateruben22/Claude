"use client";

import { useCallback, useState } from "react";
import {
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  MapPin,
  User,
} from "lucide-react";
import { InterviewOutcome, InterviewType } from "@/generated/prisma/enums";
import {
  interviewOutcomeAction,
  scheduleInterviewAction,
} from "@/lib/applications/actions";
import {
  INTERVIEW_OUTCOME_LABELS,
  INTERVIEW_TYPE_LABELS,
} from "@/lib/applications/labels";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { Tone } from "@/components/ui/badge";
import { useToastForm } from "./use-toast-action";

export type InterviewView = {
  id: string;
  type: InterviewType;
  scheduledLabel: string;
  isPast: boolean;
  durationMinutes: number | null;
  interviewer: string | null;
  location: string | null;
  outcome: InterviewOutcome;
  attended: boolean;
  prepCompleted: boolean;
  notes: string | null;
};

const TYPES = Object.keys(InterviewType) as InterviewType[];
const OUTCOMES = Object.keys(InterviewOutcome) as InterviewOutcome[];

const OUTCOME_TONE: Record<InterviewOutcome, Tone> = {
  PENDING: "neutral",
  ADVANCED: "success",
  REJECTED: "danger",
  OFFER: "gold",
  NO_SHOW: "warning",
  CANCELLED: "neutral",
};

export function InterviewsPanel({
  applicationId,
  interviews,
}: {
  applicationId: string;
  interviews: InterviewView[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const upcoming = interviews.filter((i) => !i.isPast);
  const past = interviews.filter((i) => i.isPast);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Interviews</CardTitle>
          <CardDescription>
            {interviews.length === 0
              ? "None scheduled yet."
              : `${upcoming.length} upcoming · ${past.length} past`}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Schedule interview
        </Button>
      </CardHeader>
      <CardContent>
        {interviews.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Scheduling an interview moves this application to Interviewing if it
            is not there yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {[...upcoming].reverse().map((i) => (
              <InterviewRow
                key={i.id}
                interview={i}
                applicationId={applicationId}
              />
            ))}
            {past.map((i) => (
              <InterviewRow
                key={i.id}
                interview={i}
                applicationId={applicationId}
              />
            ))}
          </ul>
        )}
      </CardContent>
      {open && (
        <Dialog
          open
          onClose={close}
          title="Schedule an interview"
          description="Times are in your profile timezone."
        >
          <ScheduleForm applicationId={applicationId} onDone={close} />
        </Dialog>
      )}
    </Card>
  );
}

function ScheduleForm({
  applicationId,
  onDone,
}: {
  applicationId: string;
  onDone: () => void;
}) {
  const { state, pending, formProps } = useToastForm(scheduleInterviewAction, {
    onSuccess: onDone,
  });
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} noValidate className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Field label="Interview type" htmlFor="iv-type" errors={fe?.type}>
        <Select id="iv-type" name="type" defaultValue="PHONE_SCREEN">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {INTERVIEW_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date and time" htmlFor="iv-when" errors={fe?.scheduledAt}>
        <Input id="iv-when" name="scheduledAt" type="datetime-local" required />
      </Field>
      <Field
        label="Duration (minutes)"
        htmlFor="iv-duration"
        errors={fe?.durationMinutes}
      >
        <Input
          id="iv-duration"
          name="durationMinutes"
          type="number"
          min={1}
          max={600}
          inputMode="numeric"
          placeholder="e.g. 30"
        />
      </Field>
      <Field
        label="Interviewer"
        htmlFor="iv-interviewer"
        errors={fe?.interviewer}
      >
        <Input id="iv-interviewer" name="interviewer" autoComplete="off" />
      </Field>
      <Field
        label="Location or link"
        htmlFor="iv-location"
        errors={fe?.location}
        className="sm:col-span-2"
      >
        <Input
          id="iv-location"
          name="location"
          autoComplete="off"
          placeholder="Address, phone number or video link"
        />
      </Field>
      <Field
        label="Notes"
        htmlFor="iv-notes"
        errors={fe?.notes}
        className="sm:col-span-2"
      >
        <Textarea id="iv-notes" name="notes" rows={2} />
      </Field>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save interview
        </Button>
      </div>
    </form>
  );
}

function InterviewRow({
  interview,
  applicationId,
}: {
  interview: InterviewView;
  applicationId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `interview-${interview.id}`;
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {INTERVIEW_TYPE_LABELS[interview.type]}
            <span className="text-fg-muted font-normal">
              {" "}
              · {interview.scheduledLabel}
            </span>
            {interview.durationMinutes ? (
              <span className="text-fg-subtle font-normal">
                {" "}
                · {interview.durationMinutes} min
              </span>
            ) : null}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            {interview.interviewer && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" aria-hidden /> {interview.interviewer}
              </span>
            )}
            {interview.location && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />{" "}
                <span className="truncate max-w-[16rem]">
                  {interview.location}
                </span>
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone={OUTCOME_TONE[interview.outcome]}>
              {INTERVIEW_OUTCOME_LABELS[interview.outcome]}
            </Badge>
            {interview.attended && <Badge tone="success">Attended</Badge>}
            {interview.prepCompleted && <Badge tone="accent">Prep done</Badge>}
            {!interview.isPast && <Badge tone="info">Upcoming</Badge>}
          </div>
          {interview.notes && (
            <p className="mt-1.5 text-xs text-fg-muted whitespace-pre-wrap break-words">
              {interview.notes}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
          Outcome
        </Button>
      </div>
      {expanded && (
        <div
          id={panelId}
          className="mt-3 rounded-ctl bg-surface border border-line p-3"
        >
          <OutcomeForm interview={interview} applicationId={applicationId} />
        </div>
      )}
    </li>
  );
}

function OutcomeForm({
  interview,
  applicationId,
}: {
  interview: InterviewView;
  applicationId: string;
}) {
  // Saved values re-key the form (fresh defaults); a failed save keeps what was chosen.
  const { state, pending, formProps } = useToastForm(interviewOutcomeAction, {
    resetOnSuccess: false,
  });
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const key = `${interview.outcome}:${interview.attended}:${interview.prepCompleted}`;
  return (
    <form
      key={key}
      {...formProps}
      noValidate
      className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
    >
      <input type="hidden" name="interviewId" value={interview.id} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-3">
        <Field
          label="Outcome"
          htmlFor={`outcome-${interview.id}`}
          errors={fe?.outcome}
        >
          <Select
            id={`outcome-${interview.id}`}
            name="outcome"
            defaultValue={interview.outcome}
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {INTERVIEW_OUTCOME_LABELS[o]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-4">
          <Checkbox
            name="attended"
            label="I attended this interview"
            defaultChecked={interview.attended}
          />
          <Checkbox
            name="prepCompleted"
            label="I completed my prep"
            defaultChecked={interview.prepCompleted}
          />
        </div>
      </div>
      <Button type="submit" size="sm" loading={pending}>
        Save outcome
      </Button>
    </form>
  );
}
