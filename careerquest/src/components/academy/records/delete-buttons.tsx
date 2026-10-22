"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteHourEntryAction } from "@/lib/academy/hours/actions";
import { deleteDocumentAction } from "@/lib/documents/actions";
import { useRecordsAction } from "./use-records-action";

/** Delete a work-hour entry (asks first). Its XP is revoked by the server. */
export function DeleteEntryButton({ id, label }: { id: string; label: string }) {
  const [, action, pending] = useRecordsAction(deleteHourEntryAction);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Delete ${label}? The XP it earned will be removed.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="icon" variant="ghost" loading={pending} aria-label={`Delete ${label}`}>
        {!pending && <Trash2 className="h-3.5 w-3.5" aria-hidden />}
      </Button>
    </form>
  );
}

/** Delete an uploaded document and its file (asks first). */
export function DeleteDocumentButton({ id, fileName, warning }: { id: string; fileName: string; warning?: string }) {
  const [, action, pending] = useRecordsAction(deleteDocumentAction);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Delete ${fileName}?${warning ? ` ${warning}` : ""}`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="icon" variant="ghost" loading={pending} aria-label={`Delete ${fileName}`}>
        {!pending && <Trash2 className="h-3.5 w-3.5" aria-hidden />}
      </Button>
    </form>
  );
}
