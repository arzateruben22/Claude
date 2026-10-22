"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ProgramInterestStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { removeProgramInterestAction, saveProgramInterestAction } from "@/lib/academy/programs/actions";
import { INTEREST_STATUS_HINTS, INTEREST_STATUS_LABELS, INTEREST_STATUS_ORDER } from "@/lib/academy/programs/labels";
import { useRecordsAction } from "./use-records-action";

type InterestValues = { status: ProgramInterestStatus; appliedAtKey: string | null; notes: string | null } | null;

/** Track a program: status (Interested → … → Accepted / Declined), application date and notes. */
export function ProgramInterestForm({
  programId,
  programName,
  interest,
  todayKey,
}: {
  programId: string;
  programName: string;
  interest: InterestValues;
  todayKey: string;
}) {
  const [state, action, pending] = useRecordsAction(saveProgramInterestAction);
  const [status, setStatus] = useState<ProgramInterestStatus>(interest?.status ?? "INTERESTED");
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="programId" value={programId} />
        <Field label="Status" htmlFor="interest-status" errors={errors?.status} hint={INTEREST_STATUS_HINTS[status]}>
          <Select id="interest-status" name="status" value={status} onChange={(e) => setStatus(e.target.value as ProgramInterestStatus)}>
            {INTEREST_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {INTEREST_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date you applied (optional)" htmlFor="interest-applied" errors={errors?.appliedAt} hint="Leave empty if you have not submitted an application.">
          <Input id="interest-applied" name="appliedAt" type="date" max={todayKey} defaultValue={interest?.appliedAtKey ?? ""} />
        </Field>
        <Field label="Notes (optional)" htmlFor="interest-notes" errors={errors?.notes}>
          <Textarea id="interest-notes" name="notes" maxLength={2000} defaultValue={interest?.notes ?? ""} placeholder="Test date, documents still needed, who you talked to…" />
        </Field>
        <Button type="submit" loading={pending}>
          {interest ? "Save changes" : `Save to my list`}
        </Button>
      </form>
      {interest && <RemoveInterest programId={programId} programName={programName} />}
    </div>
  );
}

function RemoveInterest({ programId, programName }: { programId: string; programName: string }) {
  const [, action, pending] = useRecordsAction(removeProgramInterestAction);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${programName} from your list? Your checklist ticks and notes for it will be deleted.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="programId" value={programId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {!pending && <Trash2 className="h-3.5 w-3.5" aria-hidden />}
        Remove from my list
      </Button>
    </form>
  );
}
