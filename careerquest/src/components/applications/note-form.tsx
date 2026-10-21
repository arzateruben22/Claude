"use client";

import { addNoteAction } from "@/lib/applications/actions";
import { Button, Field, Textarea } from "@/components/ui";
import { useToastAction } from "./use-toast-action";

export function NoteForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, pending] = useToastAction(addNoteAction);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={formAction} noValidate className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Field label="Add a note" htmlFor="new-note" errors={fe?.note}>
        <Textarea
          id="new-note"
          name="note"
          rows={3}
          placeholder="Dated automatically on the timeline"
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" size="sm" loading={pending}>
          Add note
        </Button>
      </div>
    </form>
  );
}
