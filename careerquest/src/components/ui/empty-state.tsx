import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("glass rounded-card px-6 py-10 text-center flex flex-col items-center", className)}>
      {icon && <div className="text-fg-subtle mb-3">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-fg-muted max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
