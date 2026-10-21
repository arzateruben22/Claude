"use client";

import { useCallback, useState } from "react";
import { RotateCcw } from "lucide-react";
import { restartCampaignAction } from "@/lib/profile/actions";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog } from "@/components/ui";
import { useSettingsAction } from "./use-settings-action";

export function RestartCampaign({ lengthDays, startedAtLabel }: { lengthDays: number; startedAtLabel: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [state, action, pending] = useSettingsAction(restartCampaignAction, close);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Restart the campaign</CardTitle>
          <CardDescription>Start a fresh {lengthDays}-day window from today. Nothing else changes.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Current campaign started {startedAtLabel}. Restarting keeps every application, event, mission, achievement and all XP.
        </p>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Restart {lengthDays}-day campaign
        </Button>
      </CardContent>
      {open && (
        <Dialog open onClose={close} title={`Restart the ${lengthDays}-day campaign?`} description="Day 1 becomes today." size="sm">
          <ul className="text-sm text-fg-muted list-disc pl-5 space-y-1">
            <li>The campaign start date moves to today and the status becomes Active.</li>
            <li>Applications, status history, interviews and offers are kept.</li>
            <li>XP, levels, streaks, achievements and completed missions are kept.</li>
            <li>Dashboard pace and phase counters start over from day 1.</li>
          </ul>
          {state && !state.ok && (
            <Alert tone="danger" className="mt-3">
              {state.error}
            </Alert>
          )}
          <form action={action} className="mt-4 flex justify-end gap-2">
            <input type="hidden" name="confirm" value="RESTART" />
            <Button type="button" variant="ghost" onClick={close}>
              Keep current campaign
            </Button>
            <Button type="submit" loading={pending}>
              Restart from today
            </Button>
          </form>
        </Dialog>
      )}
    </Card>
  );
}
