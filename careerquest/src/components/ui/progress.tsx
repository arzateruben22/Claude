import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 1,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "gold" | "success" | "warning" | "info";
  className?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = {
    accent: "bg-accent",
    gold: "bg-gold",
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 w-full rounded-full bg-surface-strong overflow-hidden", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
