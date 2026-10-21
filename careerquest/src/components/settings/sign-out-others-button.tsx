"use client";

import { LogOut } from "lucide-react";
import { signOutOtherSessionsAction } from "@/lib/account/actions";
import { Button } from "@/components/ui";
import { useSettingsAction } from "./use-settings-action";

export function SignOutOthersButton({ othersCount }: { othersCount: number }) {
  const [, action, pending] = useSettingsAction(signOutOtherSessionsAction);
  return (
    <form action={action}>
      <Button type="submit" variant="outline" size="sm" loading={pending} disabled={othersCount === 0} title={othersCount === 0 ? "No other sessions are active" : undefined}>
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out other sessions
      </Button>
    </form>
  );
}
