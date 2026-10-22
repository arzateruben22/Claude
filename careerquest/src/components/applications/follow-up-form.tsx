"use client";

import { Send } from "lucide-react";
import { followUpAction } from "@/lib/applications/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { useToastForm } from "./use-toast-action";

export function FollowUpForm({
  applicationId,
  today,
  nextFollowUpLabel,
}: {
  applicationId: string;
  today: string;
  nextFollowUpLabel: string | null;
}) {
  const { state, pending, formProps } = useToastForm(followUpAction);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Follow-up</CardTitle>
          <CardDescription>
            {nextFollowUpLabel
              ? `Next follow-up planned for ${nextFollowUpLabel}.`
              : "No follow-up planned."}{" "}
            Logging one records it on the timeline and earns XP once per day per
            application.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form {...formProps} noValidate className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="applicationId" value={applicationId} />
          <Field
            label="Followed up on"
            htmlFor="fu-occurredAt"
            errors={fe?.occurredAt}
            hint="Blank means now."
          >
            <Input
              id="fu-occurredAt"
              name="occurredAt"
              type="date"
              max={today}
            />
          </Field>
          <Field
            label="Plan the next follow-up"
            htmlFor="fu-next"
            errors={fe?.nextFollowUpAt}
            hint="Blank clears the reminder."
          >
            <Input id="fu-next" name="nextFollowUpAt" type="date" />
          </Field>
          <Field
            label="What you did (optional)"
            htmlFor="fu-note"
            errors={fe?.note}
            className="sm:col-span-2"
          >
            <Textarea
              id="fu-note"
              name="note"
              rows={2}
              placeholder="e.g. Emailed the recruiter to confirm they received my application"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" variant="secondary" loading={pending}>
              <Send className="h-4 w-4" aria-hidden />
              Log follow-up
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
