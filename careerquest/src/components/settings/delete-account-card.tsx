"use client";

import { useActionState, useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/lib/account/actions";
import { DELETE_CONFIRMATION } from "@/lib/account/schema";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, Field, Input } from "@/components/ui";

export function DeleteAccountCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const close = useCallback(() => {
    setOpen(false);
    setConfirm("");
  }, []);
  const [state, action, pending] = useActionState(deleteAccountAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const ready = confirm.trim() === DELETE_CONFIRMATION;

  return (
    <Card className="border-danger/30">
      <CardHeader>
        <div>
          <CardTitle className="text-danger">Delete my account</CardTitle>
          <CardDescription>Permanently removes {email} and everything attached to it. There is no undo and no grace period.</CardDescription>
        </div>
        <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete my account
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-fg-subtle">Export your data first if you want a copy. Deleting also revokes every API token and signs out every device.</p>
      </CardContent>
      {open && (
        <Dialog open onClose={close} title="Delete this account?" description="All applications, XP, academy progress and documents will be erased." size="sm">
          {state && !state.ok && !state.fieldErrors && (
            <Alert tone="danger" className="mb-3">
              {state.error}
            </Alert>
          )}
          <form action={action} noValidate className="space-y-4">
            <Field label={`Type ${DELETE_CONFIRMATION} to confirm`} htmlFor="delete-confirm" errors={fe?.confirm}>
              <Input id="delete-confirm" name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} required />
            </Field>
            <Field label="Your password" htmlFor="delete-password" errors={fe?.password}>
              <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Keep my account
              </Button>
              <Button type="submit" variant="danger" loading={pending} disabled={!ready}>
                Delete permanently
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </Card>
  );
}
