"use client";

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
import { useToastAction } from "./use-toast-action";

export function StatusChangePanel({
  applicationId,
  status,
  today,
}: {
  applicationId: string;
  status: ApplicationStatus;
  today: string;
}) {
  const [state, formAction, pending] = useToastAction(changeStatusAction);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Update stage</CardTitle>
          <CardDescription>
            Currently {STATUS_LABELS[status]}. Changes are logged to the
            timeline with the date you pick.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
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
