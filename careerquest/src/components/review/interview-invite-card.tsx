"use client";

import Link from "next/link";
import { Button, Card, CardContent, Field, Input } from "@/components/ui";
import { resolveInterviewInviteAction } from "@/lib/ingest/review-actions";
import type { InterviewInviteView } from "@/lib/ingest/review-view";
import { InterviewTypeSelect, NoImplicitSubmit } from "./review-parts";
import { useReviewForm } from "./use-review-form";

/** An automatically filed interview invitation whose time is not on the record yet. */
export function InterviewInviteCard({
  invite,
}: {
  invite: InterviewInviteView;
}) {
  const { pending, submitted, errors, formProps } = useReviewForm(
    resolveInterviewInviteAction,
  );
  const idPrefix = `invite-${invite.emailId}`;
  return (
    <Card>
      <form {...formProps} aria-labelledby={`${idPrefix}-title`}>
        <NoImplicitSubmit />
        <input type="hidden" name="emailId" value={invite.emailId} />
        <CardContent className="space-y-3 pt-5">
          <div className="min-w-0">
            <h3 id={`${idPrefix}-title`} className="font-medium break-words">
              <Link
                href={`/applications/${invite.applicationId}`}
                className="hover:underline"
              >
                {invite.companyName} – {invite.positionTitle}
              </Link>
            </h3>
            <p className="mt-0.5 text-xs text-fg-muted break-words">
              “{invite.subject}” · received {invite.receivedLabel} · time read
              from the email: {invite.interviewAtLabel} (not confirmed)
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Interview time"
              htmlFor={`${idPrefix}-at`}
              errors={errors.scheduledAt}
            >
              <Input
                id={`${idPrefix}-at`}
                name="scheduledAt"
                type="datetime-local"
                defaultValue={invite.interviewAt}
              />
            </Field>
            <Field
              label="Interview type"
              htmlFor={`${idPrefix}-type`}
              errors={errors.interviewType}
            >
              <InterviewTypeSelect
                id={`${idPrefix}-type`}
                name="interviewType"
                defaultValue={invite.interviewType}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="decision"
              value="add"
              size="sm"
              loading={pending && submitted === "add"}
              disabled={pending}
            >
              Add interview
            </Button>
            <Button
              type="submit"
              name="decision"
              value="skip"
              size="sm"
              variant="ghost"
              loading={pending && submitted === "skip"}
              disabled={pending}
            >
              Not needed
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
