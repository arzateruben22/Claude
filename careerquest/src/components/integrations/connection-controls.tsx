"use client";

import { useState } from "react";
import { RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToastAction } from "@/components/applications/use-toast-action";
import { disconnectAction, setSyncEnabledAction, syncNowAction } from "@/lib/integrations/actions";

export function SyncNowButton({ connectionId, label }: { connectionId: string; label: string }) {
  const [, action, pending] = useToastAction(syncNowAction);
  return (
    <form action={action}>
      <input type="hidden" name="connectionId" value={connectionId} />
      <Button type="submit" size="sm" variant="secondary" loading={pending} aria-label={`Sync now: ${label}`}>
        {!pending && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        {pending ? "Syncing…" : "Sync now"}
      </Button>
    </form>
  );
}

export function SyncScheduleToggle({ connectionId, enabled }: { connectionId: string; enabled: boolean }) {
  const [, action, pending] = useToastAction(setSyncEnabledAction);
  return (
    <form action={action}>
      <input type="hidden" name="connectionId" value={connectionId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Button type="submit" size="sm" variant="ghost" loading={pending} aria-pressed={enabled}>
        Scheduled sync: {enabled ? "on" : "off"}
      </Button>
    </form>
  );
}

export function DisconnectButton({ connectionId, providerName, accountEmail }: { connectionId: string; providerName: string; accountEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [, action, pending] = useToastAction(disconnectAction, () => setOpen(false));
  const who = accountEmail ? `${providerName} (${accountEmail})` : providerName;
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Unplug className="h-3.5 w-3.5" aria-hidden />
        Disconnect
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Disconnect ${who}?`} size="sm">
        <form action={action} className="space-y-4 text-sm">
          <input type="hidden" name="connectionId" value={connectionId} />
          <ul className="list-disc pl-5 space-y-1 text-fg-muted">
            <li>Syncing stops and the stored tokens are deleted.</li>
            {providerName === "Gmail" ? (
              <li>CareerQuest also asks Google to revoke its access.</li>
            ) : (
              <li>Microsoft has no per-app revocation call: also remove the app in your Microsoft account settings.</li>
            )}
            <li>Applications already in your tracker stay there.</li>
          </ul>
          <Checkbox name="deleteEmails" label="Also delete the email records this connection imported" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Disconnect
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
