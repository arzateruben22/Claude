"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMounted } from "@/lib/hooks";

/** Accessible modal dialog using the native <dialog> element (focus trap, ESC, backdrop). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const mounted = useIsMounted();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!mounted) return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" }[size];
  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm bg-transparent p-0 m-auto w-[calc(100%-2rem)] open:flex",
        width,
      )}
      aria-labelledby="cq-dialog-title"
    >
      <div className={cn("glass-strong rounded-card w-full text-fg shadow-card bg-bg-elevated", className)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="cq-dialog-title" className="text-base font-semibold">
              {title}
            </h2>
            {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-ctl p-1.5 text-fg-muted hover:text-fg hover:bg-surface-hover">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 pb-5 pt-3 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
