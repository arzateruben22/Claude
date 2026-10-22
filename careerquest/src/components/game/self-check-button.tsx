"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkOffMissionAction } from "@/lib/game/actions";
import { useGameAction } from "./use-game-action";

/** Lets the user check off a self-reported mission (e.g. "Review your funnel analytics"). */
export function SelfCheckButton({ missionId, title }: { missionId: string; title: string }) {
  const [, action, pending] = useGameAction(checkOffMissionAction);
  return (
    <form action={action}>
      <input type="hidden" name="missionId" value={missionId} />
      <Button type="submit" size="sm" variant="outline" loading={pending} aria-label={`Mark "${title}" as done (self-reported)`}>
        {!pending && <Check className="h-3.5 w-3.5" aria-hidden />}
        I did this
      </Button>
    </form>
  );
}
