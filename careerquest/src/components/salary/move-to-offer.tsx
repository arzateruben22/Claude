"use client";

import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastAction } from "@/components/applications/use-toast-action";
import { moveToOfferStageAction } from "@/lib/offers/actions";
import { STATUS_LABELS } from "@/lib/applications/status";
import type { ApplicationStatus } from "@/generated/prisma/enums";

/**
 * Explicit user action that moves the linked application to the Offer stage (the tracker records
 * the change as made by you). Shown only while the application is below that stage.
 */
export function MoveToOfferButton({ applicationId, status, company }: { applicationId: string; status: ApplicationStatus; company: string }) {
  const [, action, pending] = useToastAction(moveToOfferStageAction);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-ctl border border-gold/30 bg-gold-soft px-3 py-2.5 text-sm" data-testid="move-to-offer">
      <input type="hidden" name="applicationId" value={applicationId} />
      <p className="min-w-0 flex-1">
        Your tracker still shows {company} at <strong className="font-medium">{STATUS_LABELS[status]}</strong>. Recording an offer does not change that on
        its own.
      </p>
      <Button type="submit" variant="gold" size="sm" loading={pending}>
        <ArrowUpRight className="h-4 w-4" aria-hidden />
        Move application to Offer
      </Button>
    </form>
  );
}
