import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Standard pay disclaimers shown under every salary result. */
export function PayDisclaimer({ className, extra }: { className?: string; extra?: string }) {
  return (
    <div className={cn("flex gap-2 rounded-ctl border border-line bg-surface px-3 py-2.5 text-xs text-fg-muted", className)} data-testid="pay-disclaimer">
      <Info className="h-4 w-4 shrink-0 mt-0.5 text-info" aria-hidden />
      <p>
        <strong className="font-medium text-fg">Estimates, gross before taxes and deductions.</strong> Overtime and raises are never guaranteed:
        they depend on the employer, the work available and agreements that can change. Weekly and monthly figures are averages (annual ÷ 52 and ÷ 12).
        {extra ? ` ${extra}` : ""}
      </p>
    </div>
  );
}
