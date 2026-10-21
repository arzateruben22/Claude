import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "accent" | "success" | "warning" | "danger" | "gold";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-strong text-fg-muted border-line",
  info: "bg-info-soft text-info border-info/30",
  accent: "bg-accent-soft text-accent border-accent/30",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  gold: "bg-gold-soft text-gold border-gold/30",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}
