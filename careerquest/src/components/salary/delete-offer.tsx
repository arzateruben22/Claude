"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteOfferAction } from "@/lib/offers/actions";

export function DeleteOfferButton({ offerId, label }: { offerId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteOfferAction, null);
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete offer
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete this offer?" description={`The offer details for ${label} will be removed. The application itself stays in your tracker.`} size="sm">
        <form action={action} className="space-y-3">
          <input type="hidden" name="offerId" value={offerId} />
          {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Delete
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
