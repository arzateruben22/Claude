"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleRestDayAction } from "@/lib/game/actions";
import { useGameAction } from "./use-game-action";

/** "Mark today as a rest day" toggle. Rest days pause today's daily missions and never break a streak. */
export function RestDayToggle({ restDay }: { restDay: boolean }) {
  const [, action, pending] = useGameAction(toggleRestDayAction);
  return (
    <form action={action}>
      <input type="hidden" name="restDay" value={restDay ? "false" : "true"} />
      <Button type="submit" size="sm" variant={restDay ? "secondary" : "outline"} loading={pending} aria-pressed={restDay} data-testid="rest-day-toggle">
        {!pending && (restDay ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />)}
        {restDay ? "Undo rest day" : "Mark today as a rest day"}
      </Button>
    </form>
  );
}
