"use client";

import { Loader2 } from "lucide-react";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { changeStatusAction } from "@/lib/applications/actions";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/applications/status";
import { inputClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToastAction } from "./use-toast-action";

/** One-click stage change for a list row: a select that submits itself on change. */
export function QuickStatusSelect({
  applicationId,
  status,
  label,
  className,
}: {
  applicationId: string;
  status: ApplicationStatus;
  label: string;
  className?: string;
}) {
  const [, formAction, pending] = useToastAction(changeStatusAction);
  return (
    <form
      action={formAction}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <select
        key={status}
        name="status"
        defaultValue={status}
        aria-label={`Status for ${label}`}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={cn(inputClasses, "h-8 w-auto text-xs py-0 pr-7")}
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-fg-muted"
          aria-hidden
        />
      ) : null}
      <button type="submit" className="sr-only">
        Update status
      </button>
    </form>
  );
}
