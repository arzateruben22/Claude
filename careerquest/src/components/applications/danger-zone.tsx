"use client";

import { useActionState, useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import {
  archiveApplicationAction,
  deleteApplicationAction,
  restoreApplicationAction,
} from "@/lib/applications/actions";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
} from "@/components/ui";
import { useToastAction } from "./use-toast-action";

export function DangerZone({
  applicationId,
  archived,
  label,
}: {
  applicationId: string;
  archived: boolean;
  label: string;
}) {
  const [, archiveAction, archiving] = useToastAction(archiveApplicationAction);
  const [, restoreAction, restoring] = useToastAction(restoreApplicationAction);
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteApplicationAction,
    null,
  );
  const [confirm, setConfirm] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Archive or delete</CardTitle>
          <CardDescription>
            Archiving hides it from your list and from funnel rates but keeps
            its history; if you applied, it still counts as an application
            you sent. Deleting removes it for good.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {archived ? (
          <form action={restoreAction}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={restoring}
            >
              <ArchiveRestore className="h-4 w-4" aria-hidden />
              Restore
            </Button>
          </form>
        ) : (
          <form action={archiveAction}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={archiving}
            >
              <Archive className="h-4 w-4" aria-hidden />
              Archive
            </Button>
          </form>
        )}
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => setConfirm(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete
        </Button>
      </CardContent>
      {confirm && (
        <Dialog
          open
          onClose={() => setConfirm(false)}
          title="Delete this application?"
          description={label}
          size="sm"
        >
          <p className="text-sm text-fg-muted">
            Its status history, notes, interviews and timeline will be removed,
            the XP it earned is taken back, and it stops counting toward your
            targets and stats.
          </p>
          {deleteState && !deleteState.ok && (
            <Alert tone="danger" className="mt-3">
              {deleteState.error}
            </Alert>
          )}
          <form action={deleteAction} className="mt-4 flex justify-end gap-2">
            <input type="hidden" name="applicationId" value={applicationId} />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirm(false)}
            >
              Keep it
            </Button>
            <Button type="submit" variant="danger" loading={deleting}>
              Delete permanently
            </Button>
          </form>
        </Dialog>
      )}
    </Card>
  );
}
