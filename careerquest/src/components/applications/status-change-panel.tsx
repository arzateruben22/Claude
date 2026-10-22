"use client";

import { ShieldCheck } from "lucide-react";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { changeStatusAction } from "@/lib/applications/actions";
import { PIPELINE, STATUS_LABELS, TERMINAL } from "@/lib/applications/status";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { useToastForm } from "./use-toast-action";

export function StatusChangePanel({
  applicationId,
  status,
  today,
  verified = true,
  sourceLabel,
  applied = true,
}: {
  applicationId: string;
  status: ApplicationStatus;
  today: string;
  /** False when the current stage was inferred (email, extension, import) and not confirmed. */
  verified?: boolean;
  /** Who set the current stage, e.g. "Email". */
  sourceLabel?: string;
  /** Whether the record was ever applied (closing a never-applied lead does not count). */
  applied?: boolean;
}) {
  const { state, pending, formProps } = useToastForm(changeStatusAction);
  const confirm = useToastForm(changeStatusAction);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Update stage</CardTitle>
          <CardDescription>
            Currently {STATUS_LABELS[status]}
            {verified ? "" : ` (unverified${sourceLabel ? `, from ${sourceLabel}` : ""})`}.
            Changes are logged to the timeline with the date you pick.
            {!applied &&
              " Closing or withdrawing a lead you never applied to does not count as an application."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!verified && (
          <form
            {...confirm.formProps}
            className="flex flex-col gap-2 rounded-ctl border border-warning/30 bg-warning-soft px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="status" value={status} />
            <p className="text-sm text-fg-muted">
              This stage was inferred, not confirmed by you. If it is right,
              confirm it; otherwise pick the correct stage below.
            </p>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              loading={confirm.pending}
              className="shrink-0"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Confirm {STATUS_LABELS[status]}
            </Button>
          </form>
        )}
        <form
          {...formProps}
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New stage" htmlFor="status" errors={fe?.status}>
              <Select
                id="status"
                name="status"
                key={status}
                defaultValue={status}
              >
                <optgroup label="Pipeline">
                  {PIPELINE.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Closed">
                  {TERMINAL.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Field
              label="Happened on"
              htmlFor="status-occurredAt"
              errors={fe?.occurredAt}
              hint="Blank means now."
            >
              <Input
                id="status-occurredAt"
                name="occurredAt"
                type="date"
                max={today}
              />
            </Field>
            <Field
              label="Note (optional)"
              htmlFor="status-note"
              errors={fe?.note}
              className="sm:col-span-2"
            >
              <Textarea
                id="status-note"
                name="note"
                rows={2}
                placeholder="e.g. Recruiter called about a phone screen"
              />
            </Field>
          </div>
          <Button type="submit" loading={pending} className="sm:mb-[1.35rem]">
            Update status
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
