"use client";

import { useActionState } from "react";
import { RefreshCw, FileBarChart } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { generateWeeklyReportAction } from "@/lib/reports/actions";

/** Generate (current week) or regenerate (any listed week) a weekly report, then open it. */
export function GenerateReportForm({
  weekStart,
  label,
  variant = "primary",
  regenerate = false,
}: {
  weekStart?: string;
  label: string;
  variant?: ButtonVariant;
  regenerate?: boolean;
}) {
  const [state, action, pending] = useActionState(generateWeeklyReportAction, null);
  const Icon = regenerate ? RefreshCw : FileBarChart;
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1 print:hidden">
      {weekStart && <input type="hidden" name="weekStart" value={weekStart} />}
      <Button type="submit" variant={variant} size="sm" loading={pending}>
        {!pending && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </Button>
      {state && !state.ok && (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
