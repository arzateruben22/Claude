import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "accent" | "gold" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClass = tone
    ? { accent: "text-accent", gold: "text-gold", success: "text-success", warning: "text-warning", danger: "text-danger" }[tone]
    : "text-fg";
  return (
    <div className={cn("glass rounded-card p-4 min-w-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-fg-muted truncate">{label}</p>
        {icon && <span className="text-fg-subtle shrink-0">{icon}</span>}
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight tnum", toneClass)}>{value}</p>
      {hint && <div className="mt-1 text-xs text-fg-subtle">{hint}</div>}
    </div>
  );
}
