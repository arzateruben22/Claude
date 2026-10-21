import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

const styles = {
  info: { cls: "bg-info-soft border-info/30 text-fg", Icon: Info, iconCls: "text-info" },
  success: { cls: "bg-success-soft border-success/30 text-fg", Icon: CheckCircle2, iconCls: "text-success" },
  warning: { cls: "bg-warning-soft border-warning/30 text-fg", Icon: AlertTriangle, iconCls: "text-warning" },
  danger: { cls: "bg-danger-soft border-danger/30 text-fg", Icon: XCircle, iconCls: "text-danger" },
};

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof styles; title?: string; children?: ReactNode; className?: string }) {
  const s = styles[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-ctl border px-3.5 py-3 text-sm flex gap-2.5", s.cls, className)}>
      <s.Icon className={cn("h-4 w-4 mt-0.5 shrink-0", s.iconCls)} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-fg-muted")}>{children}</div>}
      </div>
    </div>
  );
}
