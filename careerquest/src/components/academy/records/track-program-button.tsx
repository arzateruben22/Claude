"use client";

import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackProgramAction } from "@/lib/academy/programs/actions";
import { useRecordsAction } from "./use-records-action";

/** "Save to my list": starts tracking a program as Interested. */
export function TrackProgramButton({ programId, programName }: { programId: string; programName: string }) {
  const [, action, pending] = useRecordsAction(trackProgramAction);
  return (
    <form action={action}>
      <input type="hidden" name="programId" value={programId} />
      <Button type="submit" size="sm" variant="secondary" loading={pending} aria-label={`Save ${programName} to my list`}>
        {!pending && <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />}
        Save to my list
      </Button>
    </form>
  );
}
