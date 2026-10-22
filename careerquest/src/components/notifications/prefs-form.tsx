"use client";

import { useActionState } from "react";
import { saveNotificationPrefsAction } from "@/lib/notifications/actions";
import { PREF_LABELS, type NotificationPrefs } from "@/lib/notifications/prefs";
import { Alert, Button } from "@/components/ui";

export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefs }) {
  const [state, action, pending] = useActionState(saveNotificationPrefsAction, null);
  return (
    <form action={action} className="space-y-3">
      {(Object.keys(PREF_LABELS) as (keyof NotificationPrefs)[]).map((key) => (
        <label key={key} className="flex items-start gap-3 rounded-ctl border border-line px-3 py-2.5 cursor-pointer hover:bg-surface-hover">
          <input type="checkbox" name={key} defaultChecked={prefs[key]} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{PREF_LABELS[key].label}</span>
            <span className="block text-xs text-fg-muted">{PREF_LABELS[key].hint}</span>
          </span>
        </label>
      ))}
      {state?.ok && <Alert tone="success">Preferences saved.</Alert>}
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" loading={pending}>
        Save preferences
      </Button>
    </form>
  );
}
